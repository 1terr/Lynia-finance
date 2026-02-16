# WhatsApp + KYC (Didit) + Fineract: End-to-End Pipeline Architecture

> **Status:** Integration Planning
> **Date:** 2026-02-16
> **Accounts Ready:** Meta WhatsApp (verified), Didit KYC (API key obtained)
> **Related Documents:**
> - `Whatsapp/WHATSAPP-INTEGRATION-PLAN.md`
> - `KYC/DIDIT-MIGRATION-PLAN.md`
> - `docs/guides/WHATSAPP-CLOUD-API-SETUP.md`
> - `docs/guides/WHATSAPP-BOT-FLOW.md`

---

## 1. Full Pipeline Overview

The complete customer journey flows through three external services in sequence:

```
Customer (WhatsApp)
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  WHATSAPP CLOUD API (Meta)                                      │
│  - Receives customer messages via webhook                       │
│  - Sends responses, templates, interactive messages             │
│  - Downloads media (ID photos, selfies) for KYC                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
     ┌─────────────────────┼──────────────────────┐
     │                     │                      │
     ▼                     ▼                      ▼
┌──────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Onboard  │    │ Loan Commands   │    │ Notifications   │
│ (8 steps)│    │ (BALANCE, etc.) │    │ (reminders,     │
│          │    │                 │    │  lock/unlock)   │
└────┬─────┘    └────────┬────────┘    └─────────────────┘
     │                   │
     ▼                   │
┌─────────────────────────────────────────────────────────────────┐
│  DIDIT KYC API                                                  │
│  - ID Verification: POST /v3/id-verification/                   │
│  - Passive Liveness: POST /v3/passive-liveness/                 │
│  - Face Match: POST /v3/face-match/                             │
│  - Webhook callback with verification decision                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  CREDIT SCORING SERVICE                                         │
│  - KYC verification score (10% weight, normalized 0-1)          │
│  - Affordability, repayment willingness, mobile money, external │
│  - Decision: approve (tier 1/2/3) or reject                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  APACHE FINERACT (Core Banking Ledger)                          │
│  - Create client (m_client) ← Lynia customer UUID as externalId│
│  - Create loan (m_loan) ← tier maps to product ID              │
│  - Approve loan ← immediate after scoring approval             │
│  - Disburse loan ← after deposit payment confirmed             │
│  - Post repayments ← on each payment webhook                   │
│  - Source of truth for balances, schedules, GL entries          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Flow: Customer Onboarding (WhatsApp → KYC → Scoring → Fineract)

### Step-by-Step Data Flow

```
Step 1: Customer sends "Hi" to WhatsApp Business Number
        ├── Meta sends POST /whatsapp/webhook (HMAC-signed)
        ├── WhatsApp Lambda validates HMAC signature
        ├── findOrCreateCustomer() → inserts into `customers` table
        ├── Creates `whatsapp_onboarding_sessions` row (state: 'welcome')
        └── Sends welcome message with options

Step 2-4: Collect Personal Info + Employment + Product Selection
        ├── State machine progresses through onboarding steps
        ├── Data stored in session_data JSONB column
        ├── Zimbabwe phone format validated (+263/0 + 71-78XXXXXXX)
        └── Product selection (smartphone or digital credit)

Step 5: KYC - ID Upload
        ├── Customer sends National ID photo via WhatsApp
        ├── WhatsApp stores media_id in session
        ├── State transitions to 'kyc_id_upload'
        └── Prompts for selfie

Step 6: KYC - Selfie Upload
        ├── Customer sends selfie via WhatsApp
        ├── [CURRENT: hardcoded auto-approve - needs fixing]
        │
        ├── [TARGET FLOW:]
        │   ├── Download ID image: GET /{media_id} → get URL → download binary
        │   ├── Download selfie: GET /{media_id} → get URL → download binary
        │   ├── POST /kyc/initiate with base64 images
        │   │   ├── KYC Lambda calls DiditService.submitVerification()
        │   │   │   ├── POST /v3/id-verification/ (document OCR + authenticity)
        │   │   │   ├── POST /v3/passive-liveness/ (spoof detection)
        │   │   │   └── POST /v3/face-match/ (selfie vs ID portrait)
        │   │   ├── Writes to `kyc_submissions` table
        │   │   └── Returns submission_id
        │   ├── State transitions to 'kyc_processing'
        │   └── Sends "We're verifying your identity..." message
        │
        ├── [ASYNC: Didit sends webhook callback]
        │   ├── POST /kyc/callback (HMAC V2 signed)
        │   ├── KYC Lambda verifies signature
        │   ├── Determines decision: APPROVED / REJECTED / MANUAL_REVIEW
        │   ├── Updates `kyc_submissions.status` and `customers.kyc_status`
        │   └── Sends WhatsApp notification to customer
        │
        └── [ON APPROVAL: resume onboarding]

Step 7: Credit Scoring
        ├── POST to SCORING_API_URL with customer data + KYC result
        ├── Scoring Lambda calculates 5-component score:
        │   ├── Affordability (30%)
        │   ├── Repayment willingness (25%)
        │   ├── Mobile money activity (20%)
        │   ├── External credit (15%)
        │   └── KYC verification (10%) ← Didit scores normalized to 0-1
        ├── Decision: approve (tier 1/2/3) or reject
        │
        ├── [ON APPROVE: Non-blocking Fineract sync]
        │   ├── syncCustomerToFineract()
        │   │   ├── POST /fineract-provider/api/v1/clients
        │   │   ├── Writes fineract_client_id to `customers`
        │   │   └── On failure: queue to SQS for retry
        │   │
        │   ├── syncLoanToFineract()
        │   │   ├── Maps credit tier → Fineract product ID (1/2/3)
        │   │   ├── POST /fineract-provider/api/v1/loans
        │   │   ├── Writes fineract_loan_id to `loans`
        │   │   └── On failure: queue to SQS for retry
        │   │
        │   └── approveLoanInFineract()
        │       ├── POST /fineract-provider/api/v1/loans/{id}?command=approve
        │       └── On failure: queue to SQS for retry
        │
        └── WhatsApp response with loan offer

Step 8: Terms Acceptance
        ├── Customer replies "ACCEPT" via WhatsApp
        ├── Consent logged to `customer_consents` table
        ├── State transitions to 'completed'
        └── Shop collection instructions sent

Post-Onboarding: Loan Lifecycle (Fineract-managed)
        ├── Deposit payment → disburseLoanInFineract() → loan status: active
        ├── Monthly payments → syncRepaymentToFineract() → balance updates
        ├── BALANCE command → getFineractLoanBalance() → real-time from Fineract
        ├── SCHEDULE command → getFineractRepaymentSchedule() → from Fineract
        ├── Overdue detection → notification service → WhatsApp template
        ├── Device lock → lock service → Trustonic API
        └── Reconciliation → every 6 hours → compare Lynia DB vs Fineract
```

---

## 3. Service Integration Map

### Inter-Service Communication

```
                          ┌─────────────────────────┐
                          │    API Gateway (HTTPS)    │
                          │    Cognito Authorizer     │
                          └────────┬────────────────┘
                                   │
         ┌─────────────┬───────────┼───────────┬──────────────┐
         │             │           │           │              │
         ▼             ▼           ▼           ▼              ▼
    ┌─────────┐  ┌──────────┐ ┌────────┐ ┌─────────┐  ┌──────────┐
    │WhatsApp │  │  KYC     │ │Scoring │ │Payment  │  │Fineract  │
    │Service  │──│  Service │─│Service │ │Service  │  │Proxy     │
    │         │  │  (Didit) │ │        │ │         │  │Service   │
    └────┬────┘  └────┬─────┘ └───┬────┘ └────┬────┘  └────┬─────┘
         │            │           │            │            │
         │     ┌──────┴───┐  ┌───┴────┐       │     ┌──────┴──────┐
         │     │ Didit API │  │Fineract│       │     │ Fineract    │
         │     │(external) │  │  Sync  │       │     │   ALB       │
         │     └───────────┘  │(shared)│       │     │ (internal)  │
         │                    └───┬────┘       │     └─────────────┘
         │                        │            │
    ┌────┴───────────────────────┴────────────┴───┐
    │              PostgreSQL (RDS)                 │
    │  customers, loans, payments, kyc_submissions  │
    │  fineract_sync_log, whatsapp_sessions, etc.   │
    └──────────────────────────────────────────────┘
```

### Who Calls Who

| Caller | Callee | Method | When |
|--------|--------|--------|------|
| WhatsApp Service | Meta Cloud API | HTTPS (axios) | Sending messages |
| WhatsApp Service | KYC Service | HTTP POST `/kyc/initiate` | KYC photo submission |
| WhatsApp Service | Scoring Service | HTTP POST `SCORING_API_URL` | Credit scoring after KYC |
| WhatsApp Service | Fineract Sync | Direct import | BALANCE, SCHEDULE commands |
| KYC Service | Didit API | HTTPS (axios) | ID verification, liveness, face match |
| KYC Service | WhatsApp Service | HTTP POST `/whatsapp/send` | KYC result notification |
| Scoring Service | Fineract Sync | Direct import | Create client, loan, approve |
| Payment Service | Fineract Sync | Direct import | Disburse, post repayment |
| Notification Service | WhatsApp Service | HTTP POST `/whatsapp/send` | Payment reminders, lock warnings |
| Fineract Proxy | Fineract ALB | HTTPS (native http) | Admin portal operations |
| Reconciliation | Fineract ALB | HTTPS (native http) | Balance comparison (every 6h) |

### SQS Queues in the Pipeline

| Queue | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `{env}-lynia-whatsapp-message-retry` | WhatsApp Service | WhatsApp Service | Retry failed Meta API sends |
| `{env}-lynia-kyc-processing` | WhatsApp Service | KYC Service | Async KYC submissions (not yet wired) |
| `{env}-lynia-credit-scoring` | KYC Service | Scoring Service | Async scoring (not yet wired) |
| `{env}-lynia-fineract-sync-retry` | Fineract Sync | Reconciliation | Retry failed Fineract operations |
| `{env}-lynia-notifications` | Various | Notification Service | Async notification delivery |
| `{env}-lynia-device-locks` | Notification Service | Lock Service | Async device lock/unlock |

**Note:** SQS Lambda triggers are currently commented out in `template.yaml`. All primary flows use synchronous HTTP calls via API Gateway. SQS is used only for retry/recovery paths.

---

## 4. Data Flow: Key Database Tables

### Tables Written During Onboarding

| Step | Table | Key Columns Written |
|------|-------|-------------------|
| First message | `customers` | `phone_number`, `whatsapp_number`, `kyc_status='pending'`, `status='active'` |
| First message | `whatsapp_onboarding_sessions` | `phone_number`, `current_state='welcome'`, `session_data={}` |
| Each message | `whatsapp_messages` | `message_id`, `direction`, `content`, `message_type` |
| Personal info | `whatsapp_onboarding_sessions` | `session_data.name`, `.dob`, `.gender`, `.location` |
| Employment | `whatsapp_onboarding_sessions` | `session_data.employment_type`, `.income`, `.debts` |
| KYC submit | `kyc_submissions` | `customer_id`, `id_number`, `id_document_url`, `selfie_url`, `kyc_provider='didit'` |
| KYC callback | `kyc_submissions` | `status`, `confidence_score`, `face_match_score`, `provider_response` |
| KYC callback | `customers` | `kyc_status='verified'`, `kyc_verified_at` |
| Credit score | `credit_scores` | 5 component scores, `total_score`, `credit_tier` |
| Loan creation | `loans` | `customer_id`, `amount`, `term_months`, `status='approved'` |
| Fineract sync | `customers` | `fineract_client_id`, `fineract_synced_at` |
| Fineract sync | `loans` | `fineract_loan_id`, `fineract_product_id`, `fineract_synced_at` |
| Terms accept | `customer_consents` | `consent_type='loan_terms'`, `version='1.0'` |
| Terms accept | `whatsapp_onboarding_sessions` | `current_state='completed'` |

### Tables Read During Loan Commands

| Command | Tables Read | Fineract Fallback |
|---------|------------|-------------------|
| BALANCE | `loans` + Fineract balance | Falls back to `loans.outstanding_balance` |
| SCHEDULE | Fineract repayment schedule | Falls back to computed from `loans` columns |
| HISTORY | `payments` | No Fineract equivalent used |
| DEVICE | `devices` | N/A |
| EXTENSION | `loans` | N/A |

---

## 5. Updated Workflow: Fineract-Aware Scoring & Loan Creation

The scoring service is the integration point where the KYC result triggers Fineract loan creation:

```typescript
// services/scoring-service/src/index.ts - handleCalculateScore()

// 1. Calculate credit score (KYC result included)
const scoreResult = await calculateCreditScore({
  customer_id,
  kyc_result: {
    id_verification: { status: kycSubmission.status === 'verified' ? 'verified' : 'failed' },
    face_match: { confidence: kycSubmission.face_match_score / 100 },  // ← Didit: divide by 100
    liveness: { status: kycSubmission.liveness_passed ? 'passed' : 'failed' },
  },
  // ... affordability, repayment, mobile_money, external_credit
});

// 2. Write score to DB
await db.from('credit_scores').insert({ ... });

// 3. Create/update loan in Lynia DB
if (scoreResult.decision === 'approve') {
  await db.from('loans').insert({
    customer_id,
    amount: scoreResult.approved_amount,
    term_months: tierConfig.term,
    status: 'approved',
    credit_tier: scoreResult.tier,
  });
}

// 4. Non-blocking Fineract sync (fire-and-forget)
if (scoreResult.decision === 'approve' && process.env.FINERACT_SECRET_NAME) {
  syncApprovedCustomerToFineract(customer_id).catch(err => {
    logger.error('Fineract customer sync failed', { error: err.message });
    // Failure logged to fineract_sync_log, queued for retry
  });
  syncApprovedLoanToFineract(customer_id, scoreResult).catch(err => {
    logger.error('Fineract loan sync failed', { error: err.message });
    // Failure logged to fineract_sync_log, queued for retry
  });
}
```

### Fineract Product Mapping

| Credit Tier | Lynia Config | Fineract Product ID | Max Amount | Term |
|-------------|-------------|---------------------|------------|------|
| Tier 1 (new customers) | `system_config` | 1 | $250 | 12 months |
| Tier 2 (repeat, good history) | `system_config` | 2 | $500 | 18 months |
| Tier 3 (premium) | `system_config` | 3 | $1000 | 24 months |

### Key Fineract Design Invariants

1. **Lynia UUID = Fineract externalId** for both clients and loans
2. **Non-blocking sync** - Fineract failures never block customer-facing responses
3. **Fineract-optional** - if `FINERACT_SECRET_NAME` is unset, all sync is skipped
4. **Reconciliation every 6 hours** - compares balances, retries failed syncs
5. **Admin portal uses Fineract-backed routes** - `/api/v1/fineract/loans/*` is the only loan API

---

## 6. WhatsApp 24-Hour Window Strategy

WhatsApp Cloud API has a critical constraint: **you can only send free-form text messages within 24 hours of the customer's last message**. After 24 hours, only pre-approved template messages are allowed.

### Impact on KYC Flow

KYC verification via Didit may take time (especially manual review). If the customer sends their selfie and KYC takes > 24 hours:

| Scenario | Time | Message Type Required |
|----------|------|----------------------|
| KYC result within 24h | < 24h | Free-form text (session message) |
| KYC result after 24h | > 24h | Template message required |
| Manual review pending | 1-24h | Template message (safer to always use) |

### Recommended Approach

**Always use template messages for KYC result notifications.** This is safer and works regardless of timing:

1. On KYC approval: Send `kyc_verification_request` template (repurposed) or create a new `kyc_approved` template
2. On KYC rejection: Send a template with rejection reason and retry instructions
3. On manual review: Send a template explaining the review is in progress

**Templates needed (not yet registered with Meta):**
- `kyc_approved` - "Your identity has been verified! Your credit score is being calculated..."
- `kyc_rejected` - "We couldn't verify your identity. Reason: {{1}}. Reply RESTART to try again."
- `kyc_in_review` - "Your documents are being reviewed by our team. We'll update you within 24 hours."

---

## 7. Error Recovery Across the Pipeline

### Failure Points and Recovery

| Failure Point | What Happens | Recovery Mechanism |
|---------------|-------------|-------------------|
| Meta API down | Message send fails | Circuit breaker opens → SQS retry queue (30*2^n seconds) |
| Meta rate limit (131031) | 429 response | Queue for retry via SQS |
| Meta 24h window expired (133016) | Session message rejected | Resend as template message |
| Didit API down | KYC submission fails | Circuit breaker opens → customer told to try later |
| Didit rate limit (429) | API returns retry_after | Wait and retry with exponential backoff |
| Didit webhook delivery fails | No KYC callback received | Reconciliation polls Didit decision endpoint (future) |
| Scoring service error | No credit decision | WhatsApp sends error message, customer can retry |
| Fineract API down | Loan not synced | Non-blocking failure → SQS retry → reconciliation retries every 6h |
| Fineract balance mismatch | Incorrect balance shown | Reconciliation detects and logs discrepancy |
| Database error | Operation fails | Lambda returns 500, customer gets error message |

### Circuit Breaker Settings

| Service | Failure Threshold | Reset Timeout | Fallback |
|---------|------------------|---------------|----------|
| Meta WhatsApp API | 5 failures | 60 seconds | SQS retry queue |
| Didit KYC API | 5 failures | 60 seconds | Error message to customer |
| Fineract API | 5 failures | 60 seconds | Lynia DB values (graceful degradation) |

---

## 8. Implementation Priority Order

Given both accounts are ready, here is the recommended execution order:

### Week 1: Foundation (Parallel Tracks A + B)

**Track A - KYC (Didit) Wiring:**
1. Add `form-data` to `services/kyc-service/package.json`
2. Create `kyc-provider-factory.ts`
3. Adapt `SmileIdentityService` to implement `KYCProvider`
4. Refactor `index.ts` handler to use factory
5. Create database migration for provider columns
6. Add Didit to Secrets Manager template + SAM params

**Track B - WhatsApp Credentials:**
1. Store Meta credentials in Secrets Manager
2. Deploy Lambda and configure webhook in Meta Dashboard
3. Submit 7 message templates to Meta for approval
4. Test webhook verification handshake

### Week 2: Testing + Scoring (Parallel)

**Track A - KYC continued:**
1. Scoring service normalization (Didit 0-100 → 0-1)
2. Frontend KYC review card updates (provider-agnostic)
3. Unit tests for DiditService
4. Contract tests with Didit provider

**Track B - WhatsApp continued:**
1. Test inbound/outbound messages
2. Test onboarding flow (welcome → personal info)
3. Wire i18n into onboarding handlers

### Week 3: Integration (Track C)

1. Wire real KYC into WhatsApp onboarding (replace auto-approve)
2. Implement media download for KYC photos
3. KYC result notifications via WhatsApp templates
4. Full pipeline test: WhatsApp → KYC (Didit) → Scoring → Fineract → Loan Offer
5. Test KYC rejection + retry flow
6. Test Fineract loan creation after scoring approval

### Week 4: Production Readiness

1. Staging deployment with all services connected
2. Test with real Didit sandbox documents
3. Monitor Fineract sync log for failures
4. Production deployment with `KYC_PROVIDER=didit`
5. Monitor first 20 customers end-to-end

---

## 9. Known Issues to Resolve

| # | Issue | Files | Priority |
|---|-------|-------|----------|
| 1 | KYC auto-approve hardcoded | `services/whatsapp-service/src/onboarding.ts` | CRITICAL |
| 2 | Table name: `whatsapp_onboarding_sessions` vs `whatsapp_sessions` | `onboarding.ts`, migration 001 | HIGH |
| 3 | Column name: `id_document_photo_url` vs `id_document_url` | `kyc-service/src/index.ts`, migration 001 | HIGH |
| 4 | Missing `kyc_manual_reviews` table migration | `kyc-service/src/index.ts` | HIGH |
| 5 | i18n not wired into onboarding | `onboarding.ts`, `i18n.ts` | MEDIUM |
| 6 | KYC notification TODO in callback | `kyc-service/src/index.ts` | HIGH |
| 7 | SQS Lambda triggers commented out | `template.yaml` | LOW (not blocking) |
| 8 | Scoring uses `SmileIdentityResult` name | `scoring-service/src/index.ts` | MEDIUM |
| 9 | `form-data` missing from KYC package.json | `services/kyc-service/package.json` | HIGH |

---

**Document Version**: 1.0
**Last Updated**: 2026-02-16
**Author**: Engineering Team
