#!/usr/bin/env bash
# =====================================================
# Lynia Finance - Phase 6: Fineract Database Initialization
#
# Creates the fineract_tenants and fineract_default databases
# on the existing RDS PostgreSQL instance, along with a
# dedicated fineract_admin user.
#
# Usage:
#   export RDS_ENDPOINT="your-rds-endpoint.rds.amazonaws.com"
#   export DB_ADMIN_USER="lynia_admin"
#   export DB_ADMIN_PASSWORD="..."
#   export FINERACT_DB_PASSWORD="..."
#   bash phase-6-fineract-integration/infrastructure/fineract-db-init.sh
#
# Prerequisites:
#   - psql client installed
#   - Network access to RDS (run from bastion or VPN)
# =====================================================

set -euo pipefail

# Configuration
RDS_HOST="${RDS_ENDPOINT:?RDS_ENDPOINT must be set}"
RDS_PORT="${RDS_PORT:-5432}"
ADMIN_USER="${DB_ADMIN_USER:?DB_ADMIN_USER must be set}"
ADMIN_PASS="${DB_ADMIN_PASSWORD:?DB_ADMIN_PASSWORD must be set}"
FINERACT_USER="${FINERACT_DB_USER:-fineract_admin}"
FINERACT_PASS="${FINERACT_DB_PASSWORD:?FINERACT_DB_PASSWORD must be set}"

export PGPASSWORD="$ADMIN_PASS"

echo "============================================="
echo "Fineract Database Initialization"
echo "============================================="
echo "RDS Host: $RDS_HOST"
echo "RDS Port: $RDS_PORT"
echo "Admin User: $ADMIN_USER"
echo "Fineract User: $FINERACT_USER"
echo ""

# --------------------------------------------------
# Step 1: Create the Fineract database user
# --------------------------------------------------
echo "[1/4] Creating Fineract database user..."
psql -h "$RDS_HOST" -p "$RDS_PORT" -U "$ADMIN_USER" -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${FINERACT_USER}') THEN
    CREATE ROLE ${FINERACT_USER} WITH LOGIN PASSWORD '${FINERACT_PASS}';
    RAISE NOTICE 'Created user ${FINERACT_USER}';
  ELSE
    ALTER ROLE ${FINERACT_USER} WITH PASSWORD '${FINERACT_PASS}';
    RAISE NOTICE 'User ${FINERACT_USER} already exists, password updated';
  END IF;
END
\$\$;
SQL
echo "  Done."

# --------------------------------------------------
# Step 2: Create fineract_tenants database
# --------------------------------------------------
echo "[2/4] Creating fineract_tenants database..."
psql -h "$RDS_HOST" -p "$RDS_PORT" -U "$ADMIN_USER" -d postgres <<SQL
SELECT 'CREATE DATABASE fineract_tenants OWNER ${FINERACT_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fineract_tenants')\gexec
SQL
psql -h "$RDS_HOST" -p "$RDS_PORT" -U "$ADMIN_USER" -d fineract_tenants <<SQL
GRANT ALL PRIVILEGES ON DATABASE fineract_tenants TO ${FINERACT_USER};
GRANT ALL PRIVILEGES ON SCHEMA public TO ${FINERACT_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${FINERACT_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${FINERACT_USER};
SQL
echo "  Done."

# --------------------------------------------------
# Step 3: Create fineract_default database
# --------------------------------------------------
echo "[3/4] Creating fineract_default database..."
psql -h "$RDS_HOST" -p "$RDS_PORT" -U "$ADMIN_USER" -d postgres <<SQL
SELECT 'CREATE DATABASE fineract_default OWNER ${FINERACT_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fineract_default')\gexec
SQL
psql -h "$RDS_HOST" -p "$RDS_PORT" -U "$ADMIN_USER" -d fineract_default <<SQL
GRANT ALL PRIVILEGES ON DATABASE fineract_default TO ${FINERACT_USER};
GRANT ALL PRIVILEGES ON SCHEMA public TO ${FINERACT_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${FINERACT_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${FINERACT_USER};
SQL
echo "  Done."

# --------------------------------------------------
# Step 4: Verify databases exist
# --------------------------------------------------
echo "[4/4] Verifying databases..."
RESULT=$(psql -h "$RDS_HOST" -p "$RDS_PORT" -U "$ADMIN_USER" -d postgres -t -c \
  "SELECT datname FROM pg_database WHERE datname IN ('fineract_tenants', 'fineract_default') ORDER BY datname;")

echo "  Found databases:"
echo "$RESULT" | while read -r line; do
  [ -n "$line" ] && echo "    - $line"
done

EXPECTED_COUNT=2
ACTUAL_COUNT=$(echo "$RESULT" | grep -c -E "fineract_" || true)

if [ "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT" ]; then
  echo ""
  echo "============================================="
  echo "SUCCESS: Both Fineract databases created"
  echo "============================================="
  echo ""
  echo "Fineract will auto-create its schema tables via"
  echo "Liquibase migrations on first startup."
  echo ""
  echo "Next step: Deploy the ECS Fargate stack."
else
  echo ""
  echo "ERROR: Expected $EXPECTED_COUNT databases, found $ACTUAL_COUNT"
  exit 1
fi
