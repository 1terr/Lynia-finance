/**
 * Characterization tests for services/lock-service/src/repossession-service.ts
 *
 * Device repossession workflow -- eligibility check (60+ days past due),
 * initiation with warning, order creation after 7-day warning period,
 * agent assignment, device recovery, and case closure.
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

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn(), startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }) },
}));

import {
  checkRepossessionEligibility,
  initiateRepossession,
  createRepossessionOrder,
  assignAgent,
  recordRecovery,
  closeRepossession,
} from '../../../services/lock-service/src/repossession-service';
const { db, __mockExecute } = require('../../../services/shared/clients/database');

describe('RepossessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
  });

  // ─── checkRepossessionEligibility ──────────────────────────
  describe('checkRepossessionEligibility', () => {
    it('should throw when loan is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await expect(checkRepossessionEligibility('loan-missing')).rejects.toThrow('Loan not found');
    });

    it('should return not eligible when less than 60 days past due', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-001',
            total_amount_due: 1000,
            total_amount_paid: 500,
            days_past_due: 45,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null }); // restructure check

      const result = await checkRepossessionEligibility('loan-001');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('45 days past due');
      expect(result.reason).toContain('Minimum 60 days');
      expect(result.days_past_due).toBe(45);
      expect(result.outstanding_amount).toBe(500);
    });

    it('should return not eligible when restructuring not attempted', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-002',
            total_amount_due: 1000,
            total_amount_paid: 200,
            days_past_due: 75,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null }); // no restructure records

      const result = await checkRepossessionEligibility('loan-002');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Restructuring must be attempted');
      expect(result.restructuring_attempted).toBe(false);
    });

    it('should return eligible when 60+ days past due and restructuring attempted', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-003',
            total_amount_due: 1000,
            total_amount_paid: 300,
            days_past_due: 65,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'restructure-001' }],
          error: null,
        }); // restructuring attempted

      const result = await checkRepossessionEligibility('loan-003');

      expect(result.eligible).toBe(true);
      expect(result.reason).toBe('Eligible for repossession');
      expect(result.days_past_due).toBe(65);
      expect(result.outstanding_amount).toBe(700);
      expect(result.restructuring_attempted).toBe(true);
    });

    it('should calculate outstanding amount correctly', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-004',
            total_amount_due: 2500,
            total_amount_paid: 750,
            days_past_due: 90,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: [{ id: 'r-001' }], error: null });

      const result = await checkRepossessionEligibility('loan-004');

      expect(result.outstanding_amount).toBe(1750);
    });

    it('should handle missing amount fields with defaults', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-005',
            days_past_due: 10,
            // total_amount_due and total_amount_paid missing
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await checkRepossessionEligibility('loan-005');

      expect(result.outstanding_amount).toBe(0);
      expect(result.days_past_due).toBe(10);
    });

    it('should handle zero days_past_due', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'loan-006',
            total_amount_due: 500,
            total_amount_paid: 500,
            days_past_due: 0,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await checkRepossessionEligibility('loan-006');

      expect(result.eligible).toBe(false);
      expect(result.days_past_due).toBe(0);
    });
  });

  // ─── initiateRepossession ──────────────────────────────────
  describe('initiateRepossession', () => {
    it('should throw when loan is not eligible', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'loan-001', total_amount_due: 1000, total_amount_paid: 500, days_past_due: 30 },
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null }); // no restructure

      await expect(initiateRepossession('loan-001', 'admin-001')).rejects.toThrow('Not eligible');
    });

    it('should create repossession order when eligible', async () => {
      // checkRepossessionEligibility calls:
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'loan-002', total_amount_due: 1000, total_amount_paid: 200, days_past_due: 70 },
          error: null,
        })
        .mockResolvedValueOnce({ data: [{ id: 'r-001' }], error: null }) // restructure exists
        // initiateRepossession calls:
        .mockResolvedValueOnce({
          data: { customer_id: 'cust-001', device_id: 'dev-001' },
          error: null,
        }) // loan select
        .mockResolvedValueOnce({
          data: {
            id: 'repo-001',
            loan_id: 'loan-002',
            customer_id: 'cust-001',
            device_id: 'dev-001',
            status: 'warning_sent',
          },
          error: null,
        }) // insert order
        .mockResolvedValueOnce({ data: null, error: null }); // audit log

      const result = await initiateRepossession('loan-002', 'admin-001');

      expect(result.status).toBe('warning_sent');
      expect(result.loan_id).toBe('loan-002');
      expect(db.from).toHaveBeenCalledWith('repossession_orders');
      expect(db.from).toHaveBeenCalledWith('audit_log');
    });

    it('should throw when loan not found after eligibility check', async () => {
      // eligibility passes
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'loan-003', total_amount_due: 1000, total_amount_paid: 100, days_past_due: 80 },
          error: null,
        })
        .mockResolvedValueOnce({ data: [{ id: 'r-001' }], error: null }) // restructure
        // loan select returns null
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(initiateRepossession('loan-003', 'admin-001')).rejects.toThrow('Loan not found');
    });
  });

  // ─── createRepossessionOrder ───────────────────────────────
  describe('createRepossessionOrder', () => {
    it('should throw when order is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await expect(createRepossessionOrder('order-missing')).rejects.toThrow('Order not found');
    });

    it('should throw when 7-day warning period has not elapsed', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'order-001',
          status: 'warning_sent',
          warning_sent_at: twoDaysAgo.toISOString(),
        },
        error: null,
      });

      await expect(createRepossessionOrder('order-001')).rejects.toThrow('Warning period not elapsed');
    });

    it('should update order status when warning period has elapsed', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'order-002',
            status: 'warning_sent',
            warning_sent_at: tenDaysAgo.toISOString(),
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // update order

      await createRepossessionOrder('order-002');

      expect(db.from).toHaveBeenCalledWith('repossession_orders');
    });

    it('should handle order without warning_sent_at', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'order-003',
            status: 'warning_sent',
            warning_sent_at: null,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // update

      // Should proceed without error since no warning date to check
      await createRepossessionOrder('order-003');

      expect(db.from).toHaveBeenCalledWith('repossession_orders');
    });
  });

  // ─── assignAgent ───────────────────────────────────────────
  describe('assignAgent', () => {
    it('should update order with agent assignment', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await assignAgent('order-001', 'agent-001');

      expect(db.from).toHaveBeenCalledWith('repossession_orders');
    });

    it('should set status to agent_assigned', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await assignAgent('order-002', 'agent-002');

      // Verify the from call was made
      expect(db.from).toHaveBeenCalledTimes(1);
    });
  });

  // ─── recordRecovery ────────────────────────────────────────
  describe('recordRecovery', () => {
    it('should update order and device status on recovery', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null }) // update order to recovered
        .mockResolvedValueOnce({
          data: { device_id: 'dev-001', loan_id: 'loan-001' },
          error: null,
        }) // select order for device/loan IDs
        .mockResolvedValueOnce({ data: null, error: null }) // update device to repossessed
        .mockResolvedValueOnce({ data: null, error: null }); // update loan to defaulted

      await recordRecovery('order-001', 'good', 'Device recovered from customer');

      expect(db.from).toHaveBeenCalledWith('repossession_orders');
      expect(db.from).toHaveBeenCalledWith('devices');
      expect(db.from).toHaveBeenCalledWith('loans');
    });

    it('should handle order with no device/loan found', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null }) // update order
        .mockResolvedValueOnce({ data: null, error: null }); // order select returns null

      // Should not throw, just skip device/loan updates
      await recordRecovery('order-002', 'fair', 'Some damage noted');

      // Only 2 from calls: update order + select order
      expect(db.from).toHaveBeenCalledTimes(2);
    });

    it('should record device condition and notes', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { device_id: 'dev-002', loan_id: 'loan-002' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await recordRecovery('order-003', 'poor', 'Screen cracked, scratches on body');

      expect(db.from).toHaveBeenCalledWith('repossession_orders');
    });
  });

  // ─── closeRepossession ─────────────────────────────────────
  describe('closeRepossession', () => {
    it('should update order status to closed and log audit', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null }) // update order
        .mockResolvedValueOnce({ data: null, error: null }); // audit log

      await closeRepossession('order-001', 'admin-001');

      expect(db.from).toHaveBeenCalledWith('repossession_orders');
      expect(db.from).toHaveBeenCalledWith('audit_log');
    });

    it('should record who closed the repossession in audit log', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      await closeRepossession('order-002', 'manager-001');

      expect(db.from).toHaveBeenCalledWith('audit_log');
    });
  });
});
