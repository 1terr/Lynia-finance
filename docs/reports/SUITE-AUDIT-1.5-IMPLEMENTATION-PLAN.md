# Suite Audit 1.5 — Implementation Plan

> **Date:** 2026-03-21
> **Based on:** [SUITE-AUDIT-1.5-INVENTORY-SYSTEM.md](SUITE-AUDIT-1.5-INVENTORY-SYSTEM.md)
> **Timeline:** 7 phases over ~10 weeks
> **Next migration:** 054 (latest existing: 053)
> **Mode:** Full fix — mechanical AND architectural

---

## Bugs Found During Deep-Dive (Fix Immediately)

### BUG 1: Commission Calculator Column Name Mismatches (CRITICAL)
**File:** `services/lock-service/src/handover/commission-calculator.ts`

- **Line 25-30** — `.select('principal')` → column doesn't exist, should be `loan_amount_usd`
- **Line 37-42** — `.select('retail_price, model')` → column is `retail_price_usd`
- **Line 56-57** — `loan.principal` → undefined, should be `loan.loan_amount_usd`

**Impact:** Every handover calculates commission as `NaN` or `0`. Distributors not credited.

### BUG 2: SQL Interpolation in device-models.ts (Security)
**File:** `services/admin-service/src/handlers/device-models.ts` — Line 30

Direct interpolation: `` whereClause += ` AND is_active = ${isActive}` ``
Fix: parameterize with `$${params.length}`

### BUG 3: No Transaction in completeHandover (Data Integrity)
**File:** `services/lock-service/src/handover/handover-workflow.ts` — Lines 107-178

Six sequential table updates (loans, devices, agent_inventory, distributor_commissions, device_handovers, device_locks) with NO transaction.

### BUG 4: Offline Queue Retries Infinitely
**File:** `frontend/apps/distributor-dashboard/src/lib/hooks/use-offline-queue.ts` — Lines 56-74

No max retry limit. Fix: add `MAX_RETRIES = 5`.

### BUG 5: Mock Data Can Leak to Production
**File:** `frontend/apps/distributor-dashboard/src/test/mocks/utils.ts` — Lines 1-14

`useMock()` returns true when Cognito not configured. Fix: guard with `NODE_ENV === 'production'`.

---

## Phase 1: Critical Bug Fixes & Production Verification (Week 1)

### 1.1 Fix Commission Calculator
**File:** `services/lock-service/src/handover/commission-calculator.ts` — Lines 25-30, 37-42, 56-57

### 1.2 Fix SQL Interpolation
**File:** `services/admin-service/src/handlers/device-models.ts` — Line 30

### 1.3 Fix Mock Data Gate
**File:** `frontend/apps/distributor-dashboard/src/test/mocks/utils.ts`

### 1.4 Verify Database Triggers in Production RDS
```sql
SELECT tgname, tgrelid::regclass, tgenabled FROM pg_trigger WHERE tgrelid = 'devices'::regclass;
SELECT proname FROM pg_proc WHERE proname IN ('fn_sync_device_model_stock', 'fn_record_inventory_movement');
```

### 1.5 Verify Fineract ECS Service
Check stack status, ECS health, GL accounts, loan product IDs.

### 1.6 Verify All 12 Inventory Tables

**Acceptance:** All bugs fixed. Triggers confirmed. Fineract healthy.

---

## Phase 2: Data Model Consolidation — agent_inventory → devices (Week 2-3)

### 2.1 New Migration: `054_consolidate_inventory.sql`
```sql
ALTER TABLE devices ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES distributors(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS assigned_to_distributor_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_devices_distributor ON devices(distributor_id) WHERE distributor_id IS NOT NULL;
-- Backfill from agent_inventory
UPDATE devices d SET distributor_id = ai.distributor_id, assigned_to_distributor_at = ai.assigned_date
FROM agent_inventory ai WHERE ai.device_id = d.id AND ai.status IN ('available', 'sold');
```

### 2.2 Code Changes (6 files)

| File | Lines | Change |
|------|-------|--------|
| `services/distributor-service/src/handlers/inventory.ts` | 19-42 | `JOIN agent_inventory` → `WHERE d.distributor_id = $1` |
| `services/distributor-service/src/handlers/handovers.ts` | 206-214 | `JOIN agent_inventory` in verify → `WHERE d.distributor_id = $2` |
| `services/admin-service/src/handlers/inventory-transfers.ts` | 146-153, 232-239 | `agent_inventory INSERT` → `devices UPDATE distributor_id` |
| `services/lock-service/src/handover/handover-workflow.ts` | 132-142 | Delete `agent_inventory` update |
| `services/distributor-service/src/handlers/notifications.ts` | 40-54 | Replace `agent_inventory` query |
| All test files | Various | Update mocks |

### 2.3 Backward Compatibility Trigger
Temporary `trg_sync_agent_inventory` — remove after 2 weeks.

---

## Phase 3: Bulk API Implementation (Week 3-4)

### 3.1 Optimize Bulk Import
**File:** `services/admin-service/src/handlers/inventory-devices.ts` — Lines 153-245
Batch `WHERE imei = ANY($1)` + `INSERT ... ON CONFLICT DO NOTHING`. Target: 500 devices < 10s.

### 3.2 New: `POST /admin/inventory/transfers/bulk`
`{ device_ids[], to_distributor_id, auto_approve? }` → `{ transferred, skipped, errors }`

### 3.3 New: `POST /admin/inventory/adjustments/bulk`
`{ device_ids[], adjustment_type, reason }` → `{ created, adjustment_ids }`

### 3.4 New: `POST /admin/inventory/allocate`
New file: `inventory-allocations.ts`. Shortcut for warehouse → distributor.

### 3.5 Register Routes
`services/admin-service/src/index.ts` after line 167. No template.yaml changes needed.

---

## Phase 4: Handover Robustness (Week 4-5)

### 4.1 Transaction Wrap for completeHandover
Lines 66-237: `BEGIN/COMMIT/ROLLBACK`. Fineract disbursement after COMMIT.

### 4.2 Product-Model Validation
Add `product_device_models` check to `handleVerifyDevice` (line 214).

### 4.3 Manual Deposit Confirmation
New: `POST /admin/payments/:id/confirm`

### 4.4 Offline Queue Max Retries
Lines 56-74: MAX_RETRIES = 5, failed items to `lynia-failed-submissions`.

### 4.5 Photo Upload
New: `POST /api/v1/distributor/handovers/upload-photo` — S3 presigned URL.

---

## Phase 5: Catalogue, CSV, Movement Visibility (Week 5-7)

### 5.1 Multi-Product Catalogue Test
2 products with overlapping device models.

### 5.2 CSV Export
New: `GET /admin/reports/inventory/export` — Full CSV for physical audit.

### 5.3 Distributor Movement History
New: `GET /api/v1/distributor/devices/:id/movements`

### 5.4 Reservation Expiry Lambda
New file + template.yaml `ReservationExpiryFunction` with `rate(1 hour)`.

---

## Phase 6: Code Quality & Security (Week 7-9)

### 6.1 maskImei Utility
`services/shared/utils/logger.ts`: `1234*******2345`

### 6.2 PII Fix
Mask IMEI in `inventory-devices.ts` audit logs (lines 143-146).

### 6.3 Error Codes
`DEV_DUP_001`, `DEV_IMPORT_001`, `DEV_404_001`, `INV_TRANSFER_001/002`, `INV_ADJ_001`, `INV_HANDOVER_001/002/003/004`, `AUTH_PERM_001`. Add `requestId`.

### 6.4 Transaction for handleUpdateTransfer
Lines 217-240: wrap "received" transition.

### 6.5 Reconciliation Endpoint
New: `POST /admin/inventory/reconcile` — tracked vs actual stock comparison.

---

## Phase 7: Tests & Launch Readiness (Week 9-12)

### 7.1 Integration Tests (10 scenarios)
1. Full lifecycle: create → allocate → reserve → handover → sold
2. Bulk import 500 devices (performance + correctness)
3. Concurrent handover (FOR UPDATE lock)
4. Catalogue filtering (2 products)
5. Reservation expiry
6. Reconciliation
7. Commission calculation accuracy
8. Bulk transfer 100 devices
9. Adjustment maker-checker
10. Wrong device model rejection

### 7.2 Performance Targets
| Test | Target |
|------|--------|
| Bulk import 500 | < 10s |
| Report 10K devices | < 5s |
| 10 concurrent handovers | 0 corruption |
| Movement history 100+ | < 1s |

### 7.3 Recommended SLAs
| Operation | Target |
|-----------|--------|
| Device registration | < 500ms p95 |
| Bulk import (500) | < 15s p95 |
| Inventory report | < 3s p95 |
| Handover completion | < 2s p95 |
| Reservation expiry | < 5 min latency |
| Reconciliation | Daily midnight |
| Uptime | 99.9% (6AM-10PM CAT) |
| Data integrity | Zero divergence |

### 7.4 Stock Alerts
CloudWatch: below reorder level, aging > 90 days, import error > 10%.

---

## Phase Dependencies
```
Phase 1 (Bugs)          ← Immediate
   ↓
Phase 2 (Consolidation) ← Depends on 1
   ↓
Phase 3 (Bulk) ←──┐     ← Depends on 2
Phase 4 (Handover) ┘    ← Parallel with 3
   ↓
Phase 5 (Catalogue) ┐   ← Depends on 2
Phase 6 (Quality)   ┘   ← Parallel with 5
   ↓
Phase 7 (Tests/SLAs)    ← All above
```
**~10 weeks critical path.**

---

## ~30 Files

| Phase | Key Files |
|-------|-----------|
| 1 | `commission-calculator.ts`, `device-models.ts`, `mocks/utils.ts` |
| 2 | `054_consolidate_inventory.sql`, `inventory.ts`, `handovers.ts`, `inventory-transfers.ts`, `handover-workflow.ts`, `notifications.ts` |
| 3 | `inventory-devices.ts`, `inventory-transfers.ts`, `inventory-adjustments.ts`, `inventory-allocations.ts` (new), `index.ts` |
| 4 | `handover-workflow.ts`, `handovers.ts`, `payments.ts`, `use-offline-queue.ts` |
| 5 | `inventory-reports.ts`, `inventory.ts`, `reservation-expiry.ts` (new), `template.yaml` |
| 6 | `logger.ts`, `inventory-devices.ts`, all handlers, `inventory-reports.ts` |
| 7 | `inventory-audit-readiness.test.ts` (new) |
