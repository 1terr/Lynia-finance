-- Migration 028: Loan Product Categories
--
-- Adds support for multiple loan product categories (smartphone financing
-- and digital cash loans). Creates the device_models catalog, organizations
-- table for employment-based credit scoring, and organization_members for
-- member data import.
--
-- This is the foundation migration for the loan product categories feature.
-- All subsequent product-category tasks depend on this schema.

-- ============================================================================
-- A. ALTER loan_products - Add configuration fields
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_loan_products_category
  ON loan_products(product_category);

CREATE INDEX IF NOT EXISTS idx_loan_products_display_order
  ON loan_products(display_order)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN loan_products.product_category IS
  'Distinguishes smartphone asset financing from digital cash loans';
COMMENT ON COLUMN loan_products.requires_device IS
  'When TRUE, a device must be assigned before loan disbursement';
COMMENT ON COLUMN loan_products.requires_organization_verification IS
  'When TRUE, borrower must be verified as member of a registered organization';
COMMENT ON COLUMN loan_products.allowed_disbursement_methods IS
  'JSON array of payment methods available for disbursement (ecocash, onemoney, innbucks, bank_transfer)';

-- ============================================================================
-- B. CREATE device_models - Phone catalog with brand-based pricing
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_models (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand                   VARCHAR(100) NOT NULL,
  model_name              VARCHAR(200) NOT NULL,
  model_code              VARCHAR(50) NOT NULL UNIQUE,
  storage_gb              INTEGER,
  ram_gb                  INTEGER,
  screen_size_inches      DECIMAL(3,1),
  device_type             VARCHAR(50) DEFAULT 'smartphone',
  retail_price_usd        DECIMAL(10,2) NOT NULL,
  wholesale_price_usd     DECIMAL(10,2) NOT NULL,
  min_deposit_percentage  DECIMAL(5,2),
  max_term_months         INTEGER,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  available_stock         INTEGER NOT NULL DEFAULT 0,
  image_url               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_models_brand
  ON device_models(brand);

CREATE INDEX IF NOT EXISTS idx_device_models_active
  ON device_models(is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_device_models_device_type
  ON device_models(device_type);

COMMENT ON TABLE device_models IS
  'Catalog of phone models available for smartphone financing with brand-based pricing';
COMMENT ON COLUMN device_models.min_deposit_percentage IS
  'Override deposit percentage for this model. NULL = use product default';
COMMENT ON COLUMN device_models.max_term_months IS
  'Override max term for this model. NULL = use product default';

-- ============================================================================
-- C. ALTER devices - Link to model catalog
-- ============================================================================

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_model_id UUID REFERENCES device_models(id);

CREATE INDEX IF NOT EXISTS idx_devices_device_model
  ON devices(device_model_id);

-- ============================================================================
-- D. CREATE organizations - Scoring source organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_code                VARCHAR(50) NOT NULL UNIQUE,
  org_name                VARCHAR(200) NOT NULL,
  org_type                VARCHAR(50) NOT NULL,
  verification_method     VARCHAR(50) NOT NULL DEFAULT 'manual',
  api_endpoint            TEXT,
  api_credentials_secret  VARCHAR(200),
  scoring_trust_level     INTEGER NOT NULL DEFAULT 50
                          CHECK (scoring_trust_level >= 0 AND scoring_trust_level <= 100),
  contact_name            VARCHAR(200),
  contact_email           VARCHAR(200),
  contact_phone           VARCHAR(50),
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  total_members           INTEGER DEFAULT 0,
  last_data_import_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_org_code
  ON organizations(org_code);

CREATE INDEX IF NOT EXISTS idx_organizations_org_type
  ON organizations(org_type);

CREATE INDEX IF NOT EXISTS idx_organizations_active
  ON organizations(is_active)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE organizations IS
  'Registered organizations (employers, cooperatives) used for employment-based credit scoring';
COMMENT ON COLUMN organizations.scoring_trust_level IS
  'Trust level from 0-100 affecting credit score weight. Government entities score higher';
COMMENT ON COLUMN organizations.api_credentials_secret IS
  'AWS Secrets Manager key name for API credentials. Never stores credentials directly';

-- ============================================================================
-- E. CREATE organization_members - Member data for credit scoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES organizations(id),
  national_id_hash        VARCHAR(64),
  phone_number            VARCHAR(20),
  employee_number         VARCHAR(50),
  employment_status       VARCHAR(30) DEFAULT 'active',
  employment_start_date   DATE,
  department              VARCHAR(100),
  grade_level             VARCHAR(50),
  monthly_salary_usd      DECIMAL(10,2),
  salary_verified         BOOLEAN DEFAULT FALSE,
  import_batch_id         VARCHAR(100),
  data_source             VARCHAR(50) DEFAULT 'manual',
  customer_id             UUID REFERENCES customers(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_members_organization
  ON organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_members_national_id_hash
  ON organization_members(national_id_hash);

CREATE INDEX IF NOT EXISTS idx_org_members_phone
  ON organization_members(phone_number);

CREATE INDEX IF NOT EXISTS idx_org_members_customer
  ON organization_members(customer_id);

CREATE INDEX IF NOT EXISTS idx_org_members_import_batch
  ON organization_members(import_batch_id);

COMMENT ON TABLE organization_members IS
  'Organization member records imported for employment-based credit scoring';
COMMENT ON COLUMN organization_members.national_id_hash IS
  'SHA-256 hash of national ID for privacy-preserving lookups';
COMMENT ON COLUMN organization_members.data_source IS
  'How member data was imported: manual, api, csv_upload, bulk_import';

-- ============================================================================
-- F. ALTER loans - Category tracking
-- ============================================================================

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(30),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS disbursement_method VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_loans_product_category
  ON loans(product_category);

CREATE INDEX IF NOT EXISTS idx_loans_organization
  ON loans(organization_id);

CREATE INDEX IF NOT EXISTS idx_loans_disbursement_method
  ON loans(disbursement_method);

COMMENT ON COLUMN loans.product_category IS
  'Denormalized from loan_products for query performance (smartphone, digital)';
COMMENT ON COLUMN loans.organization_id IS
  'For digital loans: the organization that verified the borrower';
COMMENT ON COLUMN loans.disbursement_method IS
  'How loan value was delivered: device_handover, ecocash, onemoney, bank_transfer';

-- ============================================================================
-- G. Seed Data
-- ============================================================================

-- Update existing SMRT_FIN_001 with new category fields
UPDATE loan_products
SET product_category = 'smartphone',
    requires_device = TRUE,
    requires_organization_verification = FALSE,
    min_term_months = 3,
    max_term_months = 12,
    interest_rate_monthly = 1.00,
    allowed_disbursement_methods = '["device_handover"]',
    max_active_loans = 1,
    display_order = 1,
    updated_at = NOW()
WHERE product_code = 'SMRT_FIN_001';

-- Insert Digital Cash Loan product
INSERT INTO loan_products (
  product_code,
  product_name,
  product_type,
  status,
  product_category,
  min_amount_usd,
  max_amount_usd,
  loan_term_months,
  interest_rate_annual,
  deposit_percentage,
  min_deposit_usd,
  min_term_months,
  max_term_months,
  interest_rate_monthly,
  requires_device,
  requires_organization_verification,
  allowed_disbursement_methods,
  max_active_loans,
  display_order,
  description
) VALUES (
  'DIGI_LOAN_001',
  'Digital Cash Loan',
  'digital_credit',
  'active',
  'digital',
  20.00,
  500.00,
  3,
  24.00,
  0,
  0,
  1,
  6,
  2.00,
  FALSE,
  TRUE,
  '["ecocash", "onemoney", "innbucks"]',
  2,
  2,
  'Short-term digital cash loans for verified organization members. Funds disbursed directly to mobile money.'
) ON CONFLICT (product_code) DO NOTHING;

-- Insert sample organizations
INSERT INTO organizations (org_code, org_name, org_type, verification_method, scoring_trust_level, is_active, total_members)
VALUES
  ('GOV_CSC', 'Civil Service Commission', 'government', 'csv_upload', 90, TRUE, 0),
  ('GOV_ZRP', 'Zimbabwe Republic Police', 'government', 'csv_upload', 85, TRUE, 0),
  ('ORG_ECONET', 'Econet Wireless Zimbabwe', 'corporate', 'api', 70, TRUE, 0)
ON CONFLICT (org_code) DO NOTHING;
