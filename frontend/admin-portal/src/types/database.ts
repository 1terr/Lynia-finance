export interface Database {
  public: {
    Tables: {
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Customer, 'id'>>;
      };
      loans: {
        Row: Loan;
        Insert: Omit<Loan, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Loan, 'id'>>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Payment, 'id'>>;
      };
      kyc_submissions: {
        Row: KYCSubmission;
        Insert: Omit<KYCSubmission, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<KYCSubmission, 'id'>>;
      };
      customer_timeline: {
        Row: TimelineEvent;
        Insert: Omit<TimelineEvent, 'id' | 'created_at'>;
        Update: Partial<Omit<TimelineEvent, 'id'>>;
      };
      customer_notes: {
        Row: CustomerNote;
        Insert: Omit<CustomerNote, 'note_id' | 'created_at'>;
        Update: Partial<Omit<CustomerNote, 'note_id'>>;
      };
      devices: {
        Row: Device;
        Insert: Omit<Device, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Device, 'id'>>;
      };
      device_assignments: {
        Row: DeviceAssignment;
        Insert: Omit<DeviceAssignment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DeviceAssignment, 'id'>>;
      };
    };
  };
}

export interface Customer {
  id: string;
  phone_number: string;
  national_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  email: string | null;
  whatsapp_number: string | null;
  province: string | null;
  city: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  employment_status: 'employed' | 'self_employed' | 'unemployed' | 'student' | null;
  employment_type: string | null;
  monthly_income_usd: number | null;
  household_size: number | null;
  dependents: number | null;
  credit_limit: number;
  credit_score: number | null;
  credit_tier: number;
  total_loans: number;
  active_loans: number;
  completed_loans: number;
  defaulted_loans: number;
  total_borrowed: number;
  total_repaid: number;
  kyc_status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  kyc_verified_at: string | null;
  kyc_expires_at: string | null;
  fineract_client_id: string | null;
  fineract_account_number: string | null;
  status: 'active' | 'inactive' | 'blocked';
  blocked_reason: string | null;
  referral_code: string | null;
  referred_by: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Loan {
  id: string;
  customer_id: string;
  device_id: string | null;
  distributor_id: string | null;
  product_id: string | null;
  principal: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  total_repayment: number;
  status: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'disbursed' | 'active' | 'paid' | 'defaulted' | 'written_off';
  outstanding_principal: number;
  outstanding_interest: number;
  total_paid: number;
  last_payment_date: string | null;
  next_payment_date: string | null;
  missed_payments: number;
  days_overdue: number;
  credit_score_at_application: number | null;
  approval_reason: string | null;
  rejection_reason: string | null;
  auto_approved: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  completed_at: string | null;
  device_imei: string | null;
  application_source: 'whatsapp' | 'admin' | 'api';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payment {
  id: string;
  loan_id: string;
  customer_id: string;
  payment_type: 'deposit' | 'installment' | 'late_fee' | 'early_payoff';
  amount_usd: number;
  currency: string;
  payment_method: 'ecocash' | 'onemoney' | 'bank_transfer' | 'cash';
  payment_provider: string | null;
  transaction_id: string | null;
  reference_number: string | null;
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  confirmed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  principal_amount: number | null;
  interest_amount: number | null;
  penalty_amount: number | null;
  fee_amount: number | null;
  payment_date: string;
  phone_number: string | null;
  payer_name: string | null;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface KYCSubmission {
  id: string;
  customer_id: string;
  document_type: 'national_id' | 'passport' | 'drivers_license';
  document_number: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string | null;
  smile_job_id: string | null;
  smile_result: SmileIdentityResult | null;
  smile_confidence_score: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'manual_review';
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  manual_review_notes: string | null;
  liveness_passed: boolean | null;
  liveness_score: number | null;
  image_quality_score: number | null;
  document_readable: boolean | null;
  attempt_number: number;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface SmileIdentityResult {
  face_match: boolean;
  liveness_check: boolean;
  id_validation: boolean;
  confidence: number;
}

export interface TimelineEvent {
  id: string;
  customer_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface CustomerNote {
  note_id: string;
  customer_id: string;
  note_type: 'general' | 'support' | 'collections' | 'fraud_alert';
  note_text: string;
  is_important: boolean;
  is_internal: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface CreditScoreHistory {
  id: string;
  customer_id: string;
  score: number;
  tier: number;
  reason: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  sku: string;
  imei: string | null;
  ram_gb: number | null;
  storage_gb: number | null;
  screen_size: number | null;
  battery_mah: number | null;
  camera_mp: string | null;
  processor: string | null;
  os: string | null;
  cost_price: number;
  retail_price: number;
  financing_price: number;
  deposit_amount: number;
  primary_image_url: string | null;
  image_urls: string[] | null;
  status: 'available' | 'reserved' | 'assigned' | 'sold' | 'damaged' | 'returned';
  distributor_id: string | null;
  warehouse_location: string | null;
  lock_provider: string | null;
  lock_provider_id: string | null;
  lock_enabled: boolean;
  featured: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DeviceAssignment {
  id: string;
  device_id: string;
  customer_id: string;
  loan_id: string;
  distributor_id: string;
  imei: string;
  serial_number: string | null;
  assigned_at: string;
  verified_by: string | null;
  id_verification_photo_url: string | null;
  device_condition_photo_url: string | null;
  customer_signature_url: string | null;
  lock_status: 'unlocked' | 'locked' | 'permanent_unlock';
  lock_provider: string | null;
  lock_provider_device_id: string | null;
  locked_at: string | null;
  locked_reason: string | null;
  unlocked_at: string | null;
  grace_period_ends_at: string | null;
  returned: boolean;
  returned_at: string | null;
  return_reason: string | null;
  return_condition: string | null;
  repossessed: boolean;
  repossessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceWithRelations extends Device {
  distributors?: {
    id: string;
    business_name: string;
    contact_person: string;
    phone_number: string;
    province: string;
    city: string;
  };
  device_assignments?: DeviceAssignment[];
}

export interface DeviceLockEvent {
  id: string;
  device_id: string;
  loan_id: string | null;
  action: 'lock' | 'unlock';
  reason: string;
  trigger_type: 'automated' | 'manual' | 'payment';
  triggered_by: string;
  trustonic_status: 'success' | 'failed' | 'pending';
  error_message: string | null;
  performed_at: string;
}

export interface DeviceHandover {
  id: string;
  loan_id: string;
  customer_id: string;
  device_id: string;
  distributor_id: string;
  status: 'initiated' | 'identity_verified' | 'deposit_verified' | 'device_inspected' | 'completed' | 'cancelled';
  identity_verified: boolean;
  deposit_verified: boolean;
  device_inspected: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithRelations extends Customer {
  kyc_submissions?: KYCSubmission[];
  loans?: Loan[];
  payments?: Payment[];
  credit_score_history?: CreditScoreHistory[];
  customer_notes?: CustomerNote[];
}
