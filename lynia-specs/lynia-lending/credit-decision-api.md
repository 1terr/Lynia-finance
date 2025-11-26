# Credit Decision API Design

**Task ID**: P1-T019
**Phase**: Phase 1 - API Specification
**Priority**: High
**Estimated**: 4 hours
**Dependencies**: P1-T015 (Algorithm), P1-T017 (Rules)

---

## Table of Contents
1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Schemas](#requestresponse-schemas)
4. [Response Time SLA](#response-time-sla)
5. [Error Handling](#error-handling)
6. [Audit Logging](#audit-logging)
7. [Security & Authentication](#security--authentication)

---

## 1. Overview

The Credit Decision API provides real-time credit scoring and loan approval decisions for Lynia Finance customers.

### Key Requirements

- **Latency**: <5 seconds (95th percentile)
- **Availability**: 99.9% uptime
- **Security**: API key authentication + request signing
- **Audit**: Every decision logged for compliance
- **Rate Limiting**: 100 requests/minute per API key

### Architecture

```
WhatsApp Bot / Admin Dashboard
        │
        ▼
┌───────────────────────┐
│ API Gateway           │ ← Authentication, rate limiting
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Credit Scoring Lambda │ ← Business logic
│ - Run hard rules      │
│ - Calculate soft score│
│ - Map to credit limit │
└──────────┬────────────┘
           │
           ├──► Supabase (customer data)
           ├──► Redis (caching)
           └──► S3 (audit logs)
           │
           ▼
┌───────────────────────┐
│ Response: Decision    │
│ + Credit Limit        │
│ + Explanation         │
└───────────────────────┘
```

---

## 2. API Endpoints

### 2.1 POST /v1/credit/evaluate

**Purpose**: Evaluate a credit application and return a decision

**Authentication**: API Key (header: `X-API-Key`)

**Request**:
```http
POST /v1/credit/evaluate HTTP/1.1
Host: api.lynia.co.zw
Content-Type: application/json
X-API-Key: lynia_live_abc123...
X-Request-ID: req_xyz789

{
  "customer_id": "cust_abc123",
  "loan_request": {
    "device_id": "dev_xyz789",
    "loan_amount": 299.00,
    "loan_term_months": 8,
    "device_imei": "352099001761481"
  },
  "evaluation_context": {
    "source": "whatsapp_bot",
    "session_id": "sess_abc123"
  }
}
```

**Response** (200 OK):
```json
{
  "decision_id": "dec_abc123",
  "decision": "approve",
  "credit_limit": 350,
  "tier": 2,
  "credit_score": 720,

  "loan_terms": {
    "principal": 299.00,
    "monthly_payment": 47.81,
    "total_repayment": 382.50,
    "term_months": 8,
    "deposit_required": true,
    "deposit_amount": 29.90,
    "deposit_percentage": 0.10
  },

  "approval_details": {
    "approved_at": "2025-11-26T14:30:00Z",
    "expires_at": "2025-11-26T15:00:00Z",
    "approval_code": "APPR-ABC123"
  },

  "risk_assessment": {
    "overall_risk": "low",
    "hard_rules_passed": 6,
    "hard_rules_failed": 0,
    "soft_rules_score": 85,
    "manual_review_required": false
  },

  "explanation": "Approved for $350 (Tier 2). Credit score: 720. Risk level: low. Excellent employment stability and mobile money activity.",

  "next_steps": [
    "Customer must pay $29.90 deposit via EcoCash/Paynow",
    "After deposit payment, visit selected agent to collect device",
    "Agent will verify payment before device handover"
  ],

  "metadata": {
    "processing_time_ms": 234,
    "model_version": "rule-based-v1.0",
    "timestamp": "2025-11-26T14:30:00Z"
  }
}
```

**Response** (200 OK - Rejected):
```json
{
  "decision_id": "dec_def456",
  "decision": "reject",
  "credit_limit": 0,
  "tier": 0,
  "credit_score": 480,

  "rejection_details": {
    "rejected_at": "2025-11-26T14:35:00Z",
    "rejection_reasons": [
      {
        "rule_id": "HR-006",
        "reason": "1 loan(s) overdue 30+ days",
        "severity": "high"
      }
    ]
  },

  "risk_assessment": {
    "overall_risk": "high",
    "hard_rules_passed": 5,
    "hard_rules_failed": 1
  },

  "explanation": "Application declined. You have $120.50 in overdue payments. Please clear outstanding balance before applying.",

  "next_steps": [
    "Pay outstanding balance of $120.50",
    "Contact support at +263771234567 for payment assistance",
    "Reapply after balance is cleared"
  ],

  "metadata": {
    "processing_time_ms": 187,
    "model_version": "rule-based-v1.0",
    "timestamp": "2025-11-26T14:35:00Z"
  }
}
```

**Response** (200 OK - Manual Review):
```json
{
  "decision_id": "dec_ghi789",
  "decision": "manual_review",
  "credit_limit": 0,
  "tier": 0,
  "credit_score": 615,

  "manual_review_details": {
    "review_requested_at": "2025-11-26T14:40:00Z",
    "review_priority": "medium",
    "estimated_review_time": "2-4 hours",
    "review_triggers": [
      {
        "trigger_id": "MR-001",
        "reason": "Borderline credit score",
        "score": 615,
        "recommendation": "Review employment verification and mobile money activity"
      },
      {
        "trigger_id": "MR-002",
        "reason": "First-time borrower requesting high-value device",
        "loan_amount": 299,
        "recommendation": "Verify income source and affordability"
      }
    ]
  },

  "risk_assessment": {
    "overall_risk": "medium",
    "hard_rules_passed": 6,
    "hard_rules_failed": 0,
    "soft_rules_score": 65,
    "manual_review_required": true
  },

  "explanation": "Requires manual review: Borderline credit score; First-time borrower requesting high-value device.",

  "next_steps": [
    "Our team will review your application within 2-4 hours",
    "You will receive an SMS/WhatsApp notification with the decision",
    "Check application status: WhatsApp 'status' or call +263771234567"
  ],

  "metadata": {
    "processing_time_ms": 312,
    "model_version": "rule-based-v1.0",
    "timestamp": "2025-11-26T14:40:00Z"
  }
}
```

---

### 2.2 GET /v1/credit/decision/:decision_id

**Purpose**: Retrieve a previous credit decision

**Request**:
```http
GET /v1/credit/decision/dec_abc123 HTTP/1.1
Host: api.lynia.co.zw
X-API-Key: lynia_live_abc123...
```

**Response** (200 OK):
```json
{
  "decision_id": "dec_abc123",
  "decision": "approve",
  "credit_limit": 350,
  "created_at": "2025-11-26T14:30:00Z",
  "expires_at": "2025-11-26T15:00:00Z",
  "status": "active",
  ...
}
```

---

### 2.3 POST /v1/credit/recalculate

**Purpose**: Recalculate credit score for an existing customer (e.g., after loan repayment)

**Request**:
```http
POST /v1/credit/recalculate HTTP/1.1
Host: api.lynia.co.zw
Content-Type: application/json
X-API-Key: lynia_live_abc123...

{
  "customer_id": "cust_abc123",
  "trigger": "loan_paid_off",
  "trigger_data": {
    "loan_id": "loan_xyz789",
    "paid_off_at": "2025-11-26T14:30:00Z"
  }
}
```

**Response** (200 OK):
```json
{
  "customer_id": "cust_abc123",
  "previous_credit_score": 720,
  "new_credit_score": 765,
  "previous_tier": 2,
  "new_tier": 3,
  "previous_credit_limit": 350,
  "new_credit_limit": 500,
  "tier_upgraded": true,
  "recalculated_at": "2025-11-26T14:30:05Z"
}
```

---

### 2.4 POST /v1/credit/override

**Purpose**: Admin override for credit decisions (requires elevated permissions)

**Authentication**: Admin API Key + Admin User ID

**Request**:
```http
POST /v1/credit/override HTTP/1.1
Host: api.lynia.co.zw
Content-Type: application/json
X-API-Key: lynia_admin_xyz...
X-Admin-User-ID: admin_123

{
  "decision_id": "dec_def456",
  "original_decision": "reject",
  "new_decision": "approve",
  "new_credit_limit": 200,
  "override_reason": "Customer provided proof of employment. Risk acceptable for $200 limit.",
  "approved_by_senior_admin": "admin_456"
}
```

**Response** (200 OK):
```json
{
  "override_id": "ovr_abc123",
  "decision_id": "dec_def456",
  "original_decision": "reject",
  "new_decision": "approve",
  "new_credit_limit": 200,
  "overridden_by": "admin_123",
  "approved_by": "admin_456",
  "overridden_at": "2025-11-26T15:00:00Z",
  "audit_trail_created": true
}
```

---

## 3. Request/Response Schemas

### 3.1 Request Schema (POST /v1/credit/evaluate)

```typescript
interface CreditEvaluationRequest {
  customer_id: string;  // Required, format: cust_[a-z0-9]{20}

  loan_request: {
    device_id: string;  // Required
    loan_amount: number;  // Required, min: 50, max: 500
    loan_term_months: number;  // Required, values: [6, 8, 12]
    device_imei: string;  // Required, 15 digits
  };

  evaluation_context?: {
    source?: 'whatsapp_bot' | 'admin_dashboard' | 'mobile_app' | 'web';
    session_id?: string;
    ip_address?: string;
    user_agent?: string;
  };

  force_recalculate?: boolean;  // Default: false (use cached score if <24h old)
}
```

**Validation Rules**:
- `customer_id`: Must exist in database
- `loan_amount`: Must be ≤ customer's available credit limit
- `loan_term_months`: Must be valid configured term
- `device_imei`: Must not have active loan

---

### 3.2 Response Schema (Approved)

```typescript
interface CreditDecisionResponse {
  decision_id: string;  // Unique identifier for this decision
  decision: 'approve' | 'reject' | 'manual_review';
  credit_limit: number;  // 0, 200, 350, or 500
  tier: number;  // 0, 1, 2, or 3
  credit_score: number;  // 300-850 (FICO-like)

  loan_terms?: {  // Only if approved
    principal: number;
    monthly_payment: number;
    total_repayment: number;
    term_months: number;
    deposit_required: boolean;
    deposit_amount: number;
    deposit_percentage: number;
  };

  approval_details?: {  // Only if approved
    approved_at: string;  // ISO 8601
    expires_at: string;  // ISO 8601 (30 minutes)
    approval_code: string;  // For agent verification
  };

  rejection_details?: {  // Only if rejected
    rejected_at: string;
    rejection_reasons: Array<{
      rule_id: string;
      reason: string;
      severity: 'critical' | 'high' | 'medium';
    }>;
  };

  manual_review_details?: {  // Only if manual review
    review_requested_at: string;
    review_priority: 'low' | 'medium' | 'high';
    estimated_review_time: string;
    review_triggers: Array<{
      trigger_id: string;
      reason: string;
      recommendation: string;
    }>;
  };

  risk_assessment: {
    overall_risk: 'low' | 'medium' | 'high';
    hard_rules_passed: number;
    hard_rules_failed: number;
    soft_rules_score?: number;  // 0-100
    manual_review_required: boolean;
  };

  explanation: string;  // Human-readable explanation

  next_steps: string[];  // Array of action items for customer

  metadata: {
    processing_time_ms: number;
    model_version: string;  // e.g., "rule-based-v1.0" or "ml-v1.2"
    timestamp: string;  // ISO 8601
  };
}
```

---

## 4. Response Time SLA

### 4.1 Latency Targets

| Percentile | Target | Current | Status |
|------------|--------|---------|--------|
| p50 (median) | <1s | 0.3s | ✅ |
| p95 | <5s | 1.2s | ✅ |
| p99 | <10s | 3.5s | ✅ |

**Measurement**: End-to-end from API Gateway to response

---

### 4.2 Performance Optimization

**Caching Strategy**:
```typescript
// Cache credit score for 24 hours (unless loan status changes)
const cacheKey = `credit_score:${customer_id}`;
const cached = await redis.get(cacheKey);

if (cached && !force_recalculate) {
  return JSON.parse(cached);
}

// Calculate fresh score
const score = await calculateCreditScore(customer);

// Cache for 24 hours
await redis.setex(cacheKey, 86400, JSON.stringify(score));

return score;
```

**Database Optimization**:
- Indexed queries on `customer_id`, `kyc_status`, `blacklisted`
- Denormalized credit score in `customers` table
- Connection pooling (10-50 connections)

---

### 4.3 Timeout Handling

```typescript
// Set timeout for entire evaluation
const timeout = 8000; // 8 seconds

const decision = await Promise.race([
  evaluateCreditApplication(request),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Evaluation timeout')), timeout)
  )
]);
```

---

## 5. Error Handling

### 5.1 Error Response Format

```json
{
  "error": {
    "code": "INVALID_CUSTOMER_ID",
    "message": "Customer ID 'cust_invalid' not found",
    "details": {
      "customer_id": "cust_invalid"
    },
    "request_id": "req_xyz789",
    "timestamp": "2025-11-26T14:30:00Z"
  }
}
```

---

### 5.2 Error Codes

| HTTP Status | Error Code | Description | Retry |
|-------------|------------|-------------|-------|
| 400 | `INVALID_REQUEST` | Malformed request body | No |
| 400 | `INVALID_CUSTOMER_ID` | Customer not found | No |
| 400 | `INVALID_DEVICE_ID` | Device not found | No |
| 400 | `LOAN_AMOUNT_EXCEEDS_LIMIT` | Requested amount > credit limit | No |
| 401 | `UNAUTHORIZED` | Invalid API key | No |
| 403 | `FORBIDDEN` | API key lacks permissions | No |
| 404 | `DECISION_NOT_FOUND` | Decision ID not found | No |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Yes (after 60s) |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error | Yes |
| 503 | `SERVICE_UNAVAILABLE` | Database/Redis unavailable | Yes |
| 504 | `GATEWAY_TIMEOUT` | Evaluation timeout | Yes |

---

### 5.3 Retry Logic (Client-Side)

```typescript
async function evaluateCreditWithRetry(
  request: CreditEvaluationRequest,
  maxRetries = 3
): Promise<CreditDecisionResponse> {

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/v1/credit/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'X-Request-ID': generateRequestId()
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.json();

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(error.error.message);
        }

        // Retry server errors (5xx)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await sleep(delay);
          continue;
        }
      }

      return await response.json();

    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## 6. Audit Logging

### 6.1 Audit Log Schema

```typescript
interface CreditDecisionAuditLog {
  log_id: string;
  decision_id: string;
  customer_id: string;

  // Request Details
  request: {
    loan_amount: number;
    device_id: string;
    source: string;
    ip_address: string;
    user_agent: string;
  };

  // Decision Details
  decision: {
    result: 'approve' | 'reject' | 'manual_review';
    credit_limit: number;
    credit_score: number;
    hard_rules: Array<{
      rule_id: string;
      pass: boolean;
      reason?: string;
    }>;
    soft_rules: {
      employment: number;
      geographic: number;
      mobile_money: number;
      loan_history: number;
      affordability: number;
      total_score: number;
    };
  };

  // Timing
  timing: {
    request_received_at: string;
    decision_completed_at: string;
    processing_time_ms: number;
  };

  // Metadata
  model_version: string;
  api_version: string;
  environment: 'production' | 'staging' | 'development';

  created_at: string;
}
```

---

### 6.2 Logging Implementation

```typescript
async function logCreditDecision(
  request: CreditEvaluationRequest,
  response: CreditDecisionResponse,
  processingTime: number
): Promise<void> {

  const auditLog: CreditDecisionAuditLog = {
    log_id: generateLogId(),
    decision_id: response.decision_id,
    customer_id: request.customer_id,

    request: {
      loan_amount: request.loan_request.loan_amount,
      device_id: request.loan_request.device_id,
      source: request.evaluation_context?.source || 'unknown',
      ip_address: request.evaluation_context?.ip_address,
      user_agent: request.evaluation_context?.user_agent
    },

    decision: {
      result: response.decision,
      credit_limit: response.credit_limit,
      credit_score: response.credit_score,
      hard_rules: response.risk_assessment.hard_rules,
      soft_rules: response.risk_assessment.soft_rules
    },

    timing: {
      request_received_at: new Date().toISOString(),
      decision_completed_at: new Date().toISOString(),
      processing_time_ms: processingTime
    },

    model_version: response.metadata.model_version,
    api_version: 'v1',
    environment: process.env.NODE_ENV,

    created_at: new Date().toISOString()
  };

  // Store in Supabase
  await supabase.from('credit_decision_logs').insert(auditLog);

  // Also stream to S3 for long-term storage
  await s3.putObject({
    Bucket: 'lynia-audit-logs',
    Key: `credit-decisions/${new Date().toISOString().split('T')[0]}/${auditLog.log_id}.json`,
    Body: JSON.stringify(auditLog, null, 2)
  }).promise();
}
```

---

### 6.3 Compliance & Retention

**Regulations**:
- Zimbabwe Banking Act: 7-year retention
- GDPR equivalent: Customer right to access decision data

**Retention Policy**:
- Hot storage (Supabase): 90 days
- Warm storage (S3): 7 years
- Archival (S3 Glacier): After 7 years, delete or archive per legal hold

---

## 7. Security & Authentication

### 7.1 API Key Authentication

**Format**: `lynia_[env]_[32-char-random]`
- Example: `lynia_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

**Environments**:
- `lynia_test_*`: Sandbox environment
- `lynia_live_*`: Production environment

---

### 7.2 Request Signing (Optional - Phase 2+)

```typescript
// Generate HMAC signature
const signature = crypto
  .createHmac('sha256', API_SECRET)
  .update(`${method}${path}${timestamp}${JSON.stringify(body)}`)
  .digest('hex');

// Include in request headers
headers['X-Signature'] = signature;
headers['X-Timestamp'] = timestamp;
```

---

### 7.3 Rate Limiting

**Limits**:
- 100 requests/minute per API key
- 1,000 requests/hour per API key
- 10,000 requests/day per API key

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1637942400
```

**Rate Limit Exceeded Response** (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit of 100 requests/minute exceeded",
    "retry_after": 45
  }
}
```

---

## Summary

**Credit Decision API Features**:
- ✅ Real-time credit evaluation (<5s)
- ✅ RESTful JSON API
- ✅ Comprehensive audit logging
- ✅ Admin override support
- ✅ Automatic credit score recalculation
- ✅ Rate limiting & authentication
- ✅ Detailed error responses
- ✅ Caching for performance

**API Versioning**: `/v1/credit/*` (versioned in URL path)

**SDKs** (Future):
- Node.js SDK
- Python SDK
- Postman collection

**Availability**: 99.9% uptime SLA (monitored via CloudWatch)
