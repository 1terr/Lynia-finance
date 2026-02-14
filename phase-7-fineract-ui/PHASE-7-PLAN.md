# Phase 7: Fineract UI Integration into Admin Portal

## Overview

Phase 7 integrates Apache Fineract's loan management capabilities directly into the
Next.js admin-portal dashboard. The existing frontend (Phase 3) reads loan data from
Lynia's own database. Phase 7 replaces or augments those views with **real-time data
from the Fineract core banking engine**, giving staff a single source of truth for
loan lifecycle management, repayment tracking, GL accounting, and regulatory reporting.

## Prerequisites (Completed in Phase 6)

| Component | Location | Status |
|-----------|----------|--------|
| Fineract TypeScript Types | `services/shared/types/fineract.ts` | Complete |
| HTTP Client + Circuit Breaker | `services/shared/clients/fineract.ts` | Complete |
| Fineract Sync Service | `services/shared/clients/fineract-sync.ts` | Complete |
| Reconciliation Job | `services/shared/clients/fineract-reconcile.ts` | Complete |
| ECS Fargate Infrastructure | `phase-6-fineract-integration/infrastructure/` | Complete |
| 3-Tier Loan Products | `phase-6-fineract-integration/config/loan-products.json` | Complete |
| Chart of Accounts | `phase-6-fineract-integration/config/chart-of-accounts.json` | Complete |

## Architecture

```
Admin Portal (Next.js 14)
  │
  ├── Frontend API Layer (lib/api/fineract.ts)
  │     └── Calls API Gateway → Lambda endpoints
  │
  ├── API Gateway (REST)
  │     └── Cognito JWT Authorizer
  │
  ├── Lambda Services
  │     ├── GET  /api/v1/fineract/loans
  │     ├── GET  /api/v1/fineract/loans/:id
  │     ├── POST /api/v1/fineract/loans/:id/approve
  │     ├── POST /api/v1/fineract/loans/:id/disburse
  │     ├── POST /api/v1/fineract/loans/:id/repayment
  │     ├── GET  /api/v1/fineract/loan-products
  │     ├── GET  /api/v1/fineract/gl-accounts
  │     ├── GET  /api/v1/fineract/journal-entries
  │     ├── GET  /api/v1/fineract/reconciliation
  │     └── GET  /api/v1/fineract/loans/overdue
  │
  └── Fineract Client (services/shared/clients/fineract.ts)
        └── Internal ALB → ECS Fargate → Fineract (port 8443)
```

## User Journeys Supported

### 1. Loan Officer - Daily Loan Management
1. Login to admin portal
2. View loan dashboard with **real-time Fineract balances**
3. Filter by status (pending → active → overdue → closed)
4. Click loan → see Fineract repayment schedule + GL entries
5. Approve/reject pending loans → triggers Fineract state transition
6. Disburse approved loans → creates GL journal entries in Fineract
7. Record repayments → posts to Fineract, updates balances

### 2. Finance Manager - Portfolio Oversight
1. View overdue loans dashboard with **aging buckets** (1-30, 31-60, 61-90, 90+)
2. Review reconciliation dashboard (Lynia DB vs Fineract discrepancies)
3. Export GL trial balance for RBZ regulatory reporting
4. View journal entries for audit trail

### 3. Admin - Product Configuration
1. View all Fineract loan products (3 tiers)
2. See product details (rates, terms, GL account mappings)
3. Monitor product performance metrics

## Task Breakdown (TDD Approach)

### Group 1: Foundation (T001-T003)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T001 | Phase-7 directory structure + planning docs | Setup | Complete |
| T002 | Fineract-aware frontend types | Types | Pending |
| T003 | Fineract API client for frontend | API | Pending |

### Group 2: Fineract Loan Dashboard (T004-T005)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T004 | Fineract loan list tests | Test | Pending |
| T005 | Fineract-aware loan list page | Component | Pending |

### Group 3: Loan Detail with Schedule (T006-T007)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T006 | Fineract loan detail tests | Test | Pending |
| T007 | Loan detail page (balance, schedule, transactions) | Component | Pending |

### Group 4: Loan Approval Workflow (T008-T009)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T008 | Loan approval workflow tests | Test | Pending |
| T009 | Dedicated loan approval page with Fineract actions | Component | Pending |

### Group 5: Repayment & Payments (T010-T011)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T010 | Repayment schedule + payment recording tests | Test | Pending |
| T011 | Repayment schedule component + payment form | Component | Pending |

### Group 6: Reconciliation Dashboard (T012-T013)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T012 | Reconciliation dashboard tests | Test | Pending |
| T013 | Reconciliation dashboard (Lynia vs Fineract) | Component | Pending |

### Group 7: Loan Products Management (T014-T015)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T014 | Loan products page tests | Test | Pending |
| T015 | Loan products management page | Component | Pending |

### Group 8: GL / Accounting (T016-T017)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T016 | GL journal entries view tests | Test | Pending |
| T017 | GL journal entries + trial balance dashboard | Component | Pending |

### Group 9: Overdue Loans (T018-T019)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T018 | Overdue loans page tests | Test | Pending |
| T019 | Overdue loans page with aging analysis | Component | Pending |

### Group 10: Summary & Delivery (T020)
| Task | Description | Type | Status |
|------|-------------|------|--------|
| T020 | Phase 7 summary report, commit, push | Docs | Pending |

## Fineract UI Capabilities Reference

Apache Fineract exposes a complete REST API for loan management. The following
operations are surfaced in the admin portal UI:

### Loan Lifecycle (State Machine)
```
  Submitted (Pending Approval)
       │
       ├── Approve  → Approved
       │                 │
       │                 └── Disburse → Active
       │                                  │
       │                                  ├── Repayment → (reduces balance)
       │                                  ├── Write-Off → Written Off
       │                                  └── Fully Paid → Closed (Obligations Met)
       │
       └── Reject → Rejected
```

### Key Fineract Endpoints Used in UI
| Operation | Method | Endpoint | UI Location |
|-----------|--------|----------|-------------|
| List loans | GET | `/loans` | Loan Dashboard |
| Loan detail | GET | `/loans/{id}?associations=all` | Loan Detail Page |
| Approve | POST | `/loans/{id}?command=approve` | Approval Workflow |
| Disburse | POST | `/loans/{id}?command=disburse` | Approval Workflow |
| Post repayment | POST | `/loans/{id}/transactions?command=repayment` | Payment Form |
| Loan products | GET | `/loanproducts` | Products Page |
| GL accounts | GET | `/glaccounts` | Accounting Page |
| Journal entries | GET | `/journalentries` | Accounting Page |

## Testing Strategy

- **Unit tests**: Every API function, utility, and component
- **Integration tests**: API client → mock Fineract responses
- **Component tests**: Render with mock data, verify user interactions
- **Coverage target**: 80% overall, 90% for financial operations

## Currency & Formatting Rules
- Always display currency symbol: `$500.00` (USD), `ZWL 500.00`, `R500.00` (ZAR)
- Use 2 decimal places for all money values
- Thousand separators for amounts > 999
- Dates: Relative for <7 days ("2 hours ago"), absolute otherwise ("14 Feb 2026")

## Status Color Coding
| Status | Color | Badge |
|--------|-------|-------|
| Pending Approval | Yellow/Amber | `bg-yellow-100 text-yellow-800` |
| Approved | Blue | `bg-blue-100 text-blue-800` |
| Active | Green | `bg-green-100 text-green-800` |
| Overdue | Red | `bg-red-100 text-red-800` |
| Closed (Paid) | Gray | `bg-gray-100 text-gray-800` |
| Written Off | Dark Red | `bg-red-200 text-red-900` |
| Rejected | Red | `bg-red-100 text-red-800` |
