#!/usr/bin/env bash
# Deploy All Remaining Infrastructure Stacks for Lynia Finance
# Task: P5-DEPLOY - Full Infrastructure Deployment
# Prerequisites: VPC stack must already be deployed (production-lynia-vpc)
#
# Usage:
#   ./deploy-infrastructure.sh [environment] [phase]
#   ./deploy-infrastructure.sh production all       # Deploy all phases
#   ./deploy-infrastructure.sh production bootstrap  # Phase 0 only
#   ./deploy-infrastructure.sh production layer1     # Phase 1 only
#   ./deploy-infrastructure.sh production rds        # Phase 2 only
#   ./deploy-infrastructure.sh production secrets    # Phase 3 only

set -euo pipefail

ENVIRONMENT="${1:-production}"
PHASE="${2:-all}"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_phase() { echo -e "\n${GREEN}============================================${NC}"; echo -e "${GREEN}  PHASE: $1${NC}"; echo -e "${GREEN}============================================${NC}\n"; }

# Validate environment
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "development" ]]; then
  log_error "Invalid environment '$ENVIRONMENT'. Must be: development, staging, or production"
  exit 1
fi

# Helper: check if a stack exists and its status
stack_status() {
  local stack_name="$1"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].StackStatus" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "NOT_FOUND"
}

# Helper: deploy a stack and wait for completion
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
    log_warn "Stack '$stack_name' is in $status state. Deleting before re-deploy..."
    aws cloudformation delete-stack --stack-name "$stack_name" --region "$REGION"
    aws cloudformation wait stack-delete-complete --stack-name "$stack_name" --region "$REGION"
    log_ok "Deleted failed stack '$stack_name'."
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

  # Add capabilities if the template creates IAM resources
  if grep -q "AWS::IAM" "$template" 2>/dev/null; then
    deploy_cmd+=(--capabilities CAPABILITY_NAMED_IAM)
  fi

  # Add parameter overrides if provided
  if [[ ${#params[@]} -gt 0 ]]; then
    deploy_cmd+=(--parameter-overrides "${params[@]}")
  fi

  if "${deploy_cmd[@]}"; then
    log_ok "Stack '$stack_name' deployed successfully."
  else
    log_error "Stack '$stack_name' deployment FAILED."
    log_error "Check events: aws cloudformation describe-stack-events --stack-name $stack_name --region $REGION"
    return 1
  fi
}

# ============================================================
# PHASE 0: Bootstrap - Deployment Buckets
# ============================================================
deploy_bootstrap() {
  log_phase "0 - BOOTSTRAP (Deployment Buckets)"

  deploy_stack \
    "${ENVIRONMENT}-lynia-deployment-buckets" \
    "${TEMPLATE_DIR}/deployment-buckets.yaml" \
    "Environment=${ENVIRONMENT}"

  # Export artifact bucket name for IAM roles
  ARTIFACT_BUCKET="lynia-finance-${ENVIRONMENT}-artifacts"
  log_info "Artifact bucket: $ARTIFACT_BUCKET"
}

# ============================================================
# PHASE 1: Layer 1 - Independent stacks (no VPC dependency)
# ============================================================
deploy_layer1() {
  log_phase "1 - LAYER 1 (Independent Stacks - Parallel)"

  log_info "Deploying 5 independent stacks in parallel..."

  # Run all 5 deployments in parallel using background processes
  local pids=()

  # 1a. IAM Roles
  (
    deploy_stack \
      "${ENVIRONMENT}-lynia-iam" \
      "${TEMPLATE_DIR}/iam-roles.yaml" \
      "Environment=${ENVIRONMENT}" \
      "ArtifactBucketName=lynia-finance-${ENVIRONMENT}-artifacts"
  ) &
  pids+=($!)

  # 1b. SQS Queues
  (
    deploy_stack \
      "${ENVIRONMENT}-lynia-sqs" \
      "${TEMPLATE_DIR}/sqs-queues.yaml" \
      "Environment=${ENVIRONMENT}"
  ) &
  pids+=($!)

  # 1c. Storage Buckets
  (
    deploy_stack \
      "${ENVIRONMENT}-lynia-storage" \
      "${TEMPLATE_DIR}/storage-buckets.yaml" \
      "Environment=${ENVIRONMENT}"
  ) &
  pids+=($!)

  # 1d. X-Ray Tracing
  (
    deploy_stack \
      "${ENVIRONMENT}-lynia-xray" \
      "${TEMPLATE_DIR}/xray-tracing.yaml" \
      "Environment=${ENVIRONMENT}"
  ) &
  pids+=($!)

  # 1e. Cognito
  (
    deploy_stack \
      "${ENVIRONMENT}-lynia-cognito" \
      "${TEMPLATE_DIR}/cognito.yaml" \
      "Environment=${ENVIRONMENT}"
  ) &
  pids+=($!)

  # Wait for all parallel deployments
  local failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      failed=$((failed + 1))
    fi
  done

  if [[ $failed -gt 0 ]]; then
    log_error "$failed stack(s) failed in Layer 1. Check output above."
    return 1
  fi

  log_ok "All Layer 1 stacks deployed successfully."
}

# ============================================================
# PHASE 2: RDS Database (depends on VPC)
# ============================================================
deploy_rds() {
  log_phase "2 - RDS DATABASE (depends on VPC)"

  # Verify VPC stack is ready
  local vpc_status
  vpc_status=$(stack_status "${ENVIRONMENT}-lynia-vpc")
  if [[ "$vpc_status" != "CREATE_COMPLETE" && "$vpc_status" != "UPDATE_COMPLETE" ]]; then
    log_error "VPC stack not ready (status: $vpc_status). Deploy VPC first."
    return 1
  fi
  log_ok "VPC stack verified: $vpc_status"

  # Use the existing RDS deploy script
  log_info "Delegating to deploy-rds.sh..."
  bash "${SCRIPT_DIR}/deploy-rds.sh" "$ENVIRONMENT"
}

# ============================================================
# PHASE 3: Secrets Manager (depends on RDS)
# ============================================================
deploy_secrets() {
  log_phase "3 - SECRETS MANAGER (depends on RDS)"

  # Verify RDS stack is ready
  local rds_status
  rds_status=$(stack_status "${ENVIRONMENT}-lynia-rds")
  if [[ "$rds_status" != "CREATE_COMPLETE" && "$rds_status" != "UPDATE_COMPLETE" ]]; then
    log_error "RDS stack not ready (status: $rds_status). Deploy RDS first (Phase 2)."
    return 1
  fi
  log_ok "RDS stack verified: $rds_status"

  log_warn "Secrets Manager requires manual parameter input for sensitive values."
  log_info "Run the following command with your actual secrets:"
  echo ""
  echo "  aws cloudformation deploy \\"
  echo "    --template-file ${TEMPLATE_DIR}/secrets-manager.yaml \\"
  echo "    --stack-name ${ENVIRONMENT}-lynia-secrets \\"
  echo "    --region ${REGION} \\"
  echo "    --parameter-overrides \\"
  echo "      Environment=${ENVIRONMENT} \\"
  echo "      SupabaseUrl=<your-supabase-url> \\"
  echo "      SupabaseServiceRoleKey=<your-service-role-key> \\"
  echo "      SupabaseAnonKey=<your-anon-key> \\"
  echo "      WhatsAppApiToken=<your-whatsapp-token> \\"
  echo "      SmileIdentityApiKey=<your-smile-api-key> \\"
  echo "      SmileIdentityPartnerId=<your-partner-id>"
  echo ""
  log_info "After deploying Secrets Manager, proceed to SAM deploy for Lambda functions."
}

# ============================================================
# Summary
# ============================================================
print_summary() {
  echo ""
  echo "============================================"
  echo "  DEPLOYMENT SUMMARY"
  echo "============================================"
  echo ""

  local stacks=(
    "${ENVIRONMENT}-lynia-vpc"
    "${ENVIRONMENT}-lynia-deployment-buckets"
    "${ENVIRONMENT}-lynia-iam"
    "${ENVIRONMENT}-lynia-sqs"
    "${ENVIRONMENT}-lynia-storage"
    "${ENVIRONMENT}-lynia-xray"
    "${ENVIRONMENT}-lynia-cognito"
    "${ENVIRONMENT}-lynia-rds"
    "${ENVIRONMENT}-lynia-secrets"
  )

  printf "  %-40s %s\n" "STACK" "STATUS"
  printf "  %-40s %s\n" "----------------------------------------" "-------------------"
  for stack in "${stacks[@]}"; do
    local status
    status=$(stack_status "$stack")
    if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
      printf "  %-40s ${GREEN}%s${NC}\n" "$stack" "$status"
    elif [[ "$status" == "NOT_FOUND" ]]; then
      printf "  %-40s ${YELLOW}%s${NC}\n" "$stack" "NOT DEPLOYED"
    else
      printf "  %-40s ${RED}%s${NC}\n" "$stack" "$status"
    fi
  done
  echo ""
}

# ============================================================
# Main execution
# ============================================================

log_info "Environment: $ENVIRONMENT"
log_info "Phase: $PHASE"
log_info "Region: $REGION"

case "$PHASE" in
  bootstrap)
    deploy_bootstrap
    ;;
  layer1)
    deploy_layer1
    ;;
  rds)
    deploy_rds
    ;;
  secrets)
    deploy_secrets
    ;;
  all)
    deploy_bootstrap
    deploy_layer1
    deploy_rds
    deploy_secrets
    ;;
  status)
    print_summary
    ;;
  *)
    log_error "Unknown phase '$PHASE'. Use: bootstrap, layer1, rds, secrets, all, or status"
    exit 1
    ;;
esac

print_summary

log_info "Next steps after all stacks are deployed:"
log_info "  1. sam build --config-env production --cached --parallel"
log_info "  2. sam deploy --config-env production"
log_info "  3. Deploy DNS/SSL, WAF, and frontend stacks"
