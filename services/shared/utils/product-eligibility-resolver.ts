/**
 * Product Eligibility Resolver
 *
 * Given a customer's credit score and context, finds eligible loan products
 * from the database. Replaces the hardcoded 3-tier system with per-product
 * eligibility rules (min/max credit score, principal range, org linkage).
 *
 * For digital products: filters by organization membership via product_organizations.
 * For smartphone products: filters by device price within principal range.
 * Org overrides are applied via resolveOrgLendingLimits().
 */

import { query } from '../clients/database';
import { resolveOrgLendingLimits, ProductDefaults, OrgOverrides, MemberFinancials } from './org-lending-resolver';

export interface ProductEligibilityInput {
  scaled_score: number;
  product_category: 'smartphone' | 'digital';
  organization_id?: string;
  device_price?: number;
  requested_amount?: number;
  /** Member financials for org override resolution */
  member_financials?: MemberFinancials;
}

export interface EligibleProduct {
  product_id: string;
  product_code: string;
  product_name: string;
  product_category: 'smartphone' | 'digital';
  max_loan_amount: number;
  min_loan_amount: number;
  interest_rate_monthly: number;
  interest_rate_apr: number;
  min_term_months: number;
  max_term_months: number;
  deposit_percentage: number;
  max_active_loans: number;
  fineract_product_id: number | null;
  salary_cap_applied: boolean;
}

interface ProductRow {
  id: string;
  product_code: string;
  product_name: string;
  product_category: string;
  min_amount_usd: number;
  max_amount_usd: number;
  interest_rate_monthly: number;
  interest_rate_annual: number;
  min_term_months: number;
  max_term_months: number;
  deposit_percentage: number;
  max_active_loans: number;
  fineract_product_id: number | null;
  // Org override columns (NULL when no org link)
  org_max_loan_amount_usd: number | null;
  org_min_loan_amount_usd: number | null;
  org_interest_rate_monthly_override: number | null;
  org_max_term_months_override: number | null;
  org_min_term_months_override: number | null;
  org_deposit_percentage_override: number | null;
  org_max_active_loans_override: number | null;
  org_salary_multiplier: number | null;
}

/**
 * Find all active loan products the customer is eligible for.
 */
export async function findEligibleProducts(
  input: ProductEligibilityInput
): Promise<EligibleProduct[]> {
  const { scaled_score, product_category, organization_id, device_price, requested_amount } = input;

  let sql: string;
  let params: unknown[];

  if (organization_id) {
    // Join with product_organizations for org-specific overrides
    sql = `
      SELECT
        lp.id, lp.product_code, lp.product_name, lp.product_category,
        lp.min_amount_usd, lp.max_amount_usd,
        COALESCE(lp.interest_rate_monthly, lp.interest_rate_annual / 12) AS interest_rate_monthly,
        lp.interest_rate_annual,
        lp.min_term_months, lp.max_term_months,
        lp.deposit_percentage, lp.max_active_loans,
        lp.fineract_product_id,
        po.max_loan_amount_usd AS org_max_loan_amount_usd,
        po.min_loan_amount_usd AS org_min_loan_amount_usd,
        po.interest_rate_monthly_override AS org_interest_rate_monthly_override,
        po.max_term_months_override AS org_max_term_months_override,
        po.min_term_months_override AS org_min_term_months_override,
        po.deposit_percentage_override AS org_deposit_percentage_override,
        po.max_active_loans_override AS org_max_active_loans_override,
        po.salary_multiplier AS org_salary_multiplier
      FROM loan_products lp
      LEFT JOIN product_organizations po
        ON po.product_id = lp.id AND po.organization_id = $3 AND po.is_active = true
      WHERE lp.product_category = $1
        AND lp.status = 'active'
        AND lp.deleted_at IS NULL
        AND lp.min_credit_score <= $2
        AND lp.max_credit_score >= $2
        AND (
          lp.requires_organization_verification = false
          OR po.id IS NOT NULL
          OR NOT EXISTS (SELECT 1 FROM product_organizations po2 WHERE po2.product_id = lp.id)
        )
      ORDER BY lp.max_amount_usd DESC, lp.display_order ASC
    `;
    params = [product_category, scaled_score, organization_id];
  } else {
    // No org — only products that don't require org verification
    sql = `
      SELECT
        lp.id, lp.product_code, lp.product_name, lp.product_category,
        lp.min_amount_usd, lp.max_amount_usd,
        COALESCE(lp.interest_rate_monthly, lp.interest_rate_annual / 12) AS interest_rate_monthly,
        lp.interest_rate_annual,
        lp.min_term_months, lp.max_term_months,
        lp.deposit_percentage, lp.max_active_loans,
        lp.fineract_product_id,
        NULL AS org_max_loan_amount_usd,
        NULL AS org_min_loan_amount_usd,
        NULL AS org_interest_rate_monthly_override,
        NULL AS org_max_term_months_override,
        NULL AS org_min_term_months_override,
        NULL AS org_deposit_percentage_override,
        NULL AS org_max_active_loans_override,
        NULL AS org_salary_multiplier
      FROM loan_products lp
      WHERE lp.product_category = $1
        AND lp.status = 'active'
        AND lp.deleted_at IS NULL
        AND lp.min_credit_score <= $2
        AND lp.max_credit_score >= $2
        AND lp.requires_organization_verification = false
      ORDER BY lp.max_amount_usd DESC, lp.display_order ASC
    `;
    params = [product_category, scaled_score];
  }

  const { data: rows, error } = await query<ProductRow>(sql, params);
  if (error || !rows.length) return [];

  const memberFinancials: MemberFinancials = input.member_financials ?? {
    salary_verified: false,
    monthly_salary_usd: 0,
  };

  const products: EligibleProduct[] = rows.map((row) => {
    const productDefaults: ProductDefaults = {
      min_amount_usd: Number(row.min_amount_usd),
      max_amount_usd: Number(row.max_amount_usd),
      interest_rate_monthly: Number(row.interest_rate_monthly),
      min_term_months: row.min_term_months,
      max_term_months: row.max_term_months,
      deposit_percentage: Number(row.deposit_percentage),
      max_active_loans: row.max_active_loans,
    };

    const orgOverrides: OrgOverrides | null = row.org_max_loan_amount_usd != null || row.org_salary_multiplier != null
      ? {
          max_loan_amount_usd: row.org_max_loan_amount_usd != null ? Number(row.org_max_loan_amount_usd) : null,
          min_loan_amount_usd: row.org_min_loan_amount_usd != null ? Number(row.org_min_loan_amount_usd) : null,
          interest_rate_monthly_override: row.org_interest_rate_monthly_override != null ? Number(row.org_interest_rate_monthly_override) : null,
          max_term_months_override: row.org_max_term_months_override,
          min_term_months_override: row.org_min_term_months_override,
          deposit_percentage_override: row.org_deposit_percentage_override != null ? Number(row.org_deposit_percentage_override) : null,
          max_active_loans_override: row.org_max_active_loans_override,
          salary_multiplier: row.org_salary_multiplier != null ? Number(row.org_salary_multiplier) : null,
        }
      : null;

    const resolved = resolveOrgLendingLimits(productDefaults, orgOverrides, memberFinancials);

    return {
      product_id: row.id,
      product_code: row.product_code,
      product_name: row.product_name,
      product_category: row.product_category as 'smartphone' | 'digital',
      max_loan_amount: resolved.max_loan_amount,
      min_loan_amount: resolved.min_loan_amount,
      interest_rate_monthly: resolved.interest_rate_monthly,
      interest_rate_apr: resolved.interest_rate_apr,
      min_term_months: resolved.min_term_months,
      max_term_months: resolved.max_term_months,
      deposit_percentage: resolved.deposit_percentage,
      max_active_loans: resolved.max_active_loans,
      fineract_product_id: row.fineract_product_id,
      salary_cap_applied: resolved.salary_cap_applied,
    };
  });

  // Filter by amount constraints
  return products.filter((p) => {
    if (device_price != null) {
      return device_price >= p.min_loan_amount && device_price <= p.max_loan_amount;
    }
    if (requested_amount != null) {
      return requested_amount >= p.min_loan_amount && requested_amount <= p.max_loan_amount;
    }
    return true;
  });
}

/**
 * Find the single best matching product for the customer.
 * Returns the product with the highest max_loan_amount (most generous).
 */
export async function findBestProduct(
  input: ProductEligibilityInput
): Promise<EligibleProduct | null> {
  const products = await findEligibleProducts(input);
  return products[0] || null;
}
