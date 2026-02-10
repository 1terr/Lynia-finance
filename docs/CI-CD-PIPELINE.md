# Lynia Finance - CI/CD Pipeline Documentation

## Pipeline Overview

The Lynia Finance CI/CD pipeline automates the path from code commit to production deployment with security gates, testing, manual approvals, and automated rollback capabilities.

```
Code Push (master)
    |
    v
[Stage 1: Lint & Test] -----> [Stage 2: Security Scan]
    |                                |
    +--- Both must pass -------------+
    |
    v
[Stage 3: Build & Validate (SAM)]
    |
    v
[Stage 4: Deploy to Staging]
    |
    v  (Manual workflow_dispatch only)
[Stage 5: Deploy to Production]
    |   - Requires GitHub Environment approval
    |   - Verifies staging health first
    |   - Records pre-deploy state
    |   - Post-deploy smoke tests
    |   - 2-min error rate monitoring
    |
    v
[Stage 6: Notifications (Slack, Email, GitHub Summary)]
```

## Pipeline Stages

### Stage 1: Lint & Test (Blocking)

- **Trigger**: Every push to `master`, every PR, every manual dispatch
- **Actions**:
  - ESLint validation (blocking - must pass)
  - Full test suite with coverage
  - Coverage gate at 80% threshold
  - Codecov upload
- **Blocks deployment on failure**: Yes

### Stage 2: Security Scan (Blocking)

- **Runs in parallel with Stage 1**
- **Actions**:
  - `pnpm audit` for dependency vulnerabilities (high/critical)
  - Scans source code for hardcoded secrets (API keys, passwords, AWS credentials)
  - CloudFormation template linting (`cfn-lint`)
- **Blocks deployment on failure**: Yes

### Stage 3: Build & Validate

- **Requires**: Stages 1 and 2 pass
- **Actions**:
  - SAM build (parallel, cached)
  - SAM validate with CloudFormation lint
  - Build artifacts uploaded (retained 7 days)

### Stage 4: Deploy to Staging

- **Trigger**: Automatic on `master` push, or manual dispatch with `staging` selected
- **Actions**:
  - Database migration validation (warns on destructive changes)
  - SAM deploy to staging stack
  - Smoke tests against staging endpoints
- **GitHub Environment**: `staging`

### Stage 5: Deploy to Production

- **Trigger**: Manual dispatch only with `production` selected
- **GitHub Environment**: `production` (requires reviewer approval)
- **Pre-deployment checks**:
  - Verifies staging stack is healthy
  - Validates database migrations
  - Records pre-deployment state for rollback reference
- **Deployment**:
  - SAM deploy with `--on-failure ROLLBACK`
  - CloudFormation auto-rollback on stack failure
- **Post-deployment**:
  - Smoke tests against production endpoints
  - 2-minute error rate monitoring via CloudWatch
  - GitHub Release creation
- **Canary deployments**: Lambda traffic shifting via CodeDeploy (see below)

### Stage 6: Notifications

- **Slack**: Deployment status with environment, branch, commit, actor
- **Email**: Production failure alerts
- **GitHub Summary**: Stage-by-stage result table

## Frontend Deployment (Blue-Green)

Frontend deployments use a blue-green strategy with versioned S3 prefixes.

```
S3 Bucket Structure:
  s3://production-lynia-admin-portal/
    ├── index.html              (live - served by CloudFront)
    ├── _next/                  (live assets)
    └── deployments/
        ├── CURRENT_VERSION     (pointer to active version)
        ├── v20260210-143022-abc1234/   (green - new version)
        ├── v20260209-091500-def5678/   (blue - previous version)
        └── v20260208-120000-ghi9012/   (archived)
```

### Deployment Flow

1. **Build & Test**: Lint, test, build Next.js output
2. **Upload green**: New build uploaded to `deployments/v{timestamp}/`
3. **Switch traffic**: Root files updated from green prefix
4. **Record version**: `CURRENT_VERSION` marker updated
5. **Cleanup**: Old deployments pruned (keep last 5)
6. **CloudFront invalidation**: Cache cleared for immediate visibility

### Rollback

```bash
./scripts/rollback-frontend.sh production admin-portal
```

Lists available versions and restores from a previous S3 prefix. Rollback completes in under 60 seconds.

## Lambda Canary Deployments

Lambda functions use CodeDeploy for gradual traffic shifting.

| Service | Strategy (Production) | Strategy (Staging) |
|---------|----------------------|-------------------|
| Payment | Canary 10% / 30 min | Canary 10% / 5 min |
| Scoring | Canary 10% / 15 min | Canary 10% / 5 min |
| WhatsApp | Canary 10% / 15 min | Canary 10% / 5 min |
| KYC | Linear 10% / 1 min | Linear 10% / 1 min |
| Lock | Linear 10% / 1 min | Linear 10% / 1 min |
| Notification | Linear 10% / 1 min | Linear 10% / 1 min |

**Automatic rollback triggers**:
- Deployment failure
- CloudWatch alarm breach during canary window
- Pre/post traffic hook validation failure

## Manual Rollback Procedures

### Backend (Lambda/CloudFormation)

```bash
# Staging
./scripts/rollback.sh staging

# Production (requires typing "ROLLBACK")
./scripts/rollback.sh production
```

### Frontend

```bash
# Rollback admin portal
./scripts/rollback-frontend.sh production admin-portal

# Rollback distributor dashboard
./scripts/rollback-frontend.sh staging distributor-dashboard
```

### Full Production Deployment

```bash
# Full deployment (infra + services + frontend)
./scripts/deploy-production.sh

# Services only (skip infra and frontend)
./scripts/deploy-production.sh --services-only

# Dry run (no changes)
./scripts/deploy-production.sh --dry-run
```

## Security Gates

| Gate | Stage | Blocking |
|------|-------|----------|
| ESLint | Test | Yes |
| Unit tests | Test | Yes |
| Coverage >= 80% | Test | Warning |
| Dependency audit | Security Scan | Warning (high), Error (critical) |
| Hardcoded secrets scan | Security Scan | Warning |
| CloudFormation lint | Security Scan | Warning |
| SAM validate | Build | Yes |
| Staging health check | Production Deploy | Yes |
| Migration validation | Deploy | Warning (staging), Error (production, destructive) |

## Concurrency Control

- Backend deployments: One per environment (`deploy-staging`, `deploy-production`)
- Frontend deployments: One per environment (`deploy-frontend-staging`, etc.)
- Concurrent deployments to the same environment are queued, not cancelled

## Environment Configuration

| Secret | Staging | Production |
|--------|---------|------------|
| `AWS_ACCESS_KEY_ID` | Shared | Shared |
| `STAGING_SUPABASE_URL` | Per-env | - |
| `PRODUCTION_SUPABASE_URL` | - | Per-env |
| `SLACK_WEBHOOK_URL` | Repo variable | Repo variable |

## Deployment Notifications

Configure these repository variables for notifications:
- `SLACK_WEBHOOK_URL`: Slack incoming webhook for deployment notifications
- `ALERT_EMAIL`: Email address for production failure alerts

## Troubleshooting

### Pipeline blocked by test failure
1. Check the failing test in the Actions log
2. Fix the test locally, push to branch
3. Tests must pass before deployment proceeds

### Staging stack in ROLLBACK_COMPLETE
The pipeline automatically detects and cleans up failed stacks before redeploying.

### Production deployment failed
1. CloudFormation auto-rollback is enabled (`--on-failure ROLLBACK`)
2. Check CloudWatch for error spikes
3. Run `./scripts/rollback.sh production` for manual rollback
4. Review deployment logs in GitHub Actions

### Frontend not updating after deploy
1. Verify CloudFront invalidation completed
2. Check S3 bucket for updated files
3. Clear browser cache (service worker may cache old version)
4. Rollback: `./scripts/rollback-frontend.sh <env> <app>`
