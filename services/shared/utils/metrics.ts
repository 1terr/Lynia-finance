/**
 * CloudWatch Custom Metrics Utility
 * Publishes business metrics from Lambda functions to CloudWatch.
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

const client = new CloudWatchClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const NAMESPACE_PREFIX = 'Lynia';

function getNamespace(): string {
  const env = process.env.NODE_ENV || 'development';
  return `${NAMESPACE_PREFIX}/${env}`;
}

interface MetricDatum {
  name: string;
  value: number;
  unit?: 'Count' | 'Milliseconds' | 'None' | 'Percent';
  dimensions?: Record<string, string>;
}

/**
 * Publish a single custom metric to CloudWatch.
 */
export async function publishMetric(metric: MetricDatum): Promise<void> {
  const dimensions = metric.dimensions
    ? Object.entries(metric.dimensions).map(([Name, Value]) => ({ Name, Value }))
    : undefined;

  const command = new PutMetricDataCommand({
    Namespace: getNamespace(),
    MetricData: [
      {
        MetricName: metric.name,
        Value: metric.value,
        Unit: metric.unit || 'Count',
        Timestamp: new Date(),
        Dimensions: dimensions,
      },
    ],
  });

  await client.send(command);
}

/**
 * Publish multiple metrics in a single API call (max 1000 per call).
 */
export async function publishMetrics(metrics: MetricDatum[]): Promise<void> {
  const metricData = metrics.map((m) => ({
    MetricName: m.name,
    Value: m.value,
    Unit: m.unit || ('Count' as const),
    Timestamp: new Date(),
    Dimensions: m.dimensions
      ? Object.entries(m.dimensions).map(([Name, Value]) => ({ Name, Value }))
      : undefined,
  }));

  // CloudWatch allows max 1000 metrics per PutMetricData call
  for (let i = 0; i < metricData.length; i += 1000) {
    const batch = metricData.slice(i, i + 1000);
    const command = new PutMetricDataCommand({
      Namespace: getNamespace(),
      MetricData: batch,
    });
    await client.send(command);
  }
}

// Pre-built business metric helpers

export const BusinessMetrics = {
  loanApplicationSubmitted: () =>
    publishMetric({ name: 'LoanApplicationsSubmitted', value: 1 }),

  loanApplicationApproved: () =>
    publishMetric({ name: 'LoanApplicationsApproved', value: 1 }),

  loanApplicationRejected: () =>
    publishMetric({ name: 'LoanApplicationsRejected', value: 1 }),

  paymentProcessed: (amountUsd: number) =>
    publishMetrics([
      { name: 'PaymentsProcessed', value: 1 },
      { name: 'TotalCollectedAmount', value: amountUsd },
    ]),

  paymentFailed: () =>
    publishMetric({ name: 'PaymentsFailed', value: 1 }),

  kycInitiated: () =>
    publishMetric({ name: 'KYCVerificationsInitiated', value: 1 }),

  kycCompleted: () =>
    publishMetric({ name: 'KYCVerificationsCompleted', value: 1 }),

  kycFailed: () =>
    publishMetric({ name: 'KYCVerificationsFailed', value: 1 }),

  loanDisbursed: (amountUsd: number) =>
    publishMetrics([
      { name: 'TotalDisbursedAmount', value: amountUsd },
      { name: 'ActiveLoans', value: 1 },
    ]),

  deviceLocked: () =>
    publishMetric({ name: 'DevicesLocked', value: 1 }),

  deviceUnlocked: () =>
    publishMetric({ name: 'DevicesUnlocked', value: 1 }),

  whatsAppMessageSent: () =>
    publishMetric({ name: 'WhatsAppMessagesSent', value: 1 }),

  whatsAppMessageReceived: () =>
    publishMetric({ name: 'WhatsAppMessagesReceived', value: 1 }),

  whatsAppMessageFailed: () =>
    publishMetric({ name: 'WhatsAppMessagesFailed', value: 1 }),

  customerOnboarded: () =>
    publishMetric({ name: 'NewCustomersOnboarded', value: 1 }),

  onboardingCompletionRate: (percentage: number) =>
    publishMetric({
      name: 'OnboardingCompletionRate',
      value: percentage,
      unit: 'Percent',
    }),

  loanDefaulted: () =>
    publishMetric({ name: 'DefaultedLoans', value: 1 }),
};

// Security metric helpers (feeds Security dashboard)

export const SecurityMetrics = {
  failedLogin: () =>
    publishMetric({ name: 'FailedLoginAttempts', value: 1 }),

  successfulLogin: () =>
    publishMetric({ name: 'SuccessfulLogins', value: 1 }),

  rateLimitHit: () =>
    publishMetric({ name: 'RateLimitHits', value: 1 }),

  wafBlocked: () =>
    publishMetric({ name: 'WAFBlockedRequests', value: 1 }),

  suspiciousActivity: () =>
    publishMetric({ name: 'SuspiciousActivityFlags', value: 1 }),

  invalidToken: () =>
    publishMetric({ name: 'InvalidTokenAttempts', value: 1 }),

  unauthorizedAccess: () =>
    publishMetric({ name: 'UnauthorizedAccessAttempts', value: 1 }),

  kycFraudDetected: () =>
    publishMetric({ name: 'KYCFraudDetected', value: 1 }),

  duplicateTransaction: () =>
    publishMetric({ name: 'DuplicateTransactionAttempts', value: 1 }),

  transactionLimitExceeded: () =>
    publishMetric({ name: 'TransactionLimitExceeded', value: 1 }),
};

// Database metric helpers (feeds Technical dashboard)

export const DatabaseMetrics = {
  connectionCount: (count: number) =>
    publishMetric({ name: 'DatabaseConnectionCount', value: count }),

  queryLatency: (durationMs: number) =>
    publishMetric({
      name: 'DatabaseQueryLatency',
      value: durationMs,
      unit: 'Milliseconds',
    }),
};
