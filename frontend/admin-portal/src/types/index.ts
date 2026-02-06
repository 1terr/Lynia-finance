// ============================================================
// Admin Portal Type Definitions
// ============================================================

// --- Admin Users & Auth ---

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'operations_manager'
  | 'customer_support'
  | 'finance_team'
  | 'kyc_reviewer'
  | 'inventory_manager'
  | 'reports_viewer';

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
}

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

export interface Device {
  id: string;
  device_imei: string;
  device_brand: string;
  device_model: string;
  device_value_usd: number;
  lock_status: LockStatus;
  status: DeviceStatus;
  trustonic_device_id: string | null;
  trustonic_enrolled: boolean;
  created_at: string;
  updated_at: string;
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
  payment_date: string;
  created_at: string;
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
  smile_identity_result: Record<string, unknown> | null;
  extracted_first_name: string | null;
  extracted_last_name: string | null;
  extracted_date_of_birth: string | null;
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
