# Task C2: KYC Result Notification via WhatsApp

> **Track:** C - Integration (WhatsApp + KYC + Fineract)
> **Status:** Not Started
> **Priority:** High
> **Depends On:** C1 (KYC wired into onboarding), B4 (KYC templates approved)
> **Estimated Effort:** Medium

---

## Objective

When KYC verification completes (via Didit webhook callback), send a WhatsApp notification to the customer and resume the onboarding flow. Uses template messages to handle the 24-hour window constraint.

## Current Code (TODO to implement)

```typescript
// services/kyc-service/src/index.ts - handleKYCCallback()
// TODO: Send notification to customer via WhatsApp
```

## Tasks

### C2.1: Send WhatsApp Notification on KYC Approval
- **File:** `services/kyc-service/src/index.ts`
- **Action:** After KYC callback determines APPROVED:
  ```typescript
  // Send WhatsApp template (24h-window safe)
  await axios.post(`${WHATSAPP_API_URL}/whatsapp/send`, {
    to: customer.whatsapp_number,
    type: 'template',
    template: {
      name: 'kyc_approved',
      params: [customer.first_name || customer.full_name],
    },
  });

  // Resume onboarding flow
  await resumeOnboardingAfterKYC(customer.whatsapp_number, true);
  ```

### C2.2: Send WhatsApp Notification on KYC Rejection
- **File:** `services/kyc-service/src/index.ts`
- **Action:** After KYC callback determines REJECTED:
  ```typescript
  const rejectionReason = mapRejectionReason(decision.reason);
  await axios.post(`${WHATSAPP_API_URL}/whatsapp/send`, {
    to: customer.whatsapp_number,
    type: 'template',
    template: {
      name: 'kyc_rejected',
      params: [customer.first_name, rejectionReason],
    },
  });

  // Reset onboarding for retry (if attempts < 3)
  await resumeOnboardingAfterKYC(customer.whatsapp_number, false, rejectionReason);
  ```

### C2.3: Send WhatsApp Notification on Manual Review
- **File:** `services/kyc-service/src/index.ts`
- **Action:** After KYC callback determines MANUAL_REVIEW:
  ```typescript
  await axios.post(`${WHATSAPP_API_URL}/whatsapp/send`, {
    to: customer.whatsapp_number,
    type: 'template',
    template: {
      name: 'kyc_in_review',
      params: [customer.first_name],
    },
  });
  // Don't resume onboarding - wait for manual decision
  ```

### C2.4: Add WHATSAPP_API_URL to KYC Lambda
- **File:** `template.yaml`
- **Action:** Add environment variable to `KYCFunction`:
  ```yaml
  WHATSAPP_API_URL: !Sub "https://${LyniaApi}.execute-api.${AWS::Region}.amazonaws.com/Prod"
  ```

### C2.5: Map Rejection Reasons to User-Friendly Messages
- **File:** `services/kyc-service/src/index.ts`
- **Action:** Create mapping function:
  ```typescript
  function mapRejectionReason(reason: string): string {
    const reasons: Record<string, string> = {
      'LOW_CONFIDENCE': 'Photo quality was too low. Please take a clearer photo.',
      'LIVENESS_FAILED': 'We could not confirm your selfie is live. Please try again in good lighting.',
      'DOCUMENT_TAMPERED': 'Your ID document could not be verified. Please use your original document.',
      'DOCUMENT_EXPIRED': 'Your ID document has expired. Please use a valid document.',
      'FACE_MISMATCH': 'Your selfie did not match your ID photo. Please try again.',
    };
    return reasons[reason] || 'Please try again or visit our office for assistance.';
  }
  ```

### C2.6: Handle Manual Review Completion
- **File:** `services/kyc-service/src/index.ts` (or admin action handler)
- **Action:** When admin approves/rejects a manual review:
  1. Send WhatsApp notification with result
  2. Resume onboarding flow (approve → credit scoring, reject → retry)

## Acceptance Criteria

- [ ] KYC approval triggers WhatsApp template notification
- [ ] KYC rejection triggers WhatsApp template with user-friendly reason
- [ ] Manual review triggers "in review" notification
- [ ] Template messages used (not session messages) for 24h window safety
- [ ] Onboarding flow resumes correctly after KYC approval
- [ ] Onboarding resets to KYC upload on rejection (if retries < 3)
- [ ] Rejection reasons are user-friendly (no technical jargon)
- [ ] Error handling if WhatsApp send fails (log error, don't block callback)
- [ ] Manual review completion notifies customer

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `services/kyc-service/src/index.ts` | Add WhatsApp notifications in callback handler |
| `template.yaml` | Add WHATSAPP_API_URL to KYCFunction |
