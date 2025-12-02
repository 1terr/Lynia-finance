-- =====================================================
-- Lynia Finance - Initial Database Schema
-- Migration: 001
-- Created: November 28, 2025
-- Phase: Phase 2 - Infrastructure Setup
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
-- 3. LOANS TABLE
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
-- 11. ADMIN_USERS TABLE
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
  created_by UUID REFERENCES admin_users(id),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_status ON admin_users(status);

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

-- Similar policies for other tables (expand based on requirements)

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

-- (Add more triggers for other tables as needed)

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
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Total tables: 19';
  RAISE NOTICE '🔒 RLS enabled on 15 tables';
  RAISE NOTICE '🔄 Triggers created for updated_at fields';
  RAISE NOTICE '📈 Materialized views created for reporting';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run seed data: database/seed/001_test_data.sql';
  RAISE NOTICE '2. Verify tables: SELECT tablename FROM pg_tables WHERE schemaname = ''public'';';
  RAISE NOTICE '3. Test RLS: Connect as different users';
END $$;
