# Phase 5 Development Tasks

**Phase**: Phase 5 - AWS Deployment
**Duration**: Weeks 19-21 (February-March 2026)
**Status**: Ready to Start
**Goal**: Deploy all AWS infrastructure, run database migrations, configure CI/CD, and validate the complete production environment end-to-end

---

## Phase Context

| Phase | Status | Deliverables |
|-------|--------|-------------|
| **Phase 0**: Research & API Discovery | COMPLETED | 68 research tasks, API integrations validated |
| **Phase 1**: Architecture & Design | COMPLETED | 45 specifications, 20,100+ lines of docs |
| **Phase 2**: Backend Infrastructure | COMPLETED | 6 Lambda services, 35+ tables, CI/CD |
| **Phase 3**: Frontend & Features | COMPLETED | 29 tasks, 21 service files, 4 migrations |
| **Phase 4**: Integration Testing & Deployment | COMPLETED | 15 tasks, E2E tests, deployment runbook |
| **Phase 5**: AWS Deployment | NOT STARTED | 17 tasks planned |

---

## Task Overview

| Task ID | Task Name | Priority | Estimate | Status | Dependencies |
|---------|-----------|----------|----------|--------|--------------|
| P5-DEPLOY-T001 | Prerequisites & S3 Template Bucket Setup | Critical | 3h | ✅ Completed | None |
| P5-DEPLOY-T002 | Deploy VPC Stack | Critical | 2h | ✅ Completed | T001 |
| P5-DEPLOY-T003 | Deploy Cognito User Pool Stack | Critical | 2h | ✅ Completed | T001 |
| P5-DEPLOY-T004 | Deploy RDS PostgreSQL Stack | Critical | 3h | ✅ Completed | T002 |
| P5-DEPLOY-T005 | Deploy S3 Storage Buckets Stack | High | 1h | ⚪ Not Started | T001 |
| P5-DEPLOY-T006 | Deploy SQS Queues Stack | High | 1h | 🟡 In Progress | T001 |
| P5-DEPLOY-T007 | Deploy Secrets Manager Stack | Critical | 2h | ⚪ Not Started | T004 |
| P5-DEPLOY-T008 | Deploy IAM Roles Stack | High | 2h | ⚪ Not Started | T001 |
| P5-DEPLOY-T009 | Run Database Migrations to RDS | Critical | 3h | ⚪ Not Started | T004 |
| P5-DEPLOY-T010 | Build & Deploy Lambda Functions (SAM) | Critical | 4h | ⚪ Not Started | T002, T003, T006, T007, T008 |
| P5-DEPLOY-T011 | Deploy API Gateway Throttling & Usage Plans | High | 2h | ⚪ Not Started | T010 |
| P5-DEPLOY-T012 | Deploy WAF & CloudWatch Monitoring | High | 3h | ⚪ Not Started | T010 |
| P5-DEPLOY-T013 | Deploy DNS, SSL & Custom Domains | Critical | 3h | ⚪ Not Started | T010 |
| P5-DEPLOY-T014 | Deploy Frontend Hosting & Upload Assets | Critical | 4h | ⚪ Not Started | T003, T013 |
| P5-DEPLOY-T015 | Deploy Lambda Auto-Scaling & Canary Deployments | High | 2h | ⚪ Not Started | T010 |
| P5-DEPLOY-T016 | Create Initial Cognito Users & Configure GitHub Secrets | High | 2h | ⚪ Not Started | T003, T010 |
| P5-DEPLOY-T017 | End-to-End Deployment Validation & Smoke Tests | Critical | 4h | ⚪ Not Started | All tasks |

**Total Estimated Time**: 43 hours

---

## Deployment Dependency Graph

```
T001 (Prerequisites) ─┬─→ T002 (VPC) ──→ T004 (RDS) ─┬─→ T007 (Secrets) ──┐
                       │                                │                     │
                       │                                └─→ T009 (DB Migrate) │
                       ├─→ T003 (Cognito) ────────────────────────────────────┤
                       ├─→ T005 (S3 Buckets) ────────────────────────────────┤
                       ├─→ T006 (SQS) ──────────────────────────────────────┤
                       └─→ T008 (IAM Roles) ────────────────────────────────┤
                                                                             │
                                         ┌───────────────────────────────────┘
                                         ▼
                                  T010 (SAM Lambda) ─┬─→ T011 (Throttling)
                                                     ├─→ T012 (WAF + Monitoring)
                                                     ├─→ T013 (DNS/SSL) → T014 (Frontend)
                                                     └─→ T015 (AutoScaling + Canary)

                                  T003 + T010 ──────→ T016 (Users + GitHub)
                                  All ──────────────→ T017 (E2E Validation)
```

**Parallel Execution Groups**:
- **Layer 1**: T002, T003, T005, T006, T008 (all independent after T001)
- **Layer 2**: T004 (needs VPC), T007 (needs RDS), T009 (needs RDS)
- **Layer 3**: T010 (needs VPC, Cognito, SQS, Secrets, IAM)
- **Layer 4**: T011, T012, T013, T015 (all independent after T010)
- **Layer 5**: T014 (needs Cognito + DNS), T016 (needs Cognito + Lambda)
- **Final**: T017 (needs everything)

---

## Week 19: Foundation Infrastructure (Days 1-5)

### P5-DEPLOY-T001: Prerequisites & S3 Template Bucket Setup
**Priority**: Critical
**Estimate**: 3 hours
**Status**: ✅ Completed (automation scripts created, 19 templates validated)
**Dependencies**: None

**Objective**: Verify all CLI tools and AWS credentials are in place. Create the S3 buckets for CloudFormation template storage and SAM artifact uploads. Upload all infrastructure templates.

**Tasks**:
- [ ] Verify AWS CLI v2, SAM CLI, Node.js 20.x, pnpm, and psql are installed
- [ ] Confirm AWS credentials with `aws sts get-caller-identity`
- [ ] Confirm target region is `us-east-1`
- [ ] Create S3 template bucket: `lynia-finance-{env}-templates`
- [ ] Upload all 16+ CloudFormation YAML templates to template bucket
- [ ] Create SAM artifact bucket: `lynia-finance-{env}-artifacts`
- [ ] Validate all templates with `aws cloudformation validate-template`

**Deliverables**:
- Both S3 buckets created and accessible
- All CloudFormation templates uploaded and validated
- Tool versions documented

**Success Criteria**:
- [ ] `aws sts get-caller-identity` returns correct account
- [ ] `aws s3 ls s3://lynia-finance-{env}-templates/` lists 16+ YAML files
- [ ] All templates pass `aws cloudformation validate-template`

**Reference Files**:
- `infrastructure/aws/*.yaml` — All CloudFormation templates
- `infrastructure/monitoring/*.yaml` — Monitoring templates
- `infrastructure/aws/api-gateway/*.yaml` — API Gateway throttling template
- `infrastructure/aws/production.env.template` — Region/config reference

---

### P5-DEPLOY-T002: Deploy VPC Stack
**Priority**: Critical
**Estimate**: 2 hours
**Status**: ✅ Completed (template reviewed, deploy script with 11 verification checks)
**Dependencies**: P5-DEPLOY-T001

**Objective**: Deploy the complete VPC with public subnets (NAT gateways), private subnets (Lambda), NAT gateways, route tables, security groups, and VPC endpoints. Production creates dual NAT gateways for HA.

**Tasks**:
- [ ] Deploy `infrastructure/aws/vpc.yaml` as stack `{env}-lynia-vpc`
- [ ] Wait for stack to reach `CREATE_COMPLETE`
- [ ] Verify dual NAT gateways created (production mode)
- [ ] Verify 4 VPC endpoints are active (Secrets Manager, CloudWatch Logs, SQS, X-Ray)
- [ ] Record outputs: VpcId, PrivateSubnet1Id, PrivateSubnet2Id, LambdaSecurityGroupId

**Deliverables**:
- VPC with 10.0.0.0/16 CIDR deployed
- 2 public subnets + 2 private subnets across 2 AZs
- NAT gateways operational
- VPC endpoints reducing NAT gateway costs

**Success Criteria**:
- [ ] Stack status: `CREATE_COMPLETE`
- [ ] 2 NAT gateways in `available` state (production)
- [ ] 4 VPC endpoints all `available`
- [ ] Lambda security group allows egress on 443 (HTTPS) and 5432 (PostgreSQL)

**Reference Files**:
- `infrastructure/aws/vpc.yaml`

---

### P5-DEPLOY-T003: Deploy Cognito User Pool Stack
**Priority**: Critical
**Estimate**: 2 hours
**Status**: ✅ Completed (3 template fixes, deploy script + GitHub Actions workflow)
**Dependencies**: P5-DEPLOY-T001

**Objective**: Deploy the Cognito User Pool with admin portal and distributor dashboard app clients, 5 user groups, MFA optional, advanced security enforced, and strong password policy.

**Tasks**:
- [ ] Deploy `infrastructure/aws/cognito.yaml` as stack `{env}-lynia-cognito`
- [ ] Verify User Pool created with correct password policy (12+ chars)
- [ ] Verify 2 app clients created (admin-portal, distributor-dashboard)
- [ ] Verify 5 user groups created (admin, manager, support, reports_viewer, distributor)
- [ ] Record outputs: UserPoolId, UserPoolArn, AdminClientId, DistributorClientId

**Deliverables**:
- Cognito User Pool with email-based authentication
- Admin portal client (1h access, 30d refresh tokens)
- Distributor dashboard client (1h access, 7d refresh tokens)
- Role-based access control via user groups

**Success Criteria**:
- [ ] Stack status: `CREATE_COMPLETE`
- [ ] User Pool status: `Enabled`
- [ ] MFA configuration: `OPTIONAL`
- [ ] 5 groups listed via `list-groups`
- [ ] Both app clients have correct token expiration settings

**Reference Files**:
- `infrastructure/aws/cognito.yaml`

---

### P5-DEPLOY-T004: Deploy RDS PostgreSQL Stack
**Priority**: Critical
**Estimate**: 3 hours
**Status**: ✅ Completed (4 bugs fixed, engine 16.11, deploy script ready)
**Dependencies**: P5-DEPLOY-T002

**Objective**: Deploy RDS PostgreSQL 16.4 into VPC private subnets. Production mode: MultiAZ, 35-day backups, deletion protection, performance insights, KMS encryption. Instance creation takes 10-15 minutes.

**Tasks**:
- [ ] Generate a secure master password (24+ chars, alphanumeric)
- [ ] Deploy `infrastructure/aws/rds.yaml` as stack `{env}-lynia-rds`
- [ ] Wait for RDS instance to reach `available` state (10-15 min)
- [ ] Verify MultiAZ, encryption, deletion protection enabled (production)
- [ ] Record outputs: DatabaseEndpoint, DatabasePort, DatabaseSecurityGroupId
- [ ] Store the master password securely (will be added to Secrets Manager in T007)

**Deliverables**:
- RDS PostgreSQL 16.4 instance in private subnets
- Encrypted storage with auto-scaling to 100GB
- Automated backups with 35-day retention (production)

**Success Criteria**:
- [ ] `DBInstanceStatus`: `available`
- [ ] `MultiAZ`: `true` (production)
- [ ] `StorageEncrypted`: `true`
- [ ] `DeletionProtection`: `true` (production)
- [ ] `Engine`: `postgres`, `EngineVersion`: `16.4`
- [ ] Instance accessible from Lambda security group on port 5432

**Reference Files**:
- `infrastructure/aws/rds.yaml`

---

### P5-DEPLOY-T005: Deploy S3 Storage Buckets Stack
**Priority**: High
**Estimate**: 1 hour
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T001

**Objective**: Deploy 4 application S3 buckets with appropriate encryption, lifecycle policies, and public access blocks.

**Tasks**:
- [ ] Deploy `infrastructure/aws/storage-buckets.yaml` as stack `{env}-lynia-storage`
- [ ] Verify all 4 buckets created (kyc-documents, commission-pdfs, reconciliation-photos, ml-models)
- [ ] Verify KYC bucket uses KMS encryption
- [ ] Verify public access blocks on all buckets
- [ ] Verify lifecycle policies (KYC: 10yr intelligent tiering, commission: 1yr Glacier)

**Deliverables**:
- 4 S3 buckets with RBZ-compliant retention policies
- KMS encryption on KYC documents (sensitive PII)
- Automatic archival via lifecycle rules

**Success Criteria**:
- [ ] Stack status: `CREATE_COMPLETE`
- [ ] All 4 buckets have `PublicAccessBlockConfiguration` fully enabled
- [ ] KYC bucket encryption: `aws:kms`
- [ ] Commission bucket lifecycle: transition to GLACIER after 365 days

**Reference Files**:
- `infrastructure/aws/storage-buckets.yaml`

---

### P5-DEPLOY-T006: Deploy SQS Queues Stack
**Priority**: High
**Estimate**: 1 hour
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T001

**Objective**: Deploy 5 SQS queues with dead-letter queues for async processing: notifications, payment callbacks, KYC processing, device locks, and credit scoring.

**Tasks**:
- [ ] Deploy `infrastructure/aws/sqs-queues.yaml` as stack `{env}-lynia-sqs`
- [ ] Verify 5 main queues + 5 DLQs created (10 total)
- [ ] Verify redrive policies: payment-callbacks has `maxReceiveCount: 5`; others have `3`
- [ ] Record outputs: queue URLs and ARNs for all 5 queues

**Deliverables**:
- 5 SQS queues with long polling enabled
- 5 dead-letter queues for failed message capture
- Redrive policies with service-appropriate retry counts

**Success Criteria**:
- [ ] Stack status: `CREATE_COMPLETE`
- [ ] `aws sqs list-queues --queue-name-prefix {env}-lynia` returns 10 queues
- [ ] Payment callback queue: `maxReceiveCount: 5`
- [ ] All queues have `ReceiveMessageWaitTimeSeconds: 20` (long polling)

**Reference Files**:
- `infrastructure/aws/sqs-queues.yaml`

---

### P5-DEPLOY-T007: Deploy Secrets Manager Stack
**Priority**: Critical
**Estimate**: 2 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T004

**Objective**: Deploy Secrets Manager with 7 secrets and 6 IAM managed policies. Requires RDS endpoint from T004 for the database secret.

**Tasks**:
- [ ] Collect RDS endpoint from T004 stack outputs
- [ ] Collect external API credentials (or sandbox placeholders)
- [ ] Deploy `infrastructure/aws/secrets-manager.yaml` as stack `{env}-lynia-secrets`
- [ ] Verify 7 secrets created (database, whatsapp, smile-identity, ecocash, onemoney, trustonic, sms)
- [ ] Verify 6 IAM managed policies created (one per service)
- [ ] Test that database secret contains correct RDS connection info

**Deliverables**:
- 7 centralized secrets with environment-prefixed naming
- 6 least-privilege IAM policies for per-service secret access
- Database secret with RDS connection parameters

**Success Criteria**:
- [ ] Stack status: `CREATE_COMPLETE`
- [ ] `aws secretsmanager list-secrets --filters Key=name,Values={env}/lynia` returns 7 secrets
- [ ] 6 IAM managed policy ARNs in stack outputs
- [ ] Database secret readable and contains correct `host`, `port`, `database`, `username`

**Reference Files**:
- `infrastructure/aws/secrets-manager.yaml`

---

### P5-DEPLOY-T008: Deploy IAM Roles Stack
**Priority**: High
**Estimate**: 2 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T001

**Objective**: Deploy 4 IAM roles: DeploymentRole (CI/CD), AdminReadOnly (production monitoring), IncidentResponse (break-glass), and FrontendDeployment (S3 + CloudFront).

**Tasks**:
- [ ] Deploy `infrastructure/aws/iam-roles.yaml` as stack `{env}-lynia-iam`
- [ ] Verify 4 roles created (or 2 in non-production environments)
- [ ] Verify DeploymentRole is scoped to `{env}-lynia-*` resources only
- [ ] Verify MFA requirement on AdminReadOnly and IncidentResponse roles
- [ ] Record outputs: role ARNs for CI/CD configuration

**Deliverables**:
- CI/CD deployment role with CloudFormation, Lambda, S3, and API Gateway permissions
- Read-only monitoring role with MFA enforcement
- Break-glass incident response role with MFA enforcement
- Frontend deployment role for S3 sync and CloudFront invalidation

**Success Criteria**:
- [ ] Stack status: `CREATE_COMPLETE`
- [ ] All 4 roles exist via `aws iam get-role`
- [ ] IncidentResponse role has `aws:MultiFactorAuthPresent: true` condition
- [ ] DeploymentRole trust policy allows GitHub Actions OIDC or IAM user assumption

**Reference Files**:
- `infrastructure/aws/iam-roles.yaml`

---

## Week 20: Database, Services & Networking (Days 1-5)

### P5-DEPLOY-T009: Run Database Migrations to RDS
**Priority**: Critical
**Estimate**: 3 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T004

**Objective**: Execute the database migration pipeline against RDS: pre-migration stub (auth schema + extensions), 17 standard migrations (001-017), and post-migration cleanup (remove RLS + auth schema). Requires `psql` network connectivity to RDS.

**Tasks**:
- [ ] Establish network connectivity to RDS (bastion host, VPN, or temporary SG rule)
- [ ] Verify `psql` can connect to the RDS endpoint
- [ ] Run `database/deploy-to-rds.sh` with the RDS connection string
- [ ] Verify all tables created (35+ tables in public schema)
- [ ] Verify indexes from migration 008 are present (22+ custom indexes)
- [ ] Verify audit_log partitions from migration 009 are active
- [ ] Verify auth schema was removed by migration 018
- [ ] Remove any temporary network access (security group rules)

**Deliverables**:
- Complete database schema deployed to RDS
- 35+ tables, 22+ indexes, table partitions
- RLS policies removed (application-level auth replaces them)
- Auth schema stub cleaned up

**Success Criteria**:
- [ ] `SELECT count(*) FROM pg_tables WHERE schemaname='public'` >= 35
- [ ] Critical tables exist: customers, loans, loan_applications, payments, devices, distributors
- [ ] `SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%'` >= 22
- [ ] `SELECT count(*) FROM pg_tables WHERE tablename LIKE 'audit_log_%'` > 0 (partitions)
- [ ] `SELECT schema_name FROM information_schema.schemata WHERE schema_name='auth'` returns 0 rows

**Reference Files**:
- `database/deploy-to-rds.sh`
- `database/migrations/aws/000_pre_migration.sql`
- `database/migrations/001_initial_schema.sql` through `017_add_rls_policies_missing_tables.sql`
- `database/migrations/aws/018_remove_rls_for_aws.sql`

---

### P5-DEPLOY-T010: Build & Deploy Lambda Functions (SAM)
**Priority**: Critical
**Estimate**: 4 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T002, P5-DEPLOY-T003, P5-DEPLOY-T006, P5-DEPLOY-T007, P5-DEPLOY-T008

**Objective**: Build and deploy all 6 Lambda microservices via SAM CLI with VPC configuration, Cognito authorizer, and SQS integrations. This is the central deployment that ties all infrastructure together.

**Tasks**:
- [ ] Install Node.js dependencies with `pnpm install`
- [ ] Run `sam build` for all 6 services
- [ ] Collect parameter values from previous stack outputs (VPC, Cognito, SQS, Secrets)
- [ ] Run `sam deploy` with production parameters and `VpcEnabled=true`
- [ ] Verify all 6 Lambda functions deployed and in `Active` state
- [ ] Verify all functions have correct VPC configuration (2 subnets, 1 SG)
- [ ] Verify API Gateway endpoint is accessible
- [ ] Run initial health check smoke test on each service endpoint

**Deliverables**:
- 6 Lambda functions deployed (scoring, whatsapp, kyc, payment, lock, notification)
- API Gateway with Cognito authorizer
- All functions in VPC with Secrets Manager access
- SQS event source mappings configured

**Success Criteria**:
- [ ] `sam build` completes without errors
- [ ] `sam deploy` creates/updates stack successfully
- [ ] All 6 Lambda functions in `Active` state
- [ ] Each function has correct `Runtime: nodejs20.x` and `MemorySize`
- [ ] VPC config shows 2 SubnetIds and 1 SecurityGroupId per function
- [ ] API Gateway endpoint returns response (200/401/403)
- [ ] Payment function has reserved concurrency of 100 (production)

**Reference Files**:
- `template.yaml`
- `samconfig.toml`
- `services/scoring-service/`, `services/whatsapp-service/`, `services/kyc-service/`
- `services/payment-service/`, `services/lock-service/`, `services/notification-service/`

---

### P5-DEPLOY-T011: Deploy API Gateway Throttling & Usage Plans
**Priority**: High
**Estimate**: 2 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T010

**Objective**: Deploy 3 tiered usage plans (internal, partner, public) with rate limiting. Create 5 API keys for different consumers. Enable CloudWatch detailed logging on API Gateway.

**Tasks**:
- [ ] Get the API Gateway REST API ID from the SAM stack outputs
- [ ] Deploy `infrastructure/aws/api-gateway/throttling-usage-plans.yaml`
- [ ] Verify 3 usage plans created (internal: 100 RPS, partner: 200 RPS, public: 20 RPS)
- [ ] Verify 5 API keys created and linked to correct usage plans
- [ ] Verify CloudWatch execution logging enabled on the API stage
- [ ] Test rate limiting by sending requests above the public tier threshold

**Deliverables**:
- 3 usage plans with tiered throttling
- 5 API keys (admin-portal, distributor-dashboard, whatsapp-webhook, payment-provider, kyc-provider)
- CloudWatch API execution logging

**Success Criteria**:
- [ ] Stack status: `CREATE_COMPLETE`
- [ ] 3 usage plans visible in API Gateway console
- [ ] 5 API keys enabled and associated with plans
- [ ] Stage method settings show `metricsEnabled: true`
- [ ] Rate limit exceeded returns HTTP 429

**Reference Files**:
- `infrastructure/aws/api-gateway/throttling-usage-plans.yaml`

---

### P5-DEPLOY-T012: Deploy WAF & CloudWatch Monitoring
**Priority**: High
**Estimate**: 3 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T010

**Objective**: Deploy WAF Web ACL with rate limiting and injection protection. Deploy CloudWatch alarms, dashboards, and SNS alert topics. Deploy log retention and archival configuration.

**Tasks**:
- [ ] Deploy `infrastructure/aws/waf.yaml` associated with API Gateway
- [ ] Deploy `infrastructure/monitoring/cloudwatch-alarms.yaml` with alert email/phone
- [ ] Deploy `infrastructure/monitoring/log-retention-archival.yaml`
- [ ] Confirm SNS subscription email (click confirmation link)
- [ ] Verify WAF rules are active (rate limiting, SQL injection, XSS prevention)
- [ ] Verify 25+ CloudWatch alarms configured
- [ ] Verify 5 CloudWatch dashboards created (realtime, business, technical, security, cost)
- [ ] Verify 3 SNS topics created (critical, warning, info)

**Deliverables**:
- WAF protecting API Gateway from common attacks
- 25+ CloudWatch alarms with SNS notifications
- 5 operational dashboards
- Log retention and archival policies

**Success Criteria**:
- [ ] WAF Web ACL associated with API Gateway stage
- [ ] SQL injection test payload returns 403
- [ ] `aws cloudwatch describe-alarms --alarm-name-prefix {env}-lynia` returns 20+ alarms
- [ ] `aws cloudwatch list-dashboards --dashboard-name-prefix {env}-lynia` returns 5 dashboards
- [ ] SNS subscription confirmed and operational

**Reference Files**:
- `infrastructure/aws/waf.yaml`
- `infrastructure/monitoring/cloudwatch-alarms.yaml`
- `infrastructure/monitoring/log-retention-archival.yaml`

---

### P5-DEPLOY-T013: Deploy DNS, SSL & Custom Domains
**Priority**: Critical
**Estimate**: 3 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T010

**Objective**: Deploy Route 53 hosted zone (or use existing), ACM certificates for API (regional) and frontend (us-east-1 for CloudFront), API Gateway custom domain mapping. Certificate DNS validation takes 10-30 minutes.

**Tasks**:
- [ ] Determine if using existing hosted zone or creating new one
- [ ] Deploy `infrastructure/aws/dns-ssl.yaml` as stack `{env}-lynia-dns`
- [ ] Wait for ACM certificate DNS validation (10-30 min)
- [ ] If new hosted zone: update domain registrar with NS records
- [ ] Verify API custom domain mapping (e.g., `api.lyniafinance.com`)
- [ ] Record outputs: FrontendCertificateArn, HostedZoneId

**Deliverables**:
- ACM certificates for API and frontend domains
- API Gateway custom domain with TLS 1.2
- Route 53 DNS records for API endpoint
- Health check on API endpoint

**Success Criteria**:
- [ ] ACM certificates status: `ISSUED`
- [ ] API Gateway custom domain accessible
- [ ] `curl -sI https://api.{domain}` returns valid TLS response
- [ ] DNS resolution for `api.{domain}` points to API Gateway

**Reference Files**:
- `infrastructure/aws/dns-ssl.yaml`

---

## Week 21: Frontend, Finalization & Validation (Days 1-5)

### P5-DEPLOY-T014: Deploy Frontend Hosting & Upload Assets
**Priority**: Critical
**Estimate**: 4 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T003, P5-DEPLOY-T013

**Objective**: Deploy S3 + CloudFront for admin portal and distributor dashboard. Build both Next.js frontends with production Cognito configuration, upload to S3, invalidate caches.

**Tasks**:
- [ ] Deploy `infrastructure/aws/frontend-hosting.yaml` with SSL certificate ARN
- [ ] Configure admin portal `.env.production.local` with Cognito User Pool ID and Admin Client ID
- [ ] Configure distributor dashboard `.env.production.local` with Cognito User Pool ID and Distributor Client ID
- [ ] Build admin portal: `pnpm install && pnpm build`
- [ ] Build distributor dashboard: `pnpm install && pnpm build`
- [ ] Upload admin portal build to S3 bucket
- [ ] Upload distributor dashboard build to S3 bucket
- [ ] Create CloudFront cache invalidations for both distributions
- [ ] Verify both frontends load via CloudFront/custom domain URLs
- [ ] Verify security headers (HSTS, X-Frame-Options, CSP)

**Deliverables**:
- Admin portal live at `admin.{domain}`
- Distributor dashboard live at `distributor.{domain}`
- CloudFront CDN with custom error pages
- Security headers enforced

**Success Criteria**:
- [ ] `curl -sI https://admin.{domain}` returns HTTP/2 200
- [ ] `curl -sI https://distributor.{domain}` returns HTTP/2 200
- [ ] Login page renders correctly on both portals
- [ ] Security headers present: HSTS, X-Frame-Options, Content-Security-Policy

**Reference Files**:
- `infrastructure/aws/frontend-hosting.yaml`
- `frontend/admin-portal/`
- `frontend/distributor-dashboard/`

---

### P5-DEPLOY-T015: Deploy Lambda Auto-Scaling & Canary Deployments
**Priority**: High
**Estimate**: 2 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T010

**Objective**: Deploy provisioned concurrency for critical services (payment, scoring, WhatsApp), Application Auto Scaling with target tracking at 70% utilization, scheduled scaling for Zimbabwe business hours, CodeDeploy canary deployment configuration, and X-Ray tracing.

**Tasks**:
- [ ] Verify Lambda functions have a `live` alias (created by SAM AutoPublishAlias)
- [ ] Deploy `infrastructure/aws/lambda-autoscaling.yaml`
- [ ] Deploy `infrastructure/aws/canary-deployments.yaml`
- [ ] Deploy `infrastructure/aws/xray-tracing.yaml`
- [ ] Verify provisioned concurrency active on 3 services (payment: 5, scoring: 3, whatsapp: 3)
- [ ] Verify auto-scaling policies registered with target tracking
- [ ] Verify CodeDeploy application and deployment groups created
- [ ] Verify X-Ray sampling rules configured

**Deliverables**:
- Provisioned concurrency eliminating cold starts on critical paths
- Auto-scaling from min to max based on utilization
- Scheduled scaling for ZW business hours (06:00-20:00 CAT)
- Canary deployments (10% traffic shift, 5 min bake)
- X-Ray distributed tracing

**Success Criteria**:
- [ ] Provisioned concurrency status: `ready` for payment, scoring, whatsapp
- [ ] 3 scalable targets registered in `application-autoscaling`
- [ ] CodeDeploy application exists with deployment groups
- [ ] X-Ray sampling rule `{env}-lynia-default` exists

**Reference Files**:
- `infrastructure/aws/lambda-autoscaling.yaml`
- `infrastructure/aws/canary-deployments.yaml`
- `infrastructure/aws/xray-tracing.yaml`

---

### P5-DEPLOY-T016: Create Initial Cognito Users & Configure GitHub Secrets
**Priority**: High
**Estimate**: 2 hours
**Status**: ⚪ Not Started
**Dependencies**: P5-DEPLOY-T003, P5-DEPLOY-T010

**Objective**: Create initial admin and manager users in Cognito with group assignments. Configure all GitHub repository secrets needed by the CI/CD deployment workflows.

**Tasks**:
- [ ] Create initial admin user (`admin@lynia.co.zw`) with temporary password
- [ ] Add admin user to `admin` group
- [ ] Create initial manager user (`manager@lynia.co.zw`) with temporary password
- [ ] Add manager user to `manager` group
- [ ] Configure GitHub secrets for backend deployment (AWS credentials, Cognito ARN, SAM bucket)
- [ ] Configure GitHub secrets for frontend deployment (Cognito IDs, S3 buckets, CloudFront IDs)
- [ ] Configure GitHub secrets for external service credentials (staging placeholders)
- [ ] Verify users can authenticate via the admin portal

**Deliverables**:
- 2 initial users with correct role assignments
- All GitHub Actions workflow secrets configured
- CI/CD pipeline ready for automated deployments

**Success Criteria**:
- [ ] 2 users listed in Cognito with `FORCE_CHANGE_PASSWORD` status
- [ ] Admin user in `admin` group, manager in `manager` group
- [ ] `gh secret list` shows all required secrets
- [ ] Manual trigger of `deploy.yml` workflow completes successfully (staging)

**Reference Files**:
- `infrastructure/aws/cognito.yaml`
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-frontend.yml`

---

### P5-DEPLOY-T017: End-to-End Deployment Validation & Smoke Tests
**Priority**: Critical
**Estimate**: 4 hours
**Status**: ⚪ Not Started
**Dependencies**: All tasks (P5-DEPLOY-T001 through T016)

**Objective**: Execute comprehensive validation across all deployed infrastructure. Verify every CloudFormation stack, Lambda function, API endpoint, frontend, database, queue, secret, alarm, and WAF rule is operational.

**Tasks**:
- [ ] Verify all CloudFormation stacks are in `CREATE_COMPLETE` or `UPDATE_COMPLETE`
- [ ] Test all 6 Lambda service health endpoints via API Gateway
- [ ] Test frontend login flow on admin portal (Cognito authentication)
- [ ] Test frontend login flow on distributor dashboard
- [ ] Verify CloudWatch dashboards are populating with metrics
- [ ] Trigger a test SNS alert and verify delivery
- [ ] Send test messages through SQS queues and verify processing
- [ ] Verify Secrets Manager access from Lambda (invoke a function)
- [ ] Test WAF blocks SQL injection and XSS payloads
- [ ] Verify database connectivity from Lambda (query a table)
- [ ] Check all DLQs are empty (no failed messages)
- [ ] Verify provisioned concurrency is stable (no spillover)
- [ ] Run `scripts/validate-production.sh` if available
- [ ] Document all deployment outputs (URLs, IDs, ARNs) in summary report

**Deliverables**:
- Complete validation report with pass/fail for every component
- Documented deployment outputs (API URL, frontend URLs, stack IDs)
- Updated PHASE-5-SUMMARY-REPORT.md with final status

**Success Criteria**:
- [ ] All 17+ CloudFormation stacks in healthy state
- [ ] All 6 Lambda functions respond on health endpoints
- [ ] Both frontends load and authentication works
- [ ] CloudWatch alarms and dashboards operational
- [ ] WAF actively blocking attack payloads
- [ ] No messages in any DLQ
- [ ] SQS queues processing messages end-to-end
- [ ] Database queries returning results from Lambda

**Reference Files**:
- `scripts/validate-production.sh`
- `docs/deployment/POST-DEPLOYMENT-CHECKLIST.md`
- `docs/deployment/PRODUCTION-DEPLOYMENT-RUNBOOK.md`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| RDS creation timeout (10-15 min) | Blocks T007, T009 | Start T004 early, run parallel tasks while waiting |
| ACM certificate validation delay (up to 48h for new domains) | Blocks T014 | Start T013 early; use existing hosted zone if possible |
| Lambda cold starts in VPC | Degraded performance | T015 provisions concurrency on critical paths |
| SAM deploy CAPABILITY errors | Deploy fails | Always pass `CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND` |
| Frontend build failures | Frontend unavailable | Verify `.env.production.local` has correct Cognito values before building |
| Secrets Manager parameter mismatch | Lambda runtime errors | Verify secret names match `SECRETS_PREFIX` environment variable |
| SQS event source mapping failures | Async processing broken | Verify queue ARNs match SAM template expectations |

---

## Cost Estimate (Production)

| Resource | Monthly Cost |
|----------|-------------|
| NAT Gateways (2x HA) | ~$64 |
| VPC Endpoints (4x) | ~$28 |
| RDS db.t4g.small (MultiAZ) | ~$50 |
| Lambda (6 functions + provisioned concurrency) | ~$30-80 |
| API Gateway | ~$10-30 |
| S3 Storage | ~$5-15 |
| CloudFront (2 distributions) | ~$10-30 |
| SQS Queues | ~$2-5 |
| Secrets Manager (7 secrets) | ~$3 |
| CloudWatch (alarms + dashboards + logs) | ~$15-30 |
| WAF | ~$10 |
| ACM Certificates | Free |
| **Total Estimated** | **~$230-345/month** |
