# M12: ACM Certificate Validation

**Time**: ~10 minutes (plus up to 30 minutes for validation)
**Depends on**: M11 (DNS must be delegated to Route53 or CNAME records must be creatable)
**What this does**: Validates the SSL/TLS certificates for `*.lyniafinance.com` so that HTTPS works for the API and frontends.

## Why This Is Needed

AWS Certificate Manager (ACM) issues free SSL certificates, but it needs to verify that you own the domain. It does this by checking for specific DNS records. Until the certificate is validated, you cannot:
- Use `https://api.lyniafinance.com`
- Use `https://admin.lyniafinance.com`
- Use `https://distributor.lyniafinance.com`

## What You Need

- DNS delegated to Route53 (M11) OR access to create CNAME records at your DNS provider
- AWS Console access

## Step-by-Step

### 1. Check certificate status

```bash
# List certificates
aws acm list-certificates \
  --query 'CertificateSummaryList[*].{Domain:DomainName,Status:Status,ARN:CertificateArn}' \
  --output table \
  --region us-east-1
```

Look for certificates covering `lyniafinance.com` or `*.lyniafinance.com`.

### 2. If certificates were auto-created by the DNS stack

The `dns-ssl.yaml` CloudFormation template creates certificates automatically. Check if they're pending validation:

```bash
# Get the certificate ARN (replace with your cert ARN from step 1)
export CERT_ARN="arn:aws:acm:us-east-1:123456789012:certificate/abc-123-def"

aws acm describe-certificate \
  --certificate-arn ${CERT_ARN} \
  --query 'Certificate.DomainValidationOptions[*].{Domain:DomainName,Status:ValidationStatus,CNAME_Name:ResourceRecord.Name,CNAME_Value:ResourceRecord.Value}' \
  --output table \
  --region us-east-1
```

### 3. If DNS is on Route53 — Auto-validation

If you delegated DNS to Route53 (M11) and the DNS stack included `AWS::CertificateManager::Certificate` with `ValidationMethod: DNS`, CloudFormation may have already created the validation records automatically.

Check if validation is in progress:

```bash
aws acm describe-certificate \
  --certificate-arn ${CERT_ARN} \
  --query 'Certificate.Status' \
  --output text \
  --region us-east-1
```

- `PENDING_VALIDATION` → Records exist but AWS hasn't verified yet. Wait 5-30 minutes.
- `ISSUED` → Certificate is ready! Skip to "Verify" below.
- `FAILED` → Something went wrong. See Troubleshooting.

### 4. If DNS is NOT on Route53 — Manual validation

If you're using Cloudflare or another DNS provider, you need to create the CNAME records manually.

**Get the validation records:**

```bash
aws acm describe-certificate \
  --certificate-arn ${CERT_ARN} \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord.{Name:Name,Value:Value}' \
  --output table \
  --region us-east-1
```

Output example:

```
| Name                                          | Value                                         |
|-----------------------------------------------|-----------------------------------------------|
| _abc123.lyniafinance.com.                     | _def456.acm-validations.aws.                  |
| _ghi789.admin.lyniafinance.com.               | _jkl012.acm-validations.aws.                  |
```

**Create these CNAME records at your DNS provider:**

For each row:
1. Go to your DNS provider (Cloudflare, GoDaddy, etc.)
2. Create a new **CNAME** record:
   - **Name**: The value from the "Name" column (remove the trailing `.` and the base domain)
     - e.g., `_abc123` (for the root domain)
     - e.g., `_ghi789.admin` (for a subdomain)
   - **Target/Value**: The value from the "Value" column
     - e.g., `_def456.acm-validations.aws.`
3. If using Cloudflare, set proxy to **DNS only** (grey cloud)

### 5. Wait for validation

ACM checks for the DNS records periodically. Validation usually completes within:
- **5-10 minutes** if DNS is on Route53
- **10-30 minutes** if DNS is on an external provider
- **Up to 72 hours** in rare cases

Monitor the status:

```bash
# Check every few minutes
watch -n 60 "aws acm describe-certificate \
  --certificate-arn ${CERT_ARN} \
  --query 'Certificate.Status' \
  --output text \
  --region us-east-1"
```

Press `Ctrl+C` to stop watching.

### 6. Verify the certificate is issued

```bash
aws acm describe-certificate \
  --certificate-arn ${CERT_ARN} \
  --query 'Certificate.{Status:Status,Domains:SubjectAlternativeNames}' \
  --output json \
  --region us-east-1
```

**Expected output:**
```json
{
  "Status": "ISSUED",
  "Domains": [
    "lyniafinance.com",
    "*.lyniafinance.com"
  ]
}
```

### 7. Note: CloudFront requires us-east-1 certificates

If you're using CloudFront (for frontend hosting), the certificate **must** be in `us-east-1`, regardless of where your other resources are. If your certificate is in a different region, request a new one in `us-east-1`.

## Troubleshooting

**Status stuck at "PENDING_VALIDATION"**
- DNS records may not exist or have propagated yet
- Verify CNAME records exist: `dig _abc123.lyniafinance.com CNAME`
- If using Cloudflare, make sure proxy is OFF (grey cloud) for validation records

**Status is "FAILED"**
- The validation timed out (72 hours). Delete the certificate and request a new one
- Check that the domain isn't using DNSSEC with misconfigured records

**"Certificate not found" when assigning to CloudFront/API Gateway**
- The certificate must be in `us-east-1` for CloudFront
- The certificate must be in the same region as API Gateway

**"InvalidParameterValue: The certificate must have a fully qualified domain name"**
- Make sure the certificate covers the exact domains you're using (e.g., `*.lyniafinance.com` covers `admin.lyniafinance.com`)

## What Happens Next

- With validated certificates, you can now set up:
  - API Gateway custom domain (`api.lyniafinance.com`)
  - CloudFront with HTTPS (`admin.lyniafinance.com`, `distributor.lyniafinance.com`)
- Proceed to **M14** (Deploy CloudFront + WAF)
