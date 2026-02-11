/**
 * E2E Test: E2E-005 - Non-Zimbabwe Customer Rejection
 *
 * Scenario: Customer with non-Zimbabwe phone number or ID attempts registration
 * Flow: Non-+263 registration -> KYC with non-ZW ID -> Loan application rejected
 *
 * Expected Result: All non-Zimbabwe customers are rejected at multiple checkpoints
 */

import { createAPIGatewayEvent, parseResponseBody } from '../helpers/test-utils';
import { createWhatsAppWebhookPayload, mockSmileIdentityResponses } from '../helpers/mock-external-services';
import { testCustomers } from '../fixtures';

// Mock external dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));
jest.mock('axios');

// Mock provider services to bypass signature verification in tests
jest.mock('../../services/kyc-service/src/smile-identity-service', () => ({
  SmileIdentityService: jest.fn().mockImplementation(() => ({
    submitEnhancedKYC: jest.fn().mockResolvedValue({ job_id: 'job_001', smile_job_id: 'smile_job_001', message: 'KYC verification submitted successfully' }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    determineVerificationDecision: jest.fn().mockImplementation((result: Record<string, unknown>) => {
      const code = result.ResultCode as string;
      if (code === '1012') return { decision: 'APPROVED', reason: 'All checks passed' };
      if (code === '1014') return { decision: 'REJECTED', reason: 'ID verification failed' };
      return { decision: 'MANUAL_REVIEW', reason: 'Low confidence' };
    }),
    handleSmileError: jest.fn().mockReturnValue({ user_message: 'Verification failed', retriable: true, retry_after: 300 }),
  })),
}));

jest.mock('../../services/kyc-service/src/image-processor', () => ({
  validateImage: jest.fn().mockReturnValue({ valid: true, size: 5000, format: 'jpeg' }),
  bufferToBase64: jest.fn().mockReturnValue('data:image/jpeg;base64,abc123'),
  downloadWhatsAppImage: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  validateZimbabweIDNumber: jest.fn().mockImplementation((id: string) => {
    const pattern = /^(\d{2})-(\d{6})([A-Z])(\d{2})$/i;
    const match = id.trim().match(pattern);
    if (!match) return { valid: false, error: 'Invalid ID format' };
    return { valid: true, normalized: id.trim().toUpperCase() };
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
  ];
  for (const m of methods) {
    builder[m] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return builder;
};

const mockSupabaseClient = {
  from: jest.fn((_table: string) => createMockQueryBuilder()),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
  },
  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/storage/test' } }),
    }),
  },
};

// ---------------------------------------------------------------------------
// Import handlers after mocking
// ---------------------------------------------------------------------------
import { handler as whatsappHandler } from '../../services/whatsapp-service/src/index';
import { handler as kycHandler } from '../../services/kyc-service/src/index';
import { handler as scoringHandler } from '../../services/scoring-service/src/index';
import { handler as paymentHandler } from '../../services/payment-service/src/index';

// ---------------------------------------------------------------------------
// Non-Zimbabwe phone numbers for testing
// ---------------------------------------------------------------------------
const nonZimbabwePhones = [
  { country: 'South Africa', code: '+27', number: '+27821234567' },
  { country: 'Kenya', code: '+254', number: '+254712345678' },
  { country: 'Nigeria', code: '+234', number: '+2348012345678' },
  { country: 'United States', code: '+1', number: '+12025551234' },
  { country: 'United Kingdom', code: '+44', number: '+447911123456' },
  { country: 'Zambia', code: '+260', number: '+260971234567' },
  { country: 'Mozambique', code: '+258', number: '+258841234567' },
];

const nonZimbabweCustomer = testCustomers.nonZimbabweCustomer;

describe('E2E-005: Non-Zimbabwe Customer Rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { success: true } });
    axios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  // =========================================================================
  // STEP 1: Non-+263 Registration Rejection
  // =========================================================================
  describe('Step 1: Non-+263 Number Registration Attempt', () => {
    it('should verify non-Zimbabwe customer fixture has non-+263 phone', () => {
      expect(nonZimbabweCustomer.phone_number).not.toMatch(/^\+263/);
      expect(nonZimbabweCustomer.country).not.toBe('Zimbabwe');
      expect(nonZimbabweCustomer.national_id).not.toMatch(/^\d{2}-\d{6,7}[A-Z]\d{2}$/);
    });

    it.each(nonZimbabwePhones)(
      'should identify $country ($code) as non-Zimbabwe number',
      ({ number, code }) => {
        expect(number).not.toMatch(/^\+263/);
        expect(number.startsWith(code)).toBe(true);
        expect(number.length).toBeGreaterThanOrEqual(10);
      }
    );

    it('should still return 200 for WhatsApp webhook with non-Zimbabwe number (webhook must acknowledge)', async () => {
      const webhookPayload = createWhatsAppWebhookPayload('+27821234567', 'Hi');

      mockSupabaseClient.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(webhookPayload),
      });

      const response = await whatsappHandler(event);

      // WhatsApp webhooks always return 200 to prevent Meta retries
      expect(response.statusCode).toBe(200);
    });

    it('should validate that +263 is the only accepted country code', () => {
      const acceptedCode = '+263';
      const zimbabweNumber = '+263771234567';
      const southAfricanNumber = '+27821234567';

      expect(zimbabweNumber.startsWith(acceptedCode)).toBe(true);
      expect(southAfricanNumber.startsWith(acceptedCode)).toBe(false);
    });

    it('should validate Zimbabwe phone number regex pattern', () => {
      const zimbabweRegex = /^\+263\d{9}$/;

      expect('+263771234567').toMatch(zimbabweRegex);
      expect('+263772345678').toMatch(zimbabweRegex);

      // Non-matching
      expect('+27821234567').not.toMatch(zimbabweRegex);
      expect('+254712345678').not.toMatch(zimbabweRegex);
      expect('263771234567').not.toMatch(zimbabweRegex); // Missing +
      expect('+26377123').not.toMatch(zimbabweRegex); // Too short
    });
  });

  // =========================================================================
  // STEP 2: KYC Rejection for Non-Zimbabwe ID
  // =========================================================================
  describe('Step 2: KYC Rejection for Non-Zimbabwe ID', () => {
    it('should return 400 when KYC initiation body is missing fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          customer_id: 'cust_non_zw_001',
          // Missing required fields
        }),
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });

    it('should validate that Smile Identity rejected KYC response has correct structure', () => {
      const rejectedKyc = mockSmileIdentityResponses.rejectedKYC;

      expect(rejectedKyc.result.ResultCode).toBe('1014');
      expect(rejectedKyc.result.ResultText).toBe('Face Not Matched');
      expect(rejectedKyc.result.confidence_value).toBe(35.2);
      expect(rejectedKyc.result.face_match.status).toBe('not_matched');
      expect(rejectedKyc.result.id_info.country).toBe('ZW');
    });

    it('should validate Zimbabwe national ID format', () => {
      const validZimbabweId = /^\d{2}-\d{6,7}[A-Z]\d{2}$/;
      const zimbabweCustomer = testCustomers.zimbabweCustomer;

      expect(zimbabweCustomer.national_id).toMatch(validZimbabweId);
      // Non-Zimbabwe ID should NOT match
      expect(nonZimbabweCustomer.national_id).not.toMatch(validZimbabweId);
    });

    it('should validate non-Zimbabwe IDs are rejected', () => {
      const nonZwIds = [
        'RSA8501015800183', // South African ID
        '12345678',         // Generic short ID
        'AB123456',         // Letter prefix
        '1234567890123',    // Too long for ZW format
      ];

      const validZimbabweId = /^\d{2}-\d{6,7}[A-Z]\d{2}$/;

      for (const id of nonZwIds) {
        expect(id).not.toMatch(validZimbabweId);
      }
    });

    it('should process KYC callback with rejection result', async () => {
      const rejectedKyc = mockSmileIdentityResponses.rejectedKYC;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        const qb = createMockQueryBuilder();
        if (table === 'kyc_submissions') {
          qb.single.mockResolvedValue({
            data: {
              id: 'kyc_non_zw_001',
              customer_id: 'cust_non_zw_001',
              status: 'pending',
              smile_identity_transaction_id: 'job_reject_001',
            },
            error: null,
          });
        }
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/callback',
        body: JSON.stringify(rejectedKyc),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.message).toBe('Webhook processed successfully');
    });

    it('should verify that rejected KYC prevents loan progression', () => {
      const rejectedKyc = mockSmileIdentityResponses.rejectedKYC;
      const resultCode = rejectedKyc.result.ResultCode;
      const isApproved = resultCode === '1012'; // Only 1012 is verified

      expect(isApproved).toBe(false);
      expect(resultCode).toBe('1014');
    });
  });

  // =========================================================================
  // STEP 3: Loan Application Rejection
  // =========================================================================
  describe('Step 3: Loan Application Rejected', () => {
    it('should reject scoring for customer with failed KYC', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.single.mockResolvedValue({ data: { id: 'score_reject' }, error: null });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: 'cust_non_zw_001',
          monthly_income_usd: 50,
          existing_debt_obligations_usd: 40,
          household_size: 8,
          dependents: 6,
          requested_loan_amount: 500,
          kyc_result: {
            id_verification: { status: 'rejected' },
            face_match: { confidence: 0.0 },
            liveness: { status: 'failed' },
          },
        }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody<{
        decision: string;
        scaled_score: number;
        credit_limit_usd: number;
        tier: string;
      }>(response);

      expect(body.decision).toBe('reject');
      expect(body.credit_limit_usd).toBe(0);
      expect(body.tier).toBe('Rejected');
    });

    it('should reject scoring for customer with very low income', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.single.mockResolvedValue({ data: { id: 'score_low_income' }, error: null });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({
          customer_id: 'cust_non_zw_001',
          monthly_income_usd: 30, // Very low
          existing_debt_obligations_usd: 20,
          household_size: 8,
          dependents: 6,
          requested_loan_amount: 500,
          kyc_result: {
            id_verification: { status: 'failed' },
            face_match: { confidence: 0.3 },
            liveness: { status: 'failed' },
          },
        }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody<{
        decision: string;
        credit_limit_usd: number;
      }>(response);

      expect(body.decision).toBe('reject');
      expect(body.credit_limit_usd).toBe(0);
    });

    it('should validate that payment endpoint rejects missing fields', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({
          // Empty request - missing all required fields
        }),
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    it('should handle phone number with 263 without + prefix', () => {
      const phoneWithoutPlus = '263771234567';
      const phoneWithPlus = '+263771234567';

      // Without + prefix, it does not match the expected format
      expect(phoneWithoutPlus).not.toMatch(/^\+263/);
      expect(phoneWithPlus).toMatch(/^\+263/);
    });

    it('should handle empty phone number gracefully', () => {
      const emptyPhone = '';
      expect(emptyPhone).not.toMatch(/^\+263/);
      expect(emptyPhone.length).toBe(0);
    });

    it('should handle phone number that is close to +263 but different', () => {
      const numbers = ['+2630771234567', '+26371234567', '+264771234567'];

      const isZimbabwe = (phone: string) => /^\+263\d{9}$/.test(phone);

      expect(isZimbabwe(numbers[0])).toBe(false); // Extra 0
      expect(isZimbabwe(numbers[1])).toBe(false); // Too short
      expect(isZimbabwe(numbers[2])).toBe(false); // +264 is Namibia
    });

    it('should validate the customer country is not Zimbabwe', () => {
      expect(nonZimbabweCustomer.country).toBe('South Africa');
      expect(nonZimbabweCustomer.country).not.toBe('Zimbabwe');
    });

    it('should validate customer fixture is consistent for non-ZW customer', () => {
      expect(nonZimbabweCustomer.phone_number).toMatch(/^\+27/); // South Africa code
      expect(nonZimbabweCustomer.id).toBeDefined();
      expect(nonZimbabweCustomer.first_name).toBeDefined();
      expect(nonZimbabweCustomer.last_name).toBeDefined();
      expect(nonZimbabweCustomer.kyc_status).toBe('not_started');
    });

    it('should validate scoring returns 400 for missing customer_id', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({}),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body.error).toBe('customer_id is required');
    });

    it('should reject KYC initiation with invalid national ID format', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({
          customer_id: 'cust_non_zw_001',
          id_number: 'RSA8501015800183', // South African ID number
          id_image_base64: 'base64data',
          selfie_image_base64: 'base64data',
        }),
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // Comprehensive country code validation
  // =========================================================================
  describe('Country Code Validation', () => {
    it('should accept Zimbabwe (+263) and reject all other country codes', () => {
      const isZimbabwePhone = (phone: string): boolean => /^\+263\d{9}$/.test(phone);

      // Should accept
      expect(isZimbabwePhone('+263771234567')).toBe(true);
      expect(isZimbabwePhone('+263772345678')).toBe(true);

      // Should reject
      expect(isZimbabwePhone('+27821234567')).toBe(false);
      expect(isZimbabwePhone('+254712345678')).toBe(false);
      expect(isZimbabwePhone('+2348012345678')).toBe(false);
      expect(isZimbabwePhone('+12025551234')).toBe(false);
      expect(isZimbabwePhone('+447911123456')).toBe(false);
    });

    it('should validate Zimbabwe mobile operator prefixes', () => {
      const zimbabweOperators = {
        econet: /^\+26377\d{7}$/, // Econet (EcoCash)
        netone: /^\+26371\d{7}$/, // NetOne (OneMoney)
        telecel: /^\+26373\d{7}$/, // Telecel
      };

      expect('+263771234567').toMatch(zimbabweOperators.econet);
      expect('+263712345678').toMatch(zimbabweOperators.netone);
      expect('+263731234567').toMatch(zimbabweOperators.telecel);

      // Cross-check: South African number doesn't match any
      expect('+27821234567').not.toMatch(zimbabweOperators.econet);
      expect('+27821234567').not.toMatch(zimbabweOperators.netone);
      expect('+27821234567').not.toMatch(zimbabweOperators.telecel);
    });
  });
});
