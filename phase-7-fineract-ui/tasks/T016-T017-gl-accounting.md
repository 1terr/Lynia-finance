# T016-T017: GL Journal Entries & Trial Balance

**Status**: COMPLETE
**Type**: Feature / UI Component
**Tests**: `src/__tests__/fineract/fineract-gl-accounting.test.tsx` (7 tests)
**Component**: `src/components/fineract/gl-accounting-dashboard.tsx`
**Route**: `/fineract/accounting`

## Objective

Build a tabbed accounting dashboard that displays Fineract's General Ledger
accounts, journal entries, and trial balance for RBZ regulatory reporting.

## Features

### Three-Tab Layout

| Tab | Icon | Content |
|-----|------|---------|
| GL Accounts | BookOpen | Chart of accounts table |
| Journal Entries | FileText | Filtered double-entry journal |
| Trial Balance | Calculator | Debit/credit summary with totals |

### Tab 1: GL Accounts

| Column | Data |
|--------|------|
| Code | GL code (monospace, e.g., "1001") |
| Name | Account name |
| Type | ASSET (blue), LIABILITY (orange), INCOME (green), EXPENSE (red) |
| Usage | DETAIL or HEADER |
| Description | Account description |

Accounts include:
- 1001 Cash and Bank (ASSET)
- 1100 Loan Portfolio (ASSET)
- 1200 Interest Receivable (ASSET)
- 2001 Overpayment Liability (LIABILITY)
- 4001 Interest Income (INCOME)
- 4002 Fee Income (INCOME)
- 5001 Loan Write-Off (EXPENSE)

### Tab 2: Journal Entries

**Filters**:
- From Date (date picker with label)
- To Date (date picker with label)

**Table Columns**:

| Column | Data |
|--------|------|
| Date | Transaction date |
| Account | GL account name |
| Code | GL code (monospace) |
| Type | DEBIT (blue badge) or CREDIT (green badge) |
| Amount | Formatted currency |
| Entity | Entity type + ID (e.g., "LOAN #101") |
| Txn ID | Transaction identifier (monospace) |

### Tab 3: Trial Balance

**Table Columns**:

| Column | Data |
|--------|------|
| Code | GL code |
| Account | Account name |
| Type | Account type (color-coded badge) |
| Debit | Total debit amount |
| Credit | Total credit amount |
| Balance | Net balance with DR/CR suffix |

**Totals Row**:
- Summed debits, credits, and net balance
- Bold text, gray background, thick top border

**Balance Display**:
- Negative balances shown in red with "CR" suffix
- Positive balances shown in black with "DR" suffix

## RBZ Compliance Context

The Reserve Bank of Zimbabwe requires:
- 7-year retention of transaction records
- Monthly transaction reports
- Annual compliance audits

This dashboard provides the GL data needed for these reports, sourced
directly from Fineract's accrual-based accounting engine.

## Test Coverage (7 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders GL accounts | "Cash and Bank", "Loan Portfolio", "Interest Income" |
| 2 | Renders journal entries | "Journal Entries" heading + DEBIT/CREDIT entries |
| 3 | Renders trial balance | "Trial Balance" heading + GL codes (1001, 1100) |
| 4 | Shows account type labels | "ASSET" badge visible |
| 5 | Shows GL account codes | "1001", "1100", "4001" visible |
| 6 | Supports date filtering | From/To date inputs with labels |
| 7 | Shows totals row | "Total" text in trial balance footer |

## Implementation Notes

- All three queries fire in parallel on page load (independent data)
- Tab state managed via local `useState` (no URL routing per tab)
- Date filters trigger re-fetch for journal entries only
- Trial balance computes totals client-side from the array data
