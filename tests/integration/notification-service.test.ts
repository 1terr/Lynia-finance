/**
 * Integration Tests: Notification Service
 * Tests the notification-service Lambda handler with mocked database interactions.
 * Covers send notification, reminder processing, analytics, opt-in/opt-out,
 * and notification history endpoints.
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

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ data: { success: true } }) },
}));

jest.mock('../../services/notification-service/src/sms-sender', () => ({
  sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'sns-mock-123' }),
  SmsError: class SmsError extends Error {
    constructor(message: string, public code: string, public details?: Record<string, unknown>) {
      super(message);
      this.name = 'SmsError';
    }
  },
}));

jest.mock('../../services/notification-service/src/email-sender', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'ses-mock-123' }),
  EmailError: class EmailError extends Error {
    constructor(message: string, public code: string, public details?: Record<string, unknown>) {
      super(message);
      this.name = 'EmailError';
    }
  },
}));

// Mock the reminder-scheduler module
jest.mock('../../services/notification-service/src/reminder-scheduler', () => ({
  processPaymentReminders: jest.fn().mockResolvedValue({ sent: 5, failed: 0, skipped: 2 }),
  getReminderAnalytics: jest.fn().mockResolvedValue({
    total_sent: 100,
    total_delivered: 95,
    total_failed: 5,
  }),
  handleReminderOptOut: jest.fn().mockResolvedValue(undefined),
  handleReminderOptIn: jest.fn().mockResolvedValue(undefined),
}));

import { handler } from '../../services/notification-service/src/index';

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
      authorizer: {},
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

describe('Notification Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ data: [], error: null });
  });

  // =========================================================================
  // POST /notifications/send
  // =========================================================================
  describe('POST /notifications/send', () => {
    it('should send notification successfully', async () => {
      // 1st call: get customer
      mockExecute
        .mockResolvedValueOnce({
          data: { phone_number: '+263771234567', first_name: 'John' },
          error: null,
        })
        // 2nd call: insert notification record
        .mockResolvedValueOnce({
          data: { id: 'notif-001', status: 'pending' },
          error: null,
        })
        // 3rd call: update status to sent
        .mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust-001',
          channel: 'sms',
          message: 'Your payment of $50 is due tomorrow.',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.notificationId).toBe('notif-001');
    });

    it('should return 400 for missing required fields', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({ customerId: 'cust-001' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 404 if customer not found', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'nonexistent',
          channel: 'sms',
          message: 'Test message',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Customer not found');
    });

    it('should return 500 if notification insert fails', async () => {
      // Customer found
      mockExecute
        .mockResolvedValueOnce({
          data: { phone_number: '+263771234567', first_name: 'John' },
          error: null,
        })
        // Insert fails
        .mockResolvedValueOnce({
          data: null,
          error: new Error('DB insert failed'),
        });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust-001',
          channel: 'sms',
          message: 'Test message',
        }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /notifications/reminders/process
  // =========================================================================
  describe('POST /notifications/reminders/process', () => {
    it('should process payment reminders', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/process',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.stats).toBeDefined();
      expect(body.stats.sent).toBe(5);
    });
  });

  // =========================================================================
  // GET /notifications/reminders/analytics
  // =========================================================================
  describe('GET /notifications/reminders/analytics', () => {
    it('should return reminder analytics', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/notifications/reminders/analytics',
        queryStringParameters: { from: '2024-01-01', to: '2024-01-31' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.total_sent).toBe(100);
    });

    it('should return analytics without date filter', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/notifications/reminders/analytics',
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // POST /notifications/reminders/opt-out
  // =========================================================================
  describe('POST /notifications/reminders/opt-out', () => {
    it('should opt customer out of reminders', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-out',
        body: JSON.stringify({ customerId: 'cust-001' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Opted out');
    });
  });

  // =========================================================================
  // POST /notifications/reminders/opt-in
  // =========================================================================
  describe('POST /notifications/reminders/opt-in', () => {
    it('should opt customer in to reminders', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-in',
        body: JSON.stringify({ customerId: 'cust-001' }),
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Opted in');
    });
  });

  // =========================================================================
  // GET /notifications/{customerId} (history)
  // =========================================================================
  describe('GET /notifications/{customerId}', () => {
    it('should return notification history for a customer', async () => {
      mockExecute.mockResolvedValueOnce({
        data: [
          { id: 'n1', channel: 'sms', message: 'Payment reminder', status: 'sent', created_at: '2024-01-01' },
          { id: 'n2', channel: 'whatsapp', message: 'Loan approved', status: 'sent', created_at: '2024-01-02' },
        ],
        error: null,
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/notifications/cust-001',
        pathParameters: { customerId: 'cust-001' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.customerId).toBe('cust-001');
      expect(body.notifications).toHaveLength(2);
    });

    it('should return 500 when database fails', async () => {
      mockExecute.mockResolvedValueOnce({
        data: null,
        error: new Error('Connection refused'),
      });

      const event = createEvent({
        httpMethod: 'GET',
        path: '/notifications/cust-002',
        pathParameters: { customerId: 'cust-002' },
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // EventBridge scheduled event
  // =========================================================================
  describe('Scheduled event (EventBridge)', () => {
    it('should process reminders on scheduled trigger', async () => {
      const scheduledEvent = {
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: {},
      };

      const result = await handler(scheduledEvent as never);
      // Scheduled events return void
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // Route not found
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown POST path', async () => {
      const event = createEvent({ httpMethod: 'POST', path: '/notifications/unknown-action' });
      const response = await handler(event);

      // The handler falls through to the GET /notifications/{customerId} catch-all for GET,
      // but for POST to unknown it returns 404
      expect(response.statusCode).toBe(404);
    });
  });
});
