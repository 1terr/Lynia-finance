# Cloudflare DNS Setup — lyniafinance.com

## Prerequisites

- Cloudflare account with `lyniafinance.com` zone active
- Cloudflare plan: **Pro** recommended (advanced SSL, WAF rules, analytics)
- Access to AWS Console (ACM, CloudFront, API Gateway)
- AWS CLI configured with production credentials

---

## Step 1: Verify Zone Status

1. Log in to Cloudflare Dashboard → Select `lyniafinance.com`
2. Confirm zone status shows **Active**
3. Confirm nameservers are set at your domain registrar to Cloudflare's assigned NS

```
Expected nameservers (example — use your actual assigned values):
  ns1.cloudflare.com
  ns2.cloudflare.com
```

Verify via terminal:
```bash
dig lyniafinance.com NS +short
```

---

## Step 2: Configure SSL/TLS Settings

Navigate to **SSL/TLS** → **Overview**:

| Setting | Value | Reason |
|---------|-------|--------|
| Encryption mode | **Full (Strict)** | AWS provides valid ACM certificates on origin |
| SSL/TLS Recommender | **On** | Auto-suggest security improvements |

Navigate to **SSL/TLS** → **Edge Certificates**:

| Setting | Value | Reason |
|---------|-------|--------|
| Always Use HTTPS | **On** | Redirect all HTTP → HTTPS |
| HTTP Strict Transport Security (HSTS) | **Enabled** | See HSTS config below |
| Minimum TLS Version | **1.2** | RBZ compliance, security best practice |
| Opportunistic Encryption | **On** | Performance improvement |
| TLS 1.3 | **On** | Latest TLS for capable clients |
| Automatic HTTPS Rewrites | **On** | Fix mixed content issues |
| Certificate Transparency Monitoring | **On** | Alert on unauthorized certs |

### HSTS Configuration

```
Status: On
Max-Age: 12 months (31536000 seconds)
Include subdomains: Yes
Preload: Yes
No-Sniff: Yes
```

> **Warning**: Once HSTS preload is enabled and submitted, it cannot be easily
> undone. Only enable after confirming all subdomains serve over HTTPS.

---

## Step 3: DNS Records

### Production DNS Records

Add the following DNS records in Cloudflare:

#### A. Admin Portal (CloudFront)

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | `admin` | `<admin-cloudfront-distribution>.cloudfront.net` | DNS only (grey) | Auto |

> **Why DNS only?** CloudFront is already a CDN. Proxying through Cloudflare
> would create a double-CDN (Cloudflare → CloudFront → S3), adding latency
> and causing SSL negotiation issues. CloudFront handles caching and DDoS
> protection natively.

#### B. Distributor Dashboard (CloudFront)

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | `distributor` | `<distributor-cloudfront-distribution>.cloudfront.net` | DNS only (grey) | Auto |

#### C. API Gateway

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | `api` | `<api-gateway-custom-domain>.execute-api.us-east-1.amazonaws.com` | DNS only (grey) | Auto |

> **Why DNS only for API?** AWS WAF is already configured for rate limiting,
> SQL injection prevention, and XSS protection. AWS API Gateway handles TLS
> termination. Cloudflare proxy would conflict with WAF and may strip headers.

#### D. ACM Certificate Validation

When you request ACM certificates (see [AWS-DOMAIN-INTEGRATION.md](./AWS-DOMAIN-INTEGRATION.md)),
AWS provides CNAME records for DNS validation. Add them here:

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | `_<hash>.lyniafinance.com` | `_<hash>.acm-validations.aws` | DNS only (grey) | Auto |
| CNAME | `_<hash>.api.lyniafinance.com` | `_<hash>.acm-validations.aws` | DNS only (grey) | Auto |

> **Critical**: ACM validation CNAMEs must be **DNS only** (grey cloud).
> Cloudflare proxy will interfere with AWS certificate validation.

#### E. Root Domain

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| A | `@` | `192.0.2.1` (or Cloudflare Pages) | Proxied (orange) | Auto |
| CNAME | `www` | `lyniafinance.com` | Proxied (orange) | Auto |

> Root domain and www can be proxied since they serve a landing page or redirect,
> not an AWS backend service.

#### F. Email (if applicable)

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| MX | `@` | (your mail provider) | N/A | Auto |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | N/A | Auto |

---

## Step 4: Page Rules

Navigate to **Rules** → **Page Rules** (or use Transform Rules on newer plans):

### Rule 1: Force HTTPS
```
URL: http://*lyniafinance.com/*
Setting: Always Use HTTPS
```

### Rule 2: Redirect www to root
```
URL: www.lyniafinance.com/*
Setting: Forwarding URL (301)
Destination: https://lyniafinance.com/$1
```

### Rule 3: Cache static assets
```
URL: admin.lyniafinance.com/_next/static/*
Setting: Cache Level → Cache Everything
Edge Cache TTL: 1 month
```

### Rule 4: API no-cache
```
URL: api.lyniafinance.com/*
Setting: Cache Level → Bypass
```

---

## Step 5: Security Settings

Navigate to **Security** → **Settings**:

| Setting | Value | Reason |
|---------|-------|--------|
| Security Level | **Medium** | Balance between security and user experience |
| Bot Fight Mode | **On** | Block known bad bots |
| Browser Integrity Check | **On** | Block requests with suspicious headers |
| Challenge Passage | **30 minutes** | Time before re-challenging |

### Firewall Rules (Security → WAF → Custom Rules)

#### Rule 1: Allow WhatsApp Webhook IPs
```
Expression: (ip.src in {
  31.13.24.0/21
  31.13.64.0/18
  45.64.40.0/22
  66.220.144.0/20
  69.63.176.0/20
  69.171.224.0/19
  74.119.76.0/22
  102.132.96.0/20
  103.4.96.0/22
  129.134.0.0/16
  147.75.208.0/20
  157.240.0.0/16
  173.252.64.0/18
  179.60.192.0/22
  185.60.216.0/22
  204.15.20.0/22
}) and (http.request.uri.path contains "/whatsapp/webhook")
Action: Allow
```

#### Rule 2: Challenge Non-African Traffic on Sensitive Endpoints
```
Expression: (not ip.geoip.country in {"ZW" "ZA" "BW" "MZ" "MW"})
  and (http.request.uri.path contains "/kyc" or http.request.uri.path contains "/loans/apply")
Action: Managed Challenge
```

#### Rule 3: Block Requests Without User-Agent
```
Expression: (len(http.user_agent) eq 0)
Action: Block
```

---

## Step 6: Cloudflare Rate Limiting

Navigate to **Security** → **WAF** → **Rate limiting rules**:

### Rule 1: API Authentication Rate Limit
```
Expression: (http.request.uri.path contains "/auth")
Threshold: 20 requests per minute
Action: Block for 10 minutes
```

### Rule 2: General API Rate Limit
```
Expression: (http.host eq "api.lyniafinance.com")
Threshold: 100 requests per minute per IP
Action: Block for 5 minutes
```

### Rule 3: Webhook Endpoints (Higher Limit)
```
Expression: (http.request.uri.path contains "/webhook")
Threshold: 500 requests per minute
Action: Block for 1 minute
```

> **Note**: These Cloudflare rate limits complement (not replace) the AWS WAF
> rate limits already configured. Cloudflare catches abuse at the edge before
> traffic reaches AWS, reducing costs.

---

## Step 7: Cloudflare Health Checks

Navigate to **Traffic** → **Health Checks** (Pro plan):

### Check 1: API Health
```
Name: api-health
Address: api.lyniafinance.com
Type: HTTPS
Path: /health
Expected Status: 200
Check Interval: 60 seconds
Retries: 2
Timeout: 10 seconds
Notification: Email + Webhook
```

### Check 2: Admin Portal
```
Name: admin-portal-health
Address: admin.lyniafinance.com
Type: HTTPS
Path: /
Expected Status: 200
Check Interval: 60 seconds
```

### Check 3: Distributor Dashboard
```
Name: distributor-health
Address: distributor.lyniafinance.com
Type: HTTPS
Path: /
Expected Status: 200
Check Interval: 60 seconds
```

---

## Step 8: Cloudflare Analytics & Notifications

### Notifications (Account → Notifications)

| Notification | Type | Destination |
|--------------|------|-------------|
| SSL Certificate Expiring | Email | ops@lynia.co.zw |
| Health Check Failure | Email + Webhook | ops@lynia.co.zw |
| DDoS Alert | Email | security@lynia.co.zw |
| Origin Error Rate Spike | Email | dev@lynia.co.zw |
| WAF Rule Triggered | Email | security@lynia.co.zw |

---

## Verification

After completing all steps, verify:

```bash
# DNS resolution
dig admin.lyniafinance.com CNAME +short
dig distributor.lyniafinance.com CNAME +short
dig api.lyniafinance.com CNAME +short

# HTTPS connectivity
curl -I https://admin.lyniafinance.com
curl -I https://distributor.lyniafinance.com
curl -I https://api.lyniafinance.com/health

# TLS version check
openssl s_client -connect api.lyniafinance.com:443 -tls1_2 < /dev/null 2>&1 | grep "Protocol"

# HSTS header check
curl -sI https://lyniafinance.com | grep -i strict-transport

# Security headers
curl -sI https://admin.lyniafinance.com | grep -iE "x-frame|x-content-type|content-security"
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|---------|
| ACM certificate stuck in "Pending" | CNAME not added or proxied | Ensure validation CNAMEs are DNS-only (grey cloud) |
| ERR_SSL_VERSION_OR_CIPHER_MISMATCH | SSL mode mismatch | Set Cloudflare to Full (Strict), not Flexible |
| 521 Origin Down | Cloudflare can't reach origin | Use DNS-only for CloudFront/API subdomains |
| 525 SSL Handshake Failed | Origin cert not trusted | Use Full (Strict) with valid ACM certs |
| CloudFront 403 Forbidden | CNAME not in distribution alternate domains | Add domain to CloudFront Aliases list |
| API Gateway 403 | Custom domain not mapped | Verify base path mapping exists |
| Mixed content warnings | HTTP resources on HTTPS page | Enable Automatic HTTPS Rewrites |
