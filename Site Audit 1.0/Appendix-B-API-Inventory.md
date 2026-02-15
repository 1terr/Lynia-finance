# Appendix B: API Endpoint Inventory

**Total Endpoints:** 66+
**Audit Date:** February 15, 2026
**Auth Method:** All endpoints require Cognito JWT via `Authorization: Bearer <token>`

---

## API Client Architecture

All admin portal API calls flow through a single `fetchAPI` function:

```
Admin Portal Component
    → React Query hook
    → Domain API function (e.g., getCustomers)
    → fetchAPI<T>(path, options)
    → getSession() → Cognito JWT
    → fetch(API_BASE + path, { Authorization: Bearer <token> })
    → API Gateway + Cognito Authorizer
    → Lambda Function
    → RDS PostgreSQL / Fineract / External Service
```

**Key Files:**
- API Client: `frontend/admin-portal/src/lib/api/client.ts`
- Base URL: `NEXT_PUBLIC_API_URL` environment variable
- Auth: `frontend/admin-portal/src/lib/auth/cognito.ts`

---

## Dashboard APIs (5 endpoints)

| Method | Endpoint | Purpose | Response Shape | Used By |
|--------|----------|---------|---------------|---------|
| GET | `/api/v1/dashboard/metrics` | KPI aggregate values | `{ total_customers, active_loans, total_disbursed, ... }` | Dashboard KPI cards |
| GET | `/api/v1/dashboard/portfolio-at-risk` | PAR breakdown | `{ par_1_30, par_31_60, par_61_90, par_90_plus }` | PAR chart |
| GET | `/api/v1/dashboard/daily-trends?days=N` | Time series data | `{ data: [{ date, loans, payments, ... }] }` | Trend chart |
| GET | `/api/v1/dashboard/loans-by-status` | Loan status distribution | `{ pending: N, approved: N, active: N, ... }` | Status chart |
| GET | `/api/v1/dashboard/recent-activity?limit=N` | Activity event feed | `{ data: [{ type, description, timestamp, ... }] }` | Activity feed |

**File:** Dashboard metrics are fetched inline in `_client.tsx`, not via a separate API module.

---

## Customer APIs (13 endpoints)

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| GET | `/api/v1/customers?page=&limit=&status=&kyc_status=&search=` | Paginated customer list | `api/customers.ts` |
| GET | `/api/v1/customers/{id}` | Customer detail | `api/customers.ts` |
| PATCH | `/api/v1/customers/{id}` | Update customer | `api/customers.ts` |
| PATCH | `/api/v1/customers/{id}/status` | Activate/block customer | `api/customers.ts` |
| GET | `/api/v1/customers/{id}/loans` | Customer's loans | `api/customers.ts` |
| GET | `/api/v1/customers/{id}/payments` | Customer's payments | `api/customers.ts` |
| GET | `/api/v1/customers/{id}/credit-score` | Credit score details | `api/customers.ts` |
| GET | `/api/v1/customers/{id}/kyc` | KYC submissions | `api/customers.ts` |
| GET | `/api/v1/customers/{id}/timeline` | Activity timeline | `api/customers.ts` |
| POST | `/api/v1/customers/{id}/notes` | Add customer note | `api/customers.ts` |
| GET | `/api/v1/kyc/submissions/pending` | Pending KYC review queue | `api/customers.ts` |
| POST | `/api/v1/kyc/submissions/{id}/approve` | Approve KYC submission | `api/customers.ts` |
| POST | `/api/v1/kyc/submissions/{id}/reject` | Reject KYC submission | `api/customers.ts` |

**Filters:** `status` (active, blocked, pending), `kyc_status` (verified, pending, failed), `search` (name, phone)
**Pagination:** `page` (1-based), `limit` (default 25, max 100)

---

## Loan APIs (7 endpoints)

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| GET | `/api/v1/loans?page=&limit=&status=&search=` | Paginated loan list | `api/loans.ts` |
| GET | `/api/v1/loans/{id}` | Loan detail | `api/loans.ts` |
| GET | `/api/v1/loans/{id}/payments` | Loan payment history | `api/loans.ts` |
| POST | `/api/v1/loans/{id}/approve` | Approve loan application | `api/loans.ts` |
| POST | `/api/v1/loans/{id}/reject` | Reject loan application | `api/loans.ts` |
| GET | `/api/v1/loans/pending` | Pending approval queue | `api/loans.ts` |
| GET | `/api/v1/loans/stats` | Loan status counts | `api/loans.ts` |

**Statuses:** pending, approved, active, closed, defaulted, written_off
**Approve Body:** `{ admin_id, notes }`
**Reject Body:** `{ admin_id, reason }`

---

## Device APIs (8 endpoints)

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| GET | `/api/v1/devices?page=&limit=&status=&lock_status=&search=` | Device inventory list | `api/devices.ts` |
| GET | `/api/v1/devices/{id}` | Device detail | `api/devices.ts` |
| GET | `/api/v1/devices/{id}/lock-history` | Lock/unlock timeline | `api/devices.ts` |
| POST | `/api/v1/devices/{id}/lock` | Lock device | `api/devices.ts` |
| POST | `/api/v1/devices/{id}/unlock` | Unlock device | `api/devices.ts` |
| PATCH | `/api/v1/devices/{id}/status` | Update device status | `api/devices.ts` |
| GET | `/api/v1/devices/handovers` | Handover tracking list | `api/devices.ts` |
| GET | `/api/v1/devices/stats` | Device inventory counts | `api/devices.ts` |

**Lock/Unlock Body:** `{ admin_id, reason }`
**Search:** By IMEI number

---

## Payment APIs (8 endpoints)

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| GET | `/api/v1/payments?page=&limit=&status=&method=&type=&search=&date_from=&date_to=&reconciled=` | Payment list | `api/payments.ts` |
| GET | `/api/v1/payments/{id}` | Payment detail | `api/payments.ts` |
| POST | `/api/v1/payments/{id}/reconcile` | Mark payment as reconciled | `api/payments.ts` |
| POST | `/api/v1/payments/{id}/retry` | Retry failed payment | `api/payments.ts` |
| POST | `/api/v1/payments/{id}/refund` | Initiate refund | `api/payments.ts` |
| GET | `/api/v1/payments/unreconciled` | Unreconciled payment queue | `api/payments.ts` |
| GET | `/api/v1/payments/overdue-collections` | Overdue collections | `api/payments.ts` |
| GET | `/api/v1/payments/stats` | Payment statistics | `api/payments.ts` |

**Statuses:** confirmed, pending, failed, refunded
**Methods:** ecocash, onemoney, bank_transfer, cash
**Types:** repayment, deposit, fee, penalty
**Reconcile Body:** `{ admin_id }`
**Refund Body:** `{ admin_id, reason }`

---

## Fineract APIs (14 endpoints) — BLOCKED

All Fineract endpoints are blocked until the Fineract ECS cluster is deployed.

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| GET | `/api/v1/fineract/loans` | Fineract loan portfolio | `api/fineract.ts` |
| GET | `/api/v1/fineract/loans/{id}` | Fineract loan detail | `api/fineract.ts` |
| GET | `/api/v1/fineract/loans/pending` | Fineract pending approval | `api/fineract.ts` |
| POST | `/api/v1/fineract/loans/{id}/approve` | Approve in Fineract | `api/fineract.ts` |
| POST | `/api/v1/fineract/loans/{id}/disburse` | Disburse via Fineract | `api/fineract.ts` |
| POST | `/api/v1/fineract/loans/{id}/repayment` | Record repayment | `api/fineract.ts` |
| GET | `/api/v1/fineract/loan-products` | Loan products list | `api/fineract.ts` |
| GET | `/api/v1/fineract/loan-products/{id}` | Loan product detail | `api/fineract.ts` |
| GET | `/api/v1/fineract/gl-accounts` | Chart of accounts | `api/fineract.ts` |
| GET | `/api/v1/fineract/journal-entries?fromDate=&toDate=` | GL journal entries | `api/fineract.ts` |
| GET | `/api/v1/fineract/trial-balance?date=` | Trial balance | `api/fineract.ts` |
| GET | `/api/v1/fineract/reconciliation` | Reconciliation results | `api/fineract.ts` |
| POST | `/api/v1/fineract/reconciliation/run` | Trigger reconciliation | `api/fineract.ts` |
| GET | `/api/v1/fineract/loans/overdue` | Overdue loan analysis | `api/fineract.ts` |
| GET | `/api/v1/fineract/loans/aging-summary` | Aging summary report | `api/fineract.ts` |

---

## Report APIs (6 endpoints)

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| GET | `/api/v1/reports/collections?date_from=&date_to=` | Collection by method | `api/reports.ts` |
| GET | `/api/v1/reports/revenue?date_from=&date_to=` | Revenue breakdown | `api/reports.ts` |
| GET | `/api/v1/reports/defaults?date_from=&date_to=` | Default analysis | `api/reports.ts` |
| GET | `/api/v1/reports/kyc?date_from=&date_to=` | KYC status report | `api/reports.ts` |
| GET | `/api/v1/reports/loan-approvals?date_from=&date_to=` | Approval rates | `api/reports.ts` |
| GET | `/api/v1/reports/portfolio?date_from=&date_to=` | Portfolio health | `api/reports.ts` |

---

## Admin/Settings APIs (8 endpoints)

| Method | Endpoint | Purpose | File |
|--------|----------|---------|------|
| GET | `/api/v1/admin/me` | Current admin profile | `api/settings.ts` |
| GET | `/api/v1/admin/users` | Admin user list | `api/settings.ts` |
| GET | `/api/v1/admin/users/{id}` | Admin user detail | `api/settings.ts` |
| POST | `/api/v1/admin/users` | Create admin user | `api/settings.ts` |
| PATCH | `/api/v1/admin/users/{id}` | Update admin user | `api/settings.ts` |
| GET | `/api/v1/admin/config` | System configuration | `api/settings.ts` |
| PATCH | `/api/v1/admin/config/{id}` | Update config entry | `api/settings.ts` |
| GET | `/api/v1/admin/audit-logs` | Audit log viewer | `api/settings.ts` |

---

## Endpoint Summary

| Module | Endpoints | Status |
|--------|-----------|--------|
| Dashboard | 5 | Active |
| Customers | 13 | Active |
| Loans | 7 | Active |
| Devices | 8 | Active |
| Payments | 8 | Active |
| Fineract | 14 | BLOCKED |
| Reports | 6 | Active |
| Admin | 8 | Active |
| **Total** | **69** | **55 active, 14 blocked** |
