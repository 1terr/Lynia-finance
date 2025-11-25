# WhatsApp Rate Limiting Strategy

**Task ID**: P1-T013
**Phase**: Phase 1 - WhatsApp Bot Design
**Priority**: Medium
**Estimated**: 4 hours
**Dependencies**: P1-T003 (API Specification)

---

## Table of Contents
1. [Overview](#overview)
2. [WhatsApp Rate Limits](#whatsapp-rate-limits)
3. [Rate Limit Handling](#rate-limit-handling)
4. [Queue Management](#queue-management)
5. [Retry Mechanisms](#retry-mechanisms)
6. [User Notifications](#user-notifications)
7. [Implementation Guide](#implementation-guide)
8. [Monitoring & Alerts](#monitoring--alerts)

---

## 1. Overview

WhatsApp Business Platform enforces rate limits to prevent spam and ensure service quality. This document defines strategies to handle rate limits gracefully while maintaining a good user experience.

### Rate Limiting Goals

1. **Prevent Message Loss**: Never drop messages due to rate limits
2. **Graceful Degradation**: Queue messages and retry with backoff
3. **User Transparency**: Notify users of delays during high traffic
4. **Cost Optimization**: Minimize failed API calls ($0.005/message)
5. **Scalability**: Handle 1000+ concurrent users in Year 3

---

## 2. WhatsApp Rate Limits

### 2.1 Official WhatsApp Limits (2025)

| Tier | Messages/Day | Messages/Second | Qualification |
|------|-------------|-----------------|---------------|
| **Tier 1** | 1,000 | ~0.01 | New accounts |
| **Tier 2** | 10,000 | ~0.1 | 7 days, good quality |
| **Tier 3** | 100,000 | ~1 | 30 days, good quality |
| **Tier 4** | Unlimited | ~10 | 90 days, excellent quality |

**Lynia Finance Trajectory**:
- **Month 1-3**: Tier 1 (1,000 msg/day) - 30-50 users
- **Month 4-6**: Tier 2 (10,000 msg/day) - 300-500 users
- **Year 2**: Tier 3 (100,000 msg/day) - 3,000-5,000 users
- **Year 3+**: Tier 4 (Unlimited) - 10,000+ users

### 2.2 Rate Limit Response Codes

WhatsApp returns HTTP 429 (Too Many Requests) with retry headers:

```json
{
  "error": {
    "code": 80007,
    "title": "Rate limit hit",
    "message": "Too many messages sent",
    "error_data": {
      "details": "Tier limit exceeded"
    }
  }
}
```

**Response Headers**:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706112000
```

### 2.3 Quality Rating Impact

WhatsApp measures quality based on user feedback:

| Quality Rating | Impact | Causes |
|---------------|--------|--------|
| **High** | Tier upgrades faster | <5% block rate, positive engagement |
| **Medium** | Normal tier progression | 5-15% block rate |
| **Low** | Tier downgrades, restrictions | >15% block rate, spam reports |

**Block Rate** = (Blocked Messages / Total Messages) × 100

**Lynia Finance Strategy**:
- Target <3% block rate (excellent quality)
- Avoid spam patterns (too many messages/day to same user)
- Respect user opt-out requests immediately

---

## 3. Rate Limit Handling

### 3.1 Detection Strategy

**Proactive Detection** (before hitting limit):
```typescript
interface RateLimitState {
  current_tier: 1 | 2 | 3 | 4;
  daily_limit: number;
  messages_sent_today: number;
  messages_remaining: number;
  reset_time: Date;
}

async function getRateLimitState(): Promise<RateLimitState> {
  // Get from Redis cache (updated every API call)
  const state = await redis.get('whatsapp:rate_limit_state');
  return JSON.parse(state);
}

async function canSendMessage(): Promise<boolean> {
  const state = await getRateLimitState();

  // Check if we're within 90% of limit (safety buffer)
  const safeLimit = state.daily_limit * 0.9;

  return state.messages_sent_today < safeLimit;
}
```

**Reactive Detection** (after API response):
```typescript
async function handleWhatsAppResponse(response: AxiosResponse): Promise<void> {
  // Update rate limit state from response headers
  if (response.headers['x-ratelimit-remaining']) {
    const remaining = parseInt(response.headers['x-ratelimit-remaining']);
    const resetTime = new Date(parseInt(response.headers['x-ratelimit-reset']) * 1000);

    await redis.set('whatsapp:rate_limit_state', JSON.stringify({
      messages_remaining: remaining,
      reset_time: resetTime
    }));
  }

  // Handle 429 Too Many Requests
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers['retry-after'] || '60');
    await handleRateLimitExceeded(retryAfter);
  }
}
```

### 3.2 Circuit Breaker Pattern

Prevent cascading failures when rate limit is hit:

```typescript
import CircuitBreaker from 'opossum';

const whatsappCircuitBreaker = new CircuitBreaker(sendWhatsAppMessageDirect, {
  timeout: 5000, // 5 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 60000, // 1-minute rolling window
  name: 'WhatsApp API'
});

whatsappCircuitBreaker.on('open', () => {
  console.error('WhatsApp circuit breaker opened - rate limit likely hit');
  // Switch to queue-only mode
  switchToQueueMode();
});

whatsappCircuitBreaker.on('halfOpen', () => {
  console.log('WhatsApp circuit breaker half-open - testing recovery');
});

whatsappCircuitBreaker.on('close', () => {
  console.log('WhatsApp circuit breaker closed - normal operation resumed');
  switchToDirectMode();
});

async function sendWhatsAppMessageSafe(phoneNumber: string, message: any): Promise<void> {
  try {
    await whatsappCircuitBreaker.fire(phoneNumber, message);
  } catch (error) {
    // Circuit is open, queue message instead
    await queueMessage(phoneNumber, message);
  }
}
```

---

## 4. Queue Management

### 4.1 SQS Queue Architecture

```
┌─────────────────────────────────────────────────┐
│ User sends message                              │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ Lambda: Check rate limit                       │
│ - Can send now? → Send immediately             │
│ - Rate limited? → Queue to SQS                 │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ SQS Queue: whatsapp-messages-queue.fifo        │
│ - FIFO (First-In-First-Out)                    │
│ - Deduplication (5-minute window)              │
│ - Visibility timeout: 30 seconds               │
│ - Max retries: 3                               │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ Lambda: Message Processor (scheduled 1/minute) │
│ - Pull batch from queue (up to 10 messages)    │
│ - Check rate limit again                       │
│ - Send messages with throttling                │
│ - Delete from queue on success                 │
└─────────────────────────────────────────────────┘
```

### 4.2 SQS Configuration

**Queue Creation**:
```typescript
import { SQSClient, CreateQueueCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({ region: 'us-east-1' });

async function createMessageQueue() {
  const command = new CreateQueueCommand({
    QueueName: 'whatsapp-messages-queue.fifo',
    Attributes: {
      'FifoQueue': 'true',
      'ContentBasedDeduplication': 'true',
      'MessageRetentionPeriod': '86400', // 24 hours
      'VisibilityTimeout': '30', // 30 seconds
      'ReceiveMessageWaitTimeSeconds': '10' // Long polling
    }
  });

  const response = await sqsClient.send(command);
  return response.QueueUrl;
}
```

### 4.3 Message Queueing Logic

```typescript
import { SendMessageCommand } from '@aws-sdk/client-sqs';

interface QueuedMessage {
  phone_number: string;
  message: any; // WhatsApp message payload
  priority: 'high' | 'medium' | 'low';
  queued_at: string;
  customer_id?: string;
}

async function queueMessage(
  phoneNumber: string,
  message: any,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<void> {
  const queuedMessage: QueuedMessage = {
    phone_number: phoneNumber,
    message,
    priority,
    queued_at: new Date().toISOString()
  };

  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify(queuedMessage),
    MessageGroupId: phoneNumber, // FIFO grouping (one queue per user)
    MessageDeduplicationId: `${phoneNumber}-${Date.now()}` // Deduplication
  });

  await sqsClient.send(command);

  // Log to database for tracking
  await supabase.from('queued_messages').insert({
    phone_number: phoneNumber,
    message_type: message.type,
    priority,
    status: 'queued'
  });
}
```

### 4.4 Queue Processing (Scheduled Lambda)

```typescript
import { ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

// Triggered by EventBridge every 1 minute
export async function processQueuedMessages(): Promise<void> {
  const state = await getRateLimitState();

  // Check if we can send more messages
  if (!canSendMessage()) {
    console.log('Rate limit reached, skipping queue processing');
    return;
  }

  // Calculate how many messages we can send
  const batchSize = Math.min(10, state.messages_remaining);

  // Receive messages from queue
  const receiveCommand = new ReceiveMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MaxNumberOfMessages: batchSize,
    WaitTimeSeconds: 10 // Long polling
  });

  const response = await sqsClient.send(receiveCommand);

  if (!response.Messages || response.Messages.length === 0) {
    console.log('No messages in queue');
    return;
  }

  // Process each message
  for (const sqsMessage of response.Messages) {
    const queuedMessage: QueuedMessage = JSON.parse(sqsMessage.Body!);

    try {
      // Send WhatsApp message
      await sendWhatsAppMessageDirect(queuedMessage.phone_number, queuedMessage.message);

      // Delete from queue on success
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL,
        ReceiptHandle: sqsMessage.ReceiptHandle
      }));

      // Update database
      await supabase
        .from('queued_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('phone_number', queuedMessage.phone_number)
        .eq('status', 'queued');

      // Throttle to avoid bursting
      await sleep(100); // 100ms between messages
    } catch (error) {
      console.error('Failed to send message:', error);
      // Message will become visible again after VisibilityTimeout
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 4.5 Priority Queueing

**High Priority**: Payment confirmations, KYC approvals, device unlock codes
**Medium Priority**: Standard responses, browsing messages
**Low Priority**: Marketing messages, reminders

```typescript
// Separate queues by priority
const QUEUES = {
  high: 'whatsapp-messages-high-priority.fifo',
  medium: 'whatsapp-messages-medium-priority.fifo',
  low: 'whatsapp-messages-low-priority.fifo'
};

async function processAllQueues(): Promise<void> {
  // Process high priority first
  await processQueue(QUEUES.high, 5); // Allocate 50% capacity to high
  await processQueue(QUEUES.medium, 3); // 30% to medium
  await processQueue(QUEUES.low, 2); // 20% to low
}
```

---

## 5. Retry Mechanisms

### 5.1 Exponential Backoff Strategy

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 1 minute
  backoffMultiplier: 2
};

async function sendWithRetry(
  phoneNumber: string,
  message: any,
  retryCount: number = 0
): Promise<void> {
  try {
    await sendWhatsAppMessageDirect(phoneNumber, message);
  } catch (error) {
    if (error.response?.status === 429 && retryCount < RETRY_CONFIG.maxRetries) {
      // Calculate delay with exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
        RETRY_CONFIG.maxDelayMs
      );

      console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`);

      await sleep(delay);
      return sendWithRetry(phoneNumber, message, retryCount + 1);
    } else {
      // Max retries exceeded or non-retryable error
      throw error;
    }
  }
}
```

### 5.2 Jitter for Retry Timing

Add randomness to prevent thundering herd:

```typescript
function calculateDelayWithJitter(baseDelay: number): number {
  // Add ±20% jitter
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(baseDelay + jitter);
}

// Example: 1000ms base delay → 800-1200ms actual delay
```

### 5.3 Dead Letter Queue (DLQ)

Messages that fail after max retries go to DLQ for manual review:

```typescript
async function createDeadLetterQueue() {
  // Create DLQ
  const dlqResponse = await sqsClient.send(new CreateQueueCommand({
    QueueName: 'whatsapp-messages-dlq.fifo',
    Attributes: {
      'FifoQueue': 'true',
      'MessageRetentionPeriod': '1209600' // 14 days
    }
  }));

  // Configure main queue to use DLQ
  await sqsClient.send(new SetQueueAttributesCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    Attributes: {
      'RedrivePolicy': JSON.stringify({
        deadLetterTargetArn: dlqResponse.QueueUrl,
        maxReceiveCount: 3 // Move to DLQ after 3 failed attempts
      })
    }
  }));
}
```

---

## 6. User Notifications

### 6.1 Delay Notification Strategy

**Notify users when**:
- Message queued for >2 minutes
- Rate limit tier is low (Tier 1: 1,000 msg/day)
- Queue depth >100 messages

```typescript
async function notifyUserOfDelay(phoneNumber: string, estimatedDelay: number): Promise<void> {
  const delayMinutes = Math.ceil(estimatedDelay / 60);

  await sendWhatsAppMessage(phoneNumber, {
    type: 'text',
    text: {
      body: `We're experiencing high traffic. Your message has been queued and will be processed in approximately ${delayMinutes} minute(s). Thank you for your patience!`
    }
  });
}
```

### 6.2 Queue Position Updates

For long queues, provide position updates:

```typescript
async function getQueuePosition(phoneNumber: string): Promise<number> {
  // Get all messages in queue
  const { Attributes } = await sqsClient.send(new GetQueueAttributesCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    AttributeNames: ['ApproximateNumberOfMessages']
  }));

  return parseInt(Attributes!.ApproximateNumberOfMessages || '0');
}

async function sendQueuePositionUpdate(phoneNumber: string): Promise<void> {
  const position = await getQueuePosition(phoneNumber);

  if (position > 50) {
    await sendWhatsAppMessage(phoneNumber, {
      type: 'text',
      text: {
        body: `You're #${position} in the queue. We're processing messages as fast as we can!`
      }
    });
  }
}
```

### 6.3 Proactive Communication

**Daily Limit Approaching** (at 80% capacity):
```typescript
async function checkDailyLimitWarning(): Promise<void> {
  const state = await getRateLimitState();
  const usagePercentage = (state.messages_sent_today / state.daily_limit) * 100;

  if (usagePercentage >= 80 && usagePercentage < 85) {
    // Notify admin team
    await sendAdminAlert({
      type: 'rate_limit_warning',
      message: `WhatsApp daily limit at ${usagePercentage.toFixed(1)}% (${state.messages_sent_today}/${state.daily_limit})`,
      severity: 'medium'
    });
  }
}
```

---

## 7. Implementation Guide

### 7.1 Complete Rate Limiting Middleware

```typescript
import axios from 'axios';

class WhatsAppRateLimiter {
  private redis: Redis;
  private sqsClient: SQSClient;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.sqsClient = new SQSClient({ region: 'us-east-1' });
    this.circuitBreaker = new CircuitBreaker(this.sendDirect.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
  }

  async send(phoneNumber: string, message: any, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    // 1. Check if we can send immediately
    if (await this.canSendNow()) {
      try {
        await this.circuitBreaker.fire(phoneNumber, message);
        await this.trackSentMessage();
        return;
      } catch (error) {
        // Circuit breaker open or rate limit hit
        console.log('Direct send failed, queueing message');
      }
    }

    // 2. Queue message for later processing
    await this.queueMessage(phoneNumber, message, priority);

    // 3. Notify user of delay if queue is long
    const queueDepth = await this.getQueueDepth();
    if (queueDepth > 100) {
      const estimatedDelay = queueDepth * 0.5; // 0.5 seconds per message
      await this.notifyDelay(phoneNumber, estimatedDelay);
    }
  }

  private async canSendNow(): Promise<boolean> {
    const state = await this.getRateLimitState();
    const safeLimit = state.daily_limit * 0.9;
    return state.messages_sent_today < safeLimit;
  }

  private async sendDirect(phoneNumber: string, message: any): Promise<void> {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        ...message
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await this.updateRateLimitState(response.headers);
  }

  private async trackSentMessage(): Promise<void> {
    await this.redis.incr('whatsapp:messages_sent_today');
  }

  private async getRateLimitState(): Promise<RateLimitState> {
    const state = await this.redis.get('whatsapp:rate_limit_state');
    return JSON.parse(state || '{"messages_sent_today": 0, "daily_limit": 1000}');
  }

  private async updateRateLimitState(headers: any): Promise<void> {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0');
    const resetTime = new Date(parseInt(headers['x-ratelimit-reset'] || '0') * 1000);

    await this.redis.set('whatsapp:rate_limit_state', JSON.stringify({
      messages_remaining: remaining,
      reset_time: resetTime
    }));
  }

  private async queueMessage(phoneNumber: string, message: any, priority: string): Promise<void> {
    const queueUrl = priority === 'high' ? QUEUES.high : priority === 'low' ? QUEUES.low : QUEUES.medium;

    await this.sqsClient.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ phone_number: phoneNumber, message }),
      MessageGroupId: phoneNumber
    }));
  }

  private async getQueueDepth(): Promise<number> {
    const { Attributes } = await this.sqsClient.send(new GetQueueAttributesCommand({
      QueueUrl: QUEUES.medium,
      AttributeNames: ['ApproximateNumberOfMessages']
    }));

    return parseInt(Attributes!.ApproximateNumberOfMessages || '0');
  }

  private async notifyDelay(phoneNumber: string, estimatedDelay: number): Promise<void> {
    const delayMinutes = Math.ceil(estimatedDelay / 60);
    // Send delay notification (implementation from section 6.1)
  }
}

// Export singleton instance
export const whatsappRateLimiter = new WhatsAppRateLimiter();
```

### 7.2 Usage in Lambda Handlers

```typescript
import { whatsappRateLimiter } from './rate-limiter';

export async function handleUserMessage(phoneNumber: string, message: string): Promise<void> {
  // Process message and generate response
  const response = await generateBotResponse(message);

  // Send via rate limiter (handles queueing automatically)
  await whatsappRateLimiter.send(phoneNumber, response, 'medium');
}

export async function sendPaymentConfirmation(phoneNumber: string, amount: number): Promise<void> {
  const message = {
    type: 'text',
    text: {
      body: `Payment of $${amount.toFixed(2)} received. Thank you!`
    }
  };

  // High priority for payment confirmations
  await whatsappRateLimiter.send(phoneNumber, message, 'high');
}
```

---

## 8. Monitoring & Alerts

### 8.1 CloudWatch Metrics

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

async function publishMetrics() {
  const state = await getRateLimitState();
  const queueDepth = await getQueueDepth();

  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: 'LyniaFinance/WhatsApp',
    MetricData: [
      {
        MetricName: 'MessagesSentToday',
        Value: state.messages_sent_today,
        Unit: 'Count'
      },
      {
        MetricName: 'RateLimitRemaining',
        Value: state.messages_remaining,
        Unit: 'Count'
      },
      {
        MetricName: 'QueueDepth',
        Value: queueDepth,
        Unit: 'Count'
      },
      {
        MetricName: 'RateLimitUsagePercentage',
        Value: (state.messages_sent_today / state.daily_limit) * 100,
        Unit: 'Percent'
      }
    ]
  }));
}
```

### 8.2 CloudWatch Alarms

```typescript
import { PutMetricAlarmCommand } from '@aws-sdk/client-cloudwatch';

async function createRateLimitAlarms() {
  // Alarm 1: Rate limit at 90%
  await cloudwatch.send(new PutMetricAlarmCommand({
    AlarmName: 'WhatsApp-RateLimit-90Percent',
    ComparisonOperator: 'GreaterThanThreshold',
    EvaluationPeriods: 1,
    MetricName: 'RateLimitUsagePercentage',
    Namespace: 'LyniaFinance/WhatsApp',
    Period: 300, // 5 minutes
    Statistic: 'Average',
    Threshold: 90,
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_ALERT_TOPIC_ARN]
  }));

  // Alarm 2: Queue depth >200
  await cloudwatch.send(new PutMetricAlarmCommand({
    AlarmName: 'WhatsApp-QueueDepth-High',
    ComparisonOperator: 'GreaterThanThreshold',
    EvaluationPeriods: 2,
    MetricName: 'QueueDepth',
    Namespace: 'LyniaFinance/WhatsApp',
    Period: 300,
    Statistic: 'Average',
    Threshold: 200,
    ActionsEnabled: true,
    AlarmActions: [process.env.SNS_ALERT_TOPIC_ARN]
  }));
}
```

### 8.3 Dashboard Visualization

**CloudWatch Dashboard JSON**:
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["LyniaFinance/WhatsApp", "MessagesSentToday"],
          [".", "RateLimitRemaining"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "WhatsApp Rate Limit Usage"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["LyniaFinance/WhatsApp", "QueueDepth"]
        ],
        "period": 60,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Message Queue Depth"
      }
    }
  ]
}
```

---

## Summary

This document defines the rate limiting strategy for WhatsApp Business Platform:

1. **WhatsApp Rate Limits**: 4 tiers (1K → 10K → 100K → Unlimited messages/day)
2. **Rate Limit Handling**: Proactive + reactive detection, circuit breaker pattern
3. **Queue Management**: SQS FIFO queues with 3 priority levels
4. **Retry Mechanisms**: Exponential backoff with jitter, DLQ for failed messages
5. **User Notifications**: Delay notifications for queued messages

**Key Features**:
- Circuit breaker to prevent cascading failures
- Priority queueing (high/medium/low)
- Exponential backoff with max 5 retries
- Dead Letter Queue for failed messages
- CloudWatch metrics and alarms

**Cost Optimization**:
- Prevent wasted API calls from rate limit errors
- Queue messages during high traffic
- Target <3% message failure rate

**Next Steps**: Implement WhatsApp bot testing strategy (P1-T014) to validate all components.
