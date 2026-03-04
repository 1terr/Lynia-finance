# Credit Scoring Data Gaps — Fix Report

**Date**: 2026-03-04
**Commit**: `09bde7d` (master)
**Status**: Deployed to production

---

## Summary

An audit of the credit scoring data pipeline revealed that **~35% of the score was dead weight** (neutral defaults) and several safety gaps existed that could result in fraud bypass or inaccurate scoring. Six gaps were identified and five were fixed (two deferred by decision). A cross-cutting identity problem was also discovered and resolved.

### Impact

| Metric | Before | After |
|--------|--------|-------|
| Scoring components with real data | 2 of 5 (Affordability + KYC) | 3 of 5 (+Repayment for returning customers) |
| KYC bypass risk | Yes (defaulted to "verified") | No (blocked if missing) |
| Returning customer recognition | Never (always scored as first-timer) | Yes (loan history queried) |
| Product category passthrough | Missing (digital weights never activated) | Working |
| Missing field handling | Dangerous defaults ($200 income, $250 loan) | Fail-fast with error message |
| Customer identity | Phone-only (split records on phone change) | National ID deduplication |

---

## Gaps Fixed

### Gap 1: Repeat Customer History Never Queried

**Problem:** The WhatsApp `credit-scoring.ts` handler never queried the database for returning customers' loan/payment history. Even a customer with 5 perfectly repaid loans was scored as a first-timer, receiving a neutral 125/250 for Repayment Willingness.

**Fix:** Added `fetchRepaymentHistory(customerId)` function that:
1. Queries `loans` table for loan count and missed payments
2. Queries `payments` table for confirmed installment count
3. Calculates `on_time_payment_rate = confirmed / (confirmed + missed)`
4. Passes real metrics to the scoring engine for returning customers

**Files changed:** `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`

---

### Gap 2: KYC Fallback Defaulted to "Verified"

**Problem:** When no KYC submission existed in the database, the scoring payload defaulted to `{ status: 'verified', face_match_score: 96, liveness_passed: true }`. This silently bypassed identity verification — a fraud risk.

**Fix:**
- If no KYC submission found, scoring is **blocked entirely** with a user-facing error message
- `face_match_score` defaults to **0** (not 96) when unknown — unknown score should penalize, not reward

**Files changed:** `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`

---

### Gap 3: Product Category Not Sent to Scorer

**Problem:** The WhatsApp flow stores `selected_product` as `'smartphone' | 'digital_credit'`, but the scoring API expects `'smartphone' | 'digital'`. The field was never mapped or sent, so digital loan weights (which redistribute 200 points to organization verification) never activated.

**Fix:** Added mapping in the scoring payload:
```typescript
product_category: session.state_data.selected_product === 'digital_credit' ? 'digital' : 'smartphone'
```

**Files changed:** `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`

---

### Gap 4: Employment Type Collected but Never Sent

**Problem:** `employment_type` was collected during the WhatsApp employment state but never passed to the scoring service. While no scoring logic uses it yet, it wasn't even stored for future use.

**Fix:**
- Added `employment_type?: string` to `CreditScoreInput` type
- Passed `employment_type` in the scoring payload
- Stored in `scoring_data` JSONB column for future scoring model use

**Files changed:**
- `services/scoring-service/src/scoring/types.ts`
- `services/scoring-service/src/handlers/calculate-score.ts`
- `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`

---

### Gap 5: Dangerous Defaults Mask Missing Data

**Problem:** When required session data was missing, the scoring payload used dangerous fallback defaults:
- `monthly_income_usd || 200` — fake income
- `requested_loan_amount || 250` — fake loan amount
- `household_size || 3` — arbitrary household
- `face_match_score ?? 96` — near-perfect KYC score

These defaults could produce valid-looking but incorrect credit decisions.

**Fix:**
- Added fail-fast validation for required fields (`monthly_income_usd`, `requested_loan_amount`, `household_size`)
- Missing fields return an error message asking the customer to restart
- Only legitimate zero-states retain defaults: `existing_debt_obligations_usd ?? 0`, `dependents ?? 0`

**Files changed:** `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`

---

### Gap 6: National ID Identity & Deduplication

**Problem:** Customer identity relied entirely on phone numbers. In Zimbabwe, customers frequently change or use multiple phone numbers, causing:
- Duplicate customer records in the database
- Split loan history across records
- Returning customers scored as first-timers (Gap 1 amplified)
- Organization verification looked up members by phone instead of national ID

**Fix (4 sub-changes):**

#### 6a. Database migration
Added `national_id` column (VARCHAR(20), UNIQUE) with index to the `customers` table.

**File:** `database/migrations/036_add_national_id_to_customers.sql`

#### 6b. Shared crypto utility
Moved `hashNationalId()` from admin-service to `services/shared/utils/crypto.ts` for cross-service reuse. Admin-service re-exports from shared to avoid breaking existing imports.

**Files:**
- `services/shared/utils/crypto.ts` (new)
- `services/admin-service/src/handlers/helpers.ts` (re-export)

#### 6c. Customer deduplication during KYC
After KYC verification succeeds, the system:
1. Checks if another customer already has this national ID
2. If duplicate found: merges to existing customer record (preserving loan history), updates whatsapp_number, deletes duplicate
3. If no duplicate: stores national_id on current customer

**File:** `services/whatsapp-service/src/onboarding/states/kyc-upload.ts`

#### 6d. Organization verification switched to national ID
Changed `POST /scoring/verify-organization` to accept `national_id` instead of `phone_number`. Hashes the ID with SHA-256 and looks up `organization_members.national_id_hash`.

**File:** `services/scoring-service/src/handlers/verify-organization.ts`

---

## Gaps Deferred (By Decision)

### Mobile Money Integration (20% weight)

EcoCash/OneMoney API integration to pull transaction history, account age, and balance. Currently returns neutral score (100/200). Deferred pending API partnership agreements.

### External Credit APIs (15% weight)

Credit bureau (TransUnion/Experian), Bolt/Uber driver verification, bank account verification. Currently returns neutral score (75/150). Deferred pending API access and partnership agreements.

---

## All Files Changed

| File | Type | Changes |
|------|------|---------|
| `database/migrations/036_add_national_id_to_customers.sql` | New | national_id column migration |
| `services/shared/utils/crypto.ts` | New | Shared hashNationalId utility |
| `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` | Modified | Gaps 1-5: history lookup, KYC safety, product category, employment type, validation |
| `services/whatsapp-service/src/onboarding/states/kyc-upload.ts` | Modified | Gap 6c: National ID dedup during KYC |
| `services/scoring-service/src/handlers/verify-organization.ts` | Modified | Gap 6d: Switch to national_id_hash lookup |
| `services/scoring-service/src/scoring/types.ts` | Modified | Gap 4: Added employment_type field |
| `services/scoring-service/src/handlers/calculate-score.ts` | Modified | Gap 4: Store employment_type in scoring_data |
| `services/admin-service/src/handlers/helpers.ts` | Modified | Gap 6b: Re-export hashNationalId from shared |
| `tests/contract/scoring-service.contract.test.ts` | Modified | Updated org verification tests for national_id |
| `tests/integration/loan-products-e2e.test.ts` | Modified | Updated org verification tests for national_id |

---

## Test Results

All **2,405 tests passed** after changes. Key test updates:
- Org verification contract tests updated from `phone_number` to `national_id` payloads
- Integration tests updated for national_id-based org lookup
- Existing scoring engine unit tests unaffected (pure functions, no data pipeline changes)

---

## Production Deployment

- **Deploy method**: GitHub Actions (`deploy.yml` workflow)
- **Stack**: `lynia-finance-prod` (CloudFormation/SAM)
- **Status**: `UPDATE_COMPLETE`
- **Post-deploy**: Database migration `036_add_national_id_to_customers.sql` must be run against production RDS separately

```bash
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
```

---

## Remaining Action Items

1. **Run migration 036** against production RDS to add the `national_id` column
2. **Backfill national_id** for existing customers from `kyc_submissions` records
3. **Monitor** returning customer scoring to verify repayment history is being picked up
4. **Future**: Connect mobile money APIs when partnerships are established
5. **Future**: Connect credit bureau APIs when access is secured
