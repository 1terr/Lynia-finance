# Task B2: WhatsApp Webhook Configuration

> **Track:** B - WhatsApp Cloud API Integration
> **Status:** Not Started
> **Priority:** Critical (enables all WhatsApp functionality)
> **Depends On:** Meta Business Account (DONE)
> **Estimated Effort:** Small

---

## Objective

Deploy the WhatsApp Lambda function, configure the webhook in Meta App Dashboard, and verify the handshake works.

## Tasks

### B2.1: Deploy Lambda to Get API Gateway URL
- **Action:** Build and deploy the current stack to get the API Gateway endpoint
- **Command:**
  ```bash
  sam build --cached --parallel
  sam deploy --config-env dev
  ```
- **Output:** Note the `ApiEndpoint` from deployment output
- **Webhook URL:** `https://{api-gateway-url}/Prod/whatsapp/webhook`

### B2.2: Configure Webhook in Meta Dashboard
- **Action:**
  1. Go to Meta App Dashboard → WhatsApp → Configuration → Webhook
  2. Click "Edit"
  3. Enter Callback URL: `https://{api-gateway-url}/Prod/whatsapp/webhook`
  4. Enter Verify Token: `lynia_webhook_2025`
  5. Click "Verify and Save"
- **Expected:** Meta sends GET request, Lambda returns `hub.challenge`, webhook activates

### B2.3: Subscribe to Webhook Events
- **Action:** In Meta Dashboard → Webhook Fields, enable:
  - messages
  - messaging_postbacks
  - message_deliveries
  - message_reads
  - message_status
- **Click:** "Subscribe"

### B2.4: Test Webhook Verification
- **Action:** Verify in CloudWatch logs:
  ```bash
  sam logs -n WhatsAppFunction --tail
  ```
- **Expected:** Log entry showing successful webhook verification

### B2.5: Test Inbound Message
- **Action:** Send "Hi" from personal WhatsApp to business number
- **Expected:** CloudWatch shows received message, handler processes it

## Acceptance Criteria

- [ ] Lambda deployed successfully
- [ ] API Gateway URL noted and accessible
- [ ] Webhook configured in Meta Dashboard
- [ ] Webhook verification handshake passes
- [ ] All 5 event types subscribed
- [ ] Test message received and logged in CloudWatch
- [ ] HMAC signature validation works with real `META_APP_SECRET`

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |
