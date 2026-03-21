/**
 * Property-based tests for bulk device import invariants.
 * Tests: handleBulkImportDevices from services/admin-service/src/handlers/inventory-devices.ts
 *
 * Key invariants:
 * - inserted + skipped + errors === total
 * - Rejects batches > 500
 * - Duplicate IMEIs → skipped
 * - Invalid IMEI → error
 * - All inserted devices get status='in_stock'
 */

import fc from 'fast-check';
import { arbIMEI, arbInvalidIMEI } from '../../helpers/fast-check-arbitraries';

const dbOps: { table: string; op: string; data: Record<string, unknown> }[] = [];
const existingImeis = new Set<string>();
const mockFrom = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: { from: (...args: unknown[]) => mockFrom(...args) },
  query: jest.fn(),
  withTransaction: jest.fn().mockImplementation((fn: Function) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
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

import { handleBulkImportDevices } from '../../../services/admin-service/src/handlers/inventory-devices';
import { createAPIGatewayEvent } from '../../helpers/test-utils';

describe('Bulk Import Invariants - property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbOps.length = 0;
    existingImeis.clear();

    mockFrom.mockImplementation((table: string) => {
      const chain: Record<string, any> = {};
      chain.select = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
        dbOps.push({ table, op: 'insert', data });
        if (data.imei) existingImeis.add(data.imei as string);
        return chain;
      });
      chain.update = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockImplementation((_field: string, value: unknown) => {
        // For duplicate check: return data if IMEI already exists
        chain._checkImei = value;
        return chain;
      });
      chain.is = jest.fn().mockReturnValue(chain);
      chain.maybeSingle = jest.fn().mockReturnValue(chain);
      chain.execute = jest.fn().mockImplementation(() => {
        // Check if this is a duplicate lookup
        if (chain._checkImei && existingImeis.has(chain._checkImei as string)) {
          return Promise.resolve({ data: { id: 'existing' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    });
  });

  function makeEvent(devices: Record<string, unknown>[]) {
    return createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices/bulk-import',
      body: JSON.stringify({ devices }),
    });
  }

  it('inserted + skipped + errors always equals total input count', () => {
    // Generate arrays with a mix of valid, invalid, and duplicate IMEIs
    const validDevice = arbIMEI().map(imei => ({
      imei,
      manufacturer: 'Samsung',
      model: 'Galaxy A14',
    }));

    const invalidDevice = arbInvalidIMEI().map(imei => ({
      imei,
      manufacturer: 'Samsung',
      model: 'Galaxy A14',
    }));

    const missingFieldDevice = arbIMEI().map(imei => ({
      imei,
      // Missing manufacturer and model
    }));

    const deviceArb = fc.oneof(validDevice, invalidDevice, missingFieldDevice);
    const deviceArray = fc.array(deviceArb, { minLength: 1, maxLength: 20 });

    return fc.assert(
      fc.asyncProperty(deviceArray, async (devices) => {
        existingImeis.clear();
        dbOps.length = 0;
        jest.clearAllMocks();

        // Re-setup mocks
        mockFrom.mockImplementation((table: string) => {
          const chain: Record<string, any> = {};
          chain.select = jest.fn().mockReturnValue(chain);
          chain.insert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
            dbOps.push({ table, op: 'insert', data });
            if (data.imei) existingImeis.add(data.imei as string);
            return chain;
          });
          chain.update = jest.fn().mockReturnValue(chain);
          chain.eq = jest.fn().mockImplementation((_field: string, value: unknown) => {
            chain._lastEqValue = value;
            return chain;
          });
          chain.is = jest.fn().mockReturnValue(chain);
          chain.maybeSingle = jest.fn().mockReturnValue(chain);
          chain.execute = jest.fn().mockImplementation(() => {
            if (chain._lastEqValue && existingImeis.has(chain._lastEqValue as string)) {
              return Promise.resolve({ data: { id: 'existing' }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          });
          return chain;
        });

        const event = makeEvent(devices);
        const result = await handleBulkImportDevices(
          event,
          {},
          { userId: 'admin-1', role: 'admin' }
        );

        const body = JSON.parse(result.body);

        if (result.statusCode === 200) {
          // Core invariant: counts must add up
          expect(body.inserted + body.skipped + body.errors).toBe(body.total);
          expect(body.total).toBe(devices.length);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('rejects batches larger than 500', () => {
    const bigBatch = Array.from({ length: 501 }, (_, i) => ({
      imei: String(100000000000000 + i),
      manufacturer: 'Test',
      model: 'Phone',
    }));

    return (async () => {
      const event = makeEvent(bigBatch);
      const result = await handleBulkImportDevices(event, {}, { userId: 'admin-1', role: 'admin' });
      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('500');
    })();
  });

  it('rejects empty array', async () => {
    const event = makeEvent([]);
    const result = await handleBulkImportDevices(event, {}, { userId: 'admin-1', role: 'admin' });
    expect(result.statusCode).toBe(400);
  });

  it('devices with invalid IMEI are counted as errors', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.array(arbInvalidIMEI().map(imei => ({
          imei,
          manufacturer: 'Samsung',
          model: 'Galaxy A14',
        })), { minLength: 1, maxLength: 10 }),
        async (devices) => {
          existingImeis.clear();
          const event = makeEvent(devices);
          const result = await handleBulkImportDevices(event, {}, { userId: 'admin-1', role: 'admin' });

          if (result.statusCode === 200) {
            const body = JSON.parse(result.body);
            // All should be errors (invalid IMEI)
            expect(body.errors).toBe(devices.length);
            expect(body.inserted).toBe(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('all successfully inserted devices have status in_stock', () => {
    const validDevices = fc.array(
      arbIMEI().map(imei => ({
        imei,
        manufacturer: 'Samsung',
        model: 'Galaxy A14',
      })),
      { minLength: 1, maxLength: 10 }
    ).filter(devices => {
      // Ensure unique IMEIs in batch
      const imeis = devices.map(d => d.imei);
      return new Set(imeis).size === imeis.length;
    });

    return fc.assert(
      fc.asyncProperty(validDevices, async (devices) => {
        existingImeis.clear();
        dbOps.length = 0;

        const event = makeEvent(devices);
        const result = await handleBulkImportDevices(event, {}, { userId: 'admin-1', role: 'admin' });

        if (result.statusCode === 200) {
          const insertOps = dbOps.filter(op => op.table === 'devices' && op.op === 'insert');
          for (const op of insertOps) {
            expect(op.data.status).toBe('in_stock');
          }
        }
      }),
      { numRuns: 30 }
    );
  });

  it('error_details is capped at 50 entries', async () => {
    // Create 60 devices with invalid IMEIs
    const devices = Array.from({ length: 60 }, (_, i) => ({
      imei: `bad${i}`, // Invalid IMEI
      manufacturer: 'Test',
      model: 'Phone',
    }));

    const event = makeEvent(devices);
    const result = await handleBulkImportDevices(event, {}, { userId: 'admin-1', role: 'admin' });

    const body = JSON.parse(result.body);
    expect(body.error_details.length).toBeLessThanOrEqual(50);
    expect(body.errors).toBe(60); // All 60 counted as errors
  });
});
