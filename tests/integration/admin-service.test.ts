/**
 * Integration Tests: Admin Service
 * Tests the admin-service Lambda handler with mocked database interactions.
 * Covers user management, products, dashboard, and KYC review endpoints.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks — MUST be set up before importing the handler
// ---------------------------------------------------------------------------

const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });

function createChain() {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or', 'order', 'limit',
    'single', 'maybeSingle', 'offset', 'range', 'count',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = mockExecute;
  return chain;
}

jest.mock('../../services/shared/clients/database', () => ({
  db: { from: jest.fn().mockImplementation(() => createChain()) },
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
  withTransaction: jest.fn().mockImplementation((fn: Function) => fn(jest.fn().mockResolvedValue({ data: [], error: null }))),
}));

jest.mock('../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
  setRequestContext: jest.fn().mockReturnValue('req-test-123'),
  clearRequestContext: jest.fn(),
  getRequestContext: jest.fn().mockReturnValue({ requestId: 'req-test-123' }),
  maskImei: jest.fn((imei: string) => imei),
}));

jest.mock('../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn().mockRejectedValue(new Error('Fineract not available')),
}));

import { handler } from '../../services/admin-service/src/index';
import { query, queryOne } from '../../services/shared/clients/database';

const mockQuery = query as jest.Mock;
const mockQueryOne = queryOne as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/',
    body: null,
    headers: { 'Content-Type': 'application/json' },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      accountId: '',
      apiId: '',
      authorizer: {
        claims: {
          sub: 'admin-user-123',
          email: 'admin@lynia.co.zw',
          'cognito:groups': 'super_admin',
        },
      },
      httpMethod: overrides.httpMethod || 'GET',
      identity: { sourceIp: '127.0.0.1' } as never,
      path: overrides.path || '/',
      protocol: 'HTTP/1.1',
      requestId: 'test-req-123',
      requestTimeEpoch: Date.now(),
      resourceId: '',
      resourcePath: '',
      stage: 'test',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ data: [], error: null });
    mockQuery.mockResolvedValue({ data: [], error: null });
    mockQueryOne.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // GET /admin/me
  // =========================================================================
  describe('GET /admin/me', () => {
    it('should return current admin from database', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'admin-user-123',
          email: 'admin@lynia.co.zw',
          full_name: 'John Admin',
          role: 'super_admin',
          status: 'active',
          department: 'IT',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/admin/me' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('admin@lynia.co.zw');
      expect(body.data.first_name).toBe('John');
      expect(body.data.last_name).toBe('Admin');
    });

    it('should return fallback from Cognito claims if not in DB', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({ httpMethod: 'GET', path: '/admin/me' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('admin-user-123');
      expect(body.data.email).toBe('admin@lynia.co.zw');
      expect(body.data.role).toBe('super_admin');
    });
  });

  // =========================================================================
  // GET /admin/users
  // =========================================================================
  describe('GET /admin/users', () => {
    it('should return paginated user list', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '2' }], error: null })
        .mockResolvedValueOnce({
          data: [
            { id: 'u1', email: 'a@lynia.co.zw', full_name: 'Alice Admin', role: 'admin', status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
            { id: 'u2', email: 'b@lynia.co.zw', full_name: 'Bob Manager', role: 'operations_manager', status: 'active', created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
          ],
          error: null,
        });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/admin/users',
        queryStringParameters: { page: '1', limit: '10' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.total).toBe(2);
      expect(body.data.data).toHaveLength(2);
    });

    it('should return 403 for non-admin user', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/admin/users',
        requestContext: {
          accountId: '',
          apiId: '',
          authorizer: {
            claims: {
              sub: 'support-user-1',
              email: 'support@lynia.co.zw',
              'cognito:groups': 'customer_support',
            },
          },
          httpMethod: 'GET',
          identity: { sourceIp: '127.0.0.1' } as never,
          path: '/admin/users',
          protocol: 'HTTP/1.1',
          requestId: 'test-req-456',
          requestTimeEpoch: Date.now(),
          resourceId: '',
          resourcePath: '',
          stage: 'test',
        },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return 500 when database query fails', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '0' }], error: null })
        .mockResolvedValueOnce({ data: [], error: new Error('Connection refused') });

      const event = createEvent({ httpMethod: 'GET', path: '/admin/users' });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /admin/users
  // =========================================================================
  describe('POST /admin/users', () => {
    it('should create a new admin user', async () => {
      // Check existing user → not found
      mockExecute
        .mockResolvedValueOnce({ data: null, error: null })
        // Insert → return created user
        .mockResolvedValueOnce({
          data: [{
            id: 'new-user-1',
            email: 'newadmin@lynia.co.zw',
            full_name: 'New Admin',
            role: 'admin',
            status: 'active',
            created_at: '2024-06-01T00:00:00Z',
          }],
          error: null,
        })
        // Audit log
        .mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({
          email: 'newadmin@lynia.co.zw',
          first_name: 'New',
          last_name: 'Admin',
          role: 'admin',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('newadmin@lynia.co.zw');
    });

    it('should return 400 for missing required fields', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({ email: 'test@lynia.co.zw' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 409 for duplicate email', async () => {
      mockExecute.mockResolvedValueOnce({ data: { id: 'existing-user' }, error: null });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/admin/users',
        body: JSON.stringify({
          email: 'existing@lynia.co.zw',
          first_name: 'Existing',
          last_name: 'User',
          role: 'admin',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(409);
    });
  });

  // =========================================================================
  // GET /admin/users/:id
  // =========================================================================
  describe('GET /admin/users/:id', () => {
    it('should return user by ID', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'u1', email: 'a@lynia.co.zw', full_name: 'Alice Admin',
          role: 'admin', status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/admin/users/u1' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe('u1');
    });

    it('should return 404 for non-existent user', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({ httpMethod: 'GET', path: '/admin/users/nonexistent' });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // GET /api/v1/dashboard/metrics
  // =========================================================================
  describe('GET /api/v1/dashboard/metrics', () => {
    it('should return dashboard metrics', async () => {
      // Mock all the parallel queryOne calls
      mockQueryOne
        .mockResolvedValueOnce({ data: { count: '100' }, error: null })    // customers
        .mockResolvedValueOnce({ data: { count: '50', outstanding: '25000' }, error: null }) // loans
        .mockResolvedValueOnce({ data: { total: '50000' }, error: null })  // disbursed
        .mockResolvedValueOnce({ data: { total: '5000' }, error: null })   // revenue
        .mockResolvedValueOnce({ data: { collected: '4000', expected: '5000' }, error: null }) // collection
        .mockResolvedValueOnce({ data: { defaulted: '3', total_active: '50' }, error: null }) // defaults
        .mockResolvedValueOnce({ data: { in_stock: '20', active: '80', locked: '5' }, error: null }) // devices
        .mockResolvedValueOnce({ data: { count: '10' }, error: null })    // kyc pending
        .mockResolvedValueOnce({ data: { count: '5' }, error: null })     // pending approvals
        .mockResolvedValueOnce({ data: { count: '15' }, error: null })    // new customers
        .mockResolvedValueOnce({ data: { count: '3', amount: '1500' }, error: null }); // overdue

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/dashboard/metrics' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.total_customers).toBe(100);
      expect(body.data.active_loans).toBe(50);
      expect(body.data.devices_in_stock).toBe(20);
    });
  });

  // =========================================================================
  // GET /api/v1/dashboard/loans-by-status
  // =========================================================================
  describe('GET /api/v1/dashboard/loans-by-status', () => {
    it('should return loan counts grouped by status', async () => {
      mockQuery.mockResolvedValueOnce({
        data: [
          { status: 'active', count: '50', total_amount: '25000' },
          { status: 'pending', count: '10', total_amount: '5000' },
          { status: 'defaulted', count: '3', total_amount: '1500' },
        ],
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/dashboard/loans-by-status' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].status).toBe('active');
      expect(body.data[0].count).toBe(50);
    });
  });

  // =========================================================================
  // POST /api/v1/kyc/submissions/:id/approve
  // =========================================================================
  describe('POST /api/v1/kyc/submissions/:id/approve', () => {
    it('should approve a KYC submission', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ id: 'kyc-001' }], error: null })  // UPDATE kyc_submissions RETURNING id
        .mockResolvedValueOnce({ data: [], error: null })  // UPDATE customers
        .mockResolvedValueOnce({ data: [], error: null }); // INSERT audit_log
      mockQueryOne
        .mockResolvedValueOnce({ data: { extracted_name: null }, error: null }); // SELECT extracted_name

      const event = createEvent({
        httpMethod: 'POST',
        path: '/api/v1/kyc/submissions/kyc-001/approve',
        body: JSON.stringify({ customer_id: 'cust-001' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.message).toBe('KYC approved');
    });

    it('should return 400 if customer_id is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/api/v1/kyc/submissions/kyc-001/approve',
        body: JSON.stringify({}),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // POST /api/v1/kyc/submissions/:id/reject
  // =========================================================================
  describe('POST /api/v1/kyc/submissions/:id/reject', () => {
    it('should reject a KYC submission with reason', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [{ id: 'kyc-002' }], error: null })  // UPDATE kyc_submissions RETURNING id
        .mockResolvedValueOnce({ data: [], error: null })  // UPDATE customers kyc_status
        .mockResolvedValueOnce({ data: [], error: null }); // INSERT audit_log

      const event = createEvent({
        httpMethod: 'POST',
        path: '/api/v1/kyc/submissions/kyc-002/reject',
        body: JSON.stringify({ customer_id: 'cust-002', reason: 'Blurry ID document' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.message).toBe('KYC rejected');
    });

    it('should return 400 if reason is missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/api/v1/kyc/submissions/kyc-002/reject',
        body: JSON.stringify({ customer_id: 'cust-002' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // Route not found
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown path', async () => {
      const event = createEvent({ httpMethod: 'GET', path: '/admin/nonexistent' });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle OPTIONS preflight', async () => {
      const event = createEvent({ httpMethod: 'OPTIONS', path: '/admin/users' });
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
    });
  });
});
