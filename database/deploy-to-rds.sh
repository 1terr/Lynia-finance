#!/usr/bin/env bash
# Deploy Lynia Finance schema to RDS PostgreSQL
#
# Usage:
#   ./database/deploy-to-rds.sh <RDS_CONNECTION_STRING>
#
# Example:
#   ./database/deploy-to-rds.sh "postgresql://lynia_admin:password@mydb.123456.us-east-1.rds.amazonaws.com:5432/lynia"
#
# This script:
#   1. Runs the AWS pre-migration stub (auth schema + extensions)
#   2. Runs all 17 standard migrations in order
#   3. Runs the AWS post-migration cleanup (removes RLS + auth schema)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <RDS_CONNECTION_STRING>"
  echo "Example: $0 \"postgresql://lynia_admin:pass@host:5432/lynia\""
  exit 1
fi

RDS_URL="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Lynia Finance - RDS Schema Deployment ==="
echo ""

# Step 1: Pre-migration (auth stub + extensions)
echo "[1/3] Running pre-migration setup..."
psql "$RDS_URL" --set ON_ERROR_STOP=on -f "$SCRIPT_DIR/migrations/aws/000_pre_migration.sql"
echo "  Done."

# Step 2: Standard migrations (001-017)
echo "[2/3] Running standard migrations..."
for migration in "$SCRIPT_DIR"/migrations/0*.sql; do
  filename=$(basename "$migration")
  echo "  Applying $filename..."
  psql "$RDS_URL" --set ON_ERROR_STOP=on -f "$migration"
done
echo "  Done."

# Step 3: Post-migration (remove RLS + auth schema)
echo "[3/3] Running post-migration cleanup..."
psql "$RDS_URL" --set ON_ERROR_STOP=on -f "$SCRIPT_DIR/migrations/aws/018_remove_rls_for_aws.sql"
echo "  Done."

echo ""
echo "=== Schema deployment complete ==="
echo ""
echo "Verify with:"
echo "  psql \"$RDS_URL\" -c \"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;\""
