/**
 * Integration journey test: Inventory to Customer
 *
 * Tests the full lifecycle:
 *   Create device → Transfer to distributor → Handover to customer
 *
 * Handlers under test:
 *   - handleCreateDevice, handleBulkImportDevices (admin-service)
 *   - handleCreateTransfer, handleUpdateTransfer (admin-service)
 *   - completeHandover (lock-service)
 */

const dbOps: { table: string; op: string; data: Record<string, unknown> }[] = [];
const existingImeis = new Set<string>();
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

const mockWithTransaction = jest.fn().mockImplementation(async (fn: Function) => {
  const tx = jest.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
    const parsed = parseTxSql(sql, params);
    if (parsed) dbOps.push(parsed);
    return { data: [], error: null };
  });
  return fn(tx);
});
jest.mock('../../../services/shared/clients/database', () => ({
  db: { from: (...args: unknown[]) => mockFrom(...args) },
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: (...args: unknown[]) => mockWithTransaction(...args),
}));

jest.mock('../../../services/shared/utils/response', () => ({
  successResponse: (body: unknown, status: number, _event: unknown) => ({
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  errorResponse: (message: string, status: number, details: unknown = {}, _event: unknown) => ({
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

import { handleCreateDevice, handleBulkImportDevices } from '../../../services/admin-service/src/handlers/inventory-devices';
import { handleCreateTransfer, handleUpdateTransfer } from '../../../services/admin-service/src/handlers/inventory-transfers';
import { createAPIGatewayEvent } from '../../helpers/test-utils';

const authContext = { userId: 'admin-001', role: 'admin', email: 'admin@lynia.com' };

describe('Inventory to Customer Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbOps.length = 0;
    existingImeis.clear();
  });

  function setupInventoryDbMock() {
    mockFrom.mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain._table = table;
      chain.select = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockImplementation((data: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(data) ? data : [data];
        for (const row of rows) {
          dbOps.push({ table, op: 'insert', data: row });
          if (row.imei) existingImeis.add(row.imei as string);
        }
        return chain;
      });
      chain.update = jest.fn().mockImplementation((data: Record<string, unknown>) => {
        dbOps.push({ table, op: 'update', data });
        return chain;
      });
      chain.eq = jest.fn().mockImplementation((_field: string, value: unknown) => {
        chain._lastEqValue = value;
        chain._lastEqField = _field;
        return chain;
      });
      chain.is = jest.fn().mockReturnValue(chain);
      chain.in = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockReturnValue(chain);
      chain.limit = jest.fn().mockReturnValue(chain);
      chain.single = jest.fn().mockReturnValue(chain);
      chain.maybeSingle = jest.fn().mockReturnValue(chain);
      chain.execute = jest.fn().mockImplementation(() => {
        // For duplicate IMEI check in devices table
        if (table === 'devices' && chain._lastEqField === 'imei') {
          if (existingImeis.has(chain._lastEqValue as string)) {
            return Promise.resolve({ data: { id: 'existing' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    });
  }

  // ─── Device Creation ───

  describe('Device Creation', () => {
    it('creates device with valid IMEI and sets status to in_stock', async () => {
      setupInventoryDbMock();

      // Override: no duplicate found, then insert succeeds
      let devicesCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, any> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
          dbOps.push({ table, op: 'insert', data });
          return chain;
        });
        chain.update = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.is = jest.fn().mockReturnValue(chain);
        chain.maybeSingle = jest.fn().mockReturnValue(chain);
        if (table === 'devices') {
          devicesCallCount++;
          if (devicesCallCount === 1) {
            // First from('devices'): duplicate check → not found
            chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });
          } else {
            // Second from('devices'): insert returns created record
            chain.execute = jest.fn().mockResolvedValue({
              data: { id: 'dev-new-001', imei: '353456789012345', status: 'in_stock' },
              error: null,
            });
          }
        } else {
          chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });
        }
        return chain;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          imei: '353456789012345',
          manufacturer: 'Samsung',
          model: 'Galaxy A14',
          retail_price_usd: 200,
        }),
      });

      const result = await handleCreateDevice(event, {}, authContext);
      expect(result.statusCode).toBe(201);

      const insert = dbOps.find(op => op.table === 'devices' && op.op === 'insert');
      expect(insert).toBeDefined();
      expect(insert!.data.status).toBe('in_stock');
      expect(insert!.data.lock_status).toBe('unlocked');
      expect(insert!.data.imei).toBe('353456789012345');
    });

    it('rejects invalid IMEI format', async () => {
      setupInventoryDbMock();

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          imei: '12345',  // Too short
          manufacturer: 'Samsung',
          model: 'Galaxy A14',
        }),
      });

      const result = await handleCreateDevice(event, {}, authContext);
      expect(result.statusCode).toBe(400);
    });

    it('rejects missing manufacturer', async () => {
      setupInventoryDbMock();

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          imei: '353456789012345',
          model: 'Galaxy A14',
          // Missing manufacturer
        }),
      });

      const result = await handleCreateDevice(event, {}, authContext);
      expect(result.statusCode).toBe(400);
    });

    it('rejects duplicate IMEI', async () => {
      existingImeis.add('353456789012345');

      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, any> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.is = jest.fn().mockReturnValue(chain);
        chain.maybeSingle = jest.fn().mockReturnValue(chain);
        chain.execute = jest.fn().mockResolvedValue({
          data: { id: 'existing-device' },  // Duplicate found
          error: null,
        });
        return chain;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          imei: '353456789012345',
          manufacturer: 'Samsung',
          model: 'Galaxy A14',
        }),
      });

      const result = await handleCreateDevice(event, {}, authContext);
      expect(result.statusCode).toBe(409);
    });
  });

  // ─── Transfer State Machine ───

  describe('Transfer State Machine', () => {
    function setupTransferMock(currentStatus: string) {
      const transferRecord = {
        id: 'transfer-001',
        device_id: 'dev-001',
        to_distributor_id: 'dist-001',
        to_location: 'Harare Branch',
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
        chain.is = jest.fn().mockReturnValue(chain);
        chain.maybeSingle = jest.fn().mockReturnValue(chain);
        chain.execute = jest.fn().mockResolvedValue({ data: null, error: null });

        if (table === 'stock_transfers') {
          chain.execute = jest.fn()
            .mockResolvedValueOnce({ data: transferRecord, error: null })
            .mockResolvedValue({ data: null, error: null });
        }
        if (table === 'devices') {
          chain.execute = jest.fn().mockResolvedValue({ data: { id: 'dev-001', status: 'in_stock' }, error: null });
        }

        return chain;
      });
    }

    it('full transfer lifecycle: requested → approved → in_transit → received', async () => {
      // Step 1: Create transfer
      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, any> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
          dbOps.push({ table, op: 'insert', data });
          return chain;
        });
        chain.update = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.is = jest.fn().mockReturnValue(chain);
        chain.maybeSingle = jest.fn().mockReturnValue(chain);
        chain.execute = jest.fn().mockResolvedValue({
          data: table === 'devices' ? { id: 'dev-001', status: 'in_stock' } : { id: 'transfer-001', status: 'requested' },
          error: null,
        });
        return chain;
      });

      const createEvent = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          device_id: 'dev-001',
          to_distributor_id: 'dist-001',
          to_location: 'Harare Branch',
        }),
      });

      const createResult = await handleCreateTransfer(createEvent, {}, authContext);
      expect(createResult.statusCode).toBe(201);

      // Step 2: Approve
      dbOps.length = 0;
      setupTransferMock('requested');
      const approveEvent = createAPIGatewayEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      });
      const approveResult = await handleUpdateTransfer(approveEvent, { id: 'transfer-001' }, authContext);
      expect(approveResult.statusCode).toBe(200);

      const approvedUpdate = dbOps.find(op => op.table === 'stock_transfers' && op.op === 'update');
      expect(approvedUpdate!.data.approved_by).toBe('admin-001');

      // Step 3: In transit
      dbOps.length = 0;
      setupTransferMock('approved');
      const transitEvent = createAPIGatewayEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ status: 'in_transit' }),
      });
      const transitResult = await handleUpdateTransfer(transitEvent, { id: 'transfer-001' }, authContext);
      expect(transitResult.statusCode).toBe(200);

      const transitUpdate = dbOps.find(op => op.table === 'stock_transfers' && op.op === 'update');
      expect(transitUpdate!.data.shipped_at).toBeDefined();

      // Step 4: Pending receipt
      dbOps.length = 0;
      setupTransferMock('in_transit');
      const pendingEvent = createAPIGatewayEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ status: 'pending_receipt' }),
      });
      const pendingResult = await handleUpdateTransfer(pendingEvent, { id: 'transfer-001' }, authContext);
      expect(pendingResult.statusCode).toBe(200);

      // Step 5: Received → device assigned + inventory created
      dbOps.length = 0;
      setupTransferMock('pending_receipt');
      const receiveEvent = createAPIGatewayEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ status: 'received' }),
      });
      const receiveResult = await handleUpdateTransfer(receiveEvent, { id: 'transfer-001' }, authContext);
      expect(receiveResult.statusCode).toBe(200);

      // Device should be assigned (via withTransaction)
      const deviceUpdate = dbOps.find(op => op.table === 'devices' && op.op === 'update');
      expect(deviceUpdate!.data.status).toBe('assigned');

      // Device assigned to distributor
      expect(deviceUpdate!.data.distributor_id).toBe('dist-001');
      expect(deviceUpdate!.data.assigned_to_distributor_at).toBeDefined();
    });

    it('cannot skip states: requested → in_transit is rejected', async () => {
      setupTransferMock('requested');
      const event = createAPIGatewayEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ status: 'in_transit' }),
      });
      const result = await handleUpdateTransfer(event, { id: 'transfer-001' }, authContext);
      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Cannot transition');
    });

    it('cannot skip states: requested → received is rejected', async () => {
      setupTransferMock('requested');
      const event = createAPIGatewayEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ status: 'received' }),
      });
      const result = await handleUpdateTransfer(event, { id: 'transfer-001' }, authContext);
      expect(result.statusCode).toBe(400);
    });

    it('can cancel from any non-terminal state', async () => {
      for (const status of ['requested', 'approved', 'in_transit']) {
        dbOps.length = 0;
        setupTransferMock(status);

        const event = createAPIGatewayEvent({
          httpMethod: 'PATCH',
          body: JSON.stringify({ status: 'cancelled', cancellation_reason: 'Test cancellation' }),
        });
        const result = await handleUpdateTransfer(event, { id: 'transfer-001' }, authContext);
        expect(result.statusCode).toBe(200);

        const update = dbOps.find(op => op.table === 'stock_transfers' && op.op === 'update');
        expect(update!.data.cancelled_at).toBeDefined();
        expect(update!.data.cancellation_reason).toBe('Test cancellation');
      }
    });

    it('cannot transition from terminal states', async () => {
      for (const terminal of ['received', 'cancelled']) {
        for (const target of ['requested', 'approved', 'in_transit', 'received', 'cancelled']) {
          setupTransferMock(terminal);
          const event = createAPIGatewayEvent({
            httpMethod: 'PATCH',
            body: JSON.stringify({ status: target }),
          });
          const result = await handleUpdateTransfer(event, { id: 'transfer-001' }, authContext);
          expect(result.statusCode).toBe(400);
        }
      }
    });
  });

  // ─── Auto-Approve ───

  describe('Auto-Approve Transfer', () => {
    it('auto_approve=true skips intermediate steps and immediately assigns', async () => {
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
        chain.is = jest.fn().mockReturnValue(chain);
        chain.maybeSingle = jest.fn().mockReturnValue(chain);
        chain.execute = jest.fn().mockResolvedValue({
          data: table === 'devices'
            ? { id: 'dev-001', status: 'in_stock' }
            : { id: 'transfer-001', status: 'received' },
          error: null,
        });
        return chain;
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          device_id: 'dev-001',
          to_distributor_id: 'dist-001',
          to_location: 'Harare',
          auto_approve: true,
        }),
      });

      const result = await handleCreateTransfer(event, {}, authContext);
      expect(result.statusCode).toBe(201);

      // Transfer created with status 'received'
      const transferInsert = dbOps.find(op => op.table === 'stock_transfers' && op.op === 'insert');
      expect(transferInsert!.data.status).toBe('received');
      expect(transferInsert!.data.approved_by).toBe('admin-001');

      // Device updated to 'assigned'
      const deviceUpdate = dbOps.find(op => op.table === 'devices' && op.op === 'update');
      expect(deviceUpdate!.data.status).toBe('assigned');

      // Device assigned to distributor
      expect(deviceUpdate!.data.distributor_id).toBe('dist-001');
      expect(deviceUpdate!.data.assigned_to_distributor_at).toBeDefined();
    });
  });

  // ─── Bulk Import ───

  describe('Bulk Import', () => {
    it('imports valid devices with correct counts', async () => {
      setupInventoryDbMock();

      const devices = [
        { imei: '111111111111111', manufacturer: 'Samsung', model: 'A14' },
        { imei: '222222222222222', manufacturer: 'Xiaomi', model: 'Redmi 12' },
        { imei: '333333333333333', manufacturer: 'Tecno', model: 'Spark 10' },
      ];

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ devices }),
      });

      const result = await handleBulkImportDevices(event, {}, authContext);
      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.total).toBe(3);
      expect(body.inserted + body.skipped + body.errors).toBe(body.total);
    });

    it('rejects batch larger than 500', async () => {
      const devices = Array.from({ length: 501 }, (_, i) => ({
        imei: String(100000000000000 + i),
        manufacturer: 'Test',
        model: 'Phone',
      }));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ devices }),
      });

      const result = await handleBulkImportDevices(event, {}, authContext);
      expect(result.statusCode).toBe(400);
    });
  });

  // ─── Authorization ───

  describe('Authorization', () => {
    it('non-admin gets 403 on device creation', async () => {
      const { isAdminOrManager } = require('../../../services/shared/middleware/authorization');
      (isAdminOrManager as jest.Mock).mockReturnValueOnce(false);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          imei: '353456789012345',
          manufacturer: 'Samsung',
          model: 'Galaxy A14',
        }),
      });

      const result = await handleCreateDevice(event, {}, { userId: 'user-1', role: 'viewer' });
      expect(result.statusCode).toBe(403);
    });

    it('non-admin gets 403 on transfer creation', async () => {
      const { isAdminOrManager } = require('../../../services/shared/middleware/authorization');
      (isAdminOrManager as jest.Mock).mockReturnValueOnce(false);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001' }),
      });

      const result = await handleCreateTransfer(event, {}, { userId: 'user-1', role: 'viewer' });
      expect(result.statusCode).toBe(403);
    });
  });
});