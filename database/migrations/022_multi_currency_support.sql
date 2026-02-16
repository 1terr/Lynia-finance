-- Migration 022: Multi-currency support (USD/ZWL/ZAR)
-- Adds currency columns to loans and payments tables,
-- creates exchange_rates table for daily RBZ rate tracking.
-- Phase 8B deferred item 11.

-- =============================================
-- 1. Add currency to loans table
-- =============================================
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- =============================================
-- 2. Add currency to payments table
-- =============================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- =============================================
-- 3. Exchange rates table
-- =============================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  inverse_rate NUMERIC(18, 8) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'RBZ',
  effective_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exchange_rate_pair_date UNIQUE (from_currency, to_currency, effective_date, source)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_date
  ON exchange_rates (effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair
  ON exchange_rates (from_currency, to_currency);

-- =============================================
-- 4. Seed initial USD/ZWL rate (RBZ official)
-- =============================================
INSERT INTO exchange_rates (from_currency, to_currency, rate, inverse_rate, source, effective_date)
VALUES
  ('USD', 'ZWL', 25800.00, 0.00003876, 'RBZ', CURRENT_DATE),
  ('USD', 'ZAR', 18.50, 0.05405405, 'RBZ', CURRENT_DATE)
ON CONFLICT (from_currency, to_currency, effective_date, source) DO NOTHING;

-- =============================================
-- 5. Currency conversion helper function
-- =============================================
CREATE OR REPLACE FUNCTION convert_currency(
  p_amount NUMERIC,
  p_from VARCHAR(3),
  p_to VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  IF p_from = p_to THEN
    RETURN p_amount;
  END IF;

  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from
    AND to_currency = p_to
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'No exchange rate found for %/% on or before %', p_from, p_to, p_date;
  END IF;

  RETURN ROUND(p_amount * v_rate, 2);
END;
$$ LANGUAGE plpgsql STABLE;