# T020: Document Payment Notification Flow to Customers

## Research Context

**Task**: Document payment notification flow to customers via WhatsApp
**Date**: 2025-01-13
**Status**: Complete

This research documents the complete customer notification flow for payment events (successful, failed, pending, timeout) via WhatsApp Business API, ensuring customers are informed at every stage of the payment process.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Payment Notification Principles](#payment-notification-principles)
3. [Notification Flow Architecture](#notification-flow-architecture)
4. [Successful Payment Notifications](#successful-payment-notifications)
5. [Failed Payment Notifications](#failed-payment-notifications)
6. [Pending/Timeout Notifications](#pendingtimeout-notifications)
7. [Notification Timing Strategy](#notification-timing-strategy)
8. [WhatsApp Template Designs](#whatsapp-template-designs)
9. [Multi-Channel Notification Strategy](#multi-channel-notification-strategy)
10. [Error Handling and Retries](#error-handling-and-retries)
11. [Implementation Guide](#implementation-guide)

---

## Executive Summary

### Key Principles

**Immediate Confirmation**: Notify customers within **30 seconds** of payment status change

**Clear Communication**: Use simple, non-technical language with exact amounts and references

**Actionable Messages**: Failed payments must include **clear next steps** (retry, contact support)

**Multi-Status Coverage**: Handle all payment states (success, failed, pending, timeout, cancelled)

**Reassurance**: Build trust through timely, professional communication

### Notification Types

| Event | Timing | Channel | Template Required |
|-------|--------|---------|------------------|
| **Payment Initiated** | Immediate | WhatsApp | Yes (TRANSACTIONAL) |
| **Payment Successful** | < 30 seconds | WhatsApp | Yes (TRANSACTIONAL) |
| **Payment Failed** | < 30 seconds | WhatsApp | Yes (TRANSACTIONAL) |
| **Payment Pending** | 2 minutes | WhatsApp | Yes (TRANSACTIONAL) |
| **Payment Timeout** | 5 minutes | WhatsApp | Yes (TRANSACTIONAL) |
| **Payment Cancelled** | Immediate | WhatsApp | Yes (TRANSACTIONAL) |

### Customer Experience Goals

1. **Peace of Mind**: Immediate confirmation that payment was received
2. **Transparency**: Clear status updates at each stage
3. **Control**: Easy options to retry or contact support if issues occur
4. **Trust**: Professional, consistent communication builds confidence

---

## Payment Notification Principles

### 1. Timeliness

**Real-Time Notifications** (< 30 seconds):
```
Webhook Received → Process Payment → Send WhatsApp
Target: < 30 seconds end-to-end

Breakdown:
- Webhook processing: < 5 seconds
- Database update: < 2 seconds
- WhatsApp API call: < 10 seconds
- Delivery: < 15 seconds
Total: ~25-30 seconds
```

**Why Speed Matters**:
- Customer expects immediate confirmation
- Reduces support inquiries ("Did my payment go through?")
- Builds trust and confidence
- Prevents duplicate payments

### 2. Clarity

**Use Simple Language**:
```
✅ GOOD: "Your $50 payment for Samsung A14 was successful!"
❌ BAD:  "Transaction TXN-67890 processed successfully via EcoCash API"

✅ GOOD: "We couldn't process your payment. Please try again."
❌ BAD:  "Payment gateway returned HTTP 400 with error code INSUF_FUNDS"
```

**Include Key Information**:
- ✅ Amount (exact figure: "$50.00")
- ✅ Item/purpose ("Samsung A14 deposit")
- ✅ Reference number (LOAN-INV-12345)
- ✅ Next steps (what happens now)
- ❌ Technical jargon
- ❌ Error codes (unless customer support needs them)

### 3. Actionability

**Every Failed Payment Must Include**:
1. **What happened**: "Payment unsuccessful"
2. **Why it happened** (if known): "Insufficient balance"
3. **What to do next**: "Top up your wallet and try again"
4. **How to get help**: "Reply HELP for assistance"

**Example**:
```
❌ Payment Failed

Your $50 payment couldn't be processed due to insufficient funds.

Next Steps:
1. Top up your EcoCash wallet
2. Reply PAY to try again
3. Reply HELP if you need assistance

Valid until: 13 Jan, 5:30 PM
```

### 4. Reassurance

**Build Trust**:
```
✅ Successful Payment:
"✅ Payment Received! Your Samsung A14 is reserved for you.
We'll notify you once the device is ready for collection."

✅ Failed Payment:
"⚠️ Payment Unsuccessful. Don't worry - no money was deducted.
Please try again when ready."
```

**Avoid Blame/Shame**:
```
❌ BAD: "Your payment failed because you don't have enough money"
✅ GOOD: "Payment couldn't be processed. Please check your balance and try again"

❌ BAD: "You cancelled the payment"
✅ GOOD: "Payment cancelled. No money was deducted. Reply PAY when ready to continue"
```

### 5. Consistency

**Unified Message Format**:
- All payment notifications follow same structure
- Consistent emoji usage (✅ success, ⚠️ warning, ❌ error)
- Same tone and voice across all messages
- Predictable call-to-action format

---

## Notification Flow Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  PAYMENT FLOW WITH NOTIFICATIONS                             │
└─────────────────────────────────────────────────────────────┘

Customer initiates payment
         │
         ▼
┌─────────────────────────┐
│ 1. PAYMENT INITIATED    │ → WhatsApp: "Payment prompt sent"
└─────────────────────────┘
         │
         ▼
Customer completes payment on mobile money
         │
         ▼
┌─────────────────────────┐
│ 2. WEBHOOK RECEIVED     │
└─────────────────────────┘
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         ▼                                             ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│ Status: PAID            │                 │ Status: FAILED          │
│ Send SUCCESS message    │                 │ Send FAILED message     │
└─────────────────────────┘                 └─────────────────────────┘
         │                                             │
         ▼                                             ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│ Update Fineract         │                 │ Offer retry option      │
│ Update loan status      │                 │ Provide support         │
│ Send next steps         │                 │                         │
└─────────────────────────┘                 └─────────────────────────┘

         ├─────────────────────────────────────────────┤
         │                                             │
         ▼                                             ▼
┌─────────────────────────┐                 ┌─────────────────────────┐
│ Status: PENDING         │                 │ Status: TIMEOUT         │
│ Wait 2 minutes          │                 │ After 5 minutes         │
│ Send PENDING message    │                 │ Send TIMEOUT message    │
└─────────────────────────┘                 └─────────────────────────┘
```

### State Machine

```javascript
const PaymentStates = {
  INITIATED: 'initiated',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
};

const StateTransitions = {
  initiated: ['pending', 'paid', 'failed', 'cancelled'],
  pending: ['paid', 'failed', 'timeout'],
  paid: [], // Terminal state
  failed: [], // Terminal state
  timeout: ['paid', 'failed'], // Can still complete
  cancelled: [] // Terminal state
};

const NotificationTriggers = {
  initiated: 'immediate',
  pending: '2_minutes',
  paid: 'immediate',
  failed: 'immediate',
  timeout: '5_minutes',
  cancelled: 'immediate'
};
```

### Detailed Flow Diagram

```
PAYMENT INITIATED
       │
       │ Send: "Payment prompt sent to 0771234567"
       │ Channel: WhatsApp (within 24h window, freeform)
       │
       ▼
   Customer's Mobile
   [USSD Prompt: *151#]
       │
       ├─────────────┬─────────────┬─────────────┬─────────────┐
       │             │             │             │             │
       ▼             ▼             ▼             ▼             ▼
   APPROVED      INSUFFICIENT   CANCELLED    TIMEOUT     PENDING
                  BALANCE
       │             │             │             │             │
       │             │             │             │             │
       ▼             ▼             ▼             ▼             ▼
  WEBHOOK:      WEBHOOK:       WEBHOOK:      No Webhook   WEBHOOK:
  status=PAID   status=FAILED  status=       (5 min)      status=
                               CANCELLED                  PENDING
       │             │             │             │             │
       │             │             │             │             │
       ▼             ▼             ▼             ▼             ▼
Send SUCCESS   Send FAILED    Send CANCEL   Send TIMEOUT  Wait 2 min
WhatsApp       WhatsApp       WhatsApp      WhatsApp      then send
Template       Template       Template      Template      PENDING
                                                          Template
       │             │             │             │             │
       │             │             │             │             │
       ▼             ▼             ▼             ▼             ▼
Update Loan    Offer Retry    Clear         Mark for      Continue
Status to      Options        Session       Review        Monitoring
DEPOSIT_PAID                  State
```

---

## Successful Payment Notifications

### Immediate Success Message

**Template Name**: `payment_success`

**Category**: TRANSACTIONAL

**Message**:
```
✅ Payment Received!

Amount: ${{1}}
Reference: {{2}}
Device: {{3}}

Your deposit has been confirmed. We'll notify you
within 24 hours when your {{3}} is ready for collection.

Thank you for choosing Lynia Finance! 🎉

Reply HELP if you need assistance.
```

**Variables**:
```javascript
{
  "1": "50.00",          // amount
  "2": "LOAN-INV-12345", // reference
  "3": "Samsung A14"     // device model
}
```

**Rendered Message**:
```
✅ Payment Received!

Amount: $50.00
Reference: LOAN-INV-12345
Device: Samsung A14

Your deposit has been confirmed. We'll notify you
within 24 hours when your Samsung A14 is ready for
collection.

Thank you for choosing Lynia Finance! 🎉

Reply HELP if you need assistance.
```

### Success with Next Steps

**Template Name**: `payment_success_next_steps`

**Message**:
```
✅ Payment Successful - {{1}}

We've received your ${{2}} deposit for {{3}}.

📋 Next Steps:
1. We'll prepare your device (1-2 days)
2. You'll receive a collection notification
3. Visit our office with your ID

Collection Address:
{{4}}

Questions? Reply HELP

Reference: {{5}}
```

**Variables**:
```javascript
{
  "1": "Deposit Confirmed",
  "2": "50.00",
  "3": "Samsung A14",
  "4": "123 Main St, Harare",
  "5": "LOAN-INV-12345"
}
```

### Success with Receipt

**Template Name**: `payment_success_receipt`

**Message**:
```
✅ Payment Receipt

Customer: {{1}}
Phone: {{2}}
Date: {{3}}

Transaction Details:
━━━━━━━━━━━━━━━━━━━━
Device: {{4}}
Deposit: ${{5}}
Loan Amount: ${{6}}
Monthly Payment: ${{7}}
Duration: {{8}} months
━━━━━━━━━━━━━━━━━━━━

Reference: {{9}}
Status: PAID ✅

Keep this for your records.
```

**Use Case**: Sent 1-2 minutes after initial success message for record-keeping.

---

## Failed Payment Notifications

### General Failure Message

**Template Name**: `payment_failed`

**Message**:
```
⚠️ Payment Unsuccessful

Your ${{1}} payment for {{2}} could not be processed.

Reason: {{3}}

🔄 Try Again:
Reply PAY to retry your payment

💬 Need Help?
Reply HELP to speak with our team

Don't worry - no money was deducted from
your account.

Reference: {{4}}
Valid until: {{5}}
```

**Variables**:
```javascript
{
  "1": "50.00",
  "2": "Samsung A14 deposit",
  "3": "Insufficient funds",
  "4": "LOAN-INV-12345",
  "5": "13 Jan, 5:30 PM"
}
```

### Specific Failure Reasons

**Insufficient Balance**:
```
⚠️ Payment Unsuccessful

Your ${{1}} payment couldn't be processed due to
insufficient funds in your wallet.

Next Steps:
1. Top up your {{2}} wallet
2. Reply PAY to try again
3. Reply HELP for assistance

No money was deducted.

Reference: {{3}}
Valid until: {{4}}
```

**Variables**:
- {{1}}: Amount (e.g., "50.00")
- {{2}}: Provider (e.g., "EcoCash" or "O'mari")
- {{3}}: Reference
- {{4}}: Expiry time

**User Cancelled**:
```
Payment Cancelled

You cancelled the ${{1}} payment for {{2}}.

No money was deducted from your account.

Ready to continue?
Reply PAY to make the payment
Reply HELP if you need assistance

Your loan application is still valid until {{3}}.

Reference: {{4}}
```

**Technical Error**:
```
⚠️ Payment Processing Issue

We experienced a technical issue processing your
${{1}} payment. This was not due to your account.

What happened:
Our payment system is temporarily unavailable.

Next Steps:
• We'll retry automatically in 5 minutes
• Or reply PAY to try again now
• Reply HELP to speak with support

No money was deducted.

Reference: {{2}}
```

**Network Timeout**:
```
⚠️ Payment Status Unknown

Your ${{1}} payment was initiated but we haven't
received confirmation yet.

What this means:
• Payment may still be processing
• We're checking with {{2}}
• You'll receive an update within 15 minutes

⚠️ Please DO NOT retry payment yet to avoid
double charges.

We'll notify you once we confirm the status.

Reference: {{3}}
```

### Failed Payment with Retry Counter

**Template Name**: `payment_failed_retry`

**Message**:
```
⚠️ Payment Attempt {{1}} Failed

Your ${{2}} payment for {{3}} was unsuccessful.

Reason: {{4}}

Attempts: {{1}} of 3

🔄 Retry Payment:
Reply PAY to try again

Need a different payment method?
Reply HELP for options

Reference: {{5}}
Valid until: {{6}}
```

**Use Case**: Track retry attempts, offer alternative payment methods after 3 failures.

---

## Pending/Timeout Notifications

### Pending Payment (After 2 Minutes)

**Template Name**: `payment_pending`

**Message**:
```
⏳ Payment Processing

Your ${{1}} payment for {{2}} is still being
processed.

Status: Pending confirmation from {{3}}

This usually takes 1-5 minutes. We'll send you a
confirmation as soon as we receive it.

⚠️ Please don't retry payment to avoid being
charged twice.

Reference: {{4}}
Started: {{5}}
```

**Variables**:
```javascript
{
  "1": "50.00",
  "2": "Samsung A14",
  "3": "EcoCash",
  "4": "LOAN-INV-12345",
  "5": "2:30 PM"
}
```

### Timeout (After 5 Minutes)

**Template Name**: `payment_timeout`

**Message**:
```
⏱️ Payment Timed Out

Your ${{1}} payment session has expired without
completion.

What happened:
The payment prompt was sent but not completed
within the 5-minute window.

Next Steps:
1. Reply PAY to start a new payment
2. Check your {{2}} wallet balance
3. Reply HELP if you need assistance

No money was deducted from your account.

Reference: {{3}}
Valid until: {{4}}
```

### Extended Pending (After 15 Minutes)

**Template Name**: `payment_pending_extended`

**Message**:
```
🔍 Investigating Payment Status

Your ${{1}} payment is taking longer than expected
to confirm.

Current Status: Still pending with {{2}}

What we're doing:
• Checking with {{2}} directly
• Our team is investigating
• You'll receive an update within 1 hour

⚠️ Important:
Do NOT make another payment. We'll resolve this
and notify you.

Need urgent help? Reply URGENT

Reference: {{3}}
Started: {{4}}
```

**Use Case**: Rare scenario where webhook delayed or payment stuck in limbo.

---

## Notification Timing Strategy

### Timing Rules

| Event | Delay | Trigger | Priority |
|-------|-------|---------|----------|
| **Payment Initiated** | 0 sec | Immediate | Medium |
| **Payment Success** | 0-30 sec | Webhook | High |
| **Payment Failed** | 0-30 sec | Webhook | High |
| **Payment Cancelled** | 0-30 sec | Webhook | Medium |
| **Still Pending** | 2 min | Scheduled job | Medium |
| **Timeout** | 5 min | Scheduled job | High |
| **Extended Pending** | 15 min | Escalation | Critical |
| **Receipt/Summary** | 2 min | After success | Low |

### Implementation

**Immediate Notifications** (Webhook-Triggered):
```javascript
// Webhook handler
app.post('/api/webhooks/ecocash', async (req, res) => {
  // Respond immediately
  res.status(200).send('OK');

  // Process asynchronously
  setImmediate(async () => {
    const payment = await processWebhook(req.body);

    // Send notification immediately
    if (payment.status === 'PAID') {
      await sendWhatsApp(payment.customerPhone, 'payment_success', {
        "1": payment.amount,
        "2": payment.reference,
        "3": payment.deviceModel
      });
    } else if (payment.status === 'FAILED') {
      await sendWhatsApp(payment.customerPhone, 'payment_failed', {
        "1": payment.amount,
        "2": payment.deviceModel,
        "3": payment.failureReason,
        "4": payment.reference,
        "5": payment.expiryTime
      });
    }
  });
});
```

**Delayed Notifications** (Scheduled Jobs):
```javascript
// Check for pending payments every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  const pendingPayments = await db.payments.find({
    status: 'PENDING',
    notified: false,
    createdAt: {
      $lt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
    }
  });

  for (const payment of pendingPayments) {
    await sendWhatsApp(payment.customerPhone, 'payment_pending', {
      "1": payment.amount,
      "2": payment.deviceModel,
      "3": payment.provider,
      "4": payment.reference,
      "5": formatTime(payment.createdAt)
    });

    // Mark as notified
    await db.payments.updateOne(
      { _id: payment._id },
      { $set: { notified: true } }
    );
  }
});

// Check for timeouts every minute
cron.schedule('0 * * * * *', async () => {
  const timedOutPayments = await db.payments.find({
    status: 'PENDING',
    timeoutNotified: false,
    createdAt: {
      $lt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    }
  });

  for (const payment of timedOutPayments) {
    await sendWhatsApp(payment.customerPhone, 'payment_timeout', {
      "1": payment.amount,
      "2": payment.provider,
      "3": payment.reference,
      "4": payment.expiryTime
    });

    // Update status
    await db.payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: 'TIMEOUT',
          timeoutNotified: true
        }
      }
    );
  }
});
```

---

## WhatsApp Template Designs

### Template Submission Format

**All templates must be submitted to WhatsApp Business API for approval.**

**Template 1: payment_success**
```json
{
  "name": "payment_success",
  "category": "TRANSACTIONAL",
  "language": "en",
  "components": [
    {
      "type": "BODY",
      "text": "✅ Payment Received!\n\nAmount: ${{1}}\nReference: {{2}}\nDevice: {{3}}\n\nYour deposit has been confirmed. We'll notify you within 24 hours when your {{3}} is ready for collection.\n\nThank you for choosing Lynia Finance! 🎉\n\nReply HELP if you need assistance."
    },
    {
      "type": "FOOTER",
      "text": "Lynia Finance - Device Financing"
    }
  ]
}
```

**Template 2: payment_failed**
```json
{
  "name": "payment_failed",
  "category": "TRANSACTIONAL",
  "language": "en",
  "components": [
    {
      "type": "BODY",
      "text": "⚠️ Payment Unsuccessful\n\nYour ${{1}} payment for {{2}} could not be processed.\n\nReason: {{3}}\n\n🔄 Try Again:\nReply PAY to retry your payment\n\n💬 Need Help?\nReply HELP to speak with our team\n\nDon't worry - no money was deducted from your account.\n\nReference: {{4}}\nValid until: {{5}}"
    },
    {
      "type": "FOOTER",
      "text": "Lynia Finance"
    }
  ]
}
```

**Template 3: payment_pending**
```json
{
  "name": "payment_pending",
  "category": "TRANSACTIONAL",
  "language": "en",
  "components": [
    {
      "type": "BODY",
      "text": "⏳ Payment Processing\n\nYour ${{1}} payment for {{2}} is still being processed.\n\nStatus: Pending confirmation from {{3}}\n\nThis usually takes 1-5 minutes. We'll send you a confirmation as soon as we receive it.\n\n⚠️ Please don't retry payment to avoid being charged twice.\n\nReference: {{4}}\nStarted: {{5}}"
    }
  ]
}
```

**Template 4: payment_timeout**
```json
{
  "name": "payment_timeout",
  "category": "TRANSACTIONAL",
  "language": "en",
  "components": [
    {
      "type": "BODY",
      "text": "⏱️ Payment Timed Out\n\nYour ${{1}} payment session has expired without completion.\n\nWhat happened:\nThe payment prompt was sent but not completed within the 5-minute window.\n\nNext Steps:\n1. Reply PAY to start a new payment\n2. Check your {{2}} wallet balance\n3. Reply HELP if you need assistance\n\nNo money was deducted from your account.\n\nReference: {{3}}\nValid until: {{4}}"
    }
  ]
}
```

**Template 5: payment_receipt**
```json
{
  "name": "payment_receipt",
  "category": "TRANSACTIONAL",
  "language": "en",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Payment Receipt"
    },
    {
      "type": "BODY",
      "text": "Customer: {{1}}\nPhone: {{2}}\nDate: {{3}}\n\nTransaction Details:\n━━━━━━━━━━━━━━━━━━━━\nDevice: {{4}}\nDeposit: ${{5}}\nLoan Amount: ${{6}}\nMonthly Payment: ${{7}}\nDuration: {{8}} months\n━━━━━━━━━━━━━━━━━━━━\n\nReference: {{9}}\nStatus: PAID ✅\n\nKeep this for your records."
    },
    {
      "type": "FOOTER",
      "text": "Lynia Finance"
    }
  ]
}
```

### Template Approval Process

**Submission**:
```javascript
const { WhatsAppBusinessAPI } = require('whatsapp-business-api');

async function submitTemplate(template) {
  const response = await whatsappAPI.createMessageTemplate({
    name: template.name,
    category: template.category,
    language: template.language,
    components: template.components
  });

  console.log('Template submitted:', response.id);
  console.log('Status:', response.status); // PENDING, APPROVED, REJECTED
}
```

**Timeline**:
- Submission: Immediate
- Review: 24-48 hours (TRANSACTIONAL category)
- Approval: Automatic if complies with policy
- Rejection: Includes reason, can resubmit with changes

---

## Multi-Channel Notification Strategy

### Primary: WhatsApp

**Advantages**:
- ✅ 98% read rate within 3 minutes
- ✅ Rich media support (receipts, images)
- ✅ Two-way conversation (customer can reply)
- ✅ No cost per message (after Cloud API setup)
- ✅ High trust in Zimbabwe

**Use For**:
- All payment status updates
- Receipts and confirmations
- Support conversations

### Secondary: SMS (Fallback)

**Use Cases**:
- WhatsApp delivery failed
- Customer doesn't have WhatsApp
- Critical payment failures (backup channel)

**SMS Template (Success)**:
```
Lynia Finance: Payment received! $50.00 for Samsung A14.
Ref: LOAN-INV-12345. Device ready in 24h. Reply HELP for support.
```

**SMS Template (Failed)**:
```
Lynia Finance: Payment unsuccessful - insufficient funds.
Reply PAY to retry. Ref: LOAN-INV-12345. Help: 0771234567
```

**Character Limit**: 160 characters (1 SMS)

### Tertiary: Email (Record Keeping)

**Use Cases**:
- Detailed receipt (PDF attachment)
- Monthly statements
- Formal correspondence

**Not Used For**:
- Real-time payment notifications (too slow)
- Urgent communications

### Fallback Logic

```javascript
async function sendPaymentNotification(customer, payment, template) {
  let sent = false;

  // 1. Try WhatsApp (primary)
  try {
    await sendWhatsApp(customer.phone, template, payment);
    sent = true;
    logNotification('whatsapp', 'success', customer.id);
  } catch (error) {
    logNotification('whatsapp', 'failed', customer.id, error);
  }

  // 2. Fallback to SMS if WhatsApp failed
  if (!sent && customer.smsEnabled) {
    try {
      await sendSMS(customer.phone, generateSMSText(payment));
      sent = true;
      logNotification('sms', 'success', customer.id);
    } catch (error) {
      logNotification('sms', 'failed', customer.id, error);
    }
  }

  // 3. Email as last resort (for records)
  if (customer.email) {
    try {
      await sendEmail(customer.email, generateEmailReceipt(payment));
      logNotification('email', 'success', customer.id);
    } catch (error) {
      logNotification('email', 'failed', customer.id, error);
    }
  }

  // 4. Alert if all channels failed
  if (!sent) {
    await alertOps({
      severity: 'high',
      message: `Failed to notify customer ${customer.id} about payment ${payment.id}`,
      channels: ['whatsapp', 'sms']
    });
  }

  return sent;
}
```

---

## Error Handling and Retries

### Notification Delivery Failures

**WhatsApp Delivery Failures**:
```javascript
async function sendWhatsAppWithRetry(phone, template, variables, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await whatsappAPI.sendTemplate({
        to: phone,
        template: template,
        components: [
          {
            type: 'body',
            parameters: Object.values(variables).map(value => ({
              type: 'text',
              text: value
            }))
          }
        ]
      });

      // Success
      await logNotification('whatsapp', 'sent', phone, template);
      return result;

    } catch (error) {
      console.error(`WhatsApp send attempt ${attempt} failed:`, error.message);

      // Specific error handling
      if (error.code === 'RATE_LIMIT_HIT') {
        // Wait and retry
        await sleep(5000 * attempt); // Exponential backoff
        continue;
      }

      if (error.code === 'INVALID_PHONE') {
        // Don't retry, phone number invalid
        await logNotification('whatsapp', 'invalid_phone', phone);
        throw error;
      }

      if (error.code === 'TEMPLATE_NOT_APPROVED') {
        // Critical error, don't retry
        await alertOps({
          severity: 'critical',
          message: `Template ${template} not approved, cannot send notifications`
        });
        throw error;
      }

      // Generic error, retry
      if (attempt < maxRetries) {
        await sleep(2000 * attempt);
      } else {
        // Max retries reached, fallback to SMS
        await logNotification('whatsapp', 'failed_max_retries', phone);
        throw error;
      }
    }
  }
}
```

### Idempotency

**Prevent Duplicate Notifications**:
```javascript
async function sendPaymentNotification(payment, template) {
  // Check if already sent
  const existing = await db.notifications.findOne({
    paymentId: payment.id,
    template: template,
    status: 'sent'
  });

  if (existing) {
    console.log(`Notification already sent for payment ${payment.id}`);
    return existing;
  }

  // Create notification record
  const notification = await db.notifications.insertOne({
    paymentId: payment.id,
    customerId: payment.customerId,
    phone: payment.customerPhone,
    template: template,
    status: 'pending',
    attempts: 0,
    createdAt: new Date()
  });

  // Send notification
  try {
    await sendWhatsApp(payment.customerPhone, template, payment);

    // Mark as sent
    await db.notifications.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: 'sent',
          sentAt: new Date()
        },
        $inc: { attempts: 1 }
      }
    );

  } catch (error) {
    // Mark as failed
    await db.notifications.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: 'failed',
          error: error.message
        },
        $inc: { attempts: 1 }
      }
    );

    throw error;
  }

  return notification;
}
```

---

## Implementation Guide

### Step 1: Create WhatsApp Templates

**Submit all templates** to WhatsApp Business API for approval:

```bash
# Using WhatsApp Business API
POST https://graph.facebook.com/v18.0/{WABA_ID}/message_templates

{
  "name": "payment_success",
  "category": "TRANSACTIONAL",
  "language": "en",
  "components": [...]
}
```

**Wait for approval** (24-48 hours).

### Step 2: Implement Webhook Handler

**Process payment webhooks and trigger notifications**:

```javascript
// routes/webhooks.js
const express = require('express');
const router = express.Router();
const { sendPaymentNotification } = require('../services/notifications');

router.post('/ecocash', async (req, res) => {
  // Respond immediately
  res.status(200).send('OK');

  // Process asynchronously
  setImmediate(async () => {
    try {
      // Verify signature
      if (!verifySignature(req.body, req.headers['x-signature'])) {
        console.error('Invalid signature');
        return;
      }

      // Parse webhook
      const webhook = req.body;
      const payment = await processPayment(webhook);

      // Send notification based on status
      if (payment.status === 'PAID') {
        await sendPaymentNotification(payment, 'payment_success');

        // Send receipt 2 minutes later
        setTimeout(async () => {
          await sendPaymentNotification(payment, 'payment_receipt');
        }, 2 * 60 * 1000);

      } else if (payment.status === 'FAILED') {
        await sendPaymentNotification(payment, 'payment_failed');

      } else if (payment.status === 'CANCELLED') {
        await sendPaymentNotification(payment, 'payment_cancelled');
      }

    } catch (error) {
      console.error('Webhook processing error:', error);
    }
  });
});

module.exports = router;
```

### Step 3: Implement Scheduled Jobs

**Monitor pending payments and send timeout notifications**:

```javascript
// jobs/paymentMonitor.js
const cron = require('node-cron');

// Check every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  await checkPendingPayments();
  await checkTimeouts();
});

async function checkPendingPayments() {
  const pending = await db.payments.find({
    status: 'PENDING',
    pendingNotified: false,
    createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
  });

  for (const payment of pending) {
    await sendPaymentNotification(payment, 'payment_pending');
    await db.payments.updateOne(
      { _id: payment._id },
      { $set: { pendingNotified: true } }
    );
  }
}

async function checkTimeouts() {
  const timedOut = await db.payments.find({
    status: 'PENDING',
    createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
  });

  for (const payment of timedOut) {
    await sendPaymentNotification(payment, 'payment_timeout');
    await db.payments.updateOne(
      { _id: payment._id },
      { $set: { status: 'TIMEOUT' } }
    );
  }
}
```

### Step 4: Implement Notification Service

```javascript
// services/notifications.js
const { WhatsAppAPI } = require('../lib/whatsapp');

async function sendPaymentNotification(payment, templateName) {
  // Prevent duplicates
  const existing = await db.notifications.findOne({
    paymentId: payment.id,
    template: templateName,
    status: 'sent'
  });

  if (existing) return existing;

  // Build template variables
  const variables = buildTemplateVariables(payment, templateName);

  // Send via WhatsApp
  try {
    const result = await WhatsAppAPI.sendTemplate({
      to: payment.customerPhone,
      template: templateName,
      language: 'en',
      components: [
        {
          type: 'body',
          parameters: Object.values(variables).map(v => ({
            type: 'text',
            text: v
          }))
        }
      ]
    });

    // Log success
    await db.notifications.insertOne({
      paymentId: payment.id,
      template: templateName,
      status: 'sent',
      messageId: result.messageId,
      sentAt: new Date()
    });

    return result;

  } catch (error) {
    console.error('Notification failed:', error);

    // Fallback to SMS
    await sendSMSFallback(payment, templateName);

    throw error;
  }
}

function buildTemplateVariables(payment, templateName) {
  const base = {
    amount: payment.amount.toFixed(2),
    reference: payment.merchantReference,
    device: payment.metadata.deviceModel
  };

  if (templateName === 'payment_success') {
    return {
      "1": base.amount,
      "2": base.reference,
      "3": base.device
    };
  }

  if (templateName === 'payment_failed') {
    return {
      "1": base.amount,
      "2": base.device,
      "3": payment.failureReason || 'Unknown error',
      "4": base.reference,
      "5": formatExpiry(payment.expiresAt)
    };
  }

  // ... other templates
}

module.exports = { sendPaymentNotification };
```

### Step 5: Testing

**Test all notification scenarios**:

```javascript
// tests/notifications.test.js
describe('Payment Notifications', () => {
  it('should send success notification immediately', async () => {
    const payment = await createTestPayment({ status: 'PAID' });

    const result = await sendPaymentNotification(payment, 'payment_success');

    expect(result.status).toBe('sent');

    const notification = await db.notifications.findOne({
      paymentId: payment.id
    });

    expect(notification).toBeDefined();
    expect(notification.template).toBe('payment_success');
  });

  it('should send pending notification after 2 minutes', async () => {
    const payment = await createTestPayment({
      status: 'PENDING',
      createdAt: new Date(Date.now() - 3 * 60 * 1000) // 3 min ago
    });

    await checkPendingPayments();

    const notification = await db.notifications.findOne({
      paymentId: payment.id,
      template: 'payment_pending'
    });

    expect(notification).toBeDefined();
  });

  it('should handle duplicate notification attempts', async () => {
    const payment = await createTestPayment({ status: 'PAID' });

    await sendPaymentNotification(payment, 'payment_success');
    await sendPaymentNotification(payment, 'payment_success');

    const count = await db.notifications.countDocuments({
      paymentId: payment.id,
      template: 'payment_success'
    });

    expect(count).toBe(1); // Only one sent
  });
});
```

---

## Summary

### Notification Coverage

**6 Core Templates**:
1. ✅ `payment_success` - Immediate confirmation
2. ⚠️ `payment_failed` - With retry option
3. ⏳ `payment_pending` - After 2 minutes
4. ⏱️ `payment_timeout` - After 5 minutes
5. 📋 `payment_receipt` - Detailed record
6. ❌ `payment_cancelled` - User cancellation

### Key Principles

1. **Speed**: Notify within 30 seconds of status change
2. **Clarity**: Simple language, clear next steps
3. **Reassurance**: Build trust through transparency
4. **Action**: Always provide options to retry or get help
5. **Fallback**: SMS backup if WhatsApp fails

### Performance Targets

```
WhatsApp Delivery Success Rate: 98%+
Average Notification Delay: < 30 seconds
Customer Response Rate: 40%+ (to failed payments)
Support Inquiry Reduction: 60% (clear self-service)
```

### Next Steps (T021)

The next task will focus on documenting the loan disbursement process after deposit confirmation.

---

**End of T020 Research Document**
