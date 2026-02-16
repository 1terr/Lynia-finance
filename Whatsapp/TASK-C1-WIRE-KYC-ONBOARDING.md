# Task C1: Wire KYC into WhatsApp Onboarding

> **Track:** C - Integration (WhatsApp + KYC + Fineract)
> **Status:** Not Started
> **Priority:** Critical (replaces hardcoded auto-approve)
> **Depends On:** A1 (KYC handler refactored), B2 (WhatsApp webhook working)
> **Estimated Effort:** Medium

---

## Objective

Replace the hardcoded KYC auto-approve in the WhatsApp onboarding flow with real KYC API calls. Download customer photos from WhatsApp Media API, forward to KYC service, and handle the async processing state.

## Current Code (to replace)

```typescript
// services/whatsapp-service/src/onboarding.ts - handleKYCSelfieUpload()
// SIMULATED - This is where the real KYC provider would be called
const kycResult = { verified: true, confidence: 0.96 };
if (kycResult.verified) {
  // Auto-approves...
}
```

## Tasks

### C1.1: Implement WhatsApp Media Download
- **File:** `services/whatsapp-service/src/onboarding.ts`
- **Action:** Add function to download media from Meta Cloud API:
  ```typescript
  async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
    // Step 1: GET /{media_id} → returns { url: "https://..." }
    // Step 2: GET the URL with auth header → returns binary
    const metaResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
    );
    const imageResponse = await axios.get(metaResponse.data.url, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      responseType: 'arraybuffer',
    });
    return Buffer.from(imageResponse.data);
  }
  ```

### C1.2: Replace Auto-Approve with Real KYC Call
- **File:** `services/whatsapp-service/src/onboarding.ts`
- **Action:** In `handleKYCSelfieUpload()`:
  ```typescript
  // Download images from WhatsApp
  const idImageBuffer = await downloadWhatsAppMedia(session.session_data.id_image_media_id);
  const selfieBuffer = await downloadWhatsAppMedia(session.session_data.selfie_media_id);

  // Submit to KYC service
  const kycResponse = await axios.post(`${KYC_API_URL}/kyc/initiate`, {
    customer_id: session.customer_id,
    id_number: session.session_data.national_id,
    id_document_image: idImageBuffer.toString('base64'),
    selfie_image: selfieBuffer.toString('base64'),
  });

  // Transition to async processing state
  await updateSessionState(phone, 'kyc_processing');
  await sendMessage(phone, t('kyc_processing', lang));
  ```

### C1.3: Add KYC_API_URL Environment Variable
- **File:** `template.yaml`
- **Action:** Add `KYC_API_URL` to WhatsApp Lambda environment:
  ```yaml
  KYC_API_URL: !Sub "https://${LyniaApi}.execute-api.${AWS::Region}.amazonaws.com/Prod"
  ```
- **Note:** This is the API Gateway URL for the KYC service endpoints

### C1.4: Handle `kyc_processing` State
- **File:** `services/whatsapp-service/src/onboarding.ts`
- **Action:** When customer sends a message while in `kyc_processing` state:
  ```typescript
  case 'kyc_processing':
    // Tell customer to wait
    responseMessage = t('kyc_still_processing', lang);
    // Don't change state
    break;
  ```

### C1.5: Handle KYC Callback Resume
- **File:** `services/whatsapp-service/src/onboarding.ts`
- **Action:** Add function that KYC callback can invoke to resume onboarding:
  ```typescript
  export async function resumeOnboardingAfterKYC(
    phone: string,
    kycApproved: boolean,
    rejectionReason?: string
  ): Promise<void> {
    if (kycApproved) {
      await updateSessionState(phone, 'credit_scoring');
      // Trigger credit scoring...
    } else {
      await updateSessionState(phone, 'kyc_id_upload'); // Reset for retry
      // Send rejection notification via template (24h window safe)
    }
  }
  ```

### C1.6: Wire i18n for KYC Messages
- **File:** `services/whatsapp-service/src/i18n.ts`
- **Action:** Verify these translation keys exist and add if missing:
  - `kyc_processing` - "We're verifying your identity..."
  - `kyc_still_processing` - "We're still verifying your identity..."
  - `kyc_approved` - "Your identity has been verified!"
  - `kyc_rejected` - "We couldn't verify your identity..."

## Acceptance Criteria

- [ ] WhatsApp media download works for ID photos and selfies
- [ ] KYC initiate endpoint called with base64 images
- [ ] Session transitions to `kyc_processing` after submission
- [ ] Messages during `kyc_processing` get "please wait" response
- [ ] KYC callback can resume onboarding flow
- [ ] i18n messages used (not hardcoded English)
- [ ] Error handling for media download failures
- [ ] Error handling for KYC submission failures
- [ ] Circuit breaker protects against KYC service outage

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `services/whatsapp-service/src/onboarding.ts` | Replace auto-approve, add media download |
| `services/whatsapp-service/src/i18n.ts` | Add/verify KYC translation keys |
| `template.yaml` | Add KYC_API_URL env var to WhatsApp function |
