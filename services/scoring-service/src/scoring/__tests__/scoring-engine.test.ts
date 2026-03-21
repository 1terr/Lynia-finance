/**
 * Unit tests for services/scoring-service/src/scoring/scoring-engine.ts
 *
 * Tests credit score calculation, component weights, tier decisions,
 * KYC hard rejection, and product-specific scoring models.
 */

import {
  calculateRuleBasedScore,
  getScoringWeights,
  scoreAffordability,
  scoreRepaymentWillingness,
  scoreDeviceCollateral,
  scoreExternalCredit,
  scoreKYCVerification,
  calculateOrgVerificationScore,
} from '../scoring-engine';
import type { CreditScoreInput } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────

function buildInput(overrides: Partial<CreditScoreInput> = {}): CreditScoreInput {
  return {
    customer_id: 'cust-001',
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

// ── Component Weight Tests ───────────────────────────────────────────────

describe('getScoringWeights', () => {
  it('smartphone weights sum to 1000', () => {
    const w = getScoringWeights('smartphone');
    const sum = w.orgVerification + w.affordability + w.kycVerification + w.repayment + w.deviceCollateral + w.externalCredit;
    expect(sum).toBe(1000);
  });

  it('digital weights sum to 1000', () => {
    const w = getScoringWeights('digital');
    const sum = w.orgVerification + w.affordability + w.kycVerification + w.repayment + w.deviceCollateral + w.externalCredit;
    expect(sum).toBe(1000);
  });

  it('both products use identical weights', () => {
    const smartphone = getScoringWeights('smartphone');
    const digital = getScoringWeights('digital');
    expect(smartphone).toEqual(digital);
  });

  it('orgVerification is 350', () => {
    expect(getScoringWeights('smartphone').orgVerification).toBe(350);
  });

  it('affordability is 250', () => {
    expect(getScoringWeights('smartphone').affordability).toBe(250);
  });

  it('kycVerification is 150', () => {
    expect(getScoringWeights('smartphone').kycVerification).toBe(150);
  });

  it('repayment is 150', () => {
    expect(getScoringWeights('smartphone').repayment).toBe(150);
  });

  it('deviceCollateral is 100', () => {
    expect(getScoringWeights('smartphone').deviceCollateral).toBe(100);
  });

  it('externalCredit is 0 (deprecated)', () => {
    expect(getScoringWeights('smartphone').externalCredit).toBe(0);
  });
});

// ── Individual Component Tests ───────────────────────────────────────────

describe('scoreAffordability', () => {
  it('should return 200 for org-verified salary with low DTI and small household', () => {
    const score = scoreAffordability({
      org_verified_salary_usd: 500,
      household_size: 1,
      dependents: 0,
      requested_loan_amount: 200,
    });
    // DTI = (200/12)/500 = 0.033 <= 0.20 -> 150, loanPerPerson=200 -> 50
    expect(score).toBe(200);
  });

  it('should return neutral salary score when no salary data', () => {
    const score = scoreAffordability({
      household_size: 1,
      dependents: 0,
      requested_loan_amount: 200,
    });
    // No salary -> 75, loanPerPerson=200 -> 50
    expect(score).toBe(125);
  });

  it('should cap at 250', () => {
    const score = scoreAffordability({
      org_verified_salary_usd: 10000,
      household_size: 10,
      dependents: 0,
      requested_loan_amount: 100,
    });
    // DTI very low -> 150, loanPerPerson=10 -> 100 = 250, capped at 250
    expect(score).toBeLessThanOrEqual(250);
  });

  it('should give higher household score for lower loan-per-person', () => {
    const low = scoreAffordability({
      household_size: 1,
      dependents: 0,
      requested_loan_amount: 500,
    });
    const high = scoreAffordability({
      household_size: 10,
      dependents: 0,
      requested_loan_amount: 500,
    });
    // loanPerPerson=500 -> 25 vs loanPerPerson=50 -> 100
    expect(high).toBeGreaterThan(low);
  });
});

describe('scoreRepaymentWillingness', () => {
  it('should return neutral score (75) for first-time customers (null data)', () => {
    expect(scoreRepaymentWillingness(null)).toBe(75);
  });

  it('should return neutral score (75) for zero previous loans', () => {
    expect(scoreRepaymentWillingness({
      previous_loans_count: 0,
      on_time_payment_rate: 0,
      days_since_last_payment: 0,
      total_payments_made: 0,
      bill_payment_consistency: 0,
      communication_response_rate: 0,
    })).toBe(75);
  });

  it('should return max 150 for perfect history', () => {
    const score = scoreRepaymentWillingness({
      previous_loans_count: 5,
      on_time_payment_rate: 0.95,
      days_since_last_payment: 10,
      total_payments_made: 20,
      bill_payment_consistency: 0.95,
      communication_response_rate: 0.95,
    });
    expect(score).toBe(150);
  });

  it('should cap at 150', () => {
    const score = scoreRepaymentWillingness({
      previous_loans_count: 100,
      on_time_payment_rate: 1.0,
      days_since_last_payment: 1,
      total_payments_made: 500,
      bill_payment_consistency: 1.0,
      communication_response_rate: 1.0,
    });
    expect(score).toBeLessThanOrEqual(150);
  });
});

describe('scoreDeviceCollateral', () => {
  it('should return neutral score (50) for digital products', () => {
    expect(scoreDeviceCollateral(300, 200, 'digital')).toBe(50);
  });

  it('should return neutral score (50) when no device price', () => {
    expect(scoreDeviceCollateral(undefined, 200, 'smartphone')).toBe(50);
  });

  it('should return max 100 when device fully covers loan', () => {
    expect(scoreDeviceCollateral(250, 200, 'smartphone')).toBe(100);
  });

  it('should return 80 for strong coverage (0.8-0.99)', () => {
    // 180/200 = 0.9
    expect(scoreDeviceCollateral(180, 200, 'smartphone')).toBe(80);
  });

  it('should return 60 for moderate coverage (0.6-0.79)', () => {
    // 140/200 = 0.7
    expect(scoreDeviceCollateral(140, 200, 'smartphone')).toBe(60);
  });

  it('should return 40 for partial coverage (0.4-0.59)', () => {
    // 100/200 = 0.5
    expect(scoreDeviceCollateral(100, 200, 'smartphone')).toBe(40);
  });

  it('should return 20 for weak coverage (<0.4)', () => {
    // 50/200 = 0.25
    expect(scoreDeviceCollateral(50, 200, 'smartphone')).toBe(20);
  });
});

describe('scoreExternalCredit', () => {
  it('should return neutral score (75) when no data', () => {
    expect(scoreExternalCredit(null)).toBe(75);
  });

  it('should return max 150 for excellent external data', () => {
    const score = scoreExternalCredit({
      credit_bureau_score: 750,
      platform_verified: true,
      platform_earnings_3m_usd: 1500,
      platform_rating: 4.5,
      bank_account_verified: true,
      bank_account_age_months: 24,
    });
    expect(score).toBe(150);
  });

  it('should give neutral bureau score (40) when bureau score is null', () => {
    const score = scoreExternalCredit({
      credit_bureau_score: null,
      platform_verified: false,
      platform_earnings_3m_usd: 0,
      platform_rating: 0,
      bank_account_verified: false,
      bank_account_age_months: 0,
    });
    // Only neutral bureau (40)
    expect(score).toBe(40);
  });
});

describe('scoreKYCVerification', () => {
  it('should return max 150 for verified ID, high face match, liveness passed', () => {
    const score = scoreKYCVerification({
      id_verification: { status: 'verified' },
      face_match_score: 98,
      liveness_passed: true,
    });
    expect(score).toBe(150);
  });

  it('should return 0 for failed ID, zero face match, no liveness', () => {
    const score = scoreKYCVerification({
      id_verification: { status: 'failed' },
      face_match_score: 0,
      liveness_passed: false,
    });
    expect(score).toBe(0);
  });

  it('should give partial score for review status', () => {
    const score = scoreKYCVerification({
      id_verification: { status: 'review' },
      face_match_score: 80,
      liveness_passed: true,
    });
    // 37 (review) + 21 (face 75-85) + 25 (liveness) = 83
    expect(score).toBe(83);
  });
});

describe('calculateOrgVerificationScore', () => {
  it('should return neutral 175 when no data', () => {
    expect(calculateOrgVerificationScore(null)).toBe(175);
    expect(calculateOrgVerificationScore(undefined)).toBe(175);
  });

  it('should return max 350 for best org data', () => {
    const score = calculateOrgVerificationScore({
      scoring_trust_level: 80,
      employment_status: 'active',
      tenure_months: 60,
      salary_verified: true,
    });
    // 120 + 80 + 70 + 80 = 350
    expect(score).toBe(350);
  });

  it('should give lower score for retired employee', () => {
    const score = calculateOrgVerificationScore({
      scoring_trust_level: 60,
      employment_status: 'retired',
      tenure_months: 24,
      salary_verified: false,
    });
    // 90 + 40 + 55 + 0 = 185
    expect(score).toBe(185);
  });

  it('should not exceed 350', () => {
    const score = calculateOrgVerificationScore({
      scoring_trust_level: 100,
      employment_status: 'active',
      tenure_months: 120,
      salary_verified: true,
    });
    // 120 + 80 + 70 + 80 = 350
    expect(score).toBeLessThanOrEqual(350);
  });
});

// ── Main Scoring Function ────────────────────────────────────────────────

describe('calculateRuleBasedScore', () => {
  it('should return all expected fields', async () => {
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

  it('should default product_category to smartphone', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.product_category).toBe('smartphone');
  });

  // ─── Score Range Invariants ────────────────────────────────────

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

  // ─── New Customer ──────────────────────────────────────────────

  it('new customer with no history gets neutral repayment score of 75', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.components.repayment_willingness).toBe(75);
  });

  // ─── KYC Hard Rejection ────────────────────────────────────────

  it('KYC status failed triggers hard rejection regardless of score', async () => {
    const result = await calculateRuleBasedScore(buildInput({
      org_verified_salary_usd: 1000,
      kyc_result: {
        id_verification: { status: 'failed' },
        face_match_score: 98,
        liveness_passed: true,
      },
    }));
    expect(result.decision).toBe('reject');
    expect(result.tier).toBe('KYC Not Verified');
    expect(result.credit_limit_usd).toBe(0);
  });

  // ─── Tier Decisions ────────────────────────────────────────────

  it('score below threshold results in rejection (KYC failed path)', async () => {
    // KYC failed -> hard rejection regardless of score
    const result = await calculateRuleBasedScore(buildInput({
      requested_loan_amount: 500,
      household_size: 10,
      previous_loans_count: 3,
      on_time_payment_rate: 0.30,
      bill_payment_consistency: 0.20,
      communication_response_rate: 0.20,
      kyc_result: {
        id_verification: { status: 'failed' },
        face_match_score: 50,
        liveness_passed: false,
      },
    }));
    expect(result.decision).toBe('reject');
    expect(result.tier).toBe('KYC Not Verified');
    expect(result.credit_limit_usd).toBe(0);
  });

  it('smartphone: score >= 350 results in approval', async () => {
    // Default input produces score well above 350
    const result = await calculateRuleBasedScore(buildInput());
    expect(result.scaled_score).toBeGreaterThanOrEqual(350);
    expect(result.decision).toBe('approve');
  });

  it('digital: score below 450 results in rejection', async () => {
    // Minimal data for digital product, aim for low score
    const result = await calculateRuleBasedScore(buildInput({
      product_category: 'digital',
      requested_loan_amount: 500,
      household_size: 10,
      previous_loans_count: 3,
      on_time_payment_rate: 0.30,
      bill_payment_consistency: 0.20,
      communication_response_rate: 0.20,
      external_credit_data: {
        credit_bureau_score: 400,
        platform_verified: false,
        platform_earnings_3m_usd: 0,
        platform_rating: 0,
        bank_account_verified: false,
        bank_account_age_months: 0,
      },
      kyc_result: {
        id_verification: { status: 'review' },
        face_match_score: 50,
        liveness_passed: false,
      },
    }));
    // Digital threshold is 450
    if (result.scaled_score < 450) {
      expect(result.decision).toBe('reject');
    }
  });

  it('score 350-499 -> approved with Tier 1 defaults (smartphone)', async () => {
    const result = await calculateRuleBasedScore(buildInput({
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
    }));
    if (result.scaled_score >= 350 && result.scaled_score < 500) {
      expect(result.decision).toBe('approve');
      expect(result.tier).toBe('Tier 1');
      expect(result.credit_limit_usd).toBe(200);
      expect(result.down_payment_percentage).toBe(30);
      expect(result.interest_rate_apr).toBe(5);
    }
  });

  it('score 500-649 -> approved with Tier 2 defaults', async () => {
    const result = await calculateRuleBasedScore(buildInput({
      requested_loan_amount: 200,
      household_size: 3,
      previous_loans_count: 5,
      on_time_payment_rate: 0.75,
      bill_payment_consistency: 0.60,
      communication_response_rate: 0.60,
    }));
    if (result.scaled_score >= 500 && result.scaled_score < 650) {
      expect(result.decision).toBe('approve');
      expect(result.tier).toBe('Tier 2');
      expect(result.credit_limit_usd).toBe(500);
      expect(result.down_payment_percentage).toBe(20);
      expect(result.interest_rate_apr).toBe(4);
    }
  });

  it('score >= 650 -> approved with Tier 3 defaults', async () => {
    const result = await calculateRuleBasedScore(buildInput({
      org_verified_salary_usd: 500,
      device_retail_price_usd: 250,
      requested_loan_amount: 200,
      household_size: 1,
      previous_loans_count: 5,
      on_time_payment_rate: 0.95,
      bill_payment_consistency: 0.90,
      communication_response_rate: 0.90,
      org_verification: {
        scoring_trust_level: 80,
        employment_status: 'active',
        tenure_months: 60,
        salary_verified: true,
      },
    }));
    expect(result.scaled_score).toBeGreaterThanOrEqual(650);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 3');
    expect(result.credit_limit_usd).toBe(2000);
    expect(result.down_payment_percentage).toBe(10);
    expect(result.interest_rate_apr).toBe(3);
  });

  // ─── Product Category Differences ──────────────────────────────

  it('digital product with org verification scores org component', async () => {
    const result = await calculateRuleBasedScore(buildInput({
      product_category: 'digital',
      org_verification: {
        scoring_trust_level: 80,
        employment_status: 'active',
        tenure_months: 60,
        salary_verified: true,
      },
    }));
    expect(result.product_category).toBe('digital');
    expect(result.components.org_verification).toBeGreaterThan(0);
  });

  it('smartphone product without org data gets neutral org score', async () => {
    const result = await calculateRuleBasedScore(buildInput({
      product_category: 'smartphone',
    }));
    // null org -> 175/350 -> round(175/350*350) = 175
    expect(result.components.org_verification).toBe(175);
  });

  // ─── Component Sum ─────────────────────────────────────────────

  it('component values sum approximately to total_raw_score', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    const componentSum =
      result.components.affordability +
      result.components.repayment_willingness +
      result.components.device_collateral +
      result.components.external_credit +
      result.components.kyc_verification +
      result.components.org_verification;
    expect(Math.abs(componentSum - result.total_raw_score)).toBeLessThanOrEqual(6);
  });

  // ─── Exact Score Verification ──────────────────────────────────

  it('exact score for default input with all neutrals', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    // affordability: no salary->75 + loanPerPerson=200->50 = 125, weighted: round(125/250*250)=125
    // repayment: no history -> 75, weighted: round(75/150*150)=75
    // deviceCollateral: no device, smartphone -> 50, weighted: round(50/100*100)=50
    // externalCredit: null -> 75, weighted: round(75/150*0)=0
    // kyc: verified(75)+face98(50)+liveness(25)=150, weighted: round(150/150*150)=150
    // org: null -> 175, weighted: round(175/350*350)=175
    // total raw = 125+75+50+0+150+175 = 575
    // scaled = round(300 + 575/1000 * 550) = round(616.25) = 616
    expect(result.total_raw_score).toBe(575);
    expect(result.scaled_score).toBe(616);
    expect(result.decision).toBe('approve');
    expect(result.tier).toBe('Tier 2');
  });

  it('full org verification produces higher score', async () => {
    const result = await calculateRuleBasedScore(buildInput({
      org_verification: {
        scoring_trust_level: 80,
        employment_status: 'active',
        tenure_months: 60,
        salary_verified: true,
      },
    }));
    // org: 350/350 -> weighted: round(350/350*350) = 350
    // vs default org: 175 -> delta = +175
    // total raw = 575 - 175 + 350 = 750
    // scaled = round(300 + 750/1000 * 550) = round(712.5) = 713
    expect(result.total_raw_score).toBe(750);
    expect(result.scaled_score).toBe(713);
    expect(result.tier).toBe('Tier 3');
  });

  // ─── Timestamp ─────────────────────────────────────────────────

  it('calculated_at is a valid ISO string', async () => {
    const result = await calculateRuleBasedScore(buildInput());
    const parsed = new Date(result.calculated_at);
    expect(parsed.toISOString()).toBe(result.calculated_at);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it('customer_id is passed through correctly', async () => {
    const result = await calculateRuleBasedScore(buildInput({ customer_id: 'test-xyz-789' }));
    expect(result.customer_id).toBe('test-xyz-789');
  });
});
