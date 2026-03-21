-- Migration 045: Product Eligibility - Credit Score Ranges
--
-- Adds min/max credit score columns to loan_products so each product
-- defines its own eligibility range. Replaces the hardcoded 3-tier
-- system (Tier 1: 350-499, Tier 2: 500-649, Tier 3: 650+) with
-- per-product score thresholds that can overlap.

ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS min_credit_score INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS max_credit_score INTEGER DEFAULT 850;

-- Backfill existing products with the minimum approval threshold (350)
-- so they match the current behavior where score >= 350 is approved.
UPDATE loan_products
  SET min_credit_score = 350, max_credit_score = 850
  WHERE min_credit_score = 300;

-- Index for eligibility queries (find products matching a given score)
CREATE INDEX IF NOT EXISTS idx_loan_products_credit_score_range
  ON loan_products (min_credit_score, max_credit_score)
  WHERE deleted_at IS NULL AND status = 'active';

COMMENT ON COLUMN loan_products.min_credit_score IS 'Minimum scaled credit score (300-850) required for eligibility';
COMMENT ON COLUMN loan_products.max_credit_score IS 'Maximum scaled credit score (300-850) for eligibility';
