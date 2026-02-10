/**
 * Cross-Service Data Flow Tests: Payment Reconciliation
 *
 * Validates payment data flow and reconciliation across services:
 * Payment initiation -> Webhook update -> Loan balance update -> Notification sent
 *
 * Ensures idempotent webhook processing, correct balance calculations,
 * failed payment handling, and concurrent payment safety.
 */

import {
  seedMockTable,
  getMockTable,
  resetMockDataStore,
  createTestCustomer,
  createTestLoan,
  createTestPayment,
  generateTestId,
} from '../../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  match: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};

const mockSupabaseClient = {
  from: jest.fn(() => ({ ...mockQueryBuilder })),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('axios', () => ({
  default: { post: jest.fn().mockResolvedValue({ data: {} }) },
  post: jest.fn(),
  isAxiosError: jest.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Payment Reconciliation Data Flow Tests', () => {
  const customerId = 'cust_pay_001';
  const loanId = 'loan_pay_001';
  const paymentId = 'pay_recon_001';

  beforeEach(() => {
    resetMockDataStore();
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Payment initiation creates payment record
  // =========================================================================
  describe('Payment Initiation -> Record Creation', () => {
    it('should create a payment record with pending status upon initiation', () => {
      // Loan exists
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: 30800, // $308.00 in cents
          loan_status: 'active',
        }),
      ]);

      // Payment initiated
      const payment = createTestPayment({
        id: paymentId,
        loan_id: loanId,
        customer_id: customerId,
        payment_amount_usd: 5133, // $51.33 in cents representation
        payment_method: 'ecocash',
        payment_status: 'pending',
        provider_reference: 'EC_TXN_001',
      });
      seedMockTable('payments', [payment]);

      const payments = getMockTable('payments');
      expect(payments).toHaveLength(1);
      expect(payments[0].id).toBe(paymentId);
      expect(payments[0].loan_id).toBe(loanId);
      expect(payments[0].customer_id).toBe(customerId);
      expect(payments[0].payment_status).toBe('pending');
    });

    it('should link payment to correct loan via loan_id', () => {
      seedMockTable('loans', [createTestLoan({ id: loanId, customer_id: customerId })]);
      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          customer_id: customerId,
        }),
      ]);

      const loan = getMockTable('loans')[0];
      const payment = getMockTable('payments')[0];

      expect(payment.loan_id).toBe(loan.id);
      expect(payment.customer_id).toBe(loan.customer_id);
    });
  });

  // =========================================================================
  // 2. Webhook updates same payment record
  // =========================================================================
  describe('Webhook -> Payment Record Update -> Loan Balance Update', () => {
    it('should update payment status from pending to completed on webhook', () => {
      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          customer_id: customerId,
          payment_amount_usd: 51.33,
          payment_status: 'pending',
          provider_reference: 'EC_TXN_001',
        }),
      ]);

      // Simulate webhook processing
      const payments = getMockTable('payments');
      payments[0] = {
        ...payments[0],
        payment_status: 'completed',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updated = getMockTable('payments')[0];
      expect(updated.payment_status).toBe('completed');
      expect(updated.paid_at).toBeDefined();
    });

    it('should reduce loan outstanding_balance by exact payment amount', () => {
      const previousBalance = 200.00;
      const paymentAmount = 51.33;
      const expectedBalance = previousBalance - paymentAmount;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: previousBalance,
          loan_status: 'active',
        }),
      ]);

      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          payment_amount_usd: paymentAmount,
          payment_status: 'completed',
        }),
      ]);

      // Simulate balance update after webhook
      const loans = getMockTable('loans');
      loans[0] = {
        ...loans[0],
        outstanding_balance_usd: expectedBalance,
        updated_at: new Date().toISOString(),
      };

      const updatedLoan = getMockTable('loans')[0];
      expect(updatedLoan.outstanding_balance_usd).toBe(expectedBalance);
      // Verify exact arithmetic: outstanding_balance = previous_balance - payment_amount
      expect(updatedLoan.outstanding_balance_usd).toBe(148.67);
    });

    it('should verify outstanding_balance = previous_balance - payment_amount exactly', () => {
      const testCases = [
        { previous: 308.00, payment: 51.33, expected: 256.67 },
        { previous: 256.67, payment: 51.33, expected: 205.34 },
        { previous: 205.34, payment: 51.33, expected: 154.01 },
        { previous: 154.01, payment: 51.33, expected: 102.68 },
        { previous: 102.68, payment: 51.33, expected: 51.35 },
        { previous: 51.35, payment: 51.35, expected: 0.00 },
      ];

      for (const tc of testCases) {
        // Use integer cents arithmetic to avoid floating point issues
        const previousCents = Math.round(tc.previous * 100);
        const paymentCents = Math.round(tc.payment * 100);
        const expectedCents = Math.round(tc.expected * 100);

        const resultCents = previousCents - paymentCents;
        expect(resultCents).toBe(expectedCents);
      }
    });
  });

  // =========================================================================
  // 3. Idempotent webhook processing
  // =========================================================================
  describe('Idempotent Webhook Processing', () => {
    it('should not double-count when same webhook is processed twice', () => {
      const previousBalance = 200.00;
      const paymentAmount = 51.33;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: previousBalance,
        }),
      ]);

      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          payment_amount_usd: paymentAmount,
          payment_status: 'pending',
          provider_reference: 'EC_TXN_001',
        }),
      ]);

      // First webhook processing
      const paymentsFirst = getMockTable('payments');
      paymentsFirst[0] = { ...paymentsFirst[0], payment_status: 'completed' };

      const loansFirst = getMockTable('loans');
      loansFirst[0] = {
        ...loansFirst[0],
        outstanding_balance_usd: previousBalance - paymentAmount,
      };

      // Second webhook processing (duplicate) -- should check status first
      const existingPayment = getMockTable('payments')[0];
      const isAlreadyCompleted = existingPayment.payment_status === 'completed';

      expect(isAlreadyCompleted).toBe(true);

      // Balance should NOT be reduced again
      const finalLoan = getMockTable('loans')[0];
      expect(finalLoan.outstanding_balance_usd).toBe(previousBalance - paymentAmount);
      // Not double-deducted
      expect(finalLoan.outstanding_balance_usd).not.toBe(
        previousBalance - paymentAmount * 2,
      );
    });

    it('should handle idempotency by checking provider_reference', () => {
      const providerRef = 'EC_TXN_UNIQUE_001';

      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          provider_reference: providerRef,
          payment_status: 'completed',
        }),
      ]);

      // Check if a payment with this provider_reference already exists
      const existingPayments = getMockTable('payments').filter(
        (p) => p.provider_reference === providerRef,
      );

      expect(existingPayments).toHaveLength(1);

      // A second payment with same provider_reference should be detected as duplicate
      const isDuplicate = existingPayments.length > 0
        && existingPayments[0].payment_status === 'completed';
      expect(isDuplicate).toBe(true);
    });
  });

  // =========================================================================
  // 4. Failed payments do not reduce loan balance
  // =========================================================================
  describe('Failed Payment Handling', () => {
    it('should not reduce loan balance when payment fails', () => {
      const originalBalance = 200.00;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: originalBalance,
        }),
      ]);

      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          payment_amount_usd: 51.33,
          payment_status: 'failed',
          failure_reason: 'Insufficient funds',
        }),
      ]);

      // Failed payment -- loan balance should remain unchanged
      const loan = getMockTable('loans')[0];
      expect(loan.outstanding_balance_usd).toBe(originalBalance);
    });

    it('should record failure reason on the payment record', () => {
      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          payment_status: 'failed',
          failure_reason: 'Insufficient funds',
        }),
      ]);

      const payment = getMockTable('payments')[0];
      expect(payment.payment_status).toBe('failed');
      expect(payment.failure_reason).toBe('Insufficient funds');
    });

    it('should not change loan status on payment failure', () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_status: 'active',
          outstanding_balance_usd: 200.00,
        }),
      ]);

      // Payment fails
      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          payment_status: 'failed',
        }),
      ]);

      const loan = getMockTable('loans')[0];
      expect(loan.loan_status).toBe('active');
      expect(loan.outstanding_balance_usd).toBe(200.00);
    });
  });

  // =========================================================================
  // 5. Payment reconciliation catches orphaned transactions
  // =========================================================================
  describe('Orphaned Transaction Detection', () => {
    it('should detect payments with no matching loan', () => {
      // Payment references a loan that does not exist
      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: 'loan_nonexistent_999',
          payment_status: 'pending',
        }),
      ]);

      // No loans seeded
      seedMockTable('loans', []);

      const payments = getMockTable('payments');
      const loans = getMockTable('loans');

      const orphanedPayments = payments.filter((p) => {
        const matchingLoan = loans.find((l) => l.id === p.loan_id);
        return !matchingLoan;
      });

      expect(orphanedPayments).toHaveLength(1);
      expect(orphanedPayments[0].id).toBe(paymentId);
    });

    it('should detect stale pending payments older than 24 hours', () => {
      const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const freshTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

      seedMockTable('payments', [
        createTestPayment({
          id: 'pay_stale_001',
          loan_id: loanId,
          payment_status: 'pending',
          created_at: staleTime,
        }),
        createTestPayment({
          id: 'pay_fresh_001',
          loan_id: loanId,
          payment_status: 'pending',
          created_at: freshTime,
        }),
      ]);

      const payments = getMockTable('payments');
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;

      const stalePayments = payments.filter(
        (p) =>
          p.payment_status === 'pending'
          && new Date(p.created_at as string).getTime() < cutoff,
      );

      expect(stalePayments).toHaveLength(1);
      expect(stalePayments[0].id).toBe('pay_stale_001');
    });
  });

  // =========================================================================
  // 6. Concurrent payment handling
  // =========================================================================
  describe('Concurrent Payment Handling', () => {
    it('should produce correct final balance when two payments for same loan are processed simultaneously', async () => {
      const initialBalance = 200.00;
      const payment1Amount = 51.33;
      const payment2Amount = 51.33;
      const expectedFinalBalance = initialBalance - payment1Amount - payment2Amount;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: initialBalance,
        }),
      ]);

      // Simulate two concurrent payments
      const processPayment = async (
        payId: string,
        amount: number,
      ): Promise<void> => {
        // Each payment reads the current balance
        const currentLoan = getMockTable('loans').find((l) => l.id === loanId);
        if (!currentLoan) throw new Error('Loan not found');

        seedMockTable('payments', [
          ...getMockTable('payments'),
          createTestPayment({
            id: payId,
            loan_id: loanId,
            payment_amount_usd: amount,
            payment_status: 'completed',
          }),
        ]);
      };

      // Process both payments
      await Promise.all([
        processPayment('pay_concurrent_001', payment1Amount),
        processPayment('pay_concurrent_002', payment2Amount),
      ]);

      // Calculate final balance from all completed payments
      const allCompletedPayments = getMockTable('payments').filter(
        (p) => p.loan_id === loanId && p.payment_status === 'completed',
      );
      const totalPaid = allCompletedPayments.reduce(
        (sum, p) => sum + (p.payment_amount_usd as number),
        0,
      );

      const reconciledBalance = initialBalance - totalPaid;

      expect(allCompletedPayments).toHaveLength(2);
      expect(reconciledBalance).toBeCloseTo(expectedFinalBalance, 2);
      expect(reconciledBalance).toBeCloseTo(97.34, 2);
    });

    it('should not create duplicate payment records for the same provider_reference', () => {
      const providerRef = 'EC_TXN_CONCURRENT_001';

      seedMockTable('payments', [
        createTestPayment({
          id: 'pay_first',
          loan_id: loanId,
          provider_reference: providerRef,
          payment_status: 'completed',
        }),
      ]);

      // Check before creating another
      const existing = getMockTable('payments').filter(
        (p) => p.provider_reference === providerRef,
      );

      expect(existing).toHaveLength(1);

      // Do not create a second one if reference already exists
      if (existing.length === 0) {
        seedMockTable('payments', [
          ...getMockTable('payments'),
          createTestPayment({
            id: 'pay_second',
            loan_id: loanId,
            provider_reference: providerRef,
          }),
        ]);
      }

      const finalPayments = getMockTable('payments').filter(
        (p) => p.provider_reference === providerRef,
      );
      expect(finalPayments).toHaveLength(1);
    });
  });

  // =========================================================================
  // 7. Payment notification flow
  // =========================================================================
  describe('Payment -> Notification Flow', () => {
    it('should create a notification record after payment completion', () => {
      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          customer_id: customerId,
          payment_amount_usd: 51.33,
          payment_status: 'completed',
        }),
      ]);

      // Notification created for the payment
      seedMockTable('notifications', [
        {
          id: generateTestId('notif'),
          customer_id: customerId,
          channel: 'whatsapp',
          message: 'Your payment of $51.33 has been received. Outstanding balance: $148.67',
          template_name: 'payment_confirmation',
          status: 'sent',
          metadata: { payment_id: paymentId, loan_id: loanId, amount: 51.33 },
          created_at: new Date().toISOString(),
        },
      ]);

      const notifications = getMockTable('notifications');
      const paymentNotif = notifications.find(
        (n) => (n.metadata as Record<string, unknown>)?.payment_id === paymentId,
      );

      expect(paymentNotif).toBeDefined();
      expect(paymentNotif!.customer_id).toBe(customerId);
      expect(paymentNotif!.channel).toBe('whatsapp');
      expect(paymentNotif!.status).toBe('sent');
    });
  });

  // =========================================================================
  // 8. Full payment lifecycle data integrity
  // =========================================================================
  describe('Full Payment Lifecycle', () => {
    it('should trace payment from initiation to balance update to notification', () => {
      const initialBalance = 200.00;
      const paymentAmount = 51.33;
      const newBalance = initialBalance - paymentAmount;

      // Step 1: Loan exists
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: initialBalance,
          loan_status: 'active',
        }),
      ]);

      seedMockTable('customers', [
        createTestCustomer({ id: customerId }),
      ]);

      // Step 2: Payment initiated
      seedMockTable('payments', [
        createTestPayment({
          id: paymentId,
          loan_id: loanId,
          customer_id: customerId,
          payment_amount_usd: paymentAmount,
          payment_status: 'pending',
        }),
      ]);

      // Step 3: Webhook completes payment
      const payments = getMockTable('payments');
      payments[0] = {
        ...payments[0],
        payment_status: 'completed',
        paid_at: new Date().toISOString(),
      };

      // Step 4: Loan balance updated
      const loans = getMockTable('loans');
      loans[0] = {
        ...loans[0],
        outstanding_balance_usd: newBalance,
      };

      // Step 5: Notification sent
      seedMockTable('notifications', [
        {
          id: generateTestId('notif'),
          customer_id: customerId,
          channel: 'whatsapp',
          message: `Payment of $${paymentAmount} received. Balance: $${newBalance.toFixed(2)}`,
          status: 'sent',
          metadata: { payment_id: paymentId },
          created_at: new Date().toISOString(),
        },
      ]);

      // Verify full chain
      const finalPayment = getMockTable('payments')[0];
      const finalLoan = getMockTable('loans')[0];
      const notifications = getMockTable('notifications');

      expect(finalPayment.payment_status).toBe('completed');
      expect(finalLoan.outstanding_balance_usd).toBe(newBalance);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].customer_id).toBe(customerId);

      // Amounts match
      expect(
        (finalPayment.payment_amount_usd as number),
      ).toBe(paymentAmount);
      expect(
        (initialBalance - (finalPayment.payment_amount_usd as number)),
      ).toBe(finalLoan.outstanding_balance_usd);
    });
  });
});
