#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T001: Prerequisites & S3 Template Bucket Setup
# ============================================================================
# Automates the complete T001 task:
#   1. Verify all required CLI tools are installed
#   2. Verify AWS credentials and target region
#   3. Deploy bootstrap CloudFormation stack (template + artifact S3 buckets)
#   4. Upload all infrastructure templates to S3
#   5. Validate all CloudFormation templates
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
BOOTSTRAP_STACK="${ENVIRONMENT}-lynia-deployment-buckets"
BOOTSTRAP_TEMPLATE="${PROJECT_ROOT}/infrastructure/aws/deployment-buckets.yaml"

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
  # Bootstrap (deployment buckets - deployed first via CloudFormation)
  "infrastructure/aws/deployment-buckets.yaml:deployment-buckets.yaml"
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
# STEP 3: Deploy Bootstrap Stack (Template + Artifact Buckets)
# ============================================================================
deploy_bootstrap_stack() {
  step "Step 3: Deploy Bootstrap Stack (Deployment Buckets)"

  log "Stack:           ${BOOTSTRAP_STACK}"
  log "Template bucket: s3://${TEMPLATE_BUCKET}"
  log "Artifact bucket: s3://${ARTIFACT_BUCKET}"

  if [ ! -f "$BOOTSTRAP_TEMPLATE" ]; then
    fail "Bootstrap template not found: $BOOTSTRAP_TEMPLATE"
    return 2
  fi

  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would deploy CloudFormation stack: ${BOOTSTRAP_STACK}"
    log "[DRY RUN] Template: ${BOOTSTRAP_TEMPLATE}"
    log "[DRY RUN] Creates: s3://${TEMPLATE_BUCKET}, s3://${ARTIFACT_BUCKET}"
    success "Bootstrap stack deployment simulated"
    return 0
  fi

  # Check if the CloudFormation stack already exists
  local stack_status
  stack_status=$(aws cloudformation describe-stacks \
    --stack-name "$BOOTSTRAP_STACK" \
    --region "$REGION" \
    --query "Stacks[0].StackStatus" \
    --output text 2>/dev/null) || stack_status="DOES_NOT_EXIST"

  if [ "$stack_status" = "DOES_NOT_EXIST" ]; then
    # Stack does not exist - check if buckets were created by the old imperative script
    local template_bucket_exists=false
    local artifact_bucket_exists=false

    if aws s3api head-bucket --bucket "$TEMPLATE_BUCKET" --region "$REGION" 2>/dev/null; then
      template_bucket_exists=true
    fi
    if aws s3api head-bucket --bucket "$ARTIFACT_BUCKET" --region "$REGION" 2>/dev/null; then
      artifact_bucket_exists=true
    fi

    if [ "$template_bucket_exists" = true ] && [ "$artifact_bucket_exists" = true ]; then
      # Both buckets exist from imperative creation - import them into CloudFormation
      log "Existing buckets detected. Importing into CloudFormation management..."
      import_existing_buckets || return 2
    elif [ "$template_bucket_exists" = false ] && [ "$artifact_bucket_exists" = false ]; then
      # Fresh environment - create everything via CloudFormation
      log "No existing buckets found. Creating via CloudFormation..."
      create_bootstrap_stack || return 2
    else
      # Partial state - one bucket exists, the other does not
      fail "Unexpected state: template_bucket=$template_bucket_exists, artifact_bucket=$artifact_bucket_exists"
      fail "Resolve manually: both buckets must exist or neither must exist."
      return 2
    fi
  else
    # Stack exists - update it
    log "Bootstrap stack exists (status: ${stack_status}). Updating..."
    update_bootstrap_stack || return 2
  fi

  # Verify stack outputs
  log "Verifying bootstrap stack outputs..."
  local outputs
  outputs=$(aws cloudformation describe-stacks \
    --stack-name "$BOOTSTRAP_STACK" \
    --region "$REGION" \
    --query "Stacks[0].Outputs" \
    --output table 2>/dev/null) || true

  if [ -n "$outputs" ]; then
    success "Bootstrap stack deployed successfully"
    echo "$outputs"
  else
    warn "Could not retrieve stack outputs"
  fi
}

# Import pre-existing buckets (created by old imperative script) into CloudFormation
import_existing_buckets() {
  log "Phase 1: Importing existing buckets into CloudFormation..."

  # Resource import requires a change set of type IMPORT.
  # The BucketPolicy is new (not pre-existing), so we import only the buckets first,
  # then run a normal update to add the policy.

  # Create import change set
  aws cloudformation create-change-set \
    --stack-name "$BOOTSTRAP_STACK" \
    --change-set-name "import-existing-buckets" \
    --change-set-type IMPORT \
    --template-body "file://${BOOTSTRAP_TEMPLATE}" \
    --parameters "ParameterKey=Environment,ParameterValue=${ENVIRONMENT}" \
    --resources-to-import "[
      {\"ResourceType\":\"AWS::S3::Bucket\",\"LogicalResourceId\":\"TemplateBucket\",\"ResourceIdentifier\":{\"BucketName\":\"${TEMPLATE_BUCKET}\"}},
      {\"ResourceType\":\"AWS::S3::Bucket\",\"LogicalResourceId\":\"ArtifactBucket\",\"ResourceIdentifier\":{\"BucketName\":\"${ARTIFACT_BUCKET}\"}}
    ]" \
    --region "$REGION" 2>&1

  if [ $? -ne 0 ]; then
    fail "Failed to create import change set"
    return 2
  fi

  # Wait for change set to be ready
  log "Waiting for import change set to be ready..."
  aws cloudformation wait change-set-create-complete \
    --stack-name "$BOOTSTRAP_STACK" \
    --change-set-name "import-existing-buckets" \
    --region "$REGION" 2>/dev/null || {
    fail "Import change set did not reach CREATE_COMPLETE"
    return 2
  }

  # Execute the import
  log "Executing resource import..."
  aws cloudformation execute-change-set \
    --stack-name "$BOOTSTRAP_STACK" \
    --change-set-name "import-existing-buckets" \
    --region "$REGION" 2>&1

  if [ $? -ne 0 ]; then
    fail "Failed to execute import change set"
    return 2
  fi

  # Wait for import to complete
  log "Waiting for import to complete (this may take a minute)..."
  aws cloudformation wait stack-import-complete \
    --stack-name "$BOOTSTRAP_STACK" \
    --region "$REGION" 2>/dev/null || {
    fail "Stack import did not complete successfully"
    return 2
  }

  success "Buckets imported into CloudFormation management"

  # Phase 2: Run a normal update to add the bucket policy and reconcile any drift
  log "Phase 2: Applying full template (adds bucket policy)..."
  update_bootstrap_stack
}

# Create the bootstrap stack from scratch (no pre-existing buckets)
create_bootstrap_stack() {
  aws cloudformation deploy \
    --stack-name "$BOOTSTRAP_STACK" \
    --template-file "$BOOTSTRAP_TEMPLATE" \
    --parameter-overrides "Environment=${ENVIRONMENT}" \
    --no-fail-on-empty-changeset \
    --tags "Environment=${ENVIRONMENT}" "Project=lynia-finance" "Purpose=bootstrap" \
    --region "$REGION" 2>&1

  if [ $? -eq 0 ]; then
    success "Bootstrap stack created: ${BOOTSTRAP_STACK}"
  else
    fail "Failed to create bootstrap stack"
    return 2
  fi
}

# Update an existing bootstrap stack
update_bootstrap_stack() {
  aws cloudformation deploy \
    --stack-name "$BOOTSTRAP_STACK" \
    --template-file "$BOOTSTRAP_TEMPLATE" \
    --parameter-overrides "Environment=${ENVIRONMENT}" \
    --no-fail-on-empty-changeset \
    --tags "Environment=${ENVIRONMENT}" "Project=lynia-finance" "Purpose=bootstrap" \
    --region "$REGION" 2>&1

  if [ $? -eq 0 ]; then
    success "Bootstrap stack updated: ${BOOTSTRAP_STACK}"
  else
    fail "Failed to update bootstrap stack"
    return 2
  fi
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
  echo "  Bootstrap stack:  ${BOOTSTRAP_STACK}"
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
  echo "  Environment:     ${ENVIRONMENT}"
  echo "  Region:          ${REGION}"
  echo "  Bootstrap stack: ${BOOTSTRAP_STACK}"
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

  # Step 3: Deploy bootstrap stack (creates both template + artifact buckets)
  deploy_bootstrap_stack || exit 2

  # Step 4: Upload templates
  upload_templates

  # Step 5: Validate templates
  validate_templates

  # Print summary
  print_summary
}

main
