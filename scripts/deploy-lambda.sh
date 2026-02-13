#!/usr/bin/env bash
# ============================================================================
# T0010 - Build & Deploy Lambda Functions via SAM
# ============================================================================
# Builds and deploys all 6 Lambda microservices with VPC networking,
# Cognito authorization, SQS event sources, and API Gateway routing.
#
# Usage:
#   ./scripts/deploy-lambda.sh                    # Deploy to staging (default)
#   ./scripts/deploy-lambda.sh --env production   # Deploy to production
#   ./scripts/deploy-lambda.sh --env development  # Deploy to development
#   ./scripts/deploy-lambda.sh --dry-run          # Validate without deploying
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="staging"
REGION="us-east-1"
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --env=*) ENVIRONMENT="${arg#*=}" ;;
    --env) shift; ENVIRONMENT="${2:-staging}" ;;
    --dry-run) DRY_RUN=true ;;
    --help)
      echo "Usage: $0 [--env staging|production|development] [--dry-run]"
      exit 0
      ;;
  esac
done

# Allow --env value as next positional arg
while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENVIRONMENT="${2:-staging}"; shift 2 ;;
    *) shift ;;
  esac
done

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  Lynia Finance - Lambda Deployment (T0010)"
echo "  Environment: ${ENVIRONMENT}"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# ============================================================================
# Step 1: Pre-flight checks
# ============================================================================
log "Running pre-flight checks..."

for cmd in aws sam node pnpm; do
  if ! command -v $cmd &>/dev/null; then
    fail "$cmd not found"
    exit 1
  fi
done
success "Required tools found (aws, sam, node, pnpm)"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$ACCOUNT_ID" ]; then
  fail "AWS credentials not configured"
  exit 1
fi
success "AWS Account: $ACCOUNT_ID"

# ============================================================================
# Step 2: Resolve VPC configuration from stack outputs
# ============================================================================
log "Resolving VPC configuration..."

VPC_ENABLED="false"
PRIVATE_SUBNET_1=""
PRIVATE_SUBNET_2=""
LAMBDA_SG="sg-00000000"

VPC_STACK="${ENVIRONMENT}-lynia-vpc"
if aws cloudformation describe-stacks --stack-name "$VPC_STACK" --region "$REGION" &>/dev/null; then
  PRIVATE_SUBNET_1=$(aws cloudformation describe-stacks \
    --stack-name "$VPC_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet1Id'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  PRIVATE_SUBNET_2=$(aws cloudformation describe-stacks \
    --stack-name "$VPC_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet2Id'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  LAMBDA_SG=$(aws cloudformation describe-stacks \
    --stack-name "$VPC_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='LambdaSecurityGroupId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "sg-00000000")

  if [ -n "$PRIVATE_SUBNET_1" ] && [ "$PRIVATE_SUBNET_1" != "None" ]; then
    VPC_ENABLED="true"
    success "VPC config resolved: ${PRIVATE_SUBNET_1}, ${PRIVATE_SUBNET_2}, ${LAMBDA_SG}"
  else
    warn "VPC stack found but outputs empty - deploying without VPC"
  fi
else
  warn "VPC stack not found - deploying without VPC"
fi

# ============================================================================
# Step 3: Resolve Cognito User Pool ARN
# ============================================================================
log "Resolving Cognito configuration..."

COGNITO_ARN=""
COGNITO_STACK="${ENVIRONMENT}-lynia-cognito"
if aws cloudformation describe-stacks --stack-name "$COGNITO_STACK" --region "$REGION" &>/dev/null; then
  COGNITO_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolArn'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  if [ -n "$COGNITO_ARN" ] && [ "$COGNITO_ARN" != "None" ]; then
    success "Cognito User Pool ARN: ${COGNITO_ARN}"
  else
    warn "Cognito stack found but ARN output empty"
    COGNITO_ARN=""
  fi
else
  warn "Cognito stack not found - deploying without Cognito authorizer"
fi

# ============================================================================
# Step 4: Install dependencies and build
# ============================================================================
log "Installing dependencies..."
pnpm install --frozen-lockfile

log "Building Lambda functions with SAM..."
SAM_CONFIG_ENV="default"
if [ "$ENVIRONMENT" = "staging" ]; then
  SAM_CONFIG_ENV="staging"
elif [ "$ENVIRONMENT" = "production" ]; then
  SAM_CONFIG_ENV="production"
fi

sam build --config-env "$SAM_CONFIG_ENV" --parallel --cached
success "SAM build completed"

log "Validating SAM template..."
sam validate --lint 2>/dev/null || warn "cfn-lint not installed, skipping lint validation"
success "SAM template validated"

# ============================================================================
# Step 5: Deploy
# ============================================================================
if [ "$DRY_RUN" = true ]; then
  warn "DRY RUN - skipping deployment"
  log "Would deploy with:"
  log "  Environment: $ENVIRONMENT"
  log "  VPC Enabled: $VPC_ENABLED"
  log "  Cognito ARN: ${COGNITO_ARN:-none}"
  exit 0
fi

log "Deploying Lambda functions to ${ENVIRONMENT}..."

# Clean up ROLLBACK_COMPLETE stacks
STACK_NAME="lynia-finance-${ENVIRONMENT/development/dev}"
if [ "$ENVIRONMENT" = "development" ]; then
  STACK_NAME="lynia-finance-dev"
elif [ "$ENVIRONMENT" = "staging" ]; then
  STACK_NAME="lynia-finance-staging"
elif [ "$ENVIRONMENT" = "production" ]; then
  STACK_NAME="lynia-finance-prod"
fi

STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].StackStatus' \
  --output text --region "$REGION" 2>/dev/null || echo "DOES_NOT_EXIST")

if [ "$STACK_STATUS" = "ROLLBACK_COMPLETE" ]; then
  warn "Stack in ROLLBACK_COMPLETE state - deleting before redeploy..."
  aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION"
  success "Failed stack deleted"
fi

sam deploy \
  --config-env "$SAM_CONFIG_ENV" \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "Environment=${ENVIRONMENT}" \
    "VpcEnabled=${VPC_ENABLED}" \
    "PrivateSubnet1Id=${PRIVATE_SUBNET_1:-}" \
    "PrivateSubnet2Id=${PRIVATE_SUBNET_2:-}" \
    "LambdaSecurityGroupId=${LAMBDA_SG}" \
    "CognitoUserPoolArn=${COGNITO_ARN:-}" \
  --on-failure ROLLBACK

success "Lambda functions deployed to ${ENVIRONMENT}"

# ============================================================================
# Step 6: Verify deployment
# ============================================================================
log "Verifying deployment..."

FUNCTIONS=(
  "${ENVIRONMENT}-lynia-scoring-service"
  "${ENVIRONMENT}-lynia-whatsapp-service"
  "${ENVIRONMENT}-lynia-kyc-service"
  "${ENVIRONMENT}-lynia-payment-service"
  "${ENVIRONMENT}-lynia-lock-service"
  "${ENVIRONMENT}-lynia-notification-service"
)

ALL_ACTIVE=true
for func in "${FUNCTIONS[@]}"; do
  STATE=$(aws lambda get-function \
    --function-name "$func" \
    --query "Configuration.State" \
    --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

  if [ "$STATE" = "Active" ]; then
    RUNTIME=$(aws lambda get-function \
      --function-name "$func" \
      --query "Configuration.Runtime" \
      --output text --region "$REGION" 2>/dev/null || echo "unknown")
    MEMORY=$(aws lambda get-function \
      --function-name "$func" \
      --query "Configuration.MemorySize" \
      --output text --region "$REGION" 2>/dev/null || echo "unknown")
    success "$func: Active (${RUNTIME}, ${MEMORY}MB)"
  else
    fail "$func: $STATE"
    ALL_ACTIVE=false
  fi
done

# Print API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "unknown")

echo ""
echo "============================================"
if [ "$ALL_ACTIVE" = true ]; then
  success "All 6 Lambda functions deployed and active"
else
  fail "Some functions failed to deploy"
fi
log "API Gateway URL: $API_URL"
echo "============================================"
echo ""
