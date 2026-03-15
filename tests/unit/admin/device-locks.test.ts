/**
 * Unit tests for Admin Service — Device Lock handlers
 *
 * Tests: GET lock-history, POST lock, POST unlock, PATCH status
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
}));

// Mock the audit log helper — define fn inside factory to avoid hoisting issues
jest.mock('../../../services/admin-service/src/handlers/helpers', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  COGNITO_ADMIN_ROLES: ['super_admin', 'admin'],
  mapAdminUser: jest.fn((row: Record<string, unknown>) => row),
  maskPhone: jest.fn((p: string) => p),
  mapActionToEventType: jest.fn(() => 'update'),
  hashNationalId: jest.fn((id: string) => 'hashed_' + id),
}));

import { handler } from '../../../services/admin-service/src/index';

// Get reference to mocked auditLog after jest.mock is applied
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

function makeEvent(method: string, path: string, body?: Record<string, unknown>) {
  return createAPIGatewayEvent({
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
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

// ─── Authorization ───────────────────────────────────────────────────

describe('Device locks authorization', () => {
  it('should return 403 on lock-history for non-admin', async () => {
    mockIsAdminOrManager.mockReturnValue(false);
    const res = await handler(makeEvent('GET', '/admin/devices/dev-1/lock-history'));
    expect(res.statusCode).toBe(403);
  });

  it('should return 403 on lock for non-admin', async () => {
    mockIsAdminOrManager.mockReturnValue(false);
    const res = await handler(makeEvent('POST', '/admin/devices/dev-1/lock'));
    expect(res.statusCode).toBe(403);
  });

  it('should return 403 on unlock for non-admin', async () => {
    mockIsAdminOrManager.mockReturnValue(false);
    const res = await handler(makeEvent('POST', '/admin/devices/dev-1/unlock'));
    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /admin/devices/:id/lock-history ─────────────────────────────

describe('GET /admin/devices/:id/lock-history', () => {
  it('should return lock history ordered by created_at DESC', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1' } }); // device exists
    mockQuery.mockResolvedValueOnce({
      data: [
        { id: 'lock-2', action: 'unlock', created_at: '2025-03-15T10:00:00Z' },
        { id: 'lock-1', action: 'lock', created_at: '2025-03-14T10:00:00Z' },
      ],
      error: null,
    });

    const res = await handler(makeEvent('GET', '/admin/devices/dev-1/lock-history'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data).toHaveLength(2);
  });

  it('should return 404 when device not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null });
    const res = await handler(makeEvent('GET', '/admin/devices/nonexistent/lock-history'));
    expect(res.statusCode).toBe(404);
  });

  it('should return 500 on DB error', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1' } });
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const res = await handler(makeEvent('GET', '/admin/devices/dev-1/lock-history'));
    expect(res.statusCode).toBe(500);
  });
});

// ─── POST /admin/devices/:id/lock ────────────────────────────────────

describe('POST /admin/devices/:id/lock', () => {
  it('should lock device successfully', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1', lock_status: 'unlocked', customer_id: 'cust-1' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'dev-1' }], error: null }); // update
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'lock-1' } }); // insert lock record

    const res = await handler(makeEvent('POST', '/admin/devices/dev-1/lock', { reason: 'Payment overdue' }));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.message).toContain('locked');
  });

  it('should return 404 when device not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null });
    const res = await handler(makeEvent('POST', '/admin/devices/nonexistent/lock', { reason: 'test' }));
    expect(res.statusCode).toBe(404);
  });

  it('should return 409 when already locked', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1', lock_status: 'locked', customer_id: 'cust-1' } });
    const res = await handler(makeEvent('POST', '/admin/devices/dev-1/lock', { reason: 'test' }));
    expect(res.statusCode).toBe(409);
  });

  it('should insert audit log on lock', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1', lock_status: 'unlocked', customer_id: 'cust-1' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'dev-1' }], error: null });
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'lock-1' } });

    await handler(makeEvent('POST', '/admin/devices/dev-1/lock', { reason: 'Overdue 60 days' }));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(), 'device.lock', 'device', 'dev-1',
      expect.stringContaining('locked'), expect.any(Object)
    );
  });
});

// ─── POST /admin/devices/:id/unlock ──────────────────────────────────

describe('POST /admin/devices/:id/unlock', () => {
  it('should unlock device successfully', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1', lock_status: 'locked', customer_id: 'cust-1' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'dev-1' }], error: null });
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'lock-2' } });

    const res = await handler(makeEvent('POST', '/admin/devices/dev-1/unlock', { reason: 'Payment received' }));
    expect(res.statusCode).toBe(200);
  });

  it('should return 409 when already unlocked', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1', lock_status: 'unlocked', customer_id: 'cust-1' } });
    const res = await handler(makeEvent('POST', '/admin/devices/dev-1/unlock', { reason: 'test' }));
    expect(res.statusCode).toBe(409);
  });

  it('should insert audit log on unlock', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1', lock_status: 'locked', customer_id: 'cust-1' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'dev-1' }], error: null });
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'lock-2' } });

    await handler(makeEvent('POST', '/admin/devices/dev-1/unlock', { reason: 'Payment received' }));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(), 'device.unlock', 'device', 'dev-1',
      expect.stringContaining('unlocked'), expect.any(Object)
    );
  });
});

// ─── PATCH /admin/devices/:id/status ─────────────────────────────────

describe('PATCH /admin/devices/:id/status', () => {
  it('should update status to locked', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'dev-1' } });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'dev-1' }], error: null });

    const res = await handler(makeEvent('PATCH', '/admin/devices/dev-1/status', { status: 'locked' }));
    expect(res.statusCode).toBe(200);
  });

  it('should return 400 for invalid status', async () => {
    const res = await handler(makeEvent('PATCH', '/admin/devices/dev-1/status', { status: 'destroyed' }));
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when device not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null });
    const res = await handler(makeEvent('PATCH', '/admin/devices/nonexistent/status', { status: 'locked' }));
    expect(res.statusCode).toBe(404);
  });
});
