import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/clients/database';

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

interface SmileIdentityResult {
  id_verification: {
    status: 'verified' | 'review' | 'failed';
  };
  face_match: {
    confidence: number; // 0-1
  };
  liveness: {
    status: 'passed' | 'failed';
  };
}

interface CreditScoreInput {
  customer_id: string;

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

  // KYC data
  kyc_result: SmileIdentityResult;
}

interface CreditScoreResult {
  customer_id: string;
  total_raw_score: number; // 0-1000
  scaled_score: number; // 300-850
  components: {
    affordability: number; // 0-300
    repayment_willingness: number; // 0-250
    mobile_money: number; // 0-200
    external_credit: number; // 0-150
    kyc_verification: number; // 0-100
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
 * Basic identity verification using Smile Identity API.
 */
function scoreKYCVerification(kycResult: SmileIdentityResult): number {
  let score = 0;

  // 1. ID Document Verification (50 points)
  if (kycResult.id_verification.status === 'verified') {
    score += 50;
  } else if (kycResult.id_verification.status === 'review') {
    score += 25;
  }

  // 2. Selfie-ID Match (35 points)
  const faceMatchScore = kycResult.face_match.confidence;
  if (faceMatchScore >= 0.95) score += 35;
  else if (faceMatchScore >= 0.85) score += 25;
  else if (faceMatchScore >= 0.75) score += 15;

  // 3. Liveness Check (15 points)
  if (kycResult.liveness.status === 'passed') {
    score += 15;
  }

  return Math.min(score, 100);
}

// ===================================================================
// MAIN SCORING FUNCTION
// ===================================================================

/**
 * Calculate complete credit score using 5-component rule-based algorithm
 *
 * Returns:
 * - Raw score: 0-1000
 * - Scaled score: 300-850 (FICO-like)
 * - Decision: approve/review/reject
 * - Credit tier and limit
 */
async function calculateRuleBasedScore(input: CreditScoreInput): Promise<CreditScoreResult> {
  // Calculate each component (total raw score: 0-1000)
  const components = {
    affordability: scoreAffordability({
      monthly_income_usd: input.monthly_income_usd,
      existing_debt_obligations_usd: input.existing_debt_obligations_usd,
      household_size: input.household_size,
      dependents: input.dependents,
      requested_loan_amount: input.requested_loan_amount
    }), // 0-300

    repayment_willingness: scoreRepaymentWillingness(
      input.previous_loans_count !== undefined ? {
        previous_loans_count: input.previous_loans_count,
        on_time_payment_rate: input.on_time_payment_rate || 0,
        days_since_last_payment: 0,
        total_payments_made: 0,
        bill_payment_consistency: input.bill_payment_consistency || 0,
        communication_response_rate: input.communication_response_rate || 0
      } : null
    ), // 0-250

    mobile_money: scoreMobileMoneyActivity(input.mobile_money_profile || null), // 0-200

    external_credit: scoreExternalCredit(input.external_credit_data || null), // 0-150

    kyc_verification: scoreKYCVerification(input.kyc_result) // 0-100
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
    } else if (path.startsWith('/scoring/') && method === 'GET') {
      const customerId = event.pathParameters?.customerId;
      return await handleGetScore(customerId!);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://admin.lynia.finance'
      }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://admin.lynia.finance'
      }
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }

  if (!body.monthly_income_usd || !body.requested_loan_amount || !body.kyc_result) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required fields: monthly_income_usd, requested_loan_amount, kyc_result'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
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
        total_raw_score: scoreResult.total_raw_score,
        scaled_score: scoreResult.scaled_score,
        components: scoreResult.components,
        decision: scoreResult.decision,
        credit_limit_usd: scoreResult.credit_limit_usd,
        tier: scoreResult.tier,
        down_payment_percentage: scoreResult.down_payment_percentage,
        interest_rate_apr: scoreResult.interest_rate_apr,
        calculated_at: scoreResult.calculated_at
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

  return {
    statusCode: 200,
    body: JSON.stringify(scoreResult),
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
  };
}

/**
 * GET /scoring/{customerId}
 *
 * Get existing credit score for a customer
 */
async function handleGetScore(customerId: string): Promise<APIGatewayProxyResult> {
  if (!customerId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'customerId is required' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  } catch (error) {
    console.error('Database error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch credit score',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
}
