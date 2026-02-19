# Task 1: Database Migration (Phase 1)

## Overview

Create migration `028_loan_product_categories.sql` to add all new tables and columns required for loan product categories.

## Dependencies

- None (this is the foundation for all other tasks)

## Key Files

| File | Action |
|------|--------|
| `database/migrations/028_loan_product_categories.sql` | **Create** |

## What to Implement

### A. ALTER `loan_products` - Add Configuration Fields

Add the following columns to enable admin-configurable products:

| Column | Type | Purpose |
|--------|------|---------|
| `product_category` | `VARCHAR(30) NOT NULL DEFAULT 'smartphone'` | Distinguishes 'smartphone' from 'digital' |
| `min_term_months` | `INTEGER DEFAULT 1` | Lower bound of tenure range |
| `max_term_months` | `INTEGER DEFAULT 12` | Upper bound of tenure range |
| `interest_rate_monthly` | `DECIMAL(5,2)` | Monthly rate displayed to customers |
| `requires_device` | `BOOLEAN NOT NULL DEFAULT FALSE` | Smartphone loans require device assignment |
| `requires_organization_verification` | `BOOLEAN NOT NULL DEFAULT FALSE` | Digital loans require org member lookup |
| `allowed_disbursement_methods` | `JSONB DEFAULT '["ecocash"]'` | Payment methods for disbursement |
| `max_active_loans` | `INTEGER NOT NULL DEFAULT 1` | Max concurrent loans per customer |
| `display_order` | `INTEGER DEFAULT 0` | Sort order in admin portal and WhatsApp listing |

### B. CREATE `device_models` Table

Phone catalog with brand-based pricing:

- `id` (UUID PK), `brand`, `model_name`, `model_code` (UNIQUE)
- `storage_gb`, `ram_gb`, `screen_size_inches`, `device_type`
- `retail_price_usd`, `wholesale_price_usd`
- `min_deposit_percentage` (nullable - NULL = use product default)
- `max_term_months` (nullable - NULL = use product default)
- `is_active`, `available_stock`, `image_url`
- `created_at`, `updated_at`, `deleted_at` (soft delete)

### C. ALTER `devices` - Link to Model Catalog

- Add `device_model_id UUID REFERENCES device_models(id)` (nullable FK)

### D. CREATE `organizations` Table

Scoring source organizations:

- `id` (UUID PK), `org_code` (UNIQUE), `org_name`, `org_type`
- `verification_method`, `api_endpoint`, `api_credentials_secret`
- `scoring_trust_level` (0-100), contact fields
- `is_active`, `total_members`, `last_data_import_at`
- `created_at`, `updated_at`, `deleted_at`

### E. CREATE `organization_members` Table

Member data for credit scoring:

- `id` (UUID PK), `organization_id` (FK), `national_id_hash` (SHA-256)
- `phone_number`, `employee_number`, `employment_status`
- `employment_start_date`, `department`, `grade_level`
- `monthly_salary_usd`, `salary_verified`
- `import_batch_id`, `data_source`, `customer_id` (FK to customers)
- `created_at`, `updated_at`

### F. ALTER `loans` - Category Tracking

- Add `product_category VARCHAR(30)` (denormalized for query performance)
- Add `organization_id UUID REFERENCES organizations(id)` (for digital loans)
- Add `disbursement_method VARCHAR(30)` (how value was delivered)

### G. Seed Data

- Update `SMRT_FIN_001` with new category fields
- Insert `DIGI_LOAN_001` (Digital Cash Loan) product
- Insert sample organizations (Civil Service Commission, Zimbabwe Republic Police, Econet Wireless)

---

## Tests

### Test 1: Migration Execution

```bash
# Run migration
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
```

**Expected:** Migration runs without errors.

### Test 2: Table Existence Verification

```bash
psql -c "\dt device_models"
psql -c "\dt organizations"
psql -c "\dt organization_members"
```

**Expected:** All three new tables exist.

### Test 3: Column Additions Verification

```bash
psql -c "\d loan_products"   -- Verify new columns added
psql -c "\d loans"            -- Verify new columns added
psql -c "\d devices"          -- Verify device_model_id FK added
```

**Expected:**
- `loan_products` has: `product_category`, `min_term_months`, `max_term_months`, `interest_rate_monthly`, `requires_device`, `requires_organization_verification`, `allowed_disbursement_methods`, `max_active_loans`, `display_order`
- `loans` has: `product_category`, `organization_id`, `disbursement_method`
- `devices` has: `device_model_id`

### Test 4: Seed Data Verification

```bash
psql -c "SELECT product_code, product_category, requires_device, requires_organization_verification FROM loan_products"
```

**Expected:**
- `SMRT_FIN_001` row with `product_category='smartphone'`, `requires_device=TRUE`
- `DIGI_LOAN_001` row with `product_category='digital'`, `requires_organization_verification=TRUE`

### Test 5: Organization Seed Data

```bash
psql -c "SELECT org_code, org_name, org_type, scoring_trust_level FROM organizations"
```

**Expected:** 3 rows (GOV_CSC, GOV_ZRP, ORG_ECONET) with correct trust levels (90, 85, 70).

### Test 6: Constraint Validation

```sql
-- Verify model_code uniqueness
INSERT INTO device_models (brand, model_name, model_code, retail_price_usd, wholesale_price_usd)
VALUES ('Test', 'Test', 'TEST_001', 100, 80);
INSERT INTO device_models (brand, model_name, model_code, retail_price_usd, wholesale_price_usd)
VALUES ('Test', 'Test2', 'TEST_001', 100, 80);  -- Should fail: duplicate model_code
```

**Expected:** Second insert fails with unique constraint violation.

### Test 7: Foreign Key Integrity

```sql
-- Verify organization_members.organization_id FK
INSERT INTO organization_members (organization_id, phone_number)
VALUES ('00000000-0000-0000-0000-000000000000', '+263771234567');  -- Non-existent org
```

**Expected:** Insert fails with foreign key violation.

### Test 8: Idempotency

```bash
# Run migration twice
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
```

**Expected:** Second run completes without errors (uses `IF NOT EXISTS` / `IF NOT EXISTS` guards).

---

*Phase: 1 of 9*
*Blocks: All subsequent phases*
