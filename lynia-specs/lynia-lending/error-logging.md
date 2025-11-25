# Lynia Finance - Error Handling & Logging Strategy

**Document:** P1-T005 Deliverable
**Version:** 1.0
**Date:** November 24, 2025
**Status:** Phase 1 - Error & Logging Design

---

## Table of Contents

1. [Overview](#overview)
2. [Error Code Taxonomy](#error-code-taxonomy)
3. [Error Response Format](#error-response-format)
4. [Logging Strategy](#logging-strategy)
5. [CloudWatch Logs Organization](#cloudwatch-logs-organization)
6. [Error Monitoring & Alerting](#error-monitoring--alerting)
7. [Incident Response Procedures](#incident-response-procedures)
8. [Best Practices](#best-practices)

---

## Overview

### Logging Principles

1. **Structured Logging**: JSON format for easy parsing
2. **Contextual Information**: Request ID, user ID, timestamps
3. **Appropriate Level**: DEBUG, INFO, WARN, ERROR, CRITICAL
4. **No PII in Logs**: Mask sensitive data (phone, National ID)
5. **Centralized**: All logs to CloudWatch Logs

### Error Handling Principles

1. **User-Friendly Messages**: Clear, actionable error messages
2. **Detailed Logs**: Full error context for debugging
3. **Fail Gracefully**: Never expose internal errors to users
4. **Retry-able Errors**: Mark errors that can be retried
5. **Alert Critical Errors**: Notify team of critical failures

---

## Error Code Taxonomy

### Error Categories

```
ERROR_CODES
│
├── 4xx Client Errors
│   ├── 400 Bad Request
│   │   ├── VALIDATION_ERROR
│   │   ├── INVALID_INPUT
│   │   └── MALFORMED_REQUEST
│   │
│   ├── 401 Unauthorized
│   │   ├── AUTHENTICATION_FAILED
│   │   ├── UNAUTHORIZED
│   │   ├── TOKEN_EXPIRED
│   │   └── INVALID_CREDENTIALS
│   │
│   ├── 403 Forbidden
│   │   ├── FORBIDDEN
│   │   ├── INSUFFICIENT_PERMISSIONS
│   │   └── ACCESS_DENIED
│   │
│   ├── 404 Not Found
│   │   ├── RESOURCE_NOT_FOUND
│   │   ├── CUSTOMER_NOT_FOUND
│   │   ├── LOAN_NOT_FOUND
│   │   └── DEVICE_NOT_FOUND
│   │
│   ├── 409 Conflict
│   │   ├── DUPLICATE_RESOURCE
│   │   ├── CUSTOMER_ALREADY_EXISTS
│   │   ├── LOAN_ALREADY_EXISTS
│   │   └── ACTIVE_LOAN_EXISTS
│   │
│   ├── 422 Unprocessable Entity
│   │   ├── KYC_VERIFICATION_FAILED
│   │   ├── INSUFFICIENT_CREDIT_LIMIT
│   │   ├── PAYMENT_FAILED
│   │   ├── DEVICE_UNAVAILABLE
│   │   └── LOAN_NOT_ELIGIBLE
│   │
│   └── 429 Too Many Requests
│       └── RATE_LIMIT_EXCEEDED
│
└── 5xx Server Errors
    ├── 500 Internal Server Error
    │   ├── INTERNAL_SERVER_ERROR
    │   ├── DATABASE_ERROR
    │   ├── FINERACT_ERROR
    │   └── EXTERNAL_SERVICE_ERROR
    │
    ├── 502 Bad Gateway
    │   ├── GATEWAY_ERROR
    │   ├── UPSTREAM_SERVICE_ERROR
    │   └── SMILE_IDENTITY_ERROR
    │
    ├── 503 Service Unavailable
    │   ├── SERVICE_UNAVAILABLE
    │   ├── MAINTENANCE_MODE
    │   └── DATABASE_UNAVAILABLE
    │
    └── 504 Gateway Timeout
        ├── GATEWAY_TIMEOUT
        ├── EXTERNAL_SERVICE_TIMEOUT
        └── FINERACT_TIMEOUT
```

### Complete Error Code List

| Code | HTTP | Category | Severity | User Message | Retry-able |
|------|------|----------|----------|--------------|------------|
| **VALIDATION_ERROR** | 400 | Client | Low | "Please check your input and try again" | ✅ Yes |
| **INVALID_INPUT** | 400 | Client | Low | "Invalid data provided" | ✅ Yes |
| **MALFORMED_REQUEST** | 400 | Client | Low | "Request format is incorrect" | ❌ No |
| **AUTHENTICATION_FAILED** | 401 | Auth | Medium | "Invalid credentials" | ✅ Yes |
| **UNAUTHORIZED** | 401 | Auth | Medium | "Please log in to continue" | ❌ No |
| **TOKEN_EXPIRED** | 401 | Auth | Medium | "Your session has expired. Please log in again" | ❌ No |
| **INVALID_CREDENTIALS** | 401 | Auth | Medium | "Email or password is incorrect" | ✅ Yes |
| **FORBIDDEN** | 403 | Auth | Medium | "You don't have permission to perform this action" | ❌ No |
| **INSUFFICIENT_PERMISSIONS** | 403 | Auth | Medium | "Insufficient permissions" | ❌ No |
| **ACCESS_DENIED** | 403 | Auth | Medium | "Access denied" | ❌ No |
| **RESOURCE_NOT_FOUND** | 404 | Client | Low | "Resource not found" | ❌ No |
| **CUSTOMER_NOT_FOUND** | 404 | Business | Low | "Customer not found" | ❌ No |
| **LOAN_NOT_FOUND** | 404 | Business | Low | "Loan not found" | ❌ No |
| **DEVICE_NOT_FOUND** | 404 | Business | Low | "Device not found" | ❌ No |
| **DUPLICATE_RESOURCE** | 409 | Business | Low | "This resource already exists" | ❌ No |
| **CUSTOMER_ALREADY_EXISTS** | 409 | Business | Low | "A customer with this phone number already exists" | ❌ No |
| **LOAN_ALREADY_EXISTS** | 409 | Business | Low | "You already have an active loan" | ❌ No |
| **ACTIVE_LOAN_EXISTS** | 409 | Business | Medium | "Please complete your current loan before applying for a new one" | ❌ No |
| **KYC_VERIFICATION_FAILED** | 422 | Business | High | "Identity verification failed. Please try again with a clear photo" | ✅ Yes |
| **INSUFFICIENT_CREDIT_LIMIT** | 422 | Business | Medium | "Credit limit insufficient for this loan amount" | ❌ No |
| **PAYMENT_FAILED** | 422 | Payment | High | "Payment processing failed. Please try again" | ✅ Yes |
| **DEVICE_UNAVAILABLE** | 422 | Business | Medium | "This device is currently unavailable" | ❌ No |
| **LOAN_NOT_ELIGIBLE** | 422 | Business | Medium | "You are not eligible for this loan at this time" | ❌ No |
| **RATE_LIMIT_EXCEEDED** | 429 | System | Medium | "Too many requests. Please try again in a few minutes" | ✅ Yes |
| **INTERNAL_SERVER_ERROR** | 500 | System | Critical | "Something went wrong. Please try again later" | ✅ Yes |
| **DATABASE_ERROR** | 500 | System | Critical | "Database error. Please contact support" | ✅ Yes |
| **FINERACT_ERROR** | 500 | System | Critical | "Loan system error. Please contact support" | ✅ Yes |
| **EXTERNAL_SERVICE_ERROR** | 502 | System | High | "External service error. Please try again" | ✅ Yes |
| **SMILE_IDENTITY_ERROR** | 502 | System | High | "KYC verification service unavailable" | ✅ Yes |
| **SERVICE_UNAVAILABLE** | 503 | System | High | "Service temporarily unavailable. Please try again later" | ✅ Yes |
| **MAINTENANCE_MODE** | 503 | System | High | "System maintenance in progress. We'll be back soon" | ✅ Yes |
| **GATEWAY_TIMEOUT** | 504 | System | High | "Request timed out. Please try again" | ✅ Yes |

---

## Error Response Format

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "KYC_VERIFICATION_FAILED",
    "message": "Identity verification failed. Please try again with a clear photo",
    "details": {
      "field": "selfie",
      "reason": "Image quality too low",
      "confidence_score": 45.2,
      "minimum_required": 80.0
    },
    "retry_able": true,
    "retry_after": 60,
    "help_url": "https://help.lyniafinance.com/kyc-verification"
  },
  "meta": {
    "request_id": "req_abc123xyz",
    "timestamp": "2025-11-24T12:00:00Z",
    "path": "/v1/kyc/submit",
    "method": "POST"
  }
}
```

### Error Response Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | ✅ | Always `false` for errors |
| `error.code` | string | ✅ | Error code from taxonomy |
| `error.message` | string | ✅ | User-friendly error message |
| `error.details` | object | ❌ | Additional error details |
| `error.retry_able` | boolean | ❌ | Whether error can be retried |
| `error.retry_after` | integer | ❌ | Seconds to wait before retry |
| `error.help_url` | string | ❌ | Link to help documentation |
| `meta.request_id` | string | ✅ | Unique request identifier |
| `meta.timestamp` | string | ✅ | ISO 8601 timestamp |
| `meta.path` | string | ✅ | API endpoint path |
| `meta.method` | string | ✅ | HTTP method |

### Error Examples

#### Validation Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phone number format",
    "details": {
      "field": "phone_number",
      "value": "0771234567",
      "expected": "+263771234567",
      "pattern": "^\\+263[0-9]{9}$"
    },
    "retry_able": true
  },
  "meta": {
    "request_id": "req_xyz789",
    "timestamp": "2025-11-24T12:00:00Z"
  }
}
```

#### Authentication Error

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired. Please log in again",
    "details": {
      "expired_at": "2025-11-24T11:00:00Z",
      "current_time": "2025-11-24T12:00:00Z"
    },
    "retry_able": false,
    "help_url": "https://help.lyniafinance.com/session-expired"
  },
  "meta": {
    "request_id": "req_session123",
    "timestamp": "2025-11-24T12:00:00Z"
  }
}
```

#### Rate Limit Error

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 60 seconds",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2025-11-24T12:01:00Z"
    },
    "retry_able": true,
    "retry_after": 60
  },
  "meta": {
    "request_id": "req_rate123",
    "timestamp": "2025-11-24T12:00:00Z"
  }
}
```

---

## Logging Strategy

### Log Levels

| Level | Use Case | Example | Retention |
|-------|----------|---------|-----------|
| **DEBUG** | Development debugging | "Fetching customer from database with ID: xyz" | 7 days |
| **INFO** | General information | "Customer logged in successfully" | 30 days |
| **WARN** | Warning conditions | "Credit score below threshold but approved manually" | 90 days |
| **ERROR** | Error conditions | "Payment gateway returned error: timeout" | 1 year |
| **CRITICAL** | Critical failures | "Database connection lost" | 7 years |

### Structured Log Format

```json
{
  "timestamp": "2025-11-24T12:00:00.123Z",
  "level": "ERROR",
  "service": "payment-service",
  "request_id": "req_abc123xyz",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone_number": "+263771***567",
  "action": "process_payment",
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "EcoCash payment gateway timeout",
    "stack": "Error: Timeout...",
    "details": {
      "gateway": "ecocash",
      "reference": "PAY-ABC123",
      "amount": 70.31
    }
  },
  "context": {
    "loan_id": "loan-uuid",
    "payment_method": "ecocash",
    "attempt": 1,
    "max_retries": 3
  },
  "duration_ms": 5234,
  "ip_address": "1.2.3.4",
  "user_agent": "WhatsApp/2.23.20.0",
  "environment": "production",
  "version": "1.0.0"
}
```

### PII Masking

Always mask sensitive data in logs:

```javascript
function maskPII(data) {
  return {
    ...data,
    // Phone: +263771234567 → +263771***567
    phone_number: data.phone_number?.replace(/(\+\d{3}\d{3})(\d{4})(\d{3})/, '$1***$3'),

    // National ID: 63-123456-A-12 → 63-***456-A-**
    national_id: data.national_id?.replace(/(\d{2}-)(\d{3})(\d{3})(-.{1}-)(\d{2})/, '$1***$3$4**'),

    // Email: john.doe@example.com → j***e@example.com
    email: data.email?.replace(/(.{1})[^@]*(.{1})(@.*)/, '$1***$2$3'),

    // Never log passwords, tokens, or API keys
    password: undefined,
    access_token: data.access_token ? '[REDACTED]' : undefined,
    api_key: data.api_key ? '[REDACTED]' : undefined
  };
}
```

### Log Examples

#### INFO: Customer Login

```json
{
  "timestamp": "2025-11-24T12:00:00.123Z",
  "level": "INFO",
  "service": "whatsapp-bot",
  "request_id": "req_login123",
  "user_id": "user-uuid",
  "customer_id": "customer-uuid",
  "phone_number": "+263771***567",
  "action": "customer_login",
  "message": "Customer logged in successfully",
  "context": {
    "method": "otp",
    "session_id": "session-uuid"
  },
  "ip_address": "1.2.3.4"
}
```

#### WARN: Manual Credit Override

```json
{
  "timestamp": "2025-11-24T12:00:00.123Z",
  "level": "WARN",
  "service": "credit-scoring",
  "request_id": "req_score123",
  "admin_user_id": "admin-uuid",
  "customer_id": "customer-uuid",
  "action": "credit_limit_override",
  "message": "Credit limit manually increased by admin",
  "context": {
    "old_limit": 200,
    "new_limit": 500,
    "credit_score": 650,
    "reason": "Excellent repayment history",
    "approved_by": "admin@lyniafinance.com"
  }
}
```

#### ERROR: Payment Gateway Failure

```json
{
  "timestamp": "2025-11-24T12:00:00.123Z",
  "level": "ERROR",
  "service": "payment-service",
  "request_id": "req_pay123",
  "customer_id": "customer-uuid",
  "action": "process_payment",
  "error": {
    "code": "PAYMENT_FAILED",
    "message": "EcoCash gateway timeout after 5 seconds",
    "stack": "Error: Gateway timeout\n  at paymentGateway.js:45\n...",
    "details": {
      "gateway": "ecocash",
      "reference": "PAY-ABC123",
      "amount": 70.31,
      "timeout_ms": 5000
    }
  },
  "context": {
    "loan_id": "loan-uuid",
    "payment_method": "ecocash",
    "phone_number": "+263771***567",
    "attempt": 1,
    "max_retries": 3,
    "will_retry": true,
    "retry_in_seconds": 60
  },
  "duration_ms": 5234
}
```

#### CRITICAL: Database Connection Lost

```json
{
  "timestamp": "2025-11-24T12:00:00.123Z",
  "level": "CRITICAL",
  "service": "all-services",
  "action": "database_connection_lost",
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Supabase connection lost",
    "stack": "Error: Connection refused\n  at supabase.js:123\n..."
  },
  "context": {
    "database": "supabase",
    "host": "your-project.supabase.co",
    "connection_pool_size": 0,
    "attempted_reconnects": 3
  },
  "alert": {
    "sent": true,
    "channels": ["slack", "pagerduty", "email"],
    "severity": "P1"
  }
}
```

---

## CloudWatch Logs Organization

### Log Groups

```
/aws/lambda/lynia-finance/
│
├── /whatsapp-bot-service
│   ├── application.log
│   ├── error.log
│   └── audit.log
│
├── /kyc-service
│   ├── application.log
│   ├── error.log
│   └── smile-identity.log
│
├── /credit-scoring-service
│   ├── application.log
│   ├── error.log
│   └── model-inference.log
│
├── /payment-service
│   ├── application.log
│   ├── error.log
│   ├── ecocash-gateway.log
│   └── paynow-gateway.log
│
├── /device-lock-service
│   ├── application.log
│   ├── error.log
│   └── lock-provider.log
│
├── /notification-service
│   ├── application.log
│   ├── error.log
│   └── delivery.log
│
├── /inventory-service
│   ├── application.log
│   └── error.log
│
└── /admin-api
    ├── application.log
    ├── error.log
    └── admin-actions.log
```

### Log Stream Naming

```
Format: {service-name}/{environment}/{instance-id}/{log-type}

Examples:
- whatsapp-bot/production/i-0123456789abcdef0/application
- payment-service/staging/i-0987654321fedcba0/error
- kyc-service/production/i-0123456789abcdef0/audit
```

### Log Retention

| Log Type | Retention | Reason |
|----------|-----------|--------|
| Application Logs | 30 days | General troubleshooting |
| Error Logs | 1 year | Compliance, trend analysis |
| Audit Logs | 7 years | Regulatory compliance (financial) |
| Payment Logs | 7 years | Financial compliance |
| KYC Logs | 7 years | Regulatory compliance |
| Debug Logs | 7 days | Development only |

### CloudWatch Insights Queries

#### 1. Top Errors in Last Hour

```sql
fields @timestamp, error.code, error.message, service
| filter level = "ERROR"
| filter @timestamp > ago(1h)
| stats count() as error_count by error.code
| sort error_count desc
| limit 20
```

#### 2. Failed Payments by Gateway

```sql
fields @timestamp, context.gateway, error.message, context.amount
| filter service = "payment-service"
| filter error.code = "PAYMENT_FAILED"
| filter @timestamp > ago(24h)
| stats count() as failures, sum(context.amount) as total_failed_amount by context.gateway
| sort failures desc
```

#### 3. Slow API Responses (>2 seconds)

```sql
fields @timestamp, action, duration_ms, request_id
| filter duration_ms > 2000
| filter @timestamp > ago(1h)
| stats avg(duration_ms) as avg_duration, max(duration_ms) as max_duration, count() as slow_requests by action
| sort slow_requests desc
```

#### 4. Customer Journey (by phone number)

```sql
fields @timestamp, level, action, message, phone_number
| filter phone_number = "+263771***567"
| filter @timestamp > ago(7d)
| sort @timestamp asc
| limit 100
```

#### 5. Critical Errors

```sql
fields @timestamp, service, error.code, error.message, alert.sent
| filter level = "CRITICAL"
| filter @timestamp > ago(24h)
| sort @timestamp desc
```

---

## Error Monitoring & Alerting

### Alerting Thresholds

| Metric | Threshold | Severity | Alert Channels |
|--------|-----------|----------|----------------|
| **Error Rate** | >5% of requests | P2 | Slack |
| **Error Rate** | >10% of requests | P1 | Slack, Email, PagerDuty |
| **Critical Errors** | Any occurrence | P1 | Slack, Email, PagerDuty |
| **Payment Failures** | >10 in 1 hour | P2 | Slack, Email |
| **KYC Failures** | >20 in 1 hour | P2 | Slack |
| **Database Errors** | Any occurrence | P1 | Slack, Email, PagerDuty |
| **API Latency** | >2s (p95) | P2 | Slack |
| **API Latency** | >5s (p95) | P1 | Slack, Email |
| **Lambda Timeouts** | >5 in 5 min | P2 | Slack |

### CloudWatch Alarms

#### 1. High Error Rate

```yaml
AlarmName: lynia-finance-high-error-rate
MetricName: Errors
Namespace: AWS/Lambda
Threshold: 10  # errors per minute
ComparisonOperator: GreaterThanThreshold
EvaluationPeriods: 2
DatapointsToAlarm: 2
Period: 60  # seconds
Statistic: Sum
TreatMissingData: notBreaching
AlarmActions:
  - arn:aws:sns:us-east-1:123456789012:critical-alerts
```

#### 2. Database Connection Errors

```yaml
AlarmName: lynia-finance-database-errors
FilterPattern: '{ $.error.code = "DATABASE_ERROR" || $.error.code = "DATABASE_UNAVAILABLE" }'
MetricValue: 1
Threshold: 1  # Any database error triggers alarm
ComparisonOperator: GreaterThanOrEqualToThreshold
EvaluationPeriods: 1
AlarmActions:
  - arn:aws:sns:us-east-1:123456789012:critical-alerts
```

#### 3. Payment Gateway Failures

```yaml
AlarmName: lynia-finance-payment-failures
FilterPattern: '{ $.service = "payment-service" && $.error.code = "PAYMENT_FAILED" }'
MetricValue: 1
Threshold: 10  # 10 failures in 1 hour
ComparisonOperator: GreaterThanThreshold
EvaluationPeriods: 1
Period: 3600  # 1 hour
AlarmActions:
  - arn:aws:sns:us-east-1:123456789012:payment-alerts
```

### Alert Channels

```
Critical Alerts (P1)
├── Slack: #lynia-alerts-critical
├── Email: oncall@lyniafinance.com
└── PagerDuty: Lynia Finance On-Call

High Priority (P2)
├── Slack: #lynia-alerts
└── Email: team@lyniafinance.com

Medium Priority (P3)
└── Slack: #lynia-monitoring

Low Priority (P4)
└── Daily digest email
```

### Slack Alert Format

```
🚨 CRITICAL ALERT - Database Connection Lost

Service: All Services
Error Code: DATABASE_UNAVAILABLE
Time: 2025-11-24 12:00:00 UTC
Duration: Ongoing

Details:
- Supabase connection lost
- Connection pool size: 0
- Attempted reconnects: 3 failed

Impact:
- All API endpoints returning 503
- Estimated affected users: 1,250+

Actions Taken:
- Automatic reconnect in progress
- Maintenance page displayed
- On-call engineer paged

View Logs: https://console.aws.amazon.com/cloudwatch/...
Incident: INC-2025-001

[Acknowledge] [View Runbook] [Escalate]
```

---

## Incident Response Procedures

### Incident Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| **P1 - Critical** | Complete service outage, data loss | <15 min | Immediate |
| **P2 - High** | Major feature broken, >10% users affected | <1 hour | If not resolved in 2h |
| **P3 - Medium** | Minor feature broken, <10% users affected | <4 hours | If not resolved in 8h |
| **P4 - Low** | Cosmetic issue, no user impact | <24 hours | None |

### Incident Response Workflow

```
Incident Detected
    │
    ├─ Automated Alert
    │   ├─ CloudWatch Alarm triggered
    │   ├─ Alert sent to channels
    │   └─ PagerDuty notification
    │
    ▼
Acknowledge (< Target Response Time)
    │
    ├─ On-call engineer acknowledges
    ├─ Initial triage
    └─ Severity assessment
    │
    ▼
Investigate
    │
    ├─ Check CloudWatch Logs
    ├─ Review metrics/dashboards
    ├─ Identify root cause
    └─ Document findings
    │
    ▼
Mitigate
    │
    ├─ Apply immediate fix
    ├─ OR: Enable maintenance mode
    ├─ OR: Rollback deployment
    └─ Communicate status
    │
    ▼
Resolve
    │
    ├─ Verify fix deployed
    ├─ Monitor for recurrence
    ├─ Update stakeholders
    └─ Close incident
    │
    ▼
Post-Mortem (for P1/P2)
    │
    ├─ Root cause analysis
    ├─ Timeline documentation
    ├─ Action items
    └─ Preventive measures
```

### Example Incident Runbooks

#### Runbook 1: Database Connection Lost

```markdown
# Runbook: Database Connection Lost

## Severity: P1 - Critical

## Detection:
- CloudWatch Alarm: database-connection-errors
- All services returning DATABASE_UNAVAILABLE

## Immediate Actions:
1. Check Supabase status page: https://status.supabase.com
2. Verify AWS VPC/security groups
3. Check connection pool exhaustion

## Mitigation Steps:
1. Increase connection pool size (if exhaustion)
2. Restart Lambda functions (if stale connections)
3. Failover to read replica (if primary down)
4. Enable maintenance mode (if extended outage)

## Communication:
- Update status page
- Notify customers via WhatsApp/SMS
- Post in #general Slack channel

## Escalation:
- If not resolved in 15 min → Escalate to CTO
- If data loss risk → Escalate to CEO
```

#### Runbook 2: Payment Gateway Failure

```markdown
# Runbook: Payment Gateway Failure

## Severity: P2 - High

## Detection:
- CloudWatch Alarm: payment-failures
- >10 PAYMENT_FAILED errors in 1 hour

## Immediate Actions:
1. Identify affected gateway (EcoCash/Paynow)
2. Check gateway status page
3. Review gateway API logs

## Mitigation Steps:
1. Enable fallback gateway (if available)
2. Increase retry attempts
3. Queue failed payments for manual processing
4. Contact gateway support

## Communication:
- Notify customers of payment issues
- Update admin dashboard with status
- Post in #payments Slack channel

## Escalation:
- If >100 failures → Escalate to Finance Lead
- If gateway down >4 hours → Escalate to CTO
```

---

## Best Practices

### 1. Error Handling in Code

```javascript
// Good: Comprehensive error handling
async function processPayment(paymentData) {
  const requestId = generateRequestId();

  try {
    logger.info({
      request_id: requestId,
      action: 'process_payment',
      message: 'Processing payment',
      context: { loan_id: paymentData.loan_id, amount: paymentData.amount }
    });

    const result = await paymentGateway.charge(paymentData);

    logger.info({
      request_id: requestId,
      action: 'process_payment',
      message: 'Payment successful',
      context: { reference: result.reference }
    });

    return result;

  } catch (error) {
    // Log error with full context
    logger.error({
      request_id: requestId,
      action: 'process_payment',
      error: {
        code: error.code || 'PAYMENT_FAILED',
        message: error.message,
        stack: error.stack
      },
      context: {
        loan_id: paymentData.loan_id,
        amount: paymentData.amount,
        gateway: paymentData.payment_method
      }
    });

    // Determine if retry-able
    const retryable = ['GATEWAY_TIMEOUT', 'NETWORK_ERROR'].includes(error.code);

    // Return user-friendly error
    throw new APIError({
      code: 'PAYMENT_FAILED',
      message: 'Payment processing failed. Please try again',
      details: { gateway: paymentData.payment_method },
      retry_able: retryable,
      original_error: error
    });
  }
}
```

### 2. Never Log Sensitive Data

```javascript
// Bad ❌
logger.info({
  action: 'customer_login',
  phone_number: '+263771234567',  // Full phone number
  password: 'SecurePassword123!',  // Password in logs!!!
  otp_code: '123456'               // OTP in logs!!!
});

// Good ✅
logger.info({
  action: 'customer_login',
  phone_number: '+263771***567',   // Masked
  // Never log passwords or OTP codes
});
```

### 3. Include Request Context

```javascript
// Always include request_id for tracing
const requestId = req.headers['x-request-id'] || generateRequestId();

logger.info({
  request_id: requestId,
  user_id: req.user?.id,
  customer_id: req.customer?.id,
  action: 'create_loan',
  ip_address: req.ip,
  user_agent: req.headers['user-agent']
});
```

### 4. Log Performance Metrics

```javascript
const startTime = Date.now();

try {
  const result = await performOperation();

  logger.info({
    action: 'operation_complete',
    duration_ms: Date.now() - startTime,
    success: true
  });

  return result;
} catch (error) {
  logger.error({
    action: 'operation_failed',
    duration_ms: Date.now() - startTime,
    error: error.message
  });

  throw error;
}
```

### 5. Use Correlation IDs

```javascript
// Pass request_id through entire request chain
async function handleLoanApplication(customerId, requestId) {
  // KYC Service
  await kycService.verify(customerId, { request_id: requestId });

  // Credit Scoring
  await scoringService.evaluate(customerId, { request_id: requestId });

  // Fineract
  await fineractService.createLoan(customerId, { request_id: requestId });

  // All logs will have same request_id for easy tracing
}
```

---

## Summary

### Error Codes (30+ Total)

- ✅ 4xx Client Errors (15 codes)
- ✅ 5xx Server Errors (15 codes)
- ✅ User-friendly messages
- ✅ Retry-able flag
- ✅ Help URLs

### Logging

- ✅ 5 log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
- ✅ Structured JSON format
- ✅ PII masking
- ✅ Request correlation
- ✅ Performance metrics

### CloudWatch

- ✅ 8 log groups (one per service)
- ✅ Retention policies (7 days - 7 years)
- ✅ CloudWatch Insights queries
- ✅ Automated alerts

### Monitoring

- ✅ 9 CloudWatch alarms
- ✅ 4 severity levels (P1-P4)
- ✅ Multi-channel alerts (Slack, Email, PagerDuty)
- ✅ Incident runbooks

### Incident Response

- ✅ Response time targets (<15 min - <24 hours)
- ✅ Escalation procedures
- ✅ Runbooks for common incidents
- ✅ Post-mortem process

---

**Document Status:** ✅ Complete
**Next Task:** P1-T006 - Data Privacy & Compliance Framework
**Approval Required:** DevOps Team + Technical Lead
**Last Updated:** November 24, 2025
