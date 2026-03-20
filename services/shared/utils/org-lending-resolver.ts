/**
 * Organization Lending Limit Resolver
 *
 * Resolves per-organization lending limits by combining product defaults
 * with organization-specific overrides from product_organizations.
 *
 * Override logic: NULL = use product default.
 * Max loan = min(org_max, salary * multiplier, product_max)
 */

export interface ProductDefaults {
  min_amount_usd: number;
  max_amount_usd: number;
  interest_rate_monthly: number;
  min_term_months: number;
  max_term_months: number;
  deposit_percentage: number;
  max_active_loans: number;
}

export interface OrgOverrides {
  max_loan_amount_usd: number | null;
  min_loan_amount_usd: number | null;
  interest_rate_monthly_override: number | null;
  max_term_months_override: number | null;
  min_term_months_override: number | null;
  deposit_percentage_override: number | null;
  max_active_loans_override: number | null;
  salary_multiplier: number | null;
}

export interface MemberFinancials {
  salary_verified: boolean;
  monthly_salary_usd: number;
}

export interface ResolvedLendingLimits {
  max_loan_amount: number;
  min_loan_amount: number;
  interest_rate_monthly: number;
  interest_rate_apr: number;
  min_term_months: number;
  max_term_months: number;
  deposit_percentage: number;
  max_active_loans: number;
  salary_cap_applied: boolean;
}

/**
 * Resolve lending limits for a specific org+product+member combination.
 *
 * Priority: org override > salary cap > product default
 */
export function resolveOrgLendingLimits(
  product: ProductDefaults,
  orgOverrides: OrgOverrides | null,
  member: MemberFinancials
): ResolvedLendingLimits {
  const salaryMultiplier = orgOverrides?.salary_multiplier ?? 3.0;

  // Max loan from org config (or product default)
  const maxFromOrg = orgOverrides?.max_loan_amount_usd ?? product.max_amount_usd;

  // Max loan from salary (verified salary * multiplier, or 50% of product max)
  const maxFromSalary = member.salary_verified && member.monthly_salary_usd > 0
    ? member.monthly_salary_usd * salaryMultiplier
    : product.max_amount_usd * 0.5;

  // Take the minimum of all three caps
  const maxLoan = Math.min(maxFromOrg, maxFromSalary, product.max_amount_usd);
  const salaryCapped = maxFromSalary < maxFromOrg && maxFromSalary < product.max_amount_usd;

  const interestRateMonthly = orgOverrides?.interest_rate_monthly_override ?? product.interest_rate_monthly;

  return {
    max_loan_amount: Math.round(maxLoan * 100) / 100,
    min_loan_amount: orgOverrides?.min_loan_amount_usd ?? product.min_amount_usd,
    interest_rate_monthly: interestRateMonthly,
    interest_rate_apr: Math.round(interestRateMonthly * 12 * 100) / 100,
    min_term_months: orgOverrides?.min_term_months_override ?? product.min_term_months,
    max_term_months: orgOverrides?.max_term_months_override ?? product.max_term_months,
    deposit_percentage: orgOverrides?.deposit_percentage_override ?? product.deposit_percentage,
    max_active_loans: orgOverrides?.max_active_loans_override ?? product.max_active_loans,
    salary_cap_applied: salaryCapped,
  };
}
