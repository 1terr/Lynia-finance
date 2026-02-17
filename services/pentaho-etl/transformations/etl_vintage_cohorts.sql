-- =====================================================
-- Pentaho ETL: Vintage Cohort Analysis
-- Called by PDI job 05_calculate_vintage_cohorts.kjb
-- Calculates cohort performance by origination month
-- =====================================================

-- Delete today's vintage snapshots if re-running
DELETE FROM dw.fact_vintage_cohort WHERE snapshot_date = CURRENT_DATE;

INSERT INTO dw.fact_vintage_cohort (
  origination_year, origination_month, origination_period,
  months_on_book, snapshot_date,
  cohort_loan_count, cohort_principal_amount,
  defaulted_count, defaulted_amount,
  cumulative_default_rate, cumulative_loss_rate,
  current_count, dpd_1_30_count, dpd_31_60_count,
  dpd_61_90_count, dpd_90_plus_count,
  expected_collections, actual_collections, collection_rate,
  paid_off_count, paid_off_rate,
  avg_credit_score_at_origination,
  etl_loaded_at
)
SELECT
  EXTRACT(YEAR FROM fl.application_date)::INTEGER AS origination_year,
  EXTRACT(MONTH FROM fl.application_date)::INTEGER AS origination_month,
  TO_CHAR(fl.application_date, 'YYYY-MM') AS origination_period,

  -- Months on book = months since origination
  (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM fl.application_date)) * 12
  + (EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM fl.application_date)) AS months_on_book,

  CURRENT_DATE AS snapshot_date,

  -- Cohort size (all loans originated in this month)
  COUNT(*) AS cohort_loan_count,
  SUM(fl.original_principal) AS cohort_principal_amount,

  -- Defaults (DPD >= 90 or status = defaulted/written_off)
  COUNT(*) FILTER (WHERE fl.days_past_due >= 90 OR fl.loan_status IN ('defaulted', 'written_off')) AS defaulted_count,
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 90 OR fl.loan_status IN ('defaulted', 'written_off')), 0) AS defaulted_amount,

  -- Cumulative default rate
  CASE WHEN COUNT(*) > 0
       THEN COUNT(*) FILTER (WHERE fl.days_past_due >= 90 OR fl.loan_status IN ('defaulted', 'written_off'))::DECIMAL / COUNT(*)
       ELSE 0 END AS cumulative_default_rate,

  -- Cumulative loss rate (written-off amount / original principal)
  CASE WHEN SUM(fl.original_principal) > 0
       THEN COALESCE(SUM(fl.total_written_off), 0) / SUM(fl.original_principal)
       ELSE 0 END AS cumulative_loss_rate,

  -- DPD distribution
  COUNT(*) FILTER (WHERE fl.days_past_due = 0 AND fl.loan_status IN ('active', 'disbursed')) AS current_count,
  COUNT(*) FILTER (WHERE fl.days_past_due BETWEEN 1 AND 30 AND fl.loan_status IN ('active', 'disbursed')) AS dpd_1_30_count,
  COUNT(*) FILTER (WHERE fl.days_past_due BETWEEN 31 AND 60 AND fl.loan_status IN ('active', 'disbursed')) AS dpd_31_60_count,
  COUNT(*) FILTER (WHERE fl.days_past_due BETWEEN 61 AND 90 AND fl.loan_status IN ('active', 'disbursed')) AS dpd_61_90_count,
  COUNT(*) FILTER (WHERE fl.days_past_due > 90 AND fl.loan_status IN ('active', 'disbursed', 'defaulted')) AS dpd_90_plus_count,

  -- Collections (total due vs total paid for this cohort)
  SUM(fl.total_amount_due) AS expected_collections,
  SUM(fl.total_paid) AS actual_collections,
  CASE WHEN SUM(fl.total_amount_due) > 0
       THEN SUM(fl.total_paid) / SUM(fl.total_amount_due)
       ELSE 0 END AS collection_rate,

  -- Paid off
  COUNT(*) FILTER (WHERE fl.loan_status = 'paid_off') AS paid_off_count,
  CASE WHEN COUNT(*) > 0
       THEN COUNT(*) FILTER (WHERE fl.loan_status = 'paid_off')::DECIMAL / COUNT(*)
       ELSE 0 END AS paid_off_rate,

  -- Average credit score at origination
  AVG(fl.credit_score_at_origination) AS avg_credit_score_at_origination,

  NOW() AS etl_loaded_at

FROM dw.fact_loan fl
WHERE fl.application_date IS NOT NULL
  AND fl.loan_status NOT IN ('rejected', 'cancelled', 'pending')
GROUP BY
  EXTRACT(YEAR FROM fl.application_date),
  EXTRACT(MONTH FROM fl.application_date),
  TO_CHAR(fl.application_date, 'YYYY-MM');
