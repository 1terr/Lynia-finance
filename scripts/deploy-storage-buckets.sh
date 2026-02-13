#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T005: Deploy S3 Storage Buckets Stack
# ============================================================================
# Deploys 4 application S3 buckets with encryption, lifecycle policies,
# and public access blocks:
#   1. KYC Documents         — KMS encryption, Intelligent Tiering at 90d, 10yr retention
#   2. Commission PDFs       — AES-256, Glacier after 365d, 7yr retention
#   3. Reconciliation Photos — AES-256, expire after 365d
#   4. ML Models             — AES-256, versioning enabled
#
# All buckets have public access fully blocked.
#
# Usage:
#   ./scripts/deploy-storage-buckets.sh                   # Production deploy
#   ./scripts/deploy-storage-buckets.sh --env staging      # Staging deploy
#   ./scripts/deploy-storage-buckets.sh --dry-run          # Validate without deploying
#   ./scripts/deploy-storage-buckets.sh --verify-only      # Verify existing stack
#   ./scripts/deploy-storage-buckets.sh --outputs          # Show stack outputs only
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
STORAGE_TEMPLATE="$PROJECT_ROOT/infrastructure/aws/storage-buckets.yaml"

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
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Derived names
STACK_NAME="${ENVIRONMENT}-lynia-storage"

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
echo -e "${CYAN}║  Lynia Finance — P5-DEPLOY-T005: Deploy S3 Storage Buckets     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Environment:  ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Region:       ${YELLOW}${REGION}${NC}"
echo -e "  Stack Name:   ${YELLOW}${STACK_NAME}${NC}"
echo -e "  Template:     ${YELLOW}infrastructure/aws/storage-buckets.yaml${NC}"
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
  echo -e "  ${RED}Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html${NC}"
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
  echo ""
  echo -e "  ${YELLOW}Configure credentials:${NC}"
  echo "    export AWS_ACCESS_KEY_ID=<your-key>"
  echo "    export AWS_SECRET_ACCESS_KEY=<your-secret>"
  echo "    export AWS_DEFAULT_REGION=$REGION"
  exit 1
fi

# Check template exists
if [[ -f "$STORAGE_TEMPLATE" ]]; then
  TEMPLATE_SIZE=$(wc -c < "$STORAGE_TEMPLATE" | tr -d ' ')
  pass "Storage buckets template found ($TEMPLATE_SIZE bytes)"
else
  fail "Storage buckets template not found at: $STORAGE_TEMPLATE"
  exit 1
fi

# Validate template with CloudFormation API
info "Validating template with CloudFormation API..."
if aws cloudformation validate-template \
    --template-body "file://$STORAGE_TEMPLATE" \
    --region "$REGION" &>/dev/null; then
  pass "Template passes CloudFormation validation"
else
  fail "Template failed CloudFormation validation"
  aws cloudformation validate-template \
    --template-body "file://$STORAGE_TEMPLATE" \
    --region "$REGION" 2>&1 || true
  exit 1
fi

# Check T001 dependency: verify S3 template bucket exists
TEMPLATE_BUCKET="lynia-finance-${ENVIRONMENT}-templates"
if aws s3api head-bucket --bucket "$TEMPLATE_BUCKET" --region "$REGION" 2>/dev/null; then
  pass "T001 dependency met: S3 template bucket exists ($TEMPLATE_BUCKET)"
else
  warn "S3 template bucket not found ($TEMPLATE_BUCKET) — deploying from local file"
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
# Step 2: Deploy Storage Buckets Stack
# --------------------------------------------------------------------------
if [[ "$VERIFY_ONLY" != true ]]; then
  step "Step 2: Deploy S3 Storage Buckets Stack"

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
    info "DRY RUN: Would deploy stack $STACK_NAME with template $STORAGE_TEMPLATE"
    info "DRY RUN: Parameters: Environment=$ENVIRONMENT"
    info "DRY RUN complete — no resources were created"
  else
    info "Deploying S3 storage buckets stack..."
    info "This typically takes 1-2 minutes"
    echo ""

    DEPLOY_START=$(date +%s)

    aws cloudformation deploy \
      --template-file "$STORAGE_TEMPLATE" \
      --stack-name "$STACK_NAME" \
      --parameter-overrides "Environment=$ENVIRONMENT" \
      --region "$REGION" \
      --no-fail-on-empty-changeset \
      --tags \
        "Environment=$ENVIRONMENT" \
        "Service=storage" \
        "Layer=infrastructure" \
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

  # Extract key values for downstream stacks
  KYC_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='KYCDocumentsBucketName'].OutputValue" --output text --region "$REGION")
  COMMISSION_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='CommissionPDFsBucketName'].OutputValue" --output text --region "$REGION")
  RECON_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='ReconciliationBucketName'].OutputValue" --output text --region "$REGION")
  ML_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='MLModelsBucketName'].OutputValue" --output text --region "$REGION")

  echo -e "  ${CYAN}Key Values for Downstream Stacks:${NC}"
  echo -e "    KYC_DOCUMENTS_BUCKET    = ${GREEN}${KYC_BUCKET}${NC}"
  echo -e "    COMMISSION_PDFS_BUCKET  = ${GREEN}${COMMISSION_BUCKET}${NC}"
  echo -e "    RECONCILIATION_BUCKET   = ${GREEN}${RECON_BUCKET}${NC}"
  echo -e "    ML_MODELS_BUCKET        = ${GREEN}${ML_BUCKET}${NC}"
  echo ""

  # Verify CloudFormation exports
  info "Verifying CloudFormation exports..."
  EXPORTS=$(aws cloudformation list-exports \
    --query "Exports[?starts_with(Name,'${ENVIRONMENT}-lynia-') && (contains(Name,'bucket'))].{Name:Name,Value:Value}" \
    --output table \
    --region "$REGION" 2>/dev/null || echo "")
  if [[ -n "$EXPORTS" ]]; then
    echo "$EXPORTS"
    pass "CloudFormation exports available for cross-stack references"
  else
    warn "No bucket-related CloudFormation exports found"
  fi
fi

# --------------------------------------------------------------------------
# Step 4: Verify Buckets
# --------------------------------------------------------------------------
step "Step 4: Verify S3 Bucket Resources"

if [[ "$DRY_RUN" == true && "$FINAL_STATUS" != "CREATE_COMPLETE" && "$FINAL_STATUS" != "UPDATE_COMPLETE" ]]; then
  info "Dry run — skipping resource verification (stack not deployed)"
else

  # Bucket suffixes and expected encryption types
  declare -A BUCKET_ENCRYPTION=(
    ["kyc-documents"]="aws:kms"
    ["commission-pdfs"]="AES256"
    ["reconciliation"]="AES256"
    ["ml-models"]="AES256"
  )

  declare -A BUCKET_VERSIONING=(
    ["kyc-documents"]="Enabled"
    ["commission-pdfs"]="Suspended"
    ["reconciliation"]="Suspended"
    ["ml-models"]="Enabled"
  )

  for BUCKET_SUFFIX in kyc-documents commission-pdfs reconciliation ml-models; do
    BUCKET_NAME="${ENVIRONMENT}-lynia-${BUCKET_SUFFIX}-${ACCOUNT_ID}"
    echo ""
    info "Checking bucket: $BUCKET_NAME"

    # 4a. Verify bucket exists
    if aws s3api head-bucket --bucket "$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
      pass "Bucket exists: $BUCKET_NAME"
    else
      fail "Bucket not found: $BUCKET_NAME"
      continue
    fi

    # 4b. Verify public access block
    PAB=$(aws s3api get-public-access-block \
      --bucket "$BUCKET_NAME" \
      --query "PublicAccessBlockConfiguration" \
      --output json \
      --region "$REGION" 2>/dev/null || echo "{}")

    BLOCK_PUBLIC_ACLS=$(echo "$PAB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('BlockPublicAcls',False))" 2>/dev/null || echo "False")
    BLOCK_PUBLIC_POLICY=$(echo "$PAB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('BlockPublicPolicy',False))" 2>/dev/null || echo "False")
    IGNORE_PUBLIC_ACLS=$(echo "$PAB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('IgnorePublicAcls',False))" 2>/dev/null || echo "False")
    RESTRICT_PUBLIC=$(echo "$PAB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('RestrictPublicBuckets',False))" 2>/dev/null || echo "False")

    if [[ "$BLOCK_PUBLIC_ACLS" == "True" && "$BLOCK_PUBLIC_POLICY" == "True" && "$IGNORE_PUBLIC_ACLS" == "True" && "$RESTRICT_PUBLIC" == "True" ]]; then
      pass "  Public access block: fully enabled"
    else
      fail "  Public access block: not fully enabled (BlockPublicAcls=$BLOCK_PUBLIC_ACLS, BlockPublicPolicy=$BLOCK_PUBLIC_POLICY)"
    fi

    # 4c. Verify encryption
    EXPECTED_ENC="${BUCKET_ENCRYPTION[$BUCKET_SUFFIX]}"
    ACTUAL_ENC=$(aws s3api get-bucket-encryption \
      --bucket "$BUCKET_NAME" \
      --query "ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NONE")

    if [[ "$ACTUAL_ENC" == "$EXPECTED_ENC" ]]; then
      pass "  Encryption: $ACTUAL_ENC"
    else
      fail "  Encryption: $ACTUAL_ENC (expected: $EXPECTED_ENC)"
    fi

    # 4d. Verify versioning
    EXPECTED_VER="${BUCKET_VERSIONING[$BUCKET_SUFFIX]}"
    ACTUAL_VER=$(aws s3api get-bucket-versioning \
      --bucket "$BUCKET_NAME" \
      --query "Status" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "Suspended")

    if [[ "$ACTUAL_VER" == "$EXPECTED_VER" ]]; then
      pass "  Versioning: $ACTUAL_VER"
    else
      fail "  Versioning: $ACTUAL_VER (expected: $EXPECTED_VER)"
    fi
  done

  # 4e. Verify KYC bucket lifecycle (Intelligent Tiering at 90d)
  echo ""
  info "Verifying lifecycle policies..."

  KYC_BUCKET_NAME="${ENVIRONMENT}-lynia-kyc-documents-${ACCOUNT_ID}"
  KYC_LIFECYCLE=$(aws s3api get-bucket-lifecycle-configuration \
    --bucket "$KYC_BUCKET_NAME" \
    --query "Rules[0].Transitions[0].StorageClass" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "NONE")
  if [[ "$KYC_LIFECYCLE" == "INTELLIGENT_TIERING" ]]; then
    pass "KYC bucket lifecycle: Intelligent Tiering transition"
  else
    fail "KYC bucket lifecycle: $KYC_LIFECYCLE (expected: INTELLIGENT_TIERING)"
  fi

  # 4f. Verify commission bucket lifecycle (Glacier after 365d)
  COMMISSION_BUCKET_NAME="${ENVIRONMENT}-lynia-commission-pdfs-${ACCOUNT_ID}"
  COMMISSION_LIFECYCLE=$(aws s3api get-bucket-lifecycle-configuration \
    --bucket "$COMMISSION_BUCKET_NAME" \
    --query "Rules[0].Transitions[0].StorageClass" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "NONE")
  if [[ "$COMMISSION_LIFECYCLE" == "GLACIER" ]]; then
    pass "Commission bucket lifecycle: Glacier transition after 365 days"
  else
    fail "Commission bucket lifecycle: $COMMISSION_LIFECYCLE (expected: GLACIER)"
  fi

  # 4g. Verify reconciliation bucket lifecycle (expire after 365d)
  RECON_BUCKET_NAME="${ENVIRONMENT}-lynia-reconciliation-${ACCOUNT_ID}"
  RECON_EXPIRY=$(aws s3api get-bucket-lifecycle-configuration \
    --bucket "$RECON_BUCKET_NAME" \
    --query "Rules[0].Expiration.Days" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "NONE")
  if [[ "$RECON_EXPIRY" == "365" ]]; then
    pass "Reconciliation bucket lifecycle: expire after 365 days"
  else
    fail "Reconciliation bucket lifecycle expiry: $RECON_EXPIRY days (expected: 365)"
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
echo -e "  ${CYAN}Buckets:${NC}      4 application buckets"
echo -e "  ${CYAN}Timestamp:${NC}    $(timestamp)"
echo ""
echo -e "  ┌──────────────────────────────────────┐"
echo -e "  │  Checks Passed:  ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "  │  Checks Failed:  ${RED}${CHECKS_FAILED}${NC}"
echo -e "  │  Warnings:       ${YELLOW}${CHECKS_WARNED}${NC}"
echo -e "  └──────────────────────────────────────┘"
echo ""

echo -e "  ${CYAN}Bucket Configuration Summary:${NC}"
echo -e "  ┌──────────────────────────┬───────────┬──────────────────────────┬────────────┐"
echo -e "  │ Bucket                   │ Encrypt   │ Lifecycle                │ Versioning │"
echo -e "  ├──────────────────────────┼───────────┼──────────────────────────┼────────────┤"
echo -e "  │ kyc-documents            │ ${YELLOW}KMS${NC}       │ Intelligent Tier 90d     │ Yes        │"
echo -e "  │ commission-pdfs          │ AES-256   │ Glacier after 365d       │ No         │"
echo -e "  │ reconciliation-photos    │ AES-256   │ Expire after 365d        │ No         │"
echo -e "  │ ml-models                │ AES-256   │ None                     │ Yes        │"
echo -e "  └──────────────────────────┴───────────┴──────────────────────────┴────────────┘"
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
  echo -e "  ${GREEN}ALL CHECKS PASSED — S3 storage buckets stack deployed and verified successfully${NC}"
  echo ""

  echo -e "  ${YELLOW}Cost Impact: ~\$5-15/month (4 S3 buckets, storage-dependent)${NC}"
  echo ""
  echo -e "  ${CYAN}Next Step:${NC} Deploy downstream stacks that depend on S3 exports:"
  echo -e "    - P5-DEPLOY-T010: SAM Lambda Deploy (uses bucket names for KYC, ML models)"
  echo ""
  exit 0
fi
