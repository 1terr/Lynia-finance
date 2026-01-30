# WhatsApp Message Templates

**Document**: P1-T008 - WhatsApp Message Template Specifications
**Status**: Complete
**Last Updated**: 2025-11-24
**Owner**: Product & Engineering Team

## Table of Contents
1. [Overview](#overview)
2. [Template Requirements & Guidelines](#template-requirements--guidelines)
3. [Template Categories](#template-categories)
4. [Category 1: Welcome & Onboarding](#category-1-welcome--onboarding)
5. [Category 2: KYC & Verification](#category-2-kyc--verification)
6. [Category 3: Loan Notifications](#category-3-loan-notifications)
7. [Category 4: Payment Reminders](#category-4-payment-reminders)
8. [Category 5: Device Management](#category-5-device-management)
9. [Category 6: Customer Support](#category-6-customer-support)
10. [Category 7: Account Updates](#category-7-account-updates)
11. [Multi-Language Support](#multi-language-support)
12. [Interactive Components](#interactive-components)
13. [Rich Media Templates](#rich-media-templates)
14. [Meta Submission Process](#meta-submission-process)
15. [Template Management](#template-management)

---

## 1. Overview

### 1.1 WhatsApp Business API Templates

**What are Message Templates?**
Pre-approved message formats required for businesses to initiate conversations with customers outside the 24-hour customer service window.

**Why Templates?**
- **Prevent spam**: Meta reviews all templates before approval
- **User protection**: Ensures messages are relevant and useful
- **Compliance**: Meets WhatsApp Business Policy requirements
- **Consistency**: Maintains professional communication standards

**Template Structure**:
```
┌─────────────────────────────────────┐
│ HEADER (optional)                   │
│ • Text, Image, Video, or Document   │
├─────────────────────────────────────┤
│ BODY (required)                     │
│ • Main message text                 │
│ • Up to 1024 characters             │
│ • Supports variables {{1}}, {{2}}   │
├─────────────────────────────────────┤
│ FOOTER (optional)                   │
│ • Small text below body             │
│ • Max 60 characters                 │
├─────────────────────────────────────┤
│ BUTTONS (optional)                  │
│ • Quick replies (up to 3)           │
│ • Call-to-action (up to 2)          │
│ • URL buttons                       │
└─────────────────────────────────────┘
```

### 1.2 Template Categories (Meta)

| Category | Use Case | Approval Time |
|----------|----------|---------------|
| **Utility** | Transactional, account updates | Fast (~1 hour) |
| **Authentication** | OTP, verification codes | Fast (~1 hour) |
| **Marketing** | Promotional offers, announcements | Slow (24-48 hours) |

**Lynia Finance Usage**: Primarily **Utility** and **Authentication** templates

---

## 2. Template Requirements & Guidelines

### 2.1 Meta's Template Policies

**✅ ALLOWED**:
- Transactional updates (payment confirmations, loan status)
- Account notifications (KYC approved, credit limit changed)
- Appointment reminders (distributor visit)
- Shipping updates (device ready for pickup)
- Customer service follow-ups

**❌ PROHIBITED**:
- Spam or unsolicited marketing
- Abusive, threatening, or illegal content
- Misleading information
- Overly promotional language
- Sensitive content (gambling, adult content, etc.)

### 2.2 Template Best Practices

**Language**:
- ✅ Clear, concise, professional
- ✅ Use customer's preferred language
- ✅ Grade 8 reading level (simple English)
- ❌ No excessive capitalization or punctuation!!!
- ❌ No emojis in template text (can add when sending)

**Personalization**:
- ✅ Use customer name: {{1}}
- ✅ Include relevant IDs: {{2}}
- ✅ Show amounts: {{3}}
- ❌ Don't overuse variables (max 4-5 per template)

**Call-to-Action**:
- ✅ Clear next steps
- ✅ Actionable buttons
- ✅ Relevant links
- ❌ No multiple CTAs (confusing)

**Length**:
- Body: Max 1024 characters (aim for 200-300)
- Header: Max 60 characters
- Footer: Max 60 characters
- Button text: Max 25 characters

### 2.3 Variable Placeholders

**Format**: `{{1}}`, `{{2}}`, `{{3}}`, etc.

**Naming Convention** (internal tracking):
```json
{
  "template_name": "payment_reminder",
  "variables": [
    {"index": 1, "name": "customer_name", "example": "John"},
    {"index": 2, "name": "amount", "example": "$47.81"},
    {"index": 3, "name": "due_date", "example": "Dec 24, 2025"},
    {"index": 4, "name": "loan_id", "example": "#LYN12345"}
  ]
}
```

**Best Practices**:
- Keep examples realistic (Meta reviews examples)
- Use actual Zimbabwe formats (phone: +263771234567)
- Show currency as USD (Zimbabwe uses US dollars)
- Date format: MMM DD, YYYY (Dec 24, 2025)

---

## 3. Template Categories

### 3.1 Template Inventory

| Category | # Templates | Priority | Status |
|----------|-------------|----------|--------|
| Welcome & Onboarding | 3 | High | 📝 Ready for submission |
| KYC & Verification | 5 | High | 📝 Ready for submission |
| Loan Notifications | 6 | High | 📝 Ready for submission |
| Payment Reminders | 5 | Critical | 📝 Ready for submission |
| Device Management | 4 | High | 📝 Ready for submission |
| Customer Support | 3 | Medium | 📝 Ready for submission |
| Account Updates | 4 | Medium | 📝 Ready for submission |
| **TOTAL** | **30** | - | - |

### 3.2 Template Naming Convention

**Format**: `{category}_{action}_{language}`

**Examples**:
- `welcome_new_user_en`
- `kyc_approved_en`
- `payment_reminder_3day_en`
- `loan_approved_en`
- `device_locked_warning_en`

---

## 4. Category 1: Welcome & Onboarding

### Template 1.1: Welcome New User

**Name**: `welcome_new_user_en`
**Category**: Utility
**Language**: English

```
HEADER: None

BODY:
Welcome to Lynia Finance, {{1}}!

We help you get smartphones on credit with flexible 8-month payment plans.

Here's how it works:
1. Verify your identity (10 minutes)
2. Choose your device ($200-$500)
3. Get instant approval
4. Collect from nearest distributor

Your credit limit: {{2}}

Ready to start?

FOOTER: Lynia Finance

BUTTONS:
[Get Started] [Learn More] [Contact Us]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = credit_limit (example: "$200")
```

**Meta Submission JSON**:
```json
{
  "name": "welcome_new_user_en",
  "category": "UTILITY",
  "language": "en",
  "components": [
    {
      "type": "BODY",
      "text": "Welcome to Lynia Finance, {{1}}!\n\nWe help you get smartphones on credit with flexible 8-month payment plans.\n\nHere's how it works:\n1. Verify your identity (10 minutes)\n2. Choose your device ($200-$500)\n3. Get instant approval\n4. Collect from nearest distributor\n\nYour credit limit: {{2}}\n\nReady to start?",
      "example": {
        "body_text": [["John", "$200"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Lynia Finance"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "Get Started"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Learn More"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Contact Us"
        }
      ]
    }
  ]
}
```

### Template 1.2: Onboarding Reminder

**Name**: `onboarding_reminder_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, you started signing up with Lynia Finance but didn't finish.

You're just {{2}} away from getting your smartphone on credit!

Complete your verification now to unlock:
- Credit limit up to $500
- 50+ devices to choose from
- Same-day approval

Tap below to continue where you left off.

FOOTER: Complete in 10 minutes

BUTTONS:
[Complete Verification]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = steps_remaining (example: "2 steps")
```

### Template 1.3: Welcome Back Returning Customer

**Name**: `welcome_back_customer_en`
**Category**: Utility
**Language**: English

```
BODY:
Welcome back, {{1}}!

Great news! Your credit limit has been increased.

Previous limit: {{2}}
New limit: {{3}}

You can now:
- Get higher-value devices
- Qualify for better terms
- Access exclusive offers

Start browsing our latest devices!

FOOTER: Thanks for being a valued customer

BUTTONS:
[Browse Devices] [View My Account]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = old_credit_limit (example: "$200")
{{3}} = new_credit_limit (example: "$350")
```

---

## 5. Category 2: KYC & Verification

### Template 2.1: KYC Approved

**Name**: `kyc_approved_en`
**Category**: Utility
**Language**: English

```
BODY:
Great news, {{1}}! Your identity has been verified.

Your Lynia Finance account is now active.

Account Details:
- Credit Limit: {{2}}
- Credit Score: {{3}}
- Status: Active

You can now browse devices and apply for loans.

FOOTER: Verification successful

BUTTONS:
[Browse Devices] [View Profile]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = credit_limit (example: "$200")
{{3}} = credit_score (example: "720")
```

### Template 2.2: KYC Rejected

**Name**: `kyc_rejected_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, we couldn't verify your identity.

Reason: {{2}}

Common issues:
- ID photo is blurry or unclear
- Selfie doesn't match ID photo
- Document is expired

You can retry verification with:
- Clearer photos
- Better lighting
- Valid documents

Tap below to try again or contact our support team.

FOOTER: We're here to help

BUTTONS:
[Retry Verification] [Contact Support]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = rejection_reason (example: "Photo quality too low")
```

### Template 2.3: KYC Manual Review

**Name**: `kyc_manual_review_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your verification is under manual review.

Submission ID: {{2}}

Our team is reviewing your documents. This usually takes 2-4 hours during business hours.

We'll notify you as soon as the review is complete.

Business Hours:
Monday-Friday: 8AM - 6PM
Saturday: 9AM - 1PM

FOOTER: Thank you for your patience

BUTTONS:
[Check Status] [Contact Support]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = submission_id (example: "#KYC67890")
```

### Template 2.4: KYC Document Expiry Warning

**Name**: `kyc_expiry_warning_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your ID document is expiring soon.

National ID: {{2}}
Expires: {{3}}

Please update your ID to continue using Lynia Finance.

To update:
1. Get your new ID
2. Upload clear photos
3. We'll verify in 24 hours

Failure to update may result in service suspension.

FOOTER: Update before {{3}}

BUTTONS:
[Update ID Now] [Remind Me Later]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = national_id_masked (example: "63-123***-A-**")
{{3}} = expiry_date (example: "Jan 15, 2026")
```

### Template 2.5: OTP Verification

**Name**: `otp_verification_en`
**Category**: Authentication
**Language**: English

```
BODY:
Your Lynia Finance verification code is: {{1}}

This code expires in {{2}} minutes.

DO NOT share this code with anyone, including Lynia Finance staff.

FOOTER: Lynia Finance Security

VARIABLES:
{{1}} = otp_code (example: "123456")
{{2}} = expiry_minutes (example: "5")
```

---

## 6. Category 3: Loan Notifications

### Template 3.1: Loan Approved

**Name**: `loan_approved_en`
**Category**: Utility
**Language**: English

```
HEADER: [Image: Celebration graphic]

BODY:
Congratulations, {{1}}! Your loan has been approved.

Loan Details:
- Loan ID: {{2}}
- Device: {{3}}
- Amount: {{4}}
- Monthly Payment: {{5}}
- First Payment: {{6}}

Next Steps:
1. Visit your nearest distributor
2. Present your National ID
3. Collect your device

Bring this message and your ID to collect your device.

FOOTER: Device ready for pickup

BUTTONS:
[Find Distributor] [View Loan Details] [Contact Us]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = loan_amount (example: "$299")
{{5}} = monthly_payment (example: "$47.81")
{{6}} = first_payment_date (example: "Dec 24, 2025")
```

### Template 3.2: Loan Rejected

**Name**: `loan_rejected_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, we couldn't approve your loan application.

Application ID: {{2}}
Reason: {{3}}

This doesn't mean you can't get a loan. You can:
- Try a lower loan amount
- Choose a cheaper device (under {{4}})
- Build your credit history
- Reapply in 30 days

Our support team can help you understand your options.

FOOTER: We're here to help

BUTTONS:
[Browse Cheaper Devices] [Contact Support] [View My Credit]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = application_id (example: "#APP67890")
{{3}} = rejection_reason (example: "Insufficient credit history")
{{4}} = credit_limit (example: "$200")
```

### Template 3.3: Loan Manual Review

**Name**: `loan_manual_review_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your loan application needs additional review.

Loan ID: {{2}}
Device: {{3}}
Amount: {{4}}

Our credit team will review your application within 2-4 hours during business hours.

We'll notify you as soon as we have a decision.

FOOTER: Review in progress

BUTTONS:
[Check Status] [Contact Support]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = loan_amount (example: "$299")
```

### Template 3.4: Loan Disbursed

**Name**: `loan_disbursed_en`
**Category**: Utility
**Language**: English

```
BODY:
Great news, {{1}}! Your device has been assigned.

Loan ID: {{2}}
Device: {{3}}
IMEI: {{4}}

The distributor has confirmed your device pickup.

Important Reminders:
- First payment due: {{5}}
- Monthly payment: {{6}}
- Device lock: Activated (unlocks after payment 7+ days late)

Make payments on time to avoid late fees and device lock.

FOOTER: Enjoy your new device!

BUTTONS:
[Set Payment Reminder] [View Payment Schedule]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = imei (example: "123456******345")
{{5}} = first_payment_date (example: "Dec 24, 2025")
{{6}} = monthly_payment (example: "$47.81")
```

### Template 3.5: Loan Paid Off

**Name**: `loan_paid_off_en`
**Category**: Utility
**Language**: English

```
HEADER: [Image: Congratulations graphic]

BODY:
Congratulations, {{1}}! You've paid off your loan.

Loan ID: {{2}}
Device: {{3}}
Total Paid: {{4}}
Paid in: {{5}} months

Your device is now fully yours! Device lock has been permanently disabled.

Credit Profile Updated:
- Credit Score: {{6}} (+60 points!)
- New Credit Limit: {{7}}
- Qualification: Tier {{8}}

You now qualify for:
- Larger loans (up to {{7}})
- Better devices
- Faster approvals

FOOTER: Thank you for being a great customer

BUTTONS:
[Browse Devices] [Refer a Friend] [View Credit Profile]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = total_paid (example: "$382.50")
{{5}} = months_taken (example: "8")
{{6}} = new_credit_score (example: "780")
{{7}} = new_credit_limit (example: "$500")
{{8}} = credit_tier (example: "2")
```

### Template 3.6: Loan Default Notice

**Name**: `loan_default_notice_en`
**Category**: Utility
**Language**: English

```
BODY:
URGENT: {{1}}, your loan is in default.

Loan ID: {{2}}
Days Overdue: {{3}}
Amount Due: {{4}}

Your account has been flagged for default due to non-payment.

Consequences:
- Device permanently locked
- Credit score severely impacted
- Legal action may be taken
- Collections process initiated

This is your final notice. Contact us immediately to:
- Set up a payment plan
- Resolve your account
- Avoid further action

FOOTER: Immediate action required

BUTTONS:
[Pay Now] [Contact Support] [Set Up Payment Plan]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = days_overdue (example: "45")
{{4}} = amount_due (example: "$235.48")
```

---

## 7. Category 4: Payment Reminders

### Template 4.1: Payment Reminder (3 Days Before)

**Name**: `payment_reminder_3day_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your loan payment is due soon.

Loan ID: {{2}}
Amount Due: {{3}}
Due Date: {{4}} (in 3 days)

Pay early to:
- Avoid late fees ($5/day)
- Keep your device unlocked
- Maintain good credit score

Tap below to pay now via EcoCash, EcoCash/Omari/Innbucks/OneWallet, or Bank Transfer.

FOOTER: Pay on time, stay on track

BUTTONS:
[Pay Now] [View Payment Details] [Set Reminder]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = amount_due (example: "$47.81")
{{4}} = due_date (example: "Dec 24, 2025")
```

### Template 4.2: Payment Due Today

**Name**: `payment_due_today_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your payment is due TODAY.

Loan ID: {{2}}
Amount Due: {{3}}
Due Date: {{4}} (today)

Late fee starts tomorrow: $5/day

Pay now to avoid:
- Late fees
- Device lock (at 7 days overdue)
- Credit score impact

We accept EcoCash, EcoCash/Omari/Innbucks/OneWallet, and Bank Transfer.

FOOTER: Pay today to avoid late fees

BUTTONS:
[Pay Now] [Need Help?]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = amount_due (example: "$47.81")
{{4}} = due_date (example: "Dec 24, 2025")
```

### Template 4.3: Payment Overdue (1 Day)

**Name**: `payment_overdue_1day_en`
**Category**: Utility
**Language**: English

```
BODY:
URGENT: {{1}}, your payment is now overdue.

Loan ID: {{2}}
Amount Due: {{3}} (includes $5 late fee)
Days Overdue: 1 day

Your payment was due yesterday. Pay immediately to avoid:
- Additional late fees ($5/day)
- Device lock (at 7 days overdue)
- Credit score damage

We understand things happen. If you're having trouble, contact us to discuss payment options.

FOOTER: Pay now to avoid device lock

BUTTONS:
[Pay Now] [Having Trouble? Chat]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = amount_due (example: "$52.81")
```

### Template 4.4: Device Lock Warning (7 Days Overdue)

**Name**: `device_lock_warning_en`
**Category**: Utility
**Language**: English

```
BODY:
URGENT: {{1}}, your device will be locked in 24 hours.

Loan ID: {{2}}
Amount Due: {{3}}
Days Overdue: {{4}}

Your payment is 7 days late. If not paid within 24 hours, your device will be locked.

Locked device restrictions:
- Emergency calls only (911, 112)
- No apps, browsing, or messaging
- Unlocks within 30 minutes of payment

Total due (including late fees): {{3}}

Pay now to avoid device lock.

FOOTER: 24 hours to pay

BUTTONS:
[Pay Now to Avoid Lock] [Contact Support]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = total_due (example: "$82.81")
{{4}} = days_overdue (example: "7")
```

### Template 4.5: Payment Received Confirmation

**Name**: `payment_received_en`
**Category**: Utility
**Language**: English

```
BODY:
Thank you, {{1}}! Your payment has been received.

Receipt Details:
- Receipt ID: {{2}}
- Amount: {{3}}
- Method: {{4}}
- Date: {{5}}

Updated Loan Status:
- Loan ID: {{6}}
- Paid: {{7}} of {{8}} payments
- Balance: {{9}}
- Next Payment: {{10}} on {{11}}

Your payment has been applied to your account. Thank you for paying on time!

FOOTER: Payment successful

BUTTONS:
[Email Receipt] [View Loan Details]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = receipt_id (example: "#PAY67890")
{{3}} = amount (example: "$47.81")
{{4}} = payment_method (example: "EcoCash")
{{5}} = payment_date (example: "Nov 24, 2025 14:32")
{{6}} = loan_id (example: "#LYN12345")
{{7}} = payments_made (example: "3")
{{8}} = total_payments (example: "8")
{{9}} = balance (example: "$239.07")
{{10}} = next_payment (example: "$47.81")
{{11}} = next_due_date (example: "Jan 24, 2026")
```

---

## 8. Category 5: Device Management

### Template 5.1: Device Locked

**Name**: `device_locked_en`
**Category**: Utility
**Language**: English

```
BODY:
NOTICE: {{1}}, your device has been locked.

Loan ID: {{2}}
Device: {{3}}
Reason: Payment overdue ({{4}} days)

Your device is now restricted to emergency calls only.

To unlock your device:
1. Pay the overdue amount: {{5}}
2. Device unlocks within 30 minutes
3. Full functionality restored

While locked, you can:
- Make emergency calls (911, 112)
- View this message

FOOTER: Pay to unlock immediately

BUTTONS:
[Pay Now to Unlock] [Contact Support]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = days_overdue (example: "8")
{{5}} = amount_due (example: "$87.81")
```

### Template 5.2: Device Unlocked

**Name**: `device_unlocked_en`
**Category**: Utility
**Language**: English

```
BODY:
Great news, {{1}}! Your device has been unlocked.

Loan ID: {{2}}
Device: {{3}}
Unlocked: {{4}}

Your payment has been received and your device is now fully functional.

Thank you for resolving your payment. To avoid future locks:
- Set payment reminders
- Enable auto-pay
- Pay on time (due date: every 24th)

Current Balance: {{5}}
Next Payment: {{6}} on {{7}}

FOOTER: Device now active

BUTTONS:
[Set Payment Reminder] [Enable Auto-Pay]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = unlock_time (example: "Nov 24, 2025 15:05")
{{5}} = balance (example: "$239.07")
{{6}} = next_payment (example: "$47.81")
{{7}} = next_due_date (example: "Jan 24, 2026")
```

### Template 5.3: Device Ready for Pickup

**Name**: `device_ready_pickup_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your device is ready for pickup!

Loan ID: {{2}}
Device: {{3}}

Pickup Details:
Distributor: {{4}}
Address: {{5}}
Phone: {{6}}

Business Hours:
Monday-Friday: 9AM - 6PM
Saturday: 9AM - 2PM

What to bring:
1. Your National ID ({{7}})
2. This message
3. Loan ID: {{2}}

The distributor will verify your identity and activate your device.

FOOTER: Bring your National ID

BUTTONS:
[Get Directions] [Call Distributor] [View Loan Details]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = distributor_name (example: "Harare Main Branch")
{{5}} = distributor_address (example: "123 Main St, Harare")
{{6}} = distributor_phone (example: "+263771234567")
{{7}} = national_id_masked (example: "63-123***-A-**")
```

### Template 5.4: Device Warranty Claim

**Name**: `device_warranty_claim_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your warranty claim has been received.

Claim ID: {{2}}
Device: {{3}}
Issue: {{4}}

Your claim is being reviewed. We'll contact you within 24-48 hours.

What happens next:
1. Our team reviews your claim
2. We determine if it's covered under warranty
3. You'll receive repair or replacement instructions

Warranty Coverage:
- Manufacturing defects: Yes
- Physical damage: No
- Water damage: No

FOOTER: Claim under review

BUTTONS:
[Check Claim Status] [Contact Support]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = claim_id (example: "#WAR12345")
{{3}} = device_name (example: "Samsung Galaxy A14")
{{4}} = issue_description (example: "Screen not turning on")
```

---

## 9. Category 6: Customer Support

### Template 6.1: Support Ticket Created

**Name**: `support_ticket_created_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, we've received your support request.

Ticket ID: {{2}}
Category: {{3}}
Priority: {{4}}

Your issue is important to us. A support agent will respond within {{5}}.

Support Hours:
Monday-Friday: 8AM - 6PM
Saturday: 9AM - 1PM
Sunday: Closed

You can track your ticket status anytime.

FOOTER: We're here to help

BUTTONS:
[Check Ticket Status] [Add More Details] [Call Support]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = ticket_id (example: "#SUP12345")
{{3}} = category (example: "Payment Issue")
{{4}} = priority (example: "High")
{{5}} = response_time (example: "2 hours")
```

### Template 6.2: Support Ticket Resolved

**Name**: `support_ticket_resolved_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your support ticket has been resolved.

Ticket ID: {{2}}
Issue: {{3}}
Resolution: {{4}}

Was this helpful?

Your feedback helps us improve our service. Please rate your experience:

FOOTER: Ticket closed

BUTTONS:
[5 Stars] [4 Stars] [3 Stars] [2 Stars] [1 Star]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = ticket_id (example: "#SUP12345")
{{3}} = issue_summary (example: "Payment not reflecting")
{{4}} = resolution_summary (example: "Payment confirmed, account updated")
```

### Template 6.3: Agent Escalation

**Name**: `agent_escalation_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, you're being connected to a human agent.

Your issue: {{2}}

Agent {{3}} will chat with you shortly.

Estimated wait time: {{4}} minutes

While you wait, please have ready:
- Your Loan ID
- Any relevant screenshots
- Your National ID (if needed)

FOOTER: Connecting to agent...

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = issue_summary (example: "Payment not reflecting")
{{3}} = agent_name (example: "Sarah")
{{4}} = wait_time (example: "3")
```

---

## 10. Category 7: Account Updates

### Template 7.1: Credit Limit Increased

**Name**: `credit_limit_increased_en`
**Category**: Utility
**Language**: English

```
HEADER: [Image: Celebration graphic]

BODY:
Great news, {{1}}! Your credit limit has been increased.

Previous Limit: {{2}}
New Limit: {{3}}
Increase: {{4}}

Why?
- On-time payment history
- Improved credit score ({{5}})
- Responsible borrowing

You can now:
- Get higher-value devices
- Access exclusive premium models
- Qualify for better terms

Browse our premium device collection now!

FOOTER: Congratulations on your upgrade

BUTTONS:
[Browse Premium Devices] [View My Profile]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = old_limit (example: "$200")
{{3}} = new_limit (example: "$350")
{{4}} = increase (example: "+$150")
{{5}} = credit_score (example: "780")
```

### Template 7.2: Account Suspended

**Name**: `account_suspended_en`
**Category**: Utility
**Language**: English

```
BODY:
NOTICE: {{1}}, your account has been suspended.

Account ID: {{2}}
Reason: {{3}}
Suspended: {{4}}

Your account has been temporarily suspended due to the reason above.

What this means:
- You cannot apply for new loans
- Existing loans remain active
- You must still make payments

To reactivate your account:
{{5}}

Contact support if you believe this is an error.

FOOTER: Account temporarily suspended

BUTTONS:
[Contact Support] [View Account Status]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = customer_id (example: "#CUS12345")
{{3}} = suspension_reason (example: "Multiple missed payments")
{{4}} = suspension_date (example: "Nov 24, 2025")
{{5}} = reactivation_steps (example: "Clear outstanding balance")
```

### Template 7.3: Contact Info Updated

**Name**: `contact_updated_en`
**Category**: Utility
**Language**: English

```
BODY:
Hi {{1}}, your contact information has been updated.

Changes made:
{{2}}

Updated: {{3}}

If you didn't make this change, please contact us immediately.

For security, we've sent a verification code to your new contact details.

FOOTER: Lynia Finance Security

BUTTONS:
[Verify Now] [I Didn't Make This Change]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = change_summary (example: "Email: old@example.com → new@example.com")
{{3}} = update_time (example: "Nov 24, 2025 14:32")
```

### Template 7.4: Password Reset Request

**Name**: `password_reset_en`
**Category**: Authentication
**Language**: English

```
BODY:
Hi {{1}}, we received a request to reset your password.

Reset Code: {{2}}

This code expires in {{3}} minutes.

If you didn't request this, ignore this message and your password will remain unchanged.

To reset your password:
1. Enter the code above
2. Create a new strong password
3. Confirm the new password

FOOTER: Lynia Finance Security

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = reset_code (example: "RST123456")
{{3}} = expiry_minutes (example: "15")
```

---

## 11. Multi-Language Support

### 11.1 Supported Languages

| Language | Code | Coverage | Status |
|----------|------|----------|--------|
| English | en | 100% (all templates) | ✅ Complete |
| Shona | sn | 80% (key flows) | 🚧 Phase 2 |
| Ndebele | nd | 50% (payment reminders only) | 🚧 Phase 3 |

### 11.2 Language Selection

**Automatic Detection**:
- Customer's phone language setting
- Previous conversation language
- Location (province)

**Manual Selection**:
```
BOT:
Welcome to Lynia Finance!

Choose your language / Sarudza mutauro wako:

[English] [ChiShona] [isiNdebele]
```

### 11.3 Shona Template Examples

#### Payment Reminder (Shona)

**Name**: `payment_reminder_3day_sn`

```
BODY:
Mhoroi {{1}}, kubhadhara kwako kuchave kunofanira kukwaniswa.

Loan ID: {{2}}
Mari Inofanira: {{3}}
Zuva Rekunofanira: {{4}} (mumazuva 3)

Bhadhara nhasi kuti:
- Usaripa mari yekudhonhera ($5 pazuva)
- Foni yako isaenderwe
- Credit score yako ichengeteke

Dzvanya pasi pano kubhadhara iye zvino ne EcoCash, EcoCash/Omari/Innbucks/OneWallet, kana Bank Transfer.

FOOTER: Bhadhara nenguva, chengetedza nzira yako

BUTTONS:
[Bhadhara Zvino] [Ona Ruzivo] [Set Reminder]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = loan_id (example: "#LYN12345")
{{3}} = amount_due (example: "$47.81")
{{4}} = due_date (example: "Dec 24, 2025")
```

#### KYC Approved (Shona)

**Name**: `kyc_approved_sn`

```
BODY:
Makorokoto {{1}}! Zita rako rakaonekwa.

Account yako yeKynia Finance yave kushanda.

Account Details:
- Credit Limit: {{2}}
- Credit Score: {{3}}
- Status: Active

Iye zvino unogona kutsvaka mafoni uye kuita loan application.

FOOTER: Verification yakabudirira

BUTTONS:
[Ona Mafoni] [Ona Profile]

VARIABLES:
{{1}} = customer_first_name (example: "John")
{{2}} = credit_limit (example: "$200")
{{3}} = credit_score (example: "720")
```

### 11.4 Translation Best Practices

**Cultural Considerations**:
- Use formal language (respectful in Zimbabwean culture)
- Avoid direct translations (adapt to cultural context)
- Test with native speakers before submission
- Consider regional dialects (Shona varies by region)

**Technical Terms**:
- Some terms stay in English: "Credit Score", "Loan ID", "IMEI"
- Adapt others: "Smartphone" → "Foni rerunhare" (Shona)
- Use widely understood terms when possible

---

## 12. Interactive Components

### 12.1 Quick Reply Buttons

**Characteristics**:
- Up to 3 buttons per message
- Text only (no icons in template)
- Max 25 characters per button
- Returns button text as customer response

**Use Cases**:
- Yes/No questions
- Menu navigation
- Common actions

**Example**:
```json
{
  "type": "BUTTONS",
  "buttons": [
    {"type": "QUICK_REPLY", "text": "Pay Now"},
    {"type": "QUICK_REPLY", "text": "View Details"},
    {"type": "QUICK_REPLY", "text": "Contact Support"}
  ]
}
```

### 12.2 Call-to-Action Buttons

**Types**:
1. **Phone Number**: Direct call to business
2. **URL**: Opens web page

**Characteristics**:
- Up to 2 CTA buttons (1 phone + 1 URL, or 2 URLs)
- Can combine with quick replies (3 quick + 2 CTA = 5 total)

**Phone Button Example**:
```json
{
  "type": "PHONE_NUMBER",
  "text": "Call Support",
  "phone_number": "+263771234567"
}
```

**URL Button Example**:
```json
{
  "type": "URL",
  "text": "View Loan",
  "url": "https://app.lyniafinance.com/loans/{{1}}"
}
```

**Dynamic URLs**: Can include variables in URL
```
https://app.lyniafinance.com/loans/{{1}}
↓
https://app.lyniafinance.com/loans/LYN12345
```

### 12.3 Interactive Lists

**Characteristics**:
- Up to 10 rows per section
- Up to 10 sections per list
- Each row has: title, description, ID

**Use Case**: Device catalog, payment methods, support categories

**Example**:
```json
{
  "type": "LIST",
  "header": "Device Catalog",
  "body": "Choose a device to view details",
  "button": "View Devices",
  "sections": [
    {
      "title": "Samsung",
      "rows": [
        {
          "id": "device_1",
          "title": "Galaxy A14",
          "description": "$299 - 4GB/64GB"
        },
        {
          "id": "device_2",
          "title": "Galaxy A04",
          "description": "$219 - 3GB/32GB"
        }
      ]
    },
    {
      "title": "Xiaomi",
      "rows": [
        {
          "id": "device_3",
          "title": "Redmi Note 12",
          "description": "$279 - 6GB/128GB"
        }
      ]
    }
  ]
}
```

---

## 13. Rich Media Templates

### 13.1 Image Headers

**Use Cases**:
- Product showcases (device images)
- Celebrations (loan approved, paid off)
- Brand messaging

**Requirements**:
- Format: JPEG, PNG
- Max size: 5MB
- Recommended: 800x418px (1.91:1 ratio)
- Must be publicly accessible URL

**Example**:
```json
{
  "type": "HEADER",
  "format": "IMAGE",
  "example": {
    "header_handle": [
      "https://cdn.lyniafinance.com/devices/samsung-galaxy-a14.jpg"
    ]
  }
}
```

**Template with Image**:
```
HEADER: [Image: Samsung Galaxy A14]

BODY:
Samsung Galaxy A14 is now available!

Price: $299 ($47.81/month)
Specs: 4GB RAM, 64GB Storage, 6.6" Display

Limited stock - only 10 units left!

BUTTONS:
[Apply Now] [View Details]
```

### 13.2 Video Headers

**Use Cases**:
- Product demos
- How-to guides (KYC instructions)
- Promotional content

**Requirements**:
- Format: MP4
- Max size: 16MB
- Max length: 60 seconds
- Codec: H.264

**Example**: KYC Instructions Video
```
HEADER: [Video: How to take KYC photos]

BODY:
Watch this 30-second video to learn how to take perfect KYC photos.

Tips:
1. Good lighting
2. Flat surface
3. All text visible
4. No glare or shadows

Ready to start verification?

BUTTONS:
[Start Verification] [Watch Again]
```

### 13.3 Document Headers

**Use Cases**:
- Loan agreements (PDF)
- Payment receipts (PDF)
- Terms and conditions

**Requirements**:
- Format: PDF
- Max size: 100MB
- Publicly accessible URL

**Example**: Loan Agreement
```
HEADER: [Document: Loan_Agreement_LYN12345.pdf]

BODY:
Your loan agreement is ready for review.

Loan ID: {{1}}
Device: {{2}}
Amount: {{3}}

Please review the attached document carefully before signing.

Key terms:
- Term: 8 months
- Monthly Payment: {{4}}
- Total Repayment: {{5}}

FOOTER: Read before signing

BUTTONS:
[I Agree] [Contact Support] [Download PDF]
```

---

## 14. Meta Submission Process

### 14.1 Submission Workflow

```
┌─────────────────────────────────────────────────────┐
│             Meta Template Approval Flow              │
└─────────────────────────────────────────────────────┘

[1] CREATE TEMPLATE
    • Define template structure
    • Add variables and examples
    • Choose category (Utility/Auth/Marketing)
        ↓
[2] SUBMIT TO META via API or Business Manager
    • POST /v17.0/{WABA_ID}/message_templates
    • Include all components (header, body, footer, buttons)
    • Provide realistic examples
        ↓
[3] META REVIEW (automated + manual)
    • Automated checks (policy violations, format)
    • Manual review if flagged
    • Review time: 1-48 hours
        ↓
[4] APPROVAL or REJECTION
    • Approved: Template is live (status: APPROVED)
    • Rejected: Review feedback, fix, resubmit
        ↓
[5] TEMPLATE ACTIVE
    • Can send messages using template
    • Monitor quality rating
    • Update if needed (re-submit for approval)
```

### 14.2 Submission via API

**Endpoint**: `POST /v17.0/{WABA_ID}/message_templates`

**Example Request**:
```bash
curl -X POST "https://graph.facebook.com/v17.0/123456789/message_templates" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment_reminder_3day_en",
    "category": "UTILITY",
    "language": "en",
    "components": [
      {
        "type": "BODY",
        "text": "Hi {{1}}, your loan payment is due soon.\n\nLoan ID: {{2}}\nAmount Due: {{3}}\nDue Date: {{4}} (in 3 days)\n\nPay early to avoid late fees.",
        "example": {
          "body_text": [["John", "#LYN12345", "$47.81", "Dec 24, 2025"]]
        }
      },
      {
        "type": "FOOTER",
        "text": "Lynia Finance"
      },
      {
        "type": "BUTTONS",
        "buttons": [
          {"type": "QUICK_REPLY", "text": "Pay Now"},
          {"type": "QUICK_REPLY", "text": "View Details"}
        ]
      }
    ]
  }'
```

**Response**:
```json
{
  "id": "987654321",
  "status": "PENDING",
  "category": "UTILITY"
}
```

### 14.3 Common Rejection Reasons

| Reason | Explanation | Fix |
|--------|-------------|-----|
| **Policy Violation** | Contains prohibited content | Review Meta's Commerce Policy |
| **Missing Example** | Variables don't have examples | Add realistic examples for all variables |
| **Unclear Purpose** | Template purpose is ambiguous | Make message clearer, add context |
| **Too Promotional** | Sounds like spam/marketing | Tone down promotional language, focus on utility |
| **Grammar/Spelling** | Poor English or typos | Proofread carefully |
| **Misleading** | Message is deceptive | Be honest and transparent |
| **Variable Mismatch** | Example doesn't match variable count | Ensure examples match variable placeholders |

### 14.4 Quality Rating

**Meta assigns quality ratings based on**:
- Customer feedback (blocks, reports)
- User engagement (read rate, response rate)
- Template usage patterns

**Ratings**:
- 🟢 **Green** (High quality): All good
- 🟡 **Yellow** (Medium quality): Warning, monitor closely
- 🔴 **Red** (Low quality): Template disabled, fix issues

**How to maintain high quality**:
- Only send relevant messages
- Don't spam customers
- Respect opt-outs
- Use templates as intended
- Monitor customer feedback

---

## 15. Template Management

### 15.1 Template Versioning

**Naming Convention**: `{template_name}_v{version}_{language}`

**Example**:
- v1: `payment_reminder_3day_v1_en`
- v2: `payment_reminder_3day_v2_en` (updated after A/B test)

**Version Control**:
```javascript
const templateRegistry = {
  payment_reminder_3day: {
    current_version: 'v2',
    versions: {
      v1: {
        template_id: 'meta_template_id_v1',
        created: '2025-10-01',
        status: 'deprecated',
        send_count: 5234,
        quality_rating: 'green'
      },
      v2: {
        template_id: 'meta_template_id_v2',
        created: '2025-11-15',
        status: 'active',
        send_count: 1247,
        quality_rating: 'green'
      }
    }
  }
};
```

### 15.2 Template Usage Tracking

**Database Table**: `whatsapp_template_logs`

```sql
CREATE TABLE whatsapp_template_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL,
  template_version VARCHAR(10) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  phone_number VARCHAR(15) NOT NULL,
  variables JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20), -- sent, delivered, read, failed
  failure_reason TEXT,
  meta_message_id VARCHAR(100)
);

CREATE INDEX idx_template_logs_template ON whatsapp_template_logs(template_name, template_version);
CREATE INDEX idx_template_logs_customer ON whatsapp_template_logs(customer_id);
CREATE INDEX idx_template_logs_sent_at ON whatsapp_template_logs(sent_at DESC);
```

**Metrics to Track**:
- Send count
- Delivery rate
- Read rate
- Reply rate
- Failure rate
- Average time to read
- Quality rating changes

### 15.3 A/B Testing Templates

**Test Scenario**: Which payment reminder gets better response?

**Version A**: Urgent tone
```
URGENT: John, your payment is due in 3 days.

Pay now to avoid late fees!
```

**Version B**: Friendly tone
```
Hi John, friendly reminder: your payment is due in 3 days.

We're here if you need help!
```

**Implementation**:
```javascript
async function sendPaymentReminder(customer) {
  // 50/50 split
  const variant = Math.random() < 0.5 ? 'A' : 'B';

  const template = variant === 'A'
    ? 'payment_reminder_urgent_en'
    : 'payment_reminder_friendly_en';

  await sendTemplate(customer.phone_number, template, [
    customer.first_name,
    customer.loan_id,
    customer.amount_due,
    customer.due_date
  ]);

  // Track variant
  await db.ab_tests.insert({
    test_name: 'payment_reminder_tone',
    variant: variant,
    customer_id: customer.id,
    template_name: template,
    sent_at: new Date()
  });
}
```

**Analysis**:
```sql
-- Compare variants
SELECT
  variant,
  COUNT(*) as sent,
  SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) as read,
  SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied,
  ROUND(AVG(EXTRACT(EPOCH FROM (replied_at - sent_at))/60), 2) as avg_response_minutes
FROM whatsapp_template_logs wtl
JOIN ab_tests abt ON wtl.customer_id = abt.customer_id AND wtl.sent_at = abt.sent_at
WHERE abt.test_name = 'payment_reminder_tone'
GROUP BY variant;
```

### 15.4 Template Deprecation

**When to deprecate**:
- Low quality rating (red/yellow)
- Better version available
- Policy changes
- Business requirements changed

**Process**:
1. Mark as deprecated in registry
2. Stop sending new messages
3. Monitor existing messages for 30 days
4. Archive template in Meta
5. Update documentation

---

## 16. Implementation Checklist

### Phase 1: Core Templates (Week 1)
- [ ] Create 30 template definitions
- [ ] Add English translations
- [ ] Generate Meta submission JSON
- [ ] Submit to Meta for approval
- [ ] Set up template tracking database

### Phase 2: Multi-Language (Week 2)
- [ ] Translate 15 key templates to Shona
- [ ] Review with native speakers
- [ ] Submit Shona templates to Meta
- [ ] Build language detection logic
- [ ] Test language switching

### Phase 3: Rich Media (Week 3)
- [ ] Create device images (800x418px)
- [ ] Record KYC instruction video
- [ ] Generate loan agreement PDFs
- [ ] Upload to CDN
- [ ] Submit media templates to Meta

### Phase 4: Testing & Optimization (Week 4)
- [ ] Send test messages to QA phones
- [ ] Monitor delivery rates
- [ ] A/B test 3 template variants
- [ ] Analyze engagement metrics
- [ ] Optimize based on results

---

## 17. Best Practices Summary

### DO's ✅
- Use clear, concise language
- Provide realistic examples
- Test with native speakers (for translations)
- Monitor quality ratings
- Respect customer opt-outs
- A/B test variations
- Track engagement metrics
- Update templates based on feedback

### DON'Ts ❌
- Don't spam customers
- Don't use all caps or excessive punctuation
- Don't send marketing messages as utility
- Don't ignore rejection feedback
- Don't copy templates from competitors
- Don't use outdated templates
- Don't skip variable examples
- Don't violate Meta's policies

---

## 18. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-24 | Product & Engineering Team | Initial template catalog |

**Review Schedule**: Monthly
**Next Review**: 2025-12-24
**Owner**: Product Manager
**Approvers**: CTO, Head of Customer Experience, Compliance Officer

---

**End of Document**
