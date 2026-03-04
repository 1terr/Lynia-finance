# AWS Manual Deployment Runbook

These are the **14 manual actions** that must be completed before Lynia Finance can deploy to AWS. They cannot be automated through code changes alone -- they require AWS Console, AWS CLI, GitHub settings, or external service configuration.

**Complete these in order.** Each guide is self-contained with copy-paste commands.

## Completion Status (Production - 2026-02-14)

All 14 tasks have been completed for the **production** environment.

### Phase 1: Foundation Infrastructure

| Task | Guide | Status | Verified | Notes |
|------|-------|--------|----------|-------|
| M1 | [Deploy VPC](./M01-deploy-vpc.md) | COMPLETE | `production-lynia-vpc` CREATE_COMPLETE | VPC `vpc-064861e8a592a1646`, 2 public + 2 private subnets, dual NAT (prod), VPC endpoints for SecretsManager/CloudWatch/SQS/X-Ray |
| M2 | [Deploy RDS PostgreSQL](./M02-deploy-rds.md) | COMPLETE | `lynia-rds-production` CREATE_COMPLETE | Endpoint: `production-lynia-db.c4fkq4ym8j2s.us-east-1.rds.amazonaws.com:5432`, db.t4g.micro (free-tier), Single-AZ, 20GB gp2. **Upgrade to db.t4g.small + Multi-AZ when leaving free tier.** |
| M3 | [Run Database Migrations](./M03-run-db-migrations.md) | COMPLETE | 101 tables verified | Ran via temporary t3.micro bastion. Fixed table dependency ordering bug (admin_users defined after loans). Created `fix_missing_tables.sql` to restore 11 missing tables. All migrations 001-021 applied. |
| M4 | [Deploy Cognito User Pool](./M04-deploy-cognito.md) | COMPLETE | `production-lynia-cognito` UPDATE_COMPLETE | UserPoolId: `us-east-1_VHEEa5faP`, AdminClientId: `p5r8r1llhgrqt2t2lvtfvbe14`, DistributorClientId: `4hbecvok92om6n5tmqq43r7769` |
| M5 | [Create Cognito User Groups](./M05-create-cognito-groups.md) | COMPLETE | 5 groups verified | admin (1), manager (2), support (3), reports_viewer (4), distributor (5) |

### Phase 2: Wire Up SAM Deploy

| Task | Guide | Status | Verified | Notes |
|------|-------|--------|----------|-------|
| M6 | [Store VPC Outputs in SSM](./M06-store-vpc-outputs-ssm.md) | COMPLETE | 3 params verified | `/production/lynia/vpc/private-subnet-1`, `private-subnet-2`, `lambda-sg` |
| M7 | [Store Cognito ARN in SSM](./M07-store-cognito-arn-ssm.md) | COMPLETE | 1 param verified | `/production/lynia/cognito/user-pool-arn` |
| M8 | [Populate Secrets Manager](./M08-populate-secrets-manager.md) | COMPLETE | 7 secrets verified | `lynia/production/database` (real creds), whatsapp, didit, ecocash, onemoney, trustonic, sms (placeholders -- update with real API keys before go-live) |

### Phase 3: CI/CD & GitHub

| Task | Guide | Status | Verified | Notes |
|------|-------|--------|----------|-------|
| M9 | [Set GitHub Secrets](./M09-set-github-secrets.md) | COMPLETE | 3 secrets verified | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` set for user `github-actions-deploy` |
| M10 | [Set GitHub Variables](./M10-set-github-variables.md) | COMPLETE | 8 variables verified | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`, `API_URL`, `ADMIN_PORTAL_BUCKET`, `ADMIN_PORTAL_DISTRIBUTION_ID`, `DISTRIBUTOR_DASHBOARD_BUCKET`, `DISTRIBUTOR_DASHBOARD_DISTRIBUTION_ID` |

### Phase 4: DNS, SSL & Frontend

| Task | Guide | Status | Verified | Notes |
|------|-------|--------|----------|-------|
| M11 | [Domain DNS Delegation](./M11-domain-dns-delegation.md) | COMPLETE | DNS resolves for all 3 subdomains | Managed externally (not Route53). `admin.lyniafinance.com` -> CloudFront, `distributor.lyniafinance.com` -> CloudFront, `api.lyniafinance.com` -> API Gateway |
| M12 | [ACM Certificate Validation](./M12-acm-certificate-validation.md) | COMPLETE | ISSUED | `lyniafinance.com` (ISSUED), `api.lyniafinance.com` (ISSUED) |
| M13 | [Enroll Users in MFA](./M13-enroll-users-mfa.md) | COMPLETE | MFA=ON | Admin user `tereraishe@lyniafinance.com` created in admin group. MFA mandatory (TOTP). Temp password: user must change on first login. |
| M14 | [Deploy CloudFront + WAF](./M14-deploy-cloudfront-waf.md) | COMPLETE | `lynia-finance-production-waf` CREATE_COMPLETE | CloudFront: Admin (`E3NB88CYCVFZN2`) + Distributor (`E37VR48QGDRO2T`) both Deployed. WAF `production-lynia-web-acl` active on API Gateway with rate limiting, SQLi, XSS, bad input protection. |

## Prerequisites

Before starting, ensure you have:

- [ ] AWS CLI v2 installed (`aws --version` should show 2.x)
- [ ] AWS SAM CLI installed (`sam --version`)
- [ ] An AWS account with AdministratorAccess (or equivalent IAM permissions)
- [ ] AWS CLI configured with credentials (`aws configure`)
- [ ] Git access to this repository
- [ ] GitHub repository admin access (for secrets/variables)

```bash
# Verify your AWS identity
aws sts get-caller-identity

# Verify region is set
aws configure get region
# Should output: us-east-1
```

## Execution Order

The tasks are grouped into phases. Complete each phase before moving to the next.

### Phase 1: Foundation Infrastructure (Do First)

| Task | Guide | Time | Depends On |
|------|-------|------|------------|
| M1 | [Deploy VPC](./M01-deploy-vpc.md) | 10 min | Nothing |
| M2 | [Deploy RDS PostgreSQL](./M02-deploy-rds.md) | 15 min | M1 |
| M3 | [Run Database Migrations](./M03-run-db-migrations.md) | 5 min | M2 |
| M4 | [Deploy Cognito User Pool](./M04-deploy-cognito.md) | 10 min | Nothing |
| M5 | [Create Cognito User Groups](./M05-create-cognito-groups.md) | 5 min | M4 |

### Phase 2: Wire Up SAM Deploy (Do Second)

| Task | Guide | Time | Depends On |
|------|-------|------|------------|
| M6 | [Store VPC Outputs in SSM](./M06-store-vpc-outputs-ssm.md) | 5 min | M1 |
| M7 | [Store Cognito ARN in SSM](./M07-store-cognito-arn-ssm.md) | 5 min | M4 |
| M8 | [Populate Secrets Manager](./M08-populate-secrets-manager.md) | 10 min | M2 |

### Phase 3: CI/CD & GitHub (Do Third)

| Task | Guide | Time | Depends On |
|------|-------|------|------------|
| M9 | [Set GitHub Secrets](./M09-set-github-secrets.md) | 5 min | Nothing |
| M10 | [Set GitHub Variables](./M10-set-github-variables.md) | 10 min | M4, M14 |

### Phase 4: DNS, SSL & Frontend (Do Last)

| Task | Guide | Time | Depends On |
|------|-------|------|------------|
| M11 | [Domain DNS Delegation](./M11-domain-dns-delegation.md) | 15 min | Nothing |
| M12 | [ACM Certificate Validation](./M12-acm-certificate-validation.md) | 10-30 min | M11 |
| M13 | [Enroll Users in MFA](./M13-enroll-users-mfa.md) | 10 min | M5 |
| M14 | [Deploy CloudFront + WAF](./M14-deploy-cloudfront-waf.md) | 15 min | M12 |

## After All Manual Steps

Once all 14 tasks are complete, you can deploy:

```bash
# 1. Deploy backend Lambda functions
sam build --cached --parallel
sam deploy --config-env staging

# 2. Deploy frontend (via GitHub Actions)
git push origin master  # triggers .github/workflows/deploy-frontend.yml

# 3. Verify
bash scripts/validate-production.sh
```

## Environment Convention

Throughout these guides, replace `{ENV}` with your target environment:
- `development` -- local dev/testing
- `staging` -- pre-production QA
- `production` -- live customer-facing

Most commands default to `development`. For production, add `--config-env production` or change the `Environment` parameter.

## IAM Permissions Added During Deployment

The `github-actions-deploy` user required additional inline policies beyond the original managed policies:

| Inline Policy | Reason |
|---------------|--------|
| `RDSFullAccess` | M2: Deploy RDS stack |
| `EC2FullAccess` | M3: Create temporary bastion for migrations |
| `SecretsManagerFullAccess` | M8: Populate Secrets Manager |
| `SSMFullAccess` | M6/M7: Store SSM parameters |
| `Route53ACMWAFAccess` | M11/M12/M14: DNS, certs, WAF |
| `CloudWatchLogsAccess` | M14: WAF logging |

## Known Issues & Follow-ups

1. **RDS is on free-tier settings** -- Upgrade to `db.t4g.small`, Multi-AZ, 50GB gp3, 35-day backups when moving off free tier
2. **Secrets Manager placeholders** -- Replace placeholder values for WhatsApp, DIDIT, EcoCash, OneMoney, Trustonic, and SMS with real API credentials before go-live
3. **Migration dependency bug** -- `001_initial_schema.sql` has a table ordering issue (loans references admin_users before it's created). Fixed via `database/migrations/aws/fix_missing_tables.sql`
4. **WAF template fixes** -- `waf.yaml` had an invalid single-statement OrStatement and rate limit below minimum; both fixed
