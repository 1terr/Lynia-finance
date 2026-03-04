# Task A5: Frontend Updates (Provider-Agnostic KYC Display)

> **Track:** A - KYC (Didit) Integration
> **Status:** Not Started
> **Priority:** Medium
> **Depends On:** A2 (database columns exist)
> **Estimated Effort:** Medium

---

## Objective

Update the admin portal KYC review components to display results from either DIDIT or Didit, with a provider badge and backward compatibility.

## Tasks

### A5.1: Update KYC Submission Type
- **File:** `frontend/admin-portal/src/types/index.ts`
- **Action:** Add provider fields to `KYCSubmission` interface:
  ```typescript
  export interface KYCSubmission {
    // ... existing fields
    kyc_provider?: 'didit' | 'didit';
    provider_result?: Record<string, unknown> | null;
    provider_warnings?: Array<{ risk: string; details: string }> | null;
    // Keep existing for backward compat
    didit_result: Record<string, unknown> | null;
  }
  ```

### A5.2: Update KYC Review Card (Queue View)
- **File:** `frontend/admin-portal/src/components/kyc-review/KYCReviewCard.tsx`
- **Action:**
  1. Read from `provider_result` with fallback to `didit_response`
  2. Add provider badge: "DIDIT" (blue) or "DIDIT" (purple)
  3. Rename "DIDIT Results" heading to "Verification Results"
  4. Display `provider_warnings` if present (Didit-specific)
  5. Keep all existing functionality (approve/reject actions, document viewer)

### A5.3: Update Customer KYC Card (Detail View)
- **File:** `frontend/admin-portal/src/components/customers/KYCReviewCard.tsx`
- **Action:** Same provider-agnostic changes as A5.2

### A5.4: Visual Test
- **Action:** Verify in browser:
  1. Existing DIDIT submissions display correctly (backward compat)
  2. New Didit submissions show provider badge and formatted results
  3. Warnings display for Didit submissions
  4. Approve/reject actions work for both providers

## Acceptance Criteria

- [ ] `KYCSubmission` type includes `kyc_provider`, `provider_result`, `provider_warnings`
- [ ] KYC review card reads `provider_result` with `didit_response` fallback
- [ ] Provider badge displays ("DIDIT" or "DIDIT")
- [ ] "DIDIT Results" heading renamed to "Verification Results"
- [ ] Didit warnings display when present
- [ ] Existing DIDIT submissions render correctly
- [ ] No TypeScript compilation errors in frontend

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `frontend/admin-portal/src/types/index.ts` | Add provider fields |
| `frontend/admin-portal/src/components/kyc-review/KYCReviewCard.tsx` | Provider-agnostic display |
| `frontend/admin-portal/src/components/customers/KYCReviewCard.tsx` | Provider-agnostic display |
