# WhatsApp Business Number Verification Runbook

**Purpose**: Confirm that the production WhatsApp webhook is bound to the
Lynia WhatsApp Business number (**+263 71 925 2094**), so that clicks from
the live landing-page WhatsApp button reach the bot / back-end automation.

**When to run**:
- After migrating from the Meta-issued test number to the business number
- Before any launch where customer traffic is expected
- As part of the quarterly production integration audit
- Any time the landing-page `WHATSAPP_URL` constant is changed

**Estimated duration**: 10-15 minutes

---

## Background

The landing page has a single click target that owns all WhatsApp CTAs:

```
landing-page/frontend/lib/constants.ts
  -> WHATSAPP_URL = https://wa.me/263719252094?text=...
```

All three on-site entry points (global `WhatsAppFAB`, the `/contact`
page, and `SOCIAL_LINKS.whatsapp`) resolve to this constant. When a
client taps the button, three things have to be true for the automated
bot flow to work end-to-end:

1. **Code side (in repo)** - `WHATSAPP_URL` points at the correct
   E.164-without-`+` number
2. **Meta side (external)** - Phone Number ID `1008788982315015` inside
   our WABA is registered to **+263 71 925 2094**, not the old test number
3. **Webhook side (AWS)** - Meta's webhook subscription for that phone
   number ID points at our API Gateway endpoint and the Lambda is healthy

Steps 1 and 3 are covered by other automation. This runbook covers
**step 2** - the piece that lives inside Meta's dashboard and cannot
be verified from code alone.

---

## Prerequisites

- Meta Business Suite access with the `Lynia Finance` business account
- Admin role on the Meta App (App ID `919783197240242`)
- Access to WhatsApp Business Account ID `1589372019465976`
- A test device with WhatsApp installed (personal number is fine)
- AWS CLI configured with read access to the `us-east-1` account

---

## Step 1 - Verify the number in Meta Business Manager

1. Open <https://business.facebook.com/wa/manage/phone-numbers>
2. Select the **Lynia Finance** WhatsApp Business Account
   (WABA ID `1589372019465976`)
3. Confirm that exactly one phone number is listed with:

   | Field | Expected value |
   |---|---|
   | Display name | `Lynia Finance` |
   | Phone number | `+263 71 925 2094` |
   | Phone Number ID | `1008788982315015` |
   | Quality rating | `GREEN` (High) |
   | Status | `Connected` |
   | Messaging limit | Tier 1K or higher |

4. If the display number still shows `+1 555 191 0708` (the old test
   number), **stop here** and go to [Step 6 - Migration](#step-6---migration-from-test-number-if-still-needed).

---

## Step 2 - Cross-check Phone Number ID via the Graph API

From any machine with `curl`:

```bash
# Use the production permanent token (AWS Secrets Manager: lynia/production/whatsapp)
export WA_TOKEN="$(aws secretsmanager get-secret-value \
  --secret-id lynia/production/whatsapp \
  --query SecretString --output text | jq -r .accessToken)"

curl -sS "https://graph.facebook.com/v20.0/1008788982315015?fields=display_phone_number,verified_name,quality_rating,code_verification_status" \
  -H "Authorization: Bearer ${WA_TOKEN}" | jq
```

**Expected response**:

```json
{
  "display_phone_number": "+263 71 925 2094",
  "verified_name": "Lynia Finance",
  "quality_rating": "GREEN",
  "code_verification_status": "VERIFIED",
  "id": "1008788982315015"
}
```

If `display_phone_number` is anything other than `+263 71 925 2094`,
the code-side change is inert - clients will land on the wrong chat.

---

## Step 3 - Verify the webhook subscription

```bash
curl -sS "https://graph.facebook.com/v20.0/1589372019465976/subscribed_apps" \
  -H "Authorization: Bearer ${WA_TOKEN}" | jq
```

**Expected**: one subscribed app matching our Meta App ID
`919783197240242`, subscribed to at least the `messages` and
`message_status` fields.

Then confirm the callback URL on the app side:

```bash
curl -sS "https://graph.facebook.com/v20.0/919783197240242/subscriptions?access_token=${WA_TOKEN}" | jq
```

The WhatsApp object must include:

```json
{
  "object": "whatsapp_business_account",
  "callback_url": "https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/whatsapp/webhook",
  "fields": ["messages", "message_status", "message_template_status_update"],
  "active": true
}
```

If `callback_url` or `active` is wrong, fix it in **Meta App dashboard ->
WhatsApp -> Configuration -> Webhook** before continuing.

---

## Step 4 - Send a real message end-to-end

This is the only step that catches "Meta dashboard looks right, but
webhook is silently broken" failures.

1. On your test device, open this link (it is the exact URL the landing
   page button uses):

   <https://wa.me/263719252094?text=Hi%20Lynia%20Finance%2C%20I%27d%20like%20to%20enquire%20about%20a%20loan.>

2. Confirm WhatsApp opens a chat titled **Lynia Finance** with the
   enquiry text pre-filled. Tap **Send**.

3. Within 5 seconds, you should receive the onboarding machine's first
   reply (the `MAIN_MENU` or `NEW_CUSTOMER_WELCOME` state message).
   Screenshot it for the audit trail.

4. Tail the production logs while sending the message:

   ```bash
   aws logs tail /aws/lambda/production-lynia-whatsapp-service \
     --since 2m --follow --region us-east-1
   ```

   You should see, in order:

   - `action=webhook.received` with a non-zero message count
   - `action=webhook.signature.verified` (HMAC check passed)
   - `action=onboarding.state.entered` with a `state` field
   - `action=whatsapp.outbound` with `status=sent`

5. If any of those log lines are missing, proceed to
   [Troubleshooting](#troubleshooting).

---

## Step 5 - Smoke-test the landing page click

1. Open the live site: <https://d1qwfy2tsdmpe4.cloudfront.net>
2. Wait for the page to fully load, then click the green WhatsApp FAB
   in the bottom-right corner
3. Confirm the browser opens `wa.me/263719252094` (check the URL bar
   or the tab title) and that the WhatsApp install prompt / chat shows
   **Lynia Finance** as the recipient
4. Repeat on `/contact` - click the "WhatsApp - Chat with us" card and
   verify the same destination

If either click resolves to a different number, the deployed build is
stale. Re-run the landing-page deploy workflow:

```bash
aws s3 sync landing-page/frontend/out/ \
  s3://production-lynia-landing-page/ --delete
aws cloudfront create-invalidation \
  --distribution-id <LandingPageDistributionId> --paths "/*"
```

---

## Step 6 - Migration from test number (if still needed)

Only run this section if Step 1 shows the old test number
`+1 555 191 0708`.

> **Caution**: Migrating a phone number to a new WABA is reversible
> but causes ~30 seconds of webhook downtime. Schedule it outside
> business hours and announce it in `#lynia-ops`.

1. **In Meta Business Manager -> WhatsApp Accounts -> Phone Numbers**,
   click **Add phone number**
2. Enter `+263 71 925 2094` and select **SMS** or **Voice** verification
3. Complete the 6-digit OTP challenge on the physical SIM
4. Set the display name to `Lynia Finance` - this requires display name
   review, which usually completes in under 2 hours
5. Once approved, go to **Phone Numbers -> +263 71 925 2094 -> Settings**
   and **mark as primary**
6. **Delete** (or detach) the old `+1 555 191 0708` test number from the
   same WABA - otherwise both numbers will compete for the same
   Phone Number ID
7. **Critical**: verify the new number inherits Phone Number ID
   `1008788982315015`. If Meta issues a new ID, update both:
   - `PRODUCTION_WHATSAPP_PHONE_ID` GitHub secret
   - `lynia/production/whatsapp` Secrets Manager entry (if it stores
     the ID separately)
   - `docs/external-integrations/WHATSAPP-EXTERNAL-CONFIG-REPORT.md`
     line 84
   - Redeploy `whatsapp-service` so the new ID is picked up
8. Re-subscribe the webhook: **Meta App dashboard -> WhatsApp ->
   Configuration -> Webhook -> Manage -> messages** (toggle off, then
   back on to force a re-subscribe)
9. Re-run Steps 2 through 5 of this runbook to confirm the new number
   is live

---

## Step 7 - Automated operator verification (recommended)

Rather than running Steps 2-5 manually, use the operator script which
calls both the Graph API and the Lambda deep health endpoint in one pass:

```bash
# Default: production environment, expected number +263 71 925 2094
bash scripts/verify-whatsapp-connection.sh

# Staging
ENVIRONMENT=staging bash scripts/verify-whatsapp-connection.sh

# Override if you already have credentials in the shell
WA_TOKEN="$MY_TOKEN" PHONE_NUMBER_ID="1008788982315015" \
  bash scripts/verify-whatsapp-connection.sh

# Skip the live Lambda call (Graph API only)
SKIP_LIVE_CALL=1 bash scripts/verify-whatsapp-connection.sh
```

The script exits `0` only when **all** of the following are true:

1. `display_phone_number` matches the expected business number (`+263 71 925 2094`)
2. `quality_rating` is `GREEN`
3. `code_verification_status` is `VERIFIED`
4. Lambda `/whatsapp/health?deep=true` returns `connection.connected = true`

**Exit codes**: `0` = all pass · `1` = Graph API mismatch · `2` = Lambda health failure · `3` = AWS/dependency error

---

## Step 8 - Lambda deep health check endpoint

The deployed Lambda exposes a self-verification endpoint that calls the
same Graph API checks from inside AWS:

```bash
# Resolve the API base URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name lynia-finance-prod \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" \
  --output text)

curl -sS "${API_URL}whatsapp/health?deep=true" | jq
```

**Healthy response** (`HTTP 200`):

```json
{
  "status": "ok",
  "service": "whatsapp-service",
  "timestamp": "2026-04-15T10:00:00.000Z",
  "connection": {
    "connected": true,
    "phoneNumberId": "1008788982315015",
    "displayPhoneNumber": "+263 71 925 2094",
    "verifiedName": "Lynia Finance",
    "qualityRating": "GREEN",
    "codeVerificationStatus": "VERIFIED",
    "expectedDisplayNumber": "+263 71 925 2094",
    "matchesExpected": true,
    "error": null
  }
}
```

**Unhealthy response** (`HTTP 503`):

```json
{
  "status": "degraded",
  "service": "whatsapp-service",
  "connection": {
    "connected": false,
    "error": "display_phone_number mismatch: ..."
  }
}
```

**How `matchesExpected` is set**: the Lambda reads the
`WHATSAPP_EXPECTED_DISPLAY_NUMBER` environment variable (wired from the
`WhatsAppExpectedDisplayNumber` CloudFormation parameter). In
production, this is hardcoded to `+263 71 925 2094` in the deploy
workflow so the self-assertion is always active.

| `matchesExpected` value | Meaning |
|---|---|
| `true` | Meta agrees: this Phone Number ID resolves to `+263 71 925 2094` |
| `false` | **Mismatch** — wrong number registered on Meta side |
| `null` | Env var not set — no assertion made (staging with no override) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `wa.me/263719252094` opens "This chat isn't available" | Number not registered with Meta, or suspended | Step 1 - re-verify in Meta Business Manager |
| Message sends but no bot reply within 30s | Webhook subscription broken | Step 3 - re-subscribe `messages` field in Meta App dashboard |
| Logs show `webhook.received` but no `signature.verified` | `META_APP_SECRET` drifted | Rotate and re-deploy `whatsapp-service` with the new secret from Meta App -> Settings -> Basic |
| Logs show `signature.verified` but no `onboarding.state.entered` | State machine crash | Check CloudWatch alarms for `production-lynia-whatsapp-service`; investigate most recent error-level log |
| Bot replies, but in the wrong language | `locale` field missing from inbound message | Expected for international test numbers; not a production blocker |
| Landing page click opens the wrong number | Stale CloudFront cache | Step 5 - invalidate `/*` on the LandingPage distribution |
| `display_phone_number` reports a different number | Meta still has the old phone registered under that Phone Number ID | Step 6 - migration |

---

## Sign-off Checklist

Mark every box before declaring the business number live:

```
[ ] Step 1: Meta Business Manager shows +263 71 925 2094 under WABA 1589372019465976
[ ] Step 2: Graph API returns display_phone_number = "+263 71 925 2094"
[ ] Step 3: Webhook subscription active and callback URL matches production API Gateway
[ ] Step 4: Test message from a personal device receives an automated bot reply within 5s
[ ] Step 4: CloudWatch logs show webhook.received -> signature.verified -> onboarding.state.entered -> whatsapp.outbound
[ ] Step 5: Landing page FAB and /contact page both route to wa.me/263719252094
[ ] Step 7/8: `bash scripts/verify-whatsapp-connection.sh` exits 0 (all checks green)
[ ] Step 8: GET /whatsapp/health?deep=true returns HTTP 200 with connected=true and matchesExpected=true
[ ] Screenshots captured and attached to the verification ticket
[ ] Old test number (+1 555 191 0708) detached or deleted from production WABA
```

Record the run in `docs/external-integrations/WHATSAPP-EXTERNAL-CONFIG-REPORT.md`
with date, operator, and any deviations.

---

## Related Documents

- `docs/external-integrations/WHATSAPP-EXTERNAL-CONFIG-REPORT.md` - production WABA configuration
- `docs/guides/WHATSAPP-CLOUD-API-SETUP.md` - initial setup guide
- `docs/ON-CALL-RUNBOOK.md` - general incident response
- `landing-page/frontend/lib/constants.ts` - single source of truth for the WhatsApp link
- `services/whatsapp-service/README.md` - bot state machine and webhook handler
- `services/whatsapp-service/src/connection-check.ts` - Lambda-side Graph API verifier
- `scripts/verify-whatsapp-connection.sh` - operator CLI (combines Graph API + Lambda health check)
