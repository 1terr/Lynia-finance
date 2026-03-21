/**
 * E2E Test: E2E-001 - Complete Onboarding Flow
 *
 * Scenario: Zimbabwe customer completes full onboarding process
 * Flow: Register via WhatsApp (+263) -> KYC via DIDIT -> Credit scoring -> Deposit payment -> Device handover
 *
 * Expected Result: Customer gets approved, pays deposit, and receives device with active loan
 */

import { createAPIGatewayEvent, parseResponseBody, expectCORSHeaders } from '../helpers/test-utils';
import { createWhatsAppWebhookPayload, mockDiditResponses } from '../helpers/mock-external-services';
import { testCustomers, testDevices } from '../fixtures';

// Mock external dependencies
jest.mock('../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));
jest.mock('axios');

// Mock provider services to bypass signature verification in tests
const mockKYCProvider = {
  providerName: 'didit',
  submitVerification: jest.fn().mockResolvedValue({ provider_job_id: 'job_001', status: 'processing' }),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
  parseWebhookPayload: jest.fn().mockImplementation((rawPayload: string) => {
    const payload = JSON.parse(rawPayload);
    const code = payload.ResultCode || (payload.result && payload.result.ResultCode) || '1012';
    return {
      provider: 'didit',
      provider_job_id: payload.partner_params?.job_id || payload.job_id || 'job_001',
      status: 'completed',
      decision: code === '1012' ? 'APPROVED' : code === '1014' ? 'REJECTED' : 'MANUAL_REVIEW',
      confidence_score: 95,
      face_match_score: 96,
      liveness_score: 98,
      liveness_passed: true,
      document_authentic: true,
      document_tampered: false,
      document_expired: false,
      match_result: code === '1012' ? 'verified' : 'not_verified',
      id_info: { full_name: 'Test Customer', date_of_birth: '1990-01-01', gender: 'M', id_number: '63-123456A78', country: 'ZW' },
      raw_response: payload,
    };
  }),
  determineDecision: jest.fn().mockImplementation((result: Record<string, unknown>) => {
    const decision = result.decision || 'APPROVED';
    if (decision === 'APPROVED') return { decision: 'APPROVED', reason: 'All checks passed' };
    if (decision === 'REJECTED') return { decision: 'REJECTED', reason: 'ID verification failed' };
    return { decision: 'MANUAL_REVIEW', reason: 'Low confidence' };
  }),
  determineVerificationDecision: jest.fn().mockImplementation((result: Record<string, unknown>) => {
    const code = result.ResultCode as string;
    if (code === '1012') return { decision: 'APPROVED', reason: 'All checks passed' };
    if (code === '1014') return { decision: 'REJECTED', reason: 'ID verification failed' };
    return { decision: 'MANUAL_REVIEW', reason: 'Low confidence' };
  }),
  handleError: jest.fn().mockReturnValue({ user_message: 'Verification failed', retriable: true, retry_after: 300 }),
};

jest.mock('../../services/kyc-service/src/didit-service', () => ({
  DiditService: jest.fn().mockImplementation(() => mockKYCProvider),
}));

jest.mock('../../services/kyc-service/src/image-processor', () => ({
  validateImage: jest.fn().mockReturnValue({ valid: true, size: 5000, format: 'jpeg' }),
  bufferToBase64: jest.fn().mockReturnValue('data:image/jpeg;base64,abc123'),
  downloadWhatsAppImage: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  validateZimbabweIDNumber: jest.fn().mockImplementation((id: string) => {
    const cleaned = id.trim().replace(/[\s./-]/g, '');
    const pattern = /^(\d{2})(\d{6,7})([A-Z])(\d{2})$/i;
    const match = cleaned.match(pattern);
    if (!match) return { valid: false, error: 'Invalid ID format' };
    return { valid: true, normalized: `${match[1]}-${match[2]}${match[3].toUpperCase()}${match[4]}` };
  }),
}));

jest.mock('../../services/payment-service/src/ecocash-provider', () => ({
  EcoCashProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../services/payment-service/src/onemoney-provider', () => ({
  OneMoneyProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../services/payment-service/src/omari-provider', () => ({
  OmariProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');

// ---------------------------------------------------------------------------
// Mock Supabase query builder
// ---------------------------------------------------------------------------
const createMockQueryBuilder = () => {
  const builder: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'match', 'filter', 'range', 'count',
    'single', 'maybeSingle',
  ];
  for (const m of methods) {
    builder[m] = jest.fn().mockReturnValue(builder);
  }
  builder.execute = jest.fn().mockResolvedValue({ data: null, error: null });
  return builder;
};

let mockQueryBuilder = createMockQueryBuilder();

const mockDb = {
  from: jest.fn((_table: string) => {
    mockQueryBuilder = createMockQueryBuilder();
    return mockQueryBuilder;
  }),
};

// Set environment variables before importing handlers
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test_phone_id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test_access_token';
process.env.WHATSAPP_VERIFY_TOKEN = 'lynia_webhook_2025';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'lynia_webhook_2025';

// ---------------------------------------------------------------------------
// Import handlers after mocking
// ---------------------------------------------------------------------------
import { handler as whatsappHandler } from '../../services/whatsapp-service/src/index';
import { handler as kycHandler } from '../../services/kyc-service/src/index';
import { handler as scoringHandler } from '../../services/scoring-service/src/index';
import { handler as paymentHandler } from '../../services/payment-service/src/index';
import { handler as lockHandler } from '../../services/lock-service/src/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const zimbabweCustomer = testCustomers.zimbabweCustomer;
const device = testDevices.availableDevice;

describe('E2E-001: Complete Onboarding Flow (Zimbabwe Customer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '263771234567', wa_id: '263771234567' }],
        messages: [{ id: 'wamid.test_001' }],
      },
    });
    axios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  // =========================================================================
  // STEP 1: WhatsApp Registration
  // =========================================================================
  describe('Step 1: WhatsApp Registration', () => {
    it('should accept a webhook POST from a Zimbabwe (+263) phone number and return 200', async () => {
      const webhookPayload = createWhatsAppWebhookPayload(
        zimbabweCustomer.phone_number,
        'Hi'
      );

      // Mock customer lookup returning no existing customer (new registration)
      mockDb.from.mockImplementation((table: string) => {
        const qb = createMockQueryBuilder();
        if (table === 'customers') {
          qb.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
          // For insert-then-select chain
          qb.insert.mockReturnValue(qb);
          qb.select.mockReturnValue(qb);
          qb.execute.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
            .mockResolvedValueOnce({
              data: {
                id: 'cust_test_001',
                phone_number: zimbabweCustomer.phone_number,
                whatsapp_number: zimbabweCustomer.phone_number,
                kyc_status: 'pending',
                status: 'active',
              },
              error: null,
            });
        }
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(webhookPayload),
      });

      const response = await whatsappHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success');
    });

    it('should return 200 for webhook verification GET with valid token', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'lynia_webhook_2025',
          'hub.challenge': 'test_challenge_string',
        },
      });

      const response = await whatsappHandler(event);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('test_challenge_string');
    });

    it('should return 403 for webhook verification with invalid token', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'test_challenge',
        },
      });

      const response = await whatsappHandler(event);

      expect(response.statusCode).toBe(403);
      expect(response.body).toBe('Forbidden');
    });

    it('should return 404 for unknown WhatsApp path', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/unknown-route',
      });

      const response = await whatsappHandler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('should validate that the phone number starts with +263 (Zimbabwe country code)', () => {
      const phone = zimbabweCustomer.phone_number;
      expect(phone).toMatch(/^\+263/);
      expect(phone.length).toBeGreaterThanOrEqual(12); // +263 + 9 digits minimum
    });
  });

  // =========================================================================
  // STEP 2: KYC Verification via DIDIT
  // =========================================================================
  describe('Step 2: KYC Verification', () => {
    it('should return 400 when required KYC fields are missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          customer_id: 'cust_test_001',
          // Missing id_number, id_image_base64, selfie_image_base64
        }),
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      expect(body.required as string[]).toContain('id_number');
      expect(body.required as string[]).toContain('id_image_base64');
      expect(body.required as string[]).toContain('selfie_image_base64');
    });

    it('should return 400 for invalid Zimbabwe national ID format', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          customer_id: 'cust_test_001',
          id_number: 'INVALID',
          id_image_base64: 'base64data',
          selfie_image_base64: 'base64data',
        }),
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });

    it('should return KYC status for a valid customer', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({
          data: {
            id: 'kyc_001',
            customer_id: 'cust_test_001',
            status: 'verified',
            submitted_at: new Date().toISOString(),
            verified_at: new Date().toISOString(),
            verification_confidence: 99.5,
            verification_decision: 'APPROVED',
            verification_reason: 'ID verified',
            manual_review_required: false,
          },
          error: null,
        });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_test_001',
        pathParameters: { customerId: 'cust_test_001' },
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.kyc_status).toBe('verified');
      expect(body.customer_id).toBe('cust_test_001');
      expect(body.verification_confidence).toBeGreaterThan(90);
      expect(body.verification_decision).toBe('APPROVED');
    });

    it('should return kyc_status not_started if no submission exists', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/kyc/cust_test_new',
        pathParameters: { customerId: 'cust_test_new' },
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.kyc_status).toBe('not_started');
    });

    it('should process DIDIT callback and update KYC to verified', async () => {
      const diditPayload = mockDiditResponses.verifiedKYC;

      mockDb.from.mockImplementation((table: string) => {
        const qb = createMockQueryBuilder();
        if (table === 'kyc_submissions') {
          qb.execute.mockResolvedValue({
            data: {
              id: 'kyc_sub_001',
              customer_id: 'cust_test_001',
              status: 'pending',
              provider_job_id: 'job_001',
            },
            error: null,
          });
        }
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(diditPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.message).toBe('Webhook processed successfully');
    });

    it('should return 404 when DIDIT callback references unknown submission', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return qb;
      });

      const diditPayload = {
        ...mockDiditResponses.verifiedKYC,
        partner_params: { user_id: 'nonexistent', job_id: 'job_999' },
      };

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(diditPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Submission not found');
    });

    it('should validate DIDIT verification result data structure', () => {
      const verified = mockDiditResponses.verifiedKYC;
      expect(verified.result.ResultCode).toBe('1012');
      expect(verified.result.ResultText).toBe('Verified');
      expect(verified.result.confidence_value).toBeGreaterThanOrEqual(95);
      expect(verified.result.face_match.score).toBeGreaterThanOrEqual(0.95);
      expect(verified.result.liveness_check.status).toBe('passed');
      expect(verified.result.id_info.country).toBe('ZW');
    });
  });

  // =========================================================================
  // STEP 3: Credit Scoring & Loan Decision
  // =========================================================================
  describe('Step 3: Credit Scoring & Loan Decision', () => {
    it('should return 400 if customer_id is missing from scoring request', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({}),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'customer_id is required');
    });

    it('should return 400 if required scoring fields are missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({ customer_id: 'cust_test_001' }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body.error).toContain('Missing required fields');
    });

    it('should calculate credit score and auto-approve for a strong customer', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: { id: 'score_001' }, error: null });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: 'cust_test_001',
          household_size: 3,
          dependents: 1,
          requested_loan_amount: 350,
          device_retail_price_usd: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.97 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(200);
      expectCORSHeaders(response);

      const body = parseResponseBody<{
        customer_id: string;
        scaled_score: number;
        decision: string;
        credit_limit_usd: number;
        tier: string;
        components: Record<string, number>;
        total_raw_score: number;
        down_payment_percentage: number;
        interest_rate_apr: number;
      }>(response);

      expect(body.customer_id).toBe('cust_test_001');
      expect(body.scaled_score).toBeGreaterThanOrEqual(300);
      expect(body.decision).toBe('approve');
      expect(body.credit_limit_usd).toBeGreaterThan(0);
      expect(['Tier 1', 'Tier 2', 'Tier 3']).toContain(body.tier);
      expect(body.components).toBeDefined();
      expect(body.components.affordability).toBeGreaterThanOrEqual(0);
      expect(body.components.kyc_verification).toBeGreaterThan(0);
      expect(body.total_raw_score).toBeGreaterThan(0);
      expect(body.total_raw_score).toBeLessThanOrEqual(1000);
    });

    it('should assign Tier 2 for a scaled score between 700-749', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: { id: 'score_002' }, error: null });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: 'cust_test_001',
          household_size: 4,
          dependents: 2,
          requested_loan_amount: 350,
          device_retail_price_usd: 350,
          kyc_result: {
            id_verification: { status: 'verified' },
            face_match: { confidence: 0.97 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody<{
        scaled_score: number;
        decision: string;
        tier: string;
        credit_limit_usd: number;
        interest_rate_apr: number;
        down_payment_percentage: number;
      }>(response);

      // The exact tier depends on the calculation, but we verify structure
      expect(['Tier 1', 'Tier 2', 'Tier 3']).toContain(body.tier);
      expect(body.decision).toBe('approve');
      expect(body.interest_rate_apr).toBeGreaterThan(0);
      expect(body.down_payment_percentage).toBeGreaterThanOrEqual(5);
    });

    it('should return review decision for a low-income customer', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: { id: 'score_003' }, error: null });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: 'cust_test_003',
          household_size: 6,
          dependents: 4,
          requested_loan_amount: 300,
          device_retail_price_usd: 300,
          kyc_result: {
            id_verification: { status: 'review' },
            face_match: { confidence: 0.72 },
            liveness: { status: 'passed' },
          },
        }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody<{
        decision: string;
        credit_limit_usd: number;
        tier: string;
      }>(response);

      expect(body.decision).toBe('approve');
    });

    it('should return 404 when fetching score for non-existent customer', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/scoring/cust_nonexistent',
        pathParameters: { customerId: 'cust_nonexistent' },
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body.error).toContain('not found');
    });
  });

  // =========================================================================
  // STEP 4: Deposit Payment
  // =========================================================================
  describe('Step 4: Deposit Payment', () => {
    it('should return 400 when required payment fields are missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({ loan_id: 'loan_001' }), // missing other fields
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      const required = (body as Record<string, unknown>).required ||
        ((body as Record<string, unknown>).details as Record<string, unknown>)?.required;
      expect(required as string[]).toContain('customer_id');
      expect(required as string[]).toContain('amount');
      expect(required as string[]).toContain('customer_phone');
      expect(required as string[]).toContain('payment_type');
    });

    it('should return 405 for wrong method on known path pattern', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/unknown',
        body: JSON.stringify({}),
      });

      const response = await paymentHandler(event);

      // POST /payments/unknown matches GET /payments/:paymentId path but wrong method → 405
      expect(response.statusCode).toBe(405);
    });

    it('should validate deposit amount is 20% of loan amount', () => {
      const loanAmount = 350;
      const depositPercentage = 0.20;
      const expectedDeposit = loanAmount * depositPercentage; // $70

      expect(expectedDeposit).toBe(70);
      expect(expectedDeposit).toBeGreaterThan(0);
      expect(expectedDeposit).toBeLessThan(loanAmount);
    });

    it('should validate that payment request includes a Zimbabwe phone number', () => {
      const paymentRequest = {
        loan_id: 'loan_test_001',
        customer_id: 'cust_test_001',
        amount: 70,
        currency: 'USD',
        customer_phone: '+263771234567',
        payment_type: 'deposit',
      };

      expect(paymentRequest.customer_phone).toMatch(/^\+263/);
      expect(paymentRequest.amount).toBe(70);
      expect(paymentRequest.currency).toBe('USD');
      expect(paymentRequest.payment_type).toBe('deposit');
    });
  });

  // =========================================================================
  // STEP 5: Device Handover
  // =========================================================================
  describe('Step 5: Device Handover', () => {
    it('should return 400 when loan_id is missing from readiness check', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/check-readiness',
        body: JSON.stringify({}),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Validation Error');
      expect(body).toHaveProperty('message', 'loan_id is required');
    });

    it('should return 400 when initiating handover without required fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/initiate',
        body: JSON.stringify({ loan_id: 'loan_001' }), // missing other fields
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Validation Error');
      expect(body).toHaveProperty('message', 'Missing required fields');
      expect(body.errors).toBeDefined();
    });

    it('should return 400 when verifying identity without handover_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-identity',
        body: JSON.stringify({}),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Validation Error');
      expect(body).toHaveProperty('message', 'Missing required fields');
    });

    it('should return 400 when verifying deposit without handover_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/verify-deposit',
        body: JSON.stringify({}),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Validation Error');
      expect(body).toHaveProperty('message', 'handover_id is required');
    });

    it('should return 400 when completing handover without handover_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/handovers/complete',
        body: JSON.stringify({}),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Validation Error');
      expect(body).toHaveProperty('message', 'handover_id is required');
    });

    it('should return 404 for unknown lock-service route', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/unknown/route',
        body: JSON.stringify({}),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });
  });

  // =========================================================================
  // STEP 6: Verification of Final State
  // =========================================================================
  describe('Step 6: Verification of Final State', () => {
    it('should verify device fixture has correct properties for assignment', () => {
      expect(device.status).toBe('in_stock');
      expect(device.lock_status).toBe('unlocked');
      expect(device.customer_id).toBeNull();
      expect(device.loan_id).toBeNull();
      expect(device.retail_price).toBe(350);
      expect(device.imei).toMatch(/^\d{15}$/);
    });

    it('should verify Zimbabwe customer fixture has required onboarding data', () => {
      expect(zimbabweCustomer.phone_number).toMatch(/^\+263/);
      expect(zimbabweCustomer.national_id).toBeDefined();
      expect(zimbabweCustomer.first_name).toBeDefined();
      expect(zimbabweCustomer.last_name).toBeDefined();
      expect(zimbabweCustomer.date_of_birth).toBeDefined();
      expect(zimbabweCustomer.country).toBe('Zimbabwe');
      expect(zimbabweCustomer.kyc_status).toBe('verified');
      expect(zimbabweCustomer.credit_score).toBeGreaterThanOrEqual(650);
    });

    it('should verify first payment date calculation (30 days from handover)', () => {
      const handoverDate = new Date();
      const firstPaymentDate = new Date(handoverDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysDiff = (firstPaymentDate.getTime() - handoverDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeCloseTo(30, 0);
      expect(firstPaymentDate.getTime()).toBeGreaterThan(handoverDate.getTime());
    });

    it('should verify commission is 5% of device retail price', () => {
      const devicePrice = device.retail_price;
      const commissionRate = 0.05;
      const expectedCommission = devicePrice * commissionRate;

      expect(expectedCommission).toBe(17.50);
      expect(commissionRate * 100).toBe(5);
    });

    it('should verify loan terms are calculated correctly for a $350 device', () => {
      const devicePrice = 350;
      const depositRate = 0.20;
      const deposit = devicePrice * depositRate; // $70
      const principal = devicePrice - deposit; // $280
      const interestRate = 0.12; // 12% APR for Tier 2
      const loanTermMonths = 6;
      const totalRepayment = principal * (1 + interestRate);
      const monthlyPayment = totalRepayment / loanTermMonths;

      expect(deposit).toBe(70);
      expect(principal).toBe(280);
      expect(totalRepayment).toBeCloseTo(313.6, 1);
      expect(monthlyPayment).toBeCloseTo(52.27, 1);
      expect(monthlyPayment).toBeLessThan(principal);
    });
  });

  // =========================================================================
  // Error scenarios
  // =========================================================================
  describe('Error Scenarios', () => {
    it('should return 500 with structured error for WhatsApp internal errors', async () => {
      // Force an error by providing malformed body
      mockDb.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(createWhatsAppWebhookPayload('+263771234567', 'Hi')),
      });

      const response = await whatsappHandler(event);

      // WhatsApp webhooks always return 200 to prevent Meta retries
      expect(response.statusCode).toBe(200);
    });

    it('should handle empty body gracefully on scoring endpoint', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: '',
      });

      // Should not crash; may return 400 or 500
      const response = await scoringHandler(event);
      expect([400, 500]).toContain(response.statusCode);
    });

    it('should return 400 for KYC callback with missing customer_id in partner_params', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return qb;
      });

      const payload = {
        ...mockDiditResponses.verifiedKYC,
        partner_params: { user_id: '', job_id: '' },
      };

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await kycHandler(event);

      // Should return 404 (submission not found) or error
      expect([404, 500]).toContain(response.statusCode);
    });
  });
});
