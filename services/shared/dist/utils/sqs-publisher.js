"use strict";
/**
 * SQS Publisher Utility
 * Sends messages to SQS queues for asynchronous processing.
 * Used by Lambda functions to decouple synchronous API calls
 * from background tasks like notifications, KYC processing, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQSQueues = exports.QUEUE_NAMES = void 0;
exports.publishMessage = publishMessage;
exports.publishBatch = publishBatch;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const client = new client_sqs_1.SQSClient({
    region: process.env.AWS_REGION || 'us-east-1',
});
const ENV = process.env.NODE_ENV || 'development';
/**
 * Queue name constants. Queue URLs are constructed from environment and name.
 */
exports.QUEUE_NAMES = {
    NOTIFICATIONS: `${ENV}-lynia-notifications`,
    PAYMENT_CALLBACKS: `${ENV}-lynia-payment-callbacks`,
    KYC_PROCESSING: `${ENV}-lynia-kyc-processing`,
    DEVICE_LOCKS: `${ENV}-lynia-device-locks`,
    CREDIT_SCORING: `${ENV}-lynia-credit-scoring`,
};
/**
 * Build the full SQS queue URL from a queue name.
 */
function getQueueUrl(queueName) {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
}
/**
 * Publish a single message to an SQS queue.
 */
async function publishMessage(options) {
    const { queueName, message, messageGroupId, deduplicationId, delaySeconds, attributes, } = options;
    const messageAttributes = attributes
        ? Object.entries(attributes).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: { DataType: 'String', StringValue: value },
        }), {})
        : undefined;
    const command = new client_sqs_1.SendMessageCommand({
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
async function publishBatch(queueName, messages) {
    // SQS allows max 10 messages per batch
    for (let i = 0; i < messages.length; i += 10) {
        const batch = messages.slice(i, i + 10);
        const command = new client_sqs_1.SendMessageBatchCommand({
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
exports.SQSQueues = {
    /** Queue a notification to be sent (SMS, WhatsApp, email) */
    sendNotification: (payload) => publishMessage({
        queueName: exports.QUEUE_NAMES.NOTIFICATIONS,
        message: { ...payload, timestamp: new Date().toISOString() },
        attributes: { channel: payload.channel },
    }),
    /** Queue a payment callback for processing */
    processPaymentCallback: (payload) => publishMessage({
        queueName: exports.QUEUE_NAMES.PAYMENT_CALLBACKS,
        message: { ...payload, timestamp: new Date().toISOString() },
        attributes: { provider: payload.provider },
    }),
    /** Queue a KYC verification for processing */
    processKYC: (payload) => publishMessage({
        queueName: exports.QUEUE_NAMES.KYC_PROCESSING,
        message: { ...payload, timestamp: new Date().toISOString() },
    }),
    /** Queue a device lock/unlock operation */
    processDeviceLock: (payload) => publishMessage({
        queueName: exports.QUEUE_NAMES.DEVICE_LOCKS,
        message: { ...payload, timestamp: new Date().toISOString() },
    }),
    /** Queue a credit score calculation */
    calculateCreditScore: (payload) => publishMessage({
        queueName: exports.QUEUE_NAMES.CREDIT_SCORING,
        message: { ...payload, timestamp: new Date().toISOString() },
    }),
};
//# sourceMappingURL=sqs-publisher.js.map