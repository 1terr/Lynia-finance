# T010-T011: Repayment Schedule & Payment Recording

**Status**: COMPLETE
**Type**: Feature / UI Components
**Tests**: `src/__tests__/fineract/fineract-repayment.test.tsx` (10 tests)
**Components**:
- `src/components/fineract/repayment-schedule-table.tsx`
- `src/components/fineract/record-payment-form.tsx`

## Objective

Build two components: (1) a repayment schedule table showing period-by-period
installment details from Fineract, and (2) a payment recording form that
posts transactions to Fineract via the backend API.

---

## RepaymentScheduleTable

### Props
```typescript
interface Props {
  schedule: RepaymentSchedule;
}
```

### Schedule Summary
Shows 4 metrics in a gray card:
- Total Expected repayment
- Total Paid to date
- Total Outstanding
- Loan Term in days

### Period Table Columns

| Column | Data |
|--------|------|
| # | Period number |
| Due Date | Due date + paid date (if paid) |
| Status | Paid (green) / Due (yellow) / Overdue (red) |
| Principal | Principal due for period |
| Interest | Interest due for period |
| Total Due | Combined total due |
| Paid | Amount paid for this period |
| Balance | Remaining loan balance after period |

### Status Logic

```
if period.complete → "Paid" (green badge)
if period.totalOverdue > 0 OR dueDate < today → "Overdue" (red badge + red background)
else → "Due" (yellow badge)
```

### Test Coverage (5 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders all periods | Numbers 1-12 visible |
| 2 | Shows "Paid" for completed | At least 2 "Paid" badges |
| 3 | Shows "Due" for unpaid | "Due" badges present |
| 4 | Displays schedule totals | "Schedule Summary" section |
| 5 | Handles overdue periods | Period row renders correctly |

---

## RecordPaymentForm

### Props
```typescript
interface Props {
  lyniaLoanId: string;
  outstandingBalance: number;
  onSuccess: () => void;
  onCancel: () => void;
}
```

### Form Fields

| Field | Type | Validation |
|-------|------|------------|
| Amount (USD) | number input | Required, > 0, <= outstanding |
| Payment Date | date input | Required, defaults to today |
| Note | textarea | Optional |

### Validation Rules

1. **Amount > 0**: Shows "Amount must be greater than zero"
2. **Amount <= outstanding**: Shows "Amount exceeds outstanding balance"
3. **Date required**: Shows "Payment date is required"

Validation runs client-side before API call. Errors displayed in red box.

### API Call

```typescript
recordFineractRepayment(lyniaLoanId, {
  transactionDate: date,
  transactionAmount: parseFloat(amount),
  note: note || undefined,
})
```

Uses React Query `useMutation` with:
- `onSuccess`: Calls `onSuccess` prop (parent triggers refetch)
- `onError`: Displays error message

### UI Elements
- Outstanding balance display (gray card)
- Cancel button (outlined, calls `onCancel`)
- Submit button (brand color, disabled during processing)
- Loading state: "Processing..." text on submit button

### Test Coverage (5 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders form fields | "Record Payment", amount + date inputs |
| 2 | Shows outstanding balance | Balance amount visible |
| 3 | Submits repayment to Fineract | API called with correct amount + date |
| 4 | Validates positive amount | Error message for amount = 0 |
| 5 | Validates amount <= outstanding | Error for 500 > 210 outstanding |
| 6 | Cancel button works | `onCancel` callback invoked |
