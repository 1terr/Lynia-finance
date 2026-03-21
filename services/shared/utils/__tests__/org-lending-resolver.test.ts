/**
 * Unit Tests: Organization Lending Limit Resolver
 *
 * Tests the pure function that resolves per-organization lending limits
 * by combining product defaults with org-specific overrides and salary caps.
 */

import {
  resolveOrgLendingLimits,
  type ProductDefaults,
  type OrgOverrides,
  type MemberFinancials,
} from '../org-lending-resolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProduct: ProductDefaults = {
  min_amount_usd: 20,
  max_amount_usd: 1000,
  interest_rate_monthly: 2,
  min_term_months: 1,
  max_term_months: 12,
  deposit_percentage: 10,
  max_active_loans: 2,
};

const defaultMember: MemberFinancials = {
  salary_verified: true,
  monthly_salary_usd: 400,
};

function makeOrgOverrides(overrides: Partial<OrgOverrides> = {}): OrgOverrides {
  return {
    max_loan_amount_usd: null,
    min_loan_amount_usd: null,
    interest_rate_monthly_override: null,
    max_term_months_override: null,
    min_term_months_override: null,
    deposit_percentage_override: null,
    max_active_loans_override: null,
    salary_multiplier: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveOrgLendingLimits', () => {
  // -----------------------------------------------------------------------
  // No org overrides (all NULL) — product defaults used
  // -----------------------------------------------------------------------

  it('returns product defaults when no org overrides (all NULL)', () => {
    const result = resolveOrgLendingLimits(defaultProduct, makeOrgOverrides(), defaultMember);

    expect(result.interest_rate_monthly).toBe(2);
    expect(result.min_term_months).toBe(1);
    expect(result.max_term_months).toBe(12);
    expect(result.deposit_percentage).toBe(10);
    expect(result.max_active_loans).toBe(2);
    expect(result.min_loan_amount).toBe(20);
  });

  it('returns product defaults when orgOverrides is null', () => {
    const result = resolveOrgLendingLimits(defaultProduct, null, defaultMember);

    expect(result.interest_rate_monthly).toBe(2);
    expect(result.min_term_months).toBe(1);
    expect(result.max_term_months).toBe(12);
    expect(result.deposit_percentage).toBe(10);
    expect(result.max_active_loans).toBe(2);
    expect(result.min_loan_amount).toBe(20);
  });

  // -----------------------------------------------------------------------
  // Org override for max_loan_amount takes precedence
  // -----------------------------------------------------------------------

  it('org override for max_loan_amount_usd takes precedence over product default', () => {
    const orgOverrides = makeOrgOverrides({ max_loan_amount_usd: 750 });
    // salary cap: 400 * 3.0 = 1200 (not limiting)
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    // min(750, 1200, 1000) = 750
    expect(result.max_loan_amount).toBe(750);
  });

  // -----------------------------------------------------------------------
  // Org override for interest_rate_monthly takes precedence
  // -----------------------------------------------------------------------

  it('org override for interest_rate_monthly takes precedence', () => {
    const orgOverrides = makeOrgOverrides({ interest_rate_monthly_override: 3.5 });
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    expect(result.interest_rate_monthly).toBe(3.5);
    expect(result.interest_rate_apr).toBe(42); // 3.5 * 12
  });

  // -----------------------------------------------------------------------
  // Salary multiplier: verified salary * multiplier caps loan
  // -----------------------------------------------------------------------

  it('salary multiplier caps max loan when salary-based max is lowest', () => {
    const orgOverrides = makeOrgOverrides({ salary_multiplier: 2.0 });
    // salary cap: 400 * 2.0 = 800
    // min(1000, 800, 1000) = 800
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 400 };
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, member);

    expect(result.max_loan_amount).toBe(800);
    expect(result.salary_cap_applied).toBe(true);
  });

  it('uses default salary multiplier of 3.0 when not specified', () => {
    const orgOverrides = makeOrgOverrides({ salary_multiplier: null });
    // salary cap: 200 * 3.0 = 600
    // min(1000, 600, 1000) = 600
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 200 };
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, member);

    expect(result.max_loan_amount).toBe(600);
    expect(result.salary_cap_applied).toBe(true);
  });

  it('salary_multiplier default is 3.0 when orgOverrides is null', () => {
    // salary cap: 250 * 3.0 = 750
    // min(1000, 750, 1000) = 750
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 250 };
    const result = resolveOrgLendingLimits(defaultProduct, null, member);

    expect(result.max_loan_amount).toBe(750);
    expect(result.salary_cap_applied).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Unverified salary: 50% of product max
  // -----------------------------------------------------------------------

  it('unverified salary uses 50% of product max', () => {
    const member: MemberFinancials = { salary_verified: false, monthly_salary_usd: 1000 };
    const result = resolveOrgLendingLimits(defaultProduct, null, member);

    // 50% of product max (1000) = 500
    // min(1000, 500, 1000) = 500
    expect(result.max_loan_amount).toBe(500);
  });

  it('unverified salary with zero monthly_salary_usd uses 50% of product max', () => {
    const member: MemberFinancials = { salary_verified: false, monthly_salary_usd: 0 };
    const result = resolveOrgLendingLimits(defaultProduct, null, member);

    expect(result.max_loan_amount).toBe(500);
  });

  // -----------------------------------------------------------------------
  // Min of (org max, salary max, product max) used as final limit
  // -----------------------------------------------------------------------

  it('takes minimum of org max, salary max, and product max', () => {
    // org max: 600
    // salary cap: 300 * 3.0 = 900
    // product max: 1000
    // min(600, 900, 1000) = 600
    const orgOverrides = makeOrgOverrides({ max_loan_amount_usd: 600 });
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 300 };
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, member);

    expect(result.max_loan_amount).toBe(600);
    expect(result.salary_cap_applied).toBe(false); // salary was not the limiting factor
  });

  it('product max is the cap when org and salary are both higher', () => {
    const orgOverrides = makeOrgOverrides({ max_loan_amount_usd: 2000 });
    // salary cap: 500 * 3.0 = 1500
    // product max: 1000
    // min(2000, 1500, 1000) = 1000
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 500 };
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, member);

    expect(result.max_loan_amount).toBe(1000);
    expect(result.salary_cap_applied).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Partial overrides: mix of org and product values
  // -----------------------------------------------------------------------

  it('partial overrides: some org values, rest from product defaults', () => {
    const orgOverrides = makeOrgOverrides({
      interest_rate_monthly_override: 1.5,
      max_term_months_override: 18,
      // All others null — use product defaults
    });

    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    expect(result.interest_rate_monthly).toBe(1.5);
    expect(result.interest_rate_apr).toBe(18); // 1.5 * 12
    expect(result.max_term_months).toBe(18);
    // Remaining from product defaults
    expect(result.min_term_months).toBe(1);
    expect(result.deposit_percentage).toBe(10);
    expect(result.max_active_loans).toBe(2);
    expect(result.min_loan_amount).toBe(20);
  });

  it('org min_loan_amount_usd overrides product min', () => {
    const orgOverrides = makeOrgOverrides({ min_loan_amount_usd: 50 });
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    expect(result.min_loan_amount).toBe(50);
  });

  it('org min_term_months_override overrides product min_term', () => {
    const orgOverrides = makeOrgOverrides({ min_term_months_override: 3 });
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    expect(result.min_term_months).toBe(3);
  });

  it('org deposit_percentage_override overrides product deposit', () => {
    const orgOverrides = makeOrgOverrides({ deposit_percentage_override: 0 });
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    expect(result.deposit_percentage).toBe(0);
  });

  it('org max_active_loans_override overrides product value', () => {
    const orgOverrides = makeOrgOverrides({ max_active_loans_override: 5 });
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    expect(result.max_active_loans).toBe(5);
  });

  // -----------------------------------------------------------------------
  // APR calculation
  // -----------------------------------------------------------------------

  it('calculates APR as monthly rate * 12, rounded to 2 decimals', () => {
    const orgOverrides = makeOrgOverrides({ interest_rate_monthly_override: 2.333 });
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, defaultMember);

    // 2.333 * 12 = 27.996, rounded to 28.0
    expect(result.interest_rate_apr).toBe(28);
  });

  it('calculates APR from product default rate when no override', () => {
    const result = resolveOrgLendingLimits(defaultProduct, null, defaultMember);

    // 2 * 12 = 24
    expect(result.interest_rate_apr).toBe(24);
  });

  // -----------------------------------------------------------------------
  // Edge case: salary = 0
  // -----------------------------------------------------------------------

  it('salary = 0 with salary_verified true falls back to 50% of product max (salary > 0 check)', () => {
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 0 };
    const result = resolveOrgLendingLimits(defaultProduct, null, member);

    // Code checks salary_verified && monthly_salary_usd > 0
    // When salary is 0, it falls through to the unverified path: 50% of product max
    // min(1000, 500, 1000) = 500
    expect(result.max_loan_amount).toBe(500);
  });

  it('salary = 0 with salary_verified false uses 50% of product max', () => {
    const member: MemberFinancials = { salary_verified: false, monthly_salary_usd: 0 };
    const result = resolveOrgLendingLimits(defaultProduct, null, member);

    // 50% of 1000 = 500
    expect(result.max_loan_amount).toBe(500);
  });

  // -----------------------------------------------------------------------
  // salary_cap_applied flag
  // -----------------------------------------------------------------------

  it('salary_cap_applied is true when salary is the binding constraint', () => {
    // salary cap: 100 * 3.0 = 300
    // org max: null → product max: 1000
    // min(1000, 300, 1000) = 300 → salary was limiting
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 100 };
    const result = resolveOrgLendingLimits(defaultProduct, null, member);

    expect(result.max_loan_amount).toBe(300);
    expect(result.salary_cap_applied).toBe(true);
  });

  it('salary_cap_applied is false when org or product is the binding constraint', () => {
    // salary cap: 400 * 3.0 = 1200
    // product max: 1000
    // min(1000, 1200, 1000) = 1000 → product was limiting
    const result = resolveOrgLendingLimits(defaultProduct, null, defaultMember);

    expect(result.max_loan_amount).toBe(1000);
    expect(result.salary_cap_applied).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Rounding
  // -----------------------------------------------------------------------

  it('rounds max_loan_amount to 2 decimal places', () => {
    // salary cap: 333 * 3.0 = 999
    // min(1000, 999, 1000) = 999 — already clean
    // Use a multiplier that produces fractional cents
    const orgOverrides = makeOrgOverrides({ salary_multiplier: 1.333 });
    const member: MemberFinancials = { salary_verified: true, monthly_salary_usd: 100 };
    const result = resolveOrgLendingLimits(defaultProduct, orgOverrides, member);

    // 100 * 1.333 = 133.3, min(1000, 133.3, 1000) = 133.3
    expect(result.max_loan_amount).toBe(133.3);
    // Verify it's properly rounded (no floating point artifacts)
    expect(result.max_loan_amount.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
  });
});
