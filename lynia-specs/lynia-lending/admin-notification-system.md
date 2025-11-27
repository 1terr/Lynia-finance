# Admin Notification System

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.8 Admin Dashboard Design
**Task ID**: P1-T045
**Priority**: Low
**Estimated Duration**: 4 hours

---

## 1. Overview

This specification defines the admin notification system that alerts platform administrators and operations staff about critical events, anomalies, and system issues that require immediate attention or oversight. Unlike customer notifications (WhatsApp/SMS), admin notifications are delivered via email and Slack for internal team communication.

**Key Objectives**:
- Enable real-time awareness of critical platform events
- Alert on operational anomalies and thresholds
- Facilitate rapid incident response
- Support proactive system monitoring
- Reduce manual monitoring overhead
- Ensure appropriate escalation paths

**Notification Channels**:
1. **Email** - Detailed notifications with context and links
2. **Slack** - Real-time alerts for immediate awareness
3. **In-App Notifications** - Dashboard notification center
4. **SMS** (Critical only) - For severe incidents

---

## 2. Notification Architecture

### 2.1 Notification Types

```typescript
enum AdminNotificationType {
  // Operational Alerts
  HIGH_VALUE_LOAN_APPROVAL = 'high_value_loan_approval',
  MANUAL_REVIEW_REQUIRED = 'manual_review_required',
  KYC_QUEUE_BACKLOG = 'kyc_queue_backlog',
  DEVICE_HANDOVER_DELAYED = 'device_handover_delayed',

  // Financial Alerts
  FAILED_PAYMENT_SPIKE = 'failed_payment_spike',
  COLLECTION_TARGET_MISS = 'collection_target_miss',
  RECONCILIATION_MISMATCH = 'reconciliation_mismatch',
  REFUND_REQUESTED = 'refund_requested',

  // Risk Alerts
  FRAUD_DETECTED = 'fraud_detected',
  DELINQUENCY_THRESHOLD = 'delinquency_threshold',
  MULTIPLE_LOAN_DEFAULTS = 'multiple_loan_defaults',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',

  // System Alerts
  API_ERROR_RATE_HIGH = 'api_error_rate_high',
  GATEWAY_FAILURE = 'gateway_failure',
  DATABASE_SLOW_QUERY = 'database_slow_query',
  SERVICE_DEGRADATION = 'service_degradation',
  SECURITY_EVENT = 'security_event',

  // Compliance Alerts
  SLA_BREACH = 'sla_breach',
  AUDIT_LOG_ANOMALY = 'audit_log_anomaly',
  DATA_EXPORT_REQUESTED = 'data_export_requested',
  ADMIN_PERMISSION_CHANGE = 'admin_permission_change',

  // Inventory Alerts
  LOW_STOCK_WARNING = 'low_stock_warning',
  DEVICE_LOCK_FAILED = 'device_lock_failed',
  REPOSSESSION_DUE = 'repossession_due'
}

enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  IN_APP = 'in_app',
  SMS = 'sms'
}
```

### 2.2 Notification Data Model

```typescript
interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;

  // Context
  resourceType?: string; // 'loan', 'payment', 'customer', etc.
  resourceId?: string;
  resourceUrl?: string; // Deep link to resource in admin dashboard

  // Data
  metadata: Record<string, any>;
  metrics?: Record<string, number>;

  // Delivery
  channels: NotificationChannel[];
  recipients: NotificationRecipient[];

  // Status
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: string;
  deliveredAt?: string;

  // Action tracking
  actionable: boolean;
  actionUrl?: string;
  actionLabel?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;

  // Grouping (to prevent notification fatigue)
  groupKey?: string; // For deduplication/grouping
  suppressUntil?: string; // Temporary suppression

  createdAt: string;
  expiresAt?: string;
}

interface NotificationRecipient {
  type: 'role' | 'user' | 'email' | 'slack_channel';
  identifier: string; // role name, user ID, email, or slack channel
}

interface NotificationRule {
  id: string;
  notificationType: AdminNotificationType;
  severity: NotificationSeverity;
  enabled: boolean;

  // Conditions
  conditions: {
    threshold?: number;
    timeWindow?: number; // minutes
    frequency?: 'immediate' | 'batched' | 'daily_digest';
    businessHoursOnly?: boolean;
  };

  // Recipients
  recipients: NotificationRecipient[];
  channels: NotificationChannel[];

  // Throttling (to prevent spam)
  throttling: {
    maxPerHour?: number;
    groupingWindow?: number; // minutes
    cooldownPeriod?: number; // minutes after last notification
  };

  // Template
  messageTemplate: string;

  createdBy: string;
  updatedAt: string;
}
```

---

## 3. Notification Categories

### 3.1 High-Value Loan Approval Alerts

**Trigger**: Loan approved for amount ≥ $350 or manual override

```typescript
interface HighValueLoanAlert extends AdminNotification {
  type: AdminNotificationType.HIGH_VALUE_LOAN_APPROVAL;
  severity: NotificationSeverity.WARNING;

  metadata: {
    loanId: string;
    customerId: string;
    customerName: string;
    approvedAmount: number;
    approvedBy: string;
    approvalType: 'auto' | 'manual_override';
    creditScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    isFirstTimeBorrower: boolean;
  };
}

// Example notification configuration
const HIGH_VALUE_LOAN_RULE: NotificationRule = {
  id: 'high-value-loan-approval',
  notificationType: AdminNotificationType.HIGH_VALUE_LOAN_APPROVAL,
  severity: NotificationSeverity.WARNING,
  enabled: true,

  conditions: {
    threshold: 350, // USD
    frequency: 'immediate'
  },

  recipients: [
    { type: 'role', identifier: 'operations_manager' },
    { type: 'role', identifier: 'finance_team' },
    { type: 'slack_channel', identifier: '#loan-approvals' }
  ],

  channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK],

  throttling: {
    maxPerHour: 20,
    groupingWindow: 5 // Group approvals within 5 minutes
  },

  messageTemplate: `
    🔔 High-Value Loan Approved

    Amount: ${{approvedAmount}}
    Customer: {{customerName}} ({{customerId}})
    Approved by: {{approvedBy}}
    Approval type: {{approvalType}}
    Credit score: {{creditScore}}
    Risk level: {{riskLevel}}

    [View Loan Details]({{resourceUrl}})
  `
};
```

### 3.2 Failed Payment Spike Alerts

**Trigger**: Failed payment rate exceeds threshold in time window

```typescript
interface FailedPaymentSpikeAlert extends AdminNotification {
  type: AdminNotificationType.FAILED_PAYMENT_SPIKE;
  severity: NotificationSeverity.ERROR;

  metadata: {
    timeWindow: number; // minutes
    totalPayments: number;
    failedPayments: number;
    failureRate: number; // percentage
    affectedGateways: string[];
    primaryFailureReason: string;
  };

  metrics: {
    normalFailureRate: number;
    currentFailureRate: number;
    deviation: number; // percentage points above normal
  };
}

// Detection logic
async function detectFailedPaymentSpike() {
  const supabase = createServerClient();

  const timeWindow = 60; // Last 60 minutes
  const since = new Date(Date.now() - timeWindow * 60 * 1000);

  // Get payment stats
  const { data: payments } = await supabase
    .from('payments')
    .select('status, gateway')
    .gte('created_at', since.toISOString());

  const totalPayments = payments.length;
  const failedPayments = payments.filter(p => p.status === 'failed').length;
  const failureRate = (failedPayments / totalPayments) * 100;

  // Check against threshold
  const NORMAL_FAILURE_RATE = 5; // 5%
  const SPIKE_THRESHOLD = 15; // 15%

  if (failureRate > SPIKE_THRESHOLD) {
    // Group failures by gateway
    const gatewayFailures = payments
      .filter(p => p.status === 'failed')
      .reduce((acc, p) => {
        acc[p.gateway] = (acc[p.gateway] || 0) + 1;
        return acc;
      }, {});

    await createAdminNotification({
      type: AdminNotificationType.FAILED_PAYMENT_SPIKE,
      severity: NotificationSeverity.ERROR,
      title: `Payment Failure Spike Detected (${failureRate.toFixed(1)}%)`,
      message: `Failed payment rate has spiked to ${failureRate.toFixed(1)}% in the last ${timeWindow} minutes, ${failureRate - NORMAL_FAILURE_RATE}% above normal.`,
      metadata: {
        timeWindow,
        totalPayments,
        failedPayments,
        failureRate,
        affectedGateways: Object.keys(gatewayFailures),
        gatewayBreakdown: gatewayFailures
      },
      metrics: {
        normalFailureRate: NORMAL_FAILURE_RATE,
        currentFailureRate: failureRate,
        deviation: failureRate - NORMAL_FAILURE_RATE
      },
      actionable: true,
      actionUrl: '/dashboard/payments?filter=failed',
      actionLabel: 'View Failed Payments'
    });
  }
}
```

### 3.3 KYC Verification Failure Alerts

**Trigger**: Multiple KYC failures or queue backlog

```typescript
interface KYCFailureAlert extends AdminNotification {
  type: AdminNotificationType.KYC_QUEUE_BACKLOG;
  severity: NotificationSeverity.WARNING;

  metadata: {
    queueSize: number;
    averageWaitTime: number; // minutes
    oldestSubmission: string; // timestamp
    slaBreaches: number;
    failureRate: number; // percentage
    topFailureReasons: Array<{
      reason: string;
      count: number;
    }>;
  };
}

// Alert configuration
const KYC_BACKLOG_RULE: NotificationRule = {
  id: 'kyc-queue-backlog',
  notificationType: AdminNotificationType.KYC_QUEUE_BACKLOG,
  severity: NotificationSeverity.WARNING,
  enabled: true,

  conditions: {
    threshold: 20, // Queue size
    frequency: 'batched',
    businessHoursOnly: false
  },

  recipients: [
    { type: 'role', identifier: 'kyc_reviewer' },
    { type: 'role', identifier: 'operations_manager' }
  ],

  channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK],

  throttling: {
    cooldownPeriod: 120 // Don't resend for 2 hours
  },

  messageTemplate: `
    ⚠️ KYC Review Queue Backlog

    Queue size: {{queueSize}} submissions
    Average wait time: {{averageWaitTime}} minutes
    SLA breaches: {{slaBreaches}}
    Oldest submission: {{oldestSubmission}}

    Top failure reasons:
    {{#topFailureReasons}}
    - {{reason}}: {{count}}
    {{/topFailureReasons}}

    [Review Queue]({{actionUrl}})
  `
};
```

### 3.4 System Error Alerts

**Trigger**: API error rate spike, service degradation, critical exceptions

```typescript
interface SystemErrorAlert extends AdminNotification {
  type: AdminNotificationType.API_ERROR_RATE_HIGH | AdminNotificationType.SERVICE_DEGRADATION;
  severity: NotificationSeverity.CRITICAL;

  metadata: {
    service: string;
    errorType: string;
    errorCount: number;
    errorRate: number;
    timeWindow: number;
    affectedEndpoints: string[];
    sampleErrors: Array<{
      timestamp: string;
      endpoint: string;
      error: string;
      stackTrace?: string;
    }>;
    impactedUsers?: number;
  };
}

// Error monitoring
async function monitorSystemErrors() {
  // This would integrate with your logging/monitoring service
  // Example: CloudWatch, Sentry, DataDog, etc.

  const errorRate = await getErrorRateFromCloudWatch({
    service: 'lambda-functions',
    timeWindow: 5 // minutes
  });

  const ERROR_RATE_THRESHOLD = 5; // 5% error rate

  if (errorRate > ERROR_RATE_THRESHOLD) {
    await createAdminNotification({
      type: AdminNotificationType.API_ERROR_RATE_HIGH,
      severity: NotificationSeverity.CRITICAL,
      title: `Critical: API Error Rate Spike (${errorRate}%)`,
      message: `API error rate has exceeded ${ERROR_RATE_THRESHOLD}% in the last 5 minutes. Immediate investigation required.`,
      metadata: {
        errorRate,
        threshold: ERROR_RATE_THRESHOLD,
        affectedServices: ['payment-processing', 'kyc-verification']
      },
      recipients: [
        { type: 'role', identifier: 'super_admin' },
        { type: 'slack_channel', identifier: '#alerts-critical' }
      ],
      channels: [NotificationChannel.SLACK, NotificationChannel.EMAIL, NotificationChannel.SMS],
      actionable: true,
      actionUrl: 'https://console.aws.amazon.com/cloudwatch'
    });
  }
}
```

### 3.5 Fraud Detection Alerts

**Trigger**: Fraud detection system flags suspicious activity

```typescript
interface FraudAlert extends AdminNotification {
  type: AdminNotificationType.FRAUD_DETECTED;
  severity: NotificationSeverity.ERROR;

  metadata: {
    fraudType: 'identity_theft' | 'payment_fraud' | 'device_fraud' | 'application_fraud';
    riskScore: number;
    customerId: string;
    customerName: string;
    loanId?: string;
    indicators: string[];
    estimatedLoss: number;
    blockedAutomatically: boolean;
  };
}

// Fraud alert rule
const FRAUD_DETECTION_RULE: NotificationRule = {
  id: 'fraud-detection',
  notificationType: AdminNotificationType.FRAUD_DETECTED,
  severity: NotificationSeverity.ERROR,
  enabled: true,

  conditions: {
    threshold: 70, // Risk score
    frequency: 'immediate'
  },

  recipients: [
    { type: 'role', identifier: 'operations_manager' },
    { type: 'role', identifier: 'super_admin' },
    { type: 'slack_channel', identifier: '#fraud-alerts' }
  ],

  channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK, NotificationChannel.IN_APP],

  throttling: {
    maxPerHour: 50 // Allow more fraud alerts
  },

  messageTemplate: `
    🚨 FRAUD ALERT

    Fraud type: {{fraudType}}
    Risk score: {{riskScore}}/100
    Customer: {{customerName}} ({{customerId}})
    {{#loanId}}Loan ID: {{loanId}}{{/loanId}}
    Estimated loss: ${{estimatedLoss}}
    Auto-blocked: {{blockedAutomatically}}

    Indicators:
    {{#indicators}}
    - {{.}}
    {{/indicators}}

    [Investigate]({{resourceUrl}})
  `
};
```

---

## 4. Notification Delivery

### 4.1 Email Delivery

```typescript
// lib/notifications/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmailNotification(notification: AdminNotification) {
  // Get email addresses for recipients
  const emailAddresses = await resolveEmailRecipients(notification.recipients);

  const { data, error } = await resend.emails.send({
    from: 'Lynia Platform <alerts@lynia.com>',
    to: emailAddresses,
    subject: `[${notification.severity.toUpperCase()}] ${notification.title}`,
    html: renderEmailTemplate(notification),
    tags: [
      { name: 'notification_type', value: notification.type },
      { name: 'severity', value: notification.severity }
    ]
  });

  if (error) {
    console.error('Email notification failed:', error);
    throw error;
  }

  return data;
}

function renderEmailTemplate(notification: AdminNotification): string {
  const severityColors = {
    info: '#0ea5e9',
    warning: '#f59e0b',
    error: '#ef4444',
    critical: '#dc2626'
  };

  const severityIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: ${severityColors[notification.severity]}; color: white; padding: 20px;">
          <h1 style="margin: 0; font-size: 20px;">
            ${severityIcons[notification.severity]} ${notification.title}
          </h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">
            ${new Date(notification.createdAt).toLocaleString('en-ZW', {
              timeZone: 'Africa/Harare',
              dateStyle: 'medium',
              timeStyle: 'short'
            })}
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px; color: #374151; line-height: 1.6;">
            ${notification.message}
          </p>

          ${notification.metadata ? renderMetadata(notification.metadata) : ''}

          ${notification.actionable ? `
            <div style="margin-top: 24px;">
              <a href="${notification.actionUrl}"
                 style="display: inline-block; background: ${severityColors[notification.severity]}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
                ${notification.actionLabel || 'View Details'}
              </a>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">
            This is an automated alert from Lynia Finance platform.
            <br>
            <a href="${process.env.ADMIN_DASHBOARD_URL}/notifications/${notification.id}"
               style="color: #2563eb;">View in dashboard</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function renderMetadata(metadata: Record<string, any>): string {
  return `
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin-top: 16px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #374151;">
        Details
      </h3>
      <table style="width: 100%; font-size: 14px;">
        ${Object.entries(metadata)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `
            <tr>
              <td style="padding: 4px 0; color: #6b7280; font-weight: 500;">
                ${formatKey(key)}:
              </td>
              <td style="padding: 4px 0 4px 16px; color: #111827;">
                ${formatValue(value)}
              </td>
            </tr>
          `).join('')}
      </table>
    </div>
  `;
}
```

### 4.2 Slack Delivery

```typescript
// lib/notifications/slack.ts
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function sendSlackNotification(notification: AdminNotification) {
  // Resolve Slack channels for recipients
  const channels = await resolveSlackChannels(notification.recipients);

  for (const channel of channels) {
    await slack.chat.postMessage({
      channel: channel,
      ...formatSlackMessage(notification)
    });
  }
}

function formatSlackMessage(notification: AdminNotification) {
  const severityColors = {
    info: '#0ea5e9',
    warning: '#f59e0b',
    error: '#ef4444',
    critical: '#dc2626'
  };

  const severityEmojis = {
    info: ':information_source:',
    warning: ':warning:',
    error: ':x:',
    critical: ':rotating_light:'
  };

  return {
    text: `${severityEmojis[notification.severity]} ${notification.title}`,
    attachments: [
      {
        color: severityColors[notification.severity],
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: notification.title,
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: notification.message
            }
          },
          ...(notification.metadata ? [
            {
              type: 'section',
              fields: Object.entries(notification.metadata)
                .slice(0, 10) // Slack limit
                .map(([key, value]) => ({
                  type: 'mrkdwn',
                  text: `*${formatKey(key)}:*\n${formatValue(value)}`
                }))
            }
          ] : []),
          ...(notification.actionable ? [
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: notification.actionLabel || 'View Details'
                  },
                  url: notification.actionUrl,
                  style: notification.severity === 'critical' ? 'danger' : 'primary'
                }
              ]
            }
          ] : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Severity: *${notification.severity.toUpperCase()}* | ${new Date(notification.createdAt).toLocaleString('en-ZW', { timeZone: 'Africa/Harare' })}`
              }
            ]
          }
        ]
      }
    ]
  };
}
```

### 4.3 In-App Notification Center

```typescript
// components/notifications/NotificationCenter.tsx
'use client';

import { useNotifications } from '@/lib/hooks/useNotifications';
import { BellIcon } from '@heroicons/react/24/outline';

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="relative">
      {/* Bell icon with badge */}
      <button className="relative p-2 rounded-lg hover:bg-gray-100">
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification dropdown */}
      <NotificationDropdown
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      />
    </div>
  );
}
```

---

## 5. Notification Management

### 5.1 Database Schema

```sql
-- Admin notifications table
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Notification details
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Context
  resource_type VARCHAR(50),
  resource_id UUID,
  resource_url TEXT,

  -- Data
  metadata JSONB,
  metrics JSONB,

  -- Delivery
  channels TEXT[] NOT NULL,
  recipients JSONB NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Actions
  actionable BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  action_label VARCHAR(100),

  -- Acknowledgment
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by UUID REFERENCES admin_users(id),
  acknowledged_at TIMESTAMPTZ,

  -- Grouping
  group_key VARCHAR(255),
  suppress_until TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed'))
);

-- Notification rules table
CREATE TABLE admin_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Conditions
  conditions JSONB NOT NULL,

  -- Recipients
  recipients JSONB NOT NULL,
  channels TEXT[] NOT NULL,

  -- Throttling
  throttling JSONB,

  -- Template
  message_template TEXT NOT NULL,

  -- Metadata
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(notification_type)
);

-- Indexes
CREATE INDEX idx_admin_notif_type ON admin_notifications(type);
CREATE INDEX idx_admin_notif_severity ON admin_notifications(severity);
CREATE INDEX idx_admin_notif_status ON admin_notifications(status);
CREATE INDEX idx_admin_notif_created_at ON admin_notifications(created_at DESC);
CREATE INDEX idx_admin_notif_group_key ON admin_notifications(group_key);
CREATE INDEX idx_admin_notif_acknowledged ON admin_notifications(acknowledged) WHERE NOT acknowledged;
```

---

## 6. Notification Throttling & Deduplication

```typescript
// Prevent notification fatigue
async function shouldSendNotification(
  type: AdminNotificationType,
  groupKey?: string
): Promise<boolean> {
  const supabase = createServerClient();

  // Get notification rule
  const { data: rule } = await supabase
    .from('admin_notification_rules')
    .select('*')
    .eq('notification_type', type)
    .single();

  if (!rule || !rule.enabled) {
    return false;
  }

  // Check throttling
  if (rule.throttling?.maxPerHour) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { count } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('type', type)
      .gte('created_at', oneHourAgo.toISOString());

    if (count >= rule.throttling.maxPerHour) {
      console.log(`Notification throttled: ${type} (${count}/${rule.throttling.maxPerHour} per hour)`);
      return false;
    }
  }

  // Check cooldown period
  if (rule.throttling?.cooldownPeriod && groupKey) {
    const cooldownAgo = new Date(Date.now() - rule.throttling.cooldownPeriod * 60 * 1000);

    const { data: recent } = await supabase
      .from('admin_notifications')
      .select('id')
      .eq('type', type)
      .eq('group_key', groupKey)
      .gte('created_at', cooldownAgo.toISOString())
      .limit(1)
      .maybeSingle();

    if (recent) {
      console.log(`Notification in cooldown: ${type} (group: ${groupKey})`);
      return false;
    }
  }

  return true;
}
```

---

## 7. Implementation Checklist

- [ ] Create admin_notifications table
- [ ] Create admin_notification_rules table
- [ ] Implement notification creation service
- [ ] Build email delivery with Resend
- [ ] Build Slack integration with @slack/web-api
- [ ] Create in-app notification center UI
- [ ] Implement notification throttling logic
- [ ] Build notification rule management UI
- [ ] Add notification preferences per admin user
- [ ] Create notification templates
- [ ] Implement batch/digest notifications
- [ ] Add notification acknowledgment tracking
- [ ] Build notification analytics dashboard
- [ ] Create notification testing tools
- [ ] Implement notification retry logic
- [ ] Add notification suppression/snooze
- [ ] Set up monitoring for notification delivery
- [ ] Write integration tests

---

## 8. Configuration Examples

```typescript
// Default notification rules
export const DEFAULT_NOTIFICATION_RULES: NotificationRule[] = [
  {
    id: 'high-value-loan',
    notificationType: AdminNotificationType.HIGH_VALUE_LOAN_APPROVAL,
    severity: NotificationSeverity.WARNING,
    enabled: true,
    conditions: { threshold: 350, frequency: 'immediate' },
    recipients: [
      { type: 'role', identifier: 'operations_manager' },
      { type: 'slack_channel', identifier: '#loan-approvals' }
    ],
    channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    throttling: { maxPerHour: 20, groupingWindow: 5 },
    messageTemplate: '...'
  },
  {
    id: 'failed-payment-spike',
    notificationType: AdminNotificationType.FAILED_PAYMENT_SPIKE,
    severity: NotificationSeverity.ERROR,
    enabled: true,
    conditions: { threshold: 15, timeWindow: 60, frequency: 'immediate' },
    recipients: [
      { type: 'role', identifier: 'super_admin' },
      { type: 'slack_channel', identifier: '#alerts-critical' }
    ],
    channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
    throttling: { cooldownPeriod: 30 },
    messageTemplate: '...'
  }
];
```

---

**Document Status**: Complete
**Last Updated**: November 27, 2025
**Next Review**: Phase 2 Planning
