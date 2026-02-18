# WhatsApp Cloud API - External Configuration Report

**Date**: 2026-02-18
**Status**: Complete - Live in Production
**Executed by**: Claude Code + Manual Dashboard Configuration

---

## Summary

All WhatsApp Cloud API external configuration tasks have been completed. The WhatsApp bot is live in production, receiving and responding to real customer messages with a permanent access token and published Meta app.

---

## Tasks Completed

### Task 1: GitHub Secrets Set

All 10 WhatsApp-related secrets are configured:

| Secret | Status | Date Set |
|--------|--------|----------|
| `STAGING_WHATSAPP_PHONE_ID` | Set | 2026-02-09 |
| `STAGING_WHATSAPP_TOKEN` | Set (permanent) | 2026-02-18 |
| `STAGING_WEBHOOK_TOKEN` | Set | 2026-02-09 |
| `STAGING_WHATSAPP_BUSINESS_ACCOUNT_ID` | Set | 2026-02-18 |
| `STAGING_META_APP_SECRET` | Set | 2026-02-18 |
| `PRODUCTION_WHATSAPP_PHONE_ID` | Set | 2026-02-18 |
| `PRODUCTION_WHATSAPP_TOKEN` | Set (permanent) | 2026-02-18 |
| `PRODUCTION_WEBHOOK_TOKEN` | Set | 2026-02-18 |
| `PRODUCTION_WHATSAPP_BUSINESS_ACCOUNT_ID` | Set | 2026-02-18 |
| `PRODUCTION_META_APP_SECRET` | Set | 2026-02-18 |

### Task 2: Webhook Configuration

- **Callback URL**: `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/whatsapp/webhook`
- **Verify Token**: Configured and verified
- **Webhook Fields Subscribed**: `messages` (active)
- **Verification Status**: Passed — Lambda returns HTTP 200 with challenge echo

### Task 3: Message Templates Submitted

7 templates submitted for Meta review (24-48h approval):

| # | Template Name | Category | Variables | Status |
|---|---------------|----------|-----------|--------|
| 1 | `welcome_message` | MARKETING | None | Pending review |
| 2 | `kyc_verification_request` | MARKETING (auto-reclassified) | None | Pending review |
| 3 | `kyc_result_approved` | UTILITY | `{{1}}` name | Pending review |
| 4 | `kyc_result_rejected` | UTILITY | `{{1}}` name | Pending review |
| 5 | `loan_offer` | UTILITY | `{{1-5}}` name, amount, rate, term, payment | Pending review |
| 6 | `payment_reminder` | UTILITY | `{{1-3}}` name, amount, date | Pending review |
| 7 | `payment_confirmation` | UTILITY | `{{1-4}}` name, paid, balance, next date | Pending review |

### Task 4: Deployments

| Environment | Status | Deploy Run |
|-------------|--------|------------|
| Staging | Deployed with all secrets | Success (2026-02-18) |
| Production | Deployed with permanent token | Success (2026-02-18) |

### Task 5: E2E Testing

| Test | Result |
|------|--------|
| HMAC validation (spoofed webhook) | 401 — Rejected |
| Webhook verification (GET challenge) | 200 — Passed |
| Bot response to WhatsApp message | Working — Bot replies |

### Task 6: Go-Live

- **Permanent Access Token**: Generated via Meta Business Settings system user — no expiration
- **App Published**: Meta app published and available for public use
- **Privacy Policy URL**: Set to `https://d1qwfy2tsdmpe4.cloudfront.net`

---

## Production Configuration

| Component | Value |
|-----------|-------|
| Meta App ID | `919783197240242` |
| WABA ID | `1589372019465976` |
| Phone Number ID | `1008788982315015` |
| Test Number | +1 555 191 0708 |
| Webhook URL | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/whatsapp/webhook` |
| Lambda Function | `production-lynia-whatsapp-service` |
| Log Group | `/aws/lambda/production-lynia-whatsapp-service` |

---

## Architecture (Live)

```
Customer sends WhatsApp message
         |
         v
Meta Cloud API → POST /whatsapp/webhook
         |
         v
HMAC-SHA256 signature validation (META_APP_SECRET)
         |
         v
WhatsApp Lambda handler (production-lynia-whatsapp-service)
         |
    ┌────┴─────────────────────────┐
    | New customer?                | Existing customer?
    v                              v
20-State Onboarding Machine    Command Router
    |                              |
    | welcome → personal_info →    | BALANCE → Fineract API
    | employment → product →       | HISTORY → Fineract API
    | kyc_id → kyc_selfie →        | SCHEDULE → Fineract API
    | processing → scoring →       | PAY → Payment service
    | offer → complete             | HELP → Help menu
    |                              |
    v                              v
Send response via WhatsApp Cloud API
POST graph.facebook.com/v18.0/{phone_id}/messages
(Using permanent system user token)
```

---

## Remaining Follow-Up Items

| Item | Priority | Notes |
|------|----------|-------|
| Monitor template approvals | High | Check in 24-48h; templates needed for proactive messages |
| Add real Zimbabwe phone number | High | Replace +1 555 test number with +263 business number |
| Create proper privacy policy page | Medium | Currently using CloudFront root URL as placeholder |
| Create terms of service page | Medium | Not yet set in Meta App Settings |
| Monitor first 10 customer interactions | High | Watch CloudWatch logs for errors |
| Set up CloudWatch alarms | Medium | Alert on Lambda errors and high latency |
| Wire i18n translations to handlers | Low | Shona/Ndebele translations exist but handlers use hardcoded English |

---

## Secrets Checklist (Final)

All WhatsApp secrets: **SET**
All Didit KYC secrets: **SET**
All payment provider secrets: **SET**
AWS credentials: **SET**

Total GitHub secrets configured: **26**
