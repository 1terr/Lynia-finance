# WhatsApp Cloud API Integration Plan

> **Status:** In Progress
> **Date:** 2026-02-16
> **Owner:** Engineering Team
> **Meta Account:** Ready (Business verified, credentials available)
> **Didit Account:** Ready (API key + webhook secret obtained)

---

## 1. Context & Motivation

Lynia Finance's WhatsApp service is the primary customer touchpoint. The onboarding state machine, loan commands, error handling, and i18n are all implemented in code, but the service has **never been connected to live Meta WhatsApp Cloud API**. The KYC step is hardcoded to auto-approve, and message templates exist only in documentation.

**Goal:** Connect the existing WhatsApp service to Meta's Cloud API, enable real message sending/receiving, register message templates, and wire the KYC flow to call the real KYC service (Didit).

**Why now:**
- Meta Business Account is already verified and ready
- KYC provider migration to Didit is in progress (dual-provider approach)
- The full onboarding pipeline (WhatsApp -> KYC -> Scoring -> Loan) needs to work end-to-end
- Financial inclusion mission requires real customer-facing capability

---

## 2. Current Architecture

### Service Layer

| Component | File | Status | Role |
|-----------|------|--------|------|
| Lambda handler | `services/whatsapp-service/src/index.ts` | DONE | 3 routes: send, webhook GET/POST |
| Onboarding state machine | `services/whatsapp-service/src/onboarding.ts` | DONE (KYC stubbed) | 20-state flow, 8-step onboarding |
| Loan commands | `services/whatsapp-service/src/loan-commands.ts` | DONE | BALANCE, HISTORY, SCHEDULE, etc. |
| Error handler | `services/whatsapp-service/src/error-handler.ts` | DONE | 8-layer pipeline, rate limiting, sanitization |
| Circuit breaker | `services/whatsapp-service/src/utils/circuit-breaker.ts` | DONE | Protects WhatsApp API calls |
| i18n | `services/whatsapp-service/src/i18n.ts` | DONE (not wired) | English, Shona, Ndebele - 47 keys |
| Flows directory | `services/whatsapp-service/src/flows/` | EMPTY | Interactive message flows not implemented |
| Handlers directory | `services/whatsapp-service/src/handlers/` | EMPTY | Per-message-type handlers not implemented |
| Templates directory | `services/whatsapp-service/src/templates/` | EMPTY | Template sending helpers not implemented |

### Infrastructure

| Resource | Location | Status | Details |
|----------|----------|--------|---------|
| Lambda function | `template.yaml` (WhatsAppFunction) | DEPLOYED | `{env}-lynia-whatsapp-service` |
| API Gateway events | `template.yaml` | CONFIGURED | POST /whatsapp/send (auth), GET/POST /whatsapp/webhook (no auth) |
| SAM parameters | `template.yaml` | DEFINED | WhatsAppPhoneNumberId, WhatsAppAccessToken, etc. |
| Secrets Manager | `infrastructure/aws/secrets-manager.yaml` | TEMPLATE EXISTS | `{env}/lynia/whatsapp` path |
| SQS retry queue | `infrastructure/aws/sqs-queues.yaml` | PROVISIONED | `{env}-lynia-whatsapp-message-retry` |
| IAM policies | `template.yaml` | CONFIGURED | SecretsManager read, SQS send, CloudWatch |
| Webhook HMAC | `services/whatsapp-service/src/index.ts` | IMPLEMENTED | SHA-256 signature verification |

### Database

| Table | WhatsApp Columns | Status |
|-------|------------------|--------|
| `whatsapp_sessions` / `whatsapp_onboarding_sessions` | `current_state`, `session_data JSONB`, `expires_at` | EXISTS (naming conflict - see issues) |
| `whatsapp_messages` | `message_id`, `direction`, `message_type`, `content`, delivery timestamps | EXISTS |
| `customers` | `whatsapp_number`, `onboarding_status` | EXISTS |
| `customer_preferences` | Language preference | EXISTS |
| `customer_consents` | Consent type, version | EXISTS |

### Documentation

| Document | Location | Content |
|----------|----------|---------|
| Cloud API Setup Guide | `docs/guides/WHATSAPP-CLOUD-API-SETUP.md` | Full setup steps, credentials, webhook config |
| Bot Flow Specifications | `docs/guides/WHATSAPP-BOT-FLOW.md` | 7 templates, 4 conversation flows, interactive messages |

### Tests

| Test | File | Status |
|------|------|--------|
| Contract tests | `tests/contract/whatsapp-service.contract.test.ts` | DONE (581 lines) |
| E2E onboarding | `tests/e2e/e2e-001-complete-onboarding.test.ts` | DONE |
| Integration data flow | `tests/integration/data-flow/onboarding-data-flow.test.ts` | DONE |
| Notification delivery | `tests/integration/data-flow/notification-delivery.test.ts` | DONE |
| Mock helpers | `tests/helpers/mock-external-services.ts` | DONE |
| Unit tests (service) | `services/whatsapp-service/tests/` | EMPTY (.gitkeep) |

---

## 3. What Needs to Be Done

### Phase 1: Credentials & Webhook Configuration (Meta Account Ready)

| # | Deliverable | Type | Status |
|---|-------------|------|--------|
| 1.1 | Store WhatsApp credentials in Secrets Manager | CONFIG | TODO |
| 1.2 | Deploy Lambda to get API Gateway URL | DEPLOY | TODO |
| 1.3 | Configure webhook URL in Meta App Dashboard | CONFIG | TODO |
| 1.4 | Subscribe to webhook events | CONFIG | TODO |
| 1.5 | Test webhook verification handshake | TEST | TODO |

**Details:**

**1.1 Store credentials:**
```bash
# Store in AWS Secrets Manager via CLI or Console
aws secretsmanager create-secret \
  --name "{env}/lynia/whatsapp" \
  --secret-string '{
    "WHATSAPP_PHONE_NUMBER_ID": "from-meta-dashboard",
    "WHATSAPP_ACCESS_TOKEN": "long-lived-system-user-token",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN": "lynia_webhook_2025",
    "WHATSAPP_BUSINESS_ACCOUNT_ID": "from-meta-dashboard",
    "META_APP_SECRET": "from-meta-app-settings"
  }'
```

**1.2 Deploy and get API Gateway URL:**
```bash
sam build && sam deploy --config-env dev
# Note output: ApiEndpoint: https://abc123.execute-api.{region}.amazonaws.com/Prod/
```

**1.3 Configure webhook:**
- Meta App Dashboard > WhatsApp > Configuration > Webhook
- Callback URL: `https://{api-gateway-url}/Prod/whatsapp/webhook`
- Verify Token: `lynia_webhook_2025`

**1.4 Subscribe to events:**
- messages, messaging_postbacks, message_deliveries, message_reads, message_status

### Phase 2: Message Template Registration

| # | Deliverable | Type | Status |
|---|-------------|------|--------|
| 2.1 | Submit 7 message templates to Meta | CONFIG | TODO |
| 2.2 | Map approved template names/IDs to code constants | CODE | TODO |
| 2.3 | Test template message sending | TEST | TODO |

**Templates to submit** (from `docs/guides/WHATSAPP-BOT-FLOW.md`):

| Template Name | Category | Parameters | Expected Review Time |
|---------------|----------|------------|---------------------|
| `loan_application_welcome` | TRANSACTIONAL | 1 (customer name) | 24-48h |
| `kyc_verification_request` | TRANSACTIONAL | 1 (customer name) | 24-48h |
| `loan_approved` | TRANSACTIONAL | 6 (name, amount, device, months, payment, shop) | 24-48h |
| `payment_reminder` | TRANSACTIONAL | 6 (name, amount, date, balance, merchant, ref) | 24-48h |
| `payment_received` | TRANSACTIONAL | 6 (name, amount, ref, date, balance, next due) | 24-48h |
| `device_lock_warning` | TRANSACTIONAL | 6 (name, amount, date, days past, merchant, ref) | 24-48h |
| `device_unlocked` | TRANSACTIONAL | 4 (name, device, next amount, next date) | 24-48h |

### Phase 3: End-to-End WhatsApp Testing

| # | Deliverable | Type | Status |
|---|-------------|------|--------|
| 3.1 | Test inbound message reception via webhook | TEST | TODO |
| 3.2 | Test outbound text message sending | TEST | TODO |
| 3.3 | Test template message sending | TEST | TODO |
| 3.4 | Test onboarding flow (welcome -> personal info) | TEST | TODO |
| 3.5 | Test error handling (rate limits, invalid messages) | TEST | TODO |
| 3.6 | Test session expiry, RESTART, CANCEL commands | TEST | TODO |
| 3.7 | Test loan commands for completed customers | TEST | TODO |

### Phase 4: Wire KYC into WhatsApp Onboarding

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 4.1 | Replace hardcoded KYC auto-approve | `services/whatsapp-service/src/onboarding.ts` (MODIFY) | TODO |
| 4.2 | Download WhatsApp media via Media API | `services/whatsapp-service/src/onboarding.ts` (MODIFY) | TODO |
| 4.3 | Forward images to KYC service | `services/whatsapp-service/src/onboarding.ts` (MODIFY) | TODO |
| 4.4 | Handle async KYC processing state | `services/whatsapp-service/src/onboarding.ts` (MODIFY) | TODO |

**Current code (hardcoded auto-approve in `onboarding.ts`):**
```typescript
// SIMULATED - This is where DIDIT would be called
const kycResult = { verified: true, confidence: 0.96 };
if (kycResult.verified) {
  // Auto-approve...
}
```

**Target code:**
```typescript
// Download images from WhatsApp Media API
const idImageBuffer = await downloadWhatsAppMedia(session.id_image_id);
const selfieBuffer = await downloadWhatsAppMedia(session.selfie_image_id);

// Call KYC service
const kycResponse = await axios.post(`${KYC_API_URL}/kyc/initiate`, {
  customer_id: session.customer_id,
  id_number: session.national_id,
  id_document_image: idImageBuffer.toString('base64'),
  selfie_image: selfieBuffer.toString('base64'),
});

// Transition to processing state (async - wait for KYC callback)
await updateSessionState(phone, 'kyc_processing');
await sendMessage(phone, t('kyc_processing', lang));
```

### Phase 5: KYC Result Notification via WhatsApp

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 5.1 | Send WhatsApp notification on KYC approval | `services/kyc-service/src/index.ts` (MODIFY) | TODO |
| 5.2 | Send WhatsApp notification on KYC rejection | `services/kyc-service/src/index.ts` (MODIFY) | TODO |
| 5.3 | Resume onboarding flow on KYC approval | `services/whatsapp-service/src/onboarding.ts` (MODIFY) | TODO |

**Current code (TODO in KYC callback handler):**
```typescript
// TODO: Send notification to customer via WhatsApp
```

**Target code:**
```typescript
// On KYC callback result
if (decision === 'APPROVED') {
  await axios.post(`${WHATSAPP_API_URL}/whatsapp/send`, {
    to: customer.whatsapp_number,
    type: 'template',
    template: 'kyc_verification_approved',
    params: [customer.first_name],
  });
  // Resume onboarding: trigger credit scoring
  await updateSessionState(customer.whatsapp_number, 'credit_scoring');
} else if (decision === 'REJECTED') {
  await axios.post(`${WHATSAPP_API_URL}/whatsapp/send`, {
    to: customer.whatsapp_number,
    type: 'text',
    message: `Your identity verification was not successful. Reason: ${rejectionReason}. You can try again by sending RESTART.`,
  });
}
```

### Phase 6: Wire i18n into Onboarding

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 6.1 | Replace hardcoded English strings with i18n calls | `services/whatsapp-service/src/onboarding.ts` (MODIFY) | TODO |
| 6.2 | Replace hardcoded English strings in loan-commands | `services/whatsapp-service/src/loan-commands.ts` (MODIFY) | TODO |

**Current:** All onboarding handler functions use hardcoded English strings like:
```typescript
responseMessage = `Welcome to Lynia Finance! ...`;
```

**Target:** Use i18n translation function:
```typescript
const lang = await getCustomerLanguage(phone);
responseMessage = t('welcome_message', lang);
```

### Phase 7: Unit Tests

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 7.1 | Onboarding state machine unit tests | `services/whatsapp-service/tests/onboarding.test.ts` (NEW) | TODO |
| 7.2 | Loan commands unit tests | `services/whatsapp-service/tests/loan-commands.test.ts` (NEW) | TODO |
| 7.3 | Error handler unit tests | `services/whatsapp-service/tests/error-handler.test.ts` (NEW) | TODO |
| 7.4 | i18n unit tests | `services/whatsapp-service/tests/i18n.test.ts` (NEW) | TODO |

---

## 4. Pre-existing Issues to Fix

These bugs/inconsistencies exist in the current WhatsApp service code and should be addressed during integration:

| # | Issue | Severity | Files Affected |
|---|-------|----------|----------------|
| 1 | **Table name mismatch:** Code uses `whatsapp_onboarding_sessions` but migration 001 defines `whatsapp_sessions` | HIGH | `onboarding.ts`, `database/migrations/001_initial_schema.sql` |
| 2 | **KYC auto-approve:** `handleKYCSelfieUpload` hardcodes `kycResult = { verified: true }` | HIGH | `onboarding.ts` |
| 3 | **i18n not wired:** 47 translation keys exist in `i18n.ts` but onboarding uses hardcoded English | MEDIUM | `onboarding.ts`, `loan-commands.ts` |
| 4 | **Empty module directories:** `src/flows/`, `src/handlers/`, `src/templates/` contain only `.gitkeep` | LOW | N/A |
| 5 | **No unit tests:** `services/whatsapp-service/tests/` is empty | MEDIUM | N/A |
| 6 | **KYC notification TODO:** No WhatsApp message sent on KYC completion | HIGH | `services/kyc-service/src/index.ts` |
| 7 | **WhatsApp 24h window:** KYC processing may exceed 24h session window, requiring template messages for follow-up | MEDIUM | `onboarding.ts` |

---

## 5. WhatsApp Cloud API Reference

### Base URL
```
https://graph.facebook.com/v18.0
```

### Authentication
```
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
```

### Send Text Message
```http
POST /{PHONE_NUMBER_ID}/messages
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "263771234567",
  "type": "text",
  "text": { "body": "Your message here" }
}
```

### Send Template Message
```http
POST /{PHONE_NUMBER_ID}/messages
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "263771234567",
  "type": "template",
  "template": {
    "name": "loan_application_welcome",
    "language": { "code": "en" },
    "components": [{
      "type": "body",
      "parameters": [{ "type": "text", "text": "John" }]
    }]
  }
}
```

### Download Media (for KYC photos)
```http
GET /{MEDIA_ID}
Authorization: Bearer {ACCESS_TOKEN}

# Returns: { url: "https://..." }
# Then GET the URL to download the binary
```

### Webhook Verification (GET)
```
GET /whatsapp/webhook?hub.mode=subscribe&hub.challenge=123456&hub.verify_token=lynia_webhook_2025
Response: 123456
```

### Webhook Payload (POST)
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "263771234567",
          "type": "text|image|interactive",
          "text": { "body": "Hi" }
        }]
      }
    }]
  }]
}
```

### Error Codes Handled in Code
| Code | Meaning | Action |
|------|---------|--------|
| 131031 | Rate limit exceeded | Queue for retry via SQS |
| 131047 | Message undeliverable | Fallback to SMS |
| 130472 | User not on WhatsApp | Fallback to SMS |
| 133016 | 24h service window expired | Use template message instead |

### Rate Limits
- Test: 1,000 messages/day, 5 recipients
- Production: 100K+/day (with business verification)
- API: 40 requests/second

---

## 6. Integration with Other Services

### Services that WhatsApp calls
| Service | Method | Purpose |
|---------|--------|---------|
| Database (RDS) | Direct query via `database.ts` | Read/write sessions, messages, customers |
| KYC Service | HTTP POST to `/kyc/initiate` | Submit KYC verification (Phase 4) |
| Scoring Service | HTTP POST to `SCORING_API_URL` | Calculate credit score after KYC |
| Fineract | Via `fineract-sync.ts` | Get real-time loan balances for BALANCE/SCHEDULE commands |
| SQS | `SQSQueues.retryWhatsAppMessage()` | Retry failed message sends |

### Services that call WhatsApp
| Service | Method | Purpose |
|---------|--------|---------|
| Notification Service | HTTP POST to `/whatsapp/send` | Payment reminders, KYC results, device lock/unlock |
| KYC Service | HTTP POST to `/whatsapp/send` | KYC verification result notification (Phase 5) |
| Lock Service | References WhatsApp in handover confirmation | Device handover confirmation |

---

## 7. Rollout Strategy

### Step 1: Infrastructure (Zero risk)
- Store real Meta credentials in Secrets Manager
- Deploy Lambda with credentials
- Configure webhook in Meta Dashboard
- No messages sent yet - just webhook verification

### Step 2: Webhook Testing (Low risk)
- Send test messages from personal WhatsApp to business number
- Verify handler receives and logs correctly
- Test HMAC signature validation with real `META_APP_SECRET`

### Step 3: Template Registration (External dependency)
- Submit 7 templates to Meta for approval
- Wait for approval (24-48h per template)
- Test approved templates with test recipients

### Step 4: Onboarding Flow (Medium risk)
- Test the full onboarding state machine with real messages
- Initially without real KYC (keep auto-approve for this phase)
- Validate session management, timeouts, command routing

### Step 5: KYC Integration (High value)
- Wire real KYC (Didit) into the onboarding flow
- Replace auto-approve with actual API call
- Enable KYC result notifications via WhatsApp
- Test with Didit sandbox credentials

### Step 6: Production Launch (Controlled)
- Switch KYC to production Didit credentials
- Enable real credit scoring pipeline
- Monitor first 20 customers closely
- Keep support escalation path available

---

## 8. Cost Estimates

### Meta WhatsApp Business API
- Free tier: 1,000 conversations/month
- Zimbabwe rate: ~$0.04/conversation (business-initiated)
- User-initiated: Free within 24h window
- Estimated: $40-200/month for 1K-5K customers

### AWS Infrastructure (Monthly)
- Lambda: ~$5 (estimated 50K invocations)
- API Gateway: ~$3 (50K requests)
- SQS: ~$1 (retry queue)
- CloudWatch: ~$2 (logs)
- Secrets Manager: ~$1 (5 secrets)
- **Total: ~$12-15/month**

---

## 9. Security Checklist

```
[ ] WhatsApp access token stored in Secrets Manager (not env vars in production)
[ ] META_APP_SECRET configured for HMAC webhook validation
[ ] Webhook rejects requests without valid HMAC signature
[ ] Input sanitization blocks XSS/SQL injection patterns
[ ] Rate limiting enforced (10 commands/hour per phone)
[ ] Rapid message detection (5 messages in 5 seconds)
[ ] Message length validation (max 500 chars)
[ ] PII masked in all logs (phone numbers, national IDs)
[ ] Circuit breaker protects against Meta API outages
[ ] SQS retry queue handles transient failures
[ ] No sensitive data in WhatsApp messages (no full IDs, no passwords)
[ ] 24h window handling uses templates (not session messages)
```

---

## 10. Progress Report

### Completed (Pre-existing)
| Item | Status | Notes |
|------|--------|-------|
| Lambda handler + API routes | DONE | 3 endpoints fully implemented |
| Onboarding state machine | DONE | 20 states, 8-step flow (KYC stubbed) |
| Loan commands | DONE | 7 commands with Fineract fallback |
| Error handling pipeline | DONE | 8 layers, rate limiting, sanitization |
| i18n translations | DONE | English, Shona, Ndebele (not wired) |
| Webhook HMAC validation | DONE | SHA-256 constant-time comparison |
| Circuit breaker | DONE | Failure threshold 5, 60s reset |
| SQS retry queue | DONE | Exponential backoff (30*2^n seconds) |
| Contract tests | DONE | 581 lines covering all routes |
| Bot flow documentation | DONE | 7 templates, 4 flows, interactive messages |
| Setup guide documentation | DONE | Full Meta setup walkthrough |

### Remaining
| Item | Est. Effort | Dependencies |
|------|-------------|-------------|
| Store credentials in Secrets Manager | Small | Meta credentials available |
| Deploy Lambda + configure webhook | Small | Credentials stored |
| Submit 7 message templates to Meta | Small (24-48h approval wait) | Meta Dashboard access |
| Test webhook + message sending | Medium | Webhook configured |
| Wire KYC into onboarding | Medium | KYC service (Didit) working |
| KYC result notifications | Medium | WhatsApp send working + KYC callback |
| Wire i18n into onboarding | Medium | None |
| Wire i18n into loan commands | Small | None |
| Unit tests for onboarding | Medium | None |
| Unit tests for loan commands | Small | None |
| Unit tests for error handler | Small | None |
| Full pipeline E2E testing | Large | All above completed |

---

**Document Version**: 1.0
**Last Updated**: 2026-02-16
**Author**: Engineering Team
**Related Documents**:
- `docs/guides/WHATSAPP-CLOUD-API-SETUP.md`
- `docs/guides/WHATSAPP-BOT-FLOW.md`
- `KYC/DIDIT-MIGRATION-PLAN.md`
