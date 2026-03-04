# KYC Integration Report - Dual Provider (Didit + DIDIT)

**Date**: 2026-02-17
**Status**: Code Complete, Deployed to Staging, Pending External Configuration
**Commits**: `74ce419`, `b2ce2b2`, `7bba804`

---

## Executive Summary

The KYC service has been upgraded from a single-provider (DIDIT) architecture to a **dual-provider system** supporting both DIDIT and Didit. Providers are switchable via the `KYC_PROVIDER` environment variable with no code changes required. All 69 unit + contract tests pass (40 Didit, 29 contract).

### Integration at a Glance

| Component | Status | Detail |
|-----------|--------|--------|
| Didit client (`didit-service.ts`) | DONE | 3-step verification: ID, liveness, face-match |
| DIDIT client | DONE | Implements `KYCProvider` interface |
| Provider factory (`kyc-provider-factory.ts`) | DONE | Reads `KYC_PROVIDER` env var |
| Provider interface (`kyc-provider.ts`) | DONE | Normalized types for both providers |
| Lambda handler refactor | DONE | Uses factory instead of direct DIDIT instantiation |
| WhatsApp notification on KYC result | DONE | Sends result via WhatsApp Cloud API directly |
| Database migration 023 | DONE | `kyc_provider`, `provider_job_id`, `provider_response` columns |
| Scoring normalization | DONE | Both providers normalize to 0-100 integer scale |
| Frontend provider display | DONE | Admin portal renders based on `kyc_provider` value |
| SAM infrastructure (Didit params) | DONE | `DiditApiKey`, `DiditWebhookSecret`, `KYCProvider` in template.yaml |
| CI/CD deploy.yml | DONE | Didit secrets wired into staging + production deploy |
| GitHub secrets | PARTIAL | `KYC_PROVIDER` set; Didit API keys need real values |
| Didit account credentials | PENDING | Need actual API key + webhook secret from Didit dashboard |
| Didit webhook configuration | PENDING | Set callback URL in Didit dashboard |
| Unit tests (Didit) | DONE | 40 tests covering all methods |
| Contract tests (KYC handler) | DONE | 29 tests with provider factory |
| E2E tests updated | DONE | Updated mocks for KYCProvider interface |

---

## Architecture

### Provider Interface Pattern

```
KYC_PROVIDER env var
       │
       ▼
createKYCProvider()  ─── 'didit' ──► DiditService
       │                                       implements KYCProvider
       └─────────────── 'didit' ────────────► DiditService
                                               implements KYCProvider
```

### KYCProvider Interface

```typescript
interface KYCProvider {
  readonly providerName: KYCProviderName;
  submitVerification(params: KYCSubmissionParams): Promise<KYCSubmissionResult>;
  parseWebhookPayload(rawPayload: string): KYCVerificationResult;
  verifyWebhookSignature(signature: string, payload: string, timestamp?: string): boolean;
  determineDecision(result: KYCVerificationResult): KYCDecision;
}
```

### Normalized Score Scales

| Field | DIDIT Raw | Didit Raw | Normalized (Both) |
|-------|-------------------|-----------|-------------------|
| `face_match_score` | 0-1 float | 0-100 int | 0-100 int |
| `liveness_score` | 0-1 float | 0-100 int | 0-100 int |
| `confidence_score` | 0-1 float | 0-100 int | 0-100 int |

---

## Files Modified/Created

### New Files
| File | Purpose |
|------|---------|
| `services/kyc-service/src/kyc-provider-factory.ts` | Provider factory with env var switch |
| `database/migrations/023_kyc_provider_columns.sql` | Add provider-agnostic columns |
| `database/migrations/024_whatsapp_sessions_align.sql` | Align session table columns |
| `tests/unit/didit-service.test.ts` | 40 unit tests for DiditService |

### Modified Files
| File | Change |
|------|--------|
| `services/kyc-service/src/index.ts` | Use factory; add WhatsApp notification |
| `services/kyc-service/src/didit-service.ts` | Implements `KYCProvider` interface |
| `services/kyc-service/src/didit-service.ts` | Add `synchronous_result` support |
| `services/kyc-service/package.json` | Add `form-data` dependency |
| `services/shared/types/kyc-provider.ts` | Add `synchronous_result` field |
| `services/shared/types/index.ts` | Export KYC provider types |
| `services/scoring-service/src/index.ts` | Normalize to 0-100 scale |
| `frontend/admin-portal/src/types/index.ts` | Add provider fields |
| `frontend/admin-portal/src/components/kyc-review/KYCReviewCard.tsx` | Provider-agnostic display |
| `infrastructure/aws/secrets-manager.yaml` | Add `DiditSecret` |
| `.env.example` | Add Didit variables |
| `services/shared/utils/secrets.ts` | Add `getDiditSecrets()` |
| `template.yaml` | Add Didit SAM parameters + KYC env vars |
| `.github/workflows/deploy.yml` | Add Didit/Meta params to deploy |
| `tests/contract/kyc-service.contract.test.ts` | Update for provider factory |
| `tests/e2e/e2e-001-complete-onboarding.test.ts` | Update mocks |
| `tests/e2e/e2e-005-non-zimbabwe-rejection.test.ts` | Update mocks |

---

## Database Migration 023

```sql
ALTER TABLE kyc_submissions
  ADD COLUMN kyc_provider VARCHAR(50) DEFAULT 'didit',
  ADD COLUMN provider_job_id VARCHAR(200),
  ADD COLUMN provider_response JSONB;

CREATE INDEX idx_kyc_submissions_provider ON kyc_submissions(kyc_provider);

-- Backfill existing rows
UPDATE kyc_submissions SET kyc_provider = 'didit' WHERE kyc_provider IS NULL;
```

---

## Remaining Steps to Go Live

### 1. Didit Account Setup
- [ ] Create Didit account at https://didit.com
- [ ] Obtain sandbox API key and webhook secret
- [ ] Set GitHub secrets:
  ```bash
  gh secret set STAGING_DIDIT_API_KEY --body "<key>"
  gh secret set STAGING_DIDIT_WEBHOOK_SECRET --body "<secret>"
  gh secret set PRODUCTION_DIDIT_API_KEY --body "<key>"
  gh secret set PRODUCTION_DIDIT_WEBHOOK_SECRET --body "<secret>"
  ```

### 2. Didit Webhook Configuration
- [ ] Set callback URL: `https://{api-gateway-url}/Prod/kyc/callback`
- [ ] Enable webhook events: verification.completed, verification.failed

### 3. Database Migration
- [ ] Run migration 023 against production RDS
- [ ] Run migration 024 against production RDS

### 4. Staging Validation
- [ ] Submit test KYC via Didit sandbox
- [ ] Verify webhook callback received and processed
- [ ] Verify WhatsApp notification sent on KYC result
- [ ] Verify admin portal displays Didit results correctly

### 5. Production Rollout
- [ ] Deploy with `KYC_PROVIDER=didit` to production
- [ ] Monitor first 10 verifications
- [ ] Compare Didit vs DIDIT results if running both

---

## Rollback Plan

To revert to DIDIT only:
```bash
gh secret set STAGING_KYC_PROVIDER --body "didit"
gh secret set PRODUCTION_KYC_PROVIDER --body "didit"
# Re-deploy (no code change needed)
gh workflow run deploy.yml --field environment=production
```

The `KYCProvider` interface ensures both providers produce identical output shapes. No downstream code (scoring, frontend, notifications) needs to change when switching providers.

---

## Test Results

```
tests/unit/didit-service.test.ts        40 passed (submitVerification: 6, parseCombinedResult: 11, determineDecision: 9, verifyWebhookSignature: 6, handleError: 8)
tests/contract/kyc-service.contract.test.ts  29 passed (initiate: 7, callback: 6, status: 4, provider factory: 5, error handling: 7)
tests/e2e/e2e-001-complete-onboarding.test.ts  36 passed (includes KYC callback flow)
tests/e2e/e2e-005-non-zimbabwe-rejection.test.ts  29 passed (includes rejection callback)

Total: 896/896 tests pass across all 33 test suites
```
