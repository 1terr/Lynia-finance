/**
 * Characterization tests for Admin Service — Dashboard & KYC Review routes
 *
 * These tests capture the CURRENT behavior of the monolith handler before
 * refactoring. They cover dashboard metrics, portfolio-at-risk, daily trends,
 * loans-by-status, recent activity, and KYC admin review workflows.
 *
 * Lines covered: ~2471-3305 of services/admin-service/src/index.ts
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
// Helper: set up default queryOne results for dashboard/metrics
// =====================================================================

/**
 * The dashboard/metrics handler calls queryOne 11 times in parallel,
 * then additional queries inside the Fineract enrichment block.
 * This helper sets up all 11 initial queryOne calls with sensible defaults.
 */
function setupDashboardQueryOneMocks(overrides: Record<string, unknown> = {}) {
  const defaults = [
    { data: { count: '100' }, error: null },                                     // customers
    { data: { count: '50', outstanding: '25000' }, error: null },                // loans
    { data: { total: '100000' }, error: null },                                  // disbursed
    { data: { total: '5000' }, error: null },                                    // revenue
    { data: { collected: '4000', expected: '5000' }, error: null },              // collection rate
    { data: { defaulted: '5', total_active: '55' }, error: null },               // defaults
    { data: { in_stock: '30', active: '20', locked: '5' }, error: null },        // devices
    { data: { count: '10' }, error: null },                                      // KYC pending
    { data: { count: '8' }, error: null },                                       // pending approvals
    { data: { count: '15' }, error: null },                                      // new customers
    { data: { count: '3', amount: '1500' }, error: null },                       // overdue
  ];

  for (const d of defaults) {
    mockQueryOne.mockResolvedValueOnce(d);
  }
}

// =====================================================================
// GET /api/v1/dashboard/metrics
// =====================================================================

describe('GET /api/v1/dashboard/metrics', () => {
  it('should return aggregated dashboard metrics with Fineract enrichment', async () => {
    setupDashboardQueryOneMocks();

    // Fineract enrichment: query for active loans with fineract IDs
    mockQuery.mockResolvedValueOnce({
      data: [
        { fineract_loan_id: 1, outstanding_balance_usd: 500 },
      ],
      error: null,
    });

    // Mock Fineract client
    const mockFineractClient = {
      getLoan: jest.fn().mockResolvedValue({
        summary: {
          totalOutstanding: 480,
          totalOverdue: 0,
          overdueSinceDate: null,
        },
      }),
    };
    mockGetFineractClient.mockResolvedValue(mockFineractClient);

    // Fineract sync log lookup (db.from chain)
    mockChain.execute.mockResolvedValueOnce({
      data: [{ created_at: '2024-01-15T10:00:00Z', status: 'completed' }],
      error: null,
    });

    // Fineract discrepancy count
    mockQueryOne.mockResolvedValueOnce({ data: { count: '2' }, error: null });

    // Disbursements this month
    mockQueryOne.mockResolvedValueOnce({ data: { total: '8000' }, error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/metrics',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: {
        total_customers: number;
        active_loans: number;
        outstanding_balance_usd: number;
        collection_rate: number;
        devices_in_stock: number;
        portfolio_outstanding_fineract: number | null;
        fineract_last_sync: string | null;
      };
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data.total_customers).toBe(100);
    expect(body.data.active_loans).toBe(50);
    expect(body.data.outstanding_balance_usd).toBe(25000);
    expect(body.data.collection_rate).toBe(0.8);
    expect(body.data.devices_in_stock).toBe(30);
    expect(body.data.portfolio_outstanding_fineract).toBe(480);
    expect(body.data.fineract_last_sync).toBe('2024-01-15T10:00:00Z');
  });

  it('should return DB-only data when Fineract client fails', async () => {
    setupDashboardQueryOneMocks();

    // Fineract enrichment throws an error
    mockGetFineractClient.mockRejectedValue(new Error('Fineract unavailable'));

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/metrics',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: {
        total_customers: number;
        portfolio_outstanding_fineract: null;
        par_30_pct: null;
        fineract_last_sync: null;
        fineract_discrepancies: number;
      };
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data.total_customers).toBe(100);
    // Fineract fields should be null/0 when enrichment fails
    expect(body.data.portfolio_outstanding_fineract).toBeNull();
    expect(body.data.par_30_pct).toBeNull();
    expect(body.data.fineract_last_sync).toBeNull();
    expect(body.data.fineract_discrepancies).toBe(0);
  });

  it('should handle all zero DB results gracefully', async () => {
    // All queryOne calls return zeros
    for (let i = 0; i < 11; i++) {
      mockQueryOne.mockResolvedValueOnce({ data: { count: '0', total: '0', outstanding: '0', collected: '0', expected: '1', defaulted: '0', total_active: '1', in_stock: '0', active: '0', locked: '0', amount: '0' }, error: null });
    }

    mockGetFineractClient.mockRejectedValue(new Error('No Fineract'));

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/metrics',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });
});

// =====================================================================
// GET /api/v1/dashboard/portfolio-at-risk
// =====================================================================

describe('GET /api/v1/dashboard/portfolio-at-risk', () => {
  it('should return PAR aging buckets', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        { bucket: 'par_0_30', total: '5000' },
        { bucket: 'par_31_60', total: '2000' },
        { bucket: 'par_61_90', total: '1000' },
        { bucket: 'par_90_plus', total: '500' },
      ],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/portfolio-at-risk',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: { par_0_30: number; par_31_60: number; par_61_90: number; par_90_plus: number };
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data.par_0_30).toBe(5000);
    expect(body.data.par_31_60).toBe(2000);
    expect(body.data.par_61_90).toBe(1000);
    expect(body.data.par_90_plus).toBe(500);
  });

  it('should return zeros when no overdue loans exist', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/portfolio-at-risk',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: Record<string, number>;
    }>(result);

    expect(body.data.par_0_30).toBe(0);
    expect(body.data.par_31_60).toBe(0);
    expect(body.data.par_61_90).toBe(0);
    expect(body.data.par_90_plus).toBe(0);
  });
});

// =====================================================================
// GET /api/v1/dashboard/daily-trends
// =====================================================================

describe('GET /api/v1/dashboard/daily-trends', () => {
  it('should return daily trends with default 30-day range', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        { date: '2024-01-15', disbursements: '5000', collections: '3000', new_customers: '5' },
        { date: '2024-01-16', disbursements: '2000', collections: '4000', new_customers: '3' },
      ],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/daily-trends',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: Array<{ date: string; disbursements: number; collections: number; new_customers: number }> }>(result);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].disbursements).toBe(5000);
    expect(body.data[0].collections).toBe(3000);
    expect(body.data[0].new_customers).toBe(5);
  });

  it('should accept custom days parameter', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/daily-trends',
      queryStringParameters: { days: '7' },
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    // Verify the query was called with 7 as the days parameter
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs[1]).toEqual([7]);
  });

  it('should clamp days to maximum of 365', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/daily-trends',
      queryStringParameters: { days: '1000' },
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs[1]).toEqual([365]);
  });
});

// =====================================================================
// GET /api/v1/dashboard/loans-by-status
// =====================================================================

describe('GET /api/v1/dashboard/loans-by-status', () => {
  it('should return loan counts grouped by status', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        { status: 'active', count: '50', total_amount: '250000' },
        { status: 'pending', count: '10', total_amount: '50000' },
        { status: 'defaulted', count: '5', total_amount: '25000' },
      ],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/loans-by-status',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: Array<{ status: string; count: number; total_amount: number }>;
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);
    expect(body.data[0].status).toBe('active');
    expect(body.data[0].count).toBe(50);
    expect(body.data[0].total_amount).toBe(250000);
  });
});

// =====================================================================
// GET /api/v1/dashboard/recent-activity
// =====================================================================

describe('GET /api/v1/dashboard/recent-activity', () => {
  it('should return recent activity feed', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'log-1',
          action: 'loan.create',
          entity_type: 'loan',
          entity_id: 'loan-1',
          description: 'Created loan application',
          user_email: 'admin@test.com',
          created_at: '2024-01-15T10:00:00Z',
        },
      ],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/recent-activity',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: Array<{ id: string; event_type: string; admin_name: string }>;
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data[0].event_type).toBe('create');
    expect(body.data[0].admin_name).toBe('admin');
  });

  it('should map action to correct event_type for approve actions', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        { id: 'log-2', action: 'loan.approve', entity_type: 'loan', entity_id: 'loan-2', description: null, user_email: 'manager@test.com', created_at: '2024-01-15T11:00:00Z' },
      ],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/recent-activity',
    });
    const result = await handler(event);
    const body = parseResponseBody<{ data: Array<{ event_type: string; description: string }> }>(result);

    expect(body.data[0].event_type).toBe('approve');
    // When description is null, it falls back to `${action} on ${entity_type}`
    expect(body.data[0].description).toBe('loan.approve on loan');
  });

  it('should respect custom limit parameter', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/dashboard/recent-activity',
      queryStringParameters: { limit: '5' },
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs[1]).toEqual([5]);
  });
});

// =====================================================================
// GET /api/v1/kyc/submissions/pending
// =====================================================================

describe('GET /api/v1/kyc/submissions/pending', () => {
  it('should return pending KYC submissions with customer data', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '2' }, error: null });
    mockQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'kyc-1',
          customer_id: 'cust-1',
          status: 'pending',
          extracted_name: 'John Doe',
          extracted_dob: '1990-01-01',
          customer__id: 'cust-1',
          customer__full_name: 'John Doe',
          customer__phone_number: '+263771234567',
        },
      ],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/kyc/submissions/pending',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: {
        data: Array<{
          id: string;
          extracted_first_name: string;
          extracted_last_name: string;
          extracted_date_of_birth: string;
          customer: { id: string; full_name: string; phone_number: string };
        }>;
        total: number;
        page: number;
        limit: number;
      };
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data.total).toBe(2);
    expect(body.data.data[0].extracted_first_name).toBe('John');
    expect(body.data.data[0].extracted_last_name).toBe('Doe');
    expect(body.data.data[0].extracted_date_of_birth).toBe('1990-01-01');
    expect(body.data.data[0].customer.id).toBe('cust-1');
    expect(body.data.data[0].customer.full_name).toBe('John Doe');
  });

  it('should return 403 when user is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/kyc/submissions/pending',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });

  it('should return 500 on DB query error', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '0' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: { message: 'DB connection lost' } });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/kyc/submissions/pending',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
  });
});

// =====================================================================
// GET /api/v1/kyc/submissions/review-history
// =====================================================================

describe('GET /api/v1/kyc/submissions/review-history', () => {
  it('should return KYC review history with customer data', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '5' }, error: null });
    mockQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'kyc-2',
          customer_id: 'cust-2',
          status: 'verified',
          created_at: '2024-01-10T10:00:00Z',
          updated_at: '2024-01-11T10:00:00Z',
          customer__full_name: 'Jane Smith',
          customer__phone_number: '+263772345678',
        },
      ],
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/kyc/submissions/review-history',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: {
        data: Array<{
          id: string;
          status: string;
          customer: { full_name: string; phone_number: string };
        }>;
        total: number;
      };
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data.total).toBe(5);
    expect(body.data.data[0].customer.full_name).toBe('Jane Smith');
  });

  it('should return 500 on DB error', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '0' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: { message: 'Query failed' } });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/kyc/submissions/review-history',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
  });
});

// =====================================================================
// GET /api/v1/kyc/submissions/sla-stats
// =====================================================================

describe('GET /api/v1/kyc/submissions/sla-stats', () => {
  it('should return SLA statistics for pending KYC', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: { total: '10', within4h: '5', within24h: '3', over24h: '2' },
      error: null,
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/kyc/submissions/sla-stats',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{
      success: boolean;
      data: { total: number; within4h: number; within24h: number; over24h: number };
    }>(result);

    expect(body.success).toBe(true);
    expect(body.data.total).toBe(10);
    expect(body.data.within4h).toBe(5);
    expect(body.data.within24h).toBe(3);
    expect(body.data.over24h).toBe(2);
  });

  it('should return 403 when user is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/v1/kyc/submissions/sla-stats',
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });
});

// =====================================================================
// POST /api/v1/kyc/submissions/:id/approve
// =====================================================================

describe('POST /api/v1/kyc/submissions/:id/approve', () => {
  it('should approve a KYC submission', async () => {
    // Three query calls: update kyc_submissions, update customers, insert audit_log
    mockQuery
      .mockResolvedValueOnce({ data: [], error: null })   // UPDATE kyc_submissions
      .mockResolvedValueOnce({ data: [], error: null })   // UPDATE customers
      .mockResolvedValueOnce({ data: [], error: null });   // INSERT audit_log

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000123/approve',
      body: JSON.stringify({ customer_id: 'cust-1' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { message: string } }>(result);
    expect(body.data.message).toBe('KYC approved');
  });

  it('should use admin_id from body if provided', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000123/approve',
      body: JSON.stringify({ customer_id: 'cust-1', admin_id: 'specific-admin-1' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    // Verify the second parameter (admin_id) in the UPDATE query call
    const updateCall = mockQuery.mock.calls[0];
    expect(updateCall[1][1]).toBe('specific-admin-1');
  });

  it('should return 400 when customer_id is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000123/approve',
      body: JSON.stringify({}),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('customer_id');
  });

  it('should return 403 when user is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000123/approve',
      body: JSON.stringify({ customer_id: 'cust-1' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });
});

// =====================================================================
// POST /api/v1/kyc/submissions/:id/reject
// =====================================================================

describe('POST /api/v1/kyc/submissions/:id/reject', () => {
  it('should reject a KYC submission with a reason', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [], error: null })   // UPDATE kyc_submissions
      .mockResolvedValueOnce({ data: [], error: null });   // INSERT audit_log

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000456/reject',
      body: JSON.stringify({
        customer_id: 'cust-2',
        reason: 'ID document is blurry and unreadable',
      }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const body = parseResponseBody<{ success: boolean; data: { message: string } }>(result);
    expect(body.data.message).toBe('KYC rejected');
  });

  it('should return 400 when customer_id is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000456/reject',
      body: JSON.stringify({ reason: 'Some reason' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('customer_id');
  });

  it('should return 400 when reason is missing', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000456/reject',
      body: JSON.stringify({ customer_id: 'cust-2' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = parseResponseBody<{ error: string }>(result);
    expect(body.error).toContain('reason');
  });

  it('should return 403 when user is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/v1/kyc/submissions/abcdef0000000456/reject',
      body: JSON.stringify({ customer_id: 'cust-2', reason: 'test' }),
    });
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });
});
