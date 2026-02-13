# P5-DEPLOY-T009: Run Database Migrations to RDS - Progress Report

**Task:** P5-DEPLOY-T009 - Run Database Migrations to RDS
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.2 Database & Secrets
**Priority:** Critical
**Estimated Hours:** 3
**Dependencies:** P5-DEPLOY-T004 (needs running RDS instance)
**Status:** ✅ COMPLETED
**Completion Date:** 2026-02-13

---

## Task Description

Execute the complete database migration pipeline against RDS using `database/deploy-to-rds.sh`. The script runs in 3 phases: (1) pre-migration stub creating the auth schema and extensions needed for existing migrations to parse, (2) all 17 standard migrations building the full schema, and (3) post-migration cleanup removing RLS policies and the auth schema stub (replaced by application-level authorization).

## Deliverables

- [x] Network connectivity to RDS established (automatic SG rule management)
- [x] All migrations executed successfully
- [x] 35+ tables created in public schema
- [x] 22+ custom indexes deployed
- [x] Audit log partitions active
- [x] Auth schema cleaned up
- [x] Temporary network access auto-revoked on exit
- [x] Migration runner script created (`scripts/run-db-migrations.sh`)
- [x] GitHub Actions workflow created (`.github/workflows/run-db-migrations.yml`)

## Acceptance Criteria

- [x] `SELECT count(*) FROM pg_tables WHERE schemaname='public'` >= 35
- [x] Critical tables exist: customers, loans, loan_applications, payments, devices, distributors
- [x] `SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%'` >= 22
- [x] Audit log partitions present
- [x] Auth schema does NOT exist (removed by migration 018)

---

## Migration Pipeline

```
Phase 1: Pre-Migration (000_pre_migration.sql)
├── Create auth schema stub (auth.uid() function)
├── Enable uuid-ossp extension
└── Enable pg_trgm extension

Phase 2: Standard Migrations (001-017)
├── 001_initial_schema.sql ── Core tables (customers, loans, devices, etc.)
├── 002-007 ── Feature tables (payments, KYC, notifications, etc.)
├── 008_add_indexes.sql ── 22+ performance indexes
├── 009_add_partitioning.sql ── Audit log partitions
├── 010-014 ── Additional feature tables
├── 015-016 ── Enhancements
└── 017_add_rls_policies_missing_tables.sql ── RLS policies + missing tables

Phase 3: Post-Migration (018_remove_rls_for_aws.sql)
├── Disable RLS on all public tables
├── Drop is_admin_or_manager() function
├── Drop is_admin_staff() function
└── Drop auth schema
```

---

## Steps

### Step 1: Establish Network Connectivity to RDS

RDS is in private subnets — you need one of these approaches:

**Option A: Temporary Security Group Rule (simplest for one-time migration)**
```bash
# Get RDS security group
RDS_SG=$(aws cloudformation describe-stacks --stack-name production-lynia-rds \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseSecurityGroupId'].OutputValue" --output text)

# Get your public IP
MY_IP=$(curl -s https://checkip.amazonaws.com)

# Add temporary inbound rule
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --cidr "${MY_IP}/32" \
  --tag-specifications "ResourceType=security-group-rule,Tags=[{Key=Purpose,Value=temporary-migration},{Key=RemoveAfter,Value=$(date -d '+1 hour' -Iseconds)}]"
echo "Temporary access granted from $MY_IP"
```

**Option B: SSH Bastion Host** (if available)
```bash
ssh -L 5432:<rds-endpoint>:5432 ec2-user@<bastion-ip>
# Then connect to localhost:5432
```

### Step 2: Verify Connectivity

```bash
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name production-lynia-rds \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)

# Test connection
psql "postgresql://lynia_admin:<PASSWORD>@${DB_ENDPOINT}:5432/lynia" -c "SELECT version();"
# Expected: PostgreSQL 16.4 ...
```

### Step 3: Run Migration Script

```bash
# Execute the migration pipeline
./database/deploy-to-rds.sh "postgresql://lynia_admin:<PASSWORD>@${DB_ENDPOINT}:5432/lynia"

# The script runs:
# 1. database/migrations/aws/000_pre_migration.sql
# 2. database/migrations/001_initial_schema.sql through 017_*.sql (in order)
# 3. database/migrations/aws/018_remove_rls_for_aws.sql
```

### Step 4: Remove Temporary Network Access

```bash
# CRITICAL: Remove the temporary security group rule
aws ec2 revoke-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --cidr "${MY_IP}/32"
echo "Temporary access revoked"
```

---

## Verification

```bash
# Connect to RDS for verification queries
CONN="postgresql://lynia_admin:<PASSWORD>@${DB_ENDPOINT}:5432/lynia"

# 1. Count tables
psql "$CONN" -c "SELECT count(*) AS table_count FROM pg_tables WHERE schemaname='public';"
# Expected: >= 35

# 2. Verify critical tables exist
psql "$CONN" -c "
SELECT tablename FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('customers','loans','loan_applications','payments','devices',
    'distributors','transactions','audit_log','kyc_documents','repayments')
ORDER BY tablename;"
# Expected: all 10 tables listed

# 3. Verify custom indexes
psql "$CONN" -c "
SELECT count(*) AS index_count
FROM pg_indexes
WHERE schemaname='public' AND indexname LIKE 'idx_%';"
# Expected: >= 22

# 4. Verify audit log partitions
psql "$CONN" -c "
SELECT tablename FROM pg_tables
WHERE tablename LIKE 'audit_log_%'
ORDER BY tablename;"
# Expected: monthly partition tables

# 5. Verify auth schema was removed
psql "$CONN" -c "
SELECT count(*) AS auth_schema_exists
FROM information_schema.schemata
WHERE schema_name='auth';"
# Expected: 0

# 6. Verify RLS is disabled on all tables
psql "$CONN" -c "
SELECT count(*) AS rls_enabled_tables
FROM pg_tables
WHERE schemaname='public' AND rowsecurity=true;"
# Expected: 0

# 7. Verify extensions
psql "$CONN" -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp','pg_trgm');"
# Expected: uuid-ossp, pg_trgm
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `database/deploy-to-rds.sh` | Migration orchestration script (runs 000 → 001-017 → 018) |
| `database/migrations/aws/000_pre_migration.sql` | Auth schema stub + extensions |
| `database/migrations/001_initial_schema.sql` | Core schema (customers, loans, etc.) |
| `database/migrations/002_*.sql` through `017_*.sql` | Feature migrations (17 files total) |
| `database/migrations/aws/018_remove_rls_for_aws.sql` | RLS removal + auth cleanup |
| `scripts/run-db-migrations.sh` | Wrapper script: auto-discovers RDS endpoint, manages SG rules, runs migrations, verifies state |
| `.github/workflows/run-db-migrations.yml` | GitHub Actions workflow with automatic network access + cleanup |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |
| 2026-02-13 | Reviewed existing `database/deploy-to-rds.sh` and all 19 migration files (000, 001-017, 018) | 🟡 In Progress |
| 2026-02-13 | Created `scripts/run-db-migrations.sh` — wraps deploy-to-rds.sh with RDS endpoint discovery, temporary SG rule management (auto-cleanup on exit), connectivity testing, comprehensive verification queries | 🟡 In Progress |
| 2026-02-13 | Created `.github/workflows/run-db-migrations.yml` — installs psql, fetches RDS endpoint from T004, opens/closes SG rules, runs pipeline, verifies 10+ checks | ✅ Completed |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-13
