# Lynia Finance - Loan Product Categories Implementation Plan

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context & Problem Statement](#2-business-context--problem-statement)
3. [Product Category Definitions](#3-product-category-definitions)
4. [Current Architecture Analysis](#4-current-architecture-analysis)
5. [Architecture Decisions](#5-architecture-decisions)
6. [Database Design](#6-database-design)
7. [Backend API Design](#7-backend-api-design)
8. [Credit Scoring Enhancements](#8-credit-scoring-enhancements)
9. [Fineract Core Banking Integration](#9-fineract-core-banking-integration)
10. [Admin Portal Frontend Design](#10-admin-portal-frontend-design)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [Security & Privacy Considerations](#12-security--privacy-considerations)
13. [Implementation Sequence](#13-implementation-sequence)
14. [Verification & Testing Plan](#14-verification--testing-plan)
15. [Files to Create & Modify](#15-files-to-create--modify)

---

## 1. Executive Summary

This document outlines the complete plan for introducing **two loan product categories** into the Lynia Finance platform:

| Category | What It Is | How Customer Gets Value | How We Manage Risk |
|---|---|---|---|
| **Smartphone Loans** | Asset-backed device financing | Customer receives a physical phone after paying a deposit, then repays monthly | Device lock via Trustonic if customer misses payments |
| **Digital Loans** | Cash loans via mobile money | Customer receives cash directly to their EcoCash/OneMoney wallet | Scoring based on verified employment (civil servant, corporate employee) |

Both products will be fully configurable from a new **"Products" section** in the admin portal, allowing Lynia operations staff to:

- Create and manage loan products by category
- Configure interest rates, tenure limits, and deposit requirements
- Manage a device model catalog with brand-based pricing (for smartphone loans)
- Register scoring organizations and import member data (for digital loans)
- Set per-device-model overrides for deposit percentage and maximum tenure

---

## 2. Business Context & Problem Statement

### Why This Matters

Lynia Finance serves Zimbabwe's underbanked majority - the 80% informal workforce who lack traditional credit access. Currently, the platform has only **one loan product** (`SMRT_FIN_001` - Smartphone Financing) hardcoded into the system. This limits Lynia's ability to:

1. **Serve different customer segments** - A civil servant with a steady salary has very different needs than an informal trader needing a phone for their business
2. **Price risk accurately** - A government employee with verified income is a lower credit risk than an unverified customer, yet both get the same interest rate
3. **Scale product offerings** - Adding new products requires developer intervention instead of admin configuration
4. **Manage device inventory by brand** - Different phone brands (Samsung, Tecno, Itel) have different prices, margins, and risk profiles, but there's no catalog to manage this

### What We're Solving

| Problem | Solution |
|---|---|
| Single hardcoded product | Configurable product categories in admin portal |
| No brand-based pricing management | Device model catalog with retail/wholesale prices |
| One-size-fits-all credit scoring | Organization-based scoring for verified employees |
| No cash loan product | Digital loans disbursed via EcoCash |
| Developer-dependent configuration | Admin-managed product settings |

### Target Users

**Smartphone Loan Customers:**
- Small business owners needing a phone for mobile money transactions
- Young professionals buying their first smartphone
- Parents buying devices for educational purposes
- Risk mitigation: device can be locked if payments stop

**Digital Loan Customers:**
- Civil servants (teachers, police, nurses, government workers) with verified employment
- Corporate employees of registered organizations (Econet, Delta, etc.)
- Members of cooperatives or NGOs with data-sharing agreements
- Risk mitigation: verified salary/employment serves as creditworthiness signal

---

## 3. Product Category Definitions

### 3.1 Smartphone Loans

**How it works (customer journey):**

```
1. Customer contacts Lynia via WhatsApp
2. Customer completes KYC (ID verification, face match)
3. Customer browses available phone models and selects one
4. Credit score is calculated using the existing 5-component model
5. If approved: customer pays deposit (% of phone retail price)
6. Customer chooses repayment tenure (e.g., 3, 6, 9, or 12 months)
7. Device is handed over to customer (existing handover workflow)
8. Customer makes monthly repayments via EcoCash/OneMoney
9. If customer misses payments: device is locked after grace period
10. When fully paid: device is unlocked permanently
```

**Configurable parameters (set in admin portal):**

| Parameter | Example Values | Where Configured |
|---|---|---|
| Deposit percentage | 10%, 15%, 20% | Per product (or per device model override) |
| Minimum deposit amount (USD) | $20, $30, $50 | Per product |
| Interest rate (monthly) | 3%, 4%, 5% | Per product |
| Interest rate (annual) | 36%, 48%, 60% | Per product |
| Minimum tenure | 3 months | Per product |
| Maximum tenure | 12 months | Per product (or per device model override) |
| Minimum loan amount | $50 | Per product |
| Maximum loan amount | $500 | Per product |
| Device retail price | $89 (Itel A60), $199 (Samsung A14) | Per device model |
| Device wholesale price | $65 (Itel A60), $145 (Samsung A14) | Per device model |

**Example loan calculation:**

```
Customer selects: Samsung Galaxy A14 (Retail: $199)
Product config: 10% deposit, 5% monthly interest, 6-month tenure

Deposit:        $199 x 10%     = $19.90
Loan principal: $199 - $19.90  = $179.10
Total interest: $179.10 x 5% x 6 months = $53.73
Total repayable: $179.10 + $53.73 = $232.83
Monthly payment: $232.83 / 6 = $38.81
```

### 3.2 Digital Loans

**How it works (customer journey):**

```
1. Customer contacts Lynia via WhatsApp
2. Customer completes KYC (ID verification, face match)
3. Customer's phone number is checked against organization member database
4. If found: organization verification data feeds into credit scoring
5. Enhanced credit score calculated (6-component model including org verification)
6. If approved: customer chooses loan amount and tenure
7. Cash is disbursed directly to customer's EcoCash wallet
8. Customer makes monthly repayments via EcoCash/OneMoney/InnBucks
9. No device lock available - risk managed through employment verification
```

**Configurable parameters (set in admin portal):**

| Parameter | Example Values | Where Configured |
|---|---|---|
| Interest rate (monthly) | 2.5%, 3%, 3.5% | Per product |
| Interest rate (annual) | 30%, 36%, 42% | Per product |
| Minimum tenure | 1 month | Per product |
| Maximum tenure | 6 months | Per product |
| Minimum loan amount | $20 | Per product |
| Maximum loan amount | $500 | Per product |
| Disbursement methods | EcoCash, OneMoney, InnBucks | Per product |
| Requires organization verification | Yes/No | Per product |
| Organization trust level | 0-100 | Per organization |

**Organization scoring sources:**

| Organization | Type | Trust Level | Verification Method | Example Members |
|---|---|---|---|---|
| Civil Service Commission | Government | 90 | Excel upload | Teachers, nurses, clerks |
| Zimbabwe Republic Police | Government | 85 | Excel upload | Police officers |
| Econet Wireless | Corporate | 70 | API | Telecom employees |
| Delta Corporation | Corporate | 65 | Excel upload | Manufacturing workers |
| Agricultural cooperative | Cooperative | 50 | Excel upload | Farmers |

**Example loan calculation:**

```
Customer: Teacher verified via Civil Service Commission
Product config: 3% monthly interest, 3-month tenure

Loan amount:    $200 (approved based on credit score)
Total interest: $200 x 3% x 3 months = $18.00
Total repayable: $200 + $18.00 = $218.00
Monthly payment: $218.00 / 3 = $72.67
Disbursed to:   Customer's EcoCash wallet
```

---

## 4. Current Architecture Analysis

### 4.1 What Already Exists (and will be reused)

**Database (`loan_products` table - migration 001):**
The `loan_products` table already has most fields we need:
- `product_code`, `product_name`, `product_type` ('asset_financing' / 'digital_credit')
- `status` ('active' / 'inactive' / 'launching_soon')
- `min_amount_usd`, `max_amount_usd`, `loan_term_months`
- `interest_rate_annual`, `deposit_percentage`, `min_deposit_usd`
- `scoring_config` (JSONB), `fineract_product_id`
- Only ONE product seeded: `SMRT_FIN_001` (Smartphone Financing)

**What's missing:** `product_category`, `min_term_months`, `max_term_months`, `interest_rate_monthly`, `requires_device`, `requires_organization_verification`, `allowed_disbursement_methods`

**Database (`devices` table - migration 001):**
Individual device tracking already exists with: `imei`, `brand`, `model`, `storage_capacity`, `color`, `retail_price`, `wholesale_price`, `status`, `customer_id`, `loan_id`, `lock_status`, `trustonic_device_id`

**What's missing:** A `device_models` catalog table for managing pricing/specs at the model level (not individual unit level). Also missing `device_model_id` FK on `devices`.

**Database (`loans` table - migration 001):**
Full loan lifecycle: `customer_id`, `product_id`, `loan_amount_usd`, `interest_rate`, `loan_term_months`, `deposit_amount_usd`, `status`, repayment tracking, delinquency tracking.

**What's missing:** `product_category`, `organization_id`, `disbursement_method`

**Scoring Service (`services/scoring-service/src/index.ts`):**
5-component rule-based model (1000 raw points, scaled to 300-850):
1. Affordability (30% = 300 pts) - DTI ratio, income level
2. Repayment Willingness (25% = 250 pts) - Payment history, bill consistency
3. Mobile Money Activity (20% = 200 pts) - Account age, inflow, frequency
4. External Credit (15% = 150 pts) - Bureau score, platform verification
5. KYC Verification (10% = 100 pts) - ID document, face match, liveness

Decision tiers after scoring:
- 750+ -> Tier 3: $500 limit, 5% down, 10% APR
- 700-749 -> Tier 2: $350 limit, 10% down, 12% APR
- 650-699 -> Tier 1: $200 limit, 10% down, 15% APR
- 550-649 -> Manual Review
- <550 -> Rejected

**What's missing:** Organization verification component for digital loans

**Payment Service (`services/payment-service/`):**
Full mobile money integration: EcoCash, OneMoney, O'mari, InnBucks. Two-phase payment flow (PREPARE/COMMIT/RELEASE). Webhook handling, reconciliation.

**Already supports digital loan disbursement** - we just need to route digital loans through the existing payment initiation flow.

**Lock Service (`services/lock-service/`):**
Full Trustonic device lock/unlock. Automated lock after 7 days overdue + 3-day grace period. Complete handover workflow (readiness check, identity verification, deposit verification, device inspection, completion).

**Already fully supports smartphone loans** - no changes needed.

**Fineract Core Banking (`services/shared/clients/fineract.ts`):**
Full typed client with: `createLoanProduct()`, `listLoanProducts()`, `getLoanProduct()`, `createLoan()`, `approveLoan()`, `disburseLoan()`, `postRepayment()`.

3 existing Fineract loan products (credit-score tiered):
- Tier 1 (Entry): $50-200, 5% monthly, credit score 350-499
- Tier 2 (Standard): $200-500, 4% monthly, credit score 500-649
- Tier 3 (Premium): $500-2000, 3% monthly, credit score 650+

21 GL accounts already configured for accrual-based accounting.

**Sync is non-blocking** - if Fineract is down, business continues. Failed syncs are retried via SQS queue.

**Admin Portal (`frontend/admin-portal/`):**
Next.js 14, App Router, Tailwind CSS, Zustand (auth), React Query (server state), custom UI components (Button, Badge, Card, DataTable, Modal, Tabs, Input, Select, Pagination).

Existing `/fineract/products` page is **read-only** - just displays Fineract products. No CRUD forms exist for product management.

### 4.2 Architecture Diagram (Current State)

```
                          Admin Portal (Next.js)
                                |
                          Cognito JWT Auth
                                |
                      API Gateway (LyniaApi)
                         /          |          \
                        /           |           \
              Scoring      Payment       Lock
              Service      Service       Service
                |            |             |
                +-----+------+------+------+
                      |             |
                 PostgreSQL    Fineract (ECS)
                   (RDS)       via ALB
                                |
                         Fineract DB
                        (RDS - separate)
```

---

## 5. Architecture Decisions

### Decision 1: Lynia DB as Source of Truth for Product Configuration

**Decision:** Lynia's `loan_products` table is the **source of truth** for all product configuration. Fineract handles financial **accounting only**.

**Why not configure products in Fineract?**
- Fineract's loan product model doesn't support device-specific pricing, brand catalogs, or organization-based eligibility
- Creating a Fineract product for every phone model/brand combination would be unmanageable (100+ products)
- Our admin portal UX is better suited for our operations team than Fineract's built-in admin
- We need category-specific fields (device lock, org verification) that Fineract doesn't model

**How the mapping works:**
```
Lynia loan_products table          Fineract loan products
┌─────────────────────┐           ┌─────────────────────┐
│ SMRT_FIN_001        │──────────>│ Tier 1 (Entry)      │
│ product_category:   │           │ Tier 2 (Standard)   │
│   smartphone        │           │ Tier 3 (Premium)    │
│ fineract_product_id │           │                     │
│   -> maps by tier   │           │                     │
├─────────────────────┤           ├─────────────────────┤
│ DIGI_LOAN_001       │──────────>│ DCL-S (Standard)    │
│ product_category:   │           │ DCL-P (Premium)     │
│   digital           │           │                     │
│ fineract_product_id │           │                     │
│   -> maps directly  │           │                     │
└─────────────────────┘           └─────────────────────┘
```

### Decision 2: Device Model Catalog (Separate from Inventory)

**Decision:** Create a `device_models` table as a **catalog** of available phone models with standard pricing. The existing `devices` table continues tracking **individual units** (IMEI, condition, assignment).

**Why separate?**
- Pricing is set at the model level (all Samsung A14s have the same retail price)
- Individual devices have unique attributes (IMEI, condition, current assignment)
- Admin configures pricing once per model; individual devices inherit the price
- Stock count can be derived from `devices` table but cached on `device_models` for performance

```
device_models (catalog)             devices (inventory)
┌──────────────────────┐           ┌──────────────────────┐
│ Samsung Galaxy A14   │<──────────│ IMEI: 354032...001   │
│ retail: $199         │    FK     │ status: in_stock     │
│ wholesale: $145      │           │ condition: new       │
│ deposit_override: 15%│           ├──────────────────────┤
│ stock: 25            │           │ IMEI: 354032...002   │
│                      │           │ status: assigned     │
│                      │           │ customer: John D.    │
└──────────────────────┘           └──────────────────────┘
```

### Decision 3: Per-Model Configuration Overrides

**Decision:** Each device model can **override** the product-level deposit percentage and maximum tenure. If no override is set, the product default applies.

**Why?**
- A $89 budget phone (Itel A60) may only need 10% deposit and 6-month max tenure
- A $499 premium phone (Samsung A54) may need 20% deposit and 12-month max tenure
- This lets operations fine-tune risk per price point without creating separate products

```
Product: SMRT_FIN_001 (defaults: 10% deposit, 12 months max)
  ├── Itel A60:      $89,  deposit override: none (uses 10%), tenure override: 6 months
  ├── Tecno Spark 10: $129, deposit override: none (uses 10%), tenure override: none (uses 12)
  ├── Samsung A14:   $199, deposit override: 15%, tenure override: none (uses 12)
  └── Samsung A54:   $499, deposit override: 20%, tenure override: 12 months
```

### Decision 4: Scoring Weight Redistribution for Digital Loans

**Decision:** For digital loans with organization verification, add a 6th scoring component (200 pts) by redistributing weight from Mobile Money and External Credit. Total remains 1000 points.

**Why redistribute instead of adding?**
- Keeping the total at 1000 maintains consistent score interpretation across categories
- For salaried employees, organization verification is a **stronger signal** than mobile money patterns
- Mobile money activity matters less for someone with a verified salary

```
                    Smartphone Loans    Digital Loans
                    ────────────────    ─────────────
Affordability:        300 pts (30%)     300 pts (30%)
Repayment:           250 pts (25%)     250 pts (25%)
Mobile Money:        200 pts (20%)     100 pts (10%)  ← halved
External Credit:     150 pts (15%)      50 pts  (5%)  ← reduced
KYC Verification:    100 pts (10%)     100 pts (10%)
Org Verification:      0 pts  (0%)     200 pts (20%)  ← NEW
                    ─────────────────   ─────────────
TOTAL:              1000 pts            1000 pts
```

### Decision 5: Extend Admin Service (Not New Lambda)

**Decision:** Add product CRUD endpoints to the existing `AdminFunction` Lambda rather than creating a new Lambda.

**Why?**
- Product management is an admin operation - it belongs with user management, config, and audit logs
- Avoids adding a 13th Lambda function to `template.yaml`
- The admin service has sufficient resources (512MB, 30s timeout) for CRUD operations
- Follows the existing pattern of consolidating admin operations

### Decision 6: CSV-Only Member Import (Client-Side Parsing)

**Decision:** Organization member import accepts CSV files only. The admin portal parses CSV client-side and POSTs a JSON array to the API.

**Why?**
- CSV is universally compatible - every organization can export data as CSV
- Client-side parsing keeps the Lambda stateless (no S3 staging needed)
- Admin can preview the data before confirming the import
- JSON payload to the API means the backend doesn't need file parsing libraries

```
Admin Portal                    Backend API
┌──────────────────┐           ┌──────────────────┐
│ 1. Select CSV    │           │                  │
│ 2. Parse locally │           │                  │
│ 3. Preview rows  │───POST───>│ 4. Validate      │
│                  │  JSON[]   │ 5. Hash natl IDs │
│                  │           │ 6. Bulk insert   │
│ 7. Show results  │<──────────│                  │
└──────────────────┘           └──────────────────┘
```

---

## 6. Database Design

### 6.1 Migration: `028_loan_product_categories.sql`

#### A. ALTER `loan_products` - Add Configuration Fields

These columns enable the admin portal to fully configure products without developer intervention:

```sql
ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(30) NOT NULL DEFAULT 'smartphone',
  ADD COLUMN IF NOT EXISTS min_term_months INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_term_months INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS interest_rate_monthly DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS requires_device BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_organization_verification BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allowed_disbursement_methods JSONB DEFAULT '["ecocash"]',
  ADD COLUMN IF NOT EXISTS max_active_loans INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
```

| Column | Why It's Needed |
|---|---|
| `product_category` | Distinguishes 'smartphone' from 'digital' at the coarsest level. Used for UI tabs, filtering, and routing to correct loan flow |
| `min_term_months` | Existing table only has `loan_term_months` (single value). We need a range so customers can choose their tenure |
| `max_term_months` | Upper bound of the tenure range. Critical for risk management |
| `interest_rate_monthly` | Existing table has `interest_rate_annual`. Monthly rate is what we display to customers and use in WhatsApp conversations |
| `requires_device` | Boolean flag: smartphone loans require device assignment, digital loans don't |
| `requires_organization_verification` | Boolean flag: digital loans require org member lookup for scoring |
| `allowed_disbursement_methods` | JSON array of payment methods. Smartphone = `["device_handover"]`, Digital = `["ecocash", "onemoney", "innbucks"]` |
| `max_active_loans` | How many concurrent loans a customer can have under this product. Default 1 |
| `display_order` | Controls sort order in admin portal and WhatsApp product listing |

#### B. CREATE `device_models` - Phone Catalog

```sql
CREATE TABLE IF NOT EXISTS device_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand VARCHAR(100) NOT NULL,
  model_name VARCHAR(200) NOT NULL,
  model_code VARCHAR(50) UNIQUE NOT NULL,
  storage_gb INTEGER,
  ram_gb INTEGER,
  screen_size_inches DECIMAL(3,1),
  device_type VARCHAR(50) DEFAULT 'smartphone',
  retail_price_usd DECIMAL(10,2) NOT NULL,
  wholesale_price_usd DECIMAL(10,2) NOT NULL,
  min_deposit_percentage DECIMAL(5,2),    -- NULL = use product default
  max_term_months INTEGER,                 -- NULL = use product default
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  available_stock INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**Key design notes:**
- `model_code` is UNIQUE - prevents duplicate entries (e.g., `SAM_A14_64GB`)
- `min_deposit_percentage` and `max_term_months` are NULLABLE - NULL means "use product default"
- `available_stock` is denormalized from `COUNT(*) WHERE device_model_id = X AND status = 'in_stock'` on the `devices` table - updated on stock changes for fast queries
- `retail_price_usd` is the customer-facing price; `wholesale_price_usd` is Lynia's cost (margin = retail - wholesale)

#### C. ALTER `devices` - Link to Model Catalog

```sql
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_model_id UUID REFERENCES device_models(id);
```

This FK links individual inventory units to their model catalog entry. Existing devices without this FK continue to work (column is nullable).

#### D. CREATE `organizations` - Scoring Sources

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_code VARCHAR(50) UNIQUE NOT NULL,
  org_name VARCHAR(200) NOT NULL,
  org_type VARCHAR(50) NOT NULL,                -- government, corporate, cooperative, ngo
  verification_method VARCHAR(30) NOT NULL DEFAULT 'excel_upload',
  api_endpoint TEXT,
  api_credentials_secret VARCHAR(200),           -- AWS Secrets Manager key
  scoring_trust_level INTEGER NOT NULL DEFAULT 50,
  contact_person VARCHAR(200),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  total_members INTEGER DEFAULT 0,
  last_data_import_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

**`scoring_trust_level` explained:**
This is a 0-100 score representing how much we trust an organization's data for creditworthiness assessment:

| Level | Range | Examples | Rationale |
|---|---|---|---|
| Very High | 80-100 | Government (Civil Service Commission, ZRP) | Verified payroll, stable employment, low turnover |
| High | 60-79 | Large corporates (Econet, Delta) | Stable companies but private sector turnover is higher |
| Medium | 40-59 | Cooperatives, smaller companies | Less verification rigor, variable membership |
| Low | 20-39 | NGOs, informal groups | Limited financial data, higher mobility |

#### E. CREATE `organization_members` - Member Data

```sql
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  national_id_hash VARCHAR(128),              -- SHA-256 hashed for privacy
  phone_number VARCHAR(20),                    -- For matching to customers table
  employee_number VARCHAR(50),
  employment_status VARCHAR(30),               -- active, retired, suspended
  employment_start_date DATE,
  department VARCHAR(100),
  grade_level VARCHAR(50),
  monthly_salary_usd DECIMAL(10,2),
  salary_verified BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  import_batch_id VARCHAR(50),
  data_source VARCHAR(30) DEFAULT 'csv',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  verified_at TIMESTAMPTZ,
  customer_id UUID REFERENCES customers(id),   -- Linked when matched
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Privacy design:**
- `national_id_hash` stores SHA-256 hash, never plaintext (per CLAUDE.md privacy rules)
- `phone_number` is stored for customer matching but masked in all API responses
- `monthly_salary_usd` is used for scoring only, never exposed to customer-facing surfaces
- All member data is imported with explicit organizational consent

#### F. ALTER `loans` - Category Tracking

```sql
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(30),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS disbursement_method VARCHAR(30);
```

- `product_category` is denormalized from `loan_products` for query performance (avoids JOINs in reporting)
- `organization_id` records which organization verified the customer (for digital loans)
- `disbursement_method` records how value was delivered: 'device_handover' or 'ecocash'/'onemoney'/'innbucks'

#### G. Seed Data

```sql
-- Update existing smartphone product with new fields
UPDATE loan_products SET
  product_category = 'smartphone',
  min_term_months = 3,
  max_term_months = 12,
  interest_rate_monthly = 5.00,
  requires_device = TRUE,
  requires_organization_verification = FALSE,
  allowed_disbursement_methods = '["device_handover"]',
  max_active_loans = 1,
  display_order = 1
WHERE product_code = 'SMRT_FIN_001';

-- Insert new Digital Loan product
INSERT INTO loan_products (
  product_code, product_name, product_type, product_category,
  status, min_amount_usd, max_amount_usd,
  loan_term_months, min_term_months, max_term_months,
  interest_rate_annual, interest_rate_monthly,
  deposit_percentage, min_deposit_usd,
  requires_device, requires_organization_verification,
  allowed_disbursement_methods,
  max_active_loans, display_order, description
) VALUES (
  'DIGI_LOAN_001', 'Digital Cash Loan', 'digital_credit', 'digital',
  'active', 20, 500,
  3, 1, 6,
  36.00, 3.00,
  0, 0,
  FALSE, TRUE,
  '["ecocash", "onemoney", "innbucks"]',
  1, 2,
  'Cash loan disbursed via mobile money. Requires employment verification through a registered organization.'
);

-- Sample organizations
INSERT INTO organizations (org_code, org_name, org_type, verification_method, scoring_trust_level) VALUES
  ('GOV_CSC', 'Zimbabwe Civil Service Commission', 'government', 'excel_upload', 90),
  ('GOV_ZRP', 'Zimbabwe Republic Police', 'government', 'excel_upload', 85),
  ('ORG_ECONET', 'Econet Wireless Zimbabwe', 'corporate', 'api', 70);
```

---

## 7. Backend API Design

### 7.1 Where the Code Lives

All new endpoints are added to the **existing Admin Service** at `services/admin-service/src/index.ts`. This Lambda already handles user management, system config, and audit logs. Product management is an admin function and belongs here.

The route handler follows the existing pattern:
```
1. Parse path with regex matching
2. Extract auth context from Cognito JWT
3. Check permissions (isAdminOrManager)
4. Execute database operation via db.from() or query()
5. Write audit log entry
6. Return successResponse() or errorResponse()
```

### 7.2 Product CRUD Endpoints

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/admin/products` | List all products | `settings:read` |
| `GET` | `/admin/products/{id}` | Get product detail | `settings:read` |
| `POST` | `/admin/products` | Create new product | `settings:write` |
| `PATCH` | `/admin/products/{id}` | Update product | `settings:write` |
| `DELETE` | `/admin/products/{id}` | Soft-delete product | `settings:write` |

**GET /admin/products** query parameters:
- `?category=smartphone|digital` - Filter by category
- `?status=active|inactive|launching_soon` - Filter by status
- `?search=keyword` - Search by name or code
- `?page=1&limit=25` - Pagination

**POST /admin/products** validation rules:
- `product_code` must be unique, alphanumeric with underscores, max 50 chars
- `product_category` must be 'smartphone' or 'digital'
- If `smartphone`: `requires_device` must be true, `deposit_percentage` must be > 0
- If `digital`: `deposit_percentage` should be 0, `requires_organization_verification` should be true
- `min_term_months` must be < `max_term_months`
- `min_amount_usd` must be < `max_amount_usd`
- `interest_rate_monthly` and `interest_rate_annual` must be > 0

**DELETE /admin/products/{id}** safety checks:
- Cannot delete if product has any loans in `active`, `disbursed`, or `approved` status
- Sets `deleted_at = NOW()` (soft delete, not hard delete)

### 7.3 Device Model Endpoints

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/admin/device-models` | List device models | `settings:read` |
| `GET` | `/admin/device-models/{id}` | Get model detail | `settings:read` |
| `POST` | `/admin/device-models` | Create model entry | `settings:write` |
| `PATCH` | `/admin/device-models/{id}` | Update model | `settings:write` |
| `DELETE` | `/admin/device-models/{id}` | Soft-delete model | `settings:write` |

**GET /admin/device-models** query parameters:
- `?brand=Samsung` - Filter by brand
- `?is_active=true` - Filter by availability
- `?search=keyword` - Search by model name
- `?page=1&limit=25` - Pagination

### 7.4 Organization Endpoints

| Method | Path | Description | Permission |
|---|---|---|---|
| `GET` | `/admin/organizations` | List organizations | `settings:read` |
| `GET` | `/admin/organizations/{id}` | Get org with member count | `settings:read` |
| `POST` | `/admin/organizations` | Create organization | `settings:write` |
| `PATCH` | `/admin/organizations/{id}` | Update organization | `settings:write` |
| `POST` | `/admin/organizations/{id}/import` | Import members (CSV→JSON) | `settings:write` |
| `GET` | `/admin/organizations/{id}/members` | List members (masked) | `settings:read` |

**POST /admin/organizations/{id}/import** request body:
```json
{
  "members": [
    {
      "national_id": "12345678A90",
      "phone_number": "+263771234567",
      "employee_number": "EMP001",
      "employment_status": "active",
      "employment_start_date": "2020-01-15",
      "department": "Education",
      "grade_level": "Grade 7",
      "monthly_salary_usd": 450.00
    }
  ]
}
```

**Processing:**
1. Validate each member record
2. Hash `national_id` with SHA-256 before storage
3. Bulk insert into `organization_members`
4. Try to match `phone_number` against `customers.phone_number` and set `customer_id`
5. Update `organizations.total_members` count
6. Return import summary: total, inserted, skipped (duplicates), errors

### 7.5 Template.yaml Changes

Add ~16 new API Gateway event sources to the existing `AdminFunction` resource block (around line 996 in `template.yaml`). Each event follows the standard pattern:

```yaml
GetProducts:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/products
    Method: GET
```

---

## 8. Credit Scoring Enhancements

### 8.1 Current Model (5 Components, 1000 Points)

The scoring service at `services/scoring-service/src/index.ts` calculates credit scores using a rule-based model:

```
┌─────────────────────────────────────────────────────────┐
│              CURRENT SCORING MODEL                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Affordability │  │  Repayment   │  │ Mobile Money │  │
│  │   300 pts     │  │   250 pts    │  │   200 pts    │  │
│  │    (30%)      │  │    (25%)     │  │    (20%)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │Ext. Credit   │  │     KYC      │     Total: 1000    │
│  │   150 pts    │  │   100 pts    │     Scale: 300-850 │
│  │    (15%)     │  │    (10%)     │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Enhanced Model for Digital Loans (6 Components, 1000 Points)

When `product_category === 'digital'` and organization verification data is available:

```
┌─────────────────────────────────────────────────────────┐
│            DIGITAL LOAN SCORING MODEL                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Affordability │  │  Repayment   │  │ Mobile Money │  │
│  │   300 pts     │  │   250 pts    │  │   100 pts    │  │
│  │    (30%)      │  │    (25%)     │  │    (10%)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │Ext. Credit   │  │     KYC      │  │  Org Verify  │  │
│  │    50 pts    │  │   100 pts    │  │   200 pts    │  │
│  │     (5%)     │  │    (10%)     │  │    (20%)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                          Total: 1000    │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Organization Verification Component (200 Points Max)

```
Organization Trust Level:      up to 80 pts
  - Government (trust 80+):    80 pts
  - Corporate (trust 60-79):   60 pts
  - Cooperative (trust 40-59): 40 pts
  - Other (trust <40):         20 pts

Employment Status:             up to 50 pts
  - Active employment:         50 pts
  - Retired:                   25 pts
  - Suspended/Other:            0 pts

Employment Tenure:             up to 40 pts
  - 5+ years:                  40 pts
  - 2-5 years:                 30 pts
  - 1-2 years:                 20 pts
  - <1 year:                   10 pts

Salary Verification:           up to 30 pts
  - Salary verified:           30 pts
  - Not verified:               0 pts
```

### 8.4 New Scoring Endpoint

`POST /scoring/verify-organization` - Called before `POST /scoring/calculate` to look up a customer's organization membership:

```
Input:  { phone_number: "+263771234567" }
Output: {
  found: true,
  organization_id: "uuid",
  org_name: "Civil Service Commission",
  org_type: "government",
  scoring_trust_level: 90,
  employment_status: "active",
  employment_start_date: "2018-03-01",
  tenure_months: 95,
  salary_verified: true,
  monthly_salary_usd: 450.00
}
```

This data feeds into the 6th scoring component when calculating credit score for digital loan applicants.

### 8.5 Fineract Product Mapping Fix

Currently in `services/scoring-service/src/index.ts` (~line 642), Fineract product selection is hardcoded:

```typescript
// CURRENT (hardcoded)
const tierToProductId = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
const fineractProductId = tierToProductId[scoreResult.tier] || 1;
```

**Change to:**
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
  // Backward-compatible fallback
  const tierMap = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
  fineractProductId = tierMap[scoreResult.tier] || 1;
}
```

---

## 9. Fineract Core Banking Integration

### 9.1 Current Fineract Products

| ID | Name | Short Name | For | Principal Range |
|---|---|---|---|---|
| 1 | Tier 1 (Entry) | LT1E | Smartphone (low score) | $50-200 |
| 2 | Tier 2 (Standard) | LT2S | Smartphone (mid score) | $200-500 |
| 3 | Tier 3 (Premium) | LT3P | Smartphone (high score) | $500-2000 |

### 9.2 New Fineract Products Needed

| ID | Name | Short Name | For | Principal Range | Interest |
|---|---|---|---|---|---|
| 4 | Digital Cash Loan - Standard | DCL-S | Digital (small loans) | $20-200 | 3% monthly |
| 5 | Digital Cash Loan - Premium | DCL-P | Digital (larger loans) | $200-500 | 2.5% monthly |

These will be created via the existing `FineractClient.createLoanProduct()` method, using the same GL account mappings (the 21 accounts are already configured).

### 9.3 Sync Flow

```
                    Lynia DB                          Fineract
                    ────────                          ────────
1. Admin creates    loan_products
   product in       (product_category,
   admin portal     fineract_product_id)

2. Customer         loans
   applies for      (product_id,         ───sync───> m_loan
   loan             product_category)                (m_product_loan_id)

3. Loan approved    loans.status =       ───sync───> m_loan.status =
                    'approved'                       'approved'

4. Disbursement     loans.status =       ───sync───> m_loan_transaction
   (device or cash) 'disbursed'                      (disbursement)

5. Repayment        payments             ───sync───> m_loan_transaction
   received         (completed)                      (repayment)
```

All sync operations remain **non-blocking** via the existing `fineract-sync.ts` module. If Fineract is down, the sync fails gracefully and is retried via the SQS retry queue.

---

## 10. Admin Portal Frontend Design

### 10.1 Navigation Change

Add "Products" to the sidebar between "Loans" and "Devices":

```
Dashboard
Customers
KYC Review
Loans
Products    ← NEW (Package icon)
Devices
Payments
Reports
Analytics
Settings
```

**File:** `frontend/admin-portal/src/components/layout/sidebar.tsx`

### 10.2 Products Overview Page (`/products`)

```
┌──────────────────────────────────────────────────────────┐
│  Products                                [+ Create Product]│
│                                                           │
│  ┌─ Smartphone Loans ─┐  ┌─ Digital Loans ─┐            │
│  │   (active tab)      │  │                 │            │
│  └─────────────────────┘  └─────────────────┘            │
│                                                           │
│  ┌── Stats ──────────────────────────────────────────┐   │
│  │  Active Products: 1  │  Total Loans: 245  │ Vol: $48K│ │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌── Product Card ───────────────────────────────────┐   │
│  │  SMRT_FIN_001 - Smartphone Financing    [Active]  │   │
│  │                                                    │   │
│  │  Amount: $50 - $500        Deposit: 10%           │   │
│  │  Interest: 5%/mo (60%/yr)  Tenure: 3-12 months   │   │
│  │  Requires Device: Yes                              │   │
│  │                                                    │   │
│  │  [Edit]  [View Details]  [Manage Device Models]   │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 10.3 Create/Edit Product Modal

Different form fields based on selected category:

**Smartphone Product Form:**
```
Product Name:        [____________________]
Product Code:        [____________________]
Status:              [Active ▼]

── Loan Configuration ──
Min Amount (USD):    [50___]   Max Amount (USD): [500__]
Min Tenure (months): [3____]   Max Tenure (months): [12___]
Interest Rate/Month: [5.00_]%  Interest Rate/Year: [60.00]%
Deposit Percentage:  [10.00]%  Min Deposit (USD):  [20___]

── Settings ──
Max Active Loans:    [1____]
Description:         [____________________]

                              [Cancel]  [Save Product]
```

**Digital Product Form:**
```
Product Name:        [____________________]
Product Code:        [____________________]
Status:              [Active ▼]

── Loan Configuration ──
Min Amount (USD):    [20___]   Max Amount (USD): [500__]
Min Tenure (months): [1____]   Max Tenure (months): [6____]
Interest Rate/Month: [3.00_]%  Interest Rate/Year: [36.00]%

── Disbursement Methods ──
[x] EcoCash  [x] OneMoney  [x] InnBucks

── Scoring ──
Requires Org Verification: [Yes ▼]

── Settings ──
Max Active Loans:    [1____]
Description:         [____________________]

                              [Cancel]  [Save Product]
```

### 10.4 Device Models Page (`/products/device-models`)

```
┌──────────────────────────────────────────────────────────┐
│  Device Model Catalog                [+ Add Device Model] │
│                                                           │
│  Brand: [All ▼]   Search: [_______________] [Search]     │
│                                                           │
│  ┌── DataTable ──────────────────────────────────────┐   │
│  │ Brand    │ Model       │ Storage│ Retail │ Stock │ ▼│  │
│  │──────────│─────────────│────────│────────│───────│──│  │
│  │ Samsung  │ Galaxy A14  │ 64GB   │ $199   │  25   │  │  │
│  │ Samsung  │ Galaxy A54  │ 128GB  │ $499   │  10   │  │  │
│  │ Tecno    │ Spark 10    │ 64GB   │ $129   │  42   │  │  │
│  │ Itel     │ A60         │ 32GB   │ $89    │  60   │  │  │
│  │ Xiaomi   │ Redmi 12C   │ 64GB   │ $149   │  15   │  │  │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  Page 1 of 1   Showing 5 of 5 models                    │
└──────────────────────────────────────────────────────────┘
```

**Add/Edit Device Model Modal:**
```
Brand:               [Samsung___________]
Model Name:          [Galaxy A14________]
Model Code:          [SAM_A14_64________]

── Specifications ──
Storage (GB):        [64____]
RAM (GB):            [4_____]
Screen Size (inches):[6.6___]

── Pricing ──
Retail Price (USD):  [199.00]  (customer pays this)
Wholesale Price (USD):[145.00] (our cost)
Margin:               $54.00   (27.1%)

── Overrides (leave blank to use product defaults) ──
Min Deposit %:       [15.00_]  (product default: 10%)
Max Tenure (months): [______]  (product default: 12)

                              [Cancel]  [Save Model]
```

### 10.5 Organizations Page (`/products/organizations`)

```
┌──────────────────────────────────────────────────────────┐
│  Scoring Organizations              [+ Add Organization]  │
│                                                           │
│  ┌── DataTable ──────────────────────────────────────┐   │
│  │ Name              │ Type       │Trust│Members│Last  │  │
│  │───────────────────│────────────│─────│───────│──────│  │
│  │ Civil Service     │ Government │ 90  │ 5,420 │ Feb 1│  │
│  │ Zimbabwe Police   │ Government │ 85  │ 3,100 │ Jan 28│ │
│  │ Econet Wireless   │ Corporate  │ 70  │ 1,850 │ Feb 10│ │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 10.6 Organization Detail Page (`/products/organizations/{id}`)

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Organizations                                  │
│                                                           │
│  Civil Service Commission              [Edit] [Import CSV]│
│  Type: Government | Trust Level: 90 | Members: 5,420     │
│  Method: Excel Upload | Last Import: Feb 1, 2026         │
│                                                           │
│  ┌── Members ────────────────────────────────────────┐   │
│  │ Emp #  │ Phone      │ Dept      │ Grade  │ Status │   │
│  │────────│────────────│───────────│────────│────────│   │
│  │ EMP001 │ +263****567│ Education │ Gr. 7  │ Active │   │
│  │ EMP002 │ +263****234│ Health    │ Gr. 5  │ Active │   │
│  │ EMP003 │ +263****891│ Admin     │ Gr. 9  │ Retired│   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  Page 1 of 54   Showing 25 of 5,420 members             │
└──────────────────────────────────────────────────────────┘
```

**CSV Import Modal:**
```
┌── Import Organization Members ────────────────────────┐
│                                                        │
│  Select CSV file: [Choose File]  members.csv           │
│                                                        │
│  Required columns:                                     │
│  national_id, phone_number, employee_number,           │
│  employment_status, department, grade_level,            │
│  monthly_salary_usd                                    │
│                                                        │
│  ── Preview (first 5 rows) ──                         │
│  │ national_id │ phone        │ emp_no │ status │     │
│  │ 12****90    │ +263****567  │ EMP001 │ active │     │
│  │ 23****01    │ +263****234  │ EMP002 │ active │     │
│  │ ...         │ ...          │ ...    │ ...    │     │
│                                                        │
│  Total rows: 1,250                                     │
│                                                        │
│                           [Cancel]  [Import 1,250 rows]│
└────────────────────────────────────────────────────────┘
```

### 10.7 New Files Summary

```
frontend/admin-portal/src/
  lib/api/products.ts                          -- API client functions
  types/index.ts                               -- Updated with new interfaces
  components/layout/sidebar.tsx                -- Add Products nav item
  components/products/
    product-card.tsx                            -- Product display card
    product-form.tsx                            -- Create/edit form modal
    device-model-form.tsx                       -- Device model modal
    organization-form.tsx                       -- Organization modal
    member-import-modal.tsx                     -- CSV import modal
    product-stats.tsx                           -- Stats overview cards
  app/(dashboard)/products/
    page.tsx + _client.tsx                      -- Products overview
    [id]/page.tsx + _client.tsx                 -- Product detail/edit
    device-models/page.tsx + _client.tsx        -- Device catalog
    organizations/page.tsx + _client.tsx        -- Org list
    organizations/[id]/page.tsx + _client.tsx   -- Org detail + members
```

---

## 11. Data Flow Diagrams

### 11.1 Smartphone Loan Flow

```
Customer (WhatsApp)    Admin Portal       Backend Services      Database
       │                    │                    │                  │
       │                    │  1. Create product │                  │
       │                    │───────────────────>│  INSERT           │
       │                    │  2. Add device     │  loan_products   │
       │                    │   models + pricing │                  │
       │                    │───────────────────>│  INSERT           │
       │                    │                    │  device_models   │
       │                    │                    │                  │
       │  3. Apply for loan │                    │                  │
       │────────────────────────────────────────>│  INSERT loan     │
       │                    │                    │  (status:pending)│
       │  4. Score calc     │                    │                  │
       │────────────────────────────────────────>│  5-component     │
       │                    │                    │  scoring         │
       │  5. Approved!      │                    │                  │
       │<────────────────────────────────────────│  UPDATE loan     │
       │                    │                    │  (status:approved)│
       │  6. Pay deposit    │                    │                  │
       │────────────────────────────────────────>│  EcoCash payment │
       │                    │                    │  UPDATE loan     │
       │                    │                    │  (status:paid_dep)│
       │  7. Collect phone  │                    │                  │
       │  (handover flow)   │                    │  Handover service│
       │────────────────────────────────────────>│  UPDATE loan     │
       │                    │                    │  (status:active) │
       │                    │                    │  → Sync Fineract │
       │  8. Monthly payment│                    │                  │
       │────────────────────────────────────────>│  EcoCash webhook │
       │                    │                    │  → Sync Fineract │
       │                    │                    │                  │
       │  [IF MISSED PAYMENT - 7+ days overdue]  │                  │
       │                    │                    │  Lock service    │
       │<────────────────────────────────────────│  Trustonic lock  │
       │  Phone locked!     │                    │                  │
```

### 11.2 Digital Loan Flow

```
Customer (WhatsApp)    Admin Portal       Backend Services      Database
       │                    │                    │                  │
       │                    │  1. Create product │                  │
       │                    │───────────────────>│  INSERT           │
       │                    │  2. Register org   │  loan_products   │
       │                    │───────────────────>│  INSERT           │
       │                    │  3. Import members │  organizations   │
       │                    │───────────────────>│  BULK INSERT     │
       │                    │   (CSV upload)     │  org_members     │
       │                    │                    │                  │
       │  4. Apply for loan │                    │                  │
       │────────────────────────────────────────>│  INSERT loan     │
       │                    │                    │  (status:pending)│
       │                    │                    │                  │
       │                    │  5. Verify org     │                  │
       │────────────────────────────────────────>│  LOOKUP phone in │
       │                    │                    │  org_members     │
       │                    │                    │  FOUND: Civil    │
       │                    │                    │  Service, active │
       │                    │                    │                  │
       │                    │  6. Score calc     │                  │
       │────────────────────────────────────────>│  6-component     │
       │                    │                    │  scoring (incl.  │
       │                    │                    │  org verification)│
       │  7. Approved!      │                    │                  │
       │<────────────────────────────────────────│  UPDATE loan     │
       │                    │                    │  (status:approved)│
       │                    │                    │                  │
       │  8. Cash disbursed │                    │                  │
       │<────────────────────────────────────────│  EcoCash payout  │
       │  $200 to EcoCash!  │                    │  UPDATE loan     │
       │                    │                    │  (status:active) │
       │                    │                    │  → Sync Fineract │
       │  9. Monthly payment│                    │                  │
       │────────────────────────────────────────>│  EcoCash webhook │
       │                    │                    │  → Sync Fineract │
```

---

## 12. Security & Privacy Considerations

### 12.1 Data Protection

| Data | Protection Method | Rationale |
|---|---|---|
| National IDs in `organization_members` | SHA-256 hash | Never store plaintext; lookup by hash |
| Phone numbers in API responses | Masked (`+263****567`) | Per CLAUDE.md logging standards |
| Salary data | Stored for scoring only | Never exposed to customer-facing surfaces |
| Organization API credentials | AWS Secrets Manager | Per CLAUDE.md security rules |
| CSV import files | Parsed client-side, not stored | No file storage on server |

### 12.2 Authorization

| Operation | Required Role | Rationale |
|---|---|---|
| View products | `settings:read` | Operations staff, managers |
| Create/edit products | `settings:write` | Managers only |
| Import members | `settings:write` | Managers only (handles sensitive data) |
| View org members | `settings:read` | Operations staff (masked data) |

### 12.3 Input Validation

All product creation/update endpoints validate:
- Numeric ranges (min < max for amounts and terms)
- Interest rates within reasonable bounds (0-100%)
- Product codes match pattern `^[A-Z0-9_]{3,50}$`
- Amount limits respect RBZ transaction limits ($2,000 single, $5,000 daily)

---

## 13. Implementation Sequence

| Phase | What | Key Files | Dependencies |
|---|---|---|---|
| **1. Database** | Migration 028 | `database/migrations/028_loan_product_categories.sql` | None |
| **2. Backend** | Product CRUD API | `services/admin-service/src/index.ts` | Phase 1 |
| **3. Backend** | Template.yaml routes | `template.yaml` | Phase 2 |
| **4. Scoring** | Org verification | `services/scoring-service/src/index.ts` | Phase 1 |
| **5. Frontend** | Types + API client | `frontend/admin-portal/src/types/index.ts`, `lib/api/products.ts` | Phase 2 |
| **6. Frontend** | Navigation + pages | `components/layout/sidebar.tsx`, `app/(dashboard)/products/` | Phase 5 |
| **7. Frontend** | Components | `components/products/*.tsx` | Phase 6 |
| **8. Fineract** | Product mapping fix | `services/scoring-service/src/index.ts` (~line 642) | Phase 1 |
| **9. Testing** | Integration tests | `tests/` | All phases |

---

## 14. Verification & Testing Plan

### 14.1 Database Verification

```bash
# Run migration
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"

# Verify tables
psql -c "\dt device_models"
psql -c "\dt organizations"
psql -c "\dt organization_members"
psql -c "\d loan_products"  -- verify new columns
psql -c "\d loans"          -- verify new columns
psql -c "SELECT * FROM loan_products"  -- verify seed data
```

### 14.2 API Verification

```bash
# Build and start local API
sam build --cached --parallel
sam local start-api --port 3000

# Test product CRUD
curl -s localhost:3000/admin/products | jq
curl -s -X POST localhost:3000/admin/products -d '{"product_code":"TEST_001",...}' | jq
curl -s -X PATCH localhost:3000/admin/products/{id} -d '{"status":"inactive"}' | jq

# Test device model CRUD
curl -s localhost:3000/admin/device-models | jq
curl -s -X POST localhost:3000/admin/device-models -d '{"brand":"Samsung",...}' | jq

# Test organization CRUD + import
curl -s localhost:3000/admin/organizations | jq
curl -s -X POST localhost:3000/admin/organizations/{id}/import -d '{"members":[...]}' | jq
```

### 14.3 Scoring Verification

```bash
# Unit tests for organization scoring component
pnpm test services/scoring-service

# Test scenarios:
# 1. Government employee (trust 90) -> expect ~180/200 org score
# 2. Corporate employee (trust 70) -> expect ~140/200 org score
# 3. Non-member (no org data) -> expect 0 org score (smartphone flow)
```

### 14.4 Frontend Verification

```bash
cd frontend/admin-portal && pnpm dev

# Manual verification:
# 1. Products nav item visible in sidebar
# 2. Products page loads with Smartphone/Digital tabs
# 3. Create Product modal opens with correct fields per category
# 4. Device Models sub-page shows DataTable
# 5. Organizations sub-page shows list
# 6. CSV import modal parses file and shows preview
# 7. All forms submit successfully and data appears in lists
```

### 14.5 End-to-End Integration Tests

**Smartphone Loan E2E:**
1. Admin creates smartphone product with 15% deposit, 5% monthly rate, 3-12 month tenure
2. Admin adds Samsung Galaxy A14 device model at $199 retail
3. Customer applies for loan via WhatsApp
4. Score calculated using 5-component model
5. Approved -> customer pays $29.85 deposit (15% of $199)
6. Device handed over -> loan activated
7. Verify Fineract loan created with correct product mapping

**Digital Loan E2E:**
1. Admin creates digital loan product with 3% monthly rate, 1-6 month tenure
2. Admin registers Civil Service Commission organization (trust 90)
3. Admin imports member CSV with 100 records
4. Customer (teacher) applies for $200 loan via WhatsApp
5. Phone matched in organization_members -> org verification data retrieved
6. Score calculated using 6-component model (including org verification)
7. Approved -> $200 disbursed to EcoCash
8. Verify Fineract loan created with digital loan product mapping

---

## 15. Files to Create & Modify

### New Files

| File | Purpose |
|---|---|
| `database/migrations/028_loan_product_categories.sql` | Full database migration |
| `frontend/admin-portal/src/lib/api/products.ts` | API client for products, models, orgs |
| `frontend/admin-portal/src/app/(dashboard)/products/page.tsx` | Products overview (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/_client.tsx` | Products overview (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/[id]/page.tsx` | Product detail (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/[id]/_client.tsx` | Product detail (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/device-models/page.tsx` | Device models (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/device-models/_client.tsx` | Device models (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/page.tsx` | Orgs list (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/_client.tsx` | Orgs list (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/[id]/page.tsx` | Org detail (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/[id]/_client.tsx` | Org detail (client) |
| `frontend/admin-portal/src/components/products/product-card.tsx` | Product display card |
| `frontend/admin-portal/src/components/products/product-form.tsx` | Product create/edit form |
| `frontend/admin-portal/src/components/products/device-model-form.tsx` | Device model form |
| `frontend/admin-portal/src/components/products/organization-form.tsx` | Organization form |
| `frontend/admin-portal/src/components/products/member-import-modal.tsx` | CSV import modal |
| `frontend/admin-portal/src/components/products/product-stats.tsx` | Stats cards |

### Modified Files

| File | Changes |
|---|---|
| `services/admin-service/src/index.ts` | Add ~12 route handlers for product/model/org CRUD |
| `services/scoring-service/src/index.ts` | Add org verification component, fix Fineract product mapping |
| `template.yaml` | Add ~16 API Gateway event sources to AdminFunction |
| `frontend/admin-portal/src/components/layout/sidebar.tsx` | Add "Products" nav item |
| `frontend/admin-portal/src/types/index.ts` | Add LoanProduct, DeviceModel, Organization, OrganizationMember types |

---

*Document created: February 17, 2026*
*Last updated: February 17, 2026*
*Author: Claude Code (AI-assisted development)*
