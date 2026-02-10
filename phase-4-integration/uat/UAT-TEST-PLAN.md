# Lynia Finance - UAT Test Plan

**Document ID:** LYN-UAT-PLAN-001
**Version:** 1.0
**Date:** 2026-02-10
**Phase:** Phase 4 - Integration Testing & Production Deployment
**Task Reference:** P4-T012

---

## 1. Introduction

### 1.1 Purpose

This User Acceptance Testing (UAT) plan defines the approach, scope, resources, and schedule for validating that Lynia Finance meets all business requirements before production launch. UAT is the final verification gate ensuring the system serves Zimbabwe's underbanked population as intended.

### 1.2 Scope

UAT covers 8 critical business scenarios that represent the complete customer and operational lifecycle:

| # | Scenario | Primary Stakeholder | Priority |
|---|----------|-------------------|----------|
| 1 | New customer onboarding via WhatsApp (Shona) | Product / Operations | Critical |
| 2 | Loan application, scoring, and approval | Credit / Risk | Critical |
| 3 | Payment processing (EcoCash, OneMoney) | Finance / Operations | Critical |
| 4 | Device handover and activation | Operations / Distributors | Critical |
| 5 | Overdue payment -> device lock -> payment -> unlock | Collections / Risk | Critical |
| 6 | Admin dashboard workflow (loan review, approval) | Operations / Management | High |
| 7 | Distributor device inventory and commission tracking | Distribution / Finance | High |
| 8 | Regulatory report generation | Compliance / Legal | High |

### 1.3 Out of Scope

- Performance/load testing (covered by P4-T004)
- Security penetration testing (covered by P4-T006)
- Infrastructure/deployment verification (covered by P4-T008)
- InnBucks payment integration (Phase 5)
- ZAR currency support (Phase 5)

### 1.4 References

| Document | Location |
|----------|----------|
| E2E Test Suite | `tests/e2e/` |
| Compliance Verification Report | `phase-4-integration/compliance-verification-report.md` |
| Security Assessment Report | `phase-4-integration/security-assessment-report.md` |
| Service API Contracts | `tests/contract/` |
| Test Fixtures | `tests/fixtures/` |

---

## 2. UAT Environment

### 2.1 Environment Configuration

| Component | Configuration |
|-----------|--------------|
| Environment | Staging (production-like) |
| Database | Supabase staging instance with PgBouncer connection pooling |
| Auth | Supabase Auth with JWT validation |
| WhatsApp | Meta WhatsApp Cloud API (test business number) |
| KYC Provider | Smile Identity sandbox (`https://testapi.smileidentity.com`) |
| EcoCash | Sandbox (`https://sandbox.ecocash.co.zw`) |
| OneMoney | Sandbox (`https://sandbox.onemoney.co.zw`) |
| Device Lock | Trustonic sandbox environment |
| Admin Portal | Staging deployment (`https://staging-admin.lynia.co.zw`) |
| Distributor Dashboard | Staging deployment (`https://staging-distributor.lynia.co.zw`) |
| Lambda Functions | AWS staging account with SAM deployment |

### 2.2 Test Data Requirements

UAT uses production-like synthetic data. **No real customer data is used.**

| Data Type | Quantity | Source |
|-----------|----------|--------|
| Test customers (Zimbabwe) | 20 | Seeded via `pnpm db:seed` |
| Test customers (non-Zimbabwe) | 5 | Seeded via `pnpm db:seed` |
| Test devices (in_stock) | 15 | Seeded via `pnpm db:seed` |
| Test devices (assigned) | 10 | Seeded via `pnpm db:seed` |
| Active loans | 10 | Seeded via `pnpm db:seed` |
| Overdue loans (7+ days) | 3 | Seeded via `pnpm db:seed` |
| Completed loans | 5 | Seeded via `pnpm db:seed` |
| Payment history | 50+ transactions | Seeded via `pnpm db:seed` |
| Distributors | 3 | Seeded via `pnpm db:seed` |

### 2.3 Test User Accounts

| Role | Username | Purpose |
|------|----------|---------|
| Admin (Super) | `uat-admin@lynia.co.zw` | Full system access |
| Admin (Loan Officer) | `uat-loanofficer@lynia.co.zw` | Loan review/approval |
| Admin (Compliance) | `uat-compliance@lynia.co.zw` | Report generation |
| Distributor | `uat-distributor@lynia.co.zw` | Device management |
| Test Customer (Shona) | WhatsApp: `+263771000001` | Shona-language onboarding |
| Test Customer (English) | WhatsApp: `+263771000002` | English onboarding |
| Test Customer (Ndebele) | WhatsApp: `+263771000003` | Ndebele onboarding |

### 2.4 Device Requirements for Testing

| Device | Purpose |
|--------|---------|
| Samsung Galaxy A14 (low-end Android) | Target market device validation |
| Samsung Galaxy A24 (mid-range Android) | Standard device testing |
| Desktop/laptop with Chrome | Admin portal testing |
| Tablet (Android) | Field agent dashboard testing |

---

## 3. UAT Approach

### 3.1 Testing Methodology

UAT follows a **scenario-based testing** approach:

1. Each scenario represents a complete business workflow
2. Test cases within scenarios follow sequential steps mirroring real-world usage
3. Testers execute steps manually against the staging environment
4. Results are recorded as PASS, FAIL, or BLOCKED per test case
5. Failures generate bug reports with severity classification

### 3.2 Entry Criteria

All entry criteria must be met before UAT begins:

- [x] All E2E automated tests passing (P4-T001)
- [x] Security audit completed with no critical findings (P4-T006)
- [x] Compliance verification completed (P4-T007)
- [ ] Staging environment provisioned and accessible
- [ ] Test data seeded successfully
- [ ] All test user accounts created
- [ ] WhatsApp test business number configured
- [ ] Payment provider sandbox credentials verified

### 3.3 Exit Criteria

UAT is complete when ALL of the following are met:

- [ ] All 8 scenarios executed at least once
- [ ] All CRITICAL test cases pass (zero critical failures)
- [ ] All HIGH severity test cases pass
- [ ] No more than 3 MEDIUM severity open bugs
- [ ] All LOW severity bugs documented for backlog
- [ ] WhatsApp flows verified on low-end device (Samsung Galaxy A14)
- [ ] Multi-language support verified (English, Shona, Ndebele)
- [ ] Stakeholder sign-off obtained from all required signatories

### 3.4 Severity Classification

| Severity | Definition | Action Required |
|----------|-----------|-----------------|
| CRITICAL | System crash, data loss, payment failure, security breach | Must fix before go-live. Blocks UAT. |
| HIGH | Major feature broken, incorrect financial calculation, KYC failure | Must fix before go-live. |
| MEDIUM | Feature partially working, UI issues, minor workflow disruption | Fix within first sprint post-launch. |
| LOW | Cosmetic issues, minor UX improvements, edge cases | Add to backlog for future sprint. |

---

## 4. UAT Scenarios Summary

### Scenario 1: New Customer Onboarding via WhatsApp (Shona Language)

**Objective:** Validate that a new customer can complete registration via WhatsApp in Shona, including language selection, personal data collection, and KYC initiation.

**Preconditions:** WhatsApp test number active, Smile Identity sandbox ready.

**Key validations:**
- Language selection flow (English/Shona/Ndebele)
- Shona-language message templates render correctly
- Phone number validation (+263 prefix)
- National ID format validation (XX-XXXXXXXAXX)
- KYC document submission via WhatsApp
- Smile Identity verification callback processing
- Customer record creation in database

---

### Scenario 2: Loan Application, Scoring, and Approval

**Objective:** Validate the end-to-end loan application process from submission through credit scoring to approval decision.

**Preconditions:** Customer with verified KYC exists.

**Key validations:**
- Credit score calculation with all components (affordability, KYC, income, employment)
- Tier assignment (Tier 1/2/3 or Rejected)
- Auto-approve for high scores (>= 750)
- Manual review for medium scores (650-749)
- Auto-reject for low scores (< 650)
- Interest rate and down payment assignment per tier
- Credit limit enforcement
- Loan terms calculation (monthly payment, total repayment)

---

### Scenario 3: Payment Processing (EcoCash, OneMoney)

**Objective:** Validate deposit and installment payments via EcoCash and OneMoney mobile money platforms.

**Preconditions:** Approved loan exists, payment sandbox credentials configured.

**Key validations:**
- Payment initiation with correct amount and currency
- EcoCash USSD prompt delivery
- OneMoney USSD prompt delivery
- Payment callback processing
- Transaction status updates (pending -> completed/failed)
- Transaction receipt via WhatsApp
- Balance update after payment
- Transaction limit enforcement ($2,000 single, $5,000 daily, $50,000 monthly)
- Idempotency (duplicate payment prevention)

---

### Scenario 4: Device Handover and Activation

**Objective:** Validate the device handover workflow from readiness check through physical handover to activation.

**Preconditions:** Customer with approved loan, deposit paid, device in stock.

**Key validations:**
- Handover readiness check (loan approved, deposit paid, device available)
- Identity verification step
- Deposit verification step
- Device inspection step
- Device assignment to customer
- Device status update (in_stock -> assigned)
- Trustonic device activation
- Commission calculation (5% of device price)
- WhatsApp confirmation to customer

---

### Scenario 5: Overdue Payment -> Device Lock -> Payment -> Unlock

**Objective:** Validate the collections workflow including automated device locking for overdue payments and unlocking upon payment.

**Preconditions:** Active loan with overdue payment (7+ days), device assigned.

**Key validations:**
- Overdue detection (7+ days past due date)
- Payment reminder notifications via WhatsApp (Day 1, Day 3, Day 5)
- Automated device lock command via Trustonic (Day 7)
- Lock status update in database
- Lock notification to customer via WhatsApp
- Payment while device is locked
- Automated device unlock upon payment confirmation
- Unlock notification to customer
- Manual admin override unlock capability
- Audit trail for all lock/unlock actions

---

### Scenario 6: Admin Dashboard Workflow (Loan Review, Approval)

**Objective:** Validate the admin portal for loan officers to review, approve, and manage loan applications.

**Preconditions:** Admin user account, pending loan applications in system.

**Key validations:**
- Admin authentication (login/logout)
- Loan application list with filters and search
- Loan detail view with customer information and credit score
- Loan approval action with confirmation
- Loan rejection action with reason
- Customer detail view
- Payment history view
- Status indicators (color-coded: pending/approved/rejected/locked)
- Money formatting (USD with 2 decimal places, thousand separators)
- Date formatting (relative for recent, absolute for older)
- Responsive layout on desktop and tablet
- Keyboard navigation
- Data export (CSV/PDF)

---

### Scenario 7: Distributor Device Inventory and Commission Tracking

**Objective:** Validate the distributor dashboard for managing device inventory and tracking commissions.

**Preconditions:** Distributor account, devices assigned to distributor.

**Key validations:**
- Distributor authentication
- Device inventory list with stock counts
- Device status breakdown (in_stock, assigned, locked)
- Handover initiation workflow
- Commission calculation (5% of device retail price)
- Commission history and totals
- Commission payout status
- Device search by IMEI or serial number
- Inventory filtering and sorting

---

### Scenario 8: Regulatory Report Generation

**Objective:** Validate that all RBZ-required regulatory reports can be generated accurately.

**Preconditions:** Sufficient transaction data, compliance admin account.

**Key validations:**
- Loan portfolio summary report generation
- Delinquency report with PAR buckets (1-30, 31-60, 61-90, 90+ days)
- KYC compliance report (verification rates, processing times)
- Suspicious Transaction Report (STR) generation within 24 hours
- Monthly transaction aggregate report
- Report data accuracy against database records
- Report export in required format
- Report submission tracking (generated -> reviewed -> submitted)
- Record retention compliance (7yr transactions, 10yr KYC, 5yr audit)

---

## 5. Roles and Responsibilities

| Role | Person/Team | Responsibilities |
|------|-------------|-----------------|
| UAT Lead | Product Manager | Overall UAT coordination, schedule, sign-off |
| Test Executors | Operations Team | Execute test scenarios 1-5 |
| Test Executors | Finance Team | Execute test scenarios 3, 6, 8 |
| Test Executors | Distribution Team | Execute test scenario 7 |
| Test Executors | Compliance Team | Execute test scenario 8 |
| Development Lead | Engineering | Bug fixes, environment support |
| QA Support | QA Team | Test case review, defect management |

---

## 6. Schedule

| Activity | Target Date | Duration |
|----------|------------|----------|
| UAT environment setup | 2026-02-10 | 1 day |
| Test data seeding | 2026-02-10 | 0.5 day |
| UAT Cycle 1 execution | 2026-02-11 - 2026-02-13 | 3 days |
| Bug fix sprint | 2026-02-13 - 2026-02-14 | 2 days |
| UAT Cycle 2 (regression) | 2026-02-14 - 2026-02-15 | 1 day |
| Final bug verification | 2026-02-15 | 0.5 day |
| Stakeholder sign-off | 2026-02-15 | 0.5 day |

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| WhatsApp sandbox rate limiting | Test delays | Medium | Pre-register test numbers, batch test executions |
| EcoCash/OneMoney sandbox downtime | Cannot test payments | Medium | Schedule payment tests with provider uptime windows |
| Smile Identity sandbox latency | KYC tests slow | Low | Use cached responses for repeat tests |
| Stakeholder unavailability | Sign-off delay | Medium | Schedule sign-off meetings in advance |
| Critical bugs found | UAT blocked | Low | Development team on standby for hot fixes |
| Low-end device unavailability | Cannot validate target market | Low | Procure test devices in advance |

---

## 8. Deliverables

| Deliverable | Document | Status |
|-------------|----------|--------|
| UAT Test Plan | `phase-4-integration/uat/UAT-TEST-PLAN.md` | Complete |
| UAT Test Cases | `phase-4-integration/uat/UAT-TEST-CASES.md` | Complete |
| UAT Environment Setup | `phase-4-integration/uat/UAT-ENVIRONMENT-SETUP.md` | Complete |
| UAT Execution Report | `phase-4-integration/uat/UAT-EXECUTION-REPORT.md` | Template Ready |
| UAT Bug Tracker | `phase-4-integration/uat/UAT-BUG-TRACKER.md` | Template Ready |
| Stakeholder Sign-off | `phase-4-integration/uat/UAT-STAKEHOLDER-SIGNOFF.md` | Template Ready |

---

## 9. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | _________________ | __________ | __________ |
| Engineering Lead | _________________ | __________ | __________ |
| Operations Lead | _________________ | __________ | __________ |
| Compliance Officer | _________________ | __________ | __________ |

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Engineering | Initial UAT test plan |
