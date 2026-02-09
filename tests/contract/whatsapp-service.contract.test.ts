/**
 * WhatsApp Service - API Contract Tests
 *
 * Validates that all WhatsApp service endpoints conform to
 * their API contracts: webhook verification, message sending,
 * incoming message processing, and error handling.
 */

import {
  createAPIGatewayEvent,
  parseResponseBody,
  expectSuccessResponse,
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
    isAxiosError: jest.fn().mockReturnValue(false),
  },
  isAxiosError: jest.fn().mockReturnValue(false),
}));

jest.mock('../../services/whatsapp-service/src/onboarding', () => ({
  routeOnboardingMessage: jest.fn().mockResolvedValue(
    'Welcome to Lynia Finance! Reply 1 to get started.',
  ),
}));

// Set environment variables before import
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test_phone_id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test_access_token';
process.env.WHATSAPP_VERIFY_TOKEN = 'lynia_webhook_2025';

import { handler } from '../../services/whatsapp-service/src/index';

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
                phone_number_id: 'test_phone_id',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsApp Service Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: customer lookup succeeds
    mockQueryBuilder.single.mockResolvedValue({
      data: { id: 'cust_001', whatsapp_number: '263771234567' },
      error: null,
    });
  });

  // =========================================================================
  // POST /whatsapp/send - Text messages
  // =========================================================================
  describe('POST /whatsapp/send', () => {
    it('should return 200 with messageId for text message', async () => {
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
    });

    it('should send correct text message payload to WhatsApp API', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: JSON.stringify({
          to: '+263771234567',
          message: 'Hello World',
        }),
      });

      await handler(event);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          messaging_product: 'whatsapp',
          to: '263771234567',
          type: 'text',
          text: { body: 'Hello World' },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer'),
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should return 200 with messageId for template message', async () => {
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
      expect(body).toHaveProperty('messageId');
    });

    it('should send correct template payload to WhatsApp API', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: JSON.stringify({
          to: '+263771234567',
          templateName: 'payment_reminder',
          templateParams: { name: 'John', amount: '50.00' },
        }),
      });

      await handler(event);

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

    it('should return error when WhatsApp API call fails', async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error('Network error'));

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: JSON.stringify({
          to: '+263771234567',
          message: 'Test',
        }),
      });

      // The handler re-throws non-Axios errors, caught by top-level handler
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // GET /whatsapp/webhook - Verification
  // =========================================================================
  describe('GET /whatsapp/webhook', () => {
    it('should return 200 with challenge string on valid verification', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'lynia_webhook_2025',
          'hub.challenge': 'challenge_token_abc123',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('challenge_token_abc123');
      expect(response.headers).toHaveProperty('Content-Type', 'text/plain');
    });

    it('should return 403 when verify_token does not match', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_token_abc123',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      expect(response.body).toBe('Forbidden');
    });

    it('should return 403 when hub.mode is not subscribe', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'lynia_webhook_2025',
          'hub.challenge': 'challenge_token_abc123',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
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
  // POST /whatsapp/webhook - Incoming messages
  // =========================================================================
  describe('POST /whatsapp/webhook', () => {
    it('should always return 200 for incoming webhooks', async () => {
      const payload = buildWhatsAppWebhookPayload();

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(payload),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', true);
    });

    it('should return 200 even when processing fails (avoid Meta retries)', async () => {
      // Trigger an error in processing by passing invalid payload structure
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify({
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
                      phone_number_id: 'test_phone_id',
                    },
                    // No messages, no statuses
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should process text message type', async () => {
      const payload = buildWhatsAppWebhookPayload({
        type: 'text',
        text: { body: 'I want to apply for a loan' },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(payload),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should process interactive button_reply message type', async () => {
      const payload = buildWhatsAppWebhookPayload({
        type: 'interactive',
        text: undefined,
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'btn_apply', title: 'Apply Now' },
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(payload),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should process interactive list_reply message type', async () => {
      const payload = buildWhatsAppWebhookPayload({
        type: 'interactive',
        text: undefined,
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'list_samsung', title: 'Samsung Galaxy A14' },
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(payload),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should process image message type (KYC uploads)', async () => {
      const payload = buildWhatsAppWebhookPayload({
        type: 'image',
        text: undefined,
        image: {
          id: 'img_123',
          mime_type: 'image/jpeg',
          sha256: 'abc123hash',
        },
      });

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(payload),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should process message status updates', async () => {
      const payload = {
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
                    phone_number_id: 'test_phone_id',
                  },
                  statuses: [
                    {
                      id: 'wamid.outgoing_001',
                      status: 'delivered',
                      timestamp: '1700000000',
                      recipient_id: '263771234567',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: JSON.stringify(payload),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // Should call update on whatsapp_messages table
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('whatsapp_messages');
    });

    it('should return 200 with success: false on processing error', async () => {
      // Force JSON parse error
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: 'NOT-JSON',
      });

      const response = await handler(event);

      // WhatsApp webhook always returns 200 to avoid retries
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('success', false);
    });
  });

  // =========================================================================
  // 404 - Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/whatsapp/unknown',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error', 'Not Found');
    });

    it('should return 404 for wrong HTTP method on known path', async () => {
      const event = createAPIGatewayEvent({
        httpMethod: 'DELETE',
        path: '/whatsapp/send',
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
  // Top-level error handling
  // =========================================================================
  describe('Top-level error handling', () => {
    it('should return 500 with error message on unexpected error', async () => {
      // POST /whatsapp/send with invalid JSON causes JSON.parse to throw
      // which is caught by the route-level try/catch, which re-throws,
      // caught by top-level
      const event = createAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: '<<<INVALID>>>',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body).toHaveProperty('error');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });
});
