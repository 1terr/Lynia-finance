/**
 * Shared TypeScript Types for Lynia Finance Microservices
 */

// =====================================================
// DATABASE TYPES
// =====================================================

export interface Customer {
  id: string;
  national_id: string;
  full_name: string;
  date_of_birth: string;
  phone_number: string;
  whatsapp_number?: string;
  email?: string;
  physical_address: string;
  employment_status: 'employed' | 'self_employed' | 'unemployed' | 'student';
  monthly_income_usd: number;
  kyc_status: 'pending' | 'verified' | 'rejected';
  kyc_verified_at?: string;
  credit_score?: number;
  risk_level?: 'low' | 'medium' | 'high';
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at: string;
}

export type Currency = 'USD' | 'ZWL' | 'ZAR';

export interface Loan {
  id: string;
  customer_id: string;
  product_id: string;
  device_id?: string;
  loan_amount_usd: number;
  interest_rate: number;
  loan_term_months: number;
  monthly_installment_usd: number;
  total_amount_due_usd: number;
  outstanding_balance_usd: number;
  currency: Currency;
  loan_status: 'pending' | 'approved' | 'active' | 'paid_off' | 'defaulted';
  disbursement_date?: string;
  maturity_date?: string;
  next_payment_date?: string;
  days_past_due: number;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  device_imei: string;
  device_brand: string;
  device_model: string;
  device_value_usd: number;
  lock_status: 'unlocked' | 'locked' | 'pending';
  locked_at?: string;
  unlocked_at?: string;
  lock_reason?: string;
  trustonic_device_id?: string;
  trustonic_enrolled: boolean;
  trustonic_enrolled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  loan_id: string;
  customer_id: string;
  payment_amount_usd: number;
  currency: Currency;
  payment_method: 'ecocash' | 'onemoney' | 'cash' | 'bank_transfer';
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_reference?: string;
  payment_date: string;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
  inverse_rate: number;
  source: 'RBZ' | 'INTERBANK';
  effective_date: string;
  fetched_at: string;
  created_at: string;
}

export interface KYCVerification {
  id: string;
  customer_id: string;
  verification_type: 'national_id' | 'selfie' | 'liveness';
  verification_status: 'pending' | 'verified' | 'rejected';
  smile_job_id?: string;
  smile_result?: Record<string, unknown>;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceLock {
  id: string;
  device_id: string;
  action: 'lock' | 'unlock';
  reason: string;
  executed_at: string;
  execution_status: 'success' | 'failed' | 'pending';
  lock_provider: 'trustonic' | 'manual';
  executed_by?: string;
  error_message?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  customer_id: string;
  notification_type: 'sms' | 'whatsapp' | 'email' | 'push';
  template_name: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

// =====================================================
// API TYPES
// =====================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreditScoreRequest {
  customerId: string;
}

export interface CreditScoreResponse {
  customerId: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high';
  max_loan_amount: number;
  calculated_at: string;
}

export interface SendWhatsAppRequest {
  to: string;
  message: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface InitiateKYCRequest {
  customerId: string;
  idNumber: string;
  idType: 'national_id' | 'passport';
}

export interface ProcessPaymentRequest {
  loanId: string;
  customerId: string;
  amount: number;
  paymentMethod: 'ecocash' | 'onemoney';
  phoneNumber: string;
}

export interface LockDeviceRequest {
  deviceId: string;
  reason: string;
  automated: boolean;
}

export interface UnlockDeviceRequest {
  deviceId: string;
  reason: string;
}

export interface SendNotificationRequest {
  customerId: string;
  channel: 'sms' | 'whatsapp' | 'email';
  templateName: string;
  templateParams?: Record<string, string>;
  message?: string;
}

// =====================================================
// LAMBDA EVENT TYPES
// =====================================================

export interface ScheduledLockEvent {
  source: 'aws.events';
  'detail-type': 'Scheduled Event';
}

// =====================================================
// EXTERNAL API TYPES
// =====================================================

export interface TrustonicLockRequest {
  device_id: string;
  lock_message: string;
  lock_reason: string;
  allow_emergency_calls: boolean;
  emergency_numbers: string[];
}

export interface TrustonicUnlockRequest {
  device_id: string;
  unlock_reason: string;
}

export interface SmileIDVerificationRequest {
  partner_id: string;
  id_number: string;
  id_type: string;
  callback_url: string;
}

export interface EcocashPaymentRequest {
  merchant_id: string;
  amount: number;
  phone_number: string;
  reference: string;
}

export interface OnemoneyPaymentRequest {
  merchant_id: string;
  amount: number;
  phone_number: string;
  reference: string;
}

// =====================================================
// WHATSAPP TYPES
// =====================================================

export interface WhatsAppMessage {
  id: string;
  customer_id: string;
  phone_number: string;
  message_type: 'text' | 'template' | 'interactive' | 'image' | 'document';
  direction: 'inbound' | 'outbound';
  content: string;
  whatsapp_message_id?: string;
  template_name?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConversation {
  id: string;
  customer_id: string;
  phone_number: string;
  conversation_state: 'idle' | 'loan_application' | 'kyc_verification' | 'payment' | 'support';
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppWebhookEvent {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'document' | 'interactive';
          text?: {
            body: string;
          };
          image?: {
            id: string;
            mime_type: string;
            sha256: string;
          };
          interactive?: {
            type: 'button_reply' | 'list_reply';
            button_reply?: {
              id: string;
              title: string;
            };
            list_reply?: {
              id: string;
              title: string;
            };
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: 'messages';
    }>;
  }>;
}

export interface WhatsAppSendMessageRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'template' | 'interactive';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: 'body' | 'header' | 'button';
      parameters: Array<{
        type: 'text';
        text: string;
      }>;
    }>;
  };
  interactive?: {
    type: 'button' | 'list';
    body: {
      text: string;
    };
    action: {
      buttons?: Array<{
        type: 'reply';
        reply: {
          id: string;
          title: string;
        };
      }>;
      button?: string;
      sections?: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string;
          description?: string;
        }>;
      }>;
    };
  };
}

export interface WhatsAppSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

// =====================================================
// KYC PROVIDER TYPES (re-exported from kyc-provider.ts)
// =====================================================

export type {
  KYCProvider,
  KYCProviderName,
  KYCSubmitParams,
  KYCSubmissionResponse,
  KYCVerificationResult,
  KYCExtractedInfo,
  KYCWarning,
  KYCDecision,
  KYCErrorResponse,
} from './kyc-provider';
