/**
 * Characterization tests for services/payment-service/src/ecocash-provider.ts
 *
 * EcoCash is the primary mobile money provider in Zimbabwe (~70% market share).
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

import { EcoCashProvider } from '../../../services/payment-service/src/ecocash-provider';

const mockAxios = (axios as unknown as { __mockInstance: Record<string, jest.Mock> }).__mockInstance;

describe('EcoCashProvider', () => {
  let provider: EcoCashProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ECOCASH_MERCHANT_ID = 'test-merchant';
    process.env.ECOCASH_API_KEY = 'test-key';
    process.env.ECOCASH_API_SECRET = 'test-secret';
    process.env.ECOCASH_WEBHOOK_SECRET = 'webhook-secret';
    process.env.ECOCASH_ENV = 'sandbox';
    provider = new EcoCashProvider();
  });

  // ─── initiatePayment ──────────────────────────────────────────
  describe('initiatePayment', () => {
    it('should call EcoCash API and return transaction details', async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: {
          transaction_id: 'eco-123',
          ussd_code: '*151#',
          payment_url: 'https://ecocash.co.zw/pay/eco-123',
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
      expect(result.transaction_id).toBe('eco-123');
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
        data: { transaction_id: 'eco-456' },
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
          transaction_id: 'eco-123',
          merchant_reference: 'pay-001',
          amount: 50,
          currency: 'USD',
          status: 'SUCCESS',
          customer_phone: '+263771234567',
        },
      });

      const result = await provider.checkPaymentStatus('eco-123');
      expect(result.status).toBe('completed');
    });

    it('should map FAILED to failed', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'FAILED', transaction_id: 'eco-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('eco-123');
      expect(result.status).toBe('failed');
    });

    it('should map CANCELLED to cancelled', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'CANCELLED', transaction_id: 'eco-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('eco-123');
      expect(result.status).toBe('cancelled');
    });

    it('should map PENDING to pending', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'PENDING', transaction_id: 'eco-123', merchant_reference: 'ref', amount: 50, currency: 'USD', customer_phone: '+263771234567' },
      });

      const result = await provider.checkPaymentStatus('eco-123');
      expect(result.status).toBe('pending');
    });
  });

  // ─── verifyWebhookSignature ───────────────────────────────────
  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const { createHmac } = require('crypto');
      const payload = '{"transaction_id":"eco-123","status":"SUCCESS"}';
      const validSig = createHmac('sha256', 'webhook-secret').update(payload).digest('hex');

      expect(provider.verifyWebhookSignature(validSig, payload)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"transaction_id":"eco-123"}';
      expect(provider.verifyWebhookSignature('invalid-signature', payload)).toBe(false);
    });
  });

  // ─── generatePaymentInstructions ──────────────────────────────
  describe('generatePaymentInstructions', () => {
    it('should include amount and reference in instructions', () => {
      const instructions = provider.generatePaymentInstructions(100, 'LYN-12345');

      expect(instructions).toContain('$100.00');
      expect(instructions).toContain('LYN-12345');
      expect(instructions).toContain('*151#');
    });
  });

  // ─── getCapabilities ──────────────────────────────────────────
  describe('getCapabilities', () => {
    it('should report USSD and webhook support', () => {
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
