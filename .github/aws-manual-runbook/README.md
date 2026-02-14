# AWS Manual Deployment Runbook

These are the **14 manual actions** that must be completed before Lynia Finance can deploy to AWS. They cannot be automated through code changes alone -- they require AWS Console, AWS CLI, GitHub settings, or external service configuration.

**Complete these in order.** Each guide is self-contained with copy-paste commands.

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
| M6 | [Store VPC Outputs in SSM](./M06-store-vpc-ssm.md) | 5 min | M1 |
| M7 | [Store Cognito ARN in SSM](./M07-store-cognito-ssm.md) | 5 min | M4 |
| M8 | [Populate Secrets Manager](./M08-populate-secrets.md) | 10 min | M2 |

### Phase 3: CI/CD & GitHub (Do Third)

| Task | Guide | Time | Depends On |
|------|-------|------|------------|
| M9 | [Set GitHub Secrets](./M09-github-secrets.md) | 5 min | Nothing |
| M10 | [Set GitHub Variables](./M10-github-variables.md) | 10 min | M4, M14 |

### Phase 4: DNS, SSL & Frontend (Do Last)

| Task | Guide | Time | Depends On |
|------|-------|------|------------|
| M11 | [Domain DNS Delegation](./M11-dns-delegation.md) | 15 min | Nothing |
| M12 | [ACM Certificate Validation](./M12-acm-certificates.md) | 10-30 min | M11 |
| M13 | [Enroll Users in MFA](./M13-cognito-mfa.md) | 10 min | M5 |
| M14 | [Deploy CloudFront + WAF](./M14-cloudfront-waf.md) | 15 min | M12 |

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
