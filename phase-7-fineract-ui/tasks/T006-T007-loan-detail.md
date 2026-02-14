# T006-T007: Fineract Loan Detail Page

**Status**: COMPLETE
**Type**: Feature / UI Component
**Tests**: `src/__tests__/fineract/fineract-loan-detail.test.tsx` (7 tests)
**Component**: `src/components/fineract/fineract-loan-detail-page.tsx`
**Route**: `/loans/[id]/fineract`

## Objective

Build a comprehensive loan detail page that shows Fineract balance summaries,
repayment schedule, transaction history, loan timeline, and device information,
with the ability to record payments for active loans.

## Features

### Header
- Customer name (large, bold)
- Fineract status badge (color-coded)
- Account number + product name
- "Record Payment" button (visible only for active loans)

### Balance Summary Cards (4 cards)
| Card | Data | Highlight |
|------|------|-----------|
| Principal Outstanding | Outstanding / paid of disbursed | Normal |
| Interest Outstanding | Outstanding / paid of charged | Normal |
| Total Outstanding | Outstanding / paid of expected | Red if overdue |
| Total Overdue | Overdue amount + since date | Red (only when > 0) |

### Loan Details Panel
- Principal amount
- Interest rate (monthly + annual)
- Interest type (Declining Balance)
- Repayment schedule (count x frequency)
- Amortization type

### Loan Timeline
Visual timeline with completed/pending indicators:
1. Submitted (date)
2. Approved (date)
3. Disbursed (date)
4. Expected Maturity (date)
5. Closed (date, if applicable)

### Device Information
- Device brand + model (e.g., "Samsung Galaxy A14")
- IMEI number
- Fallback: "No device assigned"

### Repayment Schedule
- Rendered via `RepaymentScheduleTable` sub-component (see T010-T011)
- Full period-by-period breakdown

### Transaction History
- Table with columns: Date, Type, Amount, Principal, Interest, Balance
- Type badges: Disbursement (blue), Repayment (green)
- Reversed transactions marked with "(reversed)" label

### Record Payment Modal
- Triggered by "Record Payment" button
- Rendered via `RecordPaymentForm` sub-component
- Success callback triggers data refresh via `refetch()`

## Sub-components

| Component | Purpose |
|-----------|---------|
| `BalanceCard` | Renders a single balance metric card |
| `DetailRow` | Key-value row for loan details panel |
| `TimelineEntry` | Single timeline step with done/pending state |

## Test Coverage (7 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders header with status | Customer name + "Active" badge |
| 2 | Displays balance summary | "Principal Outstanding" etc. labels |
| 3 | Renders repayment schedule | "Repayment Schedule" heading + period rows |
| 4 | Renders transaction history | "Transaction History" + Disbursement/Repayment entries |
| 5 | Shows loan timeline | "Loan Timeline" heading visible |
| 6 | Shows device information | "Samsung Galaxy A14" rendered |
| 7 | Handles loan not found | "Loan not found" message for null response |

## Loading State

Skeleton loading with:
- Animated title bar (48px wide)
- 3 placeholder cards (grid layout)

## Implementation Notes

- Accepts `loanId` prop (passed from Next.js dynamic route params)
- Uses `useQuery` for data fetching
- Payment modal managed via local `showPaymentForm` state
- Back navigation via `router.back()`
