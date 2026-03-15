# Route Coverage Matrix

**Date:** 2026-03-15
**Purpose:** Maps every frontend API call to its backend handler and SAM API Gateway event.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| OK | Frontend call → Backend route → SAM event all connected |
| NEW | Added in Site Audit 1.5 sprint |
| --- | Not applicable |

---

## Dashboard

| Frontend Function | API Path | Backend Handler | SAM Event | Status |
|-------------------|----------|----------------|-----------|--------|
| `getDashboardMetrics()` | GET `/api/v1/dashboard/metrics` | `handleDashboardMetrics` | DashboardProxy | OK |
| `getPortfolioAtRisk()` | GET `/api/v1/dashboard/portfolio-at-risk` | `handlePortfolioAtRisk` | DashboardProxy | OK |
| `getDailyTrends()` | GET `/api/v1/dashboard/daily-trends` | `handleDailyTrends` | DashboardProxy | OK |
| `getLoansByStatus()` | GET `/api/v1/dashboard/loans-by-status` | `handleLoansByStatus` | DashboardProxy | OK |
| `getRecentActivity()` | GET `/api/v1/dashboard/recent-activity` | `handleRecentActivity` | DashboardProxy | OK |

## Payments (NEW — 12 routes)

| Frontend Function | API Path | Backend Handler | SAM Event | Status |
|-------------------|----------|----------------|-----------|--------|
| `getPayments()` | GET `/api/v1/payments` | `handleGetPayments` | PaymentsAdminRoot | NEW |
| `getPaymentById()` | GET `/api/v1/payments/:id` | `handleGetPaymentById` | PaymentsAdminProxy | NEW |
| `getPaymentStats()` | GET `/api/v1/payments/stats` | `handleGetPaymentStats` | PaymentsAdminProxy | NEW |
| `fetchUnreconciledPayments()` | GET `/api/v1/payments/unreconciled` | `handleGetUnreconciledPayments` | PaymentsAdminProxy | NEW |
| `getOverdueCollections()` | GET `/api/v1/payments/overdue-collections` | `handleGetOverdueCollections` | PaymentsAdminProxy | NEW |
| `fetchPaymentSummary()` | GET `/api/v1/payments/summary` | `handleGetPaymentSummary` | PaymentsAdminProxy | NEW |
| `recordManualPayment()` | POST `/api/v1/payments/manual` | `handleRecordManualPayment` | PaymentsAdminProxy | NEW |
| `confirmPayment()` | POST `/api/v1/payments/:id/confirm` | `handleConfirmPayment` | PaymentsAdminProxy | NEW |
| `failPayment()` | POST `/api/v1/payments/:id/fail` | `handleFailPayment` | PaymentsAdminProxy | NEW |
| `retryPayment()` | POST `/api/v1/payments/:id/retry` | `handleRetryPayment` | PaymentsAdminProxy | NEW |
| `refundPayment()` | POST `/api/v1/payments/:id/refund` | `handleRefundPayment` | PaymentsAdminProxy | NEW |
| `reconcilePayment()` | POST `/api/v1/payments/:id/reconcile` | `handleReconcilePayment` | PaymentsAdminProxy | NEW |

## Reports (NEW — 12 routes)

| Frontend Function | API Path | Backend Handler | SAM Event | Status |
|-------------------|----------|----------------|-----------|--------|
| `getPortfolioReport()` | GET `/api/v1/reports/portfolio` | `handleGetPortfolioReport` | ReportsProxy | NEW |
| `fetchPortfolioHealthReport()` | GET `/api/v1/reports/portfolio/health` | `handleGetPortfolioHealthReport` | ReportsProxy | NEW |
| `fetchLoanDisbursementReport()` | GET `/api/v1/reports/disbursements` | `handleGetDisbursementReport` | ReportsProxy | NEW |
| `getCollectionReport()` | GET `/api/v1/reports/collections` | `handleGetCollectionReport` | ReportsProxy | NEW |
| `fetchPaymentCollectionReport()` | GET `/api/v1/reports/collections/detailed` | `handleGetCollectionDetailedReport` | ReportsProxy | NEW |
| `getKYCReport()` | GET `/api/v1/reports/kyc` | `handleGetKYCReport` | ReportsProxy | NEW |
| `fetchKycStatusReport()` | GET `/api/v1/reports/kyc/detailed` | `handleGetKYCDetailedReport` | ReportsProxy | NEW |
| `getDefaultReport()` | GET `/api/v1/reports/defaults` | `handleGetDefaultReport` | ReportsProxy | NEW |
| `fetchDefaultRateReport()` | GET `/api/v1/reports/defaults/summary` | `handleGetDefaultSummaryReport` | ReportsProxy | NEW |
| `fetchCustomerAcquisitionReport()` | GET `/api/v1/reports/acquisition` | `handleGetAcquisitionReport` | ReportsProxy | NEW |
| `getRevenueReport()` | GET `/api/v1/reports/revenue` | `handleGetRevenueReport` | ReportsProxy | NEW |
| `getLoanApprovalReport()` | GET `/api/v1/reports/loan-approvals` | `handleGetLoanApprovalReport` | ReportsProxy | NEW |

## Customers

| Frontend Function | API Path | Backend Handler | SAM Event | Status |
|-------------------|----------|----------------|-----------|--------|
| `getCustomers()` | GET `/api/v1/customers` | `handleGetCustomers` | CustomersRoot | OK |
| `getCustomerById()` | GET `/api/v1/customers/:id` | `handleGetCustomerById` | CustomersProxy | OK |
| `updateCustomer()` | PATCH `/api/v1/customers/:id` | `handleUpdateCustomer` | CustomersProxy | NEW |
| `getCustomerLoans()` | GET `/api/v1/customers/:id/loans` | `handleGetCustomerLoans` | CustomersProxy | OK |
| `getCustomerPayments()` | GET `/api/v1/customers/:id/payments` | `handleGetCustomerPayments` | CustomersProxy | OK |
| `getCustomerCreditScore()` | GET `/api/v1/customers/:id/credit-score` | `handleGetCustomerCreditScore` | CustomersProxy | OK |
| `fetchCreditScoreHistory()` | GET `/api/v1/customers/:id/credit-score/history` | `handleGetCreditScoreHistory` | CustomersProxy | OK |
| `getCustomerKYC()` | GET `/api/v1/customers/:id/kyc` | `handleGetCustomerKYC` | CustomersProxy | OK |
| `getCustomerTimeline()` | GET `/api/v1/customers/:id/timeline` | `handleGetCustomerTimeline` | CustomersProxy | OK |
| `addCustomerNote()` | POST `/api/v1/customers/:id/notes` | `handleAddCustomerNote` | CustomersProxy | OK |
| `updateCustomerStatus()` | PATCH `/api/v1/customers/:id/status` | `handleUpdateCustomerStatus` | CustomersProxy | OK |
| `approveKYC()` | POST `/api/v1/kyc/submissions/:id/approve` | `handleApproveKYC` | KYCProxy | OK |
| `rejectKYC()` | POST `/api/v1/kyc/submissions/:id/reject` | `handleRejectKYC` | KYCProxy | OK |

## Devices (Lock/Unlock + Handovers NEW)

| Frontend Function | API Path | Backend Handler | SAM Event | Status |
|-------------------|----------|----------------|-----------|--------|
| Devices list | GET `/admin/devices` | `handleGetDevices` | AdminProxy | OK |
| Device detail | GET `/admin/devices/:id` | `handleGetDeviceById` | AdminProxy | OK |
| Lock history | GET `/admin/devices/:id/lock-history` | `handleGetDeviceLockHistory` | AdminProxy | NEW |
| Lock device | POST `/admin/devices/:id/lock` | `handleLockDevice` | AdminProxy | NEW |
| Unlock device | POST `/admin/devices/:id/unlock` | `handleUnlockDevice` | AdminProxy | NEW |
| Update lock status | PATCH `/admin/devices/:id/status` | `handleUpdateDeviceLockStatus` | AdminProxy | NEW |
| Get handovers | GET `/admin/devices/handovers` | `handleGetDeviceHandovers` | AdminProxy | NEW |
| Update handover | PATCH `/admin/devices/handovers/:id` | `handleUpdateHandoverStatus` | AdminProxy | NEW |

## Fineract (Reject/WriteOff/Close NEW)

| Frontend Function | API Path | Backend Handler | SAM Event | Status |
|-------------------|----------|----------------|-----------|--------|
| `getFineractLoans()` | GET `/api/v1/fineract/loans` | `handleGetLoans` | GetLoans | OK |
| `getFineractLoanDetail()` | GET `/api/v1/fineract/loans/:loanId` | `handleGetLoanDetail` | GetLoanDetail | OK |
| `getPendingApprovalLoans()` | GET `/api/v1/fineract/loans/pending` | `handleGetPendingLoans` | GetPendingLoans | OK |
| `approveFineractLoan()` | POST `/api/v1/fineract/loans/:loanId/approve` | `handleLoanApprove` | ApproveLoan | OK |
| `disburseFineractLoan()` | POST `/api/v1/fineract/loans/:loanId/disburse` | `handleLoanDisburse` | DisburseLoan | OK |
| `recordFineractRepayment()` | POST `/api/v1/fineract/loans/:loanId/repayment` | `handleLoanRepayment` | RecordRepayment | OK |
| `rejectFineractLoan()` | POST `/api/v1/fineract/loans/:loanId/reject` | `handleLoanReject` | RejectLoan | NEW |
| `writeOffFineractLoan()` | POST `/api/v1/fineract/loans/:loanId/writeoff` | `handleLoanWriteOff` | WriteOffLoan | NEW |
| `closeFineractLoan()` | POST `/api/v1/fineract/loans/:loanId/close` | `handleLoanClose` | CloseLoan | NEW |
| `createFineractProductFromLynia()` | POST `/api/v1/fineract/loan-products/create-from-lynia` | `handleCreateFineractProduct` | CreateFineractProduct | NEW |
| `getFineractLoanProducts()` | GET `/api/v1/fineract/loan-products` | `handleGetLoanProducts` | GetLoanProducts | OK |
| `getGLAccounts()` | GET `/api/v1/fineract/gl-accounts` | `handleGetGLAccounts` | GetGLAccounts | OK |
| `getJournalEntries()` | GET `/api/v1/fineract/journal-entries` | `handleGetJournalEntries` | GetJournalEntries | OK |
| `getTrialBalance()` | GET `/api/v1/fineract/trial-balance` | `handleGetTrialBalance` | GetTrialBalance | OK |
| `getCoreBankingHealth()` | GET `/api/v1/fineract/system-health` | `handleGetSystemHealth` | FineractSystemHealth | OK |
| `getReconciliationResults()` | GET `/api/v1/fineract/reconciliation` | `handleGetReconciliation` | GetReconciliation | OK |
| `triggerReconciliation()` | POST `/api/v1/fineract/reconciliation/run` | `handleRunReconciliation` | RunReconciliation | OK |
| `getOverdueLoans()` | GET `/api/v1/fineract/loans/overdue` | `handleGetOverdueLoans` | GetOverdueLoans | OK |
| `getAgingSummary()` | GET `/api/v1/fineract/loans/aging-summary` | `handleGetAgingSummary` | GetAgingSummary | OK |

---

## Summary

| Category | Total Routes | NEW in 1.5 | Coverage |
|----------|-------------|------------|----------|
| Dashboard | 5 | 0 | 100% |
| Payments | 12 | 12 | 100% |
| Reports | 12 | 12 | 100% |
| Customers | 13 | 1 | 100% |
| Devices | 8 | 6 | 100% |
| Fineract | 19 | 4 | 100% |
| **Total Mapped** | **69** | **35** | **100%** |

All frontend API calls have matching backend handlers and SAM API Gateway events. Zero orphaned routes.
