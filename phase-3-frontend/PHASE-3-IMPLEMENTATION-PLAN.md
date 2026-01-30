# Phase 3: Frontend Applications & Features - Implementation Plan

**Project:** Lynia Finance - WhatsApp-Based Device Financing Platform
**Phase Duration:** Weeks 11-14 (4 weeks)
**Total Tasks:** 29
**Estimated Hours:** 380 hours
**Created:** January 30, 2026

---

## Executive Summary

Phase 3 focuses on building user-facing frontend applications and implementing advanced features on top of the completed backend infrastructure. The primary deliverables are:

1. **Admin Dashboard** - Operations team web portal (10 tasks, 148 hours)
2. **Distributor Portal** - Device handover management app (3 tasks, 40 hours)
3. **Advanced Features** - WhatsApp, Credit Scoring, Payments, Devices (16 tasks, 192 hours)

### Phase 3 Success Criteria

| Metric | Target |
|--------|--------|
| Admin Dashboard pages | 15+ functional pages |
| Distributor Portal pages | 5+ functional pages |
| Test coverage | 80%+ |
| Lighthouse performance score | 90+ |
| Accessibility compliance | WCAG 2.1 AA |

---

## Technology Stack

### Frontend Applications

```typescript
const FRONTEND_STACK = {
  // Core Framework
  framework: 'Next.js 14 (App Router)',
  language: 'TypeScript 5.x',
  runtime: 'Node.js 20.x',

  // Styling & UI
  styling: 'Tailwind CSS 3.4',
  components: 'shadcn/ui',
  icons: 'Lucide React',
  charts: 'Recharts',
  tables: 'TanStack Table v8',

  // State & Data
  serverState: 'TanStack Query (React Query)',
  clientState: 'Zustand',
  forms: 'React Hook Form + Zod',

  // Authentication & Backend
  auth: 'Supabase Auth',
  database: 'Supabase Client',
  realtime: 'Supabase Realtime',
  api: 'AWS Lambda (existing services)',

  // Testing
  unitTests: 'Jest + React Testing Library',
  e2eTests: 'Playwright',

  // Deployment
  hosting: 'Vercel',
  cdn: 'Vercel Edge Network'
};
```

---

## Task Breakdown by Category

### 3.1 Admin Dashboard Frontend (10 tasks | 148 hours)

Critical path for operations team functionality.

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T001 | Core Setup & Layout | Critical | 12 | P2-T011 |
| P3-T002 | Dashboard Home & KPIs | Critical | 16 | P3-T001 |
| P3-T003 | Loan Management | Critical | 20 | P3-T002 |
| P3-T004 | Customer Management | High | 16 | P3-T002 |
| P3-T005 | Payment Management | High | 16 | P3-T002 |
| P3-T006 | Device Management | High | 16 | P3-T002 |
| P3-T007 | KYC Review Queue | High | 12 | P3-T002 |
| P3-T008 | Reports & Analytics | Medium | 16 | P3-T002 |
| P3-T009 | Settings & Configuration | Medium | 12 | P3-T002 |
| P3-T010 | Testing & Optimization | High | 12 | P3-T001-T009 |

---

#### P3-T001: Core Setup & Layout

**Priority:** Critical | **Estimate:** 12 hours
**Dependencies:** P2-T011 (Admin Dashboard Specs)

**Objectives:**
- Initialize Next.js 14 project with TypeScript
- Configure Tailwind CSS and shadcn/ui
- Implement authentication with Supabase Auth
- Create reusable layout components

**Deliverables:**

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

**Acceptance Criteria:**
- [ ] Next.js 14 project initialized with App Router
- [ ] Tailwind CSS configured with custom theme
- [ ] 10+ shadcn/ui components installed
- [ ] Login/logout flow working
- [ ] Protected route wrapper implemented
- [ ] Responsive sidebar navigation
- [ ] Dark mode support

**Technical Notes:**
```bash
# Project initialization
npx create-next-app@latest admin-portal --typescript --tailwind --app --src-dir

# shadcn/ui setup
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog dropdown-menu form input select table toast avatar badge

# Supabase client
npm install @supabase/supabase-js @supabase/ssr
```

---

#### P3-T002: Dashboard Home & KPIs

**Priority:** Critical | **Estimate:** 16 hours
**Dependencies:** P3-T001

**Objectives:**
- Build dashboard home page with 12 KPI cards
- Implement real-time data fetching
- Create chart components for trends
- Add date range filters

**Deliverables:**

```typescript
// KPI Cards to implement
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

**Components:**
- `MetricCard.tsx` - Individual KPI card with icon, value, trend
- `MetricsGrid.tsx` - Responsive grid of metric cards
- `TrendChart.tsx` - Line chart for historical data
- `RecentActivity.tsx` - Activity feed component
- `AlertsPanel.tsx` - System alerts and notifications
- `DateRangePicker.tsx` - Date range selection

**Acceptance Criteria:**
- [ ] 12 KPI cards displaying real-time data
- [ ] Trend indicators (up/down arrows with %)
- [ ] Date range filter (today, 7 days, 30 days, custom)
- [ ] Recent activity feed
- [ ] System alerts panel
- [ ] Auto-refresh every 30 seconds
- [ ] Loading skeletons for data fetching

---

#### P3-T003: Loan Management

**Priority:** Critical | **Estimate:** 20 hours
**Dependencies:** P3-T002

**Objectives:**
- Build loan list page with advanced filtering
- Create loan detail view with payment history
- Implement approval/rejection workflow
- Add manual review interface

**Pages:**
```
app/(dashboard)/loans/
├── page.tsx                    # Loan list
├── [id]/
│   ├── page.tsx               # Loan detail
│   └── approve/page.tsx       # Approval workflow
├── pending-approval/page.tsx  # Pending queue
└── overdue/page.tsx           # Overdue loans
```

**Features:**
- DataTable with sorting, filtering, pagination
- Status filters (pending, active, paid, defaulted)
- Search by customer name, phone, loan ID
- Loan detail with payment schedule
- Approve/reject with notes
- Payment history timeline
- Comments/notes system

**Acceptance Criteria:**
- [ ] Loan list with 10+ columns
- [ ] Advanced filters (status, tier, date range, amount)
- [ ] Export to CSV functionality
- [ ] Loan detail page with full information
- [ ] Payment schedule visualization
- [ ] Approval workflow with confirmation
- [ ] Audit trail for all actions

---

#### P3-T004: Customer Management

**Priority:** High | **Estimate:** 16 hours
**Dependencies:** P3-T002

**Objectives:**
- Build customer list with search and filters
- Create customer profile view
- Display KYC status and documents
- Show credit score history and loan history

**Pages:**
```
app/(dashboard)/customers/
├── page.tsx                   # Customer list
├── [id]/
│   ├── page.tsx              # Customer profile
│   └── edit/page.tsx         # Edit customer
└── kyc-review/page.tsx       # KYC review (shared with P3-T007)
```

**Features:**
- Customer search (name, phone, National ID)
- KYC status filter (pending, verified, rejected)
- Credit tier filter (low, medium, high)
- Customer timeline (all interactions)
- Communication history (WhatsApp messages)

**Acceptance Criteria:**
- [ ] Customer list with pagination
- [ ] Quick search functionality
- [ ] Customer profile with all details
- [ ] KYC document viewer
- [ ] Credit score graph over time
- [ ] Loan history per customer
- [ ] Edit customer information

---

#### P3-T005: Payment Management

**Priority:** High | **Estimate:** 16 hours
**Dependencies:** P3-T002

**Objectives:**
- Build payment list with reconciliation status
- Create collections queue for overdue payments
- Implement payment reconciliation interface
- Add refund processing workflow

**Pages:**
```
app/(dashboard)/payments/
├── page.tsx                   # Payment list
├── [id]/page.tsx             # Payment detail
├── collections/page.tsx       # Collections queue
└── reconciliation/page.tsx    # Reconciliation
```

**Features:**
- Payment list with status filters
- Manual payment recording
- Reconciliation interface (match transactions)
- Collections priority queue
- Failed payment retry functionality
- Refund request handling
- Export reports

**Acceptance Criteria:**
- [ ] Payment list with filters
- [ ] Reconciliation workflow
- [ ] Collections queue sorted by priority
- [ ] Manual payment recording
- [ ] Refund processing
- [ ] Export to CSV/Excel

---

#### P3-T006: Device Management

**Priority:** High | **Estimate:** 16 hours
**Dependencies:** P3-T002

**Objectives:**
- Build device inventory management
- Implement lock/unlock controls
- Create handover tracking interface
- Add distributor assignment

**Pages:**
```
app/(dashboard)/devices/
├── page.tsx                   # Device inventory
├── [id]/page.tsx             # Device detail
├── handovers/
│   ├── page.tsx              # Handover schedule
│   └── [id]/page.tsx         # Handover detail
└── lock-unlock/page.tsx       # Device control center
```

**Features:**
- Device inventory with status
- Lock/unlock with reason
- Handover scheduling and tracking
- Distributor assignment
- Device history timeline
- Bulk operations (assign, lock)

**Acceptance Criteria:**
- [ ] Device inventory list
- [ ] Lock/unlock controls with confirmation
- [ ] Handover tracking
- [ ] Distributor assignment interface
- [ ] Device status history
- [ ] Bulk operations

---

#### P3-T007: KYC Review Queue

**Priority:** High | **Estimate:** 12 hours
**Dependencies:** P3-T002

**Objectives:**
- Build KYC review queue page
- Create document viewer for ID and selfie
- Implement approve/reject workflow
- Add SLA tracking

**Features:**
- Queue sorted by submission date
- Document viewer (ID front/back, selfie)
- Side-by-side comparison (ID photo vs selfie)
- Approve/reject with reason
- Review history
- SLA indicators (time in queue)
- Escalation for edge cases

**Acceptance Criteria:**
- [ ] KYC queue with priority sorting
- [ ] Document viewer component
- [ ] Approve/reject workflow
- [ ] Reason selection for rejections
- [ ] Review history
- [ ] SLA tracking and alerts

---

#### P3-T008: Reports & Analytics

**Priority:** Medium | **Estimate:** 16 hours
**Dependencies:** P3-T002

**Objectives:**
- Build reports dashboard
- Implement report generation
- Create export functionality
- Add scheduled reports

**Report Types:**
1. **Portfolio Report** - Loan summary, risk distribution
2. **Collection Report** - Payment rates, overdue analysis
3. **Disbursement Report** - Daily/monthly disbursements
4. **KYC Report** - Approval rates, processing times
5. **Device Report** - Inventory, lock/unlock activity
6. **Default Report** - Default rates by tier, geography

**Acceptance Criteria:**
- [ ] Reports dashboard with 6+ report types
- [ ] Date range selection
- [ ] Chart visualizations
- [ ] Export to PDF/CSV
- [ ] Scheduled report emails

---

#### P3-T009: Settings & Configuration

**Priority:** Medium | **Estimate:** 12 hours
**Dependencies:** P3-T002

**Objectives:**
- Build system settings page
- Implement user management
- Create role/permission management
- Add notification template editor

**Features:**
- User management (CRUD admins)
- Role management (Admin, Manager, Reviewer, Finance)
- Permission matrix
- Notification template editor
- System configuration (loan limits, rates)
- Audit log viewer

**Acceptance Criteria:**
- [ ] User management interface
- [ ] Role creation and assignment
- [ ] Permission management
- [ ] Notification template editor
- [ ] System config editor
- [ ] Audit log with filters

---

#### P3-T010: Admin Dashboard Testing & Optimization

**Priority:** High | **Estimate:** 12 hours
**Dependencies:** P3-T001 through P3-T009

**Objectives:**
- Write unit tests for components
- Create integration tests for flows
- Implement E2E tests
- Optimize performance

**Testing Strategy:**
```typescript
// Test coverage targets
const TEST_COVERAGE = {
  components: 80,      // Unit tests
  pages: 70,           // Integration tests
  criticalFlows: 100,  // E2E tests
  accessibility: 100   // WCAG 2.1 AA
};

// Critical E2E flows
const E2E_FLOWS = [
  'Login and navigate to dashboard',
  'Approve a loan application',
  'Complete KYC review',
  'Lock a device',
  'Generate and export report'
];
```

**Acceptance Criteria:**
- [ ] 80%+ unit test coverage
- [ ] Integration tests for all pages
- [ ] E2E tests for critical flows
- [ ] Lighthouse score 90+
- [ ] WCAG 2.1 AA compliance
- [ ] Bundle size < 500KB

---

### 3.2 Distributor Portal (3 tasks | 40 hours)

Mobile-first application for device distributors.

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T011 | Setup & Authentication | High | 12 | - |
| P3-T012 | Device Handover Interface | Critical | 16 | P3-T011 |
| P3-T013 | Inventory & Commission Tracking | High | 12 | P3-T011 |

---

#### P3-T011: Distributor Portal Setup

**Priority:** High | **Estimate:** 12 hours

**Objectives:**
- Initialize Next.js 14 project (separate from admin)
- Mobile-first responsive design
- Distributor authentication
- Dashboard layout

**Deliverables:**
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

**Acceptance Criteria:**
- [ ] Mobile-first responsive design
- [ ] Distributor login flow
- [ ] Bottom navigation for mobile
- [ ] PWA capability (installable)
- [ ] Offline support for key features

---

#### P3-T012: Device Handover Interface

**Priority:** Critical | **Estimate:** 16 hours
**Dependencies:** P3-T011

**Objectives:**
- Build 7-step handover workflow
- Integrate camera for ID/device photos
- Implement IMEI scanner
- Add signature capture

**Handover Workflow:**
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

**Features:**
- Camera integration for ID capture
- IMEI barcode scanner (via camera)
- Device condition checklist
- Digital signature capture
- Photo upload to storage
- Offline queue for poor connectivity

**Acceptance Criteria:**
- [ ] 7-step wizard workflow
- [ ] Camera capture for ID/photos
- [ ] IMEI scanner functionality
- [ ] Condition checklist
- [ ] Signature capture
- [ ] Offline queue with sync

---

#### P3-T013: Inventory & Commission Tracking

**Priority:** High | **Estimate:** 12 hours
**Dependencies:** P3-T011

**Objectives:**
- Build assigned device inventory
- Create handover history
- Implement commission dashboard
- Add performance metrics

**Features:**
- Assigned device list with status
- Handover history with details
- Commission summary (earned, pending, paid)
- Performance metrics (handovers/day, completion rate)
- Payout schedule

**Acceptance Criteria:**
- [ ] Device inventory view
- [ ] Handover history
- [ ] Commission dashboard
- [ ] Performance metrics
- [ ] Payout schedule

---

### 3.3 Advanced WhatsApp Features (3 tasks | 28 hours)

Enhanced WhatsApp bot capabilities.

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T014 | Payment Reminders | High | 8 | P2-T006, P2-T007 |
| P3-T015 | Loan Management Commands | Medium | 8 | P2-T006 |
| P3-T016 | Multi-Language Support | Low | 12 | P2-T006 |

---

#### P3-T014: Payment Reminders & Smart Notifications

**Priority:** High | **Estimate:** 8 hours

**Deliverables:**
- Automated payment reminder system
- Smart scheduling based on payment history
- Escalation flow (friendly → urgent → final warning)
- Payment link generation

**Reminder Schedule:**
```typescript
const REMINDER_SCHEDULE = [
  { days_before: 3, type: 'friendly', template: 'payment_reminder_friendly' },
  { days_before: 1, type: 'reminder', template: 'payment_reminder_due_tomorrow' },
  { days_after: 0, type: 'due_today', template: 'payment_due_today' },
  { days_after: 1, type: 'missed', template: 'payment_missed' },
  { days_after: 3, type: 'urgent', template: 'payment_urgent' },
  { days_after: 7, type: 'final', template: 'payment_final_warning' }
];
```

---

#### P3-T015: Loan Management Commands

**Priority:** Medium | **Estimate:** 8 hours

**Deliverables:**
- Check balance command
- View payment history
- Request payment extension
- Update contact info
- View device status

**Commands:**
```
BALANCE - View loan balance and next payment
HISTORY - View last 5 payments
SCHEDULE - View full payment schedule
HELP - List available commands
UPDATE - Update phone/email
DEVICE - View device lock status
```

---

#### P3-T016: Multi-Language Support

**Priority:** Low | **Estimate:** 12 hours

**Deliverables:**
- Language selection flow
- Templates in Shona and Ndebele
- Language preference storage
- Localized error messages

**Languages:**
1. English (default)
2. Shona
3. Ndebele

---

### 3.4 Advanced Credit Scoring (2 tasks | 36 hours)

Enhanced credit scoring capabilities.

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T017 | ML Model Training Pipeline | Medium | 20 | P2-T004 |
| P3-T018 | Alternative Data Integration | Low | 16 | P2-T004 |

---

#### P3-T017: ML Model Training Pipeline

**Priority:** Medium | **Estimate:** 20 hours

**Deliverables:**
- Python ML training pipeline
- Feature engineering code
- Model evaluation metrics
- A/B testing framework
- Continuous learning setup

**Tech Stack:**
- Python 3.11
- scikit-learn / XGBoost
- MLflow for experiment tracking
- AWS SageMaker for training

---

#### P3-T018: Alternative Data Integration

**Priority:** Low | **Estimate:** 16 hours

**Deliverables:**
- Mobile money transaction analysis
- Location data integration
- Transaction pattern detection
- Feature store implementation

---

### 3.5 Advanced Payment Features (2 tasks | 24 hours)

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T019 | Payment Plans & Restructuring | Medium | 12 | P2-T003 |
| P3-T020 | Additional Payment Methods | Low | 12 | P2-T003 |

---

### 3.6 Advanced Device Management (2 tasks | 20 hours)

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T021 | Device Repossession Workflow | Medium | 12 | P2-T010 |
| P3-T022 | Device Condition Monitoring | Low | 8 | P2-T010 |

---

### 3.7 Analytics & Business Intelligence (2 tasks | 28 hours)

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T023 | Advanced Analytics Dashboard | Medium | 16 | P3-T008 |
| P3-T024 | Data Export & API | Medium | 12 | P3-T008 |

---

### 3.8 Operational Improvements (3 tasks | 48 hours)

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T025 | Customer Support Ticketing | High | 16 | P3-T004 |
| P3-T026 | Referral Program | Low | 12 | - |
| P3-T027 | Fraud Detection System | High | 20 | P2-T004 |

---

### 3.9 Compliance & Reporting (2 tasks | 24 hours)

| Task | Title | Priority | Hours | Dependencies |
|------|-------|----------|-------|--------------|
| P3-T028 | Regulatory Reporting (RBZ) | High | 12 | P3-T008 |
| P3-T029 | Data Privacy Features | High | 12 | - |

---

## Implementation Timeline

### Week 11: Admin Dashboard Foundation

| Day | Tasks | Hours |
|-----|-------|-------|
| Mon | P3-T001: Project setup, Tailwind, shadcn/ui | 8 |
| Tue | P3-T001: Auth, layout, sidebar | 4 |
| Tue | P3-T002: Dashboard layout, metric cards | 4 |
| Wed | P3-T002: KPI data fetching, charts | 8 |
| Thu | P3-T002: Alerts, activity feed | 4 |
| Thu | P3-T003: Loan list page | 4 |
| Fri | P3-T003: Loan detail, approval workflow | 8 |

**Week 11 Deliverables:**
- Admin portal initialized
- Login/authentication working
- Dashboard home with 12 KPIs
- Loan list and detail pages

---

### Week 12: Admin Dashboard Core Features

| Day | Tasks | Hours |
|-----|-------|-------|
| Mon | P3-T003: Complete loan management | 8 |
| Tue | P3-T004: Customer list, profile | 8 |
| Wed | P3-T004: Complete customer management | 8 |
| Thu | P3-T005: Payment list, reconciliation | 8 |
| Fri | P3-T005: Complete payment management | 8 |

**Week 12 Deliverables:**
- Loan management complete
- Customer management complete
- Payment management complete

---

### Week 13: Admin Dashboard Extended & Distributor Portal

| Day | Tasks | Hours |
|-----|-------|-------|
| Mon | P3-T006: Device inventory, lock/unlock | 8 |
| Tue | P3-T006: Device handovers, complete | 8 |
| Wed | P3-T007: KYC review queue | 8 |
| Thu | P3-T011: Distributor portal setup | 8 |
| Fri | P3-T012: Handover workflow (start) | 8 |

**Week 13 Deliverables:**
- Device management complete
- KYC review queue complete
- Distributor portal initialized

---

### Week 14: Distributor Portal & Testing

| Day | Tasks | Hours |
|-----|-------|-------|
| Mon | P3-T012: Complete handover workflow | 8 |
| Tue | P3-T013: Inventory, commission tracking | 8 |
| Wed | P3-T008: Reports & analytics | 8 |
| Thu | P3-T009: Settings & configuration | 8 |
| Fri | P3-T010: Testing, optimization | 8 |

**Week 14 Deliverables:**
- Distributor portal complete
- Reports & analytics complete
- Settings complete
- All tests passing

---

## Task Dependencies Graph

```
Phase 2 (Complete)
    │
    ▼
P3-T001 (Setup) ─────────────────────────────────────┐
    │                                                 │
    ▼                                                 │
P3-T002 (Dashboard) ──────┬───────┬───────┬─────────┤
    │                     │       │       │         │
    ▼                     ▼       ▼       ▼         │
P3-T003 (Loans)     P3-T004   P3-T005  P3-T006     │
    │               (Customers)(Payments)(Devices)  │
    │                     │       │       │         │
    │                     ▼       │       │         │
    │               P3-T007      │       │         │
    │               (KYC)        │       │         │
    │                     │       │       │         │
    └─────────────────────┴───────┴───────┴─────────┤
                                                     │
                          P3-T008 (Reports) ◄────────┤
                                │                    │
                          P3-T009 (Settings) ◄───────┤
                                │                    │
                          P3-T010 (Testing) ◄────────┘

P3-T011 (Distributor Setup) ────────────────────────┐
    │                                                │
    ├──────────────┐                                │
    ▼              ▼                                │
P3-T012        P3-T013                              │
(Handover)     (Commission)                         │
                                                     │
P2-T006 (WhatsApp Service) ─────────────────────────┤
    │                                                │
    ├──────────────┬──────────────┐                 │
    ▼              ▼              ▼                 │
P3-T014        P3-T015        P3-T016               │
(Reminders)    (Commands)     (Languages)           │
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase Auth complexity | High | Use official Next.js SSR helpers |
| Real-time data latency | Medium | Implement optimistic updates |
| Mobile camera issues | High | Test on multiple devices early |
| Large bundle size | Medium | Code splitting, lazy loading |
| Accessibility gaps | Medium | Audit with axe-core throughout |

---

## Quality Gates

### Before P3-T002 (After Setup)
- [ ] Authentication flow working
- [ ] Layout responsive on mobile/desktop
- [ ] Supabase connection verified

### Before Week 13 (After Core Features)
- [ ] Loan CRUD operations working
- [ ] Customer CRUD operations working
- [ ] Payment operations working
- [ ] 60%+ test coverage

### Before Phase 3 Complete
- [ ] All 10 admin dashboard pages functional
- [ ] All 5 distributor portal pages functional
- [ ] 80%+ test coverage
- [ ] Lighthouse score 90+
- [ ] WCAG 2.1 AA compliant
- [ ] Production deployment successful

---

## Resource Requirements

### Development Team
| Role | Count | Focus Area |
|------|-------|------------|
| Senior Frontend Developer | 1 | Admin Dashboard |
| Frontend Developer | 1 | Distributor Portal |
| Backend Developer (part-time) | 0.5 | API adjustments |
| QA Engineer | 0.5 | Testing |

### Infrastructure
- Vercel Pro account (deployment)
- Supabase Pro (if needed for scale)
- Playwright cloud (E2E testing)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Admin Dashboard pages | 15 | Count of functional pages |
| Distributor Portal pages | 5 | Count of functional pages |
| Test coverage | 80% | Jest coverage report |
| Lighthouse Performance | 90+ | Lighthouse audit |
| Lighthouse Accessibility | 90+ | Lighthouse audit |
| Time to Interactive | < 3s | Lighthouse audit |
| Bundle size | < 500KB | Build output |
| User satisfaction | 4/5 | UAT feedback |

---

## Next Steps (Immediate Actions)

1. **Initialize Admin Dashboard Project**
   ```bash
   cd frontend/admin-portal
   npx create-next-app@latest . --typescript --tailwind --app --src-dir
   ```

2. **Set Up Development Environment**
   - Configure ESLint and Prettier
   - Set up Husky pre-commit hooks
   - Configure Supabase environment variables

3. **Install Core Dependencies**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   npm install @tanstack/react-query @tanstack/react-table
   npm install react-hook-form @hookform/resolvers zod
   npm install recharts lucide-react
   npx shadcn-ui@latest init
   ```

4. **Create GitHub Issues**
   - Create issue for each P3-T* task
   - Assign to team members
   - Set up project board

---

**Document Version:** 1.0
**Created:** January 30, 2026
**Author:** Development Team
**Next Review:** Weekly during Phase 3
