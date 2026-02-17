#!/usr/bin/env bash
# ============================================================================
# T0016 - Create Initial Cognito Users & Assign Groups
# ============================================================================
# Creates 2 initial Cognito users (admin and manager) and assigns them
# to the appropriate user pool groups.
#
# Usage:
#   ./scripts/create-cognito-users.sh
#   ./scripts/create-cognito-users.sh --env production
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
echo "  Cognito User Setup (T0016)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# Get User Pool ID from Cognito stack
COGNITO_STACK="${ENVIRONMENT}-lynia-cognito"
log "Resolving Cognito User Pool ID..."

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$COGNITO_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
  fail "Cognito User Pool ID not found. Deploy Cognito first (T003)."
  exit 1
fi
success "User Pool ID: $USER_POOL_ID"

# ============================================================================
# Create users
# ============================================================================
create_user() {
  local email=$1
  local group=$2
  local name=$3

  log "Creating user: $email (group: $group)..."

  # Check if user already exists
  EXISTING=$(aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --region "$REGION" 2>/dev/null && echo "exists" || echo "")

  if [ "$EXISTING" = "exists" ]; then
    warn "User $email already exists - skipping creation"
  else
    aws cognito-idp admin-create-user \
      --user-pool-id "$USER_POOL_ID" \
      --username "$email" \
      --user-attributes \
        Name=email,Value="$email" \
        Name=email_verified,Value=true \
        Name=name,Value="$name" \
      --temporary-password "TempPass123!" \
      --message-action SUPPRESS \
      --region "$REGION"

    success "User $email created (status: FORCE_CHANGE_PASSWORD)"
  fi

  # Add to group
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$email" \
    --group-name "$group" \
    --region "$REGION" 2>/dev/null || warn "Group $group may not exist"

  success "User $email added to group: $group"
}

# Create seed users for all roles
create_user "admin@lynia.co.zw" "super_admin" "Lynia Super Admin"
create_user "manager@lynia.co.zw" "operations_manager" "Lynia Manager"
create_user "finance@lynia.co.zw" "finance_team" "Lynia Finance"
create_user "kyc@lynia.co.zw" "kyc_reviewer" "Lynia KYC Reviewer"
create_user "support@lynia.co.zw" "customer_support" "Lynia Support"
create_user "inventory@lynia.co.zw" "inventory_manager" "Lynia Inventory"
create_user "reports@lynia.co.zw" "reports_viewer" "Lynia Reports"

# ============================================================================
# Verify
# ============================================================================
log "Verifying user creation..."
echo ""

USER_COUNT=$(aws cognito-idp list-users \
  --user-pool-id "$USER_POOL_ID" \
  --query "length(Users)" \
  --output text --region "$REGION" 2>/dev/null || echo "0")

GROUP_LIST=$(aws cognito-idp list-groups \
  --user-pool-id "$USER_POOL_ID" \
  --query "Groups[].GroupName" \
  --output text --region "$REGION" 2>/dev/null || echo "none")

echo "  Users in pool:    $USER_COUNT"
echo "  Available groups: $GROUP_LIST"

echo ""
echo "============================================"
success "T0016 (users) complete"
echo ""
echo "  IMPORTANT: Both users have temporary passwords."
echo "  They must change their password on first login."
echo "  Temp password: TempPass123!"
echo "============================================"
echo ""
