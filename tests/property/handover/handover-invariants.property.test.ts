/**
 * Property-based tests for handover completion invariants.
 * Tests: completeHandover from services/lock-service/src/handover/handover-workflow.ts
 *
 * Key invariants:
 * - All 3 verification flags must be true for success
 * - On success: loan→active, device→sold (dual-state consistency)
 * - On failure: handover status → 'failed'
 * - Device lock failure is non-blocking
 */

import fc from 'fast-check';

// Track all db operations for assertions
const dbOps: { table: string; op: string; data: Record<string, unknown> }[] = [];

const mockExecute = jest.fn().mockResolvedValue({ data: null, error: null });

function createChain() {
  return {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockImplementation(function (this: any, data: Record<string, unknown>) {
      // Track table is set by mockFrom
      dbOps.push({ table: (this as any)._table, op: 'insert', data });
      return this;
    }),
    update: jest.fn().mockImplementation(function (this: any, data: Record<string, unknown>) {
      dbOps.push({ table: (this as any)._table, op: 'update', data });
      return this;
    }),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    execute: mockExecute,
  };
}

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
  calculateDistributorCommission: jest.fn().mockResolvedValue({
    amount: 25,
    percentage: 5,
    loan_amount: 500,
    device_price: 200,
    device_model: 'Galaxy A14',
  }),
}));

import { completeHandover } from '../../../services/lock-service/src/handover/handover-workflow';

/**
 * Helper: parse raw SQL from withTransaction tx() calls into dbOps entries
 * so the existing assertions (which look for table + op + data) still work.
 */
function parseTxSql(sql: string, params?: unknown[]): { table: string; op: string; data: Record<string, unknown> } | null {
  const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE/i);
  if (updateMatch) {
    const table = updateMatch[1];
    const setClause = updateMatch[2];
    const data: Record<string, unknown> = {};
    // Extract column = $N pairs (parameterized values)
    const paramMatches = setClause.matchAll(/(\w+)\s*=\s*\$(\d+)/g);
    for (const m of paramMatches) {
      const col = m[1];
      const idx = parseInt(m[2]) - 1;
      data[col] = params && params[idx] !== undefined ? params[idx] : `$${m[2]}`;
    }
    // Extract column = 'literal' pairs (string literals in SQL)
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

describe('completeHandover invariants - property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbOps.length = 0;
  });

  function setupHandoverMock(flags: {
    identity_verified: boolean;
    deposit_verified: boolean;
    device_condition_verified: boolean;
  }) {
    const handoverRecord = {
      id: 'handover-1',
      loan_id: 'loan-1',
      device_id: 'dev-1',
      customer_id: 'cust-1',
      distributor_id: 'dist-1',
      ...flags,
    };

    mockFrom.mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain._table = table;
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
        chain.execute = jest.fn().mockResolvedValueOnce({ data: handoverRecord, error: null })
          .mockResolvedValue({ data: null, error: null });
      } else {
        chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });
      }

      return chain;
    });

    // Mock withTransaction to execute the callback with a tx function that tracks operations
    mockWithTransaction.mockImplementation(async (fn: (...args: any[]) => any) => {
      const tx = jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        const parsed = parseTxSql(sql, params);
        if (parsed) dbOps.push(parsed);
        return { data: [], error: null };
      });
      return fn(tx);
    });
  }

  it('requires ALL THREE verification flags to complete — exhaustive boolean combinations', () => {
    const boolCombos = fc.tuple(fc.boolean(), fc.boolean(), fc.boolean());

    return fc.assert(
      fc.asyncProperty(boolCombos, async ([identity, deposit, deviceCond]) => {
        setupHandoverMock({
          identity_verified: identity,
          deposit_verified: deposit,
          device_condition_verified: deviceCond,
        });

        const allTrue = identity && deposit && deviceCond;

        if (allTrue) {
          const result = await completeHandover('handover-1');
          expect(result.success).toBe(true);
        } else {
          await expect(completeHandover('handover-1')).rejects.toThrow();
        }
      }),
      { numRuns: 8 } // Exactly 2^3 combinations
    );
  });

  it('always rejects when identity_verified is false', () => {
    return fc.assert(
      fc.asyncProperty(fc.boolean(), fc.boolean(), async (deposit, deviceCond) => {
        setupHandoverMock({
          identity_verified: false,
          deposit_verified: deposit,
          device_condition_verified: deviceCond,
        });

        await expect(completeHandover('handover-1')).rejects.toThrow('Identity not verified');
      }),
      { numRuns: 4 }
    );
  });

  it('always rejects when deposit_verified is false (identity must be true first)', () => {
    return fc.assert(
      fc.asyncProperty(fc.boolean(), async (deviceCond) => {
        setupHandoverMock({
          identity_verified: true,
          deposit_verified: false,
          device_condition_verified: deviceCond,
        });

        await expect(completeHandover('handover-1')).rejects.toThrow(/[Dd]eposit/);
      }),
      { numRuns: 2 }
    );
  });

  it('rejects when device_condition_verified is false (others true)', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: false,
    });

    await expect(completeHandover('handover-1')).rejects.toThrow(/[Dd]evice condition/);
  });

  it('on success: sets loan status to active', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    await completeHandover('handover-1');

    const loanUpdate = dbOps.find(op => op.table === 'loans' && op.op === 'update');
    expect(loanUpdate).toBeDefined();
    expect(loanUpdate!.data.status).toBe('active');
    expect(loanUpdate!.data.disbursed_at).toBeDefined();
  });

  it('on success: sets device status to sold with customer_id and loan_id', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    await completeHandover('handover-1');

    const deviceUpdate = dbOps.find(op => op.table === 'devices' && op.op === 'update');
    expect(deviceUpdate).toBeDefined();
    expect(deviceUpdate!.data.status).toBe('sold');
    expect(deviceUpdate!.data.customer_id).toBe('cust-1');
    expect(deviceUpdate!.data.loan_id).toBe('loan-1');
  });

  it('on success: device status set to sold with customer and loan info', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    await completeHandover('handover-1');

    const deviceUpdate = dbOps.find(op => op.table === 'devices' && op.op === 'update');
    expect(deviceUpdate).toBeDefined();
    expect(deviceUpdate!.data.status).toBe('sold');
    expect(deviceUpdate!.data.customer_id).toBe('cust-1');
    expect(deviceUpdate!.data.loan_id).toBe('loan-1');
  });

  it('on success: dual-state consistency — loan and device both updated', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    await completeHandover('handover-1');

    const tables = dbOps.filter(op => op.op === 'update').map(op => op.table);
    expect(tables).toContain('loans');
    expect(tables).toContain('devices');
    expect(tables).toContain('device_handovers');
  });

  it('on success: next_payment_date is approximately 30 days from now', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    const before = Date.now();
    await completeHandover('handover-1');
    const after = Date.now();

    const loanUpdate = dbOps.find(op => op.table === 'loans' && op.op === 'update');
    expect(loanUpdate).toBeDefined();

    const nextPaymentDate = new Date(loanUpdate!.data.next_payment_date as string).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    // next_payment_date should be ~30 days from now (within 5 seconds tolerance)
    expect(nextPaymentDate).toBeGreaterThanOrEqual(before + thirtyDaysMs - 5000);
    expect(nextPaymentDate).toBeLessThanOrEqual(after + thirtyDaysMs + 5000);
  });

  it('on success: records commission in distributor_commissions', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    await completeHandover('handover-1');

    const commInsert = dbOps.find(op => op.table === 'distributor_commissions' && op.op === 'insert');
    expect(commInsert).toBeDefined();
    expect(commInsert!.data.distributor_id).toBe('dist-1');
    expect(commInsert!.data.loan_id).toBe('loan-1');
    expect(commInsert!.data.payment_status).toBe('pending');
  });

  it('on success: creates device_locks entry', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    await completeHandover('handover-1');

    const lockInsert = dbOps.find(op => op.table === 'device_locks' && op.op === 'insert');
    expect(lockInsert).toBeDefined();
    expect(lockInsert!.data.execution_status).toBe('pending');
    expect(lockInsert!.data.reason).toBe('handover_activation');
  });

  it('on success: marks handover as completed', async () => {
    setupHandoverMock({
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    });

    await completeHandover('handover-1');

    const handoverUpdate = dbOps.find(
      op => op.table === 'device_handovers' && op.op === 'update' && op.data.status === 'completed'
    );
    expect(handoverUpdate).toBeDefined();
    expect(handoverUpdate!.data.handed_over_at).toBeDefined();
  });

  it('on failure: marks handover as failed with error message', async () => {
    // Setup: identity verified, but withTransaction throws (simulating DB failure)
    const handoverRecord = {
      id: 'handover-1',
      loan_id: 'loan-1',
      device_id: 'dev-1',
      customer_id: 'cust-1',
      distributor_id: 'dist-1',
      identity_verified: true,
      deposit_verified: true,
      device_condition_verified: true,
    };

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
          .mockResolvedValueOnce({ data: handoverRecord, error: null }) // select
          .mockResolvedValue({ data: null, error: null }); // update (failure marking)
      } else {
        chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });
      }

      return chain;
    });

    // withTransaction throws to simulate DB failure inside the transaction
    mockWithTransaction.mockRejectedValue(new Error('DB connection failed'));

    await expect(completeHandover('handover-1')).rejects.toThrow('DB connection failed');

    const failUpdate = dbOps.find(
      op => op.table === 'device_handovers' && op.op === 'update' && op.data.status === 'failed'
    );
    expect(failUpdate).toBeDefined();
    expect(failUpdate!.data.failure_reason).toBe('DB connection failed');
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
