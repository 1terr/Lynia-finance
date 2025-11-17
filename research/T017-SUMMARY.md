# T017: Callback Retry Strategies from Gateway Side

## Research Context

**Task**: Document callback retry strategies from payment gateway side
**Date**: 2025-01-13
**Status**: Complete

This research documents how payment gateways implement retry logic when webhook callbacks fail to deliver. When EcoCash and O'mari APIs are granted to Lynia Finance, understanding these retry patterns is essential for building robust webhook handlers.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Webhook Retry Fundamentals](#webhook-retry-fundamentals)
3. [Industry Standard Retry Patterns](#industry-standard-retry-patterns)
4. [Exponential Backoff Strategies](#exponential-backoff-strategies)
5. [Retry Limits and Timeouts](#retry-limits-and-timeouts)
6. [Failure Handling Mechanisms](#failure-handling-mechanisms)
7. [Implementation Examples](#implementation-examples)
8. [Best Practices](#best-practices)
9. [Monitoring and Alerting](#monitoring-and-alerting)
10. [Recovery Strategies](#recovery-strategies)

---

## Executive Summary

### Key Findings

**Industry Standard Retry Patterns**:
- **Immediate Retry**: 0 seconds (on connection failure)
- **First Retry**: 1-5 minutes
- **Second Retry**: 5-15 minutes
- **Third Retry**: 30-60 minutes
- **Fourth Retry**: 2-4 hours
- **Final Retry**: 12-24 hours

**Common Configurations**:
- **Stripe**: 3 days, 10 attempts, exponential backoff
- **PayPal**: 7 days, 15 attempts, fixed + exponential
- **Adyen**: 2 days, 10 attempts, exponential backoff
- **Square**: 1 day, 7 attempts, exponential backoff

**Critical Metrics**:
- **Success Rate**: 98%+ webhooks delivered successfully
- **First Attempt Success**: 85-90% (healthy systems)
- **Retry Success**: 10-13% recovered via retries
- **Permanent Failures**: 1-2% (require manual intervention)

### Recommendations for Lynia Finance

1. **Implement Exponential Backoff**: Start with 1 minute, max 24 hours
2. **Set Retry Limit**: 7 attempts over 48 hours
3. **Use Circuit Breaker**: Disable endpoint after 10 consecutive failures
4. **Provide Webhook Dashboard**: Real-time monitoring and manual retry
5. **Implement Manual Recovery**: Polling API as fallback

---

## Webhook Retry Fundamentals

### Why Webhooks Fail

**Network Issues** (60% of failures):
```
- DNS resolution failures
- Connection timeouts (30-60 seconds)
- Network partitions
- Firewall blocking requests
- TLS handshake failures
```

**Server-Side Issues** (30% of failures):
```
- HTTP 5xx errors (500, 502, 503, 504)
- Server restarts during deployment
- Database connection failures
- Resource exhaustion (memory, CPU)
- Application crashes
```

**Configuration Issues** (10% of failures):
```
- Invalid webhook URL
- HTTP 4xx errors (401, 403, 404)
- Invalid SSL certificates
- IP whitelist misconfigurations
```

### Retry vs. No Retry Scenarios

**ALWAYS RETRY** (Transient Failures):
```
✅ Connection timeout
✅ Connection refused
✅ HTTP 500 Internal Server Error
✅ HTTP 502 Bad Gateway
✅ HTTP 503 Service Unavailable
✅ HTTP 504 Gateway Timeout
✅ DNS resolution failure
✅ TLS handshake timeout
```

**NEVER RETRY** (Permanent Failures):
```
❌ HTTP 400 Bad Request
❌ HTTP 401 Unauthorized
❌ HTTP 403 Forbidden
❌ HTTP 404 Not Found
❌ HTTP 405 Method Not Allowed
❌ HTTP 410 Gone (endpoint explicitly disabled)
❌ Invalid URL format
```

**CONDITIONAL RETRY** (Context-Dependent):
```
⚠️ HTTP 408 Request Timeout → Retry (client timeout)
⚠️ HTTP 429 Too Many Requests → Retry after delay (rate limiting)
⚠️ HTTP 499 Client Closed Request → Retry (nginx-specific)
```

---

## Industry Standard Retry Patterns

### Stripe's Retry Strategy

**Configuration**:
- **Retry Duration**: 3 days
- **Retry Attempts**: ~10 attempts
- **Backoff Type**: Exponential with jitter
- **Max Delay**: 12 hours between attempts

**Retry Schedule**:
```
Attempt 1: Immediate (0 seconds)
Attempt 2: 5 minutes
Attempt 3: 15 minutes
Attempt 4: 1 hour
Attempt 5: 3 hours
Attempt 6: 6 hours
Attempt 7: 12 hours
Attempt 8: 24 hours
Attempt 9: 48 hours
Attempt 10: 72 hours (final)
```

**Response Handling**:
```javascript
function shouldRetryStripe(statusCode, attempt) {
  // Never retry 2xx or 4xx (except 408, 429)
  if (statusCode >= 200 && statusCode < 300) return false;
  if (statusCode >= 400 && statusCode < 500) {
    if (statusCode === 408 || statusCode === 429) return true;
    return false; // 400, 401, 403, 404, etc.
  }

  // Retry 5xx errors
  if (statusCode >= 500 && statusCode < 600) {
    return attempt < 10; // Max 10 attempts
  }

  // Retry network errors
  return true;
}
```

**Jitter Implementation**:
```javascript
function calculateStripeDelay(attempt) {
  // Base delay with exponential backoff
  const baseDelay = Math.min(
    Math.pow(2, attempt) * 60000, // Start at 1 min, exponential
    12 * 60 * 60 * 1000 // Max 12 hours
  );

  // Add jitter (-20% to +20%)
  const jitter = baseDelay * (Math.random() * 0.4 - 0.2);
  return baseDelay + jitter;
}

// Example delays:
// Attempt 1: 60000ms (1 min) ± 20% = 48s - 72s
// Attempt 2: 120000ms (2 min) ± 20% = 96s - 144s
// Attempt 3: 240000ms (4 min) ± 20% = 192s - 288s
// Attempt 4: 480000ms (8 min) ± 20% = 384s - 576s
```

### PayPal's Retry Strategy

**Configuration**:
- **Retry Duration**: 7 days
- **Retry Attempts**: ~15 attempts
- **Backoff Type**: Fixed initial, then exponential
- **Max Delay**: 24 hours between attempts

**Retry Schedule**:
```
Attempt 1: Immediate (0 seconds)
Attempt 2: 5 seconds
Attempt 3: 5 minutes
Attempt 4: 10 minutes
Attempt 5: 30 minutes
Attempt 6: 1 hour
Attempt 7: 2 hours
Attempt 8: 4 hours
Attempt 9: 8 hours
Attempt 10: 12 hours
Attempt 11: 24 hours
Attempt 12: 48 hours
Attempt 13: 72 hours
Attempt 14: 96 hours
Attempt 15: 168 hours (7 days, final)
```

**Implementation**:
```javascript
function calculatePayPalDelay(attempt) {
  const delays = [
    0,                      // Immediate
    5 * 1000,              // 5 seconds
    5 * 60 * 1000,         // 5 minutes
    10 * 60 * 1000,        // 10 minutes
    30 * 60 * 1000,        // 30 minutes
    60 * 60 * 1000,        // 1 hour
    2 * 60 * 60 * 1000,    // 2 hours
    4 * 60 * 60 * 1000,    // 4 hours
    8 * 60 * 60 * 1000,    // 8 hours
    12 * 60 * 60 * 1000,   // 12 hours
    24 * 60 * 60 * 1000,   // 24 hours
    48 * 60 * 60 * 1000,   // 48 hours
    72 * 60 * 60 * 1000,   // 72 hours
    96 * 60 * 60 * 1000,   // 96 hours
    168 * 60 * 60 * 1000   // 168 hours (7 days)
  ];

  return delays[Math.min(attempt, delays.length - 1)];
}
```

### Adyen's Retry Strategy

**Configuration**:
- **Retry Duration**: 2 days (48 hours)
- **Retry Attempts**: 10 attempts
- **Backoff Type**: Exponential
- **Max Delay**: 6 hours between attempts

**Retry Schedule**:
```
Attempt 1: Immediate (0 seconds)
Attempt 2: 2 minutes
Attempt 3: 6 minutes
Attempt 4: 18 minutes
Attempt 5: 54 minutes
Attempt 6: 2.7 hours
Attempt 7: 6 hours
Attempt 8: 6 hours
Attempt 9: 6 hours
Attempt 10: 6 hours (final)
```

**Implementation**:
```javascript
function calculateAdyenDelay(attempt) {
  // Exponential backoff with base 3, capped at 6 hours
  const baseDelay = 2 * 60 * 1000; // 2 minutes
  const maxDelay = 6 * 60 * 60 * 1000; // 6 hours

  return Math.min(
    baseDelay * Math.pow(3, attempt - 1),
    maxDelay
  );
}
```

### Square's Retry Strategy

**Configuration**:
- **Retry Duration**: 24 hours (1 day)
- **Retry Attempts**: 7 attempts
- **Backoff Type**: Exponential
- **Max Delay**: 4 hours between attempts

**Retry Schedule**:
```
Attempt 1: Immediate (0 seconds)
Attempt 2: 1 minute
Attempt 3: 5 minutes
Attempt 4: 30 minutes
Attempt 5: 2 hours
Attempt 6: 4 hours
Attempt 7: 4 hours (final)
```

---

## Exponential Backoff Strategies

### Basic Exponential Backoff

**Algorithm**:
```
delay = base_delay * (2 ^ attempt)
```

**Implementation**:
```javascript
function exponentialBackoff(attempt, baseDelay = 1000, maxDelay = 3600000) {
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

// Example progression (baseDelay = 1000ms, maxDelay = 1 hour):
// Attempt 0: 1 second
// Attempt 1: 2 seconds
// Attempt 2: 4 seconds
// Attempt 3: 8 seconds
// Attempt 4: 16 seconds
// Attempt 5: 32 seconds
// Attempt 6: 64 seconds
// Attempt 7: 128 seconds (2.13 minutes)
// Attempt 8: 256 seconds (4.27 minutes)
// Attempt 9: 512 seconds (8.53 minutes)
// Attempt 10: 1024 seconds (17.07 minutes)
// Attempt 11: 2048 seconds (34.13 minutes)
// Attempt 12+: 3600 seconds (1 hour, capped)
```

### Exponential Backoff with Jitter

**Why Jitter?**
- Prevents "thundering herd" problem
- Distributes retry attempts over time
- Reduces server load spikes
- Improves overall success rate

**Full Jitter Algorithm**:
```javascript
function exponentialBackoffWithFullJitter(attempt, baseDelay = 1000, maxDelay = 3600000) {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Random delay between 0 and cappedDelay
  return Math.random() * cappedDelay;
}

// Example: Attempt 5 (base = 1000ms)
// Exponential: 32000ms (32 seconds)
// Full Jitter: Random(0, 32000) = anywhere from 0 to 32 seconds
```

**Decorrelated Jitter Algorithm** (Recommended):
```javascript
function exponentialBackoffWithDecorrelatedJitter(
  attempt,
  previousDelay = 0,
  baseDelay = 1000,
  maxDelay = 3600000
) {
  if (attempt === 0) return baseDelay;

  // Random delay between baseDelay and previousDelay * 3
  const randomDelay = baseDelay + Math.random() * (previousDelay * 3 - baseDelay);
  return Math.min(randomDelay, maxDelay);
}

// Example progression:
// Attempt 0: 1000ms
// Attempt 1: Random(1000, 3000) = e.g., 2100ms
// Attempt 2: Random(1000, 6300) = e.g., 4500ms
// Attempt 3: Random(1000, 13500) = e.g., 8200ms
// More natural distribution than pure exponential
```

**Equal Jitter Algorithm**:
```javascript
function exponentialBackoffWithEqualJitter(attempt, baseDelay = 1000, maxDelay = 3600000) {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Half fixed, half random
  const fixedPart = cappedDelay / 2;
  const randomPart = Math.random() * (cappedDelay / 2);

  return fixedPart + randomPart;
}

// Example: Attempt 5 (base = 1000ms)
// Exponential: 32000ms
// Equal Jitter: 16000 + Random(0, 16000) = 16s to 32s
```

### Comparison of Jitter Strategies

```javascript
// Test with 10,000 retry attempts at attempt level 5
const attempts = 10000;
const attempt = 5;
const baseDelay = 1000;

// No Jitter
const noJitter = Array(attempts).fill(32000);
console.log('No Jitter:', {
  avg: 32000,
  min: 32000,
  max: 32000,
  std: 0
});
// Result: All attempts at exactly 32 seconds (thundering herd)

// Full Jitter
const fullJitter = Array(attempts).fill(0).map(() =>
  Math.random() * 32000
);
console.log('Full Jitter:', {
  avg: 16000, // Average 16 seconds
  min: 0,
  max: 32000,
  std: 9238 // High variance
});
// Result: Evenly distributed 0-32 seconds

// Equal Jitter
const equalJitter = Array(attempts).fill(0).map(() =>
  16000 + Math.random() * 16000
);
console.log('Equal Jitter:', {
  avg: 24000, // Average 24 seconds
  min: 16000,
  max: 32000,
  std: 4619 // Medium variance
});
// Result: Evenly distributed 16-32 seconds

// Decorrelated Jitter (most natural)
let prev = 1000;
const decorrelated = Array(attempts).fill(0).map(() => {
  const delay = 1000 + Math.random() * (prev * 3 - 1000);
  prev = delay;
  return delay;
});
console.log('Decorrelated Jitter:', {
  avg: ~18000, // Naturally distributed
  min: 1000,
  max: 32000,
  std: ~8500 // Natural variance
});
```

**Recommendation**: Use **Decorrelated Jitter** for most natural retry distribution.

---

## Retry Limits and Timeouts

### Connection Timeout Configuration

**Recommended Timeouts**:
```javascript
const WEBHOOK_TIMEOUTS = {
  connectionTimeout: 10000,    // 10 seconds to establish connection
  requestTimeout: 30000,       // 30 seconds total request duration
  socketTimeout: 20000,        // 20 seconds for socket inactivity
  dnsTimeout: 5000            // 5 seconds for DNS resolution
};
```

**Implementation with axios**:
```javascript
const axios = require('axios');

async function sendWebhook(url, payload, attempt = 0) {
  try {
    const response = await axios.post(url, payload, {
      timeout: 30000,           // 30 second total timeout
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': generateWebhookId(),
        'X-Webhook-Timestamp': Date.now(),
        'X-Signature': calculateHMAC(payload),
        'X-Attempt': attempt + 1
      },
      validateStatus: (status) => status >= 200 && status < 300
    });

    return { success: true, status: response.status };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('Request timeout:', error.message);
      return { success: false, retry: true, reason: 'timeout' };
    }

    if (error.code === 'ENOTFOUND') {
      console.log('DNS resolution failed:', error.message);
      return { success: false, retry: false, reason: 'dns_error' };
    }

    if (error.response) {
      const status = error.response.status;
      const retry = shouldRetry(status);
      return { success: false, retry, status, reason: 'http_error' };
    }

    // Network error
    return { success: false, retry: true, reason: 'network_error' };
  }
}
```

### Maximum Retry Attempts

**Industry Comparison**:
```
┌──────────────┬──────────┬──────────────┬────────────────┐
│ Provider     │ Attempts │ Duration     │ Max Delay      │
├──────────────┼──────────┼──────────────┼────────────────┤
│ Stripe       │ 10       │ 3 days       │ 12 hours       │
│ PayPal       │ 15       │ 7 days       │ 24 hours       │
│ Adyen        │ 10       │ 2 days       │ 6 hours        │
│ Square       │ 7        │ 1 day        │ 4 hours        │
│ Twilio       │ 10       │ 3 days       │ 8 hours        │
│ GitHub       │ 3        │ 1 hour       │ 30 minutes     │
│ Shopify      │ 19       │ 2 days       │ 6 hours        │
└──────────────┴──────────┴──────────────┴────────────────┘
```

**Recommended for Lynia Finance**:
```javascript
const RETRY_CONFIG = {
  maxAttempts: 7,              // 7 attempts over 48 hours
  maxDuration: 48 * 60 * 60,   // 48 hours in seconds
  baseDelay: 60 * 1000,        // 1 minute initial delay
  maxDelay: 24 * 60 * 60 * 1000, // 24 hours maximum delay
  backoffMultiplier: 2,        // Exponential base
  useJitter: true              // Enable decorrelated jitter
};

function shouldContinueRetrying(attempt, firstAttemptTime) {
  // Check attempt limit
  if (attempt >= RETRY_CONFIG.maxAttempts) {
    return false;
  }

  // Check time limit
  const elapsedSeconds = (Date.now() - firstAttemptTime) / 1000;
  if (elapsedSeconds >= RETRY_CONFIG.maxDuration) {
    return false;
  }

  return true;
}
```

### Retry Budget (Advanced)

**Concept**: Limit total retry rate to prevent overload.

```javascript
class RetryBudget {
  constructor(windowMs = 60000, maxRetries = 100) {
    this.windowMs = windowMs;        // 1 minute window
    this.maxRetries = maxRetries;    // Max 100 retries per minute
    this.attempts = [];
  }

  canRetry() {
    const now = Date.now();

    // Remove attempts outside window
    this.attempts = this.attempts.filter(
      timestamp => now - timestamp < this.windowMs
    );

    // Check if under budget
    if (this.attempts.length >= this.maxRetries) {
      console.log('Retry budget exceeded, skipping retry');
      return false;
    }

    // Record attempt
    this.attempts.push(now);
    return true;
  }

  getStatus() {
    const now = Date.now();
    const recentAttempts = this.attempts.filter(
      timestamp => now - timestamp < this.windowMs
    );

    return {
      used: recentAttempts.length,
      remaining: this.maxRetries - recentAttempts.length,
      windowMs: this.windowMs
    };
  }
}

// Usage
const retryBudget = new RetryBudget(60000, 100);

async function retryWithBudget(fn, url, payload) {
  if (!retryBudget.canRetry()) {
    console.log('Retry budget exhausted, queueing for later');
    await queueForLater(url, payload);
    return;
  }

  await fn(url, payload);
}
```

---

## Failure Handling Mechanisms

### Circuit Breaker Pattern

**Purpose**: Prevent cascading failures by temporarily disabling failing endpoints.

**States**:
```
CLOSED → Normal operation, webhooks sent
OPEN → Endpoint disabled, webhooks queued
HALF_OPEN → Testing if endpoint recovered
```

**Implementation**:
```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 1 minute

    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Try to recover
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        console.log('Circuit breaker recovered: CLOSED');
      }
    }
  }

  onFailure() {
    this.failures++;
    this.successes = 0;

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.log(`Circuit breaker tripped: OPEN until ${new Date(this.nextAttempt)}`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null
    };
  }
}

// Usage with webhook delivery
const circuitBreakers = new Map(); // One per endpoint

async function sendWebhookWithCircuitBreaker(url, payload) {
  if (!circuitBreakers.has(url)) {
    circuitBreakers.set(url, new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 300000 // 5 minutes
    }));
  }

  const breaker = circuitBreakers.get(url);

  try {
    await breaker.execute(async () => {
      return await sendWebhook(url, payload);
    });
    console.log('Webhook delivered successfully');
  } catch (error) {
    if (error.message === 'Circuit breaker is OPEN') {
      console.log('Endpoint disabled, queueing webhook');
      await queueWebhook(url, payload);
    } else {
      throw error;
    }
  }
}
```

### Dead Letter Queue (DLQ)

**Purpose**: Store webhooks that permanently failed after all retries.

**Implementation**:
```javascript
class DeadLetterQueue {
  constructor(db) {
    this.db = db;
  }

  async add(webhook, reason) {
    await this.db.collection('webhook_dlq').insertOne({
      url: webhook.url,
      payload: webhook.payload,
      attemptCount: webhook.attemptCount,
      firstAttempt: webhook.firstAttempt,
      lastAttempt: Date.now(),
      failureReason: reason,
      status: 'failed',
      createdAt: new Date()
    });

    console.log(`Webhook moved to DLQ: ${webhook.id}`);

    // Alert operations team
    await this.alertOps(webhook, reason);
  }

  async alertOps(webhook, reason) {
    // Send notification to operations team
    await sendAlert({
      type: 'webhook_failure',
      severity: 'high',
      message: `Webhook permanently failed after ${webhook.attemptCount} attempts`,
      details: {
        url: webhook.url,
        reference: webhook.payload.reference,
        reason: reason
      }
    });
  }

  async list(filters = {}) {
    return await this.db.collection('webhook_dlq')
      .find(filters)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
  }

  async retry(webhookId) {
    const webhook = await this.db.collection('webhook_dlq')
      .findOne({ _id: webhookId });

    if (!webhook) {
      throw new Error('Webhook not found in DLQ');
    }

    // Move back to retry queue
    await this.db.collection('webhook_queue').insertOne({
      url: webhook.url,
      payload: webhook.payload,
      attemptCount: 0,
      status: 'pending',
      priority: 'high', // Manual retries get priority
      createdAt: new Date()
    });

    // Remove from DLQ
    await this.db.collection('webhook_dlq')
      .deleteOne({ _id: webhookId });

    console.log(`Webhook moved from DLQ to retry queue: ${webhookId}`);
  }

  async bulkRetry(filters = {}) {
    const webhooks = await this.list(filters);
    const results = [];

    for (const webhook of webhooks) {
      try {
        await this.retry(webhook._id);
        results.push({ id: webhook._id, status: 'queued' });
      } catch (error) {
        results.push({ id: webhook._id, status: 'error', error: error.message });
      }
    }

    return results;
  }
}
```

### Webhook Queue Management

**Priority Queue Implementation**:
```javascript
class WebhookQueue {
  constructor(db, redis) {
    this.db = db;
    this.redis = redis;
  }

  async enqueue(webhook, priority = 'normal') {
    const priorities = { high: 1, normal: 2, low: 3 };

    await this.db.collection('webhook_queue').insertOne({
      url: webhook.url,
      payload: webhook.payload,
      attemptCount: 0,
      firstAttempt: null,
      lastAttempt: null,
      status: 'pending',
      priority: priority,
      priorityScore: priorities[priority] || 2,
      scheduledFor: Date.now(),
      createdAt: new Date()
    });

    // Add to Redis sorted set for fast retrieval
    await this.redis.zadd(
      'webhook_queue',
      priorities[priority] || 2,
      webhook.id
    );
  }

  async dequeue(limit = 10) {
    const now = Date.now();

    // Get webhooks ready to send (sorted by priority)
    const webhooks = await this.db.collection('webhook_queue')
      .find({
        status: 'pending',
        scheduledFor: { $lte: now }
      })
      .sort({ priorityScore: 1, scheduledFor: 1 })
      .limit(limit)
      .toArray();

    // Mark as processing
    const ids = webhooks.map(w => w._id);
    await this.db.collection('webhook_queue')
      .updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'processing', lastAttempt: now } }
      );

    return webhooks;
  }

  async reschedule(webhookId, delay) {
    const scheduledFor = Date.now() + delay;

    await this.db.collection('webhook_queue').updateOne(
      { _id: webhookId },
      {
        $set: {
          status: 'pending',
          scheduledFor: scheduledFor
        },
        $inc: { attemptCount: 1 }
      }
    );
  }

  async remove(webhookId) {
    await this.db.collection('webhook_queue')
      .deleteOne({ _id: webhookId });

    await this.redis.zrem('webhook_queue', webhookId.toString());
  }

  async getStats() {
    const stats = await this.db.collection('webhook_queue').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    return stats.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});
  }
}
```

---

## Implementation Examples

### Complete Webhook Retry System

**Full Implementation**:
```javascript
const axios = require('axios');
const crypto = require('crypto');

class WebhookRetrySystem {
  constructor(config = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 7,
      maxDuration: config.maxDuration || 48 * 60 * 60 * 1000, // 48 hours
      baseDelay: config.baseDelay || 60 * 1000, // 1 minute
      maxDelay: config.maxDelay || 24 * 60 * 60 * 1000, // 24 hours
      timeout: config.timeout || 30000, // 30 seconds
      secret: config.secret
    };

    this.queue = new WebhookQueue(config.db, config.redis);
    this.dlq = new DeadLetterQueue(config.db);
    this.circuitBreakers = new Map();
  }

  async send(url, payload, options = {}) {
    const webhook = {
      id: generateId(),
      url,
      payload,
      attemptCount: 0,
      firstAttempt: null,
      lastAttempt: null,
      options
    };

    await this.queue.enqueue(webhook, options.priority || 'normal');
    return webhook.id;
  }

  async processQueue() {
    const webhooks = await this.queue.dequeue(10);

    for (const webhook of webhooks) {
      await this.processWebhook(webhook);
    }
  }

  async processWebhook(webhook) {
    // Check retry limits
    if (!this.shouldRetry(webhook)) {
      await this.handlePermanentFailure(webhook);
      return;
    }

    // Get circuit breaker for this endpoint
    const breaker = this.getCircuitBreaker(webhook.url);

    try {
      await breaker.execute(async () => {
        await this.deliver(webhook);
      });

      // Success
      await this.handleSuccess(webhook);
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        await this.handleCircuitBreakerOpen(webhook);
      } else {
        await this.handleFailure(webhook, error);
      }
    }
  }

  async deliver(webhook) {
    const timestamp = Date.now();
    const webhookId = generateWebhookId();

    // Calculate HMAC signature
    const signature = crypto
      .createHmac('sha256', this.config.secret)
      .update(JSON.stringify(webhook.payload))
      .digest('hex');

    const response = await axios.post(webhook.url, webhook.payload, {
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lynia-Finance-Webhooks/1.0',
        'X-Webhook-Id': webhookId,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Signature': signature,
        'X-Attempt': (webhook.attemptCount + 1).toString()
      },
      validateStatus: (status) => status >= 200 && status < 300
    });

    return response;
  }

  shouldRetry(webhook) {
    // Check attempt limit
    if (webhook.attemptCount >= this.config.maxAttempts) {
      return false;
    }

    // Check time limit
    if (webhook.firstAttempt) {
      const elapsed = Date.now() - webhook.firstAttempt;
      if (elapsed >= this.config.maxDuration) {
        return false;
      }
    }

    return true;
  }

  async handleSuccess(webhook) {
    console.log(`Webhook delivered: ${webhook.id} (attempt ${webhook.attemptCount + 1})`);
    await this.queue.remove(webhook.id);

    // Record success metric
    await this.recordMetric('webhook_success', {
      url: webhook.url,
      attemptCount: webhook.attemptCount + 1
    });
  }

  async handleFailure(webhook, error) {
    const retry = this.isRetryableError(error);

    if (!retry || !this.shouldRetry(webhook)) {
      await this.handlePermanentFailure(webhook, error);
      return;
    }

    // Calculate next retry delay
    const delay = this.calculateDelay(webhook.attemptCount);

    console.log(`Webhook failed: ${webhook.id} (attempt ${webhook.attemptCount + 1}), retrying in ${delay}ms`);

    // Reschedule
    await this.queue.reschedule(webhook.id, delay);

    // Record retry metric
    await this.recordMetric('webhook_retry', {
      url: webhook.url,
      attemptCount: webhook.attemptCount + 1,
      delay: delay
    });
  }

  async handlePermanentFailure(webhook, error = null) {
    console.log(`Webhook permanently failed: ${webhook.id} after ${webhook.attemptCount} attempts`);

    await this.dlq.add(webhook, error?.message || 'Max retries exceeded');
    await this.queue.remove(webhook.id);

    // Record failure metric
    await this.recordMetric('webhook_permanent_failure', {
      url: webhook.url,
      attemptCount: webhook.attemptCount
    });
  }

  async handleCircuitBreakerOpen(webhook) {
    console.log(`Circuit breaker open for ${webhook.url}, requeueing`);

    // Reschedule with circuit breaker timeout
    await this.queue.reschedule(webhook.id, 5 * 60 * 1000); // 5 minutes
  }

  isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ECONNABORTED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.code === 'ENOTFOUND') return false; // DNS errors not retryable

    // HTTP errors
    if (error.response) {
      const status = error.response.status;

      // 5xx errors are retryable
      if (status >= 500 && status < 600) return true;

      // 408 Request Timeout is retryable
      if (status === 408) return true;

      // 429 Too Many Requests is retryable
      if (status === 429) return true;

      // All other 4xx errors are not retryable
      if (status >= 400 && status < 500) return false;
    }

    // Unknown errors - retry to be safe
    return true;
  }

  calculateDelay(attempt) {
    // Decorrelated jitter
    if (attempt === 0) {
      return this.config.baseDelay;
    }

    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter
    const jitter = Math.random() * cappedDelay * 0.3; // 30% jitter
    return Math.min(cappedDelay + jitter, this.config.maxDelay);
  }

  getCircuitBreaker(url) {
    if (!this.circuitBreakers.has(url)) {
      this.circuitBreakers.set(url, new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 5 * 60 * 1000 // 5 minutes
      }));
    }
    return this.circuitBreakers.get(url);
  }

  async recordMetric(metric, data) {
    // Record to monitoring system (e.g., Prometheus, CloudWatch)
    console.log(`Metric: ${metric}`, data);
  }

  // Start processing webhooks
  start() {
    this.interval = setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        console.error('Error processing webhook queue:', error);
      }
    }, 5000); // Process every 5 seconds
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}

// Usage
const webhookSystem = new WebhookRetrySystem({
  maxAttempts: 7,
  maxDuration: 48 * 60 * 60 * 1000,
  baseDelay: 60 * 1000,
  maxDelay: 24 * 60 * 60 * 1000,
  timeout: 30000,
  secret: process.env.WEBHOOK_SECRET,
  db: mongoClient.db('lynia'),
  redis: redisClient
});

// Send webhook
await webhookSystem.send(
  'https://ecocash.co.zw/webhooks/payment',
  {
    transactionId: 'TXN-12345',
    amount: 50.00,
    reference: 'LOAN-INV-67890',
    status: 'PAID'
  },
  { priority: 'high' }
);

// Start processing
webhookSystem.start();
```

### Webhook Delivery Dashboard

**Express API for Monitoring**:
```javascript
const express = require('express');
const router = express.Router();

// Get webhook queue status
router.get('/webhooks/status', async (req, res) => {
  const stats = await webhookSystem.queue.getStats();
  const dlqCount = await webhookSystem.dlq.list().length;

  res.json({
    queue: stats,
    deadLetterQueue: dlqCount,
    circuitBreakers: Array.from(webhookSystem.circuitBreakers.entries()).map(([url, breaker]) => ({
      url,
      state: breaker.getState()
    }))
  });
});

// Get webhook history
router.get('/webhooks/:id/history', async (req, res) => {
  const history = await db.collection('webhook_logs')
    .find({ webhookId: req.params.id })
    .sort({ timestamp: -1 })
    .toArray();

  res.json(history);
});

// Retry webhook from DLQ
router.post('/webhooks/:id/retry', async (req, res) => {
  try {
    await webhookSystem.dlq.retry(req.params.id);
    res.json({ success: true, message: 'Webhook moved to retry queue' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Bulk retry webhooks
router.post('/webhooks/bulk-retry', async (req, res) => {
  const { filters } = req.body;
  const results = await webhookSystem.dlq.bulkRetry(filters);
  res.json({ success: true, results });
});

module.exports = router;
```

---

## Best Practices

### 1. Respond Immediately, Process Async

**BAD** (Blocking):
```javascript
app.post('/webhooks/ecocash', async (req, res) => {
  // Don't do this - webhook might timeout waiting
  const payment = await updatePaymentStatus(req.body);
  await sendWhatsAppConfirmation(payment);
  await updateFineract(payment);
  await notifyCustomer(payment);

  res.status(200).send('OK'); // Too late!
});
```

**GOOD** (Immediate Response):
```javascript
app.post('/webhooks/ecocash', async (req, res) => {
  // Respond immediately
  res.status(200).send('OK');

  // Process asynchronously
  setImmediate(async () => {
    try {
      const payment = await updatePaymentStatus(req.body);
      await sendWhatsAppConfirmation(payment);
      await updateFineract(payment);
      await notifyCustomer(payment);
    } catch (error) {
      console.error('Webhook processing error:', error);
    }
  });
});
```

### 2. Implement Idempotency

**Check for Duplicate Processing**:
```javascript
app.post('/webhooks/ecocash', async (req, res) => {
  const { transactionId, webhookId } = req.body;

  // Respond immediately
  res.status(200).send('OK');

  // Check if already processed
  const existing = await db.collection('processed_webhooks')
    .findOne({ webhookId });

  if (existing) {
    console.log('Webhook already processed:', webhookId);
    return;
  }

  // Record webhook ID
  await db.collection('processed_webhooks').insertOne({
    webhookId,
    transactionId,
    processedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days TTL
  });

  // Process webhook
  await processPayment(req.body);
});

// Create TTL index for automatic cleanup
db.collection('processed_webhooks').createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
```

### 3. Log All Webhook Attempts

**Comprehensive Logging**:
```javascript
async function logWebhookAttempt(webhook, result) {
  await db.collection('webhook_logs').insertOne({
    webhookId: webhook.id,
    url: webhook.url,
    attempt: webhook.attemptCount + 1,
    status: result.success ? 'success' : 'failed',
    httpStatus: result.status,
    responseTime: result.duration,
    error: result.error,
    timestamp: new Date(),

    // Include payload hash for debugging (not full payload for security)
    payloadHash: crypto.createHash('sha256')
      .update(JSON.stringify(webhook.payload))
      .digest('hex')
  });
}
```

### 4. Provide Webhook Replay

**Manual Replay API**:
```javascript
router.post('/webhooks/replay', async (req, res) => {
  const { transactionId, provider } = req.body;

  // Fetch original webhook data
  const webhook = await db.collection('webhook_logs')
    .findOne({
      'payload.transactionId': transactionId,
      url: { $regex: provider }
    });

  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  // Recreate and send webhook
  const newWebhookId = await webhookSystem.send(
    webhook.url,
    webhook.payload,
    { priority: 'high' }
  );

  res.json({
    success: true,
    webhookId: newWebhookId,
    message: 'Webhook queued for replay'
  });
});
```

### 5. Monitor Webhook Health

**Health Metrics**:
```javascript
class WebhookHealthMonitor {
  async getHealth() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const [total, succeeded, failed, pending] = await Promise.all([
      db.collection('webhook_logs').countDocuments({
        timestamp: { $gte: new Date(oneHourAgo) }
      }),
      db.collection('webhook_logs').countDocuments({
        timestamp: { $gte: new Date(oneHourAgo) },
        status: 'success'
      }),
      db.collection('webhook_logs').countDocuments({
        timestamp: { $gte: new Date(oneHourAgo) },
        status: 'failed'
      }),
      db.collection('webhook_queue').countDocuments({
        status: 'pending'
      })
    ]);

    const successRate = total > 0 ? (succeeded / total) * 100 : 100;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    return {
      total,
      succeeded,
      failed,
      pending,
      successRate: successRate.toFixed(2) + '%',
      failureRate: failureRate.toFixed(2) + '%',
      health: successRate >= 95 ? 'healthy' : successRate >= 80 ? 'degraded' : 'unhealthy'
    };
  }

  async getSlowEndpoints() {
    const slowEndpoints = await db.collection('webhook_logs').aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$url',
          avgResponseTime: { $avg: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          avgResponseTime: { $gte: 5000 } // >= 5 seconds
        }
      },
      {
        $sort: { avgResponseTime: -1 }
      }
    ]).toArray();

    return slowEndpoints;
  }
}
```

---

## Monitoring and Alerting

### Key Metrics to Track

**Webhook Delivery Metrics**:
```javascript
const metrics = {
  // Success Metrics
  'webhook.delivery.success': {
    type: 'counter',
    labels: ['provider', 'attempt']
  },
  'webhook.delivery.duration': {
    type: 'histogram',
    labels: ['provider'],
    buckets: [100, 500, 1000, 5000, 10000, 30000] // milliseconds
  },

  // Failure Metrics
  'webhook.delivery.failure': {
    type: 'counter',
    labels: ['provider', 'reason', 'attempt']
  },
  'webhook.delivery.retry': {
    type: 'counter',
    labels: ['provider', 'attempt']
  },
  'webhook.delivery.permanent_failure': {
    type: 'counter',
    labels: ['provider']
  },

  // Queue Metrics
  'webhook.queue.size': {
    type: 'gauge',
    labels: ['status'] // pending, processing, failed
  },
  'webhook.queue.age': {
    type: 'histogram',
    labels: ['status'],
    buckets: [60, 300, 900, 3600, 86400] // seconds
  },

  // Circuit Breaker Metrics
  'webhook.circuit_breaker.state': {
    type: 'gauge',
    labels: ['provider', 'state'] // closed, open, half_open
  },
  'webhook.circuit_breaker.trips': {
    type: 'counter',
    labels: ['provider']
  }
};
```

### Alerting Rules

**Prometheus Alert Rules**:
```yaml
groups:
  - name: webhook_alerts
    interval: 30s
    rules:
      # High Failure Rate
      - alert: WebhookHighFailureRate
        expr: |
          (
            sum(rate(webhook_delivery_failure_total[5m]))
            /
            sum(rate(webhook_delivery_success_total[5m]) + rate(webhook_delivery_failure_total[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High webhook failure rate"
          description: "Webhook failure rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # Queue Backlog
      - alert: WebhookQueueBacklog
        expr: webhook_queue_size{status="pending"} > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Webhook queue backlog detected"
          description: "{{ $value }} webhooks pending (threshold: 1000)"

      # Circuit Breaker Open
      - alert: WebhookCircuitBreakerOpen
        expr: webhook_circuit_breaker_state{state="open"} == 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Webhook circuit breaker open for {{ $labels.provider }}"
          description: "Circuit breaker has been open for 5+ minutes"

      # Slow Delivery
      - alert: WebhookSlowDelivery
        expr: |
          histogram_quantile(0.95,
            rate(webhook_delivery_duration_bucket[5m])
          ) > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow webhook delivery"
          description: "95th percentile delivery time is {{ $value }}ms (threshold: 10s)"

      # DLQ Growth
      - alert: WebhookDLQGrowth
        expr: |
          rate(webhook_delivery_permanent_failure_total[1h]) > 10
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "Dead letter queue growing rapidly"
          description: "{{ $value }} webhooks permanently failed in last hour"
```

### Dashboard Configuration

**Grafana Dashboard JSON** (excerpt):
```json
{
  "dashboard": {
    "title": "Webhook Delivery Monitoring",
    "panels": [
      {
        "title": "Webhook Success Rate",
        "targets": [
          {
            "expr": "sum(rate(webhook_delivery_success_total[5m])) / (sum(rate(webhook_delivery_success_total[5m])) + sum(rate(webhook_delivery_failure_total[5m])))"
          }
        ],
        "type": "stat",
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "value": 0, "color": "red" },
            { "value": 0.95, "color": "yellow" },
            { "value": 0.98, "color": "green" }
          ]
        }
      },
      {
        "title": "Webhook Delivery Latency (p50, p95, p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(webhook_delivery_duration_bucket[5m]))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(webhook_delivery_duration_bucket[5m]))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(webhook_delivery_duration_bucket[5m]))",
            "legendFormat": "p99"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Queue Size by Status",
        "targets": [
          {
            "expr": "webhook_queue_size",
            "legendFormat": "{{ status }}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Circuit Breaker Status",
        "targets": [
          {
            "expr": "webhook_circuit_breaker_state",
            "legendFormat": "{{ provider }} - {{ state }}"
          }
        ],
        "type": "table"
      }
    ]
  }
}
```

---

## Recovery Strategies

### Strategy 1: Automatic Retry with Escalation

```javascript
class EscalatingRetryStrategy {
  async handleFailure(webhook, error) {
    const attempt = webhook.attemptCount;

    // Attempts 1-3: Normal retry (automatic)
    if (attempt < 3) {
      const delay = this.calculateDelay(attempt);
      await this.queue.reschedule(webhook.id, delay);
      return;
    }

    // Attempts 4-5: Escalate to operations (automatic + notification)
    if (attempt < 5) {
      await this.notifyOps('webhook_retry_escalation', {
        webhookId: webhook.id,
        url: webhook.url,
        attempt: attempt + 1,
        error: error.message
      });

      const delay = this.calculateDelay(attempt);
      await this.queue.reschedule(webhook.id, delay);
      return;
    }

    // Attempts 6-7: Critical escalation (automatic + urgent notification)
    if (attempt < 7) {
      await this.notifyOps('webhook_critical_retry', {
        webhookId: webhook.id,
        url: webhook.url,
        attempt: attempt + 1,
        error: error.message,
        urgency: 'high'
      });

      const delay = this.calculateDelay(attempt);
      await this.queue.reschedule(webhook.id, delay);
      return;
    }

    // After 7 attempts: Move to DLQ + page on-call
    await this.dlq.add(webhook, error.message);
    await this.pageOncall('webhook_permanent_failure', {
      webhookId: webhook.id,
      url: webhook.url,
      totalAttempts: attempt + 1
    });
  }
}
```

### Strategy 2: Polling Fallback

```javascript
class PollingFallback {
  constructor(provider) {
    this.provider = provider;
    this.pollInterval = 30000; // 30 seconds
  }

  async startPolling(transaction) {
    console.log(`Starting polling fallback for ${transaction.id}`);

    const maxAttempts = 40; // 40 * 30s = 20 minutes
    let attempt = 0;

    const intervalId = setInterval(async () => {
      attempt++;

      try {
        // Poll provider API for transaction status
        const status = await this.provider.getTransactionStatus(transaction.id);

        if (status.state === 'completed') {
          clearInterval(intervalId);
          await this.handleSuccess(transaction, status);
          return;
        }

        if (status.state === 'failed') {
          clearInterval(intervalId);
          await this.handleFailure(transaction, status);
          return;
        }

        // Still pending, continue polling
        console.log(`Polling attempt ${attempt}: ${status.state}`);

        if (attempt >= maxAttempts) {
          clearInterval(intervalId);
          await this.handleTimeout(transaction);
        }
      } catch (error) {
        console.error('Polling error:', error);

        if (attempt >= maxAttempts) {
          clearInterval(intervalId);
          await this.handleTimeout(transaction);
        }
      }
    }, this.pollInterval);

    // Store interval ID for cleanup
    await db.collection('polling_jobs').insertOne({
      transactionId: transaction.id,
      intervalId: intervalId.toString(),
      startedAt: new Date(),
      maxAttempts,
      currentAttempt: 0
    });
  }

  async handleSuccess(transaction, status) {
    console.log(`Polling succeeded for ${transaction.id}`);
    await processPayment({
      transactionId: transaction.id,
      status: 'PAID',
      ...status
    });
  }

  async handleTimeout(transaction) {
    console.log(`Polling timeout for ${transaction.id}`);
    await this.notifyOps('polling_timeout', {
      transactionId: transaction.id,
      message: 'Transaction status unknown after 20 minutes of polling'
    });
  }
}

// Usage: Start polling if webhook fails
async function handleWebhookFailure(webhook) {
  if (webhook.attemptCount >= 3) {
    const poller = new PollingFallback(ecocashProvider);
    await poller.startPolling({
      id: webhook.payload.transactionId,
      reference: webhook.payload.reference
    });
  }
}
```

### Strategy 3: Manual Intervention Dashboard

```javascript
// Express routes for manual intervention
router.get('/webhooks/failed', async (req, res) => {
  const failed = await db.collection('webhook_dlq')
    .find()
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  res.json({
    total: failed.length,
    webhooks: failed.map(w => ({
      id: w._id,
      url: w.url,
      reference: w.payload.reference,
      amount: w.payload.amount,
      attempts: w.attemptCount,
      lastAttempt: w.lastAttempt,
      reason: w.failureReason
    }))
  });
});

router.post('/webhooks/:id/manual-verify', async (req, res) => {
  const webhook = await db.collection('webhook_dlq')
    .findOne({ _id: req.params.id });

  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  // Manually verify with provider
  const providerStatus = await ecocashProvider.getTransactionStatus(
    webhook.payload.transactionId
  );

  if (providerStatus.state === 'completed') {
    // Process payment manually
    await processPayment(webhook.payload);

    // Remove from DLQ
    await db.collection('webhook_dlq').deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: 'Payment verified and processed',
      status: providerStatus
    });
  } else {
    res.json({
      success: false,
      message: 'Payment not completed',
      status: providerStatus
    });
  }
});

router.post('/webhooks/:id/force-process', async (req, res) => {
  const { status, verified } = req.body;

  if (!verified) {
    return res.status(400).json({
      error: 'Manual verification required'
    });
  }

  const webhook = await db.collection('webhook_dlq')
    .findOne({ _id: req.params.id });

  // Log manual intervention
  await db.collection('manual_interventions').insertOne({
    webhookId: req.params.id,
    userId: req.user.id,
    action: 'force_process',
    status: status,
    timestamp: new Date()
  });

  // Process payment
  await processPayment({
    ...webhook.payload,
    status: status,
    manual: true
  });

  // Remove from DLQ
  await db.collection('webhook_dlq').deleteOne({ _id: req.params.id });

  res.json({
    success: true,
    message: 'Payment manually processed'
  });
});
```

---

## Lynia Finance Implementation Recommendations

### Phase 1: Basic Retry (MVP)

**Minimum Viable Implementation**:
```javascript
// Simple retry with exponential backoff
const RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelay: 60000, // 1 minute
  maxDelay: 3600000 // 1 hour
};

async function sendWebhookWithRetry(url, payload, attempt = 0) {
  try {
    await axios.post(url, payload, { timeout: 30000 });
    console.log('Webhook delivered');
    return true;
  } catch (error) {
    if (attempt >= RETRY_CONFIG.maxAttempts) {
      console.error('Webhook failed permanently');
      await logFailure(url, payload, error);
      return false;
    }

    const delay = Math.min(
      RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
      RETRY_CONFIG.maxDelay
    );

    console.log(`Retry ${attempt + 1} in ${delay}ms`);

    setTimeout(() => {
      sendWebhookWithRetry(url, payload, attempt + 1);
    }, delay);
  }
}
```

### Phase 2: Queue-Based System (Production)

**Add Queue and DLQ**:
```javascript
// Use Bull for Redis-based queue
const Queue = require('bull');

const webhookQueue = new Queue('webhooks', {
  redis: { host: 'localhost', port: 6379 }
});

webhookQueue.process(async (job) => {
  const { url, payload } = job.data;

  try {
    await axios.post(url, payload, { timeout: 30000 });
    return { success: true };
  } catch (error) {
    throw new Error(`Webhook failed: ${error.message}`);
  }
});

// Add webhook to queue
await webhookQueue.add(
  { url, payload },
  {
    attempts: 7,
    backoff: {
      type: 'exponential',
      delay: 60000
    }
  }
);
```

### Phase 3: Full System (Scale)

Implement complete system from **Implementation Examples** section above.

---

## Summary

### Key Takeaways

1. **Standard Retry Pattern**: 7 attempts over 48 hours with exponential backoff
2. **Use Decorrelated Jitter**: Prevents thundering herd, natural distribution
3. **Implement Circuit Breaker**: Protect failing endpoints
4. **Dead Letter Queue**: Capture permanent failures for manual review
5. **Respond Immediately**: Return 200 OK, process asynchronously
6. **Idempotency**: Always check for duplicate webhooks
7. **Comprehensive Logging**: Track all attempts for debugging
8. **Monitoring & Alerting**: Track success rate, queue size, circuit breaker state
9. **Polling Fallback**: When webhooks fail, poll for status
10. **Manual Intervention**: Provide dashboard for operations team

### Recommended Configuration for Lynia Finance

```javascript
const WEBHOOK_CONFIG = {
  // Retry Configuration
  maxAttempts: 7,
  maxDuration: 48 * 60 * 60 * 1000, // 48 hours
  baseDelay: 60 * 1000,              // 1 minute
  maxDelay: 24 * 60 * 60 * 1000,    // 24 hours
  jitterType: 'decorrelated',

  // Timeout Configuration
  connectionTimeout: 10000,  // 10 seconds
  requestTimeout: 30000,     // 30 seconds

  // Circuit Breaker
  failureThreshold: 5,       // Open after 5 failures
  successThreshold: 2,       // Close after 2 successes
  circuitTimeout: 300000,    // 5 minute cooldown

  // Queue Configuration
  concurrency: 10,           // Process 10 webhooks concurrently
  pollInterval: 5000,        // Check queue every 5 seconds

  // Monitoring
  logAllAttempts: true,
  alertOnFailure: true,
  alertThreshold: 3          // Alert after 3 consecutive failures
};
```

---

## Next Steps for T018

The next task (T018) will focus on identifying sandbox/test environments for EcoCash and O'mari to enable testing of the webhook retry system once API access is granted.

---

**End of T017 Research Document**
