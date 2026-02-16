# WhatsApp Cloud API Setup Guide - Lynia Finance

**Task**: P2-T005: WhatsApp Cloud API Setup & Configuration
**Priority**: High
**Estimated Time**: 6 hours

## Overview

This guide walks through setting up the WhatsApp Cloud API for Lynia Finance's customer onboarding bot. The bot will handle loan applications, KYC verification, and customer support via WhatsApp.

## Prerequisites

- Meta Developer Account (Facebook account)
- Phone number for WhatsApp Business (Zimbabwe format: +263XXXXXXXXX)
- AWS Lambda deployment (already configured in `template.yaml`)
- Webhook URL (will be provided after Lambda deployment)

## Step 1: Create Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click "Get Started" or "Log In" with Facebook account
3. Complete profile setup (name, email verification)
4. Accept Meta Platform Terms and Developer Policies

**Time**: 10 minutes

## Step 2: Create WhatsApp Business App

1. Navigate to [Meta App Dashboard](https://developers.facebook.com/apps/)
2. Click "Create App"
3. Select use case: **"Business"**
4. Fill in app details:
   - **App Name**: `Lynia Finance WhatsApp Bot`
   - **App Contact Email**: `tech@lyniafinance.com` (or your email)
   - **Business Account**: Create new or select existing
5. Click "Create App"
6. In the App Dashboard, find and add **"WhatsApp"** product
7. Click "Set Up" under WhatsApp

**Time**: 15 minutes

## Step 3: Configure WhatsApp Business API

### 3.1 Get Test Phone Number

Meta provides a test phone number for development:

1. In WhatsApp > Getting Started
2. Note the **Test Phone Number** (format: +1 XXX XXX XXXX)
3. Add your personal WhatsApp number to "Test Recipients"
4. Send a test message to verify connection

**Test Number Details**:
- Valid for 90 days
- Limited to 5 test recipients
- 1000 free messages/month

### 3.2 Get Production Phone Number (Later)

For production, you'll need:
1. A business phone number (not used on WhatsApp)
2. Business verification (legal documents)
3. Migrate test number to production

**Note**: Use test number for P2-T005 development.

### 3.3 Get API Credentials

1. In WhatsApp > API Setup
2. Copy the following credentials:

```
Phone Number ID: [Copy this - looks like 123456789012345]
WhatsApp Business Account ID: [Copy this]
Access Token: [Temporary - 24 hours]
```

3. **Generate Permanent Access Token**:
   - Go to App Settings > Basic
   - Copy **App ID** and **App Secret**
   - Go to Tools > Graph API Explorer
   - Generate token with permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Use [Meta Access Token Tool](https://developers.facebook.com/tools/accesstoken/)
   - Exchange for long-lived token (60 days)

**Save these in `.env` file** (local dev) or **AWS Secrets Manager** (staging/production):
```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_long_lived_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=lynia_webhook_2025
META_APP_SECRET=your_app_secret
```

**AWS Secrets Manager** path: `{environment}/lynia/whatsapp`

**SAM Parameters** (passed at deploy time):
- `WhatsAppPhoneNumberId`
- `WhatsAppAccessToken`
- `WhatsAppWebhookVerifyToken`
- `WhatsAppBusinessAccountId`
- `MetaAppSecret`

**Time**: 20 minutes

## Step 4: Configure Webhook

### 4.1 Deploy Lambda Function

First, ensure your WhatsApp Lambda function is deployed:

```bash
# Build SAM project
sam build

# Deploy to AWS (first time - guided)
sam deploy --guided

# Follow prompts:
# Stack Name: lynia-finance-lambdas
# AWS Region: us-east-1 (or your preferred region)
# Confirm changes: Y
# Allow SAM CLI IAM role creation: Y
# Disable rollback: N
# Save arguments to config file: Y
```

After deployment, note the **API Gateway endpoint**:
```
Outputs:
  ApiEndpoint: https://abc123xyz.execute-api.us-east-1.amazonaws.com/Prod/
```

Your webhook URL will be:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/Prod/whatsapp/webhook
```

### 4.2 Configure Webhook in Meta Dashboard

1. Go to WhatsApp > Configuration
2. Click "Edit" under Webhook
3. Enter:
   - **Callback URL**: `https://your-api-gateway-url.com/whatsapp/webhook`
   - **Verify Token**: `lynia_webhook_2025` (matches code in Lambda)
4. Click "Verify and Save"

**Verification Process**:
- Meta sends GET request with `hub.mode`, `hub.challenge`, `hub.verify_token`
- Lambda verifies token and returns `hub.challenge`
- If successful, webhook is activated

### 4.3 Subscribe to Webhook Events

After verification, subscribe to events:

1. In Webhook Fields, select:
   - ✅ **messages** (incoming messages)
   - ✅ **messaging_postbacks** (button clicks)
   - ✅ **message_deliveries** (delivery receipts)
   - ✅ **message_reads** (read receipts)
   - ✅ **message_status** (sent, delivered, read, failed)

2. Click "Subscribe"

**Time**: 30 minutes

## Step 5: Test Message Sending

### 5.1 Test via cURL

Test sending a message from your Lambda:

```bash
curl -X POST "https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "{YOUR_WHATSAPP_NUMBER}",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": {
        "code": "en_US"
      }
    }
  }'
```

Replace:
- `{PHONE_NUMBER_ID}`: Your Phone Number ID from Step 3.3
- `{ACCESS_TOKEN}`: Your access token
- `{YOUR_WHATSAPP_NUMBER}`: Your WhatsApp number (format: 263771234567)

**Expected Response**:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{
    "input": "263771234567",
    "wa_id": "263771234567"
  }],
  "messages": [{
    "id": "wamid.HBgNMjYzNzcxMjM0NTY3FQIAERgSQ0IxQjE2..."
  }]
}
```

### 5.2 Test via Lambda Function

Invoke the Lambda function locally:

```bash
sam local invoke WhatsAppFunction --event events/test-whatsapp-send.json
```

Create test event file:
```json
{
  "httpMethod": "POST",
  "path": "/whatsapp/send",
  "body": "{\"to\":\"263771234567\",\"message\":\"Hello from Lynia Finance!\"}"
}
```

**Time**: 20 minutes

## Step 6: Test Webhook Reception

### 6.1 Send Message to Bot

1. Open WhatsApp on your phone
2. Send a message to the test number: "Hi"
3. Check CloudWatch Logs for Lambda execution
4. Verify webhook received the message

### 6.2 Check Lambda Logs

```bash
# View recent logs
sam logs -n WhatsAppFunction --tail

# Or in AWS Console:
# CloudWatch > Log Groups > /aws/lambda/development-lynia-whatsapp-service
```

**Expected Log**:
```
Received webhook event: messages
From: 263771234567
Message: Hi
```

**Time**: 15 minutes

## Step 7: Message Templates Setup

WhatsApp requires pre-approved templates for outbound messages (first 24 hours):

### 7.1 Create Message Templates

1. Go to WhatsApp > Message Templates
2. Click "Create Template"

**Template 1: Loan Application Welcome**
- **Name**: `loan_application_welcome`
- **Category**: TRANSACTIONAL
- **Language**: English
- **Content**:
```
Hello {{1}}! 👋

Welcome to Lynia Finance. We're here to help you get the smartphone you need with flexible financing.

To get started with your loan application, please reply with:
1️⃣ Apply for loan
2️⃣ Check loan status
3️⃣ Speak to support

*Lynia Finance - Empowering Zimbabwe's Digital Future*
```

**Template 2: KYC Verification**
- **Name**: `kyc_verification_request`
- **Category**: TRANSACTIONAL
- **Content**:
```
Hi {{1}},

To complete your loan application, we need to verify your identity.

Please provide:
📋 National ID Number
📸 Photo of your National ID (front & back)

Reply with your National ID number to continue.
```

**Template 3: Loan Approved**
- **Name**: `loan_approved`
- **Category**: TRANSACTIONAL
- **Content**:
```
🎉 Congratulations {{1}}!

Your loan application has been approved!

💰 Loan Amount: ${{2}}
📅 Repayment Period: {{3}} months
💳 Monthly Payment: ${{4}}

Visit our shop to collect your device.

*Device will be locked until first payment is received.*
```

3. Submit templates for approval (usually 24-48 hours)

**Time**: 30 minutes

## Step 8: Production Readiness Checklist

Before going to production:

- [ ] Business verification completed on Meta Business Manager
- [ ] Production phone number registered (+263 Zimbabwe number)
- [ ] All message templates approved (loan_application_welcome, kyc_verification_request, loan_approved)
- [ ] Webhook URL uses HTTPS with valid SSL certificate (API Gateway provides this)
- [ ] HMAC webhook signature validation enabled (META_APP_SECRET configured)
- [ ] Error handling implemented in Lambda (circuit breaker, retry queue)
- [ ] CloudWatch alarms configured for DLQ, error rates, latency
- [ ] Rate limiting implemented (WAF + in-app throttling)
- [ ] SQS retry queue deployed for failed message delivery
- [ ] Customer data privacy compliance (PII masking in logs, data encryption)
- [ ] Secrets stored in AWS Secrets Manager (not environment variables)
- [ ] WhatsApp API version pinned and documented (currently v18.0)
- [ ] Loan commands routing verified for completed onboarding users

**Time**: 2-4 hours (spread over days for approvals)

## Architecture Overview

```
┌─────────────────┐
│  WhatsApp User  │
└────────┬────────┘
         │ Sends message
         ▼
┌─────────────────────────┐
│  WhatsApp Cloud API     │
│  (Meta Infrastructure)  │
└────────┬────────────────┘
         │ Webhook POST (HMAC signed)
         ▼
┌─────────────────────────┐
│  API Gateway + WAF      │
│  /whatsapp/webhook      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Lambda: WhatsAppFunction│
│  - Validate HMAC sig    │
│  - Parse message        │
│  - Route to handlers    │
│  - Update RDS           │
│  - Send response        │
└────────┬────────────────┘
         │
    ┌────┴─────────┐
    ▼              ▼
┌────────────┐  ┌─────────────────┐
│ RDS Postgres│  │  SQS Retry Queue│
│ (VPC)       │  │  (failed msgs)  │
└────────────┘  └─────────────────┘
```

## API Reference

### Send Message (Text)

```http
POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "263771234567",
  "type": "text",
  "text": {
    "body": "Your message here"
  }
}
```

### Send Message (Template)

```http
POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "263771234567",
  "type": "template",
  "template": {
    "name": "loan_application_welcome",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "John Doe"
          }
        ]
      }
    ]
  }
}
```

### Webhook Verification (GET)

```http
GET /whatsapp/webhook?hub.mode=subscribe&hub.challenge=123456&hub.verify_token=lynia_webhook_2025

Response: 123456 (echo challenge)
```

### Webhook Message (POST)

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": {
            "name": "John Doe"
          },
          "wa_id": "263771234567"
        }],
        "messages": [{
          "from": "263771234567",
          "id": "wamid.HBgN...",
          "timestamp": "1234567890",
          "type": "text",
          "text": {
            "body": "Hi"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

## Rate Limits

- **Messages**: 1000/day (test), 100K+/day (production with verification)
- **API Calls**: 40 requests/second
- **Webhook**: No explicit limit, but use queues for high volume

## Troubleshooting

### Webhook Not Receiving Messages

1. Check CloudWatch Logs for Lambda errors
2. Verify webhook URL is correct in Meta dashboard
3. Test webhook manually: `curl -X POST your-webhook-url -d '{}'`
4. Check API Gateway logs
5. Ensure Lambda has `WhatsAppWebhookEvent` event configured

### Message Send Failures

1. Verify access token is valid (not expired)
2. Check phone number format (no spaces, include country code)
3. Ensure recipient has opted in (sent a message first)
4. Verify Phone Number ID is correct
5. Check message template is approved

### Token Expiration

- Temporary tokens expire in 24 hours
- Long-lived tokens expire in 60 days
- System user tokens expire in 90 days
- Set up CloudWatch alarm for token expiration

## Security Best Practices

1. **Never commit tokens to Git**:
   ```bash
   # Add to .gitignore
   .env
   .env.local
   ```

2. **Use AWS Secrets Manager** for production:
   ```bash
   aws secretsmanager create-secret \
     --name lynia/whatsapp/access-token \
     --secret-string "your-token"
   ```

3. **Rotate tokens regularly** (every 30 days)

4. **Verify webhook signatures** (implement HMAC validation)

5. **Use HTTPS only** for webhook URLs

## Cost Estimates

### Meta WhatsApp Business API Pricing

- **Free Tier**: 1,000 conversations/month
- **Paid**: $0.005 - $0.09 per conversation (varies by country)
- **Zimbabwe**: ~$0.04 per business-initiated conversation
- **User-initiated**: Free within 24-hour window

### AWS Costs (Estimated Monthly)

- **Lambda**: $0.20 per 1M requests + $0.0000166667 per GB-second
- **API Gateway**: $1.00 per 1M requests
- **CloudWatch Logs**: $0.50 per GB ingested
- **Total**: ~$10-50/month for 10K conversations

## Resources

- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Business Platform](https://business.whatsapp.com/)
- [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [WhatsApp Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates/)

## Next Steps

After completing this setup:

1. ✅ P2-T005: WhatsApp Cloud API Setup (this task)
2. ➡️ P2-T006: WhatsApp Bot - Customer Onboarding Flow
3. ➡️ P2-T007: Smile Identity KYC Integration
4. ➡️ P2-T008: Mobile Money Payment Integration

---

**Document Version**: 1.1
**Last Updated**: 2026-02-16
**Author**: Claude Code Assistant
**Project**: Lynia Finance - Phase 2
