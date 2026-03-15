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

| Item | Impact | Effort | Priority | Status |
|------|--------|--------|----------|--------|
| SMS notification channel | HIGH | MEDIUM | P1 | **DONE** |
| Error handling fixes (gl-accounts, inventory) | MEDIUM | LOW | P1 | Open |
| Frontend hook tests | MEDIUM | MEDIUM | P2 | **DONE** |
| Lock-service router migration | LOW | LOW | P2 | **DONE** |
| Email notification channel | MEDIUM | MEDIUM | P2 | Open |
| Loan restructuring endpoint | HIGH | HIGH | P3 | Open |
| Early payoff endpoint | HIGH | HIGH | P3 | Open |
| ML pipeline v2 | HIGH | HIGH | P3 | Open |
| Mojaloop integration | MEDIUM | HIGH | P4 | Open |
| Read replicas + RDS Proxy | LOW | MEDIUM | P4 | Open |

---

## Next Sprint Recommendations

1. **Fix remaining error handling gaps** — gl-accounts try/catch, inventory error checks
2. **Add requestId to all error responses** — Standardize across all services
3. **Begin loan restructuring/early payoff** — Critical for customer financial flexibility
4. **Deploy RDS Proxy** — Prevent connection exhaustion under load
5. **Email notification channel** — SES integration for admin alerts and receipts
6. **Component-level frontend tests** — Pages and form unit tests
