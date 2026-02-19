# Task 8: Fineract Product Mapping Fix (Phase 8)

## Overview

Fix the hardcoded Fineract product ID mapping in the scoring service to use database-driven product lookup instead. This ensures that new loan products (especially digital loans) correctly map to their corresponding Fineract loan products.

## Dependencies

- **Task 1** (Database Migration) must be completed first

## Key Files

| File | Action |
|------|--------|
| `services/scoring-service/src/index.ts` | **Modify** - Fix Fineract product mapping (~line 642) |

## What to Implement

### 8.1 Current Code (Hardcoded - Line ~642)

```typescript
// CURRENT (hardcoded)
const tierToProductId = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
const fineractProductId = tierToProductId[scoreResult.tier] || 1;
```

### 8.2 New Code (Database-Driven)

```typescript
// NEW (database-driven)
const loanProduct = await db.from('loan_products')
  .select('fineract_product_id, product_category')
  .eq('id', loan.product_id)
  .maybeSingle().execute();

let fineractProductId;
if (loanProduct?.data?.fineract_product_id) {
  fineractProductId = loanProduct.data.fineract_product_id;
} else {
  // Backward-compatible fallback to existing tier mapping
  const tierMap = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
  fineractProductId = tierMap[scoreResult.tier] || 1;
}
```

### 8.3 New Fineract Products to Create

| ID | Name | Short Name | For | Principal Range | Interest |
|----|------|------------|-----|-----------------|----------|
| 4 | Digital Cash Loan - Standard | DCL-S | Digital (small loans) | $20-200 | 3% monthly |
| 5 | Digital Cash Loan - Premium | DCL-P | Digital (larger loans) | $200-500 | 2.5% monthly |

These will be created via the existing `FineractClient.createLoanProduct()` method using the same 21 GL accounts already configured.

### 8.4 Product Mapping Logic

```
Lynia loan_products table          Fineract loan products
+---------------------+           +---------------------+
| SMRT_FIN_001        |---------->| Tier 1 (Entry)   #1 |
| product_category:   |           | Tier 2 (Standard) #2|
|   smartphone        |           | Tier 3 (Premium) #3 |
| fineract_product_id |           |                     |
|   -> maps by tier   |           |                     |
+---------------------+           +---------------------+
| DIGI_LOAN_001       |---------->| DCL-S (Standard) #4 |
| product_category:   |           | DCL-P (Premium)  #5 |
|   digital           |           |                     |
| fineract_product_id |           |                     |
|   -> maps directly  |           |                     |
+---------------------+           +---------------------+
```

### 8.5 Backward Compatibility

The fallback ensures existing smartphone loans continue to work even if `fineract_product_id` is not set in the database. The hardcoded tier mapping remains as a safety net.

---

## Tests

### Test 1: Database-Driven Mapping - Smartphone Product

```typescript
describe('Fineract product mapping', () => {
  it('should use fineract_product_id from loan_products table when available', async () => {
    // Setup: SMRT_FIN_001 with fineract_product_id = 1
    const result = await getFineractProductId('loan-uuid-smartphone');
    expect(result).toBe(1);
  });
});
```

**Expected:** Smartphone loan resolves to correct Fineract product ID from database.

### Test 2: Database-Driven Mapping - Digital Product

```typescript
it('should map digital loan to DCL-S or DCL-P Fineract product', async () => {
  // Setup: DIGI_LOAN_001 with fineract_product_id = 4
  const result = await getFineractProductId('loan-uuid-digital');
  expect(result).toBe(4);
});
```

**Expected:** Digital loan resolves to the correct digital Fineract product (ID 4 or 5).

### Test 3: Backward-Compatible Fallback

```typescript
it('should fall back to tier mapping when fineract_product_id is null', async () => {
  // Setup: Product with no fineract_product_id set
  const result = await getFineractProductId('loan-uuid-no-fineract');
  // Should use tier-based fallback
  expect([1, 2, 3]).toContain(result);
});
```

**Expected:** When `fineract_product_id` is null, the old tier mapping is used as fallback.

### Test 4: Fineract Loan Creation - Smartphone

```typescript
it('should create Fineract loan with correct product ID for smartphone loan', async () => {
  const fineractLoan = await syncLoanToFineract({
    loanId: 'test-uuid',
    productId: 'smartphone-product-uuid',
    tier: 'Tier 2'
  });
  expect(fineractLoan.productId).toBe(2);  // Tier 2 -> Fineract product 2
});
```

**Expected:** Smartphone loan syncs to Fineract with correct tier-based product ID.

### Test 5: Fineract Loan Creation - Digital

```typescript
it('should create Fineract loan with correct product ID for digital loan', async () => {
  const fineractLoan = await syncLoanToFineract({
    loanId: 'test-uuid',
    productId: 'digital-product-uuid',
    tier: 'Tier 1'  // tier is less relevant for digital
  });
  expect(fineractLoan.productId).toBe(4);  // DCL-S -> Fineract product 4
});
```

**Expected:** Digital loan syncs to Fineract with the digital loan product ID, not the smartphone tier.

### Test 6: No Regression - Existing Loans

```typescript
it('should not break scoring for existing smartphone loans without product_id', async () => {
  // Legacy loan without product_id field
  const result = await calculateCreditScore({
    // ... existing scoring data, no product_id
  });
  expect(result.fineractProductId).toBeDefined();
  expect([1, 2, 3]).toContain(result.fineractProductId);
});
```

**Expected:** Existing loans without `product_id` continue to work with the tier fallback.

### Test 7: Database Unavailable Fallback

```typescript
it('should use tier fallback when database query fails', async () => {
  // Mock database failure
  jest.spyOn(db, 'from').mockRejectedValue(new Error('Connection failed'));

  const result = await getFineractProductId('any-loan', 'Tier 2');
  expect(result).toBe(2);  // Falls back to tier mapping
});
```

**Expected:** If the database query fails, the system gracefully falls back to hardcoded tier mapping.

### Test 8: Fineract Sync Non-Blocking

```typescript
it('should not block loan approval if Fineract sync fails', async () => {
  // Mock Fineract API failure
  jest.spyOn(fineractClient, 'createLoan').mockRejectedValue(new Error('Fineract down'));

  const loanApproval = await approveLoan('loan-uuid');
  expect(loanApproval.status).toBe('approved');
  // Fineract sync should be queued for retry via SQS
});
```

**Expected:** Fineract sync failure does not block loan approval. Failed sync is queued for retry.

### Test 9: Unit Test Suite

```bash
pnpm test services/scoring-service
```

**Expected:** All existing and new scoring tests pass. No regressions.

---

*Phase: 8 of 9*
*Depends on: Task 1 (Database Migration)*
*Blocks: Task 9 (Integration Testing)*
