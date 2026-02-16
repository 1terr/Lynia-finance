# Task A6: KYC Testing (Unit, Contract, Mock Fixtures)

> **Track:** A - KYC (Didit) Integration
> **Status:** Not Started
> **Priority:** High (production-ready requirement)
> **Depends On:** A1 (handler refactor), A2 (DB migration)
> **Estimated Effort:** Large

---

## Objective

Write comprehensive tests for the Didit provider: unit tests for DiditService, contract tests for the refactored handler, and mock fixtures for integration/E2E tests.

## Tasks

### A6.1: Create Didit Mock Fixtures
- **File:** `tests/helpers/mock-external-services.ts`
- **Action:** Add alongside existing `mockSmileIdentityResponses`:
  ```typescript
  export const mockDiditResponses = {
    approvedKYC: {
      idVerification: { status: 'Approved', full_name: 'JOHN MOYO', document_number: '63-123456A47' },
      liveness: { status: 'Approved', score: 95, method: 'PASSIVE' },
      faceMatch: { status: 'Approved', score: 88 },
    },
    declinedKYC: {
      idVerification: { status: 'Declined', warnings: [{ risk: 'DOCUMENT_EXPIRED' }] },
      liveness: { status: 'Declined', score: 30 },
      faceMatch: { status: 'Declined', score: 25 },
    },
    inReviewKYC: {
      idVerification: { status: 'Approved' },
      liveness: { status: 'Approved', score: 72 },
      faceMatch: { status: 'In Review', score: 60 },
    },
  };
  ```

### A6.2: Write DiditService Unit Tests
- **File:** `tests/unit/didit-service.test.ts` (NEW)
- **Test Cases (30+):**

  **submitVerification:**
  - Success: all 3 APIs called with correct form data
  - ID verification fails (400): throws with retriable flag
  - Liveness fails (400): throws with retriable flag
  - Face match fails (400): throws with retriable flag
  - Rate limited (429): error has `retry_after`
  - Auth failure (401): `admin_action_required: true`
  - Insufficient credits (403): `admin_action_required: true`

  **base64ToBuffer:**
  - With data URI prefix: returns correct Buffer
  - Without prefix: returns correct Buffer

  **verifyWebhookSignature:**
  - Valid V2 signature: returns true
  - Invalid signature: returns false
  - Stale timestamp (>5 min): returns false
  - Unicode characters: handles correctly
  - Malformed JSON: returns false

  **parseWebhookPayload:**
  - Approved: correct `KYCVerificationResult` with `match_result: 'verified'`
  - Declined with expired doc: `document_expired: true`
  - In Review: `match_result: 'manual_review'`
  - No decision (In Progress): throws error

  **parseCombinedResult:**
  - All approved: correct scores
  - Liveness declined: `liveness_passed: false`

  **determineDecision:**
  - Confidence >= 85: `APPROVED`
  - Confidence < 50: `REJECTED`
  - Confidence 50-84: `MANUAL_REVIEW`
  - Liveness failed: `REJECTED`
  - Document tampered: `REJECTED`
  - Document expired: `REJECTED`

  **handleError:**
  - 400: `retriable: true`
  - 429: `retry_after` set
  - Unknown error: `retriable: true`

### A6.3: Update Contract Tests
- **File:** `tests/contract/kyc-service.contract.test.ts`
- **Action:** Add Didit-specific test cases alongside existing Smile tests:
  - `POST /kyc/initiate` with `KYC_PROVIDER=didit`
  - `POST /kyc/callback` with Didit webhook (V2 signature)
  - `POST /kyc/callback` Didit approved/declined/in-review
  - `POST /kyc/callback` invalid V2 signature
  - `POST /kyc/callback` stale timestamp
  - All existing Smile tests pass unchanged

### A6.4: Update E2E Test
- **File:** `tests/e2e/e2e-001-complete-onboarding.test.ts`
- **Action:** Add test variant that uses Didit provider for the KYC step

## Acceptance Criteria

- [ ] 30+ unit tests for DiditService all pass
- [ ] Contract tests pass with `KYC_PROVIDER=didit`
- [ ] All existing Smile Identity tests pass unchanged (no regression)
- [ ] Mock fixtures cover approved, declined, and in-review scenarios
- [ ] E2E test works with both providers
- [ ] Coverage: branches >= 80%, lines >= 80% for `didit-service.ts`

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `tests/helpers/mock-external-services.ts` | Add `mockDiditResponses` |
| `tests/unit/didit-service.test.ts` | NEW - 30+ unit tests |
| `tests/contract/kyc-service.contract.test.ts` | Add Didit provider tests |
| `tests/e2e/e2e-001-complete-onboarding.test.ts` | Add Didit test variant |
