# Lynia Finance - API Specification

**Document:** P1-T003 Deliverable
**Version:** 1.0
**Date:** November 24, 2025
**API Version:** v1
**Status:** Phase 1 - API Design

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)
5. [WhatsApp Bot Service API](#whatsapp-bot-service-api)
6. [KYC Service API](#kyc-service-api)
7. [Credit Scoring Service API](#credit-scoring-service-api)
8. [Payment Service API](#payment-service-api)
9. [Device Lock Service API](#device-lock-service-api)
10. [Notification Service API](#notification-service-api)
11. [Inventory Service API](#inventory-service-api)
12. [Admin API Service](#admin-api-service)
13. [Webhooks](#webhooks)
14. [Rate Limiting](#rate-limiting)

---

## Overview

### API Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS API Gateway (HTTP API)                │
│                  https://api.lyniafinance.com                │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  WhatsApp Bot │    │  KYC Service  │    │Payment Service│
│   /whatsapp   │    │     /kyc      │    │   /payments   │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│Credit Scoring │    │ Device Lock   │    │ Notification  │
│   /scoring    │    │    /devices   │    │    /notify    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Inventory    │    │  Admin API    │    │ Distributor   │
│  /inventory   │    │    /admin     │    │ /distributors │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Base URLs

| Environment | Base URL | Purpose |
|-------------|----------|---------|
| Production | `https://api.lyniafinance.com/v1` | Live production |
| Staging | `https://staging-api.lyniafinance.com/v1` | Testing |
| Development | `http://localhost:3000/v1` | Local development |

### API Versioning

- **Current Version**: v1
- **Versioning Strategy**: URL path versioning (`/v1`, `/v2`, etc.)
- **Deprecation Policy**: 6 months notice before removing endpoints

---

## Authentication

### Authentication Methods

| Method | Use Case | Header |
|--------|----------|--------|
| **JWT Bearer Token** | Customer, Distributor, Admin | `Authorization: Bearer {token}` |
| **API Key** | Service-to-service | `X-API-Key: {key}` |
| **Webhook Signature** | External webhooks | `X-Webhook-Signature: {signature}` |

### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "role": "customer|distributor|admin",
  "phone": "+263771234567",
  "iat": 1700000000,
  "exp": 1700086400,
  "iss": "lyniafinance.com"
}
```

### Authentication Flows

#### 1. Customer Authentication (WhatsApp OTP)

```
Customer                    WhatsApp Bot               Supabase Auth
   │                             │                          │
   │ 1. Send "Hi"               │                          │
   ├────────────────────────────>│                          │
   │                             │                          │
   │ 2. Request OTP              │                          │
   │<────────────────────────────┤                          │
   │                             │ 3. Generate OTP          │
   │                             ├─────────────────────────>│
   │                             │                          │
   │ 4. Enter OTP                │                          │
   ├────────────────────────────>│                          │
   │                             │ 5. Verify OTP            │
   │                             ├─────────────────────────>│
   │                             │ 6. Return JWT            │
   │                             │<─────────────────────────┤
   │ 7. JWT Token                │                          │
   │<────────────────────────────┤                          │
```

#### 2. Admin Authentication (Email + Password + MFA)

```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "admin@lyniafinance.com",
  "password": "SecurePassword123!"
}

Response:
{
  "mfa_required": true,
  "mfa_token": "temp-token-xyz"
}

POST /v1/auth/verify-mfa
{
  "mfa_token": "temp-token-xyz",
  "mfa_code": "123456"
}

Response:
{
  "access_token": "eyJhbGc...",
  "refresh_token": "refresh-token-xyz",
  "expires_in": 86400
}
```

### Authorization Headers

```http
# JWT Bearer Token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Key (Service-to-service)
X-API-Key: sk_live_51AbC...

# Request ID (for tracing)
X-Request-ID: req_abc123xyz
```

---

## Common Patterns

### Request Format

All requests use JSON:

```http
POST /v1/resource
Content-Type: application/json
Authorization: Bearer {token}
X-Request-ID: req_123

{
  "field": "value"
}
```

### Response Format

#### Success Response (2xx)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "field": "value"
  },
  "meta": {
    "request_id": "req_123",
    "timestamp": "2025-11-24T12:00:00Z"
  }
}
```

#### List Response (with pagination)

```json
{
  "success": true,
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  },
  "meta": {
    "request_id": "req_123",
    "timestamp": "2025-11-24T12:00:00Z"
  }
}
```

### Pagination

All list endpoints support pagination:

```http
GET /v1/resource?page=1&per_page=20&sort=created_at&order=desc
```

Parameters:
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 20, max: 100)
- `sort`: Sort field (default: `created_at`)
- `order`: Sort order (`asc` or `desc`, default: `desc`)

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phone number format",
    "details": {
      "field": "phone_number",
      "value": "0771234567",
      "expected": "+263771234567"
    }
  },
  "meta": {
    "request_id": "req_123",
    "timestamp": "2025-11-24T12:00:00Z"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| **200** | OK | Successful GET, PUT, PATCH |
| **201** | Created | Successful POST |
| **202** | Accepted | Async processing started |
| **204** | No Content | Successful DELETE |
| **400** | Bad Request | Invalid input |
| **401** | Unauthorized | Missing/invalid auth |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate resource |
| **422** | Unprocessable Entity | Validation failed |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error |
| **503** | Service Unavailable | Maintenance mode |

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `AUTHENTICATION_FAILED` | 401 | Invalid credentials |
| `UNAUTHORIZED` | 401 | Missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `KYC_VERIFICATION_FAILED` | 422 | KYC verification failed |
| `INSUFFICIENT_CREDIT_LIMIT` | 422 | Credit limit too low |
| `LOAN_ALREADY_EXISTS` | 409 | Active loan exists |
| `PAYMENT_FAILED` | 422 | Payment processing failed |
| `DEVICE_UNAVAILABLE` | 422 | Device out of stock |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected error |
| `SERVICE_UNAVAILABLE` | 503 | Service down |

---

## WhatsApp Bot Service API

**Base Path**: `/v1/whatsapp`

### POST /webhook

Receive WhatsApp messages from Meta Cloud API.

**Authentication**: Webhook signature verification

**Request:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "PHONE_NUMBER_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "+263771234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "John Doe" },
          "wa_id": "263771234567"
        }],
        "messages": [{
          "from": "263771234567",
          "id": "wamid.xxx",
          "timestamp": "1700000000",
          "text": { "body": "Hi" },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processed"
}
```

---

### GET /webhook

WhatsApp webhook verification endpoint.

**Query Parameters:**
- `hub.mode`: Should be "subscribe"
- `hub.verify_token`: Verification token
- `hub.challenge`: Challenge string

**Response:**
```
{hub.challenge}
```

---

### POST /send-message

Send WhatsApp message (internal use).

**Authentication**: API Key

**Request:**
```json
{
  "to": "+263771234567",
  "type": "text",
  "text": {
    "body": "Your loan has been approved! 🎉"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message_id": "wamid.xxx",
    "status": "sent"
  }
}
```

---

### POST /send-template

Send WhatsApp template message.

**Request:**
```json
{
  "to": "+263771234567",
  "template": {
    "name": "loan_approval",
    "language": { "code": "en" },
    "components": [{
      "type": "body",
      "parameters": [
        { "type": "text", "text": "John" },
        { "type": "text", "text": "$500" }
      ]
    }]
  }
}
```

---

### POST /send-interactive

Send interactive WhatsApp message (buttons/lists).

**Request:**
```json
{
  "to": "+263771234567",
  "interactive": {
    "type": "button",
    "body": { "text": "Choose your device:" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "device_1", "title": "Samsung A04 - $500" }},
        { "type": "reply", "reply": { "id": "device_2", "title": "Tecno Spark - $350" }}
      ]
    }
  }
}
```

---

## KYC Service API

**Base Path**: `/v1/kyc`

### POST /submit

Submit KYC documents for verification.

**Authentication**: JWT Bearer Token

**Request:**
```json
{
  "customer_id": "uuid",
  "document_type": "national_id",
  "document_number": "63-123456-A-12",
  "document_front": "base64_encoded_image_or_s3_url",
  "document_back": "base64_encoded_image_or_s3_url",
  "selfie": "base64_encoded_image_or_s3_url"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "submission_id": "uuid",
    "status": "pending",
    "smile_job_id": "job_abc123",
    "estimated_completion": "2025-11-24T12:05:00Z"
  }
}
```

---

### GET /status/:submission_id

Check KYC verification status.

**Response:**
```json
{
  "success": true,
  "data": {
    "submission_id": "uuid",
    "customer_id": "uuid",
    "status": "approved",
    "verified_at": "2025-11-24T12:03:45Z",
    "confidence_score": 98.5,
    "liveness_passed": true,
    "document_readable": true,
    "result": {
      "full_name": "John Doe",
      "date_of_birth": "1990-01-15",
      "national_id": "63-123456-A-12",
      "id_type": "national_id"
    }
  }
}
```

---

### POST /retry/:submission_id

Retry failed KYC verification.

**Request:**
```json
{
  "document_front": "new_base64_or_url",
  "selfie": "new_base64_or_url"
}
```

---

### POST /manual-review/:submission_id

Submit for manual review (admin only).

**Authentication**: Admin JWT

**Request:**
```json
{
  "notes": "Document quality unclear, needs human review"
}
```

---

### POST /approve/:submission_id

Manually approve KYC (admin only).

**Request:**
```json
{
  "approved_by": "admin_user_id",
  "notes": "Verified via alternate method"
}
```

---

## Credit Scoring Service API

**Base Path**: `/v1/scoring`

### POST /evaluate

Calculate credit score for a customer.

**Authentication**: API Key (internal service)

**Request:**
```json
{
  "customer_id": "uuid",
  "loan_amount": 500,
  "data": {
    "kyc_verified": true,
    "national_id_valid": true,
    "phone_number_age_months": 24,
    "mobile_money_transactions_count": 150,
    "average_mobile_money_balance": 200,
    "previous_loans": 0,
    "employment_type": "informal",
    "monthly_income_estimate": 300
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_id": "uuid",
    "credit_score": 720,
    "credit_tier": 1,
    "credit_limit": 200,
    "decision": "approved",
    "confidence": 85.5,
    "reasons": [
      "KYC verified successfully",
      "Good mobile money history",
      "First-time borrower (Tier 1)"
    ],
    "factors": {
      "kyc_score": 100,
      "identity_score": 95,
      "behavior_score": 80,
      "affordability_score": 70
    }
  }
}
```

---

### GET /:customer_id

Get existing credit score.

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_id": "uuid",
    "credit_score": 720,
    "credit_tier": 2,
    "credit_limit": 350,
    "last_calculated_at": "2025-11-24T12:00:00Z",
    "next_review_date": "2025-12-24"
  }
}
```

---

### POST /override

Manual credit limit override (admin only).

**Request:**
```json
{
  "customer_id": "uuid",
  "new_limit": 500,
  "new_tier": 3,
  "reason": "Excellent repayment history",
  "approved_by": "admin_user_id"
}
```

---

## Payment Service API

**Base Path**: `/v1/payments`

### POST /initiate

Initiate a payment.

**Authentication**: JWT Bearer Token

**Request:**
```json
{
  "loan_id": "uuid",
  "amount": 70.31,
  "payment_method": "ecocash",
  "phone_number": "+263771234567"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "status": "pending",
    "payment_url": "https://ecocash.co.zw/pay/xxx",
    "reference": "PAY-ABC123",
    "expires_at": "2025-11-24T12:15:00Z"
  }
}
```

---

### POST /webhook/ecocash

EcoCash payment webhook.

**Authentication**: Webhook signature

**Request:**
```json
{
  "reference": "PAY-ABC123",
  "status": "success",
  "amount": 70.31,
  "currency": "USD",
  "phone_number": "+263771234567",
  "transaction_id": "ECO-TXN-XYZ",
  "timestamp": "2025-11-24T12:05:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed"
}
```

---

### POST /webhook/payment gateway

EcoCash/Omari/Innbucks/OneWallet payment webhook.

**Request:**
```json
{
  "reference": "PAY-ABC123",
  "payment gatewayreference": "12345",
  "amount": "70.31",
  "status": "Paid",
  "pollurl": "https://payment gateway.co.zw/poll/xxx",
  "hash": "signature_hash"
}
```

---

### GET /:payment_id

Get payment status.

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "loan_id": "uuid",
    "amount": 70.31,
    "status": "completed",
    "payment_method": "ecocash",
    "reference": "PAY-ABC123",
    "gateway_transaction_id": "ECO-TXN-XYZ",
    "paid_at": "2025-11-24T12:05:00Z",
    "created_at": "2025-11-24T12:00:00Z"
  }
}
```

---

### POST /reconcile

Manual payment reconciliation (admin only).

**Request:**
```json
{
  "payment_id": "uuid",
  "gateway_transaction_id": "ECO-TXN-XYZ",
  "reconciled_by": "admin_user_id",
  "notes": "Manual reconciliation after gateway delay"
}
```

---

## Device Lock Service API

**Base Path**: `/v1/devices`

### POST /lock

Lock a device remotely.

**Authentication**: API Key (internal service)

**Request:**
```json
{
  "imei": "123456789012345",
  "reason": "missed_payment",
  "grace_period_ends_at": "2025-11-24T12:00:00Z",
  "customer_notified": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device_id": "uuid",
    "imei": "123456789012345",
    "lock_status": "locked",
    "locked_at": "2025-11-24T12:00:00Z",
    "lock_provider": "absolute",
    "lock_provider_response": {
      "status": "success",
      "device_id": "abs_device_123"
    }
  }
}
```

---

### POST /unlock

Unlock a device.

**Request:**
```json
{
  "imei": "123456789012345",
  "reason": "payment_received",
  "payment_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device_id": "uuid",
    "lock_status": "unlocked",
    "unlocked_at": "2025-11-24T12:30:00Z"
  }
}
```

---

### GET /status/:imei

Get device lock status.

**Response:**
```json
{
  "success": true,
  "data": {
    "imei": "123456789012345",
    "lock_status": "unlocked",
    "last_checked_at": "2025-11-24T12:00:00Z",
    "grace_period_ends_at": null,
    "lock_history": [
      {
        "locked_at": "2025-11-20T12:00:00Z",
        "unlocked_at": "2025-11-21T10:00:00Z",
        "reason": "missed_payment"
      }
    ]
  }
}
```

---

## Notification Service API

**Base Path**: `/v1/notifications`

### POST /send

Send a notification.

**Authentication**: API Key (internal service)

**Request:**
```json
{
  "customer_id": "uuid",
  "type": "payment_reminder",
  "channel": "whatsapp",
  "priority": "high",
  "template": "payment_due_reminder",
  "data": {
    "customer_name": "John",
    "amount": "$70.31",
    "due_date": "2025-11-25",
    "days_until_due": 1
  },
  "scheduled_for": "2025-11-24T09:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notification_id": "uuid",
    "status": "queued",
    "estimated_delivery": "2025-11-24T09:00:05Z"
  }
}
```

---

### POST /send-bulk

Send bulk notifications.

**Request:**
```json
{
  "notifications": [
    {
      "customer_id": "uuid1",
      "type": "payment_reminder",
      "channel": "whatsapp",
      "data": { "amount": "$70.31" }
    },
    {
      "customer_id": "uuid2",
      "type": "payment_reminder",
      "channel": "sms",
      "data": { "amount": "$85.50" }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batch_id": "batch_abc123",
    "total": 2,
    "queued": 2,
    "failed": 0
  }
}
```

---

### GET /:notification_id

Get notification status.

**Response:**
```json
{
  "success": true,
  "data": {
    "notification_id": "uuid",
    "type": "payment_reminder",
    "channel": "whatsapp",
    "status": "delivered",
    "sent_at": "2025-11-24T09:00:01Z",
    "delivered_at": "2025-11-24T09:00:03Z",
    "read_at": "2025-11-24T09:15:00Z"
  }
}
```

---

## Inventory Service API

**Base Path**: `/v1/inventory`

### GET /devices

List available devices.

**Query Parameters:**
- `status`: Filter by status (available, reserved, assigned)
- `brand`: Filter by brand
- `min_price`: Minimum price
- `max_price`: Maximum price
- `featured`: Show featured devices only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "brand": "Samsung",
      "model": "Galaxy A04",
      "sku": "SAM-A04-BLK-64",
      "ram_gb": 3,
      "storage_gb": 64,
      "financing_price": 500,
      "deposit_amount": 0,
      "primary_image_url": "https://...",
      "status": "available",
      "featured": true
    }
  ],
  "pagination": {...}
}
```

---

### GET /devices/:id

Get device details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "brand": "Samsung",
    "model": "Galaxy A04",
    "specifications": {
      "ram_gb": 3,
      "storage_gb": 64,
      "screen_size": 6.5,
      "battery_mah": 5000,
      "camera_mp": "13MP + 2MP",
      "processor": "Helio P35",
      "os": "Android 12"
    },
    "pricing": {
      "retail_price": 450,
      "financing_price": 500,
      "monthly_payment": 62.50,
      "term_months": 8
    },
    "availability": {
      "status": "available",
      "stock_count": 15,
      "distributors": ["Harare Downtown", "Bulawayo Central"]
    },
    "images": [
      "https://...",
      "https://..."
    ]
  }
}
```

---

### POST /reserve

Reserve a device for a customer.

**Request:**
```json
{
  "device_id": "uuid",
  "customer_id": "uuid",
  "loan_id": "uuid",
  "expires_in_hours": 24
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservation_id": "uuid",
    "device_id": "uuid",
    "expires_at": "2025-11-25T12:00:00Z"
  }
}
```

---

## Admin API Service

**Base Path**: `/v1/admin`

### GET /dashboard

Get dashboard KPIs.

**Authentication**: Admin JWT

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_customers": 1250,
      "active_loans": 850,
      "total_disbursed": 425000,
      "outstanding_principal": 320000,
      "collection_rate": 92.5
    },
    "today": {
      "new_customers": 15,
      "new_loans": 12,
      "payments_received": 45,
      "payment_amount": 3150.50
    },
    "alerts": [
      {
        "type": "high_delinquency",
        "message": "45 loans overdue >30 days",
        "severity": "warning"
      }
    ]
  }
}
```

---

### GET /loans

List all loans (with filters).

**Query Parameters:**
- `status`: Filter by status
- `customer_id`: Filter by customer
- `overdue`: true/false
- `date_from`: Start date
- `date_to`: End date

---

### POST /loans/:id/approve

Approve a loan manually.

**Request:**
```json
{
  "approved_by": "admin_user_id",
  "notes": "Approved after manual review"
}
```

---

### POST /loans/:id/reject

Reject a loan.

**Request:**
```json
{
  "rejected_by": "admin_user_id",
  "reason": "Insufficient credit history"
}
```

---

### GET /customers/:id

Get customer details with full history.

**Response:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "uuid",
      "phone_number": "+263771234567",
      "name": "John Doe",
      "kyc_status": "approved",
      "credit_limit": 350,
      "credit_tier": 2
    },
    "loans": [...],
    "payments": [...],
    "devices": [...],
    "statistics": {
      "total_borrowed": 700,
      "total_repaid": 350,
      "on_time_payments": 8,
      "missed_payments": 1,
      "delinquency_rate": 11.1
    }
  }
}
```

---

## Webhooks

### Webhook Security

All webhooks include a signature for verification:

```javascript
// Verify webhook signature
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

### Webhook Retry Policy

- **Attempts**: 5 retries
- **Backoff**: Exponential (1min, 5min, 15min, 1h, 6h)
- **Timeout**: 30 seconds per attempt
- **Dead Letter**: After 5 failures, sent to dead letter queue

---

## Rate Limiting

### Rate Limits by Endpoint

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| WhatsApp webhook | 1000 req/min | Per phone number |
| Public API | 100 req/min | Per IP |
| Authenticated API | 500 req/min | Per user |
| Admin API | 1000 req/min | Per admin |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1700001600
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "retry_after": 60
  }
}
```

---

## OpenAPI 3.0 Files

See separate OpenAPI specification files:
- `openapi/whatsapp-bot.yaml`
- `openapi/kyc-service.yaml`
- `openapi/credit-scoring.yaml`
- `openapi/payment-service.yaml`
- `openapi/device-lock.yaml`
- `openapi/notification-service.yaml`
- `openapi/admin-api.yaml`

---

**Document Status:** ✅ Complete
**Next Task:** P1-T004 - Authentication & Authorization Design
**Approval Required:** Technical Lead + API Team
**Last Updated:** November 24, 2025
