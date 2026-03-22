/**
 * Unit tests for Admin Service — Reports handlers
 *
 * Tests all 12 report endpoints: portfolio, portfolio/health, disbursements,
 * collections, collections/detailed, kyc, kyc/detailed, defaults,
 * defaults/summary, acquisition, revenue, loan-approvals.
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

import { handler } from '../../../services/admin-service/src/index';

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

function makeEvent(method: string, path: string, opts: { qs?: Record<string, string> } = {}) {
  return createAPIGatewayEvent({
    httpMethod: method,
    path,
    queryStringParameters: opts.qs || null,
    requestContext: { ...createAPIGatewayEvent().requestContext, ...adminAuth },
  });
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdminOrManager.mockReturnValue(true);
});

// ─── Authorization ───────────────────────────────────────────────────

describe('Reports authorization', () => {
  it('should return 403 for non-admin users on portfolio', async () => {
    mockIsAdminOrManager.mockReturnValue(false);
    const res = await handler(makeEvent('GET', '/api/v1/reports/portfolio'));
    expect(res.statusCode).toBe(403);
  });

  it('should return 403 for non-admin users on kyc report', async () => {
    mockIsAdminOrManager.mockReturnValue(false);
    const res = await handler(makeEvent('GET', '/api/v1/reports/kyc'));
    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /api/v1/reports/portfolio ───────────────────────────────────

describe('GET /api/v1/reports/portfolio', () => {
  it('should return portfolio summary on success', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_outstanding: '150000',
        current: '100000',
        par_30: '20000',
        par_60: '15000',
        par_90: '10000',
        par_90_plus: '5000',
        total_loans: '42',
      },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/portfolio'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect(body).toHaveProperty('data');
    expect((body as any).data.total_outstanding).toBe(150000);
    expect((body as any).data.total_loans).toBe(42);
    expect((body as any).data.par_30).toBe(20000);
  });

  it('should return zeros when no data', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null });
    const res = await handler(makeEvent('GET', '/api/v1/reports/portfolio'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.total_outstanding).toBe(0);
    expect((body as any).data.total_loans).toBe(0);
  });

  it('should return 500 with generic message on DB error', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('Connection refused'));
    const res = await handler(makeEvent('GET', '/api/v1/reports/portfolio'));
    expect(res.statusCode).toBe(500);
    const body = parseResponseBody(res);
    expect((body as any).error).not.toContain('Connection refused');
  });
});

// ─── GET /api/v1/reports/portfolio/health ────────────────────────────

describe('GET /api/v1/reports/portfolio/health', () => {
  it('should return health metrics with filters', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_outstanding: '50000',
        total_disbursed: '80000',
        par_1_30: '5000',
        par_31_60: '3000',
        par_61_90: '2000',
        par_90_plus: '1000',
        total_loans: '20',
        delinquent_loans: '8',
      },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/portfolio/health', {
      qs: { product: 'prod-1' },
    }));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.total_outstanding).toBe(50000);
    expect((body as any).data.delinquent_loans).toBe(8);
  });
});

// ─── GET /api/v1/reports/disbursements ───────────────────────────────

describe('GET /api/v1/reports/disbursements', () => {
  it('should return disbursement stats', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_applications: '100',
        approved: '70',
        rejected: '20',
        pending: '10',
        total_disbursed: '35000',
        avg_loan_size: '500',
      },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/disbursements'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.approval_rate).toBe(70);
    expect((body as any).data.total_disbursed).toBe(35000);
  });

  it('should filter by date range', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { total_applications: '5', approved: '3', rejected: '2', pending: '0', total_disbursed: '1500', avg_loan_size: '500' } });

    const res = await handler(makeEvent('GET', '/api/v1/reports/disbursements', {
      qs: { date_from: '2025-01-01', date_to: '2025-06-30' },
    }));
    expect(res.statusCode).toBe(200);
  });
});

// ─── GET /api/v1/reports/collections ─────────────────────────────────

describe('GET /api/v1/reports/collections', () => {
  it('should return collection breakdown by method', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        { method: 'ecocash', count: '50', total_amount: '25000' },
        { method: 'bank_transfer', count: '10', total_amount: '15000' },
      ],
      error: null,
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/collections'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data).toHaveLength(2);
  });

  it('should return empty array when no collections', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });
    const res = await handler(makeEvent('GET', '/api/v1/reports/collections'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data).toHaveLength(0);
  });
});

// ─── GET /api/v1/reports/collections/detailed ────────────────────────

describe('GET /api/v1/reports/collections/detailed', () => {
  it('should return collection summary with rates', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_collected: '40000',
        total_payments: '100',
        confirmed_count: '85',
        failed_count: '10',
        pending_count: '5',
      },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/collections/detailed'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.collection_rate).toBe(85);
  });
});

// ─── GET /api/v1/reports/kyc ─────────────────────────────────────────

describe('GET /api/v1/reports/kyc', () => {
  it('should return KYC stats', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_submissions: '200',
        pending: '30',
        approved: '150',
        rejected: '20',
        avg_processing_time_hours: '4.5',
      },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/kyc'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.total_submissions).toBe(200);
    expect((body as any).data.avg_processing_time_hours).toBe(4.5);
  });
});

// ─── GET /api/v1/reports/kyc/detailed ────────────────────────────────

describe('GET /api/v1/reports/kyc/detailed', () => {
  it('should return filtered KYC stats', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: { total_submissions: '50', pending: '10', approved: '35', rejected: '5', avg_processing_time_hours: '3.2' },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/kyc/detailed', {
      qs: { date_from: '2025-01-01', status: 'approved' },
    }));
    expect(res.statusCode).toBe(200);
  });
});

// ─── GET /api/v1/reports/defaults ────────────────────────────────────

describe('GET /api/v1/reports/defaults', () => {
  it('should return default loan list', async () => {
    // Count query (queryOne) then data query (query)
    mockQueryOne.mockResolvedValueOnce({
      data: { count: '2' },
      error: null,
    });
    mockQuery.mockResolvedValueOnce({
      data: [
        { loan_id: 'loan-1', customer_name: 'John Doe', days_past_due: 45 },
        { loan_id: 'loan-2', customer_name: 'Jane Doe', days_past_due: 90 },
      ],
      error: null,
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/defaults'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.data).toHaveLength(2);
    expect((body as any).data.pagination).toBeDefined();
  });
});

// ─── GET /api/v1/reports/defaults/summary ────────────────────────────

describe('GET /api/v1/reports/defaults/summary', () => {
  it('should return PAR metrics', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_loans: '100',
        par_30_count: '15',
        par_60_count: '8',
        par_90_count: '3',
        total_outstanding: '200000',
        total_at_risk: '50000',
      },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/defaults/summary'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.par_30).toBe(15);
    expect((body as any).data.default_rate).toBe(25);
  });
});

// ─── GET /api/v1/reports/acquisition ─────────────────────────────────

describe('GET /api/v1/reports/acquisition', () => {
  it('should return acquisition funnel', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_customers: '500',
        kyc_completed: '350',
        kyc_pending: '100',
        kyc_rejected: '50',
        active_customers: '300',
      },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/acquisition'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.completion_rate).toBe(70);
  });
});

// ─── GET /api/v1/reports/revenue ─────────────────────────────────────

describe('GET /api/v1/reports/revenue', () => {
  it('should return monthly revenue breakdown', async () => {
    mockQuery.mockResolvedValueOnce({
      data: [
        { month: '2025-03', total: '15000', count: '40' },
        { month: '2025-02', total: '12000', count: '35' },
      ],
      error: null,
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/revenue'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data).toHaveLength(2);
  });

  it('should filter by date range', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });
    const res = await handler(makeEvent('GET', '/api/v1/reports/revenue', {
      qs: { date_from: '2025-01-01', date_to: '2025-03-31' },
    }));
    expect(res.statusCode).toBe(200);
  });
});

// ─── GET /api/v1/reports/loan-approvals ──────────────────────────────

describe('GET /api/v1/reports/loan-approvals', () => {
  it('should return approval breakdown', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: { total: '100', approved: '65', rejected: '25', pending: '10', auto_approved: '30' },
    });

    const res = await handler(makeEvent('GET', '/api/v1/reports/loan-approvals'));
    expect(res.statusCode).toBe(200);
    const body = parseResponseBody(res);
    expect((body as any).data.total).toBe(100);
    expect((body as any).data.auto_approved).toBe(30);
  });

  it('should return 500 with generic message on error', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('DB timeout'));
    const res = await handler(makeEvent('GET', '/api/v1/reports/loan-approvals'));
    expect(res.statusCode).toBe(500);
    const body = parseResponseBody(res);
    expect((body as any).error).not.toContain('DB timeout');
  });
});
