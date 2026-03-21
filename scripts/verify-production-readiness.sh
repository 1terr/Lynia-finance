#!/usr/bin/env bash
# ============================================================================
# Lynia Finance — Pre-Distributor-Onboarding Production Verification
# ============================================================================
# Verifies that migrations 054 (consolidate_inventory) and 055
# (distributor_transfer_confirmation) have been applied correctly, that
# database triggers are functional, and that Fineract GL accounts are
# fully configured.
#
# Run this AFTER deploying migrations 054+055 to production RDS and BEFORE
# onboarding the first distributor.
#
# Usage:
#   ./scripts/verify-production-readiness.sh <RDS_CONNECTION_STRING>
#   ./scripts/verify-production-readiness.sh --dry-run <RDS_CONNECTION_STRING>
#   ./scripts/verify-production-readiness.sh --dry-run   # prints SQL only
#
# Arguments:
#   $1 / $2  — PostgreSQL connection string (psql-compatible), e.g.:
#              "postgresql://user:pass@host:5432/lynia_production?sslmode=require"
#              Omit for --dry-run mode.
#
# Exit codes:
#   0 — All checks passed
#   1 — One or more checks failed
# ============================================================================

set -uo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Counters ─────────────────────────────────────────────────────────────────
PASSED=0
FAILED=0
TOTAL=0

# ── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=false
CONN_STRING=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      sed -n '2,/^# ====/{ /^# /s/^# //p }' "$0"
      exit 0
      ;;
    *)
      if [ -z "$CONN_STRING" ]; then
        CONN_STRING="$arg"
      fi
      ;;
  esac
done

if [ "$DRY_RUN" = false ] && [ -z "$CONN_STRING" ]; then
  echo -e "${RED}ERROR: RDS connection string required (or use --dry-run)${NC}"
  echo "Usage: $0 [--dry-run] <RDS_CONNECTION_STRING>"
  exit 1
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

# run_check NAME SQL EXPECTED_PATTERN
#   Executes SQL via psql and checks stdout against EXPECTED_PATTERN (grep -qE).
#   In --dry-run mode, prints the SQL instead.
run_check() {
  local name="$1"
  local sql="$2"
  local expected="$3"

  TOTAL=$((TOTAL + 1))

  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY-RUN] ${BOLD}${name}${NC}"
    echo "$sql"
    echo ""
    return
  fi

  local result
  result=$(psql "$CONN_STRING" -tAX -c "$sql" 2>&1)
  local rc=$?

  if [ $rc -ne 0 ]; then
    FAILED=$((FAILED + 1))
    echo -e "${RED}[FAIL]${NC} ${name}"
    echo "       psql error: ${result}"
    return
  fi

  if echo "$result" | grep -qE "$expected"; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}[PASS]${NC} ${name}"
  else
    FAILED=$((FAILED + 1))
    echo -e "${RED}[FAIL]${NC} ${name}"
    echo "       expected pattern: ${expected}"
    echo "       actual result:    ${result}"
  fi
}

# run_check_count NAME SQL MIN_COUNT
#   Checks that the query returns a number >= MIN_COUNT.
run_check_count() {
  local name="$1"
  local sql="$2"
  local min_count="$3"

  TOTAL=$((TOTAL + 1))

  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY-RUN] ${BOLD}${name}${NC}"
    echo "$sql"
    echo ""
    return
  fi

  local result
  result=$(psql "$CONN_STRING" -tAX -c "$sql" 2>&1)
  local rc=$?

  if [ $rc -ne 0 ]; then
    FAILED=$((FAILED + 1))
    echo -e "${RED}[FAIL]${NC} ${name}"
    echo "       psql error: ${result}"
    return
  fi

  result=$(echo "$result" | tr -d '[:space:]')

  if [ "$result" -ge "$min_count" ] 2>/dev/null; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}[PASS]${NC} ${name} (count: ${result})"
  else
    FAILED=$((FAILED + 1))
    echo -e "${RED}[FAIL]${NC} ${name}"
    echo "       expected >= ${min_count}, got: ${result}"
  fi
}

# run_transaction NAME SQL EXPECTED_PATTERN
#   Wraps SQL in a transaction that always ROLLBACKs. Used for destructive test checks.
run_transaction() {
  local name="$1"
  local sql="$2"
  local expected="$3"

  TOTAL=$((TOTAL + 1))

  if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}[DRY-RUN] ${BOLD}${name}${NC}"
    echo "$sql"
    echo ""
    return
  fi

  local result
  result=$(psql "$CONN_STRING" -tAX -c "$sql" 2>&1)
  local rc=$?

  if [ $rc -ne 0 ]; then
    FAILED=$((FAILED + 1))
    echo -e "${RED}[FAIL]${NC} ${name}"
    echo "       psql error: ${result}"
    return
  fi

  if echo "$result" | grep -qE "$expected"; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}[PASS]${NC} ${name}"
  else
    FAILED=$((FAILED + 1))
    echo -e "${RED}[FAIL]${NC} ${name}"
    echo "       expected pattern: ${expected}"
    echo "       actual result:    ${result}"
  fi
}

# ════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Lynia Finance — Production Readiness Verification          ║${NC}"
echo -e "${BOLD}║  Migrations 054 + 055 · Triggers · Fineract GL              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}── DRY-RUN MODE: printing SQL only, no database connection ──${NC}"
  echo ""
fi

# ════════════════════════════════════════════════════════════════════════════
# SECTION R1: Verify Migrations 054 + 055
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}${CYAN}── R1: Migration 054+055 Schema Verification ──${NC}"
echo ""

# --- 054: devices table columns ---
run_check \
  "R1.1  devices.distributor_id column exists" \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name = 'devices' AND column_name = 'distributor_id';" \
  "^distributor_id$"

run_check \
  "R1.2  devices.assigned_to_distributor_at column exists" \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name = 'devices' AND column_name = 'assigned_to_distributor_at';" \
  "^assigned_to_distributor_at$"

# --- 055: stock_transfers new columns ---
STOCK_TRANSFER_COLS=(
  transfer_type
  batch_id
  confirmed_by
  confirmed_at
  rejected_at
  rejection_reason
  force_confirmed_by
  force_confirmed_at
  force_confirm_reason
  initiated_by_type
  initiated_by_distributor
)

for col in "${STOCK_TRANSFER_COLS[@]}"; do
  run_check \
    "R1.3  stock_transfers.${col} column exists" \
    "SELECT column_name FROM information_schema.columns
     WHERE table_name = 'stock_transfers' AND column_name = '${col}';" \
    "^${col}$"
done

# --- 055: transfer_spot_checks table ---
SPOT_CHECK_COLS=(id transfer_id device_id imei_verified condition_rating verified_at verified_by created_at)

run_check \
  "R1.4  transfer_spot_checks table exists" \
  "SELECT table_name FROM information_schema.tables
   WHERE table_name = 'transfer_spot_checks';" \
  "^transfer_spot_checks$"

for col in "${SPOT_CHECK_COLS[@]}"; do
  run_check \
    "R1.5  transfer_spot_checks.${col} column exists" \
    "SELECT column_name FROM information_schema.columns
     WHERE table_name = 'transfer_spot_checks' AND column_name = '${col}';" \
    "^${col}$"
done

# --- 055: notifications table ---
NOTIFICATION_COLS=(id recipient_type recipient_id type title message reference_type reference_id read read_at created_at)

run_check \
  "R1.6  notifications table exists" \
  "SELECT table_name FROM information_schema.tables
   WHERE table_name = 'notifications';" \
  "^notifications$"

for col in "${NOTIFICATION_COLS[@]}"; do
  run_check \
    "R1.7  notifications.${col} column exists" \
    "SELECT column_name FROM information_schema.columns
     WHERE table_name = 'notifications' AND column_name = '${col}';" \
    "^${col}$"
done

# --- Indexes ---
REQUIRED_INDEXES=(
  idx_devices_distributor
  idx_transfers_pending_receipt
  idx_transfers_type
  idx_transfers_batch
  idx_spot_checks_transfer
  idx_notifications_recipient
  idx_notifications_created
)

echo ""
echo -e "${BOLD}${CYAN}── R1: Index Verification ──${NC}"
echo ""

for idx in "${REQUIRED_INDEXES[@]}"; do
  run_check \
    "R1.8  index ${idx} exists" \
    "SELECT indexname FROM pg_indexes
     WHERE indexname = '${idx}';" \
    "^${idx}$"
done

# ════════════════════════════════════════════════════════════════════════════
# SECTION R2: Verify Database Triggers
# ════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}── R2: Database Trigger Verification ──${NC}"
echo ""

# --- Functions exist ---
run_check \
  "R2.1  fn_sync_device_model_stock function exists" \
  "SELECT proname FROM pg_proc WHERE proname = 'fn_sync_device_model_stock';" \
  "^fn_sync_device_model_stock$"

run_check \
  "R2.2  fn_record_inventory_movement function exists" \
  "SELECT proname FROM pg_proc WHERE proname = 'fn_record_inventory_movement';" \
  "^fn_record_inventory_movement$"

# --- Triggers exist ---
run_check \
  "R2.3  trg_sync_device_model_stock trigger exists on devices" \
  "SELECT tgname FROM pg_trigger t
   JOIN pg_class c ON t.tgrelid = c.oid
   WHERE t.tgname = 'trg_sync_device_model_stock' AND c.relname = 'devices';" \
  "^trg_sync_device_model_stock$"

run_check \
  "R2.4  trg_record_inventory_movement trigger exists on devices" \
  "SELECT tgname FROM pg_trigger t
   JOIN pg_class c ON t.tgrelid = c.oid
   WHERE t.tgname = 'trg_record_inventory_movement' AND c.relname = 'devices';" \
  "^trg_record_inventory_movement$"

# --- Triggers are enabled (tgenabled = 'O' means Origin-firing, i.e. enabled) ---
run_check \
  "R2.5  trg_sync_device_model_stock is enabled" \
  "SELECT t.tgenabled FROM pg_trigger t
   JOIN pg_class c ON t.tgrelid = c.oid
   WHERE t.tgname = 'trg_sync_device_model_stock' AND c.relname = 'devices';" \
  "^O$"

run_check \
  "R2.6  trg_record_inventory_movement is enabled" \
  "SELECT t.tgenabled FROM pg_trigger t
   JOIN pg_class c ON t.tgrelid = c.oid
   WHERE t.tgname = 'trg_record_inventory_movement' AND c.relname = 'devices';" \
  "^O$"

# --- Trigger functional test (INSERT + verify side-effects, then ROLLBACK) ---
echo ""
echo -e "${BOLD}${CYAN}── R2: Trigger Functional Test (transactional, always rolls back) ──${NC}"
echo ""

TRIGGER_TEST_SQL="
DO \$\$
DECLARE
  v_model_id UUID;
  v_device_id UUID;
  v_stock_before INT;
  v_stock_after INT;
  v_movement_count INT;
BEGIN
  -- Pick an existing device_model to test with
  SELECT id, available_stock INTO v_model_id, v_stock_before
  FROM device_models
  LIMIT 1;

  IF v_model_id IS NULL THEN
    RAISE NOTICE 'SKIP: no device_models rows to test with';
    RETURN;
  END IF;

  -- Insert a test device (triggers should fire)
  INSERT INTO devices (id, imei, status, device_model_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'TEST_VERIFY_' || extract(epoch from now())::text,
    'in_stock',
    v_model_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_device_id;

  -- Check stock incremented
  SELECT available_stock INTO v_stock_after
  FROM device_models WHERE id = v_model_id;

  IF v_stock_after <> v_stock_before + 1 THEN
    RAISE EXCEPTION 'TRIGGER_FAIL:stock expected=% got=%', v_stock_before + 1, v_stock_after;
  END IF;

  -- Check inventory_movements got a new row
  SELECT count(*) INTO v_movement_count
  FROM inventory_movements
  WHERE device_id = v_device_id;

  IF v_movement_count < 1 THEN
    RAISE EXCEPTION 'TRIGGER_FAIL:movement expected>=1 got=%', v_movement_count;
  END IF;

  RAISE NOTICE 'TRIGGER_OK:stock %->% movement_count=%', v_stock_before, v_stock_after, v_movement_count;

  -- Always abort so no test data persists
  RAISE EXCEPTION 'ROLLBACK_SENTINEL';

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_SENTINEL' THEN
      RAISE NOTICE 'TRIGGER_TEST_PASSED';
    ELSIF SQLERRM LIKE 'TRIGGER_FAIL:%' THEN
      RAISE EXCEPTION '%', SQLERRM;
    ELSE
      RAISE;
    END IF;
END;
\$\$;
"

run_check \
  "R2.7  triggers fire correctly (insert device, verify stock+movement, rollback)" \
  "$TRIGGER_TEST_SQL" \
  "TRIGGER_TEST_PASSED"

# ════════════════════════════════════════════════════════════════════════════
# SECTION R3: Verify Fineract GL Account Configuration
# ════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}── R3: Fineract GL Account Configuration ──${NC}"
echo ""

# --- All required GL codes exist ---
REQUIRED_GL_CODES=(1410 1411 1412 1413 1420 1430 2410 4210 4220 4230 5210 5220)

for code in "${REQUIRED_GL_CODES[@]}"; do
  run_check \
    "R3.1  GL account ${code} exists in fineract_gl_account_config" \
    "SELECT gl_code FROM fineract_gl_account_config WHERE gl_code = '${code}';" \
    "^${code}$"
done

# --- All fineract_account_id values are NOT NULL ---
run_check_count \
  "R3.2  All required GL codes have fineract_account_id populated" \
  "SELECT count(*) FROM fineract_gl_account_config
   WHERE gl_code IN ('1410','1411','1412','1413','1420','1430','2410','4210','4220','4230','5210','5220')
     AND fineract_account_id IS NOT NULL;" \
  12

run_check \
  "R3.3  No required GL codes have NULL fineract_account_id" \
  "SELECT COALESCE(string_agg(gl_code, ','), 'NONE')
   FROM fineract_gl_account_config
   WHERE gl_code IN ('1410','1411','1412','1413','1420','1430','2410','4210','4220','4230','5210','5220')
     AND fineract_account_id IS NULL;" \
  "^NONE$"

# --- loan_products GL mapping columns populated ---
GL_MAPPING_COLS=(
  fund_source_account_id
  loan_portfolio_account_id
  transfers_in_suspense_account_id
  interest_on_loan_account_id
  income_from_fee_account_id
  income_from_penalty_account_id
  write_off_account_id
  overpayment_liability_account_id
  receivable_interest_account_id
  receivable_fee_account_id
  receivable_penalty_account_id
)

echo ""
echo -e "${BOLD}${CYAN}── R3: Loan Product GL Mapping ──${NC}"
echo ""

for col in "${GL_MAPPING_COLS[@]}"; do
  run_check \
    "R3.4  loan_products.${col} is populated (all products)" \
    "SELECT CASE WHEN count(*) = 0 THEN 'ALL_SET'
            ELSE count(*)::text || '_NULL' END
     FROM loan_products
     WHERE ${col} IS NULL AND fineract_product_id IS NOT NULL;" \
    "^ALL_SET$"
done

# --- fineract_product_id is NOT NULL ---
run_check \
  "R3.5  loan_products.fineract_product_id is NOT NULL for smartphone products" \
  "SELECT CASE WHEN count(*) = 0 THEN 'NONE_NULL'
          ELSE count(*)::text || '_NULL' END
   FROM loan_products
   WHERE product_category = 'smartphone' AND fineract_product_id IS NULL;" \
  "^NONE_NULL$"

run_check \
  "R3.6  loan_products.fineract_product_id is NOT NULL for digital products" \
  "SELECT CASE WHEN count(*) = 0 THEN 'NONE_NULL'
          ELSE count(*)::text || '_NULL' END
   FROM loan_products
   WHERE product_category = 'digital' AND fineract_product_id IS NULL;" \
  "^NONE_NULL$"

# ════════════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY-RUN complete. ${TOTAL} checks printed. No database connection made.${NC}"
  exit 0
fi

echo -e "${BOLD}Results:${NC}"
echo -e "  ${GREEN}PASSED: ${PASSED}${NC}"
echo -e "  ${RED}FAILED: ${FAILED}${NC}"
echo -e "  TOTAL:  $((PASSED + FAILED))"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}${BOLD}PRODUCTION NOT READY — ${FAILED} check(s) failed.${NC}"
  echo -e "${RED}Do NOT onboard distributors until all checks pass.${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}ALL CHECKS PASSED — production is ready for distributor onboarding.${NC}"
  exit 0
fi
