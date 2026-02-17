# Phase 12: Production Deployment Report

**Date:** 2026-02-17
**Scope:** Full production deployment — backend Lambda services, frontend websites, CI/CD workflow fixes
**Status:** COMPLETED
**Triggered by:** Staging-to-production promotion

---

## Executive Summary

Successfully deployed all Lynia Finance components to AWS production:

| Component | Status | Production URL |
|-----------|--------|----------------|
| Backend Lambda + API Gateway | UPDATE_COMPLETE | `https://api.lyniafinance.com` |
| Admin Portal | HTTP 200 | `https://admin.lyniafinance.com` |
| Distributor Dashboard | HTTP 200 | `https://distributor.lyniafinance.com` |
| Landing Page | HTTP 200 | `https://lyniafinance.com` |

**CI/CD Bugs Fixed:** 2 CloudFormation stack name mismatches corrected before deployment could proceed.

---

## Pre-Deployment: CI/CD Workflow Fixes

### Fix 1: Database Migration Workflow — RDS Stack Name

**Problem:** `run-db-migrations.yml` constructed the RDS stack name as `${ENV}-lynia-rds` → `production-lynia-rds`, but the actual stack is named `lynia-rds-production`.

**Fix:** Added conditional logic for production:
```yaml
if [ "${ENV}" = "production" ]; then
  RDS_STACK="lynia-rds-production"
else
  RDS_STACK="${ENV}-lynia-rds"
fi
```

**File:** `.github/workflows/run-db-migrations.yml`

### Fix 2: Frontend Deploy Workflow — Frontend Stack Name

**Problem:** `deploy-frontend.yml` referenced `${DEPLOY_ENV}-lynia-frontend` → `production-lynia-frontend`, but the actual stack is named `lynia-finance-prod-frontend`.

**Fix:** Added `FRONTEND_STACK` environment variable with conditional mapping:
```yaml
FRONTEND_STACK: ${{ (inputs.environment || 'production') == 'production' && 'lynia-finance-prod-frontend' || format('{0}-lynia-frontend', inputs.environment || 'production') }}
```

**File:** `.github/workflows/deploy-frontend.yml`

**Commit:** `7eb24e3` — `fix: correct CloudFormation stack name references in CI/CD workflows`

---

## Deployment Step 1: Database Migrations (Deferred)

**Status:** DEFERRED — Network connectivity issue

The production RDS instance (`production-lynia-db`) is in private subnets (`production-lynia-private-1a`, `production-lynia-private-1b`) with no public endpoint. GitHub Actions runners on the public internet cannot connect even with security group rules added.

**Attempted fix:** Setting `PubliclyAccessible=true` on the RDS instance. This assigned a public DNS entry but the instance ENI remained in the private subnet (no IGW route), so inbound connections still timed out. Reverted to `PubliclyAccessible=false`.

**Future fix options:**
1. Deploy a bastion host in the public subnet for SSH tunneling
2. Use AWS SSM Session Manager port forwarding
3. Run migrations from within the VPC via Lambda or ECS task
4. Use a self-hosted GitHub Actions runner inside the VPC

**Database state:** All migrations were previously applied during Phase 5 (P5-DEPLOY-T004). No new migrations pending.

---

## Deployment Step 2: Backend Lambda Services

**Workflow:** `Deploy to AWS` (`deploy.yml`) → `workflow_dispatch` → `environment=production`
**Run ID:** `22079622244`
**Result:** SUCCESS

### Pipeline Stages

| Stage | Duration | Result |
|-------|----------|--------|
| Lint & Test | 54s | PASS — All tests pass, 80%+ coverage |
| Security Scan | 59s | PASS — No critical vulnerabilities |
| Build Lambda Functions | 1m 11s | PASS — SAM build + validate |
| Deploy to Production | ~3m | PASS — SAM deploy + smoke tests |
| Deployment Notifications | ~3s | PASS — Slack notified |

### Production Checks (Automated)

- Staging stack health verified (`lynia-finance-staging` = `UPDATE_COMPLETE`)
- No destructive database migrations detected
- Pre-deployment state recorded for rollback reference
- VPC + Cognito configuration resolved from CloudFormation outputs
- SAM deployed with `--on-failure ROLLBACK` safety net
- Smoke tests passed: `/health`, `/scoring/health`, `/payments/health`
- 2-minute CloudWatch error monitoring window — no errors
- GitHub Release created automatically

### CloudFormation Stack

| Property | Value |
|----------|-------|
| Stack name | `lynia-finance-prod` |
| Status | `UPDATE_COMPLETE` |
| Last updated | `2026-02-16T22:47:15Z` |
| Region | `us-east-1` |
| API URL | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/` |

### Lambda Functions Deployed

| Function | Service | Runtime | Architecture |
|----------|---------|---------|-------------|
| WhatsAppFunction | whatsapp-service | Node.js 20.x | arm64 |
| ScoringFunction | scoring-service | Node.js 20.x | arm64 |
| KYCFunction | kyc-service | Node.js 20.x | arm64 |
| PaymentFunction | payment-service | Node.js 20.x | arm64 |
| LockFunction | lock-service | Node.js 20.x | arm64 |
| NotificationFunction | notification-service | Node.js 20.x | arm64 |
| FormSubmissionFunction | form-submission-service | Node.js 20.x | arm64 |

---

## Deployment Step 3: Frontend — Admin Portal

**Workflow:** `Deploy Frontend (Blue-Green)` → `environment=production`, `application=admin-portal`
**Run ID:** `22079814019`
**Result:** SUCCESS

| Stage | Duration | Result |
|-------|----------|--------|
| Build & Test | 1m 12s | PASS |
| Blue-Green Upload | ~10s | Versioned prefix uploaded to S3 |
| Switch Traffic | ~3s | Live bucket updated atomically |
| CloudFront Invalidation | ~10s | Full cache invalidated (`/*`) |
| Health Check | ~3s | HTTP 200 |

**S3 Bucket:** `production-lynia-admin-portal`
**CloudFront:** `E3NB88CYCVFZN2` (`d1qwfy2tsdmpe4.cloudfront.net`)
**Custom Domain:** `https://admin.lyniafinance.com`

---

## Deployment Step 4: Frontend — Distributor Dashboard

**Workflow:** `Deploy Frontend (Blue-Green)` → `environment=production`, `application=distributor-dashboard`
**Run ID:** `22079875679`
**Result:** SUCCESS

| Stage | Duration | Result |
|-------|----------|--------|
| Build & Test | 43s | PASS |
| Blue-Green Upload | ~10s | Versioned prefix uploaded |
| Switch Traffic | ~3s | Live bucket updated |
| CloudFront Invalidation | ~10s | Full cache invalidated |

**S3 Bucket:** `production-lynia-distributor-dashboard`
**CloudFront:** `E37VR48QGDRO2T` (`d1ffqmg34sb5yo.cloudfront.net`)
**Custom Domain:** `https://distributor.lyniafinance.com`

---

## Deployment Step 5: Frontend — Landing Page

**Workflow:** `Deploy Frontend (Blue-Green)` → `environment=production`, `application=landing-page`
**Run ID:** `22080427325`
**Result:** SUCCESS

| Stage | Duration | Result |
|-------|----------|--------|
| Build & Test | 48s | PASS |
| Blue-Green Upload | ~10s | Versioned prefix uploaded |
| Switch Traffic | ~3s | Live bucket updated |
| CloudFront Invalidation | ~10s | Full cache invalidated |
| Health Check | ~3s | HTTP 200 |

**S3 Bucket:** `production-lynia-landing-page`
**CloudFront:** `E10WV53NJJP9U8` (`d1o2kxf450zc0y.cloudfront.net`)
**Custom Domain:** `https://lyniafinance.com`

---

## Post-Deployment Verification

### API Health (Authenticated Endpoints)

| Endpoint | Response | Notes |
|----------|----------|-------|
| `/health` | 403 | Expected — requires Cognito JWT |
| `/scoring/health` | 401 | Expected — requires Cognito JWT |
| `/payments/health` | 401 | Expected — requires Cognito JWT |

All API endpoints correctly enforce authentication. Unauthenticated requests receive 401/403 as designed.

### Frontend Health

| Site | HTTP Status | URL |
|------|-------------|-----|
| Admin Portal | 200 | `https://admin.lyniafinance.com` |
| Distributor Dashboard | 200 | `https://distributor.lyniafinance.com` |
| Landing Page | 200 | `https://lyniafinance.com` |

### CloudFormation Stack Status

| Stack | Status |
|-------|--------|
| `lynia-finance-prod` | UPDATE_COMPLETE |
| `lynia-finance-prod-frontend` | UPDATE_COMPLETE |
| `production-lynia-cognito` | UPDATE_COMPLETE |
| `production-lynia-vpc` | CREATE_COMPLETE |
| `lynia-rds-production` | CREATE_COMPLETE |
| `production-lynia-sqs` | CREATE_COMPLETE |
| `lynia-finance-production-waf` | CREATE_COMPLETE |

---

## Production Infrastructure Summary

### AWS Resources (Production)

| Resource | Details |
|----------|---------|
| **VPC** | `vpc-064861e8a592a1646` — 2 public + 2 private subnets, NAT Gateway, VPC Endpoints |
| **RDS** | PostgreSQL 16 on `db.t4g.micro`, encrypted, private subnets |
| **Cognito** | User Pool `us-east-1_VHEEa5faP` — admin + distributor app clients |
| **API Gateway** | REST API with Cognito authorizer, WAF protection |
| **Lambda** | 7 functions, Node.js 20.x, arm64, 512MB, X-Ray tracing |
| **S3** | 3 frontend buckets + 1 deployment bucket |
| **CloudFront** | 3 distributions with custom domains + ACM certificates |
| **SQS** | 7 queues (notifications, payments, retries + DLQs) |
| **WAF** | Rate limiting + common attack protection on API Gateway |

---

## Rollback Procedures

### Backend
```bash
bash scripts/rollback.sh production
# Type "ROLLBACK" when prompted
```

### Frontend
```bash
bash scripts/rollback-frontend.sh production admin-portal
bash scripts/rollback-frontend.sh production distributor-dashboard
bash scripts/rollback-frontend.sh production landing-page
```

### Automatic
Production SAM deploys use `--on-failure ROLLBACK` — CloudFormation auto-rolls back on deployment failure.

---

## Open Items

| Item | Priority | Details |
|------|----------|---------|
| DB Migration Workflow | Medium | RDS in private subnet — need bastion/SSM approach for future migrations |
| Stack naming convention | Low | Inconsistent naming (`lynia-rds-production` vs `production-lynia-vpc`) — consider standardizing |

---

## Phase Cross-Reference

This deployment builds on work from:

| Phase | Report | What it Delivered |
|-------|--------|-------------------|
| Phase 1 | `Phase-1-Codebase-Discovery.md` | Architecture discovery, codebase inventory |
| Phase 2 | `Phase-2-User-Journeys.md` | User flows and feature mapping |
| Phase 3 | `Phase-3-Code-Level-Audit.md` | Code quality, security, and pattern analysis |
| Phase 4 | `Phase-4-Blocker-Analysis.md` | Deployment blockers and dependency mapping |
| Phase 5 | `phase-5-aws-deployment/PHASE-5-SUMMARY-REPORT.md` | AWS infrastructure deployment (17 tasks) |
| Phase 6 | `Phase-6-Fineract-Deployment-Report.md` | Fineract ECS deployment and integration |
| Phase 7 | `Phase-7-Deployment-Report.md` | Fineract init, monitoring, and DB setup |
| Phase 8 | `Phase-8-Implementation-Report.md` | SQS retry queues, CI/CD fixes, frontend deploys |
| Phase 9 | `Phase-9-Fineract-Proxy-Backend-Report.md` | Fineract proxy Lambda deployment |
| Phase 10 | `Phase-10-Next-Recommendations.md` | Recommendations for next steps |
| Phase 11 | `Phase-11-Loan-Route-Consolidation-Report.md` | Route consolidation audit |
| **Phase 12** | **This report** | **Full production deployment — backend + 3 frontends** |
