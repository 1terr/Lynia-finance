/**
 * Characterization tests for services/lock-service/src/index.ts
 *
 * Lambda handler with routing -- routes API Gateway events to lock and
 * handover service methods. Validates required fields, returns proper
 * HTTP status codes and security headers.
 */

// Set environment variables for TrustonicProvider constructor
process.env.TRUSTONIC_API_KEY = 'test-api-key';
process.env.TRUSTONIC_API_SECRET = 'test-api-secret';
process.env.TRUSTONIC_BASE_URL = 'https://api.trustonic.test/v1';
process.env.TRUSTONIC_ENV = 'sandbox';

// Mock all external dependencies before importing
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
}));

jest.mock('../../../services/shared/utils/response', () => ({
  getSecurityHeaders: jest.fn().mockReturnValue({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://lyniafinance.com',
  }),
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

// Helper to create a mock API Gateway event
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

describe('Lock Service Lambda Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
  });

  // ─── Route matching ────────────────────────────────────────
  describe('Route matching', () => {
    it('should return 404 for unknown routes', async () => {
      const event = makeEvent({ path: '/unknown/route', httpMethod: 'GET' });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toBe('Not Found');
    });

    it('should return 400 for wrong HTTP method', async () => {
      const event = makeEvent({ path: '/locks/lock', httpMethod: 'GET' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  // ─── POST /locks/lock ─────────────────────────────────────
  describe('POST /locks/lock', () => {
    it('should return 400 when device_id is missing', async () => {
      const event = makeEvent({
        path: '/locks/lock',
        httpMethod: 'POST',
        body: JSON.stringify({ reason: 'overdue' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 400 when reason is missing', async () => {
      const event = makeEvent({
        path: '/locks/lock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 200 on successful lock', async () => {
      // lockDevice: device select
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // update device
        .mockResolvedValueOnce({ data: null, error: null }) // insert history
        // getLockStatus:
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', locked_at: '2024-01-15T10:00:00Z', unlocked_at: null, lock_reason: 'overdue' },
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
      expect(body.lock_status).toBe('locked');
    });

    it('should return 200 with admin performer when admin_user_id provided', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', trustonic_device_id: 'tdev-001', imei: '123456789' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', locked_at: '2024-01-15T10:00:00Z', unlocked_at: null, lock_reason: 'manual' },
          error: null,
        });

      const event = makeEvent({
        path: '/locks/lock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001', reason: 'manual lock', admin_user_id: 'admin-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should return 500 when lockDevice throws', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
        .mockResolvedValue({ data: null, error: null });

      const event = makeEvent({
        path: '/locks/lock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-missing', reason: 'overdue' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error).toContain('Failed to lock device');
    });
  });

  // ─── POST /locks/unlock ───────────────────────────────────
  describe('POST /locks/unlock', () => {
    it('should return 400 when device_id is missing', async () => {
      const event = makeEvent({
        path: '/locks/unlock',
        httpMethod: 'POST',
        body: JSON.stringify({ reason: 'payment received' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when reason is missing', async () => {
      const event = makeEvent({
        path: '/locks/unlock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 200 on successful unlock', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'locked', trustonic_device_id: 'tdev-001' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: { id: 'dev-001', lock_status: 'unlocked', locked_at: null, unlocked_at: '2024-02-01T12:00:00Z', lock_reason: null },
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
      expect(body.lock_status).toBe('unlocked');
    });

    it('should return 500 when unlockDevice throws', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
        .mockResolvedValue({ data: null, error: null });

      const event = makeEvent({
        path: '/locks/unlock',
        httpMethod: 'POST',
        body: JSON.stringify({ device_id: 'dev-missing', reason: 'payment' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  // ─── POST /locks/process-scheduled ────────────────────────
  describe('POST /locks/process-scheduled', () => {
    it('should return 200 with processing result', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: [], error: null })  // overdue loans
        .mockResolvedValueOnce({ data: [], error: null }); // scheduled locks

      const event = makeEvent({
        path: '/locks/process-scheduled',
        httpMethod: 'POST',
        body: '{}',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.result).toBeDefined();
    });
  });

  // ─── GET /locks/:deviceId ─────────────────────────────────
  describe('GET /locks/:deviceId', () => {
    it('should return 200 with lock status', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: { id: 'dev-001', lock_status: 'unlocked', locked_at: null, unlocked_at: null, lock_reason: null },
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
      expect(body.device_id).toBe('dev-001');
    });

    it('should return 500 when device not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const event = makeEvent({
        path: '/locks/dev-missing',
        httpMethod: 'GET',
        pathParameters: { deviceId: 'dev-missing' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  // ─── POST /handovers/check-readiness ──────────────────────
  describe('POST /handovers/check-readiness', () => {
    it('should return 400 when loan_id is missing', async () => {
      const event = makeEvent({
        path: '/handovers/check-readiness',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('loan_id');
    });

    it('should return 200 with readiness result', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const event = makeEvent({
        path: '/handovers/check-readiness',
        httpMethod: 'POST',
        body: JSON.stringify({ loan_id: 'loan-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.ready).toBeDefined();
    });
  });

  // ─── POST /handovers/initiate ─────────────────────────────
  describe('POST /handovers/initiate', () => {
    it('should return 400 when required fields are missing', async () => {
      const event = makeEvent({
        path: '/handovers/initiate',
        httpMethod: 'POST',
        body: JSON.stringify({ loan_id: 'loan-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 500 when handover initiation fails', async () => {
      // checkHandoverReadiness fails
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const event = makeEvent({
        path: '/handovers/initiate',
        httpMethod: 'POST',
        body: JSON.stringify({
          loan_id: 'loan-001',
          device_id: 'dev-001',
          customer_id: 'cust-001',
          distributor_id: 'dist-001',
          handover_location: 'Office',
          handed_over_by: 'agent-001',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  // ─── POST /handovers/verify-identity ──────────────────────
  describe('POST /handovers/verify-identity', () => {
    it('should return 400 when handover_id is missing', async () => {
      const event = makeEvent({
        path: '/handovers/verify-identity',
        httpMethod: 'POST',
        body: JSON.stringify({ id_number: '12345678A90' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when id_number is missing', async () => {
      const event = makeEvent({
        path: '/handovers/verify-identity',
        httpMethod: 'POST',
        body: JSON.stringify({ handover_id: 'handover-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when verification fails', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: { id: 'handover-001', customer_id: 'cust-001' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // no KYC

      const event = makeEvent({
        path: '/handovers/verify-identity',
        httpMethod: 'POST',
        body: JSON.stringify({ handover_id: 'handover-001', id_number: '12345678A90' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.verified).toBe(false);
    });
  });

  // ─── POST /handovers/verify-deposit ───────────────────────
  describe('POST /handovers/verify-deposit', () => {
    it('should return 400 when handover_id is missing', async () => {
      const event = makeEvent({
        path: '/handovers/verify-deposit',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('handover_id');
    });

    it('should return appropriate status based on verification', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null }); // handover not found

      const event = makeEvent({
        path: '/handovers/verify-deposit',
        httpMethod: 'POST',
        body: JSON.stringify({ handover_id: 'handover-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  // ─── POST /handovers/device-condition ─────────────────────
  describe('POST /handovers/device-condition', () => {
    it('should return 400 when handover_id is missing', async () => {
      const event = makeEvent({
        path: '/handovers/device-condition',
        httpMethod: 'POST',
        body: JSON.stringify({ device_condition: { screen_condition: 'good' } }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when device_condition is missing', async () => {
      const event = makeEvent({
        path: '/handovers/device-condition',
        httpMethod: 'POST',
        body: JSON.stringify({ handover_id: 'handover-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 200 on successful recording', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = makeEvent({
        path: '/handovers/device-condition',
        httpMethod: 'POST',
        body: JSON.stringify({
          handover_id: 'handover-001',
          device_condition: {
            screen_condition: 'excellent',
            body_condition: 'good',
          },
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
    });
  });

  // ─── POST /handovers/complete ─────────────────────────────
  describe('POST /handovers/complete', () => {
    it('should return 400 when handover_id is missing', async () => {
      const event = makeEvent({
        path: '/handovers/complete',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toContain('handover_id');
    });

    it('should return 500 when completion fails', async () => {
      __mockExecute
        .mockResolvedValueOnce({ data: null, error: null }) // handover not found
        .mockResolvedValue({ data: null, error: null });

      const event = makeEvent({
        path: '/handovers/complete',
        httpMethod: 'POST',
        body: JSON.stringify({ handover_id: 'handover-001' }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  // ─── GET /handovers/:handoverId ───────────────────────────
  describe('GET /handovers/:handoverId', () => {
    it('should return 200 with handover status', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: {
          id: 'handover-001',
          status: 'initiated',
          identity_verified: false,
        },
        error: null,
      });

      const event = makeEvent({
        path: '/handovers/handover-001',
        httpMethod: 'GET',
        pathParameters: { handoverId: 'handover-001' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.id).toBe('handover-001');
    });

    it('should return 500 when handover not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const event = makeEvent({
        path: '/handovers/handover-missing',
        httpMethod: 'GET',
        pathParameters: { handoverId: 'handover-missing' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  // ─── Security headers ─────────────────────────────────────
  describe('Security headers', () => {
    it('should include security headers on all responses', async () => {
      const event = makeEvent({ path: '/unknown', httpMethod: 'GET' });
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Content-Type']).toBe('application/json');
    });
  });
});
