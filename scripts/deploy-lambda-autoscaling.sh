#!/usr/bin/env bash
# ============================================================================
# T0015 - Deploy Lambda Auto-Scaling, Canary Deployments & X-Ray Tracing
# ============================================================================
# Deploys provisioned concurrency, auto-scaling policies, CodeDeploy canary
# deployments, and X-Ray distributed tracing configuration.
#
# Usage:
#   ./scripts/deploy-lambda-autoscaling.sh
#   ./scripts/deploy-lambda-autoscaling.sh --env production
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="staging"
REGION="us-east-1"

for arg in "$@"; do
  case $arg in
    --env=*) ENVIRONMENT="${arg#*=}" ;;
    --help) echo "Usage: $0 [--env staging|production]"; exit 0 ;;
  esac
done

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  Lambda Auto-Scaling & Canary (T0015)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Resolve Lambda function ARNs from SAM stack
SAM_STACK="lynia-finance-${ENVIRONMENT/development/dev}"
[ "$ENVIRONMENT" = "staging" ] && SAM_STACK="lynia-finance-staging"
[ "$ENVIRONMENT" = "production" ] && SAM_STACK="lynia-finance-prod"

log "Resolving Lambda function ARNs..."

PAYMENT_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`PaymentFunctionArn`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "")

SCORING_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`ScoringFunctionArn`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "")

WHATSAPP_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`WhatsAppFunctionArn`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [ -z "$PAYMENT_ARN" ] || [ "$PAYMENT_ARN" = "None" ]; then
  fail "Lambda function ARNs not found. Deploy Lambda functions first (T0010)."
  exit 1
fi
success "Lambda ARNs resolved"

# ============================================================================
# Deploy Lambda Auto-Scaling
# ============================================================================
AUTOSCALING_STACK="${ENVIRONMENT}-lynia-autoscaling"
log "Deploying provisioned concurrency and auto-scaling..."

aws cloudformation deploy \
  --stack-name "$AUTOSCALING_STACK" \
  --template-file infrastructure/aws/lambda-autoscaling.yaml \
  --parameter-overrides \
    "Environment=${ENVIRONMENT}" \
    "PaymentFunctionArn=${PAYMENT_ARN}" \
    "ScoringFunctionArn=${SCORING_ARN}" \
    "WhatsAppFunctionArn=${WHATSAPP_ARN}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "Lambda auto-scaling deployed"

# ============================================================================
# Deploy Canary Deployments
# ============================================================================
CANARY_STACK="${ENVIRONMENT}-lynia-canary"
log "Deploying CodeDeploy canary deployment configuration..."

aws cloudformation deploy \
  --stack-name "$CANARY_STACK" \
  --template-file infrastructure/aws/canary-deployments.yaml \
  --parameter-overrides "Environment=${ENVIRONMENT}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "Canary deployment configuration deployed"

# ============================================================================
# Deploy X-Ray Tracing
# ============================================================================
XRAY_STACK="${ENVIRONMENT}-lynia-xray"
log "Deploying X-Ray tracing configuration..."

aws cloudformation deploy \
  --stack-name "$XRAY_STACK" \
  --template-file infrastructure/aws/xray-tracing.yaml \
  --parameter-overrides "Environment=${ENVIRONMENT}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "X-Ray tracing deployed"

# ============================================================================
# Verify
# ============================================================================
log "Verifying provisioned concurrency..."

SERVICES=("payment" "scoring" "whatsapp")
for svc in "${SERVICES[@]}"; do
  FUNC_NAME="${ENVIRONMENT}-lynia-${svc}-service"
  PC_CONFIG=$(aws lambda get-provisioned-concurrency-config \
    --function-name "$FUNC_NAME" \
    --qualifier live \
    --query "Status" \
    --output text --region "$REGION" 2>/dev/null || echo "NOT_CONFIGURED")

  if [ "$PC_CONFIG" = "READY" ]; then
    success "$FUNC_NAME provisioned concurrency: READY"
  elif [ "$PC_CONFIG" = "IN_PROGRESS" ]; then
    warn "$FUNC_NAME provisioned concurrency: IN_PROGRESS (allocating)"
  else
    warn "$FUNC_NAME provisioned concurrency: $PC_CONFIG"
  fi
done

echo ""
echo "============================================"
success "T0015 complete - Auto-scaling, canary, X-Ray deployed"
echo "============================================"
echo ""
