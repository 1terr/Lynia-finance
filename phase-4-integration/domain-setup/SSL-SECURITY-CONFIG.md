# SSL/TLS & Security Configuration — lyniafinance.com

## TLS Architecture

```
Client (Browser/WhatsApp)
    │
    │  TLS 1.2/1.3 (Cloudflare Edge Certificate)
    │
    ▼
┌─────────────────┐
│   Cloudflare    │  ← Edge termination (for proxied records only)
│   Edge Network  │
└────────┬────────┘
         │
         │  TLS 1.2 (Origin connection)
         │
         ▼
┌─────────────────┐
│   AWS Origin    │  ← ACM certificate (for DNS-only records, client connects direct)
│   CloudFront /  │
│   API Gateway   │
└─────────────────┘
```

For **DNS-only** (grey cloud) records — which is our recommended setup for
CloudFront and API Gateway — clients connect directly to AWS, bypassing
Cloudflare's proxy. The TLS chain is:

```
Client → AWS (ACM certificate) → Origin
```

For **proxied** (orange cloud) records — used for root domain and www:

```
Client → Cloudflare (edge cert) → AWS (ACM certificate)
```

---

## Certificate Inventory

| Domain | Certificate Source | Region | Purpose |
|--------|--------------------|--------|---------|
| `lyniafinance.com` | Cloudflare Edge (auto) | Global | Root domain (proxied) |
| `*.lyniafinance.com` | AWS ACM | us-east-1 | CloudFront distributions |
| `api.lyniafinance.com` | AWS ACM | us-east-1 | API Gateway custom domain |
| `*.supabase.co` | Supabase (managed) | N/A | Database connections |

---

## Cloudflare SSL/TLS Configuration

### Encryption Mode: Full (Strict)

This is the most secure mode. Cloudflare verifies the origin server's SSL
certificate is valid and signed by a trusted CA (ACM certificates qualify).

```
Cloudflare Dashboard → SSL/TLS → Overview
Encryption Mode: Full (Strict) ✓
```

**Why not Flexible?** Flexible mode means Cloudflare → Origin is unencrypted
(HTTP). For a financial application handling PII and payment data, this is
unacceptable. Full (Strict) ensures end-to-end encryption.

### Edge Certificate Settings

```
Cloudflare Dashboard → SSL/TLS → Edge Certificates

Always Use HTTPS:              On
HTTP Strict Transport Security: On (see HSTS config below)
Minimum TLS Version:           TLS 1.2
Opportunistic Encryption:      On
TLS 1.3:                       On
Automatic HTTPS Rewrites:      On
Certificate Transparency:      On
```

### HSTS Policy

```
Cloudflare Dashboard → SSL/TLS → Edge Certificates → HSTS

Enable HSTS:           Yes
Max Age:               12 months (31536000)
Include Subdomains:    Yes
Preload:               Yes
No-Sniff Header:       Yes
```

> **Preload Warning**: Once HSTS preload is submitted and accepted by browsers,
> it takes months to remove. Only enable after verifying ALL subdomains work
> over HTTPS, including any future subdomains.

---

## AWS Security Configuration

### ACM Certificate Security

ACM certificates are:
- 2048-bit RSA or P-256 ECDSA
- Auto-renewed by AWS (no manual rotation)
- Free for use with AWS services

### CloudFront TLS Policy

The CloudFront distributions use `TLSv1.2_2021` which supports:
- TLS 1.2 with modern ciphers
- TLS 1.3
- Forward secrecy (ECDHE key exchange)
- No support for TLS 1.0/1.1 (deprecated)

### API Gateway TLS Policy

API Gateway custom domain uses `TLS_1_2` security policy:
- TLS 1.2 minimum
- Strong cipher suites only
- Forward secrecy

---

## Security Headers (Defense in Depth)

### CloudFront Response Headers Policy

The existing `SecurityHeadersPolicy` in `frontend-hosting.yaml` sets:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer leakage |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Content-Security-Policy` | See below | Control resource loading |

### Content Security Policy (CSP)

Updated CSP for `lyniafinance.com`:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://*.lyniafinance.com https://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

**Key points**:
- `connect-src` allows API calls to `*.lyniafinance.com` and Supabase
- `frame-ancestors 'none'` prevents embedding in iframes (anti-clickjacking)
- `base-uri 'self'` prevents base tag injection
- `form-action 'self'` prevents form submission to external domains

---

## Defense in Depth: Multi-Layer Security

```
Layer 1: Cloudflare Edge
├── DDoS protection (automatic, unlimited)
├── Bot detection (Bot Fight Mode)
├── Rate limiting (edge-level)
├── Firewall rules (geo-blocking, IP filtering)
├── SSL/TLS termination (for proxied records)
└── WAF (managed rulesets on Pro/Business plans)

Layer 2: AWS WAF (already configured)
├── Rate limiting (2000 req/5min per IP)
├── Auth endpoint rate limiting (100 req/5min)
├── SQL injection protection (AWS managed rules)
├── XSS protection (AWS managed rules)
├── Common attack protection (AWS managed rules)
├── Body size limits (16KB)
├── Geo-restriction (count non-Southern Africa)
└── Suspicious header blocking

Layer 3: Application Level
├── JWT validation on all protected endpoints
├── Input sanitization and validation
├── Parameterized queries (no SQL injection)
├── CORS origin whitelist
├── Request size limits
└── Rate limiting middleware per service

Layer 4: Database Level
├── Row Level Security (RLS) on all tables
├── Service role key server-side only
├── Encrypted connections (SSL required)
├── PgBouncer connection pooling
└── Audit logging for all operations
```

---

## CORS Configuration Update

All Lambda services must update their CORS allowed origins:

### Current CORS Origins
```typescript
const ALLOWED_ORIGINS = [
  'https://admin.lyniafinance.co.zw',
  'https://distributor.lyniafinance.co.zw',
  'http://localhost:3000',
  'http://localhost:3001',
];
```

### Updated CORS Origins
```typescript
const ALLOWED_ORIGINS = [
  'https://admin.lyniafinance.com',
  'https://distributor.lyniafinance.com',
  // Keep old domain during migration period
  'https://admin.lyniafinance.co.zw',
  'https://distributor.lyniafinance.co.zw',
  // Development
  'http://localhost:3000',
  'http://localhost:3001',
];
```

> Remove `*.co.zw` origins after migration is complete and traffic has fully
> shifted to `*.lyniafinance.com`.

---

## SSL Testing & Verification

### SSL Labs Test

After setup, test at: `https://www.ssllabs.com/ssltest/`

**Target**: A+ rating for all endpoints

Test these domains:
- `admin.lyniafinance.com`
- `distributor.lyniafinance.com`
- `api.lyniafinance.com`

### Manual Verification Commands

```bash
# Check TLS 1.2 support
openssl s_client -connect api.lyniafinance.com:443 -tls1_2 </dev/null 2>&1 | head -5

# Check TLS 1.3 support
openssl s_client -connect api.lyniafinance.com:443 -tls1_3 </dev/null 2>&1 | head -5

# Check certificate details
echo | openssl s_client -servername api.lyniafinance.com -connect api.lyniafinance.com:443 2>/dev/null | openssl x509 -noout -text | grep -E "Subject:|Issuer:|Not Before|Not After"

# Check HSTS header
curl -sI https://admin.lyniafinance.com | grep -i strict

# Check all security headers
curl -sI https://admin.lyniafinance.com | grep -iE "x-frame|x-content|strict-transport|referrer|content-security|x-xss"

# Verify TLS 1.0/1.1 is rejected
openssl s_client -connect api.lyniafinance.com:443 -tls1 </dev/null 2>&1 | grep "alert"
# Should show: "alert protocol version" or connection failure
```

---

## Certificate Renewal

### AWS ACM Certificates
- **Renewal**: Automatic (AWS renews 60 days before expiry)
- **Requirement**: DNS validation CNAME records must remain in Cloudflare
- **Monitoring**: Set up CloudWatch alarm for `DaysToExpiry < 30`

```bash
# Check certificate expiry
aws acm describe-certificate \
  --certificate-arn "<CERT_ARN>" \
  --query "Certificate.NotAfter"
```

### Cloudflare Edge Certificates
- **Renewal**: Automatic (Cloudflare manages edge certs)
- **No action required**: Cloudflare handles renewal

### Supabase Certificates
- **Renewal**: Automatic (Supabase manages)
- **No action required**: Supabase handles renewal

---

## Incident Response: SSL/TLS Issues

| Symptom | Likely Cause | Immediate Action |
|---------|-------------|------------------|
| Certificate expired | ACM validation CNAME removed | Re-add CNAME, wait for renewal |
| ERR_CERT_AUTHORITY_INVALID | Wrong SSL mode in Cloudflare | Set to Full (Strict) |
| Mixed content errors | HTTP resources on HTTPS page | Enable Automatic HTTPS Rewrites |
| CORS errors after domain change | Origins not updated | Update CORS allowed origins |
| 525 SSL Handshake Failed | Origin cert issue | Check ACM cert status |
| HSTS preventing HTTP access | Expected behavior | Do not disable — fix the HTTPS issue |
