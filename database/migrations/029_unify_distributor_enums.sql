-- =====================================================
-- Lynia Finance - Unify Distributor Schema & Enums
-- Migration: 029
-- Created: February 20, 2026
-- Purpose: Align distributor table with distributor dashboard,
--          unify device/KYC/payment/handover status enums
-- =====================================================

-- =====================================================
-- 1. EXTEND DISTRIBUTORS TABLE
-- Add missing columns required by distributor dashboard
-- =====================================================

-- Personal identity
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS user_id UUID;

-- Geolocation
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- Mobile money
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS mobile_money_number VARCHAR(20);

-- Commission tracking
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 5.00;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS total_commissions_earned DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS total_commissions_paid DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS pending_commissions DECIMAL(12, 2) DEFAULT 0;

-- Inventory & performance
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS total_loans_disbursed INTEGER DEFAULT 0;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS current_inventory_count INTEGER DEFAULT 0;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 1) DEFAULT 0;

-- KYC
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE;

-- Onboarding
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP WITH TIME ZONE;

-- Rename total_revenue_usd -> align with commission tracking
-- (keep total_revenue_usd for backward compatibility, add alias via view if needed)

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_distributors_user_id ON distributors(user_id);
CREATE INDEX IF NOT EXISTS idx_distributors_national_id ON distributors(national_id);
CREATE INDEX IF NOT EXISTS idx_distributors_kyc_status ON distributors(kyc_status);

-- =====================================================
-- 2. CREATE DEVICE_HANDOVERS TABLE (if not exists)
-- Unified status enum across all layers
-- =====================================================
CREATE TABLE IF NOT EXISTS device_handovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  device_id UUID NOT NULL REFERENCES devices(id),
  distributor_id UUID NOT NULL REFERENCES distributors(id),

  -- Handover workflow status
  -- Canonical enum: initiated, identity_verified, deposit_verified, device_inspected, completed, failed, cancelled
  status VARCHAR(50) DEFAULT 'initiated',

  -- Verification steps
  identity_verified BOOLEAN DEFAULT FALSE,
  deposit_verified BOOLEAN DEFAULT FALSE,
  device_inspected BOOLEAN DEFAULT FALSE,

  -- App & lock verification
  app_installed BOOLEAN DEFAULT FALSE,
  app_configured BOOLEAN DEFAULT FALSE,
  lock_test_passed BOOLEAN DEFAULT FALSE,

  -- Device condition (JSON)
  device_condition JSONB,

  -- Photos & signatures
  device_photos TEXT[],
  customer_signature_url TEXT,
  identity_photo_url TEXT,

  -- Scheduling
  scheduled_date DATE,
  scheduled_time TIME,

  -- Location
  handover_location TEXT,
  handed_over_by VARCHAR(200),

  -- Deposit details
  deposit_payment_method VARCHAR(50),
  deposit_transaction_ref VARCHAR(200),

  -- Completion
  handed_over_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  failure_reason TEXT,

  -- Loan agreement
  loan_agreement_url TEXT,
  device_condition_form_url TEXT,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_device_handovers_loan ON device_handovers(loan_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_customer ON device_handovers(customer_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_device ON device_handovers(device_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_distributor ON device_handovers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_device_handovers_status ON device_handovers(status);

-- Trigger: auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_device_handovers_updated_at'
  ) THEN
    CREATE TRIGGER update_device_handovers_updated_at
    BEFORE UPDATE ON device_handovers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- 3. UPDATE DISTRIBUTOR COMMISSIONS
-- Change commission base: loan amount (not device price)
-- Add loan_amount column for correct calculation
-- =====================================================
ALTER TABLE distributor_commissions ADD COLUMN IF NOT EXISTS loan_amount_usd DECIMAL(10, 2);

-- Add comment documenting commission basis
COMMENT ON COLUMN distributor_commissions.commission_amount_usd IS 'Commission = commission_percentage% of loan_amount_usd';
COMMENT ON COLUMN distributor_commissions.loan_amount_usd IS 'Loan principal used as commission base (not device retail price)';

-- =====================================================
-- 4. COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 029 complete:';
  RAISE NOTICE '  - Extended distributors table with 15 new columns';
  RAISE NOTICE '  - Created device_handovers table with unified status enum';
  RAISE NOTICE '  - Added loan_amount_usd to distributor_commissions';
  RAISE NOTICE '  - Unified handover status: initiated|identity_verified|deposit_verified|device_inspected|completed|failed|cancelled';
END $$;
