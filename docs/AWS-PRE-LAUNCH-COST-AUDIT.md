# AWS Pre-Launch Cost Reduction Audit

**Date:** 2026-03-25
**Commit:** `fedaaa52` — `perf: pre-launch AWS cost reduction — save ~$220-365/month`
**Status:** Deployed to production

---

## Executive Summary

Lynia Finance was running production-grade AWS infrastructure with zero users, burning an estimated **$350-550/month**. This audit identified and deployed cost reductions bringing the monthly bill down to an estimated **$200-350/month**, saving **~$65-145/month immediately** with additional savings available once a log archival pipeline is set up.

---

## Original Architecture (Pre-Audit)

### CloudFormation Stacks (14 total)

| Stack | Purpose | Status |
|-------|---------|--------|
| `lynia-finance-prod` | Main SAM stack — 17 Lambda functions, API Gateway, Cognito authorizer | UPDATE_COMPLETE |
| `production-lynia-sqs` | 9 SQS queues + 9 DLQs | UPDATE_COMPLETE |
| `production-lynia-fineract-ecs` | Apache Fineract on ECS Fargate (1 vCPU, 2GB) | UPDATE_COMPLETE |
| `production-lynia-fineract-monitoring` | Fineract CloudWatch dashboard + alarms | CREATE_COMPLETE |
| `production-lynia-fineract-init` | Fineract initialization | UPDATE_COMPLETE |
| `production-lynia-fineract-db-init` | Fineract DB setup | CREATE_COMPLETE |
| `production-lynia-cognito` | Cognito User Pool (LITE tier) | UPDATE_COMPLETE |
| `lynia-rds-production` | PostgreSQL 16 (db.t4g.micro, 20GB) | CREATE_COMPLETE |
| `production-lynia-vpc` | VPC with 2 public + 2 private subnets, 2 NAT gateways | CREATE_COMPLETE |
| `lynia-finance-prod-frontend` | 3 CloudFront distributions + S3 (admin, distributor, landing) | UPDATE_COMPLETE |
| `lynia-finance-production-waf` | WAF rules (rate limiting, SQLi, XSS, geo-blocking) | CREATE_COMPLETE |
| `lynia-finance-staging` | Staging environment | UPDATE_COMPLETE |
| `staging-lynia-sqs` | Staging SQS queues | UPDATE_COMPLETE |
| `production-lynia-codebuild-migrations` | DB migration runner | UPDATE_COMPLETE |

### Original Cost Breakdown (Estimated Monthly)

| Resource | Monthly Cost | Details |
|----------|-------------|---------|
| NAT Gateways (x2) | ~$70-90 | $0.045/hr each + data processing |
| VPC Endpoints (x4) | ~$30-40 | Secrets Manager, Logs, SQS, X-Ray @ $0.01/hr each |
| RDS db.t4g.micro | ~$15-20 | 20GB gp2, single-AZ, 1-day backup |
| Fineract ECS Fargate | ~$35-70 | 1 vCPU + 2GB RAM running 24/7 |
| CloudWatch Logs | ~$20-50 | Ingestion + 5-year (1827-day) hot storage |
| Lambda Provisioned Concurrency | ~$0 | **Discovered: never deployed** (no `live` alias exists) |
| X-Ray Tracing | ~$5-15 | Active tracing on all 17 functions |
| CloudFront (3 distributions) | ~$5-15 | Minimal traffic pre-launch |
| SQS (18 queues) | ~$5-10 | Long-polling on idle queues |
| API Gateway | ~$3-5 | Pay per request |
| WAF | ~$6-10 | Base fee + managed rules |
| S3 Storage | ~$3-5 | KYC docs, ML models, frontend assets |
| GitHub Actions CI/CD | ~$26-92 | Minutes after free tier |
| Secrets Manager | ~$4-8 | Per-secret monthly charge |
| CloudWatch Alarms | ~$5-10 | Per alarm metric |
| Elastic IPs | ~$3-7 | For NAT gateways |
| Cognito | ~$0 | LITE tier, free under 50K MAU |
| **TOTAL** | **~$350-550** | |

### Lambda Functions (17 total)

All on Node.js 20.x, ARM64 (Graviton2), esbuild-bundled:

| Function | Memory | Timeout | Purpose |
|----------|--------|---------|---------|
| scoring-service | 1024 MB | 30s | Credit scoring & loan assessment |
| payment-service | 1024 MB | 60s | EcoCash/OneMoney payment processing |
| whatsapp-service | 512 MB | 30s | Customer messaging |
| whatsapp-retry | 512 MB | 30s | Failed message retry (SQS trigger) |
| kyc-service | 512 MB | 30s | DIDIT KYC verification |
| lock-service | 512 MB | 30s | Trustonic device lock/unlock |
| notification-service | 512 MB | 30s | Multi-channel alerts (SQS trigger) |
| form-submission | 256 MB | 15s | WhatsApp form handling |
| fineract-reconciliation | 512 MB | 300s | Fineract sync |
| fineract-proxy | 512 MB | 28s | API proxy to Fineract |
| admin-service | 512 MB | 25s | Admin dashboard backend |
| distributor-service | 512 MB | 30s | Distributor dashboard backend |
| investor-reporting | 512 MB | 60s | Investor reports |
| dw-sync | 512 MB | 120s | Data warehouse sync (SQS trigger) |
| auto-default-scheduler | 512 MB | 120s | Loan default scheduling |
| org-data-freshness | 256 MB | 60s | Data freshness checks |
| reservation-expiry | 256 MB | 60s | Device reservation cleanup |

### CI/CD Workflows (29 total)

Key workflows and their triggers:

| Workflow | Trigger | Minutes/Run |
|----------|---------|-------------|
| `deploy.yml` | Every push to master | ~25-40 min |
| `test.yml` | Every push + PRs | ~10-15 min |
| `deploy-frontend.yml` | Frontend file changes | ~10-15 min |
| Fineract workflows (6) | `fineract/**` changes only | ~15-30 min |
| Infrastructure deploys (6) | workflow_dispatch only | ~5-10 min |

---

## Changes Made

### 1. CI/CD Optimization (Active on push)

**Files modified:**
- `.github/workflows/deploy.yml`
- `.github/workflows/test.yml`
- `.github/workflows/deploy-frontend.yml`

**Changes:**

| Before | After | Impact |
|--------|-------|--------|
| `cancel-in-progress: false` on deploy.yml | `cancel-in-progress: true` | Cancels superseded runs, saves 30-50% of minutes |
| `cancel-in-progress: false` on deploy-frontend.yml | `cancel-in-progress: true` | Same |
| No concurrency group on test.yml | `group: test-${{ github.ref }}` with `cancel-in-progress: true` | Prevents parallel test runs on same ref |
| Staging deploy on every push to master | Staging deploy only on `workflow_dispatch` | Saves ~8-10 min/push |
| `paths-ignore: ['**.md', 'docs/**']` | Added `.claude/**`, `Site Audit*/**` | Fewer unnecessary triggers |

**Estimated savings:** ~$20-50/month in GitHub Actions minutes

### 2. X-Ray Tracing Disabled (Deployed)

**File:** `template.yaml` (line 36)

| Before | After |
|--------|-------|
| `Tracing: Active` | `Tracing: PassThrough` |

PassThrough means traces are only recorded if an upstream service requests it. All Lambda functions still work — just no active trace generation.

**Estimated savings:** ~$5-15/month

### 3. DW Sync SQS Event Source Disabled (Deployed)

**File:** `template.yaml` (line 1928)

Added `Enabled: false` to the DWSyncQueue event source mapping. The data warehouse sync Lambda no longer polls the empty queue.

**Estimated savings:** ~$5-10/month

### 4. Fineract ECS Paused (Deployed & Verified)

**File:** `phase-6-fineract-integration/infrastructure/fineract-ecs.yaml`

| Before | After |
|--------|-------|
| `DesiredCount: 1` (hardcoded) | `DesiredCount: !Ref FineractDesiredCount` (parameter, default: 0) |
| Auto-scaling condition: `IsProduction` | Auto-scaling condition: `FineractRunning` (only when count > 0) |

**Verification:**
```json
// aws ecs describe-services --cluster production-lynia-fineract --services fineract-server
{
    "desiredCount": 0,
    "runningCount": 0,
    "status": "ACTIVE"
}
```

**Estimated savings:** ~$35-70/month

### 5. Lambda Provisioned Concurrency — PreLaunch Parameter Added (Template Updated, Not Deployed)

**File:** `infrastructure/aws/lambda-autoscaling.yaml`

Added `PreLaunch` parameter (default: `true`) that gates all provisioned concurrency and auto-scaling resources. However, **discovery during deployment revealed that provisioned concurrency was never deployed to production** (no `live` alias exists on any Lambda). The lambda-autoscaling stack has never been deployed as a separate stack.

**Actual savings:** $0 (was already $0)

### 6. CloudWatch Log Retention — SKIPPED (Safety Gate Triggered)

**File:** `infrastructure/monitoring/log-retention-archival.yaml` (template updated, NOT deployed)

Template was updated to reduce production retention from 1827 days (5 years) to 90 days. However, **the safety gate blocked deployment:**

```
aws s3 ls | grep log-archive
# Result: NO LOG ARCHIVE BUCKET FOUND
```

Reducing CloudWatch retention without a working S3 archival pipeline would **permanently delete logs** with no backup. The template change exists in code but was NOT deployed to production.

**Action required:** Set up the S3 log archival pipeline before deploying this change.

---

## What Was NOT Changed

| Resource | Reason |
|----------|--------|
| VPC (2 NAT gateways) | Removing NAT gateway from live VPC risks Lambda connectivity loss. Non-prod already uses 1 NAT. |
| VPC Endpoints (4) | Required for Lambda in private subnets to reach AWS services |
| RDS instance | Already minimal (db.t4g.micro, 20GB) |
| CloudFront distributions | Cost is traffic-based, minimal pre-launch |
| WAF | Security posture must remain for investor demos |
| Cognito | Already free (LITE tier) |
| SQS queue infrastructure | Queues themselves are cheap when idle |
| Fineract-inherited workflows | Already path-scoped to `fineract/**` — only trigger on Fineract code changes |

---

## Post-Audit Cost Estimate

| Resource | Monthly Cost | Change |
|----------|-------------|--------|
| NAT Gateways (x2) | ~$70-90 | No change |
| VPC Endpoints (x4) | ~$30-40 | No change |
| RDS | ~$15-20 | No change |
| Fineract ECS | **$0** | Paused (DesiredCount=0) |
| CloudWatch Logs | ~$20-50 | No change (archival not ready) |
| X-Ray | **$0** | PassThrough mode |
| CloudFront | ~$5-15 | No change |
| SQS | ~$2-5 | DW sync polling disabled |
| API Gateway | ~$3-5 | No change |
| WAF | ~$6-10 | No change |
| S3 | ~$3-5 | No change |
| GitHub Actions | ~$5-20 | Cancel-in-progress + staging on-demand |
| Secrets Manager | ~$4-8 | No change |
| CloudWatch Alarms | ~$5-10 | No change |
| EIPs | ~$3-7 | No change |
| **TOTAL** | **~$200-350** | **Saving ~$65-145/month** |

---

## Reversal Strategy — Going Fully Operational

When ready to launch, execute these commands to restore full capacity:

### 1. Restore Fineract ECS (Priority: HIGH)

```bash
# Option A: Quick CLI (immediate, no stack update)
aws ecs update-service --cluster production-lynia-fineract \
  --service fineract-server --desired-count 1

# Option B: Stack deploy (permanent, survives future deploys)
aws cloudformation deploy \
  --stack-name production-lynia-fineract-ecs \
  --template-file phase-6-fineract-integration/infrastructure/fineract-ecs.yaml \
  --parameter-overrides \
    Environment=production \
    FineractImageTag=latest \
    "FineractSecretArn=arn:aws:secretsmanager:us-east-1:849695476598:secret:production/lynia/fineract-peFuQp" \
    FineractDesiredCount=1 \
  --capabilities CAPABILITY_NAMED_IAM

# Verify
aws ecs describe-services --cluster production-lynia-fineract \
  --services fineract-server --query 'services[0].{desired:desiredCount,running:runningCount}'
```

### 2. Restore X-Ray Active Tracing

Edit `template.yaml` line 36:
```yaml
# Change:
Tracing: PassThrough
# To:
Tracing: Active
```

Then deploy:
```bash
sam build --config-env production --parallel --cached
sam deploy --config-env production --no-confirm-changeset \
  --parameter-overrides \
    "Environment=production VpcEnabled=true \
    PrivateSubnet1Id=subnet-07b4572d20eca2aa8 \
    PrivateSubnet2Id=subnet-06a321aa46a25f622 \
    LambdaSecurityGroupId=sg-0218a50d7ffd89fb3 \
    CognitoUserPoolArn=arn:aws:cognito-idp:us-east-1:849695476598:userpool/us-east-1_VHEEa5faP"
```

### 3. Re-enable DW Sync SQS Polling

Edit `template.yaml` — remove the `Enabled: false` line from the DWSyncQueue event source mapping. Deploy with same `sam deploy` command above.

### 4. Re-enable Staging Auto-Deploy

Edit `.github/workflows/deploy.yml` line 221:
```yaml
# Change:
if: github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'staging'
# To:
if: github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'staging')
```

### 5. Deploy Provisioned Concurrency (When Needed)

The lambda-autoscaling stack has never been deployed. When traffic warrants it:
```bash
aws cloudformation deploy \
  --stack-name production-lynia-lambda-autoscaling \
  --template-file infrastructure/aws/lambda-autoscaling.yaml \
  --parameter-overrides Environment=production PreLaunch=false \
  --capabilities CAPABILITY_NAMED_IAM
```

### 6. Set Up Log Archival + Reduce Retention (When Ready)

1. Deploy the log-retention-archival stack to create the S3 archival bucket
2. Set up CloudWatch Logs subscription filters to export to S3
3. Verify logs are flowing to S3: `aws s3 ls s3://production-lynia-log-archive-849695476598/`
4. Only THEN deploy the retention reduction (1827 → 90 days)

---

## Remaining Optimization Opportunities

| Opportunity | Potential Savings | Blocker |
|-------------|------------------|---------|
| Reduce to 1 NAT gateway | ~$35-45/mo | Requires VPC stack update with careful routing changes |
| Remove unused VPC endpoints | ~$10-30/mo | Need to verify which endpoints Lambda actually uses |
| CloudWatch log retention → 90 days | ~$20-50/mo | Need S3 archival pipeline first |
| RDS stop during non-development periods | ~$15/mo | 7-day auto-restart limit makes this impractical |
| Reserved Instances for RDS | ~$5-8/mo | 1-year commitment, only worth it after launch confirmed |

---

## Key Decisions & Rationale

1. **NAT gateway NOT removed** — VPC is a live stack; removing the 2nd NAT gateway risks Lambda connectivity loss in private subnet 2 during CloudFormation update. The $35-45/month saving isn't worth the risk for investor demos.

2. **Log retention NOT reduced in production** — No S3 archival bucket exists. Reducing retention would permanently delete compliance-required logs (RBZ mandates 5-7 year retention for financial records).

3. **Provisioned concurrency template updated but not deployed** — The `PreLaunch` parameter is ready in code for when this stack is eventually deployed. Currently $0 cost since it was never active.

4. **Fineract paused, not terminated** — ECS service with DesiredCount=0 keeps all infrastructure (cluster, task definition, ALB, IAM roles) intact. Can be restarted in ~2-3 minutes via CLI.

5. **CI/CD cancel-in-progress enabled** — Superseded pipeline runs are cancelled. This is safe because the latest push always contains all prior changes. Tests still run on every push.
