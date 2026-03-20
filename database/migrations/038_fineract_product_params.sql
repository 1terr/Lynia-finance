-- Migration 038: Fineract Loan Product Parameters
--
-- Adds columns to loan_products for ALL Fineract loan product parameters.
-- This enables Fineract-first product creation: the admin form captures
-- every Fineract field directly, products are created in Fineract synchronously,
-- and then stored in Lynia DB with the fineract_product_id.
--
-- Previously, Fineract parameters were hardcoded/guessed during async sync.
-- Now they are stored explicitly and editable by admins.

-- ============================================================================
-- A. Fineract Core Parameters
-- ============================================================================

ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS short_name VARCHAR(4),
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS digits_after_decimal INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS in_multiples_of INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_principal DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS number_of_repayments INTEGER,
  ADD COLUMN IF NOT EXISTS repayment_every INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS repayment_frequency_type INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS amortization_type INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_type INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_calculation_period_type INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS interest_rate_frequency_type INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS transaction_processing_strategy VARCHAR(100) NOT NULL DEFAULT 'mifos-standard-strategy',
  ADD COLUMN IF NOT EXISTS accounting_rule INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS min_interest_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS max_interest_rate DECIMAL(5,2);

COMMENT ON COLUMN loan_products.short_name IS
  'Fineract 4-char unique shortName identifier';
COMMENT ON COLUMN loan_products.currency_code IS
  'ISO 4217 currency code (USD, ZWL, ZAR)';
COMMENT ON COLUMN loan_products.default_principal IS
  'Default/typical loan principal amount sent to Fineract';
COMMENT ON COLUMN loan_products.number_of_repayments IS
  'Default number of repayment installments';
COMMENT ON COLUMN loan_products.repayment_every IS
  'Repayment frequency interval (e.g., every 1 month)';
COMMENT ON COLUMN loan_products.repayment_frequency_type IS
  'Fineract frequency enum: 0=days, 1=weeks, 2=months, 3=years';
COMMENT ON COLUMN loan_products.amortization_type IS
  'Fineract amortization: 0=equal installments, 1=equal principal payments';
COMMENT ON COLUMN loan_products.interest_type IS
  'Fineract interest method: 0=declining balance, 1=flat';
COMMENT ON COLUMN loan_products.interest_calculation_period_type IS
  'Fineract calc period: 0=daily, 1=same as repayment period';
COMMENT ON COLUMN loan_products.interest_rate_frequency_type IS
  'Fineract rate frequency: 2=per month, 3=per year';
COMMENT ON COLUMN loan_products.transaction_processing_strategy IS
  'Fineract repayment strategy code (default: mifos-standard-strategy)';
COMMENT ON COLUMN loan_products.accounting_rule IS
  'Fineract accounting: 1=none, 2=cash-based, 3=accrual, 4=upfront accrual';
COMMENT ON COLUMN loan_products.min_interest_rate IS
  'Minimum allowed interest rate per period';
COMMENT ON COLUMN loan_products.max_interest_rate IS
  'Maximum allowed interest rate per period';

-- ============================================================================
-- B. GL Account Mapping IDs (Fineract integer IDs)
-- ============================================================================

ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS fund_source_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS loan_portfolio_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS transfers_in_suspense_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS interest_on_loan_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS income_from_fee_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS income_from_penalty_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS write_off_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS overpayment_liability_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS receivable_interest_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS receivable_fee_account_id INTEGER,
  ADD COLUMN IF NOT EXISTS receivable_penalty_account_id INTEGER;

COMMENT ON COLUMN loan_products.fund_source_account_id IS
  'Fineract GL account ID: fund source for loan disbursements (Asset)';
COMMENT ON COLUMN loan_products.loan_portfolio_account_id IS
  'Fineract GL account ID: outstanding loan portfolio (Asset)';
COMMENT ON COLUMN loan_products.transfers_in_suspense_account_id IS
  'Fineract GL account ID: transfers in suspense (Asset)';
COMMENT ON COLUMN loan_products.interest_on_loan_account_id IS
  'Fineract GL account ID: interest income on loans (Income)';
COMMENT ON COLUMN loan_products.income_from_fee_account_id IS
  'Fineract GL account ID: fee income (Income)';
COMMENT ON COLUMN loan_products.income_from_penalty_account_id IS
  'Fineract GL account ID: penalty income (Income)';
COMMENT ON COLUMN loan_products.write_off_account_id IS
  'Fineract GL account ID: loan write-off expense (Expense)';
COMMENT ON COLUMN loan_products.overpayment_liability_account_id IS
  'Fineract GL account ID: customer overpayments (Liability)';
COMMENT ON COLUMN loan_products.receivable_interest_account_id IS
  'Fineract GL account ID: accrued interest receivable (Asset, accrual only)';
COMMENT ON COLUMN loan_products.receivable_fee_account_id IS
  'Fineract GL account ID: accrued fee receivable (Asset, accrual only)';
COMMENT ON COLUMN loan_products.receivable_penalty_account_id IS
  'Fineract GL account ID: accrued penalty receivable (Asset, accrual only)';

-- ============================================================================
-- C. Backfill Existing Rows
-- ============================================================================

-- Set default_principal as midpoint of min/max amounts
UPDATE loan_products
SET default_principal = ROUND((COALESCE(min_amount_usd, 50) + COALESCE(max_amount_usd, 500)) / 2, 2)
WHERE default_principal IS NULL;

-- Set number_of_repayments from existing max_term_months or loan_term_months
UPDATE loan_products
SET number_of_repayments = COALESCE(max_term_months, loan_term_months, 12)
WHERE number_of_repayments IS NULL;

-- Set short_name from first 4 chars of product_code (uppercased)
UPDATE loan_products
SET short_name = UPPER(LEFT(REGEXP_REPLACE(product_code, '[^A-Za-z0-9]', '', 'g'), 4))
WHERE short_name IS NULL AND product_code IS NOT NULL;

-- ============================================================================
-- D. Index for short_name uniqueness (partial, excluding soft-deleted)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_products_short_name
  ON loan_products(short_name)
  WHERE deleted_at IS NULL AND short_name IS NOT NULL;
