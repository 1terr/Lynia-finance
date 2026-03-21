/**
 * Unit tests for Admin Service — Customer Update handler
 *
 * Tests: PATCH /api/v1/customers/:id
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
  withTransaction: jest.fn().mockImplementation((fn: (...args: any[]) => any) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
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

describe('PATCH /api/v1/customers/:id', () => {
  it('should update allowed fields', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'cust-1' }], error: null });

    const res = await handler(makeEvent('PATCH', '/api/v1/customers/cust-1', {
      first_name: 'Updated',
      last_name: 'Name',
      email: 'new@example.com',
    }));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.message).toContain('updated');
  });

  it('should reject disallowed fields (id, credit_score, kyc_status)', async () => {
    // When ONLY disallowed fields are sent, should return 400
    const res = await handler(makeEvent('PATCH', '/api/v1/customers/cust-1', {
      id: 'hacked-id',
      credit_score: 999,
      kyc_status: 'verified',
    }));
    expect(res.statusCode).toBe(400);
    const body = parseResponseBody(res);
    expect((body as any).error).toContain('No valid fields');
  });

  it('should strip disallowed fields but process allowed ones', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'cust-1' }], error: null });

    const res = await handler(makeEvent('PATCH', '/api/v1/customers/cust-1', {
      first_name: 'ValidName',
      id: 'hacked-id',
      credit_score: 999,
    }));
    // Should succeed because first_name is valid
    expect(res.statusCode).toBe(200);
    // The SQL should only contain first_name, not id or credit_score
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('first_name'),
      expect.any(Array)
    );
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('credit_score'),
      expect.any(Array)
    );
  });

  it('should return 404 when customer not found', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });
    const res = await handler(makeEvent('PATCH', '/api/v1/customers/nonexistent', {
      first_name: 'Test',
    }));
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 for empty update body', async () => {
    const res = await handler(makeEvent('PATCH', '/api/v1/customers/cust-1', {}));
    expect(res.statusCode).toBe(400);
  });

  it('should insert audit log on success', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'cust-1' }], error: null });

    await handler(makeEvent('PATCH', '/api/v1/customers/cust-1', {
      first_name: 'NewName',
    }));

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(), 'customer.update', 'customer', 'cust-1',
      expect.any(String), expect.objectContaining({ first_name: 'NewName' })
    );
  });

  it('should return 500 with generic message on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));
    const res = await handler(makeEvent('PATCH', '/api/v1/customers/cust-1', {
      first_name: 'Test',
    }));
    expect(res.statusCode).toBe(500);
    const body = parseResponseBody(res);
    expect((body as any).error).not.toContain('Connection refused');
  });

  it('should return 403 for non-admin', async () => {
    mockIsAdminOrManager.mockReturnValue(false);
    const res = await handler(makeEvent('PATCH', '/api/v1/customers/cust-1', {
      first_name: 'Test',
    }));
    expect(res.statusCode).toBe(403);
  });
});
