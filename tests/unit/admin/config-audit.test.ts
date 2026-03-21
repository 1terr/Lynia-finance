/**
 * Characterization tests for admin-service config and audit-log routes.
 *
 * Routes covered:
 *   GET    /admin/config
 *   PATCH  /admin/config/:id
 *   GET    /admin/audit-logs
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
  withTransaction: jest.fn().mockImplementation((fn: (...args: any[]) => any) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
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

describe('Admin Service — Config & Audit Logs', () => {
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
  // GET /admin/config
  // ═══════════════════════════════════════════

  describe('GET /admin/config', () => {
    it('should return system configuration list', async () => {
      const configData = [
        { id: 'cfg-1', config_key: 'max_loan_amount', config_value: '5000', updated_at: '2024-01-01' },
        { id: 'cfg-2', config_key: 'min_credit_score', config_value: '350', updated_at: '2024-01-01' },
      ];
      const chain = chainableMock();
      chain.execute.mockResolvedValue({ data: configData, error: null });
      mockDb.from.mockReturnValue(chain);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/config' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: unknown[] }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it('should return 403 when not admin or manager', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/config' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Insufficient permissions');
    });

    it('should return 500 when DB returns an error', async () => {
      const chain = chainableMock();
      chain.execute.mockResolvedValue({ data: null, error: { message: 'db down' } });
      mockDb.from.mockReturnValue(chain);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/config' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Failed to fetch configs');
    });
  });

  // ═══════════════════════════════════════════
  // PATCH /admin/config/:id
  // ═══════════════════════════════════════════

  describe('PATCH /admin/config/:id', () => {
    it('should update a config item (happy path)', async () => {
      const updatedRow = {
        id: 'aaa-bbb-111',
        config_key: 'max_loan_amount',
        config_value: '"10000"',
        updated_by: 'admin-user-1',
        updated_at: '2025-02-01T00:00:00Z',
      };
      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({ data: [updatedRow], error: null });
      const auditChain = chainableMock();

      mockDb.from
        .mockReturnValueOnce(updateChain)
        .mockReturnValueOnce(auditChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/config/aaa-bbb-111',
        body: JSON.stringify({ config_value: 10000 }),
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: Record<string, unknown> }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('aaa-bbb-111');
    });

    it('should return 400 when config_value is missing', async () => {
      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/config/aaa-bbb-111',
        body: JSON.stringify({}),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toContain('config_value');
    });

    it('should return 404 when config not found', async () => {
      const updateChain = chainableMock();
      updateChain.execute.mockResolvedValue({ data: [], error: null });
      mockDb.from.mockReturnValueOnce(updateChain);

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/config/aaaa-0000-bbbb',
        body: JSON.stringify({ config_value: 'test' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Config not found');
    });

    it('should return 403 when caller is not admin role', async () => {
      mockGetAuthContext.mockReturnValue({
        userId: 'viewer-1',
        email: 'viewer@test.com',
        roles: ['reports_viewer'],
      });

      const event = buildEvent({
        httpMethod: 'PATCH',
        path: '/admin/config/aaa-bbb-111',
        body: JSON.stringify({ config_value: 'new-value' }),
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Only administrators can update system config');
    });
  });

  // ═══════════════════════════════════════════
  // GET /admin/audit-logs
  // ═══════════════════════════════════════════

  describe('GET /admin/audit-logs', () => {
    it('should return paginated audit logs', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '3' }], error: null })
        .mockResolvedValueOnce({
          data: [
            { id: 'log-1', action: 'create', entity_type: 'admin_user', created_at: '2025-01-03' },
            { id: 'log-2', action: 'update', entity_type: 'system_config', created_at: '2025-01-02' },
            { id: 'log-3', action: 'delete', entity_type: 'loan_product', created_at: '2025-01-01' },
          ],
          error: null,
        });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/audit-logs' });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: { data: unknown[]; total: number; page: number; limit: number; total_pages: number } }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.data).toHaveLength(3);
      expect(body.data.total).toBe(3);
      expect(body.data.page).toBe(1);
    });

    it('should support pagination params', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '100' }], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const event = buildEvent({
        httpMethod: 'GET',
        path: '/admin/audit-logs',
        queryStringParameters: { page: '2', limit: '10' },
      });
      const result = await handler(event as never);
      const body = parseResponseBody<{ success: boolean; data: { total: number; page: number; limit: number; total_pages: number } }>(result);

      expect(result.statusCode).toBe(200);
      expect(body.data.page).toBe(2);
      expect(body.data.limit).toBe(10);
      expect(body.data.total_pages).toBe(10);
    });

    it('should filter by action', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '1' }], error: null })
        .mockResolvedValueOnce({
          data: [{ id: 'log-1', action: 'create', entity_type: 'admin_user' }],
          error: null,
        });

      const event = buildEvent({
        httpMethod: 'GET',
        path: '/admin/audit-logs',
        queryStringParameters: { action: 'create' },
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(200);
      // Verify the query was called with the action filter parameter
      expect(mockQuery).toHaveBeenCalledTimes(2);
      const countCall = mockQuery.mock.calls[0];
      expect(countCall[0]).toContain('action = $');
      expect(countCall[1]).toContain('create');
    });

    it('should filter by entity_type', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '2' }], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const event = buildEvent({
        httpMethod: 'GET',
        path: '/admin/audit-logs',
        queryStringParameters: { entity_type: 'loan_product' },
      });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(200);
      const countCall = mockQuery.mock.calls[0];
      expect(countCall[0]).toContain('entity_type = $');
      expect(countCall[1]).toContain('loan_product');
    });

    it('should return 403 when not admin or manager', async () => {
      mockIsAdminOrManager.mockReturnValue(false);

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/audit-logs' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(403);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Insufficient permissions');
    });

    it('should return 500 when query returns an error', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '1' }], error: null })
        .mockResolvedValueOnce({ data: [], error: { message: 'db fail' } });

      const event = buildEvent({ httpMethod: 'GET', path: '/admin/audit-logs' });
      const result = await handler(event as never);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string }>(result);
      expect(body.error).toBe('Failed to fetch audit logs');
    });
  });
});
