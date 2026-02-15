# Appendix A: Complete Page Inventory

**Total Pages:** 27 routes across 2 route groups
**Audit Date:** February 15, 2026

---

## Route Groups

| Group | Path Prefix | Layout | Purpose |
|-------|-------------|--------|---------|
| `(auth)` | `/login` | Auth layout (centered card) | Authentication pages |
| `(dashboard)` | `/` | Dashboard layout (sidebar + header + content) | All admin pages |

---

## Full Page Inventory

### Authentication Pages

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 1 | `/login` | `(auth)/login/page.tsx` | PASS | N/A | Amazon Cognito |

**Features:** Email/password login, NEW_PASSWORD_REQUIRED challenge, MFA TOTP, demo mode fallback

---

### Dashboard

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 2 | `/` | `(dashboard)/page.tsx` | PARTIAL | Yes | `/api/v1/dashboard/*` (5 endpoints) |

**Features:** 12 KPI cards, 4 Recharts charts (Trend, Portfolio, PAR, Status), Quick Actions, Activity Feed, DateRangePicker
**Issues:** Shows `null` when no data (should show EmptyState)

---

### Customer Module (5 pages)

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 3 | `/customers` | `(dashboard)/customers/page.tsx` | PASS | Yes | `GET /api/v1/customers` |
| 4 | `/customers/[id]` | `(dashboard)/customers/[id]/page.tsx` | PASS | Yes | `GET /api/v1/customers/{id}` + related |
| 5 | `/customers/[id]/edit` | `(dashboard)/customers/[id]/edit/page.tsx` | PASS | Yes | `PATCH /api/v1/customers/{id}` |
| 6 | `/customers/kyc-review` | `(dashboard)/customers/kyc-review/page.tsx` | PASS | Yes | `GET /api/v1/kyc/submissions/pending` |
| 7 | `/kyc` | `(dashboard)/kyc/page.tsx` | PARTIAL | No | KYC APIs |

**Customer List Features:** Search, status filter, KYC filter, pagination (25/page)
**Customer Detail Features:** 6 tabs (Profile, Loans, Payments, KYC, Timeline, Notes), credit score card
**KYC Review Features:** Pending queue, document viewer, approve/reject with reason, SLA indicators

---

### Loan Module (4 pages + 1 Fineract detail)

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 8 | `/loans` | `(dashboard)/loans/page.tsx` | PASS | Yes | `GET /api/v1/loans` |
| 9 | `/loans/[id]` | `(dashboard)/loans/[id]/page.tsx` | PASS | Yes | `GET /api/v1/loans/{id}` |
| 10 | `/loans/pending-approval` | `(dashboard)/loans/pending-approval/page.tsx` | PASS | Yes | `GET /api/v1/loans/pending` |
| 11 | `/loans/[id]/fineract` | `(dashboard)/loans/[id]/fineract/page.tsx` | BLOCKED | No | `GET /api/v1/fineract/loans/{id}` |

**Loan List Features:** Status filters, search, pagination, amount formatting
**Loan Detail Features:** Repayment schedule table, payment history, customer link
**Pending Approval Features:** Approve/reject with notes, credit score display

---

### Device Module (4 pages)

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 12 | `/devices` | `(dashboard)/devices/page.tsx` | PASS | Yes | `GET /api/v1/devices` |
| 13 | `/devices/[id]` | `(dashboard)/devices/[id]/page.tsx` | PASS | Yes | `GET /api/v1/devices/{id}` |
| 14 | `/devices/handovers` | `(dashboard)/devices/handovers/page.tsx` | PASS | Yes | `GET /api/v1/devices/handovers` |
| 15 | `/devices/lock-unlock` | `(dashboard)/devices/lock-unlock/page.tsx` | PASS | Yes | `POST /api/v1/devices/{id}/lock` |

**Device Inventory Features:** Stats cards, IMEI search, status/lock filters
**Lock/Unlock Features:** Reason required, confirmation dialog, lock history timeline
**Handover Features:** 7-step progression tracking, status visualization

---

### Payment Module (4 pages)

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 16 | `/payments` | `(dashboard)/payments/page.tsx` | PASS | Yes | `GET /api/v1/payments` |
| 17 | `/payments/[id]` | `(dashboard)/payments/[id]/page.tsx` | PASS | Yes | `GET /api/v1/payments/{id}` |
| 18 | `/payments/collections` | `(dashboard)/payments/collections/page.tsx` | PASS | Yes | `GET /api/v1/payments/overdue-collections` |
| 19 | `/payments/reconciliation` | `(dashboard)/payments/reconciliation/page.tsx` | PASS | **No** | `GET /api/v1/payments/unreconciled` |

**Payment List Features:** Multi-filter (status, method, type, date, reconciled), search, pagination
**Collections Features:** Priority levels (critical/high/medium/low), days overdue
**Reconciliation Features:** Unreconciled queue, manual reconcile action with admin ID

---

### Reports (1 page)

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 20 | `/reports` | `(dashboard)/reports/page.tsx` | PASS | Yes | `GET /api/v1/reports/*` (6 endpoints) |

**Features:** 7 report types, date range filtering, Recharts visualizations, CSV export

---

### Settings (1 page)

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 21 | `/settings` | `(dashboard)/settings/page.tsx` | PARTIAL | **No** | `GET /api/v1/admin/*` (8 endpoints) |

**Features:** Admin user CRUD, system config management, audit log viewer
**Issue:** Not reachable from sidebar navigation

---

### Fineract Module (6 pages)

| # | Route | File | Status | In Sidebar | Backend Dependencies |
|---|-------|------|--------|------------|---------------------|
| 22 | `/fineract/loans` | `(dashboard)/fineract/loans/page.tsx` | BLOCKED | **No** | `GET /api/v1/fineract/loans` |
| 23 | `/fineract/approval` | `(dashboard)/fineract/approval/page.tsx` | BLOCKED | **No** | `GET /api/v1/fineract/loans/pending` |
| 24 | `/fineract/accounting` | `(dashboard)/fineract/accounting/page.tsx` | BLOCKED | **No** | `GET /api/v1/fineract/gl-accounts` |
| 25 | `/fineract/products` | `(dashboard)/fineract/products/page.tsx` | BLOCKED | **No** | `GET /api/v1/fineract/loan-products` |
| 26 | `/fineract/overdue` | `(dashboard)/fineract/overdue/page.tsx` | BLOCKED | **No** | `GET /api/v1/fineract/loans/overdue` |
| 27 | `/fineract/reconciliation` | `(dashboard)/fineract/reconciliation/page.tsx` | BLOCKED | **No** | `GET /api/v1/fineract/reconciliation` |

**All blocked because:** Fineract ECS cluster not deployed. Pages are code-complete and will work once Fineract is running.

---

## Status Summary

| Status | Count | Percentage |
|--------|-------|-----------|
| PASS | 18 | 67% |
| PARTIAL | 3 | 11% |
| BLOCKED | 6 | 22% |
| **Total** | **27** | **100%** |

| In Sidebar | Count | Percentage |
|-----------|-------|-----------|
| Yes | 18 | 67% |
| No | 8 | 30% |
| N/A (login) | 1 | 3% |
| **Total** | **27** | **100%** |
