/**
 * Characterization tests for services/payment-service/src/payment-service.ts
 *
 * Core payment orchestration — validates amounts, checks limits, routes to providers.
 * A bug here = money lost or double-charged.
 */

// Mock all external dependencies before importing
jest.mock('../../../services/shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'order', 'limit', 'single', 'maybeSingle'];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
    query: jest.fn().mockResolvedValue({ data: [], error: null }),
    queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
    __mockExecute: mockExecute,
  };
});

jest.mock('../../../services/payment-service/src/ecocash-provider', () => ({
  EcoCashProvider: jest.fn().mockImplementation(() => ({
    name: 'ecocash',
    initiatePayment: jest.fn().mockResolvedValue({
      success: true,
      transaction_id: 'eco-txn-001',
      ussd_code: '*151#',
      status: 'pending',
      message: 'Payment initiated',
    }),
    checkPaymentStatus: jest.fn().mockResolvedValue({
      transaction_id: 'eco-txn-001',
      status: 'completed',
    }),
    generatePaymentInstructions: jest.fn().mockReturnValue('Dial *151#'),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 50 }),
    getCapabilities: jest.fn().mockReturnValue({ supportsUSSD: true }),
  })),
}));

jest.mock('../../../services/payment-service/src/onemoney-provider', () => ({
  OneMoneyProvider: jest.fn().mockImplementation(() => ({
    name: 'onemoney',
    initiatePayment: jest.fn().mockResolvedValue({
      success: true,
      transaction_id: 'om-txn-001',
      status: 'pending',
      message: 'Payment initiated',
    }),
    checkPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
    generatePaymentInstructions: jest.fn().mockReturnValue('Dial *111#'),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 80 }),
    getCapabilities: jest.fn().mockReturnValue({ supportsUSSD: true }),
  })),
}));

jest.mock('../../../services/payment-service/src/omari-provider', () => ({
  OmariProvider: jest.fn().mockImplementation(() => ({
    name: 'omari',
    initiatePayment: jest.fn().mockResolvedValue({
      success: true, transaction_id: 'om-txn-001', status: 'pending', message: 'ok',
    }),
    checkPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
    generatePaymentInstructions: jest.fn().mockReturnValue('Instructions'),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 100 }),
    getCapabilities: jest.fn().mockReturnValue({}),
  })),
}));

jest.mock('../../../services/payment-service/src/innbucks-provider', () => ({
  InnBucksProvider: jest.fn().mockImplementation(() => ({
    name: 'innbucks',
    initiatePayment: jest.fn().mockResolvedValue({
      success: true, transaction_id: 'ib-txn-001', status: 'pending', message: 'ok',
    }),
    checkPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
    generatePaymentInstructions: jest.fn().mockReturnValue('Instructions'),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 100 }),
    getCapabilities: jest.fn().mockReturnValue({}),
  })),
}));

jest.mock('../../../services/payment-service/src/payment-analytics', () => ({
  PaymentAnalyticsService: jest.fn().mockImplementation(() => ({
    trackPaymentMethod: jest.fn().mockResolvedValue(undefined),
    calculateFee: jest.fn().mockReturnValue(0.50),
  })),
}));

jest.mock('../../../services/payment-service/src/payment-event-logger', () => ({
  PaymentEventLogger: jest.fn().mockImplementation(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../services/payment-service/src/payment-state-machine', () => ({
  PaymentStateMachine: jest.fn().mockImplementation(() => ({
    transition: jest.fn().mockResolvedValue(true),
    isValidTransition: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../../../services/payment-service/src/currency-conversion', () => ({
  convertToUsd: jest.fn().mockImplementation(async (amount: number, currency: string) => {
    if (currency === 'USD') return amount;
    if (currency === 'ZWL') return amount * 0.0003;
    if (currency === 'ZAR') return amount * 0.055;
    return amount;
  }),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../services/shared/utils/sqs-publisher', () => ({
  SQSQueues: {
    sendNotification: jest.fn().mockResolvedValue(undefined),
    processDeviceLock: jest.fn().mockResolvedValue(undefined),
    syncDataWarehouse: jest.fn().mockResolvedValue(undefined),
  },
}));

import { PaymentService } from '../../../services/payment-service/src/payment-service';
const { db, __mockExecute } = require('../../../services/shared/clients/database');

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
    service = new PaymentService();

    // Default: DB insert returns a payment record
    __mockExecute.mockResolvedValue({
      data: { id: 'pay-001', status: 'pending', gateway: 'ecocash' },
      error: null,
    });
  });

  // ─── validateTransactionLimits ────────────────────────────────
  describe('validateTransactionLimits', () => {
    it('should reject amount exceeding single transaction limit ($2000)', async () => {
      const result = await service.validateTransactionLimits('cust-1', 2500, 'USD');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Single transaction limit exceeded');
    });

    it('should allow amount within single transaction limit', async () => {
      // Mock daily and monthly totals as zero
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })   // daily
        .mockResolvedValueOnce({ data: [], error: null });   // monthly

      const result = await service.validateTransactionLimits('cust-1', 500, 'USD');
      expect(result.allowed).toBe(true);
    });

    it('should reject when daily limit would be exceeded', async () => {
      // Daily total already at $4800
      __mockExecute
        .mockResolvedValueOnce({ data: [{ amount: 4800 }], error: null })   // daily
        .mockResolvedValueOnce({ data: [], error: null });                   // monthly

      const result = await service.validateTransactionLimits('cust-1', 500, 'USD');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily transaction limit exceeded');
    });

    it('should reject when monthly limit would be exceeded', async () => {
      // Daily OK (total 100 + 500 = 600 < 5000), monthly at $49800 (49800 + 500 > 50000)
      __mockExecute
        .mockResolvedValueOnce({ data: [{ amount: 100 }], error: null })      // daily
        .mockResolvedValueOnce({ data: [{ amount: 49600 }], error: null });   // monthly

      const result = await service.validateTransactionLimits('cust-1', 500, 'USD');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Monthly transaction limit exceeded');
    });

    it('should convert ZWL amounts to USD for limit checking', async () => {
      // With mock rate: 10000 ZWL * 0.0003 = $3 USD, which is under $2000 limit
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })   // daily
        .mockResolvedValueOnce({ data: [], error: null });   // monthly

      const result = await service.validateTransactionLimits('cust-1', 10000, 'ZWL');
      expect(result.allowed).toBe(true);
    });
  });

  // ─── initiatePayment ──────────────────────────────────────────
  describe('initiatePayment', () => {
    beforeEach(() => {
      // Mock validateTransactionLimits to pass
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })   // daily check
        .mockResolvedValueOnce({ data: [], error: null })   // monthly check
        .mockResolvedValueOnce({                            // insert payment
          data: { id: 'pay-001', status: 'pending', gateway: 'ecocash' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });    // subsequent updates
    });

    it('should create a payment record and return transaction details', async () => {
      // Reset and set up correct mock sequence for full initiatePayment flow
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })   // daily limit check
        .mockResolvedValueOnce({ data: [], error: null })   // monthly limit check
        .mockResolvedValueOnce({                            // insert payment record
          data: { id: 'pay-001', status: 'pending', gateway: 'ecocash' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });    // subsequent DB updates

      const result = await service.initiatePayment({
        loan_id: 'loan-1',
        customer_id: 'cust-1',
        amount: 100,
        currency: 'USD',
        customer_phone: '+263771234567',
        gateway: 'ecocash',
        payment_type: 'repayment',
      });

      expect(result.payment_id).toBe('pay-001');
      expect(result.transaction_id).toBe('eco-txn-001');
      expect(result.gateway).toBe('ecocash');
    });

    it('should reject payment that exceeds transaction limits', async () => {
      __mockExecute.mockReset();
      // Amount > 2000 triggers single transaction limit check before any DB queries

      await expect(
        service.initiatePayment({
          loan_id: 'loan-1',
          customer_id: 'cust-1',
          amount: 3000, // Exceeds $2000 single limit
          currency: 'USD',
          customer_phone: '+263771234567',
          gateway: 'ecocash',
          payment_type: 'repayment',
        })
      ).rejects.toThrow('Payment initiation failed');
    });
  });

  // ─── getProviderHealth ────────────────────────────────────────
  describe('getProviderHealth', () => {
    it('should return health status for all providers', async () => {
      const health = await service.getProviderHealth();

      expect(health.ecocash).toBeDefined();
      expect(health.onemoney).toBeDefined();
      expect(health.omari).toBeDefined();
      expect(health.innbucks).toBeDefined();
      expect(health.ecocash.healthy).toBe(true);
    });
  });

  describe('processPaymentCompletion', () => {
    it('should send deposit notification after successful deposit', async () => {
      const { SQSQueues } = require('../../../services/shared/utils/sqs-publisher');

      // Mock sequence: fetch payment, then linkPaymentToLoan (fetch loan, update loan)
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({   // fetch payment
          data: { id: 'pay-001', loan_id: 'loan-1', customer_id: 'cust-1', amount: 200, status: 'completed', payment_type: 'deposit' },
          error: null,
        })
        .mockResolvedValueOnce({   // linkPaymentToLoan: fetch loan
          data: { id: 'loan-1', outstanding_balance: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null }); // any subsequent updates

      await service.processPaymentCompletion('pay-001');

      expect(SQSQueues.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-1',
          channel: 'whatsapp',
          templateName: 'deposit_confirmed',
        })
      );
    });

    it('should trigger device unlock when repayment pays off the loan', async () => {
      const { SQSQueues } = require('../../../services/shared/utils/sqs-publisher');

      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({   // fetch payment
          data: { id: 'pay-002', loan_id: 'loan-2', customer_id: 'cust-2', amount: 500, status: 'completed', payment_type: 'repayment' },
          error: null,
        })
        .mockResolvedValueOnce({   // linkPaymentToLoan: fetch loan
          data: { id: 'loan-2', outstanding_balance: 500, principal_amount: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // linkPaymentToLoan: update loan
        .mockResolvedValueOnce({   // fetch updated loan for paid_off check
          data: { status: 'paid_off', device_id: 'dev-001' },
          error: null,
        });

      await service.processPaymentCompletion('pay-002');

      expect(SQSQueues.processDeviceLock).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'dev-001',
          action: 'unlock',
          reason: 'loan_paid_off',
        })
      );
    });
  });
});
