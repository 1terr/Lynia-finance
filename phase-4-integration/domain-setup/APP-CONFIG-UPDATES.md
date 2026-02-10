# Application Configuration Updates — lyniafinance.com

## Overview

This document lists every file and configuration that must be updated when
changing the domain from `lyniafinance.co.zw` to `lyniafinance.com`.

---

## 1. Infrastructure Templates

### 1.1 `infrastructure/aws/dns-ssl.yaml`

**Change**: Default domain parameter

```yaml
# Before
DomainName:
  Type: String
  Default: lyniafinance.co.zw

# After
DomainName:
  Type: String
  Default: lyniafinance.com
```

### 1.2 `infrastructure/aws/frontend-hosting.yaml`

**Change**: Default domain parameter + CSP header

```yaml
# Before
DomainName:
  Type: String
  Default: lyniafinance.co.zw

# After
DomainName:
  Type: String
  Default: lyniafinance.com
```

CSP `connect-src` update:
```yaml
# Before
connect-src 'self' https://*.lyniafinance.co.zw https://*.supabase.co

# After
connect-src 'self' https://*.lyniafinance.com https://*.supabase.co
```

### 1.3 `infrastructure/aws/production-master.yaml`

**Change**: Default domain parameter

```yaml
# Before
DomainName:
  Type: String
  Default: lyniafinance.co.zw

# After
DomainName:
  Type: String
  Default: lyniafinance.com
```

---

## 2. Environment Configuration

### 2.1 `infrastructure/aws/production.env.template`

**Changes**:
```bash
# Before
ECOCASH_CALLBACK_URL=https://api.lyniafinance.co.zw/payments/webhook
ONEMONEY_CALLBACK_URL=https://api.lyniafinance.co.zw/payments/webhook
API_DOMAIN=api.lyniafinance.co.zw
ADMIN_DOMAIN=admin.lyniafinance.co.zw
DISTRIBUTOR_DOMAIN=distributor.lyniafinance.co.zw
API_BASE_URL=https://api.lyniafinance.co.zw
NEXT_PUBLIC_API_URL=https://api.lyniafinance.co.zw

# After
ECOCASH_CALLBACK_URL=https://api.lyniafinance.com/payments/webhook
ONEMONEY_CALLBACK_URL=https://api.lyniafinance.com/payments/webhook
API_DOMAIN=api.lyniafinance.com
ADMIN_DOMAIN=admin.lyniafinance.com
DISTRIBUTOR_DOMAIN=distributor.lyniafinance.com
API_BASE_URL=https://api.lyniafinance.com
NEXT_PUBLIC_API_URL=https://api.lyniafinance.com
```

---

## 3. Frontend Configuration

### 3.1 `frontend/admin-portal/next.config.js` -- DONE

**Change**: CSP `connect-src` directive (already applied)

```javascript
// Updated to:
"connect-src 'self' https://*.supabase.co https://*.lyniafinance.com",
```

### 3.2 `frontend/distributor-dashboard/next.config.js`

**Change**: Same CSP update as admin portal (if CSP is configured there)

---

## 4. Service CORS Origins

### Affected Services

All Lambda services that set CORS headers need updated origins. Check these files:

- `services/whatsapp-service/src/` — CORS middleware
- `services/kyc-service/src/` — CORS middleware
- `services/scoring-service/src/` — CORS middleware
- `services/payment-service/src/` — CORS middleware
- `services/lock-service/src/` — CORS middleware
- `services/notification-service/src/` — CORS middleware
- `services/shared/` — Shared CORS configuration (if centralized)

**Change pattern**:
```typescript
// Before
const ALLOWED_ORIGINS = [
  'https://admin.lyniafinance.co.zw',
  'https://distributor.lyniafinance.co.zw',
];

// After (include both during migration)
const ALLOWED_ORIGINS = [
  'https://admin.lyniafinance.com',
  'https://distributor.lyniafinance.com',
  'https://admin.lyniafinance.co.zw',    // Remove after migration
  'https://distributor.lyniafinance.co.zw', // Remove after migration
];
```

---

## 5. External Service Webhooks

These must be updated in the respective provider dashboards:

### 5.1 WhatsApp Cloud API (Meta Business Suite)

```
Webhook URL: https://api.lyniafinance.com/whatsapp/webhook
Verify Token: <unchanged>
```

Location: Meta Business Suite → WhatsApp → Configuration → Webhook

### 5.2 EcoCash

```
Callback URL: https://api.lyniafinance.com/payments/webhook
```

Location: EcoCash Merchant Portal

### 5.3 OneMoney

```
Callback URL: https://api.lyniafinance.com/payments/webhook
```

Location: OneMoney Merchant Portal

### 5.4 Smile Identity (KYC)

```
Callback URL: https://api.lyniafinance.com/kyc/callback
```

Location: Smile Identity Partner Portal

### 5.5 Trustonic

```
Callback URL: https://api.lyniafinance.com/devices/callback
```

Location: Trustonic Portal

---

## 6. Supabase Auth Configuration

### Supabase Dashboard → Authentication → URL Configuration

```
Site URL: https://admin.lyniafinance.com

Redirect URLs:
  https://admin.lyniafinance.com/**
  https://distributor.lyniafinance.com/**
  https://admin.lyniafinance.co.zw/**     ← Remove after migration
  https://distributor.lyniafinance.co.zw/** ← Remove after migration
  http://localhost:3000/**
  http://localhost:3001/**
```

---

## 7. GitHub Actions / CI-CD

### 7.1 `.github/workflows/deploy-frontend.yml`

If the workflow references domain names for CloudFront invalidation or
deployment targets, update accordingly.

### 7.2 `.github/workflows/deploy.yml`

If environment variables or domain references exist in deployment workflows.

---

## 8. Documentation Updates

After all changes are applied, update domain references in:

- [ ] `README.md`
- [ ] `QUICKSTART.md`
- [ ] `SETUP.md`
- [ ] `docs/deployment/PRODUCTION-DEPLOYMENT-RUNBOOK.md`
- [ ] `docs/deployment/SUPABASE-SETUP-GUIDE.md`
- [ ] `docs/guides/SYSTEM-FLOWS.md`
- [ ] `docs/guides/WHATSAPP-CLOUD-API-SETUP.md`
- [ ] `docs/external-integrations/PAYMENTS-INTEGRATION.md`
- [ ] `infrastructure/aws/production.env.template`
- [ ] `phase-4-integration/GO-LIVE-CHECKLIST.md`

---

## Change Execution Order

```
1. Update CloudFormation templates (domain defaults)
2. Update production.env.template
3. Update frontend CSP headers
4. Update service CORS origins
5. Deploy infrastructure changes
6. Update external webhook URLs
7. Update Supabase Auth URLs
8. Update documentation
9. Verify all endpoints work
```

> **Important**: Steps 1-4 are code changes that go through normal PR review.
> Steps 5-7 are manual configuration changes in external dashboards.
> Step 8 can be done any time after verification.
