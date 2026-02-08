# Pre-Phase 3 GitHub Issues

**Project:** Lynia Finance
**Created:** January 30, 2026
**Total Issues:** 6
**Import Format:** GitHub/Linear Compatible

---

## Issue #1: PRE-P3-001 - Deploy Database Schema to Supabase

### Metadata
| Field | Value |
|-------|-------|
| **Title** | PRE-P3-001: Deploy Database Schema to Supabase |
| **Priority** | 🔴 Critical |
| **Estimate** | 2 hours |
| **Labels** | `priority: critical`, `phase: pre-phase-3`, `type: infrastructure` |
| **Milestone** | Pre-Phase 3 |
| **Blocks** | P3-T002, P3-T003, P3-T004, P3-T005, P3-T006, P3-T007 |

### Description

Deploy the complete database schema (35+ tables) from Phase 2 to the production Supabase instance. This is a critical blocker for all Phase 3 frontend development.

### Prerequisites

- [ ] Supabase project created
- [ ] Service role key obtained
- [ ] Network access confirmed

### Tasks

- [ ] Set up Supabase environment variables
  ```bash
  export SUPABASE_URL="https://your-project.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  ```
- [ ] Run database deployment script
  ```bash
  node database/deploy-database.js
  ```
- [ ] Verify deployment with verification script
  ```bash
  node database/verify-deployment.js
  ```
- [ ] Confirm all 35+ tables created
- [ ] Test basic CRUD operations
- [ ] Document connection details in `.env.example`

### Acceptance Criteria

- [ ] All migrations (001, 002, 003) applied successfully
- [ ] Tables verified: customers, loans, payments, devices, kyc_verifications
- [ ] Row Level Security (RLS) policies active
- [ ] Indexes created for performance

### Technical Details

**Migration Files:**
- `database/migrations/001_initial_schema.sql`
- `database/migrations/002_add_distributor_commissions.sql`
- `database/migrations/003_add_trustonic_fields.sql`

**Scripts:**
- Deployment: `database/deploy-database.js`
- Verification: `database/verify-deployment.js`

### Related Documents

- `infrastructure/task-reports/P2-T002-PROGRESS.md`
- `planning/architecture/database-schema.md`

---

## Issue #2: PRE-P3-002 - Deploy Lambda Functions to AWS

### Metadata
| Field | Value |
|-------|-------|
| **Title** | PRE-P3-002: Deploy Lambda Functions to AWS |
| **Priority** | 🔴 Critical |
| **Estimate** | 3 hours |
| **Labels** | `priority: critical`, `phase: pre-phase-3`, `type: infrastructure` |
| **Milestone** | Pre-Phase 3 |
| **Depends On** | PRE-P3-001 |
| **Blocks** | P3-T002, P3-T003, P3-T004, P3-T005, P3-T006, P3-T007, P3-T011, P3-T012 |

### Description

Deploy all 6 Lambda microservices to AWS using SAM CLI. The frontend cannot make API calls until these services are live.

### Services to Deploy

| Service | Function Name | API Endpoint |
|---------|--------------|--------------|
| WhatsApp Service | lynia-whatsapp-service | `/api/whatsapp/*` |
| Scoring Service | lynia-scoring-service | `/api/scoring/*` |
| KYC Service | lynia-kyc-service | `/api/kyc/*` |
| Payment Service | lynia-payment-service | `/api/payments/*` |
| Lock Service | lynia-lock-service | `/api/devices/*` |
| Notification Service | lynia-notification-service | `/api/notifications/*` |

### Prerequisites

- [ ] PRE-P3-001 completed (database deployed)
- [ ] AWS CLI configured with credentials
- [ ] SAM CLI installed
- [ ] Environment variables configured

### Tasks

- [ ] Configure AWS credentials
  ```bash
  aws configure
  ```
- [ ] Set environment variables in `env.json`
- [ ] Build SAM application
  ```bash
  sam build
  ```
- [ ] Validate SAM template
  ```bash
  sam validate
  ```
- [ ] Deploy to staging environment
  ```bash
  ./scripts/deploy-staging.sh
  ```
- [ ] Verify all 6 functions deployed
  ```bash
  aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'lynia')]"
  ```
- [ ] Test each endpoint with smoke tests
- [ ] Document API Gateway URL

### Acceptance Criteria

- [ ] All 6 Lambda functions deployed and running
- [ ] API Gateway endpoints accessible
- [ ] Environment variables configured correctly
- [ ] CloudWatch logging enabled
- [ ] Basic health checks passing for all endpoints

### Technical Details

**SAM Template:** `template.yaml`
**Config:** `samconfig.toml`
**Deploy Script:** `scripts/deploy-staging.sh`

### Related Documents

- `infrastructure/task-reports/P2-T013-PROGRESS.md`
- `infrastructure/task-reports/P2-T003-PROGRESS.md`

---

## Issue #3: PRE-P3-003 - Create P2-T008 Progress Report

### Metadata
| Field | Value |
|-------|-------|
| **Title** | PRE-P3-003: Create P2-T008 Progress Report (Payment Service) |
| **Priority** | 🔴 Critical |
| **Estimate** | 1 hour |
| **Labels** | `priority: critical`, `phase: pre-phase-3`, `type: documentation` |
| **Milestone** | Pre-Phase 3 |
| **Blocks** | P3-T005 (Payment Management) |

### Description

Document the Mobile Money Payment Service implementation that was completed during Phase 2 but never formally documented. The payment service code exists but has no progress report.

### Background

During Phase 2, the payment service was implemented with EcoCash and OneMoney integrations, but the progress report (`P2-T008-PROGRESS.md`) was never created. This creates a documentation gap that must be resolved before Phase 3 Payment Management work begins.

### Files to Review

- `/services/payment-service/src/index.ts`
- `/services/payment-service/src/handlers/`
- `/services/payment-service/src/providers/`
- `/planning/payment-processing/payment-gateway-integration.md`
- `/research/task-summaries/payments/`

### Tasks

- [ ] Review payment-service source code
- [ ] Document EcoCash integration status
- [ ] Document OneMoney integration status
- [ ] List all payment API endpoints
- [ ] Document webhook handlers
- [ ] Note any TODO items or limitations
- [ ] Create `infrastructure/task-reports/P2-T008-PROGRESS.md`

### Report Template

```markdown
# P2-T008: Mobile Money Payment Integration - Progress Report

## Task Overview
- **Task ID:** P2-T008
- **Title:** Mobile Money Payment Integration
- **Status:** ✅ Completed
- **Completion Date:** [Date]

## Implementation Summary
[Overview of what was implemented]

## EcoCash Integration
- Status: [Complete/Partial/Mock]
- Endpoints: [List]
- Testing: [Status]

## OneMoney Integration
- Status: [Complete/Partial/Mock]
- Endpoints: [List]
- Testing: [Status]

## API Endpoints
[Table of endpoints with request/response]

## Webhook Implementation
[Webhook handlers and flows]

## Known Issues & Limitations
[Any TODOs or limitations]

## Next Steps
[Recommendations for Phase 3]
```

### Acceptance Criteria

- [ ] Progress report follows standard format
- [ ] All payment methods documented (EcoCash, OneMoney)
- [ ] API endpoints listed with request/response examples
- [ ] Integration status clear (complete/partial/mock)
- [ ] File created at `infrastructure/task-reports/P2-T008-PROGRESS.md`

---

## Issue #4: PRE-P3-004 - Execute Test Suite

### Metadata
| Field | Value |
|-------|-------|
| **Title** | PRE-P3-004: Execute Test Suite |
| **Priority** | 🟡 High |
| **Estimate** | 1 hour |
| **Labels** | `priority: high`, `phase: pre-phase-3`, `type: testing` |
| **Milestone** | Pre-Phase 3 |
| **Depends On** | PRE-P3-002 |

### Description

Run the complete test suite to verify backend code quality before frontend integration. The test infrastructure was created in Phase 2 but tests were not actually executed.

### Test Coverage Targets

| Category | Target | Files |
|----------|--------|-------|
| Unit Tests | 80%+ | `services/*/tests/*.test.ts` |
| Integration Tests | 70%+ | `tests/integration/*.test.ts` |
| E2E Tests | Critical flows | `tests/e2e/*.test.ts` |

### Tasks

- [ ] Install test dependencies
  ```bash
  pnpm install
  ```
- [ ] Run unit tests
  ```bash
  pnpm run test
  ```
- [ ] Run integration tests
  ```bash
  pnpm run test:integration
  ```
- [ ] Generate coverage report
  ```bash
  pnpm run test -- --coverage
  ```
- [ ] Fix any failing tests
- [ ] Document test results

### Acceptance Criteria

- [ ] All unit tests passing
- [ ] Integration tests passing (or documented as expected failures)
- [ ] Coverage report generated
- [ ] Coverage meets 80%+ target
- [ ] No critical test failures
- [ ] Test results documented

### Related Documents

- `infrastructure/task-reports/P2-T012-PROGRESS.md`
- `tests/README.md`

---

## Issue #5: PRE-P3-005 - Create Demo Data

### Metadata
| Field | Value |
|-------|-------|
| **Title** | PRE-P3-005: Create Demo Data |
| **Priority** | 🟡 High |
| **Estimate** | 30 minutes |
| **Labels** | `priority: high`, `phase: pre-phase-3`, `type: data` |
| **Milestone** | Pre-Phase 3 |
| **Depends On** | PRE-P3-001 |

### Description

Populate the database with realistic demo data for testing and demonstration purposes. This enables frontend testing and stakeholder demos.

### Demo Data Requirements

| Entity | Count | Notes |
|--------|-------|-------|
| Customers | 20 | Various KYC statuses (pending, verified, rejected) |
| Loans | 15 | Active, paid off, defaulted statuses |
| Payments | 50 | Various statuses (completed, pending, failed) |
| Devices | 30 | Assigned, available, locked states |
| Distributors | 5 | With commission history |

### Customer Profiles to Create

| Profile | Credit Tier | KYC Status | Loan Status |
|---------|-------------|------------|-------------|
| New Customer | None | Pending | No loan |
| Verified - No Loan | Medium | Verified | No loan |
| Active Borrower | High | Verified | Active loan |
| Good Payer | High | Verified | Paid off |
| Delinquent | Low | Verified | Overdue |
| Defaulted | Low | Verified | Defaulted |

### Tasks

- [ ] Verify database is deployed (PRE-P3-001 complete)
- [ ] Review demo data creation script
- [ ] Run demo data creation
  ```bash
  node scripts/create-demo-data.js
  ```
- [ ] Verify data created correctly
- [ ] Test queries against demo data
- [ ] Document demo accounts for testing

### Acceptance Criteria

- [ ] 20 demo customers created with various credit tiers
- [ ] 15 loans created with different statuses
- [ ] 50 payments with realistic history
- [ ] 30 devices in various states
- [ ] 5 distributors with commission records
- [ ] Data is consistent and realistic
- [ ] Demo credentials documented

### Related Documents

- `infrastructure/demo/DEMO-STEPS.md`
- `scripts/create-demo-data.js`

---

## Issue #6: PRE-P3-006 - Create Environment Configuration Template

### Metadata
| Field | Value |
|-------|-------|
| **Title** | PRE-P3-006: Create Environment Configuration Template |
| **Priority** | 🟡 High |
| **Estimate** | 30 minutes |
| **Labels** | `priority: high`, `phase: pre-phase-3`, `type: documentation` |
| **Milestone** | Pre-Phase 3 |

### Description

Create a comprehensive `.env.example` file documenting all required environment variables for the project. This streamlines developer onboarding and deployment.

### Environment Variables to Document

```bash
# ===========================================
# LYNIA FINANCE - ENVIRONMENT CONFIGURATION
# ===========================================
# Copy this file to .env and fill in the values

# ---------------------
# SUPABASE (Database)
# ---------------------
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ---------------------
# AWS (Lambda/Infrastructure)
# ---------------------
AWS_REGION=af-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# ---------------------
# WHATSAPP CLOUD API
# ---------------------
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id

# ---------------------
# SMILE IDENTITY (KYC)
# ---------------------
SMILE_IDENTITY_API_KEY=your-api-key
SMILE_IDENTITY_PARTNER_ID=your-partner-id
SMILE_IDENTITY_ENVIRONMENT=sandbox

# ---------------------
# PAYMENT GATEWAYS
# ---------------------
# EcoCash
ECOCASH_MERCHANT_ID=your-merchant-id
ECOCASH_API_KEY=your-api-key
ECOCASH_ENVIRONMENT=sandbox

# OneMoney
ONEMONEY_MERCHANT_ID=your-merchant-id
ONEMONEY_API_KEY=your-api-key
ONEMONEY_ENVIRONMENT=sandbox

# ---------------------
# TRUSTONIC (Device Lock)
# ---------------------
TRUSTONIC_API_KEY=your-api-key
TRUSTONIC_PARTNER_ID=your-partner-id
TRUSTONIC_ENVIRONMENT=sandbox

# ---------------------
# APPLICATION
# ---------------------
NODE_ENV=development
API_BASE_URL=http://localhost:3000
LOG_LEVEL=debug

# ---------------------
# TWILIO (SMS Fallback)
# ---------------------
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Tasks

- [ ] Review all services for environment variables
- [ ] Create `.env.example` at project root
- [ ] Add comments explaining each variable
- [ ] Document which variables are required vs optional
- [ ] Group variables by service/integration
- [ ] Add to version control (not `.gitignore`)
- [ ] Update README with setup instructions

### Acceptance Criteria

- [ ] All environment variables documented
- [ ] Clear descriptions for each variable
- [ ] Variables grouped by service
- [ ] Required vs optional clearly marked
- [ ] File committed to repository
- [ ] README updated with reference

---

## Summary Table

| Issue | Title | Priority | Estimate | Dependencies |
|-------|-------|----------|----------|--------------|
| #1 | PRE-P3-001: Deploy Database to Supabase | 🔴 Critical | 2 hours | None |
| #2 | PRE-P3-002: Deploy Lambda Functions to AWS | 🔴 Critical | 3 hours | #1 |
| #3 | PRE-P3-003: Create P2-T008 Progress Report | 🔴 Critical | 1 hour | None |
| #4 | PRE-P3-004: Execute Test Suite | 🟡 High | 1 hour | #2 |
| #5 | PRE-P3-005: Create Demo Data | 🟡 High | 30 min | #1 |
| #6 | PRE-P3-006: Create Environment Config Template | 🟡 High | 30 min | None |

**Total Estimated Effort:** 8 hours

---

## Dependency Graph

```
PRE-P3-006 (Env Config) ─────────────────────────────► Independent

PRE-P3-003 (P2-T008 Doc) ────────────────────────────► Independent

PRE-P3-001 (Database) ───┬──► PRE-P3-005 (Demo Data)
                         │
                         └──► PRE-P3-002 (Lambda) ──► PRE-P3-004 (Tests)
```

---

## Linear Import Instructions

To import these issues into Linear:

1. Go to Linear → Settings → Import
2. Select "GitHub Issues" or "CSV Import"
3. Map the following fields:
   - Title → Issue Title
   - Priority → Priority (Critical = Urgent, High = High)
   - Estimate → Estimate (hours)
   - Labels → Labels
   - Milestone → Project

### Recommended Linear Project Structure

```
Project: Lynia Finance
└── Cycle: Pre-Phase 3
    ├── PRE-P3-001: Deploy Database
    ├── PRE-P3-002: Deploy Lambda
    ├── PRE-P3-003: P2-T008 Documentation
    ├── PRE-P3-004: Execute Tests
    ├── PRE-P3-005: Create Demo Data
    └── PRE-P3-006: Environment Config
```

---

**Document Version:** 1.0
**Created:** January 30, 2026
**Last Updated:** January 30, 2026
