-- Migration 052: Product configuration version history
-- Tracks all changes to loan product configurations for audit and rollback

CREATE TABLE IF NOT EXISTS product_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES loan_products(id),
  version_number INTEGER NOT NULL,
  changed_by VARCHAR(255),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'deactivate', 'reactivate')),
  previous_values JSONB,
  new_values JSONB NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_versions_product ON product_versions(product_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_product_versions_changed_at ON product_versions(changed_at DESC);

COMMENT ON TABLE product_versions IS 'Audit trail for loan product configuration changes. Each row captures before/after state.';
COMMENT ON COLUMN product_versions.version_number IS 'Auto-incremented per product. Version 1 = initial creation.';
COMMENT ON COLUMN product_versions.previous_values IS 'JSONB snapshot of changed fields before the update (null for create)';
COMMENT ON COLUMN product_versions.new_values IS 'JSONB snapshot of the new/current field values';
COMMENT ON COLUMN product_versions.change_reason IS 'Optional human-readable reason for the change';
