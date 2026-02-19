# Task 5: Frontend Types + API Client (Phase 5)

## Overview

Add TypeScript type definitions for loan products, device models, organizations, and organization members. Create the API client module with functions for all CRUD operations.

## Dependencies

- **Task 2** (Backend Product CRUD API) must be completed first

## Key Files

| File | Action |
|------|--------|
| `frontend/admin-portal/src/types/index.ts` | **Modify** - Add new interfaces |
| `frontend/admin-portal/src/lib/api/products.ts` | **Create** - API client functions |

## What to Implement

### 5.1 TypeScript Type Definitions

Add to `frontend/admin-portal/src/types/index.ts`:

```typescript
// Loan Product types
interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_type: 'asset_financing' | 'digital_credit';
  product_category: 'smartphone' | 'digital';
  status: 'active' | 'inactive' | 'launching_soon';
  min_amount_usd: number;
  max_amount_usd: number;
  loan_term_months: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate_annual: number;
  interest_rate_monthly: number;
  deposit_percentage: number;
  min_deposit_usd: number;
  requires_device: boolean;
  requires_organization_verification: boolean;
  allowed_disbursement_methods: string[];
  max_active_loans: number;
  display_order: number;
  description?: string;
  scoring_config?: Record<string, unknown>;
  fineract_product_id?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Device Model types
interface DeviceModel {
  id: string;
  brand: string;
  model_name: string;
  model_code: string;
  storage_gb?: number;
  ram_gb?: number;
  screen_size_inches?: number;
  device_type: string;
  retail_price_usd: number;
  wholesale_price_usd: number;
  min_deposit_percentage?: number;
  max_term_months?: number;
  is_active: boolean;
  available_stock: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Organization types
interface Organization {
  id: string;
  org_code: string;
  org_name: string;
  org_type: 'government' | 'corporate' | 'cooperative' | 'ngo';
  verification_method: 'excel_upload' | 'api';
  api_endpoint?: string;
  scoring_trust_level: number;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  total_members: number;
  last_data_import_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Organization Member types
interface OrganizationMember {
  id: string;
  organization_id: string;
  phone_number: string;        // Masked in API responses
  employee_number?: string;
  employment_status: 'active' | 'retired' | 'suspended';
  employment_start_date?: string;
  department?: string;
  grade_level?: string;
  salary_verified: boolean;
  import_batch_id?: string;
  is_active: boolean;
  customer_id?: string;
  created_at: string;
  updated_at: string;
}

// Import result type
interface MemberImportResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: number;
  error_details?: Array<{ row: number; message: string }>;
}
```

### 5.2 API Client Functions

Create `frontend/admin-portal/src/lib/api/products.ts`:

```typescript
// Product CRUD
getProducts(params?: { category?, status?, search?, page?, limit? }): Promise<PaginatedResponse<LoanProduct>>
getProduct(id: string): Promise<LoanProduct>
createProduct(data: CreateProductInput): Promise<LoanProduct>
updateProduct(id: string, data: Partial<LoanProduct>): Promise<LoanProduct>
deleteProduct(id: string): Promise<void>

// Device Model CRUD
getDeviceModels(params?: { brand?, is_active?, search?, page?, limit? }): Promise<PaginatedResponse<DeviceModel>>
getDeviceModel(id: string): Promise<DeviceModel>
createDeviceModel(data: CreateDeviceModelInput): Promise<DeviceModel>
updateDeviceModel(id: string, data: Partial<DeviceModel>): Promise<DeviceModel>
deleteDeviceModel(id: string): Promise<void>

// Organization CRUD
getOrganizations(params?: { search?, page?, limit? }): Promise<PaginatedResponse<Organization>>
getOrganization(id: string): Promise<Organization>
createOrganization(data: CreateOrganizationInput): Promise<Organization>
updateOrganization(id: string, data: Partial<Organization>): Promise<Organization>
importMembers(orgId: string, members: MemberImportInput[]): Promise<MemberImportResult>
getMembers(orgId: string, params?: { page?, limit? }): Promise<PaginatedResponse<OrganizationMember>>
```

Follow the existing API client patterns used in the admin portal (auth headers, error handling, base URL configuration).

---

## Tests

### Test 1: TypeScript Compilation

```bash
cd frontend/admin-portal && npx tsc --noEmit
```

**Expected:** No TypeScript compilation errors. All new types compile correctly.

### Test 2: Type Correctness - LoanProduct

```typescript
// Verify type enforces required fields
const product: LoanProduct = {
  id: 'uuid',
  product_code: 'TEST',
  product_name: 'Test',
  product_type: 'asset_financing',
  product_category: 'smartphone',
  status: 'active',
  // ... all required fields
};
// Should compile without errors
```

**Expected:** Type correctly enforces all required fields and rejects invalid values.

### Test 3: Type Correctness - Product Category Enum

```typescript
// This should cause a type error:
const bad: LoanProduct = { product_category: 'invalid' };  // Error!
```

**Expected:** TypeScript rejects invalid `product_category` values.

### Test 4: API Client - getProducts Returns Correct Type

```typescript
describe('products API client', () => {
  it('getProducts returns paginated response', async () => {
    const result = await getProducts({ category: 'smartphone' });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(Array.isArray(result.data)).toBe(true);
  });
});
```

**Expected:** API client function returns properly typed paginated response.

### Test 5: API Client - Error Handling

```typescript
it('handles 401 unauthorized error', async () => {
  // Mock expired token scenario
  await expect(getProducts()).rejects.toThrow();
});
```

**Expected:** API client throws appropriate error for unauthorized requests.

### Test 6: API Client - Import Members Function

```typescript
it('importMembers sends correct payload', async () => {
  const members = [
    { national_id: '12345678A90', phone_number: '+263771234567', employee_number: 'EMP001', employment_status: 'active' }
  ];
  const result = await importMembers('org-uuid', members);
  expect(result).toHaveProperty('total');
  expect(result).toHaveProperty('inserted');
  expect(result).toHaveProperty('skipped');
  expect(result).toHaveProperty('errors');
});
```

**Expected:** Import function sends correct JSON payload and returns import summary.

### Test 7: Build Verification

```bash
cd frontend/admin-portal && pnpm build
```

**Expected:** Build succeeds without errors. No unused imports or type warnings.

---

*Phase: 5 of 9*
*Depends on: Task 2 (Backend Product CRUD API)*
*Blocks: Tasks 6, 7*
