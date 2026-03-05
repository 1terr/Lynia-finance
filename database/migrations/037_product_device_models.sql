-- Migration 037: Product-Device Model Linking
-- Creates a join table to explicitly associate loan products with compatible device models.
-- This ensures smartphone financing products only offer devices within their price range,
-- and gives admins control over which phone models appear for each loan tier.

BEGIN;

-- ─── Join Table ───

CREATE TABLE IF NOT EXISTS product_device_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES loan_products(id) ON DELETE CASCADE,
    device_model_id UUID NOT NULL REFERENCES device_models(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, device_model_id)
);

CREATE INDEX idx_product_device_models_product ON product_device_models(product_id);
CREATE INDEX idx_product_device_models_device_model ON product_device_models(device_model_id);

COMMENT ON TABLE product_device_models IS 'Links loan products to compatible device models. Smartphone products should have at least one linked model.';

COMMIT;
