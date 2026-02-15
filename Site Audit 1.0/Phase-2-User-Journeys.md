# Phase 2: User Journey Extraction & Documentation

**Status:** COMPLETED
**Audit Date:** February 15, 2026

---

## Overview

This phase documents every admin user journey in the Lynia Finance admin panel, including entry points, steps, backend dependencies, API endpoints, edge cases, and role requirements.

---

## Journey Category 1: Authentication & Access (5 Journeys)

### Journey 1: Admin Login via Cognito

**Status:** PASS
**Entry Point:** `/login`
**Required Role:** None (pre-auth)
**File:** `frontend/admin-portal/src/app/(auth)/login/page.tsx`

**Steps:**
1. User navigates to `https://admin.lyniafinance.com/login`
2. Middleware checks `lynia-auth-active` cookie — if absent, redirects to login
3. User enters email and password
4. Auth store calls `CognitoUserPool.authenticateUser()`
5. On success: JWT extracted, `AdminUser` built from claims, cookie set, redirect to `/`
6. On failure: Error message displayed

**Backend Dependencies:**
- Amazon Cognito User Pool (LITE tier)
- Environment variables: `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`

**API Calls:**
- Cognito SDK: `authenticateUser()` (client-side, no Lambda involved)

**Edge Cases:**
- Cognito not configured → Falls back to demo mode
- Invalid credentials → "Invalid email or password" error
- Account locked → Cognito returns error
- Network failure → Generic "unexpected error" message

**Test Verification:**
- [x] Login form renders with email, password, submit button
- [x] Form validation: required fields, email format
- [x] Loading state shows "Signing in..." on button
- [x] Error state shows red alert box with message
- [x] Successful login redirects to `/`

---

### Journey 2: NEW_PASSWORD_REQUIRED Challenge

**Status:** PASS
**Entry Point:** Login → Cognito returns `newPasswordRequired` callback
**Required Role:** None (mid-auth)
**File:** `frontend/admin-portal/src/app/(auth)/login/page.tsx:158-187`

**Steps:**
1. After initial login, Cognito returns `newPasswordRequired` challenge
2. Auth store sets `challenge: { type: 'NEW_PASSWORD_REQUIRED' }`
3. Login page renders password change form
4. User enters new password + confirmation
5. Client-side validation: length >= 8, passwords match
6. `completeNewPasswordChallenge()` called on CognitoUser
7. On success: may proceed to MFA challenge or direct to dashboard

**Edge Cases:**
- Passwords don't match → "Passwords do not match" error
- Password too short → "Password must be at least 8 characters"
- Cognito password policy violation → Error from Cognito

**Test Verification:**
- [x] Password form appears when challenge type is `NEW_PASSWORD_REQUIRED`
- [x] Amber info box explains "Your administrator requires you to set a new password"
- [x] Client-side validation prevents weak passwords
- [x] Both password fields have `autoComplete="new-password"`

---

### Journey 3: MFA TOTP Challenge

**Status:** PASS
**Entry Point:** Login → Cognito returns `totpRequired`/`mfaRequired` callback
**Required Role:** None (mid-auth)
**File:** `frontend/admin-portal/src/app/(auth)/login/page.tsx:190-210`

**Steps:**
1. After login or password change, Cognito returns MFA challenge
2. Auth store sets `challenge: { type: 'SOFTWARE_TOKEN_MFA' }`
3. Login page renders 6-digit code input
4. User enters TOTP code from authenticator app
5. `sendMFACode()` called with code and `SOFTWARE_TOKEN_MFA` type
6. On success: JWT issued, redirect to dashboard

**Edge Cases:**
- Wrong code → "Invalid verification code" + field cleared for retry
- Session expired during MFA → "Session expired. Please sign in again."
- Non-numeric input → Filtered by `replace(/\D/g, '').slice(0, 6)`

**Test Verification:**
- [x] 6-digit input with `inputMode="numeric"` for mobile keyboards
- [x] Submit button disabled when code length !== 6
- [x] Blue info box: "Open your authenticator app and enter the 6-digit code"
- [x] Input auto-filters non-numeric characters

---

### Journey 4: Session Timeout & Re-authentication

**Status:** PASS
**Entry Point:** Any dashboard page after 30 minutes of inactivity
**Required Role:** Any authenticated user
**File:** `frontend/admin-portal/src/lib/hooks/use-session-timeout.ts`

**Steps:**
1. `useSessionTimeout` hook tracks user activity (mouse, keyboard, scroll)
2. After 30 minutes of inactivity, calls `signOutUser()`
3. Auth store clears user, cookie, sessionStorage
4. Middleware detects missing cookie → redirects to `/login`

**Edge Cases:**
- Activity resets timer (mouse move, keypress, scroll, touch)
- Tab switching does not reset timer
- Multiple tabs: timeout is per-tab (no cross-tab sync)

**Test Verification:**
- [x] Hook implemented with activity event listeners
- [x] 30-minute default timeout
- [x] Cleanup removes event listeners on unmount

---

### Journey 5: Role-Based Access Control

**Status:** PASS
**Entry Point:** All dashboard pages
**Required Role:** Varies by resource
**File:** `frontend/admin-portal/src/types/auth.ts`, `sidebar.tsx`

**Steps:**
1. User's role extracted from Cognito JWT `cognito:groups` claim
2. `ROLE_PERMISSIONS` map defines which roles can do what
3. Sidebar filters navigation items based on `hasPermission(role, resource, action)`
4. `ProtectedRoute` component wraps sensitive pages
5. API calls include JWT → Lambda validates server-side

**Permission Matrix (Abbreviated):**
| Role | Customers | Loans | Payments | Devices | Reports | Settings |
|------|-----------|-------|----------|---------|---------|----------|
| super_admin | Full | Full | Full | Full | Full | Full |
| admin | Full | Full | Full | Full | Full | Read |
| manager | Read/Write | Read/Approve | Read | Read | Read | No |
| loan_officer | Read | Read/Write | Read | No | No | No |
| collections_officer | Read | Read | Read/Write | No | Read | No |
| kyc_officer | Read/Write | Read | No | No | No | No |
| support_agent | Read | Read | Read | Read | No | No |
| auditor | Read | Read | Read | Read | Read | Read |

**Test Verification:**
- [x] 8 roles defined with distinct permission sets
- [x] Sidebar filters by `requiredPermission`
- [x] `ProtectedRoute` component exists
- [x] JWT sent with every API call for server-side validation

---

## Journey Category 2: Dashboard & Navigation (3 Journeys)

### Journey 6: Dashboard KPI Display

**Status:** PARTIAL
**Entry Point:** `/` (root dashboard)
**Required Role:** Any authenticated user
**File:** `frontend/admin-portal/src/app/(dashboard)/_client.tsx`

**Steps:**
1. Dashboard page loads client component dynamically (code-split)
2. React Query fetches 5 dashboard API endpoints in parallel:
   - `GET /api/v1/dashboard/metrics` → 12 KPI cards
   - `GET /api/v1/dashboard/portfolio-at-risk` → PAR chart
   - `GET /api/v1/dashboard/daily-trends?days=30` → Trend chart
   - `GET /api/v1/dashboard/loans-by-status` → Distribution chart
   - `GET /api/v1/dashboard/recent-activity?limit=10` → Activity feed
3. While loading: 8 skeleton pulse cards displayed
4. On success: Full dashboard with metrics, charts, quick actions

**Known Issues:**
- If backend returns no data (empty DB): Dashboard shows `null` instead of empty state
- Quick actions link to pages that may not have data

**Test Verification:**
- [x] 12 KPI metric cards rendered with proper formatting
- [x] 4 Recharts charts: Trend, Portfolio, PAR, StatusDistribution
- [x] DateRangePicker with 30d/90d/1y presets
- [x] Quick actions: New Loan, KYC Review, Collections, Reports
- [x] Skeleton loading while data fetches
- [ ] **ISSUE:** No empty state when metrics are null

---

### Journey 7: Sidebar Navigation

**Status:** PARTIAL
**Entry Point:** All dashboard pages (sidebar is persistent)
**Required Role:** Role-filtered
**File:** `frontend/admin-portal/src/components/dashboard/sidebar.tsx`

**Current Navigation Items:**
1. Dashboard (`/`) — `LayoutDashboard` icon
2. Customers (`/customers`) — `Users` icon — Sub: All Customers, KYC Review
3. Loans (`/loans`) — `Banknote` icon — Sub: All Loans, Pending Approval
4. Devices (`/devices`) — `Smartphone` icon — Sub: Inventory, Handovers, Lock/Unlock
5. Payments (`/payments`) — `CreditCard` icon — Sub: All Payments, Collections
6. Reports (`/reports`) — `BarChart3` icon

**Missing from Navigation:**
- Fineract section (6 pages): Loans, Approval, Accounting, Products, Overdue, Reconciliation
- Settings page
- Payments/Reconciliation sub-item
- KYC standalone page

**Known Bugs:**
1. **`user.full_name` undefined** — Line 146 references `user.full_name` but AdminUser type has `first_name`/`last_name`. Will crash at runtime.
2. **`useAuth` import** — Imports from `@/lib/auth/context` which may not match actual auth module at `@/lib/store/auth-store.ts`

**Test Verification:**
- [x] Sidebar renders 6 navigation items with icons
- [x] Active state highlighting works (checks pathname)
- [x] Collapsible sub-menus with `<details>` element
- [x] Mobile overlay with hamburger menu (lg:hidden breakpoint)
- [x] Role-based filtering via `hasPermission`
- [ ] **BUG:** `user.full_name` will throw TypeError
- [ ] **BUG:** 7+ pages missing from navigation

---

### Journey 8: Date Range Filtering

**Status:** PASS
**Entry Point:** Dashboard, Reports pages
**Required Role:** Any authenticated user

**Steps:**
1. User clicks DateRangePicker component
2. Presets available: Last 30 days, Last 90 days, Last Year, Custom
3. Custom range opens calendar picker
4. Selection triggers React Query refetch with new date params
5. Charts and tables update with filtered data

**Test Verification:**
- [x] DateRangePicker component with presets
- [x] Custom date range selection
- [x] Dates passed as query parameters to API

---

## Journey Category 3: Customer Management (5 Journeys)

### Journey 9: Customer List (Paginated)

**Status:** PASS
**Entry Point:** `/customers`
**Required Role:** `customers:read`
**API:** `GET /api/v1/customers?page=1&limit=25&status=...&kyc_status=...&search=...`

**Steps:**
1. Page loads with default filters (page 1, limit 25)
2. TanStack React Table renders sortable columns
3. Filters: Status dropdown, KYC status dropdown, search input
4. Pagination: Previous/Next buttons, page indicator
5. Click row → navigate to `/customers/[id]`

**Test Verification:**
- [x] Table renders with columns: Name, Phone, Status, KYC, Created
- [x] Search by name or phone number
- [x] Filter by status (active, blocked, pending)
- [x] Filter by KYC status (verified, pending, failed)
- [x] Pagination controls with page size enforced

---

### Journey 10: Customer Detail View

**Status:** PASS
**Entry Point:** `/customers/[id]`
**Required Role:** `customers:read`
**API:** Multiple - customer detail, loans, payments, credit score, KYC, timeline

**Steps:**
1. Fetch customer by ID: `GET /api/v1/customers/{id}`
2. Render tabbed interface: Profile | Loans | Payments | KYC | Timeline | Notes
3. Each tab fetches its own data via React Query
4. Actions: Edit, Activate/Block, Add Note

**Test Verification:**
- [x] All 6 tabs render with data
- [x] Credit score card shows visual gauge
- [x] Loan history table with status badges
- [x] Payment history with amount formatting (USD)
- [x] KYC documents with image viewer
- [x] Timeline with chronological events

---

### Journey 11: Customer Edit

**Status:** PASS
**Entry Point:** `/customers/[id]/edit`
**Required Role:** `customers:update`
**API:** `PATCH /api/v1/customers/{id}`

**Steps:**
1. Load current customer data
2. Pre-populate form with existing values
3. Edit fields: name, phone, address, etc.
4. Submit → PATCH API → show success/error

**Test Verification:**
- [x] Form pre-populated with current data
- [x] Validation via react-hook-form + zod
- [x] Submit sends PATCH request with changed fields only

---

### Journey 12: KYC Review Queue

**Status:** PASS
**Entry Point:** `/customers/kyc-review`
**Required Role:** `customers:read` (review requires `customers:approve`)
**API:** `GET /api/v1/kyc/submissions/pending`, `POST .../approve`, `POST .../reject`

**Steps:**
1. Load pending KYC submissions list
2. Click submission to expand review panel
3. View: ID document images, selfie, extracted data
4. Compare: Document photo vs selfie
5. Actions: Approve or Reject (with reason)
6. On approve: Customer KYC status updated, credit scoring triggered

**Test Verification:**
- [x] Pending queue with SLA indicators
- [x] Document viewer for ID images
- [x] Approve/Reject with confirmation
- [x] Rejection requires reason text

---

### Journey 13: Customer Status Management

**Status:** PASS
**Entry Point:** Customer detail page → Status toggle
**Required Role:** `customers:update`
**API:** `PATCH /api/v1/customers/{id}/status`

**Steps:**
1. From customer detail, click Activate/Block button
2. Confirmation dialog appears
3. On confirm: PATCH status → UI updates

**Test Verification:**
- [x] Status toggle with confirmation dialog
- [x] Active (green badge) / Blocked (red badge) indicators

---

## Journey Category 4: Loan Lifecycle (6 Journeys)

### Journey 14: View Loan Applications

**Status:** PASS
**Entry Point:** `/loans`
**Required Role:** `loans:read`
**API:** `GET /api/v1/loans?page=1&limit=25&status=...&search=...`

**Steps:**
1. Table loads with all loan applications
2. Filters: Status (pending, approved, active, closed, defaulted), search
3. Sort by columns: amount, date, status
4. Click row → `/loans/[id]`

**Test Verification:**
- [x] Sortable table with status badges
- [x] Money formatting: `$500.00` with USD symbol
- [x] Status colors: pending=yellow, approved=green, defaulted=red

---

### Journey 15: Pending Approval Queue

**Status:** PASS
**Entry Point:** `/loans/pending-approval`
**Required Role:** `loans:approve`
**API:** `GET /api/v1/loans/pending`, `POST /api/v1/loans/{id}/approve`, `POST .../reject`

**Steps:**
1. Load pending loans list
2. Each row shows: customer, amount, score, term, risk level
3. Click to expand details
4. Approve: Confirmation → POST approve → loan moves to "approved"
5. Reject: Reason required → POST reject → loan moves to "rejected"

**Test Verification:**
- [x] Pending queue with customer and loan details
- [x] Approve action with confirmation dialog
- [x] Reject action requires mandatory reason
- [x] Credit score and risk indicators visible

---

### Journey 16: Loan Detail View

**Status:** PASS
**Entry Point:** `/loans/[id]`
**Required Role:** `loans:read`
**API:** `GET /api/v1/loans/{id}`, `GET /api/v1/loans/{id}/payments`

**Steps:**
1. Fetch loan by ID
2. Display: Loan info, customer info, repayment schedule, payment history
3. Visual repayment schedule with due dates and amounts
4. Payment history table with reconciliation status

**Test Verification:**
- [x] Loan summary card with amount, rate, term, status
- [x] Repayment schedule table (date, amount, status)
- [x] Payment history linked to this loan
- [x] Link to customer detail

---

### Journey 17: Fineract Loan Portfolio

**Status:** BLOCKED (Fineract not deployed)
**Entry Point:** `/fineract/loans` (NOT IN SIDEBAR)
**Required Role:** `loans:read`
**API:** `GET /api/v1/fineract/loans`

**Page exists and is code-complete but will return API errors until Fineract ECS cluster is deployed.**

---

### Journey 18: Fineract Approval Workflow

**Status:** BLOCKED (Fineract not deployed)
**Entry Point:** `/fineract/approval` (NOT IN SIDEBAR)
**Required Role:** `loans:approve`
**API:** `GET /api/v1/fineract/loans/pending`, `POST .../approve`

**Page exists and is code-complete but will return API errors until Fineract ECS cluster is deployed.**

---

### Journey 19: Fineract GL Accounting

**Status:** BLOCKED (Fineract not deployed)
**Entry Point:** `/fineract/accounting` (NOT IN SIDEBAR)
**Required Role:** `reports:read`
**API:** `GET /api/v1/fineract/gl-accounts`, `GET /journal-entries`, `GET /trial-balance`

**Page exists and is code-complete but will return API errors until Fineract ECS cluster is deployed.**

---

## Journey Category 5: Payments (4 Journeys)

### Journey 20: Payment List & Filtering

**Status:** PASS
**Entry Point:** `/payments`
**Required Role:** `payments:read`
**API:** `GET /api/v1/payments?status=...&method=...&type=...&search=...`

**Steps:**
1. Load paginated payment list
2. Filters: Status, Method (EcoCash, OneMoney, bank_transfer, cash), Type, Date range, Reconciled
3. Search by reference number
4. Click row → `/payments/[id]`

**Test Verification:**
- [x] Filter by status: confirmed, pending, failed, refunded
- [x] Filter by payment method
- [x] Date range filtering
- [x] Reconciliation status filter (reconciled/unreconciled)

---

### Journey 21: Payment Reconciliation

**Status:** PASS
**Entry Point:** `/payments/reconciliation` (NOT IN SIDEBAR — must navigate directly)
**Required Role:** `payments:update`
**API:** `GET /api/v1/payments/unreconciled`, `POST /api/v1/payments/{id}/reconcile`

**Steps:**
1. Load unreconciled payments list
2. Review each payment: amount, method, date, customer
3. Mark as reconciled → POST reconcile with admin_id
4. Payment moves out of queue

**Test Verification:**
- [x] Unreconciled queue loads correctly
- [x] Reconcile action with confirmation
- [x] Admin ID attached for audit trail

---

### Journey 22: Collections Queue

**Status:** PASS
**Entry Point:** `/payments/collections`
**Required Role:** `payments:read`
**API:** `GET /api/v1/payments/overdue-collections`

**Steps:**
1. Load overdue collections list
2. Each item shows: customer, amount due, days overdue, priority
3. Priority levels: critical (>90 days), high (61-90), medium (31-60), low (1-30)
4. Actions: Contact customer, view loan detail

**Test Verification:**
- [x] Priority color coding (red=critical, orange=high, yellow=medium, green=low)
- [x] Days overdue calculation
- [x] Link to customer and loan details

---

### Journey 23: Refund Processing

**Status:** PASS
**Entry Point:** Payment detail page → Refund button
**Required Role:** `payments:update`
**API:** `POST /api/v1/payments/{id}/refund`

**Steps:**
1. From payment detail, click Refund
2. Enter reason in modal
3. Confirm → POST refund with admin_id and reason
4. Payment status changes to "refunded"

**Test Verification:**
- [x] Refund button on payment detail
- [x] Reason required (mandatory text field)
- [x] Admin ID attached for audit trail

---

## Journey Category 6: Device Management (3 Journeys)

### Journey 24: Device Inventory

**Status:** PASS
**Entry Point:** `/devices`
**Required Role:** `devices:read`
**API:** `GET /api/v1/devices?status=...&lock_status=...&search=...`

**Steps:**
1. Load device list with stats cards (total, assigned, locked, available)
2. Filter by status, lock status
3. Search by IMEI number
4. Click row → `/devices/[id]`

**Test Verification:**
- [x] Stats cards: total, assigned, locked, available counts
- [x] IMEI search
- [x] Status and lock status filters

---

### Journey 25: Device Lock/Unlock

**Status:** PASS
**Entry Point:** `/devices/lock-unlock` or device detail page
**Required Role:** `devices:lock` / `devices:unlock`
**API:** `POST /api/v1/devices/{id}/lock`, `POST .../unlock`

**Steps:**
1. Select device from list or search by IMEI
2. Lock: Enter reason → Confirmation → POST lock
3. Unlock: Enter reason → Confirmation → POST unlock
4. Lock history timeline updated

**Test Verification:**
- [x] Lock/unlock with mandatory reason
- [x] Confirmation dialog before action
- [x] Lock history timeline shows all events

---

### Journey 26: Device Handovers

**Status:** PASS
**Entry Point:** `/devices/handovers`
**Required Role:** `devices:read`
**API:** `GET /api/v1/devices/handovers`

**Steps:**
1. Load handover tracking list
2. Each handover shows: device, customer, status, steps completed
3. 7-step handover process: application → approval → deposit → verification → activation → delivery → confirmation
4. Status progression tracked per handover

**Test Verification:**
- [x] Handover list with status progression
- [x] Step-by-step tracking visualization
- [x] Link to device and customer details

---

## Journey Category 7: Reporting & Settings (2 Journeys)

### Journey 27: Reports Dashboard

**Status:** PASS
**Entry Point:** `/reports`
**Required Role:** `reports:read`
**API:** 6 report endpoints under `/api/v1/reports/*`

**Steps:**
1. Reports page shows 7 report categories as cards
2. Select report type → detailed view with date range filter
3. Charts: Collection by method, Revenue trends, Default rates
4. Tables: Detailed data with sorting
5. Export: CSV download button

**Report Types:**
| # | Report | API Endpoint |
|---|--------|-------------|
| 1 | Collections | `/api/v1/reports/collections` |
| 2 | Revenue | `/api/v1/reports/revenue` |
| 3 | Defaults | `/api/v1/reports/defaults` |
| 4 | KYC Status | `/api/v1/reports/kyc` |
| 5 | Loan Approvals | `/api/v1/reports/loan-approvals` |
| 6 | Portfolio Health | `/api/v1/reports/portfolio` |
| 7 | Custom Date Range | All endpoints with date params |

**Test Verification:**
- [x] 7 report types with Recharts visualizations
- [x] Date range filtering on all reports
- [x] CSV export functionality
- [ ] **MISSING:** PDF export (B9)

---

### Journey 28: Settings & Admin

**Status:** PARTIAL
**Entry Point:** `/settings` (NOT IN SIDEBAR — must navigate directly)
**Required Role:** `admin:read` / `admin:update`
**API:** Multiple admin endpoints

**Features:**
1. Admin User Management: List, Create, Edit admin users
2. System Configuration: Key-value config entries
3. Audit Logs: View all admin actions with timestamps

**Known Issues:**
- Not reachable from sidebar navigation
- Must navigate directly to `/settings`

**Test Verification:**
- [x] Admin user CRUD operations
- [x] System config management
- [x] Audit log viewer with filtering
- [ ] **ISSUE:** Missing from sidebar navigation
