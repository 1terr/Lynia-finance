// =====================================================
// Lynia Finance Admin Portal - Type Definitions
// =====================================================

// --- Enums ---

export type KYCStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'operations_manager'
  | 'kyc_reviewer'
  | 'finance_team'
  | 'inventory_manager'
  | 'customer_support';

// --- Customer ---

export interface Customer {
  id: string;
  phone_number: string;
  country_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  province: string | null;
  national_id_number?: string | null;
  employment_status: string | null;
  monthly_income_usd: number | null;
  kyc_status: KYCStatus;
  kyc_verified_at: string | null;
  credit_score: number | null;
  credit_tier: string | null;
  credit_limit_usd: number | null;
  created_at: string;
  updated_at: string;
}

// --- KYC Submission ---

export interface KYCSubmission {
  id: string;
  customer_id: string;
  submission_number: string;
  attempt_number: number;
  id_document_url: string;
  id_document_type: string;
  id_number: string | null;
  selfie_url: string;
  verification_id: string | null;
  status: KYCStatus;
  confidence_score: number | null;
  face_match_score: number | null;
  liveness_passed: boolean | null;
  extracted_name: string | null;
  extracted_dob: string | null;
  extracted_id_number: string | null;
  extracted_data: Record<string, unknown> | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  verified_at: string | null;
  expires_at: string | null;
  smile_identity_response: SmileIdentityResponse | null;
  // Joined relations
  customers?: Customer;
  kyc_manual_reviews?: KYCManualReview[];
  reviewer?: AdminUser;
}

export interface SmileIdentityResponse {
  job_id?: string;
  result_code?: string;
  confidence: number;
  face_match: boolean;
  liveness_check: boolean;
  id_validation: boolean;
  actions?: Record<string, string>;
  [key: string]: unknown;
}

// --- KYC Manual Review ---

export interface KYCManualReview {
  id: string;
  kyc_submission_id: string;
  reviewer_id: string;
  action: 'approved' | 'rejected';
  reason: string | null;
  notes: string | null;
  sla_deadline: string;
  reviewed_at: string;
  reviewer?: AdminUser;
}

// --- Admin User ---

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  role: AdminRole;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

// --- Pagination ---

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- KYC Review Filters ---

export interface KYCReviewFilters extends PaginationParams {
  status?: KYCStatus;
  search?: string;
  sortBy?: 'submitted_at' | 'confidence_score' | 'sla_deadline';
  sortOrder?: 'asc' | 'desc';
  confidenceRange?: 'low' | 'medium' | 'high';
}
