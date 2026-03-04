# Implementation Plan: Lynia Lending Platform

**Branch**: `lynia-lending` | **Date**: 2025-10-29 | **Spec**: [spec.md](./spec.md)

## Summary

The Lynia Finance platform is an asset-backed lending system targeting Zimbabwe's underbanked informal sector. The implementation centers on **Apache Fineract** as the core loan management and payment orchestration engine, extended through API integrations for KYC verification, ML-based credit scoring, and operational services.

**Architecture approach**: **Supabase-first platform** with Apache Fineract as the core loan management engine. Supabase provides PostgreSQL database (Fineract + operational data), built-in authentication & RBAC, real-time subscriptions, edge functions for serverless background jobs, and file storage. Only 5 custom microservices handle complex integrations (WhatsApp, KYC, ML scoring, payments, device lock). Next.js frontends leverage Supabase Auth and Realtime for instant updates.

**Key integration points**:
- **Supabase PostgreSQL**: Unified database for Fineract (loan accounts, transactions) + operational data (sessions, inventory, commissions, reconciliations)
- **Supabase Auth**: Admin/distributor authentication with Row Level Security (RLS) for RBAC enforcement
- **Supabase Realtime**: Live inventory updates, commission dashboards, payment status (replaces custom WebSocket server)
- **Supabase Edge Functions**: Serverless TypeScript/Deno functions for cron jobs (weekly commissions, daily reminders, reconciliation, alerts)
- **Supabase Storage**: Commission PDFs, KYC documents, reconciliation photos with automatic optimization
- Fineract REST API for loan origination, repayment processing, account management
- Apache Fineract Scorecard API for baseline credit scoring
- In-house ML models for advanced risk assessment (behavioral scoring, payment prediction)
- DIDIT API for KYC/ID verification (Zimbabwe national ID validation)
- EcoCash + Omari payment gateway SDKs with circuit breaker pattern
- WhatsApp Cloud API (Meta) for WhatsApp messaging (FREE 1000 conversations/month, replacing Twilio $75/month)
- Africa's Talk SMS API for Zimbabwe SMS delivery ($0.008/SMS, 6x cheaper than Twilio $0.05/SMS)

**Primary technical challenge**: Orchestrating stateful WhatsApp conversations (24hr expiry, menu navigation, multi-step KYC) while maintaining transactional consistency across Fineract loan operations, payment gateway callbacks, and inventory management.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 18+ for services, Deno for Edge Functions), Python 3.10+ (ML models only)
**Primary Dependencies** (YC Bootstrap Cost-Optimized):
- **Supabase Platform FREE Tier**: PostgreSQL 15+ (500MB), Auth (JWT + RLS), Realtime (WebSocket subscriptions), Edge Functions (Deno runtime, 500K invocations/month), Storage (1GB)
- Apache Fineract 1.12.x (PostgreSQL mode on AWS EC2 t3.micro free tier, REST API client, Scorecard API)
- scikit-learn compiled to WASM with Pyodide (ML models on Cloudflare Workers free tier)
- WhatsApp Cloud API SDK (Meta, 1000 conversations/month FREE)
- Africa's Talk REST API SDK (SMS for Zimbabwe, $0.008/SMS vs Twilio $0.05/SMS)
- DIDIT REST API SDK (KYC/ID verification for Zimbabwe)
- Next.js 14 on Vercel FREE Tier (App Router with Supabase Auth integration, 100GB bandwidth/month)
- EcoCash SDK, Omari Payment SDK
- AWS Lambda for microservices (1M requests/month FREE forever)
- Winston (structured logging to CloudWatch Logs)
- Jest + Supertest (testing)

**Storage**:
- **Supabase PostgreSQL (Unified Database)**:
  - `fineract_tenants` database (Fineract multi-tenancy config)
  - `fineract_default` database (loan accounts, transactions, repayment schedules)
  - Operational tables: `whatsapp_sessions`, `distributor_inventory`, `distributor_commissions`, `inventory_reconciliations`, `admin_users`, `support_tickets`, `kyc_cache`, `payment_reconciliations`, `payment_callbacks`, `next_of_kin`, `model_versions`, `lock_commands`
- **Supabase Storage**: Commission PDFs, KYC documents, reconciliation photos, ML model files
- **Supabase Edge Functions**: Replaces AWS Lambda for serverless background jobs

**Testing**: Jest (unit), Supertest (integration), Playwright (E2E for Next.js frontends), contract testing for API boundaries
**Target Platform** (YC Bootstrap Cost-Optimized):
- **Supabase Cloud FREE Tier** (500MB PostgreSQL, Auth, Realtime, 1GB Storage, 500K Edge Function invocations/month)
- **AWS Lambda FREE Tier** (1M requests/month, 400K GB-seconds compute forever free) - Hosts 5 microservices
- **AWS EC2 t3.micro FREE Tier** (750hrs/month Year 1) - Hosts Apache Fineract Docker container connected to Supabase PostgreSQL
- **Vercel FREE Tier** - Hosts Next.js frontends (100GB bandwidth/month, unlimited deploys)
- **Cloudflare Workers FREE Tier** (100K requests/day) - Hosts ML scoring service (Python WASM with Pyodide)
- **WhatsApp Cloud API (Meta) FREE Tier** (1000 conversations/month) - Replaces Twilio WhatsApp
- **Africa's Talk SMS** (Zimbabwe-optimized, $0.008/SMS vs Twilio $0.05/SMS)
- **Target Costs**: $0-5/month (Months 1-3), $5-15/month (Months 4-6), $15-25/month (Months 7-12), <$40/month (Year 2 post AWS free tier)
- **See**: cost-optimization-COST-OPTIMIZATION.md for detailed cost breakdown and migration strategy
**Project Type**: Web + Mobile (5 microservices + Supabase platform, 2 Next.js web frontends, Android lock app)
**Services Architecture** (YC Bootstrap):
- **5 Custom Microservices** (AWS Lambda Node.js/Python): whatsapp-service, kyc-service, payment-service, lock-service (+ Cloudflare Workers for scoring-service)
- **Supabase Edge Functions** (Deno/TypeScript): weekly-commission-batch, payment-reconciliation, daily-reminders, low-stock-alerts, send-sms, send-email
- **Supabase Managed Services** (FREE Tier): PostgreSQL, Auth, Realtime, Storage
- **External Services**: Apache Fineract (AWS EC2 t3.micro), WhatsApp Cloud API (Meta), DIDIT, EcoCash/Omari, Africa's Talk SMS, Device Lock Provider

**Performance Goals**:
- WhatsApp message response: <2s p95
- Fineract API calls: <500ms p95
- Payment gateway callbacks: <3s p95
- Distributor dashboard load: <1.5s (with Supabase Realtime updates <100ms)
- Admin dashboard load: <2s
- Inventory sync latency: <1s (WebSocket)

**Constraints**:
- Fineract API rate limit: 100 req/min with burst 20 (token bucket)
- WhatsApp session timeout: 24hrs (PostgreSQL state expiry)
- Payment gateway timeout: 30s (circuit breaker trips after 3 failures)
- Session timeouts: 30min (distributor), 2hr (admin), 1hr (CS)
- Data retention: 7 years (RBZ FIU compliance)
- Asset lock grace period: 15 days past due (reduce by 5 days per subsequent late payment)

**Scale/Scope**:
- Expected launch: 100 active loans/month → 1000/month by month 6
- Distributor staff: 10-50 concurrent users
- Admin users: 5-20 concurrent users
- WhatsApp bot: 200-500 daily conversations
- 147 functional requirements across 13 user stories
- 22 data entities (9 Supabase-specific, 13 mapped to/from Fineract)

## Constitution Check

✅ **Library-First Development**: Each service (WhatsApp, KYC, Scoring, Payment, Notification, Inventory, Lock, Admin, CS) is self-contained with clear API boundaries, independent test suites, and framework-agnostic design compatible with Apache Fineract's REST API.

✅ **Test-Driven Development (NON-NEGOTIABLE)**: All phases follow TDD cycle: write tests first → user approval → verify failure → implement → run tests → refactor. Contract tests for Fineract API client, integration tests for payment flows, E2E tests for WhatsApp journeys.

✅ **Microservices First**: 5 independent custom microservices (whatsapp, kyc, payment, lock, scoring) + Supabase Edge Functions (6 serverless functions), each with service-specific database schema (Supabase PostgreSQL) or Fineract entity mapping, API-first communication via REST + PostgreSQL triggers/pg_notify, independent deployment via AWS Lambda/Cloudflare Workers.

✅ **Integration Testing**: Focus on service contracts (Fineract API client), API versioning (external KYC/scoring), event schemas (loan approval → notification), payment flows (EcoCash/Omari callbacks), WhatsApp interactions (USSD handoff).

✅ **Observability**: Winston structured logging to CloudWatch Logs, AWS X-Ray for transaction tracing, CloudWatch custom metrics (loan approval rate, payment success rate, WhatsApp response time), Sentry for error tracking, audit trail tables in PostgreSQL.

**No constitution violations.** All architecture principles satisfied.

## Project Structure

### Documentation (this feature)

```
specs/lynia-lending/
├── spec.md              # Feature specification (31 clarifications, 147 FRs, 13 user stories)
├── plan.md              # This file (implementation roadmap)
├── research.md          # Phase 0 research findings (to be created)
├── data-model.md        # Phase 1 data model design (to be created)
├── quickstart.md        # Phase 1 developer quickstart (to be created)
├── contracts/           # Phase 1 API contracts (to be created)
│   ├── fineract-client.yaml
│   ├── whatsapp-service.yaml
│   ├── kyc-service.yaml
│   ├── scoring-service.yaml
│   ├── payment-service.yaml
│   └── event-schemas.yaml
└── tasks.md             # Phase 2 task breakdown (to be created via /speckit.tasks)
```

### Source Code (repository root)

```
apache-fineract-src-1.12.1/
├── backend/
│   ├── services/                      # AWS Lambda Functions (Node.js/TypeScript)
│   │   ├── whatsapp-service/          # WhatsApp Cloud API (Meta) bot, conversation state, menu orchestration
│   │   │   ├── src/
│   │   │   │   ├── handlers/          # Message handlers (greeting, terms, KYC, menu, USSD)
│   │   │   │   ├── state/             # Supabase PostgreSQL session management (24hr expiry)
│   │   │   │   ├── integrations/      # Fineract client, KYC, Scoring, Payment
│   │   │   │   └── lib/               # WhatsApp Cloud API SDK wrapper, validation (ID format, phone format)
│   │   │   ├── serverless.yml         # Serverless Framework config (AWS Lambda deployment)
│   │   │   ├── handler.ts             # Lambda entry point (API Gateway webhook handler)
│   │   │   └── tests/
│   │   │       ├── contract/          # Fineract API contract tests
│   │   │       ├── integration/       # E2E WhatsApp journey tests
│   │   │       └── unit/              # Handler, state, validation tests
│   │   ├── kyc-service/               # DIDIT KYC API integration (Zimbabwe ID verification)
│   │   │   ├── src/
│   │   │   │   ├── client/            # DIDIT REST API client (authentication, request/response handling)
│   │   │   │   ├── verification/      # ID format validation (XX-XXXXXXAXX), liveness detection, biometric matching
│   │   │   │   ├── cache/             # Supabase PostgreSQL table `kyc_cache` (duplicate detection: phone + ID, valid verifications 7-day TTL)
│   │   │   ├── serverless.yml         # Serverless Framework config (AWS Lambda deployment)
│   │   │   ├── handler.ts             # Lambda entry point (REST API handler)
│   │   │   │   └── lib/               # ID format validator, flagging logic (stolen/fake/expired/biometric mismatch)
│   │   │   └── tests/
│   │   ├── scoring-service/           # Hybrid credit scoring orchestrator (AWS Lambda Node.js)
│   │   │   ├── src/
│   │   │   │   ├── fineract/          # Fineract Scorecard API client (baseline scoring 0-100)
│   │   │   │   ├── ml-api/            # Cloudflare Worker ML API client (Pyodide Python WASM scoring)
│   │   │   │   ├── hybrid/            # Hybrid scoring logic (Fineract + ML adjustment = final score)
│   │   │   │   ├── features/          # Feature extraction from KYC data (income, employment, liveness score)
│   │   │   │   ├── tiers/             # Score-based loan tiers (60-70=$200, 71-85=$350, 86-100=$500)
│   │   │   │   └── lib/               # Max loan enforcement, cold start handling, qualification logic
│   │   │   ├── serverless.yml         # Serverless Framework config (AWS Lambda deployment)
│   │   │   ├── handler.ts             # Lambda entry point (REST API handler)
│   │   │   └── tests/
│   │   │       ├── contract/          # Fineract Scorecard API, ML API contract tests
│   │   │       ├── integration/       # Hybrid scoring integration tests
│   │   │       └── unit/              # Feature extraction, tier calculation tests
│   │   ├── ml-scoring-worker/         # Cloudflare Worker Python ML model (WASM via Pyodide)
│   │   │   ├── src/
│   │   │   │   ├── index.ts           # Cloudflare Worker entry point (fetch handler)
│   │   │   │   ├── pyodide-loader.ts  # Load Pyodide runtime and scikit-learn
│   │   │   │   ├── models/            # Trained ML models (logistic regression serialized as pickle)
│   │   │   │   ├── features.py        # Python feature engineering (runs in Pyodide)
│   │   │   │   ├── inference.py       # Python model inference (runs in Pyodide)
│   │   │   │   └── lib/               # Model version management
│   │   │   ├── wrangler.toml          # Cloudflare Workers config
│   │   │   ├── tests/
│   │   │   │   ├── unit/              # Model prediction tests
│   │   │   │   └── integration/       # Worker API endpoint tests
│   │   │   └── notebooks/             # Jupyter notebooks for model training (local development)
│   │   ├── fineract-gateway/          # Apache Fineract REST API orchestration layer
│   │   │   ├── src/
│   │   │   │   ├── client/            # Fineract REST API client (rate limiting: token bucket 100/min, burst 20)
│   │   │   │   ├── mappers/           # DTO mappers (Supabase ↔ Fineract entities)
│   │   │   │   ├── services/          # Loan origination, repayment, account management
│   │   │   │   └── lib/               # Interest calculation (25-50% flat, simple interest formula)
│   │   │   └── tests/
│   │   │       ├── contract/          # Fineract API contract tests (loan endpoints)
│   │   │       ├── integration/       # Loan lifecycle tests (origination → repayment → closure)
│   │   │       └── unit/              # Mapper, calculation, rate limiting tests
│   │   ├── payment-service/           # EcoCash + Omari payment gateway integration (AWS Lambda)
│   │   │   ├── src/
│   │   │   │   ├── gateways/          # EcoCash SDK, Omari SDK clients
│   │   │   │   ├── orchestration/     # Dual gateway routing, circuit breaker (30s timeout, block after 3 failures)
│   │   │   │   ├── webhooks/          # Payment callback handlers (USSD confirmation)
│   │   │   │   └── lib/               # Reconciliation logic (support ticket for mismatches)
│   │   │   ├── serverless.yml         # Serverless Framework config (AWS Lambda deployment)
│   │   │   ├── handler.ts             # Lambda entry point (API Gateway webhook handler)
│   │   │   └── tests/
│   │   │       ├── integration/       # Payment flow tests (initiate → callback → Fineract posting)
│   │   │       └── unit/              # Circuit breaker, webhook validation tests
│   │   └── lock-service/              # Remote asset lock orchestration (AWS Lambda)
│   │       ├── src/
│   │       │   ├── commands/          # Lock/unlock command dispatch to third-party provider API
│   │       │   ├── triggers/          # 15-day past due trigger, grace period reduction (5 days)
│   │       │   └── lib/               # Device registry, command queue (Supabase PostgreSQL)
│   │       ├── serverless.yml         # Serverless Framework config (AWS Lambda deployment)
│   │       ├── handler.ts             # Lambda entry point (REST API handler)
│   │       └── tests/
│   ├── shared/                        # Shared libraries (framework-agnostic)
│   │   ├── supabase/                  # Supabase client library (PostgreSQL, Auth, Realtime, Storage)
│   │   │   ├── client.ts              # Supabase client initialization
│   │   │   ├── auth-helpers.ts        # Auth helpers (JWT verification, RLS policy helpers)
│   │   │   ├── realtime.ts            # Realtime subscription helpers
│   │   │   └── storage.ts             # Storage upload/download helpers
│   │   ├── validation/                # Common validators (ID, phone, email)
│   │   └── observability/             # Winston logging, CloudWatch metrics (X-Ray tracing for Lambda)
│   ├── supabase/                      # Supabase Edge Functions (Deno/TypeScript)
│   │   ├── functions/
│   │   │   ├── weekly-commission-batch/   # Deno function: calculate weekly distributor commissions
│   │   │   │   ├── index.ts               # Edge Function entry point (Deno.serve)
│   │   │   │   └── commission-logic.ts    # Commission calculation business logic
│   │   │   ├── payment-reconciliation/    # Deno function: daily payment reconciliation
│   │   │   │   ├── index.ts
│   │   │   │   └── reconciliation-logic.ts
│   │   │   ├── daily-reminders/           # Deno function: send daily payment reminders
│   │   │   │   ├── index.ts
│   │   │   │   └── reminder-logic.ts
│   │   │   ├── low-stock-alerts/          # Deno function: check inventory and send SMS alerts
│   │   │   │   ├── index.ts
│   │   │   │   └── alert-logic.ts
│   │   │   ├── send-sms/                  # Deno function: send SMS via Africa's Talk
│   │   │   │   ├── index.ts
│   │   │   │   └── africas-talk-client.ts
│   │   │   └── send-email/                # Deno function: send email via Resend API
│   │   │       ├── index.ts
│   │   │       └── resend-client.ts
│   │   ├── migrations/                # Supabase PostgreSQL migrations (SQL files)
│   │   │   ├── 001_initial_schema.sql # Initial tables, indexes, RLS policies
│   │   │   ├── 002_event_log.sql      # Event log table for PostgreSQL pub/sub
│   │   │   ├── 003_triggers.sql       # PostgreSQL triggers (pg_notify events)
│   │   │   └── 004_rls_policies.sql   # Row Level Security policies for RBAC
│   │   └── config.toml                # Supabase project configuration
│   └── infrastructure/
│       ├── docker/                    # Docker Compose for local Fineract development
│       │   ├── docker-compose.yml     # Fineract + PostgreSQL client
│       │   └── Dockerfile.fineract    # Apache Fineract Docker image
│       ├── terraform/                 # AWS infrastructure as code (Lambda, EC2, API Gateway, CloudWatch)
│       │   ├── lambda-functions.tf    # Lambda function definitions (5 microservices)
│       │   ├── api-gateway.tf         # API Gateway REST API (WhatsApp webhook, payment callback)
│       │   ├── ec2-fineract.tf        # EC2 t3.micro instance for Apache Fineract
│       │   ├── cloudwatch.tf          # CloudWatch Log Groups, Metrics, Alarms
│       │   └── iam-policies.tf        # IAM roles for Lambda (Supabase connection, CloudWatch Logs)
│       └── scripts/                   # Deployment, migration scripts (serverless deploy, supabase db push)
├── frontend/
│   ├── distributor-dashboard/         # Next.js 14 (distributor staff interface)
│   │   ├── src/
│   │   │   ├── app/                   # App Router pages (inventory, customer verification, payment confirmation)
│   │   │   ├── components/            # Reusable UI components
│   │   │   ├── services/              # API clients (Fineract gateway, inventory, payment)
│   │   │   └── lib/                   # Auth, WebSocket client (real-time inventory)
│   │   └── tests/                     # Playwright E2E tests
│   └── admin-portal/                  # Next.js 14 (admin/backoffice interface)
│       ├── src/
│       │   ├── app/                   # App Router pages (dashboard, reporting, compliance, distributor management)
│       │   ├── components/            # Reusable UI components, charts
│       │   ├── services/              # API clients (admin service, Fineract gateway)
│       │   └── lib/                   # Auth (RBAC roles), data export utilities
│       └── tests/                     # Playwright E2E tests
└── docs/
    ├── architecture/                  # System architecture diagrams
    ├── api/                           # API documentation (Swagger/OpenAPI)
    ├── lock-provider/                 # Third-party device lock provider integration docs
    │   ├── provider-comparison.md     # Phase 0 R0.7 provider evaluation results
    │   ├── api-integration.md         # Lock provider API integration guide
    │   └── device-onboarding.md       # Device registration and pre-installation procedures
    └── runbooks/                      # Operational runbooks (deployment, incident response)
```

**Structure Decision**: Web application structure selected due to backend microservices + dual web frontends. Backend services are framework-agnostic, exposing REST APIs compatible with Apache Fineract's API design patterns. Each service maintains independent test suites (contract, integration, unit) following TDD mandate. Device lock functionality provided via third-party provider API integration (no custom Android app development required).

## Complexity Tracking

*No constitution violations. This table is empty.*

## Phase 0: Research

**Objective**: Validate Apache Fineract integration approach, understand external API contracts, prototype critical technical unknowns (WhatsApp state management, payment gateway callbacks, asset lock mechanism).

### R0.1: Apache Fineract REST API Deep Dive
**Goal**: Map Lynia Finance loan workflows (origination, repayment, asset-backed lending) to Fineract API endpoints.
**Deliverables**:
- API endpoint inventory for loan lifecycle (create loan account, disburse, post repayment, apply charges)
- Authentication mechanism (OAuth2, API keys, tenant headers)
- Rate limiting behavior (document observed limits, test token bucket implementation)
- DTO schema documentation for loan creation, repayment posting, account queries
- Error response catalog (validation errors, business rule violations)
- Test Fineract tenant setup (create sample loan products, test repayment schedules)

**Acceptance Criteria**:
- [ ] Successfully create loan account via API with 25-50% flat interest rate
- [ ] Post test repayment and verify balance update
- [ ] Document all required headers, authentication tokens
- [ ] Confirm rate limit behavior matches 100 req/min assumption

### R0.2: WhatsApp Cloud API (Meta) Integration (YC Bootstrap)
**Goal**: Prototype WhatsApp message handling with FREE WhatsApp Cloud API, USSD payment link generation, conversation state persistence.
**Deliverables**:
- WhatsApp Cloud API setup (Meta Graph API v18.0+, webhook configuration, phone number registration)
- WhatsApp message templates (greeting, terms, KYC prompts, phone list, payment link) - Must be approved by Meta
- USSD payment link generation (EcoCash/Omari integration with WhatsApp)
- Conversation state schema (Supabase PostgreSQL: session_id, user_phone, current_step, context_data, expires_at)
- State expiry mechanism (24hr automatic cleanup via PostgreSQL TTL or Supabase Edge Function cron)
- Menu navigation flow (Buy Phone, Make Payment, Check Balance, Talk to CS)
- **Cost Optimization**: 1000 conversations/month FREE (sufficient for MVP testing)

**Acceptance Criteria**:
- [ ] Send/receive WhatsApp messages via WhatsApp Cloud API (Meta Business account)
- [ ] Message templates approved by Meta (required for production)
- [ ] Generate USSD payment link and test handoff to EcoCash
- [ ] Persist conversation state to Supabase PostgreSQL with 24hr expiry
- [ ] Handle menu option navigation (4 options per spec)
- [ ] Verify free tier limits (1000 conversations/month) sufficient for Month 1-3

### R0.3: EcoCash + Omari Payment Gateway SDKs
**Goal**: Integrate dual payment gateways, implement circuit breaker pattern, handle webhook callbacks.
**Deliverables**:
- EcoCash SDK documentation and test integration (initiate payment, handle callback)
- Omari SDK documentation and test integration
- Circuit breaker implementation (30s timeout, trip after 3 failures, block payments)
- Webhook endpoint design (signature verification, idempotency, callback to Fineract)
- Reconciliation workflow for payment mismatches (support ticket creation)

**Acceptance Criteria**:
- [ ] Successfully initiate test payment via EcoCash SDK
- [ ] Successfully initiate test payment via Omari SDK
- [ ] Circuit breaker trips after simulating 3 EcoCash failures
- [ ] Webhook correctly posts payment to Fineract repayment endpoint

### R0.4: DIDIT KYC API Integration
**Goal**: Integrate DIDIT for Zimbabwe national ID verification, understand API request/response format, ID validation logic, error handling.
**Deliverables**:
- DIDIT REST API documentation (endpoint, authentication via API key/partner ID, request schema, response schema)
- DIDIT SDK setup for Node.js (if available) or direct REST API integration
- ID format validation (Zimbabwe format: XX-XXXXXXAXX) before API submission
- Document ID types supported (Zimbabwe National ID, Passport, Driver's License)
- Flagging logic (stolen ID, fake ID, mismatch, expired ID, biometric verification failure)
- Liveness detection integration (selfie verification with ID document)
- Error response handling (API down, invalid ID, flagged ID, insufficient image quality)
- Caching strategy (Supabase PostgreSQL table `kyc_cache`: store valid verifications, TTL 7 days for RBZ compliance - no Redis needed)
- Webhook configuration for async verification results (if supported)
- Test account setup with DIDIT for sandbox testing

**Acceptance Criteria**:
- [ ] Successfully verify test Zimbabwe national ID via DIDIT API
- [ ] Validate ID format before API call (XX-XXXXXXAXX regex)
- [ ] Handle flagged ID response (stolen, fake, expired) and block loan application
- [ ] Process liveness detection results (selfie matches ID photo)
- [ ] Cache valid verification for 7 days (RBZ compliance window)
- [ ] Document DIDIT pricing model and transaction costs
- [ ] Test error scenarios (API timeout, invalid credentials, rate limiting)

### R0.5: Hybrid Credit Scoring System Design (Fineract + In-House ML)
**Goal**: Design hybrid credit scoring using Apache Fineract Scorecard API for baseline scoring and in-house ML models for advanced risk assessment targeting underbanked customers without formal credit history.
**Deliverables**:
- **Apache Fineract Scorecard API research**: Understand Fineract's built-in scoring capabilities, scorecard configuration, criteria weighting, score calculation API endpoints
- **Fineract Scorecard configuration**: Define scoring criteria (KYC completeness, Next of Kin verification, employment type, loan amount requested, deposit percentage)
- **In-house ML model design**: Behavioral scoring algorithm using features available for underbanked customers (no credit bureau data)
- **Feature engineering**: Map KYC data to ML features (income estimate, employment stability, Next of Kin responsiveness, phone ownership duration, DIDIT liveness confidence score)
- **Model selection**: Logistic regression (interpretability) vs. XGBoost (accuracy) for payment default prediction
- **Training data strategy**: Initial rule-based scoring → collect payment history → retrain models monthly
- **Hybrid scoring logic**: Fineract baseline score (0-100) + ML adjustment factor (-20 to +20) = final score (0-100)
- **Risk score interpretation**: Threshold for approval (score ≥60), max loan calculation (score-based tiers: 60-70=$200, 71-85=$350, 86-100=$500)
- **Cold start problem**: Use Fineract scorecard only for first 3 months until sufficient payment data collected
- **Model deployment**: REST API wrapper (FastAPI/Flask) for ML model serving, containerized alongside Node.js services
- **A/B testing framework**: Route 10% of applications to ML-only scoring for model validation
- **Fallback logic**: If ML API down, use Fineract scorecard only; if Fineract down, manual review

**Acceptance Criteria**:
- [ ] Successfully configure Apache Fineract scorecard with 5+ scoring criteria
- [ ] Score test customer via Fineract Scorecard API and verify score calculation
- [ ] Build baseline ML model (logistic regression) trained on synthetic data
- [ ] Deploy ML model as REST API and successfully score test customer
- [ ] Implement hybrid scoring logic: Fineract score + ML adjustment
- [ ] Calculate max loan amount using tiered approach (capped at $500)
- [ ] Handle API unavailability for both Fineract and ML (fallback to manual review)
- [ ] Document model retraining schedule and data requirements

### R0.6: Supabase Realtime & Edge Functions Research
**Goal**: Research Supabase Realtime WebSocket subscriptions and Edge Functions capabilities to replace custom WebSocket server and notification services.
**Deliverables**:
- **Supabase Realtime Research**:
  - Database change subscriptions (listen to INSERT/UPDATE/DELETE on inventory tables)
  - Real-time channels for distributor dashboard (<100ms latency for inventory updates)
  - Row Level Security (RLS) integration with Realtime (filter data by distributor_id)
  - Client SDKs: JavaScript (Next.js frontend), reconnection logic (automatic)
  - Latency testing (<1s sync requirement for 50 concurrent distributors)
- **Supabase Edge Functions Research**:
  - Deno runtime capabilities (TypeScript support, NPM module compatibility)
  - Cron jobs configuration (scheduled functions: weekly commissions, daily reminders, reconciliation)
  - Database trigger integration (auto-execute Edge Function on INSERT/UPDATE)
  - Third-party API calls from Edge Functions (Twilio SMS, WhatsApp, email)
  - Execution limits: Free tier (150s), Paid tier (400s)
  - Cold start latency (<1s for typical workloads)
- **Supabase Storage Research**:
  - File upload API (commission PDFs, KYC documents, reconciliation photos)
  - Automatic image optimization (resize on-the-fly)
  - Signed URLs for secure access (expire after 1hr)
  - CDN distribution for global delivery

**Acceptance Criteria**:
- [ ] Supabase Realtime tested with inventory table changes (<100ms latency)
- [ ] RLS policies work with Realtime subscriptions (filter by distributor_id)
- [ ] Supabase Edge Function deployed with Twilio API call (send SMS)
- [ ] Cron job created in Edge Function (test daily schedule)
- [ ] Database trigger fires Edge Function on inventory INSERT
- [ ] Supabase Storage tested with file upload and signed URL retrieval
- [ ] Load testing: 50 concurrent Realtime subscriptions without degradation

### R0.7: Third-Party Android Lock Provider Evaluation & Integration
**Goal**: Research and select a third-party device lock provider with lending app API integration capabilities, validate API contract and remote lock/unlock mechanism.
**Deliverables**:
- **Provider evaluation criteria**: API maturity, Zimbabwe device coverage, lending app specialization, pricing model, SLA guarantees, pre-installation support
- **Candidate providers research**: Evaluate providers specializing in asset-backed lending device control (e.g., LEMU, RecovR, DeviceLock Pro, or regional providers)
- **API documentation review**: Lock/unlock endpoints, authentication, webhook callbacks, device registration, lock status monitoring
- **Integration requirements**: API key management, webhook endpoints for device status updates, command queue design
- **Grace period implementation**: 15 days past due trigger, grace reduction (5 days per late payment), lock escalation workflow
- **Device pre-installation strategy**: Work with provider on factory pre-install or first-boot activation
- **Pilot testing**: Register test device with provider, trigger lock via API, verify unlock, test command latency
- **Fallback strategy**: Manual lock via provider dashboard if API down, CS escalation for unlock requests
- **Cost analysis**: Per-device licensing fees, API transaction costs, monthly subscription vs. pay-per-use
- **Contract negotiation prep**: Volume discounts, SLA requirements, Zimbabwe support commitment

**Acceptance Criteria**:
- [ ] Document 3+ candidate providers with comparison matrix (features, pricing, API quality)
- [ ] Select recommended provider with justification
- [ ] Successfully integrate with provider's API (sandbox environment)
- [ ] Lock test device remotely via API and verify lock status
- [ ] Unlock test device via API and confirm device access restored
- [ ] Measure command latency (target: <30s from API call to device lock)
- [ ] Test webhook callbacks for device status updates (locked, unlocked, tampered)
- [ ] Document provider pre-installation process for devices
- [ ] Define pricing model and per-device cost projections

### R0.8: AWS Infrastructure Prototyping (YC Bootstrap)
**Goal**: Validate AWS Lambda deployment, EC2 t3.micro setup for Fineract, Supabase PostgreSQL connection.
**Deliverables**:
- **AWS Lambda deployment** (Serverless Framework or AWS SAM templates for 5 microservices)
- **AWS EC2 t3.micro FREE Tier** setup (Docker Compose with Apache Fineract + PostgreSQL client)
- **Supabase PostgreSQL connection** from EC2 (Fineract connected to Supabase, not separate RDS)
- **Cloudflare Workers** deployment test (Pyodide + scikit-learn WASM for ML scoring)
- CloudWatch Logs configuration (Lambda function log groups)
- VPC design for EC2 (public subnet only, security group for port 22/8443, Supabase connection via public internet with TLS)
- **Rate limiting** via in-memory token bucket (no Redis needed for bootstrap phase, move to Upstash Redis free tier if needed)

**Acceptance Criteria**:
- [ ] Deploy test Lambda function successfully (whatsapp-service)
- [ ] AWS EC2 t3.micro running Apache Fineract Docker container
- [ ] Fineract connects to Supabase PostgreSQL successfully (verify with test loan product creation)
- [ ] Cloudflare Worker executes Pyodide Python code (test scikit-learn model inference)
- [ ] Token bucket rate limiting works in Lambda (100 req/min, burst 20) - in-memory for MVP
- [ ] CloudWatch Logs capture Lambda function logs
- [ ] **Cost verification**: $0 infrastructure cost (all FREE tier)

### R0.9: Security & Compliance Research
**Goal**: Ensure JWT authentication, session management, data encryption, RBZ FIU compliance.
**Deliverables**:
- JWT implementation (httpOnly cookies, refresh tokens, session timeouts: 30min/2hr/1hr)
- RBAC design (4 admin roles: Super Admin, Financial Ops, Risk/Compliance, Customer Support)
- Data encryption at rest (RDS encryption, S3 bucket encryption)
- Data encryption in transit (TLS 1.3, API Gateway HTTPS)
- Audit logging schema (PostgreSQL: user_id, action, resource, timestamp, IP)
- RBZ FIU compliance checklist (KYC/AML, 7-year retention, transaction monitoring)

**Acceptance Criteria**:
- [ ] JWT authentication works (login, token refresh, session timeout)
- [ ] RBAC enforces role permissions (4 admin roles)
- [ ] RDS encryption enabled (MySQL, PostgreSQL)
- [ ] Audit log captures all admin actions
- [ ] 7-year retention policy documented

### R0.10: Testing Strategy & Tooling
**Goal**: Establish TDD workflow, contract testing, integration testing, E2E testing.
**Deliverables**:
- Jest configuration for backend services (unit tests, integration tests)
- Supertest setup for API integration tests
- Contract testing framework (Pact or custom JSON schema validation)
- Playwright setup for Next.js E2E tests
- Test data fixtures (sample loans, customers, payments)
- CI/CD pipeline design (GitHub Actions or AWS CodePipeline)

**Acceptance Criteria**:
- [ ] Jest runs unit tests for sample service
- [ ] Supertest integration test calls Fineract API
- [ ] Contract test validates Fineract API response schema
- [ ] Playwright E2E test completes WhatsApp journey
- [ ] CI/CD pipeline runs tests on commit

**Research Phase Duration**: 3-4 weeks (parallel workstreams)

---

## Phase 1: Design

**Objective**: Produce data model, API contracts, event schemas, calculation logic, security design, observability plan, developer quickstart.

### D1.1: Data Model Design (`data-model.md`)
**Goal**: Define PostgreSQL schema (Supabase), map entities to Fineract, document relationships.
**Deliverables**:
- **Supabase PostgreSQL Schema**:
  - `whatsapp_sessions` (session_id, user_phone, current_step, context_data, expires_at)
  - `distributor_inventory` (id, imei UNIQUE, phone_model, retail_price, purchase_date, ownership = 'Lynia Finance', consignment_location_id, status: Available/HandedOver/Damaged/Lost/Stolen/Returned, handed_over_date, handed_over_to_customer_id, handed_over_by_staff_id, last_updated)
  - `customer_tentative_selections` (id, customer_phone, customer_id, phone_model, phone_price, nearest_distributor_id, selected_at, expires_at, status: Tentative/Confirmed/Changed/Expired, confirmed_phone_imei, confirmed_at)
  - `distributor_commissions` (id, distributor_id, staff_id, loan_id, phone_imei, retail_price, commission_rate, commission_amount, handover_date, status: Pending/Approved/Paid/Failed/Disputed, payment_date, payment_method, payment_reference, created_at)
  - `inventory_reconciliations` (id, distributor_id, reconciliation_date, system_count, physical_count, discrepancy, discrepancy_reason, photo_evidence_urls, conducted_by_staff_id, approved_by_admin_id, status: Pending/UnderInvestigation/Resolved/Disputed, shrinkage_charge_amount, created_at, resolved_at)
  - `admin_users` (id, email, role, permissions, created_at)
  - `audit_logs` (id, user_id, action, resource, timestamp, ip_address)
  - `support_tickets` (id, customer_id, issue_type, status, assigned_to, created_at)
  - `kyc_cache` (id, customer_phone, id_number, verification_status, cached_at, expires_at)
  - `inventory_transfers` (id, from_distributor, to_distributor, phone_model, quantity, status, approved_by)
  - `payment_reconciliations` (id, payment_id, fineract_transaction_id, status, support_ticket_id)
  - `payment_callbacks` (id, transaction_id, callback_payload, status: Received/Processing/Applied/Duplicate, received_at, processed_at)
  - `next_of_kin` (id, customer_id, name, id_number, phone, verification_status: Pending/Verified/Failed, sms_sent_at, verified_at)
  - `model_versions` (id, version_id, model_file_path, training_date, accuracy_metrics JSON, status: Draft/Active/Retired, created_at, deployed_at)
  - `lock_commands` (id, device_id, command_type, status, dispatched_at, confirmed_at)
- **Fineract Entity Mapping**:
  - Loan Account (maps to customer loan)
  - Client (maps to customer)
  - Repayment Schedule (maps to 8-month installment plan)
  - Transaction (maps to payment postings)
  - Loan Product (25-50% interest rate configuration)
- **Relationships**:
  - WhatsApp session → Customer (1:1 active session)
  - Customer → Loan Account (1:N via Fineract)
  - Distributor → Inventory (1:N)
  - Support Ticket → Customer (1:N)
  - Lock Command → Device (1:1 per command)

**Acceptance Criteria**:
- [ ] All 22 entities documented with fields, types, constraints
- [ ] Foreign key relationships defined
- [ ] Indexes specified for query performance
- [ ] 7-year retention policy applied to audit_logs, transactions
- [ ] data-model.md passes user approval

### D1.2: API Contracts (`contracts/*.yaml`)
**Goal**: Define OpenAPI 3.0 contracts for all services, ensure Fineract compatibility.
**Deliverables**:
- `fineract-client.yaml` (REST API client contract: loan creation, repayment posting, account queries)
- `whatsapp-service.yaml` (Twilio webhook endpoints, conversation state APIs)
- `kyc-service.yaml` (ID verification API, caching, flagging)
- `scoring-service.yaml` (Credit scoring API with A/B testing support, model versioning, max loan calculation, grace period calculation)
- `payment-service.yaml` (Payment initiation, webhook callbacks with idempotency, two-phase commit reconciliation, duplicate detection)
- `notification-service.yaml` (Email/SMS sending, template management)
- `inventory-service.yaml` (Inventory CRUD, WebSocket events, transfer approval)
- `lock-service.yaml` (Lock/unlock commands, grace period triggers)
- `admin-service.yaml` (Dashboard APIs, reporting, RBAC endpoints)
- `cs-service.yaml` (Ticket management, escalation, dispute resolution)

**Acceptance Criteria**:
- [ ] All contracts follow OpenAPI 3.0 spec
- [ ] Request/response schemas include validation rules (ID format, phone format)
- [ ] Error responses documented (4xx, 5xx)
- [ ] Authentication mechanisms specified (JWT, API keys)
- [ ] Fineract API client contract matches research findings
- [ ] contracts/ directory passes user approval

### D1.3: Event Architecture Design with Supabase Realtime + Database Triggers (`event-schemas.yaml`)
**Goal**: Define event-driven architecture using Supabase Realtime (WebSocket subscriptions), PostgreSQL database triggers, and NOTIFY/LISTEN for reliable asynchronous service communication.
**Deliverables**:
- **Supabase Realtime Event Architecture**:
  - **PostgreSQL Database Triggers**: Fire on INSERT/UPDATE/DELETE to publish events
  - **pg_notify()**: PostgreSQL native pub/sub for inter-service communication
  - **Supabase Realtime**: WebSocket subscriptions for frontend real-time updates (inventory, commissions, payment status)
  - **Event Log Table**: `event_log` table with event_id (UUID), event_type, payload (JSONB), status (pending/processed/failed), created_at, processed_at, retry_count
  - **Supabase Edge Functions**: Subscribe to database changes via triggers, process async workflows
  - **Dead Letter Pattern**: Failed events (retry_count >= 3) flagged for manual review in `event_log` table
- **Event Schemas** (JSON Schema for validation):
  - `loan.application.submitted` (triggers KYC service, Scoring service via database trigger)
  - `loan.application.approved` (triggers Supabase Edge Function for notification, updates inventory table for reservation)
  - `loan.disbursed` (triggers Payment service for deposit confirmation via NOTIFY)
  - `payment.received` (triggers Fineract posting, Supabase Edge Function sends WhatsApp notification)
  - `payment.failed` (triggers Payment service retry, CS ticket auto-creation via trigger)
  - `repayment.overdue` (triggers Lock service after grace period via database trigger)
  - `inventory.stock_low` (triggers Supabase Edge Function for admin WhatsApp alert)
  - `distributor.deactivated` (triggers Admin service transaction reassignment via database trigger)
  - `device.lock.triggered` (triggers Lock service API call via NOTIFY)
  - `kyc.verification.completed` (triggers Scoring service with KYC results)
- **Event Message Format** (JSONB in event_log table):
  - `event_id` (UUID for idempotency, PRIMARY KEY)
  - `event_type` (schema identifier, indexed)
  - `event_version` (semantic versioning: v1, v2)
  - `timestamp` (ISO 8601, timestamptz)
  - `correlation_id` (trace request across services)
  - `source_service` (publisher identifier)
  - `payload` (JSONB event data)
- **Event Versioning Strategy**: Semantic versioning with backward compatibility (support v1 + v2 simultaneously during migrations)
- **Idempotency**: event_id (UUID) as PRIMARY KEY ensures no duplicate processing
- **Retry Strategy**:
  - Supabase Edge Functions: Automatic retry with exponential backoff (1s, 5s, 25s)
  - Custom services: Poll `event_log` table for pending events, retry with exponential backoff
  - Max 3 retries before marking as failed
- **Realtime Subscriptions** (for frontends):
  - `distributor_inventory:*` → Distributor dashboard (inventory updates)
  - `distributor_commissions:distributor_id=eq.{id}` → Commission status updates
  - `payment_callbacks:*` → Admin dashboard (payment reconciliation)

**Acceptance Criteria**:
- [ ] `event_log` table created with indexes on event_type, status, created_at
- [ ] PostgreSQL triggers created for all 10 critical events
- [ ] All 10 critical events documented with JSON Schema
- [ ] Event subscribers mapped per service (who publishes, who subscribes)
- [ ] Idempotency enforced via event_id PRIMARY KEY
- [ ] Supabase Realtime channels configured for frontend subscriptions
- [ ] Supabase Edge Functions created for async notification workflows
- [ ] Failed event monitoring dashboard (query event_log WHERE status='failed')
- [ ] Row Level Security (RLS) policies on event_log table
- [ ] event-schemas.yaml passes user approval

### D1.4: Loan Calculation Logic Design
**Goal**: Document interest calculation, monthly repayment, late penalty logic, grace period reduction.
**Deliverables**:
- Interest formula: `Total Amount = (Phone Price - Deposit) × (1 + Interest Rate)` where Interest Rate ∈ [0.25, 0.50]
- Monthly repayment formula: `Monthly Payment = Total Amount ÷ 8 months`
- Late penalty policy: No monetary penalty, future loan ineligibility instead
- Grace period logic: 15 days past due → trigger lock; reduce by 5 days on next late payment
- Commission calculation: 3-5% of device sale price (paid to distributor staff)
- Max loan enforcement: $500 cap regardless of credit score
- Repayment schedule generation (8 equal installments, due dates)

**Acceptance Criteria**:
- [ ] All formulas documented with examples
- [ ] Edge cases handled (early repayment, partial payments, overpayments)
- [ ] Grace period reduction logic clear (15 → 10 → 5 → 0)
- [ ] Commission calculation matches Fineract charge posting
- [ ] Calculation tests written (TDD: write tests before implementation)

### D1.5: Security & RBAC Design with Supabase Auth
**Goal**: Document authentication, authorization, session management, data protection using Supabase Auth and Row Level Security (RLS).
**Deliverables**:
- **Supabase Auth Integration**:
  - Email/password authentication for admin and distributor portals
  - JWT tokens automatically managed by Supabase (refresh token rotation)
  - Session management with configurable timeout (30min distributor, 2hr admin, 1hr CS)
  - Multi-factor authentication (MFA) for admin users (Super Admin, Financial Ops)
- **Row Level Security (RLS) for RBAC**:
  - PostgreSQL RLS policies enforce access control at database level
  - User roles stored in `admin_users` table: `role` enum (super_admin, financial_ops, risk_compliance, customer_support)
  - RLS policies check `auth.uid()` and `auth.jwt() -> 'role'` claim
  - Example RLS policy: `CREATE POLICY admin_read ON audit_logs FOR SELECT USING (auth.jwt()->>'role' IN ('super_admin', 'risk_compliance'));`
- **RBAC Matrix** (enforced via RLS policies):
  - **Super Admin**: Full access to all tables (no RLS restrictions)
  - **Financial Ops**: Read/write financial reports, payment_reconciliations, distributor_commissions; Read-only loans, transactions
  - **Risk/Compliance**: Read-only audit_logs, kyc_cache, support_tickets; Write risk score overrides
  - **Customer Support**: Read/write support_tickets, extension requests; Read-only customer data (no PII edit)
- **Data Encryption**:
  - Supabase PostgreSQL: Encryption at rest (AES-256)
  - TLS 1.3 in transit for all connections
  - Supabase Storage: Server-side encryption for files (KYC docs, commission PDFs)
- **Audit Logging**:
  - `audit_logs` table with RLS: user_id (auth.uid()), action, resource, timestamp, IP address
  - Automatic logging via PostgreSQL triggers on sensitive tables (admin_users, distributor_commissions, payment_reconciliations)
  - Supabase Auth logs: login attempts, failed authentications, password resets
- **Secrets Management**:
  - Supabase project settings for API keys (anon key, service_role key)
  - Environment variables for third-party APIs (Twilio, DIDIT, EcoCash, Omari)
  - Secrets rotation policy: 90 days (manual rotation for third-party keys, automatic for Supabase JWTs)

**Acceptance Criteria**:
- [ ] Supabase Auth configured with email/password for admin and distributor portals
- [ ] MFA enabled for Super Admin and Financial Ops roles
- [ ] RLS policies created for all 13 operational tables (4 roles × 20+ permissions)
- [ ] RBAC matrix documented with RLS policy examples
- [ ] Session timeout configured per role (30min, 1hr, 2hr)
- [ ] Audit log schema includes user_id, action, resource, timestamp, IP
- [ ] PostgreSQL triggers for automatic audit logging on sensitive tables
- [ ] Secrets rotation policy defined (90 days)
- [ ] TLS 1.3 enforced for all database connections
- [ ] Security design passes user approval

### D1.6: High-Priority Issue Resolution Design (`reliability-patterns.md`)
**Goal**: Design solutions for 10 high-priority issues identified in comprehensive analysis.
**Deliverables**:
- **Payment Gateway Race Conditions (FR-202 to FR-210)**:
  - Idempotency key design using transaction_id
  - payment_callbacks table schema with status tracking
  - Atomic SELECT FOR UPDATE operation flow
  - Duplicate detection algorithm
  - WhatsApp bot polling mechanism (5s intervals, 2min max)
  - Background reconciliation job (checks Pending payments >5min old)
  - Exponential backoff retry strategy: 1min, 5min, 15min, 1hr, 4hr (max 5 retries)

- **WhatsApp Session Expiry Management (FR-211 to FR-216)**:
  - Session restoration workflow after 24hr expiry
  - 7-day session data retention policy
  - WhatsApp template message integration (bypass 24hr window)
  - SMS fallback mechanism for critical notifications (loan approved, KYC rejected)
  - Session restoration UX: "Welcome back! You were completing [STEP]. Continue? (Yes/No)"

- **Duplicate Customer Detection (FR-217 to FR-222)**:
  - National ID as primary identifier (unique constraint)
  - Duplicate detection algorithm with loan status checks
  - Phone number update workflow (send confirmation to BOTH numbers)
  - Manual verification flagging (2+ different phones = stolen ID risk)
  - Block logic: Active loan → block new app, Defaulted → block, Completed → allow

- **Asset Lock Grace Period Reduction (FR-223 to FR-227)**:
  - customer_payment_history tracking (count late payments >7 days across all loans)
  - Grace period formula: 0-1 late = 15 days, 2-3 = 12 days, 4-5 = 10 days, 6+ = 7 days
  - grace_period_days field in loan record (calculated at loan creation)
  - Lock trigger logic: days_overdue >= grace_period_days
  - Customer transparency: Display grace period at loan approval

- **Next of Kin Verification (FR-228 to FR-234)**:
  - SMS verification workflow: Send "Reply YES to confirm" to Next of Kin
  - next_of_kin table with verification_status: Pending/Verified/Failed
  - 24-hour verification window
  - Loan approval requirement: At least 1 Next of Kin must verify
  - Retry workflow: After 3 failed attempts → escalate to manual CS review
  - Default recovery: Contact only Verified contacts first

- **Distributor Deactivation Workflow (FR-235 to FR-241)**:
  - Deactivation types: Immediate (fraud) vs Graceful (30-day notice)
  - Pre-deactivation checks: active loans count, pending commissions, inventory count
  - Immediate: Forfeit commissions, reassign loans to nearest distributor, require inventory return in 7 days
  - Graceful: Pay commissions, allow pending handovers, transfer inventory
  - Loan reassignment algorithm (find nearest active distributor)
  - 7-year data archival (RBZ compliance)

- **Payment Reconciliation Failure Handling (FR-242 to FR-248)**:
  - Two-phase commit: Phase 1 = Gateway_Confirmed, Phase 2 = Fineract_Confirmed
  - payment_reconciliations table with status: Failed/Manual_Review_Required
  - Retry logic with exponential backoff (5 attempts)
  - Background job (runs every 6 hours): query Fineract, compare with payments table, auto-resolve matches
  - Admin dashboard: List unreconciled payments >24hrs old with one-click manual reconciliation
  - Customer notification: "Payment received. Confirmation pending within 24hrs."

- **Commission Immutability (FR-197 to FR-201)**:
  - Commission is FINAL once handover occurs
  - Returns, defaults, repossessions do NOT affect commission
  - Only scenario without commission: Loan cancelled BEFORE handover
  - Dispute window: 7 days from commission statement receipt
  - Business rationale: Distributor fulfilled duty at handover, post-handover risk is Lynia Finance's

- **WhatsApp Rate Limiting (FR-249 to FR-255)**:
  - Token bucket rate limiter: 70 messages/second (safe margin below 80/sec limit)
  - Priority-based queuing: Priority 1 (2s timeout) → Priority 2 (30s) → Priority 3 (5min) → Priority 4 (1hr)
  - Separate SQS queues per priority
  - Batch notification spreading: 800 reminders over 15-min window (8:00-8:15 AM)
  - CloudWatch alarm: Priority 1 queue depth >100 for >2 minutes
  - Monitoring dashboard: messages/sec, success rate, avg latency

- **ML Model Versioning & Rollback (FR-256 to FR-264)**:
  - model_versions table: version_id, model_file_path (S3), training_date, accuracy_metrics, status (Draft/Active/Retired)
  - A/B testing strategy: 10% traffic to new model, 90% to current Active (2-week test period)
  - Monitoring: approval rate, predicted default rate, actual default rate (tracked in Fineract)
  - Promotion logic: If metrics acceptable → promote to Active (100% traffic)
  - Rollback: One-click in admin portal (mark current as Retired, promote previous Active)
  - Prediction logging: customer_id, model_version, input_features, prediction, timestamp
  - Finance manager approval required before A/B test begins

**Acceptance Criteria**:
- [ ] All 10 high-priority issue solutions designed with detailed workflows
- [ ] Database schema changes documented (payment_callbacks, next_of_kin, model_versions)
- [ ] Retry/backoff strategies defined with specific timeouts
- [ ] Admin workflows designed (manual reconciliation, distributor deactivation, ML rollback)
- [ ] Customer-facing UX defined (session restoration, grace period transparency)
- [ ] Monitoring and alerting requirements specified
- [ ] reliability-patterns.md passes user approval

### D1.7: Observability & Monitoring Design
**Goal**: Define logging, metrics, tracing, alerting strategy.
**Deliverables**:
- **Logging**: Winston structured logs (JSON) → CloudWatch Logs
  - Log levels: ERROR, WARN, INFO, DEBUG
  - Correlation ID per request (trace WhatsApp conversation → Fineract API call)
- **Metrics**: CloudWatch custom metrics
  - Loan approval rate (approved / total applications)
  - Payment success rate (successful / total payments)
  - WhatsApp response time (p50, p95, p99)
  - Fineract API response time
  - Asset lock trigger count
  - Inventory stock level (low stock alerts)
- **Tracing**: AWS X-Ray
  - Trace WhatsApp message → KYC → Scoring → Fineract loan creation
  - Trace payment callback → Fineract repayment posting
- **Alerting**: CloudWatch Alarms
  - Payment success rate < 90% (5min window)
  - Fineract API error rate > 5% (5min window)
  - WhatsApp response time > 3s p95 (10min window)
  - Low inventory stock (< 5 units per distributor)
  - WhatsApp Priority 1 queue depth > 100 for >2 minutes (FR-254)
  - Payment reconciliation failures > 10 unresolved (>24hrs old)
  - ML model default rate > 15% (weekly check)
  - Next of Kin verification rate < 50% (daily check)

**Acceptance Criteria**:
- [ ] All services emit structured logs with correlation ID
- [ ] Custom metrics defined for 10+ business KPIs
- [ ] X-Ray tracing configured for critical flows
- [ ] CloudWatch Alarms configured for 8+ failure scenarios
- [ ] Observability design passes user approval

### D1.8: Developer Quickstart (`quickstart.md`) - YC Bootstrap
**Goal**: Enable new developers to run local environment, execute tests, deploy services to AWS Lambda/Cloudflare.
**Deliverables**:
- **Local development setup** (Docker Compose for Fineract + PostgreSQL only, no Redis needed)
- **Supabase CLI** setup for local Supabase development (supabase start for local PostgreSQL + Auth + Realtime + Edge Functions)
- Environment variable configuration (.env.example with Supabase project URL, anon key, service role key, WhatsApp Cloud API token, Africa's Talk API key)
- Running backend services locally (npm run dev per Lambda function using serverless-offline plugin)
- Running Cloudflare Workers locally (wrangler dev for scoring-service)
- Running Next.js frontends locally (npm run dev with Supabase client)
- Running tests (npm test, contract tests, E2E tests)
- **Deploying to AWS Lambda** (serverless deploy or sam deploy)
- **Deploying to Cloudflare Workers** (wrangler publish)
- **Deploying Supabase Edge Functions** (supabase functions deploy)
- Troubleshooting guide (common errors, log locations, Supabase dashboard, CloudWatch Logs)

**Acceptance Criteria**:
- [ ] Developer can start local environment in <10 minutes (Supabase CLI + Docker Compose)
- [ ] All services start successfully (Fineract Docker, Supabase local, Lambda functions via serverless-offline)
- [ ] Tests run successfully (unit, integration, contract)
- [ ] Deployment to staging environment works
- [ ] quickstart.md passes user approval

**Design Phase Duration**: 4-5 weeks (sequential after research)

---

## Phase 2: Implementation Roadmap

**Objective**: Deliver production-ready Lynia Finance platform in 12 milestones over 28 weeks.

### Milestone 1: Infrastructure & Foundational Services (Weeks 1-2) - YC Bootstrap
**Deliverables**:
- **AWS Lambda Functions** (5 microservices: whatsapp, kyc, payment, lock, scoring) - Serverless Framework or SAM
- **Cloudflare Workers** (ML scoring service with Pyodide Python WASM)
- **AWS EC2 t3.micro FREE Tier** - Apache Fineract Docker container connected to Supabase PostgreSQL
- **Supabase FREE Tier** - PostgreSQL schema (unified Fineract + operational data), Auth (JWT + RLS), Realtime, Storage, Edge Functions
- **Supabase Edge Functions** (6 functions: weekly-commission-batch, payment-reconciliation, daily-reminders, low-stock-alerts, send-sms, send-email)
- **Event Architecture** - PostgreSQL triggers + pg_notify() + event_log table (replaces SNS/SQS)
- Shared libraries (Supabase client, auth helpers, validation, observability) implemented with tests
- CI/CD pipeline configured (GitHub Actions: test → build → deploy to Lambda/Cloudflare/Vercel)

**Acceptance Criteria**:
- [ ] All AWS Lambda functions deployed successfully (5 microservices)
- [ ] Cloudflare Worker deployed for ML scoring (Pyodide + scikit-learn WASM)
- [ ] AWS EC2 t3.micro running Apache Fineract + Docker Compose connected to Supabase PostgreSQL
- [ ] Supabase PostgreSQL schema deployed (unified: fineract_tenants, fineract_default, operational tables, event_log)
- [ ] Supabase Edge Functions deployed (6 serverless functions with cron schedules)
- [ ] PostgreSQL triggers fire pg_notify() events to event_log table
- [ ] Supabase Realtime subscriptions work for inventory table changes
- [ ] Fineract accessible via REST API on EC2 (test loan product created)
- [ ] Shared libraries pass unit tests (>90% coverage)
- [ ] CI/CD pipeline deploys Lambda function to staging successfully
- [ ] **Cost verification**: <$5/month total infrastructure cost

### Milestone 2: Fineract Gateway Service (Weeks 3-4)
**Deliverables**:
- Fineract API client implementation (loan creation, repayment posting, account queries)
- Rate limiting (token bucket: 100 req/min, burst 20)
- DTO mappers (Supabase entities ↔ Fineract entities)
- Interest calculation (25-50% flat, simple interest formula)
- Contract tests (Fineract API response schemas)
- Integration tests (loan lifecycle: create → disburse → repay → close)

**Acceptance Criteria**:
- [ ] Successfully create loan account via Fineract API
- [ ] Post repayment and verify Fineract balance update
- [ ] Rate limiting enforces 100 req/min limit
- [ ] Contract tests pass for 10+ Fineract endpoints
- [ ] Integration tests cover full loan lifecycle

### Milestone 3: WhatsApp Service (Weeks 5-7) - YC Bootstrap with WhatsApp Cloud API
**Deliverables**:
- **WhatsApp Cloud API (Meta) integration** (AWS Lambda Node.js handler, webhook configuration, message templates)
- Message template approval workflow with Meta (greeting, terms, menu, KYC prompts, phone list, payment link)
- Conversation state management (Supabase PostgreSQL: 24hr expiry via pg_cron or Edge Function)
- Menu navigation (4 options: Buy Phone, Make Payment, Check Balance, Talk to CS)
- KYC data collection (ID, phone, income, employment, next of kin)
- Phone format validation (both +263 and 07X formats)
- ID format validation (XX-XXXXXXAXX)
- USSD payment link generation (EcoCash/Omari handoff)
- Integration tests (E2E WhatsApp journeys: greeting → KYC → qualification → payment)
- **Cost optimization**: 1000 conversations/month FREE (sufficient for Months 1-3)

**Acceptance Criteria**:
- [ ] WhatsApp Cloud API webhook receives messages successfully
- [ ] Message templates approved by Meta Business Manager
- [ ] WhatsApp bot responds to messages <2s p95
- [ ] Conversation state persists correctly in Supabase (24hr expiry works)
- [ ] All 4 menu options functional
- [ ] KYC data validation works (ID format, phone format)
- [ ] USSD payment link generates successfully
- [ ] E2E tests pass for 3+ customer journeys
- [ ] **Cost verification**: $0/month for WhatsApp (under 1000 conversations)

### Milestone 4: KYC & Hybrid Scoring Services (Weeks 6-7)
**Deliverables**:
- KYC service (DIDIT API integration, Zimbabwe national ID verification, liveness detection, ID format validation, flagging logic, Redis caching)
- DIDIT SDK/REST client implementation (authentication, request/response handling)
- Selfie capture and document upload workflow (via WhatsApp or web form)
- **Hybrid Scoring Service** implementation:
  - Apache Fineract Scorecard API integration (baseline scoring)
  - Fineract scorecard configuration (KYC completeness, Next of Kin, employment, deposit %, loan amount)
  - In-house ML model (Python FastAPI/Flask service for behavioral scoring)
  - ML feature extraction from KYC data (income, employment stability, DIDIT liveness score)
  - Hybrid scoring logic: Fineract baseline (0-100) + ML adjustment (-20 to +20) = final score
  - Score-based loan tiers: 60-70=$200, 71-85=$350, 86-100=$500
  - Cold start handling: Fineract scorecard only until 100+ loans disbursed
  - Model retraining pipeline (monthly retraining on payment history data)
- Duplicate detection logic (flag if phone + ID exists)
- Next of kin validation (no external verification required)
- Contract tests (DIDIT API, Fineract Scorecard API, ML Scoring API)
- Integration tests (KYC → Scoring → Fineract loan approval)

**Acceptance Criteria**:
- [ ] KYC service verifies Zimbabwe national ID via DIDIT API
- [ ] Liveness detection (selfie verification) works correctly
- [ ] Flagged IDs (stolen, fake, expired, biometric mismatch) block loan application
- [ ] Fineract Scorecard API scores test customer and returns baseline score (0-100)
- [ ] ML scoring service (Python API) scores test customer and returns adjustment factor
- [ ] Hybrid scoring combines Fineract + ML scores correctly
- [ ] Max loan calculated using score-based tiers (capped at $500)
- [ ] Cold start mode uses Fineract scorecard only
- [ ] Duplicate detection works (phone + ID check)
- [ ] DIDIT webhooks handled for async verification results
- [ ] Integration test: KYC → Hybrid Scoring → Loan approval flow

### Milestone 5: Payment Service (Weeks 8-9)
**Deliverables**:
- EcoCash SDK integration (payment initiation, webhook callbacks)
- Omari SDK integration (payment initiation, webhook callbacks)
- Circuit breaker (30s timeout, trip after 3 failures, block payments)
- Webhook endpoint (signature verification, idempotency, Fineract repayment posting)
- Reconciliation workflow (support ticket for mismatches)
- Integration tests (payment initiation → callback → Fineract posting)

**Acceptance Criteria**:
- [ ] EcoCash payment initiation works
- [ ] Omari payment initiation works
- [ ] Circuit breaker trips after 3 EcoCash failures
- [ ] Webhook posts repayment to Fineract successfully
- [ ] Reconciliation creates support ticket for mismatches
- [ ] Integration tests cover both gateways + callbacks

### Milestone 6: Notification Service via Supabase Edge Functions (Weeks 8-9) - YC Bootstrap
**Deliverables**:
- **Supabase Edge Functions** for notifications (send-sms.ts, send-email.ts) - Deno TypeScript
- **Africa's Talk SMS integration** (Zimbabwe-optimized, $0.008/SMS vs Twilio $0.05/SMS)
- **Email via Resend API** (100 emails/day FREE, better than SendGrid free tier 100/day but simpler API)
- Notification templates (loan approval, payment reminder, payment received, overdue warning)
- **PostgreSQL trigger + pg_notify()** event subscriber (listen to loan.approved, payment.received, repayment.overdue)
- Unit tests (template rendering, Edge Function handlers)
- Integration tests (PostgreSQL trigger → pg_notify → Edge Function → SMS/email sent)
- **Cost optimization**: Africa's Talk SMS $0.008/SMS, Resend 100 emails/day FREE

**Acceptance Criteria**:
- [ ] Email notifications send successfully via Resend API from Edge Functions
- [ ] SMS notifications send successfully via Africa's Talk from Edge Functions
- [ ] All 4 notification templates render correctly
- [ ] PostgreSQL triggers fire pg_notify() events for loan.approved, payment.received, repayment.overdue
- [ ] Supabase Edge Functions subscribe to pg_notify() channels and send notifications
- [ ] Integration tests verify end-to-end notification flow (trigger → notify → Edge Function → SMS/email)
- [ ] **Cost verification**: <$1/month for SMS (assuming 100 SMS/month @ $0.008 each = $0.80)

### Milestone 7: Inventory Service with Supabase Realtime (Weeks 10-11) - YC Bootstrap
**Deliverables**:
- Consignment inventory tracking (IMEI-level tracking, Lynia Finance ownership, distributor location tracking) in Supabase PostgreSQL
- Inventory CRUD APIs (AWS Lambda functions: create, read by location, update status, handover recording)
- Tentative customer selection storage (WhatsApp bot integration, non-binding selections)
- Phone handover workflow (IMEI scan, availability verification, status update to HandedOver, commission calculation trigger)
- **Supabase Realtime** for real-time inventory sync <100ms (replaces custom WebSocket server, FREE up to 200 concurrent connections)
- Stock transfer workflow (admin approval required for inter-distributor transfers)
- Low stock alerts via **Supabase Edge Function cron** (low-stock-alerts.ts checks inventory daily, sends SMS via Africa's Talk)
- Integration tests (Supabase Realtime subscriptions, handover flow, stock transfer approval)

**Acceptance Criteria**:
- [ ] Each phone tracked individually by IMEI
- [ ] Inventory ownership always "Lynia Finance"
- [ ] Tentative selections stored without reservation
- [ ] Handover workflow updates status and triggers commission event
- [ ] WebSocket broadcasts inventory events <1s
- [ ] Stock transfer requires admin approval
- [ ] Low stock alarm triggers at <5 units per location
- [ ] Integration tests cover WebSocket + handover + transfer workflows

### Milestone 8: Lock Service Integration (Weeks 10-11)
**Deliverables**:
- **Third-party lock provider API integration** (REST API client for selected provider)
- Lock/unlock command dispatch via provider API (lock, unlock, status check endpoints)
- Provider webhook handler (device status updates: locked, unlocked, tampered, offline)
- 15-day past due trigger (listen to repayment.overdue event)
- Grace period reduction logic (reduce by 5 days on subsequent late payments)
- Device registry (device_id, customer_id, lock_status, provider_device_id, last_sync_timestamp)
- Device onboarding workflow (register devices with provider during handover)
- Command queue (lock_commands table: dispatched, confirmed, failed, retried)
- Retry logic (exponential backoff for failed lock commands, max 3 retries)
- Fallback handling (alert CS if API down, manual lock via provider dashboard)
- Contract tests (provider API lock/unlock endpoints, webhook schemas)
- Integration tests (overdue → lock trigger → API call → webhook confirmation)

**Acceptance Criteria**:
- [ ] Lock service successfully calls provider API to lock device
- [ ] Lock service successfully calls provider API to unlock device
- [ ] 15-day past due trigger works correctly
- [ ] Grace period reduces by 5 days on next late payment (stored in database)
- [ ] Provider webhooks handled correctly (status updates persist to database)
- [ ] Device registration works during phone handover flow
- [ ] Command retry logic triggers on API failures
- [ ] Fallback alerts CS when provider API unavailable
- [ ] Contract tests pass for provider API endpoints
- [ ] Integration tests verify: overdue event → lock trigger → API call → webhook → status update

### Milestone 9: Device Lock Provider Integration & Pre-Installation (Weeks 12-13)
**Deliverables**:
- **Finalize lock provider selection** based on Phase 0 R0.7 evaluation (provider contract signed, API credentials obtained)
- **Production API integration** (move from sandbox to production environment)
- **Device pre-installation workflow** with provider:
  - Coordinate with phone suppliers for provider app pre-installation
  - First-boot activation flow (customer accepts terms, device registers with provider)
  - Fallback: Manual app installation via Google Play Store + activation
- **Device registration process** during distributor handover:
  - Scan device IMEI/serial number
  - Register device with provider API (associate customer_id with provider_device_id)
  - Test lock/unlock via distributor dashboard
- **Provider dashboard access** for CS and Admin users (manual lock/unlock, device monitoring)
- **Monitoring & alerting**: Device offline detection, failed lock attempts, tamper alerts
- **Documentation**: Device onboarding runbook, CS escalation procedures, provider SLA terms
- **Training materials**: Distributor staff training on device registration, CS agent training on manual lock procedures

**Acceptance Criteria**:
- [ ] Lock provider contract signed and production API access granted
- [ ] Device pre-installation process established with phone suppliers
- [ ] Successfully register 10+ test devices with provider during pilot handovers
- [ ] Lock/unlock commands work via production API (command latency <30s)
- [ ] Provider webhooks deliver status updates to lock-service in production
- [ ] CS agents can manually lock/unlock devices via provider dashboard
- [ ] Monitoring alerts trigger for offline devices and failed lock attempts
- [ ] Distributor staff and CS agents trained on device registration and lock procedures
- [ ] Device onboarding runbook reviewed and approved

### Milestone 10: Admin Service & Portal (Weeks 14-16)
**Deliverables**:
- Admin service APIs (system monitoring, financial reporting, distributor management, compliance reports)
- Weekly commission batch processing (Monday 9 AM cron job, aggregate Pending commissions, generate statements)
- Commission approval workflow (admin review, approve/hold/dispute actions, payment initiation)
- Commission payment processing (EcoCash/bank transfer integration, retry logic for failures)
- Commission adjustment APIs (manual increase/decrease with audit logging)
- Inventory reconciliation management (review discrepancies, approve shrinkage charges, offset against commissions)
- RBAC implementation (4 admin roles with permissions enforcement)
- Distributor deactivation workflow (reassign transactions)
- RBZ FIU compliance reports (7-year retention, audit logs)
- Admin portal (Next.js 14: dashboard, reporting, distributor management, compliance, commission management dashboard, inventory reconciliation review)
- Playwright E2E tests (admin login, report generation, commission approval, distributor deactivation)

**Acceptance Criteria**:
- [ ] All admin APIs functional (30+ endpoints including commission management)
- [ ] Weekly commission batch runs every Monday 9 AM
- [ ] Commission approval workflow enforces admin review
- [ ] Commission payments processed via EcoCash/bank transfer
- [ ] Shrinkage charges automatically offset against commissions
- [ ] RBAC enforces role permissions (4 roles tested)
- [ ] Distributor deactivation reassigns transactions
- [ ] Compliance reports generate successfully
- [ ] Admin portal loads <2s
- [ ] Commission management dashboard shows pending/paid commissions
- [ ] E2E tests pass for 8+ admin workflows (including commission approval)

### Milestone 11: Customer Service Portal & Distributor Dashboard (Weeks 17-19)
**Deliverables**:
- CS service APIs (ticket management, escalation, dispute resolution, commission dispute handling)
- Ticket assignment logic (round-robin with priority)
- Extension approval logic (history + risk score)
- CS portal (Next.js 14: ticket management, customer data view, extension approval, commission dispute resolution)
- Distributor dashboard (Next.js 14: inventory management, customer verification, payment confirmation, WebSocket inventory sync, commission history view, monthly reconciliation submission)
- Commission history view (last 6 months, pending/paid status, payment dates, transaction details, PDF download)
- Commission dispute submission (within 7 days of payment, expected vs actual amounts, CS ticket creation)
- Monthly inventory reconciliation workflow (1st-5th of month, physical count entry, photo upload, discrepancy review)
- Playwright E2E tests (CS ticket flow, distributor inventory management, commission history, reconciliation submission)

**Acceptance Criteria**:
- [ ] CS service APIs functional (18+ endpoints including commission disputes)
- [ ] Ticket assignment works (round-robin with priority)
- [ ] Extension approval logic enforced (history + risk score)
- [ ] CS portal loads <2s
- [ ] Distributor dashboard loads <1.5s
- [ ] WebSocket inventory sync <1s latency
- [ ] Commission history shows last 6 months
- [ ] Commission dispute creates CS ticket
- [ ] Monthly reconciliation workflow enforced (1st-5th)
- [ ] E2E tests pass for CS and distributor workflows (including commission features)

### Milestone 12: Integration Testing, Security Hardening, Deployment (Weeks 20-28)
**Deliverables**:
- End-to-end integration tests (full customer journey: WhatsApp → KYC → Scoring → Loan → Payment → Repayment → Lock)
- Load testing (200-500 daily WhatsApp conversations, 100 active loans, 50 concurrent distributor users)
- Security audit (penetration testing, vulnerability scanning, secrets rotation)
- Data migration scripts (if migrating from existing system)
- Production deployment (ECS task definitions, RDS snapshots, CloudWatch dashboards)
- Runbooks (incident response, rollback procedures, scaling procedures)
- User training (distributor staff, admin users, CS users)
- Go-live checklist (DNS, SSL certificates, payment gateway production credentials)

**Acceptance Criteria**:
- [ ] E2E integration tests pass (10+ full customer journeys)
- [ ] Load tests meet performance goals (WhatsApp <2s p95, dashboard <1.5s)
- [ ] Security audit passes (no critical vulnerabilities)
- [ ] Production environment deployed successfully
- [ ] Runbooks reviewed and approved
- [ ] User training completed (3 user groups)
- [ ] Go-live checklist 100% complete

**Total Implementation Duration**: 28 weeks (7 months)

---

## Key Technical Decisions

| Decision | Rationale (YC Bootstrap Cost-Optimized) | Alternative Rejected |
|----------|-----------|----------------------|
| Apache Fineract as core loan management | Proven loan lifecycle management, repayment scheduling, REST API extensibility, **PostgreSQL support since v1.6.x enables Supabase integration** | Custom loan engine (higher risk, longer dev time) |
| **PostgreSQL triggers + pg_notify() + event_log** for event architecture | **Native PostgreSQL pub/sub**, zero cost (part of Supabase free tier), no external message queue, reliable message delivery via event_log table for replay | AWS SNS/SQS ($0.50/1M messages, adds complexity), Redis Pub/Sub (lose message durability), Kafka (operational overhead) |
| **Supabase FREE Tier** (PostgreSQL, Auth, Realtime, Edge Functions, Storage) | **97% cost reduction** (unified platform, 500MB DB + 1GB storage + 500K Edge Function invocations FREE), Auth + RLS eliminates custom JWT middleware, Realtime replaces WebSocket server | AWS RDS + ElastiCache + SNS/SQS + custom auth ($100+/month), separate services increase complexity |
| **AWS Lambda FREE Tier** for microservices | **1M requests/month FREE forever**, pay-per-use (no idle costs), auto-scaling, sufficient for 500 users in Month 12 (215K requests/month estimated) | Railway/Render ($50/month for 5 services), AWS ECS Fargate ($60/month), Fly.io ($35/month) |
| **WhatsApp Cloud API (Meta) FREE Tier** | **1000 conversations/month FREE** (sufficient for Months 1-3 MVP), official Meta provider, no Twilio markup, simpler pricing | Twilio WhatsApp ($0.005/message = $75/month for 500 users), Direct Business API (complex setup) |
| **Africa's Talk SMS** for Zimbabwe | **$0.008/SMS vs Twilio $0.05/SMS** (6x cheaper), Zimbabwe-optimized routing, reliable delivery for Next of Kin verification | Twilio SMS ($5/month for 100 SMS), Generic SMS providers (poor Zimbabwe coverage) |
| **Cloudflare Workers FREE Tier** for ML scoring | **100K requests/day FREE** (3M/month), Pyodide enables Python ML models in WASM, <10ms cold start, global edge network | Railway Python service ($15/month), AWS Lambda Python (slower cold start, vendor lock-in) |
| **AWS EC2 t3.micro FREE Tier** for Apache Fineract (Year 1) | **750 hours/month FREE** (24/7 uptime), 1GB RAM sufficient for <500 loans, easy migration to t3.small Year 2 ($8/month reserved instance) | Railway Docker ($15/month), Render Docker ($7/month), AWS ECS Fargate ($30/month) |
| Hybrid credit scoring (Fineract Scorecard + In-house ML) | Fineract provides baseline scoring infrastructure, in-house ML enables continuous improvement from payment data, targets underbanked without credit bureau, **scikit-learn WASM on Cloudflare FREE** | Third-party scoring API (expensive $0.10/request, not customizable), Rules-based only (no learning from data) |
| DIDIT for KYC verification | Zimbabwe-specific ID verification, liveness detection, biometric matching, RBZ compliance | Manual ID verification (fraud risk), Generic KYC APIs (limited Zimbabwe support) |
| **Vercel FREE Tier** for Next.js frontends | **100GB bandwidth/month FREE**, automatic HTTPS, global CDN, unlimited deployments, integrates with Supabase Auth out-of-box | Netlify (50GB/month), AWS Amplify ($0.15/GB = $15/month for 100GB), self-hosted ($20/month) |
| Dual payment gateways (EcoCash + Omari) | Redundancy, customer choice, higher success rate | Single gateway (single point of failure) |
| Circuit breaker pattern for payments | Prevent cascade failures, block payments during gateway outages | Unlimited retries (DDoS risk, customer confusion) |
| Third-party device lock provider (API-based) | Specialized lending app lock solutions, proven at scale, pre-installation support, API integration, Zimbabwe coverage, reduced development risk | Custom Android lock app (high dev cost, security risks, maintenance burden), Generic MDM (not lending-specific) |
| Token bucket rate limiting (100/min, burst 20) | Prevent Fineract overload, allow burst traffic | Fixed rate limit (poor UX during peak loads) |
| PostgreSQL conversation state (24hr expiry) | Simple state management, automatic cleanup via pg_cron or Supabase Edge Function | Redis only (lose durability for audit logs) |
| **Supabase Realtime** for inventory sync | **Real-time updates <100ms**, WebSocket subscriptions to PostgreSQL changes, **FREE up to 200 concurrent connections**, better UX for distributors, no custom WebSocket server needed | Custom WebSocket server (operational overhead), Polling (higher latency, higher server load) |
| **Supabase Auth + RLS** for RBAC | **Zero application code for authorization**, database-level security, JWT automatically managed, session refresh built-in, **FREE** with Supabase | Custom JWT middleware (security risks, maintenance burden), Auth0/Okta ($25/month for 1000 MAU), AWS Cognito ($0.0055/MAU = $3/month) |
| 4 admin roles (Super, Financial, Risk, CS) | Principle of least privilege, compliance audit trail | Single admin role (violates separation of duties) |
| 7-year data retention | RBZ FIU compliance requirement | Shorter retention (non-compliant) |
| TDD (tests first, then implementation) | Constitution mandate, reduces rework, ensures quality | Test after implementation (lower quality, more bugs) |

---

## YC Bootstrap Cost Optimization Summary

### Target Budget
- **Months 1-3 (MVP, <50 users)**: $0-5/month
- **Months 4-6 (Growth, 50-200 users)**: $5-15/month
- **Months 7-12 (Scale, 200-500 users)**: $15-25/month
- **Year 2+ (Post AWS free tier)**: <$40/month

### Cost Breakdown by Category

| Category | Service | Cost | Notes |
|----------|---------|------|-------|
| **Database** | Supabase PostgreSQL FREE Tier | $0 | 500MB (with optimization: compression, partitioning, archival) |
| **Authentication** | Supabase Auth FREE Tier | $0 | Unlimited users, JWT + RLS, MFA |
| **Real-time** | Supabase Realtime FREE Tier | $0 | 200 concurrent connections, WebSocket subscriptions |
| **Serverless Functions** | Supabase Edge Functions FREE Tier | $0 | 500K invocations/month (weekly commissions, daily reminders, notifications) |
| **Storage** | Supabase Storage FREE Tier | $0 | 1GB (commission PDFs, KYC docs, reconciliation photos) |
| **Compute** | AWS Lambda FREE Tier | $0 | 1M requests/month, 400K GB-seconds (5 microservices: whatsapp, kyc, payment, lock, scoring) |
| **Compute** | AWS EC2 t3.micro FREE Tier (Year 1) | $0 | 750 hours/month = 24/7 uptime (Apache Fineract) |
| **Compute** | AWS EC2 t3.micro Reserved (Year 2+) | $8/mo | After free tier expires |
| **ML Scoring** | Cloudflare Workers FREE Tier | $0 | 100K requests/day (Pyodide Python WASM, scikit-learn) |
| **WhatsApp** | WhatsApp Cloud API FREE Tier | $0 | 1000 conversations/month |
| **WhatsApp** | WhatsApp Cloud API Paid (Month 4+) | $5-15/mo | $0.005/conversation after 1000 free (1000-4000 conversations) |
| **SMS** | Africa's Talk | $0.80/mo | 100 SMS @ $0.008/SMS (Next of Kin verification) |
| **Email** | Resend FREE Tier | $0 | 100 emails/day = 3000/month (notifications, alerts) |
| **Frontend Hosting** | Vercel FREE Tier | $0 | 100GB bandwidth/month, unlimited deployments |
| **KYC** | DIDIT | $20/mo | ~200 verifications @ $0.10/verification |
| **Payments** | EcoCash + Omari | $0 | Pay-per-transaction (passed to customer) |
| **Device Lock** | Third-party provider | TBD | Typically $1-2/device/month |
| **Monitoring** | CloudWatch FREE Tier | $0 | 5GB ingestion, 10 custom metrics |
| **Domain** | .com domain | $1/mo | $12/year |

### **Total Monthly Costs**
- **Month 1-3**: $0-5 (only paid KYC for early users)
- **Month 4-6**: $5-15 (WhatsApp paid tier starts, more KYC)
- **Month 7-12**: $15-25 (increased WhatsApp usage, KYC, device lock)
- **Year 2+**: $29-40 (AWS EC2 $8/month + WhatsApp + KYC + device lock)

### Cost Savings vs Original Plan
- **Original Plan** (Railway + Supabase Pro + Twilio): ~$195/month
- **YC Bootstrap** (Free tiers + optimizations): ~$5-25/month (Year 1)
- **Savings**: 87-97% reduction

### Key Cost Optimization Strategies
1. **Free Tier Maximization**: Supabase FREE (500MB DB), AWS Lambda FREE (1M requests), AWS EC2 FREE (Year 1), Cloudflare Workers FREE (100K req/day)
2. **Supabase Platform Consolidation**: Single platform for DB + Auth + Realtime + Storage + Edge Functions (eliminates 5 separate AWS services)
3. **WhatsApp Cloud API**: 1000 conversations/month FREE (vs Twilio $75/month)
4. **Africa's Talk SMS**: $0.008/SMS vs Twilio $0.05/SMS (6x cheaper for Zimbabwe)
5. **Cloudflare Workers + Pyodide**: Python ML in WASM on edge (vs Railway Python $15/month)
6. **PostgreSQL Event Architecture**: Native pg_notify() (vs AWS SNS/SQS $0.50/1M messages)
7. **Vercel FREE Tier**: 100GB bandwidth (vs AWS Amplify $15/month)

### Detailed Cost Optimization Document
See [cost-optimization-COST-OPTIMIZATION.md](./cost-optimization-COST-OPTIMIZATION.md) for comprehensive cost analysis, migration strategy, code examples, and scaling plan.

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Fineract API rate limiting (100 req/min) | High | Token bucket with burst allowance (20 req), Supabase PostgreSQL queue for background jobs (event_log table), optimize API calls (batch where possible) |
| Payment gateway downtime | High | Dual gateways (EcoCash + Omari), circuit breaker blocks payments during outage, manual reconciliation workflow |
| WhatsApp message delivery failure | Medium | Retry mechanism (3 attempts, exponential backoff), fallback to SMS, conversation state persists for 24hrs |
| Device lock provider API downtime | High | Manual lock via provider dashboard, CS alert for urgent locks, retry mechanism (exponential backoff, 3 max retries), escalation to phone supplier for critical cases |
| Device tamper or provider app removal | High | Provider's tamper detection alerts, device offline monitoring, CS manual intervention, contractual phone recovery process with distributor |
| DIDIT KYC API downtime | Medium | Supabase PostgreSQL `kyc_cache` table (valid verifications persist 7 days), manual review workflow for urgent applications, webhook fallback for async processing |
| DIDIT rate limiting or quota exhaustion | Medium | Monitor daily verification quota, implement request queue with priority (urgent applications first), negotiate higher limits with DIDIT |
| In-house ML Scoring API downtime | Medium | Fallback to Fineract Scorecard only (baseline scoring), manual review for edge cases, conservative max loan ($200 instead of $500) |
| ML model performance degradation | Medium | Monitor prediction accuracy weekly, A/B test new models before deployment, maintain model versioning with rollback capability, retrain monthly on fresh payment data |
| Insufficient training data (cold start) | High | Use Fineract Scorecard only for first 100 loans, synthetic data augmentation, transfer learning from similar markets, manual underwriting for high-value loans |
| Database connection pool exhaustion | Medium | Supabase connection pooling (PgBouncer), slow query logging via Supabase dashboard, query optimization |
| AWS Lambda cold start latency | Medium | Provisioned concurrency for critical functions (whatsapp-service), optimize bundle size, use esbuild for faster cold starts |
| Supabase FREE Tier database limit (500MB) | High | Database compression (pg_compression), table partitioning by month, archival to AWS S3 Glacier (7-year retention), aggressive data cleanup (delete expired sessions daily) |
| Supabase FREE Tier storage limit (1GB) | Medium | Image compression (90% quality JPEG), PDF compression, file lifecycle policies (delete old commission PDFs after 90 days, archive KYC docs to S3 Glacier) |
| Supabase FREE Tier bandwidth limit (2GB/month) | Medium | Optimize Realtime subscriptions (filter to specific distributor_id), CDN caching for static assets via Vercel, minimize API response payloads |
| AWS Lambda FREE Tier exhaustion (1M req/month) | Low | Monitor CloudWatch metrics monthly, optimize Lambda invocations (batch operations), upgrade to paid tier only if needed (~$0.20 per 1M requests) |
| Cloudflare Workers execution limit (10ms CPU time) | Medium | Optimize Pyodide model loading (cache initialized runtime in global scope), use lightweight scikit-learn models (logistic regression instead of XGBoost), fallback to Fineract Scorecard if timeout |
| WhatsApp Cloud API FREE Tier exhaustion (1000 conversations) | High | Monitor Meta Business Manager analytics weekly, optimize conversation flows (reduce message count), upgrade to paid tier Month 4+ (~$5-15/month for 1000-4000 conversations) |
| Vendor lock-in (Supabase + AWS) | Medium | Use Supabase PostgreSQL wire protocol (portable to any PostgreSQL), containerize Lambda functions for portability, abstract Supabase SDK behind repository pattern |
| Compliance audit failure | High | Automated audit log validation, quarterly compliance report review, legal consultation |
| Data breach | Critical | Supabase RLS policies (database-level security), encryption at rest + in transit (TLS 1.3), secrets rotation (90 days), penetration testing, incident response plan |

---

## Success Criteria

### Functional
- [ ] Customer completes full WhatsApp journey (greeting → KYC → loan approval → payment → phone handover) in <10 minutes
- [ ] Distributor staff verifies customer ID and confirms payment in <2 minutes
- [ ] Admin generates RBZ FIU compliance report for previous month in <30 seconds
- [ ] Asset lock triggers automatically 15 days past due
- [ ] Payment gateway failover (EcoCash → Omari) occurs within 30 seconds

### Non-Functional
- [ ] WhatsApp message response time <2s p95 (AWS Lambda cold start <1s)
- [ ] Distributor dashboard loads <1.5s (Vercel CDN + Supabase Realtime)
- [ ] Admin portal loads <2s (Next.js SSR + Supabase Auth)
- [ ] Inventory sync latency <100ms (Supabase Realtime WebSocket subscriptions)
- [ ] Fineract API calls <500ms p95 (EC2 t3.micro to Supabase PostgreSQL)
- [ ] Payment gateway callbacks <3s p95 (Lambda webhook handler)
- [ ] System handles 500 daily WhatsApp conversations (within WhatsApp Cloud API 1000/month free tier for MVP)
- [ ] System handles 100 active loans concurrently (Supabase PostgreSQL 500MB sufficient)
- [ ] System handles 50 concurrent distributor users (Supabase Realtime 200 concurrent connections)

### Compliance
- [ ] All customer PII encrypted (at rest + in transit)
- [ ] Audit logs capture all admin actions (user_id, action, resource, timestamp, IP)
- [ ] Data retention policy enforced (7 years)
- [ ] KYC/AML procedures documented and followed
- [ ] RBZ FIU compliance reports generated monthly

### Operational
- [ ] CI/CD pipeline deploys Lambda functions in <5 minutes (serverless deploy)
- [ ] Supabase Edge Functions deploy in <2 minutes (supabase functions deploy)
- [ ] Rollback to previous Lambda version completes in <3 minutes (serverless rollback)
- [ ] CloudWatch dashboards display 20+ business/technical metrics
- [ ] Supabase dashboard shows database performance, auth metrics, realtime connections
- [ ] On-call runbooks cover 10+ incident scenarios
- [ ] User training completed for all 3 user groups (distributor, admin, CS)

### Cost Optimization (YC Bootstrap Specific)
- [ ] **Month 1-3**: Total infrastructure cost <$5/month (FREE tier only)
- [ ] **Month 4-6**: Total infrastructure cost <$15/month (WhatsApp paid tier starts)
- [ ] **Month 7-12**: Total infrastructure cost <$25/month (increased usage, device lock costs)
- [ ] **Year 2+**: Total infrastructure cost <$40/month (AWS EC2 reserved instance post free tier)
- [ ] Supabase database size <400MB (80% of 500MB FREE tier limit)
- [ ] Supabase storage <800MB (80% of 1GB FREE tier limit)
- [ ] AWS Lambda invocations <800K/month (80% of 1M FREE tier limit)
- [ ] WhatsApp conversations monitored weekly (alert at 800 of 1000 FREE tier)
- [ ] Cloudflare Workers requests <80K/day (80% of 100K/day FREE tier)

---

## Next Steps

1. **User Approval**: Review this implementation plan, provide feedback, approve to proceed.
2. **Phase 0 Execution**: Begin research tasks (R0.1-R0.10) in parallel where possible.
3. **Phase 1 Execution**: Complete design deliverables (D1.1-D1.7) sequentially, obtain user approval for data-model.md, contracts/, quickstart.md.
4. **Task Breakdown**: Run `/speckit.tasks` to generate detailed task breakdown (tasks.md) from this plan.
5. **Sprint Planning**: Organize Phase 2 milestones into 2-week sprints, assign to development team.

**Estimated Total Duration**: 35-37 weeks (research 3-4 weeks + design 4-5 weeks + implementation 28 weeks)

**Ready to proceed?** Please review and approve this plan, or request modifications before moving to Phase 0 research.
