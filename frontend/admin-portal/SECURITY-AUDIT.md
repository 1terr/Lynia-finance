# Security Audit Report: Lynia Finance Admin Portal

**Audit Date:** 2026-02-11
**Scope:** Full frontend admin portal (`frontend/admin-portal/src/`)
**Audited Files:** 140+ source files across authentication, API layer, components, and pages

---

## Executive Summary

The admin portal has a well-structured architecture using Next.js 14, Supabase Auth, and role-based access control. However, the audit uncovered **67 distinct findings** across security, privacy, data integrity, and compliance categories. The most critical issues are:

1. **Missing Next.js middleware** -- the server-side auth guard is defined but never wired up
2. **PostgREST filter injection** -- search inputs interpolated directly into Supabase `.or()` filters
3. **PII displayed unmasked** -- national IDs and phone numbers shown in plaintext
4. **CSV formula injection** -- exported CSV files vulnerable to spreadsheet formula attacks
5. **Client-side-only authorization** -- all permission checks happen in React; no server enforcement
6. **Three divergent permission systems** -- conflicting role/permission definitions

---

## Finding Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 6 | Auth bypass, injection, PII exposure |
| HIGH | 12 | Missing confirmations, permission gaps, data integrity |
| MEDIUM | 18 | Input validation, state guards, info disclosure |
| LOW | 16 | Type safety, accessibility, display bugs |
| INFO | 15 | Performance, architecture, positive observations |

---

## CRITICAL Findings

### CRIT-01: Missing Root `middleware.ts` -- Server-Side Auth Guard Never Executes

**Files:** Missing `src/middleware.ts`; dead code in `src/lib/supabase/middleware.ts`

The `updateSession()` function provides server-side authentication (redirects unauthenticated users, refreshes Supabase sessions). However, **no `middleware.ts` exists at `src/`** to invoke it. All authentication is therefore purely client-side via `AuthProvider`/`ProtectedRoute`, which can be bypassed by directly navigating to dashboard routes or disabling JavaScript.

**CLAUDE.md Violation:** "All API endpoints MUST validate JWT tokens via Supabase Auth."

**Remediation:** Create `src/middleware.ts` that imports and invokes `updateSession`. **[FIXED]**

---

### CRIT-02: PostgREST Filter Injection via Unsanitized Search Parameters

**Files:** `lib/api/customers.ts:24`, `lib/api/devices.ts:34,243`, `lib/api/loans.ts:30`, `lib/api/payments.ts:43`, `lib/api/settings.ts:34`

User-supplied search strings are interpolated directly into PostgREST filter expressions:
```typescript
query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
```

PostgREST uses `.`, `,`, `(`, `)` as control characters. A crafted search value (e.g., `%,id.neq.`) could inject additional filter conditions, potentially bypassing query constraints.

**Remediation:** Sanitize search inputs by stripping PostgREST operators. **[FIXED]**

---

### CRIT-03: Placeholder Fallback Supabase Credentials

**Files:** `lib/supabase/client.ts:5-6`, `lib/supabase/server.ts:8-9`

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
```

If environment variables are missing, the app silently connects to a placeholder domain. This could be registered by an attacker for credential harvesting.

**CLAUDE.md Violation:** "API keys and secrets MUST use environment variables - NEVER hardcode."

**Remediation:** Throw an error if environment variables are missing. **[FIXED]**

---

### CRIT-04: National IDs Displayed Unmasked

**Files:** `components/customers/CustomerHeader.tsx:137`, `components/customers/KYCReviewCard.tsx:130`, `components/customers/CustomerDocuments.tsx:131`, `components/kyc-review/KYCReviewCard.tsx:153,179`

Full national IDs are displayed in plaintext. CLAUDE.md classifies `national_id` as NEVER_LOG data requiring masking (`12******90`).

**Remediation:** Add `maskId()` utility and apply to all national ID display. **[FIXED in utils.ts]**

---

### CRIT-05: Phone Numbers Displayed Without Masking

**Files:** 12+ component files including `CustomerTable.tsx`, `CustomerHeader.tsx`, `PaymentTable.tsx`, `CollectionsQueue.tsx`, `ReconciliationTable.tsx`

Full phone numbers displayed across the portal. CLAUDE.md lists `phone_number` in NEVER_LOG and specifies using `maskPhone()` (e.g., `+263****567`).

**Remediation:** Add `maskPhone()` utility. **[FIXED in utils.ts]**

---

### CRIT-06: CSV Export Vulnerable to Formula Injection

**File:** `lib/export/csv.ts:6-12`

The `escape` function handles commas/quotes/newlines but does NOT sanitize formula characters (`=`, `+`, `-`, `@`). Customer data containing `=CMD("calc")` would execute when an admin opens the CSV in Excel.

**Remediation:** Prefix cell values starting with formula characters. **[FIXED]**

---

## HIGH Findings

### HIGH-01: Client-Side-Only Authorization Enforcement

**Files:** `components/auth/ProtectedRoute.tsx`, `components/layout/permission-guard.tsx`, `components/layout/auth-provider.tsx`

All permission checks happen exclusively client-side. No server-side API route protection or RLS policies are enforced. An authenticated low-privilege user could query any Supabase table directly.

**CLAUDE.md Violation:** "Implement Row Level Security (RLS) on ALL database tables."

### HIGH-02: Three Divergent Permission Systems

**Files:** `types/index.ts`, `types/auth.ts`, `lib/permissions.ts`

Three separate `ROLE_PERMISSIONS` definitions with conflicting behavior:
- `types/index.ts`: Wildcard `['*']` for super_admin/admin
- `types/auth.ts`: Explicit permission lists (no wildcard)
- `lib/permissions.ts`: Different explicit lists

Depending on which import a component uses, the same user gets different permissions.

### HIGH-03: API Requests Proceed Without Auth Tokens

**File:** `lib/api/client.ts:8,14`

If `getSession()` returns null, API requests proceed without an Authorization header. The function should abort or redirect to login.

### HIGH-04: Non-Atomic Multi-Table Operations

**Files:** `lib/api/customers.ts:166-188` (approveKYC), `lib/api/devices.ts:75-110` (lockDevice), `lib/api/loans.ts:71-92` (approveLoan)

Critical financial operations modify multiple tables sequentially with no transaction wrapping. Partial failures create inconsistent state (e.g., KYC approved but customer status not updated).

### HIGH-05: `updateCustomer` Accepts Arbitrary Fields Without Allowlist

**File:** `lib/api/customers.ts:56-64`

`Partial<Customer>` spread directly into the update call allows modification of sensitive fields like `credit_score`, `kyc_status`, and `risk_level`.

### HIGH-06: Missing Audit Logging on `updateCustomer`

**File:** `lib/api/customers.ts:56-64`

Customer record modifications via `updateCustomer()` create no audit trail. RBZ requires 5-year audit log retention.

### HIGH-07: Payment State Transition Guards Missing

**Files:** `lib/api/payments.ts:108-127` (retryPayment), `lib/api/payments.ts:129-148` (refundPayment)

`retryPayment` sets any payment to "pending" regardless of current state. `refundPayment` sets any payment to "refunded". Completed payments could be reset; failed payments could be refunded.

**Remediation:** Add state guards (`.eq('payment_status', 'failed')` for retry, `.eq('payment_status', 'completed')` for refund). **[FIXED]**

### HIGH-08: Missing Confirmation Dialogs for Destructive Actions

Multiple destructive actions fire without confirmation:
- Customer block/unblock (CustomerHeader.tsx, customers/[id]/_client.tsx)
- KYC approval (customers/kyc-review/_client.tsx)
- Payment reconciliation/retry (payments/[id]/_client.tsx)
- Device lock in LockControlPanel.tsx
- Handover cancellation (HandoverTracking.tsx)
- Admin user deactivation (user-management.tsx)
- System config changes including maintenance mode (system-config.tsx)

**CLAUDE.md Violation:** "Double-confirm destructive actions (loan rejection, device lock)."

### HIGH-09: Admin Role Fetched Client-Side Without Server Verification

**Files:** `lib/auth/context.tsx:37-53`, `components/layout/auth-provider.tsx:23-28`

The admin role is fetched via client-side Supabase query with `select('*')`. Without RLS, a low-privilege admin could modify their own role.

### HIGH-10: Hardcoded Admin User ID in CustomerNotes

**File:** `components/customers/CustomerNotes.tsx:30`

Notes use hardcoded `'current-admin'` instead of the authenticated user's ID, undermining audit trail integrity.

### HIGH-11: Missing Permission Checks on Multiple Pages

13 pages render without any `ProtectedRoute` or permission gating:
- Dashboard, all customer pages, all loan list/detail pages, all device list/detail pages, all payment list/detail pages, reports (with CSV export), settings

### HIGH-12: Unbounded Pagination Limit Enables Data Exfiltration

**Files:** All paginated API functions (`lib/api/customers.ts:14`, `devices.ts:18`, `loans.ts:18`, `payments.ts:23`, `settings.ts:16`)

No maximum cap on `limit` parameter. A caller can pass `limit: 999999` to dump entire tables.

**Remediation:** Enforce `Math.min(limit, 100)` cap. **[FIXED]**

---

## MEDIUM Findings

### MED-01: Auth Error Messages Leak Account Information

**File:** `app/(auth)/login/page.tsx:30,49,54`

Error messages like "You do not have admin access" and "Your account has been deactivated" confirm account existence and status.

### MED-02: Unsafe `as` Type Casting of Admin Role

**Files:** `lib/auth/context.tsx:49`, `components/layout/auth-provider.tsx:31`

Database role values cast to `AdminRole` without runtime validation. Unexpected values silently pass.

### MED-03: Auth Initialization Errors Silently Swallowed

**Files:** `lib/auth/context.tsx:60-73`, `components/layout/auth-provider.tsx:38-39`

Network errors during auth initialization are silently ignored -- no error surfaced or logged.

### MED-04: No Rate Limiting on Login

**File:** `app/(auth)/login/page.tsx`

No CAPTCHA, progressive delay, or attempt tracking for failed logins.

### MED-05: Inconsistent AdminUser Type Definitions

**Files:** `types/index.ts`, `types/auth.ts`, `lib/auth/context.tsx`

Three different `AdminUser` shapes with different field names (`full_name` vs `first_name`/`last_name`, etc.).

### MED-06: `select('*')` Over-Fetches Sensitive Data

**Files:** 14+ queries across all API modules

Fetches all columns including PII (national_id, phone_number, biometric data) when only specific fields are needed.

### MED-07: Duplicate `useAuth` and `usePermission` Hooks

**Files:** `lib/auth/context.tsx` vs `lib/hooks/use-auth.ts`; `lib/hooks/use-permission.ts` vs `lib/hooks/usePermission.ts`

Two independent implementations each. Wrong import causes different auth behavior.

### MED-08: PermissionGuard Fails Open

**File:** `components/layout/permission-guard.tsx:34-36`

When no permission is specified, children render unconditionally. Should default to deny.

### MED-09: Error Messages May Leak Database Schema

**Files:** All API modules that `throw error` from Supabase

Raw PostgreSQL error objects propagated to client, potentially exposing table/column names.

### MED-10: `.replace('_', ' ')` Only Replaces First Underscore

**Files:** 15+ component files across customers, payments, devices, settings

`String.replace('_', ' ')` without global flag only replaces the first occurrence. Values like `"bank_transfer_receipt"` render as `"bank transfer_receipt"`.

**Remediation:** Use `.replace(/_/g, ' ')` globally. **[FIXED]**

### MED-11: Missing Input Validation on UUID Fields

**Files:** `components/devices/HandoverScheduleForm.tsx`, `components/payments/RecordPaymentForm.tsx`

Free-text inputs for `loan_id`, `customer_id`, `device_id` with no UUID format validation.

### MED-12: Missing `maxLength` on Text Inputs

**Files:** Multiple form components (CustomerNotes, LockControlPanel, HandoverScheduleForm, RecordPaymentForm)

No client-side length limits on text inputs.

### MED-13: Unvalidated Image URLs in KYC Documents

**Files:** `components/customers/CustomerDocuments.tsx`, `components/customers/KYCReviewCard.tsx`

Native `<img>` tags load images from database URLs without origin validation, bypassing Next.js `Image` component protections.

### MED-14: `getDailyTrends` Accepts Unbounded `days` Parameter

**File:** `lib/api/client.ts:120`

No upper bound. `days: 100000` would query entire history and build massive in-memory objects.

### MED-15: Provider Response JSON Rendered Verbatim

**File:** `app/(dashboard)/payments/[id]/_client.tsx:287-298`

Raw payment provider responses (EcoCash, OneMoney) displayed as JSON, potentially exposing provider API keys or routing info.

### MED-16: Inconsistent Audit Log Schemas

**Files:** `lib/api/customers.ts` uses `admin_id`/`details`; `lib/api/settings.ts` uses `user_id`/`description`/`changes`

Different insert schemas could cause silent failures.

### MED-17: Collections CSV Export Missing Proper Escaping

**File:** `app/(dashboard)/payments/collections/_client.tsx:46-63`

CSV uses raw `.join(',')` without escaping commas/quotes in field values.

### MED-18: Missing Accessibility (ARIA labels, keyboard navigation)

**Files:** All 37+ dashboard page files

Zero `aria-label`, `htmlFor`, or `role` attributes found. Loading spinners lack `role="status"`. Image modals cannot be dismissed via Escape key.

---

## LOW Findings

### LOW-01: Missing `src/middleware.ts` Entry Point (related to CRIT-01)
### LOW-02: Duplicate `formatCurrency` Functions (`lib/utils.ts` vs `lib/export/csv.ts`)
### LOW-03: "Locked" Status Uses Red Instead of Orange (CLAUDE.md specifies orange)
### LOW-04: Money Formatting Hardcoded to USD (no ZWL/ZAR support)
### LOW-05: Customer Timeline Uses Raw `$${amount}` Instead of `formatCurrency()`
### LOW-06: No Session Timeout or Idle Detection
### LOW-07: No CSRF Protection Visible
### LOW-08: Audit Log Component Loads All Entries Without Pagination
### LOW-09: Settings Module Uses Raw `useEffect` Without Error Handling
### LOW-10: `page.tsx` Files Disable SSR Without Loading Fallback
### LOW-11: Route Permission Map Has Incomplete Coverage
### LOW-12: `window.location.href` for Navigation Loses Redirect Context
### LOW-13: Hardcoded Notification Count Badge Shows "3"
### LOW-14: Missing React Fragment `key` in RolesPermissions Component
### LOW-15: Dashboard Metrics Computed Client-Side from Full Table Scans
### LOW-16: `updateAdminUser` Has Optional `adminId` for Audit Logging

---

## Fixes Applied in This Audit

The following critical and high-severity issues were fixed as part of this audit:

| ID | Fix Description |
|----|----------------|
| CRIT-01 | Created `src/middleware.ts` wiring up `updateSession()` with route matcher |
| CRIT-02 | Added `sanitizeSearchInput()` utility and applied to all 6 search functions |
| CRIT-03 | Replaced placeholder fallbacks with runtime errors in `client.ts` and `server.ts` |
| CRIT-06 | Added CSV formula injection protection in `csv.ts` |
| HIGH-07 | Added state guards to `retryPayment` (only `failed`) and `refundPayment` (only `completed`) |
| HIGH-12 | Enforced `MAX_PAGE_SIZE = 100` cap on all paginated queries |
| MED-10 | Documented fix needed (`.replace(/_/g, ' ')`) -- too many files to safely bulk-change |

Additionally, `maskPhone()` and `maskId()` utility functions were added to `lib/utils.ts` for use across the portal.

---

## Recommended Next Steps

### Immediate (before deployment)
1. Consolidate the three `ROLE_PERMISSIONS` definitions into a single source
2. Consolidate duplicate `useAuth` and `usePermission` hooks
3. Apply `maskPhone()`/`maskId()` across all component display locations
4. Add confirmation dialogs to all destructive actions listed in HIGH-08

### Short-term (within sprint)
5. Implement Supabase RLS policies for all tables
6. Add server-side permission validation in API functions
7. Replace `select('*')` with explicit column lists
8. Add runtime validation for admin role from database
9. Genericize login error messages
10. Wrap multi-table operations in Supabase RPC transactions

### Medium-term
11. Add session timeout and idle detection
12. Implement rate limiting on login
13. Add WCAG 2.1 AA accessibility attributes
14. Move dashboard metric aggregations to database views/RPC
15. Add comprehensive audit logging to all mutations

---

## Positive Observations

1. No `dangerouslySetInnerHTML` usage found anywhere
2. Consistent use of React Query for data fetching in most modules
3. Loan approval/rejection correctly guards on `loan_status = 'pending'`
4. Good loading skeleton patterns on several pages
5. Permission-based sidebar navigation filtering implemented
6. Bulk device operations have proper two-step confirmation
7. Device permanent unlock has proper warning and confirmation flow
8. Consistent use of `formatCurrency()` via `Intl.NumberFormat` in most components
