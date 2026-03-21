# Loan Journey Audit — Implementation Plan

**Date:** 2026-03-21
**Scope:** 13 blockers/bugs across 5 workstreams, 22 files, 5 implementation phases
**Context:** Pre-launch audit fixes for 2000+ customer launch within 1 month

---

## Context

Pre-launch audit of Lynia Finance's complete loan lifecycle identified **13 blockers/bugs** across scoring, WhatsApp commands, device lock, KYC, and payment services. With 2000+ real customers launching within 1 month, these fixes are critical. This plan covers all code-implementable items from `LOAN-JOURNEY-AUDIT.md`, organized into 5 parallel workstreams.

---

## Workstream 1: Scoring Service Overhaul

**Why:** Current model relies on income self-reporting and mobile money APIs (unavailable at launch). New model centers on org verification as primary signal.

### 1A. Database Migration — `database/migrations/046_scoring_model_v2.sql` (NEW)

- ADD `org_verification_score INTEGER` to `credit_scores`
- ADD `device_collateral_score INTEGER` to `credit_scores`
- ADD `scoring_model_version VARCHAR(10) DEFAULT 'v2'` to `credit_scores`
- Keep `mobile_money_score` for historical audit trail (store as 0 for new scores)

### 1B. Scoring Engine Rewrite — `services/scoring-service/src/scoring/scoring-engine.ts`

**New weights (both products use same weights):**

| Component | Points | Weight |
|-----------|--------|--------|
| Org Verification | 350 | 35% |
| Affordability (org-based) | 250 | 25% |
| KYC Quality | 150 | 15% |
| Repayment Willingness | 150 | 15% |
| Device Collateral / Ext Credit | 100 | 10% |
| **TOTAL** | **1000** | |

**Functions to rewrite:**

1. `getScoringWeights()` (lines 246-265) — Both smartphone and digital get identical weights: `{ orgVerification: 350, affordability: 250, kycVerification: 150, repayment: 150, deviceCollateral: 100 }`

2. `calculateOrgVerificationScore()` (lines 276-302) — New max 350pts:
   - Trust Level: 120pts (Gov=120, Corporate=90, Cooperative=60, Other=30)
   - Employment Status: 80pts (Active=80, Retired=40, Suspended=0)
   - Tenure: 70pts (>=5yr=70, >=2yr=55, >=1yr=35, <1yr=15)
   - Salary Verification: 80pts (Verified=80, Not verified=0)
   - **Unaffiliated smartphone:** neutral 175/350

3. `scoreAffordability()` (lines 32-72) — Remove income-based DTI. New logic: household-based affordability using org-verified salary (if available) vs requested amount. Max 250pts.

4. **NEW** `scoreDeviceCollateral()` — Smartphone only. Coverage ratio = device retail price / loan amount. >=100%=100pts, 80-99%=80pts, 60-79%=60pts, 40-59%=40pts, <40%=20pts. Digital loans get neutral 50/100.

5. `scoreRepaymentWillingness()` (lines 80-107) — Reduce max from 250 to 150pts. First-timers get neutral 75/150.

6. `scoreKYCVerification()` (lines 210-232) — Increase max from 100 to 150pts. Same sub-components, proportionally scaled.

7. **DELETE** `scoreMobileMoneyActivity()` (lines 115-152) — Dead code, no API access at launch.

8. `calculateRuleBasedScore()` (lines 321-444) — Wire new components. **Per-product thresholds:** smartphone 350/850, digital 450/850.

### 1C. Types Update — `services/scoring-service/src/scoring/types.ts`

- Remove `monthly_income_usd`, `existing_debt_obligations_usd` from `AffordabilityData`
- Add `device_retail_price_usd?: number`
- Remove `mobile_money_profile` from `CreditScoreInput`
- Replace `mobileMoney` with `deviceCollateral` in `ScoringWeights`

### 1D. Calculate Score Handler — `services/scoring-service/src/handlers/calculate-score.ts`

- **Line 29:** Remove `monthly_income_usd` from required fields
- **Line 53:** Fix duplicate loan check — add `'disbursed'` to status list:
  ```sql
  AND l.status IN ('approved', 'paid_deposit', 'active', 'disbursed')
  ```
- **Lines 114-128:** Store `org_verification_score`, `device_collateral_score`, `mobile_money_score: 0`, `scoring_model_version: 'v2'`

### 1E. Clean Up — `services/scoring-service/src/alternative-data.ts`

- Mark mobile money functions as deprecated (keep for future use, add `@deprecated` JSDoc)
- Remove from any active import paths

### 1F. Product Eligibility — `services/shared/utils/product-eligibility-resolver.ts`

- No structural changes needed (already database-driven)
- Verify `min_credit_score` values in seed data match new thresholds (350 smartphone, 450 digital)

---

## Workstream 2: WhatsApp Service

### 2A. Remove Income/Debt Collection — `services/whatsapp-service/src/onboarding/states/employment-info.ts`

- Remove income question (step 2 of 4)
- Remove debt question (step 3 of 4)
- Flow becomes: employment_type → household_size → transition to product_selection
- Keep session field types for backward compat with in-flight sessions

### 2B. Update Scoring Payload — `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`

- Remove `monthly_income_usd` and `existing_debt_obligations_usd` from payload
- Add `device_retail_price_usd: session.state_data.selected_device_price` for smartphones
- Add `org_verification` data block for digital loans (trust level, employment status, tenure from org member record)

### 2C. PAY Command — `services/whatsapp-service/src/loan-commands.ts`

**New `handlePay()` function (~80 lines):**
1. Look up customer + active loan (reuse pattern from `handleBalance`)
2. Get next installment amount from Fineract or Lynia DB
3. Call payment service `initiatePayment()` with `payment_type: 'repayment'`
4. Present USSD code to customer with payment instructions
5. Aliases: `pay`, `repay`, `send`, `lipiri` (Shona), `bhadala` (Ndebele)

### 2D. SETTLE Command — `services/whatsapp-service/src/loan-commands.ts`

**New `handleSettle()` function (~60 lines):**
1. Look up customer + active loan
2. Get full outstanding balance from Fineract
3. Show settlement summary (total outstanding, early payoff amount)
4. On confirmation: call Fineract proxy `handleEarlyPayoff()` + initiate payment collection
5. Aliases: `settle`, `payoff`, `pay off`, `early payoff`, `finish`, `clear`, `closeup`

**Also update:** `handleHelp()` to include PAY and SETTLE, `routeLoanCommand()` switch statement.

### 2E. Digital Loan Product Selection State (NEW)

**New file:** `services/whatsapp-service/src/onboarding/states/digital-product-selection.ts`

Inserted after `org_verification`, before `kyc_id_upload` for digital customers:
1. Query `loan_products` JOIN `product_organizations` for customer's verified org(s)
2. Support multi-org: session stores array of `verified_organization_ids`
3. Show combined product list grouped by org name
4. If only 1 product: auto-select, transition to `kyc_id_upload`
5. If multiple: numbered list, wait for selection
6. Store `selected_product_id` and `selected_organization_id` in session

**Modify:**
- `services/whatsapp-service/src/onboarding/states/org-verification.ts` — transition to `digital_product_selection` instead of `kyc_id_upload`
- `services/whatsapp-service/src/onboarding/index.ts` — add state case
- `services/whatsapp-service/src/onboarding/types.ts` — add to OnboardingState union

---

## Workstream 3: Bug Fixes & New Features

### 3A. Device Unlock Logic Fix — `services/lock-service/src/lock-management-service.ts:484-495`

**Current (line 485):** `if (loan.outstanding_balance === 0)` — only unlocks on full payoff

**Fix:** Query additional fields (`next_payment_date`, `status`) and unlock when loan is brought current:
```typescript
// Fetch loan with overdue context
const { data: loan } = await db
  .from('loans')
  .select('outstanding_balance, status, next_payment_date')
  .eq('id', payment.loan_id)
  .single()
  .execute();

const isStillOverdue = loan.next_payment_date &&
  new Date(loan.next_payment_date) < new Date();

// Unlock if fully paid OR no longer overdue
if (loan.outstanding_balance === 0 || !isStillOverdue) {
  await this.unlockDevice(...);
}
```

**Also update:** `services/payment-service/src/payment-service.ts:483-493` — trigger device unlock check on any repayment (not just `paid_off` status).

### 3B. KYC 3-Failure Escalation — `services/kyc-service/src/handlers/process-kyc-result.ts:225-245`

**Current (line 227):** `retryCount >= 3 ? 'rejected' : 'kyc_id_upload'`

**Fix:** Change to `'kyc_manual_review'` and create manual review record:
```typescript
const nextState = retryCount >= 3 ? 'kyc_manual_review' : 'kyc_id_upload';

if (retryCount >= 3) {
  await db.from('kyc_manual_reviews').insert({
    kyc_submission_id: submissionId,
    customer_id: customerId,
    review_status: 'pending',
    sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    priority: 'high',
    escalation_reason: 'three_failed_attempts',
  }).execute();
}
```

Update WhatsApp message to say "under manual review" instead of "rejected".

### 3C. Auto-Default at 90 Days — NEW Lambda

**New files:**
- `services/payment-service/src/auto-default-scheduler.ts` — core logic
- `services/payment-service/src/handlers/auto-default-handler.ts` — Lambda handler

**Logic:**
1. Query loans: `status IN ('active', 'delinquent')` AND days_past_due >= 90
2. For each: update status to `'defaulted'`, set `defaulted_at`
3. Queue device lock via SQS (smartphone loans)
4. Queue final default notification
5. Must be idempotent (skip already-defaulted loans)

**Schedule:** Daily at 5am UTC (7am CAT) via EventBridge cron.

### 3D. Digital Loan Disbursement — `services/payment-service/src/payment-service.ts`

**New method:** `initiateDisbursement()` — push-to-wallet after terms acceptance:
1. Validate loan status is `approved`/`terms_accepted`
2. Call provider `initiatePayment()` with type `disbursement`
3. On completion: loan transitions to `active`, confirmation sent

**Trigger from:** `services/whatsapp-service/src/onboarding/states/loan-offer.ts` — after digital loan terms acceptance, queue disbursement via SQS.

### 3E. Loan Cancellation — NEW Handler

**New file:** `services/admin-service/src/handlers/loan-cancellation.ts` (or add to existing admin handlers)

- Endpoint: `POST /api/v1/admin/loans/{loanId}/cancel`
- Guards: `loan.status IN ('approved', 'paid_deposit')` only
- Requires admin auth + `loans:reject` permission
- Sets `status='cancelled'`, `cancelled_at`, `cancelled_by`
- If deposit paid: queue refund
- If smartphone: release device reservation
- Audit log entry

---

## Workstream 4: Frontend — Admin Portal

### 4A. Score Display Update

- Update score breakdown components to show "Org Verification" and "Device Collateral" for v2 scores
- Handle legacy v1 scores (show "Mobile Money" for old records)
- Check `scoring_model_version` field to determine layout

### 4B. Loan Cancellation UI

- Add "Cancel Loan" button on loan detail page
- Only visible for `approved`/`paid_deposit` status
- Double-confirm dialog (per CLAUDE.md requirements)
- Calls cancel endpoint, shows toast on result

### 4C. Auto-Default Visibility

- Add `defaulted` to loan status filter options on loans list
- Show `defaulted_at` in loan detail view
- Consider dashboard metric for monthly auto-defaults

---

## Workstream 5: Infrastructure — AWS/SAM

### 5A. Auto-Default Lambda — `template.yaml`

```yaml
AutoDefaultSchedulerFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub ${Environment}-lynia-auto-default-scheduler
    CodeUri: services/
    Handler: payment-service/src/handlers/auto-default-handler.handler
    Timeout: 120
    Events:
      DailySchedule:
        Type: Schedule
        Properties:
          Schedule: cron(0 5 * * ? *)
          Enabled: true
```

**Pre-check:** Verify no existing Lambda with this name via `aws lambda get-function`.

### 5B. Loan Cancellation Route — `template.yaml`

Add API event to admin function for `POST /api/v1/admin/loans/{loanId}/cancel`.

### 5C. Database Migration Deployment

Run migration 046 against production RDS: `bash database/deploy-to-rds.sh`

---

## Implementation Order & Dependencies

```
Phase 1 (Foundation):
  [WS1A] DB migration 046
  [WS3A] Lock service fix (independent)
  [WS3B] KYC escalation fix (independent)
  [WS1D] Duplicate loan check fix (independent, line 53)

Phase 2 (Scoring Core):
  [WS1B] Scoring engine rewrite (depends on 1A)
  [WS1C] Types update
  [WS1D] Calculate handler update (depends on 1B, 1C)

Phase 3 (WhatsApp):
  [WS2A] Remove income/debt collection (independent)
  [WS2B] Update scoring payload (depends on WS1)
  [WS2C] PAY command (independent)
  [WS2D] SETTLE command (independent)
  [WS2E] Digital product selection state (independent)

Phase 4 (New Features + Infra):
  [WS5A] Auto-default Lambda in template.yaml
  [WS5B] Cancel route in template.yaml
  [WS3C] Auto-default scheduler (depends on 5A)
  [WS3D] Digital disbursement (independent)
  [WS3E] Loan cancellation handler (depends on 5B)

Phase 5 (Frontend + Polish):
  [WS4A] Score display update (depends on WS1)
  [WS4B] Cancellation UI (depends on WS3E)
  [WS4C] Auto-default visibility
```

---

## Safety Protocols

- **`/careful`** — Activate before destructive operations (DB migrations, template changes)
- **`/freeze services/scoring-service`** — Lock edit boundary during scoring rewrite
- **`/guard`** — Full safety guard during infrastructure changes
- **`/investigate`** — Use 5-phase protocol for any test failures
- **`/review`** — Staff-engineer review after each workstream completion

---

## Verification Plan

### Per-Workstream Tests
1. **Scoring:** Unit tests for each component function, integration test for full pipeline
2. **WhatsApp:** Unit tests for PAY/SETTLE, employment-info with 2 questions, digital product selection
3. **Bug fixes:** Unit tests for unlock conditions (overdue-cleared vs full-payoff), KYC escalation at exactly 3 failures, auto-default idempotency
4. **Frontend:** Component tests for cancel button visibility, score display v1/v2

### E2E Verification
- [ ] Smartphone loan: onboarding (no income questions) → scoring (new model) → device → terms → deposit → handover → PAY command → lock/unlock
- [ ] Digital loan: onboarding → org verification → product selection → scoring → amount → terms → disbursement → PAY → SETTLE
- [ ] KYC: 3 failures → manual review queue (not rejection)
- [ ] Auto-default: loan at 90 DPD transitions to defaulted
- [ ] Admin: cancel loan before disbursement, view new score components

### Files Modified (Complete List)

| # | File | Workstream |
|---|------|-----------|
| 1 | `database/migrations/046_scoring_model_v2.sql` | WS1A (NEW) |
| 2 | `services/scoring-service/src/scoring/scoring-engine.ts` | WS1B |
| 3 | `services/scoring-service/src/scoring/types.ts` | WS1C |
| 4 | `services/scoring-service/src/handlers/calculate-score.ts` | WS1D |
| 5 | `services/scoring-service/src/alternative-data.ts` | WS1E |
| 6 | `services/whatsapp-service/src/onboarding/states/employment-info.ts` | WS2A |
| 7 | `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` | WS2B |
| 8 | `services/whatsapp-service/src/loan-commands.ts` | WS2C, WS2D |
| 9 | `services/whatsapp-service/src/onboarding/states/digital-product-selection.ts` | WS2E (NEW) |
| 10 | `services/whatsapp-service/src/onboarding/states/org-verification.ts` | WS2E |
| 11 | `services/whatsapp-service/src/onboarding/index.ts` | WS2E |
| 12 | `services/whatsapp-service/src/onboarding/types.ts` | WS2E |
| 13 | `services/lock-service/src/lock-management-service.ts` | WS3A |
| 14 | `services/payment-service/src/payment-service.ts` | WS3A, WS3D |
| 15 | `services/kyc-service/src/handlers/process-kyc-result.ts` | WS3B |
| 16 | `services/payment-service/src/auto-default-scheduler.ts` | WS3C (NEW) |
| 17 | `services/payment-service/src/handlers/auto-default-handler.ts` | WS3C (NEW) |
| 18 | `services/whatsapp-service/src/onboarding/states/loan-offer.ts` | WS3D |
| 19 | `services/admin-service/src/handlers/loan-cancellation.ts` | WS3E (NEW) |
| 20 | `template.yaml` | WS5A, WS5B |
| 21 | Frontend score components (TBD during WS4) | WS4A |
| 22 | Frontend loan detail page (TBD during WS4) | WS4B |
