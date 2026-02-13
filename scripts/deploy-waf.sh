#!/usr/bin/env bash
# ============================================================================
# T0012 - Deploy WAF Web ACL
# ============================================================================
# Deploys AWS WAF with rate limiting, SQL injection protection, XSS
# prevention, and geo-restriction rules.
#
# Usage:
#   ./scripts/deploy-waf.sh
#   ./scripts/deploy-waf.sh --env production
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

STACK_NAME="${ENVIRONMENT}-lynia-waf"

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  WAF Deployment (T0012)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Get API Gateway ARN for WAF association
SAM_STACK="lynia-finance-${ENVIRONMENT/development/dev}"
[ "$ENVIRONMENT" = "staging" ] && SAM_STACK="lynia-finance-staging"
[ "$ENVIRONMENT" = "production" ] && SAM_STACK="lynia-finance-prod"

log "Resolving API Gateway ID..."
API_ID=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  fail "API Gateway ID not found. Deploy Lambda functions first (T0010)."
  exit 1
fi
success "API Gateway ID: $API_ID"

API_STAGE_ARN="arn:aws:apigateway:${REGION}::/restapis/${API_ID}/stages/Prod"

# Deploy WAF stack
log "Deploying WAF Web ACL..."
aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file infrastructure/aws/waf.yaml \
  --parameter-overrides \
    "Environment=${ENVIRONMENT}" \
    "ApiGatewayStageArn=${API_STAGE_ARN}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "WAF stack deployed"

# Verify WAF rules
log "Verifying WAF configuration..."
WAF_COUNT=$(aws wafv2 list-web-acls \
  --scope REGIONAL \
  --query "length(WebACLs[?contains(Name, '${ENVIRONMENT}-lynia')])" \
  --output text --region "$REGION" 2>/dev/null || echo "0")

if [ "$WAF_COUNT" -gt 0 ]; then
  success "WAF Web ACL active with rules"
else
  fail "WAF Web ACL not found after deployment"
fi

echo ""
echo "============================================"
success "T0012 (WAF) complete"
echo "============================================"
echo ""
