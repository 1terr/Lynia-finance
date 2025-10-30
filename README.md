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
- Java 17 or higher
- Docker & Docker Compose (optional)
- Git

### Build the Project
```bash
./gradlew clean build
```

### Run Tests
```bash
./gradlew test
```

### Run with Docker
```bash
cd fineract
docker-compose up
```

## 📚 Documentation

- **Apache Fineract Docs**: [fineract/README.md](fineract/README.md)
- **Upgrade Strategy**: [docs/Apache_Fineract_Upgrade_Strategy.md](docs/Apache_Fineract_Upgrade_Strategy.md)
- **Fineract v1.13 Highlights**: [docs/FINERACT_V1.13_HIGHLIGHTS.md](docs/FINERACT_V1.13_HIGHLIGHTS.md)
- **Upgrade Log**: [docs/UPGRADE_LOG.md](docs/UPGRADE_LOG.md)

## 📊 Market Opportunity

**Starting narrow, scaling systemically**

- **TAM**: $12M annual mobile phone imports in Zimbabwe—our entry point into asset-based lending
- **SAM**: $8M financing potential based on informal sector demand and mobile money penetration
- **SOM**: $2M target market of underbanked phone buyers

**Product Roadmap**: Cell phone financing → Digital loans → Motorbike finance → Vehicle finance → Microfinance banking license → Regional expansion (Southern Africa)

## 🎯 Core Features

### Customer Journey (WhatsApp Bot)
- **KYC & Onboarding**: Conversational KYC submission via WhatsApp with Smile Identity verification
- **Instant Credit Scoring**: Hybrid scoring combining Apache Fineract Scorecard + ML models for underbanked customers
- **Device Catalog**: Browse phones with monthly repayment plans directly in WhatsApp
- **Mobile Money Payments**: EcoCash & Omari integration for deposits and repayments
- **Loan Management**: Check balance, make repayments, request extensions via WhatsApp
- **Smart Reminders**: Automated payment reminders (3-day, 1-day) with payment links
- **Default Management**: Grace period calculation based on payment history, final warnings, device lock integration

### Distributor Operations
- **Asset Handover**: ID verification, IMEI scanning, instant handover approval
- **Real-time Inventory**: Live stock tracking with WebSocket updates (<1s latency)
- **Commission Tracking**: Automatic commission calculation (3-5% of device price) with weekly batch payments
- **Handover History**: Searchable transaction logs with export capabilities
- **Low Stock Alerts**: Automated restock notifications via WhatsApp/dashboard

### Admin Platform
- **Financial Reporting**: Real-time KPIs, loan portfolio metrics, default rates
- **Commission Management**: Weekly batch approval, automated payments, manual adjustments with audit trails
- **Payment Reconciliation**: Auto-reconciliation with 6-hour background jobs, manual resolution for failures
- **Risk & Compliance**: RBZ FIU reporting, 7-year data retention, ML model A/B testing
- **RBAC**: Role-based access control (Super Admin, Financial Ops, Risk/Compliance, Customer Support)

### Technical Platform
- **Apache Fineract v1.13.0**: Core banking engine for loan management, accounting, and financial operations
- **Microservices Architecture**: 9 AWS Lambda functions for scalability and cost efficiency
- **Supabase Platform**: PostgreSQL database, real-time subscriptions, Edge Functions, Auth with RLS
- **WhatsApp Cloud API**: Native Meta integration (1000 free conversations/month)
- **Hybrid Credit Scoring**: ML models with A/B testing, one-click rollback, prediction logging

## 🥊 Competitive Landscape

**We're not in the lending business. We're in the system-building business—and no one else is.**

### Traditional Lenders & Retailers
- Finance only for salaried individuals with formal employment
- Offline, paper-based loan applications
- Laybye purchase models requiring upfront deposits

### Fintech Competitors
- **Zimloan**: Digital loans for formal sector workers
- **Soshopay**: Buy-now-pay-later for e-commerce

### Our Differentiators
These aren't just features—they're **structural advantages adapted for the underbanked**:

- ✅ **<5 minute approval**: WhatsApp-based KYC and instant AI/ML credit decisioning
- ✅ **Embedded asset insurance**: Built into every loan to protect both customer and lender
- ✅ **Remote asset-lock**: Real-time repayment discipline through technology enforcement
- ✅ **Mobile money repayments**: Direct integration with EcoCash/Omari for seamless collection
- ✅ **Scalable distribution**: Commission-based agent network + B2B2C partnerships (retailers, delivery platforms)

## 💼 Business Model

**Dual-sided marketplace connecting borrowers and debt investors**

### Revenue Sources
- **Interest income/commissions**: Margin on loan interest and financing fees
- **Asset markup**: Retail margin on financed devices (phones, motorbikes, vehicles)

### Unit Economics
- Average phone landed cost: **$90**
- Average phone retail price: **$100** (11% margin)
- Average loan amount: **$180** (80% financed over 8 months)
- Target loan margin: **25-50% APR** (competitive for asset-backed lending in informal markets)

### Go-to-Market Strategy
Cost-effective, commission-based distribution powered by technology:

1. **B2B2C**: Establish distribution partnerships with phone retailers and electronics shops
2. **Agent Network**: Commission-based local agents for device handover and KYC verification
3. **B2C Direct**: Viral WhatsApp growth for direct customer acquisition
4. **Platform Partnerships**: Integration with delivery platforms (motorbikes) and ride-hailing (vehicles)

## 🔄 Staying Updated

Check for Apache Fineract updates:
```bash
# Windows
scripts\check-fineract-updates.bat

# Linux/Mac
scripts/check-fineract-updates.sh
```

## 🏗️ Architecture

### Technology Stack

**Backend Services (AWS Lambda)**
- Node.js 18 / TypeScript for most microservices
- Python 3.11 for ML scoring service
- AWS SAM for serverless deployment
- API Gateway for HTTP endpoints

**Frontend**
- Next.js 14 with App Router
- React Server Components
- TailwindCSS for styling
- WebSocket client for real-time updates

**Data Layer**
- **Supabase PostgreSQL**: Operational data (500MB free tier optimized with compression & partitioning)
- **Apache Fineract DB**: Loan accounts, repayment schedules, transactions
- **Supabase Realtime**: Live inventory updates, commission dashboards
- **Supabase Storage**: Commission PDFs, KYC documents (1GB free)

**Core Banking**
- Apache Fineract v1.13.0 on AWS EC2 t3.micro (Docker Compose)
- Connects to Supabase PostgreSQL for data persistence

**External Integrations**
- **WhatsApp Cloud API** (Meta Graph API v18.0) - Conversational interface
- **Smile Identity** - Zimbabwe national ID verification & liveness detection
- **EcoCash & Omari** - Mobile money payment gateways
- **Africa's Talk** - SMS for Next of Kin verification ($0.008/SMS)
- **Third-party Lock Provider** - Device lock/unlock API

### Cost Optimization (YC Bootstrap)

**Year 1 Monthly Costs: $5-25**
- AWS Lambda: $0 (1M requests/month free)
- AWS EC2 t3.micro: $0 (750 hrs/month free for 12 months)
- AWS API Gateway: $0 (1M requests/month free for 12 months)
- Supabase: $0 (FREE tier with 500MB database)
- WhatsApp Cloud API: $0 (1000 conversations/month free)
- Africa's Talk SMS: $0.80/month (100 SMS for Next of Kin verification)
- Smile Identity: Pay-per-verification (~$5-15/month based on volume)
- Payment Gateway Fees: Variable (per-transaction)

**Year 2+ Monthly Costs: $30-40**
- AWS EC2 Reserved Instance: $8/month (or AWS Lightsail $5/month)
- Supabase Pro: $25/month (if exceeding 500MB)
- All other services remain on free tiers

### Project Organization
- **Apache Fineract Core**: All Fineract files in [fineract/](fineract/)
- **Platform Specs**: Complete specifications in [lynia-specs/lynia-lending/](lynia-specs/lynia-lending/)
- **Microservices**: Backend services in `services/` (to be implemented)
- **Frontends**: Admin & distributor portals in `frontend/` (to be implemented)
- **Infrastructure**: AWS SAM templates in `infrastructure/` (to be implemented)

### Development Workflow
1. Review specifications in [lynia-specs/lynia-lending/](lynia-specs/lynia-lending/)
2. Follow [tasks.md](lynia-specs/lynia-lending/tasks.md) for implementation order
3. Implement services following [plan.md](lynia-specs/lynia-lending/plan.md) milestones
4. All changes must follow Test-Driven Development (TDD) - tests written first
5. Commit after each task or logical group

## 📋 Implementation Status

**Current Phase**: Foundation & Planning

### Completed
- ✅ Apache Fineract v1.13.0 upgraded and configured
- ✅ Complete platform specifications ([spec.md](lynia-specs/lynia-lending/spec.md))
- ✅ Detailed implementation plan ([plan.md](lynia-specs/lynia-lending/plan.md))
- ✅ 410+ implementation tasks defined ([tasks.md](lynia-specs/lynia-lending/tasks.md))
- ✅ Cost optimization strategy ($5-25/month Year 1)
- ✅ Database architecture designed (Supabase + Fineract)

### Next Steps (MVP - Weeks 1-19)
1. **Phase 0**: Research & vendor evaluation (Weeks 1-3)
   - WhatsApp Cloud API, Africa's Talk SMS, Smile Identity, EcoCash/Omari, Device Lock Provider
2. **Phase 1**: Design documentation (Weeks 4-8)
   - Data models, API contracts, event architecture, security, observability
3. **Phase 2**: Foundation (Weeks 9-10)
   - Monorepo setup, database migrations, authentication, Fineract integration
4. **Phase 3-5**: MVP User Stories (Weeks 11-19)
   - US1: Customer onboarding & KYC (P1)
   - US2: Asset selection & deposit payment (P2)
   - US3: Asset collection & verification (P2)

**MVP Goal**: End-to-end customer journey - KYC submission → device selection → payment → handover

### Future Phases (Post-MVP)
- US4-5: Repayment management, extensions, device lock (P3-P4)
- US6-8: Customer support, agent features, inventory management (P3-P4)
- Admin portal & commission management
- ML model management & A/B testing

See [lynia-specs/lynia-lending/plan.md](lynia-specs/lynia-lending/plan.md) for complete roadmap.

## 📋 Version Information

- **Apache Fineract**: v1.13.0
- **Java Version**: 17
- **Gradle Version**: 8.x
- **Spring Boot**: 3.x
- **Node.js**: 18 LTS
- **Python**: 3.11 (for ML service)
- **Next.js**: 14

## 📚 Key Documentation

### Platform Specifications
- **[Specification](lynia-specs/lynia-lending/spec.md)**: Complete feature specification with 8 user stories, 52+ functional requirements, success criteria
- **[Implementation Plan](lynia-specs/lynia-lending/plan.md)**: 13 milestones, 36-week timeline, MVP strategy
- **[Tasks](lynia-specs/lynia-lending/tasks.md)**: 410+ detailed implementation tasks organized by phase
- **[Implementation Guide](lynia-specs/lynia-lending/implementation-guide.md)**: Cost optimization strategy and architecture decisions
- **[Supabase Architecture](lynia-specs/lynia-lending/supabase-architecture.md)**: Database design, table schemas, optimization techniques
- **[Cost Optimization](lynia-specs/lynia-lending/cost-optimization.md)**: YC bootstrap cost breakdown and savings analysis

### Apache Fineract
- **[Fineract README](fineract/README.md)**: Apache Fineract documentation
- **[Setup Guide](docs/Apache_Fineract_Setup_Guide.pdf)**: Installation and configuration
- **[Upgrade Strategy](docs/Apache_Fineract_Upgrade_Strategy.md)**: Upgrade process and best practices
- **[v1.13 Highlights](docs/FINERACT_V1.13_HIGHLIGHTS.md)**: New features in v1.13.0
- **[Upgrade Log](docs/UPGRADE_LOG.md)**: Version history and changes

## 🔗 Useful Links

### Apache Fineract
- **Official Website**: https://fineract.apache.org/
- **GitHub Repository**: https://github.com/apache/fineract
- **Documentation**: https://fineract.apache.org/docs/
- **Community**: https://fineract.apache.org/community.html

### External Services
- **WhatsApp Cloud API**: https://developers.facebook.com/docs/whatsapp/cloud-api
- **Supabase**: https://supabase.com/docs
- **AWS Lambda**: https://docs.aws.amazon.com/lambda/
- **Smile Identity**: https://docs.usesmileid.com/

## 📞 Support

For issues or questions:
- Review specifications in [lynia-specs/lynia-lending/](lynia-specs/lynia-lending/)
- Check Apache Fineract docs in [fineract/README.md](fineract/README.md)
- Review project documentation in [docs/](docs/)

## 📄 License

- **Apache Fineract**: Apache License 2.0 (see [fineract/LICENSE_SOURCE](fineract/LICENSE_SOURCE))
- **Lynia Finance**: Proprietary

---

**Last Updated**: 2025-10-30
**Project Status**: Planning & Foundation Phase
**Target Launch**: MVP in 19 weeks (5 months)
**Maintained By**: Lynia Finance Development Team
