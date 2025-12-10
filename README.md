# Lynia Finance

**Alternative financial rails to power financial mobility**

A new credit infrastructure for Zimbabwe's underbanked majority, powered by AI/ML underwriting and enforced by technology.

## Vision

**The underbanked aren't high-risk—they're unmodeled.**

We're building the first credit system designed for the informal majority in Zimbabwe. 80% of Zimbabweans work in the informal sector with no payslips, no contracts, and no access to formal credit. Legacy credit models rely on collateral, employment history, and credit scores—none of which exist for the underbanked.

Lynia Finance is building a parallel financial system where credit decisions are made through alternative data, enforced through remote asset-lock technology, and repaid through mobile money rails integrated directly into income streams.

## The Problem

**Credit in Zimbabwe was never built for the informal majority**

- **80% informal workforce**: No payslips, no formal employment contracts, invisible to traditional lenders
- **76% informal businesses**: Unregistered, cash-based, and excluded from formal financing
- **Legacy lending broken**: Traditional models require collateral, employment verification, and credit history that don't exist

The informal economy isn't unproductive—it's simply unstructured and unmodeled by existing financial systems.

## Our Solution

**A new credit infrastructure: powered by data, enforced by tech**

1. **AI/ML Underwriting**: Assess affordability and repayment behavior without formal credit history, using alternative signals from mobile money behavior, location data, and social networks

2. **Enforceable Collateral**: Remote asset-lock technology enables asset-based lending at scale—smartphones and vehicles become productive collateral that can be locked/unlocked remotely

3. **Revenue-Linked Repayment**: Flexible payment collection that adapts to irregular income streams via mobile money integration (EcoCash, Omari), not rigid monthly schedules

4. **WhatsApp-First Platform**: Complete loan journey via WhatsApp—KYC submission, instant approval (<5 mins), asset selection, payment, and loan management with zero app downloads

## 📁 Project Structure

```
Lynia Finance Dev/
│
├── fineract/                       # Apache Fineract v1.13.0
│   ├── modules/                    # All Fineract modules (24 modules)
│   ├── tests/                      # Integration, OAuth2, 2FA tests
│   ├── custom/                     # Custom Fineract extensions
│   ├── config/                     # Fineract configuration
│   ├── docker/                     # Docker configurations
│   └── README.md                   # Fineract documentation
│
├── lynia-specs/                    # Lynia Finance Specifications
│   ├── lynia-lending/              # Main Lending Platform Spec
│   │   ├── spec.md                 # Feature specification & requirements
│   │   ├── plan.md                 # Implementation plan & milestones
│   │   ├── tasks.md                # Detailed implementation tasks
│   │   ├── implementation-guide.md # Cost optimization & architecture
│   │   ├── supabase-architecture.md # Database & platform design
│   │   ├── cost-optimization.md    # YC bootstrap cost strategy
│   │   └── checklists/             # Requirements checklists
│   ├── templates/                  # Specification templates
│   ├── scripts/                    # Automation scripts
│   └── memory/                     # Project memory & constitution
│
├── services/                       # Microservices (AWS Lambda)
│   ├── whatsapp-service/           # WhatsApp bot conversation flow
│   ├── kyc-service/                # Smile Identity KYC integration
│   ├── scoring-service/            # Hybrid credit scoring (ML + Fineract)
│   ├── payment-service/            # EcoCash/Omari payment gateway
│   ├── lock-service/               # Device lock management
│   ├── notification-service/       # Multi-channel notifications
│   ├── inventory-service/          # Inventory & handover management
│   ├── admin-service/              # Admin portal APIs
│   └── cs-service/                 # Customer support ticketing
│
├── frontend/                       # Web Applications
│   ├── admin-portal/               # Next.js 14 admin dashboard
│   └── distributor-dashboard/      # Next.js 14 distributor app
│
├── shared/                         # Shared Libraries
│   ├── types/                      # TypeScript type definitions
│   ├── utils/                      # Shared utilities
│   └── clients/                    # API clients (Fineract, etc.)
│
├── docs/                           # Project Documentation
│   ├── Apache_Fineract_Setup_Guide.pdf
│   ├── Apache_Fineract_Upgrade_Strategy.md
│   ├── FINERACT_V1.13_HIGHLIGHTS.md
│   └── UPGRADE_LOG.md
│
├── scripts/                        # Utility Scripts
├── infrastructure/                 # Infrastructure as Code (AWS SAM)
├── gradle/                         # Gradle Wrapper
└── .github/                        # GitHub Workflows & CI/CD
```

## 🚀 Quick Start

### Prerequisites
- **AWS CLI** - Configured with credentials
- **AWS SAM CLI** - For local Lambda testing
- **Docker Desktop** - For local development
- **Node.js 20+** - For Lambda functions
- **Git** - Version control

### Local Development

**1. Install Dependencies**
```bash
npm install
```

**2. Set Environment Variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

**3. Build Lambda Functions**
```bash
sam build --parallel
```

**4. Run Local API**
```bash
sam local start-api --port 3000
```

**5. Test Endpoints**
```bash
node scripts/test-api-endpoints.js
```

### Deploy to AWS

**Staging**:
```bash
./scripts/deploy-staging.sh
```

**Production**:
```bash
./scripts/deploy-production.sh
```

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for detailed deployment instructions.

### Run Demo

**1. Create Demo Data**
```bash
node scripts/create-demo-data.js
```

**2. Test API**
```bash
node scripts/test-api-endpoints.js
```

**3. View Demo Guide**
See [docs/DEMO-GUIDE.md](docs/DEMO-GUIDE.md) for complete demo walkthrough.

## 📚 Documentation

- **Apache Fineract Docs**: [fineract/README.md](fineract/README.md)
- **Upgrade Strategy**: [docs/Apache_Fineract_Upgrade_Strategy.md](docs/Apache_Fineract_Upgrade_Strategy.md)
- **Fineract v1.13 Highlights**: [docs/FINERACT_V1.13_HIGHLIGHTS.md](docs/FINERACT_V1.13_HIGHLIGHTS.md)
- **Upgrade Log**: [docs/UPGRADE_LOG.md](docs/UPGRADE_LOG.md)

## 📊 Market Opportunity

**Starting narrow, scaling systemically**

Zimbabwe's informal sector represents a massive untapped market for alternative credit solutions. We're starting with device financing (phones as productive assets for informal workers) and expanding systematically.

**Product Roadmap**: Cell phone financing → Digital loans → Motorbike finance → Vehicle finance → Microfinance banking license → Regional expansion (Southern Africa)

## 🎯 Core Features

### For Customers (WhatsApp Bot)
- WhatsApp-based KYC and instant loan approval (<5 mins)
- Browse devices and select repayment plans
- Mobile money payments (EcoCash, Omari)
- Loan management and smart reminders

### For Distributors
- Asset handover with ID verification
- Real-time inventory tracking
- Automated commission management
- Transaction history and reporting

### Admin Platform
- Financial reporting and KPIs
- Payment reconciliation
- Risk management and compliance
- ML model management

### Technology Stack
- Apache Fineract v1.13.0 (core banking)
- AWS Lambda microservices
- Supabase (database + real-time)
- WhatsApp Cloud API
- Hybrid AI/ML credit scoring

## 🥊 Key Differentiators

- ✅ Instant approval (<5 mins) via WhatsApp
- ✅ AI/ML underwriting for informal sector
- ✅ Remote asset-lock technology
- ✅ Mobile money integration
- ✅ Scalable agent network distribution

## 💼 Business Model

**Dual-sided marketplace**: Borrowers ↔ Debt investors

**Revenue**: Interest income + Asset markup

**Distribution**: B2B2C partnerships + Commission-based agent network + WhatsApp viral growth

## 🔄 Staying Updated

Check for Apache Fineract updates:
```bash
# Windows
scripts\check-fineract-updates.bat

# Linux/Mac
scripts/check-fineract-updates.sh
```

## 🏗️ Architecture

**Backend**: AWS Lambda (Node.js/TypeScript + Python for ML)
**Frontend**: Next.js 14
**Database**: Supabase PostgreSQL + Apache Fineract
**Banking**: Apache Fineract v1.13.0 on AWS EC2
**Integrations**: WhatsApp Cloud API, Smile Identity, EcoCash/Omari, device lock providers

**Cost**: $5-25/month (Year 1) leveraging AWS & Supabase free tiers

### Development Workflow
1. Review specs in [lynia-specs/lynia-lending/](lynia-specs/lynia-lending/)
2. Follow [tasks.md](lynia-specs/lynia-lending/tasks.md) implementation order
3. Implement using [plan.md](lynia-specs/lynia-lending/plan.md) milestones
4. TDD approach - tests first

## 📋 Implementation Status

**Current Phase**: Phase 2 Complete ✅

### Phase 2: Backend Infrastructure (COMPLETED)

**Completed Tasks** (14/14):
- ✅ P2-T002: [Database Schema Deployment](P2-T002-PROGRESS.md)
- ✅ P2-T003: [Payment Service](P2-T003-PROGRESS.md)
- ✅ P2-T004: [Credit Scoring Service](P2-T004-PROGRESS.md)
- ✅ P2-T005: [KYC Service](P2-T005-PROGRESS.md)
- ✅ P2-T006: [WhatsApp Service](P2-T006-PROGRESS.md)
- ✅ P2-T007: [Notification Service](P2-T007-PROGRESS.md)
- ✅ P2-T009: [Device Handover Process](P2-T009-PROGRESS.md)
- ✅ P2-T010: [Trustonic Lock/Unlock Integration](P2-T010-PROGRESS.md)
- ✅ P2-T011: [Admin Dashboard Implementation](P2-T011-IMPLEMENTATION-GUIDE.md)
- ✅ P2-T012: [Testing Infrastructure](P2-T012-PROGRESS.md)
- ✅ P2-T013: [AWS Lambda Deployment & CI/CD](P2-T013-PROGRESS.md)
- ✅ P2-T014: [Demo Preparation & Documentation](P2-T014-PROGRESS.md)

**Deliverables**:
- 6 AWS Lambda microservices (TypeScript/Node.js 20.x)
- Complete Supabase database schema (35+ tables)
- CI/CD pipeline (GitHub Actions)
- Deployment automation (AWS SAM)
- Testing infrastructure (Jest + Supertest)
- Demo scenarios & test data
- Comprehensive documentation

**Key Metrics**:
- Services: 6 Lambda functions
- Database tables: 35+
- API endpoints: 45+
- Test coverage: 80%+
- Deployment time: <10 minutes
- Cost: $5-25/month (staging)

### Next: Phase 3 - Frontend & User Flows

**Upcoming** (Starting Week 11):
- Admin Dashboard UI (Next.js 14)
- WhatsApp Bot Conversation Flow
- Payment Gateway Integration
- Device Management UI

See [plan.md](lynia-specs/lynia-lending/plan.md) for full roadmap.

## 📋 Version Information

- Apache Fineract: v1.13.0
- Java: 17 | Gradle: 8.x | Spring Boot: 3.x
- Node.js: 18 LTS | Python: 3.11 | Next.js: 14

## 📚 Documentation

### Platform Documentation
- **Specifications**: [spec.md](lynia-specs/lynia-lending/spec.md) | [plan.md](lynia-specs/lynia-lending/plan.md) | [tasks.md](lynia-specs/lynia-lending/tasks.md)
- **Architecture**: [supabase-architecture.md](lynia-specs/lynia-lending/supabase-architecture.md)
- **System Flows**: [SYSTEM-FLOWS.md](docs/SYSTEM-FLOWS.md)

### Deployment & Operations
- **Deployment Guide**: [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)
- **Testing Guide**: [P2-T012-PROGRESS.md](P2-T012-PROGRESS.md)
- **CI/CD Pipeline**: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

### Demo & Presentation
- **Demo Guide**: [docs/DEMO-GUIDE.md](docs/DEMO-GUIDE.md)
- **Demo Scripts**: [scripts/create-demo-data.js](scripts/create-demo-data.js)
- **API Testing**: [scripts/test-api-endpoints.js](scripts/test-api-endpoints.js)

### Apache Fineract
- **Fineract README**: [fineract/README.md](fineract/README.md)
- **Setup Guide**: [docs/Apache_Fineract_Setup_Guide.pdf](docs/Apache_Fineract_Setup_Guide.pdf)
- **v1.13 Highlights**: [docs/FINERACT_V1.13_HIGHLIGHTS.md](docs/FINERACT_V1.13_HIGHLIGHTS.md)

### Service Documentation
- **WhatsApp Service**: [services/whatsapp-service/](services/whatsapp-service/)
- **Scoring Service**: [services/scoring-service/](services/scoring-service/)
- **KYC Service**: [services/kyc-service/](services/kyc-service/)
- **Payment Service**: [services/payment-service/](services/payment-service/)
- **Lock Service**: [services/lock-service/](services/lock-service/)
- **Notification Service**: [services/notification-service/](services/notification-service/)

## 📄 License

- Apache Fineract: Apache License 2.0
- Lynia Finance: Proprietary

---

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### API Endpoint Tests
```bash
node scripts/test-api-endpoints.js
```

### Local Lambda Testing
```bash
# Test specific function
sam local invoke ScoringFunction --event events/test-scoring-calculate.json

# Start local API
sam local start-api --port 3000
```

---

## 🎬 Demo Scenarios

### Scenario 1: Successful Onboarding
Zimbabwe customer completes full 8-step onboarding, gets approved (Tier 2, $350 limit), pays deposit via EcoCash, picks up device.

### Scenario 2: Non-Zimbabwe Rejection
Customer with Kenya number (+254) tries to register, system rejects appropriately, added to international waitlist.

### Scenario 3: Manual Review
Borderline credit score (640) triggers manual admin review, admin approves with adjusted limit.

### Scenario 4: Payment & Lock
Customer misses payment, device automatically locks after 7 days, customer pays, device unlocks automatically.

**Run All Demo Scenarios**:
```bash
node scripts/create-demo-data.js
```

See [DEMO-GUIDE.md](docs/DEMO-GUIDE.md) for detailed walkthrough.

---

## 🤝 Contributing

This is a proprietary project. For access or collaboration inquiries, contact the team.

---

**Last Updated**: 2025-12-09 | **Status**: Phase 2 Complete ✅ | **Next**: Phase 3 - Frontend Development
