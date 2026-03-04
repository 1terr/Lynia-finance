# Lynia Finance - System Flows & Architecture

**Complete technical documentation of all system flows**

**Last Updated**: 2026-03-04
**Version**: 2.0

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Onboarding Flow](#onboarding-flow)
3. [Credit Scoring Flow](#credit-scoring-flow)
4. [Payment Flow](#payment-flow)
5. [Device Lock Flow](#device-lock-flow)
6. [Notification Flow](#notification-flow)
7. [Admin Operations](#admin-operations)
8. [Error Handling](#error-handling)
9. [Security & Compliance](#security--compliance)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         External Services                        │
├─────────────────────────────────────────────────────────────────┤
│  WhatsApp API  │  DIDIT  │  EcoCash  │  OneMoney  │ Trustonic│
└────────┬────────────┬──────────────┬──────────┬───────────┬──────┘
         │            │              │          │           │
         ▼            ▼              ▼          ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway (AWS)                         │
│                  https://api.lyniafinance.com                  │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Lambda Functions Layer                       │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ WhatsApp │ Scoring  │   KYC    │ Payment  │   Lock   │  Notify  │
│ Service  │ Service  │ Service  │ Service  │ Service  │ Service  │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
     │          │          │          │          │          │
     └──────────┴──────────┴──────────┴──────────┴──────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │  RDS PostgreSQL 16   │
                │  (Private VPC)       │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  Apache Fineract     │
                │  (Core Banking)      │
                └──────────────────────┘
```

### Technology Stack

**Backend**:
- AWS Lambda (Node.js 20.x, TypeScript)
- AWS API Gateway (REST API)
- AWS CloudWatch (Monitoring, Alarms & Dashboards)
- AWS Secrets Manager (API keys, credentials)
- Amazon SQS (9 queues + 9 DLQs for async processing)

**Database**:
- AWS RDS PostgreSQL 16 (primary data store, private VPC)
- Apache Fineract v1.13.0 (core banking, ECS Fargate)
- One-way sync: Lynia DB → Fineract (non-blocking, SQS retry)

**Integrations**:
- WhatsApp Cloud API (customer messaging, onboarding)
- DIDIT (KYC identity verification)
- EcoCash / OneMoney / InnBucks / OMari (mobile money payments)
- Trustonic (device lock/unlock)

**Frontend**:
- Next.js 14 (Admin Portal + Distributor Dashboard)
- React + TypeScript + TailwindCSS
- S3 + CloudFront + WAF (hosting & security)
- Amazon Cognito (authentication)

---

## Onboarding Flow

### Complete Customer Journey

```
Customer          WhatsApp          Lambda           RDS DB           External
   │                 │                 │                 │                │
   │─────"Hi"───────▶│                 │                 │                │
   │                 │──────request────▶│                 │                │
   │                 │                 │──check_phone────▶│                │
   │                 │                 │◀────valid───────│                │
   │                 │                 │                 │                │
   │◀──welcome_msg───│◀────send────────│                 │                │
   │                 │                 │                 │                │
   │──"+263771..."───▶│──────forward────▶│                 │                │
   │                 │                 │──validate_ph─────▶│                │
   │                 │                 │◀──ZW_verified───│                │
   │                 │                 │──create_cust─────▶│                │
   │                 │                 │◀──customer_id───│                │
   │◀──"First name?"─│◀────reply───────│                 │                │
   │                 │                 │                 │                │
   │───"Tatenda"─────▶│──────forward────▶│                 │                │
   │                 │                 │──update_cust─────▶│                │
   │◀──"Last name?"──│◀────reply───────│◀──updated───────│                │
   │                 │                 │                 │                │
   │───"Moyo"────────▶│──────forward────▶│──update_cust─────▶│                │
   │◀──"National ID?"│◀────reply───────│◀──updated───────│                │
   │                 │                 │                 │                │
   │──"63-123..."────▶│──────forward────▶│──validate_nid────▶│                │
   │                 │                 │◀──valid_format───│                │
   │◀──"DOB?"────────│◀────reply───────│                 │                │
   │                 │                 │                 │                │
   │──"15/06/1995"───▶│──────forward────▶│──update_dob──────▶│                │
   │◀──"Address?"────│◀────reply───────│◀──updated───────│                │
   │                 │                 │                 │                │
   │──"123 Samora..."▶│──────forward────▶│──update_addr─────▶│                │
   │◀──"Send selfie"─│◀────reply───────│◀──updated───────│                │
   │                 │                 │                 │                │
   │──[image]────────▶│──────forward────▶│                 │                │
   │                 │                 │──────kyc_submit──────────────────▶│
   │                 │                 │                 │       DIDIT │
   │                 │                 │◀─────verified────────────────────│
   │                 │                 │──update_kyc──────▶│                │
   │◀──"ID front?"───│◀────reply───────│◀──updated───────│                │
   │                 │                 │                 │                │
   │──[image]────────▶│──────forward────▶│──────verify──────────────────────▶│
   │◀──"ID back?"────│◀────reply───────│◀──verified──────────────────────│
   │                 │                 │                 │                │
   │──[image]────────▶│──────forward────▶│──────verify──────────────────────▶│
   │                 │                 │◀──all_verified──────────────────│
   │                 │                 │                 │                │
   │                 │                 │──calculate_score─▶│                │
   │                 │                 │◀──score:720─────│                │
   │                 │                 │──set_tier────────▶│                │
   │                 │                 │◀──tier_2:$350───│                │
   │                 │                 │                 │                │
   │◀──"APPROVED!"───│◀────send────────│                 │                │
   │   "$350 limit"  │                 │                 │                │
```

### Onboarding States

**WhatsApp Session State Machine** (`whatsapp_sessions.current_state`):

```typescript
type OnboardingState =
  | 'welcome'                  // Initial greeting, language selection
  | 'phone_validation'         // Validate +263 Zimbabwe number
  | 'collecting_personal_info' // Entry to personal info collection
  | 'personal_info_name'       // First name, last name
  | 'personal_info_dob'        // Date of birth
  | 'personal_info_gender'     // Gender selection
  | 'personal_info_location'   // City/province
  | 'collecting_employment'    // Entry to employment collection
  | 'employment_type'          // Formal/informal/self-employed
  | 'employment_income'        // Monthly income in USD
  | 'employment_debts'         // Existing debt obligations
  | 'employment_household'     // Household size & dependents
  | 'product_selection'        // Smartphone vs digital credit
  | 'kyc_id_upload'            // National ID photo upload
  | 'kyc_selfie_upload'        // Selfie photo upload
  | 'kyc_processing'           // DIDIT verification in progress
  | 'credit_scoring'           // Score calculation + device fetch
  | 'device_selection'         // Choose device (Back → credit_scoring)
  | 'term_selection'           // Choose loan term (Back → device_selection)
  | 'loan_summary'             // Review loan details
  | 'loan_offer'               // Final offer (Back → term_selection)
  | 'terms_acceptance'         // Accept T&C
  | 'completed'                // Onboarding done, awaiting deposit
  | 'rejected';                // KYC verification failed
```

**Session timeout**: 24 hours of inactivity (session resumes where left off).
**Back navigation**: Available at device_selection, term_selection, and loan_offer.

### Decision Points

**1. Phone Number Validation**
```typescript
if (phoneNumber.startsWith('+263')) {
  // Zimbabwe customer - proceed
  createCustomer();
} else {
  // Non-Zimbabwe - add to waitlist
  addToInternationalWaitlist();
  sendRejectionMessage();
}
```

**2. Credit Scoring Decision**

All customers are auto-approved. There is no manual review or rejection based on
credit score. Only KYC verification failure blocks progression.

```typescript
// scaled_score = 300 + (raw_score / 1000) * 550  (always >= 300)
// Decision is ALWAYS 'approve' — only KYC failure blocks progression

const decision = 'approve' as const;

if (scaled_score >= 650) {
  tier = 'Tier 3';  credit_limit = 2000;  down_payment = 10%;  apr = 3%;
} else if (scaled_score >= 500) {
  tier = 'Tier 2';  credit_limit = 500;   down_payment = 20%;  apr = 4%;
} else {
  tier = 'Tier 1';  credit_limit = 200;   down_payment = 30%;  apr = 5%;
}

// After scoring → fetch available devices within credit limit → device_selection
```

**3. KYC Verification**
```typescript
const kycResult = await diditIdentity.verify({
  selfie,
  idFront,
  idBack,
  nationalId
});

if (kycResult.confidence > 0.95) {
  customer.kyc_status = 'verified';
  proceedToCreditScoring();
} else if (kycResult.confidence > 0.85) {
  customer.kyc_status = 'manual_review';
  flagForAdminReview();
} else {
  customer.kyc_status = 'failed';
  requestResubmission();
}
```

---

## Credit Scoring Flow

> Full architecture details: [CREDIT-SCORING-ARCHITECTURE.md](../architecture/CREDIT-SCORING-ARCHITECTURE.md)

### Rule-Based 6-Component Model

The scoring engine is a pure rule-based system (no ML). It sums 5 or 6 weighted components
to produce a raw score (0-1000), scaled to 300-850 (FICO-like).

```
WhatsApp Onboarding Data
        │
        ▼
┌──────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ credit-      │────▶│ POST /scoring/      │────▶│ scoring-     │
│ scoring.ts   │     │ calculate           │     │ engine.ts    │
│ (payload     │     │ (API handler)       │     │ (pure fns)   │
│  assembly)   │     └─────────────────────┘     └──────┬───────┘
└──────────────┘                                        │
                                                        ▼
                                                ┌──────────────┐
                                                │ Score Result  │
                                                │ + Tier + Limit│
                                                └──────────────┘
```

### Scoring Components (Smartphone Loans)

| # | Component | Weight | Max Pts | Data Source |
|---|-----------|--------|---------|-------------|
| 1 | Affordability | 30% | 300 | Income, expenses, household (WhatsApp) |
| 2 | Repayment Willingness | 25% | 250 | Loan/payment history (DB query) |
| 3 | Mobile Money Activity | 20% | 200 | *Neutral — no API integration yet* |
| 4 | External Credit | 15% | 150 | *Neutral — no API integration yet* |
| 5 | KYC Verification | 10% | 100 | DIDIT KYC provider |

For **digital loans**, Component 6 (Org Verification, 200 pts) is added by redistributing
weight from Mobile Money (200→100) and External Credit (150→50).

### Safety Mechanisms

- **No dangerous defaults**: Missing required fields (income, loan amount, household size)
  trigger a fail-fast error — the customer is asked to restart.
- **KYC rejection**: If no KYC submission exists, scoring is blocked entirely.
- **National ID deduplication**: Returning customers are matched by national ID (not just phone),
  ensuring loan history follows the person across phone number changes.

### Credit Tiers (Source of Truth: Fineract Product Config)

| Tier | Score Range | Credit Limit | Down Payment | APR | Allowed Terms |
|------|------------|-------------|-------------|-----|---------------|
| **Tier 1** | 300 - 499 | $200 | 30% | 5% | 3, 6 months |
| **Tier 2** | 500 - 649 | $500 | 20% | 4% | 3, 6, 9 months |
| **Tier 3** | 650 - 850 | $2,000 | 10% | 3% | 3, 6, 9, 12 months |

**Repayment calculation**: Declining balance (amortized)
```
M = P x [r(1+r)^n] / [(1+r)^n - 1]
where P = principal (amount - deposit), r = APR/100/12, n = term in months
```

**No reject tier**: `scaled_score = 300 + (raw/1000)*550` guarantees minimum 300.
All customers get at least Tier 1.

---

## Payment Flow

### EcoCash Integration

```
Customer          EcoCash          Payment Service    RDS DB            Lock Service
   │                 │                    │                │                  │
   │──Pay via USSD───▶│                    │                │                  │
   │   *151*2*1*...   │                    │                │                  │
   │                 │                    │                │                  │
   │                 │──webhook_notify────▶│                │                  │
   │                 │   (payment_rcvd)   │                │                  │
   │                 │                    │──verify_txn─────▶│                  │
   │                 │                    │◀──valid────────│                  │
   │                 │                    │                │                  │
   │                 │                    │──get_loan───────▶│                  │
   │                 │                    │◀──loan_details──│                  │
   │                 │                    │                │                  │
   │                 │                    │──record_pay─────▶│                  │
   │                 │                    │◀──updated───────│                  │
   │                 │                    │                │                  │
   │                 │                    │──check_overdue──▶│                  │
   │                 │                    │◀──was_locked────│                  │
   │                 │                    │                │                  │
   │                 │                    │──────unlock_device──────────────────▶│
   │                 │                    │                │                  │
   │◀────SMS_confirm─│◀───ack_payment─────│                │                  │
   │                 │                    │                │                  │
   │◀──────WhatsApp_notification──────────│                │                  │
   │   "Payment received! Device unlocked" │                │                  │
```

### Payment Verification

```typescript
async function verifyPayment(webhookData: EcoCashWebhook) {
  // 1. Verify webhook signature
  const isValid = verifyHMAC(webhookData, process.env.ECOCASH_SECRET);
  if (!isValid) throw new Error('Invalid webhook signature');

  // 2. Check for duplicate processing
  const existingPayment = await db
    .from('payments')
    .select('id')
    .eq('external_reference', webhookData.transaction_id)
    .single();

  if (existingPayment) {
    return { status: 'already_processed' };
  }

  // 3. Verify amount matches expected
  const loan = await getLoanByCustomerPhone(webhookData.phone_number);
  const expectedAmount = calculateNextPaymentAmount(loan);

  if (Math.abs(webhookData.amount - expectedAmount) > 0.01) {
    await flagForManualReview({
      reason: 'amount_mismatch',
      expected: expectedAmount,
      received: webhookData.amount
    });
  }

  // 4. Record payment
  await recordPayment({
    loan_id: loan.id,
    customer_id: loan.customer_id,
    amount: webhookData.amount,
    payment_method: 'ecocash',
    external_reference: webhookData.transaction_id,
    status: 'completed',
    paid_at: new Date()
  });

  // 5. Update loan status
  await updateLoanStatus(loan.id);

  // 6. Unlock device if was locked
  if (loan.device_locked) {
    await unlockDevice(loan.device_id, 'payment_received');
  }

  // 7. Send confirmation
  await sendWhatsAppMessage(loan.customer_phone, {
    template: 'payment_received',
    amount: webhookData.amount,
    next_payment_date: loan.next_payment_date
  });

  return { status: 'success' };
}
```

### Payment Reconciliation

**Daily automated process**:

```typescript
async function reconcilePayments() {
  // 1. Get all payments from last 24 hours
  const recentPayments = await db
    .from('payments')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000));

  // 2. Get EcoCash transaction report
  const ecocashReport = await ecocash.getTransactionReport({
    date: new Date(),
    merchant_id: process.env.ECOCASH_MERCHANT_ID
  });

  // 3. Match payments
  const unmatched = [];
  for (const payment of recentPayments) {
    const match = ecocashReport.transactions.find(
      t => t.reference === payment.external_reference
    );

    if (!match) {
      unmatched.push(payment);
    }
  }

  // 4. Flag unmatched for review
  if (unmatched.length > 0) {
    await notifyAdmin({
      type: 'reconciliation_mismatch',
      count: unmatched.length,
      payments: unmatched
    });
  }

  // 5. Generate reconciliation report
  return {
    total_payments: recentPayments.length,
    matched: recentPayments.length - unmatched.length,
    unmatched: unmatched.length,
    total_amount: recentPayments.reduce((sum, p) => sum + p.amount, 0)
  };
}
```

---

## Device Lock Flow

### Lock Trigger Conditions

```typescript
// Run daily job to check for overdue payments
async function checkOverdueLoans() {
  const overdueLoans = await db
    .from('loans')
    .select('*, customer:customers(*)')
    .eq('status', 'active')
    .lt('next_payment_date', new Date())
    .is('device_locked', false);

  for (const loan of overdueLoans) {
    const daysOverdue = calculateDaysOverdue(loan.next_payment_date);

    // Send reminders at specific intervals
    if (daysOverdue === 1) {
      await sendReminder(loan, 'payment_overdue_1day');
    } else if (daysOverdue === 3) {
      await sendReminder(loan, 'payment_overdue_3days');
    } else if (daysOverdue === 5) {
      await sendReminder(loan, 'final_warning');
    } else if (daysOverdue === 7) {
      // Lock device after 7 days
      await lockDevice(loan);
    }
  }
}
```

### Trustonic Integration

```typescript
async function lockDevice(loan: Loan) {
  try {
    // 1. Generate lock request
    const lockRequest = {
      device_id: loan.device_id,
      imei: loan.device_imei,
      lock_type: 'payment_overdue',
      message: `Device locked due to missed payment.
        Amount overdue: $${loan.overdue_amount}
        Days overdue: ${loan.days_overdue}
        Contact: wa.me/263771234567`,
      allow_emergency_calls: true
    };

    // 2. Sign request with HMAC
    const signature = crypto
      .createHmac('sha256', process.env.TRUSTONIC_API_SECRET)
      .update(JSON.stringify(lockRequest))
      .digest('hex');

    // 3. Call Trustonic API
    const response = await fetch('https://api.trustonic.com/v1/locks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TRUSTONIC_API_KEY}`,
        'X-Signature': signature,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(lockRequest)
    });

    if (!response.ok) {
      throw new Error(`Trustonic API error: ${response.statusText}`);
    }

    const result = await response.json();

    // 4. Record lock in database
    await db.from('device_locks').insert({
      device_id: loan.device_id,
      loan_id: loan.id,
      customer_id: loan.customer_id,
      lock_status: 'locked',
      locked_at: new Date(),
      lock_reason: 'missed_payment',
      days_overdue_at_lock: loan.days_overdue,
      trustonic_lock_id: result.lock_id
    });

    // 5. Update loan
    await db
      .from('loans')
      .update({ device_locked: true, locked_at: new Date() })
      .eq('id', loan.id);

    // 6. Notify customer
    await sendWhatsAppMessage(loan.customer_phone, {
      template: 'device_locked',
      overdue_amount: loan.overdue_amount,
      days_overdue: loan.days_overdue,
      payment_instructions: getPaymentInstructions()
    });

    // 7. Notify admin
    await notifyAdmin({
      type: 'device_locked',
      loan_id: loan.id,
      customer_name: loan.customer.first_name,
      overdue_amount: loan.overdue_amount
    });

    return { status: 'success', lock_id: result.lock_id };

  } catch (error) {
    // Log error and retry
    await logError('device_lock_failed', { loan_id: loan.id, error });
    throw error;
  }
}
```

### Unlock Flow

```typescript
async function unlockDevice(deviceId: string, reason: string) {
  // 1. Get lock record
  const lock = await db
    .from('device_locks')
    .select('*, loan:loans(*, customer:customers(*))')
    .eq('device_id', deviceId)
    .eq('lock_status', 'locked')
    .single();

  if (!lock) {
    throw new Error('No active lock found for device');
  }

  // 2. Call Trustonic unlock API
  const signature = generateHMAC({
    lock_id: lock.trustonic_lock_id,
    action: 'unlock'
  });

  const response = await fetch(`https://api.trustonic.com/v1/locks/${lock.trustonic_lock_id}/unlock`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TRUSTONIC_API_KEY}`,
      'X-Signature': signature
    }
  });

  if (!response.ok) {
    throw new Error('Failed to unlock device');
  }

  // 3. Update database
  await db
    .from('device_locks')
    .update({
      lock_status: 'unlocked',
      unlocked_at: new Date(),
      unlock_reason: reason
    })
    .eq('id', lock.id);

  await db
    .from('loans')
    .update({ device_locked: false })
    .eq('id', lock.loan_id);

  // 4. Notify customer
  await sendWhatsAppMessage(lock.loan.customer.phone_number, {
    template: 'device_unlocked',
    reason,
    next_payment_date: lock.loan.next_payment_date
  });

  return { status: 'unlocked' };
}
```

---

## Notification Flow

### Multi-Channel System

```typescript
interface NotificationConfig {
  type: string;
  channels: ('whatsapp' | 'sms' | 'email')[];
  priority: 'high' | 'medium' | 'low';
  template: string;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

const NOTIFICATION_CONFIGS: Record<string, NotificationConfig> = {
  payment_reminder_3days: {
    type: 'payment_reminder',
    channels: ['whatsapp'],
    priority: 'medium',
    template: 'payment_reminder_3days',
    retryPolicy: { maxRetries: 3, backoffMultiplier: 2 }
  },
  payment_overdue_1day: {
    type: 'payment_overdue',
    channels: ['whatsapp', 'sms'],
    priority: 'high',
    template: 'payment_overdue_1day',
    retryPolicy: { maxRetries: 5, backoffMultiplier: 1.5 }
  },
  final_warning: {
    type: 'lock_warning',
    channels: ['whatsapp', 'sms'],
    priority: 'high',
    template: 'final_warning',
    retryPolicy: { maxRetries: 5, backoffMultiplier: 1.5 }
  },
  device_locked: {
    type: 'device_locked',
    channels: ['whatsapp', 'sms', 'email'],
    priority: 'high',
    template: 'device_locked',
    retryPolicy: { maxRetries: 10, backoffMultiplier: 1.2 }
  }
};
```

### Smart Reminder Scheduling

```typescript
async function scheduleReminders() {
  // Run daily to schedule upcoming reminders

  const upcomingPayments = await db
    .from('loans')
    .select('*, customer:customers(*)')
    .eq('status', 'active')
    .gte('next_payment_date', new Date())
    .lte('next_payment_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  for (const loan of upcomingPayments) {
    const daysUntilDue = calculateDaysUntilDue(loan.next_payment_date);

    // Schedule reminder based on days until due
    if (daysUntilDue === 7) {
      await scheduleNotification(loan, 'payment_reminder_7days');
    } else if (daysUntilDue === 3) {
      await scheduleNotification(loan, 'payment_reminder_3days');
    } else if (daysUntilDue === 1) {
      await scheduleNotification(loan, 'payment_reminder_1day');
    }
  }
}
```

---

## Admin Operations

### Dashboard Features

**1. Loan Management**:
- View all loans (approved, paid_deposit, active, completed, defaulted)
- Force device lock/unlock
- Record manual payments
- Fineract sync status per loan

**2. Customer Management**:
- View customer profiles
- Credit history
- Payment history
- KYC documents
- Manual credit score adjustment

**3. Analytics & Reporting**:
- Portfolio performance metrics
- Default rate tracking
- Payment collection rates
- Device lock effectiveness
- Revenue projections

**4. Operations Queue**:
- KYC verification issues (DIDIT manual review cases)
- Payment discrepancies
- Device lock failures
- Customer disputes

**5. System Monitoring**:
- API health checks
- Lambda function metrics
- Database performance
- Integration status
- Error logs

---

## Error Handling

### Retry Strategies

```typescript
class RetryableError extends Error {
  retryAfter: number;
  maxRetries: number;
  currentRetry: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < config.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error)) {
        throw error;
      }

      const delay = config.baseDelay * Math.pow(config.backoffMultiplier, i);
      await sleep(delay);
    }
  }

  throw lastError;
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
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

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

---

## Security & Compliance

### Data Protection

**Encryption**:
- All data encrypted at rest (AES-256)
- All data encrypted in transit (TLS 1.3)
- Sensitive fields encrypted in database (National IDs, phone numbers)

**Access Control**:
- Role-based access control (RBAC)
- Multi-factor authentication for admin
- API key rotation every 90 days
- Audit logs for all data access

**PCI Compliance**:
- No credit card data stored
- Mobile money integration via certified gateways
- Payment data encrypted and tokenized
- Regular security audits

**KYC/AML**:
- DIDIT verification (certified)
- Document retention for 7 years
- Suspicious activity monitoring
- Regulatory reporting

---

**Last Updated**: 2026-03-04
**Version**: 2.0
