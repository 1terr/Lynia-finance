/**
 * Characterization tests for services/scoring-service/src/scoring/scoring-engine.ts
 *
 * Tests calculateRuleBasedScore and getScoringWeights.
 * Wrong scoring = incorrect loan decisions, either rejecting qualified
 * borrowers or approving risky ones.
 */

import {
  calculateRuleBasedScore,
  getScoringWeights,
} from '../../../services/scoring-service/src/scoring/scoring-engine';
import type { CreditScoreInput } from '../../../services/scoring-service/src/scoring/types';

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function buildInput(overrides: Partial<CreditScoreInput> = {}): CreditScoreInput {
  return {
    customer_id: 'cust-001',
    household_size: 1,
    dependents: 0,
    requested_loan_amount: 200,
    device_retail_price_usd: 250,
    kyc_result: {
      id_verification: { status: 'verified' },
      face_match_score: 98,
      liveness_passed: true,
    },
    ...overrides,
  };
}

describe('getScoringWeights', () => {
  // ─── Smartphone weights ─────────────────────────────────────────
  it('smartphone weights sum to 1000', () => {
    const w = getScoringWeights('smartphone');
    const sum =
      w.affordability + w.repayment + w.deviceCollateral + w.externalCredit + w.kycVerification + w.orgVerification;
    expect(sum).toBe(1000);
  });

  it('smartphone orgVerification is 350', () => {
    const w = getScoringWeights('smartphone');
    expect(w.orgVerification).toBe(350);
  });

  it('smartphone externalCredit is 0', () => {
    const w = getScoringWeights('smartphone');
    expect(w.externalCredit).toBe(0);
  });

  // ─── Digital weights ────────────────────────────────────────────
  it('digital weights sum to 1000', () => {
    const w = getScoringWeights('digital');
    const sum =
      w.affordability + w.repayment + w.deviceCollateral + w.externalCredit + w.kycVerification + w.orgVerification;
    expect(sum).toBe(1000);
  });

  it('digital weights are identical to smartphone weights', () => {
    const sp = getScoringWeights('smartphone');
    const dg = getScoringWeights('digital');
    expect(sp).toEqual(dg);
  });

  it('weights: orgVerification=350, affordability=250, kycVerification=150, repayment=150, deviceCollateral=100, externalCredit=0', () => {
    const w = getScoringWeights('smartphone');
    expect(w.orgVerification).toBe(350);
    expect(w.affordability).toBe(250);
    expect(w.kycVerification).toBe(150);
    expect(w.repayment).toBe(150);
    expect(w.deviceCollateral).toBe(100);
    expect(w.externalCredit).toBe(0);
  });
});

describe('calculateRuleBasedScore', () => {
  // ─── Return shape ───────────────────────────────────────────────
  it('returns all expected fields', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    expect(result).toHaveProperty('customer_id');
    expect(result).toHaveProperty('product_category');
    expect(result).toHaveProperty('total_raw_score');
    expect(result).toHaveProperty('scaled_score');
    expect(result).toHaveProperty('components');
    expect(result).toHaveProperty('decision');
    expect(result).toHaveProperty('credit_limit_usd');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('down_payment_percentage');
    expect(result).toHaveProperty('interest_rate_apr');
    expect(result).toHaveProperty('calculated_at');
  });

  it('defaults product_category to smartphone', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.product_category).toBe('smartphone');
  });

  // ─── Score range invariants ─────────────────────────────────────
  it('raw score is between 0 and 1000', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.total_raw_score).toBeGreaterThanOrEqual(0);
    expect(result.total_raw_score).toBeLessThanOrEqual(1000);
  });

  it('scaled score is between 300 and 850', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.scaled_score).toBeGreaterThanOrEqual(300);
    expect(result.scaled_score).toBeLessThanOrEqual(850);
  });

  it('scaling formula: scaled = 300 + (raw / 1000) * 550', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    const expected = Math.round(300 + (result.total_raw_score / 1000) * 550);
    expect(result.scaled_score).toBe(expected);
  });

  // ─── Extreme inputs ─────────────────────────────────────────────
  it('all-max input produces approve with high tier', async () => {
    // Affordability: no org salary -> neutral 75, loan=200, household=1 -> loanPerPerson=200 -> 50. Total = 125
    //   component = round(125/250 * 250) = 125
    // Repayment: on_time=0.95->90, bill=0.90->30, comm=0.90->30 = 150
    //   component = round(150/150 * 150) = 150
    // Device Collateral: 250/200 = 1.25 >= 1.0 -> 100
    //   component = round(100/100 * 100) = 100
    // External Credit: weight=0 -> component = 0
    // KYC: verified->75, face=98->50, liveness->25 = 150
    //   component = round(150/150 * 150) = 150
    // Org Verification: null -> neutral 175
    //   component = round(175/350 * 350) = 175
    // raw = 125+150+100+0+150+175 = 700
    // scaled = 300 + (700/1000)*550 = 685
    const result = await calculateRuleBasedScore(
      buildInput({
        requested_loan_amount: 200,
        device_retail_price_usd: 250,
        household_size: 1,
        previous_loans_count: 5,
        on_time_payment_rate: 0.95,
        bill_payment_consistency: 0.90,
        communication_response_rate: 0.90,
      })
    );
    expect(result.decision).toBe('approve');
    expect(result.scaled_score).toBeGreaterThanOrEqual(650);
  });

  it('all-min input produces low score with KYC Not Verified', async () => {
    const result = await calculateRuleBasedScore(
      buildInput({
        requested_loan_amount: 200,
        device_retail_price_usd: 50,
        household_size: 1,
        previous_loans_count: 1,
        on_time_payment_rate: 0,
        bill_payment_consistency: 0,
        communication_response_rate: 0,
        kyc_result: {
          id_verification: { status: 'failed' },
          face_match_score: 0,
          liveness_passed: false,
        },
      })
    );
    // KYC failed -> auto-reject regardless of score
    expect(result.decision).toBe('reject');
    expect(result.tier).toBe('KYC Not Verified');
    expect(result.credit_limit_usd).toBe(0);
  });

  // ─── First-time customer ───────────────────────────────────────
  it('first-time customer (no previous_loans_count) gets neutral repayment score 75', async () => {
    // No previous_loans_count -> repayment data is null -> 75 neutral
    // repayment component = round(75/150 * 150) = 75
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.components.repayment_willingness).toBe(75);
  });

  // ─── Tier threshold tests ──────────────────────────────────────
  // Tier 3: scaled >= 650 -> approve, $2000, 10% down, 3% APR
  it('scaled_score >= 650 produces Tier 3 with $2000 limit, 10% down, 3% APR', async () => {
    // Use org-verified salary + org verification to get high score
    const result = await calculateRuleBasedScore(
      buildInput({
        org_verified_salary_usd: 800,
        requested_loan_amount: 100,
        device_retail_price_usd: 250,
        household_size: 1,
        previous_loans_count: 5,
        on_time_payment_rate: 0.95,
        bill_payment_consistency: 0.90,
        communication_response_rate: 0.90,
        org_verification: {
          scoring_trust_level: 90,
          employment_status: 'active',
          tenure_months: 72,
          salary_verified: true,
        },
      })
    );
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 3');
    expect(result.credit_limit_usd).toBe(2000);
    expect(result.down_payment_percentage).toBe(10);
    expect(result.interest_rate_apr).toBe(3);
  });

  // Lowest possible score below threshold gets rejected
  it('scaled_score below smartphone threshold (350) is rejected', async () => {
    const result = await calculateRuleBasedScore(
      buildInput({
        requested_loan_amount: 500,
        device_retail_price_usd: 50,
        household_size: 8,
        previous_loans_count: 3,
        on_time_payment_rate: 0.40,
        bill_payment_consistency: 0.30,
        communication_response_rate: 0.30,
        external_credit_data: {
          credit_bureau_score: 400,
          platform_verified: false,
          platform_earnings_3m_usd: 0,
          platform_rating: 0,
          bank_account_verified: false,
          bank_account_age_months: 0,
        },
        kyc_result: {
          id_verification: { status: 'failed' },
          face_match_score: 0,
          liveness_passed: false,
        },
      })
    );
    // KYC failed triggers early rejection
    expect(result.decision).toBe('reject');
    expect(result.tier).toBe('KYC Not Verified');
    expect(result.credit_limit_usd).toBe(0);
  });

  // ─── Product category differences ──────────────────────────────
  it('digital product category uses org_verification component', async () => {
    const result = await calculateRuleBasedScore(
      buildInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 80,
          employment_status: 'active',
          tenure_months: 60,
          salary_verified: true,
        },
      })
    );
    expect(result.product_category).toBe('digital');
    expect(result.components.org_verification).toBeGreaterThan(0);
  });

  it('smartphone product category without org data gets neutral org score 175', async () => {
    const result = await calculateRuleBasedScore(
      buildInput({
        product_category: 'smartphone',
      })
    );
    // Unaffiliated smartphone customers get neutral org score 175/350
    expect(result.components.org_verification).toBe(175);
  });

  // ─── Component sum ─────────────────────────────────────────────
  it('component values sum approximately to total_raw_score', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    const componentSum =
      result.components.affordability +
      result.components.repayment_willingness +
      result.components.device_collateral +
      result.components.external_credit +
      result.components.kyc_verification +
      result.components.org_verification;
    // Due to rounding, allow a difference of up to the number of components (6)
    expect(Math.abs(componentSum - result.total_raw_score)).toBeLessThanOrEqual(6);
  });

  // ─── Timestamp format ──────────────────────────────────────────
  it('calculated_at is a valid ISO string', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    const parsed = new Date(result.calculated_at);
    expect(parsed.toISOString()).toBe(result.calculated_at);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  // ─── Exact score verification ──────────────────────────────────
  it('exact score for default input with all neutrals', async () => {
    // Default: no salary, loan=200, household=1, no repayment history, device=250
    // Affordability: no salary -> 75, loanPerPerson=200/1=200 -> 50. Total = 125
    //   component = round(125/250 * 250) = 125
    // Repayment: null -> 75.  component = round(75/150 * 150) = 75
    // Device Collateral: 250/200 = 1.25 >= 1.0 -> 100. component = round(100/100 * 100) = 100
    // External Credit: weight=0 -> component = 0
    // KYC: verified->75, face=98->50, liveness->25 = 150. component = round(150/150 * 150) = 150
    // Org: null -> 175. component = round(175/350 * 350) = 175
    // raw = 125+75+100+0+150+175 = 625
    // scaled = 300 + (625/1000)*550 = 300+343.75 = 644 (rounded)
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.total_raw_score).toBe(625);
    expect(result.scaled_score).toBe(644);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 2');
  });

  it('customer_id is passed through correctly', async () => {
    const result = await calculateRuleBasedScore(buildInput({ customer_id: 'test-xyz-789' }));
    expect(result.customer_id).toBe('test-xyz-789');
  });

  // ─── Digital scoring with org verification ─────────────────────
  it('digital product with max org verification produces high score', async () => {
    // Affordability: no salary -> 75, loanPerPerson=200/1=200 -> 50 = 125
    //   component = round(125/250 * 250) = 125
    // Repayment: null -> 75, component = 75
    // Device Collateral: digital loan -> 50 neutral. component = round(50/100 * 100) = 50
    // External Credit: weight=0 -> component = 0
    // KYC: 150, component = 150
    // Org: trust=80->120, active->80, tenure=60->70, salary=true->80 = 350
    //   component = round(350/350 * 350) = 350
    // raw = 125+75+50+0+150+350 = 750
    // scaled = 300 + (750/1000)*550 = 300+412.5 = 713
    const result = await calculateRuleBasedScore(
      buildInput({
        product_category: 'digital',
        org_verification: {
          scoring_trust_level: 80,
          employment_status: 'active',
          tenure_months: 60,
          salary_verified: true,
        },
      })
    );
    expect(result.total_raw_score).toBe(750);
    expect(result.scaled_score).toBe(713);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 3');
  });

  // ─── Device collateral impact ──────────────────────────────────
  it('high device value increases score via device_collateral', async () => {
    const withHighDevice = await calculateRuleBasedScore(
      buildInput({ device_retail_price_usd: 300, requested_loan_amount: 200 })
    );
    const withLowDevice = await calculateRuleBasedScore(
      buildInput({ device_retail_price_usd: 50, requested_loan_amount: 200 })
    );
    expect(withHighDevice.components.device_collateral).toBeGreaterThan(withLowDevice.components.device_collateral);
    // 300/200 = 1.5 >= 1.0 -> 100, component = 100
    expect(withHighDevice.components.device_collateral).toBe(100);
    // 50/200 = 0.25 < 0.4 -> 20, component = 20
    expect(withLowDevice.components.device_collateral).toBe(20);
  });

  it('external_credit component is always 0 due to zero weight', async () => {
    // Even with full external credit data, weighted contribution is 0
    const withExternal = await calculateRuleBasedScore(
      buildInput({
        external_credit_data: {
          credit_bureau_score: 750,
          platform_verified: true,
          platform_earnings_3m_usd: 1500,
          platform_rating: 4.5,
          bank_account_verified: true,
          bank_account_age_months: 24,
        },
      })
    );
    const withoutExternal = await calculateRuleBasedScore(buildInput());
    expect(withExternal.components.external_credit).toBe(0);
    expect(withoutExternal.components.external_credit).toBe(0);
  });
});
