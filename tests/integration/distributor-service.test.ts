/**
 * Integration Tests: Distributor Service
 * Tests the distributor-service Lambda handler with mocked database interactions.
 * Covers profile, stats, inventory, handovers, and commissions endpoints.
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
  query: jest.fn().mockResolvedValue({ data: [], error: null, rows: [] }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
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
}));

jest.mock('../../services/lock-service/src/handover-service', () => ({
  HandoverService: jest.fn().mockImplementation(() => ({
    completeHandover: jest.fn().mockResolvedValue({
      success: true,
      loan_id: 'loan-001',
      commission: { amount: 25 },
    }),
    verifyCustomerIdentity: jest.fn().mockResolvedValue({ verified: true }),
    verifyDepositPayment: jest.fn().mockResolvedValue({ verified: true, amount: 50 }),
    recordDeviceCondition: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { handler } from '../../services/distributor-service/src/index';
import { query } from '../../services/shared/clients/database';

const mockQuery = query as jest.Mock;

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
          sub: 'dist-user-123',
          email: 'distributor@lynia.co.zw',
          'cognito:groups': 'distributor',
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

describe('Distributor Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ data: [], error: null });
    mockQuery.mockResolvedValue({ data: [], error: null, rows: [] });
  });

  // =========================================================================
  // GET /api/v1/distributor/profile
  // =========================================================================
  describe('GET /api/v1/distributor/profile', () => {
    it('should return distributor profile', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'dist-001',
          user_id: 'dist-user-123',
          business_name: 'Harare Phones',
          phone_number: '+263771234567',
          city: 'Harare',
          status: 'active',
        },
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.business_name).toBe('Harare Phones');
    });

    it('should return 404 if distributor not found', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return 500 on database error', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: new Error('connection timeout') });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });

    it('should return 404 for admin user without distributor_id param', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/distributor/profile',
        requestContext: {
          accountId: '',
          apiId: '',
          authorizer: {
            claims: {
              sub: 'admin-user-1',
              email: 'admin@lynia.co.zw',
              'cognito:groups': 'admin',
            },
          },
          httpMethod: 'GET',
          identity: { sourceIp: '127.0.0.1' } as never,
          path: '/api/v1/distributor/profile',
          protocol: 'HTTP/1.1',
          requestId: 'test-req-456',
          requestTimeEpoch: Date.now(),
          resourceId: '',
          resourcePath: '',
          stage: 'test',
        },
      });
      const response = await handler(event);

      // Admin users pass requireRole but resolveDistributor returns null without distributor_id
      expect(response.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // PATCH /api/v1/distributor/profile
  // =========================================================================
  describe('PATCH /api/v1/distributor/profile', () => {
    it('should update distributor profile', async () => {
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'dist-001',
          user_id: 'dist-user-123',
          phone_number: '+263779876543',
          city: 'Bulawayo',
        },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'PATCH',
        path: '/api/v1/distributor/profile',
        body: JSON.stringify({ phone_number: '+263779876543', city: 'Bulawayo' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 400 when no valid fields provided', async () => {
      const event = createEvent({
        httpMethod: 'PATCH',
        path: '/api/v1/distributor/profile',
        body: JSON.stringify({ invalid_field: 'test' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /api/v1/distributor/stats
  // =========================================================================
  describe('GET /api/v1/distributor/stats', () => {
    it('should return distributor statistics', async () => {
      // First: get distributor
      mockExecute.mockResolvedValueOnce({
        data: {
          id: 'dist-001',
          total_devices_distributed: 150,
          current_inventory_count: 25,
          total_commissions_earned: 3750,
          total_commissions_paid: 3000,
          pending_commissions: 750,
          average_rating: 4.5,
        },
        error: null,
      });

      // Then: pending handovers count
      mockQuery
        .mockResolvedValueOnce({ data: [{ count: '3' }], error: null })
        // monthly handovers count
        .mockResolvedValueOnce({ data: [{ count: '12' }], error: null })
        // last month handovers count
        .mockResolvedValueOnce({ data: [{ count: '8' }], error: null });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/stats' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.total_devices_distributed).toBe(150);
      expect(body.data.pending_handovers).toBe(3);
      expect(body.data.monthly_handovers).toBe(12);
      expect(body.data.last_month_handovers).toBe(8);
    });

    it('should return 404 if distributor not found', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/stats' });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // GET /api/v1/distributor/inventory
  // =========================================================================
  describe('GET /api/v1/distributor/inventory', () => {
    it('should return inventory list', async () => {
      // Get distributor
      mockExecute.mockResolvedValueOnce({ data: { id: 'dist-001' }, error: null });
      // Get inventory
      mockQuery.mockResolvedValueOnce({
        data: [
          { id: 'dev-1', brand: 'Samsung', model: 'A14', imei: '123456789012345', retail_price: 199, status: 'in_stock', condition: 'new', received_at: '2024-01-01' },
          { id: 'dev-2', brand: 'Tecno', model: 'Spark 10', imei: '543210987654321', retail_price: 149, status: 'in_stock', condition: 'new', received_at: '2024-01-02' },
        ],
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/inventory' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 if distributor not found', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/inventory' });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // GET /api/v1/distributor/commissions
  // =========================================================================
  describe('GET /api/v1/distributor/commissions', () => {
    it('should return commission records', async () => {
      mockExecute.mockResolvedValueOnce({ data: { id: 'dist-001' }, error: null });
      mockQuery.mockResolvedValueOnce({
        data: [
          { id: 'comm-1', loan_id: 'loan-1', device_model: 'Samsung A14', customer_name: 'Alice', commission_amount: 25, payment_status: 'paid', calculation_date: '2024-01-15' },
        ],
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/commissions' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  // =========================================================================
  // GET /api/v1/distributor/handovers
  // =========================================================================
  describe('GET /api/v1/distributor/handovers', () => {
    it('should return handover list', async () => {
      mockExecute.mockResolvedValueOnce({ data: { id: 'dist-001' }, error: null });
      mockQuery.mockResolvedValueOnce({
        data: [
          { id: 'ho-1', loan_id: 'loan-1', customer_name: 'Alice', device_model: 'Samsung A14', status: 'pending', created_at: '2024-01-10' },
        ],
        error: null,
      });

      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/handovers' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown path', async () => {
      const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/nonexistent' });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should handle OPTIONS preflight', async () => {
      const event = createEvent({ httpMethod: 'OPTIONS', path: '/api/v1/distributor/profile' });
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
    });
  });
});
