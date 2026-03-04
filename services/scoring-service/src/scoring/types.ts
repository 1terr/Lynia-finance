/**
 * Scoring Service Type Definitions
 *
 * All types used by the credit scoring algorithm. Extracted from the
 * monolith to enable independent testing of the scoring engine.
 */

export interface AffordabilityData {
  monthly_income_usd: number;
  existing_debt_obligations_usd: number;
  household_size: number;
  dependents: number;
  requested_loan_amount: number;
}

export interface RepaymentData {
  previous_loans_count: number;
  on_time_payment_rate: number; // 0-1
  days_since_last_payment: number;
  total_payments_made: number;
  bill_payment_consistency: number; // 0-1
  communication_response_rate: number; // 0-1
}

export interface MobileMoneyProfile {
  account_age_months: number;
  avg_monthly_inflow_usd: number;
  avg_monthly_outflow_usd: number;
  transaction_count_3m: number;
  balance_usd: number;
  airtime_purchases_3m: number;
  airtime_avg_per_purchase_usd: number;
}

export interface ExternalCreditData {
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
 * Works with DIDIT KYC provider.
 */
export interface KYCVerificationInput {
  id_verification: {
    status: 'verified' | 'review' | 'failed';
  };
  face_match_score: number; // 0-100
  liveness_passed: boolean;
}

export interface OrgVerificationData {
  scoring_trust_level: number;
  employment_status: string;
  tenure_months: number;
  salary_verified: boolean;
}

export interface CreditScoreInput {
  customer_id: string;

  // Product category: 'smartphone' (default) or 'digital'
  product_category?: 'smartphone' | 'digital';

  // Affordability data
  monthly_income_usd: number;
  existing_debt_obligations_usd: number;
  household_size: number;
  dependents: number;
  requested_loan_amount: number;

  // Employment context (stored in scoring_data for future scoring use)
  employment_type?: string;

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

export interface ScoringWeights {
  affordability: number;
  repayment: number;
  mobileMoney: number;
  externalCredit: number;
  kycVerification: number;
  orgVerification: number;
}

export interface CreditScoreResult {
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
  decision: 'approve' | 'reject';
  credit_limit_usd: number;
  tier: string;
  down_payment_percentage: number;
  interest_rate_apr: number;
  calculated_at: string;
}
