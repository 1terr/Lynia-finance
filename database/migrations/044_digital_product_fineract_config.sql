-- Migration 044: Digital Product Fineract GL Configuration
--
-- Sets the accounting rule for the DIGI_LOAN_001 product to accrual-based (rule 3).
-- The GL account ID columns (fund_source_account_id, loan_portfolio_account_id, etc.)
-- were added in migration 038_fineract_product_params.sql.
--
-- IMPORTANT: The actual Fineract GL account IDs must be populated AFTER running
-- the setup script (scripts/fineract-setup-digital-gl.sh) which:
--   1. Creates GL accounts in Fineract via POST /glaccounts
--   2. Updates fineract_gl_account_config.fineract_account_id with returned IDs
--   3. Updates loan_products GL columns with the resolved Fineract IDs
--
-- GL Account Mapping (for reference — IDs resolved at runtime):
--   fund_source_account_id           → 1420 Mobile Money Float
--   loan_portfolio_account_id        → 1410 Digital Loans Receivable
--   transfers_in_suspense_account_id → 1430 Digital Transfers in Suspense
--   interest_on_loan_account_id      → 4210 Digital Loan Interest Income
--   income_from_fee_account_id       → 4220 Digital Loan Fee Income
--   income_from_penalty_account_id   → 4230 Digital Loan Penalty Income
--   write_off_account_id             → 5220 Digital Loan Write-offs
--   overpayment_liability_account_id → 2410 Digital Loan Overpayment Liability
--   receivable_interest_account_id   → 1411 Digital Loans Interest Receivable
--   receivable_fee_account_id        → 1412 Digital Loans Fee Receivable
--   receivable_penalty_account_id    → 1413 Digital Loans Penalty Receivable

BEGIN;

-- Set accounting rule to accrual-based (rule 3) for digital product.
-- Accrual accounting recognizes interest/fee income when earned, not when received,
-- which is required for accurate financial reporting under RBZ guidelines.
UPDATE loan_products SET
  accounting_rule = 3
WHERE product_code = 'DIGI_LOAN_001';

COMMIT;
