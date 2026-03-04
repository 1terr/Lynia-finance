# Post-Deployment Verification Checklist

**Document:** Lynia Finance - Post-Deployment Verification Checklist
**Version:** 2.0
**Last Updated:** February 13, 2026
**Phase:** Phase 5 - AWS Deployment (T001-T017)

---

## Pre-Deployment Prerequisites

- [ ] All Phase 5 tasks T001-T009 completed (VPC, Cognito, RDS, S3, SQS, Secrets, IAM, DB migrations)
- [ ] AWS CLI v2 configured with appropriate credentials
- [ ] SAM CLI installed (v1.100+)
- [ ] Node.js 20.x and pnpm installed
- [ ] `gh` CLI authenticated (for GitHub secrets configuration)

---

## 1. Infrastructure Stacks (T001-T009)

- [ ] All CloudFormation stacks in `CREATE_COMPLETE` or `UPDATE_COMPLETE`
- [ ] VPC: 2 private subnets, 2 public subnets, NAT Gateways operational
- [ ] Cognito: User Pool created with 5 groups (admin, manager, support, reports_viewer, distributor)
- [ ] RDS: PostgreSQL 16 instance `available`
- [ ] S3: Storage buckets created and encrypted
- [ ] SQS: All 5 queues + 5 DLQs accessible, DLQs empty
- [ ] Secrets Manager: All 7 secrets present
- [ ] IAM: Deployment, admin, incident response roles created
- [ ] Database: All 18 migrations applied successfully

## 2. Lambda Functions (T0010)

Run: `./scripts/deploy-lambda.sh --env production`

- [ ] All 6 Lambda functions in `Active` state
- [ ] Runtime: `nodejs20.x` on all functions
- [ ] Architecture: `arm64` on all functions
- [ ] Memory: Payment/Scoring=1024MB, others=512MB
- [ ] VPC config: 2 SubnetIds, 1 SecurityGroupId per function
- [ ] Reserved concurrency: Payment=100, Scoring=50 (production only)
- [ ] SQS event source mappings connected (5 queues)
- [ ] AutoPublishAlias `live` set on all 6 functions
- [ ] API Gateway Cognito authorizer active
- [ ] Webhook endpoints unauthenticated (WhatsApp, KYC callback, Payment webhook)

## 3. API Gateway Throttling (T0011)

Run: `./scripts/deploy-api-gateway-throttling.sh --env=production`

- [ ] 3 usage plans created: Internal (100 RPS), Partner (200 RPS), Public (20 RPS)
- [ ] 5+ API keys generated and associated with usage plans
- [ ] CloudWatch logging enabled for API Gateway
- [ ] Rate limit exceeded returns HTTP 429

## 4. WAF & CloudWatch Monitoring (T0012)

Run: `./scripts/deploy-waf.sh --env=production && ./scripts/deploy-monitoring.sh --env=production`

- [ ] WAF Web ACL associated with API Gateway stage
- [ ] SQL injection blocked (HTTP 403)
- [ ] XSS payloads blocked (HTTP 403)
- [ ] Rate limiting: 2000 req/5min per IP
- [ ] Geo-restriction: ZW, ZA, BW, MZ, MW, US, GB, DE allowed
- [ ] 25+ CloudWatch alarms configured
- [ ] 5 dashboards: Real-Time, Business, Technical, Security, Cost
- [ ] 3 SNS topics: critical-alerts, warning-alerts, info-alerts
- [ ] Log groups with retention: Production=5yr, Staging=90d
- [ ] S3 log archival with Glacier lifecycle (production)
- [ ] PII leak detection metric filters active

## 5. DNS & SSL (T0013)

Run: `./scripts/deploy-dns-ssl.sh --env=production`

- [ ] Route 53 hosted zone for `lyniafinance.com`
- [ ] ACM certificate for `api.lyniafinance.com`: `ISSUED`
- [ ] ACM certificate for frontend subdomains: `ISSUED`
- [ ] Custom domain `api.lyniafinance.com` mapped to API Gateway
- [ ] TLS 1.2+ enforced
- [ ] Health check active (production)
- [ ] NS records updated at domain registrar (if new hosted zone)

## 6. Frontend Hosting (T0014)

Run: `./scripts/deploy-frontend-hosting.sh --env=production && ./scripts/build-and-upload-frontend.sh --env=production`

- [ ] Admin Portal S3 bucket populated
- [ ] Distributor Dashboard S3 bucket populated
- [ ] CloudFront distributions deployed (HTTP/2 + HTTP/3)
- [ ] Security headers: HSTS, X-Frame-Options, CSP, X-Content-Type-Options
- [ ] SPA routing: 403/404 redirect to `/index.html`
- [ ] `admin.lyniafinance.com` returns HTTP 200
- [ ] `distributor.lyniafinance.com` returns HTTP 200
- [ ] Cognito config baked into builds (UserPoolId, ClientId, Region)
- [ ] Static assets cached with immutable headers
- [ ] HTML files served with no-cache

## 7. Auto-Scaling & Canary (T0015)

Run: `./scripts/deploy-lambda-autoscaling.sh --env=production`

- [ ] Provisioned concurrency READY: Payment=5, Scoring=3, WhatsApp=3
- [ ] Auto-scaling: 70% target tracking on Payment (5-50), Scoring (3-30), WhatsApp (3-30)
- [ ] Scheduled scaling: Business hours 06:00-20:00 CAT
- [ ] CodeDeploy canary: Payment=10%/30min, Others=10%/15min
- [ ] X-Ray sampling: Payment=100%, KYC=50%, Scoring=25%, Default=5%
- [ ] No spillover invocations

## 8. Cognito Users & GitHub Secrets (T0016)

Run: `./scripts/create-cognito-users.sh --env=production && ./scripts/configure-github-secrets.sh --env=production`

- [ ] Admin user `admin@lynia.co.zw` created (admin group, FORCE_CHANGE_PASSWORD)
- [ ] Manager user `manager@lynia.co.zw` created (manager group, FORCE_CHANGE_PASSWORD)
- [ ] GitHub secrets set: AWS_REGION, COGNITO_USER_POOL_ARN
- [ ] GitHub variables set: COGNITO_USER_POOL_ID, COGNITO_ADMIN_CLIENT_ID, COGNITO_DISTRIBUTOR_CLIENT_ID
- [ ] GitHub secrets set: ADMIN_PORTAL_BUCKET, ADMIN_CF_DISTRIBUTION
- [ ] GitHub secrets set: DISTRIBUTOR_BUCKET, DISTRIBUTOR_CF_DISTRIBUTION
- [ ] GitHub variable set: API_URL
- [ ] Manual: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY set
- [ ] Manual: External service API keys set (WhatsApp, DIDIT, EcoCash, etc.)

## 9. E2E Validation (T0017)

Run: `./scripts/validate-production.sh --env production --verbose`

- [ ] Section 1: All CloudFormation stacks healthy
- [ ] Section 2: All 6 Lambda functions Active
- [ ] Section 3: All API endpoints responding
- [ ] Section 4: Both frontend apps return HTTP 200
- [ ] Section 5: RDS instance available
- [ ] Section 6: All 5 SQS queues available, DLQs empty
- [ ] Section 7: WAF blocking SQL injection and XSS
- [ ] Section 8: 20+ alarms, 5 dashboards, 3 SNS topics
- [ ] Section 9: All 7 secrets present
- [ ] Section 10: Provisioned concurrency READY, VPC with NAT Gateways

---

## Emergency Procedures

| Action | Command |
|--------|---------|
| Rollback Lambda | `./scripts/rollback.sh` |
| Rollback Frontend | `./scripts/rollback-frontend.sh` |
| View logs | `sam logs --config-env production --tail` |
| Validation | `./scripts/validate-production.sh --env production` |
| On-call runbook | `docs/ON-CALL-RUNBOOK.md` |

## Deployment Scripts

| Script | Task | Purpose |
|--------|------|---------|
| `deploy-lambda.sh` | T0010 | SAM build and deploy all Lambda functions |
| `deploy-api-gateway-throttling.sh` | T0011 | Usage plans and API keys |
| `deploy-waf.sh` | T0012 | WAF Web ACL deployment |
| `deploy-monitoring.sh` | T0012 | CloudWatch alarms, dashboards, log retention |
| `deploy-dns-ssl.sh` | T0013 | Route 53, ACM certificates |
| `deploy-frontend-hosting.sh` | T0014 | S3 + CloudFront infrastructure |
| `build-and-upload-frontend.sh` | T0014 | Build and upload frontend assets |
| `deploy-lambda-autoscaling.sh` | T0015 | Provisioned concurrency, canary, X-Ray |
| `create-cognito-users.sh` | T0016 | Initial Cognito users |
| `configure-github-secrets.sh` | T0016 | GitHub Actions secrets/variables |
| `validate-production.sh` | T0017 | E2E validation and smoke tests |
