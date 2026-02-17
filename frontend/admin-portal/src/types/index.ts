// ============================================================
// Admin Portal Type Definitions
// ============================================================

// --- Admin Users & Auth ---

// Re-export canonical auth types from types/auth.ts to avoid divergent definitions (HIGH-02)
export type { AdminRole, Permission, AdminUser } from './auth';
export { ROLE_PERMISSIONS, ADMIN_ROLES, isValidAdminRole } from './auth';

export type PermissionAction =
  | 'view'
  | 'read'
  | 'write'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'lock'
  | 'unlock'
  | 'reconcile'
  | 'refund'
  | 'export'
  | 'send';

// --- Customers ---

export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type KYCStatus = 'pending' | 'submitted' | 'verified' | 'rejected';
export type EmploymentStatus = 'employed' | 'self_employed' | 'unemployed' | 'student';

export interface Customer {
  id: string;
  phone_number: string;
  email: string | null;
  full_name: string;
  date_of_birth: string | null;
  physical_address: string | null;
  employment_status: EmploymentStatus | null;
  monthly_income_usd: number | null;
  kyc_status: KYCStatus;
  credit_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

// --- Loans ---

export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'paid_off'
  | 'defaulted'
  | 'rejected';

export interface Loan {
  id: string;
  customer_id: string;
  product_id: string;
  device_id: string | null;
  loan_amount_usd: number;
  interest_rate: number;
  loan_term_months: number;
  monthly_installment_usd: number;
  total_amount_due_usd: number;
  outstanding_balance_usd: number;
  loan_status: LoanStatus;
  disbursement_date: string | null;
  maturity_date: string | null;
  next_payment_date: string | null;
  days_past_due: number;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

// --- Devices ---

export type DeviceStatus = 'in_stock' | 'allocated' | 'active' | 'locked' | 'returned' | 'damaged';
export type LockStatus = 'unlocked' | 'locked' | 'pending';

export type DeviceCondition = 'new' | 'grade_a' | 'grade_b' | 'grade_c';

export interface Device {
  id: string;
  device_imei: string;
  serial_number: string | null;
  device_brand: string;
  device_model: string;
  device_type: string;
  storage_gb: number | null;
  color: string | null;
  condition: DeviceCondition;
  purchase_price_usd: number | null;
  device_value_usd: number;
  loan_id: string | null;
  customer_id: string | null;
  assigned_at: string | null;
  lock_status: LockStatus;
  locked_at: string | null;
  lock_reason: string | null;
  status: DeviceStatus;
  location: string | null;
  trustonic_device_id: string | null;
  trustonic_enrolled: boolean;
  trustonic_enrolled_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  loan?: Loan;
}

// --- Payments ---

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'ecocash' | 'onemoney' | 'cash' | 'bank_transfer';
export type PaymentType = 'deposit' | 'installment' | 'late_fee' | 'early_payoff';

export interface Payment {
  id: string;
  loan_id: string;
  customer_id: string;
  payment_amount_usd: number;
  payment_method: PaymentMethod;
  payment_type: PaymentType;
  payment_status: PaymentStatus;
  transaction_reference: string | null;
  reference_number: string | null;
  payment_date: string;
  confirmed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  provider_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  loan?: Loan;
}

// --- KYC ---

export interface KYCSubmission {
  id: string;
  customer_id: string;
  status: 'pending_review' | 'approved' | 'rejected';
  id_document_front_url: string | null;
  id_document_back_url: string | null;
  selfie_image_url: string | null;
  kyc_provider: 'smile_identity' | 'didit' | null;
  provider_response: Record<string, unknown> | null;
  smile_identity_result: Record<string, unknown> | null;
  extracted_first_name: string | null;
  extracted_last_name: string | null;
  extracted_date_of_birth: string | null;
  verification_decision: string | null;
  verification_confidence: number | null;
  face_match_score: number | null;
  liveness_score: number | null;
  created_at: string;
  customer?: Customer;
}

// --- Credit Scores ---

export interface CreditScoreComponents {
  affordability: number;
  repayment_willingness: number;
  mobile_money: number;
  external_credit: number;
  kyc_verification: number;
}

export interface CreditScore {
  id: string;
  customer_id: string;
  total_score: number;
  scaled_score: number;
  components: CreditScoreComponents;
  decision: 'approve' | 'review' | 'reject';
  credit_limit: number;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  calculated_at: string;
}

// --- Device Locks ---

export interface DeviceLock {
  id: string;
  device_id: string;
  loan_id: string | null;
  customer_id: string | null;
  action: 'lock' | 'unlock' | 'emergency_unlock';
  reason: string | null;
  lock_type: 'auto_payment_missed' | 'manual_admin' | 'test';
  days_past_due: number | null;
  executed_at: string | null;
  executed_by: string | null;
  execution_status: 'pending' | 'success' | 'failed';
  lock_provider: string | null;
  provider_response: Record<string, unknown> | null;
  created_at: string;
}

// --- Distributors ---

export type DistributorStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface Distributor {
  id: string;
  business_name: string;
  contact_person: string;
  phone_number: string;
  email: string | null;
  physical_address: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  commission_rate: number;
  status: DistributorStatus;
  approved_at: string | null;
  approved_by: string | null;
  total_devices_sold: number;
  total_commission_earned_usd: number;
  created_at: string;
  updated_at: string;
}

// --- System Config ---

export interface SystemConfig {
  id: string;
  config_key: string;
  config_value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Audit Log ---

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_type: 'admin' | 'customer' | 'system';
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// --- Loan Products ---

export interface LoanProduct {
  id: string;
  product_name: string;
  product_code: string;
  min_amount_usd: number;
  max_amount_usd: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate_annual: number;
  deposit_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Notifications ---

export interface Notification {
  id: string;
  customer_id: string;
  notification_type: 'sms' | 'whatsapp' | 'email' | 'push';
  template_name: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  created_at: string;
}

// --- Dashboard Metrics ---

export interface DashboardMetrics {
  total_customers: number;
  active_loans: number;
  total_disbursed_usd: number;
  outstanding_balance_usd: number;
  collection_rate: number;
  default_rate: number;
  devices_in_stock: number;
  devices_active: number;
  devices_locked: number;
  pending_kyc: number;
  pending_approvals: number;
  monthly_revenue_usd: number;
  overdue_payments: number;
  overdue_amount_usd: number;
  new_customers_this_month: number;
}

export interface PortfolioAtRisk {
  par_0_30: number;
  par_31_60: number;
  par_61_90: number;
  par_90_plus: number;
}

export interface DailyTrend {
  date: string;
  disbursements: number;
  collections: number;
  new_customers: number;
}

export interface LoansByStatus {
  status: LoanStatus;
  count: number;
  total_amount: number;
}

export interface RecentActivity {
  id: string;
  event_type: string;
  description: string;
  resource_type: string;
  resource_id: string;
  created_at: string;
  admin_name?: string;
}

// --- API Response ---

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// --- Pagination ---

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// --- Navigation ---

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: NavItem[];
  roles?: AdminRole[];
}
