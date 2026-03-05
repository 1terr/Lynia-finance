# Changelog

All notable changes to Lynia Finance are documented in this file.

---

## [2026-03-05] Products & Devices Audit — 5 Bug Fixes + 3 Gap Closures

### Summary

Comprehensive audit of the Products and Devices flows end-to-end: admin product/device
creation, WhatsApp customer journey, loan creation, Fineract sync, distributor handover.
Found and fixed 5 SQL bugs and 3 data gaps across 5 service files.

### Bug Fixes

#### BUG 1: `c.full_name` column does not exist on `customers` table (CRITICAL)
- **Impact**: SQL queries returned NULL for customer names in distributor and admin views
- **Root cause**: `customers` has `first_name` + `last_name`, not `full_name`
- **Fix**: Replaced with `CONCAT(c.first_name, ' ', c.last_name)` in 4 remaining locations

| File | Line | Context |
|------|------|---------|
| `services/distributor-service/src/handlers/handovers.ts` | 35, 94, 116 | Handover list, loan search, ILIKE filter |
| `services/distributor-service/src/handlers/commissions.ts` | 24 | Commissions list |

#### BUG 2: Loan creation missing `product_id` (CRITICAL)
- **Impact**: Every WhatsApp loan had `product_id = NULL`, breaking downstream `JOIN loan_products`
- **File**: `services/whatsapp-service/src/onboarding/states/loan-offer.ts`
- **Fix**: Added product lookup by `product_category` before loan INSERT; included `product_id`, `product_category`, `disbursement_method`

#### BUG 3: Wrong column names in distributor loan search (CRITICAL)
- **Impact**: Distributor search returned NULL for device category, monthly payment, interest rate
- **File**: `services/distributor-service/src/handlers/handovers.ts`
- **Fix**: `lp.name` → `lp.product_name`, `lp.term_months` → `lp.loan_term_months`, `lp.interest_rate` → `lp.interest_rate_annual`, added `NULLIF` for division safety

#### BUG 4: `payment_status` column doesn't exist — should be `status` (MODERATE)
- **Impact**: Deposit verification queries failed or wrote to nonexistent column
- **File**: `services/distributor-service/src/handlers/handovers.ts`
- **Fix**: All `payment_status` → `status`; `'completed'` → `'confirmed'`; `'pending_verification'` → `'pending'`

#### BUG 5: Handover sets device status to `'assigned'` instead of `'sold'` (MINOR)
- **Impact**: Completed handovers showed device as "assigned" in admin portal
- **File**: `services/lock-service/src/handover/handover-workflow.ts`
- **Fix**: `status: 'assigned'` → `status: 'sold'`

### Gap Closures

#### GAP 1: Missing `customer_id` on deposit payment INSERT
- **File**: `services/distributor-service/src/handlers/handovers.ts`
- **Fix**: Look up `customer_id` from loan before inserting payment record

#### GAP 2: Fineract product mapping used env var instead of database
- **File**: `services/whatsapp-service/src/onboarding/states/loan-offer.ts`
- **Fix**: Look up `loan_products.fineract_product_id` from DB, fall back to `FINERACT_SMARTPHONE_PRODUCT_ID` env var

#### GAP 3: Invalid deposit status value `'pending_verification'`
- **File**: `services/distributor-service/src/handlers/handovers.ts`
- **Fix**: Changed to `'pending'` (valid schema value)

### Files Changed

| File | Changes |
|------|---------|
| `services/admin-service/src/handlers/inventory-devices.ts` | `full_name` fix (2 queries) |
| `services/distributor-service/src/handlers/commissions.ts` | `full_name` fix |
| `services/distributor-service/src/handlers/handovers.ts` | `full_name` fix, column names, `payment_status` → `status`, `customer_id` on payment INSERT |
| `services/lock-service/src/handover/handover-workflow.ts` | Device status `assigned` → `sold` |
| `services/whatsapp-service/src/onboarding/states/loan-offer.ts` | `product_id` lookup, Fineract DB mapping |

### Deployment

- Deployed to production: 2026-03-05
- All service files updated

---

## [2026-03-05] KYC Service Bug Fixes — Silent Failures & Column Mismatches

### Summary

Fixed multiple silent failures in the KYC service that caused DIDIT verification results to
never persist to the database, leaving all KYC submissions permanently stuck in `pending` status.

### Root Cause

Three column-name mismatches across the KYC service:

1. **`created_at` vs `submitted_at`**: All KYC handlers ordered by `created_at`, but the
   `kyc_submissions` table uses `submitted_at`. The QueryBuilder returned errors silently,
   causing duplicate-check, status lookup, and retry queries to always fail.
2. **`full_name` vs `first_name`/`last_name`**: `process-kyc-result.ts` tried to set
   `full_name` on the `customers` table, which has `first_name`/`last_name`. The update
   silently failed.
3. **Swallowed errors**: `process-kyc-result.ts` discarded the `{ error }` return from both
   DB updates, hiding the failures from logs.

### Fixes

| File | Change |
|------|--------|
| `services/kyc-service/src/handlers/initiate-kyc.ts` | `created_at` → `submitted_at` |
| `services/kyc-service/src/handlers/get-kyc-status.ts` | `created_at` → `submitted_at` |
| `services/kyc-service/src/handlers/retry-kyc.ts` | `created_at` → `submitted_at` |
| `services/kyc-service/src/handlers/process-kyc-result.ts` | Removed `full_name` from customer update; added error logging for both DB updates |
| `tests/unit/kyc/callback-handler.test.ts` | Removed `full_name` expectation |
| `tests/integration/kyc-service.test.ts` | Removed `full_name` expectation; `created_at` → `submitted_at` |

### Deployment

- Commit: `956f29f`
- Deployed to production: 2026-03-05
- All test suites pass

---

## [2026-03-05] Security: Block Credit Scoring for Unverified KYC

### Summary

Critical security fix — customers with pending or failed KYC verification were being scored
and approved for loans. A customer received "Congratulations you are Approved, Credit Limit $500"
despite DIDIT never returning verification results for any of their 4 KYC submissions.

### Root Cause

[credit-scoring.ts](services/whatsapp-service/src/onboarding/states/credit-scoring.ts) only
checked if a KYC submission **existed**, not if it was **verified**. KYC is 10% weight (100/1000
points), so a customer scored 616/850 on other components and was approved into Tier 2.

### Fix (Two Layers)

#### Layer 1: WhatsApp Flow Guard

In `credit-scoring.ts`, added a hard gate after fetching the KYC submission:

```
if (kycSubmission.status !== 'verified' && kycSubmission.verification_decision !== 'APPROVED') {
  → "Your identity verification is still being processed..."
}
```

Prevents unverified customers from reaching the scoring service entirely.

#### Layer 2: Scoring Engine Defense-in-Depth

In `scoring-engine.ts`, added auto-reject before tier assignment:

```
if (input.kyc_result.id_verification.status === 'failed') {
  → decision: 'reject', tier: 'KYC Not Verified', credit_limit: $0
}
```

Even if the WhatsApp guard is bypassed (e.g., direct API call), the scoring engine
itself refuses to approve unverified customers.

### Test Updates

| File | Change |
|------|--------|
| `tests/unit/scoring/credit-score-calculation.test.ts` | KYC `status: 'failed'` now expects `reject` / `KYC Not Verified` |
| `tests/integration/loan-products-e2e.test.ts` | Low-scoring customer expects `reject` |
| `tests/e2e/e2e-005-non-zimbabwe-rejection.test.ts` | Very low income expects `reject` |

### Deployment

- Commit: `7d9cf6c`
- Deployed to production: 2026-03-05
- All test suites pass

---

## [2026-03-04] End-to-End Loan Journey — 8 Critical Blockers Resolved

### Summary

Full audit of the smartphone loan application journey from WhatsApp initiation through
device handover. Resolved 8 critical blockers that prevented the loan lifecycle from
functioning end-to-end. The system now supports the complete flow: scoring → loan creation →
deposit payment → distributor handover.

### Critical Fixes

#### 1. Loan Record Created After Terms Acceptance
- **File:** `services/whatsapp-service/src/onboarding/states/loan-offer.ts`
- After terms acceptance, `INSERT INTO loans` with status `'approved'`
- Generates loan reference (`LYNIA-2026-XXXXX`)
- Calls `syncLoanToFineract()` (non-blocking, create + auto-approve)
- Sends WhatsApp message with loan reference + deposit payment instructions

#### 2. Fineract Loan Product Mapping
- **File:** `template.yaml`
- Added `FineractProductIdTier1/2/3` parameters for tier → Fineract product ID mapping
- Products are configured via `phase-6-fineract-integration/config/setup-fineract-products.ts`

#### 3. Deposit Payment Linked to Loan via National ID
- **File:** `services/payment-service/src/deposit-resolver.ts` (new)
- **Files:** All 4 webhook handlers (`webhook-ecocash.ts`, `webhook-onemoney.ts`, `webhook-omari.ts`, `webhook-innbucks.ts`)
- Customer pays deposit with national ID as reference
- `deposit-resolver.ts` matches by national ID → finds `approved` loan → creates payment → transitions to `paid_deposit`
- Webhooks always return 200 to payment providers (deposit-resolver catches errors internally)

#### 4. Handover Status Contradiction Fixed
- **File:** `services/distributor-service/src/handlers/handovers.ts`
- Submit validation changed from `status !== 'approved'` to `status !== 'paid_deposit'`
- Aligns with search query and correct loan lifecycle

#### 5. Device Lock Stub During Handover
- **File:** `services/lock-service/src/handover/handover-workflow.ts`
- After handover completion, calls `POST /locks/lock` with device IMEI
- Records lock intent in DB (Trustonic API is a no-op stub until integration)
- Non-blocking — lock failure doesn't block handover

#### 6. Deposit Verified Before Handover
- **File:** `services/distributor-service/src/handlers/handovers.ts`
- Replaced hardcoded `deposit_verified: true` with actual payment lookup
- Queries `payments` table for confirmed deposit matching loan_id

#### 7. Duplicate Loan Check in Scoring (by National ID)
- **File:** `services/scoring-service/src/handlers/calculate-score.ts`
- Before scoring, checks `loans JOIN customers` by national_id for active loans
- Prevents one person from holding multiple simultaneous loans
- Uses national ID (not customer_id) to catch re-registrations with different phone numbers

#### 8. Minimum Score Threshold for Rejection
- **File:** `services/scoring-service/src/scoring/scoring-engine.ts`
- Score < 350 → `decision = 'reject'` (credit_limit = $0, tier = 'Below Minimum')
- Score ≥ 350 → tiered approval (Tier 1/2/3 as before)
- WhatsApp flow handles rejection gracefully with improvement suggestions
- Decision type expanded from `'approve'` to `'approve' | 'reject'`

### Updated Credit Tiers

| Tier | Score Range | Credit Limit | Down Payment | APR | Decision |
|------|------------|-------------|-------------|-----|----------|
| Tier 3 | ≥ 650 | $2,000 | 10% | 3% | Approve |
| Tier 2 | 500 - 649 | $500 | 20% | 4% | Approve |
| Tier 1 | 350 - 499 | $200 | 30% | 5% | Approve |
| Below Minimum | < 350 | $0 | — | — | **Reject** |

### Loan Lifecycle (New)

```
approved → paid_deposit → active → paid_off / defaulted
```

### Test Updates (6 files)

| File | Change |
|------|--------|
| `tests/unit/scoring/credit-score-calculation.test.ts` | Score 300-349 now expects reject instead of approve |
| `tests/integration/data-flow/credit-score-propagation.test.ts` | Added 'reject' to valid decisions |
| `tests/contract/payment-service.contract.test.ts` | Webhook errors return 200 (not 500) |
| `tests/e2e/e2e-002-payment-collection.test.ts` | Webhook errors return 200 |
| `tests/e2e/e2e-007-loan-completion.test.ts` | Webhook errors return 200 |
| `tests/unit/distributor/distributor-service.test.ts` | Handover expects `paid_deposit` status, mock reset fix |

### Files Changed

**Services** (15 files — 14 modified, 1 new):
- `services/scoring-service/src/scoring/scoring-engine.ts` — rejection threshold
- `services/scoring-service/src/scoring/types.ts` — decision type `'approve' | 'reject'`
- `services/scoring-service/src/handlers/calculate-score.ts` — duplicate loan check
- `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` — rejection handling
- `services/whatsapp-service/src/onboarding/states/loan-offer.ts` — loan record creation + Fineract sync
- `services/whatsapp-service/src/onboarding/types.ts` — updated session types
- `services/payment-service/src/deposit-resolver.ts` — **new file** (national ID deposit matching)
- `services/payment-service/src/handlers/webhook-ecocash.ts` — deposit resolver fallback
- `services/payment-service/src/handlers/webhook-onemoney.ts` — deposit resolver fallback
- `services/payment-service/src/handlers/webhook-omari.ts` — deposit resolver fallback
- `services/payment-service/src/handlers/webhook-innbucks.ts` — deposit resolver fallback
- `services/distributor-service/src/handlers/handovers.ts` — status fix + deposit verification
- `services/lock-service/src/handover/handover-workflow.ts` — device lock stub
- `services/shared/types/enums.ts` — `paid_deposit` enum value
- `template.yaml` — Fineract product ID parameters

**Tests** (6 files):
- See table above

### Deployment

- Deployed to production: 2026-03-04 ~18:40 UTC
- Stack: `lynia-finance-prod` — `UPDATE_COMPLETE`
- All test suites pass (3 pipeline attempts — mock leakage fix required)

---

## [2026-03-04] WhatsApp Flow Fixes & Scoring Simplification

### Summary

Removed unreachable scoring tiers (review/reject), added back navigation to the
WhatsApp onboarding flow, extended session timeout, and cleaned up dead code
across 19 files.

### Scoring Engine

- **Removed `review` tier** (score 300-349): Was unreachable because
  `scaled_score = 300 + (raw/1000)*550` always produces >= 300, so no customer
  could ever land in the 300-349 range that triggered "Manual Review".
- **Removed `reject` tier** (score < 300): Also unreachable for the same reason.
- **Simplified to 3 tiers**: All customers are now auto-approved into Tier 1/2/3.
  Only KYC verification failure blocks loan progression.

| Tier | Score Range | Credit Limit | Down Payment | APR |
|------|------------|-------------|-------------|-----|
| Tier 1 | 300 - 499 | $200 | 30% | 5% |
| Tier 2 | 500 - 649 | $500 | 20% | 4% |
| Tier 3 | 650 - 850 | $2,000 | 10% | 3% |

### WhatsApp Onboarding

- **Added Back navigation** at three post-scoring steps:
  - `device_selection` → "back" returns to `credit_scoring` (re-fetches devices)
  - `term_selection` → "back" returns to `device_selection` (re-shows device list from DB)
  - `loan_offer` → "back" returns to `term_selection` (preserves device choice)
- **Extended session timeout** from 30 minutes to 24 hours. Customers can now
  resume onboarding the next day without losing progress.
- **Fixed no-stock message**: Removed false promise "We will notify you when new
  stock arrives" (no notification system exists). Now says "Please check back
  later or contact support@lynia.finance for assistance."
- **Removed review/reject WhatsApp handlers**: The `credit-scoring.ts` state
  handler no longer branches on `decision === 'review'` or `'reject'` since
  decision is always `'approve'`.

### ML Pipeline

- Aligned `ml-pipeline.ts` tier thresholds with `scoring-engine.ts` (650/500
  instead of 750/700/650/550).
- Removed `'Review'` and `'Below Threshold'` tier strings.
- Decision type narrowed from `'approve' | 'review' | 'reject'` to `'approve'`.

### Type Cleanup

- `services/scoring-service/src/scoring/types.ts`: `decision` type → `'approve'`
- `services/scoring-service/src/ml-pipeline.ts`: `PredictionResult.decision` → `'approve'`
- `services/whatsapp-service/src/onboarding/types.ts`: `state_data.decision` → `'approve'`

### Test Updates (11 files, 2405 tests passing)

| File | Change |
|------|--------|
| `tests/unit/scoring/credit-score-calculation.test.ts` | "Manual Review" test → Tier 1 |
| `tests/contract/scoring-service.contract.test.ts` | Decision always `'approve'` |
| `tests/integration/data-flow/credit-score-propagation.test.ts` | Removed review boundary |
| `tests/e2e/e2e-001-complete-onboarding.test.ts` | Decision always `'approve'` |
| `tests/e2e/e2e-004-admin-loan-approval.test.ts` | Removed review queue, updated tiers |
| `tests/e2e/e2e-005-non-zimbabwe-rejection.test.ts` | Decision always `'approve'` |
| `tests/e2e/e2e-007-loan-completion.test.ts` | Updated tier thresholds |
| `tests/fixtures/loans.ts` | All scores → approved, updated limits |
| `tests/performance/service-benchmarks.test.ts` | Decision always `'approve'` |
| `tests/unit/whatsapp/onboarding.test.ts` | Session timeout 30min → 24h |

### Files Changed

19 files modified, 202 insertions, 221 deletions.

**Services** (9 files):
- `services/scoring-service/src/scoring/scoring-engine.ts`
- `services/scoring-service/src/scoring/types.ts`
- `services/scoring-service/src/ml-pipeline.ts`
- `services/whatsapp-service/src/onboarding/session.ts`
- `services/whatsapp-service/src/onboarding/types.ts`
- `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`
- `services/whatsapp-service/src/onboarding/states/device-selection.ts`
- `services/whatsapp-service/src/onboarding/states/term-selection.ts`
- `services/whatsapp-service/src/onboarding/states/loan-offer.ts`

**Tests** (10 files):
- See table above

### Deployment

- Deployed to production: 2026-03-04 16:00 UTC
- Stack: `lynia-finance-prod` — `UPDATE_COMPLETE`
- All 96 test suites pass (2405 tests)

---

## [2026-03-04] Distributor Dashboard Mobile Optimization

- Comprehensive mobile responsive overhaul for distributor dashboard
- Touch-friendly controls for field agent tablet use

## [2026-03-03] Scoring Tests & Declining Balance Formula

- Aligned all scoring tests with new 3-tier thresholds
- Implemented declining balance amortization formula
- Added device selection and term selection to WhatsApp loan flow

## [2026-03-03] DIDIT KYC Migration

- Removed Smile Identity, made DIDIT sole KYC provider
- Implemented device selection, term selection in WhatsApp flow
- Fixed 22 failing tests across 7 suites
