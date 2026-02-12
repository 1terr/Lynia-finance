-- =====================================================
-- Lynia Finance - COMBINED DATABASE DEPLOYMENT
-- All Migrations + Test Data in One File
-- Run this entire file in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- MIGRATION 001: Initial Schema (19 Tables)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CUSTOMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Phone & Authentication
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  country_code VARCHAR(5) DEFAULT '+263' NOT NULL,
  phone_verified BOOLEAN DEFAULT FALSE,
  email VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,

  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(20),

  -- Employment
  employment_status VARCHAR(50),  -- self_employed, employed, unemployed
  employment_type VARCHAR(100),    -- Collected but not scored in Phase 1
  monthly_income_usd DECIMAL(10, 2),

  -- Household
  household_size INTEGER,
  dependents INTEGER,
  existing_debt_obligations_usd DECIMAL(10, 2) DEFAULT 0,

  -- KYC Status
  kyc_status VARCHAR(50) DEFAULT 'pending',  -- pending, in_review, approved, rejected, expired
  kyc_verified_at TIMESTAMP WITH TIME ZONE,
  kyc_expires_at TIMESTAMP WITH TIME ZONE,

  -- Credit Status
  credit_score INTEGER,  -- 300-850
  credit_tier VARCHAR(20),  -- Tier 1, Tier 2, Tier 3
  credit_limit_usd DECIMAL(10, 2) DEFAULT 0,

  -- Onboarding
  onboarding_status VARCHAR(50) DEFAULT 'in_progress',  -- in_progress, completed, abandoned
  onboarding_current_step INTEGER DEFAULT 1,  -- 1-8
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,

  -- Soft Delete
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_kyc_status ON customers(kyc_status);
CREATE INDEX idx_customers_credit_score ON customers(credit_score);
CREATE INDEX idx_customers_onboarding_status ON customers(onboarding_status);

-- =====================================================
-- 2. LOAN_PRODUCTS TABLE (NEW)
-- =====================================================
CREATE TABLE IF NOT EXISTS loan_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Product Identification
  product_code VARCHAR(50) UNIQUE NOT NULL,  -- e.g., SMRT_FIN_001
  product_name VARCHAR(200) NOT NULL,
  product_type VARCHAR(50) NOT NULL,  -- asset_financing, digital_credit

  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- active, inactive, launching_soon

  -- Fineract Integration
  fineract_product_id INTEGER,

  -- Loan Terms
  min_amount_usd DECIMAL(10, 2) DEFAULT 50,
  max_amount_usd DECIMAL(10, 2) DEFAULT 500,
  loan_term_months INTEGER DEFAULT 6,
  interest_rate_annual DECIMAL(5, 2) DEFAULT 12.00,  -- 12% APR

  -- Deposit Requirements
  deposit_percentage DECIMAL(5, 2) DEFAULT 10.00,  -- 10% down payment
  min_deposit_usd DECIMAL(10, 2) DEFAULT 20,

  -- Scoring Configuration (JSON)
  scoring_config JSONB,  -- Product-specific scoring weights

  -- Metadata
  description TEXT,
  terms_and_conditions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_loan_products_type ON loan_products(product_type);
CREATE INDEX idx_loan_products_status ON loan_products(status);

-- Insert default product
INSERT INTO loan_products (
  product_code,
  product_name,
  product_type,
  status,
  max_amount_usd,
  description
) VALUES (
  'SMRT_FIN_001',
  'Smartphone Financing',
  'asset_financing',
  'active',
  500,
  'Asset financing for smartphones with 6-month repayment period'
);

-- =====================================================
-- 3. ADMIN_USERS TABLE (MOVED HERE - referenced by other tables)
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Authentication
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),  -- Handled by Supabase Auth

  -- Personal Info
  full_name VARCHAR(200) NOT NULL,
  phone_number VARCHAR(20),

  -- Role & Permissions
  role VARCHAR(50) NOT NULL,  -- admin, manager, support, reports_viewer
  permissions JSONB,  -- Custom permissions

  -- Status
  status VARCHAR(50) DEFAULT 'active',  -- active, inactive, suspended
  last_login_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,  -- Will add foreign key constraint after table exists
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_status ON admin_users(status);

-- Add self-referencing foreign key AFTER table is created
ALTER TABLE admin_users
ADD CONSTRAINT fk_admin_users_created_by
FOREIGN KEY (created_by) REFERENCES admin_users(id);

-- =====================================================
-- 4. LOANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID REFERENCES loan_products(id),

  -- Loan Details
  loan_number VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated
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
  total_amount_due_usd DECIMAL(10, 2),  -- Principal + Interest
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
CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_product ON loans(product_id);
CREATE INDEX idx_loans_next_payment_date ON loans(next_payment_date);
CREATE INDEX idx_loans_days_past_due ON loans(days_past_due);

-- =====================================================
-- 4. PAYMENTS TABLE
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
CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- =====================================================
-- 5. KYC_SUBMISSIONS TABLE
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
  extracted_data JSONB,  -- Full extracted data

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
CREATE INDEX idx_kyc_customer ON kyc_submissions(customer_id);
CREATE INDEX idx_kyc_status ON kyc_submissions(status);
CREATE INDEX idx_kyc_verification_id ON kyc_submissions(verification_id);

-- =====================================================
-- 6. CREDIT_SCORES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  customer_id UUID NOT NULL REFERENCES customers(id),
  loan_id UUID REFERENCES loans(id),

  -- Score
  total_score INTEGER NOT NULL,  -- 0-1000 raw points
  scaled_score INTEGER NOT NULL,  -- 300-850 FICO-like scale

  -- Components (NEW 5-component model)
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
  scoring_data JSONB,  -- All input data used for scoring

  -- Metadata
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculated_by VARCHAR(100) DEFAULT 'system',
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_credit_scores_customer ON credit_scores(customer_id);
CREATE INDEX idx_credit_scores_loan ON credit_scores(loan_id);
CREATE INDEX idx_credit_scores_scaled_score ON credit_scores(scaled_score);
CREATE INDEX idx_credit_scores_decision ON credit_scores(decision);

-- =====================================================
-- 7. DEVICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Device Identification
  imei VARCHAR(50) UNIQUE NOT NULL,
  serial_number VARCHAR(100),

  -- Device Details
  manufacturer VARCHAR(100),  -- Samsung, Apple, etc.
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
  location VARCHAR(200),  -- Warehouse or agent location

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_devices_imei ON devices(imei);
CREATE INDEX idx_devices_loan ON devices(loan_id);
CREATE INDEX idx_devices_customer ON devices(customer_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_lock_status ON devices(lock_status);

-- =====================================================
-- 8. DEVICE_LOCKS TABLE
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
CREATE INDEX idx_device_locks_device ON device_locks(device_id);
CREATE INDEX idx_device_locks_loan ON device_locks(loan_id);
CREATE INDEX idx_device_locks_action ON device_locks(action);
CREATE INDEX idx_device_locks_executed_at ON device_locks(executed_at);

-- =====================================================
-- 9. DISTRIBUTORS TABLE (Agents)
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
CREATE INDEX idx_distributors_status ON distributors(status);
CREATE INDEX idx_distributors_phone ON distributors(phone_number);

-- =====================================================
-- 10. AGENT_INVENTORY TABLE (NEW)
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
CREATE INDEX idx_agent_inventory_distributor ON agent_inventory(distributor_id);
CREATE INDEX idx_agent_inventory_device ON agent_inventory(device_id);
CREATE INDEX idx_agent_inventory_status ON agent_inventory(status);

-- =====================================================
-- 11. ADMIN_USERS TABLE (CREATED EARLIER - SEE TABLE #3)
-- =====================================================
-- Note: admin_users table moved before loans table to fix foreign key dependencies

-- =====================================================
-- 12. NOTIFICATIONS TABLE
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
CREATE INDEX idx_notifications_customer ON notifications(customer_id);
CREATE INDEX idx_notifications_loan ON notifications(loan_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_status ON notifications(status);

-- =====================================================
-- 13. SUPPORT_TICKETS TABLE
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
CREATE INDEX idx_support_tickets_customer ON support_tickets(customer_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_category ON support_tickets(category);

-- =====================================================
-- 14. INTERNATIONAL_INTEREST TABLE (NEW - Zimbabwe Only Policy)
-- =====================================================
CREATE TABLE IF NOT EXISTS international_interest (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Contact Details
  phone_number VARCHAR(20) NOT NULL,
  country_code VARCHAR(5) NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(200),

  -- Location
  country VARCHAR(100),
  city VARCHAR(100),

  -- Interest
  product_interest VARCHAR(100),  -- smartphone, motorbike, digital_credit

  -- Status
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_international_interest_country ON international_interest(country);
CREATE INDEX idx_international_interest_notified ON international_interest(notified);

-- =====================================================
-- 15. PRODUCT_INTEREST_WAITLIST TABLE (NEW - "Launching Soon")
-- =====================================================
CREATE TABLE IF NOT EXISTS product_interest_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES loan_products(id),

  -- Contact
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),

  -- Interest
  product_code VARCHAR(50) NOT NULL,  -- e.g., DIGI_CREDIT_001
  product_name VARCHAR(200),

  -- Status
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMP WITH TIME ZONE,
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_waitlist_product ON product_interest_waitlist(product_id);
CREATE INDEX idx_product_waitlist_customer ON product_interest_waitlist(customer_id);
CREATE INDEX idx_product_waitlist_notified ON product_interest_waitlist(notified);

-- =====================================================
-- 16. WHATSAPP_SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User
  phone_number VARCHAR(20) NOT NULL,
  customer_id UUID REFERENCES customers(id),

  -- Session
  whatsapp_id VARCHAR(200),  -- WhatsApp user ID
  current_state VARCHAR(100) DEFAULT 'welcome',
  session_data JSONB,  -- Store state machine data

  -- Activity
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,

  -- Session Control
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX idx_whatsapp_sessions_customer ON whatsapp_sessions(customer_id);
CREATE INDEX idx_whatsapp_sessions_state ON whatsapp_sessions(current_state);
CREATE INDEX idx_whatsapp_sessions_active ON whatsapp_sessions(active);

-- =====================================================
-- 17. WHATSAPP_MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Session
  session_id UUID REFERENCES whatsapp_sessions(id),
  phone_number VARCHAR(20) NOT NULL,

  -- Message
  message_id VARCHAR(200) UNIQUE,  -- WhatsApp message ID
  direction VARCHAR(20) NOT NULL,  -- inbound, outbound
  message_type VARCHAR(50),  -- text, image, document, button, etc.
  content TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'sent',  -- sent, delivered, read, failed

  -- Metadata
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Provider Response
  provider_response JSONB
);

-- Indexes
CREATE INDEX idx_whatsapp_messages_session ON whatsapp_messages(session_id);
CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_direction ON whatsapp_messages(direction);
CREATE INDEX idx_whatsapp_messages_sent_at ON whatsapp_messages(sent_at);

-- =====================================================
-- 18. AUDIT_LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Actor
  user_id UUID,  -- Can be admin_users.id or customers.id
  user_type VARCHAR(50),  -- admin, customer, system
  user_email VARCHAR(255),

  -- Action
  action VARCHAR(100) NOT NULL,  -- login, create_loan, approve_loan, etc.
  entity_type VARCHAR(100),  -- loan, customer, payment, etc.
  entity_id UUID,

  -- Details
  description TEXT,
  changes JSONB,  -- Before/after values

  -- Request Info
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- =====================================================
-- 19. SYSTEM_CONFIG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Config Key
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,

  -- Metadata
  description TEXT,
  updated_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configs
INSERT INTO system_config (config_key, config_value, description) VALUES
('credit_scoring_weights', '{"affordability": 0.30, "repayment_willingness": 0.25, "mobile_money": 0.20, "external_credit": 0.15, "kyc_verification": 0.10}', 'Credit scoring component weights'),
('credit_tiers', '{"tier1": {"min_score": 650, "max_score": 699, "limit": 200}, "tier2": {"min_score": 700, "max_score": 749, "limit": 350}, "tier3": {"min_score": 750, "max_score": 850, "limit": 500}}', 'Credit limit tiers'),
('auto_lock_days', '7', 'Days past due before auto device lock'),
('max_kyc_attempts', '3', 'Maximum KYC submission attempts'),
('onboarding_timeout_days', '7', 'Days before onboarding session expires');

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE international_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_interest_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (Basic - expand as needed)
-- =====================================================

-- Customers can view their own data
CREATE POLICY "Customers view own data"
ON customers FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can view all customers
CREATE POLICY "Admins view all customers"
ON customers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
    AND status = 'active'
  )
);

-- loan_products: authenticated users can view active products, admins manage all
CREATE POLICY "Authenticated users can view active loan products"
ON loan_products FOR SELECT
TO authenticated
USING (
    status = 'active'
    OR EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

CREATE POLICY "Admins manage loan products"
ON loan_products FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- international_interest: admin-only access (inserts via service role)
CREATE POLICY "Admins manage international interest"
ON international_interest FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- product_interest_waitlist: customers see own entries, admins manage all
CREATE POLICY "Customers view own waitlist entries"
ON product_interest_waitlist FOR SELECT
TO authenticated
USING (
    customer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

CREATE POLICY "Admins manage product waitlist"
ON product_interest_waitlist FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- system_config: admin-only access
CREATE POLICY "Admins manage system config"
ON system_config FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- =====================================================
-- SECURITY DEFINER helper functions for RLS role checks
-- =====================================================
-- These run as the function owner (bypassing RLS on
-- admin_users) to prevent circular evaluation when used
-- in admin_users' own policies.

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'support', 'reports_viewer')
      AND status = 'active'
  );
$$;

-- =====================================================
-- RLS POLICIES: admin_users
-- =====================================================

CREATE POLICY "Staff view own profile"
ON public.admin_users FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins manage all staff"
ON public.admin_users FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: agent_inventory
-- =====================================================

CREATE POLICY "Distributors view own inventory"
ON public.agent_inventory FOR SELECT
TO authenticated
USING (
  distributor_id = auth.uid()
  OR public.is_admin_or_manager()
);

CREATE POLICY "Admins manage agent inventory"
ON public.agent_inventory FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: audit_log
-- =====================================================

CREATE POLICY "Admins view audit log"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: credit_scores
-- =====================================================

CREATE POLICY "Customers and staff view credit scores"
ON public.credit_scores FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage credit scores"
ON public.credit_scores FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: device_locks
-- =====================================================

CREATE POLICY "Customers and staff view device locks"
ON public.device_locks FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage device locks"
ON public.device_locks FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: devices
-- =====================================================

CREATE POLICY "Customers and staff view devices"
ON public.devices FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage devices"
ON public.devices FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: distributors
-- =====================================================

CREATE POLICY "Distributors view own profile"
ON public.distributors FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin_or_manager()
);

CREATE POLICY "Admins manage distributors"
ON public.distributors FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: kyc_submissions
-- =====================================================

CREATE POLICY "Customers and staff view KYC submissions"
ON public.kyc_submissions FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage KYC submissions"
ON public.kyc_submissions FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: loans
-- =====================================================

CREATE POLICY "Customers and staff view loans"
ON public.loans FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage loans"
ON public.loans FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: notifications
-- =====================================================

CREATE POLICY "Customers and staff view notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage notifications"
ON public.notifications FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: payments
-- =====================================================

CREATE POLICY "Customers and staff view payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage payments"
ON public.payments FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: support_tickets
-- =====================================================

CREATE POLICY "Customers and staff view support tickets"
ON public.support_tickets FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage support tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: whatsapp_messages
-- =====================================================

CREATE POLICY "Staff view WhatsApp messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (public.is_admin_staff());

CREATE POLICY "Admins manage WhatsApp messages"
ON public.whatsapp_messages FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- RLS POLICIES: whatsapp_sessions
-- =====================================================

CREATE POLICY "Staff view WhatsApp sessions"
ON public.whatsapp_sessions FOR SELECT
TO authenticated
USING (public.is_admin_staff());

CREATE POLICY "Admins manage WhatsApp sessions"
ON public.whatsapp_sessions FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
BEFORE UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MATERIALIZED VIEWS (For Reporting Performance)
-- =====================================================

-- Portfolio Summary View
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_portfolio_summary AS
SELECT
  COUNT(DISTINCT l.id) AS total_loans,
  COUNT(DISTINCT l.customer_id) AS total_customers,
  SUM(l.loan_amount_usd) AS total_disbursed_usd,
  SUM(l.outstanding_balance_usd) AS total_outstanding_usd,
  SUM(l.total_paid_usd) AS total_collected_usd,
  AVG(l.days_past_due) AS avg_days_past_due,
  COUNT(CASE WHEN l.status = 'active' THEN 1 END) AS active_loans,
  COUNT(CASE WHEN l.days_past_due > 30 THEN 1 END) AS delinquent_loans
FROM loans l
WHERE l.status NOT IN ('rejected', 'cancelled');

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_portfolio_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_portfolio_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPLETION MESSAGE FOR MIGRATION 001
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 001: Initial schema created successfully!';
  RAISE NOTICE '📊 Total tables: 19';
END $$;

-- =====================================================
-- MIGRATION 002: Distributor Commissions
-- =====================================================

CREATE TABLE IF NOT EXISTS distributor_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  loan_id UUID NOT NULL REFERENCES loans(id),
  device_id UUID NOT NULL REFERENCES devices(id),

  -- Commission Details
  commission_amount_usd DECIMAL(10, 2) NOT NULL,
  commission_percentage DECIMAL(5, 2) NOT NULL,  -- e.g., 5.00 for 5%
  device_retail_price_usd DECIMAL(10, 2) NOT NULL,

  -- Payment Status
  payment_status VARCHAR(50) DEFAULT 'pending',  -- pending, paid, cancelled
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_reference VARCHAR(200),

  -- Metadata
  calculation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_distributor_commissions_distributor ON distributor_commissions(distributor_id);
CREATE INDEX idx_distributor_commissions_loan ON distributor_commissions(loan_id);
CREATE INDEX idx_distributor_commissions_device ON distributor_commissions(device_id);
CREATE INDEX idx_distributor_commissions_status ON distributor_commissions(payment_status);
CREATE INDEX idx_distributor_commissions_date ON distributor_commissions(calculation_date DESC);

-- Trigger: Update updated_at timestamp
CREATE TRIGGER update_distributor_commissions_updated_at
BEFORE UPDATE ON distributor_commissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RPC Function: Increment distributor statistics
CREATE OR REPLACE FUNCTION increment_distributor_stats(
  dist_id UUID,
  devices_sold INTEGER DEFAULT 0,
  revenue DECIMAL(12, 2) DEFAULT 0
)
RETURNS void AS $$
BEGIN
  UPDATE distributors
  SET
    total_devices_sold = total_devices_sold + devices_sold,
    total_revenue_usd = total_revenue_usd + revenue,
    updated_at = NOW()
  WHERE id = dist_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE distributor_commissions ENABLE ROW LEVEL SECURITY;

-- Policy: Distributors can view their own commissions
CREATE POLICY "Distributors view own commissions"
ON distributor_commissions FOR SELECT
TO authenticated
USING (distributor_id = auth.uid());

-- Policy: Admins can view all commissions
CREATE POLICY "Admins view all commissions"
ON distributor_commissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
    AND status = 'active'
  )
);

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 002: Distributor commissions table created!';
END $$;

-- =====================================================
-- MIGRATION 003: Trustonic Device Fields
-- =====================================================

-- Add Trustonic device enrollment fields
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS trustonic_device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS trustonic_enrolled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trustonic_enrolled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trustonic_enrollment_status VARCHAR(50) DEFAULT 'pending';

-- Add indexes for Trustonic queries
CREATE INDEX IF NOT EXISTS idx_devices_trustonic_device_id ON devices(trustonic_device_id);
CREATE INDEX IF NOT EXISTS idx_devices_trustonic_enrolled ON devices(trustonic_enrolled);

-- Add lock_reason field (optional - for storing why device was locked)
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(200);

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 003: Trustonic device fields added!';
END $$;

-- =====================================================
-- TEST SEED DATA
-- =====================================================

-- 1. TEST ADMIN USERS
INSERT INTO admin_users (id, email, full_name, role, status) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@lynia.finance', 'System Administrator', 'admin', 'active'),
('00000000-0000-0000-0000-000000000002', 'manager@lynia.finance', 'Loan Manager', 'manager', 'active'),
('00000000-0000-0000-0000-000000000003', 'support@lynia.finance', 'Support Agent', 'support', 'active');

-- 2. TEST DISTRIBUTORS (Agents)
INSERT INTO distributors (id, business_name, contact_person, phone_number, email, city, province, status) VALUES
('00000000-0000-0000-0000-000000000011', 'Harare Mobile Hub', 'John Moyo', '+263771234567', 'harare@agents.lynia.co.zw', 'Harare', 'Harare', 'active'),
('00000000-0000-0000-0000-000000000012', 'Bulawayo Tech Shop', 'Sarah Ncube', '+263781234567', 'bulawayo@agents.lynia.co.zw', 'Bulawayo', 'Bulawayo', 'active');

-- 3. TEST LOAN PRODUCTS
INSERT INTO loan_products (
  id,
  product_code,
  product_name,
  product_type,
  status,
  min_amount_usd,
  max_amount_usd,
  loan_term_months,
  interest_rate_annual,
  deposit_percentage,
  description
) VALUES (
  '00000000-0000-0000-0000-000000000021',
  'DIGI_CREDIT_001',
  'Digital Credit',
  'digital_credit',
  'launching_soon',
  50,
  300,
  3,
  18.00,
  0,
  'Short-term digital credit for emergencies - Coming Soon!'
);

-- 4. TEST CUSTOMERS
INSERT INTO customers (
  id,
  phone_number,
  country_code,
  phone_verified,
  email,
  first_name,
  last_name,
  date_of_birth,
  gender,
  city,
  province,
  employment_status,
  monthly_income_usd,
  household_size,
  dependents,
  existing_debt_obligations_usd,
  kyc_status,
  kyc_verified_at,
  credit_score,
  credit_tier,
  credit_limit_usd,
  onboarding_status,
  onboarding_current_step,
  onboarding_completed_at
) VALUES
(
  '00000000-0000-0000-0000-000000000031',
  '+263771111111',
  '+263',
  TRUE,
  'customer1@test.com',
  'Tendai',
  'Mutasa',
  '1990-05-15',
  'male',
  'Harare',
  'Harare',
  'self_employed',
  450.00,
  3,
  1,
  50.00,
  'approved',
  NOW(),
  750,
  'Tier 3',
  500.00,
  'completed',
  8,
  NOW()
),
(
  '00000000-0000-0000-0000-000000000032',
  '+263772222222',
  '+263',
  TRUE,
  'customer2@test.com',
  'Rudo',
  'Chimukoko',
  '1995-08-20',
  'female',
  'Bulawayo',
  'Bulawayo',
  'employed',
  300.00,
  4,
  2,
  75.00,
  'approved',
  NOW(),
  700,
  'Tier 2',
  350.00,
  'completed',
  8,
  NOW()
),
(
  '00000000-0000-0000-0000-000000000033',
  '+263773333333',
  '+263',
  TRUE,
  'Takudzwa',
  'Chivasa',
  'pending',
  'in_progress',
  4
);

-- 5. TEST KYC SUBMISSIONS
INSERT INTO kyc_submissions (
  id,
  customer_id,
  submission_number,
  attempt_number,
  id_document_url,
  selfie_url,
  id_number,
  status,
  confidence_score,
  face_match_score,
  liveness_passed,
  extracted_name,
  extracted_dob,
  verified_at
) VALUES
(
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031',
  'KYC-001',
  1,
  'https://storage.example.com/id_tendai.jpg',
  'https://storage.example.com/selfie_tendai.jpg',
  '63-1234567-A-11',
  'approved',
  96,
  95,
  TRUE,
  'Tendai Mutasa',
  '1990-05-15',
  NOW()
),
(
  '00000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000032',
  'KYC-002',
  1,
  'https://storage.example.com/id_rudo.jpg',
  'https://storage.example.com/selfie_rudo.jpg',
  '63-7654321-B-22',
  'approved',
  94,
  93,
  TRUE,
  'Rudo Chimukoko',
  '1995-08-20',
  NOW()
);

-- 6. TEST CREDIT SCORES
INSERT INTO credit_scores (
  id,
  customer_id,
  total_score,
  scaled_score,
  affordability_score,
  repayment_willingness_score,
  mobile_money_score,
  external_credit_score,
  kyc_verification_score,
  decision,
  credit_tier,
  recommended_limit_usd,
  model_version
) VALUES
(
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000031',
  820,
  751,
  280,
  125,
  180,
  140,
  95,
  'approve',
  'Tier 3',
  500.00,
  'rule-based-v1'
),
(
  '00000000-0000-0000-0000-000000000052',
  '00000000-0000-0000-0000-000000000032',
  730,
  702,
  250,
  125,
  155,
  105,
  95,
  'approve',
  'Tier 2',
  350.00,
  'rule-based-v1'
);

-- 7. TEST DEVICES
INSERT INTO devices (
  id,
  imei,
  serial_number,
  manufacturer,
  model,
  device_type,
  storage_gb,
  color,
  condition,
  purchase_price_usd,
  retail_price_usd,
  status,
  location
) VALUES
(
  '00000000-0000-0000-0000-000000000061',
  '351234567890123',
  'SN12345ABC',
  'Samsung',
  'Galaxy A14',
  'smartphone',
  64,
  'Black',
  'new',
  180.00,
  220.00,
  'in_stock',
  'Harare Warehouse'
),
(
  '00000000-0000-0000-0000-000000000062',
  '351234567890124',
  'SN12346DEF',
  'Samsung',
  'Galaxy A14',
  'smartphone',
  64,
  'Blue',
  'new',
  180.00,
  220.00,
  'in_stock',
  'Harare Warehouse'
),
(
  '00000000-0000-0000-0000-000000000063',
  '351234567890125',
  'SN12347GHI',
  'Redmi',
  'Note 12',
  'smartphone',
  128,
  'Green',
  'new',
  200.00,
  250.00,
  'in_stock',
  'Bulawayo Warehouse'
);

-- 8. TEST LOANS
INSERT INTO loans (
  id,
  customer_id,
  product_id,
  loan_number,
  loan_amount_usd,
  interest_rate,
  loan_term_months,
  deposit_amount_usd,
  deposit_paid,
  deposit_paid_at,
  status,
  approval_status,
  approved_at,
  approved_by,
  disbursed_at,
  disbursed_amount_usd,
  total_amount_due_usd,
  total_paid_usd,
  outstanding_balance_usd,
  next_payment_date,
  next_payment_amount_usd,
  days_past_due,
  missed_payments_count
) VALUES
(
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000020',
  'LN-2025-001',
  200.00,
  12.00,
  6,
  20.00,
  TRUE,
  NOW() - INTERVAL '2 days',
  'active',
  'auto_approved',
  NOW() - INTERVAL '2 days',
  '00000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '1 day',
  200.00,
  224.00,
  37.33,
  186.67,
  CURRENT_DATE + INTERVAL '28 days',
  37.33,
  0,
  0
),
(
  '00000000-0000-0000-0000-000000000072',
  '00000000-0000-0000-0000-000000000032',
  '00000000-0000-0000-0000-000000000020',
  'LN-2025-002',
  350.00,
  12.00,
  6,
  35.00,
  TRUE,
  NOW() - INTERVAL '1 day',
  'approved',
  'auto_approved',
  NOW() - INTERVAL '1 day',
  '00000000-0000-0000-0000-000000000001',
  392.00
);

-- 9. TEST PAYMENTS
INSERT INTO payments (
  id,
  loan_id,
  customer_id,
  payment_type,
  amount_usd,
  payment_method,
  payment_provider,
  transaction_id,
  status,
  confirmed_at,
  reconciled,
  payment_date
) VALUES
(
  '00000000-0000-0000-0000-000000000081',
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000031',
  'deposit',
  20.00,
  'ecocash',
  'EcoCash',
  'ECO-TXN-001',
  'confirmed',
  NOW() - INTERVAL '2 days',
  TRUE,
  NOW() - INTERVAL '2 days'
),
(
  '00000000-0000-0000-0000-000000000082',
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000031',
  'installment',
  37.33,
  'ecocash',
  'EcoCash',
  'ECO-TXN-002',
  'confirmed',
  NOW() - INTERVAL '1 day',
  TRUE,
  NOW() - INTERVAL '1 day'
),
(
  '00000000-0000-0000-0000-000000000083',
  '00000000-0000-0000-0000-000000000072',
  '00000000-0000-0000-0000-000000000032',
  'deposit',
  35.00,
  'onemoney',
  'OneMoney',
  'ONE-TXN-001',
  'confirmed',
  NOW() - INTERVAL '1 day',
  TRUE,
  NOW() - INTERVAL '1 day'
);

-- 10. TEST NOTIFICATIONS
INSERT INTO notifications (
  customer_id,
  loan_id,
  type,
  template,
  subject,
  message,
  recipient_phone,
  status,
  sent_at,
  delivered_at,
  provider
) VALUES
(
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000071',
  'sms',
  'loan_approved',
  'Loan Approved',
  'Congratulations! Your loan of $200 has been approved. Deposit: $20.',
  '+263771111111',
  'delivered',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  'twilio'
),
(
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000071',
  'whatsapp',
  'payment_reminder',
  'Payment Reminder',
  'Your next payment of $37.33 is due on ' || TO_CHAR(CURRENT_DATE + INTERVAL '28 days', 'DD/MM/YYYY'),
  '+263771111111',
  'sent',
  NOW(),
  NULL,
  'whatsapp'
);

-- 11. TEST INTERNATIONAL INTEREST
INSERT INTO international_interest (
  phone_number,
  country_code,
  email,
  full_name,
  country,
  city,
  product_interest
) VALUES
(
  '+254712345678',
  '+254',
  'kenya.customer@example.com',
  'John Kamau',
  'Kenya',
  'Nairobi',
  'smartphone'
),
(
  '+27821234567',
  '+27',
  'sa.customer@example.com',
  'Thabo Mbeki',
  'South Africa',
  'Johannesburg',
  'smartphone'
);

-- 12. TEST PRODUCT WAITLIST
INSERT INTO product_interest_waitlist (
  customer_id,
  product_id,
  phone_number,
  email,
  product_code,
  product_name
) VALUES
(
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000021',
  '+263771111111',
  'customer1@test.com',
  'DIGI_CREDIT_001',
  'Digital Credit'
),
(
  '00000000-0000-0000-0000-000000000032',
  '00000000-0000-0000-0000-000000000021',
  '+263772222222',
  'customer2@test.com',
  'DIGI_CREDIT_001',
  'Digital Credit'
);

-- =====================================================
-- FINAL COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ DATABASE DEPLOYMENT COMPLETE!';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Schema Summary:';
  RAISE NOTICE '   • 19 core tables created';
  RAISE NOTICE '   • 1 distributor commissions table';
  RAISE NOTICE '   • Trustonic device fields added';
  RAISE NOTICE '   • Row Level Security enabled';
  RAISE NOTICE '   • Triggers and functions created';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Test Data Loaded:';
  RAISE NOTICE '   • 3 admin users';
  RAISE NOTICE '   • 2 distributors (agents)';
  RAISE NOTICE '   • 3 customers';
  RAISE NOTICE '   • 2 loans';
  RAISE NOTICE '   • 3 devices';
  RAISE NOTICE '   • Payment records';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Next Steps:';
  RAISE NOTICE '   1. Verify tables in Table Editor';
  RAISE NOTICE '   2. Check that 19+ tables are visible';
  RAISE NOTICE '   3. View customer data in customers table';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;
