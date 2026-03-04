#!/bin/bash
# Phase 4: Create GitHub Issues
# Run: gh auth login && bash phase-4-integration/admin/create-github-issues.sh
#
# This script creates all 15 Phase 4 GitHub issues with proper labels,
# acceptance criteria, and auto-close configuration.
# Issues are automatically closed when a commit/PR includes "Closes #<NUMBER>".

set -euo pipefail

REPO="1terr/Lynia-finance"
LABEL_PHASE="phase-4"
CREATED_ISSUES=()

echo "=== Phase 4: Creating GitHub Issues ==="
echo "Repository: $REPO"
echo ""

# Ensure phase-4 label exists
gh label create "$LABEL_PHASE" --repo "$REPO" --description "Phase 4: Integration Testing & Production Deployment" --color "0E8A16" 2>/dev/null || true
gh label create "testing" --repo "$REPO" --description "Integration and E2E testing" --color "BFD4F2" 2>/dev/null || true
gh label create "performance" --repo "$REPO" --description "Performance and load testing" --color "D4C5F9" 2>/dev/null || true
gh label create "security" --repo "$REPO" --description "Security audit and hardening" --color "B60205" 2>/dev/null || true
gh label create "compliance" --repo "$REPO" --description "Regulatory compliance" --color "FBCA04" 2>/dev/null || true
gh label create "monitoring" --repo "$REPO" --description "Monitoring and observability" --color "006B75" 2>/dev/null || true
gh label create "uat" --repo "$REPO" --description "User acceptance testing" --color "C2E0C6" 2>/dev/null || true
gh label create "deployment" --repo "$REPO" --description "Deployment and go-live" --color "5319E7" 2>/dev/null || true

echo "Labels created/verified."
echo ""

# --- P4-T001 ---
echo "Creating P4-T001..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T001: End-to-End Integration Test Suite" \
  --label "$LABEL_PHASE,testing,critical" \
  --body "$(cat <<'BODY'
## Description

Build comprehensive E2E integration tests covering all critical user journeys across the full service stack (6 Lambda services, 47+ database tables, 2 frontend applications).

**Priority:** Critical | **Estimate:** 20h | **Dependencies:** Phase 3 complete

## Acceptance Criteria

- [ ] E2E test framework set up (Jest + Supertest + Supabase test helpers)
- [ ] Customer onboarding flow test passes (WhatsApp → KYC → Approval)
- [ ] Loan application lifecycle test passes (Apply → Score → Approve → Disburse)
- [ ] Payment processing test passes (Initiate → Confirm → Update balance → Receipt)
- [ ] Device handover & lock/unlock cycle test passes
- [ ] Admin loan approval workflow test passes
- [ ] Distributor inventory & commission flow test passes
- [ ] Test database seeding and teardown automated
- [ ] Test coverage >= 80% on integration paths
- [ ] Tests run in CI pipeline within 5 minutes

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T001-PROGRESS.md`
- Task Specification: `phase-4-integration/PHASE-4-TASKS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T001")

# --- P4-T002 ---
echo "Creating P4-T002..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T002: API Contract Testing & Validation" \
  --label "$LABEL_PHASE,testing,high-priority" \
  --body "$(cat <<'BODY'
## Description

Validate that all API contracts between services, frontend, and external providers match specifications. Define OpenAPI specs and write contract tests for all 6 services.

**Priority:** High | **Estimate:** 16h | **Dependencies:** P4-T001

## Acceptance Criteria

- [ ] OpenAPI/Swagger specs defined for all service endpoints
- [ ] Contract tests written for scoring-service API
- [ ] Contract tests written for payment-service API (EcoCash, OneMoney, InnBucks)
- [ ] Contract tests written for kyc-service API (DIDIT)
- [ ] Contract tests written for whatsapp-service API (webhook payloads)
- [ ] Contract tests written for lock-service API (Trustonic)
- [ ] Contract tests written for notification-service API
- [ ] Frontend API client validated against backend contracts
- [ ] Error responses follow standard ErrorResponse format
- [ ] No breaking changes detected between frontend and backend

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T002-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T002")

# --- P4-T003 ---
echo "Creating P4-T003..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T003: Cross-Service Data Flow Testing" \
  --label "$LABEL_PHASE,testing,high-priority" \
  --body "$(cat <<'BODY'
## Description

Verify data integrity and consistency across service boundaries, database transactions, and event flows. Ensure RLS policies enforce proper data isolation.

**Priority:** High | **Estimate:** 12h | **Dependencies:** P4-T001

## Acceptance Criteria

- [ ] Customer data propagation verified (WhatsApp → KYC → Scoring → Loan)
- [ ] Payment reconciliation correct across services
- [ ] Device status synchronization verified (lock-service ↔ admin dashboard)
- [ ] Notification delivery chain verified (event → queue → WhatsApp/SMS)
- [ ] Audit trail captures all CRUD operations on sensitive tables
- [ ] RLS policies pass all isolation tests
- [ ] Concurrent operations do not cause race conditions
- [ ] Materialized views reflect accurate data within 5-minute window

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T003-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T003")

# --- P4-T004 ---
echo "Creating P4-T004..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T004: Performance Benchmarking & Load Testing" \
  --label "$LABEL_PHASE,performance,critical" \
  --body "$(cat <<'BODY'
## Description

Establish performance baselines and validate the system handles projected load under normal (100 concurrent), peak (500), and stress (1000) conditions.

**Priority:** Critical | **Estimate:** 16h | **Dependencies:** P4-T001

## Acceptance Criteria

- [ ] Load testing framework set up (k6 or Artillery)
- [ ] Load profiles defined (normal, peak, stress)
- [ ] WhatsApp webhook processing throughput benchmarked
- [ ] Credit scoring API response times benchmarked
- [ ] Payment processing end-to-end latency benchmarked
- [ ] Admin dashboard page load times benchmarked
- [ ] Lambda cold start performance tested (< 3s target)
- [ ] Database connection pooling validated under load
- [ ] API p95 latency < 300ms under normal load
- [ ] API p99 latency < 1000ms under peak load
- [ ] Error rate < 1% under peak load
- [ ] Bottleneck analysis documented

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T004-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T004")

# --- P4-T005 ---
echo "Creating P4-T005..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T005: Database Query Optimization & Stress Testing" \
  --label "$LABEL_PHASE,database,high-priority" \
  --body "$(cat <<'BODY'
## Description

Optimize slow queries identified during load testing and validate database resilience under stress. Focus on connection pooling, indexing, and partitioning.

**Priority:** High | **Estimate:** 12h | **Dependencies:** P4-T004

## Acceptance Criteria

- [ ] EXPLAIN ANALYZE run on all critical queries
- [ ] Missing indexes added on frequently queried columns
- [ ] JOIN operations optimized in reporting queries
- [ ] Connection pooling configuration verified (PgBouncer)
- [ ] All critical queries execute in < 100ms
- [ ] Reporting queries execute in < 500ms
- [ ] Connection pool handles 200 concurrent connections
- [ ] No query locks exceed 5 seconds
- [ ] Database handles 10,000 transactions/hour without degradation
- [ ] Table partitioning validated for transactions and audit_logs

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T005-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T005")

# --- P4-T006 ---
echo "Creating P4-T006..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T006: Security Audit & Vulnerability Assessment" \
  --label "$LABEL_PHASE,security,critical" \
  --body "$(cat <<'BODY'
## Description

Conduct comprehensive security review covering OWASP Top 10, authentication, data protection, and infrastructure hardening across all services and frontends.

**Priority:** Critical | **Estimate:** 20h | **Dependencies:** P4-T001

## Acceptance Criteria

- [ ] OWASP ZAP automated scan run against all API endpoints
- [ ] JWT token validation reviewed across all services
- [ ] TLS 1.3 enforcement verified on all external communications
- [ ] SQL injection resistance confirmed (parameterized queries)
- [ ] XSS protection verified on admin dashboard and distributor portal
- [ ] Rate limiting verified on auth, OTP, and payment endpoints
- [ ] RLS policies reviewed for privilege escalation vulnerabilities
- [ ] Secrets management audited (no hardcoded keys)
- [ ] PII encrypted at rest (AES-256) and in transit (TLS 1.3)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] bcrypt hashing verified (cost factor >= 12)
- [ ] Error messages verified not to leak system information
- [ ] Zero critical or high vulnerabilities remaining

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T006-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T006")

# --- P4-T007 ---
echo "Creating P4-T007..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T007: Compliance Verification & Regulatory Checklist" \
  --label "$LABEL_PHASE,compliance,high-priority" \
  --body "$(cat <<'BODY'
## Description

Verify compliance with Reserve Bank of Zimbabwe (RBZ) regulations, data privacy requirements (POPIA), and financial services standards.

**Priority:** High | **Estimate:** 12h | **Dependencies:** P4-T006

## Acceptance Criteria

- [ ] KYC data collection matches RBZ requirements (National ID, residence, income)
- [ ] Transaction limits enforced (daily $5,000, monthly $50,000, single $2,000)
- [ ] Record retention automated (transactions: 7yr, KYC: 10yr, audit: 5yr)
- [ ] STR generation functional within 24 hours
- [ ] Monthly transaction reporting capability verified
- [ ] Multi-currency handling correct (USD, ZWL, ZAR - amounts in cents)
- [ ] Customer data export functional (GDPR-style rights)
- [ ] Right-to-deletion operational (soft delete → hard delete after retention)
- [ ] Consent tracking verified for data collection and third-party sharing
- [ ] Fee disclosure transparent in WhatsApp flows
- [ ] Audit trail complete for regulatory inspections

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T007-PROGRESS.md`
- Reference: `services/shared/regulatory-reporting.ts`, `services/shared/data-privacy.ts`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T007")

# --- P4-T008 ---
echo "Creating P4-T008..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T008: Production Environment Provisioning" \
  --label "$LABEL_PHASE,infrastructure,critical" \
  --body "$(cat <<'BODY'
## Description

Provision and configure production AWS infrastructure with proper security, networking, scaling policies, and frontend deployment via S3 + CloudFront CDN.

**Priority:** Critical | **Estimate:** 16h | **Dependencies:** None

## Acceptance Criteria

- [ ] Production AWS account with proper IAM roles and policies
- [ ] Production Supabase project deployed (separate from staging)
- [ ] VPC, subnets, and security groups configured
- [ ] All 6 Lambda functions deployed with production config
- [ ] API Gateway with custom domain and SSL certificates
- [ ] Route 53 DNS records configured
- [ ] CloudFront CDN serving frontend applications
- [ ] AWS Secrets Manager storing all production secrets
- [ ] Database connection pooling configured (PgBouncer)
- [ ] Auto-scaling policies tested and verified
- [ ] AWS WAF rules active and blocking malicious traffic

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T008-PROGRESS.md`
- Reference: `infrastructure/aws/` - SAM templates

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T008")

# --- P4-T009 ---
echo "Creating P4-T009..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T009: CI/CD Pipeline Hardening & Deployment Automation" \
  --label "$LABEL_PHASE,infrastructure,high-priority" \
  --body "$(cat <<'BODY'
## Description

Harden CI/CD pipeline for production deployments with automated testing gates, manual approval, canary deployments, and automated rollback.

**Priority:** High | **Estimate:** 12h | **Dependencies:** P4-T008

## Acceptance Criteria

- [ ] Multi-stage pipeline configured (dev → staging → production)
- [ ] Automated test gates block deployment on failure
- [ ] Manual approval required for production deployments
- [ ] Canary deployments detect errors and auto-roll back
- [ ] Full deployment completes in < 15 minutes
- [ ] Rollback completes in < 5 minutes
- [ ] Zero-downtime deployments verified
- [ ] Security scanning step included (dependency audit, SAST)
- [ ] Deployment notifications configured (Slack/email)
- [ ] Blue-green deployment for frontend

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T009-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T009")

# --- P4-T010 ---
echo "Creating P4-T010..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T010: Production Monitoring & Alerting Setup" \
  --label "$LABEL_PHASE,monitoring,high-priority" \
  --body "$(cat <<'BODY'
## Description

Set up comprehensive production monitoring, alerting, and dashboards for all SLOs, business metrics, technical health, security events, and cost tracking.

**Priority:** High | **Estimate:** 16h | **Dependencies:** P4-T008

## Acceptance Criteria

- [ ] CloudWatch metrics configured for all Lambda functions
- [ ] Custom business metrics tracked (loan applications, payments, error rates)
- [ ] 5 dashboards created: real-time, business, technical, security, cost
- [ ] Alert thresholds configured (critical → page, warning → Slack, info → log)
- [ ] Error rate alerts active (> 5% critical, > 1% warning)
- [ ] Latency alerts active (p95 > 500ms warning, p99 > 1000ms critical)
- [ ] Availability monitoring for 99.9% SLO target
- [ ] Payment service health checks configured (highest priority)
- [ ] Database monitoring active (connections, query latency, disk usage)
- [ ] Lambda cold start monitoring active
- [ ] Critical alerts trigger within 60 seconds
- [ ] On-call runbook created

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T010-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T010")

# --- P4-T011 ---
echo "Creating P4-T011..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T011: Logging Infrastructure & Audit Trail Verification" \
  --label "$LABEL_PHASE,monitoring,high-priority" \
  --body "$(cat <<'BODY'
## Description

Verify structured logging across all services, ensure audit trail completeness for regulatory compliance, and validate that sensitive data is never logged.

**Priority:** High | **Estimate:** 12h | **Dependencies:** P4-T010

## Acceptance Criteria

- [ ] Structured log format verified (timestamp, level, service, requestId, action, status)
- [ ] NEVER_LOG fields confirmed masked/excluded (passwords, PINs, OTPs, full IDs)
- [ ] Log masking functions verified in production config
- [ ] Correlation IDs propagate across all 6 service boundaries
- [ ] CloudWatch Logs retention policies configured per environment
- [ ] Audit trail covers 100% of financial operations
- [ ] Log retention matches regulatory requirements (5+ years for audit)
- [ ] Log queries return results within 10 seconds
- [ ] Log archival to S3 configured for long-term retention
- [ ] Log levels correct per environment (INFO in production, no DEBUG)

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T011-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T011")

# --- P4-T012 ---
echo "Creating P4-T012..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T012: UAT Test Plan & Execution" \
  --label "$LABEL_PHASE,uat,high-priority" \
  --body "$(cat <<'BODY'
## Description

Execute user acceptance testing with stakeholders covering all 8 critical business scenarios to validate requirements are met before production launch.

**Priority:** High | **Estimate:** 16h | **Dependencies:** P4-T001, P4-T006

## Acceptance Criteria

- [ ] UAT test plan document created with all business scenarios
- [ ] UAT environment set up (staging with production-like data)
- [ ] Scenario 1: New customer onboarding via WhatsApp (Shona language) passes
- [ ] Scenario 2: Loan application, scoring, and approval passes
- [ ] Scenario 3: Payment processing (EcoCash, OneMoney) passes
- [ ] Scenario 4: Device handover and activation passes
- [ ] Scenario 5: Overdue payment → device lock → payment → unlock passes
- [ ] Scenario 6: Admin dashboard workflow (loan review, approval) passes
- [ ] Scenario 7: Distributor device inventory and commission tracking passes
- [ ] Scenario 8: Regulatory report generation passes
- [ ] No critical or high-severity bugs remaining
- [ ] Stakeholder sign-off obtained
- [ ] WhatsApp flows verified on low-end devices
- [ ] Multi-language support verified (English, Shona, Ndebele)

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T012-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T012")

# --- P4-T013 ---
echo "Creating P4-T013..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T013: Pilot User Onboarding & Feedback Collection" \
  --label "$LABEL_PHASE,uat,medium-priority" \
  --body "$(cat <<'BODY'
## Description

Onboard a small group of pilot users (5-10 distributors, 20-30 customers) in the Harare area to validate real-world usage and collect structured feedback.

**Priority:** Medium | **Estimate:** 12h | **Dependencies:** P4-T012

## Acceptance Criteria

- [ ] 5-10 pilot distributors selected and onboarded in Harare area
- [ ] Pilot onboarding guide created (simple, visual, multi-language)
- [ ] Pilot environment configured with monitoring and feature flags
- [ ] >= 80% pilot onboarding completion rate
- [ ] Zero critical system failures during pilot
- [ ] Average customer onboarding < 20 minutes
- [ ] Distributor feedback score >= 7/10
- [ ] All payment transactions reconcile correctly
- [ ] NPS survey collected via WhatsApp
- [ ] Common user confusion points documented with UX improvements
- [ ] Go/no-go recommendation for full launch created

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T013-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T013")

# --- P4-T014 ---
echo "Creating P4-T014..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T014: Production Deployment Runbook & Rollback Plan" \
  --label "$LABEL_PHASE,deployment,critical" \
  --body "$(cat <<'BODY'
## Description

Create comprehensive deployment runbook with step-by-step procedures, tested rollback mechanisms, and incident response playbook for production operations.

**Priority:** Critical | **Estimate:** 12h | **Dependencies:** P4-T008, P4-T009

## Acceptance Criteria

- [ ] Step-by-step deployment runbook (pre-deploy, deploy, post-deploy)
- [ ] Database migration procedures documented (forward and rollback)
- [ ] Service-level rollback procedures for each Lambda function
- [ ] Frontend rollback documented (CloudFront + S3 versioning)
- [ ] Incident response playbook covers P1/P2 scenarios
- [ ] Rollback trigger criteria defined (error rate, latency, business impact)
- [ ] Full deployment + rollback cycle tested in staging
- [ ] Communication plan documented (escalation matrix)
- [ ] DNS failover procedures documented
- [ ] Emergency contacts verified and responsive
- [ ] Rollback completes within 5 minutes

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T014-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T014")

# --- P4-T015 ---
echo "Creating P4-T015..."
ISSUE_NUM=$(gh issue create --repo "$REPO" \
  --title "P4-T015: Go-Live Checklist & Launch Readiness Review" \
  --label "$LABEL_PHASE,deployment,high-priority" \
  --body "$(cat <<'BODY'
## Description

Final launch readiness review ensuring all systems, processes, and teams are prepared for production go-live. This is the final gate before launching Lynia Finance.

**Priority:** High | **Estimate:** 8h | **Dependencies:** All P4 tasks

## Acceptance Criteria

- [ ] Go-live checklist completed (technical, business, compliance, operations)
- [ ] All P4 tasks completed and signed off
- [ ] Production environment smoke tests passing
- [ ] Monitoring and alerting active and tested
- [ ] On-call rotation scheduled and team trained
- [ ] All critical/high bugs closed
- [ ] Backup and disaster recovery procedures verified
- [ ] Regulatory filings complete (RBZ notification)
- [ ] Launch communication prepared (internal, distributors, press)
- [ ] Launch readiness meeting conducted with all stakeholders
- [ ] Stakeholder approval for go-live obtained
- [ ] Phase 4 Summary Report completed

## Related Files

- Progress Report: `phase-4-integration/task-reports/P4-T015-PROGRESS.md`

## Auto-Close

This issue will be automatically closed when a commit or PR with `Closes #<this-issue>` is merged.
BODY
)" 2>&1 | grep -oE '[0-9]+$')
echo "  Created issue #$ISSUE_NUM"
CREATED_ISSUES+=("$ISSUE_NUM:P4-T015")

echo ""
echo "=== Summary ==="
echo "Created ${#CREATED_ISSUES[@]} issues:"
for issue in "${CREATED_ISSUES[@]}"; do
  echo "  #${issue%%:*} - ${issue#*:}"
done
echo ""
echo "View all Phase 4 issues:"
echo "  gh issue list --label phase-4 --repo $REPO"
echo ""
echo "Auto-close: Use 'Closes #NUMBER' in commit messages to close issues on merge."
