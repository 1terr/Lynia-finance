#!/usr/bin/env bash
# ============================================================================
# T0016 - Configure GitHub Secrets for CI/CD Workflows
# ============================================================================
# Reads deployed stack outputs and configures GitHub repository secrets
# needed by the deploy.yml and deploy-frontend.yml workflows.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - All infrastructure stacks deployed (T001-T015)
#
# Usage:
#   ./scripts/configure-github-secrets.sh
#   ./scripts/configure-github-secrets.sh --env staging
#   ./scripts/configure-github-secrets.sh --dry-run
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
    --dry-run) DRY_RUN=true ;;
    --help) echo "Usage: $0 [--env staging|production] [--dry-run]"; exit 0 ;;
  esac
done

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  GitHub Secrets Configuration (T0016)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Check gh CLI
if ! command -v gh &>/dev/null; then
  fail "gh CLI not found. Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  fail "gh not authenticated. Run: gh auth login"
  exit 1
fi
success "gh CLI authenticated"

PREFIX="STAGING"
[ "$ENVIRONMENT" = "production" ] && PREFIX="PRODUCTION"

set_secret() {
  local name=$1
  local value=$2

  if [ -z "$value" ] || [ "$value" = "None" ] || [ "$value" = "null" ]; then
    warn "Skipping $name - value is empty"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would set secret: $name = ${value:0:20}..."
  else
    echo "$value" | gh secret set "$name" 2>/dev/null
    success "Set secret: $name"
  fi
}

set_var() {
  local name=$1
  local value=$2

  if [ -z "$value" ] || [ "$value" = "None" ] || [ "$value" = "null" ]; then
    warn "Skipping var $name - value is empty"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would set variable: $name = ${value:0:40}..."
  else
    gh variable set "$name" --body "$value" 2>/dev/null
    success "Set variable: $name"
  fi
}

# ============================================================================
# AWS Credentials (must be set manually by user)
# ============================================================================
log "Checking AWS credential secrets..."
warn "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set manually."
warn "Run: gh secret set AWS_ACCESS_KEY_ID / gh secret set AWS_SECRET_ACCESS_KEY"

set_secret "AWS_REGION" "$REGION"

# ============================================================================
# Cognito Configuration
# ============================================================================
log "Reading Cognito configuration..."
COGNITO_STACK="${ENVIRONMENT}-lynia-cognito"

COGNITO_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$COGNITO_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolArn'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

COGNITO_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$COGNITO_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

ADMIN_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$COGNITO_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalClientId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

DIST_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$COGNITO_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorClientId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

set_secret "COGNITO_USER_POOL_ARN" "$COGNITO_ARN"
set_var "COGNITO_USER_POOL_ID" "$COGNITO_POOL_ID"
set_var "COGNITO_ADMIN_CLIENT_ID" "$ADMIN_CLIENT_ID"
set_var "COGNITO_DISTRIBUTOR_CLIENT_ID" "$DIST_CLIENT_ID"
set_var "AWS_REGION" "$REGION"

# ============================================================================
# Frontend Hosting
# ============================================================================
log "Reading frontend hosting configuration..."
FRONTEND_STACK="${ENVIRONMENT}-lynia-frontend"

ADMIN_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalBucketName'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

ADMIN_CF_ID=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

DIST_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardBucketName'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

DIST_CF_ID=$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardDistributionId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

set_secret "ADMIN_PORTAL_BUCKET" "$ADMIN_BUCKET"
set_secret "ADMIN_CF_DISTRIBUTION" "$ADMIN_CF_ID"
set_secret "DISTRIBUTOR_BUCKET" "$DIST_BUCKET"
set_secret "DISTRIBUTOR_CF_DISTRIBUTION" "$DIST_CF_ID"

# ============================================================================
# API URL
# ============================================================================
log "Reading API URL..."
SAM_STACK="lynia-finance-${ENVIRONMENT/development/dev}"
[ "$ENVIRONMENT" = "staging" ] && SAM_STACK="lynia-finance-staging"
[ "$ENVIRONMENT" = "production" ] && SAM_STACK="lynia-finance-prod"

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$SAM_STACK" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text --region "$REGION" 2>/dev/null || echo "")

set_var "API_URL" "$API_URL"

echo ""
echo "============================================"
success "T0016 (GitHub secrets) complete"
echo ""
echo "  MANUAL STEPS REQUIRED:"
echo "  1. Set AWS_ACCESS_KEY_ID:     gh secret set AWS_ACCESS_KEY_ID"
echo "  2. Set AWS_SECRET_ACCESS_KEY: gh secret set AWS_SECRET_ACCESS_KEY"
echo "  3. Set external service API keys (WhatsApp, DIDIT, etc.)"
echo "============================================"
echo ""
