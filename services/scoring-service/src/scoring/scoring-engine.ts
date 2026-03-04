/**
 * Scoring Engine — Pure Scoring Functions
 *
 * All functions in this module are PURE: no I/O, no database calls,
 * no logger usage. They take scoring inputs and return numeric scores.
 * Extracted from the monolith for independent testing and reuse.
 */

import {
  AffordabilityData,
  RepaymentData,
  MobileMoneyProfile,
  ExternalCreditData,
  KYCVerificationInput,
  OrgVerificationData,
  ScoringWeights,
  CreditScoreInput,
  CreditScoreResult,
} from './types';
import { calculateDecliningBalancePayment } from '../../../shared/utils/loan-calculator';

// ===================================================================
// SCORING FUNCTIONS - 5 COMPONENTS
// ===================================================================

/**
 * Component 1: Affordability Assessment (30%, 0-300 points)
 *
 * Determines if customer can afford monthly installment based on income.
 * Uses debt-to-income ratio as primary metric.
 */
export function scoreAffordability(data: AffordabilityData): number {
  // Use 12-month term for conservative affordability estimate — the customer
  // selects their actual term after approval. Longer term = lower monthly
  // payment = more generous DTI ratio, avoiding false rejections.
  const { monthlyPayment: monthlyInstallment } = calculateDecliningBalancePayment({
    principal: data.requested_loan_amount,
    annualRatePercent: 5, // Worst-case APR (Tier 1)
    termMonths: 12,
  });

  // 1. Debt-to-Income Ratio (150 points max)
  const totalMonthlyObligations = data.existing_debt_obligations_usd + monthlyInstallment;
  const dtiRatio = totalMonthlyObligations / Math.max(data.monthly_income_usd, 1);

  let dtiScore = 0;
  if (dtiRatio <= 0.30) dtiScore = 150; // Ideal: ≤30% DTI
  else if (dtiRatio <= 0.40) dtiScore = 120; // Acceptable
  else if (dtiRatio <= 0.50) dtiScore = 80; // Risky
  else if (dtiRatio <= 0.60) dtiScore = 40; // Very risky
  else dtiScore = 0; // Cannot afford

  // 2. Income Level (100 points max)
  let incomeScore = 0;
  if (data.monthly_income_usd >= 500) incomeScore = 100;
  else if (data.monthly_income_usd >= 300) incomeScore = 75;
  else if (data.monthly_income_usd >= 150) incomeScore = 50;
  else if (data.monthly_income_usd >= 100) incomeScore = 25;
  else incomeScore = 0;

  // 3. Household Financial Stress (50 points max)
  const householdSize = Math.max(data.household_size, 1);
  const incomePerPerson = data.monthly_income_usd / householdSize;

  let householdScore = 0;
  if (incomePerPerson >= 100) householdScore = 50;
  else if (incomePerPerson >= 75) householdScore = 35;
  else if (incomePerPerson >= 50) householdScore = 20;
  else householdScore = 10;

  return Math.min(dtiScore + incomeScore + householdScore, 300);
}

/**
 * Component 2: Repayment Willingness (25%, 0-250 points)
 *
 * Assesses customer's willingness and history of making payments on time.
 * Returns neutral score (125) for first-time customers.
 */
export function scoreRepaymentWillingness(data: RepaymentData | null): number {
  if (!data || data.previous_loans_count === 0) {
    return 125; // Neutral score for first-time customers
  }

  let score = 0;

  // 1. Historical Repayment Performance (150 points max)
  if (data.on_time_payment_rate >= 0.95) score += 150; // Excellent
  else if (data.on_time_payment_rate >= 0.85) score += 120; // Good
  else if (data.on_time_payment_rate >= 0.75) score += 80; // Fair
  else if (data.on_time_payment_rate >= 0.60) score += 40; // Poor
  else score += 0; // Very poor

  // 2. Bill Payment Consistency (50 points max)
  if (data.bill_payment_consistency >= 0.90) score += 50;
  else if (data.bill_payment_consistency >= 0.75) score += 35;
  else if (data.bill_payment_consistency >= 0.60) score += 20;
  else score += 10;

  // 3. Communication Responsiveness (50 points max)
  if (data.communication_response_rate >= 0.90) score += 50;
  else if (data.communication_response_rate >= 0.75) score += 35;
  else if (data.communication_response_rate >= 0.60) score += 20;
  else score += 10;

  return Math.min(score, 250);
}

/**
 * Component 3: Mobile Money Activity (20%, 0-200 points)
 *
 * Uses mobile money transaction patterns as income and stability proxy.
 * Returns neutral score (100) if no mobile money data available.
 */
export function scoreMobileMoneyActivity(profile: MobileMoneyProfile | null): number {
  if (!profile) return 100; // Neutral score if no data

  let score = 0;

  // 1. Account Age (40 points) - Established customer
  if (profile.account_age_months >= 24) score += 40;
  else if (profile.account_age_months >= 12) score += 30;
  else if (profile.account_age_months >= 6) score += 20;
  else score += 10;

  // 2. Monthly Inflow (70 points) - Income proxy
  if (profile.avg_monthly_inflow_usd >= 500) score += 70;
  else if (profile.avg_monthly_inflow_usd >= 300) score += 55;
  else if (profile.avg_monthly_inflow_usd >= 150) score += 35;
  else if (profile.avg_monthly_inflow_usd >= 75) score += 20;
  else score += 5;

  // 3. Transaction Frequency (40 points) - Active usage
  if (profile.transaction_count_3m >= 100) score += 40;
  else if (profile.transaction_count_3m >= 50) score += 30;
  else if (profile.transaction_count_3m >= 20) score += 15;
  else score += 5;

  // 4. Airtime Purchase Consistency (30 points) - Regular income indicator
  if (profile.airtime_purchases_3m >= 12) score += 30; // Weekly purchases
  else if (profile.airtime_purchases_3m >= 6) score += 20; // Bi-weekly
  else if (profile.airtime_purchases_3m >= 3) score += 10; // Monthly
  else score += 5;

  // 5. Current Balance (20 points) - Financial stability
  if (profile.balance_usd >= 100) score += 20;
  else if (profile.balance_usd >= 50) score += 15;
  else if (profile.balance_usd >= 20) score += 10;
  else score += 5;

  return Math.min(score, 200);
}

/**
 * Component 4: External Credit Data (15%, 0-150 points)
 *
 * Leverages external data sources for credit verification.
 * Returns neutral score (75) if no external data available.
 */
export function scoreExternalCredit(data: ExternalCreditData | null): number {
  if (!data) return 75; // Neutral score if no data

  let score = 0;

  // 1. Credit Bureau Score (80 points max)
  if (data.credit_bureau_score !== null) {
    if (data.credit_bureau_score >= 750) score += 80;
    else if (data.credit_bureau_score >= 700) score += 65;
    else if (data.credit_bureau_score >= 650) score += 50;
    else if (data.credit_bureau_score >= 600) score += 30;
    else score += 10;
  } else {
    score += 40; // Neutral if no bureau data
  }

  // 2. Platform Integration (Bolt/Uber) (40 points max)
  if (data.platform_verified) {
    score += 15; // Base verification bonus

    // Earnings level
    if (data.platform_earnings_3m_usd >= 1500) score += 15;
    else if (data.platform_earnings_3m_usd >= 900) score += 10;
    else if (data.platform_earnings_3m_usd >= 450) score += 5;

    // Driver rating
    if (data.platform_rating >= 4.5) score += 10;
    else if (data.platform_rating >= 4.0) score += 7;
    else if (data.platform_rating >= 3.5) score += 3;
  }

  // 3. Bank Account Verification (30 points max)
  if (data.bank_account_verified) {
    score += 15; // Base verification

    if (data.bank_account_age_months >= 24) score += 15;
    else if (data.bank_account_age_months >= 12) score += 10;
    else if (data.bank_account_age_months >= 6) score += 5;
  }

  return Math.min(score, 150);
}

/**
 * Component 5: KYC Verification (10%, 0-100 points)
 *
 * Provider-agnostic identity verification scoring.
 * Works with the DIDIT KYC provider.
 * All input scores are on 0-100 scale.
 */
export function scoreKYCVerification(kycResult: KYCVerificationInput): number {
  let score = 0;

  // 1. ID Document Verification (50 points)
  if (kycResult.id_verification.status === 'verified') {
    score += 50;
  } else if (kycResult.id_verification.status === 'review') {
    score += 25;
  }

  // 2. Selfie-ID Match (35 points) — score is 0-100
  const faceMatch = kycResult.face_match_score;
  if (faceMatch >= 95) score += 35;
  else if (faceMatch >= 85) score += 25;
  else if (faceMatch >= 75) score += 15;

  // 3. Liveness Check (15 points)
  if (kycResult.liveness_passed) {
    score += 15;
  }

  return Math.min(score, 100);
}

// ===================================================================
// SCORING WEIGHTS & ORGANIZATION VERIFICATION
// ===================================================================

/**
 * Get scoring component weights based on product category.
 *
 * Smartphone loans use the standard 5-component model (org verification = 0).
 * Digital loans redistribute weight to include a 6th org verification component
 * by reducing mobile money (200->100) and external credit (150->50).
 * Total always sums to 1000.
 */
export function getScoringWeights(productCategory: 'smartphone' | 'digital'): ScoringWeights {
  if (productCategory === 'digital') {
    return {
      affordability: 300,
      repayment: 250,
      mobileMoney: 100,
      externalCredit: 50,
      kycVerification: 100,
      orgVerification: 200,
    };
  }
  return {
    affordability: 300,
    repayment: 250,
    mobileMoney: 200,
    externalCredit: 150,
    kycVerification: 100,
    orgVerification: 0,
  };
}

/**
 * Component 6: Organization Verification (up to 200 points for digital loans)
 *
 * Scores based on 4 sub-factors:
 * - Organization trust level:  up to 80 pts
 * - Employment status:         up to 50 pts
 * - Employment tenure:         up to 40 pts
 * - Salary verification:       up to 30 pts
 */
export function calculateOrgVerificationScore(data: OrgVerificationData | null | undefined): number {
  if (!data) return 0;

  let score = 0;

  // 1. Organization Trust Level (80 points max)
  if (data.scoring_trust_level >= 80) score += 80;       // Government
  else if (data.scoring_trust_level >= 60) score += 60;   // Corporate
  else if (data.scoring_trust_level >= 40) score += 40;   // Cooperative
  else score += 20;                                       // Other

  // 2. Employment Status (50 points max)
  if (data.employment_status === 'active') score += 50;
  else if (data.employment_status === 'retired') score += 25;
  // suspended/other: 0 pts

  // 3. Employment Tenure (40 points max)
  if (data.tenure_months >= 60) score += 40;       // 5+ years
  else if (data.tenure_months >= 24) score += 30;  // 2-5 years
  else if (data.tenure_months >= 12) score += 20;  // 1-2 years
  else score += 10;                                // <1 year

  // 4. Salary Verification (30 points max)
  if (data.salary_verified) score += 30;

  return Math.min(score, 200);
}

// ===================================================================
// MAIN SCORING FUNCTION
// ===================================================================

/**
 * Calculate complete credit score using rule-based algorithm.
 *
 * Smartphone loans use a 5-component model (org verification = 0).
 * Digital loans use a 6-component model with redistributed weights,
 * reducing mobile money and external credit to make room for org verification.
 *
 * Returns:
 * - Raw score: 0-1000
 * - Scaled score: 300-850 (FICO-like)
 * - Decision: approve/review/reject
 * - Credit tier and limit
 */
export async function calculateRuleBasedScore(input: CreditScoreInput): Promise<CreditScoreResult> {
  const productCategory = input.product_category || 'smartphone';
  const weights = getScoringWeights(productCategory);

  // Calculate raw sub-scores (each on its own 0-maxPoints scale)
  const rawAffordability = scoreAffordability({
    monthly_income_usd: input.monthly_income_usd,
    existing_debt_obligations_usd: input.existing_debt_obligations_usd,
    household_size: input.household_size,
    dependents: input.dependents,
    requested_loan_amount: input.requested_loan_amount
  }); // 0-300

  const rawRepayment = scoreRepaymentWillingness(
    input.previous_loans_count !== undefined ? {
      previous_loans_count: input.previous_loans_count,
      on_time_payment_rate: input.on_time_payment_rate || 0,
      days_since_last_payment: 0,
      total_payments_made: 0,
      bill_payment_consistency: input.bill_payment_consistency || 0,
      communication_response_rate: input.communication_response_rate || 0
    } : null
  ); // 0-250

  const rawMobileMoney = scoreMobileMoneyActivity(input.mobile_money_profile || null); // 0-200
  const rawExternalCredit = scoreExternalCredit(input.external_credit_data || null); // 0-150
  const rawKyc = scoreKYCVerification(input.kyc_result); // 0-100
  const rawOrgVerification = calculateOrgVerificationScore(input.org_verification); // 0-200

  // Scale each component to its weighted allocation
  // For smartphone: standard max points = weight (no scaling needed for components 1-5, org=0)
  // For digital: scale mobile money (200->100), external credit (150->50), add org (0->200)
  const components = {
    affordability: Math.round((rawAffordability / 300) * weights.affordability),
    repayment_willingness: Math.round((rawRepayment / 250) * weights.repayment),
    mobile_money: Math.round((rawMobileMoney / 200) * weights.mobileMoney),
    external_credit: Math.round((rawExternalCredit / 150) * weights.externalCredit),
    kyc_verification: Math.round((rawKyc / 100) * weights.kycVerification),
    org_verification: weights.orgVerification > 0
      ? Math.round((rawOrgVerification / 200) * weights.orgVerification)
      : 0,
  };

  // Calculate total raw score (0-1000)
  const total_raw_score = Object.values(components).reduce((sum, score) => sum + score, 0);

  // Scale to 300-850 range (FICO-like)
  const scaled_score = Math.round(300 + (total_raw_score / 1000) * 550);

  // Determine decision based on scaled score (300-850)
  // Thresholds aligned with Fineract product configuration (source of truth)
  const MINIMUM_SCORE_THRESHOLD = 350;

  let decision: 'approve' | 'reject';
  let credit_limit_usd = 0;
  let tier = '';
  let down_payment_percentage = 0;
  let interest_rate_apr = 0;

  if (scaled_score < MINIMUM_SCORE_THRESHOLD) {
    decision = 'reject';
    tier = 'Below Minimum';
  } else if (scaled_score >= 650) {
    decision = 'approve';
    credit_limit_usd = 2000;
    tier = 'Tier 3';
    down_payment_percentage = 10;
    interest_rate_apr = 3; // 2-4% APR range, use midpoint
  } else if (scaled_score >= 500) {
    decision = 'approve';
    credit_limit_usd = 500;
    tier = 'Tier 2';
    down_payment_percentage = 20;
    interest_rate_apr = 4; // 3-5% APR range, use midpoint
  } else {
    decision = 'approve';
    credit_limit_usd = 200;
    tier = 'Tier 1';
    down_payment_percentage = 30;
    interest_rate_apr = 5; // 4-6% APR range, use midpoint
  }

  return {
    customer_id: input.customer_id,
    product_category: productCategory,
    total_raw_score,
    scaled_score,
    components,
    decision,
    credit_limit_usd,
    tier,
    down_payment_percentage,
    interest_rate_apr,
    calculated_at: new Date().toISOString()
  };
}
