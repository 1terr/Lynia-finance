-- Migration 043: Digital Loan GL Account Configuration
--
-- Creates the fineract_gl_account_config table to store the desired General Ledger
-- chart of accounts for Fineract. This is a Lynia-side config table that maps to
-- Fineract GL accounts — actual account creation in Fineract happens via the
-- setup script (scripts/fineract-setup-digital-gl.sh).
--
-- The GL structure follows RBZ reporting requirements and separates digital loan
-- accounts from smartphone loan accounts for independent P&L tracking.
--
-- GL Code Ranges:
--   1410–1439  Digital Loan Assets (receivables, float, suspense)
--   2410–2419  Digital Loan Liabilities (overpayments)
--   4210–4249  Digital Loan Income (interest, fees, penalties, recoveries)
--   5210–5229  Digital Loan Expenses (provisions, write-offs)

BEGIN;

-- ─── GL Account Config Table ───

CREATE TABLE IF NOT EXISTS fineract_gl_account_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gl_code VARCHAR(20) NOT NULL UNIQUE,
  account_name VARCHAR(200) NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE')),
  parent_category VARCHAR(100),
  product_category VARCHAR(30),  -- 'smartphone', 'digital', or NULL for shared
  fineract_account_id INTEGER,   -- Set after creation in Fineract via setup script
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gl_account_config_type
  ON fineract_gl_account_config(account_type);

CREATE INDEX IF NOT EXISTS idx_gl_account_config_product_category
  ON fineract_gl_account_config(product_category);

COMMENT ON TABLE fineract_gl_account_config IS
  'Lynia-side config mapping to Fineract GL accounts. fineract_account_id is populated after running the Fineract GL setup script.';
COMMENT ON COLUMN fineract_gl_account_config.gl_code IS
  'Unique GL code used in Fineract chart of accounts';
COMMENT ON COLUMN fineract_gl_account_config.product_category IS
  'Product category this account belongs to: smartphone, digital, or NULL for shared accounts';
COMMENT ON COLUMN fineract_gl_account_config.fineract_account_id IS
  'Fineract integer ID returned by POST /glaccounts. NULL until setup script runs.';

-- ─── Digital Loan GL Accounts ───

-- ASSET accounts: Track what borrowers owe and funds in transit
INSERT INTO fineract_gl_account_config (gl_code, account_name, account_type, parent_category, product_category, description) VALUES
  ('1410', 'Digital Loans Receivable',          'ASSET', 'Loan Portfolio',    'digital',
    'Outstanding principal on digital loans. Debited on disbursement, credited on repayment.'),
  ('1411', 'Digital Loans Interest Receivable',  'ASSET', 'Loan Portfolio',    'digital',
    'Accrued interest receivable. Used under accrual accounting (rule 3) — debited when interest accrues, credited on payment.'),
  ('1412', 'Digital Loans Fee Receivable',       'ASSET', 'Loan Portfolio',    'digital',
    'Accrued fee receivable. Debited when fees are charged, credited on payment.'),
  ('1413', 'Digital Loans Penalty Receivable',   'ASSET', 'Loan Portfolio',    'digital',
    'Accrued penalty receivable. Debited when penalties are applied, credited on payment.'),
  ('1420', 'Mobile Money Float',                 'ASSET', 'Cash & Equivalents', 'digital',
    'EcoCash/OneMoney/InnBucks float used for digital loan disbursements and collections.'),
  ('1430', 'Digital Transfers in Suspense',      'ASSET', 'Suspense',          'digital',
    'Pending two-phase transfers. Holds funds between disbursement initiation and mobile money confirmation.');

-- LIABILITY accounts: Track what we owe customers
INSERT INTO fineract_gl_account_config (gl_code, account_name, account_type, parent_category, product_category, description) VALUES
  ('2410', 'Digital Loan Overpayment Liability', 'LIABILITY', 'Customer Liabilities', 'digital',
    'Customer overpayments held until refund or application to next installment.');

-- INCOME accounts: Revenue from digital lending
INSERT INTO fineract_gl_account_config (gl_code, account_name, account_type, parent_category, product_category, description) VALUES
  ('4210', 'Digital Loan Interest Income',  'INCOME', 'Loan Income', 'digital',
    'Interest earned on digital loans. Credited when interest is recognized (accrual basis).'),
  ('4220', 'Digital Loan Fee Income',       'INCOME', 'Loan Income', 'digital',
    'Fee income from digital loans (origination fees, processing fees).'),
  ('4230', 'Digital Loan Penalty Income',   'INCOME', 'Loan Income', 'digital',
    'Penalty income from late payments on digital loans.'),
  ('4240', 'Digital Loan Recovery Income',  'INCOME', 'Loan Income', 'digital',
    'Income from recovering previously written-off digital loans.');

-- EXPENSE accounts: Costs of digital lending
INSERT INTO fineract_gl_account_config (gl_code, account_name, account_type, parent_category, product_category, description) VALUES
  ('5210', 'Digital Loan Provisions',  'EXPENSE', 'Credit Losses', 'digital',
    'Expected credit loss provisions per loan_provision_rates table. Higher rates than smartphone (unsecured).'),
  ('5220', 'Digital Loan Write-offs',  'EXPENSE', 'Credit Losses', 'digital',
    'Confirmed bad debt write-offs for digital loans past recovery threshold.');

COMMIT;
