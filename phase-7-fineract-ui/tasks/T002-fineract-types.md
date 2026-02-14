# T002: Define Fineract-Aware Frontend Types

**Status**: COMPLETE
**Type**: Foundation / Types
**File**: `frontend/admin-portal/src/types/fineract.ts`
**Test**: `src/__tests__/fineract/fineract-types.test.ts` (7 tests)

## Objective

Define comprehensive TypeScript interfaces for all Fineract data structures
used by the admin portal UI, including loan views, repayment schedules,
transactions, GL accounting, and reconciliation.

## Types Defined

### Core Loan Types
| Type | Fields | Purpose |
|------|--------|---------|
| `FineractLoanView` | 40+ fields | Combined Lynia + Fineract loan for list views |
| `FineractLoanDetail` | extends LoanView | Full detail with schedule + transactions |
| `RepaymentSchedule` | 10 summary + periods[] | Complete amortization schedule |
| `RepaymentPeriod` | 18 fields | Single installment period breakdown |
| `FineractTransaction` | 12 fields | Loan transaction (disbursement, repayment) |

### Product & Accounting Types
| Type | Fields | Purpose |
|------|--------|---------|
| `FineractLoanProductView` | 20+ fields | Loan product with tier mapping |
| `GLAccount` | 8 fields | Chart of accounts entry |
| `JournalEntry` | 15 fields | Double-entry journal record |
| `TrialBalanceEntry` | 6 fields | Account-level debit/credit summary |

### Reconciliation & Overdue Types
| Type | Fields | Purpose |
|------|--------|---------|
| `ReconciliationResult` | 7 fields | Reconciliation run summary |
| `ReconciliationDiscrepancy` | 7 fields | Individual balance mismatch |
| `OverdueLoan` | extends LoanView | Loan with aging metadata |
| `AgingSummary` | 6 fields | Portfolio aging buckets |

### Action Types (Request/Response)
| Type | Purpose |
|------|---------|
| `ApproveLoanRequest` | Approve loan in Fineract |
| `DisburseLoanRequest` | Disburse approved loan |
| `RecordRepaymentRequest` | Record a payment |
| `FineractActionResponse` | Standard action response |

### Status Mapping

Mapped all 9 Fineract loan status codes to UI-friendly display objects:

```typescript
type FineractLoanStatusCode =
  | 'loanStatusType.submittedAndPendingApproval'  → Pending Approval (yellow)
  | 'loanStatusType.approved'                      → Approved (blue)
  | 'loanStatusType.active'                        → Active (green)
  | 'loanStatusType.closed.obligations.met'        → Closed/Paid (gray)
  | 'loanStatusType.closed.written.off'            → Written Off (dark red)
  | 'loanStatusType.closed.reschedule...'           → Rescheduled (orange)
  | 'loanStatusType.overpaid'                      → Overpaid (purple)
  | 'loanStatusType.rejected'                      → Rejected (red)
  | 'loanStatusType.withdrawn.by.client'           → Withdrawn (light gray)
```

### Helper Function

`getFineractStatusDisplay(code)` returns `{ label, color, bgColor }` for any
status code, with a graceful fallback for unknown codes.

## Test Coverage

| Test | Assertion |
|------|-----------|
| All 9 status codes have map entries | Exhaustive coverage |
| Active status → green colors | Color mapping correct |
| Pending → yellow | Color mapping correct |
| Rejected → red | Color mapping correct |
| Closed/Paid → gray | Color mapping correct |
| Written Off → dark red | Color mapping correct |
| Unknown code → fallback gray | Graceful degradation |

## Design Decisions

1. **Combined Lynia + Fineract view**: `FineractLoanView` carries both
   `lyniaLoanId` and `fineractLoanId` so the UI can reference both systems.
2. **Status as const map**: Enables exhaustive type checking and prevents
   missing status code handling.
3. **Currency as object**: Matches Fineract's `FineractCurrency` structure
   to support multi-currency (USD/ZWL/ZAR) down the line.
4. **Amounts in display units**: Unlike Fineract's internal cents, the UI
   types use display amounts (dollars) since formatting happens at render.
