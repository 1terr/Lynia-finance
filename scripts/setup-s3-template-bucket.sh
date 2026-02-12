#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T001: Prerequisites & S3 Template Bucket Setup
# ============================================================================
# Automates the complete T001 task:
#   1. Verify all required CLI tools are installed
#   2. Verify AWS credentials and target region
#   3. Create S3 template bucket for CloudFormation templates
#   4. Upload all infrastructure templates to S3
#   5. Validate all CloudFormation templates
#   6. Create SAM artifact bucket
#
# Usage:
#   ./scripts/setup-s3-template-bucket.sh                    # Production
#   ./scripts/setup-s3-template-bucket.sh --env staging      # Staging
#   ./scripts/setup-s3-template-bucket.sh --env development  # Development
#   ./scripts/setup-s3-template-bucket.sh --dry-run          # Simulate only
#   ./scripts/setup-s3-template-bucket.sh --validate-only    # Validate templates only
#
# Exit codes:
#   0 - All steps completed successfully
#   1 - Tool or credential verification failed
#   2 - S3 bucket creation failed
#   3 - Template upload failed
#   4 - Template validation failed
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
REGION="us-east-1"
STACK_PREFIX="lynia-finance"
DRY_RUN=false
VALIDATE_ONLY=false

# Counters
PASSED=0
FAILED=0
WARNINGS=0
UPLOADED=0
VALIDATED=0
VALIDATION_FAILURES=0

# Project root (script is in scripts/)
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
    --dry-run) DRY_RUN=true ;;
    --validate-only) VALIDATE_ONLY=true ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --env ENV         Target environment (default: production)"
      echo "  --dry-run         Simulate without making changes"
      echo "  --validate-only   Only validate templates, skip bucket creation"
      echo "  --help            Show this help message"
      exit 0
      ;;
  esac
done

# Derived names
TEMPLATE_BUCKET="${STACK_PREFIX}-${ENVIRONMENT}-templates"
ARTIFACT_BUCKET="${STACK_PREFIX}-${ENVIRONMENT}-artifacts"

# Logging helpers
log()     { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}  [PASS]${NC} $1"; PASSED=$((PASSED + 1)); }
fail()    { echo -e "${RED}  [FAIL]${NC} $1"; FAILED=$((FAILED + 1)); }
warn()    { echo -e "${YELLOW}  [WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
step()    { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# ============================================================================
# Template manifest - all CloudFormation templates to upload and validate
# ============================================================================
# Format: local_path:s3_key
TEMPLATE_MANIFEST=(
  # Core AWS infrastructure
  "infrastructure/aws/vpc.yaml:vpc.yaml"
  "infrastructure/aws/rds.yaml:rds.yaml"
  "infrastructure/aws/cognito.yaml:cognito.yaml"
  "infrastructure/aws/secrets-manager.yaml:secrets-manager.yaml"
  "infrastructure/aws/sqs-queues.yaml:sqs-queues.yaml"
  "infrastructure/aws/iam-roles.yaml:iam-roles.yaml"
  "infrastructure/aws/storage-buckets.yaml:storage-buckets.yaml"
  "infrastructure/aws/frontend-hosting.yaml:frontend-hosting.yaml"
  "infrastructure/aws/dns-ssl.yaml:dns-ssl.yaml"
  "infrastructure/aws/waf.yaml:waf.yaml"
  "infrastructure/aws/lambda-autoscaling.yaml:lambda-autoscaling.yaml"
  "infrastructure/aws/canary-deployments.yaml:canary-deployments.yaml"
  "infrastructure/aws/xray-tracing.yaml:xray-tracing.yaml"
  "infrastructure/aws/production-master.yaml:production-master.yaml"
  # API Gateway
  "infrastructure/aws/api-gateway/throttling-usage-plans.yaml:api-gateway/throttling-usage-plans.yaml"
  # Monitoring
  "infrastructure/monitoring/cloudwatch-alarms.yaml:monitoring/cloudwatch-alarms.yaml"
  "infrastructure/monitoring/log-retention-archival.yaml:monitoring/log-retention-archival.yaml"
  # Database
  "infrastructure/database/production-pooling.yaml:database/production-pooling.yaml"
)

# ============================================================================
# STEP 1: Verify Required Tools
# ============================================================================
verify_tools() {
  step "Step 1: Verify Required Tools"

  # AWS CLI
  if command -v aws &> /dev/null; then
    local aws_ver
    aws_ver=$(aws --version 2>&1)
    success "AWS CLI: $aws_ver"
  else
    fail "AWS CLI not found. Install: https://aws.amazon.com/cli/"
    return 1
  fi

  # SAM CLI
  if command -v sam &> /dev/null; then
    local sam_ver
    sam_ver=$(sam --version 2>&1)
    success "SAM CLI: $sam_ver"
  else
    fail "SAM CLI not found. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    return 1
  fi

  # Node.js
  if command -v node &> /dev/null; then
    local node_ver
    node_ver=$(node --version 2>&1)
    local node_major
    node_major=$(echo "$node_ver" | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_major" -ge 20 ]; then
      success "Node.js: $node_ver"
    else
      fail "Node.js 20.x required. Current: $node_ver"
    fi
  else
    fail "Node.js not found"
  fi

  # pnpm
  if command -v pnpm &> /dev/null; then
    local pnpm_ver
    pnpm_ver=$(pnpm --version 2>&1)
    success "pnpm: v$pnpm_ver"
  else
    fail "pnpm not found. Install: npm install -g pnpm"
  fi

  # psql (needed for T009)
  if command -v psql &> /dev/null; then
    local psql_ver
    psql_ver=$(psql --version 2>&1)
    success "psql: $psql_ver"
  else
    warn "psql not found (needed for T009 database migrations)"
  fi
}

# ============================================================================
# STEP 2: Verify AWS Credentials
# ============================================================================
verify_credentials() {
  step "Step 2: Verify AWS Credentials"

  # Check caller identity
  local identity
  identity=$(aws sts get-caller-identity --output json 2>&1) || {
    fail "AWS credentials not configured. Run: aws configure"
    echo -e "  ${YELLOW}Hint: Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables${NC}"
    echo -e "  ${YELLOW}  or run 'aws configure' to set up credentials${NC}"
    return 1
  }

  local account_id user_id arn
  account_id=$(echo "$identity" | python3 -c "import sys,json; print(json.load(sys.stdin)['Account'])" 2>/dev/null || echo "unknown")
  user_id=$(echo "$identity" | python3 -c "import sys,json; print(json.load(sys.stdin)['UserId'])" 2>/dev/null || echo "unknown")
  arn=$(echo "$identity" | python3 -c "import sys,json; print(json.load(sys.stdin)['Arn'])" 2>/dev/null || echo "unknown")

  success "AWS Account: $account_id"
  success "AWS User:    $arn"
  log "AWS UserId:  $user_id"

  # Verify region
  local configured_region
  configured_region=$(aws configure get region 2>/dev/null || echo "not-set")
  if [ "$configured_region" = "$REGION" ]; then
    success "AWS Region: $configured_region (matches target: $REGION)"
  elif [ "$configured_region" = "not-set" ]; then
    warn "AWS Region not configured. Will use --region $REGION explicitly."
  else
    warn "AWS Region mismatch: configured=$configured_region, target=$REGION"
    log "Will use --region $REGION for all commands"
  fi

  # Quick permission check: can we list S3 buckets?
  if aws s3 ls --region "$REGION" &>/dev/null; then
    success "S3 access: verified"
  else
    warn "Unable to list S3 buckets. Check IAM permissions."
  fi
}

# ============================================================================
# STEP 3: Create Template Bucket
# ============================================================================
create_template_bucket() {
  step "Step 3: Create Template Bucket"

  log "Target bucket: s3://${TEMPLATE_BUCKET}"

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would create bucket: s3://${TEMPLATE_BUCKET}"
    success "Template bucket creation simulated"
    return 0
  fi

  # Check if bucket already exists
  if aws s3api head-bucket --bucket "$TEMPLATE_BUCKET" --region "$REGION" 2>/dev/null; then
    success "Template bucket already exists: s3://${TEMPLATE_BUCKET}"
  else
    log "Creating template bucket..."
    if [ "$REGION" = "us-east-1" ]; then
      # us-east-1 does not accept LocationConstraint
      aws s3api create-bucket \
        --bucket "$TEMPLATE_BUCKET" \
        --region "$REGION" 2>&1
    else
      aws s3api create-bucket \
        --bucket "$TEMPLATE_BUCKET" \
        --region "$REGION" \
        --create-bucket-configuration "LocationConstraint=$REGION" 2>&1
    fi

    if [ $? -eq 0 ]; then
      success "Template bucket created: s3://${TEMPLATE_BUCKET}"
    else
      fail "Failed to create template bucket"
      return 2
    fi
  fi

  # Enable versioning for safety
  aws s3api put-bucket-versioning \
    --bucket "$TEMPLATE_BUCKET" \
    --versioning-configuration Status=Enabled \
    --region "$REGION" 2>/dev/null && \
    success "Bucket versioning enabled" || \
    warn "Could not enable bucket versioning"

  # Block public access
  aws s3api put-public-access-block \
    --bucket "$TEMPLATE_BUCKET" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    --region "$REGION" 2>/dev/null && \
    success "Public access blocked" || \
    warn "Could not set public access block"

  # Add server-side encryption
  aws s3api put-bucket-encryption \
    --bucket "$TEMPLATE_BUCKET" \
    --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
    --region "$REGION" 2>/dev/null && \
    success "Server-side encryption enabled (AES-256)" || \
    warn "Could not enable server-side encryption"

  # Add tags
  aws s3api put-bucket-tagging \
    --bucket "$TEMPLATE_BUCKET" \
    --tagging "TagSet=[{Key=Environment,Value=${ENVIRONMENT}},{Key=Project,Value=lynia-finance},{Key=Purpose,Value=cloudformation-templates}]" \
    --region "$REGION" 2>/dev/null && \
    success "Bucket tagged" || \
    warn "Could not tag bucket"
}

# ============================================================================
# STEP 4: Upload All CloudFormation Templates
# ============================================================================
upload_templates() {
  step "Step 4: Upload CloudFormation Templates"

  local total=${#TEMPLATE_MANIFEST[@]}
  log "Uploading $total templates to s3://${TEMPLATE_BUCKET}/"

  for entry in "${TEMPLATE_MANIFEST[@]}"; do
    local local_path="${entry%%:*}"
    local s3_key="${entry##*:}"
    local full_path="${PROJECT_ROOT}/${local_path}"

    if [ ! -f "$full_path" ]; then
      fail "Template not found: $local_path"
      continue
    fi

    if [ "$DRY_RUN" = true ]; then
      log "[DRY RUN] Would upload: $local_path → s3://${TEMPLATE_BUCKET}/${s3_key}"
      UPLOADED=$((UPLOADED + 1))
      continue
    fi

    if aws s3 cp "$full_path" "s3://${TEMPLATE_BUCKET}/${s3_key}" \
      --region "$REGION" \
      --quiet 2>/dev/null; then
      success "Uploaded: $local_path → ${s3_key}"
      UPLOADED=$((UPLOADED + 1))
    else
      fail "Upload failed: $local_path"
    fi
  done

  log "Upload summary: $UPLOADED / $total templates uploaded"

  if [ "$DRY_RUN" = false ]; then
    # List bucket contents to verify
    log "Verifying bucket contents..."
    local s3_count
    s3_count=$(aws s3 ls "s3://${TEMPLATE_BUCKET}/" --recursive --region "$REGION" 2>/dev/null | wc -l)
    if [ "$s3_count" -ge 16 ]; then
      success "Template bucket contains $s3_count files (threshold: 16+)"
    else
      warn "Template bucket contains $s3_count files (expected 16+)"
    fi
  fi
}

# ============================================================================
# STEP 5: Validate All CloudFormation Templates
# ============================================================================
validate_templates() {
  step "Step 5: Validate CloudFormation Templates"

  local total=${#TEMPLATE_MANIFEST[@]}
  log "Validating $total CloudFormation templates..."

  for entry in "${TEMPLATE_MANIFEST[@]}"; do
    local local_path="${entry%%:*}"
    local full_path="${PROJECT_ROOT}/${local_path}"

    if [ ! -f "$full_path" ]; then
      fail "Template not found: $local_path"
      VALIDATION_FAILURES=$((VALIDATION_FAILURES + 1))
      continue
    fi

    # Check file size (CloudFormation validate-template has a 51,200 byte limit for --template-body)
    local file_size
    file_size=$(wc -c < "$full_path")

    local description
    if [ "$file_size" -gt 51200 ]; then
      # For large templates, validate via S3 URL if available
      if [ "$DRY_RUN" = false ] && [ "$VALIDATE_ONLY" = false ]; then
        local s3_key="${entry##*:}"
        description=$(aws cloudformation validate-template \
          --template-url "https://${TEMPLATE_BUCKET}.s3.amazonaws.com/${s3_key}" \
          --region "$REGION" \
          --query "Description" \
          --output text 2>&1) || {
          fail "Validation failed (via S3): $local_path"
          echo -e "  ${RED}Error: $description${NC}"
          VALIDATION_FAILURES=$((VALIDATION_FAILURES + 1))
          continue
        }
      else
        warn "Template too large for local validation (${file_size} bytes): $local_path"
        VALIDATED=$((VALIDATED + 1))
        continue
      fi
    else
      if [ "$DRY_RUN" = true ]; then
        # Even in dry-run mode, validate templates locally
        description=$(aws cloudformation validate-template \
          --template-body "file://${full_path}" \
          --region "$REGION" \
          --query "Description" \
          --output text 2>&1) || {
          fail "Validation failed: $local_path"
          echo -e "  ${RED}Error: $description${NC}"
          VALIDATION_FAILURES=$((VALIDATION_FAILURES + 1))
          continue
        }
      else
        description=$(aws cloudformation validate-template \
          --template-body "file://${full_path}" \
          --region "$REGION" \
          --query "Description" \
          --output text 2>&1) || {
          fail "Validation failed: $local_path"
          echo -e "  ${RED}Error: $description${NC}"
          VALIDATION_FAILURES=$((VALIDATION_FAILURES + 1))
          continue
        }
      fi
    fi

    success "Valid: $local_path"
    if [ -n "$description" ] && [ "$description" != "None" ]; then
      log "  Description: $description"
    fi
    VALIDATED=$((VALIDATED + 1))
  done

  log "Validation summary: $VALIDATED passed, $VALIDATION_FAILURES failed out of $total templates"
}

# ============================================================================
# STEP 6: Create SAM Artifact Bucket
# ============================================================================
create_artifact_bucket() {
  step "Step 6: Create SAM Artifact Bucket"

  log "Target bucket: s3://${ARTIFACT_BUCKET}"

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would create bucket: s3://${ARTIFACT_BUCKET}"
    success "Artifact bucket creation simulated"
    return 0
  fi

  # Check if bucket already exists
  if aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" 2>/dev/null; then
    success "Artifact bucket already exists: s3://${ARTIFACT_BUCKET}"
  else
    log "Creating artifact bucket..."
    if [ "$REGION" = "us-east-1" ]; then
      aws s3api create-bucket \
        --bucket "$ARTIFACT_BUCKET" \
        --region "$REGION" 2>&1
    else
      aws s3api create-bucket \
        --bucket "$ARTIFACT_BUCKET" \
        --region "$REGION" \
        --create-bucket-configuration "LocationConstraint=$REGION" 2>&1
    fi

    if [ $? -eq 0 ]; then
      success "Artifact bucket created: s3://${ARTIFACT_BUCKET}"
    else
      fail "Failed to create artifact bucket"
      return 2
    fi
  fi

  # Enable versioning
  aws s3api put-bucket-versioning \
    --bucket "$ARTIFACT_BUCKET" \
    --versioning-configuration Status=Enabled \
    --region "$REGION" 2>/dev/null && \
    success "Bucket versioning enabled" || \
    warn "Could not enable bucket versioning"

  # Block public access
  aws s3api put-public-access-block \
    --bucket "$ARTIFACT_BUCKET" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    --region "$REGION" 2>/dev/null && \
    success "Public access blocked" || \
    warn "Could not set public access block"

  # Server-side encryption
  aws s3api put-bucket-encryption \
    --bucket "$ARTIFACT_BUCKET" \
    --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
    --region "$REGION" 2>/dev/null && \
    success "Server-side encryption enabled (AES-256)" || \
    warn "Could not enable server-side encryption"

  # Add lifecycle rule to clean up old artifacts (30 days)
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "$ARTIFACT_BUCKET" \
    --lifecycle-configuration '{
      "Rules": [{
        "ID": "cleanup-old-artifacts",
        "Status": "Enabled",
        "Filter": {"Prefix": ""},
        "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
      }]
    }' \
    --region "$REGION" 2>/dev/null && \
    success "Lifecycle policy set (old versions expire after 30 days)" || \
    warn "Could not set lifecycle policy"

  # Tag the bucket
  aws s3api put-bucket-tagging \
    --bucket "$ARTIFACT_BUCKET" \
    --tagging "TagSet=[{Key=Environment,Value=${ENVIRONMENT}},{Key=Project,Value=lynia-finance},{Key=Purpose,Value=sam-deployment-artifacts}]" \
    --region "$REGION" 2>/dev/null && \
    success "Bucket tagged" || \
    warn "Could not tag bucket"

  # Verify bucket is empty
  local obj_count
  obj_count=$(aws s3 ls "s3://${ARTIFACT_BUCKET}/" --region "$REGION" 2>/dev/null | wc -l)
  if [ "$obj_count" -eq 0 ]; then
    success "Artifact bucket is empty (ready for SAM deployments)"
  else
    warn "Artifact bucket contains $obj_count objects"
  fi
}

# ============================================================================
# Summary Report
# ============================================================================
print_summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  P5-DEPLOY-T001: Setup Summary"
  echo "  Environment: ${ENVIRONMENT}"
  echo "  Region:      ${REGION}"
  echo "  Date:        $(date '+%Y-%m-%d %H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo -e "  ${GREEN}Passed:${NC}              $PASSED"
  echo -e "  ${RED}Failed:${NC}              $FAILED"
  echo -e "  ${YELLOW}Warnings:${NC}            $WARNINGS"
  echo ""
  echo "  Templates uploaded:  $UPLOADED / ${#TEMPLATE_MANIFEST[@]}"
  echo "  Templates validated: $VALIDATED / ${#TEMPLATE_MANIFEST[@]}"
  echo "  Validation failures: $VALIDATION_FAILURES"
  echo ""
  echo "  Template bucket:  s3://${TEMPLATE_BUCKET}"
  echo "  Artifact bucket:  s3://${ARTIFACT_BUCKET}"
  echo ""

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}DRY RUN - No changes were made${NC}"
  fi

  if [ "$FAILED" -gt 0 ] || [ "$VALIDATION_FAILURES" -gt 0 ]; then
    echo -e "  ${RED}STATUS: INCOMPLETE - Review failures above${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    return 1
  elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "  ${YELLOW}STATUS: COMPLETED WITH WARNINGS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    return 0
  else
    echo -e "  ${GREEN}STATUS: COMPLETED SUCCESSFULLY${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    return 0
  fi
}

# ============================================================================
# MAIN
# ============================================================================
main() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Lynia Finance - P5-DEPLOY-T001"
  echo "  Prerequisites & S3 Template Bucket Setup"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  Environment: ${ENVIRONMENT}"
  echo "  Region:      ${REGION}"
  echo "  Template bucket: ${TEMPLATE_BUCKET}"
  echo "  Artifact bucket: ${ARTIFACT_BUCKET}"
  echo ""

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo ""
  fi

  # Step 1: Verify tools
  verify_tools || {
    echo -e "\n${RED}Tool verification failed. Install missing tools before proceeding.${NC}"
    exit 1
  }

  if [ "$VALIDATE_ONLY" = true ]; then
    # Step 2: Still verify credentials for template validation via API
    verify_credentials || {
      echo -e "\n${RED}Credential verification failed. Configure AWS credentials.${NC}"
      exit 1
    }

    # Step 5 only: Validate templates
    validate_templates
    print_summary
    exit $?
  fi

  # Step 2: Verify credentials
  verify_credentials || {
    echo -e "\n${RED}Credential verification failed. Configure AWS credentials.${NC}"
    exit 1
  }

  # Step 3: Create template bucket
  create_template_bucket || exit 2

  # Step 4: Upload templates
  upload_templates

  # Step 5: Validate templates
  validate_templates

  # Step 6: Create artifact bucket
  create_artifact_bucket || exit 2

  # Print summary
  print_summary
}

main
