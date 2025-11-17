# T015: Payment Callback Payload Schemas Documentation

**Task**: Document payment callback payload schemas in research.md
**Phase**: Phase 0 - Research
**Status**: ✅ Complete
**Date**: 2025-11-12
**GitHub Issue**: #20

---

## Executive Summary

This document provides comprehensive documentation of payment callback payload schemas for all payment gateways integrated with Lynia Finance. Payment callbacks (webhooks) are HTTP POST requests sent by payment providers to notify merchants of transaction status updates.

**Key Payment Gateways**:
1. **Paynow** (Primary) - URL-encoded form data
2. **Pesepay** (Secondary) - JSON payload
3. **ContiPay** (Tertiary) - JSON/Form hybrid
4. **EcoCash Direct** (Future) - Proprietary format (not yet available)
5. **O'mari Direct** (Future) - Proprietary format (not yet available)

**Standard Payload Components**:
- Transaction reference (merchant + provider)
- Amount and currency
- Payment status
- Timestamp
- Security hash/signature
- Poll URL for status verification

---

## Table of Contents

1. [Callback Fundamentals](#1-callback-fundamentals)
2. [Paynow Callback Schema](#2-paynow-callback-schema)
3. [Pesepay Callback Schema](#3-pesepay-callback-schema)
4. [ContiPay Callback Schema](#4-contipay-callback-schema)
5. [Direct Provider Schemas](#5-direct-provider-schemas)
6. [Schema Comparison](#6-schema-comparison)
7. [Security & Validation](#7-security--validation)
8. [Error Handling](#8-error-handling)
9. [Testing Callbacks](#9-testing-callbacks)
10. [Implementation Examples](#10-implementation-examples)
11. [Best Practices](#11-best-practices)
12. [References](#12-references)

---

## 1. Callback Fundamentals

### What is a Payment Callback?

A **payment callback** (also called webhook) is an HTTP POST request sent by a payment gateway to your server to notify you of transaction status updates.

**Flow**:
```plaintext
Customer → Payment Gateway → Process Payment
                ↓
         (Payment Completed)
                ↓
    HTTP POST → Your Server (Callback URL)
                ↓
         Update Database
                ↓
    Notify Customer (WhatsApp)
```

### Callback vs Polling

| Method | How it Works | Pros | Cons |
|--------|--------------|------|------|
| **Callback** | Gateway pushes updates to your server | Real-time, efficient | Requires public URL, can fail if server down |
| **Polling** | Your server queries gateway periodically | Works without public URL, reliable | Delays, higher API usage |

**Best Practice**: Use **both** - callbacks for real-time updates, polling as fallback

---

### Callback Requirements

**1. Public HTTPS Endpoint**
- Must be accessible from internet
- **HTTPS required** (not HTTP) for security
- Valid SSL certificate

**2. Fast Response**
- Return `200 OK` within **5 seconds**
- Process complex logic asynchronously
- Don't wait for database writes

**3. Idempotency**
- Handle duplicate callbacks gracefully
- Check if transaction already processed
- Same callback = same result (no side effects)

**4. Security Verification**
- Verify signature/hash on every callback
- Reject callbacks with invalid signatures
- Log suspicious requests

**5. Retry Handling**
- Expect retries if you return HTTP errors
- Payment gateways typically retry 5-10 times
- Use exponential backoff on your side

---

### Content-Type Formats

Payment callbacks use two common formats:

**1. URL-Encoded Form Data** (`application/x-www-form-urlencoded`)
```plaintext
reference=INV-001&paynowreference=123456&amount=50.00&status=Paid&hash=ABC123...
```

**Pros**:
- Simple to parse (native form parsing)
- Smaller payload size
- Supported by all frameworks

**Cons**:
- Less structured than JSON
- Harder to represent nested data
- Manual key extraction

**Used by**: Paynow, traditional payment gateways

---

**2. JSON** (`application/json`)
```json
{
  "reference": "INV-001",
  "providerReference": "123456",
  "amount": 50.00,
  "status": "PAID",
  "timestamp": "2025-11-12T10:30:00Z",
  "signature": "ABC123..."
}
```

**Pros**:
- Structured, easy to parse
- Supports nested objects/arrays
- Better for complex data
- Modern REST API standard

**Cons**:
- Slightly larger payload
- Requires JSON parsing library

**Used by**: Pesepay, modern payment gateways, Stripe, PayPal

---

### Common Callback Parameters

Across all payment gateways, these fields are typically included:

| Field | Description | Example |
|-------|-------------|---------|
| **Merchant Reference** | Your internal transaction ID | `INV-12345`, `LOAN-001` |
| **Provider Reference** | Gateway's internal transaction ID | `PNW-789456`, `PSP-123` |
| **Amount** | Transaction amount | `50.00`, `100.50` |
| **Currency** | Transaction currency | `USD`, `ZWL` |
| **Status** | Payment status | `Paid`, `Failed`, `Cancelled` |
| **Timestamp** | When transaction occurred | `2025-11-12T10:30:00Z` |
| **Payment Method** | How customer paid | `ecocash`, `visa`, `omari` |
| **Customer Info** | Phone, email, etc. | `0771234567` |
| **Poll URL** | URL to verify status | `https://...` |
| **Signature/Hash** | Security verification | SHA512 hash |

---

## 2. Paynow Callback Schema

### Overview

**Paynow** (Zimbabwe's leading payment gateway) sends callbacks as **URL-encoded form data** (not JSON).

**Content-Type**: `application/x-www-form-urlencoded`

**HTTP Method**: `POST`

**Endpoint**: Your configured `resultUrl` (e.g., `https://lynia.co.zw/api/webhooks/paynow`)

---

### Paynow Callback Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `reference` | String | Yes | Your merchant reference | `INV-12345` |
| `paynowreference` | String | Yes | Paynow transaction ID | `123456` |
| `amount` | Decimal | Yes | Transaction amount | `50.00` |
| `status` | String | Yes | Payment status | `Paid`, `Cancelled`, `Failed` |
| `pollurl` | String | Yes | URL to poll for status updates | `https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc-123` |
| `hash` | String | Yes | SHA-512 security hash | `785659BF4970D86C...` |

---

### Example Paynow Callback (Raw)

**HTTP Request**:
```http
POST /api/webhooks/paynow HTTP/1.1
Host: lynia.co.zw
Content-Type: application/x-www-form-urlencoded
Content-Length: 412

reference=INV-12345&paynowreference=123456&amount=50.00&status=Paid&pollurl=https%3A%2F%2Fwww.paynow.co.zw%2FInterface%2FCheckPayment%2F%3Fguid%3D9f24be04-f4a6-4dff-8ab5-455263ba7b6b&hash=785659BF4970D86C4F5B9357473B53F43AF3FFA28E6A622D8EF83B69B68E5464C6BBD0F4187D8C6FB31B71DB3700C415B2434DB8D6F670CDBB809502C339AB3C
```

**Parsed Parameters** (Express.js):
```javascript
{
  reference: 'INV-12345',
  paynowreference: '123456',
  amount: '50.00',
  status: 'Paid',
  pollurl: 'https://www.paynow.co.zw/Interface/CheckPayment/?guid=9f24be04-f4a6-4dff-8ab5-455263ba7b6b',
  hash: '785659BF4970D86C4F5B9357473B53F43AF3FFA28E6A622D8EF83B69B68E5464C6BBD0F4187D8C6FB31B71DB3700C415B2434DB8D6F670CDBB809502C339AB3C'
}
```

---

### Paynow Status Values

| Status Value | Meaning | Action Required |
|--------------|---------|-----------------|
| `Paid` | ✅ Payment successful | Complete order/loan processing |
| `Awaiting Delivery` | ✅ Payment successful, awaiting fulfillment | Complete order/loan processing |
| `Delivered` | ✅ Order delivered to customer | Archive transaction |
| `Cancelled` | ❌ Customer cancelled transaction | Notify customer, offer retry |
| `Failed` | ❌ Payment failed | Notify customer, offer retry |
| `Created` | ⏳ Transaction created, not yet paid | Wait for payment |
| `Sent` | ⏳ Payment sent but not confirmed | Poll for status |
| `Awaiting Redirect` | ⏳ Customer redirected to gateway | Wait for payment |

**Final States** (no further updates expected):
- `Paid` / `Awaiting Delivery` → Success
- `Cancelled` / `Failed` / `Delivered` → Terminal

---

### Paynow Hash Verification

**Hash Algorithm**: SHA-512 (uppercase hexadecimal)

**Hash Calculation**:
```javascript
// Hash = SHA512(reference + paynowreference + amount + status + INTEGRATION_KEY)

const crypto = require('crypto');

function verifyPaynowHash(params, integrationKey) {
  const { reference, paynowreference, amount, status, hash } = params;

  // Concatenate parameters (NO separators, NO spaces)
  const data = reference + paynowreference + amount + status + integrationKey;

  // Calculate SHA-512 hash
  const calculatedHash = crypto
    .createHash('sha512')
    .update(data)
    .digest('hex')
    .toUpperCase();

  // Compare hashes
  return calculatedHash === hash.toUpperCase();
}
```

**Example**:
```javascript
// Params from callback
const params = {
  reference: 'INV-12345',
  paynowreference: '123456',
  amount: '50.00',
  status: 'Paid',
  hash: '785659BF4970D86C...'
};

const integrationKey = 'YOUR_INTEGRATION_KEY';

// Concatenate
const data = 'INV-12345' + '123456' + '50.00' + 'Paid' + 'YOUR_INTEGRATION_KEY';
// Result: "INV-1234512345650.00PaidYOUR_INTEGRATION_KEY"

// Hash
const hash = crypto.createHash('sha512').update(data).digest('hex').toUpperCase();

// Verify
if (hash === params.hash) {
  console.log('✅ Valid callback');
} else {
  console.log('❌ Invalid hash, possible fraud');
}
```

---

### Paynow Schema (TypeScript)

```typescript
interface PaynowCallback {
  reference: string;         // Your merchant reference
  paynowreference: string;   // Paynow transaction ID
  amount: string;            // Transaction amount (decimal string)
  status: PaynowStatus;      // Payment status
  pollurl: string;           // URL to poll for status
  hash: string;              // SHA-512 security hash
}

type PaynowStatus =
  | 'Paid'
  | 'Awaiting Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Failed'
  | 'Created'
  | 'Sent'
  | 'Awaiting Redirect';

// JSON Schema (for validation)
const paynowCallbackSchema = {
  type: 'object',
  required: ['reference', 'paynowreference', 'amount', 'status', 'pollurl', 'hash'],
  properties: {
    reference: { type: 'string', minLength: 1 },
    paynowreference: { type: 'string', minLength: 1 },
    amount: { type: 'string', pattern: '^\\d+(\\.\\d{2})?$' },
    status: {
      type: 'string',
      enum: ['Paid', 'Awaiting Delivery', 'Delivered', 'Cancelled', 'Failed', 'Created', 'Sent', 'Awaiting Redirect']
    },
    pollurl: { type: 'string', format: 'uri' },
    hash: { type: 'string', pattern: '^[A-F0-9]{128}$' }  // SHA-512 = 128 hex chars
  }
};
```

---

## 3. Pesepay Callback Schema

### Overview

**Pesepay** sends callbacks as **JSON payloads** (modern REST API format).

**Content-Type**: `application/json`

**HTTP Method**: `POST`

**Endpoint**: Your configured callback URL (e.g., `https://lynia.co.zw/api/webhooks/pesepay`)

---

### Pesepay Callback Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `referenceNumber` | String | Yes | Your merchant reference | `INV-12345` |
| `transactionReference` | String | Yes | Pesepay transaction ID | `PSP-789456` |
| `amount` | Number | Yes | Transaction amount | `50.00` |
| `currency` | String | Yes | Currency code | `USD`, `ZWL` |
| `status` | String | Yes | Payment status | `SUCCESS`, `FAILED`, `PENDING` |
| `paymentMethod` | String | Yes | Payment method used | `ECOCASH`, `VISA` |
| `timestamp` | String | Yes | ISO 8601 timestamp | `2025-11-12T10:30:00Z` |
| `customerPhone` | String | No | Customer phone number | `0771234567` |
| `signature` | String | Yes | HMAC-SHA256 signature | `abc123...` |

---

### Example Pesepay Callback (JSON)

**HTTP Request**:
```http
POST /api/webhooks/pesepay HTTP/1.1
Host: lynia.co.zw
Content-Type: application/json
Content-Length: 342

{
  "referenceNumber": "INV-12345",
  "transactionReference": "PSP-789456",
  "amount": 50.00,
  "currency": "USD",
  "status": "SUCCESS",
  "paymentMethod": "ECOCASH",
  "timestamp": "2025-11-12T10:30:00Z",
  "customerPhone": "263771234567",
  "signature": "abc123def456ghi789..."
}
```

---

### Pesepay Status Values

| Status Value | Meaning | Action Required |
|--------------|---------|-----------------|
| `SUCCESS` | ✅ Payment successful | Complete order/loan processing |
| `FAILED` | ❌ Payment failed | Notify customer, offer retry |
| `PENDING` | ⏳ Payment pending confirmation | Poll for status or wait for next callback |
| `CANCELLED` | ❌ Customer cancelled | Notify customer |
| `EXPIRED` | ❌ Payment session expired | Create new payment |

---

### Pesepay Signature Verification

**Signature Algorithm**: HMAC-SHA256 (hexadecimal)

**Signature Calculation**:
```javascript
const crypto = require('crypto');

function verifyPesepaySignature(payload, signature, secretKey) {
  // Create HMAC-SHA256 signature of JSON payload
  const data = JSON.stringify(payload);

  const calculatedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(data)
    .digest('hex');

  // Compare signatures
  return calculatedSignature === signature;
}
```

**Example**:
```javascript
const payload = {
  referenceNumber: 'INV-12345',
  transactionReference: 'PSP-789456',
  amount: 50.00,
  currency: 'USD',
  status: 'SUCCESS',
  paymentMethod: 'ECOCASH',
  timestamp: '2025-11-12T10:30:00Z',
  customerPhone: '263771234567'
};

const signature = 'abc123def456ghi789...';
const secretKey = 'YOUR_PESEPAY_SECRET_KEY';

// Calculate signature
const data = JSON.stringify(payload);
const calculatedSignature = crypto
  .createHmac('sha256', secretKey)
  .update(data)
  .digest('hex');

// Verify
if (calculatedSignature === signature) {
  console.log('✅ Valid Pesepay callback');
} else {
  console.log('❌ Invalid signature');
}
```

---

### Pesepay Schema (TypeScript)

```typescript
interface PesepayCallback {
  referenceNumber: string;       // Your merchant reference
  transactionReference: string;  // Pesepay transaction ID
  amount: number;                // Transaction amount (number, not string)
  currency: 'USD' | 'ZWL';       // Currency code
  status: PesepayStatus;         // Payment status
  paymentMethod: PaymentMethod;  // How customer paid
  timestamp: string;             // ISO 8601 timestamp
  customerPhone?: string;        // Optional customer phone
  signature: string;             // HMAC-SHA256 signature
}

type PesepayStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'PENDING'
  | 'CANCELLED'
  | 'EXPIRED';

type PaymentMethod =
  | 'ECOCASH'
  | 'VISA'
  | 'MASTERCARD'
  | 'OMARI';

// JSON Schema
const pesepayCallbackSchema = {
  type: 'object',
  required: ['referenceNumber', 'transactionReference', 'amount', 'currency', 'status', 'paymentMethod', 'timestamp', 'signature'],
  properties: {
    referenceNumber: { type: 'string', minLength: 1 },
    transactionReference: { type: 'string', minLength: 1 },
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', enum: ['USD', 'ZWL'] },
    status: { type: 'string', enum: ['SUCCESS', 'FAILED', 'PENDING', 'CANCELLED', 'EXPIRED'] },
    paymentMethod: { type: 'string', enum: ['ECOCASH', 'VISA', 'MASTERCARD', 'OMARI'] },
    timestamp: { type: 'string', format: 'date-time' },
    customerPhone: { type: 'string', pattern: '^263\\d{9}$' },
    signature: { type: 'string', minLength: 1 }
  }
};
```

---

## 4. ContiPay Callback Schema

### Overview

**ContiPay** supports both JSON and form-encoded callbacks (configurable during merchant setup).

**Content-Type**: `application/json` OR `application/x-www-form-urlencoded`

**HTTP Method**: `POST`

**Endpoint**: Your configured webhook URL

---

### ContiPay Callback Parameters (JSON Format)

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `merchantReference` | String | Yes | Your merchant reference | `INV-12345` |
| `contiPayReference` | String | Yes | ContiPay transaction ID | `CP-123456` |
| `amount` | Number | Yes | Transaction amount | `50.00` |
| `currency` | String | Yes | Currency code | `USD` |
| `status` | String | Yes | Payment status | `COMPLETED`, `FAILED` |
| `paymentChannel` | String | Yes | Payment method | `ECOCASH`, `OMARI`, `VISA` |
| `transactionDate` | String | Yes | ISO 8601 timestamp | `2025-11-12T10:30:00Z` |
| `hash` | String | Yes | MD5 security hash | `abc123...` |

---

### Example ContiPay Callback (JSON)

```json
{
  "merchantReference": "INV-12345",
  "contiPayReference": "CP-123456",
  "amount": 50.00,
  "currency": "USD",
  "status": "COMPLETED",
  "paymentChannel": "ECOCASH",
  "transactionDate": "2025-11-12T10:30:00Z",
  "hash": "abc123def456ghi789..."
}
```

---

### ContiPay Status Values

| Status Value | Meaning | Action Required |
|--------------|---------|-----------------|
| `COMPLETED` | ✅ Payment successful | Complete order/loan processing |
| `FAILED` | ❌ Payment failed | Notify customer, offer retry |
| `PENDING` | ⏳ Payment pending | Wait for confirmation |
| `REVERSED` | ⚠️ Payment reversed/refunded | Handle refund |

---

### ContiPay Hash Verification

**Hash Algorithm**: MD5 (lowercase hexadecimal)

**Hash Calculation**:
```javascript
const crypto = require('crypto');

function verifyContiPayHash(params, secretKey) {
  const { merchantReference, contiPayReference, amount, currency, status, hash } = params;

  // Concatenate parameters
  const data = `${merchantReference}${contiPayReference}${amount}${currency}${status}${secretKey}`;

  // Calculate MD5 hash
  const calculatedHash = crypto
    .createHash('md5')
    .update(data)
    .digest('hex')
    .toLowerCase();

  // Compare hashes
  return calculatedHash === hash.toLowerCase();
}
```

---

## 5. Direct Provider Schemas

### EcoCash Direct (Future)

**Status**: ❌ No public API available

**Expected Format**: Proprietary format (likely JSON or XML)

**When Available**:
- Requires EcoCash merchant partnership
- API documentation provided after approval
- Likely similar to other mobile money APIs (MTN MoMo, M-Pesa)

**Estimated Schema** (based on industry standards):
```json
{
  "transactionId": "EC-123456",
  "merchantReference": "INV-12345",
  "amount": 50.00,
  "currency": "USD",
  "status": "SUCCESSFUL",
  "customerPhone": "263771234567",
  "timestamp": "2025-11-12T10:30:00Z",
  "signature": "..."
}
```

---

### O'mari Direct (Future)

**Status**: ❌ No public API available

**Expected Format**: JSON (modern platform, likely follows REST standards)

**When Available**:
- Requires O'mari merchant account
- Contact Old Mutual Digital Services
- Likely similar to Pesepay format

**Estimated Schema**:
```json
{
  "merchantReference": "INV-12345",
  "omariReference": "OM-789456",
  "amount": 50.00,
  "currency": "USD",
  "status": "COMPLETED",
  "paymentMethod": "OMARI_WALLET",
  "customerPhone": "263774707707",
  "timestamp": "2025-11-12T10:30:00Z",
  "signature": "..."
}
```

---

## 6. Schema Comparison

### Side-by-Side Comparison

| Field | Paynow | Pesepay | ContiPay |
|-------|--------|---------|----------|
| **Format** | URL-encoded | JSON | JSON |
| **Merchant Ref** | `reference` | `referenceNumber` | `merchantReference` |
| **Provider Ref** | `paynowreference` | `transactionReference` | `contiPayReference` |
| **Amount Type** | String | Number | Number |
| **Currency** | ❌ Not included | `currency` | `currency` |
| **Status** | `status` | `status` | `status` |
| **Timestamp** | ❌ Not included | `timestamp` | `transactionDate` |
| **Payment Method** | ❌ Not included | `paymentMethod` | `paymentChannel` |
| **Poll URL** | `pollurl` | ❌ Not included | ❌ Not included |
| **Security** | SHA-512 hash | HMAC-SHA256 | MD5 hash |
| **Customer Info** | ❌ Not included | `customerPhone` | ❌ Not included |

---

### Status Value Mapping

| Paynow | Pesepay | ContiPay | Normalized |
|--------|---------|----------|------------|
| `Paid` | `SUCCESS` | `COMPLETED` | `PAID` |
| `Awaiting Delivery` | `SUCCESS` | `COMPLETED` | `PAID` |
| `Failed` | `FAILED` | `FAILED` | `FAILED` |
| `Cancelled` | `CANCELLED` | ❌ N/A | `CANCELLED` |
| `Created` | `PENDING` | `PENDING` | `PENDING` |
| `Sent` | `PENDING` | `PENDING` | `PENDING` |
| ❌ N/A | `EXPIRED` | ❌ N/A | `EXPIRED` |
| ❌ N/A | ❌ N/A | `REVERSED` | `REFUNDED` |

---

## 7. Security & Validation

### Hash/Signature Algorithms Comparison

| Gateway | Algorithm | Output Format | Key Used |
|---------|-----------|---------------|----------|
| **Paynow** | SHA-512 | Uppercase hex (128 chars) | Integration Key |
| **Pesepay** | HMAC-SHA256 | Lowercase hex (64 chars) | Secret Key |
| **ContiPay** | MD5 | Lowercase hex (32 chars) | Merchant Secret |

---

### Universal Validation Steps

**Step 1: Verify Content-Type**
```javascript
app.post('/webhooks/:provider', (req, res) => {
  const contentType = req.headers['content-type'];

  if (contentType.includes('application/json')) {
    // JSON payload
    const payload = req.body;
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    // Form-encoded payload
    const params = req.body;
  } else {
    return res.status(400).send('Unsupported content type');
  }

  // Continue processing...
});
```

---

**Step 2: Verify Signature/Hash**
```javascript
function verifyCallback(provider, payload, signature, secret) {
  switch (provider) {
    case 'paynow':
      return verifyPaynowHash(payload, signature, secret);
    case 'pesepay':
      return verifyPesepaySignature(payload, signature, secret);
    case 'contipay':
      return verifyContiPayHash(payload, signature, secret);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

---

**Step 3: Validate Schema**
```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

const schemas = {
  paynow: paynowCallbackSchema,
  pesepay: pesepayCallbackSchema,
  contipay: contiPayCallbackSchema
};

function validateCallbackSchema(provider, payload) {
  const schema = schemas[provider];
  const validate = ajv.compile(schema);
  const valid = validate(payload);

  if (!valid) {
    console.error('Schema validation errors:', validate.errors);
    return false;
  }

  return true;
}
```

---

**Step 4: Check Idempotency**
```javascript
async function checkIdempotency(providerRef) {
  const existing = await db.payments.findOne({ providerReference: providerRef });

  if (existing && existing.status === 'paid') {
    // Already processed
    return { processed: true, payment: existing };
  }

  return { processed: false, payment: existing };
}
```

---

**Step 5: Process Callback**
```javascript
async function processCallback(provider, payload) {
  // 1. Verify signature
  if (!verifyCallback(provider, payload, payload.signature || payload.hash, getSecret(provider))) {
    throw new Error('Invalid signature');
  }

  // 2. Validate schema
  if (!validateCallbackSchema(provider, payload)) {
    throw new Error('Invalid schema');
  }

  // 3. Check idempotency
  const { processed, payment } = await checkIdempotency(payload.providerReference || payload.paynowreference);
  if (processed) {
    console.log('Callback already processed');
    return { status: 'already_processed', payment };
  }

  // 4. Normalize data
  const normalized = normalizeCallback(provider, payload);

  // 5. Update database
  await updatePaymentStatus(normalized);

  // 6. Trigger business logic
  await handlePaymentUpdate(normalized);

  return { status: 'success', payment: normalized };
}
```

---

## 8. Error Handling

### Common Callback Errors

| Error | Cause | Solution |
|-------|-------|----------|
| **Invalid Signature** | Wrong secret key or hash algorithm | Verify integration keys in dashboard |
| **Missing Parameters** | Gateway API change or incomplete request | Validate schema, log missing fields |
| **Duplicate Callback** | Gateway retry after temporary failure | Implement idempotency check |
| **Invalid Status** | Unexpected status value | Add default case, log unknown statuses |
| **Timeout** | Processing took too long | Return 200 OK immediately, process async |
| **Database Error** | DB connection failed | Retry with exponential backoff |
| **Unknown Provider** | Invalid provider name in URL | Validate provider parameter |

---

### Error Response Strategy

**Rule**: **Always return 200 OK** once callback is received, even if processing fails

**Why**:
- Prevents gateway from retrying (which causes duplicates)
- You can still log errors and handle them later
- Gateway considers callback delivered

**Example**:
```javascript
app.post('/api/webhooks/:provider', async (req, res) => {
  try {
    // Immediately send 200 OK
    res.status(200).send('OK');

    // Process asynchronously
    processCallback(req.params.provider, req.body).catch(error => {
      console.error('Async callback processing failed:', error);
      // Log to error tracking (Sentry, etc.)
      // Queue for manual review
    });

  } catch (error) {
    // Critical error (couldn't even start processing)
    console.error('Callback handler error:', error);
    res.status(200).send('Error logged');  // Still return 200
  }
});
```

---

### Logging & Monitoring

**Log Every Callback**:
```javascript
async function logCallback(provider, payload, result) {
  await db.callbackLogs.create({
    provider,
    payload: JSON.stringify(payload),
    result: result.status,
    timestamp: new Date(),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
}
```

**Monitor Callback Health**:
- **Success rate**: % of callbacks processed successfully
- **Duplicate rate**: % of callbacks already processed
- **Invalid signature rate**: % of callbacks with bad signatures
- **Processing time**: Average time to process callback

**Alerts**:
- Success rate drops below 95%
- Invalid signature rate > 5% (possible attack)
- Processing time > 5 seconds (performance issue)
- No callbacks received for > 1 hour (gateway issue)

---

## 9. Testing Callbacks

### Local Testing with ngrok

**Problem**: Payment gateways need a public URL to send callbacks, but localhost isn't accessible

**Solution**: Use **ngrok** to expose localhost

**Steps**:
```bash
# 1. Install ngrok
npm install -g ngrok

# 2. Start your local server
node server.js
# Server running on http://localhost:3000

# 3. Start ngrok tunnel
ngrok http 3000
# Forwarding: https://abc123.ngrok.io -> http://localhost:3000

# 4. Configure callback URL in payment gateway
# Paynow resultUrl: https://abc123.ngrok.io/api/webhooks/paynow
# Pesepay webhook: https://abc123.ngrok.io/api/webhooks/pesepay
```

**View Callbacks**:
- Open ngrok dashboard: http://127.0.0.1:4040
- See all HTTP requests in real-time
- Inspect request/response headers and bodies
- Replay requests for testing

---

### Manual Callback Testing

**Simulate Paynow Callback**:
```bash
curl -X POST http://localhost:3000/api/webhooks/paynow \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "reference=TEST-001&paynowreference=123456&amount=50.00&status=Paid&pollurl=https://example.com&hash=ABC123..."
```

**Simulate Pesepay Callback**:
```bash
curl -X POST http://localhost:3000/api/webhooks/pesepay \
  -H "Content-Type: application/json" \
  -d '{
    "referenceNumber": "TEST-001",
    "transactionReference": "PSP-123",
    "amount": 50.00,
    "currency": "USD",
    "status": "SUCCESS",
    "paymentMethod": "ECOCASH",
    "timestamp": "2025-11-12T10:30:00Z",
    "signature": "abc123..."
  }'
```

---

### Automated Callback Tests

```javascript
const request = require('supertest');
const crypto = require('crypto');

describe('Paynow Callback Handler', () => {
  it('should accept valid Paynow callback', async () => {
    const params = {
      reference: 'TEST-001',
      paynowreference: '123456',
      amount: '50.00',
      status: 'Paid',
      pollurl: 'https://example.com'
    };

    // Calculate hash
    const data = params.reference + params.paynowreference + params.amount + params.status + integrationKey;
    params.hash = crypto.createHash('sha512').update(data).digest('hex').toUpperCase();

    // Send callback
    const response = await request(app)
      .post('/api/webhooks/paynow')
      .send(params)
      .expect(200);

    // Verify database updated
    const payment = await db.payments.findOne({ reference: 'TEST-001' });
    expect(payment.status).toBe('paid');
  });

  it('should reject callback with invalid hash', async () => {
    const params = {
      reference: 'TEST-001',
      paynowreference: '123456',
      amount: '50.00',
      status: 'Paid',
      pollurl: 'https://example.com',
      hash: 'INVALID_HASH'
    };

    await request(app)
      .post('/api/webhooks/paynow')
      .send(params)
      .expect(400);
  });
});
```

---

## 10. Implementation Examples

### Unified Callback Handler

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Unified webhook endpoint for all providers
app.post('/api/webhooks/:provider', async (req, res) => {
  const provider = req.params.provider;
  const payload = req.body;

  console.log(`[${provider}] Callback received:`, payload);

  try {
    // 1. Immediately respond 200 OK
    res.status(200).send('OK');

    // 2. Process asynchronously
    await processCallback(provider, payload);

  } catch (error) {
    console.error(`[${provider}] Callback processing error:`, error);
  }
});

async function processCallback(provider, payload) {
  // 1. Verify signature
  if (!verifySignature(provider, payload)) {
    console.error(`[${provider}] Invalid signature`);
    return;
  }

  // 2. Normalize data
  const normalized = normalizeCallback(provider, payload);

  // 3. Check idempotency
  const existing = await db.payments.findOne({ providerReference: normalized.providerReference });
  if (existing && existing.status === 'paid') {
    console.log(`[${provider}] Already processed:`, normalized.merchantReference);
    return;
  }

  // 4. Update payment status
  await db.payments.update(
    { merchantReference: normalized.merchantReference },
    {
      status: normalized.status,
      providerReference: normalized.providerReference,
      amount: normalized.amount,
      updatedAt: new Date()
    }
  );

  // 5. Handle status-specific logic
  if (normalized.status === 'PAID') {
    await handleSuccessfulPayment(normalized);
  } else if (normalized.status === 'FAILED' || normalized.status === 'CANCELLED') {
    await handleFailedPayment(normalized);
  }

  console.log(`[${provider}] Callback processed:`, normalized.merchantReference);
}

function verifySignature(provider, payload) {
  switch (provider) {
    case 'paynow':
      return verifyPaynowHash(payload, process.env.PAYNOW_KEY);
    case 'pesepay':
      return verifyPesepaySignature(payload, process.env.PESEPAY_SECRET);
    case 'contipay':
      return verifyContiPayHash(payload, process.env.CONTIPAY_SECRET);
    default:
      console.error('Unknown provider:', provider);
      return false;
  }
}

function normalizeCallback(provider, payload) {
  switch (provider) {
    case 'paynow':
      return {
        provider: 'paynow',
        merchantReference: payload.reference,
        providerReference: payload.paynowreference,
        amount: parseFloat(payload.amount),
        currency: 'USD',  // Paynow doesn't send currency
        status: normalizeStatus(provider, payload.status),
        timestamp: new Date(),
        pollUrl: payload.pollurl
      };

    case 'pesepay':
      return {
        provider: 'pesepay',
        merchantReference: payload.referenceNumber,
        providerReference: payload.transactionReference,
        amount: payload.amount,
        currency: payload.currency,
        status: normalizeStatus(provider, payload.status),
        paymentMethod: payload.paymentMethod,
        timestamp: new Date(payload.timestamp)
      };

    case 'contipay':
      return {
        provider: 'contipay',
        merchantReference: payload.merchantReference,
        providerReference: payload.contiPayReference,
        amount: payload.amount,
        currency: payload.currency,
        status: normalizeStatus(provider, payload.status),
        paymentMethod: payload.paymentChannel,
        timestamp: new Date(payload.transactionDate)
      };

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function normalizeStatus(provider, status) {
  const statusMap = {
    paynow: {
      'Paid': 'PAID',
      'Awaiting Delivery': 'PAID',
      'Failed': 'FAILED',
      'Cancelled': 'CANCELLED',
      'Created': 'PENDING',
      'Sent': 'PENDING'
    },
    pesepay: {
      'SUCCESS': 'PAID',
      'FAILED': 'FAILED',
      'PENDING': 'PENDING',
      'CANCELLED': 'CANCELLED',
      'EXPIRED': 'EXPIRED'
    },
    contipay: {
      'COMPLETED': 'PAID',
      'FAILED': 'FAILED',
      'PENDING': 'PENDING',
      'REVERSED': 'REFUNDED'
    }
  };

  return statusMap[provider]?.[status] || status;
}

async function handleSuccessfulPayment(payment) {
  const loan = await db.loans.findOne({ reference: payment.merchantReference });

  if (!loan) {
    console.error('Loan not found:', payment.merchantReference);
    return;
  }

  // Update loan
  await db.loans.update(
    { reference: payment.merchantReference },
    {
      depositPaid: true,
      depositAmount: payment.amount,
      status: 'deposit_paid',
      paidAt: new Date()
    }
  );

  // Send WhatsApp notification
  await sendWhatsAppMessage(loan.customerPhone, `
✅ Payment Received!

Amount: $${payment.amount}
Reference: ${payment.merchantReference}

Your deposit has been confirmed. You can now collect your phone from our distributor.
  `.trim());

  // Notify distributor
  await notifyDistributor(loan.distributorId, loan.customerId, loan.phoneModel);

  // Create Fineract loan
  await createFineractLoan(loan);
}

async function handleFailedPayment(payment) {
  const loan = await db.loans.findOne({ reference: payment.merchantReference });

  if (!loan) {
    console.error('Loan not found:', payment.merchantReference);
    return;
  }

  // Update loan
  await db.loans.update(
    { reference: payment.merchantReference },
    { status: 'payment_failed', failureReason: payment.status }
  );

  // Send WhatsApp notification
  await sendWhatsAppMessage(loan.customerPhone, `
❌ Payment ${payment.status}

Reference: ${payment.merchantReference}

Your payment could not be completed. Please try again.

Reply:
1️⃣ RETRY - Try payment again
2️⃣ HELP - Contact support
  `.trim());
}

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

---

## 11. Best Practices

### Security

1. **Always Verify Signatures** - Never trust callback data without verification
2. **Use HTTPS Only** - Never accept callbacks over HTTP
3. **Whitelist IPs** - Only accept callbacks from known gateway IPs (if provided)
4. **Rate Limiting** - Protect against callback flooding attacks
5. **Log Everything** - Keep audit trail of all callbacks

### Performance

1. **Return 200 Immediately** - Don't wait for complex processing
2. **Process Asynchronously** - Use background jobs for slow operations
3. **Implement Idempotency** - Handle duplicate callbacks gracefully
4. **Cache Frequently** - Cache provider secrets, schemas, etc.
5. **Monitor Latency** - Alert if processing time > 5 seconds

### Reliability

1. **Use Both Webhooks and Polling** - Webhooks for speed, polling as fallback
2. **Retry Failed Operations** - Exponential backoff for database errors
3. **Queue Critical Tasks** - Use Bull/BullMQ for reliable job processing
4. **Handle Edge Cases** - Unknown statuses, missing fields, etc.
5. **Test Thoroughly** - Unit tests, integration tests, manual testing

### Maintainability

1. **Normalize Data** - Convert all providers to common format
2. **Abstract Provider Logic** - Single interface for all gateways
3. **Document Schemas** - Keep this doc updated as APIs change
4. **Version Control** - Track schema changes over time
5. **Monitor API Changes** - Subscribe to provider API changelogs

---

## 12. References

### Official Documentation

- **Paynow**: [developers.paynow.co.zw](https://developers.paynow.co.zw)
  - [Notification URLs](https://developers.paynow.co.zw/docs/notification_success_cancel_urls.html)
  - [Status Update](https://developers.paynow.co.zw/docs/status_update.html)

- **Pesepay**: [developers.pesepay.com](https://developers.pesepay.com)

- **ContiPay**: [contipay.co.zw](https://contipay.co.zw)

### Standards & Specifications

- **Standard Webhooks**: [standardwebhooks.com](https://www.standardwebhooks.com/)
- **OpenAPI Webhooks**: [OpenAPI 3.1 Spec](https://spec.openapis.org/oas/v3.1.0#webhook-object)
- **Stripe Webhooks** (reference): [docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)

### Related Lynia Finance Research

- **T013**: EcoCash USSD integration (Paynow gateway)
- **T014**: Omari payment API research
- **T016**: Callback authentication mechanisms (next)

---

## Completion Checklist

- [x] Document Paynow callback schema (URL-encoded format)
- [x] Document Pesepay callback schema (JSON format)
- [x] Document ContiPay callback schema
- [x] Compare callback schemas across providers
- [x] Document security verification methods (SHA-512, HMAC-SHA256, MD5)
- [x] Provide signature verification examples
- [x] Document status value mappings
- [x] Create TypeScript interfaces for all schemas
- [x] Provide JSON Schema definitions for validation
- [x] Document error handling strategies
- [x] Provide testing strategies (ngrok, manual, automated)
- [x] Create unified callback handler implementation
- [x] Document normalization patterns
- [x] List best practices for security, performance, reliability
- [x] Compile references and official documentation links

---

## Key Takeaways

1. **Paynow uses URL-encoded** format, Pesepay/ContiPay use JSON
2. **Always verify signatures** - different algorithms per provider
3. **Return 200 OK immediately** - process asynchronously
4. **Normalize all callbacks** to common format for easier handling
5. **Implement idempotency** - handle duplicate callbacks gracefully
6. **Use webhooks + polling** - best reliability with both approaches
7. **Test with ngrok** for local development
8. **Log everything** - callbacks are critical for debugging
9. **Monitor callback health** - success rate, duplicates, invalid signatures
10. **Status values differ** - map to normalized values (PAID, FAILED, etc.)

---

## Next Steps

1. ✅ **Complete**: T013 (EcoCash/Paynow), T014 (Omari), T015 (Callback schemas)
2. **Proceed to T016**: Document callback authentication mechanisms (HMAC, API keys)
3. **Proceed to T017**: Document callback retry strategies from gateway side
4. **Phase 1 Implementation**: Build unified webhook handler for all providers
5. **Testing**: Set up ngrok, test with sandbox callbacks
6. **Monitoring**: Implement callback logging and health dashboards

---

**Research Status**: ✅ Complete
**Ready for Implementation**: Yes
**Blocker**: None
**Recommendation**: Implement unified webhook handler that supports all 3 gateways (Paynow, Pesepay, ContiPay) with proper signature verification and normalization.
