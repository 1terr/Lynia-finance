/**
 * Lynia Finance — Standardized Error Codes
 *
 * Format: SERVICE_CATEGORY_CODE
 * Used across all services for consistent error identification.
 * See CLAUDE.md Section 8 for full specification.
 */

export const ERROR_CODES = {
  // Authentication Errors (AUTH_*)
  AUTH_INVALID_TOKEN: 'AUTH_TOKEN_001',
  AUTH_EXPIRED_TOKEN: 'AUTH_TOKEN_002',
  AUTH_INVALID_CREDENTIALS: 'AUTH_CRED_001',
  AUTH_ACCOUNT_LOCKED: 'AUTH_LOCK_001',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_001',

  // Loan Errors (LOAN_*)
  LOAN_INSUFFICIENT_SCORE: 'LOAN_SCORE_001',
  LOAN_KYC_PENDING: 'LOAN_KYC_001',
  LOAN_KYC_FAILED: 'LOAN_KYC_002',
  LOAN_DUPLICATE_APPLICATION: 'LOAN_DUP_001',
  LOAN_AMOUNT_EXCEEDED: 'LOAN_AMT_001',
  LOAN_TERM_INVALID: 'LOAN_TERM_001',

  // Payment Errors (PAY_*)
  PAY_INSUFFICIENT_FUNDS: 'PAY_FUND_001',
  PAY_TIMEOUT: 'PAY_TIME_001',
  PAY_PROVIDER_ERROR: 'PAY_PROV_001',
  PAY_DUPLICATE_TRANSACTION: 'PAY_DUP_001',
  PAY_INVALID_AMOUNT: 'PAY_AMT_001',

  // KYC Errors (KYC_*)
  KYC_DOCUMENT_INVALID: 'KYC_DOC_001',
  KYC_FACE_MISMATCH: 'KYC_FACE_001',
  KYC_PROVIDER_ERROR: 'KYC_PROV_001',

  // Device Errors (DEV_*)
  DEV_LOCK_FAILED: 'DEV_LOCK_001',
  DEV_UNLOCK_FAILED: 'DEV_UNLOCK_001',
  DEV_NOT_FOUND: 'DEV_404_001',

  // Validation Errors (VAL_*)
  VAL_REQUIRED_FIELD: 'VAL_REQ_001',
  VAL_INVALID_FORMAT: 'VAL_FMT_001',
  VAL_OUT_OF_RANGE: 'VAL_RNG_001',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Standard error response envelope.
 * All API error responses across services must conform to this shape.
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
}

/**
 * Create a standardized error response object.
 *
 * @param code - One of the ERROR_CODES values (e.g. 'AUTH_TOKEN_001')
 * @param message - User-friendly error message (no sensitive data)
 * @param details - Optional additional context for debugging
 * @param requestId - Correlation ID from the incoming request
 * @returns A fully-formed ErrorResponse envelope
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      requestId: requestId || 'unknown',
      timestamp: new Date().toISOString(),
    },
  };
}
