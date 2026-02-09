#!/bin/bash
# =============================================================================
# Create GitHub Issues for Phase 2 AWS Deployment
# =============================================================================
# Usage: ./scripts/create-aws-issues.sh
# Requires: gh CLI authenticated (run `gh auth login` first)
# =============================================================================

set -euo pipefail

REPO="1terr/Lynia-finance"
LABEL_INFRA="infrastructure"
LABEL_SECURITY="security"
LABEL_DEPLOY="deployment"
LABEL_MONITORING="monitoring"
LABEL_P2="phase-2"

echo "Creating labels..."
gh label create "$LABEL_INFRA" --repo "$REPO" --color "0075ca" --description "Infrastructure and cloud resources" --force 2>/dev/null || true
gh label create "$LABEL_SECURITY" --repo "$REPO" --color "d73a4a" --description "Security hardening" --force 2>/dev/null || true
gh label create "$LABEL_DEPLOY" --repo "$REPO" --color "5319e7" --description "Deployment and CI/CD" --force 2>/dev/null || true
gh label create "$LABEL_MONITORING" --repo "$REPO" --color "fbca04" --description "Monitoring, logging, and alerting" --force 2>/dev/null || true
gh label create "$LABEL_P2" --repo "$REPO" --color "1d76db" --description "Phase 2 - AWS Deployment" --force 2>/dev/null || true

echo ""
echo "Creating Phase 2 AWS Deployment issues..."
echo "==========================================="

# --------------------------------------------------------------------------
# ISSUE 1: AWS Secrets Manager Integration
# --------------------------------------------------------------------------
echo "[1/12] Creating: AWS Secrets Manager Integration..."
gh issue create --repo "$REPO" \
  --title "AWS Secrets Manager Integration for Lambda Functions" \
  --label "$LABEL_SECURITY,$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Migrate all service credentials from environment variables / GitHub Secrets to AWS Secrets Manager with IAM-based access from Lambda functions.

## Current State

- Credentials passed as environment variables via SAM template parameter overrides
- GitHub Secrets used for CI/CD pipeline
- No automatic credential rotation
- No audit logging for secret access

## Requirements

- [ ] Create AWS Secrets Manager secrets for each environment (staging, production)
  - Supabase URL + service role key
  - WhatsApp Cloud API (phone ID, access token, webhook verify token)
  - Smile Identity (partner ID, API key)
  - EcoCash (merchant ID, API key)
  - OneMoney (merchant ID, API key)
  - Trustonic (API key, API secret)
  - SMS provider API key
- [ ] Add IAM policy to Lambda execution role granting `secretsmanager:GetSecretValue`
- [ ] Create shared utility in `services/shared/` to fetch and cache secrets at Lambda cold start
- [ ] Update `template.yaml` to include Secrets Manager resource ARNs
- [ ] Remove plaintext credentials from Lambda environment variables
- [ ] Configure automatic rotation policy for API keys (90-day rotation)
- [ ] Enable CloudTrail logging for secret access events
- [ ] Update CI/CD pipeline to create/update secrets during deployment

## Acceptance Criteria

- All Lambda functions retrieve credentials from Secrets Manager at startup
- Secrets are cached in-memory for the Lambda execution lifetime (no re-fetch per invocation)
- Credential rotation does not require redeployment
- CloudTrail logs all secret access events

## Priority

**Critical** - Required before production launch

## References

- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- Current template: `template.yaml` (Parameters section)
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 2: VPC Configuration
# --------------------------------------------------------------------------
echo "[2/12] Creating: VPC Configuration..."
gh issue create --repo "$REPO" \
  --title "Configure VPC with Private Subnets for Lambda Functions" \
  --label "$LABEL_SECURITY,$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Configure a VPC with private subnets, NAT gateways, and security groups to run Lambda functions in a secure network environment.

## Current State

- Lambda functions run outside a VPC (default)
- No network isolation between services
- External API calls go directly over public internet without VPC controls

## Requirements

- [ ] Create VPC with CIDR block (e.g., 10.0.0.0/16)
- [ ] Configure 2 private subnets across 2 AZs (for Lambda)
- [ ] Configure 2 public subnets across 2 AZs (for NAT Gateway)
- [ ] Set up NAT Gateway in public subnet for Lambda outbound internet access
- [ ] Create security groups:
  - Lambda security group (outbound to internet, Supabase, external APIs)
  - Database security group (if RDS is added later)
- [ ] Add VPC configuration to all Lambda functions in `template.yaml`
- [ ] Create VPC Endpoints for AWS services to reduce NAT costs:
  - `com.amazonaws.us-east-1.secretsmanager`
  - `com.amazonaws.us-east-1.monitoring` (CloudWatch)
  - `com.amazonaws.us-east-1.logs` (CloudWatch Logs)
  - `com.amazonaws.us-east-1.sqs` (if SQS is used)
- [ ] Test all external API connectivity (Supabase, Smile Identity, EcoCash, etc.) from VPC
- [ ] Update deployment documentation

## Acceptance Criteria

- All Lambda functions execute within private subnets
- Outbound internet access works via NAT Gateway
- AWS service calls route through VPC Endpoints (no NAT charges)
- Cold start impact is measured and documented (VPC adds ~1-2s)

## Cost Estimate

- NAT Gateway: ~$32/month + data processing
- VPC Endpoints: ~$7/month each

## Priority

**Critical** - Required before production launch

## References

- Current template: `template.yaml`
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 3: CloudWatch Alarms & Dashboards
# --------------------------------------------------------------------------
echo "[3/12] Creating: CloudWatch Alarms & Dashboards..."
gh issue create --repo "$REPO" \
  --title "Configure CloudWatch Alarms and Operational Dashboards" \
  --label "$LABEL_MONITORING,$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Create CloudWatch Alarms for critical service metrics and build operational dashboards for real-time monitoring of the Lynia Finance platform.

## Current State

- Monitoring requirements documented in `CLAUDE.md` but no alarms or dashboards are actually configured
- Lambda functions log to CloudWatch Logs (default behavior)
- No proactive alerting on failures

## Requirements

### CloudWatch Alarms (add to `template.yaml`)

- [ ] **Lambda Error Alarms** (per function):
  - Error rate > 5% over 5 minutes → Critical (SNS notification)
  - Error rate > 1% over 5 minutes → Warning
- [ ] **Lambda Duration Alarms**:
  - p95 duration > 10s → Warning
  - p99 duration > 25s → Critical (approaching 30s timeout)
- [ ] **Lambda Throttle Alarms**:
  - Throttle count > 0 → Warning
- [ ] **API Gateway Alarms**:
  - 5XX error rate > 1% → Critical
  - 4XX error rate > 10% → Warning
  - Latency p95 > 3s → Warning
- [ ] **Payment-specific Alarms**:
  - PaymentFunction errors > 0 in 1 minute → Critical (page on-call)
  - PaymentFunction invocations drop to 0 for 1 hour during business hours → Warning

### SNS Topics

- [ ] Create `lynia-critical-alerts` SNS topic (email + SMS)
- [ ] Create `lynia-warning-alerts` SNS topic (email only)
- [ ] Subscribe operations team to alert topics

### CloudWatch Dashboards

- [ ] **Operations Dashboard**: Lambda invocations, errors, duration (all 6 functions)
- [ ] **Business Metrics Dashboard**: Payment success/failure counts, loan applications
- [ ] **Cost Dashboard**: Lambda execution costs, API Gateway costs

### Custom Metrics

- [ ] Emit custom metrics from Lambda functions:
  - `LoanApplicationsSubmitted`
  - `LoanApplicationsApproved`
  - `PaymentsProcessed`
  - `PaymentsFailed`
  - `KYCVerificationsCompleted`

## Acceptance Criteria

- Alarms trigger SNS notifications within 5 minutes of threshold breach
- Dashboards display real-time data with 1-minute granularity
- All 6 Lambda functions are monitored for errors, duration, and throttling

## Priority

**Critical** - Required before production launch
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 4: AWS WAF for API Gateway
# --------------------------------------------------------------------------
echo "[4/12] Creating: AWS WAF for API Gateway..."
gh issue create --repo "$REPO" \
  --title "Deploy AWS WAF Rules on API Gateway" \
  --label "$LABEL_SECURITY,$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Deploy AWS Web Application Firewall (WAF) on the API Gateway to protect against common web attacks, DDoS, and bot traffic.

## Current State

- API Gateway has no WAF protection
- Only default API Gateway throttling (10,000 req/s)
- No IP-based blocking or geo-restriction
- No protection against SQL injection or XSS via API

## Requirements

- [ ] Create WAF WebACL associated with the API Gateway stage
- [ ] Configure managed rule groups:
  - **AWSManagedRulesCommonRuleSet** - Core protection (XSS, SQLi, etc.)
  - **AWSManagedRulesKnownBadInputsRuleSet** - Known bad patterns
  - **AWSManagedRulesBotControlRuleSet** - Bot detection
- [ ] Configure rate limiting rules:
  - Global: 2000 requests per 5 minutes per IP
  - Auth endpoints (`/auth/*`): 20 requests per 5 minutes per IP
  - Payment endpoints (`/payments/*`): 50 requests per 5 minutes per IP
  - OTP endpoints: 5 requests per 5 minutes per IP
- [ ] Configure geo-restriction (allow only ZW, ZA, and known operational regions)
- [ ] Add WAF logging to S3 for security audit
- [ ] Add WAF resources to `template.yaml`
- [ ] Test that legitimate traffic passes and attacks are blocked
- [ ] Create runbook for adding/removing IP blocks

## Acceptance Criteria

- WAF blocks common OWASP Top 10 attacks
- Rate limiting prevents brute-force on auth/payment endpoints
- WAF logs are stored in S3 for 90 days
- False positive rate < 0.1%

## Cost Estimate

- WAF WebACL: $5/month
- Managed rules: $1-3/month per rule group
- Request inspection: $0.60 per million requests

## Priority

**Critical** - Required before production launch
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 5: SQS Queues for Async Processing
# --------------------------------------------------------------------------
echo "[5/12] Creating: SQS Async Processing..."
gh issue create --repo "$REPO" \
  --title "Implement SQS Queues for Asynchronous Processing" \
  --label "$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Implement Amazon SQS queues to decouple synchronous API calls and enable reliable asynchronous processing for notifications, payment callbacks, and background jobs.

## Current State

- All Lambda functions are invoked synchronously via API Gateway
- No retry mechanism for failed external API calls (Smile Identity, EcoCash, etc.)
- Notification sending is synchronous and blocks the main request
- No dead letter queues for failed processing

## Requirements

### SQS Queues to Create

- [ ] **NotificationQueue** - WhatsApp, SMS, and email notification dispatch
  - Visibility timeout: 60s
  - Message retention: 4 days
  - DLQ: `NotificationDLQ` (maxReceiveCount: 3)
- [ ] **PaymentCallbackQueue** - EcoCash/OneMoney payment status callbacks
  - Visibility timeout: 30s
  - Message retention: 7 days
  - DLQ: `PaymentCallbackDLQ` (maxReceiveCount: 5)
- [ ] **KYCProcessingQueue** - Async KYC verification results from Smile Identity
  - Visibility timeout: 120s
  - Message retention: 7 days
  - DLQ: `KYCProcessingDLQ` (maxReceiveCount: 3)
- [ ] **DeviceLockQueue** - Device lock/unlock commands for Trustonic
  - Visibility timeout: 60s
  - FIFO queue (to preserve order per device)
  - DLQ: `DeviceLockDLQ` (maxReceiveCount: 5)

### Lambda Event Source Mappings

- [ ] NotificationFunction ← NotificationQueue (batch size: 10)
- [ ] PaymentFunction ← PaymentCallbackQueue (batch size: 1)
- [ ] KYCFunction ← KYCProcessingQueue (batch size: 1)
- [ ] LockFunction ← DeviceLockQueue (batch size: 1)

### Implementation

- [ ] Add SQS resources to `template.yaml`
- [ ] Create shared SQS publisher utility in `services/shared/`
- [ ] Update services to publish messages instead of direct calls where appropriate
- [ ] Add DLQ monitoring alarms (messages in DLQ > 0 → Warning)
- [ ] Implement idempotency keys for payment processing messages
- [ ] Add message deduplication for FIFO queues

## Acceptance Criteria

- Failed notifications retry automatically up to 3 times
- Payment callbacks are processed exactly once (idempotency)
- DLQ messages trigger CloudWatch alarms for manual review
- Main API response times improve by offloading async work

## Priority

**Important** - Required before first production release
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 6: Lambda Concurrency & Cold Start Optimization
# --------------------------------------------------------------------------
echo "[6/12] Creating: Lambda Concurrency Configuration..."
gh issue create --repo "$REPO" \
  --title "Configure Lambda Concurrency and Optimize Cold Starts" \
  --label "$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Configure reserved and provisioned concurrency for critical Lambda functions and optimize cold start performance.

## Current State

- All functions use unreserved concurrency (default account limit)
- No provisioned concurrency for latency-sensitive functions
- Bundle sizes not optimized for cold start performance
- No Lambda Layers for shared dependencies

## Requirements

### Reserved Concurrency

- [ ] **PaymentFunction**: Reserved = 50 (protect from noisy neighbor)
- [ ] **ScoringFunction**: Reserved = 30
- [ ] **WhatsAppFunction**: Reserved = 100 (highest throughput)
- [ ] **KYCFunction**: Reserved = 20
- [ ] **LockFunction**: Reserved = 20
- [ ] **NotificationFunction**: Reserved = 50

### Provisioned Concurrency (Production Only)

- [ ] **PaymentFunction**: Provisioned = 5 (zero cold start for payments)
- [ ] **ScoringFunction**: Provisioned = 3 (zero cold start for credit decisions)

### Cold Start Optimization

- [ ] Create Lambda Layer for shared node_modules (`@supabase/supabase-js`, shared utilities)
- [ ] Optimize esbuild configuration:
  - Tree shaking enabled
  - Minification enabled
  - External modules in Layer
- [ ] Measure and document cold start times per function
- [ ] Implement lazy initialization pattern for SDK clients
- [ ] Move Supabase client initialization to module scope (reuse across invocations)

### Auto-Scaling

- [ ] Configure Application Auto Scaling for provisioned concurrency:
  - Target tracking: 70% utilization
  - Scale out cooldown: 60s
  - Scale in cooldown: 300s

## Acceptance Criteria

- Cold start time < 2s for all functions
- Payment and scoring functions have zero cold starts (provisioned concurrency)
- No throttling during normal operations
- Bundle size < 5MB per function (excluding Layer)

## Cost Estimate

- Provisioned concurrency: ~$15-25/month for 8 provisioned instances
- Lambda Layer: No additional cost

## Priority

**Important** - Required before first production release
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 7: API Gateway Rate Limiting & Usage Plans
# --------------------------------------------------------------------------
echo "[7/12] Creating: API Gateway Rate Limiting..."
gh issue create --repo "$REPO" \
  --title "Configure API Gateway Throttling, Usage Plans, and API Keys" \
  --label "$LABEL_SECURITY,$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Configure granular rate limiting on API Gateway with usage plans and API keys for different client types.

## Current State

- Default API Gateway throttling only (10,000 req/s burst, 5,000 steady-state)
- No per-client rate limiting
- No API keys for client identification
- No usage plan tiers

## Requirements

### Stage-Level Throttling

- [ ] Staging: 100 req/s burst, 50 req/s steady-state
- [ ] Production: 1000 req/s burst, 500 req/s steady-state

### Method-Level Throttling

- [ ] POST `/auth/*`: 10 req/s per client
- [ ] POST `/payments/*`: 20 req/s per client
- [ ] POST `/loans/apply`: 5 req/s per client
- [ ] GET endpoints: 100 req/s per client
- [ ] POST `/whatsapp/webhook`: 500 req/s (WhatsApp sends bursts)

### Usage Plans

- [ ] **Internal Plan** (admin portal, distributor dashboard):
  - 10,000 requests/day
  - 100 req/s burst
- [ ] **WhatsApp Webhook Plan** (Meta callback):
  - 100,000 requests/day
  - 500 req/s burst
- [ ] **External Partner Plan** (future API consumers):
  - 1,000 requests/day
  - 10 req/s burst

### API Keys

- [ ] Generate API keys per usage plan
- [ ] Store API keys in Secrets Manager
- [ ] Add `x-api-key` requirement to `template.yaml` API definition
- [ ] Exempt health check endpoints from API key requirement

### Implementation

- [ ] Update `template.yaml` with throttling configuration
- [ ] Add usage plan and API key resources
- [ ] Configure per-method throttling overrides
- [ ] Add 429 response handling to frontend clients
- [ ] Document rate limits in API documentation

## Acceptance Criteria

- Rate-limited requests receive HTTP 429 with `Retry-After` header
- Different clients have appropriate rate limits based on their usage plan
- WhatsApp webhook can handle Meta's burst traffic without throttling
- Rate limit metrics visible in CloudWatch

## Priority

**Important** - Required before first production release
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 8: Route 53 & Custom Domain Setup
# --------------------------------------------------------------------------
echo "[8/12] Creating: Route 53 & Custom Domain..."
gh issue create --repo "$REPO" \
  --title "Configure Route 53, Custom Domain, and SSL/TLS Certificates" \
  --label "$LABEL_INFRA,$LABEL_DEPLOY,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Set up Route 53 hosted zone, custom API domain, and AWS Certificate Manager (ACM) SSL/TLS certificates for the Lynia Finance API.

## Current State

- API accessible only via auto-generated API Gateway URL (`https://{id}.execute-api.us-east-1.amazonaws.com/{stage}`)
- No custom domain (e.g., `api.lynia.co.zw`)
- No SSL certificate management
- No DNS health checks or failover

## Requirements

### Route 53

- [ ] Create hosted zone for `lynia.co.zw` (or chosen domain)
- [ ] Configure DNS records:
  - `api.lynia.co.zw` → API Gateway custom domain
  - `api-staging.lynia.co.zw` → Staging API Gateway
  - `admin.lynia.co.zw` → Admin portal (CloudFront/Vercel)
  - `distributor.lynia.co.zw` → Distributor dashboard
- [ ] Configure health checks for API endpoints
- [ ] Set up DNS failover routing policy (if multi-region in future)

### ACM Certificates

- [ ] Request ACM certificate for `*.lynia.co.zw` (wildcard)
- [ ] DNS validation via Route 53
- [ ] Certificate in `us-east-1` (required for API Gateway & CloudFront)

### API Gateway Custom Domain

- [ ] Create custom domain name in API Gateway
- [ ] Map `api.lynia.co.zw` to production stage
- [ ] Map `api-staging.lynia.co.zw` to staging stage
- [ ] Configure base path mappings (`/v1` → API)
- [ ] Enable mutual TLS (mTLS) for partner API access (future)

### Implementation

- [ ] Add Route 53, ACM, and API Gateway custom domain to `template.yaml`
- [ ] Update deployment scripts with custom domain configuration
- [ ] Update WhatsApp webhook URL to use custom domain
- [ ] Update frontend API base URLs to custom domain
- [ ] Document DNS setup and certificate renewal process

## Acceptance Criteria

- API accessible at `https://api.lynia.co.zw/v1/`
- SSL certificate auto-renews via ACM
- Health checks detect API failures within 30 seconds
- DNS propagation verified across regions

## Prerequisites

- Domain registered and nameservers pointed to Route 53

## Priority

**Important** - Required before first production release
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 9: X-Ray Distributed Tracing
# --------------------------------------------------------------------------
echo "[9/12] Creating: X-Ray Distributed Tracing..."
gh issue create --repo "$REPO" \
  --title "Enable AWS X-Ray Distributed Tracing Across All Services" \
  --label "$LABEL_MONITORING,$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Enable AWS X-Ray distributed tracing across all Lambda functions and API Gateway to provide end-to-end request visibility and performance analysis.

## Current State

- No distributed tracing configured
- Debugging cross-service issues requires manual CloudWatch log correlation
- No service map visualization
- No performance bottleneck identification

## Requirements

### X-Ray Configuration

- [ ] Enable X-Ray tracing on API Gateway (set `TracingEnabled: true`)
- [ ] Enable active tracing on all Lambda functions in `template.yaml`:
  ```yaml
  Globals:
    Function:
      Tracing: Active
  ```
- [ ] Add `aws-xray-sdk` to shared dependencies
- [ ] Instrument outbound HTTP calls (Supabase, Smile Identity, EcoCash, etc.)
- [ ] Instrument Supabase database queries as subsegments
- [ ] Add custom annotations for business context:
  - `customerId` on loan and payment traces
  - `loanId` on loan processing traces
  - `paymentProvider` on payment traces

### Sampling Rules

- [ ] Configure sampling rules (avoid tracing 100% in production):
  - Default: 5% of requests
  - Payment endpoints: 100% (always trace financial operations)
  - Error responses: 100% (always trace failures)
  - Health checks: 0% (never trace)

### Service Map

- [ ] Verify X-Ray Service Map shows all 6 services and external dependencies
- [ ] Document typical request flow paths

### Implementation

- [ ] Add `Tracing: Active` to `template.yaml` Globals
- [ ] Install and configure `aws-xray-sdk-node` in shared package
- [ ] Create X-Ray middleware for all Lambda handlers
- [ ] Add IAM permissions for X-Ray (`xray:PutTraceSegments`, `xray:PutTelemetryRecords`)
- [ ] Create X-Ray group for filtering production traces

## Acceptance Criteria

- All cross-service requests have a single trace ID
- Service Map displays all services and external API dependencies
- Payment transactions are 100% traced
- Average trace overhead < 5ms per request

## Priority

**Nice to have** - After initial launch
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 10: Canary Deployments with CodeDeploy
# --------------------------------------------------------------------------
echo "[10/12] Creating: Canary Deployments..."
gh issue create --repo "$REPO" \
  --title "Implement Canary Deployments with CodeDeploy for Lambda" \
  --label "$LABEL_DEPLOY,$LABEL_INFRA,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Implement gradual canary deployments for Lambda functions using AWS CodeDeploy to reduce deployment risk and enable automatic rollback on errors.

## Current State

- Deployments are all-at-once via SAM deploy
- No gradual traffic shifting
- Manual rollback process via `scripts/rollback.sh`
- No automatic rollback on error spike

## Requirements

### Deployment Preferences

- [ ] Configure deployment preferences per function:
  - **PaymentFunction**: `Canary10Percent5Minutes` (10% traffic for 5 min, then 100%)
  - **ScoringFunction**: `Canary10Percent5Minutes`
  - **WhatsAppFunction**: `Linear10PercentEvery1Minute` (gradual over 10 min)
  - **KYCFunction**: `Linear10PercentEvery1Minute`
  - **LockFunction**: `AllAtOnce` (low traffic, simpler)
  - **NotificationFunction**: `Linear10PercentEvery1Minute`

### Pre/Post Traffic Hooks

- [ ] Create pre-traffic hook Lambda:
  - Runs integration test against new version
  - Validates environment variables are set
  - Tests database connectivity
  - Returns pass/fail to CodeDeploy
- [ ] Create post-traffic hook Lambda:
  - Validates error rate is within threshold
  - Checks response times are acceptable

### Automatic Rollback

- [ ] Configure CloudWatch Alarms as rollback triggers:
  - Lambda Errors > 5% → Rollback
  - Lambda Duration p99 > 25s → Rollback
  - API Gateway 5XX > 2% → Rollback
- [ ] Add `AutoPublishAlias` to all Lambda functions in `template.yaml`
- [ ] Configure `DeploymentPreference` in `template.yaml`

### Implementation

- [ ] Update `template.yaml` with deployment preferences
- [ ] Create pre-traffic and post-traffic hook functions
- [ ] Add CodeDeploy alarms to template
- [ ] Update CI/CD pipeline to support canary deployments
- [ ] Test rollback scenario in staging
- [ ] Document deployment and rollback procedures

## Acceptance Criteria

- Production deployments shift traffic gradually over 5-10 minutes
- Automatic rollback triggers within 2 minutes of error threshold breach
- Pre-traffic hook validates new version before any traffic shift
- Zero-downtime deployments verified

## Priority

**Important** - Required before first production release
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 11: CloudFront CDN for Frontend
# --------------------------------------------------------------------------
echo "[11/12] Creating: CloudFront CDN for Frontend..."
gh issue create --repo "$REPO" \
  --title "Deploy Frontend Applications via S3 and CloudFront CDN" \
  --label "$LABEL_INFRA,$LABEL_DEPLOY,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Deploy the admin portal and distributor dashboard as static exports to S3 with CloudFront CDN for global content delivery, caching, and HTTPS termination.

## Current State

- Frontend apps (Next.js 14) built but no hosting deployment configured
- No CDN or static asset optimization
- No caching strategy for frontend assets

## Requirements

### S3 Buckets

- [ ] Create S3 bucket for admin portal static assets
- [ ] Create S3 bucket for distributor dashboard static assets
- [ ] Configure bucket policies (CloudFront OAI access only, no public access)
- [ ] Enable versioning for rollback capability

### CloudFront Distributions

- [ ] **Admin Portal Distribution**:
  - Origin: S3 bucket
  - Custom domain: `admin.lynia.co.zw`
  - ACM certificate (from Issue #8)
  - Default root object: `index.html`
  - Error pages: 403/404 → `/index.html` (SPA routing)
  - Cache policy: Managed-CachingOptimized for static assets
  - 24-hour TTL for HTML, 1-year TTL for hashed assets
- [ ] **Distributor Dashboard Distribution**:
  - Same configuration as admin portal
  - Custom domain: `distributor.lynia.co.zw`

### CI/CD Integration

- [ ] Add frontend build step to GitHub Actions workflow
- [ ] S3 sync on deployment (`aws s3 sync --delete`)
- [ ] CloudFront invalidation after deployment (`/*`)
- [ ] Cache busting via content hashing in build output

### Security Headers

- [ ] Configure CloudFront response headers policy:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy` (restrict to own domain + API domain)
  - `Referrer-Policy: strict-origin-when-cross-origin`

### Implementation

- [ ] Add S3 and CloudFront resources to `template.yaml` (or separate frontend template)
- [ ] Configure Next.js for static export (`output: 'export'`)
- [ ] Update frontend API base URLs to use custom domain
- [ ] Update CI/CD pipeline with frontend deployment steps
- [ ] Add CloudFront metrics to monitoring dashboard

## Acceptance Criteria

- Frontend loads in < 1.5s (FCP) globally
- HTTPS enforced with proper security headers
- Cache hit ratio > 90% for static assets
- Deployments invalidate CloudFront cache automatically

## Cost Estimate

- CloudFront: ~$1-5/month for expected traffic
- S3: < $1/month

## Priority

**Nice to have** - After initial launch (can use Vercel initially)
EOF
)"

# --------------------------------------------------------------------------
# ISSUE 12: Production Readiness Checklist & Load Testing
# --------------------------------------------------------------------------
echo "[12/12] Creating: Production Readiness Checklist..."
gh issue create --repo "$REPO" \
  --title "Production Readiness Review and Load Testing" \
  --label "$LABEL_DEPLOY,$LABEL_P2" \
  --body "$(cat <<'EOF'
## Summary

Comprehensive production readiness review and load testing before launching Lynia Finance to real customers. This is the final gate before production deployment.

## Pre-Launch Checklist

### Security Review

- [ ] All secrets stored in AWS Secrets Manager (not env vars)
- [ ] WAF rules active and tested
- [ ] VPC configured with private subnets
- [ ] API rate limiting configured
- [ ] CORS properly configured (only allow known origins)
- [ ] JWT validation on all protected endpoints
- [ ] RLS policies verified on all Supabase tables
- [ ] Penetration test completed (or scheduled)
- [ ] OWASP Top 10 scan passed

### Reliability Review

- [ ] CloudWatch Alarms configured for all critical metrics
- [ ] Dead letter queues configured and monitored
- [ ] Canary deployment configured for production
- [ ] Rollback procedure tested and documented
- [ ] Database backup strategy confirmed (Supabase auto-backups)
- [ ] Error handling verified in all Lambda functions
- [ ] Idempotency verified for payment operations
- [ ] Circuit breakers for external API calls (Smile Identity, EcoCash)

### Load Testing

- [ ] Define expected traffic patterns:
  - Peak concurrent users: ?
  - Requests per second target: ?
  - Peak payment transactions per hour: ?
- [ ] Create load test scenarios:
  - Scenario 1: Normal traffic (50 req/s for 30 min)
  - Scenario 2: Peak traffic (200 req/s for 10 min)
  - Scenario 3: Spike traffic (500 req/s burst for 2 min)
  - Scenario 4: Sustained load (100 req/s for 2 hours)
- [ ] Run load tests against staging environment
- [ ] Measure and document:
  - p50/p95/p99 latency under load
  - Error rate under load
  - Cold start frequency under load
  - Database connection pool behavior
  - Lambda concurrency utilization
- [ ] Fix any performance issues discovered

### Compliance Review

- [ ] KYC flow tested end-to-end
- [ ] Transaction limits enforced per RBZ requirements
- [ ] Audit logging verified for all financial operations
- [ ] Data retention policies implemented
- [ ] Privacy policy and terms of service published

### Operational Readiness

- [ ] On-call rotation established
- [ ] Incident response runbook created
- [ ] Escalation paths documented
- [ ] Monitoring dashboards accessible to operations team
- [ ] Cost alerts configured (AWS Budgets)
- [ ] Staging environment mirrors production configuration

## Acceptance Criteria

- All checklist items completed and verified
- Load test results meet SLO targets (99.9% availability, p95 < 300ms)
- No critical or high security findings unresolved
- Operations team confident in monitoring and incident response

## Priority

**Critical** - Final gate before production launch
EOF
)"

echo ""
echo "==========================================="
echo "All 12 Phase 2 AWS Deployment issues created!"
echo "==========================================="
echo ""
echo "View all issues: gh issue list --repo $REPO --label phase-2"
