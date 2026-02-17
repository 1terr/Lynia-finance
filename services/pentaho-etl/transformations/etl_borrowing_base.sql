-- =====================================================
-- Pentaho ETL: Borrowing Base Calculation
-- Called by PDI job 06_calculate_borrowing_base.kjb
-- Calculates eligible/ineligible receivables and
-- concentration limits for investor borrowing base
-- =====================================================

-- Delete today's report if re-running
DELETE FROM dw.rpt_borrowing_base WHERE report_date = CURRENT_DATE;

WITH active_loans AS (
  SELECT
    fl.*,
    dc.province,
    dc.customer_id
  FROM dw.fact_loan fl
  LEFT JOIN dw.dim_customer dc ON fl.customer_key = dc.customer_key AND dc.is_current = TRUE
  WHERE fl.loan_status IN ('active', 'disbursed')
    AND fl.outstanding_balance > 0
),
-- Eligibility: DPD < 30, not restructured, KYC verified
eligible AS (
  SELECT * FROM active_loans
  WHERE days_past_due < 30
    AND is_restructured = FALSE
),
ineligible AS (
  SELECT * FROM active_loans
  WHERE days_past_due >= 30 OR is_restructured = TRUE
),
-- Concentration: single borrower
customer_exposure AS (
  SELECT
    customer_key,
    SUM(outstanding_balance) AS exposure
  FROM active_loans
  GROUP BY customer_key
  ORDER BY exposure DESC
),
-- Concentration: geographic
province_exposure AS (
  SELECT
    province,
    SUM(outstanding_balance) AS exposure
  FROM active_loans
  WHERE province IS NOT NULL
  GROUP BY province
  ORDER BY exposure DESC
),
-- Concentration: tier
tier_exposure AS (
  SELECT
    ct.tier_code,
    COALESCE(SUM(al.outstanding_balance), 0) AS exposure
  FROM active_loans al
  LEFT JOIN dw.dim_credit_tier ct ON al.tier_key = ct.tier_key
  GROUP BY ct.tier_code
),
totals AS (
  SELECT
    COALESCE(SUM(outstanding_balance), 0) AS total_receivables
  FROM active_loans
)
INSERT INTO dw.rpt_borrowing_base (
  report_date, report_date_key,
  total_receivables, eligible_receivables, ineligible_receivables,
  ineligible_dpd_30_plus, ineligible_written_off, ineligible_restructured, ineligible_kyc_incomplete,
  largest_single_exposure, largest_single_exposure_pct,
  top_10_exposure, top_10_exposure_pct,
  largest_province_exposure, largest_province_name, largest_province_pct,
  tier_1_exposure, tier_1_pct, tier_2_exposure, tier_2_pct, tier_3_exposure, tier_3_pct,
  advance_rate, available_borrowing_base,
  etl_loaded_at
)
SELECT
  CURRENT_DATE AS report_date,
  TO_CHAR(CURRENT_DATE, 'YYYYMMDD')::INTEGER AS report_date_key,
  t.total_receivables,
  COALESCE((SELECT SUM(outstanding_balance) FROM eligible), 0) AS eligible_receivables,
  COALESCE((SELECT SUM(outstanding_balance) FROM ineligible), 0) AS ineligible_receivables,

  -- Ineligibility reasons
  COALESCE((SELECT SUM(outstanding_balance) FROM active_loans WHERE days_past_due >= 30), 0) AS ineligible_dpd_30_plus,
  0 AS ineligible_written_off,
  COALESCE((SELECT SUM(outstanding_balance) FROM active_loans WHERE is_restructured = TRUE), 0) AS ineligible_restructured,
  0 AS ineligible_kyc_incomplete,

  -- Single borrower concentration
  COALESCE((SELECT exposure FROM customer_exposure LIMIT 1), 0) AS largest_single_exposure,
  CASE WHEN t.total_receivables > 0
       THEN COALESCE((SELECT exposure FROM customer_exposure LIMIT 1), 0) / t.total_receivables
       ELSE 0 END AS largest_single_exposure_pct,

  -- Top 10 borrowers
  COALESCE((SELECT SUM(exposure) FROM (SELECT exposure FROM customer_exposure LIMIT 10) sub), 0) AS top_10_exposure,
  CASE WHEN t.total_receivables > 0
       THEN COALESCE((SELECT SUM(exposure) FROM (SELECT exposure FROM customer_exposure LIMIT 10) sub), 0) / t.total_receivables
       ELSE 0 END AS top_10_exposure_pct,

  -- Geographic concentration
  COALESCE((SELECT exposure FROM province_exposure LIMIT 1), 0) AS largest_province_exposure,
  (SELECT province FROM province_exposure LIMIT 1) AS largest_province_name,
  CASE WHEN t.total_receivables > 0
       THEN COALESCE((SELECT exposure FROM province_exposure LIMIT 1), 0) / t.total_receivables
       ELSE 0 END AS largest_province_pct,

  -- Tier concentration
  COALESCE((SELECT exposure FROM tier_exposure WHERE tier_code = 'tier_1'), 0) AS tier_1_exposure,
  CASE WHEN t.total_receivables > 0
       THEN COALESCE((SELECT exposure FROM tier_exposure WHERE tier_code = 'tier_1'), 0) / t.total_receivables
       ELSE 0 END AS tier_1_pct,
  COALESCE((SELECT exposure FROM tier_exposure WHERE tier_code = 'tier_2'), 0) AS tier_2_exposure,
  CASE WHEN t.total_receivables > 0
       THEN COALESCE((SELECT exposure FROM tier_exposure WHERE tier_code = 'tier_2'), 0) / t.total_receivables
       ELSE 0 END AS tier_2_pct,
  COALESCE((SELECT exposure FROM tier_exposure WHERE tier_code = 'tier_3'), 0) AS tier_3_exposure,
  CASE WHEN t.total_receivables > 0
       THEN COALESCE((SELECT exposure FROM tier_exposure WHERE tier_code = 'tier_3'), 0) / t.total_receivables
       ELSE 0 END AS tier_3_pct,

  -- Advance rate (configurable, default 80%)
  0.80 AS advance_rate,
  COALESCE((SELECT SUM(outstanding_balance) FROM eligible), 0) * 0.80 AS available_borrowing_base,

  NOW() AS etl_loaded_at
FROM totals t;
