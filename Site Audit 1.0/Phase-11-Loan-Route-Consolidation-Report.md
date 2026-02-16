# Phase 11: Loan Route Consolidation Report

**Date:** 2026-02-16
**Commit:** `8412cc8` on `master`
**Scope:** Admin Portal frontend route deduplication
**Impact:** 10 files changed, 39 additions, 1,005 deletions

---

## Executive Summary

The admin portal had two separate sidebar entries for loan management: **"Loans"** (`/loans/`) and **"Fineract"** (`/fineract/loans/`). An architectural audit revealed that the original `/loans/` routes were calling `/api/v1/loans/*` endpoints that had **no deployed Lambda handler** in the SAM template, making all three pages non-functional (returning 404 errors). Meanwhile, the Fineract-backed routes at `/fineract/` were fully operational with authoritative data from the Fineract core banking engine.

This phase eliminated the duplication by consolidating all loan management under the Fineract-backed routes, removing 966 lines of dead code, and unifying the sidebar navigation into a single "Loans" entry.

---

## Problem Statement

### Duplication Identified

| Function | `/loans/` Route (Dead) | `/fineract/` Route (Live) |
|---|---|---|
| Loan portfolio list | `/loans` -- no backend, 404 | `/fineract/loans` -- Fineract authoritative balances |
| Pending approval queue | `/loans/pending-approval` -- no backend, 404 | `/fineract/approval` -- Fineract state machine |
| Loan detail view | `/loans/[id]` -- no backend, 404 | `/loans/[id]/fineract` -- live schedule + transactions |
| Approve/Reject actions | `POST /api/v1/loans/:id/approve` -- unhandled | `POST /api/v1/fineract/loans/:id/approve` -- GL entries |

### Pages Only in Fineract (No Equivalent in Old Route)

| Page | Route | Purpose |
|---|---|---|
| Loan Products | `/fineract/products` | Product catalog (3 tiers, rates, terms) |
| Overdue & Aging | `/fineract/overdue` | Aging bucket analysis (1-30, 31-60, 61-90, 90+ days) |
| GL Accounting | `/fineract/accounting` | Journal entries, trial balance (RBZ compliance) |
| Reconciliation | `/fineract/reconciliation` | Lynia vs Fineract balance discrepancy detection |

### Root Cause

The `/api/v1/loans/*` endpoints were never registered as API Gateway routes in `template.yaml`. The `loans.ts` frontend API client called these endpoints, but no Lambda function handled them. Only the `/api/v1/fineract/*` routes (served by `FineractProxyFunction`) were deployed. The old pages were dead UI since the Fineract integration went live in Phase 6-7.

### Risks of the Old State

1. **Data inconsistency** -- If the old approve/reject actions had worked, they would have updated only the Lynia DB without transitioning Fineract's state machine or creating GL journal entries
2. **User confusion** -- Staff saw two sidebar entries ("Loans" and "Fineract") for the same domain with no guidance on which to use
3. **Maintenance burden** -- Two API clients, two sets of page components, two React Query cache key families for the same data
4. **Stale data** -- The old pages read from `loans.outstanding_balance_usd` (cached, can drift) while Fineract provides authoritative real-time balances

---

## Deliverables

### 1. Sidebar Navigation Consolidation

**File:** `frontend/admin-portal/src/components/layout/sidebar.tsx`

- Merged "Loans" (`/loans`) and "Fineract" (`/fineract/loans`) into a single **"Loans"** entry pointing to `/fineract/loans`
- Removed the "Fineract" nav item -- "Fineract" is an implementation detail staff don't need to see
- Kept the `CreditCard` icon (more intuitive for "Loans" than the `Landmark` icon)
- Removed unused `Landmark` icon import

**Before:**
```
Sidebar:
  Loans      → /loans           (CreditCard icon)
  Fineract   → /fineract/loans  (Landmark icon)
```

**After:**
```
Sidebar:
  Loans      → /fineract/loans  (CreditCard icon)
```

### 2. Repayment Progress Bar Ported

**File:** `frontend/admin-portal/src/components/fineract/fineract-loan-detail-page.tsx`

Ported the visual repayment progress bar from the old loan detail page to the Fineract loan detail page. Placed between the balance summary cards and the loan details grid.

- Displays percentage complete, amount paid, total expected, and remaining balance
- Uses `loan.totalRepayment` / `loan.totalExpectedRepayment` from Fineract (authoritative)
- Only renders when `totalExpectedRepayment > 0` (avoids division by zero for pending loans)
- Capped at 100% width to handle overpayment edge cases

### 3. Old Route Redirects

All old `/loans/` routes now redirect to their Fineract equivalents:

| Old Route | Redirect Target | File |
|---|---|---|
| `/loans` | `/fineract/loans` | `loans/page.tsx` |
| `/loans/pending-approval` | `/fineract/approval` | `loans/pending-approval/page.tsx` |
| `/loans/[id]` | `/loans/[id]/fineract` | `loans/[id]/page.tsx` |

Uses Next.js `redirect()` from `next/navigation` (server-side 307 redirect). The `[id]` route retains `generateStaticParams()` for `output: export` compatibility.

### 4. Dead Code Removed

| File | Lines | Description |
|---|---|---|
| `loans/_client.tsx` | 174 | Old loan portfolio list page component |
| `loans/[id]/_client.tsx` | 382 | Old loan detail page component with approve/reject modals |
| `loans/pending-approval/_client.tsx` | 281 | Old pending approval queue component |
| `loans/pending-approval/__tests__/pending-approval-page.test.tsx` | 61 | Tests for the deleted pending approval page |
| `src/lib/api/loans.ts` | 86 | API client with 7 functions calling non-existent endpoints |
| **Total removed** | **984** | |

### 5. Files Preserved (No Changes)

| File/Directory | Reason |
|---|---|
| `loans/[id]/fineract/` route | This IS the live Fineract detail page -- kept as-is |
| `src/app/(dashboard)/fineract/` | All 6 Fineract sub-pages remain operational |
| `src/lib/api/fineract.ts` | The live API client (14 functions, 271 lines) |
| `src/components/fineract/` | All 9 Fineract page components |
| `template.yaml` | No changes needed -- old routes were never registered |
| All backend Lambda services | Direct DB queries unaffected by frontend route changes |

---

## Verification Results

| Check | Result |
|---|---|
| `pnpm build` (Next.js) | Compiled successfully, all 30 pages generated |
| Dead import scan (`grep "api/loans"`) | Zero remaining imports |
| Sidebar rendering | Single "Loans" entry, navigates to `/fineract/loans` |
| `/loans` redirect | 307 to `/fineract/loans` |
| `/loans/pending-approval` redirect | 307 to `/fineract/approval` |
| `/loans/[id]` redirect | 307 to `/loans/[id]/fineract` |
| Fineract pages functional | All 6 sub-pages unaffected |
| Progress bar | Renders on Fineract loan detail when `totalExpectedRepayment > 0` |

---

## Backend Consumer Map (Reference)

While the frontend consolidation is complete, backend services still query the `loans` PostgreSQL table directly. This map documents the current state for future consolidation work.

### Frontend Consumers (Now Resolved)

| Consumer | Old Endpoint | Status |
|---|---|---|
| `loans/_client.tsx` | `GET /api/v1/loans` | Deleted, redirected |
| `loans/[id]/_client.tsx` | `GET /api/v1/loans/{id}` | Deleted, redirected |
| `loans/pending-approval/_client.tsx` | `GET /api/v1/loans/pending` | Deleted, redirected |
| `getLoanStats()` | `GET /api/v1/loans/stats` | Deleted (was never imported anywhere) |

### Backend Direct DB Consumers (Unchanged)

| Service | Files | Operations | Fineract Readiness |
|---|---|---|---|
| **WhatsApp** | `loan-commands.ts` | READ balance/schedule | Already uses Fineract as fallback when `fineract_loan_id` set |
| **Scoring** | `index.ts`, `ml-pipeline.ts`, `alternative-data.ts` | READ + Fineract sync trigger | Sync calls `fineract-sync.ts` on approval |
| **Payment** | `payment-service.ts`, `write-off-service.ts`, `reschedule-service.ts`, `penalty-service.ts`, `restructuring-service.ts` | READ + WRITE (raw SQL) | Partially syncs outbound to Fineract |
| **Lock** | `lock-management-service.ts`, `handover-service.ts`, `repossession-service.ts` | READ + WRITE | No Fineract integration yet |
| **Notification** | `reminder-scheduler.ts` | READ (`next_payment_date`) | No Fineract integration yet |
| **Shared** | `fineract-rbz-reporting.ts`, `fineract-sync.ts` | READ (6 SQL queries) + WRITE (sync-back) | Core sync infrastructure |

---

## Future Recommendations

### P1 -- Near-Term: Flip WhatsApp to Fineract-Primary

**Effort:** Low | **Risk:** Low | **Impact:** Data accuracy for customer-facing messages

The WhatsApp service (`services/whatsapp-service/src/loan-commands.ts`) already has dual-source logic: it queries the Lynia DB first, then falls back to Fineract when `fineract_loan_id` is set and `FINERACT_SECRET_NAME` is configured.

**Recommendation:** Invert the priority -- make Fineract the primary source and Lynia DB the fallback:
- `handleBalance()` -- call `getFineractLoanBalance()` first, fall back to `loans.outstanding_balance_usd`
- `handleSchedule()` -- call `getFineractRepaymentSchedule()` first, fall back to computed schedule

**Why:** Customers receive balance and schedule information via WhatsApp. Using Fineract as primary ensures they see the same authoritative figures displayed in the admin portal.

### P2 -- Medium-Term: Route Payment Writes Through Fineract

**Effort:** Medium | **Risk:** Medium | **Impact:** GL audit trail for all transactions

Currently, the payment service updates `loans.outstanding_balance_usd` and `loans.status` via raw SQL, then asynchronously syncs to Fineract. This creates a window where Lynia DB and Fineract can diverge (the reconciliation job catches this every 6 hours).

**Recommendation:** Reverse the write path:
1. `payment-service.ts` -- call `syncRepaymentToFineract()` as the primary operation
2. On Fineract success, update Lynia DB as a cache/mirror
3. `handover-service.ts` -- call Fineract disburse API on handover completion instead of raw SQL status update

**Why:** Every financial mutation creates GL journal entries in Fineract automatically. Routing writes through Fineract first ensures the audit trail is complete for RBZ compliance without relying on async sync.

### P3 -- Medium-Term: Lock/Notification Service Fineract Integration

**Effort:** Medium | **Risk:** Low | **Impact:** Unified data source across all services

The lock service reads `loans.days_past_due` and `loans.status` to trigger device locks. The notification service reads `loans.next_payment_date` for payment reminders. Neither service consults Fineract.

**Recommendation:**
- Lock service: Query Fineract overdue data (already surfaced at `/api/v1/fineract/loans/overdue`) instead of relying on cached `days_past_due`
- Notification service: Query Fineract repayment schedule for accurate next-payment dates

### P4 -- Long-Term: Lynia `loans` Table as Read Cache

**Effort:** High | **Risk:** High | **Impact:** Single source of truth architecture

**Target state:** The `loans` table in Lynia PostgreSQL becomes a materialized read cache, populated from Fineract events. All financial mutations flow through Fineract first. The Lynia DB stores only operational data that Fineract doesn't own (device IMEI, WhatsApp session state, KYC references).

**Prerequisites:**
- P2 complete (all writes go through Fineract)
- P3 complete (all reads prefer Fineract)
- Fineract webhook/event system for real-time cache invalidation
- Comprehensive reconciliation coverage (currently 6-hour schedule)

### P5 -- URL Structure Cleanup (Optional)

The Fineract pages currently live under `/fineract/*` URL paths (e.g., `/fineract/loans`, `/fineract/approval`). Since the sidebar now labels this section simply "Loans", the URL prefix `fineract` is a leaked implementation detail.

**Optional future cleanup:**
- Rename `/fineract/loans` to `/loans` (requires updating the redirect chain)
- Rename `/fineract/approval` to `/loans/approval`
- Rename `/fineract/accounting` to `/loans/accounting`
- This is cosmetic and low priority

---

## Appendix: Commit Details

```
Commit:   8412cc8
Branch:   master
Author:   Co-Authored-By: Claude Opus 4.6
Date:     2026-02-16
Message:  refactor: consolidate /loans/ and /fineract/loans/ into single route

Files:
  D  frontend/admin-portal/src/app/(dashboard)/loans/[id]/_client.tsx
  M  frontend/admin-portal/src/app/(dashboard)/loans/[id]/page.tsx
  D  frontend/admin-portal/src/app/(dashboard)/loans/_client.tsx
  M  frontend/admin-portal/src/app/(dashboard)/loans/page.tsx
  D  frontend/admin-portal/src/app/(dashboard)/loans/pending-approval/__tests__/pending-approval-page.test.tsx
  D  frontend/admin-portal/src/app/(dashboard)/loans/pending-approval/_client.tsx
  M  frontend/admin-portal/src/app/(dashboard)/loans/pending-approval/page.tsx
  M  frontend/admin-portal/src/components/fineract/fineract-loan-detail-page.tsx
  M  frontend/admin-portal/src/components/layout/sidebar.tsx
  D  frontend/admin-portal/src/lib/api/loans.ts

Stats: 39 insertions(+), 1,005 deletions(-)
```
