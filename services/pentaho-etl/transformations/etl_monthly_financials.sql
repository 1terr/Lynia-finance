-- =====================================================
-- Pentaho ETL: Monthly Financial Report
-- Called by PDI job 07_calculate_monthly_financials.kjb
-- Calculates revenue, collections, origination,
-- and customer metrics for the most recent complete month
-- =====================================================

-- Calculate for the previous complete month
WITH params AS (
  SELECT
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::DATE AS month_start,
    (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::DATE AS month_end,
    TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM') AS report_month,
    EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER AS report_year,
    EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER AS report_month_number
),
-- Interest income = total payments of type 'installment' in the month
-- (A portion of each installment is interest; simplified as total - principal portion)
payment_summary AS (
  SELECT
    COALESCE(SUM(fp.amount) FILTER (WHERE fp.payment_type IN ('installment', 'repayment') AND fp.payment_status = 'confirmed'), 0) AS total_collections,
    COALESCE(SUM(fp.amount) FILTER (WHERE fp.payment_type = 'late_fee' AND fp.payment_status = 'confirmed'), 0) AS fee_income,
    COUNT(*) FILTER (WHERE fp.payment_status = 'confirmed') AS payment_count
  FROM dw.fact_payment fp, params p
  WHERE fp.payment_date >= p.month_start AND fp.payment_date <= p.month_end
),
-- Write-offs in the month
write_off_summary AS (
  SELECT
    COALESCE(SUM(fl.total_written_off), 0) AS write_off_amount,
    COUNT(*) AS write_off_count
  FROM dw.fact_loan fl, params p
  WHERE fl.write_off_date >= p.month_start AND fl.write_off_date <= p.month_end
),
-- Origination in the month
origination_summary AS (
  SELECT
    COUNT(*) AS loans_originated_count,
    COALESCE(SUM(fl.original_principal), 0) AS loans_originated_amount,
    COALESCE(AVG(fl.original_principal), 0) AS avg_loan_size
  FROM dw.fact_loan fl, params p
  WHERE fl.disbursement_date >= p.month_start AND fl.disbursement_date <= p.month_end
),
-- End-of-month portfolio state (latest snapshot in the month)
eom_portfolio AS (
  SELECT *
  FROM dw.fact_daily_portfolio dp, params p
  WHERE dp.snapshot_date <= p.month_end
  ORDER BY dp.snapshot_date DESC
  LIMIT 1
),
-- Customer metrics
customer_metrics AS (
  SELECT
    COUNT(DISTINCT dc.customer_id) FILTER (WHERE dc.customer_since >= p.month_start AND dc.customer_since <= p.month_end) AS new_customers,
    COUNT(DISTINCT dc.customer_id) FILTER (WHERE EXISTS (
      SELECT 1 FROM dw.fact_loan fl2
      WHERE fl2.customer_key = dc.customer_key AND fl2.loan_status IN ('active', 'disbursed')
    )) AS active_customers
  FROM dw.dim_customer dc, params p
  WHERE dc.is_current = TRUE
),
-- Repeat borrowers (customers with 2+ loans)
repeat_borrowers AS (
  SELECT COUNT(*) AS repeat_count
  FROM (
    SELECT dc.customer_id, COUNT(fl.loan_key) AS loan_count
    FROM dw.fact_loan fl
    JOIN dw.dim_customer dc ON fl.customer_key = dc.customer_key AND dc.is_current = TRUE
    WHERE fl.loan_status NOT IN ('rejected', 'cancelled')
    GROUP BY dc.customer_id
    HAVING COUNT(fl.loan_key) >= 2
  ) sub
),
-- Average outstanding for NIM calculation
avg_outstanding AS (
  SELECT
    COALESCE(AVG(dp.total_outstanding), 0) AS avg_portfolio
  FROM dw.fact_daily_portfolio dp, params p
  WHERE dp.snapshot_date >= p.month_start AND dp.snapshot_date <= p.month_end
)
INSERT INTO dw.rpt_monthly_financials (
  report_month, report_year, report_month_number,
  interest_income, fee_income, total_revenue,
  write_off_amount, provision_amount, net_credit_losses,
  avg_outstanding_portfolio, net_yield_pct,
  loans_originated_count, loans_originated_amount, avg_loan_size,
  total_collections, scheduled_collections, collection_rate,
  end_of_month_outstanding, end_of_month_active_loans,
  end_of_month_par_30, end_of_month_npl_ratio,
  new_customers, active_customers,
  repeat_borrowers, repeat_borrower_rate,
  etl_loaded_at
)
SELECT
  p.report_month,
  p.report_year,
  p.report_month_number,

  -- Revenue (simplified: total collections is proxy for interest + principal;
  -- precise split requires Fineract repayment schedule breakdown)
  GREATEST(ps.total_collections * 0.20, 0) AS interest_income,  -- ~20% of collections is interest (6-month term, 10-15% APR)
  ps.fee_income,
  GREATEST(ps.total_collections * 0.20, 0) + ps.fee_income AS total_revenue,

  -- Losses
  ws.write_off_amount,
  0 AS provision_amount,
  ws.write_off_amount AS net_credit_losses,

  -- Yield
  ao.avg_portfolio AS avg_outstanding_portfolio,
  CASE WHEN ao.avg_portfolio > 0
       THEN ((ps.total_collections * 0.20 + ps.fee_income) - ws.write_off_amount) / ao.avg_portfolio
       ELSE 0 END AS net_yield_pct,

  -- Origination
  os.loans_originated_count,
  os.loans_originated_amount,
  os.avg_loan_size,

  -- Collections
  ps.total_collections,
  ps.total_collections AS scheduled_collections, -- Placeholder; precise requires schedule
  CASE WHEN ps.total_collections > 0 THEN 1.0 ELSE 0 END AS collection_rate, -- Placeholder

  -- End of month portfolio
  COALESCE(ep.total_outstanding, 0) AS end_of_month_outstanding,
  COALESCE(ep.total_active_loans, 0) AS end_of_month_active_loans,
  COALESCE(ep.par_30_pct, 0) AS end_of_month_par_30,
  COALESCE(ep.npl_ratio, 0) AS end_of_month_npl_ratio,

  -- Customers
  COALESCE(cm.new_customers, 0) AS new_customers,
  COALESCE(cm.active_customers, 0) AS active_customers,
  COALESCE(rb.repeat_count, 0) AS repeat_borrowers,
  CASE WHEN COALESCE(cm.active_customers, 0) > 0
       THEN COALESCE(rb.repeat_count, 0)::DECIMAL / cm.active_customers
       ELSE 0 END AS repeat_borrower_rate,

  NOW() AS etl_loaded_at
FROM params p
CROSS JOIN payment_summary ps
CROSS JOIN write_off_summary ws
CROSS JOIN origination_summary os
CROSS JOIN avg_outstanding ao
LEFT JOIN eom_portfolio ep ON TRUE
LEFT JOIN customer_metrics cm ON TRUE
LEFT JOIN repeat_borrowers rb ON TRUE
ON CONFLICT (report_month) DO UPDATE SET
  interest_income = EXCLUDED.interest_income,
  fee_income = EXCLUDED.fee_income,
  total_revenue = EXCLUDED.total_revenue,
  write_off_amount = EXCLUDED.write_off_amount,
  net_credit_losses = EXCLUDED.net_credit_losses,
  avg_outstanding_portfolio = EXCLUDED.avg_outstanding_portfolio,
  net_yield_pct = EXCLUDED.net_yield_pct,
  loans_originated_count = EXCLUDED.loans_originated_count,
  loans_originated_amount = EXCLUDED.loans_originated_amount,
  total_collections = EXCLUDED.total_collections,
  collection_rate = EXCLUDED.collection_rate,
  end_of_month_outstanding = EXCLUDED.end_of_month_outstanding,
  end_of_month_active_loans = EXCLUDED.end_of_month_active_loans,
  end_of_month_par_30 = EXCLUDED.end_of_month_par_30,
  end_of_month_npl_ratio = EXCLUDED.end_of_month_npl_ratio,
  new_customers = EXCLUDED.new_customers,
  active_customers = EXCLUDED.active_customers,
  repeat_borrowers = EXCLUDED.repeat_borrowers,
  repeat_borrower_rate = EXCLUDED.repeat_borrower_rate,
  etl_loaded_at = NOW();
