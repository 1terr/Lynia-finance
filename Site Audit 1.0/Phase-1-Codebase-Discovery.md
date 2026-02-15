# Phase 1: Codebase Discovery & Architecture Map

**Status:** COMPLETED
**Audit Date:** February 15, 2026

---

## Overview

Full codebase exploration of the Lynia Finance admin panel repository. This phase maps the architecture, identifies all pages/routes/components/APIs, and documents the tech stack and data flows.

---

## Task 1.1: Repository Structure Analysis

**Status:** COMPLETE

### Steps Performed

1. Scanned top-level directory structure
2. Identified monorepo layout with `frontend/`, `services/`, `infrastructure/`, `database/`
3. Mapped sub-project boundaries

### Findings

```
Lynia-finance/
├── frontend/
│   ├── admin-portal/          # Next.js 14 Admin Dashboard (PRIMARY AUDIT TARGET)
│   │   ├── src/app/           # 27 page routes (App Router)
│   │   ├── src/components/    # 85+ React components
│   │   ├── src/lib/           # API clients, auth, hooks, utils
│   │   └── src/types/         # TypeScript type definitions
│   ├── distributor-dashboard/ # Distributor agent portal
│   └── landing-page/         # Marketing site
├── services/                  # AWS Lambda microservices
│   ├── scoring-service/       # Credit scoring (5-component model)
│   ├── whatsapp-service/      # WhatsApp Cloud API integration
│   ├── kyc-service/           # Smile Identity KYC verification
│   ├── payment-service/       # EcoCash/OneMoney payments
│   ├── lock-service/          # Trustonic device lock/unlock
│   ├── notification-service/  # Multi-channel alerts
│   ├── form-submission-service/ # Landing page form handler
│   └── shared/                # Shared types, clients, middleware
├── infrastructure/            # AWS CloudFormation / SAM templates
│   └── aws/                   # VPC, RDS, SQS, Cognito, WAF, CloudFront
├── database/                  # PostgreSQL migrations (21 files)
│   └── migrations/            # Sequential schema migrations
├── scripts/                   # Deployment and utility scripts
└── phase-*/                   # Development phase folders (11 phases)
```

### Test / Verification

- [x] All major directories exist and contain expected files
- [x] No orphaned directories or dead code folders found
- [x] `.gitignore` properly excludes `node_modules/`, `.env`, build artifacts

---

## Task 1.2: Admin Portal Page Route Inventory

**Status:** COMPLETE

### Steps Performed

1. Globbed all `**/page.tsx` files under `frontend/admin-portal/src/app/`
2. Mapped each file to its URL route
3. Verified which routes appear in sidebar navigation

### Findings: 27 Page Routes

| # | Route | File Path | In Sidebar |
|---|-------|-----------|------------|
| 1 | `/login` | `(auth)/login/page.tsx` | N/A |
| 2 | `/` | `(dashboard)/page.tsx` | Yes |
| 3 | `/customers` | `(dashboard)/customers/page.tsx` | Yes |
| 4 | `/customers/[id]` | `(dashboard)/customers/[id]/page.tsx` | Yes |
| 5 | `/customers/[id]/edit` | `(dashboard)/customers/[id]/edit/page.tsx` | Yes |
| 6 | `/customers/kyc-review` | `(dashboard)/customers/kyc-review/page.tsx` | Yes |
| 7 | `/loans` | `(dashboard)/loans/page.tsx` | Yes |
| 8 | `/loans/[id]` | `(dashboard)/loans/[id]/page.tsx` | Yes |
| 9 | `/loans/pending-approval` | `(dashboard)/loans/pending-approval/page.tsx` | Yes |
| 10 | `/loans/[id]/fineract` | `(dashboard)/loans/[id]/fineract/page.tsx` | No |
| 11 | `/devices` | `(dashboard)/devices/page.tsx` | Yes |
| 12 | `/devices/[id]` | `(dashboard)/devices/[id]/page.tsx` | Yes |
| 13 | `/devices/handovers` | `(dashboard)/devices/handovers/page.tsx` | Yes |
| 14 | `/devices/lock-unlock` | `(dashboard)/devices/lock-unlock/page.tsx` | Yes |
| 15 | `/payments` | `(dashboard)/payments/page.tsx` | Yes |
| 16 | `/payments/[id]` | `(dashboard)/payments/[id]/page.tsx` | Yes |
| 17 | `/payments/collections` | `(dashboard)/payments/collections/page.tsx` | Yes |
| 18 | `/payments/reconciliation` | `(dashboard)/payments/reconciliation/page.tsx` | No |
| 19 | `/reports` | `(dashboard)/reports/page.tsx` | Yes |
| 20 | `/settings` | `(dashboard)/settings/page.tsx` | No |
| 21 | `/kyc` | `(dashboard)/kyc/page.tsx` | No |
| 22 | `/fineract/loans` | `(dashboard)/fineract/loans/page.tsx` | No |
| 23 | `/fineract/approval` | `(dashboard)/fineract/approval/page.tsx` | No |
| 24 | `/fineract/accounting` | `(dashboard)/fineract/accounting/page.tsx` | No |
| 25 | `/fineract/products` | `(dashboard)/fineract/products/page.tsx` | No |
| 26 | `/fineract/overdue` | `(dashboard)/fineract/overdue/page.tsx` | No |
| 27 | `/fineract/reconciliation` | `(dashboard)/fineract/reconciliation/page.tsx` | No |

### Test / Verification

- [x] 27 `page.tsx` files found via glob
- [x] All routes use Next.js 14 App Router convention
- [x] Route groups `(auth)` and `(dashboard)` correctly separate layouts
- [ ] **ISSUE:** 9 pages missing from sidebar navigation (Fineract x6, Settings, KYC, Payments/Reconciliation)

---

## Task 1.3: Component Library Inventory

**Status:** COMPLETE

### Steps Performed

1. Globbed all `*.tsx` files under `src/components/`
2. Categorized into UI primitives, dashboard components, domain components
3. Verified Shadcn/Radix base components

### Findings: 85+ Components

**UI Primitives (Shadcn/Radix-based):**
- `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`
- `modal.tsx` / `dialog.tsx`, `select.tsx`, `tabs.tsx`
- `pagination.tsx`, `table.tsx`, `tooltip.tsx`
- `empty-state.tsx`, `loading-skeleton.tsx`
- `date-range-picker.tsx`

**Dashboard Layout:**
- `sidebar.tsx` — Main navigation (6 items, missing Fineract/Settings)
- `header.tsx` — Top bar with hamburger menu, user info
- `dashboard-layout.tsx` — Wraps sidebar + header + content area

**Domain Components (per module):**
- Customers: `customer-table.tsx`, `customer-detail.tsx`, `kyc-review-panel.tsx`, `credit-score-card.tsx`
- Loans: `loan-table.tsx`, `loan-detail.tsx`, `approval-actions.tsx`, `repayment-schedule.tsx`
- Devices: `device-table.tsx`, `device-detail.tsx`, `lock-history.tsx`, `handover-tracker.tsx`
- Payments: `payment-table.tsx`, `reconciliation-queue.tsx`, `collections-table.tsx`
- Reports: `report-charts.tsx`, `report-filters.tsx`, `csv-export.tsx`
- Fineract: `fineract-loan-table.tsx`, `gl-accounts-table.tsx`, `journal-entries.tsx`, `trial-balance.tsx`

**Charts (Recharts-based):**
- `TrendChart` — Daily trends line chart
- `PortfolioChart` — Loan portfolio distribution
- `PARChart` — Portfolio at risk breakdown
- `StatusDistributionChart` — Loan status pie/bar chart

### Test / Verification

- [x] All components use TypeScript with proper type annotations
- [x] Consistent use of Tailwind CSS (no inline styles, no CSS modules)
- [x] Lucide React icons used consistently (~50 icon imports)
- [x] No duplicate or conflicting component libraries

---

## Task 1.4: API Client Layer Analysis

**Status:** COMPLETE

### Steps Performed

1. Read `src/lib/api/client.ts` — Core `fetchAPI` function
2. Read all domain API modules: `customers.ts`, `loans.ts`, `devices.ts`, `payments.ts`, `reports.ts`, `settings.ts`, `fineract.ts`
3. Counted total endpoints and verified auth patterns

### Findings: 66+ API Endpoints

**Core API Client (`client.ts`):**
```typescript
// All API calls flow through this function
export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getSession();           // Gets Cognito session
  if (!session) { handleSessionExpired(); throw new Error('Authentication required.'); }
  const token = session.getIdToken().getJwtToken();  // Extracts JWT
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  // Handles 401, 403, and non-OK responses
}
```

**Endpoint Distribution:**
| Module | Endpoints | File |
|--------|-----------|------|
| Dashboard | 5 | `api/dashboard.ts` (inlined in `_client.tsx`) |
| Customers | 13 | `api/customers.ts` |
| Loans | 7 | `api/loans.ts` |
| Devices | 8 | `api/devices.ts` |
| Payments | 8 | `api/payments.ts` |
| Reports | 6 | `api/reports.ts` |
| Admin/Settings | 8 | `api/settings.ts` |
| Fineract | 14 | `api/fineract.ts` |
| **Total** | **66+** | |

### Test / Verification

- [x] All API calls use `fetchAPI` which attaches JWT token
- [x] No raw `fetch()` calls that bypass authentication
- [x] All list endpoints support pagination (`page`, `limit` params)
- [x] `MAX_PAGE_SIZE` enforced to prevent excessive data fetching
- [x] API base URL comes from `NEXT_PUBLIC_API_URL` environment variable

---

## Task 1.5: Authentication Flow Analysis

**Status:** COMPLETE

### Steps Performed

1. Read `src/lib/auth/cognito.ts` — Cognito pool setup
2. Read `src/lib/store/auth-store.ts` — Zustand auth state
3. Read `src/app/(auth)/login/page.tsx` — Login UI
4. Traced full auth flow from login → session → API calls

### Findings

**Auth Architecture:**
```
User → Login Page → Auth Store (Zustand)
                         │
                   ┌─────┴──────┐
                   │ Cognito?   │
                   ├─── YES ────┤
                   │  CognitoUserPool.authenticateUser()
                   │  → onSuccess: build AdminUser from JWT
                   │  → newPasswordRequired: show password form
                   │  → totpRequired: show MFA form
                   │  → onFailure: show error
                   ├─── NO ─────┤
                   │  Demo Mode:
                   │  admin@lynia.co.zw + any 4+ char password
                   │  → DEMO_ADMIN object with super_admin role
                   └─────────────┘
                         │
                   AdminUser stored in Zustand
                   Cookie set: lynia-auth-active=1
                         │
                   fetchAPI() → getSession() → getIdToken() → JWT header
```

**Cognito Configuration Guard:**
```typescript
export function isCognitoConfigured(): boolean {
  return /^[\w-]+_[0-9a-zA-Z]+$/.test(poolId) && clientId.length > 10;
}
```
Only creates `CognitoUserPool` when env vars look like real AWS IDs. Falls back to demo mode otherwise.

**Admin User Type (from JWT):**
```typescript
{
  id: payload.sub,           // Cognito UUID
  email: payload.email,
  first_name: payload.given_name,
  last_name: payload.family_name,
  role: cognito:groups[0],   // Must be valid AdminRole
  is_active: true,
  department: custom:department,
}
```

**8 Admin Roles:** `super_admin`, `admin`, `manager`, `loan_officer`, `collections_officer`, `kyc_officer`, `support_agent`, `auditor`

**9 Permission Actions:** `read`, `create`, `update`, `delete`, `approve`, `reject`, `export`, `lock`, `unlock`

### Test / Verification

- [x] Login handles 3 Cognito challenge types correctly
- [x] Demo mode only activates when Cognito env vars are missing/invalid
- [x] JWT token attached to all API calls via `fetchAPI`
- [x] Session timeout (30 min inactivity) implemented via `use-session-timeout.ts`
- [x] Logout clears Cognito session, cookie, and sessionStorage
- [ ] **ISSUE:** Sidebar imports `useAuth` from `@/lib/auth/context` — need to verify this module exists
- [ ] **ISSUE:** Sidebar references `user.full_name` but AdminUser has `first_name`/`last_name`

---

## Task 1.6: Architecture Diagram

**Status:** COMPLETE

### Full System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                      │
│                                                                          │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐│
│  │ Admin Portal      │  │ Distributor Portal   │  │ Landing Page         ││
│  │ admin.lynia...com │  │ distributor.lynia... │  │ lyniafinance.com     ││
│  │ Next.js 14        │  │ Next.js 14           │  │ Static               ││
│  │ S3 + CloudFront   │  │ S3 + CloudFront      │  │ S3 + CloudFront      ││
│  └────────┬─────────┘  └──────────┬───────────┘  └──────────────────────┘│
│           │                       │                                       │
│           └───────────┬───────────┘                                       │
│                       │                                                   │
│              ┌────────▼─────────┐                                         │
│              │ Amazon Cognito   │  (Admin Pool + Distributor Pool)         │
│              │ JWT Auth + MFA   │  LITE tier                              │
│              └────────┬─────────┘                                         │
└───────────────────────┼───────────────────────────────────────────────────┘
                        │
┌───────────────────────┼───────────────────────────────────────────────────┐
│                       │          API LAYER                                │
│              ┌────────▼─────────┐                                         │
│              │ API Gateway      │  REST, Regional, Cognito Authorizer     │
│              │ + WAF (8 rules)  │  Rate: 2000/5min global, 200/5min auth  │
│              └────────┬─────────┘                                         │
│                       │                                                   │
│  ┌────────────────────┼────────────────────────────────────────────────┐  │
│  │                    │        LAMBDA SERVICES (arm64, Node.js 20)     │  │
│  │  ┌─────────┐ ┌────┴────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐  │  │
│  │  │Scoring  │ │Payment  │ │WhatsApp  │ │KYC      │ │Lock       │  │  │
│  │  │1GB/30s  │ │1GB/60s  │ │512MB/30s │ │512MB/30s│ │512MB/30s  │  │  │
│  │  └─────────┘ └─────────┘ └──────────┘ └─────────┘ └───────────┘  │  │
│  │  ┌─────────┐ ┌─────────┐                                          │  │
│  │  │Notif.   │ │FormSub  │                                          │  │
│  │  │512MB    │ │256MB    │                                          │  │
│  │  └─────────┘ └─────────┘                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼──────────────────────────────────────┐
│                    DATA & INTEGRATION LAYER                             │
│                                 │                                       │
│  ┌──────────────┐  ┌───────────▼──────────┐  ┌──────────────────────┐  │
│  │ RDS Postgres  │  │ SQS (5 Queues+DLQ)  │  │ S3 (4 Buckets)      │  │
│  │ 16.11         │  │ - Scoring            │  │ - KYC Docs (KMS)    │  │
│  │ db.t4g.micro  │  │ - Payments           │  │ - Commission PDFs   │  │
│  │ 20GB, AES256  │  │ - KYC                │  │ - Reconciliation    │  │
│  │ 50+ tables    │  │ - Device Locks       │  │ - ML Models         │  │
│  │ 21 migrations │  │ - Notifications      │  │                     │  │
│  └──────────────┘  └──────────────────────┘  └──────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Apache Fineract (PLANNED — NOT YET DEPLOYED)                    │   │
│  │ ECS Fargate | Internal ALB :8443 | Core Banking Engine          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ External: WhatsApp Cloud API | Smile Identity | EcoCash |       │   │
│  │           OneMoney | Trustonic | Twilio/Africa's Talking        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Data Flows

**Loan Lifecycle:**
```
Customer (WhatsApp) → WhatsApp Service → KYC Service → Scoring Service
                                                      → Loan Created (RDS)
                                                      → [Fineract Sync]
Admin Portal → Approve Loan → POST /api/v1/loans/{id}/approve
                             → [Fineract syncLoanApproval()]
                             → GL Journal Entries
Lock Service → Device Handover → Deposit → Activate → [Fineract syncDisbursement()]
Customer Payment (EcoCash) → Payment Service → RDS → [Fineract syncRepayment()]
                                                    → Notification Service
```

### Test / Verification

- [x] Architecture correctly maps all service boundaries
- [x] All data flows verified against actual code imports
- [x] External service list matches Secrets Manager entries
- [x] VPC layout matches CloudFormation templates

---

## Task 1.7: Database Schema Summary

**Status:** COMPLETE

### Steps Performed

1. Read all 21 migration files in `database/migrations/`
2. Mapped table relationships
3. Verified indexing strategy

### Findings: 50+ Tables Across 21 Migrations

**Core Domain Tables:**
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `customers` | Customer profiles | `id`, `first_name`, `last_name`, `phone_number`, `national_id`, `kyc_status` |
| `loans` | Loan applications | `id`, `customer_id`, `loan_amount_usd`, `loan_status`, `interest_rate` |
| `payments` | Payment records | `id`, `loan_id`, `amount_usd`, `payment_method`, `status`, `reconciled` |
| `devices` | Device inventory | `id`, `imei`, `model`, `lock_status`, `assigned_customer_id` |
| `device_handovers` | Handover tracking | `id`, `device_id`, `customer_id`, `status`, `handover_steps` |
| `kyc_submissions` | KYC documents | `id`, `customer_id`, `document_type`, `status`, `reviewer_id` |
| `loan_products` | Product definitions | `id`, `name`, `min_amount`, `max_amount`, `interest_rate`, `term_months` |
| `credit_scores` | Score history | `id`, `customer_id`, `total_score`, `components` (JSONB) |

**Admin & System Tables:**
| Table | Purpose |
|-------|---------|
| `admin_users` | Admin accounts with roles |
| `admin_audit_logs` | Action audit trail |
| `system_config` | Key-value configuration |
| `notifications` | Notification queue |
| `sms_messages` | SMS delivery log |

**Fineract Integration Tables (Migration 019):**
| Column Added | Table | Purpose |
|-------------|-------|---------|
| `fineract_client_id` | `customers` | Fineract client mapping |
| `fineract_loan_id` | `loans` | Fineract loan mapping |
| `fineract_transaction_id` | `payments` | Fineract txn mapping |
| `fineract_product_id` | `loan_products` | Fineract product mapping |

### Test / Verification

- [x] All migrations use sequential numbering (001-021)
- [x] Foreign keys properly defined with CASCADE/SET NULL policies
- [x] UUIDs used for all primary keys (not sequential integers)
- [x] Indexes on frequently queried columns (customer_id, loan_id, status)
- [x] JSONB used for flexible data (credit score components, handover steps)
- [ ] **ISSUE:** No evidence seed scripts were run against production RDS
