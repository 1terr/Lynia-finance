/**
 * Characterization tests for services/payment-service/src/innbucks-provider.ts
 *
 * InnBucks is an app-based payment provider in Zimbabwe.
 * No USSD support — payments are initiated via the InnBucks app.
 */

import axios from 'axios';

// Mock axios
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

// Mock circuit breaker to pass through
jest.mock('../../../services/shared/utils/circuit-breaker', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
    getState: jest.fn().mockReturnValue('CLOSED'),
  })),
}));

// Mock logger (innbucks-provider uses logger.warn instead of console.warn)
jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { InnBucksProvider } from '../../../services/payment-service/src/innbucks-provider';

const mockAxios = (axios as unknown as { __mockInstance: Record<string, jest.Mock> }).__mockInstance;

describe('InnBucksProvider', () => {
  let provider: InnBucksProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INNBUCKS_MERCHANT_ID = 'test-merchant';
    process.env.INNBUCKS_API_KEY = 'test-key';
    process.env.INNBUCKS_API_SECRET = 'test-secret';
    process.env.INNBUCKS_WEBHOOK_SECRET = 'webhook-secret';
    process.env.INNBUCKS_ENV = 'sandbox';
    process.env.INNBUCKS_API_URL = 'https://sandbox.innbucks.co.zw/api/v1';
    provider = new InnBucksProvider();
  });

  // ─── initiatePayment ──────────────────────────────────────────
  describe('initiatePayment', () => {
    it('should call InnBucks API with msisdn field and return transaction details', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: {
          transaction_id: 'inn-123',
          payment_url: 'https://innbucks.co.zw/pay/inn-123',
        },
      });

      const result = await provider.initiatePayment({
        amount: 50,
        currency: 'USD',
        customer_phone: '+263771234567',
        reference: 'pay-001',
        description: 'Loan repayment',
      });

      expect(result.success).toBe(true);
      expect(result.transaction_id).toBe('inn-123');
      expect(result.status).toBe('pending');
      expect(mockAxios.post).toHaveBeenCalledWith('/payments/initiate', expect.objectContaining({
        merchant_id: 'test-merchant',
        amount: 50,
        currency: 'USD',
        msisdn: '263771234567', // +263 prefix stripped of '+'
      }));
    });

    it('should reject invalid phone number format', async () => {
      await expect(
        provider.initiatePayment({
          amount: 50,
          currency: 'USD',
          customer_phone: '0771234567', // Missing +263 prefix
          reference: 'pay-002',
          description: 'Test',
        })
      ).rejects.toThrow('Invalid Zimbabwe phone number format');
    });

    it('should accept valid +263 phone numbers', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { transaction_id: 'inn-456' },
      });

      const result = await provider.initiatePayment({
        amount: 100,
        currency: 'USD',
        customer_phone: '+263731234567',
        reference: 'pay-003',
        description: 'Test',
      });

      expect(result.success).toBe(true);
    });
  });

  // ─── checkPaymentStatus ───────────────────────────────────────
  describe('checkPaymentStatus', () => {
    it('should map SUCCESS to completed', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          transaction_id: 'inn-123',
          merchant_reference: 'pay-001',
          amount: 50,
          currency: 'USD',
          status: 'SUCCESS',
          customer_phone: '+263771234567',
        },
      });

      const result = await provider.checkPaymentStatus('inn-123');
      expect(result.status).toBe('completed');
    });

    it('should map FAILED to failed', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'FAILED', transaction_id: 'inn-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('inn-123');
      expect(result.status).toBe('failed');
    });

    it('should map CANCELLED to cancelled', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'CANCELLED', transaction_id: 'inn-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('inn-123');
      expect(result.status).toBe('cancelled');
    });

    it('should map PENDING to pending', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'PENDING', transaction_id: 'inn-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('inn-123');
      expect(result.status).toBe('pending');
    });
  });

  // ─── verifyWebhookSignature ───────────────────────────────────
  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const { createHmac } = require('crypto');
      const payload = '{"transaction_id":"inn-123","status":"SUCCESS"}';
      const validSig = createHmac('sha256', 'webhook-secret').update(payload).digest('hex');

      expect(provider.verifyWebhookSignature(validSig, payload)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"transaction_id":"inn-123"}';
      expect(provider.verifyWebhookSignature('invalid-signature', payload)).toBe(false);
    });

    it('should return true and warn when webhook secret is not configured', () => {
      const loggerMock = require('../../../services/shared/utils/logger').default;
      process.env.INNBUCKS_WEBHOOK_SECRET = '';
      const providerNoSecret = new InnBucksProvider();

      expect(providerNoSecret.verifyWebhookSignature('any-sig', 'any-payload')).toBe(true);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('webhook secret not configured'),
        expect.any(Object)
      );
    });
  });

  // ─── generatePaymentInstructions ──────────────────────────────
  describe('generatePaymentInstructions', () => {
    it('should include amount and reference in instructions', () => {
      const instructions = provider.generatePaymentInstructions(100, 'LYN-12345');

      expect(instructions).toContain('$100.00');
      expect(instructions).toContain('LYN-12345');
    });
  });

  // ─── getCapabilities ──────────────────────────────────────────
  describe('getCapabilities', () => {
    it('should report correct capabilities with no USSD support', () => {
      const caps = provider.getCapabilities();

      expect(caps.supportsUSSD).toBe(false);
      expect(caps.supportsWebhook).toBe(true);
      expect(caps.supportsStatusPolling).toBe(true);
      expect(caps.supportsRefund).toBe(false);
      expect(caps.maxTransactionAmountUSD).toBe(2000);
      expect(caps.supportedCurrencies).toContain('USD');
      expect(caps.supportedCurrencies).toContain('ZWL');
    });
  });
});
