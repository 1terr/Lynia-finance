/**
 * Integration Tests: Form Submission Service
 * Tests the form-submission-service Lambda handler with mocked database interactions.
 * Covers contact, partnership, and waitlist form submissions.
 * This is a public endpoint — no Cognito authorizer required.
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

import { handler } from '../../services/form-submission-service/src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/forms/submit',
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
      authorizer: {},
      httpMethod: overrides.httpMethod || 'POST',
      identity: { sourceIp: '127.0.0.1' } as never,
      path: overrides.path || '/forms/submit',
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

describe('Form Submission Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ data: [], error: null });
  });

  // =========================================================================
  // Contact form
  // =========================================================================
  describe('POST /forms/submit (type: contact)', () => {
    it('should submit contact form successfully', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({
        body: JSON.stringify({
          type: 'contact',
          name: 'John Moyo',
          phone: '+263771234567',
          email: 'john@example.com',
          message: 'I want to learn about your services.',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should submit contact form without optional email', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({
        body: JSON.stringify({
          type: 'contact',
          name: 'Jane',
          phone: '0771234567',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when name is missing', async () => {
      const event = createEvent({
        body: JSON.stringify({
          type: 'contact',
          phone: '+263771234567',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Name is required');
    });

    it('should return 400 for invalid phone number', async () => {
      const event = createEvent({
        body: JSON.stringify({
          type: 'contact',
          name: 'John',
          phone: '12345',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('phone number');
    });

    it('should return 400 for invalid email', async () => {
      const event = createEvent({
        body: JSON.stringify({
          type: 'contact',
          name: 'John',
          phone: '+263771234567',
          email: 'not-an-email',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('email');
    });

    it('should return 500 when database insert fails', async () => {
      mockExecute.mockResolvedValueOnce({
        data: null,
        error: { message: 'Connection timeout' },
      });

      const event = createEvent({
        body: JSON.stringify({
          type: 'contact',
          name: 'John',
          phone: '+263771234567',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // Partnership form
  // =========================================================================
  describe('POST /forms/submit (type: partnership)', () => {
    it('should submit partnership application successfully', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({
        body: JSON.stringify({
          type: 'partnership',
          name: 'Acme Phones Ltd',
          phone: '+263771234567',
          email: 'biz@acme.co.zw',
          partner_type: 'distributor',
          message: 'We want to distribute devices in Harare.',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 400 for missing email in partnership', async () => {
      const event = createEvent({
        body: JSON.stringify({
          type: 'partnership',
          name: 'Acme',
          phone: '+263771234567',
          partner_type: 'distributor',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('email');
    });

    it('should return 400 for invalid partner_type', async () => {
      const event = createEvent({
        body: JSON.stringify({
          type: 'partnership',
          name: 'Acme',
          phone: '+263771234567',
          email: 'biz@acme.co.zw',
          partner_type: 'invalid_type',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('partnership type');
    });
  });

  // =========================================================================
  // Waitlist form
  // =========================================================================
  describe('POST /forms/submit (type: waitlist)', () => {
    it('should add phone to waitlist', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({
        body: JSON.stringify({
          type: 'waitlist',
          phone: '+263771234567',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 400 for invalid phone on waitlist', async () => {
      const event = createEvent({
        body: JSON.stringify({
          type: 'waitlist',
          phone: '000',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should silently succeed for duplicate waitlist entry', async () => {
      mockExecute.mockResolvedValueOnce({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      });

      const event = createEvent({
        body: JSON.stringify({
          type: 'waitlist',
          phone: '+263771234567',
        }),
      });
      const response = await handler(event);

      // The handler silently returns 200 for duplicates
      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Invalid form type
  // =========================================================================
  describe('Invalid form type', () => {
    it('should return 400 for unknown form type', async () => {
      const event = createEvent({
        body: JSON.stringify({ type: 'unknown' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid form type');
    });

    it('should return 400 for missing type', async () => {
      const event = createEvent({
        body: JSON.stringify({ name: 'test' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // Method not allowed
  // =========================================================================
  describe('Method not allowed', () => {
    it('should return 405 for GET request', async () => {
      const event = createEvent({ httpMethod: 'GET' });
      const response = await handler(event);

      expect(response.statusCode).toBe(405);
    });
  });

  // =========================================================================
  // OPTIONS preflight
  // =========================================================================
  describe('OPTIONS preflight', () => {
    it('should return 204 for CORS preflight', async () => {
      const event = createEvent({ httpMethod: 'OPTIONS' });
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
    });
  });

  // =========================================================================
  // Invalid JSON
  // =========================================================================
  describe('Invalid JSON body', () => {
    it('should return 400 for malformed JSON', async () => {
      const event = createEvent({ body: '{invalid json' });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid JSON');
    });
  });
});
