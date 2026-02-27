/**
 * Integration Tests: KYC Service
 *
 * Tests the full Lambda handler invocation for the KYC service via the
 * lambda-router. Covers KYC initiation, callback processing, status
 * retrieval, and retry eligibility.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the handler
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
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockDb = { from: jest.fn(() => mockQueryBuilder) };

jest.mock('../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

// KYC Provider mock
const mockKYCProvider = {
  providerName: 'didit',
  submitVerification: jest.fn().mockResolvedValue({
    provider_job_id: 'didit_session_new',
    message: 'Verification submitted successfully',
    synchronous_result: null,
  }),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
  parseWebhookPayload: jest.fn(),
  determineDecision: jest.fn(),
  handleError: jest.fn().mockReturnValue({
    user_message: 'Verification failed, please retry',
    retriable: true,
    retry_after: 60,
  }),
};

jest.mock('../../services/kyc-service/src/kyc-provider-factory', () => ({
  createKYCProvider: jest.fn(() => mockKYCProvider),
}));

// Axios mock (for WhatsApp notifications in processKYCResult)
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
jest.mock('../../services/kyc-service/src/image-processor', () => ({
  validateImage: jest.fn(),
  bufferToBase64: jest.fn(),
  downloadWhatsAppImage: jest.fn(),
  validateZimbabweIDNumber: jest.fn().mockReturnValue({
    valid: true,
    normalized: '63-123456A78',
  }),
}));

// Response mock - use actual implementation but override getSecurityHeaders for test stability
jest.mock('../../services/shared/utils/response', () => {
  const actual = jest.requireActual('../../services/shared/utils/response');
  return {
    ...actual,
    getSecurityHeaders: jest.fn().mockReturnValue({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }),
  };
});

// Logger mock
jest.mock('../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
}));

// Import AFTER mocks
import { handler } from '../../services/kyc-service/src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/kyc/test',
    body: null,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      accountId: '',
      apiId: '',
      authorizer: {},
      httpMethod: overrides.httpMethod || 'GET',
      identity: { sourceIp: '127.0.0.1' } as APIGatewayProxyEvent['requestContext']['identity'],
      path: overrides.path || '/kyc/test',
      protocol: 'HTTP/1.1',
      requestId: 'test-req-123',
      requestTimeEpoch: Date.now(),
      resourceId: '',
      resourcePath: overrides.path || '/kyc/test',
      stage: 'test',
    },
    ...overrides,
  };
}

function parseBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body);
}

// Shared test data
const validInitiateBody = {
  customer_id: 'cust_001',
  id_number: '63-123456A78',
  id_image_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  selfie_image_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  first_name: 'John',
  last_name: 'Moyo',
  dob: '1990-05-15',
  phone_number: '+263771234567',
};

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
  raw_response: {} as Record<string, unknown>,
  warnings: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KYC Service Integration Tests', () => {
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
    mockQueryBuilder.or.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();
    mockQueryBuilder.single.mockReturnThis();
    mockQueryBuilder.maybeSingle.mockReturnThis();
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });

    // Reset KYC provider defaults
    mockKYCProvider.verifyWebhookSignature.mockReturnValue(true);
    mockKYCProvider.parseWebhookPayload.mockReturnValue(normalizedResult);
    mockKYCProvider.submitVerification.mockResolvedValue({
      provider_job_id: 'didit_session_new',
      message: 'Verification submitted successfully',
      synchronous_result: null,
    });
  });

  // =========================================================================
  // POST /kyc/initiate
  // =========================================================================
  describe('POST /kyc/initiate', () => {
    it('should return 400 when customer_id is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          id_number: '63-123456A78',
          id_image_base64: 'data:image/jpeg;base64,abc',
          selfie_image_base64: 'data:image/jpeg;base64,abc',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      expect(body).toHaveProperty('required');
      expect(body.required).toContain('customer_id');
    });

    it('should return 400 when id_number is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          customer_id: 'cust_001',
          id_image_base64: 'data:image/jpeg;base64,abc',
          selfie_image_base64: 'data:image/jpeg;base64,abc',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 when id_image_base64 is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          customer_id: 'cust_001',
          id_number: '63-123456A78',
          selfie_image_base64: 'data:image/jpeg;base64,abc',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 when selfie_image_base64 is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          customer_id: 'cust_001',
          id_number: '63-123456A78',
          id_image_base64: 'data:image/jpeg;base64,abc',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 when ID number format is invalid', async () => {
      const { validateZimbabweIDNumber } = require('../../services/kyc-service/src/image-processor');
      validateZimbabweIDNumber.mockReturnValueOnce({
        valid: false,
        error: 'Invalid ID number format. Expected format: XX-XXXXXXX-X-XX',
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          ...validInitiateBody,
          id_number: 'INVALID',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Invalid ID number');
    });

    it('should return 200 with existing verified status if customer already verified', async () => {
      // existing submission lookup returns verified
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_existing',
          customer_id: 'cust_001',
          status: 'verified',
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(validInitiateBody),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'KYC already verified');
      expect(body).toHaveProperty('status', 'verified');
      expect(body).toHaveProperty('kyc_submission_id', 'kyc_sub_existing');
    });

    it('should return 200 with existing pending status if verification in progress', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_pending',
          customer_id: 'cust_001',
          status: 'pending',
          provider_job_id: 'didit_session_pending',
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(validInitiateBody),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'KYC verification already in progress');
      expect(body).toHaveProperty('status', 'pending');
      expect(body).toHaveProperty('provider_job_id', 'didit_session_pending');
    });

    it('should successfully initiate KYC when no existing submission exists', async () => {
      // No existing submission
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })  // existing submission check
        .mockResolvedValueOnce({                              // insert new submission
          data: {
            id: 'kyc_sub_new',
            customer_id: 'cust_001',
            status: 'pending',
            provider_job_id: 'didit_session_new',
          },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });      // remaining calls

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(validInitiateBody),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('kyc_submission_id', 'kyc_sub_new');
      expect(body).toHaveProperty('provider_job_id', 'didit_session_new');
      expect(body).toHaveProperty('status', 'pending');
    });

    it('should call the KYC provider submitVerification with correct parameters', async () => {
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'kyc_sub_new', customer_id: 'cust_001' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(validInitiateBody),
      });

      await handler(event);

      expect(mockKYCProvider.submitVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'cust_001',
          id_number: '63-123456A78',
          first_name: 'John',
          last_name: 'Moyo',
        }),
      );
    });

    it('should store submission in kyc_submissions table', async () => {
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'kyc_sub_new', customer_id: 'cust_001' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(validInitiateBody),
      });

      await handler(event);

      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'cust_001',
          id_document_type: 'NATIONAL_ID',
          kyc_provider: 'didit',
          provider_job_id: 'didit_session_new',
          status: 'pending',
        }),
      );
    });

    it('should return 500 when database insert fails', async () => {
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })   // existing submission check
        .mockResolvedValueOnce({                               // insert fails
          data: null,
          error: new Error('Database connection error'),
        });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(validInitiateBody),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseBody(response);
      expect(body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // POST /kyc/callback
  // =========================================================================
  describe('POST /kyc/callback', () => {
    const callbackPayload = {
      session_id: 'didit_session_001',
      status: 'Approved',
      webhook_type: 'verification',
    };

    it('should return 401 when signature header is missing', async () => {
      const event = createEvent({
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
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Missing signature');
    });

    it('should return 401 when webhook signature verification fails', async () => {
      mockKYCProvider.verifyWebhookSignature.mockReturnValueOnce(false);

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'invalid-signature',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Invalid signature');
    });

    it('should return 404 when submission not found for provider job ID', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Submission not found');
    });

    it('should return 200 with "Already processed" for already verified submission (idempotency)', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'didit_session_001',
          status: 'verified',
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('message', 'Already processed');
      expect(mockKYCProvider.determineDecision).not.toHaveBeenCalled();
    });

    it('should return 200 with "Already processed" for already rejected submission', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'didit_session_001',
          status: 'rejected',
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('message', 'Already processed');
    });

    it('should process valid Didit callback and return 200', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'didit_session_001',
          status: 'pending',
        },
        error: null,
      });

      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('message', 'Webhook processed successfully');
    });

    it('should update kyc_submissions with verification result for APPROVED', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'didit_session_001',
          status: 'pending',
        },
        error: null,
      });

      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      await handler(event);

      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'verified',
          verification_decision: 'APPROVED',
          verification_reason: 'All checks passed',
          verified_at: expect.any(String),
        }),
      );
    });

    it('should update customers table for APPROVED decision', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'didit_session_001',
          status: 'pending',
        },
        error: null,
      });

      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      await handler(event);

      expect(mockDb.from).toHaveBeenCalledWith('customers');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          kyc_status: 'verified',
          full_name: 'John Moyo',
          date_of_birth: '1990-05-15',
          gender: 'male',
        }),
      );
    });

    it('should handle REJECTED callback and update kyc_submissions status', async () => {
      mockKYCProvider.parseWebhookPayload.mockReturnValue({
        ...normalizedResult,
        match_result: 'not_verified' as const,
        confidence_score: 30,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'didit_session_001',
          status: 'pending',
        },
        error: null,
      });

      mockKYCProvider.determineDecision.mockReturnValue({
        decision: 'REJECTED',
        reason: 'Low confidence score',
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          verification_decision: 'REJECTED',
          rejected_at: expect.any(String),
        }),
      );
    });

    it('should return 500 when DB throws during processing', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseBody(response);
      expect(body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // GET /kyc/:customerId - KYC status
  // =========================================================================
  describe('GET /kyc/:customerId', () => {
    it('should return not_started when no KYC submission found', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('customer_id', 'cust_001');
      expect(body).toHaveProperty('kyc_status', 'not_started');
      expect(body).toHaveProperty('message', 'No KYC submission found');
    });

    it('should return pending status for in-progress verification', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          status: 'pending',
          kyc_provider: 'didit',
          submitted_at: '2024-01-15T10:00:00Z',
          verified_at: null,
          rejected_at: null,
          verification_confidence: null,
          verification_decision: null,
          verification_reason: null,
          manual_review_required: false,
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('customer_id', 'cust_001');
      expect(body).toHaveProperty('kyc_status', 'pending');
      expect(body).toHaveProperty('kyc_submission_id', 'kyc_sub_001');
      expect(body).toHaveProperty('kyc_provider', 'didit');
    });

    it('should return verified status with verification details', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          status: 'verified',
          kyc_provider: 'didit',
          submitted_at: '2024-01-15T10:00:00Z',
          verified_at: '2024-01-15T10:05:00Z',
          rejected_at: null,
          verification_confidence: 95,
          verification_decision: 'APPROVED',
          verification_reason: 'All checks passed',
          manual_review_required: false,
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('customer_id', 'cust_001');
      expect(body).toHaveProperty('kyc_status', 'verified');
      expect(body).toHaveProperty('verification_confidence', 95);
      expect(body).toHaveProperty('verification_decision', 'APPROVED');
      expect(body).toHaveProperty('verified_at', '2024-01-15T10:05:00Z');
    });

    it('should return rejected status with rejection details', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          status: 'rejected',
          kyc_provider: 'didit',
          submitted_at: '2024-01-15T10:00:00Z',
          verified_at: null,
          rejected_at: '2024-01-15T10:03:00Z',
          verification_confidence: 30,
          verification_decision: 'REJECTED',
          verification_reason: 'Face match failed',
          manual_review_required: false,
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('customer_id', 'cust_001');
      expect(body).toHaveProperty('kyc_status', 'rejected');
      expect(body).toHaveProperty('verification_confidence', 30);
      expect(body).toHaveProperty('verification_decision', 'REJECTED');
      expect(body).toHaveProperty('verification_reason', 'Face match failed');
      expect(body).toHaveProperty('rejected_at', '2024-01-15T10:03:00Z');
    });

    it('should return manual_review status when flagged for review', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          status: 'manual_review',
          kyc_provider: 'didit',
          submitted_at: '2024-01-15T10:00:00Z',
          verified_at: null,
          rejected_at: null,
          verification_confidence: 60,
          verification_decision: 'MANUAL_REVIEW',
          verification_reason: 'Confidence score below threshold',
          manual_review_required: true,
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('kyc_status', 'manual_review');
      expect(body).toHaveProperty('manual_review_required', true);
    });

    it('should query kyc_submissions ordered by created_at descending', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
      });

      await handler(event);

      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('customer_id', 'cust_001');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  // =========================================================================
  // POST /kyc/retry
  // =========================================================================
  describe('POST /kyc/retry', () => {
    it('should return 400 when customer_id is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Customer ID required');
    });

    it('should return 404 when no KYC submission found for customer', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_nonexistent' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'No KYC submission found');
    });

    it('should return 404 when submissions array is empty', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'No KYC submission found');
    });

    it('should return 400 when maximum retry attempts (3) are reached', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [
          { id: 'sub_1', status: 'rejected', created_at: '2024-01-15T10:00:00Z' },
          { id: 'sub_2', status: 'rejected', created_at: '2024-01-14T10:00:00Z' },
          { id: 'sub_3', status: 'rejected', created_at: '2024-01-13T10:00:00Z' },
        ],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Maximum retry attempts reached');
      expect(body).toHaveProperty('attempts_used', 3);
      expect(body).toHaveProperty('max_attempts', 3);
    });

    it('should return 400 when last submission is already verified', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [
          { id: 'sub_1', status: 'verified', created_at: '2024-01-15T10:00:00Z' },
        ],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Cannot retry');
      expect(body).toHaveProperty('message', 'KYC is already verified');
    });

    it('should return 200 with retry_allowed true when retry is eligible', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [
          { id: 'sub_1', status: 'rejected', created_at: '2024-01-15T10:00:00Z' },
        ],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('retry_allowed', true);
      expect(body).toHaveProperty('attempts_remaining', 2);
      expect(body).toHaveProperty('message', 'You can retry KYC verification. Please submit new documents.');
    });

    it('should return correct attempts_remaining when 2 previous submissions exist', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [
          { id: 'sub_1', status: 'rejected', created_at: '2024-01-15T10:00:00Z' },
          { id: 'sub_2', status: 'rejected', created_at: '2024-01-14T10:00:00Z' },
        ],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body).toHaveProperty('retry_allowed', true);
      expect(body).toHaveProperty('attempts_remaining', 1);
    });
  });

  // =========================================================================
  // Route not found
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown path', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/kyc/unknown/route/deep',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('should return 405 for wrong HTTP method on known path', async () => {
      const event = createEvent({
        httpMethod: 'DELETE',
        path: '/kyc/initiate',
      });

      const response = await handler(event);

      // DELETE /kyc/initiate - path matches POST /kyc/initiate but method differs
      expect(response.statusCode).toBe(405);
      const body = parseBody(response);
      expect(body).toHaveProperty('error', 'Method Not Allowed');
    });

    it('should return 204 for OPTIONS preflight request', async () => {
      const event = createEvent({
        httpMethod: 'OPTIONS',
        path: '/kyc/initiate',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(204);
    });
  });
});
