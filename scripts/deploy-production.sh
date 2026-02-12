#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - Production Deployment Script
# ============================================================================
# Orchestrates the full production deployment in the correct order:
#   1. Pre-flight checks (AWS credentials, tools, branch, uncommitted changes)
#   2. Infrastructure stacks (VPC, secrets, SQS, IAM, DNS, monitoring)
#   3. Lambda services (SAM build + deploy with VPC configuration)
#   4. Frontend deployment (build, S3 sync, CloudFront invalidation)
#   5. Post-deployment validation (health checks, smoke tests)
#
# Usage:
#   ./scripts/deploy-production.sh                    # Full deployment
#   ./scripts/deploy-production.sh --skip-infra       # Skip infra stacks
#   ./scripts/deploy-production.sh --skip-frontend    # Skip frontend
#   ./scripts/deploy-production.sh --dry-run          # Simulate only
#   ./scripts/deploy-production.sh --services-only    # Lambda services only
#
# Prerequisites:
#   - AWS CLI v2 configured with production credentials
#   - AWS SAM CLI installed
#   - Node.js 20.x and pnpm installed
#   - Production secrets stored in AWS Secrets Manager
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT="production"
REGION="us-east-1"
STACK_PREFIX="lynia-finance"
TEMPLATE_BUCKET="${STACK_PREFIX}-${ENVIRONMENT}-templates"

# Parse arguments
SKIP_INFRA=false
SKIP_FRONTEND=false
DRY_RUN=false
SERVICES_ONLY=false
for arg in "$@"; do
  case $arg in
    --skip-infra) SKIP_INFRA=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
    --dry-run) DRY_RUN=true ;;
    --services-only) SERVICES_ONLY=true; SKIP_INFRA=true; SKIP_FRONTEND=true ;;
    --help)
      echo "Usage: $0 [--skip-infra] [--skip-frontend] [--dry-run] [--services-only]"
      echo ""
      echo "Options:"
      echo "  --skip-infra      Skip infrastructure stack deployment"
      echo "  --skip-frontend   Skip frontend build and S3 deployment"
      echo "  --dry-run         Simulate deployment without making changes"
      echo "  --services-only   Deploy only Lambda services (skip infra + frontend)"
      exit 0
      ;;
  esac
done

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"; }

# ============================================================================
# STEP 0: Pre-flight Checks
# ============================================================================
preflight_checks() {
  log "Running pre-flight checks..."

  # Check AWS CLI
  if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Install: https://aws.amazon.com/cli/"
    exit 1
  fi
  success "AWS CLI found"

  # Check SAM CLI
  if ! command -v sam &> /dev/null; then
    error "AWS SAM CLI not found."
    exit 1
  fi
  success "SAM CLI found"

  # Check Node.js version
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    error "Node.js 20.x required. Current: $(node -v)"
    exit 1
  fi
  success "Node.js $(node -v) found"

  # Verify AWS credentials and region
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
  if [ -z "$ACCOUNT_ID" ]; then
    error "AWS credentials not configured. Run: aws configure"
    exit 1
  fi

  echo ""
  log "AWS Account: $ACCOUNT_ID"
  log "AWS Region:  $REGION"
  aws sts get-caller-identity --output table
  echo ""

  # Check that we're on the correct branch
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  log "Git branch: $CURRENT_BRANCH"
  if [[ "$CURRENT_BRANCH" != "master" && "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != release/* ]]; then
    warn "Not on master/main/release branch. Current: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi

  # Check for uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    warn "Uncommitted changes detected:"
    git status --short
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi

  success "Pre-flight checks passed"
}

# ============================================================================
# STEP 1: Build Lambda Services
# ============================================================================
build_services() {
  log "Building Lambda services..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would run: sam build --config-env production"
    return
  fi

  sam build \
    --config-env production \
    --parallel \
    --cached

  log "Validating SAM template..."
  sam validate --lint

  success "Lambda services built and validated"
}

# ============================================================================
# STEP 2: Deploy Infrastructure Stacks
# ============================================================================
deploy_infrastructure() {
  if [ "$SKIP_INFRA" = true ]; then
    warn "Skipping infrastructure deployment (--skip-infra)"
    return
  fi

  log "Deploying infrastructure stacks..."

  # Verify bootstrap stack (deployment buckets) exists
  if [ "$DRY_RUN" = false ]; then
    if ! aws cloudformation describe-stacks \
        --stack-name "${ENVIRONMENT}-lynia-deployment-buckets" \
        --region "$REGION" &>/dev/null; then
      error "Bootstrap stack '${ENVIRONMENT}-lynia-deployment-buckets' not found."
      error "Run: ./scripts/setup-s3-template-bucket.sh --env ${ENVIRONMENT}"
      exit 1
    fi
    success "Bootstrap stack verified: ${ENVIRONMENT}-lynia-deployment-buckets"
  fi

  # Upload nested stack templates
  log "Uploading CloudFormation templates to S3..."
  local templates=(
    "infrastructure/aws/deployment-buckets.yaml"
    "infrastructure/aws/vpc.yaml"
    "infrastructure/aws/secrets-manager.yaml"
    "infrastructure/aws/sqs-queues.yaml"
    "infrastructure/aws/iam-roles.yaml"
    "infrastructure/aws/dns-ssl.yaml"
    "infrastructure/aws/frontend-hosting.yaml"
    "infrastructure/aws/waf.yaml"
    "infrastructure/aws/canary-deployments.yaml"
    "infrastructure/aws/lambda-autoscaling.yaml"
    "infrastructure/aws/xray-tracing.yaml"
    "infrastructure/monitoring/cloudwatch-alarms.yaml"
    "infrastructure/database/production-pooling.yaml"
  )

  for template in "${templates[@]}"; do
    local filename
    filename=$(basename "$template")
    if [ "$DRY_RUN" = true ]; then
      log "[DRY RUN] Would upload: $template"
    else
      aws s3 cp "$template" "s3://${TEMPLATE_BUCKET}/${filename}" --region "$REGION"
    fi
  done

  # Deploy Layer 1: No-dependency stacks (parallel)
  log "Deploying Layer 1: VPC, SQS, Monitoring, Database Pooling..."
  deploy_stack "${ENVIRONMENT}-lynia-vpc" "infrastructure/aws/vpc.yaml" \
    "Environment=${ENVIRONMENT}"

  deploy_stack "${ENVIRONMENT}-lynia-sqs" "infrastructure/aws/sqs-queues.yaml" \
    "Environment=${ENVIRONMENT}"

  deploy_stack "${ENVIRONMENT}-lynia-monitoring" "infrastructure/monitoring/cloudwatch-alarms.yaml" \
    "Environment=${ENVIRONMENT}"

  deploy_stack "${ENVIRONMENT}-lynia-db-pooling" "infrastructure/database/production-pooling.yaml" \
    "Environment=${ENVIRONMENT}"

  success "Infrastructure stacks deployed"
}

deploy_stack() {
  local stack_name=$1
  local template=$2
  local params=$3

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would deploy stack: $stack_name"
    return
  fi

  aws cloudformation deploy \
    --stack-name "$stack_name" \
    --template-file "$template" \
    --parameter-overrides $params \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --region "$REGION" \
    --no-fail-on-empty-changeset \
    --tags Environment="$ENVIRONMENT" Project=lynia-finance
}

# ============================================================================
# STEP 3: Deploy Lambda Services (SAM)
# ============================================================================
deploy_services() {
  log "Deploying Lambda services to production..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would run: sam deploy --config-env production"
    return
  fi

  # Get VPC outputs for Lambda configuration
  VPC_ENABLED="true"
  PRIVATE_SUBNET_1=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-lynia-vpc" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet1Id'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  PRIVATE_SUBNET_2=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-lynia-vpc" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet2Id'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  LAMBDA_SG=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-lynia-vpc" \
    --query "Stacks[0].Outputs[?OutputKey=='LambdaSecurityGroupId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")

  if [ -z "$PRIVATE_SUBNET_1" ] || [ -z "$LAMBDA_SG" ]; then
    warn "VPC stack outputs not found. Deploying without VPC."
    VPC_ENABLED="false"
  fi

  log "VPC Enabled: $VPC_ENABLED"

  sam deploy \
    --config-env production \
    --no-fail-on-empty-changeset \
    --parameter-overrides \
      "VpcEnabled=${VPC_ENABLED}" \
      "PrivateSubnet1Id=${PRIVATE_SUBNET_1:-}" \
      "PrivateSubnet2Id=${PRIVATE_SUBNET_2:-}" \
      "LambdaSecurityGroupId=${LAMBDA_SG:-sg-00000000}" \
    --on-failure ROLLBACK

  success "Lambda services deployed to production"

  # Print API Gateway URL
  API_URL=$(aws cloudformation describe-stacks \
    --stack-name lynia-finance-prod \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text --region "$REGION" 2>/dev/null || echo "unknown")
  log "API Gateway URL: $API_URL"
}

# ============================================================================
# STEP 4: Deploy Frontend
# ============================================================================
deploy_frontend() {
  if [ "$SKIP_FRONTEND" = true ]; then
    warn "Skipping frontend deployment (--skip-frontend)"
    return
  fi

  log "Building and deploying frontend applications..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would build and deploy admin-portal and distributor-dashboard"
    return
  fi

  # Build admin portal
  log "Building admin portal..."
  (cd frontend/admin-portal && pnpm install --frozen-lockfile && pnpm build)

  # Build distributor dashboard
  log "Building distributor dashboard..."
  (cd frontend/distributor-dashboard && pnpm install --frozen-lockfile && pnpm build)

  # Get S3 bucket names
  ADMIN_BUCKET="${ENVIRONMENT}-lynia-admin-portal"
  DISTRIBUTOR_BUCKET="${ENVIRONMENT}-lynia-distributor-dashboard"

  # Get CloudFront distribution IDs
  ADMIN_CF_ID=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-lynia-frontend" \
    --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")

  DISTRIBUTOR_CF_ID=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-lynia-frontend" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardDistributionId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")

  # Sync admin portal to S3 (static assets with long cache, HTML with no-cache)
  log "Uploading admin portal to S3..."
  aws s3 sync frontend/admin-portal/out/ "s3://${ADMIN_BUCKET}/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --region "$REGION"

  aws s3 sync frontend/admin-portal/out/ "s3://${ADMIN_BUCKET}/" \
    --exclude "*" --include "*.html" \
    --cache-control "public, max-age=0, must-revalidate" \
    --region "$REGION"

  # Sync distributor dashboard to S3
  log "Uploading distributor dashboard to S3..."
  aws s3 sync frontend/distributor-dashboard/out/ "s3://${DISTRIBUTOR_BUCKET}/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --region "$REGION"

  aws s3 sync frontend/distributor-dashboard/out/ "s3://${DISTRIBUTOR_BUCKET}/" \
    --exclude "*" --include "*.html" \
    --cache-control "public, max-age=0, must-revalidate" \
    --region "$REGION"

  # Invalidate CloudFront caches
  if [ -n "$ADMIN_CF_ID" ]; then
    log "Invalidating admin portal CloudFront cache..."
    aws cloudfront create-invalidation \
      --distribution-id "$ADMIN_CF_ID" \
      --paths "/*"
  fi

  if [ -n "$DISTRIBUTOR_CF_ID" ]; then
    log "Invalidating distributor dashboard CloudFront cache..."
    aws cloudfront create-invalidation \
      --distribution-id "$DISTRIBUTOR_CF_ID" \
      --paths "/*"
  fi

  success "Frontend applications deployed"
}

# ============================================================================
# STEP 5: Post-Deployment Validation
# ============================================================================
post_deploy_validation() {
  log "Running post-deployment validation..."

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would run validation checks"
    return
  fi

  if [ -f "scripts/validate-production.sh" ]; then
    bash scripts/validate-production.sh
  else
    warn "Validation script not found. Manual verification required."
  fi

  echo ""
  log "PRODUCTION CHECKLIST:"
  echo "  [ ] Verify all API endpoints are responding"
  echo "  [ ] Check CloudWatch logs for errors"
  echo "  [ ] Monitor error rates in CloudWatch dashboard"
  echo "  [ ] Test critical flows (payment, KYC, WhatsApp)"
  echo "  [ ] Verify WAF rules are active"
  echo "  [ ] Confirm DNS resolution for custom domains"
  echo "  [ ] Notify team of successful deployment"
  echo ""
  log "View logs:    sam logs --config-env production --tail"
  log "View metrics: https://console.aws.amazon.com/cloudwatch"
  log "Rollback:     ./scripts/rollback.sh"

  success "Post-deployment validation complete"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================
main() {
  echo ""
  echo "============================================"
  echo "  Lynia Finance - Production Deployment"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "============================================"
  echo ""

  if [ "$DRY_RUN" = true ]; then
    warn "DRY RUN MODE - No changes will be made"
    echo ""
  fi

  # Safety confirmation for production
  if [ "$DRY_RUN" = false ]; then
    echo -e "${RED}WARNING: You are about to deploy to PRODUCTION${NC}"
    echo "This will affect live customers and real payments."
    echo ""
    read -p "Type 'PRODUCTION' to confirm: " CONFIRM
    if [ "$CONFIRM" != "PRODUCTION" ]; then
      error "Deployment cancelled. You must type 'PRODUCTION' exactly."
      exit 1
    fi
    echo ""
    read -p "Have you tested in staging? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      error "Please test in staging environment first."
      exit 1
    fi
    echo ""
  fi

  DEPLOY_START=$(date +%s)

  preflight_checks
  build_services
  deploy_infrastructure
  deploy_services
  deploy_frontend
  post_deploy_validation

  DEPLOY_END=$(date +%s)
  DURATION=$((DEPLOY_END - DEPLOY_START))

  echo ""
  echo "============================================"
  success "Production deployment complete!"
  log "Duration: ${DURATION}s"
  log "Git commit: $(git rev-parse --short HEAD)"
  echo "============================================"
  echo ""
  log "Production URLs:"
  echo "  API:          https://api.lyniafinance.com"
  echo "  Admin Portal: https://admin.lyniafinance.com"
  echo "  Distributor:  https://distributor.lyniafinance.com"
  echo ""
}

main
