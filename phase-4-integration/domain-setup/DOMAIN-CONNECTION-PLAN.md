# Phase 4: Domain Connection Plan — lyniafinance.com

## Overview

This document outlines the complete plan for connecting the Lynia Finance production
infrastructure to the `lyniafinance.com` domain managed on Cloudflare. It covers DNS
configuration, SSL/TLS certificates, AWS service integration (API Gateway, CloudFront,
S3), Supabase custom domain, and security hardening.

### Current State

| Component | Current Config | Target Config |
|-----------|---------------|---------------|
| Domain | `lyniafinance.co.zw` (Route 53) | `lyniafinance.com` (Cloudflare) |
| DNS Provider | AWS Route 53 | Cloudflare |
| Admin Portal | CloudFront default domain | `admin.lyniafinance.com` |
| Distributor Dashboard | CloudFront default domain | `distributor.lyniafinance.com` |
| API Gateway | Default AWS endpoint | `api.lyniafinance.com` |
| Supabase | `ghdrnxlsupbzoddtyxcp.supabase.co` | `db.lyniafinance.com` (CNAME proxy) |
| Marketing/Landing | None | `www.lyniafinance.com` / `lyniafinance.com` |

### Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   lyniafinance.com           │
                         │   Cloudflare (DNS + CDN)     │
                         │   SSL: Full (Strict)         │
                         └───────────┬─────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
     ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
     │   admin.    │         │    api.     │         │ distributor.│
     │ lyniafinance│         │ lyniafinance│         │ lyniafinance│
     │    .com     │         │    .com     │         │    .com     │
     └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
            │                       │                        │
     ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
     │ CloudFront  │         │ API Gateway │         │ CloudFront  │
     │ Distribution│         │ Custom      │         │ Distribution│
     │ (S3 Origin) │         │ Domain      │         │ (S3 Origin) │
     └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
            │                       │                        │
     ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
     │ S3: Admin   │         │ 6 Lambda    │         │ S3: Distrib │
     │ Portal      │         │ Functions   │         │ Dashboard   │
     │ (Next.js)   │         │ (Services)  │         │ (Next.js)   │
     └─────────────┘         └──────┬──────┘         └─────────────┘
                                    │
                             ┌──────▼──────┐
                             │  Supabase   │
                             │ PostgreSQL  │
                             │ (+ Auth)    │
                             └─────────────┘
```

---

## Task Breakdown

### Task 1: Cloudflare Account & Zone Setup
**Priority**: Critical | **Estimated Complexity**: Low
**Guide**: [CLOUDFLARE-DNS-SETUP.md](./CLOUDFLARE-DNS-SETUP.md)

- [ ] 1.1 Verify `lyniafinance.com` zone is active in Cloudflare
- [ ] 1.2 Set SSL/TLS encryption mode to **Full (Strict)**
- [ ] 1.3 Enable **Always Use HTTPS**
- [ ] 1.4 Set minimum TLS version to **1.2**
- [ ] 1.5 Enable **HSTS** (max-age 12 months, include subdomains, preload)
- [ ] 1.6 Enable **Automatic HTTPS Rewrites**
- [ ] 1.7 Configure Cloudflare Page Rules (see security guide)

### Task 2: AWS ACM Certificate Provisioning
**Priority**: Critical | **Estimated Complexity**: Medium
**Guide**: [AWS-DOMAIN-INTEGRATION.md](./AWS-DOMAIN-INTEGRATION.md)

- [ ] 2.1 Request ACM certificate in **us-east-1** for CloudFront:
  - `lyniafinance.com`
  - `*.lyniafinance.com`
- [ ] 2.2 Request ACM certificate in **us-east-1** for API Gateway (regional):
  - `api.lyniafinance.com`
- [ ] 2.3 Add DNS validation CNAME records to Cloudflare
- [ ] 2.4 Wait for ACM certificate status → **Issued**
- [ ] 2.5 Document certificate ARNs for stack parameters

### Task 3: CloudFront Distribution Updates
**Priority**: Critical | **Estimated Complexity**: Medium
**Guide**: [AWS-DOMAIN-INTEGRATION.md](./AWS-DOMAIN-INTEGRATION.md)

- [ ] 3.1 Update Admin Portal CloudFront distribution:
  - Add alternate domain: `admin.lyniafinance.com`
  - Attach ACM wildcard certificate
  - Set minimum TLS to TLSv1.2_2021
- [ ] 3.2 Update Distributor Dashboard CloudFront distribution:
  - Add alternate domain: `distributor.lyniafinance.com`
  - Attach ACM wildcard certificate
  - Set minimum TLS to TLSv1.2_2021
- [ ] 3.3 Update CloudFront security headers policy CSP to include `*.lyniafinance.com`
- [ ] 3.4 Add CNAME records in Cloudflare pointing to CloudFront distributions
- [ ] 3.5 Set Cloudflare proxy status to **DNS only** (grey cloud) for CloudFront CNAMEs
- [ ] 3.6 Test HTTPS access to both portals via custom domains

### Task 4: API Gateway Custom Domain
**Priority**: Critical | **Estimated Complexity**: Medium
**Guide**: [AWS-DOMAIN-INTEGRATION.md](./AWS-DOMAIN-INTEGRATION.md)

- [ ] 4.1 Create API Gateway custom domain: `api.lyniafinance.com`
  - Attach regional ACM certificate
  - Set TLS 1.2 security policy
- [ ] 4.2 Create base path mapping to production API stage
- [ ] 4.3 Add CNAME record in Cloudflare: `api` → API Gateway regional domain
- [ ] 4.4 Set Cloudflare proxy status to **DNS only** (grey cloud) for API CNAME
- [ ] 4.5 Test API endpoints via `https://api.lyniafinance.com`
- [ ] 4.6 Update WhatsApp webhook URL to `https://api.lyniafinance.com/whatsapp/webhook`
- [ ] 4.7 Update EcoCash callback URL to `https://api.lyniafinance.com/payments/webhook`
- [ ] 4.8 Update OneMoney callback URL to `https://api.lyniafinance.com/payments/webhook`

### Task 5: Supabase Domain Configuration
**Priority**: High | **Estimated Complexity**: Low
**Guide**: [SUPABASE-DOMAIN-SETUP.md](./SUPABASE-DOMAIN-SETUP.md)

- [ ] 5.1 Evaluate Supabase custom domain (Pro plan required)
- [ ] 5.2 If using custom domain: configure `db.lyniafinance.com` → Supabase
- [ ] 5.3 If not using custom domain: keep `*.supabase.co` and ensure CSP allows it
- [ ] 5.4 Update frontend `NEXT_PUBLIC_SUPABASE_URL` if custom domain is used
- [ ] 5.5 Verify Supabase Auth callback URLs include `*.lyniafinance.com`

### Task 6: Update Application Configuration
**Priority**: Critical | **Estimated Complexity**: Medium
**Guide**: [APP-CONFIG-UPDATES.md](./APP-CONFIG-UPDATES.md)

- [ ] 6.1 Update `infrastructure/aws/production.env.template`:
  - `API_DOMAIN=api.lyniafinance.com`
  - `ADMIN_DOMAIN=admin.lyniafinance.com`
  - `DISTRIBUTOR_DOMAIN=distributor.lyniafinance.com`
  - `API_BASE_URL=https://api.lyniafinance.com`
  - `NEXT_PUBLIC_API_URL=https://api.lyniafinance.com`
- [ ] 6.2 Update CloudFormation template default domain parameter
- [ ] 6.3 Update Next.js CSP headers to allow `*.lyniafinance.com`
- [ ] 6.4 Update CloudFront response headers policy CSP
- [ ] 6.5 Update CORS allowed origins in Lambda services
- [ ] 6.6 Update Supabase Auth redirect URLs
- [ ] 6.7 Update WhatsApp Business API webhook URL
- [ ] 6.8 Update external service callback URLs (EcoCash, OneMoney, Smile Identity)

### Task 7: Security Hardening
**Priority**: Critical | **Estimated Complexity**: Medium
**Guide**: [SSL-SECURITY-CONFIG.md](./SSL-SECURITY-CONFIG.md)

- [ ] 7.1 Configure Cloudflare SSL/TLS to **Full (Strict)**
- [ ] 7.2 Enable Cloudflare **Bot Fight Mode**
- [ ] 7.3 Configure Cloudflare **Rate Limiting** rules (complement AWS WAF):
  - Auth endpoints: 20 req/min
  - API general: 100 req/min
  - Webhook endpoints: 500 req/min
- [ ] 7.4 Enable Cloudflare **Under Attack Mode** trigger (for emergencies)
- [ ] 7.5 Configure Cloudflare **Firewall Rules**:
  - Block known bad bots
  - Challenge suspicious regions (outside Southern Africa)
  - Allow WhatsApp/Meta webhook IPs
- [ ] 7.6 Set up Cloudflare **Origin Server** certificate if using proxy mode
- [ ] 7.7 Verify end-to-end TLS chain: Client → Cloudflare → AWS (TLS 1.2+)
- [ ] 7.8 Test with SSL Labs (target: A+ rating)

### Task 8: Monitoring & Verification
**Priority**: High | **Estimated Complexity**: Low

- [ ] 8.1 Set up Cloudflare **Health Checks** for:
  - `api.lyniafinance.com/health`
  - `admin.lyniafinance.com`
  - `distributor.lyniafinance.com`
- [ ] 8.2 Configure Cloudflare **Analytics** and review traffic patterns
- [ ] 8.3 Set up Cloudflare **Notifications**:
  - SSL certificate expiry
  - DDoS alerts
  - Origin health degradation
- [ ] 8.4 Verify AWS Route 53 health check (if retained as failover)
- [ ] 8.5 Test from Zimbabwe (target market): DNS resolution, latency, TLS

### Task 9: Landing Page & Root Domain
**Priority**: Medium | **Estimated Complexity**: Low

- [ ] 9.1 Decide root domain (`lyniafinance.com`) destination:
  - Option A: Redirect to `admin.lyniafinance.com`
  - Option B: Static landing page on Cloudflare Pages
  - Option C: S3 + CloudFront static site
- [ ] 9.2 Configure `www.lyniafinance.com` → redirect to root or admin
- [ ] 9.3 Set up Cloudflare Page Rule for `www` → `301` redirect

### Task 10: Migration & Cutover (if migrating from .co.zw)
**Priority**: Medium | **Estimated Complexity**: Low

- [ ] 10.1 Set low TTL (60s) on old DNS records 24 hours before cutover
- [ ] 10.2 Deploy all new DNS records in Cloudflare
- [ ] 10.3 Verify all services accessible via new domain
- [ ] 10.4 Set up 301 redirects from `*.lyniafinance.co.zw` → `*.lyniafinance.com` (if applicable)
- [ ] 10.5 Monitor for 48 hours for DNS propagation issues
- [ ] 10.6 Increase TTL back to production values (300s+)

---

## Execution Order

```
Phase A: Foundation (Tasks 1, 2)          ← Do first, certificates take time
    │
Phase B: Infrastructure (Tasks 3, 4, 5)  ← After certificates are issued
    │
Phase C: Application (Task 6)            ← Update configs after infra is ready
    │
Phase D: Security (Task 7)               ← Harden after everything works
    │
Phase E: Verify & Launch (Tasks 8, 9)    ← Final testing
    │
Phase F: Cutover (Task 10)               ← If migrating from .co.zw
```

---

## Key Decisions Required

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Cloudflare proxy for CloudFront | Proxied (orange) vs DNS only (grey) | **DNS only** — avoids double-CDN latency |
| Cloudflare proxy for API Gateway | Proxied vs DNS only | **DNS only** — AWS WAF handles security |
| Root domain destination | Admin portal / Landing page / Redirect | **Landing page** on Cloudflare Pages |
| Supabase custom domain | Custom (`db.lyniafinance.com`) vs default | **Default** unless on Pro plan |
| Old domain (.co.zw) handling | Redirect / Parallel / Decommission | **301 redirect** to .com |
| Cloudflare plan | Free / Pro / Business | **Pro** — for WAF rules + advanced SSL |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ACM certificate validation delay | Blocks all HTTPS setup | Request certificates early (Task 2 first) |
| DNS propagation delay | Temporary service disruption | Use low TTLs, monitor with `dig` |
| Double-CDN latency (Cloudflare + CloudFront) | Increased latency for users | Use DNS-only mode for CloudFront/API |
| CORS mismatch after domain change | Frontend API calls fail | Update all CORS origins before cutover |
| Webhook URL change breaks integrations | WhatsApp/payment callbacks fail | Update webhooks before cutover, test thoroughly |
| Supabase CSP blocks | Auth/DB calls fail from frontend | Verify CSP includes both old and new domains |

---

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `phase-4-integration/domain-setup/DOMAIN-CONNECTION-PLAN.md` | Created | This master plan |
| `phase-4-integration/domain-setup/CLOUDFLARE-DNS-SETUP.md` | Created | Cloudflare configuration guide |
| `phase-4-integration/domain-setup/AWS-DOMAIN-INTEGRATION.md` | Created | AWS ACM, CloudFront, API Gateway guide |
| `phase-4-integration/domain-setup/SUPABASE-DOMAIN-SETUP.md` | Created | Supabase domain configuration |
| `phase-4-integration/domain-setup/SSL-SECURITY-CONFIG.md` | Created | SSL/TLS and security hardening |
| `phase-4-integration/domain-setup/APP-CONFIG-UPDATES.md` | Created | Application config change checklist |
| `phase-4-integration/domain-setup/VERIFICATION-CHECKLIST.md` | Created | Post-setup verification |
| `infrastructure/aws/dns-ssl.yaml` | Modified | Updated default domain to lyniafinance.com |
| `infrastructure/aws/frontend-hosting.yaml` | Modified | Updated CSP for lyniafinance.com |
| `infrastructure/aws/production-master.yaml` | Modified | Updated default domain |
| `infrastructure/aws/production.env.template` | Modified | Updated domain references |
| `frontend/admin-portal/next.config.js` | Modified | Updated CSP connect-src |
