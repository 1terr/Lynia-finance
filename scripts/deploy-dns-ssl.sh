#!/usr/bin/env bash
# ============================================================================
# T0013 - Deploy DNS, SSL & Custom Domains
# ============================================================================
# Deploys Route 53 hosted zone, ACM certificates, custom domain mappings
# for API Gateway, and health checks.
#
# Usage:
#   ./scripts/deploy-dns-ssl.sh
#   ./scripts/deploy-dns-ssl.sh --env production
#
# Note: ACM certificate validation may require 10-30 minutes.
#       New hosted zone NS propagation can take up to 48 hours.
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

STACK_NAME="${ENVIRONMENT}-lynia-dns-ssl"

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  DNS & SSL Deployment (T0013)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Get API Gateway ID
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

# Deploy DNS & SSL stack
log "Deploying Route 53 hosted zone and ACM certificates..."
warn "ACM certificate validation may require 10-30 minutes"
echo ""

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file infrastructure/aws/dns-ssl.yaml \
  --parameter-overrides \
    "Environment=${ENVIRONMENT}" \
    "ApiGatewayId=${API_ID}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "DNS & SSL stack deployed"

# Verify certificates
log "Checking ACM certificate status..."
CERTS=$(aws acm list-certificates \
  --query "CertificateSummaryList[?contains(DomainName, 'lyniafinance.com')].[DomainName,Status]" \
  --output text --region "$REGION" 2>/dev/null || echo "none")

if [ "$CERTS" != "none" ] && [ -n "$CERTS" ]; then
  echo "$CERTS" | while read -r domain status; do
    if [ "$status" = "ISSUED" ]; then
      success "Certificate: $domain - ISSUED"
    elif [ "$status" = "PENDING_VALIDATION" ]; then
      warn "Certificate: $domain - PENDING_VALIDATION (check DNS records)"
    else
      warn "Certificate: $domain - $status"
    fi
  done
else
  warn "No ACM certificates found for lyniafinance.com"
fi

# Check hosted zone
log "Checking Route 53 hosted zone..."
ZONE_COUNT=$(aws route53 list-hosted-zones-by-name \
  --dns-name "lyniafinance.com" \
  --query "length(HostedZones[?Name=='lyniafinance.com.'])" \
  --output text 2>/dev/null || echo "0")

if [ "$ZONE_COUNT" -gt 0 ]; then
  success "Route 53 hosted zone: lyniafinance.com"
else
  warn "Hosted zone for lyniafinance.com not found"
fi

echo ""
echo "============================================"
success "T0013 complete - DNS & SSL deployed"
echo ""
echo "  IMPORTANT: If certificates are PENDING_VALIDATION,"
echo "  add the CNAME records from ACM to your DNS registrar."
echo "  NS propagation for new hosted zones can take up to 48h."
echo "============================================"
echo ""
