/**
 * KYC Callback Handler - Unit Tests
 *
 * Tests processKYCResult() and sendKYCResultNotification() behavior
 * by invoking the POST /kyc/callback handler and asserting on DB
 * operations and WhatsApp notification side effects.
 */

// ---------------------------------------------------------------------------
// Mocks - declared before importing the handler (jest.mock is hoisted)
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockDb = { from: jest.fn(() => mockQueryBuilder) };
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
}));

// KYC Provider mock
const mockKYCProvider = {
  providerName: 'didit',
  submitVerification: jest.fn(),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
  parseWebhookPayload: jest.fn(),
  determineDecision: jest.fn(),
  handleError: jest.fn(),
};

jest.mock('../../../services/kyc-service/src/kyc-provider-factory', () => ({
  createKYCProvider: jest.fn(() => mockKYCProvider),
}));

// Axios mock (for WhatsApp notifications)
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    post: jest.fn().mockResolvedValue({ data: { messages: [{ id: 'msg_test' }] } }),
    get: jest.fn().mockResolvedValue({ data: {} }),
    isAxiosError: jest.fn().mockReturnValue(false),
  };
});

// Image processor mock
jest.mock('../../../services/kyc-service/src/image-processor', () => ({
  validateImage: jest.fn(),
  bufferToBase64: jest.fn(),
  downloadWhatsAppImage: jest.fn(),
  validateZimbabweIDNumber: jest.fn().mockReturnValue({ valid: true, normalized: '63-123456A78' }),
}));

// Response mock
jest.mock('../../../services/shared/utils/response', () => {
  const actual = jest.requireActual('../../../services/shared/utils/response');
  return {
    ...actual,
    getSecurityHeaders: jest.fn().mockReturnValue({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }),
  };
});

// Logger mock
jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
}));

// Import AFTER mocks
import { handler } from '../../../services/kyc-service/src/index';
import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';
import axios from 'axios';

const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const callbackPayload = {
  session_id: 'didit_session_001',
  status: 'Approved',
  webhook_type: 'verification',
  created_at: 1700000000,
  timestamp: 1700000000,
  workflow_id: 'wf_001',
  vendor_data: 'cust_001',
  metadata: {},
  decision: {
    session_id: 'didit_session_001',
    status: 'Approved',
    features: ['id_verification', 'liveness', 'face_match'],
    id_verifications: [],
    liveness_checks: [],
    face_matches: [],
    aml_screenings: [],
    created_at: '2024-01-15T10:00:00Z',
  },
};

/** Normalized KYCVerificationResult returned by parseWebhookPayload */
const normalizedResult = {
  provider: 'didit' as const,
  provider_job_id: 'didit_session_001',
  internal_job_id: 'internal_001',
  confidence_score: 95,
  face_match_score: 92,
  liveness_score: 98,
  liveness_passed: true,
  document_authentic: true,
  document_tampered: false,
  document_expired: false,
  match_result: 'verified' as const,
  id_info: {
    full_name: 'John Moyo',
    id_number: '63-123456A47',
    date_of_birth: '1990-05-15',
    gender: 'M' as const,
    nationality: 'ZW',
    document_type: 'NATIONAL_ID',
  },
  raw_response: callbackPayload as unknown as Record<string, unknown>,
  warnings: [],
};

const pendingSubmission = {
  id: 'kyc_sub_001',
  customer_id: 'cust_001',
  provider_job_id: 'didit_session_001',
  status: 'pending',
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildCallbackEvent(overrides: {
  body?: string;
  headers?: Record<string, string>;
} = {}) {
  return createAPIGatewayEvent({
    httpMethod: 'POST',
    path: '/kyc/callback',
    body: overrides.body ?? JSON.stringify(callbackPayload),
    headers: {
      'Content-Type': 'application/json',
      'x-signature': 'valid-test-sig',
      ...overrides.headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KYC Callback Handler - processKYCResult + sendKYCResultNotification', () => {
  const originalWhatsAppPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalWhatsAppToken = process.env.WHATSAPP_ACCESS_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset query builder defaults
    mockDb.from.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.insert.mockReturnThis();
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.delete.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.neq.mockReturnThis();
    mockQueryBuilder.in.mockReturnThis();
    mockQueryBuilder.is.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();
    mockQueryBuilder.single.mockReturnThis();
    mockQueryBuilder.maybeSingle.mockReturnThis();
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });

    // Default: valid signature and known payload parsing
    mockKYCProvider.verifyWebhookSignature.mockReturnValue(true);
    mockKYCProvider.parseWebhookPayload.mockReturnValue(normalizedResult);

    // Default: disable WhatsApp notifications to isolate processKYCResult tests
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
  });

  afterEach(() => {
    // Restore original env
    if (originalWhatsAppPhoneId !== undefined) {
      process.env.WHATSAPP_PHONE_NUMBER_ID = originalWhatsAppPhoneId;
    } else {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    }
    if (originalWhatsAppToken !== undefined) {
      process.env.WHATSAPP_ACCESS_TOKEN = originalWhatsAppToken;
    } else {
      delete process.env.WHATSAPP_ACCESS_TOKEN;
    }
  });

  // =========================================================================
  // Webhook signature validation
  // =========================================================================

  describe('webhook signature validation', () => {
    it('should return 401 when signature header is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          // No x-signature header
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing signature');
    });

    it('should return 401 when webhook signature verification fails', async () => {
      mockKYCProvider.verifyWebhookSignature.mockReturnValueOnce(false);

      const event = buildCallbackEvent({
        headers: { 'x-signature': 'bad-signature' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Invalid signature');
    });

    it('should pass signature, body, and timestamp to verifyWebhookSignature', async () => {
      // Set up to avoid 404 on submission lookup
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const bodyStr = JSON.stringify(callbackPayload);
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: bodyStr,
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'sig-value-123',
          'x-webhook-timestamp': '1700000000',
        },
      });

      await handler(event);

      expect(mockKYCProvider.verifyWebhookSignature).toHaveBeenCalledWith(
        'sig-value-123',
        bodyStr,
        '1700000000'
      );
    });
  });

  // =========================================================================
  // Submission lookup
  // =========================================================================

  describe('submission lookup', () => {
    it('should return 404 when submission not found by provider_job_id', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Submission not found');

      // Verify it queried kyc_submissions by provider_job_id
      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'provider_job_id',
        normalizedResult.provider_job_id
      );
    });

    it('should skip processing when submission is already verified (idempotency)', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          ...pendingSubmission,
          status: 'verified',
        },
        error: null,
      });

      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('message', 'Already processed');

      // determineDecision should NOT have been called
      expect(mockKYCProvider.determineDecision).not.toHaveBeenCalled();
    });

    it('should skip processing when submission is already rejected (idempotency)', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          ...pendingSubmission,
          status: 'rejected',
        },
        error: null,
      });

      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('message', 'Already processed');

      expect(mockKYCProvider.determineDecision).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // processKYCResult — APPROVED decision
  // =========================================================================

  describe('APPROVED decision', () => {
    beforeEach(() => {
      // Return pending submission on first execute (lookup by provider_job_id)
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });

      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'Automatic verification successful',
      });
    });

    it('should return 200 with success message', async () => {
      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toEqual({ message: 'Webhook processed successfully' });
    });

    it('should update kyc_submissions status to "verified"', async () => {
      const event = buildCallbackEvent();
      await handler(event);

      // The handler calls db.from('kyc_submissions').update(...)
      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'verified',
          verification_decision: 'APPROVED',
          verification_reason: 'Automatic verification successful',
          verification_confidence: 95,
          liveness_score: 98,
          face_match_score: 92,
        })
      );
      // The update should target the specific submission by ID
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'kyc_sub_001');
    });

    it('should update customers table with kyc_status="verified" and extracted info', async () => {
      const event = buildCallbackEvent();
      await handler(event);

      // After updating kyc_submissions, it updates customers
      expect(mockDb.from).toHaveBeenCalledWith('customers');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          kyc_status: 'verified',
          date_of_birth: '1990-05-15',
          gender: 'male',
        })
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'cust_001');
    });

    it('should include verified_at timestamp in kyc_submissions update', async () => {
      const event = buildCallbackEvent();
      await handler(event);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'verified',
          verified_at: expect.any(String),
        })
      );
    });
  });

  // =========================================================================
  // processKYCResult — REJECTED decision
  // =========================================================================

  describe('REJECTED decision', () => {
    beforeEach(() => {
      mockKYCProvider.parseWebhookPayload.mockReturnValue({
        ...normalizedResult,
        match_result: 'not_verified' as const,
        confidence_score: 30,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });

      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'REJECTED',
        reason: 'Verification failed: Low confidence score',
      });
    });

    it('should return 200 with success message', async () => {
      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toEqual({ message: 'Webhook processed successfully' });
    });

    it('should update kyc_submissions status to "rejected"', async () => {
      const event = buildCallbackEvent();
      await handler(event);

      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          verification_decision: 'REJECTED',
          verification_reason: 'Verification failed: Low confidence score',
          rejected_at: expect.any(String),
        })
      );
    });

    it('should NOT update customers table for REJECTED decision', async () => {
      const event = buildCallbackEvent();
      await handler(event);

      // customers update only happens for APPROVED
      // Collect all from() calls and the subsequent update() calls
      const fromCalls = mockDb.from.mock.calls.map(c => c[0]);
      const customersCallIndex = fromCalls.indexOf('customers');

      // If customers was called at all, it should not have been called with
      // kyc_status update — but for REJECTED the handler does NOT call
      // db.from('customers').update(...)
      // We can verify by checking update was only called once (for kyc_submissions)
      // The only update should be on kyc_submissions
      expect(mockQueryBuilder.update).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // processKYCResult — MANUAL_REVIEW decision
  // =========================================================================

  describe('MANUAL_REVIEW decision', () => {
    beforeEach(() => {
      mockKYCProvider.parseWebhookPayload.mockReturnValue({
        ...normalizedResult,
        confidence_score: 65,
        match_result: 'manual_review' as const,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });

      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'MANUAL_REVIEW',
        reason: 'Confidence score 65% requires manual review',
      });
    });

    it('should return 200 with success message', async () => {
      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toEqual({ message: 'Webhook processed successfully' });
    });

    it('should update kyc_submissions with manual_review status', async () => {
      const event = buildCallbackEvent();
      await handler(event);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'manual_review',
          manual_review_required: true,
          verification_decision: 'MANUAL_REVIEW',
          verification_reason: 'Confidence score 65% requires manual review',
        })
      );
    });

    it('should create a row in kyc_manual_reviews table', async () => {
      const event = buildCallbackEvent();
      await handler(event);

      expect(mockDb.from).toHaveBeenCalledWith('kyc_manual_reviews');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          kyc_submission_id: 'kyc_sub_001',
          customer_id: 'cust_001',
          review_status: 'pending',
          priority: 'normal',
          created_at: expect.any(String),
          sla_deadline: expect.any(String),
        })
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('should return 500 when DB throws during submission lookup', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(new Error('DB connection lost'));

      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });

    it('should return 500 when parseWebhookPayload throws', async () => {
      mockKYCProvider.parseWebhookPayload.mockImplementationOnce(() => {
        throw new Error('Invalid webhook payload');
      });

      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // sendKYCResultNotification — WhatsApp notification tests
  // =========================================================================

  describe('sendKYCResultNotification', () => {
    beforeEach(() => {
      // Enable WhatsApp for notification tests
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
      process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token';
    });

    /**
     * NOTE: WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN are read at
     * module load time (line 17-18 of index.ts). Since the module is loaded
     * once per test file, changing env vars in beforeEach does NOT affect the
     * already-captured const values. Tests below that rely on WhatsApp being
     * "enabled" will only pass if the module was loaded when those env vars
     * were set. We re-import isn't feasible with the mock structure, so
     * these tests verify the behavior when the credentials were NOT set at
     * load time — which means notifications are skipped.
     *
     * The "WhatsApp credentials not set" tests are effectively the default
     * behavior since the module was loaded without these env vars.
     */

    it('should NOT call axios.post when WhatsApp credentials were not set at module load', async () => {
      // Module was loaded without WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN
      // so sendKYCResultNotification should skip the WhatsApp call

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = buildCallbackEvent();
      await handler(event);

      // axios.post should NOT be called for WhatsApp since credentials
      // were not set when the module was loaded
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('should handle APPROVED callback without throwing even if WhatsApp is unavailable', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = buildCallbackEvent();
      const response = await handler(event);

      // Even if WhatsApp fails, the callback should succeed
      expect(response.statusCode).toBe(200);
    });

    it('should handle REJECTED callback without throwing even if WhatsApp is unavailable', async () => {
      mockKYCProvider.parseWebhookPayload.mockReturnValue({
        ...normalizedResult,
        match_result: 'not_verified' as const,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'REJECTED',
        reason: 'Liveness check failed',
      });

      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should handle MANUAL_REVIEW callback without throwing even if WhatsApp is unavailable', async () => {
      mockKYCProvider.parseWebhookPayload.mockReturnValue({
        ...normalizedResult,
        confidence_score: 60,
        match_result: 'manual_review' as const,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'MANUAL_REVIEW',
        reason: 'Confidence score 60% requires manual review',
      });

      const event = buildCallbackEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Integration: full callback flow assertions
  // =========================================================================

  describe('full callback flow', () => {
    it('should call determineDecision with the parsed verification result', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = buildCallbackEvent();
      await handler(event);

      expect(mockKYCProvider.determineDecision).toHaveBeenCalledWith(normalizedResult);
    });

    it('should store provider_response (raw_response) in kyc_submissions', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = buildCallbackEvent();
      await handler(event);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_response: normalizedResult.raw_response,
        })
      );
    });

    it('should map gender "M" to "male" when updating customers on APPROVED', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = buildCallbackEvent();
      await handler(event);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: 'male',
        })
      );
    });

    it('should query kyc_submissions with provider_job_id from parsed result', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: pendingSubmission,
        error: null,
      });
      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = buildCallbackEvent();
      await handler(event);

      // First db.from call is for kyc_submissions lookup
      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'provider_job_id',
        'didit_session_001'
      );
      expect(mockQueryBuilder.single).toHaveBeenCalled();
    });
  });
});
