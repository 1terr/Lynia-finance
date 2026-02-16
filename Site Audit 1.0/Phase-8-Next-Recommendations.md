# Phase 8: Next Recommendations

**Date:** February 16, 2026
**Based on:** Phase 7 Production Deployment Completion
**Priority:** Ordered by business impact and dependency chain

---

## Immediate Actions (Before Go-Live)

### 1. Change Fineract Default Credentials
**Priority:** CRITICAL
**Effort:** 30 minutes

The Fineract instance is running with default credentials (`mifos`/`password`). Before any real customer data flows through:

1. Log into Fineract and change the admin password
2. Update AWS Secrets Manager (`production/lynia/fineract-api`) with the new password
3. Re-invoke the init Lambda to verify connectivity: `aws lambda invoke --function-name production-lynia-fineract-init --payload '{"RequestType":"Create"}' result.json`

### 2. Wire Loan Creation Sync
**Priority:** HIGH
**Effort:** 2-4 hours

Currently, customer sync and payment sync are wired, but loan creation is not. When a loan is approved and created in Lynia's database, it should also be created in Fineract.

**Implementation:**
- Add `syncLoanToFineract()` call in the loan creation flow (scoring service or a dedicated loan service)
- Call Fineract `POST /loans` with client ID, product ID, principal, term
- Then `POST /loans/{id}?command=approve` and `POST /loans/{id}?command=disburse`
- Update `loans.fineract_loan_id` and `loans.fineract_loan_account_no`

**Dependency:** Requires understanding of the full loan creation flow (currently initiated via WhatsApp → scoring → approval)

### 3. Enable HTTPS Certificate for Fineract
**Priority:** HIGH
**Effort:** 1-2 hours

The Fineract ALB uses a self-signed certificate. The Lambda code uses `rejectUnauthorized: false`. For production:

1. Request an ACM certificate for the internal ALB domain
2. Attach certificate to the ALB listener
3. Remove `rejectUnauthorized: false` from all Fineract client code

---

## Short-Term (Weeks 1-2)

### 4. End-to-End Integration Test
**Priority:** HIGH
**Effort:** 4-6 hours

Create a comprehensive E2E test that validates the full flow:

1. Create a test customer via scoring API
2. Verify customer synced to Fineract (`GET /clients`)
3. Create a loan and verify in Fineract (`GET /loans`)
4. Make a payment and verify repayment posted
5. Run reconciliation and verify no discrepancies
6. Clean up test data

### 5. WhatsApp Balance Inquiry from Fineract
**Priority:** MEDIUM
**Effort:** 2-3 hours

The `getFineractLoanBalance()` function exists in `fineract-sync.ts` but isn't wired to WhatsApp. When a customer asks "What's my balance?":

1. Query Fineract `GET /loans/{id}` for real-time balance
2. Return `totalOutstanding` from Fineract (source of truth for accounting)
3. Fallback to Lynia DB balance if Fineract is unreachable

### 6. WhatsApp Repayment Schedule from Fineract
**Priority:** MEDIUM
**Effort:** 2-3 hours

The `getFineractRepaymentSchedule()` function exists but isn't wired. When a customer asks "When is my next payment?":

1. Query Fineract `GET /loans/{id}?associations=repaymentSchedule`
2. Parse the schedule to find the next due installment
3. Format response in simple WhatsApp message

### 7. Monitoring Dashboard
**Priority:** MEDIUM
**Effort:** 3-4 hours

Create a CloudWatch dashboard for Fineract integration health:

- Fineract sync success/failure rate
- Reconciliation discrepancy count
- Fineract API latency (p50/p95/p99)
- Lambda invocation errors
- `fineract_sync_log` table growth
- EventBridge rule invocation count

---

## Medium-Term (Weeks 3-4)

### 8. Admin Portal Fineract Pages - Live Data
**Priority:** MEDIUM
**Effort:** 8-12 hours

The admin portal has 6 Fineract pages but they currently show static/placeholder data. Wire them to real API endpoints:

| Page | API Needed | Fineract Endpoint |
|------|-----------|-------------------|
| Loan Portfolio | `/api/fineract/loans` | `GET /loans` |
| Approval Queue | `/api/fineract/pending` | `GET /loans?status=pendingApproval` |
| GL Accounting | `/api/fineract/gl` | `GET /glaccounts`, `GET /journalentries` |
| Products | `/api/fineract/products` | `GET /loanproducts` |
| Overdue Analysis | `/api/fineract/overdue` | `GET /loans?overdue=true` |
| Reconciliation | `/api/fineract/reconciliation` | Query `fineract_sync_log` |

### 9. Automated Retry with Exponential Backoff
**Priority:** MEDIUM
**Effort:** 2-3 hours

Current retry strategy: reconciliation job runs every 6 hours, retries up to 3 times. Improve:

- Add SQS dead-letter queue for failed syncs
- Implement exponential backoff (1min, 5min, 30min, 6hr)
- Alert on DLQ messages > threshold
- Admin UI to manually retry exhausted syncs

### 10. Fineract Data Backup Strategy
**Priority:** MEDIUM
**Effort:** 2-3 hours

Fineract runs on ECS Fargate with a MySQL database (embedded or separate). Ensure:

- Automated daily snapshots of Fineract data
- Point-in-time recovery capability
- Backup verification testing
- Cross-region backup for disaster recovery

---

## Long-Term (Month 2+)

### 11. Multi-Currency Support in Fineract
**Priority:** LOW (until ZWL loans are offered)
**Effort:** 4-6 hours

Current loan products are USD-only. When Lynia starts offering ZWL-denominated loans:

- Create ZWL versions of the 3 loan products
- Add exchange rate management in admin portal
- Update sync layer to include currency in API calls
- Implement daily RBZ exchange rate feed

### 12. Fineract Reporting Integration
**Priority:** LOW
**Effort:** 6-8 hours

Fineract has built-in reporting (Pentaho). Integrate with admin portal:

- Aging Analysis Report
- Portfolio at Risk (PAR)
- Disbursement vs Repayment trends
- Monthly regulatory report (RBZ format)

### 13. Load Testing
**Priority:** LOW
**Effort:** 4-6 hours

Before scaling to thousands of customers:

- Load test Fineract with simulated 10K clients
- Benchmark GL posting performance under concurrent load
- Test reconciliation with 10K+ synced loans
- Identify Fineract ECS scaling triggers (CPU/memory thresholds)

### 14. Fineract Version Upgrade Path
**Priority:** LOW
**Effort:** Planning only

Current Fineract is running on ECS Fargate. Plan for version upgrades:

- Blue-green deployment strategy for zero-downtime upgrades
- Database migration testing in staging environment
- API compatibility checks between versions
- Rollback procedure documentation

---

## Architecture Debt to Address

| Item | Description | Impact |
|------|-------------|--------|
| Self-signed TLS | Fineract ALB uses self-signed cert | Security risk |
| Default credentials | mifos/password still active | Critical security risk |
| No parent hierarchy | GL detail accounts created without parent links | Cosmetic (accounting works) |
| Duplicate suspense accounts | 2100 (liability) and 1500 (asset) both exist | Minor cleanup |
| Node.js 18 deprecation | Fineract init Lambda uses nodejs18.x | AWS will deprecate |
| Loan creation not synced | Loans aren't created in Fineract automatically | Data gap |

---

## Summary Priority Matrix

```
                    HIGH IMPACT
                        │
    ┌───────────────────┼───────────────────┐
    │ 1. Change creds   │ 2. Loan sync      │
    │ 3. HTTPS cert     │ 4. E2E test       │
    │                   │ 7. Dashboard       │
LOW ├───────────────────┼───────────────────┤ HIGH
EFF │ 5. Balance inquiry│ 8. Admin pages    │ EFFORT
    │ 6. Schedule query │ 9. Retry strategy │
    │                   │ 10. Backup        │
    └───────────────────┼───────────────────┘
                        │
                    LOW IMPACT
```

**Recommended immediate focus:** Items 1-3 (security hardening), then Item 4 (E2E validation), then Items 5-6 (customer-facing features).
