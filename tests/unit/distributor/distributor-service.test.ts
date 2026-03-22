/**
 * Characterization tests for Distributor Service
 *
 * These tests capture the CURRENT behavior of the monolith handler before
 * refactoring. They cover profile CRUD, dashboard stats, inventory,
 * handovers (list, submit, action steps), and commissions.
 *
 * Target: services/distributor-service/src/index.ts (489 lines)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

// ── Mocks (must be declared before handler import) ────────────────────

const mockExecute = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../../services/shared/clients/database', () => {
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

jest.mock('../../../services/shared/middleware/authorization', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  isAdminOrManager: (auth: { roles?: string[] }) =>
    auth?.roles?.some((r: string) => ['super_admin', 'admin', 'operations_manager'].includes(r)) ?? false,
}));

// Use REAL response implementations
jest.mock('../../../services/shared/utils/response', () => {
  const actual = jest.requireActual('../../../services/shared/utils/response');
  return actual;
});

const mockCompleteHandover = jest.fn();
const mockVerifyCustomerIdentity = jest.fn();
const mockVerifyDepositPayment = jest.fn();
const mockRecordDeviceCondition = jest.fn();

jest.mock('../../../services/lock-service/src/handover-service', () => ({
  HandoverService: jest.fn().mockImplementation(() => ({
    completeHandover: mockCompleteHandover,
    verifyCustomerIdentity: mockVerifyCustomerIdentity,
    verifyDepositPayment: mockVerifyDepositPayment,
    recordDeviceCondition: mockRecordDeviceCondition,
  })),
}));

// Mock direct import of completeHandover from handover-workflow
jest.mock('../../../services/lock-service/src/handover/handover-workflow', () => ({
  completeHandover: (...args: unknown[]) => mockCompleteHandover(...args),
  initiateHandover: jest.fn(),
}));

// Mock trigger-disbursement helper
jest.mock('../../../services/distributor-service/src/helpers/trigger-disbursement', () => ({
  triggerDisbursement: jest.fn().mockResolvedValue(true),
}));

// Mock logger
jest.mock('../../../services/shared/utils/logger', () => {
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

// ── Import handler AFTER mocks ────────────────────────────────────────

import { handler } from '../../../services/distributor-service/src/index';
import { db, query, queryOne } from '../../../services/shared/clients/database';

// ── Helpers ───────────────────────────────────────────────────────────

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

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Reset once-queues on shared mocks to prevent leakage between tests
  mockExecute.mockReset();
  (query as jest.Mock).mockReset();
  (queryOne as jest.Mock).mockReset();
  mockCompleteHandover.mockReset();
  mockGetAuthContext.mockReturnValue({
    userId: 'user-1',
    email: 'test@test.com',
    roles: ['distributor'],
  });
  mockRequireRole.mockReturnValue(undefined); // passes by default
  mockExecute.mockResolvedValue({ data: null, error: null });
  (query as jest.Mock).mockResolvedValue({ data: [] });
  (queryOne as jest.Mock).mockResolvedValue({ data: null, error: null });
});

// =====================================================================
// OPTIONS preflight
// =====================================================================

describe('OPTIONS preflight', () => {
  it('should return 204 with security headers', async () => {
    const event = createEvent({ httpMethod: 'OPTIONS', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
    expect(response.headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
    expect(response.headers).toHaveProperty('X-Frame-Options', 'DENY');
  });
});

// =====================================================================
// GET /api/v1/distributor/profile
// =====================================================================

describe('GET /api/v1/distributor/profile', () => {
  it('should return distributor profile when found', async () => {
    const profile = { id: 'dist-1', user_id: 'user-1', name: 'Test Distributor' };
    mockExecute.mockResolvedValueOnce({ data: profile, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(profile);
  });

  it('should return 404 when profile not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    const body = parseBody(response);
    expect(body.success).toBe(false);
  });

  it('should return 500 on database error', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: new Error('connection timeout') });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
  });

  it('should call requireRole with distributor', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1' }, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
    await handler(event);

    expect(mockRequireRole).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      'distributor', 'super_admin', 'admin', 'operations_manager'
    );
  });
});

// =====================================================================
// PATCH /api/v1/distributor/profile
// =====================================================================

describe('PATCH /api/v1/distributor/profile', () => {
  it('should update allowed fields', async () => {
    const updated = { id: 'dist-1', phone_number: '+263771000000', updated_at: expect.any(String) };
    mockExecute.mockResolvedValueOnce({ data: updated, error: null });

    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/api/v1/distributor/profile',
      body: JSON.stringify({ phone_number: '+263771000000' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.success).toBe(true);
  });

  it('should reject empty updates with 400', async () => {
    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/api/v1/distributor/profile',
      body: JSON.stringify({ not_allowed_field: 'value' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = parseBody(response);
    expect(body.error).toContain('No valid fields');
  });

  it('should return 500 when update fails', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/api/v1/distributor/profile',
      body: JSON.stringify({ email: 'new@test.com' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = parseBody(response);
    expect(body.error).toContain('Failed to update');
  });

  it('should reject invalid JSON body', async () => {
    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/api/v1/distributor/profile',
      body: 'not-valid-json{',
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
  });
});

// =====================================================================
// GET /api/v1/distributor/stats
// =====================================================================

describe('GET /api/v1/distributor/stats', () => {
  it('should return dashboard stats with pending handovers count', async () => {
    const dist = {
      id: 'dist-1',
      total_devices_distributed: 10,
      current_inventory_count: 5,
      total_commissions_earned: 1000,
      total_commissions_paid: 800,
      pending_commissions: 200,
      average_rating: 4.5,
    };
    mockExecute.mockResolvedValueOnce({ data: dist, error: null });
    (query as jest.Mock)
      .mockResolvedValueOnce({ data: [{ count: '3' }] }) // pending handovers
      .mockResolvedValueOnce({ data: [{ count: '7' }] }) // monthly handovers
      .mockResolvedValueOnce({ data: [{ count: '2' }] }); // last month handovers

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/stats' });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.success).toBe(true);
    expect(body.data.pending_handovers).toBe(3);
    expect(body.data.monthly_handovers).toBe(7);
    expect(body.data.last_month_handovers).toBe(2);
    expect(body.data.total_devices_distributed).toBe(10);
    expect(body.data.current_inventory).toBe(5);
  });

  it('should return 404 when distributor not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/stats' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });
});

// =====================================================================
// GET /api/v1/distributor/inventory
// =====================================================================

describe('GET /api/v1/distributor/inventory', () => {
  it('should return device list', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1' }, error: null });
    const devices = [
      { id: 'd1', brand: 'Samsung', model: 'A14', imei: '123456789012345' },
    ];
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
// GET /api/v1/distributor/handovers
// =====================================================================

describe('GET /api/v1/distributor/handovers', () => {
  it('should return handovers list', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1' }, error: null });
    const handovers = [
      { id: 'h1', status: 'initiated', customer_name: 'John', loan_amount: '200.00', commission_earned: '10.00' },
    ];
    // queryOne for count, then query for handovers
    (queryOne as jest.Mock).mockResolvedValueOnce({ data: { count: '1' }, error: null });
    (query as jest.Mock).mockResolvedValueOnce({ data: handovers });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/handovers' });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    // Handler now returns paginated response: { data: [...], pagination: {...} }
    // DECIMAL columns are converted from strings to numbers
    expect(body.data.data).toEqual([
      { id: 'h1', status: 'initiated', customer_name: 'John', loan_amount: 200, commission_earned: 10 },
    ]);
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.page).toBe(1);
  });

  it('should support ?status=X filter', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1' }, error: null });
    // queryOne for count, then query for handovers
    (queryOne as jest.Mock).mockResolvedValueOnce({ data: { count: '0' }, error: null });
    (query as jest.Mock).mockResolvedValueOnce({ data: [] });

    const event = createEvent({
      httpMethod: 'GET',
      path: '/api/v1/distributor/handovers',
      queryStringParameters: { status: 'completed' },
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    // Verify the query received status filter parameter (now the second call after queryOne count)
    expect((query as jest.Mock)).toHaveBeenCalledWith(
      expect.stringContaining('$2'),
      expect.arrayContaining(['dist-1', 'completed'])
    );
  });

  it('should return 404 when distributor not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/handovers' });
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
    // resolveDistributor: fetch distributor
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1', user_id: 'user-1' }, error: null });
    // loan check query
    (query as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'loan-1', status: 'paid_deposit', loan_amount_usd: 200 }] })
      // existing handover check
      .mockResolvedValueOnce({ data: [] })
      // deposit verification check
      .mockResolvedValueOnce({ data: [{ id: 'pay-1', status: 'completed' }] });
    // db.insert (create handover record)
    mockExecute.mockResolvedValueOnce({ data: { id: 'h-new' }, error: null });

    mockCompleteHandover.mockResolvedValueOnce({
      success: true,
      loan_id: 'loan-1',
      commission: { amount: 50, percentage: 5 },
    });

    // query for next_payment_date after completion
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
    expect(body.data.loan_id).toBe('loan-1');
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

  it('should return 500 on database error resolving distributor', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: new Error('connection timeout') });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers',
      body: JSON.stringify(validBody),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
  });

  it('should return 409 when loan already has a completed handover', async () => {
    // resolveDistributor
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1', user_id: 'user-1' }, error: null });
    // loan check
    (query as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'loan-1', status: 'paid_deposit', loan_amount_usd: 200 }] })
      // existing handover check — already exists
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
    // Owner check passes
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
  it('should require imei and expected_imei', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'h-1' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/verify-imei',
      body: JSON.stringify({ imei: '123456789012345' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = parseBody(response);
    expect(body.error).toContain('imei and expected_imei are required');
  });

  it('should validate 15-digit IMEI format', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'h-1' }] });

    const event = createEvent({
      httpMethod: 'POST',
      path: '/api/v1/distributor/handovers/abc-123/verify-imei',
      body: JSON.stringify({ imei: '12345', expected_imei: '12345' }),
    });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body.data.verified).toBe(false);
    expect(body.data.message).toContain('15 digits');
  });

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
    expect(body.data.message).toContain('verified');
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
    expect(body.data.message).toContain('does not match');
  });
});

// =====================================================================
// POST /api/v1/distributor/handovers/:id/complete
// =====================================================================

describe('POST /api/v1/distributor/handovers/:id/complete', () => {
  it('should delegate to completeHandover from workflow', async () => {
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
// GET /api/v1/distributor/commissions
// =====================================================================

describe('GET /api/v1/distributor/commissions', () => {
  it('should return commissions list', async () => {
    mockExecute.mockResolvedValueOnce({ data: { id: 'dist-1' }, error: null });
    const commissions = [
      { id: 'c1', commission_amount: '50.00', commission_percentage: '5.00', device_retail_price: '199.00', payment_status: 'paid' },
    ];
    // queryOne for count, then query for commissions
    (queryOne as jest.Mock).mockResolvedValueOnce({ data: { count: '1' }, error: null });
    (query as jest.Mock).mockResolvedValueOnce({ data: commissions });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/commissions' });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    // Handler now returns paginated response: { data: [...], pagination: {...} }
    // DECIMAL columns are converted from strings to numbers
    expect(body.data.data).toEqual([
      { id: 'c1', commission_amount: 50, commission_percentage: 5, device_retail_price: 199, payment_status: 'paid' },
    ]);
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.page).toBe(1);
  });

  it('should return 404 when distributor not found', async () => {
    mockExecute.mockResolvedValueOnce({ data: null, error: null });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/commissions' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });
});

// =====================================================================
// Unknown routes
// =====================================================================

describe('Unknown route', () => {
  it('should return 404 for unknown path', async () => {
    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/nonexistent' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
  });

  it('should return 405 for wrong method on known path', async () => {
    const event = createEvent({ httpMethod: 'DELETE', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(405);
  });
});

// =====================================================================
// Error handling
// =====================================================================

describe('Error handling', () => {
  it('should return 403 when error has statusCode 403', async () => {
    mockRequireRole.mockImplementation(() => {
      const err = new Error('Insufficient permissions');
      (err as unknown as Record<string, unknown>).statusCode = 403;
      throw err;
    });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(403);
    const body = parseBody(response);
    expect(body.error).toContain('Insufficient permissions');
  });

  it('should return 500 for unexpected errors', async () => {
    mockGetAuthContext.mockImplementation(() => {
      throw new Error('Unexpected failure');
    });

    const event = createEvent({ httpMethod: 'GET', path: '/api/v1/distributor/profile' });
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = parseBody(response);
    expect(body.error).toContain('Internal server error');
  });
});
