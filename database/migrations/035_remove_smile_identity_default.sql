-- Migration 035: Remove Smile Identity as KYC provider default
--
-- DIDIT is now the sole KYC provider. This migration:
--   1. Changes the default kyc_provider to 'didit'
--   2. Updates any existing 'smile_identity' rows to 'didit'
--   3. Updates the column comment
--
-- Safe to run: no destructive changes, legacy smile_identity_response column
-- remains in place for historical data.

-- Change default for new rows
ALTER TABLE kyc_submissions ALTER COLUMN kyc_provider SET DEFAULT 'didit';

-- Update existing rows that used smile_identity
UPDATE kyc_submissions SET kyc_provider = 'didit' WHERE kyc_provider = 'smile_identity';

-- Update column comment
COMMENT ON COLUMN kyc_submissions.kyc_provider IS 'KYC provider (didit)';
