# Domain Setup Verification Checklist — lyniafinance.com

Use this checklist to verify that all domain connections are working correctly
after completing the setup.

---

## DNS Resolution

```bash
# All should resolve to expected targets
dig admin.lyniafinance.com CNAME +short
dig distributor.lyniafinance.com CNAME +short
dig api.lyniafinance.com CNAME +short
dig lyniafinance.com A +short
dig www.lyniafinance.com CNAME +short
```

- [ ] `admin.lyniafinance.com` resolves to CloudFront distribution domain
- [ ] `distributor.lyniafinance.com` resolves to CloudFront distribution domain
- [ ] `api.lyniafinance.com` resolves to API Gateway regional domain
- [ ] `lyniafinance.com` resolves to expected IP/Cloudflare
- [ ] `www.lyniafinance.com` redirects to root domain

---

## HTTPS Connectivity

```bash
curl -sI https://admin.lyniafinance.com | head -5
curl -sI https://distributor.lyniafinance.com | head -5
curl -sI https://api.lyniafinance.com/health | head -5
curl -sI https://lyniafinance.com | head -5
```

- [ ] Admin portal returns 200 OK
- [ ] Distributor dashboard returns 200 OK
- [ ] API health endpoint returns 200 OK
- [ ] Root domain returns 200 or 301 redirect
- [ ] All responses use HTTPS (no mixed content)

---

## SSL/TLS Certificates

```bash
# Check certificate subject and validity
for domain in admin.lyniafinance.com distributor.lyniafinance.com api.lyniafinance.com; do
  echo "=== $domain ==="
  echo | openssl s_client -servername $domain -connect $domain:443 2>/dev/null \
    | openssl x509 -noout -subject -dates -issuer
  echo
done
```

- [ ] Admin portal certificate is valid and issued by Amazon
- [ ] Distributor dashboard certificate is valid and issued by Amazon
- [ ] API certificate is valid and issued by Amazon
- [ ] All certificates cover the correct domain names
- [ ] No certificate warnings in browsers

---

## TLS Version Enforcement

```bash
# TLS 1.2 should work
openssl s_client -connect api.lyniafinance.com:443 -tls1_2 </dev/null 2>&1 | grep "Protocol"

# TLS 1.3 should work
openssl s_client -connect api.lyniafinance.com:443 -tls1_3 </dev/null 2>&1 | grep "Protocol"

# TLS 1.0 should FAIL
openssl s_client -connect api.lyniafinance.com:443 -tls1 </dev/null 2>&1 | grep -i "error\|alert"

# TLS 1.1 should FAIL
openssl s_client -connect api.lyniafinance.com:443 -tls1_1 </dev/null 2>&1 | grep -i "error\|alert"
```

- [ ] TLS 1.2 connections succeed
- [ ] TLS 1.3 connections succeed
- [ ] TLS 1.0 connections are rejected
- [ ] TLS 1.1 connections are rejected

---

## Security Headers

```bash
curl -sI https://admin.lyniafinance.com | grep -iE \
  "strict-transport|x-frame|x-content-type|referrer|content-security|x-xss|permissions"
```

- [ ] `Strict-Transport-Security` present with `max-age=31536000`
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Content-Security-Policy` present and correct
- [ ] `X-XSS-Protection: 1; mode=block`

---

## API Endpoints

```bash
# Health check
curl -s https://api.lyniafinance.com/health | jq .

# Service-specific health checks
curl -s https://api.lyniafinance.com/scoring/health | jq .
curl -s https://api.lyniafinance.com/whatsapp/health | jq .
curl -s https://api.lyniafinance.com/kyc/health | jq .
curl -s https://api.lyniafinance.com/payments/health | jq .
curl -s https://api.lyniafinance.com/devices/health | jq .
curl -s https://api.lyniafinance.com/notifications/health | jq .
```

- [ ] Main health endpoint returns success
- [ ] Scoring service health OK
- [ ] WhatsApp service health OK
- [ ] KYC service health OK
- [ ] Payment service health OK
- [ ] Device lock service health OK
- [ ] Notification service health OK

---

## CORS Verification

```bash
# Test CORS preflight from admin portal
curl -sI -X OPTIONS https://api.lyniafinance.com/scoring/health \
  -H "Origin: https://admin.lyniafinance.com" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control

# Test CORS preflight from distributor dashboard
curl -sI -X OPTIONS https://api.lyniafinance.com/scoring/health \
  -H "Origin: https://distributor.lyniafinance.com" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control
```

- [ ] CORS allows `https://admin.lyniafinance.com`
- [ ] CORS allows `https://distributor.lyniafinance.com`
- [ ] CORS rejects unknown origins

---

## Frontend Application

### Admin Portal (`https://admin.lyniafinance.com`)

- [ ] Login page loads correctly
- [ ] Supabase authentication works (can log in)
- [ ] Dashboard data loads (API calls succeed)
- [ ] No console errors related to CORS, CSP, or mixed content
- [ ] All API calls go to `api.lyniafinance.com`
- [ ] WebSocket/realtime connections to Supabase work

### Distributor Dashboard (`https://distributor.lyniafinance.com`)

- [ ] Login page loads correctly
- [ ] Authentication works
- [ ] Dashboard loads data
- [ ] No console errors

---

## External Integration Webhooks

### WhatsApp

- [ ] Send test message to WhatsApp number
- [ ] Webhook received at `https://api.lyniafinance.com/whatsapp/webhook`
- [ ] Bot responds correctly

### Payment Webhooks

- [ ] EcoCash callback URL updated
- [ ] OneMoney callback URL updated
- [ ] Test payment callback received

### KYC

- [ ] Smile Identity callback URL updated
- [ ] Test KYC submission triggers callback

---

## Supabase

- [ ] Auth redirect URLs include `*.lyniafinance.com`
- [ ] Frontend can authenticate via Supabase
- [ ] Database queries work from Lambda functions
- [ ] Realtime subscriptions work from frontend

---

## Cloudflare

- [ ] Zone status: Active
- [ ] SSL mode: Full (Strict)
- [ ] HSTS enabled
- [ ] All DNS records correct
- [ ] Health checks passing
- [ ] No active security incidents
- [ ] Analytics showing traffic

---

## Performance (from Zimbabwe)

- [ ] DNS resolution < 100ms
- [ ] TTFB < 500ms for admin portal
- [ ] TTFB < 300ms for API health endpoint
- [ ] Page load < 3s for admin portal
- [ ] No timeout errors

---

## SSL Labs Rating

Test at: https://www.ssllabs.com/ssltest/

- [ ] `admin.lyniafinance.com`: Grade A or A+
- [ ] `distributor.lyniafinance.com`: Grade A or A+
- [ ] `api.lyniafinance.com`: Grade A or A+

---

## Monitoring

- [ ] Cloudflare health checks active and passing
- [ ] AWS CloudWatch alarms still functional
- [ ] Route 53 health check updated (if retained)
- [ ] Cloudflare notification recipients configured
- [ ] No elevated error rates in CloudWatch
- [ ] No WAF false positives blocking legitimate traffic

---

## Sign-Off

| Check | Verified By | Date | Status |
|-------|------------|------|--------|
| DNS Resolution | | | |
| HTTPS Connectivity | | | |
| SSL Certificates | | | |
| Security Headers | | | |
| API Endpoints | | | |
| CORS | | | |
| Admin Portal E2E | | | |
| Distributor Dashboard E2E | | | |
| WhatsApp Webhook | | | |
| Payment Webhooks | | | |
| Supabase Auth | | | |
| Cloudflare Config | | | |
| SSL Labs Rating | | | |
| Performance (ZW) | | | |
