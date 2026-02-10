# KYC Integration Plan - Smile Identity

> Identity verification for Zimbabwe national ID using Smile Identity Enhanced KYC

## Provider Overview

| Detail | Value |
|--------|-------|
| **Provider** | Smile Identity |
| **Product** | Enhanced KYC (Job Type 5) |
| **Country** | Zimbabwe (ZW) |
| **ID Type** | National ID (format: XX-XXXXXXAXX) |
| **Sandbox URL** | `https://testapi.smileidentity.com` |
| **Production URL** | `https://api.smileidentity.com` |
| **Current Status** | Code written, API credentials not obtained |

---

## Integration Phases

### Phase 1: Stub Mode (Current)

**Manual KYC verification via admin dashboard.**

- Customer submits: National ID (front/back photos) + selfie
- Documents stored in Supabase Storage (encrypted)
- Admin reviews documents manually in KYC Review Queue
- Admin assigns confidence score (0-100) and decision
- Decision thresholds match Smile Identity's:
  - >= 85%: Approved
  - 50-84%: Requires senior review
  - < 50%: Rejected

**Existing code location:** `services/kyc-service/src/smile-identity-service.ts`

### Phase 2: Sandbox Testing

**Prerequisites:**
- [ ] Smile Identity partner account created
- [ ] Partner ID and API Key obtained
- [ ] Sandbox callback URL configured (Lambda endpoint)
- [ ] Test national ID numbers provided by Smile Identity

**Tasks:**
1. Configure sandbox credentials in AWS Secrets Manager
2. Switch `kyc-provider-mode` feature flag to `sandbox`
3. Submit test verifications using Smile Identity test IDs
4. Validate webhook callback handling
5. Verify decision logic matches expected outcomes
6. Test all 7 error codes and confirm error handling
7. Test manual review escalation flow
8. Run contract tests against sandbox API

**Contract test scenarios:**

```
SCENARIO: Valid Zimbabwe national ID
  GIVEN a valid national ID and clear selfie
  WHEN Enhanced KYC (Job Type 5) is submitted
  THEN result_code = "1012" (Verified)
  AND confidence >= 85

SCENARIO: ID photo quality too low
  GIVEN a blurry national ID photo
  WHEN Enhanced KYC is submitted
  THEN error_code = "image_quality"
  AND customer is prompted to retake

SCENARIO: Face does not match ID
  GIVEN a selfie that doesn't match the ID photo
  WHEN Enhanced KYC is submitted
  THEN confidence < 50
  AND result = "Not Verified"

SCENARIO: Expired national ID
  GIVEN an expired national ID
  WHEN Enhanced KYC is submitted
  THEN document_check.expiration = "expired"
  AND decision = REJECTED

SCENARIO: Liveness check failure (spoof attempt)
  GIVEN a printed photo instead of live selfie
  WHEN Enhanced KYC is submitted
  THEN liveness.passed = false
  AND decision = REJECTED

SCENARIO: Webhook callback delivery
  GIVEN a submitted verification
  WHEN Smile Identity processes the result
  THEN webhook POST is received at /kyc/callback
  AND HMAC-SHA256 signature is valid
  AND customer status is updated in database
```

### Phase 3: Production Activation

**Prerequisites:**
- [ ] All sandbox contract tests passing
- [ ] Webhook endpoint accessible from Smile Identity servers
- [ ] Production Partner ID and API Key obtained
- [ ] Data processing agreement signed with Smile Identity
- [ ] Customer consent flow implemented (WhatsApp or admin-collected)

**Activation steps:**
1. Store production credentials in AWS Secrets Manager
2. Configure production callback URL
3. Switch `kyc-provider-mode` to `live` for 10% of new submissions
4. Monitor: verification success rate, latency, callback delivery
5. Verify auto-approve/reject/manual-review decisions are correct
6. Increase to 100% after 48 hours of stable operation

---

## API Contract Summary

### Submit Verification Request

```typescript
// POST https://api.smileidentity.com/v1/upload
{
  partner_params: {
    user_id: string,      // Our customer UUID
    job_id: string,       // Our verification UUID
    job_type: 5           // Enhanced KYC
  },
  source_sdk: "rest_api",
  source_sdk_version: "1.0.0",
  country: "ZW",
  id_type: "NATIONAL_ID",
  id_number: string,      // XX-XXXXXXAXX format
  first_name?: string,
  last_name?: string,
  dob?: string,           // YYYY-MM-DD
  phone_number?: string,
  images: [
    { image_type_id: 0, image: "base64..." },  // Selfie
    { image_type_id: 1, image: "base64..." }   // ID Front
  ],
  callback_url: string
}
```

### Webhook Callback Payload

```typescript
{
  ResultCode: "1012",       // Verified
  ResultText: "Verified",
  Actions: {
    Verify_ID_Number: "Verified",
    Return_Personal_Info: "Returned",
    Human_Review_Compare: "Verified",
    Liveness_Check: "Passed",
    Document_Check: "Passed"
  },
  ConfidenceValue: 99.5,
  FullData: {
    full_name: string,
    id_number: string,
    dob: string,
    gender: string,
    address: string,
    nationality: string
  },
  signature: string        // HMAC-SHA256 for verification
}
```

### Decision Logic (Already Implemented)

```
AUTO-APPROVE when ALL of:
  - Result = "Verified"
  - Confidence >= 85%
  - Liveness = Passed
  - Document = Authentic
  - Document not tampered
  - Document not expired

AUTO-REJECT when ANY of:
  - Result = "Not Verified"
  - Confidence < 50%
  - Liveness = Failed
  - Document = Tampered
  - Document = Expired

MANUAL REVIEW when:
  - Confidence between 50-84%
  - (Admin has 24-hour SLA to review)
```

---

## Error Handling

| Error Code | Meaning | User Action |
|-----------|---------|-------------|
| `image_quality` | Photo too blurry/dark | Retake photo in good lighting |
| `id_not_found` | ID number not in registry | Verify ID number is correct |
| `face_not_detected` | No face in selfie | Retake selfie showing full face |
| `multiple_faces` | Multiple faces detected | Take selfie with only you in frame |
| `id_expired` | National ID has expired | Renew ID at registrar's office |
| `rate_limit` | Too many requests | Wait and retry (max 3 attempts) |
| `server_error` | Smile Identity outage | Fall back to manual review |

---

## Data Privacy Considerations

- KYC images stored in Supabase Storage with encryption at rest
- Images deleted after verification decision (retention: 10 years for compliance)
- National ID numbers stored with field-level encryption
- Only masked ID numbers appear in logs (XX-****XXAXX)
- Customer explicit consent required before submission
- Audit trail for every verification attempt

---

## Monitoring & Alerts

```yaml
metrics:
  - kyc_submissions_total
  - kyc_auto_approved_total
  - kyc_auto_rejected_total
  - kyc_manual_review_total
  - kyc_verification_latency_ms
  - kyc_webhook_delivery_success_rate
  - kyc_retry_count

alerts:
  critical:
    - kyc_webhook_delivery_success_rate < 95%
    - kyc_verification_latency_ms p95 > 30000
  warning:
    - kyc_auto_reject_rate > 30%
    - kyc_manual_review_backlog > 10
```
