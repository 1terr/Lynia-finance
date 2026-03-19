-- Migration 039: Add Missing Fineract Mandatory Loan Product Fields
--
-- Fineract requires these fields when creating a loan product, but they were
-- omitted from migration 038. Without them, the Fineract API returns 400:
--   - daysInYearType (1=actual, 360, 364, 365)
--   - daysInMonthType (1=actual, 30)
--   - isInterestRecalculationEnabled (true/false)
--   - incomeFromRecoveryAccountId (GL account, required when accounting > none)

-- ============================================================================
-- A. Fineract Mandatory Parameters
-- ============================================================================

ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS days_in_year_type INTEGER NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS days_in_month_type INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS is_interest_recalculation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS income_from_recovery_account_id INTEGER;

COMMENT ON COLUMN loan_products.days_in_year_type IS
  'Fineract days-in-year calculation: 1=actual, 360, 364, 365';
COMMENT ON COLUMN loan_products.days_in_month_type IS
  'Fineract days-in-month calculation: 1=actual, 30=fixed 30 days';
COMMENT ON COLUMN loan_products.is_interest_recalculation_enabled IS
  'Whether Fineract recalculates interest on schedule changes';
COMMENT ON COLUMN loan_products.income_from_recovery_account_id IS
  'Fineract GL account ID: income from loan recoveries (Income)';
