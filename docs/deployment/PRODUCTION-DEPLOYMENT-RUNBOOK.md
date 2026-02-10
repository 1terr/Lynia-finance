# Production Deployment Runbook

**Document:** Lynia Finance - Production Deployment Runbook
**Version:** 1.0
**Last Updated:** February 10, 2026
**Owner:** Engineering Team
**Classification:** Internal - Operations

---

## Table of Contents

1. [Overview](#1-overview)
2. [Pre-Deployment Phase](#2-pre-deployment-phase)
3. [Deployment Phase](#3-deployment-phase)
4. [Post-Deployment Phase](#4-post-deployment-phase)
5. [Database Migration Procedures](#5-database-migration-procedures)
6. [Frontend Deployment](#6-frontend-deployment)
7. [DNS & SSL Procedures](#7-dns--ssl-procedures)
8. [Rollback Reference](#8-rollback-reference)

---

## 1. Overview

### Deployment Architecture

```
GitHub (master) -> CI/CD Pipeline -> Staging -> Manual Approval -> Production
                        |
                   [6 stages]
                   1. Lint & Test
                   2. Security Scan
                   3. SAM Build
                   4. Deploy Staging
                   5. Deploy Production (manual gate)
                   6. Notifications
```

### Services Deployed

| Service | Lambda Function | Runtime | Memory |
|---------|----------------|---------|--------|
| scoring-service | `{env}-lynia-scoring-service` | Node.js 20.x (ARM64) | 1024 MB |
| payment-service | `{env}-lynia-payment-service` | Node.js 20.x (ARM64) | 1024 MB |
| whatsapp-service | `{env}-lynia-whatsapp-service` | Node.js 20.x (ARM64) | 512 MB |
| kyc-service | `{env}-lynia-kyc-service` | Node.js 20.x (ARM64) | 512 MB |
| lock-service | `{env}-lynia-lock-service` | Node.js 20.x (ARM64) | 512 MB |
| notification-service | `{env}-lynia-notification-service` | Node.js 20.x (ARM64) | 512 MB |

### Frontend Applications

| Application | Hosting | CDN |
|------------|---------|-----|
| Admin Portal | S3 + CloudFront | `admin.lyniafinance.com` |
| Distributor Dashboard | S3 + CloudFront | `distributor.lyniafinance.com` |

### Deployment Methods

| Method | Use Case | Command |
|--------|----------|---------|
| CI/CD Pipeline | Standard deployments | Merge to `master` or manual workflow dispatch |
| Manual Script | Emergency or selective deploy | `./scripts/deploy-production.sh` |
| SAM CLI | Individual service updates | `sam deploy --config-env production` |

---

## 2. Pre-Deployment Phase

### 2.1 Pre-Deployment Checklist

Execute **at least 2 hours** before scheduled deployment:

```
[ ] All tests pass in CI (unit + integration + E2E)
[ ] Security scan passes (no critical vulnerabilities)
[ ] Code reviewed and approved by 2+ engineers
[ ] Staging deployment verified and smoke-tested
[ ] Database migrations tested in staging (if applicable)
[ ] Feature flags configured correctly for new features
[ ] On-call engineer identified and available
[ ] Communication sent to team (Slack #deployments channel)
[ ] Rollback plan reviewed for this specific deployment
[ ] External dependencies verified (EcoCash, Smile Identity, Trustonic APIs)
```

### 2.2 Verify Staging Health

```bash
# Verify staging stack is healthy
aws cloudformation describe-stacks \
  --stack-name lynia-finance-staging \
  --query 'Stacks[0].StackStatus' \
  --output text
# Expected: CREATE_COMPLETE or UPDATE_COMPLETE

# Run staging smoke tests
curl -s -o /dev/null -w "%{http_code}" https://staging-api.lyniafinance.com/health
curl -s -o /dev/null -w "%{http_code}" https://staging-api.lyniafinance.com/scoring/health
curl -s -o /dev/null -w "%{http_code}" https://staging-api.lyniafinance.com/payments/health
```

### 2.3 Record Pre-Deployment State

```bash
# Record current production state for rollback reference
CURRENT_COMMIT=$(aws lambda get-function \
  --function-name production-lynia-payment-service \
  --query 'Configuration.Description' --output text)
echo "Current commit: $CURRENT_COMMIT"

# Record current CloudFormation template hash
aws cloudformation get-template \
  --stack-name lynia-finance-prod \
  --template-stage Processed | md5sum

# Note the timestamp
echo "Pre-deploy timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### 2.4 Notify Team

Post to Slack `#deployments`:
```
:rocket: PRODUCTION DEPLOYMENT STARTING
Deployer: [your name]
Commit: [git hash]
Changes: [brief summary]
Expected duration: ~15 minutes
Rollback plan: [reference specific rollback procedure]
On-call: [engineer name + phone]
```

---

## 3. Deployment Phase

### 3.1 Method A: CI/CD Pipeline (Recommended)

1. **Trigger deployment** via GitHub Actions:
   - Navigate to Actions > "Deploy to AWS" > Run workflow
   - Select environment: `production`
   - Click "Run workflow"

2. **Pipeline stages execute automatically**:
   - Stage 1: Lint & Test (~3 min)
   - Stage 2: Security Scan (~2 min)
   - Stage 3: SAM Build (~4 min)
   - Stage 4: (skipped for production-only)
   - Stage 5: Production Deploy (~5 min)
     - Manual approval gate (GitHub Environment protection)
     - SAM deploy with `--on-failure ROLLBACK`
     - Post-deploy smoke tests
     - 2-minute error rate monitoring window
   - Stage 6: Notifications

3. **Approve production deployment** when prompted in GitHub UI

4. **Monitor pipeline** in GitHub Actions tab

### 3.2 Method B: Manual Script (Emergency)

```bash
# Full deployment
./scripts/deploy-production.sh

# Lambda services only (skip infra + frontend)
./scripts/deploy-production.sh --services-only

# Skip infrastructure stacks
./scripts/deploy-production.sh --skip-infra

# Dry run (simulation)
./scripts/deploy-production.sh --dry-run
```

Safety prompts:
- Must type `PRODUCTION` to confirm
- Must confirm staging was tested

### 3.3 Method C: Individual Service Update

```bash
# Build specific service
sam build --config-env production

# Deploy only Lambda functions
sam deploy --config-env production \
  --no-fail-on-empty-changeset \
  --on-failure ROLLBACK
```

### 3.4 Deployment Order

Infrastructure and services must be deployed in this order:

```
1. Infrastructure stacks (if changed):
   a. VPC (network layer)
   b. Secrets Manager (credentials)
   c. SQS Queues (messaging)
   d. IAM Roles (permissions)
   e. DNS/SSL (routing)
   f. Monitoring/Alarms (observability)

2. Lambda services (SAM deploy):
   - All 6 services deployed atomically via CloudFormation
   - Canary deployment for payment-service (10% -> 100% over 30 min)
   - Linear deployment for other services (10% -> 100% over 15 min)

3. Frontend (if changed):
   a. Build admin-portal and distributor-dashboard
   b. Upload to S3 (static assets with immutable cache, HTML with no-cache)
   c. Invalidate CloudFront caches
```

---

## 4. Post-Deployment Phase

### 4.1 Immediate Verification (0-5 minutes)

```bash
# 1. Check CloudFormation stack status
aws cloudformation describe-stacks \
  --stack-name lynia-finance-prod \
  --query 'Stacks[0].StackStatus'
# Expected: UPDATE_COMPLETE

# 2. Health check all services
for endpoint in health scoring/health payments/health; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://api.lyniafinance.com/$endpoint")
  echo "$endpoint: $HTTP_CODE"
done

# 3. Check for errors in last 5 minutes
aws logs filter-log-events \
  --log-group-name /aws/lambda/production-lynia-payment-service \
  --start-time $(date -d '-5 min' +%s000) \
  --filter-pattern '{ $.level = "error" }' \
  --limit 10

# 4. Verify Lambda function versions updated
aws lambda get-function \
  --function-name production-lynia-payment-service \
  --query 'Configuration.LastModified'
```

### 4.2 Monitoring Window (5-30 minutes)

Watch CloudWatch dashboards:

1. **Real-time dashboard** (`production-lynia-realtime`):
   - Error rate should remain < 1%
   - Latency p95 should remain < 300ms
   - No throttling

2. **Business metrics dashboard** (`production-lynia-business`):
   - Loan applications flowing normally
   - Payments processing successfully
   - No KYC failures spike

3. **Check active alarms**:
```bash
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --alarm-name-prefix production-lynia
```

### 4.3 Extended Monitoring (30 min - 2 hours)

- Monitor error rates in CloudWatch
- Check SQS dead letter queues for failed messages
- Verify canary deployment completed (payment-service)
- Review application logs for unexpected warnings

### 4.4 Post-Deployment Notification

Post to Slack `#deployments`:
```
:white_check_mark: PRODUCTION DEPLOYMENT COMPLETE
Commit: [git hash]
Duration: [X minutes]
Status: All services healthy
Errors: None detected
Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=production-lynia-realtime
```

### 4.5 Rollback Trigger Criteria

Initiate rollback if **any** of these occur within 30 minutes of deployment:

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Error rate spike | > 5% of requests | Immediate rollback |
| Payment failures | > 3 consecutive failures | Immediate rollback |
| Latency spike | p99 > 2000ms for 5+ min | Evaluate + likely rollback |
| Service unavailable | Any service returns 5XX | Immediate rollback |
| Data inconsistency | Payments not reconciling | Immediate rollback |
| Customer impact | Complaints from WhatsApp users | Evaluate + likely rollback |

See [ROLLBACK-PROCEDURES.md](ROLLBACK-PROCEDURES.md) for rollback steps.

---

## 5. Database Migration Procedures

### 5.1 Pre-Migration

```bash
# 1. Review migration files
ls database/migrations/*.sql

# 2. Check for destructive operations
grep -iE "DROP (TABLE|COLUMN|INDEX)" database/migrations/*.sql

# 3. Run migration in staging first
pnpm db:migrate --env staging

# 4. Verify staging data integrity
# Run application smoke tests against staging
```

### 5.2 Forward Migration

```bash
# Option A: Via pnpm script
pnpm db:migrate --env production

# Option B: Via Supabase dashboard
# Navigate to SQL Editor in production Supabase project
# Paste and execute migration SQL

# Option C: Via Supabase CLI
supabase db push --linked
```

### 5.3 Migration Rollback

Every migration MUST have a corresponding rollback script:

```
database/migrations/
  20260210_001_add_column.sql           # Forward migration
  20260210_001_add_column_rollback.sql  # Rollback migration
```

```bash
# Execute rollback migration
pnpm db:migrate:rollback --env production

# Verify rollback
# Check that application still functions with rolled-back schema
```

### 5.4 Migration Safety Rules

- Never drop columns/tables that are still referenced by running Lambda code
- Use additive migrations (add columns as nullable, add new tables)
- Backfill data in a separate step after migration
- Always test rollback in staging before production migration

---

## 6. Frontend Deployment

### 6.1 Build

```bash
# Admin portal
cd frontend/admin-portal
pnpm install --frozen-lockfile
pnpm build

# Distributor dashboard
cd frontend/distributor-dashboard
pnpm install --frozen-lockfile
pnpm build
```

### 6.2 Upload to S3

```bash
ADMIN_BUCKET="production-lynia-admin-portal"
DIST_BUCKET="production-lynia-distributor-dashboard"

# Static assets (long cache)
aws s3 sync out/ "s3://${ADMIN_BUCKET}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html"

# HTML files (no cache - always fresh)
aws s3 sync out/ "s3://${ADMIN_BUCKET}/" \
  --exclude "*" --include "*.html" \
  --cache-control "public, max-age=0, must-revalidate"
```

### 6.3 CloudFront Cache Invalidation

```bash
# Get distribution IDs
ADMIN_CF_ID=$(aws cloudformation describe-stacks \
  --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" \
  --output text)

# Invalidate all paths
aws cloudfront create-invalidation \
  --distribution-id "$ADMIN_CF_ID" \
  --paths "/*"

# Monitor invalidation status
aws cloudfront get-invalidation \
  --distribution-id "$ADMIN_CF_ID" \
  --id <invalidation-id>
```

### 6.4 Frontend Rollback

See [ROLLBACK-PROCEDURES.md](ROLLBACK-PROCEDURES.md) Section 4 for frontend-specific rollback.

---

## 7. DNS & SSL Procedures

### 7.1 DNS Records

| Domain | Type | Target |
|--------|------|--------|
| `api.lyniafinance.com` | A (Alias) | API Gateway |
| `admin.lyniafinance.com` | A (Alias) | CloudFront Distribution |
| `distributor.lyniafinance.com` | A (Alias) | CloudFront Distribution |

### 7.2 SSL Certificates

- Managed by AWS Certificate Manager (ACM)
- Auto-renewal enabled
- Certificate ARN stored in CloudFormation outputs

### 7.3 DNS Failover

In case of complete regional failure:
1. Update Route 53 health check to fail
2. DNS failover to maintenance page
3. Communicate outage to users via WhatsApp broadcast

---

## 8. Rollback Reference

For complete rollback procedures, see:
- [ROLLBACK-PROCEDURES.md](ROLLBACK-PROCEDURES.md) - Per-service and full-system rollback
- [INCIDENT-RESPONSE-PLAYBOOK.md](INCIDENT-RESPONSE-PLAYBOOK.md) - Incident classification and response

### Quick Rollback Commands

```bash
# Lambda rollback (revert CloudFormation stack to previous version)
aws cloudformation rollback-stack --stack-name lynia-finance-prod

# Frontend rollback (restore previous S3 version)
aws s3api list-object-versions --bucket production-lynia-admin-portal \
  --prefix index.html --max-items 2

# Canary deployment auto-rollback
# payment-service has automatic rollback on error rate spike (configured in canary-deployments.yaml)
```

---

**Document Owner:** Engineering Team
**Review Schedule:** Before every production deployment
**Next Review:** Before go-live (P4-T015)
