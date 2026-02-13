#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T007: Deploy Secrets Manager Stack
# ============================================================================
# Deploys 7 Secrets Manager secrets and 6 IAM managed policies for
# per-service least-privilege access:
#
# Secrets:
#   1. database          — RDS PostgreSQL connection (host, port, db, user, pass)
#   2. whatsapp          — WhatsApp Cloud API credentials
#   3. smile-identity    — Smile Identity KYC credentials
#   4. ecocash           — EcoCash mobile money credentials
#   5. onemoney          — OneMoney mobile money credentials
#   6. trustonic         — Trustonic device lock credentials
#   7. sms               — SMS provider credentials
#
# IAM Policies:
#   SharedSecretsPolicy, WhatsAppSecretsPolicy, KYCSecretsPolicy,
#   PaymentSecretsPolicy, LockSecretsPolicy, NotificationSecretsPolicy
#
# Usage:
#   ./scripts/deploy-secrets-manager.sh                          # Production deploy
#   ./scripts/deploy-secrets-manager.sh --env staging            # Staging deploy
#   ./scripts/deploy-secrets-manager.sh --dry-run                # Validate without deploying
#   ./scripts/deploy-secrets-manager.sh --verify-only            # Verify existing stack
#   ./scripts/deploy-secrets-manager.sh --outputs                # Show stack outputs only
#
# Required environment variable:
#   DB_PASSWORD   — RDS master password (from T004 deployment)
#
# Exit codes:
#   0 - Deployment and verification successful
#   1 - Pre-flight check failed (credentials, template missing)
#   2 - Stack deployment failed
#   3 - Stack verification failed (resources not in expected state)
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
ENVIRONMENT="production"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
DRY_RUN=false
VERIFY_ONLY=false
OUTPUTS_ONLY=false

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Project root (script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Template path
SECRETS_TEMPLATE="$PROJECT_ROOT/infrastructure/aws/secrets-manager.yaml"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env=*) ENVIRONMENT="${1#*=}"; shift ;;
    --env) ENVIRONMENT="${2:-production}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --verify-only) VERIFY_ONLY=true; shift ;;
    --outputs) OUTPUTS_ONLY=true; shift ;;
    --region=*) REGION="${1#*=}"; shift ;;
    --region) REGION="${2:-us-east-1}"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --env ENV         Target environment: production|staging|development (default: production)"
      echo "  --region REGION   AWS region (default: us-east-1)"
      echo "  --dry-run         Validate template without deploying"
      echo "  --verify-only     Only verify existing stack resources"
      echo "  --outputs         Show stack outputs only"
      echo "  --help            Show this help message"
      echo ""
      echo "Required environment variables for deployment:"
      echo "  DB_PASSWORD                  RDS master password (from T004)"
      echo ""
      echo "Optional environment variables (sandbox placeholders used if not set):"
      echo "  WHATSAPP_PHONE_NUMBER_ID     WhatsApp Business phone number ID"
      echo "  WHATSAPP_ACCESS_TOKEN        WhatsApp Cloud API access token"
      echo "  WHATSAPP_WEBHOOK_TOKEN       WhatsApp webhook verification token"
      echo "  SMILE_PARTNER_ID             Smile Identity partner ID"
      echo "  SMILE_API_KEY                Smile Identity API key"
      echo "  ECOCASH_MERCHANT_ID          EcoCash merchant ID"
      echo "  ECOCASH_API_KEY              EcoCash API key"
      echo "  ONEMONEY_MERCHANT_ID         OneMoney merchant ID"
      echo "  ONEMONEY_API_KEY             OneMoney API key"
      echo "  TRUSTONIC_API_KEY            Trustonic API key"
      echo "  TRUSTONIC_API_SECRET         Trustonic API secret"
      echo "  SMS_API_KEY                  SMS provider API key"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Derived names
STACK_NAME="${ENVIRONMENT}-lynia-secrets"
RDS_STACK_NAME="${ENVIRONMENT}-lynia-rds"

# Secret names
SECRET_NAMES=(
  "${ENVIRONMENT}/lynia/database"
  "${ENVIRONMENT}/lynia/whatsapp"
  "${ENVIRONMENT}/lynia/smile-identity"
  "${ENVIRONMENT}/lynia/ecocash"
  "${ENVIRONMENT}/lynia/onemoney"
  "${ENVIRONMENT}/lynia/trustonic"
  "${ENVIRONMENT}/lynia/sms"
)

# --------------------------------------------------------------------------
# Helper functions
# --------------------------------------------------------------------------
pass()    { echo -e "  ${GREEN}[PASS]${NC} $1"; CHECKS_PASSED=$((CHECKS_PASSED + 1)); }
fail()    { echo -e "  ${RED}[FAIL]${NC} $1"; CHECKS_FAILED=$((CHECKS_FAILED + 1)); }
warn()    { echo -e "  ${YELLOW}[WARN]${NC} $1"; CHECKS_WARNED=$((CHECKS_WARNED + 1)); }
info()    { echo -e "  ${BLUE}[INFO]${NC} $1"; }
step()    { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# --------------------------------------------------------------------------
# Step 0: Banner
# --------------------------------------------------------------------------
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Lynia Finance — P5-DEPLOY-T007: Deploy Secrets Manager Stack  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Environment:  ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Region:       ${YELLOW}${REGION}${NC}"
echo -e "  Stack Name:   ${YELLOW}${STACK_NAME}${NC}"
echo -e "  Template:     ${YELLOW}infrastructure/aws/secrets-manager.yaml${NC}"
echo -e "  Dry Run:      ${YELLOW}${DRY_RUN}${NC}"
echo -e "  Timestamp:    $(timestamp)"
echo ""

# --------------------------------------------------------------------------
# Step 1: Pre-flight Checks
# --------------------------------------------------------------------------
step "Step 1: Pre-flight Checks"

# Check AWS CLI
if command -v aws &>/dev/null; then
  AWS_VERSION=$(aws --version 2>&1 | head -1)
  pass "AWS CLI installed: $AWS_VERSION"
else
  fail "AWS CLI not installed"
  exit 1
fi

# Check AWS credentials
if aws sts get-caller-identity --region "$REGION" &>/dev/null; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
  CALLER_ARN=$(aws sts get-caller-identity --query Arn --output text --region "$REGION")
  pass "AWS credentials valid (Account: $ACCOUNT_ID)"
  info "Caller: $CALLER_ARN"
else
  fail "AWS credentials not configured or expired"
  exit 1
fi

# Check template exists
if [[ -f "$SECRETS_TEMPLATE" ]]; then
  TEMPLATE_SIZE=$(wc -c < "$SECRETS_TEMPLATE" | tr -d ' ')
  pass "Secrets Manager template found ($TEMPLATE_SIZE bytes)"
else
  fail "Secrets Manager template not found at: $SECRETS_TEMPLATE"
  exit 1
fi

# Validate template with CloudFormation API
info "Validating template with CloudFormation API..."
if aws cloudformation validate-template \
    --template-body "file://$SECRETS_TEMPLATE" \
    --region "$REGION" &>/dev/null; then
  pass "Template passes CloudFormation validation"
else
  fail "Template failed CloudFormation validation"
  aws cloudformation validate-template \
    --template-body "file://$SECRETS_TEMPLATE" \
    --region "$REGION" 2>&1 || true
  exit 1
fi

# Check T004 dependency: verify RDS stack exists and extract endpoint
info "Checking T004 dependency (RDS stack)..."
RDS_STATUS=$(aws cloudformation describe-stacks --stack-name "$RDS_STACK_NAME" \
  --query "Stacks[0].StackStatus" --output text --region "$REGION" 2>/dev/null || echo "DOES_NOT_EXIST")

if [[ "$RDS_STATUS" == "CREATE_COMPLETE" || "$RDS_STATUS" == "UPDATE_COMPLETE" ]]; then
  DB_HOST=$(aws cloudformation describe-stacks --stack-name "$RDS_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text --region "$REGION")
  pass "T004 dependency met: RDS stack found ($RDS_STATUS)"
  info "DB Host: $DB_HOST"
else
  warn "RDS stack $RDS_STACK_NAME not found (status: $RDS_STATUS)"
  DB_HOST="${DB_HOST:-rds-endpoint-pending.us-east-1.rds.amazonaws.com}"
  info "Using placeholder DB host: $DB_HOST"
fi

# Check DB_PASSWORD
if [[ -n "${DB_PASSWORD:-}" ]]; then
  pass "DB_PASSWORD environment variable set"
else
  if [[ "$VERIFY_ONLY" == true || "$DRY_RUN" == true ]]; then
    warn "DB_PASSWORD not set (OK for verify/dry-run mode)"
    DB_PASSWORD="placeholder-password-for-validation"
  else
    fail "DB_PASSWORD environment variable is required for deployment"
    echo -e "  ${YELLOW}Set it with: export DB_PASSWORD=<your-rds-master-password>${NC}"
    exit 1
  fi
fi

# If outputs-only mode, skip to outputs
if [[ "$OUTPUTS_ONLY" == true ]]; then
  step "Stack Outputs"
  if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].Outputs" \
      --output table \
      --region "$REGION"
  else
    fail "Stack $STACK_NAME does not exist"
    exit 3
  fi
  exit 0
fi

# If verify-only mode, skip deployment
if [[ "$VERIFY_ONLY" == true ]]; then
  info "Verify-only mode — skipping deployment"
fi

# --------------------------------------------------------------------------
# Step 2: Deploy Secrets Manager Stack
# --------------------------------------------------------------------------
if [[ "$VERIFY_ONLY" != true ]]; then
  step "Step 2: Deploy Secrets Manager Stack"

  # Check if stack already exists
  STACK_STATUS=""
  if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    STACK_STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].StackStatus" \
      --output text \
      --region "$REGION")
    info "Existing stack found with status: $STACK_STATUS"

    case "$STACK_STATUS" in
      CREATE_COMPLETE|UPDATE_COMPLETE|UPDATE_ROLLBACK_COMPLETE)
        info "Stack is in a deployable state — will update"
        ;;
      CREATE_IN_PROGRESS|UPDATE_IN_PROGRESS)
        warn "Stack operation already in progress — waiting for completion"
        ;;
      CREATE_FAILED|ROLLBACK_COMPLETE|DELETE_FAILED)
        warn "Stack is in a failed state ($STACK_STATUS)"
        info "You may need to delete the stack first: aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
        exit 2
        ;;
      *)
        warn "Unexpected stack status: $STACK_STATUS"
        ;;
    esac
  fi

  if [[ "$DRY_RUN" == true ]]; then
    info "DRY RUN: Would deploy stack $STACK_NAME"
    info "DRY RUN: Parameters: Environment=$ENVIRONMENT, DBHost=$DB_HOST"
    info "DRY RUN complete — no resources were created"
  else
    info "Deploying Secrets Manager stack..."
    info "This typically takes 1-3 minutes"
    echo ""

    DEPLOY_START=$(date +%s)

    aws cloudformation deploy \
      --template-file "$SECRETS_TEMPLATE" \
      --stack-name "$STACK_NAME" \
      --parameter-overrides \
        "Environment=$ENVIRONMENT" \
        "DBHost=$DB_HOST" \
        "DBPort=5432" \
        "DBName=lynia" \
        "DBUsername=lynia_admin" \
        "DBPassword=$DB_PASSWORD" \
        "WhatsAppPhoneNumberId=${WHATSAPP_PHONE_NUMBER_ID:-}" \
        "WhatsAppAccessToken=${WHATSAPP_ACCESS_TOKEN:-}" \
        "WhatsAppWebhookVerifyToken=${WHATSAPP_WEBHOOK_TOKEN:-}" \
        "SmilePartnerId=${SMILE_PARTNER_ID:-}" \
        "SmileApiKey=${SMILE_API_KEY:-}" \
        "EcocashMerchantId=${ECOCASH_MERCHANT_ID:-}" \
        "EcocashApiKey=${ECOCASH_API_KEY:-}" \
        "OnemoneyMerchantId=${ONEMONEY_MERCHANT_ID:-}" \
        "OnemoneyApiKey=${ONEMONEY_API_KEY:-}" \
        "TrustonicApiKey=${TRUSTONIC_API_KEY:-}" \
        "TrustonicApiSecret=${TRUSTONIC_API_SECRET:-}" \
        "SmsApiKey=${SMS_API_KEY:-}" \
      --capabilities CAPABILITY_NAMED_IAM \
      --region "$REGION" \
      --no-fail-on-empty-changeset \
      --tags \
        "Environment=$ENVIRONMENT" \
        "Service=secrets" \
        "Layer=security" \
        "ManagedBy=cloudformation" \
        "Project=lynia-finance"

    DEPLOY_END=$(date +%s)
    DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))
    pass "Stack deployment completed in ${DEPLOY_DURATION}s"
  fi
fi

# --------------------------------------------------------------------------
# Step 3: Record Stack Outputs
# --------------------------------------------------------------------------
step "Step 3: Record Stack Outputs"

FINAL_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text \
  --region "$REGION" 2>/dev/null || echo "DOES_NOT_EXIST")

if [[ "$FINAL_STATUS" == "CREATE_COMPLETE" || "$FINAL_STATUS" == "UPDATE_COMPLETE" ]]; then
  pass "Stack status: $FINAL_STATUS"
else
  fail "Stack status: $FINAL_STATUS (expected CREATE_COMPLETE or UPDATE_COMPLETE)"
  if [[ "$DRY_RUN" == true ]]; then
    info "Dry run — stack may not exist yet. Skipping output recording."
  else
    exit 2
  fi
fi

if [[ "$FINAL_STATUS" == "CREATE_COMPLETE" || "$FINAL_STATUS" == "UPDATE_COMPLETE" ]]; then
  echo ""
  info "Stack Outputs:"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs" \
    --output table \
    --region "$REGION"
  echo ""

  # Count secret ARN outputs
  SECRET_ARNS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'SecretArn')] | length(@)" --output text --region "$REGION")
  echo -e "  ${CYAN}Secret ARN outputs:${NC} ${GREEN}${SECRET_ARNS}${NC} (expected: 7)"

  # Count policy ARN outputs
  POLICY_ARNS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'PolicyArn')] | length(@)" --output text --region "$REGION")
  echo -e "  ${CYAN}Policy ARN outputs:${NC} ${GREEN}${POLICY_ARNS}${NC} (expected: 6)"
  echo ""

  # Verify CloudFormation exports
  info "Verifying CloudFormation exports..."
  EXPORTS=$(aws cloudformation list-exports \
    --query "Exports[?starts_with(Name,'${ENVIRONMENT}-lynia-') && (contains(Name,'secret') || contains(Name,'policy'))].{Name:Name}" \
    --output table \
    --region "$REGION" 2>/dev/null || echo "")
  if [[ -n "$EXPORTS" ]]; then
    echo "$EXPORTS"
    pass "CloudFormation exports available for cross-stack references"
  else
    warn "No secrets-related CloudFormation exports found"
  fi
fi

# --------------------------------------------------------------------------
# Step 4: Verify Secrets and Policies
# --------------------------------------------------------------------------
step "Step 4: Verify Secrets and IAM Policies"

if [[ "$DRY_RUN" == true && "$FINAL_STATUS" != "CREATE_COMPLETE" && "$FINAL_STATUS" != "UPDATE_COMPLETE" ]]; then
  info "Dry run — skipping resource verification (stack not deployed)"
else

  # 4a. Verify all 7 secrets exist
  info "Verifying secrets exist under ${ENVIRONMENT}/lynia/ prefix..."
  SECRETS_LIST=$(aws secretsmanager list-secrets \
    --filters "Key=name,Values=${ENVIRONMENT}/lynia" \
    --query "SecretList[].Name" \
    --output json \
    --region "$REGION" 2>/dev/null || echo "[]")

  SECRETS_COUNT=$(echo "$SECRETS_LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  if [[ "$SECRETS_COUNT" -ge 7 ]]; then
    pass "Secrets count: $SECRETS_COUNT (expected: 7)"
  else
    fail "Secrets count: $SECRETS_COUNT (expected: 7)"
  fi

  # Check each secret individually
  for SECRET_NAME in "${SECRET_NAMES[@]}"; do
    SECRET_EXISTS=$(echo "$SECRETS_LIST" | python3 -c "import sys,json; names=json.load(sys.stdin); print('true' if '$SECRET_NAME' in names else 'false')" 2>/dev/null || echo "false")
    if [[ "$SECRET_EXISTS" == "true" ]]; then
      pass "Secret exists: $SECRET_NAME"
    else
      fail "Secret not found: $SECRET_NAME"
    fi
  done

  # 4b. Verify database secret contains expected fields (non-sensitive check)
  echo ""
  info "Verifying database secret structure..."
  DB_SECRET=$(aws secretsmanager get-secret-value \
    --secret-id "${ENVIRONMENT}/lynia/database" \
    --query "SecretString" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "{}")

  DB_HAS_HOST=$(echo "$DB_SECRET" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('true' if 'host' in d and d['host'] else 'false')" 2>/dev/null || echo "false")
  DB_HAS_PORT=$(echo "$DB_SECRET" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('true' if 'port' in d else 'false')" 2>/dev/null || echo "false")
  DB_HAS_DB=$(echo "$DB_SECRET" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('true' if 'database' in d else 'false')" 2>/dev/null || echo "false")
  DB_HAS_USER=$(echo "$DB_SECRET" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('true' if 'username' in d else 'false')" 2>/dev/null || echo "false")
  DB_HAS_PASS=$(echo "$DB_SECRET" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('true' if 'password' in d and d['password'] else 'false')" 2>/dev/null || echo "false")

  if [[ "$DB_HAS_HOST" == "true" && "$DB_HAS_PORT" == "true" && "$DB_HAS_DB" == "true" && "$DB_HAS_USER" == "true" && "$DB_HAS_PASS" == "true" ]]; then
    pass "Database secret contains all required fields (host, port, database, username, password)"
  else
    fail "Database secret missing fields (host=$DB_HAS_HOST, port=$DB_HAS_PORT, db=$DB_HAS_DB, user=$DB_HAS_USER, pass=$DB_HAS_PASS)"
  fi

  # 4c. Verify IAM policies exist
  echo ""
  info "Verifying IAM managed policies..."
  POLICY_OUTPUTS=(
    "SharedSecretsPolicyArn"
    "WhatsAppSecretsPolicyArn"
    "KYCSecretsPolicyArn"
    "PaymentSecretsPolicyArn"
    "LockSecretsPolicyArn"
    "NotificationSecretsPolicyArn"
  )

  POLICY_COUNT=0
  for POLICY_KEY in "${POLICY_OUTPUTS[@]}"; do
    POLICY_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
      --query "Stacks[0].Outputs[?OutputKey=='$POLICY_KEY'].OutputValue" --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$POLICY_ARN" != "NOT_FOUND" && "$POLICY_ARN" != "" && "$POLICY_ARN" != "None" ]]; then
      pass "IAM policy: $POLICY_KEY"
      POLICY_COUNT=$((POLICY_COUNT + 1))
    else
      fail "IAM policy not found: $POLICY_KEY"
    fi
  done

  if [[ "$POLICY_COUNT" -eq 6 ]]; then
    pass "All 6 IAM managed policies verified"
  else
    fail "IAM policy count: $POLICY_COUNT (expected: 6)"
  fi
fi

# --------------------------------------------------------------------------
# Step 5: Summary
# --------------------------------------------------------------------------
step "Deployment Summary"

echo ""
echo -e "  ${CYAN}Stack:${NC}        $STACK_NAME"
echo -e "  ${CYAN}Environment:${NC}  $ENVIRONMENT"
echo -e "  ${CYAN}Region:${NC}       $REGION"
echo -e "  ${CYAN}Status:${NC}       ${FINAL_STATUS:-N/A}"
echo -e "  ${CYAN}Secrets:${NC}      7 secrets"
echo -e "  ${CYAN}Policies:${NC}     6 IAM managed policies"
echo -e "  ${CYAN}Timestamp:${NC}    $(timestamp)"
echo ""
echo -e "  ┌──────────────────────────────────────┐"
echo -e "  │  Checks Passed:  ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "  │  Checks Failed:  ${RED}${CHECKS_FAILED}${NC}"
echo -e "  │  Warnings:       ${YELLOW}${CHECKS_WARNED}${NC}"
echo -e "  └──────────────────────────────────────┘"
echo ""

echo -e "  ${CYAN}Secrets Inventory:${NC}"
echo -e "  ┌────────────────────────────┬────────────────────┬──────────────────────────────┐"
echo -e "  │ Secret                     │ Service(s)         │ Contents                     │"
echo -e "  ├────────────────────────────┼────────────────────┼──────────────────────────────┤"
echo -e "  │ database                   │ All                │ host, port, db, user, pass   │"
echo -e "  │ whatsapp                   │ WhatsApp           │ phone_id, token, webhook     │"
echo -e "  │ smile-identity             │ KYC                │ partner_id, api_key          │"
echo -e "  │ ecocash                    │ Payment            │ merchant_id, api_key         │"
echo -e "  │ onemoney                   │ Payment            │ merchant_id, api_key         │"
echo -e "  │ trustonic                  │ Lock               │ api_key, api_secret          │"
echo -e "  │ sms                        │ Notification       │ api_key                      │"
echo -e "  └────────────────────────────┴────────────────────┴──────────────────────────────┘"
echo ""

if [[ "$CHECKS_FAILED" -gt 0 ]]; then
  echo -e "  ${RED}DEPLOYMENT VERIFICATION FAILED${NC}"
  echo -e "  ${RED}$CHECKS_FAILED check(s) failed. Review the output above for details.${NC}"
  echo ""
  exit 3
elif [[ "$DRY_RUN" == true ]]; then
  echo -e "  ${YELLOW}DRY RUN COMPLETE${NC}"
  echo -e "  ${YELLOW}No resources were created. Remove --dry-run to deploy.${NC}"
  echo ""
  exit 0
else
  echo -e "  ${GREEN}ALL CHECKS PASSED — Secrets Manager stack deployed and verified successfully${NC}"
  echo ""

  echo -e "  ${YELLOW}Cost Impact: ~\$3/month (7 Secrets Manager secrets @ \$0.40/secret/month)${NC}"
  echo ""
  echo -e "  ${CYAN}Next Step:${NC} Deploy downstream stacks that depend on secret and policy ARNs:"
  echo -e "    - P5-DEPLOY-T010: SAM Lambda Deploy (attaches IAM policies to Lambda execution roles)"
  echo ""
  exit 0
fi
