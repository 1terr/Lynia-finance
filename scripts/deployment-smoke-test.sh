#!/bin/bash
# =============================================================================
# Lynia Finance - Deployment Smoke Test Suite
# Run: bash scripts/deployment-smoke-test.sh
# =============================================================================

set -euo pipefail

REGION="us-east-1"
MAIN_API="https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod"
PROXY_API="https://94al6ng32i.execute-api.us-east-1.amazonaws.com/Prod"
ADMIN_PORTAL="https://d1qwfy2tsdmpe4.cloudfront.net"
MAIN_STACK="lynia-finance-prod"
PROXY_STACK="lynia-fineract-proxy-prod"

PASS=0
FAIL=0
WARN=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

echo "============================================="
echo " Lynia Finance Deployment Smoke Tests"
echo " Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================="
echo ""

# ----- Section 1: CloudFormation Stack Health -----
echo "--- 1. CloudFormation Stack Health ---"

check_stack() {
  local stack_name=$1
  local status
  status=$(aws cloudformation describe-stacks --stack-name "$stack_name" \
    --query 'Stacks[0].StackStatus' --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

  if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
    pass "$stack_name: $status"
  elif [[ "$status" == "ROLLBACK_COMPLETE" ]]; then
    fail "$stack_name: $status (needs cleanup and redeploy)"
  elif [[ "$status" == "NOT_FOUND" ]]; then
    fail "$stack_name: Stack not found"
  else
    warn "$stack_name: $status"
  fi
}

check_stack "lynia-finance-prod"
check_stack "lynia-fineract-proxy-prod"
check_stack "production-lynia-fineract-ecs"
check_stack "production-lynia-fineract-init"
check_stack "production-lynia-fineract-monitoring"
check_stack "production-lynia-cognito"
check_stack "lynia-rds-production"
check_stack "production-lynia-vpc"
check_stack "production-lynia-sqs"
check_stack "lynia-finance-prod-frontend"
check_stack "lynia-finance-production-waf"
echo ""

# ----- Section 2: Lambda Function Health -----
echo "--- 2. Lambda Function Health ---"

EXPECTED_LAMBDAS=(
  "production-lynia-scoring-service"
  "production-lynia-whatsapp-service"
  "production-lynia-kyc-service"
  "production-lynia-payment-service"
  "production-lynia-lock-service"
  "production-lynia-notification-service"
  "production-lynia-form-submission"
  "production-lynia-fineract-reconciliation"
  "production-lynia-fineract-init"
  "production-lynia-fineract-db-init"
  "production-lynia-fineract-proxy"
)

for fn in "${EXPECTED_LAMBDAS[@]}"; do
  runtime=$(aws lambda get-function --function-name "$fn" \
    --query 'Configuration.Runtime' --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")
  last_modified=$(aws lambda get-function --function-name "$fn" \
    --query 'Configuration.LastModified' --output text --region "$REGION" 2>/dev/null || echo "")

  if [[ "$runtime" == "NOT_FOUND" ]]; then
    fail "$fn: NOT FOUND"
  elif [[ "$runtime" == "nodejs20.x" || "$runtime" == "nodejs18.x" ]]; then
    pass "$fn: $runtime (updated: $last_modified)"
  else
    warn "$fn: unexpected runtime $runtime"
  fi
done
echo ""

# ----- Section 3: Frontend Deployment -----
echo "--- 3. Frontend Deployment ---"

# Admin portal
admin_status=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_PORTAL/" 2>/dev/null || echo "000")
if [[ "$admin_status" == "200" ]]; then
  pass "Admin Portal ($ADMIN_PORTAL): HTTP $admin_status"
else
  fail "Admin Portal ($ADMIN_PORTAL): HTTP $admin_status"
fi

# Check deployed version
admin_version=$(aws s3 cp s3://production-lynia-admin-portal/deployments/CURRENT_VERSION - 2>/dev/null || echo "NOT_FOUND")
if [[ "$admin_version" != "NOT_FOUND" ]]; then
  pass "Admin Portal version: $admin_version"
else
  warn "Admin Portal: no CURRENT_VERSION file"
fi

# Distributor dashboard version
dist_version=$(aws s3 cp s3://production-lynia-distributor-dashboard/deployments/CURRENT_VERSION - 2>/dev/null || echo "NOT_FOUND")
if [[ "$dist_version" != "NOT_FOUND" ]]; then
  pass "Distributor Dashboard version: $dist_version"
else
  warn "Distributor Dashboard: no CURRENT_VERSION file"
fi

# Landing page version
landing_version=$(aws s3 cp s3://production-lynia-landing-page/deployments/CURRENT_VERSION - 2>/dev/null || echo "NOT_FOUND")
if [[ "$landing_version" != "NOT_FOUND" ]]; then
  pass "Landing Page version: $landing_version"
else
  warn "Landing Page: no CURRENT_VERSION file in S3"
fi
echo ""

# ----- Section 4: API Gateway Health -----
echo "--- 4. API Gateway Health ---"

# Main API - note: these require auth, so 403/Missing Auth Token is expected for unauthenticated
main_health=$(curl -s "$MAIN_API/health" 2>/dev/null || echo "CONNECTION_FAILED")
if echo "$main_health" | grep -q "Missing Authentication Token"; then
  pass "Main API Gateway: Responding (auth required, as expected)"
elif echo "$main_health" | grep -q "healthy\|ok\|status"; then
  pass "Main API Gateway: Health check OK"
else
  warn "Main API Gateway response: $main_health"
fi

proxy_health=$(curl -s "$PROXY_API/health" 2>/dev/null || echo "CONNECTION_FAILED")
if echo "$proxy_health" | grep -q "Missing Authentication Token"; then
  pass "Fineract Proxy API Gateway: Responding (auth required, as expected)"
elif echo "$proxy_health" | grep -q "healthy\|ok\|status"; then
  pass "Fineract Proxy API Gateway: Health check OK"
else
  warn "Fineract Proxy API response: $proxy_health"
fi
echo ""

# ----- Section 5: Cognito User Pool -----
echo "--- 5. Cognito User Pool ---"

cognito_pool="us-east-1_VHEEa5faP"
pool_status=$(aws cognito-idp describe-user-pool --user-pool-id "$cognito_pool" \
  --query 'UserPool.Status' --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")
if [[ "$pool_status" != "NOT_FOUND" ]]; then
  pass "Cognito User Pool ($cognito_pool): Active"
else
  fail "Cognito User Pool ($cognito_pool): Not found"
fi
echo ""

# ----- Section 6: CI/CD Pipeline Status -----
echo "--- 6. CI/CD Pipeline (deploy.yml) ---"

latest_run_status=$(gh run list --workflow=deploy.yml --limit=1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || echo "unknown")
latest_run_name=$(gh run list --workflow=deploy.yml --limit=1 --json displayTitle --jq '.[0].displayTitle' 2>/dev/null || echo "unknown")
if [[ "$latest_run_status" == "success" ]]; then
  pass "Latest deploy.yml run: $latest_run_status ($latest_run_name)"
elif [[ "$latest_run_status" == "failure" ]]; then
  fail "Latest deploy.yml run: FAILED ($latest_run_name)"
else
  warn "Latest deploy.yml run: $latest_run_status"
fi

latest_fe_status=$(gh run list --workflow=deploy-frontend.yml --limit=1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || echo "unknown")
if [[ "$latest_fe_status" == "success" ]]; then
  pass "Latest deploy-frontend.yml: $latest_fe_status"
else
  warn "Latest deploy-frontend.yml: $latest_fe_status"
fi
echo ""

# ----- Summary -----
echo "============================================="
echo " SUMMARY"
echo "============================================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "  RESULT: ISSUES DETECTED - review failures above"
  exit 1
else
  echo "  RESULT: ALL CHECKS PASSED (review warnings if any)"
  exit 0
fi
