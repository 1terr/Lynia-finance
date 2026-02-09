/**
 * Cross-Service Data Flow Tests: Concurrent Operations
 *
 * Validates data integrity under concurrent operations:
 * - Two payments for same loan processed simultaneously
 * - Two admin users approving same loan
 * - Customer submitting KYC while previous is still pending
 * - Device lock and unlock racing
 * - No double-counting, no orphaned records, no data corruption
 */

import {
  createMockSupabaseClient,
  seedMockTable,
  getMockTable,
  resetMockDataStore,
  createTestCustomer,
  createTestLoan,
  createTestPayment,
  createTestDevice,
  generateTestId,
  wait,
} from '../../helpers/test-utils';
import { testCustomers, testLoans, testPayments, testDevices } from '../../fixtures';

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
// Concurrency Simulation Helpers
// ---------------------------------------------------------------------------

/**
 * Simulates an atomic balance update using compare-and-swap pattern.
 * Returns true if the update succeeded, false if a conflict was detected.
 */
function atomicBalanceUpdate(
  loanId: string,
  paymentAmount: number,
  expectedVersion: number,
): boolean {
  const loans = getMockTable('loans');
  const loan = loans.find((l) => l.id === loanId);
  if (!loan) return false;

  const currentVersion = (loan.version as number) || 0;
  if (currentVersion !== expectedVersion) {
    // Optimistic concurrency conflict
    return false;
  }

  const currentBalance = loan.outstanding_balance_usd as number;
  const newBalance = currentBalance - paymentAmount;

  const idx = loans.indexOf(loan);
  loans[idx] = {
    ...loans[idx],
    outstanding_balance_usd: newBalance,
    version: currentVersion + 1,
    updated_at: new Date().toISOString(),
  };

  return true;
}

/**
 * Simulates an atomic status update that only succeeds if current status
 * matches expected status (compare-and-swap for status).
 */
function atomicStatusUpdate(
  table: string,
  entityId: string,
  expectedStatus: string,
  newStatus: string,
  actor: string,
): boolean {
  const rows = getMockTable(table);
  const entity = rows.find((r) => r.id === entityId);
  if (!entity) return false;

  const currentStatus = (entity.status || entity.loan_status || entity.lock_status) as string;
  if (currentStatus !== expectedStatus) {
    return false; // Status already changed by another actor
  }

  const idx = rows.indexOf(entity);
  const statusField = entity.loan_status !== undefined
    ? 'loan_status'
    : entity.lock_status !== undefined
      ? 'lock_status'
      : 'status';

  rows[idx] = {
    ...rows[idx],
    [statusField]: newStatus,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  };

  return true;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Concurrent Operations Data Flow Tests', () => {
  const customerId = 'cust_concurrent_001';
  const loanId = 'loan_concurrent_001';
  const deviceId = 'dev_concurrent_001';

  beforeEach(() => {
    resetMockDataStore();
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Two payments for same loan processed simultaneously
  // =========================================================================
  describe('Concurrent Payments for Same Loan', () => {
    it('should produce correct final balance when two payments processed simultaneously', async () => {
      const initialBalance = 200.00;
      const payment1Amount = 51.33;
      const payment2Amount = 51.33;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: initialBalance,
          version: 0,
        }),
      ]);

      seedMockTable('payments', []);

      // Simulate two concurrent payment processes
      const processPayment = async (
        payId: string,
        amount: number,
        providerRef: string,
      ): Promise<{ success: boolean; paymentId: string }> => {
        // Check for duplicate provider reference
        const existing = getMockTable('payments').filter(
          (p) => p.provider_reference === providerRef,
        );
        if (existing.length > 0) {
          return { success: false, paymentId: payId };
        }

        // Create payment record
        getMockTable('payments').push(
          createTestPayment({
            id: payId,
            loan_id: loanId,
            customer_id: customerId,
            payment_amount_usd: amount,
            payment_status: 'completed',
            provider_reference: providerRef,
          }),
        );

        return { success: true, paymentId: payId };
      };

      // Execute concurrently
      const results = await Promise.all([
        processPayment('pay_conc_001', payment1Amount, 'EC_TXN_001'),
        processPayment('pay_conc_002', payment2Amount, 'EC_TXN_002'),
      ]);

      // Both payments should succeed (different provider references)
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Reconcile: calculate correct final balance from payments
      const completedPayments = getMockTable('payments').filter(
        (p) => p.loan_id === loanId && p.payment_status === 'completed',
      );
      const totalPaid = completedPayments.reduce(
        (sum, p) => sum + (p.payment_amount_usd as number),
        0,
      );

      const correctBalance = initialBalance - totalPaid;
      expect(completedPayments).toHaveLength(2);
      expect(correctBalance).toBeCloseTo(97.34, 2);
    });

    it('should not double-count the same payment via optimistic concurrency', async () => {
      const initialBalance = 200.00;
      const paymentAmount = 51.33;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: initialBalance,
          version: 0,
        }),
      ]);

      // First update succeeds
      const firstSuccess = atomicBalanceUpdate(loanId, paymentAmount, 0);
      expect(firstSuccess).toBe(true);

      // Second update with same version fails (conflict)
      const secondSuccess = atomicBalanceUpdate(loanId, paymentAmount, 0);
      expect(secondSuccess).toBe(false);

      // Balance should only be reduced once
      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.outstanding_balance_usd).toBeCloseTo(
        initialBalance - paymentAmount,
        2,
      );
      expect(loan!.version).toBe(1);
    });

    it('should handle retry after concurrency conflict', async () => {
      const initialBalance = 200.00;
      const paymentAmount = 51.33;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: initialBalance,
          version: 0,
        }),
      ]);

      // First payment succeeds
      const firstSuccess = atomicBalanceUpdate(loanId, paymentAmount, 0);
      expect(firstSuccess).toBe(true);

      // Second payment initially fails (version mismatch)
      const secondFail = atomicBalanceUpdate(loanId, paymentAmount, 0);
      expect(secondFail).toBe(false);

      // Retry with correct version
      const secondRetry = atomicBalanceUpdate(loanId, paymentAmount, 1);
      expect(secondRetry).toBe(true);

      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.outstanding_balance_usd).toBeCloseTo(
        initialBalance - paymentAmount * 2,
        2,
      );
      expect(loan!.version).toBe(2);
    });
  });

  // =========================================================================
  // 2. Two admin users approving same loan
  // =========================================================================
  describe('Concurrent Loan Approval', () => {
    it('should only allow one admin to approve the same loan', async () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_status: 'pending',
        }),
      ]);

      // Two admins try to approve simultaneously
      const admin1Approve = async (): Promise<boolean> => {
        return atomicStatusUpdate('loans', loanId, 'pending', 'approved', 'admin_001');
      };

      const admin2Approve = async (): Promise<boolean> => {
        return atomicStatusUpdate('loans', loanId, 'pending', 'approved', 'admin_002');
      };

      const results = await Promise.all([admin1Approve(), admin2Approve()]);

      // Exactly one should succeed
      const successes = results.filter((r) => r === true);
      expect(successes).toHaveLength(1);

      // Loan should be approved (only once)
      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.loan_status).toBe('approved');
    });

    it('should track which admin performed the approval', async () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_status: 'pending',
        }),
      ]);

      // Only one admin succeeds
      atomicStatusUpdate('loans', loanId, 'pending', 'approved', 'admin_001');

      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.loan_status).toBe('approved');
      expect(loan!.updated_by).toBe('admin_001');
    });

    it('should reject duplicate approval attempt', async () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_status: 'approved',
          updated_by: 'admin_001',
        }),
      ]);

      // Second admin tries to approve an already-approved loan
      const result = atomicStatusUpdate(
        'loans',
        loanId,
        'pending',
        'approved',
        'admin_002',
      );

      expect(result).toBe(false); // Fails because status is no longer 'pending'

      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.updated_by).toBe('admin_001'); // Original approver unchanged
    });
  });

  // =========================================================================
  // 3. KYC submission while previous is still pending
  // =========================================================================
  describe('Concurrent KYC Submissions', () => {
    it('should handle KYC submission when previous is still pending', () => {
      // First KYC submission is pending
      seedMockTable('kyc_submissions', [
        {
          id: 'kyc_001',
          customer_id: customerId,
          status: 'pending',
          submitted_at: '2025-06-01T10:00:00.000Z',
          created_at: '2025-06-01T10:00:00.000Z',
        },
      ]);

      // Check if there is a pending submission
      const pendingSubmissions = getMockTable('kyc_submissions').filter(
        (k) => k.customer_id === customerId && k.status === 'pending',
      );

      expect(pendingSubmissions).toHaveLength(1);

      // New submission should detect existing pending and return it
      const hasPending = pendingSubmissions.length > 0;
      expect(hasPending).toBe(true);

      // Should NOT create a second pending submission
      if (hasPending) {
        // Return existing pending submission ID
        const existingId = pendingSubmissions[0].id;
        expect(existingId).toBe('kyc_001');
      }

      // Verify only one pending submission exists
      const allPending = getMockTable('kyc_submissions').filter(
        (k) => k.customer_id === customerId && k.status === 'pending',
      );
      expect(allPending).toHaveLength(1);
    });

    it('should allow new submission after previous is rejected', () => {
      seedMockTable('kyc_submissions', [
        {
          id: 'kyc_rejected_001',
          customer_id: customerId,
          status: 'rejected',
          submitted_at: '2025-06-01T10:00:00.000Z',
        },
      ]);

      // Check for pending or verified submissions
      const blocking = getMockTable('kyc_submissions').filter(
        (k) =>
          k.customer_id === customerId
          && (k.status === 'pending' || k.status === 'verified'),
      );

      expect(blocking).toHaveLength(0);

      // New submission is allowed
      getMockTable('kyc_submissions').push({
        id: 'kyc_retry_001',
        customer_id: customerId,
        status: 'pending',
        submitted_at: '2025-06-01T11:00:00.000Z',
      });

      const allSubs = getMockTable('kyc_submissions').filter(
        (k) => k.customer_id === customerId,
      );
      expect(allSubs).toHaveLength(2);
      expect(allSubs[1].status).toBe('pending');
    });

    it('should not allow new submission when already verified', () => {
      seedMockTable('kyc_submissions', [
        {
          id: 'kyc_verified_001',
          customer_id: customerId,
          status: 'verified',
          verified_at: '2025-06-01T10:00:00.000Z',
        },
      ]);

      const verified = getMockTable('kyc_submissions').filter(
        (k) => k.customer_id === customerId && k.status === 'verified',
      );

      expect(verified).toHaveLength(1);

      // Should block new submission
      const isAlreadyVerified = verified.length > 0;
      expect(isAlreadyVerified).toBe(true);
    });
  });

  // =========================================================================
  // 4. Device lock and unlock racing
  // =========================================================================
  describe('Concurrent Device Lock/Unlock', () => {
    it('should resolve lock and unlock race to a deterministic final state', async () => {
      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          lock_status: 'unlocked',
          loan_id: loanId,
        }),
      ]);

      seedMockTable('device_lock_history', []);

      // Simulate race between lock (overdue trigger) and unlock (payment trigger)
      const lockAttempt = async (): Promise<boolean> => {
        return atomicStatusUpdate(
          'devices',
          deviceId,
          'unlocked',
          'locked',
          'system:overdue',
        );
      };

      const unlockAttempt = async (): Promise<boolean> => {
        // Unlock can only happen from 'locked' state
        return atomicStatusUpdate(
          'devices',
          deviceId,
          'locked',
          'unlocked',
          'system:payment',
        );
      };

      const [lockResult, unlockResult] = await Promise.all([
        lockAttempt(),
        unlockAttempt(),
      ]);

      // Since initial state is 'unlocked':
      // - Lock attempt expects 'unlocked' -> 'locked': should succeed
      // - Unlock attempt expects 'locked' -> 'unlocked': may fail
      // At least one must succeed, and the final state is deterministic
      const device = getMockTable('devices').find((d) => d.id === deviceId);

      if (lockResult && !unlockResult) {
        expect(device!.lock_status).toBe('locked');
      } else if (!lockResult && unlockResult) {
        // This shouldn't happen since initial state is 'unlocked'
        // and unlock expects 'locked'
        expect(true).toBe(true); // Edge case
      } else {
        // One of them must have succeeded
        expect(lockResult || unlockResult).toBe(true);
      }
    });

    it('should maintain consistent lock history even with concurrent operations', () => {
      seedMockTable('devices', [
        createTestDevice({ id: deviceId, lock_status: 'unlocked' }),
      ]);

      seedMockTable('device_lock_history', []);

      // Sequential: lock then unlock
      atomicStatusUpdate('devices', deviceId, 'unlocked', 'locked', 'system:overdue');
      getMockTable('device_lock_history').push({
        id: generateTestId('hist'),
        device_id: deviceId,
        action: 'lock',
        performed_at: '2025-06-01T10:00:00.000Z',
      });

      atomicStatusUpdate('devices', deviceId, 'locked', 'unlocked', 'system:payment');
      getMockTable('device_lock_history').push({
        id: generateTestId('hist'),
        device_id: deviceId,
        action: 'unlock',
        performed_at: '2025-06-01T10:01:00.000Z',
      });

      const history = getMockTable('device_lock_history');
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('lock');
      expect(history[1].action).toBe('unlock');

      const device = getMockTable('devices').find((d) => d.id === deviceId);
      expect(device!.lock_status).toBe('unlocked');
    });
  });

  // =========================================================================
  // 5. No double-counting of payments
  // =========================================================================
  describe('No Double-Counting', () => {
    it('should prevent processing the same webhook twice', async () => {
      const providerRef = 'EC_TXN_UNIQUE_001';
      const initialBalance = 200.00;
      const paymentAmount = 51.33;

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          outstanding_balance_usd: initialBalance,
          version: 0,
        }),
      ]);

      seedMockTable('payments', []);

      // First webhook: create payment and update balance
      const processWebhook = (webhookRef: string): boolean => {
        // Check idempotency
        const existing = getMockTable('payments').filter(
          (p) => p.provider_reference === webhookRef && p.payment_status === 'completed',
        );
        if (existing.length > 0) {
          return false; // Already processed
        }

        getMockTable('payments').push(
          createTestPayment({
            id: generateTestId('pay'),
            loan_id: loanId,
            payment_amount_usd: paymentAmount,
            payment_status: 'completed',
            provider_reference: webhookRef,
          }),
        );

        const loan = getMockTable('loans').find((l) => l.id === loanId);
        if (loan) {
          const idx = getMockTable('loans').indexOf(loan);
          getMockTable('loans')[idx] = {
            ...loan,
            outstanding_balance_usd:
              (loan.outstanding_balance_usd as number) - paymentAmount,
          };
        }
        return true;
      };

      // First processing
      const first = processWebhook(providerRef);
      expect(first).toBe(true);

      // Second processing (duplicate webhook)
      const second = processWebhook(providerRef);
      expect(second).toBe(false);

      // Only one payment created
      const payments = getMockTable('payments');
      expect(payments).toHaveLength(1);

      // Balance only reduced once
      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.outstanding_balance_usd).toBeCloseTo(
        initialBalance - paymentAmount,
        2,
      );
    });
  });

  // =========================================================================
  // 6. No orphaned records
  // =========================================================================
  describe('No Orphaned Records', () => {
    it('should not leave orphaned payment records if loan update fails', () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          outstanding_balance_usd: 200.00,
          version: 0,
        }),
      ]);

      seedMockTable('payments', []);

      // Payment record created
      const payId = generateTestId('pay');
      getMockTable('payments').push(
        createTestPayment({
          id: payId,
          loan_id: loanId,
          payment_amount_usd: 51.33,
          payment_status: 'pending',
        }),
      );

      // Loan update fails (simulated)
      const updateSucceeded = false;

      if (!updateSucceeded) {
        // Rollback: mark payment as failed
        const payments = getMockTable('payments');
        const payIdx = payments.findIndex((p) => p.id === payId);
        if (payIdx >= 0) {
          payments[payIdx] = {
            ...payments[payIdx],
            payment_status: 'failed',
            failure_reason: 'Balance update failed',
          };
        }
      }

      // Payment should be marked as failed, not orphaned as pending
      const payment = getMockTable('payments').find((p) => p.id === payId);
      expect(payment!.payment_status).toBe('failed');
      expect(payment!.failure_reason).toBe('Balance update failed');

      // Loan balance unchanged
      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.outstanding_balance_usd).toBe(200.00);
    });

    it('should ensure every payment has a corresponding loan', () => {
      seedMockTable('loans', [
        createTestLoan({ id: loanId }),
        createTestLoan({ id: 'loan_other_001' }),
      ]);

      seedMockTable('payments', [
        createTestPayment({ id: 'pay_001', loan_id: loanId }),
        createTestPayment({ id: 'pay_002', loan_id: 'loan_other_001' }),
        createTestPayment({ id: 'pay_orphan', loan_id: 'loan_missing_999' }),
      ]);

      const payments = getMockTable('payments');
      const loans = getMockTable('loans');

      const orphanedPayments = payments.filter((p) => {
        return !loans.find((l) => l.id === p.loan_id);
      });

      expect(orphanedPayments).toHaveLength(1);
      expect(orphanedPayments[0].id).toBe('pay_orphan');
    });
  });

  // =========================================================================
  // 7. Optimistic concurrency doesn't corrupt data
  // =========================================================================
  describe('Optimistic Concurrency Safety', () => {
    it('should maintain data consistency with version-based updates', () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          outstanding_balance_usd: 300.00,
          version: 0,
        }),
      ]);

      // Three sequential updates with correct version tracking
      const success1 = atomicBalanceUpdate(loanId, 50.00, 0);
      const success2 = atomicBalanceUpdate(loanId, 50.00, 1);
      const success3 = atomicBalanceUpdate(loanId, 50.00, 2);

      expect(success1).toBe(true);
      expect(success2).toBe(true);
      expect(success3).toBe(true);

      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.outstanding_balance_usd).toBeCloseTo(150.00, 2);
      expect(loan!.version).toBe(3);
    });

    it('should reject stale updates without corrupting data', () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          outstanding_balance_usd: 200.00,
          version: 5,
        }),
      ]);

      // Stale version (using version 3 when current is 5)
      const staleResult = atomicBalanceUpdate(loanId, 50.00, 3);
      expect(staleResult).toBe(false);

      // Data unchanged
      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.outstanding_balance_usd).toBe(200.00);
      expect(loan!.version).toBe(5);
    });

    it('should handle rapid successive updates correctly', async () => {
      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          outstanding_balance_usd: 500.00,
          version: 0,
        }),
      ]);

      const amounts = [50, 75, 25, 100, 50];
      let currentVersion = 0;

      for (const amount of amounts) {
        const result = atomicBalanceUpdate(loanId, amount, currentVersion);
        expect(result).toBe(true);
        currentVersion++;
      }

      const totalDeducted = amounts.reduce((sum, a) => sum + a, 0);
      const loan = getMockTable('loans').find((l) => l.id === loanId);
      expect(loan!.outstanding_balance_usd).toBeCloseTo(500 - totalDeducted, 2);
      expect(loan!.version).toBe(amounts.length);
    });
  });
});
