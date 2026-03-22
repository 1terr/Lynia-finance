# Suite Audit 1.5 — Reporting System Audit

> **Date:** 2026-03-21
> **Scope:** System-wide audit of all metrics, reports, search functionality, and data linkages across Admin Portal and Distributor Dashboard
> **Data Sources:** Fineract (core banking), Lynia PostgreSQL (transactional), Data Warehouse (nightly ETL)
> **Status:** IMPLEMENTED — pending production deployment

---

## Executive Summary

Comprehensive audit of all reporting infrastructure across both dashboards revealed **11 critical gaps** and **3 major report duplications**. The audit covered 20+ report pages, 15 admin report API endpoints, 8 investor reporting endpoints, and all search/filter implementations. All identified issues have been resolved in this implementation.

---

## Audit Findings

### Finding 1: No National ID Search (CRITICAL)

**Severity:** Critical
**Impact:** Staff unable to look up customers using Zimbabwe's primary identification document — a core workflow blocker for KYC review, customer support, and regulatory compliance.

**Details:**
- National ID search was absent on ALL pages across both dashboards
- Customer search only supported name, phone, email
- The `customers` table already had a `national_id` column with an index (`idx_customers_national_id`)
- For a fintech serving Zimbabwe's underbanked population, this was a fundamental gap

**Resolution:**
- Added national ID to search on: Customers, Payments, Devices, Fineract Loans pages
- Implemented format-agnostic search (strips dashes/spaces): `63-123456-A-01` and `63123456A01` both work
- National IDs displayed unmasked in admin views (admin/manager users handle KYC)
- Added `national_id` column to customer list DataTable

**Files modified:** `customers.ts`, `payments.ts`, `inventory-devices.ts`, `loans.ts` (backend); `customers/_client.tsx`, `payments/_client.tsx`, `fineract-loans-page.tsx` (frontend)

---

### Finding 2: No Cross-Entity / Global Search (HIGH)

**Severity:** High
**Impact:** Staff navigated 5+ pages manually to find a single customer's records. Average support call resolution time significantly impacted.

**Details:**
- No "search everywhere" capability existed
- Searching for a customer on one page didn't link to their loans, payments, or devices
- Customer detail page only accessible from the customer list — not from other entity views

**Resolution:**
- Built `GET /api/v1/search` endpoint with parallel queries across customers, loans, payments, and devices
- Created Ctrl+K command-palette in admin portal header
- Inline preview shows entity details + links to related records (e.g., customer shows loan/payment/device counts)
- Minimum 2-character query, 300ms debounce, max 5 results per entity type

**Files created:** `global-search.ts` (backend), `global-search.tsx` (frontend), `search.ts` (API client)
**Files modified:** `header.tsx`, `index.ts` (route wiring)

---

### Finding 3: Duplicate Reports (CRITICAL)

**Severity:** Critical — wasted screen real estate, confused users, inconsistent data presentation

| Duplicate Pair | Overlap | Resolution |
|---------------|---------|------------|
| Reports "Defaults & Recovery" tab vs Fineract "Overdue" page | 90% | Removed tab entirely; Fineract Overdue is canonical |
| Reports "Devices" tab vs Devices "Reports" page | 60% | Removed tab entirely; Devices Reports is canonical |
| Reports Summary KPI bar vs Dashboard vs Analytics "Portfolio" | 70% | Removed Summary KPI bar; Dashboard/Analytics are canonical |

**Impact post-fix:** Reports page reduced from 7 tabs + KPI bar to 5 clean tabs. Users now have a single authoritative source for each report type.

**Files modified:** `reports/_client.tsx` (removed ~200 lines of duplicate code)

---

### Finding 4: Distributor Dashboard Search Deficiencies (HIGH)

**Severity:** High
**Impact:** Distributors with dozens/hundreds of transactions scrolled through unbounded lists with no way to find specific records.

| Page | Before | After |
|------|--------|-------|
| Commissions | No search, no pagination, client-side filtering | Server-side search + status/date filters + pagination |
| Transfers | No search, pagination ignored | Search by IMEI/model/distributor + pagination UI |
| Handovers | No search, no pagination | Search by customer/IMEI/model/loan + pagination |
| Inventory | Client-side search only, no export | Added CSV export |

**Backend changes:** Added `search`, `status`, `date_from`/`date_to`, `page`/`limit` params to `commissions.ts`, `transfers.ts`, `handovers.ts`
**Frontend changes:** Added debounced search inputs, pagination components, CSV export buttons to all 4 pages

---

### Finding 5: Missing Admin Commission Reports (MEDIUM)

**Severity:** Medium
**Impact:** Admin had no system-wide view of commission data. Per-distributor commissions existed but no aggregate view or cross-distributor comparison.

**Resolution:** Added "Commissions" tab to Reports page showing:
- System-wide totals: total earned, total paid, total pending
- Per-distributor breakdown with handover counts
- Date range filtering and CSV export
- Pagination for large distributor networks

**Files created:** `commission-reports.ts` (backend), `commission-overview-report.tsx` (frontend)

---

### Finding 6: Missing Distributor Performance Rankings (MEDIUM)

**Severity:** Medium
**Impact:** Admin could not compare distributor effectiveness or identify top/bottom performers.

**Resolution:** Added "Distributor Performance" tab to Reports page showing:
- Rankings by handovers completed and commissions earned
- Summary cards: total distributors, total handovers, total commissions, average per distributor
- Sortable by handovers or commissions
- Date range filtering and CSV export

**Files created:** `distributor-performance.ts` (backend), `distributor-performance-report.tsx` (frontend)

---

### Finding 7: No Device-Loan-Customer Linkage (MEDIUM)

**Severity:** Medium
**Impact:** Collections team could not trace the full chain: Device → Customer → Loan → Payment → Lock Status. Required checking 3-4 separate pages.

**Resolution:** Added "Device-Loan Chain" tab to Devices Reports page with two sub-views:
- **Collections view:** Overdue devices sorted by DPD with direct "Lock Device" action button
- **Audit trail view:** Full device lifecycle from warehouse to customer
- Search by IMEI, customer name, national ID, loan number
- Filters: lock status, loan status, DPD range
- CSV export

**Files created:** `device-loan-chain.ts` (backend)
**Files modified:** `devices/reports/_client.tsx` (frontend)

---

### Finding 8: No Lock Effectiveness Tracking (MEDIUM)

**Severity:** Medium
**Impact:** No way to measure whether device locks actually drove payment recovery. Business decisions about lock timing made without data.

**Details:** Lock/unlock events were not tracked with timestamps in the database.

**Resolution:**
- Created `device_lock_events` table (migration 056) with: device_id, event_type, triggered_by, created_at
- Updated lock/unlock handlers to log events automatically
- Added "Lock Effectiveness" tab showing:
  - Conversion rates: locks resulting in payment within 48h / 7d / 30d
  - Average hours from lock to payment
  - Monthly trend data
  - Note: Report requires data accumulation period

**Files created:** `056_create_device_lock_events.sql`, `lock-effectiveness.ts` (backend)
**Files modified:** `device-locks.ts` (event logging), `devices/reports/_client.tsx` (frontend)

---

### Finding 9: Date Filtering Inconsistency (MEDIUM)

**Severity:** Medium
**Impact:** Some reports had date filters, others didn't. Dashboard metrics were always "all time" with no way to scope by period.

**Before:**
- Reports page: Single shared date filter applied to all tabs (switching tabs kept same date range — not useful)
- Dashboard: No date filtering at all
- Device reports: No date filtering
- Analytics: No indication of data freshness

**After:**
- Reports page: Each tab has its own independent DateRangeFilter (resets to 30-day default on tab switch)
- Dashboard: Date range filter added, metrics respond to selected period
- Analytics: "Data as of: [date]" indicator showing data warehouse last refresh
- All new report components built with their own date filters

**Files modified:** 5 existing report components (added internal date state), `dashboard.ts` (backend), `_client.tsx` (dashboard frontend), `analytics/_client.tsx`
**Files created:** `data-freshness.ts` (investor-reporting-service)

---

### Finding 10: Missing Export Capabilities (MEDIUM)

**Severity:** Medium
**Impact:** Distributor dashboard only had CSV export on commissions page. No export for inventory, transfers, or handovers.

**Resolution:**
| Page | Export Added |
|------|-------------|
| Distributor Inventory | CSV: IMEI, Brand, Model, Status, Condition, Price, Received Date |
| Distributor Transfers | CSV: Transfer details with status |
| Distributor Handovers | CSV: Date, Customer, Device, Loan ID, IMEI, Amount, Commission |
| Fineract Overdue (Admin) | CSV: Loan ID, Customer, Phone, DPD, Outstanding, Lock Status (with formula-injection protection) |
| All new admin report tabs | CSV export included |

---

### Finding 11: Fineract Loans Page Search Bug (HIGH)

**Severity:** High
**Impact:** Search on the Fineract loans page only filtered the current page of results (client-side filtering after pagination). Users searching for a specific loan would miss it if it wasn't on the displayed page.

**Details:**
- Code used Supabase-style query builder (`db.from().select()`) with client-side filtering (lines 92-103)
- Count query fetched ALL rows just to count them (inefficient)
- Search only worked within the current page of paginated results

**Resolution:**
- Rewrote to raw parameterized SQL using shared `query()` client
- Moved search to SQL WHERE clause — searches across ALL loans
- Replaced inefficient count query with proper `COUNT(*)`
- Added national_id and loan_number to searchable fields

**File modified:** `services/fineract-proxy-service/src/handlers/loans.ts`

---

### Finding 12: Defaults Report Pagination (LOW)

**Severity:** Low
**Impact:** Default loans report capped at 500 rows with no pagination or search. Large portfolios would miss delinquent loans beyond the 500-row limit.

**Resolution:** Added proper `page`/`limit` pagination, search by name/phone/national ID, and national_id in response data.

**File modified:** `services/admin-service/src/handlers/reports.ts` (`handleGetDefaultReport`)

---

## Recommendations for Future Work

### R1: RBZ Regulatory Reporting (Deferred)
Build a dedicated RBZ Compliance tab on the Reports page with:
- Suspicious Transaction Report (STR) candidate flagging
- Monthly Transaction Summary export in RBZ-prescribed format
- Compliance dashboard (KYC rates, transaction limit adherence)
- **Priority:** HIGH once RBZ report format requirements are confirmed

### R2: Commission Payout System
The Commissions tab currently provides tracking/visibility only. Build:
- "Mark as Paid" workflow for manual commission payouts
- Payout reconciliation (calculated vs paid)
- Automated payout integration (EcoCash/bank transfer)
- **Dependency:** Requires payment gateway integration for distributor payouts

### R3: Automated Report Delivery
- Scheduled report generation (daily/weekly/monthly) via SQS
- Email delivery of CSV/PDF reports to stakeholders
- WhatsApp delivery of summary reports to distributors
- **Priority:** MEDIUM — reduces manual report generation workload

### R4: PDF Export Support
- Type definitions exist but PDF generation not implemented
- Add server-side PDF generation for formal reports (investor, regulatory)
- Use a library like `puppeteer` or `pdfkit` in a dedicated Lambda
- **Priority:** LOW — CSV covers most needs

### R5: Advanced Analytics
- Customer segmentation reports (by geography, income band, credit tier)
- Loan product performance comparison
- Seasonal trend analysis
- Predictive default scoring report
- **Priority:** MEDIUM — data warehouse already has the underlying tables

### R6: Distributor Dashboard Enhancements
- Monthly earnings chart (was removed during server-side filtering migration — restore with paginated server-side aggregation endpoint)
- Performance benchmarking against peer distributors
- Commission projection calculator
- **Priority:** LOW

### R7: Real-time Dashboards
- Replace polling with WebSocket for live dashboard updates
- Real-time payment status notifications
- Live lock/unlock event feed
- **Priority:** LOW — current 30-second polling is adequate

---

## Implementation Summary

### Files Created (11 new)
| File | Purpose |
|------|---------|
| `database/migrations/056_create_device_lock_events.sql` | Lock event tracking table |
| `services/admin-service/src/handlers/global-search.ts` | Cross-entity search endpoint |
| `services/admin-service/src/handlers/commission-reports.ts` | Commission overview endpoint |
| `services/admin-service/src/handlers/distributor-performance.ts` | Distributor rankings endpoint |
| `services/admin-service/src/handlers/device-loan-chain.ts` | Device-loan chain endpoint |
| `services/admin-service/src/handlers/lock-effectiveness.ts` | Lock effectiveness endpoint |
| `services/investor-reporting-service/src/handlers/data-freshness.ts` | Data warehouse freshness endpoint |
| `frontend/apps/admin-portal/src/components/layout/global-search.tsx` | Ctrl+K search modal |
| `frontend/apps/admin-portal/src/components/reports/commission-overview-report.tsx` | Commission tab component |
| `frontend/apps/admin-portal/src/components/reports/distributor-performance-report.tsx` | Performance tab component |
| `frontend/apps/admin-portal/src/lib/api/search.ts` | Search API client |

### Files Modified (45+)
**Backend Services:**
- `services/admin-service/src/handlers/customers.ts` — National ID search
- `services/admin-service/src/handlers/payments.ts` — National ID search
- `services/admin-service/src/handlers/inventory-devices.ts` — National ID search
- `services/admin-service/src/handlers/reports.ts` — Defaults pagination + search
- `services/admin-service/src/handlers/dashboard.ts` — Date filtering
- `services/admin-service/src/handlers/device-locks.ts` — Event logging
- `services/admin-service/src/index.ts` — 6 new routes
- `services/fineract-proxy-service/src/handlers/loans.ts` — SQL rewrite + search
- `services/distributor-service/src/handlers/commissions.ts` — Search + pagination
- `services/distributor-service/src/handlers/transfers.ts` — Search
- `services/distributor-service/src/handlers/handovers.ts` — Search + pagination
- `services/investor-reporting-service/src/index.ts` — Data freshness route
- `template.yaml` — API Gateway events for new endpoints

**Admin Portal Frontend:**
- `reports/_client.tsx` — Removed 3 duplicate sections, added 2 new tabs
- `customers/_client.tsx` — National ID column + search
- `payments/_client.tsx` — Search placeholder
- `devices/reports/_client.tsx` — 2 new tabs (Device-Loan Chain, Lock Effectiveness)
- `header.tsx` — Global search integration
- `overdue-loans-page.tsx` — Search + CSV export
- `fineract-loans-page.tsx` — Search placeholder
- `analytics/_client.tsx` — Data freshness indicator
- `_client.tsx` (dashboard) — Date filter integration
- 5 report components — Per-tab date filters
- API/hook files — New endpoints + params

**Distributor Dashboard Frontend:**
- `commissions/_client.tsx` — Search + server-side filtering + pagination
- `transfers/_client.tsx` — Search + pagination + CSV export
- `handovers/_client.tsx` — Search + pagination + CSV export
- `inventory/_client.tsx` — CSV export
- `_client.tsx` (dashboard) — API compatibility
- API files — Updated function signatures for search/pagination

### New API Endpoints (6)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/search` | Global cross-entity search |
| GET | `/api/v1/reports/commissions/overview` | System-wide commission data |
| GET | `/api/v1/reports/distributor-performance/rankings` | Distributor rankings |
| GET | `/api/v1/reports/device-loan-chain` | Device-customer-loan chain |
| GET | `/api/v1/reports/lock-effectiveness` | Lock-to-payment correlation |
| GET | `/api/v1/investor/data-freshness` | Data warehouse last refresh |

---

## Security Considerations

- All new endpoints require JWT authentication via Cognito + `isAdminOrManager` authorization
- All database queries use parameterized SQL ($1, $2...) — no string concatenation
- National ID search normalizes input server-side (strips dashes/spaces)
- CSV exports include formula-injection protection on admin portal (cells starting with `=`, `+`, `-`, `@` prefixed with `'`)
- Global search minimum query length (2 chars) prevents excessive database load
- Search results capped at 5 per entity type to limit response size

---

## Testing Notes

- Distributor dashboard tests updated to match new API response shapes (`{ data, total }`)
- All existing test suites should continue passing with updated assertions
- New endpoints should be tested with integration tests covering:
  - National ID search (both formatted and unformatted input)
  - Global search across all entity types
  - Pagination edge cases (page 0, negative, beyond total)
  - Date range filtering boundaries
  - Authorization (non-admin users should get 403)
  - Empty result sets
