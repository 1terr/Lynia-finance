# Lynia Finance - Full Deployment Audit Report

**Date:** 2026-02-16
**Scope:** Git commit status, AWS deployment verification, CI/CD pipeline analysis, production health

---

## Executive Summary

| Tier | Status | Details |
|------|--------|---------|
| Git/GitHub | OK with caveats | All code pushed to `origin/master`. 4 uncommitted items (1 modified file, 3 untracked artifacts) |
| AWS Infrastructure | MOSTLY HEALTHY | 12/13 CloudFormation stacks healthy. 1 stack (`production-lynia-sqs`) in `ROLLBACK_COMPLETE`. All 11 Lambda functions deployed and running. |
| CI/CD Pipeline | BROKEN | **All 15 recent `deploy.yml` runs have FAILED.** Root cause: `cfn-lint` circular dependency error in `template.yaml`. Frontend deploys (`deploy-frontend.yml`) are all passing. |
| Live Website | OPERATIONAL | Admin portal serving HTTP 200. API Gateways responding. Frontend deployed at commit `e4a7dc7`. |

---

## 1. Git Commit Audit

**Branch:** `master` (up to date with `origin/master`)

### Uncommitted Items

| File | Status | Related Phase/Task | Action Needed |
|------|--------|--------------------|---------------|
| `infrastructure/aws/sqs-queues.yaml` | Modified | Phase 8 - Fineract Sync Retry Queue (adds `FineractSyncRetryQueue` + DLQ + CloudWatch alarm) | **COMMIT** - Important infra change for Fineract retry logic |
| `outfile.json` | Untracked | Phase 7 - Fineract init Lambda invocation output (`{"glAccountCount":21,"loanProductIds":"2,3,4","status":"SUCCESS"}`) | **GITIGNORE or DELETE** - Temporary test artifact |
| `scripts/migration-runner.zip` | Untracked | Phase 7 - Temporary Lambda deployment package for DB migration 019 | **GITIGNORE or DELETE** - Build artifact (2.7MB) |
| `scripts/migration-runner/` | Untracked | Phase 7 - Source for temporary migration runner Lambda | **GITIGNORE or DELETE** - Temporary utility, no longer needed |

### Key Finding
The `sqs-queues.yaml` change is the only meaningful uncommitted work. It adds Fineract sync retry infrastructure (queue + DLQ + alarm) needed for Phase 8 completion.

---

## 2. AWS Deployment Verification

### CloudFormation Stacks

| Stack | Status | Last Updated | Notes |
|-------|--------|-------------|-------|
| `lynia-finance-prod` | UPDATE_COMPLETE | 2026-02-16T11:44Z | Main stack (6 Lambda services) |
| `lynia-fineract-proxy-prod` | CREATE_COMPLETE | 2026-02-16T17:51Z | Fineract proxy (1 Lambda) |
| `production-lynia-fineract-ecs` | UPDATE_COMPLETE | 2026-02-16T09:20Z | Fineract on ECS Fargate |
| `production-lynia-fineract-init` | UPDATE_COMPLETE | 2026-02-16T15:06Z | Fineract DB initialization |
| `production-lynia-fineract-monitoring` | CREATE_COMPLETE | 2026-02-16T09:47Z | CloudWatch dashboards |
| `production-lynia-fineract-db-init` | CREATE_COMPLETE | 2026-02-16T01:06Z | Database init Lambda |
| `production-lynia-cognito` | UPDATE_COMPLETE | 2026-02-13T07:08Z | Cognito User Pool |
| `lynia-rds-production` | CREATE_COMPLETE | 2026-02-14T14:54Z | RDS PostgreSQL 16 |
| `production-lynia-vpc` | CREATE_COMPLETE | 2026-02-13T13:54Z | VPC + private subnets |
| `lynia-finance-prod-frontend` | UPDATE_COMPLETE | 2026-02-14T21:41Z | S3 + CloudFront |
| `lynia-finance-production-waf` | CREATE_COMPLETE | 2026-02-14T16:47Z | WAF rules |
| `lynia-finance-staging` | UPDATE_COMPLETE | 2026-02-09T14:32Z | Staging environment |
| **`production-lynia-sqs`** | **ROLLBACK_COMPLETE** | 2026-02-13T09:12Z | **FAILED** - IAM permission issue (see below) |

### SQS Stack Failure
The `production-lynia-sqs` stack failed because the `github-actions-deploy` IAM user lacks `sqs:CreateQueue` permission. All 5 queue creation attempts failed with `AccessDenied`. **The SQS queues are NOT deployed.**

**Fix required:** Add `sqs:CreateQueue`, `sqs:SetQueueAttributes`, `sqs:TagQueue`, `sqs:DeleteQueue`, and `sqs:GetQueueAttributes` permissions to the `github-actions-deploy` IAM user policy, then delete the failed stack and redeploy.

### Lambda Functions (11 deployed)

| Function | Runtime | Last Updated |
|----------|---------|-------------|
| `production-lynia-scoring-service` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-whatsapp-service` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-kyc-service` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-payment-service` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-lock-service` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-notification-service` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-form-submission` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-fineract-reconciliation` | nodejs20.x | 2026-02-16T11:44Z |
| `production-lynia-fineract-init` | nodejs18.x | 2026-02-16T15:30Z |
| `production-lynia-fineract-db-init` | nodejs18.x | 2026-02-16T01:06Z |
| `production-lynia-fineract-proxy` | nodejs20.x | 2026-02-16T17:51Z |

**Note:** Lambda functions were last deployed at 11:44Z via manual SAM deploy (not CI/CD). The 5 Phase 8 commits (e4a7dc7 through 000bb9b, pushed 18:50-19:10Z) have **NOT been deployed** to Lambda because CI/CD is broken.

### Frontend Deployment

| App | Deployed Version | Status |
|-----|-----------------|--------|
| Admin Portal | `v20260216-185152-e4a7dc7` | HTTP 200 |
| Distributor Dashboard | `v20260216-185152-e4a7dc7` | Deployed |
| Landing Page | No CURRENT_VERSION file | Unknown |

Frontend deployment (`deploy-frontend.yml`) is working correctly. Both admin portal and distributor dashboard are at the latest commit `e4a7dc7`.

### API Gateways

| Gateway | Response | Status |
|---------|----------|--------|
| Main API (`kly80hrgca`) | `{"message":"Missing Authentication Token"}` | RESPONDING (auth required) |
| Fineract Proxy (`94al6ng32i`) | `{"message":"Missing Authentication Token"}` | RESPONDING (auth required) |

Both API Gateways are responding. The "Missing Authentication Token" message is expected for unauthenticated health check requests since Cognito auth is enabled.

---

## 3. CI/CD Pipeline Failure Analysis

### deploy.yml - ALL RUNS FAILING

**15 consecutive failures** from Feb 14 to Feb 16.

| Run ID | Date | Commit | Failed Stage | Failed Step | Root Cause |
|--------|------|--------|-------------|-------------|------------|
| 22074769902 | Feb 16 19:10 | `000bb9b` fix: IsProduction condition | Build Lambda | SAM Validate | cfn-lint E3004 + W8001 |
| 22074691581 | Feb 16 19:06 | `55039d5` fix: webhook verify token | Build Lambda | SAM Validate | cfn-lint E3004 + W8001 |
| 22074501399 | Feb 16 18:58 | `9730118` fix: webhook bypass | Build Lambda | SAM Validate | cfn-lint E3004 + W8001 |
| 22074405100 | Feb 16 18:54 | `7eac852` fix: lint errors | Build Lambda | SAM Validate | cfn-lint E3004 + W8001 |
| 22074358988 | Feb 16 18:52 | `74d2762` fix: WhatsApp lint | Build Lambda | SAM Validate | cfn-lint E3004 + W8001 |
| 22074298212 | Feb 16 18:50 | `e4a7dc7` Phase 8 completion | Build Lambda | SAM Validate | cfn-lint E3004 + W8001 |
| 22069774880 | Feb 16 16:05 | `24230b1` Cognito credentials | Lint & Test | Run linter | ESLint errors |
| 22069132228 | Feb 16 15:45 | `09c1c85` Phase 7 deployment | Lint & Test | Run linter | ESLint errors |
| 22059799850 | Feb 16 10:51 | `0559ad3` Phase 6B/6C | Lint & Test | Run linter | ESLint errors |
| 22057838876 | Feb 16 09:49 | `8632c3e` Fineract ECS | Lint & Test | Run linter | ESLint errors |
| 22046564165 | Feb 16 00:59 | `4debe65` SAM template fix | Lint & Test | Run linter | ESLint errors |
| 22045485423 | Feb 15 23:55 | PR #383 merge | Lint & Test | Run linter | ESLint errors |
| 22033257765 | Feb 15 09:25 | PR #381 merge | Lint & Test | Run linter | ESLint errors (unused vars) |
| 22015635847 | Feb 14 10:14 | PR #369 merge | Lint & Test | Run linter | ESLint errors |
| 22015463235 | Feb 14 10:01 | PR #368 merge | Lint & Test | Run linter | ESLint errors |

### Root Causes (2 distinct issues)

#### Issue 1: cfn-lint Circular Dependency (E3004) - CURRENT BLOCKER

```
E3004: Circular Dependencies for resource LyniaApi.
       Circular dependency with [WhatsAppFunction]
E3004: Circular Dependencies for resource WhatsAppFunction.
       Circular dependency with [LyniaApi]
W8001: Condition HasCognitoArn not used
```

**Location:** `template.yaml` lines 195 and 286

**Cause:** `WhatsAppFunction` references `LyniaApi` in its env var `SCORING_API_URL` (line 318):
```yaml
SCORING_API_URL: !Sub "https://${LyniaApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/scoring/calculate"
```
Meanwhile, `WhatsAppFunction` also has API events attached to `LyniaApi` (lines 324, 330, 338). This creates: `LyniaApi` -> `WhatsAppFunction` (implicit from events) and `WhatsAppFunction` -> `LyniaApi` (from env var Ref).

**Fix options:**
1. **Replace the dynamic reference** with a hardcoded URL or SSM parameter lookup for `SCORING_API_URL`
2. **Use `!Sub` with just the region/account** and construct the URL without referencing `LyniaApi` directly
3. **Add a `.cfnlintrc` file** to suppress E3004 if SAM resolves this at deploy time (it works locally, just fails lint)

#### Issue 2: ESLint Unused Variables (older runs)

Two unused variable errors that were fixed by commits `74d2762` through `000bb9b`:
- `FineractCommandResponse` defined but never used
- `csvContent` assigned but never used

These ESLint errors were fixed in Phase 8 follow-up commits.

### deploy-frontend.yml - ALL RUNS PASSING

All 10 recent frontend deployment runs succeeded. Frontend CI/CD is healthy.

---

## 4. Deployment Gap Analysis

### What's deployed vs what's committed

| Component | Deployed Version (AWS) | Latest on master | Gap? |
|-----------|----------------------|-----------------|------|
| Lambda functions (main stack) | Deployed at 11:44Z (before Phase 8 commits) | `e4a7dc7` + 5 fix commits | **YES** - Phase 8 proxy changes and lint fixes not deployed to main stack Lambdas |
| Fineract proxy Lambda | `e4a7dc7` (17:51Z) | Same | No gap |
| Admin Portal | `v20260216-185152-e4a7dc7` | Same | No gap |
| Distributor Dashboard | `v20260216-185152-e4a7dc7` | Same | No gap |
| SQS Queues (standalone stack) | NOT DEPLOYED (ROLLBACK_COMPLETE) | `sqs-queues.yaml` has new Fineract retry queue | **YES** - SQS stack never deployed + has uncommitted new queue |

---

## 5. Action Items (Priority Order)

### P0 - Critical (fix today)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Fix cfn-lint E3004 circular dependency in `template.yaml`** | Unblocks ALL CI/CD backend deployments | 15 min |
| 2 | **Remove unused `HasCognitoArn` condition** from `template.yaml` line 188 | Eliminates W8001 warning | 2 min |
| 3 | **Commit `infrastructure/aws/sqs-queues.yaml`** changes (Fineract sync retry queue) | Gets retry infrastructure tracked in git | 5 min |
| 4 | **Add SQS IAM permissions** to `github-actions-deploy` user, delete ROLLBACK_COMPLETE stack, redeploy | Deploys the 5 SQS queues to production | 30 min |

### P1 - Important (this week)

| # | Action | Impact |
|---|--------|--------|
| 5 | Clean up temporary artifacts (`outfile.json`, `scripts/migration-runner*`) - add to `.gitignore` or delete | Keeps repo clean |
| 6 | Run CI/CD pipeline end-to-end after P0 fixes to validate full deployment pipeline | Confirms automated deploys work |
| 7 | Add unauthenticated `/health` endpoint to API Gateway (bypass Cognito auth) | Enables proper health monitoring |
| 8 | Set up CloudWatch alarms for all Lambda functions error rates | Production monitoring |

### P2 - Nice to Have

| # | Action |
|---|--------|
| 9 | Add deployment smoke test (`scripts/deployment-smoke-test.sh`) to CI/CD pipeline as post-deploy step |
| 10 | Consolidate Fineract proxy into main SAM stack to avoid managing two stacks |

---

## 6. Smoke Test Script

A deployment smoke test script has been created at `scripts/deployment-smoke-test.sh`. It checks:
- All 13 CloudFormation stack statuses
- All 11 Lambda function existence and runtimes
- Frontend S3 bucket deployment versions
- API Gateway responsiveness
- Cognito User Pool availability
- Latest CI/CD run status

Run with: `bash scripts/deployment-smoke-test.sh`

---

## Appendix: Phase-to-Commit Mapping (Feb 15-16)

| Phase | Commits | Deployed? |
|-------|---------|-----------|
| Phase 1B (Supabase migration) | `9d69a19`, `4009d74` | Yes (via manual SAM deploy) |
| Phase 6A (Fineract ECS) | `8632c3e`, `4debe65` | Yes (separate CloudFormation stacks) |
| Phase 6B/6C (Fineract wiring) | `0559ad3` | Yes (via manual SAM deploy) |
| Phase 7 (Production deploy) | `09c1c85`, `24230b1` | Yes (via manual SAM deploy + manual S3 upload) |
| Phase 8 (Fineract completion) | `e4a7dc7`, `74d2762`, `7eac852`, `9730118`, `55039d5`, `000bb9b` | **PARTIAL** - Fineract proxy deployed, main stack NOT redeployed with latest |
| KYC/DIDIT migration | `cc37956`, `1e2c88e`, `7eb3552` | N/A (code only, not wired into Lambda services) |
| WhatsApp hardening | `3e315d8` | Yes (via manual SAM deploy) |
