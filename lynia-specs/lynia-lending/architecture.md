# Lynia Finance - System Architecture

**Document:** P1-T001 Deliverable
**Version:** 1.0
**Date:** November 24, 2025
**Status:** Phase 1 - Architecture Design

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Architecture](#component-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Integration Points](#integration-points)
6. [Technology Stack](#technology-stack)
7. [Security Architecture](#security-architecture)
8. [Scalability & Performance](#scalability--performance)

---

## Executive Summary

Lynia Finance is a WhatsApp-first device financing platform for Zimbabwe's informal sector. The architecture is designed to be:

- **Serverless-first**: AWS Lambda microservices for $0/month Year 1 costs
- **Real-time**: Supabase for instant data sync and webhooks
- **Scalable**: Horizontal scaling from 100 to 10,000+ users
- **Resilient**: Multi-region, fault-tolerant, with automatic retries
- **Compliant**: Zimbabwe data protection, GDPR-ready for EU investors

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER LAYER (Zimbabwe)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐      │
│  │   WhatsApp   │        │  Distributor │        │    Admin     │      │
│  │   (Customers)│        │   Dashboard  │        │   Portal     │      │
│  │              │        │   (Agents)   │        │   (Staff)    │      │
│  └──────┬───────┘        └──────┬───────┘        └──────┬───────┘      │
│         │                       │                       │               │
└─────────┼───────────────────────┼───────────────────────┼───────────────┘
          │                       │                       │
          │                       │                       │
┌─────────┼───────────────────────┼───────────────────────┼───────────────┐
│         │              API GATEWAY LAYER (AWS)          │               │
├─────────┼───────────────────────┼───────────────────────┼───────────────┤
│         │                       │                       │               │
│  ┌──────▼────────┐     ┌────────▼──────┐     ┌────────▼──────┐        │
│  │  WhatsApp     │     │  Distributor  │     │   Admin API   │        │
│  │  Bot Service  │     │  API Service  │     │   Service     │        │
│  │  (Lambda)     │     │  (Lambda)     │     │  (Lambda)     │        │
│  └──────┬────────┘     └────────┬──────┘     └────────┬──────┘        │
│         │                       │                       │               │
└─────────┼───────────────────────┼───────────────────────┼───────────────┘
          │                       │                       │
          │         ┌─────────────┴───────────────┐      │
          │         │                             │      │
┌─────────┼─────────▼─────────────────────────────▼──────┼───────────────┐
│         │         MICROSERVICES LAYER (AWS Lambda)      │               │
├─────────┼───────────────────────────────────────────────┼───────────────┤
│         │                                               │               │
│  ┌──────▼──────┐  ┌──────────┐  ┌───────────┐  ┌──────▼──────┐        │
│  │    KYC      │  │  Credit  │  │  Payment  │  │Notification │        │
│  │  Service    │  │ Scoring  │  │Processing │  │  Service    │        │
│  │  (Lambda)   │  │(Lambda)  │  │ (Lambda)  │  │  (Lambda)   │        │
│  └──────┬──────┘  └────┬─────┘  └─────┬─────┘  └──────┬──────┘        │
│         │              │              │               │               │
│  ┌──────▼──────┐  ┌────▼─────┐  ┌─────▼─────┐  ┌──────▼──────┐        │
│  │   Device    │  │Inventory │  │   Audit   │  │  Analytics  │        │
│  │Lock Service │  │ Service  │  │  Service  │  │   Service   │        │
│  │  (Lambda)   │  │(Lambda)  │  │ (Lambda)  │  │  (Lambda)   │        │
│  └──────┬──────┘  └────┬─────┘  └─────┬─────┘  └──────┬──────┘        │
│         │              │              │               │               │
└─────────┼──────────────┼──────────────┼───────────────┼───────────────┘
          │              │              │               │
          │    ┌─────────┴──────┬───────┴───────┬───────┘
          │    │                │               │
┌─────────┼────▼────────────────▼───────────────▼───────────────────────┐
│         │              DATA LAYER (Supabase + Fineract)               │
├─────────┼──────────────────────────────────────────────────────────────┤
│         │                                                               │
│  ┌──────▼──────────┐                  ┌──────────────────┐            │
│  │   Supabase      │                  │  Apache Fineract │            │
│  │   PostgreSQL    │◄─────Sync───────►│   (Core Banking) │            │
│  │                 │                  │   MySQL 8.0      │            │
│  │ • Customers     │                  │ • Loans          │            │
│  │ • Devices       │                  │ • Repayments     │            │
│  │ • KYC Data      │                  │ • Accounts       │            │
│  │ • Notifications │                  │ • Transactions   │            │
│  │ • Audit Logs    │                  │                  │            │
│  └─────────────────┘                  └──────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
          │              │              │               │
          │    ┌─────────┴──────┬───────┴───────┬───────┘
          │    │                │               │
┌─────────┼────▼────────────────▼───────────────▼───────────────────────┐
│         │         EXTERNAL INTEGRATIONS (Third-Party APIs)             │
├─────────┼──────────────────────────────────────────────────────────────┤
│         │                                                               │
│  ┌──────▼──────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   WhatsApp      │  │    Smile     │  │   EcoCash    │             │
│  │   Cloud API     │  │   Identity   │  │   / Paynow   │             │
│  │   (Meta)        │  │    (KYC)     │  │  (Payments)  │             │
│  └─────────────────┘  └──────────────┘  └──────────────┘             │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Device Lock    │  │   AWS SES    │  │ CloudWatch   │             │
│  │   Providers     │  │   (Email)    │  │  (Logging)   │             │
│  │  (IMEI Lock)    │  │              │  │              │             │
│  └─────────────────┘  └──────────────┘  └──────────────┘             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Customer Layer

#### 1.1 WhatsApp Interface
- **Technology**: WhatsApp Cloud API
- **Purpose**: Primary customer touchpoint
- **Features**:
  - KYC submission (ID upload, selfie)
  - Device browsing
  - Loan application
  - Payment management
  - Customer support
- **Users**: 10,000+ customers (target)

#### 1.2 Distributor Dashboard
- **Technology**: Next.js 14 (React)
- **Purpose**: Agent network management
- **Features**:
  - Device handover
  - ID verification
  - Inventory management
  - Commission tracking
- **Users**: 50-100 distributors

#### 1.3 Admin Portal
- **Technology**: Next.js 14 (React)
- **Purpose**: Internal operations
- **Features**:
  - Loan management
  - Payment reconciliation
  - Reporting & analytics
  - Manual review queue
- **Users**: 5-10 admin staff

---

### 2. API Gateway Layer

#### 2.1 WhatsApp Bot Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: Webhook from WhatsApp Cloud API
- **Responsibilities**:
  - Message routing
  - Conversation state management
  - Intent recognition
  - Response generation
- **Latency**: <500ms per message
- **Throughput**: 1,000 messages/min

#### 2.2 Distributor API Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: HTTP API Gateway
- **Responsibilities**:
  - Authentication (JWT)
  - Device handover operations
  - Inventory queries
  - Commission calculations
- **Latency**: <200ms per request

#### 2.3 Admin API Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: HTTP API Gateway
- **Responsibilities**:
  - RBAC enforcement
  - Reporting queries
  - Manual review workflows
  - System configuration
- **Latency**: <300ms per request

---

### 3. Microservices Layer

#### 3.1 KYC Processing Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: Event-driven (SQS queue)
- **Responsibilities**:
  - Document upload to S3
  - Smile Identity API integration
  - Verification status tracking
  - Manual review escalation
- **SLA**: <5 minutes for automated verification
- **Integrations**: Smile Identity, S3

#### 3.2 Credit Scoring Service
- **Runtime**: AWS Lambda (Python 3.11)
- **Trigger**: Event-driven (SQS queue)
- **Responsibilities**:
  - Rule-based scoring (Phase 1)
  - ML model inference (Phase 3+)
  - Credit limit determination
  - Decision audit logging
- **SLA**: <5 seconds per decision
- **Model**: Hybrid (rules + ML)

#### 3.3 Payment Processing Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: Webhook from payment gateways
- **Responsibilities**:
  - Payment reconciliation
  - EcoCash/Paynow integration
  - Retry logic (exponential backoff)
  - Fraud detection
- **SLA**: <10 seconds per transaction
- **Integrations**: EcoCash, Paynow, Fineract

#### 3.4 Notification Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: Event-driven (SQS queue)
- **Responsibilities**:
  - Multi-channel delivery (WhatsApp > SMS > Email)
  - Template rendering
  - Delivery tracking
  - Retry logic
- **SLA**: <30 seconds per notification
- **Channels**: WhatsApp, SMS, Email

#### 3.5 Device Lock Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: Scheduled (EventBridge) + Manual
- **Responsibilities**:
  - IMEI tracking
  - Lock/unlock commands
  - Grace period management
  - Customer communication
- **SLA**: <60 seconds for lock/unlock
- **Integrations**: Device lock providers

#### 3.6 Inventory Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: HTTP API Gateway
- **Responsibilities**:
  - Device catalog management
  - Stock tracking
  - Pricing updates
  - Availability queries
- **SLA**: <200ms per query

#### 3.7 Audit Service
- **Runtime**: AWS Lambda (Node.js 18)
- **Trigger**: Event-driven (CloudWatch Logs)
- **Responsibilities**:
  - Activity logging
  - Compliance tracking
  - Security monitoring
  - Tamper detection
- **Retention**: 7 years (compliance)

#### 3.8 Analytics Service
- **Runtime**: AWS Lambda (Python 3.11)
- **Trigger**: Scheduled (EventBridge)
- **Responsibilities**:
  - KPI calculation
  - Report generation
  - Trend analysis
  - Data aggregation
- **Frequency**: Daily batch jobs

---

### 4. Data Layer

#### 4.1 Supabase PostgreSQL
- **Purpose**: Application database
- **Region**: US East (primary)
- **Tables**:
  - `customers` - Customer profiles
  - `kyc_submissions` - KYC verification data
  - `devices` - Device inventory
  - `device_assignments` - Customer-device mapping
  - `notifications` - Communication logs
  - `distributors` - Agent network
  - `admin_users` - Platform staff
  - `audit_logs` - System activity
  - `sessions` - WhatsApp conversation state

**Features**:
- Row Level Security (RLS)
- Real-time subscriptions
- PostgREST API
- Built-in auth

#### 4.2 Apache Fineract (Core Banking)
- **Purpose**: Loan management system
- **Runtime**: AWS EC2 t3.micro
- **Database**: MySQL 8.0
- **Tables**:
  - `m_client` - Customer accounts
  - `m_loan` - Loan applications
  - `m_loan_transaction` - Repayments
  - `m_savings_account` - Virtual accounts
  - `m_product_loan` - Loan products

**Features**:
- Multi-tenancy
- Double-entry accounting
- Repayment schedules
- Interest calculations
- Financial reporting

#### 4.3 Data Synchronization
- **Pattern**: Event-driven sync
- **Flow**: Supabase → Fineract (one-way)
- **Trigger**: Database triggers + Lambda
- **Frequency**: Real-time
- **Conflict Resolution**: Fineract is source of truth for financial data

---

### 5. External Integrations

#### 5.1 WhatsApp Cloud API
- **Provider**: Meta
- **Authentication**: Access token (OAuth 2.0)
- **Rate Limits**: 1,000 messages/sec (Business tier)
- **Webhook**: HTTPS endpoint with signature verification
- **Features**: Messages, Media, Templates, Interactive components

#### 5.2 Smile Identity (KYC)
- **Provider**: Smile Identity
- **Authentication**: API key + Partner ID
- **SLA**: <3 minutes for automated verification
- **Features**: Document verification, Selfie matching, Liveness detection
- **Supported IDs**: Zimbabwe National ID

#### 5.3 EcoCash / Paynow
- **Provider**: Econet / Paygate
- **Authentication**: Merchant key + API token
- **Settlement**: T+1 (next business day)
- **Features**: Push payments, Pull payments, Webhooks
- **Currencies**: USD, ZWL

#### 5.4 Device Lock Providers
- **Options**: Absolute Software, Prey Project, Custom MDM
- **Authentication**: API key
- **Features**: Remote lock/unlock, IMEI tracking, Location tracking
- **Latency**: <60 seconds

#### 5.5 AWS SES (Email)
- **Provider**: AWS
- **Authentication**: IAM role
- **Purpose**: Admin alerts, Reports, Receipts
- **Volume**: 1,000 emails/day (free tier)

#### 5.6 CloudWatch (Monitoring)
- **Provider**: AWS
- **Purpose**: Logging, Metrics, Alarms
- **Retention**: 30 days (logs), 15 months (metrics)
- **Alerts**: Email, SMS, Slack

---

## Data Flow Diagrams

### Flow 1: Customer Onboarding & Loan Application

```
Customer (WhatsApp)
    │
    │ 1. Send message "Hi"
    ▼
WhatsApp Bot Service (Lambda)
    │
    │ 2. Check if customer exists
    ▼
Supabase (customers table)
    │
    │ 3a. New customer → Start KYC flow
    │ 3b. Existing customer → Show menu
    ▼
WhatsApp Bot Service
    │
    │ 4. Request ID document
    ▼
Customer uploads ID photo
    │
    │ 5. Upload to S3 + Queue KYC job
    ▼
KYC Processing Service (Lambda)
    │
    │ 6. Submit to Smile Identity API
    ▼
Smile Identity (External)
    │
    │ 7. Return verification result
    ▼
KYC Processing Service
    │
    │ 8. Update kyc_submissions table
    ▼
Supabase (kyc_submissions)
    │
    │ 9. Trigger credit scoring
    ▼
Credit Scoring Service (Lambda)
    │
    │ 10. Apply rule-based scoring
    ▼
Supabase (customers - credit_limit field)
    │
    │ 11. Notify customer of approval
    ▼
Notification Service (Lambda)
    │
    │ 12. Send WhatsApp message
    ▼
Customer (WhatsApp)
    │
    │ 13. Browse devices
    ▼
WhatsApp Bot Service
    │
    │ 14. Query device catalog
    ▼
Supabase (devices table)
    │
    │ 15. Show devices + prices
    ▼
Customer selects device
    │
    │ 16. Create loan application
    ▼
WhatsApp Bot Service
    │
    │ 17. Create loan in Fineract
    ▼
Apache Fineract (m_loan)
    │
    │ 18. Approve loan (auto if eligible)
    ▼
Apache Fineract
    │
    │ 19. Notify customer + distributor
    ▼
Notification Service (Lambda)
    │
    │ 20. WhatsApp: "Visit distributor X to collect device"
    ▼
Customer + Distributor
```

---

### Flow 2: Device Handover

```
Customer visits Distributor
    │
    │ 1. Distributor opens dashboard
    ▼
Distributor Dashboard (Next.js)
    │
    │ 2. Search customer by phone/ID
    ▼
Distributor API Service (Lambda)
    │
    │ 3. Query approved loans
    ▼
Supabase + Fineract
    │
    │ 4. Display customer + loan details
    ▼
Distributor Dashboard
    │
    │ 5. Verify customer ID (photo)
    ▼
Distributor confirms identity
    │
    │ 6. Enter device IMEI
    ▼
Distributor Dashboard
    │
    │ 7. Register device assignment
    ▼
Inventory Service (Lambda)
    │
    │ 8a. Update device_assignments
    │ 8b. Update devices (status: assigned)
    ▼
Supabase
    │
    │ 9. Disburse loan in Fineract
    ▼
Apache Fineract (m_loan status: Active)
    │
    │ 10. Activate device lock tracking
    ▼
Device Lock Service (Lambda)
    │
    │ 11. Register IMEI with lock provider
    ▼
Device Lock Provider (External)
    │
    │ 12. Notify customer
    ▼
Notification Service (Lambda)
    │
    │ 13. WhatsApp: "Device activated! First payment due: [date]"
    ▼
Customer (WhatsApp)
```

---

### Flow 3: Payment Collection

```
Customer initiates payment (EcoCash)
    │
    │ 1. USSD: *151# or EcoCash app
    ▼
EcoCash (External)
    │
    │ 2. Webhook: Payment received
    ▼
Payment Processing Service (Lambda)
    │
    │ 3. Validate webhook signature
    ▼
Payment Processing Service
    │
    │ 4. Match payment to loan
    ▼
Supabase (payments table)
    │
    │ 5. Record payment in Fineract
    ▼
Apache Fineract (m_loan_transaction)
    │
    │ 6. Update loan balance
    ▼
Apache Fineract
    │
    │ 7a. If paid in full → Unlock device permanently
    │ 7b. If partial → Update schedule
    ▼
Device Lock Service (Lambda)
    │
    │ 8. Send unlock command (if applicable)
    ▼
Device Lock Provider
    │
    │ 9. Notify customer
    ▼
Notification Service (Lambda)
    │
    │ 10. WhatsApp: "Payment received! Balance: $X"
    ▼
Customer (WhatsApp)
```

---

### Flow 4: Missed Payment & Device Lock

```
EventBridge (Daily 9 AM)
    │
    │ 1. Trigger scheduled Lambda
    ▼
Device Lock Service (Lambda)
    │
    │ 2. Query overdue loans
    ▼
Apache Fineract (loans with overdue > 7 days)
    │
    │ 3. For each overdue loan
    ▼
Device Lock Service
    │
    │ 4. Check if grace period expired
    ▼
Supabase (device_assignments)
    │
    │ 5. Send lock command
    ▼
Device Lock Provider (External)
    │
    │ 6. Lock device (IMEI lock)
    ▼
Device Lock Provider
    │
    │ 7. Update lock status
    ▼
Supabase (device_assignments.lock_status)
    │
    │ 8. Notify customer
    ▼
Notification Service (Lambda)
    │
    │ 9. WhatsApp: "Payment overdue. Device locked. Pay to unlock."
    ▼
Customer (WhatsApp)
```

---

## Integration Points

### Integration Matrix

| Service | Integrates With | Protocol | Auth Method | Frequency |
|---------|----------------|----------|-------------|-----------|
| WhatsApp Bot | WhatsApp Cloud API | HTTPS (Webhook) | OAuth 2.0 | Real-time |
| WhatsApp Bot | Supabase | PostgreSQL | JWT | Real-time |
| KYC Service | Smile Identity | REST API | API Key | On-demand |
| KYC Service | AWS S3 | AWS SDK | IAM Role | On-demand |
| Credit Scoring | Supabase | PostgreSQL | JWT | On-demand |
| Payment Service | EcoCash | HTTPS (Webhook) | API Key | Real-time |
| Payment Service | Fineract | REST API | Basic Auth | Real-time |
| Device Lock | Lock Provider | REST API | API Key | Scheduled + On-demand |
| Notification | WhatsApp Cloud API | REST API | OAuth 2.0 | Real-time |
| Notification | AWS SES | AWS SDK | IAM Role | Batch |
| All Services | Supabase | PostgreSQL | JWT | Real-time |
| Supabase | Fineract | REST API (sync) | Basic Auth | Event-driven |

---

### API Endpoints Summary

#### WhatsApp Bot Service
- `POST /webhook` - Receive WhatsApp messages
- `GET /webhook` - WhatsApp verification

#### KYC Service
- `POST /kyc/submit` - Submit KYC documents
- `GET /kyc/status/:customerId` - Check verification status
- `POST /kyc/retry/:submissionId` - Retry failed verification

#### Credit Scoring Service
- `POST /score/evaluate` - Calculate credit score
- `GET /score/:customerId` - Retrieve existing score
- `POST /score/override` - Manual override (admin)

#### Payment Service
- `POST /payments/webhook/ecocash` - EcoCash webhook
- `POST /payments/webhook/paynow` - Paynow webhook
- `GET /payments/:loanId` - Payment history
- `POST /payments/reconcile` - Manual reconciliation

#### Device Lock Service
- `POST /device/lock/:imei` - Lock device
- `POST /device/unlock/:imei` - Unlock device
- `GET /device/status/:imei` - Check lock status

#### Notification Service
- `POST /notify/send` - Send notification
- `GET /notify/status/:notificationId` - Delivery status
- `POST /notify/bulk` - Bulk notifications

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (React 18)
- **Styling**: Tailwind CSS
- **State Management**: React Context + SWR
- **Authentication**: Supabase Auth
- **Hosting**: Vercel (Free tier)

### Backend
- **Runtime**: AWS Lambda (Node.js 18, Python 3.11)
- **API Gateway**: AWS HTTP API Gateway
- **Event Queue**: AWS SQS
- **Scheduler**: AWS EventBridge
- **Storage**: AWS S3
- **Database**: Supabase PostgreSQL + Apache Fineract MySQL

### Infrastructure
- **IaC**: AWS SAM (Serverless Application Model)
- **CI/CD**: GitHub Actions
- **Monitoring**: AWS CloudWatch
- **Logging**: CloudWatch Logs + Supabase Logs

### External Services
- **WhatsApp**: Meta WhatsApp Cloud API
- **KYC**: Smile Identity
- **Payments**: EcoCash, Paynow
- **Device Lock**: Absolute Software / Prey
- **Email**: AWS SES

---

## Security Architecture

### Authentication & Authorization

#### Customer Authentication
- **Method**: Phone number verification (OTP via WhatsApp)
- **Session**: Stored in Supabase (sessions table)
- **Expiry**: 30 days

#### Distributor Authentication
- **Method**: Email + Password (Supabase Auth)
- **Session**: JWT token
- **Expiry**: 7 days
- **MFA**: Optional (SMS/Email)

#### Admin Authentication
- **Method**: Email + Password + MFA
- **Session**: JWT token
- **Expiry**: 1 day
- **MFA**: Required (TOTP)

### Data Security

#### Encryption at Rest
- **Supabase**: AES-256 (managed)
- **Fineract**: MySQL encryption (InnoDB)
- **S3**: AES-256 (server-side encryption)

#### Encryption in Transit
- **Protocol**: TLS 1.3
- **Certificates**: AWS Certificate Manager
- **HSTS**: Enabled

#### PII Protection
- **Sensitive Fields**: Encrypted with KMS
- **Masked Display**: National ID (***-****-X-**), Phone (+263 77 *** ****)
- **Access Logs**: All PII access logged

### API Security

#### Rate Limiting
- **WhatsApp Bot**: 100 req/min per user
- **Admin API**: 1,000 req/min per IP
- **Distributor API**: 500 req/min per user

#### Input Validation
- **Schema Validation**: JSON Schema
- **Sanitization**: DOMPurify for text, Zod for types
- **File Upload**: Size limit 10MB, type whitelist

#### CORS
- **Allowed Origins**: `*.lyniafinance.com`, `localhost` (dev)
- **Methods**: GET, POST, PUT, DELETE
- **Headers**: Authorization, Content-Type

---

## Scalability & Performance

### Horizontal Scaling

#### Lambda Auto-Scaling
- **Concurrency**: 1,000 concurrent executions (default)
- **Scaling**: Automatic (AWS managed)
- **Cold Start**: <500ms (Node.js), <1s (Python)

#### Database Scaling
- **Supabase**: Connection pooling (max 100)
- **Fineract**: Read replicas for queries
- **Caching**: Redis (ElastiCache) for hot data

### Performance Targets

| Component | Latency | Throughput |
|-----------|---------|------------|
| WhatsApp Bot | <500ms | 1,000 msg/min |
| KYC Verification | <5 min | 100 verifications/hour |
| Credit Scoring | <5 sec | 500 decisions/hour |
| Payment Processing | <10 sec | 1,000 txns/hour |
| Device Lock | <60 sec | 100 ops/hour |
| Notification | <30 sec | 5,000 notifications/hour |

### Availability

- **Target**: 99.5% uptime (Year 1)
- **Downtime**: <3.6 hours/month
- **Monitoring**: 24/7 automated alerts
- **Incident Response**: <1 hour response time

---

## Disaster Recovery

### Backup Strategy
- **Supabase**: Daily automated backups (7-day retention)
- **Fineract**: Daily MySQL dumps to S3 (30-day retention)
- **Code**: GitHub (version control)

### Recovery Objectives
- **RTO** (Recovery Time Objective): 4 hours
- **RPO** (Recovery Point Objective): 24 hours

### Failover Plan
1. Switch to backup database (manual)
2. Redeploy Lambda functions (automated)
3. Update DNS records (manual)
4. Notify customers via SMS (automated)

---

## Cost Optimization

### Year 1 Costs: $0/month

**AWS Free Tier:**
- Lambda: 1M requests/month (67x coverage)
- API Gateway: 1M requests/month
- S3: 5GB storage
- CloudWatch: 5GB logs

**Supabase Free Tier:**
- 500MB database
- 1GB file storage
- 2GB bandwidth

**EC2 (Fineract):**
- t3.micro: 750 hours/month (free tier)

### Scaling Costs (Projected)

| Users | Monthly Cost | AWS | Supabase | Fineract |
|-------|--------------|-----|----------|----------|
| 0-100 | $0 | Free tier | Free tier | Free tier |
| 100-1,000 | $25 | $15 (Lambda) | $10 (DB) | Free tier |
| 1,000-10,000 | $150 | $80 (Lambda+S3) | $50 (Pro) | $20 (EC2) |
| 10,000+ | $500+ | $250 (Lambda) | $150 (Team) | $100 (RDS) |

---

## Appendices

### A. AWS Lambda Configuration

```yaml
# WhatsApp Bot Service
Runtime: nodejs18.x
Memory: 512 MB
Timeout: 30 seconds
Environment:
  SUPABASE_URL: https://xxx.supabase.co
  SUPABASE_ANON_KEY: eyJ...
  WHATSAPP_VERIFY_TOKEN: secret123
  WHATSAPP_ACCESS_TOKEN: EAA...
```

### B. Supabase Schema (Summary)

```sql
-- Core tables
customers (10+ columns, RLS enabled)
loans (15+ columns, synced with Fineract)
devices (8+ columns, inventory tracking)
kyc_submissions (12+ columns, audit trail)
payments (10+ columns, reconciliation)
notifications (8+ columns, delivery tracking)
```

### C. Fineract Configuration

```properties
# application.properties
fineract.tenant.host=fineractdb
fineract.tenant.port=3306
fineract.tenant.username=root
fineract.tenant.password=mysql
fineract.mode.read-only=false
```

---

**Document Status:** ✅ Complete
**Next Task:** P1-T002 - Database Schema Design
**Approval Required:** Technical Lead
**Last Updated:** November 24, 2025
