/**
 * Characterization tests for admin-service device model management routes.
 *
 * These tests capture the CURRENT behavior of the monolith handler so that
 * future refactoring can be verified against a known-good baseline.
 *
 * Routes covered:
 *   GET    /admin/device-models
 *   POST   /admin/device-models
 *   GET    /admin/device-models/:id
 *   PATCH  /admin/device-models/:id
 *   DELETE /admin/device-models/:id
 */

import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';

// ─── Mocks (must be declared before handler import) ──────────────────

const mockDb = { from: jest.fn() };
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
  withTransaction: jest.fn().mockImplementation((fn: Function) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
}));

const mockGetAuthContext = jest.fn();
const mockIsAdminOrManager = jest.fn();
jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: mockGetAuthContext,
  isAdminOrManager: mockIsAdminOrManager,
}));

jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(),
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
  getRequestContext: jest.fn().mockReturnValue({ requestId: 'test-req-id' }),
  maskImei: jest.fn((imei: string) => imei),
}));

import { handler } from '../../../services/admin-service/src/index';

// ─── Helpers ─────────────────────────────────────────────────────────

const TEST_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildMockChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
  };
  // Apply overrides (e.g. specific execute behaviour)
  for (const [key, val] of Object.entries(overrides)) {
    (chain as Record<string, unknown>)[key] = val;
  }
  return chain;
}

// ─── Test suite ──────────────────────────────────────────────────────

describe('Admin Service — Device Model Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAuthContext.mockReturnValue({
      userId: 'admin-user-1',
      email: 'admin@test.com',
      roles: ['admin'],
    });
    mockIsAdminOrManager.mockReturnValue(true);
  });

  // ═══════════════════════════════════════════════════════════════════
  // OPTIONS preflight
  // ═══════════════════════════════════════════════════════════════════

  it('OPTIONS /admin/device-models returns 204', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'OPTIONS',
      path: '/admin/device-models',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(204);
    // lambda-router returns successResponse(null, 204) which serialises a body
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /admin/device-models
  // ═══════════════════════════════════════════════════════════════════

  it('GET /admin/device-models returns paginated list', async () => {
    const rows = [
      { id: TEST_UUID, brand: 'Samsung', model_name: 'Galaxy A14', model_code: 'SM-A14' },
    ];

    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '1' }], error: null }) // count query
      .mockResolvedValueOnce({ data: rows, error: null });             // data query

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/device-models',
    });

    const result = await handler(event);
    const body = parseResponseBody(result);

    expect(result.statusCode).toBe(200);
    expect(body).toHaveProperty('success', true);
    expect((body as any).data.data).toEqual(rows);
    expect((body as any).data.total).toBe(1);
    expect((body as any).data.page).toBe(1);
    expect((body as any).data.limit).toBe(25);
    expect((body as any).data.total_pages).toBe(1);
  });

  it('GET /admin/device-models respects page and limit query params', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '50' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/device-models',
      queryStringParameters: { page: '3', limit: '10' },
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.data.page).toBe(3);
    expect(body.data.limit).toBe(10);
    expect(body.data.total_pages).toBe(5);
  });

  it('GET /admin/device-models returns 500 on DB error', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ count: '0' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'connection lost' } });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/admin/device-models',
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to fetch device models');
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /admin/device-models/:id
  // ═══════════════════════════════════════════════════════════════════

  it('GET /admin/device-models/:id returns a single device model', async () => {
    const model = { id: TEST_UUID, brand: 'Samsung', model_name: 'Galaxy A14', model_code: 'SM-A14' };

    const chain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: model, error: null }),
    });
    // maybeSingle returns the chain so .execute() can follow
    chain.maybeSingle.mockReturnValue({ execute: chain.execute });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: `/admin/device-models/${TEST_UUID}`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(model);
  });

  it('GET /admin/device-models/:id returns 404 when not found', async () => {
    const chain = buildMockChain();
    chain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: `/admin/device-models/${TEST_UUID}`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(404);
    expect(body.error).toBe('Device model not found');
  });

  // ═══════════════════════════════════════════════════════════════════
  // POST /admin/device-models
  // ═══════════════════════════════════════════════════════════════════

  it('POST /admin/device-models creates a new device model', async () => {
    const newModel = {
      brand: 'Samsung',
      model_name: 'Galaxy A14',
      model_code: 'SM-A14',
      retail_price_usd: 180,
      wholesale_price_usd: 140,
    };
    const created = { id: TEST_UUID, ...newModel };

    // First call: uniqueness check (db.from('device_models').select...maybeSingle().execute())
    const uniqueChain = buildMockChain();
    uniqueChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Second call: insert (db.from('device_models').insert(...).execute())
    const insertChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [created], error: null }),
    });

    // Third call: auditLog insert
    const auditChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockDb.from
      .mockReturnValueOnce(uniqueChain)   // uniqueness check
      .mockReturnValueOnce(insertChain)    // actual insert
      .mockReturnValueOnce(auditChain);    // audit log

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/device-models',
      body: JSON.stringify(newModel),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(TEST_UUID);
  });

  it('POST /admin/device-models returns 400 for missing required fields', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/device-models',
      body: JSON.stringify({ brand: 'Samsung' }), // missing model_name, model_code, prices
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Missing required field/);
  });

  it('POST /admin/device-models returns 409 for duplicate model_code', async () => {
    const chain = buildMockChain();
    chain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/device-models',
      body: JSON.stringify({
        brand: 'Samsung',
        model_name: 'Galaxy A14',
        model_code: 'SM-A14',
        retail_price_usd: 180,
        wholesale_price_usd: 140,
      }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(409);
    expect(body.error).toBe('A device model with this model_code already exists');
  });

  it('POST /admin/device-models returns 500 on DB insert error', async () => {
    // Uniqueness check passes
    const uniqueChain = buildMockChain();
    uniqueChain.maybeSingle.mockReturnValue({
      execute: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Insert fails
    const insertChain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: null, error: { message: 'disk full' } }),
    });

    mockDb.from
      .mockReturnValueOnce(uniqueChain)
      .mockReturnValueOnce(insertChain);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/admin/device-models',
      body: JSON.stringify({
        brand: 'Samsung',
        model_name: 'Galaxy A14',
        model_code: 'SM-A14',
        retail_price_usd: 180,
        wholesale_price_usd: 140,
      }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(500);
    expect(body.error).toBe('Failed to create device model');
  });

  // ═══════════════════════════════════════════════════════════════════
  // PATCH /admin/device-models/:id
  // ═══════════════════════════════════════════════════════════════════

  it('PATCH /admin/device-models/:id updates a device model', async () => {
    const updated = { id: TEST_UUID, brand: 'Samsung', model_name: 'Galaxy A15', is_active: true };

    const chain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [updated], error: null }),
    });
    mockDb.from
      .mockReturnValueOnce(chain)   // update
      .mockReturnValueOnce(buildMockChain({ execute: jest.fn().mockResolvedValue({ data: [], error: null }) })); // audit

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: `/admin/device-models/${TEST_UUID}`,
      body: JSON.stringify({ model_name: 'Galaxy A15' }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.model_name).toBe('Galaxy A15');
  });

  it('PATCH /admin/device-models/:id returns 404 when model not found', async () => {
    const chain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'PATCH',
      path: `/admin/device-models/${TEST_UUID}`,
      body: JSON.stringify({ model_name: 'Galaxy A15' }),
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(404);
    expect(body.error).toBe('Device model not found');
  });

  // ═══════════════════════════════════════════════════════════════════
  // DELETE /admin/device-models/:id
  // ═══════════════════════════════════════════════════════════════════

  it('DELETE /admin/device-models/:id soft-deletes a device model', async () => {
    const deleted = { id: TEST_UUID, deleted_at: '2026-01-01T00:00:00.000Z' };

    const chain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [deleted], error: null }),
    });
    mockDb.from
      .mockReturnValueOnce(chain)   // update (soft delete)
      .mockReturnValueOnce(buildMockChain({ execute: jest.fn().mockResolvedValue({ data: [], error: null }) })); // audit

    const event = createAPIGatewayEvent({
      httpMethod: 'DELETE',
      path: `/admin/device-models/${TEST_UUID}`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe('Device model deleted successfully');
  });

  it('DELETE /admin/device-models/:id returns 404 when model not found', async () => {
    const chain = buildMockChain({
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockDb.from.mockReturnValue(chain);

    const event = createAPIGatewayEvent({
      httpMethod: 'DELETE',
      path: `/admin/device-models/${TEST_UUID}`,
    });

    const result = await handler(event);
    const body = parseResponseBody(result) as any;

    expect(result.statusCode).toBe(404);
    expect(body.error).toBe('Device model not found');
  });
});
