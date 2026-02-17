/**
 * Tests for DiditService KYC Provider
 *
 * Covers:
 *   - submitVerification() - 3-step API flow (ID verification, liveness, face match)
 *   - parseCombinedResult() - Normalizes raw Didit API response to KYCVerificationResult
 *   - determineDecision() - Decision logic (APPROVED, REJECTED, MANUAL_REVIEW)
 *   - verifyWebhookSignature() - HMAC-SHA256 signature verification
 *   - handleError() - Error response mapping (retriable vs non-retriable)
 */

import { createHmac } from 'crypto';
import type {
  KYCVerificationResult,
  KYCSubmitParams,
} from '../../services/shared/types/kyc-provider';

// ===================================================================
// MOCKS
// ===================================================================

// Mock require-env to return test values
jest.mock('../../services/shared/utils/require-env', () => ({
  requireEnv: jest.fn((name: string) => {
    const envMap: Record<string, string> = {
      DIDIT_API_KEY: 'test-didit-api-key-12345',
      DIDIT_WEBHOOK_SECRET: 'test-webhook-secret-abc',
    };
    return envMap[name] || `mock-${name}`;
  }),
}));

// Mock circuit-breaker to pass through directly
jest.mock('../../services/shared/utils/circuit-breaker', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn((fn: () => Promise<unknown>) => fn()),
    getState: jest.fn().mockReturnValue('CLOSED'),
    reset: jest.fn(),
  })),
  CircuitOpenError: class CircuitOpenError extends Error {
    public readonly serviceName: string;
    constructor(message: string, serviceName: string) {
      super(message);
      this.name = 'CircuitOpenError';
      this.serviceName = serviceName;
    }
  },
}));

// Mock axios
const mockPost = jest.fn();
jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  return {
    __esModule: true,
    default: {
      ...actualAxios.default,
      create: jest.fn(() => ({
        post: mockPost,
      })),
      isAxiosError: actualAxios.default?.isAxiosError ?? actualAxios.isAxiosError,
    },
    isAxiosError: actualAxios.default?.isAxiosError ?? actualAxios.isAxiosError,
  };
});

// Mock form-data
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({
      'content-type': 'multipart/form-data; boundary=---test-boundary',
    }),
  }));
});

import { DiditService } from '../../services/kyc-service/src/didit-service';
import type { DiditCombinedResult } from '../../services/kyc-service/src/didit-service';
import axios from 'axios';

// ===================================================================
// HELPER FACTORIES
// ===================================================================

const TEST_WEBHOOK_SECRET = 'test-webhook-secret-abc';

function createSubmitParams(overrides?: Partial<KYCSubmitParams>): KYCSubmitParams {
  return {
    customer_id: 'cust-test-001',
    id_number: '63-123456-A-78',
    id_image_base64: Buffer.from('fake-id-image-data').toString('base64'),
    selfie_image_base64: Buffer.from('fake-selfie-image-data').toString('base64'),
    first_name: 'Tendai',
    last_name: 'Moyo',
    dob: '1990-05-15',
    phone_number: '+263771234567',
    ...overrides,
  };
}

function createIdVerificationResponse(overrides?: Record<string, unknown>) {
  return {
    request_id: 'didit-req-id-001',
    id_verification: {
      status: 'Approved',
      issuing_state: 'ZW',
      issuing_state_name: 'Zimbabwe',
      document_type: 'NATIONAL_ID',
      document_number: '63-123456-A-78',
      first_name: 'Tendai',
      last_name: 'Moyo',
      full_name: 'Tendai Moyo',
      date_of_birth: '1990-05-15',
      age: 35,
      gender: 'Male',
      nationality: 'Zimbabwean',
      expiration_date: '2030-12-31',
      date_of_issue: '2020-01-01',
      place_of_birth: 'Harare',
      portrait_image: '',
      front_document_image: '',
      back_document_image: '',
      warnings: [],
      ...overrides,
    },
    created_at: '2026-01-15T10:00:00Z',
  };
}

function createLivenessResponse(overrides?: Record<string, unknown>) {
  return {
    request_id: 'didit-req-liveness-001',
    liveness: {
      status: 'Approved',
      method: 'passive',
      score: 95,
      user_image: {
        entities: [{ age: 35, bbox: [0, 0, 100, 100], confidence: 0.98, gender: 'Male' }],
        best_angle: 0,
      },
      face_quality: 0.95,
      face_luminance: 0.80,
      warnings: [],
      ...overrides,
    },
    created_at: '2026-01-15T10:00:01Z',
  };
}

function createFaceMatchResponse(overrides?: Record<string, unknown>) {
  return {
    request_id: 'didit-req-facematch-001',
    face_match: {
      status: 'Approved',
      score: 92,
      user_image: {
        entities: [{ age: 35, bbox: [0, 0, 100, 100], confidence: 0.97, gender: 'Male' }],
        best_angle: 0,
      },
      ref_image: {
        entities: [{ age: 35, bbox: [0, 0, 100, 100], confidence: 0.96, gender: 'Male' }],
        best_angle: 0,
      },
      warnings: [],
      ...overrides,
    },
    created_at: '2026-01-15T10:00:02Z',
  };
}

function createCombinedResult(overrides?: Partial<DiditCombinedResult>): DiditCombinedResult {
  return {
    id_verification: createIdVerificationResponse(),
    liveness: createLivenessResponse(),
    face_match: createFaceMatchResponse(),
    ...overrides,
  };
}

function createVerificationResult(overrides?: Partial<KYCVerificationResult>): KYCVerificationResult {
  return {
    provider: 'didit',
    provider_job_id: 'didit-req-id-001',
    internal_job_id: 'test-job-001',
    confidence_score: 94,
    face_match_score: 92,
    liveness_score: 95,
    liveness_passed: true,
    document_authentic: true,
    document_tampered: false,
    document_expired: false,
    match_result: 'verified',
    id_info: {
      full_name: 'Tendai Moyo',
      id_number: '63-123456-A-78',
      date_of_birth: '1990-05-15',
      gender: 'M',
      nationality: 'Zimbabwean',
      document_type: 'NATIONAL_ID',
    },
    raw_response: {},
    warnings: [],
    ...overrides,
  };
}

function createAxiosError(status: number, data?: Record<string, unknown>) {
  const error = new Error(`Request failed with status code ${status}`) as any;
  error.isAxiosError = true;
  error.response = {
    status,
    data: data || { error: `Error ${status}` },
  };
  error.config = {};
  error.toJSON = () => ({});
  return error;
}

/**
 * Compute a valid HMAC-SHA256 signature for webhook payload verification.
 * Mirrors the canonical-JSON approach used by DiditService.verifyWebhookSignature().
 */
function computeSignature(payload: Record<string, unknown>, secret: string): string {
  const sortKeys = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(item => sortKeys(item));
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
          return sorted;
        }, {});
    }
    return obj;
  };

  const canonical = JSON.stringify(sortKeys(payload));
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

// ===================================================================
// TESTS
// ===================================================================

describe('DiditService', () => {
  let service: DiditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiditService();
  });

  // -----------------------------------------------------------------
  // submitVerification()
  // -----------------------------------------------------------------
  describe('submitVerification', () => {
    it('should execute the 3-step API flow and return a KYCSubmissionResponse', async () => {
      const idResponse = createIdVerificationResponse();
      const livenessResponse = createLivenessResponse();
      const faceMatchResponse = createFaceMatchResponse();

      mockPost
        .mockResolvedValueOnce({ data: idResponse })
        .mockResolvedValueOnce({ data: livenessResponse })
        .mockResolvedValueOnce({ data: faceMatchResponse });

      const params = createSubmitParams();
      const result = await service.submitVerification(params);

      expect(result.success).toBe(true);
      expect(result.provider_job_id).toBe('didit-req-id-001');
      expect(result.internal_job_id).toMatch(/^didit_/);
      expect(result.message).toContain('KYC verification completed');
      expect(result.synchronous_result).toBeDefined();
      expect(result.synchronous_result?.provider).toBe('didit');
    });

    it('should call all three Didit API endpoints in order', async () => {
      mockPost
        .mockResolvedValueOnce({ data: createIdVerificationResponse() })
        .mockResolvedValueOnce({ data: createLivenessResponse() })
        .mockResolvedValueOnce({ data: createFaceMatchResponse() });

      await service.submitVerification(createSubmitParams());

      expect(mockPost).toHaveBeenCalledTimes(3);

      // Verify the endpoints called
      const calls = mockPost.mock.calls;
      expect(calls[0][0]).toBe('/v3/id-verification/');
      expect(calls[1][0]).toBe('/v3/passive-liveness/');
      expect(calls[2][0]).toBe('/v3/face-match/');
    });

    it('should include the API key in request headers', async () => {
      mockPost
        .mockResolvedValueOnce({ data: createIdVerificationResponse() })
        .mockResolvedValueOnce({ data: createLivenessResponse() })
        .mockResolvedValueOnce({ data: createFaceMatchResponse() });

      await service.submitVerification(createSubmitParams());

      for (const call of mockPost.mock.calls) {
        const requestConfig = call[2];
        expect(requestConfig.headers['x-api-key']).toBe('test-didit-api-key-12345');
      }
    });

    it('should propagate API errors from the ID verification step', async () => {
      const error = new Error('ID verification API failed');
      mockPost.mockRejectedValueOnce(error);

      await expect(service.submitVerification(createSubmitParams())).rejects.toThrow(
        'ID verification API failed'
      );

      // Should only have called the first endpoint before failing
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('should propagate API errors from the liveness step', async () => {
      mockPost
        .mockResolvedValueOnce({ data: createIdVerificationResponse() })
        .mockRejectedValueOnce(new Error('Liveness check failed'));

      await expect(service.submitVerification(createSubmitParams())).rejects.toThrow(
        'Liveness check failed'
      );

      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should handle base64 data URI prefix in images', async () => {
      mockPost
        .mockResolvedValueOnce({ data: createIdVerificationResponse() })
        .mockResolvedValueOnce({ data: createLivenessResponse() })
        .mockResolvedValueOnce({ data: createFaceMatchResponse() });

      const params = createSubmitParams({
        id_image_base64: 'data:image/jpeg;base64,' + Buffer.from('test-id').toString('base64'),
        selfie_image_base64: 'data:image/png;base64,' + Buffer.from('test-selfie').toString('base64'),
      });

      const result = await service.submitVerification(params);
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // parseCombinedResult()
  // -----------------------------------------------------------------
  describe('parseCombinedResult', () => {
    it('should map face_match_score from the face match response', () => {
      const combined = createCombinedResult();
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.face_match_score).toBe(92);
    });

    it('should map liveness_score from the liveness response', () => {
      const combined = createCombinedResult();
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.liveness_score).toBe(95);
    });

    it('should compute confidence_score as average of face match and liveness scores', () => {
      const combined = createCombinedResult();
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      // (92 + 95) / 2 = 93.5, rounded to 94
      expect(result.confidence_score).toBe(Math.round((92 + 95) / 2));
    });

    it('should extract id_info from ID verification response', () => {
      const combined = createCombinedResult();
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.id_info.full_name).toBe('Tendai Moyo');
      expect(result.id_info.id_number).toBe('63-123456-A-78');
      expect(result.id_info.date_of_birth).toBe('1990-05-15');
      expect(result.id_info.gender).toBe('M');
      expect(result.id_info.nationality).toBe('Zimbabwean');
      expect(result.id_info.document_type).toBe('NATIONAL_ID');
    });

    it('should set provider name to didit', () => {
      const combined = createCombinedResult();
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.provider).toBe('didit');
    });

    it('should set match_result to verified when all checks pass', () => {
      const combined = createCombinedResult();
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.match_result).toBe('verified');
      expect(result.liveness_passed).toBe(true);
      expect(result.document_authentic).toBe(true);
    });

    it('should set match_result to not_verified when ID verification is Declined', () => {
      const combined = createCombinedResult({
        id_verification: createIdVerificationResponse({ status: 'Declined' }),
      });
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.match_result).toBe('not_verified');
      expect(result.document_authentic).toBe(false);
    });

    it('should set match_result to manual_review for non-Approved/non-Declined statuses', () => {
      const combined = createCombinedResult({
        id_verification: createIdVerificationResponse({ status: 'Pending' }),
      });
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.match_result).toBe('manual_review');
    });

    it('should detect DOCUMENT_EXPIRED warnings', () => {
      const combined = createCombinedResult({
        id_verification: createIdVerificationResponse({
          warnings: [
            {
              risk: 'DOCUMENT_EXPIRED',
              additional_data: null,
              log_type: 'warning',
              short_description: 'Document has expired',
              long_description: 'The document expiration date has passed.',
            },
          ],
        }),
      });
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.document_expired).toBe(true);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].code).toBe('DOCUMENT_EXPIRED');
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('should detect DOCUMENT_TAMPERED warnings', () => {
      const combined = createCombinedResult({
        id_verification: createIdVerificationResponse({
          warnings: [
            {
              risk: 'DOCUMENT_TAMPERED',
              additional_data: null,
              log_type: 'error',
              short_description: 'Document appears tampered',
              long_description: 'Evidence of tampering detected.',
            },
          ],
        }),
      });
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.document_tampered).toBe(true);
      expect(result.warnings[0].severity).toBe('error');
    });

    it('should map Female gender correctly', () => {
      const combined = createCombinedResult({
        id_verification: createIdVerificationResponse({ gender: 'Female' }),
      });
      const result = service.parseCombinedResult(combined, 'cust-001', 'job-001');

      expect(result.id_info.gender).toBe('F');
    });
  });

  // -----------------------------------------------------------------
  // determineDecision()
  // -----------------------------------------------------------------
  describe('determineDecision', () => {
    it('should return APPROVED when all checks pass with high confidence', () => {
      const result = createVerificationResult({
        confidence_score: 90,
        liveness_passed: true,
        document_authentic: true,
        document_tampered: false,
        document_expired: false,
        match_result: 'verified',
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('APPROVED');
      expect(decision.reason).toContain('Automatic verification successful');
    });

    it('should return APPROVED at the exact 85% confidence threshold', () => {
      const result = createVerificationResult({ confidence_score: 85 });
      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('APPROVED');
    });

    it('should return REJECTED when liveness check fails', () => {
      const result = createVerificationResult({
        liveness_passed: false,
        match_result: 'not_verified',
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('REJECTED');
      expect(decision.reason).toContain('Liveness check failed');
    });

    it('should return REJECTED when document is tampered', () => {
      const result = createVerificationResult({
        document_tampered: true,
        confidence_score: 90,
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('REJECTED');
      expect(decision.reason).toContain('Document appears tampered');
    });

    it('should return REJECTED when document is expired', () => {
      const result = createVerificationResult({
        document_expired: true,
        confidence_score: 90,
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('REJECTED');
      expect(decision.reason).toContain('Document has expired');
    });

    it('should return REJECTED when confidence score is below 50', () => {
      const result = createVerificationResult({
        confidence_score: 49,
        match_result: 'manual_review',
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('REJECTED');
      expect(decision.reason).toContain('Low confidence score');
    });

    it('should return MANUAL_REVIEW for borderline confidence (50-84%)', () => {
      const result = createVerificationResult({
        confidence_score: 70,
        match_result: 'verified',
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('MANUAL_REVIEW');
      expect(decision.reason).toContain('70%');
      expect(decision.reason).toContain('manual review');
    });

    it('should return MANUAL_REVIEW at exactly 50% confidence', () => {
      const result = createVerificationResult({
        confidence_score: 50,
        match_result: 'verified',
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('MANUAL_REVIEW');
    });

    it('should return REJECTED when match_result is not_verified regardless of score', () => {
      const result = createVerificationResult({
        confidence_score: 95,
        match_result: 'not_verified',
      });

      const decision = service.determineDecision(result);

      expect(decision.decision).toBe('REJECTED');
    });
  });

  // -----------------------------------------------------------------
  // verifyWebhookSignature()
  // -----------------------------------------------------------------
  describe('verifyWebhookSignature', () => {
    it('should return true for a valid HMAC signature', () => {
      const payload = { session_id: 'sess-001', status: 'Approved' };
      const payloadStr = JSON.stringify(payload);
      const signature = computeSignature(payload, TEST_WEBHOOK_SECRET);

      const isValid = service.verifyWebhookSignature(signature, payloadStr);

      expect(isValid).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const payload = { session_id: 'sess-001', status: 'Approved' };
      const payloadStr = JSON.stringify(payload);
      const invalidSignature = 'deadbeef'.repeat(8);

      const isValid = service.verifyWebhookSignature(invalidSignature, payloadStr);

      expect(isValid).toBe(false);
    });

    it('should return false for malformed JSON payload', () => {
      const isValid = service.verifyWebhookSignature('somesignature', 'not-valid-json{{{');

      expect(isValid).toBe(false);
    });

    it('should reject stale timestamps (older than 5 minutes)', () => {
      const payload = { session_id: 'sess-001', status: 'Approved' };
      const payloadStr = JSON.stringify(payload);
      const signature = computeSignature(payload, TEST_WEBHOOK_SECRET);

      // Timestamp 10 minutes ago
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);

      const isValid = service.verifyWebhookSignature(signature, payloadStr, staleTimestamp);

      expect(isValid).toBe(false);
    });

    it('should accept timestamps within the 5-minute window', () => {
      const payload = { session_id: 'sess-002', status: 'Declined' };
      const payloadStr = JSON.stringify(payload);
      const signature = computeSignature(payload, TEST_WEBHOOK_SECRET);

      // Timestamp 2 minutes ago
      const recentTimestamp = String(Math.floor(Date.now() / 1000) - 120);

      const isValid = service.verifyWebhookSignature(signature, payloadStr, recentTimestamp);

      expect(isValid).toBe(true);
    });

    it('should canonicalize payload with sorted keys for signature verification', () => {
      // Keys in non-sorted order in the JSON string
      const payload = { z_field: 'last', a_field: 'first', m_field: 'middle' };
      const payloadStr = JSON.stringify(payload);
      const signature = computeSignature(payload, TEST_WEBHOOK_SECRET);

      const isValid = service.verifyWebhookSignature(signature, payloadStr);

      expect(isValid).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // handleError()
  // -----------------------------------------------------------------
  describe('handleError', () => {
    it('should return retriable response for 400 (bad request)', () => {
      const error = createAxiosError(400);
      const response = service.handleError(error);

      expect(response.retriable).toBe(true);
      expect(response.user_message).toContain('retake the photo');
      expect(response.admin_action_required).toBe(false);
    });

    it('should return non-retriable response for 401 (unauthorized)', () => {
      const error = createAxiosError(401);
      const response = service.handleError(error);

      expect(response.retriable).toBe(false);
      expect(response.admin_action_required).toBe(true);
      expect(response.user_message).toContain('try again later');
    });

    it('should return non-retriable response for 403 with credits message', () => {
      const error = createAxiosError(403, { error: 'Insufficient credits remaining' });
      const response = service.handleError(error);

      expect(response.retriable).toBe(false);
      expect(response.admin_action_required).toBe(true);
      expect(response.user_message).toContain('temporarily unavailable');
    });

    it('should return non-retriable response for 403 without credits message', () => {
      const error = createAxiosError(403, { error: 'Forbidden' });
      const response = service.handleError(error);

      expect(response.retriable).toBe(false);
      expect(response.admin_action_required).toBe(true);
    });

    it('should return retriable response with retry_after for 429 (rate limit)', () => {
      const error = createAxiosError(429);
      const response = service.handleError(error);

      expect(response.retriable).toBe(true);
      expect(response.user_message).toContain('temporarily busy');
      expect(response.admin_action_required).toBe(false);
      expect(response.retry_after).toBeDefined();
      expect(response.retry_after!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return generic retriable response for unknown errors', () => {
      const error = new Error('Something unexpected happened');
      const response = service.handleError(error);

      expect(response.retriable).toBe(true);
      expect(response.user_message).toContain('try again');
      expect(response.admin_action_required).toBe(false);
    });

    it('should return generic retriable response for non-Axios errors', () => {
      const response = service.handleError(null);

      expect(response.retriable).toBe(true);
      expect(response.user_message).toBe('Verification failed. Please try again.');
    });

    it('should return retriable response for 500 server errors', () => {
      const error = createAxiosError(500, { error: 'Internal server error' });
      const response = service.handleError(error);

      // 500 falls through to the default case
      expect(response.retriable).toBe(true);
      expect(response.user_message).toContain('try again');
    });
  });
});
