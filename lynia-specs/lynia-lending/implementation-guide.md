# Implementation Guide

**For**: Lynia Finance Lynia Lending Platform
**Goal**: Implement platform following cost optimization strategy ($5-25/month Year 1)
**Date**: 2025-10-30
**Status**: Ready for Implementation

---

## Executive Summary

This guide consolidates all changes required to implement the Lynia Finance platform following the **cost optimization** approach. All specification documents have been updated to reflect:

1. **WhatsApp Cloud API (Meta)** instead of Twilio WhatsApp → **Saves $75/month**
2. **Africa's Talk SMS** instead of Twilio SMS → **Saves $4.20/month**
3. **AWS Lambda** for microservices instead of Railway/Fly.io → **Saves $50/month**
4. **AWS EC2 Free Tier** for Apache Fineract → **Saves $15/month (Year 1)**
5. **Supabase FREE Tier** with database optimization → **Saves $25/month**

**Total Year 1 Savings**: ~$169/month (~$2,028/year)
**Target Cost**: $5-10/month (Months 1-6), $15-25/month (Months 7-12), $30-40/month (Year 2+)

---

## Updated Specification Documents

### 1. [spec.md](./spec.md) - Functional Requirements

**Changes Made**:

✅ **FR-033a to FR-033h**: WhatsApp Cloud API (Meta) requirements
- WhatsApp Business API access token authentication
- Meta Graph API v18.0 message sending
- Conversation window tracking (24hr free sessions)
- Message templates for notifications
- Rate limiting (80 msg/sec per phone number)

✅ **FR-052a to FR-052g**: Africa's Talk SMS integration requirements
- Africa's Talk REST API authentication
- SMS sending via POST /version1/messaging
- Sender ID "LYNIA" registration
- Delivery callbacks for tracking
- Cost logging ($0.008/SMS)

**Impact**: All user stories (US1-US8) now reference WhatsApp Cloud API and Africa's Talk instead of Twilio.

---

### 2. [tasks.md](./tasks.md) - Implementation Tasks

**Changes Made**:

✅ **R0.2: WhatsApp Cloud API Research** (T007-T012, T012a-T012b)
- Replaced Twilio WhatsApp research tasks
- Added Meta Business Account setup
- Added WhatsApp Cloud API webhook verification
- Added cost comparison documentation

✅ **R0.3a: Africa's Talk SMS Research** (T018a-T018g)
- New research section for Africa's Talk
- SMS API research, authentication, sender ID registration
- Cost comparison vs Twilio

✅ **R0.8: AWS Free Tier Research** (T049a-T049j)
- AWS Lambda always-free tier research (1M requests/month)
- AWS EC2 t3.micro free tier (750 hrs/month Year 1)
- AWS API Gateway free tier
- Cold start mitigation strategies
- Apache Fineract EC2 deployment planning

✅ **Phase 2: Foundation - Updated Database Architecture**
- Database section now specifies Supabase FREE tier (500MB limit)
- Table compression (LZ4), partitioning (monthly), retention policies
- Microservices section updated to AWS Lambda deployment

✅ **Phase 3: US1 Implementation - WhatsApp Cloud API Integration**
- T180-T180c: WhatsApp Cloud API client, webhook verification, message sending
- T180a: Conversation window tracking (24hr sessions)
- T188a: Rate limiting (80 msg/sec)
- T197a-T197b: Africa's Talk SMS client, authentication
- T198a-T198b: Africa's Talk delivery callbacks, cost logging

✅ **Phase 13: Infrastructure & Deployment - AWS Lambda + EC2**
- T397-T397i: AWS SAM template for Lambda deployment (5 functions)
- T398-T398h: EC2 t3.micro for Apache Fineract with Docker Compose
- T399-T399b: Local development with LocalStack
- T400-T400d: CI/CD pipeline (GitHub Actions)
- T401-T401b: Supabase database size monitoring and archival

**Impact**: 60+ new tasks added, 30+ tasks updated with cost optimization optimizations.

---

### 3. [supabase-architecture.md](./supabase-architecture.md) - Database & Platform

**Changes Made**:

✅ **Cost Comparison Section** - Added cost optimization tier
- Original: $462/month
- Supabase-First: $75/month
- **cost optimization**: $5.80-10.80/month (Year 1), $24.80-35.80/month (Year 2+)

✅ **Database Optimization for FREE Tier (500MB Limit)** - New Section
- **Compression Strategies**: LZ4 compression on large tables
- **Table Partitioning**: Monthly partitions for event_log
- **Event Log Retention**: 90-day retention policy (cleanup old events)
- **WhatsApp Session Cleanup**: 7-day retention (expired sessions deleted)
- **Estimated Database Growth**: Year 1 (~100MB), Year 2 (~450MB), Year 3 (~800MB → upgrade needed)
- **Monitoring**: Database size alerts at 400MB (80% of limit)
- **7-Year Archival**: Export to AWS S3 Glacier ($0.004/GB/month)

✅ **Acceptance Criteria** - Updated with cost optimization validations
- WhatsApp Cloud API integration verified
- Africa's Talk SMS integration verified
- AWS Lambda deployment for 5 microservices
- AWS EC2 t3.micro for Fineract
- Database optimization enabled
- Cost validated: <$15/month Year 1

**Impact**: Platform now designed to stay on Supabase FREE tier for 2+ years with aggressive optimization.

---

### 4. [plan.md](./plan.md) - Timeline & Architecture

**Changes Made**:

✅ **Technical Context** - Updated service providers
- WhatsApp Cloud API (Meta, 1000 conversations/month FREE)
- Africa's Talk SMS ($0.008/SMS vs Twilio $0.05/SMS)
- AWS Lambda (1M requests/month FREE forever)
- AWS EC2 t3.micro (750hrs/month Year 1 FREE)

✅ **Target Costs** - Updated budget
- Months 1-3: $0-5/month
- Months 4-6: $5-15/month
- Months 7-12: $15-25/month
- Year 2: <$40/month

**Impact**: Plan now reflects realistic cost optimization budget for pre-revenue startup.

---

### 5. [cost-optimization.md](./cost-optimization.md) - Cost Strategy

**Already Exists** - No Changes Needed

This document was the source of truth for all changes. It contains:
- Detailed cost breakdown by service
- Week-by-week action plan
- Provider comparison tables
- Code examples for WhatsApp Cloud API, Africa's Talk, AWS Lambda
- Risk mitigation strategies

**Impact**: Blueprint for all cost optimization decisions.

---

## Implementation Roadmap (Spec-Kit Compliant)

### Week 1-3: Research Phase (Phase 0)

**Goal**: Validate all free tier providers and create test accounts

**Tasks** (from [tasks.md](./tasks.md)):
- [ ] T007-T012b: WhatsApp Cloud API research and Meta Business Account setup
- [ ] T018a-T018g: Africa's Talk SMS research and test account setup
- [ ] T049a-T049j: AWS free tier research (Lambda, EC2, API Gateway)
- [ ] T001-T006: Apache Fineract REST API research
- [ ] T019-T024: DIDIT KYC research
- [ ] T044-T049: Device lock provider evaluation

**Deliverables**:
- Meta Business Account with WhatsApp Business phone number registered
- Africa's Talk account with Zimbabwe SMS verified
- AWS account with free tier eligibility confirmed
- research.md with cost comparisons and API documentation

**Success Criteria**:
- WhatsApp Cloud API sends/receives messages successfully
- Africa's Talk delivers SMS to Zimbabwe numbers
- AWS Lambda function deploys and executes
- EC2 t3.micro launches and runs Docker

---

### Week 4-8: Design Phase (Phase 1)

**Goal**: Produce detailed design documents compatible with free tier constraints

**Tasks** (from [tasks.md](./tasks.md)):
- [ ] T044-T059: Data model design (13 operational tables optimized for 500MB limit)
- [ ] T060-T070: API contracts (5 Lambda functions, Fineract client, WhatsApp Cloud API)
- [ ] T071-T077: Event architecture (PostgreSQL triggers + pg_notify, no AWS SNS/SQS)
- [ ] T078-T085: Business logic design (scoring, commissions, grace periods)
- [ ] T086-T092: Security design (RLS policies, JWT, audit logging)
- [ ] T103-T108: Observability design (CloudWatch FREE tier, 5GB logs/month)

**Deliverables**:
- data-model.md (with compression and partitioning strategies)
- api-contracts/ (OpenAPI 3.0 specs for all services)
- event-schemas.yaml (PostgreSQL trigger-based events)
- calculations.md (scoring formulas, commission rules)
- security.md (RLS policies, secrets rotation)

**Success Criteria**:
- Database schema stays <500MB with 2000 users projected
- API contracts validated with OpenAPI validator
- RLS policies tested in Supabase dashboard

---

### Week 9-10: Foundation Phase (Phase 2)

**Goal**: Build core infrastructure that all user stories depend on

**Tasks** (from [tasks.md](./tasks.md)):
- [ ] T116-T129: Monorepo setup (5 Lambda services, 2 Next.js frontends)
- [ ] T130-T144: Supabase FREE tier setup (PostgreSQL, migrations, compression enabled)
- [ ] T152-T159: Supabase Auth + RLS policies (RBAC enforcement at database level)
- [ ] T160-T166: Apache Fineract client (REST API wrapper with retry logic)
- [ ] T167-T171: Testing framework (Jest, pytest, Playwright, Supabase test DB)

**Deliverables**:
- Supabase project created with all 13 tables + RLS policies
- Apache Fineract running on local Docker (connects to Supabase PostgreSQL)
- Shared TypeScript types package
- Testing framework configured with sample tests

**Success Criteria**:
- Supabase database <50MB after initial setup
- RLS policies block unauthorized access
- Fineract creates test loan successfully
- Tests run locally with green status

**⚠️ CRITICAL**: No user story work can begin until Foundation is complete.

---

### Week 11-13: MVP - User Story 1 (Customer Onboarding & KYC)

**Goal**: Enable customer to complete KYC via WhatsApp and receive qualification decision

**Tasks** (from [tasks.md](./tasks.md)):
- [ ] T172-T177: TDD tests (contract, integration, E2E) - **WRITE FIRST**
- [ ] T178-T188a: WhatsApp Cloud API service (webhook, state machine, conversation window tracking)
- [ ] T189-T196: KYC service (DIDIT integration, duplicate detection)
- [ ] T197-T201: Africa's Talk SMS (Next of Kin verification, delivery callbacks)
- [ ] T202-T210: Scoring service (hybrid Fineract + ML, grace period calculation)
- [ ] T211-T217: Notification service (Supabase Edge Function for WhatsApp messages)

**Deliverables**:
- whatsapp-service deployed to AWS Lambda
- kyc-service deployed to AWS Lambda
- scoring-service deployed to AWS Lambda (or Cloudflare Workers if WASM conversion done)
- Africa's Talk SMS integration functional
- WhatsApp Cloud API sends/receives messages
- All tests pass (contract, integration, E2E)

**Success Criteria**:
- Customer can send WhatsApp message and receive greeting
- Customer can complete full KYC flow (Name, ID, Address, Phone, 2 Next of Kin)
- Next of Kin receives SMS verification from Africa's Talk
- Customer receives "Qualified" or "Rejected" message
- **Cost**: <$5/month (only external API costs)

**⚠️ STOP AND VALIDATE**: Test full customer journey before proceeding to User Story 2.

---

### Week 14-19: Core Features - User Stories 2-3 (Payment & Collection)

**Goal**: Enable customer to select phone, pay deposit, and collect device

**Tasks** (from [tasks.md](./tasks.md)):
- User Story 2 (Week 14-16): Asset selection, payment integration, confirmation
- User Story 3 (Week 17-19): Distributor handover, commission calculation, loan activation

**Deliverables**:
- payment-service deployed to AWS Lambda (EcoCash/Omari integration)
- Inventory management with Supabase Realtime (WebSocket updates <100ms)
- Commission calculation on handover
- Fineract loan creation on asset collection
- Distributor dashboard with Supabase Auth

**Success Criteria**:
- Customer can view phone catalog and select device
- Customer can pay deposit via EcoCash/Omari
- Distributor can verify customer ID and complete handover
- Commission calculated and stored as Pending
- **Cost**: <$10/month (payment gateway transaction fees)

---

### Week 20-26: Post-MVP Features - User Stories 4-8

**Goal**: Add repayment management, extensions, CS, agent tools

**User Stories**:
- US4 (Week 20-21): Repayment management & balance checking
- US5 (Week 22-23): Payment extensions & default management (lock service)
- US6 (Week 22-23): Customer service escalation
- US7 (Week 24-26): Agent inventory & handover management (dashboard features)
- US8 (Week 24-26): Agent handover history & inventory alerts

**Deliverables**:
- lock-service deployed to AWS Lambda (device lock provider integration)
- Full distributor dashboard (Next.js on Vercel FREE tier)
- Supabase Edge Functions for cron jobs (daily reminders, weekly commissions)

**Success Criteria**:
- Customer can check balance and make repayments
- Automated reminders sent 3 days and 1 day before due date
- Device lock triggers after grace period
- Agents can view real-time inventory and commission tracking
- **Cost**: <$20/month (more users, more transactions)

---

### Week 27-32: Admin Portal & Production Deployment

**Goal**: Admin dashboard, commission batch processing, deployment to production

**Tasks** (from [tasks.md](./tasks.md)):
- Phase 11 (Week 27-30): Admin portal (Next.js, commission management, reconciliation)
- Phase 12 (Week 31-32): ML model management (A/B testing, rollback)
- Phase 13 (Week 33-36): Infrastructure deployment (Lambda, EC2, CI/CD)

**Deliverables**:
- Admin portal deployed to Vercel FREE tier
- AWS SAM template for Lambda functions
- EC2 t3.micro with Apache Fineract in production
- GitHub Actions CI/CD pipeline
- Supabase backups configured (daily, 7-day retention)

**Success Criteria**:
- Admin can approve weekly commission batches
- Admin can resolve payment reconciliation failures
- Lambda functions auto-deploy on git push
- EC2 AMI snapshot created for disaster recovery
- **Cost**: <$25/month (Year 1 with all services running)

---

## Cost Validation Checklist

Use this checklist monthly to ensure you stay within cost optimization budget:

### Supabase FREE Tier (500MB database, 2GB bandwidth, 1GB storage)

- [ ] Database size < 400MB (check with query from supabase-architecture.md)
- [ ] Bandwidth < 1.5GB/month (check Supabase dashboard)
- [ ] Storage < 800MB (check Supabase dashboard)
- [ ] Realtime connections < 150 concurrent (check dashboard)
- [ ] Edge Function invocations < 400K/month (check dashboard)

### AWS Lambda (1M requests/month FREE forever)

- [ ] Total Lambda invocations < 800K/month (check CloudWatch)
- [ ] Lambda compute time < 320K GB-seconds/month (check CloudWatch)
- [ ] API Gateway requests < 800K/month (free Year 1, then $1/million)

### AWS EC2 t3.micro (750 hrs/month FREE Year 1)

- [ ] Single EC2 instance running 24/7 (exactly 730 hrs/month)
- [ ] No additional EC2 instances launched

### WhatsApp Cloud API (1000 conversations/month FREE)

- [ ] Conversations < 900/month (check Meta Business Manager)
- [ ] If >1000: expect $0.0092/conversation overage

### Africa's Talk SMS

- [ ] SMS sent < 200/month (check Africa's Talk dashboard)
- [ ] Cost = SMS count × $0.008 (log in financial_reconciliation table)

### External Services (Variable)

- [ ] DIDIT KYC: ~$0.10/verification × count
- [ ] EcoCash/Omari: Transaction fees only (2-3%)
- [ ] Device lock provider: ~$0.20/device/month × count

### Total Monthly Cost Target

- [ ] **Month 1-3**: <$5/month
- [ ] **Month 4-6**: <$15/month
- [ ] **Month 7-12**: <$25/month
- [ ] **Year 2+**: <$40/month

---

## Troubleshooting Guide

### Issue: Supabase database exceeds 400MB

**Solution**:
1. Run database size query from supabase-architecture.md
2. Identify largest tables
3. Apply compression: `ALTER TABLE [table] SET (toast_compression = 'lz4');`
4. Enable partitioning on event_log
5. Run cleanup functions (delete events >90 days, sessions >7 days)
6. If still over 450MB: upgrade to Supabase Pro ($25/month) or archive old data to S3 Glacier

### Issue: Lambda costs are non-zero

**Cause**: Likely exceeding 1M requests/month or 400K GB-seconds compute

**Solution**:
1. Check CloudWatch metrics for invocation count
2. Reduce Lambda memory allocation (lower GB-seconds)
3. Optimize code to reduce execution time
4. Cache frequently accessed data in Supabase

### Issue: WhatsApp Cloud API charges appearing

**Cause**: Exceeding 1000 conversations/month (24hr windows)

**Solution**:
1. Check Meta Business Manager for conversation count
2. Optimize message templates (use templates for notifications outside 24hr window)
3. Expected overage cost: $0.0092/conversation (acceptable if users are growing)

### Issue: EC2 instance charges appearing (Year 1)

**Cause**: Running multiple EC2 instances or t3.medium instead of t3.micro

**Solution**:
1. Verify only 1 EC2 t3.micro instance is running
2. Check instance type: must be t3.micro (1GB RAM, 2 vCPUs)
3. Check hours: should be ~730 hrs/month (24/7 uptime)
4. Free tier is per account, per region (don't launch in multiple regions)

---

## Next Steps

1. **Review all updated specs**: [spec.md](./spec.md), [tasks.md](./tasks.md), [supabase-architecture.md](./supabase-architecture.md), [plan.md](./plan.md)
2. **Begin Phase 0 (Research)**: Follow tasks T007-T049j
3. **Create Meta Business Account**: Register WhatsApp Business phone number
4. **Create Africa's Talk Account**: Verify SMS delivery to Zimbabwe
5. **Create AWS Account**: Verify free tier eligibility
6. **Track costs weekly**: Use Cost Validation Checklist above

---

## References

- **cost optimization Strategy**: [cost-optimization.md](./cost-optimization.md)
- **Functional Requirements**: [spec.md](./spec.md) (FR-033a to FR-033h for WhatsApp, FR-052a to FR-052g for SMS)
- **Implementation Tasks**: [tasks.md](./tasks.md) (410+ tasks with YC optimizations)
- **Database Optimization**: [supabase-architecture.md](./supabase-architecture.md) (compression, partitioning, retention)
- **Timeline & Budget**: [plan.md](./plan.md) (target costs per milestone)

---

**Status**: ✅ All specifications updated with cost optimization
**Ready to Begin**: Yes - Phase 0 (Research) can start immediately
**Expected Year 1 Cost**: $5-25/month (vs $75-195/month without optimization)
**Savings**: ~$840-2,040/year = 6-12 months extra runway
