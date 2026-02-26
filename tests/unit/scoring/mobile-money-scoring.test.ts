/**
 * Characterization tests for scoring sub-functions in scoring-engine.ts
 *
 * Tests scoreMobileMoneyActivity, scoreRepaymentWillingness, scoreExternalCredit,
 * scoreKYCVerification, and calculateOrgVerificationScore.
 *
 * Wrong sub-scores propagate through the entire credit decision — a broken
 * mobile money score can push borderline customers into rejection.
 */

import {
  scoreMobileMoneyActivity,
  scoreRepaymentWillingness,
  scoreExternalCredit,
  scoreKYCVerification,
  calculateOrgVerificationScore,
} from '../../../services/scoring-service/src/scoring/scoring-engine';
import type {
  MobileMoneyProfile,
  RepaymentData,
  ExternalCreditData,
  KYCVerificationInput,
  OrgVerificationData,
} from '../../../services/scoring-service/src/scoring/types';

// ═════════════════════════════════════════════════════════════════
// scoreMobileMoneyActivity (0-200 points)
// ═════════════════════════════════════════════════════════════════

describe('scoreMobileMoneyActivity', () => {
  it('returns 100 when profile is null', () => {
    expect(scoreMobileMoneyActivity(null)).toBe(100);
  });

  it('max score: all sub-scores at highest tier = 200', () => {
    // account_age=24 -> 40, inflow=500 -> 70, count=100 -> 40, airtime=12 -> 30, balance=100 -> 20
    // total = 40+70+40+30+20 = 200
    const profile: MobileMoneyProfile = {
      account_age_months: 24,
      avg_monthly_inflow_usd: 500,
      avg_monthly_outflow_usd: 300,
      transaction_count_3m: 100,
      balance_usd: 100,
      airtime_purchases_3m: 12,
      airtime_avg_per_purchase_usd: 5,
    };
    expect(scoreMobileMoneyActivity(profile)).toBe(200);
  });

  it('min score with data: all sub-scores at lowest tier = 30', () => {
    // account_age=1 -> 10, inflow=10 -> 5, count=5 -> 5, airtime=1 -> 5, balance=5 -> 5
    // total = 10+5+5+5+5 = 30
    const profile: MobileMoneyProfile = {
      account_age_months: 1,
      avg_monthly_inflow_usd: 10,
      avg_monthly_outflow_usd: 5,
      transaction_count_3m: 5,
      balance_usd: 5,
      airtime_purchases_3m: 1,
      airtime_avg_per_purchase_usd: 2,
    };
    expect(scoreMobileMoneyActivity(profile)).toBe(30);
  });

  it('account age boundaries: 12 months -> 30, 6 months -> 20', () => {
    const base: MobileMoneyProfile = {
      account_age_months: 12,
      avg_monthly_inflow_usd: 10,
      avg_monthly_outflow_usd: 5,
      transaction_count_3m: 5,
      balance_usd: 5,
      airtime_purchases_3m: 1,
      airtime_avg_per_purchase_usd: 2,
    };
    // 12 months: 30 + 5+5+5+5 = 50
    expect(scoreMobileMoneyActivity(base)).toBe(50);

    // 6 months: 20 + 5+5+5+5 = 40
    expect(scoreMobileMoneyActivity({ ...base, account_age_months: 6 })).toBe(40);
  });

  it('monthly inflow boundaries: 300 -> 55, 150 -> 35, 75 -> 20', () => {
    const base: MobileMoneyProfile = {
      account_age_months: 1,
      avg_monthly_inflow_usd: 300,
      avg_monthly_outflow_usd: 100,
      transaction_count_3m: 5,
      balance_usd: 5,
      airtime_purchases_3m: 1,
      airtime_avg_per_purchase_usd: 2,
    };
    // 300: 10+55+5+5+5 = 80
    expect(scoreMobileMoneyActivity(base)).toBe(80);

    // 150: 10+35+5+5+5 = 60
    expect(scoreMobileMoneyActivity({ ...base, avg_monthly_inflow_usd: 150 })).toBe(60);

    // 75: 10+20+5+5+5 = 45
    expect(scoreMobileMoneyActivity({ ...base, avg_monthly_inflow_usd: 75 })).toBe(45);
  });

  it('transaction count boundaries: 50 -> 30, 20 -> 15', () => {
    const base: MobileMoneyProfile = {
      account_age_months: 1,
      avg_monthly_inflow_usd: 10,
      avg_monthly_outflow_usd: 5,
      transaction_count_3m: 50,
      balance_usd: 5,
      airtime_purchases_3m: 1,
      airtime_avg_per_purchase_usd: 2,
    };
    // 50: 10+5+30+5+5 = 55
    expect(scoreMobileMoneyActivity(base)).toBe(55);

    // 20: 10+5+15+5+5 = 40
    expect(scoreMobileMoneyActivity({ ...base, transaction_count_3m: 20 })).toBe(40);
  });

  it('airtime boundaries: 6 -> 20, 3 -> 10', () => {
    const base: MobileMoneyProfile = {
      account_age_months: 1,
      avg_monthly_inflow_usd: 10,
      avg_monthly_outflow_usd: 5,
      transaction_count_3m: 5,
      balance_usd: 5,
      airtime_purchases_3m: 6,
      airtime_avg_per_purchase_usd: 2,
    };
    // 6: 10+5+5+20+5 = 45
    expect(scoreMobileMoneyActivity(base)).toBe(45);

    // 3: 10+5+5+10+5 = 35
    expect(scoreMobileMoneyActivity({ ...base, airtime_purchases_3m: 3 })).toBe(35);
  });

  it('is capped at 200', () => {
    // Even with all maximum values, cannot exceed 200
    const profile: MobileMoneyProfile = {
      account_age_months: 100,
      avg_monthly_inflow_usd: 10000,
      avg_monthly_outflow_usd: 5000,
      transaction_count_3m: 1000,
      balance_usd: 10000,
      airtime_purchases_3m: 100,
      airtime_avg_per_purchase_usd: 50,
    };
    expect(scoreMobileMoneyActivity(profile)).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════
// scoreRepaymentWillingness (0-250 points)
// ═════════════════════════════════════════════════════════════════

describe('scoreRepaymentWillingness', () => {
  it('returns 125 when data is null', () => {
    expect(scoreRepaymentWillingness(null)).toBe(125);
  });

  it('returns 125 when previous_loans_count = 0', () => {
    const data: RepaymentData = {
      previous_loans_count: 0,
      on_time_payment_rate: 0.95,
      days_since_last_payment: 10,
      total_payments_made: 50,
      bill_payment_consistency: 0.90,
      communication_response_rate: 0.90,
    };
    expect(scoreRepaymentWillingness(data)).toBe(125);
  });

  it('high scores: on_time >= 0.95 -> 150, bill >= 0.90 -> 50, comm >= 0.90 -> 50 = 250', () => {
    const data: RepaymentData = {
      previous_loans_count: 5,
      on_time_payment_rate: 0.95,
      days_since_last_payment: 10,
      total_payments_made: 50,
      bill_payment_consistency: 0.90,
      communication_response_rate: 0.90,
    };
    expect(scoreRepaymentWillingness(data)).toBe(250);
  });

  it('partial scores: on_time=0.85 -> 120, bill=0.75 -> 35, comm=0.75 -> 35 = 190', () => {
    const data: RepaymentData = {
      previous_loans_count: 3,
      on_time_payment_rate: 0.85,
      days_since_last_payment: 30,
      total_payments_made: 20,
      bill_payment_consistency: 0.75,
      communication_response_rate: 0.75,
    };
    expect(scoreRepaymentWillingness(data)).toBe(190);
  });

  it('low scores: on_time < 0.60 -> 0, bill < 0.60 -> 10, comm < 0.60 -> 10 = 20', () => {
    const data: RepaymentData = {
      previous_loans_count: 2,
      on_time_payment_rate: 0.50,
      days_since_last_payment: 90,
      total_payments_made: 5,
      bill_payment_consistency: 0.40,
      communication_response_rate: 0.40,
    };
    expect(scoreRepaymentWillingness(data)).toBe(20);
  });

  it('is capped at 250', () => {
    // Max possible is 150+50+50 = 250, verify cap enforced
    const data: RepaymentData = {
      previous_loans_count: 10,
      on_time_payment_rate: 1.0,
      days_since_last_payment: 1,
      total_payments_made: 100,
      bill_payment_consistency: 1.0,
      communication_response_rate: 1.0,
    };
    expect(scoreRepaymentWillingness(data)).toBeLessThanOrEqual(250);
    expect(scoreRepaymentWillingness(data)).toBe(250);
  });
});

// ═════════════════════════════════════════════════════════════════
// scoreExternalCredit (0-150 points)
// ═════════════════════════════════════════════════════════════════

describe('scoreExternalCredit', () => {
  it('returns 75 when data is null', () => {
    expect(scoreExternalCredit(null)).toBe(75);
  });

  it('no bureau score (null) yields 40 neutral bureau points', () => {
    // bureau=null -> 40, no platform, no bank = 40
    const data: ExternalCreditData = {
      credit_bureau_score: null,
      platform_verified: false,
      platform_earnings_3m_usd: 0,
      platform_rating: 0,
      bank_account_verified: false,
      bank_account_age_months: 0,
    };
    expect(scoreExternalCredit(data)).toBe(40);
  });

  it('high score: bureau=750 -> 80, platform(verified,1500,4.5) -> 40, bank(verified,24) -> 30 = 150', () => {
    const data: ExternalCreditData = {
      credit_bureau_score: 750,
      platform_verified: true,
      platform_earnings_3m_usd: 1500,
      platform_rating: 4.5,
      bank_account_verified: true,
      bank_account_age_months: 24,
    };
    // bureau=80, platform: 15+15+10=40, bank: 15+15=30
    // total = 80+40+30 = 150
    expect(scoreExternalCredit(data)).toBe(150);
  });

  it('low score: bureau < 600 -> 10, no platform, no bank = 10', () => {
    const data: ExternalCreditData = {
      credit_bureau_score: 500,
      platform_verified: false,
      platform_earnings_3m_usd: 0,
      platform_rating: 0,
      bank_account_verified: false,
      bank_account_age_months: 0,
    };
    expect(scoreExternalCredit(data)).toBe(10);
  });

  it('mid-range bureau scores: 700 -> 65, 650 -> 50, 600 -> 30', () => {
    const base: ExternalCreditData = {
      credit_bureau_score: 700,
      platform_verified: false,
      platform_earnings_3m_usd: 0,
      platform_rating: 0,
      bank_account_verified: false,
      bank_account_age_months: 0,
    };
    expect(scoreExternalCredit(base)).toBe(65);
    expect(scoreExternalCredit({ ...base, credit_bureau_score: 650 })).toBe(50);
    expect(scoreExternalCredit({ ...base, credit_bureau_score: 600 })).toBe(30);
  });

  it('platform with mid-range earnings and rating', () => {
    // bureau=null -> 40, platform(verified, 900, 4.0) -> 15+10+7=32
    // total = 40+32 = 72
    const data: ExternalCreditData = {
      credit_bureau_score: null,
      platform_verified: true,
      platform_earnings_3m_usd: 900,
      platform_rating: 4.0,
      bank_account_verified: false,
      bank_account_age_months: 0,
    };
    expect(scoreExternalCredit(data)).toBe(72);
  });

  it('is capped at 150', () => {
    const data: ExternalCreditData = {
      credit_bureau_score: 850,
      platform_verified: true,
      platform_earnings_3m_usd: 5000,
      platform_rating: 5.0,
      bank_account_verified: true,
      bank_account_age_months: 120,
    };
    // bureau=80, platform=15+15+10=40, bank=15+15=30 -> 150
    expect(scoreExternalCredit(data)).toBeLessThanOrEqual(150);
    expect(scoreExternalCredit(data)).toBe(150);
  });
});

// ═════════════════════════════════════════════════════════════════
// scoreKYCVerification (0-100 points)
// ═════════════════════════════════════════════════════════════════

describe('scoreKYCVerification', () => {
  it('verified ID + face >= 95 + liveness = 100 (max)', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'verified' },
      face_match_score: 95,
      liveness_passed: true,
    };
    // 50 + 35 + 15 = 100
    expect(scoreKYCVerification(kyc)).toBe(100);
  });

  it('review ID + face 85-94 + liveness = 65', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'review' },
      face_match_score: 90,
      liveness_passed: true,
    };
    // 25 + 25 + 15 = 65
    expect(scoreKYCVerification(kyc)).toBe(65);
  });

  it('failed ID + face < 75 + no liveness = 0', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'failed' },
      face_match_score: 50,
      liveness_passed: false,
    };
    // 0 + 0 + 0 = 0
    expect(scoreKYCVerification(kyc)).toBe(0);
  });

  it('face_match = 75 yields 15 (the >= 75 tier)', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'failed' },
      face_match_score: 75,
      liveness_passed: false,
    };
    // 0 + 15 + 0 = 15
    expect(scoreKYCVerification(kyc)).toBe(15);
  });

  it('is capped at 100', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'verified' },
      face_match_score: 100,
      liveness_passed: true,
    };
    // 50 + 35 + 15 = 100
    expect(scoreKYCVerification(kyc)).toBeLessThanOrEqual(100);
    expect(scoreKYCVerification(kyc)).toBe(100);
  });
});

// ═════════════════════════════════════════════════════════════════
// calculateOrgVerificationScore (0-200 points)
// ═════════════════════════════════════════════════════════════════

describe('calculateOrgVerificationScore', () => {
  it('returns 0 when data is null', () => {
    expect(calculateOrgVerificationScore(null)).toBe(0);
  });

  it('returns 0 when data is undefined', () => {
    expect(calculateOrgVerificationScore(undefined)).toBe(0);
  });

  it('government trust + active + 60mo tenure + verified salary = 200', () => {
    // trust>=80 -> 80, active -> 50, tenure>=60 -> 40, salary -> 30
    // total = 80+50+40+30 = 200
    const data: OrgVerificationData = {
      scoring_trust_level: 80,
      employment_status: 'active',
      tenure_months: 60,
      salary_verified: true,
    };
    expect(calculateOrgVerificationScore(data)).toBe(200);
  });

  it('corporate trust + retired + 12mo tenure = 105', () => {
    // trust 60-79 -> 60, retired -> 25, tenure>=12 -> 20, no salary -> 0
    // total = 60+25+20+0 = 105
    const data: OrgVerificationData = {
      scoring_trust_level: 65,
      employment_status: 'retired',
      tenure_months: 12,
      salary_verified: false,
    };
    expect(calculateOrgVerificationScore(data)).toBe(105);
  });

  it('low trust + suspended + 6mo tenure + unverified = 30', () => {
    // trust<40 -> 20, suspended -> 0, tenure>=6 but <12 -> 10, no salary -> 0
    // total = 20+0+10+0 = 30
    const data: OrgVerificationData = {
      scoring_trust_level: 30,
      employment_status: 'suspended',
      tenure_months: 6,
      salary_verified: false,
    };
    expect(calculateOrgVerificationScore(data)).toBe(30);
  });

  it('is capped at 200', () => {
    // Maximum possible is 80+50+40+30 = 200
    const data: OrgVerificationData = {
      scoring_trust_level: 100,
      employment_status: 'active',
      tenure_months: 120,
      salary_verified: true,
    };
    expect(calculateOrgVerificationScore(data)).toBeLessThanOrEqual(200);
    expect(calculateOrgVerificationScore(data)).toBe(200);
  });

  it('cooperative trust level (40-59) yields 40 trust points', () => {
    // trust 40-59 -> 40, active -> 50, tenure 24-59 -> 30, salary -> 30
    // total = 40+50+30+30 = 150
    const data: OrgVerificationData = {
      scoring_trust_level: 50,
      employment_status: 'active',
      tenure_months: 36,
      salary_verified: true,
    };
    expect(calculateOrgVerificationScore(data)).toBe(150);
  });
});
