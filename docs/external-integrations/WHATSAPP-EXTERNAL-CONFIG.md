# WhatsApp Cloud API - External Configuration Tasks

**Date**: 2026-02-17 (Completed: 2026-02-18)
**Status**: Complete — All tasks executed, app published
**Prerequisite**: All code deployed to production, database migrations applied

---

## Overview

The WhatsApp service code is fully deployed with a 20-state onboarding machine, real KYC integration, loan commands, error handling, and retry queues. These are the remaining external configuration steps needed to receive and send WhatsApp messages from real customers.

---

## Task 1: Set Missing GitHub Secrets

**Where**: Terminal with `gh` CLI authenticated, or GitHub repo → Settings → Secrets

### 1a. Find Your Meta Credentials

| Credential | Where to Find |
|---|---|
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | [developers.facebook.com](https://developers.facebook.com) → Your App → WhatsApp → API Setup → "Business Account ID" |
| `META_APP_SECRET` | [developers.facebook.com](https://developers.facebook.com) → Your App → Settings → Basic → "App Secret" (click Show) |
| `WHATSAPP_PHONE_ID` | Already set as `STAGING_WHATSAPP_PHONE_ID` |
| `WHATSAPP_TOKEN` | Already set as `STAGING_WHATSAPP_TOKEN` |
| `WEBHOOK_VERIFY_TOKEN` | Already set as `STAGING_WEBHOOK_TOKEN` |

### 1b. Set the Secrets

```bash
# Staging
gh secret set STAGING_WHATSAPP_BUSINESS_ACCOUNT_ID --body "<your-waba-id>"
gh secret set STAGING_META_APP_SECRET --body "<your-meta-app-secret>"

# Production
gh secret set PRODUCTION_WHATSAPP_BUSINESS_ACCOUNT_ID --body "<your-waba-id>"
gh secret set PRODUCTION_META_APP_SECRET --body "<your-meta-app-secret>"
gh secret set PRODUCTION_WHATSAPP_PHONE_ID --body "<your-phone-number-id>"
gh secret set PRODUCTION_WHATSAPP_TOKEN --body "<your-permanent-access-token>"
gh secret set PRODUCTION_WEBHOOK_TOKEN --body "<your-webhook-verify-token>"
```

**Verification**: Run `gh secret list` and confirm all secrets appear.

> **Important**: The `WHATSAPP_TOKEN` should be a **permanent access token**, not the temporary test token from the API Setup page. To generate a permanent token:
> 1. Go to Business Settings → System Users
> 2. Create a system user with `whatsapp_business_messaging` permission
> 3. Generate a permanent token for that system user

---

## Task 2: Configure WhatsApp Webhook in Meta Dashboard

**Where**: [developers.facebook.com](https://developers.facebook.com) → Your App → WhatsApp → Configuration

### 2a. Set Webhook URL

1. Under **Webhook**, click **Edit** (or **Configure** if first time)
2. Fill in:

| Field | Value |
|---|---|
| **Callback URL** | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/whatsapp/webhook` |
| **Verify Token** | Must match `STAGING_WEBHOOK_TOKEN` / `PRODUCTION_WEBHOOK_TOKEN` secret exactly |

3. Click **Verify and Save**

**What happens**: Meta sends a GET request to your webhook URL with a `hub.challenge` parameter. Your Lambda responds with the challenge to prove ownership. This is already implemented in the code.

### 2b. Subscribe to Webhook Fields

After verification succeeds, subscribe to these events (check the boxes):

| Field | Purpose |
|---|---|
| `messages` | **Required** - Incoming customer messages (text, images, buttons) |
| `messaging_postbacks` | Button/quick reply responses |
| `message_deliveries` | Delivery confirmation receipts |
| `message_reads` | Read receipts |

Click **Done** after subscribing.

### 2c. Troubleshooting Webhook Verification

If verification fails:

| Issue | Solution |
|---|---|
| Timeout | Check Lambda is deployed: `gh run list --workflow=deploy.yml -L 3` |
| Token mismatch | Verify token matches exactly (case-sensitive, no trailing spaces) |
| 500 error | Check CloudWatch logs: `aws logs tail /aws/lambda/lynia-finance-prod-WhatsAppFunction --since 5m` |
| Certificate error | API Gateway uses AWS-managed certs, should not happen |

---

## Task 3: Register Message Templates

**Where**: [developers.facebook.com](https://developers.facebook.com) → Your App → WhatsApp → Message Templates

**Why**: WhatsApp requires pre-approved templates for messages sent outside the 24-hour customer-initiated window. KYC result notifications and payment reminders are sent asynchronously, so they need templates.

### Templates to Submit

Submit each template with the specified category. Meta typically reviews in **24-48 hours**.

#### Template 1: `welcome_message`
- **Category**: MARKETING
- **Language**: English
- **Body**:
```
Welcome to Lynia Finance! We provide affordable loans to help you grow.

Reply START to begin your application, or HELP for assistance.
```

#### Template 2: `kyc_verification_request`
- **Category**: UTILITY
- **Language**: English
- **Body**:
```
To continue your loan application, we need to verify your identity.

Please send:
1. Your National ID number
2. A clear photo of your National ID
3. A selfie photo

This helps us protect your account and comply with regulations.
```

#### Template 3: `kyc_result_approved`
- **Category**: UTILITY
- **Language**: English
- **Body**:
```
Great news, {{1}}! Your identity has been verified successfully.

We're now processing your loan application. You'll receive your loan offer shortly.
```
- **Variables**: `{{1}}` = Customer first name

#### Template 4: `kyc_result_rejected`
- **Category**: UTILITY
- **Language**: English
- **Body**:
```
Hi {{1}}, we were unable to verify your identity.

This may be because:
- The ID photo was unclear
- The selfie didn't match the ID
- The ID document was expired

Reply RETRY to try again, or HELP to speak with support.
```
- **Variables**: `{{1}}` = Customer first name

#### Template 5: `loan_offer`
- **Category**: UTILITY
- **Language**: English
- **Body**:
```
Hi {{1}}, you've been approved for a loan!

Amount: ${{2}}
Interest: {{3}}% per month
Term: {{4}} months
Monthly payment: ${{5}}

Reply ACCEPT to proceed or DECLINE to cancel.
```
- **Variables**: `{{1}}` = Name, `{{2}}` = Amount, `{{3}}` = Interest rate, `{{4}}` = Term, `{{5}}` = Monthly payment

#### Template 6: `payment_reminder`
- **Category**: UTILITY
- **Language**: English
- **Body**:
```
Hi {{1}}, your payment of ${{2}} is due on {{3}}.

Reply PAY to make a payment now, or SCHEDULE to view your full schedule.
```
- **Variables**: `{{1}}` = Name, `{{2}}` = Amount, `{{3}}` = Due date

#### Template 7: `payment_confirmation`
- **Category**: UTILITY
- **Language**: English
- **Body**:
```
Payment received! Thank you, {{1}}.

Amount paid: ${{2}}
Remaining balance: ${{3}}
Next payment due: {{4}}

Reply BALANCE for details or HELP for support.
```
- **Variables**: `{{1}}` = Name, `{{2}}` = Amount paid, `{{3}}` = Remaining balance, `{{4}}` = Next due date

### Tips for Template Approval

- Use **UTILITY** category for transactional messages (higher approval rate than MARKETING)
- Keep messages under 1024 characters
- Don't include URLs or phone numbers in the initial submission
- Avoid words like "free", "guarantee", "winner" that trigger spam filters
- Once approved, note the template names - they must match exactly in code

---

## Task 4: Re-deploy with Real Credentials

After setting all secrets (Task 1) and configuring the webhook (Task 2):

```bash
gh workflow run deploy.yml --field environment=production
```

**Verification**:
```bash
# Watch the deploy
gh run list --workflow=deploy.yml -L 3

# Verify Lambda has the env vars
aws lambda get-function-configuration \
  --function-name lynia-finance-prod-WhatsAppFunction \
  --query 'Environment.Variables.{PhoneID: WHATSAPP_PHONE_NUMBER_ID, WABA: WHATSAPP_BUSINESS_ACCOUNT_ID}' \
  --output table
```

---

## Task 5: End-to-End Testing

### 5a. Webhook Connectivity Test
Send a test message from your personal WhatsApp to your business phone number. Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/lynia-finance-prod-WhatsAppFunction --since 10m --follow
```

### 5b. Full Onboarding Flow Test

Walk through all 20 states by sending messages:

| Step | You Send | Expected Response |
|---|---|---|
| 1 | "Hi" or "START" | Welcome message with language selection |
| 2 | "1" (English) | Ask for full name |
| 3 | "John Doe" | Ask for date of birth |
| 4 | "1990-01-15" | Ask for phone verification |
| 5 | (OTP flow) | Ask for address |
| 6 | "123 Main St, Harare" | Ask for employment status |
| 7 | "Self-employed" | Ask for monthly income |
| 8 | "500" | Ask for product selection |
| 9 | "1" (Personal loan) | Ask for National ID number |
| 10 | "63-123456A78" | Ask for ID photo |
| 11 | (Send ID photo) | Ask for selfie |
| 12 | (Send selfie) | "Processing your verification..." |
| 13 | (Wait for Didit callback) | KYC result notification |
| 14 | (If approved) | Credit score calculated, loan offer presented |
| 15 | "ACCEPT" | Deposit/disbursement step |

### 5c. Command Tests (for active customers)
| Command | Expected Response |
|---|---|
| BALANCE | Current loan balance from Fineract |
| HISTORY | Recent transaction history |
| SCHEDULE | Repayment schedule |
| HELP | List of available commands |
| RESTART | Reset onboarding session |
| CANCEL | Cancel current operation |

### 5d. Error Handling Tests
- Send an invalid message type (e.g., audio) during ID photo step
- Send text during photo upload step
- Rapidly send 10+ messages to test rate limiting
- Send a message with the business number offline, then reconnect

---

## Task 6: Go-Live Checklist

Before announcing to real customers:

- [ ] All 7 message templates approved by Meta
- [ ] Webhook verification successful
- [ ] Full onboarding flow tested end-to-end
- [ ] KYC verification tested with real ID (Didit sandbox or production)
- [ ] Loan commands tested (BALANCE, HISTORY, SCHEDULE)
- [ ] Error handling tested (invalid inputs, timeouts)
- [ ] Rate limiting verified
- [ ] CloudWatch alarms configured for errors
- [ ] Support escalation path tested (HELP command)
- [ ] Monitor first 10 real customer interactions

---

## Secrets Checklist

| Secret | Status |
|---|---|
| `STAGING_WHATSAPP_PHONE_ID` | Set |
| `STAGING_WHATSAPP_TOKEN` | Set |
| `STAGING_WEBHOOK_TOKEN` | Set |
| `STAGING_WHATSAPP_BUSINESS_ACCOUNT_ID` | Set (2026-02-18) |
| `STAGING_META_APP_SECRET` | Set (2026-02-18) |
| `PRODUCTION_WHATSAPP_PHONE_ID` | Set (2026-02-18) |
| `PRODUCTION_WHATSAPP_TOKEN` | Set - Permanent token (2026-02-18) |
| `PRODUCTION_WEBHOOK_TOKEN` | Set (2026-02-18) |
| `PRODUCTION_WHATSAPP_BUSINESS_ACCOUNT_ID` | Set (2026-02-18) |
| `PRODUCTION_META_APP_SECRET` | Set (2026-02-18) |

---

## Architecture Reference

```
Customer sends WhatsApp message
         |
         v
Meta Cloud API → POST /whatsapp/webhook
         |
         v
HMAC signature validation (META_APP_SECRET)
         |
         v
WhatsApp Lambda handler
         |
    ┌────┴─────────────────────────┐
    | New customer?                | Existing customer?
    v                              v
20-State Onboarding Machine    Command Router
    |                              |
    | welcome → language →         | BALANCE → Fineract API
    | personal_info → phone →      | HISTORY → Fineract API
    | address → employment →       | SCHEDULE → Fineract API
    | income → product →           | PAY → Payment service
    | kyc_id → kyc_photo →         | HELP → Help menu
    | kyc_selfie → processing →    |
    | scoring → offer → complete   |
    |                              |
    v                              v
Send response via WhatsApp Cloud API
POST graph.facebook.com/v18.0/{phone_id}/messages
```

---

## Production URLs

| Endpoint | URL |
|---|---|
| WhatsApp Webhook | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/whatsapp/webhook` |
| WhatsApp Send | Internal - Lambda calls `graph.facebook.com` directly |
| KYC Callback | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/kyc/callback` |
| Staging Webhook | `https://gj0vu9jp26.execute-api.us-east-1.amazonaws.com/Prod/whatsapp/webhook` |
