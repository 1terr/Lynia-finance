# Task 9: End-to-End Integration Testing (Phase 9)

## Overview

Comprehensive integration tests that verify the entire loan product categories system works end-to-end, from admin configuration through customer application to Fineract sync.

## Dependencies

- **All previous tasks** (1-8) must be completed first

## Key Files

| File | Action |
|------|--------|
| `tests/` directory | **Create/Modify** - Integration test files |

## What to Implement

### 9.1 Smartphone Loan E2E Test Scenario

Full lifecycle:
1. Admin creates smartphone product with 15% deposit, 5% monthly rate, 3-12 month tenure
2. Admin adds Samsung Galaxy A14 device model at $199 retail
3. Customer applies for loan via WhatsApp
4. Score calculated using 5-component model
5. Approved -> customer pays $29.85 deposit (15% of $199)
6. Device handed over -> loan activated
7. Verify Fineract loan created with correct product mapping

### 9.2 Digital Loan E2E Test Scenario

Full lifecycle:
1. Admin creates digital loan product with 3% monthly rate, 1-6 month tenure
2. Admin registers Civil Service Commission organization (trust 90)
3. Admin imports member CSV with 100 records
4. Customer (teacher) applies for $200 loan via WhatsApp
5. Phone matched in organization_members -> org verification data retrieved
6. Score calculated using 6-component model (including org verification)
7. Approved -> $200 disbursed to EcoCash
8. Verify Fineract loan created with digital loan product mapping

---

## Tests

### E2E Test 1: Smartphone Loan - Complete Lifecycle

```typescript
describe('Smartphone Loan E2E', () => {
  it('should complete full smartphone loan lifecycle', async () => {
    // Step 1: Create smartphone product
    const product = await createProduct({
      product_code: 'E2E_SMART_001',
      product_name: 'E2E Smartphone Loan',
      product_category: 'smartphone',
      product_type: 'asset_financing',
      status: 'active',
      min_amount_usd: 50,
      max_amount_usd: 500,
      min_term_months: 3,
      max_term_months: 12,
      interest_rate_monthly: 5.00,
      interest_rate_annual: 60.00,
      deposit_percentage: 15,
      requires_device: true
    });
    expect(product.id).toBeDefined();

    // Step 2: Add device model
    const model = await createDeviceModel({
      brand: 'Samsung',
      model_name: 'Galaxy A14',
      model_code: 'E2E_SAM_A14',
      retail_price_usd: 199.00,
      wholesale_price_usd: 145.00
    });
    expect(model.id).toBeDefined();

    // Step 3: Customer applies
    const loan = await applyForLoan({
      customer_id: testCustomerId,
      product_id: product.id,
      device_model_id: model.id,
      amount: 199.00
    });
    expect(loan.status).toBe('pending');
    expect(loan.product_category).toBe('smartphone');

    // Step 4: Credit scoring (5-component)
    const score = await calculateScore({
      customer_id: testCustomerId,
      product_category: 'smartphone'
    });
    expect(score.components).toHaveLength(5);
    expect(score.finalScore).toBeGreaterThanOrEqual(300);

    // Step 5: Approve and verify deposit
    const deposit = 199 * 0.15; // $29.85
    expect(loan.deposit_amount_usd).toBeCloseTo(deposit, 2);

    // Step 6: Activate loan
    const activatedLoan = await activateLoan(loan.id);
    expect(activatedLoan.status).toBe('active');

    // Step 7: Verify Fineract sync
    const fineractLoan = await getFineractLoan(loan.fineract_loan_id);
    expect(fineractLoan).toBeDefined();
    expect([1, 2, 3]).toContain(fineractLoan.productId);
  });
});
```

**Expected:** Complete smartphone loan lifecycle succeeds with correct product, deposit, scoring, and Fineract sync.

### E2E Test 2: Digital Loan - Complete Lifecycle

```typescript
describe('Digital Loan E2E', () => {
  it('should complete full digital loan lifecycle', async () => {
    // Step 1: Create digital product
    const product = await createProduct({
      product_code: 'E2E_DIGI_001',
      product_name: 'E2E Digital Loan',
      product_category: 'digital',
      product_type: 'digital_credit',
      status: 'active',
      min_amount_usd: 20,
      max_amount_usd: 500,
      min_term_months: 1,
      max_term_months: 6,
      interest_rate_monthly: 3.00,
      interest_rate_annual: 36.00,
      deposit_percentage: 0,
      requires_organization_verification: true,
      allowed_disbursement_methods: ['ecocash', 'onemoney']
    });
    expect(product.id).toBeDefined();

    // Step 2: Create organization
    const org = await createOrganization({
      org_code: 'E2E_GOV_CSC',
      org_name: 'E2E Civil Service Commission',
      org_type: 'government',
      scoring_trust_level: 90
    });
    expect(org.id).toBeDefined();

    // Step 3: Import members
    const importResult = await importMembers(org.id, [
      {
        national_id: '12345678A90',
        phone_number: '+263771234567',
        employee_number: 'EMP001',
        employment_status: 'active',
        employment_start_date: '2018-03-01',
        department: 'Education',
        grade_level: 'Grade 7',
        monthly_salary_usd: 450.00
      }
    ]);
    expect(importResult.inserted).toBe(1);

    // Step 4: Customer applies
    const loan = await applyForLoan({
      customer_id: testCustomerWithPhoneId,
      product_id: product.id,
      amount: 200.00,
      disbursement_method: 'ecocash'
    });
    expect(loan.status).toBe('pending');
    expect(loan.product_category).toBe('digital');

    // Step 5: Org verification
    const orgVerification = await verifyOrganization({
      phone_number: '+263771234567'
    });
    expect(orgVerification.found).toBe(true);
    expect(orgVerification.org_type).toBe('government');
    expect(orgVerification.scoring_trust_level).toBe(90);

    // Step 6: Credit scoring (6-component)
    const score = await calculateScore({
      customer_id: testCustomerWithPhoneId,
      product_category: 'digital',
      org_verification: orgVerification
    });
    expect(score.components).toHaveLength(6);
    expect(score.components.find(c => c.name === 'orgVerification')).toBeDefined();

    // Step 7: Approve and disburse
    const disbursedLoan = await disburseLoan(loan.id);
    expect(disbursedLoan.status).toBe('active');
    expect(disbursedLoan.disbursement_method).toBe('ecocash');

    // Step 8: Verify Fineract sync
    const fineractLoan = await getFineractLoan(loan.fineract_loan_id);
    expect(fineractLoan).toBeDefined();
    expect([4, 5]).toContain(fineractLoan.productId); // DCL-S or DCL-P
  });
});
```

**Expected:** Complete digital loan lifecycle succeeds with org verification, 6-component scoring, EcoCash disbursement, and Fineract sync.

### E2E Test 3: Admin Product Configuration

```typescript
describe('Admin Product Configuration E2E', () => {
  it('should allow admin to create, update, and soft-delete a product', async () => {
    // Create
    const product = await adminCreateProduct(adminToken, { ... });
    expect(product.status).toBe('active');

    // Update
    const updated = await adminUpdateProduct(adminToken, product.id, { status: 'inactive' });
    expect(updated.status).toBe('inactive');

    // Soft delete
    await adminDeleteProduct(adminToken, product.id);
    const deleted = await adminGetProduct(adminToken, product.id);
    expect(deleted.deleted_at).toBeDefined();

    // Verify audit trail
    const auditLogs = await getAuditLogs({ entity_id: product.id });
    expect(auditLogs).toHaveLength(3); // create, update, delete
  });
});
```

**Expected:** Full admin CRUD lifecycle with audit logging.

### E2E Test 4: Device Model Catalog Management

```typescript
describe('Device Model Catalog E2E', () => {
  it('should manage device model catalog and link to products', async () => {
    const model = await createDeviceModel({ ... });

    // Verify stock counting
    await addDeviceToInventory({ device_model_id: model.id, imei: '123456789012345' });
    const updatedModel = await getDeviceModel(model.id);
    expect(updatedModel.available_stock).toBe(1);

    // Verify deposit override
    expect(updatedModel.min_deposit_percentage).toBe(15); // Override from product default 10%
  });
});
```

**Expected:** Device models correctly track stock and apply deposit overrides.

### E2E Test 5: Organization Member Import and Matching

```typescript
describe('Organization Member Import E2E', () => {
  it('should import members and auto-match to existing customers', async () => {
    // Create customer first
    const customer = await createTestCustomer({ phone: '+263771234567' });

    // Import member with same phone
    const result = await importMembers(orgId, [{
      phone_number: '+263771234567',
      employee_number: 'EMP001',
      employment_status: 'active'
    }]);

    // Verify auto-matching
    const member = await getMember(result.members[0].id);
    expect(member.customer_id).toBe(customer.id);
  });
});
```

**Expected:** Members with phone numbers matching existing customers are auto-linked.

### E2E Test 6: National ID Hashing Verification

```typescript
describe('Privacy - National ID Hashing', () => {
  it('should store national IDs as SHA-256 hashes, never plaintext', async () => {
    await importMembers(orgId, [{
      national_id: '12345678A90',
      phone_number: '+263771234567'
    }]);

    // Direct DB query to verify storage
    const dbRecord = await db.query('SELECT national_id_hash FROM organization_members WHERE phone_number = $1', ['+263771234567']);
    expect(dbRecord.rows[0].national_id_hash).not.toBe('12345678A90');
    expect(dbRecord.rows[0].national_id_hash).toHaveLength(64); // SHA-256 hex length
  });
});
```

**Expected:** National IDs are SHA-256 hashed before storage. Plaintext never stored.

### E2E Test 7: Product Deletion Safety

```typescript
describe('Product Deletion Safety', () => {
  it('should prevent deletion of product with active loans', async () => {
    const product = await createProduct({ ... });
    const loan = await createActiveLoan({ product_id: product.id });

    await expect(deleteProduct(product.id)).rejects.toThrow('Cannot delete product with active loans');
  });

  it('should allow deletion of product with no active loans', async () => {
    const product = await createProduct({ ... });
    // No loans created

    await deleteProduct(product.id);
    const deleted = await getProduct(product.id);
    expect(deleted.deleted_at).toBeDefined();
  });
});
```

**Expected:** Products with active loans cannot be deleted. Products without loans can be soft-deleted.

### E2E Test 8: Scoring Weight Verification Across Categories

```typescript
describe('Scoring Weight Verification', () => {
  it('smartphone scoring uses 5-component weights', async () => {
    const score = await calculateScore({
      product_category: 'smartphone',
      customer_id: testCustomerId
    });

    const weights = score.weights;
    expect(weights.affordability).toBe(300);
    expect(weights.repayment).toBe(250);
    expect(weights.mobileMoney).toBe(200);
    expect(weights.externalCredit).toBe(150);
    expect(weights.kycVerification).toBe(100);
    expect(weights.orgVerification).toBeUndefined();
  });

  it('digital scoring uses 6-component weights', async () => {
    const score = await calculateScore({
      product_category: 'digital',
      customer_id: testCustomerWithOrgId
    });

    const weights = score.weights;
    expect(weights.affordability).toBe(300);
    expect(weights.repayment).toBe(250);
    expect(weights.mobileMoney).toBe(100);
    expect(weights.externalCredit).toBe(50);
    expect(weights.kycVerification).toBe(100);
    expect(weights.orgVerification).toBe(200);
  });
});
```

**Expected:** Each product category uses correct scoring weights that sum to 1000.

### E2E Test 9: API Authorization Matrix

```typescript
describe('Authorization Matrix', () => {
  const endpoints = [
    { method: 'GET', path: '/admin/products', requiredRole: 'settings:read' },
    { method: 'POST', path: '/admin/products', requiredRole: 'settings:write' },
    { method: 'PATCH', path: '/admin/products/:id', requiredRole: 'settings:write' },
    { method: 'DELETE', path: '/admin/products/:id', requiredRole: 'settings:write' },
    { method: 'GET', path: '/admin/device-models', requiredRole: 'settings:read' },
    { method: 'POST', path: '/admin/device-models', requiredRole: 'settings:write' },
    { method: 'GET', path: '/admin/organizations', requiredRole: 'settings:read' },
    { method: 'POST', path: '/admin/organizations', requiredRole: 'settings:write' },
    { method: 'POST', path: '/admin/organizations/:id/import', requiredRole: 'settings:write' },
    { method: 'GET', path: '/admin/organizations/:id/members', requiredRole: 'settings:read' },
  ];

  endpoints.forEach(({ method, path, requiredRole }) => {
    it(`${method} ${path} should require ${requiredRole}`, async () => {
      // Test without token -> 401
      const noAuthResponse = await request(method, path);
      expect(noAuthResponse.status).toBe(401);

      // Test with insufficient role -> 403
      const insufficientResponse = await request(method, path, { token: readOnlyToken });
      if (requiredRole === 'settings:write') {
        expect(insufficientResponse.status).toBe(403);
      }

      // Test with correct role -> 200/201
      const authorizedResponse = await request(method, path, { token: adminToken });
      expect([200, 201]).toContain(authorizedResponse.status);
    });
  });
});
```

**Expected:** All endpoints enforce correct authorization roles.

### E2E Test 10: Data Masking in API Responses

```typescript
describe('Data Masking', () => {
  it('should mask phone numbers in organization member responses', async () => {
    const members = await getMembers(orgId);
    members.data.forEach(member => {
      expect(member.phone_number).toMatch(/\+263\*{4}\d{3}/);
    });
  });

  it('should never return national_id in API responses', async () => {
    const members = await getMembers(orgId);
    members.data.forEach(member => {
      expect(member).not.toHaveProperty('national_id');
      expect(member).not.toHaveProperty('national_id_hash');
    });
  });
});
```

**Expected:** Phone numbers are masked. National IDs (plaintext or hash) are never exposed in API responses.

### E2E Test 11: Frontend Build + Lint

```bash
cd frontend/admin-portal && pnpm build && pnpm lint
```

**Expected:** Frontend builds and passes linting with no errors.

### E2E Test 12: Backend Unit Tests

```bash
pnpm test
```

**Expected:** All unit tests pass across all services with no regressions.

---

*Phase: 9 of 9*
*Depends on: All previous tasks (1-8)*
*Final phase - validates the entire implementation*
