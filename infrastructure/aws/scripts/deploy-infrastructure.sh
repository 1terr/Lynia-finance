#!/usr/bin/env bash
# =================================================================
# Lynia Finance - Phase 5 Infrastructure Deployment
# =================================================================
# Deploys remaining P5-DEPLOY tasks after T001-T004 are complete.
#
# Already completed (prerequisites):
#   T001 - Prerequisites & S3 Template Bucket
#   T002 - VPC Stack
#   T003 - Cognito User Pool
#   T004 - RDS PostgreSQL
#
# This script handles:
#   T005 - S3 Storage Buckets
#   T006 - SQS Queues
#   T007 - Secrets Manager (needs RDS endpoint + credentials)
#   T008 - IAM Roles
#
# Usage:
#   ./deploy-infrastructure.sh [environment] [task]
#   ./deploy-infrastructure.sh production all      # Deploy T005-T008
#   ./deploy-infrastructure.sh production t005     # S3 Storage Buckets only
#   ./deploy-infrastructure.sh production t006     # SQS Queues only
#   ./deploy-infrastructure.sh production t007     # Secrets Manager only
#   ./deploy-infrastructure.sh production t008     # IAM Roles only
#   ./deploy-infrastructure.sh production layer1   # T005+T006+T008 in parallel
#   ./deploy-infrastructure.sh production status   # Show all stack statuses
# =================================================================

set -euo pipefail

ENVIRONMENT="${1:-production}"
TASK="${2:-all}"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_task()  { echo -e "\n${GREEN}============================================${NC}"; echo -e "${GREEN}  $1${NC}"; echo -e "${GREEN}============================================${NC}\n"; }

# Validate environment
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "development" ]]; then
  log_error "Invalid environment '$ENVIRONMENT'. Must be: development, staging, or production"
  exit 1
fi

# Helper: check stack status
stack_status() {
  local stack_name="$1"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].StackStatus" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "NOT_FOUND"
}

# Helper: get stack output value
stack_output() {
  local stack_name="$1"
  local output_key="$2"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
    --output text \
    --region "$REGION" 2>/dev/null || echo ""
}

# Helper: deploy a CloudFormation stack
deploy_stack() {
  local stack_name="$1"
  local template="$2"
  shift 2
  local params=("$@")

  local status
  status=$(stack_status "$stack_name")

  if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
    log_ok "Stack '$stack_name' already deployed (status: $status). Skipping."
    return 0
  fi

  if [[ "$status" == "ROLLBACK_COMPLETE" || "$status" == "CREATE_FAILED" ]]; then
    log_warn "Stack '$stack_name' in $status state. Deleting before re-deploy..."
    aws cloudformation delete-stack --stack-name "$stack_name" --region "$REGION"
    aws cloudformation wait stack-delete-complete --stack-name "$stack_name" --region "$REGION"
    log_ok "Deleted failed stack."
  fi

  log_info "Deploying stack: $stack_name"
  log_info "  Template: $template"

  local deploy_cmd=(
    aws cloudformation deploy
    --template-file "$template"
    --stack-name "$stack_name"
    --region "$REGION"
    --no-fail-on-empty-changeset
    --tags "Environment=$ENVIRONMENT" "Service=lynia-finance"
  )

  # Add CAPABILITY_NAMED_IAM if template creates IAM resources
  if grep -q "AWS::IAM" "$template" 2>/dev/null; then
    deploy_cmd+=(--capabilities CAPABILITY_NAMED_IAM)
  fi

  if [[ ${#params[@]} -gt 0 ]]; then
    deploy_cmd+=(--parameter-overrides "${params[@]}")
  fi

  if "${deploy_cmd[@]}"; then
    log_ok "Stack '$stack_name' deployed successfully."
  else
    log_error "Stack '$stack_name' deployment FAILED."
    log_error "Check: aws cloudformation describe-stack-events --stack-name $stack_name --region $REGION"
    return 1
  fi
}

# Helper: verify a prerequisite stack is deployed
require_stack() {
  local stack_name="$1"
  local task_id="$2"
  local status
  status=$(stack_status "$stack_name")
  if [[ "$status" != "CREATE_COMPLETE" && "$status" != "UPDATE_COMPLETE" ]]; then
    log_error "Required stack '$stack_name' not ready (status: $status)."
    log_error "Complete $task_id first."
    return 1
  fi
  log_ok "Prerequisite '$stack_name': $status"
}

# =================================================================
# T005: Deploy S3 Storage Buckets
# =================================================================
deploy_t005() {
  log_task "T005 - Deploy S3 Storage Buckets"
  require_stack "${ENVIRONMENT}-lynia-deployment-buckets" "T001" || return 1

  deploy_stack \
    "${ENVIRONMENT}-lynia-storage" \
    "${TEMPLATE_DIR}/storage-buckets.yaml" \
    "Environment=${ENVIRONMENT}"
}

# =================================================================
# T006: Deploy SQS Queues
# =================================================================
deploy_t006() {
  log_task "T006 - Deploy SQS Queues"
  require_stack "${ENVIRONMENT}-lynia-deployment-buckets" "T001" || return 1

  deploy_stack \
    "${ENVIRONMENT}-lynia-sqs" \
    "${TEMPLATE_DIR}/sqs-queues.yaml" \
    "Environment=${ENVIRONMENT}"
}

# =================================================================
# T007: Deploy Secrets Manager (depends on T004 RDS)
# =================================================================
deploy_t007() {
  log_task "T007 - Deploy Secrets Manager"
  require_stack "${ENVIRONMENT}-lynia-rds" "T004" || return 1

  # Get RDS endpoint from T004 stack outputs
  local db_endpoint
  db_endpoint=$(stack_output "${ENVIRONMENT}-lynia-rds" "DatabaseEndpoint")
  if [[ -z "$db_endpoint" ]]; then
    log_error "Could not retrieve RDS endpoint from stack outputs."
    return 1
  fi
  log_info "RDS endpoint: $db_endpoint"

  local db_port
  db_port=$(stack_output "${ENVIRONMENT}-lynia-rds" "DatabasePort")
  db_port="${db_port:-5432}"

  # Check if DB password is provided
  if [[ -z "${DB_PASSWORD:-}" ]]; then
    log_warn "DB_PASSWORD environment variable not set."
    log_info "Secrets Manager needs the RDS master password from T004 output."
    log_info ""
    log_info "Run with:"
    log_info "  DB_PASSWORD=<your-rds-password> ./deploy-infrastructure.sh $ENVIRONMENT t007"
    log_info ""
    log_info "Or deploy manually:"
    echo ""
    echo "  aws cloudformation deploy \\"
    echo "    --template-file ${TEMPLATE_DIR}/secrets-manager.yaml \\"
    echo "    --stack-name ${ENVIRONMENT}-lynia-secrets \\"
    echo "    --capabilities CAPABILITY_NAMED_IAM \\"
    echo "    --region ${REGION} \\"
    echo "    --parameter-overrides \\"
    echo "      Environment=${ENVIRONMENT} \\"
    echo "      DBHost=${db_endpoint} \\"
    echo "      DBPort=${db_port} \\"
    echo "      DBPassword=<RDS-password-from-T004> \\"
    echo "      WhatsAppPhoneNumberId=<value> \\"
    echo "      WhatsAppAccessToken=<value> \\"
    echo "      WhatsAppWebhookVerifyToken=<value> \\"
    echo "      SmilePartnerId=<value> \\"
    echo "      SmileApiKey=<value> \\"
    echo "      EcocashMerchantId=<value> \\"
    echo "      EcocashApiKey=<value> \\"
    echo "      OnemoneyMerchantId=<value> \\"
    echo "      OnemoneyApiKey=<value> \\"
    echo "      TrustonicApiKey=<value> \\"
    echo "      TrustonicApiSecret=<value> \\"
    echo "      SmsApiKey=<value>"
    echo ""
    return 1
  fi

  deploy_stack \
    "${ENVIRONMENT}-lynia-secrets" \
    "${TEMPLATE_DIR}/secrets-manager.yaml" \
    "Environment=${ENVIRONMENT}" \
    "DBHost=${db_endpoint}" \
    "DBPort=${db_port}" \
    "DBPassword=${DB_PASSWORD}" \
    "WhatsAppPhoneNumberId=${WHATSAPP_PHONE_NUMBER_ID:-}" \
    "WhatsAppAccessToken=${WHATSAPP_ACCESS_TOKEN:-}" \
    "WhatsAppWebhookVerifyToken=${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}" \
    "SmilePartnerId=${SMILE_PARTNER_ID:-}" \
    "SmileApiKey=${SMILE_API_KEY:-}" \
    "EcocashMerchantId=${ECOCASH_MERCHANT_ID:-}" \
    "EcocashApiKey=${ECOCASH_API_KEY:-}" \
    "OnemoneyMerchantId=${ONEMONEY_MERCHANT_ID:-}" \
    "OnemoneyApiKey=${ONEMONEY_API_KEY:-}" \
    "TrustonicApiKey=${TRUSTONIC_API_KEY:-}" \
    "TrustonicApiSecret=${TRUSTONIC_API_SECRET:-}" \
    "SmsApiKey=${SMS_API_KEY:-}"
}

# =================================================================
# T008: Deploy IAM Roles
# =================================================================
deploy_t008() {
  log_task "T008 - Deploy IAM Roles"
  require_stack "${ENVIRONMENT}-lynia-deployment-buckets" "T001" || return 1

  deploy_stack \
    "${ENVIRONMENT}-lynia-iam" \
    "${TEMPLATE_DIR}/iam-roles.yaml" \
    "Environment=${ENVIRONMENT}" \
    "ArtifactBucketName=lynia-finance-${ENVIRONMENT}-artifacts"
}

# =================================================================
# Layer 1: T005 + T006 + T008 in parallel (independent of each other)
# =================================================================
deploy_layer1() {
  log_task "Layer 1 - T005 + T006 + T008 (parallel)"

  local pids=()
  local labels=()

  deploy_t005 &
  pids+=($!); labels+=("T005-Storage")

  deploy_t006 &
  pids+=($!); labels+=("T006-SQS")

  deploy_t008 &
  pids+=($!); labels+=("T008-IAM")

  local failed=0
  for i in "${!pids[@]}"; do
    if ! wait "${pids[$i]}"; then
      log_error "${labels[$i]} FAILED"
      failed=$((failed + 1))
    else
      log_ok "${labels[$i]} completed"
    fi
  done

  if [[ $failed -gt 0 ]]; then
    log_error "$failed stack(s) failed in Layer 1."
    return 1
  fi
  log_ok "All Layer 1 stacks deployed."
}

# =================================================================
# Status: show all P5 stack statuses
# =================================================================
print_status() {
  echo ""
  echo "============================================"
  echo "  P5-DEPLOY STACK STATUS ($ENVIRONMENT)"
  echo "============================================"
  echo ""

  local -A task_stacks=(
    ["T001 Prerequisites"]="${ENVIRONMENT}-lynia-deployment-buckets"
    ["T002 VPC"]="${ENVIRONMENT}-lynia-vpc"
    ["T003 Cognito"]="${ENVIRONMENT}-lynia-cognito"
    ["T004 RDS"]="${ENVIRONMENT}-lynia-rds"
    ["T005 Storage"]="${ENVIRONMENT}-lynia-storage"
    ["T006 SQS"]="${ENVIRONMENT}-lynia-sqs"
    ["T007 Secrets"]="${ENVIRONMENT}-lynia-secrets"
    ["T008 IAM"]="${ENVIRONMENT}-lynia-iam"
    ["T012 X-Ray"]="${ENVIRONMENT}-lynia-xray"
  )

  # Print in order
  local ordered_tasks=(
    "T001 Prerequisites"
    "T002 VPC"
    "T003 Cognito"
    "T004 RDS"
    "T005 Storage"
    "T006 SQS"
    "T007 Secrets"
    "T008 IAM"
    "T012 X-Ray"
  )

  printf "  %-25s %-40s %s\n" "TASK" "STACK" "STATUS"
  printf "  %-25s %-40s %s\n" "-------------------------" "----------------------------------------" "-------------------"

  for task in "${ordered_tasks[@]}"; do
    local stack="${task_stacks[$task]}"
    local status
    status=$(stack_status "$stack")
    if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
      printf "  %-25s %-40s ${GREEN}%s${NC}\n" "$task" "$stack" "$status"
    elif [[ "$status" == "NOT_FOUND" ]]; then
      printf "  %-25s %-40s ${YELLOW}%s${NC}\n" "$task" "$stack" "NOT DEPLOYED"
    else
      printf "  %-25s %-40s ${RED}%s${NC}\n" "$task" "$stack" "$status"
    fi
  done
  echo ""
}

# =================================================================
# Main
# =================================================================

log_info "P5-DEPLOY Infrastructure Deployment"
log_info "Environment: $ENVIRONMENT | Region: $REGION | Task: $TASK"

case "$TASK" in
  t005)   deploy_t005 ;;
  t006)   deploy_t006 ;;
  t007)   deploy_t007 ;;
  t008)   deploy_t008 ;;
  layer1) deploy_layer1 ;;
  all)
    deploy_layer1
    deploy_t007
    ;;
  status) print_status; exit 0 ;;
  *)
    log_error "Unknown task '$TASK'"
    echo ""
    echo "Usage: $0 [environment] [task]"
    echo ""
    echo "Tasks:"
    echo "  t005    - Deploy S3 Storage Buckets"
    echo "  t006    - Deploy SQS Queues"
    echo "  t007    - Deploy Secrets Manager (needs DB_PASSWORD env var)"
    echo "  t008    - Deploy IAM Roles"
    echo "  layer1  - Deploy T005+T006+T008 in parallel"
    echo "  all     - Deploy layer1 then T007"
    echo "  status  - Show all stack statuses"
    exit 1
    ;;
esac

print_status

echo "Next steps:"
echo "  T009 - Run database migrations:  bash database/deploy-to-rds.sh"
echo "  T010 - SAM deploy:               sam build && sam deploy --config-env production"
echo "  T011 - API Gateway throttling"
echo "  T012 - WAF + CloudWatch monitoring"
echo "  T013 - DNS/SSL + custom domains"
