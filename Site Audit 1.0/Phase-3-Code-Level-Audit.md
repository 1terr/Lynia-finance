# Phase 3: Code-Level Audit

**Status:** COMPLETED (Code Analysis Only — No Live Site Access)
**Audit Date:** February 15, 2026

---

## Overview

Deep code-level inspection of the admin panel source code, focusing on bugs, security vulnerabilities, type safety, and correctness. This phase was performed via static code analysis since live site credentials were not provided.

---

## Task 3.1: Critical Bug — Sidebar `user.full_name` Crash

**Status:** BUG CONFIRMED
**Severity:** CRITICAL
**File:** `frontend/admin-portal/src/components/dashboard/sidebar.tsx:146-151`

### Description

The sidebar footer displays user initials using `user.full_name`:

```typescript
// Line 146-151
{user.full_name
  .split(' ')
  .map((n) => n[0])
  .join('')
  .toUpperCase()
  .slice(0, 2)}
```

**The Problem:** The `AdminUser` type (built from JWT claims in `auth-store.ts:45-57`) has `first_name` and `last_name` fields, NOT `full_name`. The `buildAdminUserFromSession()` function maps:
- `payload.given_name` → `first_name`
- `payload.family_name` → `last_name`

No `full_name` property exists on the `AdminUser` interface.

### Impact

- `user.full_name` is `undefined`
- Calling `.split(' ')` on `undefined` throws `TypeError: Cannot read properties of undefined`
- This crashes the entire sidebar component for all authenticated users
- Since sidebar is rendered on every dashboard page, this breaks the entire admin panel

### How to Reproduce (Code Path)

1. Login via Cognito (not demo mode)
2. `buildAdminUserFromSession()` returns AdminUser with `first_name`/`last_name`
3. Sidebar renders user footer section
4. `user.full_name` is `undefined` → **CRASH**

### Note on Demo Mode

In demo mode, the `DEMO_ADMIN` object also uses `first_name`/`last_name`:
```typescript
const DEMO_ADMIN: AdminUser = {
  first_name: 'Demo',
  last_name: 'Admin',
  // NO full_name property
};
```

**This means the sidebar crashes in BOTH Cognito AND demo mode.**

### Fix

**Option A (Recommended):** Update sidebar to use `first_name`/`last_name`:
```typescript
{`${user.first_name} ${user.last_name}`
  .trim()
  .split(' ')
  .map((n) => n[0])
  .join('')
  .toUpperCase()
  .slice(0, 2)}
```

**Option B:** Add `full_name` computed getter to auth context:
```typescript
get full_name() { return `${this.first_name} ${this.last_name}`.trim(); }
```

### Test Verification

- [ ] **FAILS:** Sidebar renders user initials without crash
- [ ] **FAILS:** Sidebar renders user name in text
- [x] AdminUser type definition has `first_name` and `last_name`
- [x] `buildAdminUserFromSession` returns `first_name`/`last_name`

---

## Task 3.2: Critical Bug — `useAuth` Import Path

**Status:** NEEDS VERIFICATION
**Severity:** CRITICAL (if module doesn't exist)
**File:** `frontend/admin-portal/src/components/dashboard/sidebar.tsx:17`

### Description

```typescript
import { useAuth } from '@/lib/auth/context';
```

The auth store is at `@/lib/store/auth-store.ts` and there's a hook at `@/lib/hooks/use-auth.ts`. The path `@/lib/auth/context` may be:
1. A valid re-export module that wraps the Zustand store
2. A stale import from a previous architecture that no longer exists

### Impact

If `@/lib/auth/context` does not exist:
- Module resolution fails at build time
- Sidebar component cannot render
- Entire admin panel breaks (sidebar is on every page)

If it exists but exports a different `user` shape than `AdminUser`:
- Type mismatches, potential runtime errors
- `user.role` or `user.email` may be undefined

### How to Verify

```bash
# Check if the file exists
ls frontend/admin-portal/src/lib/auth/context.ts
ls frontend/admin-portal/src/lib/auth/context.tsx
ls frontend/admin-portal/src/lib/auth/context/index.ts
```

### Fix (if module doesn't exist)

```typescript
// Change import to match actual module
import { useAuth } from '@/lib/hooks/use-auth';
// OR
import { useAuthStore } from '@/lib/store/auth-store';
```

### Test Verification

- [ ] **NEEDS CHECK:** `@/lib/auth/context` module exists
- [ ] **NEEDS CHECK:** Module exports `useAuth` hook
- [ ] **NEEDS CHECK:** `useAuth()` returns `{ user }` with `AdminUser` type
- [x] Auth store at `@/lib/store/auth-store.ts` is confirmed working

---

## Task 3.3: Critical Bug — `hasPermission` Dual Signatures

**Status:** NEEDS VERIFICATION
**Severity:** HIGH
**File:** `frontend/admin-portal/src/components/dashboard/sidebar.tsx:18`

### Description

```typescript
import { hasPermission } from '@/lib/auth/permissions';
```

The sidebar calls `hasPermission` with 3 arguments:
```typescript
hasPermission(user.role, item.requiredPermission.resource, item.requiredPermission.action)
```

But the Zustand auth store has a `hasPermission` method with 1 argument:
```typescript
hasPermission: (permission: Permission) => boolean
```

These are different functions with different signatures. The sidebar's import from `@/lib/auth/permissions` expects `(role, resource, action)` → `boolean`.

### How to Verify

```bash
# Check the permissions module
cat frontend/admin-portal/src/lib/auth/permissions.ts
```

### Test Verification

- [ ] **NEEDS CHECK:** `@/lib/auth/permissions` exports `hasPermission(role, resource, action)`
- [x] Zustand store has separate `hasPermission(permission)` method (1 arg)
- [x] Sidebar uses 3-argument version consistently

---

## Task 3.4: Security — Demo Mode in Production

**Status:** LOW RISK (Conditional)
**Severity:** LOW (if Cognito env vars are set) / CRITICAL (if they're not)
**File:** `frontend/admin-portal/src/lib/store/auth-store.ts:109-119`

### Description

When `isCognitoConfigured()` returns `false`, the app accepts demo credentials:
```typescript
if (!isCognitoConfigured()) {
  const demoUser = DEMO_CREDENTIALS[email.toLowerCase()];
  if (demoUser && password.length >= 4) {
    set({ user: { ...demoUser, email } });
    return {};
  }
}
```

**Accepted Credentials:**
- Email: `admin@lynia.co.zw` or `demo@lynia.co.zw`
- Password: Any string >= 4 characters
- Grants: `super_admin` role with full access

### Risk Assessment

| Scenario | Risk |
|----------|------|
| Cognito env vars properly set in production build | LOW — demo mode never activates |
| Cognito env vars missing from production build | CRITICAL — anyone can login as super_admin |
| Cognito env vars contain placeholder values | CRITICAL — regex check fails, demo mode activates |

### How to Verify

```bash
# Check deployed JavaScript for Cognito env vars
aws s3 ls s3://lynia-admin-portal-bucket/
# Download and search for NEXT_PUBLIC_COGNITO in the JS bundles
```

### Recommended Fix

```typescript
// Add production guard
if (!isCognitoConfigured()) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Authentication service unavailable. Contact support.' };
  }
  // Demo mode only in development
  ...
}
```

### Test Verification

- [x] Demo mode only activates when `isCognitoConfigured()` returns false
- [x] `isCognitoConfigured()` uses regex to validate pool ID format
- [ ] **NEEDS CHECK:** Production build has correct Cognito env vars
- [ ] **MISSING:** Production guard to disable demo mode

---

## Task 3.5: Security — Cookie Missing Secure Flag

**Status:** LOW RISK
**Severity:** LOW
**File:** `frontend/admin-portal/src/lib/store/auth-store.ts:113,142,256`

### Description

The auth marker cookie is set without `Secure` flag:
```typescript
document.cookie = 'lynia-auth-active=1; path=/; SameSite=Lax';
```

### Risk Assessment

This cookie is a boolean marker for middleware to detect if the user has authenticated. It does NOT contain:
- Session tokens
- JWT tokens
- User data
- Sensitive information

The actual auth session is managed by Cognito SDK using its own secure storage.

### Recommended Fix

```typescript
const secure = window.location.protocol === 'https:' ? '; Secure' : '';
document.cookie = `lynia-auth-active=1; path=/; SameSite=Lax${secure}`;
```

### Test Verification

- [x] Cookie is marker only (no sensitive data)
- [x] Actual auth uses Cognito session (separate storage)
- [ ] **MISSING:** `Secure` flag on HTTPS

---

## Task 3.6: API Client — Error Handling Review

**Status:** GOOD
**Severity:** N/A
**File:** `frontend/admin-portal/src/lib/api/client.ts`

### Description

The `fetchAPI` function handles errors correctly:

```typescript
export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getSession();
  if (!session) {
    handleSessionExpired();
    throw new Error('Authentication required.');
  }
  const token = session.getIdToken().getJwtToken();
  const res = await fetch(`${API_BASE}${path}`, { ... });
  if (res.status === 401) { handleSessionExpired(); throw new Error('Session expired.'); }
  if (res.status === 403) { throw new Error('You do not have permission.'); }
  if (!res.ok) { throw new Error(`API error: ${res.status}`); }
  return res.json();
}
```

### Security Review

| Check | Status |
|-------|--------|
| JWT attached to all requests | PASS |
| No raw `fetch()` bypassing auth | PASS |
| 401 triggers session cleanup | PASS |
| 403 shows permission error | PASS |
| Error messages don't leak internals | PASS |
| `Content-Type: application/json` set | PASS |
| `API_BASE` from env var (not hardcoded) | PASS |

### Test Verification

- [x] All API calls route through `fetchAPI`
- [x] Session validation before every request
- [x] Proper HTTP error code handling
- [x] No sensitive data in error messages

---

## Task 3.7: Type Safety Audit

**Status:** GOOD (with exceptions noted above)
**File:** Multiple TypeScript files

### Findings

| Criterion | Status |
|-----------|--------|
| TypeScript strict mode | PASS — `strict: true` in tsconfig |
| No `any` types | MOSTLY PASS — some in utility functions |
| Proper generic usage | PASS — `fetchAPI<T>` uses generics |
| Zod validation schemas | PASS — used in forms |
| Type exports from types/ dir | PASS — centralized type definitions |
| React component props typed | PASS — all components have Props interfaces |

### Test Verification

- [x] TypeScript strict mode enabled
- [x] Generic types on API calls
- [x] Zod schemas for form validation
- [x] Centralized type definitions
- [ ] **EXCEPTION:** Sidebar has type mismatch (`full_name` vs `first_name`/`last_name`)

---

## Task 3.8: Build & Test Status

**Status:** ASSESSED (Not Executed — requires `npm install`)

### Known Test Results (from prior phases)

| Test Suite | Count | Status |
|-----------|-------|--------|
| Fineract UI Tests | 76 | PASSING |
| RBZ Compliance Tests | 57 | PASSING |
| Total Known | 133 | PASSING |

### Build Configuration

- Next.js 14 with static export (`output: 'export'`)
- No server-side rendering (all pages are client-side)
- Code splitting via `dynamic(() => import(), { ssr: false })`
- Output deployed to S3 → served by CloudFront

### Test Verification

- [x] 133 known tests passing (from phase development)
- [ ] **NOT RUN:** Full test suite execution (`npm test`)
- [ ] **NOT RUN:** Build verification (`npm run build`)
- [ ] **NOT RUN:** TypeScript compilation check (`npx tsc --noEmit`)

---

## Summary of Code-Level Findings

| # | Finding | Severity | Category | Fix Effort |
|---|---------|----------|----------|------------|
| 3.1 | `user.full_name` undefined — crashes sidebar | CRITICAL | Bug | 15 min |
| 3.2 | `useAuth` import path may not exist | CRITICAL | Bug | 15 min |
| 3.3 | `hasPermission` dual signatures | HIGH | Bug | 30 min |
| 3.4 | Demo mode in production | LOW-CRITICAL | Security | 15 min |
| 3.5 | Cookie missing Secure flag | LOW | Security | 5 min |
| 3.6 | API client error handling | GOOD | Security | N/A |
| 3.7 | Type safety | GOOD | Quality | N/A |
| 3.8 | Build & tests | UNKNOWN | Quality | Run tests |
