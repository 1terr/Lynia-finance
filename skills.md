# Lynia Finance - Development Skills

> World-class fintech development workflows with TDD, security-first design, and comprehensive code review.

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
**Create Feature Specification** - `trigger: /spec <feature-name>`

Generates comprehensive spec with: Problem statement, Success metrics, User stories, Security checklist, Test scenarios (TDD), Technical approach, Dependencies & risks.

### /user-story
**Generate User Stories** - `trigger: /user-story <feature-area>`

Creates BDD-style stories: `As a [persona], I want [action], So that [benefit]` with Given-When-Then scenarios, edge cases, and MoSCoW prioritization.

### /design-review
**UI/UX Design Review** - `trigger: /design-review <description>`

Reviews against: WCAG 2.1 AA accessibility, Fintech UX patterns (status colors, money formatting), Mobile/low-bandwidth support, Trust & security UX, Localization readiness.

### /prd
**Product Requirements Document** - `trigger: /prd <initiative>`

Generates PRD with: Executive summary, Problem statement, Personas, KPIs, Feature requirements, User journeys, Technical/security requirements, GTM strategy, Risks, Timeline.

---

## Test-Driven Development Skills

### /tdd
**Implement with TDD** - `trigger: /tdd <feature-or-task>`

**Workflow: Red → Green → Refactor**
```
1. Understand Requirements → Read specs, identify acceptance criteria
2. RED Phase   → Write failing tests first
3. GREEN Phase → Write minimal code to pass
4. REFACTOR    → Clean code, all tests must pass
5. Repeat
```

**Test File Naming:**
```
src/services/loan-service.ts → tests/unit/services/loan-service.test.ts
src/api/routes/loans.ts      → tests/integration/api/loans.test.ts
```

### /test
**Run Test Suite** - `trigger: /test [scope]`

```bash
pnpm test                        # All tests
pnpm test --coverage             # With coverage
pnpm test services/payment       # Specific service
pnpm test --watch                # Watch mode
```

### /coverage
**Analyze Coverage** - `trigger: /coverage [service]`

**Requirements:**
- Global: 80% (statements, branches, functions, lines)
- payment-service: 95%
- scoring-service: 90%

Identifies uncovered functions, branches, error handlers and generates prioritized test recommendations.

### /e2e
**End-to-End Tests** - `trigger: /e2e [journey]`

**Critical Journeys:** Customer onboarding, Payment processing, Loan application, Device lock/unlock.

Uses test database, mocked external APIs, runs in CI/CD before deploy.

### /load-test
**Performance Testing** - `trigger: /load-test <scenario>`

**Scenarios:**
| Scenario | Users | Duration | Purpose |
|----------|-------|----------|---------|
| baseline | 100 | 10min | Normal load |
| stress | 100→1000 | 30min | Find breaking point |
| spike | 50→500→50 | 15min | Sudden burst |
| soak | 200 | 4hr | Memory leaks |
| payment_peak | 500 | 1hr | Month-end rush |

**Thresholds:** P95 <300ms, P99 <1000ms, Error rate <1%

---

## Development Skills

### /implement
**Full TDD Implementation** - `trigger: /implement <feature-or-ticket>`

```
Analyze Spec → Write Tests (RED) → Implement (GREEN) → Refactor → Self-Review → Create PR
```

### /refactor
**Safe Refactoring** - `trigger: /refactor <file-or-module>`

**Checklist:** All tests pass → Make incremental changes → Run tests after each → No behavior changes → Coverage maintained → Request review.

**Safe Patterns:** Extract Function, Rename, Move to Module, Replace Conditional with Polymorphism.

### /api-design
**Design RESTful APIs** - `trigger: /api-design <resource>`

**Standards:**
- URLs: kebab-case (`/loan-applications`)
- JSON: camelCase (`loanAmount`)
- Methods: GET (read), POST (create), PUT (full update), PATCH (partial), DELETE
- Status: 200/201/400/401/403/404/409/422/429/500

**Required:** Auth, rate limiting, idempotency keys for mutations, no sensitive data in logs.

### /db-schema
**Database Schema Design** - `trigger: /db-schema <entity>`

**Checklist:**
- UUIDs for PKs, audit fields (created_at, updated_at, created_by)
- Soft delete, foreign key constraints, indexes on FKs
- RLS policies, field encryption for sensitive data
- Backwards-compatible migrations with rollback scripts

### /migration
**Database Migration** - `trigger: /migration <action> [name]`

**Actions:** create, run, rollback, status, validate

**Safety Rules:**
- SAFE: Add columns with defaults, add indexes (CONCURRENTLY), add tables
- CAREFUL: Rename columns, change types, remove columns
- DANGEROUS: Drop tables, change PKs, large data migrations

```bash
pnpm db:migration:create <name>  # Create
pnpm db:migrate                  # Run
pnpm db:migrate:rollback         # Rollback
```

---

## Git Workflow Skills

### /commit
**Conventional Commits** - `trigger: /commit [type] [scope]`

**Format:** `<type>(<scope>): <subject>`

**Types:** feat, fix, docs, test, refactor, perf, security, chore, ci, style

```bash
feat(loans): add credit score caching
fix(payments): resolve EcoCash webhook timeout
security(auth): upgrade bcrypt for timing attack fix
```

### /hotfix
**Emergency Fix** - `trigger: /hotfix <issue>` - Target: <2 hours

```
1. Assess (15min)  → Identify root cause, assess impact
2. Fix (30min)     → MINIMAL changes only, no refactoring
3. Test (30min)    → Unit test, smoke test, staging deploy
4. Deploy (15min)  → Production deploy, monitor 30min
```

**Rules:** 2 reviewers required, staging first, create follow-up ticket, document in postmortem.

### /changelog
**Generate Changelog** - `trigger: /changelog [version]`

Groups commits by type: feat→Added, fix→Fixed, perf→Changed, security→Security, docs→Documentation.

### /dependency-update
**Safe Updates** - `trigger: /dependency-update [scope]`

**Scopes:** all, security, minor, major, `<package-name>`

**Process:** `pnpm audit` → `pnpm outdated` → Update → `pnpm test` → `pnpm build` → Commit

**Rules:** Never update without testing: DB drivers, auth libs, AWS SDK, core frameworks.

---

## Code Review Skills

### /review
**Comprehensive Review** - `trigger: /review [file-or-pr]`

**Dimensions:**
1. **Correctness** - Does it work? Edge cases? Error handling?
2. **Security** - No secrets, inputs validated, auth/authz, rate limiting
3. **Tests** - Unit/integration tests, edge cases, meaningful coverage
4. **Performance** - No N+1, proper indexes, no unnecessary re-renders
5. **Quality** - Follows patterns, clear naming, no duplication, typed
6. **Accessibility** - WCAG 2.1 AA, works on low-end devices

**Output:** Critical issues 🚨, Suggestions 💡, Nitpicks 📝, Testing gaps 🧪, Verdict (✅/⚠️/❌)

### /pr-review
**Pull Request Review** - `trigger: /pr-review <pr-number>`

Fetch PR → Review all commits → Check CI → Run /review → Test locally (UI) → Submit feedback.

**Checklist:** Clear description, links to ticket, <400 lines, single responsibility, all checks pass.

### /security-review
**Security Analysis** - `trigger: /security-review <file-or-pr>`

**Focus Areas:** JWT validation, token expiration, resource ownership, RBAC, input validation, parameterized queries, output encoding, CSRF, PII encryption, transaction idempotency, audit logging.

**Severity:** 🔴 Critical (blocks deploy), 🟠 High (fix before release), 🟡 Medium (fix in sprint), 🟢 Low

### /perf-review
**Performance Review** - `trigger: /perf-review <file>`

**Checklist:** No N+1 queries, uses indexes, pagination, connection pooling, P95 <200ms, bundle <200KB, images optimized, lists virtualized, Lambda cold start <1s.

---

## DevOps Skills

### /deploy
**Deployment** - `trigger: /deploy <environment>`

**Pre-Deploy:** Tests pass, reviewed, no security issues, migrations ready, rollback plan.

```bash
sam deploy --config-env dev      # Development
sam deploy --config-env staging  # Staging
sam deploy --config-env production  # Production (requires approval)
```

**Post-Deploy:** Smoke tests, monitor error rates, verify metrics.

### /rollback
**Emergency Rollback** - `trigger: /rollback <environment> [version]`

1. Identify target version → 2. Notify team → 3. Deploy previous Lambda/run down migration → 4. Verify → 5. Monitor 15min → 6. Post summary

### /health
**System Health** - `trigger: /health [service]`

Checks all services (GET /health), dependencies (Supabase, WhatsApp, DIDIT, EcoCash, Trustonic), metrics (error rate <1%, P95 <500ms).

### /incident
**Incident Response** - `trigger: /incident <severity> <description>`

| Severity | Response | Escalation |
|----------|----------|------------|
| P1 Critical | Immediate | On-call + Lead + CTO, postmortem 24h |
| P2 High | 30min | On-call + Lead, postmortem 48h |
| P3 Medium | 4hr | On-call, fix next deploy |
| P4 Low | Next day | Add to backlog |

### /feature-flag
**Feature Flags** - `trigger: /feature-flag <action> <flag-name>`

**Actions:** create, enable, disable, rollout, status, cleanup

**Rollout Strategy:** 1% (day 1) → 10% (day 2) → 50% (day 3) → 100% (day 5) → Remove flag (day 12)

**Rules:** All features need flags, document with description, remove within 30 days of 100% rollout, kill switches for payment integrations.

---

## Security Skills

### /security-audit
**Full Audit** - `trigger: /security-audit [scope]`

**Areas:** Auth & authz, Data protection (PII, encryption), Input/output security, Infrastructure (IAM, RLS), Dependencies (`npm audit`), Logging & monitoring.

### /threat-model
**STRIDE Analysis** - `trigger: /threat-model <feature>`

| Threat | Example | Mitigation |
|--------|---------|------------|
| Spoofing | Impersonate user | MFA, strong auth |
| Tampering | Modify data | TLS, signing, integrity |
| Repudiation | Deny action | Audit logs, receipts |
| Info Disclosure | Data leak | Encryption, access controls |
| DoS | Service down | Rate limiting, WAF |
| Elevation | Unauthorized access | RBAC, least privilege |

### /compliance
**Compliance Check** - `trigger: /compliance [standard]`

**Standards:** GDPR (consent, right to access/delete, portability), Financial (KYC, transaction limits, STRs, 7yr retention), PCI-DSS (no card storage, tokenization).

### /pen-test
**Pen Test Support** - `trigger: /pen-test <phase>`

**Phases:** prep (scope, test env, accounts), support (monitor, access), remediation (review findings, prioritize, create tickets, retest).

### /audit-log
**Query Audit Logs** - `trigger: /audit-log <query-type> [filters]`

**Query Types:** user, resource, action, timerange, suspicious

```bash
/audit-log user usr_123 --last=7days
/audit-log resource loan_456 --last=30days
/audit-log suspicious --last=7days
```

**Audited:** auth.*, customer.*, loan.*, payment.*, device.*, admin.*

---

## Documentation Skills

### /doc
**Generate Documentation** - `trigger: /doc <file-or-module>`

Creates JSDoc comments with @description, @param, @returns, @example, @throws, @see.

### /api-doc
**API Documentation** - `trigger: /api-doc <service>`

Generates OpenAPI/Swagger spec at `docs/api/<service>.yaml`.

### /runbook
**Operational Runbook** - `trigger: /runbook <procedure>`

Template: Overview, Prerequisites, Step-by-step commands, Rollback, Escalation, Post-procedure checks.

### /postmortem
**Incident Postmortem** - `trigger: /postmortem <incident-id>`

Template: Summary (date, duration, impact, severity), Timeline, Root cause, What went well, Improvements, Action items, Lessons learned.

### /onboard
**Developer Onboarding** - `trigger: /onboard <name> [role]`

**Checklist:**
- Day 1: Environment setup, access grants
- Day 1-2: Read CLAUDE.md, skills.md, architecture
- Day 2-3: Domain knowledge, customer journey
- Day 3-5: First PR, deploy to staging
- Week 2: Payment/scoring deep dive, code review
- Week 3-4: Own a feature, on-call shadow

**Roles:** backend (Lambda, RLS), frontend (Next.js, accessibility), devops (SAM, CI/CD)

---

## Compliance & Zimbabwe Skills

### /data-export
**GDPR Data Export** - `trigger: /data-export <customer-id>`

Exports: Profile, KYC (redacted), loans, payments, communications, devices, consents.

**Process:** Verify identity → Gather data → Format (JSON/PDF) → Encrypt → Deliver secure link (7 days) → Audit.

### /rbz-report
**RBZ Reporting** - `trigger: /rbz-report <type> <period>`

**Types:**
- **Monthly**: Disbursed/collected totals, active loans, KYC stats, large transactions
- **STR**: Suspicious transaction within 24h - transaction details, indicators, investigation summary
- **Annual**: Full compliance audit

### /mobile-money-test
**Mobile Money Testing** - `trigger: /mobile-money-test <provider> <scenario>`

**Providers:** ecocash, onemoney, all
**Scenarios:** payment, refund, status, timeout, all

**Test Numbers (Sandbox):**
```yaml
ecocash:  +263771000001 (success), +263771000002 (insufficient), +263771000003 (timeout)
onemoney: +263713000001 (success), +263713000002 (insufficient), +263713000003 (timeout)
```

---

## Quick Commands

```bash
# TDD
/tdd loan-approval              /test                    /coverage scoring-service

# Git
/commit feat loans              /hotfix payment-timeout  /changelog 1.2.0

# Review
/review src/services/pay.ts     /pr-review 123           /security-review

# DevOps
/deploy staging                 /rollback prod v1.1.0    /health

# Security
/security-audit payment         /audit-log user usr_123  /compliance gdpr

# Zimbabwe
/rbz-report monthly 2024-01     /mobile-money-test ecocash all
```

---

## Principles

1. **Security First** - Never compromise for speed
2. **Test-Driven** - Write tests before code
3. **Privacy by Design** - Minimize data, maximize protection
4. **Financial Inclusion** - Design for the underbanked
5. **Code Quality** - Review thoroughly, merge confidently
6. **Operational Excellence** - Monitor, alert, respond, learn

> "Move fast without breaking things. In fintech, broken things break lives."
