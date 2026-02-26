/**
 * Characterization tests for admin-service user management routes.
 *
 * Routes covered:
 *   GET    /admin/me
 *   GET    /admin/users
 *   POST   /admin/users
 *   GET    /admin/users/:id
 *   PATCH  /admin/users/:id
 *
 * These tests capture the current monolith behavior BEFORE refactoring.
 */

// ─── Mocks (must be before imports) ───

const mockDb = {
  from: jest.fn(),
};
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
}));

// ─── Imports ───

import { handler } from '../../../services/admin-service/src/index';
import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';

// ─── Helpers ───

function buildEvent(overrides: Record<string, unknown> = {}) {
  const base = createAPIGatewayEvent(overrides as never);
  return {
    ...base,
    requestContext: {
      ...base.requestContext,
      authorizer: {
        claims: {
          sub: 'admin-user-1',
          email: 'admin@test.com',
          'cognito:groups': 'admin',
        },
      },
    },
    ...(overrides as object),
  };
}

function chainableMock(terminalData: { data: unknown; error: unknown } | null = null) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'is', 'gte', 'lte', 'order', 'limit',
    'single', 'maybeSingle',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = jest.fn().mockResolvedValue(terminalData ?? { data: [], error: null });
  return chain;
}

// ─── Tests ───

describe('Admin Service — User Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockReturnValue({
      userId: 'admin-user-1',
      email: 'admin@test.com',
      roles: ['admin'],
    });
    mockIsAdminOrManager.mockReturnValue(true);
  });

  // ═══════════════════════════════════════════
  // GET /admin/me
  // ═══════════════════════════════════════════

  describe('GET /admin/me', () => {
    it('should return DB user when found', async () => {
      const dbRow = {
        id: 'user-abc-123',
        email: 'admin@test.com',
        full_name: 'Jane Admin',
        role: 'admin',
        status: 'active',
        department: 'ops',
        phone_number: '+263771111111',
        last_login_at: '2025-01-01T00:00:00Z',
        login_count: 42,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      };
      const chain = chainableMock({ data: dbRow, error: null });
      mockDb.from.mockReturnValue(chain);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/me' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('admin@test.com');
      expect(body.data.first_name).toBe('Jane');
      expect(body.data.last_name).toBe('Admin');
      expect(body.data.is_active).toBe(true);
      expect(body.data.department).toBe('ops');
    });

    it('should return Cognito-derived user when not in DB', async () => {
      const chain = chainableMock({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/me' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('admin-user-1');
      expect(body.data.email).toBe('admin@test.com');
      expect(body.data.role).toBe('admin');
      expect(body.data.first_name).toBe('');
      expect(body.data.last_name).toBe('');
    });

    it('should return 403 when getAuthContext throws', async () => {
      const authErr = new Error('Forbidden') as Error & { statusCode?: number };
      authErr.statusCode = 403;
      mockGetAuthContext.mockImplementation(() => { throw authErr; });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/me' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
    });
  });

  // ═══════════════════════════════════════════
  // GET /admin/users
  // ═══════════════════════════════════════════

  describe('GET /admin/users', () => {
    it('should return paginated list of users', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '2' }], error: null })
        .mockResolvedValueOnce({
          data: [
            { id: 'u1', email: 'a@test.com', full_name: 'Alice Bob', role: 'admin', status: 'active', created_at: '2024-01-01', updated_at: '2024-01-01' },
            { id: 'u2', email: 'b@test.com', full_name: 'Carol Dan', role: 'admin', status: 'active', created_at: '2024-01-02', updated_at: '2024-01-02' },
          ],
          error: null,
        });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/users' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: { data: unknown[]; total: number; page: number } }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.data).toHaveLength(2);
      expect(body.data.total).toBe(2);
      expect(body.data.page).toBe(1);
    });

    it('should respect page and limit query params', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '50' }], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const event = buildEvent({
        httpMethod: 'GET',
        path: '/admin/users',
        queryStringParameters: { page: '3', limit: '10' },
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: { total: number; page: number; limit: number; total_pages: number } }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.data.page).toBe(3);
      expect(body.data.limit).toBe(10);
      expect(body.data.total_pages).toBe(5);
    });

    it('should return 403 when not admin or manager', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/users' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Insufficient permissions');
    });

    it('should return 500 when query returns an error', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '1' }], error: null })
        .mockResolvedValueOnce({ data: [], error: { message: 'db fail' } });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/users' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Failed to fetch users');
    });
  });

  // ═══════════════════════════════════════════
  // POST /admin/users
  // ═══════════════════════════════════════════

  describe('POST /admin/users', () => {
    it('should create a new user (happy path, no Cognito)', async () => {
      // No COGNITO_USER_POOL_ID env var => skip Cognito creation
      delete process.env.COGNITO_USER_POOL_ID;

      // existing user check => not found
      const existingChain = chainableMock({ data: null, error: null });
      // insert chain
      const insertChain = chainableMock();
      insertChain.execute.mockResolvedValue({
        data: [{
          id: 'new-user-1',
          email: 'new@test.com',
          full_name: 'New User',
          role: 'admin',
          status: 'active',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        }],
        error: null,
      });
      // audit log chain
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(existingChain)   // check existing
        .mockReturnValueOnce(insertChain)      // insert
        .mockReturnValueOnce(auditChain);      // audit log

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({
          email: 'new@test.com',
          first_name: 'New',
          last_name: 'User',
          role: 'admin',
        }),
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('new@test.com');
    });

    it('should return 400 when required fields are missing', async () => {
      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({ email: 'partial@test.com' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 409 when email already exists', async () => {
      delete process.env.COGNITO_USER_POOL_ID;

      const existingChain = chainableMock({ data: { id: 'existing-1' }, error: null });
      mockDb.from.mockReturnValueOnce(existingChain);

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({
          email: 'duplicate@test.com',
          first_name: 'Dup',
          last_name: 'User',
          role: 'admin',
        }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(409);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('already exists');
    });

    it('should return 403 when caller is not an admin role', async () => {
      mockGetAuthContext.mockReturnValue({
        userId: 'user-1',
        email: 'viewer@test.com',
        roles: ['reports_viewer'],
      });

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({
          email: 'new@test.com',
          first_name: 'New',
          last_name: 'User',
          role: 'admin',
        }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Only administrators can create users');
    });

    it('should return 500 when DB insert fails', async () => {
      delete process.env.COGNITO_USER_POOL_ID;

      const existingChain = chainableMock({ data: null, error: null });
      const insertChain = chainableMock();
      insertChain.execute.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

      mockDb.from
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(insertChain);

      const event = buildEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({
          email: 'fail@test.com',
          first_name: 'Fail',
          last_name: 'User',
          role: 'admin',
        }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Failed to create user');
    });
  });

  // ═══════════════════════════════════════════
  // GET /admin/users/:id
  // ═══════════════════════════════════════════

  describe('GET /admin/users/:id', () => {
    it('should return user by ID', async () => {
      const dbRow = {
        id: 'abc-def-123',
        email: 'found@test.com',
        full_name: 'Found User',
        role: 'admin',
        status: 'active',
        department: null,
        phone_number: null,
        last_login_at: null,
        login_count: 0,
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      };
      const chain = chainableMock({ data: dbRow, error: null });
      mockDb.from.mockReturnValue(chain);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/users/abc-def-123' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.data.id).toBe('abc-def-123');
      expect(body.data.email).toBe('found@test.com');
    });

    it('should return 404 when user not found', async () => {
      const chain = chainableMock({ data: null, error: null });
      mockDb.from.mockReturnValue(chain);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/users/aaaa-bbbb-cccc' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('User not found');
    });

    it('should return 403 when not admin or manager', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/users/abc-def-123' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
    });
  });

  // ═══════════════════════════════════════════
  // PATCH /admin/users/:id
  // ═══════════════════════════════════════════

  describe('PATCH /admin/users/:id', () => {
    it('should update user role', async () => {
      delete process.env.COGNITO_USER_POOL_ID;

      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({
        data: [{
          id: 'abc-def-123',
          email: 'user@test.com',
          full_name: 'Updated User',
          role: 'operations_manager',
          status: 'active',
          created_at: '2024-01-01',
          updated_at: '2025-01-01',
        }],
        error: null,
      });
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(auditChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/users/abc-def-123',
        body: JSON.stringify({ role: 'operations_manager' }),
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.data.role).toBe('operations_manager');
    });

    it('should update is_active (maps to status field)', async () => {
      delete process.env.COGNITO_USER_POOL_ID;

      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({
        data: [{
          id: 'abc-def-123',
          email: 'user@test.com',
          full_name: 'Deactivated User',
          role: 'admin',
          status: 'inactive',
          created_at: '2024-01-01',
          updated_at: '2025-01-01',
        }],
        error: null,
      });
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(auditChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/users/abc-def-123',
        body: JSON.stringify({ is_active: false }),
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.data.is_active).toBe(false);
    });

    it('should return 404 when update targets nonexistent user', async () => {
      delete process.env.COGNITO_USER_POOL_ID;

      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({ data: [], error: null });

      mockDb.from.mockReturnValueOnce(updateChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/users/no-such-user',
        body: JSON.stringify({ role: 'admin' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(404);
    });

    it('should return 403 when caller is not admin', async () => {
      mockGetAuthContext.mockReturnValue({
        userId: 'viewer-1',
        email: 'viewer@test.com',
        roles: ['reports_viewer'],
      });

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/users/abc-def-123',
        body: JSON.stringify({ role: 'admin' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Only administrators can update users');
    });

    it('should return 500 when DB update fails', async () => {
      delete process.env.COGNITO_USER_POOL_ID;

      // Use nested mock chain (not reusable chain) so execute returns error
      mockDb.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue({ data: null, error: { message: 'update failed' } }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockReturnValue({
              execute: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/users/abc-def-123',
        body: JSON.stringify({ role: 'admin' }),
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ error: string }>(result);

      expect(result.statusCode).toBe(500);
    });
  });

  // ═══════════════════════════════════════════
  // OPTIONS (CORS preflight)
  // ═══════════════════════════════════════════

  describe('OPTIONS preflight', () => {
    it('should return 204 for OPTIONS requests', async () => {
      const event = buildEvent({ httpMethod: 'OPTIONS', path: '/admin/users' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(204);
    });
  });

  // ═══════════════════════════════════════════
  // 404 — unmatched route
  // ═══════════════════════════════════════════

  describe('Unmatched routes', () => {
    it('should return 404 for unknown path', async () => {
      const event = buildEvent({ httpMethod: 'GET', path: '/admin/nonexistent' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Not Found');
    });
  });
});
