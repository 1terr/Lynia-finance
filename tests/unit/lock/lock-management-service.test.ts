/**
 * Characterization tests for services/lock-service/src/lock-management-service.ts
 *
 * Core lock/unlock orchestration -- validates device state, calls Trustonic,
 * updates DB, records history. Also handles automated lock scheduling and
 * payment-triggered unlocks.
 */

// Mock all external dependencies before importing
jest.mock('../../../services/shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or', 'order', 'limit', 'single', 'maybeSingle'];
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

jest.mock('../../../services/lock-service/src/trustonic-provider', () => ({
  TrustonicProvider: jest.fn().mockImplementation(() => ({
    lockDevice: jest.fn().mockResolvedValue(undefined),
    unlockDevice: jest.fn().mockResolvedValue(undefined),
    enrollDevice: jest.fn().mockResolvedValue({ trustonic_device_id: 'trustonic_dev-001' }),
    getLockStatus: jest.fn().mockResolvedValue({ lock_status: 'unlocked', can_emergency_call: true }),
    generateLockMessage: jest.fn().mockReturnValue('Payment overdue. Contact Lynia Finance.'),
    getEmergencyNumbers: jest.fn().mockReturnValue(['999', '994', '993', '112']),
  })),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn(), startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }) },
}));

import { LockManagementService } from '../../../services/lock-service/src/lock-management-service';
const { db, __mockExecute } = require('../../../services/shared/clients/database');

describe('LockManagementService', () => {
  let service: LockManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
    service = new LockManagementService();
  });

  // ─── lockDevice ────────────────────────────────────────────
  describe('lockDevice', () => {
    it('should throw when device is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      // second call is the failed lock history insert
      __mockExecute.mockResolvedValue({ data: null, error: null });

      await expect(service.lockDevice('dev-missing', 'overdue')).rejects.toThrow('Device not found');
    });

    it('should return early when device is already locked', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
        error: null,
      });

      await service.lockDevice('dev-001', 'overdue');

      // Should not call update or insert after early return
      expect(db.from).toHaveBeenCalledTimes(1); // only the initial select
    });

    it('should throw when device is not enrolled with Trustonic', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: null },
        error: null,
      });
      // failed lock history insert
      __mockExecute.mockResolvedValue({ data: null, error: null });

      await expect(service.lockDevice('dev-001', 'overdue')).rejects.toThrow('Device not enrolled with Trustonic');
    });

    it('should lock device successfully via Trustonic', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789012345' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update device status
        .mockResolvedValueOnce({ data: null, error: null }); // insert lock history

      await service.lockDevice('dev-001', 'Payment overdue', 'admin', 'admin-001');

      // Verify device status update
      expect(db.from).toHaveBeenCalledWith('devices');
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });

    it('should record failed lock event when Trustonic call fails', async () => {
      const { TrustonicProvider } = require('../../../services/lock-service/src/trustonic-provider');
      const mockInstance = TrustonicProvider.mock.results[TrustonicProvider.mock.results.length - 1]?.value;

      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789012345' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null }); // failed history insert

      // Make Trustonic lock fail
      if (mockInstance) {
        mockInstance.lockDevice.mockRejectedValueOnce(new Error('Trustonic API error'));
      }

      await expect(service.lockDevice('dev-001', 'overdue')).rejects.toThrow();

      // Verify failed lock history was recorded
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });

    it('should pass admin_user_id when performed by admin', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789012345' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update
        .mockResolvedValueOnce({ data: null, error: null }); // insert history

      await service.lockDevice('dev-001', 'Manual lock', 'admin', 'admin-user-123');

      // Verify the lock history includes admin_user_id
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });
  });

  // ─── unlockDevice ──────────────────────────────────────────
  describe('unlockDevice', () => {
    it('should throw when device is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      __mockExecute.mockResolvedValue({ data: null, error: null });

      await expect(service.unlockDevice('dev-missing', 'payment cleared')).rejects.toThrow('Device not found');
    });

    it('should return early when device is already unlocked', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001' },
        error: null,
      });

      await service.unlockDevice('dev-001', 'payment cleared');

      // Only the initial select
      expect(db.from).toHaveBeenCalledTimes(1);
    });

    it('should throw when device is not enrolled with Trustonic', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: null },
        error: null,
      });
      __mockExecute.mockResolvedValue({ data: null, error: null });

      await expect(service.unlockDevice('dev-001', 'payment cleared')).rejects.toThrow('Device not enrolled with Trustonic');
    });

    it('should unlock device successfully via Trustonic', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })  // update device status
        .mockResolvedValueOnce({ data: null, error: null }); // insert unlock history

      await service.unlockDevice('dev-001', 'Loan repaid', 'customer_payment');

      expect(db.from).toHaveBeenCalledWith('devices');
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });

    it('should record failed unlock event when Trustonic call fails', async () => {
      const { TrustonicProvider } = require('../../../services/lock-service/src/trustonic-provider');
      // Create a new service to get the latest mock instance
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

      await expect(freshService.unlockDevice('dev-001', 'unlock reason')).rejects.toThrow();
      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });
  });

  // ─── getLockStatus ─────────────────────────────────────────
  describe('getLockStatus', () => {
    it('should throw when device is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      await expect(service.getLockStatus('dev-missing')).rejects.toThrow('Device not found');
    });

    it('should return correct lock status for locked device', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'dev-001',
          lock_status: 'locked',
          locked_at: '2024-01-15T10:00:00Z',
          unlocked_at: null,
          lock_reason: 'missed_payment',
        },
        error: null,
      });

      const status = await service.getLockStatus('dev-001');

      expect(status.device_id).toBe('dev-001');
      expect(status.lock_status).toBe('locked');
      expect(status.locked_at).toBeInstanceOf(Date);
      expect(status.lock_reason).toBe('missed_payment');
    });

    it('should return correct lock status for unlocked device', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'dev-002',
          lock_status: 'unlocked',
          locked_at: null,
          unlocked_at: '2024-02-01T12:00:00Z',
          lock_reason: null,
        },
        error: null,
      });

      const status = await service.getLockStatus('dev-002');

      expect(status.device_id).toBe('dev-002');
      expect(status.lock_status).toBe('unlocked');
      expect(status.unlocked_at).toBeInstanceOf(Date);
      expect(status.lock_reason).toBeNull();
    });

    it('should handle device with no lock/unlock timestamps', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'dev-003',
          lock_status: 'unlocked',
          locked_at: null,
          unlocked_at: null,
          lock_reason: null,
        },
        error: null,
      });

      const status = await service.getLockStatus('dev-003');

      expect(status.locked_at).toBeUndefined();
      expect(status.unlocked_at).toBeUndefined();
    });
  });

  // ─── processAutomatedLocks ─────────────────────────────────
  describe('processAutomatedLocks', () => {
    it('should return zeros when no overdue loans exist', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })   // overdue loans query
        .mockResolvedValueOnce({ data: [], error: null });   // scheduled locks query

      const result = await service.processAutomatedLocks();

      expect(result.checked).toBe(0);
      expect(result.triggered).toBe(0);
      expect(result.locked).toBe(0);
      expect(result.cancelled).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should skip overdue loans that already have a trigger', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'loan-001', customer_id: 'cust-001', device_id: 'dev-001' }],
          error: null,
        }) // overdue loans
        .mockResolvedValueOnce({
          data: { trigger_id: 'trig-001', status: 'pending' },
          error: null,
        }) // existing trigger found
        .mockResolvedValueOnce({ data: [], error: null }); // scheduled locks

      const result = await service.processAutomatedLocks();

      expect(result.checked).toBe(1);
      expect(result.triggered).toBe(0);
    });

    it('should create a new trigger for overdue loan without existing trigger', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'loan-002', customer_id: 'cust-002', device_id: 'dev-002' }],
          error: null,
        }) // overdue loans
        .mockResolvedValueOnce({ data: null, error: null }) // no existing trigger
        .mockResolvedValueOnce({ data: null, error: null }) // insert trigger
        .mockResolvedValueOnce({ data: [], error: null });  // scheduled locks

      const result = await service.processAutomatedLocks();

      expect(result.checked).toBe(1);
      expect(result.triggered).toBe(1);
      expect(db.from).toHaveBeenCalledWith('device_lock_triggers');
    });

    it('should cancel lock when payment received during grace period', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null }) // overdue loans (empty)
        .mockResolvedValueOnce({
          data: [{
            trigger_id: 'trig-001',
            loan_id: 'loan-001',
            device_id: 'dev-001',
            triggered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          }],
          error: null,
        }) // scheduled locks
        .mockResolvedValueOnce({
          data: [{ id: 'pay-001', status: 'completed' }],
          error: null,
        }) // payment found during grace period
        .mockResolvedValueOnce({ data: null, error: null }); // update trigger to cancelled

      const result = await service.processAutomatedLocks();

      expect(result.cancelled).toBe(1);
    });

    it('should execute lock when grace period expired and no payment', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null }) // overdue loans (empty)
        .mockResolvedValueOnce({
          data: [{
            trigger_id: 'trig-002',
            loan_id: 'loan-002',
            device_id: 'dev-002',
            trigger_type: 'missed_payment',
            triggered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          }],
          error: null,
        }) // scheduled locks
        .mockResolvedValueOnce({ data: [], error: null }) // no payment during grace period
        // lockDevice sub-calls:
        .mockResolvedValueOnce({
          data: { id: 'dev-002', lock_status: 'unlocked', trustonic_device_id: 'tdev-002', imei: '111111111111111' },
          error: null,
        }) // device select
        .mockResolvedValueOnce({ data: null, error: null }) // update device status
        .mockResolvedValueOnce({ data: null, error: null }) // insert lock history
        .mockResolvedValueOnce({ data: null, error: null }); // update trigger status to executed

      const result = await service.processAutomatedLocks();

      expect(result.locked).toBe(1);
    });

    it('should handle lock failure and mark trigger as failed', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null }) // overdue loans
        .mockResolvedValueOnce({
          data: [{
            trigger_id: 'trig-003',
            loan_id: 'loan-003',
            device_id: 'dev-003',
            trigger_type: 'missed_payment',
            triggered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          }],
          error: null,
        }) // scheduled locks
        .mockResolvedValueOnce({ data: [], error: null }) // no payment during grace
        // lockDevice sub-calls: device not found -> throws
        .mockResolvedValueOnce({ data: null, error: { message: 'not found' } }) // device select fails
        .mockResolvedValueOnce({ data: null, error: null }) // failed lock history insert
        .mockResolvedValueOnce({ data: null, error: null }); // mark trigger as failed

      const result = await service.processAutomatedLocks();

      expect(result.failed).toBe(1);
    });

    it('should handle error fetching overdue loans gracefully', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: new Error('DB error') }) // overdue loans error
        .mockResolvedValueOnce({ data: [], error: null }); // scheduled locks

      const result = await service.processAutomatedLocks();

      expect(result.checked).toBe(0);
      expect(result.triggered).toBe(0);
    });
  });

  // ─── handlePaymentReceived ─────────────────────────────────
  describe('handlePaymentReceived', () => {
    it('should return early when payment is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      // Should not throw, just return
      await service.handlePaymentReceived('pay-missing');
      expect(db.from).toHaveBeenCalledWith('payments');
    });

    it('should return early when device is not locked', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'pay-001',
          loan_id: 'loan-001',
          loans: {
            devices: { lock_status: 'unlocked' },
            device_id: 'dev-001',
          },
        },
        error: null,
      });

      await service.handlePaymentReceived('pay-001');

      // Should only query payments table, not loans
      expect(db.from).toHaveBeenCalledTimes(1);
    });

    it('should not unlock when loan still has outstanding balance', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-001',
            loan_id: 'loan-001',
            loans: {
              devices: { lock_status: 'locked' },
              device_id: 'dev-001',
            },
          },
          error: null,
        }) // payment
        .mockResolvedValueOnce({
          data: { outstanding_balance: 500, status: 'active' },
          error: null,
        }); // loan

      await service.handlePaymentReceived('pay-001');

      // Should not trigger unlockDevice, so only 2 from calls (payments + loans)
      expect(db.from).toHaveBeenCalledTimes(2);
    });

    it('should unlock device when outstanding balance is zero', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-002',
            loan_id: 'loan-002',
            loans: {
              devices: { lock_status: 'locked' },
              device_id: 'dev-002',
            },
          },
          error: null,
        }) // payment
        .mockResolvedValueOnce({
          data: { outstanding_balance: 0, status: 'paid_off' },
          error: null,
        }) // loan balance check
        // unlockDevice sub-calls:
        .mockResolvedValueOnce({
          data: { id: 'dev-002', lock_status: 'locked', trustonic_device_id: 'tdev-002' },
          error: null,
        }) // device select
        .mockResolvedValueOnce({ data: null, error: null })  // update device
        .mockResolvedValueOnce({ data: null, error: null }); // insert history

      await service.handlePaymentReceived('pay-002');

      expect(db.from).toHaveBeenCalledWith('device_lock_history');
    });

    it('should handle loan not found gracefully', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'pay-003',
            loan_id: 'loan-003',
            loans: {
              devices: { lock_status: 'locked' },
              device_id: 'dev-003',
            },
          },
          error: null,
        }) // payment
        .mockResolvedValueOnce({
          data: null,
          error: null,
        }); // loan not found

      // Should not throw
      await service.handlePaymentReceived('pay-003');
    });
  });

  // ─── generateLockWarningMessage ────────────────────────────
  describe('generateLockWarningMessage', () => {
    it('should include days until lock and amount due', () => {
      const msg = service.generateLockWarningMessage(3, 150.5);

      expect(msg).toContain('3 days');
      expect(msg).toContain('$150.50');
      expect(msg).toContain('Payment Overdue');
    });

    it('should include emergency call notice', () => {
      const msg = service.generateLockWarningMessage(1, 50);

      expect(msg).toContain('Emergency calls');
    });

    it('should format amounts with two decimal places', () => {
      const msg = service.generateLockWarningMessage(2, 100);

      expect(msg).toContain('$100.00');
    });
  });

  // ─── generateLockNotificationMessage ───────────────────────
  describe('generateLockNotificationMessage', () => {
    it('should include amount due', () => {
      const msg = service.generateLockNotificationMessage(250.99);

      expect(msg).toContain('$250.99');
      expect(msg).toContain('Device Locked');
    });

    it('should mention emergency calls are still available', () => {
      const msg = service.generateLockNotificationMessage(100);

      expect(msg).toContain('Emergency calls');
    });

    it('should include pay now call to action', () => {
      const msg = service.generateLockNotificationMessage(75);

      expect(msg).toContain('Pay Now');
    });
  });

  // ─── generateUnlockNotificationMessage ─────────────────────
  describe('generateUnlockNotificationMessage', () => {
    it('should include payment amount', () => {
      const msg = service.generateUnlockNotificationMessage(300);

      expect(msg).toContain('$300.00');
      expect(msg).toContain('Device Unlocked');
    });

    it('should include gratitude message', () => {
      const msg = service.generateUnlockNotificationMessage(100);

      expect(msg).toContain('Thank you');
    });

    it('should include view receipt option', () => {
      const msg = service.generateUnlockNotificationMessage(50);

      expect(msg).toContain('View Receipt');
    });
  });
});
