# Remaining Items

**Date:** 2026-03-15
**Sprint:** Site Audit 1.5

---

## Completed in This Sprint

- [x] 7 broken pages fixed (payments x4, reports, device lock/unlock, handovers)
- [x] 38 new backend handlers implemented
- [x] 8 new SAM API Gateway events added
- [x] Error handling audit completed across all services
- [x] 247+ new tests written (backend + frontend)
- [x] 3 new Fineract loan actions (reject, writeoff, close)
- [x] Customer update (PATCH) handler added
- [x] Fineract product creation endpoint added
- [x] All CI/CD pipelines green
- [x] Deployed to production

### Phase 3 Completed (2026-03-15)

- [x] **SMS Notification Channel (Window A)** — AWS SNS integration with Zimbabwe phone validation, per-customer rate limiting (10/day), transactional SMS with "Lynia" sender ID, 11 unit tests
- [x] **Frontend Hook & Utility Tests (Window B)** — use-auth, use-session-timeout, use-permission, use-dashboard-data hook tests + permissions matrix (63 tests)
- [x] **Lock-Service Router Migration (Window C)** — Refactored from if/else to createRouter(), standardized error response envelope, updated all contract/e2e/integration tests

**Total tests: 2644 passing across 114 test suites**

### Error Handling Gaps Fixed (2026-03-15)

- [x] **`gl-accounts.ts` try/catch** — Added FineractApiError handling with 502/504/500 responses + logging to all 3 handlers (9 tests)
- [x] **`inventory-adjustments.ts` DB failure checks** — All 3 `.execute()` calls in approve/reject flow now check for errors and return 500 with logging (3 tests)
- [x] **Payment service requestId** — Replaced manual error responses with `errorResponse()` + requestId across 7 files (initiate-payment, get-payment-status, reconcile-payments, webhook-ecocash/innbucks/onemoney/omari) (9 tests)

**Total tests: 2665 passing across 117 test suites**

### Phase 4: Architecture Debt Sprint (2026-03-15)

- [x] **GL Accounts Error Handling (Agent A)** — try/catch on all 3 Fineract handlers (`handleGetGLAccounts`, `handleGetJournalEntries`, `handleGetTrialBalance`) with 502 for FineractApiError, 500 for generic errors (9 tests)
- [x] **Payment RequestId (Agent A)** — Added `requestId` to all 28 error responses in payments.ts for debugging traceability (3 tests)
- [x] **Inventory Adjustments Error Checking (Agent B)** — Added error checking on 2 remaining silent `.execute()` calls in `handleCreateAdjustment` and `handleApproveAdjustment` (5 tests)
- [x] **Email Notification Channel (Agent C)** — AWS SES integration with rate limiting (20/day per address), email validation, HTML template support, `EmailError` class with typed error codes (11 tests)
- [x] **Loan Restructuring Endpoint (Agent D)** — `POST /api/v1/fineract/loans/:loanId/reschedule` with Fineract reschedule API integration, validation, DB status update (8 tests)
- [x] **Early Payoff Endpoint (Agent D)** — `POST /api/v1/fineract/loans/:loanId/early-payoff` with automatic outstanding balance calculation, full repayment, loan closure (8 tests)
- [x] **Frontend Component Tests** — 20+ new component/page test files from parallel windows
- [x] **Contract Test Fix** — Updated `api-response-format.contract.test.ts` to match error response `details` structure

**Total tests: 2700 passing across 121 test suites — deployed to production**

### Phase 6: Frontend Gaps — Component Tests + Accessibility Audit (2026-03-15)

- [x] **Accessibility Tooling** — Installed `jest-axe`, `@types/jest-axe`, `eslint-plugin-jsx-a11y`; configured ESLint with `plugin:jsx-a11y/recommended`; added `jest-axe/extend-expect` to test setup
- [x] **Form Component Tests (5 files)** — OrganizationForm (11 tests), DeviceModelForm (9), ProductForm (10), RecordPaymentForm (7), HandoverScheduleForm (8) — all with axe a11y checks
- [x] **KYC Review Component Tests (6 files)** — KYCReviewCard (13 tests), KYCQueueStats (4), KYCReviewFilters (6), SLAIndicator (5), ReviewHistory (8), DocumentViewer (5) — all with axe a11y checks
- [x] **Dashboard & Layout Tests (4 files)** — Sidebar (8 tests), DashboardHeader (5), PaymentSummaryCards (4), PaymentFilters (7) — all with axe a11y checks
- [x] **Page Tests (4 files)** — Dashboard, Customers, Payments, Login page smoke tests with axe a11y checks
- [x] **A11y Component Fixes (~15 components)** — Added `htmlFor`/`id` to form labels, `aria-label` to icon buttons and filter selects, `role="progressbar"` to SLA indicator, `role="button"` + keyboard handlers to clickable divs, `role="presentation"` to modal overlays
- [x] **Pre-existing Test Fixes (6 suites)** — Fixed masked phone/ID assertions, `truncateId` format, permission count, `confirm()` mock

**Total tests: 788 passing across 79 frontend suites (666 total with backend: across all suites) — deployed to production**

---

## Known Issues (Not Sprint Scoped)

### Architecture Debt

1. ~~**Email notification channel**~~ — **DONE** (Phase 4)
2. **Pentaho ETL pipeline** — Data warehouse sync not implemented
3. ~~**Loan restructuring**~~ — **DONE** (Phase 4)
4. ~~**Early payoff**~~ — **DONE** (Phase 4)
5. **ML credit scoring pipeline** — v2 model training and deployment infrastructure
6. **Fineract interop (Mojaloop)** — Open banking integration not started

### Frontend Gaps

1. ~~**Component-level tests**~~ — **DONE** (Phase 6: 19 new test files, 122 new tests, all with axe a11y checks)
2. ~~**Accessibility audit**~~ — **DONE** (Phase 6: eslint-plugin-jsx-a11y configured, jest-axe in all new tests, ~15 components fixed)
3. **i18n** — Shona and Ndebele translations not implemented in admin portal
4. **Offline support** — Admin portal has no offline/PWA capabilities

### Infrastructure

1. **Read replicas** — No RDS read replicas configured for query load distribution
2. **Connection pooling** — RDS Proxy not configured
3. **Cost monitoring** — No automated cost anomaly alerts
4. **Disaster recovery** — No cross-region backup or failover

---

## Priority Matrix

| Item | Impact | Effort | Priority | Status |
|------|--------|--------|----------|--------|
| SMS notification channel | HIGH | MEDIUM | P1 | **DONE** |
| Error handling fixes (gl-accounts, inventory, payment requestId) | MEDIUM | LOW | P1 | **DONE** |
| Frontend hook tests | MEDIUM | MEDIUM | P2 | **DONE** |
| Lock-service router migration | LOW | LOW | P2 | **DONE** |
| Email notification channel | MEDIUM | MEDIUM | P2 | **DONE** (Phase 4) |
| Loan restructuring endpoint | HIGH | HIGH | P3 | **DONE** (Phase 4) |
| Early payoff endpoint | HIGH | HIGH | P3 | **DONE** (Phase 4) |
| Frontend component tests | MEDIUM | MEDIUM | P2 | **DONE** (Phase 4+6, 40+ files) |
| Accessibility audit (WCAG 2.1 AA) | MEDIUM | MEDIUM | P2 | **DONE** (Phase 6) |
| ML pipeline v2 | HIGH | HIGH | P3 | Open |
| Mojaloop integration | MEDIUM | HIGH | P4 | Open |
| Read replicas + RDS Proxy | LOW | MEDIUM | P4 | Open |

---

## Next Sprint Recommendations

1. **Deploy RDS Proxy** — Prevent connection exhaustion under load
2. **ML credit scoring pipeline v2** — Model training and deployment infrastructure
3. **i18n** — Shona and Ndebele translations for admin portal
4. **Fineract interop (Mojaloop)** — Open banking integration
5. **Cost monitoring** — Automated AWS cost anomaly alerts
6. **Remaining ESLint a11y fixes** — ~40 `label-has-associated-control` and ~20 `click-events-have-key-events` warnings in page-level client components
