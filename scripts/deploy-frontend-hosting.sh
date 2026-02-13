#!/usr/bin/env bash
# ============================================================================
# T0014 - Deploy Frontend Hosting Infrastructure
# ============================================================================
# Deploys S3 buckets + CloudFront distributions for admin portal and
# distributor dashboard. After this, run build-and-upload-frontend.sh
# to build and upload the actual assets.
#
# Usage:
#   ./scripts/deploy-frontend-hosting.sh
#   ./scripts/deploy-frontend-hosting.sh --env production
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

STACK_NAME="${ENVIRONMENT}-lynia-frontend"

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  Frontend Hosting Deployment (T0014)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Resolve DNS/SSL certificate ARN (optional, for custom domains)
DNS_STACK="${ENVIRONMENT}-lynia-dns-ssl"
FRONTEND_CERT_ARN=""
if aws cloudformation describe-stacks --stack-name "$DNS_STACK" --region "$REGION" &>/dev/null; then
  FRONTEND_CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$DNS_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendCertificateArn'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  if [ -n "$FRONTEND_CERT_ARN" ] && [ "$FRONTEND_CERT_ARN" != "None" ]; then
    success "Frontend SSL certificate: ${FRONTEND_CERT_ARN}"
  else
    warn "Frontend certificate not found in DNS stack - CloudFront will use default SSL"
    FRONTEND_CERT_ARN=""
  fi
else
  warn "DNS/SSL stack not found - deploying without custom domains"
fi

# Deploy frontend hosting stack
log "Deploying S3 + CloudFront infrastructure..."
PARAMS="Environment=${ENVIRONMENT}"
if [ -n "$FRONTEND_CERT_ARN" ]; then
  PARAMS="${PARAMS} FrontendCertificateArn=${FRONTEND_CERT_ARN}"
fi

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file infrastructure/aws/frontend-hosting.yaml \
  --parameter-overrides $PARAMS \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "Frontend hosting stack deployed"

# Print outputs
log "Frontend hosting details:"

ADMIN_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalBucketName'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "unknown")

ADMIN_CF=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "unknown")

ADMIN_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalUrl'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "unknown")

DIST_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardBucketName'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "unknown")

DIST_CF=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardDistributionId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "unknown")

DIST_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardUrl'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "unknown")

echo ""
echo "  Admin Portal:"
echo "    Bucket:       $ADMIN_BUCKET"
echo "    CloudFront:   $ADMIN_CF"
echo "    URL:          $ADMIN_URL"
echo ""
echo "  Distributor Dashboard:"
echo "    Bucket:       $DIST_BUCKET"
echo "    CloudFront:   $DIST_CF"
echo "    URL:          $DIST_URL"
echo ""

echo "============================================"
success "T0014 (infrastructure) complete"
echo "  Next: Run ./scripts/build-and-upload-frontend.sh"
echo "============================================"
echo ""
