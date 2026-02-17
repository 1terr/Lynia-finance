-- =====================================================
-- Pentaho ETL: Fact Payment Loading
-- Called by PDI job 03_load_fact_payments.kjb
-- Loads new payments into dw.fact_payment
-- =====================================================

INSERT INTO dw.fact_payment (
  payment_id,
  loan_key, customer_key, provider_key, payment_date_key,
  amount, currency, amount_usd,
  payment_type, payment_method, payment_status,
  payment_date, confirmed_date,
  fineract_transaction_id,
  etl_loaded_at
)
SELECT
  p.id AS payment_id,
  fl.loan_key,
  dc.customer_key,
  pp.provider_key,
  TO_CHAR(COALESCE(p.payment_date, p.created_at), 'YYYYMMDD')::INTEGER AS payment_date_key,
  p.amount_usd AS amount,
  COALESCE(p.currency, 'USD') AS currency,
  p.amount_usd AS amount_usd,
  p.payment_type,
  p.payment_method,
  p.status AS payment_status,
  COALESCE(p.payment_date, p.created_at)::DATE AS payment_date,
  p.confirmed_at::DATE AS confirmed_date,
  p.fineract_transaction_id,
  NOW() AS etl_loaded_at
FROM payments p
LEFT JOIN dw.fact_loan fl ON fl.loan_id = p.loan_id
LEFT JOIN dw.dim_customer dc ON dc.customer_id = p.customer_id AND dc.is_current = TRUE
LEFT JOIN dw.dim_payment_provider pp ON pp.provider_code = COALESCE(p.payment_provider, p.payment_method)
WHERE NOT EXISTS (
  SELECT 1 FROM dw.fact_payment fp WHERE fp.payment_id = p.id
);
