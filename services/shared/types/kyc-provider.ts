/**
 * Provider-neutral KYC types for Lynia Finance.
 * Allows switching between KYC providers (Smile Identity, DIDIT, etc.)
 * without changing downstream consumers (scoring, frontend, WhatsApp flow).
 */

// =====================================================
// NORMALIZED RESULT TYPES
// =====================================================

/**
 * Provider-neutral KYC verification result.
 * Both Smile Identity and DIDIT map their responses into this shape.
 */
export interface KYCVerificationResult {
  provider: KYCProviderName;
  provider_job_id: string;
  internal_job_id: string;

  /** Overall confidence score (0-100) */
  confidence_score: number;
  /** Face-to-ID match score (0-100) */
  face_match_score: number;
  /** Liveness check score (0-100) */
  liveness_score: number;

  liveness_passed: boolean;
  document_authentic: boolean;
  document_tampered: boolean;
  document_expired: boolean;

  match_result: 'verified' | 'not_verified' | 'manual_review';

  id_info: KYCExtractedInfo;

  /** Full raw provider response (stored as JSONB) */
  raw_response: Record<string, unknown>;

  /** Risk warnings from provider */
  warnings: KYCWarning[];
}

export interface KYCExtractedInfo {
  full_name: string;
  id_number: string;
  date_of_birth: string; // YYYY-MM-DD
  gender: 'M' | 'F' | null;
  nationality: string | null;
  document_type: string;
}

export interface KYCWarning {
  code: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
}

// =====================================================
// SUBMISSION TYPES
// =====================================================

export interface KYCSubmitParams {
  customer_id: string;
  id_number: string;
  id_image_base64: string;
  selfie_image_base64: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  phone_number?: string;
}

export interface KYCSubmissionResponse {
  success: boolean;
  provider_job_id: string;
  internal_job_id: string;
  message: string;
}

// =====================================================
// ERROR TYPES
// =====================================================

export interface KYCErrorResponse {
  retriable: boolean;
  user_message: string;
  admin_action_required: boolean;
  retry_after?: Date;
}

// =====================================================
// DECISION TYPES
// =====================================================

export interface KYCDecision {
  decision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  reason: string;
}

// =====================================================
// PROVIDER INTERFACE
// =====================================================

export type KYCProviderName = 'smile_identity' | 'didit';

/**
 * KYC provider interface.
 * Implementations: SmileIdentityService, DiditService.
 */
export interface KYCProvider {
  readonly providerName: KYCProviderName;

  /** Submit a KYC verification request to the provider */
  submitVerification(params: KYCSubmitParams): Promise<KYCSubmissionResponse>;

  /** Verify the webhook signature from the provider */
  verifyWebhookSignature(signature: string, payload: string, timestamp?: string): boolean;

  /** Parse the raw webhook payload into a normalized result */
  parseWebhookPayload(rawPayload: string): KYCVerificationResult;

  /** Determine the verification decision based on scores */
  determineDecision(result: KYCVerificationResult): KYCDecision;

  /** Map provider errors to a user-friendly response */
  handleError(error: unknown): KYCErrorResponse;
}
