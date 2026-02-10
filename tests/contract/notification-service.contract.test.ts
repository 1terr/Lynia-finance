/**
 * Notification Service - API Contract Tests
 *
 * Validates that all notification service endpoints conform to
 * their API contracts: message sending, reminder processing,
 * analytics, opt-in/opt-out, and error handling.
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
  expectErrorResponse,
  expectCORSHeaders,
} from '../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockSupabaseClient = {
  from: jest.fn(() => mockQueryBuilder),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

const mockProcessPaymentReminders = jest.fn();
const mockGetReminderAnalytics = jest.fn();
const mockHandleReminderOptOut = jest.fn();
const mockHandleReminderOptIn = jest.fn();

jest.mock('../../services/notification-service/src/reminder-scheduler', () => ({
  processPaymentReminders: mockProcessPaymentReminders,
  getReminderAnalytics: mockGetReminderAnalytics,
  handleReminderOptOut: mockHandleReminderOptOut,
  handleReminderOptIn: mockHandleReminderOptIn,
}));

import { handler } from '../../services/notification-service/src/index';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notification Service Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset query builder defaults
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.insert.mockReturnThis();
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();
    mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // POST /notifications/send
  // =========================================================================
  describe('POST /notifications/send', () => {
    it('should return 200 with notificationId on successful send', async () => {
      // Customer lookup
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { phone_number: '+263771234567', first_name: 'John' },
          error: null,
        })
        // Notification insert
        .mockResolvedValueOnce({
          data: { id: 'notif_001' },
          error: null,
        });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_001',
          channel: 'whatsapp',
          message: 'Your payment of $50 is due tomorrow.',
        }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('notificationId', 'notif_001');
    });

    it('should return 400 when customerId is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          channel: 'whatsapp',
          message: 'Test message',
        }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect((body as Record<string, string>).error).toContain('customerId');
    });

    it('should return 400 when channel is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_001',
          message: 'Test message',
        }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 400 when message is missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_001',
          channel: 'sms',
        }),
      });

      const response = await handler(event);

      expectErrorResponse(response, 400);
    });

    it('should return 404 when customer is not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_nonexistent',
          channel: 'whatsapp',
          message: 'Test message',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Customer not found');
    });

    it('should accept whatsapp channel', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { phone_number: '+263771234567', first_name: 'John' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'notif_001' },
          error: null,
        });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_001',
          channel: 'whatsapp',
          message: 'Test',
        }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
    });

    it('should accept sms channel', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { phone_number: '+263771234567', first_name: 'John' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'notif_002' },
          error: null,
        });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_001',
          channel: 'sms',
          message: 'Test',
        }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
    });

    it('should accept email channel', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { phone_number: '+263771234567', first_name: 'John' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'notif_003' },
          error: null,
        });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_001',
          channel: 'email',
          message: 'Test',
        }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
    });

    it('should return 500 when notification insert fails', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { phone_number: '+263771234567', first_name: 'John' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'INSERT_ERR', message: 'Insert failed' },
        });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: JSON.stringify({
          customerId: 'cust_001',
          channel: 'whatsapp',
          message: 'Test',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to create notification');
    });
  });

  // =========================================================================
  // POST /notifications/reminders/process
  // =========================================================================
  describe('POST /notifications/reminders/process', () => {
    it('should return 200 with processing stats on success', async () => {
      mockProcessPaymentReminders.mockResolvedValue({
        total_processed: 25,
        sent: 20,
        failed: 3,
        skipped: 2,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/process',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('stats');
      expect((body as Record<string, unknown>).stats).toHaveProperty('total_processed', 25);
    });

    it('should return 500 when reminder processing fails', async () => {
      mockProcessPaymentReminders.mockRejectedValue(new Error('Processing error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/process',
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
    });
  });

  // =========================================================================
  // GET /notifications/reminders/analytics
  // =========================================================================
  describe('GET /notifications/reminders/analytics', () => {
    it('should return 200 with analytics data', async () => {
      mockGetReminderAnalytics.mockResolvedValue({
        total_sent: 500,
        delivery_rate: 0.95,
        response_rate: 0.40,
        payment_conversion_rate: 0.25,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/reminders/analytics',
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
    });

    it('should pass from and to query parameters when provided', async () => {
      mockGetReminderAnalytics.mockResolvedValue({ total_sent: 100 });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/reminders/analytics',
        queryStringParameters: {
          from: '2024-01-01',
          to: '2024-01-31',
        },
      });

      await handler(event);

      expect(mockGetReminderAnalytics).toHaveBeenCalledWith({
        from: '2024-01-01',
        to: '2024-01-31',
      });
    });

    it('should call analytics without date range when params missing', async () => {
      mockGetReminderAnalytics.mockResolvedValue({ total_sent: 100 });

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/reminders/analytics',
        queryStringParameters: null,
      });

      await handler(event);

      expect(mockGetReminderAnalytics).toHaveBeenCalledWith(undefined);
    });

    it('should return 500 when analytics query fails', async () => {
      mockGetReminderAnalytics.mockRejectedValue(new Error('Query error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/reminders/analytics',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /notifications/reminders/opt-out
  // =========================================================================
  describe('POST /notifications/reminders/opt-out', () => {
    it('should return 200 with opt-out confirmation', async () => {
      mockHandleReminderOptOut.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-out',
        body: JSON.stringify({ customerId: 'cust_001' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Opted out of reminders');
    });

    it('should call handleReminderOptOut with customerId', async () => {
      mockHandleReminderOptOut.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-out',
        body: JSON.stringify({ customerId: 'cust_042' }),
      });

      await handler(event);

      expect(mockHandleReminderOptOut).toHaveBeenCalledWith('cust_042');
    });

    it('should return 500 when opt-out processing fails', async () => {
      mockHandleReminderOptOut.mockRejectedValue(new Error('Update failed'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-out',
        body: JSON.stringify({ customerId: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /notifications/reminders/opt-in
  // =========================================================================
  describe('POST /notifications/reminders/opt-in', () => {
    it('should return 200 with opt-in confirmation', async () => {
      mockHandleReminderOptIn.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-in',
        body: JSON.stringify({ customerId: 'cust_001' }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message', 'Opted in to reminders');
    });

    it('should call handleReminderOptIn with customerId', async () => {
      mockHandleReminderOptIn.mockResolvedValue(undefined);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-in',
        body: JSON.stringify({ customerId: 'cust_099' }),
      });

      await handler(event);

      expect(mockHandleReminderOptIn).toHaveBeenCalledWith('cust_099');
    });

    it('should return 500 when opt-in processing fails', async () => {
      mockHandleReminderOptIn.mockRejectedValue(new Error('Update failed'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/reminders/opt-in',
        body: JSON.stringify({ customerId: 'cust_001' }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // GET /notifications/{customerId}
  // =========================================================================
  describe('GET /notifications/{customerId}', () => {
    it('should return 200 with notification history', async () => {
      const notifications = [
        {
          id: 'notif_001',
          customer_id: 'cust_001',
          channel: 'whatsapp',
          message: 'Payment received',
          status: 'sent',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'notif_002',
          customer_id: 'cust_001',
          channel: 'sms',
          message: 'Payment reminder',
          status: 'sent',
          created_at: '2024-01-14T10:00:00Z',
        },
      ];

      // The getNotificationHistory function does NOT call .single()
      // It uses .limit(50) which returns { data, error } directly
      mockQueryBuilder.limit.mockReturnValue({
        data: notifications,
        error: null,
      } as unknown as typeof mockQueryBuilder);

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/cust_001',
        pathParameters: { customerId: 'cust_001' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('customerId', 'cust_001');
      expect(body).toHaveProperty('notifications');
      expect(Array.isArray((body as Record<string, unknown>).notifications)).toBe(true);
    });

    it('should return empty array when no notifications exist', async () => {
      mockQueryBuilder.limit.mockReturnValue({
        data: [],
        error: null,
      } as unknown as typeof mockQueryBuilder);

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/cust_new',
        pathParameters: { customerId: 'cust_new' },
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('notifications');
      expect((body as Record<string, unknown>).notifications).toEqual([]);
    });

    it('should return 500 when database query fails', async () => {
      mockQueryBuilder.limit.mockReturnValue({
        data: null,
        error: { code: 'DB_ERR', message: 'Connection lost' },
      } as unknown as typeof mockQueryBuilder);

      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/cust_001',
        pathParameters: { customerId: 'cust_001' },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Failed to fetch notifications');
    });
  });

  // =========================================================================
  // 404 - Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/notifications/unknown/endpoint',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('should return 404 for wrong HTTP method on known path', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        path: '/notifications/send',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });

    it('should include proper headers on 404 responses', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/nonexistent',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });
  });

  // =========================================================================
  // Scheduled event handling (EventBridge)
  // =========================================================================
  describe('Scheduled event handling', () => {
    it('should process scheduled reminders from EventBridge', async () => {
      mockProcessPaymentReminders.mockResolvedValue({
        total_processed: 10,
        sent: 8,
        failed: 2,
        skipped: 0,
      });

      // Scheduled event from EventBridge has different shape
      const scheduledEvent = {
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: {},
        time: '2024-01-15T10:00:00Z',
        region: 'af-south-1',
        resources: ['arn:aws:events:af-south-1:123456789:rule/process-reminders'],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await handler(scheduledEvent as any);

      // Scheduled events return void, not APIGatewayProxyResult
      expect(response).toBeUndefined();
      expect(mockProcessPaymentReminders).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Top-level error handling
  // =========================================================================
  describe('Top-level error handling', () => {
    it('should return 500 on unexpected errors', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/notifications/send',
        body: '<<<INVALID>>>',
      });

      const response = await handler(event);

      expect(response!.statusCode).toBe(500);
      const body = parseResponseBody(response!);
      expect(body).toHaveProperty('error');
      expect(response!.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});
