# Task B3: WhatsApp Credentials & Secrets Deployment

> **Track:** B - WhatsApp Cloud API Integration
> **Status:** Not Started
> **Priority:** High
> **Depends On:** B2 (webhook configured)
> **Estimated Effort:** Small

---

## Objective

Store real Meta WhatsApp credentials in AWS Secrets Manager and deploy the Lambda with production-ready credential loading.

## Tasks

### B3.1: Store Credentials in Secrets Manager
- **Action:** Create secret via AWS CLI or Console:
  ```bash
  aws secretsmanager create-secret \
    --name "development/lynia/whatsapp" \
    --secret-string '{
      "WHATSAPP_PHONE_NUMBER_ID": "<from-meta-dashboard>",
      "WHATSAPP_ACCESS_TOKEN": "<system-user-long-lived-token>",
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN": "lynia_webhook_2025",
      "WHATSAPP_BUSINESS_ACCOUNT_ID": "<from-meta-dashboard>",
      "META_APP_SECRET": "<from-meta-app-settings>"
    }'
  ```
- **Repeat** for staging and production environments

### B3.2: Update Local Dev Config
- **File:** `env.json`
- **Action:** Update `WhatsAppFunction` with sandbox/test credentials:
  ```json
  {
    "WhatsAppFunction": {
      "WHATSAPP_PHONE_NUMBER_ID": "actual-test-phone-id",
      "WHATSAPP_ACCESS_TOKEN": "actual-test-token",
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN": "lynia_webhook_2025",
      "WHATSAPP_BUSINESS_ACCOUNT_ID": "actual-business-id",
      "META_APP_SECRET": "actual-app-secret"
    }
  }
  ```

### B3.3: Deploy with Real Credentials
- **Command:** `sam deploy` with parameter overrides for WhatsApp credentials
- **Test:** Verify Lambda can read secrets at runtime

### B3.4: Test Message Sending
- **Action:** Test outbound message via the send endpoint:
  ```bash
  curl -X POST "https://{api-gateway-url}/Prod/whatsapp/send" \
    -H "Authorization: Bearer {cognito-token}" \
    -H "Content-Type: application/json" \
    -d '{"to": "263771234567", "message": "Test from Lynia Finance"}'
  ```
- **Expected:** Message delivered to WhatsApp recipient

## Acceptance Criteria

- [ ] Secrets stored in AWS Secrets Manager for dev/staging/prod
- [ ] Lambda reads credentials from Secrets Manager (not env vars)
- [ ] Outbound text message sends successfully
- [ ] Token is long-lived (60+ days) or system user token (90 days)
- [ ] `env.json` has actual test credentials for local dev
- [ ] No credentials in git history

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |
