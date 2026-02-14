# T012-T013: Reconciliation Dashboard

**Status**: COMPLETE
**Type**: Feature / UI Component
**Tests**: `src/__tests__/fineract/fineract-reconciliation.test.tsx` (7 tests)
**Component**: `src/components/fineract/reconciliation-dashboard.tsx`
**Route**: `/fineract/reconciliation`

## Objective

Build a dashboard that compares loan balances between the Lynia database
and the Fineract core banking engine, displaying discrepancies with
severity indicators and enabling manual reconciliation triggers.

## Features

### Summary Cards (4 cards)

| Card | Icon | Data | Highlight |
|------|------|------|-----------|
| Loans Checked | Activity (blue) | Total count | None |
| Matched | CheckCircle (green) | Count of matching balances | Green |
| Discrepancies | AlertTriangle (orange) | Count of mismatches | Orange (if > 0) |
| Retried Syncs | RefreshCw (purple) | Success/total ratio | None |

### Discrepancy Table

| Column | Data |
|--------|------|
| Customer | Customer name |
| Fineract Loan | Fineract loan ID |
| Lynia Balance | Balance from Lynia DB |
| Fineract Balance | Balance from Fineract |
| Difference | Absolute difference (red) |
| Severity | Badge: low (yellow), medium (orange), high (red) |
| Last Synced | Timestamp of last sync |

### Severity Indicators

| Severity | Badge Color | Icon |
|----------|-------------|------|
| low | Yellow | AlertTriangle |
| medium | Orange | AlertTriangle |
| high | Red | XCircle |

### Manual Reconciliation
- "Run Reconciliation" button in header
- Spinning refresh icon during processing
- On success: Invalidates cache → refreshes results

### All Balanced State
- Green dashed border container
- Green checkmark icon
- "All Balanced" heading
- "Lynia and Fineract balances are in sync" subtitle

### Metadata
- Last run timestamp displayed in header (formatted with `formatDateTime`)

## Test Coverage (7 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders summary | "Reconciliation" heading + counts (45, 43, 2) |
| 2 | Displays discrepancy details | Customer name "Tapiwa Madzivire" visible |
| 3 | Shows severity badges | "medium" and "low" badges render |
| 4 | Displays retry stats | "Retried Syncs" label present |
| 5 | Shows trigger button | "Run Reconciliation" button present |
| 6 | Triggers manual reconciliation | `triggerReconciliation` API called on click |
| 7 | Shows last run timestamp | "Last run" text present |

## Business Context

Reconciliation is critical for Lynia's financial integrity:
- Lynia DB holds the operational loan data (customer-facing)
- Fineract holds the accounting truth (GL entries, RBZ reporting)
- Discrepancies can arise from sync failures, timing issues, or bugs
- This dashboard enables finance staff to identify and resolve mismatches
- The retry mechanism automatically attempts to re-sync failed records
