# Task A4: Scoring Service Normalization

> **Track:** A - KYC (Didit) Integration
> **Status:** Not Started
> **Priority:** Medium (blocks correct credit decisions with Didit)
> **Depends On:** A1 (provider interface)
> **Estimated Effort:** Small

---

## Objective

Make the scoring service provider-agnostic by renaming the DIDIT-specific interface and normalizing Didit score formats.

## Tasks

### A4.1: Rename Interface
- **File:** `services/scoring-service/src/index.ts`
- **Action:** Rename `DiditResult` to `KYCVerificationInput`:
  ```typescript
  // Before
  interface DiditResult {
    id_verification: { status: 'verified' | 'review' | 'failed' };
    face_match: { confidence: number }; // 0-1 float
    liveness: { status: 'passed' | 'failed' };
  }

  // After
  interface KYCVerificationInput {
    id_verification: { status: 'verified' | 'review' | 'failed' };
    face_match: { confidence: number }; // 0-1 float (normalized)
    liveness: { status: 'passed' | 'failed' };
  }
  ```
- **Update:** All references from `DiditResult` to `KYCVerificationInput`

### A4.2: Add Score Normalization Comment
- **File:** `services/scoring-service/src/index.ts`
- **Action:** Document that callers must normalize before calling:
  ```typescript
  // face_match.confidence must be 0-1 float
  // Didit returns 0-100 int → caller must divide by 100
  // DIDIT returns 0-100 → caller must divide by 100
  ```
- **Note:** The normalization happens in the KYC handler (A1.4) when it constructs the scoring payload, NOT in the scoring service itself

### A4.3: Verify Scoring Logic
- **Action:** Read `scoreKYCVerification()` and confirm it works correctly with normalized 0-1 inputs
- **Test:** Run existing scoring tests to ensure no regression

## Acceptance Criteria

- [ ] `DiditResult` renamed to `KYCVerificationInput`
- [ ] All references updated
- [ ] Normalization documented
- [ ] Existing scoring tests pass
- [ ] TypeScript compilation succeeds

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `services/scoring-service/src/index.ts` | Rename interface, add normalization docs |
