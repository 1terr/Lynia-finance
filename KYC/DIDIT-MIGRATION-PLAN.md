# KYC Provider Migration: Smile Identity to DIDIT

> **Status:** In Progress
> **Branch:** `claude/switch-kyc-provider-QOWP1`
> **Date:** 2026-02-16
> **Owner:** Engineering Team

---

## 1. Context & Motivation

Lynia Finance currently integrates with **Smile Identity** for KYC verification. We are switching to **DIDIT** (https://didit.me/) as our KYC provider.

**Why DIDIT:**
- Simpler authentication model (API key header vs HMAC-signed requests)
- Richer standalone APIs (ID verification, passive liveness, face match as separate endpoints)
- Support for 220+ countries and 4000+ document types (including Zimbabwe National IDs)
- Built-in AML screening capability (future use)
- Free tier: 500 checks/month; pay-per-use credits with no minimums
- Webhook V3 format with robust signature verification (V2 sorted-key HMAC)

**Integration approach:** Use **DIDIT Standalone APIs** (server-to-server) since our primary flow is WhatsApp-driven (no browser). Customers send photos via WhatsApp, the backend processes them directly against DIDIT APIs.

---

## 2. Current Architecture (Smile Identity)

### Service Layer
| Component | File | Role |
|-----------|------|------|
| Lambda handler | `services/kyc-service/src/index.ts` | 4 routes: initiate, callback, status, retry |
| Smile client | `services/kyc-service/src/smile-identity-service.ts` | Job Type 5 (Enhanced KYC), HMAC auth, webhook verification |
| Image processor | `services/kyc-service/src/image-processor.ts` | Zimbabwe ID validation, image format conversion |
| Scoring integration | `services/scoring-service/src/index.ts` | `SmileIdentityResult` interface, 10% credit score weight |
| WhatsApp flow | `services/whatsapp-service/src/onboarding.ts` | KYC states in onboarding (currently auto-approves for testing) |

### Infrastructure
| Resource | Location | Details |
|----------|----------|---------|
| SAM params | `template.yaml` | `SmilePartnerId`, `SmileApiKey`, `SmileEnvironment` |
| Secrets | `infrastructure/aws/secrets-manager.yaml` | `{env}/lynia/smile-identity` |
| SQS queue | `infrastructure/aws/sqs-queues.yaml` | `{env}-lynia-kyc-processing` (exists but not wired) |
| Env vars | `.env.example` | `SMILE_PARTNER_ID`, `SMILE_API_KEY`, etc. |

### Database
| Table | KYC Columns |
|-------|-------------|
| `kyc_submissions` | `verification_id`, `smile_identity_response JSONB`, `confidence_score`, `face_match_score`, `liveness_passed` |
| `customers` | `kyc_status`, `kyc_verified_at`, `kyc_expires_at` |
| `credit_scores` | `kyc_verification_score` (0-100) |

### Frontend
| Component | File |
|-----------|------|
| KYC review card | `frontend/admin-portal/src/components/kyc-review/KYCReviewCard.tsx` |
| KYC review page | `frontend/admin-portal/src/app/(dashboard)/customers/kyc-review/_client.tsx` |
| Customer header badge | `frontend/admin-portal/src/components/customers/CustomerHeader.tsx` |
| KYC hooks | `frontend/admin-portal/src/lib/hooks/useKYCReview.ts` |
| API client | `frontend/admin-portal/src/lib/api/customers.ts` |

---

## 3. Target Architecture (DIDIT)

### DIDIT API Endpoints Used

| API | Endpoint | Method | Content-Type | Purpose |
|-----|----------|--------|-------------|---------|
| ID Verification | `POST /v3/id-verification/` | POST | `multipart/form-data` | Document OCR + authenticity check |
| Passive Liveness | `POST /v3/passive-liveness/` | POST | `multipart/form-data` | Spoof detection from a single selfie |
| Face Match | `POST /v3/face-match/` | POST | `multipart/form-data` | Selfie-to-ID portrait comparison |

**Authentication:** `x-api-key` header on all requests.

### DIDIT Webhook Format (V3)

**Headers:** `X-Signature-V2` (recommended), `X-Signature-Simple`, `X-Timestamp`

**Signature verification (V2):**
1. Parse JSON body
2. Sort all keys recursively
3. Truncate whole-value floats (e.g., 5.0 -> 5)
4. Re-serialize to JSON (preserving Unicode)
5. HMAC-SHA256 with webhook secret key
6. Constant-time comparison against `X-Signature-V2` header
7. Reject if `X-Timestamp` older than 5 minutes

**Payload structure:**
```json
{
  "session_id": "uuid",
  "status": "Approved | Declined | In Review | In Progress",
  "webhook_type": "status.updated",
  "vendor_data": "customer-id",
  "decision": {
    "id_verifications": [{ "status": "Approved", "full_name": "...", ... }],
    "liveness_checks": [{ "status": "Approved", "score": 89.92, ... }],
    "face_matches": [{ "status": "Approved", "score": 80, ... }],
    "aml_screenings": [{ ... }]
  }
}
```

### Status Mapping

| DIDIT Status | Lynia Decision | DB `kyc_submissions.status` | DB `customers.kyc_status` |
|---|---|---|---|
| `Approved` | APPROVED | `verified` | `verified` |
| `Declined` | REJECTED | `rejected` | `rejected` |
| `In Review` | MANUAL_REVIEW | `manual_review` | `in_review` |
| `In Progress` | — | `pending` | `pending` |

### Score Normalization

| Field | Smile Identity | DIDIT | Normalized (internal) |
|---|---|---|---|
| Confidence | 0-100 float | 0-100 int | 0-100 int |
| Face match | 0-100 int | 0-100 int | 0-100 int |
| Liveness | 0-100 int | 0-100 int | 0-100 int |
| Face match for scoring service | 0-100 | 0-100 | Divide by 100 -> 0-1 float |

---

## 4. Deliverables

### Phase 1: Provider Abstraction Layer + DIDIT Client

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 1.1 | Provider-neutral KYC types | `services/shared/types/kyc-provider.ts` (NEW) | DONE |
| 1.2 | DIDIT service client | `services/kyc-service/src/didit-service.ts` (NEW) | DONE |
| 1.3 | SmileIdentityService adapter | `services/kyc-service/src/smile-identity-service.ts` (MODIFY) | TODO |
| 1.4 | Provider factory | `services/kyc-service/src/kyc-provider-factory.ts` (NEW) | TODO |
| 1.5 | Add `form-data` dependency | `services/kyc-service/package.json` (MODIFY) | TODO |
| 1.6 | Update shared types exports | `services/shared/types/index.ts` (MODIFY) | TODO |

**Details:**

**1.1 `services/shared/types/kyc-provider.ts`** — Defines:
- `KYCProvider` interface: `submitVerification()`, `verifyWebhookSignature()`, `parseWebhookPayload()`, `determineDecision()`, `handleError()`
- `KYCVerificationResult` — normalized result with `provider`, `provider_job_id`, scores (0-100), boolean checks, extracted `id_info`, `warnings[]`, `raw_response`
- `KYCSubmitParams` — customer_id, id_number, images, optional name/dob/phone
- `KYCSubmissionResponse`, `KYCErrorResponse`, `KYCDecision` types
- `KYCProviderName` type: `'smile_identity' | 'didit'`

**1.2 `services/kyc-service/src/didit-service.ts`** — `DiditService implements KYCProvider`:
- Constructor reads `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET` from env via `requireEnv()`
- `submitVerification()`: Makes 3 sequential API calls with circuit breaker:
  1. `POST /v3/id-verification/` with `front_image` (multipart/form-data)
  2. `POST /v3/passive-liveness/` with `user_image` (selfie)
  3. `POST /v3/face-match/` with `user_image` (selfie) + `ref_image` (ID front)
- Converts base64 images to Buffer for form-data upload
- `verifyWebhookSignature()`: DIDIT V2 sorted-key JSON canonicalization + HMAC-SHA256
- `parseWebhookPayload()`: Maps DIDIT `decision` object arrays to normalized `KYCVerificationResult`
- `parseCombinedResult()`: Maps standalone API combined result to normalized format
- `determineDecision()`: Same thresholds (>=85 approve, <50 reject, 50-84 review)
- `handleError()`: Maps HTTP errors (400/401/403/429) to `KYCErrorResponse`

**1.3 SmileIdentityService adapter** — Add `implements KYCProvider` + thin adapter methods:
- `submitVerification()` delegates to existing `submitEnhancedKYC()`
- `parseWebhookPayload()` converts `SmileWebhookPayload` to `KYCVerificationResult`
- `determineDecision()` delegates to existing `determineVerificationDecision()`
- `handleError()` delegates to existing `handleSmileError()`
- All existing methods remain unchanged for backward compatibility

**1.4 Provider factory** — reads `KYC_PROVIDER` env var, returns `DiditService` or `SmileIdentityService`

### Phase 2: Lambda Handler Updates

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 2.1 | Refactor handler to use provider abstraction | `services/kyc-service/src/index.ts` (MODIFY) | TODO |

**Changes:**
1. Replace `const smileService = new SmileIdentityService()` with `const kycProvider = createKYCProvider()`
2. `initiateKYC`: Call `kycProvider.submitVerification()` instead of `smileService.submitEnhancedKYC()`; write `kyc_provider` and `provider_job_id` to DB
3. `handleSmileCallback` -> `handleKYCCallback`: Detect provider from webhook headers (`X-Signature-V2` = DIDIT, `X-Signature` without V2 = Smile); delegate to provider methods; write to `provider_response` column
4. `getKYCStatus` and `retryKYC`: No functional changes needed

### Phase 3: Database Migration

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 3.1 | Provider migration SQL | `database/migrations/NNN_kyc_provider_migration.sql` (NEW) | TODO |

**Migration adds to `kyc_submissions`:**
```sql
kyc_provider VARCHAR(50) DEFAULT 'smile_identity'
provider_job_id VARCHAR(200)
provider_response JSONB
provider_warnings JSONB
```
- Backfills existing rows with `kyc_provider='smile_identity'`, `provider_job_id=verification_id`, `provider_response=smile_identity_response`
- Adds indexes: `idx_kyc_provider`, `idx_kyc_provider_job_id`
- Does NOT drop Smile-specific columns (RBZ 7-year record retention requirement)

### Phase 4: Scoring Service

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 4.1 | Rename `SmileIdentityResult` to `KYCVerificationInput` | `services/scoring-service/src/index.ts` (MODIFY) | TODO |

**Changes:**
- Rename `SmileIdentityResult` interface to `KYCVerificationInput` (same shape)
- Update `CreditScoreInput.kyc_result` type reference
- `scoreKYCVerification()` logic unchanged (already provider-agnostic)

### Phase 5: Infrastructure

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 5.1 | Add DIDIT SAM parameters + env vars | `template.yaml` (MODIFY) | TODO |
| 5.2 | Add DIDIT secret | `infrastructure/aws/secrets-manager.yaml` (MODIFY) | TODO |
| 5.3 | Add `getDiditSecrets()` | `services/shared/utils/secrets.ts` (MODIFY) | TODO |
| 5.4 | Add DIDIT env vars | `.env.example` (MODIFY) | TODO |

**template.yaml changes:**
- Add parameters: `DiditApiKey`, `DiditWebhookSecret`, `DiditEnvironment`, `KYCProvider`
- Add env vars to `KYCFunction`: `KYC_PROVIDER`, `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `DIDIT_ENVIRONMENT`
- Keep Smile params during transition period
- Update IAM policy: add `${Environment}/lynia/didit-*` secret access

**secrets-manager.yaml changes:**
- Add `DiditSecret` resource with `DIDIT_API_KEY` and `DIDIT_WEBHOOK_SECRET`
- Update `KYCSecretsPolicy` to include the DIDIT secret

### Phase 6: Frontend

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 6.1 | Update KYC submission types | `frontend/admin-portal/src/types/index.ts` (MODIFY) | TODO |
| 6.2 | Update KYC review card | `frontend/admin-portal/src/components/kyc-review/KYCReviewCard.tsx` (MODIFY) | TODO |
| 6.3 | Update customer KYC card | `frontend/admin-portal/src/components/customers/KYCReviewCard.tsx` (MODIFY) | TODO |

**Changes:**
- Add `kyc_provider` and `provider_result` fields to KYC submission types
- Read from `provider_result` with `smile_identity_response` fallback
- Show provider name badge ("DIDIT" or "Smile Identity")
- Rename "Smile Identity Analysis" heading to "Verification Analysis"
- Display DIDIT warnings if present

### Phase 7: Tests

| # | Deliverable | File | Status |
|---|-------------|------|--------|
| 7.1 | Update contract tests | `tests/contract/kyc-service.contract.test.ts` (MODIFY) | TODO |
| 7.2 | Add DIDIT mock fixtures | `tests/helpers/mock-external-services.ts` (MODIFY) | TODO |
| 7.3 | Unit tests for DiditService | `tests/unit/didit-service.test.ts` (NEW) | TODO |
| 7.4 | Update E2E test fixtures | `tests/e2e/e2e-001-complete-onboarding.test.ts` (MODIFY) | TODO |

---

## 5. Test Plan

### 5.1 Unit Tests — DiditService (`tests/unit/didit-service.test.ts`)

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `submitVerification` - success | Calls all 3 APIs with correct form data | Returns `KYCSubmissionResponse` with `provider_job_id` |
| `submitVerification` - ID verification fails | DIDIT returns 400 on ID | Throws error, circuit breaker records failure |
| `submitVerification` - liveness fails | DIDIT returns 400 on liveness | Throws error with retriable flag |
| `submitVerification` - face match fails | DIDIT returns 400 on face match | Throws error with retriable flag |
| `submitVerification` - rate limited | DIDIT returns 429 | Error with `retry_after` set |
| `submitVerification` - auth failure | DIDIT returns 401 | Error with `admin_action_required: true` |
| `submitVerification` - insufficient credits | DIDIT returns 403 with credits message | Error with `admin_action_required: true` |
| `base64ToBuffer` - with data URI prefix | Input: `data:image/jpeg;base64,/9j/...` | Returns correct Buffer |
| `base64ToBuffer` - without prefix | Input: `/9j/4AAQ...` | Returns correct Buffer |
| `verifyWebhookSignature` - valid V2 | Correct sorted-key HMAC | Returns `true` |
| `verifyWebhookSignature` - invalid signature | Wrong HMAC | Returns `false` |
| `verifyWebhookSignature` - stale timestamp | Timestamp > 5 min old | Returns `false` |
| `verifyWebhookSignature` - Unicode chars | Payload with accented characters | Correctly handles Unicode preservation |
| `verifyWebhookSignature` - malformed JSON | Invalid payload | Returns `false` |
| `sortKeys` - nested object | `{b: {d: 1, c: 2}, a: 3}` | `{a: 3, b: {c: 2, d: 1}}` |
| `sortKeys` - with arrays | `{b: [{z: 1, a: 2}]}` | Arrays preserved, objects within sorted |
| `shortenFloats` - whole value float | `5.0` | `5` |
| `shortenFloats` - real float | `5.5` | `5.5` |
| `parseWebhookPayload` - approved | Full DIDIT webhook with Approved status | Correct `KYCVerificationResult` with `match_result: 'verified'` |
| `parseWebhookPayload` - declined | Webhook with Declined + expired doc | `match_result: 'not_verified'`, `document_expired: true` |
| `parseWebhookPayload` - in review | Webhook with In Review | `match_result: 'manual_review'` |
| `parseWebhookPayload` - no decision | Intermediate webhook (In Progress) | Throws error |
| `parseCombinedResult` - all approved | Combined result with all 3 APIs approved | Correct scores, `match_result: 'verified'` |
| `parseCombinedResult` - liveness declined | Liveness Declined, others Approved | `liveness_passed: false`, `match_result: 'not_verified'` |
| `determineDecision` - approve | confidence 90, all checks pass | `APPROVED` |
| `determineDecision` - reject low confidence | confidence 40 | `REJECTED`, reason mentions confidence |
| `determineDecision` - reject liveness | liveness_passed false | `REJECTED`, reason mentions liveness |
| `determineDecision` - reject tampered | document_tampered true | `REJECTED`, reason mentions tampered |
| `determineDecision` - reject expired | document_expired true | `REJECTED`, reason mentions expired |
| `determineDecision` - manual review | confidence 70, all checks pass | `MANUAL_REVIEW` |
| `handleError` - 400 | Unreadable document | `retriable: true`, photo retake message |
| `handleError` - 429 | Rate limit | `retriable: true`, `retry_after` set |
| `handleError` - unknown | Network error | `retriable: true`, generic message |
| `mapGender` - male variants | `'M'`, `'MALE'`, `'male'` | `'M'` |
| `mapGender` - female variants | `'F'`, `'FEMALE'`, `'female'` | `'F'` |
| `mapGender` - null/unknown | `undefined`, `'X'` | `null` |

### 5.2 Unit Tests — SmileIdentityService Adapter

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `submitVerification` adapter | Delegates to `submitEnhancedKYC` | Correct `KYCSubmissionResponse` |
| `parseWebhookPayload` | Smile payload -> `KYCVerificationResult` | Correct field mapping |
| `parseWebhookPayload` - face_match score | Smile score 85 (0-100) | Normalized to 85 |
| `determineDecision` adapter | Delegates to existing `determineVerificationDecision` | Same decisions as before |
| `handleError` adapter | Delegates to existing `handleSmileError` | Same error responses |

### 5.3 Contract Tests Updates (`tests/contract/kyc-service.contract.test.ts`)

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `POST /kyc/initiate` - DIDIT provider | Initiate with `KYC_PROVIDER=didit` | Calls `DiditService.submitVerification`, stores `kyc_provider='didit'` |
| `POST /kyc/callback` - DIDIT webhook | DIDIT payload with `X-Signature-V2` | Verifies V2 signature, processes decision |
| `POST /kyc/callback` - DIDIT approved | Approved webhook | Updates `kyc_submissions.status='verified'`, `customers.kyc_status='verified'` |
| `POST /kyc/callback` - DIDIT declined | Declined webhook | Updates status to `rejected` |
| `POST /kyc/callback` - DIDIT in review | In Review webhook | Creates `kyc_manual_reviews` entry |
| `POST /kyc/callback` - DIDIT invalid sig | Wrong `X-Signature-V2` | Returns 401 |
| `POST /kyc/callback` - DIDIT stale timestamp | Old `X-Timestamp` | Returns 401 |
| `POST /kyc/callback` - Smile legacy | Smile payload with `X-Signature` | Still works (backward compatible) |
| All existing Smile tests | No regressions | Pass unchanged |

### 5.4 Mock Fixtures (`tests/helpers/mock-external-services.ts`)

Add DIDIT fixtures alongside existing Smile fixtures:

```typescript
export const mockDiditResponses = {
  approvedKYC: {
    idVerification: { status: 'Approved', full_name: 'JOHN MOYO', document_number: '63-123456A47', ... },
    liveness: { status: 'Approved', score: 95, method: 'PASSIVE', ... },
    faceMatch: { status: 'Approved', score: 88, ... },
  },
  declinedKYC: {
    idVerification: { status: 'Declined', warnings: [{ risk: 'DOCUMENT_EXPIRED', ... }], ... },
    liveness: { status: 'Declined', score: 30, ... },
    faceMatch: { status: 'Declined', score: 25, ... },
  },
  inReviewKYC: {
    idVerification: { status: 'Approved', ... },
    liveness: { status: 'Approved', score: 72, ... },
    faceMatch: { status: 'In Review', score: 60, ... },
  },
};
```

### 5.5 Integration / E2E Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| Complete onboarding with DIDIT | WhatsApp flow -> KYC initiate -> DIDIT APIs -> callback -> scoring | End-to-end pass |
| Provider fallback | Set `KYC_PROVIDER=smile_identity` | Smile flow works as before |
| Admin KYC review (DIDIT) | DIDIT submission appears in review queue | Provider badge shows "DIDIT", warnings displayed |
| Scoring with DIDIT result | DIDIT scores fed to credit scoring | Correct score calculation (face_match/100 for 0-1 range) |

### 5.6 Manual Testing Checklist

```
[ ] DIDIT sandbox credentials obtained and configured
[ ] ID Verification API responds with correct document extraction
[ ] Passive Liveness API responds for selfie images
[ ] Face Match API compares selfie to ID portrait correctly
[ ] Webhook signature verification passes with real DIDIT webhook
[ ] Admin portal displays DIDIT verification results
[ ] Admin portal displays provider badge ("DIDIT")
[ ] KYC approve/reject actions work for DIDIT submissions
[ ] Rollback to Smile Identity works (set KYC_PROVIDER=smile_identity)
[ ] Existing Smile Identity submissions still display correctly
[ ] Credit scoring accepts DIDIT results
[ ] Rate limiting works with DIDIT (3 requests/hour for /kyc paths)
```

---

## 6. Rollout Strategy

### Step 1: Infrastructure (Zero risk)
- Deploy DIDIT secret to Secrets Manager
- Update IAM policies to include DIDIT secret access
- Set `KYC_PROVIDER=smile_identity` (no behavior change)

### Step 2: Code deployment (Low risk)
- Deploy provider abstraction, DIDIT client, updated handler
- Still routing all traffic to Smile Identity
- Run contract and unit tests

### Step 3: Database migration (Low risk)
- Run migration to add provider-agnostic columns
- Backfill existing Smile data
- Verify no data loss

### Step 4: Staging validation (Medium risk)
- Set `KYC_PROVIDER=didit` in staging
- Run full E2E tests with DIDIT sandbox
- Compare results with Smile Identity for same test documents
- Monitor DIDIT's 500 free checks/month allocation

### Step 5: Production cutover (Controlled)
- Set `KYC_PROVIDER=didit` in production
- Monitor first 20 real verifications closely
- Check: webhook delivery, processing time, confidence distributions, approve/reject/review ratios
- Keep Smile Identity credentials active for 30 days as rollback

### Step 6: Cleanup (After 30 days stable)
- Remove Smile Identity env vars from active config
- Mark Smile code as deprecated (keep for compliance)
- Do NOT drop deprecated DB columns (RBZ 7-year retention)

---

## 7. Progress Report

### Completed

| Item | Status | Notes |
|------|--------|-------|
| Codebase analysis — KYC service | DONE | Full review of all 4 KYC source files, 436 lines |
| Codebase analysis — cross-service references | DONE | Mapped all KYC refs across 30+ files |
| DIDIT API research | DONE | Documented all endpoints, auth, webhooks, response formats |
| Architecture decision | DONE | Standalone APIs (not session-based) for WhatsApp flow |
| Provider abstraction design | DONE | `KYCProvider` interface with normalized types |
| Provider-neutral types file | DONE | `services/shared/types/kyc-provider.ts` committed |
| DIDIT service client | DONE | `services/kyc-service/src/didit-service.ts` committed |
| Migration plan document | DONE | This file |

### In Progress

| Item | Status | Next Step |
|------|--------|-----------|
| SmileIdentityService adapter | IN PROGRESS | Add `implements KYCProvider` |

### Remaining

| Item | Est. Effort | Dependencies |
|------|-------------|-------------|
| SmileIdentityService adapter | Small | Types (done) |
| Provider factory | Small | Both service classes |
| Lambda handler refactor (`index.ts`) | Medium | Factory, both services |
| Database migration SQL | Small | None |
| Scoring service type rename | Small | Types (done) |
| SAM template + Secrets Manager updates | Small | None |
| Shared secrets utility update | Small | None |
| `.env.example` update | Trivial | None |
| Frontend type updates | Small | DB migration |
| Frontend KYCReviewCard updates | Medium | Frontend types |
| Contract test updates | Medium | Handler refactor |
| DIDIT unit tests | Medium | DIDIT service |
| Mock fixture updates | Small | None |
| Build verification | Small | All code changes |

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| DIDIT webhook delivery failure | KYC stuck in pending | Poll DIDIT decision endpoint as fallback |
| Score threshold mismatch | Wrong approval rates | Shadow-test with same documents before cutover |
| DIDIT V2 signature canonicalization bugs | Webhooks rejected | Thorough unit tests + test with real DIDIT sandbox |
| `multipart/form-data` issues in Lambda | Submissions fail | Use `form-data` npm package; test with sandbox |
| Existing Smile data becomes unqueryable | Admin portal broken | Keep all deprecated columns; add provider fallback |
| DIDIT rate limiting (500 free/month) | Service blocked | Monitor usage; upgrade to prepaid credits plan |
| Zimbabwe document support gaps | KYC failures | Verify Zimbabwe National ID support in DIDIT sandbox before production |

### Known Issues in Current KYC Implementation

These pre-existing issues are documented for reference (not part of this migration scope):

1. **WhatsApp flow auto-approves KYC** — `handleKYCSelfieUpload` in `onboarding.ts` hardcodes `kycResult.verified = true`
2. **Missing `kyc_manual_reviews` table migration** — code inserts into this table but no migration defines it
3. **`kyc_verifications` vs `kyc_submissions` naming conflict** — migration 013 alters `kyc_verifications` but runtime uses `kyc_submissions`
4. **Runtime vs schema field mismatch** — insert uses `id_document_photo_url`, `smile_identity_transaction_id` but migration defines `id_document_url`, `verification_id`
5. **SQS queue not wired** — KYC processing queue provisioned but Lambda trigger commented out
6. **No WhatsApp notification on KYC completion** — callback handler has `// TODO: Send notification`
7. **Credential loading inconsistency** — Service uses `requireEnv()` instead of `getSmileIdentitySecrets()` from Secrets Manager
