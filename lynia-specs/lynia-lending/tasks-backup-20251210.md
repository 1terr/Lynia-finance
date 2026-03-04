# Lynia Finance - Implementation Tasks

**Project:** Lynia Finance - WhatsApp-Based Device Financing Platform
**Target Market:** Zimbabwe's Informal Sector
**Last Updated:** November 24, 2025

---

## Overview

This document tracks all implementation tasks for the Lynia Finance platform, organized by phase. Phase 0 (Research) is complete with 68 tasks. Phase 1 begins with architecture design and technical specifications based on research findings.

---

## Phase 0: Research & API Discovery ✅ COMPLETED

**Duration:** Weeks 1-4
**Status:** 68/68 tasks completed (100%)
**Completion Date:** November 17, 2025

### Summary of Phase 0 Deliverables:

#### **Core Banking (Fineract)**
- ✅ T001-T006: Fineract API integration (loan creation, repayments, queries)
- ✅ T045-T049: Fineract deployment strategies (Docker, AWS EC2)

#### **Communication Channels**
- ✅ T007-T009: WhatsApp Cloud API integration
- ✅ T030-T034: SMS/Email notification research

#### **KYC & Identity Verification**
- ✅ T010-T012: DIDIT integration
- ✅ T013: Zimbabwe National ID validation

#### **Payment Gateways**
- ✅ T014-T016: EcoCash/EcoCash/Omari/Innbucks/OneWallet integration
- ✅ T017: Omari payment gateway

#### **Device Management**
- ✅ T018-T021: Device lock/unlock APIs
- ✅ T022: IMEI tracking

#### **Infrastructure & Deployment**
- ✅ T023-T029: AWS Lambda serverless architecture
- ✅ T035-T044: Supabase database design
- ✅ T046-T049: AWS cost optimization

### Key Research Findings:

**Cost Structure (Year 1):**
- AWS Lambda: $0/month (67x within free tier)
- Fineract EC2: $0/month (free tier)
- Supabase: $0/month (free tier)
- **Total: $0/month for Year 1**

**Technology Stack Validated:**
- Apache Fineract 1.13.0 (core banking) ✅
- AWS Lambda (microservices) ✅
- Supabase PostgreSQL (application data) ✅
- WhatsApp Cloud API (customer communication) ✅
- DIDIT (KYC) ✅
- EcoCash/EcoCash/Omari/Innbucks/OneWallet (payments) ✅

---

## Phase 1: Architecture & Design Specifications

**Duration:** Weeks 5-8
**Status:** 0/45 tasks started (0%)
**Goal:** Convert Phase 0 research into detailed technical architecture and design documents

### 1.1 System Architecture Design (6 tasks)

#### P1-T001: High-Level Architecture Diagram
**Priority:** Critical
**Est:** 8 hours
**Dependencies:** Phase 0 research complete

**Deliverable:**
- System architecture diagram (draw.io/Lucidchart)
- Component interaction flows
- Data flow diagrams
- Integration points map

**Key Components:**
1. Customer Layer (WhatsApp)
2. API Gateway Layer (AWS Lambda)
3. Core Banking Layer (Fineract)
4. Data Layer (Supabase)
5. External Integrations (KYC, Payments, Device Lock)

---

#### P1-T002: Database Schema Design
**Priority:** Critical
**Est:** 12 hours
**Dependencies:** P1-T001

**Deliverable:**
- Complete Supabase schema (PostgreSQL)
- Entity Relationship Diagram (ERD)
- Table definitions with constraints
- Indexes and performance optimizations
- Row Level Security (RLS) policies

**Core Tables:**
- `customers` - Customer profiles and KYC data
- `loans` - Loan applications and status
- `devices` - Device inventory and assignments
- `payments` - Payment transactions and reconciliation
- `kyc_submissions` - KYC verification data
- `notifications` - Communication logs
- `distributors` - Agent network management
- `admin_users` - Platform administrators

---

#### P1-T003: API Specification Document
**Priority:** Critical
**Est:** 10 hours
**Dependencies:** P1-T001, P1-T002

**Deliverable:**
- OpenAPI 3.0 specification
- All microservice endpoints documented
- Request/response schemas
- Authentication flows
- Error codes and handling

**Microservices:**
1. WhatsApp Bot Service
2. KYC Processing Service
3. Credit Scoring Service
4. Payment Processing Service
5. Device Lock Service
6. Notification Service
7. Admin Dashboard API

---

#### P1-T004: Authentication & Authorization Design
**Priority:** Critical
**Est:** 6 hours
**Dependencies:** P1-T002, P1-T003

**Deliverable:**
- JWT token structure
- Supabase Auth integration plan
- Role-based access control (RBAC) model
- API key management for external services
- Security best practices document

**User Roles:**
- Customer (WhatsApp user)
- Distributor (agent)
- Admin (platform staff)
- System (service-to-service)

---

#### P1-T005: Error Handling & Logging Strategy
**Priority:** High
**Est:** 4 hours
**Dependencies:** P1-T003

**Deliverable:**
- Error code taxonomy
- Logging levels and formats
- CloudWatch Logs organization
- Error monitoring and alerting setup
- Incident response procedures

---

#### P1-T006: Data Privacy & Compliance Framework
**Priority:** Critical
**Est:** 8 hours
**Dependencies:** P1-T002

**Deliverable:**
- Data retention policies
- PII handling procedures
- Zimbabwe data protection compliance
- Encryption standards (at-rest, in-transit)
- Audit trail requirements
- GDPR considerations (for EU investors)

---

### 1.2 WhatsApp Bot Design (8 tasks)

#### P1-T007: Conversation Flow Design
**Priority:** Critical
**Est:** 10 hours
**Dependencies:** P1-T001

**Deliverable:**
- Complete conversation flow diagrams
- State machine design
- User journey maps
- Error recovery flows
- Fallback scenarios

**Core Flows:**
1. Onboarding & KYC
2. Device browsing and selection
3. Loan application
4. Payment management
5. Customer support
6. Account management

---

#### P1-T008: WhatsApp Message Templates
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T007

**Deliverable:**
- Message template catalog
- Template submission to Meta
- Multi-language support (English, Shona, Ndebele)
- Dynamic content placeholders
- Interactive button configurations

**Template Categories:**
- Welcome messages
- KYC instructions
- Loan approval/rejection
- Payment reminders
- Device unlock notifications

---

#### P1-T009: WhatsApp Bot State Management
**Priority:** High
**Est:** 8 hours
**Dependencies:** P1-T007, P1-T002

**Deliverable:**
- State machine implementation design
- Session management strategy
- Context persistence (Supabase)
- Timeout handling
- Multi-device session handling

---

#### P1-T010: WhatsApp Media Handling Design
**Priority:** Medium
**Est:** 4 hours
**Dependencies:** P1-T007

**Deliverable:**
- Image upload/download flows
- S3 storage strategy
- Supported media types
- File size limits
- Thumbnail generation

**Use Cases:**
- ID document uploads (KYC)
- Selfie verification
- Device condition photos

---

#### P1-T011: WhatsApp Interactive Components
**Priority:** Medium
**Est:** 6 hours
**Dependencies:** P1-T007

**Deliverable:**
- Button menu designs
- List message structures
- Quick reply configurations
- Call-to-action buttons
- Payment link integration

---

#### P1-T012: Natural Language Understanding (NLU) Design
**Priority:** Low
**Est:** 8 hours
**Dependencies:** P1-T007

**Deliverable:**
- Intent recognition design
- Entity extraction patterns
- Fallback handling
- Context-aware responses
- Multi-language NLU (optional Phase 2)

---

#### P1-T013: WhatsApp Rate Limiting Strategy
**Priority:** Medium
**Est:** 4 hours
**Dependencies:** P1-T003

**Deliverable:**
- Rate limit handling logic
- Queue management design
- Retry mechanisms
- User notification for delays

---

#### P1-T014: WhatsApp Bot Testing Strategy
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T007

**Deliverable:**
- Test conversation scenarios
- Mock WhatsApp API setup
- End-to-end test plan
- Performance testing approach

---

### 1.3 Credit Scoring System Design (6 tasks)

#### P1-T015: Hybrid Scoring Model Design
**Priority:** Critical
**Est:** 12 hours
**Dependencies:** P1-T001, Phase 0 research

**Deliverable:**
- Hybrid scoring algorithm specification
- Rule-based + ML model architecture
- Feature engineering plan
- Model versioning strategy
- A/B testing framework

**Data Sources:**
- Mobile money transaction history
- National ID verification
- Location data
- Social signals (optional)

---

#### P1-T016: Credit Scoring Features Definition
**Priority:** High
**Est:** 8 hours
**Dependencies:** P1-T015

**Deliverable:**
- Complete feature list with descriptions
- Feature importance ranking
- Data source mapping
- Feature transformation logic
- Missing data handling

**Feature Categories:**
1. Identity verification strength
2. Mobile money behavior patterns
3. Repayment history (if exists)
4. Loan amount vs income indicators

---

#### P1-T017: Rule-Based Scoring Logic
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T015, P1-T016

**Deliverable:**
- Hard rules for instant rejection
- Soft rules for risk assessment
- Tiered lending limits ($200/$350/$500)
- Manual review triggers

**Example Rules:**
- ID verification failed → Reject
- First-time borrower → $200 max
- Clean repayment history → $500 eligible

---

#### P1-T018: ML Model Architecture (Placeholder)
**Priority:** Medium
**Est:** 8 hours
**Dependencies:** P1-T016

**Deliverable:**
- Model architecture design
- Training data requirements
- Model evaluation metrics
- Continuous learning plan
- Fallback to rule-based if ML unavailable

**Note:** ML implementation deferred to Phase 3+

---

#### P1-T019: Credit Decision API Design
**Priority:** High
**Est:** 4 hours
**Dependencies:** P1-T015, P1-T017

**Deliverable:**
- Credit decision endpoint specification
- Input/output schemas
- Response time SLA (<5 seconds)
- Audit logging requirements

---

#### P1-T020: Credit Limit Management
**Priority:** High
**Est:** 4 hours
**Dependencies:** P1-T017

**Deliverable:**
- Tier progression rules
- Limit increase triggers
- Downgrade scenarios
- Override mechanisms (manual review)

**Tiers:**
- Tier 1: $200 (first-time)
- Tier 2: $350 (after 1 successful repayment)
- Tier 3: $500 (after 3+ successful repayments)

---

### 1.4 Payment Processing Design (6 tasks)

#### P1-T021: Payment Gateway Integration Architecture
**Priority:** Critical
**Est:** 8 hours
**Dependencies:** Phase 0 (T014-T017)

**Deliverable:**
- EcoCash/EcoCash/Omari/Innbucks/OneWallet integration design
- Webhook handling architecture
- Payment reconciliation flow
- Retry and idempotency strategy
- Multi-gateway fallback

---

#### P1-T022: Payment Reconciliation Logic
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T021, P1-T002

**Deliverable:**
- Reconciliation algorithm
- Match payment to loan
- Handle partial payments
- Handle overpayments
- Handle duplicate payments
- Daily reconciliation report

---

#### P1-T023: Payment Notification Design
**Priority:** Medium
**Est:** 4 hours
**Dependencies:** P1-T021, P1-T008

**Deliverable:**
- Payment confirmation messages
- Receipt generation
- Failed payment notifications
- Retry reminders

---

#### P1-T024: Payment Retry Logic
**Priority:** High
**Est:** 4 hours
**Dependencies:** P1-T021

**Deliverable:**
- Retry schedule (immediate, 1h, 6h, 24h)
- Exponential backoff strategy
- Maximum retry attempts
- Manual intervention triggers

---

#### P1-T025: Refund Processing Design
**Priority:** Low
**Est:** 4 hours
**Dependencies:** P1-T021

**Deliverable:**
- Refund initiation workflow
- Approval process
- Refund tracking
- Customer notification

---

#### P1-T026: Payment Security & Fraud Prevention
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T021

**Deliverable:**
- Duplicate payment detection
- Suspicious transaction flagging
- Payment velocity limits
- Fraud alert system

---

### 1.5 KYC & Onboarding Design (5 tasks)

#### P1-T027: KYC Document Requirements
**Priority:** Critical
**Est:** 4 hours
**Dependencies:** Phase 0 (T010-T013)

**Deliverable:**
- Required documents list
- Zimbabwe National ID validation rules
- Selfie verification requirements
- Document quality checks
- Retry limits and fallbacks

---

#### P1-T028: DIDIT Integration Flow
**Priority:** Critical
**Est:** 6 hours
**Dependencies:** P1-T027, Phase 0 (T010-T012)

**Deliverable:**
- DIDIT API integration design
- Document upload flow
- Verification callback handling
- Retry logic for failed verifications
- Manual review escalation

---

#### P1-T029: Customer Onboarding Flow
**Priority:** Critical
**Est:** 8 hours
**Dependencies:** P1-T007, P1-T027

**Deliverable:**
- Step-by-step onboarding flow
- Progress tracking
- Drop-off recovery
- Onboarding completion metrics

**Steps:**
1. Phone number verification (OTP)
2. Basic info collection
3. ID upload
4. Selfie capture
5. KYC verification
6. Credit assessment
7. Loan offer

---

#### P1-T030: KYC Status Management
**Priority:** Medium
**Est:** 4 hours
**Dependencies:** P1-T028, P1-T002

**Deliverable:**
- KYC status states (pending, approved, rejected, expired)
- Status transition rules
- Re-verification triggers
- Expiry handling (annual re-verification)

---

#### P1-T031: Privacy & Consent Management
**Priority:** High
**Est:** 4 hours
**Dependencies:** P1-T027, P1-T006

**Deliverable:**
- Consent collection flow
- Terms and conditions
- Privacy policy acceptance
- Data sharing permissions
- Consent revocation process

---

### 1.6 Device Management Design (5 tasks)

#### P1-T032: Device Catalog Design
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T002

**Deliverable:**
- Device catalog schema
- Device attributes (brand, model, specs, price)
- Inventory tracking
- Pricing tiers
- Device images and media

---

#### P1-T033: Device Lock/Unlock Integration
**Priority:** Critical
**Est:** 8 hours
**Dependencies:** Phase 0 (T018-T021)

**Deliverable:**
- Lock/unlock API integration design
- IMEI tracking
- Lock trigger conditions (missed payment)
- Unlock conditions (payment received)
- Grace period handling
- Customer communication flow

---

#### P1-T034: Device Handover Process
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T032, P1-T033

**Deliverable:**
- Handover workflow (distributor → customer)
- ID verification at handover
- IMEI registration
- Device activation
- Handover confirmation
- Photo documentation

---

#### P1-T035: Device Return/Repossession Flow
**Priority:** Medium
**Est:** 4 hours
**Dependencies:** P1-T033, P1-T034

**Deliverable:**
- Repossession triggers (90+ days overdue)
- Repossession workflow
- Device recovery process
- Customer communication
- Legal considerations

---

#### P1-T036: Device Condition Assessment
**Priority:** Low
**Est:** 4 hours
**Dependencies:** P1-T034

**Deliverable:**
- Device condition checklist
- Photo documentation requirements
- Condition impact on loan terms
- Damage handling

---

### 1.7 Notification System Design (4 tasks)

#### P1-T037: Multi-Channel Notification Design
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T003

**Deliverable:**
- Notification channel priority (WhatsApp > SMS > Email)
- Fallback logic
- Delivery tracking
- Opt-out management

---

#### P1-T038: Notification Templates & Triggers
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T037, P1-T008

**Deliverable:**
- Complete notification catalog
- Trigger conditions
- Scheduling rules
- Personalization tokens

**Notification Types:**
- Loan approval/rejection
- Payment due reminders (7 days, 3 days, 1 day before)
- Payment confirmation
- Device lock warning
- Device unlocked confirmation

---

#### P1-T039: Payment Reminder Strategy
**Priority:** High
**Est:** 4 hours
**Dependencies:** P1-T038

**Deliverable:**
- Reminder schedule (D-7, D-3, D-1, D+1, D+3, D+7)
- Message tone progression (friendly → urgent)
- Escalation to phone call
- Opt-out handling

---

#### P1-T040: Notification Queue Management
**Priority:** Medium
**Est:** 4 hours
**Dependencies:** P1-T037

**Deliverable:**
- Queue design (AWS SQS/Supabase Realtime)
- Priority handling
- Retry logic
- Dead letter queue

---

### 1.8 Admin Dashboard Design (5 tasks)

#### P1-T041: Admin Dashboard Wireframes
**Priority:** Medium
**Est:** 8 hours
**Dependencies:** P1-T001

**Deliverable:**
- Dashboard wireframes (Figma/Sketch)
- Navigation structure
- Key metrics display
- User flows for admin tasks

**Pages:**
- Dashboard (KPIs)
- Loan management
- Customer management
- Payment reconciliation
- Reports
- Settings

---

#### P1-T042: Admin User Roles & Permissions
**Priority:** High
**Est:** 4 hours
**Dependencies:** P1-T004

**Deliverable:**
- Admin role definitions
- Permission matrix
- Role-based UI visibility
- Audit logging for admin actions

**Roles:**
- Super Admin (full access)
- Operations Manager (loans, payments)
- Customer Support (read-only + messaging)
- Finance Team (reports, reconciliation)

---

#### P1-T043: Reporting Requirements
**Priority:** Medium
**Est:** 6 hours
**Dependencies:** P1-T002

**Deliverable:**
- Report specifications
- Data aggregation logic
- Export formats (CSV, PDF)
- Scheduled reports

**Reports:**
- Loan portfolio performance
- Payment collection
- Delinquency report
- KYC completion rates
- Device inventory
- Financial statements

---

#### P1-T044: Manual Review Workflows
**Priority:** High
**Est:** 6 hours
**Dependencies:** P1-T041

**Deliverable:**
- Manual review queue design
- Escalation triggers
- Review workflows
- Decision logging
- SLA tracking

**Review Types:**
- KYC manual verification
- Credit decision overrides
- Payment disputes
- Device repossession approvals

---

#### P1-T045: Admin Notification System
**Priority:** Low
**Est:** 4 hours
**Dependencies:** P1-T037, P1-T041

**Deliverable:**
- Admin alert types
- Alert channels (email, Slack)
- Alert rules and thresholds
- Alert acknowledgment

**Alerts:**
- High-value loan approvals
- Failed payments spike
- KYC verification failures
- System errors

---

## Phase 2: Foundation & Infrastructure Setup

**Duration:** Weeks 9-10
**Status:** Not started
**Goal:** Set up development environment, CI/CD, and core infrastructure

### 2.1 AWS Infrastructure Setup (8 tasks)
### 2.2 Supabase Setup (6 tasks)
### 2.3 Development Environment (6 tasks)
### 2.4 CI/CD Pipeline (4 tasks)
### 2.5 Monitoring & Observability (4 tasks)

**Total:** 28 tasks (deferred to Phase 2 planning)

---

## Phase 3: Core Backend Services

**Duration:** Weeks 11-13
**Status:** Not started
**Goal:** Implement all microservices

### 3.1 Authentication Service
### 3.2 WhatsApp Bot Service
### 3.3 KYC Processing Service
### 3.4 Credit Scoring Service
### 3.5 Payment Processing Service
### 3.6 Device Lock Service
### 3.7 Notification Service

**Total:** ~40 tasks (deferred to Phase 3 planning)

---

## Phase 4: Frontend Applications

**Duration:** Weeks 14-16
**Status:** Not started
**Goal:** Build admin dashboard and distributor portal

### 4.1 Admin Dashboard (Next.js)
### 4.2 Distributor Dashboard (Next.js)

**Total:** ~25 tasks (deferred to Phase 4 planning)

---

## Phase 5: Testing & Deployment

**Duration:** Weeks 17-19
**Status:** Not started
**Goal:** Integration testing, UAT, production deployment

### 5.1 Integration Testing
### 5.2 User Acceptance Testing
### 5.3 Production Deployment
### 5.4 Launch Preparation

**Total:** ~20 tasks (deferred to Phase 5 planning)

---

## Task Status Legend

- 🔴 **Blocked** - Cannot proceed due to dependency
- 🟡 **In Progress** - Currently being worked on
- 🟢 **Completed** - Done and reviewed
- ⚪ **Not Started** - Scheduled but not begun
- 🔵 **Under Review** - Completed, awaiting approval

---

## Phase 1 Summary

**Total Tasks:** 45
**Estimated Duration:** 4 weeks (160 hours)
**Critical Path:** Architecture → Database → APIs → WhatsApp Bot

**Key Deliverables:**
1. Complete system architecture documentation
2. Database schema with migrations
3. API specifications (OpenAPI 3.0)
4. WhatsApp conversation flows
5. Credit scoring algorithm specification
6. Payment processing architecture
7. KYC integration design
8. Admin dashboard wireframes

---

## Next Steps

1. Review and approve Phase 1 task breakdown
2. Assign tasks to team members (or solo sequence)
3. Begin with P1-T001 (Architecture Diagram)
4. Use Phase 0 research as reference throughout Phase 1
5. Update this document as tasks progress

---

**Document Version:** 1.0
**Last Updated:** November 24, 2025
**Updated By:** Development Team
**Next Review:** Weekly during Phase 1
