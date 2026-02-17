# WhatsApp Cloud API Integration Report

**Date**: 2026-02-17
**Status**: Code Complete, Deployed to Staging, Pending External Configuration
**Commits**: `74ce419`, `b2ce2b2`, `7bba804`

---

## Executive Summary

The WhatsApp service onboarding flow has been fully wired to the real KYC API and WhatsApp Cloud API for media handling. The 20-state onboarding state machine now collects National ID numbers, downloads ID photos and selfies via WhatsApp Cloud API media endpoints, submits them to the KYC service, and handles both synchronous (Didit) and asynchronous (Smile Identity) verification results. KYC result notifications are sent back to customers via WhatsApp.

### Integration at a Glance

| Component | Status | Detail |
|-----------|--------|--------|
| Lambda handler + API routes | DONE | `/whatsapp/send`, `/whatsapp/webhook` GET/POST |
| Onboarding state machine (20 states) | DONE | Real KYC API calls, media download, async handling |
| WhatsApp Cloud API media download | DONE | 2-step GET (metadata → binary) to base64 |
| ID number collection (text input) | DONE | Zimbabwe ID format validation before photo |
| KYC initiation from onboarding | DONE | Downloads media, calls `POST /kyc/initiate` |
| Sync KYC result handling (Didit) | DONE | Immediate approval/rejection in same message |
| Async KYC result handling (Smile) | DONE | "Please wait" → callback notification |
| `kyc_processing` wait state | DONE | Checks DB for completed KYC when customer messages |
| KYC result notification via WhatsApp | DONE | KYC Lambda sends directly via Cloud API |
| Credit scoring with real KYC data | DONE | Fetches KYC scores from `kyc_submissions` table |
| Webhook HMAC validation | DONE | SHA-256 with constant-time comparison |
| Error handling + circuit breaker | DONE | 8-layer pipeline, rate limiting |
| SQS retry queue | DONE | Exponential backoff for failed messages |
| Session table alignment | DONE | Migration 024 syncs `state_data`/`session_data` |
| SAM infrastructure | DONE | `KYC_API_URL` env var for inter-service calls |
| Loan commands (active customers) | DONE | BALANCE, HISTORY, SCHEDULE via Fineract |
| i18n translations | EXISTS | 47 keys in `i18n.ts`, not yet wired into handlers |
| Message template registration | PENDING | 7 templates need Meta approval |
| Webhook registration with Meta | PENDING | Need to configure in Meta App Dashboard |
| Meta Business Account | DONE | Account exists, credentials available |
| Unit tests | 896/896 pass | E2E onboarding flow tests updated |

---

## Architecture

### Onboarding Flow (Customer → Loan Offer)

```
Customer sends WhatsApp message
         │
         ▼
  API Gateway → WhatsApp Lambda
         │
         ▼
  Session lookup (whatsapp_sessions)
         │
  ┌──────┴──────────────────────────────┐
  │  20-State Onboarding Machine        │
  │                                     │
  │  welcome → language → personal_info │
  │  → phone_verification → address     │
  │  → employment → income              │
  │  → product_selection                │
  │  → kyc_id_upload (ID number first)  │
  │    → kyc_id_photo (download media)  │
  │    → kyc_selfie_upload (download)   │
  │    → kyc_processing (wait/poll)     │
  │  → credit_scoring                   │
  │  → loan_offer → deposit → complete  │
  └─────────────────────────────────────┘
         │
         ▼ (at kyc_selfie_upload)
  Download WhatsApp media (2-step):
    1. GET graph.facebook.com/{media_id} → get URL
    2. GET download URL → base64 image
         │
         ▼
  POST /kyc/initiate
    { id_number, id_photo (base64), selfie (base64) }
         │
    ┌────┴────┐
    │ Sync    │ Async
    │ (Didit) │ (Smile)
    ▼         ▼
  Immediate   "Please wait"
  result      → kyc_processing state
              → KYC callback later
              → WhatsApp notification
```

### KYC Result Notification Flow

```
Didit/Smile webhook → KYC Lambda callback handler
         │
         ▼
  processKYCResult()
         │
         ▼
  sendKYCResultNotification()
    1. Lookup customer phone from DB
    2. Build decision message (approved/rejected/review)
    3. Update whatsapp_sessions state
    4. POST to WhatsApp Cloud API directly
         │
         ▼
  Customer receives WhatsApp message:
    ✅ "Identity Verified!" or
    ❌ "Verification Unsuccessful" or
    ⏸️ "Manual Review Required"
```

---

## Files Modified/Created

### Modified Files
| File | Change |
|------|--------|
| `services/whatsapp-service/src/onboarding.ts` | Major rewrite: real KYC API, media download, async handling |
| `services/whatsapp-service/src/error-handler.ts` | Allow text+image for `kyc_id_upload` state |
| `services/whatsapp-service/src/index.ts` | Rename table to `whatsapp_sessions` |
| `services/kyc-service/src/index.ts` | Add `sendKYCResultNotification()` function |
| `services/shared/fraud-detection.ts` | Rename table to `whatsapp_sessions` |
| `template.yaml` | Add `KycApiUrl` param, WhatsApp creds to KYC function |
| `env.json` | Add `KYC_API_URL` for local dev |

### New Files
| File | Purpose |
|------|---------|
| `database/migrations/024_whatsapp_sessions_align.sql` | Add `state_data`, `last_activity_at` with sync triggers |

### Key Functions Added

| Function | File | Purpose |
|----------|------|---------|
| `downloadWhatsAppMedia()` | onboarding.ts | 2-step WhatsApp Cloud API media download → base64 |
| `handleKYCProcessing()` | onboarding.ts | Poll DB for async KYC results |
| `resumeOnboardingAfterKYC()` | onboarding.ts | Export for KYC callback to update session |
| `sendKYCResultNotification()` | kyc/index.ts | Send WhatsApp message on KYC completion |

---

## Database Migration 024

```sql
-- Add columns the code expects
ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS state_data JSONB;
ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Sync trigger: keeps state_data ↔ session_data in sync
CREATE TRIGGER trg_sync_whatsapp_session_data
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION sync_whatsapp_session_data();
```

---

## Pre-existing Issues Fixed

| Issue | Fix |
|-------|-----|
| Table name mismatch: code used `whatsapp_onboarding_sessions`, DB has `whatsapp_sessions` | Renamed in 4 files |
| Column mismatch: code uses `state_data`/`last_activity_at`, DB had `session_data`/`last_message_at` | Migration 024 adds columns + sync trigger |
| KYC step was hardcoded: `kycResult = { verified: true, confidence: 0.96 }` | Now calls real KYC API |
| No ID number collection in onboarding | Added text input step before photo |
| Error handler rejected text for `kyc_id_upload` state | Changed expected input to `'any'` |

---

## Remaining Steps to Go Live

### 1. WhatsApp Webhook Configuration (Meta Dashboard)
- [ ] Go to Meta App Dashboard → WhatsApp → Configuration
- [ ] Set webhook URL: `https://{api-gateway-url}/Prod/whatsapp/webhook`
- [ ] Set verify token to match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` secret
- [ ] Subscribe to events: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`
- [ ] Test webhook verification (Meta sends GET with challenge)

### 2. WhatsApp Credentials
- [ ] Set GitHub secrets with real Meta credentials:
  ```bash
  gh secret set STAGING_WHATSAPP_BUSINESS_ACCOUNT_ID --body "<id>"
  gh secret set STAGING_META_APP_SECRET --body "<secret>"
  gh secret set PRODUCTION_WHATSAPP_BUSINESS_ACCOUNT_ID --body "<id>"
  gh secret set PRODUCTION_META_APP_SECRET --body "<secret>"
  ```
- [ ] Verify `STAGING_WHATSAPP_PHONE_ID` and `STAGING_WHATSAPP_TOKEN` are correct

### 3. Message Template Registration
Submit 7 templates to Meta for approval (24-48h review):
- [ ] `welcome_message` - First contact greeting
- [ ] `kyc_verification_request` - Request for ID documents
- [ ] `kyc_result_approved` - Verification success
- [ ] `kyc_result_rejected` - Verification failed
- [ ] `loan_offer` - Loan terms presentation
- [ ] `payment_reminder` - Upcoming payment
- [ ] `payment_confirmation` - Payment received

### 4. Database Migration
- [ ] Run migration 024 against production RDS

### 5. End-to-End Testing
- [ ] Send test WhatsApp message to business number
- [ ] Complete full onboarding flow
- [ ] Verify KYC photos downloaded and submitted
- [ ] Verify KYC result notification received
- [ ] Verify credit scoring uses real KYC data
- [ ] Test RESTART and CANCEL commands
- [ ] Test session expiry

### 6. Production Deployment
- [ ] Deploy with real WhatsApp credentials
- [ ] Monitor first 10 customer interactions
- [ ] Verify webhook reliability

---

## i18n Status (Deferred)

47 translation keys exist in `services/whatsapp-service/src/i18n.ts` for English, Shona, and Ndebele. These are **not yet wired** into the onboarding handlers (handlers use hardcoded English strings). This is tracked as a follow-up task and does not block go-live.

---

## Test Results

```
tests/e2e/e2e-001-complete-onboarding.test.ts    36 passed
tests/e2e/e2e-005-non-zimbabwe-rejection.test.ts 29 passed
tests/contract/kyc-service.contract.test.ts       29 passed (includes callback flow)

Total: 896/896 tests pass across all 33 test suites
```
