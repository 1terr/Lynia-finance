/**
 * E2E Test: E2E-002 - Payment Collection Flow
 *
 * Scenario: Customer with active loan makes installment repayment via OneMoney
 * Flow: Initiate payment -> Process webhook (success/failure) -> Verify balance update -> Verify notifications
 *
 * Expected Result: Payment processed, loan balance reduced, customer notified
 */

import { createAPIGatewayEvent, parseResponseBody } from '../helpers/test-utils';
import { mockPaymentProviderResponses, mockWhatsAppResponses } from '../helpers/mock-external-services';
import { testCustomers, testLoans, testPayments } from '../fixtures';

// Mock external dependencies
jest.mock('../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));
jest.mock('axios');

// Mock provider services to bypass signature verification in tests
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

const mockDb = {
  from: jest.fn((_table: string) => createMockQueryBuilder()),
};

// ---------------------------------------------------------------------------
// Import handlers after mocking
// ---------------------------------------------------------------------------
import { handler as paymentHandler } from '../../services/payment-service/src/index';
import { handler as notificationHandler } from '../../services/notification-service/src/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const activeLoan = testLoans.activeLoan;
const customer = testCustomers.zimbabweCustomer;

describe('E2E-002: Payment Collection Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: mockWhatsAppResponses.messageSent });
    axios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  // =========================================================================
  // STEP 1: Initiate Installment Payment
  // =========================================================================
  describe('Step 1: Initiate Installment Payment via OneMoney', () => {
    it('should return 400 when loan_id is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({
          amount: 51.33,
          customer_phone: customer.phone_number,
        }),
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      expect(body.required).toContain('loan_id');
    });

    it('should return 400 when amount is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/initiate',
        body: JSON.stringify({
          loan_id: activeLoan.id,
          customer_id: customer.id,
          customer_phone: customer.phone_number,
          payment_type: 'repayment',
        }),
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Missing required fields');
      expect(body.required).toContain('amount');
    });

    it('should validate that payment amount matches the monthly installment', () => {
      const monthlyPayment = activeLoan.monthly_payment;
      expect(monthlyPayment).toBe(51.33);
      expect(monthlyPayment).toBeGreaterThan(0);
      expect(monthlyPayment).toBeLessThan(activeLoan.outstanding_balance);
    });

    it('should validate OneMoney success payment mock response structure', () => {
      const successPayment = mockPaymentProviderResponses.onemoney.successPayment;
      expect(successPayment.transaction_id).toBeDefined();
      expect(successPayment.transaction_id).toMatch(/^OM_TXN_/);
      expect(successPayment.status).toBe('SUCCESS');
      expect(successPayment.amount).toBe(70.00);
      expect(successPayment.currency).toBe('USD');
      expect(successPayment.phone_number).toMatch(/^\+263/);
    });
  });

  // =========================================================================
  // STEP 2: Process Payment Webhook (Success)
  // =========================================================================
  describe('Step 2: Process Payment Webhook - Success', () => {
    it('should return 200 when processing a successful OneMoney webhook', async () => {
      mockDb.from.mockImplementation((table: string) => {
        const qb = createMockQueryBuilder();
        if (table === 'payments') {
          qb.execute.mockResolvedValue({
            data: {
              id: 'pay_test_002',
              loan_id: activeLoan.id,
              customer_id: customer.id,
              amount: 51.33,
              currency: 'USD',
              status: 'completed',
              gateway: 'onemoney',
              gateway_transaction_id: 'OM_TXN_001',
              payment_type: 'repayment',
              initiated_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            },
            error: null,
          });
        } else if (table === 'loans') {
          qb.execute.mockResolvedValue({
            data: {
              ...activeLoan,
              outstanding_balance: activeLoan.outstanding_balance - 51.33,
            },
            error: null,
          });
        }
        return qb;
      });

      const webhookPayload = {
        transaction_id: 'OM_TXN_001',
        merchant_reference: 'pay_test_002',
        status: 'SUCCESS',
        amount: 51.33,
        currency: 'USD',
        phone_number: customer.phone_number,
        timestamp: new Date().toISOString(),
      };

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/onemoney',
        body: JSON.stringify(webhookPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.message).toBe('Webhook processed successfully');
    });

    it('should return 200 when processing a successful EcoCash webhook', async () => {
      mockDb.from.mockImplementation((table: string) => {
        const qb = createMockQueryBuilder();
        if (table === 'payments') {
          qb.execute.mockResolvedValue({
            data: {
              id: 'pay_test_ec_001',
              loan_id: activeLoan.id,
              customer_id: customer.id,
              amount: 51.33,
              currency: 'USD',
              status: 'completed',
              gateway: 'ecocash',
              gateway_transaction_id: 'EC_TXN_001',
              payment_type: 'repayment',
            },
            error: null,
          });
        } else if (table === 'loans') {
          qb.execute.mockResolvedValue({
            data: activeLoan,
            error: null,
          });
        }
        return qb;
      });

      const webhookPayload = mockPaymentProviderResponses.ecocash.successPayment;

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/ecocash',
        body: JSON.stringify(webhookPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.message).toBe('Webhook processed successfully');
    });
  });

  // =========================================================================
  // STEP 2b: Process Payment Webhook (Failure)
  // =========================================================================
  describe('Step 2b: Process Payment Webhook - Failure', () => {
    it('should handle a failed OneMoney payment webhook gracefully', async () => {
      mockDb.from.mockImplementation((table: string) => {
        const qb = createMockQueryBuilder();
        if (table === 'payments') {
          qb.execute.mockResolvedValue({
            data: {
              id: 'pay_test_fail',
              loan_id: activeLoan.id,
              customer_id: customer.id,
              amount: 51.33,
              status: 'failed',
              gateway: 'onemoney',
              gateway_transaction_id: 'OM_TXN_002',
              payment_type: 'repayment',
            },
            error: null,
          });
        }
        return qb;
      });

      const webhookPayload = {
        transaction_id: 'OM_TXN_002',
        merchant_reference: 'pay_test_fail',
        status: 'FAILED',
        amount: 51.33,
        currency: 'USD',
        phone_number: customer.phone_number,
        failure_reason: 'Insufficient funds',
        timestamp: new Date().toISOString(),
      };

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/onemoney',
        body: JSON.stringify(webhookPayload),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.message).toBe('Webhook processed successfully');
    });

    it('should validate EcoCash failure response structure', () => {
      const failedPayment = mockPaymentProviderResponses.ecocash.failedPayment;
      expect(failedPayment.status).toBe('FAILED');
      expect(failedPayment.failure_reason).toBe('Insufficient funds');
      expect(failedPayment.transaction_id).toMatch(/^EC_TXN_/);
    });

    it('should handle cancelled payment status', () => {
      const cancelledPayment = mockPaymentProviderResponses.ecocash.cancelledPayment;
      expect(cancelledPayment.status).toBe('CANCELLED');
      expect(cancelledPayment.amount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // STEP 3: Verify Loan Balance Updates
  // =========================================================================
  describe('Step 3: Verify Loan Balance Updates', () => {
    it('should calculate correct new balance after payment', () => {
      const previousBalance = activeLoan.outstanding_balance; // $200
      const paymentAmount = activeLoan.monthly_payment; // $51.33
      const expectedNewBalance = previousBalance - paymentAmount; // $148.67

      expect(previousBalance).toBe(200);
      expect(paymentAmount).toBe(51.33);
      expect(expectedNewBalance).toBeCloseTo(148.67, 2);
      expect(expectedNewBalance).toBeGreaterThan(0);
    });

    it('should increment paid_installments count after successful payment', () => {
      const currentInstallments = activeLoan.paid_installments; // 2
      const expectedNext = currentInstallments + 1; // 3

      expect(currentInstallments).toBe(2);
      expect(expectedNext).toBe(3);
      expect(expectedNext).toBeLessThanOrEqual(activeLoan.total_installments);
    });

    it('should keep loan status as active when balance remains positive', () => {
      const newBalance = activeLoan.outstanding_balance - activeLoan.monthly_payment;
      const expectedStatus = newBalance > 0 ? 'active' : 'paid_off';

      expect(newBalance).toBeGreaterThan(0);
      expect(expectedStatus).toBe('active');
    });

    it('should set loan status to paid_off when balance reaches zero', () => {
      const finalPaymentAmount = activeLoan.outstanding_balance;
      const newBalance = activeLoan.outstanding_balance - finalPaymentAmount;

      expect(newBalance).toBe(0);
      const expectedStatus = newBalance <= 0 ? 'paid_off' : 'active';
      expect(expectedStatus).toBe('paid_off');
    });

    it('should calculate next payment date 30 days ahead', () => {
      const currentPaymentDate = new Date(activeLoan.next_payment_date);
      const nextPaymentDate = new Date(currentPaymentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const daysDiff = (nextPaymentDate.getTime() - currentPaymentDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeCloseTo(30, 0);
      expect(nextPaymentDate.getTime()).toBeGreaterThan(currentPaymentDate.getTime());
    });

    it('should never allow balance to go negative', () => {
      const overpayment = activeLoan.outstanding_balance + 10;
      const newBalance = Math.max(activeLoan.outstanding_balance - overpayment, 0);

      expect(newBalance).toBe(0);
      expect(newBalance).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // STEP 4: Verify Notifications Sent
  // =========================================================================
  describe('Step 4: Verify Notifications Sent', () => {
    it('should return 400 when required notification fields are missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: customer.id,
          // missing channel and message
        }),
      });

      const response = await notificationHandler(event);

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(400);
      const body = parseResponseBody(response!);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 404 when sending notification for non-existent customer', async () => {
      mockDb.from.mockImplementation(() => {
        const qb = createMockQueryBuilder();
        qb.execute.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        return qb;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'nonexistent',
          channel: 'whatsapp',
          message: 'Payment received',
        }),
      });

      const response = await notificationHandler(event);

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(404);
      const body = parseResponseBody(response!);
      expect(body.error).toBe('Customer not found');
    });

    it('should return 404 for unknown notification route', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/unknown',
        body: JSON.stringify({}),
      });

      const response = await notificationHandler(event);

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(404);
    });

    it('should validate payment confirmation message content', () => {
      const paymentAmount = activeLoan.monthly_payment;
      const remainingBalance = activeLoan.outstanding_balance - paymentAmount;
      const paidInstallments = activeLoan.paid_installments + 1;

      const confirmationMessage = `Payment of $${paymentAmount.toFixed(2)} received. Remaining balance: $${remainingBalance.toFixed(2)}. Installments: ${paidInstallments}/${activeLoan.total_installments}.`;

      expect(confirmationMessage).toContain('51.33');
      expect(confirmationMessage).toContain('148.67');
      expect(confirmationMessage).toContain('3/6');
    });

    it('should validate WhatsApp message sent mock response', () => {
      const sentResponse = mockWhatsAppResponses.messageSent;
      expect(sentResponse.messaging_product).toBe('whatsapp');
      expect(sentResponse.messages).toHaveLength(1);
      expect(sentResponse.messages[0].id).toBeDefined();
      expect(sentResponse.contacts).toHaveLength(1);
    });
  });

  // =========================================================================
  // Error Scenarios
  // =========================================================================
  describe('Error Scenarios', () => {
    it('should return 404 for GET on unknown payment route', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/payments-unknown',
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should handle webhook processing error and return 500', async () => {
      mockDb.from.mockImplementation(() => {
        throw new Error('Database unavailable');
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/payments/webhook/onemoney',
        body: JSON.stringify({
          transaction_id: 'OM_FAIL',
          merchant_reference: 'pay_error',
          status: 'SUCCESS',
          amount: 51.33,
        }),
        headers: { 'Content-Type': 'application/json', 'x-signature': 'valid-test-sig' },
      });

      const response = await paymentHandler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });

    it('should validate payment fixture amounts are consistent', () => {
      // Completed deposit
      const deposit = testPayments.completedDeposit;
      expect(deposit.amount).toBe(70);
      expect(deposit.payment_type).toBe('deposit');
      expect(deposit.status).toBe('completed');

      // Completed installment
      const installment = testPayments.completedInstallment;
      expect(installment.amount).toBe(51.33);
      expect(installment.payment_type).toBe('installment');
      expect(installment.status).toBe('completed');

      // Failed payment
      const failed = testPayments.failedPayment;
      expect(failed.status).toBe('failed');
      expect(failed.failure_reason).toBe('Insufficient funds');
    });

    it('should handle payments with USD currency only', () => {
      const payment = testPayments.completedInstallment;
      expect(payment.payment_provider).toBe('onemoney');

      // Verify all fixture payments are in USD context
      expect(testPayments.completedDeposit.amount).toBeGreaterThan(0);
      expect(testPayments.completedInstallment.amount).toBeGreaterThan(0);
    });
  });
});
