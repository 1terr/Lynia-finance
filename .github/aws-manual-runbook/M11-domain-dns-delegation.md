# M11: Domain DNS Delegation

**Time**: ~15 minutes (plus up to 48 hours for DNS propagation)
**Depends on**: Domain registered, Route53 hosted zone exists (from DNS stack)
**What this does**: Points your domain registrar's nameservers to AWS Route53 so that AWS can manage DNS records for `lyniafinance.com` and all subdomains.

## Why This Is Needed

AWS needs to control DNS for:
- `api.lyniafinance.com` → API Gateway
- `admin.lyniafinance.com` → CloudFront (admin portal)
- `distributor.lyniafinance.com` → CloudFront (distributor dashboard)
- Certificate validation records (for HTTPS)

If DNS isn't delegated to Route53, none of the custom domain setups will work.

## What You Need

- Access to your domain registrar account (where `lyniafinance.com` was purchased)
- AWS Console access to Route53

## Step-by-Step

### 1. Get the Route53 nameservers

#### Option A: From CloudFormation output

If the DNS stack has been deployed:

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-finance-prod-dns \
  --query 'Stacks[0].Outputs[?OutputKey==`NameServers`].OutputValue' \
  --output text --region us-east-1
```

#### Option B: From Route53 directly

```bash
# List hosted zones
aws route53 list-hosted-zones \
  --query 'HostedZones[*].{Name:Name,Id:Id}' \
  --output table

# Get nameservers for your zone (replace with your zone ID)
aws route53 get-hosted-zone \
  --id /hostedzone/Z1234567890ABC \
  --query 'DelegationSet.NameServers' \
  --output text
```

You'll get 4 nameservers like:

```
ns-1234.awsdns-12.org
ns-567.awsdns-34.co.uk
ns-890.awsdns-56.net
ns-123.awsdns-78.com
```

**Write these down.** You'll enter them at your domain registrar.

### 2. Update nameservers at your domain registrar

The steps differ by registrar. Here are instructions for common ones:

#### GoDaddy
1. Log in to [GoDaddy](https://www.godaddy.com/)
2. Go to **My Products** → find `lyniafinance.com` → **DNS**
3. Scroll to **Nameservers** → click **Change**
4. Select **"I'll use my own nameservers"**
5. Enter all 4 Route53 nameservers
6. Click **Save**

#### Namecheap
1. Log in to [Namecheap](https://www.namecheap.com/)
2. Go to **Domain List** → click **Manage** on `lyniafinance.com`
3. Under **Nameservers**, select **Custom DNS**
4. Enter all 4 Route53 nameservers
5. Click the green checkmark to save

#### Cloudflare (if using Cloudflare as registrar)
1. Log in to [Cloudflare](https://dash.cloudflare.com/)
2. Select `lyniafinance.com`
3. Go to **DNS** → **Settings**
4. Note: If Cloudflare is your registrar AND you want to keep Cloudflare's proxy, see "Alternative: Using Cloudflare" below

#### Other Registrars
Look for "Nameservers", "DNS Settings", or "Name Server Management" in your registrar's control panel. Replace the existing nameservers with the 4 Route53 nameservers.

### 3. Wait for DNS propagation

DNS changes take **up to 48 hours** to propagate globally, but usually happen within 1-2 hours.

### 4. Verify DNS delegation

```bash
# Check if Route53 nameservers are responding
dig NS lyniafinance.com

# You should see the Route53 nameservers in the ANSWER section:
# lyniafinance.com.   3600   IN   NS   ns-1234.awsdns-12.org.
# lyniafinance.com.   3600   IN   NS   ns-567.awsdns-34.co.uk.
# ...
```

If you don't have `dig`, use an online tool:
- [Google DNS Lookup](https://dns.google/query?name=lyniafinance.com&type=NS)
- [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) — enter `lyniafinance.com` and select NS Lookup

### 5. Verify subdomains resolve (after DNS/SSL stack deploys)

```bash
# These should return CNAME or A records
dig api.lyniafinance.com
dig admin.lyniafinance.com
dig distributor.lyniafinance.com
```

## Alternative: Using Cloudflare as DNS Proxy

If you want to keep Cloudflare in front for DDoS protection (instead of delegating to Route53):

1. **Don't change nameservers** — keep them pointing to Cloudflare
2. In Cloudflare DNS, create these records manually:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `api` | API Gateway custom domain (from DNS stack) | DNS only (grey cloud) |
| CNAME | `admin` | CloudFront distribution domain | DNS only (grey cloud) |
| CNAME | `distributor` | CloudFront distribution domain | DNS only (grey cloud) |
| CNAME | ACM validation record | ACM validation value | DNS only (grey cloud) |

**Important**: Set proxy to "DNS only" (grey cloud) for CNAME records pointing to AWS services, because Cloudflare's proxy can interfere with AWS certificate validation.

3. You will need to manually create ACM validation records in Cloudflare (see M12).

## Troubleshooting

**"NS records haven't changed" after updating**
DNS propagation takes time. Wait 1-2 hours and try again. Use `dig +trace lyniafinance.com` to see if the change has reached the root nameservers.

**"SERVFAIL" or "NXDOMAIN"**
The Route53 hosted zone might not exist yet, or the domain was deleted. Check the Route53 console.

**Existing records disappeared**
When you delegate to Route53, records at the old DNS provider stop working. Make sure all DNS records are recreated in Route53 before switching nameservers.

## What Happens Next

- DNS delegation enables ACM certificate validation (M12)
- After certificate is validated, API Gateway and CloudFront custom domains will work
