/**
 * Property-based tests for inventory transfer state machine.
 * Tests: handleUpdateTransfer from services/admin-service/src/handlers/inventory-transfers.ts
 *
 * Valid transitions (from line 180-184):
 *   requested → [approved, cancelled]
 *   approved  → [in_transit, cancelled]
 *   in_transit → [received, cancelled]
 *   received  → (terminal)
 *   cancelled → (terminal)
 */

import fc from 'fast-check';

const dbOps: { table: string; op: string; data: Record<string, unknown> }[] = [];
const mockFrom = jest.fn();
const mockQuery = jest.fn();

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

jest.mock('../../../services/shared/clients/database', () => ({
  db: { from: (...args: unknown[]) => mockFrom(...args) },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: jest.fn().mockImplementation(async (fn: Function) => {
    const tx = jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
      const parsed = parseTxSql(sql, params);
      if (parsed) dbOps.push(parsed);
      return { data: [], error: null };
    });
    return fn(tx);
  }),
}));

jest.mock('../../../services/shared/utils/response', () => ({
  successResponse: (body: unknown, status: number) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  errorResponse: (message: string, status: number, details: unknown = {}) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: { message, ...details } }),
  }),
}));

jest.mock('../../../services/shared/middleware/authorization', () => ({
  isAdminOrManager: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  getRequestContext: jest.fn().mockReturnValue({ requestId: 'test-req-id' }),
  maskImei: jest.fn((imei: string) => imei),
}));

jest.mock('../../../services/admin-service/src/handlers/helpers', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

import { handleUpdateTransfer } from '../../../services/admin-service/src/handlers/inventory-transfers';
import { createAPIGatewayEvent } from '../../helpers/test-utils';

const validTransitions: Record<string, string[]> = {
  requested: ['approved', 'cancelled'],
  approved: ['in_transit', 'cancelled'],
  in_transit: ['pending_receipt', 'cancelled'],
  pending_receipt: ['received', 'disputed'],
  disputed: ['received', 'cancelled'],
  return_requested: ['return_approved', 'disputed', 'cancelled'],
  return_approved: ['received', 'cancelled'],
};

const allStatuses = ['requested', 'approved', 'in_transit', 'pending_receipt', 'disputed', 'received', 'cancelled'];
const terminalStatuses = ['received', 'cancelled'];
const nonTerminalStatuses = ['requested', 'approved', 'in_transit', 'pending_receipt', 'disputed', 'return_requested', 'return_approved'];

describe('Transfer State Machine - property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbOps.length = 0;
  });

  function setupTransferMock(currentStatus: string, toDistributorId: string | null = 'dist-1') {
    const transferRecord = {
      id: 'transfer-1',
      device_id: 'dev-1',
      from_distributor_id: 'dist-0',
      to_distributor_id: toDistributorId,
      to_location: 'Harare',
      status: currentStatus,
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
      chain.maybeSingle = jest.fn().mockReturnValue(chain);
      chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });

      // First call to stock_transfers with maybeSingle returns the transfer record
      if (table === 'stock_transfers') {
        chain.execute = jest.fn()
          .mockResolvedValueOnce({ data: transferRecord, error: null }) // select
          .mockResolvedValue({ data: null, error: null }); // update
      }

      return chain;
    });
  }

  function makeEvent(newStatus: string, cancellationReason?: string) {
    const body: Record<string, unknown> = { status: newStatus };
    if (cancellationReason) body.cancellation_reason = cancellationReason;
    return createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/inventory/transfers/transfer-1',
      body: JSON.stringify(body),
    });
  }

  it('accepts all valid transitions', () => {
    const validPairs = fc.constantFrom(
      ...Object.entries(validTransitions).flatMap(([from, tos]) =>
        tos.map(to => [from, to] as [string, string])
      )
    );

    return fc.assert(
      fc.asyncProperty(validPairs, async ([currentStatus, newStatus]) => {
        setupTransferMock(currentStatus);
        const event = makeEvent(newStatus);
        const result = await handleUpdateTransfer(event, { id: 'transfer-1' }, { userId: 'admin-1', role: 'admin' });
        expect(result.statusCode).toBe(200);
      }),
      { numRuns: 50 }
    );
  });

  it('rejects all invalid transitions from non-terminal states', () => {
    const invalidPairs = fc.constantFrom(
      ...nonTerminalStatuses.flatMap(from =>
        allStatuses
          .filter(to => !(validTransitions[from] || []).includes(to))
          .map(to => [from, to] as [string, string])
      )
    );

    return fc.assert(
      fc.asyncProperty(invalidPairs, async ([currentStatus, newStatus]) => {
        setupTransferMock(currentStatus);
        const event = makeEvent(newStatus);
        const result = await handleUpdateTransfer(event, { id: 'transfer-1' }, { userId: 'admin-1', role: 'admin' });
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Cannot transition');
      }),
      { numRuns: 50 }
    );
  });

  it('terminal states (received, cancelled) reject all transitions', () => {
    const terminalPair = fc.tuple(
      fc.constantFrom(...terminalStatuses),
      fc.constantFrom(...allStatuses)
    );

    return fc.assert(
      fc.asyncProperty(terminalPair, async ([currentStatus, newStatus]) => {
        setupTransferMock(currentStatus);
        const event = makeEvent(newStatus);
        const result = await handleUpdateTransfer(event, { id: 'transfer-1' }, { userId: 'admin-1', role: 'admin' });
        expect(result.statusCode).toBe(400);
      }),
      { numRuns: 20 }
    );
  });

  it('"received" transition assigns device to distributor', async () => {
    setupTransferMock('pending_receipt', 'dist-1');
    const event = makeEvent('received');
    const result = await handleUpdateTransfer(event, { id: 'transfer-1' }, { userId: 'admin-1', role: 'admin' });

    expect(result.statusCode).toBe(200);

    // Device should be updated to 'assigned' with distributor_id set
    const deviceUpdate = dbOps.find(op => op.table === 'devices' && op.op === 'update');
    expect(deviceUpdate).toBeDefined();
    expect(deviceUpdate!.data.status).toBe('assigned');
    expect(deviceUpdate!.data.distributor_id).toBe('dist-1');
    expect(deviceUpdate!.data.assigned_to_distributor_at).toBeDefined();
  });

  it('"approved" transition records approved_by and approved_at', async () => {
    setupTransferMock('requested');
    const event = makeEvent('approved');
    const result = await handleUpdateTransfer(event, { id: 'transfer-1' }, { userId: 'admin-1', role: 'admin' });

    expect(result.statusCode).toBe(200);

    const transferUpdate = dbOps.find(op => op.table === 'stock_transfers' && op.op === 'update');
    expect(transferUpdate).toBeDefined();
    expect(transferUpdate!.data.approved_by).toBe('admin-1');
    expect(transferUpdate!.data.approved_at).toBeDefined();
  });

  it('"cancelled" from cancellable states records cancelled_at', () => {
    // Only states that include 'cancelled' in their valid transitions
    const cancellableStatuses = Object.entries(validTransitions)
      .filter(([, tos]) => tos.includes('cancelled'))
      .map(([from]) => from);
    return fc.assert(
      fc.asyncProperty(fc.constantFrom(...cancellableStatuses), async (currentStatus) => {
        dbOps.length = 0;
        setupTransferMock(currentStatus);
        const event = makeEvent('cancelled', 'No longer needed');
        const result = await handleUpdateTransfer(event, { id: 'transfer-1' }, { userId: 'admin-1', role: 'admin' });

        expect(result.statusCode).toBe(200);

        const transferUpdate = dbOps.find(op => op.table === 'stock_transfers' && op.op === 'update');
        expect(transferUpdate!.data.cancelled_at).toBeDefined();
        expect(transferUpdate!.data.cancellation_reason).toBe('No longer needed');
      }),
      { numRuns: 3 }
    );
  });

  it('"in_transit" transition records shipped_at', async () => {
    setupTransferMock('approved');
    const event = makeEvent('in_transit');
    const result = await handleUpdateTransfer(event, { id: 'transfer-1' }, { userId: 'admin-1', role: 'admin' });

    expect(result.statusCode).toBe(200);

    const transferUpdate = dbOps.find(op => op.table === 'stock_transfers' && op.op === 'update');
    expect(transferUpdate!.data.shipped_at).toBeDefined();
  });

  it('returns 404 when transfer not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const event = makeEvent('approved');
    const result = await handleUpdateTransfer(event, { id: 'nonexistent' }, { userId: 'admin-1', role: 'admin' });
    expect(result.statusCode).toBe(404);
  });
});
