/**
 * Unit tests for Admin Service — Device Handover handlers
 *
 * Tests: GET /admin/devices/handovers, PATCH /admin/devices/handovers/:id
 */

import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';

// ── Mocks ────────────────────────────────────────────────────────────

const mockDb = { from: jest.fn() };
const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: mockQuery,
  queryOne: mockQueryOne,
  withTransaction: jest.fn().mockImplementation((fn: Function) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
}));

const mockIsAdminOrManager = jest.fn();
const mockGetAuthContext = jest.fn().mockReturnValue({
  userId: 'admin-001',
  email: 'admin@lynia.co.zw',
  roles: ['admin'],
});
jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: mockGetAuthContext,
  isAdminOrManager: mockIsAdminOrManager,
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

jest.mock('../../../services/admin-service/src/handlers/helpers', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  COGNITO_ADMIN_ROLES: ['super_admin', 'admin'],
  mapAdminUser: jest.fn((row: Record<string, unknown>) => row),
  maskPhone: jest.fn((p: string) => p),
  mapActionToEventType: jest.fn(() => 'update'),
  hashNationalId: jest.fn((id: string) => 'hashed_' + id),
}));

import { handler } from '../../../services/admin-service/src/index';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockAuditLog = require('../../../services/admin-service/src/handlers/helpers').auditLog as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────

const adminAuth = {
  authorizer: {
    claims: {
      sub: 'admin-001',
      email: 'admin@lynia.co.zw',
      'cognito:groups': 'admin',
    },
  },
};

function makeEvent(method: string, path: string, opts: { qs?: Record<string, string>; body?: Record<string, unknown> } = {}) {
  return createAPIGatewayEvent({
    httpMethod: method,
    path,
    body: opts.body ? JSON.stringify(opts.body) : null,
    queryStringParameters: opts.qs || null,
    requestContext: { ...createAPIGatewayEvent().requestContext, ...adminAuth },
  });
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();
  mockIsAdminOrManager.mockReturnValue(true);
  mockGetAuthContext.mockReturnValue({
    userId: 'admin-001',
    email: 'admin@lynia.co.zw',
    roles: ['admin'],
  });
  mockAuditLog.mockResolvedValue(undefined);
});

// ─── GET /admin/devices/handovers ────────────────────────────────────

describe('GET /admin/devices/handovers', () => {
  it('should return paginated handovers with JOINs', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '2' } }); // count
    mockQuery.mockResolvedValueOnce({
      data: [
        { id: 'h-1', status: 'completed', customer: { id: 'c-1', first_name: 'John' } },
        { id: 'h-2', status: 'initiated', customer: { id: 'c-2', first_name: 'Jane' } },
      ],
      error: null,
    });

    const res = await handler(makeEvent('GET', '/admin/devices/handovers'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.data).toHaveLength(2);
    expect((body as any).data.total).toBe(2);
    expect((body as any).data.total_pages).toBe(1);
  });

  it('should filter by status', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'h-1', status: 'completed' }], error: null });

    const res = await handler(makeEvent('GET', '/admin/devices/handovers', {
      qs: { status: 'completed' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('should search by customer name', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'h-1' }], error: null });

    const res = await handler(makeEvent('GET', '/admin/devices/handovers', {
      qs: { search: 'John' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('should return 403 for non-admin', async () => {
    mockIsAdminOrManager.mockReturnValue(false);
    const res = await handler(makeEvent('GET', '/admin/devices/handovers'));
    expect(res.statusCode).toBe(403);
  });

  it('should return 500 on query error', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('Connection lost'));
    const res = await handler(makeEvent('GET', '/admin/devices/handovers'));
    expect(res.statusCode).toBe(500);
    const body = parseResponseBody(res);
    expect((body as any).error).not.toContain('Connection lost');
  });
});

// ─── PATCH /admin/devices/handovers/:id ──────────────────────────────

describe('PATCH /admin/devices/handovers/:id', () => {
  it('should update handover status', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'h-1', status: 'initiated' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'h-1' }], error: null });

    const res = await handler(makeEvent('PATCH', '/admin/devices/handovers/h-1', {
      body: { status: 'completed', notes: 'All good' },
    }));
    expect(res.statusCode).toBe(200);
  });

  it('should return 404 when handover not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null });
    const res = await handler(makeEvent('PATCH', '/admin/devices/handovers/nonexistent', {
      body: { status: 'completed' },
    }));
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 for missing status', async () => {
    const res = await handler(makeEvent('PATCH', '/admin/devices/handovers/h-1', {
      body: {},
    }));
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for invalid status', async () => {
    const res = await handler(makeEvent('PATCH', '/admin/devices/handovers/h-1', {
      body: { status: 'invalid_status' },
    }));
    expect(res.statusCode).toBe(400);
  });

  it('should set completed_at when status is completed', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'h-1', status: 'device_inspected' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'h-1' }], error: null });

    const res = await handler(makeEvent('PATCH', '/admin/devices/handovers/h-1', {
      body: { status: 'completed' },
    }));
    expect(res.statusCode).toBe(200);
    // The SQL should include completed_at — verified by the mock call
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('completed_at'),
      expect.any(Array)
    );
  });
});
