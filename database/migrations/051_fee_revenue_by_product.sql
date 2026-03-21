-- Migration 051: Fee revenue reporting by product (DW)
-- Adds 'insurance_fee' to payment_type and creates a DW report table
-- for fee income breakdowns used in investor and admin reporting.

-- 1. Add 'insurance_fee' to payment_type options.
--    payment_type is a plain VARCHAR(50) with no CHECK constraint,
--    so no ALTER TYPE is needed — the new value works automatically.
--    This comment documents the intent for future reference.

-- 2. DW reporting table: fee revenue broken down by product and month
CREATE TABLE IF NOT EXISTS dw.rpt_fee_revenue_by_product (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month DATE NOT NULL,
  product_id UUID NOT NULL,
  product_name VARCHAR(255),
  product_category VARCHAR(50),
  insurance_fee_income DECIMAL(12,2) DEFAULT 0,
  penalty_fee_income DECIMAL(12,2) DEFAULT 0,
  total_fee_income DECIMAL(12,2) DEFAULT 0,
  loan_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_month, product_id)
);

CREATE INDEX idx_rpt_fee_revenue_month ON dw.rpt_fee_revenue_by_product(report_month);
CREATE INDEX idx_rpt_fee_revenue_product ON dw.rpt_fee_revenue_by_product(product_id);
CREATE INDEX idx_rpt_fee_revenue_category ON dw.rpt_fee_revenue_by_product(product_category);

COMMENT ON TABLE dw.rpt_fee_revenue_by_product IS 'Monthly fee revenue breakdown by loan product for investor and admin reporting';
COMMENT ON COLUMN dw.rpt_fee_revenue_by_product.insurance_fee_income IS 'Total insurance fee income for the product in the given month';
COMMENT ON COLUMN dw.rpt_fee_revenue_by_product.penalty_fee_income IS 'Total late-fee / penalty income for the product in the given month';
COMMENT ON COLUMN dw.rpt_fee_revenue_by_product.total_fee_income IS 'insurance_fee_income + penalty_fee_income';
