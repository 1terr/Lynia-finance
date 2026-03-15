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

---

## Phase 3 Items (Not Yet Started)

### SMS Notification Channel (Window A — Phase 3)

- [ ] Integrate SMS provider (AWS SNS or Africa's Talking)
- [ ] Implement `sendSMS()` in notification-service channel router
- [ ] SMS rate limiting per customer
- [ ] Zimbabwe phone number formatting
- [ ] Tests: `tests/unit/notification-service/sms-channel.test.ts`
- **Priority:** HIGH — needed for payment reminders

### Frontend Hook & Utility Tests (Window B — Phase 3)

- [ ] `use-auth.test.ts` — Cognito auth hook testing
- [ ] `use-session-timeout.test.ts` — Session expiry behavior
- [ ] `use-permission.test.ts` — Role-based UI access
- [ ] `use-dashboard-data.test.ts` — Data fetching and caching
- [ ] `validation-schemas.test.ts` — Zod schema validation
- [ ] `permissions.test.ts` — Permission matrix testing
- **Priority:** MEDIUM — improves frontend test coverage

### Lock-Service Router Migration (Window C — Phase 3)

- [ ] Refactor `services/lock-service/src/index.ts` from if/else to `createRouter()`
- [ ] Maintain exact same routes and behavior
- [ ] Add proper error handling (500 with requestId)
- [ ] Tests: `tests/unit/lock-service/router-migration.test.ts`
- **Priority:** LOW — functional but needs modernization

---

## Known Issues (Not Sprint Scoped)

### Error Handling Gaps

1. **`gl-accounts.ts` missing try/catch** — Fineract API calls without error handling can cause 502
2. **`inventory-adjustments.ts` silent DB failures** — `.execute()` results not checked
3. **Missing requestId in payment error responses** — Non-breaking but makes debugging harder

### Architecture Debt

1. **Email notification channel** — Placeholder only, not integrated
2. **Pentaho ETL pipeline** — Data warehouse sync not implemented
3. **Loan restructuring** — No endpoint for modifying active loan terms
4. **Early payoff** — No endpoint for calculating and processing early loan settlement
5. **ML credit scoring pipeline** — v2 model training and deployment infrastructure
6. **Fineract interop (Mojaloop)** — Open banking integration not started

### Frontend Gaps

1. **Component-level tests** — Pages and forms lack unit tests (only API client layer tested)
2. **Accessibility audit** — WCAG 2.1 AA compliance not verified
3. **i18n** — Shona and Ndebele translations not implemented in admin portal
4. **Offline support** — Admin portal has no offline/PWA capabilities

### Infrastructure

1. **Read replicas** — No RDS read replicas configured for query load distribution
2. **Connection pooling** — RDS Proxy not configured
3. **Cost monitoring** — No automated cost anomaly alerts
4. **Disaster recovery** — No cross-region backup or failover

---

## Priority Matrix

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| SMS notification channel | HIGH | MEDIUM | P1 |
| Error handling fixes (gl-accounts, inventory) | MEDIUM | LOW | P1 |
| Frontend hook tests | MEDIUM | MEDIUM | P2 |
| Lock-service router migration | LOW | LOW | P2 |
| Email notification channel | MEDIUM | MEDIUM | P2 |
| Loan restructuring endpoint | HIGH | HIGH | P3 |
| Early payoff endpoint | HIGH | HIGH | P3 |
| ML pipeline v2 | HIGH | HIGH | P3 |
| Mojaloop integration | MEDIUM | HIGH | P4 |
| Read replicas + RDS Proxy | LOW | MEDIUM | P4 |

---

## Next Sprint Recommendations

1. **Complete Phase 3 items** — SMS channel, frontend hook tests, lock-service migration
2. **Fix remaining error handling gaps** — gl-accounts try/catch, inventory error checks
3. **Add requestId to all error responses** — Standardize across all services
4. **Begin loan restructuring/early payoff** — Critical for customer financial flexibility
5. **Deploy RDS Proxy** — Prevent connection exhaustion under load
