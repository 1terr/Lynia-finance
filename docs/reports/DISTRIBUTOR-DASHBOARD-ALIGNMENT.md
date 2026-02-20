# Distributor Dashboard Alignment & Deployment Report

**Date:** February 20, 2026
**Scope:** Audit distributor dashboard alignment with admin portal and Fineract backend, remediate inconsistencies, deploy to production

---

## Executive Summary

A full audit of the distributor dashboard revealed **9 inconsistencies** between the distributor dashboard, admin portal, and Fineract backend. All 9 were resolved across 8 remediation tasks, plus a critical IAM bug was discovered and fixed during deployment. The system is now deployed to production with all Lambda functions, frontend apps, and API Gateway live.

---

## Audit Findings

### Inconsistencies Identified

| # | Area | Issue | Severity |
|---|------|-------|----------|
| 1 | Device Status Enum | Distributor had 6 values vs admin's 9 (`repossessed`, `damaged`, `lost`, `written_off` missing) | High |
| 2 | Lock Status Enum | Missing `emergency_unlocked` status | Medium |
| 3 | Commission Calculation | Based on device price instead of loan amount | High |
| 4 | Payment Methods | Distributor included `innbucks`/`onewallet` not in shared enums | Medium |
| 5 | Handover Status Enum | `device_inspected` existed in DB but not in distributor types | Medium |
| 6 | API Layer | Distributor dashboard used 100% mock data with no real backend | Critical |
| 7 | Env Var Naming | `NEXT_PUBLIC_API_URL` vs admin's `NEXT_PUBLIC_API_BASE_URL` | Low |
| 8 | Handover Wizard | Missing `app_installed`, `app_configured`, `lock_test_passed` fields | High |
| 9 | Backend Service | No Lambda handler for distributor dashboard API routes | Critical |

### Decisions Made

- **Payment methods:** Keep `innbucks`/`onewallet` in distributor UI only (local market needs), shared enums stay as-is
- **Commission base:** Changed from device retail price to loan principal amount
- **Handover status:** Unified to 7-step enum: `initiated` > `identity_verified` > `deposit_verified` > `device_inspected` > `completed` / `failed` / `cancelled`
- **API pattern:** Match admin portal's `fetchAPI` + Cognito JWT pattern with mock fallback for local dev

---

## Remediation Tasks

### Task 1: Database Migration (029)

**File:** `database/migrations/029_unify_distributor_enums.sql`

- Extended `distributors` table with 15 new columns (national_id, user_id, geolocation, commission tracking, KYC status, etc.)
- Created `device_handovers` table with unified status enum and full handover workflow fields (identity verification, app/lock checks, device condition JSONB, photos, signatures)
- Added `loan_amount_usd` to `distributor_commissions` for correct commission base
- All operations use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for idempotency

### Task 2: Commission Calculation Fix

**File:** `services/lock-service/src/handover-service.ts`

Changed commission calculation from:
```
commission = device.retail_price_usd * rate
```
To:
```
commission = loan.principal_amount * rate
```

Also added `loan_amount_usd` field to the commission insert query.

### Task 3: Shared Enum Alignment

**File:** `services/shared/types/enums.ts`

- `DeviceStatus`: Extended from 6 to 9 values (added `repossessed`, `damaged`, `lost`, `written_off`)
- `LockStatus`: Added `emergency_unlocked` state
- Added `DEVICE_STATUSES` array constant
- Added `DEVICE_CONDITION_LABELS` map

### Task 4: Admin Portal Types

**Files:** `frontend/admin-portal/src/lib/api/settings.ts`, `frontend/admin-portal/src/lib/api/client.ts`

- Updated `Permission` type to include `admin_users` permission
- Updated `RolePermissions` to grant `admin_users` to `super_admin` role

### Task 5: Distributor Service Lambda

**File:** `services/distributor-service/src/index.ts` (new)

Built complete Lambda handler with routes:
- `GET/PATCH /api/v1/distributor/profile` - Distributor profile management
- `GET /api/v1/distributor/stats` - Dashboard statistics (pending handovers, active devices, total commissions)
- `GET /api/v1/distributor/inventory` - Assigned device inventory
- `GET /api/v1/distributor/handovers` - Handover list with status filtering
- `POST /api/v1/distributor/handovers` - Submit new handover
- `POST /api/v1/distributor/handovers/{id}/{action}` - Handover actions (verify-identity, verify-imei, verify-deposit, record-condition, complete)
- `GET /api/v1/distributor/commissions` - Commission history

All routes require `distributor` role via `requireRole(auth, 'distributor')` and verify distributor ownership via Cognito `user_id`.

### Task 6: Real API Client

**File:** `frontend/distributor-dashboard/src/lib/api/distributor.ts` (rewritten)

Replaced 100% mock API with real `fetchAPI` client matching admin portal pattern:
- Cognito JWT authentication via `getSession().getIdToken().getJwtToken()`
- Automatic mock fallback when Cognito is not configured (`!isCognitoConfigured()`)
- Standard error handling with session expiry detection
- API envelope unwrapping (`response.data`)

### Task 7: Env Var Standardization

**File:** `frontend/distributor-dashboard/.env.local.example`

Changed from `NEXT_PUBLIC_API_URL` to `NEXT_PUBLIC_API_BASE_URL` to match admin portal convention.

### Task 8: Handover Wizard Enhancement

**Files modified:**
- `frontend/distributor-dashboard/src/types/distributor.ts` - Added `app_installed`, `app_configured`, `lock_test_passed` to `HandoverData`
- `frontend/distributor-dashboard/src/components/handover/handover-wizard.tsx` - Added initial values, updated step 4 gate logic, passed new props
- `frontend/distributor-dashboard/src/components/handover/step-device-condition.tsx` - Added "App & Lock Setup" section with 3 BoolToggle controls and warning prompts
- `frontend/distributor-dashboard/src/components/handover/step-confirm.tsx` - Added checklist items for app/lock verification

Step 4 now requires: device powers on AND Lynia app installed AND remote lock test passed.

---

## Deployment

### Infrastructure Changes

**File:** `template.yaml`

- Added `DistributorFunction` (AWS::Serverless::Function) with 8 API Gateway events
- IAM policy grants access to Secrets Manager (`lynia/${Environment}/database-*`) and CloudWatch metrics
- esbuild metadata for TypeScript compilation with tree shaking and source maps

### Critical Bug Found & Fixed

**IAM Secrets Manager Policy Mismatch**

During deployment verification, discovered that ALL Lambda functions were returning 500 errors when trying to connect to the database. Root cause:

| Component | Pattern | Example (production) |
|-----------|---------|---------------------|
| IAM Policy (wrong) | `${Environment}/lynia/{service}-*` | `production/lynia/database-*` |
| Actual Secret Name | `lynia/${Environment}/{service}` | `lynia/production/database` |
| DB_SECRET_NAME env var | `lynia/${Environment}/database` | `lynia/production/database` |

The IAM policy and the actual secret name were reversed. Fixed 21 IAM resource ARNs across all Lambda functions (scoring, payment, whatsapp, kyc, lock, notification, form-submission, admin, distributor, investor-reporting, fineract-reconciliation). Fineract secrets (`production/lynia/fineract-*`) were already correct and left unchanged.

**Commit:** `2178490` - `fix: align IAM secret ARNs with actual Secrets Manager naming convention`

### Deployment Status

| Component | Status | Verification |
|-----------|--------|-------------|
| Backend Lambda (12 functions) | Deployed | Stack `UPDATE_COMPLETE` at 14:47 UTC |
| API Gateway | Live | Returns 401/403 for unauthenticated requests |
| Admin Portal (CloudFront) | Deployed | Returns 200 |
| Distributor Dashboard (CloudFront) | Deployed | Returns 200 |
| Database Migration 029 | Pending | RDS in private VPC - needs VPC-based migration runner |

### Production Endpoints

| Service | URL |
|---------|-----|
| API Gateway | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/` |
| Frontend (CloudFront) | `https://d1qwfy2tsdmpe4.cloudfront.net` |

---

## Known Issues

### DB Migration Workflow Cannot Reach Private RDS

The `run-db-migrations.yml` GitHub Actions workflow fails because the RDS instance is in a private VPC subnet (`PubliclyAccessible: False`). Adding a security group ingress rule for the runner's IP is insufficient since there's no internet gateway route to the private subnet.

**Recommended fix:** Create a VPC Lambda function (or ECS task) that runs migrations from within the VPC, invoked by the GitHub Actions workflow via `aws lambda invoke`.

### Staging Stack in UPDATE_ROLLBACK_COMPLETE

The `lynia-finance-staging` CloudFormation stack is in `UPDATE_ROLLBACK_COMPLETE` state from previous failed deploys. Per CLAUDE.md, this state is deployable (previous update rolled back cleanly). The production pipeline skips staging when triggered via `workflow_dispatch` with `environment=production`.

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `database/migrations/029_unify_distributor_enums.sql` | Created | 159 |
| `services/distributor-service/src/index.ts` | Created | ~350 |
| `services/lock-service/src/handover-service.ts` | Modified | Commission calculation |
| `services/shared/types/enums.ts` | Modified | DeviceStatus, LockStatus |
| `frontend/admin-portal/src/lib/api/settings.ts` | Modified | Permission type |
| `frontend/admin-portal/src/lib/api/client.ts` | Modified | RolePermissions |
| `frontend/distributor-dashboard/src/lib/api/distributor.ts` | Rewritten | ~300 |
| `frontend/distributor-dashboard/src/types/distributor.ts` | Modified | HandoverData fields |
| `frontend/distributor-dashboard/src/components/handover/handover-wizard.tsx` | Modified | Step 4 logic |
| `frontend/distributor-dashboard/src/components/handover/step-device-condition.tsx` | Modified | App & Lock section |
| `frontend/distributor-dashboard/src/components/handover/step-confirm.tsx` | Modified | Checklist items |
| `frontend/distributor-dashboard/.env.local.example` | Modified | Env var name |
| `template.yaml` | Modified | DistributorFunction + IAM fix |