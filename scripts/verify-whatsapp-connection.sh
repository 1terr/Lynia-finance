#!/bin/bash
# =============================================================================
# Lynia Finance - WhatsApp Business Number Connection Verifier
#
# Confirms that a given Phone Number ID resolves to the expected Lynia
# WhatsApp Business number (+263 71 925 2094) on Meta's side, and that
# the production deployment is ready to receive automated bot traffic.
#
# Run:
#   bash scripts/verify-whatsapp-connection.sh                    # production, defaults
#   ENVIRONMENT=staging bash scripts/verify-whatsapp-connection.sh
#
# Env vars (override to test other configs):
#   ENVIRONMENT              production | staging            (default: production)
#   EXPECTED_DISPLAY_NUMBER  target business number          (default: +263 71 925 2094)
#   PHONE_NUMBER_ID          override the Phone Number ID    (default: from SAM param)
#   WA_TOKEN                 Graph API access token          (default: from Secrets Manager)
#   SKIP_LIVE_CALL           1 = skip the live Lambda call   (default: 0)
#
# Exit codes:
#   0  all checks passed
#   1  Graph API says the number does NOT match
#   2  Lambda /whatsapp/health?deep=true did not return connected=true
#   3  AWS CLI / credentials / dependencies error
# =============================================================================

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-production}"
EXPECTED_DISPLAY_NUMBER="${EXPECTED_DISPLAY_NUMBER:-+263 71 925 2094}"
REGION="us-east-1"
STACK_NAME="lynia-finance-${ENVIRONMENT//production/prod}"

PASS=0
FAIL=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
info() { echo "  [INFO] $1"; }

echo "============================================="
echo " Lynia WhatsApp Connection Verifier"
echo " Environment:              ${ENVIRONMENT}"
echo " Expected display number:  ${EXPECTED_DISPLAY_NUMBER}"
echo " Stack:                    ${STACK_NAME}"
echo "============================================="

# ---------------------------------------------------------------------------
# 0. Dependencies
# ---------------------------------------------------------------------------
for dep in aws jq curl; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    echo "Required dependency missing: $dep" >&2
    exit 3
  fi
done

# ---------------------------------------------------------------------------
# 1. Normalise the expected number (strip non-digits)
# ---------------------------------------------------------------------------
EXPECTED_DIGITS=$(echo "$EXPECTED_DISPLAY_NUMBER" | tr -cd '0-9')
info "Expected digits: ${EXPECTED_DIGITS}"

# ---------------------------------------------------------------------------
# 2. Resolve Phone Number ID from SAM parameter (unless overridden)
# ---------------------------------------------------------------------------
if [ -z "${PHONE_NUMBER_ID:-}" ]; then
  info "Fetching Phone Number ID from CloudFormation parameters..."
  PHONE_NUMBER_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Parameters[?ParameterKey=='WhatsAppPhoneNumberId'].ParameterValue | [0]" \
    --output text 2>/dev/null || echo "")

  if [ -z "$PHONE_NUMBER_ID" ] || [ "$PHONE_NUMBER_ID" = "None" ] || [ "$PHONE_NUMBER_ID" = "placeholder" ]; then
    fail "Could not read WhatsAppPhoneNumberId from stack $STACK_NAME"
    echo "  -> Set PHONE_NUMBER_ID env var manually and re-run" >&2
    exit 3
  fi
fi
info "Phone Number ID: ${PHONE_NUMBER_ID}"

# ---------------------------------------------------------------------------
# 3. Resolve access token from Secrets Manager (unless overridden)
# ---------------------------------------------------------------------------
if [ -z "${WA_TOKEN:-}" ]; then
  info "Fetching WhatsApp access token from Secrets Manager..."
  SECRET_ID="lynia/${ENVIRONMENT}/whatsapp"
  WA_TOKEN=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ID" \
    --region "$REGION" \
    --query SecretString \
    --output text 2>/dev/null | jq -r '.accessToken // .access_token // empty' || echo "")

  if [ -z "$WA_TOKEN" ]; then
    fail "Could not read access token from secret $SECRET_ID"
    echo "  -> Set WA_TOKEN env var manually and re-run" >&2
    exit 3
  fi
fi

# ---------------------------------------------------------------------------
# 4. Call Graph API directly to read the display_phone_number
# ---------------------------------------------------------------------------
echo ""
echo "--- 1. Graph API metadata check ---"

GRAPH_RESPONSE=$(curl -sS \
  "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating,code_verification_status" \
  -H "Authorization: Bearer ${WA_TOKEN}" || echo "")

if [ -z "$GRAPH_RESPONSE" ]; then
  fail "Graph API request returned empty response"
  exit 1
fi

if echo "$GRAPH_RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
  fail "Graph API returned an error:"
  echo "$GRAPH_RESPONSE" | jq '.error'
  exit 1
fi

DISPLAY_NUMBER=$(echo "$GRAPH_RESPONSE" | jq -r '.display_phone_number // empty')
VERIFIED_NAME=$(echo "$GRAPH_RESPONSE" | jq -r '.verified_name // empty')
QUALITY=$(echo "$GRAPH_RESPONSE" | jq -r '.quality_rating // empty')
CODE_VERIFIED=$(echo "$GRAPH_RESPONSE" | jq -r '.code_verification_status // empty')

info "Meta reports: display_phone_number=${DISPLAY_NUMBER}"
info "Meta reports: verified_name=${VERIFIED_NAME}"
info "Meta reports: quality_rating=${QUALITY}"
info "Meta reports: code_verification_status=${CODE_VERIFIED}"

ACTUAL_DIGITS=$(echo "$DISPLAY_NUMBER" | tr -cd '0-9')

if [ "$ACTUAL_DIGITS" = "$EXPECTED_DIGITS" ]; then
  pass "display_phone_number matches expected business number"
else
  fail "display_phone_number mismatch"
  echo "  expected: $EXPECTED_DISPLAY_NUMBER ($EXPECTED_DIGITS)" >&2
  echo "  actual:   $DISPLAY_NUMBER ($ACTUAL_DIGITS)" >&2
  exit 1
fi

if [ "$QUALITY" != "GREEN" ]; then
  fail "quality_rating is $QUALITY (expected GREEN). Investigate in Meta Business Manager."
else
  pass "quality_rating is GREEN"
fi

if [ "$CODE_VERIFIED" != "VERIFIED" ]; then
  fail "code_verification_status is $CODE_VERIFIED (expected VERIFIED)"
else
  pass "code_verification_status is VERIFIED"
fi

# ---------------------------------------------------------------------------
# 5. Call the deployed Lambda health endpoint in deep mode
# ---------------------------------------------------------------------------
if [ "${SKIP_LIVE_CALL:-0}" = "1" ]; then
  echo ""
  info "SKIP_LIVE_CALL=1, skipping Lambda /whatsapp/health?deep=true check"
else
  echo ""
  echo "--- 2. Lambda deep health check ---"

  API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue | [0]" \
    --output text 2>/dev/null || echo "")

  if [ -z "$API_URL" ] || [ "$API_URL" = "None" ]; then
    fail "Could not read ApiGatewayUrl output from stack $STACK_NAME"
    exit 3
  fi

  # Strip any trailing slash so we don't get a double slash in the URL
  API_URL="${API_URL%/}"
  HEALTH_URL="${API_URL}/whatsapp/health?deep=true"
  info "Calling: ${HEALTH_URL}"

  HEALTH_RESPONSE=$(curl -sS "$HEALTH_URL" || echo "")

  if [ -z "$HEALTH_RESPONSE" ]; then
    fail "Lambda health endpoint returned empty response"
    exit 2
  fi

  CONNECTED=$(echo "$HEALTH_RESPONSE" | jq -r '.connection.connected // false')
  MATCHES=$(echo "$HEALTH_RESPONSE" | jq -r '.connection.matchesExpected // null')
  LAMBDA_DISPLAY=$(echo "$HEALTH_RESPONSE" | jq -r '.connection.displayPhoneNumber // empty')
  LAMBDA_ERROR=$(echo "$HEALTH_RESPONSE" | jq -r '.connection.error // empty')

  info "Lambda reports: connection.connected=${CONNECTED}"
  info "Lambda reports: connection.displayPhoneNumber=${LAMBDA_DISPLAY}"
  info "Lambda reports: connection.matchesExpected=${MATCHES}"

  if [ "$CONNECTED" = "true" ]; then
    pass "Lambda self-verified the WhatsApp connection"
  else
    fail "Lambda reports connected=false"
    [ -n "$LAMBDA_ERROR" ] && echo "  error: $LAMBDA_ERROR" >&2
    exit 2
  fi

  if [ "$MATCHES" = "true" ]; then
    pass "Lambda matchesExpected=true"
  elif [ "$MATCHES" = "null" ]; then
    info "WHATSAPP_EXPECTED_DISPLAY_NUMBER is not set on the Lambda (assertion skipped)"
  else
    fail "Lambda matchesExpected=false"
    exit 2
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo " Passed:  $PASS"
echo " Failed:  $FAIL"
echo "============================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo ""
echo "WhatsApp Business number connection verified."
echo "Clients clicking the landing-page WhatsApp button will reach:"
echo "  ${DISPLAY_NUMBER} (${VERIFIED_NAME})"
echo "and their messages will be handled automatically by the"
echo "${ENVIRONMENT}-lynia-whatsapp-service Lambda's onboarding bot."
