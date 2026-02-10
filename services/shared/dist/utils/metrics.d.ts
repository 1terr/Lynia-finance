/**
 * CloudWatch Custom Metrics Utility
 * Publishes business metrics from Lambda functions to CloudWatch.
 */
interface MetricDatum {
    name: string;
    value: number;
    unit?: 'Count' | 'Milliseconds' | 'None' | 'Percent';
    dimensions?: Record<string, string>;
}
/**
 * Publish a single custom metric to CloudWatch.
 */
export declare function publishMetric(metric: MetricDatum): Promise<void>;
/**
 * Publish multiple metrics in a single API call (max 1000 per call).
 */
export declare function publishMetrics(metrics: MetricDatum[]): Promise<void>;
export declare const BusinessMetrics: {
    loanApplicationSubmitted: () => Promise<void>;
    loanApplicationApproved: () => Promise<void>;
    loanApplicationRejected: () => Promise<void>;
    paymentProcessed: (amountUsd: number) => Promise<void>;
    paymentFailed: () => Promise<void>;
    kycInitiated: () => Promise<void>;
    kycCompleted: () => Promise<void>;
    kycFailed: () => Promise<void>;
    loanDisbursed: (amountUsd: number) => Promise<void>;
    deviceLocked: () => Promise<void>;
    deviceUnlocked: () => Promise<void>;
    whatsAppMessageSent: () => Promise<void>;
    whatsAppMessageReceived: () => Promise<void>;
    whatsAppMessageFailed: () => Promise<void>;
    customerOnboarded: () => Promise<void>;
    onboardingCompletionRate: (percentage: number) => Promise<void>;
    loanDefaulted: () => Promise<void>;
};
export declare const SecurityMetrics: {
    failedLogin: () => Promise<void>;
    successfulLogin: () => Promise<void>;
    rateLimitHit: () => Promise<void>;
    wafBlocked: () => Promise<void>;
    suspiciousActivity: () => Promise<void>;
    invalidToken: () => Promise<void>;
    unauthorizedAccess: () => Promise<void>;
    kycFraudDetected: () => Promise<void>;
    duplicateTransaction: () => Promise<void>;
    transactionLimitExceeded: () => Promise<void>;
};
export declare const DatabaseMetrics: {
    connectionCount: (count: number) => Promise<void>;
    queryLatency: (durationMs: number) => Promise<void>;
};
export {};
//# sourceMappingURL=metrics.d.ts.map