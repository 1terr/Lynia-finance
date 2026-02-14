# Phase 11: Frontend Auth Migration - Supabase to Cognito (Fineract Pages)

## Overview

**Objective:** Complete the frontend authentication migration from Supabase Auth to Amazon Cognito on all Fineract pages in the admin portal.

**Status:** Complete
**Date:** 2026-02-14
**Branch:** `claude/migrate-auth-cognito-Fs5XQ`

---

## Pre-Migration State

The core authentication infrastructure had already been migrated from Supabase to Cognito in earlier phases:
- `amazon-cognito-identity-js` v6.3.12 installed
- `CognitoUserPool` configured via environment variables
- `auth-store.ts` using Cognito `authenticateUser()` flow
- `fetchAPI` client extracting JWT from Cognito ID tokens

**However, the Fineract pages had gaps:**
1. No permission-based access guards on any Fineract page routes
2. No role-based visibility controls on sensitive Fineract actions (approve, reject, record payment, trigger reconciliation)
3. No session expiry handling in the API client (expired Cognito tokens caused silent failures)
4. One legacy Supabase comment remaining in frontend code

---

## Changes Made

### 1. Cognito Permission Guards on All 7 Fineract Pages

Each Fineract page route now wraps its content in `<ProtectedRoute>` with the appropriate permission check. Unauthorized roles see the "Access Denied" screen instead of the page content.

| Page | File | Required Permission |
|------|------|-------------------|
| Loan Portfolio | `fineract/loans/page.tsx` | `loans:read` |
| Loan Approval Queue | `fineract/approval/page.tsx` | `loans:approve` |
| GL Accounting | `fineract/accounting/page.tsx` | `payments:read` |
| Overdue Loans | `fineract/overdue/page.tsx` | `loans:read` |
| Loan Products | `fineract/products/page.tsx` | `loans:read` |
| Reconciliation | `fineract/reconciliation/page.tsx` | `payments:reconcile` |
| Loan Detail | `loans/[id]/fineract/page.tsx` | `loans:read` |

### 2. Enhanced fetchAPI Client with Cognito Session Expiry

**File:** `frontend/admin-portal/src/lib/api/client.ts`

- **401 handling:** On HTTP 401 (Cognito token rejected by backend), the client now calls `cognitoSignOut()`, clears the `lynia-auth-active` cookie, and redirects to `/login`
- **403 handling:** On HTTP 403 (insufficient permissions), throws a descriptive permission error without clearing the session
- **Import added:** `signOut as cognitoSignOut` from `@/lib/auth/cognito`

### 3. Role-Based UI Controls on Fineract Actions

Sensitive mutation actions are now gated by Cognito-backed permissions:

| Component | Action | Permission Check |
|-----------|--------|-----------------|
| `fineract-approval-page.tsx` | Approve button | `loans:approve` |
| `fineract-approval-page.tsx` | Reject button | `loans:reject` |
| `fineract-loan-detail-page.tsx` | Record Payment button | `payments:reconcile` |
| `reconciliation-dashboard.tsx` | Run Reconciliation button | `payments:reconcile` |

Each component imports `useAuthStore` and calls `hasPermission()` which checks the user's Cognito JWT claims against the `ROLE_PERMISSIONS` mapping.

### 4. Supabase Reference Cleanup

**File:** `frontend/admin-portal/src/lib/hooks/useKYCReview.ts`

- Replaced comment `// Poll every 30 seconds instead of Supabase realtime subscription` with `// Poll every 30 seconds (Cognito-authenticated via fetchAPI)`

### 5. Cognito Auth Integration Tests

**New file:** `frontend/admin-portal/src/__tests__/fineract/fineract-cognito-auth.test.ts`

Added 5 test cases covering:
- Cognito JWT token injection into API requests
- Rejection when Cognito session is null
- 401 response triggers session cleanup and redirect to login
- 403 response throws permission error without session cleanup
- Standard API errors (500) propagate without affecting auth state

---

## Files Modified

```
frontend/admin-portal/src/
  app/(dashboard)/fineract/loans/page.tsx          # Added ProtectedRoute guard
  app/(dashboard)/fineract/approval/page.tsx       # Added ProtectedRoute guard
  app/(dashboard)/fineract/accounting/page.tsx     # Added ProtectedRoute guard
  app/(dashboard)/fineract/overdue/page.tsx        # Added ProtectedRoute guard
  app/(dashboard)/fineract/products/page.tsx       # Added ProtectedRoute guard
  app/(dashboard)/fineract/reconciliation/page.tsx # Added ProtectedRoute guard
  app/(dashboard)/loans/[id]/fineract/page.tsx     # Added ProtectedRoute guard
  components/fineract/fineract-approval-page.tsx   # Added role-based action controls
  components/fineract/fineract-loan-detail-page.tsx# Added role-based payment control
  components/fineract/reconciliation-dashboard.tsx # Added role-based reconciliation control
  lib/api/client.ts                                # Enhanced with 401/403 handling
  lib/hooks/useKYCReview.ts                        # Cleaned up Supabase comment
```

## Files Created

```
frontend/admin-portal/src/
  __tests__/fineract/fineract-cognito-auth.test.ts # Cognito auth integration tests
phase-11/
  PHASE-11-AUTH-MIGRATION-REPORT.md                # This report
```

---

## Authentication Flow (Post-Migration)

```
User visits /fineract/approval
  |
  v
DashboardLayout renders AuthProvider
  |
  v
AuthProvider calls initialize() -> getSession() from cognito.ts
  |
  v
Cognito validates session (CognitoUserPool.getCurrentUser().getSession())
  |
  v  [Session valid]             [No session]
  |                                |
  v                                v
ProtectedRoute checks             Redirect to /login
  loans:approve permission
  |
  v  [Has permission]            [No permission]
  |                                |
  v                                v
FineractApprovalPage renders      AccessDenied screen
  |
  v
useQuery calls getFineractLoans() -> fetchAPI()
  |
  v
fetchAPI() extracts JWT: session.getIdToken().getJwtToken()
  |
  v
API request with Authorization: Bearer <cognito-jwt>
  |
  v  [200 OK]    [401 Unauthorized]    [403 Forbidden]
  |                |                      |
  v                v                      v
Data renders     cognitoSignOut()       "Permission denied" error
                 Redirect to /login
```

---

## Permission Matrix for Fineract Pages

| Role | Loans | Approval | Accounting | Overdue | Products | Reconciliation | Record Payment |
|------|-------|----------|------------|---------|----------|---------------|---------------|
| super_admin | R | R/A/Rej | R | R | R | R/Trigger | R/Record |
| admin | R | R/A/Rej | R | R | R | R/Trigger | R/Record |
| operations_manager | R | R/A/Rej | R | R | R | R/Trigger | R/Record |
| finance_team | R | R (view only) | R | R | R | R/Trigger | R/Record |
| customer_support | R | Denied | Denied | R | R | Denied | Denied |
| kyc_reviewer | Denied | Denied | Denied | Denied | Denied | Denied | Denied |
| inventory_manager | Denied | Denied | Denied | Denied | Denied | Denied | Denied |
| reports_viewer | Denied | Denied | Denied | Denied | Denied | Denied | Denied |

R = Read, A = Approve, Rej = Reject, Trigger = Trigger reconciliation, Record = Record payment

---

## Verification Checklist

- [x] All 7 Fineract pages wrapped with `ProtectedRoute` permission guards
- [x] `fetchAPI` handles Cognito 401 with session cleanup and redirect
- [x] `fetchAPI` handles 403 with descriptive permission error
- [x] Approve/Reject buttons hidden for users without `loans:approve`/`loans:reject`
- [x] Record Payment button hidden for users without `payments:reconcile`
- [x] Run Reconciliation button hidden for users without `payments:reconcile`
- [x] No remaining Supabase references in frontend source code
- [x] Cognito auth integration tests added
- [x] All Fineract API functions use Cognito-authenticated `fetchAPI`
- [x] Zero Supabase client library imports in `package.json`
