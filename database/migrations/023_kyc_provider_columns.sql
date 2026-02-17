-- Migration 023: KYC Provider-Agnostic Columns & Manual Reviews Table
--
-- Adds provider-neutral columns to kyc_submissions so the KYC handler can
-- work with any provider (Smile Identity, Didit, etc.) without column-name
-- coupling.  Also creates the kyc_manual_reviews table that the callback
-- handler inserts into (was previously missing — pre-existing issue #3).
--
-- Pre-existing fixes included:
--   Issue #1: Migration 013 targeted kyc_verifications instead of
--             kyc_submissions.  This migration adds the same manual-review
--             columns to the correct table.
--   Issue #2: Code used id_document_photo_url but schema defines
--             id_document_url — fixed in application code.

-- ===================================================================
-- 1. Add provider-agnostic columns to kyc_submissions
-- ===================================================================

-- Which KYC provider processed this submission
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS kyc_provider VARCHAR(50) DEFAULT 'smile_identity';

-- Provider's job/session identifier (replaces smile-specific columns)
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS provider_job_id VARCHAR(200);

-- Full raw provider response (JSONB) — provider-neutral
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS provider_response JSONB;

-- Verification decision outcome
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS verification_decision VARCHAR(50);

-- Human-readable reason for the decision
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS verification_reason TEXT;

-- Overall verification confidence score (0-100)
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS verification_confidence INTEGER
  CHECK (verification_confidence IS NULL OR (verification_confidence >= 0 AND verification_confidence <= 100));

-- Liveness check score (0-100)
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS liveness_score INTEGER
  CHECK (liveness_score IS NULL OR (liveness_score >= 0 AND liveness_score <= 100));

-- When the submission was rejected
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Whether manual review is required
ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS manual_review_required BOOLEAN DEFAULT FALSE;

-- ===================================================================
-- 2. Fix Migration 013: Add manual-review columns to kyc_submissions
--    (013 incorrectly targeted kyc_verifications which does not exist)
-- ===================================================================

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS manual_reviewer_id UUID;

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS manual_review_at TIMESTAMPTZ;

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS manual_review_notes TEXT;

ALTER TABLE kyc_submissions
  ADD COLUMN IF NOT EXISTS manual_confidence_score INTEGER
  CHECK (manual_confidence_score IS NULL OR (manual_confidence_score >= 0 AND manual_confidence_score <= 100));

-- ===================================================================
-- 3. Indexes for new columns
-- ===================================================================

CREATE INDEX IF NOT EXISTS idx_kyc_provider
  ON kyc_submissions(kyc_provider);

CREATE INDEX IF NOT EXISTS idx_kyc_provider_job_id
  ON kyc_submissions(provider_job_id);

CREATE INDEX IF NOT EXISTS idx_kyc_verification_decision
  ON kyc_submissions(verification_decision);

CREATE INDEX IF NOT EXISTS idx_kyc_manual_review_required
  ON kyc_submissions(manual_review_required)
  WHERE manual_review_required = TRUE;

-- ===================================================================
-- 4. Create kyc_manual_reviews table (pre-existing issue #3)
-- ===================================================================

CREATE TABLE IF NOT EXISTS kyc_manual_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  kyc_submission_id UUID NOT NULL REFERENCES kyc_submissions(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Review status
  review_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending, in_progress, approved, rejected

  -- Assignment
  assigned_to UUID REFERENCES admin_users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,

  -- SLA tracking
  sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    -- low, normal, high, urgent

  -- Review outcome
  decision VARCHAR(50),
    -- APPROVED, REJECTED
  decision_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for kyc_manual_reviews
CREATE INDEX IF NOT EXISTS idx_manual_reviews_submission
  ON kyc_manual_reviews(kyc_submission_id);

CREATE INDEX IF NOT EXISTS idx_manual_reviews_customer
  ON kyc_manual_reviews(customer_id);

CREATE INDEX IF NOT EXISTS idx_manual_reviews_status
  ON kyc_manual_reviews(review_status);

CREATE INDEX IF NOT EXISTS idx_manual_reviews_pending_sla
  ON kyc_manual_reviews(sla_deadline)
  WHERE review_status = 'pending';

-- RLS
ALTER TABLE kyc_manual_reviews ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 5. Backfill existing rows with provider info
-- ===================================================================

-- Set kyc_provider for existing rows (all are Smile Identity)
UPDATE kyc_submissions
  SET kyc_provider = 'smile_identity'
  WHERE kyc_provider IS NULL;

-- Copy verification_id to provider_job_id for existing Smile rows
UPDATE kyc_submissions
  SET provider_job_id = verification_id
  WHERE provider_job_id IS NULL AND verification_id IS NOT NULL;

-- Copy smile_identity_response to provider_response for existing rows
UPDATE kyc_submissions
  SET provider_response = smile_identity_response
  WHERE provider_response IS NULL AND smile_identity_response IS NOT NULL;

-- ===================================================================
-- 6. Comments
-- ===================================================================

COMMENT ON COLUMN kyc_submissions.kyc_provider IS 'KYC provider that processed this submission (smile_identity, didit)';
COMMENT ON COLUMN kyc_submissions.provider_job_id IS 'Provider-specific job/session identifier';
COMMENT ON COLUMN kyc_submissions.provider_response IS 'Full raw response from the KYC provider (JSONB)';
COMMENT ON COLUMN kyc_submissions.verification_decision IS 'Verification outcome: APPROVED, REJECTED, MANUAL_REVIEW';
COMMENT ON COLUMN kyc_submissions.verification_reason IS 'Human-readable reason for the verification decision';
COMMENT ON COLUMN kyc_submissions.verification_confidence IS 'Overall confidence score from provider (0-100)';
COMMENT ON COLUMN kyc_submissions.liveness_score IS 'Liveness check score from provider (0-100)';
COMMENT ON COLUMN kyc_submissions.rejected_at IS 'Timestamp when submission was rejected';
COMMENT ON COLUMN kyc_submissions.manual_review_required IS 'Whether this submission requires manual review';
COMMENT ON TABLE kyc_manual_reviews IS 'Tracks manual review tasks for KYC submissions that require human review';
