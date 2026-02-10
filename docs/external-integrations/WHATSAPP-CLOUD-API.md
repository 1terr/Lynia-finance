# WhatsApp Cloud API Integration Plan

> Customer communication channel for onboarding, payments, and support

## Provider Overview

| Detail | Value |
|--------|-------|
| **Provider** | Meta (WhatsApp Cloud API) |
| **API Version** | v18.0 (Graph API) |
| **Pricing** | 1,000 service conversations/month free |
| **Current Status** | Code written, Meta Business account not verified |

---

## Why WhatsApp

- 90%+ smartphone penetration in Zimbabwe
- Familiar interface for semi-literate users
- No app download required
- Works on low-end devices and slow connections
- Supports voice messages for complex explanations
- Supports Shona, Ndebele, and English

**WhatsApp is NOT required for initial go-live.** It is a customer self-service
channel that enhances the experience but is not on the critical path.

---

## Integration Phases

### Phase 1: No WhatsApp (Current - Go-Live)

**Customer communication handled via:**
- Admin portal (direct operations by staff)
- SMS via Africa's Talk ($0.008/SMS) for notifications
- Phone calls for critical communications
- Distributor in-person interactions

**This is sufficient for pilot with 20-30 customers and 5-10 distributors.**

### Phase 2: WhatsApp Sandbox

**Prerequisites:**
- [ ] Meta Business account created and verified
- [ ] WhatsApp Business API access approved
- [ ] Phone number registered for WhatsApp Business
- [ ] Webhook URL configured (Lambda endpoint)
- [ ] Message templates submitted and approved by Meta

**Tasks:**
1. Configure sandbox credentials
2. Test webhook verification handshake
3. Test sending template messages (payment reminders, status updates)
4. Test receiving customer messages
5. Test conversation flow (onboarding, loan inquiry, payment)
6. Test multi-language support (English, Shona, Ndebele)
7. Test rate limiting and spam detection
8. Run contract tests against sandbox

**Message templates to submit for approval:**

```
# Payment Reminder
Template name: payment_reminder
Language: en, sn, nd
Body: "Hi {{1}}! Your payment of ${{2}} is due {{3}}.
Reply: 1-Pay now, 2-Request extension, 3-Check balance"

# Payment Confirmation
Template name: payment_confirmation
Body: "Payment received! ${{1}} for loan {{2}}.
New balance: ${{3}}. Thank you!"

# KYC Status Update
Template name: kyc_status
Body: "Your identity verification is {{1}}.
{{2}}"

# Device Lock Warning
Template name: lock_warning
Body: "Important: Your device will be restricted in {{1}} days
due to overdue payment of ${{2}}.
Reply 1 to make payment now."

# Loan Approval
Template name: loan_approved
Body: "Great news! Your loan of ${{1}} has been approved.
Visit your nearest Lynia distributor to collect your device.
Reference: {{2}}"
```

### Phase 3: Production Activation

**Prerequisites:**
- [ ] Meta Business verification complete
- [ ] All message templates approved
- [ ] Webhook endpoint production-ready
- [ ] Rate limiting configured
- [ ] Spam detection active
- [ ] Support escalation path defined

**Activation steps:**
1. Switch `whatsapp-provider-mode` to `live`
2. Send first batch of payment reminders (10% of customers)
3. Monitor delivery rates, read rates, response rates
4. Enable inbound message handling (customer-initiated)
5. Gradually enable conversation flows:
   - Week 1: Payment reminders only (outbound)
   - Week 2: Balance inquiries (inbound)
   - Week 3: Payment initiation (inbound)
   - Week 4: Full onboarding flow (inbound)
6. Scale to 100% of customers

---

## Conversation Flows (Already Implemented in Code)

**Existing code:** `services/whatsapp-service/src/`

### Customer Onboarding
```
Customer: "Hi" or "Start"
Bot: Welcome message (English/Shona/Ndebele selection)
Bot: Terms & conditions
Customer: Accepts terms
Bot: KYC data collection (name, ID, address, phone, 2x next of kin)
Bot: Submit for verification
Bot: "We'll notify you within 24 hours"
```

### Loan Application
```
Customer: "Apply" or "Loan"
Bot: Check KYC status (must be approved)
Bot: Show available devices with prices
Customer: Selects device
Bot: Show repayment plan
Customer: Confirms application
Bot: "Your application is being reviewed"
```

### Payment
```
Customer: "Pay" or "1"
Bot: Show outstanding balance
Bot: Show payment options (EcoCash, O'mari, OneWallet, InnBucks)
Customer: Selects provider
Bot: Generate payment reference + USSD instructions
Customer: Completes payment on phone
Bot: "Payment of $X received. New balance: $Y"
```

### Balance Check
```
Customer: "Balance" or "3"
Bot: "Your loan balance is $X. Next payment of $Y due on DATE."
```

---

## API Contract Summary

### Send Message

```typescript
// POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
{
  messaging_product: "whatsapp",
  to: "+263771234567",
  type: "template",
  template: {
    name: "payment_reminder",
    language: { code: "en" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "John" },
          { type: "text", text: "150.00" },
          { type: "text", text: "15 February 2026" }
        ]
      }
    ]
  }
}
```

### Webhook (Inbound Message)

```typescript
// POST /whatsapp/webhook (our endpoint)
{
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: "263771234567",
          type: "text",
          text: { body: "Pay" },
          timestamp: "1707984000"
        }]
      }
    }]
  }]
}
```

### Webhook Verification

```typescript
// GET /whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
// Return: hub.challenge value (plain text)
```

---

## Multi-Language Support

Already implemented in `services/whatsapp-service/src/i18n.ts`:

| Language | Code | Coverage |
|----------|------|----------|
| English | en | Full |
| Shona | sn | Full |
| Ndebele | nd | Full |

Language detected from customer's first message or explicitly selected.

---

## Rate Limiting & Abuse Prevention

Already implemented in WhatsApp service:
- Max 5 messages per minute per customer
- Rapid message detection (10 messages in 30 seconds = blocked)
- Inappropriate language filtering
- Spam detection and auto-block
- Circuit breaker: 5 API failures → pause for 60 seconds

---

## Monitoring

```yaml
metrics:
  - whatsapp_messages_sent
  - whatsapp_messages_received
  - whatsapp_delivery_rate
  - whatsapp_read_rate
  - whatsapp_response_time_ms
  - whatsapp_conversation_count
  - whatsapp_api_errors

alerts:
  critical:
    - whatsapp_delivery_rate < 90%
    - whatsapp_api_error_rate > 5%
  warning:
    - whatsapp_response_time p95 > 5000ms
    - whatsapp_rate_limit_hits > 10/hour
```
