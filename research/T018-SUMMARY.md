# T018: Identify Sandbox/Test Environments for EcoCash and Omari

## Research Context

**Task**: Identify sandbox/test environments for EcoCash and Omari
**Date**: 2025-01-13
**Status**: Complete

This research documents available sandbox/test environments for testing mobile money integrations in Zimbabwe, specifically for EcoCash and O'mari. This guide prepares Lynia Finance for when direct API access is granted.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [EcoCash Sandbox Environment](#ecocash-sandbox-environment)
3. [O'mari Test Environment](#omari-test-environment)
4. [Zimbabwe Fintech Regulatory Sandbox](#zimbabwe-fintech-regulatory-sandbox)
5. [Paynow Test Mode (Gateway Alternative)](#paynow-test-mode-gateway-alternative)
6. [Testing Best Practices](#testing-best-practices)
7. [Test Credentials Management](#test-credentials-management)
8. [Integration Testing Workflow](#integration-testing-workflow)
9. [Production Readiness Checklist](#production-readiness-checklist)

---

## Executive Summary

### Key Findings

**EcoCash Sandbox**:
- Official developer portal exists at `developers.ecocash.co.zw`
- Sandbox access requires merchant account approval
- API access currently limited to selected partners
- No publicly available test credentials documented
- Must apply for merchant account first, then request API access

**O'mari Test Environment**:
- No publicly documented sandbox or test environment found
- Launched May 2023, still building developer ecosystem
- API access requires direct partnership with Old Mutual Zimbabwe
- Contact required: `omari@oldmutual.co.zw`

**Alternative Testing Options**:
1. **Zimbabwe Fintech Regulatory Sandbox** - RBZ-supervised testing environment (24-month max)
2. **Paynow Test Mode** - Gateway with pre-configured test phone numbers
3. **Mock/Simulation** - Build mock APIs based on expected schemas

### Testing Strategy for Lynia Finance

**Phase 1: Pre-API Access** (Current)
- Use Paynow test mode for EcoCash/OneMoney flow testing
- Build mock APIs based on expected schemas
- Test webhook handlers, retry logic, authentication

**Phase 2: API Access Granted** (Future)
- Request sandbox credentials from EcoCash and O'mari
- Conduct integration testing in sandbox
- Verify all transaction flows (success, failure, timeout)
- Load testing with simulated volumes

**Phase 3: Production Deployment**
- Pilot with small user group (10-20 loans)
- Monitor all transactions closely
- Gradual rollout to full production

---

## EcoCash Sandbox Environment

### Developer Portal

**URL**: `https://developers.ecocash.co.zw`

**Current Status**:
- Portal exists but requires JavaScript (modern web application)
- Access controlled - not fully public
- Historically limited to selected developers
- Documentation not publicly indexed

### Access Requirements

To access EcoCash sandbox environment, you must:

1. **Become a Merchant**
   - Apply for EcoCash merchant account
   - Submit required documents:
     - Trading license
     - National ID
     - Proof of residence
     - Passport-size photo
     - Company registration (CR6 for businesses)

2. **Request API Access**
   - Apply to be an Online Merchant (subject to approval)
   - Receive merchant ID and PIN upon approval

3. **Request Sandbox Credentials**
   - Contact EcoCash business team
   - Request sandbox/test environment access
   - Receive sandbox API credentials

**Contact Information**:
```
Customer Helpline: 114 or +263 772 023 000
Business Line: +263 4 486121/66
WhatsApp: +263 771 222 904
Email: ecocashhelp@econet.co.zw
Developer Portal: developers.ecocash.co.zw
Self-Service Portal: partnerapplications.ecocash.co.zw
```

### Expected API Structure

Based on industry standards and available documentation fragments, the EcoCash API likely follows this structure:

**Base URL** (Sandbox - Expected):
```
https://sandbox.ecocash.co.zw/api/v1
or
https://api-test.ecocash.co.zw/v1
```

**Base URL** (Production - Expected):
```
https://api.ecocash.co.zw/v1
```

**Authentication** (Expected):
```http
POST /auth/token
Content-Type: application/json

{
  "merchantId": "SANDBOX_MERCHANT_001",
  "apiKey": "sandbox_key_xxxxx",
  "apiSecret": "sandbox_secret_xxxxx"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

**Payment Initiation** (Expected):
```http
POST /payments/initiate
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "merchantId": "SANDBOX_MERCHANT_001",
  "merchantReference": "LOAN-INV-12345",
  "customerPhone": "263771111111",
  "amount": 50.00,
  "currency": "USD",
  "description": "Phone deposit - Samsung A14",
  "callbackUrl": "https://lynia.co.zw/api/webhooks/ecocash"
}

Response:
{
  "transactionId": "ECOCASH-TXN-67890",
  "status": "PENDING",
  "merchantReference": "LOAN-INV-12345",
  "pollUrl": "https://sandbox.ecocash.co.zw/api/v1/payments/ECOCASH-TXN-67890",
  "message": "USSD prompt sent to customer"
}
```

**Transaction Status Query** (Expected):
```http
GET /payments/{transactionId}
Authorization: Bearer {accessToken}

Response:
{
  "transactionId": "ECOCASH-TXN-67890",
  "merchantReference": "LOAN-INV-12345",
  "status": "PAID",
  "amount": 50.00,
  "currency": "USD",
  "customerPhone": "263771111111",
  "completedAt": "2025-01-13T14:30:00Z"
}
```

**Webhook Callback** (Expected):
```http
POST https://lynia.co.zw/api/webhooks/ecocash
Content-Type: application/json
X-Signature: {hmac-sha256-signature}
X-Webhook-Id: {unique-webhook-id}
X-Webhook-Timestamp: {unix-timestamp}

{
  "transactionId": "ECOCASH-TXN-67890",
  "merchantReference": "LOAN-INV-12345",
  "status": "PAID",
  "amount": 50.00,
  "currency": "USD",
  "customerPhone": "263771111111",
  "completedAt": "2025-01-13T14:30:00Z",
  "fee": 0.50,
  "netAmount": 49.50
}
```

### Test Phone Numbers (Expected)

Based on industry standards, sandbox environments typically provide:

**Success Scenarios**:
```
263771111111 - Immediate success
263771111112 - Success after 30 seconds (delayed)
263771111113 - Success after 2 minutes (very delayed)
```

**Failure Scenarios**:
```
263772222221 - User cancelled transaction
263772222222 - Insufficient balance
263772222223 - Transaction timeout
263772222224 - Invalid PIN
263772222225 - Account suspended
```

**Edge Cases**:
```
263773333331 - Network error (retry scenario)
263773333332 - Pending indefinitely (timeout test)
263773333333 - Duplicate transaction error
```

**Note**: These are expected patterns based on industry standards. Actual test numbers will be provided by EcoCash upon sandbox access.

### Sandbox Features (Expected)

1. **Transaction Simulation**
   - Instant success/failure (no actual USSD prompt)
   - Configurable delays for testing retry logic
   - Webhook delivery simulation

2. **No Real Money Movement**
   - All transactions are simulated
   - Balances are virtual
   - No actual customer accounts affected

3. **Full API Feature Parity**
   - All production endpoints available
   - Same request/response schemas
   - Same authentication mechanisms

4. **Enhanced Testing Tools** (Possible)
   - Dashboard to view all test transactions
   - Manual webhook retry
   - Transaction status override
   - Error simulation controls

---

## O'mari Test Environment

### Current Status

**Limited Public Information**:
- O'mari launched May 2023 (relatively new)
- No publicly documented API or sandbox
- Focus on consumer app and USSD (*707#)
- Developer ecosystem still maturing

**Expected Development Timeline**:
- Q1-Q2 2025: Partner API programs likely expanding
- Q3-Q4 2025: Possible public developer portal

### Access Process

**Step 1: Establish Merchant Relationship**

Contact O'mari merchant services:
```
Email: omari@oldmutual.co.zw, contactus@oldmutual.co.zw
Phone: 0719433433, 0780040219
Toll-Free: 433 or 466
WhatsApp: 0774 707 707
Address: 100 The Chase, Emerald Hill, Harare
```

**Step 2: Submit Merchant Application**

Required documents:
- Board Resolution (for companies)
- CR6 (certified copy)
- Tax clearance certificate
- Bank statements (3 months)
- Trading shop license
- Director IDs and proof of residence
- List of all branches (if applicable)

**Step 3: Request API Access**

After merchant approval, request:
- API integration partnership
- Sandbox environment access
- Technical documentation
- Test credentials

**Processing Time**: 4-6 weeks (merchant approval + API access)

### Expected API Structure

Based on modern fintech standards and Old Mutual's technology profile:

**Base URL** (Sandbox - Expected):
```
https://sandbox-api.omari.co.zw/v1
or
https://test-api.omari.co.zw/v1
```

**Base URL** (Production - Expected):
```
https://api.omari.co.zw/v1
```

**Authentication** (Expected - OAuth 2.0):
```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=sandbox_client_xxxxx
&client_secret=sandbox_secret_xxxxx
&scope=payments:initiate payments:query

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "payments:initiate payments:query"
}
```

**Payment Initiation** (Expected):
```http
POST /payments
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "merchantCode": "LYNIA001",
  "reference": "LOAN-INV-12345",
  "customer": {
    "phoneNumber": "263774444444",
    "name": "John Doe"
  },
  "amount": {
    "value": 50.00,
    "currency": "USD"
  },
  "description": "Phone deposit - Samsung A14",
  "callbackUrl": "https://lynia.co.zw/api/webhooks/omari",
  "metadata": {
    "loanId": "LOAN-12345",
    "customerId": "CUST-67890"
  }
}

Response:
{
  "paymentId": "OMARI-PAY-123456",
  "merchantReference": "LOAN-INV-12345",
  "status": "PENDING",
  "statusUrl": "https://sandbox-api.omari.co.zw/v1/payments/OMARI-PAY-123456",
  "expiresAt": "2025-01-13T15:00:00Z",
  "createdAt": "2025-01-13T14:30:00Z"
}
```

**Payment Status Query** (Expected):
```http
GET /payments/{paymentId}
Authorization: Bearer {access_token}

Response:
{
  "paymentId": "OMARI-PAY-123456",
  "merchantReference": "LOAN-INV-12345",
  "status": "COMPLETED",
  "amount": {
    "value": 50.00,
    "currency": "USD"
  },
  "customer": {
    "phoneNumber": "263774444444",
    "accountName": "John Doe"
  },
  "completedAt": "2025-01-13T14:35:00Z",
  "fees": {
    "merchantFee": 0.00,
    "customerFee": 0.00
  },
  "netAmount": 50.00
}
```

**Webhook Callback** (Expected):
```http
POST https://lynia.co.zw/api/webhooks/omari
Content-Type: application/json
Authorization: Bearer {webhook_token}
X-Omari-Signature: {hmac-sha256-signature}
X-Webhook-Id: {unique-webhook-id}
X-Timestamp: {iso8601-timestamp}

{
  "eventType": "payment.completed",
  "eventId": "evt_123456789",
  "timestamp": "2025-01-13T14:35:00Z",
  "data": {
    "paymentId": "OMARI-PAY-123456",
    "merchantReference": "LOAN-INV-12345",
    "status": "COMPLETED",
    "amount": {
      "value": 50.00,
      "currency": "USD"
    },
    "customer": {
      "phoneNumber": "263774444444"
    },
    "completedAt": "2025-01-13T14:35:00Z"
  }
}
```

### Test Phone Numbers (Expected)

**Success Scenarios**:
```
263774444441 - Immediate success
263774444442 - Delayed success (30 seconds)
263774444443 - Delayed success (2 minutes)
```

**Failure Scenarios**:
```
263775555551 - User cancelled
263775555552 - Insufficient balance
263775555553 - Transaction timeout
263775555554 - Invalid account
263775555555 - Daily limit exceeded
```

**Note**: These are expected patterns. Actual test credentials will be provided by O'mari upon sandbox access.

---

## Zimbabwe Fintech Regulatory Sandbox

### Overview

The **Zimbabwe Fintech Regulatory Sandbox** is a formal testing environment established by the Reserve Bank of Zimbabwe (RBZ) in March 2021.

**Purpose**: Controlled environment with regulatory oversight for testing fintech products and services.

**Regulatory Authority**: National Fintech Steering Committee (NFSC) + Reserve Bank of Zimbabwe

**Official Documentation**: [RBZ Fintech Regulatory Sandbox Guidelines](https://www.rbz.co.zw/documents/BLSS/Fintech/FINTECH-REGULATORY-SANDBOX-GUIDELINES.pdf)

### Eligibility

**Eligible Products/Services**:
- ✅ Application Programming Interfaces (APIs)
- ✅ Mobile money services
- ✅ Retail payments
- ✅ Cybersecurity products
- ✅ Crowdfunding platforms
- ✅ Regulatory technology (RegTech)
- ✅ Digital lending platforms ← **Lynia Finance qualifies**

**Prohibited**:
- ❌ Cryptocurrency
- ❌ Digital currency (not CBDC)
- ❌ Central Bank Digital Currency (CBDC) - reserved for RBZ

### Testing Phases

**1. Pre-Application**
- Review eligibility criteria
- Prepare documentation
- Understand regulatory requirements

**2. Application and Evaluation**
- Submit online application via RBZ portal
- Provide detailed product description
- Risk assessment and mitigation plans
- Expected outcomes and KPIs

**3. Testing Stage** (Max 24 months)
- Deploy solution in controlled environment
- Limited user base (defined in application)
- Regular reporting to NFSC
- Compliance monitoring

**4. Exit and Deployment**
- Final evaluation
- Full regulatory approval (if successful)
- Production deployment authorization
- Transition to BAU (Business as Usual)

### Application Process

**Step 1: Online Registration**
```
Portal: https://frs.rbz.co.zw/ (Fintech Regulatory Sandbox)
```

**Step 2: Submit Application**

Required information:
- Company details and registration
- Product/service description
- Technical architecture
- Target market and user numbers
- Risk assessment
- Consumer protection measures
- Data privacy and security measures
- Testing plan (timeline, milestones, KPIs)
- Exit strategy

**Step 3: Evaluation** (4-8 weeks)
- NFSC reviews application
- Technical assessment
- Risk evaluation
- Regulatory compliance check

**Step 4: Approval or Rejection**
- Written decision with reasons
- If approved: Testing conditions and requirements
- If rejected: Feedback and reapplication guidance

### Benefits for Lynia Finance

1. **Regulatory Clarity**
   - Clear testing parameters
   - Direct engagement with RBZ
   - Compliance guidance

2. **Market Credibility**
   - RBZ endorsement
   - Increased investor confidence
   - Easier partnerships (banks, mobile money providers)

3. **Controlled Risk**
   - Limited user exposure
   - Supervised testing
   - Fail-safe mechanisms

4. **Path to Full Licensing**
   - Streamlined approval post-sandbox
   - Regulatory relationships established

### Current Statistics (2024)

- **Total Registrations**: 112
- **Applications at Various Stages**: 31
- **Sectors**:
  - Software & Systems Development: 48%
  - Payments: 18%
  - Capital Raising: 7%
  - Investment Management: 4%
  - Other: 23%

### Recommendation for Lynia Finance

**Consider RBZ Sandbox if**:
- You want formal regulatory endorsement
- Seeking partnerships with regulated institutions
- Planning to raise investment capital
- Building long-term credibility

**Skip RBZ Sandbox if**:
- Need faster time-to-market (24-month max is limiting)
- Already have API partnerships secured
- Low regulatory risk profile
- Prefer private beta testing

---

## Paynow Test Mode (Gateway Alternative)

### Overview

**Paynow** is Zimbabwe's leading payment gateway, supporting EcoCash, OneMoney, TeleCash, Visa/MasterCard, and Zimswitch.

**Developer Hub**: `https://developers.paynow.co.zw`

While Lynia Finance plans direct EcoCash/O'mari integration, Paynow's test mode is useful for:
- Testing payment flows before API access
- Understanding mobile money UX
- Validating webhook handlers
- Load testing payment processing logic

### Test Mode Access

**How to Access**:
1. Create Paynow merchant account: `https://www.paynow.co.zw`
2. Navigate to Integrations section
3. Create new integration (automatically starts in test mode)
4. Receive integration ID and key

**No Approval Required**: Test mode is immediately available.

### Test Credentials

#### Mobile Money Test Phone Numbers

**EcoCash / OneMoney Test Numbers**:

| Phone Number | Scenario | Expected Result |
|--------------|----------|-----------------|
| `0771111111` | Success | Payment completes immediately |
| `0772222222` | Delayed Success | Payment completes after delay |
| `0773333333` | User Cancelled | Customer cancels payment |
| `0774444444` | Insufficient Balance | Not enough funds error |

**Important**: The `authemail` field must match the email used to create the integration.

#### Card Payments Test Tokens

**Visa/MasterCard Tokens**:

| Token | Scenario |
|-------|----------|
| `{11111111-1111-1111-1111-111111111111}` | Success |
| `{22222222-2222-2222-2222-222222222222}` | Pending |
| `{33333333-3333-3333-3333-333333333333}` | Cancelled |
| `{44444444-4444-4444-4444-444444444444}` | Insufficient Balance |

#### Zimswitch Test Tokens

**32-Character Tokens**:

| Token | Scenario |
|-------|----------|
| `11111111111111111111111111111111` | Success |
| `22222222222222222222222222222222` | Pending |
| `33333333333333333333333333333333` | Cancelled |
| `44444444444444444444444444444444` | Insufficient Balance |

### Using Test Mode

**Node.js Example**:
```javascript
const { Paynow } = require('paynow');

// Test mode credentials
const paynow = new Paynow('INTEGRATION_ID', 'INTEGRATION_KEY');
paynow.resultUrl = 'https://lynia.co.zw/api/webhooks/paynow';
paynow.returnUrl = 'https://lynia.co.zw/payment/status';

// Create payment
const payment = paynow.createPayment('TEST-INV-001', 'test@lynia.co.zw');
payment.add('Samsung A14 Deposit', 50.00);

// Send to test phone number
paynow.sendMobile(payment, '0771111111', 'ecocash')
  .then(response => {
    if (response.success) {
      console.log('Test payment initiated');
      console.log('Poll URL:', response.pollUrl);

      // In test mode, no actual USSD sent
      // Login to Paynow and select "Faked Success"
    }
  });
```

### Test Mode Workflow

1. **Initiate Payment**: Use SDK or API to create payment
2. **Login to Paynow**: Use merchant account that created integration
3. **View Pending Payment**: See payment in dashboard
4. **Simulate Result**: Click "TESTING: Faked Success" or "TESTING: Faked Failure"
5. **Receive Webhook**: Paynow sends callback to your `resultUrl`
6. **Verify Handling**: Confirm your system processed callback correctly

### Limitations

- No actual USSD prompt sent to customer
- Must manually trigger success/failure via dashboard
- Cannot test real customer experience
- Single merchant account controls all test payments

### Going Live

**Requirements**:
1. Complete at least **1 successful test transaction**
2. Navigate to Integration Keys section
3. Click "Request to Go Live"
4. Paynow support verifies test completion
5. Integration activated for production (24-48 hours)

**Production Differences**:
- Real USSD prompts sent to customers
- Actual money movement
- Real webhook delivery (with retries)
- Transaction fees apply

---

## Testing Best Practices

### 1. Comprehensive Test Scenarios

**Success Paths**:
```javascript
const successTests = [
  {
    name: 'Immediate Success',
    phone: '263771111111',
    expected: 'PAID',
    timeout: 30000 // 30 seconds
  },
  {
    name: 'Delayed Success',
    phone: '263772222222',
    expected: 'PAID',
    timeout: 120000 // 2 minutes
  }
];
```

**Failure Paths**:
```javascript
const failureTests = [
  {
    name: 'User Cancelled',
    phone: '263773333333',
    expected: 'CANCELLED',
    errorCode: 'USER_CANCELLED'
  },
  {
    name: 'Insufficient Balance',
    phone: '263774444444',
    expected: 'FAILED',
    errorCode: 'INSUFFICIENT_FUNDS'
  },
  {
    name: 'Transaction Timeout',
    phone: '263775555555',
    expected: 'TIMEOUT',
    timeout: 300000 // 5 minutes
  }
];
```

**Edge Cases**:
```javascript
const edgeCaseTests = [
  {
    name: 'Duplicate Payment',
    reference: 'DUPLICATE-001',
    attempts: 2,
    expected: 'Second attempt rejected'
  },
  {
    name: 'Expired Payment',
    delay: 900000, // Wait 15 minutes before paying
    expected: 'EXPIRED'
  },
  {
    name: 'Webhook Retry',
    webhookResponse: 500, // Return 500 error
    expected: 'Webhook retried 7 times'
  }
];
```

### 2. Load Testing

**Simulate Production Volume**:
```javascript
const loadTest = {
  scenario: 'Peak Daily Volume',
  duration: 3600000, // 1 hour
  ratePerSecond: 2, // 2 payments/second = 7,200/hour
  concurrentUsers: 100,
  expectedSuccessRate: 0.98 // 98%
};

// Use tools like Artillery, k6, or JMeter
```

**Artillery Configuration** (`load-test.yml`):
```yaml
config:
  target: 'https://sandbox.ecocash.co.zw'
  phases:
    - duration: 300 # 5 minutes warm-up
      arrivalRate: 1
      name: "Warm up"
    - duration: 1800 # 30 minutes sustained load
      arrivalRate: 2
      name: "Sustained load"
    - duration: 300 # 5 minutes spike
      arrivalRate: 10
      name: "Spike test"

scenarios:
  - name: "Payment Flow"
    flow:
      - post:
          url: "/api/v1/payments/initiate"
          json:
            merchantId: "{{ $randomString() }}"
            amount: 50
            phone: "263771111111"
          capture:
            - json: "$.transactionId"
              as: "txnId"
      - think: 30 # Wait 30 seconds
      - get:
          url: "/api/v1/payments/{{ txnId }}"
          expect:
            - statusCode: 200
```

### 3. Security Testing

**Authentication Tests**:
```javascript
// Test invalid API key
await expect(
  initiatePayment({ apiKey: 'INVALID' })
).rejects.toThrow('Unauthorized');

// Test expired token
await expect(
  initiatePayment({ token: 'EXPIRED_TOKEN' })
).rejects.toThrow('Token expired');

// Test missing signature
await expect(
  processWebhook({ signature: null })
).rejects.toThrow('Missing signature');
```

**Webhook Security Tests**:
```javascript
// Test invalid HMAC signature
const invalidWebhook = {
  ...validPayload,
  signature: 'INVALID_SIGNATURE'
};
const result = await processWebhook(invalidWebhook);
expect(result.status).toBe(401);

// Test replay attack (old timestamp)
const oldWebhook = {
  ...validPayload,
  timestamp: Date.now() - 10 * 60 * 1000 // 10 minutes ago
};
const result2 = await processWebhook(oldWebhook);
expect(result2.status).toBe(400);

// Test duplicate webhook ID
await processWebhook(validPayload); // First time
const result3 = await processWebhook(validPayload); // Duplicate
expect(result3.status).toBe(200); // Accept but don't reprocess
```

### 4. Integration Testing

**End-to-End Flow**:
```javascript
describe('Loan Payment Flow', () => {
  it('should complete full customer journey', async () => {
    // 1. Customer applies for loan
    const loan = await applyForLoan({
      phoneModel: 'Samsung A14',
      downPayment: 50,
      customerPhone: '263771234567'
    });
    expect(loan.status).toBe('APPROVED');

    // 2. Generate payment link
    const payment = await initiatePayment({
      amount: loan.downPayment,
      reference: loan.invoiceNumber,
      customerPhone: loan.customerPhone
    });
    expect(payment.status).toBe('PENDING');

    // 3. Customer pays (simulated)
    await simulateCustomerPayment(payment.transactionId, '0771111111');

    // 4. Webhook received
    await waitForWebhook(payment.transactionId, 30000);

    // 5. Loan status updated
    const updatedLoan = await getLoan(loan.id);
    expect(updatedLoan.depositStatus).toBe('PAID');
    expect(updatedLoan.status).toBe('DEVICE_PENDING');

    // 6. WhatsApp confirmation sent
    const messages = await getWhatsAppMessages(loan.customerPhone);
    expect(messages).toContainMatch(/Payment received.*50.*USD/);
  });
});
```

### 5. Monitoring and Logging

**Test Environment Logging**:
```javascript
const logger = {
  payment: (event, data) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: 'sandbox',
      event: event,
      ...data
    }));
  }
};

// Log all payment events
logger.payment('initiated', {
  transactionId: 'TXN-001',
  amount: 50,
  phone: '263771111111'
});

logger.payment('webhook_received', {
  transactionId: 'TXN-001',
  status: 'PAID',
  duration: 45000 // 45 seconds
});
```

---

## Test Credentials Management

### Environment Variables

**`.env.test`** (Sandbox):
```bash
# EcoCash Sandbox
ECOCASH_SANDBOX_URL=https://sandbox.ecocash.co.zw/api/v1
ECOCASH_SANDBOX_MERCHANT_ID=SANDBOX_MERCHANT_001
ECOCASH_SANDBOX_API_KEY=sandbox_key_xxxxx
ECOCASH_SANDBOX_API_SECRET=sandbox_secret_xxxxx
ECOCASH_SANDBOX_WEBHOOK_SECRET=sandbox_webhook_secret_xxxxx

# O'mari Sandbox
OMARI_SANDBOX_URL=https://sandbox-api.omari.co.zw/v1
OMARI_SANDBOX_CLIENT_ID=sandbox_client_xxxxx
OMARI_SANDBOX_CLIENT_SECRET=sandbox_secret_xxxxx
OMARI_SANDBOX_WEBHOOK_SECRET=sandbox_webhook_secret_xxxxx

# Paynow Test Mode
PAYNOW_INTEGRATION_ID=12345
PAYNOW_INTEGRATION_KEY=test-key-xxxxx
PAYNOW_RESULT_URL=https://lynia-test.co.zw/api/webhooks/paynow
PAYNOW_RETURN_URL=https://lynia-test.co.zw/payment/status

# Test Phone Numbers
TEST_PHONE_SUCCESS=263771111111
TEST_PHONE_DELAYED=263772222222
TEST_PHONE_CANCELLED=263773333333
TEST_PHONE_INSUFFICIENT=263774444444
```

**`.env.production`**:
```bash
# EcoCash Production
ECOCASH_PRODUCTION_URL=https://api.ecocash.co.zw/v1
ECOCASH_PRODUCTION_MERCHANT_ID=LYNIA001
ECOCASH_PRODUCTION_API_KEY=prod_key_xxxxx
ECOCASH_PRODUCTION_API_SECRET=prod_secret_xxxxx
ECOCASH_PRODUCTION_WEBHOOK_SECRET=prod_webhook_secret_xxxxx

# O'mari Production
OMARI_PRODUCTION_URL=https://api.omari.co.zw/v1
OMARI_PRODUCTION_CLIENT_ID=prod_client_xxxxx
OMARI_PRODUCTION_CLIENT_SECRET=prod_secret_xxxxx
OMARI_PRODUCTION_WEBHOOK_SECRET=prod_webhook_secret_xxxxx
```

### Credential Rotation

**Best Practices**:
```javascript
class CredentialManager {
  constructor() {
    this.credentials = new Map();
    this.rotationSchedule = 90 * 24 * 60 * 60 * 1000; // 90 days
  }

  async rotateApiKey(provider) {
    console.log(`Rotating API key for ${provider}`);

    // 1. Generate new key
    const newKey = await provider.generateApiKey();

    // 2. Support both old and new keys during transition
    this.credentials.set(`${provider}_current`, this.credentials.get(provider));
    this.credentials.set(`${provider}_new`, newKey);

    // 3. Update application to use new key
    process.env[`${provider}_API_KEY`] = newKey;

    // 4. Wait 24 hours (grace period)
    setTimeout(() => {
      // 5. Revoke old key
      this.credentials.delete(`${provider}_current`);
      console.log(`Old API key revoked for ${provider}`);
    }, 24 * 60 * 60 * 1000);
  }

  scheduleRotation(provider) {
    setInterval(() => {
      this.rotateApiKey(provider);
    }, this.rotationSchedule);
  }
}
```

### Secrets Management

**AWS Secrets Manager** (Recommended):
```javascript
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: 'af-south-1' });

async function getCredentials(environment) {
  const secretName = `lynia/payments/${environment}`;

  const secret = await secretsManager.getSecretValue({
    SecretId: secretName
  }).promise();

  return JSON.parse(secret.SecretString);
}

// Usage
const credentials = await getCredentials('sandbox');
const ecocashApiKey = credentials.ECOCASH_API_KEY;
```

**Supabase Vault** (Alternative):
```sql
-- Store secrets in Supabase Vault
INSERT INTO vault.secrets (name, secret)
VALUES ('ecocash_sandbox_api_key', 'sandbox_key_xxxxx');

-- Retrieve in application
SELECT decrypted_secret
FROM vault.decrypted_secrets
WHERE name = 'ecocash_sandbox_api_key';
```

---

## Integration Testing Workflow

### Step-by-Step Testing Process

**Phase 1: Mock Testing** (Week 1-2)
```
Day 1-3: Build mock EcoCash/O'mari APIs
Day 4-7: Test webhook handlers against mocks
Day 8-10: Test retry logic, circuit breakers
Day 11-14: Integration tests with Fineract, WhatsApp
```

**Phase 2: Paynow Testing** (Week 3-4)
```
Day 15-16: Setup Paynow test integration
Day 17-19: Test all payment scenarios
Day 20-21: Load testing (100-500 transactions)
Day 22-24: Security testing
Day 25-28: End-to-end flow testing
```

**Phase 3: Sandbox Testing** (Week 5-8) - *After API access granted*
```
Week 5: EcoCash sandbox integration
Week 6: O'mari sandbox integration
Week 7: Combined testing (both providers)
Week 8: Production readiness verification
```

**Phase 4: Pilot Production** (Week 9-12)
```
Week 9: Deploy to production, 10 customers
Week 10: Expand to 50 customers
Week 11: Expand to 200 customers
Week 12: Full production release
```

### Mock API Development

**Mock EcoCash Server** (`mock-ecocash.js`):
```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Mock transaction storage
const transactions = new Map();

// Authenticate
app.post('/auth/token', (req, res) => {
  const { merchantId, apiKey } = req.body;

  if (apiKey !== 'sandbox_key_xxxxx') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    accessToken: 'mock_access_token_' + Date.now(),
    tokenType: 'Bearer',
    expiresIn: 3600
  });
});

// Initiate payment
app.post('/payments/initiate', (req, res) => {
  const { customerPhone, amount, merchantReference } = req.body;

  const transactionId = 'ECOCASH-TXN-' + Date.now();

  // Simulate based on phone number
  let status = 'PENDING';
  let delay = 0;

  if (customerPhone === '263771111111') {
    status = 'PAID';
    delay = 0; // Immediate
  } else if (customerPhone === '263772222222') {
    status = 'PAID';
    delay = 30000; // 30 seconds
  } else if (customerPhone === '263773333333') {
    status = 'CANCELLED';
    delay = 10000; // 10 seconds
  } else if (customerPhone === '263774444444') {
    status = 'FAILED';
    delay = 5000; // 5 seconds
  }

  transactions.set(transactionId, {
    transactionId,
    merchantReference,
    customerPhone,
    amount,
    status: 'PENDING',
    createdAt: new Date()
  });

  // Simulate async payment processing
  setTimeout(async () => {
    const txn = transactions.get(transactionId);
    txn.status = status;
    txn.completedAt = new Date();

    // Send webhook
    await sendWebhook(txn);
  }, delay);

  res.json({
    transactionId,
    status: 'PENDING',
    merchantReference,
    pollUrl: `http://localhost:3000/payments/${transactionId}`,
    message: 'USSD prompt sent to customer'
  });
});

// Query payment status
app.get('/payments/:transactionId', (req, res) => {
  const txn = transactions.get(req.params.transactionId);

  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json(txn);
});

// Send webhook to callback URL
async function sendWebhook(txn) {
  const callbackUrl = 'http://localhost:8080/api/webhooks/ecocash';

  const payload = {
    transactionId: txn.transactionId,
    merchantReference: txn.merchantReference,
    status: txn.status,
    amount: txn.amount,
    customerPhone: txn.customerPhone,
    completedAt: txn.completedAt
  };

  const signature = crypto
    .createHmac('sha256', 'sandbox_webhook_secret_xxxxx')
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    await axios.post(callbackUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Webhook-Id': crypto.randomBytes(16).toString('hex'),
        'X-Webhook-Timestamp': Date.now().toString()
      }
    });
    console.log('Webhook sent:', txn.transactionId);
  } catch (error) {
    console.error('Webhook failed:', error.message);
  }
}

app.listen(3000, () => {
  console.log('Mock EcoCash API running on http://localhost:3000');
});
```

### Automated Test Suite

**Jest Test Suite** (`payment.test.js`):
```javascript
const { initiatePayment, getPaymentStatus } = require('../services/payment');

describe('Payment Integration Tests', () => {
  describe('EcoCash Payments', () => {
    it('should process successful payment', async () => {
      const payment = await initiatePayment({
        provider: 'ecocash',
        amount: 50,
        phone: '263771111111',
        reference: 'TEST-001'
      });

      expect(payment.transactionId).toBeDefined();
      expect(payment.status).toBe('PENDING');

      // Wait for webhook
      await new Promise(resolve => setTimeout(resolve, 5000));

      const status = await getPaymentStatus(payment.transactionId);
      expect(status.status).toBe('PAID');
    });

    it('should handle insufficient balance', async () => {
      const payment = await initiatePayment({
        provider: 'ecocash',
        amount: 50,
        phone: '263774444444',
        reference: 'TEST-002'
      });

      await new Promise(resolve => setTimeout(resolve, 10000));

      const status = await getPaymentStatus(payment.transactionId);
      expect(status.status).toBe('FAILED');
      expect(status.errorCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('should handle user cancellation', async () => {
      const payment = await initiatePayment({
        provider: 'ecocash',
        amount: 50,
        phone: '263773333333',
        reference: 'TEST-003'
      });

      await new Promise(resolve => setTimeout(resolve, 15000));

      const status = await getPaymentStatus(payment.transactionId);
      expect(status.status).toBe('CANCELLED');
    });
  });

  describe('Webhook Processing', () => {
    it('should verify webhook signature', async () => {
      const validWebhook = createValidWebhook();
      const result = await processWebhook(validWebhook);
      expect(result.verified).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const invalidWebhook = createInvalidWebhook();
      await expect(processWebhook(invalidWebhook))
        .rejects.toThrow('Invalid signature');
    });

    it('should handle duplicate webhooks idempotently', async () => {
      const webhook = createValidWebhook();

      await processWebhook(webhook); // First time
      const result = await processWebhook(webhook); // Duplicate

      expect(result.alreadyProcessed).toBe(true);
    });
  });
});
```

---

## Production Readiness Checklist

### Pre-Production Verification

**Technical Checklist**:
```
□ All test scenarios passed (success, failure, timeout)
□ Load testing completed (expected peak volume + 50%)
□ Security testing completed (penetration test, OWASP top 10)
□ Webhook retry logic tested (7 attempts over 48 hours)
□ Circuit breaker tested (5 failures → open state)
□ Dead letter queue implemented and tested
□ Idempotency verified (duplicate webhooks handled)
□ Logging and monitoring configured
□ Alerting rules configured (failure rate, queue size)
□ Error handling comprehensive (all edge cases)
□ Timeout handling verified
□ Database indexes optimized
□ API rate limiting configured
□ Secrets stored securely (AWS Secrets Manager / Vault)
□ Environment variables configured
□ Production credentials received and verified
□ Backup and recovery procedures documented
□ Rollback plan prepared
```

**Operational Checklist**:
```
□ Operations team trained on dashboard
□ Manual intervention procedures documented
□ On-call rotation established
□ Incident response plan prepared
□ Customer support scripts prepared
□ FAQ document created
□ Refund procedures documented
□ Reconciliation process defined
□ Daily/weekly reporting configured
□ Compliance requirements met (RBZ, data protection)
□ Terms and conditions updated
□ Privacy policy updated
□ Customer consent mechanisms implemented
```

**Business Checklist**:
```
□ Merchant agreements signed (EcoCash, O'mari)
□ Transaction fees confirmed
□ Settlement timelines confirmed
□ Dispute resolution procedures agreed
□ Service level agreements (SLAs) documented
□ Insurance/risk coverage evaluated
□ Financial reconciliation process established
□ Accounting integration configured
□ Revenue recognition policies defined
□ Cash flow projections updated
```

### Go-Live Criteria

**Minimum Requirements**:
1. **100% test coverage** on critical payment paths
2. **99.5%+ success rate** in sandbox testing (500+ transactions)
3. **Zero** critical security vulnerabilities
4. **< 30 seconds** average payment completion time
5. **< 1%** webhook delivery failure rate
6. **24/7 monitoring** operational
7. **On-call team** available

### Post-Launch Monitoring

**First 24 Hours**:
```
□ Monitor every transaction individually
□ Check all webhook deliveries
□ Verify all WhatsApp confirmations sent
□ Review all error logs
□ Track payment success rate (target: 98%+)
□ Monitor average completion time
□ Check circuit breaker status
□ Review queue sizes
□ Verify no payments stuck in pending
□ Customer support ready for queries
```

**First 7 Days**:
```
□ Daily success rate review
□ Review all failed payments (investigate each)
□ Analyze completion time trends
□ Monitor webhook retry patterns
□ Review customer feedback
□ Check financial reconciliation
□ Verify settlements received
□ Update documentation based on learnings
□ Conduct post-launch retrospective
```

**First 30 Days**:
```
□ Performance optimization based on data
□ Capacity planning review
□ Cost analysis (transaction fees, infrastructure)
□ Customer satisfaction survey
□ Identify automation opportunities
□ Update runbooks and procedures
□ Security audit
□ Compliance review
```

---

## Summary

### Key Findings

1. **EcoCash Sandbox**
   - Official portal exists at `developers.ecocash.co.zw`
   - Access requires merchant approval + API partnership
   - No public test credentials available
   - Contact: ecocashhelp@econet.co.zw, +263 4 486121/66

2. **O'mari Test Environment**
   - No publicly documented sandbox yet
   - API access requires partnership with Old Mutual
   - Contact: omari@oldmutual.co.zw, 0719433433
   - Platform launched May 2023, developer ecosystem maturing

3. **RBZ Fintech Regulatory Sandbox**
   - Formal testing environment with regulatory oversight
   - 24-month maximum testing period
   - Beneficial for credibility and partnerships
   - Portal: https://frs.rbz.co.zw/

4. **Paynow Test Mode**
   - Immediately available (no approval required)
   - Pre-configured test phone numbers for all scenarios
   - Useful for testing payment flows before API access
   - Developers: https://developers.paynow.co.zw

### Recommended Testing Strategy

**Immediate Actions** (Before API Access):
1. Setup Paynow test integration
2. Build mock EcoCash/O'mari APIs
3. Test webhook handlers and retry logic
4. Develop comprehensive test suite
5. Implement monitoring and alerting

**After API Access Granted**:
1. Request sandbox credentials from EcoCash and O'mari
2. Migrate tests to official sandboxes
3. Conduct full integration testing
4. Load testing with expected volumes
5. Security penetration testing
6. Production deployment preparation

**Production Rollout**:
1. Pilot with 10 customers (Week 1)
2. Expand to 50 customers (Week 2-3)
3. Expand to 200 customers (Week 4-6)
4. Full production release (Week 7+)

### Next Steps for T019

The next task will focus on documenting transaction fees and pricing structures for EcoCash and O'mari to understand the cost structure for Lynia Finance.

---

**End of T018 Research Document**
