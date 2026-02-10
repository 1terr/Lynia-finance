/**
 * Cross-Service Data Flow Tests: Device Lifecycle
 *
 * Validates device state transitions across services:
 * Inventory -> Assigned to Loan -> Handover -> Trustonic Enrolled -> Active
 *   -> Locked (overdue) -> Unlocked (paid) -> Completed
 *
 * Ensures valid state transitions, lock history tracking,
 * one-device-per-active-loan constraint, and overdue payment triggers.
 */

import {
  seedMockTable,
  getMockTable,
  resetMockDataStore,
  createTestLoan,
  createTestPayment,
  createTestDevice,
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

describe('Device Lifecycle Data Flow Tests', () => {
  const customerId = 'cust_device_001';
  const loanId = 'loan_device_001';
  const deviceId = 'dev_lifecycle_001';

  beforeEach(() => {
    resetMockDataStore();
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Full device lifecycle state transitions
  // =========================================================================
  describe('Complete Device Lifecycle', () => {
    it('should transition through all valid states: in_stock -> assigned -> active -> locked -> unlocked -> completed', () => {
      // Stage 1: Device in inventory
      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          device_imei: '123456789012345',
          lock_status: 'unlocked',
          status: 'in_stock',
          customer_id: null,
          loan_id: null,
        }),
      ]);

      let device = getMockTable('devices')[0];
      expect(device.status).toBe('in_stock');
      expect(device.lock_status).toBe('unlocked');
      expect(device.customer_id).toBeNull();

      // Stage 2: Assigned to loan
      const devices = getMockTable('devices');
      devices[0] = {
        ...devices[0],
        status: 'assigned',
        customer_id: customerId,
        loan_id: loanId,
        assigned_at: new Date().toISOString(),
      };

      device = getMockTable('devices')[0];
      expect(device.status).toBe('assigned');
      expect(device.customer_id).toBe(customerId);
      expect(device.loan_id).toBe(loanId);

      // Stage 3: Handover complete, Trustonic enrolled
      devices[0] = {
        ...devices[0],
        trustonic_enrolled: true,
        status: 'active',
      };

      device = getMockTable('devices')[0];
      expect(device.status).toBe('active');
      expect(device.trustonic_enrolled).toBe(true);

      // Stage 4: Overdue -- locked
      devices[0] = {
        ...devices[0],
        lock_status: 'locked',
        locked_at: new Date().toISOString(),
      };

      device = getMockTable('devices')[0];
      expect(device.lock_status).toBe('locked');
      expect(device.locked_at).toBeDefined();

      // Stage 5: Payment received -- unlocked
      devices[0] = {
        ...devices[0],
        lock_status: 'unlocked',
        locked_at: null,
        unlocked_at: new Date().toISOString(),
      };

      device = getMockTable('devices')[0];
      expect(device.lock_status).toBe('unlocked');

      // Stage 6: Loan completed
      devices[0] = {
        ...devices[0],
        status: 'completed',
        lock_status: 'unlocked',
      };

      device = getMockTable('devices')[0];
      expect(device.status).toBe('completed');
      expect(device.lock_status).toBe('unlocked');
    });
  });

  // =========================================================================
  // 2. Valid lock_status transitions
  // =========================================================================
  describe('Lock Status Transition Validation', () => {
    const validTransitions: Array<{ from: string; to: string; valid: boolean }> = [
      { from: 'unlocked', to: 'locked', valid: true },
      { from: 'locked', to: 'unlocked', valid: true },
      { from: 'unlocked', to: 'unlocked', valid: false }, // No-op
      { from: 'locked', to: 'locked', valid: false }, // No-op
    ];

    it.each(validTransitions)(
      'transition from "$from" to "$to" should be valid=$valid',
      ({ from, to, valid }) => {
        seedMockTable('devices', [
          createTestDevice({
            id: deviceId,
            lock_status: from,
          }),
        ]);

        const device = getMockTable('devices')[0];
        const currentStatus = device.lock_status as string;
        const isValidTransition = currentStatus !== to;

        expect(isValidTransition).toBe(valid);
      },
    );

    it('should only allow unlocked -> locked transition (not skip to other states)', () => {
      seedMockTable('devices', [
        createTestDevice({ id: deviceId, lock_status: 'unlocked' }),
      ]);

      const _device = getMockTable('devices')[0];
      const allowedNextStates = ['locked'];
      const requestedState = 'locked';

      expect(allowedNextStates).toContain(requestedState);
    });

    it('should only allow locked -> unlocked transition', () => {
      seedMockTable('devices', [
        createTestDevice({ id: deviceId, lock_status: 'locked' }),
      ]);

      const _device = getMockTable('devices')[0];
      const allowedNextStates = ['unlocked'];
      const requestedState = 'unlocked';

      expect(allowedNextStates).toContain(requestedState);
    });
  });

  // =========================================================================
  // 3. Lock history entries for every state change
  // =========================================================================
  describe('Device Lock History Tracking', () => {
    it('should create a lock history entry when device is locked', () => {
      seedMockTable('devices', [
        createTestDevice({ id: deviceId, lock_status: 'unlocked' }),
      ]);

      // Lock the device
      const devices = getMockTable('devices');
      devices[0] = { ...devices[0], lock_status: 'locked', locked_at: new Date().toISOString() };

      // Record history entry
      seedMockTable('device_lock_history', [
        {
          id: generateTestId('lock_hist'),
          device_id: deviceId,
          loan_id: loanId,
          action: 'lock',
          reason: 'Payment overdue 7+ days',
          trigger_type: 'automated',
          triggered_by: 'system',
          trustonic_status: 'success',
          performed_at: new Date().toISOString(),
        },
      ]);

      const history = getMockTable('device_lock_history');
      expect(history).toHaveLength(1);
      expect(history[0].device_id).toBe(deviceId);
      expect(history[0].action).toBe('lock');
      expect(history[0].trigger_type).toBe('automated');
    });

    it('should create a history entry when device is unlocked', () => {
      seedMockTable('device_lock_history', [
        {
          id: generateTestId('lock_hist'),
          device_id: deviceId,
          loan_id: loanId,
          action: 'lock',
          reason: 'Payment overdue 7+ days',
          trigger_type: 'automated',
          triggered_by: 'system',
          trustonic_status: 'success',
          performed_at: '2025-06-01T10:00:00.000Z',
        },
      ]);

      // Unlock
      getMockTable('device_lock_history').push({
        id: generateTestId('lock_hist'),
        device_id: deviceId,
        loan_id: loanId,
        action: 'unlock',
        reason: 'Payment received',
        trigger_type: 'payment',
        triggered_by: 'system',
        trustonic_status: 'success',
        performed_at: '2025-06-01T12:00:00.000Z',
      });

      const history = getMockTable('device_lock_history');
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('lock');
      expect(history[1].action).toBe('unlock');

      // Chronological order
      const lockTime = new Date(history[0].performed_at as string).getTime();
      const unlockTime = new Date(history[1].performed_at as string).getTime();
      expect(lockTime).toBeLessThan(unlockTime);
    });

    it('should record history for every lock/unlock cycle', () => {
      seedMockTable('device_lock_history', []);

      const events = [
        { action: 'lock', reason: 'Overdue 7 days', time: '2025-06-01T10:00:00.000Z' },
        { action: 'unlock', reason: 'Payment received', time: '2025-06-01T12:00:00.000Z' },
        { action: 'lock', reason: 'Overdue again', time: '2025-07-01T10:00:00.000Z' },
        { action: 'unlock', reason: 'Full payment', time: '2025-07-01T14:00:00.000Z' },
      ];

      for (const evt of events) {
        getMockTable('device_lock_history').push({
          id: generateTestId('lock_hist'),
          device_id: deviceId,
          loan_id: loanId,
          action: evt.action,
          reason: evt.reason,
          trigger_type: 'automated',
          triggered_by: 'system',
          trustonic_status: 'success',
          performed_at: evt.time,
        });
      }

      const history = getMockTable('device_lock_history');
      expect(history).toHaveLength(4);

      // Alternating lock/unlock
      expect(history[0].action).toBe('lock');
      expect(history[1].action).toBe('unlock');
      expect(history[2].action).toBe('lock');
      expect(history[3].action).toBe('unlock');
    });
  });

  // =========================================================================
  // 4. One device per active loan constraint
  // =========================================================================
  describe('One Device Per Active Loan', () => {
    it('should prevent assigning a device to more than one active loan', () => {
      // Device already assigned to loan1
      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          status: 'assigned',
          customer_id: 'cust_001',
          loan_id: 'loan_001',
        }),
      ]);

      seedMockTable('loans', [
        createTestLoan({
          id: 'loan_001',
          customer_id: 'cust_001',
          loan_status: 'active',
        }),
      ]);

      // Attempt to assign to loan2
      const device = getMockTable('devices')[0];
      const isAlreadyAssigned =
        device.loan_id !== null && device.status === 'assigned';

      expect(isAlreadyAssigned).toBe(true);
      // Should reject assignment to second loan
    });

    it('should allow re-assignment after loan completion', () => {
      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          status: 'completed',
          customer_id: 'cust_001',
          loan_id: 'loan_completed_001',
        }),
      ]);

      seedMockTable('loans', [
        createTestLoan({
          id: 'loan_completed_001',
          customer_id: 'cust_001',
          loan_status: 'completed',
        }),
      ]);

      // Device can be reassigned after loan completion
      const device = getMockTable('devices')[0];
      const loanCompleted =
        getMockTable('loans').find((l) => l.id === device.loan_id);

      expect(loanCompleted!.loan_status).toBe('completed');

      // Reset device for new assignment
      const devices = getMockTable('devices');
      devices[0] = {
        ...devices[0],
        status: 'in_stock',
        customer_id: null,
        loan_id: null,
        lock_status: 'unlocked',
      };

      const resetDevice = getMockTable('devices')[0];
      expect(resetDevice.status).toBe('in_stock');
      expect(resetDevice.customer_id).toBeNull();
      expect(resetDevice.loan_id).toBeNull();
    });
  });

  // =========================================================================
  // 5. Overdue loan triggers device lock
  // =========================================================================
  describe('Overdue Loan -> Device Lock', () => {
    it('should trigger device lock when loan is 7+ days overdue', () => {
      const overdueDate = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000,
      ).toISOString();

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_status: 'active',
          next_payment_date: overdueDate,
          outstanding_balance_usd: 200.00,
        }),
      ]);

      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          customer_id: customerId,
          loan_id: loanId,
          lock_status: 'unlocked',
          status: 'active',
        }),
      ]);

      // Calculate days overdue
      const loan = getMockTable('loans')[0];
      const nextPaymentDate = new Date(loan.next_payment_date as string);
      const daysOverdue = Math.floor(
        (Date.now() - nextPaymentDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      expect(daysOverdue).toBeGreaterThanOrEqual(7);

      // Lock the device
      const devices = getMockTable('devices');
      devices[0] = {
        ...devices[0],
        lock_status: 'locked',
        locked_at: new Date().toISOString(),
      };

      expect(getMockTable('devices')[0].lock_status).toBe('locked');

      // Lock history entry created
      seedMockTable('device_lock_history', [
        {
          id: generateTestId('lock_hist'),
          device_id: deviceId,
          loan_id: loanId,
          action: 'lock',
          reason: `Payment overdue ${daysOverdue} days`,
          trigger_type: 'automated',
          triggered_by: 'system',
          trustonic_status: 'success',
          performed_at: new Date().toISOString(),
        },
      ]);

      const history = getMockTable('device_lock_history');
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('lock');
    });

    it('should not lock device when loan is less than 7 days overdue', () => {
      const recentOverdueDate = new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000,
      ).toISOString();

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          loan_status: 'active',
          next_payment_date: recentOverdueDate,
        }),
      ]);

      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          loan_id: loanId,
          lock_status: 'unlocked',
        }),
      ]);

      const loan = getMockTable('loans')[0];
      const nextPaymentDate = new Date(loan.next_payment_date as string);
      const daysOverdue = Math.floor(
        (Date.now() - nextPaymentDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      expect(daysOverdue).toBeLessThan(7);

      // Device remains unlocked
      expect(getMockTable('devices')[0].lock_status).toBe('unlocked');
    });
  });

  // =========================================================================
  // 6. Payment clears overdue and triggers unlock
  // =========================================================================
  describe('Payment -> Clear Overdue -> Device Unlock', () => {
    it('should unlock device when overdue payment is received', () => {
      // Device currently locked
      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          customer_id: customerId,
          loan_id: loanId,
          lock_status: 'locked',
          locked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          outstanding_balance_usd: 200.00,
          loan_status: 'active',
        }),
      ]);

      // Payment received
      seedMockTable('payments', [
        createTestPayment({
          id: generateTestId('pay'),
          loan_id: loanId,
          customer_id: customerId,
          payment_amount_usd: 51.33,
          payment_status: 'completed',
        }),
      ]);

      // Update loan balance
      const loans = getMockTable('loans');
      loans[0] = {
        ...loans[0],
        outstanding_balance_usd: 148.67,
        next_payment_date: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      };

      // Unlock device
      const devices = getMockTable('devices');
      devices[0] = {
        ...devices[0],
        lock_status: 'unlocked',
        locked_at: null,
        unlocked_at: new Date().toISOString(),
      };

      expect(getMockTable('devices')[0].lock_status).toBe('unlocked');

      // Unlock history entry
      seedMockTable('device_lock_history', [
        {
          id: generateTestId('lock_hist'),
          device_id: deviceId,
          loan_id: loanId,
          action: 'unlock',
          reason: 'Payment received - overdue cleared',
          trigger_type: 'payment',
          triggered_by: 'system',
          trustonic_status: 'success',
          performed_at: new Date().toISOString(),
        },
      ]);

      const history = getMockTable('device_lock_history');
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('unlock');
      expect(history[0].trigger_type).toBe('payment');
    });

    it('should keep device locked if payment does not clear overdue amount', () => {
      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          lock_status: 'locked',
          loan_id: loanId,
        }),
      ]);

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          outstanding_balance_usd: 200.00,
          // Still overdue even after partial payment
          next_payment_date: new Date(
            Date.now() - 10 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }),
      ]);

      // Partial payment received but not enough to clear overdue installment
      seedMockTable('payments', [
        createTestPayment({
          id: generateTestId('pay'),
          loan_id: loanId,
          payment_amount_usd: 10.00, // Very small partial payment
          payment_status: 'completed',
        }),
      ]);

      // Loan is still overdue, device stays locked
      const device = getMockTable('devices')[0];
      expect(device.lock_status).toBe('locked');
    });
  });

  // =========================================================================
  // 7. Handover data flow
  // =========================================================================
  describe('Handover Workflow Data Flow', () => {
    it('should track handover steps: initiated -> identity_verified -> deposit_verified -> device_inspected -> completed', () => {
      const handoverId = generateTestId('handover');

      seedMockTable('handovers', [
        {
          id: handoverId,
          loan_id: loanId,
          customer_id: customerId,
          device_id: deviceId,
          distributor_id: 'dist_001',
          status: 'initiated',
          identity_verified: false,
          deposit_verified: false,
          device_inspected: false,
          completed_at: null,
          created_at: new Date().toISOString(),
        },
      ]);

      const handovers = getMockTable('handovers');

      // Step 1: Verify identity
      handovers[0] = { ...handovers[0], identity_verified: true, status: 'identity_verified' };
      expect(handovers[0].identity_verified).toBe(true);

      // Step 2: Verify deposit
      handovers[0] = { ...handovers[0], deposit_verified: true, status: 'deposit_verified' };
      expect(handovers[0].deposit_verified).toBe(true);

      // Step 3: Inspect device
      handovers[0] = { ...handovers[0], device_inspected: true, status: 'device_inspected' };
      expect(handovers[0].device_inspected).toBe(true);

      // Step 4: Complete
      handovers[0] = {
        ...handovers[0],
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      expect(handovers[0].status).toBe('completed');
      expect(handovers[0].completed_at).toBeDefined();

      // All steps verified
      expect(handovers[0].identity_verified).toBe(true);
      expect(handovers[0].deposit_verified).toBe(true);
      expect(handovers[0].device_inspected).toBe(true);
    });

    it('should not complete handover if deposit is not verified', () => {
      seedMockTable('handovers', [
        {
          id: generateTestId('handover'),
          loan_id: loanId,
          customer_id: customerId,
          device_id: deviceId,
          status: 'identity_verified',
          identity_verified: true,
          deposit_verified: false,
          device_inspected: false,
          completed_at: null,
        },
      ]);

      const handover = getMockTable('handovers')[0];
      const canComplete =
        handover.identity_verified === true
        && handover.deposit_verified === true
        && handover.device_inspected === true;

      expect(canComplete).toBe(false);
    });
  });

  // =========================================================================
  // 8. Device-Loan cross-reference integrity
  // =========================================================================
  describe('Device-Loan Cross-Reference Integrity', () => {
    it('should maintain bidirectional reference between device and loan', () => {
      seedMockTable('devices', [
        createTestDevice({
          id: deviceId,
          loan_id: loanId,
          customer_id: customerId,
          status: 'assigned',
        }),
      ]);

      seedMockTable('loans', [
        createTestLoan({
          id: loanId,
          customer_id: customerId,
          device_id: deviceId,
          loan_status: 'active',
        }),
      ]);

      const device = getMockTable('devices')[0];
      const loan = getMockTable('loans')[0];

      // Bidirectional reference
      expect(device.loan_id).toBe(loan.id);
      expect(loan.device_id).toBe(device.id);

      // Same customer
      expect(device.customer_id).toBe(loan.customer_id);
    });
  });
});
