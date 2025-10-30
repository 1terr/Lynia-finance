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

**Current Phase**: Planning & Foundation

**Completed**: Apache Fineract v1.13.0, platform specifications, implementation plan (410+ tasks)

**MVP Timeline**: 19 weeks
- Phase 0-1: Research & design (Weeks 1-8)
- Phase 2: Foundation setup (Weeks 9-10)
- Phase 3-5: Core user flows (Weeks 11-19)

**MVP Scope**: Customer onboarding → Device selection → Payment → Asset handover

See [plan.md](lynia-specs/lynia-lending/plan.md) for full roadmap.

## 📋 Version Information

- Apache Fineract: v1.13.0
- Java: 17 | Gradle: 8.x | Spring Boot: 3.x
- Node.js: 18 LTS | Python: 3.11 | Next.js: 14

## 📚 Documentation

**Platform Specs**: [spec.md](lynia-specs/lynia-lending/spec.md) | [plan.md](lynia-specs/lynia-lending/plan.md) | [tasks.md](lynia-specs/lynia-lending/tasks.md) | [architecture](lynia-specs/lynia-lending/supabase-architecture.md)

**Apache Fineract**: [README](fineract/README.md) | [Setup Guide](docs/Apache_Fineract_Setup_Guide.pdf) | [v1.13 Highlights](docs/FINERACT_V1.13_HIGHLIGHTS.md)

## 📄 License

- Apache Fineract: Apache License 2.0
- Lynia Finance: Proprietary

---

**Last Updated**: 2025-10-30 | **Status**: Planning Phase | **MVP Target**: 19 weeks
