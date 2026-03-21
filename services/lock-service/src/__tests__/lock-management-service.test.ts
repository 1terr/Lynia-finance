/**
 * Unit tests for services/lock-service/src/lock-management-service.ts
 *
 * Tests automated lock processing, grace periods, device lock/unlock,
 * payment-triggered unlocks, and Trustonic API error handling.
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

jest.mock('../trustonic-provider', () => ({
  TrustonicProvider: jest.fn().mockImplementation(() => ({
    lockDevice: jest.fn().mockResolvedValue(undefined),
    unlockDevice: jest.fn().mockResolvedValue(undefined),
    enrollDevice: jest.fn().mockResolvedValue({ trustonic_device_id: 'trustonic_dev-001' }),
    getLockStatus: jest.fn().mockResolvedValue({ lock_status: 'unlocked', can_emergency_call: true }),
    generateLockMessage: jest.fn().mockReturnValue('Payment overdue. Contact Lynia Finance.'),
    getEmergencyNumbers: jest.fn().mockReturnValue(['999', '994', '993', '112']),
  })),
}));

jest.mock('../../../shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    setContext: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
}));

// ── Imports ──────────────────────────────────────────────────────────────

import { LockManagementService } from '../lock-management-service';

const { db, __mockExecute } = require('../../../shared/clients/database');

// ── Test Suite ───────────────────────────────────────────────────────────

describe('LockManagementService', () => {
  let service: LockManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
    service = new LockManagementService();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // lockDevice
  // ═══════════════════════════════════════════════════════════════════════

  describe('lockDevice', () => {
    it('should throw when device is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      __mockExecute.mockResolvedValue({ data: null, error: null });

      await expect(service.lockDevice('dev-missing', 'overdue')).rejects.toThrow('Device not found');
    });

    it('should return early when device is already locked (no re-lock)', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
        error: null,
      });

      await service.lockDevice('dev-001', 'overdue');

      // Only the initial select — no update or history insert
      expect(db.from).toHaveBeenCalledTimes(1);
    });

    it('should throw when device is not enrolled with Trustonic', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: null },
        error: null,
      });
      __mockExecute.mockResolvedValue({ data: null, error: null });

      await expect(service.lockDevice('dev-001', 'overdue')).rejects.toThrow(
        'Device not enrolled with Trustonic'
      );
    });

    it('should lock device successfully and record history', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789012345' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update device
        .mockResolvedValueOnce({ data: null, error: null }); // insert history

      await service.lockDevice('dev-001', 'Payment overdue', 'admin', 'admin-001');

      expect(db.from).toHaveBeenCalledWith('devices');
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });

    it('should record failed lock event when Trustonic API fails', async () => {
      const { TrustonicProvider } = require('../trustonic-provider');
      // Create fresh service to get latest mock
      const freshService = new LockManagementService();
      const mockInstance = TrustonicProvider.mock.results[TrustonicProvider.mock.results.length - 1]?.value;

      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789012345' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      if (mockInstance) {
        mockInstance.lockDevice.mockRejectedValueOnce(new Error('Trustonic API timeout'));
      }

      await expect(freshService.lockDevice('dev-001', 'overdue')).rejects.toThrow();

      // Failed lock history recorded
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // unlockDevice
  // ═══════════════════════════════════════════════════════════════════════

  describe('unlockDevice', () => {
    it('should throw when device is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      __mockExecute.mockResolvedValue({ data: null, error: null });

      await expect(service.unlockDevice('dev-missing', 'paid')).rejects.toThrow('Device not found');
    });

    it('should return early when device is already unlocked', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001' },
        error: null,
      });

      await service.unlockDevice('dev-001', 'paid');

      expect(db.from).toHaveBeenCalledTimes(1);
    });

    it('should unlock device and record history on full repayment', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update device
        .mockResolvedValueOnce({ data: null, error: null }); // insert history

      await service.unlockDevice('dev-001', 'Loan repaid', 'customer_payment');

      expect(db.from).toHaveBeenCalledWith('devices');
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });

    it('should record failed unlock event when Trustonic API fails', async () => {
      const { TrustonicProvider } = require('../trustonic-provider');
      const freshService = new LockManagementService();
      const mockInstance = TrustonicProvider.mock.results[TrustonicProvider.mock.results.length - 1]?.value;

      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });

      if (mockInstance) {
        mockInstance.unlockDevice.mockRejectedValueOnce(new Error('Trustonic API error'));
      }

      await expect(freshService.unlockDevice('dev-001', 'reason')).rejects.toThrow();
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // processAutomatedLocks
  // ═══════════════════════════════════════════════════════════════════════

  describe('processAutomatedLocks', () => {
    it('should return zeros when no overdue loans exist', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })  // overdue loans
        .mockResolvedValueOnce({ data: [], error: null }); // scheduled locks

      const result = await service.processAutomatedLocks();

      expect(result).toEqual({ checked: 0, triggered: 0, locked: 0, cancelled: 0, failed: 0 });
    });

    it('should find loans 7+ days overdue (query uses neq product_category digital)', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await service.processAutomatedLocks();

      // Verify the query chain was built correctly
      const chain = db.from.mock.results[0].value;
      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
      expect(chain.neq).toHaveBeenCalledWith('product_category', 'digital');
      expect(chain.not).toHaveBeenCalledWith('device_id', 'is', null);
    });

    it('should skip digital loans (no device to lock)', async () => {
      // The query itself filters digital loans via neq('product_category', 'digital')
      // Also, loans with no device_id are skipped in the loop
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'loan-001', customer_id: 'cust-001', device_id: null }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await service.processAutomatedLocks();

      // Loan counted as checked but no trigger created (device_id is null)
      expect(result.checked).toBe(1);
      expect(result.triggered).toBe(0);
    });

    it('should create lock trigger with 3-day grace period for new overdue loan', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'loan-002', customer_id: 'cust-002', device_id: 'dev-002' }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // no existing trigger
        .mockResolvedValueOnce({ data: null, error: null }) // insert trigger
        .mockResolvedValueOnce({ data: [], error: null });  // scheduled locks

      const result = await service.processAutomatedLocks();

      expect(result.checked).toBe(1);
      expect(result.triggered).toBe(1);
      expect(db.from).toHaveBeenCalledWith('device_lock_triggers');
    });

    it('should skip overdue loan that already has a trigger', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'loan-003', customer_id: 'cust-003', device_id: 'dev-003' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: { trigger_id: 'trig-existing', status: 'pending' },
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await service.processAutomatedLocks();

      expect(result.checked).toBe(1);
      expect(result.triggered).toBe(0);
    });

    it('should execute lock after grace period expires (no payment)', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null }) // overdue loans
        .mockResolvedValueOnce({
          data: [{
            trigger_id: 'trig-001', loan_id: 'loan-001', device_id: 'dev-001',
            trigger_type: 'missed_payment',
            triggered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null })  // no payment during grace
        // lockDevice sub-calls:
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '111' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // update device
        .mockResolvedValueOnce({ data: null, error: null }) // insert lock history
        .mockResolvedValueOnce({ data: null, error: null }); // update trigger to executed

      const result = await service.processAutomatedLocks();

      expect(result.locked).toBe(1);
    });

    it('should cancel lock if payment received during grace period', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({
          data: [{
            trigger_id: 'trig-002', loan_id: 'loan-002', device_id: 'dev-002',
            triggered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'pay-001', status: 'completed' }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // update trigger to cancelled

      const result = await service.processAutomatedLocks();

      expect(result.cancelled).toBe(1);
    });

    it('should mark trigger as failed when lock execution fails', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({
          data: [{
            trigger_id: 'trig-003', loan_id: 'loan-003', device_id: 'dev-003',
            trigger_type: 'missed_payment',
            triggered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null })    // no payment
        .mockResolvedValueOnce({ data: null, error: { message: 'not found' } }) // device not found
        .mockResolvedValueOnce({ data: null, error: null })  // failed lock history
        .mockResolvedValueOnce({ data: null, error: null }); // update trigger failed

      const result = await service.processAutomatedLocks();

      expect(result.failed).toBe(1);
    });

    it('should handle DB error on overdue loans query gracefully', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: new Error('DB error') })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await service.processAutomatedLocks();

      expect(result.checked).toBe(0);
      expect(result.triggered).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // handlePaymentReceived
  // ═══════════════════════════════════════════════════════════════════════

  describe('handlePaymentReceived', () => {
    it('should return early when payment is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await service.handlePaymentReceived('pay-missing');
      expect(db.from).toHaveBeenCalledWith('payments');
    });

    it('should return early when device is not locked', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'pay-001', loan_id: 'loan-001',
          loans: { devices: { lock_status: 'unlocked' }, device_id: 'dev-001' },
        },
        error: null,
      });

      await service.handlePaymentReceived('pay-001');
      expect(db.from).toHaveBeenCalledTimes(1);
    });

    it('should unlock device when outstanding balance is zero', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-001', loan_id: 'loan-001',
            loans: { devices: { lock_status: 'locked' }, device_id: 'dev-001' },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { outstanding_balance: 0, status: 'paid_off' },
          error: null,
        })
        // unlockDevice sub-calls
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await service.handlePaymentReceived('pay-001');

      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });

    it('should not unlock when loan still has outstanding balance', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-002', loan_id: 'loan-002',
            loans: { devices: { lock_status: 'locked' }, device_id: 'dev-002' },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { outstanding_balance: 500, status: 'active' },
          error: null,
        });

      await service.handlePaymentReceived('pay-002');

      // Only 2 from() calls (payments + loans), no unlock
      expect(db.from).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Message Generation
  // ═══════════════════════════════════════════════════════════════════════

  describe('generateLockWarningMessage', () => {
    it('should include days until lock and amount', () => {
      const msg = service.generateLockWarningMessage(3, 150.5);
      expect(msg).toContain('3 days');
      expect(msg).toContain('$150.50');
      expect(msg).toContain('Payment Overdue');
    });

    it('should mention emergency calls remain available', () => {
      const msg = service.generateLockWarningMessage(1, 50);
      expect(msg).toContain('Emergency calls');
    });
  });

  describe('generateLockNotificationMessage', () => {
    it('should include amount and locked status', () => {
      const msg = service.generateLockNotificationMessage(250.99);
      expect(msg).toContain('$250.99');
      expect(msg).toContain('Device Locked');
    });
  });

  describe('generateUnlockNotificationMessage', () => {
    it('should include payment amount and thank you', () => {
      const msg = service.generateUnlockNotificationMessage(300);
      expect(msg).toContain('$300.00');
      expect(msg).toContain('Device Unlocked');
      expect(msg).toContain('Thank you');
    });
  });
});
