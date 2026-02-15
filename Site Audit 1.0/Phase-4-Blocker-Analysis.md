# Phase 4: Blocker Analysis

**Status:** COMPLETED
**Audit Date:** February 15, 2026
**Total Blockers Identified:** 14

---

## Overview

Categorized analysis of all blockers preventing the admin panel from being fully functional. Organized by severity with root cause, affected journeys, and specific fix instructions.

---

## Severity Legend

| Severity | Definition | Response Required |
|----------|-----------|-------------------|
| CRITICAL | Prevents core functionality; admin panel unusable or crashes | Immediate fix required |
| HIGH | Major features blocked or data-dependent pages empty | Fix before user testing |
| MEDIUM | Feature gaps that reduce usability but have workarounds | Fix before production release |
| LOW | Polish items, best practices not met, future enhancements | Fix in next sprint |

---

## CRITICAL Blockers (3)

### B1: Fineract ECS Cluster Not Deployed

**Category:** Infrastructure
**Root Cause:** CloudFormation templates exist but have not been executed against AWS
**Journeys Affected:** 6 pages — Fineract Loans, Approval, Accounting, Products, Overdue, Reconciliation

**Current State:**
- `fineract-ecs.yaml` (463 lines) — ready to deploy
- `deploy-fineract.sh` (285 lines) — orchestration script ready
- TypeScript client (584 lines) — built with circuit breaker
- 9 admin portal pages — consuming Fineract APIs
- No ECS cluster exists in AWS account
- No Fineract container running
- No Fineract databases created

**What Happens Now:**
- Navigating to any `/fineract/*` page triggers API calls
- `fetchAPI` sends requests to API Gateway
- Lambda attempts to call Fineract via internal ALB
- Connection fails → API returns error
- Admin page shows error state

**Fix Steps:**
```bash
# 1. Ensure AWS CLI is configured
aws sts get-caller-identity

# 2. Run the deployment script
cd phase-6-fineract-integration/infrastructure
bash deploy-fineract.sh --stack-name lynia-fineract --env production

# 3. Wait for ECS service to stabilize (~5 minutes)
aws ecs wait services-stable --cluster lynia-fineract --services fineract-service

# 4. Verify health endpoint
curl https://fineract-alb:8443/fineract-provider/api/v1/authentication

# 5. Initialize Fineract (head office, currencies, products, GL accounts)
node phase-6-fineract-integration/scripts/initialize-fineract.js

# 6. Update Lambda environment variables with Fineract ALB URL
aws lambda update-function-configuration --function-name lynia-scoring \
  --environment "Variables={FINERACT_URL=https://fineract-alb:8443}"
```

**Effort Estimate:** 2-4 hours
**Dependencies:** AWS credentials with ECS, ALB, Secrets Manager, CloudWatch permissions

---

### B2: Sidebar Navigation Missing 7+ Pages

**Category:** Frontend
**Root Cause:** `NAVIGATION` array in `sidebar.tsx` only has 6 items; later-phase pages were never added
**Journeys Affected:** All Fineract pages (6), Settings (1), Payments/Reconciliation (1), KYC standalone (1)

**Current State (sidebar.tsx lines 29-82):**
```typescript
const NAVIGATION: SidebarItem[] = [
  { label: 'Dashboard',  href: '/',          icon: LayoutDashboard },
  { label: 'Customers',  href: '/customers', icon: Users,       children: [...] },
  { label: 'Loans',      href: '/loans',     icon: Banknote,    children: [...] },
  { label: 'Devices',    href: '/devices',   icon: Smartphone,  children: [...] },
  { label: 'Payments',   href: '/payments',  icon: CreditCard,  children: [...] },
  { label: 'Reports',    href: '/reports',   icon: BarChart3 },
  // MISSING: Fineract, Settings, Payments/Reconciliation
];
```

**Fix Steps:**
```typescript
// Add to NAVIGATION array:
import { Landmark, Settings as SettingsIcon } from 'lucide-react';

// After Reports entry, add:
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
{
  label: 'Settings',
  href: '/settings',
  icon: SettingsIcon,
  requiredPermission: { resource: 'settings', action: 'read' },
},

// Also add to Payments children:
{ label: 'Reconciliation', href: '/payments/reconciliation' },
```

**Effort Estimate:** 1 hour
**Dependencies:** None (pure frontend change)

---

### B3: Sidebar `user.full_name` Crash

**Category:** Frontend Bug
**Root Cause:** Type mismatch — sidebar expects `user.full_name` but AdminUser has `first_name`/`last_name`
**Journeys Affected:** ALL pages (sidebar renders on every dashboard page)

**Current Code (sidebar.tsx:146-151):**
```typescript
{user.full_name           // ← undefined
  .split(' ')             // ← TypeError: Cannot read properties of undefined
  .map((n) => n[0])
  .join('')
  .toUpperCase()
  .slice(0, 2)}
```

**AdminUser Type (auth-store.ts:45-57):**
```typescript
return {
  first_name: (payload.given_name as string) || '',
  last_name: (payload.family_name as string) || '',
  // NO full_name property
};
```

**Fix (sidebar.tsx):**
```typescript
// Replace lines 146-151:
{`${user.first_name} ${user.last_name}`
  .trim()
  .split(' ')
  .filter(Boolean)
  .map((n) => n[0])
  .join('')
  .toUpperCase()
  .slice(0, 2)}

// Replace line 155:
<p className="truncate text-sm font-medium text-white">
  {`${user.first_name} ${user.last_name}`.trim()}
</p>
```

**Effort Estimate:** 15 minutes
**Dependencies:** None (pure frontend fix)

---

## HIGH Blockers (3)

### B4: Database Possibly Empty

**Category:** Data
**Root Cause:** No evidence that seed scripts (`scripts/create-demo-data.js`) were run against production RDS
**Journeys Affected:** All data-dependent pages (dashboard, lists, reports)

**Impact:**
- Dashboard KPI cards show 0 or null
- Customer/Loan/Payment/Device lists show empty tables
- Reports show no data
- Cannot test any CRUD operations

**Fix Steps:**
```bash
# Option 1: Run seed script
node scripts/create-demo-data.js --connection-string "$RDS_CONNECTION_STRING"

# Option 2: Run migrations + seed
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
node scripts/create-demo-data.js --connection-string "$RDS_CONNECTION_STRING"

# Option 3: Manual data creation via API (after login)
# Use admin panel to create test customers, loans, payments
```

**Effort Estimate:** 1 hour
**Dependencies:** RDS connection string / database credentials

---

### B5: Cognito Environment Variables in Production Build

**Category:** Authentication
**Root Cause:** Next.js static export bakes `NEXT_PUBLIC_*` env vars at build time. If build ran without correct values, production will use demo mode.
**Journeys Affected:** Login flow, all authenticated operations

**How to Verify:**
```bash
# Download a JS chunk from S3 and search for Cognito config
aws s3 cp s3://lynia-admin-portal-bucket/_next/static/chunks/ /tmp/chunks/ --recursive
grep -r "NEXT_PUBLIC_COGNITO" /tmp/chunks/

# Should find something like:
# us-east-1_Ab12Cd34E  (pool ID)
# 1abc2def3ghi4jkl5    (client ID)
```

**Fix (if values are missing):**
```bash
# Rebuild with correct env vars
cd frontend/admin-portal
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXX \
NEXT_PUBLIC_COGNITO_CLIENT_ID=YYYYY \
NEXT_PUBLIC_API_URL=https://api.lyniafinance.com \
npm run build

# Redeploy to S3
aws s3 sync out/ s3://lynia-admin-portal-bucket/ --delete
aws cloudfront create-invalidation --distribution-id ZZZZZ --paths "/*"
```

**Effort Estimate:** 30 minutes
**Dependencies:** Cognito pool ID, client ID, AWS S3 access

---

### B6: `useAuth` Import Path in Sidebar

**Category:** Frontend
**Root Cause:** Sidebar imports `useAuth` from `@/lib/auth/context` which may not match actual auth module
**Journeys Affected:** All pages (sidebar is global component)

**Current Import (sidebar.tsx:17):**
```typescript
import { useAuth } from '@/lib/auth/context';
```

**Known Auth Modules:**
- `@/lib/store/auth-store.ts` — Zustand store (confirmed working)
- `@/lib/hooks/use-auth.ts` — Custom hook (confirmed exists)
- `@/lib/auth/context` — Status UNKNOWN

**Verification Steps:**
```bash
ls frontend/admin-portal/src/lib/auth/context*
# If file exists: verify it exports { useAuth } that returns { user: AdminUser }
# If file doesn't exist: sidebar will fail to compile
```

**Effort Estimate:** 15 minutes
**Dependencies:** None

---

## MEDIUM Blockers (4)

### B7: Payments Reconciliation Not in Sidebar

**Category:** Frontend
**Root Cause:** `/payments/reconciliation` page exists but not added to Payments children in sidebar
**Journeys Affected:** Payment reconciliation workflow

**Fix:** Add `{ label: 'Reconciliation', href: '/payments/reconciliation' }` to Payments children array in sidebar.tsx.

**Effort Estimate:** 5 minutes

---

### B8: No Toast/Notification System Visible

**Category:** Frontend/UX
**Root Cause:** No toast or snackbar component found in codebase for action confirmations
**Journeys Affected:** All form submissions (approve loan, lock device, reconcile payment, etc.)

**Impact:** Users perform actions (approve, reject, lock) without visible success/failure feedback beyond the React Query state change.

**Fix Options:**
1. Install `react-hot-toast` or `sonner`
2. Create custom toast component using Radix Toast primitive
3. Verify if mutation callbacks show adequate feedback

**Effort Estimate:** 1 hour

---

### B9: CSV Export Only — No PDF/Excel

**Category:** Reporting
**Root Cause:** Reports page only implements CSV export
**Journeys Affected:** Report downloads

**Impact:** Users needing formatted PDF reports (for RBZ submissions, board meetings) must manually convert CSV files.

**Fix Options:**
1. Add `jspdf` + `jspdf-autotable` for PDF generation
2. Add `xlsx` package for Excel export
3. Acceptable for MVP — prioritize after core functionality works

**Effort Estimate:** 4-8 hours

---

### B10: No i18n — English Only

**Category:** UX
**Root Cause:** No internationalization framework implemented
**Journeys Affected:** All pages (content is English-only)

**Impact:** Admin users who prefer Shona or Ndebele must use English. Per CLAUDE.md, multi-language support is a goal for the target market.

**Fix:** Implement `next-intl` or `react-i18next` with message files for `en`, `sn` (Shona), `nd` (Ndebele).

**Effort Estimate:** Multi-day project

---

## LOW Blockers (4)

### B11: Demo Mode in Production

**Category:** Security
**Fix:** Add `process.env.NODE_ENV === 'production'` guard before demo credentials check.
**Effort:** 15 minutes

---

### B12: Session Cookie Lacks Secure Flag

**Category:** Security
**Fix:** Add `; Secure` to cookie when `window.location.protocol === 'https:'`.
**Effort:** 5 minutes

---

### B13: No Real-Time WebSocket Updates

**Category:** Performance
**Impact:** Dashboard and list pages use polling via React Query `staleTime` instead of real-time WebSocket pushes.
**Status:** Acceptable for MVP. React Query polling is sufficient at current scale.
**Effort:** Multi-day project (would need WebSocket API Gateway + Lambda)

---

### B14: KYC Images Not Using Next.js Image Optimization

**Category:** Performance
**Impact:** KYC document images served from S3 without `<Image>` component optimization.
**Status:** Low priority — static export doesn't support Next.js Image optimization anyway. Images are served via CloudFront CDN which handles caching.
**Effort:** N/A (not applicable for static export)

---

## Blocker Priority Matrix

```
                    HIGH IMPACT
                        │
           B1 ──────────┼──────── B3
        (Fineract)      │     (Sidebar crash)
                        │
           B4 ──────────┼──────── B2
        (Empty DB)      │     (Missing nav)
                        │
    LOW EFFORT ─────────┼──────────── HIGH EFFORT
                        │
           B12 ─────────┼──────── B9
        (Cookie)        │     (PDF export)
                        │
           B11 ─────────┼──────── B10
        (Demo mode)     │     (i18n)
                        │
                    LOW IMPACT
```

**Quick Wins (< 30 min, high impact):** B3, B6, B12, B7
**Important Work (1-4 hours, high impact):** B1, B2, B4, B5
**Future Items (multi-day, lower impact):** B9, B10, B13
