# KYC (Didit) - External Configuration Tasks

**Date**: 2026-02-17
**Status**: Pending External Configuration
**Prerequisite**: All code deployed to production, database migrations applied

---

## Overview

The Didit KYC integration code is fully deployed. These are the remaining external configuration steps needed to enable live identity verification for customers.

---

## Task 1: Obtain Didit API Credentials

**Where**: Didit Dashboard (`dashboard.didit.me` or your Didit portal)

- [ ] Log into your Didit account (create one if not yet done)
- [ ] Navigate to Project Settings → API Keys
- [ ] Copy the **API Key**
- [ ] Navigate to Project Settings → Webhooks
- [ ] Copy or generate a **Webhook Signing Secret**

**Output needed**:
| Credential | Description |
|---|---|
| `DIDIT_API_KEY` | Your project's API key for authentication |
| `DIDIT_WEBHOOK_SECRET` | Secret used to verify webhook signatures |

---

## Task 2: Set GitHub Secrets

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

---

## Task 3: Configure Didit Webhook

**Where**: Didit Dashboard → Project Settings → Webhooks

1. Click **Add Webhook** (or Edit existing)
2. Set the following:

| Field | Value |
|---|---|
| **Webhook URL** | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/kyc/callback` |
| **Signing Secret** | Same value as `PRODUCTION_DIDIT_WEBHOOK_SECRET` |
| **Events** | Subscribe to all KYC events: `verification.completed`, `verification.failed`, `verification.manual_review` |

3. Save the webhook configuration
4. Click **Send Test Webhook** to verify connectivity

**Expected result**: Your Lambda receives the test payload and returns HTTP 200.

**Troubleshooting**:
- If test fails with timeout: Verify the API Gateway URL is correct
- If test fails with 500: Check CloudWatch logs for `KYCFunction` in `us-east-1`
- If signature validation fails: Ensure the webhook secret matches exactly (case-sensitive)

---

## Task 4: Configure Didit Verification Settings

**Where**: Didit Dashboard → Project Settings → Verification

Recommended settings for Zimbabwe market:

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

After setting all secrets (Tasks 2-3), trigger a production deploy:

```bash
gh workflow run deploy.yml --field environment=production
```

**Verification**:
```bash
# Watch the deploy
gh run list --workflow=deploy.yml -L 3

# Check Lambda has the env vars
aws lambda get-function-configuration \
  --function-name lynia-finance-prod-KYCFunction \
  --query 'Environment.Variables.DIDIT_API_KEY' \
  --output text
# Should NOT return "None" or empty
```

---

## Task 6: Test KYC Flow

### 6a. Direct API Test
```bash
# Test KYC initiation (requires valid Cognito token)
curl -X POST https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/kyc/initiate \
  -H "Authorization: Bearer <cognito-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "test-customer-001",
    "id_type": "national_id",
    "id_number": "63-123456A78",
    "id_photo": "<base64-encoded-id-photo>",
    "selfie": "<base64-encoded-selfie>"
  }'
```

### 6b. Webhook Callback Test
- Submit a real ID verification through the API
- Wait for Didit to process (typically 30-60 seconds)
- Verify the callback hits `/kyc/callback`
- Check the `kyc_submissions` table for updated status:
  ```sql
  SELECT id, customer_id, kyc_provider, verification_status, verification_decision
  FROM kyc_submissions
  ORDER BY created_at DESC LIMIT 5;
  ```

### 6c. Full WhatsApp Flow Test
- Send a WhatsApp message and go through onboarding to the KYC step
- Submit ID number, ID photo, and selfie via WhatsApp
- Verify Didit receives the images and processes them
- Verify the customer receives a WhatsApp notification with the KYC result

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
Didit API     Smile API
    |         |
    v         v
Webhook callback → POST /kyc/callback
         |
         v
parseWebhookPayload() + determineDecision()
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
| `STAGING_DIDIT_API_KEY` | **NOT SET - Action Required** |
| `STAGING_DIDIT_WEBHOOK_SECRET` | **NOT SET - Action Required** |
| `PRODUCTION_DIDIT_API_KEY` | **NOT SET - Action Required** |
| `PRODUCTION_DIDIT_WEBHOOK_SECRET` | **NOT SET - Action Required** |
| `STAGING_SMILE_API_KEY` | Set (fallback provider) |
| `STAGING_SMILE_PARTNER_ID` | Set (fallback provider) |
