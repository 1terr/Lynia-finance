# Operations Reports — Implementation Plan

**Date:** 2026-02-17
**Author:** Claude Code (AI-assisted)
**Status:** Approved — implementing

---

## Overview

Redesign the Reports tab to international fintech standards (Stripe, Branch, Tala, Adyen patterns). Replace the monolithic 682-line scroll page with a tab-based layout that integrates the 7 pre-built modular report components.

---

## UI/UX Design (International Standards)

```
+----------------------------------------------------------+
|  Operations Reports                   [DateRangeFilter]   |
|  Real-time operational intelligence    7D 30D 90D MTD...  |
+----------------------------------------------------------+
|  [Disbursements] [Collections] [Total] [Active Defaults]  |  <- Summary KPIs
|  [$125,000 +12%] [87.5% +2.1%] [92.3%] [14 loans -3]    |
+----------------------------------------------------------+
| [Disbursements][Collections][KYC][Defaults][Devices]      |  <- Tab bar
| [Acquisition]                                             |
+----------------------------------------------------------+
|                                                           |
|  Tab Content:                                             |
|  - MetricCards row (5 KPIs with trend arrows)             |
|  - Charts (bar chart + donut/funnel)                      |
|  - DataTable (sortable, exportable)                       |
|  - Export CSV button                                      |
|                                                           |
+----------------------------------------------------------+
```

### Key UI/UX Patterns
- **Date range presets** (7D, 30D, 90D, MTD, YTD, Custom) — like Stripe
- **MetricCards with trend indicators** — green up / red down arrows vs previous period
- **Tab-based navigation** — no endless scrolling
- **Per-tab exports** — CSV download per report section
- **Consistent data tables** — typed columns, hover states, alignment
- **Loading per section** — individual spinners, not global
- **Empty states** — helpful messaging per tab

---

## Tab Structure

### 1. Disbursements Tab (NEW)
**Component:** `LoanDisbursementReport`
**Metrics:** Total disbursed, total value, avg loan size, approval rate, growth %
**Visualization:** DataTable with weekly breakdown
**Export:** CSV

### 2. Collections Tab (ENHANCED)
**Component:** `PaymentCollectionReport`
**Metrics:** Expected, collected, collection rate, transactions, failed
**Visualization:** Bar chart by payment method + DataTable
**Export:** CSV

### 3. KYC Pipeline Tab (ENHANCED)
**Component:** `KycStatusReport`
**Metrics:** Total submissions, approved, rejected, pending, approval rate
**Visualization:** Donut chart + rejection reasons bar chart + DataTable
**Export:** CSV

### 4. Defaults & Recovery Tab (ENHANCED)
**Component:** `DefaultRateReport` + individual loans table
**Metrics:** PAR 30/60/90, default rate, recovery rate, write-off rate, total outstanding
**Visualization:** PAR bar chart + individual defaulted loans table
**Export:** CSV for both aggregate and loan-level data

### 5. Devices Tab (NEW)
**Component:** `DeviceManagementReport`
**Metrics:** Total, active, locked, in stock, lock/unlock ops, avg lock duration
**Visualization:** Donut chart + DataTable
**Export:** CSV

### 6. Customer Acquisition Tab (NEW)
**Component:** `CustomerAcquisitionReport`
**Metrics:** New customers, completion rate, avg onboarding days, CAC
**Visualization:** Acquisition funnel + source bar chart + DataTable
**Export:** CSV

---

## Metrics Added (vs current state)

| New Metric | Tab | Source |
|------------|-----|--------|
| Disbursement volume & count | Disbursements | NEW |
| Avg loan size | Disbursements | NEW |
| Disbursement growth % | Disbursements | NEW |
| Collection efficiency ratio | Collections | ENHANCED |
| Failed payment count | Collections | NEW |
| Expected vs actual collections | Collections | NEW |
| KYC rejection reasons | KYC Pipeline | NEW |
| KYC approval rate | KYC Pipeline | ENHANCED |
| PAR 30/60/90 breakdown | Defaults | ENHANCED |
| Recovery rate | Defaults | NEW |
| Write-off rate | Defaults | NEW |
| Device lock/unlock operations | Devices | NEW |
| Avg lock duration | Devices | NEW |
| Customer acquisition funnel | Acquisition | NEW |
| Cost per acquisition | Acquisition | NEW |
| Onboarding time | Acquisition | NEW |
| Customers by source | Acquisition | NEW |

---

## Removed (moved to Analytics)

| Removed Section | Reason |
|----------------|--------|
| Financial Summary (revenue chart) | Duplicate — Analytics Financials tab |
| Portfolio Quality (PAR pie chart) | Duplicate — Analytics Portfolio tab |

---

## Files Changed

| File | Action |
|------|--------|
| `frontend/admin-portal/src/app/(dashboard)/reports/_client.tsx` | Rewrite — tab layout |
| `frontend/admin-portal/src/lib/api/reports.ts` | Add 6 API functions |
| `frontend/admin-portal/src/components/layout/sidebar.tsx` | Rename label |
| `docs/reports/analytics-vs-reports-analysis.md` | Create — analysis doc |
| `docs/reports/operations-reports-implementation-plan.md` | Create — this file |

---

## Verification Checklist

- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Next.js builds (`pnpm build`)
- [ ] 6 tabs render correctly at `/reports`
- [ ] DateRangeFilter presets work
- [ ] CSV export works per tab
- [ ] Sidebar shows "Operations" label
- [ ] No duplicate content with Analytics
- [ ] Summary KPIs show above tabs
