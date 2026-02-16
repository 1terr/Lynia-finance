# Phase 10: Next Steps & Recommendations

**Date:** 2026-02-16
**Previous Phases:** 1-9 Complete

---

## Current System Status

| Component | Status | Health |
|-----------|--------|--------|
| Fineract Core Banking (ALB) | Running | Active on port 8443 |
| 8 Lambda Services (main stack) | Deployed | All functions active |
| Fineract Proxy Lambda (separate stack) | Deployed | `94al6ng32i` API active |
| Admin Portal (CloudFront) | Deployed | 30 pages serving |
| PostgreSQL (RDS) | Running | 19 migrations applied |
| Cognito Auth | Active | Pool `us-east-1_VHEEa5faP` |
| EventBridge Reconciliation | Enabled | 6-hour schedule |

---

## Recommended Next Steps (Priority Order)

### P0 - Critical (Do This Week)

#### 1. End-to-End Smoke Test with Live Cognito Token
The Fineract proxy API returns 401 without auth, confirming Cognito is working. But no authenticated end-to-end test has been run against the live Fineract proxy.

**Action:**
1. Log in to the admin portal at `https://d1qwfy2tsdmpe4.cloudfront.net`
2. Navigate to Fineract Loans page (`/fineract/loans`)
3. Verify loans load from Fineract with balances
4. Test a loan detail page with repayment schedule
5. Test the GL Accounting and Trial Balance pages

**Risk if skipped:** API may have runtime issues (date parsing, missing DB columns, Fineract API format changes) that only surface with real data.

#### 2. Fineract Proxy CloudWatch Monitoring
The proxy Lambda has no CloudWatch alarms configured.

**Action:**
- Add CloudWatch alarms for error rate > 5%, duration > 30s, throttles > 0
- Add a CloudWatch dashboard for Fineract proxy metrics
- Can be added to the `fineract-proxy-template.yaml` stack

#### 3. SSM Parameters for VPC Config
The main stack deployment uses `{resolve:ssm:...}` references in `samconfig.toml` but the SSM parameters don't exist, requiring manual parameter overrides.

**Action:**
```bash
aws ssm put-parameter --name /production/lynia/vpc/private-subnet-1 --type String --value subnet-07b4572d20eca2aa8
aws ssm put-parameter --name /production/lynia/vpc/private-subnet-2 --type String --value subnet-06a321aa46a25f622
aws ssm put-parameter --name /production/lynia/vpc/lambda-sg --type String --value sg-0218a50d7ffd89fb3
aws ssm put-parameter --name /production/lynia/cognito/user-pool-arn --type String --value "arn:aws:cognito-idp:us-east-1:849695476598:userpool/us-east-1_VHEEa5faP"
```

### P1 - Important (Do Within 2 Weeks)

#### 4. Consolidate SAM Stacks (Fix Circular Dependency Properly)
The Fineract proxy runs on a separate API Gateway because of a SAM circular dependency. This creates:
- Two API Gateway URLs for the admin portal to manage
- Separate deployment pipelines
- CORS complexity

**Long-term fix options:**
1. **Remove env var cycle:** Change `SCORING_API_URL` and `WHATSAPP_API_URL` to be resolved at runtime (Lambda reads API Gateway URL from environment or SSM) instead of referencing `LyniaApi` in the template
2. **Use CloudFormation DefinitionBody:** Define the full OpenAPI spec inline to control deployment dependencies
3. **Use HTTP API v2:** Migrate from REST API to HTTP API which has simpler dependency chains

#### 5. E2E Tests (Cypress/Playwright)
No end-to-end tests exist for the Fineract UI pages. Critical user journeys need coverage:
- Loan list -> Loan detail -> View repayment schedule
- Approve loan -> Disburse loan
- GL Accounting -> Journal entries -> Trial balance
- Reconciliation dashboard -> Trigger manual reconciliation

**Recommended tool:** Playwright (better for Next.js SSG apps)

#### 6. Rate Limiting on Fineract Proxy
The proxy forwards requests to the internal Fineract ALB. Without rate limiting, a buggy or malicious client could overwhelm Fineract.

**Action:**
- Add API Gateway usage plan + API key for rate limiting
- Or add `ReservedConcurrentExecutions` to the Lambda (simpler)
- Consider adding request caching for read-heavy endpoints (GL accounts, loan products)

### P2 - Nice to Have (Do Within 1 Month)

#### 7. Frontend Error Boundaries for Fineract Pages
If the Fineract API is unreachable, the UI pages should show meaningful error states rather than crashing.

**Action:**
- Add React Error Boundaries around Fineract data-fetching components
- Show "Fineract is temporarily unavailable" with retry button
- Add loading skeletons (some already exist)

#### 8. Fineract API Response Caching
Some Fineract data (loan products, GL account chart) changes infrequently and could be cached.

**Action:**
- Add Lambda-level caching (in-memory Map with TTL) for:
  - `/loan-products` (cache 5 minutes)
  - `/gl-accounts` (cache 5 minutes)
  - `/trial-balance` (cache 1 minute)
- Or add API Gateway caching at the stage level

#### 9. Distributor Dashboard Fineract Integration
The distributor dashboard (`distributor-dashboard/`) does not yet have Fineract integration. Distributors may need to see their portfolio's Fineract status.

**Action:** Assess if distributors need Fineract loan visibility and, if so, create a scoped subset of the proxy endpoints.

#### 10. CI/CD Pipeline for Fineract Proxy
The Fineract proxy stack is currently deployed manually. Add it to the CI/CD pipeline.

**Action:**
- Add `fineract-proxy-template.yaml` build/deploy to GitHub Actions
- Add the two-step build process:
  ```yaml
  - sam build --template-file fineract-proxy-template.yaml --no-cached
  - sam package --template-file .aws-sam/build/template.yaml --output-template-file .aws-sam/packaged.yaml
  - sam deploy --template-file .aws-sam/packaged.yaml
  ```

---

## Deployment Commands Reference

### Deploy Fineract Proxy Stack
```bash
# Build
sam build --template-file fineract-proxy-template.yaml --no-cached

# Package (critical: use built template)
sam package \
  --template-file .aws-sam/build/template.yaml \
  --output-template-file .aws-sam/packaged.yaml \
  --resolve-s3 --s3-prefix lynia-fineract-proxy-prod \
  --force-upload --region us-east-1

# Deploy
sam deploy \
  --template-file .aws-sam/packaged.yaml \
  --stack-name lynia-fineract-proxy-prod \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --parameter-overrides \
    "Environment=production" \
    "VpcEnabled=true" \
    "PrivateSubnet1Id=subnet-07b4572d20eca2aa8" \
    "PrivateSubnet2Id=subnet-06a321aa46a25f622" \
    "LambdaSecurityGroupId=sg-0218a50d7ffd89fb3" \
    "CognitoUserPoolArn=arn:aws:cognito-idp:us-east-1:849695476598:userpool/us-east-1_VHEEa5faP"
```

### Rebuild & Deploy Admin Portal
```bash
# Option A: Full script
./scripts/build-and-upload-frontend.sh --app admin-portal --env production

# Option B: Manual
NEXT_PUBLIC_API_BASE_URL="https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod" \
NEXT_PUBLIC_FINERACT_API_URL="https://94al6ng32i.execute-api.us-east-1.amazonaws.com/Prod" \
NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-1_VHEEa5faP" \
NEXT_PUBLIC_COGNITO_CLIENT_ID="p5r8r1llhgrqt2t2lvtfvbe14" \
NEXT_PUBLIC_COGNITO_REGION="us-east-1" \
pnpm --filter "@lynia/admin-portal" build

aws s3 sync frontend/admin-portal/out/ s3://production-lynia-admin-portal/ --delete --region us-east-1
aws cloudfront create-invalidation --distribution-id E3NB88CYCVFZN2 --paths "/*"
```

### Run Fineract Proxy Tests
```bash
npx jest tests/integration/fineract-proxy-service.test.ts
```

---

## AWS Resource Summary

| Resource | Identifier |
|----------|-----------|
| Main API Gateway | `kly80hrgca` (`lynia-finance-prod`) |
| Fineract API Gateway | `94al6ng32i` (`lynia-fineract-proxy-prod`) |
| Fineract Proxy Lambda | `production-lynia-fineract-proxy` |
| Admin Portal S3 | `production-lynia-admin-portal` |
| Admin Portal CloudFront | `E3NB88CYCVFZN2` (`d1qwfy2tsdmpe4.cloudfront.net`) |
| Cognito User Pool | `us-east-1_VHEEa5faP` |
| Admin Client ID | `p5r8r1llhgrqt2t2lvtfvbe14` |
| RDS PostgreSQL | `production-lynia-db.c4fkq4ym8j2s.us-east-1.rds.amazonaws.com` |
| Fineract ALB | `internal-production-lynia-fineract-alb-1096024907.us-east-1.elb.amazonaws.com:8443` |
| Lambda Security Group | `sg-0218a50d7ffd89fb3` |
| VPC Private Subnets | `subnet-07b4572d20eca2aa8`, `subnet-06a321aa46a25f622` |
