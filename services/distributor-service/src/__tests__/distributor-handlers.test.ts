/**
 * Distributor Service Handlers - Unit Tests
 *
 * Tests the distributor service monolith handler routes:
 *   GET    /api/v1/distributor/profile     - Get distributor profile
 *   PATCH  /api/v1/distributor/profile     - Update distributor profile
 *   GET    /api/v1/distributor/stats       - Dashboard stats
 *   GET    /api/v1/distributor/inventory   - Device inventory
 *   GET    /api/v1/distributor/handovers   - List handovers
 *   POST   /api/v1/distributor/handovers   - Create handover
 *   GET    /api/v1/distributor/commissions - Commission records
 *   POST   /api/v1/distributor/handovers/:id/verify-identity - Verify identity
 *   POST   /api/v1/distributor/handovers/:id/verify-imei     - Verify IMEI
 *   POST   /api/v1/distributor/handovers/:id/complete        - Complete handover
 *
 * All database calls, auth middleware, and external services are mocked.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks (must be declared before handler import)
// ---------------------------------------------------------------------------

const mockExecute = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../../shared/clients/database', () => {
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = [
      'select', 'insert', 'update', 'delete',
      'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is',
      'order', 'limit', 'single', 'maybeSingle',
    ];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: {
      from: jest.fn().mockImplementation(() => createChain()),
    },
    query: jest.fn().mockResolvedValue({ data: [] }),
    queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
});

const mockGetAuthContext = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('../../../shared/middleware/authorization', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  isAdminOrManager: (auth: { roles?: string[] }) =>
    auth?.roles?.some((r: string) => ['super_admin', 'admin', 'operations_manager'].includes(r)) ?? false,
}));

// Use REAL response implementations
jest.mock('../../../shared/utils/response', () => {
  const actual = jest.requireActual('../../../shared/utils/response');
  return actual;
});

const mockCompleteHandover = jest.fn();
const mockVerifyCustomerIdentity = jest.fn();
const mockVerifyDepositPayment = jest.fn();
const mockRecordDeviceCondition = jest.fn();

jest.mock('../../../lock-service/src/handover-service', () => ({
  HandoverService: jest.fn().mockImplementation(() => ({
    completeHandover: mockCompleteHandover,
    verifyCustomerIdentity: mockVerifyCustomerIdentity,
    verifyDepositPayment: mockVerifyDepositPayment,
    recordDeviceCondition: mockRecordDeviceCondition,
  })),
}));

jest.mock('../../../lock-service/src/handover/handover-workflow', () => ({
  completeHandover: (...args: unknown[]) => mockCompleteHandover(...args),
  initiateHandover: jest.fn(),
}));

jest.mock('../helpers/trigger-disbursement', () => ({
  triggerDisbursement: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../shared/utils/logger', () => {
  const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return {
    __esModule: true,
    default: loggerMock,
    logger: loggerMock,
    setRequestContext: jest.fn().mockReturnValue('test-req-id'),
    getRequestContext: jest.fn().mockReturnValue(null),
    clearRequestContext: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ end: jest.fn() }),
    log: jest.fn(),
    maskPhone: jest.fn((p: string) => p),
    maskNationalId: jest.fn((n: string) => n),
    maskSensitiveData: jest.fn((o: unknown) => o),
    LogLevel: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
  };
});

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------

import { handler } from '../index';
import { db, query, queryOne } from '../../../shared/clients/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/api/v1/distributor/profile',
    body: null,
    headers: { origin: 'https://lyniafinance.com' },
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      authorizer: {
        claims: {
          sub: 'user-1',
          email: 'test@test.com',
          'cognito:groups': 'distributor',
        },
      },
      protocol: 'HTTP/1.1',
      httpMethod: overrides.httpMethod || 'GET',
      identity: {
        accessKey: null, accountId: null, apiKey: null, apiKeyId: null,
        caller: null, clientCert: null, cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null, cognitoIdentityId: null,
        cognitoIdentityPoolId: null, principalOrgId: null,
        sourceIp: '127.0.0.1', user: null, userAgent: 'jest-test', userArn: null,
      },
      path: overrides.path || '/api/v1/distributor/profile',
      stage: 'test',
      requestId: 'test-req-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: overrides.path || '/api/v1/distributor/profile',
    },
    resource: overrides.path || '/api/v1/distributor/profile',
    ...overrides,
  };
}

function parseBody(response: { body: string }) {
  return JSON.parse(response.body);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  (query as jest.Mock).mockReset();
  (queryOne as jest.Mock).mockReset();
  mockCompleteHandover.mockReset();
  mockGetAuthContext.mockReturnValue({
    userId: 'user-1',
    email: 'test@test.com',
    roles: ['distributor'],
  });
  mockRequireRole.mockReturnValue(undefined);
  mockExecute.mockResolvedValue({ data: null, error: null });
  (query as jest.Mock).mockResolvedValue({ data: [] });
  (queryOne as jest.Mock).mockResolvedValue({ data: null, error: null });
});

// =====================================================================
// GET /api/v1/distributor/profile
// =====================================================================

describe('GET /api/v1/distributor/profile', () => {
  it('should return distributor profile when found', async () => {
    const profile = { id: 'dist-1', user_id: 'user-1', name: 'Test Distributor' };
    mockExecute.mockResolvedValueOnce({ data: profile, error: null });

    const event = createEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(profile);
  });

  it('should return 404 when profile not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });

  it('should return 500 on database error', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: new Error('timeout') });

    const event = createEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
  });
});

// =====================================================================
// GET /api/v1/distributor/inventory
// =====================================================================

describe('GET /api/v1/distributor/inventory', () => {
  it('should return device list', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1' }, error: null });
    const devices = [{ id: 'd1', brand: 'Samsung', model: 'A14' }];
    (query as jest.Mock).mockResolvedValueOnce({ data: devices });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/inventory' });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(devices);
  });

  it('should return 404 when distributor not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/inventory' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });
});

// =====================================================================
// GET /api/v1/distributor/commissions
// =====================================================================

describe('GET /api/v1/distributor/commissions', () => {
  it('should return commissions list with pagination', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1' }, error: null });
    const commissions = [
      { id: 'c1', commission_amount: '50.00', commission_percentage: '5.00', device_retail_price: '199.00', payment_status: 'paid' },
    ];
    (queryOne as jest.Mock).mockResolvedValueOnce({ data: { count: '1' }, error: null });
    (query as jest.Mock).mockResolvedValueOnce({ data: commissions });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/commissions' });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.data.data).toEqual([
      { id: 'c1', commission_amount: 50, commission_percentage: 5, device_retail_price: 199, payment_status: 'paid' },
    ]);
    expect(body.data.pagination).toBeDefined();
  });

  it('should return 404 when distributor not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/commissions' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });
});

// =====================================================================
// POST /api/v1/distributor/handovers
// =====================================================================

describe('POST /api/v1/distributor/handovers', () => {
  const validBody = {
    loan_id: 'loan-1',
    customer_id: 'cust-1',
    device_id: 'dev-1',
    customer_national_id: '12-345678A90',
    device_imei: '123456789012345',
    device_condition: { screen: 'good' },
    device_photos: ['photo1.jpg'],
    signature_data_url: 'data:image/png;base64,...',
    deposit_payment_method: 'ecocash',
    deposit_transaction_ref: 'TX123',
  };

  it('should submit handover successfully', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1', user_id: 'user-1' }, error: null });
    (query as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'loan-1', status: 'paid_deposit', loan_amount_usd: 200 }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 'pay-1', status: 'completed' }] });
    mockExecute.mockResolvedValueOnce({ data: { id: 'h-new' }, error: null });

    mockCompleteHandover.mockResolvedValueOnce({
      success: true,
      loan_id: 'loan-1',
      commission: { amount: 50, percentage: 5 },
    });
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ next_payment_date: '2026-04-04' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers',
      body: JSON.stringify(validBody),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    const body = parseBody(response);
    expect(body.success).toBe(true);
  });

  it('should return 404 when distributor not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers',
      body: JSON.stringify(validBody),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });

  it('should return 409 when handover already completed', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1', user_id: 'user-1' }, error: null });
    (query as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'loan-1', status: 'paid_deposit', loan_amount_usd: 200 }] })
      .mockResolvedValueOnce({ data: [{ id: 'h-existing' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers',
      body: JSON.stringify(validBody),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(409);
    const body = parseBody(response);
    expect(body.error).toContain('already been completed');
  });
});

// =====================================================================
// POST /api/v1/distributor/handovers/:id/verify-identity
// =====================================================================

describe('POST /api/v1/distributor/handovers/:id/verify-identity', () => {
  it('should require national_id in body', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'h-1' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/verify-identity',
      body: JSON.stringify({}),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = parseBody(response);
    expect(body.error).toContain('national_id is required');
  });

  it('should verify identity and return result', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'h-1' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/verify-identity',
      body: JSON.stringify({ national_id: '12-345678A90' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.data.verified).toBe(true);
  });

  it('should return 404 when handover not owned by distributor', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/verify-identity',
      body: JSON.stringify({ national_id: '12-345678A90' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });
});

// =====================================================================
// POST /api/v1/distributor/handovers/:id/verify-imei
// =====================================================================

describe('POST /api/v1/distributor/handovers/:id/verify-imei', () => {
  it('should return verified true when IMEI matches and is 15 digits', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'h-1' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/verify-imei',
      body: JSON.stringify({ imei: '123456789012345', expected_imei: '123456789012345' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.data.verified).toBe(true);
  });

  it('should return verified false when IMEI does not match', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'h-1' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/verify-imei',
      body: JSON.stringify({ imei: '123456789012345', expected_imei: '999999999999999' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.data.verified).toBe(false);
  });
});

// =====================================================================
// POST /api/v1/distributor/handovers/:id/complete
// =====================================================================

describe('POST /api/v1/distributor/handovers/:id/complete', () => {
  it('should delegate to completeHandover', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'h-1' }] });
    mockCompleteHandover.mockResolvedValueOnce({
      success: true,
      loan_id: 'loan-1',
      commission: { amount: 75, percentage: 5 },
    });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/complete',
      body: JSON.stringify({}),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(mockCompleteHandover).toHaveBeenCalledWith('abc-123');
  });
});

// =====================================================================
// Error handling
// =====================================================================

describe('Error handling', () => {
  it('should return 403 when authorization fails', async () => {
    mockRequireRole.mockImplementation(() => {
      const err = new Error('Insufficient permissions');
      (err as unknown as Record<string, unknown>).statusCode = 403;
      throw err;
    });

    const event = createEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(403);
    const body = parseBody(response);
    expect(body.error).toContain('Insufficient permissions');
  });

  it('should return 500 for unexpected errors', async () => {
    mockGetAuthContext.mockImplementation(() => {
      throw new Error('Unexpected failure');
    });

    const event = createEvent();
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = parseBody(response);
    expect(body.error).toContain('Internal server error');
  });

  it('should return 404 for unknown routes', async () => {
    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/nonexistent' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });

  it('should return 405 for wrong method on known route', async () => {
    const event = createEvent({ httpMethod: 'DELETE', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(405);
  });
});

// =====================================================================
// OPTIONS preflight
// =====================================================================

describe('OPTIONS preflight', () => {
  it('should return 204 with security headers', async () => {
    const event = createEvent({ httpMethod: 'OPTIONS' });
    const response = await handler(event);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
  });
});
