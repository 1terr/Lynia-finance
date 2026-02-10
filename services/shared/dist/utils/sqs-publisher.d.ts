/**
 * SQS Publisher Utility
 * Sends messages to SQS queues for asynchronous processing.
 * Used by Lambda functions to decouple synchronous API calls
 * from background tasks like notifications, KYC processing, etc.
 */
/**
 * Queue name constants. Queue URLs are constructed from environment and name.
 */
export declare const QUEUE_NAMES: {
    readonly NOTIFICATIONS: `${string}-lynia-notifications`;
    readonly PAYMENT_CALLBACKS: `${string}-lynia-payment-callbacks`;
    readonly KYC_PROCESSING: `${string}-lynia-kyc-processing`;
    readonly DEVICE_LOCKS: `${string}-lynia-device-locks`;
    readonly CREDIT_SCORING: `${string}-lynia-credit-scoring`;
};
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
export declare function publishMessage(options: PublishOptions): Promise<string>;
/**
 * Publish multiple messages in a batch (max 10 per batch).
 */
export declare function publishBatch(queueName: string, messages: Array<{
    id: string;
    message: Record<string, unknown>;
    delaySeconds?: number;
}>): Promise<void>;
export declare const SQSQueues: {
    /** Queue a notification to be sent (SMS, WhatsApp, email) */
    sendNotification: (payload: {
        customerId: string;
        channel: "sms" | "whatsapp" | "email";
        templateName: string;
        templateParams?: Record<string, string>;
    }) => Promise<string>;
    /** Queue a payment callback for processing */
    processPaymentCallback: (payload: {
        provider: "ecocash" | "onemoney";
        transactionId: string;
        status: string;
        rawPayload: Record<string, unknown>;
    }) => Promise<string>;
    /** Queue a KYC verification for processing */
    processKYC: (payload: {
        customerId: string;
        verificationType: "national_id" | "selfie" | "liveness";
        jobId: string;
    }) => Promise<string>;
    /** Queue a device lock/unlock operation */
    processDeviceLock: (payload: {
        deviceId: string;
        action: "lock" | "unlock";
        reason: string;
        loanId?: string;
    }) => Promise<string>;
    /** Queue a credit score calculation */
    calculateCreditScore: (payload: {
        customerId: string;
        trigger: "application" | "payment" | "scheduled";
    }) => Promise<string>;
};
export {};
//# sourceMappingURL=sqs-publisher.d.ts.map