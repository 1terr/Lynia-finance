/**
 * KYC Service Handlers - Unit Tests
 *
 * Tests the individual route handlers for the KYC service:
 *   POST /kyc/initiate   -> handleInitiateKYC
 *   POST /kyc/callback   -> handleKYCCallback
 *   GET  /kyc/:customerId -> handleGetKYCStatus
 *   POST /kyc/retry       -> handleRetryKYC
 *
 * All database calls and external APIs are mocked.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
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

jest.mock('../../../shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn(),
  queryOne: jest.fn(),
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

jest.mock('../kyc-provider-factory', () => ({
  createKYCProvider: jest.fn(() => mockKYCProvider),
}));

// Provider instance mock
jest.mock('../handlers/provider-instance', () => ({
  kycProvider: mockKYCProvider,
}));

// Image processor mock
jest.mock('../image-processor', () => ({
  validateImage: jest.fn(),
  bufferToBase64: jest.fn(),
  downloadWhatsAppImage: jest.fn(),
  validateZimbabweIDNumber: jest.fn().mockReturnValue({ valid: true, normalized: '63-123456A78' }),
}));

// Response mock
jest.mock('../../../shared/utils/response', () => ({
  getSecurityHeaders: jest.fn().mockReturnValue({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }),
  successResponse: jest.fn().mockImplementation((data, statusCode) => ({
    statusCode: statusCode || 200,
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })),
  errorResponse: jest.fn().mockImplementation((msg, statusCode) => ({
    statusCode: statusCode || 500,
    body: JSON.stringify({ error: msg }),
    headers: { 'Content-Type': 'application/json' },
  })),
}));

// Logger mock
jest.mock('../../../shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
}));

// Process KYC result mock (for initiate handler synchronous result path)
jest.mock('../handlers/process-kyc-result', () => ({
  processKYCResult: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { handleInitiateKYC } from '../handlers/initiate-kyc';
import { handleKYCCallback } from '../handlers/callback-handler';
import { handleGetKYCStatus } from '../handlers/get-kyc-status';
import { handleRetryKYC } from '../handlers/retry-kyc';
import { validateZimbabweIDNumber } from '../image-processor';
import { processKYCResult } from '../handlers/process-kyc-result';
import { APIGatewayProxyEvent } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/kyc/initiate',
    body: null,
    headers: { 'Content-Type': 'application/json' },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123',
      apiId: 'test',
      authorizer: {},
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      identity: {
        accessKey: null, accountId: null, apiKey: null, apiKeyId: null,
        caller: null, clientCert: null, cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null, cognitoIdentityId: null,
        cognitoIdentityPoolId: null, principalOrgId: null,
        sourceIp: '127.0.0.1', user: null, userAgent: 'jest-test', userArn: null,
      },
      path: '/kyc/initiate',
      stage: 'test',
      requestId: 'test-req-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/kyc/initiate',
    },
    resource: '/kyc/initiate',
    ...overrides,
  };
}

function parseBody(response: { body: string }) {
  return JSON.parse(response.body);
}

const emptyAuth = { userId: '', email: '', roles: [] };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KYC Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  // =========================================================================
  // POST /kyc/initiate — handleInitiateKYC
  // =========================================================================

  describe('handleInitiateKYC', () => {
    const validBody = {
      customer_id: 'cust_001',
      id_number: '63-123456A78',
      id_image_base64: 'base64data...',
      selfie_image_base64: 'base64data...',
      first_name: 'John',
      last_name: 'Moyo',
    };

    it('should return 400 when required fields are missing', async () => {
      const event = createEvent({ body: JSON.stringify({ customer_id: 'cust_001' }) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body.error).toBe('Missing required fields');
      expect(body.required).toContain('id_number');
    });

    it('should return 400 when ID number is invalid', async () => {
      (validateZimbabweIDNumber as jest.Mock).mockReturnValueOnce({
        valid: false,
        error: 'Invalid ID format',
      });

      const event = createEvent({ body: JSON.stringify(validBody) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body.error).toBe('Invalid ID number');
    });

    it('should return 200 with existing status when KYC already verified', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'kyc_001', status: 'verified' },
        error: null,
      });

      const event = createEvent({ body: JSON.stringify(validBody) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.message).toBe('KYC already verified');
      expect(body.status).toBe('verified');
    });

    it('should return 200 with pending status when submission is already pending', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'kyc_002', status: 'pending', provider_job_id: 'pj_001' },
        error: null,
      });

      const event = createEvent({ body: JSON.stringify(validBody) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.message).toBe('KYC verification already in progress');
      expect(body.status).toBe('pending');
    });

    it('should submit to provider and create submission record on new initiation', async () => {
      // No existing submission
      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      mockKYCProvider.submitVerification.mockResolvedValueOnce({
        provider_job_id: 'didit_job_001',
        message: 'Verification submitted successfully',
      });

      // Insert returns submission
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'kyc_new_001' },
        error: null,
      });

      const event = createEvent({ body: JSON.stringify(validBody) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.success).toBe(true);
      expect(body.kyc_submission_id).toBe('kyc_new_001');
      expect(body.status).toBe('pending');
      expect(mockKYCProvider.submitVerification).toHaveBeenCalledTimes(1);
    });

    it('should process synchronous result when provider returns it', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const syncResult = { match_result: 'verified', confidence_score: 95 };
      mockKYCProvider.submitVerification.mockResolvedValueOnce({
        provider_job_id: 'didit_sync_001',
        message: 'Verification complete',
        synchronous_result: syncResult,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'kyc_sync_001' },
        error: null,
      });

      const event = createEvent({ body: JSON.stringify(validBody) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.status).toBe('processing');
      expect(processKYCResult).toHaveBeenCalledWith('kyc_sync_001', 'cust_001', syncResult);
    });

    it('should return 500 when saving submission fails', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      mockKYCProvider.submitVerification.mockResolvedValueOnce({
        provider_job_id: 'didit_err_001',
        message: 'OK',
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const event = createEvent({ body: JSON.stringify(validBody) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(500);
      const body = parseBody(response);
      expect(body.error).toBe('Failed to initiate KYC');
    });

    it('should return 400 when provider throws a KYC verification error', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      mockKYCProvider.submitVerification.mockRejectedValueOnce(
        new Error('KYC verification failed: provider rejected')
      );
      mockKYCProvider.handleError.mockReturnValueOnce({
        user_message: 'Verification could not be completed',
        retriable: true,
        retry_after: 300,
      });

      const event = createEvent({ body: JSON.stringify(validBody) });
      const response = await handleInitiateKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body.error).toBe('KYC verification failed');
      expect(body.retriable).toBe(true);
    });
  });

  // =========================================================================
  // POST /kyc/callback — handleKYCCallback
  // =========================================================================

  describe('handleKYCCallback', () => {
    const callbackPayload = {
      session_id: 'didit_session_001',
      status: 'Approved',
      vendor_data: 'cust_001',
    };

    const normalizedResult = {
      provider: 'didit' as const,
      provider_job_id: 'didit_session_001',
      confidence_score: 95,
      face_match_score: 92,
      liveness_score: 98,
      match_result: 'verified' as const,
      raw_response: callbackPayload as unknown as Record<string, unknown>,
      warnings: [],
    };

    beforeEach(() => {
      mockKYCProvider.verifyWebhookSignature.mockReturnValue(true);
      mockKYCProvider.parseWebhookPayload.mockReturnValue(normalizedResult);
    });

    it('should return 401 when signature header is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await handleKYCCallback(event, {}, emptyAuth);

      expect(response.statusCode).toBe(401);
      const body = parseBody(response);
      expect(body.error).toBe('Missing signature');
    });

    it('should return 401 when webhook signature is invalid', async () => {
      mockKYCProvider.verifyWebhookSignature.mockReturnValueOnce(false);

      const event = createEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'bad-sig' },
      });

      const response = await handleKYCCallback(event, {}, emptyAuth);

      expect(response.statusCode).toBe(401);
      const body = parseBody(response);
      expect(body.error).toBe('Invalid signature');
    });

    it('should return 404 when submission not found', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createEvent({
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-sig' },
      });

      const response = await handleKYCCallback(event, {}, emptyAuth);

      expect(response.statusCode).toBe(404);
      const body = parseBody(response);
      expect(body.error).toBe('Submission not found');
    });

    it('should return 200 with Already processed when submission already verified', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'kyc_001', status: 'verified', customer_id: 'cust_001' },
        error: null,
      });

      const event = createEvent({
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-sig' },
      });

      const response = await handleKYCCallback(event, {}, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.message).toBe('Already processed');
    });

    it('should process pending submission and return success', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'kyc_001', status: 'pending', customer_id: 'cust_001' },
        error: null,
      });

      const event = createEvent({
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-sig' },
      });

      const response = await handleKYCCallback(event, {}, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.message).toBe('Webhook processed successfully');
      expect(processKYCResult).toHaveBeenCalledWith('kyc_001', 'cust_001', normalizedResult);
    });

    it('should return 500 when DB throws during submission lookup', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(new Error('DB connection lost'));

      const event = createEvent({
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-sig' },
      });

      const response = await handleKYCCallback(event, {}, emptyAuth);

      expect(response.statusCode).toBe(500);
      const body = parseBody(response);
      expect(body.error).toBe('Internal server error');
    });
  });

  // =========================================================================
  // GET /kyc/:customerId — handleGetKYCStatus
  // =========================================================================

  describe('handleGetKYCStatus', () => {
    it('should return 400 when customerId param is missing', async () => {
      const event = createEvent({ httpMethod: 'GET', path: '/kyc/' });
      const response = await handleGetKYCStatus(event, {}, emptyAuth);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body.error).toBe('Customer ID required');
    });

    it('should return not_started when no submission found', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const event = createEvent({ httpMethod: 'GET', path: '/kyc/cust_001' });
      const response = await handleGetKYCStatus(event, { customerId: 'cust_001' }, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.kyc_status).toBe('not_started');
      expect(body.customer_id).toBe('cust_001');
    });

    it('should return submission status when found', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_001',
          status: 'verified',
          kyc_provider: 'didit',
          submitted_at: '2025-01-01T00:00:00Z',
          verified_at: '2025-01-01T01:00:00Z',
          rejected_at: null,
          verification_confidence: 95,
          verification_decision: 'APPROVED',
          verification_reason: 'All checks passed',
          manual_review_required: false,
        },
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/kyc/cust_001' });
      const response = await handleGetKYCStatus(event, { customerId: 'cust_001' }, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.kyc_status).toBe('verified');
      expect(body.kyc_submission_id).toBe('kyc_001');
      expect(body.verification_confidence).toBe(95);
      expect(body.kyc_provider).toBe('didit');
    });

    it('should return 500 when DB throws', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(new Error('Connection refused'));

      const event = createEvent({ httpMethod: 'GET', path: '/kyc/cust_001' });
      const response = await handleGetKYCStatus(event, { customerId: 'cust_001' }, emptyAuth);

      expect(response.statusCode).toBe(500);
      const body = parseBody(response);
      expect(body.error).toBe('Failed to fetch KYC status');
    });
  });

  // =========================================================================
  // POST /kyc/retry — handleRetryKYC
  // =========================================================================

  describe('handleRetryKYC', () => {
    it('should return 400 when customer_id is missing', async () => {
      const event = createEvent({ body: JSON.stringify({}) });
      const response = await handleRetryKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body.error).toBe('Customer ID required');
    });

    it('should return 404 when no submissions found', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({ data: [], error: null });

      const event = createEvent({ body: JSON.stringify({ customer_id: 'cust_001' }) });
      const response = await handleRetryKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(404);
      const body = parseBody(response);
      expect(body.error).toBe('No KYC submission found');
    });

    it('should return 400 when max retry attempts reached', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [{ status: 'rejected' }, { status: 'rejected' }, { status: 'rejected' }],
        error: null,
      });

      const event = createEvent({ body: JSON.stringify({ customer_id: 'cust_001' }) });
      const response = await handleRetryKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body.error).toBe('Maximum retry attempts reached');
      expect(body.attempts_used).toBe(3);
    });

    it('should return 400 when KYC is already verified', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [{ status: 'verified' }],
        error: null,
      });

      const event = createEvent({ body: JSON.stringify({ customer_id: 'cust_001' }) });
      const response = await handleRetryKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(400);
      const body = parseBody(response);
      expect(body.error).toBe('Cannot retry');
      expect(body.current_status).toBe('verified');
    });

    it('should allow retry when previous submission was rejected and under limit', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [{ status: 'rejected' }],
        error: null,
      });

      const event = createEvent({ body: JSON.stringify({ customer_id: 'cust_001' }) });
      const response = await handleRetryKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(200);
      const body = parseBody(response);
      expect(body.retry_allowed).toBe(true);
      expect(body.attempts_remaining).toBe(2);
    });

    it('should return 500 when DB throws', async () => {
      mockQueryBuilder.execute.mockRejectedValueOnce(new Error('DB timeout'));

      const event = createEvent({ body: JSON.stringify({ customer_id: 'cust_001' }) });
      const response = await handleRetryKYC(event, {}, emptyAuth);

      expect(response.statusCode).toBe(500);
      const body = parseBody(response);
      expect(body.error).toBe('Failed to check retry eligibility');
    });
  });
});
