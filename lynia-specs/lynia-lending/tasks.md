# Tasks: WhatsApp Bot for Device Financing

**Input**: Design documents from `/specs/lynia-lending/`
**Prerequisites**: plan.md (complete), spec.md (complete), lynia-finance-core.md specification (complete)

**Tests**: Tests are MANDATORY per constitution requirement for Test-Driven Development (TDD). All tests MUST be written FIRST and FAIL before implementation.

**Organization**: Tasks are grouped by implementation phase and milestone (as defined in plan.md), then by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story/Milestone] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US8)
- **[Milestone]**: Which milestone from plan.md (M0-M12)
- Include exact file paths in descriptions

## Path Conventions
- **Microservices architecture**:
  - Backend services: `services/{service-name}/src/`, `services/{service-name}/tests/`
  - Frontends: `frontend/admin-portal/`, `frontend/distributor-dashboard/`
  - ML service: `services/ml-scoring/src/` (Python)
  - Shared: `shared/types/`, `shared/utils/`

## Database Architecture - YC Bootstrap (Supabase FREE Tier)
- **Supabase PostgreSQL FREE Tier (500MB limit - optimized)**:
  - `fineract_tenants` database (Apache Fineract multi-tenancy config)
  - `fineract_default` database (loan accounts, transactions, repayment schedules)
  - Operational tables: whatsapp_sessions, distributor_inventory, distributor_commissions, inventory_reconciliations, admin_users, support_tickets, kyc_cache, payment_reconciliations, payment_callbacks, next_of_kin, model_versions, lock_commands, event_log
  - **Optimization**: Table compression (LZ4), partitioning (monthly), 90-day event_log retention

## Supabase Platform Services (FREE Tier)
- **Supabase Auth**: Admin/distributor authentication, Row Level Security (RLS) for RBAC, MFA for admin roles
- **Supabase Realtime**: Live inventory updates, commission dashboards, payment status (200 concurrent connections FREE)
- **Supabase Edge Functions**: Serverless Deno/TypeScript functions for cron jobs (500K invocations/month FREE)
- **Supabase Storage**: Commission PDFs, KYC documents, reconciliation photos (1GB FREE)

## Custom Microservices - AWS Lambda (Always FREE: 1M requests/month)
1. **whatsapp-service** (Node.js/TypeScript) - WhatsApp Cloud API webhook handler, conversation state machine
2. **kyc-service** (Node.js/TypeScript) - Smile Identity integration, duplicate detection, Next of Kin SMS verification (Africa's Talk)
3. **scoring-service** (Python) - ML models, Fineract Scorecard integration, A/B testing
4. **payment-service** (Node.js/TypeScript) - EcoCash/Omari integration, payment callbacks, Fineract posting, idempotency
5. **lock-service** (Node.js/TypeScript) - Third-party lock provider API, grace period logic, lock/unlock commands

## Apache Fineract Deployment - AWS EC2 Free Tier
- **EC2 t3.micro** (750 hrs/month FREE for 12 months, then $8/month reserved instance)
- **Docker Compose** with Fineract connecting to Supabase PostgreSQL
- **1GB RAM, 2 vCPUs** (sufficient for <1000 active loans)

---

## Phase 0: Research (Milestone 0 - Weeks 1-3)

**Purpose**: Vendor evaluation, API research, technical feasibility validation

**⚠️ CRITICAL**: Must complete before design phase begins

### R0.1: Apache Fineract REST API Research

- [ ] T001 [P] [M0] Research Fineract loan creation API (POST /clients, POST /loans)
- [ ] T002 [P] [M0] Research Fineract repayment posting API (POST /loans/{loanId}/transactions)
- [ ] T003 [P] [M0] Research Fineract account query API (GET /loans/{loanId}/repaymentschedule)
- [ ] T004 [P] [M0] Document Fineract authentication (basic auth, API key, OAuth) in research.md
- [ ] T005 [P] [M0] Document Fineract loan product configuration (25-50% interest rate) in research.md
- [ ] T006 [M0] Create Fineract API integration test plan (localhost Docker instance)

### R0.2: WhatsApp Cloud API (Meta) Research - YC Bootstrap Free Tier

- [ ] T007 [P] [M0] Research WhatsApp Cloud API webhook setup via Meta Graph API (incoming message handling)
- [ ] T008 [P] [M0] Research WhatsApp Cloud API message sending (POST /v18.0/{phone-number-id}/messages with text, buttons, lists)
- [ ] T009 [P] [M0] Research WhatsApp Cloud API conversation windows (24hr free session, pricing after)
- [ ] T010 [P] [M0] Research WhatsApp Cloud API message templates (pre-approved templates for notifications outside 24hr window)
- [ ] T011 [P] [M0] Document WhatsApp Cloud API rate limits (80 msg/sec) and FREE tier (1000 conversations/month) in research.md
- [ ] T012 [M0] Create Meta Business Account, register WhatsApp Business phone number, get API access token, and verify message flow
- [ ] T012a [P] [M0] Document cost comparison: WhatsApp Cloud API ($0 for 1000 conversations) vs Twilio ($0.005/message = $75/month for 500 msgs/day)
- [ ] T012b [P] [M0] Research WhatsApp Cloud API webhook verification (required by Meta for security)

### R0.3: EcoCash & Omari Payment Gateway Research

- [ ] T013 [P] [M0] Research EcoCash USSD integration (payment initiation, callback handling)
- [ ] T014 [P] [M0] Research Omari payment API (REST endpoints, webhook callbacks)
- [ ] T015 [P] [M0] Document payment callback payload schemas in research.md
- [ ] T016 [P] [M0] Document callback authentication mechanisms (HMAC, API keys)
- [ ] T017 [P] [M0] Document callback retry strategies from gateway side
- [ ] T018 [M0] Identify sandbox/test environments for EcoCash and Omari

### R0.3a: Africa's Talk SMS Provider Research - YC Bootstrap Cost Optimization

- [ ] T018a [P] [M0] Research Africa's Talk SMS API for Zimbabwe ($0.008/SMS vs Twilio $0.05/SMS = 6x cheaper)
- [ ] T018b [P] [M0] Research Africa's Talk authentication (API key + username)
- [ ] T018c [P] [M0] Research Africa's Talk SMS sending API (POST /version1/messaging)
- [ ] T018d [P] [M0] Research Africa's Talk delivery callbacks and status tracking
- [ ] T018e [P] [M0] Document Africa's Talk sender ID registration process for "LYNIA" in Zimbabwe
- [ ] T018f [P] [M0] Document cost comparison: 100 SMS/month with Africa's Talk ($0.80) vs Twilio ($5.00)
- [ ] T018g [M0] Create Africa's Talk test account and verify SMS delivery in Zimbabwe

### R0.4: Smile Identity KYC API Research

- [ ] T019 [P] [M0] Research Smile Identity Zimbabwe national ID verification API
- [ ] T020 [P] [M0] Research Smile Identity liveness detection (selfie + ID document)
- [ ] T021 [P] [M0] Document Smile Identity request/response schemas in research.md
- [ ] T022 [P] [M0] Document Smile Identity error handling (manual review, ID not found)
- [ ] T023 [P] [M0] Document Smile Identity authentication (API key, partner ID)
- [ ] T024 [M0] Create test account and verify Zimbabwe ID validation works

### R0.5: Hybrid Credit Scoring System Research

- [ ] T025 [P] [M0] Research Apache Fineract Scorecard API (baseline scoring 0-100)
- [ ] T026 [P] [M0] Research Fineract scorecard configuration (criteria, weights)
- [ ] T027 [P] [M0] Document Fineract scorecard data requirements in research.md
- [ ] T028 [P] [M0] Research ML model features for underbanked customers (phone usage, location, transaction patterns)
- [ ] T029 [P] [M0] Document hybrid scoring formula: Fineract baseline + ML adjustment (-20 to +20) = final score
- [ ] T030 [P] [M0] Document score-based loan tiers: 60-70=$200, 71-85=$350, 86-100=$500
- [ ] T031 [M0] Design cold start handling: Fineract only until 100+ loans disbursed

### R0.6: Supabase Realtime & Edge Functions Research

- [ ] T032 [P] [M0] Research Supabase Realtime database change subscriptions (INSERT/UPDATE/DELETE listeners)
- [ ] T033 [P] [M0] Research Supabase Realtime channels and Row Level Security (RLS) integration
- [ ] T034 [P] [M0] Test Supabase Realtime latency with inventory table changes (<100ms requirement)
- [ ] T035 [P] [M0] Research Supabase Edge Functions Deno runtime (TypeScript, NPM modules)
- [ ] T036 [P] [M0] Research Edge Functions cron jobs (weekly commissions, daily reminders, reconciliation)
- [ ] T037 [P] [M0] Research Edge Functions database trigger integration (auto-execute on INSERT/UPDATE)
- [ ] T038 [P] [M0] Research Supabase Storage (file upload, signed URLs, automatic image optimization)
- [ ] T039 [P] [M0] Document event architecture: PostgreSQL triggers + pg_notify() + event_log table
- [ ] T040 [M0] Create Supabase project and test Realtime subscription with inventory table
- [ ] T041 [M0] Deploy test Edge Function with Twilio API call (send SMS)
- [ ] T042 [M0] Test Supabase Storage file upload and signed URL retrieval
- [ ] T043 [M0] Load test: 50 concurrent Realtime subscriptions without degradation

### R0.7: Third-Party Device Lock Provider Evaluation

- [ ] T044 [P] [M0] Research 3+ device lock providers with lending app APIs
- [ ] T045 [P] [M0] Document provider comparison: features, pricing, API quality, Zimbabwe support
- [ ] T046 [P] [M0] Document API capabilities: lock, unlock, status check, webhook notifications
- [ ] T047 [P] [M0] Document device pre-installation workflow with provider
- [ ] T048 [M0] Select provider and document decision rationale in research.md
- [ ] T049 [M0] Create test account and verify lock/unlock API works

### R0.8: AWS Free Tier Research - YC Bootstrap Infrastructure

- [ ] T049a [P] [M0] Research AWS Lambda always-free tier (1M requests/month, 400K GB-seconds)
- [ ] T049b [P] [M0] Research AWS EC2 t3.micro free tier (750 hrs/month for 12 months, 1GB RAM, 2 vCPUs)
- [ ] T049c [P] [M0] Research AWS API Gateway free tier (1M requests/month for 12 months, then $1/million)
- [ ] T049d [P] [M0] Document Lambda cold start mitigation strategies (SnapStart, provisioned concurrency)
- [ ] T049e [P] [M0] Calculate estimated Lambda usage for 5 microservices (whatsapp, kyc, payment, lock, scoring)
- [ ] T049f [P] [M0] Document Apache Fineract deployment on EC2 t3.micro (Docker Compose, PostgreSQL connection)
- [ ] T049g [P] [M0] Document post-12-month costs: EC2 reserved instance ($8/month) or AWS Lightsail ($5/month)
- [ ] T049h [P] [M0] Research AWS SAM (Serverless Application Model) vs Serverless Framework for Lambda deployment
- [ ] T049i [M0] Create AWS account and verify free tier eligibility
- [ ] T049j [M0] Document cost comparison: AWS Lambda + EC2 Free Tier ($0-10/month Year 1) vs Railway/Fly.io ($50-65/month)

**Checkpoint**: Research phase complete - all vendor APIs understood, test accounts created, YC Bootstrap infrastructure validated

---

## Phase 1: Design (Milestones D1.1-D1.8 - Weeks 4-8)

**Purpose**: Produce detailed design documents for implementation

**⚠️ CRITICAL**: Design must be complete before implementation begins

### D1.1: Data Model Design

- [ ] T044 [P] [M0] Design PostgreSQL schema for whatsapp_sessions table in data-model.md
- [ ] T045 [P] [M0] Design PostgreSQL schema for distributor_inventory table (IMEI-level, consignment model) in data-model.md
- [ ] T046 [P] [M0] Design PostgreSQL schema for customer_tentative_selections table in data-model.md
- [ ] T047 [P] [M0] Design PostgreSQL schema for distributor_commissions table in data-model.md
- [ ] T048 [P] [M0] Design PostgreSQL schema for inventory_reconciliations table in data-model.md
- [ ] T049 [P] [M0] Design PostgreSQL schema for admin_users table in data-model.md
- [ ] T050 [P] [M0] Design PostgreSQL schema for support_tickets table in data-model.md
- [ ] T051 [P] [M0] Design PostgreSQL schema for kyc_cache table in data-model.md
- [ ] T052 [P] [M0] Design PostgreSQL schema for payment_reconciliations table in data-model.md
- [ ] T053 [P] [M0] Design PostgreSQL schema for payment_callbacks table (idempotency) in data-model.md
- [ ] T054 [P] [M0] Design PostgreSQL schema for next_of_kin table (SMS verification) in data-model.md
- [ ] T055 [P] [M0] Design PostgreSQL schema for model_versions table (ML registry) in data-model.md
- [ ] T056 [P] [M0] Design PostgreSQL schema for lock_commands table in data-model.md
- [ ] T057 [M0] Document Fineract entity mapping: Client, Loan Account, Repayment Schedule, Transaction in data-model.md
- [ ] T058 [M0] Define foreign key relationships and indexes in data-model.md
- [ ] T059 [M0] Define 7-year retention policy for audit_logs and transactions in data-model.md

### D1.2: API Contracts

- [ ] T060 [P] [M0] Design fineract-client.yaml OpenAPI contract (loan creation, repayment, queries)
- [ ] T061 [P] [M0] Design whatsapp-service.yaml OpenAPI contract (webhook, conversation state)
- [ ] T062 [P] [M0] Design kyc-service.yaml OpenAPI contract (ID verification, caching)
- [ ] T063 [P] [M0] Design scoring-service.yaml OpenAPI contract (hybrid scoring, A/B testing, grace period calculation)
- [ ] T064 [P] [M0] Design payment-service.yaml OpenAPI contract (initiation, callbacks with idempotency, reconciliation)
- [ ] T065 [P] [M0] Design notification-service.yaml OpenAPI contract (email/SMS, templates)
- [ ] T066 [P] [M0] Design inventory-service.yaml OpenAPI contract (CRUD, WebSocket, consignment tracking)
- [ ] T067 [P] [M0] Design lock-service.yaml OpenAPI contract (lock/unlock, grace period triggers)
- [ ] T068 [P] [M0] Design admin-service.yaml OpenAPI contract (dashboard, reporting, RBAC, commission management)
- [ ] T069 [P] [M0] Design cs-service.yaml OpenAPI contract (tickets, escalation, disputes)
- [ ] T070 [M0] Validate all contracts follow OpenAPI 3.0 spec with validation rules

### D1.3: Event Architecture Design

- [ ] T071 [P] [M0] Design SNS topic structure: loan-events, payment-events, inventory-events, notification-events in event-schemas.yaml
- [ ] T072 [P] [M0] Design SQS queue structure per subscriber service in event-schemas.yaml
- [ ] T073 [P] [M0] Design DLQ configuration for failed message handling in event-schemas.yaml
- [ ] T074 [P] [M0] Define event schemas: loan.created, loan.approved, payment.received, payment.completed in event-schemas.yaml
- [ ] T075 [P] [M0] Define event schemas: inventory.handover, commission.calculated, reconciliation.required in event-schemas.yaml
- [ ] T076 [P] [M0] Define event schemas: repayment.overdue, device.lock_triggered, device.unlocked in event-schemas.yaml
- [ ] T077 [M0] Document event retry policies (exponential backoff, max attempts) in event-schemas.yaml

### D1.4: Business Logic Design

- [ ] T078 [P] [M0] Design hybrid scoring logic: Fineract Scorecard + ML adjustment in calculations.md
- [ ] T079 [P] [M0] Design loan tier calculation: score 60-70=$200, 71-85=$350, 86-100=$500 in calculations.md
- [ ] T080 [P] [M0] Design grace period formula: 0-1 late=15d, 2-3=12d, 4-5=10d, 6+=7d in calculations.md
- [ ] T081 [P] [M0] Design commission calculation: Device Retail Price × Commission Rate (3-5%) in calculations.md
- [ ] T082 [P] [M0] Design weekly commission batch: aggregate Pending (Monday-Sunday), pay Monday 9AM in calculations.md
- [ ] T083 [P] [M0] Design monthly reconciliation: physical count vs system count, shrinkage charges in calculations.md
- [ ] T084 [P] [M0] Design duplicate customer detection: National ID primary key, loan status checks in calculations.md
- [ ] T085 [M0] Document all business rules and edge cases in calculations.md

### D1.5: Security Design

- [ ] T086 [P] [M0] Design RBAC matrix: Super Admin, Financial Ops, Risk/Compliance, Customer Support in security.md
- [ ] T087 [P] [M0] Design JWT authentication for admin/distributor portals in security.md
- [ ] T088 [P] [M0] Design API key authentication for service-to-service calls in security.md
- [ ] T089 [P] [M0] Design session timeout logic (15min inactivity) in security.md
- [ ] T090 [P] [M0] Design audit logging schema (user_id, action, resource, timestamp, IP) in security.md
- [ ] T091 [P] [M0] Design data encryption strategy (RDS at rest, TLS 1.3 in transit) in security.md
- [ ] T092 [M0] Design secrets management with AWS Secrets Manager (90-day rotation) in security.md

### D1.6: High-Priority Issue Resolution Design

- [ ] T093 [P] [M0] Design payment gateway race condition solution (idempotency, SELECT FOR UPDATE) in reliability-patterns.md
- [ ] T094 [P] [M0] Design WhatsApp session restoration workflow (7-day retention, SMS fallback) in reliability-patterns.md
- [ ] T095 [P] [M0] Design duplicate customer detection algorithm (National ID, loan status) in reliability-patterns.md
- [ ] T096 [P] [M0] Design grace period reduction logic (payment history tracking) in reliability-patterns.md
- [ ] T097 [P] [M0] Design Next of Kin SMS verification workflow (24hr window, 1 must verify) in reliability-patterns.md
- [ ] T098 [P] [M0] Design distributor deactivation workflow (Immediate vs Graceful) in reliability-patterns.md
- [ ] T099 [P] [M0] Design payment reconciliation failure handling (two-phase commit, 6hr background job) in reliability-patterns.md
- [ ] T100 [P] [M0] Design commission immutability rules (final on handover, no reversal) in reliability-patterns.md
- [ ] T101 [P] [M0] Design WhatsApp rate limiting (token bucket 70 msg/sec, priority queues) in reliability-patterns.md
- [ ] T102 [M0] Design ML model versioning (A/B testing 10%/90%, one-click rollback) in reliability-patterns.md

### D1.7: Observability & Monitoring Design

- [ ] T103 [P] [M0] Design Winston structured logging (JSON → CloudWatch) in observability.md
- [ ] T104 [P] [M0] Design custom CloudWatch metrics (approval rate, payment success, WhatsApp latency) in observability.md
- [ ] T105 [P] [M0] Design AWS X-Ray tracing (WhatsApp → KYC → Scoring → Fineract) in observability.md
- [ ] T106 [P] [M0] Design CloudWatch alarms (payment success <90%, Fineract error >5%, WhatsApp >3s p95) in observability.md
- [ ] T107 [P] [M0] Design additional alarms (Priority 1 queue >100, reconciliation failures >10, ML default >15%) in observability.md
- [ ] T108 [M0] Design correlation ID strategy for request tracing in observability.md

### D1.8: Developer Quickstart

- [ ] T109 [P] [M0] Document local development setup (Docker Compose for Fineract, PostgreSQL, Redis) in quickstart.md
- [ ] T110 [P] [M0] Create .env.example with all required environment variables in quickstart.md
- [ ] T111 [P] [M0] Document running backend services locally (npm run dev per service) in quickstart.md
- [ ] T112 [P] [M0] Document running Next.js frontends locally in quickstart.md
- [ ] T113 [P] [M0] Document running tests (npm test, contract tests, E2E) in quickstart.md
- [ ] T114 [P] [M0] Document AWS deployment (Terraform apply, ECS updates) in quickstart.md
- [ ] T115 [M0] Create troubleshooting guide (common errors, log locations) in quickstart.md

**Checkpoint**: Design phase complete - ready to begin implementation

---

## Phase 2: Foundation (Milestone 1 - Weeks 9-10)

**Purpose**: Core infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Project Structure & Setup

- [ ] T116 [M1] Create monorepo structure with services/, frontend/, shared/ directories
- [ ] T117 [P] [M1] Initialize whatsapp-service Node.js/TypeScript project with package.json
- [ ] T118 [P] [M1] Initialize kyc-service Node.js/TypeScript project with package.json
- [ ] T119 [P] [M1] Initialize scoring-service Python project with requirements.txt
- [ ] T120 [P] [M1] Initialize payment-service Node.js/TypeScript project with package.json
- [ ] T121 [P] [M1] Initialize notification-service Node.js/TypeScript project with package.json
- [ ] T122 [P] [M1] Initialize inventory-service Node.js/TypeScript project with package.json
- [ ] T123 [P] [M1] Initialize lock-service Node.js/TypeScript project with package.json
- [ ] T124 [P] [M1] Initialize admin-service Node.js/TypeScript project with package.json
- [ ] T125 [P] [M1] Initialize cs-service Node.js/TypeScript project with package.json
- [ ] T126 [P] [M1] Initialize admin-portal Next.js 14 project with App Router
- [ ] T127 [P] [M1] Initialize distributor-dashboard Next.js 14 project with App Router
- [ ] T128 [P] [M1] Configure ESLint, Prettier, TypeScript configs for all Node.js services
- [ ] T129 [M1] Create shared TypeScript types package in shared/types/

### Database & Infrastructure

- [ ] T130 [M1] Setup Supabase project and PostgreSQL database schema with migrations (Supabase client or Prisma)
- [ ] T131 [P] [M1] Create whatsapp_sessions table migration
- [ ] T132 [P] [M1] Create distributor_inventory table migration (IMEI, consignment fields)
- [ ] T133 [P] [M1] Create customer_tentative_selections table migration
- [ ] T134 [P] [M1] Create distributor_commissions table migration
- [ ] T135 [P] [M1] Create inventory_reconciliations table migration
- [ ] T136 [P] [M1] Create admin_users table migration
- [ ] T137 [P] [M1] Create support_tickets table migration
- [ ] T138 [P] [M1] Create kyc_cache table migration
- [ ] T139 [P] [M1] Create payment_reconciliations table migration
- [ ] T140 [P] [M1] Create payment_callbacks table migration
- [ ] T141 [P] [M1] Create next_of_kin table migration
- [ ] T142 [P] [M1] Create model_versions table migration
- [ ] T143 [P] [M1] Create lock_commands table migration
- [ ] T144 [M1] Run all migrations and verify schema matches data-model.md

### AWS SNS/SQS Event Bus Setup

- [ ] T145 [M1] Create AWS SNS topics: loan-events, payment-events, inventory-events, notification-events
- [ ] T146 [P] [M1] Create SQS queues for whatsapp-service subscriptions
- [ ] T147 [P] [M1] Create SQS queues for notification-service subscriptions
- [ ] T148 [P] [M1] Create SQS queues for inventory-service subscriptions
- [ ] T149 [P] [M1] Create SQS queues for admin-service subscriptions
- [ ] T150 [M1] Configure DLQs for all SQS queues (max retries: 3)
- [ ] T151 [M1] Create shared event publisher utility in shared/utils/event-publisher.ts

### Authentication & Authorization Framework

- [ ] T152 [M1] Implement JWT authentication middleware in shared/middleware/auth.ts
- [ ] T153 [M1] Implement RBAC middleware with role checks (Super Admin, Financial Ops, Risk/Compliance, CS) in shared/middleware/rbac.ts
- [ ] T154 [M1] Create API key validation middleware for service-to-service calls in shared/middleware/api-key.ts
- [ ] T155 [M1] Implement session management with 15min inactivity timeout in admin-service

### Error Handling & Logging Infrastructure

- [ ] T156 [M1] Setup Winston structured logging (JSON format) in shared/utils/logger.ts
- [ ] T157 [M1] Create error handler middleware with standard error responses in shared/middleware/error-handler.ts
- [ ] T158 [M1] Implement correlation ID middleware for request tracing in shared/middleware/correlation-id.ts
- [ ] T159 [M1] Configure CloudWatch Logs integration for all services

### Apache Fineract Integration Layer

- [ ] T160 [M1] Create Fineract REST API client in shared/clients/fineract-client.ts
- [ ] T161 [M1] Implement Fineract authentication (basic auth with API key)
- [ ] T162 [P] [M1] Implement Fineract client.create() method (POST /clients)
- [ ] T163 [P] [M1] Implement Fineract loan.create() method (POST /loans)
- [ ] T164 [P] [M1] Implement Fineract repayment.post() method (POST /loans/{id}/transactions)
- [ ] T165 [P] [M1] Implement Fineract loan.getSchedule() method (GET /loans/{id}/repaymentschedule)
- [ ] T166 [M1] Add Fineract client error handling with exponential backoff retry (FR-209)

### Testing Framework Setup

- [ ] T167 [M1] Setup Jest testing framework for all Node.js services
- [ ] T168 [M1] Setup pytest testing framework for scoring-service (Python)
- [ ] T169 [M1] Setup Supertest for integration tests
- [ ] T170 [M1] Setup Playwright for E2E tests (admin portal, distributor dashboard)
- [ ] T171 [M1] Create Supabase test database and seed scripts for local testing

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Customer Onboarding & KYC (Priority: P1) 🎯 MVP (Milestone 2 - Weeks 11-13)

**Goal**: Enable customers to receive greeting, accept terms, submit KYC, receive qualification decision

**Independent Test**: Send WhatsApp message → receive greeting → accept terms → submit KYC (Name, ID, Address, Phone, 2 Next of Kin) → receive "Qualified" or "Rejected" message

### Tests for User Story 1 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T172 [P] [US1] Contract test: POST /whatsapp/webhook returns 200 in services/whatsapp-service/tests/contract/webhook.test.ts
- [ ] T173 [P] [US1] Contract test: POST /kyc/verify returns 200 with verification result in services/kyc-service/tests/contract/verify.test.ts
- [ ] T174 [P] [US1] Contract test: POST /scoring/calculate returns 200 with score and loan tier in services/scoring-service/tests/contract/calculate.test.py
- [ ] T175 [P] [US1] Integration test: Full customer journey (greeting → KYC → qualification) in services/whatsapp-service/tests/integration/customer-onboarding.test.ts
- [ ] T176 [P] [US1] Integration test: Smile Identity KYC verification with mock API in services/kyc-service/tests/integration/smile-identity.test.ts
- [ ] T177 [P] [US1] Integration test: Hybrid scoring (Fineract + ML) with mock responses in services/scoring-service/tests/integration/hybrid-scoring.test.py

### Implementation for User Story 1

**WhatsApp Service - Conversation Flow (WhatsApp Cloud API)**

- [ ] T178 [P] [US1] Create WhatsAppSession model in services/whatsapp-service/src/models/session.ts
- [ ] T179 [P] [US1] Create Customer model in services/whatsapp-service/src/models/customer.ts
- [ ] T180 [US1] Implement WhatsApp Cloud API webhook handler POST /webhook with Meta verification (GET /webhook?hub.verify_token=...) in services/whatsapp-service/src/routes/webhook.ts
- [ ] T180a [US1] Create WhatsApp Cloud API client (Graph API v18.0) in services/whatsapp-service/src/clients/whatsapp-cloud-client.ts
- [ ] T180b [US1] Implement WhatsApp message sending: POST /v18.0/{phone-number-id}/messages with access token authentication
- [ ] T180c [US1] Implement conversation window tracking (24hr free session, message templates after) in services/whatsapp-service/src/services/conversation-window-tracker.ts
- [ ] T181 [US1] Implement conversation state machine (greeting → terms → kyc_name → kyc_id → kyc_address → kyc_phone → kyc_nok1 → kyc_nok2 → processing) in services/whatsapp-service/src/services/conversation-manager.ts
- [ ] T182 [US1] Implement greeting message handler with terms display (FR-001, FR-033a) in services/whatsapp-service/src/handlers/greeting.ts
- [ ] T183 [US1] Implement terms acceptance handler (keyword "Accept") in services/whatsapp-service/src/handlers/terms.ts
- [ ] T184 [US1] Implement KYC field collection handlers (Name, ID, Address, Phone) in services/whatsapp-service/src/handlers/kyc-collection.ts
- [ ] T185 [US1] Implement Next of Kin collection handler (2 contacts: Name, ID, Phone each) in services/whatsapp-service/src/handlers/nok-collection.ts
- [ ] T186 [US1] Add field validation (Zimbabwe ID format, phone number length) in services/whatsapp-service/src/validators/kyc-validator.ts
- [ ] T187 [US1] Implement "Retry KYC" option to clear previous submission (FR-026) in services/whatsapp-service/src/handlers/retry.ts
- [ ] T188 [US1] Implement session expiry handling (15min timeout, 7-day retention, restoration on return) (FR-211 to FR-214) in services/whatsapp-service/src/services/session-manager.ts
- [ ] T188a [US1] Implement WhatsApp Cloud API rate limiting (80 msg/sec, token bucket algorithm) per FR-033h

**KYC Service - Smile Identity Integration**

- [ ] T189 [P] [US1] Create KycCache model in services/kyc-service/src/models/kyc-cache.ts
- [ ] T190 [P] [US1] Create NextOfKin model in services/kyc-service/src/models/next-of-kin.ts
- [ ] T191 [US1] Implement Smile Identity API client in services/kyc-service/src/clients/smile-identity-client.ts
- [ ] T192 [US1] Implement POST /kyc/verify endpoint (Zimbabwe national ID validation) in services/kyc-service/src/routes/verify.ts
- [ ] T193 [US1] Implement liveness detection integration (selfie + ID document) (FR-005) in services/kyc-service/src/services/liveness-check.ts
- [ ] T194 [US1] Implement KYC caching to PostgreSQL (expires_at: 90 days) in services/kyc-service/src/services/kyc-cache.ts
- [ ] T195 [US1] Implement duplicate customer detection (National ID primary key, loan status checks) (FR-217 to FR-222) in services/kyc-service/src/services/duplicate-detector.ts
- [ ] T196 [US1] Add error handling for manual review required, ID not found in services/kyc-service/src/services/error-handler.ts

**Next of Kin SMS Verification (Africa's Talk)**

- [ ] T197 [US1] Implement POST /kyc/next-of-kin/verify endpoint in services/kyc-service/src/routes/nok-verify.ts
- [ ] T197a [US1] Create Africa's Talk SMS API client in services/kyc-service/src/clients/africastalking-client.ts
- [ ] T197b [US1] Implement Africa's Talk authentication (API key + username) and sender ID "LYNIA" (FR-052a to FR-052d)
- [ ] T198 [US1] Implement SMS verification workflow: send "Reply YES to confirm" via Africa's Talk (FR-228 to FR-229, FR-052c) in services/kyc-service/src/services/nok-verifier.ts
- [ ] T198a [US1] Implement Africa's Talk delivery callback handler for SMS status tracking (FR-052e)
- [ ] T198b [US1] Log SMS costs per message ($0.008 per SMS) for financial reconciliation (FR-052g)
- [ ] T199 [US1] Implement 24-hour verification window with status tracking (Pending/Verified/Failed) in services/kyc-service/src/services/nok-verification-tracker.ts
- [ ] T200 [US1] Implement loan approval requirement: at least 1 Next of Kin must verify (FR-231) in services/kyc-service/src/services/loan-approval-validator.ts
- [ ] T201 [US1] Implement retry workflow with exponential backoff (max 3 attempts, FR-052f), then escalate to CS (FR-232 to FR-233) in services/kyc-service/src/services/nok-retry-handler.ts

**Scoring Service - Hybrid Credit Scoring**

- [ ] T202 [P] [US1] Create ModelVersion model in services/scoring-service/src/models/model_version.py
- [ ] T203 [US1] Implement Fineract Scorecard API client in services/scoring-service/src/clients/fineract_scorecard_client.py
- [ ] T204 [US1] Implement POST /scoring/calculate endpoint in services/scoring-service/src/routes/calculate.py
- [ ] T205 [US1] Implement Fineract Scorecard baseline scoring (0-100) in services/scoring-service/src/services/fineract_scorer.py
- [ ] T206 [US1] Implement ML adjustment model (-20 to +20) for underbanked customers in services/scoring-service/src/services/ml_scorer.py
- [ ] T207 [US1] Implement hybrid scoring formula: Fineract + ML = final score (FR-078) in services/scoring-service/src/services/hybrid_scorer.py
- [ ] T208 [US1] Implement loan tier calculation: 60-70=$200, 71-85=$350, 86-100=$500 (FR-078) in services/scoring-service/src/services/tier_calculator.py
- [ ] T209 [US1] Implement cold start handling: Fineract only until 100+ loans in services/scoring-service/src/services/cold_start_handler.py
- [ ] T210 [US1] Implement grace period calculation based on payment history (FR-223 to FR-227) in services/scoring-service/src/services/grace_period_calculator.py

**Event Publishing**

- [ ] T211 [US1] Publish kyc.submitted event to SNS loan-events topic in services/kyc-service/src/services/event-publisher.ts
- [ ] T212 [US1] Publish customer.qualified event to SNS loan-events topic in services/scoring-service/src/services/event_publisher.py
- [ ] T213 [US1] Publish customer.rejected event to SNS loan-events topic in services/scoring-service/src/services/event_publisher.py

**Notification Service - Qualification Messages**

- [ ] T214 [US1] Subscribe to customer.qualified event from SQS in services/notification-service/src/subscribers/customer-qualified.ts
- [ ] T215 [US1] Subscribe to customer.rejected event from SQS in services/notification-service/src/subscribers/customer-rejected.ts
- [ ] T216 [US1] Implement WhatsApp notification: "Congratulations, you qualify! Max loan: $X" in services/notification-service/src/services/whatsapp-sender.ts
- [ ] T217 [US1] Implement WhatsApp notification: "Sorry, you do not qualify. Talk to CS?" (FR-024) in services/notification-service/src/services/rejection-handler.ts

**Checkpoint**: User Story 1 complete - customer can submit KYC and receive qualification decision

---

## Phase 4: User Story 2 - Asset Selection & Deposit Payment (Priority: P2) (Milestone 3-4 - Weeks 14-16)

**Goal**: Enable qualified customers to view phones, select device, make deposit payment, receive confirmation

**Independent Test**: Use pre-qualified customer → view phone catalog → select phone → receive EcoCash/Omari payment link → complete payment → receive confirmation

### Tests for User Story 2 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T218 [P] [US2] Contract test: GET /inventory/phones returns phone catalog in services/inventory-service/tests/contract/phones.test.ts
- [ ] T219 [P] [US2] Contract test: POST /payments/initiate returns payment link in services/payment-service/tests/contract/initiate.test.ts
- [ ] T220 [P] [US2] Contract test: POST /payments/callback processes payment callback in services/payment-service/tests/contract/callback.test.ts
- [ ] T221 [P] [US2] Integration test: Full payment flow (initiate → callback → confirmation) in services/payment-service/tests/integration/payment-flow.test.ts
- [ ] T222 [P] [US2] Integration test: Payment callback idempotency (duplicate detection) in services/payment-service/tests/integration/idempotency.test.ts

### Implementation for User Story 2

**Inventory Service - Phone Catalog**

- [ ] T223 [P] [US2] Create Inventory model (IMEI, ownership="Lynia Finance", consignment_location_id) in services/inventory-service/src/models/inventory.ts
- [ ] T224 [P] [US2] Create CustomerTentativeSelection model in services/inventory-service/src/models/tentative-selection.ts
- [ ] T225 [US2] Implement GET /inventory/phones endpoint (filter by nearest distributor) in services/inventory-service/src/routes/phones.ts
- [ ] T226 [US2] Implement phone catalog query: Model, Price, Monthly Repayment (8 months), Stock Count (FR-132) in services/inventory-service/src/services/catalog-service.ts
- [ ] T227 [US2] Implement real-time stock count display ("Limited Stock" if <5, "Out of Stock" if 0) (FR-134 to FR-135) in services/inventory-service/src/services/stock-indicator.ts
- [ ] T228 [US2] Implement tentative selection storage (no reservation, informational only) (FR-136 to FR-140) in services/inventory-service/src/services/selection-tracker.ts

**WhatsApp Service - Asset Selection Flow**

- [ ] T229 [US2] Implement phone catalog display handler in WhatsApp bot (numbered list) in services/whatsapp-service/src/handlers/phone-catalog.ts
- [ ] T230 [US2] Implement phone selection handler (numbered reply or keyword) in services/whatsapp-service/src/handlers/phone-selection.ts
- [ ] T231 [US2] Implement payment method selection handler (EcoCash or Omari) in services/whatsapp-service/src/handlers/payment-method.ts
- [ ] T232 [US2] Implement payment link display handler in services/whatsapp-service/src/handlers/payment-link.ts

**Payment Service - Gateway Integration**

- [ ] T233 [P] [US2] Create Payment model in services/payment-service/src/models/payment.ts
- [ ] T234 [P] [US2] Create PaymentCallback model (idempotency tracking) in services/payment-service/src/models/payment-callback.ts
- [ ] T235 [P] [US2] Implement EcoCash API client (USSD initiation) in services/payment-service/src/clients/ecocash-client.ts
- [ ] T236 [P] [US2] Implement Omari API client (REST endpoints) in services/payment-service/src/clients/omari-client.ts
- [ ] T237 [US2] Implement POST /payments/initiate endpoint in services/payment-service/src/routes/initiate.ts
- [ ] T238 [US2] Implement payment link/USSD code generation in services/payment-service/src/services/payment-initiator.ts
- [ ] T239 [US2] Implement POST /payments/callback webhook handler in services/payment-service/src/routes/callback.ts
- [ ] T240 [US2] Implement idempotency key check using transaction_id (FR-202 to FR-205) in services/payment-service/src/services/idempotency-checker.ts
- [ ] T241 [US2] Implement atomic payment processing (SELECT FOR UPDATE) (FR-204) in services/payment-service/src/services/payment-processor.ts
- [ ] T242 [US2] Implement duplicate callback detection (return 200 OK, log as duplicate) (FR-205) in services/payment-service/src/services/duplicate-handler.ts
- [ ] T243 [US2] Implement two-phase commit: Gateway_Confirmed → Fineract_Confirmed (FR-242 to FR-243) in services/payment-service/src/services/two-phase-commit.ts
- [ ] T244 [US2] Implement Fineract transaction posting with exponential backoff retry (FR-209 to FR-210) in services/payment-service/src/services/fineract-poster.ts
- [ ] T245 [US2] Implement payment reconciliation failure handling (5 retries → CS ticket) (FR-244 to FR-245) in services/payment-service/src/services/reconciliation-handler.ts

**WhatsApp Service - Payment Status Polling**

- [ ] T246 [US2] Implement payment status polling (5s intervals, 2min max) while customer waits (FR-206) in services/whatsapp-service/src/services/payment-poller.ts
- [ ] T247 [US2] Implement timeout message: "Payment processing, you'll receive confirmation via WhatsApp" (FR-207) in services/whatsapp-service/src/handlers/payment-timeout.ts

**Event Publishing**

- [ ] T248 [US2] Publish payment.received event to SNS payment-events topic in services/payment-service/src/services/event-publisher.ts
- [ ] T249 [US2] Publish payment.completed event (includes Fineract transaction_id) to SNS payment-events topic in services/payment-service/src/services/event-publisher.ts

**Notification Service - Payment Confirmation**

- [ ] T250 [US2] Subscribe to payment.completed event from SQS in services/notification-service/src/subscribers/payment-completed.ts
- [ ] T251 [US2] Implement WhatsApp notification: "Payment received ($X). Proceed to [Distributor] for collection" in services/notification-service/src/services/payment-confirmation.ts
- [ ] T252 [US2] Implement distributor notification: "Customer [Name] paid. Ready for collection" in services/notification-service/src/services/distributor-notification.ts

**Checkpoint**: User Story 2 complete - customer can select phone and make deposit payment

---

## Phase 5: User Story 3 - Asset Collection & Verification (Priority: P2) (Milestone 5-6 - Weeks 17-19)

**Goal**: Enable distributor to verify customer ID, confirm handover, trigger commission calculation

**Independent Test**: Distributor enters customer ID → system matches → distributor approves handover → customer receives "Your phone is now active" message → commission calculated

### Tests for User Story 3 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T253 [P] [US3] Contract test: POST /inventory/handover confirms handover in services/inventory-service/tests/contract/handover.test.ts
- [ ] T254 [P] [US3] Integration test: Full handover flow (ID verify → approve → commission trigger) in services/inventory-service/tests/integration/handover-flow.test.ts

### Implementation for User Story 3

**Inventory Service - Handover Workflow**

- [ ] T255 [P] [US3] Create DistributorCommission model in services/inventory-service/src/models/commission.ts
- [ ] T256 [US3] Implement POST /inventory/verify-customer endpoint (match National ID) in services/inventory-service/src/routes/verify-customer.ts
- [ ] T257 [US3] Implement GET /inventory/customer/:id/reservation endpoint (display reserved asset details) in services/inventory-service/src/routes/reservation.ts
- [ ] T258 [US3] Implement POST /inventory/handover endpoint (IMEI scan, status update) in services/inventory-service/src/routes/handover.ts
- [ ] T259 [US3] Implement handover verification: phone exists, status=Available, location=current distributor (FR-146 to FR-147) in services/inventory-service/src/services/handover-verifier.ts
- [ ] T260 [US3] Implement inventory status update: Available → HandedOver with timestamp, customer_id, staff_id (FR-148) in services/inventory-service/src/services/status-updater.ts
- [ ] T261 [US3] Implement stock count decrement (real-time) (FR-149) in services/inventory-service/src/services/stock-counter.ts
- [ ] T262 [US3] Implement commission calculation trigger (FR-150) in services/inventory-service/src/services/commission-trigger.ts

**Commission Calculation**

- [ ] T263 [US3] Implement commission calculation: Device Retail Price × Commission Rate (3-5%) (FR-152 to FR-153) in services/inventory-service/src/services/commission-calculator.ts
- [ ] T264 [US3] Create commission record with status=Pending (FR-155 to FR-156) in services/inventory-service/src/services/commission-creator.ts
- [ ] T265 [US3] Implement commission immutability: final on handover (FR-197 to FR-201) in services/inventory-service/src/services/commission-immutability.ts

**Event Publishing**

- [ ] T266 [US3] Publish inventory.handover event to SNS inventory-events topic in services/inventory-service/src/services/event-publisher.ts
- [ ] T267 [US3] Publish commission.calculated event to SNS inventory-events topic in services/inventory-service/src/services/event-publisher.ts

**Notification Service - Handover Confirmation**

- [ ] T268 [US3] Subscribe to inventory.handover event from SQS in services/notification-service/src/subscribers/inventory-handover.ts
- [ ] T269 [US3] Implement WhatsApp notification to customer: "Your phone is now active. IMEI: [XXXX]. Warranty: 6 months" (FR-151) in services/notification-service/src/services/handover-confirmation.ts

**Apache Fineract - Loan Activation**

- [ ] T270 [US3] Subscribe to inventory.handover event from SQS in services/payment-service/src/subscribers/inventory-handover.ts
- [ ] T271 [US3] Create Fineract loan account upon handover (loan amount = 80% of phone price) in services/payment-service/src/services/loan-activator.ts
- [ ] T272 [US3] Link Fineract loan to customer and asset in services/payment-service/src/services/loan-linker.ts

**Checkpoint**: User Story 3 complete - customer can collect phone, commission calculated

---

## Phase 6: User Story 4 - Repayment Management & Balance Checking (Priority: P3) (Milestone 7 - Weeks 20-21)

**Goal**: Enable customers to check balance, make repayments, receive reminders

**Independent Test**: Customer with active loan sends "Check Balance" → receives balance/due date → initiates repayment → receives confirmation → verify reminders sent 3 days and 1 day before due date

### Tests for User Story 4 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T273 [P] [US4] Contract test: GET /loans/{id}/balance returns balance and due date in services/payment-service/tests/contract/balance.test.ts
- [ ] T274 [P] [US4] Integration test: Repayment flow (initiate → payment → Fineract posting) in services/payment-service/tests/integration/repayment.test.ts
- [ ] T275 [P] [US4] Integration test: Payment reminders (3-day, 1-day, scheduled correctly) in services/notification-service/tests/integration/reminders.test.ts

### Implementation for User Story 4

**WhatsApp Service - Balance & Repayment**

- [ ] T276 [US4] Implement "Check Balance" command handler in services/whatsapp-service/src/handlers/check-balance.ts
- [ ] T277 [US4] Implement balance display: outstanding balance, next due date, payment history in services/whatsapp-service/src/handlers/balance-display.ts
- [ ] T278 [US4] Implement repayment initiation handler in services/whatsapp-service/src/handlers/repayment-initiate.ts

**Payment Service - Repayment Processing**

- [ ] T279 [US4] Implement GET /loans/:id/balance endpoint (query Fineract) in services/payment-service/src/routes/balance.ts
- [ ] T280 [US4] Implement POST /repayments/initiate endpoint in services/payment-service/src/routes/repayments.ts
- [ ] T281 [US4] Implement repayment callback processing (same idempotency as deposit) in services/payment-service/src/services/repayment-processor.ts
- [ ] T282 [US4] Post repayment to Fineract with exponential backoff retry in services/payment-service/src/services/repayment-poster.ts

**Notification Service - Payment Reminders**

- [ ] T283 [US4] Implement daily cron job (runs 8 AM) to check upcoming due dates in services/notification-service/src/jobs/daily-reminder-check.ts
- [ ] T284 [US4] Implement 3-day reminder: "Payment of $X due in 3 days. Pay now: [LINK]" (FR-036) in services/notification-service/src/services/reminder-3day.ts
- [ ] T285 [US4] Implement 1-day reminder: "Payment of $X due tomorrow. Pay now: [LINK]" (FR-037) in services/notification-service/src/services/reminder-1day.ts
- [ ] T286 [US4] Implement reminder logging and duplicate prevention in services/notification-service/src/services/reminder-logger.ts

**Event Publishing**

- [ ] T287 [US4] Publish repayment.completed event to SNS payment-events topic in services/payment-service/src/services/event-publisher.ts

**Checkpoint**: User Story 4 complete - customers can manage repayments

---

## Phase 7: User Story 5 - Payment Extensions & Default Management (Priority: P4) (Milestone 8 - Weeks 22-23)

**Goal**: Enable customers to request extensions, receive warnings, trigger device lock

**Independent Test**: Customer requests extension → logged for review → receives approval/denial → misses payment → receives final warning → device locks after grace period

### Tests for User Story 5 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T288 [P] [US5] Contract test: POST /cs/extension-request creates ticket in services/cs-service/tests/contract/extension.test.ts
- [ ] T289 [P] [US5] Integration test: Extension workflow (request → review → approval/denial) in services/cs-service/tests/integration/extension-flow.test.ts
- [ ] T290 [P] [US5] Integration test: Device lock flow (15 days overdue → warning → lock) in services/lock-service/tests/integration/lock-flow.test.ts

### Implementation for User Story 5

**WhatsApp Service - Extension Request**

- [ ] T291 [US5] Implement "Request Extension" option handler in services/whatsapp-service/src/handlers/extension-request.ts
- [ ] T292 [US5] Implement extension request form collection in services/whatsapp-service/src/handlers/extension-form.ts

**CS Service - Extension Management**

- [ ] T293 [P] [US5] Create SupportTicket model in services/cs-service/src/models/support-ticket.ts
- [ ] T294 [US5] Implement POST /cs/extension-request endpoint in services/cs-service/src/routes/extension.ts
- [ ] T295 [US5] Implement extension approval logic (payment history + risk score) (FR-070) in services/cs-service/src/services/extension-approver.ts
- [ ] T296 [US5] Implement ticket assignment (round-robin with priority) in services/cs-service/src/services/ticket-assigner.ts

**Notification Service - Extension Response**

- [ ] T297 [US5] Implement extension approval notification: "Extension approved. New due date: [DATE]" in services/notification-service/src/services/extension-approved.ts
- [ ] T298 [US5] Implement extension denial notification: "Extension denied. Payment due: [DATE]" in services/notification-service/src/services/extension-denied.ts

**Lock Service - Default Management**

- [ ] T299 [P] [US5] Create LockCommand model in services/lock-service/src/models/lock-command.ts
- [ ] T300 [US5] Implement third-party lock provider API client in services/lock-service/src/clients/lock-provider-client.ts
- [ ] T301 [US5] Subscribe to repayment.overdue event from SQS in services/lock-service/src/subscribers/repayment-overdue.ts
- [ ] T302 [US5] Implement grace period check (days_overdue >= grace_period_days) (FR-226) in services/lock-service/src/services/grace-period-checker.ts
- [ ] T303 [US5] Implement final warning at grace_period - 2 days: "Pay within 2 days or device will be locked" (FR-057) in services/lock-service/src/services/final-warning.ts
- [ ] T304 [US5] Implement device lock trigger POST /lock/{deviceId} in services/lock-service/src/routes/lock.ts
- [ ] T305 [US5] Implement device unlock POST /unlock/{deviceId} (after payment received) (FR-062) in services/lock-service/src/routes/unlock.ts
- [ ] T306 [US5] Implement lock provider webhook handler (status updates) in services/lock-service/src/routes/webhook.ts

**Event Publishing**

- [ ] T307 [US5] Publish device.lock_triggered event to SNS notification-events topic in services/lock-service/src/services/event-publisher.ts
- [ ] T308 [US5] Publish device.unlocked event to SNS notification-events topic in services/lock-service/src/services/event-publisher.ts

**Checkpoint**: User Story 5 complete - extension requests and device lock management working

---

## Phase 8: User Story 6 - Customer Service Escalation (Priority: P4) (Milestone 9 - Weeks 22-23)

**Goal**: Enable customers to talk to CS, ticket creation and tracking

**Independent Test**: Rejected customer selects "Talk to CS" → routed to agent/ticket → conversation logged with reference number

### Tests for User Story 6 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T309 [P] [US6] Contract test: POST /cs/tickets creates ticket in services/cs-service/tests/contract/tickets.test.ts
- [ ] T310 [P] [US6] Integration test: CS escalation flow (rejected → talk to CS → ticket created) in services/cs-service/tests/integration/escalation.test.ts

### Implementation for User Story 6

**WhatsApp Service - CS Escalation**

- [ ] T311 [US6] Implement "Talk to Customer Service" option handler in services/whatsapp-service/src/handlers/cs-escalation.ts
- [ ] T312 [US6] Implement ticket creation with unique reference number in services/whatsapp-service/src/services/ticket-creator.ts

**CS Service - Ticket Management**

- [ ] T313 [US6] Implement POST /cs/tickets endpoint in services/cs-service/src/routes/tickets.ts
- [ ] T314 [US6] Implement GET /cs/tickets/:id endpoint (retrieve ticket details) in services/cs-service/src/routes/tickets.ts
- [ ] T315 [US6] Implement ticket logging with customer_id, issue_type, status in services/cs-service/src/services/ticket-logger.ts
- [ ] T316 [US6] Implement escalation routing logic in services/cs-service/src/services/escalation-router.ts

**Checkpoint**: User Story 6 complete - CS escalation working

---

## Phase 9: User Story 7 - Agent Inventory & Handover Management (Priority: P3) (Milestone 10 - Weeks 24-26)

**Goal**: Enable distributor agents to verify customers, track inventory, view commissions

**Independent Test**: Agent logs in → verifies customer ID → approves handover → views real-time inventory → accesses commission tracking

### Tests for User Story 7 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T317 [P] [US7] E2E test: Agent login → customer verification → handover approval in frontend/distributor-dashboard/tests/e2e/handover.spec.ts
- [ ] T318 [P] [US7] E2E test: Agent views inventory dashboard with real-time updates in frontend/distributor-dashboard/tests/e2e/inventory.spec.ts
- [ ] T319 [P] [US7] E2E test: Agent views commission history in frontend/distributor-dashboard/tests/e2e/commissions.spec.ts

### Implementation for User Story 7

**Distributor Dashboard - Frontend**

- [ ] T320 [P] [US7] Create login page in frontend/distributor-dashboard/src/app/login/page.tsx
- [ ] T321 [P] [US7] Create dashboard layout with navigation in frontend/distributor-dashboard/src/app/dashboard/layout.tsx
- [ ] T322 [P] [US7] Create customer verification page in frontend/distributor-dashboard/src/app/dashboard/verify/page.tsx
- [ ] T323 [P] [US7] Create handover approval page in frontend/distributor-dashboard/src/app/dashboard/handover/page.tsx
- [ ] T324 [P] [US7] Create inventory dashboard page with WebSocket sync in frontend/distributor-dashboard/src/app/dashboard/inventory/page.tsx
- [ ] T325 [P] [US7] Create commission tracking page (last 6 months, pending/paid) in frontend/distributor-dashboard/src/app/dashboard/commissions/page.tsx
- [ ] T326 [US7] Implement WebSocket client for real-time inventory updates (<1s latency) in frontend/distributor-dashboard/src/lib/websocket-client.ts
- [ ] T327 [US7] Implement commission PDF download in frontend/distributor-dashboard/src/lib/commission-pdf.ts

**Inventory Service - WebSocket Server**

- [ ] T328 [US7] Implement WebSocket server for inventory events in services/inventory-service/src/websocket/server.ts
- [ ] T329 [US7] Broadcast inventory updates on handover, stock transfer (<1s) in services/inventory-service/src/websocket/broadcaster.ts

**Admin Service - Commission APIs**

- [ ] T330 [P] [US7] Implement GET /commissions/distributor/:id endpoint (last 6 months) in services/admin-service/src/routes/commissions.ts
- [ ] T331 [P] [US7] Implement GET /commissions/:id/statement endpoint (PDF generation) in services/admin-service/src/routes/statements.ts

**Checkpoint**: User Story 7 complete - agent dashboard functional

---

## Phase 10: User Story 8 - Agent Handover History & Inventory Alerts (Priority: P4) (Milestone 10 - Weeks 24-26)

**Goal**: Enable agents to view handover history, receive low inventory alerts

**Independent Test**: Agent searches handover logs → views history → exports data → receives alert when stock <5 → submits restock request

### Tests for User Story 8 (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T332 [P] [US8] E2E test: Agent searches handover history and exports in frontend/distributor-dashboard/tests/e2e/history.spec.ts
- [ ] T333 [P] [US8] Integration test: Low inventory alert triggers at threshold in services/inventory-service/tests/integration/alerts.test.ts

### Implementation for User Story 8

**Distributor Dashboard - History & Alerts**

- [ ] T334 [P] [US8] Create handover history page with search in frontend/distributor-dashboard/src/app/dashboard/history/page.tsx
- [ ] T335 [P] [US8] Implement handover log export (CSV) in frontend/distributor-dashboard/src/lib/export-csv.ts
- [ ] T336 [P] [US8] Create alerts page (low inventory notifications) in frontend/distributor-dashboard/src/app/dashboard/alerts/page.tsx
- [ ] T337 [P] [US8] Create restock request form in frontend/distributor-dashboard/src/app/dashboard/restock/page.tsx

**Inventory Service - Alerts & History**

- [ ] T338 [US8] Implement GET /inventory/handovers endpoint (search by customer_id, date range) in services/inventory-service/src/routes/handovers.ts
- [ ] T339 [US8] Implement low stock alert cron job (daily 9 AM, check <5 units) in services/inventory-service/src/jobs/low-stock-check.ts
- [ ] T340 [US8] Implement CloudWatch alarm for low inventory (<5 units per distributor) in services/inventory-service/src/monitoring/alarms.ts
- [ ] T341 [US8] Implement POST /inventory/restock-request endpoint in services/inventory-service/src/routes/restock.ts

**Checkpoint**: User Story 8 complete - all agent features functional

---

## Phase 11: Admin Portal & Commission Management (Milestone 11-12 - Weeks 27-30)

**Purpose**: Admin dashboard, RBAC, commission batch processing, reconciliation management

### Tests (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T342 [P] [M11] E2E test: Admin login with RBAC role enforcement in frontend/admin-portal/tests/e2e/auth.spec.ts
- [ ] T343 [P] [M11] E2E test: Weekly commission batch approval workflow in frontend/admin-portal/tests/e2e/commissions.spec.ts
- [ ] T344 [P] [M11] E2E test: Payment reconciliation manual resolution in frontend/admin-portal/tests/e2e/reconciliation.spec.ts
- [ ] T345 [P] [M11] E2E test: Distributor deactivation workflow in frontend/admin-portal/tests/e2e/deactivation.spec.ts

### Implementation

**Admin Portal - Frontend**

- [ ] T346 [P] [M11] Create login page with RBAC in frontend/admin-portal/src/app/login/page.tsx
- [ ] T347 [P] [M11] Create dashboard layout with role-based navigation in frontend/admin-portal/src/app/dashboard/layout.tsx
- [ ] T348 [P] [M11] Create system monitoring page (KPIs, metrics) in frontend/admin-portal/src/app/dashboard/monitoring/page.tsx
- [ ] T349 [P] [M11] Create financial reporting page in frontend/admin-portal/src/app/dashboard/reports/page.tsx
- [ ] T350 [P] [M11] Create commission management page (weekly batch approval) in frontend/admin-portal/src/app/dashboard/commissions/page.tsx
- [ ] T351 [P] [M11] Create payment reconciliation page (unreconciled >24hrs) in frontend/admin-portal/src/app/dashboard/reconciliation/page.tsx
- [ ] T352 [P] [M11] Create inventory reconciliation review page in frontend/admin-portal/src/app/dashboard/inventory-reconciliation/page.tsx
- [ ] T353 [P] [M11] Create distributor management page (deactivation workflow) in frontend/admin-portal/src/app/dashboard/distributors/page.tsx
- [ ] T354 [P] [M11] Create compliance reports page (RBZ FIU, 7-year retention) in frontend/admin-portal/src/app/dashboard/compliance/page.tsx
- [ ] T355 [P] [M11] Create ML model management page (A/B testing, rollback) in frontend/admin-portal/src/app/dashboard/ml-models/page.tsx

**Admin Service - Core APIs**

- [ ] T356 [P] [M11] Create AdminUser model in services/admin-service/src/models/admin-user.ts
- [ ] T357 [P] [M11] Implement POST /admin/login endpoint with RBAC in services/admin-service/src/routes/auth.ts
- [ ] T358 [P] [M11] Implement GET /admin/monitoring/kpis endpoint in services/admin-service/src/routes/monitoring.ts
- [ ] T359 [P] [M11] Implement GET /admin/reports/financial endpoint in services/admin-service/src/routes/reports.ts
- [ ] T360 [P] [M11] Implement GET /admin/compliance/rbz-fiu endpoint in services/admin-service/src/routes/compliance.ts

**Admin Service - Commission Management**

- [ ] T361 [M11] Implement weekly commission batch cron job (Monday 9 AM) in services/admin-service/src/jobs/weekly-commission-batch.ts
- [ ] T362 [M11] Implement commission aggregation (all Pending from Monday-Sunday, group by distributor_id) in services/admin-service/src/services/commission-aggregator.ts
- [ ] T363 [M11] Implement commission statement generation (PDF) in services/admin-service/src/services/statement-generator.ts
- [ ] T364 [M11] Implement GET /admin/commissions/pending endpoint in services/admin-service/src/routes/commissions.ts
- [ ] T365 [M11] Implement POST /admin/commissions/approve endpoint (approve all/selected) in services/admin-service/src/routes/commissions.ts
- [ ] T366 [M11] Implement commission payment processing (EcoCash/bank transfer with retry) (FR-165, FR-169) in services/admin-service/src/services/commission-payer.ts
- [ ] T367 [M11] Implement POST /admin/commissions/:id/adjust endpoint (manual adjustment with audit) (FR-176 to FR-177) in services/admin-service/src/routes/commissions.ts

**Admin Service - Reconciliation Management**

- [ ] T368 [M11] Implement background reconciliation job (runs every 6 hours) (FR-247) in services/admin-service/src/jobs/payment-reconciliation.ts
- [ ] T369 [M11] Implement GET /admin/reconciliation/unresolved endpoint (>24hrs old) in services/admin-service/src/routes/reconciliation.ts
- [ ] T370 [M11] Implement POST /admin/reconciliation/:id/resolve endpoint (one-click manual reconciliation) (FR-248) in services/admin-service/src/routes/reconciliation.ts
- [ ] T371 [M11] Implement inventory reconciliation review GET /admin/inventory-reconciliation endpoint in services/admin-service/src/routes/inventory-reconciliation.ts
- [ ] T372 [M11] Implement shrinkage charge approval POST /admin/shrinkage/:id/approve (FR-192) in services/admin-service/src/routes/shrinkage.ts

**Admin Service - Distributor Management**

- [ ] T373 [M11] Implement POST /admin/distributors/:id/deactivate endpoint (Immediate vs Graceful) (FR-235 to FR-238) in services/admin-service/src/routes/distributors.ts
- [ ] T374 [M11] Implement distributor pre-deactivation checks (active loans, pending commissions, inventory) (FR-236) in services/admin-service/src/services/deactivation-checker.ts
- [ ] T375 [M11] Implement loan reassignment to nearest distributor (FR-240) in services/admin-service/src/services/loan-reassigner.ts
- [ ] T376 [M11] Implement 7-year data archival (FR-241) in services/admin-service/src/services/data-archiver.ts

**Checkpoint**: Admin portal complete - commission management, reconciliation, distributor management working

---

## Phase 12: ML Model Management & A/B Testing (Milestone 12 - Weeks 31-32)

**Purpose**: ML model versioning, A/B testing, rollback capabilities

### Tests (TDD - Write FIRST, Ensure FAIL) ⚠️

- [ ] T377 [P] [M12] Integration test: A/B testing (10% new model, 90% current) in services/scoring-service/tests/integration/ab-testing.test.py
- [ ] T378 [P] [M12] Integration test: Model rollback (mark as Retired, promote previous) in services/scoring-service/tests/integration/rollback.test.py

### Implementation

**Scoring Service - Model Management**

- [ ] T379 [M12] Implement model registry with S3 storage in services/scoring-service/src/services/model_registry.py
- [ ] T380 [M12] Implement POST /ml/models/upload endpoint (upload to S3, create metadata) (FR-256) in services/scoring-service/src/routes/models.py
- [ ] T381 [M12] Implement A/B testing logic (10% traffic to Draft model, 90% to Active) (FR-258) in services/scoring-service/src/services/ab_tester.py
- [ ] T382 [M12] Implement model monitoring (approval rate, default rate) (FR-259) in services/scoring-service/src/services/model_monitor.py
- [ ] T383 [M12] Implement POST /ml/models/:id/promote endpoint (Draft → Active, 100% traffic) (FR-260) in services/scoring-service/src/routes/models.py
- [ ] T384 [M12] Implement POST /ml/models/rollback endpoint (mark Active as Retired, promote previous Active) (FR-262) in services/scoring-service/src/routes/models.py
- [ ] T385 [M12] Implement prediction logging (customer_id, model_version, features, prediction) (FR-263) in services/scoring-service/src/services/prediction_logger.py

**Admin Portal - ML Management UI**

- [ ] T386 [P] [M12] Implement model upload UI in frontend/admin-portal/src/app/dashboard/ml-models/upload/page.tsx
- [ ] T387 [P] [M12] Implement A/B testing dashboard (traffic split, metrics) in frontend/admin-portal/src/app/dashboard/ml-models/ab-testing/page.tsx
- [ ] T388 [P] [M12] Implement one-click rollback button in frontend/admin-portal/src/app/dashboard/ml-models/rollback/page.tsx

**Checkpoint**: ML model management complete - A/B testing and rollback working

---

## Phase 13: Polish & Cross-Cutting Concerns (Weeks 33-36)

**Purpose**: Final improvements, documentation, security hardening, deployment

### Security & Compliance

- [ ] T389 [P] [M12] Implement secrets rotation (AWS Secrets Manager, 90-day rotation) in infrastructure/secrets-rotation.ts
- [ ] T390 [P] [M12] Implement audit logging for all admin actions in services/admin-service/src/middleware/audit-logger.ts
- [ ] T391 [P] [M12] Run security audit (penetration testing, vulnerability scanning) - document results
- [ ] T392 [P] [M12] Implement rate limiting (per-user, per-IP) in shared/middleware/rate-limiter.ts

### Monitoring & Observability

- [ ] T393 [P] [M12] Configure all CloudWatch alarms per observability.md
- [ ] T394 [P] [M12] Setup AWS X-Ray tracing for critical flows
- [ ] T395 [P] [M12] Create CloudWatch dashboard (KPIs, error rates, latency) in infrastructure/monitoring/dashboard.json
- [ ] T396 [P] [M12] Implement WhatsApp rate limiting dashboard (FR-255) in frontend/admin-portal/src/app/dashboard/monitoring/whatsapp.tsx

### Infrastructure & Deployment - YC Bootstrap (AWS Free Tier + Supabase)

**AWS Lambda Deployment (Always FREE: 1M requests/month)**

- [ ] T397 [M12] Create AWS SAM template (template.yaml) for all 5 Lambda functions (whatsapp, kyc, payment, lock, scoring)
- [ ] T397a [P] [M12] Configure Lambda function: whatsapp-service (Node.js 18, 256MB RAM, 30s timeout)
- [ ] T397b [P] [M12] Configure Lambda function: kyc-service (Node.js 18, 512MB RAM, 60s timeout for Smile Identity)
- [ ] T397c [P] [M12] Configure Lambda function: payment-service (Node.js 18, 256MB RAM, 30s timeout)
- [ ] T397d [P] [M12] Configure Lambda function: lock-service (Node.js 18, 128MB RAM, 15s timeout)
- [ ] T397e [P] [M12] Configure Lambda function: scoring-service (Python 3.11, 1GB RAM, 120s timeout for ML inference)
- [ ] T397f [M12] Setup API Gateway HTTP API (FREE 1M requests for 12 months, then $1/million)
- [ ] T397g [P] [M12] Configure Lambda environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY, WHATSAPP_ACCESS_TOKEN, etc.)
- [ ] T397h [M12] Setup Lambda VPC configuration for Supabase PostgreSQL access (if private)
- [ ] T397i [M12] Configure Lambda concurrency limits (reserve 10 concurrent executions per service)

**AWS EC2 Free Tier - Apache Fineract Deployment**

- [ ] T398 [M12] Launch EC2 t3.micro instance (Ubuntu 22.04 LTS, 750 hrs/month FREE for 12 months)
- [ ] T398a [M12] Install Docker and Docker Compose on EC2 instance
- [ ] T398b [M12] Create Docker Compose file for Fineract (connect to Supabase PostgreSQL)
- [ ] T398c [M12] Configure Fineract environment variables (FINERACT_HIKARI_JDBC_URL, FINERACT_HIKARI_USERNAME, FINERACT_HIKARI_PASSWORD)
- [ ] T398d [M12] Setup EC2 security groups (allow HTTPS 8443, HTTP 8080 from Lambda, admin portal)
- [ ] T398e [M12] Configure Elastic IP for EC2 instance (persistent IP address)
- [ ] T398f [M12] Setup CloudWatch agent on EC2 for monitoring (5GB logs/month FREE)
- [ ] T398g [M12] Create EC2 AMI snapshot for disaster recovery
- [ ] T398h [M12] Document post-12-month migration: Reserved Instance ($8/month) or AWS Lightsail ($5/month)

**Local Development Environment**

- [ ] T399 [P] [M12] Create Docker Compose for local development (Fineract, Supabase local, LocalStack for Lambda testing)
- [ ] T399a [P] [M12] Setup LocalStack for local Lambda testing (FREE for basic features)
- [ ] T399b [P] [M12] Create .env.local with local development credentials

**CI/CD Pipeline (GitHub Actions)**

- [ ] T400 [P] [M12] Create GitHub Actions workflow: build and test (runs on every PR)
- [ ] T400a [P] [M12] Create GitHub Actions workflow: deploy Lambda functions (sam build && sam deploy)
- [ ] T400b [P] [M12] Create GitHub Actions workflow: deploy EC2 Fineract (SSH + docker-compose pull && up -d)
- [ ] T400c [P] [M12] Create GitHub Actions workflow: deploy Supabase Edge Functions (supabase functions deploy)
- [ ] T400d [M12] Setup GitHub Secrets for AWS credentials, Supabase keys, WhatsApp tokens

**Database & Monitoring**

- [ ] T401 [M12] Configure Supabase automated backups (FREE tier: daily backups, 7-day retention)
- [ ] T401a [M12] Setup 7-year data archival strategy (export old data to S3 Glacier after RBZ compliance period)
- [ ] T401b [M12] Configure Supabase database size monitoring (alert at 400MB = 80% of 500MB FREE limit)
- [ ] T402 [M12] Create runbooks (incident response, Lambda rollback, EC2 recovery, Supabase restore) in docs/runbooks/

### Testing & Quality

- [ ] T403 [M12] Run full E2E integration test suite (all 8 user stories)
- [ ] T404 [M12] Load testing (200-500 daily WhatsApp conversations, 100 active loans, 50 concurrent distributors)
- [ ] T405 [P] [M12] Run contract tests for all 10 services
- [ ] T406 [M12] Code coverage report (target: >80% for critical paths)

### Documentation

- [ ] T407 [P] [M12] Validate quickstart.md (new developer setup <10 minutes)
- [ ] T408 [P] [M12] Create API documentation (Swagger UI for all services)
- [ ] T409 [P] [M12] Create troubleshooting guide (common errors, log locations)
- [ ] T410 [P] [M12] Create architecture diagram (services, data flow, event flow)

**Checkpoint**: Platform production-ready - all user stories complete, tested, documented, deployed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Research)**: No dependencies - start immediately (Weeks 1-3)
- **Phase 1 (Design)**: Depends on Phase 0 completion (Weeks 4-8)
- **Phase 2 (Foundation)**: Depends on Phase 1 completion - BLOCKS all user stories (Weeks 9-10)
- **Phase 3-8 (User Stories)**: All depend on Phase 2 (Foundation) completion
  - Can proceed in parallel if staffed
  - Or sequentially in priority order: P1 → P2 → P3 → P4
- **Phase 9-12 (Admin/ML)**: Can start after Phase 2, parallel with user stories
- **Phase 13 (Polish)**: Depends on all desired user stories + admin portal complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundation - No dependencies on other stories
- **US2 (P2)**: Can start after Foundation - Requires US1 inventory service but independently testable
- **US3 (P2)**: Can start after Foundation - Requires US2 payment service but independently testable
- **US4 (P3)**: Requires US3 (loan must exist) but independently testable
- **US5 (P4)**: Requires US4 (repayment overdue) but independently testable
- **US6 (P4)**: Can start after Foundation - No dependencies (CS escalation)
- **US7 (P3)**: Requires US3 (handover flow) but independently testable
- **US8 (P4)**: Requires US7 (handover history) but independently testable

### Parallel Opportunities

- **Research phase**: All R0.1-R0.7 can run in parallel (different vendors)
- **Design phase**: All D1.1-D1.8 design docs can be created in parallel
- **Foundation phase**: Database migrations, event bus setup, authentication can run in parallel
- **User story tests**: All tests for a story marked [P] can run in parallel
- **User story models**: All models within a story marked [P] can run in parallel
- **User stories**: After Foundation, different stories can be worked on in parallel by different team members

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 0: Research (Weeks 1-3)
2. Complete Phase 1: Design (Weeks 4-8)
3. Complete Phase 2: Foundation (Weeks 9-10) - CRITICAL
4. Complete Phase 3: User Story 1 (Weeks 11-13) - P1
5. Complete Phase 4: User Story 2 (Weeks 14-16) - P2
6. Complete Phase 5: User Story 3 (Weeks 17-19) - P2
7. **STOP and VALIDATE**: Test full customer journey (onboarding → payment → collection)
8. Deploy MVP to production

### Incremental Delivery (Add Features Post-MVP)

1. Foundation + US1-3 deployed (MVP) → Working system
2. Add US4 (Repayment Management) → Deploy
3. Add US5 (Extensions & Lock) → Deploy
4. Add US7-8 (Agent Features) → Deploy
5. Add US6 (CS Escalation) → Deploy
6. Add Admin Portal (Phases 11-12) → Deploy
7. Each addition tested independently before deployment

### Parallel Team Strategy

With 3 developers:

1. Team completes Research + Design together (Weeks 1-8)
2. Team completes Foundation together (Weeks 9-10)
3. Once Foundation done (Week 11):
   - Developer A: User Story 1 (P1)
   - Developer B: User Story 2 (P2)
   - Developer C: Foundation services (Notification, Event handling)
4. Stories complete and integrate independently

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** maps task to user story for traceability
- **[Milestone]** maps to plan.md milestones for project management
- Each user story independently completable and testable
- **TDD MANDATORY**: Tests written FIRST, ensure they FAIL before implementation
- Verify tests pass after each task or logical group
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution requires Test-Driven Development (non-negotiable)

**Total Tasks**: 410 tasks covering full platform implementation
