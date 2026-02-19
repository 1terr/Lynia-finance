# Task 2: Backend Product CRUD API (Phase 2)

## Overview

Add product management, device model, and organization CRUD endpoints to the existing Admin Service Lambda (`services/admin-service/src/index.ts`).

## Dependencies

- **Task 1** (Database Migration) must be completed first

## Key Files

| File | Action |
|------|--------|
| `services/admin-service/src/index.ts` | **Modify** - Add ~12 route handlers |

## What to Implement

### 2.1 Product CRUD Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/admin/products` | List all products (filterable) | `settings:read` |
| `GET` | `/admin/products/{id}` | Get product detail | `settings:read` |
| `POST` | `/admin/products` | Create new product | `settings:write` |
| `PATCH` | `/admin/products/{id}` | Update product | `settings:write` |
| `DELETE` | `/admin/products/{id}` | Soft-delete product | `settings:write` |

**GET /admin/products** query parameters:
- `?category=smartphone|digital`
- `?status=active|inactive|launching_soon`
- `?search=keyword`
- `?page=1&limit=25`

**POST /admin/products** validation rules:
- `product_code` must be unique, alphanumeric with underscores, max 50 chars
- `product_category` must be `smartphone` or `digital`
- If `smartphone`: `requires_device` must be true, `deposit_percentage` > 0
- If `digital`: `deposit_percentage` = 0, `requires_organization_verification` = true
- `min_term_months` < `max_term_months`
- `min_amount_usd` < `max_amount_usd`
- `interest_rate_monthly` and `interest_rate_annual` > 0

**DELETE /admin/products/{id}** safety:
- Cannot delete if product has loans in `active`, `disbursed`, or `approved` status
- Sets `deleted_at = NOW()` (soft delete)

### 2.2 Device Model Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/admin/device-models` | List device models | `settings:read` |
| `GET` | `/admin/device-models/{id}` | Get model detail | `settings:read` |
| `POST` | `/admin/device-models` | Create model entry | `settings:write` |
| `PATCH` | `/admin/device-models/{id}` | Update model | `settings:write` |
| `DELETE` | `/admin/device-models/{id}` | Soft-delete model | `settings:write` |

**GET /admin/device-models** query parameters:
- `?brand=Samsung`
- `?is_active=true`
- `?search=keyword`
- `?page=1&limit=25`

### 2.3 Organization Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/admin/organizations` | List organizations | `settings:read` |
| `GET` | `/admin/organizations/{id}` | Get org with member count | `settings:read` |
| `POST` | `/admin/organizations` | Create organization | `settings:write` |
| `PATCH` | `/admin/organizations/{id}` | Update organization | `settings:write` |
| `POST` | `/admin/organizations/{id}/import` | Import members (CSV->JSON) | `settings:write` |
| `GET` | `/admin/organizations/{id}/members` | List members (masked) | `settings:read` |

**POST /admin/organizations/{id}/import** processing:
1. Validate each member record
2. Hash `national_id` with SHA-256 before storage
3. Bulk insert into `organization_members`
4. Try to match `phone_number` against `customers.phone_number` and set `customer_id`
5. Update `organizations.total_members` count
6. Return import summary: total, inserted, skipped (duplicates), errors

### 2.4 Route Handler Pattern

Follow the existing admin service pattern:
1. Parse path with regex matching
2. Extract auth context from Cognito JWT
3. Check permissions (`isAdminOrManager`)
4. Execute database operation via `db.from()` or `query()`
5. Write audit log entry
6. Return `successResponse()` or `errorResponse()`

---

## Tests

### Test 1: Product CRUD - List Products

```bash
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/admin/products | jq
```

**Expected:** Returns JSON array of products with `SMRT_FIN_001` and `DIGI_LOAN_001`. Response includes pagination metadata.

### Test 2: Product CRUD - Filter by Category

```bash
curl -s -H "Authorization: Bearer $TOKEN" "localhost:3000/admin/products?category=smartphone" | jq
```

**Expected:** Returns only smartphone products (`SMRT_FIN_001`).

### Test 3: Product CRUD - Create Product

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  localhost:3000/admin/products \
  -d '{"product_code":"TEST_PROD_001","product_name":"Test Product","product_category":"smartphone","product_type":"asset_financing","min_amount_usd":50,"max_amount_usd":500,"min_term_months":3,"max_term_months":12,"interest_rate_monthly":5,"interest_rate_annual":60,"deposit_percentage":10,"requires_device":true}' | jq
```

**Expected:** Returns created product with UUID, status 201.

### Test 4: Product CRUD - Validation Errors

```bash
# Missing required field
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/products \
  -d '{"product_code":""}' | jq
```

**Expected:** Returns 400 with validation error code `VAL_REQ_001`.

### Test 5: Product CRUD - Update Product

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/products/{id} \
  -d '{"status":"inactive"}' | jq
```

**Expected:** Returns updated product with `status: "inactive"`.

### Test 6: Product CRUD - Soft Delete Safety Check

```bash
# Attempt to delete product with active loans
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/products/{id-with-active-loans} | jq
```

**Expected:** Returns 400 with error "Cannot delete product with active loans".

### Test 7: Device Model CRUD - List Models

```bash
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/admin/device-models | jq
```

**Expected:** Returns JSON array of device models with brand, model, pricing.

### Test 8: Device Model CRUD - Create Model

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/device-models \
  -d '{"brand":"Samsung","model_name":"Galaxy A14","model_code":"SAM_A14_64","storage_gb":64,"ram_gb":4,"retail_price_usd":199,"wholesale_price_usd":145}' | jq
```

**Expected:** Returns created device model with UUID, status 201.

### Test 9: Device Model CRUD - Duplicate Model Code

```bash
# Create same model_code twice
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/device-models \
  -d '{"brand":"Samsung","model_name":"Galaxy A14","model_code":"SAM_A14_64","retail_price_usd":199,"wholesale_price_usd":145}' | jq
```

**Expected:** Second request returns 409 conflict error.

### Test 10: Organization CRUD - Create Organization

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/organizations \
  -d '{"org_code":"TEST_ORG","org_name":"Test Organization","org_type":"corporate","scoring_trust_level":65}' | jq
```

**Expected:** Returns created organization with UUID, status 201.

### Test 11: Organization - Import Members

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/organizations/{id}/import \
  -d '{"members":[{"national_id":"12345678A90","phone_number":"+263771234567","employee_number":"EMP001","employment_status":"active","department":"Education","grade_level":"Grade 7","monthly_salary_usd":450}]}' | jq
```

**Expected:** Returns import summary with `total: 1, inserted: 1, skipped: 0, errors: 0`. National ID is stored as SHA-256 hash.

### Test 12: Organization - List Members (Masked)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  localhost:3000/admin/organizations/{id}/members | jq
```

**Expected:** Phone numbers are masked (`+263****567`). National IDs are not returned in response.

### Test 13: Authorization - Unauthorized Access

```bash
# Request without token
curl -s localhost:3000/admin/products | jq
```

**Expected:** Returns 401 Unauthorized.

### Test 14: Authorization - Insufficient Permissions

```bash
# Request with read-only user trying to write
curl -s -X POST -H "Authorization: Bearer $READ_ONLY_TOKEN" \
  localhost:3000/admin/products \
  -d '{"product_code":"FAIL"}' | jq
```

**Expected:** Returns 403 Forbidden.

### Test 15: Audit Logging

After any create/update/delete operation, verify an audit log entry was created:

```sql
SELECT * FROM audit_logs WHERE action LIKE 'product%' ORDER BY created_at DESC LIMIT 5;
```

**Expected:** Audit entries exist for each CRUD operation with user ID, action, and timestamp.

---

*Phase: 2 of 9*
*Depends on: Task 1 (Database Migration)*
*Blocks: Tasks 3, 5, 6, 7*
