# Phase 3 Development Tasks

**Phase**: Phase 3 - Frontend Applications & Features
**Duration**: 4 weeks (Weeks 11-14)
**Status**: Not Started
**Goal**: Build user-facing frontends and advanced features
**Total Tasks**: 29
**Estimated Hours**: 380 hours
**Created**: February 5, 2026

---

## Executive Summary

Phase 3 focuses on building user-facing frontend applications and implementing advanced features on top of the completed backend infrastructure (Phase 2). The primary deliverables are:

1. **Admin Dashboard** - Operations team web portal (10 tasks, 148 hours)
2. **Distributor Portal** - Device handover management app (3 tasks, 40 hours)
3. **Advanced Features** - WhatsApp, Credit Scoring, Payments, Devices (16 tasks, 192 hours)

---

## Task Overview

| Task ID | Task Name | Priority | Estimate | Status | Dependencies | Category |
|---------|-----------|----------|----------|--------|--------------|----------|
| P3-T001 | Core Setup & Layout | Critical | 12h | ⚪ | P2-T011 | Admin Dashboard |
| P3-T002 | Dashboard Home & KPIs | Critical | 16h | ⚪ | P3-T001 | Admin Dashboard |
| P3-T003 | Loan Management | Critical | 20h | ⚪ | P3-T002 | Admin Dashboard |
| P3-T004 | Customer Management | High | 16h | ⚪ | P3-T002 | Admin Dashboard |
| P3-T005 | Payment Management | High | 16h | ⚪ | P3-T002 | Admin Dashboard |
| P3-T006 | Device Management | High | 16h | ⚪ | P3-T002 | Admin Dashboard |
| P3-T007 | KYC Review Queue | High | 12h | ⚪ | P3-T002 | Admin Dashboard |
| P3-T008 | Reports & Analytics | Medium | 16h | ⚪ | P3-T002 | Admin Dashboard |
| P3-T009 | Settings & Configuration | Medium | 12h | ⚪ | P3-T002 | Admin Dashboard |
| P3-T010 | Testing & Optimization | High | 12h | ⚪ | P3-T001-T009 | Admin Dashboard |
| P3-T011 | Distributor Portal Setup | High | 12h | ⚪ | - | Distributor Portal |
| P3-T012 | Device Handover Interface | Critical | 16h | ⚪ | P3-T011 | Distributor Portal |
| P3-T013 | Inventory & Commission Tracking | High | 12h | ⚪ | P3-T011 | Distributor Portal |
| P3-T014 | Payment Reminders | High | 8h | ⚪ | P2-T006, P2-T007 | WhatsApp Features |
| P3-T015 | Loan Management Commands | Medium | 8h | ⚪ | P2-T006 | WhatsApp Features |
| P3-T016 | Multi-Language Support | Low | 12h | ⚪ | P2-T006 | WhatsApp Features |
| P3-T017 | ML Model Training Pipeline | Medium | 20h | ⚪ | P2-T004 | Credit Scoring |
| P3-T018 | Alternative Data Integration | Low | 16h | ⚪ | P2-T004 | Credit Scoring |
| P3-T019 | Payment Plans & Restructuring | Medium | 12h | ⚪ | P2-T003 | Payment Features |
| P3-T020 | Additional Payment Methods | Low | 12h | ⚪ | P2-T003 | Payment Features |
| P3-T021 | Device Repossession Workflow | Medium | 12h | ⚪ | P2-T010 | Device Management |
| P3-T022 | Device Condition Monitoring | Low | 8h | ⚪ | P2-T010 | Device Management |
| P3-T023 | Advanced Analytics Dashboard | Medium | 16h | ⚪ | P3-T008 | Analytics & BI |
| P3-T024 | Data Export & API | Medium | 12h | ⚪ | P3-T008 | Analytics & BI |
| P3-T025 | Customer Support Ticketing | High | 16h | ⚪ | P3-T004 | Operations |
| P3-T026 | Referral Program | Low | 12h | ⚪ | - | Operations |
| P3-T027 | Fraud Detection System | High | 20h | ⚪ | P2-T004 | Operations |
| P3-T028 | Regulatory Reporting (RBZ) | High | 12h | ⚪ | P3-T008 | Compliance |
| P3-T029 | Data Privacy Features | High | 12h | ⚪ | - | Compliance |

**Total Estimated Time**: 380 hours

---

## Category 1: Admin Dashboard Frontend (10 tasks | 148 hours)

Critical path for operations team functionality.

---

### P3-T001: Core Setup & Layout

**Priority**: 🔴 Critical
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T011 (Admin Dashboard Specs)
**Blocks**: P3-T002, P3-T003, P3-T004, P3-T005, P3-T006, P3-T007, P3-T008, P3-T009

**Objective**: Initialize Next.js 14 project with TypeScript, Tailwind CSS, shadcn/ui components, and Supabase Auth integration. Create reusable layout components including sidebar, header, and protected route wrapper.

**Tasks**:
- [ ] Initialize Next.js 14 project with App Router
- [ ] Configure TypeScript with strict mode
- [ ] Set up Tailwind CSS with custom theme (Lynia brand colors)
- [ ] Install and configure shadcn/ui components (10+ components)
- [ ] Set up Supabase client for SSR (`@supabase/ssr`)
- [ ] Implement login page with email/password
- [ ] Implement forgot password flow
- [ ] Create Sidebar component with navigation items
- [ ] Create Header component with user menu
- [ ] Create Footer component
- [ ] Create Breadcrumbs component
- [ ] Implement ProtectedRoute wrapper with auth check
- [ ] Add dark mode support with theme toggle
- [ ] Configure middleware for auth redirect
- [ ] Set up error boundary components

**Deliverables**:
```
frontend/admin-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + Header
│   │   └── page.tsx                # Dashboard home
│   └── layout.tsx                  # Root layout
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Breadcrumbs.tsx
│   └── auth/
│       ├── LoginForm.tsx
│       └── ProtectedRoute.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   └── utils.ts
├── middleware.ts                   # Auth middleware
├── tailwind.config.ts
└── next.config.js
```

**Success Criteria**:
- [ ] Next.js 14 project initialized with App Router
- [ ] Tailwind CSS configured with custom Lynia theme
- [ ] 10+ shadcn/ui components installed and configured
- [ ] Login/logout flow working with Supabase Auth
- [ ] Protected route wrapper redirecting unauthenticated users
- [ ] Responsive sidebar navigation (collapsible on mobile)
- [ ] Dark mode support with persistent preference
- [ ] All components have TypeScript types

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 25 | Components, utils, hooks |
| Integration Tests | 12 | Auth flow, navigation |
| E2E Tests | 8 | Login, logout, protected routes |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `phase-3-frontend/PHASE-3-TDD-SUBTASKS.md`
- `planning/admin-dashboard/admin-dashboard-features.md`

---

### P3-T002: Dashboard Home & KPIs

**Priority**: 🔴 Critical
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T001
**Blocks**: P3-T003, P3-T004, P3-T005, P3-T006, P3-T007, P3-T008, P3-T009

**Objective**: Build the main dashboard home page with 12 KPI metric cards, trend charts, recent activity feed, and system alerts panel. Implement real-time data fetching with React Query.

**Tasks**:
- [ ] Create MetricCard component with icon, value, trend indicator
- [ ] Create MetricsGrid component (responsive 4x3 grid)
- [ ] Implement 12 KPI cards (see list below)
- [ ] Create TrendChart component using Recharts
- [ ] Create RecentActivity component with activity feed
- [ ] Create AlertsPanel component for system notifications
- [ ] Create DateRangePicker component for filtering
- [ ] Set up React Query for data fetching
- [ ] Implement auto-refresh every 30 seconds
- [ ] Add loading skeletons for all data components
- [ ] Create dashboard data hooks (`useDashboardMetrics`, `useRecentActivity`)
- [ ] Implement date range filtering (today, 7d, 30d, custom)

**12 KPI Cards**:
```typescript
const DASHBOARD_KPIS = [
  // Row 1: Loan Metrics
  { id: 'active_loans', title: 'Active Loans', icon: 'CreditCard' },
  { id: 'total_disbursed', title: 'Total Disbursed', icon: 'DollarSign' },
  { id: 'outstanding_balance', title: 'Outstanding Balance', icon: 'Wallet' },
  { id: 'collection_rate', title: 'Collection Rate', icon: 'TrendingUp' },

  // Row 2: Customer Metrics
  { id: 'active_customers', title: 'Active Customers', icon: 'Users' },
  { id: 'pending_kyc', title: 'Pending KYC', icon: 'FileCheck' },
  { id: 'pending_approvals', title: 'Pending Approvals', icon: 'Clock' },
  { id: 'default_rate', title: 'Default Rate', icon: 'AlertTriangle' },

  // Row 3: Device Metrics
  { id: 'devices_assigned', title: 'Devices Assigned', icon: 'Smartphone' },
  { id: 'devices_available', title: 'Devices Available', icon: 'Package' },
  { id: 'devices_locked', title: 'Devices Locked', icon: 'Lock' },
  { id: 'monthly_revenue', title: 'Monthly Revenue', icon: 'BarChart' }
];
```

**Success Criteria**:
- [ ] 12 KPI cards displaying real-time data from API
- [ ] Trend indicators showing up/down with percentage
- [ ] Date range filter working (today, 7 days, 30 days, custom)
- [ ] Recent activity feed showing last 10 activities
- [ ] System alerts panel with dismiss functionality
- [ ] Auto-refresh every 30 seconds
- [ ] Loading skeletons during data fetch
- [ ] Responsive layout on all screen sizes

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 30 | MetricCard, charts, hooks |
| Integration Tests | 15 | Data fetching, filtering |
| E2E Tests | 5 | Dashboard load, refresh |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/admin-dashboard/dashboard-kpis.md`

---

### P3-T003: Loan Management

**Priority**: 🔴 Critical
**Estimate**: 20 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T002
**Blocks**: P3-T010

**Objective**: Build comprehensive loan management interface with list view, detail view, approval workflow, and payment schedule visualization.

**Tasks**:
- [ ] Create loan list page with DataTable (TanStack Table)
- [ ] Implement advanced filtering (status, tier, date range, amount)
- [ ] Add search by customer name, phone, loan ID
- [ ] Create loan detail page with all loan information
- [ ] Build payment schedule component with timeline visualization
- [ ] Implement approval workflow (approve/reject with notes)
- [ ] Create pending approvals queue page
- [ ] Create overdue loans page with priority sorting
- [ ] Add comments/notes system for loans
- [ ] Implement export to CSV functionality
- [ ] Create loan status badges component
- [ ] Add audit trail display for loan actions

**Pages**:
```
app/(dashboard)/loans/
├── page.tsx                    # Loan list
├── [id]/
│   ├── page.tsx               # Loan detail
│   └── approve/page.tsx       # Approval workflow
├── pending-approval/page.tsx  # Pending queue
└── overdue/page.tsx           # Overdue loans
```

**Success Criteria**:
- [ ] Loan list with 10+ columns and sorting
- [ ] Advanced filters (status, tier, date range, amount range)
- [ ] Export to CSV functionality
- [ ] Loan detail page with full information
- [ ] Payment schedule visualization (timeline/table)
- [ ] Approval workflow with confirmation dialog
- [ ] Audit trail for all actions
- [ ] Responsive design on all screens

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 35 | Table, filters, components |
| Integration Tests | 18 | CRUD operations, workflow |
| E2E Tests | 8 | Approval flow, export |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/loan-management/loan-lifecycle.md`

---

### P3-T004: Customer Management

**Priority**: 🟡 High
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T002
**Blocks**: P3-T010, P3-T025

**Objective**: Build customer management interface with list, profile view, KYC status display, and credit score history.

**Tasks**:
- [ ] Create customer list page with search and filters
- [ ] Implement quick search (name, phone, National ID)
- [ ] Add KYC status filter (pending, verified, rejected)
- [ ] Add credit tier filter (low, medium, high)
- [ ] Create customer profile page with tabs
- [ ] Build KYC document viewer component
- [ ] Create credit score history chart
- [ ] Build loan history per customer
- [ ] Create communication history (WhatsApp messages)
- [ ] Implement customer timeline (all interactions)
- [ ] Add edit customer information form
- [ ] Create customer notes section

**Pages**:
```
app/(dashboard)/customers/
├── page.tsx                   # Customer list
├── [id]/
│   ├── page.tsx              # Customer profile
│   └── edit/page.tsx         # Edit customer
└── kyc-review/page.tsx       # KYC review (shared with P3-T007)
```

**Success Criteria**:
- [ ] Customer list with pagination (20 per page)
- [ ] Quick search functionality (<100ms response)
- [ ] Customer profile with all details in tabs
- [ ] KYC document viewer (ID front/back, selfie)
- [ ] Credit score graph over time
- [ ] Loan history per customer
- [ ] Edit customer information with validation

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 28 | Profile components, search |
| Integration Tests | 14 | Search, filtering, CRUD |
| E2E Tests | 6 | Profile view, edit flow |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/customer-management/customer-profile.md`

---

### P3-T005: Payment Management

**Priority**: 🟡 High
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T002
**Blocks**: P3-T010

**Objective**: Build payment management interface with list view, reconciliation workflow, collections queue, and refund processing.

**Tasks**:
- [ ] Create payment list page with status filters
- [ ] Implement payment detail view
- [ ] Build reconciliation interface (match transactions)
- [ ] Create collections queue with priority sorting
- [ ] Implement manual payment recording form
- [ ] Add failed payment retry functionality
- [ ] Create refund request handling workflow
- [ ] Build payment reports/export
- [ ] Create payment method badges
- [ ] Implement batch operations (mark as reconciled)

**Pages**:
```
app/(dashboard)/payments/
├── page.tsx                   # Payment list
├── [id]/page.tsx             # Payment detail
├── collections/page.tsx       # Collections queue
└── reconciliation/page.tsx    # Reconciliation
```

**Success Criteria**:
- [ ] Payment list with status filters
- [ ] Reconciliation workflow functional
- [ ] Collections queue sorted by priority (days overdue)
- [ ] Manual payment recording with validation
- [ ] Refund processing workflow
- [ ] Export to CSV/Excel

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 25 | Payment components, forms |
| Integration Tests | 12 | Reconciliation, refunds |
| E2E Tests | 5 | Payment recording, export |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/payment-processing/payment-reconciliation.md`

---

### P3-T006: Device Management

**Priority**: 🟡 High
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T002
**Blocks**: P3-T010

**Objective**: Build device inventory management with lock/unlock controls, handover tracking, and distributor assignment.

**Tasks**:
- [ ] Create device inventory list page
- [ ] Implement device status filters (available, assigned, locked)
- [ ] Create device detail page with full history
- [ ] Build lock/unlock control panel with confirmation
- [ ] Create handover scheduling interface
- [ ] Build handover tracking page
- [ ] Implement distributor assignment interface
- [ ] Create device history timeline
- [ ] Add bulk operations (assign multiple, lock multiple)
- [ ] Create IMEI search functionality

**Pages**:
```
app/(dashboard)/devices/
├── page.tsx                   # Device inventory
├── [id]/page.tsx             # Device detail
├── handovers/
│   ├── page.tsx              # Handover schedule
│   └── [id]/page.tsx         # Handover detail
└── lock-unlock/page.tsx       # Device control center
```

**Success Criteria**:
- [ ] Device inventory list with all statuses
- [ ] Lock/unlock controls with confirmation and reason
- [ ] Handover tracking with status updates
- [ ] Distributor assignment interface
- [ ] Device status history timeline
- [ ] Bulk operations functional

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 26 | Device components, controls |
| Integration Tests | 13 | Lock/unlock, handovers |
| E2E Tests | 6 | Lock flow, bulk operations |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/device-management/device-lifecycle.md`

---

### P3-T007: KYC Review Queue

**Priority**: 🟡 High
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T002
**Blocks**: P3-T010

**Objective**: Build KYC review queue with document viewer, side-by-side comparison, approve/reject workflow, and SLA tracking.

**Tasks**:
- [ ] Create KYC queue page sorted by submission date
- [ ] Build document viewer component (zoom, rotate)
- [ ] Create side-by-side comparison (ID photo vs selfie)
- [ ] Implement approve/reject workflow with reason selection
- [ ] Add review history per submission
- [ ] Create SLA indicators (time in queue, overdue)
- [ ] Build escalation interface for edge cases
- [ ] Implement keyboard shortcuts for quick review
- [ ] Add reviewer assignment functionality
- [ ] Create rejection reason templates

**Success Criteria**:
- [ ] KYC queue with priority sorting
- [ ] Document viewer with zoom/rotate
- [ ] Side-by-side comparison functional
- [ ] Approve/reject with reason selection
- [ ] Review history visible
- [ ] SLA tracking and alerts (>24h warning)

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 20 | Document viewer, queue |
| Integration Tests | 10 | Review workflow |
| E2E Tests | 5 | Full review flow |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/kyc/kyc-review-process.md`

---

### P3-T008: Reports & Analytics

**Priority**: 🟢 Medium
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T002
**Blocks**: P3-T010, P3-T023, P3-T024, P3-T028

**Objective**: Build reports dashboard with multiple report types, chart visualizations, date range selection, and export functionality.

**Tasks**:
- [ ] Create reports dashboard page
- [ ] Build Portfolio Report (loan summary, risk distribution)
- [ ] Build Collection Report (payment rates, overdue analysis)
- [ ] Build Disbursement Report (daily/monthly disbursements)
- [ ] Build KYC Report (approval rates, processing times)
- [ ] Build Device Report (inventory, lock/unlock activity)
- [ ] Build Default Report (rates by tier, geography)
- [ ] Implement date range selection for all reports
- [ ] Add chart visualizations (bar, line, pie)
- [ ] Create export to PDF functionality
- [ ] Create export to CSV/Excel functionality
- [ ] Implement scheduled report emails (configuration)

**Report Types**:
1. Portfolio Report - Loan summary, risk distribution
2. Collection Report - Payment rates, overdue analysis
3. Disbursement Report - Daily/monthly disbursements
4. KYC Report - Approval rates, processing times
5. Device Report - Inventory, lock/unlock activity
6. Default Report - Default rates by tier, geography

**Success Criteria**:
- [ ] Reports dashboard with 6+ report types
- [ ] Date range selection for all reports
- [ ] Chart visualizations (bar, line, pie)
- [ ] Export to PDF functional
- [ ] Export to CSV/Excel functional
- [ ] Scheduled report configuration

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 22 | Charts, report components |
| Integration Tests | 11 | Data aggregation |
| E2E Tests | 4 | Report generation, export |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/reporting/report-templates.md`

---

### P3-T009: Settings & Configuration

**Priority**: 🟢 Medium
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T002
**Blocks**: P3-T010

**Objective**: Build system settings page with user management, role/permission management, notification templates, and system configuration.

**Tasks**:
- [ ] Create settings page with tabs/sections
- [ ] Build user management interface (CRUD admins)
- [ ] Create role management (Admin, Manager, Reviewer, Finance)
- [ ] Build permission matrix editor
- [ ] Create notification template editor (WhatsApp, SMS)
- [ ] Build system configuration editor (loan limits, rates)
- [ ] Create audit log viewer with filters
- [ ] Implement password change functionality
- [ ] Add two-factor authentication setup
- [ ] Create API key management

**Roles**:
- Admin - Full access
- Manager - All operations except settings
- Reviewer - KYC and loan review only
- Finance - Payments and reports only

**Success Criteria**:
- [ ] User management interface (add, edit, deactivate)
- [ ] Role creation and assignment
- [ ] Permission management (granular)
- [ ] Notification template editor with preview
- [ ] System config editor with validation
- [ ] Audit log with filters (user, action, date)

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 18 | Forms, permission logic |
| Integration Tests | 9 | User CRUD, roles |
| E2E Tests | 4 | Settings update flow |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/admin-dashboard/settings-configuration.md`

---

### P3-T010: Admin Dashboard Testing & Optimization

**Priority**: 🟡 High
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T001, P3-T002, P3-T003, P3-T004, P3-T005, P3-T006, P3-T007, P3-T008, P3-T009

**Objective**: Write comprehensive tests for all admin dashboard components, implement E2E tests for critical flows, and optimize performance.

**Tasks**:
- [ ] Write unit tests for all components (80%+ coverage)
- [ ] Create integration tests for all pages
- [ ] Implement E2E tests for critical flows (see list)
- [ ] Run Lighthouse audit and fix issues
- [ ] Optimize bundle size (<500KB)
- [ ] Implement code splitting for routes
- [ ] Add image optimization
- [ ] Verify WCAG 2.1 AA accessibility compliance
- [ ] Performance test with large datasets
- [ ] Create test fixtures and mock data

**Critical E2E Flows**:
1. Login and navigate to dashboard
2. Approve a loan application
3. Complete KYC review (approve/reject)
4. Lock a device with reason
5. Generate and export a report

**Success Criteria**:
- [ ] 80%+ unit test coverage
- [ ] Integration tests for all pages
- [ ] E2E tests for 5 critical flows
- [ ] Lighthouse performance score 90+
- [ ] WCAG 2.1 AA compliance
- [ ] Bundle size < 500KB

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 50 | Coverage completion |
| Integration Tests | 25 | Page-level tests |
| E2E Tests | 10 | Critical flows |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-TDD-SUBTASKS.md`

---

## Category 2: Distributor Portal (3 tasks | 40 hours)

Mobile-first application for device distributors.

---

### P3-T011: Distributor Portal Setup

**Priority**: 🟡 High
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: None
**Blocks**: P3-T012, P3-T013

**Objective**: Initialize separate Next.js 14 project for distributors with mobile-first responsive design, distributor authentication, and PWA capability.

**Tasks**:
- [ ] Initialize Next.js 14 project (separate from admin)
- [ ] Configure mobile-first Tailwind CSS
- [ ] Install shadcn/ui with mobile-optimized variants
- [ ] Implement distributor authentication (separate user type)
- [ ] Create mobile bottom navigation component
- [ ] Create dashboard layout for mobile
- [ ] Add PWA manifest and service worker
- [ ] Implement offline support foundation
- [ ] Create SwipeCard component for mobile interactions
- [ ] Set up camera capture utility

**Deliverables**:
```
frontend/distributor-dashboard/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Dashboard home
│   │   ├── handover/page.tsx  # Handover workflow
│   │   ├── inventory/page.tsx # Assigned devices
│   │   └── earnings/page.tsx  # Commission tracking
│   └── layout.tsx
├── components/
│   ├── ui/
│   └── mobile/
│       ├── BottomNav.tsx
│       ├── SwipeCard.tsx
│       └── CameraCapture.tsx
└── lib/
```

**Success Criteria**:
- [ ] Mobile-first responsive design
- [ ] Distributor login flow working
- [ ] Bottom navigation for mobile
- [ ] PWA installable on mobile devices
- [ ] Offline support for key screens
- [ ] Touch-friendly UI elements

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 15 | Mobile components |
| Integration Tests | 8 | Auth, navigation |
| E2E Tests | 4 | Login, PWA install |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/distributor-portal/distributor-features.md`

---

### P3-T012: Device Handover Interface

**Priority**: 🔴 Critical
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T011
**Blocks**: None

**Objective**: Build 7-step device handover workflow with camera integration for ID/device photos, IMEI scanner, condition checklist, and signature capture.

**Tasks**:
- [ ] Create multi-step wizard component
- [ ] Build Step 1: Customer Search (by phone/ID)
- [ ] Build Step 2: ID Capture (camera integration)
- [ ] Build Step 3: Device Selection (from assigned inventory)
- [ ] Build Step 4: IMEI Scanner (camera barcode reading)
- [ ] Build Step 5: Device Photo Capture (4 angles)
- [ ] Build Step 6: Condition Checklist (screen, body, buttons)
- [ ] Build Step 7: Signature Capture (touch canvas)
- [ ] Implement photo upload to Supabase Storage
- [ ] Create offline queue with sync
- [ ] Add handover confirmation screen
- [ ] Implement handover receipt generation

**7-Step Handover Flow**:
```typescript
const HANDOVER_STEPS = [
  { step: 1, title: 'Select Customer', component: 'CustomerSearch' },
  { step: 2, title: 'Verify ID', component: 'IDCapture' },
  { step: 3, title: 'Select Device', component: 'DeviceSelection' },
  { step: 4, title: 'Scan IMEI', component: 'IMEIScanner' },
  { step: 5, title: 'Device Photos', component: 'DevicePhotoCapture' },
  { step: 6, title: 'Condition Check', component: 'ConditionChecklist' },
  { step: 7, title: 'Signature', component: 'SignatureCapture' }
];
```

**Success Criteria**:
- [ ] 7-step wizard workflow complete
- [ ] Camera capture for ID/photos working
- [ ] IMEI scanner (barcode) functional
- [ ] Condition checklist with all items
- [ ] Signature capture working
- [ ] Offline queue with background sync

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 22 | Step components, camera |
| Integration Tests | 12 | Full flow, offline |
| E2E Tests | 6 | Complete handover |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/device-management/handover-process.md`

---

### P3-T013: Inventory & Commission Tracking

**Priority**: 🟡 High
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T011
**Blocks**: None

**Objective**: Build assigned device inventory view, handover history, commission dashboard, and performance metrics for distributors.

**Tasks**:
- [ ] Create assigned device inventory page
- [ ] Build device card component with status
- [ ] Create handover history page with filters
- [ ] Build commission dashboard with summary cards
- [ ] Implement commission breakdown (earned, pending, paid)
- [ ] Create performance metrics display
- [ ] Build payout schedule page
- [ ] Add earnings export functionality
- [ ] Create notifications for new assignments
- [ ] Implement device return request

**Success Criteria**:
- [ ] Device inventory view with status
- [ ] Handover history with details
- [ ] Commission dashboard with breakdown
- [ ] Performance metrics (handovers/day, completion rate)
- [ ] Payout schedule visible

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 16 | Dashboard, cards |
| Integration Tests | 8 | Data fetching |
| E2E Tests | 3 | Commission view |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/distributor-portal/commission-tracking.md`

---

## Category 3: Advanced WhatsApp Features (3 tasks | 28 hours)

Enhanced WhatsApp bot capabilities.

---

### P3-T014: Payment Reminders & Smart Notifications

**Priority**: 🟡 High
**Estimate**: 8 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T006 (WhatsApp Service), P2-T007 (Notification Service)
**Blocks**: None

**Objective**: Build automated payment reminder system with smart scheduling, escalation flow, and payment link generation.

**Tasks**:
- [ ] Create reminder scheduler service
- [ ] Implement reminder templates (friendly, urgent, final)
- [ ] Build smart scheduling based on payment history
- [ ] Create escalation flow logic
- [ ] Implement payment link generation (deep links)
- [ ] Add opt-out handling
- [ ] Create reminder status tracking
- [ ] Build admin override for reminders
- [ ] Implement reminder analytics

**Reminder Schedule**:
```typescript
const REMINDER_SCHEDULE = [
  { days_before: 3, type: 'friendly', template: 'payment_reminder_friendly' },
  { days_before: 1, type: 'reminder', template: 'payment_due_tomorrow' },
  { days_after: 0, type: 'due_today', template: 'payment_due_today' },
  { days_after: 1, type: 'missed', template: 'payment_missed' },
  { days_after: 3, type: 'urgent', template: 'payment_urgent' },
  { days_after: 7, type: 'final', template: 'payment_final_warning' }
];
```

**Success Criteria**:
- [ ] Automated reminders sent on schedule
- [ ] Smart scheduling adjusts based on history
- [ ] Escalation flow working (friendly → urgent → final)
- [ ] Payment links included in messages
- [ ] Opt-out respected

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 12 | Scheduler, templates |
| Integration Tests | 6 | End-to-end flow |
| E2E Tests | 2 | Reminder delivery |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/notifications/reminder-system.md`

---

### P3-T015: Loan Management Commands

**Priority**: 🟢 Medium
**Estimate**: 8 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T006 (WhatsApp Service)
**Blocks**: None

**Objective**: Implement WhatsApp commands for customers to check balance, view history, request extensions, and manage their account.

**Tasks**:
- [ ] Implement BALANCE command (loan balance, next payment)
- [ ] Implement HISTORY command (last 5 payments)
- [ ] Implement SCHEDULE command (full payment schedule)
- [ ] Implement HELP command (list available commands)
- [ ] Implement UPDATE command (update phone/email)
- [ ] Implement DEVICE command (view device lock status)
- [ ] Create command parser with fuzzy matching
- [ ] Build response formatters for each command
- [ ] Add rate limiting for commands
- [ ] Implement error handling and user feedback

**Commands**:
```
BALANCE - View loan balance and next payment
HISTORY - View last 5 payments
SCHEDULE - View full payment schedule
HELP - List available commands
UPDATE - Update phone/email
DEVICE - View device lock status
```

**Success Criteria**:
- [ ] All 6 commands working
- [ ] Clear, formatted responses
- [ ] Fuzzy matching for typos
- [ ] Rate limiting prevents abuse
- [ ] Error messages are helpful

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 10 | Command parser, formatters |
| Integration Tests | 5 | Command flow |
| E2E Tests | 2 | Command responses |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/whatsapp/command-reference.md`

---

### P3-T016: Multi-Language Support

**Priority**: 🟢 Low
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T006 (WhatsApp Service)
**Blocks**: None

**Objective**: Add multi-language support for WhatsApp messages with language selection flow and templates in Shona and Ndebele.

**Tasks**:
- [ ] Create language selection flow (first interaction)
- [ ] Build language preference storage
- [ ] Translate all templates to Shona
- [ ] Translate all templates to Ndebele
- [ ] Implement language detection (optional)
- [ ] Create language switch command (LANGUAGE)
- [ ] Build localized error messages
- [ ] Add language preference to customer profile
- [ ] Test all flows in all languages

**Languages**:
1. English (default)
2. Shona
3. Ndebele

**Success Criteria**:
- [ ] Language selection on first contact
- [ ] All templates available in 3 languages
- [ ] Language preference persisted
- [ ] LANGUAGE command to switch
- [ ] Localized error messages

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 8 | Translation, selection |
| Integration Tests | 4 | Language flow |
| E2E Tests | 2 | Multi-language journey |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/whatsapp/language-templates.md`

---

## Category 4: Advanced Credit Scoring (2 tasks | 36 hours)

Enhanced credit scoring capabilities.

---

### P3-T017: ML Model Training Pipeline

**Priority**: 🟢 Medium
**Estimate**: 20 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T004 (Scoring Service)
**Blocks**: None

**Objective**: Build Python ML training pipeline for credit scoring model with feature engineering, evaluation metrics, and continuous learning.

**Tasks**:
- [ ] Set up Python ML environment (scikit-learn, XGBoost)
- [ ] Create feature engineering pipeline
- [ ] Implement data preprocessing and cleaning
- [ ] Build model training script
- [ ] Create model evaluation metrics (AUC, precision, recall)
- [ ] Set up MLflow for experiment tracking
- [ ] Implement A/B testing framework
- [ ] Create model versioning system
- [ ] Build model deployment pipeline (AWS SageMaker)
- [ ] Implement continuous learning with feedback loop

**Tech Stack**:
- Python 3.11
- scikit-learn / XGBoost
- MLflow for experiment tracking
- AWS SageMaker for training/deployment

**Success Criteria**:
- [ ] Training pipeline runs end-to-end
- [ ] Model achieves target metrics (AUC > 0.75)
- [ ] MLflow tracking experiments
- [ ] A/B testing framework ready
- [ ] Deployment to SageMaker automated

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 15 | Feature engineering, preprocessing |
| Integration Tests | 8 | Pipeline flow |
| E2E Tests | 2 | Full training run |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/credit-scoring/ml-model-specs.md`

---

### P3-T018: Alternative Data Integration

**Priority**: 🟢 Low
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T004 (Scoring Service)
**Blocks**: None

**Objective**: Integrate alternative data sources for credit scoring including mobile money transactions, location data, and transaction patterns.

**Tasks**:
- [ ] Design alternative data schema
- [ ] Implement mobile money transaction analysis
- [ ] Create transaction pattern detection
- [ ] Build location data integration (if available)
- [ ] Implement feature store for ML features
- [ ] Create data quality monitoring
- [ ] Build data consent management
- [ ] Implement data refresh pipeline
- [ ] Create feature importance analysis
- [ ] Add privacy-preserving features

**Alternative Data Sources**:
1. Mobile money transaction history (EcoCash, OneMoney)
2. Transaction patterns (frequency, amounts, timing)
3. Phone usage patterns (if permitted)
4. Location stability (residence history)

**Success Criteria**:
- [ ] Mobile money data integration working
- [ ] Transaction pattern features computed
- [ ] Feature store populated
- [ ] Data quality monitoring active
- [ ] Privacy compliance verified

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 12 | Data processing, features |
| Integration Tests | 6 | Data pipeline |
| E2E Tests | 2 | Full data flow |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/credit-scoring/alternative-data.md`

---

## Category 5: Advanced Payment Features (2 tasks | 24 hours)

---

### P3-T019: Payment Plans & Restructuring

**Priority**: 🟢 Medium
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T003 (Payment Service)
**Blocks**: None

**Objective**: Implement payment plan restructuring for customers in difficulty, including extension requests and modified payment schedules.

**Tasks**:
- [ ] Create payment plan modification interface
- [ ] Implement extension request workflow
- [ ] Build restructuring calculator
- [ ] Create approval workflow for restructuring
- [ ] Implement partial payment handling
- [ ] Build payment plan history
- [ ] Create customer communication for changes
- [ ] Implement grace period management
- [ ] Add restructuring limits and rules
- [ ] Build restructuring reports

**Success Criteria**:
- [ ] Extension requests can be submitted
- [ ] Restructuring calculator accurate
- [ ] Approval workflow working
- [ ] Partial payments tracked correctly
- [ ] Customer notified of changes

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 10 | Calculator, rules |
| Integration Tests | 5 | Restructuring flow |
| E2E Tests | 2 | Full restructuring |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/payment-processing/restructuring-rules.md`

---

### P3-T020: Additional Payment Methods

**Priority**: 🟢 Low
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T003 (Payment Service)
**Blocks**: None

**Objective**: Integrate additional payment methods beyond EcoCash and OneMoney, including bank transfers and card payments.

**Tasks**:
- [ ] Research additional payment providers (Zimbabwe)
- [ ] Integrate ZimSwitch for bank transfers
- [ ] Implement bank payment verification
- [ ] Add card payment option (if available)
- [ ] Create payment method selection UI
- [ ] Implement payment method preferences
- [ ] Build payment method reconciliation
- [ ] Add payment method analytics
- [ ] Create fallback handling between methods
- [ ] Implement payment method limits

**Payment Methods**:
1. EcoCash (existing)
2. OneMoney (existing)
3. ZimSwitch bank transfer
4. InnBucks (if available)
5. Card payments (future)

**Success Criteria**:
- [ ] At least one new payment method integrated
- [ ] Payment method selection working
- [ ] Reconciliation for all methods
- [ ] Fallback handling implemented

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 8 | Payment handlers |
| Integration Tests | 5 | Provider integration |
| E2E Tests | 2 | Payment flow |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/payment-processing/payment-methods.md`

---

## Category 6: Advanced Device Management (2 tasks | 20 hours)

---

### P3-T021: Device Repossession Workflow

**Priority**: 🟢 Medium
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T010 (Lock Service)
**Blocks**: None

**Objective**: Build device repossession workflow for defaulted loans including scheduling, agent assignment, and return tracking.

**Tasks**:
- [ ] Create repossession queue for defaulted devices
- [ ] Build repossession scheduling interface
- [ ] Implement agent assignment (field staff)
- [ ] Create repossession attempt tracking
- [ ] Build return receipt workflow
- [ ] Implement device condition on return
- [ ] Create repossession reports
- [ ] Add repossession SLA tracking
- [ ] Build customer communication for repossession
- [ ] Implement legal notice generation

**Success Criteria**:
- [ ] Repossession queue populated from defaults
- [ ] Scheduling interface working
- [ ] Agent assignment functional
- [ ] Return tracking complete
- [ ] Legal notices generated

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 10 | Queue, scheduling |
| Integration Tests | 5 | Workflow |
| E2E Tests | 2 | Full repossession |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/device-management/repossession-workflow.md`

---

### P3-T022: Device Condition Monitoring

**Priority**: 🟢 Low
**Estimate**: 8 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T010 (Lock Service)
**Blocks**: None

**Objective**: Implement device condition monitoring through Trustonic integration for battery health, storage, and system integrity.

**Tasks**:
- [ ] Integrate Trustonic device monitoring API
- [ ] Create device health dashboard
- [ ] Implement battery health tracking
- [ ] Add storage monitoring
- [ ] Create system integrity checks
- [ ] Build alert system for issues
- [ ] Implement device health history
- [ ] Create health reports
- [ ] Add threshold configuration
- [ ] Build admin notifications for critical issues

**Monitored Metrics**:
1. Battery health percentage
2. Storage available
3. System integrity (rooted/modified)
4. Screen condition (if detectable)
5. Last check-in time

**Success Criteria**:
- [ ] Trustonic integration working
- [ ] Device health visible in admin
- [ ] Alerts for critical issues
- [ ] Health history tracked

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 6 | Health calculations |
| Integration Tests | 4 | Trustonic API |
| E2E Tests | 1 | Health check |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/device-management/condition-monitoring.md`

---

## Category 7: Analytics & Business Intelligence (2 tasks | 28 hours)

---

### P3-T023: Advanced Analytics Dashboard

**Priority**: 🟢 Medium
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T008 (Reports & Analytics)
**Blocks**: None

**Objective**: Build advanced analytics dashboard with cohort analysis, predictive metrics, and executive summary views.

**Tasks**:
- [ ] Create executive summary dashboard
- [ ] Build cohort analysis for loan performance
- [ ] Implement customer segmentation analytics
- [ ] Create predictive default indicators
- [ ] Build geographic distribution map
- [ ] Implement trend analysis and forecasting
- [ ] Create comparison views (period over period)
- [ ] Build drill-down capabilities
- [ ] Add custom dashboard builder
- [ ] Implement real-time analytics streaming

**Success Criteria**:
- [ ] Executive summary with key metrics
- [ ] Cohort analysis functional
- [ ] Predictive indicators displayed
- [ ] Geographic visualization working
- [ ] Drill-down navigation working

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 12 | Analytics components |
| Integration Tests | 6 | Data aggregation |
| E2E Tests | 2 | Dashboard navigation |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/analytics/advanced-analytics.md`

---

### P3-T024: Data Export & API

**Priority**: 🟢 Medium
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T008 (Reports & Analytics)
**Blocks**: None

**Objective**: Build data export functionality and external API for third-party integrations.

**Tasks**:
- [ ] Create bulk data export functionality
- [ ] Implement scheduled exports (daily, weekly)
- [ ] Build export format options (CSV, Excel, JSON)
- [ ] Create external REST API for data access
- [ ] Implement API authentication (API keys)
- [ ] Add rate limiting for API
- [ ] Create API documentation (OpenAPI/Swagger)
- [ ] Build webhook system for events
- [ ] Implement data access audit logging
- [ ] Create API usage analytics

**API Endpoints**:
- GET /api/v1/loans
- GET /api/v1/customers
- GET /api/v1/payments
- GET /api/v1/devices
- GET /api/v1/reports/{type}
- POST /api/v1/webhooks

**Success Criteria**:
- [ ] Bulk export working (all formats)
- [ ] Scheduled exports functional
- [ ] External API accessible
- [ ] API documentation complete
- [ ] Webhook system working

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 10 | Export, API handlers |
| Integration Tests | 6 | API flow |
| E2E Tests | 2 | Export, API calls |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/api/external-api-spec.md`

---

## Category 8: Operational Improvements (3 tasks | 48 hours)

---

### P3-T025: Customer Support Ticketing

**Priority**: 🟡 High
**Estimate**: 16 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T004 (Customer Management)
**Blocks**: None

**Objective**: Build customer support ticketing system with ticket creation, assignment, SLA tracking, and resolution workflow.

**Tasks**:
- [ ] Create ticket list page with filters
- [ ] Build ticket creation form
- [ ] Implement ticket assignment (to agents)
- [ ] Create ticket detail view with history
- [ ] Build SLA tracking (response time, resolution time)
- [ ] Implement ticket status workflow
- [ ] Create customer communication from tickets
- [ ] Build ticket categories and tags
- [ ] Implement escalation rules
- [ ] Create support metrics dashboard

**Ticket Statuses**:
1. Open - New ticket
2. In Progress - Being worked on
3. Pending Customer - Awaiting response
4. Resolved - Solution provided
5. Closed - Verified resolved

**Success Criteria**:
- [ ] Ticket creation working
- [ ] Assignment functional
- [ ] SLA tracking displayed
- [ ] Status workflow complete
- [ ] Metrics dashboard shows KPIs

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 14 | Ticket components |
| Integration Tests | 7 | Workflow |
| E2E Tests | 3 | Ticket lifecycle |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/operations/support-ticketing.md`

---

### P3-T026: Referral Program

**Priority**: 🟢 Low
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: None
**Blocks**: None

**Objective**: Implement customer referral program with referral code generation, tracking, and reward distribution.

**Tasks**:
- [ ] Create referral code generation system
- [ ] Build referral tracking (who referred whom)
- [ ] Implement referral reward calculation
- [ ] Create referral status workflow
- [ ] Build referral dashboard for customers (WhatsApp)
- [ ] Create admin referral management
- [ ] Implement reward distribution
- [ ] Build referral analytics
- [ ] Add fraud detection for referrals
- [ ] Create referral terms and conditions

**Referral Flow**:
1. Existing customer gets referral code
2. New customer uses code during signup
3. New customer completes first loan
4. Referrer receives reward (credit or cash)

**Success Criteria**:
- [ ] Referral codes generated
- [ ] Tracking working
- [ ] Rewards calculated correctly
- [ ] Admin can manage referrals
- [ ] Analytics available

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 8 | Code generation, rewards |
| Integration Tests | 4 | Referral flow |
| E2E Tests | 2 | Full referral cycle |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/marketing/referral-program.md`

---

### P3-T027: Fraud Detection System

**Priority**: 🟡 High
**Estimate**: 20 hours
**Status**: ⚪ Not Started
**Dependencies**: P2-T004 (Scoring Service)
**Blocks**: None

**Objective**: Build fraud detection system with rule-based detection, anomaly detection, and alert management.

**Tasks**:
- [ ] Create fraud detection rule engine
- [ ] Implement velocity checks (multiple applications)
- [ ] Build device fingerprinting
- [ ] Create anomaly detection for transactions
- [ ] Implement fraud score calculation
- [ ] Build fraud alert queue
- [ ] Create fraud investigation interface
- [ ] Implement blocklist management
- [ ] Build fraud reports and analytics
- [ ] Create real-time fraud monitoring

**Fraud Signals**:
1. Multiple applications from same device
2. Velocity of applications (too many too fast)
3. Mismatched device/location
4. Suspicious payment patterns
5. Known fraudster connections

**Success Criteria**:
- [ ] Rule engine working
- [ ] Velocity checks active
- [ ] Fraud alerts generated
- [ ] Investigation interface usable
- [ ] Blocklist functional

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 15 | Rules, scoring |
| Integration Tests | 8 | Detection flow |
| E2E Tests | 3 | Full fraud detection |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/security/fraud-detection.md`

---

## Category 9: Compliance & Reporting (2 tasks | 24 hours)

---

### P3-T028: Regulatory Reporting (RBZ)

**Priority**: 🟡 High
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: P3-T008 (Reports & Analytics)
**Blocks**: None

**Objective**: Build regulatory reporting system for Reserve Bank of Zimbabwe (RBZ) compliance requirements.

**Tasks**:
- [ ] Research RBZ reporting requirements
- [ ] Create RBZ report templates
- [ ] Implement data aggregation for reports
- [ ] Build report scheduling (monthly/quarterly)
- [ ] Create report approval workflow
- [ ] Implement report export in required format
- [ ] Build compliance calendar
- [ ] Create audit trail for reports
- [ ] Implement data retention policies
- [ ] Build regulatory dashboard

**RBZ Reports** (examples):
1. Monthly lending activity report
2. Quarterly portfolio quality report
3. Annual compliance certification
4. Suspicious activity reports (SARs)

**Success Criteria**:
- [ ] Report templates match RBZ requirements
- [ ] Data aggregation accurate
- [ ] Scheduling working
- [ ] Export in correct format
- [ ] Audit trail complete

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 10 | Report generation |
| Integration Tests | 5 | Data aggregation |
| E2E Tests | 2 | Full report cycle |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/compliance/rbz-requirements.md`

---

### P3-T029: Data Privacy Features

**Priority**: 🟡 High
**Estimate**: 12 hours
**Status**: ⚪ Not Started
**Dependencies**: None
**Blocks**: None

**Objective**: Implement data privacy features including consent management, data access requests, and data deletion.

**Tasks**:
- [ ] Create consent management system
- [ ] Build consent tracking (what, when, how)
- [ ] Implement data access request workflow
- [ ] Create personal data export functionality
- [ ] Build data deletion (right to be forgotten)
- [ ] Implement data anonymization
- [ ] Create privacy policy version tracking
- [ ] Build consent audit trail
- [ ] Implement data retention enforcement
- [ ] Create privacy dashboard for admins

**Privacy Features**:
1. Consent collection and tracking
2. Data access requests (DSAR)
3. Data portability (export)
4. Right to deletion
5. Data retention policies

**Success Criteria**:
- [ ] Consent management working
- [ ] Data access requests processed
- [ ] Data export functional
- [ ] Data deletion working
- [ ] Audit trail complete

**TDD Requirements**:
| Type | Count | Focus |
|------|-------|-------|
| Unit Tests | 10 | Privacy logic |
| Integration Tests | 5 | Request workflow |
| E2E Tests | 2 | Privacy requests |

**Reference Specs**:
- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md`
- `planning/compliance/data-privacy.md`

---

## Summary Statistics

| Category | Tasks | Hours | Critical | High | Medium | Low |
|----------|-------|-------|----------|------|--------|-----|
| Admin Dashboard | 10 | 148h | 3 | 5 | 2 | 0 |
| Distributor Portal | 3 | 40h | 1 | 2 | 0 | 0 |
| WhatsApp Features | 3 | 28h | 0 | 1 | 1 | 1 |
| Credit Scoring | 2 | 36h | 0 | 0 | 1 | 1 |
| Payment Features | 2 | 24h | 0 | 0 | 1 | 1 |
| Device Management | 2 | 20h | 0 | 0 | 1 | 1 |
| Analytics & BI | 2 | 28h | 0 | 0 | 2 | 0 |
| Operations | 3 | 48h | 0 | 2 | 0 | 1 |
| Compliance | 2 | 24h | 0 | 2 | 0 | 0 |
| **TOTAL** | **29** | **396h** | **4** | **12** | **8** | **5** |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⚪ | Not Started |
| 🟡 | In Progress |
| 🔵 | Under Review |
| ✅ | Completed |
| 🔴 | Blocked |
| ❌ | Skipped |

---

## Priority Legend

| Priority | Symbol | Meaning |
|----------|--------|---------|
| Critical | 🔴 | Must complete - blocks other work |
| High | 🟡 | Important - should complete soon |
| Medium | 🟢 | Nice to have - complete when possible |
| Low | ⚪ | Future enhancement |

---

## References

- `phase-3-frontend/PHASE-3-IMPLEMENTATION-PLAN.md` - Detailed implementation specs
- `phase-3-frontend/PHASE-3-TDD-SUBTASKS.md` - TDD requirements per task
- `planning/` - All planning documents
- `infrastructure/PHASE-2-SUMMARY-REPORT.md` - Phase 2 completion

---

**Document Version**: 1.0
**Last Updated**: February 5, 2026
**Author**: Claude Code AI Assistant
