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
    monthly_income_usd: 500,
    existing_debt_obligations_usd: 0,
    household_size: 1,
    dependents: 0,
    requested_loan_amount: 200,
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
      w.affordability + w.repayment + w.mobileMoney + w.externalCredit + w.kycVerification + w.orgVerification;
    expect(sum).toBe(1000);
  });

  it('smartphone orgVerification is 0', () => {
    const w = getScoringWeights('smartphone');
    expect(w.orgVerification).toBe(0);
  });

  // ─── Digital weights ────────────────────────────────────────────
  it('digital weights sum to 1000', () => {
    const w = getScoringWeights('digital');
    const sum =
      w.affordability + w.repayment + w.mobileMoney + w.externalCredit + w.kycVerification + w.orgVerification;
    expect(sum).toBe(1000);
  });

  it('digital mobileMoney = 100, externalCredit = 50, orgVerification = 200', () => {
    const w = getScoringWeights('digital');
    expect(w.mobileMoney).toBe(100);
    expect(w.externalCredit).toBe(50);
    expect(w.orgVerification).toBe(200);
  });

  it('digital affordability = 300, repayment = 250, kycVerification = 100', () => {
    const w = getScoringWeights('digital');
    expect(w.affordability).toBe(300);
    expect(w.repayment).toBe(250);
    expect(w.kycVerification).toBe(100);
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
    // Affordability: income=500, debt=0, loan=200, household=1
    //   monthlyInst = (200*1.12)/6 = 37.33, dti = 37.33/500 = 0.075 -> 150
    //   incomeScore = 100 (500 >= 500)
    //   householdScore = 50 (500/1 = 500 >= 100)
    //   total = 300
    // Repayment: on_time=0.95 -> 150, bill=0.90 -> 50, comm=0.90 -> 50 = 250
    // Mobile Money: null -> 100 (neutral)
    // External Credit: null -> 75 (neutral)
    // KYC: verified -> 50, face=98 -> 35, liveness -> 15 = 100
    // Components (smartphone weights):
    //   affordability = round(300/300 * 300) = 300
    //   repayment = round(250/250 * 250) = 250
    //   mobile_money = round(100/200 * 200) = 100
    //   external_credit = round(75/150 * 150) = 75
    //   kyc = round(100/100 * 100) = 100
    //   org = 0
    // raw = 300 + 250 + 100 + 75 + 100 = 825
    // scaled = 300 + (825/1000) * 550 = 300 + 453.75 = 754 (rounded)
    const result = await calculateRuleBasedScore(
      buildInput({
        monthly_income_usd: 500,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 200,
        household_size: 1,
        previous_loans_count: 5,
        on_time_payment_rate: 0.95,
        bill_payment_consistency: 0.90,
        communication_response_rate: 0.90,
      })
    );
    expect(result.decision).toBe('approve');
    // Raw score should be 825, scaled ~754
    expect(result.scaled_score).toBeGreaterThanOrEqual(750);
  });

  it('all-min input produces low score with Tier 1', async () => {
    // Affordability: income=0, debt=0, loan=200, household=1
    //   M = 200 × 0.08561 = 17.12, dti = 17.12/1 = 17.12 -> 0 (> 0.60)
    //   incomeScore = 0, householdScore = 10. total = 10
    // Repayment: on_time=0->0, bill=0->10, comm=0->10 = 20
    // Mobile Money: null -> 100, External: null -> 75, KYC: 0
    // raw = 10+20+100+75+0 = 205, scaled = 413 -> Tier 1
    const result = await calculateRuleBasedScore(
      buildInput({
        monthly_income_usd: 0,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 200,
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
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 1');
    expect(result.credit_limit_usd).toBe(200);
  });

  // ─── First-time customer ───────────────────────────────────────
  it('first-time customer (no previous_loans_count) gets neutral repayment score 125', async () => {
    // No previous_loans_count -> repayment data is null -> 125 neutral
    // repayment component = round(125/250 * 250) = 125
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.components.repayment_willingness).toBe(125);
  });

  // ─── Tier threshold tests ──────────────────────────────────────
  // Tier 3: scaled >= 650 -> approve, $2000, 10% down, 3% APR
  it('scaled_score >= 650 produces Tier 3 with $2000 limit, 10% down, 3% APR', async () => {
    // affordability=300, repayment=250, mobile=100, ext=75, kyc=100
    // raw=825, scaled=754 -> Tier 3
    const result = await calculateRuleBasedScore(
      buildInput({
        monthly_income_usd: 500,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 200,
        household_size: 1,
        previous_loans_count: 5,
        on_time_payment_rate: 0.95,
        bill_payment_consistency: 0.90,
        communication_response_rate: 0.90,
      })
    );
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 3');
    expect(result.credit_limit_usd).toBe(2000);
    expect(result.down_payment_percentage).toBe(10);
    expect(result.interest_rate_apr).toBe(3);
  });

  // Tier 2: scaled 500-649 -> approve, $500, 20% down, 4% APR
  it('scaled_score in 500-649 produces Tier 2 with $500 limit, 20% down, 4% APR', async () => {
    // Lower income and bad repayment to land in Tier 2 range
    // affordability: income=200, loan=200, household=3
    //   M=17.12, dti=0.086->150, income=50, household=200/3=67->20 = 220
    // repayment: on_time=0.75->80, bill=0.60->20, comm=0.60->20 = 120
    // mobile=100, ext=75, kyc=100
    // raw = 220+120+100+75+100 = 615, scaled = 638 -> Tier 2
    const result = await calculateRuleBasedScore(
      buildInput({
        monthly_income_usd: 200,
        existing_debt_obligations_usd: 0,
        requested_loan_amount: 200,
        household_size: 3,
        previous_loans_count: 5,
        on_time_payment_rate: 0.75,
        bill_payment_consistency: 0.60,
        communication_response_rate: 0.60,
      })
    );
    expect(result.scaled_score).toBeGreaterThanOrEqual(500);
    expect(result.scaled_score).toBeLessThan(650);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 2');
    expect(result.credit_limit_usd).toBe(500);
    expect(result.down_payment_percentage).toBe(20);
    expect(result.interest_rate_apr).toBe(4);
  });

  // Tier 1: scaled 350-499 -> approve, $200, 30% down, 5% APR
  it('scaled_score in 350-499 produces Tier 1 with $200 limit, 30% down, 5% APR', async () => {
    // Very bad affordability + bad repayment to land in Tier 1
    // affordability: income=100, debt=50, loan=300, household=5
    //   M=25.68, total=75.68, dti=0.757->0, income=25, household=20->10 = 35
    // repayment: on_time=0.60->40, bill=0.50->10, comm=0.50->10 = 60
    // mobile=100, ext=75, kyc: review->25, face=80->15 = 40
    // raw = 35+60+100+75+40 = 310, scaled = 471 -> Tier 1
    const result = await calculateRuleBasedScore(
      buildInput({
        monthly_income_usd: 100,
        existing_debt_obligations_usd: 50,
        requested_loan_amount: 300,
        household_size: 5,
        previous_loans_count: 3,
        on_time_payment_rate: 0.60,
        bill_payment_consistency: 0.50,
        communication_response_rate: 0.50,
        kyc_result: {
          id_verification: { status: 'review' },
          face_match_score: 80,
          liveness_passed: false,
        },
      })
    );
    expect(result.scaled_score).toBeGreaterThanOrEqual(350);
    expect(result.scaled_score).toBeLessThan(500);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 1');
    expect(result.credit_limit_usd).toBe(200);
    expect(result.down_payment_percentage).toBe(30);
    expect(result.interest_rate_apr).toBe(5);
  });

  // Manual Review: scaled 300-349 -> review, $0
  it('scaled_score in 300-349 produces review with Manual Review and $0 limit', async () => {
    // Need extremely low scores across all components
    // affordability: income=50, debt=100, loan=500, household=8
    //   M=42.80, total=142.80, dti=2.856->0, income=0, household=50/8=6.25->10 = 10
    // repayment: on_time=0.40->0, bill=0.30->10, comm=0.30->10 = 20
    // mobile: worst possible data = 30
    // external: worst possible data = 10
    // kyc: failed->0, face=0->0, liveness=false->0 = 0
    // raw = 10+20+30+10+0 = 70, scaled = 339 -> review
    const result = await calculateRuleBasedScore(
      buildInput({
        monthly_income_usd: 50,
        existing_debt_obligations_usd: 100,
        requested_loan_amount: 500,
        household_size: 8,
        previous_loans_count: 3,
        on_time_payment_rate: 0.40,
        bill_payment_consistency: 0.30,
        communication_response_rate: 0.30,
        mobile_money_profile: {
          account_age_months: 1,
          avg_monthly_inflow_usd: 10,
          avg_monthly_outflow_usd: 5,
          transaction_count_3m: 2,
          balance_usd: 1,
          airtime_purchases_3m: 1,
          airtime_avg_per_purchase_usd: 1,
        },
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
    expect(result.scaled_score).toBeGreaterThanOrEqual(300);
    expect(result.scaled_score).toBeLessThan(350);
    expect(result.decision).toBe('review');
    expect(result.tier).toBe('Manual Review');
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
    // org raw = 80+50+40+30 = 200, component = round(200/200 * 200) = 200
    expect(result.components.org_verification).toBeGreaterThan(0);
  });

  it('smartphone product category has org_verification = 0', async () => {
    const result = await calculateRuleBasedScore(
      buildInput({
        product_category: 'smartphone',
        org_verification: {
          scoring_trust_level: 80,
          employment_status: 'active',
          tenure_months: 60,
          salary_verified: true,
        },
      })
    );
    expect(result.components.org_verification).toBe(0);
  });

  // ─── Component sum ─────────────────────────────────────────────
  it('component values sum approximately to total_raw_score', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    const componentSum =
      result.components.affordability +
      result.components.repayment_willingness +
      result.components.mobile_money +
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
    // Default: income=500, debt=0, loan=200, household=1, no repayment history
    // Affordability: M=17.12, dti=0.034->150, income=100, household=50 = 300
    // Repayment: null -> 125, Mobile: null -> 100, External: null -> 75
    // KYC: verified->50, face=98->35, liveness->15 = 100
    // raw = 300+125+100+75+100 = 700, scaled = 685 -> Tier 3 (>=650)
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.total_raw_score).toBe(700);
    expect(result.scaled_score).toBe(685);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 3');
  });

  it('customer_id is passed through correctly', async () => {
    const result = await calculateRuleBasedScore(buildInput({ customer_id: 'test-xyz-789' }));
    expect(result.customer_id).toBe('test-xyz-789');
  });

  // ─── Digital scoring with org verification ─────────────────────
  it('digital product with max org verification produces high score', async () => {
    // Affordability: same as default = 300
    // Repayment: null -> 125
    // Mobile Money: null -> 100, but digital weight = 100 -> component = round(100/200 * 100) = 50
    // External Credit: null -> 75, digital weight = 50 -> component = round(75/150 * 50) = 25
    // KYC: 100, weight = 100 -> component = 100
    // Org: scoring_trust=80->80, active->50, tenure=60->40, salary=true->30 = 200
    //   component = round(200/200 * 200) = 200
    // Components:
    //   affordability = round(300/300 * 300) = 300
    //   repayment = round(125/250 * 250) = 125
    //   mobile_money = 50
    //   external_credit = 25
    //   kyc = 100
    //   org = 200
    // raw = 300+125+50+25+100+200 = 800
    // scaled = 300 + (800/1000) * 550 = 300 + 440 = 740
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
    expect(result.total_raw_score).toBe(800);
    expect(result.scaled_score).toBe(740);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 3');
  });

  // ─── Score with full mobile money and external credit data ─────
  it('full mobile money data increases score beyond neutral', async () => {
    // Mobile Money: account_age=24->40, inflow=500->70, count=100->40, airtime=12->30, balance=100->20
    //   raw = 200, component = round(200/200 * 200) = 200 (vs. 100 for neutral)
    const withMobile = await calculateRuleBasedScore(
      buildInput({
        mobile_money_profile: {
          account_age_months: 24,
          avg_monthly_inflow_usd: 500,
          avg_monthly_outflow_usd: 300,
          transaction_count_3m: 100,
          balance_usd: 100,
          airtime_purchases_3m: 12,
          airtime_avg_per_purchase_usd: 5,
        },
      })
    );
    const withoutMobile = await calculateRuleBasedScore(buildInput());
    expect(withMobile.components.mobile_money).toBeGreaterThan(withoutMobile.components.mobile_money);
    expect(withMobile.components.mobile_money).toBe(200);
    expect(withoutMobile.components.mobile_money).toBe(100);
  });

  it('full external credit data increases score beyond neutral', async () => {
    // External: bureau=750->80, platform(verified,1500,4.5)->15+15+10=40, bank(verified,24)->15+15=30
    //   raw = 150, component = round(150/150 * 150) = 150 (vs. 75 for neutral)
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
    expect(withExternal.components.external_credit).toBeGreaterThan(withoutExternal.components.external_credit);
    expect(withExternal.components.external_credit).toBe(150);
    expect(withoutExternal.components.external_credit).toBe(75);
  });
});
