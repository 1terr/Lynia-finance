#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - Deploy Cognito User Pool Stack (P5-DEPLOY-T003)
# ============================================================================
# Deploys the Amazon Cognito User Pool with:
#   - Email-based authentication
#   - MFA optional (TOTP)
#   - Advanced security enforced
#   - Strong password policy (12+ chars)
#   - 2 app clients (admin-portal, distributor-dashboard)
#   - 5 user groups (admin, manager, support, reports_viewer, distributor)
#
# Usage:
#   ./scripts/deploy-cognito.sh                     # Deploy to production
#   ./scripts/deploy-cognito.sh --env staging        # Deploy to staging
#   ./scripts/deploy-cognito.sh --verify-only        # Verify existing stack
#   ./scripts/deploy-cognito.sh --dry-run            # Validate without deploying
#
# Prerequisites:
#   - AWS CLI v2 configured with valid credentials
#   - Region set to us-east-1 (or override with AWS_DEFAULT_REGION)
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration defaults
ENVIRONMENT="production"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
TEMPLATE_FILE="infrastructure/aws/cognito.yaml"
VERIFY_ONLY=false
DRY_RUN=false

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --env=*) ENVIRONMENT="${arg#*=}" ;;
    --env)
      shift
      ENVIRONMENT="${1:-production}"
      ;;
    --verify-only) VERIFY_ONLY=true ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [--env <environment>] [--verify-only] [--dry-run]"
      echo ""
      echo "Options:"
      echo "  --env <env>     Environment: dev, staging, production (default: production)"
      echo "  --verify-only   Skip deployment, only verify existing stack"
      echo "  --dry-run       Validate template without deploying"
      echo "  --help          Show this help message"
      exit 0
      ;;
  esac
done

STACK_NAME="${ENVIRONMENT}-lynia-cognito"

# Helper functions
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# Track results
PASS=0
FAIL=0
WARN=0

check_pass() { ((PASS++)); log_ok "$1"; }
check_fail() { ((FAIL++)); log_error "$1"; }
check_warn() { ((WARN++)); log_warn "$1"; }

# ============================================================================
# Pre-flight checks
# ============================================================================
log_step "Step 0: Pre-flight Checks"

# Check AWS CLI
if ! command -v aws &>/dev/null; then
  log_error "AWS CLI not found. Install it: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
  exit 1
fi
log_ok "AWS CLI found: $(aws --version 2>&1 | head -1)"

# Check AWS credentials
if ! aws sts get-caller-identity &>/dev/null; then
  log_error "AWS credentials not configured or invalid."
  log_info "Configure with: aws configure"
  log_info "Or set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION"
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
log_ok "AWS Account: $ACCOUNT_ID (Region: $REGION)"

# Check template exists
TEMPLATE_PATH="$PROJECT_ROOT/$TEMPLATE_FILE"
if [ ! -f "$TEMPLATE_PATH" ]; then
  log_error "Template not found: $TEMPLATE_PATH"
  exit 1
fi
log_ok "Template found: $TEMPLATE_FILE"

# ============================================================================
# Step 1: Validate Template
# ============================================================================
log_step "Step 1: Validate CloudFormation Template"

VALIDATION=$(aws cloudformation validate-template \
  --template-body "file://$TEMPLATE_PATH" \
  --region "$REGION" 2>&1) && {
  check_pass "Template validation passed"
} || {
  check_fail "Template validation failed: $VALIDATION"
  exit 1
}

# Show template summary
PARAM_COUNT=$(echo "$VALIDATION" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('Parameters',[])))" 2>/dev/null || echo "?")
log_info "Template parameters: $PARAM_COUNT"

if $DRY_RUN; then
  log_info "Dry run mode — skipping deployment."
  echo ""
  echo -e "${GREEN}━━━ Dry Run Complete ━━━${NC}"
  echo "Template is valid. Run without --dry-run to deploy."
  exit 0
fi

# ============================================================================
# Step 2: Deploy or Skip to Verify
# ============================================================================
if ! $VERIFY_ONLY; then
  log_step "Step 2: Deploy Cognito Stack"

  log_info "Deploying stack: $STACK_NAME"
  log_info "Template: $TEMPLATE_FILE"
  log_info "Environment: $ENVIRONMENT"
  log_info "Region: $REGION"

  aws cloudformation deploy \
    --template-file "$TEMPLATE_PATH" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides "Environment=$ENVIRONMENT" \
    --region "$REGION" \
    --no-fail-on-empty-changeset \
    --tags \
      "Project=lynia-finance" \
      "Environment=$ENVIRONMENT" \
      "Service=cognito" \
      "ManagedBy=cloudformation" && {
    check_pass "Stack deployment completed"
  } || {
    check_fail "Stack deployment failed"
    log_info "Check events: aws cloudformation describe-stack-events --stack-name $STACK_NAME"
    exit 1
  }
else
  log_step "Step 2: Skipped (--verify-only mode)"
fi

# ============================================================================
# Step 3: Record Stack Outputs
# ============================================================================
log_step "Step 3: Record Stack Outputs"

# Check stack exists
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text \
  --region "$REGION" 2>/dev/null) || {
  check_fail "Stack $STACK_NAME not found"
  exit 1
}

log_info "Stack status: $STACK_STATUS"

if [[ "$STACK_STATUS" == *"COMPLETE"* ]] && [[ "$STACK_STATUS" != *"DELETE"* ]]; then
  check_pass "Stack status: $STACK_STATUS"
else
  check_fail "Unexpected stack status: $STACK_STATUS"
fi

# Extract outputs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text --region "$REGION")
USER_POOL_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolArn'].OutputValue" --output text --region "$REGION")
ADMIN_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminClientId'].OutputValue" --output text --region "$REGION")
DISTRIBUTOR_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorClientId'].OutputValue" --output text --region "$REGION")

echo ""
echo -e "${CYAN}Stack Outputs:${NC}"
echo "  USER_POOL_ID=$USER_POOL_ID"
echo "  USER_POOL_ARN=$USER_POOL_ARN"
echo "  ADMIN_CLIENT_ID=$ADMIN_CLIENT_ID"
echo "  DISTRIBUTOR_CLIENT_ID=$DISTRIBUTOR_CLIENT_ID"

if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "None" ]; then
  check_pass "Stack outputs retrieved successfully"
else
  check_fail "Failed to retrieve stack outputs"
  exit 1
fi

# ============================================================================
# Step 4: Verify User Pool Configuration
# ============================================================================
log_step "Step 4: Verify User Pool Configuration"

# 4a. User Pool status and MFA
POOL_INFO=$(aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" \
  --query "UserPool.{Status:Status,MfaConfiguration:MfaConfiguration}" \
  --output json --region "$REGION")

POOL_STATUS=$(echo "$POOL_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['Status'])")
MFA_CONFIG=$(echo "$POOL_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['MfaConfiguration'])")

if [ "$POOL_STATUS" = "Enabled" ]; then
  check_pass "User Pool status: Enabled"
else
  check_fail "User Pool status: $POOL_STATUS (expected: Enabled)"
fi

if [ "$MFA_CONFIG" = "OPTIONAL" ]; then
  check_pass "MFA configuration: OPTIONAL"
else
  check_fail "MFA configuration: $MFA_CONFIG (expected: OPTIONAL)"
fi

# 4b. Password policy
PASSWORD_POLICY=$(aws cognito-idp describe-user-pool --user-pool-id "$USER_POOL_ID" \
  --query "UserPool.Policies.PasswordPolicy" --output json --region "$REGION")

MIN_LENGTH=$(echo "$PASSWORD_POLICY" | python3 -c "import sys,json; print(json.load(sys.stdin)['MinimumLength'])")
REQ_UPPER=$(echo "$PASSWORD_POLICY" | python3 -c "import sys,json; print(json.load(sys.stdin)['RequireUppercase'])")
REQ_LOWER=$(echo "$PASSWORD_POLICY" | python3 -c "import sys,json; print(json.load(sys.stdin)['RequireLowercase'])")
REQ_NUMBERS=$(echo "$PASSWORD_POLICY" | python3 -c "import sys,json; print(json.load(sys.stdin)['RequireNumbers'])")
REQ_SYMBOLS=$(echo "$PASSWORD_POLICY" | python3 -c "import sys,json; print(json.load(sys.stdin)['RequireSymbols'])")

if [ "$MIN_LENGTH" -ge 12 ]; then
  check_pass "Password minimum length: $MIN_LENGTH (>= 12)"
else
  check_fail "Password minimum length: $MIN_LENGTH (expected >= 12)"
fi

if [ "$REQ_UPPER" = "True" ] && [ "$REQ_LOWER" = "True" ] && [ "$REQ_NUMBERS" = "True" ] && [ "$REQ_SYMBOLS" = "True" ]; then
  check_pass "Password complexity: uppercase, lowercase, numbers, symbols all required"
else
  check_fail "Password complexity requirements not fully met"
fi

# ============================================================================
# Step 5: Verify User Groups
# ============================================================================
log_step "Step 5: Verify User Groups"

GROUPS=$(aws cognito-idp list-groups --user-pool-id "$USER_POOL_ID" \
  --query "Groups[].GroupName" --output text --region "$REGION")

EXPECTED_GROUPS=("admin" "manager" "support" "reports_viewer" "distributor")
GROUP_COUNT=0

for group in "${EXPECTED_GROUPS[@]}"; do
  if echo "$GROUPS" | grep -qw "$group"; then
    check_pass "Group exists: $group"
    ((GROUP_COUNT++))
  else
    check_fail "Group missing: $group"
  fi
done

if [ "$GROUP_COUNT" -eq 5 ]; then
  check_pass "All 5 user groups present"
else
  check_fail "Only $GROUP_COUNT/5 groups found"
fi

# ============================================================================
# Step 6: Verify App Clients
# ============================================================================
log_step "Step 6: Verify App Clients"

# Admin portal client
ADMIN_CLIENT=$(aws cognito-idp describe-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$ADMIN_CLIENT_ID" \
  --query "UserPoolClient.{Name:ClientName,AccessTokenValidity:AccessTokenValidity,RefreshTokenValidity:RefreshTokenValidity,ExplicitAuthFlows:ExplicitAuthFlows}" \
  --output json --region "$REGION")

ADMIN_ACCESS=$(echo "$ADMIN_CLIENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['AccessTokenValidity'])")
ADMIN_REFRESH=$(echo "$ADMIN_CLIENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['RefreshTokenValidity'])")

if [ "$ADMIN_ACCESS" = "1" ]; then
  check_pass "Admin client access token: 1 hour"
else
  check_fail "Admin client access token: $ADMIN_ACCESS (expected: 1)"
fi

if [ "$ADMIN_REFRESH" = "30" ]; then
  check_pass "Admin client refresh token: 30 days"
else
  check_fail "Admin client refresh token: $ADMIN_REFRESH (expected: 30)"
fi

# Check auth flows for admin client
ADMIN_AUTH_FLOWS=$(echo "$ADMIN_CLIENT" | python3 -c "import sys,json; print(' '.join(json.load(sys.stdin)['ExplicitAuthFlows']))")
if echo "$ADMIN_AUTH_FLOWS" | grep -q "ALLOW_USER_PASSWORD_AUTH" && echo "$ADMIN_AUTH_FLOWS" | grep -q "ALLOW_USER_SRP_AUTH"; then
  check_pass "Admin client auth flows: USER_PASSWORD_AUTH, USER_SRP_AUTH"
else
  check_fail "Admin client auth flows incomplete: $ADMIN_AUTH_FLOWS"
fi

# Distributor dashboard client
DIST_CLIENT=$(aws cognito-idp describe-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$DISTRIBUTOR_CLIENT_ID" \
  --query "UserPoolClient.{Name:ClientName,AccessTokenValidity:AccessTokenValidity,RefreshTokenValidity:RefreshTokenValidity,ExplicitAuthFlows:ExplicitAuthFlows}" \
  --output json --region "$REGION")

DIST_ACCESS=$(echo "$DIST_CLIENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['AccessTokenValidity'])")
DIST_REFRESH=$(echo "$DIST_CLIENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['RefreshTokenValidity'])")

if [ "$DIST_ACCESS" = "1" ]; then
  check_pass "Distributor client access token: 1 hour"
else
  check_fail "Distributor client access token: $DIST_ACCESS (expected: 1)"
fi

if [ "$DIST_REFRESH" = "7" ]; then
  check_pass "Distributor client refresh token: 7 days"
else
  check_fail "Distributor client refresh token: $DIST_REFRESH (expected: 7)"
fi

# Check auth flows for distributor client
DIST_AUTH_FLOWS=$(echo "$DIST_CLIENT" | python3 -c "import sys,json; print(' '.join(json.load(sys.stdin)['ExplicitAuthFlows']))")
if echo "$DIST_AUTH_FLOWS" | grep -q "ALLOW_USER_PASSWORD_AUTH" && echo "$DIST_AUTH_FLOWS" | grep -q "ALLOW_USER_SRP_AUTH"; then
  check_pass "Distributor client auth flows: USER_PASSWORD_AUTH, USER_SRP_AUTH"
else
  check_fail "Distributor client auth flows incomplete: $DIST_AUTH_FLOWS"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  P5-DEPLOY-T003 Verification Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}Passed:${NC}   $PASS"
echo -e "  ${RED}Failed:${NC}   $FAIL"
echo -e "  ${YELLOW}Warnings:${NC} $WARN"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC}"
  echo ""
  echo "Stack Outputs (save these for dependent stacks):"
  echo "  USER_POOL_ID=$USER_POOL_ID"
  echo "  USER_POOL_ARN=$USER_POOL_ARN"
  echo "  ADMIN_CLIENT_ID=$ADMIN_CLIENT_ID"
  echo "  DISTRIBUTOR_CLIENT_ID=$DISTRIBUTOR_CLIENT_ID"
  exit 0
else
  echo -e "  ${RED}SOME CHECKS FAILED${NC}"
  exit 1
fi
