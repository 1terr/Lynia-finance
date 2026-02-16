#!/usr/bin/env bash
# ============================================================
# Fineract Credential Rotation Script
# Item 1 from Phase 8 deferred items
#
# Rotates the default Fineract admin credentials stored in
# AWS Secrets Manager and updates the Fineract instance.
# ============================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
REGION="${AWS_REGION:-us-east-1}"
SECRET_NAME="${ENVIRONMENT}/lynia/fineract-credentials"

echo "=== Fineract Credential Rotation ==="
echo "Environment: ${ENVIRONMENT}"
echo "Region:      ${REGION}"
echo "Secret:      ${SECRET_NAME}"
echo ""

# Generate new password (32 chars, alphanumeric + symbols)
NEW_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9!@#$%^&*' | head -c 32)
NEW_USERNAME="lynia-admin-${ENVIRONMENT}"

echo "[1/4] Retrieving current credentials..."
CURRENT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "${SECRET_NAME}" \
  --region "${REGION}" \
  --query SecretString \
  --output text 2>/dev/null || echo '{}')

FINERACT_URL=$(echo "${CURRENT_SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('base_url',''))" 2>/dev/null || echo "")
CURRENT_USER=$(echo "${CURRENT_SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('username','mifos'))" 2>/dev/null || echo "mifos")
CURRENT_PASS=$(echo "${CURRENT_SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('password','password'))" 2>/dev/null || echo "password")
TENANT_ID=$(echo "${CURRENT_SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tenant_id','default'))" 2>/dev/null || echo "default")

if [ -z "${FINERACT_URL}" ]; then
  echo "ERROR: Could not retrieve Fineract base_url from Secrets Manager."
  echo "Ensure the secret ${SECRET_NAME} exists with a 'base_url' field."
  exit 1
fi

echo "[2/4] Updating Fineract user password via API..."
# Fineract user update endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "${FINERACT_URL}/users/1" \
  -H "Authorization: Basic $(echo -n "${CURRENT_USER}:${CURRENT_PASS}" | base64)" \
  -H "Fineract-Platform-TenantId: ${TENANT_ID}" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${NEW_PASSWORD}\",\"repeatPassword\":\"${NEW_PASSWORD}\"}" \
  --insecure 2>/dev/null || echo "000")

if [ "${HTTP_STATUS}" != "200" ]; then
  echo "WARNING: Fineract API returned HTTP ${HTTP_STATUS}."
  echo "The password may not have been updated in Fineract."
  echo "Verify manually before proceeding."
  read -p "Continue updating Secrets Manager? (y/N): " CONFIRM
  if [ "${CONFIRM}" != "y" ] && [ "${CONFIRM}" != "Y" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "[3/4] Updating AWS Secrets Manager..."
NEW_SECRET_JSON=$(cat <<EOF
{
  "base_url": "${FINERACT_URL}",
  "username": "${NEW_USERNAME}",
  "password": "${NEW_PASSWORD}",
  "tenant_id": "${TENANT_ID}"
}
EOF
)

aws secretsmanager update-secret \
  --secret-id "${SECRET_NAME}" \
  --secret-string "${NEW_SECRET_JSON}" \
  --region "${REGION}"

echo "[4/4] Verifying new credentials..."
VERIFY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "${FINERACT_URL}/offices" \
  -H "Authorization: Basic $(echo -n "${NEW_USERNAME}:${NEW_PASSWORD}" | base64)" \
  -H "Fineract-Platform-TenantId: ${TENANT_ID}" \
  -H "Accept: application/json" \
  --insecure 2>/dev/null || echo "000")

if [ "${VERIFY_STATUS}" = "200" ]; then
  echo ""
  echo "SUCCESS: Credentials rotated and verified."
  echo "New username: ${NEW_USERNAME}"
  echo "Secret updated in: ${SECRET_NAME}"
else
  echo ""
  echo "WARNING: Verification returned HTTP ${VERIFY_STATUS}."
  echo "Lambda functions may need to be restarted to pick up new credentials."
fi

echo ""
echo "NOTE: Lambda functions cache credentials. Restart or wait for cold start."
echo "To force: aws lambda update-function-configuration --function-name <name> --environment 'Variables={FORCE_RESTART=$(date +%s)}'"