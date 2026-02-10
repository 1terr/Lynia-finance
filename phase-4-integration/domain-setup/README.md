# Phase 4: Domain Setup — lyniafinance.com

Connect the Lynia Finance platform to `lyniafinance.com` via Cloudflare DNS,
with AWS ACM certificates, CloudFront CDN, and API Gateway custom domains.

## Quick Start

### Option 1: Automated Script (Recommended)

```bash
# 1. Set credentials
export CF_API_TOKEN="your-cloudflare-api-token"
export CF_ZONE_ID="your-zone-id"
# AWS CLI must be configured: aws configure

# 2. Run the full setup
bash scripts/setup-all.sh
```

The orchestrator handles everything: certificates, DNS, SSL, CloudFront, API Gateway.

### Option 2: Terraform (Infrastructure as Code)

```bash
cd terraform/
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply
```

### Option 3: GitHub Actions (CI/CD)

Trigger manually from GitHub Actions tab:

1. Go to Actions → "Deploy Domain Configuration"
2. Select action: `full-setup`
3. Select environment: `production`

**Required secrets** (set in GitHub repo settings):
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token
- `CLOUDFLARE_ZONE_ID` — Zone ID for lyniafinance.com
- `AWS_DEPLOY_ROLE_ARN` — IAM role for AWS deployment

### Option 4: Step by Step (Manual)

```bash
# Step 1: Request ACM certificates
bash scripts/aws-domain-setup.sh certificates

# Step 2: Add validation CNAMEs to Cloudflare + configure SSL/security
bash scripts/cloudflare-setup.sh all

# Step 3: Wait for certificates (check status)
bash scripts/aws-domain-setup.sh cert-status

# Step 4: Update CloudFront distributions
bash scripts/aws-domain-setup.sh cloudfront

# Step 5: Configure API Gateway
bash scripts/aws-domain-setup.sh apigateway

# Step 6: Verify
bash scripts/cloudflare-setup.sh verify
```

## File Structure

```
domain-setup/
├── README.md                    ← You are here
├── DOMAIN-CONNECTION-PLAN.md    ← Master plan (10 tasks, architecture, risks)
├── CLOUDFLARE-DNS-SETUP.md      ← Cloudflare configuration reference
├── AWS-DOMAIN-INTEGRATION.md    ← AWS ACM, CloudFront, API Gateway reference
├── SUPABASE-DOMAIN-SETUP.md     ← Supabase domain & auth config
├── SSL-SECURITY-CONFIG.md       ← TLS architecture, defense-in-depth
├── APP-CONFIG-UPDATES.md        ← Every config file to update
├── VERIFICATION-CHECKLIST.md    ← Post-setup testing checklist
├── scripts/
│   ├── setup-all.sh             ← Full orchestrator (runs everything)
│   ├── cloudflare-setup.sh      ← Cloudflare API automation
│   └── aws-domain-setup.sh      ← AWS CLI automation
└── terraform/
    ├── main.tf                  ← Cloudflare IaC (DNS, SSL, firewall, rules)
    ├── terraform.tfvars.example ← Variable template (copy → terraform.tfvars)
    └── .gitignore               ← Excludes secrets and state files
```

## Domain Architecture

```
lyniafinance.com (Cloudflare)
├── admin.lyniafinance.com       → CloudFront → S3 (Admin Portal)
├── distributor.lyniafinance.com → CloudFront → S3 (Distributor Dashboard)
├── api.lyniafinance.com         → API Gateway → Lambda (6 services)
├── www.lyniafinance.com         → 301 redirect → lyniafinance.com
└── lyniafinance.com             → Landing page (Cloudflare Pages or redirect)
```

All CloudFront and API Gateway subdomains use **DNS-only** mode (grey cloud)
to avoid double-CDN latency. AWS handles CDN, DDoS, and WAF natively.

## Prerequisites

| Requirement | Where to Get It |
|-------------|----------------|
| Cloudflare API Token | Dashboard → My Profile → API Tokens → Create Token |
| Cloudflare Zone ID | Dashboard → lyniafinance.com → Overview → right sidebar |
| AWS CLI credentials | `aws configure` with production access |
| jq | `apt install jq` or `brew install jq` |
| Terraform (optional) | `brew install terraform` or tfenv |

### Cloudflare API Token Permissions

Create a custom token with:
- **Zone → Zone → Read**
- **Zone → Zone Settings → Edit**
- **Zone → DNS → Edit**
- **Zone → Firewall Services → Edit**
- **Zone → Page Rules → Edit**

Scope to: `lyniafinance.com` zone only.
