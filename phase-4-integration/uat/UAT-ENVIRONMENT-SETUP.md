# Lynia Finance - UAT Environment Setup Guide

**Document ID:** LYN-UAT-ENV-001
**Version:** 1.0
**Date:** 2026-02-10
**Reference:** UAT Test Plan LYN-UAT-PLAN-001

---

## 1. Environment Overview

The UAT environment mirrors production configuration using sandbox/test instances of all external services. This ensures realistic testing without affecting live systems or real customer data.

```
UAT Environment Architecture
=============================

[WhatsApp Test Phone] --> [Meta Cloud API (Test)] --> [whatsapp-service Lambda]
                                                            |
[Admin Portal (Staging)] -----> [API Gateway] -----> [Lambda Functions]
[Distributor Dashboard] -----/                             |
                                                     [Supabase Staging]
                                                      - PostgreSQL
                                                      - Auth (JWT)
                                                      - Storage
                                                            |
                                            [External Services (Sandbox)]
                                             - Smile Identity (Test)
                                             - EcoCash (Sandbox)
                                             - OneMoney (Sandbox)
                                             - Trustonic (Sandbox)
```

---

## 2. Prerequisites

### 2.1 Access Requirements

| Service | Credentials Required | Contact |
|---------|---------------------|---------|
| AWS Staging Account | IAM user with Lambda/API Gateway access | DevOps Lead |
| Supabase Staging | Project URL + service role key | Engineering Lead |
| Meta WhatsApp Business | Test business number + API token | Product Manager |
| Smile Identity | Sandbox partner_id + API key | Engineering Lead |
| EcoCash Sandbox | Merchant ID + API credentials | Finance Lead |
| OneMoney Sandbox | Merchant ID + API credentials | Finance Lead |
| Trustonic Sandbox | API key + device management credentials | Engineering Lead |

### 2.2 Local Tools

```bash
# Required CLI tools
node --version    # >= 18.x
pnpm --version    # >= 8.x
aws --version     # >= 2.x
sam --version     # >= 1.x
```

---

## 3. Environment Setup Steps

### 3.1 Deploy Lambda Functions to Staging

```bash
# Build all services
cd /home/user/Lynia-finance
pnpm install
pnpm build

# Deploy to staging via SAM
sam build
sam deploy --config-env staging
```

Verify deployment:
```bash
# Check all Lambda functions are deployed
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'lynia-staging')].[FunctionName, LastModified]" --output table
```

### 3.2 Configure Supabase Staging

1. **Create staging project** at `https://supabase.com/dashboard`
2. **Run all migrations:**
```bash
pnpm db:migrate
```
3. **Verify tables created:**
```sql
-- Check all required tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables: audit_log, commissions, customers, customer_consents,
-- data_deletion_requests, device_locks, devices, fee_disclosures,
-- handovers, kyc_submissions, loans, notifications, payments,
-- privacy_audit_log, record_retention_policies, regulatory_reports,
-- security_audit_log, transaction_limits
```
4. **Verify RLS policies active:**
```sql
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### 3.3 Seed Test Data

```bash
# Seed UAT test data
pnpm db:seed
```

The seed script creates:
- 20 Zimbabwe test customers with varied profiles
- 5 non-Zimbabwe test customers (for rejection testing)
- 25 devices (15 in_stock, 10 assigned)
- 10 active loans, 3 overdue loans, 5 completed loans
- 50+ payment transactions
- 3 distributor accounts
- KYC submission records
- Credit score records

**Verify seed data:**
```sql
-- Verify customer counts
SELECT country, COUNT(*) FROM customers GROUP BY country;

-- Verify device inventory
SELECT status, COUNT(*) FROM devices GROUP BY status;

-- Verify loan statuses
SELECT status, COUNT(*) FROM loans GROUP BY status;

-- Verify payment counts
SELECT payment_type, status, COUNT(*) FROM payments GROUP BY payment_type, status;
```

### 3.4 Create UAT User Accounts

Create the following accounts in Supabase Auth:

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| `uat-admin@lynia.co.zw` | (generated) | super_admin | Full system access |
| `uat-loanofficer@lynia.co.zw` | (generated) | loan_officer | Loan review/approval |
| `uat-compliance@lynia.co.zw` | (generated) | compliance | Report generation |
| `uat-distributor@lynia.co.zw` | (generated) | distributor | Device/commission management |

```bash
# Create accounts via Supabase CLI or dashboard
# Store credentials securely - share with UAT testers via secure channel
```

### 3.5 Configure WhatsApp Test Business Number

1. Access Meta Business Manager > WhatsApp > Test Numbers
2. Register test business number for staging
3. Configure webhook URL: `https://staging-api.lynia.co.zw/whatsapp/webhook`
4. Set verify token: use value from staging environment variable `WHATSAPP_VERIFY_TOKEN`
5. Register test recipient numbers:
   - `+263771000001` (Shona tester)
   - `+263771000002` (English tester)
   - `+263771000003` (Ndebele tester)

### 3.6 Configure Payment Provider Sandboxes

**EcoCash Sandbox:**
```yaml
Environment variables:
  ECOCASH_API_URL: https://sandbox.ecocash.co.zw
  ECOCASH_MERCHANT_ID: (from sandbox registration)
  ECOCASH_API_KEY: (from sandbox registration)
  ECOCASH_CALLBACK_URL: https://staging-api.lynia.co.zw/payments/callback/ecocash
```

**OneMoney Sandbox:**
```yaml
Environment variables:
  ONEMONEY_API_URL: https://sandbox.onemoney.co.zw
  ONEMONEY_MERCHANT_ID: (from sandbox registration)
  ONEMONEY_API_KEY: (from sandbox registration)
  ONEMONEY_CALLBACK_URL: https://staging-api.lynia.co.zw/payments/callback/onemoney
```

### 3.7 Configure Smile Identity Sandbox

```yaml
Environment variables:
  SMILE_IDENTITY_URL: https://testapi.smileidentity.com
  SMILE_PARTNER_ID: (from sandbox registration)
  SMILE_API_KEY: (from sandbox registration)
  SMILE_CALLBACK_URL: https://staging-api.lynia.co.zw/kyc/callback
```

### 3.8 Deploy Frontend Applications

```bash
# Admin Portal
cd frontend/admin-portal
pnpm build
# Deploy to staging URL (Vercel/AWS Amplify)

# Distributor Dashboard
cd frontend/distributor-dashboard
pnpm build
# Deploy to staging URL
```

Verify URLs:
- Admin Portal: `https://staging-admin.lynia.co.zw`
- Distributor Dashboard: `https://staging-distributor.lynia.co.zw`

---

## 4. Environment Verification Checklist

Run this checklist after setup to confirm everything is ready:

| # | Check | Command/Action | Expected Result | Status |
|---|-------|---------------|-----------------|--------|
| 1 | Lambda functions deployed | `aws lambda list-functions` | All 6 services listed | [ ] |
| 2 | API Gateway accessible | `curl https://staging-api.lynia.co.zw/health` | 200 OK | [ ] |
| 3 | Database connectivity | Query via Supabase dashboard | Tables populated | [ ] |
| 4 | Test data seeded | `SELECT COUNT(*) FROM customers` | >= 25 | [ ] |
| 5 | Admin portal loads | Open staging-admin URL | Login page renders | [ ] |
| 6 | Distributor dashboard loads | Open staging-distributor URL | Login page renders | [ ] |
| 7 | WhatsApp webhook active | Send "Hi" from test number | Response received | [ ] |
| 8 | Smile Identity sandbox | POST test KYC request | Callback received | [ ] |
| 9 | EcoCash sandbox | POST test payment | USSD prompt delivered | [ ] |
| 10 | OneMoney sandbox | POST test payment | USSD prompt delivered | [ ] |
| 11 | UAT admin login | Login with uat-admin credentials | Dashboard loads | [ ] |
| 12 | UAT distributor login | Login with uat-distributor credentials | Dashboard loads | [ ] |

---

## 5. Environment Reset Procedure

If UAT data becomes corrupted or a fresh start is needed:

```bash
# Reset database (STAGING ONLY - never run in production)
pnpm db:reset     # Drop and recreate all tables
pnpm db:migrate   # Run all migrations
pnpm db:seed      # Re-seed test data

# Recreate user accounts (they are dropped with db:reset)
# Re-run account creation steps from Section 3.4
```

---

## 6. Troubleshooting

| Issue | Possible Cause | Resolution |
|-------|---------------|------------|
| Lambda timeout | Cold start on first invocation | Invoke each function once to warm up |
| WhatsApp webhook not receiving | Webhook URL misconfigured | Verify URL and verify_token in Meta dashboard |
| Supabase connection refused | Connection pooling limit | Check PgBouncer settings, increase pool size |
| Payment callback not received | Callback URL not registered | Verify callback URLs in sandbox dashboards |
| KYC verification stuck | Smile Identity sandbox delay | Wait up to 60 seconds; check callback logs |
| Admin portal blank page | Build artifacts stale | Re-run `pnpm build` and redeploy |
| CORS errors on frontend | API Gateway CORS headers | Verify CORS configuration in SAM template |

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Engineering | Initial environment setup guide |
