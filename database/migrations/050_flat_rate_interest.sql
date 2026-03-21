-- Migration 050: Switch to flat rate interest and add effective APR for regulatory disclosure
-- Decision: Flat rate interest for all products (simpler for semi-literate users)
-- Fineract interest_type: 0=declining balance, 1=flat

-- Update existing products to flat rate
UPDATE loan_products SET interest_type = 1 WHERE interest_type = 0 OR interest_type IS NULL;

-- Add effective APR column for regulatory disclosure
ALTER TABLE loan_products ADD COLUMN effective_apr DECIMAL(5,2);

COMMENT ON COLUMN loan_products.effective_apr IS 'Effective APR for flat rate disclosure. Formula: (totalInterest/principal) * (12/termMonths) * 100. Required by RBZ for consumer transparency.';
