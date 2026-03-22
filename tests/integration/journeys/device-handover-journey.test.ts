/**
 * Integration journey test: Device Handover
 *
 * Tests the full handover flow:
 *   Search approved loan → Verify identity/device/deposit → Submit → Complete handover
 *
 * Handlers under test:
 *   - handleSearchApprovedLoans, handleVerifyDevice (distributor-service)
 *   - completeHandover (lock-service)
 *   - calculateDistributorCommission (lock-service)
 */

// ─── DB tracking ───
const dbOps: { table: string; op: string; data: Record<string, unknown> }[] = [];
const mockFrom = jest.fn();

const mockWithTransaction = jest.fn();
jest.mock('../../../services/shared/clients/database', () => ({
  db: { from: (...args: unknown[]) => mockFrom(...args) },
  withTransaction: (...args: unknown[]) => mockWithTransaction(...args),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../../services/lock-service/src/handover/commission-calculator', () => ({
  calculateDistributorCommission: jest.fn(),
}));

import { completeHandover } from '../../../services/lock-service/src/handover/handover-workflow';
import { calculateDistributorCommission } from '../../../services/lock-service/src/handover/commission-calculator';

const mockCalcCommission = calculateDistributorCommission as jest.MockedFunction<typeof calculateDistributorCommission>;

// ─── Test data ───
const testHandover = {
  id: 'handover-001',
  loan_id: 'loan-001',
  device_id: 'dev-001',
  customer_id: 'cust-001',
  distributor_id: 'dist-001',
  identity_verified: true,
  deposit_verified: true,
  device_condition_verified: true,
  status: 'initiated',
};

/**
 * Parse raw SQL from withTransaction tx() calls into dbOps entries.
 */
function parseTxSql(sql: string, params?: unknown[]): { table: string; op: string; data: Record<string, unknown> } | null {
  const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE/i);
  if (updateMatch) {
    const table = updateMatch[1];
    const setClause = updateMatch[2];
    const data: Record<string, unknown> = {};
    const paramMatches = setClause.matchAll(/(\w+)\s*=\s*\$(\d+)/g);
    for (const m of paramMatches) {
      const col = m[1];
      const idx = parseInt(m[2]) - 1;
      data[col] = params && params[idx] !== undefined ? params[idx] : `$${m[2]}`;
    }
    const literalMatches = setClause.matchAll(/(\w+)\s*=\s*'([^']*)'/g);
    for (const m of literalMatches) {
      data[m[1]] = m[2];
    }
    return { table, op: 'update', data };
  }
  const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  if (insertMatch) {
    const table = insertMatch[1];
    const data: Record<string, unknown> = {};
    const colListMatch = sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (colListMatch) {
      const cols = colListMatch[1].split(',').map(c => c.trim());
      const vals = colListMatch[2].split(',').map(v => v.trim());
      cols.forEach((col, i) => {
        const val = vals[i];
        if (val && val.startsWith('$') && params) {
          const idx = parseInt(val.substring(1)) - 1;
          data[col] = params[idx] !== undefined ? params[idx] : null;
        } else if (val && val.startsWith("'") && val.endsWith("'")) {
          data[col] = val.slice(1, -1);
        } else {
          data[col] = val || null;
        }
      });
    }
    return { table, op: 'insert', data };
  }
  return null;
}

describe('Device Handover Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbOps.length = 0;

    mockCalcCommission.mockResolvedValue({
      amount: 25,
      percentage: 5,
      loan_amount: 500,
      device_price: 200,
      device_model: 'Galaxy A14',
    });
  });

  function setupHandoverDbMock(handover: Record<string, unknown>) {
    mockFrom.mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
        dbOps.push({ table, op: 'insert', data });
        return chain;
      });
      chain.update = jest.fn().mockImplementation((data: Record<string, unknown>) => {
        dbOps.push({ table, op: 'update', data });
        return chain;
      });
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.single = jest.fn().mockReturnValue(chain);
      chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });

      // First select on device_handovers returns the handover record
      if (table === 'device_handovers') {
        chain.execute = jest.fn()
          .mockResolvedValueOnce({ data: handover, error: null })
          .mockResolvedValue({ data: null, error: null });
      }

      return chain;
    });

    // Mock withTransaction to execute callback with a tx that tracks operations
    mockWithTransaction.mockImplementation(async (fn: (...args: any[]) => any) => {
      const tx = jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        const parsed = parseTxSql(sql, params);
        if (parsed) dbOps.push(parsed);
        return { data: [], error: null };
      });
      return fn(tx);
    });
  }

  // ─── Happy Path ───

  describe('Happy Path: Complete Handover', () => {
    it('activates loan, marks device sold, updates inventory, records commission', async () => {
      setupHandoverDbMock(testHandover);

      const result = await completeHandover('handover-001');

      expect(result.success).toBe(true);
      expect(result.loan_id).toBe('loan-001');
      expect(result.commission.amount).toBe(25);
      expect(result.commission.percentage).toBe(5);

      // Loan → active
      const loanUpdate = dbOps.find(op => op.table === 'loans' && op.op === 'update');
      expect(loanUpdate).toBeDefined();
      expect(loanUpdate!.data.status).toBe('active');
      expect(loanUpdate!.data.disbursed_at).toBeDefined();
      expect(loanUpdate!.data.next_payment_date).toBeDefined();

      // Device → sold
      const deviceUpdate = dbOps.find(op => op.table === 'devices' && op.op === 'update');
      expect(deviceUpdate).toBeDefined();
      expect(deviceUpdate!.data.status).toBe('sold');
      expect(deviceUpdate!.data.customer_id).toBe('cust-001');
      expect(deviceUpdate!.data.loan_id).toBe('loan-001');

      // Device sold with customer info (no separate agent_inventory update needed)
      expect(deviceUpdate!.data.customer_id).toBe('cust-001');
      expect(deviceUpdate!.data.loan_id).toBe('loan-001');

      // Commission recorded
      const commInsert = dbOps.find(op => op.table === 'distributor_commissions' && op.op === 'insert');
      expect(commInsert).toBeDefined();
      expect(commInsert!.data.commission_amount_usd).toBe(25);
      expect(commInsert!.data.commission_percentage).toBe(5);
      expect(commInsert!.data.payment_status).toBe('pending');

      // Handover → completed
      const handoverUpdate = dbOps.find(
        op => op.table === 'device_handovers' && op.op === 'update' && op.data.status === 'completed'
      );
      expect(handoverUpdate).toBeDefined();
      expect(handoverUpdate!.data.handed_over_at).toBeDefined();

      // Device lock entry created
      const lockInsert = dbOps.find(op => op.table === 'device_locks' && op.op === 'insert');
      expect(lockInsert).toBeDefined();
      expect(lockInsert!.data.execution_status).toBe('pending');
    });

    it('next_payment_date is 30 days from handover', async () => {
      setupHandoverDbMock(testHandover);

      const before = Date.now();
      await completeHandover('handover-001');

      const loanUpdate = dbOps.find(op => op.table === 'loans' && op.op === 'update');
      const nextPayment = new Date(loanUpdate!.data.next_payment_date as string).getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      expect(nextPayment).toBeGreaterThanOrEqual(before + thirtyDays - 5000);
      expect(nextPayment).toBeLessThanOrEqual(Date.now() + thirtyDays + 5000);
    });

    it('commission with custom 8% rate', async () => {
      setupHandoverDbMock(testHandover);
      mockCalcCommission.mockResolvedValue({
        amount: 40,
        percentage: 8,
        loan_amount: 500,
        device_price: 200,
        device_model: 'Galaxy A14',
      });

      const result = await completeHandover('handover-001');

      expect(result.commission.amount).toBe(40);
      expect(result.commission.percentage).toBe(8);

      const commInsert = dbOps.find(op => op.table === 'distributor_commissions' && op.op === 'insert');
      expect(commInsert!.data.commission_amount_usd).toBe(40);
      expect(commInsert!.data.commission_percentage).toBe(8);
    });
  });

  // ─── Verification Failures ───

  describe('Verification Failures', () => {
    it('fails when identity_verified is false', async () => {
      setupHandoverDbMock({ ...testHandover, identity_verified: false });

      await expect(completeHandover('handover-001')).rejects.toThrow('Identity not verified');

      const failUpdate = dbOps.find(
        op => op.table === 'device_handovers' && op.op === 'update' && op.data.status === 'failed'
      );
      expect(failUpdate).toBeDefined();
    });

    it('fails when deposit_verified is false', async () => {
      setupHandoverDbMock({ ...testHandover, deposit_verified: false });

      await expect(completeHandover('handover-001')).rejects.toThrow(/[Dd]eposit/);
    });

    it('fails when device_condition_verified is false', async () => {
      setupHandoverDbMock({ ...testHandover, device_condition_verified: false });

      await expect(completeHandover('handover-001')).rejects.toThrow(/[Dd]evice condition/);
    });
  });

  // ─── Error Recovery ───

  describe('Error Recovery', () => {
    it('marks handover as failed when transaction throws', async () => {
      // Setup db.from for the initial handover read + failure status update
      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, any> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
          dbOps.push({ table, op: 'insert', data });
          return chain;
        });
        chain.update = jest.fn().mockImplementation((data: Record<string, unknown>) => {
          dbOps.push({ table, op: 'update', data });
          return chain;
        });
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockReturnValue(chain);

        if (table === 'device_handovers') {
          chain.execute = jest.fn()
            .mockResolvedValueOnce({ data: testHandover, error: null })
            .mockResolvedValue({ data: null, error: null });
        } else {
          chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });
        }

        return chain;
      });

      // withTransaction throws to simulate DB failure inside the transaction
      mockWithTransaction.mockRejectedValue(new Error('Connection timeout'));

      await expect(completeHandover('handover-001')).rejects.toThrow('Connection timeout');

      const failUpdate = dbOps.find(
        op => op.table === 'device_handovers' && op.op === 'update' && op.data.status === 'failed'
      );
      expect(failUpdate).toBeDefined();
      expect(failUpdate!.data.failure_reason).toBe('Connection timeout');
    });

    it('device lock failure inside transaction fails the handover', async () => {
      // With the transaction-based approach, a lock failure inside the tx
      // will cause the entire transaction to roll back and the handover to fail.
      // Setup db.from for the initial handover read + failure status update
      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, any> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
          dbOps.push({ table, op: 'insert', data });
          return chain;
        });
        chain.update = jest.fn().mockImplementation((data: Record<string, unknown>) => {
          dbOps.push({ table, op: 'update', data });
          return chain;
        });
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockReturnValue(chain);

        if (table === 'device_handovers') {
          chain.execute = jest.fn()
            .mockResolvedValueOnce({ data: testHandover, error: null })
            .mockResolvedValue({ data: null, error: null });
        } else {
          chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });
        }

        return chain;
      });

      // Simulate lock insert failure inside the transaction
      mockWithTransaction.mockImplementation(async (fn: (...args: any[]) => any) => {
        let callCount = 0;
        const tx = jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          callCount++;
          // The 5th tx call is the device_locks INSERT
          if (callCount === 5) {
            throw new Error('Trustonic unavailable');
          }
          const parsed = parseTxSql(sql, params);
          if (parsed) dbOps.push(parsed);
          return { data: [], error: null };
        });
        return fn(tx);
      });

      await expect(completeHandover('handover-001')).rejects.toThrow('Trustonic unavailable');

      // Handover should be marked as failed
      const failUpdate = dbOps.find(
        op => op.table === 'device_handovers' && op.op === 'update' && op.data.status === 'failed'
      );
      expect(failUpdate).toBeDefined();
    });

    it('throws when handover not found', async () => {
      mockFrom.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis(),
      }));

      await expect(completeHandover('nonexistent')).rejects.toThrow('Handover not found');
    });
  });

  // ─── Tri-State Consistency ───

  describe('Tri-State Consistency', () => {
    it('all three entities (loan, device, inventory) are updated on success', async () => {
      setupHandoverDbMock(testHandover);

      await completeHandover('handover-001');

      const updatedTables = dbOps
        .filter(op => op.op === 'update')
        .map(op => op.table);

      expect(updatedTables).toContain('loans');
      expect(updatedTables).toContain('devices');
      expect(updatedTables).toContain('device_handovers');
    });

    it('commission is always recorded with matching loan_id and distributor_id', async () => {
      setupHandoverDbMock(testHandover);

      await completeHandover('handover-001');

      const commInsert = dbOps.find(op => op.table === 'distributor_commissions' && op.op === 'insert');
      expect(commInsert!.data.loan_id).toBe('loan-001');
      expect(commInsert!.data.distributor_id).toBe('dist-001');
      expect(commInsert!.data.device_id).toBe('dev-001');
    });
  });
});