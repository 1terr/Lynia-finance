# Site Audit 1.5 — Remaining Items

**Date:** 2026-03-15

Items not yet addressed or partially complete. These are tracked for future work.

---

## Phase 3 Items (Deferred)

### SMS Notification Channel
- **Status:** Not started
- **Owner:** Window A (Phase 3)
- **Scope:** Add SMS provider integration (AWS SNS or Africa's Talking) to notification-service
- **Priority:** Medium — WhatsApp is primary channel, SMS is fallback

### Frontend Hook & Utility Tests
- **Status:** Not started
- **Owner:** Window B (Phase 3)
- **Scope:** ~40 tests covering auth, session, permissions, dashboard hooks, validation
- **Files needed:**
  - `use-auth.test.ts`
  - `use-session-timeout.test.ts`
  - `use-permission.test.ts`
  - `use-dashboard-data.test.ts`
  - `validation-schemas.test.ts`
  - `permissions.test.ts`

### Lock-Service Migration to Lambda-Router
- **Status:** Not started
- **Owner:** Window C (Phase 3)
- **Scope:** Replace if/else chain in lock-service with createRouter(), add proper error handling
- **Impact:** Code quality + consistent error responses

---

## Longer-Term Items

### Loan Restructuring
- Allow modification of loan terms (extend, reduce installments)
- Requires Fineract `reschedule` command integration
- Frontend UI for restructure workflow

### Early Payoff
- Calculate early payoff amount with interest discount
- Fineract `prepayLoan` command integration
- WhatsApp flow for customer-initiated payoff

### ML Credit Scoring Pipeline
- Current: Rule-based scoring in scoring-service
- Future: ML model trained on repayment history
- Infrastructure: S3 model storage, SageMaker inference endpoint
- Timeline: Post-launch, once sufficient training data exists

### Fineract Interop (Mojaloop)
- Enable interoperability with other financial institutions via Mojaloop
- Phase: Post-launch exploration
- Depends on: RBZ regulatory approval

### Pentaho ETL
- Batch data processing for regulatory reports
- Monthly RBZ transaction reports
- Annual compliance audit data extracts

### Email Notification Channel
- Add email as notification channel alongside WhatsApp and SMS
- AWS SES integration
- HTML email templates for receipts and statements

---

## Technical Debt

| Item | Priority | Description |
|------|----------|-------------|
| Payment test coverage | High | Window A payment handlers need unit tests (52 planned) |
| Fineract extended test coverage | Medium | Loan actions extended tests need more edge cases |
| Frontend build optimization | Low | Bundle size audit, code splitting for reports page |
| Database connection pooling | Medium | Monitor connection usage, consider RDS Proxy if needed |
| Rate limiting | High | Implement on all public endpoints before launch |
| API documentation | Medium | OpenAPI/Swagger spec for all endpoints |

---

## Verification Checklist (Post-Deploy)

- [ ] All 34 admin pages return 200 (not 404)
- [ ] No 500 errors leak stack traces to client
- [ ] Fineract errors return 502 with user-friendly message
- [ ] Timeout errors return 504
- [ ] All error responses include `requestId`
- [ ] Payment pages load with real data
- [ ] Report pages render with real data
- [ ] Device lock/unlock works end-to-end
- [ ] Fineract loan reject/writeoff/close works
- [ ] Customer profile update works
