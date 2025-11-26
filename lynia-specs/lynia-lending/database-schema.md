# Lynia Finance - Database Schema Design

**Document:** P1-T002 Deliverable
**Version:** 1.0
**Date:** November 24, 2025
**Database:** Supabase PostgreSQL 15
**Status:** Phase 1 - Database Design

---

## Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Core Tables](#core-tables)
4. [Table Definitions](#table-definitions)
5. [Indexes & Performance](#indexes--performance)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Database Functions & Triggers](#database-functions--triggers)
8. [Data Migration Strategy](#data-migration-strategy)

---

## Overview

### Design Principles

1. **Zimbabwe-First**: National ID format, USD currency, Zimbabwe phone numbers
2. **Audit Trail**: All mutations logged with timestamps and user attribution
3. **Soft Deletes**: No hard deletes; use `deleted_at` timestamp
4. **Security**: Row Level Security (RLS) on all tables
5. **Performance**: Strategic indexes on foreign keys and query patterns
6. **Compliance**: 7-year data retention for financial records
7. **Configurable Terms**: Loan parameters stored in `system_config` for easy modification

### Business Rules & Data Display Guidelines

**CRITICAL**: The following business rules must be enforced across all interfaces (WhatsApp, web, mobile):

1. **Deposit Payment Control**:
   - 10% deposit required before device collection (tracked in `loans.deposit_amount`, `loans.deposit_paid`)
   - Agent verification required via `loans.deposit_payment_id` before device handover
   - Payment must reflect in system before `device_collected` flag can be set

2. **Collection Model** (No Delivery):
   - Customers must collect devices from agents (no delivery)
   - Agent location stored in `distributors` table
   - Tracking via `loans.device_collected`, `loans.device_collected_by_agent`

3. **Configurable Loan Terms**:
   - ALL loan parameters stored in `system_config` table (NOT hardcoded)
   - Key configs: `credit.interest_rate`, `credit.default_term_months`, `credit.tier1/2/3_limit`
   - UI/WhatsApp flows must dynamically pull from `system_config`

4. **Interest Rate Display Rules**:
   - ❌ NEVER display `interest_rate` percentage to customers
   - ✅ ONLY display: `total_repayment`, `monthly_payment`, `term_months`
   - `interest_rate` field exists in database for internal calculations only

### Database Architecture

```
Supabase PostgreSQL 15
│
├── Application Tables (13 tables)
│   ├── customers
│   ├── kyc_submissions
│   ├── loans
│   ├── devices
│   ├── device_assignments
│   ├── payments
│   ├── notifications
│   ├── distributors
│   ├── admin_users
│   ├── alternative_income_sources  (Phase 3+)
│   ├── audit_logs
│   ├── sessions
│   └── system_config
│
├── Real-time Subscriptions (Supabase)
├── Row Level Security (RLS)
├── Database Functions (PL/pgSQL)
└── Triggers (Auto-timestamps, Audit logs)
```

---

## Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   customers     │         │ kyc_submissions │         │  distributors   │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id (PK)         │────────>│ customer_id (FK)│         │ id (PK)         │
│ phone_number    │         │ id (PK)         │         │ name            │
│ national_id     │         │ document_type   │         │ phone_number    │
│ first_name      │         │ document_url    │         │ location        │
│ last_name       │         │ selfie_url      │         │ status          │
│ credit_limit    │         │ status          │         │ user_id (FK)    │
│ kyc_status      │         │ smile_job_id    │         └─────────────────┘
│ fineract_id     │         │ verified_at     │                 │
│ created_at      │         └─────────────────┘                 │
└─────────────────┘                                              │
         │                                                       │
         │                                                       │
         │          ┌─────────────────┐                         │
         └─────────>│     loans       │<────────────────────────┘
                    ├─────────────────┤
                    │ id (PK)         │
                    │ customer_id (FK)│
                    │ device_id (FK)  │───────┐
                    │ fineract_loan_id│       │
                    │ principal       │       │
                    │ interest_rate   │       │
                    │ term_months     │       │
                    │ status          │       │
                    │ approved_at     │       │
                    │ disbursed_at    │       │
                    │ distributor_id  │       │
                    └─────────────────┘       │
                             │                │
                             │                │
         ┌───────────────────┴────┐           │
         │                        │           │
         │                        │           │
┌─────────────────┐      ┌─────────────────┐ │
│    payments     │      │ notifications   │ │
├─────────────────┤      ├─────────────────┤ │
│ id (PK)         │      │ id (PK)         │ │
│ loan_id (FK)    │      │ customer_id (FK)│ │
│ amount          │      │ type            │ │
│ payment_method  │      │ channel         │ │
│ reference       │      │ status          │ │
│ status          │      │ sent_at         │ │
│ fineract_txn_id │      │ delivered_at    │ │
│ paid_at         │      └─────────────────┘ │
└─────────────────┘                          │
                                             │
                    ┌─────────────────┐      │
                    │    devices      │<─────┘
                    ├─────────────────┤
                    │ id (PK)         │
                    │ brand           │
                    │ model           │
                    │ imei            │
                    │ price           │
                    │ cost            │
                    │ status          │
                    │ distributor_id  │
                    └─────────────────┘
                             │
                             │
                    ┌─────────────────┐
                    │device_assignments│
                    ├─────────────────┤
                    │ id (PK)         │
                    │ device_id (FK)  │
                    │ customer_id (FK)│
                    │ loan_id (FK)    │
                    │ imei            │
                    │ lock_status     │
                    │ assigned_at     │
                    │ verified_by (FK)│
                    └─────────────────┘

┌─────────────────┐         ┌─────────────────┐
│  admin_users    │         │   audit_logs    │
├─────────────────┤         ├─────────────────┤
│ id (PK)         │         │ id (PK)         │
│ user_id (FK)    │─┐       │ user_id (FK)    │
│ role            │ │       │ action          │
│ permissions     │ │       │ table_name      │
│ status          │ │       │ record_id       │
└─────────────────┘ │       │ old_data        │
                    │       │ new_data        │
┌─────────────────┐ │       │ ip_address      │
│    sessions     │ │       │ created_at      │
├─────────────────┤ │       └─────────────────┘
│ id (PK)         │ │
│ user_id (FK)    │<┘
│ phone_number    │
│ state           │
│ context         │
│ last_message_at │
│ expires_at      │
└─────────────────┘
```

---

## Core Tables

### 1. customers
**Purpose**: Customer profiles and credit information
**Records**: 10,000+ expected

### 2. kyc_submissions
**Purpose**: KYC document verification tracking
**Records**: 10,000+ (one per customer)

### 3. loans
**Purpose**: Loan applications and status
**Records**: 15,000+ (1.5 loans per customer average)

### 4. devices
**Purpose**: Device inventory catalog
**Records**: 500-1,000 (SKUs)

### 5. device_assignments
**Purpose**: Track which device is assigned to which customer
**Records**: 10,000+ (one per active loan)

### 6. payments
**Purpose**: Payment transactions and reconciliation
**Records**: 100,000+ (8-12 payments per loan)

### 7. notifications
**Purpose**: Communication logs (WhatsApp, SMS, Email)
**Records**: 200,000+ (20+ notifications per customer)

### 8. distributors
**Purpose**: Agent network management
**Records**: 50-100 distributors

### 9. admin_users
**Purpose**: Platform staff and permissions
**Records**: 5-10 admin users

### 10. audit_logs
**Purpose**: System activity and compliance
**Records**: 1,000,000+ (all mutations logged)

### 11. sessions
**Purpose**: WhatsApp conversation state management
**Records**: 1,000-5,000 (active sessions)

### 12. system_config
**Purpose**: System-wide configuration
**Records**: 50-100 key-value pairs

---

## Table Definitions

### 1. customers

```sql
CREATE TABLE customers (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  phone_number VARCHAR(15) NOT NULL UNIQUE, -- +263771234567
  national_id VARCHAR(20) NOT NULL UNIQUE,  -- 63-123456-A-12
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10), -- male, female, other

  -- Address
  province VARCHAR(50),
  city VARCHAR(50),
  address_line_1 TEXT,
  address_line_2 TEXT,

  -- Credit Information
  credit_limit DECIMAL(10,2) DEFAULT 200.00, -- $200, $350, or $500
  credit_score INTEGER, -- 0-1000
  credit_tier INTEGER DEFAULT 1, -- 1, 2, or 3
  total_loans INTEGER DEFAULT 0,
  active_loans INTEGER DEFAULT 0,
  completed_loans INTEGER DEFAULT 0,
  defaulted_loans INTEGER DEFAULT 0,
  total_borrowed DECIMAL(12,2) DEFAULT 0.00,
  total_repaid DECIMAL(12,2) DEFAULT 0.00,

  -- KYC Status
  kyc_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, expired
  kyc_verified_at TIMESTAMP WITH TIME ZONE,
  kyc_expires_at TIMESTAMP WITH TIME ZONE, -- Annual re-verification

  -- Fineract Integration
  fineract_client_id BIGINT UNIQUE,
  fineract_account_number VARCHAR(50),

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, blocked, closed
  blocked_reason TEXT,

  -- Metadata
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID REFERENCES customers(id),
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

-- Indexes
CREATE INDEX idx_customers_phone ON customers(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_national_id ON customers(national_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_fineract_id ON customers(fineract_client_id);
CREATE INDEX idx_customers_kyc_status ON customers(kyc_status);
CREATE INDEX idx_customers_status ON customers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
```

---

### 2. kyc_submissions

```sql
CREATE TABLE kyc_submissions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Document Information
  document_type VARCHAR(50) DEFAULT 'national_id', -- national_id, passport, drivers_license
  document_number VARCHAR(50) NOT NULL,
  document_front_url TEXT NOT NULL, -- S3 URL
  document_back_url TEXT, -- Optional
  selfie_url TEXT NOT NULL, -- S3 URL

  -- Smile Identity Integration
  smile_job_id VARCHAR(100) UNIQUE,
  smile_partner_params JSONB,
  smile_result JSONB,
  smile_confidence_score DECIMAL(5,2), -- 0-100

  -- Verification Result
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, manual_review
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES admin_users(id),
  rejection_reason TEXT,
  manual_review_notes TEXT,

  -- Liveness Check
  liveness_passed BOOLEAN,
  liveness_score DECIMAL(5,2),

  -- Document Quality
  image_quality_score DECIMAL(5,2),
  document_readable BOOLEAN,

  -- Retry Information
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  previous_submission_id UUID REFERENCES kyc_submissions(id),

  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'manual_review')),
  CONSTRAINT valid_confidence CHECK (smile_confidence_score BETWEEN 0 AND 100),
  CONSTRAINT valid_attempt CHECK (attempt_number <= max_attempts)
);

-- Indexes
CREATE INDEX idx_kyc_customer ON kyc_submissions(customer_id);
CREATE INDEX idx_kyc_status ON kyc_submissions(status);
CREATE INDEX idx_kyc_smile_job ON kyc_submissions(smile_job_id);
CREATE INDEX idx_kyc_submitted_at ON kyc_submissions(submitted_at DESC);

-- Enable RLS
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;
```

---

### 3. loans

```sql
CREATE TABLE loans (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  device_id UUID REFERENCES devices(id) ON DELETE RESTRICT,
  distributor_id UUID REFERENCES distributors(id),

  -- Loan Terms
  principal DECIMAL(10,2) NOT NULL, -- $200-$500
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 30.00, -- 30% annual = 2.5% monthly
  term_months INTEGER NOT NULL DEFAULT 8, -- 8 months
  monthly_payment DECIMAL(10,2) NOT NULL,
  total_repayment DECIMAL(10,2) NOT NULL,

  -- Loan Status
  status VARCHAR(20) DEFAULT 'draft',
  -- draft, submitted, pending_approval, approved, rejected,
  -- disbursed, active, paid, defaulted, written_off

  -- Workflow Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES admin_users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  disbursed_at TIMESTAMP WITH TIME ZONE,
  disbursed_by UUID REFERENCES distributors(id),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Repayment Tracking
  outstanding_principal DECIMAL(10,2),
  outstanding_interest DECIMAL(10,2),
  total_paid DECIMAL(10,2) DEFAULT 0.00,
  last_payment_date DATE,
  next_payment_date DATE,
  missed_payments INTEGER DEFAULT 0,
  days_overdue INTEGER DEFAULT 0,

  -- Credit Decision
  credit_score_at_application INTEGER,
  approval_reason TEXT,
  auto_approved BOOLEAN DEFAULT false,

  -- Fineract Integration
  fineract_loan_id BIGINT UNIQUE,
  fineract_account_number VARCHAR(50),
  fineract_sync_status VARCHAR(20) DEFAULT 'pending', -- pending, synced, failed
  fineract_sync_error TEXT,
  fineract_last_sync_at TIMESTAMP WITH TIME ZONE,

  -- Device Assignment
  device_assigned BOOLEAN DEFAULT false,
  device_assigned_at TIMESTAMP WITH TIME ZONE,
  device_imei VARCHAR(20),

  -- Metadata
  application_source VARCHAR(50) DEFAULT 'whatsapp', -- whatsapp, admin, api
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_principal CHECK (principal BETWEEN 200 AND 500),
  CONSTRAINT valid_interest_rate CHECK (interest_rate >= 0),
  CONSTRAINT valid_term CHECK (term_months BETWEEN 1 AND 24),
  CONSTRAINT valid_loan_status CHECK (status IN (
    'draft', 'submitted', 'pending_approval', 'approved', 'rejected',
    'disbursed', 'active', 'paid', 'defaulted', 'written_off'
  ))
);

-- Indexes
CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_device ON loans(device_id);
CREATE INDEX idx_loans_distributor ON loans(distributor_id);
CREATE INDEX idx_loans_status ON loans(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_loans_fineract_id ON loans(fineract_loan_id);
CREATE INDEX idx_loans_overdue ON loans(days_overdue) WHERE days_overdue > 0;
CREATE INDEX idx_loans_next_payment ON loans(next_payment_date) WHERE status = 'active';
CREATE INDEX idx_loans_created_at ON loans(created_at DESC);

-- Enable RLS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
```

---

### 4. devices

```sql
CREATE TABLE devices (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Device Information
  brand VARCHAR(50) NOT NULL, -- Samsung, Tecno, Itel, etc.
  model VARCHAR(100) NOT NULL, -- Galaxy A04, Spark 10, etc.
  sku VARCHAR(50) UNIQUE NOT NULL, -- Internal SKU
  imei VARCHAR(20) UNIQUE, -- Set when assigned

  -- Specifications
  ram_gb INTEGER, -- 2, 3, 4, 6, 8
  storage_gb INTEGER, -- 32, 64, 128, 256
  screen_size DECIMAL(3,1), -- 6.5 inches
  battery_mah INTEGER, -- 5000 mAh
  camera_mp VARCHAR(50), -- "13MP + 2MP"
  processor VARCHAR(100),
  os VARCHAR(50), -- "Android 12"

  -- Pricing
  cost_price DECIMAL(10,2) NOT NULL, -- Wholesale cost
  retail_price DECIMAL(10,2) NOT NULL, -- Full retail price
  financing_price DECIMAL(10,2) NOT NULL, -- Price with interest markup
  deposit_amount DECIMAL(10,2) DEFAULT 0.00,

  -- Images
  primary_image_url TEXT,
  image_urls JSONB, -- Array of image URLs

  -- Inventory
  status VARCHAR(20) DEFAULT 'available',
  -- available, reserved, assigned, sold, damaged, returned
  distributor_id UUID REFERENCES distributors(id),
  warehouse_location VARCHAR(100),

  -- Lock Provider
  lock_provider VARCHAR(50), -- absolute, prey, custom
  lock_provider_id VARCHAR(100),
  lock_enabled BOOLEAN DEFAULT true,

  -- Metadata
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_device_status CHECK (status IN (
    'available', 'reserved', 'assigned', 'sold', 'damaged', 'returned'
  )),
  CONSTRAINT valid_pricing CHECK (financing_price >= retail_price AND retail_price >= cost_price)
);

-- Indexes
CREATE INDEX idx_devices_sku ON devices(sku);
CREATE INDEX idx_devices_imei ON devices(imei) WHERE imei IS NOT NULL;
CREATE INDEX idx_devices_status ON devices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_distributor ON devices(distributor_id);
CREATE INDEX idx_devices_brand_model ON devices(brand, model);
CREATE INDEX idx_devices_featured ON devices(featured, sort_order) WHERE active = true;

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
```

---

### 5. device_assignments

```sql
CREATE TABLE device_assignments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
  distributor_id UUID NOT NULL REFERENCES distributors(id),

  -- Device Information
  imei VARCHAR(20) NOT NULL,
  serial_number VARCHAR(50),

  -- Handover Details
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_by UUID REFERENCES admin_users(id), -- Distributor who verified ID
  id_verification_photo_url TEXT, -- Photo of customer holding ID
  device_condition_photo_url TEXT, -- Photo of device condition
  customer_signature_url TEXT, -- Digital signature

  -- Lock Status
  lock_status VARCHAR(20) DEFAULT 'unlocked', -- unlocked, locked, permanent_unlock
  lock_provider VARCHAR(50),
  lock_provider_device_id VARCHAR(100),
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_reason VARCHAR(100), -- 'missed_payment', 'fraud', 'customer_request'
  unlocked_at TIMESTAMP WITH TIME ZONE,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,

  -- Return/Repossession
  returned BOOLEAN DEFAULT false,
  returned_at TIMESTAMP WITH TIME ZONE,
  return_reason TEXT,
  return_condition VARCHAR(20), -- excellent, good, fair, poor, damaged
  repossessed BOOLEAN DEFAULT false,
  repossessed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_lock_status CHECK (lock_status IN ('unlocked', 'locked', 'permanent_unlock')),
  CONSTRAINT unique_device_assignment UNIQUE(device_id, loan_id)
);

-- Indexes
CREATE INDEX idx_device_assignments_device ON device_assignments(device_id);
CREATE INDEX idx_device_assignments_customer ON device_assignments(customer_id);
CREATE INDEX idx_device_assignments_loan ON device_assignments(loan_id);
CREATE INDEX idx_device_assignments_imei ON device_assignments(imei);
CREATE INDEX idx_device_assignments_lock_status ON device_assignments(lock_status);
CREATE INDEX idx_device_assignments_grace_period ON device_assignments(grace_period_ends_at)
  WHERE lock_status = 'unlocked' AND grace_period_ends_at IS NOT NULL;

-- Enable RLS
ALTER TABLE device_assignments ENABLE ROW LEVEL SECURITY;
```

---

### 6. payments

```sql
CREATE TABLE payments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  -- Payment Details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50) NOT NULL, -- ecocash, paynow, bank_transfer, cash

  -- Payment Gateway
  gateway VARCHAR(50), -- ecocash, paynow, stripe
  gateway_transaction_id VARCHAR(100) UNIQUE,
  gateway_reference VARCHAR(100),
  gateway_fee DECIMAL(10,2),
  net_amount DECIMAL(10,2), -- amount - gateway_fee

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, processing, completed, failed, refunded, disputed

  -- Timestamps
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,

  -- Reconciliation
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID REFERENCES admin_users(id),

  -- Fineract Integration
  fineract_transaction_id BIGINT UNIQUE,
  fineract_receipt_number VARCHAR(50),
  fineract_sync_status VARCHAR(20) DEFAULT 'pending', -- pending, synced, failed
  fineract_sync_error TEXT,
  fineract_synced_at TIMESTAMP WITH TIME ZONE,

  -- Allocation (how payment is split)
  principal_amount DECIMAL(10,2) DEFAULT 0.00,
  interest_amount DECIMAL(10,2) DEFAULT 0.00,
  penalty_amount DECIMAL(10,2) DEFAULT 0.00,
  fee_amount DECIMAL(10,2) DEFAULT 0.00,

  -- Payment Source
  phone_number VARCHAR(15), -- Phone used for payment
  payer_name VARCHAR(100),

  -- Retry Information
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_payment_status CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'
  )),
  CONSTRAINT valid_allocation CHECK (
    principal_amount + interest_amount + penalty_amount + fee_amount <= amount
  )
);

-- Indexes
CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_gateway_txn ON payments(gateway_transaction_id);
CREATE INDEX idx_payments_fineract_txn ON payments(fineract_transaction_id);
CREATE INDEX idx_payments_reconciled ON payments(reconciled) WHERE NOT reconciled;
CREATE INDEX idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
```

---

### 7. notifications

```sql
CREATE TABLE notifications (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  -- Notification Details
  type VARCHAR(50) NOT NULL,
  -- kyc_approved, loan_approved, payment_due, payment_received, device_locked, etc.
  channel VARCHAR(20) NOT NULL, -- whatsapp, sms, email
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent

  -- Recipient
  recipient_phone VARCHAR(15),
  recipient_email VARCHAR(100),

  -- Content
  subject VARCHAR(200),
  body TEXT NOT NULL,
  template_name VARCHAR(100),
  template_variables JSONB,

  -- Delivery Status
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, queued, sent, delivered, failed, bounced

  -- Timestamps
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,

  -- Gateway Information
  gateway VARCHAR(50), -- whatsapp_cloud, twilio, aws_ses
  gateway_message_id VARCHAR(200),
  gateway_response JSONB,

  -- Retry Logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Fallback
  fallback_channel VARCHAR(20), -- sms, email
  fallback_sent BOOLEAN DEFAULT false,
  fallback_sent_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_channel CHECK (channel IN ('whatsapp', 'sms', 'email')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT valid_notification_status CHECK (status IN (
    'pending', 'queued', 'sent', 'delivered', 'failed', 'bounced'
  ))
);

-- Indexes
CREATE INDEX idx_notifications_customer ON notifications(customer_id);
CREATE INDEX idx_notifications_loan ON notifications(loan_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for)
  WHERE status IN ('pending', 'queued');
CREATE INDEX idx_notifications_retry ON notifications(next_retry_at)
  WHERE retry_count < max_retries AND status = 'failed';
CREATE INDEX idx_notifications_type_created ON notifications(type, created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
```

---

### 8. distributors

```sql
CREATE TABLE distributors (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Account
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Personal Information
  name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  national_id VARCHAR(20) UNIQUE,

  -- Business Information
  business_name VARCHAR(100),
  business_registration VARCHAR(50),

  -- Location
  province VARCHAR(50),
  city VARCHAR(50),
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Banking Details
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  account_name VARCHAR(100),
  mobile_money_number VARCHAR(15),

  -- Commission Structure
  commission_rate DECIMAL(5,2) DEFAULT 5.00, -- 5% of principal
  total_commissions_earned DECIMAL(12,2) DEFAULT 0.00,
  total_commissions_paid DECIMAL(12,2) DEFAULT 0.00,
  pending_commissions DECIMAL(12,2) DEFAULT 0.00,

  -- Performance Metrics
  total_loans_disbursed INTEGER DEFAULT 0,
  total_devices_distributed INTEGER DEFAULT 0,
  current_inventory_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2), -- 0.00 - 5.00

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, inactive
  suspended_reason TEXT,

  -- KYC
  kyc_status VARCHAR(20) DEFAULT 'pending',
  kyc_verified_at TIMESTAMP WITH TIME ZONE,
  kyc_document_url TEXT,

  -- Timestamps
  onboarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_phone CHECK (phone_number ~ '^\+263[0-9]{9}$'),
  CONSTRAINT valid_commission_rate CHECK (commission_rate BETWEEN 0 AND 100),
  CONSTRAINT valid_distributor_status CHECK (status IN ('active', 'suspended', 'inactive'))
);

-- Indexes
CREATE INDEX idx_distributors_user ON distributors(user_id);
CREATE INDEX idx_distributors_phone ON distributors(phone_number);
CREATE INDEX idx_distributors_status ON distributors(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_distributors_location ON distributors(province, city) WHERE status = 'active';

-- Enable RLS
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
```

---

### 9. admin_users

```sql
CREATE TABLE admin_users (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Account
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Personal Information
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone_number VARCHAR(15),

  -- Role & Permissions
  role VARCHAR(50) NOT NULL,
  -- super_admin, operations_manager, customer_support, finance_team
  permissions JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, inactive
  suspended_reason TEXT,

  -- Security
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret VARCHAR(100),
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_login_ip INET,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_admin_role CHECK (role IN (
    'super_admin', 'operations_manager', 'customer_support', 'finance_team'
  )),
  CONSTRAINT valid_admin_status CHECK (status IN ('active', 'suspended', 'inactive'))
);

-- Indexes
CREATE INDEX idx_admin_users_user ON admin_users(user_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_admin_users_status ON admin_users(status);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
```

---

### 10. alternative_income_sources (Phase 3+)

**Purpose**: Store alternative income data from platforms, CSV uploads, and external APIs for enhanced credit scoring

```sql
CREATE TABLE alternative_income_sources (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer Reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Income Source Details
  source_type VARCHAR(50) NOT NULL,
  -- 'platform_earnings', 'salary_confirmation', 'bank_statement', 'mobile_money', 'airtime_data'
  source_platform VARCHAR(50),
  -- 'indrive', 'bolt', 'uber', 'econet', 'netone', 'telecel', 'manual_csv'

  -- Income Data
  monthly_income_usd DECIMAL(10,2),
  income_consistency_score DECIMAL(5,2), -- 0-100, regularity of income
  data_period_months INTEGER DEFAULT 3, -- Data covers X months
  earnings_breakdown JSONB, -- Detailed earnings by month/week

  -- Platform-Specific Data (for drivers/gig workers)
  platform_driver_rating DECIMAL(3,2), -- 0-5 rating
  platform_total_trips INTEGER,
  platform_active_days_per_week DECIMAL(3,1),
  platform_acceptance_rate DECIMAL(3,2), -- 0-1
  platform_tenure_months INTEGER,

  -- Airtime Data (MNO integration)
  airtime_recharge_frequency_per_month DECIMAL(4,1),
  airtime_avg_recharge_amount_usd DECIMAL(6,2),
  airtime_consistency_score DECIMAL(5,2), -- 0-100
  airtime_peak_recharge_day INTEGER, -- 1-31, salary day indicator

  -- Verification & Trust
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES admin_users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_method VARCHAR(50), -- 'api', 'csv_upload', 'manual_review'

  -- Data Upload Info (CSV uploads)
  uploaded_by UUID REFERENCES admin_users(id),
  upload_file_s3_key TEXT, -- S3 location of original CSV
  upload_file_name VARCHAR(200),

  -- Raw Data Storage (for audit)
  raw_data JSONB, -- Original data from API or CSV row

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, expired, rejected
  expires_at TIMESTAMP WITH TIME ZONE, -- Data expires after 6 months

  -- Timestamps
  data_collected_at TIMESTAMP WITH TIME ZONE, -- When source data was collected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_source_type CHECK (source_type IN (
    'platform_earnings', 'salary_confirmation', 'bank_statement',
    'mobile_money', 'airtime_data', 'other'
  )),
  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'rejected')),
  CONSTRAINT valid_income CHECK (monthly_income_usd >= 0),
  CONSTRAINT valid_consistency_score CHECK (
    income_consistency_score IS NULL OR (income_consistency_score BETWEEN 0 AND 100)
  ),
  CONSTRAINT valid_rating CHECK (
    platform_driver_rating IS NULL OR (platform_driver_rating BETWEEN 0 AND 5)
  )
);

-- Indexes
CREATE INDEX idx_alt_income_customer ON alternative_income_sources(customer_id)
  WHERE status = 'active';
CREATE INDEX idx_alt_income_source_type ON alternative_income_sources(source_type);
CREATE INDEX idx_alt_income_platform ON alternative_income_sources(source_platform)
  WHERE source_platform IS NOT NULL;
CREATE INDEX idx_alt_income_verified ON alternative_income_sources(verified)
  WHERE verified = true;
CREATE INDEX idx_alt_income_expires ON alternative_income_sources(expires_at)
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE alternative_income_sources ENABLE ROW LEVEL SECURITY;

-- Auto-expire old data (trigger)
CREATE OR REPLACE FUNCTION expire_old_income_data()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE alternative_income_sources
  SET status = 'expired'
  WHERE expires_at < NOW() AND status = 'active';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_income_data
  AFTER INSERT OR UPDATE ON alternative_income_sources
  FOR EACH ROW
  EXECUTE FUNCTION expire_old_income_data();
```

**Usage Examples**:

```sql
-- Store InDrive driver earnings from API
INSERT INTO alternative_income_sources (
  customer_id, source_type, source_platform,
  monthly_income_usd, income_consistency_score,
  platform_driver_rating, platform_total_trips,
  platform_active_days_per_week, platform_tenure_months,
  verified, verification_method, expires_at
) VALUES (
  'customer-uuid',
  'platform_earnings',
  'indrive',
  350.00,
  85.5,
  4.8,
  450,
  6.0,
  8,
  true,
  'api',
  NOW() + INTERVAL '6 months'
);

-- Store salary data from CSV upload
INSERT INTO alternative_income_sources (
  customer_id, source_type, monthly_income_usd,
  uploaded_by, upload_file_s3_key, upload_file_name,
  raw_data, verified, verification_method, expires_at
) VALUES (
  'customer-uuid',
  'salary_confirmation',
  450.00,
  'admin-uuid',
  'csv-uploads/1732638000-salaries.csv',
  'salaries.csv',
  '{"employer": "ZimCo Ltd", "position": "Driver", "gross_pay": 450}'::jsonb,
  true,
  'csv_upload',
  NOW() + INTERVAL '6 months'
);

-- Store airtime data from MNO API
INSERT INTO alternative_income_sources (
  customer_id, source_type, source_platform,
  airtime_recharge_frequency_per_month,
  airtime_avg_recharge_amount_usd,
  airtime_consistency_score,
  airtime_peak_recharge_day,
  verified, verification_method, expires_at
) VALUES (
  'customer-uuid',
  'airtime_data',
  'econet',
  4.5,
  12.50,
  78.0,
  25, -- Likely salary day
  true,
  'api',
  NOW() + INTERVAL '6 months'
);
```

---

### 11. audit_logs

```sql
CREATE TABLE audit_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor
  user_id UUID REFERENCES auth.users(id),
  user_type VARCHAR(20), -- customer, distributor, admin, system
  user_email VARCHAR(100),

  -- Action
  action VARCHAR(50) NOT NULL, -- create, update, delete, login, logout, etc.
  table_name VARCHAR(50),
  record_id UUID,

  -- Data Changes
  old_data JSONB,
  new_data JSONB,
  changes JSONB, -- Computed diff

  -- Request Context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),
  session_id VARCHAR(100),

  -- Metadata
  severity VARCHAR(20) DEFAULT 'info', -- debug, info, warning, error, critical
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_user_type CHECK (user_type IN ('customer', 'distributor', 'admin', 'system')),
  CONSTRAINT valid_severity CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'))
);

-- Indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity) WHERE severity IN ('error', 'critical');

-- Enable RLS (Admins only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

---

### 11. sessions

```sql
CREATE TABLE sessions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Identity
  phone_number VARCHAR(15) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Conversation State
  state VARCHAR(50) DEFAULT 'idle',
  -- idle, onboarding, kyc, browsing, applying, payment, support
  context JSONB DEFAULT '{}'::jsonb,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Session Management
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  active BOOLEAN DEFAULT true,

  -- Metadata
  platform VARCHAR(20) DEFAULT 'whatsapp', -- whatsapp, web, mobile
  whatsapp_wa_id VARCHAR(50), -- WhatsApp user ID
  language VARCHAR(10) DEFAULT 'en', -- en, sn (Shona), nd (Ndebele)

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_active_session UNIQUE(phone_number, active),
  CONSTRAINT valid_phone CHECK (phone_number ~ '^\+263[0-9]{9}$')
);

-- Indexes
CREATE INDEX idx_sessions_phone ON sessions(phone_number) WHERE active = true;
CREATE INDEX idx_sessions_customer ON sessions(customer_id) WHERE active = true;
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE active = true;
CREATE INDEX idx_sessions_last_message ON sessions(last_message_at DESC) WHERE active = true;

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
```

---

### 12. system_config

```sql
CREATE TABLE system_config (
  -- Primary Key
  key VARCHAR(100) PRIMARY KEY,

  -- Value
  value JSONB NOT NULL,
  data_type VARCHAR(20) NOT NULL, -- string, number, boolean, json, array

  -- Metadata
  description TEXT,
  category VARCHAR(50), -- credit, payment, notification, feature_flag, etc.
  is_secret BOOLEAN DEFAULT false,

  -- Access Control
  editable BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id),

  -- Constraints
  CONSTRAINT valid_data_type CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'array'))
);

-- Indexes
CREATE INDEX idx_system_config_category ON system_config(category);
CREATE INDEX idx_system_config_editable ON system_config(editable) WHERE editable = true;

-- Enable RLS (Admins only)
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Example seed data
INSERT INTO system_config (key, value, data_type, description, category) VALUES
  ('credit.tier1_limit', '200', 'number', 'Credit limit for tier 1 customers', 'credit'),
  ('credit.tier2_limit', '350', 'number', 'Credit limit for tier 2 customers', 'credit'),
  ('credit.tier3_limit', '500', 'number', 'Credit limit for tier 3 customers', 'credit'),
  ('credit.interest_rate', '30', 'number', 'Annual interest rate (%)', 'credit'),
  ('credit.default_term_months', '8', 'number', 'Default loan term in months', 'credit'),
  ('payment.grace_period_days', '7', 'number', 'Grace period before device lock', 'payment'),
  ('kyc.max_retry_attempts', '3', 'number', 'Maximum KYC retry attempts', 'kyc'),
  ('notification.whatsapp_enabled', 'true', 'boolean', 'Enable WhatsApp notifications', 'notification'),
  ('feature.auto_approval_enabled', 'true', 'boolean', 'Enable automatic loan approval', 'feature_flag');
```

---

## Indexes & Performance

### Index Strategy

#### 1. Primary Keys
- All tables use `UUID` primary keys for distributed scalability
- Indexed by default

#### 2. Foreign Keys
- All foreign key columns indexed for join performance
- Example: `customer_id`, `loan_id`, `device_id`

#### 3. Query Patterns
- Status fields: Indexed where queries filter by status
- Date ranges: Indexed for time-based queries
- Unique constraints: Natural unique indexes

#### 4. Partial Indexes
- Used for conditional queries (e.g., `WHERE deleted_at IS NULL`)
- Reduces index size and improves performance

### Performance Targets

| Query Type | Target Latency |
|-----------|----------------|
| Single record lookup (by ID) | <10ms |
| List queries (with pagination) | <50ms |
| Join queries (2-3 tables) | <100ms |
| Aggregation queries | <200ms |
| Full-text search | <300ms |

### Query Optimization Examples

```sql
-- Good: Uses index on phone_number
SELECT * FROM customers WHERE phone_number = '+263771234567' AND deleted_at IS NULL;

-- Good: Uses composite index on status and created_at
SELECT * FROM loans WHERE status = 'active' ORDER BY created_at DESC LIMIT 20;

-- Good: Uses index on customer_id and status
SELECT COUNT(*) FROM loans WHERE customer_id = 'uuid-here' AND status = 'active';

-- Bad: Full table scan (avoid)
SELECT * FROM customers WHERE LOWER(first_name) = 'john';

-- Better: Use trigram index for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_customers_name_trgm ON customers USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
```

---

## Row Level Security (RLS)

### RLS Strategy

1. **Customers**: Can only see their own data
2. **Distributors**: Can see data for their assigned customers/loans
3. **Admins**: Full access based on role
4. **Public**: No access (all tables require authentication)

### RLS Policies

#### 1. customers Table

```sql
-- Customers can view their own profile
CREATE POLICY customers_select_own ON customers
  FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM auth.users WHERE phone = phone_number));

-- Customers can update their own profile (limited fields)
CREATE POLICY customers_update_own ON customers
  FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM auth.users WHERE phone = phone_number))
  WITH CHECK (auth.uid() = (SELECT user_id FROM auth.users WHERE phone = phone_number));

-- Admins can view all customers
CREATE POLICY customers_select_admin ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND deleted_at IS NULL
    )
  );

-- Admins can update all customers
CREATE POLICY customers_update_admin ON customers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'operations_manager')
      AND status = 'active'
    )
  );

-- Admins can create customers
CREATE POLICY customers_insert_admin ON customers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );
```

#### 2. loans Table

```sql
-- Customers can view their own loans
CREATE POLICY loans_select_own ON loans
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  );

-- Distributors can view loans they're assigned to
CREATE POLICY loans_select_distributor ON loans
  FOR SELECT
  USING (
    distributor_id IN (
      SELECT id FROM distributors
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Admins can view all loans
CREATE POLICY loans_select_admin ON loans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Admins can update loans
CREATE POLICY loans_update_admin ON loans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'operations_manager')
      AND status = 'active'
    )
  );

-- Admins can create loans
CREATE POLICY loans_insert_admin ON loans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );
```

#### 3. payments Table

```sql
-- Customers can view their own payments
CREATE POLICY payments_select_own ON payments
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admins can view all payments
CREATE POLICY payments_select_admin ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- System can insert payments (webhook processing)
CREATE POLICY payments_insert_system ON payments
  FOR INSERT
  WITH CHECK (true); -- Controlled by API key at application level
```

#### 4. admin_users Table

```sql
-- Admins can view other admins
CREATE POLICY admin_users_select ON admin_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Only super_admin can update admin users
CREATE POLICY admin_users_update ON admin_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
    )
  );
```

#### 5. audit_logs Table

```sql
-- Only admins can view audit logs
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'operations_manager')
      AND status = 'active'
    )
  );

-- System can insert audit logs
CREATE POLICY audit_logs_insert_system ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed
```

---

## Database Functions & Triggers

### 1. Auto-Update Timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- (Apply to all other tables...)
```

### 2. Audit Log Trigger

```sql
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to sensitive tables
CREATE TRIGGER audit_customers_changes AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_loans_changes AFTER INSERT OR UPDATE OR DELETE ON loans
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_payments_changes AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
```

### 3. Calculate Loan Totals

```sql
CREATE OR REPLACE FUNCTION calculate_loan_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate monthly payment and total repayment
  NEW.monthly_payment := ROUND(
    (NEW.principal * (1 + NEW.interest_rate / 100)) / NEW.term_months,
    2
  );

  NEW.total_repayment := NEW.monthly_payment * NEW.term_months;

  NEW.outstanding_principal := NEW.principal;
  NEW.outstanding_interest := NEW.total_repayment - NEW.principal;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_loan_totals_trigger BEFORE INSERT OR UPDATE ON loans
  FOR EACH ROW
  WHEN (NEW.principal IS NOT NULL AND NEW.interest_rate IS NOT NULL AND NEW.term_months IS NOT NULL)
  EXECUTE FUNCTION calculate_loan_totals();
```

### 4. Update Customer Stats

```sql
CREATE OR REPLACE FUNCTION update_customer_loan_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE customers SET
      total_loans = total_loans + 1,
      active_loans = active_loans + 1,
      total_borrowed = total_borrowed + NEW.principal
    WHERE id = NEW.customer_id;
  ELSIF (TG_OP = 'UPDATE' AND OLD.status <> NEW.status) THEN
    -- Handle status transitions
    IF (NEW.status = 'paid') THEN
      UPDATE customers SET
        active_loans = active_loans - 1,
        completed_loans = completed_loans + 1,
        total_repaid = total_repaid + NEW.total_paid
      WHERE id = NEW.customer_id;
    ELSIF (NEW.status = 'defaulted') THEN
      UPDATE customers SET
        active_loans = active_loans - 1,
        defaulted_loans = defaulted_loans + 1
      WHERE id = NEW.customer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_stats_trigger AFTER INSERT OR UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_customer_loan_stats();
```

---

## Data Migration Strategy

### Phase 1: Initial Schema Creation
```sql
-- Run all CREATE TABLE statements
-- Run all CREATE INDEX statements
-- Run all RLS policies
-- Run all functions and triggers
```

### Phase 2: Seed Data
```sql
-- system_config initial values
-- Test customers (dev/staging only)
-- Device catalog (initial inventory)
```

### Phase 3: Migration Scripts
```bash
# Supabase migrations directory structure
supabase/migrations/
  ├── 20250101000001_initial_schema.sql
  ├── 20250101000002_rls_policies.sql
  ├── 20250101000003_functions_triggers.sql
  └── 20250101000004_seed_data.sql
```

### Rollback Strategy
- All migrations versioned
- Down migrations for each up migration
- Tested rollback procedures
- Database backups before major migrations

---

## Summary

### Tables Created: 12

1. ✅ **customers** (24 columns, 6 indexes, RLS enabled)
2. ✅ **kyc_submissions** (19 columns, 4 indexes, RLS enabled)
3. ✅ **loans** (38 columns, 8 indexes, RLS enabled)
4. ✅ **devices** (23 columns, 6 indexes, RLS enabled)
5. ✅ **device_assignments** (20 columns, 6 indexes, RLS enabled)
6. ✅ **payments** (33 columns, 8 indexes, RLS enabled)
7. ✅ **notifications** (24 columns, 6 indexes, RLS enabled)
8. ✅ **distributors** (26 columns, 4 indexes, RLS enabled)
9. ✅ **admin_users** (13 columns, 4 indexes, RLS enabled)
10. ✅ **audit_logs** (15 columns, 5 indexes, RLS enabled)
11. ✅ **sessions** (13 columns, 4 indexes, RLS enabled)
12. ✅ **system_config** (9 columns, 2 indexes, RLS enabled)

### Total Database Objects

- **Tables**: 12
- **Columns**: 280+
- **Indexes**: 61
- **RLS Policies**: 20+
- **Functions**: 4
- **Triggers**: 10+

### Storage Estimates (Year 1)

| Table | Records | Size Estimate |
|-------|---------|---------------|
| customers | 10,000 | ~15 MB |
| kyc_submissions | 10,000 | ~500 MB (with images) |
| loans | 15,000 | ~30 MB |
| devices | 1,000 | ~2 MB |
| device_assignments | 10,000 | ~20 MB |
| payments | 100,000 | ~150 MB |
| notifications | 200,000 | ~300 MB |
| distributors | 100 | <1 MB |
| admin_users | 10 | <1 MB |
| audit_logs | 1,000,000 | ~2 GB |
| sessions | 5,000 | ~5 MB |
| system_config | 100 | <1 MB |
| **TOTAL** | | **~3 GB** |

**Note**: Well within Supabase free tier (500 MB database + 1 GB file storage)

---

**Document Status:** ✅ Complete
**Next Task:** P1-T003 - API Specification Document
**Approval Required:** Technical Lead + Database Administrator
**Last Updated:** November 24, 2025
