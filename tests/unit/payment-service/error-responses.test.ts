/**
 * Payment Service Error Response Tests
 *
 * Verifies that all payment handler error responses include:
 *   - { success: false, error: '...' } envelope
 *   - requestId in details for debugging
 *   - No stack traces or internal error messages leaked
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// ============================================================
// MOCK SETUP
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockPaymentService = {
  initiatePayment: jest.fn(),
  checkPaymentStatus: jest.fn(),
  reconcilePayments: jest.fn(),
  processPaymentCompletion: jest.fn(),
  trackCompletedPayment: jest.fn(),
};

jest.mock('../../../services/payment-service/src/payment-service', () => ({
  PaymentService: jest.fn(() => mockPaymentService),
}));

jest.mock('../../../services/payment-service/src/ecocash-provider', () => ({
  EcoCashProvider: jest.fn(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../../services/payment-service/src/innbucks-provider', () => ({
  InnBucksProvider: jest.fn(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../../services/payment-service/src/onemoney-provider', () => ({
  OneMoneyProvider: jest.fn(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../../services/payment-service/src/omari-provider', () => ({
  OmariProvider: jest.fn(() => ({
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../../services/payment-service/src/payment-event-logger', () => ({
  PaymentEventLogger: jest.fn(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../services/payment-service/src/handlers/fineract-sync', () => ({
  syncPaymentToFineract: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../services/payment-service/src/deposit-resolver', () => ({
  resolveDepositByNationalId: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../services/shared/utils/sqs-publisher', () => ({
  SQSQueues: {
    syncDataWarehouse: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Import handlers after mocks
import { handleInitiatePayment } from '../../../services/payment-service/src/handlers/initiate-payment';
import { handleGetPaymentStatus } from '../../../services/payment-service/src/handlers/get-payment-status';
import { handleReconcilePayments } from '../../../services/payment-service/src/handlers/reconcile-payments';
import { handleEcoCashWebhook } from '../../../services/payment-service/src/handlers/webhook-ecocash';
import { handleInnBucksWebhook } from '../../../services/payment-service/src/handlers/webhook-innbucks';
import { handleOneMoneyWebhook } from '../../../services/payment-service/src/handlers/webhook-onemoney';
import { handleOmariWebhook } from '../../../services/payment-service/src/handlers/webhook-omari';

// ============================================================
// TEST HELPERS
// ============================================================

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    path: '/test',
    httpMethod: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': 'valid-test-signature',
    },
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      requestId: 'test-req-payment-001',
    } as any,
    ...overrides,
  };
}

const AUTH: any = { userId: 'test-user', roles: ['admin'] };
const PARAMS: any = {};

function parseBody(result: { body: string }) {
  return JSON.parse(result.body);
}

// ============================================================
// TESTS
// ============================================================

describe('Payment Service Error Responses', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('handleInitiatePayment', () => {
    it('should include requestId in 500 error response', async () => {
      mockPaymentService.initiatePayment.mockRejectedValue(new Error('DB connection lost'));

      const result = await handleInitiatePayment(
        makeEvent({
          body: JSON.stringify({
            loan_id: 'loan-1', customer_id: 'cust-1', amount: 100,
            customer_phone: '+263771234567', payment_type: 'ecocash',
          }),
        }),
        PARAMS, AUTH
      );

      expect(result.statusCode).toBe(500);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
      expect(body.error).not.toContain('DB connection');
    });

    it('should include requestId in 400 validation error response', async () => {
      const result = await handleInitiatePayment(
        makeEvent({ body: JSON.stringify({ loan_id: 'loan-1' }) }),
        PARAMS, AUTH
      );

      expect(result.statusCode).toBe(400);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
    });
  });

  describe('handleGetPaymentStatus', () => {
    it('should include requestId in 500 error response', async () => {
      mockPaymentService.checkPaymentStatus.mockRejectedValue(new Error('Query timeout'));

      const result = await handleGetPaymentStatus(
        makeEvent(),
        { paymentId: 'pay-123' } as any,
        AUTH
      );

      expect(result.statusCode).toBe(500);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
      expect(body.error).not.toContain('Query timeout');
    });

    it('should include requestId in 400 validation error response', async () => {
      const result = await handleGetPaymentStatus(
        makeEvent(),
        {} as any,  // missing paymentId
        AUTH
      );

      expect(result.statusCode).toBe(400);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
    });
  });

  describe('handleReconcilePayments', () => {
    it('should include requestId in 500 error response', async () => {
      mockPaymentService.reconcilePayments.mockRejectedValue(new Error('Deadlock'));

      const result = await handleReconcilePayments(
        makeEvent({ body: JSON.stringify({}) }),
        PARAMS, AUTH
      );

      expect(result.statusCode).toBe(500);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
      expect(body.error).not.toContain('Deadlock');
    });
  });

  describe('handleEcoCashWebhook', () => {
    it('should include requestId in 500 error response', async () => {
      const result = await handleEcoCashWebhook(
        makeEvent({ body: 'invalid-json{{{' }),
        PARAMS, AUTH
      );

      expect(result.statusCode).toBe(500);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
    });
  });

  describe('handleInnBucksWebhook', () => {
    it('should include requestId in 500 error response', async () => {
      const result = await handleInnBucksWebhook(
        makeEvent({ body: 'invalid-json{{{' }),
        PARAMS, AUTH
      );

      expect(result.statusCode).toBe(500);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
    });
  });

  describe('handleOneMoneyWebhook', () => {
    it('should include requestId in 500 error response', async () => {
      const result = await handleOneMoneyWebhook(
        makeEvent({ body: 'invalid-json{{{' }),
        PARAMS, AUTH
      );

      expect(result.statusCode).toBe(500);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
    });
  });

  describe('handleOmariWebhook', () => {
    it('should include requestId in 500 error response', async () => {
      const result = await handleOmariWebhook(
        makeEvent({ body: 'invalid-json{{{' }),
        PARAMS, AUTH
      );

      expect(result.statusCode).toBe(500);
      const body = parseBody(result);
      expect(body.success).toBe(false);
      expect(body.details?.requestId).toBe('test-req-payment-001');
    });
  });
});
