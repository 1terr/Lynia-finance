#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - Production Deployment Validation Script
# ============================================================================
# Runs automated health checks and smoke tests after production deployment.
# Validates all infrastructure components are operational.
#
# Usage:
#   ./scripts/validate-production.sh
#   ./scripts/validate-production.sh --verbose
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# ============================================================================

set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="production"
REGION="us-east-1"
VERBOSE=false
PASSED=0
FAILED=0
WARNINGS=0

for arg in "$@"; do
  case $arg in
    --verbose) VERBOSE=true ;;
  esac
done

log() { echo -e "${BLUE}[CHECK]${NC} $1"; }
pass() { echo -e "${GREEN}  [PASS]${NC} $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${RED}  [FAIL]${NC} $1"; FAILED=$((FAILED + 1)); }
warn_check() { echo -e "${YELLOW}  [WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

# ============================================================================
# 1. CloudFormation Stack Checks
# ============================================================================
check_stacks() {
  log "Checking CloudFormation stacks..."

  local stacks=(
    "lynia-finance-prod"
  )

  local optional_stacks=(
    "${ENVIRONMENT}-lynia-vpc"
    "${ENVIRONMENT}-lynia-sqs"
    "${ENVIRONMENT}-lynia-monitoring"
    "${ENVIRONMENT}-lynia-db-pooling"
  )

  for stack in "${stacks[@]}"; do
    STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$stack" \
      --query "Stacks[0].StackStatus" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$STATUS" == *"COMPLETE"* && "$STATUS" != *"DELETE"* ]]; then
      pass "Stack $stack: $STATUS"
    elif [ "$STATUS" == "NOT_FOUND" ]; then
      fail "Stack $stack: NOT FOUND"
    else
      fail "Stack $stack: $STATUS"
    fi
  done

  for stack in "${optional_stacks[@]}"; do
    STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$stack" \
      --query "Stacks[0].StackStatus" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$STATUS" == *"COMPLETE"* && "$STATUS" != *"DELETE"* ]]; then
      pass "Stack $stack: $STATUS"
    elif [ "$STATUS" == "NOT_FOUND" ]; then
      warn_check "Stack $stack: NOT FOUND (optional)"
    else
      fail "Stack $stack: $STATUS"
    fi
  done
}

# ============================================================================
# 2. Lambda Function Checks
# ============================================================================
check_lambdas() {
  log "Checking Lambda functions..."

  local functions=(
    "${ENVIRONMENT}-lynia-scoring-service"
    "${ENVIRONMENT}-lynia-whatsapp-service"
    "${ENVIRONMENT}-lynia-kyc-service"
    "${ENVIRONMENT}-lynia-payment-service"
    "${ENVIRONMENT}-lynia-lock-service"
    "${ENVIRONMENT}-lynia-notification-service"
  )

  for func in "${functions[@]}"; do
    STATE=$(aws lambda get-function \
      --function-name "$func" \
      --query "Configuration.State" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [ "$STATE" == "Active" ]; then
      pass "Lambda $func: Active"

      # Check last update status
      if [ "$VERBOSE" = true ]; then
        LAST_UPDATE=$(aws lambda get-function \
          --function-name "$func" \
          --query "Configuration.LastUpdateStatus" \
          --output text \
          --region "$REGION" 2>/dev/null || echo "unknown")
        log "  Last update: $LAST_UPDATE"
      fi
    elif [ "$STATE" == "NOT_FOUND" ]; then
      fail "Lambda $func: NOT FOUND"
    else
      fail "Lambda $func: $STATE"
    fi
  done
}

# ============================================================================
# 3. API Gateway Check
# ============================================================================
check_api_gateway() {
  log "Checking API Gateway..."

  API_URL=$(aws cloudformation describe-stacks \
    --stack-name lynia-finance-prod \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "")

  if [ -z "$API_URL" ]; then
    fail "API Gateway URL not found in stack outputs"
    return
  fi

  pass "API Gateway URL: $API_URL"

  # Test API health endpoint
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 \
    "${API_URL}scoring/calculate" 2>/dev/null || echo "000")

  # 403 means API Gateway is working (auth required); 000 means unreachable
  if [ "$HTTP_CODE" == "000" ]; then
    fail "API Gateway unreachable"
  elif [ "$HTTP_CODE" == "403" ] || [ "$HTTP_CODE" == "401" ]; then
    pass "API Gateway responding (HTTP $HTTP_CODE - auth required)"
  elif [ "$HTTP_CODE" == "200" ]; then
    pass "API Gateway responding (HTTP 200)"
  else
    warn_check "API Gateway returned HTTP $HTTP_CODE"
  fi
}

# ============================================================================
# 4. Secrets Manager Check
# ============================================================================
check_secrets() {
  log "Checking Secrets Manager..."

  local secrets=(
    "${ENVIRONMENT}/lynia/supabase"
    "${ENVIRONMENT}/lynia/whatsapp"
    "${ENVIRONMENT}/lynia/smile-identity"
    "${ENVIRONMENT}/lynia/ecocash"
    "${ENVIRONMENT}/lynia/onemoney"
    "${ENVIRONMENT}/lynia/trustonic"
    "${ENVIRONMENT}/lynia/sms"
  )

  for secret in "${secrets[@]}"; do
    # Check secret exists (don't read the value)
    STATUS=$(aws secretsmanager describe-secret \
      --secret-id "$secret" \
      --query "Name" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [ "$STATUS" != "NOT_FOUND" ]; then
      pass "Secret $secret: exists"
    else
      fail "Secret $secret: NOT FOUND"
    fi
  done
}

# ============================================================================
# 5. SQS Queue Checks
# ============================================================================
check_queues() {
  log "Checking SQS queues..."

  local queues=(
    "${ENVIRONMENT}-lynia-notifications"
    "${ENVIRONMENT}-lynia-payment-callbacks"
    "${ENVIRONMENT}-lynia-kyc-processing"
    "${ENVIRONMENT}-lynia-device-locks"
    "${ENVIRONMENT}-lynia-credit-scoring"
  )

  for queue in "${queues[@]}"; do
    QUEUE_URL=$(aws sqs get-queue-url \
      --queue-name "$queue" \
      --query "QueueUrl" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [ "$QUEUE_URL" != "NOT_FOUND" ]; then
      pass "SQS $queue: available"

      # Check DLQ for stuck messages
      DLQ_URL=$(aws sqs get-queue-url \
        --queue-name "${queue}-dlq" \
        --query "QueueUrl" \
        --output text \
        --region "$REGION" 2>/dev/null || echo "")

      if [ -n "$DLQ_URL" ]; then
        DLQ_COUNT=$(aws sqs get-queue-attributes \
          --queue-url "$DLQ_URL" \
          --attribute-names ApproximateNumberOfMessages \
          --query "Attributes.ApproximateNumberOfMessages" \
          --output text \
          --region "$REGION" 2>/dev/null || echo "0")

        if [ "$DLQ_COUNT" -gt 0 ]; then
          warn_check "DLQ ${queue}-dlq has $DLQ_COUNT messages"
        else
          pass "DLQ ${queue}-dlq: empty"
        fi
      fi
    else
      fail "SQS $queue: NOT FOUND"
    fi
  done
}

# ============================================================================
# 6. CloudWatch Alarms Check
# ============================================================================
check_alarms() {
  log "Checking CloudWatch alarms..."

  ALARM_COUNT=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "${ENVIRONMENT}-lynia" \
    --query "length(MetricAlarms)" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "0")

  if [ "$ALARM_COUNT" -gt 0 ]; then
    pass "CloudWatch: $ALARM_COUNT alarms configured"

    # Check for alarms in ALARM state
    ALARMING=$(aws cloudwatch describe-alarms \
      --alarm-name-prefix "${ENVIRONMENT}-lynia" \
      --state-value ALARM \
      --query "MetricAlarms[].AlarmName" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "")

    if [ -n "$ALARMING" ]; then
      for alarm in $ALARMING; do
        warn_check "Alarm in ALARM state: $alarm"
      done
    else
      pass "No alarms in ALARM state"
    fi
  else
    warn_check "No CloudWatch alarms found for ${ENVIRONMENT}-lynia"
  fi
}

# ============================================================================
# 7. VPC and Networking Check
# ============================================================================
check_networking() {
  log "Checking VPC and networking..."

  VPC_ID=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-lynia-vpc" \
    --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "")

  if [ -n "$VPC_ID" ]; then
    pass "VPC: $VPC_ID"

    # Check NAT Gateways
    NAT_COUNT=$(aws ec2 describe-nat-gateways \
      --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
      --query "length(NatGateways)" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "0")

    if [ "$NAT_COUNT" -ge 2 ]; then
      pass "NAT Gateways: $NAT_COUNT (HA configuration)"
    elif [ "$NAT_COUNT" -eq 1 ]; then
      warn_check "NAT Gateways: 1 (single point of failure in production)"
    else
      fail "NAT Gateways: $NAT_COUNT (none available)"
    fi
  else
    warn_check "VPC stack not found (Lambda may not be in VPC)"
  fi
}

# ============================================================================
# 8. S3 Frontend Buckets Check
# ============================================================================
check_frontend() {
  log "Checking frontend S3 buckets..."

  local buckets=(
    "${ENVIRONMENT}-lynia-admin-portal"
    "${ENVIRONMENT}-lynia-distributor-dashboard"
  )

  for bucket in "${buckets[@]}"; do
    OBJECT_COUNT=$(aws s3 ls "s3://${bucket}/" --summarize --recursive \
      --region "$REGION" 2>/dev/null | \
      grep "Total Objects:" | awk '{print $3}' || echo "0")

    if [ "$OBJECT_COUNT" -gt 0 ]; then
      pass "S3 $bucket: $OBJECT_COUNT objects"
    else
      warn_check "S3 $bucket: empty or not found"
    fi
  done
}

# ============================================================================
# 9. WAF Check
# ============================================================================
check_waf() {
  log "Checking WAF configuration..."

  WAF_COUNT=$(aws wafv2 list-web-acls \
    --scope REGIONAL \
    --query "length(WebACLs[?contains(Name, '${ENVIRONMENT}-lynia')])" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "0")

  if [ "$WAF_COUNT" -gt 0 ]; then
    pass "WAF: $WAF_COUNT Web ACL(s) configured"
  else
    warn_check "WAF: No Web ACLs found for ${ENVIRONMENT}-lynia"
  fi
}

# ============================================================================
# Summary
# ============================================================================
print_summary() {
  echo ""
  echo "============================================"
  echo "  Production Validation Summary"
  echo "============================================"
  echo -e "  ${GREEN}Passed:${NC}   $PASSED"
  echo -e "  ${RED}Failed:${NC}   $FAILED"
  echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
  echo "============================================"
  echo ""

  if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}VALIDATION FAILED - $FAILED check(s) failed${NC}"
    echo "Review failed checks above and fix before considering deployment complete."
    return 1
  elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}VALIDATION PASSED WITH WARNINGS${NC}"
    echo "Review warnings above. Deployment is operational but may need attention."
    return 0
  else
    echo -e "${GREEN}ALL CHECKS PASSED${NC}"
    return 0
  fi
}

# ============================================================================
# Main
# ============================================================================
main() {
  echo ""
  echo "============================================"
  echo "  Lynia Finance - Production Validation"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "============================================"
  echo ""

  check_stacks
  echo ""
  check_lambdas
  echo ""
  check_api_gateway
  echo ""
  check_secrets
  echo ""
  check_queues
  echo ""
  check_alarms
  echo ""
  check_networking
  echo ""
  check_frontend
  echo ""
  check_waf

  print_summary
}

main
