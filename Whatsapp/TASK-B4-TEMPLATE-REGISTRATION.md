# Task B4: Message Template Registration

> **Track:** B - WhatsApp Cloud API Integration
> **Status:** Not Started
> **Priority:** High (24-48h Meta approval wait)
> **Depends On:** B2 (Meta Dashboard access)
> **Estimated Effort:** Small (but 24-48h wait for approval)

---

## Objective

Submit all 7 message templates to Meta for approval and map approved template names back to code constants.

## Tasks

### B4.1: Submit Templates to Meta
- **Action:** In Meta Dashboard → WhatsApp → Message Templates → Create Template
- **Submit these 7 templates:**

| # | Template Name | Category | Parameters | Content Source |
|---|---------------|----------|------------|---------------|
| 1 | `loan_application_welcome` | TRANSACTIONAL | 1 (name) | `docs/guides/WHATSAPP-BOT-FLOW.md` |
| 2 | `kyc_verification_request` | TRANSACTIONAL | 1 (name) | `docs/guides/WHATSAPP-BOT-FLOW.md` |
| 3 | `loan_approved` | TRANSACTIONAL | 6 (name, amount, device, months, payment, shop) | `docs/guides/WHATSAPP-BOT-FLOW.md` |
| 4 | `payment_reminder` | TRANSACTIONAL | 6 (name, amount, date, balance, merchant, ref) | `docs/guides/WHATSAPP-BOT-FLOW.md` |
| 5 | `payment_received` | TRANSACTIONAL | 6 (name, amount, ref, date, balance, next due) | `docs/guides/WHATSAPP-BOT-FLOW.md` |
| 6 | `device_lock_warning` | TRANSACTIONAL | 6 (name, amount, date, days past, merchant, ref) | `docs/guides/WHATSAPP-BOT-FLOW.md` |
| 7 | `device_unlocked` | TRANSACTIONAL | 4 (name, device, next amount, next date) | `docs/guides/WHATSAPP-BOT-FLOW.md` |

### B4.2: Submit Additional KYC Templates (for 24h window)
- **Action:** Submit 3 new templates for KYC result notifications:

| # | Template Name | Category | Parameters | Content |
|---|---------------|----------|------------|---------|
| 8 | `kyc_approved` | TRANSACTIONAL | 1 (name) | "Hi {{1}}, your identity has been verified! We're calculating your credit score now. We'll send you your loan offer shortly." |
| 9 | `kyc_rejected` | TRANSACTIONAL | 2 (name, reason) | "Hi {{1}}, we couldn't verify your identity. Reason: {{2}}. You can try again by replying RESTART, or visit our office for assistance." |
| 10 | `kyc_in_review` | TRANSACTIONAL | 1 (name) | "Hi {{1}}, your documents are being reviewed by our team. We'll update you within 24 hours. Thank you for your patience." |

### B4.3: Track Approval Status
- **Action:** Monitor template approval in Meta Dashboard
- **Expected wait:** 24-48 hours per template
- **If rejected:** Review Meta's rejection reason, modify content, resubmit

### B4.4: Map Approved Templates to Code Constants
- **File:** `services/whatsapp-service/src/templates/` (populate stub directory)
- **Action:** Create template constants file:
  ```typescript
  // services/whatsapp-service/src/templates/template-names.ts
  export const TEMPLATES = {
    LOAN_APPLICATION_WELCOME: 'loan_application_welcome',
    KYC_VERIFICATION_REQUEST: 'kyc_verification_request',
    LOAN_APPROVED: 'loan_approved',
    PAYMENT_REMINDER: 'payment_reminder',
    PAYMENT_RECEIVED: 'payment_received',
    DEVICE_LOCK_WARNING: 'device_lock_warning',
    DEVICE_UNLOCKED: 'device_unlocked',
    KYC_APPROVED: 'kyc_approved',
    KYC_REJECTED: 'kyc_rejected',
    KYC_IN_REVIEW: 'kyc_in_review',
  } as const;
  ```

### B4.5: Test Template Sending
- **Action:** Send each approved template to a test recipient
- **Command:** Use `/whatsapp/send` endpoint with `type: 'template'`
- **Verify:** Each template renders correctly in WhatsApp

## Acceptance Criteria

- [ ] All 10 templates submitted to Meta
- [ ] All templates approved (track any rejections)
- [ ] Template names mapped to code constants
- [ ] Each template tested with actual send
- [ ] Parameters render correctly in messages
- [ ] KYC templates work for 24h window scenario

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `services/whatsapp-service/src/templates/template-names.ts` | NEW - Template name constants |
