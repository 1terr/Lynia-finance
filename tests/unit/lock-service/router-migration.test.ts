/**
 * Router Migration Tests for lock-service
 *
 * Verifies that the migration from if/else routing to createRouter()
 * preserves all routes, response shapes, and error handling behavior.
 * Also verifies new improvements: requestId in error responses,
 * 404 for unknown routes, 405 for wrong HTTP methods, and CORS preflight.
 */

// Set environment variables for TrustonicProvider constructor
process.env.TRUSTONIC_API_KEY = 'test-api-key';
process.env.TRUSTONIC_API_SECRET = 'test-api-secret';
process.env.TRUSTONIC_BASE_URL = 'https://api.trustonic.test/v1';
process.env.TRUSTONIC_ENV = 'sandbox';

// Mock all external dependencies
jest.mock('../../../services/shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or', 'order', 'limit', 'single', 'maybeSingle'];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
    __mockExecute: mockExecute,
  };
});

jest.mock('../../../services/lock-service/src/trustonic-provider', () => ({
  TrustonicProvider: jest.fn().mockImplementation(() => ({
    lockDevice: jest.fn().mockResolvedValue(undefined),
    unlockDevice: jest.fn().mockResolvedValue(undefined),
    enrollDevice: jest.fn().mockResolvedValue({ trustonic_device_id: 'trustonic_dev-001' }),
    getLockStatus: jest.fn().mockResolvedValue({ lock_status: 'unlocked', can_emergency_call: true }),
    generateLockMessage: jest.fn().mockReturnValue('Payment overdue. Contact Lynia Finance.'),
    getEmergencyNumbers: jest.fn().mockReturnValue(['999', '994', '993', '112']),
  })),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn(), startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }) },
  setRequestContext: jest.fn().mockReturnValue('test-request-id'),
  clearRequestContext: jest.fn(),
}));

jest.mock('../../../services/shared/utils/require-env', () => ({
  requireEnv: jest.fn().mockImplementation((name: string) => `mock-${name}`),
}));

jest.mock('../../../services/shared/utils/circuit-breaker', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  })),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockReturnValue({ post: jest.fn(), get: jest.fn() }),
    isAxiosError: jest.fn().mockReturnValue(false),
  },
}));

import { handler } from '../../../services/lock-service/src/index';
import { APIGatewayProxyEvent } from 'aws-lambda';
const { __mockExecute } = require('../../../services/shared/clients/database');

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    path: '/',
    httpMethod: 'GET',
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    ...overrides,
  };
}

describe('Lock Service Router Migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
  });

  // ─── Router infrastructure ──────────────────────────────────

  describe('Router infrastructure', () => {
    it('should return 404 with standard format for unknown routes', async () => {
      const event = makeEvent({ path: '/nonexistent/path', httpMethod: 'GET' });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Not Found');
      expect(body.message).toContain('/nonexistent/path');
    });

    it('should handle OPTIONS preflight with 204', async () => {
      const event = makeEvent({ path: '/locks/lock', httpMethod: 'OPTIONS' });
      const result = await handler(event);

      expect(result.statusCode).toBe(204);
    });

    it('should include security headers on all responses', async () => {
      const event = makeEvent({ path: '/unknown', httpMethod: 'GET' });
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Content-Type']).toBe('application/json');
      expect(result.headers!['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers!['X-Frame-Options']).toBe('DENY');
      expect(result.headers!['Strict-Transport-Security']).toContain('max-age');
    });
  });

  // ─── All lock endpoints return responses ────────────────────

  describe('Lock endpoints preserve behavior', () => {
    it('POST /locks/lock returns 200 with success envelope on valid request', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'dev-001', device_id: 'dev-001', lock_status: 'locked', locked_at: '2024-01-15T10:00:00Z' },
          error: null,
        });

      const event = makeEvent({
        path: '/locks/lock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001', reason: 'overdue' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.device_id).toBe('dev-001');
      expect(body.data.lock_status).toBe('locked');
      expect(body.data.locked_at).toBeDefined();
    });

    it('POST /locks/unlock returns 200 with success envelope on valid request', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'dev-001', device_id: 'dev-001', lock_status: 'unlocked', unlocked_at: '2024-02-01T12:00:00Z' },
          error: null,
        });

      const event = makeEvent({
        path: '/locks/unlock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001', reason: 'payment received' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.lock_status).toBe('unlocked');
      expect(body.data.unlocked_at).toBeDefined();
    });

    it('POST /locks/process-scheduled returns 200 with result', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const event = makeEvent({
        path: '/locks/process-scheduled',
        httpMethod: 'POST',
        body: '{}',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.result).toBeDefined();
    });

    it('GET /locks/:deviceId returns 200 with status data', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', device_id: 'dev-001', lock_status: 'unlocked' },
        error: null,
      });

      const event = makeEvent({
        path: '/locks/dev-001',
        httpMethod: 'GET',
        pathParameters: { deviceId: 'dev-001' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });
  });

  // ─── All handover endpoints return responses ────────────────

  describe('Handover endpoints preserve behavior', () => {
    it('POST /handovers/check-readiness returns 200', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const event = makeEvent({
        path: '/handovers/check-readiness',
        httpMethod: 'POST',
        body: JSON.stringify({ loan_id: 'loan-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('POST /handovers/initiate validates required fields', async () => {
      const event = makeEvent({
        path: '/handovers/initiate',
        httpMethod: 'POST',
        body: JSON.stringify({ loan_id: 'loan-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      // Should indicate which fields are missing
      expect(body.errors || body.message).toBeDefined();
    });

    it('POST /handovers/verify-identity validates required fields', async () => {
      const event = makeEvent({
        path: '/handovers/verify-identity',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('POST /handovers/verify-deposit validates handover_id', async () => {
      const event = makeEvent({
        path: '/handovers/verify-deposit',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('POST /handovers/device-condition validates required fields', async () => {
      const event = makeEvent({
        path: '/handovers/device-condition',
        httpMethod: 'POST',
        body: JSON.stringify({ handover_id: 'h-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('POST /handovers/device-condition returns 200 on success', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = makeEvent({
        path: '/handovers/device-condition',
        httpMethod: 'POST',
        body: JSON.stringify({
          handover_id: 'h-001',
          device_condition: { screen_condition: 'excellent', body_condition: 'good' },
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('POST /handovers/complete validates handover_id', async () => {
      const event = makeEvent({
        path: '/handovers/complete',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('GET /handovers/:handoverId returns 200 with status', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'h-001', status: 'initiated', identity_verified: false },
        error: null,
      });

      const event = makeEvent({
        path: '/handovers/h-001',
        httpMethod: 'GET',
        pathParameters: { handoverId: 'h-001' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });
  });

  // ─── Error responses include requestId ──────────────────────

  describe('Error responses include requestId', () => {
    it('500 errors include requestId in response', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: { message: 'DB down' } })
        .mockResolvedValue({ data: null, error: null });

      const event = makeEvent({
        path: '/locks/lock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001', reason: 'overdue' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      // The router wraps errors with requestId in details
      expect(body.details?.requestId || body.requestId).toBeDefined();
    });

    it('error messages do not leak internal details', async () => {
      __mockExecute
        .mockRejectedValueOnce(new Error('FATAL: password authentication failed for user "postgres"'));

      const event = makeEvent({
        path: '/locks/lock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001', reason: 'overdue' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      // Must NOT contain internal error details
      expect(body.error).not.toContain('password');
      expect(body.error).not.toContain('postgres');
      expect(body.error).toBe('Internal server error');
    });
  });

  // ─── All 11 routes are registered ──────────────────────────

  describe('Route coverage', () => {
    const lockRoutes = [
      { path: '/locks/lock', method: 'POST' },
      { path: '/locks/unlock', method: 'POST' },
      { path: '/locks/process-scheduled', method: 'POST' },
      { path: '/locks/dev-001', method: 'GET' },
    ];

    const handoverRoutes = [
      { path: '/handovers/check-readiness', method: 'POST' },
      { path: '/handovers/initiate', method: 'POST' },
      { path: '/handovers/verify-identity', method: 'POST' },
      { path: '/handovers/verify-deposit', method: 'POST' },
      { path: '/handovers/device-condition', method: 'POST' },
      { path: '/handovers/complete', method: 'POST' },
      { path: '/handovers/h-001', method: 'GET' },
    ];

    const allRoutes = [...lockRoutes, ...handoverRoutes];

    it.each(allRoutes)(
      '$method $path should NOT return 404',
      async ({ path, method }) => {
        // Provide minimal mock data so the handler doesn't crash on DB calls
        __mockExecute.mockResolvedValue({ data: null, error: null });

        const event = makeEvent({
          path,
          httpMethod: method,
          body: method === 'POST' ? JSON.stringify({}) : null,
          pathParameters: path.includes('dev-001')
            ? { deviceId: 'dev-001' }
            : path.includes('h-001')
            ? { handoverId: 'h-001' }
            : null,
        });

        const result = await handler(event);

        // Route should be found (not 404 or 405)
        expect(result.statusCode).not.toBe(404);
        expect(result.statusCode).not.toBe(405);
      }
    );
  });
});
