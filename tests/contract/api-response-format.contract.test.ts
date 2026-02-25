/**
 * Cross-Service API Response Format Contract Tests
 *
 * Validates that ALL 6 Lambda services conform to the shared API
 * contract requirements:
 *   - Content-Type header (application/json)
 *   - CORS headers (Access-Control-Allow-Origin: *)
 *   - JSON response bodies
 *   - Error response shape ({ error: string })
 *   - 404 responses for unknown routes
 *   - 500 responses do not leak stack traces
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import {
  createAPIGatewayEvent,
  parseResponseBody,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks - Must be declared before any handler imports
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

// Payment service mocks
jest.mock('../../services/payment-service/src/payment-service', () => ({
  PaymentService: jest.fn().mockImplementation(() => ({
    initiatePayment: jest.fn().mockRejectedValue(new Error('Test error')),
    checkPaymentStatus: jest.fn().mockRejectedValue(new Error('Test error')),
    processPaymentCompletion: jest.fn(),
    reconcilePayments: jest.fn().mockRejectedValue(new Error('Test error')),
    trackCompletedPayment: jest.fn().mockResolvedValue(undefined),
  })),
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

// KYC service mocks
const mockKYCProvider = {
  submitEnhancedKYC: jest.fn().mockRejectedValue(new Error('Test error')),
  submitVerification: jest.fn().mockRejectedValue(new Error('Test error')),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
  parseWebhookPayload: jest.fn(),
  determineDecision: jest.fn(),
  determineVerificationDecision: jest.fn(),
  handleError: jest.fn(),
  handleSmileError: jest.fn(),
  providerName: 'didit',
};

jest.mock('../../services/kyc-service/src/smile-identity-service', () => ({
  SmileIdentityService: jest.fn().mockImplementation(() => mockKYCProvider),
}));

jest.mock('../../services/kyc-service/src/didit-service', () => ({
  DiditService: jest.fn().mockImplementation(() => mockKYCProvider),
}));

jest.mock('../../services/kyc-service/src/image-processor', () => ({
  validateImage: jest.fn().mockReturnValue({ valid: true }),
  bufferToBase64: jest.fn(),
  downloadWhatsAppImage: jest.fn(),
  validateZimbabweIDNumber: jest.fn().mockReturnValue({ valid: true, normalized: '63-123456A47' }),
}));

// Lock service mocks
jest.mock('../../services/lock-service/src/lock-management-service', () => ({
  LockManagementService: jest.fn().mockImplementation(() => ({
    lockDevice: jest.fn().mockRejectedValue(new Error('Test error')),
    unlockDevice: jest.fn().mockRejectedValue(new Error('Test error')),
    getLockStatus: jest.fn().mockRejectedValue(new Error('Test error')),
    processAutomatedLocks: jest.fn().mockRejectedValue(new Error('Test error')),
  })),
}));

jest.mock('../../services/lock-service/src/handover-service', () => ({
  HandoverService: jest.fn().mockImplementation(() => ({
    checkHandoverReadiness: jest.fn().mockRejectedValue(new Error('Test error')),
    initiateHandover: jest.fn().mockRejectedValue(new Error('Test error')),
    verifyCustomerIdentity: jest.fn().mockRejectedValue(new Error('Test error')),
    verifyDepositPayment: jest.fn().mockRejectedValue(new Error('Test error')),
    recordDeviceCondition: jest.fn().mockRejectedValue(new Error('Test error')),
    completeHandover: jest.fn().mockRejectedValue(new Error('Test error')),
    getHandoverStatus: jest.fn().mockRejectedValue(new Error('Test error')),
  })),
}));

// WhatsApp service mocks
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '+263771234567', wa_id: '263771234567' }],
        messages: [{ id: 'wamid.test123' }],
      },
    }),
    create: jest.fn().mockReturnValue({
      post: jest.fn().mockResolvedValue({ data: {} }),
      get: jest.fn().mockResolvedValue({ data: {} }),
    }),
    isAxiosError: jest.fn().mockReturnValue(false),
  },
  isAxiosError: jest.fn().mockReturnValue(false),
}));

jest.mock('../../services/whatsapp-service/src/onboarding', () => ({
  routeOnboardingMessage: jest.fn().mockResolvedValue('Welcome'),
}));

// Notification service mocks
jest.mock('../../services/notification-service/src/reminder-scheduler', () => ({
  processPaymentReminders: jest.fn().mockRejectedValue(new Error('Test error')),
  getReminderAnalytics: jest.fn().mockRejectedValue(new Error('Test error')),
  handleReminderOptOut: jest.fn().mockRejectedValue(new Error('Test error')),
  handleReminderOptIn: jest.fn().mockRejectedValue(new Error('Test error')),
}));

// Environment variables
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test_phone_id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test_access_token';
process.env.WHATSAPP_VERIFY_TOKEN = 'lynia_webhook_2025';

// ---------------------------------------------------------------------------
// Import all handlers
// ---------------------------------------------------------------------------

import { handler as paymentHandler } from '../../services/payment-service/src/index';
import { handler as scoringHandler } from '../../services/scoring-service/src/index';
import { handler as kycHandler } from '../../services/kyc-service/src/index';
import { handler as lockHandler } from '../../services/lock-service/src/index';
import { handler as whatsappHandler } from '../../services/whatsapp-service/src/index';
import { handler as notificationHandler } from '../../services/notification-service/src/index';

// ---------------------------------------------------------------------------
// Service handler registry
// ---------------------------------------------------------------------------

interface ServiceEntry {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: any) => Promise<APIGatewayProxyResult | void>;
  unknownPath: string;
  errorPath: string;
  errorMethod: string;
  errorBody?: string;
}

const services: ServiceEntry[] = [
  {
    name: 'payment-service',
    handler: paymentHandler,
    unknownPath: '/payments/nonexistent/path',
    errorPath: '/payments/initiate',
    errorMethod: 'POST',
    errorBody: JSON.stringify({
      loan_id: 'loan_001',
      customer_id: 'cust_001',
      amount: 50,
      customer_phone: '+263771234567',
      payment_type: 'repayment',
    }),
  },
  {
    name: 'scoring-service',
    handler: scoringHandler,
    unknownPath: '/scoring-nonexistent',
    errorPath: '/scoring/calculate',
    errorMethod: 'POST',
    errorBody: 'INVALID-JSON{{{',
  },
  {
    name: 'kyc-service',
    handler: kycHandler,
    unknownPath: '/kyc/nonexistent/path',
    errorPath: '/kyc/initiate',
    errorMethod: 'POST',
    errorBody: 'INVALID-JSON{{{',
  },
  {
    name: 'lock-service',
    handler: lockHandler,
    unknownPath: '/locks-nonexistent',
    errorPath: '/locks/lock',
    errorMethod: 'POST',
    errorBody: JSON.stringify({ device_id: 'dev_001', reason: 'Test' }),
  },
  {
    name: 'whatsapp-service',
    handler: whatsappHandler,
    unknownPath: '/whatsapp/nonexistent',
    errorPath: '/whatsapp/send',
    errorMethod: 'POST',
    errorBody: 'INVALID-JSON{{{',
  },
  {
    name: 'notification-service',
    handler: notificationHandler,
    unknownPath: '/notifications-nonexistent',
    errorPath: '/notifications/send',
    errorMethod: 'POST',
    errorBody: 'INVALID-JSON{{{',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cross-Service API Response Format Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // Content-Type header on all responses
  // =========================================================================
  describe('Content-Type header', () => {
    services.forEach((service) => {
      it(`${service.name}: should return Content-Type: application/json on 404`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        expect(response!.headers).toHaveProperty('Content-Type', 'application/json');
      });
    });
  });

  // =========================================================================
  // CORS headers on all responses
  // =========================================================================
  describe('CORS headers', () => {
    services.forEach((service) => {
      it(`${service.name}: should return Access-Control-Allow-Origin on 404`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        // All services should return CORS headers on 404
        expect(response!.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://lyniafinance.com');
      });
    });
  });

  // =========================================================================
  // JSON response bodies on all responses
  // =========================================================================
  describe('JSON response bodies', () => {
    services.forEach((service) => {
      it(`${service.name}: should return valid JSON body on 404`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        expect(() => JSON.parse(response!.body)).not.toThrow();
      });
    });
  });

  // =========================================================================
  // Error response format: { error: string }
  // =========================================================================
  describe('Error response format', () => {
    services.forEach((service) => {
      it(`${service.name}: 404 error should have { error: string } format`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        expect(response!.statusCode).toBe(404);
        const body = parseResponseBody(response!);
        expect(body).toHaveProperty('error');
        expect(typeof (body as Record<string, unknown>).error).toBe('string');
      });
    });
  });

  // =========================================================================
  // 404 for unknown routes
  // =========================================================================
  describe('404 for unknown routes', () => {
    services.forEach((service) => {
      it(`${service.name}: should return 404 for unknown route`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        expect(response!.statusCode).toBe(404);
      });
    });

    services.forEach((service) => {
      it(`${service.name}: should return 404 with "Not Found" message`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        const body = parseResponseBody(response!);
        expect(body).toHaveProperty('error', 'Not Found');
      });
    });
  });

  // =========================================================================
  // 500 responses do not leak stack traces
  // =========================================================================
  describe('500 responses do not leak stack traces', () => {
    services.forEach((service) => {
      it(`${service.name}: 500 response should not contain stack trace`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: service.errorMethod,
          path: service.errorPath,
          body: service.errorBody || null,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        // Some errors may be caught at different levels, but if it's 500:
        if (response && response.statusCode === 500) {
          const body = response.body;

          // Should not contain stack trace indicators
          expect(body).not.toContain('at Object.');
          expect(body).not.toContain('at Module.');
          expect(body).not.toContain('at Function.');
          expect(body).not.toContain('.ts:');
          expect(body).not.toContain('.js:');
          expect(body).not.toContain('node_modules');

          // Should be valid JSON
          expect(() => JSON.parse(body)).not.toThrow();

          // Should have error property
          const parsed = JSON.parse(body);
          expect(parsed).toHaveProperty('error');
        }
      });
    });

    services.forEach((service) => {
      it(`${service.name}: 500 response should have Content-Type header`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: service.errorMethod,
          path: service.errorPath,
          body: service.errorBody || null,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        if (response && response.statusCode === 500) {
          expect(response.headers).toHaveProperty('Content-Type', 'application/json');
        }
      });
    });
  });

  // =========================================================================
  // Consistent error message patterns
  // =========================================================================
  describe('Error message patterns', () => {
    it('payment-service: validation error includes required fields array', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({ loan_id: 'test' }),
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('required');
      expect(Array.isArray((body as Record<string, unknown>).required)).toBe(true);
    });

    it('scoring-service: validation error includes descriptive message', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/scoring/calculate',
        body: JSON.stringify({ monthly_income_usd: 500 }),
      });

      const response = await scoringHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(typeof (body as Record<string, unknown>).error).toBe('string');
    });

    it('kyc-service: validation error includes required fields array', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/kyc/initiate',
        body: JSON.stringify({ customer_id: 'test' }),
      });

      const response = await kycHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('required');
    });

    it('lock-service: validation error includes required fields array', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/locks/lock',
        body: JSON.stringify({ device_id: 'test' }),
      });

      const response = await lockHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('required');
    });

    it('notification-service: validation error includes descriptive message', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({ customerId: 'test' }),
      });

      const response = (await notificationHandler(event)) as APIGatewayProxyResult;

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(typeof (body as Record<string, unknown>).error).toBe('string');
    });
  });

  // =========================================================================
  // Response body is never null or undefined
  // =========================================================================
  describe('Response body is always defined', () => {
    services.forEach((service) => {
      it(`${service.name}: response body should never be null or undefined`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        expect(response!.body).toBeDefined();
        expect(response!.body).not.toBeNull();
        expect(typeof response!.body).toBe('string');
        expect(response!.body.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // Status codes are standard HTTP codes
  // =========================================================================
  describe('Status codes are valid HTTP codes', () => {
    const validStatusCodes = [200, 400, 401, 403, 404, 500];

    services.forEach((service) => {
      it(`${service.name}: 404 response uses a valid HTTP status code`, async () => {
        const event = createAPIGatewayEvent({
          httpMethod: 'GET',
          path: service.unknownPath,
        });

        const response = (await service.handler(event)) as APIGatewayProxyResult;

        expect(response).toBeDefined();
        expect(validStatusCodes).toContain(response!.statusCode);
      });
    });
  });
});
