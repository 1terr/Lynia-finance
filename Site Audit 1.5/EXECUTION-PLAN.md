# Lynia Finance — 4-Day Parallel Execution Plan (4 Claude Windows)

## Context

Audit found **7 broken pages** (404), **5 partial pages**, test gaps, and missing error handling (500/502). This plan runs **4 Claude Code windows simultaneously** to compress 4 days of work into maximum throughput. Each window owns an isolated set of files to avoid merge conflicts. Shared files (`template.yaml`, `admin-service/src/index.ts`) are edited by ONE window only, with others waiting.

**Approach:** Test-Driven Development (TDD) — write tests FIRST, then implement until tests pass. Also audit for 500/502 error handling gaps.

---

## Window Assignment & Dependency Rules

```
┌─────────────────────────────────────────────────────────────────────┐
│  WINDOW A: Payments Admin     │  WINDOW B: Reports + Devices       │
│  (Isolated handler files)     │  (Isolated handler files)          │
│                               │                                     │
│  WINDOW C: Fineract Actions   │  WINDOW D: Tests + Audit + Polish  │
│  (Fineract proxy files)       │  (Test files + docs only)          │
└─────────────────────────────────────────────────────────────────────┘
```

### Shared File Ownership (CRITICAL — prevents conflicts)

| Shared File | Owner | Others WAIT |
|-------------|-------|-------------|
| `template.yaml` | Window A (Phase 1) → Window C (Phase 2) | B, D wait |
| `services/admin-service/src/index.ts` | Window A (Phase 1) → Window B (Phase 2) | C, D wait |
| `services/shared/clients/fineract.ts` | Window C only | A, B, D never touch |
| `services/shared/clients/fineract/loan-client.ts` | Window C only | A, B, D never touch |

### Dependency Signals

Windows communicate via git commits. When a window finishes a phase and pushes:
- Other windows `git pull` before starting dependent work
- If a window needs another's output, it says **"BLOCKED ON: Window X Phase Y"**

---

## Phase 1 (Hours 0–6): TDD — Write Tests + Implement Handlers

### WINDOW A: Payment Admin Backend
**Owns:** `services/admin-service/src/handlers/payments.ts`, `template.yaml` SAM events

**Step 1 — Write tests FIRST (TDD):**
```
Create: tests/unit/admin-service/payments.test.ts

Test cases per handler (13 handlers × 4 cases = 52 tests):
  ✓ Returns paginated data on success
  ✓ Returns 401 if no auth context
  ✓ Returns 400 on invalid input (bad UUID, missing fields)
  ✓ Returns 500 with requestId on DB error (not raw stack trace)

Special tests:
  ✓ handleConfirmPayment returns 409 if already confirmed
  ✓ handleRefundPayment returns 409 if already refunded
  ✓ handleReconcilePayment sets reconciled_by from auth context
  ✓ handleRecordManualPayment validates amount > 0
  ✓ handleGetPayments respects MAX_PAGE_SIZE limit
```

**Step 2 — Implement handlers until tests pass:**
```
Create: services/admin-service/src/handlers/payments.ts

Routes (12 — static before parameterized):
  GET  /api/v1/payments/stats
  GET  /api/v1/payments/unreconciled
  GET  /api/v1/payments/overdue-collections
  GET  /api/v1/payments/summary
  POST /api/v1/payments/manual
  GET  /api/v1/payments
  POST /api/v1/payments/:id/confirm
  POST /api/v1/payments/:id/fail
  POST /api/v1/payments/:id/retry
  POST /api/v1/payments/:id/refund
  POST /api/v1/payments/:id/reconcile
  GET  /api/v1/payments/:id

Error handling requirements:
  - All handlers: try/catch → errorResponse(500) with requestId, NEVER expose stack
  - 404: "Payment not found" when :id doesn't exist
  - 409: Conflict when action invalid for current status
  - 400: Validation errors (missing fields, bad format)

Pattern: Copy from services/admin-service/src/handlers/customers.ts
```

**Step 3 — Update shared files (Window A owns these first):**
```
Modify: services/admin-service/src/index.ts
  - Import 12 handlers from './handlers/payments'
  - Add 12 route entries to createRouter map

Modify: template.yaml — add to AdminFunction Events:
  PaymentsRoot:
    Type: Api
    Properties:
      RestApiId: !Ref LyniaApi
      Path: /api/v1/payments
      Method: ANY
  PaymentsProxy:
    Type: Api
    Properties:
      RestApiId: !Ref LyniaApi
      Path: /api/v1/payments/{proxy+}
      Method: ANY
```

**Step 4 — Commit + push. Signal: "Window A Phase 1 DONE"**

---

### WINDOW B: Reports Backend + Device Locks + Handovers + Customer Update
**Owns:** `services/admin-service/src/handlers/reports.ts`, `device-locks.ts`, `device-handovers.ts`
**BLOCKED ON: Window A Phase 1** (for `index.ts` and `template.yaml` edits)

While waiting for Window A, write ALL tests first:

**Step 1 — Write tests FIRST (TDD):**
```
Create: tests/unit/admin-service/reports.test.ts (26 tests)
  13 handlers × 2 cases:
    ✓ Returns aggregated data on success
    ✓ Returns empty result set when no data matches filters
  Plus:
    ✓ Date range filter works correctly
    ✓ Returns 500 with requestId on DB error

Create: tests/unit/admin-service/device-locks.test.ts (16 tests)
  4 handlers × 4 cases:
    ✓ Success case
    ✓ 401 no auth
    ✓ 404 device not found
    ✓ 409 already locked / already unlocked
  Plus:
    ✓ Lock history returns ordered by created_at DESC
    ✓ Lock inserts auditLog entry
    ✓ Unlock inserts auditLog entry

Create: tests/unit/admin-service/device-handovers.test.ts (10 tests)
  2 handlers × 5 cases:
    ✓ Returns paginated handovers with JOINs
    ✓ Filters by status work
    ✓ Search by customer name works
    ✓ 404 handover not found on PATCH
    ✓ 500 with requestId on error

Create: tests/unit/admin-service/customer-update.test.ts (6 tests)
    ✓ Updates allowed fields
    ✓ Rejects disallowed fields (id, credit_score, kyc_status)
    ✓ 404 customer not found
    ✓ 400 empty update body
    ✓ Inserts auditLog on success
    ✓ 500 with requestId on DB error
```

**Step 2 — Implement handler files (can start immediately, isolated files):**
```
Create: services/admin-service/src/handlers/reports.ts (13 handlers)
  All read-only SQL aggregations against: loans, payments, customers,
  kyc_submissions, devices, credit_scores tables.
  Accept query params: date_from, date_to, product, distributor, status, tier, payment_method

Create: services/admin-service/src/handlers/device-locks.ts (4 handlers)
  GET  /admin/devices/:id/lock-history
  POST /admin/devices/:id/lock
  POST /admin/devices/:id/unlock
  PATCH /admin/devices/:id/status

Create: services/admin-service/src/handlers/device-handovers.ts (2 handlers)
  GET   /admin/devices/handovers
  PATCH /admin/devices/handovers/:id

Modify: services/admin-service/src/handlers/customers.ts
  Add: handleUpdateCustomer for PATCH /api/v1/customers/:id
```

**Step 3 — AFTER Window A pushes: Update shared files:**
```
git pull  (get Window A's changes)

Modify: services/admin-service/src/index.ts
  - Import handlers from reports, device-locks, device-handovers
  - Add 21 routes (13 reports + 4 device-locks + 2 device-handovers + 1 customer update + 1 device status)
  - CRITICAL: device-locks and handover routes BEFORE /admin/devices/:id

Modify: template.yaml — add to AdminFunction Events:
  ReportsRoot:     /api/v1/reports       ANY
  ReportsProxy:    /api/v1/reports/{proxy+}  ANY
```

**Step 4 — Commit + push. Signal: "Window B Phase 1 DONE"**

---

### WINDOW C: Fineract Reject/WriteOff/Close
**Owns:** All fineract-proxy-service files + shared fineract client files
**BLOCKED ON: Window A Phase 1** (for `template.yaml`)

While waiting, write tests and implement isolated fineract files:

**Step 1 — Write tests FIRST:**
```
Create: tests/unit/fineract-proxy/loan-actions-extended.test.ts (16 tests)
  3 handlers × 4 cases:
    ✓ Successful reject/writeoff/close
    ✓ 404 loan not found in Lynia DB
    ✓ 400 loan not synced to Fineract (no fineract_loan_id)
    ✓ 502 Fineract API error (circuit breaker open, timeout, 500 from Fineract)
  Plus:
    ✓ Reject requires rejectedOnDate and note
    ✓ WriteOff updates loan status in Lynia DB
    ✓ Close requires loan to be fully paid
    ✓ 500 returns requestId, not stack trace
```

**Step 2 — Add Fineract client methods (isolated files):**
```
Modify: services/shared/clients/fineract/loan-client.ts
  Add to returned object:
    rejectLoan(loanId, rejectedOnDate, note)
      → POST /loans/{loanId}?command=reject
    writeOffLoan(loanId, transactionDate, note)
      → POST /loans/{loanId}/transactions?command=writeoff
    closeLoan(loanId, closedOnDate)
      → POST /loans/{loanId}?command=close

Modify: services/shared/clients/fineract.ts
  Add to FineractClient class:
    rejectLoan = this._loanOps.rejectLoan
    writeOffLoan = this._loanOps.writeOffLoan
    closeLoan = this._loanOps.closeLoan
```

**Step 3 — Add proxy handlers:**
```
Modify: services/fineract-proxy-service/src/handlers/loan-actions.ts
  Add: handleLoanReject, handleLoanWriteOff, handleLoanClose
  Each: lookupFineractLoan → call fineract client → update Lynia DB status → auditLog

  502 error handling: Catch FineractApiError specifically:
    if (err instanceof FineractApiError) {
      return err(502, `Core banking error: ${err.errorBody?.defaultUserMessage || err.message}`, event);
    }

Modify: services/fineract-proxy-service/src/index.ts
  Add 3 routes (BEFORE the :loanId parameterized routes):
    'POST /api/v1/fineract/loans/:loanId/reject': handleLoanReject,
    'POST /api/v1/fineract/loans/:loanId/writeoff': handleLoanWriteOff,
    'POST /api/v1/fineract/loans/:loanId/close': handleLoanClose,
```

**Step 4 — AFTER Window A pushes: Update template.yaml:**
```
git pull

Modify: template.yaml — add to FineractProxyFunction Events:
  RejectLoan:
    Type: Api
    Properties:
      RestApiId: !Ref LyniaApi
      Path: /api/v1/fineract/loans/{loanId}/reject
      Method: POST
  WriteOffLoan:
    Type: Api
    Properties:
      RestApiId: !Ref LyniaApi
      Path: /api/v1/fineract/loans/{loanId}/writeoff
      Method: POST
  CloseLoan:
    Type: Api
    Properties:
      RestApiId: !Ref LyniaApi
      Path: /api/v1/fineract/loans/{loanId}/close
      Method: POST
  CreateFineractProduct:
    Type: Api
    Properties:
      RestApiId: !Ref LyniaApi
      Path: /api/v1/fineract/loan-products/create-from-lynia
      Method: POST
```

**Step 5 — Commit + push. Signal: "Window C Phase 1 DONE"**

---

### WINDOW D: Error Handling Audit + Frontend API Tests
**NO BLOCKERS — starts immediately on isolated test files**

**Step 1 — Audit all existing handlers for 500/502 error leaks:**
```
Scan ALL handler files for:
  ✗ catch blocks that return raw error.message (may leak internals)
  ✗ Missing try/catch (unhandled promise rejections → 502)
  ✗ Missing requestId in error responses
  ✗ Stack traces in production error responses
  ✗ Fineract calls without FineractApiError catch → should return 502 not 500

Create: tests/unit/error-handling/error-responses.test.ts
  Test every service's error format:
    ✓ Error response has { success: false, error: { code, message, requestId } }
    ✓ No stack traces in error.message
    ✓ Fineract errors return 502 (bad gateway) not 500
    ✓ DB connection errors return 500 with generic message
    ✓ Timeout errors return 504 (gateway timeout) for Fineract
```

**Step 2 — Frontend API client integration tests:**
```
Create: frontend/apps/admin-portal/src/lib/api/__tests__/client.test.ts
  ✓ fetchAPI attaches Authorization header
  ✓ fetchAPI unwraps { success, data } envelope
  ✓ fetchAPI redirects to /login on 401
  ✓ fetchAPI throws on 403
  ✓ fetchAPI throws user-friendly message on 500
  ✓ fetchAPI throws "timed out" on AbortError
  ✓ fetchAPI handles non-JSON error body

Create: frontend/apps/admin-portal/src/lib/api/__tests__/fineract-client.test.ts
  ✓ fetchFineractAPI uses FINERACT_API_URL
  ✓ fetchFineractAPI falls back to main API URL
  ✓ fetchFineractAPI parses defaultUserMessage from Fineract errors
  ✓ All fineract API functions exist and call correct paths

Create: frontend/apps/admin-portal/src/lib/api/__tests__/customers.test.ts
  ✓ getCustomers builds correct query string
  ✓ getCustomerById returns null on error
  ✓ approveKYC sends correct body

Create: frontend/apps/admin-portal/src/lib/api/__tests__/payments-api.test.ts
  ✓ getPayments builds filter params correctly
  ✓ reconcilePayment sends admin_id
  ✓ recordManualPayment validates required fields
```

**Step 3 — Commit + push. Signal: "Window D Phase 1 DONE"**

---

## Phase 2 (Hours 6–10): Integration + Deploy

### ALL WINDOWS: git pull to sync

### WINDOW A: SAM Validate + Build + Deploy Staging
```
BLOCKED ON: Windows B, C Phase 1 (all template.yaml changes merged)

git pull (get B and C changes)
sam validate
sam build --cached --parallel
pnpm test (full suite including new tests)
Fix any test failures

If tests pass:
  git add -A && git commit -m "feat: add payment admin, reports, device locks, handovers, fineract actions"
  git push

Monitor CI/CD → staging deploy
```

### WINDOW B: Integration Testing on Staging
```
BLOCKED ON: Window A Phase 2 deploy

After staging deploy:
  Test each endpoint group with curl:

  # Payments (should return 200, not 404)
  curl -H "Authorization: Bearer $TOKEN" $API/api/v1/payments?page=1&limit=5
  curl -H "Authorization: Bearer $TOKEN" $API/api/v1/payments/stats

  # Reports (should return 200, not 404)
  curl -H "Authorization: Bearer $TOKEN" $API/api/v1/reports/portfolio
  curl -H "Authorization: Bearer $TOKEN" $API/api/v1/reports/kyc

  # Device locks (should return 200, not 404)
  curl -H "Authorization: Bearer $TOKEN" $API/admin/devices/$DEVICE_ID/lock-history

  # Handovers
  curl -H "Authorization: Bearer $TOKEN" $API/admin/devices/handovers?page=1

  # Fineract actions
  curl -X POST -H "Authorization: Bearer $TOKEN" $FINERACT_API/api/v1/fineract/loans/$LOAN_ID/reject -d '{}'

  # Customer update
  curl -X PATCH -H "Authorization: Bearer $TOKEN" $API/api/v1/customers/$ID -d '{"first_name":"Test"}'

Document results.
```

### WINDOW C: Fix any 502/500 errors found
```
If integration tests reveal errors:
  - Fix handler bugs
  - Add missing error handling
  - Re-test
```

### WINDOW D: Frontend smoke testing
```
Open admin portal in browser against staging
Navigate to each of the 7 previously broken pages:
  /payments               → Should show payment list
  /payments/collections   → Should show collections queue
  /payments/reconciliation→ Should show unreconciled payments
  /payments/:id           → Should show payment detail
  /reports                → Should show 7 report tabs
  /devices/lock-unlock    → Should show lock/unlock controls
  /devices/handovers      → Should show handover list

Check browser console for errors on each page.
Document any remaining issues.
```

---

## Phase 3 (Hours 10–16): Day 4 Items — Polish + Remaining Work

### WINDOW A: SMS Notification Channel
```
Modify: services/notification-service/src/index.ts
  - Add SMS provider integration (AWS SNS or Africa's Talking)
  - Implement sendSMS() function in channel router

Create: tests/unit/notification-service/sms-channel.test.ts
  ✓ SMS sends to valid Zimbabwe number
  ✓ SMS fails gracefully for invalid number
  ✓ SMS rate-limited per customer
```

### WINDOW B: Frontend Hook + Utility Tests
```
Create: frontend/apps/admin-portal/src/__tests__/hooks/use-auth.test.ts
Create: frontend/apps/admin-portal/src/__tests__/hooks/use-session-timeout.test.ts
Create: frontend/apps/admin-portal/src/__tests__/hooks/use-permission.test.ts
Create: frontend/apps/admin-portal/src/__tests__/hooks/use-dashboard-data.test.ts
Create: frontend/apps/admin-portal/src/__tests__/lib/validation-schemas.test.ts
Create: frontend/apps/admin-portal/src/__tests__/lib/permissions.test.ts

Total: ~40 tests covering auth, session, permissions, dashboard hooks, validation
```

### WINDOW C: Lock-Service Migration to Lambda-Router
```
Refactor: services/lock-service/src/index.ts
  - Replace if/else chain with createRouter()
  - Maintain exact same routes and behavior
  - Add proper error handling (500 with requestId instead of raw error)

Create: tests/unit/lock-service/router-migration.test.ts
  ✓ All lock endpoints return same responses as before
  ✓ All handover endpoints return same responses as before
  ✓ Error responses include requestId
  ✓ 404 for unknown routes
```

### WINDOW D: Site Audit 1.5 Documentation
```
Create folder: Site Audit 1.5/

Create: Site Audit 1.5/EXECUTION-PLAN.md
  - Copy of this plan with execution timestamps

Create: Site Audit 1.5/AUDIT-REPORT.md
  - All 34 pages: route, status (PASS/FAIL), error code if any
  - Before/after comparison

Create: Site Audit 1.5/ROUTE-COVERAGE-MATRIX.md
  - Every fetchAPI/fetchFineractAPI call → backend route → SAM event → status

Create: Site Audit 1.5/TEST-COVERAGE-REPORT.md
  - Run pnpm test:coverage, capture output
  - Document new tests added, coverage delta

Create: Site Audit 1.5/DEPLOYMENT-CHECKLIST.md
  - Pre-deploy checks, post-deploy verification steps
  - Rollback procedures

Create: Site Audit 1.5/REMAINING-ITEMS.md
  - SMS/Email channels status
  - Pentaho ETL status
  - Loan restructuring, early payoff, ML pipeline
  - Fineract interop (Mojaloop)
  - Frontend API tests still needed
```

---

## Phase 4 (Hours 16–20): Final Deploy + Production

### WINDOW A: Final merge + production deploy
```
git pull (all windows merged)
sam validate
pnpm test (MUST be 100% pass)
sam build --cached --parallel

Deploy staging: sam deploy --config-env staging --no-confirm-changeset --no-fail-on-empty-changeset
Verify staging (smoke tests from Phase 2)

Deploy production: sam deploy --config-env production --no-confirm-changeset --no-fail-on-empty-changeset --on-failure ROLLBACK
```

### WINDOW B: Production smoke test
```
Test all 34 pages on production CloudFront URL
Document any issues in Site Audit 1.5/AUDIT-REPORT.md
```

### WINDOW C: Frontend build + deploy
```
cd frontend/apps/admin-portal
pnpm build
# Deploy to S3 + CloudFront invalidation
```

### WINDOW D: Commit Site Audit 1.5 + create PR
```
git add "Site Audit 1.5/"
git commit -m "docs: Site Audit 1.5 - launch readiness report"
git push
Create PR if on branch
```

---

## Dependency Flowchart

```
HOUR 0                    HOUR 6                 HOUR 10              HOUR 16         HOUR 20
  │                         │                      │                    │               │
  ├─ A: payments.ts ────────┤                      │                    │               │
  │  (handler + SAM)        │                      │                    │               │
  │                         ├─ A: sam build ───────┤                    │               │
  ├─ B: reports.ts ─────────┤  + deploy staging    │                    │               │
  │  device-locks.ts        │                      ├─ A: SMS notif ────┤               │
  │  (WAIT for A index.ts)  │                      │                    │               │
  │                         ├─ B: curl test ───────┤                    ├─ A: PROD ─────┤
  ├─ C: fineract client ────┤  staging endpoints   ├─ B: hook tests ──┤  DEPLOY        │
  │  loan-actions.ts        │                      │                    │               │
  │  (WAIT for A yaml)      ├─ C: fix 502s ───────┤                    ├─ B: smoke ────┤
  │                         │                      ├─ C: lock-svc ─────┤  test prod     │
  ├─ D: error audit ────────┤                      │  refactor          │               │
  │  frontend tests         ├─ D: frontend ────────┤                    ├─ D: audit ────┤
  │  (NO BLOCKERS)          │  smoke test          ├─ D: audit docs ──┤  commit + PR   │
  │                         │                      │                    │               │
```

---

## Error Handling Standards (ALL Windows Must Follow)

### 500 Internal Server Error
```typescript
catch (error) {
  const message = error instanceof Error ? error.message : 'Internal server error';
  logger.error('Handler failed', {
    action: 'payment.list', status: 'failed',
    errorMessage: message,
    // NEVER log: stack trace, SQL query, credentials
  });
  return errorResponse('An unexpected error occurred', 500, { requestId }, event);
  // NEVER return error.message to client — it may contain SQL or internals
}
```

### 502 Bad Gateway (Fineract errors)
```typescript
catch (error) {
  if (error instanceof FineractApiError) {
    logger.error('Fineract API error', {
      action: 'loan.reject', status: 'failed',
      fineractStatus: error.statusCode,
      errorMessage: error.errorBody?.defaultUserMessage || error.message,
    });
    return errorResponse(
      error.errorBody?.defaultUserMessage || 'Core banking system error',
      502, { requestId }, event
    );
  }
  // Fall through to generic 500
}
```

### 504 Gateway Timeout
```typescript
if (error.message?.includes('timed out')) {
  return errorResponse('Core banking system timed out', 504, { requestId }, event);
}
```

---

## Files Modified Summary (All 4 Phases)

| File | Window | Phase | Changes |
|------|--------|-------|---------|
| `template.yaml` | A→C | 1 | +8 SAM events |
| `services/admin-service/src/index.ts` | A→B | 1 | +33 routes |
| `services/admin-service/src/handlers/payments.ts` | A | 1 | NEW — 12 handlers |
| `services/admin-service/src/handlers/reports.ts` | B | 1 | NEW — 13 handlers |
| `services/admin-service/src/handlers/device-locks.ts` | B | 1 | NEW — 4 handlers |
| `services/admin-service/src/handlers/device-handovers.ts` | B | 1 | NEW — 2 handlers |
| `services/admin-service/src/handlers/customers.ts` | B | 1 | +1 handler |
| `services/shared/clients/fineract/loan-client.ts` | C | 1 | +3 methods |
| `services/shared/clients/fineract.ts` | C | 1 | +3 exposures |
| `services/fineract-proxy-service/src/handlers/loan-actions.ts` | C | 1 | +3 handlers |
| `services/fineract-proxy-service/src/index.ts` | C | 1 | +3 routes |
| `services/notification-service/src/index.ts` | A | 3 | SMS channel |
| `services/lock-service/src/index.ts` | C | 3 | Refactor to lambda-router |
| `tests/unit/admin-service/payments.test.ts` | A | 1 | NEW — ~52 tests |
| `tests/unit/admin-service/reports.test.ts` | B | 1 | NEW — ~26 tests |
| `tests/unit/admin-service/device-locks.test.ts` | B | 1 | NEW — ~16 tests |
| `tests/unit/admin-service/device-handovers.test.ts` | B | 1 | NEW — ~10 tests |
| `tests/unit/admin-service/customer-update.test.ts` | B | 1 | NEW — ~6 tests |
| `tests/unit/fineract-proxy/loan-actions-extended.test.ts` | C | 1 | NEW — ~16 tests |
| `tests/unit/error-handling/error-responses.test.ts` | D | 1 | NEW — ~20 tests |
| `frontend/.../api/__tests__/client.test.ts` | D | 1 | NEW — ~10 tests |
| `frontend/.../api/__tests__/fineract-client.test.ts` | D | 1 | NEW — ~8 tests |
| `frontend/.../api/__tests__/customers.test.ts` | D | 1 | NEW — ~6 tests |
| `frontend/.../api/__tests__/payments-api.test.ts` | D | 1 | NEW — ~6 tests |
| `frontend/.../__tests__/hooks/*.test.ts` | B | 3 | NEW — ~40 tests |
| `tests/unit/lock-service/router-migration.test.ts` | C | 3 | NEW — ~15 tests |
| `tests/unit/notification-service/sms-channel.test.ts` | A | 3 | NEW — ~8 tests |
| `Site Audit 1.5/*.md` | D | 3-4 | NEW — 6 docs |

---

## Outcome

| Metric | Before | After |
|--------|--------|-------|
| Pages fully working | 22/34 | 34/34 |
| Pages broken (404) | 7 | 0 |
| Pages partial | 5 | 0 |
| New backend handlers | 0 | 38 |
| New unit tests | 0 | ~239 |
| 500/502 error handling | Inconsistent | Standardized |
| Lock-service router | if/else | lambda-router |
| SMS notifications | Placeholder | Integrated |
| Frontend API tests | 2 files | 6+ files |
| Frontend hook tests | 0 | 6 files |
| Audit documentation | Site Audit 1.0 | + Site Audit 1.5 |

---

## Verification Checklist (After Each Phase)

- [ ] `sam validate` passes with no errors
- [ ] `pnpm test` — 100% pass, no regressions
- [ ] CI/CD pipeline — all 6 stages green
- [ ] No 404 errors on any of the 34 admin pages
- [ ] No 500 errors leaking stack traces
- [ ] Fineract errors return 502 with user-friendly message
- [ ] Timeout errors return 504
- [ ] All error responses include `requestId`
- [ ] Payment pages load with real data
- [ ] Report pages render charts with real data
- [ ] Device lock/unlock works end-to-end
- [ ] Fineract loan reject/writeoff/close works
- [ ] Site Audit 1.5 folder committed to repo
