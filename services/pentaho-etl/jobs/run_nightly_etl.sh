#!/bin/bash
# =====================================================
# Lynia Finance - Nightly ETL Master Script
# Runs all data warehouse ETL transformations in order.
#
# This script is executed by ECS Scheduled Task at 02:00 UTC.
# It connects to PostgreSQL and runs each SQL transformation
# sequentially, logging results to dw.etl_job_log.
#
# Usage:
#   DB_HOST=xxx DB_PORT=5432 DB_NAME=lynia DB_USER=etl DB_PASSWORD=xxx ./run_nightly_etl.sh
#
# Or with AWS Secrets Manager (preferred in production):
#   DB_SECRET_NAME=production/lynia/database ./run_nightly_etl.sh
# =====================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRANSFORM_DIR="${SCRIPT_DIR}/../transformations"
LOG_PREFIX="[ETL $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

# Resolve database credentials
if [ -n "${DB_SECRET_NAME:-}" ]; then
  echo "${LOG_PREFIX} Resolving credentials from Secrets Manager: ${DB_SECRET_NAME}"
  SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "${DB_SECRET_NAME}" --query 'SecretString' --output text)
  DB_HOST=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['host'])")
  DB_PORT=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['port'])")
  DB_NAME=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['database'])")
  DB_USER=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['username'])")
  DB_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
fi

export PGHOST="${DB_HOST}"
export PGPORT="${DB_PORT:-5432}"
export PGDATABASE="${DB_NAME}"
export PGUSER="${DB_USER}"
export PGPASSWORD="${DB_PASSWORD}"

# Function to run a single ETL step and log result
run_etl_step() {
  local step_name="$1"
  local sql_file="$2"
  local step_type="${3:-fact_load}"
  local start_time=$(date +%s)

  echo "${LOG_PREFIX} Starting: ${step_name}"

  # Log start
  psql -q -c "INSERT INTO dw.etl_job_log (job_name, job_type, status, run_date) VALUES ('${step_name}', '${step_type}', 'running', CURRENT_DATE);"

  # Run the transformation
  if psql -q -f "${sql_file}" 2>/tmp/etl_error.log; then
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo "${LOG_PREFIX} Completed: ${step_name} (${duration}s)"

    psql -q -c "UPDATE dw.etl_job_log SET status = 'success', completed_at = NOW(), duration_seconds = ${duration} WHERE job_name = '${step_name}' AND run_date = CURRENT_DATE AND status = 'running';"
  else
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local error_msg=$(cat /tmp/etl_error.log | head -5 | tr "'" " ")
    echo "${LOG_PREFIX} FAILED: ${step_name} (${duration}s) - ${error_msg}"

    psql -q -c "UPDATE dw.etl_job_log SET status = 'failed', completed_at = NOW(), duration_seconds = ${duration}, error_message = '${error_msg}' WHERE job_name = '${step_name}' AND run_date = CURRENT_DATE AND status = 'running';"

    # Continue with other steps even if one fails
    return 1
  fi
}

echo "${LOG_PREFIX} ======================================"
echo "${LOG_PREFIX} Lynia Finance Nightly ETL Starting"
echo "${LOG_PREFIX} Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "${LOG_PREFIX} ======================================"

FAILURES=0

# Step 1: Load dimensions (customers, products, devices, geography)
run_etl_step "01_load_dimensions" "${TRANSFORM_DIR}/etl_dimensions.sql" "dimension_load" || ((FAILURES++))

# Step 2: Load fact loans (upsert all loans with current state)
run_etl_step "02_load_fact_loans" "${TRANSFORM_DIR}/etl_fact_loans.sql" "fact_load" || ((FAILURES++))

# Step 3: Load fact payments (insert new payments)
run_etl_step "03_load_fact_payments" "${TRANSFORM_DIR}/etl_fact_payments.sql" "fact_load" || ((FAILURES++))

# Step 4: Calculate daily portfolio snapshot (PAR, NPL, collections)
run_etl_step "04_portfolio_snapshot" "${TRANSFORM_DIR}/etl_portfolio_snapshot.sql" "aggregation" || ((FAILURES++))

# Step 5: Calculate vintage cohorts
run_etl_step "05_vintage_cohorts" "${TRANSFORM_DIR}/etl_vintage_cohorts.sql" "aggregation" || ((FAILURES++))

# Step 6: Calculate borrowing base
run_etl_step "06_borrowing_base" "${TRANSFORM_DIR}/etl_borrowing_base.sql" "report" || ((FAILURES++))

# Step 7: Calculate monthly financials (only meaningful after month-end)
run_etl_step "07_monthly_financials" "${TRANSFORM_DIR}/etl_monthly_financials.sql" "report" || ((FAILURES++))

# Step 8: Calculate roll rates
run_etl_step "08_roll_rates" "${TRANSFORM_DIR}/etl_roll_rates.sql" "aggregation" || ((FAILURES++))

echo "${LOG_PREFIX} ======================================"
if [ $FAILURES -eq 0 ]; then
  echo "${LOG_PREFIX} ETL completed successfully (0 failures)"
else
  echo "${LOG_PREFIX} ETL completed with ${FAILURES} failure(s)"
fi
echo "${LOG_PREFIX} ======================================"

exit $FAILURES
