/**
 * WhatsApp Onboarding - Type Definitions
 *
 * Extracted from the onboarding monolith for modular state machine architecture.
 */

import type { SupportedLanguage } from '../i18n';

export type OnboardingState =
  | 'welcome'
  | 'phone_validation'
  | 'collecting_personal_info'
  | 'personal_info_name'
  | 'personal_info_dob'
  | 'personal_info_gender'
  | 'personal_info_location'
  | 'collecting_employment'
  | 'employment_type'
  | 'employment_income'
  | 'employment_debts'
  | 'employment_household'
  | 'product_selection'
  | 'kyc_id_upload'
  | 'kyc_selfie_upload'
  | 'kyc_processing'
  | 'credit_scoring'
  | 'device_selection'
  | 'term_selection'
  | 'loan_summary'
  | 'loan_offer'
  | 'terms_acceptance'
  | 'completed'
  | 'rejected';

export interface OnboardingSession {
  customer_id: string;
  phone_number: string;
  current_state: OnboardingState;
  state_data: {
    // Language preference
    preferred_language?: SupportedLanguage;

    // Personal info
    full_name?: string;
    date_of_birth?: string;
    gender?: 'male' | 'female' | 'other';
    location?: string;

    // Employment & Income
    employment_type?: string;
    monthly_income_usd?: number;
    existing_debt_obligations_usd?: number;
    household_size?: number;
    dependents?: number;

    // Product selection
    selected_product?: 'smartphone' | 'digital_credit';
    requested_loan_amount?: number;

    // KYC
    id_number?: string;
    id_photo_url?: string;
    selfie_photo_url?: string;
    kyc_verification_id?: string;
    kyc_status?: 'pending' | 'verified' | 'failed';

    // Credit scoring
    credit_score?: number;
    credit_tier?: string;
    credit_limit_usd?: number;
    down_payment_percentage?: number;
    interest_rate_apr?: number;
    decision?: 'approve' | 'reject';
    rejection_reason?: string;

    // Device selection
    available_devices?: Array<{
      id: string;
      brand: string;
      model_name: string;
      retail_price_usd: number;
    }>;
    selected_device_id?: string;
    selected_device_price?: number;
    selected_device_name?: string;
    resolved_product_id?: string;

    // Term selection
    selected_term_months?: number;
    allowed_terms?: number[];

    // Loan calculation
    monthly_payment?: number;
    total_repayment?: number;
    financed_amount?: number;
    deposit_amount?: number;

    // Loan record
    loan_id?: string;
    loan_number?: string;

    // Tracking
    retry_count?: number;
    started_at?: string;
  };
  last_activity_at: Date;
  created_at: Date;
}

export interface MessageContext {
  from: string;
  message: string;
  messageId: string;
  timestamp: number;
}
