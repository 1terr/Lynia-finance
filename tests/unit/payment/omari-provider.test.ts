/**
 * Characterization tests for services/payment-service/src/omari-provider.ts
 *
 * O'mari is Old Mutual's digital wallet (~10% market share in Zimbabwe).
 * USSD: *707#
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

import { OmariProvider } from '../../../services/payment-service/src/omari-provider';

const mockAxios = (axios as unknown as { __mockInstance: Record<string, jest.Mock> }).__mockInstance;

describe('OmariProvider', () => {
  let provider: OmariProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OMARI_MERCHANT_ID = 'test-merchant';
    process.env.OMARI_API_KEY = 'test-key';
    process.env.OMARI_API_SECRET = 'test-secret';
    process.env.OMARI_WEBHOOK_SECRET = 'webhook-secret';
    process.env.OMARI_ENV = 'sandbox';
    provider = new OmariProvider();
  });

  // ─── initiatePayment ──────────────────────────────────────────
  describe('initiatePayment', () => {
    it('should call O\'mari API and return transaction details', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: {
          transaction_id: 'om-123',
          ussd_code: '*707#',
          payment_url: 'https://omari.co.zw/pay/om-123',
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
      expect(result.transaction_id).toBe('om-123');
      expect(result.status).toBe('pending');
      expect(mockAxios.post).toHaveBeenCalledWith('/payments/initiate', expect.objectContaining({
        merchant_id: 'test-merchant',
        amount: 50,
        currency: 'USD',
        customer_phone: '+263771234567',
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
        data: { transaction_id: 'om-456' },
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
          transaction_id: 'om-123',
          merchant_reference: 'pay-001',
          amount: 50,
          currency: 'USD',
          status: 'SUCCESS',
          customer_phone: '+263771234567',
        },
      });

      const result = await provider.checkPaymentStatus('om-123');
      expect(result.status).toBe('completed');
    });

    it('should map FAILED to failed', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'FAILED', transaction_id: 'om-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('om-123');
      expect(result.status).toBe('failed');
    });

    it('should map CANCELLED to cancelled', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'CANCELLED', transaction_id: 'om-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('om-123');
      expect(result.status).toBe('cancelled');
    });

    it('should map PENDING to pending', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'PENDING', transaction_id: 'om-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('om-123');
      expect(result.status).toBe('pending');
    });
  });

  // ─── verifyWebhookSignature ───────────────────────────────────
  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const { createHmac } = require('crypto');
      const payload = '{"transaction_id":"om-123","status":"SUCCESS"}';
      const validSig = createHmac('sha256', 'webhook-secret').update(payload).digest('hex');

      expect(provider.verifyWebhookSignature(validSig, payload)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"transaction_id":"om-123"}';
      expect(provider.verifyWebhookSignature('invalid-signature', payload)).toBe(false);
    });
  });

  // ─── validatePhoneNumber (public method) ──────────────────────
  describe('validatePhoneNumber', () => {
    it('should accept valid Zimbabwe phone numbers', () => {
      expect(provider.validatePhoneNumber('+263771234567')).toBe(true);
      expect(provider.validatePhoneNumber('+263731234567')).toBe(true);
      expect(provider.validatePhoneNumber('+263781234567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(provider.validatePhoneNumber('0771234567')).toBe(false);
      expect(provider.validatePhoneNumber('+263791234567')).toBe(false);
      expect(provider.validatePhoneNumber('+2637712345')).toBe(false);
      expect(provider.validatePhoneNumber('invalid')).toBe(false);
    });
  });

  // ─── generatePaymentInstructions ──────────────────────────────
  describe('generatePaymentInstructions', () => {
    it('should include amount, reference, and *707# in instructions', () => {
      const instructions = provider.generatePaymentInstructions(100, 'LYN-12345');

      expect(instructions).toContain('$100.00');
      expect(instructions).toContain('LYN-12345');
      expect(instructions).toContain('*707#');
    });
  });

  // ─── getCapabilities ──────────────────────────────────────────
  describe('getCapabilities', () => {
    it('should report correct capabilities', () => {
      const caps = provider.getCapabilities();

      expect(caps.supportsUSSD).toBe(true);
      expect(caps.supportsWebhook).toBe(true);
      expect(caps.supportsStatusPolling).toBe(true);
      expect(caps.supportsRefund).toBe(false);
      expect(caps.maxTransactionAmountUSD).toBe(2000);
      expect(caps.supportedCurrencies).toContain('USD');
      expect(caps.supportedCurrencies).toContain('ZWL');
    });
  });
});
