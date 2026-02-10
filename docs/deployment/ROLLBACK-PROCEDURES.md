# Rollback Procedures

**Document:** Lynia Finance - Production Rollback Procedures
**Version:** 1.0
**Last Updated:** February 10, 2026
**Owner:** Engineering Team
**Target:** Rollback completes within 5 minutes

---

## Table of Contents

1. [Rollback Decision Framework](#1-rollback-decision-framework)
2. [Lambda Service Rollback](#2-lambda-service-rollback)
3. [CloudFormation Stack Rollback](#3-cloudformation-stack-rollback)
4. [Frontend Rollback](#4-frontend-rollback)
5. [Database Migration Rollback](#5-database-migration-rollback)
6. [Full System Rollback](#6-full-system-rollback)
7. [Post-Rollback Verification](#7-post-rollback-verification)

---

## 1. Rollback Decision Framework

### When to Rollback

| Trigger | Severity | Auto-Rollback? | Action |
|---------|----------|---------------|--------|
| Payment service errors > 5% | CRITICAL | Yes (canary) | Automatic via CodeDeploy |
| Any service returning 5XX | CRITICAL | No | Manual rollback immediately |
| Error rate > 5% across services | CRITICAL | No | Manual rollback immediately |
| Latency p99 > 2000ms (5+ min) | HIGH | No | Evaluate, likely rollback |
| Data inconsistency detected | CRITICAL | No | Manual rollback + investigate |
| Customer-facing errors reported | HIGH | No | Evaluate, likely rollback |
| CloudFormation stack failed | CRITICAL | Yes (--on-failure ROLLBACK) | Automatic |

### Who Can Approve Rollback

- **Any** on-call engineer for CRITICAL triggers (no approval needed)
- Engineering lead for HIGH triggers
- CTO for business-impact rollbacks

### Communication During Rollback

1. Post immediately to Slack `#incidents`:
   ```
   :rotating_light: PRODUCTION ROLLBACK INITIATED
   Trigger: [reason]
   Initiated by: [name]
   Expected duration: ~5 minutes
   ```
2. Update status page (if applicable)
3. Notify customer support team for user-facing issues

---

## 2. Lambda Service Rollback

### 2.1 Automatic Canary Rollback (payment-service)

The payment-service uses canary deployments via CodeDeploy. If the error rate spikes during deployment, it automatically rolls back.

**Configuration** (from `infrastructure/aws/canary-deployments.yaml`):
- Payment: 10% traffic for 30 minutes, then 100%
- Scoring/WhatsApp: 10% traffic for 15 minutes, then 100%
- Auto-rollback on CloudWatch alarm trigger

**To check canary status:**
```bash
aws deploy get-deployment \
  --deployment-id <deployment-id> \
  --query 'deploymentInfo.status'
```

### 2.2 Manual Lambda Rollback (Per Service)

**Option A: Revert to previous Lambda version**

```bash
# 1. List recent versions
aws lambda list-versions-by-function \
  --function-name production-lynia-payment-service \
  --query 'Versions[-3:].[Version,Description,LastModified]' \
  --output table

# 2. Update alias to previous version
PREVIOUS_VERSION=<version-number>
aws lambda update-alias \
  --function-name production-lynia-payment-service \
  --name live \
  --function-version $PREVIOUS_VERSION

# 3. Verify the alias points to correct version
aws lambda get-alias \
  --function-name production-lynia-payment-service \
  --name live
```

**Option B: Redeploy previous Git commit**

```bash
# 1. Find the previous successful deployment commit
git log --oneline -5

# 2. Checkout previous commit
git checkout <previous-commit-hash>

# 3. Build and deploy
sam build --config-env production
sam deploy --config-env production \
  --no-fail-on-empty-changeset \
  --on-failure ROLLBACK

# 4. Return to the branch
git checkout -
```

### 2.3 Per-Service Rollback Commands

| Service | Rollback Command |
|---------|-----------------|
| scoring-service | `aws lambda update-alias --function-name production-lynia-scoring-service --name live --function-version <PREV>` |
| payment-service | `aws lambda update-alias --function-name production-lynia-payment-service --name live --function-version <PREV>` |
| whatsapp-service | `aws lambda update-alias --function-name production-lynia-whatsapp-service --name live --function-version <PREV>` |
| kyc-service | `aws lambda update-alias --function-name production-lynia-kyc-service --name live --function-version <PREV>` |
| lock-service | `aws lambda update-alias --function-name production-lynia-lock-service --name live --function-version <PREV>` |
| notification-service | `aws lambda update-alias --function-name production-lynia-notification-service --name live --function-version <PREV>` |

---

## 3. CloudFormation Stack Rollback

### 3.1 Automatic Rollback (During Deploy)

SAM deploy is configured with `--on-failure ROLLBACK`. If any resource fails to create/update, the entire stack rolls back automatically.

### 3.2 Manual Stack Rollback

```bash
# Option A: Rollback current update-in-progress
aws cloudformation rollback-stack \
  --stack-name lynia-finance-prod

# Option B: Update stack with previous template
aws cloudformation update-stack \
  --stack-name lynia-finance-prod \
  --use-previous-template \
  --parameters <previous-parameters>

# Option C: Redeploy from previous commit
git checkout <previous-commit>
sam build --config-env production
sam deploy --config-env production
```

### 3.3 Infrastructure Stack Rollback

For individual infrastructure stacks:

```bash
# List all Lynia stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?starts_with(StackName,'production-lynia')].StackName"

# Rollback specific infrastructure stack
aws cloudformation rollback-stack \
  --stack-name production-lynia-monitoring
```

---

## 4. Frontend Rollback

### 4.1 S3 Versioning Rollback

S3 buckets have versioning enabled, allowing restore of any previous deployment.

```bash
BUCKET="production-lynia-admin-portal"

# 1. List previous versions of index.html
aws s3api list-object-versions \
  --bucket $BUCKET \
  --prefix index.html \
  --max-items 5 \
  --query 'Versions[*].[VersionId,LastModified,IsLatest]' \
  --output table

# 2. Restore previous version (copy old version as current)
PREV_VERSION_ID=<version-id>
aws s3api copy-object \
  --bucket $BUCKET \
  --copy-source "$BUCKET/index.html?versionId=$PREV_VERSION_ID" \
  --key index.html \
  --cache-control "public, max-age=0, must-revalidate"

# 3. Repeat for all HTML files
for html_file in $(aws s3 ls "s3://$BUCKET/" --recursive | grep '\.html$' | awk '{print $4}'); do
  PREV_VER=$(aws s3api list-object-versions \
    --bucket $BUCKET \
    --prefix "$html_file" \
    --query 'Versions[1].VersionId' \
    --output text)
  aws s3api copy-object \
    --bucket $BUCKET \
    --copy-source "$BUCKET/${html_file}?versionId=$PREV_VER" \
    --key "$html_file" \
    --cache-control "public, max-age=0, must-revalidate"
done
```

### 4.2 CloudFront Cache Invalidation

After S3 rollback, invalidate the CDN cache:

```bash
# Admin portal
ADMIN_CF_ID=$(aws cloudformation describe-stacks \
  --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $ADMIN_CF_ID \
  --paths "/*"

# Distributor dashboard
DIST_CF_ID=$(aws cloudformation describe-stacks \
  --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardDistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DIST_CF_ID \
  --paths "/*"
```

### 4.3 Full Frontend Redeploy from Previous Commit

```bash
git checkout <previous-commit>

# Rebuild and redeploy admin portal
cd frontend/admin-portal
pnpm install --frozen-lockfile && pnpm build
aws s3 sync out/ "s3://production-lynia-admin-portal/" --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id $ADMIN_CF_ID --paths "/*"

git checkout -
```

---

## 5. Database Migration Rollback

### 5.1 Rollback Script Execution

```bash
# 1. Identify the migration to rollback
ls database/migrations/*_rollback.sql

# 2. Execute rollback via Supabase
pnpm db:migrate:rollback --env production

# 3. Verify schema state
# Check that tables/columns match the expected pre-migration state
```

### 5.2 Point-in-Time Recovery (PITR)

If migration rollback scripts are insufficient:

1. **Supabase PITR** (if enabled):
   - Navigate to Supabase Dashboard > Database > Backups
   - Select point-in-time before the migration
   - Restore to a new project for verification
   - If verified, switch the production connection string

2. **Manual data recovery**:
   - Use database snapshots taken before migration
   - Restore to a temporary database
   - Extract and migrate affected data

### 5.3 Migration Rollback Checklist

```
[ ] Rollback script tested in staging
[ ] Application compatible with rolled-back schema
[ ] No data loss from rollback (additive changes are safe)
[ ] Foreign key constraints handled
[ ] Triggers and functions reverted if necessary
[ ] Application redeployed if needed to match schema
```

---

## 6. Full System Rollback

For a complete rollback of all services, frontend, and database to a known-good state:

### Step 1: Stop Traffic (if severe)

```bash
# Option A: Return maintenance page via WAF
# Add a WAF rule to block all traffic and return 503

# Option B: Scale Lambda concurrency to 0 (emergency)
aws lambda put-function-concurrency \
  --function-name production-lynia-payment-service \
  --reserved-concurrent-executions 0
```

### Step 2: Rollback Lambda Services

```bash
# Redeploy from known-good commit
GOOD_COMMIT="<last-known-good-commit>"
git checkout $GOOD_COMMIT

sam build --config-env production
sam deploy --config-env production \
  --no-fail-on-empty-changeset \
  --on-failure ROLLBACK
```

### Step 3: Rollback Database (if needed)

```bash
pnpm db:migrate:rollback --env production
```

### Step 4: Rollback Frontend

```bash
# Rebuild from known-good commit (still on $GOOD_COMMIT)
cd frontend/admin-portal && pnpm install --frozen-lockfile && pnpm build
aws s3 sync out/ "s3://production-lynia-admin-portal/" --delete

cd ../distributor-dashboard && pnpm install --frozen-lockfile && pnpm build
aws s3 sync out/ "s3://production-lynia-distributor-dashboard/" --delete

# Invalidate CDN
aws cloudfront create-invalidation --distribution-id $ADMIN_CF_ID --paths "/*"
aws cloudfront create-invalidation --distribution-id $DIST_CF_ID --paths "/*"
```

### Step 5: Restore Traffic

```bash
# Remove WAF block rule or restore Lambda concurrency
aws lambda delete-function-concurrency \
  --function-name production-lynia-payment-service
```

### Step 6: Verify

Run the full post-deployment verification checklist (see [POST-DEPLOYMENT-CHECKLIST.md](POST-DEPLOYMENT-CHECKLIST.md)).

---

## 7. Post-Rollback Verification

After any rollback, verify the system is in a healthy state:

```bash
# 1. All services responding
for svc in health scoring/health payments/health; do
  curl -s -o /dev/null -w "%{http_code} $svc\n" \
    "https://api.lyniafinance.co.zw/$svc"
done

# 2. No errors in last 5 minutes
aws logs filter-log-events \
  --log-group-name /aws/lambda/production-lynia-payment-service \
  --start-time $(date -d '-5 min' +%s000) \
  --filter-pattern '{ $.level = "error" }' \
  --limit 5

# 3. No active alarms
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --alarm-name-prefix production-lynia

# 4. SQS queues draining normally
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/<account>/production-lynia-payment-dlq \
  --attribute-names ApproximateNumberOfMessagesVisible

# 5. Frontend accessible
curl -s -o /dev/null -w "%{http_code}" https://admin.lyniafinance.co.zw
curl -s -o /dev/null -w "%{http_code}" https://distributor.lyniafinance.co.zw
```

### Post-Rollback Communication

Post to Slack `#incidents`:
```
:white_check_mark: ROLLBACK COMPLETE
Rolled back to: [commit hash / version]
Duration: [X minutes]
Trigger: [reason for rollback]
Status: All services healthy
Next steps: [investigate root cause]
```

### Post-Rollback Incident Review

Within 24 hours of rollback:
1. Create post-incident review document
2. Identify root cause of deployment failure
3. Document lessons learned
4. Update this runbook if needed
5. Fix the issue and plan re-deployment

---

**Target: All rollback procedures complete within 5 minutes**
**Document Owner:** Engineering Team
**Review Schedule:** After every rollback event
