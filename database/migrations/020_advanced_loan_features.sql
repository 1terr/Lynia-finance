-- =====================================================
-- Lynia Finance - Advanced Loan Features
-- Migration: 020
-- Created: February 14, 2026
-- Phase: Phase 8 - Penalty Config, Write-Offs, Rescheduling
-- =====================================================

-- =====================================================
-- 1. PENALTY CONFIGURATIONS TABLE
-- Stores configurable late fee / penalty rules per product
-- =====================================================
CREATE TABLE IF NOT EXISTS penalty_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Scope: can be global (product_id NULL) or per-product
  product_id UUID REFERENCES loan_products(id),

  -- Penalty identification
  penalty_type VARCHAR(30) NOT NULL,  -- late_fee, penalty_interest, collection_fee
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Calculation method
  calculation_method VARCHAR(30) NOT NULL,  -- flat, percentage, tiered
  flat_amount_usd DECIMAL(10, 2),           -- Used when calculation_method = 'flat'
  percentage_rate DECIMAL(5, 4),            -- Used when calculation_method = 'percentage' (e.g. 0.0500 = 5%)
  tiered_config JSONB,                      -- Used when calculation_method = 'tiered'
  -- tiered_config example:
  -- [
  --   { "min_days": 1, "max_days": 7, "flat_amount": 2.00 },
  --   { "min_days": 8, "max_days": 30, "flat_amount": 5.00 },
  --   { "min_days": 31, "max_days": null, "percentage": 0.02 }
  -- ]

  -- Trigger rules
  grace_period_days INTEGER NOT NULL DEFAULT 3,   -- Days after due date before penalty applies
  min_days_past_due INTEGER NOT NULL DEFAULT 1,   -- Minimum DPD for this penalty to apply
  max_days_past_due INTEGER,                       -- NULL means no upper limit
  recurrence VARCHAR(20) NOT NULL DEFAULT 'once', -- once, daily, weekly, monthly
  max_applications INTEGER,                        -- Max times this penalty can be applied per loan (NULL = unlimited)

  -- Caps and limits
  max_penalty_amount_usd DECIMAL(10, 2),           -- Hard cap per application
  max_total_penalties_usd DECIMAL(10, 2),           -- Max cumulative penalties per loan
  max_penalty_percentage DECIMAL(5, 4),             -- Max as % of outstanding balance

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,

  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_penalty_config_product ON penalty_configurations(product_id);
CREATE INDEX idx_penalty_config_type ON penalty_configurations(penalty_type);
CREATE INDEX idx_penalty_config_active ON penalty_configurations(is_active);

-- =====================================================
-- 2. LOAN PENALTIES TABLE
-- Records each penalty/late fee applied to a loan
-- =====================================================
CREATE TABLE IF NOT EXISTS loan_penalties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  penalty_config_id UUID REFERENCES penalty_configurations(id),

  -- Penalty details
  penalty_type VARCHAR(30) NOT NULL,       -- late_fee, penalty_interest, collection_fee
  amount_usd DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Context
  days_past_due_at_application INTEGER NOT NULL,
  outstanding_balance_at_application DECIMAL(10, 2) NOT NULL,
  calculation_details JSONB,               -- Breakdown of how the amount was calculated

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'applied',  -- applied, paid, waived, reversed
  waived_by UUID,
  waived_at TIMESTAMPTZ,
  waiver_reason TEXT,
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id),

  -- Fineract sync
  fineract_charge_id INTEGER,
  fineract_synced_at TIMESTAMPTZ,

  -- Metadata
  applied_by VARCHAR(50) NOT NULL DEFAULT 'system',  -- system, manual (user ID)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_penalties_loan ON loan_penalties(loan_id);
CREATE INDEX idx_loan_penalties_customer ON loan_penalties(customer_id);
CREATE INDEX idx_loan_penalties_status ON loan_penalties(status);
CREATE INDEX idx_loan_penalties_type ON loan_penalties(penalty_type);
CREATE INDEX idx_loan_penalties_created ON loan_penalties(created_at);

-- =====================================================
-- 3. LOAN WRITE-OFFS TABLE
-- Records loan write-off decisions and accounting entries
-- =====================================================
CREATE TABLE IF NOT EXISTS loan_write_offs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Write-off details
  write_off_type VARCHAR(30) NOT NULL,    -- full, partial
  write_off_reason VARCHAR(50) NOT NULL,  -- default_180, uncollectable, fraud, deceased, settlement
  reason_details TEXT,

  -- Financial amounts
  principal_written_off DECIMAL(10, 2) NOT NULL,
  interest_written_off DECIMAL(10, 2) NOT NULL DEFAULT 0,
  penalties_written_off DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_written_off DECIMAL(10, 2) NOT NULL,
  outstanding_before DECIMAL(10, 2) NOT NULL,
  outstanding_after DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Recovery tracking
  recovery_expected BOOLEAN DEFAULT FALSE,
  recovered_amount_usd DECIMAL(10, 2) DEFAULT 0,
  recovery_notes TEXT,

  -- Accounting
  accounting_entry_ref VARCHAR(100),       -- Reference to GL journal entry
  allowance_amount DECIMAL(10, 2),         -- Amount from provision/allowance account

  -- Approval workflow
  status VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, reversed
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Credit bureau reporting
  credit_bureau_reported BOOLEAN DEFAULT FALSE,
  credit_bureau_reported_at TIMESTAMPTZ,

  -- Fineract sync
  fineract_transaction_id INTEGER,
  fineract_synced_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_write_offs_loan ON loan_write_offs(loan_id);
CREATE INDEX idx_write_offs_customer ON loan_write_offs(customer_id);
CREATE INDEX idx_write_offs_status ON loan_write_offs(status);
CREATE INDEX idx_write_offs_type ON loan_write_offs(write_off_type);
CREATE INDEX idx_write_offs_reason ON loan_write_offs(write_off_reason);
CREATE INDEX idx_write_offs_created ON loan_write_offs(created_at);

-- =====================================================
-- 4. LOAN RESCHEDULES TABLE
-- Enhanced rescheduling with full audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS loan_reschedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Reschedule type
  reschedule_type VARCHAR(30) NOT NULL,   -- term_extension, rate_reduction, payment_holiday, balance_restructure, combined
  reason VARCHAR(50) NOT NULL,            -- hardship, natural_disaster, medical, job_loss, business_failure, other

  -- Current terms (snapshot before change)
  original_term_months INTEGER NOT NULL,
  original_interest_rate DECIMAL(5, 2) NOT NULL,
  original_monthly_amount DECIMAL(10, 2) NOT NULL,
  original_maturity_date DATE,
  original_outstanding DECIMAL(10, 2) NOT NULL,

  -- New terms (after rescheduling)
  new_term_months INTEGER NOT NULL,
  new_interest_rate DECIMAL(5, 2) NOT NULL,
  new_monthly_amount DECIMAL(10, 2) NOT NULL,
  new_maturity_date DATE,
  new_outstanding DECIMAL(10, 2) NOT NULL,

  -- Payment holiday specifics (if applicable)
  holiday_start_date DATE,
  holiday_end_date DATE,
  holiday_months INTEGER,

  -- Conditions & notes
  conditions JSONB,                        -- Any special conditions attached
  staff_notes TEXT,
  customer_acknowledgement BOOLEAN DEFAULT FALSE,

  -- Approval workflow
  status VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, active, completed, cancelled
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Rescheduling limits
  reschedule_count INTEGER NOT NULL DEFAULT 1,  -- How many times this loan has been rescheduled

  -- Fineract sync
  fineract_reschedule_id INTEGER,
  fineract_synced_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reschedules_loan ON loan_reschedules(loan_id);
CREATE INDEX idx_reschedules_customer ON loan_reschedules(customer_id);
CREATE INDEX idx_reschedules_status ON loan_reschedules(status);
CREATE INDEX idx_reschedules_type ON loan_reschedules(reschedule_type);
CREATE INDEX idx_reschedules_created ON loan_reschedules(created_at);

-- =====================================================
-- 5. ADD COLUMNS TO LOANS TABLE
-- Track penalty and write-off totals on the loan itself
-- =====================================================
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_penalties_usd DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_penalties_paid_usd DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_penalties_waived_usd DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS written_off_amount_usd DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS write_off_date TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_rescheduled_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_accrual_suspended BOOLEAN DEFAULT FALSE;

-- =====================================================
-- 6. DEFAULT PENALTY CONFIGURATIONS
-- Insert standard penalty rules for smartphone financing
-- =====================================================
INSERT INTO penalty_configurations (
  product_id, penalty_type, name, description,
  calculation_method, flat_amount_usd,
  grace_period_days, min_days_past_due, max_days_past_due,
  recurrence, max_applications, max_penalty_amount_usd,
  is_active
) VALUES
-- Late fee: $2 flat after 3-day grace, applied once per missed payment
(NULL, 'late_fee', 'Standard Late Fee', 'Flat late fee applied once per missed installment after grace period',
 'flat', 2.00,
 3, 1, NULL,
 'once', 1, 2.00,
 TRUE),
-- Collection fee: $5 flat after 30 days, applied once
(NULL, 'collection_fee', 'Collection Fee', 'Fee applied when loan enters active collection after 30 days past due',
 'flat', 5.00,
 0, 30, NULL,
 'once', 1, 5.00,
 TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. SYSTEM CONFIG ENTRIES FOR PENALTY/WRITE-OFF DEFAULTS
-- =====================================================
INSERT INTO system_config (key, value, description, updated_at)
VALUES
  ('penalty_grace_period_days', '3', 'Default grace period before penalties apply', NOW()),
  ('auto_write_off_days', '180', 'Days past due before auto write-off eligibility', NOW()),
  ('max_reschedules_per_loan', '3', 'Maximum number of reschedules allowed per loan', NOW()),
  ('penalty_accrual_cap_percentage', '0.25', 'Maximum penalty as percentage of outstanding balance', NOW()),
  ('write_off_approval_threshold_usd', '100', 'Write-offs above this amount require manager approval', NOW())
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 8. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE penalty_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_write_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages penalty_configurations" ON penalty_configurations FOR ALL USING (true);
CREATE POLICY "Service role manages loan_penalties" ON loan_penalties FOR ALL USING (true);
CREATE POLICY "Service role manages loan_write_offs" ON loan_write_offs FOR ALL USING (true);
CREATE POLICY "Service role manages loan_reschedules" ON loan_reschedules FOR ALL USING (true);
