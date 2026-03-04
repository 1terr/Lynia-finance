/**
 * Payment Service - API Contract Tests
 *
 * Validates that all payment service endpoints conform to
 * their API contracts: request validation, response shapes,
 * status codes, headers, and error handling.
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
  expectErrorResponse,
  expectCORSHeaders,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks - declared before importing the handler so module-level code uses them
// ---------------------------------------------------------------------------

const mockInitiatePayment = jest.fn();
const mockCheckPaymentStatus = jest.fn();
const mockProcessPaymentCompletion = jest.fn();
const mockReconcilePayments = jest.fn();
const mockTrackCompletedPayment = jest.fn();

jest.mock('../../services/payment-service/src/payment-service', () => ({
  PaymentService: jest.fn().mockImplementation(() => ({
    initiatePayment: mockInitiatePayment,
    checkPaymentStatus: mockCheckPaymentStatus,
    processPaymentCompletion: mockProcessPaymentCompletion,
    reconcilePayments: mockReconcilePayments,
    trackCompletedPayment: mockTrackCompletedPayment,
  })),
}));

const mockEcoCashVerifySignature = jest.fn().mockReturnValue(true);

jest.mock('../../services/payment-service/src/ecocash-provider', () => ({
  EcoCashProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: mockEcoCashVerifySignature,
  })),
}));

const mockOneMoneyVerifySignature = jest.fn().mockReturnValue(true);

jest.mock('../../services/payment-service/src/onemoney-provider', () => ({
  OneMoneyProvider: jest.fn().mockImplementation(() => ({
    verifyWebhookSignature: mockOneMoneyVerifySignature,
  })),
}));

// Import handler after mocks are in place
import { handler } from '../../services/payment-service/src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaymentEvent(
  overrides: Record<string, unknown> = {},
) {
  return createAPIGatewayEvent({
    httpMethod: 'POST',
    path: '/payments/initiate',
    body: JSON.stringify({
      loan_id: 'loan_001',
      customer_id: 'cust_001',
      amount: 50,
      customer_phone: '+263771234567',
      payment_type: 'repayment',
      ...overrides,
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Payment Service Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // POST /payments/initiate
  // =========================================================================
  describe('POST /payments/initiate', () => {
    it('should return 200 with payment details on success', async () => {
      mockInitiatePayment.mockResolvedValue({
        payment_id: 'pay_123',
        transaction_id: 'txn_456',
        gateway: 'ecocash',
        ussd_code: '*151*2*2#',
        payment_url: 'https://pay.ecocash.co.zw/txn_456',
        instructions: 'Dial *151*2*2# to approve payment',
      });

      const event = buildPaymentEvent();
      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toEqual({
        success: true,
        payment_id: 'pay_123',
        transaction_id: 'txn_456',
        gateway: 'ecocash',
        ussd_code: '*151*2*2#',
        payment_url: 'https://pay.ecocash.co.zw/txn_456',
        instructions: 'Dial *151*2*2# to approve payment',
      });
    });

    it('should return 400 when loan_id is missing', async () => {
      const _event = buildPaymentEvent({ loan_id: undefined });
      // Need to re-build body without loan_id
      const body = {
        customer_id: 'cust_001',
        amount: 50,
        customer_phone: '+263771234567',
        payment_type: 'repayment',
      };
      const eventMissing = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify(body),
      });

      const response = await handler(eventMissing);

      expectErrorResponse(response, 400);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Missing required fields');
      expect(parsed).toHaveProperty('required');
      expect((parsed as Record<string, unknown>).required).toEqual(
        expect.arrayContaining(['loan_id', 'customer_id', 'amount', 'customer_phone', 'payment_type']),
      );
    });

    it('should return 400 when customer_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({
          loan_id: 'loan_001',
          amount: 50,
          customer_phone: '+263771234567',
          payment_type: 'repayment',
        }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 400 when amount is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({
          loan_id: 'loan_001',
          customer_id: 'cust_001',
          customer_phone: '+263771234567',
          payment_type: 'repayment',
        }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when customer_phone is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({
          loan_id: 'loan_001',
          customer_id: 'cust_001',
          amount: 50,
          payment_type: 'repayment',
        }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when payment_type is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({
          loan_id: 'loan_001',
          customer_id: 'cust_001',
          amount: 50,
          customer_phone: '+263771234567',
        }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 500 when payment service throws', async () => {
      mockInitiatePayment.mockRejectedValue(new Error('Gateway timeout'));

      const event = buildPaymentEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error');
    });

    it('should include Content-Type and CORS headers on success', async () => {
      mockInitiatePayment.mockResolvedValue({
        payment_id: 'pay_1',
        transaction_id: 'txn_1',
        gateway: 'ecocash',
        ussd_code: '*151#',
        payment_url: null,
        instructions: 'Dial code',
      });

      const event = buildPaymentEvent();
      const response = await handler(event);

      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://lyniafinance.com');
    });
  });

  // =========================================================================
  // POST /payments/webhook/ecocash
  // =========================================================================
  describe('POST /payments/webhook/ecocash', () => {
    const webhookBody = {
      transaction_id: 'eco_txn_789',
      merchant_reference: 'pay_123',
      status: 'SUCCESS',
      amount: 50,
      phone_number: '+263771234567',
    };

    it('should return 200 with message on successful webhook processing', async () => {
      mockCheckPaymentStatus.mockResolvedValue({ id: 'pay_123', status: 'completed' });
      mockProcessPaymentCompletion.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify(webhookBody),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-signature-hash',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const parsed = parseResponseBody(response);
      expect(parsed).toEqual({ message: 'Webhook processed successfully' });
    });

    it('should verify x-signature header when present', async () => {
      mockCheckPaymentStatus.mockResolvedValue({ id: 'pay_123', status: 'completed' });
      mockProcessPaymentCompletion.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify(webhookBody),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'some-signature',
        },
      });

      await handler(event);

      expect(mockEcoCashVerifySignature).toHaveBeenCalledWith(
        'some-signature',
        JSON.stringify(webhookBody),
      );
    });

    it('should return 401 when signature verification fails', async () => {
      mockEcoCashVerifySignature.mockReturnValueOnce(false);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify(webhookBody),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'bad-signature',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Invalid signature');
    });

    it('should process FAILED status webhooks', async () => {
      mockCheckPaymentStatus.mockResolvedValue({ id: 'pay_123', status: 'failed' });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify({ ...webhookBody, status: 'FAILED' }),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockCheckPaymentStatus).toHaveBeenCalledWith('pay_123');
      // processPaymentCompletion is NOT called for FAILED
      expect(mockProcessPaymentCompletion).not.toHaveBeenCalled();
    });

    it('should process CANCELLED status webhooks', async () => {
      mockCheckPaymentStatus.mockResolvedValue({ id: 'pay_123', status: 'cancelled' });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify({ ...webhookBody, status: 'CANCELLED' }),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockProcessPaymentCompletion).not.toHaveBeenCalled();
    });

    it('should return 200 when webhook processing falls back to deposit resolver', async () => {
      mockCheckPaymentStatus.mockRejectedValue(new Error('DB error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify(webhookBody),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      // Webhook acknowledges receipt even if payment can't be resolved
      expect(response.statusCode).toBe(200);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('message', 'Webhook processed successfully');
    });
  });

  // =========================================================================
  // POST /payments/webhook/onemoney
  // =========================================================================
  describe('POST /payments/webhook/onemoney', () => {
    const webhookBody = {
      transaction_id: 'om_txn_111',
      merchant_reference: 'pay_222',
      status: 'SUCCESS',
      amount: 75,
      phone_number: '+263712345678',
    };

    it('should return 200 with message on successful webhook processing', async () => {
      mockCheckPaymentStatus.mockResolvedValue({ id: 'pay_222', status: 'completed' });
      mockProcessPaymentCompletion.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/onemoney',
        body: JSON.stringify(webhookBody),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'valid-onemoney-sig',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const parsed = parseResponseBody(response);
      expect(parsed).toEqual({ message: 'Webhook processed successfully' });
    });

    it('should verify x-signature header when present', async () => {
      mockCheckPaymentStatus.mockResolvedValue({ id: 'pay_222', status: 'completed' });
      mockProcessPaymentCompletion.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/onemoney',
        body: JSON.stringify(webhookBody),
        headers: {
          'Content-Type': 'application/json',
          'x-signature': 'om-sig-value',
        },
      });

      await handler(event);

      expect(mockOneMoneyVerifySignature).toHaveBeenCalledWith(
        'om-sig-value',
        JSON.stringify(webhookBody),
      );
    });

    it('should return 401 when OneMoney signature verification fails', async () => {
      mockOneMoneyVerifySignature.mockReturnValueOnce(false);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/onemoney',
        body: JSON.stringify(webhookBody),
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

    it('should return 200 when OneMoney webhook falls back to deposit resolver', async () => {
      mockCheckPaymentStatus.mockRejectedValue(new Error('Provider error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/onemoney',
        body: JSON.stringify(webhookBody),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await handler(event);

      // Webhook acknowledges receipt even if payment can't be resolved
      expect(response.statusCode).toBe(200);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('message', 'Webhook processed successfully');
    });
  });

  // =========================================================================
  // GET /payments/{paymentId}
  // =========================================================================
  describe('GET /payments/{paymentId}', () => {
    it('should return 200 with payment status on success', async () => {
      mockCheckPaymentStatus.mockResolvedValue({
        id: 'pay_123',
        loan_id: 'loan_001',
        amount: 50,
        currency: 'USD',
        status: 'completed',
        gateway: 'ecocash',
        gateway_transaction_id: 'eco_txn_789',
        payment_type: 'repayment',
        initiated_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:01:30Z',
        failed_at: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/payments/pay_123',
        pathParameters: { paymentId: 'pay_123' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('payment_id', 'pay_123');
      expect(body).toHaveProperty('loan_id', 'loan_001');
      expect(body).toHaveProperty('amount', 50);
      expect(body).toHaveProperty('currency', 'USD');
      expect(body).toHaveProperty('status', 'completed');
      expect(body).toHaveProperty('gateway', 'ecocash');
      expect(body).toHaveProperty('gateway_transaction_id');
      expect(body).toHaveProperty('payment_type');
      expect(body).toHaveProperty('initiated_at');
      expect(body).toHaveProperty('completed_at');
      expect(body).toHaveProperty('failed_at');
    });

    it('should return 404 when paymentId path segment is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/payments/',
        pathParameters: {},
      });

      // With lambda-router, GET /payments/ doesn't match GET /payments/:paymentId → 404
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should return 500 when payment lookup throws', async () => {
      mockCheckPaymentStatus.mockRejectedValue(new Error('Not found'));

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/payments/pay_999',
        pathParameters: { paymentId: 'pay_999' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error');
    });
  });

  // =========================================================================
  // POST /payments/reconcile
  // =========================================================================
  describe('POST /payments/reconcile', () => {
    it('should return 200 with reconciliation result on success', async () => {
      mockReconcilePayments.mockResolvedValue({
        reconciled_count: 5,
        failed_count: 1,
        total_amount: 250.00,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/reconcile',
        body: JSON.stringify({ max_age_hours: 48 }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('reconciled_count', 5);
      expect(body).toHaveProperty('failed_count', 1);
      expect(body).toHaveProperty('total_amount', 250.00);
    });

    it('should default max_age_hours to 24 when not provided', async () => {
      mockReconcilePayments.mockResolvedValue({ reconciled_count: 0 });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/reconcile',
        body: JSON.stringify({}),
      });

      await handler(event);

      expect(mockReconcilePayments).toHaveBeenCalledWith(24);
    });

    it('should use provided max_age_hours', async () => {
      mockReconcilePayments.mockResolvedValue({ reconciled_count: 0 });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/reconcile',
        body: JSON.stringify({ max_age_hours: 72 }),
      });

      await handler(event);

      expect(mockReconcilePayments).toHaveBeenCalledWith(72);
    });

    it('should return 500 when reconciliation throws', async () => {
      mockReconcilePayments.mockRejectedValue(new Error('Database error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/reconcile',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Reconciliation failed');
    });
  });

  // =========================================================================
  // 404 - Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/payments/unknown/route',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error', 'Not Found');
    });

    it('should return 405 for wrong HTTP method on known path', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        path: '/payments/initiate',
      });

      const response = await handler(event);

      // lambda-router returns 405 when path matches but method doesn't
      expect(response.statusCode).toBe(405);
    });

    it('should include proper headers on 404 responses', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/nonexistent',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', 'https://lyniafinance.com');
    });
  });

  // =========================================================================
  // 500 - Top-level error handling
  // =========================================================================
  describe('Top-level error handling', () => {
    it('should return 500 with error message when handler throws unexpectedly', async () => {
      // Force a top-level error by passing an event with invalid body that causes
      // JSON.parse to fail before route matching (which won't happen since
      // body parsing happens per-route). Instead, we test that the top-level
      // catch returns proper format.
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: 'not-valid-json',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const parsed = parseResponseBody(response);
      expect(parsed).toHaveProperty('error');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});
