/**
 * Characterization tests for services/payment-service/src/onemoney-provider.ts
 *
 * OneMoney is the secondary mobile money provider in Zimbabwe.
 */

import axios from 'axios';

jest.mock('axios', () => {
  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
    isAxiosError: jest.fn((err: unknown) => err && typeof err === 'object' && 'isAxiosError' in err),
    __mockInstance: mockAxiosInstance,
  };
});

jest.mock('../../../services/shared/utils/circuit-breaker', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
    getState: jest.fn().mockReturnValue('CLOSED'),
  })),
}));

import { OneMoneyProvider } from '../../../services/payment-service/src/onemoney-provider';

const mockAxios = (axios as unknown as { __mockInstance: Record<string, jest.Mock> }).__mockInstance;

describe('OneMoneyProvider', () => {
  let provider: OneMoneyProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ONEMONEY_MERCHANT_ID = 'test-merchant';
    process.env.ONEMONEY_API_KEY = 'test-key';
    process.env.ONEMONEY_API_SECRET = 'test-secret';
    process.env.ONEMONEY_WEBHOOK_SECRET = 'webhook-secret';
    process.env.ONEMONEY_ENV = 'sandbox';
    provider = new OneMoneyProvider();
  });

  describe('initiatePayment', () => {
    it('should call OneMoney API and return transaction details', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { transaction_id: 'om-123', ussd_code: '*111#' },
      });

      const result = await provider.initiatePayment({
        amount: 75,
        currency: 'USD',
        customer_phone: '+263731234567',
        reference: 'pay-om-001',
        description: 'Loan repayment',
      });

      expect(result.success).toBe(true);
      expect(result.transaction_id).toBe('om-123');
      expect(result.status).toBe('pending');
    });

    it('should reject invalid phone number', async () => {
      await expect(
        provider.initiatePayment({
          amount: 50,
          currency: 'USD',
          customer_phone: '0771234567',
          reference: 'pay-om-002',
          description: 'Test',
        })
      ).rejects.toThrow('Invalid Zimbabwe phone number format');
    });
  });

  describe('checkPaymentStatus', () => {
    it('should map SUCCESS to completed', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          transaction_id: 'om-123', merchant_reference: 'ref',
          amount: 75, currency: 'USD', status: 'SUCCESS', customer_phone: '+263731234567',
        },
      });

      const result = await provider.checkPaymentStatus('om-123');
      expect(result.status).toBe('completed');
    });

    it('should map FAILED to failed', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          transaction_id: 'om-123', merchant_reference: 'ref',
          amount: 75, currency: 'USD', status: 'FAILED', customer_phone: '+263731234567',
        },
      });

      const result = await provider.checkPaymentStatus('om-123');
      expect(result.status).toBe('failed');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const { createHmac } = require('crypto');
      const payload = '{"transaction_id":"om-123","status":"SUCCESS"}';
      const validSig = createHmac('sha256', 'webhook-secret').update(payload).digest('hex');

      expect(provider.verifyWebhookSignature(validSig, payload)).toBe(true);
    });

    it('should reject invalid signature', () => {
      expect(provider.verifyWebhookSignature('bad-sig', 'payload')).toBe(false);
    });
  });

  describe('generatePaymentInstructions', () => {
    it('should include amount and *111# USSD code', () => {
      const instructions = provider.generatePaymentInstructions(75, 'LYN-OM-001');

      expect(instructions).toContain('$75.00');
      expect(instructions).toContain('LYN-OM-001');
      expect(instructions).toContain('*111#');
    });
  });

  describe('getCapabilities', () => {
    it('should report correct capabilities', () => {
      const caps = provider.getCapabilities();

      expect(caps.supportsUSSD).toBe(true);
      expect(caps.supportsWebhook).toBe(true);
      expect(caps.maxTransactionAmountUSD).toBe(2000);
    });
  });
});
