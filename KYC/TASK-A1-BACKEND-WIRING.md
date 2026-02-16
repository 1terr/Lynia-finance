# Task A1: KYC Backend Wiring

> **Track:** A - KYC (Didit) Integration
> **Status:** Not Started
> **Priority:** Critical (blocks all other KYC tasks)
> **Estimated Effort:** Medium

---

## Objective

Wire the existing `DiditService` client into the KYC Lambda handler via a provider factory pattern, maintaining Smile Identity as a fallback.

## Prerequisites

- Didit account created (DONE)
- `KYCProvider` interface defined in `services/shared/types/kyc-provider.ts` (DONE)
- `DiditService` implemented in `services/kyc-service/src/didit-service.ts` (DONE)

## Tasks

### A1.1: Add `form-data` dependency
- **File:** `services/kyc-service/package.json`
- **Action:** `npm install form-data` (required by DiditService for multipart uploads)
- **Test:** `npm ls form-data` shows installed version

### A1.2: Adapt SmileIdentityService to implement KYCProvider
- **File:** `services/kyc-service/src/smile-identity-service.ts`
- **Action:** Add `implements KYCProvider` and adapter methods:
  - `submitVerification()` → delegates to existing `submitEnhancedKYC()`
  - `verifyWebhookSignature()` → delegates to existing method
  - `parseWebhookPayload()` → converts Smile payload to `KYCVerificationResult`
  - `determineDecision()` → delegates to existing `determineVerificationDecision()`
  - `handleError()` → delegates to existing `handleSmileError()`
- **Constraint:** All existing methods remain unchanged for backward compatibility
- **Test:** Existing contract tests still pass

### A1.3: Create Provider Factory
- **File:** `services/kyc-service/src/kyc-provider-factory.ts` (NEW)
- **Action:** Create factory that reads `KYC_PROVIDER` env var:
  ```typescript
  export function createKYCProvider(): KYCProvider {
    const provider = process.env.KYC_PROVIDER || 'smile_identity';
    if (provider === 'didit') return new DiditService();
    return new SmileIdentityService();
  }
  ```
- **Test:** Factory returns correct provider type based on env var

### A1.4: Refactor Lambda Handler
- **File:** `services/kyc-service/src/index.ts`
- **Action:**
  1. Replace `const smileService = new SmileIdentityService()` with `const kycProvider = createKYCProvider()`
  2. `initiateKYC`: Use `kycProvider.submitVerification()`, write `kyc_provider` to DB
  3. `handleSmileCallback` → `handleKYCCallback`: Detect provider from webhook headers, delegate accordingly
  4. Write `provider_job_id` and `provider_response` to new DB columns
- **Constraint:** Must work with existing DB schema (new columns added in Task A2)
- **Test:** Contract tests pass with both `KYC_PROVIDER=smile_identity` and `KYC_PROVIDER=didit`

### A1.5: Export KYC Provider Types
- **File:** `services/shared/types/index.ts`
- **Action:** Export `KYCProvider`, `KYCVerificationResult`, `KYCProviderName` from `kyc-provider.ts`
- **Test:** TypeScript compilation succeeds

## Acceptance Criteria

- [ ] `form-data` is in `kyc-service/package.json` dependencies
- [ ] `SmileIdentityService implements KYCProvider`
- [ ] `createKYCProvider()` factory returns correct provider based on `KYC_PROVIDER` env var
- [ ] Lambda handler uses provider factory (no direct Smile instantiation)
- [ ] Callback handler detects provider from webhook headers
- [ ] All existing contract tests pass unchanged
- [ ] TypeScript compilation succeeds (`sam build`)

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `services/kyc-service/package.json` | Add `form-data` dependency |
| `services/kyc-service/src/smile-identity-service.ts` | Add `implements KYCProvider` |
| `services/kyc-service/src/kyc-provider-factory.ts` | NEW - Provider factory |
| `services/kyc-service/src/index.ts` | Refactor to use factory |
| `services/shared/types/index.ts` | Export KYC provider types |
