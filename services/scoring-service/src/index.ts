import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/clients/database';
import { getSecurityHeaders } from '../../shared/utils/response';
import { syncCustomerToFineract, syncLoanToFineract, approveLoanInFineract } from '../../shared/clients/fineract-sync';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

interface AffordabilityData {
  monthly_income_usd: number;
  existing_debt_obligations_usd: number;
  household_size: number;
  dependents: number;
  requested_loan_amount: number;
}

interface RepaymentData {
  previous_loans_count: number;
  on_time_payment_rate: number; // 0-1
  days_since_last_payment: number;
  total_payments_made: number;
  bill_payment_consistency: number; // 0-1
  communication_response_rate: number; // 0-1
}

interface MobileMoneyProfile {
  account_age_months: number;
  avg_monthly_inflow_usd: number;
  avg_monthly_outflow_usd: number;
  transaction_count_3m: number;
  balance_usd: number;
  airtime_purchases_3m: number;
  airtime_avg_per_purchase_usd: number;
}

interface ExternalCreditData {
  credit_bureau_score: number | null; // 300-850
  platform_verified: boolean; // Bolt/Uber driver
  platform_earnings_3m_usd: number;
  platform_rating: number; // 1-5 stars
  bank_account_verified: boolean;
  bank_account_age_months: number;
}

/**
 * Provider-agnostic KYC verification input for scoring.
 * All scores normalized to 0-100 scale.
 * Works with both Smile Identity and Didit providers.
 */
interface KYCVerificationInput {
  id_verification: {
    status: 'verified' | 'review' | 'failed';
  };
  face_match_score: number; // 0-100
  liveness_passed: boolean;
}

interface OrgVerificationData {
  scoring_trust_level: number;
  employment_status: string;
  tenure_months: number;
  salary_verified: boolean;
}

interface CreditScoreInput {
  customer_id: string;

  // Product category: 'smartphone' (default) or 'digital'
  product_category?: 'smartphone' | 'digital';

  // Affordability data
  monthly_income_usd: number;
  existing_debt_obligations_usd: number;
  household_size: number;
  dependents: number;
  requested_loan_amount: number;

  // Repayment willingness data (nullable for first-time customers)
  previous_loans_count?: number;
  on_time_payment_rate?: number;
  bill_payment_consistency?: number;
  communication_response_rate?: number;

  // Mobile money data (nullable)
  mobile_money_profile?: MobileMoneyProfile | null;

  // External credit data (nullable)
  external_credit_data?: ExternalCreditData | null;

  // KYC data (provider-agnostic)
  kyc_result: KYCVerificationInput;

  // Organization verification data (for digital loans)
  org_verification?: OrgVerificationData | null;
}

interface ScoringWeights {
  affordability: number;
  repayment: number;
  mobileMoney: number;
  externalCredit: number;
  kycVerification: number;
  orgVerification: number;
}

interface CreditScoreResult {
  customer_id: string;
  product_category: 'smartphone' | 'digital';
  total_raw_score: number; // 0-1000
  scaled_score: number; // 300-850
  components: {
    affordability: number;
    repayment_willingness: number;
    mobile_money: number;
    external_credit: number;
    kyc_verification: number;
    org_verification: number;
  };
  decision: 'approve' | 'review' | 'reject';
  credit_limit_usd: number;
  tier: string;
  down_payment_percentage: number;
  interest_rate_apr: number;
  calculated_at: string;
}

// ===================================================================
// SCORING FUNCTIONS - 5 COMPONENTS
// ===================================================================

/**
 * Component 1: Affordability Assessment (30%, 0-300 points)
 *
 * Determines if customer can afford monthly installment based on income.
 * Uses debt-to-income ratio as primary metric.
 */
function scoreAffordability(data: AffordabilityData): number {
  const loanTerm = 6; // months
  const estimatedInterestRate = 0.12; // 12% APR
  const monthlyInstallment = (data.requested_loan_amount * (1 + estimatedInterestRate)) / loanTerm;

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
function scoreRepaymentWillingness(data: RepaymentData | null): number {
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
function scoreMobileMoneyActivity(profile: MobileMoneyProfile | null): number {
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
function scoreExternalCredit(data: ExternalCreditData | null): number {
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
 * Works with both Smile Identity and Didit providers.
 * All input scores are on 0-100 scale.
 */
function scoreKYCVerification(kycResult: KYCVerificationInput): number {
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
 * by reducing mobile money (200→100) and external credit (150→50).
 * Total always sums to 1000.
 */
function getScoringWeights(productCategory: 'smartphone' | 'digital'): ScoringWeights {
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
function calculateOrgVerificationScore(data: OrgVerificationData | null | undefined): number {
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
async function calculateRuleBasedScore(input: CreditScoreInput): Promise<CreditScoreResult> {
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
  // For digital: scale mobile money (200→100), external credit (150→50), add org (0→200)
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
  let decision: 'approve' | 'review' | 'reject';
  let credit_limit_usd = 0;
  let tier = '';
  let down_payment_percentage = 10;
  let interest_rate_apr = 15;

  if (scaled_score >= 750) {
    decision = 'approve';
    credit_limit_usd = 500;
    tier = 'Tier 3';
    down_payment_percentage = 5;
    interest_rate_apr = 10;
  } else if (scaled_score >= 700) {
    decision = 'approve';
    credit_limit_usd = 350;
    tier = 'Tier 2';
    down_payment_percentage = 10;
    interest_rate_apr = 12;
  } else if (scaled_score >= 650) {
    decision = 'approve';
    credit_limit_usd = 200;
    tier = 'Tier 1';
    down_payment_percentage = 10;
    interest_rate_apr = 15;
  } else if (scaled_score >= 550) {
    decision = 'review';
    credit_limit_usd = 0;
    tier = 'Manual Review';
    down_payment_percentage = 0;
    interest_rate_apr = 0;
  } else {
    decision = 'reject';
    credit_limit_usd = 0;
    tier = 'Rejected';
    down_payment_percentage = 0;
    interest_rate_apr = 0;
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

// ===================================================================
// API HANDLER
// ===================================================================

/**
 * Scoring Service Lambda Handler
 *
 * Endpoints:
 * - POST /scoring/calculate - Calculate credit score
 * - POST /scoring/verify-organization - Verify organization membership
 * - GET /scoring/{customerId} - Get existing score
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // Route handling
    if (path === '/scoring/calculate' && method === 'POST') {
      return await handleCalculateScore(event);
    } else if (path === '/scoring/verify-organization' && method === 'POST') {
      return await handleVerifyOrganization(event);
    } else if (path.startsWith('/scoring/') && method === 'GET') {
      const customerId = event.pathParameters?.customerId;
      return await handleGetScore(customerId!, event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};

/**
 * POST /scoring/calculate
 *
 * Calculate credit score for a customer
 */
async function handleCalculateScore(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  // Validate required fields
  if (!body.customer_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'customer_id is required' }),
      headers: getSecurityHeaders(event)
    };
  }

  if (!body.monthly_income_usd || !body.requested_loan_amount || !body.kyc_result) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required fields: monthly_income_usd, requested_loan_amount, kyc_result'
      }),
      headers: getSecurityHeaders(event)
    };
  }

  // Calculate credit score
  const scoreResult = await calculateRuleBasedScore(body as CreditScoreInput);

  // Store score in database
  try {
    const { error: dbError } = await db
      .from('credit_scores')
      .insert({
        customer_id: scoreResult.customer_id,
        total_score: scoreResult.total_raw_score,
        scaled_score: scoreResult.scaled_score,
        affordability_score: scoreResult.components.affordability,
        repayment_willingness_score: scoreResult.components.repayment_willingness,
        mobile_money_score: scoreResult.components.mobile_money,
        external_credit_score: scoreResult.components.external_credit,
        kyc_verification_score: scoreResult.components.kyc_verification,
        scoring_data: scoreResult.components,
        decision: scoreResult.decision,
        credit_tier: scoreResult.tier,
        recommended_limit_usd: scoreResult.credit_limit_usd
      })
      .execute();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue even if database storage fails
    }
  } catch (dbError) {
    console.error('Failed to store score in database:', dbError);
    // Continue even if database storage fails
  }

  // Non-blocking: Sync approved customer and loan to Fineract core banking
  if (scoreResult.decision === 'approve' && process.env.FINERACT_SECRET_NAME) {
    syncApprovedCustomerToFineract(scoreResult.customer_id).catch((err) => {
      console.error('[fineract-sync] Background customer sync failed:', err);
    });
    syncApprovedLoanToFineract(scoreResult.customer_id, scoreResult).catch((err) => {
      console.error('[fineract-sync] Background loan sync failed:', err);
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify(scoreResult),
    headers: getSecurityHeaders(event)
  };
}

/**
 * GET /scoring/{customerId}
 *
 * Get existing credit score for a customer
 */
async function handleGetScore(customerId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!customerId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'customerId is required' }),
      headers: getSecurityHeaders(event)
    };
  }

  try {
    // Fetch most recent score from database
    const { data, error } = await db
      .from('credit_scores')
      .select('*')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    if (error || !data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Credit score not found for this customer' }),
        headers: getSecurityHeaders(event)
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch credit score',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

/**
 * POST /scoring/verify-organization
 *
 * Look up a customer's organization membership by phone number.
 * Called before /scoring/calculate to retrieve org verification data.
 */
async function handleVerifyOrganization(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  if (!body.phone_number) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'phone_number is required' }),
      headers: getSecurityHeaders(event)
    };
  }

  try {
    const { data: member, error } = await db
      .from('organization_members')
      .select('organization_id, employment_status, employment_start_date, salary_verified, monthly_salary_usd, customer_id')
      .eq('phone_number', body.phone_number)
      .limit(1)
      .single()
      .execute();

    if (error || !member) {
      return {
        statusCode: 200,
        body: JSON.stringify({ found: false }),
        headers: getSecurityHeaders(event)
      };
    }

    // Fetch the organization details
    const { data: org } = await db
      .from('organizations')
      .select('id, org_name, org_type, scoring_trust_level')
      .eq('id', member.organization_id)
      .eq('is_active', true)
      .single()
      .execute();

    if (!org) {
      return {
        statusCode: 200,
        body: JSON.stringify({ found: false }),
        headers: getSecurityHeaders(event)
      };
    }

    // Calculate tenure in months from employment_start_date
    let tenureMonths = 0;
    if (member.employment_start_date) {
      const startDate = new Date(member.employment_start_date);
      const now = new Date();
      tenureMonths = (now.getFullYear() - startDate.getFullYear()) * 12
        + (now.getMonth() - startDate.getMonth());
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        found: true,
        organization_id: org.id,
        org_name: org.org_name,
        org_type: org.org_type,
        scoring_trust_level: org.scoring_trust_level,
        employment_status: member.employment_status || 'active',
        employment_start_date: member.employment_start_date,
        tenure_months: tenureMonths,
        salary_verified: member.salary_verified || false,
        monthly_salary_usd: member.monthly_salary_usd || 0,
      }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    console.error('Organization verification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to verify organization membership',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}

// ===================================================================
// FINERACT SYNC (NON-BLOCKING)
// ===================================================================

/**
 * Sync an approved customer to Fineract core banking.
 * Non-blocking: errors are logged but never propagate to the caller.
 * If Fineract is down, the reconciliation job will retry later.
 */
async function syncApprovedCustomerToFineract(customerId: string): Promise<void> {
  try {
    const { data: customer } = await db
      .from('customers')
      .select('id, first_name, last_name, phone_number, date_of_birth, fineract_client_id')
      .eq('id', customerId)
      .single()
      .execute();

    if (!customer || customer.fineract_client_id) return;

    await syncCustomerToFineract({
      customerId: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      mobileNo: customer.phone_number,
    });
  } catch (error) {
    console.error(`[fineract-sync] Failed to sync customer ${customerId}:`, error);
  }
}

/**
 * Sync an approved loan to Fineract core banking.
 * Non-blocking: errors are logged but never propagate to the caller.
 * If Fineract is down or the loan doesn't exist yet, the reconciliation job will retry.
 */
async function syncApprovedLoanToFineract(customerId: string, scoreResult: CreditScoreResult): Promise<void> {
  try {
    const { data: customer } = await db
      .from('customers')
      .select('id, fineract_client_id')
      .eq('id', customerId)
      .single()
      .execute();

    if (!customer?.fineract_client_id) return;

    const { data: loan } = await db
      .from('loans')
      .select('id, fineract_loan_id, loan_amount_usd, term_months, product_id')
      .eq('customer_id', customerId)
      .is('fineract_loan_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    if (!loan) return;

    // Database-driven Fineract product mapping
    // Look up fineract_product_id from loan_products table when product_id is available
    let fineractProductId: number;
    if (loan.product_id) {
      try {
        const { data: loanProduct } = await db
          .from('loan_products')
          .select('fineract_product_id, product_category')
          .eq('id', loan.product_id)
          .single()
          .execute();

        if (loanProduct?.fineract_product_id) {
          fineractProductId = loanProduct.fineract_product_id;
        } else {
          // Fallback to tier mapping when fineract_product_id is not set
          const tierToProductId: Record<string, number> = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
          fineractProductId = tierToProductId[scoreResult.tier] || 1;
        }
      } catch {
        // Database query failed — fall back to tier mapping for resilience
        const tierToProductId: Record<string, number> = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
        fineractProductId = tierToProductId[scoreResult.tier] || 1;
      }
    } else {
      // Backward-compatible fallback for existing loans without product_id
      // Tier 1 Entry (LT1E) = 1, Tier 2 Standard (LT2S) = 2, Tier 3 Premium (LT3P) = 3
      const tierToProductId: Record<string, number> = { 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
      fineractProductId = tierToProductId[scoreResult.tier] || 1;
    }

    const fineractLoanId = await syncLoanToFineract({
      loanId: loan.id,
      customerId,
      fineractClientId: customer.fineract_client_id,
      fineractProductId,
      principal: loan.loan_amount_usd || scoreResult.credit_limit_usd,
      numberOfRepayments: loan.term_months || 6,
      repaymentEveryMonths: 1,
      interestRatePerMonth: scoreResult.interest_rate_apr / 12,
      expectedDisbursementDate: new Date(),
    });

    if (fineractLoanId) {
      await approveLoanInFineract({
        loanId: loan.id,
        fineractLoanId,
      });
    }
  } catch (error) {
    console.error(`[fineract-sync] Failed to sync loan for customer ${customerId}:`, error);
  }
}
