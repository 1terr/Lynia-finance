# T018-T019: Overdue Loans & Aging Analysis

**Status**: COMPLETE
**Type**: Feature / UI Component
**Tests**: `src/__tests__/fineract/fineract-overdue.test.tsx` (6 tests)
**Component**: `src/components/fineract/overdue-loans-page.tsx`
**Route**: `/fineract/overdue`

## Objective

Build an overdue loans page with aging bucket analysis (1-30, 31-60,
61-90, 90+ days past due), device lock status tracking, and
portfolio-at-risk metrics.

## Features

### Total Overdue Banner
- Red background card with:
  - TrendingDown icon
  - "Total Overdue Portfolio" label
  - Total overdue amount (large, bold)
  - Total overdue loan count

### Aging Summary Cards (4-column grid)

| Bucket | Color | Data |
|--------|-------|------|
| 1-30 Days | Yellow | Count + total overdue amount |
| 31-60 Days | Orange | Count + total overdue amount |
| 61-90 Days | Red | Count + total overdue amount |
| 90+ Days | Dark Red | Count + total overdue amount |

Each card has an AlertTriangle icon in the bucket's color.

### Overdue Loans Table

| Column | Data |
|--------|------|
| Customer | Name + phone |
| Product | Tier name |
| Outstanding | Total outstanding balance |
| Overdue | Overdue amount (red) |
| DPD | Days past due (bold red) |
| Bucket | Aging bucket badge (color-coded) |
| Last Payment | Date + amount (or "Never") |
| Device Lock | Lock status badge |

### Device Lock Status Badges

| Status | Icon | Color |
|--------|------|-------|
| locked | Lock | Red |
| unlocked | Unlock | Gray |
| pending | Clock | Yellow |

### Navigation
- Click any row → navigates to `/loans/{id}/fineract` detail page
- Pagination for large overdue portfolios

### Loading State
- Skeleton rows with animated pulse effect

### Empty State
- Green clock icon
- "No overdue loans" message

## Aging Bucket Color System

```
1-30 days:  Yellow (early warning)
31-60 days: Orange (escalation needed)
61-90 days: Red (serious delinquency)
90+ days:   Dark red (write-off candidate)
```

This mirrors standard microfinance PAR (Portfolio at Risk) reporting:
- PAR30 = 1-30 bucket
- PAR60 = 31-60 bucket
- PAR90 = 61-90 bucket
- PAR90+ = 90+ bucket (potential write-off)

## Test Coverage (6 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders aging buckets | "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days" |
| 2 | Shows total overdue amount | "$3,210.00" visible |
| 3 | Shows count per bucket | "8" (1-30), "4" (31-60) visible |
| 4 | Displays overdue loan details | Customer name, DPD, bucket visible |
| 5 | Shows device lock status | "locked" badge rendered |
| 6 | Shows total overdue count | "15" visible |

## Business Context

Overdue loan management is the core risk function for Lynia's device
financing business:

1. **1-30 DPD**: Automated WhatsApp reminders, no device lock
2. **31-60 DPD**: Escalation to collections team, warning messages
3. **61-90 DPD**: Device lock via Trustonic, formal collections
4. **90+ DPD**: Write-off candidate, requires RBZ reporting

This page gives the collections team and finance managers a single view
of delinquency across the entire portfolio.

## Sub-components

| Component | Purpose |
|-----------|---------|
| `AgingBucketCard` | Single aging bucket summary card |
| `AgingBadge` | Inline badge showing bucket label |
| `LockStatusBadge` | Device lock status with icon |
