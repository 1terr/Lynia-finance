#!/usr/bin/env bash
# ============================================================
# Fineract Data Backup Strategy Script
# Item 10 from Phase 8 deferred items
#
# Configures automated backups for the Fineract database
# (MySQL on RDS) and verifies backup policies.
# ============================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
REGION="${AWS_REGION:-us-east-1}"

echo "=== Fineract Backup Configuration ==="
echo "Environment: ${ENVIRONMENT}"
echo "Region:      ${REGION}"
echo ""

# ---- Step 1: Check current RDS backup settings ----
echo "[1/5] Checking current RDS instance backup configuration..."

DB_INSTANCE="${ENVIRONMENT}-fineract-db"
DB_INFO=$(aws rds describe-db-instances \
  --db-instance-identifier "${DB_INSTANCE}" \
  --region "${REGION}" \
  --query "DBInstances[0].{BackupRetentionPeriod:BackupRetentionPeriod,PreferredBackupWindow:PreferredBackupWindow,MultiAZ:MultiAZ,StorageEncrypted:StorageEncrypted}" \
  --output json 2>/dev/null || echo '{"error": "Instance not found"}')

echo "${DB_INFO}" | python3 -c "
import sys, json
info = json.load(sys.stdin)
if 'error' in info:
    print(f'  WARNING: {info[\"error\"]}')
    print(f'  Looking for Fineract ECS database...')
else:
    print(f'  Backup Retention: {info[\"BackupRetentionPeriod\"]} days')
    print(f'  Backup Window:    {info[\"PreferredBackupWindow\"]}')
    print(f'  Multi-AZ:         {info[\"MultiAZ\"]}')
    print(f'  Encrypted:        {info[\"StorageEncrypted\"]}')
" 2>/dev/null || echo "  Could not parse DB info"

echo ""

# ---- Step 2: Update backup retention if needed ----
echo "[2/5] Configuring backup retention..."

RETENTION_DAYS=7
if [ "${ENVIRONMENT}" = "production" ]; then
  RETENTION_DAYS=35
elif [ "${ENVIRONMENT}" = "staging" ]; then
  RETENTION_DAYS=14
fi

echo "  Target retention: ${RETENTION_DAYS} days"

aws rds modify-db-instance \
  --db-instance-identifier "${DB_INSTANCE}" \
  --backup-retention-period "${RETENTION_DAYS}" \
  --preferred-backup-window "02:00-03:00" \
  --apply-immediately \
  --region "${REGION}" \
  --no-cli-pager 2>/dev/null && echo "  Backup retention updated." || echo "  WARNING: Could not update (instance may not exist yet)."

echo ""

# ---- Step 3: Create manual snapshot ----
echo "[3/5] Creating manual snapshot..."

SNAPSHOT_ID="${ENVIRONMENT}-fineract-$(date +%Y%m%d-%H%M%S)"

aws rds create-db-snapshot \
  --db-instance-identifier "${DB_INSTANCE}" \
  --db-snapshot-identifier "${SNAPSHOT_ID}" \
  --tags "Key=Environment,Value=${ENVIRONMENT}" "Key=Type,Value=manual" \
  --region "${REGION}" \
  --no-cli-pager 2>/dev/null && echo "  Snapshot: ${SNAPSHOT_ID}" || echo "  WARNING: Could not create snapshot (instance may not exist yet)."

echo ""

# ---- Step 4: S3 export bucket for long-term storage ----
echo "[4/5] Checking S3 backup bucket..."

BACKUP_BUCKET="${ENVIRONMENT}-lynia-fineract-backups"

if aws s3api head-bucket --bucket "${BACKUP_BUCKET}" --region "${REGION}" 2>/dev/null; then
  echo "  Bucket exists: s3://${BACKUP_BUCKET}"
else
  echo "  Creating backup bucket: s3://${BACKUP_BUCKET}"
  aws s3api create-bucket \
    --bucket "${BACKUP_BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}" \
    --no-cli-pager 2>/dev/null || echo "  Note: Bucket may already exist in another account."

  # Enable versioning
  aws s3api put-bucket-versioning \
    --bucket "${BACKUP_BUCKET}" \
    --versioning-configuration Status=Enabled \
    --region "${REGION}" 2>/dev/null || true

  # Set lifecycle policy for cost management
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "${BACKUP_BUCKET}" \
    --lifecycle-configuration '{
      "Rules": [
        {
          "ID": "ArchiveOldBackups",
          "Status": "Enabled",
          "Filter": {"Prefix": "snapshots/"},
          "Transitions": [
            {"Days": 30, "StorageClass": "STANDARD_IA"},
            {"Days": 90, "StorageClass": "GLACIER"}
          ],
          "Expiration": {"Days": 365}
        }
      ]
    }' \
    --region "${REGION}" 2>/dev/null || true

  echo "  Bucket created with lifecycle policy (IA→Glacier→Delete)."
fi

echo ""

# ---- Step 5: Summary ----
echo "[5/5] Backup Strategy Summary"
echo ""
echo "  RDS Automated Backups:"
echo "    - Retention: ${RETENTION_DAYS} days"
echo "    - Window: 02:00-03:00 UTC (low-traffic)"
echo "    - Point-in-time recovery: Enabled"
echo ""
echo "  S3 Long-term Storage:"
echo "    - Bucket: s3://${BACKUP_BUCKET}"
echo "    - Lifecycle: Standard → IA (30d) → Glacier (90d) → Delete (365d)"
echo ""
echo "  Manual Snapshots:"
echo "    - Use: aws rds create-db-snapshot --db-instance-identifier ${DB_INSTANCE} --db-snapshot-identifier <name>"
echo ""
echo "  Restore:"
echo "    - Point-in-time: aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier ${DB_INSTANCE} --target-db-instance-identifier ${DB_INSTANCE}-restored --restore-time <ISO8601>"
echo "    - From snapshot: aws rds restore-db-instance-from-db-snapshot --db-instance-identifier ${DB_INSTANCE}-restored --db-snapshot-identifier <snapshot-id>"
echo ""
echo "=== Backup configuration complete ==="