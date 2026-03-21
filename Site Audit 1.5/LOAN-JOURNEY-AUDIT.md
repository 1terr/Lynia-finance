# Pre-Launch Audit: Complete Loan Journey — Findings & Execution Plan

## Context
High-stakes audit of Lynia Finance loan lifecycle before launching to **2000+ real customers within 1 month**. Both smartphone loans and digital loans launching simultaneously. This document captures all findings, blockers, and the prioritized execution plan.

---

## LAUNCH BLOCKERS (Must Fix — Ranked by Priority)

### P0 — Cannot Launch Without These

| # | Blocker | Current State | Impact | Effort |
|---|---------|--------------|--------|--------|
| 1 | **Payment providers not production-ready** | None of 4 providers (EcoCash, OneMoney, Omari, InnBucks) are production-ready | No payments can be collected or disbursed | HIGH — requires provider contracts, API credentials, sandbox testing, production certification |
| 2 | **Digital loan disbursement not built** | Push-to-wallet flow doesn't exist | Digital loans can't disburse cash to customers | HIGH — new feature build |
| 3 | **WhatsApp Cloud API in progress** | Business account setup incomplete | Entire customer-facing flow is blocked | MED — Meta approval process has external dependencies |
| 4 | **PAY + SETTLE commands not implemented** | WhatsApp loan-commands.ts has BALANCE, HISTORY, SCHEDULE, HELP, UPDATE, DEVICE, EXTENSION — but NO PAY or SETTLE | Customers can't initiate repayments or early payoff | MED — two new commands + STK push + USSD fallback |
| 5 | **MDM provider not selected** | Evaluating alternatives to Trustonic | Device lock/unlock won't work for smartphone loans | HIGH — provider selection + full integration |
| 6 | **DIDIT KYC partially integrated** | Face matching not validated with ZW IDs | KYC may reject valid customers or approve fraudulent ones | MED — production testing + webhook config |
| 7 | **Interest rates not finalized** | Seed data shows 4% APR, mocks show 5%/month | Customers shown incorrect loan terms — legal liability | LOW effort but requires business decision |
| 8 | **Production DB partially migrated** | Some migrations not run on production RDS | Missing tables/columns will cause runtime errors | LOW — run remaining migrations |
| 9* | **Digital loan product selection step missing** | After org verification, flow skips to amount_selection. No step for customer to choose from multi-org digital loan products | Customers can't select the correct loan product from their verified orgs | MED — new WhatsApp onboarding state + multi-org product query |

### P1 — Critical Logic Bugs

| # | Issue | Current Behavior | Required Behavior | Files |
|---|-------|-----------------|-------------------|-------|
| 10 | **Device unlock logic wrong** | Unlocks only when `outstanding_balance === 0` (full payoff) | Should unlock when overdue amount is cleared | `services/lock-service/src/lock-management-service.ts:485-492` |
| 11 | **KYC 3-failure escalation missing** | After 3 failed KYC attempts, unclear what happens | Should auto-escalate to manual review queue | `services/kyc-service/src/handlers/process-kyc-result.ts` |
| 12 | **Auto-default at 90 days not automated** | No cron/scheduler transitions loans to 'defaulted' at 90 DPD | Need scheduled job to check and transition | `services/payment-service/` or new handler |
| 13 | **Duplicate loan check missing 'disbursed' status** | Only checks `'approved', 'paid_deposit', 'active'` | Should also check `'disbursed'` | `services/scoring-service/src/handlers/calculate-score.ts:39-77` |

### P2 — Important for Launch Quality

| # | Issue | Details |
|---|-------|---------|
| 13 | **Early payoff WhatsApp command** | `handleEarlyPayoff` exists in Fineract proxy but no WhatsApp command to trigger it |
| 14 | **Loan cancellation flow** | No way to cancel a loan after terms acceptance but before disbursement |
| 15 | **Cognito groups — VERIFIED OK** | All 9 groups defined in `infrastructure/aws/cognito.yaml` with correct precedence. Frontend `ROLE_PERMISSIONS` maps 8 admin roles to 29 granular permissions. Backend uses `requireRole()` middleware. **Only action needed:** ensure production Cognito stack is deployed and staff accounts created with correct group assignments. |
| 16 | **Overpayment handling** | Policy: apply to next installment. Need to verify Fineract handles this correctly |
| 17 | **Payment reminder scheduler** | Reminders respect 7am-9pm CAT but Lambda runs in UTC — verify timezone config |

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
3. **Run remaining DB migrations** against production RDS
4. **WhatsApp Cloud API** — Push Meta business verification to completion
   - Submit message templates for approval
5. **Fix device unlock logic** — Change from full-payoff to overdue-cleared
   - File: `services/lock-service/src/lock-management-service.ts:485-492`
6. **Fix duplicate loan check** — Add 'disbursed' status
   - File: `services/scoring-service/src/handlers/calculate-score.ts:39-77`

### Week 2: Core Features Build
7. **Build PAY + SETTLE commands** in WhatsApp loan-commands
   - **PAY**: Customer types PAY → show balance + next installment → attempt STK push for installment amount → if STK fails, show USSD instructions with national ID as reference
   - **SETTLE**: Customer types SETTLE → show total outstanding balance → confirm intent → STK push for full balance → USSD fallback
   - Add aliases: pay/repay/send for PAY, settle/finish/clear/closeup for SETTLE
   - File: `services/whatsapp-service/src/loan-commands.ts`
8. **Build digital loan disbursement**
   - After terms acceptance for digital loans → initiate push-to-wallet
   - Integrate with payment provider's disbursement API
   - File: new handler or extend `services/payment-service/`
9. **Digital loan product selection state** — New WhatsApp onboarding state after org_verification
   - Support multi-org: session stores array of `verified_organization_ids`
   - Query `loan_products` filtered by ALL verified org IDs and `product_category = 'digital'`
   - Show combined product list grouped by org name
   - Store `selected_product_id` and `selected_organization_id` in session
   - Selected product feeds into amount_selection limits
   - File: new state in `services/whatsapp-service/src/onboarding/states/`
10. **KYC 3-failure escalation** — Auto-create manual review task after 3 fails
   - File: `services/kyc-service/src/handlers/process-kyc-result.ts`
10. **MDM provider selection** — Evaluate and begin integration
11. **DIDIT production testing** — Validate face matching with ZW national IDs
12. **Cognito setup** — Create 8 groups, assign initial staff users

### Week 3: Automation & Polish
13. **Auto-default at 90 days** — Scheduled Lambda to transition overdue loans
14. **Early payoff WhatsApp command** — SETTLE command triggers full balance payment
15. **Loan cancellation flow** — Admin-only cancellation before disbursement
16. **OneMoney production setup** — Second payment provider
17. **Payment reminder timezone fix** — Verify CAT timezone in Lambda config
18. **Overpayment handling verification** — Test Fineract behavior with overpayments

### Week 4: E2E Testing & Go-Live
19. **Full E2E test: Smartphone loan journey**
    - WhatsApp onboarding → KYC → scoring → device selection → terms → deposit → handover → repayment → lock/unlock
20. **Full E2E test: Digital loan journey**
    - WhatsApp onboarding → KYC → scoring → amount selection → terms → disbursement → repayment
21. **Load testing** — Simulate 100 concurrent WhatsApp sessions
22. **Payment reconciliation test** — Verify payment matching by national ID
23. **Admin portal walkthrough** — Verify all admin workflows function
24. **Distributor dashboard test** — Verify handover flow
25. **Production deployment** — SAM deploy with all fixes
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
Collects: employment type, household size (NO income/debt questions)
  ↓
KYC: Upload national ID photo
  ↓
KYC: Take selfie
  ↓
KYC: DIDIT processes (face match + ID verification)
  ├─ APPROVED → credit scoring
  ├─ REJECTED → retry (max 3) → [MISSING: auto-escalate to manual review]
  └─ MANUAL_REVIEW → hold in queue
  ↓
Credit Scoring: rule-based score (300-850)
  ├─ APPROVE → device selection
  ├─ REJECT → show score, end flow
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
Monthly repayments via PAY command [BLOCKER: not built]
  ↓
Missed payment (7+ days) → lock trigger created (3-day grace)
  ↓
Grace expires, no payment → device LOCKED via MDM
  ↓
Customer pays overdue amount → device UNLOCKED [BUG: currently requires full payoff]
  ↓
All payments complete → status: 'paid_off' → device permanently unlocked
```

### Digital Loan (Complete Journey)
```
Customer sends "Hi" on WhatsApp
  ↓
Welcome + selects "Digital Credit"
  ↓
Organization Verification (MANDATORY — MULTI-SELECT)
  → Customer selects one or more organizations they belong to
  → System verifies membership for each selected org
  ↓
Personal info + employment collection (same as smartphone)
  ↓
KYC: same flow as smartphone
  ↓
Credit Scoring: same scoring engine
  ↓
Digital Loan Product Selection (across all verified orgs)
  → System queries loan products for ALL verified organizations
  → Combined list shown to customer grouped by org (e.g., "Org A — Product 1, Product 2 | Org B — Product 3")
  → Customer selects one product from any of their orgs
  → Selected product determines amount range, rate, and terms
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
Cash disbursed to mobile wallet [BLOCKER: NOT BUILT]
  ↓
Status: 'active'
  ↓
Monthly repayments via PAY command [BLOCKER: not built]
  ↓
All payments complete → status: 'paid_off'
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
[ ] All DB migrations run on production RDS
[ ] Cognito groups created and staff accounts assigned
[ ] PAY command functional in WhatsApp
[ ] Digital loan disbursement flow working
[ ] Device unlock logic fixed (overdue-cleared, not full-payoff)
[ ] KYC 3-failure escalation implemented
[ ] Auto-default at 90 days scheduler running
[ ] Duplicate loan check includes 'disbursed' status
[ ] E2E test passed: smartphone loan journey
[ ] E2E test passed: digital loan journey
[ ] Payment reconciliation tested with national ID matching
[ ] Admin portal all pages functional
[ ] Distributor handover flow tested
```

---

---

## CREDIT SCORING MODEL OVERHAUL

### Context
The current scoring model relies heavily on data sources unavailable at launch (mobile money APIs, external credit bureaus, self-reported income). The revised model centers on **organization verification** as the primary signal, aligned with best practices from M-Kopa and GigMile in African alternative lending.

### Key Decisions
- **Self-reported income: REMOVED from scoring AND onboarding** — don't ask the question at all
- **Mobile money component: REMOVED** — no API access at launch
- **External credit: NOW sourced from organizations** (Excel/API upload, org-specific fields)
- **Org verification: PRIMARY signal** at 35% weight for all products
- **Unified scoring model** for both smartphone and digital loans
- **Unaffiliated smartphone customers: get NEUTRAL org score (50%)** — can still qualify but org-verified customers have clear advantage
- **Digital loans: org verification MANDATORY** — unaffiliated customers cannot get digital loans
- **Device collateral: uses RETAIL price** (not depreciated)

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

### Files to Modify

| File | Changes |
|------|---------|
| `services/scoring-service/src/scoring/scoring-engine.ts` | Rewrite component weights, remove mobile money + external credit components, add device collateral component, implement neutral org scoring for unaffiliated, set per-product thresholds |
| `services/scoring-service/src/handlers/calculate-score.ts` | Remove `monthly_income_usd` as required field, add `device_retail_price` for smartphones, update payload validation |
| `services/scoring-service/src/alternative-data.ts` | Remove mobile money analysis functions (dead code at launch) |
| `services/whatsapp-service/src/onboarding/states/employment-info.ts` | Remove income and debt collection questions. Only collect employment type + household size (for analytics). |
| `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` | Update scoring payload construction to remove income fields, add device price |
| `services/shared/utils/product-eligibility-resolver.ts` | Update eligibility matching with new thresholds |
| `database/migrations/001_initial_schema.sql` | credit_scores table columns still work (component names stay, values change) |

---

## KEY FILES REFERENCE

| Area | Critical Files |
|------|---------------|
| WhatsApp state machine | `services/whatsapp-service/src/onboarding/index.ts` |
| WhatsApp commands | `services/whatsapp-service/src/loan-commands.ts` |
| Loan offer/acceptance | `services/whatsapp-service/src/onboarding/states/loan-offer.ts` |
| KYC processing | `services/kyc-service/src/handlers/process-kyc-result.ts` |
| Credit scoring | `services/scoring-service/src/handlers/calculate-score.ts` |
| Payment initiation | `services/payment-service/src/handlers/initiate-payment.ts` |
| Payment completion | `services/payment-service/src/payment-service.ts:397-589` |
| Payment webhooks | `services/payment-service/src/handlers/webhook-ecocash.ts` |
| Device lock/unlock | `services/lock-service/src/lock-management-service.ts` |
| Fineract loan actions | `services/fineract-proxy-service/src/handlers/loan-actions.ts` |
| Notification scheduler | `services/notification-service/src/reminder-scheduler.ts` |
| Auth permissions | `frontend/apps/admin-portal/src/types/auth.ts` |
| Auth store | `frontend/apps/admin-portal/src/lib/store/auth-store.ts` |
| Admin loan pages | `frontend/apps/admin-portal/src/components/fineract/` |
| DB schema | `database/migrations/001_initial_schema.sql` |
| Advanced loan features | `database/migrations/020_advanced_loan_features.sql` |
| Inventory/lock triggers | `database/migrations/030_inventory_foundation.sql` |
| SQS queues | `infrastructure/aws/sqs-queues.yaml` |
| SAM template | `template.yaml` |
