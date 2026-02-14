# M14: Deploy CloudFront Distributions and WAF

**Time**: ~20 minutes (plus 15-30 minutes for CloudFront deployment)
**Depends on**: M11 (DNS), M12 (ACM certificates validated), S3 buckets exist (frontend-hosting stack)
**What this does**: Sets up CloudFront CDN distributions for the admin portal and distributor dashboard, and associates AWS WAF rules for security.

## Why This Is Needed

CloudFront provides:
- **Fast global delivery** — serves frontend assets from edge locations near users
- **HTTPS** — uses the ACM certificate from M12
- **DDoS protection** — built-in protection against common attacks
- **WAF integration** — blocks SQL injection, XSS, and rate-limits abusive traffic

Without CloudFront, the frontend apps are served directly from S3, which doesn't support HTTPS with custom domains and has no security layer.

## What You Need

- ACM certificate ARN from M12 (must be in `us-east-1`)
- S3 bucket names for admin portal and distributor dashboard
- Route53 hosted zone ID (from DNS stack)

## Step-by-Step

### 1. Set your environment

```bash
export ENV=production
export REGION=us-east-1
export DOMAIN=lyniafinance.com
```

### 2. Deploy the frontend-hosting stack

The `frontend-hosting.yaml` CloudFormation template creates CloudFront distributions. If it wasn't deployed as part of `production-master.yaml`:

```bash
# Get the ACM certificate ARN
export CERT_ARN=$(aws acm list-certificates \
  --query "CertificateSummaryList[?DomainName=='*.${DOMAIN}'].CertificateArn" \
  --output text --region us-east-1)

echo "Certificate ARN: ${CERT_ARN}"

# Get the hosted zone ID
export HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id" \
  --output text | sed 's|/hostedzone/||')

echo "Hosted Zone ID: ${HOSTED_ZONE_ID}"

# Deploy the frontend hosting stack
aws cloudformation deploy \
  --template-file infrastructure/aws/frontend-hosting.yaml \
  --stack-name lynia-finance-${ENV}-frontend \
  --parameter-overrides \
    Environment=${ENV} \
    DomainName=${DOMAIN} \
    FrontendCertificateArn=${CERT_ARN} \
    HostedZoneId=${HOSTED_ZONE_ID} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}
```

This will take **15-30 minutes** as CloudFront distributions are deployed globally.

### 3. Deploy WAF Web ACL

The WAF rules protect against common web attacks:

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/waf-rules.yaml \
  --stack-name lynia-finance-${ENV}-waf \
  --parameter-overrides \
    Environment=${ENV} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}
```

**Note**: WAF for CloudFront must be deployed in `us-east-1`.

### 4. Get the CloudFront distribution IDs

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-finance-${ENV}-frontend \
  --query 'Stacks[0].Outputs' \
  --output table \
  --region ${REGION}
```

Note down:
- `AdminPortalDistributionId`
- `AdminPortalUrl`
- `DistributorDashboardDistributionId`
- `DistributorDashboardUrl`

### 5. Associate WAF with CloudFront distributions

If the CloudFormation template doesn't automatically associate WAF, do it manually:

```bash
# Get the WAF Web ACL ARN
export WAF_ACL_ARN=$(aws cloudformation describe-stacks \
  --stack-name lynia-finance-${ENV}-waf \
  --query "Stacks[0].Outputs[?OutputKey=='WebAclArn'].OutputValue" \
  --output text --region us-east-1)

echo "WAF ACL ARN: ${WAF_ACL_ARN}"

# Get CloudFront distribution ARNs
export ADMIN_DIST_ID="REPLACE_WITH_ADMIN_DISTRIBUTION_ID"
export DIST_DIST_ID="REPLACE_WITH_DISTRIBUTOR_DISTRIBUTION_ID"

# Associate WAF with admin portal CloudFront
aws wafv2 associate-web-acl \
  --web-acl-arn ${WAF_ACL_ARN} \
  --resource-arn "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/${ADMIN_DIST_ID}" \
  --region us-east-1

# Associate WAF with distributor dashboard CloudFront
aws wafv2 associate-web-acl \
  --web-acl-arn ${WAF_ACL_ARN} \
  --resource-arn "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/${DIST_DIST_ID}" \
  --region us-east-1
```

### 6. Verify CloudFront distributions

```bash
# Check admin portal distribution status
aws cloudfront get-distribution \
  --id ${ADMIN_DIST_ID} \
  --query 'Distribution.{Status:Status,DomainName:DomainName,Aliases:DistributionConfig.Aliases.Items}' \
  --output json

# Check distributor dashboard distribution status
aws cloudfront get-distribution \
  --id ${DIST_DIST_ID} \
  --query 'Distribution.{Status:Status,DomainName:DomainName,Aliases:DistributionConfig.Aliases.Items}'  \
  --output json
```

**Expected**: Status should be `Deployed` (may show `InProgress` for up to 30 minutes).

### 7. Verify WAF association

```bash
aws wafv2 get-web-acl-for-resource \
  --resource-arn "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/${ADMIN_DIST_ID}" \
  --region us-east-1 \
  --query 'WebACL.Name' \
  --output text
```

**Expected**: The name of your WAF Web ACL (e.g., `lynia-finance-production-waf`).

### 8. Test the custom domains

```bash
# Test admin portal
curl -sI https://admin.lyniafinance.com | head -5

# Expected response:
# HTTP/2 200
# content-type: text/html
# ...

# Test distributor dashboard
curl -sI https://distributor.lyniafinance.com | head -5
```

### 9. Upload frontend assets (first deployment)

If no frontend build has been deployed yet:

```bash
# Build the admin portal
cd frontend/admin-portal
pnpm install && pnpm build

# Upload to S3
aws s3 sync out/ s3://lynia-finance-${ENV}-admin-portal/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --region ${REGION}

# Fix cache headers for HTML files (should not be cached)
aws s3 cp s3://lynia-finance-${ENV}-admin-portal/ \
  s3://lynia-finance-${ENV}-admin-portal/ \
  --recursive \
  --exclude "*" \
  --include "*.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html" \
  --metadata-directive REPLACE \
  --region ${REGION}

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id ${ADMIN_DIST_ID} \
  --paths "/*"
```

Repeat for the distributor dashboard with its bucket and distribution ID.

## WAF Rules Overview

The WAF Web ACL includes these protections:

| Rule | What it does |
|------|-------------|
| Rate limiting | Blocks IPs making > 2000 requests/5 minutes |
| SQL injection | Detects and blocks SQL injection in query params, body, headers |
| XSS protection | Blocks cross-site scripting attempts |
| Bad inputs | Blocks requests with known malicious patterns |
| Geo restriction | (Optional) Restricts access to specific countries |

## Troubleshooting

**"Distribution is not deployed yet"**
CloudFront deployments take 15-30 minutes. Check the status:
```bash
aws cloudfront get-distribution --id ${ADMIN_DIST_ID} --query 'Distribution.Status'
```

**"CNAMEAlreadyExists" error**
Another CloudFront distribution already uses this domain alias. Delete or update the existing distribution first.

**403 Forbidden on custom domain**
- The S3 bucket might be empty (no files uploaded)
- The CloudFront Origin Access Identity might not have permission to read the S3 bucket
- The default root object might not be set (should be `index.html`)

**WAF blocking legitimate requests**
Check WAF sampled requests in the AWS Console:
1. Go to AWS WAF → Web ACLs → your ACL
2. Click "Sampled requests" to see what's being blocked
3. Adjust rules if needed

**SSL certificate error**
- The certificate might not be validated yet (M12)
- The certificate might not cover the subdomain you're using
- The certificate must be in `us-east-1` for CloudFront

## What Happens Next

Congratulations! With CloudFront and WAF deployed, the infrastructure is complete.

**Final checklist:**
- [ ] `admin.lyniafinance.com` loads the admin portal
- [ ] `distributor.lyniafinance.com` loads the distributor dashboard
- [ ] `api.lyniafinance.com` routes to API Gateway
- [ ] WAF is active on all distributions
- [ ] SSL certificates are valid (green padlock in browser)

**Post-deployment:**
- Set up CloudWatch alarms for CloudFront errors (4xx, 5xx rates)
- Configure CloudFront access logs for audit purposes
- Schedule regular WAF rule reviews
