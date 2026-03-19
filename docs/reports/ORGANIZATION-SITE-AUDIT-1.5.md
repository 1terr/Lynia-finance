# Organization Site Audit 1.5 — Wizard Overhaul Plan

**Date:** 2026-03-19
**Scope:** Organization creation/edit UI rebuild + 15 gap fixes
**Status:** Implementation in progress

---

## Context

The current organization creation/edit UI is a single modal form that has a critical data-loss bug (`contact_person` vs `contact_name` mismatch), no error/success feedback, no deactivation toggle, and no validation on org codes. We're replacing it with a **3-step full-page wizard** with real-time validation, auto-suggested org codes, and fixing all 15 audit gaps identified during the UI review.

## Audit Findings (15 Gaps)

| Priority | # | Gap | Impact |
|----------|---|-----|--------|
| CRITICAL | 1 | `contact_person` vs `contact_name` field mismatch | Contact data silently lost on every save |
| HIGH | 2 | No error feedback on create/update failure | Users don't know why operations fail |
| HIGH | 3 | No catch block in form submission | Errors swallowed, no user feedback |
| HIGH | 4 | No success toast on create/update | No confirmation of successful operations |
| MEDIUM | 5 | No activate/deactivate toggle | Cannot manage organization lifecycle |
| MEDIUM | 6 | No delete organization | Cannot remove organizations |
| MEDIUM | 7 | Contact info not on detail page | Data collected but never displayed |
| MEDIUM | 8 | No org_type/status filters on list | Poor discoverability with many organizations |
| MEDIUM | 9 | No member search/filter | Unusable with large member lists |
| MEDIUM | 10 | No member edit/view/delete | Cannot correct import errors |
| LOW | 11 | No org_code format validation | Inconsistent codes, potential DB truncation |
| LOW | 12 | No CSV file size limit | Browser freeze + Lambda timeout on large files |
| LOW | 13 | Sequential member import (N+1) | Timeout on large imports |
| LOW | 14 | No error state on list page | Failed queries show empty table |
| LOW | 15 | SQL string interpolation for is_active | Violates parameterized query rule |

## Design Decisions

| Decision | Choice |
|----------|--------|
| Wizard steps | 3 steps: Identity → Config → Contact |
| Layout | Full page (`/products/organizations/new` and `/products/organizations/:id/edit`) |
| Edit flow | Wizard for both create AND edit |
| Org code validation | Real-time debounced uniqueness check |
| Field name fix | Use `contact_name` (match DB) |
| Org code input | Auto-suggest from type + name |
| Scope | Full overhaul (all 15 gaps) |
| Stepper style | Horizontal pills |
| Navigation guard | In-app confirmation dialog only |
| Delete behavior | Deactivate only — no delete, just toggle active/inactive |

## Reusable Components

| Component | Location |
|-----------|----------|
| ProductWizard (reference pattern) | `components/products/product-wizard.tsx` |
| useMutationWithToast | `hooks/use-mutation-with-toast.ts` |
| useDebouncedValue | `hooks/use-debounced-value.ts` |
| ConfirmationDialog | `components/ui/confirmation-dialog.tsx` |
| useToast | `hooks/use-toast.ts` |

---

## Implementation Plan

### Phase 1: Backend Fixes

#### 1.1 Add org_code uniqueness check endpoint
- **File:** `services/admin-service/src/handlers/organizations.ts`
- New handler: `GET /admin/organizations/check-code?code=GOV_CSC` → `{ available: boolean }`
- **File:** `services/admin-service/src/index.ts` — add route BEFORE `:id` route

#### 1.2 Fix SQL string interpolation for is_active (line 30)
- Parameterize the `is_active` filter

#### 1.3 Add org_code format validation
- Regex: `/^[A-Z0-9_]{2,50}$/`

### Phase 2: Frontend Type Fixes
- **File:** `frontend/apps/admin-portal/src/types/index.ts`
- Rename `contact_person` → `contact_name` in `Organization` and `CreateOrganizationInput`

### Phase 3: API Client Updates
- **File:** `frontend/apps/admin-portal/src/lib/api/products.ts`
- Add `checkOrgCode()` function

### Phase 4: Organization Wizard Component (NEW)
- **File:** `frontend/apps/admin-portal/src/components/products/organization-wizard.tsx`
- 3-step wizard following `product-wizard.tsx` pattern
- Step 1: Identity (org_type, org_name, org_code with auto-suggest + real-time check, is_active toggle in edit mode)
- Step 2: Verification & Scoring (method, API endpoint, trust level slider)
- Step 3: Contact (contact_name, phone, email)
- Per-step validation blocking navigation
- Horizontal pills stepper UI
- Navigation guard with ConfirmationDialog
- `useMutationWithToast` for create/update

### Phase 5: New Routes
- `frontend/.../organizations/new/page.tsx` — create wizard
- `frontend/.../organizations/[id]/edit/page.tsx` — edit wizard

### Phase 6: Update List Page
- Remove modal, link "+ Add" to `/new` route
- Add org_type and is_active filter dropdowns
- Add error state with retry

### Phase 7: Update Detail Page
- Remove modal, link Edit to `/edit` route
- Add Contact Information card
- Add Activate/Deactivate button with ConfirmationDialog
- Add member search/filter
- Use `useMutationWithToast`

### Phase 8: Member Import Improvements
- Frontend: 5MB file size limit, 5000 row limit
- Backend: 5000 member array limit, search/filter on GET members

### Phase 9: Tests
- Update mock field names (`contact_person` → `contact_name`)
- New `organization-wizard.test.tsx` with 15 test cases

### Phase 10: Cleanup
- Delete `organization-form.tsx` and its test file

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `services/admin-service/src/handlers/organizations.ts` | Edit | 1, 8 |
| `services/admin-service/src/index.ts` | Edit | 1 |
| `frontend/.../src/types/index.ts` | Edit | 2 |
| `frontend/.../src/lib/api/products.ts` | Edit | 3 |
| `frontend/.../src/components/products/organization-wizard.tsx` | **Create** | 4 |
| `frontend/.../src/app/.../organizations/new/page.tsx` | **Create** | 5 |
| `frontend/.../src/app/.../organizations/[id]/edit/page.tsx` | **Create** | 5 |
| `frontend/.../src/app/.../organizations/_client.tsx` | Edit | 6 |
| `frontend/.../src/app/.../organizations/[id]/_client.tsx` | Edit | 7 |
| `frontend/.../src/components/products/member-import-modal.tsx` | Edit | 8 |
| `frontend/.../src/test/mocks/organizations.ts` | Edit | 9 |
| `frontend/.../src/components/products/__tests__/organization-wizard.test.tsx` | **Create** | 9 |
| `frontend/.../src/components/products/organization-form.tsx` | **Delete** | 10 |
| `frontend/.../src/components/products/__tests__/organization-form.test.tsx` | **Delete** | 10 |

**Total: 10 files modified, 3 files created, 2 files deleted**

## Verification Checklist

1. Create flow: wizard opens at `/products/organizations/new`
2. Step 1: org code auto-suggests, duplicate code shows red indicator
3. Step navigation: validation blocks progression on empty required fields
4. Step 2: API endpoint appears for API method, trust level auto-sets by org type
5. Step 3: contact_name saves correctly (critical bug fix verified)
6. Edit flow: wizard pre-populates at `/products/organizations/:id/edit`
7. Nav guard: confirmation dialog on cancel with dirty form
8. Deactivate: confirmation dialog → badge changes
9. Filters: org_type and status dropdowns filter table
10. Import limits: 10MB CSV shows error
11. Error toast: duplicate code shows error
12. Success toast: create redirects to list with toast
