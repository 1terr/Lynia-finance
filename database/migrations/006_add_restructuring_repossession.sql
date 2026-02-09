-- =====================================================
-- Lynia Finance - Restructuring, Repossession & Device Monitoring
-- Migration: 006
-- Created: February 8, 2026
-- Phase: Phase 3 - P3-T019/T020/T021/T022
-- =====================================================

-- Restructure Requests
CREATE TABLE IF NOT EXISTS restructure_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  type VARCHAR(30) NOT NULL,     -- term_extension, payment_reduction, payment_holiday, hardship, early_payoff
  reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'requested',
  current_terms JSONB NOT NULL,
  proposed_terms JSONB NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restructure_loan ON restructure_requests(loan_id);
CREATE INDEX idx_restructure_status ON restructure_requests(status);

-- Early Payoff Quotes
CREATE TABLE IF NOT EXISTS early_payoff_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES loans(id),
  outstanding_principal DECIMAL(10,2) NOT NULL,
  accrued_interest DECIMAL(10,2) DEFAULT 0,
  payoff_amount DECIMAL(10,2) NOT NULL,
  interest_saved DECIMAL(10,2) DEFAULT 0,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repossession Orders
CREATE TABLE IF NOT EXISTS repossession_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  device_id UUID NOT NULL REFERENCES devices(id),
  status VARCHAR(30) NOT NULL DEFAULT 'eligible',
  days_past_due INTEGER NOT NULL,
  outstanding_amount DECIMAL(10,2) NOT NULL,
  assigned_agent_id UUID,
  warning_sent_at TIMESTAMPTZ,
  recovery_date TIMESTAMPTZ,
  device_condition_on_recovery TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repossession_loan ON repossession_orders(loan_id);
CREATE INDEX idx_repossession_status ON repossession_orders(status);

-- Device Health Checks
CREATE TABLE IF NOT EXISTS device_health_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id),
  health_score INTEGER NOT NULL,
  battery_health INTEGER,
  storage_used_percent INTEGER,
  is_online BOOLEAN DEFAULT TRUE,
  alerts_count INTEGER DEFAULT 0,
  critical_alerts INTEGER DEFAULT 0,
  report_data JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_device ON device_health_checks(device_id);
CREATE INDEX idx_health_score ON device_health_checks(health_score);
CREATE INDEX idx_health_checked ON device_health_checks(checked_at);

-- RLS
ALTER TABLE restructure_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE early_payoff_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE repossession_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages restructure" ON restructure_requests FOR ALL USING (true);
CREATE POLICY "Service role manages payoff" ON early_payoff_quotes FOR ALL USING (true);
CREATE POLICY "Service role manages repossession" ON repossession_orders FOR ALL USING (true);
CREATE POLICY "Service role manages health" ON device_health_checks FOR ALL USING (true);
