-- =====================================================
-- Lynia Finance - ML Features & Training Data
-- Migration: 005
-- Created: February 8, 2026
-- Phase: Phase 3 - P3-T017/T018 ML Pipeline & Alt Data
-- =====================================================

-- Customer Feature Store
CREATE TABLE IF NOT EXISTS customer_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID UNIQUE NOT NULL REFERENCES customers(id),

  -- Mobile money features
  mm_account_age_months INTEGER DEFAULT 0,
  mm_monthly_inflow DECIMAL(10,2) DEFAULT 0,
  mm_monthly_outflow DECIMAL(10,2) DEFAULT 0,
  mm_tx_frequency DECIMAL(8,2) DEFAULT 0,
  airtime_consistency DECIMAL(5,4) DEFAULT 0,
  bill_regularity DECIMAL(5,4) DEFAULT 0,
  balance_trend DECIMAL(5,4) DEFAULT 0,
  p2p_frequency DECIMAL(8,2) DEFAULT 0,
  income_stability DECIMAL(5,4) DEFAULT 0.5,
  savings_indicator DECIMAL(5,4) DEFAULT 0,
  income_diversity INTEGER DEFAULT 1,

  -- Location features
  location_stability DECIMAL(5,4) DEFAULT 0.5,
  urban_score DECIMAL(5,4) DEFAULT 0.5,

  -- Referral features
  referral_quality DECIMAL(5,4) DEFAULT 0,

  -- Device features
  device_quality DECIMAL(5,4) DEFAULT 0.5,

  -- Behavioral features
  avg_response_time INTEGER DEFAULT 120,
  session_count INTEGER DEFAULT 1,
  early_payment_rate DECIMAL(5,4) DEFAULT 0,
  partial_payment_rate DECIMAL(5,4) DEFAULT 0,
  avg_dpd DECIMAL(8,2) DEFAULT 0,
  longest_on_time_streak INTEGER DEFAULT 0,
  comm_responsiveness DECIMAL(5,4) DEFAULT 0.5,

  -- Full feature vector (JSON for ML pipeline)
  features JSONB,

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_features_cid ON customer_features(customer_id);

-- ML Training Outcomes
CREATE TABLE IF NOT EXISTS ml_training_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  loan_id UUID NOT NULL REFERENCES loans(id),

  outcome VARCHAR(30) NOT NULL,  -- fully_paid, default, restructured
  days_past_due_max INTEGER DEFAULT 0,
  total_paid_ratio DECIMAL(5,4) DEFAULT 0,

  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ml_outcomes_customer ON ml_training_outcomes(customer_id);
CREATE INDEX idx_ml_outcomes_loan ON ml_training_outcomes(loan_id);

-- A/B Tests
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id VARCHAR(100) UNIQUE NOT NULL,
  model_a VARCHAR(50) NOT NULL,
  model_b VARCHAR(50) NOT NULL,
  model_b_weights JSONB,
  traffic_split INTEGER DEFAULT 10,  -- % to model B
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',  -- active, completed, cancelled
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE customer_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_training_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages features" ON customer_features FOR ALL USING (true);
CREATE POLICY "Service role manages outcomes" ON ml_training_outcomes FOR ALL USING (true);
CREATE POLICY "Service role manages ab_tests" ON ab_tests FOR ALL USING (true);
