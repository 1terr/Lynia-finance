# Test Coverage Report

**Date:** 2026-03-15
**Sprint:** Site Audit 1.5

---

## New Tests Added This Sprint

### Backend — Error Handling Audit (Window D)

| File | Tests | Coverage Area |
|------|-------|---------------|
| `tests/unit/error-handling/error-responses.test.ts` | 30 | Response format compliance, payment handler errors, Fineract error handling, SQL leak prevention |

### Backend — Window A (Payments)

| File | Tests | Coverage Area |
|------|-------|---------------|
| `tests/unit/admin/payments.test.ts` | ~52 | 12 payment handlers x 4 cases (success, 401, 400, 500) + conflict 409s |

### Backend — Window B (Reports + Devices)

| File | Tests | Coverage Area |
|------|-------|---------------|
| `tests/unit/admin/reports.test.ts` | ~26 | 12 report handlers, date range filters, empty results |
| `tests/unit/admin/device-locks.test.ts` | ~16 | Lock/unlock, history, audit logging, 409 conflicts |
| `tests/unit/admin/device-handovers.test.ts` | ~10 | Paginated list, status update, search, JOINs |
| `tests/unit/admin/customer-update.test.ts` | ~6 | PATCH validation, disallowed fields, audit log |

### Backend — Window C (Fineract)

| File | Tests | Coverage Area |
|------|-------|---------------|
| `tests/unit/fineract-proxy/loan-actions-extended.test.ts` | ~16 | Reject/writeoff/close, 404/400/502 handling |

### Frontend — API Client Tests (Window D)

| File | Tests | Coverage Area |
|------|-------|---------------|
| `frontend/.../api/__tests__/client.test.ts` | 10 | Auth header, envelope unwrap, 401 redirect, 403, 500, timeout, no session |
| `frontend/.../api/__tests__/fineract-client.test.ts` | 18 | Base URL, error parsing, function exports, endpoint paths, limit clamping |
| `frontend/.../api/__tests__/customers.test.ts` | 15 | Query building, KYC approve/reject, sub-resources, notes |
| `frontend/.../api/__tests__/payments-api.test.ts` | 18 | Filter params, all payment actions, manual payment, CSV export |

---

## Test Suite Totals

### New Tests This Sprint

| Category | Files | Tests |
|----------|-------|-------|
| Backend unit tests | 7 | ~156 |
| Frontend API tests | 4 | 61 |
| Backend error audit | 1 | 30 |
| **Total new** | **12** | **~247** |

### Full Test Suite

| Category | Files | Description |
|----------|-------|-------------|
| Unit tests | ~100 | Service-level handler and utility tests |
| Integration tests | 40 | Cross-service data flow and API tests |
| E2E tests | 7 | Complete user journey tests |
| Contract tests | 8 | API response format compliance |
| Performance tests | 4 | Dashboard, DB query, cold start benchmarks |
| Property-based tests | 11 | Invariant verification (KYC, inventory, IMEI) |
| Frontend tests | 17 | API clients, hooks, auth, validation |
| **Total** | **~187** | All passing on CI |

---

## CI/CD Test Results

**Latest Commit:** `0adec4ae` — 2026-03-15

```
Test Suites: ALL PASSED
Tests:       ALL PASSED
Linter:      PASSED
SAM Build:   PASSED
Deploy:      SUCCESS (staging + production)
```

---

## Coverage by Service

| Service | Handler Files | Test Files | Status |
|---------|--------------|------------|--------|
| admin-service | 16 | 12+ | Covered |
| fineract-proxy-service | 9 | 3+ | Covered |
| whatsapp-service | 5 | 5 | Covered |
| kyc-service | 3 | 3+ | Covered |
| payment-service | 8 | 12 | Covered |
| lock-service | 5 | 6 | Covered |
| scoring-service | 3 | 3 | Covered |
| notification-service | 2 | 1 | Covered |
| shared utilities | 12+ | 12 | Covered |
| Frontend API clients | 9 | 6 | Covered |

---

### Error Handling Gap Fixes (Phase 4)

| File | Tests | Coverage Area |
|------|-------|---------------|
| `tests/unit/fineract-proxy/gl-accounts-error-handling.test.ts` | 9 | FineractApiError → 502, generic Error → 500, no stack trace leaks |
| `tests/unit/admin/inventory-management.test.ts` (+3) | 3 | DB failure on device update, approval update, rejection update → 500 |
| `tests/unit/payment-service/error-responses.test.ts` | 9 | requestId in 500/400 responses for all 7 payment handlers |

### Phase 3 — SMS, Hooks, Lock-Service, Frontend Components

| File | Tests | Coverage Area |
|------|-------|---------------|
| `tests/unit/notification/sms-channel.test.ts` | 11 | AWS SNS, Zimbabwe phone validation, rate limiting |
| `frontend/.../__tests__/hooks/*.test.ts` | 63 | useAuth, useSessionTimeout, usePermission, useDashboardData, permissions matrix |
| `tests/unit/lock-service/router-migration.test.ts` | ~15 | createRouter() migration, error envelope, 404 unknown routes |
| `tests/unit/notification/email-channel.test.ts` | varies | Email channel placeholder tests |
| `frontend/.../components/__tests__/*.test.ts` | varies | DashboardHeader, Sidebar, payment/KYC/product forms |

---

## Updated Test Suite Totals

### All Tests Added in Site Audit 1.5

| Category | Files | Tests |
|----------|-------|-------|
| Backend unit tests (Phase 1-2) | 7 | ~156 |
| Frontend API tests (Phase 1-2) | 4 | 61 |
| Backend error audit (Phase 1-2) | 1 | 30 |
| Phase 3 — SMS, hooks, lock-service | 4+ | ~89 |
| Phase 4 — Error handling fixes | 3 | 21 |
| Frontend component tests | 15+ | varies |
| **Total new** | **34+** | **~357+** |

### Full Test Suite (Post-Sprint)

**2665 tests passing across 117 test suites**

---

### Phase 6 — Frontend Component Tests + Accessibility Audit

| File | Tests | Coverage Area |
|------|-------|---------------|
| `components/products/__tests__/organization-form.test.tsx` | 11 | Create/edit, validation, conditional fields, trust level, a11y |
| `components/products/__tests__/device-model-form.test.tsx` | 9 | Create/edit, price validation, margin calc, a11y |
| `components/products/__tests__/product-form.test.tsx` | 10 | Validation, rate auto-calc, category-specific fields, a11y |
| `components/payments/__tests__/RecordPaymentForm.test.tsx` | 7 | Form fields, validation, dropdown options, a11y |
| `components/devices/__tests__/HandoverScheduleForm.test.tsx` | 8 | Required fields, submit/cancel, loading state, a11y |
| `components/kyc-review/__tests__/KYCReviewCard.test.tsx` | 13 | Expand/collapse, approve/reject flows, templates, a11y |
| `components/kyc-review/__tests__/KYCQueueStats.test.tsx` | 4 | Stat cards with values, a11y |
| `components/kyc-review/__tests__/KYCReviewFilters.test.tsx` | 6 | Filter dropdowns, onChange callbacks, a11y |
| `components/kyc-review/__tests__/SLAIndicator.test.tsx` | 5 | Full/compact mode, progress bar, critical badge, a11y |
| `components/kyc-review/__tests__/ReviewHistory.test.tsx` | 8 | Empty state, review entries, reviewer info, a11y |
| `components/kyc-review/__tests__/DocumentViewer.test.tsx` | 5 | Image sections, alt text, document type, a11y |
| `components/dashboard/__tests__/Sidebar.test.tsx` | 8 | Nav items, permissions, user info, overlay, a11y |
| `components/dashboard/__tests__/DashboardHeader.test.tsx` | 5 | Heading, notification button, avatar, a11y |
| `components/payments/__tests__/PaymentSummaryCards.test.tsx` | 4 | Loading skeleton, card labels, counts, a11y |
| `components/payments/__tests__/PaymentFilters.test.tsx` | 7 | All filter controls, onChange, a11y |
| `app/(dashboard)/__tests__/dashboard-page.test.tsx` | 2 | Smoke test + a11y |
| `app/(dashboard)/customers/__tests__/customers-page.test.tsx` | 3 | Smoke + search + a11y |
| `app/(dashboard)/payments/__tests__/payments-page.test.tsx` | 3 | Smoke + search + a11y |
| `app/(auth)/login/__tests__/login-page.test.tsx` | 4 | Form fields, sign in button, a11y |

---

## Updated Test Suite Totals

### All Tests Added in Site Audit 1.5

| Category | Files | Tests |
|----------|-------|-------|
| Backend unit tests (Phase 1-2) | 7 | ~156 |
| Frontend API tests (Phase 1-2) | 4 | 61 |
| Backend error audit (Phase 1-2) | 1 | 30 |
| Phase 3 — SMS, hooks, lock-service | 4+ | ~89 |
| Phase 4 — Error handling fixes | 3 | 21 |
| Phase 5 — Architecture debt | 6+ | ~44 |
| Phase 6 — Component tests + a11y | 19 | 122 |
| **Total new** | **44+** | **~523** |

### Full Frontend Test Suite (Post-Phase 6)

**666 tests passing across 79 test suites — 0 failures**

Accessibility: Every new test file includes `jest-axe` axe-core checks. ESLint `jsx-a11y/recommended` enforced at lint time.

---

## Remaining Gaps

1. ~~**Frontend component tests**~~ — **DONE** (Phase 6: 19 new files, 122 tests)
2. ~~**Accessibility audit**~~ — **DONE** (Phase 6: tooling + 15 component fixes + axe in all tests)
3. **i18n tests** — No Shona/Ndebele translation tests (translations not yet implemented)
4. **Remaining ESLint a11y warnings** — ~40 `label-has-associated-control` in page-level client components (lower priority)
