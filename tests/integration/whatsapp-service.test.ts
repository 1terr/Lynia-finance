/**
 * Integration Tests: WhatsApp Service
 *
 * Tests the full Lambda handler invocation for the WhatsApp service
 * with mock API Gateway events. Covers webhook verification, incoming
 * messages, status updates, and error handling.
 */

import { createHmac } from 'crypto';
import { APIGatewayProxyEvent } from 'aws-lambda';

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
  or: jest.fn().mockReturnThis(),
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

jest.mock('../../services/shared/clients/database', () => ({
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

jest.mock('../../services/whatsapp-service/src/onboarding', () => ({
  routeOnboardingMessage: jest.fn().mockResolvedValue(
    'Welcome to Lynia Finance! Reply 1 to get started.',
  ),
}));

jest.mock('../../services/whatsapp-service/src/loan-commands', () => ({
  routeLoanCommand: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/shared/utils/sqs-publisher', () => ({
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

import { handler } from '../../services/whatsapp-service/src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/whatsapp/webhook',
    body: null,
    headers: {},
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
      httpMethod: 'GET',
      identity: { sourceIp: '127.0.0.1' } as APIGatewayProxyEvent['requestContext']['identity'],
      path: '',
      protocol: 'HTTP/1.1',
      requestId: 'test-123',
      requestTimeEpoch: Date.now(),
      resourceId: '',
      resourcePath: '',
      stage: 'test',
    },
    ...overrides,
  };
}

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

function buildStatusUpdatePayload() {
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
              statuses: [
                {
                  id: 'wamid.sent_001',
                  status: 'delivered',
                  timestamp: '1700000100',
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
}

function computeHmacSignature(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function parseBody(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsApp Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.execute.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // GET /whatsapp/webhook - Webhook verification
  // =========================================================================
  describe('GET /whatsapp/webhook - Webhook verification', () => {
    it('should return 200 with challenge when hub.mode is subscribe and verify_token matches', async () => {
      const event = createEvent({
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

    it('should return the exact challenge string provided by Meta', async () => {
      const uniqueChallenge = '9876543210_unique_challenge';
      const event = createEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': uniqueChallenge,
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(uniqueChallenge);
    });

    it('should return 403 Forbidden when verify_token does not match', async () => {
      const event = createEvent({
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

    it('should return 403 when hub.mode is not subscribe', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge_abc123',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      expect(response.body).toBe('Forbidden');
    });

    it('should return 403 when query parameters are missing', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: null,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 when only hub.mode is provided without verify_token', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/whatsapp/webhook',
        queryStringParameters: {
          'hub.mode': 'subscribe',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // POST /whatsapp/webhook - Incoming text message
  // =========================================================================
  describe('POST /whatsapp/webhook - Incoming text message', () => {
    it('should return 200 with success true for a valid text message and correct HMAC', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createEvent({
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
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('success', true);
    });

    it('should store the incoming message in the database', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      await handler(event);

      // The handler calls db.from('whatsapp_messages') to store the incoming message
      expect(mockDb.from).toHaveBeenCalledWith('whatsapp_messages');
    });

    it('should call the onboarding router when processing a new message', async () => {
      const { routeOnboardingMessage } = require('../../services/whatsapp-service/src/onboarding');

      // Dedup check returns null (no duplicate), then remaining calls proceed
      // Call sequence: dedup -> storeMessage customer lookup -> storeMessage insert ->
      //   session lookup -> findOrCreateCustomer (whatsapp_number) -> remaining
      mockQueryBuilder.execute
        .mockResolvedValueOnce({ data: null, error: null })   // dedup check
        .mockResolvedValueOnce({ data: null, error: null })   // storeMessage: customer lookup
        .mockResolvedValueOnce({ data: null, error: null })   // storeMessage: insert message
        .mockResolvedValueOnce({ data: null, error: null })   // session lookup (no session)
        .mockResolvedValueOnce({                               // findOrCreateCustomer: lookup by whatsapp_number
          data: { id: 'cust_001', whatsapp_number: '263771234567' },
          error: null,
        })
        .mockResolvedValue({ data: null, error: null });       // remaining calls

      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      await handler(event);

      expect(routeOnboardingMessage).toHaveBeenCalled();
    });

    it('should skip duplicate messages based on whatsapp_message_id', async () => {
      // Dedup check returns an existing message
      mockQueryBuilder.execute.mockResolvedValueOnce({
        data: { id: 'existing-msg-id' },
        error: null,
      });

      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createEvent({
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
      // When duplicate detected, no outbound message should be sent
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // POST /whatsapp/webhook - Invalid webhook token (HMAC signature)
  // =========================================================================
  describe('POST /whatsapp/webhook - Invalid HMAC signature', () => {
    it('should return 401 when HMAC signature does not match', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);

      const event = createEvent({
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
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('error', 'Invalid signature');
    });

    it('should return 401 when X-Hub-Signature-256 header is missing', async () => {
      const payload = buildWhatsAppWebhookPayload();
      const body = JSON.stringify(payload);

      const event = createEvent({
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
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('error', 'Invalid signature');
    });
  });

  // =========================================================================
  // POST /whatsapp/webhook - Missing body
  // =========================================================================
  describe('POST /whatsapp/webhook - Missing body', () => {
    it('should return 200 gracefully when body is null (still acknowledges webhook)', async () => {
      // Even with null body, we need a valid signature for null -> treated as '{}'
      // The handler does JSON.parse(event.body || '{}'), so empty body yields empty object
      const bodyStr = '';
      const signature = computeHmacSignature(bodyStr, 'test-app-secret');

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: null,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      const response = await handler(event);

      // The handler tries to iterate over webhookEvent.entry which will be undefined,
      // causing an error that is caught and returns 200 with success: false
      expect(response.statusCode).toBe(200);
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('success', false);
    });

    it('should return 200 when body is an empty string', async () => {
      const bodyStr = '';
      const signature = computeHmacSignature(bodyStr, 'test-app-secret');

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: '',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      const response = await handler(event);

      // Empty body -> '{}' -> no entry field -> error caught -> 200 with success: false
      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // POST /whatsapp/webhook - Malformed JSON body
  // =========================================================================
  describe('POST /whatsapp/webhook - Malformed JSON body', () => {
    it('should return 200 with success false for invalid JSON (Meta retry prevention)', async () => {
      const malformedBody = '{invalid json content!!!';
      const signature = computeHmacSignature(malformedBody, 'test-app-secret');

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: malformedBody,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      const response = await handler(event);

      // The handler catches JSON.parse errors and returns 200 to avoid Meta retries
      expect(response.statusCode).toBe(200);
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('success', false);
      expect(responseBody).toHaveProperty('error', 'Processing error');
    });

    it('should not crash when body is a valid JSON but missing required fields', async () => {
      const incompleteBody = JSON.stringify({ object: 'whatsapp_business_account' });
      const signature = computeHmacSignature(incompleteBody, 'test-app-secret');

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/webhook',
        body: incompleteBody,
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
      });

      const response = await handler(event);

      // Missing entry field causes iteration error, caught and returned as 200
      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // POST /whatsapp/webhook - Status updates (delivery/read receipts)
  // =========================================================================
  describe('POST /whatsapp/webhook - Status updates', () => {
    it('should return 200 and update message status for delivery receipt', async () => {
      const payload = buildStatusUpdatePayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createEvent({
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
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('success', true);

      // Should update the message status in the database
      expect(mockDb.from).toHaveBeenCalledWith('whatsapp_messages');
    });

    it('should handle read receipt status updates', async () => {
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
                    phone_number_id: 'test-phone-id',
                  },
                  statuses: [
                    {
                      id: 'wamid.sent_002',
                      status: 'read',
                      timestamp: '1700000200',
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
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createEvent({
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
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('success', true);
    });

    it('should handle failed delivery status updates', async () => {
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
                    phone_number_id: 'test-phone-id',
                  },
                  statuses: [
                    {
                      id: 'wamid.sent_003',
                      status: 'failed',
                      timestamp: '1700000300',
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
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(body, 'test-app-secret');

      const event = createEvent({
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
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('success', true);
    });
  });

  // =========================================================================
  // POST /whatsapp/send - Send message
  // =========================================================================
  describe('POST /whatsapp/send - Send message', () => {
    it('should send a text message and return 200 with messageId', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        data: { id: 'cust_001', whatsapp_number: '263771234567' },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: JSON.stringify({
          to: '+263771234567',
          message: 'Your payment of $50 has been received.',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('success', true);
      expect(responseBody).toHaveProperty('messageId', 'wamid.test123');
      expect(responseBody).toHaveProperty('waId', '263771234567');
    });

    it('should call WhatsApp Cloud API with correct payload', async () => {
      mockQueryBuilder.execute.mockResolvedValue({
        data: { id: 'cust_001', whatsapp_number: '263771234567' },
        error: null,
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/whatsapp/send',
        body: JSON.stringify({
          to: '+263771234567',
          message: 'Test message',
        }),
      });

      await handler(event);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          messaging_product: 'whatsapp',
          to: '263771234567',
          type: 'text',
          text: { body: 'Test message' },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Unknown routes
  // =========================================================================
  describe('Unknown routes', () => {
    it('should return 404 for an unknown path', async () => {
      const event = createEvent({
        httpMethod: 'GET',
        path: '/whatsapp/nonexistent',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const responseBody = parseBody(response);
      expect(responseBody).toHaveProperty('error', 'Not Found');
    });

    it('should return 404 for a DELETE request to webhook', async () => {
      const event = createEvent({
        httpMethod: 'DELETE',
        path: '/whatsapp/webhook',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
    });
  });
});
