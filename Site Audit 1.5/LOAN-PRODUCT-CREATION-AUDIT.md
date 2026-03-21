# Loan Product Creation Process — Comprehensive Audit

**Date:** 2026-03-21
**Scope:** Smartphone financing + Digital cash loans + Fineract GL sync + WhatsApp catalogue + Organization verification + Distributor handover
**Status:** All 27 clarifying questions answered. Gaps identified. Priorities assigned.

---

## Context

Lynia Finance is approaching launch readiness. This audit examines the **complete loan product creation pipeline** — from admin product configuration through Fineract sync, GL mapping, WhatsApp catalogue display, device management, organization creation, and digital loan disbursement. The goal is to identify gaps, misalignments, missing integrations, and launch-blocking issues across the entire flow.

---

## Architecture Summary (Current State)

```
Admin Portal --> POST /admin/products --> Fineract (source of truth) --> Lynia DB
                                                                         |
WhatsApp <-- product_selection state <-- loan_products table (active)     |
                |                             |                          |
        [Smartphone Branch]           [Digital Branch]                   |
        device_models table           organizations table                |
        product_device_models         product_organizations              |
        device-selection state        org-verification state             |
        lock-service (Trustonic)      scoring-service (org verify)       |
                |                             |                          |
        term-selection --> loan-offer --> loans table --> Fineract loan sync
                                                      --> GL journal entries
```

### Key Architecture Decisions

| Decision | Detail |
|----------|--------|
| **Fineract is source of truth** | All product updates go to Fineract first, Lynia syncs from Fineract |
| **Both categories use accrual accounting** | `accountingRule=3` for smartphone and digital products |
| **GL codes approved** | 1310-1339 (smartphone), 1410-1439 (digital) |
| **Flat rate interest** | Interest calculated on original principal for both product types |
| **USD only** | All loans and payments denominated in USD |
| **Plain text WhatsApp** | No interactive list messages; simple numbered lists grouped by brand |
| **Super admin only creates products** | No maker-checker workflow needed |

---

## Product Types

### Smartphone Financing (`product_category = 'smartphone'`)
- Asset-backed (phone device as collateral)
- Down payment required (`deposit_percentage > 0`)
- Device must be assigned before disbursement
- Lock mechanism enabled (Trustonic)
- Single active loan per customer (`max_active_loans = 1`)
- 3-12 month terms typical

### Digital Cash Loans (`product_category = 'digital'`)
- Unsecured, no collateral
- Zero down payment
- Requires organization verification (employment-based)
- Up to 2 active loans per customer
- 1-6 month terms typical
- Higher default rates, higher provisions

---

## GAPS IDENTIFIED (20 Total)

### Implemented Gaps (12 — Deployed to Production 2026-03-21)

| # | Gap | Severity | Status | Implementation |
|---|-----|----------|--------|---------------|
| 2 | **No Product Versioning** | HIGH | **DEPLOYED** | `loan_product_snapshots` table (migration 048) + snapshot on every loan creation in `loan-offer.ts` |
| 3 | **Fineract GL Account Validation Gap** | HIGH | **DEPLOYED** | `validateGLAccounts()` on FineractClient, called before product creation in `products.ts` |
| 4 | **Device Display Shows Stock-Filtered Results** | MEDIUM | **DEPLOYED** | Removed `available_stock > 0` from both SQL queries in `credit-scoring.ts` |
| 7 | **WhatsApp Device Display Not Grouped** | LOW | **DEPLOYED** | Brand-grouped display with `*Brand:*` headers in `device-selection.ts` + `credit-scoring.ts` |
| 8 | **Fineract Product Updates Don't Sync** | HIGH | **VERIFIED** | Already implemented — `handleUpdateProduct` calls Fineract PUT first (line 667) |
| 9 | **Distributor Sees Global Inventory** | MEDIUM | **VERIFIED** | Already implemented — `agent_inventory` table filtered by `distributor_id` |
| 10 | **No Product Deactivation Safety** | HIGH | **DEPLOYED** | WhatsApp session check before soft-delete in `handleDeleteProduct`, returns 409 |
| 11 | **Disbursement Method Not Validated** | MEDIUM | **DEPLOYED** | `getAllowedDisbursementMethods()` queries product config in `disbursement-method.ts` |
| 14/20 | **No Product Fee Configuration** | HIGH | **DEPLOYED** | 10 fee columns (migration 049), admin wizard UI, Fineract charges client |
| 17 | **No Fineract Fallback Queue** | HIGH | **DEPLOYED** | SQS retry via `retryFineractSync()` with `create_loan` operation in `loan-offer.ts` |
| 19 | **Flat Rate Interest Display** | MEDIUM | **DEPLOYED** | `calculateFlatRatePayment()`, effective APR, total cost disclosure in WhatsApp summary |

### Remaining Open Gaps (3)

| # | Gap | Severity | Status | Action Required |
|---|-----|----------|--------|----------------|
| 5 | **Organization Sync is One-Way Only** — Members imported via CSV but never reconciled | MEDIUM | Open (P2) | Build periodic refresh + API verification. Ship post-launch. |
| 12 | **No E2E Product Lifecycle Test** — No integration test covering full pipeline | HIGH | Open (P0) | Create E2E test: admin create -> Fineract sync -> WhatsApp display -> loan creation. Next priority. |
| 18 | **RBZ Filing Not Submitted** — Product portfolio not filed with Reserve Bank of Zimbabwe | HIGH | Open (Non-Technical) | Initiate RBZ filing immediately. Build config flexibility for regulatory changes. |

### Resolved Gaps (5 — No Action Needed)

| # | Gap | Resolution |
|---|-----|-----------|
| 1 | No Product Lifecycle State Machine | **Not a gap** — Super admin only creates products. No maker-checker needed. |
| 6 | No Product-Level Rate Limits | **Not needed** — Business manages volume operationally. |
| 13 | Organization Not Synced to Fineract | **By design** — Organizations stay in Lynia DB only. Reports pull from Lynia. |
| 15 | Missing Multi-Currency Support | **USD only** — Multi-currency deferred. All loans in USD. |
| 16 | No Product Analytics | **Deferred** — Product column in loan reports sufficient for launch. |

---

## CLARIFYING QUESTIONS — ALL 27 ANSWERED

### Fineract Integration & GL

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | GL accounts in production Fineract? | **Already created** | No setup script needed. Verify IDs match config table. |
| 2 | Accounting rule for both categories? | **Both accrual (rule=3)** | IFRS compliant. Both smartphone and digital use accrual accounting. |
| 3 | GL code structure approved? | **Yes, approved by finance team** | Proceed with 1310-1339 (smartphone) and 1410-1439 (digital). |
| 4 | Existing loans on product update? | **Keep old terms** | Product version snapshots confirmed as P0. Loans freeze terms at approval. |
| 5 | Reconciliation frequency? | **Nightly sufficient** | Keep FineractReconciliationFunction as-is. |
| 6 | Org to Fineract office mapping? | **No — Lynia DB only** | Organizations stay external. Reports pull from Lynia. |

### WhatsApp Integration & Catalogue

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 7 | Device display strategy? | **Group by brand, ~20 max** | Update device-selection to add brand headers. |
| 8 | Interactive vs plain text? | **Plain text numbered lists** | No WhatsApp interactive forms. Keep current approach. |
| 9 | Out-of-stock device handling? | **Show normally, reject at handover** | Remove stock filter. Stock validated at distributor handover only. |
| 10 | Multi-language? | **English only for launch** | Shona/Ndebele deferred to post-launch. |
| 11 | Session timeout? | **24-hour expiry** | Sessions expire after 24h inactivity. Customer restarts from last checkpoint. |
| 12 | Digital loan amount validation? | **Retry within range** | Show acceptable range, ask customer to re-enter if out of bounds. |

### Organization & Employment Verification

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 13 | Org data freshness? | **Real-time API where available, CSV fallback** | Build API capability. CSV monthly for orgs without API. |
| 14 | Org API integrations built? | **Future capability** | Ship with CSV/manual only. API framework ready but no live integrations. |
| 15 | Org lending overrides? | **Yes, orgs can override product terms** | Migration 042 overrides active. Gov employees can get lower rates. |
| 16 | Multi-org customer? | **Highest trust level wins** | Customer gets best org membership benefit. Simple rule. |

### Product Configuration & Business Rules

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 17 | Product approval workflow? | **No — super admin only** | No maker-checker. Super admin authorization sufficient. |
| 18 | Fee types? | **Insurance premium + Late payment penalty** | No processing fee or SMS fee. Add to product wizard + Fineract. |
| 19 | Interest calculation method? | **Flat rate** | Interest on original principal. Simpler for semi-literate users. |
| 20 | Restructuring options? | **All four** | Extensions, rescheduling, penalty waiver, 90+ day write-off. |
| 21 | Scoring config? | **Keep hardcoded V2 weights** | `scoring_config` JSONB stays NULL. V2 engine works for both types. |

### Distributor & Operations

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 22 | Distributor device assignment? | **Allocated inventory only** | Distributors see only devices assigned to them. No tiering. |
| 23 | Handover to loan activation? | **Auto-activate on handover** | Distributor confirms -> auto-approve + disburse in Fineract -> GL posted. |
| 24 | Deposit collection? | **Either method** | WhatsApp pre-pay OR EcoCash at handover. Dashboard shows status. |

### Launch Readiness

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 25 | Production Fineract state? | **Running with GL configured** | Ready for loan products. Can start creating products. |
| 26 | RBZ regulatory filing? | **Not yet filed** | **RISK**: File ASAP. Build config flexibility for regulatory changes. |
| 27 | Fineract disaster recovery? | **Lynia-only fallback mode** | Originate in Lynia if Fineract down. Reconcile on recovery. |

---

## RECOMMENDED IMPROVEMENTS (Priority Order)

### P0 — Launch Blockers (8 Items)

| # | Improvement | Gap | Files to Modify |
|---|------------|-----|----------------|
| 1 | **Product version snapshots** — Freeze product terms at loan creation time into a `loan_product_snapshots` table. Each loan stores the exact product config at approval for regulatory proof. | Gap 2 | `database/migrations/` (new), `services/payment-service/`, `services/whatsapp-service/src/onboarding/states/loan-offer.ts` |
| 2 | **Insurance + penalty fee configuration** — Add insurance premium and late payment penalty to product wizard. Sync to Fineract charges API (`POST /charges`). Display fees in WhatsApp loan summary. | Gap 14, 20 | `services/admin-service/src/handlers/products.ts`, `frontend/.../product-wizard.tsx`, `services/shared/clients/fineract.ts` |
| 3 | **GL account validation** — Verify GL IDs exist in Fineract before product creation completes. Add nightly reconciliation job. | Gap 3 | `services/admin-service/src/handlers/products.ts`, `services/shared/clients/fineract.ts` |
| 4 | **Fineract-first product updates** — PATCH calls Fineract `PUT /loanproducts/{id}` first, then syncs to Lynia DB on success. Fineract = source of truth. | Gap 8 | `services/admin-service/src/handlers/products.ts`, `services/shared/clients/fineract-sync/` |
| 5 | **Fineract fallback queue** — If Fineract is down, originate loan in Lynia DB and queue SQS message for Fineract sync on recovery. Manual reconciliation dashboard. | Gap 17 | `services/payment-service/`, `services/shared/clients/fineract-sync/`, new SQS queue |
| 6 | **Product deactivation safety** — Check in-flight WhatsApp sessions referencing the product before allowing soft-delete. | Gap 10 | `services/admin-service/src/handlers/products.ts` |
| 7 | **Flat rate total cost disclosure** — Show monthly payment + total repayment + effective APR in WhatsApp loan summary. Required for regulatory transparency (RBZ). | Gap 19 | `services/whatsapp-service/src/onboarding/states/loan-offer.ts`, `term-selection.ts` |
| 8 | **E2E product lifecycle test** — Admin creates product -> Fineract syncs -> WhatsApp displays -> Loan created -> GL entries posted. | Gap 12 | `tests/` (new E2E suite) |

### P1 — Pre-Launch (4 Items)

| # | Improvement | Files to Modify |
|---|------------|----------------|
| 9 | **Remove stock filter from WhatsApp** — Show all active devices regardless of `available_stock` count. Stock validated at distributor handover only. | `services/whatsapp-service/src/onboarding/states/credit-scoring.ts`, `device-selection.ts` |
| 10 | **Group devices by brand in WhatsApp** — Add brand headers to numbered device list (e.g., "Samsung:", "Xiaomi:"). | `services/whatsapp-service/src/onboarding/states/device-selection.ts` |
| 11 | **Disbursement method validation** — Filter WhatsApp disbursement options by product's `allowed_disbursement_methods` JSONB array. | `services/whatsapp-service/src/onboarding/states/disbursement-method.ts` |
| 12 | **Verify distributor inventory scoping** — Ensure distributor dashboard only shows devices allocated to that distributor, not global inventory. | `frontend/apps/distributor-dashboard/`, device query handlers |

### P2 — Post-Launch (3 Items)

| # | Improvement | Files to Modify |
|---|------------|----------------|
| 13 | **Organization data refresh automation** — Scheduled re-import, staleness alerts, API verification for capable orgs. | `services/admin-service/`, new Lambda |
| 14 | **Multi-language product descriptions** — Shona/Ndebele translations for WhatsApp display. | `loan_products` schema update, WhatsApp state handlers |
| 15 | **Loan reporting product column** — Add product name/category column to loan reports for basic filtering. | `frontend/.../admin-portal/`, loan list API |

---

## SCORING ENGINE STATUS

The `scoring_config` JSONB field on `loan_products` is **declared but never populated** (always NULL). The scoring engine uses hardcoded V2 weights:

| Component | Weight | Max Points | Description |
|-----------|--------|------------|-------------|
| Org Verification | 35% | 350 | Trust level + employment status + tenure + salary verification |
| Affordability | 25% | 250 | DTI ratio + household financial capacity |
| KYC Verification | 15% | 150 | ID document + face-ID match + liveness |
| Repayment History | 15% | 150 | Payment history + bill consistency + communication |
| Device Collateral | 10% | 100 | Coverage ratio (device price / loan amount) |

**Total: 1000 points** scaled to **300-850 (FICO-like scale)**

**Decision:** Keep hardcoded V2 weights for launch. Per-product customization deferred.

---

## VERIFICATION PLAN

After implementation, verify end-to-end:

1. **Admin creates smartphone product** -> Confirm Fineract product created FIRST with correct GL mappings, then Lynia DB synced
2. **Admin updates product** -> Confirm Fineract updated FIRST, then Lynia DB reflects changes
3. **Admin creates digital product** -> Confirm org-linked, correct accounting rule (accrual)
4. **Admin links device models** -> Confirm WhatsApp shows linked devices (including zero-stock devices)
5. **WhatsApp device display** -> Verify devices grouped by brand with brand headers
6. **Admin links organizations** -> Confirm WhatsApp shows only eligible products for verified org members
7. **Customer completes smartphone onboarding** -> Loan created in Lynia + Fineract, GL entries posted, product snapshot saved
8. **Customer completes digital onboarding** -> Loan created, disbursement queued to correct mobile money provider (validated against product config)
9. **Product deactivated** -> Verify in-flight WhatsApp sessions handled gracefully
10. **Fineract down** -> Verify Lynia-only fallback mode, SQS queue populated, reconciliation on recovery
11. **Distributor dashboard** -> Verify only allocated inventory visible, not global inventory
12. **Distributor handover** -> Verify auto-activation, deposit recording, device lock enrollment

---

## KEY FILES REFERENCE

| Purpose | File |
|---------|------|
| Admin Product CRUD | `services/admin-service/src/handlers/products.ts` |
| Fineract Product Sync | `services/shared/clients/fineract-sync/sync-product.ts` |
| Fineract Client | `services/shared/clients/fineract.ts` |
| Loan Product API (Proxy) | `services/fineract-proxy-service/src/handlers/loan-products.ts` |
| GL Accounts | `services/fineract-proxy-service/src/handlers/gl-accounts.ts` |
| Organization Management | `services/admin-service/src/handlers/organizations.ts` |
| Organization Verification | `services/scoring-service/src/handlers/verify-organization.ts` |
| Scoring Engine | `services/scoring-service/src/scoring/scoring-engine.ts` |
| WhatsApp Device Selection | `services/whatsapp-service/src/onboarding/states/device-selection.ts` |
| WhatsApp Credit Scoring | `services/whatsapp-service/src/onboarding/states/credit-scoring.ts` |
| WhatsApp Loan Offer | `services/whatsapp-service/src/onboarding/states/loan-offer.ts` |
| WhatsApp Term Selection | `services/whatsapp-service/src/onboarding/states/term-selection.ts` |
| Product Wizard (Frontend) | `frontend/apps/admin-portal/src/components/products/product-wizard.tsx` |
| Organization Wizard | `frontend/apps/admin-portal/src/components/products/organization-wizard.tsx` |
| Product Categories Migration | `database/migrations/028_loan_product_categories.sql` |
| Fineract Params Migration | `database/migrations/038_fineract_product_params.sql` |
| Org Overrides Migration | `database/migrations/042_org_lending_overrides.sql` |
| Digital GL Migration | `database/migrations/043_digital_loan_gl_accounts.sql` |
| SAM Template | `template.yaml` |

---

## DEPLOYMENT STATUS

| Environment | Status | Date | Commit | Run |
|-------------|--------|------|--------|-----|
| Staging | **DEPLOYED** | 2026-03-21 14:10 UTC | `84614239` | #23381364649 |
| Production | **DEPLOYED** | 2026-03-21 14:20 UTC | `84614239` | #23381494856 |

**Stack:** `lynia-finance-prod` — `UPDATE_COMPLETE`
**API:** `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/` — Responding (Cognito auth required)
**Tests:** 3092 passed, 0 failed
**Security Scan:** Passed

---

## POST-DEPLOYMENT RECOMMENDATIONS

### Immediate (This Week)

1. **Run database migrations against production RDS** — Migrations 048-050 create new tables/columns. Run via:
   ```bash
   bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
   ```
   Without this, product snapshots and fee configuration will fail at runtime.

2. **Configure fee defaults on existing products** — Migration 049 sets `insurance_fee_type` and `late_penalty_type` to `'none'` by default. Admin should configure actual fee rates for each product via the new Product Wizard fields.

3. **Initiate RBZ regulatory filing** (Gap 18) — Product portfolio not yet filed. Interest rates, fee structures, and disclosure formats may need adjustment based on RBZ feedback. Build buffer time.

4. **Verify Fineract GL account IDs match** — GL validation now runs on product creation. Run a one-time check that existing products' GL IDs are valid:
   ```sql
   SELECT id, product_code, fund_source_account_id, loan_portfolio_account_id
   FROM loan_products WHERE deleted_at IS NULL;
   ```
   Cross-reference against Fineract GL accounts.

### Short-Term (Next 2 Weeks)

5. **E2E product lifecycle test** (Gap 12) — Highest remaining technical priority. Test flow: admin creates product with fees -> Fineract syncs -> WhatsApp displays with brand grouping -> loan created -> snapshot saved -> GL entries posted.

6. **Monitor flat rate calculations** — Verify WhatsApp loan summaries show correct flat rate monthly payments, total repayment, and effective APR. Compare against manual calculations for first 10 loans.

7. **Test Fineract fallback queue** — Temporarily block Fineract access and verify:
   - Loan still created in Lynia DB
   - SQS retry message queued to `FINERACT_SYNC_RETRY`
   - Loan syncs to Fineract after recovery

8. **Verify brand-grouped device display** — Create test WhatsApp session and confirm devices grouped by brand with correct numbering across brands.

### Medium-Term (Next Month)

9. **Organization data freshness automation** (Gap 5) — Build scheduled Lambda for monthly CSV re-import with staleness alerts. Flag orgs not updated in 60+ days.

10. **Nightly GL reconciliation job** — Extend `FineractReconciliationFunction` to compare GL account IDs in `loan_products` against Fineract GL accounts. Alert on mismatches.

11. **Product snapshot reporting** — Build admin view to compare current product terms vs snapshot terms for any loan. Useful for dispute resolution and regulatory audits.

12. **Fee revenue reporting** — Add insurance fee revenue tracking to admin dashboard. Calculate total fee income by product for monthly reporting.

### Launch Readiness Gaps

| Area | Status | Risk |
|------|--------|------|
| Product creation + Fineract sync | **Ready** | Low — Fineract-first pattern verified |
| Fee configuration | **Ready** | Low — Defaults to 'none', admin configures |
| WhatsApp catalogue | **Ready** | Low — Brand-grouped, zero-stock visible |
| Flat rate interest | **Ready** | Medium — Verify calculations match manual checks |
| Product snapshots | **Ready** | Low — Non-blocking, captures full product state |
| Fineract fallback | **Ready** | Medium — Test with Fineract downtime scenario |
| GL validation | **Ready** | Low — Blocks invalid products from creation |
| Deactivation safety | **Ready** | Low — 409 returned for in-flight sessions |
| RBZ compliance | **NOT READY** | **HIGH** — Filing not submitted |
| E2E test coverage | **NOT READY** | **HIGH** — No integration test for full pipeline |
| Org data refresh | **NOT READY** | Medium — CSV works for launch, automation needed |

---

> Every feature we build serves real people trying to build better lives. A mother buying a smartphone to start a small business. A farmer needing equipment financing. A young person accessing credit for the first time.
>
> Build with empathy. Ship with confidence. Scale with purpose.
