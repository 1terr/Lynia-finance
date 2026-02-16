#!/usr/bin/env bash
# ============================================================================
# T0014 - Build Frontend Apps & Upload to S3
# ============================================================================
# Builds both Next.js frontend applications with Cognito configuration,
# uploads assets to S3, and invalidates CloudFront caches.
#
# Usage:
#   ./scripts/build-and-upload-frontend.sh
#   ./scripts/build-and-upload-frontend.sh --env production
#   ./scripts/build-and-upload-frontend.sh --app admin-portal
#   ./scripts/build-and-upload-frontend.sh --app distributor-dashboard
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="staging"
REGION="us-east-1"
APP="both"

for arg in "$@"; do
  case $arg in
    --env=*) ENVIRONMENT="${arg#*=}" ;;
    --app=*) APP="${arg#*=}" ;;
    --help)
      echo "Usage: $0 [--env staging|production] [--app admin-portal|distributor-dashboard|both]"
      exit 0
      ;;
  esac
done

FRONTEND_STACK="${ENVIRONMENT}-lynia-frontend"

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  Frontend Build & Upload (T0014)"
echo "  Environment: ${ENVIRONMENT}"
echo "  Application: ${APP}"
echo "============================================"
echo ""

# ============================================================================
# Step 1: Resolve Cognito configuration
# ============================================================================
log "Resolving Cognito configuration..."

COGNITO_STACK="${ENVIRONMENT}-lynia-cognito"
COGNITO_POOL_ID=""
ADMIN_CLIENT_ID=""
DIST_CLIENT_ID=""

if aws cloudformation describe-stacks --stack-name "$COGNITO_STACK" --region "$REGION" &>/dev/null; then
  COGNITO_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  ADMIN_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='AdminClientId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  DIST_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$COGNITO_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributorClientId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")
  success "Cognito Pool ID: $COGNITO_POOL_ID"
else
  warn "Cognito stack not found - using empty Cognito config"
fi

# Resolve API URL
SAM_STACK="lynia-finance-${ENVIRONMENT/development/dev}"
[ "$ENVIRONMENT" = "staging" ] && SAM_STACK="lynia-finance-staging"
[ "$ENVIRONMENT" = "production" ] && SAM_STACK="lynia-finance-prod"

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "")

log "API URL: ${API_URL:-not found}"

# ============================================================================
# Step 2: Build frontend applications
# ============================================================================
log "Installing dependencies..."
pnpm install --frozen-lockfile

build_admin() {
  log "Building admin portal..."
  NEXT_PUBLIC_API_URL="$API_URL" \
  NEXT_PUBLIC_COGNITO_USER_POOL_ID="$COGNITO_POOL_ID" \
  NEXT_PUBLIC_COGNITO_CLIENT_ID="$ADMIN_CLIENT_ID" \
  NEXT_PUBLIC_COGNITO_REGION="$REGION" \
  NEXT_PUBLIC_ENVIRONMENT="$ENVIRONMENT" \
    pnpm --filter "@lynia/admin-portal" build
  success "Admin portal built"
}

build_distributor() {
  log "Building distributor dashboard..."
  NEXT_PUBLIC_API_URL="$API_URL" \
  NEXT_PUBLIC_COGNITO_USER_POOL_ID="$COGNITO_POOL_ID" \
  NEXT_PUBLIC_COGNITO_CLIENT_ID="$DIST_CLIENT_ID" \
  NEXT_PUBLIC_COGNITO_REGION="$REGION" \
  NEXT_PUBLIC_ENVIRONMENT="$ENVIRONMENT" \
    pnpm --filter lynia-distributor-portal build
  success "Distributor dashboard built"
}

if [ "$APP" = "admin-portal" ] || [ "$APP" = "both" ]; then
  build_admin
fi
if [ "$APP" = "distributor-dashboard" ] || [ "$APP" = "both" ]; then
  build_distributor
fi

# ============================================================================
# Step 3: Upload to S3
# ============================================================================
upload_to_s3() {
  local bucket=$1
  local source_dir=$2
  local app_name=$3

  log "Uploading ${app_name} to s3://${bucket}/..."

  # Static assets with long cache
  aws s3 sync "$source_dir" "s3://${bucket}/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "sw.js" \
    --exclude "manifest.json" \
    --exclude "config.js" \
    --region "$REGION"

  # HTML and dynamic files with no cache
  aws s3 sync "$source_dir" "s3://${bucket}/" \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "sw.js" \
    --include "manifest.json" \
    --include "config.js" \
    --region "$REGION"

  success "${app_name} uploaded to S3"
}

# Get bucket names from stack
ADMIN_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalBucketName'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "${ENVIRONMENT}-lynia-admin-portal")

DIST_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardBucketName'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "${ENVIRONMENT}-lynia-distributor-dashboard")

if [ "$APP" = "admin-portal" ] || [ "$APP" = "both" ]; then
  upload_to_s3 "$ADMIN_BUCKET" "frontend/admin-portal/out/" "Admin Portal"
fi
if [ "$APP" = "distributor-dashboard" ] || [ "$APP" = "both" ]; then
  upload_to_s3 "$DIST_BUCKET" "frontend/distributor-dashboard/out/" "Distributor Dashboard"
fi

# ============================================================================
# Step 4: Invalidate CloudFront caches
# ============================================================================
invalidate_cf() {
  local dist_id=$1
  local app_name=$2

  if [ -n "$dist_id" ] && [ "$dist_id" != "None" ]; then
    log "Invalidating CloudFront cache for ${app_name}..."
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
      --distribution-id "$dist_id" \
      --paths "/*" \
      --query 'Invalidation.Id' \
      --output text 2>/dev/null || echo "")
    success "${app_name} CloudFront invalidation: ${INVALIDATION_ID}"
  else
    warn "CloudFront distribution not found for ${app_name}"
  fi
}

ADMIN_CF=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

DIST_CF=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardDistributionId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [ "$APP" = "admin-portal" ] || [ "$APP" = "both" ]; then
  invalidate_cf "$ADMIN_CF" "Admin Portal"
fi
if [ "$APP" = "distributor-dashboard" ] || [ "$APP" = "both" ]; then
  invalidate_cf "$DIST_CF" "Distributor Dashboard"
fi

# ============================================================================
# Step 5: Health check
# ============================================================================
log "Running frontend health checks..."

ADMIN_URL=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalUrl'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

DIST_URL=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardUrl'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

for url in "$ADMIN_URL" "$DIST_URL"; do
  if [ -n "$url" ] && [ "$url" != "None" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" =~ ^(200|301|302)$ ]]; then
      success "$url - HTTP $HTTP_CODE"
    else
      warn "$url - HTTP $HTTP_CODE"
    fi
  fi
done

echo ""
echo "============================================"
success "T0014 complete - Frontend built and uploaded"
echo "============================================"
echo ""
