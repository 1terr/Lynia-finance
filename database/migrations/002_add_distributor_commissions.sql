-- =====================================================
-- Lynia Finance - Add Distributor Commissions Table
-- Migration: 002
-- Created: December 3, 2025
-- Purpose: Track distributor commissions for device handovers
-- =====================================================

-- =====================================================
-- DISTRIBUTOR_COMMISSIONS TABLE
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

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE TRIGGER update_distributor_commissions_updated_at
BEFORE UPDATE ON distributor_commissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RPC FUNCTION: Increment distributor statistics
-- =====================================================
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

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
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

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Distributor commissions table created successfully!';
  RAISE NOTICE '📊 Added:';
  RAISE NOTICE '   - distributor_commissions table';
  RAISE NOTICE '   - Indexes for performance';
  RAISE NOTICE '   - RLS policies';
  RAISE NOTICE '   - increment_distributor_stats() function';
  RAISE NOTICE '';
  RAISE NOTICE 'Commission rate: 5%% of device retail price';
END $$;
