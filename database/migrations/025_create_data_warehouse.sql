-- =====================================================
-- Lynia Finance - Data Warehouse (Star Schema)
-- Migration: 025
-- Created: February 17, 2026
-- Phase: BI & Investor Reporting (Pentaho Integration)
-- Description: Creates a 'dw' schema with dimension and fact
--   tables for Pentaho ETL, investor-grade reporting, and
--   internal business intelligence dashboards.
-- =====================================================

-- =====================================================
-- 0. CREATE SCHEMA
-- =====================================================
CREATE SCHEMA IF NOT EXISTS dw;

COMMENT ON SCHEMA dw IS 'Data warehouse star schema for Pentaho BI, investor reporting, and analytics';

-- =====================================================
-- 1. DIMENSION: DATE
-- Pre-populated calendar dimension (2024-01-01 to 2030-12-31)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.dim_date (
  date_key INTEGER PRIMARY KEY,            -- YYYYMMDD format
  full_date DATE NOT NULL UNIQUE,
  day_of_week INTEGER NOT NULL,            -- 1=Monday, 7=Sunday (ISO)
  day_name VARCHAR(10) NOT NULL,
  day_of_month INTEGER NOT NULL,
  day_of_year INTEGER NOT NULL,
  week_of_year INTEGER NOT NULL,
  month_number INTEGER NOT NULL,
  month_name VARCHAR(10) NOT NULL,
  quarter INTEGER NOT NULL,
  year INTEGER NOT NULL,
  is_weekend BOOLEAN NOT NULL,
  is_month_start BOOLEAN NOT NULL,
  is_month_end BOOLEAN NOT NULL,
  is_quarter_end BOOLEAN NOT NULL,
  is_year_end BOOLEAN NOT NULL,
  fiscal_year INTEGER NOT NULL,            -- Lynia fiscal year = calendar year
  fiscal_quarter INTEGER NOT NULL
);

-- Populate dim_date: 2024-01-01 through 2030-12-31
INSERT INTO dw.dim_date (
  date_key, full_date, day_of_week, day_name, day_of_month, day_of_year,
  week_of_year, month_number, month_name, quarter, year,
  is_weekend, is_month_start, is_month_end, is_quarter_end, is_year_end,
  fiscal_year, fiscal_quarter
)
SELECT
  TO_CHAR(d, 'YYYYMMDD')::INTEGER AS date_key,
  d AS full_date,
  EXTRACT(ISODOW FROM d)::INTEGER AS day_of_week,
  TO_CHAR(d, 'Day') AS day_name,
  EXTRACT(DAY FROM d)::INTEGER AS day_of_month,
  EXTRACT(DOY FROM d)::INTEGER AS day_of_year,
  EXTRACT(WEEK FROM d)::INTEGER AS week_of_year,
  EXTRACT(MONTH FROM d)::INTEGER AS month_number,
  TO_CHAR(d, 'Month') AS month_name,
  EXTRACT(QUARTER FROM d)::INTEGER AS quarter,
  EXTRACT(YEAR FROM d)::INTEGER AS year,
  EXTRACT(ISODOW FROM d) IN (6, 7) AS is_weekend,
  EXTRACT(DAY FROM d) = 1 AS is_month_start,
  d = (DATE_TRUNC('month', d) + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS is_month_end,
  d = (DATE_TRUNC('quarter', d) + INTERVAL '3 months' - INTERVAL '1 day')::DATE AS is_quarter_end,
  EXTRACT(MONTH FROM d) = 12 AND EXTRACT(DAY FROM d) = 31 AS is_year_end,
  EXTRACT(YEAR FROM d)::INTEGER AS fiscal_year,
  EXTRACT(QUARTER FROM d)::INTEGER AS fiscal_quarter
FROM GENERATE_SERIES('2024-01-01'::DATE, '2030-12-31'::DATE, '1 day'::INTERVAL) AS d
ON CONFLICT (date_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_dim_date_year_month ON dw.dim_date(year, month_number);
CREATE INDEX IF NOT EXISTS idx_dim_date_quarter ON dw.dim_date(year, quarter);

-- =====================================================
-- 2. DIMENSION: CUSTOMER (SCD Type 2)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.dim_customer (
  customer_key SERIAL PRIMARY KEY,
  customer_id UUID NOT NULL,               -- Source: customers.id
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_masked VARCHAR(20),                -- Masked for privacy: +263****567
  province VARCHAR(100),
  city VARCHAR(100),
  location_type VARCHAR(20),               -- urban, peri_urban, rural
  employment_status VARCHAR(50),
  income_band VARCHAR(30),                 -- <100, 100-300, 300-500, 500+
  monthly_income_usd DECIMAL(10,2),
  household_size INTEGER,
  kyc_status VARCHAR(50),
  credit_tier VARCHAR(20),
  credit_score INTEGER,
  onboarding_channel VARCHAR(50),          -- whatsapp, web, agent
  first_loan_date DATE,
  customer_since DATE,
  fineract_client_id INTEGER,

  -- SCD Type 2 fields
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE DEFAULT '9999-12-31',
  is_current BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_customer_id ON dw.dim_customer(customer_id);
CREATE INDEX IF NOT EXISTS idx_dim_customer_current ON dw.dim_customer(customer_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_dim_customer_tier ON dw.dim_customer(credit_tier) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_dim_customer_province ON dw.dim_customer(province) WHERE is_current = TRUE;

-- =====================================================
-- 3. DIMENSION: LOAN PRODUCT
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.dim_loan_product (
  product_key SERIAL PRIMARY KEY,
  product_id UUID,                          -- Source: loan_products.id
  product_code VARCHAR(50),
  product_name VARCHAR(200),
  product_type VARCHAR(50),                 -- asset_financing, digital_credit
  tier_name VARCHAR(20),                    -- Tier 1, Tier 2, Tier 3
  min_amount_usd DECIMAL(10,2),
  max_amount_usd DECIMAL(10,2),
  interest_rate_annual DECIMAL(5,2),
  deposit_percentage DECIMAL(5,2),
  loan_term_months INTEGER,
  fineract_product_id INTEGER,

  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_product_id ON dw.dim_loan_product(product_id);
CREATE INDEX IF NOT EXISTS idx_dim_product_tier ON dw.dim_loan_product(tier_name);

-- =====================================================
-- 4. DIMENSION: DEVICE (Collateral)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.dim_device (
  device_key SERIAL PRIMARY KEY,
  device_id UUID NOT NULL,                  -- Source: devices.id
  imei VARCHAR(50),
  manufacturer VARCHAR(100),
  model VARCHAR(200),
  device_type VARCHAR(50),
  storage_gb INTEGER,
  condition VARCHAR(50),
  purchase_price_usd DECIMAL(10,2),
  retail_price_usd DECIMAL(10,2),
  lock_status VARCHAR(50),
  inventory_status VARCHAR(50),

  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_device_id ON dw.dim_device(device_id);
CREATE INDEX IF NOT EXISTS idx_dim_device_manufacturer ON dw.dim_device(manufacturer);

-- =====================================================
-- 5. DIMENSION: PAYMENT PROVIDER
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.dim_payment_provider (
  provider_key SERIAL PRIMARY KEY,
  provider_code VARCHAR(50) NOT NULL UNIQUE,  -- ecocash, onemoney, omari, innbucks, bank_transfer, cash
  provider_name VARCHAR(100) NOT NULL,
  channel_type VARCHAR(30) NOT NULL,          -- mobile_money, bank, cash
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed payment providers
INSERT INTO dw.dim_payment_provider (provider_code, provider_name, channel_type) VALUES
  ('ecocash', 'EcoCash (Econet)', 'mobile_money'),
  ('onemoney', 'OneMoney (NetOne)', 'mobile_money'),
  ('omari', 'O''mari (Old Mutual)', 'mobile_money'),
  ('innbucks', 'InnBucks', 'mobile_money'),
  ('bank_transfer', 'Bank Transfer', 'bank'),
  ('cash', 'Cash', 'cash')
ON CONFLICT (provider_code) DO NOTHING;

-- =====================================================
-- 6. DIMENSION: GEOGRAPHY
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.dim_geography (
  geo_key SERIAL PRIMARY KEY,
  province VARCHAR(100) NOT NULL,
  city VARCHAR(100),
  location_type VARCHAR(20),                 -- urban, peri_urban, rural
  country VARCHAR(50) NOT NULL DEFAULT 'Zimbabwe',
  UNIQUE(province, city, location_type)
);

CREATE INDEX IF NOT EXISTS idx_dim_geo_province ON dw.dim_geography(province);

-- =====================================================
-- 7. DIMENSION: CREDIT TIER (Conformed)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.dim_credit_tier (
  tier_key SERIAL PRIMARY KEY,
  tier_code VARCHAR(20) NOT NULL UNIQUE,      -- tier_1, tier_2, tier_3, manual_review, rejected
  tier_name VARCHAR(50) NOT NULL,
  min_score INTEGER,
  max_score INTEGER,
  max_loan_amount_usd DECIMAL(10,2),
  down_payment_pct DECIMAL(5,2),
  interest_rate_apr DECIMAL(5,2)
);

INSERT INTO dw.dim_credit_tier (tier_code, tier_name, min_score, max_score, max_loan_amount_usd, down_payment_pct, interest_rate_apr) VALUES
  ('tier_3', 'Tier 3 Premium', 750, 850, 500.00, 5.00, 10.00),
  ('tier_2', 'Tier 2 Standard', 700, 749, 350.00, 10.00, 12.00),
  ('tier_1', 'Tier 1 Entry', 650, 699, 200.00, 10.00, 15.00),
  ('manual_review', 'Manual Review', 550, 649, NULL, NULL, NULL),
  ('rejected', 'Rejected', 300, 549, NULL, NULL, NULL)
ON CONFLICT (tier_code) DO NOTHING;

-- =====================================================
-- 8. FACT: LOAN (Grain = one row per loan, updated daily)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_loan (
  loan_key SERIAL PRIMARY KEY,
  loan_id UUID NOT NULL UNIQUE,              -- Source: loans.id
  loan_number VARCHAR(50),

  -- Dimension keys
  customer_key INTEGER REFERENCES dw.dim_customer(customer_key),
  product_key INTEGER REFERENCES dw.dim_loan_product(product_key),
  device_key INTEGER REFERENCES dw.dim_device(device_key),
  geo_key INTEGER REFERENCES dw.dim_geography(geo_key),
  tier_key INTEGER REFERENCES dw.dim_credit_tier(tier_key),
  origination_date_key INTEGER REFERENCES dw.dim_date(date_key),
  maturity_date_key INTEGER REFERENCES dw.dim_date(date_key),
  disbursement_date_key INTEGER REFERENCES dw.dim_date(date_key),

  -- Measures: origination
  original_principal DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2),
  disbursed_amount DECIMAL(10,2),
  total_interest DECIMAL(10,2),
  total_amount_due DECIMAL(10,2),
  interest_rate_annual DECIMAL(5,2),
  loan_term_months INTEGER,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Measures: current state (updated nightly by ETL)
  outstanding_balance DECIMAL(10,2),
  total_paid DECIMAL(10,2) DEFAULT 0,
  total_penalties DECIMAL(10,2) DEFAULT 0,
  total_penalties_paid DECIMAL(10,2) DEFAULT 0,
  total_written_off DECIMAL(10,2) DEFAULT 0,
  days_past_due INTEGER DEFAULT 0,
  missed_payments_count INTEGER DEFAULT 0,

  -- Collateral
  device_value_usd DECIMAL(10,2),
  ltv_ratio DECIMAL(5,4),                    -- loan_amount / device_value

  -- Scoring at origination
  credit_score_at_origination INTEGER,
  affordability_score INTEGER,
  repayment_willingness_score INTEGER,
  mobile_money_score INTEGER,
  external_credit_score INTEGER,
  kyc_verification_score INTEGER,

  -- Status
  loan_status VARCHAR(50),                   -- pending, approved, disbursed, active, paid_off, defaulted, written_off
  approval_status VARCHAR(50),
  deposit_paid BOOLEAN DEFAULT FALSE,
  is_restructured BOOLEAN DEFAULT FALSE,
  reschedule_count INTEGER DEFAULT 0,

  -- Dates
  application_date DATE,
  approval_date DATE,
  disbursement_date DATE,
  maturity_date DATE,
  close_date DATE,
  write_off_date DATE,
  last_payment_date DATE,
  next_payment_date DATE,
  next_payment_amount DECIMAL(10,2),

  -- Fineract
  fineract_loan_id INTEGER,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_loan_customer ON dw.fact_loan(customer_key);
CREATE INDEX IF NOT EXISTS idx_fact_loan_product ON dw.fact_loan(product_key);
CREATE INDEX IF NOT EXISTS idx_fact_loan_status ON dw.fact_loan(loan_status);
CREATE INDEX IF NOT EXISTS idx_fact_loan_dpd ON dw.fact_loan(days_past_due);
CREATE INDEX IF NOT EXISTS idx_fact_loan_origination ON dw.fact_loan(origination_date_key);
CREATE INDEX IF NOT EXISTS idx_fact_loan_tier ON dw.fact_loan(tier_key);

-- =====================================================
-- 9. FACT: PAYMENT (Grain = one row per payment)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_payment (
  payment_key SERIAL PRIMARY KEY,
  payment_id UUID NOT NULL UNIQUE,           -- Source: payments.id

  -- Dimension keys
  loan_key INTEGER REFERENCES dw.fact_loan(loan_key),
  customer_key INTEGER REFERENCES dw.dim_customer(customer_key),
  provider_key INTEGER REFERENCES dw.dim_payment_provider(provider_key),
  payment_date_key INTEGER REFERENCES dw.dim_date(date_key),

  -- Measures
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  amount_usd DECIMAL(10,2),                  -- Converted to USD for standardized reporting

  -- Attributes
  payment_type VARCHAR(50),                   -- deposit, installment, late_fee, early_payoff
  payment_method VARCHAR(50),
  payment_status VARCHAR(50),                 -- pending, confirmed, failed, refunded

  -- Dates
  payment_date DATE,
  confirmed_date DATE,

  -- Fineract
  fineract_transaction_id INTEGER,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_payment_loan ON dw.fact_payment(loan_key);
CREATE INDEX IF NOT EXISTS idx_fact_payment_customer ON dw.fact_payment(customer_key);
CREATE INDEX IF NOT EXISTS idx_fact_payment_provider ON dw.fact_payment(provider_key);
CREATE INDEX IF NOT EXISTS idx_fact_payment_date ON dw.fact_payment(payment_date_key);
CREATE INDEX IF NOT EXISTS idx_fact_payment_type ON dw.fact_payment(payment_type);
CREATE INDEX IF NOT EXISTS idx_fact_payment_status ON dw.fact_payment(payment_status);

-- =====================================================
-- 10. FACT: DAILY PORTFOLIO SNAPSHOT
-- (Grain = one row per day, captures portfolio state)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_daily_portfolio (
  id SERIAL PRIMARY KEY,
  snapshot_date_key INTEGER NOT NULL REFERENCES dw.dim_date(date_key),
  snapshot_date DATE NOT NULL UNIQUE,

  -- Portfolio size
  total_active_loans INTEGER NOT NULL DEFAULT 0,
  total_customers_with_active_loans INTEGER NOT NULL DEFAULT 0,

  -- Outstanding balances
  total_outstanding_principal DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_outstanding_interest DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_outstanding DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Disbursements (for this day)
  new_disbursements_count INTEGER NOT NULL DEFAULT 0,
  new_disbursements_amount DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Collections (for this day)
  collections_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  collections_count INTEGER NOT NULL DEFAULT 0,

  -- Portfolio at Risk (PAR) - as percentages of total outstanding
  par_1_amount DECIMAL(14,2) NOT NULL DEFAULT 0,    -- DPD >= 1
  par_7_amount DECIMAL(14,2) NOT NULL DEFAULT 0,    -- DPD >= 7
  par_30_amount DECIMAL(14,2) NOT NULL DEFAULT 0,   -- DPD >= 30
  par_60_amount DECIMAL(14,2) NOT NULL DEFAULT 0,   -- DPD >= 60
  par_90_amount DECIMAL(14,2) NOT NULL DEFAULT 0,   -- DPD >= 90
  par_1_pct DECIMAL(7,4) DEFAULT 0,
  par_7_pct DECIMAL(7,4) DEFAULT 0,
  par_30_pct DECIMAL(7,4) DEFAULT 0,
  par_60_pct DECIMAL(7,4) DEFAULT 0,
  par_90_pct DECIMAL(7,4) DEFAULT 0,

  -- Loan counts by PAR bucket
  par_1_count INTEGER NOT NULL DEFAULT 0,
  par_7_count INTEGER NOT NULL DEFAULT 0,
  par_30_count INTEGER NOT NULL DEFAULT 0,
  par_60_count INTEGER NOT NULL DEFAULT 0,
  par_90_count INTEGER NOT NULL DEFAULT 0,

  -- NPL (non-performing = DPD > 90)
  npl_count INTEGER NOT NULL DEFAULT 0,
  npl_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  npl_ratio DECIMAL(7,4) DEFAULT 0,

  -- Write-offs (for this day)
  write_offs_count INTEGER NOT NULL DEFAULT 0,
  write_offs_amount DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Recoveries on written-off loans (for this day)
  recoveries_amount DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Applications (for this day)
  applications_submitted INTEGER NOT NULL DEFAULT 0,
  applications_approved INTEGER NOT NULL DEFAULT 0,
  applications_rejected INTEGER NOT NULL DEFAULT 0,

  -- Average metrics
  avg_loan_size DECIMAL(10,2) DEFAULT 0,
  avg_outstanding_balance DECIMAL(10,2) DEFAULT 0,
  avg_days_past_due DECIMAL(7,2) DEFAULT 0,
  avg_interest_rate DECIMAL(5,2) DEFAULT 0,
  weighted_avg_interest_rate DECIMAL(5,2) DEFAULT 0,

  -- Tier distribution (counts)
  tier_1_count INTEGER NOT NULL DEFAULT 0,
  tier_2_count INTEGER NOT NULL DEFAULT 0,
  tier_3_count INTEGER NOT NULL DEFAULT 0,

  -- Device lock activity (for this day)
  devices_locked INTEGER NOT NULL DEFAULT 0,
  devices_unlocked INTEGER NOT NULL DEFAULT 0,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_portfolio_date ON dw.fact_daily_portfolio(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fact_portfolio_datekey ON dw.fact_daily_portfolio(snapshot_date_key);

-- =====================================================
-- 11. FACT: VINTAGE COHORT ANALYSIS
-- (Grain = origination_month x months_on_book)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_vintage_cohort (
  id SERIAL PRIMARY KEY,
  origination_year INTEGER NOT NULL,
  origination_month INTEGER NOT NULL,
  origination_period VARCHAR(7) NOT NULL,     -- 'YYYY-MM'
  months_on_book INTEGER NOT NULL,            -- 0, 1, 2, 3, ...
  snapshot_date DATE NOT NULL,

  -- Cohort size
  cohort_loan_count INTEGER NOT NULL,
  cohort_principal_amount DECIMAL(14,2) NOT NULL,

  -- Default metrics at this point in time
  defaulted_count INTEGER NOT NULL DEFAULT 0,
  defaulted_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cumulative_default_rate DECIMAL(7,4) NOT NULL DEFAULT 0,       -- defaulted_count / cohort_loan_count
  cumulative_loss_rate DECIMAL(7,4) NOT NULL DEFAULT 0,          -- defaulted_amount / cohort_principal_amount

  -- DPD distribution at this point
  current_count INTEGER NOT NULL DEFAULT 0,                       -- DPD = 0
  dpd_1_30_count INTEGER NOT NULL DEFAULT 0,
  dpd_31_60_count INTEGER NOT NULL DEFAULT 0,
  dpd_61_90_count INTEGER NOT NULL DEFAULT 0,
  dpd_90_plus_count INTEGER NOT NULL DEFAULT 0,

  -- Collection performance
  expected_collections DECIMAL(14,2) DEFAULT 0,
  actual_collections DECIMAL(14,2) DEFAULT 0,
  collection_rate DECIMAL(7,4) DEFAULT 0,                         -- actual / expected

  -- Paid off
  paid_off_count INTEGER NOT NULL DEFAULT 0,
  paid_off_rate DECIMAL(7,4) DEFAULT 0,

  -- Average credit score for cohort
  avg_credit_score_at_origination DECIMAL(7,2) DEFAULT 0,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(origination_period, months_on_book, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_fact_vintage_period ON dw.fact_vintage_cohort(origination_period);
CREATE INDEX IF NOT EXISTS idx_fact_vintage_mob ON dw.fact_vintage_cohort(months_on_book);
CREATE INDEX IF NOT EXISTS idx_fact_vintage_snapshot ON dw.fact_vintage_cohort(snapshot_date);

-- =====================================================
-- 12. FACT: KYC VERIFICATION
-- (Grain = one row per KYC attempt)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_kyc (
  kyc_key SERIAL PRIMARY KEY,
  kyc_id UUID NOT NULL UNIQUE,                -- Source: kyc_submissions.id

  -- Dimension keys
  customer_key INTEGER REFERENCES dw.dim_customer(customer_key),
  submission_date_key INTEGER REFERENCES dw.dim_date(date_key),
  geo_key INTEGER REFERENCES dw.dim_geography(geo_key),

  -- Measures
  attempt_number INTEGER,
  confidence_score INTEGER,
  face_match_score INTEGER,
  liveness_passed BOOLEAN,
  processing_time_seconds DECIMAL(10,2),      -- Time from submission to result

  -- Attributes
  id_document_type VARCHAR(50),
  verification_status VARCHAR(50),            -- pending, approved, rejected
  rejection_reason TEXT,
  kyc_provider VARCHAR(50),                   -- smile_identity, didit

  -- Dates
  submission_date DATE,
  verification_date DATE,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_kyc_customer ON dw.fact_kyc(customer_key);
CREATE INDEX IF NOT EXISTS idx_fact_kyc_date ON dw.fact_kyc(submission_date_key);
CREATE INDEX IF NOT EXISTS idx_fact_kyc_status ON dw.fact_kyc(verification_status);

-- =====================================================
-- 13. FACT: CREDIT DECISION
-- (Grain = one row per scoring event)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_credit_decision (
  decision_key SERIAL PRIMARY KEY,
  score_id UUID NOT NULL UNIQUE,              -- Source: credit_scores.id

  -- Dimension keys
  customer_key INTEGER REFERENCES dw.dim_customer(customer_key),
  loan_key INTEGER REFERENCES dw.fact_loan(loan_key),
  scoring_date_key INTEGER REFERENCES dw.dim_date(date_key),
  tier_key INTEGER REFERENCES dw.dim_credit_tier(tier_key),

  -- Measures: component scores
  total_score INTEGER,                        -- Raw 0-1000
  scaled_score INTEGER,                       -- 300-850
  affordability_score INTEGER,                -- 0-300
  repayment_willingness_score INTEGER,        -- 0-250
  mobile_money_score INTEGER,                 -- 0-200
  external_credit_score INTEGER,              -- 0-150
  kyc_verification_score INTEGER,             -- 0-100

  -- Decision
  decision VARCHAR(50),                       -- approve, review, reject
  credit_tier VARCHAR(20),
  recommended_limit_usd DECIMAL(10,2),

  -- Model info
  model_version VARCHAR(50),

  -- Dates
  scoring_date DATE,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_decision_customer ON dw.fact_credit_decision(customer_key);
CREATE INDEX IF NOT EXISTS idx_fact_decision_date ON dw.fact_credit_decision(scoring_date_key);
CREATE INDEX IF NOT EXISTS idx_fact_decision_tier ON dw.fact_credit_decision(tier_key);
CREATE INDEX IF NOT EXISTS idx_fact_decision_decision ON dw.fact_credit_decision(decision);

-- =====================================================
-- 14. FACT: GL DAILY BALANCE (Fineract General Ledger)
-- (Grain = one row per GL account per day)
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_gl_daily (
  id SERIAL PRIMARY KEY,
  snapshot_date_key INTEGER NOT NULL REFERENCES dw.dim_date(date_key),
  snapshot_date DATE NOT NULL,

  -- GL account info
  gl_account_id INTEGER NOT NULL,
  gl_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(200),
  account_type VARCHAR(20),                   -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE

  -- Balances
  opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  debit_total DECIMAL(18,2) NOT NULL DEFAULT 0,
  credit_total DECIMAL(18,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(18,2) NOT NULL DEFAULT 0,

  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(snapshot_date, gl_account_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_fact_gl_date ON dw.fact_gl_daily(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fact_gl_account ON dw.fact_gl_daily(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_fact_gl_type ON dw.fact_gl_daily(account_type);

-- =====================================================
-- 15. INVESTOR REPORT: BORROWING BASE (Daily)
-- Pre-calculated borrowing base for investor consumption
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.rpt_borrowing_base (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  report_date_key INTEGER REFERENCES dw.dim_date(date_key),

  -- Receivables
  total_receivables DECIMAL(14,2) NOT NULL DEFAULT 0,
  eligible_receivables DECIMAL(14,2) NOT NULL DEFAULT 0,
  ineligible_receivables DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Ineligibility breakdown
  ineligible_dpd_30_plus DECIMAL(14,2) DEFAULT 0,
  ineligible_written_off DECIMAL(14,2) DEFAULT 0,
  ineligible_restructured DECIMAL(14,2) DEFAULT 0,
  ineligible_kyc_incomplete DECIMAL(14,2) DEFAULT 0,

  -- Concentration limits
  largest_single_exposure DECIMAL(14,2) DEFAULT 0,
  largest_single_exposure_pct DECIMAL(7,4) DEFAULT 0,
  top_10_exposure DECIMAL(14,2) DEFAULT 0,
  top_10_exposure_pct DECIMAL(7,4) DEFAULT 0,

  -- Geographic concentration
  largest_province_exposure DECIMAL(14,2) DEFAULT 0,
  largest_province_name VARCHAR(100),
  largest_province_pct DECIMAL(7,4) DEFAULT 0,

  -- Product concentration
  tier_1_exposure DECIMAL(14,2) DEFAULT 0,
  tier_1_pct DECIMAL(7,4) DEFAULT 0,
  tier_2_exposure DECIMAL(14,2) DEFAULT 0,
  tier_2_pct DECIMAL(7,4) DEFAULT 0,
  tier_3_exposure DECIMAL(14,2) DEFAULT 0,
  tier_3_pct DECIMAL(7,4) DEFAULT 0,

  -- Advance rate and availability
  advance_rate DECIMAL(5,4) DEFAULT 0.80,     -- Configured per facility
  available_borrowing_base DECIMAL(14,2) DEFAULT 0,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpt_bb_date ON dw.rpt_borrowing_base(report_date);

-- =====================================================
-- 16. INVESTOR REPORT: MONTHLY FINANCIALS
-- Pre-calculated revenue and profitability metrics
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.rpt_monthly_financials (
  id SERIAL PRIMARY KEY,
  report_month VARCHAR(7) NOT NULL UNIQUE,    -- 'YYYY-MM'
  report_year INTEGER NOT NULL,
  report_month_number INTEGER NOT NULL,

  -- Revenue
  interest_income DECIMAL(14,2) NOT NULL DEFAULT 0,
  fee_income DECIMAL(14,2) NOT NULL DEFAULT 0,       -- Late fees, processing fees
  total_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Losses
  write_off_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  provision_amount DECIMAL(14,2) NOT NULL DEFAULT 0,  -- Loan loss provision
  net_credit_losses DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Net yield
  avg_outstanding_portfolio DECIMAL(14,2) DEFAULT 0,
  net_yield_pct DECIMAL(7,4) DEFAULT 0,                -- (revenue - losses) / avg outstanding

  -- Origination
  loans_originated_count INTEGER NOT NULL DEFAULT 0,
  loans_originated_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  avg_loan_size DECIMAL(10,2) DEFAULT 0,

  -- Collections
  total_collections DECIMAL(14,2) NOT NULL DEFAULT 0,
  scheduled_collections DECIMAL(14,2) NOT NULL DEFAULT 0,
  collection_rate DECIMAL(7,4) DEFAULT 0,

  -- Portfolio
  end_of_month_outstanding DECIMAL(14,2) DEFAULT 0,
  end_of_month_active_loans INTEGER DEFAULT 0,
  end_of_month_par_30 DECIMAL(7,4) DEFAULT 0,
  end_of_month_npl_ratio DECIMAL(7,4) DEFAULT 0,

  -- Customer metrics
  new_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  repeat_borrowers INTEGER DEFAULT 0,
  repeat_borrower_rate DECIMAL(7,4) DEFAULT 0,

  -- ETL metadata
  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpt_financials_month ON dw.rpt_monthly_financials(report_year, report_month_number);

-- =====================================================
-- 17. ROLL RATE ANALYSIS TABLE
-- Tracks migration between delinquency buckets month-over-month
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.fact_roll_rate (
  id SERIAL PRIMARY KEY,
  report_month VARCHAR(7) NOT NULL,           -- 'YYYY-MM'
  from_bucket VARCHAR(20) NOT NULL,           -- current, 1-30, 31-60, 61-90, 90+
  to_bucket VARCHAR(20) NOT NULL,             -- current, 1-30, 31-60, 61-90, 90+, write_off, paid_off
  loan_count INTEGER NOT NULL DEFAULT 0,
  outstanding_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  roll_rate_pct DECIMAL(7,4) DEFAULT 0,        -- loan_count moving / total in from_bucket

  etl_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(report_month, from_bucket, to_bucket)
);

CREATE INDEX IF NOT EXISTS idx_fact_roll_rate_month ON dw.fact_roll_rate(report_month);

-- =====================================================
-- 18. GRANT READ-ONLY ACCESS FOR REPORTING ROLE
-- =====================================================

-- Create a read-only role for Pentaho and investor API
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dw_readonly') THEN
    CREATE ROLE dw_readonly;
  END IF;
END $$;

GRANT USAGE ON SCHEMA dw TO dw_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA dw TO dw_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA dw GRANT SELECT ON TABLES TO dw_readonly;

-- =====================================================
-- 19. ETL METADATA TABLE
-- Tracks ETL job runs for monitoring and debugging
-- =====================================================
CREATE TABLE IF NOT EXISTS dw.etl_job_log (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  job_type VARCHAR(50) NOT NULL,              -- dimension_load, fact_load, aggregation, report
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running',  -- running, success, failed, warning
  rows_read INTEGER DEFAULT 0,
  rows_written INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_rejected INTEGER DEFAULT 0,
  error_message TEXT,
  duration_seconds DECIMAL(10,2),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_etl_log_job ON dw.etl_job_log(job_name);
CREATE INDEX IF NOT EXISTS idx_etl_log_status ON dw.etl_job_log(status);
CREATE INDEX IF NOT EXISTS idx_etl_log_date ON dw.etl_job_log(run_date);

-- =====================================================
-- COMPLETION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Data warehouse schema created successfully';
  RAISE NOTICE 'Schema: dw';
  RAISE NOTICE 'Dimensions: 7 (date, customer, loan_product, device, payment_provider, geography, credit_tier)';
  RAISE NOTICE 'Facts: 7 (loan, payment, daily_portfolio, vintage_cohort, kyc, credit_decision, gl_daily)';
  RAISE NOTICE 'Reports: 3 (borrowing_base, monthly_financials, roll_rate)';
  RAISE NOTICE 'Utilities: 2 (etl_job_log, dw_readonly role)';
END $$;
