# Action Plan: Prioritized Remediation

**Audit Date:** February 15, 2026
**Total Actions:** 19
**Estimated Total Effort:** 3-5 days (one developer)

---

## Overview

This action plan prioritizes all audit findings from most critical to least critical, with specific file paths, code changes, and verification steps for each action.

---

## Priority 1: Show-Stoppers (Fix Immediately)

These blockers prevent the admin panel from functioning at all. Fix before any user testing.

---

### Action 1.1: Fix Sidebar `user.full_name` Crash

**Blocker:** B3
**Effort:** 15 minutes
**File:** `frontend/admin-portal/src/components/dashboard/sidebar.tsx`

**Steps:**
1. Open `sidebar.tsx`
2. Replace line 146-151 (avatar initials):
   ```typescript
   // FROM:
   {user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}

   // TO:
   {`${user.first_name} ${user.last_name}`
     .trim()
     .split(' ')
     .filter(Boolean)
     .map((n) => n[0])
     .join('')
     .toUpperCase()
     .slice(0, 2)}
   ```
3. Replace line 155 (display name):
   ```typescript
   // FROM:
   {user.full_name}

   // TO:
   {`${user.first_name} ${user.last_name}`.trim()}
   ```

**Verification:**
- [ ] Sidebar renders without crash
- [ ] User initials display correctly (e.g., "DA" for "Demo Admin")
- [ ] Full name displays in footer text

---

### Action 1.2: Verify `useAuth` Import Path

**Blocker:** B6
**Effort:** 15 minutes
**File:** `frontend/admin-portal/src/components/dashboard/sidebar.tsx:17`

**Steps:**
1. Check if `src/lib/auth/context.ts` (or `.tsx` or `index.ts`) exists
2. If it exists: verify it exports `useAuth` returning `{ user: AdminUser }`
3. If it doesn't exist: update import:
   ```typescript
   // FROM:
   import { useAuth } from '@/lib/auth/context';

   // TO:
   import { useAuth } from '@/lib/hooks/use-auth';
   ```

**Verification:**
- [ ] Import resolves correctly
- [ ] TypeScript compilation passes
- [ ] `useAuth()` returns `{ user }` with correct type

---

### Action 1.3: Verify Cognito Env Vars in Production Build

**Blocker:** B5
**Effort:** 30 minutes

**Steps:**
1. Check S3 bucket for deployed JavaScript bundles
2. Search for `NEXT_PUBLIC_COGNITO_USER_POOL_ID` value in bundle
3. Verify it matches a valid Cognito pool ID (format: `<region>_<alphanumeric>`)
4. If missing: rebuild with correct env vars and redeploy

**Verification:**
- [ ] Cognito pool ID found in deployed JS bundle
- [ ] Pool ID format matches regex: `/^[\w-]+_[0-9a-zA-Z]+$/`
- [ ] Client ID length > 10 characters
- [ ] Login page does NOT show "Demo credentials" box in production

---

### Action 1.4: Add Fineract + Settings to Sidebar Navigation

**Blocker:** B2
**Effort:** 1 hour
**File:** `frontend/admin-portal/src/components/dashboard/sidebar.tsx`

**Steps:**
1. Add `Landmark` and `Settings` icon imports:
   ```typescript
   import { ..., Landmark, Settings as SettingsIcon } from 'lucide-react';
   ```
2. Add Fineract section to `NAVIGATION` array:
   ```typescript
   {
     label: 'Fineract',
     href: '/fineract/loans',
     icon: Landmark,
     requiredPermission: { resource: 'loans', action: 'read' },
     children: [
       { label: 'Loan Portfolio', href: '/fineract/loans' },
       { label: 'Approval Queue', href: '/fineract/approval' },
       { label: 'GL Accounting', href: '/fineract/accounting' },
       { label: 'Products', href: '/fineract/products' },
       { label: 'Overdue Analysis', href: '/fineract/overdue' },
       { label: 'Reconciliation', href: '/fineract/reconciliation' },
     ],
   },
   ```
3. Add Settings item:
   ```typescript
   {
     label: 'Settings',
     href: '/settings',
     icon: SettingsIcon,
     requiredPermission: { resource: 'settings', action: 'read' },
   },
   ```
4. Add Reconciliation to Payments children:
   ```typescript
   // Under Payments children:
   { label: 'Reconciliation', href: '/payments/reconciliation' },
   ```

**Verification:**
- [ ] Sidebar shows 9 top-level items (was 6)
- [ ] Fineract section expands to show 6 sub-items
- [ ] Settings appears at bottom of nav
- [ ] Payments shows 3 sub-items (was 2)
- [ ] All new links navigate to correct pages

---

## Priority 2: Critical Journey Blockers (Fix Before User Testing)

---

### Action 2.1: Deploy Fineract ECS Cluster

**Blocker:** B1
**Effort:** 2-4 hours

**Steps:**
1. Configure AWS CLI with appropriate credentials
2. Run deployment script:
   ```bash
   cd phase-6-fineract-integration/infrastructure
   bash deploy-fineract.sh --stack-name lynia-fineract --env production
   ```
3. Wait for ECS service to stabilize (~5 minutes)
4. Initialize Fineract:
   ```bash
   node phase-6-fineract-integration/scripts/initialize-fineract.js
   ```
5. Update Lambda env vars with Fineract ALB URL
6. Verify health endpoint

**Verification:**
- [ ] ECS service running with healthy tasks
- [ ] ALB health check passing
- [ ] `GET /fineract-provider/api/v1/authentication` returns 200
- [ ] Admin portal Fineract pages load data
- [ ] GL accounts display correctly
- [ ] Loan products show 3-tier model

---

### Action 2.2: Run Database Seed Scripts

**Blocker:** B4
**Effort:** 1 hour

**Steps:**
1. Verify RDS connection
2. Run migrations if not already applied:
   ```bash
   bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
   ```
3. Run seed data:
   ```bash
   node scripts/create-demo-data.js --connection-string "$RDS_CONNECTION_STRING"
   ```

**Verification:**
- [ ] Customer list shows test customers
- [ ] Loan list shows test loans in various statuses
- [ ] Payment list shows test payments
- [ ] Device list shows test devices
- [ ] Dashboard KPIs show non-zero values
- [ ] Reports generate with actual data

---

### Action 2.3: End-to-End Login Test

**Blocker:** Validation
**Effort:** 2 hours

**Steps:**
1. Navigate to `https://admin.lyniafinance.com/login`
2. Verify Cognito login (not demo mode)
3. Test NEW_PASSWORD_REQUIRED flow (if applicable)
4. Test MFA flow (if enabled)
5. Verify dashboard loads with data
6. Navigate through all sidebar items
7. Test one CRUD operation per module
8. Test logout and session timeout

**Verification:**
- [ ] Login succeeds with Cognito credentials
- [ ] Dashboard displays KPIs and charts
- [ ] Customer list, detail, and edit work
- [ ] Loan list, detail, and approval work
- [ ] Device list and lock/unlock work
- [ ] Payment list and reconciliation work
- [ ] Reports render with charts and export
- [ ] Logout clears session and redirects

---

## Priority 3: UX Improvements

---

### Action 3.1: Add Toast Notification System

**Blocker:** B8
**Effort:** 1 hour

**Steps:**
1. Install toast library: `npm install sonner`
2. Add `<Toaster />` to root layout
3. Add `toast.success()` and `toast.error()` calls to mutation callbacks

**Verification:**
- [ ] Success toast after approve/reject/lock/unlock/reconcile
- [ ] Error toast for failed operations

---

### Action 3.2: Add Empty States on Dashboard

**Blocker:** UX
**Effort:** 30 minutes

**Steps:**
1. Replace `null` with `<EmptyState>` in dashboard `_client.tsx`
2. Add actionable guidance (e.g., "No data yet. Import customers to get started.")

**Verification:**
- [ ] Dashboard shows helpful empty state when no data

---

### Action 3.3: Add Global Error Boundary

**Blocker:** UX
**Effort:** 30 minutes

**Steps:**
1. Create `src/components/error-boundary.tsx`
2. Wrap dashboard layout with error boundary
3. Provide retry button and error details

**Verification:**
- [ ] Component crashes show error boundary instead of white screen
- [ ] Retry button works

---

### Action 3.4: Add Breadcrumb Navigation

**Blocker:** UX
**Effort:** 1-2 hours

**Steps:**
1. Create `src/components/ui/breadcrumb.tsx`
2. Add to detail pages: `/customers/[id]`, `/loans/[id]`, `/devices/[id]`, `/payments/[id]`
3. Format: `Dashboard > Customers > Customer Name`

**Verification:**
- [ ] Breadcrumbs appear on all detail pages
- [ ] Links navigate to parent pages

---

## Priority 4: Polish Items

---

### Action 4.1: Add Secure Flag to Auth Cookie

**Blocker:** B12
**Effort:** 5 minutes

**Fix:**
```typescript
const secure = window.location.protocol === 'https:' ? '; Secure' : '';
document.cookie = `lynia-auth-active=1; path=/; SameSite=Lax${secure}`;
```

---

### Action 4.2: Disable Demo Mode in Production

**Blocker:** B11
**Effort:** 15 minutes

**Fix:**
```typescript
if (!isCognitoConfigured()) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Authentication service unavailable.' };
  }
  // Demo mode only in development...
}
```

---

### Action 4.3: Add Skip-to-Content Link

**Blocker:** Accessibility
**Effort:** 15 minutes

**Fix:** Add to dashboard layout before sidebar:
```html
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:p-4">
  Skip to content
</a>
```

---

### Action 4.4: Implement PDF Export

**Blocker:** B9
**Effort:** 4-8 hours

**Steps:**
1. Install `jspdf` and `jspdf-autotable`
2. Add PDF export button next to CSV export on reports page
3. Generate formatted PDF with charts and tables

---

### Action 4.5: Add i18n Framework

**Blocker:** B10
**Effort:** Multi-day

**Steps:**
1. Install `next-intl` or `react-i18next`
2. Create message files for English, Shona, Ndebele
3. Wrap all user-facing strings with translation functions
4. Add language switcher to header

---

## Summary Timeline

| Priority | Actions | Total Effort | When |
|----------|---------|-------------|------|
| P1: Show-Stoppers | 1.1, 1.2, 1.3, 1.4 | ~2 hours | Day 1 (immediate) |
| P2: Critical Journeys | 2.1, 2.2, 2.3 | ~5-7 hours | Day 1-2 |
| P3: UX Improvements | 3.1, 3.2, 3.3, 3.4 | ~3-4 hours | Day 2-3 |
| P4: Polish | 4.1, 4.2, 4.3, 4.4, 4.5 | ~5-10 hours | Day 3-5+ |
| **Total** | **19 actions** | **~3-5 days** | |
