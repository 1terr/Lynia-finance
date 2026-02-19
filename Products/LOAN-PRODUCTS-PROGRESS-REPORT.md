# Loan Product Categories - Implementation Progress Report

**Date**: 2026-02-19
**Status**: In Progress
**Branch**: `master`

---

## Executive Summary

Implementation of the loan product categories feature, enabling Lynia Finance to offer both **smartphone asset financing** and **digital cash loans**. This is a 9-phase project spanning database, backend API, scoring service, frontend, Fineract integration, and testing.

---

## Overall Progress

| Phase | Task | Status | Files |
|-------|------|--------|-------|
| 1 | Database Migration | **Complete** | `database/migrations/028_loan_product_categories.sql` |
| 2 | Backend Product CRUD API | **Complete** | `services/admin-service/src/index.ts` |
| 3 | Template.yaml Routes | Pending | `template.yaml` |
| 4 | Scoring Org Verification | Pending | `services/scoring-service/src/index.ts` |
| 5 | Frontend Types & API Client | Pending | `frontend/admin-portal/src/types/`, `lib/api/` |
| 6 | Frontend Navigation & Pages | Pending | `frontend/admin-portal/src/app/(dashboard)/products/` |
| 7 | Frontend Components | Pending | `frontend/admin-portal/src/components/products/` |
| 8 | Fineract Product Mapping | Pending | `services/scoring-service/src/index.ts` |
| 9 | Integration Testing | Pending | `tests/` |

**Completion: 2 of 9 phases (22%)**

---

## Phase 1: Database Migration - COMPLETE

**File**: `database/migrations/028_loan_product_categories.sql`

### What Was Implemented

#### A. ALTER `loan_products` - 9 New Columns

| Column | Type | Purpose |
|--------|------|---------|
| `product_category` | `VARCHAR(30) NOT NULL DEFAULT 'smartphone'` | Distinguishes smartphone vs digital |
| `min_term_months` | `INTEGER DEFAULT 1` | Lower bound of tenure range |
| `max_term_months` | `INTEGER DEFAULT 12` | Upper bound of tenure range |
| `interest_rate_monthly` | `DECIMAL(5,2)` | Monthly rate for customers |
| `requires_device` | `BOOLEAN NOT NULL DEFAULT FALSE` | Smartphone loans need device |
| `requires_organization_verification` | `BOOLEAN NOT NULL DEFAULT FALSE` | Digital loans need org verification |
| `allowed_disbursement_methods` | `JSONB DEFAULT '["ecocash"]'` | Payment methods for disbursement |
| `max_active_loans` | `INTEGER NOT NULL DEFAULT 1` | Concurrent loan limit |
| `display_order` | `INTEGER DEFAULT 0` | UI sort order |

**Indexes**: `idx_loan_products_category`, `idx_loan_products_display_order`

#### B. CREATE `device_models` Table

Phone catalog with brand-based pricing. Key columns:
- `model_code` (UNIQUE) - prevents duplicate entries
- `retail_price_usd`, `wholesale_price_usd` - pricing at model level
- `min_deposit_percentage`, `max_term_months` - nullable overrides (NULL = use product default)
- `available_stock` - denormalized stock count
- Soft delete via `deleted_at`

**Indexes**: `idx_device_models_brand`, `idx_device_models_active`, `idx_device_models_device_type`

#### C. ALTER `devices` - Link to Model Catalog

- Added `device_model_id UUID REFERENCES device_models(id)` (nullable FK)
- **Index**: `idx_devices_device_model`

#### D. CREATE `organizations` Table

Scoring source organizations with:
- `org_code` (UNIQUE), `org_name`, `org_type`
- `scoring_trust_level` (0-100 with CHECK constraint)
- `api_credentials_secret` - AWS Secrets Manager key name (never stores credentials directly)
- Soft delete via `deleted_at`

**Indexes**: `idx_organizations_org_code`, `idx_organizations_org_type`, `idx_organizations_active`

#### E. CREATE `organization_members` Table

Member data for employment-based credit scoring:
- `national_id_hash` (SHA-256) - privacy-preserving lookups
- `phone_number` - for customer matching
- Employment details: `employment_status`, `department`, `grade_level`, `monthly_salary_usd`
- `customer_id` FK - linked when matched to existing customer

**Indexes**: `idx_org_members_organization`, `idx_org_members_national_id_hash`, `idx_org_members_phone`, `idx_org_members_customer`, `idx_org_members_import_batch`

#### F. ALTER `loans` - 3 New Columns

| Column | Type | Purpose |
|--------|------|---------|
| `product_category` | `VARCHAR(30)` | Denormalized for query performance |
| `organization_id` | `UUID REFERENCES organizations(id)` | Verifying organization for digital loans |
| `disbursement_method` | `VARCHAR(30)` | How value was delivered |

**Indexes**: `idx_loans_product_category`, `idx_loans_organization`, `idx_loans_disbursement_method`

#### G. Seed Data

| Record | Details |
|--------|---------|
| `SMRT_FIN_001` (updated) | `product_category='smartphone'`, `requires_device=TRUE`, 3-12 month tenure, 1% monthly rate |
| `DIGI_LOAN_001` (new) | `product_category='digital'`, `requires_organization_verification=TRUE`, 1-6 month tenure, 2% monthly rate, disbursement via EcoCash/OneMoney/InnBucks |
| `GOV_CSC` (new org) | Civil Service Commission, government, trust level 90 |
| `GOV_ZRP` (new org) | Zimbabwe Republic Police, government, trust level 85 |
| `ORG_ECONET` (new org) | Econet Wireless Zimbabwe, corporate, trust level 70 |

#### Idempotency

- All DDL uses `IF NOT EXISTS` guards
- Seed inserts use `ON CONFLICT (unique_column) DO NOTHING`
- UPDATE for `SMRT_FIN_001` is naturally idempotent
- Safe to run multiple times without errors

---

## Phase 2: Backend Product CRUD API - COMPLETE

**File**: `services/admin-service/src/index.ts`

### Endpoints Implemented

#### Product CRUD (5 endpoints)

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/admin/products` | `handleGetProducts` - List with filter/search/pagination |
| `GET` | `/admin/products/{id}` | `handleGetProductById` - Single product detail |
| `POST` | `/admin/products` | `handleCreateProduct` - Create with validation |
| `PATCH` | `/admin/products/{id}` | `handleUpdateProduct` - Partial update |
| `DELETE` | `/admin/products/{id}` | `handleDeleteProduct` - Soft delete with safety check |

#### Device Model CRUD (5 endpoints)

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/admin/device-models` | `handleGetDeviceModels` - List with brand filter |
| `GET` | `/admin/device-models/{id}` | `handleGetDeviceModelById` - Single model detail |
| `POST` | `/admin/device-models` | `handleCreateDeviceModel` - Create with validation |
| `PATCH` | `/admin/device-models/{id}` | `handleUpdateDeviceModel` - Partial update |
| `DELETE` | `/admin/device-models/{id}` | `handleDeleteDeviceModel` - Soft delete |

#### Organization CRUD + Members (6 endpoints)

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/admin/organizations` | `handleGetOrganizations` - List all orgs |
| `GET` | `/admin/organizations/{id}` | `handleGetOrganizationById` - Org with member count |
| `POST` | `/admin/organizations` | `handleCreateOrganization` - Create with validation |
| `PATCH` | `/admin/organizations/{id}` | `handleUpdateOrganization` - Partial update |
| `POST` | `/admin/organizations/{id}/import` | `handleImportOrgMembers` - CSV-to-JSON bulk import |
| `GET` | `/admin/organizations/{id}/members` | `handleGetOrgMembers` - List with masked phone numbers |

### Key Implementation Details

- **Authorization**: All endpoints require Cognito JWT + `isAdminOrManager` check
- **Privacy**: Phone numbers masked in member list responses (`+263****567`)
- **Security**: National IDs hashed with SHA-256 via `createHash('sha256')` before storage
- **Audit**: All write operations log to `audit_logs` table
- **Validation**: Product code format, numeric ranges, category-specific rules
- **Safety**: Product delete blocked if active/approved/disbursed loans exist

---

## Remaining Phases

### Phase 3: Template.yaml Routes (Next)
Add ~16 API Gateway event sources to `AdminFunction` in `template.yaml` for all new endpoints.

### Phase 4: Scoring Org Verification
Add 6th scoring component (200 pts) for organization verification in `scoring-service`. Redistribute weights for digital loans.

### Phase 5: Frontend Types & API Client
Add TypeScript interfaces and API client functions for products, device models, and organizations.

### Phase 6: Frontend Navigation & Pages
Add "Products" to sidebar navigation. Create overview page, device models sub-page, and organizations sub-page.

### Phase 7: Frontend Components
Build product cards, create/edit forms, device model forms, organization forms, and CSV import modal.

### Phase 8: Fineract Product Mapping
Fix hardcoded tier-to-product mapping to use database-driven lookup. Create digital loan Fineract products.

### Phase 9: Integration Testing
End-to-end tests for smartphone loan flow and digital loan flow including org verification.

---

## Technical Notes

### Migration Conventions Followed
- `gen_random_uuid()` for UUID defaults (current project convention)
- `TIMESTAMPTZ` for timestamp columns
- `COMMENT ON TABLE/COLUMN` for documentation
- All operations idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- No RLS (removed per AWS RDS migration - `aws/018_remove_rls_for_aws.sql`)

### Database Tables Summary

| Table | Type | Records |
|-------|------|---------|
| `loan_products` | Altered (9 new columns) | 2 products (1 updated, 1 new) |
| `device_models` | Created | 0 (populated via admin portal) |
| `devices` | Altered (1 new FK column) | Existing data unchanged |
| `organizations` | Created | 3 seed organizations |
| `organization_members` | Created | 0 (populated via CSV import) |
| `loans` | Altered (3 new columns) | Existing data unchanged |

---

*Report generated: February 19, 2026*
*Implementation by: Claude Code (AI-assisted development)*
