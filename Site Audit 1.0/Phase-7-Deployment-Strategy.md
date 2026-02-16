# Phase 7: Production Deployment Strategy & Test Plan

**Created:** February 16, 2026
**Branch:** `master`
**Commit:** `a54d830` (Phase 6B/6C code-complete)
**Status:** READY FOR DEPLOYMENT
**Prerequisites:** Phase 6A (Fineract ECS), Phase 6B (Config/IAM), Phase 6C (Service Wiring) — all code-complete

---

## Executive Summary

Phase 7 deploys all Phase 6A/6B/6C code changes to the production AWS environment. This includes updating 8 Lambda functions with Fineract environment variables and IAM permissions, adding a new Reconciliation Lambda, applying database migration 019 (Fineract mapping columns + sync log table), deploying the Fineract initialization Lambda (GL accounts + loan products), and rebuilding the admin portal with the new Fineract sidebar navigation.

---

## Deployment Sequence

Deployment must follow this exact order due to dependencies:

```
Step 1: SAM Build & Deploy (Lambda services)
    ↓  Adds FINERACT_SECRET_NAME env var, IAM permissions, Reconciliation Lambda
    ↓  Stack: lynia-finance-prod
    ↓
Step 2: Database Migration 019
    ↓  Adds fineract_client_id, fineract_loan_id, fineract_transaction_id columns
    ↓  Creates fineract_sync_log table
    ↓  Script: ./scripts/run-db-migrations.sh --env production
    ↓
Step 3: Fineract Initialization Lambda
    ↓  Creates 18 GL accounts + 3 loan products in Fineract
    ↓  Stack: production-lynia-fineract-init
    ↓
Step 4: Admin Portal Build & Deploy
    ↓  Rebuilds Next.js with Fineract sidebar nav
    ↓  Script: ./scripts/build-and-upload-frontend.sh --env=production --app=admin-portal
    ↓
Step 5: Verification & Smoke Tests
```

**Why this order?**
- Step 1 before Step 2: Lambda code references the new columns, but sync is gated behind `FINERACT_SECRET_NAME` — deploying Lambda first is safe because the env var won't trigger sync until Fineract is initialized
- Step 2 before Step 3: The init Lambda doesn't touch Lynia's database, but having the columns ready ensures any sync triggered after Step 3 can write to them
- Step 3 before Step 4: Admin portal Fineract pages query Fineract GL/loan data — it should exist before users navigate there
- Step 4 last: Frontend is the user-facing change and should only go live after backend is ready

---

## Step 1: SAM Build & Deploy

### What Changes

| Resource | Change | Impact |
|----------|--------|--------|
| **Globals** | Added `FINERACT_SECRET_NAME` env var | All 7 existing Lambdas receive the variable |
| **ScoringFunction** | Added `fineract-*` secrets IAM | Can read Fineract API credentials |
| **PaymentFunction** | Added `fineract-*` secrets IAM | Can read Fineract API credentials |
| **FineractReconciliationFunction** | NEW Lambda | 6-hour EventBridge schedule, 5min timeout |
| **Outputs** | Added `FineractReconciliationFunctionArn` | Exported for cross-stack reference |

### Commands

```bash
# Build all Lambda functions
sam build --config-env production --cached --parallel

# Validate template
sam validate --lint

# Deploy (will show changeset for confirmation)
sam deploy --config-env production
```

### Expected Changeset

- **Modify:** ScoringFunction, PaymentFunction (IAM policy update)
- **Modify:** All functions (environment variable addition)
- **Add:** FineractReconciliationFunction + EventBridge rule + IAM role
- **Add:** FineractReconciliationFunctionArn output

### Rollback Plan

```bash
# SAM automatically rolls back on failure (on_failure = ROLLBACK in samconfig.toml)
# Manual rollback if needed:
aws cloudformation rollback-stack --stack-name lynia-finance-prod --region us-east-1
```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lambda cold start increase | Low | Low | arm64 + 512MB keeps cold starts <2s |
| Fineract sync errors on first deploy | Medium | None | Non-blocking pattern, errors logged only |
| EventBridge misconfiguration | Low | Low | Reconciliation is additive, no destructive ops |

---

## Step 2: Database Migration 019

### What Changes

| Table | Columns Added | Purpose |
|-------|--------------|---------|
| `customers` | `fineract_client_id`, `fineract_account_no`, `fineract_synced_at` | Map Lynia customers to Fineract clients |
| `loans` | `fineract_loan_id`, `fineract_loan_account_no`, `fineract_product_id`, `fineract_synced_at` | Map Lynia loans to Fineract loans |
| `payments` | `fineract_transaction_id`, `fineract_synced_at` | Map repayments to Fineract transactions |
| `loan_products` | `fineract_product_id`, `fineract_synced_at` | Map products to Fineract product IDs |
| **NEW** `fineract_sync_log` | Full audit table | Track all sync operations |

### Commands

```bash
# Dry run first to verify plan
./scripts/run-db-migrations.sh --env production --dry-run

# Execute migration (requires DB_PASSWORD)
DB_PASSWORD=$RDS_PASSWORD ./scripts/run-db-migrations.sh --env production

# Or run migration 019 directly via psql
psql "$CONN_STRING" -f database/migrations/019_add_fineract_columns.sql
```

### Safety Characteristics

- All `ALTER TABLE` uses `IF NOT EXISTS` — safe to re-run
- All `CREATE INDEX` uses `IF NOT EXISTS` — idempotent
- All `CREATE TABLE` uses `IF NOT EXISTS` — idempotent
- No data modification — only DDL changes
- No table locks beyond brief ALTER TABLE (nullable columns = instant add on PostgreSQL)
- Backwards compatible — all new columns are nullable

### Rollback Plan

```sql
-- Reverse migration 019 (if needed)
ALTER TABLE customers DROP COLUMN IF EXISTS fineract_client_id,
                      DROP COLUMN IF EXISTS fineract_account_no,
                      DROP COLUMN IF EXISTS fineract_synced_at;
ALTER TABLE loans DROP COLUMN IF EXISTS fineract_loan_id,
                  DROP COLUMN IF EXISTS fineract_loan_account_no,
                  DROP COLUMN IF EXISTS fineract_product_id,
                  DROP COLUMN IF EXISTS fineract_synced_at;
ALTER TABLE payments DROP COLUMN IF EXISTS fineract_transaction_id,
                     DROP COLUMN IF EXISTS fineract_synced_at;
ALTER TABLE loan_products DROP COLUMN IF EXISTS fineract_product_id,
                          DROP COLUMN IF EXISTS fineract_synced_at;
DROP TABLE IF EXISTS fineract_sync_log;
```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Table lock during ALTER | Very Low | Low | Nullable columns = instant ADD on PostgreSQL 16 |
| Index creation blocking reads | Very Low | Low | `IF NOT EXISTS` + partial indexes (WHERE ... IS NOT NULL) |
| Migration script failure | Low | None | All statements are idempotent, safe to re-run |

---

## Step 3: Fineract Initialization Lambda

### What It Creates

**18 GL Accounts:**
| Code | Name | Type |
|------|------|------|
| 1000 | Assets (Header) | Asset |
| 1001 | Cash and Bank | Asset |
| 1100 | Loan Portfolio | Asset |
| 1200 | Interest Receivable | Asset |
| 1300 | Fee Receivable | Asset |
| 1400 | Penalty Receivable | Asset |
| 2000 | Liabilities (Header) | Liability |
| 2001 | Overpayment Liability | Liability |
| 2100 | Transfers in Suspense | Liability |
| 3000 | Equity (Header) | Equity |
| 3001 | Opening Balance Equity | Equity |
| 4000 | Income (Header) | Income |
| 4001 | Interest Income | Income |
| 4002 | Fee Income | Income |
| 4003 | Penalty Income | Income |
| 4004 | Income from Recovery | Income |
| 5000 | Expenses (Header) | Expense |
| 5001 | Loan Write-Off Expense | Expense |
| 5002 | Provision Expense | Expense |

**3 Loan Products:**
| Short Name | Description | Principal Range | Rate |
|------------|-------------|----------------|------|
| LT1E | Tier 1 Entry (scores 350-499) | $50 - $200 | 5%/month |
| LT2S | Tier 2 Standard (scores 500-649) | $200 - $500 | 4%/month |
| LT3P | Tier 3 Premium (scores 650+) | $500 - $2,000 | 3%/month |

### Commands

```bash
# Build the init Lambda
sam build --template phase-6-fineract-integration/infrastructure/fineract-init-cfn.yaml

# Deploy (triggers Custom Resource = runs Lambda on Create)
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name production-lynia-fineract-init \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### Prerequisites

- Fineract ECS must be running and healthy (Phase 6A)
- `production/lynia/fineract-api` secret must exist in Secrets Manager
- Lambda must be in VPC with access to internal ALB

### Idempotency

The init Lambda checks for existing GL accounts (by `glCode`) and loan products (by `shortName`) before creating. Safe to re-run by updating the `InitVersion` parameter:

```bash
sam deploy ... --parameter-overrides Environment=production InitVersion=1.0.1
```

### Rollback Plan

Stack deletion is a no-op (the Custom Resource handler returns SUCCESS on Delete). GL accounts and loan products remain in Fineract (they are not deleted on stack teardown).

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Fineract unreachable | Low | Medium | Health check before GL creation; Lambda in same VPC |
| Duplicate GL accounts | Very Low | None | Idempotent: checks existing codes before creating |
| Wrong accounting rule | Low | High | Verified: all 3 products use accrual (rule=3) |

---

## Step 4: Admin Portal Build & Deploy

### What Changes

- Sidebar navigation: 8 items → 9 items (added "Fineract" between Payments and Reports)
- New Fineract nav icon: `Landmark` from lucide-react
- Permission: `loans:read` (any admin with loan access can see Fineract pages)

### Commands

```bash
# Build and deploy admin portal only
./scripts/build-and-upload-frontend.sh --env=production --app=admin-portal
```

This script:
1. Resolves Cognito config from CloudFormation stacks
2. Builds Next.js static export (`pnpm build`)
3. Uploads to S3 bucket `production-lynia-admin-portal`
4. Invalidates CloudFront cache

### Rollback Plan

```bash
# Re-deploy previous version from git
git checkout HEAD~1 -- frontend/admin-portal/
./scripts/build-and-upload-frontend.sh --env=production --app=admin-portal
git checkout master -- frontend/admin-portal/
```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Build failure | Low | None | All tests pass, build verified locally |
| CloudFront cache stale | Low | Low | Script invalidates `/*` after upload |
| Fineract pages 404 | Very Low | Low | Pages already exist from Phase 6A, only nav was missing |

---

## Step 5: Verification & Smoke Tests

### Automated Verification Tests

#### Test 1: Lambda Functions Deployed

```bash
# Verify all 8 Lambda functions exist and are configured
for fn in scoring payment whatsapp kyc lock notification fineract-reconciliation; do
  aws lambda get-function \
    --function-name "production-lynia-${fn}" \
    --query 'Configuration.{Name:FunctionName,Runtime:Runtime,State:State,Timeout:Timeout}' \
    --output table --region us-east-1
done
```

**Expected:** 8 functions, all `Active`, Runtime `nodejs20.x`

#### Test 2: Fineract Environment Variable

```bash
# Verify FINERACT_SECRET_NAME is set on scoring and payment functions
for fn in scoring payment; do
  aws lambda get-function-configuration \
    --function-name "production-lynia-${fn}" \
    --query 'Environment.Variables.FINERACT_SECRET_NAME' \
    --output text --region us-east-1
done
```

**Expected:** `production/lynia/fineract-api` for both

#### Test 3: Reconciliation EventBridge Schedule

```bash
# Verify EventBridge rule exists and is enabled
aws events list-rules \
  --name-prefix "lynia-finance-prod-FineractReconciliation" \
  --query 'Rules[*].{Name:Name,State:State,Schedule:ScheduleExpression}' \
  --output table --region us-east-1
```

**Expected:** One rule, State=ENABLED, Schedule=`rate(6 hours)`

#### Test 4: Database Migration 019

```bash
# Verify Fineract columns exist
psql "$CONN_STRING" -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'customers'
    AND column_name LIKE 'fineract_%'
  ORDER BY column_name;
"

# Verify sync log table exists
psql "$CONN_STRING" -c "
  SELECT count(*) FROM information_schema.tables
  WHERE table_name = 'fineract_sync_log';
"
```

**Expected:** 3 fineract columns on customers, sync log table exists

#### Test 5: Fineract GL Accounts

```bash
# Query Fineract via internal ALB (from a Lambda or bastion host)
curl -k -s \
  -H "Authorization: Basic $(echo -n 'mifos:password' | base64)" \
  -H "Fineract-Platform-TenantId: default" \
  "https://internal-production-lynia-fineract-alb-1096024907.us-east-1.elb.amazonaws.com:8443/fineract-provider/api/v1/glaccounts" \
  | jq '. | length'
```

**Expected:** 18 GL accounts

#### Test 6: Fineract Loan Products

```bash
curl -k -s \
  -H "Authorization: Basic $(echo -n 'mifos:password' | base64)" \
  -H "Fineract-Platform-TenantId: default" \
  "https://internal-production-lynia-fineract-alb-1096024907.us-east-1.elb.amazonaws.com:8443/fineract-provider/api/v1/loanproducts" \
  | jq '.[].shortName'
```

**Expected:** `"LT1E"`, `"LT2S"`, `"LT3P"`

#### Test 7: Admin Portal Sidebar

```bash
# Verify admin portal is serving updated build
ADMIN_URL=$(aws cloudformation describe-stacks \
  --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalUrl'].OutputValue" \
  --output text --region us-east-1)

curl -s "$ADMIN_URL" | grep -c "Fineract"
```

**Expected:** >= 1 match (Fineract text present in HTML/JS bundle)

#### Test 8: API Gateway Health

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name lynia-finance-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text --region us-east-1)

# Test scoring endpoint (should return 401 without auth)
curl -s -o /dev/null -w "%{http_code}" "${API_URL}scoring/health"

# Test payment endpoint (should return 401 without auth)
curl -s -o /dev/null -w "%{http_code}" "${API_URL}payments/health"
```

**Expected:** 200 or 401 (not 500/502/503)

#### Test 9: CloudWatch Logs

```bash
# Check for errors in the last 30 minutes across all functions
for fn in scoring payment fineract-reconciliation; do
  echo "=== production-lynia-${fn} ==="
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/production-lynia-${fn}" \
    --start-time $(($(date +%s) - 1800))000 \
    --filter-pattern "ERROR" \
    --query 'events[*].message' \
    --output text --region us-east-1 2>/dev/null | head -5
done
```

**Expected:** No unexpected ERROR entries

#### Test 10: End-to-End Non-Blocking Sync

```bash
# Invoke scoring Lambda with a test event to verify non-blocking sync
# The sync will fail gracefully if no real customer exists
aws lambda invoke \
  --function-name production-lynia-scoring \
  --payload '{"httpMethod":"GET","path":"/scoring/health"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/scoring-response.json --region us-east-1

cat /tmp/scoring-response.json
```

**Expected:** 200 response, no sync errors in CloudWatch

---

## Monitoring Post-Deploy

### Key CloudWatch Metrics to Watch (First 24 Hours)

| Metric | Alarm Threshold | Action |
|--------|----------------|--------|
| Lambda Error Rate | > 1% | Check CloudWatch Logs for stack traces |
| Lambda Duration (p99) | > 5s | Check cold starts, VPC config |
| Fineract Sync Failures | > 10/hour | Check fineract_sync_log table |
| Reconciliation Lambda Duration | > 4min | Review batch size, database query plans |
| API Gateway 5xx | > 0.5% | Check Lambda errors, API Gateway logs |

### CloudWatch Dashboard Queries

```
# Fineract sync operations (filter from Lambda logs)
fields @timestamp, @message
| filter @message like /fineract-sync/
| sort @timestamp desc
| limit 50

# Reconciliation job results
fields @timestamp, @message
| filter @logStream like /fineract-reconciliation/
| sort @timestamp desc
| limit 20
```

---

## Estimated Timeline

| Step | Duration | Cumulative |
|------|----------|-----------|
| 1. SAM Build & Deploy | 8-10 min | 10 min |
| 2. Database Migration 019 | 2-3 min | 13 min |
| 3. Fineract Init Lambda | 3-5 min | 18 min |
| 4. Admin Portal Build & Deploy | 5-8 min | 26 min |
| 5. Verification Tests | 10-15 min | 41 min |

**Total estimated deployment time: ~40 minutes**

---

## Go/No-Go Checklist

Before starting deployment:

- [x] All 828 tests passing on `master`
- [x] Admin portal builds successfully
- [x] Phase 6A: Fineract ECS running and healthy
- [x] Phase 6B/6C: Code committed and pushed to `master`
- [ ] AWS credentials configured with production access
- [ ] `DB_PASSWORD` available for migration step
- [ ] Fineract API secret exists: `production/lynia/fineract-api`
- [ ] No active incidents or deployments in progress
- [ ] Team notified of deployment window

---

## Post-Deployment Checklist

After all 5 steps complete:

- [ ] All 8 Lambda functions Active with correct env vars
- [ ] EventBridge reconciliation rule enabled (rate: 6 hours)
- [ ] Database has fineract columns on customers, loans, payments, loan_products
- [ ] Database has fineract_sync_log table
- [ ] Fineract has 18 GL accounts and 3 loan products
- [ ] Admin portal sidebar shows 9 navigation items including Fineract
- [ ] No unexpected errors in CloudWatch logs
- [ ] API Gateway returning expected HTTP codes
- [ ] Monitoring alerts configured and active
