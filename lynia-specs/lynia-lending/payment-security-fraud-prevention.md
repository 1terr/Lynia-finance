# Payment Security & Fraud Prevention

**Task ID**: P1-T026
**Phase**: Phase 1 - Payment Processing Design
**Priority**: High
**Estimated**: 6 hours
**Dependencies**: P1-T021

---

## Table of Contents
1. [Overview](#overview)
2. [Security Threats](#security-threats)
3. [Fraud Detection](#fraud-detection)
4. [Prevention Mechanisms](#prevention-mechanisms)
5. [Duplicate Payment Detection](#duplicate-payment-detection)
6. [Velocity Limits](#velocity-limits)
7. [Suspicious Transaction Flagging](#suspicious-transaction-flagging)
8. [Fraud Alert System](#fraud-alert-system)
9. [Implementation](#implementation)

---

## 1. Overview

Payment security and fraud prevention protects both Lynia Finance and our customers from financial losses due to fraud, errors, and malicious attacks. This document outlines detection mechanisms, prevention controls, and response procedures.

### Security Objectives

- **Prevent Unauthorized Payments**: Only legitimate customers can make payments
- **Detect Fraud Early**: Identify suspicious patterns before significant loss
- **Minimize False Positives**: Don't block legitimate customers
- **Rapid Response**: Act quickly when fraud is detected

---

## 2. Security Threats

### 2.1 Threat Matrix

| Threat | Likelihood | Impact | Mitigation Priority |
|--------|------------|--------|-------------------|
| **Duplicate Payments (Accidental)** | High | Medium | 🔴 Critical |
| **Payment Injection Attack** | Low | High | 🟠 High |
| **Webhook Spoofing** | Medium | High | 🔴 Critical |
| **Account Takeover** | Medium | High | 🟠 High |
| **Payment Reversal Fraud** | Low | Medium | 🟡 Medium |
| **Card Testing (Phase 2)** | N/A | N/A | ⚪ Future |

---

### 2.2 Threat Scenarios

#### Threat 1: Webhook Spoofing

**Attack**:
Attacker sends fake payment webhook to mark loan as paid without actually paying.

**Impact**: Lynia loses money, device unlocked without payment

**Mitigation**:
- ✅ HMAC signature verification (SHA-512)
- ✅ IP whitelisting (gateway IPs only)
- ✅ TLS 1.2+ required
- ✅ Webhook idempotency checks

---

#### Threat 2: Duplicate Payment Attack

**Attack**:
Customer intentionally triggers duplicate payment to exploit refund process.

**Impact**: Financial loss, operational overhead

**Mitigation**:
- ✅ Idempotency keys
- ✅ Duplicate detection algorithm
- ✅ Automatic refund limits ($50 max without approval)

---

#### Threat 3: Account Takeover

**Attack**:
Attacker gains access to customer's WhatsApp account, makes unauthorized payments.

**Impact**: Customer loss, reputation damage

**Mitigation**:
- ✅ Payment confirmation required (USSD PIN)
- ✅ SMS backup notification
- ✅ Payment velocity limits
- ✅ Unusual activity alerts

---

## 3. Fraud Detection

### 3.1 Fraud Detection Rules

```typescript
interface FraudDetectionRule {
  rule_id: string;
  rule_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'flag' | 'block';
  threshold: any;
}

const FRAUD_RULES: FraudDetectionRule[] = [
  {
    rule_id: 'FD001',
    rule_name: 'Multiple payments within 5 minutes',
    severity: 'high',
    action: 'flag',
    threshold: 3  // payments
  },
  {
    rule_id: 'FD002',
    rule_name: 'Payment from different phone number',
    severity: 'medium',
    action: 'flag',
    threshold: null
  },
  {
    rule_id: 'FD003',
    rule_name: 'Payment amount > loan balance',
    severity: 'low',
    action: 'log',
    threshold: null
  },
  {
    rule_id: 'FD004',
    rule_name: 'Payment velocity > $500/hour',
    severity: 'critical',
    action: 'block',
    threshold: 500  // USD
  },
  {
    rule_id: 'FD005',
    rule_name: 'Payment from blacklisted phone',
    severity: 'critical',
    action: 'block',
    threshold: null
  }
];
```

---

### 3.2 Fraud Scoring System

```typescript
async function calculateFraudScore(payment: Payment): Promise<{
  fraud_score: number;  // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  triggered_rules: string[];
  recommended_action: 'allow' | 'review' | 'block';
}> {

  let fraudScore = 0;
  const triggeredRules: string[] = [];

  // Check each fraud rule
  for (const rule of FRAUD_RULES) {
    const triggered = await checkFraudRule(payment, rule);

    if (triggered) {
      triggeredRules.push(rule.rule_id);

      // Add to fraud score based on severity
      const severityScores = {
        'low': 10,
        'medium': 25,
        'high': 50,
        'critical': 100
      };

      fraudScore += severityScores[rule.severity];
    }
  }

  // Cap at 100
  fraudScore = Math.min(fraudScore, 100);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (fraudScore < 20) riskLevel = 'low';
  else if (fraudScore < 50) riskLevel = 'medium';
  else if (fraudScore < 80) riskLevel = 'high';
  else riskLevel = 'critical';

  // Determine action
  let recommendedAction: 'allow' | 'review' | 'block';
  if (riskLevel === 'critical') recommendedAction = 'block';
  else if (riskLevel === 'high') recommendedAction = 'review';
  else recommendedAction = 'allow';

  return {
    fraud_score: fraudScore,
    risk_level: riskLevel,
    triggered_rules: triggeredRules,
    recommended_action: recommendedAction
  };
}
```

---

## 4. Prevention Mechanisms

### 4.1 Webhook Signature Verification

**Requirement**: All incoming webhooks MUST have valid HMAC signature

```typescript
function verifyWebhookSignature(
  payload: Record<string, string>,
  receivedHash: string,
  secret: string
): boolean {

  // payment gateway webhook signature format
  const dataToHash = `${payload.reference}${payload.gateway_reference}${payload.amount}${payload.status}${secret}`;

  const calculatedHash = crypto
    .createHash('sha512')
    .update(dataToHash)
    .digest('hex')
    .toLowerCase();

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHash, 'hex'),
    Buffer.from(receivedHash.toLowerCase(), 'hex')
  );
}

// Usage in webhook handler
export async function handleGatewayWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {

  const payload = parseQueryString(event.body);
  const receivedHash = payload.hash;

  // CRITICAL: Verify signature first
  const isValid = verifyWebhookSignature(payload, receivedHash, process.env.GATEWAY_WEBHOOK_SECRET);

  if (!isValid) {
    // Log security event
    await logSecurityEvent({
      event_type: 'invalid_webhook_signature',
      severity: 'critical',
      source_ip: event.requestContext.identity.sourceIp,
      payload: payload,
      timestamp: new Date()
    });

    // Alert security team
    await notifySecurityTeam({
      alert: 'Invalid Webhook Signature Detected',
      source_ip: event.requestContext.identity.sourceIp,
      payload: payload
    });

    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid signature' })
    };
  }

  // Continue processing...
}
```

---

### 4.2 IP Whitelisting

**Requirement**: Webhook endpoint only accepts requests from gateway IPs

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:*/*/POST/webhooks/payment gateway",
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": [
            "41.220.96.0/24",
            "196.46.64.0/24"
          ]
        }
      }
    }
  ]
}
```

---

### 4.3 TLS Certificate Pinning (Optional Enhancement)

For extra security, pin payment gateway's TLS certificate:

```typescript
import https from 'https';
import crypto from 'crypto';

const GATEWAY_CERT_FINGERPRINT = 'AA:BB:CC:DD:EE:FF:...';  // SHA-256 fingerprint

const httpsAgent = new https.Agent({
  checkServerIdentity: (hostname, cert) => {
    const fingerprint = crypto
      .createHash('sha256')
      .update(cert.raw)
      .digest('hex')
      .toUpperCase();

    if (fingerprint !== GATEWAY_CERT_FINGERPRINT) {
      throw new Error('Certificate fingerprint mismatch');
    }
  }
});

// Use in API calls
await axios.get('https://www.payment gateway.co.zw/api/...', { httpsAgent });
```

---

## 5. Duplicate Payment Detection

### 5.1 Detection Algorithm

```typescript
async function detectDuplicatePayment(payment: Payment): Promise<{
  is_duplicate: boolean;
  duplicate_of?: string;
  confidence: 'low' | 'medium' | 'high';
}> {

  // Search for similar payments in last 24 hours
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', payment.loan_id)
    .eq('status', 'completed')
    .gte('completed_at', twentyFourHoursAgo())
    .neq('id', payment.id);

  for (const recentPayment of recentPayments) {

    let matchScore = 0;

    // Check 1: Same amount (within $0.01)
    if (Math.abs(recentPayment.amount - payment.amount) < 0.01) {
      matchScore += 40;
    }

    // Check 2: Within 1 hour
    const timeDiffMinutes = (payment.created_at.getTime() - recentPayment.created_at.getTime()) / (1000 * 60);
    if (timeDiffMinutes < 60) {
      matchScore += 30;
    }

    // Check 3: Same customer phone
    if (recentPayment.customer_phone === payment.customer_phone) {
      matchScore += 20;
    }

    // Check 4: Same payment method
    if (recentPayment.gateway === payment.gateway) {
      matchScore += 10;
    }

    // Determine confidence
    let confidence: 'low' | 'medium' | 'high';
    if (matchScore >= 80) confidence = 'high';
    else if (matchScore >= 50) confidence = 'medium';
    else confidence = 'low';

    // High confidence duplicate
    if (matchScore >= 80) {
      return {
        is_duplicate: true,
        duplicate_of: recentPayment.id,
        confidence
      };
    }
  }

  return { is_duplicate: false, confidence: 'low' };
}
```

---

### 5.2 Duplicate Payment Handling

```typescript
async function handleDuplicatePayment(payment: Payment, duplicateOf: string): Promise<void> {

  // 1. Flag as duplicate
  await supabase.from('payments').update({
    is_duplicate: true,
    duplicate_of: duplicateOf,
    requires_manual_review: true
  }).eq('id', payment.id);

  // 2. Automatically initiate refund (if amount < $50)
  if (payment.amount <= 50) {
    await initiateRefund({
      payment_id: payment.id,
      refund_amount: payment.amount,
      refund_reason: 'duplicate_payment',
      refund_type: 'full',
      requested_by: 'system',
      internal_notes: `Auto-refund for duplicate payment (duplicate of ${duplicateOf})`,
      requires_approval: false  // Auto-approve small duplicates
    });
  } else {
    // Larger duplicates require manual approval
    await createManualReviewTask({
      payment_id: payment.id,
      issue_type: 'duplicate_payment_high_value',
      description: `Potential duplicate payment of $${payment.amount} (duplicate of ${duplicateOf})`,
      priority: 'high'
    });
  }

  // 3. Alert admins
  await notifyAdmins({
    alert: 'Duplicate Payment Detected',
    payment_id: payment.id,
    duplicate_of: duplicateOf,
    amount: payment.amount,
    auto_refund_initiated: payment.amount <= 50
  });
}
```

---

## 6. Velocity Limits

### 6.1 Payment Velocity Rules

```typescript
interface VelocityLimit {
  limit_type: string;
  max_amount: number;
  time_window_hours: number;
  scope: 'customer' | 'loan' | 'global';
}

const VELOCITY_LIMITS: VelocityLimit[] = [
  {
    limit_type: 'customer_hourly',
    max_amount: 500,
    time_window_hours: 1,
    scope: 'customer'
  },
  {
    limit_type: 'customer_daily',
    max_amount: 1000,
    time_window_hours: 24,
    scope: 'customer'
  },
  {
    limit_type: 'loan_daily',
    max_amount: 500,
    time_window_hours: 24,
    scope: 'loan'
  }
];
```

---

### 6.2 Velocity Check

```typescript
async function checkVelocityLimits(payment: Payment): Promise<{
  allowed: boolean;
  violated_limits: string[];
  message?: string;
}> {

  const violatedLimits: string[] = [];

  for (const limit of VELOCITY_LIMITS) {

    const timeWindowStart = new Date(Date.now() - limit.time_window_hours * 3600000);

    // Build query based on scope
    let query = supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('completed_at', timeWindowStart);

    if (limit.scope === 'customer') {
      query = query.eq('customer_id', payment.customer_id);
    } else if (limit.scope === 'loan') {
      query = query.eq('loan_id', payment.loan_id);
    }

    const { data: recentPayments } = await query;

    // Calculate total amount
    const totalAmount = recentPayments.reduce((sum, p) => sum + p.amount, 0);

    // Check if adding this payment exceeds limit
    if (totalAmount + payment.amount > limit.max_amount) {
      violatedLimits.push(limit.limit_type);
    }
  }

  if (violatedLimits.length > 0) {
    return {
      allowed: false,
      violated_limits: violatedLimits,
      message: `Payment velocity limit exceeded: ${violatedLimits.join(', ')}`
    };
  }

  return { allowed: true, violated_limits: [] };
}

// Usage in payment initiation
export async function initiatePayment(loan_id: string, amount: number): Promise<PaymentResult> {

  const payment = await createPendingPayment(loan_id, amount);

  // Check velocity limits
  const velocityCheck = await checkVelocityLimits(payment);

  if (!velocityCheck.allowed) {
    // Block payment
    await supabase.from('payments').update({
      status: 'blocked',
      block_reason: velocityCheck.message
    }).eq('id', payment.id);

    // Alert security team
    await notifySecurityTeam({
      alert: 'Velocity Limit Exceeded',
      customer_id: payment.customer_id,
      violated_limits: velocityCheck.violated_limits,
      amount: amount
    });

    throw new Error(velocityCheck.message);
  }

  // Continue with payment...
}
```

---

## 7. Suspicious Transaction Flagging

### 7.1 Suspicious Pattern Detection

```typescript
async function flagSuspiciousTransaction(payment: Payment): Promise<void> {

  const suspiciousPatterns: string[] = [];

  // Pattern 1: Payment amount significantly higher than usual
  const avgPaymentAmount = await getCustomerAveragePayment(payment.customer_id);
  if (payment.amount > avgPaymentAmount * 3) {
    suspiciousPatterns.push('unusually_high_amount');
  }

  // Pattern 2: Payment at unusual hour (midnight - 5am)
  const hour = new Date(payment.created_at).getHours();
  if (hour >= 0 && hour < 5) {
    suspiciousPatterns.push('unusual_time');
  }

  // Pattern 3: Multiple failed attempts before success
  const failedAttempts = await countFailedPaymentAttempts(payment.customer_id, '1 hour');
  if (failedAttempts >= 3) {
    suspiciousPatterns.push('multiple_failed_attempts');
  }

  // Pattern 4: Payment from different location (if available)
  // TODO: Implement geolocation checking in Phase 2

  // If suspicious patterns detected, flag for review
  if (suspiciousPatterns.length >= 2) {
    await supabase.from('payments').update({
      is_suspicious: true,
      suspicious_patterns: suspiciousPatterns,
      requires_manual_review: true
    }).eq('id', payment.id);

    await createManualReviewTask({
      payment_id: payment.id,
      issue_type: 'suspicious_transaction',
      description: `Suspicious patterns detected: ${suspiciousPatterns.join(', ')}`,
      priority: 'high'
    });

    await notifySecurityTeam({
      alert: 'Suspicious Transaction Flagged',
      payment_id: payment.id,
      patterns: suspiciousPatterns,
      amount: payment.amount
    });
  }
}
```

---

## 8. Fraud Alert System

### 8.1 Alert Triggers

| Trigger | Alert Priority | Recipients | Action |
|---------|----------------|------------|--------|
| **Invalid webhook signature** | 🔴 Critical | Security team, CTO | Block IP |
| **Velocity limit exceeded** | 🟠 High | Fraud team | Block customer |
| **Duplicate payment (> $200)** | 🟡 Medium | Operations team | Manual review |
| **Suspicious transaction** | 🟡 Medium | Fraud team | Manual review |
| **Failed signature attempts > 5** | 🔴 Critical | Security team | Block IP permanently |

---

### 8.2 Alert Implementation

```typescript
interface FraudAlert {
  alert_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  payment_id?: string;
  customer_id?: string;
  source_ip?: string;
  description: string;
  triggered_rules: string[];
  recommended_action: string;
  created_at: Date;
}

async function createFraudAlert(alert: Omit<FraudAlert, 'alert_id' | 'created_at'>): Promise<void> {

  // Store alert
  const { data: savedAlert } = await supabase.from('fraud_alerts').insert({
    ...alert,
    created_at: new Date()
  }).single();

  // Notify appropriate teams
  const notificationChannels = getNotificationChannels(alert.severity);

  for (const channel of notificationChannels) {
    if (channel === 'slack') {
      await sendSlackAlert(alert);
    } else if (channel === 'email') {
      await sendEmailAlert(alert);
    } else if (channel === 'sms') {
      await sendSMSAlert(alert);
    }
  }

  // Log security event
  await logSecurityEvent({
    event_type: 'fraud_alert_created',
    alert_id: savedAlert.id,
    severity: alert.severity,
    alert_type: alert.alert_type
  });
}

function getNotificationChannels(severity: string): string[] {
  if (severity === 'critical') {
    return ['slack', 'email', 'sms'];  // All channels
  } else if (severity === 'high') {
    return ['slack', 'email'];
  } else {
    return ['slack'];
  }
}
```

---

## 9. Implementation

### 9.1 Database Schema

```sql
-- Fraud alerts table
CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,

  payment_id UUID REFERENCES payments(id),
  customer_id UUID REFERENCES customers(id),
  source_ip VARCHAR(45),

  description TEXT NOT NULL,
  triggered_rules TEXT[],
  recommended_action TEXT,

  status VARCHAR(20) DEFAULT 'open',  -- open, investigating, resolved, false_positive
  assigned_to UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events log table
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,

  payment_id UUID REFERENCES payments(id),
  customer_id UUID REFERENCES customers(id),
  source_ip VARCHAR(45),
  user_agent TEXT,

  event_data JSONB,
  response_action VARCHAR(50),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blacklisted entities table
CREATE TABLE blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type VARCHAR(20) NOT NULL,  -- 'phone_number', 'ip_address', 'customer_id'
  entity_value VARCHAR(255) NOT NULL UNIQUE,

  reason TEXT NOT NULL,
  added_by UUID REFERENCES admin_users(id),
  expires_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity, created_at DESC);
CREATE INDEX idx_security_events_type ON security_events(event_type, created_at DESC);
CREATE INDEX idx_blacklist_entity ON blacklist(entity_type, entity_value);
```

---

### 9.2 Fraud Detection Middleware

```typescript
// Middleware to run on every payment
export async function fraudDetectionMiddleware(payment: Payment): Promise<void> {

  // 1. Calculate fraud score
  const fraudAnalysis = await calculateFraudScore(payment);

  // Store fraud score
  await supabase.from('payments').update({
    fraud_score: fraudAnalysis.fraud_score,
    risk_level: fraudAnalysis.risk_level
  }).eq('id', payment.id);

  // 2. Check if action required
  if (fraudAnalysis.recommended_action === 'block') {
    // Block payment
    await supabase.from('payments').update({
      status: 'blocked',
      block_reason: `Fraud score: ${fraudAnalysis.fraud_score} (${fraudAnalysis.risk_level})`
    }).eq('id', payment.id);

    // Create fraud alert
    await createFraudAlert({
      alert_type: 'high_fraud_score',
      severity: 'critical',
      payment_id: payment.id,
      customer_id: payment.customer_id,
      description: `Payment blocked due to high fraud score (${fraudAnalysis.fraud_score})`,
      triggered_rules: fraudAnalysis.triggered_rules,
      recommended_action: 'Investigate customer account'
    });

    throw new Error('Payment blocked due to fraud detection');

  } else if (fraudAnalysis.recommended_action === 'review') {
    // Flag for manual review
    await supabase.from('payments').update({
      requires_manual_review: true
    }).eq('id', payment.id);

    await createManualReviewTask({
      payment_id: payment.id,
      issue_type: 'fraud_review',
      description: `Payment requires fraud review (score: ${fraudAnalysis.fraud_score})`,
      priority: 'high'
    });
  }

  // 3. Check for duplicate
  const duplicateCheck = await detectDuplicatePayment(payment);
  if (duplicateCheck.is_duplicate && duplicateCheck.confidence === 'high') {
    await handleDuplicatePayment(payment, duplicateCheck.duplicate_of);
  }

  // 4. Check velocity limits
  const velocityCheck = await checkVelocityLimits(payment);
  if (!velocityCheck.allowed) {
    throw new Error(velocityCheck.message);
  }

  // 5. Flag suspicious patterns
  await flagSuspiciousTransaction(payment);
}
```

---

## Summary

**Payment Security & Fraud Prevention Deliverables**:
- ✅ **Webhook Security**: HMAC signature verification + IP whitelisting
- ✅ **Fraud Detection**: Multi-rule fraud scoring system (0-100)
- ✅ **Duplicate Detection**: Algorithm with 3 confidence levels
- ✅ **Velocity Limits**: Per-customer and per-loan payment limits
- ✅ **Suspicious Flagging**: Pattern detection for unusual transactions
- ✅ **Fraud Alerts**: Real-time alerts to security team
- ✅ **Audit Trail**: Complete security event logging

**Key Security Controls**:
- HMAC SHA-512 webhook signatures
- TLS 1.2+ encryption
- IP whitelisting
- Fraud scoring (0-100)
- Velocity limits ($500/hour)
- Duplicate payment detection

**Fraud Metrics (Targets)**:
- False positive rate: < 2%
- Fraud detection rate: > 95%
- Average fraud investigation time: < 24 hours

**Next Steps**:
1. Implement fraud detection middleware
2. Set up security event monitoring dashboard
3. Configure Slack/email alerts for fraud team
4. ✅ **Payment Processing section complete!** → Move to P1-T027 (KYC & Onboarding)

---

**References**:
- Payment Gateway Integration: payment-gateway-integration.md
- Payment Reconciliation: payment-reconciliation.md
- Authentication & Security: auth-security.md
