-- =====================================================
-- Pentaho ETL: Daily Portfolio Snapshot
-- Called by PDI job 04_calculate_portfolio_snapshot.kjb
-- Calculates PAR buckets, NPL, collections, and all
-- daily portfolio metrics from dw.fact_loan
-- =====================================================

-- Delete today's snapshot if re-running
DELETE FROM dw.fact_daily_portfolio WHERE snapshot_date = CURRENT_DATE;

INSERT INTO dw.fact_daily_portfolio (
  snapshot_date_key, snapshot_date,
  total_active_loans, total_customers_with_active_loans,
  total_outstanding_principal, total_outstanding_interest, total_outstanding,
  new_disbursements_count, new_disbursements_amount,
  collections_amount, collections_count,
  par_1_amount, par_7_amount, par_30_amount, par_60_amount, par_90_amount,
  par_1_pct, par_7_pct, par_30_pct, par_60_pct, par_90_pct,
  par_1_count, par_7_count, par_30_count, par_60_count, par_90_count,
  npl_count, npl_amount, npl_ratio,
  write_offs_count, write_offs_amount,
  recoveries_amount,
  applications_submitted, applications_approved, applications_rejected,
  avg_loan_size, avg_outstanding_balance, avg_days_past_due, avg_interest_rate,
  weighted_avg_interest_rate,
  tier_1_count, tier_2_count, tier_3_count,
  devices_locked, devices_unlocked,
  etl_loaded_at
)
SELECT
  TO_CHAR(CURRENT_DATE, 'YYYYMMDD')::INTEGER AS snapshot_date_key,
  CURRENT_DATE AS snapshot_date,

  -- Portfolio size
  COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) AS total_active_loans,
  COUNT(DISTINCT fl.customer_key) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) AS total_customers_with_active_loans,

  -- Outstanding balances
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS total_outstanding_principal,
  0 AS total_outstanding_interest, -- Fineract would provide this breakdown
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS total_outstanding,

  -- Today's disbursements
  COUNT(*) FILTER (WHERE fl.disbursement_date = CURRENT_DATE) AS new_disbursements_count,
  COALESCE(SUM(fl.disbursed_amount) FILTER (WHERE fl.disbursement_date = CURRENT_DATE), 0) AS new_disbursements_amount,

  -- Today's collections
  COALESCE((SELECT SUM(fp.amount) FROM dw.fact_payment fp
            WHERE fp.payment_date = CURRENT_DATE AND fp.payment_status = 'confirmed'), 0) AS collections_amount,
  COALESCE((SELECT COUNT(*) FROM dw.fact_payment fp
            WHERE fp.payment_date = CURRENT_DATE AND fp.payment_status = 'confirmed'), 0) AS collections_count,

  -- PAR amounts (for active loans only)
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 1 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_1_amount,
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 7 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_7_amount,
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 30 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_30_amount,
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 60 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_60_amount,
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 90 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_90_amount,

  -- PAR percentages
  CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
       THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 1 AND fl.loan_status IN ('active', 'disbursed')), 0)
            / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
       ELSE 0 END AS par_1_pct,
  CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
       THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 7 AND fl.loan_status IN ('active', 'disbursed')), 0)
            / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
       ELSE 0 END AS par_7_pct,
  CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
       THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 30 AND fl.loan_status IN ('active', 'disbursed')), 0)
            / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
       ELSE 0 END AS par_30_pct,
  CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
       THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 60 AND fl.loan_status IN ('active', 'disbursed')), 0)
            / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
       ELSE 0 END AS par_60_pct,
  CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
       THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 90 AND fl.loan_status IN ('active', 'disbursed')), 0)
            / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
       ELSE 0 END AS par_90_pct,

  -- PAR counts
  COUNT(*) FILTER (WHERE fl.days_past_due >= 1 AND fl.loan_status IN ('active', 'disbursed')) AS par_1_count,
  COUNT(*) FILTER (WHERE fl.days_past_due >= 7 AND fl.loan_status IN ('active', 'disbursed')) AS par_7_count,
  COUNT(*) FILTER (WHERE fl.days_past_due >= 30 AND fl.loan_status IN ('active', 'disbursed')) AS par_30_count,
  COUNT(*) FILTER (WHERE fl.days_past_due >= 60 AND fl.loan_status IN ('active', 'disbursed')) AS par_60_count,
  COUNT(*) FILTER (WHERE fl.days_past_due >= 90 AND fl.loan_status IN ('active', 'disbursed')) AS par_90_count,

  -- NPL (non-performing = DPD > 90 or defaulted)
  COUNT(*) FILTER (WHERE (fl.days_past_due >= 90 OR fl.loan_status = 'defaulted') AND fl.loan_status NOT IN ('paid_off', 'written_off', 'rejected', 'cancelled')) AS npl_count,
  COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE (fl.days_past_due >= 90 OR fl.loan_status = 'defaulted') AND fl.loan_status NOT IN ('paid_off', 'written_off', 'rejected', 'cancelled')), 0) AS npl_amount,
  CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
       THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE (fl.days_past_due >= 90 OR fl.loan_status = 'defaulted') AND fl.loan_status NOT IN ('paid_off', 'written_off', 'rejected', 'cancelled')), 0)
            / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
       ELSE 0 END AS npl_ratio,

  -- Write-offs today
  COUNT(*) FILTER (WHERE fl.write_off_date = CURRENT_DATE) AS write_offs_count,
  COALESCE(SUM(fl.total_written_off) FILTER (WHERE fl.write_off_date = CURRENT_DATE), 0) AS write_offs_amount,

  -- Recoveries today (payments on written-off loans)
  0 AS recoveries_amount,

  -- Applications today
  COUNT(*) FILTER (WHERE fl.application_date = CURRENT_DATE) AS applications_submitted,
  COUNT(*) FILTER (WHERE fl.approval_date = CURRENT_DATE AND fl.approval_status = 'auto_approved') AS applications_approved,
  COUNT(*) FILTER (WHERE fl.application_date = CURRENT_DATE AND fl.loan_status = 'rejected') AS applications_rejected,

  -- Averages
  COALESCE(AVG(fl.original_principal) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS avg_loan_size,
  COALESCE(AVG(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS avg_outstanding_balance,
  COALESCE(AVG(fl.days_past_due) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS avg_days_past_due,
  COALESCE(AVG(fl.interest_rate_annual) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS avg_interest_rate,

  -- Weighted average interest rate
  CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
       THEN SUM(fl.interest_rate_annual * fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
            / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
       ELSE 0 END AS weighted_avg_interest_rate,

  -- Tier distribution
  COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed') AND ct.tier_code = 'tier_1') AS tier_1_count,
  COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed') AND ct.tier_code = 'tier_2') AS tier_2_count,
  COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed') AND ct.tier_code = 'tier_3') AS tier_3_count,

  -- Device locks today
  COALESCE((SELECT COUNT(*) FROM device_locks dl WHERE dl.action = 'lock' AND dl.executed_at::DATE = CURRENT_DATE AND dl.execution_status = 'success'), 0) AS devices_locked,
  COALESCE((SELECT COUNT(*) FROM device_locks dl WHERE dl.action = 'unlock' AND dl.executed_at::DATE = CURRENT_DATE AND dl.execution_status = 'success'), 0) AS devices_unlocked,

  NOW() AS etl_loaded_at

FROM dw.fact_loan fl
LEFT JOIN dw.dim_credit_tier ct ON fl.tier_key = ct.tier_key
WHERE fl.loan_status NOT IN ('rejected', 'cancelled');
