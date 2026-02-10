-- Migration 013: Manual Verification Fields for Stub-Mode Operations
--
-- Adds columns needed for manual payment verification and KYC review
-- when running in stub mode (before external API integrations are active).
-- See: docs/external-integrations/DEPLOY-WITHOUT-INTEGRATIONS.md
--
-- Also updates the payment gateway enum to reflect the new direct
-- integration strategy (removing Paynow, adding O'mari and OneWallet).

-- ===================================================================
-- PAYMENTS: Manual verification columns
-- ===================================================================

-- Admin who verified the payment in the merchant portal
ALTER TABLE payments ADD COLUMN IF NOT EXISTS manual_verification_by UUID;

-- When the payment was manually verified
ALTER TABLE payments ADD COLUMN IF NOT EXISTS manual_verification_at TIMESTAMPTZ;

-- Notes from the admin verifying the payment
ALTER TABLE payments ADD COLUMN IF NOT EXISTS manual_verification_notes TEXT;

-- Customer's reported reference from their USSD transaction
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_reported_reference TEXT;

-- ===================================================================
-- KYC VERIFICATIONS: Manual review columns
-- ===================================================================

-- Admin who reviewed the KYC documents
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS manual_reviewer_id UUID;

-- When the manual review was completed
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS manual_review_at TIMESTAMPTZ;

-- Reviewer notes (rejection reason, verification details)
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS manual_review_notes TEXT;

-- Manual confidence score assigned by reviewer (0-100)
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS manual_confidence_score INTEGER
  CHECK (manual_confidence_score IS NULL OR (manual_confidence_score >= 0 AND manual_confidence_score <= 100));

-- ===================================================================
-- INDEXES for manual verification queries
-- ===================================================================

-- Index for finding payments pending manual verification
CREATE INDEX IF NOT EXISTS idx_payments_pending_verification
  ON payments (status, manual_verification_at)
  WHERE status = 'pending' AND manual_verification_at IS NULL;

-- Index for finding KYC reviews pending manual review
CREATE INDEX IF NOT EXISTS idx_kyc_pending_manual_review
  ON kyc_verifications (status, manual_review_at)
  WHERE status = 'pending' AND manual_review_at IS NULL;

-- ===================================================================
-- AUDIT: Ensure manual operations are tracked
-- ===================================================================

COMMENT ON COLUMN payments.manual_verification_by IS 'UUID of admin who manually verified this payment in the merchant portal';
COMMENT ON COLUMN payments.manual_verification_at IS 'Timestamp of manual verification';
COMMENT ON COLUMN payments.manual_verification_notes IS 'Admin notes during manual payment verification';
COMMENT ON COLUMN payments.customer_reported_reference IS 'Payment reference reported by customer from their USSD transaction';
COMMENT ON COLUMN kyc_verifications.manual_reviewer_id IS 'UUID of admin who manually reviewed KYC documents';
COMMENT ON COLUMN kyc_verifications.manual_review_at IS 'Timestamp of manual KYC review completion';
COMMENT ON COLUMN kyc_verifications.manual_review_notes IS 'Reviewer notes including rejection reasons';
COMMENT ON COLUMN kyc_verifications.manual_confidence_score IS 'Confidence score (0-100) assigned by manual reviewer';
