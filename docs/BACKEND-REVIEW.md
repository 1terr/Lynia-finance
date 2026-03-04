# Backend Security & Architecture Review

> Reviewed: 2026-02-11
> Scope: All 6 Lambda services, shared library, database schema, infrastructure
> Services reviewed: scoring, payment, whatsapp, kyc, lock, notification

---

## Summary

The backend is well-structured with clear microservice boundaries, comprehensive
database schema (35+ tables, 13 migrations), and solid business logic (credit
scoring algorithm, multi-provider payments, 8-step onboarding). However, the
security review identified **critical gaps** that must be addressed before
production deployment.

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 3 | 2 fixed, 1 requires implementation |
| **HIGH** | 3 | Documented, needs implementation |
| **MEDIUM** | 7 | Documented |
| **LOW** | 3 | Documented |

---

## CRITICAL Issues

### C1. Webhook Signature Verification Was Optional ✅ FIXED

**Files**: `payment-service/src/index.ts`, `kyc-service/src/index.ts`

All webhook handlers (EcoCash, OneMoney, O'mari, DIDIT) previously
checked signatures only *if* the header was present:

```typescript
// BEFORE (vulnerable):
if (receivedSignature) {
  // verify...
}
// Missing header → webhook processed without verification
```

An attacker could send unsigned fake payloads to:
- Mark fraudulent payments as "SUCCESS"
- Approve KYC verifications for fake identities
- Manipulate loan balances

**Fix applied**: Signature verification is now mandatory. Requests without a
signature header are rejected with 401.

### C2. No JWT Authentication on ANY Lambda Handler ⚠️ NEEDS IMPLEMENTATION

**Files**: All 6 service `index.ts` handlers

None of the Lambda handlers validate JWT tokens from the `Authorization` header.
Every endpoint is effectively unauthenticated:

- `POST /scoring/calculate` — anyone can calculate credit scores
- `GET /scoring/{customerId}` — anyone can read any customer's credit score
- `POST /payments/initiate` — anyone can initiate payments
- `POST /locks/lock` — anyone can lock devices
- `GET /kyc/{customerId}` — anyone can read KYC status
- `POST /handovers/complete` — anyone can complete device handovers

The CLAUDE.md mandates: *"All API endpoints MUST validate JWT tokens via
Supabase Auth."*

**Shared auth middleware created**: `services/shared/utils/auth.ts` provides
`requireAuth(event)` which validates JWT tokens via Supabase Auth. Each handler
needs to call this at the top of every protected endpoint.

**Recommended fix** (for each handler):
```typescript
import { requireAuth } from '../../shared/utils/auth';

async function handleCalculateScore(event) {
  const auth = await requireAuth(event);
  if (auth.error) return auth.error;
  // ... proceed with auth.userId
}
```

**Exemptions**: Webhook endpoints (`/webhook/*`) use signature verification
instead of JWT auth. WhatsApp webhook GET (Meta verification) is inherently
public.

### C3. WhatsApp Incoming Webhook Missing Meta Signature Verification ⚠️ NEEDS IMPLEMENTATION

**File**: `whatsapp-service/src/index.ts`, `handleWebhook()`

The `POST /whatsapp/webhook` handler processes incoming messages from Meta
without verifying the `X-Hub-Signature-256` HMAC header. An attacker could
send crafted webhook payloads to:
- Inject messages into customer conversations
- Trigger onboarding flows for non-existent customers
- Manipulate conversation state

Meta signs every webhook with `HMAC-SHA256(app_secret, payload)` and sends it
in the `X-Hub-Signature-256` header. This MUST be verified.

---

## HIGH Issues

### H1. Shared Response Utilities Not Used by Any Handler

**Files**: All 6 service `index.ts` handlers vs `shared/utils/response.ts`

The shared library has well-built response utilities with:
- Dynamic CORS origin allow-list (admin, app, distributor domains + localhost in dev)
- Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Standardized response format (`{ success, data/error }`)

But every handler manually constructs responses with a hardcoded
`'Access-Control-Allow-Origin': 'https://admin.lynia.finance'` string.

**Consequences**:
- The distributor dashboard (`distributor.lyniafinance.com`) cannot call APIs
- No security headers (HSTS, nosniff, etc.) on any response
- Inconsistent response format across services

### H2. Rate Limiter Exists But Is Never Called

**Files**: `shared/utils/rate-limiter.ts` (built) vs all handlers (not using it)

The rate limiter implementation exists with sensible defaults (auth: 5/15min,
payment: 10/hr, kyc: 3/hr) but `checkRateLimit()` is never called in any
handler. The code even notes: *"In production, this should be backed by
DynamoDB or ElastiCache."*

Without rate limiting, the following attacks are possible:
- Brute-force scoring to find credit-worthy customer IDs
- Payment flooding
- KYC submission spam against DIDIT (costs money per API call)

**Note**: API Gateway throttling (if configured in `template.yaml`) provides
first-line defense, but no `Auth`/`Authorizer` configuration was found in the
SAM template.

### H3. Incomplete RLS Policies — Only `customers` Table Has Policies

**File**: `database/migrations/001_initial_schema.sql`

RLS is enabled on 15 tables, but only `customers` has actual policies defined:
- `"Customers view own data"` — SELECT where `auth.uid() = id`
- `"Admins view all customers"` — ALL for admin/manager roles

The remaining 14 tables (`loans`, `payments`, `devices`, `kyc_submissions`,
`credit_scores`, etc.) have **RLS enabled but NO policies**. This means:
- Authenticated users CANNOT access these tables via Supabase client SDK
- The Lambda services use `SERVICE_ROLE_KEY` which bypasses RLS entirely

The admin portal and distributor dashboard likely rely on the service role key
(anon key would be blocked by RLS), which is a security concern if that key
is exposed to the browser.

---

## MEDIUM Issues

### M1. In-Memory Rate Limiter Resets on Lambda Cold Start

The `rate-limiter.ts` uses `new Map()`. Lambda functions are ephemeral — every
cold start (or scale-up) creates a fresh Map. Rate limiting is effectively
non-functional across invocations. Needs DynamoDB or ElastiCache backing.

### M2. Exchange Rate Conversion Is a TODO

**File**: `payment-service/src/payment-service.ts:91`

```typescript
const amountUsd = currency === 'USD' ? amount : amount;
// TODO: Add exchange rate conversion for ZWL/ZAR
```

ZWL and ZAR payments are treated as USD for RBZ limit checks. Given ZWL's
significant devaluation, this could allow transactions far exceeding USD
limits.

### M3. Test Credential Defaults in Provider Constructors

**File**: `payment-service/src/ecocash-provider.ts:77-82`

```typescript
merchant_id: process.env.ECOCASH_MERCHANT_ID || 'test_merchant',
api_key: process.env.ECOCASH_API_KEY || 'test_api_key',
```

If environment variables are misconfigured in production, the service silently
falls back to test credentials. Should throw on missing required credentials
in production.

### M4. Payment Amount Constraint May Be Wrong

**File**: `database/migrations/010_security_compliance_hardening.sql:141`

```sql
ALTER TABLE payments ADD CONSTRAINT chk_payment_max_amount
    CHECK (amount <= 200000); -- $2000 in cents, or $2000 if stored in dollars
```

The comment reveals uncertainty about the storage format. The payment service
stores amounts as plain numbers (not cents): `amount: request.amount`. If
stored in dollars, this constraint allows $200,000 per transaction — 100x the
RBZ limit.

### M5. Non-null Assertions on Path Parameters

**Files**: Multiple handlers

```typescript
const customerId = event.pathParameters?.customerId!;
```

If API Gateway routing doesn't match correctly, `customerId` is `undefined`
and the non-null assertion silently passes, leading to queries with
`undefined` values.

### M6. JSON.parse Without Try/Catch on Request Body

**Files**: All handlers

```typescript
const body = JSON.parse(event.body || '{}');
```

Malformed JSON throws and is caught by the outer handler, returning 500
instead of 400. Should use the new `parseBody()` utility in
`shared/utils/response.ts`.

### M7. Hardcoded CORS Origin Ignores Shared Utility

As noted in H1, every handler hardcodes `'https://admin.lynia.finance'`
instead of using `getCorsOrigin()` / `getSecurityHeaders()` from the shared
response utility. Note the hardcoded domain is also different from the shared
utility's list (`admin.lyniafinance.com` vs `admin.lynia.finance`).

---

## LOW Issues

### L1. Unused Functions in WhatsApp Service

`_getConversation`, `_updateConversationState`, and `_getCustomerLoan` are
prefixed with `_` and never called. Should be removed to reduce bundle size.

### L2. Scoring Service Assumes 6-Month Loan Term

**File**: `scoring-service/src/index.ts:117`

```typescript
const loanTerm = 6; // months
```

The affordability calculation hardcodes a 6-month term. If loan products have
different terms, the DTI calculation will be inaccurate.

### L3. No API Gateway Authorizer in SAM Template

**File**: `template.yaml`

The SAM template has no `Auth` or `Authorizer` configuration. API Gateway
is serving as a pass-through without any authentication at the gateway level.
All auth burden falls on Lambda code (which currently has none).

---

## Positive Findings

These patterns are well-implemented:

1. **Webhook HMAC verification** uses `timingSafeEqual` (timing-safe comparison)
2. **Circuit breaker** on WhatsApp API with queue-on-failure pattern
3. **PII masking** in shared logger (phone, national ID)
4. **8-layer error handling** in WhatsApp message processing
5. **RBZ transaction limits** enforced in payment service
6. **Phone number sanitization** with Zimbabwe format handling
7. **Credit scoring algorithm** is well-structured with 5 components
8. **Idempotent payment processing** (checks status before processing)
9. **KYC retry limits** (max 3 attempts) with proper eligibility checks
10. **Database schema** is comprehensive with proper constraints and indexes

---

## Recommended Fix Priority

```
Phase 1 (Before staging):
  ✅ C1. Webhook signature verification mandatory (DONE)
  ⬜ C2. Add JWT auth to all protected endpoints
  ⬜ C3. Add Meta webhook signature verification
  ⬜ H1. Use shared response utilities in all handlers
  ⬜ M3. Throw on missing credentials in production

Phase 2 (Before production):
  ⬜ H2. Wire up rate limiting (DynamoDB-backed)
  ⬜ H3. Complete RLS policies for all tables
  ⬜ M2. Implement ZWL/ZAR exchange rate conversion
  ⬜ M4. Verify payment amount storage format & fix constraint
  ⬜ L3. Add API Gateway authorizer

Phase 3 (Hardening):
  ⬜ M5. Validate path parameters before use
  ⬜ M6. Use parseBody() for safe JSON parsing
  ⬜ M7. Consistent CORS via shared utility
  ⬜ L1. Remove unused WhatsApp functions
  ⬜ L2. Make scoring loan term configurable
```

---

## Files Modified in This Review

| File | Change |
|------|--------|
| `services/payment-service/src/index.ts` | Webhook signatures now mandatory (3 handlers) |
| `services/kyc-service/src/index.ts` | DIDIT webhook signature now mandatory |
| `services/shared/utils/auth.ts` | **NEW** — JWT auth middleware for Lambda handlers |
| `services/shared/utils/response.ts` | Added `parseBody()` safe JSON parsing utility |
