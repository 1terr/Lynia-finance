# WhatsApp Bot Flow Specifications - Lynia Finance

**Project**: Lynia Finance
**Version**: 2.1
**Last Updated**: 2026-03-05

## Overview

This document specifies the conversation flows, message templates, and bot logic for Lynia Finance's WhatsApp customer service bot. The bot handles loan applications, KYC verification, payment processing, loan status inquiries, and customer support.

## Conversation States

The bot uses a 23-state machine stored in `whatsapp_sessions.current_state`:

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

// Session state is stored in whatsapp_sessions table with JSONB state_data
// Session timeout: 24 hours (resumes where customer left off)
```

### State Transition Diagram

```
welcome → phone_validation → personal_info_name → personal_info_dob
→ personal_info_gender → personal_info_location → employment_type
→ employment_income → employment_debts → employment_household
→ product_selection → kyc_id_upload → kyc_selfie_upload
→ kyc_processing → credit_scoring → device_selection → term_selection
→ loan_offer → terms_acceptance → completed

KYC verification gate (at credit_scoring):
  kyc_processing → credit_scoring
    IF kycSubmission.status === 'verified' → proceed to scoring
    IF kycSubmission.status !== 'verified' → "Your identity verification is still being processed..."
       (customer stays in credit_scoring state, can retry)

Back navigation (post-scoring):
  device_selection ← "back" → credit_scoring (re-fetch devices)
  term_selection   ← "back" → device_selection (re-show device list)
  loan_offer       ← "back" → term_selection (re-show term options)

KYC failure:
  kyc_processing → rejected (customer can restart with "Hi")

Score rejection:
  credit_scoring → rejected (score < 350, "KYC Not Verified", or failed KYC)
```

## Message Templates

### Template 1: Welcome Message (loan_application_welcome)

**Category**: TRANSACTIONAL
**Language**: English
**Approval Status**: Pending

```
Hello {{1}}! 👋

Welcome to Lynia Finance. We're here to help you get the smartphone you need with flexible financing.

To get started with your loan application, please reply with:
1️⃣ Apply for loan
2️⃣ Check loan status
3️⃣ Speak to support

*Lynia Finance - Empowering Zimbabwe's Digital Future*
```

**Parameters**:
- `{{1}}`: Customer's first name

**Usage**:
```typescript
await sendTemplate('loan_application_welcome', {
  to: '263771234567',
  params: ['John']
});
```

---

### Template 2: KYC Verification Request (kyc_verification_request)

**Category**: TRANSACTIONAL
**Language**: English

```
Hi {{1}},

To complete your loan application, we need to verify your identity.

Please provide:
📋 National ID Number
📸 Photo of your National ID (front & back)

Reply with your National ID number to continue.

*Keep your ID handy - we'll guide you through photo submission next.*
```

**Parameters**:
- `{{1}}`: Customer's first name

---

### Template 3: Loan Approved (loan_approved)

**Category**: TRANSACTIONAL
**Language**: English

```
🎉 Congratulations {{1}}!

Your loan application has been approved!

💰 Loan Amount: ${{2}}
📱 Device: {{3}}
📅 Repayment Period: {{4}} months
💳 Monthly Payment: ${{5}}

Visit our shop at {{6}} to collect your device.

*Note: Device will be locked until first payment is received.*

Reply ACCEPT to confirm, or DECLINE to cancel.
```

**Parameters**:
- `{{1}}`: Customer's first name
- `{{2}}`: Loan amount (e.g., "250")
- `{{3}}`: Device model (e.g., "Samsung Galaxy A14")
- `{{4}}`: Loan term (e.g., "12")
- `{{5}}`: Monthly installment (e.g., "25")
- `{{6}}`: Shop address

---

### Template 4: Payment Reminder (payment_reminder)

**Category**: TRANSACTIONAL
**Language**: English

```
Hi {{1}},

This is a friendly reminder that your payment of ${{2}} is due on {{3}}.

Outstanding balance: ${{4}}

Pay via:
1️⃣ EcoCash: Dial *151*2*2#
2️⃣ OneMoney: Dial *111#
3️⃣ Reply PAY to this message

Merchant Code: {{5}}
Reference: {{6}}

Thank you for choosing Lynia Finance!
```

**Parameters**:
- `{{1}}`: Customer's first name
- `{{2}}`: Payment amount due
- `{{3}}`: Due date (YYYY-MM-DD)
- `{{4}}`: Outstanding balance
- `{{5}}`: Merchant code
- `{{6}}`: Payment reference number

---

### Template 5: Payment Received (payment_received)

**Category**: TRANSACTIONAL
**Language**: English

```
✅ Payment Received!

Hi {{1}},

We've received your payment of ${{2}}.

Transaction Reference: {{3}}
Date: {{4}}

Remaining Balance: ${{5}}
Next Payment Due: {{6}}

Thank you for your payment! Your device remains unlocked.
```

**Parameters**:
- `{{1}}`: Customer's first name
- `{{2}}`: Payment amount
- `{{3}}`: Transaction reference
- `{{4}}`: Payment date
- `{{5}}`: Remaining balance
- `{{6}}`: Next due date

---

### Template 6: Device Locked Warning (device_lock_warning)

**Category**: TRANSACTIONAL
**Language**: English

```
⚠️ Payment Overdue - Device Lock Warning

Hi {{1}},

Your payment of ${{2}} was due on {{3}}. You are {{4}} days past due.

**Your device will be locked in 24 hours unless payment is received.**

To avoid device lock:
1. Make payment via EcoCash (*151*2*2#) or OneMoney (*111#)
2. Use Merchant Code: {{5}}
3. Reference: {{6}}

For assistance, reply HELP or call 0771234567.
```

**Parameters**:
- `{{1}}`: Customer's first name
- `{{2}}`: Amount due
- `{{3}}`: Original due date
- `{{4}}`: Days past due
- `{{5}}`: Merchant code
- `{{6}}`: Payment reference

---

### Template 7: Device Unlocked (device_unlocked)

**Category**: TRANSACTIONAL
**Language**: English

```
🔓 Device Unlocked Successfully!

Hi {{1}},

Your payment has been confirmed and your device has been unlocked.

You can now use your {{2}} normally.

Thank you for your payment! Keep up the good work.

Next Payment: ${{3}} due on {{4}}
```

**Parameters**:
- `{{1}}`: Customer's first name
- `{{2}}`: Device model
- `{{3}}`: Next payment amount
- `{{4}}`: Next due date

---

## Conversation Flows

### Flow 1: New Customer - Loan Application

```
┌─────────────────────────────────────────────────────────────┐
│ State: idle                                                  │
└─────────────────────────────────────────────────────────────┘
           │
           │ User: "Hi" / "Hello" / any message
           ▼
    ┌─────────────────────┐
    │ Bot: Welcome message│
    │ "How can I help?"   │
    │ 1. Apply for loan   │
    │ 2. Check status     │
    │ 3. Support          │
    └─────────────────────┘
           │
           │ User: "Apply" / "1" / "loan"
           ▼
┌─────────────────────────────────────────────────────────────┐
│ State: device_selection                                      │
└─────────────────────────────────────────────────────────────┘
           │
    ┌─────────────────────┐
    │ Bot: "Great! What   │
    │ device are you      │
    │ interested in?"     │
    │ [Show device list]  │
    └─────────────────────┘
           │
           │ User: "Samsung Galaxy A14"
           ▼
    ┌─────────────────────┐
    │ Bot: Save device    │
    │ "Please provide     │
    │ your National ID"   │
    └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ State: kyc_verification                                      │
└─────────────────────────────────────────────────────────────┘
           │
           │ User: "63-1234567X12"
           ▼
    ┌─────────────────────┐
    │ Bot: Validate ID    │
    │ "Please send photo  │
    │ of ID front"        │
    └─────────────────────┘
           │
           │ User: [image]
           ▼
    ┌─────────────────────┐
    │ Bot: "Now send      │
    │ photo of ID back"   │
    └─────────────────────┘
           │
           │ User: [image]
           ▼
    ┌─────────────────────┐
    │ Bot: "Processing... │
    │ We'll verify your   │
    │ ID within 24 hours" │
    └─────────────────────┘
           │
           │ [DIDIT verification completed]
           ▼
    ┌─────────────────────┐
    │ Bot: Send loan      │
    │ approval template   │
    │ with terms          │
    └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ State: loan_review                                           │
└─────────────────────────────────────────────────────────────┘
           │
           │ User: "ACCEPT"
           ▼
    ┌─────────────────────┐
    │ Bot: "Visit shop to │
    │ collect device"     │
    │ [Shop location]     │
    └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ State: idle (loan active)                                    │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 2: Existing Customer - Check Loan Status

```
┌─────────────────────────────────────────────────────────────┐
│ State: idle (with active loan)                               │
└─────────────────────────────────────────────────────────────┘
           │
           │ User: "status" / "check loan" / "balance"
           ▼
    ┌─────────────────────┐
    │ Bot: Query database │
    │ Get loan details    │
    └─────────────────────┘
           │
           ▼
    ┌─────────────────────┐
    │ Bot: Send loan info │
    │ - Status            │
    │ - Outstanding amt   │
    │ - Next payment date │
    │ - Days past due     │
    └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ State: idle                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 3: Payment Processing

```
┌─────────────────────────────────────────────────────────────┐
│ State: idle                                                  │
└─────────────────────────────────────────────────────────────┘
           │
           │ User: "pay" / "make payment"
           ▼
┌─────────────────────────────────────────────────────────────┐
│ State: payment                                               │
└─────────────────────────────────────────────────────────────┘
           │
    ┌─────────────────────┐
    │ Bot: Show payment   │
    │ options:            │
    │ 1. EcoCash          │
    │ 2. OneMoney         │
    │ 3. Cash at shop     │
    └─────────────────────┘
           │
           │ User: "1" / "EcoCash"
           ▼
    ┌─────────────────────┐
    │ Bot: Send payment   │
    │ instructions with   │
    │ merchant code &     │
    │ reference number    │
    └─────────────────────┘
           │
           │ User makes payment via USSD
           │ Webhook receives payment confirmation
           ▼
    ┌─────────────────────┐
    │ Bot: "Payment       │
    │ received! Thank you"│
    │ [Update balance]    │
    │ [Unlock device]     │
    └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ State: idle                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 4: Overdue Payment & Device Lock

```
┌─────────────────────────────────────────────────────────────┐
│ Scheduled Task: Check overdue loans daily @ 8:00 AM         │
└─────────────────────────────────────────────────────────────┘
           │
           │ For each customer with days_past_due > 0
           ▼
    ┌─────────────────────┐
    │ Check days overdue  │
    │                     │
    │ 1 day: Send reminder│
    │ 7 days: Send warning│
    │ 14 days: Lock device│
    └─────────────────────┘
           │
           │ If 14 days past due
           ▼
    ┌─────────────────────┐
    │ 1. Lock device via  │
    │    Trustonic API    │
    │ 2. Send lock        │
    │    notification     │
    │ 3. Update database  │
    └─────────────────────┘
           │
           │ Customer makes payment
           ▼
    ┌─────────────────────┐
    │ 1. Unlock device    │
    │ 2. Send unlock      │
    │    notification     │
    │ 3. Update database  │
    └─────────────────────┘
```

---

## Interactive Messages

### Interactive Button: Loan Application Start

```typescript
{
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: 'Welcome to Lynia Finance! Ready to get started?'
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: 'apply_loan',
            title: 'Apply for Loan'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'check_status',
            title: 'Check Status'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'support',
            title: 'Speak to Support'
          }
        }
      ]
    }
  }
}
```

---

### Interactive List: Device Selection

```typescript
{
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'Choose a device model:'
    },
    action: {
      button: 'Select Device',
      sections: [
        {
          title: 'Budget Phones ($150-$250)',
          rows: [
            {
              id: 'device_samsung_a14',
              title: 'Samsung Galaxy A14',
              description: '$180 - 12 months @ $18/mo'
            },
            {
              id: 'device_tecno_spark',
              title: 'Tecno Spark 10',
              description: '$150 - 12 months @ $15/mo'
            }
          ]
        },
        {
          title: 'Mid-Range Phones ($250-$400)',
          rows: [
            {
              id: 'device_samsung_a34',
              title: 'Samsung Galaxy A34',
              description: '$350 - 18 months @ $23/mo'
            },
            {
              id: 'device_xiaomi_redmi',
              title: 'Xiaomi Redmi Note 12',
              description: '$280 - 15 months @ $22/mo'
            }
          ]
        }
      ]
    }
  }
}
```

---

### Interactive Buttons: Payment Method Selection

```typescript
{
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: 'Choose your payment method:\n\nAmount Due: $25.00\nDue Date: 2025-12-15'
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: 'pay_ecocash',
            title: 'EcoCash'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'pay_onemoney',
            title: 'OneMoney'
          }
        },
        {
          type: 'reply',
          reply: {
            id: 'pay_cash',
            title: 'Cash at Shop'
          }
        }
      ]
    }
  }
}
```

---

## Error Handling

### Invalid National ID Format

```
❌ Invalid National ID format.

Zimbabwe National IDs should be in format: XX-XXXXXXX X XX
Example: 63-1234567A12

Please try again or reply HELP for assistance.
```

### KYC Verification Failed

```
❌ KYC Verification Failed

We were unable to verify your identity with the information provided.

Possible reasons:
- ID number doesn't match photo
- Photo quality too low
- ID document expired

Please try again or visit our office at:
123 Main Street, Harare

For assistance: 0771234567
```

### Payment Failed

```
❌ Payment Processing Failed

We encountered an error processing your payment.

Error Details: {{error_message}}

Please try again or contact support:
📞 0771234567
📧 support@lyniafinance.com
```

---

## Natural Language Processing

### Common User Intents

The bot should recognize these common phrases:

**Apply for Loan**:
- "apply", "loan", "get loan", "I want a phone", "financing", "installment"

**Check Status**:
- "status", "balance", "how much", "outstanding", "check loan", "my loan"

**Make Payment**:
- "pay", "payment", "send money", "ecocash", "onemoney"

**Support/Help**:
- "help", "support", "agent", "talk to someone", "problem", "issue"

**Device Locked**:
- "locked", "unlock", "device locked", "phone locked", "can't use phone"

---

## Business Rules

### Loan Eligibility

1. Customer must have a Zimbabwe phone number (+263)
2. National ID must be valid Zimbabwe format (XX-XXXXXXXAXX)
3. KYC verification via DIDIT must be **verified** before scoring begins
4. Credit score must be >= 350 for approval (below 350 = rejection)
5. Credit limit based on tier: Tier 1 ($200), Tier 2 ($500), Tier 3 ($2,000)
6. Deposit required before device handover (10-30% depending on tier)
7. Customers with failed or pending KYC are blocked from scoring (two-layer enforcement)

### KYC Requirements

1. National ID number (Zimbabwe format)
2. Clear photo of ID front
3. Clear photo of ID back
4. DIDIT verification must pass

### Payment Rules

1. Minimum payment: $10
2. Partial payments allowed
3. Early payment allowed (no penalty)
4. Late payment fee: $2 per week overdue

### Device Lock Policy

1. Grace period: 7 days after due date
2. Warning sent at day 7
3. Device locked at day 14
4. Device unlocked within 1 hour of payment confirmation

---

## Testing Scenarios

### Scenario 1: Happy Path - New Loan Application

1. User: "Hi"
2. Bot: Welcome message with options
3. User: "Apply for loan"
4. Bot: Request device selection
5. User: "Samsung Galaxy A14"
6. Bot: Request National ID
7. User: "63-1234567A12"
8. Bot: Request ID photo (front)
9. User: [sends image]
10. Bot: Request ID photo (back)
11. User: [sends image]
12. Bot: "Processing..."
13. Bot: Loan approved template
14. User: "ACCEPT"
15. Bot: Shop collection instructions

**Expected Database Changes**:
- New customer record created
- KYC verification initiated
- Loan record created (status: pending)
- WhatsApp messages logged

---

### Scenario 2: Payment and Unlock

1. User: "I want to pay"
2. Bot: Payment method selection
3. User: "EcoCash"
4. Bot: Payment instructions with merchant code
5. User makes payment via EcoCash
6. System receives webhook from EcoCash
7. Bot: "Payment received!" notification
8. System calls Trustonic unlock API
9. Bot: Device unlocked confirmation

**Expected Database Changes**:
- Payment record created
- Loan outstanding_balance_usd updated
- Device lock_status = 'unlocked'
- WhatsApp messages logged

---

### Scenario 3: Overdue Payment Warning

1. Scheduled task runs daily @ 8:00 AM
2. Detects customer 7 days overdue
3. Bot: Sends payment reminder with warning
4. Customer doesn't pay
5. Day 14: Bot sends final warning
6. System locks device via Trustonic
7. Bot: Device locked notification

**Expected Database Changes**:
- Loan days_past_due updated
- Device lock_status = 'locked'
- Device locked_at timestamp
- WhatsApp messages logged

---

## Deployment Checklist

Before launching the WhatsApp bot:

- [ ] All message templates approved by Meta
- [ ] Webhook URL configured and verified
- [ ] Environment variables set (tokens, phone number ID)
- [ ] Database tables created (whatsapp_messages, whatsapp_conversations)
- [ ] DIDIT integration tested
- [ ] EcoCash/OneMoney payment webhooks tested
- [ ] Trustonic device lock/unlock tested
- [ ] Error handling implemented
- [ ] Logging configured (CloudWatch)
- [ ] Rate limiting configured
- [ ] Customer support escalation process defined
- [ ] Privacy policy updated for WhatsApp data
- [ ] User testing completed with 5+ customers

---

## Implementation Status

All conversation flows are implemented and deployed to production:

- 23-state onboarding machine with session persistence (24h timeout)
- DIDIT KYC verification via synchronous API (not webhooks)
- KYC verification gate — scoring blocked until KYC status is `verified`
- Credit scoring with 3-tier approval and rejection below 350
- Device selection filtered by credit limit with real-time stock check
- Declining balance loan calculation with term selection
- Back navigation at device, term, and loan offer stages
- Fineract sync at 5 lifecycle points (non-blocking, SQS retry)
- Mobile money deposit matching via ID number reference

---

**Document Version**: 2.1
**Last Updated**: 2026-03-05
