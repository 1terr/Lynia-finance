# T003: Fineract API Client for Frontend

**Status**: COMPLETE
**Type**: Foundation / API Layer
**File**: `frontend/admin-portal/src/lib/api/fineract.ts`
**Test**: `src/__tests__/fineract/fineract-api-client.test.ts` (14 tests)

## Objective

Create a typed API client module with functions that call backend Lambda
proxy endpoints for all Fineract operations needed by the admin portal.

## API Functions (14)

### Loan Operations
| Function | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| `getFineractLoans(filters)` | GET | `/api/v1/fineract/loans` | Paginated loan list |
| `getFineractLoanDetail(id)` | GET | `/api/v1/fineract/loans/:id` | Single loan detail |
| `getPendingApprovalLoans(page)` | GET | `/api/v1/fineract/loans/pending` | Pending approval queue |
| `approveFineractLoan(id, req)` | POST | `/api/v1/fineract/loans/:id/approve` | Approve in Fineract |
| `disburseFineractLoan(id, req)` | POST | `/api/v1/fineract/loans/:id/disburse` | Disburse loan |
| `recordFineractRepayment(id, req)` | POST | `/api/v1/fineract/loans/:id/repayment` | Record payment |

### Product & Accounting
| Function | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| `getFineractLoanProducts()` | GET | `/api/v1/fineract/loan-products` | All loan products |
| `getFineractLoanProduct(id)` | GET | `/api/v1/fineract/loan-products/:id` | Single product |
| `getGLAccounts()` | GET | `/api/v1/fineract/gl-accounts` | Chart of accounts |
| `getJournalEntries(filters)` | GET | `/api/v1/fineract/journal-entries` | Filtered journal |
| `getTrialBalance(from, to)` | GET | `/api/v1/fineract/trial-balance` | Trial balance |

### Reconciliation & Overdue
| Function | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| `getReconciliationResults()` | GET | `/api/v1/fineract/reconciliation` | Latest results |
| `triggerReconciliation()` | POST | `/api/v1/fineract/reconciliation/run` | Manual trigger |
| `getOverdueLoans(page)` | GET | `/api/v1/fineract/loans/overdue` | Overdue loan list |
| `getAgingSummary()` | GET | `/api/v1/fineract/loans/aging-summary` | Aging buckets |

## Safety Features

- **Page size cap**: All paginated functions enforce `MAX_PAGE_SIZE` (100)
- **Auth**: Inherits JWT token injection from `fetchAPI` base client
- **Error handling**: Detail/product functions return `null` on error (not throw)
- **Query param sanitization**: Filters built via `URLSearchParams`
- **Type safety**: Full TypeScript generics from request to response

## Filter Interfaces

```typescript
interface FineractLoanFilters {
  status?: FineractLoanStatusCode;
  search?: string;
  page?: number;
  limit?: number;
}

interface JournalEntryFilters {
  glAccountId?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}
```

## Test Coverage (14 tests)

| Test | Assertion |
|------|-----------|
| Default params (page=1, limit=25) | Correct query string |
| Status filter included | Query param present |
| Search filter included | Query param present |
| Limit capped at MAX_PAGE_SIZE | 500 → 100 |
| Loan detail calls correct path | `/api/v1/fineract/loans/loan-001` |
| Loan detail returns null on error | Graceful handling |
| Approve sends POST with date | Method + body correct |
| Disburse sends POST | Method correct |
| Repayment sends POST with amount | Body contains amount |
| Products calls correct endpoint | Path correct |
| GL accounts calls correct endpoint | Path correct |
| Journal entries include date filters | Query params correct |
| Trial balance with/without dates | Conditional query params |
| Overdue pagination | page + limit params |
