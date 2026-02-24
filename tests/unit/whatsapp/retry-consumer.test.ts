/**
 * WhatsApp Service - SQS Retry Consumer Unit Tests
 *
 * Tests the SQS retry consumer from services/whatsapp-service/src/retry-consumer.ts
 * covering successful retries, max retry limits, malformed messages,
 * API failures, and batch processing.
 */

import type { SQSEvent } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the handler
// ---------------------------------------------------------------------------

const mockAxiosPost = jest.fn().mockResolvedValue({
  data: {
    messaging_product: 'whatsapp',
    contacts: [{ input: '+263771234567', wa_id: '263771234567' }],
    messages: [{ id: 'wamid.retry123' }],
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

// Set environment variables before importing handler
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';

import { handler } from '../../../services/whatsapp-service/src/retry-consumer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock SQS event with the given records.
 */
function createSQSEvent(
  records: Array<{ body: string; messageId?: string }>,
): SQSEvent {
  return {
    Records: records.map((r, i) => ({
      messageId: r.messageId || `msg-${i}`,
      receiptHandle: `receipt-${i}`,
      body: r.body,
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1700000000000',
        SenderId: 'sender-id',
        ApproximateFirstReceiveTimestamp: '1700000000000',
      },
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-lynia-whatsapp-message-retry',
      awsRegion: 'us-east-1',
    })),
  };
}

/**
 * Build a valid retry message body.
 */
function buildRetryBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    phoneNumber: '263771234567',
    messageContent: 'Your payment of $50 has been received.',
    messageType: 'text',
    retryCount: 0,
    originalError: 'circuit_open',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsApp Retry Consumer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send a retry message via WhatsApp API on valid input', async () => {
    const event = createSQSEvent([
      { body: buildRetryBody({ retryCount: 1 }) },
    ]);

    await handler(event, {} as never, () => {});

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    expect(mockAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/test-phone-id/messages'),
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

  it('should skip message when retryCount >= 3 (max retries reached)', async () => {
    const event = createSQSEvent([
      { body: buildRetryBody({ retryCount: 3 }), messageId: 'msg-maxed' },
    ]);

    // Should complete without throwing
    await handler(event, {} as never, () => {});

    // Should NOT call the WhatsApp API
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('should continue processing remaining records when one has malformed JSON', async () => {
    const event = createSQSEvent([
      { body: '<<<NOT-VALID-JSON>>>', messageId: 'msg-bad' },
      { body: buildRetryBody({ retryCount: 0 }), messageId: 'msg-good' },
    ]);

    await handler(event, {} as never, () => {});

    // Only the valid message should trigger an API call
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  it('should throw when WhatsApp API returns an error (for SQS retry)', async () => {
    mockAxiosPost.mockRejectedValueOnce(new Error('WhatsApp API 500 Internal Server Error'));

    const event = createSQSEvent([
      { body: buildRetryBody({ retryCount: 1 }), messageId: 'msg-fail' },
    ]);

    // The handler re-throws API errors so SQS marks the message as failed
    await expect(
      handler(event, {} as never, () => {}),
    ).rejects.toThrow('WhatsApp API 500 Internal Server Error');
  });

  it('should process a batch of multiple valid messages', async () => {
    const event = createSQSEvent([
      { body: buildRetryBody({ phoneNumber: '263771000001', retryCount: 0 }), messageId: 'msg-0' },
      { body: buildRetryBody({ phoneNumber: '263771000002', retryCount: 1 }), messageId: 'msg-1' },
      { body: buildRetryBody({ phoneNumber: '263771000003', retryCount: 2 }), messageId: 'msg-2' },
    ]);

    await handler(event, {} as never, () => {});

    // All three messages should result in an API call
    expect(mockAxiosPost).toHaveBeenCalledTimes(3);

    // Verify each call targeted the correct phone number
    const calls = mockAxiosPost.mock.calls;
    expect(calls[0][1]).toHaveProperty('to', '263771000001');
    expect(calls[1][1]).toHaveProperty('to', '263771000002');
    expect(calls[2][1]).toHaveProperty('to', '263771000003');
  });
});
