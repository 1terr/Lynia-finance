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
  ExternalCreditData,
  KYCVerificationInput,
  OrgVerificationData,
  ScoringWeights,
  CreditScoreInput,
  CreditScoreResult,
} from './types';

// ===================================================================
// SCORING FUNCTIONS - 5 COMPONENTS
// ===================================================================

/**
 * Component 1: Affordability Assessment (250 points max)
 *
 * Uses org-verified salary for DTI if available, otherwise falls back
 * to a household-based heuristic. No longer requires monthly_income_usd.
 */
export function scoreAffordability(data: AffordabilityData): number {
  let score = 0;
  const loanAmount = data.requested_loan_amount || 0;

  // Salary-based DTI (if org-verified salary available) - 150pts
  if (data.org_verified_salary_usd && data.org_verified_salary_usd > 0) {
    // Monthly payment estimate (loan / 12 months conservative)
    const estimatedMonthlyPayment = loanAmount / 12;
    const dti = estimatedMonthlyPayment / data.org_verified_salary_usd;

    if (dti <= 0.20) score += 150;
    else if (dti <= 0.30) score += 120;
    else if (dti <= 0.40) score += 90;
    else if (dti <= 0.50) score += 60;
    else score += 30;
  } else {
    // No salary data: neutral score
    score += 75;
  }

  // Household Financial Capacity (100pts)
  const householdSize = data.household_size || 1;
  // Lower loan-to-household ratio is better
  const loanPerPerson = loanAmount / householdSize;
  if (loanPerPerson <= 50) score += 100;
  else if (loanPerPerson <= 100) score += 75;
  else if (loanPerPerson <= 200) score += 50;
  else score += 25;

  return Math.min(score, 250);
}

/**
 * Component 2: Repayment Willingness (150 points max)
 *
 * Assesses customer's willingness and history of making payments on time.
 * Returns neutral score (75) for first-time customers.
 */
export function scoreRepaymentWillingness(data: RepaymentData | null): number {
  if (!data || data.previous_loans_count === 0) {
    return 75; // Neutral score for first-time customers
  }

  let score = 0;

  // 1. Historical Repayment Performance (90 points max)
  if (data.on_time_payment_rate >= 0.95) score += 90; // Excellent
  else if (data.on_time_payment_rate >= 0.85) score += 72; // Good
  else if (data.on_time_payment_rate >= 0.75) score += 48; // Fair
  else if (data.on_time_payment_rate >= 0.60) score += 24; // Poor
  else score += 0; // Very poor

  // 2. Bill Payment Consistency (30 points max)
  if (data.bill_payment_consistency >= 0.90) score += 30;
  else if (data.bill_payment_consistency >= 0.75) score += 21;
  else if (data.bill_payment_consistency >= 0.60) score += 12;
  else score += 6;

  // 3. Communication Responsiveness (30 points max)
  if (data.communication_response_rate >= 0.90) score += 30;
  else if (data.communication_response_rate >= 0.75) score += 21;
  else if (data.communication_response_rate >= 0.60) score += 12;
  else score += 6;

  return Math.min(score, 150);
}

/**
 * Component 3: Device Collateral Coverage (100 points max)
 *
 * Score device collateral coverage for smartphone loans.
 * Uses retail price (not depreciated) since device is new at disbursement.
 * Digital loans get neutral score (no physical collateral).
 */
export function scoreDeviceCollateral(
  deviceRetailPriceUsd: number | undefined,
  requestedLoanAmount: number,
  productCategory: string
): number {
  // Digital loans: no device collateral, neutral score
  if (productCategory === 'digital' || !deviceRetailPriceUsd) return 50;

  const coverageRatio = deviceRetailPriceUsd / requestedLoanAmount;

  if (coverageRatio >= 1.0) return 100;   // Device fully covers loan
  if (coverageRatio >= 0.8) return 80;    // Strong coverage
  if (coverageRatio >= 0.6) return 60;    // Moderate coverage
  if (coverageRatio >= 0.4) return 40;    // Partial coverage
  return 20;                                // Weak coverage
}

/**
 * Component 4: External Credit Data (0-150 points)
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
 * Component 5: KYC Verification (150 points max)
 *
 * Provider-agnostic identity verification scoring.
 * Works with the DIDIT KYC provider.
 * All input scores are on 0-100 scale.
 */
export function scoreKYCVerification(kycResult: KYCVerificationInput): number {
  let score = 0;

  // 1. ID Document Verification (75 points)
  if (kycResult.id_verification.status === 'verified') {
    score += 75;
  } else if (kycResult.id_verification.status === 'review') {
    score += 37;
  }

  // 2. Selfie-ID Match (50 points) — score is 0-100
  const faceMatch = kycResult.face_match_score;
  if (faceMatch >= 95) score += 50;
  else if (faceMatch >= 85) score += 36;
  else if (faceMatch >= 75) score += 21;

  // 3. Liveness Check (25 points)
  if (kycResult.liveness_passed) {
    score += 25;
  }

  return Math.min(score, 150);
}

// ===================================================================
// SCORING WEIGHTS & ORGANIZATION VERIFICATION
// ===================================================================

/**
 * Get scoring component weights for credit scoring.
 *
 * Both smartphone and digital products use IDENTICAL weights.
 * Total always sums to 1000.
 */
export function getScoringWeights(_productCategory: 'smartphone' | 'digital'): ScoringWeights {
  return {
    orgVerification: 350,
    affordability: 250,
    kycVerification: 150,
    repayment: 150,
    deviceCollateral: 100,
    externalCredit: 0,
  };
}

/**
 * Organization Verification Score (350 points max)
 *
 * Scores based on 4 sub-factors:
 * - Organization trust level:  up to 120 pts
 * - Employment status:         up to 80 pts
 * - Employment tenure:         up to 70 pts
 * - Salary verification:       up to 80 pts
 *
 * Unaffiliated smartphone customers get neutral score (175).
 */
export function calculateOrgVerificationScore(data: OrgVerificationData | null | undefined): number {
  // Unaffiliated smartphone customers get neutral score
  if (!data) return 175;

  let score = 0;

  // 1. Organization Trust Level (120 points max)
  const trustLevel = data.scoring_trust_level ?? 0;
  if (trustLevel >= 80) score += 120;       // Government
  else if (trustLevel >= 60) score += 90;   // Corporate
  else if (trustLevel >= 40) score += 60;   // Cooperative
  else score += 30;                          // Other

  // 2. Employment Status (80 points max)
  const status = data.employment_status?.toLowerCase();
  if (status === 'active') score += 80;
  else if (status === 'retired') score += 40;
  // suspended/other = 0

  // 3. Employment Tenure (70 points max)
  const tenureMonths = data.tenure_months ?? 0;
  if (tenureMonths >= 60) score += 70;       // >=5 years
  else if (tenureMonths >= 24) score += 55;  // >=2 years
  else if (tenureMonths >= 12) score += 35;  // >=1 year
  else score += 15;                           // <1 year

  // 4. Salary Verification (80 points max)
  if (data.salary_verified) score += 80;

  return score;
}

// ===================================================================
// MAIN SCORING FUNCTION
// ===================================================================

/**
 * Calculate complete credit score using rule-based algorithm.
 *
 * Both smartphone and digital loans use a unified 5-component model
 * with identical weights. Organization verification is the primary
 * differentiator (unaffiliated customers get neutral 175/350).
 *
 * Returns:
 * - Raw score: 0-1000
 * - Scaled score: 300-850 (FICO-like)
 * - Decision: approve/reject
 * - Credit tier and limit
 */
export async function calculateRuleBasedScore(input: CreditScoreInput): Promise<CreditScoreResult> {
  const productCategory = input.product_category || 'smartphone';
  const weights = getScoringWeights(productCategory);

  // Calculate raw sub-scores (each on its own 0-maxPoints scale)
  const rawAffordability = scoreAffordability({
    org_verified_salary_usd: input.org_verified_salary_usd,
    device_retail_price_usd: input.device_retail_price_usd,
    household_size: input.household_size,
    dependents: input.dependents,
    requested_loan_amount: input.requested_loan_amount
  }); // 0-250

  const rawRepayment = scoreRepaymentWillingness(
    input.previous_loans_count !== undefined ? {
      previous_loans_count: input.previous_loans_count,
      on_time_payment_rate: input.on_time_payment_rate || 0,
      days_since_last_payment: 0,
      total_payments_made: 0,
      bill_payment_consistency: input.bill_payment_consistency || 0,
      communication_response_rate: input.communication_response_rate || 0
    } : null
  ); // 0-150

  const rawDeviceCollateral = scoreDeviceCollateral(
    input.device_retail_price_usd,
    input.requested_loan_amount,
    productCategory
  ); // 0-100
  const rawExternalCredit = scoreExternalCredit(input.external_credit_data || null); // 0-150
  const rawKyc = scoreKYCVerification(input.kyc_result); // 0-150
  const rawOrgVerification = calculateOrgVerificationScore(input.org_verification); // 0-350

  // Scale each component to its weighted allocation
  const components = {
    affordability: Math.round((rawAffordability / 250) * weights.affordability),
    repayment_willingness: Math.round((rawRepayment / 150) * weights.repayment),
    device_collateral: Math.round((rawDeviceCollateral / 100) * weights.deviceCollateral),
    external_credit: Math.round((rawExternalCredit / 150) * weights.externalCredit),
    kyc_verification: Math.round((rawKyc / 150) * weights.kycVerification),
    org_verification: Math.round((rawOrgVerification / 350) * weights.orgVerification),
  };

  // Calculate total raw score (0-1000)
  const total_raw_score = Object.values(components).reduce((sum, score) => sum + score, 0);

  // Scale to 300-850 range (FICO-like)
  const scaled_score = Math.round(300 + (total_raw_score / 1000) * 550);

  // Per-product approval thresholds
  const approvalThreshold = productCategory === 'digital' ? 450 : 350;

  let decision: 'approve' | 'reject';

  // Defense-in-depth: auto-reject if KYC identity verification failed.
  // Even if the WhatsApp flow guard is bypassed (e.g. direct API call),
  // we must never approve a customer whose identity is not verified.
  if (input.kyc_result.id_verification.status === 'failed') {
    return {
      customer_id: input.customer_id,
      product_category: productCategory,
      total_raw_score,
      scaled_score,
      components,
      decision: 'reject',
      credit_limit_usd: 0,
      tier: 'KYC Not Verified',
      down_payment_percentage: 0,
      interest_rate_apr: 0,
      calculated_at: new Date().toISOString()
    };
  }

  if (scaled_score < approvalThreshold) {
    decision = 'reject';
  } else {
    decision = 'approve';
  }

  // Determine tier and default terms based on scaled score.
  // These serve as fallback defaults; the handler layer may override them
  // with product-specific values from the product eligibility resolver.
  let tier: string;
  let credit_limit_usd: number;
  let down_payment_percentage: number;
  let interest_rate_apr: number;

  if (decision === 'reject') {
    tier = 'Below Minimum';
    credit_limit_usd = 0;
    down_payment_percentage = 0;
    interest_rate_apr = 0;
  } else if (scaled_score >= 650) {
    tier = 'Tier 3';
    credit_limit_usd = 2000;
    down_payment_percentage = 10;
    interest_rate_apr = 3;
  } else if (scaled_score >= 500) {
    tier = 'Tier 2';
    credit_limit_usd = 500;
    down_payment_percentage = 20;
    interest_rate_apr = 4;
  } else {
    tier = 'Tier 1';
    credit_limit_usd = 200;
    down_payment_percentage = 30;
    interest_rate_apr = 5;
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
