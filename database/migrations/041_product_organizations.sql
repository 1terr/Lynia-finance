-- Migration 041: Product-Organization Linking
--
-- Creates a many-to-many junction table between loan_products and organizations.
-- When a product has requires_organization_verification = true and has linked
-- organizations, only members of those specific organizations can apply.
-- If no organizations are linked, all org members remain eligible (backward compatible).
--
-- Mirrors the product_device_models pattern from migration 037.

BEGIN;

-- ─── Join Table ───

CREATE TABLE IF NOT EXISTS product_organizations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID NOT NULL REFERENCES loan_products(id) ON DELETE CASCADE,
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, organization_id)
);

CREATE INDEX idx_product_organizations_product ON product_organizations(product_id);
CREATE INDEX idx_product_organizations_org ON product_organizations(organization_id);

COMMENT ON TABLE product_organizations IS 'Links loan products to eligible organizations. When a product requires org verification and has linked orgs, only members of those orgs can apply.';

COMMIT;
