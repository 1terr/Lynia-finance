# Changelog

All notable changes to Lynia Finance are documented in this file.

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
