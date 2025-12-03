-- =====================================================
-- Lynia Finance - Add Trustonic Device Fields
-- Migration: 003
-- Created: December 3, 2025
-- Purpose: Add Trustonic integration fields to devices table
-- =====================================================

-- =====================================================
-- UPDATE DEVICES TABLE: Add Trustonic fields
-- =====================================================

-- Add Trustonic device enrollment fields
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS trustonic_device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS trustonic_enrolled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trustonic_enrolled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trustonic_enrollment_status VARCHAR(50) DEFAULT 'pending';

-- Add indexes for Trustonic queries
CREATE INDEX IF NOT EXISTS idx_devices_trustonic_device_id ON devices(trustonic_device_id);
CREATE INDEX IF NOT EXISTS idx_devices_trustonic_enrolled ON devices(trustonic_enrolled);

-- Add lock_reason field (optional - for storing why device was locked)
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(200);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Trustonic device fields added successfully!';
  RAISE NOTICE '📊 Added to devices table:';
  RAISE NOTICE '   - trustonic_device_id (Trustonic unique identifier)';
  RAISE NOTICE '   - trustonic_enrolled (enrollment status boolean)';
  RAISE NOTICE '   - trustonic_enrolled_at (enrollment timestamp)';
  RAISE NOTICE '   - trustonic_enrollment_status (pending/enrolled/failed)';
  RAISE NOTICE '   - lock_reason (why device was locked)';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Indexes created for performance';
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  Device enrollment with Trustonic occurs during handover';
  RAISE NOTICE 'ℹ️  No app installation required on customer device';
END $$;
