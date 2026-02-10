-- Migration 012: Add payment method analytics table (T014)
-- Tracks which payment methods customers use (EcoCash, OneMoney, O'mari, etc.)
-- Used to evaluate when direct O'mari integration is justified.

CREATE TABLE IF NOT EXISTS payment_method_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  loan_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'ecocash', 'onemoney', 'omari', 'visa', 'mastercard',
    'zimswitch', 'innbucks', 'bank_transfer', 'cash', 'unknown'
  )),
  gateway TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN (
    'initiated', 'completed', 'failed', 'cancelled'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by payment method (dashboard breakdowns)
CREATE INDEX IF NOT EXISTS idx_payment_analytics_method
  ON payment_method_analytics (payment_method, created_at DESC);

-- Index for date-range queries (monthly/weekly reports)
CREATE INDEX IF NOT EXISTS idx_payment_analytics_date
  ON payment_method_analytics (created_at DESC);

-- Index for customer-level analytics
CREATE INDEX IF NOT EXISTS idx_payment_analytics_customer
  ON payment_method_analytics (customer_id, created_at DESC);

-- Index for O'mari-specific reporting (T014 ROI tracking)
CREATE INDEX IF NOT EXISTS idx_payment_analytics_omari
  ON payment_method_analytics (created_at DESC)
  WHERE payment_method = 'omari';

COMMENT ON TABLE payment_method_analytics IS 'Payment method usage analytics (T014). Tracks EcoCash/OneMoney/O''mari usage for ROI analysis.';

-- RLS: service role only
ALTER TABLE payment_method_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on payment_method_analytics"
  ON payment_method_analytics
  FOR ALL
  USING (true)
  WITH CHECK (true);
