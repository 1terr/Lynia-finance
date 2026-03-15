/**
 * Characterization tests for Admin Service — Inventory Management routes
 *
 * These tests capture the CURRENT behavior of the monolith handler before
 * refactoring. They cover device CRUD, bulk import, adjustments, transfers,
 * and inventory reports.
 *
 * Lines covered: ~1648-3022 of services/admin-service/src/index.ts
 */

import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';

// ── Mocks (must be declared before handler import) ────────────────────

const mockDb = { from: jest.fn() };
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
}));

const mockGetAuthContext = jest.fn();
const mockIsAdminOrManager = jest.fn();
jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: mockGetAuthContext,
  isAdminOrManager: mockIsAdminOrManager,
}));

const mockGetFineractClient = jest.fn();
jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: mockGetFineractClient,
}));

jest.mock('../../../services/shared/utils/response', () => {
  const actual = jest.requireActual('../../../services/shared/utils/response');
  return {
    ...actual,
    getSecurityHeaders: jest.fn().mockReturnValue({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }),
  };
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
}));

import { handler } from '../../../services/admin-service/src/index';

// ── DB mock chain ──────────────────────────────────────────────────────
// All chain methods (select, eq, maybeSingle, etc.) return `this` so
// they can be chained freely.  The terminal call is always `.execute()`
// which returns a Promise<{data, error}>.  Individual tests set up
// `mockChain.execute` with `.mockResolvedValueOnce(...)` to control
// what each sequential `.execute()` call returns.

const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
};

// ── Setup ──────────────────────────────────────────────────────────────

function resetChain() {
  for (const key of Object.keys(mockChain) as Array<keyof typeof mockChain>) {
    if (key === 'execute') {
      mockChain.execute.mockResolvedValue({ data: null, error: null });
    } else {
      (mockChain[key] as jest.Mock).mockReturnThis();
    }
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthContext.mockReturnValue({
    userId: 'admin-user-1',
    email: 'admin@test.com',
    roles: ['admin'],
  });
  mockIsAdminOrManager.mockReturnValue(true);
  resetChain();
  mockDb.from.mockReturnValue(mockChain);
});

// =====================================================================
// OPTIONS preflight
// =====================================================================

describe('OPTIONS preflight', () => {
  it('should return 204 for OPTIONS request', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'OPTIONS',
      path: '/admin/devices',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(204);
  });
});

// =====================================================================
// GET /admin/devices  (uses raw query() — not db.from chain)
// =====================================================================

describe('GET /admin/devices', () => {
  it('should list devices with default pagination', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '2' }], error: null })
      .mockResolvedValueOnce({
        data: [
          { id: 'de00000000000001', imei: '123456789012345', manufacturer: 'Samsung', model: 'A14' },
          { id: 'de00000000000002', imei: '123456789012346', manufacturer: 'Tecno', model: 'Spark' },
        ],
        error: null,
      });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices',
    });
    const result = await handler(event);
    const body = parseResponseBody<{ success: boolean; data: { data: unknown[]; total: number; page: number; limit: number } }>(result);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(2);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(25);
  });

  it('should return 403 when user is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });

  it('should return 500 when DB query fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '0' }], error: null })
      .mockResolvedValueOnce({ data: [], error: { message: 'Connection failed' } });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
  });
});

// =====================================================================
// POST /admin/devices (create)
// Handler flow:
//   1. db.from('devices').select().eq().maybeSingle().execute()  → IMEI check
//   2. db.from('devices').insert(data).execute()                 → insert
//   3. db.from('audit_log').insert(data).execute()               → audit
// =====================================================================

describe('POST /admin/devices', () => {
  it('should create a device with valid data', async () => {
    const deviceData = {
      imei: '123456789012345',
      manufacturer: 'Samsung',
      model: 'Galaxy A14',
    };

    mockChain.execute
      .mockResolvedValueOnce({ data: null, error: null })                                       // IMEI uniqueness → no dup
      .mockResolvedValueOnce({ data: [{ id: 'de00000000000099', ...deviceData, status: 'in_stock' }], error: null }) // insert
      .mockResolvedValueOnce({ data: [], error: null });                                         // audit log

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices',
      body: JSON.stringify(deviceData),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(201);

    const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);
    expect(body.success).toBe(true);
  });

  it('should return 400 when IMEI is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices',
      body: JSON.stringify({ manufacturer: 'Samsung', model: 'A14' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string; details: { code: string } }>(result);
    expect(body.error).toContain('imei');
  });

  it('should return 400 when IMEI format is invalid (not 15 digits)', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices',
      body: JSON.stringify({ imei: '12345', manufacturer: 'Samsung', model: 'A14' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('IMEI');
  });

  it('should return 400 when IMEI contains non-digit characters', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices',
      body: JSON.stringify({ imei: '12345678901234a', manufacturer: 'Samsung', model: 'A14' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when manufacturer is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices',
      body: JSON.stringify({ imei: '123456789012345', model: 'A14' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('manufacturer');
  });

  it('should return 400 when model is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices',
      body: JSON.stringify({ imei: '123456789012345', manufacturer: 'Samsung' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('model');
  });

  it('should return 409 when IMEI already exists (from DB check)', async () => {
    // execute for maybeSingle returns existing device
    mockChain.execute.mockResolvedValueOnce({ data: { id: 'existing-dev' }, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices',
      body: JSON.stringify({ imei: '123456789012345', manufacturer: 'Samsung', model: 'A14' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(409);
  });
});

// =====================================================================
// POST /admin/devices/bulk-import
// For each device: maybeSingle().execute() for dup check + insert().execute()
// =====================================================================

describe('POST /admin/devices/bulk-import', () => {
  it('should bulk import valid devices', async () => {
    // For each device: dup-check execute (null = no dup) + insert execute
    // Two devices = 4 execute calls + 1 audit log execute
    mockChain.execute.mockResolvedValue({ data: null, error: null });

    const devices = [
      { imei: '111111111111111', manufacturer: 'Samsung', model: 'A14' },
      { imei: '222222222222222', manufacturer: 'Tecno', model: 'Spark' },
    ];

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices/bulk-import',
      body: JSON.stringify({ devices }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { total: number; inserted: number; skipped: number; errors: number } }>(result);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(2);
  });

  it('should return 400 when devices array is empty', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices/bulk-import',
      body: JSON.stringify({ devices: [] }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when devices is not an array', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices/bulk-import',
      body: JSON.stringify({ devices: 'not-an-array' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when more than 500 devices', async () => {
    const devices = Array.from({ length: 501 }, (_, i) => ({
      imei: String(i).padStart(15, '0'),
      manufacturer: 'Samsung',
      model: 'A14',
    }));

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices/bulk-import',
      body: JSON.stringify({ devices }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('500');
  });

  it('should report errors for devices with invalid IMEI in bulk import', async () => {
    // Second device's dup-check + insert still go through execute
    mockChain.execute.mockResolvedValue({ data: null, error: null });

    const devices = [
      { imei: 'bad-imei', manufacturer: 'Samsung', model: 'A14' },
      { imei: '333333333333333', manufacturer: 'Samsung', model: 'A14' },
    ];

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/devices/bulk-import',
      body: JSON.stringify({ devices }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { errors: number; inserted: number; error_details: unknown[] } }>(result);
    expect(body.data.errors).toBe(1);
  });
});

// =====================================================================
// GET /admin/devices/stats  (uses raw query())
// =====================================================================

describe('GET /admin/devices/stats', () => {
  it('should return device inventory stats', async () => {
    mockQuery
      .mockResolvedValueOnce({
        data: [
          { status: 'in_stock', count: '10' },
          { status: 'sold', count: '5' },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ count: '3' }],
        error: null,
      });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices/stats',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: Record<string, number> }>(result);
    expect(body.success).toBe(true);
    expect(body.data.in_stock).toBe(10);
    expect(body.data.sold).toBe(5);
    expect(body.data.locked).toBe(3);
  });
});

// =====================================================================
// GET /admin/devices/:id  (uses raw query())
// =====================================================================

describe('GET /admin/devices/:id', () => {
  it('should return a device by id', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [{ id: 'abc-123', imei: '123456789012345', manufacturer: 'Samsung' }],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices/abc-123',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it('should return 404 when device not found', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices/abc-999',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });
});

// =====================================================================
// PATCH /admin/devices/:id
// Handler flow:
//   1. db.from('devices').update(data).eq().is().execute()  → update
//   2. db.from('audit_log').insert(data).execute()          → audit
// =====================================================================

describe('PATCH /admin/devices/:id', () => {
  it('should update a device with valid fields', async () => {
    mockChain.execute
      .mockResolvedValueOnce({
        data: [{ id: 'de00000000000001', status: 'assigned', manufacturer: 'Samsung' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null }); // audit log

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/devices/de00000000000001',
      body: JSON.stringify({ status: 'assigned', location: 'Bulawayo' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it('should return 400 for invalid device status', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/devices/de00000000000001',
      body: JSON.stringify({ status: 'totally_invalid_status' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 404 when device not found on update', async () => {
    // execute returns empty array → row = undefined → 404
    mockChain.execute.mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/devices/face000000000099',
      body: JSON.stringify({ location: 'Mutare' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });
});

// =====================================================================
// GET /admin/devices/:id/movements  (uses raw query())
// =====================================================================

describe('GET /admin/devices/:id/movements', () => {
  it('should return device movement history', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '5' }], error: null })
      .mockResolvedValueOnce({
        data: [
          { id: 'mov-1', device_id: 'de00000000000001', movement_type: 'transfer' },
        ],
        error: null,
      });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices/de00000000000001/movements',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { data: unknown[]; total: number } }>(result);
    expect(body.data.total).toBe(5);
  });

  it('should return 500 on DB error', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '0' }], error: null })
      .mockResolvedValueOnce({ data: [], error: { message: 'DB error' } });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/devices/de00000000000001/movements',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
  });
});

// =====================================================================
// GET /admin/inventory/adjustments  (uses raw query())
// =====================================================================

describe('GET /admin/inventory/adjustments', () => {
  it('should list adjustments with default pagination', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '3' }], error: null })
      .mockResolvedValueOnce({
        data: [
          { id: 'ad00000000000001', adjustment_type: 'damage', approval_status: 'pending' },
        ],
        error: null,
      });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/inventory/adjustments',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { data: unknown[]; total: number } }>(result);
    expect(body.data.total).toBe(3);
  });
});

// =====================================================================
// POST /admin/inventory/adjustments
// Handler flow:
//   1. db.from('devices').select().eq().is().maybeSingle().execute()   → device lookup
//   2. db.from('inventory_adjustments').insert(data).execute()         → insert
//   3. db.from('audit_log').insert(data).execute()                    → audit
// =====================================================================

describe('POST /admin/inventory/adjustments', () => {
  it('should create an adjustment for a valid device', async () => {
    mockChain.execute
      .mockResolvedValueOnce({ data: { id: 'de00000000000001', status: 'in_stock' }, error: null })        // device lookup
      .mockResolvedValueOnce({                                                                    // insert
        data: [{ id: 'adj-new-1', adjustment_type: 'damage', approval_status: 'pending' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });                                          // audit log

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments',
      body: JSON.stringify({
        device_id: 'de00000000000001',
        adjustment_type: 'damage',
        reason: 'Screen cracked during shipping',
      }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(201);
  });

  it('should return 400 when device_id is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments',
      body: JSON.stringify({ adjustment_type: 'damage', reason: 'broken' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when adjustment_type is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments',
      body: JSON.stringify({ device_id: 'de00000000000001', reason: 'broken' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 when reason is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments',
      body: JSON.stringify({ device_id: 'de00000000000001', adjustment_type: 'damage' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid adjustment_type', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments',
      body: JSON.stringify({
        device_id: 'de00000000000001',
        adjustment_type: 'invalid_type',
        reason: 'test',
      }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 404 when device not found', async () => {
    // device lookup → null
    mockChain.execute.mockResolvedValueOnce({ data: null, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments',
      body: JSON.stringify({
        device_id: 'face000000000098',
        adjustment_type: 'damage',
        reason: 'broken',
      }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });
});

// =====================================================================
// POST /admin/inventory/adjustments/:id/approve
// Handler flow:
//   1. db.from('inventory_adjustments').select().eq().eq().maybeSingle().execute()  → lookup
//   2a. (approve) db.from('devices').update().eq().execute()                        → status
//   2b. db.from('inventory_adjustments').update().eq().execute()                    → update adj
//   3. db.from('audit_log').insert(data).execute()                                 → audit
// Note: uses COGNITO_ADMIN_ROLES check, not isAdminOrManager
// =====================================================================

describe('POST /admin/inventory/adjustments/:id/approve', () => {
  it('should approve a pending adjustment', async () => {
    mockChain.execute
      .mockResolvedValueOnce({                                                                // adj lookup
        data: { id: 'ad00000000000001', device_id: 'de00000000000001', new_status: 'damaged', approval_status: 'pending' },
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });                                          // device update + adj update + audit

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/ad00000000000001/approve',
      body: JSON.stringify({ action: 'approve' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { message: string } }>(result);
    expect(body.data.message).toContain('approved');
  });

  it('should reject a pending adjustment', async () => {
    mockChain.execute
      .mockResolvedValueOnce({                                                                // adj lookup
        data: { id: 'ad00000000000002', device_id: 'de00000000000002', approval_status: 'pending' },
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });                                          // adj update + audit

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/ad00000000000002/approve',
      body: JSON.stringify({ action: 'reject', rejection_reason: 'Duplicate request' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { message: string } }>(result);
    // NOTE: Monolith has typo "rejectd" — characterization test preserves actual behavior
    expect(body.data.message).toContain('rejectd');
  });

  it('should return 400 when action is neither approve nor reject', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/ad00000000000001/approve',
      body: JSON.stringify({ action: 'maybe' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 403 when user does not have admin/super_admin role', async () => {
    // COGNITO_ADMIN_ROLES = ['super_admin', 'admin'] — 'manager' is not in list
    mockGetAuthContext.mockReturnValue({
      userId: 'manager-user-1',
      email: 'manager@test.com',
      roles: ['manager'],
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/ad00000000000001/approve',
      body: JSON.stringify({ action: 'approve' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });

  it('should return 404 when pending adjustment not found', async () => {
    // adj lookup → null
    mockChain.execute.mockResolvedValueOnce({ data: null, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/face000000000000/approve',
      body: JSON.stringify({ action: 'approve' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it('should return 500 when device status update fails during approval', async () => {
    mockChain.execute
      .mockResolvedValueOnce({                                                                // adj lookup
        data: { id: 'ad00000000000001', device_id: 'de00000000000001', new_status: 'damaged', approval_status: 'pending' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'Connection reset' } });        // device update fails

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/ad00000000000001/approve',
      body: JSON.stringify({ action: 'approve' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('device status');
  });

  it('should return 500 when adjustment approval update fails', async () => {
    mockChain.execute
      .mockResolvedValueOnce({                                                                // adj lookup
        data: { id: 'ad00000000000001', device_id: 'de00000000000001', new_status: 'damaged', approval_status: 'pending' },
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })                                       // device update succeeds
      .mockResolvedValueOnce({ data: null, error: { message: 'Deadlock detected' } });       // adj update fails

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/ad00000000000001/approve',
      body: JSON.stringify({ action: 'approve' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('approve');
  });

  it('should return 500 when adjustment rejection update fails', async () => {
    mockChain.execute
      .mockResolvedValueOnce({                                                                // adj lookup
        data: { id: 'ad00000000000002', device_id: 'de00000000000002', approval_status: 'pending' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'Write conflict' } });          // rejection update fails

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/adjustments/ad00000000000002/approve',
      body: JSON.stringify({ action: 'reject', rejection_reason: 'Duplicate' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('reject');
  });
});

// =====================================================================
// GET /admin/inventory/transfers  (uses raw query())
// =====================================================================

describe('GET /admin/inventory/transfers', () => {
  it('should list transfers with default pagination', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '10' }], error: null })
      .mockResolvedValueOnce({
        data: [
          { id: 'ff00000000000001', device_id: 'de00000000000001', status: 'requested' },
        ],
        error: null,
      });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/inventory/transfers',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { total: number } }>(result);
    expect(body.data.total).toBe(10);
  });
});

// =====================================================================
// POST /admin/inventory/transfers
// Handler flow:
//   1. db.from('devices').select().eq().is().maybeSingle().execute()   → device lookup
//   2. db.from('stock_transfers').insert(data).execute()               → insert
//   3. db.from('audit_log').insert(data).execute()                    → audit
// =====================================================================

describe('POST /admin/inventory/transfers', () => {
  it('should create a transfer for an in_stock device', async () => {
    mockChain.execute
      .mockResolvedValueOnce({ data: { id: 'de00000000000001', status: 'in_stock' }, error: null })        // device lookup
      .mockResolvedValueOnce({                                                                    // insert
        data: [{ id: 'ff00000000000099', device_id: 'de00000000000001', status: 'requested' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });                                          // audit log

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/transfers',
      body: JSON.stringify({
        device_id: 'de00000000000001',
        from_location: 'Warehouse',
        to_location: 'Bulawayo Branch',
        to_distributor_id: 'dist-1',
      }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(201);
  });

  it('should return 400 when device_id is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/transfers',
      body: JSON.stringify({ from_location: 'Warehouse' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 404 when device not found', async () => {
    mockChain.execute.mockResolvedValueOnce({ data: null, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/transfers',
      body: JSON.stringify({ device_id: 'face000000000098' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it('should return 400 when device status is not transferable', async () => {
    mockChain.execute.mockResolvedValueOnce({ data: { id: 'de00000000000001', status: 'damaged' }, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/inventory/transfers',
      body: JSON.stringify({ device_id: 'de00000000000001' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});

// =====================================================================
// PATCH /admin/inventory/transfers/:id (state machine)
// Handler flow:
//   1. db.from('stock_transfers').select().eq().maybeSingle().execute()  → lookup
//   2. (if received + to_distributor_id) db.from('devices').update().eq().execute()
//   3. (if received + to_distributor_id) db.from('agent_inventory').insert().execute()
//   4. db.from('stock_transfers').update().eq().execute()                → update
//   5. db.from('audit_log').insert(data).execute()                      → audit
// =====================================================================

describe('PATCH /admin/inventory/transfers/:id', () => {
  it('should transition from requested to approved', async () => {
    mockChain.execute
      .mockResolvedValueOnce({
        data: { id: 'ff00000000000001', device_id: 'de00000000000001', status: 'requested' },
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/inventory/transfers/ff00000000000001',
      body: JSON.stringify({ status: 'approved' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { message: string } }>(result);
    expect(body.data.message).toContain('approved');
  });

  it('should transition from approved to in_transit', async () => {
    mockChain.execute
      .mockResolvedValueOnce({
        data: { id: 'ff00000000000001', device_id: 'de00000000000001', status: 'approved' },
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/inventory/transfers/ff00000000000001',
      body: JSON.stringify({ status: 'in_transit' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it('should transition from in_transit to received and update device location', async () => {
    mockChain.execute
      .mockResolvedValueOnce({
        data: {
          id: 'ff00000000000001',
          device_id: 'de00000000000001',
          status: 'in_transit',
          to_distributor_id: 'dist-1',
          to_location: 'Bulawayo Branch',
        },
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/inventory/transfers/ff00000000000001',
      body: JSON.stringify({ status: 'received' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    // Verify device update and agent_inventory insert were called
    expect(mockDb.from).toHaveBeenCalledWith('devices');
    expect(mockDb.from).toHaveBeenCalledWith('agent_inventory');
  });

  it('should reject invalid state transition (requested -> received)', async () => {
    mockChain.execute.mockResolvedValueOnce({
      data: { id: 'ff00000000000001', device_id: 'de00000000000001', status: 'requested' },
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/inventory/transfers/ff00000000000001',
      body: JSON.stringify({ status: 'received' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('Cannot transition');
  });

  it('should return 404 when transfer not found', async () => {
    mockChain.execute.mockResolvedValueOnce({ data: null, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: '/admin/inventory/transfers/face000000000000',
      body: JSON.stringify({ status: 'approved' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });
});

// =====================================================================
// GET /admin/reports/inventory
// KNOWN BUG: handler accesses .rows on query() return, but query()
// returns {data, error} — so .rows is undefined.
// =====================================================================

describe('GET /admin/reports/inventory', () => {
  it('should return inventory report with by_model, totals, and aging', async () => {
    mockQuery.mockResolvedValue({ data: [{ device_model_id: 1, manufacturer: 'Samsung' }], error: null });
    mockQueryOne.mockResolvedValue({ data: { total_devices: 10 }, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/reports/inventory',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { by_model: unknown[]; aging: unknown[]; generated_at: string } }>(result);
    expect(body.data.by_model).toEqual([{ device_model_id: 1, manufacturer: 'Samsung' }]);
    expect(body.data.aging).toEqual([{ device_model_id: 1, manufacturer: 'Samsung' }]);
    expect(body.data.generated_at).toBeDefined();
  });
});

// =====================================================================
// GET /admin/reports/inventory/movements
// =====================================================================

describe('GET /admin/reports/inventory/movements', () => {
  it('should return movements report with by_type, daily, and recent', async () => {
    mockQuery.mockResolvedValue({ data: [{ movement_type: 'transfer', count: 5 }], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/reports/inventory/movements',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { by_type: unknown[]; daily: unknown[]; recent: unknown[]; period_days: number } }>(result);
    expect(body.data.by_type).toEqual([{ movement_type: 'transfer', count: 5 }]);
    expect(body.data.daily).toEqual([{ movement_type: 'transfer', count: 5 }]);
    expect(body.data.recent).toEqual([{ movement_type: 'transfer', count: 5 }]);
    expect(body.data.period_days).toBe(30);
  });
});

// =====================================================================
// GET /admin/reports/inventory/low-stock
// =====================================================================

describe('GET /admin/reports/inventory/low-stock', () => {
  it('should return low stock and out of stock models', async () => {
    mockQuery.mockResolvedValue({ data: [{ id: 1, manufacturer: 'Samsung', available_stock: 2 }], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/reports/inventory/low-stock',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { low_stock_models: unknown[]; out_of_stock_models: unknown[]; total_low_stock: number; total_out_of_stock: number } }>(result);
    expect(body.data.low_stock_models).toHaveLength(1);
    expect(body.data.out_of_stock_models).toHaveLength(1);
    expect(body.data.total_low_stock).toBe(1);
    expect(body.data.total_out_of_stock).toBe(1);
  });
});
