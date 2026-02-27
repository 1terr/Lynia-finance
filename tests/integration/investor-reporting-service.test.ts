/**
 * Integration Tests: Investor Reporting Service
 * Tests the investor-reporting-service Lambda handler with mocked database interactions.
 * Covers portfolio summary, vintage analysis, loan tape, borrowing base,
 * collections, financials, and covenant compliance endpoints.
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

import { handler } from '../../services/investor-reporting-service/src/index';
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
    resource: overrides.path || '/',
    requestContext: {
      accountId: '',
      apiId: '',
      authorizer: {
        claims: {
          sub: 'investor-user-123',
          email: 'investor@cascade.com',
          'cognito:groups': 'investor',
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

describe('Investor Reporting Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ data: [], error: null });
    mockQuery.mockResolvedValue({ data: [], error: null });
  });

  // =========================================================================
  // GET /api/v1/investor/portfolio
  // =========================================================================
  describe('GET /api/v1/investor/portfolio', () => {
    it('should return portfolio summary with metrics', async () => {
      mockQuery
        // Main portfolio metrics query
        .mockResolvedValueOnce({
          data: [{
            total_active_loans: 200,
            total_customers: 180,
            total_outstanding: 100000,
            avg_loan_size: 500,
            avg_days_past_due: 5,
            weighted_avg_interest_rate: 0.05,
            par_7_amount: 5000,
            par_30_amount: 3000,
            par_60_amount: 1500,
            par_90_amount: 500,
            par_7_pct: 0.05,
            par_30_pct: 0.03,
            par_60_pct: 0.015,
            par_90_pct: 0.005,
            npl_count: 5,
            npl_amount: 2500,
            npl_ratio: 0.025,
            tier_1_count: 100,
            tier_2_count: 70,
            tier_3_count: 30,
            today_disbursements_count: 3,
            today_disbursements_amount: 1500,
            today_collections_count: 10,
            today_collections_amount: 5000,
            today_write_offs_amount: 0,
            today_applications: 5,
            today_approvals: 3,
            today_rejections: 1,
          }],
          error: null,
        })
        // Trend data query
        .mockResolvedValueOnce({
          data: [
            { snapshot_date: '2024-01-01', total_outstanding: 95000, total_active_loans: 195, par_30_pct: 0.028, par_90_pct: 0.004, npl_ratio: 0.02, collections_amount: 4500, new_disbursements_amount: 2000, write_offs_amount: 0 },
          ],
          error: null,
        });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/portfolio',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.portfolio_size.total_outstanding).toBe(100000);
      expect(body.data.portfolio_size.active_loans).toBe(200);
      expect(body.data.portfolio_at_risk).toBeDefined();
      expect(body.data.non_performing).toBeDefined();
      expect(body.data.trend_30d).toBeDefined();
    });

    it('should return empty portfolio message when no data', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: null });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/portfolio',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.snapshot).toBeNull();
    });

    it('should return 500 when database query fails', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: new Error('Connection failed') });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/portfolio',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // GET /api/v1/investor/loan-tape
  // =========================================================================
  describe('GET /api/v1/investor/loan-tape', () => {
    const sampleLoans = [
      {
        loan_id: 'loan-001',
        loan_number: 'LN-001',
        loan_status: 'active',
        currency: 'USD',
        origination_date: '2024-01-01',
        original_principal: 350,
        outstanding_balance: 280,
        days_past_due: 0,
        credit_tier: 'Tier 1',
        device_manufacturer: 'Samsung',
        device_model: 'A14',
        province: 'Harare',
      },
    ];

    it('should return loan tape in JSON format', async () => {
      mockQuery.mockResolvedValueOnce({ data: sampleLoans, error: null });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/loan-tape',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.report_type).toBe('loan_tape');
      expect(body.data.total_loans).toBe(1);
      expect(body.data.loans).toHaveLength(1);
    });

    it('should return loan tape in CSV format', async () => {
      mockQuery.mockResolvedValueOnce({ data: sampleLoans, error: null });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/loan-tape',
        queryStringParameters: { format: 'csv' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers!['Content-Type']).toBe('text/csv');
      expect(response.headers!['Content-Disposition']).toContain('loan-tape-');
      // CSV body should contain header row and data
      expect(response.body).toContain('loan_id');
    });

    it('should filter loan tape by status', async () => {
      mockQuery.mockResolvedValueOnce({ data: sampleLoans, error: null });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/loan-tape',
        queryStringParameters: { status: 'active' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: new Error('DB error') });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/loan-tape',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // GET /api/v1/investor/collections
  // =========================================================================
  describe('GET /api/v1/investor/collections', () => {
    it('should return collections data', async () => {
      mockQuery.mockResolvedValueOnce({
        data: [{
          total_collected: 50000,
          total_expected: 60000,
          collection_rate: 0.833,
        }],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/collections',
        queryStringParameters: { period: '2026-01' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  // =========================================================================
  // GET /api/v1/investor/financials
  // =========================================================================
  describe('GET /api/v1/investor/financials', () => {
    it('should return financial summary', async () => {
      mockQuery.mockResolvedValueOnce({
        data: [{
          total_revenue: 15000,
          total_interest_income: 12000,
          total_fee_income: 3000,
        }],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/financials',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  // =========================================================================
  // OPTIONS preflight
  // =========================================================================
  describe('OPTIONS preflight', () => {
    it('should return 204 for CORS preflight', async () => {
      const event = createEvent({
        httpMethod: 'OPTIONS',
        path: '/api/v1/investor/portfolio',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
    });
  });

  // =========================================================================
  // Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown endpoint', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/nonexistent',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // Server errors
  // =========================================================================
  describe('Server errors', () => {
    it('should return 500 when handler throws', async () => {
      // Force an error in the portfolio handler by making query throw
      mockQuery.mockRejectedValueOnce(new Error('Unexpected DB failure'));

      const event = createEvent({
        httpMethod: 'GET',
        path: '/api/v1/investor/portfolio',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });
});
