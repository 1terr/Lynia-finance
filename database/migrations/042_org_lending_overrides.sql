-- Migration 042: Organization-Level Lending Overrides
--
-- Extends product_organizations junction table with per-org lending configuration.
-- Different organizations have different risk profiles and should have different
-- lending limits, interest rates, terms, and salary multipliers.
--
-- Override logic: NULL = use product default. This keeps backward compatibility.
-- Resolution order: min(org_max, salary * multiplier, product_max)

BEGIN;

-- ─── Per-Org Lending Overrides ───

ALTER TABLE product_organizations
  ADD COLUMN IF NOT EXISTS max_loan_amount_usd DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS min_loan_amount_usd DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS interest_rate_monthly_override DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS max_term_months_override INTEGER,
  ADD COLUMN IF NOT EXISTS min_term_months_override INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_percentage_override DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS max_active_loans_override INTEGER,
  ADD COLUMN IF NOT EXISTS salary_multiplier DECIMAL(5,2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN product_organizations.max_loan_amount_usd IS
  'Organization-specific max loan amount. NULL = use product default';
COMMENT ON COLUMN product_organizations.salary_multiplier IS
  'Max loan = min(org_max, monthly_salary * multiplier, product_max). Default 3x salary';
COMMENT ON COLUMN product_organizations.interest_rate_monthly_override IS
  'Monthly interest rate override for this org. NULL = use product default';
COMMENT ON COLUMN product_organizations.is_active IS
  'Whether this org-product link is active. Inactive orgs cannot apply';

-- ─── Loan Provision Rates (per product category) ───

CREATE TABLE IF NOT EXISTS loan_provision_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category VARCHAR(30) NOT NULL,
  days_past_due_min INTEGER NOT NULL,
  days_past_due_max INTEGER NOT NULL,
  provision_rate_pct DECIMAL(5,2) NOT NULL,
  classification VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provision_rates_category
  ON loan_provision_rates(product_category);

COMMENT ON TABLE loan_provision_rates IS
  'Provisioning rates by product category. Digital loans have higher rates (unsecured)';

-- Smartphone rates (secured by device collateral)
INSERT INTO loan_provision_rates (product_category, days_past_due_min, days_past_due_max, provision_rate_pct, classification) VALUES
  ('smartphone', 0, 0, 1.00, 'Current'),
  ('smartphone', 1, 30, 5.00, 'Watch'),
  ('smartphone', 31, 60, 20.00, 'Substandard'),
  ('smartphone', 61, 90, 50.00, 'Doubtful'),
  ('smartphone', 91, 180, 80.00, 'Loss'),
  ('smartphone', 181, 99999, 100.00, 'Write-off');

-- Digital rates (unsecured — higher provision rates)
INSERT INTO loan_provision_rates (product_category, days_past_due_min, days_past_due_max, provision_rate_pct, classification) VALUES
  ('digital', 0, 0, 1.00, 'Current'),
  ('digital', 1, 30, 10.00, 'Watch'),
  ('digital', 31, 60, 30.00, 'Substandard'),
  ('digital', 61, 90, 60.00, 'Doubtful'),
  ('digital', 91, 180, 90.00, 'Loss'),
  ('digital', 181, 99999, 100.00, 'Write-off');

-- ─── Seed: Link sample orgs to digital product with overrides ───

-- Only insert if the digital product and orgs exist
DO $$
DECLARE
  v_product_id UUID;
  v_gov_csc_id UUID;
  v_gov_zrp_id UUID;
  v_econet_id UUID;
BEGIN
  SELECT id INTO v_product_id FROM loan_products WHERE product_code = 'DIGI_LOAN_001' LIMIT 1;
  SELECT id INTO v_gov_csc_id FROM organizations WHERE org_code = 'GOV_CSC' LIMIT 1;
  SELECT id INTO v_gov_zrp_id FROM organizations WHERE org_code = 'GOV_ZRP' LIMIT 1;
  SELECT id INTO v_econet_id FROM organizations WHERE org_code = 'ORG_ECONET' LIMIT 1;

  IF v_product_id IS NOT NULL THEN
    -- Civil Service Commission: high trust, high limits
    IF v_gov_csc_id IS NOT NULL THEN
      INSERT INTO product_organizations (product_id, organization_id, max_loan_amount_usd, interest_rate_monthly_override, max_term_months_override, salary_multiplier, notes)
      VALUES (v_product_id, v_gov_csc_id, 2000.00, 1.50, 12, 4.0, 'Government — high trust, deduction at source')
      ON CONFLICT (product_id, organization_id) DO UPDATE SET
        max_loan_amount_usd = EXCLUDED.max_loan_amount_usd,
        interest_rate_monthly_override = EXCLUDED.interest_rate_monthly_override,
        max_term_months_override = EXCLUDED.max_term_months_override,
        salary_multiplier = EXCLUDED.salary_multiplier,
        notes = EXCLUDED.notes;
    END IF;

    -- Zimbabwe Republic Police: high trust
    IF v_gov_zrp_id IS NOT NULL THEN
      INSERT INTO product_organizations (product_id, organization_id, max_loan_amount_usd, interest_rate_monthly_override, max_term_months_override, salary_multiplier, notes)
      VALUES (v_product_id, v_gov_zrp_id, 1500.00, 1.50, 12, 3.5, 'Government — high trust, deduction at source')
      ON CONFLICT (product_id, organization_id) DO UPDATE SET
        max_loan_amount_usd = EXCLUDED.max_loan_amount_usd,
        interest_rate_monthly_override = EXCLUDED.interest_rate_monthly_override,
        max_term_months_override = EXCLUDED.max_term_months_override,
        salary_multiplier = EXCLUDED.salary_multiplier,
        notes = EXCLUDED.notes;
    END IF;

    -- Econet Wireless: corporate, standard rates
    IF v_econet_id IS NOT NULL THEN
      INSERT INTO product_organizations (product_id, organization_id, max_loan_amount_usd, interest_rate_monthly_override, max_term_months_override, salary_multiplier, notes)
      VALUES (v_product_id, v_econet_id, 1000.00, 2.00, 6, 3.0, 'Corporate — standard terms')
      ON CONFLICT (product_id, organization_id) DO UPDATE SET
        max_loan_amount_usd = EXCLUDED.max_loan_amount_usd,
        interest_rate_monthly_override = EXCLUDED.interest_rate_monthly_override,
        max_term_months_override = EXCLUDED.max_term_months_override,
        salary_multiplier = EXCLUDED.salary_multiplier,
        notes = EXCLUDED.notes;
    END IF;
  END IF;
END $$;

COMMIT;