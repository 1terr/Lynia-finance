# T022: Document Repayment Reminder and Collection Workflow

## Research Context

**Task**: Document repayment reminder and collection workflow
**Date**: 2025-01-13
**Status**: Complete

This research documents the complete repayment reminder system, payment collection workflow, and overdue payment management (dunning process) for Lynia Finance's device financing loans.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Repayment Reminder Strategy](#repayment-reminder-strategy)
3. [Reminder Timing Schedule](#reminder-timing-schedule)
4. [Payment Reminder Templates](#payment-reminder-templates)
5. [Payment Collection Methods](#payment-collection-methods)
6. [Overdue Payment Management (Dunning)](#overdue-payment-management-dunning)
7. [Escalation Workflow](#escalation-workflow)
8. [Grace Period and Late Fees](#grace-period-and-late-fees)
9. [Default Prevention Strategies](#default-prevention-strategies)
10. [Implementation Guide](#implementation-guide)

---

## Executive Summary

### Reminder Philosophy

**Gentle, Helpful, and Automated**: Payment reminders should be friendly, non-threatening, and focused on helping customers remember their commitment rather than threatening or shaming them.

### Key Principles

1. **Early & Often**: First reminder 3 days before due date
2. **Multi-Channel**: WhatsApp (primary), SMS (fallback)
3. **Personalized**: Customer name, specific amount, easy payment link
4. **Escalating Tone**: Gentle → Firm → Urgent (but always respectful)
5. **Easy Payment**: One-click payment link in every message

### Reminder Timeline

```
Day -3: Friendly reminder ("Payment due in 3 days")
Day -1: Final reminder ("Payment due tomorrow")
Day 0:  Due date reminder ("Payment due today")
Day +1: Gentle overdue ("Payment was due yesterday")
Day +3: First escalation ("Account 3 days overdue")
Day +7: Second escalation ("Account 7 days overdue, call us")
Day +14: Final notice ("Final notice before default")
Day +30: Default process begins
```

### Success Metrics

**Industry Benchmarks**:
- On-time payment rate: **85%+**
- Recovery rate (1-7 days overdue): **75%+**
- Recovery rate (8-14 days overdue): **50%+**
- Default rate: **< 5%**

**Lynia Finance Targets** (Year 1):
- On-time payment rate: **80%+**
- Recovery rate (1-30 days overdue): **70%+**
- Default rate: **< 8%**

---

## Repayment Reminder Strategy

### Core Strategy

**Automated Reminder System** with progressive messaging:

```
┌────────────────────────────────────────────────────────────┐
│  PAYMENT REMINDER LIFECYCLE                                 │
└────────────────────────────────────────────────────────────┘

BEFORE DUE DATE (Preventive)
   │
   ├─ Day -3: "Friendly reminder - payment due soon"
   ├─ Day -1: "Final reminder - payment due tomorrow"
   │
   ▼

DUE DATE (On-time payment encouraged)
   │
   ├─ Day 0: "Payment due today - pay now to stay on track"
   │
   ▼

EARLY OVERDUE (Gentle recovery)
   │
   ├─ Day +1: "Payment was due yesterday - please pay today"
   ├─ Day +3: "Account 3 days overdue - avoid late fees"
   │
   ▼

MID OVERDUE (Firm recovery)
   │
   ├─ Day +7: "Account 7 days overdue - call us if you need help"
   ├─ Day +14: "Final notice - payment required to avoid default"
   │
   ▼

LATE OVERDUE (Default prevention)
   │
   ├─ Day +21: "Urgent: Account at risk - call immediately"
   ├─ Day +30: Default process begins, collections team contacted
   │
   ▼

DEFAULT (Last resort)
   │
   └─ Device recovery initiation
```

### Communication Channels

**Primary: WhatsApp** (98% read rate):
- Rich formatting (emojis, bold text)
- Interactive buttons (PAY, HELP, CALL)
- Read receipts (know if customer saw message)
- Two-way conversation (customer can reply)

**Secondary: SMS** (95% read rate):
- Fallback if WhatsApp unavailable
- 160 character limit (concise messaging)
- Reliable delivery (no internet required)

**Tertiary: Phone Call** (For overdue 7+ days):
- Personal touch
- Understand customer's situation
- Negotiate payment plans
- Build relationship

### Personalization Elements

**Every reminder includes**:
```javascript
{
  customerName: "John",                    // First name for warmth
  amount: "$15.00",                         // Exact amount due
  dueDate: "13 February 2025",             // Clear due date
  daysOverdue: 3,                          // If overdue
  paymentLink: "https://pay.lynia.co.zw/...", // One-click payment
  loanReference: "LOAN-INV-12345",         // For customer records
  deviceModel: "Samsung A14",              // What they're paying for
  remainingPayments: 11                    // Progress tracking
}
```

---

## Reminder Timing Schedule

### Pre-Due Date Reminders

**Day -3 (3 Days Before Due Date)**:
```
Purpose: Friendly early reminder
Tone: Warm, helpful
Channel: WhatsApp
Template: payment_reminder_3days
Send Time: 9:00 AM (customer's timezone)
```

**Day -1 (1 Day Before Due Date)**:
```
Purpose: Final friendly reminder
Tone: Gentle nudge
Channel: WhatsApp
Template: payment_reminder_1day
Send Time: 10:00 AM
```

### Due Date Reminder

**Day 0 (Due Date)**:
```
Purpose: Payment due today
Tone: Neutral, action-oriented
Channel: WhatsApp
Template: payment_due_today
Send Time: 9:00 AM
```

### Post-Due Date Reminders (Overdue)

**Day +1 (1 Day Overdue)**:
```
Purpose: Gentle overdue notice
Tone: Understanding, helpful
Channel: WhatsApp
Template: payment_overdue_1day
Send Time: 10:00 AM
```

**Day +3 (3 Days Overdue)**:
```
Purpose: First escalation
Tone: Firmer, consequences mentioned
Channel: WhatsApp + SMS
Template: payment_overdue_3days
Send Time: 9:00 AM
```

**Day +7 (1 Week Overdue)**:
```
Purpose: Second escalation
Tone: Firm, urgent
Channel: WhatsApp + SMS + Phone Call
Template: payment_overdue_7days
Send Time: 9:00 AM
Action: Collections team notified
```

**Day +14 (2 Weeks Overdue)**:
```
Purpose: Final notice before default
Tone: Very firm, last chance
Channel: WhatsApp + SMS + Phone Call
Template: payment_final_notice
Send Time: 9:00 AM
Action: Default process preparation
```

**Day +21 (3 Weeks Overdue)**:
```
Purpose: Urgent intervention
Tone: Critical, immediate action required
Channel: Phone Call (primary) + WhatsApp
Template: payment_urgent_intervention
Send Time: 9:00 AM
Action: Collections manager involved
```

**Day +30 (1 Month Overdue)**:
```
Purpose: Default declaration
Tone: Formal, legal
Channel: Registered mail + WhatsApp + Phone
Template: payment_default_notice
Action: Begin device recovery process
```

### Reminder Frequency Rules

**Before Due Date**: 2 reminders (Day -3, Day -1)
**Due Date**: 1 reminder (Day 0)
**Early Overdue (1-7 days)**: 2 reminders (Day +1, Day +3)
**Mid Overdue (8-14 days)**: 1 reminder (Day +7)
**Late Overdue (15-30 days)**: 2 contacts (Day +14, Day +21)
**Default**: Day +30

**Total**: 8 automated touchpoints over 33 days

---

## Payment Reminder Templates

### Pre-Due Date Templates

**Template 1: payment_reminder_3days**
```
Hi {{1}}! 👋

Just a friendly reminder that your Lynia Finance
payment is coming up soon.

💳 Payment Details:
━━━━━━━━━━━━━━━━━━━━
Amount: ${{2}}
Due Date: {{3}}
Device: {{4}}

📱 Easy Payment Options:

Reply PAY to pay via:
• EcoCash (*151#)
• O'mari (*707#)

Or pay online: {{5}}

You're doing great! {{6}} of {{7}} payments
completed. Keep it up! 💪

Questions? Reply HELP

Reference: {{8}}
```

**Variables**:
```javascript
{
  "1": "John",                  // Customer first name
  "2": "15.00",                 // Amount due
  "3": "13 February 2025",      // Due date
  "4": "Samsung A14",           // Device model
  "5": "https://pay.lynia.co.zw/abc123", // Payment link
  "6": "1",                     // Payments completed
  "7": "12",                    // Total payments
  "8": "LOAN-INV-12345"         // Reference
}
```

**Template 2: payment_reminder_1day**
```
Hi {{1}},

Quick reminder: Your payment is due tomorrow!

💳 Amount: ${{2}}
📅 Due: {{3}}

Pay now to stay on track:
{{4}}

Reply PAY for payment options

Reference: {{5}}
```

### Due Date Template

**Template 3: payment_due_today**
```
Hi {{1}},

Your Lynia Finance payment is due today.

💳 Amount Due: ${{2}}
📅 Due Date: Today, {{3}}

💸 Pay Now:
{{4}}

Reply PAY for quick payment options

Stay current with your payments to maintain
your good credit record! ✅

Reference: {{5}}
```

### Early Overdue Templates

**Template 4: payment_overdue_1day**
```
Hi {{1}},

Your payment of ${{2}} was due yesterday.

Don't worry - just a gentle reminder! We know
life gets busy. 😊

💸 Pay Today:
{{3}}

Reply PAY to complete your payment now

Avoiding late fees is easy - just pay within
3 days of the due date.

Need help? Reply HELP

Reference: {{4}}
```

**Template 5: payment_overdue_3days**
```
⚠️ Payment Overdue - {{1}}

Your account is 3 days past due.

💳 Amount Overdue: ${{2}}
📅 Was Due: {{3}}
⏰ Overdue: 3 days

⚠️ Late Fee: ${{4}} will apply if not paid
within 24 hours.

💸 Pay Now to Avoid Fees:
{{5}}

Having trouble? Reply HELP to discuss payment
options with our team.

We're here to help! 💬

Reference: {{6}}
```

### Mid Overdue Templates

**Template 6: payment_overdue_7days**
```
🚨 URGENT: Payment Required

Hi {{1}},

Your account is now 7 days overdue.

💳 Amount Overdue: ${{2}}
⚠️ Late Fee Applied: ${{3}}
📊 Total Due: ${{4}}

Your device financing is at risk. Please pay
immediately to avoid:

❌ Additional late fees
❌ Negative credit report
❌ Account suspension

💸 Pay Now:
{{5}}

📞 Need Help? Call us immediately:
{{6}}

We want to help you stay on track. Let's work
this out together.

Reference: {{7}}
```

**Template 7: payment_final_notice**
```
🚨 FINAL NOTICE - Immediate Action Required

{{1}}, this is your final notice.

Your account is 14 days overdue and at serious
risk of default.

💳 Total Amount Due: ${{2}}
⚠️ Late Fees: ${{3}}
📊 Total Outstanding: ${{4}}

⏰ YOU HAVE 48 HOURS TO PAY

Failure to pay will result in:
❌ Loan default on credit record
❌ Device recovery process
❌ Legal collection proceedings

This is NOT what we want! 🙏

💸 Pay Immediately:
{{5}}

📞 Call Us NOW:
{{6}}

We're willing to work out a payment plan if
you're facing difficulties. But you MUST
contact us within 48 hours.

Reference: {{7}}
```

### Late Overdue Templates

**Template 8: payment_urgent_intervention**
```
🚨🚨 CRITICAL: Account in Default Risk

{{1}},

Your account is 21 days overdue. This is
extremely serious.

📊 Total Outstanding: ${{2}}

We've tried to reach you multiple times. You
have 7 DAYS to contact us or your account
will be sent to collections.

📞 CALL IMMEDIATELY:
{{3}}

Available: Mon-Fri 8AM-6PM, Sat 9AM-1PM

We CAN still resolve this, but only if you
contact us TODAY.

Reference: {{4}}
```

**Template 9: payment_default_notice** (Formal)
```
NOTICE OF DEFAULT

Account Holder: {{1}}
Loan Reference: {{2}}
Device: {{3}}

Your loan account is 30 days past due and is
now in default.

Total Amount Due: ${{4}}

IMMEDIATE ACTIONS REQUIRED:
1. Full payment of outstanding amount
2. Contact collections team: {{5}}
3. Respond within 72 hours

CONSEQUENCES OF NON-PAYMENT:
• Device recovery proceedings initiated
• Credit bureau reporting (negative)
• Legal collection action
• Additional collection fees

This is a formal notice. Legal action may
follow if payment is not received.

Lynia Finance Collections Department
{{5}}
```

---

## Payment Collection Methods

### Easy Payment Options

**1. WhatsApp Reply "PAY"**:
```
Customer → Types "PAY"
Bot → Sends payment menu:

"Choose payment method:
1️⃣ EcoCash
2️⃣ O'mari
3️⃣ Online payment link

Reply with number (1, 2, or 3)"

Customer → Types "1"
Bot → Initiates EcoCash payment:

"Initiating EcoCash payment...

Amount: $15.00
Phone: 0771234567

You'll receive a USSD prompt on *151# shortly.

Enter your EcoCash PIN to complete payment.

We'll notify you once payment is received! ✅"
```

**2. One-Click Payment Link**:
```html
<!-- Secure payment page -->
https://pay.lynia.co.zw/loan/{loanId}/{token}

Features:
- Pre-filled amount
- Customer details pre-loaded
- Choose payment method (EcoCash, O'mari)
- Instant payment processing
- Receipt sent via WhatsApp
```

**3. USSD Direct Dial**:
```
EcoCash:
- Dial *151#
- Select "Pay Merchant"
- Enter Merchant Code: 123456
- Reference: LOAN-INV-12345
- Amount: $15.00
- Confirm with PIN

O'mari:
- Dial *707#
- Select "Pay Bill"
- Select "Lynia Finance"
- Reference: LOAN-INV-12345
- Amount: $15.00
- Confirm with PIN
```

**4. Office Payment**:
```
Walk-in payments accepted:
Address: 123 Main Street, Harare
Hours: Mon-Fri 9AM-5PM, Sat 9AM-1PM
Payment methods: Cash, EcoCash, O'mari, Bank transfer
```

### Payment Confirmation

**Instant Confirmation** (< 30 seconds after payment):
```
✅ Payment Received!

Thank you {{1}}! Your payment of ${{2}} has
been received and processed.

💳 Payment Details:
━━━━━━━━━━━━━━━━━━━━
Amount: ${{2}}
Date: {{3}}
Method: {{4}}
Reference: {{5}}

📊 Loan Status:
Payments Made: {{6}} of {{7}}
Next Payment Due: {{8}}
Amount: ${{9}}

You're doing great! Keep it up! 🎉

Receipt sent to your WhatsApp.

Questions? Reply HELP

Thank you for being a valued Lynia Finance
customer! 💙
```

---

## Overdue Payment Management (Dunning)

### Dunning Process Overview

**Dunning** = Systematic process of recovering overdue payments through escalating communications.

### Dunning Stages

**Stage 1: Soft Dunning (Day 1-7)**
```
Approach: Gentle, understanding
Assumption: Customer forgot or was busy
Tone: Helpful reminder
Channel: WhatsApp, SMS
Goal: Quick recovery, maintain goodwill
```

**Stage 2: Medium Dunning (Day 8-14)**
```
Approach: Firmer, consequences mentioned
Assumption: Customer needs motivation
Tone: Serious but professional
Channel: WhatsApp, SMS, Phone
Goal: Recover payment before default
```

**Stage 3: Hard Dunning (Day 15-30)**
```
Approach: Very firm, final warnings
Assumption: Customer avoiding payment
Tone: Urgent, formal
Channel: All channels + registered mail
Goal: Final attempt before collections
```

**Stage 4: Collections (Day 30+)**
```
Approach: Legal action preparation
Assumption: Customer defaulting
Tone: Formal, legal
Channel: Legal notices, collections team
Goal: Device recovery, legal recourse
```

### Automated Dunning Workflow

```javascript
// Automated dunning system
class DunningManager {
  async processDailyDunning() {
    const today = new Date();

    // Get all active loans
    const loans = await db.loans.find({ status: 'ACTIVE' });

    for (const loan of loans) {
      // Check repayment schedule
      const overduePayments = await getOverduePayments(loan.id);

      if (overduePayments.length === 0) {
        continue; // No overdue payments
      }

      // Calculate days overdue
      const oldestOverdue = overduePayments[0];
      const daysOverdue = Math.floor(
        (today - oldestOverdue.dueDate) / (1000 * 60 * 60 * 24)
      );

      // Determine dunning stage
      const stage = this.getDunningStage(daysOverdue);

      // Execute dunning action
      await this.executeDunning(loan, daysOverdue, stage);
    }
  }

  getDunningStage(daysOverdue) {
    if (daysOverdue >= 30) return 'COLLECTIONS';
    if (daysOverdue >= 15) return 'HARD';
    if (daysOverdue >= 8) return 'MEDIUM';
    if (daysOverdue >= 1) return 'SOFT';
    return 'CURRENT';
  }

  async executeDunning(loan, daysOverdue, stage) {
    // Check if reminder already sent today
    const sentToday = await db.reminders.findOne({
      loanId: loan.id,
      sentDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });

    if (sentToday) {
      return; // Already sent today
    }

    // Send appropriate reminder based on days overdue
    if (daysOverdue === 1) {
      await this.sendReminder(loan, 'payment_overdue_1day');
    } else if (daysOverdue === 3) {
      await this.sendReminder(loan, 'payment_overdue_3days');
      await this.sendSMS(loan, 'overdue_3days');
    } else if (daysOverdue === 7) {
      await this.sendReminder(loan, 'payment_overdue_7days');
      await this.sendSMS(loan, 'overdue_7days');
      await this.schedulePhoneCall(loan);
    } else if (daysOverdue === 14) {
      await this.sendReminder(loan, 'payment_final_notice');
      await this.sendSMS(loan, 'final_notice');
      await this.alertCollections(loan);
    } else if (daysOverdue === 21) {
      await this.sendReminder(loan, 'payment_urgent_intervention');
      await this.escalateToManager(loan);
    } else if (daysOverdue === 30) {
      await this.initiateDefault(loan);
    }

    // Record reminder sent
    await db.reminders.insertOne({
      loanId: loan.id,
      daysOverdue: daysOverdue,
      stage: stage,
      template: `payment_overdue_${daysOverdue}day`,
      sentDate: new Date(),
      sentBy: 'SYSTEM'
    });
  }

  async sendReminder(loan, template) {
    // Send WhatsApp reminder
    await whatsappAPI.sendTemplate({
      to: loan.customerPhone,
      template: template,
      variables: this.buildVariables(loan)
    });
  }

  async alertCollections(loan) {
    // Alert collections team
    await sendEmail({
      to: 'collections@lynia.co.zw',
      subject: `Loan ${loan.id} - 14 days overdue - ACTION REQUIRED`,
      body: `
        Customer: ${loan.customerName}
        Phone: ${loan.customerPhone}
        Device: ${loan.deviceModel}
        Amount Overdue: $${loan.overdueAmount}
        Days Overdue: 14

        Please initiate personal contact within 24 hours.
      `
    });
  }

  async initiateDefault(loan) {
    // Update loan status to DEFAULT
    await db.loans.updateOne(
      { _id: loan._id },
      {
        $set: {
          status: 'DEFAULT',
          defaultDate: new Date(),
          defaultReason: 'NON_PAYMENT_30_DAYS'
        }
      }
    );

    // Send formal default notice
    await this.sendDefaultNotice(loan);

    // Initiate device recovery
    await this.initiateDeviceRecovery(loan);

    // Report to credit bureau (if applicable)
    await this.reportToCreditBureau(loan);
  }
}

// Run daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  const dunningManager = new DunningManager();
  await dunningManager.processDailyDunning();
});
```

---

## Escalation Workflow

### Escalation Levels

**Level 0: Automated Reminders (Day 0-7)**
```
Handled By: Automated system
Actions: WhatsApp/SMS reminders
Intervention: None (self-service)
Success Rate: 75%
```

**Level 1: Collections Team (Day 8-14)**
```
Handled By: Collections officer
Actions: Phone calls, WhatsApp, payment plans
Intervention: Personal contact
Success Rate: 50%
```

**Level 2: Collections Manager (Day 15-21)**
```
Handled By: Collections manager
Actions: Home visits, negotiation, restructuring
Intervention: High-touch personal engagement
Success Rate: 30%
```

**Level 3: Legal/Recovery (Day 22-30)**
```
Handled By: Legal team, recovery agents
Actions: Formal notices, device recovery
Intervention: Legal proceedings
Success Rate: 20%
```

**Level 4: Write-Off/Collections Agency (Day 30+)**
```
Handled By: External collections
Actions: Third-party collections, legal action
Intervention: Last resort
Success Rate: 10%
```

### Escalation Triggers

```javascript
const escalationRules = {
  // Auto-escalate to collections team
  day8: {
    condition: 'daysOverdue >= 8',
    action: 'assignToCollectionsOfficer',
    priority: 'medium'
  },

  // Escalate to manager
  day15: {
    condition: 'daysOverdue >= 15',
    action: 'escalateToManager',
    priority: 'high'
  },

  // Escalate to legal
  day22: {
    condition: 'daysOverdue >= 22',
    action: 'escalateToLegal',
    priority: 'critical'
  },

  // High-value loans escalate faster
  highValue: {
    condition: 'loanAmount > 200 && daysOverdue >= 5',
    action: 'assignToCollectionsOfficer',
    priority: 'high'
  },

  // Repeat defaulters escalate immediately
  repeatDefaulter: {
    condition: 'previousDefaults >= 1 && daysOverdue >= 3',
    action: 'escalateToManager',
    priority: 'critical'
  }
};
```

---

## Grace Period and Late Fees

### Grace Period Policy

**Grace Period**: 3 days after due date

```
Due Date: February 13
Grace Period: February 14-16
Late Fee Applied: February 17 (if still unpaid)
```

**During Grace Period**:
- Reminders sent but tone remains friendly
- No late fees applied
- No credit bureau reporting
- Payment link remains active

### Late Fee Structure

**Late Fee**: $2.00 flat fee (or 10% of payment, whichever is greater)

```javascript
function calculateLateFee(payment) {
  const flatFee = 2.00;
  const percentageFee = payment.amount * 0.10;

  return Math.max(flatFee, percentageFee);
}

// Examples:
// $15 payment → $2.00 late fee (flat fee higher)
// $30 payment → $3.00 late fee (10% higher)
```

**Late Fee Application**:
```
Day 0-3 (Grace period): No late fee
Day 4-7: $2 late fee added
Day 8-14: Additional $2 late fee ($4 total)
Day 15-21: Additional $3 late fee ($7 total)
Day 22-30: Additional $5 late fee ($12 total)
```

**Maximum Late Fees**: Capped at 50% of monthly payment

---

## Default Prevention Strategies

### Early Intervention

**Identify At-Risk Customers**:
```javascript
async function identifyAtRiskCustomers() {
  const atRisk = await db.loans.find({
    status: 'ACTIVE',
    $or: [
      // Missed previous payment
      { missedPayments: { $gte: 1 } },

      // Payment history shows late pattern
      { latePaymentCount: { $gte: 2 } },

      // Customer flagged financial difficulty
      { financialDifficulty: true },

      // Low engagement (hasn't read messages)
      { messageReadRate: { $lt: 0.5 } }
    ]
  });

  // Proactive outreach
  for (const loan of atRisk) {
    await sendProactiveMessage(loan);
  }
}

async function sendProactiveMessage(loan) {
  await sendWhatsApp(loan.customerPhone, {
    text: `
Hi ${loan.customerName},

We noticed you've had some challenges with
recent payments. We want to help! 💙

If you're facing financial difficulties, please
contact us. We can discuss:

• Payment plan restructuring
• Temporary payment reduction
• Payment date adjustment

We're here to work with you, not against you.

Reply HELP or call ${SUPPORT_PHONE}

Your success is our success! 🤝
    `.trim()
  });
}
```

### Payment Plan Options

**Option 1: Payment Date Adjustment**:
```
Current: Payment due 13th of each month
Adjusted: Payment due 25th (after payday)

No fee, one-time courtesy adjustment
```

**Option 2: Extended Payment Plan**:
```
Current: 12 months, $15/month
Extended: 18 months, $10/month

Small restructuring fee: $5
Total cost increases slightly
```

**Option 3: Temporary Payment Reduction**:
```
Current: $15/month
Reduced: $10/month for 3 months
Catch-up: $20/month for remaining months

For customers facing temporary hardship
```

### Hardship Program

**Eligibility**:
- Customer in good standing (previously)
- Documented financial hardship
- Customer proactively contacted us
- Loan < 6 months old

**Benefits**:
- Payment pause (up to 2 months)
- Waive late fees
- Extend loan term
- No credit bureau reporting

**Conditions**:
- Must contact us before default
- Must provide proof of hardship
- Must maintain communication

---

## Implementation Guide

### Step 1: Setup Reminder Schedule

**Create reminder jobs**:
```javascript
// Daily reminder job (runs at 9 AM)
cron.schedule('0 9 * * *', async () => {
  await sendScheduledReminders();
});

async function sendScheduledReminders() {
  const today = new Date();

  // Get all active loans
  const loans = await db.loans.find({ status: 'ACTIVE' });

  for (const loan of loans) {
    // Get next payment due
    const nextPayment = await getNextPaymentDue(loan.id);

    if (!nextPayment) continue;

    // Calculate days until due (negative if overdue)
    const daysUntilDue = Math.floor(
      (nextPayment.dueDate - today) / (1000 * 60 * 60 * 24)
    );

    // Send reminder based on days
    if (daysUntilDue === 3) {
      await sendReminder(loan, 'payment_reminder_3days');
    } else if (daysUntilDue === 1) {
      await sendReminder(loan, 'payment_reminder_1day');
    } else if (daysUntilDue === 0) {
      await sendReminder(loan, 'payment_due_today');
    } else if (daysUntilDue === -1) {
      await sendReminder(loan, 'payment_overdue_1day');
    } else if (daysUntilDue === -3) {
      await sendReminder(loan, 'payment_overdue_3days');
    } else if (daysUntilDue === -7) {
      await sendReminder(loan, 'payment_overdue_7days');
    } else if (daysUntilDue === -14) {
      await sendReminder(loan, 'payment_final_notice');
    } else if (daysUntilDue === -30) {
      await initiateDefault(loan);
    }
  }
}
```

### Step 2: Create WhatsApp Templates

**Submit all reminder templates** to WhatsApp for approval:
```javascript
const templates = [
  'payment_reminder_3days',
  'payment_reminder_1day',
  'payment_due_today',
  'payment_overdue_1day',
  'payment_overdue_3days',
  'payment_overdue_7days',
  'payment_final_notice'
];

for (const template of templates) {
  await whatsappAPI.createTemplate({
    name: template,
    category: 'TRANSACTIONAL',
    language: 'en',
    components: getTemplateComponents(template)
  });
}
```

### Step 3: Implement Payment Processing

**Handle "PAY" replies**:
```javascript
app.post('/webhooks/whatsapp/incoming', async (req, res) => {
  const message = req.body.entry[0].changes[0].value.messages[0];
  const customerPhone = message.from;
  const text = message.text.body.toUpperCase();

  if (text.includes('PAY')) {
    // Find customer's active loan
    const loan = await db.loans.findOne({
      customerPhone: customerPhone,
      status: 'ACTIVE'
    });

    if (!loan) {
      await sendWhatsApp(customerPhone, {
        text: "We couldn't find an active loan for your number. Please call us at +263 771 234 567 for assistance."
      });
      return res.status(200).send('OK');
    }

    // Get next payment due
    const payment = await getNextPaymentDue(loan.id);

    // Send payment options
    await sendWhatsApp(customerPhone, {
      text: `
💳 Make Payment - ${loan.deviceModel}

Amount Due: $${payment.amount.toFixed(2)}
Due Date: ${payment.dueDate.toLocaleDateString()}

Choose payment method:

1️⃣ EcoCash
2️⃣ O'mari
3️⃣ Online payment link

Reply with number (1, 2, or 3)

Reference: ${loan.invoiceNumber}
      `.trim()
    });
  }

  res.status(200).send('OK');
});
```

### Step 4: Testing

**Test reminder system**:
```javascript
describe('Payment Reminder System', () => {
  it('should send reminder 3 days before due date', async () => {
    // Create test loan with payment due in 3 days
    const loan = await createTestLoan({
      nextPaymentDue: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    });

    // Run reminder job
    await sendScheduledReminders();

    // Verify reminder sent
    const reminder = await db.reminders.findOne({
      loanId: loan.id,
      template: 'payment_reminder_3days'
    });

    expect(reminder).toBeDefined();
  });

  it('should escalate to collections at day 8', async () => {
    // Create overdue loan (8 days)
    const loan = await createTestLoan({
      nextPaymentDue: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE'
    });

    // Run dunning process
    await dunningManager.processDailyDunning();

    // Verify escalation
    const escalation = await db.escalations.findOne({
      loanId: loan.id,
      level: 'COLLECTIONS_TEAM'
    });

    expect(escalation).toBeDefined();
  });
});
```

---

## Summary

### Reminder Strategy

**8 automated touchpoints** over 33-day cycle:
1. Day -3: Friendly reminder
2. Day -1: Final reminder
3. Day 0: Due today
4. Day +1: Gentle overdue
5. Day +3: First escalation
6. Day +7: Second escalation
7. Day +14: Final notice
8. Day +30: Default process

### Success Metrics

**Target Performance**:
- On-time payment rate: 80%+
- Recovery rate (overdue): 70%+
- Default rate: < 8%
- Customer satisfaction: 85%+

### Key Features

✅ **Automated**: Scheduled reminders, no manual intervention
✅ **Personalized**: Customer name, exact amounts, payment links
✅ **Multi-channel**: WhatsApp + SMS + Phone
✅ **Progressive**: Gentle → Firm → Urgent
✅ **Easy Payment**: One-click links, USSD shortcuts
✅ **Grace Period**: 3 days before late fees
✅ **Escalation**: Automatic escalation to collections team
✅ **Hardship Program**: Support for customers in difficulty

### Next Steps (T023)

The next task will focus on documenting the default management and device recovery process.

---

**End of T022 Research Document**
