# Post-Refactoring Recommendations

**Date:** 2026-02-26
**Context:** All 8 refactoring phases (0-7) are complete. 78 test suites, 2,013 tests, 8 monoliths decomposed, deployed to production. This document captures findings, risks, and prioritized next steps discovered during the refactoring process.

---

## 1. Critical: Security Vulnerabilities

**20 dependency vulnerabilities detected** (2 critical, 9 high, 7 moderate, 2 low).

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| Next.js 14.2.x | Critical | Information exposure in dev server (GHSA-3h52-269p-cp9r) | Upgrade to 14.2.30+ |
| Next.js 14.2.x | Critical | Cache poisoning race condition (GHSA-qpjv-v59x-3qc4) | Upgrade to 14.2.30+ |

**Action:** Run `pnpm audit --fix` and manually upgrade Next.js in both frontend apps. This is the single highest-priority item — critical vulnerabilities in the admin portal used by staff daily.

```bash
cd frontend/apps/admin-portal && pnpm update next@latest
cd frontend/apps/distributor-dashboard && pnpm update next@latest
pnpm audit
```

---

## 2. Critical: Lock Service Has 11% Test Coverage

The lock service manages **device lending and handovers** — a core business operation. Three files totaling 1,545 lines have near-zero coverage:

| File | Lines | Line Coverage | Branch Coverage |
|------|-------|---------------|-----------------|
| `lock-service/src/handover-service.ts` | 632 | 2.5% | 0% |
| `lock-service/src/lock-management-service.ts` | 570 | 17.2% | 4.7% |
| `lock-service/src/trustonic-provider.ts` | 343 | 11.5% | 6.9% |

**Risk:** A bug in device lock/unlock directly impacts loan enforcement — if a device can't be locked after missed payments, the business loses its primary collateral mechanism.

**Action:** Write characterization tests following the same pattern used for payment-service and admin-service. Priority test cases:
- Device lock after missed payment threshold
- Device unlock after full repayment
- Handover flow (verify-identity → verify-imei → verify-deposit → record-condition → complete)
- Trustonic API failure handling and retry behavior
- Concurrent lock/unlock race conditions

---

## 3. Critical: 75 `console.*` Calls Remain in 4 Services

Despite cleaning up fineract-proxy, distributor, admin, payment, scoring, and whatsapp services, four services still use `console.*` instead of the structured logger:

| Service | `console.*` Count | Impact |
|---------|-------------------|--------|
| lock-service | 29 | PII leak risk — device IMEIs, customer IDs logged without masking |
| notification-service | 13 | Reminder scheduler logs without structured format |
| kyc-service (providers) | 9 | `didit-service.ts`, `smile-identity-service.ts` — external API responses logged raw |

**Action:** Replace all `console.*` calls with `import logger from '../../shared/utils/logger'` and use structured logging with PII masking per CLAUDE.md Section 9. This is a compliance requirement for Zimbabwe's data protection regulations.

---

## 4. High: Frontend TypeScript Hardening

Both frontend apps have `ignoreBuildErrors: true` in `next.config.js`, masking type errors that could cause runtime failures.

| App | TypeScript Errors | Effort |
|-----|-------------------|--------|
| admin-portal | 161 errors | Large — missing exports, type incompatibilities, implicit `any` |
| distributor-dashboard | 2 errors | Small — `KYCStatus` vs `KycStatus` type mismatch |

**Recommended approach:**
1. Fix distributor-dashboard first (2 errors, quick win)
2. For admin-portal, categorize the 161 errors:
   - Missing API client exports (`confirmPayment`, `failPayment`, `PaymentListParams`, etc.)
   - Type incompatibilities in components (`PaymentDetail.tsx`, `SLAIndicator.tsx`)
   - Implicit `any` in hooks (`useKYCReview.ts`)
3. Fix in batches by domain (payments → KYC → inventory → dashboard)
4. Remove `ignoreBuildErrors: true` only after all errors are resolved
5. Add `tsc --noEmit` to CI pipeline to prevent regression

---

## 5. High: 9 Services Lack Integration Tests

Unit tests verify individual handlers in isolation. Integration tests verify the full request → response cycle including middleware, routing, database queries, and error handling. Currently:

| Service | Unit Tests | Integration Tests | Risk |
|---------|-----------|-------------------|------|
| admin-service | 98 | None | Medium — internal tool, staff impact |
| distributor-service | 32 | None | Medium — distributor operations |
| kyc-service | 28 | None | **High** — customer onboarding gate |
| lock-service | 0 | None | **Critical** — loan enforcement |
| notification-service | 0 | None | High — payment reminders |
| whatsapp-service | 47 | None | **Critical** — primary customer channel |
| investor-reporting-service | 13 | None | Low — read-only reporting |
| form-submission-service | 25 | None | Low — public form capture |
| dw-sync-service | 15 | None | Low — async data sync |

**Priority order for integration tests:**
1. **whatsapp-service** — highest customer impact, processes hundreds of daily interactions
2. **kyc-service** — gates customer onboarding, external API dependency (Didit/Smile Identity)
3. **lock-service** — loan enforcement mechanism
4. **notification-service** — payment reminder scheduling
5. Remaining services as capacity allows

---

## 6. Medium: Large Files Still Over 600 Lines

The refactoring eliminated all monolithic routers, but business logic files remain large:

| File | Lines | Domain |
|------|-------|--------|
| `whatsapp-service/src/index.ts` | 793 | Main WhatsApp orchestrator |
| `payment-service/src/penalty-service.ts` | 756 | Late payment penalty calculation |
| `shared/clients/fineract.ts` | 736 | Fineract API client |
| `shared/data-privacy.ts` | 723 | Data privacy/GDPR rules |
| `payment-service/src/write-off-service.ts` | 715 | Bad debt write-off |
| `payment-service/src/reschedule-service.ts` | 709 | Loan rescheduling |
| `payment-service/src/payment-service.ts` | 708 | Payment orchestration |
| `shared/clients/fineract-sync.ts` | 699 | Fineract sync logic |
| `lock-service/src/handover-service.ts` | 632 | Device handover flow |
| `shared/types/fineract.ts` | 620 | Fineract type definitions |

**Assessment:** These are mostly business logic files, not routing monoliths. They're harder to decompose without deep domain understanding. Recommended approach:
- Extract pure helper functions and constants into separate files
- Split large files along logical seams (e.g., `penalty-service.ts` → `penalty-calculator.ts` + `penalty-scheduler.ts`)
- `fineract.ts` type definitions are fine as-is (type files tend to be long)
- Don't decompose just for line count — ensure each extracted module has a clear single responsibility

---

## 7. Low: Known Payment Bugs (Documented)

Two bugs documented as skipped tests in Phase 0 remain unfixed:

**Bug #1 — Currency conversion no-op** (`payment-service.ts:117`)
```typescript
const amountUsd = currency === 'USD' ? amount : amount; // Both branches return amount
```
- **Impact:** ZWL and ZAR transaction limits are applied as if they were USD amounts
- **Fix:** Implement actual conversion using exchange rates from `currency-conversion.ts`
- **Risk:** Low immediate risk (most transactions are USD), but incorrect for multi-currency compliance

**Bug #2 — Missing payment step trigger** (`payment-service.ts:403`)
```typescript
// TODO: Trigger next step based on payment type
```
- **Impact:** After payment completes, the next workflow step (e.g., loan disbursement) requires manual intervention
- **Fix:** Publish an SQS event that triggers the appropriate downstream service
- **Risk:** Operational overhead — staff must manually advance loan workflows

---

## 8. Positive Findings

Several areas are in excellent shape after the refactoring:

| Area | Status | Detail |
|------|--------|--------|
| `as any` casts in services | Zero | Full TypeScript strict compliance in all backend service source |
| TODO/FIXME comments | Zero | All technical debt is tracked in tests, not comments |
| Structured logging | 10/14 services | admin, scoring, kyc, payment, whatsapp, distributor, fineract-proxy, dw-sync, form-submission, investor-reporting all use structured logger |
| Lambda router adoption | 10/14 services | Consistent routing pattern with auth, CORS, error handling |
| OpenAPI documentation | 51 endpoints | Full API spec for all services |
| Error code standard | 27 codes | Implemented per CLAUDE.md Section 8 |
| Service documentation | 12/12 READMEs | Every service has purpose, endpoints, env vars, architecture notes |

---

## Prioritized Action Plan

### Immediate (This Week)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Upgrade Next.js to 14.2.30+ in both frontend apps | 1 hour | Closes 2 critical CVEs |
| 2 | Run `pnpm audit --fix` for remaining vulnerabilities | 30 min | Closes high/moderate CVEs |

### Next Sprint

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 3 | Replace 29 `console.*` calls in lock-service with logger | 2 hours | Compliance + observability |
| 4 | Replace 13 `console.*` calls in notification-service | 1 hour | Compliance + observability |
| 5 | Replace 9 `console.*` calls in kyc-service providers | 1 hour | Compliance + PII protection |
| 6 | Fix distributor-dashboard 2 TS errors, remove `ignoreBuildErrors` | 1 hour | Type safety for distributor app |

### Following Sprint

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 7 | Write lock-service characterization tests (target: 80% coverage) | 1-2 days | Protects core lending mechanism |
| 8 | Write whatsapp-service integration tests | 1 day | Protects primary customer channel |
| 9 | Write kyc-service integration tests | 1 day | Protects onboarding pipeline |
| 10 | Fix admin-portal 161 TS errors, remove `ignoreBuildErrors` | 2-3 days | Type safety for staff dashboard |

### Backlog

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 11 | Fix currency conversion bug (Bug #1) | 2 hours | Multi-currency compliance |
| 12 | Fix payment step trigger bug (Bug #2) | 4 hours | Eliminates manual workflow intervention |
| 13 | Add integration tests for remaining 6 services | 3-4 days | Full integration coverage |
| 14 | Decompose large business logic files (>600 lines) | 1 week | Maintainability |
| 15 | Notification service test coverage (reminder-scheduler at 14%) | 1 day | Protects payment reminder scheduling |

---

## Architecture Notes for Future Development

### Pattern: Barrel Re-export for Backwards Compatibility

When decomposing large files, the original file becomes a thin re-export. This prevents breaking any existing imports:

```typescript
// services/shared/fineract-rbz-reporting.ts (was 1,772 lines, now 7)
export * from './rbz-reporting/index';
```

**Use this pattern** whenever splitting a file that is imported by multiple consumers.

### Pattern: Lambda Router with Static-Before-Parameterized

Route ordering matters. Static paths must be registered before parameterized paths:

```typescript
export const handler = createRouter({
  'GET /api/v1/loans/pending':     handleGetPendingLoans,    // static — must come first
  'GET /api/v1/loans/overdue':     handleGetOverdueLoans,    // static — must come first
  'GET /api/v1/loans':             handleGetLoans,           // static catch-all
  'GET /api/v1/loans/:loanId':     handleGetLoanDetail,      // parameterized — after statics
});
```

### Pattern: `skipAuth` for Services Behind API Gateway Cognito Authorizer

Services where auth is handled at the API Gateway level (Cognito authorizer) should use `skipAuth: true` to avoid double-auth overhead:

```typescript
export const handler = createRouter({ ... }, { serviceName: 'fineract-proxy', skipAuth: true });
```

### Pattern: `query()` Returns `{ data, error }`, Not `.rows`

The shared database client returns `{ data: T[], error: Error | null }`. Never access `.rows` on the result — that's the raw `pg` driver interface, not our wrapper. This bug was found and fixed in `inventory-reports.ts` during the refactoring.
