-- Lynia Finance - Initial Database Schema
-- Migration: 20250124000001_initial_schema.sql
-- Description: Create all core tables, indexes, and basic constraints
-- Author: Development Team
-- Date: 2025-11-24

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- =============================================================================
-- TABLE: customers
-- Purpose: Customer profiles and credit information
-- =============================================================================
CREATE TABLE customers (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  phone_number VARCHAR(15) NOT NULL UNIQUE,
  national_id VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10),

  -- Address
  province VARCHAR(50),
  city VARCHAR(50),
  address_line_1 TEXT,
  address_line_2 TEXT,

  -- Credit Information
  credit_limit DECIMAL(10,2) DEFAULT 200.00,
  credit_score INTEGER,
  credit_tier INTEGER DEFAULT 1,
  total_loans INTEGER DEFAULT 0,
  active_loans INTEGER DEFAULT 0,
  completed_loans INTEGER DEFAULT 0,
  defaulted_loans INTEGER DEFAULT 0,
  total_borrowed DECIMAL(12,2) DEFAULT 0.00,
  total_repaid DECIMAL(12,2) DEFAULT 0.00,

  -- KYC Status
  kyc_status VARCHAR(20) DEFAULT 'pending',
  kyc_verified_at TIMESTAMP WITH TIME ZONE,
  kyc_expires_at TIMESTAMP WITH TIME ZONE,

  -- Fineract Integration
  fineract_client_id BIGINT UNIQUE,
  fineract_account_number VARCHAR(50),

  -- Status
  status VARCHAR(20) DEFAULT 'active',
  blocked_reason TEXT,

  -- Metadata
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID,
  utm_source VARCHAR(100),
  utm_campaign VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_phone CHECK (phone_number ~ '^\+263[0-9]{9}$'),
  CONSTRAINT valid_national_id CHECK (national_id ~ '^[0-9]{2}-[0-9]{6,7}-[A-Z]-[0-9]{2}$'),
  CONSTRAINT valid_credit_limit CHECK (credit_limit IN (200, 350, 500)),
  CONSTRAINT valid_credit_tier CHECK (credit_tier BETWEEN 1 AND 3)
);

-- Add foreign key after table creation
ALTER TABLE customers ADD CONSTRAINT fk_customers_referrer
  FOREIGN KEY (referred_by) REFERENCES customers(id);

-- Indexes
CREATE INDEX idx_customers_phone ON customers(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_national_id ON customers(national_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_fineract_id ON customers(fineract_client_id);
CREATE INDEX idx_customers_kyc_status ON customers(kyc_status);
CREATE INDEX idx_customers_status ON customers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_customers_name_trgm ON customers USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

COMMENT ON TABLE customers IS 'Customer profiles and credit information';

-- =============================================================================
-- TABLE: kyc_submissions
-- Purpose: KYC document verification tracking
-- =============================================================================
CREATE TABLE kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  document_type VARCHAR(50) DEFAULT 'national_id',
  document_number VARCHAR(50) NOT NULL,
  document_front_url TEXT NOT NULL,
  document_back_url TEXT,
  selfie_url TEXT NOT NULL,
  smile_job_id VARCHAR(100) UNIQUE,
  smile_partner_params JSONB,
  smile_result JSONB,
  smile_confidence_score DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  rejection_reason TEXT,
  manual_review_notes TEXT,
  liveness_passed BOOLEAN,
  liveness_score DECIMAL(5,2),
  image_quality_score DECIMAL(5,2),
  document_readable BOOLEAN,
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  previous_submission_id UUID,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_kyc_status CHECK (status IN ('pending', 'approved', 'rejected', 'manual_review')),
  CONSTRAINT valid_confidence CHECK (smile_confidence_score BETWEEN 0 AND 100),
  CONSTRAINT valid_attempt CHECK (attempt_number <= max_attempts)
);

ALTER TABLE kyc_submissions ADD CONSTRAINT fk_kyc_previous
  FOREIGN KEY (previous_submission_id) REFERENCES kyc_submissions(id);

CREATE INDEX idx_kyc_customer ON kyc_submissions(customer_id);
CREATE INDEX idx_kyc_status ON kyc_submissions(status);
CREATE INDEX idx_kyc_smile_job ON kyc_submissions(smile_job_id);
CREATE INDEX idx_kyc_submitted_at ON kyc_submissions(submitted_at DESC);

COMMENT ON TABLE kyc_submissions IS 'KYC document verification tracking';

-- =============================================================================
-- TABLE: distributors
-- Purpose: Agent network management
-- =============================================================================
CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  national_id VARCHAR(20) UNIQUE,
  business_name VARCHAR(100),
  business_registration VARCHAR(50),
  province VARCHAR(50),
  city VARCHAR(50),
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  account_name VARCHAR(100),
  mobile_money_number VARCHAR(15),
  commission_rate DECIMAL(5,2) DEFAULT 5.00,
  total_commissions_earned DECIMAL(12,2) DEFAULT 0.00,
  total_commissions_paid DECIMAL(12,2) DEFAULT 0.00,
  pending_commissions DECIMAL(12,2) DEFAULT 0.00,
  total_loans_disbursed INTEGER DEFAULT 0,
  total_devices_distributed INTEGER DEFAULT 0,
  current_inventory_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  status VARCHAR(20) DEFAULT 'active',
  suspended_reason TEXT,
  kyc_status VARCHAR(20) DEFAULT 'pending',
  kyc_verified_at TIMESTAMP WITH TIME ZONE,
  kyc_document_url TEXT,
  onboarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_phone CHECK (phone_number ~ '^\+263[0-9]{9}$'),
  CONSTRAINT valid_commission_rate CHECK (commission_rate BETWEEN 0 AND 100),
  CONSTRAINT valid_distributor_status CHECK (status IN ('active', 'suspended', 'inactive'))
);

CREATE INDEX idx_distributors_user ON distributors(user_id);
CREATE INDEX idx_distributors_phone ON distributors(phone_number);
CREATE INDEX idx_distributors_status ON distributors(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_distributors_location ON distributors(province, city) WHERE status = 'active';

COMMENT ON TABLE distributors IS 'Agent network management';

-- =============================================================================
-- TABLE: devices
-- Purpose: Device inventory catalog
-- =============================================================================
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  sku VARCHAR(50) UNIQUE NOT NULL,
  imei VARCHAR(20) UNIQUE,
  ram_gb INTEGER,
  storage_gb INTEGER,
  screen_size DECIMAL(3,1),
  battery_mah INTEGER,
  camera_mp VARCHAR(50),
  processor VARCHAR(100),
  os VARCHAR(50),
  cost_price DECIMAL(10,2) NOT NULL,
  retail_price DECIMAL(10,2) NOT NULL,
  financing_price DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0.00,
  primary_image_url TEXT,
  image_urls JSONB,
  status VARCHAR(20) DEFAULT 'available',
  distributor_id UUID REFERENCES distributors(id),
  warehouse_location VARCHAR(100),
  lock_provider VARCHAR(50),
  lock_provider_id VARCHAR(100),
  lock_enabled BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_device_status CHECK (status IN (
    'available', 'reserved', 'assigned', 'sold', 'damaged', 'returned'
  )),
  CONSTRAINT valid_pricing CHECK (financing_price >= retail_price AND retail_price >= cost_price)
);

CREATE INDEX idx_devices_sku ON devices(sku);
CREATE INDEX idx_devices_imei ON devices(imei) WHERE imei IS NOT NULL;
CREATE INDEX idx_devices_status ON devices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_distributor ON devices(distributor_id);
CREATE INDEX idx_devices_brand_model ON devices(brand, model);
CREATE INDEX idx_devices_featured ON devices(featured, sort_order) WHERE active = true;

COMMENT ON TABLE devices IS 'Device inventory catalog';

-- =============================================================================
-- TABLE: loans
-- Purpose: Loan applications and status
-- =============================================================================
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  device_id UUID REFERENCES devices(id) ON DELETE RESTRICT,
  distributor_id UUID REFERENCES distributors(id),
  principal DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  term_months INTEGER NOT NULL DEFAULT 8,
  monthly_payment DECIMAL(10,2) NOT NULL,
  total_repayment DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  disbursed_at TIMESTAMP WITH TIME ZONE,
  disbursed_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  outstanding_principal DECIMAL(10,2),
  outstanding_interest DECIMAL(10,2),
  total_paid DECIMAL(10,2) DEFAULT 0.00,
  last_payment_date DATE,
  next_payment_date DATE,
  missed_payments INTEGER DEFAULT 0,
  days_overdue INTEGER DEFAULT 0,
  credit_score_at_application INTEGER,
  approval_reason TEXT,
  auto_approved BOOLEAN DEFAULT false,
  fineract_loan_id BIGINT UNIQUE,
  fineract_account_number VARCHAR(50),
  fineract_sync_status VARCHAR(20) DEFAULT 'pending',
  fineract_sync_error TEXT,
  fineract_last_sync_at TIMESTAMP WITH TIME ZONE,
  device_assigned BOOLEAN DEFAULT false,
  device_assigned_at TIMESTAMP WITH TIME ZONE,
  device_imei VARCHAR(20),
  application_source VARCHAR(50) DEFAULT 'whatsapp',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_principal CHECK (principal BETWEEN 200 AND 500),
  CONSTRAINT valid_interest_rate CHECK (interest_rate >= 0),
  CONSTRAINT valid_term CHECK (term_months BETWEEN 1 AND 24),
  CONSTRAINT valid_loan_status CHECK (status IN (
    'draft', 'submitted', 'pending_approval', 'approved', 'rejected',
    'disbursed', 'active', 'paid', 'defaulted', 'written_off'
  ))
);

CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_device ON loans(device_id);
CREATE INDEX idx_loans_distributor ON loans(distributor_id);
CREATE INDEX idx_loans_status ON loans(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_loans_fineract_id ON loans(fineract_loan_id);
CREATE INDEX idx_loans_overdue ON loans(days_overdue) WHERE days_overdue > 0;
CREATE INDEX idx_loans_next_payment ON loans(next_payment_date) WHERE status = 'active';
CREATE INDEX idx_loans_created_at ON loans(created_at DESC);

COMMENT ON TABLE loans IS 'Loan applications and status';

-- =============================================================================
-- TABLE: device_assignments
-- Purpose: Track device-customer assignments
-- =============================================================================
CREATE TABLE device_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  imei VARCHAR(20) NOT NULL,
  serial_number VARCHAR(50),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_by UUID,
  id_verification_photo_url TEXT,
  device_condition_photo_url TEXT,
  customer_signature_url TEXT,
  lock_status VARCHAR(20) DEFAULT 'unlocked',
  lock_provider VARCHAR(50),
  lock_provider_device_id VARCHAR(100),
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_reason VARCHAR(100),
  unlocked_at TIMESTAMP WITH TIME ZONE,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  returned BOOLEAN DEFAULT false,
  returned_at TIMESTAMP WITH TIME ZONE,
  return_reason TEXT,
  return_condition VARCHAR(20),
  repossessed BOOLEAN DEFAULT false,
  repossessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_lock_status CHECK (lock_status IN ('unlocked', 'locked', 'permanent_unlock')),
  CONSTRAINT unique_device_assignment UNIQUE(device_id, loan_id)
);

CREATE INDEX idx_device_assignments_device ON device_assignments(device_id);
CREATE INDEX idx_device_assignments_customer ON device_assignments(customer_id);
CREATE INDEX idx_device_assignments_loan ON device_assignments(loan_id);
CREATE INDEX idx_device_assignments_imei ON device_assignments(imei);
CREATE INDEX idx_device_assignments_lock_status ON device_assignments(lock_status);
CREATE INDEX idx_device_assignments_grace_period ON device_assignments(grace_period_ends_at)
  WHERE lock_status = 'unlocked' AND grace_period_ends_at IS NOT NULL;

COMMENT ON TABLE device_assignments IS 'Track device-customer assignments';

-- Continue in next part...
