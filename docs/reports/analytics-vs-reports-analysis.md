# Analytics Tab vs Reports Panel — Analysis & Recommendations

**Date:** 2026-02-17
**Author:** Claude Code (AI-assisted analysis)
**Status:** Approved — implementation in progress

---

## Executive Summary

The Lynia Finance admin dashboard has two data panels: **Analytics** (investor-grade BI) and **Reports** (operational reporting). After thorough analysis, we recommend **keeping both but sharpening their identities** — renaming Reports to "Operations", removing duplicate metrics, and adding missing operational metrics that international digital lenders track.

---

## Current State

### Analytics Tab (Investor-Focused)

| Tab | What it shows |
|-----|--------------|
| **Portfolio** | Total outstanding, active loans, NPL ratio, avg DPD, PAR buckets (7/30/60/90), tier distribution, 30-day trend |
| **Vintage** | Cohort default curves by origination month, vintage summary table |
| **Borrowing Base** | Eligible vs ineligible receivables, concentration limits, advance rate |
| **Financials** | Revenue, net yield, collection rate, repeat borrower rate, monthly revenue/collections/write-offs |
| **Covenants** | 10 covenant tests (PAR thresholds, collection rate, concentration limits, write-off rate, credit score floor) |

- **Data source:** `/api/v1/investor/*` (data warehouse)
- **Refresh:** Auto-refresh every 30 seconds
- **Export:** Full loan tape CSV
- **Target user:** Investors, fund managers, board, credit committee

### Reports Panel (Operations-Focused)

| Report | What it shows |
|--------|--------------|
| **Financial Summary** | Monthly revenue bar chart, total revenue, transaction count |
| **Collection Report** | Payment method breakdown — count + amount per method |
| **Portfolio Quality** | PAR buckets, pie chart, total outstanding |
| **KYC Stats** | Submissions, approved/rejected/pending, avg processing time |
| **Loan Approvals** | Applications, approved/rejected/pending, auto-approved count |
| **Defaulted Loans** | Individual loan-level table with customer details |

- **Data source:** `/api/v1/reports/*`
- **Refresh:** Manual (Generate button)
- **Export:** CSV per report section
- **Target user:** Operations managers, finance team, collections team

---

## Overlap Analysis

| Metric Area | Analytics | Reports | Verdict |
|-------------|-----------|---------|---------|
| PAR buckets | PAR 7/30/60/90 | Current/1-30/31-60/61-90/90+ | **Heavy overlap** |
| Total outstanding / active loans | Portfolio tab KPIs | Portfolio Quality section | **Duplicate** |
| Revenue metrics | Financials tab | Financial Summary | **Partial overlap** |
| Collection data | Collections trend line | Payment method breakdown | **Complementary** |
| NPL / defaults | NPL ratio + count | Individual defaulted loan list | **Complementary** |
| Vintage/cohort analysis | Full vintage curves | Not present | **Unique to Analytics** |
| Borrowing base | Full tab | Not present | **Unique to Analytics** |
| Covenant compliance | 10 tests | Not present | **Unique to Analytics** |
| KYC operational stats | Not present | Submissions/approvals | **Unique to Reports** |
| Loan approval pipeline | Not present | Application funnel | **Unique to Reports** |
| Payment method breakdown | Not present | Per-method totals | **Unique to Reports** |

**Verdict: ~40% overlap, but different audiences**

---

## Options Evaluated

### Option 1: Keep Both (Status Quo)
- Pro: Clear audience separation
- Con: Duplicate metrics, user confusion

### Option 2: Merge Into One
- Pro: Single source of truth
- Con: Cluttered, mixed audiences

### Option 3: Remove Reports
- Pro: Less confusion
- Con: Lose KYC, loan approvals, payment method breakdowns

### Option 4: Remove Analytics
- Pro: Simpler
- Con: Lose investor-grade metrics (vintage, borrowing base, covenants)

---

## Recommendation: Keep Both, Sharpen Identities

1. **Rename:** Analytics stays as-is (investor dashboard). Reports becomes **"Operations"**
2. **Remove duplicates from Reports:** Portfolio Quality and Financial Summary move exclusively to Analytics
3. **Add missing operational metrics** to Reports (see below)
4. **Redesign Reports UI** to international fintech standards with tab-based layout

---

## Missing Metrics for Digital Lenders

### For Analytics (Investor/Strategic)

| Metric | Why it matters | Priority |
|--------|---------------|----------|
| First Payment Default (FPD) Rate | Strongest early credit quality indicator | HIGH |
| Rolling Default Rate (3m/6m/12m) | Default rate over rolling windows | HIGH |
| Loan Book Growth Rate | M-o-M portfolio growth trajectory | HIGH |
| Expected Credit Loss (ECL) | IFRS 9 provision adequacy | HIGH |
| Cost of Risk | Write-offs + provisions as % of avg portfolio | HIGH |
| Return on Assets (ROA) | Net income / average loan book | MEDIUM |
| Weighted Average Interest Rate | Blended rate across tiers | MEDIUM |

### For Reports (Operational)

| Metric | Why it matters | Priority |
|--------|---------------|----------|
| Disbursement Volume & Count | Core throughput metric | HIGH |
| Average Time to Disburse | Operational efficiency | HIGH |
| Collection Efficiency Ratio | Collected / due in period | HIGH |
| Bounce/Failed Payment Rate | Per payment method | HIGH |
| KYC Pass Rate by Step | Funnel conversion tracking | HIGH |
| Customer Acquisition Cost (CAC) | Cost per onboarded customer | MEDIUM |
| Repeat Loan Rate | % taking 2nd loan | MEDIUM |
| Device Lock/Unlock Activity | Lock effectiveness | MEDIUM |
| Loan Restructuring Volume | Early stress signal | MEDIUM |

### Zimbabwe/Africa Specific

| Metric | Why it matters |
|--------|---------------|
| Currency Exposure (USD/ZWL) | Multi-currency risk |
| Mobile Money vs Bank Transfer Split | Channel concentration risk |
| Geographic Concentration | Province-level exposure |
| Rural vs Urban Performance | Different risk profiles |
| Informal Sector Indicator | Core market tracking |

---

## Proposed Final Structure

### Analytics (Investor Dashboard)
1. Portfolio (existing + FPD rate, loan book growth)
2. Vintage (existing + rolling default rate overlay)
3. Borrowing Base (existing)
4. Financials (existing + ROA, cost of risk)
5. Covenants (existing)
6. NEW: Provisions (ECL, provision coverage ratio)

### Operations Reports (Redesigned)
1. **Disbursements** — volume, count, avg time to disburse
2. **Collections** — efficiency ratio, bounce rate, method breakdown
3. **KYC Pipeline** — pass rate by step, rejection reasons, processing time
4. **Defaults & Recovery** — PAR metrics + individual loan table + recovery rate
5. **Devices** — lock/unlock activity, device status distribution
6. **Customer Acquisition** — funnel, source breakdown, onboarding time, CAC
