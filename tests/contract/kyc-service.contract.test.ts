/**
 * KYC Service - API Contract Tests
 *
 * Validates that all KYC service endpoints conform to
 * their API contracts: request validation, response shapes,
 * Zimbabwe ID format validation, retry limits, and error handling.
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
  expectErrorResponse,
  expectCORSHeaders,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks - declared before importing the handler
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockDb = {
  from: jest.fn(() => mockQueryBuilder),
};

jest.mock('../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

const mockSubmitVerification = jest.fn();
const mockVerifyWebhookSignature = jest.fn().mockReturnValue(true);
const mockParseWebhookPayload = jest.fn();
const mockDetermineDecision = jest.fn();
const mockHandleError = jest.fn();

jest.mock('../../services/kyc-service/src/kyc-provider-factory', () => ({
  createKYCProvider: jest.fn(() => ({
    providerName: 'smile_identity',
    submitVerification: mockSubmitVerification,
    verifyWebhookSignature: mockVerifyWebhookSignature,
    parseWebhookPayload: mockParseWebhookPayload,
    determineDecision: mockDetermineDecision,
    handleError: mockHandleError,
  })),
}));

jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  post: jest.fn().mockResolvedValue({ data: { messages: [{ id: 'msg_test' }] } }),
  get: jest.fn().mockResolvedValue({ data: {} }),
  isAxiosError: jest.fn().mockReturnValue(false),
}));

jest.mock('../../services/kyc-service/src/image-processor', () => ({
  validateImage: jest.fn().mockReturnValue({ valid: true, size: 5000, format: 'jpeg' }),
  bufferToBase64: jest.fn().mockReturnValue('data:image/jpeg;base64,abc123'),
  downloadWhatsAppImage: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  validateZimbabweIDNumber: jest.fn().mockImplementation((id: string) => {
    const cleaned = id.trim().replace(/[\s./-]/g, '');
    const pattern = /^(\d{2})(\d{6,7})([A-Z])(\d{2})$/i;
    const match = cleaned.match(pattern);
    if (!match) {
      return {
        valid: false,
        error: 'Invalid ID number format. Expected format: XX-XXXXXXX-X-XX (e.g., 63-2345678-B-08)',
      };
    }
    return { valid: true, normalized: `${match[1]}-${match[2]}${match[3].toUpperCase()}${match[4]}` };
  }),
}));

import { handler } from '../../services/kyc-service/src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitiateKYCBody(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: 'cust_001',
    id_number: '63-123456A47',
    id_image_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJ...',
    selfie_image_base64: 'data:image/jpeg;base64,/9j/4BBRSkZK...',
    first_name: 'John',
    last_name: 'Moyo',
    dob: '1990-05-15',
    phone_number: '+263771234567',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KYC Service Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Supabase client
    mockDb.from.mockReturnValue(mockQueryBuilder);
    // Reset query builder defaults
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.insert.mockReturnThis();
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.neq.mockReturnThis();
    mockQueryBuilder.in.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();
    mockQueryBuilder.single.mockReturnThis();
    mockQueryBuilder.maybeSingle.mockReturnThis();
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // POST /kyc/initiate
  // =========================================================================
  describe('POST /kyc/initiate', () => {
    it('should return 200 with submission details on success', async () => {
      // No existing submission
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      // KYC provider submission
      mockSubmitVerification.mockResolvedValue({
        success: true,
        provider_job_id: 'provider_job_001',
        internal_job_id: 'job_001',
        message: 'KYC verification submitted.',
      });

      // Insert submission
      mockQueryBuilder.execute
        .mockResolvedValueOnce({
          data: {
            id: 'kyc_sub_001',
            customer_id: 'cust_001',
            status: 'pending',
          },
          error: null,
        });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(buildInitiateKYCBody()),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('kyc_submission_id', 'kyc_sub_001');
      expect(body).toHaveProperty('provider_job_id', 'provider_job_001');
      expect(body).toHaveProperty('status', 'pending');
    });

    it('should return 400 when customer_id is missing', async () => {
      const body = buildInitiateKYCBody();
      delete (body as Record<string, unknown>).customer_id;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Missing required fields');
      expect(parsed).toHaveProperty('required');
      expect((parsed as Record<string, unknown>).required).toEqual(
        expect.arrayContaining(['customer_id', 'id_number', 'id_image_base64', 'selfie_image_base64']),
      );
    });

    it('should return 400 when id_number is missing', async () => {
      const body = buildInitiateKYCBody();
      delete (body as Record<string, unknown>).id_number;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when id_image_base64 is missing', async () => {
      const body = buildInitiateKYCBody();
      delete (body as Record<string, unknown>).id_image_base64;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when selfie_image_base64 is missing', async () => {
      const body = buildInitiateKYCBody();
      delete (body as Record<string, unknown>).selfie_image_base64;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 for invalid Zimbabwe ID number format', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(buildInitiateKYCBody({ id_number: 'INVALID-ID' })),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Invalid ID number');
      expect(parsed).toHaveProperty('message');
    });

    it('should return existing status when KYC is already verified', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_existing',
          customer_id: 'cust_001',
          status: 'verified',
        },
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(buildInitiateKYCBody()),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('success', true);
      expect(parsed).toHaveProperty('message', 'KYC already verified');
      expect(parsed).toHaveProperty('status', 'verified');
      expect(parsed).toHaveProperty('kyc_submission_id', 'kyc_sub_existing');
    });

    it('should return existing status when KYC is already pending', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_pending',
          customer_id: 'cust_001',
          status: 'pending',
          provider_job_id: 'pending_provider_job',
        },
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(buildInitiateKYCBody()),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('success', true);
      expect(parsed).toHaveProperty('message', 'KYC verification already in progress');
      expect(parsed).toHaveProperty('status', 'pending');
      expect(parsed).toHaveProperty('kyc_submission_id', 'kyc_sub_pending');
      expect(parsed).toHaveProperty('provider_job_id', 'pending_provider_job');
    });

    it('should return 500 when KYC provider submission fails', async () => {
      // No existing submission
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSubmitVerification.mockRejectedValue(new Error('KYC provider unavailable'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify(buildInitiateKYCBody()),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error');
    });
  });

  // =========================================================================
  // POST /kyc/callback
  // =========================================================================
  describe('POST /kyc/callback', () => {
    const callbackPayload = {
      partner_id: 'partner_001',
      smile_job_id: 'smile_job_001',
      job_success: true,
      result: {
        confidence_value: 0.95,
        liveness_check: { score: 0.98 },
        face_match: { score: 0.92 },
        id_info: {
          full_name: 'John Moyo',
          dob: '1990-05-15',
          gender: 'M',
        },
      },
      partner_params: {
        user_id: 'cust_001',
        job_id: 'job_001',
      },
    };

    /** Normalized KYCVerificationResult returned by parseWebhookPayload */
    const normalizedResult = {
      provider: 'smile_identity' as const,
      provider_job_id: 'job_001',
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
      raw_response: callbackPayload,
      warnings: [],
    };

    it('should return 200 with success message for APPROVED callback', async () => {
      // Parse webhook returns normalized result
      mockParseWebhookPayload.mockReturnValue(normalizedResult);

      // Fetch submission by provider_job_id
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineDecision.mockReturnValue({
        decision: 'APPROVED',
        reason: 'All checks passed',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-smile-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const parsed = parseResponseBody(response);
      expect(parsed).toEqual({ message: 'Webhook processed successfully' });
    });

    it('should verify x-signature header when present', async () => {
      // Parse webhook returns normalized result
      mockParseWebhookPayload.mockReturnValue(normalizedResult);

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineDecision.mockReturnValue({
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
          'x-signature': 'some-sig-value',
        },
      });

      await handler(event);

      expect(mockVerifyWebhookSignature).toHaveBeenCalledWith('some-sig-value', bodyStr, undefined);
    });

    it('should return 401 when signature verification fails', async () => {
      mockVerifyWebhookSignature.mockReturnValueOnce(false);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'bad-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Invalid signature');
    });

    it('should return 404 when submission not found', async () => {
      // Parse webhook returns normalized result
      mockParseWebhookPayload.mockReturnValue(normalizedResult);

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Submission not found');
    });

    it('should process REJECTED decision correctly', async () => {
      // Parse webhook returns normalized result
      mockParseWebhookPayload.mockReturnValue({
        ...normalizedResult,
        match_result: 'not_verified' as const,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineDecision.mockReturnValue({
        decision: 'REJECTED',
        reason: 'ID verification failed',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify({ ...callbackPayload, job_success: false }),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // Verify update was called with rejected status
      expect(mockDb.from).toHaveBeenCalledWith('kyc_submissions');
    });

    it('should process MANUAL_REVIEW decision correctly', async () => {
      // Parse webhook returns normalized result with low confidence
      mockParseWebhookPayload.mockReturnValue({
        ...normalizedResult,
        confidence_score: 55,
        match_result: 'manual_review' as const,
      });

      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          provider_job_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineDecision.mockReturnValue({
        decision: 'MANUAL_REVIEW',
        reason: 'Low confidence score',
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // Should create manual review task
      expect(mockDb.from).toHaveBeenCalledWith('kyc_manual_reviews');
    });

    it('should return 500 when callback processing throws', async () => {
      // Parse webhook returns normalized result
      mockParseWebhookPayload.mockReturnValue(normalizedResult);

      mockQueryBuilder.execute.mockRejectedValue(new Error('DB connection lost'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(callbackPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error');
    });
  });

  // =========================================================================
  // GET /kyc/{customerId}
  // =========================================================================
  describe('GET /kyc/{customerId}', () => {
    it('should return 200 with KYC status when submission exists', async () => {
      const submissionData = {
        id: 'kyc_sub_001',
        customer_id: 'cust_001',
        status: 'verified',
        submitted_at: '2024-01-15T10:00:00Z',
        verified_at: '2024-01-15T10:05:00Z',
        rejected_at: null,
        verification_confidence: 0.95,
        verification_decision: 'APPROVED',
        verification_reason: 'All checks passed',
        manual_review_required: false,
      };

      mockQueryBuilder.execute.mockResolvedValue({ data: submissionData, error: null });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
        pathParameters: { customerId: 'cust_001' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('customer_id', 'cust_001');
      expect(body).toHaveProperty('kyc_status', 'verified');
      expect(body).toHaveProperty('kyc_submission_id', 'kyc_sub_001');
      expect(body).toHaveProperty('submitted_at');
      expect(body).toHaveProperty('verified_at');
      expect(body).toHaveProperty('verification_confidence');
      expect(body).toHaveProperty('verification_decision');
      expect(body).toHaveProperty('verification_reason');
      expect(body).toHaveProperty('manual_review_required');
    });

    it('should return kyc_status: not_started when no submission found', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_new',
        pathParameters: { customerId: 'cust_new' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('customer_id', 'cust_new');
      expect(body).toHaveProperty('kyc_status', 'not_started');
      expect(body).toHaveProperty('message', 'No KYC submission found');
    });

    it('should return 400 when customerId is not provided', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/kyc/undefined',
        pathParameters: { customerId: undefined as unknown as string },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Customer ID required');
    });

    it('should return 500 when database query fails', async () => {
      mockQueryBuilder.execute.mockRejectedValue(new Error('Timeout'));

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_001',
        pathParameters: { customerId: 'cust_001' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // POST /kyc/retry
  // =========================================================================
  describe('POST /kyc/retry', () => {
    it('should return 200 with retry allowed when under max attempts', async () => {
      // Return 2 previous submissions (under limit of 3)
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [
          { id: 'sub_1', status: 'rejected', created_at: '2024-01-01' },
          { id: 'sub_2', status: 'rejected', created_at: '2024-01-02' },
        ],
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('retry_allowed', true);
      expect(body).toHaveProperty('attempts_remaining', 1);
      expect(body).toHaveProperty('message');
    });

    it('should return 400 when customer_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Customer ID required');
    });

    it('should return 404 when no KYC submission found', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_no_kyc' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'No KYC submission found');
    });

    it('should return 400 when maximum retry attempts (3) reached', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [
          { id: 'sub_1', status: 'rejected', created_at: '2024-01-01' },
          { id: 'sub_2', status: 'rejected', created_at: '2024-01-02' },
          { id: 'sub_3', status: 'rejected', created_at: '2024-01-03' },
        ],
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Maximum retry attempts reached');
      expect(body).toHaveProperty('attempts_used', 3);
      expect(body).toHaveProperty('max_attempts', 3);
    });

    it('should return 400 when KYC is already verified', async () => {
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: [
          { id: 'sub_1', status: 'verified', created_at: '2024-01-01' },
        ],
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_verified' }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Cannot retry');
      expect(body).toHaveProperty('message', 'KYC is already verified');
      expect(body).toHaveProperty('current_status', 'verified');
    });

    it('should return 500 when retry check throws', async () => {
      mockQueryBuilder.order.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/retry',
        body: JSON.stringify({ customer_id: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // 404 - Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/kyc/unknown/endpoint',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('should include proper headers on 404 responses', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        path: '/kyc/initiate',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://lyniafinance.com');
    });
  });

  // =========================================================================
  // Top-level error handling
  // =========================================================================
  describe('Top-level error handling', () => {
    it('should return 500 on unexpected errors', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: '<<<INVALID-JSON>>>',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});
