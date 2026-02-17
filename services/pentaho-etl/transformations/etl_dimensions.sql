-- =====================================================
-- Pentaho ETL: Dimension Loading
-- Called by PDI job 01_load_dimensions.kjb
-- Loads/updates all dimension tables from source system
-- =====================================================

-- =====================================================
-- 1. DIM_CUSTOMER (SCD Type 2)
-- Close existing records that have changed, insert new versions
-- =====================================================

-- Step 1a: Mark changed records as expired
UPDATE dw.dim_customer dc SET
  effective_to = CURRENT_DATE - 1,
  is_current = FALSE
FROM customers c
WHERE dc.customer_id = c.id
  AND dc.is_current = TRUE
  AND (
    dc.kyc_status IS DISTINCT FROM c.kyc_status
    OR dc.credit_tier IS DISTINCT FROM c.credit_tier
    OR dc.credit_score IS DISTINCT FROM c.credit_score
    OR dc.province IS DISTINCT FROM c.province
    OR dc.employment_status IS DISTINCT FROM c.employment_status
    OR dc.monthly_income_usd IS DISTINCT FROM c.monthly_income_usd
  );

-- Step 1b: Insert new current records for changed customers
INSERT INTO dw.dim_customer (
  customer_id, first_name, last_name, phone_masked,
  province, city, location_type, employment_status,
  income_band, monthly_income_usd, household_size,
  kyc_status, credit_tier, credit_score,
  onboarding_channel, first_loan_date, customer_since,
  fineract_client_id,
  effective_from, effective_to, is_current
)
SELECT
  c.id,
  c.first_name,
  c.last_name,
  LEFT(c.phone_number, 4) || '****' || RIGHT(c.phone_number, 3) AS phone_masked,
  c.province,
  c.city,
  CASE
    WHEN c.city IN ('Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Gweru', 'Kwekwe', 'Masvingo') THEN 'urban'
    WHEN c.city IS NOT NULL THEN 'peri_urban'
    ELSE 'rural'
  END AS location_type,
  c.employment_status,
  CASE
    WHEN c.monthly_income_usd >= 500 THEN '500+'
    WHEN c.monthly_income_usd >= 300 THEN '300-500'
    WHEN c.monthly_income_usd >= 100 THEN '100-300'
    ELSE '<100'
  END AS income_band,
  c.monthly_income_usd,
  c.household_size,
  c.kyc_status,
  c.credit_tier,
  c.credit_score,
  'whatsapp' AS onboarding_channel,
  (SELECT MIN(l.created_at)::DATE FROM loans l WHERE l.customer_id = c.id) AS first_loan_date,
  c.created_at::DATE AS customer_since,
  c.fineract_client_id,
  CURRENT_DATE,
  '9999-12-31'::DATE,
  TRUE
FROM customers c
LEFT JOIN dw.dim_customer dc ON dc.customer_id = c.id AND dc.is_current = TRUE
WHERE dc.customer_key IS NULL  -- New customer OR just expired above
  AND c.deleted_at IS NULL;

-- =====================================================
-- 2. DIM_LOAN_PRODUCT (SCD Type 1 - overwrite)
-- =====================================================
INSERT INTO dw.dim_loan_product (
  product_id, product_code, product_name, product_type,
  tier_name, min_amount_usd, max_amount_usd,
  interest_rate_annual, deposit_percentage, loan_term_months,
  fineract_product_id,
  effective_from, is_current
)
SELECT
  lp.id,
  lp.product_code,
  lp.product_name,
  lp.product_type,
  NULL, -- tier_name derived from scoring config
  lp.min_amount_usd,
  lp.max_amount_usd,
  lp.interest_rate_annual,
  lp.deposit_percentage,
  lp.loan_term_months,
  lp.fineract_product_id,
  CURRENT_DATE,
  TRUE
FROM loan_products lp
WHERE NOT EXISTS (
  SELECT 1 FROM dw.dim_loan_product dp
  WHERE dp.product_id = lp.id AND dp.is_current = TRUE
)
AND lp.deleted_at IS NULL;

-- Update existing products if changed
UPDATE dw.dim_loan_product dp SET
  product_name = lp.product_name,
  min_amount_usd = lp.min_amount_usd,
  max_amount_usd = lp.max_amount_usd,
  interest_rate_annual = lp.interest_rate_annual,
  deposit_percentage = lp.deposit_percentage,
  loan_term_months = lp.loan_term_months,
  fineract_product_id = lp.fineract_product_id
FROM loan_products lp
WHERE dp.product_id = lp.id AND dp.is_current = TRUE;

-- =====================================================
-- 3. DIM_DEVICE (SCD Type 1 - overwrite)
-- =====================================================
INSERT INTO dw.dim_device (
  device_id, imei, manufacturer, model, device_type,
  storage_gb, condition, purchase_price_usd, retail_price_usd,
  lock_status, inventory_status,
  effective_from, is_current
)
SELECT
  d.id,
  d.imei,
  d.manufacturer,
  d.model,
  d.device_type,
  d.storage_gb,
  d.condition,
  d.purchase_price_usd,
  d.retail_price_usd,
  d.lock_status,
  d.status,
  CURRENT_DATE,
  TRUE
FROM devices d
WHERE NOT EXISTS (
  SELECT 1 FROM dw.dim_device dd
  WHERE dd.device_id = d.id
)
AND d.deleted_at IS NULL;

-- Update existing devices
UPDATE dw.dim_device dd SET
  lock_status = d.lock_status,
  inventory_status = d.status,
  purchase_price_usd = d.purchase_price_usd,
  retail_price_usd = d.retail_price_usd
FROM devices d
WHERE dd.device_id = d.id AND dd.is_current = TRUE;

-- =====================================================
-- 4. DIM_GEOGRAPHY (Insert new combinations)
-- =====================================================
INSERT INTO dw.dim_geography (province, city, location_type, country)
SELECT DISTINCT
  c.province,
  c.city,
  CASE
    WHEN c.city IN ('Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Gweru', 'Kwekwe', 'Masvingo') THEN 'urban'
    WHEN c.city IS NOT NULL THEN 'peri_urban'
    ELSE 'rural'
  END,
  'Zimbabwe'
FROM customers c
WHERE c.province IS NOT NULL
  AND c.deleted_at IS NULL
ON CONFLICT (province, city, location_type) DO NOTHING;
