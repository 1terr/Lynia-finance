-- =====================================================
-- Pentaho ETL: Fact Loan Loading
-- Called by PDI job 02_load_fact_loans.kjb
-- Loads/updates the fact_loan table with current loan state
-- =====================================================

-- Upsert fact_loan records from source loans table
INSERT INTO dw.fact_loan (
  loan_id, loan_number,
  customer_key, product_key, device_key, geo_key, tier_key,
  origination_date_key, maturity_date_key, disbursement_date_key,
  original_principal, deposit_amount, disbursed_amount,
  total_interest, total_amount_due, interest_rate_annual,
  loan_term_months, currency,
  outstanding_balance, total_paid,
  total_penalties, total_penalties_paid, total_written_off,
  days_past_due, missed_payments_count,
  device_value_usd, ltv_ratio,
  credit_score_at_origination,
  affordability_score, repayment_willingness_score,
  mobile_money_score, external_credit_score, kyc_verification_score,
  loan_status, approval_status, deposit_paid,
  is_restructured, reschedule_count,
  application_date, approval_date, disbursement_date,
  maturity_date, close_date, write_off_date,
  last_payment_date, next_payment_date, next_payment_amount,
  fineract_loan_id,
  etl_loaded_at, etl_updated_at
)
SELECT
  l.id AS loan_id,
  l.loan_number,
  dc.customer_key,
  dp.product_key,
  dd.device_key,
  dg.geo_key,
  ct.tier_key,
  TO_CHAR(l.created_at, 'YYYYMMDD')::INTEGER AS origination_date_key,
  CASE WHEN l.next_payment_date IS NOT NULL
       THEN TO_CHAR(l.next_payment_date + (l.loan_term_months || ' months')::INTERVAL, 'YYYYMMDD')::INTEGER
       ELSE NULL END AS maturity_date_key,
  CASE WHEN l.disbursed_at IS NOT NULL
       THEN TO_CHAR(l.disbursed_at, 'YYYYMMDD')::INTEGER
       ELSE NULL END AS disbursement_date_key,
  l.loan_amount_usd AS original_principal,
  l.deposit_amount_usd AS deposit_amount,
  l.disbursed_amount_usd AS disbursed_amount,
  COALESCE(l.total_amount_due_usd - l.loan_amount_usd, 0) AS total_interest,
  l.total_amount_due_usd AS total_amount_due,
  l.interest_rate AS interest_rate_annual,
  l.loan_term_months,
  COALESCE(l.currency, 'USD') AS currency,
  l.outstanding_balance_usd AS outstanding_balance,
  COALESCE(l.total_paid_usd, 0) AS total_paid,
  COALESCE(l.total_penalties_usd, 0) AS total_penalties,
  COALESCE(l.total_penalties_paid_usd, 0) AS total_penalties_paid,
  COALESCE(l.written_off_amount_usd, 0) AS total_written_off,
  COALESCE(l.days_past_due, 0) AS days_past_due,
  COALESCE(l.missed_payments_count, 0) AS missed_payments_count,
  dev.retail_price_usd AS device_value_usd,
  CASE WHEN dev.retail_price_usd > 0
       THEN l.loan_amount_usd / dev.retail_price_usd
       ELSE NULL END AS ltv_ratio,
  cs.scaled_score AS credit_score_at_origination,
  cs.affordability_score,
  cs.repayment_willingness_score,
  cs.mobile_money_score,
  cs.external_credit_score,
  cs.kyc_verification_score,
  l.status AS loan_status,
  l.approval_status,
  l.deposit_paid,
  COALESCE(l.reschedule_count, 0) > 0 AS is_restructured,
  COALESCE(l.reschedule_count, 0) AS reschedule_count,
  l.created_at::DATE AS application_date,
  l.approved_at::DATE AS approval_date,
  l.disbursed_at::DATE AS disbursement_date,
  -- Estimate maturity from disbursement + term
  CASE WHEN l.disbursed_at IS NOT NULL
       THEN (l.disbursed_at + (l.loan_term_months || ' months')::INTERVAL)::DATE
       ELSE NULL END AS maturity_date,
  l.closed_at::DATE AS close_date,
  l.write_off_date::DATE AS write_off_date,
  l.last_payment_date AS last_payment_date,
  l.next_payment_date AS next_payment_date,
  l.next_payment_amount_usd AS next_payment_amount,
  l.fineract_loan_id,
  NOW() AS etl_loaded_at,
  NOW() AS etl_updated_at
FROM loans l
-- Join dimensions
LEFT JOIN dw.dim_customer dc ON dc.customer_id = l.customer_id AND dc.is_current = TRUE
LEFT JOIN dw.dim_loan_product dp ON dp.product_id = l.product_id AND dp.is_current = TRUE
LEFT JOIN devices dev ON dev.loan_id = l.id
LEFT JOIN dw.dim_device dd ON dd.device_id = dev.id AND dd.is_current = TRUE
LEFT JOIN customers cust ON cust.id = l.customer_id
LEFT JOIN dw.dim_geography dg ON dg.province = cust.province AND dg.city = cust.city
LEFT JOIN dw.dim_credit_tier ct ON ct.tier_code = LOWER(REPLACE(COALESCE(l.approval_status, ''), ' ', '_'))
-- Get latest credit score for this loan
LEFT JOIN LATERAL (
  SELECT scaled_score, affordability_score, repayment_willingness_score,
         mobile_money_score, external_credit_score, kyc_verification_score
  FROM credit_scores
  WHERE loan_id = l.id OR (customer_id = l.customer_id AND loan_id IS NULL)
  ORDER BY calculated_at DESC
  LIMIT 1
) cs ON TRUE
ON CONFLICT (loan_id) DO UPDATE SET
  outstanding_balance = EXCLUDED.outstanding_balance,
  total_paid = EXCLUDED.total_paid,
  total_penalties = EXCLUDED.total_penalties,
  total_penalties_paid = EXCLUDED.total_penalties_paid,
  total_written_off = EXCLUDED.total_written_off,
  days_past_due = EXCLUDED.days_past_due,
  missed_payments_count = EXCLUDED.missed_payments_count,
  loan_status = EXCLUDED.loan_status,
  close_date = EXCLUDED.close_date,
  write_off_date = EXCLUDED.write_off_date,
  last_payment_date = EXCLUDED.last_payment_date,
  next_payment_date = EXCLUDED.next_payment_date,
  next_payment_amount = EXCLUDED.next_payment_amount,
  is_restructured = EXCLUDED.is_restructured,
  reschedule_count = EXCLUDED.reschedule_count,
  device_key = EXCLUDED.device_key,
  etl_updated_at = NOW();
