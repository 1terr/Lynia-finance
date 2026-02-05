# Lynia Finance - Development Skills

> World-class fintech development workflows for Silicon Valley-grade engineering excellence.
> Every skill enforces Test-Driven Development (TDD), security-first design, and comprehensive code review.

---

## Quick Reference

| Category | Skills |
|----------|--------|
| **Product** | `/spec`, `/user-story`, `/design-review`, `/prd` |
| **TDD Workflow** | `/tdd`, `/test`, `/coverage`, `/e2e`, `/load-test` |
| **Development** | `/implement`, `/refactor`, `/api-design`, `/db-schema`, `/migration` |
| **Git Workflow** | `/commit`, `/hotfix`, `/changelog`, `/dependency-update` |
| **Code Review** | `/review`, `/pr-review`, `/security-review`, `/perf-review` |
| **DevOps** | `/deploy`, `/rollback`, `/health`, `/incident`, `/feature-flag` |
| **Security** | `/security-audit`, `/threat-model`, `/compliance`, `/pen-test`, `/audit-log` |
| **Documentation** | `/doc`, `/api-doc`, `/runbook`, `/postmortem`, `/onboard` |
| **Compliance** | `/data-export`, `/rbz-report`, `/mobile-money-test` |

---

## Product & Design Skills

### /spec
**Create Feature Specification**

Create a comprehensive feature specification following fintech standards.

```yaml
trigger: /spec <feature-name>
output: docs/specs/<feature-name>-spec.md
```

**Workflow:**
1. Gather requirements from user input
2. Research existing codebase for related functionality
3. Generate specification document with:
   - Problem statement & user impact
   - Success metrics (KPIs)
   - User stories with acceptance criteria
   - Technical approach
   - Security & privacy considerations
   - Accessibility requirements
   - Edge cases & error handling
   - Dependencies & risks
   - Test plan outline
4. Create test scenarios BEFORE implementation approach
5. Review against CLAUDE.md principles

**Template Structure:**
```markdown
# Feature: [Name]
## Problem Statement
## Success Metrics
## User Stories
## Security & Privacy Checklist
## Test Scenarios (TDD)
## Technical Approach
## Dependencies & Risks
## Timeline Estimate
```

---

### /user-story
**Generate User Stories with Acceptance Criteria**

Create BDD-style user stories with testable acceptance criteria.

```yaml
trigger: /user-story <feature-area>
output: User stories in Given-When-Then format
```

**Workflow:**
1. Identify user personas (Customer, Distributor, Admin, System)
2. Generate stories in format:
   ```gherkin
   Feature: [Feature Name]

   As a [persona]
   I want to [action]
   So that [benefit]

   Scenario: [Scenario Name]
     Given [precondition]
     When [action]
     Then [expected result]
     And [additional assertions]
   ```
3. Include edge cases and error scenarios
4. Map to test cases for TDD implementation
5. Prioritize using MoSCoW method

---

### /design-review
**UI/UX Design Review for Fintech**

Review designs against fintech UX standards and accessibility requirements.

```yaml
trigger: /design-review <figma-url-or-description>
output: Design review report with actionable feedback
```

**Review Checklist:**
```markdown
## Accessibility (WCAG 2.1 AA)
[ ] Color contrast ratio >= 4.5:1
[ ] Touch targets >= 44x44px
[ ] Keyboard navigation support
[ ] Screen reader compatibility
[ ] Focus indicators visible

## Fintech UX Patterns
[ ] Money displayed with currency symbol, 2 decimals, separators
[ ] Status colors: Pending (yellow), Success (green), Error (red), Warning (orange)
[ ] Destructive actions require confirmation
[ ] Transaction receipts clearly formatted
[ ] Loading states for all async operations

## Mobile & Low-Bandwidth
[ ] Works on 3G connections
[ ] Responsive down to 320px width
[ ] Images optimized and lazy-loaded
[ ] Skeleton loaders for data tables

## Trust & Security UX
[ ] Clear fee disclosure before transactions
[ ] Security indicators (lock icons, https)
[ ] Session timeout warnings
[ ] Biometric/PIN confirmation for sensitive actions

## Localization Ready
[ ] Text externalized for translation
[ ] RTL layout support
[ ] Date/number formatting localized
[ ] Cultural considerations addressed
```

---

### /prd
**Product Requirements Document**

Generate comprehensive PRD for new product initiatives.

```yaml
trigger: /prd <product-initiative>
output: docs/prd/<initiative>-prd.md
```

**Sections:**
1. Executive Summary
2. Problem Statement & Market Opportunity
3. Target Users & Personas
4. Success Metrics & KPIs
5. Feature Requirements (MoSCoW prioritized)
6. User Journeys with wireframes
7. Technical Requirements
8. Security & Compliance Requirements
9. Go-to-Market Strategy
10. Risks & Mitigations
11. Timeline & Milestones

---

## Test-Driven Development Skills

### /tdd
**Implement Feature Using Test-Driven Development**

The core TDD workflow: Red → Green → Refactor.

```yaml
trigger: /tdd <feature-or-task>
output: Implementation with tests written FIRST
```

**Workflow:**
```
┌─────────────────────────────────────────────────────────┐
│                    TDD CYCLE                            │
│                                                         │
│   ┌─────────┐    ┌─────────┐    ┌──────────┐          │
│   │  RED    │───▶│  GREEN  │───▶│ REFACTOR │──┐       │
│   │ (Write  │    │ (Make   │    │ (Clean   │  │       │
│   │  Test)  │    │  Pass)  │    │  Code)   │  │       │
│   └─────────┘    └─────────┘    └──────────┘  │       │
│        ▲                                       │       │
│        └───────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Step-by-Step:**

1. **Understand Requirements**
   - Read related specs and user stories
   - Identify acceptance criteria
   - List edge cases and error conditions

2. **RED Phase - Write Failing Tests**
   ```typescript
   describe('LoanApplicationService', () => {
     describe('apply', () => {
       it('should reject application when credit score below threshold', async () => {
         // Arrange
         const customer = createTestCustomer({ creditScore: 250 });

         // Act & Assert
         await expect(loanService.apply(customer, 500))
           .rejects.toThrow('INSUFFICIENT_CREDIT_SCORE');
       });

       it('should approve application when all criteria met', async () => {
         // Arrange
         const customer = createTestCustomer({
           creditScore: 450,
           kycStatus: 'VERIFIED'
         });

         // Act
         const result = await loanService.apply(customer, 500);

         // Assert
         expect(result.status).toBe('APPROVED');
         expect(result.loanId).toBeDefined();
       });
     });
   });
   ```

3. **GREEN Phase - Minimal Implementation**
   - Write ONLY enough code to pass tests
   - No premature optimization
   - No extra features

4. **REFACTOR Phase - Clean Code**
   - Remove duplication
   - Improve naming
   - Extract functions/classes
   - ALL tests must still pass

5. **Repeat** for next requirement

**Test File Naming:**
```
src/services/loan-service.ts       → tests/unit/services/loan-service.test.ts
src/api/routes/loans.ts            → tests/integration/api/loans.test.ts
src/components/LoanForm.tsx        → tests/unit/components/LoanForm.test.tsx
```

---

### /test
**Run Test Suite**

Execute tests with detailed reporting.

```yaml
trigger: /test [scope]
scopes: all, unit, integration, e2e, <file-pattern>
```

**Commands:**
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage

# Run specific service
pnpm test services/payment-service

# Run in watch mode (development)
pnpm test --watch

# Run only failed tests
pnpm test --onlyFailures
```

**Output Analysis:**
- Identify failing tests
- Check coverage gaps
- Report slow tests (>1s)
- Flag flaky tests

---

### /coverage
**Analyze Test Coverage**

Deep dive into test coverage with actionable recommendations.

```yaml
trigger: /coverage [service-or-path]
output: Coverage report with improvement plan
```

**Coverage Requirements:**
```yaml
global:
  statements: 80%
  branches: 80%
  functions: 80%
  lines: 80%

critical_paths:
  payment-service: 95%
  scoring-service: 90%
  kyc-service: 90%
  auth-modules: 95%
```

**Workflow:**
1. Run `pnpm test:coverage`
2. Parse coverage report
3. Identify uncovered:
   - Functions
   - Branches (if/else, switch)
   - Error handlers
   - Edge cases
4. Generate prioritized list of tests to write
5. Create test stubs for critical gaps

**Report Format:**
```markdown
## Coverage Report: payment-service

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Statements | 87% | 95% | ⚠️ |
| Branches | 72% | 95% | ❌ |
| Functions | 91% | 95% | ⚠️ |
| Lines | 88% | 95% | ⚠️ |

### Critical Gaps
1. `processPayment()` - error handling branch uncovered
2. `validateAmount()` - edge case for zero amount
3. `retryTransaction()` - retry logic untested

### Recommended Tests to Add
- [ ] Test payment failure with network timeout
- [ ] Test zero amount validation
- [ ] Test retry exhaustion scenario
```

---

### /e2e
**End-to-End Test Workflow**

Run and manage E2E tests for critical user journeys.

```yaml
trigger: /e2e [journey]
journeys: onboarding, payment, loan-application, device-lock, all
```

**Critical Journeys:**
```typescript
// 1. Customer Onboarding
describe('Customer Onboarding Journey', () => {
  it('should complete full onboarding via WhatsApp', async () => {
    // WhatsApp greeting → KYC submission → Document upload →
    // Verification → Credit score → Approval notification
  });
});

// 2. Payment Processing
describe('Payment Journey', () => {
  it('should process EcoCash payment end-to-end', async () => {
    // Initiate payment → EcoCash redirect → Confirm →
    // Update balance → Send receipt → Update loan status
  });
});

// 3. Loan Application
describe('Loan Application Journey', () => {
  it('should process loan from application to disbursement', async () => {
    // Apply → Credit check → Approval → Contract →
    // Disbursement → Confirmation
  });
});

// 4. Device Lock/Unlock
describe('Device Management Journey', () => {
  it('should lock device on payment default', async () => {
    // Payment overdue → Grace period → Warning →
    // Lock command → Device locked → Unlock on payment
  });
});
```

**E2E Test Environment:**
- Uses test database (seeded, isolated)
- Mocked external APIs (Smile Identity, EcoCash, Trustonic)
- Runs in CI/CD pipeline before deploy

---

### /load-test
**Performance and Load Testing**

Execute load tests to validate system performance under stress.

```yaml
trigger: /load-test <scenario>
scenarios: baseline, stress, spike, soak, payment-peak
output: Performance report with recommendations
```

**Test Scenarios:**
```yaml
baseline:
  description: Normal expected load
  users: 100 concurrent
  duration: 10 minutes
  ramp_up: 2 minutes

stress:
  description: Find breaking point
  users: 100 → 1000 (incremental)
  duration: 30 minutes
  ramp_up: 5 minutes

spike:
  description: Sudden traffic burst
  users: 50 → 500 → 50
  duration: 15 minutes
  spike_duration: 2 minutes

soak:
  description: Extended duration test
  users: 200 concurrent
  duration: 4 hours
  monitor: Memory leaks, connection pools

payment_peak:
  description: Month-end payment rush
  users: 500 concurrent
  focus: Payment service endpoints
  duration: 1 hour
```

**Load Test Script Example:**
```typescript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Steady state
    { duration: '2m', target: 200 },  // Stress
    { duration: '5m', target: 200 },  // Steady state
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post(`${BASE_URL}/api/v1/loans/applications`, {
    customerId: 'test-user',
    amount: 500,
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(1);
}
```

**Performance Thresholds:**
```yaml
api_endpoints:
  p50: < 100ms
  p95: < 300ms
  p99: < 1000ms
  error_rate: < 1%

database_queries:
  p95: < 50ms
  connection_pool: < 80% utilized

lambda_functions:
  cold_start: < 1s
  warm_execution: < 200ms
  memory_usage: < 80%
```

**Report Template:**
```markdown
# Load Test Report: [Scenario]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X minutes
- **Peak Users**: N concurrent

## Results
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P95 Latency | <300ms | XXXms | ✅/❌ |
| Error Rate | <1% | X.X% | ✅/❌ |
| Throughput | >100 rps | XXX rps | ✅/❌ |

## Bottlenecks Identified
1. [Bottleneck description]

## Recommendations
1. [Optimization recommendation]
```

---

## Development Skills

### /implement
**Implement Feature with Full TDD Cycle**

Complete implementation workflow from spec to merged PR.

```yaml
trigger: /implement <feature-or-ticket>
output: Tested, reviewed, ready-to-merge code
```

**Workflow:**
```
┌──────────────────────────────────────────────────────────────┐
│                  IMPLEMENTATION WORKFLOW                      │
│                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │
│  │ Analyze │──▶│  Test   │──▶│  Code   │──▶│ Review  │     │
│  │  Spec   │   │  First  │   │  Impl   │   │   PR    │     │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘     │
│       │             │             │             │            │
│       ▼             ▼             ▼             ▼            │
│  Read existing  Write tests   Implement    Self-review      │
│  code & specs   that fail     to pass      then submit      │
└──────────────────────────────────────────────────────────────┘
```

**Step-by-Step:**

1. **Analysis Phase**
   - Read feature spec/ticket
   - Identify affected files
   - Review existing patterns
   - Check for reusable utilities

2. **Test Writing Phase** (TDD Red)
   - Write unit tests for new functions
   - Write integration tests for APIs
   - Include edge cases and error scenarios
   - Verify tests fail (no false positives)

3. **Implementation Phase** (TDD Green)
   - Write minimal code to pass tests
   - Follow existing code patterns
   - Apply CLAUDE.md security principles
   - No premature optimization

4. **Refactor Phase**
   - Clean up implementation
   - Extract reusable functions
   - Improve naming and documentation
   - Ensure all tests still pass

5. **Self-Review Phase**
   - Run `/review` on own code
   - Fix any issues found
   - Update documentation if needed

6. **PR Creation**
   - Create PR with comprehensive description
   - Link to ticket/spec
   - Include test evidence

---

### /refactor
**Safe Refactoring with Test Protection**

Refactor code while maintaining test coverage.

```yaml
trigger: /refactor <file-or-module>
output: Refactored code with passing tests
```

**Refactoring Checklist:**
```markdown
## Pre-Refactor
[ ] All existing tests pass
[ ] Coverage baseline recorded
[ ] Understand current behavior completely
[ ] Identify refactoring goal

## During Refactor
[ ] Make small, incremental changes
[ ] Run tests after each change
[ ] No behavior changes (tests unchanged)
[ ] Commit frequently

## Post-Refactor
[ ] All tests still pass
[ ] Coverage maintained or improved
[ ] No new linting errors
[ ] Performance not degraded
[ ] Code review requested
```

**Safe Refactoring Patterns:**
- Extract Function
- Rename Variable/Function
- Move Function to Module
- Replace Conditional with Polymorphism
- Introduce Parameter Object
- Replace Magic Number with Constant

---

### /api-design
**Design RESTful API Endpoints**

Design APIs following fintech best practices.

```yaml
trigger: /api-design <resource-or-feature>
output: API specification with security considerations
```

**API Design Standards:**
```yaml
# Naming Conventions
- Use kebab-case for URLs: /loan-applications
- Use camelCase for JSON fields: { "loanAmount": 500 }
- Plural nouns for collections: /customers, /payments
- Nested resources for relationships: /customers/{id}/loans

# HTTP Methods
GET    - Read (idempotent, cacheable)
POST   - Create (not idempotent)
PUT    - Full update (idempotent)
PATCH  - Partial update (idempotent)
DELETE - Remove (idempotent)

# Status Codes
200 - Success
201 - Created
204 - No Content (successful DELETE)
400 - Bad Request (validation error)
401 - Unauthorized (missing/invalid auth)
403 - Forbidden (insufficient permissions)
404 - Not Found
409 - Conflict (duplicate resource)
422 - Unprocessable Entity (business rule violation)
429 - Too Many Requests (rate limited)
500 - Internal Server Error
```

**API Spec Template:**
```yaml
endpoint: POST /loans/applications
description: Submit a new loan application
auth: Required (JWT)
rate_limit: 10 requests/minute

request:
  headers:
    Authorization: Bearer <token>
    Content-Type: application/json
    X-Idempotency-Key: <uuid>
  body:
    customerId: string (required)
    amount: number (required, min: 50, max: 5000)
    termMonths: number (required, enum: [3, 6, 12])
    purpose: string (optional, max: 500 chars)

response:
  success (201):
    applicationId: string
    status: "PENDING" | "APPROVED" | "REJECTED"
    creditScore: number
    createdAt: ISO8601

  errors:
    400: { code: "VALIDATION_ERROR", message: string, fields: [] }
    401: { code: "UNAUTHORIZED", message: string }
    409: { code: "DUPLICATE_APPLICATION", message: string }
    422: { code: "INSUFFICIENT_SCORE", message: string, minimumScore: number }

security:
  - Validate JWT and extract user context
  - Verify customer belongs to authenticated user
  - Rate limit by user ID
  - Log request (excluding sensitive data)
  - Idempotency key prevents duplicate submissions
```

---

### /db-schema
**Design Database Schema**

Create database schema with security and scalability considerations.

```yaml
trigger: /db-schema <entity-or-feature>
output: SQL migration with RLS policies
```

**Schema Design Checklist:**
```markdown
## Data Modeling
[ ] Use UUIDs for primary keys (not sequential)
[ ] Include audit fields (created_at, updated_at, created_by)
[ ] Soft delete with deleted_at where appropriate
[ ] Proper foreign key constraints
[ ] Appropriate indexes for query patterns

## Security
[ ] Row Level Security (RLS) policies defined
[ ] Sensitive fields identified for encryption
[ ] No PII in indexed columns (prevents leakage)
[ ] Audit trail for sensitive data access

## Performance
[ ] Indexes on foreign keys
[ ] Indexes on frequently filtered columns
[ ] Consider partitioning for large tables
[ ] Avoid over-indexing (write performance)

## Migrations
[ ] Backwards compatible changes
[ ] Rollback script included
[ ] Data migration plan if needed
[ ] Zero-downtime deployment strategy
```

**Example Schema:**
```sql
-- Migration: 20240215_create_loan_applications.sql

CREATE TABLE loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 50 AND amount <= 5000),
  term_months INTEGER NOT NULL CHECK (term_months IN (3, 6, 12)),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  credit_score INTEGER,
  decision_reason TEXT,
  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);

-- Indexes
CREATE INDEX idx_loan_applications_customer ON loan_applications(customer_id);
CREATE INDEX idx_loan_applications_status ON loan_applications(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_loan_applications_created ON loan_applications(created_at DESC);

-- RLS Policies
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own applications" ON loan_applications
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Staff can view all applications" ON loan_applications
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'loan_officer'));

CREATE POLICY "Staff can update applications" ON loan_applications
  FOR UPDATE USING (auth.jwt() ->> 'role' IN ('admin', 'loan_officer'));

-- Audit trigger
CREATE TRIGGER loan_applications_updated
  BEFORE UPDATE ON loan_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### /migration
**Database Migration Workflow**

Safe database migration with rollback capability.

```yaml
trigger: /migration <action> [name]
actions: create, run, rollback, status, validate
output: Migration execution with verification
```

**Migration Workflow:**
```
┌─────────────────────────────────────────────────────────────┐
│                  MIGRATION WORKFLOW                          │
│                                                             │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐    │
│  │ Create  │──▶│ Review  │──▶│  Test   │──▶│ Deploy  │    │
│  │Migration│   │   PR    │   │ Staging │   │  Prod   │    │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘    │
│       │                           │             │          │
│       ▼                           ▼             ▼          │
│  Write up/down              Run & verify   Monitor &       │
│  scripts                    rollback works verify          │
└─────────────────────────────────────────────────────────────┘
```

**Migration File Structure:**
```typescript
// database/migrations/20240215_add_loan_status_index.ts

import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Forward migration
  await db.schema
    .createIndex('idx_loans_status_created')
    .on('loans')
    .columns(['status', 'created_at'])
    .where('deleted_at', 'is', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Rollback migration
  await db.schema
    .dropIndex('idx_loans_status_created')
    .execute();
}

export const meta = {
  name: 'add_loan_status_index',
  description: 'Add composite index for loan status queries',
  breaking: false,
  requiresDowntime: false,
  estimatedDuration: '< 1 minute',
};
```

**Migration Safety Checklist:**
```markdown
## Pre-Migration
[ ] Migration tested in development
[ ] Migration tested in staging
[ ] Rollback script tested and verified
[ ] Backup taken (for production)
[ ] Team notified of migration window
[ ] Monitoring dashboards open

## Migration Types
SAFE (no downtime):
- Adding columns with defaults
- Adding indexes (CONCURRENTLY)
- Adding new tables
- Adding constraints (NOT VALID + VALIDATE)

REQUIRES CARE:
- Renaming columns (use transition period)
- Changing column types
- Removing columns (deprecate first)
- Large table modifications

DANGEROUS (requires downtime):
- Dropping tables with data
- Changing primary keys
- Large data migrations

## Post-Migration
[ ] Verify migration completed
[ ] Verify application functions correctly
[ ] Verify rollback capability (staging)
[ ] Update documentation
[ ] Remove feature flag if applicable
```

**Commands:**
```bash
# Create new migration
pnpm db:migration:create add_payment_audit_log

# Run pending migrations
pnpm db:migrate

# Rollback last migration
pnpm db:migrate:rollback

# Check migration status
pnpm db:migrate:status

# Validate migrations (dry run)
pnpm db:migrate:validate
```

**Zero-Downtime Migration Pattern:**
```sql
-- Step 1: Add new column (nullable)
ALTER TABLE loans ADD COLUMN new_status VARCHAR(20);

-- Step 2: Backfill data (in batches)
UPDATE loans SET new_status = status WHERE new_status IS NULL LIMIT 1000;

-- Step 3: Add constraints (NOT VALID first)
ALTER TABLE loans ADD CONSTRAINT chk_new_status
  CHECK (new_status IN ('PENDING', 'APPROVED', 'REJECTED')) NOT VALID;

-- Step 4: Validate constraint (non-blocking)
ALTER TABLE loans VALIDATE CONSTRAINT chk_new_status;

-- Step 5: Switch application to use new column
-- (Deploy code change)

-- Step 6: Make column NOT NULL
ALTER TABLE loans ALTER COLUMN new_status SET NOT NULL;

-- Step 7: Drop old column (after verification period)
ALTER TABLE loans DROP COLUMN status;

-- Step 8: Rename new column
ALTER TABLE loans RENAME COLUMN new_status TO status;
```

---

## Git Workflow Skills

### /commit
**Standardized Commit Messages**

Create conventional commits with proper formatting.

```yaml
trigger: /commit [type] [scope]
types: feat, fix, docs, test, refactor, perf, security, chore
output: Formatted commit with verification
```

**Conventional Commit Format:**
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Commit Types:**
```yaml
feat:     New feature for the user
fix:      Bug fix for the user
docs:     Documentation only changes
test:     Adding or updating tests
refactor: Code change that neither fixes a bug nor adds a feature
perf:     Performance improvement
security: Security fix or improvement
chore:    Maintenance tasks (deps, configs)
ci:       CI/CD changes
style:    Code style (formatting, semicolons)
```

**Examples:**
```bash
# Feature
feat(loans): add credit score caching for faster approvals

# Bug fix
fix(payments): resolve timeout on EcoCash webhook

# Security
security(auth): upgrade bcrypt to fix timing attack vulnerability

# With body and footer
feat(whatsapp): add voice message support for balance inquiries

Allows customers to send voice messages to check their loan balance.
Uses speech-to-text to parse common queries.

Closes #123
BREAKING CHANGE: WhatsApp webhook payload structure changed
```

**Commit Checklist:**
```markdown
[ ] Commit message follows conventional format
[ ] Type accurately describes the change
[ ] Scope identifies affected service/area
[ ] Subject is imperative ("add" not "added")
[ ] Subject is < 72 characters
[ ] Body explains WHY, not WHAT (code shows what)
[ ] Breaking changes are marked
[ ] Related issues are referenced
```

---

### /hotfix
**Emergency Production Fix Workflow**

Rapid response workflow for critical production issues.

```yaml
trigger: /hotfix <issue-description>
output: Hotfix branch, tested fix, production deployment
```

**Hotfix Workflow:**
```
┌─────────────────────────────────────────────────────────────┐
│                   HOTFIX WORKFLOW                            │
│                      (Target: < 2 hours)                     │
│                                                             │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐    │
│  │ Assess  │──▶│  Fix    │──▶│  Test   │──▶│ Deploy  │    │
│  │ (15min) │   │ (30min) │   │ (30min) │   │ (15min) │    │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘    │
│       │             │             │             │          │
│       ▼             ▼             ▼             ▼          │
│  - Identify root  - Minimal fix  - Unit test  - Deploy    │
│    cause          - No refactor  - Smoke test - Monitor   │
│  - Assess impact  - Security OK  - Staging    - Verify    │
└─────────────────────────────────────────────────────────────┘
```

**Step-by-Step:**
```bash
# 1. Create hotfix branch from production
git checkout main
git pull origin main
git checkout -b hotfix/critical-payment-fix

# 2. Make MINIMAL fix (no refactoring!)
# Edit only what's necessary

# 3. Write test for the fix
pnpm test:unit -- --watch

# 4. Run full test suite
pnpm test

# 5. Deploy to staging and verify
sam deploy --config-env staging

# 6. Get expedited review (2 reviewers for hotfix)
gh pr create --title "HOTFIX: [description]" --label "hotfix,urgent"

# 7. Deploy to production
sam deploy --config-env production

# 8. Monitor for 30 minutes
# Watch error rates, latency, business metrics

# 9. Merge hotfix to development branch
git checkout develop
git merge hotfix/critical-payment-fix
```

**Hotfix Rules:**
```markdown
1. MINIMAL changes only - fix the issue, nothing else
2. Must have tests proving the fix works
3. Requires 2 reviewers (can be expedited)
4. Must be deployed to staging first
5. Monitor production for 30 minutes post-deploy
6. Create follow-up ticket for proper fix if needed
7. Document in incident postmortem
```

---

### /changelog
**Generate Changelog**

Auto-generate changelog from git history.

```yaml
trigger: /changelog [version]
output: CHANGELOG.md update
```

**Changelog Format:**
```markdown
# Changelog

## [1.2.0] - 2024-02-15

### Added
- Credit score caching for faster loan approvals (#123)
- Voice message support for WhatsApp balance inquiries (#124)

### Changed
- Improved payment timeout handling from 30s to 60s (#125)

### Fixed
- EcoCash webhook timeout issue (#126)
- Duplicate transaction prevention (#127)

### Security
- Updated bcrypt to fix timing attack vulnerability (#128)

### Deprecated
- Old credit scoring algorithm (use v2) (#129)

### Removed
- Legacy SMS notification system (#130)
```

**Generation Process:**
```bash
# Generate changelog from commits since last tag
git log v1.1.0..HEAD --pretty=format:"%s (%h)" | \
  grep -E "^(feat|fix|docs|perf|security|refactor)" | \
  sort

# Group by type
feat:     → Added
fix:      → Fixed
perf:     → Changed (Performance)
security: → Security
docs:     → Documentation
refactor: → Changed
```

---

### /dependency-update
**Safe Dependency Updates**

Update dependencies with security and compatibility checks.

```yaml
trigger: /dependency-update [scope]
scopes: all, security, minor, major, <package-name>
output: Updated dependencies with test verification
```

**Update Workflow:**
```markdown
## 1. Audit Current State
pnpm audit                    # Check vulnerabilities
pnpm outdated                 # List outdated packages

## 2. Update Strategy
- Security: Update immediately, any version
- Patch: Update freely (0.0.x)
- Minor: Update with caution (0.x.0)
- Major: Update individually with testing (x.0.0)

## 3. Update Process
# Security updates (highest priority)
pnpm audit fix

# Minor updates (usually safe)
pnpm update

# Major updates (one at a time)
pnpm update <package>@latest

## 4. Verification
pnpm test                     # All tests pass
pnpm build                    # Build succeeds
pnpm audit                    # No new vulnerabilities

## 5. Commit
git commit -m "chore(deps): update dependencies

Security:
- Updated lodash to fix prototype pollution

Minor:
- @types/node 18.x → 20.x
- jest 29.6 → 29.7"
```

**Dependency Rules:**
```yaml
never_update_without_testing:
  - Database drivers (pg, mysql2)
  - Auth libraries (jsonwebtoken, bcrypt)
  - AWS SDK
  - Core frameworks (next, express)

auto_update_safe:
  - Type definitions (@types/*)
  - Linting tools (eslint, prettier)
  - Test utilities (jest, supertest)

lock_versions:
  - Production database drivers
  - Payment integration SDKs
  - KYC provider SDKs
```

---

## Code Review Skills

### /review
**Comprehensive Code Review**

Perform thorough code review covering all quality dimensions.

```yaml
trigger: /review [file-or-pr]
output: Detailed review with categorized feedback
```

**Review Dimensions:**

```markdown
## 1. Correctness
- Does the code do what it's supposed to do?
- Are edge cases handled?
- Are error conditions handled gracefully?

## 2. Security (CRITICAL for Fintech)
- [ ] No hardcoded secrets or API keys
- [ ] All inputs validated and sanitized
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Authentication on protected routes
- [ ] Authorization checks (user can access resource)
- [ ] Rate limiting on public endpoints
- [ ] Sensitive data not logged
- [ ] HTTPS enforced

## 3. Test Coverage
- [ ] Unit tests for new functions
- [ ] Integration tests for new endpoints
- [ ] Edge cases tested
- [ ] Error scenarios tested
- [ ] Tests are meaningful (not just coverage)

## 4. Performance
- [ ] No N+1 queries
- [ ] Appropriate indexes used
- [ ] No unnecessary re-renders (React)
- [ ] Large lists virtualized
- [ ] Images optimized

## 5. Code Quality
- [ ] Follows existing patterns
- [ ] Clear naming conventions
- [ ] No code duplication
- [ ] Functions are focused (single responsibility)
- [ ] TypeScript types are specific (no `any`)

## 6. Documentation
- [ ] Complex logic explained
- [ ] Public APIs documented
- [ ] Breaking changes noted

## 7. Financial Inclusion
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Works on low-end devices
- [ ] Clear, simple language
- [ ] Offline-resilient where applicable
```

**Review Output Format:**
```markdown
# Code Review: [PR/File]

## Summary
[Brief overview of changes and overall assessment]

## Critical Issues 🚨
[Must fix before merge - security, correctness]

## Suggestions 💡
[Improvements that should be considered]

## Nitpicks 📝
[Minor style/preference items]

## Testing Gaps 🧪
[Missing test coverage]

## Praise 👍
[What was done well]

## Verdict
[ ] ✅ Approved
[ ] ⚠️ Approved with suggestions
[ ] ❌ Changes requested
```

---

### /pr-review
**Pull Request Review Workflow**

Complete PR review including CI checks and manual testing.

```yaml
trigger: /pr-review <pr-number-or-url>
output: PR review with approval/rejection decision
```

**Workflow:**
1. Fetch PR details (`gh pr view`)
2. Review all commits (not just diff)
3. Check CI status
4. Run `/review` on changed files
5. Run `/security-review` on sensitive changes
6. Test locally if UI changes
7. Verify tests pass and coverage maintained
8. Submit review with detailed feedback

**PR Review Checklist:**
```markdown
## PR Basics
[ ] Clear title and description
[ ] Links to ticket/issue
[ ] Appropriate size (< 400 lines ideal)
[ ] Single responsibility

## CI/CD
[ ] All checks passing
[ ] No new linting errors
[ ] Coverage not decreased
[ ] Build successful

## Code Quality
[ ] Reviewed all files (not just glanced)
[ ] Tested locally (for UI changes)
[ ] Checked mobile responsiveness
[ ] Verified in staging (if deployed)

## Documentation
[ ] README updated if needed
[ ] API docs updated if endpoints changed
[ ] Migration guide if breaking changes
```

---

### /security-review
**Security-Focused Code Review**

Deep security analysis for sensitive code paths.

```yaml
trigger: /security-review <file-or-pr>
output: Security review report with severity ratings
```

**Security Review Checklist:**

```markdown
## Authentication & Session
[ ] JWT validation on all protected routes
[ ] Token expiration enforced
[ ] Refresh token rotation implemented
[ ] Session invalidation on logout
[ ] No sensitive data in JWT payload

## Authorization
[ ] Resource ownership verified
[ ] Role-based access enforced
[ ] Principle of least privilege
[ ] No privilege escalation paths

## Input Validation
[ ] All inputs validated (type, length, format)
[ ] File uploads validated (type, size, content)
[ ] Parameterized queries (no SQL injection)
[ ] Output encoding (no XSS)
[ ] CSRF protection on mutations

## Data Protection
[ ] PII encrypted at rest
[ ] Sensitive data masked in logs
[ ] No secrets in code or config files
[ ] HTTPS enforced
[ ] Secure cookie flags (HttpOnly, Secure, SameSite)

## Financial Controls
[ ] Transaction idempotency
[ ] Amount validation (min/max, precision)
[ ] Duplicate transaction prevention
[ ] Audit logging for financial operations
[ ] Reconciliation hooks

## Error Handling
[ ] No stack traces in production responses
[ ] Generic error messages to users
[ ] Detailed errors logged internally
[ ] No information disclosure
```

**Severity Ratings:**
- 🔴 **Critical**: Immediate fix required, blocks deployment
- 🟠 **High**: Fix before next release
- 🟡 **Medium**: Fix within sprint
- 🟢 **Low**: Fix when convenient

---

### /perf-review
**Performance Review**

Analyze code for performance issues.

```yaml
trigger: /perf-review <file-or-module>
output: Performance analysis with optimization recommendations
```

**Performance Checklist:**

```markdown
## Database
[ ] No N+1 queries
[ ] Queries use indexes
[ ] No SELECT * (specify columns)
[ ] Pagination for large datasets
[ ] Connection pooling used

## API
[ ] Response times < 200ms (P95)
[ ] Payload sizes minimized
[ ] Compression enabled
[ ] Caching where appropriate
[ ] No blocking operations

## Frontend
[ ] Bundle size < 200KB initial
[ ] Images optimized and lazy-loaded
[ ] Lists virtualized (> 50 items)
[ ] Memoization for expensive computations
[ ] No unnecessary re-renders

## Lambda/Serverless
[ ] Cold start < 1s
[ ] Bundle size < 5MB
[ ] No heavy imports at top level
[ ] Connection reuse enabled
```

---

## DevOps Skills

### /deploy
**Deployment Workflow**

Deploy to specified environment with safety checks.

```yaml
trigger: /deploy <environment>
environments: dev, staging, production
```

**Deployment Checklist:**

```markdown
## Pre-Deployment
[ ] All tests passing
[ ] Code reviewed and approved
[ ] No critical security issues
[ ] Database migrations ready
[ ] Feature flags configured
[ ] Rollback plan documented

## Deployment Steps
1. Run database migrations
2. Deploy Lambda functions
3. Update API Gateway
4. Clear caches if needed
5. Run smoke tests
6. Monitor error rates

## Post-Deployment
[ ] Smoke tests passing
[ ] No spike in error rates
[ ] Performance metrics normal
[ ] Alert channels notified
```

**Commands:**
```bash
# Development
sam deploy --config-env dev

# Staging
sam deploy --config-env staging

# Production (requires approval)
sam deploy --config-env production
```

---

### /rollback
**Emergency Rollback Procedure**

Quickly rollback a failed deployment.

```yaml
trigger: /rollback <environment> [version]
output: Rollback execution with verification
```

**Rollback Procedure:**
```markdown
1. Identify rollback target version
2. Notify team in #incidents channel
3. Execute rollback:
   - Lambda: Deploy previous version
   - Database: Run down migration (if safe)
   - Feature flags: Disable new features
4. Verify rollback successful
5. Run smoke tests
6. Monitor for 15 minutes
7. Post incident summary
```

---

### /health
**System Health Check**

Comprehensive health check across all services.

```yaml
trigger: /health [service]
output: Health status report
```

**Health Checks:**
```markdown
## Services
- [ ] Scoring Service: GET /health
- [ ] Payment Service: GET /health
- [ ] WhatsApp Service: GET /health
- [ ] KYC Service: GET /health
- [ ] Lock Service: GET /health
- [ ] Notification Service: GET /health

## Dependencies
- [ ] Supabase: Connection test
- [ ] WhatsApp API: Token valid
- [ ] Smile Identity: API reachable
- [ ] EcoCash: API reachable
- [ ] Trustonic: API reachable

## Metrics
- Error rate < 1%
- P95 latency < 500ms
- Memory usage < 80%
- Active connections < 80% limit
```

---

### /incident
**Incident Response Workflow**

Structured incident response for production issues.

```yaml
trigger: /incident <severity> <description>
severity: P1 (critical), P2 (high), P3 (medium), P4 (low)
```

**Incident Response:**
```markdown
## P1 - Critical (Revenue/Security Impact)
Response time: Immediate
Escalation: On-call + Engineering Lead + CTO
Actions:
1. Acknowledge in #incidents
2. Create incident channel
3. Assess impact
4. Implement mitigation
5. Communicate to stakeholders
6. Root cause analysis
7. Postmortem within 24h

## P2 - High (Feature Degraded)
Response time: 30 minutes
Escalation: On-call + Engineering Lead
Actions: Similar to P1, postmortem within 48h

## P3 - Medium (Minor Impact)
Response time: 4 hours
Escalation: On-call
Actions: Fix in next deployment

## P4 - Low (No User Impact)
Response time: Next business day
Actions: Add to backlog
```

---

### /feature-flag
**Feature Flag Management**

Manage feature flags for safe rollouts and kill switches.

```yaml
trigger: /feature-flag <action> <flag-name>
actions: create, enable, disable, rollout, status, cleanup
output: Feature flag configuration update
```

**Feature Flag Operations:**
```typescript
// Create new feature flag
/feature-flag create new-credit-scoring-v2

// Enable for specific users (testing)
/feature-flag enable new-credit-scoring-v2 --users=user1,user2

// Gradual rollout
/feature-flag rollout new-credit-scoring-v2 --percentage=10
/feature-flag rollout new-credit-scoring-v2 --percentage=50
/feature-flag rollout new-credit-scoring-v2 --percentage=100

// Emergency disable (kill switch)
/feature-flag disable ecocash-payments --reason="Provider outage"

// Check status
/feature-flag status new-credit-scoring-v2

// Cleanup old flags
/feature-flag cleanup --older-than=30days
```

**Feature Flag Schema:**
```typescript
interface FeatureFlag {
  name: string;
  description: string;
  category: 'release' | 'experiment' | 'ops' | 'permission';
  enabled: boolean;
  rolloutPercentage: number;  // 0-100
  allowedUsers: string[];     // Specific user IDs
  allowedGroups: string[];    // User groups
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  expiresAt?: Date;           // Auto-cleanup date
}
```

**Flag Naming Convention:**
```yaml
format: <category>-<feature>-<variant>

examples:
  release-credit-scoring-v2
  experiment-new-dashboard-layout
  ops-ecocash-payments
  permission-admin-reports
```

**Safety Rules:**
```markdown
1. All new features MUST have a flag
2. Flags MUST be documented with description
3. Flags MUST have an owner
4. Release flags MUST be removed within 30 days of 100% rollout
5. Kill switches MUST exist for all payment integrations
6. Flag changes MUST be logged for audit
7. Flag changes in production require approval
```

**Rollout Strategy:**
```yaml
day_1:
  percentage: 1%
  duration: 24 hours
  monitor: Error rates, latency

day_2:
  percentage: 10%
  duration: 24 hours
  monitor: Business metrics

day_3:
  percentage: 50%
  duration: 48 hours
  monitor: All metrics, user feedback

day_5:
  percentage: 100%
  duration: 7 days (bake time)

day_12:
  action: Remove flag, cleanup code
```

---

## Security Skills

### /security-audit
**Full Security Audit**

Comprehensive security audit of codebase or feature.

```yaml
trigger: /security-audit [scope]
output: Security audit report with remediation plan
```

**Audit Areas:**
```markdown
## 1. Authentication & Authorization
- Review auth implementation
- Check token handling
- Verify permission enforcement

## 2. Data Protection
- Identify PII storage locations
- Verify encryption at rest
- Check data retention compliance

## 3. Input/Output Security
- Scan for injection vulnerabilities
- Check output encoding
- Review file upload handling

## 4. Infrastructure Security
- Review AWS IAM policies
- Check Supabase RLS policies
- Verify secrets management

## 5. Dependency Security
- Run npm audit
- Check for known vulnerabilities
- Review third-party integrations

## 6. Logging & Monitoring
- Verify security event logging
- Check for sensitive data in logs
- Review alerting rules
```

---

### /threat-model
**Threat Modeling**

Create threat model for feature or system.

```yaml
trigger: /threat-model <feature-or-system>
output: Threat model document with mitigations
```

**STRIDE Analysis:**
```markdown
## Spoofing
- Threat: Attacker impersonates user
- Mitigation: Strong authentication, MFA

## Tampering
- Threat: Data modified in transit
- Mitigation: TLS, request signing, integrity checks

## Repudiation
- Threat: User denies action
- Mitigation: Audit logging, transaction receipts

## Information Disclosure
- Threat: Sensitive data leaked
- Mitigation: Encryption, access controls, masking

## Denial of Service
- Threat: Service unavailable
- Mitigation: Rate limiting, auto-scaling, WAF

## Elevation of Privilege
- Threat: User gains unauthorized access
- Mitigation: RBAC, input validation, least privilege
```

---

### /compliance
**Compliance Check**

Verify compliance with regulatory requirements.

```yaml
trigger: /compliance [standard]
standards: pci-dss, gdpr, local-regulations
```

**Compliance Areas:**
```markdown
## Data Protection (GDPR-style)
[ ] Consent collected before data processing
[ ] Right to access implemented
[ ] Right to deletion implemented
[ ] Data portability supported
[ ] Breach notification process

## Financial Regulations
[ ] KYC verification enforced
[ ] Transaction limits enforced
[ ] Suspicious activity monitoring
[ ] Record retention (7 years)
[ ] Audit trail complete

## PCI-DSS (if handling cards)
[ ] No card data stored
[ ] Tokenization used
[ ] Secure transmission
[ ] Access logging
```

---

### /pen-test
**Penetration Test Preparation**

Prepare for and support penetration testing.

```yaml
trigger: /pen-test <phase>
phases: prep, support, remediation
```

**Preparation Checklist:**
```markdown
## Pre-Test
[ ] Scope defined (in-scope/out-of-scope)
[ ] Test environment provisioned
[ ] Test accounts created
[ ] Emergency contacts listed
[ ] Rollback procedures ready

## During Test
[ ] Monitor for service impact
[ ] Provide access as needed
[ ] Log all tester activity
[ ] Capture findings in real-time

## Post-Test
[ ] Review findings report
[ ] Prioritize by severity
[ ] Create remediation tickets
[ ] Schedule retests
[ ] Update threat model
```

---

### /audit-log
**View and Analyze Audit Logs**

Query and analyze audit trails for compliance and investigation.

```yaml
trigger: /audit-log <query-type> [filters]
query-types: user, resource, action, timerange, suspicious
output: Formatted audit log report
```

**Query Examples:**
```bash
# View all actions by a specific user
/audit-log user usr_123 --last=7days

# View all access to a specific loan
/audit-log resource loan_456 --last=30days

# View all payment approvals
/audit-log action payment.approve --last=24hours

# View suspicious activity
/audit-log suspicious --last=7days

# Export for compliance report
/audit-log export --from=2024-01-01 --to=2024-01-31 --format=csv
```

**Audit Log Schema:**
```typescript
interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;              // e.g., "loan.approve", "payment.process"
  resourceType: string;        // e.g., "loan", "customer", "payment"
  resourceId: string;
  previousState?: object;      // Before change (for updates)
  newState?: object;           // After change
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  success: boolean;
  errorCode?: string;
  metadata?: object;
}
```

**Audited Actions:**
```yaml
always_audit:
  # Authentication
  - auth.login
  - auth.logout
  - auth.login_failed
  - auth.password_change
  - auth.mfa_enable
  - auth.mfa_disable

  # Customer Data
  - customer.view
  - customer.create
  - customer.update
  - customer.delete
  - customer.export

  # Loan Operations
  - loan.apply
  - loan.approve
  - loan.reject
  - loan.disburse
  - loan.close

  # Payment Operations
  - payment.initiate
  - payment.process
  - payment.refund
  - payment.void

  # Device Operations
  - device.lock
  - device.unlock
  - device.assign

  # Admin Operations
  - admin.user_create
  - admin.user_deactivate
  - admin.role_change
  - admin.config_change
```

**Suspicious Activity Detection:**
```yaml
triggers:
  - Multiple failed logins (>5 in 10 minutes)
  - Login from new location
  - Large transaction outside normal pattern
  - Access to many customer records quickly
  - After-hours admin activity
  - Bulk data export
  - Permission escalation attempts
```

**Report Format:**
```markdown
# Audit Log Report

## Query Parameters
- **Type**: User Activity
- **User**: usr_123 (john@example.com)
- **Period**: 2024-02-01 to 2024-02-15

## Summary
- Total Actions: 145
- Unique Sessions: 12
- Failed Actions: 3

## Activity Breakdown
| Action | Count | Success | Failed |
|--------|-------|---------|--------|
| loan.view | 45 | 45 | 0 |
| loan.approve | 23 | 22 | 1 |
| customer.view | 67 | 67 | 0 |

## Flagged Events
1. **2024-02-10 14:32:00** - Failed loan approval (insufficient permissions)
2. **2024-02-12 23:45:00** - After-hours access (unusual)

## Detailed Log
[Detailed entries...]
```

---

## Documentation Skills

### /doc
**Generate Documentation**

Create or update documentation for code.

```yaml
trigger: /doc <file-or-module>
output: JSDoc comments and README updates
```

**Documentation Standards:**
```typescript
/**
 * Calculates credit score for loan application
 *
 * @description Uses alternative data signals to assess creditworthiness
 * for customers without traditional credit history.
 *
 * @param customer - Customer profile with transaction history
 * @param options - Scoring configuration options
 * @returns Credit score between 300-850
 *
 * @example
 * const score = await calculateCreditScore(customer, {
 *   includeAlternativeData: true
 * });
 *
 * @throws {ValidationError} If customer data is incomplete
 * @throws {ScoringError} If scoring service is unavailable
 *
 * @see https://docs.lynia.finance/scoring/algorithm
 */
async function calculateCreditScore(
  customer: CustomerProfile,
  options?: ScoringOptions
): Promise<CreditScore> {
  // Implementation
}
```

---

### /api-doc
**Generate API Documentation**

Create OpenAPI/Swagger documentation.

```yaml
trigger: /api-doc <service-or-endpoint>
output: OpenAPI specification
```

**Output Location:** `docs/api/<service>.yaml`

---

### /runbook
**Create Operational Runbook**

Document operational procedures for the team.

```yaml
trigger: /runbook <procedure>
output: Step-by-step runbook in docs/runbooks/
```

**Runbook Template:**
```markdown
# Runbook: [Procedure Name]

## Overview
[Brief description of when to use this runbook]

## Prerequisites
- [ ] Access to AWS console
- [ ] Database credentials
- [ ] On-call notification sent

## Steps
1. [First step with exact commands]
2. [Second step]
3. [Verification step]

## Rollback
[How to undo if something goes wrong]

## Escalation
[Who to contact if procedure fails]

## Post-Procedure
- [ ] Update status page
- [ ] Notify stakeholders
- [ ] Log in incident tracker
```

---

### /postmortem
**Create Incident Postmortem**

Document incident for learning and prevention.

```yaml
trigger: /postmortem <incident-id>
output: Postmortem document
```

**Postmortem Template:**
```markdown
# Postmortem: [Incident Title]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Impact**: [Users affected, revenue impact]
- **Severity**: P1/P2/P3/P4

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Issue first detected |
| HH:MM | Team alerted |
| HH:MM | Mitigation applied |
| HH:MM | Full resolution |

## Root Cause
[Technical explanation of what went wrong]

## What Went Well
- [Positive aspects of response]

## What Could Be Improved
- [Areas for improvement]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action 1] | @name | YYYY-MM-DD | Open |

## Lessons Learned
[Key takeaways for the team]
```

---

### /onboard
**New Developer Onboarding**

Structured onboarding checklist for new team members.

```yaml
trigger: /onboard <developer-name> [role]
roles: backend, frontend, fullstack, devops, qa
output: Personalized onboarding checklist
```

**Onboarding Checklist:**
```markdown
# Developer Onboarding: [Name]
**Role**: [Role]
**Start Date**: YYYY-MM-DD
**Buddy**: [Assigned buddy name]

## Day 1: Environment Setup
- [ ] Receive laptop and credentials
- [ ] Set up development environment (see QUICKSTART.md)
- [ ] Clone repository and run `pnpm install`
- [ ] Verify local development server runs
- [ ] Join Slack channels (#engineering, #incidents, #deployments)
- [ ] Access granted: GitHub, AWS Console, Supabase

## Day 1-2: Codebase Overview
- [ ] Read CLAUDE.md (development guidelines)
- [ ] Read skills.md (workflow commands)
- [ ] Review project structure in README.md
- [ ] Understand microservices architecture
- [ ] Review database schema (infrastructure/supabase/)

## Day 2-3: Domain Knowledge
- [ ] Read product spec (lynia-specs/lynia-lending/spec.md)
- [ ] Understand customer journey (WhatsApp → KYC → Loan)
- [ ] Review Zimbabwe market context and regulations
- [ ] Shadow customer support to understand user issues

## Day 3-5: First Contributions
- [ ] Pick a "good-first-issue" ticket
- [ ] Set up PR workflow (create branch, make change)
- [ ] Submit first PR and go through review process
- [ ] Deploy to staging and verify

## Week 2: Deeper Dive
- [ ] Review payment integration (EcoCash/OneMoney)
- [ ] Understand credit scoring algorithm
- [ ] Review security practices and audit logging
- [ ] Participate in code review for others

## Week 3-4: Independence
- [ ] Take ownership of a medium-sized feature
- [ ] Participate in on-call rotation (shadow first)
- [ ] Lead a small technical discussion
- [ ] Complete security training

## Checkpoints
| Milestone | Target Date | Completed |
|-----------|-------------|-----------|
| Environment setup | Day 1 | [ ] |
| First PR merged | Day 5 | [ ] |
| First feature shipped | Week 2 | [ ] |
| On-call capable | Week 4 | [ ] |
```

**Role-Specific Additions:**

**Backend Developer:**
```markdown
- [ ] Review Lambda function structure
- [ ] Understand Supabase RLS policies
- [ ] Review API design standards
- [ ] Set up Postman/Insomnia for API testing
```

**Frontend Developer:**
```markdown
- [ ] Review Next.js 14 patterns used
- [ ] Understand component library
- [ ] Review accessibility requirements
- [ ] Set up browser dev tools and React DevTools
```

**DevOps:**
```markdown
- [ ] Review AWS SAM templates
- [ ] Understand CI/CD pipelines
- [ ] Review monitoring and alerting setup
- [ ] Get access to CloudWatch and cost dashboards
```

**Onboarding Buddy Responsibilities:**
```markdown
1. Daily check-in for first week
2. Answer questions (no question too small)
3. Review first 3 PRs with extra care
4. Introduce to team members
5. Share tribal knowledge and gotchas
```

---

## Compliance & Zimbabwe Skills

### /data-export
**GDPR-Style Data Export**

Export customer data for data portability requests.

```yaml
trigger: /data-export <customer-id>
output: Encrypted data package for customer
```

**Data Export Process:**
```markdown
## 1. Verify Request
- Confirm customer identity (KYC verified)
- Log data export request in audit trail
- Check for any legal holds preventing export

## 2. Gather Data
- Customer profile
- KYC documents (redacted versions)
- Loan history
- Payment history
- Communication history (WhatsApp)
- Device assignment history

## 3. Format Data
- JSON format for structured data
- PDF for documents
- Include data dictionary explaining fields

## 4. Secure Delivery
- Encrypt package with customer-provided key
- Deliver via secure link (expires in 7 days)
- Notify customer of available download

## 5. Audit
- Log successful delivery
- Retain proof of delivery
- Delete local copy after confirmation
```

**Data Export Package:**
```typescript
interface DataExportPackage {
  exportId: string;
  customerId: string;
  requestedAt: Date;
  generatedAt: Date;
  expiresAt: Date;
  contents: {
    profile: CustomerProfile;
    kyc: KYCData;           // Redacted sensitive fields
    loans: LoanRecord[];
    payments: PaymentRecord[];
    communications: CommunicationLog[];
    devices: DeviceAssignment[];
    consents: ConsentRecord[];
  };
  dataInventory: {
    field: string;
    source: string;
    retentionPeriod: string;
  }[];
}
```

---

### /rbz-report
**Reserve Bank of Zimbabwe Reporting**

Generate regulatory reports for RBZ compliance.

```yaml
trigger: /rbz-report <report-type> <period>
report-types: monthly-transactions, str, annual-compliance
output: Formatted report for RBZ submission
```

**Report Types:**

**Monthly Transaction Report:**
```markdown
# Monthly Transaction Report
**Period**: January 2024
**Submission Deadline**: February 15, 2024

## Summary
- Total Loans Disbursed: $XXX,XXX
- Total Repayments Collected: $XXX,XXX
- Active Loans: X,XXX
- New Customers: XXX
- Default Rate: X.X%

## Transaction Breakdown by Currency
| Currency | Disbursed | Collected | Outstanding |
|----------|-----------|-----------|-------------|
| USD | $XX,XXX | $XX,XXX | $XX,XXX |
| ZWL | ZWL XX,XXX | ZWL XX,XXX | ZWL XX,XXX |

## KYC Statistics
- Total KYC Verifications: XXX
- Passed: XXX (XX%)
- Failed: XX (X%)
- Pending: XX (X%)

## Large Transactions (> $2,000)
[List of transactions requiring enhanced due diligence]

## Certification
This report is accurate and complete to the best of our knowledge.

Prepared by: [Name]
Date: YYYY-MM-DD
```

**Suspicious Transaction Report (STR):**
```markdown
# Suspicious Transaction Report
**Report ID**: STR-2024-XXXX
**Submission Date**: YYYY-MM-DD (within 24 hours of detection)

## Transaction Details
- Transaction ID: TXN_XXXXX
- Date: YYYY-MM-DD
- Amount: $X,XXX
- Type: [Loan disbursement/Repayment]
- Customer ID: CUST_XXXXX

## Customer Information
- Name: [Redacted for this template]
- National ID: [Redacted]
- Phone: [Redacted]
- KYC Status: Verified

## Suspicious Indicators
- [ ] Unusual transaction pattern
- [ ] Amount inconsistent with profile
- [ ] Rapid movement of funds
- [ ] Multiple accounts linked
- [ ] Structuring suspicion
- [ ] Other: [Description]

## Investigation Summary
[Description of why this transaction was flagged]

## Supporting Documents
- Transaction records
- Customer communication logs
- KYC documents
```

---

### /mobile-money-test
**Mobile Money Integration Testing**

Test EcoCash and OneMoney integrations.

```yaml
trigger: /mobile-money-test <provider> <scenario>
providers: ecocash, onemoney, all
scenarios: payment, refund, status, timeout, all
output: Integration test results
```

**Test Scenarios:**
```typescript
describe('EcoCash Integration', () => {
  describe('Payment Processing', () => {
    it('should initiate payment successfully', async () => {
      const result = await ecocash.initiatePayment({
        phone: '+263771234567',
        amount: 10.00,
        currency: 'USD',
        reference: 'LOAN_123_PAYMENT_1',
      });

      expect(result.status).toBe('PENDING');
      expect(result.transactionId).toBeDefined();
    });

    it('should handle insufficient funds', async () => {
      const result = await ecocash.initiatePayment({
        phone: '+263771111111', // Test number for insufficient funds
        amount: 10000.00,
        currency: 'USD',
        reference: 'TEST_INSUFFICIENT',
      });

      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('should handle timeout gracefully', async () => {
      const result = await ecocash.initiatePayment({
        phone: '+263772222222', // Test number for timeout
        amount: 10.00,
        currency: 'USD',
        reference: 'TEST_TIMEOUT',
      });

      expect(result.status).toBe('PENDING');
      // Should be queued for status check
    });

    it('should process webhook callback', async () => {
      const webhook = {
        transactionId: 'TXN_123',
        status: 'SUCCESS',
        amount: 10.00,
        signature: 'valid_signature',
      };

      const result = await ecocash.handleWebhook(webhook);

      expect(result.processed).toBe(true);
      expect(result.paymentUpdated).toBe(true);
    });
  });

  describe('Refund Processing', () => {
    it('should process refund for valid transaction', async () => {
      const result = await ecocash.refund({
        originalTransactionId: 'TXN_123',
        amount: 10.00,
        reason: 'Customer request',
      });

      expect(result.status).toBe('SUCCESS');
    });
  });
});

describe('OneMoney Integration', () => {
  // Similar test structure for OneMoney
});
```

**Test Phone Numbers (Sandbox):**
```yaml
ecocash_sandbox:
  success: '+263771000001'
  insufficient_funds: '+263771000002'
  timeout: '+263771000003'
  invalid_pin: '+263771000004'
  blocked_account: '+263771000005'

onemoney_sandbox:
  success: '+263713000001'
  insufficient_funds: '+263713000002'
  timeout: '+263713000003'
```

**Integration Health Check:**
```bash
# Run all mobile money tests
/mobile-money-test all all

# Test specific provider
/mobile-money-test ecocash payment

# Check provider API status
/mobile-money-test ecocash status

# Output
┌─────────────────────────────────────────────────┐
│         Mobile Money Integration Status          │
├─────────────────────────────────────────────────┤
│ Provider   │ Status │ Latency │ Last Success    │
├────────────┼────────┼─────────┼─────────────────┤
│ EcoCash    │ ✅ UP  │ 245ms   │ 2 minutes ago   │
│ OneMoney   │ ✅ UP  │ 312ms   │ 5 minutes ago   │
│ InnBucks   │ ⚠️ N/A │ -       │ Not integrated  │
└─────────────────────────────────────────────────┘
```

---

## Integration & Workflow Skills

### /integrate
**Integration Testing Workflow**

Run comprehensive integration tests between services.

```yaml
trigger: /integrate <services>
output: Integration test results and issues
```

**Integration Test Matrix:**
```markdown
## Service Dependencies
| Service | Depends On | Test Coverage |
|---------|------------|---------------|
| WhatsApp | Notification, Customer | ✅ |
| Scoring | Customer, Transaction | ✅ |
| Payment | Loan, Notification | ✅ |
| Lock | Device, Notification | ✅ |
| KYC | Customer, Smile Identity | ✅ |
```

---

### /release
**Release Workflow**

Prepare and execute a release.

```yaml
trigger: /release <version>
output: Release checklist and changelog
```

**Release Checklist:**
```markdown
## Pre-Release
[ ] All features complete and tested
[ ] Code freeze announced
[ ] Release branch created
[ ] QA sign-off obtained
[ ] Security review completed
[ ] Performance benchmarks passed

## Release
[ ] Changelog updated
[ ] Version bumped
[ ] Tag created
[ ] Deploy to staging
[ ] Smoke tests passed
[ ] Deploy to production
[ ] Monitor metrics

## Post-Release
[ ] Announce to stakeholders
[ ] Update documentation
[ ] Close related tickets
[ ] Schedule retrospective
```

---

### /standup
**Daily Standup Summary**

Generate standup update from recent activity.

```yaml
trigger: /standup
output: Formatted standup update
```

**Format:**
```markdown
## Yesterday
- [Completed tasks from git log]

## Today
- [Planned tasks from todo list]

## Blockers
- [Any identified blockers]
```

---

## Quick Reference Commands

```bash
# TDD Workflow
/tdd implement-loan-approval     # Start TDD for feature
/test                            # Run all tests
/coverage scoring-service        # Check coverage
/load-test stress                # Run load tests

# Git Workflow
/commit feat loans               # Create conventional commit
/hotfix payment-timeout          # Emergency fix workflow
/changelog 1.2.0                 # Generate changelog
/dependency-update security      # Update dependencies

# Code Quality
/review src/services/payment.ts  # Review specific file
/pr-review 123                   # Review pull request
/security-review                 # Security-focused review
/perf-review                     # Performance review

# Development
/implement TICKET-123            # Full TDD implementation
/migration create add-index      # Create database migration
/api-design loans                # Design API endpoints
/db-schema customers             # Design database schema

# DevOps
/deploy staging                  # Deploy to staging
/rollback production v1.1.0      # Emergency rollback
/health                          # Check all services
/incident P2 "Payment delays"    # Report incident
/feature-flag rollout scoring 50 # Feature flag rollout

# Security & Compliance
/security-audit payment-service  # Full security audit
/audit-log user usr_123          # View audit trail
/compliance gdpr                 # Compliance check
/pen-test prep                   # Penetration test prep

# Documentation
/doc src/services/scoring.ts     # Generate docs
/api-doc payment-service         # API documentation
/runbook database-restore        # Create runbook
/onboard john fullstack          # New developer onboarding
/postmortem INC-001              # Create postmortem

# Zimbabwe & Compliance
/data-export cust_123            # Export customer data
/rbz-report monthly 2024-01      # RBZ monthly report
/mobile-money-test ecocash all   # Test mobile money
```

---

## Principles Reminder

Every skill execution should embody:

1. **Security First** - Never compromise on security for speed
2. **Test-Driven** - Write tests before code, always
3. **Privacy by Design** - Minimize data, maximize protection
4. **Financial Inclusion** - Design for the underbanked
5. **Code Quality** - Review thoroughly, merge confidently
6. **Operational Excellence** - Monitor, alert, respond, learn

> "Move fast without breaking things. In fintech, broken things break lives."
