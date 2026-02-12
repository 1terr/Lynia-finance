# P5-DEPLOY-T014: Deploy Frontend Hosting & Upload Assets - Progress Report

**Task:** P5-DEPLOY-T014 - Deploy Frontend Hosting & Upload Assets
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.4 Frontend & Finalization
**Priority:** Critical
**Estimated Hours:** 4
**Dependencies:** P5-DEPLOY-T003 (Cognito outputs), P5-DEPLOY-T013 (SSL cert for CloudFront)
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy S3 buckets and CloudFront distributions for admin portal and distributor dashboard. Build both Next.js frontends with production Cognito configuration, upload built assets to S3, invalidate CloudFront caches, and verify both apps load correctly.

## Deliverables

- [ ] S3 + CloudFront deployed for admin portal
- [ ] S3 + CloudFront deployed for distributor dashboard
- [ ] Both frontends built with production Cognito config
- [ ] Assets uploaded and CloudFront caches invalidated
- [ ] Both apps accessible via custom domains

## Acceptance Criteria

- [ ] `curl -sI https://admin.lyniafinance.com` returns HTTP/2 200
- [ ] `curl -sI https://distributor.lyniafinance.com` returns HTTP/2 200
- [ ] Login pages render correctly
- [ ] Security headers present: HSTS, X-Frame-Options, CSP
- [ ] CloudFront serving assets with proper cache headers

---

## Architecture

```
admin.lyniafinance.com ──→ CloudFront ──→ S3 (admin-portal bucket)
distributor.lyniafinance.com ──→ CloudFront ──→ S3 (distributor bucket)

Both distributions:
├── SSL via ACM certificate (from T013)
├── Custom error pages (403→index.html, 404→index.html for SPA routing)
├── Security headers via response headers policy
└── Gzip/Brotli compression enabled
```

---

## Steps

### Step 1: Deploy Frontend Hosting Infrastructure

```bash
CERT_ARN=$(aws cloudformation describe-stacks --stack-name production-lynia-dns \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendCertificateArn'].OutputValue" --output text)
HOSTED_ZONE=$(aws cloudformation describe-stacks --stack-name production-lynia-dns \
  --query "Stacks[0].Outputs[?OutputKey=='HostedZoneIdOutput'].OutputValue" --output text)

aws cloudformation deploy \
  --template-file infrastructure/aws/frontend-hosting.yaml \
  --stack-name production-lynia-frontend \
  --parameter-overrides \
    Environment=production \
    DomainName=lyniafinance.com \
    FrontendCertificateArn=$CERT_ARN \
    HostedZoneId=$HOSTED_ZONE \
  --region us-east-1
```

### Step 2: Get Cognito Configuration

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
ADMIN_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='AdminClientId'].OutputValue" --output text)
DISTRIBUTOR_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorClientId'].OutputValue" --output text)
```

### Step 3: Build Admin Portal

```bash
cd frontend/admin-portal

# Create production environment file
cat > .env.production.local <<EOF
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$ADMIN_CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_API_URL=https://api.lyniafinance.com
NEXT_PUBLIC_ENVIRONMENT=production
EOF

pnpm install
pnpm build
cd ../..
```

### Step 4: Build Distributor Dashboard

```bash
cd frontend/distributor-dashboard

cat > .env.production.local <<EOF
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$DISTRIBUTOR_CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_API_URL=https://api.lyniafinance.com
NEXT_PUBLIC_ENVIRONMENT=production
EOF

pnpm install
pnpm build
cd ../..
```

### Step 5: Upload to S3

```bash
# Get bucket names from stack outputs
ADMIN_BUCKET=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalBucketName'].OutputValue" --output text)
DIST_BUCKET=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardBucketName'].OutputValue" --output text)

# Upload admin portal (use --delete to remove old files)
aws s3 sync frontend/admin-portal/out s3://$ADMIN_BUCKET/ --delete

# Upload distributor dashboard
aws s3 sync frontend/distributor-dashboard/out s3://$DIST_BUCKET/ --delete
```

### Step 6: Invalidate CloudFront Caches

```bash
ADMIN_CF=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" --output text)
DIST_CF=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardDistributionId'].OutputValue" --output text)

aws cloudfront create-invalidation --distribution-id $ADMIN_CF --paths "/*"
aws cloudfront create-invalidation --distribution-id $DIST_CF --paths "/*"

# Wait for invalidation to complete (1-2 minutes)
echo "Invalidations created. Waiting for propagation..."
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. Admin portal loads
curl -sI https://admin.lyniafinance.com | head -5
# Expected: HTTP/2 200

# 3. Distributor dashboard loads
curl -sI https://distributor.lyniafinance.com | head -5
# Expected: HTTP/2 200

# 4. Security headers
curl -sI https://admin.lyniafinance.com | grep -iE "strict-transport|x-frame|content-security|x-content-type"
# Expected:
# strict-transport-security: max-age=31536000; includeSubdomains
# x-frame-options: DENY
# content-security-policy: ...
# x-content-type-options: nosniff

# 5. SPA routing works (any path returns index.html)
curl -s -o /dev/null -w "%{http_code}" https://admin.lyniafinance.com/dashboard
# Expected: 200 (not 404)

# 6. Assets are compressed
curl -sI -H "Accept-Encoding: gzip" https://admin.lyniafinance.com \
  | grep -i "content-encoding"
# Expected: content-encoding: gzip (or br)

# 7. CloudFront distribution status
aws cloudfront get-distribution --id $ADMIN_CF --query "Distribution.Status"
# Expected: "Deployed"
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/frontend-hosting.yaml` | S3 + CloudFront CloudFormation template |
| `frontend/admin-portal/` | Admin portal Next.js source |
| `frontend/distributor-dashboard/` | Distributor dashboard Next.js source |
| `frontend/admin-portal/.env.local.example` | Admin env variable template |
| `frontend/distributor-dashboard/.env.local.example` | Distributor env variable template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
