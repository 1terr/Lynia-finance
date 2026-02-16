# Fineract Upgrade Guide

**Last Updated:** February 16, 2026
**Current Version:** apache/fineract:latest (v1.13.0 at time of deployment)
**Platform:** AWS ECS Fargate

---

## Overview

Apache Fineract is an open-source core banking platform maintained by the Apache Software Foundation. It powers Lynia Finance's loan management, GL accounting, and regulatory reporting. As an actively developed project, new versions are released regularly with bug fixes, security patches, and new features.

This guide documents how to safely upgrade Fineract in our AWS ECS deployment.

---

## Fineract Release Lifecycle

### Release Sources

- **GitHub Releases:** https://github.com/apache/fineract/releases
- **Docker Hub:** https://hub.docker.com/r/apache/fineract/tags
- **Apache Downloads:** https://fineract.apache.org/downloads/

### Version Naming

```
Major.Minor.Patch
  │     │     │
  │     │     └── Bug fixes, security patches (safe to upgrade)
  │     └──────── New features, minor API changes (test before upgrading)
  └────────────── Breaking changes, major API redesign (requires migration planning)
```

### Current Image Configuration

```yaml
# In fineract-ecs.yaml
Image: !Sub "apache/fineract:${FineractImageTag}"
# Currently deployed with: FineractImageTag = latest
```

**IMPORTANT:** The first action item is to pin to a specific version tag.

---

## Pre-Upgrade Checklist

Before upgrading Fineract to any new version:

```markdown
### 1. Research Phase
- [ ] Read the release notes for the target version
- [ ] Check for breaking API changes (compare Swagger docs)
- [ ] Check for database migration scripts in the release
- [ ] Review the changelog for security fixes
- [ ] Check community forums/JIRA for known issues with the new version

### 2. Compatibility Check
- [ ] Verify PostgreSQL version compatibility (we use PostgreSQL 16)
- [ ] Verify Java version requirements (our image uses the bundled JDK)
- [ ] Check if any deprecated APIs we use are removed
- [ ] Review our TypeScript client (`services/shared/clients/fineract.ts`)
      for API compatibility with the new version

### 3. Preparation
- [ ] Create a database backup (RDS snapshot)
- [ ] Document current Fineract configuration (tenants, products, GL accounts)
- [ ] Update the Docker image tag in `fineract-ecs.yaml`
- [ ] Test the new image locally (if possible)
- [ ] Plan a maintenance window for production upgrade
```

---

## Upgrade Procedures

### Procedure A: Patch Upgrade (e.g., 1.13.0 → 1.13.1)

**Risk:** Low
**Downtime:** ~5 minutes (ECS rolling update)
**Database Migration:** Usually not required

#### Steps

1. **Create RDS Snapshot**

```bash
aws rds create-db-snapshot \
  --db-instance-identifier production-lynia-rds \
  --db-snapshot-identifier pre-fineract-upgrade-$(date +%Y%m%d)
```

2. **Update the Image Tag**

Edit `phase-6-fineract-integration/infrastructure/fineract-ecs.yaml`:

```yaml
Parameters:
  FineractImageTag:
    Type: String
    Default: 1.13.1  # Updated from 1.13.0
```

3. **Deploy via CloudFormation**

```bash
aws cloudformation deploy \
  --template-file phase-6-fineract-integration/infrastructure/fineract-ecs.yaml \
  --stack-name production-lynia-fineract-ecs \
  --parameter-overrides \
    Environment=production \
    FineractImageTag=1.13.1 \
    FineractSecretArn=arn:aws:secretsmanager:us-east-1:849695476598:secret:production/lynia/fineract-peFuQp \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset
```

4. **Monitor the Deployment**

```bash
# Watch the ECS service update
aws ecs describe-services \
  --cluster production-lynia-fineract \
  --services fineract-server \
  --query "services[0].deployments"

# Watch the logs
aws logs tail /ecs/production-lynia-fineract --follow

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:849695476598:targetgroup/production-fineract-tg/7f1ca55627f34ffc
```

5. **Verify**

```bash
# Check Fineract version via API
curl -k https://internal-production-lynia-fineract-alb-1096024907.us-east-1.elb.amazonaws.com:8443/fineract-provider/api/v1/self \
  -u "mifos:password"
```

6. **Rollback if Needed**

ECS circuit breaker will automatically roll back if the new version fails health checks. To manually rollback:

```bash
aws cloudformation deploy \
  --template-file phase-6-fineract-integration/infrastructure/fineract-ecs.yaml \
  --stack-name production-lynia-fineract-ecs \
  --parameter-overrides \
    Environment=production \
    FineractImageTag=1.13.0 \
    FineractSecretArn=arn:aws:secretsmanager:us-east-1:849695476598:secret:production/lynia/fineract-peFuQp \
  --capabilities CAPABILITY_IAM
```

---

### Procedure B: Minor Upgrade (e.g., 1.13.x → 1.14.x)

**Risk:** Medium
**Downtime:** 10-30 minutes
**Database Migration:** Likely required

#### Additional Steps (beyond Procedure A)

1. **Check for Database Migrations**

Fineract uses Liquibase for database schema management. New minor versions often include migration scripts that run automatically on startup. Check the release notes for:

- New tables
- Column additions/modifications
- Index changes
- Data migrations

2. **Test in Staging First**

```bash
# Deploy new version to staging (if available)
aws cloudformation deploy \
  --stack-name staging-lynia-fineract-ecs \
  --parameter-overrides \
    Environment=staging \
    FineractImageTag=1.14.0 \
  ...

# Run integration tests against staging
# Verify all API endpoints our TypeScript client uses
```

3. **Update TypeScript Client**

If API endpoints changed, update `services/shared/clients/fineract.ts`:

```typescript
// Check these methods still work with the new API version:
// - createClient()
// - createLoan()
// - approveLoan()
// - disburseLoan()
// - makeRepayment()
// - getGLAccounts()
// - getLoanProducts()
// - getOffices()
// - getStaff()
// - runReport()
```

4. **Update Admin Portal**

If the API response format changed, update the Fineract admin pages:

```
frontend/admin-portal/src/app/(dashboard)/fineract/
  ├── loans/page.tsx
  ├── approval/page.tsx
  ├── accounting/page.tsx
  ├── products/page.tsx
  ├── overdue/page.tsx
  └── reconciliation/page.tsx
```

5. **Update Sync Service**

Check `services/shared/clients/fineract-sync.ts` and `fineract-reconcile.ts` for API compatibility.

---

### Procedure C: Major Upgrade (e.g., 1.x → 2.x)

**Risk:** High
**Downtime:** Hours to days (plan maintenance window)
**Database Migration:** Required, possibly breaking

#### Strategy

Major upgrades should be treated as a mini-project:

1. **Create a Parallel Environment**
   - Deploy new Fineract version alongside the existing one
   - Point it at a copy of the database (RDS clone)
   - Run all migrations on the clone
   - Test thoroughly

2. **API Compatibility Audit**
   - Compare Swagger/OpenAPI specs between versions
   - List all breaking changes
   - Update TypeScript client
   - Update all tests

3. **Data Migration Testing**
   - Restore production database to a test environment
   - Run the new Fineract against it
   - Verify all data integrity
   - Test all loan workflows end-to-end

4. **Cutover Plan**
   - Schedule maintenance window
   - Take final RDS snapshot
   - Stop current Fineract service
   - Apply database migrations
   - Deploy new version
   - Verify
   - Switch traffic

---

## Configuration That Survives Upgrades

Fineract stores its configuration in the database, not in the container. The following will persist across upgrades:

| Configuration | Storage Location | Survives Upgrade? |
|---|---|---|
| Tenants | `fineract_tenants` database | Yes |
| Loan Products | `fineract_default` database | Yes |
| GL Chart of Accounts | `fineract_default` database | Yes |
| Offices & Staff | `fineract_default` database | Yes |
| Currency Configuration | `fineract_default` database | Yes |
| Active Loans | `fineract_default` database | Yes |
| Transaction History | `fineract_default` database | Yes |

The following is in the container and must be managed via CloudFormation:

| Configuration | Storage Location | Managed By |
|---|---|---|
| JVM Options | Task Definition Environment | `fineract-ecs.yaml` |
| Database Credentials | Secrets Manager | CloudFormation parameter |
| TLS Certificate | ACM | Hardcoded ARN in template |
| Resource Limits (CPU/Memory) | Task Definition | `fineract-ecs.yaml` |

---

## Monitoring During Upgrades

### Key Metrics to Watch

```bash
# 1. ECS task health
aws ecs describe-services --cluster production-lynia-fineract --services fineract-server

# 2. ALB target health
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# 3. Application logs (look for startup errors)
aws logs tail /ecs/production-lynia-fineract --follow --since 5m

# 4. CloudWatch alarms
aws cloudwatch describe-alarms --alarm-name-prefix production-lynia-fineract

# 5. Database connections
# (Check RDS metrics in CloudWatch console)
```

### Success Criteria

After an upgrade, verify:

- [ ] Fineract logs show "Started FineractApplication" or similar
- [ ] ALB target health is "healthy"
- [ ] All CloudWatch alarms are in "OK" state
- [ ] API responds to health check endpoint
- [ ] TypeScript client can authenticate and make basic API calls
- [ ] Admin portal Fineract pages load data correctly
- [ ] Existing loans and products are visible and unmodified

---

## Recommended Immediate Action: Pin Docker Image

The current deployment uses `apache/fineract:latest`, which means a container restart could pull a different version unexpectedly.

**Action:** Pin to the specific version that is currently running:

1. Check current image digest:

```bash
aws ecs describe-task-definition \
  --task-definition production-lynia-fineract \
  --query "taskDefinition.containerDefinitions[0].image"
```

2. Find the specific version tag on Docker Hub that matches the current image

3. Update `fineract-ecs.yaml`:

```yaml
FineractImageTag:
  Type: String
  Default: 1.13.0  # Pin to specific version
```

4. Redeploy to lock in the version

---

## Fineract Community Resources

| Resource | URL | Purpose |
|---|---|---|
| GitHub Repository | https://github.com/apache/fineract | Source code, issues, PRs |
| JIRA | https://issues.apache.org/jira/projects/FINERACT | Bug tracking, feature requests |
| Mailing Lists | https://fineract.apache.org/community/ | Developer community |
| Wiki | https://cwiki.apache.org/confluence/display/FINERACT | Documentation |
| Docker Hub | https://hub.docker.com/r/apache/fineract | Official Docker images |
| API Documentation | `/fineract-provider/api-docs/apiLive.htm` (on running instance) | Swagger/OpenAPI docs |

---

## Version Upgrade History

| Date | From | To | Type | Notes |
|---|---|---|---|---|
| 2026-02-16 | N/A | latest (1.13.0) | Initial Deployment | First deployment to production |
| | | | | |

*Update this table after each upgrade.*
