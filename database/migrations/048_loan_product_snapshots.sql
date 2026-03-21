-- Migration 048: Product version snapshots for regulatory compliance
-- Freezes product terms at loan approval time so we can prove what terms were offered

CREATE TABLE loan_product_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES loan_products(id),
  snapshot_data JSONB NOT NULL,
  fineract_product_id INTEGER,
  interest_rate_at_approval DECIMAL(5,2),
  term_months_at_approval INTEGER,
  fees_at_approval JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_product_snapshots_loan ON loan_product_snapshots(loan_id);
CREATE INDEX idx_product_snapshots_product ON loan_product_snapshots(product_id);
CREATE INDEX idx_product_snapshots_created ON loan_product_snapshots(created_at);

COMMENT ON TABLE loan_product_snapshots IS 'Immutable snapshot of loan product terms at time of loan approval. Required for regulatory proof of terms offered.';
COMMENT ON COLUMN loan_product_snapshots.snapshot_data IS 'Full JSONB copy of the loan_products row at approval time';
COMMENT ON COLUMN loan_product_snapshots.fees_at_approval IS 'Insurance and penalty fee configuration at approval time';
