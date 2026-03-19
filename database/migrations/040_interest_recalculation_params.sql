-- Migration 040: Add interest recalculation parameters to loan_products
-- Required by Fineract API when isInterestRecalculationEnabled = true
-- These parameters control how interest is recalculated on advance/late payments

ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS interest_recalculation_compounding_method INTEGER NOT NULL DEFAULT 0,
  -- 0=none, 1=interest, 2=fee, 3=interest+fee
  ADD COLUMN IF NOT EXISTS reschedule_strategy_method INTEGER NOT NULL DEFAULT 1,
  -- 1=reduce EMI amount, 2=reduce number of installments, 3=reschedule next repayments
  ADD COLUMN IF NOT EXISTS recalculation_rest_frequency_type INTEGER NOT NULL DEFAULT 1,
  -- 1=same as repayment period, 2=daily, 3=weekly, 4=monthly
  ADD COLUMN IF NOT EXISTS recalculation_rest_frequency_interval INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recalculation_compounding_frequency_type INTEGER,
  -- same enum as rest frequency type; NULL = not applicable
  ADD COLUMN IF NOT EXISTS recalculation_compounding_frequency_interval INTEGER,
  ADD COLUMN IF NOT EXISTS is_arrears_based_on_original_schedule BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_closure_interest_calculation_strategy INTEGER NOT NULL DEFAULT 1,
  -- 1=till pre-close date, 2=till rest frequency date
  ADD COLUMN IF NOT EXISTS allow_compounding_on_eod BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN loan_products.interest_recalculation_compounding_method IS '0=none, 1=interest, 2=fee, 3=interest+fee';
COMMENT ON COLUMN loan_products.reschedule_strategy_method IS '1=reduce EMI, 2=reduce installments, 3=reschedule next';
COMMENT ON COLUMN loan_products.recalculation_rest_frequency_type IS '1=same as repayment, 2=daily, 3=weekly, 4=monthly';
COMMENT ON COLUMN loan_products.recalculation_rest_frequency_interval IS 'Frequency interval number (e.g. 1)';
COMMENT ON COLUMN loan_products.pre_closure_interest_calculation_strategy IS '1=till pre-close date, 2=till rest frequency date';
