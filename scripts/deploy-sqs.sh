#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T006: Deploy SQS Queues Stack
# ============================================================================
# Deploys 5 SQS queues with dead-letter queues for asynchronous processing:
#   1. Notifications        — 60s visibility, maxReceiveCount: 3
#   2. Payment Callbacks    — 120s visibility, maxReceiveCount: 5
#   3. KYC Processing       — 120s visibility, maxReceiveCount: 3
#   4. Device Locks         — 90s visibility, maxReceiveCount: 3
#   5. Credit Scoring       — 90s visibility, maxReceiveCount: 3
#
# All queues have long polling (ReceiveMessageWaitTimeSeconds: 20),
# 4-day message retention, and 14-day DLQ retention.
#
# Usage:
#   ./scripts/deploy-sqs.sh                        # Production deploy
#   ./scripts/deploy-sqs.sh --env staging           # Staging deploy
#   ./scripts/deploy-sqs.sh --env development       # Development deploy
#   ./scripts/deploy-sqs.sh --dry-run               # Validate without deploying
#   ./scripts/deploy-sqs.sh --verify-only           # Verify existing stack
#   ./scripts/deploy-sqs.sh --outputs               # Show stack outputs only
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
SQS_TEMPLATE="$PROJECT_ROOT/infrastructure/aws/sqs-queues.yaml"

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
STACK_NAME="${ENVIRONMENT}-lynia-sqs"

# Queue names
QUEUE_NAMES=(
  "${ENVIRONMENT}-lynia-notifications"
  "${ENVIRONMENT}-lynia-payment-callbacks"
  "${ENVIRONMENT}-lynia-kyc-processing"
  "${ENVIRONMENT}-lynia-device-locks"
  "${ENVIRONMENT}-lynia-credit-scoring"
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
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Lynia Finance — P5-DEPLOY-T006: Deploy SQS Queues Stack   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Environment:  ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Region:       ${YELLOW}${REGION}${NC}"
echo -e "  Stack Name:   ${YELLOW}${STACK_NAME}${NC}"
echo -e "  Template:     ${YELLOW}infrastructure/aws/sqs-queues.yaml${NC}"
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
if [[ -f "$SQS_TEMPLATE" ]]; then
  TEMPLATE_SIZE=$(wc -c < "$SQS_TEMPLATE" | tr -d ' ')
  pass "SQS template found ($TEMPLATE_SIZE bytes)"
else
  fail "SQS template not found at: $SQS_TEMPLATE"
  exit 1
fi

# Validate template with CloudFormation API
info "Validating template with CloudFormation API..."
if aws cloudformation validate-template \
    --template-body "file://$SQS_TEMPLATE" \
    --region "$REGION" &>/dev/null; then
  pass "Template passes CloudFormation validation"
else
  fail "Template failed CloudFormation validation"
  aws cloudformation validate-template \
    --template-body "file://$SQS_TEMPLATE" \
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
# Step 2: Deploy SQS Stack
# --------------------------------------------------------------------------
if [[ "$VERIFY_ONLY" != true ]]; then
  step "Step 2: Deploy SQS Stack"

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
    info "DRY RUN: Would deploy stack $STACK_NAME with template $SQS_TEMPLATE"
    info "DRY RUN: Parameters: Environment=$ENVIRONMENT"

    # Create and display changeset for dry run
    CHANGESET_NAME="dry-run-$(date +%s)"
    info "Creating changeset to preview changes..."
    if aws cloudformation create-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGESET_NAME" \
        --template-body "file://$SQS_TEMPLATE" \
        --parameter-overrides "ParameterKey=Environment,ParameterValue=$ENVIRONMENT" \
        --region "$REGION" 2>/dev/null; then

      sleep 5
      aws cloudformation describe-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGESET_NAME" \
        --query "Changes[].{Action:ResourceChange.Action,Resource:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType}" \
        --output table \
        --region "$REGION" 2>/dev/null || true

      # Clean up changeset
      aws cloudformation delete-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGESET_NAME" \
        --region "$REGION" 2>/dev/null || true
    fi

    info "DRY RUN complete — no resources were created"
  else
    info "Deploying SQS queues stack..."
    info "This typically takes 1-2 minutes"
    echo ""

    DEPLOY_START=$(date +%s)

    aws cloudformation deploy \
      --template-file "$SQS_TEMPLATE" \
      --stack-name "$STACK_NAME" \
      --parameter-overrides "Environment=$ENVIRONMENT" \
      --region "$REGION" \
      --no-fail-on-empty-changeset \
      --tags \
        "Environment=$ENVIRONMENT" \
        "Service=messaging" \
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
  NOTIF_QUEUE_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='NotificationQueueUrl'].OutputValue" --output text --region "$REGION")
  NOTIF_QUEUE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='NotificationQueueArn'].OutputValue" --output text --region "$REGION")
  PAYMENT_QUEUE_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PaymentCallbackQueueUrl'].OutputValue" --output text --region "$REGION")
  PAYMENT_QUEUE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PaymentCallbackQueueArn'].OutputValue" --output text --region "$REGION")
  KYC_QUEUE_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='KYCProcessingQueueUrl'].OutputValue" --output text --region "$REGION")
  KYC_QUEUE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='KYCProcessingQueueArn'].OutputValue" --output text --region "$REGION")
  DEVICE_QUEUE_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DeviceLockQueueUrl'].OutputValue" --output text --region "$REGION")
  DEVICE_QUEUE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DeviceLockQueueArn'].OutputValue" --output text --region "$REGION")
  SCORING_QUEUE_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='CreditScoringQueueUrl'].OutputValue" --output text --region "$REGION")
  SCORING_QUEUE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='CreditScoringQueueArn'].OutputValue" --output text --region "$REGION")

  echo -e "  ${CYAN}Key Values for Downstream Stacks (T010 SAM Deploy):${NC}"
  echo -e "    NOTIFICATION_QUEUE_URL  = ${GREEN}${NOTIF_QUEUE_URL}${NC}"
  echo -e "    NOTIFICATION_QUEUE_ARN  = ${GREEN}${NOTIF_QUEUE_ARN}${NC}"
  echo -e "    PAYMENT_QUEUE_URL       = ${GREEN}${PAYMENT_QUEUE_URL}${NC}"
  echo -e "    PAYMENT_QUEUE_ARN       = ${GREEN}${PAYMENT_QUEUE_ARN}${NC}"
  echo -e "    KYC_QUEUE_URL           = ${GREEN}${KYC_QUEUE_URL}${NC}"
  echo -e "    KYC_QUEUE_ARN           = ${GREEN}${KYC_QUEUE_ARN}${NC}"
  echo -e "    DEVICE_LOCK_QUEUE_URL   = ${GREEN}${DEVICE_QUEUE_URL}${NC}"
  echo -e "    DEVICE_LOCK_QUEUE_ARN   = ${GREEN}${DEVICE_QUEUE_ARN}${NC}"
  echo -e "    CREDIT_SCORING_QUEUE_URL= ${GREEN}${SCORING_QUEUE_URL}${NC}"
  echo -e "    CREDIT_SCORING_QUEUE_ARN= ${GREEN}${SCORING_QUEUE_ARN}${NC}"
  echo ""

  # Verify CloudFormation exports
  info "Verifying CloudFormation exports..."
  EXPORTS=$(aws cloudformation list-exports \
    --query "Exports[?starts_with(Name,'${ENVIRONMENT}-lynia-') && (contains(Name,'queue'))].{Name:Name,Value:Value}" \
    --output table \
    --region "$REGION" 2>/dev/null || echo "")
  if [[ -n "$EXPORTS" ]]; then
    echo "$EXPORTS"
    pass "CloudFormation exports available for cross-stack references"
  else
    warn "No SQS-related CloudFormation exports found"
  fi
fi

# --------------------------------------------------------------------------
# Step 4: Verify Queues
# --------------------------------------------------------------------------
step "Step 4: Verify Queue Resources"

if [[ "$DRY_RUN" == true && "$FINAL_STATUS" != "CREATE_COMPLETE" && "$FINAL_STATUS" != "UPDATE_COMPLETE" ]]; then
  info "Dry run — skipping resource verification (stack not deployed)"
else

  # 4a. Count all queues with our prefix
  info "Counting queues with prefix: ${ENVIRONMENT}-lynia..."
  QUEUE_LIST=$(aws sqs list-queues \
    --queue-name-prefix "${ENVIRONMENT}-lynia" \
    --query "QueueUrls" \
    --output json \
    --region "$REGION" 2>/dev/null || echo "[]")

  TOTAL_QUEUES=$(echo "$QUEUE_LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  if [[ "$TOTAL_QUEUES" -ge 10 ]]; then
    pass "Total queues: $TOTAL_QUEUES (5 main + 5 DLQ)"
  else
    fail "Total queues: $TOTAL_QUEUES (expected: 10)"
  fi

  # 4b. Verify each main queue exists and has correct attributes
  info "Verifying individual queue configurations..."

  # Define expected attributes: queue_name visibility_timeout max_receive_count
  declare -A EXPECTED_VISIBILITY=(
    ["${ENVIRONMENT}-lynia-notifications"]="60"
    ["${ENVIRONMENT}-lynia-payment-callbacks"]="120"
    ["${ENVIRONMENT}-lynia-kyc-processing"]="120"
    ["${ENVIRONMENT}-lynia-device-locks"]="90"
    ["${ENVIRONMENT}-lynia-credit-scoring"]="90"
  )

  declare -A EXPECTED_MAX_RECEIVE=(
    ["${ENVIRONMENT}-lynia-notifications"]="3"
    ["${ENVIRONMENT}-lynia-payment-callbacks"]="5"
    ["${ENVIRONMENT}-lynia-kyc-processing"]="3"
    ["${ENVIRONMENT}-lynia-device-locks"]="3"
    ["${ENVIRONMENT}-lynia-credit-scoring"]="3"
  )

  for QUEUE_NAME in "${QUEUE_NAMES[@]}"; do
    echo ""
    info "Checking queue: $QUEUE_NAME"

    # Get queue URL
    QUEUE_URL=$(aws sqs get-queue-url \
      --queue-name "$QUEUE_NAME" \
      --query "QueueUrl" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$QUEUE_URL" == "NOT_FOUND" ]]; then
      fail "Queue not found: $QUEUE_NAME"
      continue
    fi
    pass "Queue exists: $QUEUE_NAME"

    # Get queue attributes
    ATTRS=$(aws sqs get-queue-attributes \
      --queue-url "$QUEUE_URL" \
      --attribute-names All \
      --query "Attributes" \
      --output json \
      --region "$REGION" 2>/dev/null || echo "{}")

    # Verify ReceiveMessageWaitTimeSeconds (long polling)
    WAIT_TIME=$(echo "$ATTRS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ReceiveMessageWaitTimeSeconds','0'))" 2>/dev/null || echo "0")
    if [[ "$WAIT_TIME" == "20" ]]; then
      pass "  Long polling: ${WAIT_TIME}s"
    else
      fail "  Long polling: ${WAIT_TIME}s (expected: 20)"
    fi

    # Verify VisibilityTimeout
    VIS_TIMEOUT=$(echo "$ATTRS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('VisibilityTimeout','0'))" 2>/dev/null || echo "0")
    EXPECTED_VIS="${EXPECTED_VISIBILITY[$QUEUE_NAME]}"
    if [[ "$VIS_TIMEOUT" == "$EXPECTED_VIS" ]]; then
      pass "  Visibility timeout: ${VIS_TIMEOUT}s"
    else
      fail "  Visibility timeout: ${VIS_TIMEOUT}s (expected: ${EXPECTED_VIS})"
    fi

    # Verify MessageRetentionPeriod (4 days = 345600s)
    RETENTION=$(echo "$ATTRS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('MessageRetentionPeriod','0'))" 2>/dev/null || echo "0")
    if [[ "$RETENTION" == "345600" ]]; then
      pass "  Message retention: 4 days (345600s)"
    else
      fail "  Message retention: ${RETENTION}s (expected: 345600)"
    fi

    # Verify RedrivePolicy (maxReceiveCount)
    REDRIVE=$(echo "$ATTRS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('RedrivePolicy','{}'))" 2>/dev/null || echo "{}")
    MAX_RECEIVE=$(echo "$REDRIVE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('maxReceiveCount','0'))" 2>/dev/null || echo "0")
    EXPECTED_MAX="${EXPECTED_MAX_RECEIVE[$QUEUE_NAME]}"
    if [[ "$MAX_RECEIVE" == "$EXPECTED_MAX" ]]; then
      pass "  Redrive maxReceiveCount: $MAX_RECEIVE"
    else
      fail "  Redrive maxReceiveCount: $MAX_RECEIVE (expected: $EXPECTED_MAX)"
    fi

    # Verify DLQ target exists in redrive policy
    DLQ_ARN=$(echo "$REDRIVE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deadLetterTargetArn','NONE'))" 2>/dev/null || echo "NONE")
    if [[ "$DLQ_ARN" != "NONE" && "$DLQ_ARN" != "" ]]; then
      pass "  DLQ target: configured"
    else
      fail "  DLQ target: not configured"
    fi
  done

  # 4c. Verify DLQ queues exist
  echo ""
  info "Verifying dead-letter queues..."
  DLQ_COUNT=0
  for QUEUE_NAME in "${QUEUE_NAMES[@]}"; do
    DLQ_NAME="${QUEUE_NAME}-dlq"
    DLQ_URL=$(aws sqs get-queue-url \
      --queue-name "$DLQ_NAME" \
      --query "QueueUrl" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$DLQ_URL" != "NOT_FOUND" ]]; then
      pass "DLQ exists: $DLQ_NAME"
      DLQ_COUNT=$((DLQ_COUNT + 1))

      # Verify DLQ retention (14 days = 1209600s)
      DLQ_RETENTION=$(aws sqs get-queue-attributes \
        --queue-url "$DLQ_URL" \
        --attribute-names MessageRetentionPeriod \
        --query "Attributes.MessageRetentionPeriod" \
        --output text \
        --region "$REGION" 2>/dev/null || echo "0")
      if [[ "$DLQ_RETENTION" == "1209600" ]]; then
        pass "  DLQ retention: 14 days (1209600s)"
      else
        fail "  DLQ retention: ${DLQ_RETENTION}s (expected: 1209600)"
      fi
    else
      fail "DLQ not found: $DLQ_NAME"
    fi
  done

  if [[ "$DLQ_COUNT" -eq 5 ]]; then
    pass "All 5 DLQs verified"
  else
    fail "DLQ count: $DLQ_COUNT (expected: 5)"
  fi

  # 4d. Verify DLQ alarm exists
  echo ""
  info "Checking CloudWatch DLQ alarm..."
  ALARM_NAME="${ENVIRONMENT}-lynia-dlq-messages"
  ALARM_STATE=$(aws cloudwatch describe-alarms \
    --alarm-names "$ALARM_NAME" \
    --query "MetricAlarms[0].StateValue" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$ALARM_STATE" != "NOT_FOUND" && "$ALARM_STATE" != "None" ]]; then
    pass "DLQ alarm exists: $ALARM_NAME (state: $ALARM_STATE)"
  else
    fail "DLQ alarm not found: $ALARM_NAME"
  fi

  # 4e. Verify all DLQs are empty (no failed messages)
  echo ""
  info "Checking DLQs for messages (should be empty)..."
  for QUEUE_NAME in "${QUEUE_NAMES[@]}"; do
    DLQ_NAME="${QUEUE_NAME}-dlq"
    DLQ_URL=$(aws sqs get-queue-url \
      --queue-name "$DLQ_NAME" \
      --query "QueueUrl" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$DLQ_URL" != "NOT_FOUND" ]]; then
      MSG_COUNT=$(aws sqs get-queue-attributes \
        --queue-url "$DLQ_URL" \
        --attribute-names ApproximateNumberOfMessages \
        --query "Attributes.ApproximateNumberOfMessages" \
        --output text \
        --region "$REGION" 2>/dev/null || echo "0")

      if [[ "$MSG_COUNT" == "0" ]]; then
        pass "DLQ empty: $DLQ_NAME"
      else
        warn "DLQ has $MSG_COUNT message(s): $DLQ_NAME"
      fi
    fi
  done
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
echo -e "  ${CYAN}Queues:${NC}       5 main + 5 DLQ = 10 total"
echo -e "  ${CYAN}Timestamp:${NC}    $(timestamp)"
echo ""
echo -e "  ┌──────────────────────────────────────┐"
echo -e "  │  Checks Passed:  ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "  │  Checks Failed:  ${RED}${CHECKS_FAILED}${NC}"
echo -e "  │  Warnings:       ${YELLOW}${CHECKS_WARNED}${NC}"
echo -e "  └──────────────────────────────────────┘"
echo ""

echo -e "  ${CYAN}Queue Configuration Summary:${NC}"
echo -e "  ┌────────────────────────────┬─────────────┬───────────┬─────────────┐"
echo -e "  │ Queue                      │ Visibility  │ Retention │ Max Retries │"
echo -e "  ├────────────────────────────┼─────────────┼───────────┼─────────────┤"
echo -e "  │ notifications              │ 60s         │ 4 days    │ 3           │"
echo -e "  │ payment-callbacks          │ 120s        │ 4 days    │ ${YELLOW}5${NC}           │"
echo -e "  │ kyc-processing             │ 120s        │ 4 days    │ 3           │"
echo -e "  │ device-locks               │ 90s         │ 4 days    │ 3           │"
echo -e "  │ credit-scoring             │ 90s         │ 4 days    │ 3           │"
echo -e "  └────────────────────────────┴─────────────┴───────────┴─────────────┘"
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
  echo -e "  ${GREEN}ALL CHECKS PASSED — SQS queues stack deployed and verified successfully${NC}"
  echo ""

  echo -e "  ${YELLOW}Cost Impact: ~\$2-5/month (10 SQS queues, pay-per-use)${NC}"
  echo ""
  echo -e "  ${CYAN}Next Step:${NC} Deploy downstream stacks that depend on SQS exports:"
  echo -e "    - P5-DEPLOY-T010: SAM Lambda Deploy (uses queue ARNs for event source mappings)"
  echo ""
  exit 0
fi
