-- Migration 049: Add insurance premium and late payment penalty configuration
-- Confirmed fee types: insurance premium + late payment penalty (no processing/SMS fees)

-- Insurance fee configuration
ALTER TABLE loan_products ADD COLUMN insurance_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN insurance_fee_flat_usd DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN insurance_fee_type VARCHAR(20) NOT NULL DEFAULT 'none'
  CHECK (insurance_fee_type IN ('percentage', 'flat', 'none'));
ALTER TABLE loan_products ADD COLUMN insurance_fee_frequency VARCHAR(20) NOT NULL DEFAULT 'upfront'
  CHECK (insurance_fee_frequency IN ('upfront', 'monthly'));

-- Late payment penalty configuration
ALTER TABLE loan_products ADD COLUMN late_penalty_percentage DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN late_penalty_flat_usd DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE loan_products ADD COLUMN late_penalty_type VARCHAR(20) NOT NULL DEFAULT 'none'
  CHECK (late_penalty_type IN ('percentage', 'flat', 'none'));
ALTER TABLE loan_products ADD COLUMN late_penalty_grace_days INTEGER NOT NULL DEFAULT 3;

-- Fineract charge IDs (populated after syncing charges to Fineract)
ALTER TABLE loan_products ADD COLUMN fineract_insurance_charge_id INTEGER;
ALTER TABLE loan_products ADD COLUMN fineract_penalty_charge_id INTEGER;

COMMENT ON COLUMN loan_products.insurance_fee_percentage IS 'Insurance premium as percentage of loan amount (e.g., 2.5 for 2.5%)';
COMMENT ON COLUMN loan_products.insurance_fee_frequency IS 'upfront = charged at disbursement, monthly = added to each installment';
COMMENT ON COLUMN loan_products.late_penalty_grace_days IS 'Number of days after due date before penalty applies';
COMMENT ON COLUMN loan_products.fineract_insurance_charge_id IS 'Fineract charge ID for insurance - populated on product sync';
COMMENT ON COLUMN loan_products.fineract_penalty_charge_id IS 'Fineract charge ID for penalty - populated on product sync';
