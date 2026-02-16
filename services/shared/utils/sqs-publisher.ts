/**
 * SQS Publisher Utility
 * Sends messages to SQS queues for asynchronous processing.
 * Used by Lambda functions to decouple synchronous API calls
 * from background tasks like notifications, KYC processing, etc.
 */

import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';

const client = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const ENV = process.env.NODE_ENV || 'development';

/**
 * Queue name constants. Queue URLs are constructed from environment and name.
 */
export const QUEUE_NAMES = {
  NOTIFICATIONS: `${ENV}-lynia-notifications`,
  PAYMENT_CALLBACKS: `${ENV}-lynia-payment-callbacks`,
  KYC_PROCESSING: `${ENV}-lynia-kyc-processing`,
  DEVICE_LOCKS: `${ENV}-lynia-device-locks`,
  CREDIT_SCORING: `${ENV}-lynia-credit-scoring`,
  WHATSAPP_MESSAGE_RETRY: `${ENV}-lynia-whatsapp-message-retry`,
} as const;

/**
 * Build the full SQS queue URL from a queue name.
 */
function getQueueUrl(queueName: string): string {
  const accountId = process.env.AWS_ACCOUNT_ID || '';
  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
}

interface PublishOptions {
  /** SQS queue name */
  queueName: string;
  /** Message body (will be JSON.stringify'd if object) */
  message: Record<string, unknown>;
  /** Optional message group ID for FIFO queues */
  messageGroupId?: string;
  /** Optional deduplication ID */
  deduplicationId?: string;
  /** Optional delay in seconds (0-900) */
  delaySeconds?: number;
  /** Optional message attributes */
  attributes?: Record<string, string>;
}

/**
 * Publish a single message to an SQS queue.
 */
export async function publishMessage(options: PublishOptions): Promise<string> {
  const {
    queueName,
    message,
    messageGroupId,
    deduplicationId,
    delaySeconds,
    attributes,
  } = options;

  const messageAttributes = attributes
    ? Object.entries(attributes).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: { DataType: 'String', StringValue: value },
        }),
        {} as Record<string, { DataType: string; StringValue: string }>
      )
    : undefined;

  const command = new SendMessageCommand({
    QueueUrl: getQueueUrl(queueName),
    MessageBody: JSON.stringify(message),
    DelaySeconds: delaySeconds,
    MessageGroupId: messageGroupId,
    MessageDeduplicationId: deduplicationId,
    MessageAttributes: messageAttributes,
  });

  const response = await client.send(command);
  return response.MessageId || '';
}

/**
 * Publish multiple messages in a batch (max 10 per batch).
 */
export async function publishBatch(
  queueName: string,
  messages: Array<{ id: string; message: Record<string, unknown>; delaySeconds?: number }>
): Promise<void> {
  // SQS allows max 10 messages per batch
  for (let i = 0; i < messages.length; i += 10) {
    const batch = messages.slice(i, i + 10);

    const command = new SendMessageBatchCommand({
      QueueUrl: getQueueUrl(queueName),
      Entries: batch.map((m) => ({
        Id: m.id,
        MessageBody: JSON.stringify(m.message),
        DelaySeconds: m.delaySeconds,
      })),
    });

    await client.send(command);
  }
}

// Pre-built helpers for common queue operations

export const SQSQueues = {
  /** Queue a notification to be sent (SMS, WhatsApp, email) */
  sendNotification: (payload: {
    customerId: string;
    channel: 'sms' | 'whatsapp' | 'email';
    templateName: string;
    templateParams?: Record<string, string>;
  }) =>
    publishMessage({
      queueName: QUEUE_NAMES.NOTIFICATIONS,
      message: { ...payload, timestamp: new Date().toISOString() },
      attributes: { channel: payload.channel },
    }),

  /** Queue a payment callback for processing */
  processPaymentCallback: (payload: {
    provider: 'ecocash' | 'onemoney';
    transactionId: string;
    status: string;
    rawPayload: Record<string, unknown>;
  }) =>
    publishMessage({
      queueName: QUEUE_NAMES.PAYMENT_CALLBACKS,
      message: { ...payload, timestamp: new Date().toISOString() },
      attributes: { provider: payload.provider },
    }),

  /** Queue a KYC verification for processing */
  processKYC: (payload: {
    customerId: string;
    verificationType: 'national_id' | 'selfie' | 'liveness';
    jobId: string;
  }) =>
    publishMessage({
      queueName: QUEUE_NAMES.KYC_PROCESSING,
      message: { ...payload, timestamp: new Date().toISOString() },
    }),

  /** Queue a device lock/unlock operation */
  processDeviceLock: (payload: {
    deviceId: string;
    action: 'lock' | 'unlock';
    reason: string;
    loanId?: string;
  }) =>
    publishMessage({
      queueName: QUEUE_NAMES.DEVICE_LOCKS,
      message: { ...payload, timestamp: new Date().toISOString() },
    }),

  /** Queue a credit score calculation */
  calculateCreditScore: (payload: {
    customerId: string;
    trigger: 'application' | 'payment' | 'scheduled';
  }) =>
    publishMessage({
      queueName: QUEUE_NAMES.CREDIT_SCORING,
      message: { ...payload, timestamp: new Date().toISOString() },
    }),

  /** Queue a failed WhatsApp message for retry */
  retryWhatsAppMessage: (payload: {
    phoneNumber: string;
    messageContent: string;
    messageType: 'text' | 'template';
    templateName?: string;
    templateParams?: Record<string, string>;
    retryCount?: number;
    originalError?: string;
  }) =>
    publishMessage({
      queueName: QUEUE_NAMES.WHATSAPP_MESSAGE_RETRY,
      message: { ...payload, timestamp: new Date().toISOString() },
      delaySeconds: Math.min(900, 30 * Math.pow(2, payload.retryCount || 0)),
    }),
};
