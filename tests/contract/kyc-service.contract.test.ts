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
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockSupabaseClient = {
  from: jest.fn(() => mockQueryBuilder),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

const mockSubmitEnhancedKYC = jest.fn();
const mockVerifyWebhookSignature = jest.fn().mockReturnValue(true);
const mockDetermineVerificationDecision = jest.fn();
const mockHandleSmileError = jest.fn();

jest.mock('../../services/kyc-service/src/smile-identity-service', () => ({
  SmileIdentityService: jest.fn().mockImplementation(() => ({
    submitEnhancedKYC: mockSubmitEnhancedKYC,
    verifyWebhookSignature: mockVerifyWebhookSignature,
    determineVerificationDecision: mockDetermineVerificationDecision,
    handleSmileError: mockHandleSmileError,
  })),
}));

jest.mock('../../services/kyc-service/src/image-processor', () => ({
  validateImage: jest.fn().mockReturnValue({ valid: true, size: 5000, format: 'jpeg' }),
  bufferToBase64: jest.fn().mockReturnValue('data:image/jpeg;base64,abc123'),
  downloadWhatsAppImage: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  validateZimbabweIDNumber: jest.fn().mockImplementation((id: string) => {
    const pattern = /^(\d{2})-(\d{6})([A-Z])(\d{2})$/i;
    const match = id.trim().match(pattern);
    if (!match) {
      return {
        valid: false,
        error: 'Invalid ID number format. Expected format: XX-XXXXXXAXX (e.g., 63-123456A47)',
      };
    }
    return { valid: true, normalized: id.trim().toUpperCase() };
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
    // Reset query builder defaults
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.insert.mockReturnThis();
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.neq.mockReturnThis();
    mockQueryBuilder.in.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();
    mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // POST /kyc/initiate
  // =========================================================================
  describe('POST /kyc/initiate', () => {
    it('should return 200 with submission details on success', async () => {
      // No existing submission
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      // Smile Identity submission
      mockSubmitEnhancedKYC.mockResolvedValue({
        job_id: 'job_001',
        smile_job_id: 'smile_job_001',
        message: 'KYC verification submitted successfully',
      });

      // Insert submission
      mockQueryBuilder.single
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
      expect(body).toHaveProperty('smile_job_id', 'smile_job_001');
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
      mockQueryBuilder.single.mockResolvedValueOnce({
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
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_pending',
          customer_id: 'cust_001',
          status: 'pending',
          smile_identity_transaction_id: 'smile_pending_job',
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
      expect(parsed).toHaveProperty('smile_job_id', 'smile_pending_job');
    });

    it('should return 500 when Smile Identity submission fails', async () => {
      // No existing submission
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSubmitEnhancedKYC.mockRejectedValue(new Error('Smile API unavailable'));

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

    it('should return 200 with success message for APPROVED callback', async () => {
      // Fetch submission
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          smile_identity_transaction_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineVerificationDecision.mockReturnValue({
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
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          smile_identity_transaction_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineVerificationDecision.mockReturnValue({
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

      expect(mockVerifyWebhookSignature).toHaveBeenCalledWith('some-sig-value', bodyStr);
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
      mockQueryBuilder.single.mockResolvedValueOnce({
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
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          smile_identity_transaction_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineVerificationDecision.mockReturnValue({
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('kyc_submissions');
    });

    it('should process MANUAL_REVIEW decision correctly', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'kyc_sub_001',
          customer_id: 'cust_001',
          smile_identity_transaction_id: 'job_001',
          status: 'pending',
        },
        error: null,
      });

      mockDetermineVerificationDecision.mockReturnValue({
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('kyc_manual_reviews');
    });

    it('should return 500 when callback processing throws', async () => {
      mockQueryBuilder.single.mockRejectedValue(new Error('DB connection lost'));

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

      mockQueryBuilder.single.mockResolvedValue({ data: submissionData, error: null });

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
      mockQueryBuilder.single.mockResolvedValue({
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
      mockQueryBuilder.single.mockRejectedValue(new Error('Timeout'));

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
      mockQueryBuilder.single.mockImplementation(() => {
        throw new Error('Do not call single for array results');
      });
      // For /kyc/retry, submissions are returned as array (no .single())
      // The handler uses .order() which returns the query builder, then accesses data directly
      // We need to make the chain resolve to { data: [...], error: null }
      mockQueryBuilder.order.mockReturnValue({
        data: [
          { id: 'sub_1', status: 'rejected', created_at: '2024-01-01' },
          { id: 'sub_2', status: 'rejected', created_at: '2024-01-02' },
        ],
        error: null,
      } as unknown as typeof mockQueryBuilder);

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
      mockQueryBuilder.order.mockReturnValue({
        data: null,
        error: null,
      } as unknown as typeof mockQueryBuilder);

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
      mockQueryBuilder.order.mockReturnValue({
        data: [
          { id: 'sub_1', status: 'rejected', created_at: '2024-01-01' },
          { id: 'sub_2', status: 'rejected', created_at: '2024-01-02' },
          { id: 'sub_3', status: 'rejected', created_at: '2024-01-03' },
        ],
        error: null,
      } as unknown as typeof mockQueryBuilder);

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
      mockQueryBuilder.order.mockReturnValue({
        data: [
          { id: 'sub_1', status: 'verified', created_at: '2024-01-01' },
        ],
        error: null,
      } as unknown as typeof mockQueryBuilder);

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
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://admin.lynia.finance');
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
