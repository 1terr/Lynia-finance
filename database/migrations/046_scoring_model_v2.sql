-- Migration: 046_scoring_model_v2
-- Description: Add scoring model v2 columns for org verification and device collateral
-- Date: 2026-03-21

ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS org_verification_score INTEGER;
ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS device_collateral_score INTEGER;
ALTER TABLE credit_scores ADD COLUMN IF NOT EXISTS scoring_model_version VARCHAR(10) DEFAULT 'v2';

COMMENT ON COLUMN credit_scores.org_verification_score IS 'Organization verification score (0-350) - v2 scoring model';
COMMENT ON COLUMN credit_scores.device_collateral_score IS 'Device collateral coverage score (0-100) - v2 scoring model';
COMMENT ON COLUMN credit_scores.scoring_model_version IS 'Scoring model version: v1 (legacy) or v2 (org-centric)';
