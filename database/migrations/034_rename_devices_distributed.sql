-- =====================================================
-- Lynia Finance - Rename total_devices_sold Column
-- Migration: 034
-- Created: March 3, 2026
-- Purpose: Rename total_devices_sold to total_devices_distributed
--          to match the column name used by the distributor service
--          handlers (stats.ts, analytics-service.ts, data-export.ts).
-- =====================================================

-- Idempotent rename: only rename if the old column name still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'distributors'
      AND column_name = 'total_devices_sold'
  ) THEN
    ALTER TABLE distributors RENAME COLUMN total_devices_sold TO total_devices_distributed;
  END IF;
END $$;

-- Recreate the function that references this column with the new name.
-- (Originally created in migrations 002/016 as update_distributor_stats)
CREATE OR REPLACE FUNCTION update_distributor_stats(
  dist_id UUID,
  devices_sold INTEGER,
  revenue DECIMAL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.distributors
  SET
    total_devices_distributed = total_devices_distributed + devices_sold,
    total_revenue_usd = total_revenue_usd + revenue,
    updated_at = NOW()
  WHERE id = dist_id;
END;
$$ LANGUAGE plpgsql;
