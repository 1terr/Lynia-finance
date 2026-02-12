# P5-DEPLOY-T013: Deploy DNS, SSL & Custom Domains - Progress Report

**Task:** P5-DEPLOY-T013 - Deploy DNS, SSL & Custom Domains
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.3 Services & Networking
**Priority:** Critical
**Estimated Hours:** 3
**Dependencies:** P5-DEPLOY-T010 (needs API Gateway REST API ID)
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy Route 53 hosted zone (or use an existing one), ACM certificates for API (regional, us-east-1) and frontend (must be us-east-1 for CloudFront), API Gateway custom domain mapping, and health checks. Certificate DNS validation typically takes 10-30 minutes, but new hosted zones with registrar NS record updates can take up to 48 hours.

## Deliverables

- [ ] ACM certificates issued for API and frontend domains
- [ ] API Gateway custom domain mapped (e.g., `api.lyniafinance.com`)
- [ ] Route 53 DNS records configured
- [ ] Health check on API endpoint
- [ ] Stack outputs recorded (FrontendCertificateArn, HostedZoneId)

## Acceptance Criteria

- [ ] ACM certificates status: `ISSUED`
- [ ] API Gateway custom domain accessible via HTTPS
- [ ] TLS 1.2 enforced on custom domain
- [ ] DNS resolution working for `api.{domain}`
- [ ] Frontend certificate available for T014 (CloudFront)

---

## DNS Architecture

```
lyniafinance.com (Hosted Zone)
├── api.lyniafinance.com ──→ API Gateway Custom Domain
├── admin.lyniafinance.com ──→ CloudFront (Admin Portal) [T014]
└── distributor.lyniafinance.com ──→ CloudFront (Distributor Dashboard) [T014]

ACM Certificates:
├── Regional (us-east-1): api.lyniafinance.com
└── Global (us-east-1): *.lyniafinance.com (for CloudFront)
```

---

## Steps

### Step 1: Deploy DNS & SSL Stack

```bash
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='production-lynia-api'].id" --output text)

# If using an EXISTING hosted zone, provide the HostedZoneId
# If creating a NEW hosted zone, leave HostedZoneId empty
aws cloudformation deploy \
  --template-file infrastructure/aws/dns-ssl.yaml \
  --stack-name production-lynia-dns \
  --parameter-overrides \
    Environment=production \
    DomainName=lyniafinance.com \
    HostedZoneId="" \
    ApiGatewayRestApiId=$API_ID \
    ApiGatewayStageName=Prod \
  --region us-east-1
```

### Step 2: Wait for Certificate Validation

```bash
# Monitor certificate validation (DNS validation, 10-30 minutes)
echo "Waiting for certificate validation..."
aws acm list-certificates \
  --query "CertificateSummaryList[?contains(DomainName,'lyniafinance')].{Domain:DomainName,Status:Status}" \
  --output table

# Check every 2 minutes until ISSUED
watch -n 120 "aws acm list-certificates \
  --query \"CertificateSummaryList[?contains(DomainName,'lyniafinance')].{Domain:DomainName,Status:Status}\" \
  --output table"
```

### Step 3: (If New Hosted Zone) Update Domain Registrar

```bash
# Get the NS records to configure at your domain registrar
HOSTED_ZONE_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-dns \
  --query "Stacks[0].Outputs[?OutputKey=='HostedZoneIdOutput'].OutputValue" --output text)
aws route53 get-hosted-zone --id $HOSTED_ZONE_ID \
  --query "DelegationSet.NameServers"
# Copy these NS records to your domain registrar (e.g., GoDaddy, Namecheap)
# WARNING: This can take up to 48 hours to propagate
```

### Step 4: Record Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name production-lynia-dns \
  --query "Stacks[0].Outputs" \
  --output table
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-dns \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. Certificates are ISSUED
aws acm list-certificates --certificate-statuses ISSUED \
  --query "CertificateSummaryList[?contains(DomainName,'lyniafinance')]"
# Expected: 2 certificates (API regional + frontend wildcard)

# 3. API Gateway custom domain
aws apigateway get-domain-name --domain-name api.lyniafinance.com \
  --query "{DomainName:domainName,SecurityPolicy:securityPolicy}"
# Expected: domainName=api.lyniafinance.com, SecurityPolicy=TLS_1_2

# 4. DNS resolution
dig api.lyniafinance.com +short
# Expected: CNAME pointing to API Gateway distribution

# 5. HTTPS connectivity
curl -sI https://api.lyniafinance.com/health | head -5
# Expected: HTTP/2 200 (or 401/403 if auth required)

# 6. TLS verification
echo | openssl s_client -connect api.lyniafinance.com:443 2>/dev/null | grep "Protocol\|Cipher"
# Expected: Protocol: TLSv1.2 or TLSv1.3
```

---

## Timing Notes

- **ACM DNS validation**: 10-30 minutes (automatic via Route 53)
- **New hosted zone NS propagation**: Up to 48 hours (registrar-dependent)
- **API Gateway custom domain**: Available immediately after certificate validation
- **Recommendation**: Start T013 early in the deployment process to avoid blocking T014

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/dns-ssl.yaml` | DNS + SSL CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
