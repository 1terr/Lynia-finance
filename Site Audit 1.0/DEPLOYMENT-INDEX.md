# Lynia Finance — Deployment Index

**Last updated:** 2026-02-17
**Production status:** LIVE

---

## Quick Links — Production

| Service | URL | Status |
|---------|-----|--------|
| API Gateway | `https://api.lyniafinance.com` | Live (auth required) |
| Admin Portal | `https://admin.lyniafinance.com` | Live |
| Distributor Dashboard | `https://distributor.lyniafinance.com` | Live |
| Landing Page | `https://lyniafinance.com` | Live |

---

## All Phases & Reports

### Phase 1 — Codebase Discovery
| Report | Description |
|--------|-------------|
| [Phase-1-Codebase-Discovery.md](Phase-1-Codebase-Discovery.md) | Full codebase inventory, architecture mapping, service boundaries |
| [Phase-1B-Fineract-Assessment.md](Phase-1B-Fineract-Assessment.md) | Apache Fineract integration assessment |
| [Phase-1B-Progress-Report.md](Phase-1B-Progress-Report.md) | Fineract assessment progress tracking |

### Phase 2 — User Journeys
| Report | Description |
|--------|-------------|
| [Phase-2-User-Journeys.md](Phase-2-User-Journeys.md) | End-to-end user flows: onboarding, loans, payments, device lock |

### Phase 3 — Code-Level Audit
| Report | Description |
|--------|-------------|
| [Phase-3-Code-Level-Audit.md](Phase-3-Code-Level-Audit.md) | Code quality, security vulnerabilities, pattern analysis |

### Phase 4 — Blocker Analysis
| Report | Description |
|--------|-------------|
| [Phase-4-Blocker-Analysis.md](Phase-4-Blocker-Analysis.md) | Deployment blockers, dependency mapping, resolution plan |

### Phase 5 — AWS Infrastructure Deployment
| Report | Description |
|--------|-------------|
| [../phase-5-aws-deployment/PHASE-5-SUMMARY-REPORT.md](../phase-5-aws-deployment/PHASE-5-SUMMARY-REPORT.md) | Master summary — 17 deployment tasks |
| [../phase-5-aws-deployment/PHASE-5-TASKS.md](../phase-5-aws-deployment/PHASE-5-TASKS.md) | Task breakdown and status tracking |
| [../phase-5-aws-deployment/task-reports/](../phase-5-aws-deployment/task-reports/) | Individual task reports (P5-DEPLOY-T001 through T017) |

**Phase 5 Task Summary:**

| Task | Description | Status |
|------|-------------|--------|
| P5-DEPLOY-T001 | SAM deployment buckets | COMPLETED |
| P5-DEPLOY-T002 | VPC + private subnets | COMPLETED |
| P5-DEPLOY-T003 | Cognito User Pool | COMPLETED |
| P5-DEPLOY-T004 | RDS PostgreSQL + migrations | COMPLETED |
| P5-DEPLOY-T005 | Secrets Manager | COMPLETED |
| P5-DEPLOY-T006 | S3 storage buckets | COMPLETED |
| P5-DEPLOY-T007 | IAM roles for Lambda | COMPLETED |
| P5-DEPLOY-T008 | SQS async queues | COMPLETED |
| P5-DEPLOY-T009 | WAF rules | COMPLETED |
| P5-DEPLOY-T010 | SAM Lambda deploy (6 services) | COMPLETED |
| P5-DEPLOY-T011 | Frontend S3 + CloudFront | COMPLETED |
| P5-DEPLOY-T012 | DNS + ACM certificates | COMPLETED |
| P5-DEPLOY-T013 | CI/CD pipeline (`deploy.yml`) | COMPLETED |
| P5-DEPLOY-T014 | Frontend CI/CD (`deploy-frontend.yml`) | COMPLETED |
| P5-DEPLOY-T015 | Database migration CI/CD | COMPLETED |
| P5-DEPLOY-T016 | Cognito initial users | COMPLETED |
| P5-DEPLOY-T017 | End-to-end validation | COMPLETED |

### Phase 6 — Fineract Integration & Deployment
| Report | Description |
|--------|-------------|
| [Phase-6-Fineract-Deployment-Report.md](Phase-6-Fineract-Deployment-Report.md) | Fineract ECS Fargate deployment |
| [Phase-6-Fineract-AWS-Architecture.md](Phase-6-Fineract-AWS-Architecture.md) | Fineract AWS architecture design |
| [Phase-6-Fineract-Upgrade-Guide.md](Phase-6-Fineract-Upgrade-Guide.md) | Fineract version upgrade runbook |
| [Phase-6-Deployment-Lessons-Learned.md](Phase-6-Deployment-Lessons-Learned.md) | Lessons learned from deployment |
| [Phase-6B-Integration-Code-Report.md](Phase-6B-Integration-Code-Report.md) | Integration code review |
| [Phase-6C-Full-Integration-Report.md](Phase-6C-Full-Integration-Report.md) | Complete integration validation |

### Phase 7 — Fineract Init, Monitoring & DB Setup
| Report | Description |
|--------|-------------|
| [Phase-7-Deployment-Strategy.md](Phase-7-Deployment-Strategy.md) | Deployment strategy and planning |
| [Phase-7-Deployment-Report.md](Phase-7-Deployment-Report.md) | Fineract init Lambda, CloudWatch dashboards, DB schema |

### Phase 8 — Implementation & CI/CD Fixes
| Report | Description |
|--------|-------------|
| [Phase-8-Implementation-Report.md](Phase-8-Implementation-Report.md) | SQS retry queues, cfn-lint fixes, frontend deployments |
| [Phase-8-Next-Recommendations.md](Phase-8-Next-Recommendations.md) | Post-Phase 8 recommendations |
| [Phase-8B-Deferred-Items-Implementation-Report.md](Phase-8B-Deferred-Items-Implementation-Report.md) | Deferred items from earlier phases |

### Phase 9 — Fineract Proxy Backend
| Report | Description |
|--------|-------------|
| [Phase-9-Fineract-Proxy-Backend-Report.md](Phase-9-Fineract-Proxy-Backend-Report.md) | Fineract proxy Lambda deployment and configuration |

### Phase 10 — Recommendations
| Report | Description |
|--------|-------------|
| [Phase-10-Next-Recommendations.md](Phase-10-Next-Recommendations.md) | Prioritized next steps and feature roadmap |

### Phase 11 — Loan Route Consolidation
| Report | Description |
|--------|-------------|
| [Phase-11-Loan-Route-Consolidation-Report.md](Phase-11-Loan-Route-Consolidation-Report.md) | Consolidated `/loans/` and `/fineract/loans/` into single route |

### Phase 12 — Full Production Deployment
| Report | Description |
|--------|-------------|
| [Phase-12-Production-Deployment-Report.md](Phase-12-Production-Deployment-Report.md) | Backend + 3 frontends deployed to production via CI/CD |

---

## Cross-Cutting Reports

| Report | Description |
|--------|-------------|
| [FULL-AUDIT-REPORT.md](FULL-AUDIT-REPORT.md) | Comprehensive site audit (all findings) |
| [Deployment-Audit-Report.md](Deployment-Audit-Report.md) | Git, AWS, CI/CD, and live site audit |
| [Deployment-Remediation-Report.md](Deployment-Remediation-Report.md) | Fixes applied after deployment audit |
| [Action-Plan.md](Action-Plan.md) | Prioritized action plan from audit findings |
| [../ADMIN-PANEL-AUDIT-REPORT.md](../ADMIN-PANEL-AUDIT-REPORT.md) | Admin panel specific audit |

## Appendices

| Report | Description |
|--------|-------------|
| [Appendix-A-Page-Inventory.md](Appendix-A-Page-Inventory.md) | All frontend pages and routes |
| [Appendix-B-API-Inventory.md](Appendix-B-API-Inventory.md) | All API endpoints |
| [Appendix-C-Tech-Stack.md](Appendix-C-Tech-Stack.md) | Technology stack details |

---

## AWS CloudFormation Stacks (Production)

| Stack | Type | Status |
|-------|------|--------|
| `lynia-finance-prod` | Lambda services + API Gateway | UPDATE_COMPLETE |
| `lynia-finance-prod-frontend` | S3 + CloudFront (3 sites) | UPDATE_COMPLETE |
| `production-lynia-vpc` | VPC + subnets + NAT | CREATE_COMPLETE |
| `production-lynia-cognito` | Cognito User Pool | UPDATE_COMPLETE |
| `lynia-rds-production` | RDS PostgreSQL 16 | CREATE_COMPLETE |
| `production-lynia-sqs` | SQS queues + DLQs | CREATE_COMPLETE |
| `lynia-finance-production-waf` | WAF rules | CREATE_COMPLETE |
| `production-lynia-fineract-ecs` | Fineract on ECS Fargate | UPDATE_COMPLETE |
| `production-lynia-fineract-init` | Fineract initialization | UPDATE_COMPLETE |
| `production-lynia-fineract-monitoring` | CloudWatch dashboards | CREATE_COMPLETE |
| `production-lynia-fineract-db-init` | Database init Lambda | CREATE_COMPLETE |

---

## CI/CD Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| Deploy to AWS | `deploy.yml` | Push to master / manual | Backend Lambda deployment |
| Deploy Frontend | `deploy-frontend.yml` | Push to frontend/** / manual | Blue-green frontend deployment |
| Run DB Migrations | `run-db-migrations.yml` | Manual only | SQL migrations against RDS |
| Deploy Cognito | `deploy-cognito.yml` | Manual | Cognito User Pool updates |
| Deploy IAM Roles | `deploy-iam-roles.yml` | Manual | Lambda IAM roles |
| Deploy SQS | `deploy-sqs.yml` | Manual | SQS queue management |
| Deploy S3 Buckets | `deploy-storage-buckets.yml` | Manual | S3 bucket management |
| Deploy Secrets | `deploy-secrets-manager.yml` | Manual | Secrets Manager structure |
| Test & Build | `test.yml` | Push + PRs | CI testing (no deploy) |
