// ============================================================
// Admin Portal Type Definitions
// ============================================================

// --- Admin Users & Auth ---

// Import for local use + re-export canonical auth types (HIGH-02)
import type { AdminRole, Permission, AdminUser } from './auth';
export type { AdminRole, Permission, AdminUser };
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
export type KYCStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
export type EmploymentStatus = 'employed' | 'self_employed' | 'unemployed' | 'student';

export interface Customer {
  id: string;
  phone_number: string;
  email: string | null;
  full_name: string;
  first_name?: string;
  last_name?: string;
  whatsapp_number?: string | null;
  national_id?: string;
  date_of_birth: string | null;
  gender?: string | null;
  physical_address: string | null;
  province?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postal_code?: string | null;
  employment_status: EmploymentStatus | null;
  employment_type?: string | null;
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
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'active'
  | 'paid'
  | 'defaulted'
  | 'written_off';

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

/** Standardized device status across all layers */
export type DeviceStatus =
  | 'in_stock'        // At warehouse, not assigned to any distributor
  | 'assigned'        // Assigned to distributor, awaiting handover
  | 'reserved'        // Held for approved loan (48h TTL)
  | 'sold'            // Handed over to customer, loan active
  | 'returned'        // Returned by customer (voluntary or repossession)
  | 'repossessed'     // Recovered via repossession process
  | 'damaged'         // Non-functional, needs assessment
  | 'lost'            // Cannot be located
  | 'written_off';    // Removed from inventory permanently

export type LockStatus = 'unlocked' | 'locked' | 'emergency_unlocked' | 'pending';

export type DeviceCondition = 'new' | 'grade_a' | 'grade_b' | 'grade_c';

export interface Device {
  id: string;
  imei: string;
  serial_number: string | null;
  manufacturer: string;
  model: string;
  device_type: string;
  storage_gb: number | null;
  color: string | null;
  condition: DeviceCondition;
  purchase_price_usd: number | null;
  retail_price_usd: number;
  device_model_id: string | null;
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

export type PaymentStatus = 'pending' | 'processing' | 'confirmed' | 'completed' | 'failed' | 'refunded';
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
  kyc_provider: 'didit' | null;
  provider_response: Record<string, unknown> | null;
  extracted_first_name: string | null;
  extracted_last_name: string | null;
  extracted_date_of_birth: string | null;
  verification_decision: string | null;
  verification_confidence: number | null;
  face_match_score: number | null;
  liveness_score: number | null;
  created_at: string;
  customer?: Customer;
  customers?: Customer;
  confidence_score?: number | null;
  submitted_at?: string;
  submission_number?: string;
  id_document_url?: string;
  selfie_url?: string;
  id_document_type?: string;
  id_number?: string;
  extracted_name?: string;
  extracted_id_number?: string;
  extracted_dob?: string;
  attempt_number?: number;
  kyc_manual_reviews?: KYCManualReview[];
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

export type DistributorStatus = 'active' | 'suspended' | 'inactive';

export interface Distributor {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  email: string | null;
  national_id: string | null;
  business_name: string;
  province: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  bank_name: string | null;
  account_number: string | null;
  mobile_money_number: string | null;
  commission_rate: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  pending_commissions: number;
  total_loans_disbursed: number;
  total_devices_distributed: number;
  current_inventory_count: number;
  average_rating: number;
  status: DistributorStatus;
  kyc_status: KYCStatus;
  kyc_verified_at: string | null;
  onboarded_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDistributorInput {
  business_name: string;
  contact_person: string;
  phone_number: string;
  email?: string;
  address_line1?: string;
  city?: string;
  province?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  ecocash_number?: string;
  onemoney_number?: string;
  commission_rate?: number;
  status?: DistributorStatus;
}

export interface DistributorInventoryItem {
  id: string;
  device_id: string;
  imei: string;
  manufacturer: string;
  model: string;
  retail_price_usd: number;
  status: string;
  device_status: string;
  condition: string;
  assigned_date: string;
  sold_date: string | null;
}

export interface DistributorHandover {
  id: string;
  loan_id: string;
  customer_id: string;
  device_id: string;
  customer_name: string;
  customer_phone: string;
  device_imei: string;
  device_model: string;
  status: string;
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DistributorTransfer {
  id: string;
  device_id: string;
  device_imei: string;
  manufacturer: string;
  device_model: string;
  from_distributor_name: string | null;
  to_distributor_name: string | null;
  from_location: string | null;
  to_location: string | null;
  status: string;
  requested_by_name: string | null;
  created_at: string;
}

export interface DistributorCommission {
  id: string;
  loan_id: string;
  device_id: string;
  device_imei: string | null;
  device_model: string | null;
  commission_amount_usd: number;
  commission_percentage: number;
  device_retail_price_usd: number;
  payment_status: string;
  created_at: string;
}

export interface DistributorStatsResponse {
  total: number;
  active: number;
  total_revenue_usd: number;
  total_devices_distributed: number;
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

export type ProductType = 'asset_financing' | 'digital_credit';
export type ProductCategory = 'smartphone' | 'digital';
export type ProductStatus = 'active' | 'inactive' | 'launching_soon';

export interface LoanProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_type: ProductType;
  product_category: ProductCategory;
  status: ProductStatus;
  min_amount_usd: number;
  max_amount_usd: number;
  loan_term_months: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate_annual: number;
  interest_rate_monthly: number;
  deposit_percentage: number;
  min_deposit_usd: number;
  requires_device: boolean;
  requires_organization_verification: boolean;
  allowed_disbursement_methods: string[];
  max_active_loans: number;
  display_order: number;
  description?: string;
  scoring_config?: Record<string, unknown>;
  fineract_product_id?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CreateProductInput {
  product_code: string;
  product_name: string;
  product_type: ProductType;
  product_category: ProductCategory;
  status?: ProductStatus;
  min_amount_usd: number;
  max_amount_usd: number;
  loan_term_months?: number;
  min_term_months: number;
  max_term_months: number;
  interest_rate_annual: number;
  interest_rate_monthly: number;
  deposit_percentage?: number;
  min_deposit_usd?: number;
  requires_device?: boolean;
  requires_organization_verification?: boolean;
  allowed_disbursement_methods?: string[];
  max_active_loans?: number;
  display_order?: number;
  description?: string;
  fineract_product_id?: number | null;
}

// --- Device Models ---

export interface DeviceModel {
  id: string;
  brand: string;
  model_name: string;
  model_code: string;
  storage_gb?: number;
  ram_gb?: number;
  screen_size_inches?: number;
  device_type: string;
  retail_price_usd: number;
  wholesale_price_usd: number;
  min_deposit_percentage?: number;
  max_term_months?: number;
  is_active: boolean;
  available_stock: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CreateDeviceModelInput {
  brand: string;
  model_name: string;
  model_code: string;
  storage_gb?: number;
  ram_gb?: number;
  screen_size_inches?: number;
  device_type?: string;
  retail_price_usd: number;
  wholesale_price_usd: number;
  min_deposit_percentage?: number;
  max_term_months?: number;
  is_active?: boolean;
  available_stock?: number;
  image_url?: string;
}

// --- Organizations ---

export type OrgType = 'government' | 'corporate' | 'cooperative' | 'ngo';
export type VerificationMethod = 'excel_upload' | 'api' | 'manual';
export type MemberEmploymentStatus = 'active' | 'retired' | 'suspended';

export interface Organization {
  id: string;
  org_code: string;
  org_name: string;
  org_type: OrgType;
  verification_method: VerificationMethod;
  api_endpoint?: string;
  scoring_trust_level: number;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  total_members: number;
  last_data_import_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  member_count?: number;
}

export interface CreateOrganizationInput {
  org_code: string;
  org_name: string;
  org_type: OrgType;
  verification_method?: VerificationMethod;
  api_endpoint?: string;
  scoring_trust_level?: number;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active?: boolean;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  phone_number: string | null;
  employee_number?: string;
  employment_status: MemberEmploymentStatus;
  employment_start_date?: string;
  department?: string;
  grade_level?: string;
  monthly_salary_usd?: number;
  salary_verified: boolean;
  import_batch_id?: string;
  data_source?: string;
  is_active: boolean;
  customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MemberImportInput {
  national_id?: string;
  phone_number?: string;
  employee_number?: string;
  employment_status?: MemberEmploymentStatus;
  employment_start_date?: string;
  department?: string;
  grade_level?: string;
  monthly_salary_usd?: number;
  salary_verified?: boolean;
}

export interface MemberImportResult {
  import_batch_id: string;
  total: number;
  inserted: number;
  skipped: number;
  errors: number;
}

// --- KYC Review ---

export interface KYCReviewFilters {
  page: number;
  limit: number;
  status?: 'pending' | 'in_review' | 'approved' | 'rejected';
  sortBy?: 'submitted_at' | 'confidence_score';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  confidenceRange?: 'high' | 'medium' | 'low';
}

export interface KYCManualReview {
  id: string;
  submission_id: string;
  action: 'approved' | 'rejected';
  reason: string | null;
  notes: string | null;
  reviewed_at: string;
  reviewed_by: string;
  reviewer?: {
    full_name: string;
    email: string;
  };
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
  // Fineract-enriched fields
  portfolio_outstanding_fineract: number | null;
  par_30_pct: number | null;
  avg_loan_size_usd: number;
  disbursements_this_month: number;
  fineract_last_sync: string | null;
  fineract_discrepancies: number;
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
