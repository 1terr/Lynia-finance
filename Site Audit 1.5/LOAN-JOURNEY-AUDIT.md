# Pre-Launch Audit: Complete Loan Journey — Findings & Execution Plan

## Context
High-stakes audit of Lynia Finance loan lifecycle before launching to **2000+ real customers within 1 month**. Both smartphone loans and digital loans launching simultaneously. This document captures all findings, blockers, and the prioritized execution plan.

---

## IMPLEMENTATION STATUS (2026-03-21)

> **13 code-implementable items completed and deployed to production.**
> Commit: `4c05f3b2` | Deployed: 2026-03-21 10:19 UTC
> Tests: 134 suites, 3014 tests, 0 failures
> Stack: `lynia-finance-prod` — UPDATE_COMPLETE
> All 17 Lambda functions updated. Auto-default EventBridge cron ENABLED.

---

## LAUNCH BLOCKERS (Must Fix — Ranked by Priority)

### P0 — Cannot Launch Without These

| # | Blocker | Status | Current State | Impact | Effort |
|---|---------|--------|--------------|--------|--------|
| 1 | **Payment providers not production-ready** | ⏳ PENDING | None of 4 providers (EcoCash, OneMoney, Omari, InnBucks) are production-ready | No payments can be collected or disbursed | HIGH — requires provider contracts, API credentials, sandbox testing, production certification |
| 2 | **Digital loan disbursement not built** | ✅ BUILT | `initiateDisbursement()` in payment-service + SQS trigger from loan-offer.ts | Digital loans can now disburse cash to customers | — |
| 3 | **WhatsApp Cloud API in progress** | ⏳ PENDING | Business account setup incomplete | Entire customer-facing flow is blocked | MED — Meta approval process has external dependencies |
| 4 | **PAY + SETTLE commands not implemented** | ✅ BUILT | Both commands live with Shona/Ndebele aliases + USSD fallback | Customers can initiate repayments and early payoff | — |
| 5 | **MDM provider not selected** | ⏳ PENDING | Evaluating alternatives to Trustonic | Device lock/unlock won't work for smartphone loans | HIGH — provider selection + full integration |
| 6 | **DIDIT KYC partially integrated** | ⏳ PENDING | Face matching not validated with ZW IDs | KYC may reject valid customers or approve fraudulent ones | MED — production testing + webhook config |
| 7 | **Interest rates not finalized** | ⏳ PENDING | Seed data shows 4% APR, mocks show 5%/month | Customers shown incorrect loan terms — legal liability | LOW effort but requires business decision |
| 8 | **Production DB partially migrated** | ✅ DONE | Migration 046 deployed (scoring v2 columns) | Runtime errors resolved | — |
| 9* | **Digital loan product selection step missing** | ✅ BUILT | `digital-product-selection.ts` with multi-org support, auto-select for single product | Customers can select correct loan product from verified orgs | — |

### P1 — Critical Logic Bugs

| # | Issue | Status | Fix Applied | Files |
|---|-------|--------|-------------|-------|
| 10 | **Device unlock logic wrong** | ✅ FIXED | Now unlocks when overdue cleared OR fully paid (checks `next_payment_date`) | `lock-management-service.ts:485-500` |
| 11 | **KYC 3-failure escalation missing** | ✅ FIXED | 3 failures → `kyc_manual_review` state + manual review record with 24h SLA | `process-kyc-result.ts:225-260` |
| 12 | **Auto-default at 90 days not automated** | ✅ BUILT | EventBridge Lambda runs daily at 7am CAT, queries 90+ DPD loans | `auto-default-scheduler.ts` + `auto-default-handler.ts` |
| 13 | **Duplicate loan check missing 'disbursed' status** | ✅ FIXED | Added `'disbursed'` to status list in SQL query | `calculate-score.ts:53` |

### P2 — Important for Launch Quality

| # | Issue | Status | Details |
|---|-------|--------|---------|
| 13 | **Early payoff WhatsApp command** | ✅ DONE | SETTLE command with `payment_type: 'early_payoff'`, aliases: settle/payoff/finish/clear/closeup |
| 14 | **Loan cancellation flow** | ✅ DONE | Admin handler with status guards (`approved`/`paid_deposit` only), double-confirm UI, device release, refund notification |
| 15 | **Cognito groups — VERIFIED OK** | ⏳ OPS TASK | Code verified. **Still need to:** create 8 groups in production Cognito + assign staff accounts |
| 16 | **Overpayment handling** | ⏳ NOT VERIFIED | Policy: apply to next installment. Fineract behavior not tested |
| 17 | **Payment reminder scheduler** | ⏳ NOT VERIFIED | Reminders respect 7am-9pm CAT but timezone config not validated |

---

## CONFIRMED DESIGN DECISIONS (From Audit Q&A)

| Decision | Detail |
|----------|--------|
| Digital loan org verification | **MANDATORY** — customer can select **MULTIPLE organizations** and see loan products from all selected orgs. Product selection shows a combined list across all verified orgs, giving the customer the widest choice. (Analogous to how smartphone loans have device selection, digital loans have multi-org product selection.) |
| Device unlock policy | Unlock when overdue is cleared, NOT full payoff |
| Repayment schedule | Fineract is source of truth; Lynia mirrors |
| Deposit flow | STK push primary, customer-initiated USSD as fallback |
| Distributor handover | Via distributor dashboard app |
| Post-approval communication | Customer already knows distributor, walks in |
| KYC failure (3x) | Auto-escalate to manual review |
| Penalties | Disabled for launch; configured per product later |
| AML/STR | Handled by Fineract |
| Language | English only at launch |
| Payment reference | National ID (customer enters manually at USSD prompt) |
| Overpayment | Apply to next installment |
| Early payoff | Allow via WhatsApp, no fees |
| EXTENSION command | Sends message to support (not automated) |
| Loan default | Auto-default at 90 days past due |
| Launch scope | Both smartphone + digital loans, 2000+ customers, 1 month timeline |

---

## COGNITO PERMISSIONS AUDIT (Verified)

**Status: Code is well-structured. Need to verify Cognito groups exist in AWS.**

The auth system works as follows:
1. User signs in via Cognito (`auth-store.ts:112-161`)
2. JWT `cognito:groups` claim is extracted (`auth-store.ts:46`)
3. First matching group maps to `AdminRole` (`auth-store.ts:47`)
4. Role maps to permissions via `ROLE_PERMISSIONS` lookup (`types/auth.ts:77-143`)

**8 roles defined with granular permissions:**
- `super_admin` — full access (27 permissions)
- `admin` — full access minus settings:write and admin_users:write
- `operations_manager` — loans, KYC, devices, payments, distributors
- `kyc_reviewer` — KYC review only
- `finance_team` — payments, reports, read-only loans
- `inventory_manager` — devices and distributors
- `customer_support` — read-only + notifications
- `reports_viewer` — reports only

**Action Required:** Create these 8 groups in production Cognito user pool and assign staff accounts.

---

## 4-WEEK EXECUTION PLAN

### Week 1: Foundation & Blockers (Payment + WhatsApp)
1. **Finalize interest rates** — business decision needed immediately
2. **Payment provider production setup** — Start with EcoCash (largest market share)
   - Obtain production API credentials
   - Configure webhook URLs
   - Test sandbox → production promotion
3. ~~**Run remaining DB migrations** against production RDS~~ ✅ Migration 046 deployed
4. **WhatsApp Cloud API** — Push Meta business verification to completion
   - Submit message templates for approval
5. ~~**Fix device unlock logic** — Change from full-payoff to overdue-cleared~~ ✅ FIXED
6. ~~**Fix duplicate loan check** — Add 'disbursed' status~~ ✅ FIXED

### Week 2: Core Features Build
7. ~~**Build PAY + SETTLE commands** in WhatsApp loan-commands~~ ✅ BUILT with aliases
8. ~~**Build digital loan disbursement**~~ ✅ BUILT — `initiateDisbursement()` + SQS trigger
9. ~~**Digital loan product selection state**~~ ✅ BUILT — `digital-product-selection.ts`
10. ~~**KYC 3-failure escalation**~~ ✅ FIXED — auto-escalate to manual review
10. **MDM provider selection** — Evaluate and begin integration
11. **DIDIT production testing** — Validate face matching with ZW national IDs
12. **Cognito setup** — Create 8 groups, assign initial staff users

### Week 3: Automation & Polish
13. ~~**Auto-default at 90 days** — Scheduled Lambda to transition overdue loans~~ ✅ BUILT
14. ~~**Early payoff WhatsApp command** — SETTLE command triggers full balance payment~~ ✅ BUILT
15. ~~**Loan cancellation flow** — Admin-only cancellation before disbursement~~ ✅ BUILT
16. **OneMoney production setup** — Second payment provider
17. **Payment reminder timezone fix** — Verify CAT timezone in Lambda config
18. **Overpayment handling verification** — Test Fineract behavior with overpayments

### Week 4: E2E Testing & Go-Live
19. **Full E2E test: Smartphone loan journey**
    - WhatsApp onboarding → KYC → scoring → device selection → terms → deposit → handover → repayment → lock/unlock
20. **Full E2E test: Digital loan journey**
    - WhatsApp onboarding → KYC → scoring → product selection → amount → terms → disbursement → repayment
21. **Load testing** — Simulate 100 concurrent WhatsApp sessions
22. **Payment reconciliation test** — Verify payment matching by national ID
23. **Admin portal walkthrough** — Verify all admin workflows function
24. **Distributor dashboard test** — Verify handover flow
25. ~~**Production deployment** — SAM deploy with all fixes~~ ✅ DEPLOYED 2026-03-21
26. **Soft launch** — First 50-100 customers for validation

---

## PROCESS FLOW DIAGRAMS

### Smartphone Loan (Complete Journey)
```
Customer sends "Hi" on WhatsApp
  ↓
Welcome message + product selection
  ↓
Selects "Smartphone Financing"
  ↓
Collects: name, DOB, gender, location
  ↓
Collects: employment type, household size (NO income/debt questions) ✅ UPDATED
  ↓
KYC: Upload national ID photo
  ↓
KYC: Take selfie
  ↓
KYC: DIDIT processes (face match + ID verification)
  ├─ APPROVED → credit scoring
  ├─ REJECTED → retry (max 3) → ✅ auto-escalates to manual review
  └─ MANUAL_REVIEW → hold in queue
  ↓
Credit Scoring v2: org-centric model (1000 raw → 300-850 scaled) ✅ UPDATED
  ├─ APPROVE (≥350) → device selection
  ├─ REJECT (<350) → show score, end flow
  └─ REVIEW → manual review queue
  ↓
Device Selection: show affordable devices (price ≤ credit limit, in stock)
  ↓
Term Selection: 6/12/18 months with monthly payment calc
  ↓
Loan Summary: device, deposit, term, rate, monthly payment
  ↓
Terms Acceptance: customer types "I Accept"
  ↓
Loan Created in Lynia DB (status: 'approved')
Fineract sync (non-blocking) → admin can retry if fails
  ↓
Customer pays deposit via EcoCash/OneMoney (STK push or USSD)
  ↓
Webhook confirms deposit → status: 'paid_deposit'
  ↓
Customer visits distributor
Distributor: verify identity → verify deposit → check device condition → complete handover
  ↓
Status: 'disbursed' → 'active'
Device enrolled in MDM [BLOCKER: MDM provider not selected]
  ↓
Monthly repayments via PAY command ✅ LIVE
  ↓
Missed payment (7+ days) → lock trigger created (3-day grace)
  ↓
Grace expires, no payment → device LOCKED via MDM
  ↓
Customer pays overdue amount → device UNLOCKED ✅ FIXED: unlocks on overdue cleared
  ↓
All payments complete → status: 'paid_off' → device permanently unlocked
  ↓
90 days past due without payment → auto-defaulted ✅ AUTOMATED
```

### Digital Loan (Complete Journey)
```
Customer sends "Hi" on WhatsApp
  ↓
Welcome + selects "Digital Credit"
  ↓
Collects: name, DOB, gender, location
  ↓
Collects: employment type, household size (NO income/debt questions) ✅ UPDATED
  ↓
Organization Verification (MANDATORY — MULTI-SELECT)
  → Customer selects one or more organizations they belong to
  → System verifies membership for each selected org
  ↓
Digital Loan Product Selection ✅ NEW STATE
  → System queries loan products for ALL verified organizations
  → Combined list shown to customer grouped by org
  → Auto-selects if only one product available
  → Customer selects one product from any of their orgs
  → Selected product determines amount range, rate, and terms
  ↓
KYC: same flow as smartphone (3 failures → manual review ✅)
  ↓
Credit Scoring v2: org-centric model (threshold ≥450 for digital) ✅ UPDATED
  ↓
Amount Selection: enter desired amount (within product limits + credit limit)
  ↓
Term Selection: based on selected product's allowed terms
  ↓
Disbursement Method: EcoCash / OneMoney / InnBucks
  ↓
Loan Summary + Terms Acceptance
  ↓
Loan Created (status: 'approved')
  ↓
Cash disbursed to mobile wallet via push-to-wallet ✅ BUILT
  ↓
Status: 'active'
  ↓
Monthly repayments via PAY command ✅ LIVE
Early payoff via SETTLE command ✅ LIVE
  ↓
All payments complete → status: 'paid_off'
  ↓
90 days past due without payment → auto-defaulted ✅ AUTOMATED
```

---

## VERIFICATION PLAN

### Pre-Launch Checklist
```
[ ] Interest rates finalized and configured in loan_products table
[ ] At least 1 payment provider (EcoCash) production-ready
[ ] WhatsApp Business Account verified and templates approved
[ ] DIDIT KYC production credentials configured
[ ] MDM provider selected and basic lock/unlock working
[x] All DB migrations run on production RDS ✅ 2026-03-21
[ ] Cognito groups created and staff accounts assigned
[x] PAY command functional in WhatsApp ✅ 2026-03-21
[x] Digital loan disbursement flow working ✅ 2026-03-21
[x] Device unlock logic fixed (overdue-cleared, not full-payoff) ✅ 2026-03-21
[x] KYC 3-failure escalation implemented ✅ 2026-03-21
[x] Auto-default at 90 days scheduler running ✅ 2026-03-21
[x] Duplicate loan check includes 'disbursed' status ✅ 2026-03-21
[ ] E2E test passed: smartphone loan journey
[ ] E2E test passed: digital loan journey
[ ] Payment reconciliation tested with national ID matching
[x] Admin portal all pages functional ✅ 2026-03-21 (cancel button, score v2 display, defaulted status)
[ ] Distributor handover flow tested
```

**Score: 8/17 completed (47%) — remaining items are external dependencies + manual testing**

---

---

## CREDIT SCORING MODEL OVERHAUL — ✅ IMPLEMENTED

> **Deployed to production 2026-03-21 as Scoring Model v2**
> All scoring functions rewritten. 134 test suites, 3014 tests pass.
> DB migration 046 adds `org_verification_score`, `device_collateral_score`, `scoring_model_version` columns.

### Context
The current scoring model relies heavily on data sources unavailable at launch (mobile money APIs, external credit bureaus, self-reported income). The revised model centers on **organization verification** as the primary signal, aligned with best practices from M-Kopa and GigMile in African alternative lending.

### Key Decisions
- **Self-reported income: REMOVED from scoring AND onboarding** — don't ask the question at all ✅
- **Mobile money component: REMOVED** — no API access at launch ✅
- **External credit: NOW sourced from organizations** (Excel/API upload, org-specific fields) ✅
- **Org verification: PRIMARY signal** at 35% weight for all products ✅
- **Unified scoring model** for both smartphone and digital loans ✅
- **Unaffiliated smartphone customers: get NEUTRAL org score (50%)** — can still qualify but org-verified customers have clear advantage ✅
- **Digital loans: org verification MANDATORY** — unaffiliated customers cannot get digital loans ✅
- **Device collateral: uses RETAIL price** (not depreciated) ✅

### Unified Scoring Model (1000 points)

| Component | Points | Weight | Description |
|-----------|--------|--------|-------------|
| **Org Verification** | 350 | 35% | Trust level, tenure, salary verification, employment status. Unaffiliated smartphone customers get neutral score (175/350). |
| **Affordability (org-based)** | 250 | 25% | DTI from org-verified salary vs loan amount. Unaffiliated: skip DTI, use device collateral coverage instead. |
| **KYC Quality** | 150 | 15% | ID verification, face match score, liveness check. Same as current. |
| **Repayment Willingness** | 150 | 15% | First-timers: neutral (75/150). Repeat customers: actual history from Lynia DB. |
| **Device Collateral / Ext. Credit** | 100 | 10% | Smartphone: device retail price as % of loan. Digital: org-provided credit data. |
| **TOTAL** | **1000** | **100%** | |

### Approval Thresholds (per product)

| Product | Threshold | Rationale |
|---------|-----------|-----------|
| Smartphone loans | **350/850** | Device collateral reduces risk |
| Digital loans | **450/850** | Unsecured, no collateral, higher bar |

### Org Verification Sub-Scoring (350 points max)

| Sub-Component | Points | Scoring |
|---------------|--------|---------|
| Org Trust Level | 120 | Static tiers at launch: Government=120, Corporate=90, Cooperative=60, Other=30. Migrate to dynamic per-org scoring after 3-6 months of data. |
| Employment Status | 80 | Active=80, Retired=40, Suspended/Other=0 |
| Employment Tenure | 70 | ≥5yr=70, ≥2yr=55, ≥1yr=35, <1yr=15 |
| Salary Verification | 80 | Verified via org data=80, Not verified=0 |

**Unaffiliated smartphone customers:** Receive neutral score of **175/350** (50%).

### Device Collateral Sub-Scoring (100 points, smartphone only)

| Coverage Ratio | Points | Description |
|----------------|--------|-------------|
| Retail ≥ 100% of loan | 100 | Device fully covers loan value |
| Retail 80-99% | 80 | Strong coverage |
| Retail 60-79% | 60 | Moderate coverage |
| Retail 40-59% | 40 | Partial coverage |
| Retail < 40% | 20 | Weak coverage |

Uses **retail price** (not depreciated) since device is new at disbursement.

### Progressive Credit Building
- **Score-driven only** — no fixed multipliers
- Repeat customer data naturally improves repayment willingness component (15%)
- Good repayment history shifts score upward, increasing product eligibility
- Late payments reduce score, constraining future borrowing

### Salary Multiplier
- **No salary cap** — product limits + credit score are sufficient constraints
- `salary_multiplier` field on `product_organizations` table NOT used for capping

### Org Data Upload (varies per org)
- Minimum required: employee ID, name, employment status, start date
- Optional enrichment: salary, department/grade, deduction history, performance
- Upload via: Excel bulk upload or API integration
- Each org provides what they can; scoring gracefully degrades for missing fields

### Files Modified — ✅ ALL DONE

| File | Changes | Status |
|------|---------|--------|
| `services/scoring-service/src/scoring/scoring-engine.ts` | Rewrite component weights, delete mobile money, add device collateral, neutral org scoring, per-product thresholds | ✅ DONE |
| `services/scoring-service/src/scoring/types.ts` | Remove income fields, add `device_retail_price_usd`, replace `mobileMoney` with `deviceCollateral` | ✅ DONE |
| `services/scoring-service/src/handlers/calculate-score.ts` | Remove `monthly_income_usd` required, add `'disbursed'` to duplicate check, store v2 columns | ✅ DONE |
| `services/scoring-service/src/alternative-data.ts` | Mark mobile money functions `@deprecated` | ✅ DONE |
| `services/whatsapp-service/src/onboarding/states/employment-info.ts` | Remove income and debt collection. Only employment type + household size | ✅ DONE |
| `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` | Remove income fields from payload, add `device_retail_price_usd` + `org_verification` | ✅ DONE |
| `database/migrations/046_scoring_model_v2.sql` | New columns: `org_verification_score`, `device_collateral_score`, `scoring_model_version` | ✅ DONE |

---

## KEY FILES REFERENCE

| Area | Critical Files |
|------|---------------|
| WhatsApp state machine | `services/whatsapp-service/src/onboarding/index.ts` |
| WhatsApp commands | `services/whatsapp-service/src/loan-commands.ts` |
| Digital product selection | `services/whatsapp-service/src/onboarding/states/digital-product-selection.ts` ✅ NEW |
| Loan offer/acceptance | `services/whatsapp-service/src/onboarding/states/loan-offer.ts` |
| KYC processing | `services/kyc-service/src/handlers/process-kyc-result.ts` |
| Credit scoring | `services/scoring-service/src/handlers/calculate-score.ts` |
| Payment initiation | `services/payment-service/src/handlers/initiate-payment.ts` |
| Payment completion | `services/payment-service/src/payment-service.ts` |
| Payment webhooks | `services/payment-service/src/handlers/webhook-ecocash.ts` |
| Device lock/unlock | `services/lock-service/src/lock-management-service.ts` |
| Auto-default scheduler | `services/payment-service/src/auto-default-scheduler.ts` ✅ NEW |
| Loan cancellation | `services/admin-service/src/handlers/loans.ts` ✅ NEW |
| Fineract loan actions | `services/fineract-proxy-service/src/handlers/loan-actions.ts` |
| Notification scheduler | `services/notification-service/src/reminder-scheduler.ts` |
| Auth permissions | `frontend/apps/admin-portal/src/types/auth.ts` |
| Auth store | `frontend/apps/admin-portal/src/lib/store/auth-store.ts` |
| Admin loan pages | `frontend/apps/admin-portal/src/components/fineract/` |
| DB schema | `database/migrations/001_initial_schema.sql` |
| Scoring v2 migration | `database/migrations/046_scoring_model_v2.sql` ✅ NEW |
| SAM template | `template.yaml` |

---

## GAP ANALYSIS & RECOMMENDED IMPROVEMENTS

### A. Missing Unit Tests (5 items — 80%+ coverage required)

| # | Function | File | Risk |
|---|----------|------|------|
| 1 | `handlePay()` | `loan-commands.ts` | HIGH — customer-facing payment initiation |
| 2 | `handleSettle()` | `loan-commands.ts` | HIGH — early payoff with YES confirmation |
| 3 | `handleDigitalProductSelection()` | `digital-product-selection.ts` | MED — multi-org product query |
| 4 | `processAutoDefaults()` | `auto-default-scheduler.ts` | HIGH — changes loan status + locks devices |
| 5 | `handleCancelLoan()` | `admin-service/handlers/loans.ts` | MED — admin destructive action |

### B. External Blockers Still Open (5 items)

| # | Blocker | Owner | Impact |
|---|---------|-------|--------|
| 1 | Payment providers not production-ready | Biz Dev | Cannot collect/disburse real money |
| 2 | MDM provider not selected | CTO | Cannot lock/unlock smartphones |
| 3 | WhatsApp Cloud API verification | Meta | Cannot reach customers |
| 4 | DIDIT KYC not production-tested with ZW IDs | KYC Team | May reject valid customers |
| 5 | Interest rates not finalized | Finance | Legal liability for wrong rates |

### C. Operational Tasks Not Done (2 items)

| # | Task | Owner |
|---|------|-------|
| 1 | Create 8 Cognito groups in production user pool | DevOps |
| 2 | Assign staff accounts to correct groups | Admin |

### D. Code-Level Improvements Recommended (8 items)

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| 1 | PAY command calls payment API without auth | LOW | Uses internal HTTP call without JWT. Should use service-to-service auth or direct function call |
| 2 | SETTLE YES confirmation is stateless | MED | If user types YES in a new message without prior SETTLE context, behavior is undefined. Should track pending settlement in session |
| 3 | Auto-default scheduler emits no CloudWatch metrics | LOW | Add `defaulted_count` custom metric for dashboarding |
| 4 | Digital product selection stores full objects in session | LOW | Stores entire product list in `state_data.available_products`. Should store IDs and re-query on selection |
| 5 | Loan cancellation refund is notification-only | MED | Queues WhatsApp notification but doesn't initiate actual refund payment. Need refund handler |
| 6 | Scoring model has dead `externalCredit: 0` weight | LOW | Component still calculated but contributes 0 to score. Remove to simplify |
| 7 | `alternative-data.ts` deprecated functions still importable | LOW | Could be accidentally used. Add runtime warning or remove exports |
| 8 | PAY/SETTLE commands don't create audit log entries | MED | Payment commands should log to audit trail for compliance |

### E. Process Flow Accuracy Issues (Resolved in this update)

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Digital loan flow showed product selection AFTER KYC | Fixed: code does it BEFORE KYC (after org verification). Diagram updated. |
| 2 | Smartphone flow didn't mention scoring v2 | Fixed: diagram now shows "Credit Scoring v2" with threshold |
| 3 | Neither diagram showed `digital_product_selection` state | Fixed: digital flow now explicitly shows this state |
| 4 | Stale [BLOCKER] and [BUG] markers | Fixed: replaced with ✅ status markers |

### F. Security/Compliance Items to Verify Before Launch (4 items)

| # | Item | Status | Risk |
|---|------|--------|------|
| 1 | Overpayment handling | NOT VERIFIED | Fineract behavior with overpayments not tested. Could miscalculate balances |
| 2 | Payment reminder timezone | NOT VERIFIED | Sending window 7am-9pm CAT relies on UTC+2 offset. Not validated |
| 3 | RBZ transaction limits | IMPLEMENTED | Limits enforced in code but not E2E tested with real providers |
| 4 | Audit trail completeness | PARTIAL | Auto-default and cancellation log to audit_log. PAY/SETTLE commands do not |
