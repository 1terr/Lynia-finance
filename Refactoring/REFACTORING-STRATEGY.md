# Lynia Finance — Test-Driven Codebase Refactoring Strategy

## Context

The entire Lynia Finance codebase was AI-generated and has grown to 14 microservices (~36,000 lines of TypeScript), 2 frontend apps (Next.js 14), and 16 CloudFormation templates. While the architecture is solid (shared utilities, RBAC, monorepo with pnpm workspaces), several code quality issues have accumulated that threaten long-term maintainability and safety.

### Why Refactor Now

1. **Monolithic files are untestable** — `admin-service/src/index.ts` is 3,306 lines with 100+ handlers in a single file. This is impossible to unit test, hard to review, and risky to modify.
2. **Test coverage is dangerously low for a financial system** — backend coverage sits at 35-40% vs the 80-95% required by our own CLAUDE.md standards. Five entire services have zero tests.
3. **The security backbone has no tests** — `authorization.ts` middleware is imported by every authenticated endpoint but has zero dedicated tests. A bug here means a bug everywhere.
4. **Duplicated code creates drift** — phone validation, response helpers, and circuit breakers are duplicated across services with subtle differences that will diverge further.
5. **Tooling gaps** — no Prettier config, `any` types only warned not errored, dependency versions mismatched across services.

### Goal

Efficient, well-documented, thoroughly tested code — achieved incrementally with zero production breakage.

### Principle

**Never refactor code you cannot test. Write characterization tests first, refactor second, verify third.**

---

## Codebase Assessment Summary

### Architecture (What's Good)

| Area | Status | Details |
|------|--------|---------|
| Microservices | Strong | 14 services with clear boundaries |
| Shared utilities | Strong | 32 TypeScript files in `services/shared/` |
| Auth (Cognito) | Strong | RBAC with `getAuthContext()`, `requireRole()` |
| Frontend monorepo | Strong | Shared packages (`@lynia/auth`, `@lynia/api-client`, `@lynia/utils`) |
| Infrastructure | Strong | 16 CloudFormation templates, full CI/CD |
| E2E tests | Good | 7 complete user journey tests |
| Contract tests | Good | 8 API conformance test suites |

### Code Quality Issues Found

| Issue | Severity | Where | Impact |
|-------|----------|-------|--------|
| admin-service monolith (3,306 lines) | Critical | `services/admin-service/src/index.ts` | Untestable, unmaintainable |
| whatsapp onboarding monolith (1,323 lines) | High | `services/whatsapp-service/src/onboarding.ts` | 8-step flow in single file |
| RBZ reporting monolith (1,772 lines) | High | `services/shared/fineract-rbz-reporting.ts` | 10+ report types in one file |
| fineract proxy monolith (1,084 lines) | High | `services/fineract-proxy-service/src/index.ts` | Large routing handler |
| Manual if/else routing | Medium | 8/14 services | 30-50 line routing chains |
| `console.error` instead of logger | Medium | admin-service (35 calls), others | Inconsistent logging |
| Phone validation duplication | Medium | `shared/utils/validation.ts` vs `whatsapp-service/src/onboarding.ts` | Logic drift risk |
| CircuitBreaker duplication | Medium | `shared/utils/` vs `whatsapp-service/src/utils/` | Duplicated implementation |
| Response helper duplication | Low | `form-submission-service` has its own | Should use shared |
| No `.prettierrc` at root | Low | Project root | Formatting inconsistency |
| `no-explicit-any` set to warn | Low | `.eslintrc.json` | Type safety gap |
| axios version mismatch | Low | Root `^1.13.4` vs services `^1.6.5` | Potential incompatibility |
| TypeScript version mismatch | Low | Root `^5.2.0` vs services `^5.3.3` | Build inconsistency |
| 2 TODO comments without issues | Low | `payment-service.ts:117`, `payment-service.ts:403` | Known bugs undocumented |

### Test Coverage Gaps

| Service | Unit Tests | Integration | Contract | E2E | Maturity |
|---------|-----------|-------------|----------|-----|----------|
| whatsapp-service | 7 files | Yes | Yes | Yes | **Excellent** |
| kyc-service | 1 file | Yes | Yes | Yes | **Excellent** |
| payment-service | 0 | Yes | Yes | Yes | Good |
| scoring-service | 0 | Partial | Yes | Yes | Good |
| lock-service | 0 | Yes | Yes | Yes | Good |
| notification-service | 0 | Yes | Yes | No | Moderate |
| fineract-proxy-service | 0 | Yes | Yes | Partial | Moderate |
| **admin-service** | **0** | **0** | **0** | Partial | **Poor** |
| **distributor-service** | **0** | **0** | **0** | Partial | **Poor** |
| **dw-sync-service** | **0** | **0** | **0** | **0** | **None** |
| **form-submission-service** | **0** | **0** | **0** | **0** | **None** |
| **investor-reporting-service** | **0** | **0** | **0** | **0** | **None** |
| Shared utilities | Limited | Limited | 0 | 0 | **Poor** |

**Backend coverage thresholds**: Currently 35-40% (CLAUDE.md requires 80% global, 95% payment-service, 90% scoring-service)

---

## Phase 0: Test Infrastructure Hardening

### Why This Phase Exists

You cannot safely refactor code without tests. This phase adds zero production code changes — only tests and tooling configuration. It establishes the safety net everything else depends on.

### Risk Level: Minimal

No production code is modified. Only test files and configuration.

---

### Task 0A: Fix Tooling Configuration

**Why:** Inconsistent tooling means inconsistent code quality. A missing Prettier config means formatting depends on individual developer setups. `any` as a warning means type safety violations silently accumulate.

| # | Task | File | What Changes | Why |
|---|------|------|-------------|-----|
| 1 | Create root Prettier config | `.prettierrc` (new) | Add consistent formatting rules (singleQuote, trailingComma, printWidth, etc.) | Currently missing entirely — formatting is inconsistent across 36K lines |
| 2 | Tighten ESLint `any` rule | `.eslintrc.json` | Change `@typescript-eslint/no-explicit-any` from `"warn"` to `"error"`, add targeted overrides for `database.ts` and `fineract-rbz-reporting.ts` | `any` defeats TypeScript's purpose; financial code needs strict types |
| 3 | Raise coverage thresholds | `jest.config.js` | Raise `coverageThreshold.global` from 35-40% to 50% as interim step | Current 35-40% is dangerously low for fintech; 50% is achievable immediately, will ramp to 80%+ |

**Verification:** `pnpm lint` passes, `pnpm test` passes with existing tests.

---

### Task 0B: Characterization Tests for Shared Utilities

**Why:** These 7 modules are imported by every service but have **zero dedicated tests**. They are the foundation — a bug in any of them cascades across the entire system.

| # | New Test File | Target Module | Lines | Why This Module Is Critical |
|---|---------------|---------------|-------|---------------------------|
| 1 | `tests/unit/shared/authorization.test.ts` | `services/shared/middleware/authorization.ts` | 163 | **Security backbone.** `getAuthContext()` parses JWT claims for every request. `requireRole()` controls who can access what. `requireOwnership()` prevents users from accessing others' data. A bug here = security breach across all 14 services. Zero tests exist. |
| 2 | `tests/unit/shared/database-query-builder.test.ts` | `services/shared/clients/database.ts` | 370 | **Every database operation** flows through this QueryBuilder (custom Supabase replacement). SELECT, INSERT, UPDATE, DELETE, UPSERT — all parameterized queries built here. A regression means data corruption. |
| 3 | `tests/unit/shared/response.test.ts` | `services/shared/utils/response.ts` | 145 | **Every API response** formatted through `successResponse()`, `errorResponse()`, `validationErrorResponse()`. Includes security headers (CORS, CSP, XSS protection). Wrong headers = security vulnerability. |
| 4 | `tests/unit/shared/validation.test.ts` | `services/shared/utils/validation.ts` | 63 | Validates phone numbers, emails, UUIDs, IMEI numbers, national IDs. **Wrong validation = accepting fraudulent identity documents or rejecting legitimate customers.** |
| 5 | `tests/unit/shared/circuit-breaker.test.ts` | `services/shared/utils/circuit-breaker.ts` | 122 | Protects against cascading failures when external APIs (Smile Identity, EcoCash, Trustonic) go down. Without tests, we can't verify it opens/closes correctly under failure conditions. |
| 6 | `tests/unit/shared/rate-limiter.test.ts` | `services/shared/utils/rate-limiter.ts` | 171 | **DoS protection.** Rate limits on auth endpoints, OTP endpoints, payment endpoints. If rate limiting fails silently, we're exposed to brute-force attacks. |
| 7 | `tests/unit/shared/logger.test.ts` | `services/shared/utils/logger.ts` | 263 | **PII masking.** The logger masks phone numbers, national IDs, passwords before logging. If masking breaks, we leak customer PII to CloudWatch — a compliance violation in Zimbabwe's regulatory framework. |

**Tests to write for each module:**

#### authorization.test.ts
```
- getAuthContext() correctly extracts userId, email, role from Cognito claims
- getAuthContext() returns null/defaults for missing claims
- requireRole() passes for authorized roles
- requireRole() throws 403 for unauthorized roles
- requireOwnership() allows access to own resources
- requireOwnership() blocks access to others' resources
- buildAccessFilter() generates correct SQL filters per role
- Edge cases: expired tokens, malformed claims, missing groups
```

#### database-query-builder.test.ts
```
- .select() generates correct SELECT with columns
- .insert() generates parameterized INSERT
- .update() generates parameterized UPDATE with WHERE
- .delete() generates DELETE with WHERE
- .upsert() generates ON CONFLICT clause
- .eq(), .neq(), .gt(), .lt(), .in() generate correct WHERE conditions
- .order(), .limit(), .offset() generate correct clauses
- .single() returns one row, .maybeSingle() returns null for no rows
- SQL injection prevention: special characters in values are parameterized
- Connection pool management: pool is reused, not recreated
```

#### response.test.ts
```
- successResponse() returns 200 with JSON body and security headers
- errorResponse() returns specified status code with error format
- validationErrorResponse() returns 400 with field-level errors
- Security headers include: CORS, X-Content-Type-Options, X-Frame-Options, CSP
- CORS headers respect the origin from the request event
- Response body matches the { success, data/error } envelope format
```

#### validation.test.ts
```
- isValidPhoneNumber() accepts valid Zimbabwe numbers (+263, 0-prefixed)
- isValidPhoneNumber() rejects invalid formats
- isValidEmail() accepts standard email formats
- isValidUUID() accepts v4 UUIDs, rejects non-UUIDs
- isValidIMEI() accepts 15-digit IMEI numbers
- isValidNationalId() accepts Zimbabwe national ID format
- Edge cases: empty strings, null, undefined, very long inputs
```

#### circuit-breaker.test.ts
```
- Starts in CLOSED state (requests pass through)
- Opens after failure threshold exceeded (requests blocked)
- Transitions to HALF_OPEN after timeout period
- Returns to CLOSED after successful request in HALF_OPEN
- Returns to OPEN after failed request in HALF_OPEN
- Tracks failure count correctly
- Reset clears failure count and returns to CLOSED
```

#### rate-limiter.test.ts
```
- Allows requests within rate limit
- Blocks requests exceeding rate limit
- Resets after window period expires
- Per-IP tracking works correctly
- Per-user tracking works correctly
- Returns 429 with Retry-After header when limited
- Sliding window vs fixed window behavior
```

#### logger.test.ts
```
- Logs at correct levels (DEBUG, INFO, WARN, ERROR)
- Includes timestamp, service, requestId in every entry
- Masks phone numbers: +263771234567 → +263****567
- Masks national IDs: 12345678A90 → 12******90
- Never includes passwords, OTPs, tokens in output
- Respects LOG_LEVEL environment variable
- Request context propagation works across calls
```

**Target:** 90%+ coverage on all shared utilities.

---

### Task 0C: Characterization Tests for Payment Service Business Logic

**Why:** The payment-service processes real money (EcoCash, OneMoney, Omari, InnBucks). It currently has contract tests (API shape) and integration tests, but **zero unit tests for core business logic**. Two known bugs exist as TODO comments. Before any refactoring touches payment code, we need comprehensive characterization tests.

| # | New Test File | Target | Why |
|---|---------------|--------|-----|
| 1 | `tests/unit/payment/payment-service.test.ts` | `PaymentService` class in `services/payment-service/src/payment-service.ts` (668 lines) | Core payment orchestration — validates amounts, checks limits, routes to providers, handles responses. A bug here = money lost or double-charged. |
| 2 | `tests/unit/payment/ecocash-provider.test.ts` | `services/payment-service/src/ecocash-provider.ts` | EcoCash is the primary mobile money provider in Zimbabwe (~70% market share). Must test: request formatting, response parsing, timeout handling, idempotency. |
| 3 | `tests/unit/payment/onemoney-provider.test.ts` | `services/payment-service/src/onemoney-provider.ts` | OneMoney is the secondary provider. Same test pattern as EcoCash but different API contract. |
| 4 | `tests/unit/payment/payment-state-machine.test.ts` | `services/payment-service/src/payment-state-machine.ts` | Payments transition through states: INITIATED → PENDING → COMPLETED/FAILED. Wrong state transitions = stuck payments or premature confirmations. |
| 5 | `tests/unit/payment/penalty-service.test.ts` | `services/payment-service/src/penalty-service.ts` (755 lines) | Calculates late payment penalties. Wrong penalty = customer overcharged = regulatory issue. |

**Known bugs to document as failing tests:**

```
Bug #1 — payment-service.ts:117
  Code:    const amountUsd = currency === 'USD' ? amount : amount;
  Problem: ZWL and ZAR amounts are NOT converted to USD — both branches return `amount`
  Test:    it('should convert ZWL amounts to USD for limit checking') → EXPECT FAIL
  Impact:  Transaction limits are applied incorrectly for non-USD currencies

Bug #2 — payment-service.ts:403
  Code:    // TODO: Trigger next step based on payment type
  Problem: After payment completes, the next workflow step is never triggered
  Test:    it('should trigger loan disbursement after successful down payment') → EXPECT FAIL
  Impact:  Manual intervention needed to advance loan workflow after payment
```

**Verification:** `pnpm test` passes (failing tests marked as `.skip` or `xit` with linked issue numbers).

---

## Phase 1: Shared Lambda Router Utility

### Why This Phase Exists

Every subsequent service decomposition (Phases 2-6) needs to replace if/else routing chains with a clean, testable router. Building this utility once avoids duplicating the pattern 8 times.

### Risk Level: Low

New utility only — no existing code changes.

---

### Tasks

| # | Task | File | Why |
|---|------|------|-----|
| 1 | Create lightweight Lambda router | `services/shared/utils/lambda-router.ts` (new) | 8/14 services use 30-50 line if/else chains for path matching. This is error-prone, hard to read, and hard to test. A route-map pattern (already used by `investor-reporting-service/src/index.ts:33-41`) is cleaner and enables automated route testing. |
| 2 | Write router tests | `tests/unit/shared/lambda-router.test.ts` (new) | Verify: exact match, parameterized paths (`:id`), OPTIONS preflight, 404 fallback, error propagation, auth context injection |
| 3 | Document router pattern | `services/README.md` (update) | Provide migration guide from if/else to route map for all subsequent phases |

**Router requirements:**
- Support exact path matching: `GET /admin/users`
- Support parameterized paths: `GET /admin/users/:id`
- Handle OPTIONS preflight automatically
- Integrate with existing `getAuthContext()` and `getSecurityHeaders()`
- Return 404 with proper format for unmatched routes
- **No external dependencies** — Lambda cold start budget is tight (512MB, arm64)

**Reference implementation already exists:** `services/investor-reporting-service/src/index.ts` lines 33-41

### Tests

```
- Exact path match routes to correct handler
- Parameterized path extracts :id correctly
- Method mismatch returns 405
- No matching route returns 404 with standard error format
- OPTIONS returns CORS headers without calling handler
- Handler errors are caught and returned as 500
- Auth context is passed to handlers
- Security headers are included in all responses
- Multiple parameters work: /admin/orgs/:orgId/members/:memberId
```

---

## Phase 2: Admin Service Decomposition

### Why This Phase Exists

`admin-service/src/index.ts` at 3,306 lines is the single largest file in the codebase. It contains 56 route match operations, 100+ handler functions, and 35 `console.error` calls — all in one file with zero tests. This is the highest-impact refactoring target because:
- It's internal-facing (lower risk than payment/whatsapp)
- It touches every admin workflow (users, products, devices, inventory, KYC review, dashboard)
- Decomposing it proves the router pattern works before applying to riskier services

### Risk Level: Medium

Large scope but internal-facing. Admin operations don't process payments or face end-users.

---

### Tasks

| # | Task | Files | Why |
|---|------|-------|-----|
| 1 | Write characterization tests | 7 new test files (see below) | Must capture current behavior BEFORE any code moves. Tests must pass against the monolith, then pass identically against decomposed modules. |
| 2 | Extract handlers into domain modules | 11 new handler files + slim `index.ts` | Each domain (users, products, inventory, etc.) becomes its own file. Purely mechanical — no logic changes. |
| 3 | Replace `console.error` with `logger.error()` | All handler files | 35 `console.error` calls violate CLAUDE.md Section 9 logging standards. The shared logger provides structured logging with PII masking. |
| 4 | Verify all tests pass | Run full test suite | Same characterization tests must pass against refactored code without modification. |

### Tests (7 new test files)

| Test File | Domain | Routes Covered | What To Test |
|-----------|--------|---------------|-------------|
| `tests/unit/admin/user-management.test.ts` | Users | `GET/POST /admin/users`, `GET/PUT/DELETE /admin/users/:id`, `GET /admin/me` | CRUD operations, role-based filtering, self-lookup |
| `tests/unit/admin/product-management.test.ts` | Products | `GET/POST /admin/products`, `GET/PUT/DELETE /admin/products/:id` | Product CRUD, validation (name, price, currency format) |
| `tests/unit/admin/device-management.test.ts` | Device Models | `GET/POST /admin/device-models`, `GET/PUT/DELETE /admin/device-models/:id` | Device model CRUD, Trustonic field handling |
| `tests/unit/admin/organization-management.test.ts` | Organizations | `GET/POST /admin/organizations`, `GET/PUT /admin/organizations/:id`, `/import`, `/members` | Org CRUD, bulk import, member assignment |
| `tests/unit/admin/inventory-management.test.ts` | Inventory | `GET/POST /admin/devices`, bulk-import, stats, movements, adjustments, transfers | Device tracking, IMEI validation, stock levels |
| `tests/unit/admin/dashboard-metrics.test.ts` | Dashboard | `GET /api/v1/dashboard/metrics`, portfolio-at-risk, daily-trends | Aggregation queries, date range filtering, metric calculations |
| `tests/unit/admin/kyc-review.test.ts` | KYC Review | `GET /api/v1/kyc/submissions/pending`, approve, reject | Review queue, approval/rejection flow, status updates |

### Target Structure After Decomposition

```
services/admin-service/src/
  index.ts                          ← slim router using lambda-router (~30 lines)
  handlers/
    user-management.ts              ← extracted from index.ts lines ~228-450
    config-management.ts            ← extracted from index.ts lines ~450-520
    audit-logs.ts                   ← extracted from index.ts lines ~520-600
    product-management.ts           ← extracted from index.ts lines ~600-850
    device-model-management.ts      ← extracted from index.ts lines ~850-1100
    organization-management.ts      ← extracted from index.ts lines ~1100-1500
    inventory-management.ts         ← extracted from index.ts lines ~1500-2100
    inventory-adjustments.ts        ← extracted from index.ts lines ~2100-2600
    inventory-reports.ts            ← extracted from index.ts lines ~2600-2800
    dashboard-metrics.ts            ← extracted from index.ts lines ~2800-3050
    kyc-review.ts                   ← extracted from index.ts lines ~3050-3306
```

---

## Phase 3: Scoring Service & KYC Service Refactoring

### Why This Phase Exists

These services are part of the critical loan decision pipeline — credit scoring determines who gets a loan, KYC determines who is who. They're medium-sized (899 and 686 lines) making them manageable refactoring targets, but they carry higher risk because wrong scores = wrong loan decisions.

### Risk Level: Medium-High

Affects loan decisions and identity verification. Existing contract tests and integration tests provide a safety net.

---

### Tasks

| # | Task | Files | Why |
|---|------|-------|-----|
| 1 | Write scoring unit tests | 3 new test files | The credit score algorithm determines loan eligibility. It uses `AffordabilityData`, `RepaymentData`, `MobileMoneyProfile`, `ExternalCreditData` — all untested at the unit level. |
| 2 | Extract scoring modules | 6 new files + slim index.ts | Separate the calculation engine from the HTTP handler. Makes the scoring algorithm independently testable and reusable. |
| 3 | Strengthen KYC tests | 2 new test files | The provider factory (`kyc-provider-factory.ts`) and callback handler need unit tests. Currently only `didit-service.test.ts` exists. |
| 4 | Replace `console.error` in both services | All modified files | Consistent structured logging |

### Tests

**Scoring service:**

| Test File | What To Test |
|-----------|-------------|
| `tests/unit/scoring/credit-score-calculation.test.ts` | Score calculation for: new customers (minimum score), positive payment history (score increase), mobile money activity (alternative data), affordability check (debt-to-income ratio), combined factors |
| `tests/unit/scoring/affordability-check.test.ts` | Debt-to-income validation, income verification, expense categorization, disposable income calculation |
| `tests/unit/scoring/mobile-money-scoring.test.ts` | Mobile money transaction history scoring, frequency analysis, balance patterns, alternative creditworthiness signals |

**KYC service:**

| Test File | What To Test |
|-----------|-------------|
| `tests/unit/kyc/provider-factory.test.ts` | Factory returns correct provider (Didit vs Smile Identity), provider switching, fallback behavior |
| `tests/unit/kyc/callback-handler.test.ts` | Webhook processing from KYC providers, status mapping (verified/rejected/manual_review), error handling for malformed callbacks |

---

## Phase 4: Code Deduplication & Dependency Consolidation

### Why This Phase Exists

By Phase 4, we have test coverage on the most critical services. It's now safe to consolidate duplicated code without fear of breaking things. Duplication creates drift — the same logic implemented in two places will inevitably diverge, creating subtle bugs.

### Risk Level: Low-Medium

Consolidation, not new logic. Tests from earlier phases protect against regressions.

---

### Tasks

| # | Task | Files | Why |
|---|------|-------|-----|
| 1 | Consolidate phone validation | `services/shared/utils/validation.ts`, `services/whatsapp-service/src/onboarding.ts` | Two implementations with different regex patterns: shared uses `/^(\+263\|0)[0-9]{9}$/`, whatsapp uses `/^(\+?263\|0)(7[1-8]{1}\d{7})$/`. The whatsapp version is more specific (validates mobile prefix 71-78). Must merge into shared and prove equivalence with comparison tests. |
| 2 | Consolidate CORS/response helpers | `services/form-submission-service/src/index.ts` | Has its own `corsHeaders()`, `ok()`, `err()` functions that duplicate `shared/utils/response.ts`. Replacing with shared utilities ensures consistent security headers. |
| 3 | Remove duplicate CircuitBreaker | `services/whatsapp-service/src/utils/circuit-breaker.ts` | Duplicates `services/shared/utils/circuit-breaker.ts`. Two copies means two places to fix bugs. Point imports to shared, delete duplicate. |
| 4 | Unify dependency versions | All `package.json` files | axios: root `^1.13.4` vs services `^1.6.5`. typescript: root `^5.2.0` vs services `^5.3.3`. Each service duplicates devDependencies. Move to workspace root using pnpm workspace protocol. |

### Tests

```
# Phone validation consolidation test
- Both old and new function accept: +263771234567, 0771234567
- Both old and new function reject: +1234567890, abc, empty string
- New function additionally validates mobile prefix (71-78)
- New function rejects landline numbers (24xxxx)

# Response helper consolidation test
- form-submission-service responses match shared utility output format
- Security headers are identical
- CORS behavior is identical
```

---

## Phase 5: Payment & WhatsApp Service Refactoring

### Why This Phase Exists

These are the highest-risk services — payment-service processes real money, whatsapp-service is the primary customer interface (90%+ of interactions). They're refactored last because they need the most complete test coverage and the most careful approach. By this phase, the router utility is proven, the shared utilities are tested, and the decomposition pattern has been validated on admin-service.

### Risk Level: High

Financial transactions and customer-facing communication. Requires staging verification before production.

---

### Tasks

| # | Task | Files | Why |
|---|------|-------|-----|
| 1 | Extensive payment characterization tests | 7+ new test files | All 4 providers (EcoCash, OneMoney, Omari, InnBucks), reconciliation, write-off, penalty, reschedule. Must achieve 95% coverage per CLAUDE.md before touching any logic. |
| 2 | Fix two known payment bugs | `payment-service.ts:117`, `payment-service.ts:403` | Currency conversion no-op and missing payment step trigger. Tests written in Phase 0 now guide the fix. |
| 3 | Payment service router extraction | `services/payment-service/src/index.ts` | Replace if/else routing with lambda-router |
| 4 | WhatsApp onboarding decomposition | 10 new files | Extract 1,323-line monolith into state machine modules — one file per onboarding step |

### Tests

**Payment service (additional to Phase 0C):**

| Test File | What To Test |
|-----------|-------------|
| `tests/unit/payment/omari-provider.test.ts` | Omari provider API integration |
| `tests/unit/payment/innbucks-provider.test.ts` | InnBucks provider API integration |
| `tests/unit/payment/reconciliation.test.ts` | Payment reconciliation — matching provider confirmations to internal records |
| `tests/unit/payment/write-off-service.test.ts` | Bad debt write-off calculations and approval workflow |
| `tests/unit/payment/reschedule-service.test.ts` | Payment reschedule — date changes, interest recalculation |
| `tests/unit/payment/transaction-limits.test.ts` | RBZ-compliant limits: $5K daily, $50K monthly, $2K single transaction |
| `tests/unit/payment/currency-conversion.test.ts` | ZWL/ZAR to USD conversion for limit checking (fixes Bug #1) |

**WhatsApp onboarding target structure:**

```
services/whatsapp-service/src/onboarding/
  index.ts                    ← state machine dispatcher
  states/
    welcome.ts                ← Step 1: Greeting and language selection
    phone-validation.ts       ← Step 2: Zimbabwe phone number verification
    personal-info.ts          ← Step 3: Name, date of birth collection
    employment-info.ts        ← Step 4: Employment status, income
    product-selection.ts      ← Step 5: Device/loan product selection
    kyc-upload.ts             ← Step 6: National ID photo + selfie upload
    credit-scoring.ts         ← Step 7: Score calculation and result
    loan-offer.ts             ← Step 8: Loan terms presentation and acceptance
  types.ts                    ← OnboardingSession, MessageContext types
```

---

## Phase 6: Remaining Services & Frontend Hardening

### Why This Phase Exists

The remaining backend services and frontend apps need attention. Four services have zero tests. The frontend has `ignoreBuildErrors: true` which masks type safety issues.

### Risk Level: Low-Medium

---

### Tasks

| # | Task | Files | Why |
|---|------|-------|-----|
| 1 | Fineract proxy decomposition | `services/fineract-proxy-service/src/index.ts` (1,084 lines) | Split into route modules by Fineract entity (clients, loans, repayments, GL accounts) |
| 2 | RBZ reporting decomposition | `services/shared/fineract-rbz-reporting.ts` (1,772 lines) | Split 10+ report types into individual modules under `services/shared/reporting/` |
| 3 | Add tests for remaining services | 4 services (distributor, dw-sync, form-submission, investor-reporting) | Zero test coverage — need characterization tests before any future changes |
| 4 | Fix frontend TypeScript errors | `frontend/apps/admin-portal/`, `frontend/apps/distributor-dashboard/` | Remove `ignoreBuildErrors: true` from both `next.config.js` files. Fix all `tsc --noEmit` errors. |
| 5 | Strengthen frontend test coverage | Both frontend apps | Currently 62 test files with 70-80% thresholds. Identify gaps and add tests. |

### Tests

**Remaining services:**

| Test File | Service | What To Test |
|-----------|---------|-------------|
| `tests/unit/distributor/distributor-service.test.ts` | distributor-service | Distributor CRUD, commission calculations, inventory views |
| `tests/unit/dw-sync/sync-handlers.test.ts` | dw-sync-service | Data warehouse sync for credit decisions, KYC, loans, payments |
| `tests/unit/form-submission/form-handler.test.ts` | form-submission-service | Landing page form processing, validation, storage |
| `tests/unit/investor/reporting-handlers.test.ts` | investor-reporting-service | Portfolio summary, vintage analysis, covenant compliance |

---

## Phase 7: Documentation & Standards Alignment

### Why This Phase Exists

Documentation is best written after the code is clean, not before. Now that services are decomposed and well-tested, we can accurately document their APIs, behavior, and architecture.

### Risk Level: None

Documentation only — no code changes.

---

### Tasks

| # | Task | Files | Why |
|---|------|-------|-----|
| 1 | Generate OpenAPI 3.0 specs | `openapi/*.yaml` (9 new files) | No API documentation currently exists. OpenAPI specs enable: auto-generated client SDKs, Swagger UI for testing, contract validation, partner integration docs. |
| 2 | Add service READMEs | `services/*/README.md` (12 new files) | `services/README.md` references individual READMEs but they don't exist. Each service needs: purpose, endpoints, env vars, dependencies, testing instructions. |
| 3 | Add JSDoc to exported functions | All handler files | CLAUDE.md Section 5: "All functions must have JSDoc comments explaining purpose." Currently minimal JSDoc across the codebase. |
| 4 | Implement error code system | `services/shared/utils/error-codes.ts` (new), `services/shared/utils/typed-errors.ts` (new) | CLAUDE.md Section 8 defines a full error code standard (`AUTH_TOKEN_001`, `LOAN_SCORE_001`, `PAY_FUND_001`, etc.) but it's not implemented in actual code. |

---

## Coverage Target Ramp

| Phase | Backend Coverage Target | Frontend Coverage Target | Cumulative New/Modified Files |
|-------|------------------------|--------------------------|-------------------------------|
| 0 | 50% | — | ~15 |
| 1 | 55% | — | ~19 |
| 2 | 65% | — | ~46 |
| 3 | 70% | — | ~61 |
| 4 | 72% | — | ~73 |
| 5 | 80% | — | ~93 |
| 6 | 85% | 85% | ~118 |
| 7 | 85% (docs only) | 85% | ~133 |

**CLAUDE.md targets met by Phase 5:** 80% global, 95% payment-service, 90% scoring-service.

---

## Phase Dependency Map

```
Phase 0 (Tests + Tooling)          ← FOUNDATION — must come first
    |
Frontend Hardening                  ← ELEVATED PRIORITY per user request
    |
Phase 1 (Router Utility)           ← enables all decompositions
    |
    +------------------+
    |                  |
Phase 2 (Admin)    Phase 3 (Scoring/KYC)    ← CAN PARALLELIZE
    |                  |
    +--------+---------+
             |
    Phase 4 (Deduplication)
             |
    Phase 5 (Payment/WhatsApp)     ← HIGHEST RISK — most tests required
             |
    Phase 6 (Remaining + Frontend)
             |
    Phase 7 (Documentation)        ← LAST — document clean code
```

---

## Per-Phase Verification Checklist

Before merging each phase:

- [ ] All existing tests pass (`pnpm test`)
- [ ] All new characterization tests pass
- [ ] `pnpm lint` has no new errors
- [ ] SAM build succeeds (`sam build --cached --parallel`)
- [ ] SAM validate passes (`sam validate`)
- [ ] Deploy to staging succeeds
- [ ] No new `console.error`/`console.log` (use shared logger)
- [ ] No new `any` types without justified eslint-disable
- [ ] No new hardcoded secrets
- [ ] Branch name: `refactor/phase-N-description`

---

## Execution Order (Adjusted)

**Immediate scope: Phase 0 only.** Evaluate results before proceeding.

After Phase 0, **frontend hardening is elevated** (was Phase 6D):
- Fix TypeScript build errors in admin-portal and distributor-dashboard
- Remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true` from `next.config.js`
- Ensure `tsc --noEmit` passes cleanly
- Strengthen frontend test coverage

Remaining backend phases (router, admin decomposition, etc.) follow after frontend is solid.

**Revised order:** Phase 0 (tests/tooling) → Frontend Hardening → Phase 1 (router) → Phase 2+ (backend)

---

## Execution Approach

Each phase is implemented as a separate branch/PR. Within each phase, work follows this strict cycle:

1. **Read** — understand the code being refactored
2. **Test** — write characterization tests capturing current behavior
3. **Green** — verify tests pass against existing code
4. **Refactor** — make structural changes (no logic changes)
5. **Green** — verify same tests pass against refactored code
6. **Enhance** — now safe to improve logic, fix bugs, add features
7. **Deploy** — staging verification before production
