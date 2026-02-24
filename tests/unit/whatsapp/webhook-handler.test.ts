/**
 * WhatsApp Service - Webhook Handler Unit Tests
 *
 * Tests the main Lambda handler from services/whatsapp-service/src/index.ts
 * covering webhook verification, incoming message processing, message sending,
 * HMAC signature validation, and message deduplication.
 */

import { createHmac } from 'crypto';
import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
  expectCORSHeaders,
} from '../../helpers/test-utils';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the handler
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
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ data: null, error: null }),
};

const mockDb = {
  from: jest.fn(() => ({ ...mockQueryBuilder })),
};

jest.mock('../../../services/shared/clients/database', () => ({
  db: mockDb,
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

const mockAxiosPost = jest.fn().mockResolvedValue({
  data: {
    messaging_product: 'whatsapp',
    contacts: [{ input: '+263771234567', wa_id: '263771234567' }],
    messages: [{ id: 'wamid.test123' }],
  },
});

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockAxiosPost(...args),
    get: jest.fn(),
    isAxiosError: jest.fn().mockReturnValue(false),
  },
  isAxiosError: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../services/whatsapp-service/src/onboarding', () => ({
  routeOnboardingMessage: jest.fn().mockResolvedValue(
    'Welcome to Lynia Finance! Reply 1 to get started.',
  ),
}));

jest.mock('../../../services/whatsapp-service/src/loan-commands', () => ({
  routeLoanCommand: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../services/shared/utils/sqs-publisher', () => ({
  SQSQueues: {
    retryWhatsAppMessage: jest.fn().mockResolvedValue('msg-id-123'),
  },
  QUEUE_NAMES: {
    WHATSAPP_MESSAGE_RETRY: 'test-lynia-whatsapp-message-retry',
  },
  publishMessage: jest.fn().mockResolvedValue('msg-id-123'),
}));

// Set environment variables before importing handler
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
process.env.META_APP_SECRET = 'test-app-secret';

import { handler } from '../../../services/whatsapp-service/src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWhatsAppWebhookPayload(
  messageOverrides: Record<string, unknown> = {},
) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry_001',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+263771234567',
                phone_number_id: 'test-phone-id',
              },
              contacts: [
                { profile: { name: 'Test User' }, wa_id: '263771234567' },
              ],
              messages: [
                {
                  from: '263771234567',
                  id: 'wamid.incoming_001',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'Hello' },
                  ...messageOverrides,
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

/**
 * Compute the HMAC-SHA256 signature that Meta would send on webhook delivery.
 */
function computeHmacSignature(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsApp Webhook Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: dedup lookup returns null (no existing message), customer found
    mockQueryBuilder.execute.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  // =========================================================================
  // GET /whatsapp/webhook - Webhook verification
  // =========================================================================
  describe('GET /whatsapp/webhook - Webhook verification', () => {
    it('should return 200 with challenge when mode and token are valid', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge_abc123',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('challenge_abc123');
      expect(response.headers).toHaveProperty('Content-Type', 'text/plain');
    });

    it('should return 403 when verify token does not match', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge_abc123',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      expect(response.body).toBe('Forbidden');
    });

    it('should return 403 when query parameters are missing', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: null,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // POST /whatsapp/webhook - Incoming messages with HMAC validation
  // =========================================================================
  describe('POST /whatsapp/webhook - Incoming messages', () => {
    it('should return 200 for a valid text message with correct HMAC signature', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = parseResponseBody(response);
      expect(responseBody).toHaveProperty('success', true);
    });

    it('should return 401 for invalid HMAC signature', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalid_signature_value_that_is_definitely_wrong_0000',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = parseResponseBody(response);
      expect(responseBody).toHaveProperty('error', 'Invalid signature');
    });

    it('should return 401 when signature header is missing and META_APP_SECRET is set', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body,
        headers: {
          'Content-Type': 'application/json',
          // No X-Hub-Signature-256 header
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const responseBody = parseResponseBody(response);
      expect(responseBody).toHaveProperty('error', 'Invalid signature');
    });
  });

  // =========================================================================
  // POST /whatsapp/send - Sending messages
  // =========================================================================
  describe('POST /whatsapp/send - Send message', () => {
    it('should send a text message and return 200 with messageId', async () => {
      // Make the customer lookup return a customer for storeMessage
      mockQueryBuilder.execute.mockResolvedValue({
        data: { id: 'cust_001', whatsapp_number: '263771234567' },
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: JSON.stringify({
          to: '+263771234567',
          message: 'Your payment of $50 has been received.',
        }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);
      expectCORSHeaders(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('messageId', 'wamid.test123');
      expect(body).toHaveProperty('waId', '263771234567');

      // Verify axios was called with correct WhatsApp API payload
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          messaging_product: 'whatsapp',
          to: '263771234567',
          type: 'text',
          text: { body: 'Your payment of $50 has been received.' },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should send a template message with correct payload', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        data: { id: 'cust_001', whatsapp_number: '263771234567' },
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: JSON.stringify({
          to: '+263771234567',
          templateName: 'payment_reminder',
          templateParams: { name: 'John', amount: '50.00' },
        }),
      });

      const response = await handler(event);

      expectSuccessResponse(response);

      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('messageId', 'wamid.test123');

      // Verify template payload structure
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          messaging_product: 'whatsapp',
          type: 'template',
          template: expect.objectContaining({
            name: 'payment_reminder',
            language: { code: 'en' },
          }),
        }),
        expect.any(Object),
      );
    });
  });

  // =========================================================================
  // Message deduplication
  // =========================================================================
  describe('Message deduplication', () => {
    it('should process a message normally when no duplicate exists', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      // First call (dedup lookup) returns null - no existing message
      // Subsequent calls return customer data
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })     // dedup check
        .mockResolvedValueOnce({ data: null, error: null })     // store message insert
        .mockResolvedValueOnce({ data: null, error: null })     // session lookup
        .mockResolvedValueOnce({ data: { id: 'cust_001', whatsapp_number: '263771234567' }, error: null }) // customer lookup
        .mockResolvedValue({ data: null, error: null });        // remaining calls

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // The handler should have called db.from multiple times for processing
      expect(mockDb.from).toHaveBeenCalled();
    });

    it('should skip processing when a duplicate message ID is found in the database', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      // Dedup check returns an existing message - duplicate detected
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'existing-msg-id' },
        error: null,
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // When duplicate is detected, axios should NOT be called to send a response
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for an unknown path', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/nonexistent',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });
  });
});
