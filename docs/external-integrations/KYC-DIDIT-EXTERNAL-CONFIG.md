# KYC (Didit) - External Configuration Tasks

**Date**: 2026-02-17
**Status**: Completed
**Completed**: 2026-02-18
**Prerequisite**: All code deployed to production, database migrations applied

---

## Overview

The Didit KYC integration code is fully deployed. These are the remaining external configuration steps needed to enable live identity verification for customers.

**Architecture note**: The Didit integration uses **standalone APIs** (server-to-server), not session-based workflows. All three API calls (ID Verification, Passive Liveness, Face Match) return results **synchronously**, so no dashboard-level webhook configuration is required.

---

## Task 1: Obtain Didit API Credentials

**Status**: Completed 2026-02-18

**Where**: Didit Dashboard (`dashboard.didit.me` or your Didit portal)

- [x] Log into your Didit account (create one if not yet done)
- [x] Navigate to Project Settings → API Keys
- [x] Copy the **API Key**
- [x] Navigate to Project Settings → Webhooks
- [x] Copy or generate a **Webhook Signing Secret**

**Output needed**:
| Credential | Description |
|---|---|
| `DIDIT_API_KEY` | Your project's API key for authentication |
| `DIDIT_WEBHOOK_SECRET` | Secret used to verify webhook signatures |

---

## Task 2: Set GitHub Secrets

**Status**: Completed 2026-02-18

**Where**: Terminal with `gh` CLI authenticated, or GitHub repo → Settings → Secrets

Run these commands with your real credentials:

```bash
# Staging
gh secret set STAGING_DIDIT_API_KEY --body "<your-didit-api-key>"
gh secret set STAGING_DIDIT_WEBHOOK_SECRET --body "<your-didit-webhook-secret>"

# Production
gh secret set PRODUCTION_DIDIT_API_KEY --body "<your-didit-api-key>"
gh secret set PRODUCTION_DIDIT_WEBHOOK_SECRET --body "<your-didit-webhook-secret>"
```

**Verification**: Run `gh secret list` and confirm all four secrets appear.

**Result**: All 4 secrets confirmed set via `gh secret list`.

---

## Task 3: Configure Didit Webhook

**Status**: Not Required

**Reason**: The Didit integration uses standalone APIs (`/v3/id-verification/`, `/v3/passive-liveness/`, `/v3/face-match/`) which return results synchronously. No dashboard-level webhook configuration is needed.

The `/kyc/callback` endpoint exists in the codebase for future session-based workflow support, but the current `DiditService` does not use it. If the architecture is later changed to use Didit's session-based workflows (via `POST /v3/session/`), the callback URL would be passed per-session in the API request body, not configured in the dashboard.

**Original instructions (retained for reference)**:

| Field | Value |
|---|---|
| **Webhook URL** | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/kyc/callback` |
| **Signing Secret** | Same value as `PRODUCTION_DIDIT_WEBHOOK_SECRET` |
| **Events** | Subscribe to all KYC events: `verification.completed`, `verification.failed`, `verification.manual_review` |

---

## Task 4: Configure Didit Verification Settings

**Status**: Not Required

**Reason**: Dashboard verification settings apply to session-based workflows only. The standalone APIs used by `DiditService` accept parameters per-request (e.g., `perform_document_liveness: true`). No dashboard configuration is needed.

**Original recommended settings (retained for reference)**:

| Setting | Value | Reason |
|---|---|---|
| **ID Document Types** | National ID, Passport | Zimbabwe National IDs are primary |
| **Liveness Check** | Enabled | Prevents photo-of-photo fraud |
| **Face Match** | Enabled | Matches selfie to ID photo |
| **Country Restrictions** | Zimbabwe (ZW) | Primary market |
| **Manual Review Threshold** | 70-80% confidence | Below this goes to manual review |
| **Auto-Reject Threshold** | Below 40% confidence | Clear failures auto-reject |

---

## Task 5: Re-deploy with Credentials

**Status**: Completed 2026-02-18

After setting all secrets (Task 2), triggered a production deploy:

```bash
gh workflow run deploy.yml --field environment=production
```

**Deploy result**: GitHub Actions run `22106444318` — completed successfully.

**Verification**:
```bash
aws lambda get-function-configuration \
  --function-name production-lynia-kyc-service \
  --query 'Environment.Variables.{DIDIT_API_KEY: DIDIT_API_KEY, DIDIT_WEBHOOK_SECRET: DIDIT_WEBHOOK_SECRET, KYC_PROVIDER: KYC_PROVIDER}' \
  --output json
```

**Result**:
| Environment Variable | Status |
|---|---|
| `DIDIT_API_KEY` | Set on Lambda |
| `DIDIT_WEBHOOK_SECRET` | Set on Lambda |
| `KYC_PROVIDER` | `didit` |

---

## Task 6: Test KYC Flow

**Status**: Completed 2026-02-18

### 6a. Didit API Key Validation
```bash
curl -s -X GET "https://verification.didit.me/v3/sessions/" \
  -H "x-api-key: <DIDIT_API_KEY>" \
  -H "Content-Type: application/json"
```

**Result**: `200 OK` — API key is valid and authenticated.

### 6b. Lambda Direct Invocation
Invoked `production-lynia-kyc-service` directly via AWS CLI (bypasses API Gateway Cognito auth):

| Test | Result |
|---|---|
| Invalid ID format (`63-1234567A89`) | `400` — correctly rejected with format error |
| Valid ID format + dummy images | `500` — expected (dummy base64 is not a valid image) |
| DiditService initialization | Successful — Lambda loaded, read env vars, validated input |

### 6c. API Gateway Endpoint
```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/kyc/initiate \
  -X POST -H "Content-Type: application/json" -d '{}'
```

**Result**: `401` — Cognito authorizer is active and protecting the endpoint.

### 6d. Full WhatsApp Flow Test
- [ ] Pending: Submit real ID documents via WhatsApp onboarding flow
- [ ] Pending: Verify end-to-end KYC processing with real images

---

## Current Provider Configuration

The system uses a dual-provider architecture:

| Environment Variable | Current Value | Effect |
|---|---|---|
| `KYC_PROVIDER` | `didit` | Didit is the active KYC provider |
| Fallback | `smile_identity` | Change env var to switch providers |

**Rollback procedure**: If Didit has issues, change `KYC_PROVIDER` to `smile_identity` in GitHub secrets and re-deploy:
```bash
gh secret set PRODUCTION_KYC_PROVIDER --body "smile_identity"
gh workflow run deploy.yml --field environment=production
```

---

## Architecture Reference

```
Customer submits KYC via WhatsApp
         |
         v
WhatsApp Lambda downloads media (2-step Cloud API)
         |
         v
POST /kyc/initiate
         |
         v
createKYCProvider() → reads KYC_PROVIDER env var
         |
    ┌────┴────┐
    | didit   | smile_identity
    v         v
DiditService  SmileIdentityService
    |         |
    v         v
Three standalone    Smile API
API calls:          (async webhook)
 - /v3/id-verification/
 - /v3/passive-liveness/
 - /v3/face-match/
    |         |
    v         v
Synchronous   Webhook callback
results       → POST /kyc/callback
    |         |
    v         v
processKYCResult() + determineDecision()
         |
         v
Update kyc_submissions table
         |
         v
sendKYCResultNotification() → WhatsApp message to customer
```

---

## Secrets Checklist

| Secret | Status |
|---|---|
| `STAGING_KYC_PROVIDER` | Set (didit) |
| `PRODUCTION_KYC_PROVIDER` | Set (didit) |
| `STAGING_DIDIT_API_KEY` | Set (2026-02-18) |
| `STAGING_DIDIT_WEBHOOK_SECRET` | Set (2026-02-18) |
| `PRODUCTION_DIDIT_API_KEY` | Set (2026-02-18) |
| `PRODUCTION_DIDIT_WEBHOOK_SECRET` | Set (2026-02-18) |
| `STAGING_SMILE_API_KEY` | Set (fallback provider) |
| `STAGING_SMILE_PARTNER_ID` | Set (fallback provider) |
