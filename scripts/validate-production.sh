#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - E2E Deployment Validation & Smoke Tests (T0017)
# ============================================================================
# Comprehensive validation of entire AWS infrastructure covering all 17+
# CloudFormation stacks, 6 Lambda functions, API Gateway, frontends,
# database connectivity, SQS queues, WAF, monitoring, and secrets.
#
# Usage:
#   ./scripts/validate-production.sh
#   ./scripts/validate-production.sh --env staging
#   ./scripts/validate-production.sh --verbose
#   ./scripts/validate-production.sh --env production --verbose
#
# Exit codes:
#   0 - All checks passed (or passed with warnings)
#   1 - One or more critical checks failed
# ============================================================================

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
    --env=*) ENVIRONMENT="${arg#*=}" ;;
    --help)
      echo "Usage: $0 [--env staging|production] [--verbose]"
      exit 0
      ;;
  esac
done

log() { echo -e "${BLUE}[CHECK]${NC} $1"; }
pass() { echo -e "${GREEN}  [PASS]${NC} $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${RED}  [FAIL]${NC} $1"; FAILED=$((FAILED + 1)); }
warn_check() { echo -e "${YELLOW}  [WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
section() { echo -e "\n${CYAN}--- $1 ---${NC}"; }

# Resolve SAM stack name
SAM_STACK="lynia-finance-dev"
[ "$ENVIRONMENT" = "staging" ] && SAM_STACK="lynia-finance-staging"
[ "$ENVIRONMENT" = "production" ] && SAM_STACK="lynia-finance-prod"

# ============================================================================
# 1. CloudFormation Stack Health
# ============================================================================
check_stacks() {
  section "1/10 CloudFormation Stack Health"

  local required_stacks=("$SAM_STACK")

  local infra_stacks=(
    "${ENVIRONMENT}-lynia-vpc"
    "${ENVIRONMENT}-lynia-cognito"
    "${ENVIRONMENT}-lynia-rds"
    "${ENVIRONMENT}-lynia-sqs"
    "${ENVIRONMENT}-lynia-secrets"
    "${ENVIRONMENT}-lynia-iam-roles"
    "${ENVIRONMENT}-lynia-storage"
    "${ENVIRONMENT}-lynia-api-throttling"
    "${ENVIRONMENT}-lynia-waf"
    "${ENVIRONMENT}-lynia-dns-ssl"
    "${ENVIRONMENT}-lynia-frontend"
    "${ENVIRONMENT}-lynia-monitoring"
    "${ENVIRONMENT}-lynia-log-retention"
    "${ENVIRONMENT}-lynia-autoscaling"
    "${ENVIRONMENT}-lynia-canary"
    "${ENVIRONMENT}-lynia-xray"
  )

  for stack in "${required_stacks[@]}"; do
    STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$stack" \
      --query "Stacks[0].StackStatus" \
      --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$STATUS" == *"COMPLETE"* && "$STATUS" != *"DELETE"* ]]; then
      pass "Stack $stack: $STATUS"
    elif [ "$STATUS" = "NOT_FOUND" ]; then
      fail "Stack $stack: NOT FOUND (required)"
    else
      fail "Stack $stack: $STATUS"
    fi
  done

  for stack in "${infra_stacks[@]}"; do
    STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$stack" \
      --query "Stacks[0].StackStatus" \
      --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [[ "$STATUS" == *"COMPLETE"* && "$STATUS" != *"DELETE"* ]]; then
      pass "Stack $stack: $STATUS"
    elif [ "$STATUS" = "NOT_FOUND" ]; then
      warn_check "Stack $stack: NOT FOUND (optional)"
    else
      fail "Stack $stack: $STATUS"
    fi
  done
}

# ============================================================================
# 2. Lambda Function Health
# ============================================================================
check_lambdas() {
  section "2/10 Lambda Function Health"

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
      --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [ "$STATE" = "Active" ]; then
      RUNTIME=$(aws lambda get-function \
        --function-name "$func" \
        --query "Configuration.Runtime" \
        --output text --region "$REGION" 2>/dev/null || echo "unknown")
      MEMORY=$(aws lambda get-function \
        --function-name "$func" \
        --query "Configuration.MemorySize" \
        --output text --region "$REGION" 2>/dev/null || echo "unknown")

      pass "Lambda $func: Active (${RUNTIME}, ${MEMORY}MB)"

      if [ "$VERBOSE" = true ]; then
        LAST_UPDATE=$(aws lambda get-function \
          --function-name "$func" \
          --query "Configuration.LastUpdateStatus" \
          --output text --region "$REGION" 2>/dev/null || echo "unknown")
        echo -e "         Last update: $LAST_UPDATE"
      fi
    elif [ "$STATE" = "NOT_FOUND" ]; then
      fail "Lambda $func: NOT FOUND"
    else
      fail "Lambda $func: $STATE"
    fi
  done
}

# ============================================================================
# 3. API Gateway Endpoints
# ============================================================================
check_api_gateway() {
  section "3/10 API Gateway Endpoints"

  API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$SAM_STACK" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text --region "$REGION" 2>/dev/null || echo "")

  if [ -z "$API_URL" ]; then
    fail "API Gateway URL not found in stack outputs"
    return
  fi

  pass "API Gateway URL: $API_URL"

  local endpoints=(
    "scoring/calculate:POST"
    "whatsapp/webhook:GET"
    "kyc/initiate:POST"
    "payments/process:POST"
    "locks/lock:POST"
    "notifications/send:POST"
  )

  for entry in "${endpoints[@]}"; do
    local path="${entry%%:*}"
    local method="${entry##*:}"

    if [ "$method" = "POST" ]; then
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 10 -X POST \
        -H "Content-Type: application/json" \
        -d '{}' \
        "${API_URL}${path}" 2>/dev/null || echo "000")
    else
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 10 \
        "${API_URL}${path}" 2>/dev/null || echo "000")
    fi

    if [ "$HTTP_CODE" = "000" ]; then
      fail "API ${path}: unreachable"
    elif [[ "$HTTP_CODE" =~ ^(200|401|403)$ ]]; then
      pass "API ${path}: HTTP $HTTP_CODE"
    elif [ "$HTTP_CODE" = "429" ]; then
      warn_check "API ${path}: HTTP 429 (rate limited)"
    else
      warn_check "API ${path}: HTTP $HTTP_CODE"
    fi
  done
}

# ============================================================================
# 4. Frontend Applications
# ============================================================================
check_frontend() {
  section "4/10 Frontend Applications"

  FRONTEND_STACK="${ENVIRONMENT}-lynia-frontend"

  ADMIN_URL=$(aws cloudformation describe-stacks \
    --stack-name "$FRONTEND_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='AdminPortalUrl'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")

  DIST_URL=$(aws cloudformation describe-stacks \
    --stack-name "$FRONTEND_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardUrl'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")

  for label_url in "Admin Portal|$ADMIN_URL" "Distributor Dashboard|$DIST_URL"; do
    local label="${label_url%%|*}"
    local url="${label_url#*|}"

    if [ -n "$url" ] && [ "$url" != "None" ]; then
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null || echo "000")
      if [[ "$HTTP_CODE" =~ ^(200|301|302)$ ]]; then
        pass "$label: HTTP $HTTP_CODE ($url)"
      else
        warn_check "$label: HTTP $HTTP_CODE"
      fi
    else
      warn_check "$label: URL not found in stack outputs"
    fi
  done

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
# 5. Database Connectivity
# ============================================================================
check_database() {
  section "5/10 Database Connectivity"

  RDS_STACK="${ENVIRONMENT}-lynia-rds"
  if aws cloudformation describe-stacks --stack-name "$RDS_STACK" --region "$REGION" &>/dev/null; then
    RDS_ENDPOINT=$(aws cloudformation describe-stacks \
      --stack-name "$RDS_STACK" \
      --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" \
      --output text --region "$REGION" 2>/dev/null || echo "")

    if [ -n "$RDS_ENDPOINT" ] && [ "$RDS_ENDPOINT" != "None" ]; then
      pass "RDS endpoint: $RDS_ENDPOINT"

      DB_STATUS=$(aws rds describe-db-instances \
        --query "DBInstances[?Endpoint.Address=='${RDS_ENDPOINT}'].DBInstanceStatus" \
        --output text --region "$REGION" 2>/dev/null || echo "unknown")

      if [ "$DB_STATUS" = "available" ]; then
        pass "RDS instance: available"
      else
        warn_check "RDS instance: $DB_STATUS"
      fi
    else
      warn_check "RDS endpoint not found in stack outputs"
    fi
  else
    warn_check "RDS stack not found"
  fi
}

# ============================================================================
# 6. SQS Queue Health
# ============================================================================
check_queues() {
  section "6/10 SQS Queue Health"

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
      --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [ "$QUEUE_URL" != "NOT_FOUND" ]; then
      pass "SQS $queue: available"

      DLQ_URL=$(aws sqs get-queue-url \
        --queue-name "${queue}-dlq" \
        --query "QueueUrl" \
        --output text --region "$REGION" 2>/dev/null || echo "")

      if [ -n "$DLQ_URL" ] && [ "$DLQ_URL" != "NOT_FOUND" ]; then
        DLQ_COUNT=$(aws sqs get-queue-attributes \
          --queue-url "$DLQ_URL" \
          --attribute-names ApproximateNumberOfMessages \
          --query "Attributes.ApproximateNumberOfMessages" \
          --output text --region "$REGION" 2>/dev/null || echo "0")

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
# 7. WAF Security Validation
# ============================================================================
check_waf() {
  section "7/10 WAF Security Validation"

  WAF_COUNT=$(aws wafv2 list-web-acls \
    --scope REGIONAL \
    --query "length(WebACLs[?contains(Name, '${ENVIRONMENT}-lynia')])" \
    --output text --region "$REGION" 2>/dev/null || echo "0")

  if [ "$WAF_COUNT" -gt 0 ]; then
    pass "WAF: $WAF_COUNT Web ACL(s) active"

    # SQL injection test
    if [ -n "${API_URL:-}" ]; then
      SQL_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 10 -X POST \
        -H "Content-Type: application/json" \
        -d '{"id": "1; DROP TABLE users;--"}' \
        "${API_URL}scoring/calculate" 2>/dev/null || echo "000")

      if [ "$SQL_CODE" = "403" ]; then
        pass "WAF SQL injection: blocked (HTTP 403)"
      elif [ "$SQL_CODE" = "000" ]; then
        warn_check "WAF SQL injection test: could not reach API"
      else
        warn_check "WAF SQL injection test: HTTP $SQL_CODE (expected 403)"
      fi

      # XSS test
      XSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 10 -X POST \
        -H "Content-Type: application/json" \
        -d '{"name": "<script>alert(1)</script>"}' \
        "${API_URL}scoring/calculate" 2>/dev/null || echo "000")

      if [ "$XSS_CODE" = "403" ]; then
        pass "WAF XSS prevention: blocked (HTTP 403)"
      elif [ "$XSS_CODE" = "000" ]; then
        warn_check "WAF XSS test: could not reach API"
      else
        warn_check "WAF XSS test: HTTP $XSS_CODE (expected 403)"
      fi
    fi
  else
    warn_check "WAF: No Web ACLs found"
  fi
}

# ============================================================================
# 8. CloudWatch Monitoring
# ============================================================================
check_monitoring() {
  section "8/10 CloudWatch Monitoring"

  ALARM_COUNT=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "${ENVIRONMENT}-lynia" \
    --query "length(MetricAlarms)" \
    --output text --region "$REGION" 2>/dev/null || echo "0")

  if [ "$ALARM_COUNT" -ge 20 ]; then
    pass "CloudWatch alarms: $ALARM_COUNT (>= 20)"
  elif [ "$ALARM_COUNT" -gt 0 ]; then
    warn_check "CloudWatch alarms: $ALARM_COUNT (expected >= 20)"
  else
    warn_check "No CloudWatch alarms found"
  fi

  ALARMING=$(aws cloudwatch describe-alarms \
    --alarm-name-prefix "${ENVIRONMENT}-lynia" \
    --state-value ALARM \
    --query "MetricAlarms[].AlarmName" \
    --output text --region "$REGION" 2>/dev/null || echo "")

  if [ -n "$ALARMING" ] && [ "$ALARMING" != "None" ]; then
    for alarm in $ALARMING; do
      warn_check "ALARM state: $alarm"
    done
  else
    pass "No alarms in ALARM state"
  fi

  DASHBOARD_COUNT=$(aws cloudwatch list-dashboards \
    --dashboard-name-prefix "${ENVIRONMENT}-lynia" \
    --query "length(DashboardEntries)" \
    --output text --region "$REGION" 2>/dev/null || echo "0")

  if [ "$DASHBOARD_COUNT" -ge 5 ]; then
    pass "CloudWatch dashboards: $DASHBOARD_COUNT"
  elif [ "$DASHBOARD_COUNT" -gt 0 ]; then
    warn_check "CloudWatch dashboards: $DASHBOARD_COUNT (expected >= 5)"
  else
    warn_check "No CloudWatch dashboards found"
  fi

  SNS_COUNT=$(aws sns list-topics \
    --query "length(Topics[?contains(TopicArn, '${ENVIRONMENT}-lynia')])" \
    --output text --region "$REGION" 2>/dev/null || echo "0")

  if [ "$SNS_COUNT" -ge 3 ]; then
    pass "SNS alert topics: $SNS_COUNT"
  else
    warn_check "SNS alert topics: $SNS_COUNT (expected >= 3)"
  fi
}

# ============================================================================
# 9. Secrets Manager
# ============================================================================
check_secrets() {
  section "9/10 Secrets Manager"

  local secrets=(
    "${ENVIRONMENT}/lynia/database"
    "${ENVIRONMENT}/lynia/whatsapp"
    "${ENVIRONMENT}/lynia/smile-identity"
    "${ENVIRONMENT}/lynia/ecocash"
    "${ENVIRONMENT}/lynia/onemoney"
    "${ENVIRONMENT}/lynia/trustonic"
    "${ENVIRONMENT}/lynia/sms"
  )

  for secret in "${secrets[@]}"; do
    STATUS=$(aws secretsmanager describe-secret \
      --secret-id "$secret" \
      --query "Name" \
      --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

    if [ "$STATUS" != "NOT_FOUND" ]; then
      pass "Secret $secret: present"
    else
      fail "Secret $secret: NOT FOUND"
    fi
  done
}

# ============================================================================
# 10. Provisioned Concurrency & VPC
# ============================================================================
check_provisioned_concurrency() {
  section "10/10 Provisioned Concurrency & Networking"

  local critical_services=("payment" "scoring" "whatsapp")
  for svc in "${critical_services[@]}"; do
    FUNC_NAME="${ENVIRONMENT}-lynia-${svc}-service"
    PC_STATUS=$(aws lambda get-provisioned-concurrency-config \
      --function-name "$FUNC_NAME" \
      --qualifier live \
      --query "Status" \
      --output text --region "$REGION" 2>/dev/null || echo "NOT_CONFIGURED")

    if [ "$PC_STATUS" = "READY" ]; then
      ALLOCATED=$(aws lambda get-provisioned-concurrency-config \
        --function-name "$FUNC_NAME" \
        --qualifier live \
        --query "AllocatedProvisionedConcurrentExecutions" \
        --output text --region "$REGION" 2>/dev/null || echo "0")
      pass "$FUNC_NAME provisioned concurrency: READY ($ALLOCATED)"
    elif [ "$PC_STATUS" = "IN_PROGRESS" ]; then
      warn_check "$FUNC_NAME provisioned concurrency: IN_PROGRESS"
    else
      warn_check "$FUNC_NAME provisioned concurrency: $PC_STATUS"
    fi
  done

  VPC_STACK="${ENVIRONMENT}-lynia-vpc"
  VPC_ID=$(aws cloudformation describe-stacks \
    --stack-name "$VPC_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")

  if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
    pass "VPC: $VPC_ID"

    NAT_COUNT=$(aws ec2 describe-nat-gateways \
      --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
      --query "length(NatGateways)" \
      --output text --region "$REGION" 2>/dev/null || echo "0")

    if [ "$NAT_COUNT" -ge 2 ]; then
      pass "NAT Gateways: $NAT_COUNT (HA)"
    elif [ "$NAT_COUNT" -eq 1 ]; then
      warn_check "NAT Gateways: 1 (single point of failure)"
    else
      fail "NAT Gateways: $NAT_COUNT"
    fi
  else
    warn_check "VPC not found"
  fi
}

# ============================================================================
# Summary
# ============================================================================
print_summary() {
  echo ""
  echo "============================================"
  echo "  Deployment Validation Summary"
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
  echo "  Lynia Finance - E2E Validation (T0017)"
  echo "  Environment: ${ENVIRONMENT}"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "============================================"

  check_stacks
  check_lambdas
  check_api_gateway
  check_frontend
  check_database
  check_queues
  check_waf
  check_monitoring
  check_secrets
  check_provisioned_concurrency

  print_summary
}

main
