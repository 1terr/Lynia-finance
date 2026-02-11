# AWS Domain Integration — lyniafinance.com

## Overview

This guide covers connecting AWS services (ACM, CloudFront, API Gateway) to
the `lyniafinance.com` domain managed on Cloudflare. Since DNS is on Cloudflare
(not Route 53), certificate validation and DNS records are handled externally.

---

## Part 1: ACM Certificate Provisioning

### 1.1 Request Wildcard Certificate (for CloudFront)

CloudFront requires certificates in **us-east-1** regardless of your other resources' region.

```bash
# Request wildcard certificate for all subdomains
aws acm request-certificate \
  --region us-east-1 \
  --domain-name "lyniafinance.com" \
  --subject-alternative-names "*.lyniafinance.com" \
  --validation-method DNS \
  --tags Key=Environment,Value=production Key=Purpose,Value=frontend \
  --output json
```

Save the returned `CertificateArn`:
```
arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/<CERT_ID>
```

### 1.2 Request API Certificate (for API Gateway)

API Gateway uses a **regional** certificate. If your API Gateway is in us-east-1,
the same region applies:

```bash
aws acm request-certificate \
  --region us-east-1 \
  --domain-name "api.lyniafinance.com" \
  --validation-method DNS \
  --tags Key=Environment,Value=production Key=Purpose,Value=api-gateway \
  --output json
```

### 1.3 Get DNS Validation Records

```bash
# For the wildcard certificate
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn "<WILDCARD_CERT_ARN>" \
  --query "Certificate.DomainValidationOptions" \
  --output table

# For the API certificate
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn "<API_CERT_ARN>" \
  --query "Certificate.DomainValidationOptions" \
  --output table
```

Output will show CNAME records like:
```
Name:   _abc123.lyniafinance.com
Value:  _def456.acm-validations.aws
```

### 1.4 Add Validation CNAMEs to Cloudflare

In Cloudflare Dashboard → DNS:

| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | `_abc123` | `_def456.acm-validations.aws` | DNS only (grey) |
| CNAME | `_ghi789.api` | `_jkl012.acm-validations.aws` | DNS only (grey) |

> **Critical**: Proxy must be OFF (grey cloud) for ACM validation to work.

### 1.5 Wait for Validation

```bash
# Monitor certificate status
aws acm wait certificate-validated \
  --region us-east-1 \
  --certificate-arn "<WILDCARD_CERT_ARN>"

# Check status
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn "<WILDCARD_CERT_ARN>" \
  --query "Certificate.Status"
```

Validation typically completes within 5-30 minutes. If it takes longer, verify:
- CNAME records are correct in Cloudflare
- Proxy is OFF (grey cloud) on validation CNAMEs
- No typos in CNAME name/value

---

## Part 2: CloudFront Distribution Updates

### 2.1 Get Current Distribution Config

```bash
# Admin portal distribution
aws cloudfront get-distribution-config \
  --id "<ADMIN_DISTRIBUTION_ID>" \
  --output json > admin-dist-config.json

# Distributor dashboard distribution
aws cloudfront get-distribution-config \
  --id "<DISTRIBUTOR_DISTRIBUTION_ID>" \
  --output json > distributor-dist-config.json
```

### 2.2 Update Admin Portal Distribution

Edit `admin-dist-config.json` and modify:

```json
{
  "DistributionConfig": {
    "Aliases": {
      "Quantity": 1,
      "Items": ["admin.lyniafinance.com"]
    },
    "ViewerCertificate": {
      "ACMCertificateArn": "arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/<CERT_ID>",
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021",
      "Certificate": "arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/<CERT_ID>",
      "CertificateSource": "acm"
    }
  }
}
```

Apply the update:
```bash
# Extract ETag from the GET response
ETAG=$(jq -r '.ETag' admin-dist-config.json)

# Extract just the DistributionConfig
jq '.DistributionConfig' admin-dist-config.json > admin-dist-update.json

# Update distribution
aws cloudfront update-distribution \
  --id "<ADMIN_DISTRIBUTION_ID>" \
  --if-match "$ETAG" \
  --distribution-config file://admin-dist-update.json
```

### 2.3 Update Distributor Dashboard Distribution

Repeat the same process for the distributor distribution with:
```json
{
  "Aliases": {
    "Quantity": 1,
    "Items": ["distributor.lyniafinance.com"]
  }
}
```

### 2.4 Update CloudFront Security Headers Policy

The existing `SecurityHeadersPolicy` in `frontend-hosting.yaml` needs CSP updated
to reference `lyniafinance.com` instead of `lyniafinance.com`:

```yaml
ContentSecurityPolicy:
  ContentSecurityPolicy: >-
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://*.lyniafinance.com https://*.supabase.co
  Override: true
```

### 2.5 Wait for Distribution Deployment

```bash
aws cloudfront wait distribution-deployed --id "<ADMIN_DISTRIBUTION_ID>"
aws cloudfront wait distribution-deployed --id "<DISTRIBUTOR_DISTRIBUTION_ID>"
```

This can take 15-30 minutes per distribution.

### 2.6 Add Cloudflare CNAME Records

After distributions are deployed, get their domain names:

```bash
aws cloudfront get-distribution \
  --id "<ADMIN_DISTRIBUTION_ID>" \
  --query "Distribution.DomainName" --output text
# Example: d1234abcdef8.cloudfront.net

aws cloudfront get-distribution \
  --id "<DISTRIBUTOR_DISTRIBUTION_ID>" \
  --query "Distribution.DomainName" --output text
# Example: d5678ghijkl9.cloudfront.net
```

Add to Cloudflare DNS:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `admin` | `d1234abcdef8.cloudfront.net` | DNS only (grey) |
| CNAME | `distributor` | `d5678ghijkl9.cloudfront.net` | DNS only (grey) |

---

## Part 3: API Gateway Custom Domain

### 3.1 Create Custom Domain Name

```bash
aws apigateway create-domain-name \
  --domain-name "api.lyniafinance.com" \
  --regional-certificate-arn "<API_CERT_ARN>" \
  --endpoint-configuration types=REGIONAL \
  --security-policy TLS_1_2 \
  --tags Environment=production
```

Save the `regionalDomainName` from the response:
```
d-abc123.execute-api.us-east-1.amazonaws.com
```

### 3.2 Create Base Path Mapping

```bash
# Get your REST API ID
aws apigateway get-rest-apis --query "items[?name=='lynia-finance-prod'].id" --output text

# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name "api.lyniafinance.com" \
  --rest-api-id "<REST_API_ID>" \
  --stage "Prod"
```

### 3.3 Add Cloudflare CNAME

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `d-abc123.execute-api.us-east-1.amazonaws.com` | DNS only (grey) |

### 3.4 Verify API Access

```bash
# Test health endpoint
curl -v https://api.lyniafinance.com/health

# Test a specific service endpoint
curl -v https://api.lyniafinance.com/scoring/health

# Verify TLS
echo | openssl s_client -servername api.lyniafinance.com -connect api.lyniafinance.com:443 2>/dev/null | openssl x509 -noout -subject -dates
```

---

## Part 4: Update CloudFormation Templates

### 4.1 dns-ssl.yaml Changes

The existing template uses Route 53 for DNS. Since we are using Cloudflare,
the Route 53 hosted zone and DNS record resources become optional. The template
should be updated to:

1. Change default domain from `lyniafinance.com` to `lyniafinance.com`
2. Make Route 53 resources conditional (skip when using external DNS)
3. Keep ACM certificate resources (they work with any DNS provider)

Key parameter change:
```yaml
DomainName:
  Type: String
  Default: lyniafinance.com
  Description: Root domain name
```

### 4.2 frontend-hosting.yaml Changes

Update CSP and domain references:
```yaml
DomainName:
  Type: String
  Default: lyniafinance.com
```

### 4.3 production-master.yaml Changes

```yaml
DomainName:
  Type: String
  Default: lyniafinance.com
```

---

## Part 5: CloudFormation vs Manual Setup

### Recommended Approach: Hybrid

Since Cloudflare manages DNS (not Route 53), the existing CloudFormation templates
need adjustments:

| Resource | CloudFormation | Manual (Cloudflare) |
|----------|---------------|---------------------|
| ACM Certificates | Yes — keep in template | Add validation CNAMEs manually |
| API Gateway Custom Domain | Yes — keep in template | Add CNAME manually |
| CloudFront Aliases | Yes — keep in template | Add CNAME manually |
| Route 53 Hosted Zone | Skip (condition=false) | N/A — using Cloudflare |
| Route 53 DNS Records | Skip (condition=false) | Add in Cloudflare instead |
| CloudFront Security Headers | Yes — keep in template | N/A |

To skip Route 53 resources, deploy with:
```bash
sam deploy --config-env production \
  --parameter-overrides \
    "DomainName=lyniafinance.com" \
    "HostedZoneId=" \
    "Environment=production"
```

Leaving `HostedZoneId` empty triggers the `CreateHostedZone` condition, but you
can also add a `UseExternalDNS` condition to skip all Route 53 resources entirely.

---

## Rollback Plan

If anything goes wrong during the domain cutover:

1. **Remove CloudFront Aliases** — distributions revert to `*.cloudfront.net`
2. **Delete Cloudflare CNAME records** — subdomains stop resolving
3. **Keep ACM certificates** — they don't affect anything if unused
4. **Revert API Gateway custom domain** — delete it, API reverts to default URL
5. **Revert application config** — change domain references back

All AWS changes are reversible without data loss.
