# Payment Notification Design

**Task ID**: P1-T023
**Phase**: Phase 1 - Payment Processing Design
**Priority**: Medium
**Estimated**: 4 hours
**Dependencies**: P1-T021, P1-T008

---

## Table of Contents
1. [Overview](#overview)
2. [Notification Types](#notification-types)
3. [Notification Channels](#notification-channels)
4. [Message Templates](#message-templates)
5. [Delivery Logic](#delivery-logic)
6. [Receipt Generation](#receipt-generation)
7. [Implementation](#implementation)

---

## 1. Overview

Payment notifications keep customers informed about the status of their loan repayments in real-time. Clear, timely notifications improve customer satisfaction and reduce support inquiries.

### Notification Goals

- **Transparency**: Customer always knows payment status
- **Reassurance**: Immediate confirmation of successful payments
- **Recovery**: Quick guidance when payments fail
- **Engagement**: Proactive reminders for upcoming payments

---

## 2. Notification Types

### 2.1 Payment Confirmation (Successful)

**Trigger**: Payment status changes to 'completed'
**Priority**: High
**Delivery**: Immediate (within 30 seconds)

**Content**:
- Payment amount
- Loan reference
- New loan balance
- Receipt number
- Next payment due date

---

### 2.2 Payment Failed

**Trigger**: Payment status changes to 'failed'
**Priority**: High
**Delivery**: Immediate

**Content**:
- Failure reason
- Suggested actions
- Alternative payment methods
- Support contact

---

### 2.3 Payment Pending

**Trigger**: Payment initiated but awaiting confirmation (> 2 minutes)
**Priority**: Medium
**Delivery**: 2 minutes after initiation

**Content**:
- Payment is being processed
- Expected confirmation time
- What to do if delayed

---

### 2.4 Payment Retry Reminder

**Trigger**: Previous payment failed, customer hasn't retried
**Priority**: Medium
**Delivery**: 24 hours after failed payment

**Content**:
- Failed payment amount
- Retry payment link
- Support contact

---

### 2.5 Partial Payment Acknowledgment

**Trigger**: Customer pays less than full amount
**Priority**: High
**Delivery**: Immediate

**Content**:
- Amount received
- Remaining balance
- Next payment instructions

---

### 2.6 Overpayment Credit

**Trigger**: Customer pays more than required
**Priority**: High
**Delivery**: Immediate

**Content**:
- Overpayment amount
- Credit balance
- How credit will be applied

---

## 3. Notification Channels

### 3.1 Primary Channel: WhatsApp

**Advantages**:
- Customer already using WhatsApp for bot
- Rich formatting (bold, lists, buttons)
- Read receipts
- Free for us

**Message Types**:
- Text messages
- Interactive buttons
- List messages (for receipts)

---

### 3.2 Secondary Channel: SMS

**Use Cases**:
- WhatsApp delivery fails
- Customer opts out of WhatsApp
- Critical notifications (payment failures)

**Limitations**:
- 160 character limit
- No rich formatting
- Costs ~$0.02 per SMS

---

### 3.3 Email (Future)

**Use Cases**:
- Monthly statements
- Receipts for accounting
- KYC documents

**Priority**: Phase 2+

---

## 4. Message Templates

### 4.1 Payment Confirmation Template

```
✅ *Payment Received!*

Amount: *$50.00*
Loan: *#LN-12345*
Date: Nov 27, 2025, 10:30 AM

New loan balance: $150.00
Next payment: $50.00 due Dec 27, 2025

Receipt: #RCP-001
Download: [View Receipt]

Thank you for your payment! 💚
```

**Template Variables**:
```typescript
interface PaymentConfirmationTemplate {
  amount: number;
  loan_id: string;
  payment_date: Date;
  new_balance: number;
  next_payment_amount: number;
  next_payment_date: Date;
  receipt_id: string;
  receipt_url: string;
}
```

---

### 4.2 Payment Failed Template

```
❌ *Payment Failed*

Amount: $50.00
Loan: #LN-12345
Reason: Insufficient EcoCash balance

*What to do next:*
1. Check your EcoCash balance
2. Top up if needed
3. Try payment again: [Pay Now]

Need help? Reply HELP or call +263771234567
```

**Template Variables**:
```typescript
interface PaymentFailedTemplate {
  amount: number;
  loan_id: string;
  failure_reason: string;
  retry_payment_url: string;
  support_phone: string;
}
```

**Failure Reasons** (User-Friendly):
| Technical Reason | User Message |
|-----------------|--------------|
| `INSUFFICIENT_FUNDS` | "Insufficient EcoCash balance" |
| `TRANSACTION_TIMEOUT` | "Payment timed out. Please try again." |
| `INVALID_PIN` | "Incorrect PIN entered" |
| `ACCOUNT_BLOCKED` | "EcoCash account temporarily unavailable" |
| `NETWORK_ERROR` | "Network connection error" |

---

### 4.3 Payment Pending Template

```
⏳ *Payment Processing...*

Amount: $50.00
Loan: #LN-12345

Your payment is being processed. You'll receive confirmation within 5 minutes.

If you don't receive confirmation, please contact support: +263771234567
```

---

### 4.4 Partial Payment Template

```
✅ *Partial Payment Received*

Amount paid: *$30.00*
Loan: *#LN-12345*

Remaining balance: *$20.00*

Please pay the remaining $20.00 to complete your repayment: [Pay $20]

Thank you!
```

---

### 4.5 Overpayment Credit Template

```
✅ *Payment Received!*

Amount paid: *$60.00*
Loan repayment: $50.00
Overpayment: *$10.00* 💰

Your $10.00 overpayment has been credited to your account and will be automatically applied to your next payment.

Available credit: $10.00

Thank you!
```

---

## 5. Delivery Logic

### 5.1 Notification Delivery Flow

```typescript
async function sendPaymentNotification(
  payment: Payment,
  notificationType: 'confirmation' | 'failed' | 'pending' | 'partial' | 'overpayment'
): Promise<void> {

  // Step 1: Fetch customer and loan details
  const customer = await getCustomer(payment.customer_id);
  const loan = await getLoan(payment.loan_id);

  // Step 2: Generate notification content
  const notification = await generateNotificationContent(payment, loan, notificationType);

  // Step 3: Attempt delivery via primary channel (WhatsApp)
  try {
    await whatsappService.sendMessage(customer.phone_number, {
      type: 'text',
      text: notification.message
    });

    // Log successful delivery
    await logNotification({
      payment_id: payment.id,
      customer_id: customer.id,
      type: notificationType,
      channel: 'whatsapp',
      status: 'delivered',
      delivered_at: new Date()
    });

  } catch (error) {
    console.error('WhatsApp delivery failed', error);

    // Step 4: Fallback to SMS
    try {
      await smsService.sendSMS(customer.phone_number, notification.message_sms);

      await logNotification({
        payment_id: payment.id,
        customer_id: customer.id,
        type: notificationType,
        channel: 'sms',
        status: 'delivered',
        delivered_at: new Date()
      });

    } catch (smsError) {
      console.error('SMS delivery also failed', smsError);

      // Log failure
      await logNotification({
        payment_id: payment.id,
        customer_id: customer.id,
        type: notificationType,
        channel: 'failed',
        status: 'failed',
        error: smsError.message
      });
    }
  }
}
```

---

### 5.2 Notification Deduplication

Prevent sending duplicate notifications:

```typescript
async function shouldSendNotification(
  payment_id: string,
  notification_type: string
): Promise<boolean> {

  // Check if this notification was already sent within last 5 minutes
  const { data: recentNotifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('payment_id', payment_id)
    .eq('type', notification_type)
    .eq('status', 'delivered')
    .gte('delivered_at', fiveMinutesAgo());

  return recentNotifications.length === 0;
}
```

---

## 6. Receipt Generation

### 6.1 Receipt Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      PAYMENT RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Lynia Finance*
+263 77 123 4567
support@lyniafinance.co.zw

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Receipt No: #RCP-20251127-001
Date: November 27, 2025, 10:30 AM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Customer Details*
Name: John Doe
Phone: +263 77 987 6543
Loan ID: #LN-12345

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Payment Details*
Amount Paid:         $50.00
Payment Method:      EcoCash
Transaction Ref:     PAY-12345678

Previous Balance:    $200.00
Payment:            -$50.00
New Balance:         $150.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Next Payment*
Amount:              $50.00
Due Date:            December 27, 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for your payment!

Questions? Reply HELP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 6.2 Receipt Generation Logic

```typescript
async function generatePaymentReceipt(payment: Payment): Promise<string> {

  const customer = await getCustomer(payment.customer_id);
  const loan = await getLoan(payment.loan_id);

  // Calculate balances
  const previousBalance = loan.amount_paid - payment.amount + loan.principal;
  const newBalance = loan.principal - loan.amount_paid;

  // Generate receipt ID
  const receiptId = `RCP-${format(new Date(), 'yyyyMMdd')}-${payment.id.slice(0, 6)}`;

  // Store receipt record
  await supabase.from('payment_receipts').insert({
    id: receiptId,
    payment_id: payment.id,
    customer_id: customer.id,
    loan_id: loan.id,
    amount: payment.amount,
    generated_at: new Date()
  });

  // Generate receipt text
  const receipt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      PAYMENT RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Lynia Finance*
+263 77 123 4567
support@lyniafinance.co.zw

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Receipt No: #${receiptId}
Date: ${format(new Date(), 'MMMM dd, yyyy, HH:mm a')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Customer Details*
Name: ${customer.first_name} ${customer.last_name}
Phone: ${customer.phone_number}
Loan ID: #${loan.id.slice(0, 8).toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Payment Details*
Amount Paid:         $${payment.amount.toFixed(2)}
Payment Method:      ${payment.gateway}
Transaction Ref:     ${payment.gateway_transaction_id}

Previous Balance:    $${previousBalance.toFixed(2)}
Payment:            -$${payment.amount.toFixed(2)}
New Balance:         $${newBalance.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Next Payment*
Amount:              $${loan.monthly_repayment_amount.toFixed(2)}
Due Date:            ${format(loan.next_payment_date, 'MMMM dd, yyyy')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for your payment!

Questions? Reply HELP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  return receipt;
}
```

---

## 7. Implementation

### 7.1 Database Schema

```sql
-- Notifications log table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  payment_id UUID REFERENCES payments(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Notification details
  type VARCHAR(50) NOT NULL,  -- 'confirmation', 'failed', 'pending', etc.
  channel VARCHAR(20) NOT NULL,  -- 'whatsapp', 'sms', 'email'
  status VARCHAR(20) NOT NULL,  -- 'delivered', 'failed', 'pending'

  -- Content
  message TEXT NOT NULL,
  error TEXT,

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment receipts table
CREATE TABLE payment_receipts (
  id VARCHAR(50) PRIMARY KEY,  -- e.g., RCP-20251127-001

  payment_id UUID NOT NULL REFERENCES payments(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  loan_id UUID NOT NULL REFERENCES loans(id),

  amount DECIMAL(10,2) NOT NULL,
  receipt_content TEXT NOT NULL,

  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  viewed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_payment_id ON notifications(payment_id);
CREATE INDEX idx_notifications_customer_id ON notifications(customer_id);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);
CREATE INDEX idx_payment_receipts_payment_id ON payment_receipts(payment_id);
```

---

### 7.2 WhatsApp Service Integration

```typescript
// src/services/whatsapp/send-payment-notification.ts

export async function sendPaymentConfirmation(payment: Payment): Promise<void> {

  const customer = await getCustomer(payment.customer_id);
  const loan = await getLoan(payment.loan_id);
  const receipt = await generatePaymentReceipt(payment);

  // Send confirmation message with receipt
  await whatsappService.sendMessage(customer.phone_number, {
    type: 'text',
    text: `✅ *Payment Received!*

Amount: *$${payment.amount.toFixed(2)}*
Loan: *#${loan.id.slice(0, 8).toUpperCase()}*
Date: ${format(new Date(), 'MMM dd, yyyy, HH:mm a')}

New loan balance: $${(loan.principal - loan.amount_paid).toFixed(2)}
Next payment: $${loan.monthly_repayment_amount.toFixed(2)} due ${format(loan.next_payment_date, 'MMM dd, yyyy')}

Receipt: #${receipt.id}

Thank you for your payment! 💚`,
    preview_url: false
  });

  // Send full receipt as follow-up
  await whatsappService.sendMessage(customer.phone_number, {
    type: 'text',
    text: receipt.receipt_content,
    preview_url: false
  });
}
```

---

### 7.3 Notification Queue

For high-volume scenarios, use a queue:

```typescript
// Add notification to queue (SQS or Supabase Realtime)
export async function queuePaymentNotification(
  payment: Payment,
  notificationType: string
): Promise<void> {

  await supabase.from('notification_queue').insert({
    payment_id: payment.id,
    customer_id: payment.customer_id,
    type: notificationType,
    status: 'pending',
    scheduled_for: new Date(),
    created_at: new Date()
  });
}

// Worker to process notification queue (scheduled Lambda)
export async function processNotificationQueue(): Promise<void> {

  const { data: pendingNotifications } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date())
    .order('created_at', { ascending: true })
    .limit(100);

  for (const notification of pendingNotifications) {
    try {
      const payment = await getPayment(notification.payment_id);
      await sendPaymentNotification(payment, notification.type);

      await supabase.from('notification_queue').update({
        status: 'sent',
        sent_at: new Date()
      }).eq('id', notification.id);

    } catch (error) {
      console.error('Notification failed', error);

      await supabase.from('notification_queue').update({
        status: 'failed',
        error: error.message,
        retry_count: supabase.raw('retry_count + 1')
      }).eq('id', notification.id);
    }
  }
}
```

---

## Summary

**Payment Notification Deliverables**:
- ✅ **6 Notification Types**: Confirmation, failed, pending, partial, overpayment, retry
- ✅ **Multi-Channel**: WhatsApp (primary), SMS (fallback)
- ✅ **Receipt Generation**: Formatted receipts for all successful payments
- ✅ **Delivery Tracking**: Log all notification attempts and delivery status
- ✅ **Deduplication**: Prevent duplicate notifications
- ✅ **User-Friendly Messages**: Clear, actionable guidance

**Key Features**:
- Real-time delivery (< 30 seconds)
- Automatic fallback to SMS
- Formatted receipts
- Retry logic for failed deliveries

**Next Steps**:
1. Implement notification templates
2. Set up WhatsApp Business API templates (submit to Meta)
3. Integrate with payment service
4. Proceed to P1-T024 (Payment Retry Logic)

---

**References**:
- WhatsApp Message Templates: whatsapp-message-templates.md
- Payment Gateway Integration: payment-gateway-integration.md
