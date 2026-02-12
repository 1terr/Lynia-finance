# Supabase to AWS Migration Report

**Date**: 2026-02-12
**Status**: Complete
**Branch**: `claude/supabase-to-aws-migration-AKfK3`

---

## Executive Summary

Replaced all Supabase dependencies (database client, authentication, storage, realtime) with native AWS services across the entire Lynia Finance platform. Since the platform has **no users and no data** in Supabase, this was a greenfield AWS setup rather than a data migration.

### Services Replaced

| Supabase Feature | AWS Replacement |
|------------------|-----------------|
| PostgreSQL (hosted) | RDS PostgreSQL 16 (private VPC) |
| Auth (GoTrue) | Cognito User Pools |
| Storage (S3-backed) | Direct S3 with signed URLs |
| Realtime (WebSocket) | React Query polling (5s interval) |
| Row Level Security | Application-layer authorization middleware |
| `supabase-js` client | Custom `QueryBuilder` class + `pg` driver |

---

## What Changed

### Phase 1: Infrastructure (CloudFormation Templates)

**New files created:**

| File | Purpose |
|------|---------|
| `infrastructure/aws/rds.yaml` | RDS PostgreSQL 16 with encryption, auto-scaling, private subnet placement |
| `infrastructure/aws/cognito.yaml` | User Pool with 2 app clients (admin, distributor) and 5 groups |
| `infrastructure/aws/storage-buckets.yaml` | 4 S3 buckets: KYC docs, commission PDFs, reconciliation photos, ML models |

**Files modified:**

| File | Change |
|------|--------|
| `infrastructure/aws/secrets-manager.yaml` | Replaced `SupabaseSecret` with `DatabaseSecret` (`{env}/lynia/database`) |
| `template.yaml` | Removed `SupabaseUrl`/`SupabaseServiceRoleKey` params; added `DB_SECRET_NAME`, `CognitoUserPoolArn`; made VPC default-on |
| `samconfig.toml` | Already clean (no Supabase references) |

---

### Phase 2: Database Schema

**New files created:**

| File | Purpose |
|------|---------|
| `database/migrations/aws/000_pre_migration.sql` | Creates `auth` schema stubs for migration compatibility |
| `database/migrations/aws/018_remove_rls_for_aws.sql` | Removes all RLS policies and drops `auth` schema |
| `database/deploy-to-rds.sh` | Deployment script: runs 000 -> 001-017 -> 018 in order |

---

### Phase 3: Backend Services (~30 files)

**New shared clients created:**

| File | Purpose |
|------|---------|
| `services/shared/clients/database.ts` | `QueryBuilder` class with Supabase-compatible chaining API + `query()`/`queryOne()` raw SQL helpers |
| `services/shared/clients/storage.ts` | S3 client: `uploadFile()`, `getSignedDownloadUrl()`, `getSignedUploadUrl()`, `deleteFile()` |
| `services/shared/middleware/authorization.ts` | `getAuthContext()`, `requireRole()`, `isAdminOrManager()` — replaces RLS |
| `services/shared/utils/secrets.ts` | Secrets Manager fetch + cache |

**Service files migrated (30 files):**

Each file had the same pattern applied:
- `import { getSupabaseClient } from '../../shared/clients/supabase'` -> `import { db } from '../../shared/clients/database'`
- `const supabase = getSupabaseClient()` -> removed (use `db` directly)
- `await supabase.from(...).select(...)` -> `await db.from(...).select(...).execute()`
- `.select('*', { count: 'exact', head: true })` -> `.select('*').count().execute()`
- `supabase.rpc('name', params)` -> `query('SQL', [params])`

| Service | Files Migrated |
|---------|---------------|
| scoring-service | `src/index.ts`, `src/alternative-data.ts`, `src/ml-pipeline.ts` |
| whatsapp-service | `src/index.ts`, `src/error-handler.ts`, `src/i18n.ts`, `src/loan-commands.ts`, `src/onboarding.ts` |
| kyc-service | `src/index.ts` |
| payment-service | `src/payment-service.ts`, `src/innbucks-provider.ts`, `src/payment-analytics.ts`, `src/restructuring-service.ts` |
| lock-service | `src/index.ts`, `src/device-monitoring.ts`, `src/handover-service.ts`, `src/lock-management-service.ts`, `src/repossession-service.ts` |
| notification-service | `src/index.ts`, `src/reminder-scheduler.ts`, `src/support-ticketing.ts` |
| shared | `analytics/analytics-service.ts`, `analytics/data-export.ts`, `data-privacy.ts`, `fraud-detection.ts`, `referral-program.ts`, `regulatory-reporting.ts`, `utils/auth.ts` |

**Dependencies updated:**
- Removed `@supabase/supabase-js` from all service `package.json` files
- Added `pg` + `@types/pg` to `services/shared/package.json`

---

### Phase 4: Frontend Apps

#### Admin Portal (`frontend/admin-portal/`)

| File | Change |
|------|--------|
| `src/lib/auth/cognito.ts` | **New** - Cognito User Pool client setup |
| `src/lib/auth/context.tsx` | Rewritten for Cognito sign-in/sign-out/session |
| `src/middleware.ts` | Updated to check Cognito session |
| `src/components/layout/auth-provider.tsx` | Uses Cognito auth state |
| `src/lib/api/client.ts` | Gets JWT from Cognito session |
| `src/lib/hooks/useKYCReview.ts` | Replaced Supabase realtime with react-query polling |
| `src/test/mocks/customers.ts` | URLs updated to S3 pattern |
| `.env.example`, `.env.local.example` | Cognito vars instead of Supabase |

**Deleted:** `src/lib/supabase/` (entire directory - client.ts, server.ts, middleware.ts)

**Dependencies:**
- Removed: `@supabase/supabase-js`, `@supabase/ssr`
- Added: `amazon-cognito-identity-js`

#### Distributor Dashboard (`frontend/distributor-dashboard/`)

Same pattern as admin portal:
| File | Change |
|------|--------|
| `src/lib/auth/cognito.ts` | **New** - Cognito client |
| `src/components/layout/auth-provider.tsx` | Cognito auth |
| `.env.local.example` | Cognito vars |

**Deleted:** `src/lib/supabase/` (entire directory)

#### Landing Page (`landing-page/frontend/`)

| File | Change |
|------|--------|
| `lib/api.ts` | **Renamed** from `lib/supabase.ts` (content already used fetch API, no Supabase client) |
| `app/api/waitlist/route.ts` | Import path updated |
| `app/api/contact/route.ts` | Import path updated |
| `app/api/partnership/route.ts` | Import path updated |

---

### Phase 5: Cleanup

**Files deleted:**
- `services/shared/clients/supabase.ts` — Old Supabase client
- `services/shared/dist/` — Entire stale build artifacts directory (26 files)
- `landing-page/frontend/lib/supabase.ts` — Renamed to `api.ts`
- `frontend/admin-portal/src/lib/supabase/` — Entire directory
- `frontend/distributor-dashboard/src/lib/supabase/` — Entire directory

**Config files updated:**
- `.env.example` (root) — Supabase vars replaced with AWS/RDS/Cognito vars
- `config/parameters-staging.json` — Removed `SupabaseUrl`, `SupabaseServiceRoleKey`
- `config/parameters-production.json` — Removed `SupabaseUrl`, `SupabaseServiceRoleKey`
- `.github/workflows/deploy.yml` — Removed Supabase secrets from test/staging/production deploys
- `.github/workflows/deploy-frontend.yml` — Replaced Supabase vars with Cognito in build and runtime config

**Documentation:**
- `docs/deployment/AWS-SETUP-GUIDE.md` — **New** comprehensive guide replacing Supabase setup
- `docs/deployment/SUPABASE-SETUP-GUIDE.md` — Archived (header updated)
- `docs/SUPABASE-TO-AWS-MIGRATION-REPORT.md` — This report

---

## Verification

### Zero Supabase References

After migration, `grep -r "supabase" --include="*.ts" --include="*.tsx"` returns no results in:
- `services/` (all 6 microservices + shared)
- `frontend/` (admin-portal + distributor-dashboard)
- `landing-page/`

The only remaining references are in documentation files (this report, archived guide, migration docs).

### QueryBuilder API Compatibility

The custom `QueryBuilder` in `services/shared/clients/database.ts` supports the same chaining API as `@supabase/supabase-js`:

```typescript
// Works identically to Supabase client, with .execute() at the end
const { data, error } = await db
  .from('customers')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(10)
  .execute();
```

Supported methods: `select()`, `insert()`, `update()`, `delete()`, `eq()`, `neq()`, `gt()`, `gte()`, `lt()`, `lte()`, `like()`, `ilike()`, `in()`, `is()`, `single()`, `maybeSingle()`, `order()`, `limit()`, `range()`, `count()`, `textSearch()`.

---

## What Remains (Post-Merge)

These items require AWS account access and cannot be done in code alone:

1. **Deploy CloudFormation stacks** — Run the templates in `infrastructure/aws/` against your AWS account
2. **Run database migrations** — Execute `database/deploy-to-rds.sh` against the new RDS instance
3. **Create initial Cognito users** — At minimum, one admin user
4. **Update GitHub Secrets** — Remove old `SUPABASE_*` secrets, add any new ones if needed
5. **Update GitHub Vars** — Replace `SUPABASE_URL`/`SUPABASE_ANON_KEY` with `COGNITO_USER_POOL_ID`/`COGNITO_CLIENT_ID`/`COGNITO_REGION` in repository variables
6. **Test end-to-end** — Deploy to staging and verify all services connect to RDS/Cognito/S3

---

## Commits

| Hash | Description | Files |
|------|-------------|-------|
| `64b7136` | feat: replace Supabase with native AWS services | 87 files |
| `653d81a` | fix: complete remaining Supabase migration and cleanup | 56 files |
| `be73e90` | chore: update admin-portal .env placeholders | 1 file |
| (this commit) | docs: add AWS setup guide and migration report | config + docs |
