# T004-T005: Fineract Loan List Page

**Status**: COMPLETE
**Type**: Feature / UI Component
**Tests**: `src/__tests__/fineract/fineract-loan-list.test.tsx` (6 tests)
**Component**: `src/components/fineract/fineract-loans-page.tsx`
**Route**: `/fineract/loans`

## Objective

Build a paginated loan portfolio page that displays real-time loan data
from the Fineract core banking engine with filtering and search.

## Features

### Data Display
- **Customer info**: Name, phone number
- **Fineract identifiers**: Account number, Fineract loan ID
- **Product**: Tier name (Entry/Standard/Premium)
- **Financials**: Principal, term, interest rate, outstanding balance
- **Overdue indicator**: Red text when `totalOverdue > 0`
- **Status badge**: Color-coded Fineract status (9 status codes)
- **Device**: Brand + model (e.g., "Samsung Galaxy A14")
- **Date**: Submission date

### Filtering & Search
- **Status filter**: Dropdown with all Fineract statuses + "All Statuses"
- **Search**: Free-text search by loan ID or customer name
- **Pagination**: Page navigation with total count display

### Real-time Updates
- 30-second auto-refresh via React Query `refetchInterval`
- Shows total loan count (e.g., "45 total loans")

### Navigation
- Click any row → navigates to `/loans/{id}/fineract` detail page

### Empty State
- "No loans found" message when no results match filters

## Column Layout

| Column | Data | Sortable |
|--------|------|----------|
| Account | Fineract account # + loan ID | No |
| Customer | Name + phone | No |
| Product | Tier name (shortened) | No |
| Principal | Amount + term + rate | Yes |
| Outstanding | Balance + overdue amount | Yes |
| Status | Color-coded badge | No |
| Device | Brand + model | No |
| Date | Submission date | Yes |

## Test Coverage (6 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders page header | "Loan Portfolio" + description visible |
| 2 | Displays loans with balances | Customer names + status badges render |
| 3 | Shows balance columns | "Outstanding" + "Status" headers present |
| 4 | Filters by Fineract status | API called with status param |
| 5 | Supports search | API called with search param |
| 6 | Shows empty state | "No loans found" when data is empty |
| 7 | Shows total count | "45 total loans" text rendered |

## Implementation Notes

- Uses `useQuery` from `@tanstack/react-query` for data fetching
- Leverages existing `DataTable` and `Pagination` UI components
- Status display via `getFineractStatusDisplay()` helper from types
- Product name shortened by stripping "Lynia Device Finance - " prefix
