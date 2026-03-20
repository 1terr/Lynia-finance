#!/usr/bin/env bash
# =============================================================================
# Fineract GL Account Setup for Digital Loans
# =============================================================================
#
# Creates GL accounts in Fineract for the digital loan product and updates
# the Lynia database with the returned Fineract account IDs.
#
# Prerequisites:
#   - Fineract instance running and accessible
#   - PostgreSQL database with migration 043 applied
#   - DIGI_LOAN_001 product exists in loan_products table
#
# Usage:
#   export FINERACT_BASE_URL="https://localhost:8443/fineract-provider/api/v1"
#   export FINERACT_USERNAME="mifos"
#   export FINERACT_PASSWORD="password"
#   export DATABASE_URL="postgresql://user:pass@host:5432/lynia"
#   bash scripts/fineract-setup-digital-gl.sh
#
# In production, resolve credentials from AWS Secrets Manager:
#   FINERACT_PASSWORD=$(aws secretsmanager get-secret-value \
#     --secret-id production/lynia/fineract --query SecretString --output text | jq -r .password)
#
# =============================================================================

set -euo pipefail

# ─── Configuration ───

FINERACT_BASE_URL="${FINERACT_BASE_URL:-https://localhost:8443/fineract-provider/api/v1}"
FINERACT_USERNAME="${FINERACT_USERNAME:-mifos}"
FINERACT_PASSWORD="${FINERACT_PASSWORD:?FINERACT_PASSWORD is required}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
TENANT_ID="${FINERACT_TENANT_ID:-default}"

# Fineract account type codes
# See: https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm#glaccounts
FINERACT_TYPE_ASSET=1
FINERACT_TYPE_LIABILITY=2
FINERACT_TYPE_EXPENSE=5
FINERACT_TYPE_INCOME=4

# ─── Helper Functions ───

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

fineract_auth() {
  echo -n "${FINERACT_USERNAME}:${FINERACT_PASSWORD}" | base64
}

# Map our account_type strings to Fineract integer codes
map_account_type() {
  case "$1" in
    ASSET)     echo $FINERACT_TYPE_ASSET ;;
    LIABILITY) echo $FINERACT_TYPE_LIABILITY ;;
    INCOME)    echo $FINERACT_TYPE_INCOME ;;
    EXPENSE)   echo $FINERACT_TYPE_EXPENSE ;;
    *)         echo "ERROR: Unknown account type: $1" >&2; exit 1 ;;
  esac
}

# Create a GL account in Fineract and return the new account ID
create_gl_account() {
  local gl_code="$1"
  local account_name="$2"
  local account_type="$3"
  local description="$4"

  local fineract_type
  fineract_type=$(map_account_type "$account_type")

  local payload
  payload=$(cat <<ENDJSON
{
  "name": "${account_name}",
  "glCode": "${gl_code}",
  "type": ${fineract_type},
  "usage": 1,
  "manualEntriesAllowed": true,
  "description": "${description}"
}
ENDJSON
)

  log "Creating GL account: ${gl_code} - ${account_name} (${account_type})"

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${FINERACT_BASE_URL}/glaccounts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(fineract_auth)" \
    -H "Fineract-Platform-TenantId: ${TENANT_ID}" \
    -d "${payload}")

  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -ne 200 ] && [ "$http_code" -ne 201 ]; then
    log "ERROR: Failed to create GL account ${gl_code}. HTTP ${http_code}: ${body}"
    return 1
  fi

  local account_id
  account_id=$(echo "$body" | jq -r '.resourceId // .subResourceId // empty')

  if [ -z "$account_id" ]; then
    log "ERROR: No resourceId in response for ${gl_code}: ${body}"
    return 1
  fi

  log "  Created: Fineract account ID = ${account_id}"
  echo "$account_id"
}

# ─── Step 1: Create GL Accounts in Fineract ───

log "=== Step 1: Creating GL accounts in Fineract ==="
log "Fineract URL: ${FINERACT_BASE_URL}"

# Declare associative array to store gl_code -> fineract_id mapping
declare -A GL_IDS

# Read GL accounts from the Lynia database config table
while IFS='|' read -r gl_code account_name account_type description; do
  # Trim whitespace
  gl_code=$(echo "$gl_code" | xargs)
  account_name=$(echo "$account_name" | xargs)
  account_type=$(echo "$account_type" | xargs)
  description=$(echo "$description" | xargs)

  fineract_id=$(create_gl_account "$gl_code" "$account_name" "$account_type" "$description")
  GL_IDS["$gl_code"]="$fineract_id"
done < <(psql "${DATABASE_URL}" -t -A -F'|' -c "
  SELECT gl_code, account_name, account_type, COALESCE(description, '')
  FROM fineract_gl_account_config
  WHERE product_category = 'digital' AND fineract_account_id IS NULL
  ORDER BY gl_code;
")

if [ ${#GL_IDS[@]} -eq 0 ]; then
  log "No GL accounts to create (all already have fineract_account_id set)."
  exit 0
fi

log "Created ${#GL_IDS[@]} GL accounts in Fineract."

# ─── Step 2: Update Lynia DB with Fineract Account IDs ───

log "=== Step 2: Updating fineract_gl_account_config with Fineract IDs ==="

for gl_code in "${!GL_IDS[@]}"; do
  fineract_id="${GL_IDS[$gl_code]}"
  psql "${DATABASE_URL}" -c "
    UPDATE fineract_gl_account_config
    SET fineract_account_id = ${fineract_id}
    WHERE gl_code = '${gl_code}';
  "
  log "  Updated ${gl_code} → fineract_account_id = ${fineract_id}"
done

# ─── Step 3: Update loan_products GL Account Mappings ───

log "=== Step 3: Updating DIGI_LOAN_001 product GL account mappings ==="

# Map GL codes to loan_products columns:
#   fund_source_account_id           → 1420 Mobile Money Float
#   loan_portfolio_account_id        → 1410 Digital Loans Receivable
#   transfers_in_suspense_account_id → 1430 Digital Transfers in Suspense
#   interest_on_loan_account_id      → 4210 Digital Loan Interest Income
#   income_from_fee_account_id       → 4220 Digital Loan Fee Income
#   income_from_penalty_account_id   → 4230 Digital Loan Penalty Income
#   write_off_account_id             → 5220 Digital Loan Write-offs
#   overpayment_liability_account_id → 2410 Digital Loan Overpayment Liability
#   receivable_interest_account_id   → 1411 Digital Loans Interest Receivable
#   receivable_fee_account_id        → 1412 Digital Loans Fee Receivable
#   receivable_penalty_account_id    → 1413 Digital Loans Penalty Receivable

psql "${DATABASE_URL}" -c "
  UPDATE loan_products SET
    fund_source_account_id           = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '1420'),
    loan_portfolio_account_id        = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '1410'),
    transfers_in_suspense_account_id = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '1430'),
    interest_on_loan_account_id      = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '4210'),
    income_from_fee_account_id       = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '4220'),
    income_from_penalty_account_id   = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '4230'),
    write_off_account_id             = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '5220'),
    overpayment_liability_account_id = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '2410'),
    receivable_interest_account_id   = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '1411'),
    receivable_fee_account_id        = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '1412'),
    receivable_penalty_account_id    = (SELECT fineract_account_id FROM fineract_gl_account_config WHERE gl_code = '1413')
  WHERE product_code = 'DIGI_LOAN_001';
"

log "=== Done! Digital loan GL accounts configured ==="
log ""
log "Summary:"
for gl_code in $(echo "${!GL_IDS[@]}" | tr ' ' '\n' | sort); do
  log "  ${gl_code} → Fineract ID ${GL_IDS[$gl_code]}"
done
log ""
log "Next steps:"
log "  1. Verify accounts in Fineract Admin UI → Accounting → Chart of Accounts"
log "  2. Create/update the loan product in Fineract with these GL mappings"
log "  3. Test a loan disbursement and verify journal entries"
