# Credit Scoring Architecture

**Last Updated**: 2026-03-04 (v2 — scoring threshold + duplicate loan check)

This document describes the credit scoring algorithm, its data pipeline, tier system, and integration with the WhatsApp onboarding flow and Fineract core banking.

---

## Table of Contents

1. [Overview](#overview)
2. [Scoring Algorithm](#scoring-algorithm)
3. [Component Deep Dive](#component-deep-dive)
4. [Data Pipeline — WhatsApp Onboarding](#data-pipeline--whatsapp-onboarding)
5. [Tier System & Credit Limits](#tier-system--credit-limits)
6. [Fineract Integration](#fineract-integration)
7. [Customer Identity & Deduplication](#customer-identity--deduplication)
8. [Organization Verification (Digital Loans)](#organization-verification-digital-loans)
9. [Safety Mechanisms](#safety-mechanisms)
10. [Deferred Components](#deferred-components)

---

## Overview

Lynia Finance uses a **rule-based credit scoring model** designed for Zimbabwe's underbanked population. The algorithm produces a raw score (0-1000) scaled to a FICO-like range (300-850), which maps to credit tiers with specific limits, down payments, and interest rates.

**Key design decisions:**
- **Minimum score threshold (350)** — applicants scoring below 350 are rejected. Above 350, the tier system controls risk exposure with graduated limits.
- **Duplicate loan prevention** — customers with an active loan (approved/paid_deposit/active) are blocked from applying again, checked by national ID to catch re-registrations with different phone numbers.
- **Neutral scores for missing data** — first-time customers without history receive middle-of-range scores (not zero), preventing false rejections in a thin-file market.
- **Declining balance payment formula** for DTI calculations, matching real loan repayment schedules.

### Architecture Flow

```
WhatsApp Bot → Collects data (11 states) → Scoring Service API → scoring-engine.ts (pure functions)
                                                 ↓
                                          credit_scores table → Fineract sync (async)
                                                 ↓
                                          Tier assignment → Device selection → Loan creation
```

### Key Files

| File | Purpose |
|------|---------|
| `services/scoring-service/src/scoring/scoring-engine.ts` | Pure scoring functions (no I/O) |
| `services/scoring-service/src/scoring/types.ts` | All scoring type definitions |
| `services/scoring-service/src/handlers/calculate-score.ts` | API handler: POST /scoring/calculate |
| `services/scoring-service/src/handlers/verify-organization.ts` | API handler: POST /scoring/verify-organization |
| `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` | WhatsApp flow: builds scoring payload, calls API |
| `services/shared/utils/loan-calculator.ts` | Declining balance payment calculation |

---

## Scoring Algorithm

### Score Composition

The algorithm sums 5 (or 6) components, each scoring on its own scale, then weighted to a total of **1000 points**.

#### Smartphone Loans (5-component model)

| Component | Weight | Max Points | Data Source |
|-----------|--------|-----------|-------------|
| Affordability | 30% | 300 | WhatsApp income/expense questions |
| Repayment Willingness | 25% | 250 | Loan/payment history from DB |
| Mobile Money Activity | 20% | 200 | Mobile money API (deferred) |
| External Credit | 15% | 150 | Credit bureau/platform APIs (deferred) |
| KYC Verification | 10% | 100 | DIDIT KYC provider |

#### Digital Loans (6-component model)

For digital loans, weights are redistributed to include organization verification:

| Component | Weight | Max Points | Change from Smartphone |
|-----------|--------|-----------|----------------------|
| Affordability | 30% | 300 | Same |
| Repayment Willingness | 25% | 250 | Same |
| Mobile Money Activity | 10% | 100 | Reduced from 200 |
| External Credit | 5% | 50 | Reduced from 150 |
| KYC Verification | 10% | 100 | Same |
| Org Verification | 20% | 200 | **New component** |

### Score Scaling

```
Raw Score: 0–1000 (sum of weighted components)
Scaled Score: 300–850 (FICO-like)
Formula: scaled = 300 + (raw / 1000) * 550
```

---

## Component Deep Dive

### Component 1: Affordability (300 points)

Assesses whether the customer can afford monthly loan installments.

**Sub-factors:**

| Sub-factor | Max Points | Logic |
|-----------|-----------|-------|
| Debt-to-Income Ratio | 150 | Uses declining balance formula with 12-month term at 5% APR |
| Income Level | 100 | Tiered: $500+ → 100, $300+ → 75, $150+ → 50, $100+ → 25 |
| Household Financial Stress | 50 | Income per person: $100+ → 50, $75+ → 35, $50+ → 20 |

**DTI Calculation:**
```
monthlyPayment = decliningBalancePayment(loan_amount, 5% APR, 12 months)
totalObligations = existing_debt + monthlyPayment
DTI = totalObligations / monthly_income
```

| DTI Ratio | Points |
|-----------|--------|
| ≤ 30% | 150 (Ideal) |
| ≤ 40% | 120 (Acceptable) |
| ≤ 50% | 80 (Risky) |
| ≤ 60% | 40 (Very risky) |
| > 60% | 0 (Cannot afford) |

**Data source:** Collected during WhatsApp onboarding states `income_collection` and `employment`.

### Component 2: Repayment Willingness (250 points)

Assesses payment behavior from prior loan history.

**Sub-factors:**

| Sub-factor | Max Points | Logic |
|-----------|-----------|-------|
| Historical Repayment Rate | 150 | on_time_rate: ≥95% → 150, ≥85% → 120, ≥75% → 80, ≥60% → 40 |
| Bill Payment Consistency | 50 | Same metric as on_time_rate (best available proxy) |
| Communication Responsiveness | 50 | Default 0.75 (neutral — no WhatsApp tracking yet) |

**First-time customers:** Return **125 points** (neutral, 50% of max). This prevents new borrowers from being penalized for having no history.

**Returning customers:** The system queries the `loans` and `payments` tables:
```sql
-- Loan stats
SELECT COUNT(*) as loan_count, SUM(missed_payments_count) as total_missed
FROM loans WHERE customer_id = $1 AND status IN ('active', 'paid_off', 'defaulted', 'disbursed')

-- Payment stats
SELECT COUNT(*) as confirmed_payments
FROM payments WHERE customer_id = $1 AND payment_type = 'installment' AND status = 'confirmed'

-- on_time_rate = confirmed_payments / (confirmed_payments + total_missed)
```

**Data source:** Queried from database in `credit-scoring.ts` → `fetchRepaymentHistory()`.

### Component 3: Mobile Money Activity (200 points)

Uses mobile money transaction patterns as an income and financial stability proxy.

**Sub-factors:**

| Sub-factor | Max Points | Criteria |
|-----------|-----------|----------|
| Account Age | 40 | 24+ months → 40, 12+ → 30, 6+ → 20, <6 → 10 |
| Monthly Inflow | 70 | $500+ → 70, $300+ → 55, $150+ → 35, $75+ → 20, <$75 → 5 |
| Transaction Frequency (3m) | 40 | 100+ → 40, 50+ → 30, 20+ → 15, <20 → 5 |
| Airtime Purchases (3m) | 30 | 12+ → 30, 6+ → 20, 3+ → 10, <3 → 5 |
| Current Balance | 20 | $100+ → 20, $50+ → 15, $20+ → 10, <$20 → 5 |

**Status:** Returns **100 points** (neutral, 50% of max) — no mobile money API integration yet. See [Deferred Components](#deferred-components).

### Component 4: External Credit (150 points)

Leverages credit bureau scores, gig platform data, and bank account verification.

**Sub-factors:**

| Sub-factor | Max Points | Criteria |
|-----------|-----------|----------|
| Credit Bureau Score | 80 | 750+ → 80, 700+ → 65, 650+ → 50, 600+ → 30, <600 → 10, null → 40 |
| Platform Integration (Bolt/Uber) | 40 | Verified + earnings + rating |
| Bank Account Verification | 30 | Verified + account age |

**Status:** Returns **75 points** (neutral, 50% of max) — no external credit API integrations yet. See [Deferred Components](#deferred-components).

### Component 5: KYC Verification (100 points)

Scores identity verification quality from the DIDIT KYC provider.

**Sub-factors:**

| Sub-factor | Max Points | Criteria |
|-----------|-----------|----------|
| ID Document Verification | 50 | verified → 50, review → 25, failed → 0 |
| Face-ID Match Score | 35 | ≥95 → 35, ≥85 → 25, ≥75 → 15, <75 → 0 |
| Liveness Check | 15 | passed → 15, failed → 0 |

**Data source:** Real KYC data from `kyc_submissions` table, populated by the DIDIT provider during the KYC upload state.

**Safety:** If no KYC submission exists, scoring is **blocked entirely** — the system returns an error message instead of defaulting to "verified".

### Component 6: Organization Verification (200 points, digital loans only)

Scores employer/organization membership for digital salary-backed loans.

**Sub-factors:**

| Sub-factor | Max Points | Criteria |
|-----------|-----------|----------|
| Organization Trust Level | 80 | ≥80 → 80 (Govt), ≥60 → 60 (Corporate), ≥40 → 40 (Cooperative), <40 → 20 |
| Employment Status | 50 | active → 50, retired → 25, suspended → 0 |
| Employment Tenure | 40 | 5+ years → 40, 2-5y → 30, 1-2y → 20, <1y → 10 |
| Salary Verification | 30 | verified → 30, not → 0 |

**Data source:** Organization lookup via `POST /scoring/verify-organization` using SHA-256 hashed national ID against the `organization_members` table.

---

## Data Pipeline — WhatsApp Onboarding

The WhatsApp bot collects scoring data through an 11-state onboarding flow. Each state feeds specific data into the scoring payload.

### State Flow

```
welcome → phone_verification → name_collection → product_selection →
employment → income_collection → kyc_id_upload → kyc_selfie_upload →
kyc_processing → credit_scoring → device_selection → term_selection →
down_payment → loan_offer
```

### Data Collection by State

| State | Data Collected | Scoring Component |
|-------|---------------|-------------------|
| `phone_verification` | Phone number, country | Customer creation |
| `name_collection` | Full name | Customer record |
| `product_selection` | smartphone / digital_credit | `product_category` (weight selection) |
| `employment` | Employment type, employer | `employment_type` (stored for future use) |
| `income_collection` | Monthly income, expenses, dependents, household size | Affordability (300 pts) |
| `kyc_id_upload` | National ID number, ID photo | KYC Verification (100 pts), Identity dedup |
| `kyc_selfie_upload` | Selfie photo | KYC Verification (face match, liveness) |
| `credit_scoring` | *Queries DB for repayment history* | Repayment Willingness (250 pts) |

### Scoring Payload Assembly

The `credit-scoring.ts` state handler assembles the full payload:

```typescript
{
  customer_id: session.customer_id,
  product_category: 'smartphone' | 'digital',     // Mapped from selected_product
  monthly_income_usd: <validated, no defaults>,
  existing_debt_obligations_usd: <session or 0>,
  household_size: <validated, no defaults>,
  dependents: <session or 0>,
  requested_loan_amount: <validated, no defaults>,
  employment_type: session.state_data.employment_type,
  kyc_result: {
    id_verification: { status: 'verified' | 'review' | 'failed' },
    face_match_score: <from kyc_submissions, default 0>,
    liveness_passed: <liveness_score >= 50>,
  },
  // Only for returning customers with previous_loans_count > 0:
  previous_loans_count: <from loans table>,
  on_time_payment_rate: <calculated from payments>,
  bill_payment_consistency: <same as on_time_rate>,
  communication_response_rate: 0.75,
}
```

---

## Tier System & Credit Limits

Applicants must score **≥ 350** to be approved. Below 350, the application is rejected. Above 350, the score determines the tier, which controls risk exposure.

| Tier | Scaled Score | Credit Limit | Down Payment | Interest Rate | Decision |
|------|-------------|-------------|--------------|---------------|----------|
| Tier 3 (Best) | ≥ 650 | $2,000 | 10% | 3% APR | Approve |
| Tier 2 (Standard) | 500–649 | $500 | 20% | 4% APR | Approve |
| Tier 1 (Starter) | 350–499 | $200 | 30% | 5% APR | Approve |
| Below Minimum | < 350 | $0 | — | — | **Reject** |

### Rejection Handling

When a customer scores below 350, the WhatsApp flow:
1. Informs them they don't qualify at this time
2. Suggests ways to improve (build payment history, reduce existing debt, ensure KYC documents are clear)
3. Session ends — no device selection or loan creation

### Duplicate Loan Check

Before scoring, the system checks for existing active loans by **national ID** (not customer_id):

```sql
SELECT id FROM loans l
JOIN customers c ON l.customer_id = c.id
WHERE c.national_id = :national_id
AND l.status IN ('approved', 'paid_deposit', 'active')
```

If found, the application is rejected immediately with: "You already have an active loan. Please complete your current loan before applying for a new one."

This check uses national ID to catch re-registrations with different phone numbers.

### Typical First-Time Customer Score

A first-time customer with $300/month income, no debt, household of 3, requesting $200:

| Component | Raw | Weighted | Notes |
|-----------|-----|----------|-------|
| Affordability | ~225/300 | 225 | Good DTI, moderate income |
| Repayment | 125/250 | 125 | Neutral (first-timer) |
| Mobile Money | 100/200 | 100 | Neutral (no data) |
| External Credit | 75/150 | 75 | Neutral (no data) |
| KYC | ~85/100 | 85 | Verified with good match |
| **Total** | | **610** | Scaled: ~636 → **Tier 2** |

---

## Fineract Integration

Apache Fineract is the core banking system that manages loan lifecycle after scoring.

### Sync Flow

```
Scoring API (approve) → Async customer sync to Fineract → Fineract client created
                                                              ↓
WhatsApp (terms accepted) → INSERT INTO loans (status='approved')
                          → Loan sync to Fineract (create + auto-approve)
                                                              ↓
Customer pays deposit → Payment webhook → deposit-resolver matches by national ID
                      → loans.status → 'paid_deposit'
                                                              ↓
Distributor handover → Verify deposit → Complete handover → Device lock stub
                     → loans.status → 'active' → Fineract disbursement
                                                              ↓
Payment received → Payment sync → Fineract repayment recorded
```

### Integration Points

1. **Customer sync** (non-blocking, after scoring): Creates a Fineract client record with name and phone number.
2. **Loan record creation** (after terms acceptance): `INSERT INTO loans` with status `'approved'`, generates loan reference `LYNIA-2026-XXXXX`.
3. **Loan sync to Fineract** (after loan INSERT): Creates a Fineract loan account with the selected device, term, and payment schedule. Auto-approves in Fineract (no admin step).
4. **Deposit payment resolution** (on webhook): Matches deposit by national ID reference → transitions loan to `'paid_deposit'`.
5. **Distributor handover** (physical device collection): Verifies deposit payment, completes handover, records device lock intent, transitions loan to `'active'`, triggers Fineract disbursement.
6. **Payment sync** (on payment confirmation): Records repayments against the Fineract loan.
7. **Reconciliation job**: Catches any missed syncs and retries.

### Loan Lifecycle

```
approved → paid_deposit → active → paid_off
                                 → defaulted
```

| Status | Meaning | Trigger |
|--------|---------|---------|
| `approved` | Loan created after terms acceptance | WhatsApp onboarding completion |
| `paid_deposit` | Customer paid deposit | Payment webhook (national ID match) |
| `active` | Device handed over, repayments started | Distributor handover |
| `paid_off` | All installments paid | Final payment confirmation |
| `defaulted` | Missed payments beyond grace period | Overdue job |

The scoring service triggers customer sync asynchronously — if Fineract is down, the reconciliation job handles it later. Loan sync is deferred to post-terms-acceptance when the full loan details (device + term) are finalized.

---

## Customer Identity & Deduplication

### Problem

Customers in Zimbabwe frequently change phone numbers. Using phone as the primary identifier causes:
- Duplicate customer records
- Split loan history (returning customers scored as first-timers)
- Lost repayment track record

### Solution: National ID Deduplication

The `customers` table includes a `national_id` column (VARCHAR(20), UNIQUE constraint) that serves as the reliable identity anchor.

**Deduplication flow during KYC verification:**

```
KYC verified → Extract national_id from session
            → Query: SELECT id FROM customers WHERE national_id = X AND id != current_id
            → If found: Merge to existing customer (update whatsapp_number, delete duplicate)
            → If not found: Store national_id on current customer
```

This ensures:
- Returning customers (new phone) are merged to their existing record
- Loan history follows the person, not the phone number
- Repayment scores reflect true history

**Privacy:** For organization lookups, national IDs are stored as SHA-256 hashes (`national_id_hash`) in the `organization_members` table. The plaintext national_id is only stored on the `customers` table (with column-level access controls).

See: `services/shared/utils/crypto.ts` → `hashNationalId()`

---

## Organization Verification (Digital Loans)

Digital loans are backed by employer/organization membership. The verification flow:

```
POST /scoring/verify-organization { national_id: "63-1234567B08" }
  → Hash national_id (SHA-256)
  → Lookup organization_members by national_id_hash
  → Fetch organization details (trust level, type)
  → Calculate tenure from employment_start_date
  → Return: { found, org_name, scoring_trust_level, employment_status, tenure_months, salary_verified }
```

The result feeds into Component 6 (Organization Verification, 200 points) which replaces weight from Mobile Money and External Credit in the digital loan model.

---

## Safety Mechanisms

### 1. Fail-Fast Validation

Required fields (`monthly_income_usd`, `requested_loan_amount`, `household_size`) are validated before payload construction. Missing fields return an error message — no dangerous defaults.

### 2. KYC Rejection Safety

If no KYC submission exists in the database, scoring is **blocked entirely**. The system returns:
> "Your identity verification is incomplete. Please complete the KYC process before we can assess your application."

Previously, missing KYC defaulted to `{ status: 'verified', face_match_score: 96 }` — a fraud risk.

### 3. No Dangerous Defaults

- `face_match_score` defaults to **0** (not 96) when unknown
- `monthly_income_usd` has **no fallback** (was previously defaulting to $200)
- `requested_loan_amount` has **no fallback** (was previously defaulting to $250)
- Only legitimate zero-states use defaults: `existing_debt_obligations_usd ?? 0`, `dependents ?? 0`

### 4. Minimum Score Threshold

Applicants scoring below 350 are rejected outright. This prevents lending to high-risk applicants who would likely default. The threshold was introduced to replace the previous "approve everyone" policy.

### 5. Duplicate Loan Prevention

Before scoring, the system checks for existing active loans by national ID. A customer with an active loan (`approved`, `paid_deposit`, or `active` status) is blocked from applying again, preventing multiple simultaneous loans.

### 6. Scoring Service Unavailability

If the scoring API is unreachable, the WhatsApp flow does **not** auto-approve. The session stays in `credit_scoring` state so the customer can retry.

---

## Deferred Components

Two scoring components are fully implemented in the engine but have no live data integration yet:

### Mobile Money Activity (20% weight)

**Current state:** Returns neutral score (100/200 = 50%).
**Integration needed:** EcoCash/OneMoney API to pull transaction history, account age, and balance data.
**Impact when connected:** 200 additional points of signal, replacing the neutral default.

### External Credit Data (15% weight)

**Current state:** Returns neutral score (75/150 = 50%).
**Integration needed:**
- Zimbabwe credit bureau API (TransUnion/Experian)
- Bolt/Uber driver verification API
- Bank account verification API
**Impact when connected:** 150 additional points of signal, enabling credit bureau cross-checks and gig economy income validation.

Together, these two components represent **35% of the smartphone loan score** that currently returns neutral values. Connecting them would significantly improve scoring accuracy and differentiation between applicants.
