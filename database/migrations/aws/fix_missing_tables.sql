-- =====================================================
-- Fix Missing Tables for AWS RDS PostgreSQL
-- =====================================================
-- This script creates tables that were missing from the database due to
-- dependency ordering issues in 001_initial_schema.sql.
--
-- The original migration defined `loans` (line 139) with a foreign key to
-- `admin_users(id)`, but `admin_users` was not created until line 503.
-- This caused `loans` and all tables that depend on it to fail silently
-- when using CREATE TABLE IF NOT EXISTS.
--
-- Tables are created here in correct dependency order.
-- Uses CREATE TABLE IF NOT EXISTS for idempotent safety.
-- No RLS policies, no auth.uid(), no GRANT statements.
--
-- NOTE: `transactions` was reported as missing but has no schema definition
-- anywhere in the codebase. It is NOT created by this script. If a
-- `transactions` table is needed, a new migration should define its schema.
-- =====================================================

-- Ensure required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ADMIN_USERS TABLE (no dependencies on other missing tables)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Authentication
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),

  -- Personal Info
  full_name VARCHAR(200) NOT NULL,
  phone_number VARCHAR(20),

  -- Role & Permissions
  role VARCHAR(50) NOT NULL,  -- admin, manager, support, reports_viewer
  permissions JSONB,

  -- Status
  status VARCHAR(50) DEFAULT 'active',  -- active, inactive, suspended
  last_login_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

-- =====================================================
-- 2. LOANS TABLE (depends on: customers, loan_products, admin_users)
-- =====================================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID REFERENCES loan_products(id),

  -- Loan Details
  loan_number VARCHAR(50) UNIQUE NOT NULL,
  loan_amount_usd DECIMAL(10, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL,
  loan_term_months INTEGER NOT NULL DEFAULT 6,

  -- Deposit
  deposit_amount_usd DECIMAL(10, 2) NOT NULL,
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_paid_at TIMESTAMP WITH TIME ZONE,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, rejected, disbursed, active, paid_off, defaulted
  approval_status VARCHAR(50),  -- auto_approved, manual_review, rejected
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES admin_users(id),

  -- Disbursement
  disbursed_at TIMESTAMP WITH TIME ZONE,
  disbursed_amount_usd DECIMAL(10, 2),

  -- Repayment
  total_amount_due_usd DECIMAL(10, 2),
  total_paid_usd DECIMAL(10, 2) DEFAULT 0,
  outstanding_balance_usd DECIMAL(10, 2),
  next_payment_date DATE,
  next_payment_amount_usd DECIMAL(10, 2),

  -- Delinquency
  days_past_due INTEGER DEFAULT 0,
  missed_payments_count INTEGER DEFAULT 0,
  last_payment_date DATE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,

  -- Fineract Integration
  fineract_loan_id INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_product ON loans(product_id);
CREATE INDEX IF NOT EXISTS idx_loans_next_payment_date ON loans(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_loans_days_past_due ON loans(days_past_due);

-- =====================================================
-- 3. PAYMENTS TABLE (depends on: loans, customers, admin_users)
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Payment Details
  payment_type VARCHAR(50) NOT NULL,  -- deposit, installment, late_fee, early_payoff
  amount_usd DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Payment Method
  payment_method VARCHAR(50) NOT NULL,  -- ecocash, onemoney, bank_transfer, cash
  payment_provider VARCHAR(50),

  -- Transaction
  transaction_id VARCHAR(200) UNIQUE,  -- External provider transaction ID
  reference_number VARCHAR(200),

  -- Status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, confirmed, failed, refunded
  confirmed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,

  -- Reconciliation
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID REFERENCES admin_users(id),

  -- Metadata
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Provider Response (JSON)
  provider_response JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- =====================================================
-- 4. KYC_SUBMISSIONS TABLE (depends on: customers, admin_users)
-- =====================================================
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Submission Details
  submission_number VARCHAR(50) UNIQUE NOT NULL,
  attempt_number INTEGER DEFAULT 1,  -- Max 3 attempts

  -- Document Upload
  id_document_url TEXT NOT NULL,
  id_document_type VARCHAR(50) DEFAULT 'national_id',
  id_number VARCHAR(100),
  selfie_url TEXT NOT NULL,

  -- Verification Results
  verification_id VARCHAR(200),  -- Smile Identity verification ID
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_review, approved, rejected
  confidence_score INTEGER,  -- 0-100
  face_match_score INTEGER,  -- 0-100
  liveness_passed BOOLEAN,

  -- ID Data Extracted
  extracted_name VARCHAR(200),
  extracted_dob DATE,
  extracted_id_number VARCHAR(100),
  extracted_data JSONB,

  -- Review
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES admin_users(id),
  rejection_reason TEXT,

  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Smile Identity Response
  smile_identity_response JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kyc_customer ON kyc_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_verification_id ON kyc_submissions(verification_id);

-- =====================================================
-- 5. CREDIT_SCORES TABLE (depends on: customers, loans)
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  customer_id UUID NOT NULL REFERENCES customers(id),
  loan_id UUID REFERENCES loans(id),

  -- Score
  total_score INTEGER NOT NULL,  -- 0-1000 raw points
  scaled_score INTEGER NOT NULL,  -- 300-850 FICO-like scale

  -- Components (5-component model)
  affordability_score INTEGER,  -- 0-300
  repayment_willingness_score INTEGER,  -- 0-250
  mobile_money_score INTEGER,  -- 0-200
  external_credit_score INTEGER,  -- 0-150
  kyc_verification_score INTEGER,  -- 0-100

  -- Decision
  decision VARCHAR(50) NOT NULL,  -- approve, review, reject
  credit_tier VARCHAR(20),  -- Tier 1, Tier 2, Tier 3
  recommended_limit_usd DECIMAL(10, 2),

  -- Model Info
  model_version VARCHAR(50) DEFAULT 'rule-based-v1',
  scoring_data JSONB,

  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculated_by VARCHAR(100) DEFAULT 'system',
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_scores_customer ON credit_scores(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_loan ON credit_scores(loan_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_scaled_score ON credit_scores(scaled_score);
CREATE INDEX IF NOT EXISTS idx_credit_scores_decision ON credit_scores(decision);

-- =====================================================
-- 6. DEVICES TABLE (depends on: loans, customers)
-- =====================================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Device Identification
  imei VARCHAR(50) UNIQUE NOT NULL,
  serial_number VARCHAR(100),

  -- Device Details
  manufacturer VARCHAR(100),
  model VARCHAR(200),
  device_type VARCHAR(50) DEFAULT 'smartphone',

  -- Specifications
  storage_gb INTEGER,
  color VARCHAR(50),
  condition VARCHAR(50) DEFAULT 'new',  -- new, grade_a, grade_b, grade_c

  -- Pricing
  purchase_price_usd DECIMAL(10, 2),
  retail_price_usd DECIMAL(10, 2),

  -- Assignment
  loan_id UUID REFERENCES loans(id),
  customer_id UUID REFERENCES customers(id),
  assigned_at TIMESTAMP WITH TIME ZONE,

  -- Lock Status
  lock_status VARCHAR(50) DEFAULT 'unlocked',  -- unlocked, locked, emergency_unlocked
  locked_at TIMESTAMP WITH TIME ZONE,
  lock_reason VARCHAR(200),

  -- Inventory
  status VARCHAR(50) DEFAULT 'in_stock',  -- in_stock, assigned, returned, sold, lost
  location VARCHAR(200),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_loan ON devices(loan_id);
CREATE INDEX IF NOT EXISTS idx_devices_customer ON devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_lock_status ON devices(lock_status);

-- =====================================================
-- 7. DEVICE_LOCKS TABLE (depends on: devices, loans, customers, admin_users)
-- =====================================================
CREATE TABLE IF NOT EXISTS device_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  device_id UUID NOT NULL REFERENCES devices(id),
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Lock Event
  action VARCHAR(50) NOT NULL,  -- lock, unlock, emergency_unlock
  reason VARCHAR(200),

  -- Lock Details
  lock_type VARCHAR(50),  -- auto_payment_missed, manual_admin, test
  days_past_due INTEGER,

  -- Execution
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by UUID REFERENCES admin_users(id),
  execution_status VARCHAR(50) DEFAULT 'pending',  -- pending, success, failed

  -- Provider Response
  lock_provider VARCHAR(50),  -- google, samsung, etc.
  provider_response JSONB,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_locks_device ON device_locks(device_id);
CREATE INDEX IF NOT EXISTS idx_device_locks_loan ON device_locks(loan_id);
CREATE INDEX IF NOT EXISTS idx_device_locks_action ON device_locks(action);
CREATE INDEX IF NOT EXISTS idx_device_locks_executed_at ON device_locks(executed_at);

-- =====================================================
-- 8. DISTRIBUTORS TABLE (depends on: admin_users)
-- =====================================================
CREATE TABLE IF NOT EXISTS distributors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Business Details
  business_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(200) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),

  -- Address
  address_line1 TEXT,
  city VARCHAR(100),
  province VARCHAR(100),

  -- Bank Details
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  account_name VARCHAR(200),

  -- Status
  status VARCHAR(50) DEFAULT 'active',  -- active, inactive, suspended
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES admin_users(id),

  -- Performance
  total_devices_sold INTEGER DEFAULT 0,
  total_revenue_usd DECIMAL(12, 2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_distributors_status ON distributors(status);
CREATE INDEX IF NOT EXISTS idx_distributors_phone ON distributors(phone_number);

-- =====================================================
-- 9. AGENT_INVENTORY TABLE (depends on: distributors, devices, customers, loans)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  device_id UUID REFERENCES devices(id),

  -- Inventory Details
  assigned_date DATE NOT NULL,
  quantity INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'available',  -- available, sold, returned, damaged

  -- Sale/Return
  sold_date DATE,
  sold_to_customer_id UUID REFERENCES customers(id),
  sold_loan_id UUID REFERENCES loans(id),
  returned_date DATE,
  return_reason TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_inventory_distributor ON agent_inventory(distributor_id);
CREATE INDEX IF NOT EXISTS idx_agent_inventory_device ON agent_inventory(device_id);
CREATE INDEX IF NOT EXISTS idx_agent_inventory_status ON agent_inventory(status);

-- =====================================================
-- 10. NOTIFICATIONS TABLE (depends on: customers, loans)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  customer_id UUID REFERENCES customers(id),
  loan_id UUID REFERENCES loans(id),

  -- Notification Details
  type VARCHAR(100) NOT NULL,  -- sms, whatsapp, email, push
  template VARCHAR(100),
  subject VARCHAR(200),
  message TEXT NOT NULL,

  -- Recipient
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, sent, delivered, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,

  -- Provider
  provider VARCHAR(50),  -- twilio, whatsapp, etc.
  provider_message_id VARCHAR(200),
  provider_response JSONB,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_loan ON notifications(loan_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- =====================================================
-- 11. SUPPORT_TICKETS TABLE (depends on: customers, loans, admin_users)
-- =====================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  customer_id UUID REFERENCES customers(id),
  loan_id UUID REFERENCES loans(id),

  -- Ticket Details
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,  -- payment_issue, device_issue, kyc_issue, etc.
  priority VARCHAR(50) DEFAULT 'medium',  -- low, medium, high, urgent

  -- Content
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'open',  -- open, in_progress, resolved, closed

  -- Assignment
  assigned_to UUID REFERENCES admin_users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,

  -- Resolution
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES admin_users(id),
  resolution_notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);

-- =====================================================
-- NOTE ON `transactions` TABLE
-- =====================================================
-- The `transactions` table was reported as missing, but no schema definition
-- for it exists in 001_initial_schema.sql or any other migration file.
-- Payments are tracked via the `payments` table. If a separate `transactions`
-- table is required, it should be defined in a new migration with its own
-- schema design review.

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
-- Recreate the trigger function (IF NOT EXISTS is not supported for functions,
-- so we use CREATE OR REPLACE which is safe for re-runs).

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all newly created tables that have an updated_at column.
-- Using DO block to skip triggers that already exist.
DO $$
BEGIN
  -- admin_users
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_users_updated_at') THEN
    CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- loans
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_loans_updated_at') THEN
    CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- payments
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at') THEN
    CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- kyc_submissions (no updated_at column in original schema, skip)

  -- devices
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_devices_updated_at') THEN
    CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- distributors
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_distributors_updated_at') THEN
    CREATE TRIGGER update_distributors_updated_at
    BEFORE UPDATE ON distributors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- agent_inventory
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_inventory_updated_at') THEN
    CREATE TRIGGER update_agent_inventory_updated_at
    BEFORE UPDATE ON agent_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- notifications
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notifications_updated_at') THEN
    CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- support_tickets
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_support_tickets_updated_at') THEN
    CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'fix_missing_tables.sql completed successfully.';
  RAISE NOTICE 'Created 11 tables (if not already present):';
  RAISE NOTICE '  1. admin_users';
  RAISE NOTICE '  2. loans';
  RAISE NOTICE '  3. payments';
  RAISE NOTICE '  4. kyc_submissions';
  RAISE NOTICE '  5. credit_scores';
  RAISE NOTICE '  6. devices';
  RAISE NOTICE '  7. device_locks';
  RAISE NOTICE '  8. distributors';
  RAISE NOTICE '  9. agent_inventory';
  RAISE NOTICE '  10. notifications';
  RAISE NOTICE '  11. support_tickets';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTE: transactions table was NOT created (no schema definition exists).';
  RAISE NOTICE 'Verify with: SELECT tablename FROM pg_tables WHERE schemaname = ''public'' ORDER BY tablename;';
END;
$$;
