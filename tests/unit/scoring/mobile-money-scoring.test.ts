/**
 * Characterization tests for scoring sub-functions in scoring-engine.ts
 *
 * Tests scoreDeviceCollateral, scoreRepaymentWillingness, scoreExternalCredit,
 * scoreKYCVerification, and calculateOrgVerificationScore.
 *
 * Wrong sub-scores propagate through the entire credit decision — a broken
 * device collateral score can push borderline customers into rejection.
 */

import {
  scoreDeviceCollateral,
  scoreRepaymentWillingness,
  scoreExternalCredit,
  scoreKYCVerification,
  calculateOrgVerificationScore,
} from '../../../services/scoring-service/src/scoring/scoring-engine';
import type {
  RepaymentData,
  ExternalCreditData,
  KYCVerificationInput,
  OrgVerificationData,
} from '../../../services/scoring-service/src/scoring/types';

// ═════════════════════════════════════════════════════════════════
// scoreDeviceCollateral (0-100 points)
// ═════════════════════════════════════════════════════════════════

describe('scoreDeviceCollateral', () => {
  it('coverage ratio >= 1.0 returns 100', () => {
    // devicePrice=200, loanAmount=200 -> ratio=1.0
    expect(scoreDeviceCollateral(200, 200, 'smartphone')).toBe(100);
    // devicePrice=300, loanAmount=200 -> ratio=1.5
    expect(scoreDeviceCollateral(300, 200, 'smartphone')).toBe(100);
  });

  it('coverage ratio 0.8-0.99 returns 80', () => {
    // devicePrice=160, loanAmount=200 -> ratio=0.8
    expect(scoreDeviceCollateral(160, 200, 'smartphone')).toBe(80);
    // devicePrice=190, loanAmount=200 -> ratio=0.95
    expect(scoreDeviceCollateral(190, 200, 'smartphone')).toBe(80);
  });

  it('coverage ratio 0.6-0.79 returns 60', () => {
    // devicePrice=120, loanAmount=200 -> ratio=0.6
    expect(scoreDeviceCollateral(120, 200, 'smartphone')).toBe(60);
    // devicePrice=150, loanAmount=200 -> ratio=0.75
    expect(scoreDeviceCollateral(150, 200, 'smartphone')).toBe(60);
  });

  it('coverage ratio 0.4-0.59 returns 40', () => {
    // devicePrice=80, loanAmount=200 -> ratio=0.4
    expect(scoreDeviceCollateral(80, 200, 'smartphone')).toBe(40);
    // devicePrice=100, loanAmount=200 -> ratio=0.5
    expect(scoreDeviceCollateral(100, 200, 'smartphone')).toBe(40);
  });

  it('coverage ratio < 0.4 returns 20', () => {
    // devicePrice=50, loanAmount=200 -> ratio=0.25
    expect(scoreDeviceCollateral(50, 200, 'smartphone')).toBe(20);
    // devicePrice=10, loanAmount=200 -> ratio=0.05
    expect(scoreDeviceCollateral(10, 200, 'smartphone')).toBe(20);
  });

  it('digital loans (no device) return neutral 50', () => {
    expect(scoreDeviceCollateral(300, 200, 'digital')).toBe(50);
    expect(scoreDeviceCollateral(undefined, 200, 'digital')).toBe(50);
  });

  it('undefined device price returns 50', () => {
    expect(scoreDeviceCollateral(undefined, 200, 'smartphone')).toBe(50);
  });
});

// ═════════════════════════════════════════════════════════════════
// scoreRepaymentWillingness (0-150 points)
// ═════════════════════════════════════════════════════════════════

describe('scoreRepaymentWillingness', () => {
  it('returns 75 when data is null', () => {
    expect(scoreRepaymentWillingness(null)).toBe(75);
  });

  it('returns 75 when previous_loans_count = 0', () => {
    const data: RepaymentData = {
      previous_loans_count: 0,
      on_time_payment_rate: 0.95,
      days_since_last_payment: 10,
      total_payments_made: 50,
      bill_payment_consistency: 0.90,
      communication_response_rate: 0.90,
    };
    expect(scoreRepaymentWillingness(data)).toBe(75);
  });

  it('high scores: on_time >= 0.95 -> 90, bill >= 0.90 -> 30, comm >= 0.90 -> 30 = 150', () => {
    const data: RepaymentData = {
      previous_loans_count: 5,
      on_time_payment_rate: 0.95,
      days_since_last_payment: 10,
      total_payments_made: 50,
      bill_payment_consistency: 0.90,
      communication_response_rate: 0.90,
    };
    expect(scoreRepaymentWillingness(data)).toBe(150);
  });

  it('partial scores: on_time=0.85 -> 72, bill=0.75 -> 21, comm=0.75 -> 21 = 114', () => {
    const data: RepaymentData = {
      previous_loans_count: 3,
      on_time_payment_rate: 0.85,
      days_since_last_payment: 30,
      total_payments_made: 20,
      bill_payment_consistency: 0.75,
      communication_response_rate: 0.75,
    };
    expect(scoreRepaymentWillingness(data)).toBe(114);
  });

  it('low scores: on_time < 0.60 -> 0, bill < 0.60 -> 6, comm < 0.60 -> 6 = 12', () => {
    const data: RepaymentData = {
      previous_loans_count: 2,
      on_time_payment_rate: 0.50,
      days_since_last_payment: 90,
      total_payments_made: 5,
      bill_payment_consistency: 0.40,
      communication_response_rate: 0.40,
    };
    expect(scoreRepaymentWillingness(data)).toBe(12);
  });

  it('is capped at 150', () => {
    const data: RepaymentData = {
      previous_loans_count: 10,
      on_time_payment_rate: 1.0,
      days_since_last_payment: 1,
      total_payments_made: 100,
      bill_payment_consistency: 1.0,
      communication_response_rate: 1.0,
    };
    expect(scoreRepaymentWillingness(data)).toBeLessThanOrEqual(150);
    expect(scoreRepaymentWillingness(data)).toBe(150);
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
    expect(scoreExternalCredit(data)).toBeLessThanOrEqual(150);
    expect(scoreExternalCredit(data)).toBe(150);
  });
});

// ═════════════════════════════════════════════════════════════════
// scoreKYCVerification (0-150 points)
// ═════════════════════════════════════════════════════════════════

describe('scoreKYCVerification', () => {
  it('verified ID + face >= 95 + liveness = 150 (max)', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'verified' },
      face_match_score: 95,
      liveness_passed: true,
    };
    // 75 + 50 + 25 = 150
    expect(scoreKYCVerification(kyc)).toBe(150);
  });

  it('review ID + face 85-94 + liveness = 98', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'review' },
      face_match_score: 90,
      liveness_passed: true,
    };
    // 37 + 36 + 25 = 98
    expect(scoreKYCVerification(kyc)).toBe(98);
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

  it('face_match = 75 yields 21 (the >= 75 tier)', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'failed' },
      face_match_score: 75,
      liveness_passed: false,
    };
    // 0 + 21 + 0 = 21
    expect(scoreKYCVerification(kyc)).toBe(21);
  });

  it('is capped at 150', () => {
    const kyc: KYCVerificationInput = {
      id_verification: { status: 'verified' },
      face_match_score: 100,
      liveness_passed: true,
    };
    // 75 + 50 + 25 = 150
    expect(scoreKYCVerification(kyc)).toBeLessThanOrEqual(150);
    expect(scoreKYCVerification(kyc)).toBe(150);
  });
});

// ═════════════════════════════════════════════════════════════════
// calculateOrgVerificationScore (0-350 points)
// ═════════════════════════════════════════════════════════════════

describe('calculateOrgVerificationScore', () => {
  it('returns 175 (neutral) when data is null', () => {
    expect(calculateOrgVerificationScore(null)).toBe(175);
  });

  it('returns 175 (neutral) when data is undefined', () => {
    expect(calculateOrgVerificationScore(undefined)).toBe(175);
  });

  it('government trust + active + 60mo tenure + verified salary = 350', () => {
    // trust>=80 -> 120, active -> 80, tenure>=60 -> 70, salary -> 80
    // total = 120+80+70+80 = 350
    const data: OrgVerificationData = {
      scoring_trust_level: 80,
      employment_status: 'active',
      tenure_months: 60,
      salary_verified: true,
    };
    expect(calculateOrgVerificationScore(data)).toBe(350);
  });

  it('corporate trust + retired + 12mo tenure = 165', () => {
    // trust 60-79 -> 90, retired -> 40, tenure>=12 -> 35, no salary -> 0
    // total = 90+40+35+0 = 165
    const data: OrgVerificationData = {
      scoring_trust_level: 65,
      employment_status: 'retired',
      tenure_months: 12,
      salary_verified: false,
    };
    expect(calculateOrgVerificationScore(data)).toBe(165);
  });

  it('low trust + suspended + 6mo tenure + unverified = 45', () => {
    // trust<40 -> 30, suspended -> 0, tenure<12 but >=6 -> 15 (actually <12 -> 15)
    // Wait, tenure 6 months: < 12 -> 15
    // total = 30+0+15+0 = 45
    const data: OrgVerificationData = {
      scoring_trust_level: 30,
      employment_status: 'suspended',
      tenure_months: 6,
      salary_verified: false,
    };
    expect(calculateOrgVerificationScore(data)).toBe(45);
  });

  it('maximum possible is 350', () => {
    // 120+80+70+80 = 350
    const data: OrgVerificationData = {
      scoring_trust_level: 100,
      employment_status: 'active',
      tenure_months: 120,
      salary_verified: true,
    };
    expect(calculateOrgVerificationScore(data)).toBe(350);
  });

  it('cooperative trust level (40-59) yields 60 trust points', () => {
    // trust 40-59 -> 60, active -> 80, tenure 24-59 -> 55, salary -> 80
    // total = 60+80+55+80 = 275
    const data: OrgVerificationData = {
      scoring_trust_level: 50,
      employment_status: 'active',
      tenure_months: 36,
      salary_verified: true,
    };
    expect(calculateOrgVerificationScore(data)).toBe(275);
  });
});
