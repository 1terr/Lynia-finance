#!/usr/bin/env bash
# ============================================================================
# T0011 - Deploy API Gateway Throttling & Usage Plans
# ============================================================================
# Deploys 3 tiered usage plans, 5 API keys, and CloudWatch logging
# for the API Gateway.
#
# Usage:
#   ./scripts/deploy-api-gateway-throttling.sh
#   ./scripts/deploy-api-gateway-throttling.sh --env production
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="staging"
REGION="us-east-1"
TEMPLATE_BUCKET="lynia-finance-${ENVIRONMENT}-templates"

for arg in "$@"; do
  case $arg in
    --env=*) ENVIRONMENT="${arg#*=}" ;;
    --help) echo "Usage: $0 [--env staging|production]"; exit 0 ;;
  esac
done

TEMPLATE_BUCKET="lynia-finance-${ENVIRONMENT}-templates"
STACK_NAME="${ENVIRONMENT}-lynia-api-throttling"

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  API Gateway Throttling Deployment (T0011)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Get API Gateway REST API ID from SAM stack
SAM_STACK="lynia-finance-${ENVIRONMENT/development/dev}"
[ "$ENVIRONMENT" = "staging" ] && SAM_STACK="lynia-finance-staging"
[ "$ENVIRONMENT" = "production" ] && SAM_STACK="lynia-finance-prod"

log "Resolving API Gateway ID from ${SAM_STACK}..."
API_ID=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  fail "API Gateway ID not found. Deploy Lambda functions first (T0010)."
  exit 1
fi
success "API Gateway ID: $API_ID"

# Deploy throttling stack
log "Deploying API Gateway throttling and usage plans..."
aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file infrastructure/aws/api-gateway/throttling-usage-plans.yaml \
  --parameter-overrides \
    "Environment=${ENVIRONMENT}" \
    "ApiGatewayId=${API_ID}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "API Gateway throttling stack deployed"

# Verify usage plans
log "Verifying usage plans..."
PLAN_COUNT=$(aws apigateway get-usage-plans \
  --query "length(items[?contains(name, '${ENVIRONMENT}')])" \
  --output text --region "$REGION" 2>/dev/null || echo "0")

success "Usage plans configured: $PLAN_COUNT"

# Verify API keys
KEY_COUNT=$(aws apigateway get-api-keys \
  --query "length(items[?contains(name, '${ENVIRONMENT}')])" \
  --output text --region "$REGION" 2>/dev/null || echo "0")

success "API keys created: $KEY_COUNT"

echo ""
echo "============================================"
success "T0011 complete - API Gateway throttling deployed"
echo "  Usage plans: $PLAN_COUNT"
echo "  API keys:    $KEY_COUNT"
echo "============================================"
echo ""
