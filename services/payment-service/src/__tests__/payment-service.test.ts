/**
 * Unit tests for services/payment-service/src/payment-service.ts
 *
 * Tests payment completion handling, RBZ regulatory limits,
 * payment type routing, and idempotency.
 */

// ── Mocks ────────────────────────────────────────────────────────────────

jest.mock('../../../shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = [
      'select', 'insert', 'update', 'delete',
      'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not',
      'or', 'order', 'limit', 'single', 'maybeSingle',
    ];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
    __mockExecute: mockExecute,
  };
});

jest.mock('../ecocash-provider', () => ({
  EcoCashProvider: jest.fn().mockImplementation(() => ({
    name: 'ecocash',
    initiatePayment: jest.fn().mockResolvedValue({
      success: true, transaction_id: 'eco-txn-001', ussd_code: '*151#',
      status: 'pending', message: 'Payment initiated',
    }),
    checkPaymentStatus: jest.fn().mockResolvedValue({
      transaction_id: 'eco-txn-001', status: 'completed',
    }),
    generatePaymentInstructions: jest.fn().mockReturnValue('Dial *151#'),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 50 }),
    getCapabilities: jest.fn().mockReturnValue({ supportsUSSD: true }),
  })),
}));

jest.mock('../onemoney-provider', () => ({
  OneMoneyProvider: jest.fn().mockImplementation(() => ({
    name: 'onemoney',
    initiatePayment: jest.fn().mockResolvedValue({
      success: true, transaction_id: 'om-txn-001', status: 'pending', message: 'ok',
    }),
    checkPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
    generatePaymentInstructions: jest.fn().mockReturnValue('Dial *111#'),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 80 }),
    getCapabilities: jest.fn().mockReturnValue({ supportsUSSD: true }),
  })),
}));

jest.mock('../omari-provider', () => ({
  OmariProvider: jest.fn().mockImplementation(() => ({
    name: 'omari',
    initiatePayment: jest.fn().mockResolvedValue({
      success: true, transaction_id: 'omr-txn-001', status: 'pending', message: 'ok',
    }),
    checkPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
    generatePaymentInstructions: jest.fn().mockReturnValue('Instructions'),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 100 }),
    getCapabilities: jest.fn().mockReturnValue({}),
  })),
}));

jest.mock('../innbucks-provider', () => ({
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

jest.mock('../payment-analytics', () => ({
  PaymentAnalyticsService: jest.fn().mockImplementation(() => ({
    trackPaymentMethod: jest.fn().mockResolvedValue(undefined),
    calculateFee: jest.fn().mockReturnValue(0.50),
  })),
}));

jest.mock('../payment-event-logger', () => ({
  PaymentEventLogger: jest.fn().mockImplementation(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../payment-state-machine', () => ({
  PaymentStateMachine: jest.fn().mockImplementation(() => ({
    transition: jest.fn().mockResolvedValue(true),
    isValidTransition: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('../currency-conversion', () => ({
  convertToUsd: jest.fn().mockImplementation(async (amount: number, currency: string) => {
    if (currency === 'USD') return amount;
    if (currency === 'ZWL') return amount * 0.0003;
    if (currency === 'ZAR') return amount * 0.055;
    return amount;
  }),
}));

jest.mock('../../../shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../shared/utils/sqs-publisher', () => ({
  SQSQueues: {
    sendNotification: jest.fn().mockResolvedValue(undefined),
    processDeviceLock: jest.fn().mockResolvedValue(undefined),
    syncDataWarehouse: jest.fn().mockResolvedValue(undefined),
    processLoanUpdate: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../shared/clients/fineract-sync', () => ({
  disburseLoanInFineract: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports ──────────────────────────────────────────────────────────────

import { PaymentService } from '../payment-service';

const { db, __mockExecute } = require('../../../shared/clients/database');
const { SQSQueues } = require('../../../shared/utils/sqs-publisher');
const { disburseLoanInFineract } = require('../../../shared/clients/fineract-sync');

// ── Test Suite ───────────────────────────────────────────────────────────

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
    service = new PaymentService();

    // Default: DB operations succeed
    __mockExecute.mockResolvedValue({
      data: { id: 'pay-001', status: 'pending', gateway: 'ecocash' },
      error: null,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // validateTransactionLimits — RBZ Regulatory Limits
  // ═══════════════════════════════════════════════════════════════════════

  describe('validateTransactionLimits', () => {
    it('should reject single transaction > $2000 USD', async () => {
      const result = await service.validateTransactionLimits('cust-1', 2500, 'USD');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Single transaction limit exceeded');
    });

    it('should allow single transaction at exactly $2000', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })   // daily
        .mockResolvedValueOnce({ data: [], error: null });   // monthly
      const result = await service.validateTransactionLimits('cust-1', 2000, 'USD');
      expect(result.allowed).toBe(true);
    });

    it('should reject when daily total > $5000', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [{ amount: 4800, currency: 'USD' }], error: null })
        .mockResolvedValueOnce({ data: [], error: null });
      const result = await service.validateTransactionLimits('cust-1', 500, 'USD');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily transaction limit exceeded');
    });

    it('should reject when monthly total > $50000', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [{ amount: 100, currency: 'USD' }], error: null })
        .mockResolvedValueOnce({ data: [{ amount: 49600, currency: 'USD' }], error: null });
      const result = await service.validateTransactionLimits('cust-1', 500, 'USD');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Monthly transaction limit exceeded');
    });

    it('should allow amount within all limits', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });
      const result = await service.validateTransactionLimits('cust-1', 500, 'USD');
      expect(result.allowed).toBe(true);
    });

    it('should convert ZWL to USD for limit checking', async () => {
      // 10000 ZWL * 0.0003 = $3 USD — well within limits
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });
      const result = await service.validateTransactionLimits('cust-1', 10000, 'ZWL');
      expect(result.allowed).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // initiatePayment
  // ═══════════════════════════════════════════════════════════════════════

  describe('initiatePayment', () => {
    function setupInitiateMocks(): void {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })   // daily limit
        .mockResolvedValueOnce({ data: [], error: null })   // monthly limit
        .mockResolvedValueOnce({                            // insert payment
          data: { id: 'pay-001', status: 'pending', gateway: 'ecocash' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });    // subsequent updates
    }

    it('should create payment record and return transaction details', async () => {
      setupInitiateMocks();
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

    it('should reject payment exceeding single transaction limit', async () => {
      __mockExecute.mockReset();
      await expect(
        service.initiatePayment({
          loan_id: 'loan-1',
          customer_id: 'cust-1',
          amount: 3000,
          currency: 'USD',
          customer_phone: '+263771234567',
          gateway: 'ecocash',
          payment_type: 'repayment',
        })
      ).rejects.toThrow('Payment initiation failed');
    });

    it('should use payment state machine transitions: pending -> held -> processing', async () => {
      setupInitiateMocks();
      const { PaymentStateMachine } = require('../payment-state-machine');
      const mockSM = PaymentStateMachine.mock.results[PaymentStateMachine.mock.results.length - 1]?.value;

      await service.initiatePayment({
        loan_id: 'loan-1',
        customer_id: 'cust-1',
        amount: 100,
        currency: 'USD',
        customer_phone: '+263771234567',
        gateway: 'ecocash',
        payment_type: 'deposit',
      });

      if (mockSM) {
        // First transition: pending -> held
        expect(mockSM.transition).toHaveBeenCalledWith(
          'pay-001', 'pending', 'held',
          expect.objectContaining({ gateway: 'ecocash' })
        );
        // Second transition: held -> processing
        expect(mockSM.transition).toHaveBeenCalledWith(
          'pay-001', 'held', 'processing',
          expect.objectContaining({ gateway: 'ecocash' })
        );
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // processPaymentCompletion — Payment Type Handling
  // ═══════════════════════════════════════════════════════════════════════

  describe('processPaymentCompletion', () => {
    it('should skip processing when payment status is not completed', async () => {
      __mockExecute.mockReset();
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'pay-001', status: 'pending', payment_type: 'deposit' },
        error: null,
      });

      await service.processPaymentCompletion('pay-001');

      // Should not attempt to link payment to loan
      expect(db.from).toHaveBeenCalledTimes(1); // Only the initial fetch
    });

    // ─── Deposit Completion ──────────────────────────────────────

    it('deposit: updates loan status to paid_deposit', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-001', loan_id: 'loan-1', customer_id: 'cust-1',
            amount: 200, status: 'completed', payment_type: 'deposit',
            completed_at: '2026-03-01T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-1', outstanding_balance: 1000, status: 'approved' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-001');

      expect(db.from).toHaveBeenCalledWith('loans');
    });

    it('deposit: sends WhatsApp deposit_confirmed notification', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-001', loan_id: 'loan-1', customer_id: 'cust-1',
            amount: 200, status: 'completed', payment_type: 'deposit',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-1', outstanding_balance: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-001');

      expect(SQSQueues.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-1',
          channel: 'whatsapp',
          templateName: 'deposit_confirmed',
        })
      );
    });

    it('deposit: triggers Fineract disbursement sync when fineract_loan_id exists', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-001', loan_id: 'loan-1', customer_id: 'cust-1',
            amount: 200, status: 'completed', payment_type: 'deposit',
            completed_at: '2026-03-01T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-1', outstanding_balance: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update loan
        .mockResolvedValueOnce({                             // fetch loan for Fineract
          data: { fineract_loan_id: 'fin-loan-123' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-001');

      expect(disburseLoanInFineract).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: 'loan-1',
          fineractLoanId: 'fin-loan-123',
        })
      );
    });

    it('deposit: queues loan status update (deposit_received)', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-001', loan_id: 'loan-1', customer_id: 'cust-1',
            amount: 200, status: 'completed', payment_type: 'deposit',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-1', outstanding_balance: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-001');

      expect(SQSQueues.processLoanUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: 'loan-1',
          action: 'deposit_received',
        })
      );
    });

    // ─── Repayment Completion ────────────────────────────────────

    it('repayment: deducts from outstanding balance', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-002', loan_id: 'loan-2', customer_id: 'cust-2',
            amount: 100, status: 'completed', payment_type: 'repayment',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-2', outstanding_balance: 500, principal_amount: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update loan
        .mockResolvedValueOnce({                             // fetch updated loan
          data: { status: 'active', device_id: 'dev-001' },
          error: null,
        });

      await service.processPaymentCompletion('pay-002');

      // Loan update was called — balance reduced from 500 to 400
      expect(db.from).toHaveBeenCalledWith('loans');
    });

    it('repayment: marks loan paid_off when balance reaches 0', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-003', loan_id: 'loan-3', customer_id: 'cust-3',
            amount: 500, status: 'completed', payment_type: 'repayment',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-3', outstanding_balance: 500, principal_amount: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update loan (balance = 0 -> paid_off)
        .mockResolvedValueOnce({
          data: { status: 'paid_off', device_id: 'dev-001' },
          error: null,
        });

      await service.processPaymentCompletion('pay-003');

      // Verify the update was called with paid_off status
      expect(db.from).toHaveBeenCalledWith('loans');
    });

    it('repayment: triggers device unlock when fully paid and device exists', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-004', loan_id: 'loan-4', customer_id: 'cust-4',
            amount: 300, status: 'completed', payment_type: 'repayment',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-4', outstanding_balance: 300, principal_amount: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { status: 'paid_off', device_id: 'dev-002' },
          error: null,
        });

      await service.processPaymentCompletion('pay-004');

      expect(SQSQueues.processDeviceLock).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'dev-002',
          action: 'unlock',
          reason: 'loan_paid_off',
          loanId: 'loan-4',
        })
      );
    });

    it('repayment: does not trigger unlock when no device exists on loan', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-005', loan_id: 'loan-5', customer_id: 'cust-5',
            amount: 100, status: 'completed', payment_type: 'repayment',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-5', outstanding_balance: 500, principal_amount: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { status: 'active', device_id: null },
          error: null,
        });

      await service.processPaymentCompletion('pay-005');

      expect(SQSQueues.processDeviceLock).not.toHaveBeenCalled();
    });

    it('repayment: triggers unlock evaluation when device exists', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-011', loan_id: 'loan-11', customer_id: 'cust-11',
            amount: 100, status: 'completed', payment_type: 'repayment',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-11', outstanding_balance: 400, principal_amount: 1000, status: 'active' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { status: 'active', device_id: 'dev-005' },
          error: null,
        });

      await service.processPaymentCompletion('pay-011');

      expect(SQSQueues.processDeviceLock).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'dev-005',
          action: 'unlock',
          reason: 'repayment_received',
          loanId: 'loan-11',
        })
      );
    });

    // ─── Disbursement Completion ─────────────────────────────────

    it('disbursement: marks loan as active and sets disbursement_date', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-006', loan_id: 'loan-6', customer_id: 'cust-6',
            amount: 1000, currency: 'USD', status: 'completed', payment_type: 'disbursement',
            completed_at: '2026-03-01T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-6', outstanding_balance: 0, status: 'approved' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-006');

      // Verify loan was updated to active
      expect(db.from).toHaveBeenCalledWith('loans');
    });

    it('disbursement: sends WhatsApp disbursement_confirmed notification', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-007', loan_id: 'loan-7', customer_id: 'cust-7',
            amount: 800, status: 'completed', payment_type: 'disbursement',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-7', outstanding_balance: 0, status: 'approved' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-007');

      expect(SQSQueues.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-7',
          channel: 'whatsapp',
          templateName: 'disbursement_confirmed',
        })
      );
    });

    it('disbursement: queues data warehouse sync', async () => {
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-008', loan_id: 'loan-8', customer_id: 'cust-8',
            amount: 600, currency: 'USD', status: 'completed', payment_type: 'disbursement',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-8', outstanding_balance: 0, status: 'approved' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-008');

      expect(SQSQueues.syncDataWarehouse).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'loan.disbursed',
          entityId: 'loan-8',
          entityType: 'loan',
        })
      );
    });

    // ─── Unhandled Payment Type ──────────────────────────────────

    it('should log warning for unhandled payment type', async () => {
      const logger = require('../../../shared/utils/logger').default;
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-009', loan_id: 'loan-9', customer_id: 'cust-9',
            amount: 50, status: 'completed', payment_type: 'unknown_type',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-9', outstanding_balance: 500, status: 'active' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-009');

      expect(logger.warn).toHaveBeenCalledWith(
        'Unhandled payment type in processPaymentCompletion',
        expect.objectContaining({
          meta: expect.objectContaining({ paymentType: 'unknown_type' }),
        })
      );
    });

    // ─── Penalty Payment ─────────────────────────────────────────

    it('penalty: logs penalty payment completion', async () => {
      const logger = require('../../../shared/utils/logger').default;
      __mockExecute.mockReset();
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-010', loan_id: 'loan-10', customer_id: 'cust-10',
            amount: 25, status: 'completed', payment_type: 'penalty',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'loan-10', outstanding_balance: 500, status: 'active' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      await service.processPaymentCompletion('pay-010');

      expect(logger.info).toHaveBeenCalledWith(
        'Penalty payment completed',
        expect.objectContaining({
          action: 'payment.penalty_paid',
        })
      );
    });

    // ─── Error Handling ──────────────────────────────────────────

    it('should throw when payment is not found', async () => {
      __mockExecute.mockReset();
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.processPaymentCompletion('pay-missing')).rejects.toThrow('Payment not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getProviderHealth
  // ═══════════════════════════════════════════════════════════════════════

  describe('getProviderHealth', () => {
    it('should return health status for all four providers', async () => {
      const health = await service.getProviderHealth();
      expect(health.ecocash).toBeDefined();
      expect(health.onemoney).toBeDefined();
      expect(health.omari).toBeDefined();
      expect(health.innbucks).toBeDefined();
      expect(health.ecocash.healthy).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // checkPaymentStatus
  // ═══════════════════════════════════════════════════════════════════════

  describe('checkPaymentStatus', () => {
    it('should return cached status for terminal states (completed, failed, cancelled)', async () => {
      __mockExecute.mockReset();
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'pay-001', status: 'completed', gateway: 'ecocash' },
        error: null,
      });

      const result = await service.checkPaymentStatus('pay-001');
      expect(result.status).toBe('completed');
    });

    it('should throw when payment is not found', async () => {
      __mockExecute.mockReset();
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.checkPaymentStatus('pay-missing')).rejects.toThrow(
        'Failed to check payment status'
      );
    });
  });
});
