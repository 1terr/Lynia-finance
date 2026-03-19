# Fineract-First Loan Product Creation — Implementation Report

**Date:** 2026-03-19
**Status:** Deployed to Production
**Branch:** master

---

## 1. Summary

Refactored the loan product creation flow from "Lynia-first" (save locally, async-sync to Fineract with hardcoded defaults) to "Fineract-first" (create in Fineract synchronously with full parameters, then save to Lynia DB).

### Problem

- Admin form captured only simplified Lynia-specific fields
- Fineract sync was async via SQS, with many parameters **hardcoded** (accountingRule=1, auto-generated shortName, calculated principal average, no GL account mappings)
- Products could exist in Lynia DB without ever reaching Fineract (orphaned records)
- Admins had no control over critical Fineract financial parameters (amortization type, interest calculation method, accounting rules, GL mappings)

### Solution

- New 3-step wizard captures **all** Fineract loan product parameters
- Product is created in Fineract **synchronously** — if Fineract fails, product is NOT saved
- All Fineract parameters stored explicitly in Lynia DB (27 new columns)
- GL account dropdowns populated live from Fineract API

---

## 2. Commits

### Commit 1: Feature Implementation
```
SHA:     93c61720
Message: feat: Fineract-first loan product creation with full parameter wizard
Files:   12 changed, 1602 insertions(+), 160 deletions(-)
```

### Commit 2: Test Fixes
```
SHA:     eeb2a39c
Message: test: update product management tests for Fineract-first flow
Files:   1 changed, 55 insertions(+), 7 deletions(-)
```

---

## 3. Files Changed

### Database (1 file created)

| File | Action | Description |
|------|--------|-------------|
| `database/migrations/038_fineract_product_params.sql` | **Created** | Adds 27 columns to `loan_products` for Fineract parameters and GL account mappings |

### Backend — Services (4 files modified)

| File | Action | Description |
|------|--------|-------------|
| `services/admin-service/src/handlers/products.ts` | **Major refactor** | Fineract-first create/update handlers + 2 new endpoints |
| `services/admin-service/src/index.ts` | **Modified** | Added routes for `fineract-defaults` and `gl-accounts` |
| `services/shared/clients/fineract/loan-client.ts` | **Modified** | Added `updateLoanProduct()` method |
| `services/shared/clients/fineract-sync/sync-product.ts` | **Modified** | Simplified to read DB columns instead of hardcoding |

### Frontend (6 files — 4 created, 2 modified)

| File | Action | Description |
|------|--------|-------------|
| `frontend/apps/admin-portal/src/components/products/product-wizard.tsx` | **Created** | 3-step wizard (Basic Info → Loan Terms → Accounting) |
| `frontend/apps/admin-portal/src/app/(dashboard)/products/new/page.tsx` | **Created** | New product creation page route |
| `frontend/apps/admin-portal/src/app/(dashboard)/products/[id]/edit/page.tsx` | **Created** | Product edit page route |
| `frontend/apps/admin-portal/src/hooks/use-gl-accounts.ts` | **Created** | React Query hook for Fineract GL accounts |
| `frontend/apps/admin-portal/src/types/index.ts` | **Modified** | Expanded `LoanProduct`, `CreateProductInput` + added GL/enum types |
| `frontend/apps/admin-portal/src/lib/api/products.ts` | **Modified** | Added `getProductFineractDefaults()` and `getGLAccounts()` |
| `frontend/apps/admin-portal/src/app/(dashboard)/products/_client.tsx` | **Modified** | Replaced modal form with navigation to wizard pages |

### Tests (1 file modified)

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/admin/product-management.test.ts` | **Modified** | Updated mocks for Fineract-first flow, added required fields |

---

## 4. Database Migration — 038_fineract_product_params.sql

### New Columns Added to `loan_products`

**Core Fineract Parameters (16 columns):**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `short_name` | VARCHAR(4) | — | Fineract 4-char unique identifier |
| `currency_code` | VARCHAR(3) | 'USD' | ISO 4217 currency code |
| `digits_after_decimal` | INTEGER | 2 | Decimal precision |
| `in_multiples_of` | INTEGER | 1 | Rounding multiples |
| `default_principal` | DECIMAL(10,2) | — | Default loan amount |
| `number_of_repayments` | INTEGER | — | Default repayment count |
| `repayment_every` | INTEGER | 1 | Repayment interval |
| `repayment_frequency_type` | INTEGER | 2 | 0=days, 1=weeks, 2=months, 3=years |
| `amortization_type` | INTEGER | 0 | 0=equal installments, 1=equal principal |
| `interest_type` | INTEGER | 0 | 0=declining balance, 1=flat |
| `interest_calculation_period_type` | INTEGER | 1 | 0=daily, 1=same as repayment |
| `interest_rate_frequency_type` | INTEGER | 2 | 2=per month, 3=per year |
| `transaction_processing_strategy` | VARCHAR(100) | 'mifos-standard-strategy' | Fineract repayment strategy |
| `accounting_rule` | INTEGER | 3 | 1=none, 2=cash, 3=accrual, 4=upfront |
| `min_interest_rate` | DECIMAL(5,2) | — | Min allowed interest rate |
| `max_interest_rate` | DECIMAL(5,2) | — | Max allowed interest rate |

**GL Account Mapping IDs (11 columns, all INTEGER nullable):**

| Column | GL Account Type |
|--------|----------------|
| `fund_source_account_id` | Asset — Cash and Bank |
| `loan_portfolio_account_id` | Asset — Loan Portfolio |
| `transfers_in_suspense_account_id` | Liability — Transfers in Suspense |
| `interest_on_loan_account_id` | Income — Interest Income |
| `income_from_fee_account_id` | Income — Fee Income |
| `income_from_penalty_account_id` | Income — Penalty Income |
| `write_off_account_id` | Expense — Loan Write-Off |
| `overpayment_liability_account_id` | Liability — Overpayment |
| `receivable_interest_account_id` | Asset — Interest Receivable (accrual) |
| `receivable_fee_account_id` | Asset — Fee Receivable (accrual) |
| `receivable_penalty_account_id` | Asset — Penalty Receivable (accrual) |

### Backfill Logic

```sql
-- default_principal = midpoint of min/max amounts
UPDATE loan_products SET default_principal = ROUND((COALESCE(min_amount_usd, 50) + COALESCE(max_amount_usd, 500)) / 2, 2) WHERE default_principal IS NULL;

-- number_of_repayments from existing term fields
UPDATE loan_products SET number_of_repayments = COALESCE(max_term_months, loan_term_months, 12) WHERE number_of_repayments IS NULL;

-- short_name from first 4 chars of product_code
UPDATE loan_products SET short_name = UPPER(LEFT(REGEXP_REPLACE(product_code, '[^A-Za-z0-9]', '', 'g'), 4)) WHERE short_name IS NULL AND product_code IS NOT NULL;
```

### Index Added

```sql
CREATE UNIQUE INDEX idx_loan_products_short_name ON loan_products(short_name) WHERE deleted_at IS NULL AND short_name IS NOT NULL;
```

---

## 5. Backend Changes

### handleCreateProduct — Fineract-First Flow

**Before:** Save to Lynia DB → Queue SQS for async Fineract sync (hardcoded defaults)

**After:**
1. Validate all fields including new Fineract params (`short_name`, `accounting_rule`, GL accounts)
2. GL accounts **required** when `accounting_rule > 1`; receivable accounts required when `>= 3` (accrual)
3. Build `FineractLoanProductCreateRequest` **directly** from request body (no guessing)
4. Call `fineract.createLoanProduct()` **synchronously**
5. On success → insert to Lynia DB with `fineract_product_id`
6. On failure → return error, **do NOT save** to DB
7. Orphan recovery: if Fineract returns duplicate, find and link existing product
8. **Removed:** SQS async sync queueing

### handleUpdateProduct — Fineract-First Flow

**Before:** Update Lynia DB → Queue SQS for async Fineract sync

**After:**
1. Fetch existing product from DB first
2. If product has `fineract_product_id`, build Fineract update payload and call `fineract.updateLoanProduct()` **first**
3. If Fineract update fails → return error, do NOT update Lynia DB
4. On Fineract success (or no Fineract link) → update Lynia DB
5. **Removed:** SQS async sync queueing

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/products/fineract-defaults` | Returns default form values (accounting_rule=3, GL account IDs from Fineract) |
| GET | `/admin/products/gl-accounts` | Proxies Fineract GL accounts, grouped by type (asset/liability/income/expense) |

### Sync Module Simplification

**File:** `services/shared/clients/fineract-sync/sync-product.ts`

**Before:** Hardcoded Fineract params at lines 167-193 (accountingRule=1, auto-generated shortName, principal=avg(min,max), etc.)

**After:** Reads all params from DB columns added by migration 038. Falls back to old derivation logic only for legacy products that predate the migration.

### Fineract Client Addition

**File:** `services/shared/clients/fineract/loan-client.ts`

Added:
```typescript
async updateLoanProduct(productId: number, product: Partial<FineractLoanProductCreateRequest>): Promise<FineractCommandResponse>
```

---

## 6. Frontend Changes

### Product Wizard — `product-wizard.tsx`

Replaces the old `product-form.tsx` modal with a full-page 3-step wizard:

**Step 1 — Basic Information:**
- Product Name (auto-prefixed "Lynia - " for Fineract)
- Short Name (4 chars, Fineract `shortName`)
- Product Code (Lynia-specific)
- Category (smartphone / digital)
- Status (active / inactive / launching_soon)
- Currency (USD / ZWL / ZAR)
- Description

**Step 2 — Loan Terms:**
- Default/Min/Max Principal
- Default/Min/Max Repayments
- Repayment Every + Frequency Type
- Interest Rate Per Period + Min/Max + Frequency Type
- Amortization Type (Equal Installments / Equal Principal)
- Interest Type (Declining Balance / Flat)
- Interest Calculation Period (Daily / Same as Repayment)
- Transaction Processing Strategy (6 options)
- Lynia-specific: Deposit %, Disbursement Methods, Max Active Loans

**Step 3 — Accounting & Review:**
- Accounting Rule (None / Cash / Accrual / Upfront Accrual)
- 11 GL Account mapping dropdowns (conditional, filtered by account type)
- Summary review table of all values
- Submit: "Create in Fineract & Save"

### New Pages

| Path | Description |
|------|-------------|
| `/products/new` | Full-page wizard for creating new products |
| `/products/:id/edit` | Full-page wizard pre-populated for editing |

### Updated Products List Page

- "Create Product" button now navigates to `/products/new` (was opening a modal)
- "Edit" navigates to `/products/:id/edit` (was opening modal)
- Removed `ProductForm` modal import and all create/update mutations

### New Hook — `use-gl-accounts.ts`

React Query hook that fetches GL accounts from Fineract API, caches for 5 minutes, and provides `getAccountsForField()` helper to filter accounts by type per dropdown.

### Updated Types — `types/index.ts`

Added:
- `GLAccount` interface for GL account dropdowns
- `FineractProductDefaults` interface for the defaults endpoint
- Fineract enum constants: `AMORTIZATION_TYPES`, `INTEREST_TYPES`, `FREQUENCY_TYPES`, `INTEREST_CALCULATION_PERIOD_TYPES`, `ACCOUNTING_RULES`, `TRANSACTION_STRATEGIES`
- Expanded `LoanProduct` with 27 new Fineract fields
- Expanded `CreateProductInput` with all Fineract + GL params

### Updated API Client — `products.ts`

Added:
- `getProductFineractDefaults()` → `GET /admin/products/fineract-defaults`
- `getGLAccounts()` → `GET /admin/products/gl-accounts`

---

## 7. Test Updates

**File:** `tests/unit/admin/product-management.test.ts`

### Changes Made

1. **Fineract mock expanded:**
   - `getFineractClient` now returns a mock with `createLoanProduct`, `updateLoanProduct`, `listLoanProducts`, `listGLAccounts`
   - Added `FineractApiError` mock class for error handling

2. **Test body functions updated:**
   - `validSmartphoneProductBody()` — added `short_name: 'PH01'`, `default_principal: 250`, `number_of_repayments: 12`, `accounting_rule: 1`
   - `validDigitalProductBody()` — added `short_name: 'DG01'`, `default_principal: 100`, `number_of_repayments: 6`, `accounting_rule: 1`

3. **PATCH tests fixed:**
   - Added `selectChain` mock before `updateChain` (handler now fetches existing product first)
   - 404 test updated: returns 404 from initial SELECT, not from UPDATE
   - 500 test updated: selectChain returns existing product, then updateChain fails

4. **POST tests verified:**
   - Happy path tests expect `fineract_product_id: 42` in response
   - Mock chain: uniqueness check → (Fineract mock auto-called) → insert → audit

### Test Results

```
Test Suites: 121 passed, 121 total
Tests:       2700 passed, 2700 total
```

---

## 8. Deployment Details

### CI/CD Pipeline

| Workflow | Run | Result |
|----------|-----|--------|
| Test & Build (push-triggered, commit 1) | — | **Failed** (16 test failures — expected) |
| Test & Build (push-triggered, commit 2) | — | **Passed** (2700/2700 tests) |
| Deploy to AWS (push-triggered, commit 2) | — | **Passed** (staging auto-deploy) |
| Validate Domain References | — | **Passed** |
| Deploy to AWS (production, manual) | Run 23304475135 | **Passed** |

### Production Deploy

```
Trigger:     gh workflow run deploy.yml --ref master -f environment=production
Run ID:      23304475135
Duration:    ~7 minutes
Stack:       lynia-finance-prod → UPDATE_COMPLETE
Updated at:  2026-03-19T16:14:41Z
```

### Database Migration Execution

Migration 038 was applied via a temporary Lambda function deployed into the production VPC:

1. Created `production-lynia-migration-runner` Lambda
   - Runtime: Node.js 18.x
   - VPC: Same subnets/SG as admin-service
   - Dependencies: `pg` PostgreSQL client
   - Role: Reused admin-service IAM role
2. Invoked with `{"migration": "038_fineract_product_params.sql"}`
3. Result: `{"statusCode": 200, "body": "Migration 038_fineract_product_params.sql applied successfully"}`
4. Deleted temporary Lambda immediately after

### SAM Template

No changes needed — the admin service already uses a catch-all proxy route (`/admin/{proxy+}`) that covers the new endpoints automatically.

---

## 9. Architecture — Before vs After

### Before: Lynia-First (Async Sync)

```
Admin fills simple modal form
         │
         ▼
┌─────────────────────┐
│  POST /admin/products│
│  • Save to Lynia DB  │ ◄── Product saved immediately
│  • Queue SQS message │
└─────────┬───────────┘
          │ (async, may fail silently)
          ▼
┌─────────────────────┐
│  SQS Consumer        │
│  • Hardcode params   │ ◄── accountingRule=1, auto shortName
│  • POST /loanproducts│      no GL mappings
│  • Update DB link    │
└─────────────────────┘
          │
          ▼
     Fineract
     (may never receive product)
```

**Problems:** Orphaned Lynia products, incomplete Fineract data, no admin control over financial params.

### After: Fineract-First (Synchronous)

```
Admin fills 3-step wizard
(all Fineract params + GL mappings)
         │
         ▼
┌──────────────────────────┐
│  POST /admin/products     │
│  1. Validate all params   │
│  2. POST /loanproducts ──►│── Fineract (synchronous)
│  3. On success: save DB   │   Returns fineract_product_id
│  4. On failure: return err│   ◄── Product NOT saved
└──────────────────────────┘
```

**Benefits:** No orphans, complete Fineract data, admin controls all params, GL mappings for RBZ compliance.

---

## 10. Production Verification

| Check | Result |
|-------|--------|
| CloudFormation stack status | `UPDATE_COMPLETE` |
| Stack last updated | `2026-03-19T16:14:41Z` |
| Migration 038 applied | Yes — all 27 columns added |
| Existing products backfilled | Yes — default_principal, number_of_repayments, short_name |
| API health | Responding (403 = auth required, as expected) |
| Temporary Lambda cleaned up | Deleted |
