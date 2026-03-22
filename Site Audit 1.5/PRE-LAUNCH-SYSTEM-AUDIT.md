# Lynia Finance — Pre-Launch System-Wide Audit Plan

> **Date:** 2026-03-22
> **Scope:** 13 Lambda services, 2 frontend apps, 97 database tables, 9 CloudFormation stacks, 29 CI/CD workflows, 7 external integrations
> **Status:** Audit strategy — ready for execution

## Context

Lynia Finance is approaching production launch. The platform serves Zimbabwe's underbanked population with financial services (loans, payments, device financing) via WhatsApp, an admin portal, and a distributor dashboard. This is a high-stakes launch — bugs can cause real financial harm.

This audit covers: **13 Lambda services, 2 frontend apps, 97 database tables (78 public + 19 DW), 9 CloudFormation stacks, 29 CI/CD workflows, and 7 external integrations.** The goal is to find bugs, fix error handling, verify database integrity, verify integrations, ensure API consistency, and harden the system for production.

---

## Critical Findings Summary

### Blockers
- **10 files** with silent `.catch(() => {})` swallowing errors — including payment webhooks and loan operations
- **6 services with zero inline tests** (KYC, Fineract Proxy, Distributor, Investor Reporting, DW Sync, Form Submission)
- **Admin service**: 30 handlers but only 1 test file (97% untested)
- **Trustonic device lock** defaults to sandbox mode — must verify `TRUSTONIC_ENV=production`
- **All 4 payment providers** default to sandbox URLs — production env vars must be injected
- **CI coverage gate (80%) doesn't match jest.config.js thresholds (48-62%)**
- **No `/health` endpoints** on any Lambda service
- **`console.log/warn/error`** in 7 production files instead of using the logger

### Fineract Core Banking Gaps
- Existing tests cover date parsing and route matching but not loan lifecycle or sync reliability
- Reconciliation runs every 6 hours but no tests verify discrepancy detection
- Payment-to-Fineract repayment sync path has no dedicated test
- GL account reconciliation (12 fields) untested
- Interop two-phase commit (PREPARE → COMMIT) for disbursement untested

### Database
- 97 tables across public + DW schemas, well-structured
- Known fixed issues: kyc_manual_reviews (migration 023), WhatsApp session columns (migration 024), loan table dependencies (fix_missing_tables.sql)
- Connection pooling: 13 Lambdas × 10 connections = 130 potential connections — verify RDS capacity

---

## Phase 0: Baseline Verification (Must Complete First)

**Goal:** Confirm the system compiles, tests pass, and CI is sound.

| # | Task | Files | Done When |
|---|------|-------|-----------|
| 0.1 | Run `pnpm install` and `npx tsc --noEmit` | `tsconfig.json` | Zero type errors |
| 0.2 | Run `pnpm run lint` | `.eslintrc.json` | Catalog all failures |
| 0.3 | Run `pnpm run test:coverage` | `jest.config.js` | Baseline coverage recorded |
| 0.4 | Run `sam validate` + `cfn-lint template.yaml` | `template.yaml`, `.cfnlintrc` | Template validates |
| 0.5 | **Fix CI coverage inconsistency** — `jest.config.js` thresholds are 48/60/62/62% but `deploy.yml` enforces 80% gate | `jest.config.js`, `.github/workflows/deploy.yml` | Thresholds aligned |
| 0.6 | Remove `continue-on-error: true` from lint step in `test.yml:37` | `.github/workflows/test.yml` | Lint failures block CI |

**Parallelization:** 0.1-0.4 run in parallel. 0.5-0.6 after results.

---

## Phase 1: Backend Audit (5 parallel PRs)

### PR 1A: Payment Service (Handles Money — Highest Risk)

**1A.1 — Fix 8 silent `.catch(() => {})` instances:**
| File | Count | Impact |
|------|-------|--------|
| `services/payment-service/src/payment-service.ts` | 4 | Payment state transitions silently fail |
| `services/payment-service/src/handlers/webhook-ecocash.ts` | 1 | Payment audit trail lost |
| `services/payment-service/src/handlers/webhook-onemoney.ts` | 1 | Same |
| `services/payment-service/src/handlers/webhook-omari.ts` | 1 | Same |
| `services/payment-service/src/handlers/webhook-innbucks.ts` | 1 | Same |
| `services/payment-service/src/compensation-handler.ts` | 1 | Compensation tracking lost |
| `services/payment-service/src/auto-default-scheduler.ts` | 1 | Default detection silent |

**Fix:** Replace with `.catch(err => logger.error('...', { error: err.message, action: '...' }))`

**1A.2 — Verify payment provider environment switching:**
All 4 providers default to sandbox URLs. Verify `template.yaml` injects production env vars:
- `ECOCASH_BASE_URL`, `ECOCASH_ENV`
- `ONEMONEY_BASE_URL`, `ONEMONEY_ENV`
- `OMARI_BASE_URL`, `OMARI_ENV`
- `INNBUCKS_BASE_URL`, `INNBUCKS_ENV`

**1A.3 — Add tests for untested payment handlers:**
Target: `webhook-ecocash.ts`, `webhook-onemoney.ts`, `webhook-omari.ts`, `webhook-innbucks.ts`, `reconcile-payments.ts`
Reference pattern: `services/payment-service/src/__tests__/payment-service.test.ts`

### PR 1B: Admin Service (30 Handlers, 1 Test File)

**1B.1 — Fix 3 silent `.catch(() => {})` in `services/admin-service/src/handlers/loans.ts`**

**1B.2 — Add tests for critical admin handlers (priority order):**
1. `handlers/payments.ts` — Payment management (12 routes)
2. `handlers/customers.ts` — Customer data (11 routes)
3. `handlers/kyc-review.ts` — KYC approve/reject (5 routes)
4. `handlers/device-locks.ts` — Lock/unlock (4 routes)
5. `handlers/dashboard.ts` — Metrics (5 routes)

**1B.3 — Verify auth middleware on all admin routes:**
Check `services/admin-service/src/index.ts` router — every non-public route must call `getAuthContext()`.

### PR 1C: Untested Services

| Service | Handlers | External Tests? | Action |
|---------|----------|----------------|--------|
| KYC Service | 6 in `kyc-service/src/handlers/` | Check `tests/unit/kyc/`, `tests/integration/` | Add handler-level tests |
| Distributor Service | 8 in `distributor-service/src/handlers/` | Check `tests/unit/distributor/` | Test inventory, handovers |
| Investor Reporting | 5+ in `investor-reporting-service/src/handlers/` | Check `tests/unit/investor-reporting/` | Test financial reports |
| DW Sync | 4 in `dw-sync-service/src/handlers/` | Check `tests/unit/dw-sync/` | Test sync operations |

### PR 1D: Cross-Cutting Fixes

**1D.1 — Replace `console.log/warn/error` with logger in production code:**
- `services/shared/clients/fineract.ts` (console.warn, console.error, console.log)
- `services/shared/clients/fineract-reconcile.ts`
- `services/fineract-proxy-service/src/handlers/loan-products.ts`
- `services/shared/clients/fineract-sync/sync-product.ts`
- `services/shared/clients/fineract-sync/sync-scheduler.ts`
- `services/shared/clients/fineract-sync/sync-executor.ts`
- `services/shared/clients/fineract-sync/conflict-resolver.ts`

**1D.2 — Fix 3 silent `.catch(() => {})` in `services/whatsapp-service/src/loan-commands.ts`**

### PR 1E: Fineract Core Banking Integration (Critical — Handles All Lending)

Fineract is the core banking engine. It handles loan origination, disbursement, collections, accounting, and GL entries. All money flows through it.

**Existing test files:**
- `tests/integration/fineract-client.test.ts` — Date utilities, error handling, type validation
- `tests/integration/fineract-proxy-service.test.ts` — Route matching, loan list/detail, actions, errors
- `tests/unit/fineract-proxy/fineract-proxy-helpers.test.ts` — Helper functions
- `tests/unit/fineract-rbz-reporting.test.ts` — RBZ compliance reports

**1E.1 — Fineract Client loan lifecycle tests** (`services/shared/clients/fineract/loan-client.ts`):
- `createLoan()` — Verify correct payload format (Fineract date format "dd MMMM yyyy"), required fields
- `approveLoan()` → `disburseLoan()` → `postRepayment()` → `closeLoan()` — Happy path
- `approveLoan()` → `rejectLoan()` — Rejection path
- `approveLoan()` → `disburseLoan()` → `writeOffLoan()` — Write-off path
- `restructureLoan()` — Rescheduling with new terms
- `calculateEarlyPayoff()` → `processEarlyPayoff()` — Early payoff path
- Error scenarios: Fineract returns 4xx, 5xx, connection timeout, circuit breaker trips

**1E.2 — Fineract Sync Executor tests** (`services/shared/clients/fineract-sync/sync-executor.ts`):
- `syncCustomerToFineract()` — Creates Fineract client, updates `customers.fineract_client_id`
- `syncLoanToFineract()` — Creates Fineract loan, updates `loans.fineract_loan_id`
- `approveLoanInFineract()` — Approves in Fineract, returns success/failure
- `disburseLoanInFineract()` — Standard disbursement path
- `disburseLoanInFineract()` with Interop — Two-phase commit (PREPARE → COMMIT), rollback on failure (RELEASE)
- `syncRepaymentToFineract()` — Posts repayment, updates `payments.fineract_transaction_id`
- Failure recovery: What happens when sync fails mid-operation? Verify SQS retry queue

**1E.3 — Fineract Product Sync tests** (`services/shared/clients/fineract-sync/sync-product.ts`):
- `syncProductToFineract()` — Maps Lynia product fields to Fineract format
- Short name collision detection (4-char unique code generation)
- Orphaned product recovery (handles Lambda timeout mid-creation)
- GL account mapping (12 account IDs: fund_source, loan_portfolio, interest_on_loan, etc.)
- Interest recalculation parameters (migration 038 fields)

**1E.4 — Fineract Reconciliation tests** (`services/shared/clients/fineract-reconcile.ts`):
- Loan balance reconciliation — compares Lynia vs Fineract outstanding amounts (tolerance $0.01)
- GL account reconciliation — verifies 12 GL account fields match between systems
- Failed sync retry logic — up to 3 attempts on failed sync_log entries
- CloudWatch metric publishing (FineractApprovalSyncFailures, ReconciliationDiscrepancies, GLAccountMismatch)
- Discrepancy severity classification (low/medium/high)

**1E.5 — Fineract Proxy handler tests** (`services/fineract-proxy-service/src/handlers/`):

| Handler | File | Test Focus |
|---------|------|------------|
| Loan list with pagination + search | `loan-portfolio.ts` | Filters, Fineract join, graceful degradation |
| Pending loans (unsynced) | `loan-portfolio.ts` | Detects fineract_loan_id IS NULL |
| Overdue loans with aging buckets | `loan-portfolio.ts` | 1-30, 31-60, 61-90, 90+ day classification |
| Aging summary | `loan-portfolio.ts` | Bucket distribution calculation |
| Loan approval | `loan-actions.ts` | Calls approveLoan, updates DB status |
| Loan disbursement | `loan-actions.ts` | Calls disburseLoan, Interop path |
| Repayment recording | `loan-actions.ts` | Posts repayment, updates payment record |
| Loan rejection | `loan-actions.ts` | Calls rejectLoan, updates status |
| Write-off | `loan-actions.ts` | Calls writeOffLoan, audit trail |
| Close | `loan-actions.ts` | Calls closeLoan |
| Reschedule | `loan-actions.ts` | Calls restructureLoan |
| Early payoff | `loan-actions.ts` | Calculate + process in one flow |
| Retry sync | `loan-actions.ts` | Re-syncs failed customer/loan/approval |
| GL accounts | `accounting.ts` | Lists GL accounts from Fineract |
| Journal entries | `accounting.ts` | Filtered by date, account, office |
| Trial balance | `accounting.ts` | Debits vs credits balance check |
| System health | `system-health.ts` | 5-category health snapshot |
| Reconciliation status | `reconciliation.ts` | Returns latest reconciliation results |
| Trigger reconciliation | `reconciliation.ts` | Runs reconciliation on demand |
| Loan products | `loan-products.ts` | Fineract + Lynia enrichment |
| Create product from Lynia | `loan-products.ts` | Maps and syncs product |
| Reports | `reports.ts` | Fineract reporting engine |

**1E.6 — Payment-to-Fineract flow test** (end-to-end):
1. Payment webhook confirms (EcoCash/OneMoney) → `payment-service` updates `payments.status='confirmed'`
2. `syncRepaymentToFineract()` posts to Fineract → `POST /loans/{id}/transactions?command=repayment`
3. Updates `payments.fineract_transaction_id`
4. Logs to `fineract_sync_log`
5. On failure: SQS retry → reconciliation catches drift

**1E.7 — Fineract health check validation** (`system-health.ts`):
- **Infrastructure**: Fineract reachability, circuit breaker state, response time
- **Sync Pipeline**: Pending/failed/exhausted counts, 24h success rate, last sync
- **Data Integrity**: Unsynced customers/loans/payments counts
- **Portfolio**: Reconciliation match/mismatch counts
- **Accounting**: Trial balance balanced (imbalance < $0.01), last journal entry

**1E.8 — Conflict resolver tests** (`services/shared/clients/fineract-sync/conflict-resolver.ts`):
- How are conflicts resolved when Lynia and Fineract disagree on loan state?
- What happens when a loan is approved in Lynia but creation failed in Fineract?
- Recovery path for orphaned Fineract entities

---

## Phase 2: Database Integrity Audit (1-2 PRs)

**Goal:** Verify schema completeness, migration consistency, table-to-code mapping, and data warehouse readiness.

**Database:** PostgreSQL 16 on RDS — 97 tables (78 public schema + 19 DW schema), 56 migrations.

### PR 2A: Schema Verification & Code-to-Table Mapping

**2A.1 — Verify all migrations are applied and ordered correctly:**
- Confirm sequence: `000_pre_migration.sql` → `001-017` → `018_remove_rls_for_aws.sql` → `019-056`
- Confirm `fix_missing_tables.sql` was applied (fixes loan table dependency order from migration 001)

**2A.2 — Cross-reference tables used in code vs. tables defined in migrations:**

| Service | Tables It Queries | Verify Exist In Migrations |
|---------|-------------------|---------------------------|
| **payment-service** | `payments`, `payment_events`, `loans`, `exchange_rates`, `payment_reminders` | All in 001, 026, 027, 029 |
| **admin-service** | `customers`, `loans`, `payments`, `devices`, `distributors`, `audit_log`, `kyc_submissions`, `credit_scores`, `device_handovers`, `inventory_*`, `product_*`, `admin_users` | All in 001, 002, 013, 023, 030-031, 037, 054 |
| **distributor-service** | `distributors`, `devices`, `distributor_commissions`, `inventory_movements`, `device_handovers`, `stock_transfers` | All in 002, 029, 030, 037, 054, 055 |
| **kyc-service** | `kyc_submissions`, `kyc_manual_reviews`, `customers`, `credit_scores` | kyc_manual_reviews fixed in migration 023 |
| **scoring-service** | `credit_scores`, `customers`, `loans`, `organizations`, `loan_products` | All in 001, 007, 028, 037 |
| **lock-service** | `devices`, `device_locks`, `device_lock_events`, `device_lock_triggers`, `loans` | device_lock_events in 056 |
| **whatsapp-service** | `whatsapp_sessions`, `whatsapp_messages`, `customers`, `kyc_submissions`, `loans`, `notifications` | Session columns fixed in migration 024 |
| **fineract-proxy-service** | `fineract_sync_log`, `fineract_rbz_reports`, `loans`, `customers`, `payments` | All in 019, 021, 038-040, 043-044 |
| **investor-reporting-service** | `dw.*` tables (all DW), `fineract_gl_snapshots` | All in 025, 044, 051 |
| **dw-sync-service** | All public tables (read) + `dw.fact_*`, `dw.dim_*` (write) | DW schema in 025 |

**2A.3 — Column-level integrity check:**
- Verify `whatsapp_sessions` has both old columns (`session_data`, `last_message_at`) AND new columns (`state_data`, `last_activity_at`) per migration 024
- Verify `kyc_submissions` has provider-agnostic columns (`kyc_provider`, `provider_submission_id`, `provider_status`) per migration 023
- Verify `credit_scores` has v2 model columns per scoring service requirements
- Verify `loan_products` has Fineract config columns (`fineract_product_id`) per migration 037
- Verify `devices` has `lock_status` enum including all states the lock-service uses
- Verify `payments` has `payment_type` enum covering: deposit, installment, late_fee, early_payoff

**2A.4 — Check for missing indexes on high-query columns:**
- `customers(phone_number)` — unique index
- `loans(customer_id, status)` — composite index
- `payments(loan_id, payment_date)` — index
- `devices(imei)` — unique index
- `whatsapp_sessions(phone_number, active)` — index
- `audit_log(created_at)` — partitioned
- `kyc_submissions(customer_id)` — index

**2A.5 — Verify foreign key relationships:**
- `loans.customer_id → customers.id`
- `payments.loan_id → loans.id`
- `devices.loan_id → loans.id` (nullable)
- `devices.customer_id → customers.id` (nullable)
- `distributor_commissions.distributor_id → distributors.id`
- `kyc_submissions.customer_id → customers.id`

**2A.6 — Verify unique constraints:**
- `customers.phone_number` UNIQUE
- `devices.imei` UNIQUE
- `loans.loan_number` UNIQUE
- `admin_users.email` UNIQUE
- `payments.transaction_id` UNIQUE (nullable)

### PR 2B: Data Warehouse & ETL Verification

**2B.1 — Verify DW schema completeness:**
- 7 dimension tables: `dw.dim_date`, `dw.dim_customer`, `dw.dim_loan_product`, `dw.dim_device`, `dw.dim_payment_provider`, `dw.dim_geography`, `dw.dim_credit_tier`
- 7 fact tables: `dw.fact_loan`, `dw.fact_payment`, `dw.fact_daily_portfolio`, `dw.fact_vintage_cohort`, `dw.fact_kyc`, `dw.fact_credit_decision`, `dw.fact_gl_daily`
- 3 report tables: `dw.rpt_borrowing_base`, `dw.rpt_monthly_financials`, `dw.rpt_fee_revenue_by_product`

**2B.2 — Verify dim_date is pre-populated** (2024-01-01 to 2030-12-31)

**2B.3 — Verify DW sync handlers write to correct tables:**
- `sync-credit-decision.ts` → `dw.fact_credit_decision`
- `sync-kyc.ts` → `dw.fact_kyc`
- `sync-loan.ts` → `dw.fact_loan` + `dw.dim_customer`
- `sync-payment.ts` → `dw.fact_payment`

**2B.4 — Verify investor reporting reads correct DW tables:**
- `borrowing-base.ts` → `dw.rpt_borrowing_base`
- `collections.ts` → `dw.fact_payment`
- `covenant-compliance.ts` → `dw.rpt_monthly_financials`
- `fee-revenue.ts` → `dw.rpt_fee_revenue_by_product`

**2B.5 — Verify exchange_rates table has current data**

### PR 2C: Database Connection & Deployment Integrity

**2C.1 — Verify database connection pooling:**
- `database.ts`: max=10, idleTimeout=60s, connectionTimeout=10s
- 13 Lambdas × 10 connections = 130 potential connections — verify RDS max_connections

**2C.2 — Verify deploy-to-rds.sh handles all edge cases**

**2C.3 — Verify partition strategy:**
- `audit_log_partitioned` — monthly partitions through 2026-12
- `whatsapp_messages_partitioned` — monthly partitions through 2026-12
- Verify current month (2026-03) partition exists

**2C.4 — Check for `transactions` table ghost reference**

---

## Phase 3: API Gateway & Endpoint Consistency (1 PR)

**Goal:** Every route in `template.yaml` maps to a real handler. Every handler has a route. Frontend API paths match backend.

| # | Task | Details |
|---|------|---------|
| 3.1 | **Map all template.yaml routes** | Extract every API event (~50+ routes across 13 services) |
| 3.2 | **Cross-reference with service routers** | Admin service internal router has ~85 routes behind `ANY /admin/{proxy+}` |
| 3.3 | **Check payment webhook routing** | Verify each webhook maps to correct handler |
| 3.4 | **Verify auth bypass annotations** | Public endpoints must have `Auth: { Authorizer: NONE }` |
| 3.5 | **Check frontend API paths match backend** | Admin portal API client vs admin service router |
| 3.6 | **Check distributor API paths match backend** | Distributor dashboard vs distributor service router |
| 3.7 | **Verify Fineract proxy routes match frontend** | `fineract.ts` (22 functions) vs proxy router (27 routes) |
| 3.8 | **Verify Fineract proxy routes in template.yaml** | All 27 routes defined and reachable |

---

## Phase 4: Frontend Audit (2 PRs)

### PR 4A: Distributor Dashboard

| # | Task | Files |
|---|------|-------|
| 4A.1 | Remove `eslint: { ignoreDuringBuilds: true }` | `frontend/apps/distributor-dashboard/next.config.js` |
| 4A.2 | Fix any ESLint errors that surface | Various component files |
| 4A.3 | Audit all API client files for correct paths, error handling | `frontend/apps/distributor-dashboard/src/lib/api/*.ts` |
| 4A.4 | Verify all 7 pages have loading states and error boundaries | All dashboard pages |
| 4A.5 | Check API timeout (15s may be too aggressive for Zimbabwe networks) | `frontend/packages/api-client/src/client.ts` |
| 4A.6 | Run existing frontend tests | `pnpm --filter @lynia/distributor-dashboard test` |

### PR 4B: Admin Portal

| # | Task | Files |
|---|------|-------|
| 4B.1 | Audit 12 API client files for correct paths | `frontend/apps/admin-portal/src/lib/api/*.ts` |
| 4B.2 | Cross-reference with admin service router (~85 routes) | `services/admin-service/src/index.ts` |
| 4B.3 | Verify Cognito config is from env vars, not hardcoded | `.env`, auth package |
| 4B.4 | Run existing frontend tests (20+ test files) | `pnpm --filter @lynia/admin-portal test` |
| 4B.5 | Check all 43 pages for consistent error handling | All dashboard pages |

---

## Phase 5: Infrastructure & AWS (1 PR)

| # | Task | Details |
|---|------|---------|
| 5.1 | **CloudFormation stack audit** | Verify no resource name conflicts across 9 stacks |
| 5.2 | **VPC DNS issue** | Document orphaned Route53 hosted zone; verify deploy-time credential injection |
| 5.3 | **SQS DLQ consumers** | Verify DLQ processing exists — add CloudWatch alarms on DLQ depth |
| 5.4 | **WAF rules** | Verify SQL injection + XSS rules in BLOCK mode (not COUNT) |
| 5.5 | **CloudWatch alarms** | Verify: Lambda errors, API Gateway 5xx, DLQ depth, RDS connections |
| 5.6 | **Fineract ECS health** | Verify health check works against production ECS |
| 5.7 | **Reserved concurrency** | Document risk of disabled limits on Scoring + Payment services |

---

## Phase 6: Integration Testing (1 PR)

| # | Task | Details |
|---|------|---------|
| 6.1 | **Run E2E tests** | 8 tests at `tests/e2e/e2e-001` through `e2e-008` |
| 6.2 | **Fineract ECS health** | Hit `GET /api/v1/fineract/system-health` — verify all 5 categories healthy |
| 6.3 | **Fineract sync pipeline integrity** | Check for failed/exhausted sync entries, unsynced customers/loans/payments |
| 6.4 | **Fineract reconciliation** | Trigger reconciliation, verify balance discrepancies < $0.01, GL matches, trial balance balanced |
| 6.5 | **Fineract loan lifecycle smoke test** | Create → approve → disburse → repay → close. Verify Lynia + Fineract in sync |
| 6.6 | **Fineract circuit breaker** | Verify config (5 failures, 60s reset), check CloudWatch metrics |
| 6.7 | **Fineract Interop** | Verify two-phase commit or standard disbursement based on feature flag |
| 6.8 | **Verify Trustonic production mode** | `TRUSTONIC_ENV=production` in Secrets Manager |
| 6.9 | **Verify payment provider credentials** | All 4 providers: production URLs + credentials |
| 6.10 | **Verify DIDIT KYC credentials** | Production API key + webhook secret |
| 6.11 | **Verify WhatsApp Cloud API** | Production phone number ID + access token |
| 6.12 | **Currency exchange rates** | Verify `system_config` + `exchange_rates` tables current |
| 6.13 | **Test admin.lyniafinance.com** | Login → dashboard → Fineract loans → GL accounts → trial balance → reconciliation |
| 6.14 | **Test distributor.lyniafinance.com** | Login → inventory → handover wizard → commissions |

---

## Phase 7: Production Readiness (1 PR)

| # | Task | Details |
|---|------|---------|
| 7.1 | **Add `/health` endpoints** | Lightweight health check per service — unauthenticated |
| 7.2 | **Currency rate automation** | CloudWatch alarm when exchange rates >24h stale |
| 7.3 | **Raise coverage thresholds** | Incrementally toward 80% after test additions |
| 7.4 | **Verify deployment safety** | `on_failure=ROLLBACK`, `--no-fail-on-empty-changeset`, `--no-confirm-changeset` |
| 7.5 | **Verify `.env` in `.gitignore`** | No credentials leak via git |
| 7.6 | **Database migration verification** | All 56 migrations applied to production RDS |
| 7.7 | **Verify RDS backup strategy** | Automated snapshots, WAL archival, point-in-time recovery |

---

## Execution Order & Parallelization

```
Phase 0 (baseline)                              ← MUST BE FIRST
    │
    ├── Phase 1A (payment silent catches)       ← PARALLEL
    ├── Phase 1B (admin service tests)          ← PARALLEL
    ├── Phase 1C (untested services)            ← PARALLEL
    ├── Phase 1D (cross-cutting fixes)          ← PARALLEL
    ├── Phase 1E (Fineract core banking)        ← PARALLEL
    │
    ├── Phase 2 (database integrity)            ← PARALLEL with Phase 1
    ├── Phase 3 (API route consistency)         ← PARALLEL with Phase 1
    ├── Phase 4A (distributor frontend)         ← PARALLEL with Phase 1
    ├── Phase 4B (admin frontend)              ← PARALLEL with Phase 1
    │
    └── Phase 5 (infrastructure & AWS)          ← After Phase 0
        │
        └── Phase 6 (integration testing)       ← After Phases 1+2+5
            │
            └── Phase 7 (production readiness)  ← LAST
```

## Final Verification Checklist

After all phases complete:
1. `pnpm run lint` — zero errors
2. `pnpm run test:coverage` — all pass, coverage above thresholds
3. `sam build --cached --parallel` — builds clean
4. `sam validate` — template valid
5. Database: All 56 migrations applied, no orphan table references, indexes verified
6. Deploy to staging: `sam deploy --config-env staging --no-confirm-changeset --no-fail-on-empty-changeset`
7. Smoke test staging API endpoints
8. Smoke test admin.lyniafinance.com and distributor.lyniafinance.com
9. All GitHub Actions workflows green on master
10. All external integrations verified with production credentials
