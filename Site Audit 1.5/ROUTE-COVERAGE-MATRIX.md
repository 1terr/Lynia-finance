# Site Audit 1.5 — Route Coverage Matrix

**Date:** 2026-03-15

Every `fetchAPI` / `fetchFineractAPI` call in the frontend mapped to its backend route, SAM event, and status.

---

## Admin Portal — Payment Routes

| Frontend Function | Backend Route | SAM Event | Status |
|-------------------|---------------|-----------|--------|
| `getPayments(filters)` | `GET /api/v1/payments` | PaymentsAdminRoot | LIVE |
| `getPaymentById(id)` | `GET /api/v1/payments/:id` | PaymentsAdminProxy | LIVE |
| `getPaymentStats()` | `GET /api/v1/payments/stats` | PaymentsAdminProxy | LIVE |
| `getUnreconciledPayments()` | `GET /api/v1/payments/unreconciled` | PaymentsAdminProxy | LIVE |
| `getOverdueCollections()` | `GET /api/v1/payments/overdue-collections` | PaymentsAdminProxy | LIVE |
| `getPaymentSummary(filters)` | `GET /api/v1/payments/summary` | PaymentsAdminProxy | LIVE |
| `recordManualPayment(data)` | `POST /api/v1/payments/manual` | PaymentsAdminProxy | LIVE |
| `confirmPayment(id)` | `POST /api/v1/payments/:id/confirm` | PaymentsAdminProxy | LIVE |
| `failPayment(id)` | `POST /api/v1/payments/:id/fail` | PaymentsAdminProxy | LIVE |
| `retryPayment(id)` | `POST /api/v1/payments/:id/retry` | PaymentsAdminProxy | LIVE |
| `refundPayment(id)` | `POST /api/v1/payments/:id/refund` | PaymentsAdminProxy | LIVE |
| `reconcilePayment(id)` | `POST /api/v1/payments/:id/reconcile` | PaymentsAdminProxy | LIVE |

## Admin Portal — Report Routes

| Frontend Function | Backend Route | SAM Event | Status |
|-------------------|---------------|-----------|--------|
| `getPortfolioReport()` | `GET /api/v1/reports/portfolio` | ReportsRoot | LIVE |
| `fetchPortfolioHealthReport(f)` | `GET /api/v1/reports/portfolio/health` | ReportsProxy | LIVE |
| `fetchLoanDisbursementReport(f)` | `GET /api/v1/reports/disbursements` | ReportsProxy | LIVE |
| `getCollectionReport(from,to)` | `GET /api/v1/reports/collections` | ReportsProxy | LIVE |
| `fetchPaymentCollectionReport(f)` | `GET /api/v1/reports/collections/detailed` | ReportsProxy | LIVE |
| `getKYCReport()` | `GET /api/v1/reports/kyc` | ReportsProxy | LIVE |
| `fetchKycStatusReport(f)` | `GET /api/v1/reports/kyc/detailed` | ReportsProxy | LIVE |
| `getDefaultReport()` | `GET /api/v1/reports/defaults` | ReportsProxy | LIVE |
| `fetchDefaultRateReport(f)` | `GET /api/v1/reports/defaults/summary` | ReportsProxy | LIVE |
| `fetchCustomerAcquisitionReport(f)` | `GET /api/v1/reports/acquisition` | ReportsProxy | LIVE |
| `getRevenueReport(from,to)` | `GET /api/v1/reports/revenue` | ReportsProxy | LIVE |
| `getLoanApprovalReport(from,to)` | `GET /api/v1/reports/loan-approvals` | ReportsProxy | LIVE |

## Admin Portal — Device Lock Routes

| Frontend Function | Backend Route | SAM Event | Status |
|-------------------|---------------|-----------|--------|
| `getDeviceLockHistory(id)` | `GET /admin/devices/:id/lock-history` | AdminProxy | LIVE |
| `lockDevice(id, adminId, reason)` | `POST /admin/devices/:id/lock` | AdminProxy | LIVE |
| `unlockDevice(id, adminId, reason)` | `POST /admin/devices/:id/unlock` | AdminProxy | LIVE |
| `updateDeviceStatus(id, status)` | `PATCH /admin/devices/:id/status` | AdminProxy | LIVE |

## Admin Portal — Device Handover Routes

| Frontend Function | Backend Route | SAM Event | Status |
|-------------------|---------------|-----------|--------|
| `getDeviceHandovers(filters)` | `GET /admin/devices/handovers` | AdminProxy | LIVE |
| `updateHandoverStatus(id, body)` | `PATCH /admin/devices/handovers/:id` | AdminProxy | LIVE |

## Admin Portal — Customer Routes

| Frontend Function | Backend Route | SAM Event | Status |
|-------------------|---------------|-----------|--------|
| `getCustomers(filters)` | `GET /api/v1/customers` | CustomersRoot | LIVE |
| `getCustomerById(id)` | `GET /api/v1/customers/:id` | CustomersProxy | LIVE |
| `updateCustomer(id, updates)` | `PATCH /api/v1/customers/:id` | CustomersProxy | LIVE |
| `updateCustomerStatus(id, status)` | `PATCH /api/v1/customers/:id/status` | CustomersProxy | LIVE |
| `getCustomerLoans(id)` | `GET /api/v1/customers/:id/loans` | CustomersProxy | LIVE |
| `getCustomerPayments(id)` | `GET /api/v1/customers/:id/payments` | CustomersProxy | LIVE |
| `getCustomerCreditScore(id)` | `GET /api/v1/customers/:id/credit-score` | CustomersProxy | LIVE |
| `getCreditScoreHistory(id)` | `GET /api/v1/customers/:id/credit-score/history` | CustomersProxy | LIVE |
| `getCustomerKYC(id)` | `GET /api/v1/customers/:id/kyc` | CustomersProxy | LIVE |
| `getCustomerTimeline(id)` | `GET /api/v1/customers/:id/timeline` | CustomersProxy | LIVE |
| `addCustomerNote(id, note)` | `POST /api/v1/customers/:id/notes` | CustomersProxy | LIVE |

## Fineract Proxy Routes

| Frontend Function | Backend Route | SAM Event | Status |
|-------------------|---------------|-----------|--------|
| `approveLoan(loanId)` | `POST /api/v1/fineract/loans/:loanId/approve` | Existing | LIVE |
| `disburseLoan(loanId)` | `POST /api/v1/fineract/loans/:loanId/disburse` | Existing | LIVE |
| `rejectLoan(loanId, data)` | `POST /api/v1/fineract/loans/:loanId/reject` | RejectLoan | LIVE |
| `writeOffLoan(loanId, data)` | `POST /api/v1/fineract/loans/:loanId/writeoff` | WriteOffLoan | LIVE |
| `closeLoan(loanId, data)` | `POST /api/v1/fineract/loans/:loanId/close` | CloseLoan | LIVE |
| `createFineractProduct(data)` | `POST /api/v1/fineract/loan-products/create-from-lynia` | CreateFineractProduct | LIVE |
| `getSystemHealth()` | `GET /fineract/system-health` | Existing | LIVE |

## Inventory Reports (Already existed, unchanged)

| Frontend Function | Backend Route | SAM Event | Status |
|-------------------|---------------|-----------|--------|
| `getInventoryReport()` | `GET /admin/reports/inventory` | AdminProxy | LIVE |
| `getMovementsReport(days)` | `GET /admin/reports/inventory/movements` | AdminProxy | LIVE |
| `getLowStockReport()` | `GET /admin/reports/inventory/low-stock` | AdminProxy | LIVE |

---

## Coverage Summary

| Category | Frontend Calls | Backend Routes | Covered |
|----------|---------------|----------------|---------|
| Payments | 12 | 12 | 100% |
| Reports | 12 | 12 | 100% |
| Device Locks | 4 | 4 | 100% |
| Device Handovers | 2 | 2 | 100% |
| Customers | 11 | 11 | 100% |
| Fineract Proxy | 7 | 7 | 100% |
| Inventory Reports | 3 | 3 | 100% |
| **Total** | **51** | **51** | **100%** |
