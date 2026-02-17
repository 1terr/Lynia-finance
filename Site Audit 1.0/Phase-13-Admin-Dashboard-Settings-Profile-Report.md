# Phase 13: Admin Dashboard - Settings, Profile, Notifications & User Management

**Date:** 2026-02-17
**Scope:** Admin portal settings panel, profile page, notifications, user management, password flows, and admin backend service
**Status:** Complete

---

## Executive Summary

A comprehensive audit and implementation pass on the admin dashboard's settings panel, profile page, notifications panel, user management, and authentication flows. The audit identified **5 critical gaps**: a broken profile page, missing password reset/change flows, a non-functional notifications panel, missing backend API endpoints for all admin operations, and a Cognito group/role mismatch. All gaps were resolved with frontend implementations, a new backend Lambda service, and infrastructure alignment.

---

## Issues Found

### 1. Profile Page - BROKEN (Critical)
- **Problem:** Header dropdown (line 108 of `header.tsx`) navigated to `/settings/profile` but **no page existed** at that route. Clicking "Profile" led to a dead link / 404.
- **Root cause:** The route was never created despite being linked in the header UI.
- **Impact:** Users could not view their profile information.

### 2. Password Flows - COMPLETELY MISSING (Critical)
- **Problem:** No "Forgot password" link or flow on the login page. No "Change password" for authenticated users anywhere in the app.
- **Root cause:** The Cognito SDK supports `forgotPassword()`, `confirmPassword()`, and `changePassword()` but none were wired up.
- **Impact:** Users who forgot their password had no self-service recovery path. Authenticated users could not change their password.

### 3. Notifications Panel - NON-FUNCTIONAL (Medium)
- **Problem:** Bell icon in header was purely decorative -- no click handler, no dropdown, no data.
- **Root cause:** Marked with `LOW-13: Badge hidden until real notification system is implemented`.
- **Impact:** Users clicking the bell icon got no response.

### 4. Admin Backend API - MISSING (Critical)
- **Problem:** ALL 8 `/api/v1/admin/*` endpoints (users CRUD, system config, audit logs, current admin) had **no backend Lambda**. Every API call from the settings panel returned 404 in production.
- **Root cause:** Frontend was built ahead of backend. No `AdminFunction` Lambda existed in `template.yaml`.
- **Impact:** Settings panel user management, system config, and audit logs were entirely non-functional in production.

### 5. Cognito Groups Mismatch (High)
- **Problem:** Cognito had 5 groups (`admin`, `manager`, `support`, `reports_viewer`, `distributor`) but the frontend defined 8 roles (`super_admin`, `admin`, `operations_manager`, `customer_support`, `finance_team`, `kyc_reviewer`, `inventory_manager`, `reports_viewer`).
- **Root cause:** Cognito infrastructure was set up with a simplified role set, while the frontend was designed with a more granular permission model.
- **Impact:** Users assigned to missing roles (e.g., `kyc_reviewer`) would fail `buildAdminUserFromSession()` and be rejected at login.

### 6. Orphaned Components (Low)
- **Problem:** 5 components in `components/settings/` imported non-existent API functions (`fetchAdminUsers`, `fetchSystemConfig`, `fetchNotificationTemplates`, etc.) and were never used by the active settings page.
- **Impact:** Dead code with broken imports. Test file also tested non-existent function signatures.

---

## Changes Implemented

### Phase 1: Password Flows (Cognito SDK - No Backend Needed)

| File | Change |
|------|--------|
| `src/lib/auth/cognito.ts` | Added `forgotPassword()`, `confirmForgotPassword()`, `changePassword()` helpers wrapping Cognito SDK |
| `src/lib/store/auth-store.ts` | Added `forgotPassword`, `confirmForgotPassword`, `changePassword` actions to Zustand auth store |
| `src/app/(auth)/login/page.tsx` | Added "Forgot password?" link, email verification step, and reset password step (code + new password) |
| `src/app/(dashboard)/settings/_client.tsx` | Added 5th "Security" tab with change password form (validates 12+ chars, uppercase, lowercase, numbers, symbols per Cognito password policy) |

### Phase 2: Profile Page

| File | Change |
|------|--------|
| `src/app/(dashboard)/settings/profile/page.tsx` | **New** - Route wrapper following existing pattern |
| `src/app/(dashboard)/settings/profile/_client.tsx` | **New** - Profile page with avatar, user info, role badge, department, and change password form |

### Phase 3: Notifications Panel

| File | Change |
|------|--------|
| `src/components/layout/notifications-dropdown.tsx` | **New** - Dropdown with empty state ("No notifications"), click-outside-to-close |
| `src/components/layout/header.tsx` | Wired bell icon with `onClick` handler, dropdown state management |

### Phase 4: Cognito Groups Alignment

| File | Change |
|------|--------|
| `infrastructure/aws/cognito.yaml` | Renamed groups and added missing ones: `super_admin` (P:0), `admin` (P:1), `operations_manager` (P:2), `customer_support` (P:3), `finance_team` (P:4), `kyc_reviewer` (P:5), `inventory_manager` (P:6), `reports_viewer` (P:7), `distributor` (P:8) |
| `scripts/create-cognito-users.sh` | Updated seed users to cover all 7 admin roles |
| `services/shared/middleware/authorization.ts` | Updated `Role` type union, `isAdminOrManager()`, and `isAdminStaff()` to recognize new role names |

### Phase 5: Admin Service Lambda Backend

| File | Change |
|------|--------|
| `services/admin-service/src/index.ts` | **New** - Lambda handler for all 8 admin endpoints: `GET /admin/me`, `GET/POST /admin/users`, `GET/PATCH /admin/users/{id}`, `GET /admin/config`, `PATCH /admin/config/{id}`, `GET /admin/audit-logs` |
| `template.yaml` | Added `AdminFunction` Lambda with API Gateway events, Cognito IAM permissions (`AdminCreateUser`, `AdminAddUserToGroup`, etc.), and `CognitoUserPoolId` parameter |

**Admin Service Features:**
- Cognito user creation via `AdminCreateUserCommand` (sends email invite)
- Cognito group management on role changes
- DB field mapping (`full_name` <-> `first_name`/`last_name`, `status` <-> `is_active`)
- Audit logging for all write operations
- Paginated list endpoints with search and filtering
- Role-based access control (super_admin/admin for writes, admin staff for reads)

### Phase 6: Cleanup

| File | Change |
|------|--------|
| `src/components/settings/` (5 files) | **Deleted** - `audit-log.tsx`, `notification-templates.tsx`, `roles-permissions.tsx`, `system-config.tsx`, `user-management.tsx` |
| `src/__tests__/lib/api-settings.test.ts` | Rewritten to test actual API module exports |

---

## Settings Panel - Tab Inventory (Post-Implementation)

| Tab | Status | API Endpoints | Backend |
|-----|--------|---------------|---------|
| Users | Working | `GET/POST/PATCH /admin/users` | AdminFunction Lambda |
| System Config | Working | `GET/PATCH /admin/config` | AdminFunction Lambda |
| Audit Log | Working | `GET /admin/audit-logs` | AdminFunction Lambda |
| Roles | Working (read-only) | N/A (hardcoded frontend) | Not needed |
| Security | **New** | Cognito SDK direct | Not needed |

---

## User Management - How to Add Users

### Via Admin Dashboard (Recommended)
1. Login as `super_admin` or `admin` role
2. Navigate to Settings > Users tab
3. Click "Add User" button
4. Fill in: First Name, Last Name, Email, Role
5. Submit -- creates Cognito user (with email invite) and DB record

### Via CLI (Fallback)
```bash
./scripts/create-cognito-users.sh --env=production
```

---

## Deployment Notes

### Cognito Group Migration
After deploying the updated `cognito.yaml`, existing users in old groups (`manager`, `support`) need to be migrated:
```bash
# Move user from 'manager' to 'operations_manager'
aws cognito-idp admin-remove-user-from-group --user-pool-id $POOL --username email --group-name manager
aws cognito-idp admin-add-user-to-group --user-pool-id $POOL --username email --group-name operations_manager
```

### SAM Deploy Parameter
The new `CognitoUserPoolId` parameter must be passed during deployment:
```bash
sam deploy --parameter-overrides "CognitoUserPoolId=$POOL_ID"
```

---

## Build Verification

- `next build` passes with 32 static pages (including new `/settings/profile`)
- 6 pre-existing TypeScript errors remain (unrelated to these changes)
- No new linting warnings introduced

---

## Remaining Recommendations

1. **Notification backend**: The notifications dropdown currently shows an empty state. A real notification system (storing events in DB, WebSocket or polling for real-time updates) would complete this feature.
2. **Profile editing**: Name/email changes require Cognito `AdminUpdateUserAttributes` -- the admin service Lambda supports this but no UI exists yet for self-service profile editing.
3. **MFA setup in profile**: Allow users to set up/manage TOTP MFA from the profile page.
4. **Bulk user import**: For onboarding multiple staff members, a CSV upload feature in the Users tab would be useful.
5. **Session activity log**: Show recent login activity in the profile page (IP, device, timestamp).
