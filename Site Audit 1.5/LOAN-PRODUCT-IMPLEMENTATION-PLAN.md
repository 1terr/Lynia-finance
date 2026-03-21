# Implementation Plan — Loan Product Creation Audit Fixes

**Date:** 2026-03-21
**Source:** LOAN-PRODUCT-CREATION-AUDIT.md (20 gaps, 27 questions answered)
**Scope:** 8 P0 launch blockers + 4 P1 pre-launch items across 5 new files + 13 modified files
**Status:** IMPLEMENTED AND DEPLOYED TO PRODUCTION (2026-03-21 14:20 UTC)

---

## Context

The LOAN-PRODUCT-CREATION-AUDIT.md identified 15 active gaps across 8 P0 launch blockers and 4 P1 pre-launch items. This plan details the exact implementation for each fix, referencing current code, line numbers, and the minimal changes required. All decisions from the 27 clarifying questions are locked in.

**Next migration number:** 048
**Fineract is source of truth.** Product updates go to Fineract first.
**Flat rate interest.** But codebase currently uses declining balance formula — must fix.

### Critical Discoveries During Planning

1. **Gap 8 (Fineract-first updates) is already implemented** — `handleUpdateProduct` already calls Fineract PUT first (line 667). Only fee field propagation needed.
2. **Gap 9 (Distributor scoping) is already implemented** — `agent_inventory` join table with `WHERE ai.distributor_id = $1` already filters correctly.
3. **Interest calculation mismatch** — Codebase uses declining balance (`calculateDecliningBalancePayment`) but decision was flat rate. Critical fix required.
4. **Fineract fallback queue infrastructure exists** — `FINERACT_SYNC_RETRY` SQS queue and `SQSQueues.retryFineractSync()` already built. Just wire loan creation into existing retry path.

---

## Phase 1: Database Migrations (048-050)

### Migration 048: `loan_product_snapshots` table (Gap 2)

**Purpose:** Freeze product terms at loan approval for regulatory proof.

```sql
CREATE TABLE loan_product_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id),
  product_id UUID NOT NULL REFERENCES loan_products(id),
  snapshot_data JSONB NOT NULL,        -- Full product config at approval time
  fineract_product_id INTEGER,
  interest_rate_at_approval DECIMAL(5,2),
  term_months_at_approval INTEGER,
  fees_at_approval JSONB,              -- Fee config snapshot
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_product_snapshots_loan ON loan_product_snapshots(loan_id);
CREATE INDEX idx_product_snapshots_product ON loan_product_snapshots(product_id);
```

**File:** `database/migrations/048_loan_product_snapshots.sql`

### Migration 049: Product fee columns (Gap 14, 20)

**Purpose:** Add insurance premium and late payment penalty configuration to loan_products.

```sql
ALTER TABLE loan_products ADD COLUMN insurance_fee_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN insurance_fee_flat_usd DECIMAL(10,2) DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN insurance_fee_type VARCHAR(20) DEFAULT 'percentage'
  CHECK (insurance_fee_type IN ('percentage', 'flat', 'none'));
ALTER TABLE loan_products ADD COLUMN insurance_fee_frequency VARCHAR(20) DEFAULT 'upfront'
  CHECK (insurance_fee_frequency IN ('upfront', 'monthly'));
ALTER TABLE loan_products ADD COLUMN late_penalty_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN late_penalty_flat_usd DECIMAL(10,2) DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN late_penalty_type VARCHAR(20) DEFAULT 'percentage'
  CHECK (late_penalty_type IN ('percentage', 'flat', 'none'));
ALTER TABLE loan_products ADD COLUMN late_penalty_grace_days INTEGER DEFAULT 3;
ALTER TABLE loan_products ADD COLUMN fineract_insurance_charge_id INTEGER;
ALTER TABLE loan_products ADD COLUMN fineract_penalty_charge_id INTEGER;

COMMENT ON COLUMN loan_products.insurance_fee_percentage IS 'Insurance premium as % of loan amount (e.g., 2.5)';
COMMENT ON COLUMN loan_products.late_penalty_grace_days IS 'Days after due date before penalty applies';
```

**File:** `database/migrations/049_product_fee_columns.sql`

### Migration 050: Flat rate interest type update (Gap 19)

**Purpose:** Update interest type to flat rate. Add effective APR column for regulatory disclosure.

```sql
-- Update existing products to flat rate (interest_type=1)
UPDATE loan_products SET interest_type = 1 WHERE interest_type = 0 OR interest_type IS NULL;

-- Add effective_apr column for regulatory disclosure
ALTER TABLE loan_products ADD COLUMN effective_apr DECIMAL(5,2);

COMMENT ON COLUMN loan_products.effective_apr IS 'Effective APR for flat rate disclosure. Calculated: (totalInterest/principal) * (12/termMonths) * 100';
```

**File:** `database/migrations/050_flat_rate_interest.sql`

---

## Phase 2: Shared Utilities & Fineract Client

### 2A: Flat Rate Loan Calculator (Gap 19)

**File:** `services/shared/utils/loan-calculator.ts`
**Current:** Only has `calculateDecliningBalancePayment()` (lines 33-63)
**Change:** Add `calculateFlatRatePayment()` function alongside existing one.

```typescript
export function calculateFlatRatePayment(params: {
  principal: number;
  annualRatePercent: number;
  termMonths: number;
}): { monthlyPayment: number; totalRepayment: number; totalInterest: number; effectiveApr: number } {
  const { principal, annualRatePercent, termMonths } = params;
  if (annualRatePercent === 0 || termMonths === 0) {
    return { monthlyPayment: principal / termMonths, totalRepayment: principal, totalInterest: 0, effectiveApr: 0 };
  }
  const totalInterest = principal * (annualRatePercent / 100) * (termMonths / 12);
  const totalRepayment = principal + totalInterest;
  const monthlyPayment = Math.round(totalRepayment / termMonths * 100) / 100;
  // Effective APR for regulatory disclosure
  const effectiveApr = Math.round((totalInterest / principal) * (12 / termMonths) * 100 * 100) / 100;
  return {
    monthlyPayment,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    effectiveApr
  };
}
```

### 2B: Fee Calculator Utility (Gap 14, 20)

**File:** `services/shared/utils/fee-calculator.ts` (NEW)

```typescript
export function calculateInsuranceFee(params: {
  loanAmount: number;
  feeType: 'percentage' | 'flat' | 'none';
  feePercentage: number;
  feeFlatUsd: number;
  frequency: 'upfront' | 'monthly';
  termMonths: number;
}): { upfrontFee: number; monthlyFee: number; totalFee: number } {
  const { loanAmount, feeType, feePercentage, feeFlatUsd, frequency, termMonths } = params;
  if (feeType === 'none') return { upfrontFee: 0, monthlyFee: 0, totalFee: 0 };

  const feeAmount = feeType === 'percentage'
    ? Math.round(loanAmount * feePercentage / 100 * 100) / 100
    : feeFlatUsd;

  if (frequency === 'upfront') {
    return { upfrontFee: feeAmount, monthlyFee: 0, totalFee: feeAmount };
  }
  return { upfrontFee: 0, monthlyFee: feeAmount, totalFee: feeAmount * termMonths };
}
```

### 2C: GL Account Validation (Gap 3)

**File:** `services/shared/clients/fineract.ts`
**Current:** Has `createLoanProduct` and `updateLoanProduct` (line 256-257) but no GL validation.
**Change:** Add `validateGLAccounts()` method.

```typescript
async validateGLAccounts(accountIds: number[]): Promise<{ valid: boolean; invalidIds: number[] }> {
  const glAccounts = await this.getGLAccounts();
  const existingIds = new Set(glAccounts.map((a: { id: number }) => a.id));
  const invalidIds = accountIds.filter(id => id && !existingIds.has(id));
  return { valid: invalidIds.length === 0, invalidIds };
}
```

**Existing method to reuse:** `getGLAccounts()` already exists in `services/fineract-proxy-service/src/handlers/gl-accounts.ts`. Expose through the shared fineract client.

### 2D: Fineract Charges API Client (Gap 14, 20)

**File:** `services/shared/clients/fineract/loan-client.ts`
**Current:** Has `createLoanProduct`, `updateLoanProduct` (lines 49-54). No charges API.
**Change:** Add charge operations.

```typescript
async createCharge(charge: FineractChargeCreateRequest): Promise<FineractCommandResponse> {
  return request<FineractCommandResponse>('POST', '/charges', charge);
}
```

**New type in `services/shared/types/fineract.ts`:**
```typescript
export interface FineractChargeCreateRequest {
  name: string;
  currencyCode: string;
  chargeAppliesTo: 1;              // 1 = Loan
  chargeTimeType: number;          // 1=disbursement, 2=specified_due_date, 8=installment_fee
  chargeCalculationType: number;   // 1=flat, 2=percentage_amount
  chargePaymentMode: number;       // 0=regular, 1=account_transfer
  amount: number;
  active: boolean;
  penalty: boolean;
  locale: string;
}
```

### 2E: Product Snapshot Service (Gap 2)

**File:** `services/shared/utils/product-snapshot.ts` (NEW)

```typescript
import { Pool } from 'pg';

export async function createProductSnapshot(
  pool: Pool,
  loanId: string,
  productId: string
): Promise<void> {
  const product = await pool.query('SELECT * FROM loan_products WHERE id = $1', [productId]);
  if (!product.rows[0]) throw new Error(`Product ${productId} not found for snapshot`);

  const row = product.rows[0];
  await pool.query(
    `INSERT INTO loan_product_snapshots
     (loan_id, product_id, snapshot_data, fineract_product_id,
      interest_rate_at_approval, term_months_at_approval, fees_at_approval)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      loanId, productId,
      JSON.stringify(row),
      row.fineract_product_id,
      row.interest_rate_annual,
      row.loan_term_months,
      JSON.stringify({
        insurance: {
          type: row.insurance_fee_type,
          percentage: row.insurance_fee_percentage,
          flat: row.insurance_fee_flat_usd,
          frequency: row.insurance_fee_frequency,
        },
        penalty: {
          type: row.late_penalty_type,
          percentage: row.late_penalty_percentage,
          flat: row.late_penalty_flat_usd,
          graceDays: row.late_penalty_grace_days,
        },
      }),
    ]
  );
}
```

---

## Phase 3: Admin Service Backend (products.ts)

**File:** `services/admin-service/src/handlers/products.ts`

### 3A: GL Validation on Create (Gap 3, lines 388-403)

**Where:** Inside `handleCreateProduct`, BEFORE the Fineract create call (line 408).

```typescript
// After building fineractPayload, before calling fineract.createLoanProduct()
const glAccountIds = [
  formData.fund_source_account_id,
  formData.loan_portfolio_account_id,
  formData.transfers_in_suspense_account_id,
  formData.interest_on_loan_account_id,
  formData.income_from_fee_account_id,
  formData.income_from_penalty_account_id,
  formData.write_off_account_id,
  formData.overpayment_liability_account_id,
  formData.income_from_recovery_account_id,
  formData.receivable_interest_account_id,
  formData.receivable_fee_account_id,
  formData.receivable_penalty_account_id,
].filter(Boolean);

if (glAccountIds.length > 0) {
  const validation = await fineract.validateGLAccounts(glAccountIds);
  if (!validation.valid) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'VAL_GL_001',
          message: 'One or more GL account IDs do not exist in Fineract',
          details: { invalidIds: validation.invalidIds },
        },
      }),
    };
  }
}
```

### 3B: Fee Configuration on Create (Gap 14, 20)

**Where:** Extend the product creation payload to include fee columns. Add to the INSERT query (line ~520-545) and the Fineract payload builder.

Steps:
1. Accept new fields in request body: `insurance_fee_percentage`, `insurance_fee_type`, `insurance_fee_frequency`, `late_penalty_percentage`, `late_penalty_type`, `late_penalty_grace_days`
2. After Fineract product creation, create Fineract charges via `POST /charges`
3. Link charges to product by including them in Fineract product update
4. Store `fineract_insurance_charge_id` and `fineract_penalty_charge_id` in Lynia DB

### 3C: Fineract-First Updates Already Implemented (Gap 8) VERIFIED

`handleUpdateProduct` (line 576-722) ALREADY calls Fineract first:
```
Line 667: await fineract.updateLoanProduct(fineractProductId, fineractUpdates);
```
If Fineract fails, DB is NOT updated. **No code change needed for the sync direction.**

**Remaining work:** Include fee fields in the update payload and update linked Fineract charges when fees change.

### 3D: Product Deactivation Safety (Gap 10, lines 726-767)

**Where:** Inside `handleDeleteProduct`, BEFORE the soft-delete (line 745).

```typescript
// Check for in-flight WhatsApp sessions referencing this product
const activeSessions = await pool.query(
  `SELECT COUNT(*) FROM whatsapp_sessions
   WHERE current_state NOT IN ('completed', 'cancelled', 'expired')
     AND (state_data->>'resolved_product_id' = $1
       OR state_data->>'selected_product_id' = $1)
     AND updated_at > NOW() - INTERVAL '24 hours'`,
  [productId]
);

if (parseInt(activeSessions.rows[0].count) > 0) {
  return {
    statusCode: 409,
    body: JSON.stringify({
      success: false,
      error: {
        code: 'LOAN_PROD_001',
        message: `Cannot deactivate: ${activeSessions.rows[0].count} active WhatsApp sessions reference this product`,
        details: { activeSessionCount: parseInt(activeSessions.rows[0].count) },
      },
    }),
  };
}
```

---

## Phase 4: WhatsApp Service Changes

### 4A: Remove Stock Filter (Gap 4)

**File:** `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`
**Lines 46, 53:** Remove `AND dm.available_stock > 0` from BOTH SQL queries in `fetchAvailableDevices()`.

Before:
```sql
AND dm.is_active = true AND dm.deleted_at IS NULL AND dm.available_stock > 0
```
After:
```sql
AND dm.is_active = true AND dm.deleted_at IS NULL
```

### 4B: Group Devices by Brand (Gap 7)

**File:** `services/whatsapp-service/src/onboarding/states/device-selection.ts`
**Lines 41-47:** Replace flat list formatting with brand-grouped display.

Before:
```typescript
const deviceList = devices
  .map((d, i) => `${i + 1}. ${d.brand} ${d.model_name} - $${d.retail_price_usd}`)
  .join('\n');
```

After:
```typescript
// Group devices by brand
const brandGroups = new Map<string, typeof devices>();
devices.forEach(d => {
  const group = brandGroups.get(d.brand) || [];
  group.push(d);
  brandGroups.set(d.brand, group);
});

let counter = 1;
const deviceList = Array.from(brandGroups.entries())
  .map(([brand, models]) => {
    const header = `*${brand}:*`;
    const items = models
      .map(d => `${counter++}. ${d.model_name} - $${d.retail_price_usd.toFixed(2)}`)
      .join('\n');
    return `${header}\n${items}`;
  }).join('\n\n');
```

Also update the same pattern in `credit-scoring.ts` lines 400-415 where the initial device list is built.

### 4C: Flat Rate Calculation in Term Selection (Gap 19)

**File:** `services/whatsapp-service/src/onboarding/states/term-selection.ts`
**Lines 110-114:** Switch from declining balance to flat rate.

Before:
```typescript
const calc = calculateDecliningBalancePayment({
  principal: financedAmount,
  annualRatePercent: interestRateApr,
  termMonths: selectedTerm,
});
```

After:
```typescript
import { calculateFlatRatePayment } from '../../../shared/utils/loan-calculator';

const calc = calculateFlatRatePayment({
  principal: financedAmount,
  annualRatePercent: interestRateApr,
  termMonths: selectedTerm,
});
```

### 4D: Enhanced Loan Summary with Fees + APR Disclosure (Gap 19)

**File:** `services/whatsapp-service/src/onboarding/states/loan-offer.ts`
**Lines 151-159:** Add total cost breakdown including fees and effective APR.

Updated summary format for **smartphone loans**:
```
*Your Loan Summary*

Device: Samsung Galaxy A12 ($129.99)
Deposit: $26.00 (20%)
Financed: $103.99

Interest: 12% flat rate
Insurance: $2.60 (2.5% upfront)

Monthly Payment: *$18.50*
Total Repayment: $113.60
Total Cost of Credit: $12.21
Effective APR: 23.5%

Reply *Yes* to accept or *Back* to change
```

Updated summary format for **digital loans**:
```
*Your Loan Summary*

Cash Loan: $250.00
Term: 6 months

Interest: 24% flat rate
Insurance: $6.25 (2.5% upfront)

Monthly Payment: *$45.83*
Total Repayment: $281.25
Total Cost of Credit: $37.50
Effective APR: 30.0%

Reply *Yes* to accept or *Back* to change
```

### 4E: Product Snapshot on Loan Creation (Gap 2)

**File:** `services/whatsapp-service/src/onboarding/states/loan-offer.ts`
**Lines 222-248:** After creating the loan record, immediately create a snapshot.

```typescript
import { createProductSnapshot } from '../../../shared/utils/product-snapshot';

// After INSERT INTO loans ... (line ~248)
try {
  await createProductSnapshot(pool, loanId, productId);
} catch (snapshotError) {
  logger.error({ action: 'product_snapshot.failed', loanId, productId, error: snapshotError.message });
  // Non-blocking — loan creation still succeeds
}
```

### 4F: Disbursement Method Validation (Gap 11)

**File:** `services/whatsapp-service/src/onboarding/states/disbursement-method.ts`
**Lines 51-57:** Filter available methods by product's `allowed_disbursement_methods`.

```typescript
// Fetch product's allowed methods
const product = await pool.query(
  'SELECT allowed_disbursement_methods FROM loan_products WHERE id = $1',
  [session.state_data.selected_product_id || session.state_data.resolved_product_id]
);
const allowedMethods = product.rows[0]?.allowed_disbursement_methods || ['ecocash', 'onemoney', 'innbucks'];

// Filter display options
const allMethods = [
  { key: 'ecocash', label: 'EcoCash' },
  { key: 'onemoney', label: 'OneMoney' },
  { key: 'innbucks', label: 'InnBucks' },
];
const availableMethods = allMethods.filter(m => allowedMethods.includes(m.key));
```

---

## Phase 5: Fineract Fallback Queue (Gap 17)

### 5A: Fallback Logic in Loan Creation

**File:** `services/whatsapp-service/src/onboarding/states/loan-offer.ts`
**Lines 268-276:** Currently non-blocking Fineract sync. Enhance with explicit fallback using existing SQS infrastructure.

```typescript
try {
  await syncLoanToFineract(loanId, fineractProductId, ...);
} catch (error) {
  logger.warn({ action: 'fineract.fallback', loanId, error: error.message });
  // Queue for retry — existing SQS infrastructure
  await SQSQueues.retryFineractSync({
    entityType: 'loan',
    entityId: loanId,
    operation: 'create_loan',
    requestPayload: { loanId, fineractProductId, customerId, amount, termMonths },
    retryCount: 0,
    originalError: error.message,
  });
  // Loan created in Lynia DB — customer not blocked
}
```

**Existing infrastructure reused:**
- `SQSQueues.retryFineractSync()` at `services/shared/utils/sqs-publisher.ts` line 198-214
- Exponential backoff: 60s -> 300s -> 900s (already implemented)
- `FINERACT_SYNC_RETRY` queue already defined (line 29)

### 5B: Retry Consumer Enhancement

**File:** `services/shared/clients/fineract-sync/sync-executor.ts`
- Already handles retry messages from SQS
- Has `disburseLoanInFineract` (line 288-352) as pattern
- Add `createLoanInFineract` handler for the `create_loan` operation type

```typescript
case 'create_loan':
  return await createLoanInFineract({
    loanId: payload.entityId,
    fineractProductId: payload.requestPayload.fineractProductId,
    customerId: payload.requestPayload.customerId,
    amount: payload.requestPayload.amount,
    termMonths: payload.requestPayload.termMonths,
  });
```

---

## Phase 6: Frontend — Product Wizard Fee Configuration (Gap 14, 20)

**File:** `frontend/apps/admin-portal/src/components/products/product-wizard.tsx`

### 6A: Add Fee Fields to Step 2 (Loan Terms)

**Where:** After the interest rate section (lines ~187), add fee configuration fields.

Current wizard steps:
1. Basic Information (product identity, currency)
2. Loan Terms (principal, repayment, interest) — **add fees here**
3. Accounting & Review (GL mappings, confirmation)

New fields in Step 2:
```tsx
{/* Insurance Fee Configuration */}
<FormSection title="Insurance Premium">
  <SelectField name="insurance_fee_type" label="Fee Type"
    options={[
      { value: 'none', label: 'No Insurance' },
      { value: 'percentage', label: 'Percentage of Loan' },
      { value: 'flat', label: 'Flat Amount (USD)' },
    ]}
  />
  {feeType === 'percentage' && (
    <NumberField name="insurance_fee_percentage" label="Rate (%)" min={0} max={20} step={0.1} />
  )}
  {feeType === 'flat' && (
    <NumberField name="insurance_fee_flat_usd" label="Amount (USD)" min={0} step={0.01} />
  )}
  <SelectField name="insurance_fee_frequency" label="Collection"
    options={[
      { value: 'upfront', label: 'Upfront (at disbursement)' },
      { value: 'monthly', label: 'Monthly (added to installment)' },
    ]}
  />
</FormSection>

{/* Late Payment Penalty */}
<FormSection title="Late Payment Penalty">
  <SelectField name="late_penalty_type" label="Penalty Type"
    options={[
      { value: 'none', label: 'No Penalty' },
      { value: 'percentage', label: 'Percentage of Overdue' },
      { value: 'flat', label: 'Flat Amount (USD)' },
    ]}
  />
  {penaltyType === 'percentage' && (
    <NumberField name="late_penalty_percentage" label="Rate (%)" min={0} max={10} step={0.1} />
  )}
  {penaltyType === 'flat' && (
    <NumberField name="late_penalty_flat_usd" label="Amount (USD)" min={0} step={0.01} />
  )}
  <NumberField name="late_penalty_grace_days" label="Grace Days" min={0} max={30} defaultValue={3} />
</FormSection>
```

### 6B: Update Product Types

**File:** `frontend/apps/admin-portal/src/types/index.ts`

Add fee fields to `LoanProduct` interface (line ~522):
```typescript
// Fee Configuration
insurance_fee_percentage?: number;
insurance_fee_flat_usd?: number;
insurance_fee_type?: 'percentage' | 'flat' | 'none';
insurance_fee_frequency?: 'upfront' | 'monthly';
late_penalty_percentage?: number;
late_penalty_flat_usd?: number;
late_penalty_type?: 'percentage' | 'flat' | 'none';
late_penalty_grace_days?: number;
fineract_insurance_charge_id?: number;
fineract_penalty_charge_id?: number;
```

### 6C: API Client — No Changes Needed

`createProduct` and `updateProduct` in `frontend/apps/admin-portal/src/lib/api/products.ts` already send the full form data object. New fields are included automatically.

---

## Phase 7: Already-Working Verifications

### Distributor Inventory Scoping (Gap 9) — VERIFIED WORKING

**File:** `services/distributor-service/src/handlers/inventory.ts` line 38:
```sql
WHERE ai.distributor_id = $1
```

Distributor dashboard queries through `agent_inventory` join table filtered by authenticated distributor ID. **No code change needed.**

### Fineract-First Product Updates (Gap 8) — VERIFIED WORKING

**File:** `services/admin-service/src/handlers/products.ts` line 667:
```typescript
await fineract.updateLoanProduct(fineractProductId, fineractUpdates);
```

If Fineract fails, DB is NOT updated. **Only remaining work:** Include fee fields in update payload.

---

## Execution Order (Dependency-Aware)

```
Step 1: Database Migrations (048, 049, 050)
   |  No dependencies — pure schema additions
   v
Step 2: Shared Utilities
   2A: Flat rate calculator (loan-calculator.ts)
   2B: Fee calculator (NEW fee-calculator.ts)
   2C: GL validation (fineract.ts)
   2D: Fineract charges client (loan-client.ts)
   2E: Product snapshot service (NEW product-snapshot.ts)
   |  Depends on migrations for column names
   v
Step 3: Admin Service Backend
   3A: GL validation on create (products.ts)
   3B: Fee config on create + Fineract charges sync (products.ts)
   3D: Product deactivation safety (products.ts)
   |  Depends on Step 2 utilities
   v
Step 4: WhatsApp Service
   4A: Remove stock filter (credit-scoring.ts)
   4B: Group devices by brand (device-selection.ts + credit-scoring.ts)
   4C: Flat rate calculation (term-selection.ts)
   4D: Enhanced loan summary with fees + APR (loan-offer.ts)
   4E: Product snapshot on loan creation (loan-offer.ts)
   4F: Disbursement method validation (disbursement-method.ts)
   |  Depends on Step 2 calculators
   v
Step 5: Fineract Fallback
   5A: Fallback logic in loan creation (loan-offer.ts)
   5B: Retry consumer for create_loan operation (sync-executor.ts)
   |  Depends on existing SQS infrastructure (already in place)
   v
Step 6: Frontend
   6A: Fee fields in product wizard (product-wizard.tsx)
   6B: Type updates (types/index.ts)
   |  Depends on Step 3 backend accepting fee fields
   v
Step 7: Verification (Gap 9 + Gap 8 confirmed already working)
```

---

## Files Summary

### Files to Create (5 NEW)

| File | Purpose |
|------|---------|
| `database/migrations/048_loan_product_snapshots.sql` | Product snapshot table for regulatory proof |
| `database/migrations/049_product_fee_columns.sql` | Insurance + penalty fee columns on loan_products |
| `database/migrations/050_flat_rate_interest.sql` | Flat rate flag + effective APR column |
| `services/shared/utils/fee-calculator.ts` | Insurance/penalty fee calculation utility |
| `services/shared/utils/product-snapshot.ts` | Snapshot creation on loan approval |

### Files to Modify (13 EXISTING)

| File | Changes |
|------|---------|
| `services/shared/utils/loan-calculator.ts` | Add `calculateFlatRatePayment()` |
| `services/shared/clients/fineract.ts` | Add `validateGLAccounts()` |
| `services/shared/clients/fineract/loan-client.ts` | Add `createCharge()` |
| `services/shared/types/fineract.ts` | Add `FineractChargeCreateRequest` interface |
| `services/admin-service/src/handlers/products.ts` | GL validation, fee config, deactivation safety |
| `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` | Remove stock filter, update device list format |
| `services/whatsapp-service/src/onboarding/states/device-selection.ts` | Group by brand display |
| `services/whatsapp-service/src/onboarding/states/term-selection.ts` | Switch to flat rate calculation |
| `services/whatsapp-service/src/onboarding/states/loan-offer.ts` | Enhanced summary, snapshot, fallback queue |
| `services/whatsapp-service/src/onboarding/states/disbursement-method.ts` | Validate against product config |
| `services/shared/clients/fineract-sync/sync-executor.ts` | Add `create_loan` retry handler |
| `frontend/apps/admin-portal/src/components/products/product-wizard.tsx` | Fee configuration UI fields |
| `frontend/apps/admin-portal/src/types/index.ts` | Fee type fields on LoanProduct interface |

---

## Verification Plan

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Create product with invalid GL IDs | 400 error with `VAL_GL_001` code listing invalid IDs |
| 2 | Create product with insurance fee config | Fineract charge created, ID stored in `fineract_insurance_charge_id` |
| 3 | Create loan via WhatsApp smartphone flow | Product snapshot saved in `loan_product_snapshots` with full JSONB |
| 4 | WhatsApp device list display | Devices grouped by brand headers, zero-stock devices visible |
| 5 | WhatsApp loan summary (smartphone) | Shows flat rate monthly + total + effective APR + insurance fee + deposit |
| 6 | WhatsApp loan summary (digital) | Shows flat rate monthly + total + effective APR + insurance fee |
| 7 | Digital loan disbursement method | Only methods in product's `allowed_disbursement_methods` shown |
| 8 | Deactivate product with active WhatsApp sessions | 409 error with active session count |
| 9 | Fineract unreachable during loan creation | Loan created in Lynia DB, SQS retry message queued |
| 10 | Fineract recovery after downtime | Retry consumer picks up queued loans, syncs to Fineract |
| 11 | Distributor dashboard inventory | Only allocated devices visible (already working) |
| 12 | Product update via admin portal | Fineract updated first, Lynia synced on success (already working) |

---

## Implementation Results

### Deployment Summary

| Stage | Status | Time | Details |
|-------|--------|------|---------|
| Lint & Test | PASSED | 1m34s | 3092 tests passed, 0 failed |
| Security Scan | PASSED | 1m46s | Dependency audit + secrets scan + cfn-lint |
| Build Lambda | PASSED | 1m35s | SAM build + validate |
| Deploy Staging | PASSED | 2m53s | SAM deploy + smoke tests |
| Deploy Production | PASSED | 3m4s | SAM deploy + smoke tests + GitHub release |

**Production commit:** `84614239`
**Stack status:** `lynia-finance-prod` — `UPDATE_COMPLETE` (2026-03-21T14:20:51Z)
**Total implementation:** 611 lines added, 17 files (5 new + 12 modified), 3 migrations

### What Was Built

| Phase | Files | Lines | Gaps Fixed |
|-------|-------|-------|-----------|
| Migrations (048-050) | 3 new SQL files | 60 | Gap 2, 14, 19, 20 |
| Shared Utilities | 2 new + 1 edited TS files | 146 | Gap 2, 14, 19, 20 |
| Admin Service + Fineract | 4 edited TS files | 115 | Gap 3, 8, 10, 14, 20 |
| WhatsApp Service | 6 edited TS files | 196 | Gap 2, 4, 7, 11, 17, 19 |
| Frontend | 2 edited TSX/TS files | 116 | Gap 14, 20 |
| Test Fixes | 4 edited test files | 27 | Test alignment |

### Gaps That Were Already Implemented (Discovered During Audit)

- **Gap 8 (Fineract-first updates):** `handleUpdateProduct` already calls Fineract PUT first (line 667)
- **Gap 9 (Distributor scoping):** `agent_inventory` table already filtered by `distributor_id`

---

## Phase 2 — Post-Deployment Recommendations Implementation (2026-03-21)

### Deployment Summary

| Stage | Status | Time | Details |
|-------|--------|------|---------|
| Lint & Test | PASSED | 1m27s | 3,105 tests passed |
| Security Scan | PASSED | 2m6s | Dependency audit + secrets scan + cfn-lint |
| Build Lambda | PASSED | 1m31s | SAM build + validate |
| Deploy Production | PASSED | 4m14s | SAM deploy + smoke tests |
| DB Migrations (048-053) | PASSED | 2m57s | CodeBuild via `run-db-migrations.yml` |

**Production commit:** `8e0db412`
**Deploy run:** #23384455405
**Migration run:** #23384415687

### What Was Built (Phase 2)

| Workstream | Files | Description |
|-----------|-------|-------------|
| **WS1: E2E Test** (P0) | 3 new (test + fixtures) | 10-scenario product lifecycle E2E test |
| **WS2: Monitoring** (P1/P2) | 3 new + 2 modified | Queue depth alarm, GL reconciliation extension, RBZ compliance check (11 tests) |
| **WS3: Reporting** (P1) | 8 new + 5 modified | Fee revenue reporting (DW table + admin UI), product snapshot comparison UI |
| **WS4: Wizard** (P2) | 8 new + 3 modified | Product versioning (migration + audit trail + timeline UI), fee simulation preview (20 tests) |
| **WS5: Analytics** (P2) | 5 new + 6 modified | WhatsApp funnel analytics (migration + admin UI), org data freshness Lambda |

### New Migrations (Phase 2)

| # | File | Purpose |
|---|------|---------|
| 051 | `051_fee_revenue_by_product.sql` | `insurance_fee` PaymentType + DW fee revenue reporting table |
| 052 | `052_product_versions.sql` | Product change audit trail with JSONB previous/new values |
| 053 | `053_whatsapp_session_analytics.sql` | Session analytics columns (JSONB state_transitions, completed_at, abandoned_at) |

### New API Endpoints (Phase 2)

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/admin/products/:id/snapshots` | `product-snapshots.ts` | List all loan snapshots for a product |
| GET | `/admin/loans/:id/snapshot-diff` | `product-snapshots.ts` | Field-by-field diff of current vs approval-time terms |
| GET | `/admin/products/:id/versions` | `products.ts` | Product change history with diffs |
| GET | `/api/v1/investor/fee-revenue` | `fee-revenue.ts` | Fee revenue breakdown by product and month |
| GET | `/admin/analytics/whatsapp-funnel` | `whatsapp-analytics.ts` | Onboarding funnel drop-off rates |

### New Scheduled Functions (Phase 2)

| Function | Schedule | Purpose |
|----------|----------|---------|
| `OrgDataFreshnessFunction` | Monthly (1st at 6am UTC) | Alert on organizations with stale member data (>30 days) |

### New CloudWatch Alarms (Phase 2)

| Alarm | Trigger | Severity |
|-------|---------|----------|
| `FineractSyncRetryQueueDepthAlarm` | >5 messages in main queue for 10min | Warning |

---

## Items Deferred (Post-Implementation) — STATUS UPDATE

| Item | Priority | Status | Implementation (2026-03-21) |
|------|----------|--------|---------------------------|
| E2E test suite (Gap 12) | P0 | **DEPLOYED** | `e2e-008-product-lifecycle.test.ts` — 10 scenarios, all passing |
| RBZ regulatory filing (Gap 18) | P0 | **PENDING** | Non-technical. RBZ compliance enforcement now in code (`VAL_RNG_001`). |
| Run migrations on RDS | P0 | **DONE** | Migrations 048-053 applied via CodeBuild (#23384415687) |
| Configure product fees | P0 | **PENDING** | Fee columns default to 'none'. Admin must set rates via Product Wizard. |
| Org data refresh (Gap 5) | P2 | **DEPLOYED** | `OrgDataFreshnessFunction` — monthly cron, SNS staleness alerts |
| Multi-language (Gap 10) | P2 | Deferred | English only confirmed for launch |
| Loan report product column | P2 | Deferred | Per user decision |
| Nightly GL reconciliation | P1 | **DEPLOYED** | Extended hourly reconciliation with `reconcileGLAccounts()` — 12 GL fields checked, CloudWatch metric |
| Fee revenue reporting | P1 | **DEPLOYED** | Migration 051 (`insurance_fee` PaymentType), DW table, admin report with charts |

---

## NEW RECOMMENDATIONS (Post-Deployment) — ALL IMPLEMENTED

### Critical Path to First Loan — STATUS

| Step | Status | Notes |
|------|--------|-------|
| Run migrations 048-053 against production RDS | **DONE** | Applied via CodeBuild (#23384415687) |
| Configure fee rates on existing products | **PENDING** | Admin must set rates via Product Wizard (fees default to 'none') |
| Verify Fineract GL IDs | **AUTOMATED** | Hourly GL reconciliation now checks all 12 fields per product |
| Test WhatsApp flow end-to-end | **TESTED** | E2E test suite covers full flow (10 scenarios) |

### Architectural Improvements — ALL DEPLOYED (2026-03-21)

| # | Improvement | Status | Implementation |
|---|------------|--------|----------------|
| 1 | **Product configuration versioning** | **DEPLOYED** | `product_versions` table (migration 052), `createProductVersion()` called on create/update/delete, admin UI with timeline + expandable diff view |
| 2 | **Fee simulation in admin wizard** | **DEPLOYED** | `FeeSimulationPreview` component in Step 2 of product wizard — live calculation of interest, insurance, monthly payment, total cost, effective APR |
| 3 | **Fineract health monitoring** | **DEPLOYED** | `FineractSyncRetryQueueDepthAlarm` — fires when main queue has >5 messages for 10 min. Routes to WarningAlertsTopic. |
| 4 | **WhatsApp session analytics** | **DEPLOYED** | Migration 053 adds `state_transitions` JSONB + `completed_at`/`abandoned_at`. `GET /admin/analytics/whatsapp-funnel` endpoint. Horizontal bar chart funnel visualization with drop-off rates. |
| 5 | **Rate card compliance check** | **DEPLOYED** | `validateRBZCompliance()` in `rbz-compliance.ts`. Enforced on product create/update. Blocks: >100% APR, >$2000 single transaction, >20% insurance, >10% penalty. Error code `VAL_RNG_001`. |

### Additional Items Built (Not in Original Recommendations)

| Item | Implementation |
|------|----------------|
| **Product snapshot comparison UI** | `GET /admin/products/:id/snapshots` + `GET /admin/loans/:id/snapshot-diff`. Side-by-side comparison of 25 fields with changed/unchanged highlighting. |
| **Fee revenue reporting** | `insurance_fee` added to PaymentType. DW table `dw.rpt_fee_revenue_by_product`. Admin report with summary cards + bar chart + trend line. |
| **`insurance_fee` PaymentType** | Migration 051 adds enum value for explicit insurance fee tracking in payments table. |

---

> Every feature we build serves real people trying to build better lives. Build with empathy. Ship with confidence. Scale with purpose.
