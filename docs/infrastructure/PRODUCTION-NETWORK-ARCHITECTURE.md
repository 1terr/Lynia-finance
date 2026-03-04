# Lynia Finance - Production Network Architecture

## Overview

Production infrastructure runs on AWS us-east-1, using a serverless architecture
with VPC-isolated Lambda functions, CloudFront CDN for frontends, and API Gateway
for service endpoints. All traffic is encrypted in transit via TLS 1.2+.

---

## Network Topology

```
                                    ┌──────────────────────────────────────────────┐
                                    │              INTERNET                         │
                                    └──────────┬──────────────┬────────────────────┘
                                               │              │
                                    ┌──────────▼──────┐  ┌───▼───────────────┐
                                    │  CloudFront CDN  │  │  Route 53 DNS     │
                                    │  (Edge Locations) │  │  lyniafinance.com│
                                    │                  │  └───────────────────┘
                                    │  admin.lynia...  │
                                    │  distributor...  │
                                    └──────────┬───────┘
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                    ┌─────────▼────┐  ┌───────▼──────┐  ┌─────▼──────────┐
                    │ S3: Admin    │  │ S3: Distrib  │  │  AWS WAF        │
                    │ Portal       │  │ Dashboard    │  │  (Rate Limit,   │
                    │              │  │              │  │   SQLi, XSS)    │
                    └──────────────┘  └──────────────┘  └─────┬──────────┘
                                                              │
                                                    ┌─────────▼──────────┐
                                                    │   API Gateway       │
                                                    │   (Regional)        │
                                                    │   api.lynia...      │
                                                    │                     │
                                                    │   Throttling:       │
                                                    │   Internal: 100rps  │
                                                    │   Partner:  200rps  │
                                                    │   Public:   20rps   │
                                                    └─────────┬──────────┘
                                                              │
┌─────────────────────────────────────────────────────────────┼──────────────────────┐
│ VPC: 10.0.0.0/16                                            │                      │
│                                                             │                      │
│  ┌─────────────────────────────────────────────────────────┐│                      │
│  │ Public Subnets                                          ││                      │
│  │                                                         ││                      │
│  │  ┌───────────────────┐   ┌───────────────────┐         ││                      │
│  │  │ Public Subnet 1   │   │ Public Subnet 2   │         ││                      │
│  │  │ 10.0.1.0/24       │   │ 10.0.2.0/24       │         ││                      │
│  │  │ AZ: us-east-1a    │   │ AZ: us-east-1b    │         ││                      │
│  │  │                   │   │                   │         ││                      │
│  │  │ ┌──────────────┐  │   │ ┌──────────────┐  │         ││                      │
│  │  │ │ NAT GW 1     │  │   │ │ NAT GW 2     │  │         ││                      │
│  │  │ │ (EIP)        │  │   │ │ (EIP) [Prod] │  │         ││                      │
│  │  │ └──────────────┘  │   │ └──────────────┘  │         ││                      │
│  │  └───────────────────┘   └───────────────────┘         ││                      │
│  └─────────────────────────────────────────────────────────┘│                      │
│                                                             │                      │
│  ┌─────────────────────────────────────────────────────────┐│                      │
│  │ Private Subnets (Lambda Functions)                      ││                      │
│  │                                                         ││                      │
│  │  ┌───────────────────┐   ┌───────────────────┐         ││                      │
│  │  │ Private Subnet 1  │   │ Private Subnet 2  │         ││                      │
│  │  │ 10.0.10.0/24      │   │ 10.0.11.0/24      │         ││                      │
│  │  │ AZ: us-east-1a    │   │ AZ: us-east-1b    │         ││                      │
│  │  │                   │   │                   │         ││                      │
│  │  │ ┌──────────────┐  │   │ ┌──────────────┐  │         ││                      │
│  │  │ │ Scoring      │  │   │ │ Scoring      │  │         ││                      │
│  │  │ │ Payment      │  │   │ │ Payment      │  │         ││                      │
│  │  │ │ WhatsApp     │  │   │ │ WhatsApp     │  │         ││                      │
│  │  │ │ KYC          │  │   │ │ KYC          │  │         ││                      │
│  │  │ │ Lock         │  │   │ │ Lock         │  │         ││                      │
│  │  │ │ Notification │  │   │ │ Notification │  │         ││                      │
│  │  │ └──────────────┘  │   │ └──────────────┘  │         ││                      │
│  │  └───────────────────┘   └───────────────────┘         ││                      │
│  └─────────────────────────────────────────────────────────┘│                      │
│                                                             │                      │
│  ┌──────────────────────────────────────────────┐           │                      │
│  │ VPC Endpoints (Interface, PrivateLink)        │           │                      │
│  │                                              │           │                      │
│  │  - Secrets Manager  (com.amazonaws...secretsmanager)     │                      │
│  │  - CloudWatch Logs  (com.amazonaws...logs)    │           │                      │
│  │  - SQS              (com.amazonaws...sqs)     │           │                      │
│  │  - X-Ray            (com.amazonaws...xray)    │           │                      │
│  └──────────────────────────────────────────────┘           │                      │
│                                                             │                      │
└─────────────────────────────────────────────────────────────┴──────────────────────┘
                    │                                          │
                    │ NAT Gateway (outbound)                   │ VPC Endpoints (free)
                    ▼                                          ▼
    ┌───────────────────────────┐              ┌───────────────────────────┐
    │ External APIs             │              │ AWS Services              │
    │                           │              │                           │
    │ - WhatsApp Cloud API      │              │ - Secrets Manager         │
    │ - DIDIT (KYC)    │              │ - CloudWatch Logs         │
    │ - EcoCash API             │              │ - SQS Queues              │
    │ - OneMoney API            │              │ - X-Ray Tracing           │
    │ - Trustonic API           │              │ - CodeDeploy              │
    │                           │              │ - RDS PostgreSQL (VPC)    │
    └───────────────────────────┘              └───────────────────────────┘
```

---

## Infrastructure Components

### 1. DNS (Route 53)

| Record | Type | Target |
|--------|------|--------|
| `api.lyniafinance.com` | A (Alias) | API Gateway Regional Domain |
| `admin.lyniafinance.com` | A (Alias) | CloudFront Distribution |
| `distributor.lyniafinance.com` | A (Alias) | CloudFront Distribution |

- Health check on API endpoint (30s interval, 3 failures = unhealthy)
- TTL managed by Alias records (automatic)

### 2. SSL/TLS Certificates (ACM)

| Certificate | Scope | Domains |
|------------|-------|---------|
| API Certificate | Regional (us-east-1) | `api.lyniafinance.com`, `*.api.lyniafinance.com` |
| Frontend Certificate | Global (CloudFront) | `lyniafinance.com`, `*.lyniafinance.com`, `admin.*`, `distributor.*` |

- Minimum protocol: TLS 1.2
- DNS validation (automatic renewal)

### 3. CloudFront CDN

| Distribution | Origin | Cache Policy |
|-------------|--------|--------------|
| Admin Portal | S3 (OAC) | CachingOptimized (static), CachingDisabled (API routes) |
| Distributor Dashboard | S3 (OAC) | CachingOptimized (static) |

- HTTP/2 and HTTP/3 enabled
- Price Class 200 (North America, Europe, Asia, Africa)
- Security headers: CSP, HSTS (1yr, preload), X-Frame-Options: DENY
- Custom error pages: 403/404 -> index.html (SPA routing)

### 4. API Gateway

- Type: REST API (Regional)
- Stage: `Prod`
- Custom domain: `api.lyniafinance.com`
- TLS 1.2 minimum
- WAF protected

**Throttling (Usage Plans):**

| Plan | Burst | Rate | Daily Quota |
|------|-------|------|-------------|
| Internal (Admin/Dashboard) | 200/s | 100/s | 100,000 |
| Partner (WhatsApp/Payment webhooks) | 500/s | 200/s | 500,000 |
| Public (Customer-facing) | 50/s | 20/s | 10,000 |

### 5. WAF Rules

| Priority | Rule | Action |
|----------|------|--------|
| 1 | Global rate limit (2000/5min per IP) | Block |
| 2 | Auth endpoint rate limit (100/5min per IP) | Block |
| 3 | AWS Managed SQLi protection | Managed |
| 4 | AWS Managed XSS / bad inputs | Managed |
| 5 | AWS Managed Common Rule Set | Managed |
| 6 | Missing User-Agent blocking | Block |
| 7 | Body size limit (16KB) | Block |
| 8 | Geo-restriction (ZW, ZA, BW, MZ, MW, US, GB, DE) | Count |

- Logging: CloudWatch Logs (90-day retention, BLOCK/COUNT only)

### 6. VPC Configuration

| Component | CIDR / Detail |
|-----------|---------------|
| VPC | 10.0.0.0/16 |
| Public Subnet 1 (us-east-1a) | 10.0.1.0/24 |
| Public Subnet 2 (us-east-1b) | 10.0.2.0/24 |
| Private Subnet 1 (us-east-1a) | 10.0.10.0/24 |
| Private Subnet 2 (us-east-1b) | 10.0.11.0/24 |
| NAT Gateways | 2 (HA, one per AZ in production) |
| Internet Gateway | 1 |

**Security Groups:**

| SG | Inbound | Outbound |
|----|---------|----------|
| Lambda SG | None | HTTPS (443) to 0.0.0.0/0, PostgreSQL (5432) to 0.0.0.0/0 |
| VPC Endpoint SG | HTTPS (443) from Lambda SG | None |

**VPC Endpoints (PrivateLink):**
- `com.amazonaws.us-east-1.secretsmanager` - Secrets access without NAT
- `com.amazonaws.us-east-1.logs` - CloudWatch Logs without NAT
- `com.amazonaws.us-east-1.sqs` - SQS without NAT
- `com.amazonaws.us-east-1.xray` - X-Ray without NAT

### 7. Lambda Functions

| Service | Memory | Timeout | Provisioned Concurrency | Auto-Scale |
|---------|--------|---------|------------------------|------------|
| Scoring | 1024MB | 30s | 3 (scales 3-30) | 70% target |
| Payment | 1024MB | 60s | 5 (scales 5-50) | 70% target |
| WhatsApp | 512MB | 30s | 3 (scales 3-30) | 70% target |
| KYC | 512MB | 30s | On-demand | N/A |
| Lock | 512MB | 30s | On-demand | N/A |
| Notification | 512MB | 30s | On-demand | N/A |

- Runtime: Node.js 20.x on ARM64 (Graviton2)
- X-Ray tracing: Active on all functions
- Deployment: Canary (Payment: 10%/30min, Scoring/WhatsApp: 10%/15min, Others: Linear 10%/1min)
- Scheduled scaling: Higher minimums during Zimbabwe business hours (06:00-20:00 CAT)

### 8. SQS Queues

| Queue | Visibility | Retention | Max Retries | DLQ Retention |
|-------|-----------|-----------|-------------|---------------|
| notifications | 60s | 4 days | 3 | 14 days |
| payment-callbacks | 120s | 4 days | 5 | 14 days |
| kyc-processing | 120s | 4 days | 3 | 14 days |
| device-locks | 90s | 4 days | 3 | 14 days |
| credit-scoring | 90s | 4 days | 3 | 14 days |

- Long polling (20s wait)
- DLQ alarm: Alert when any DLQ has messages

### 9. Secrets Manager

| Secret Path | Service | Contents |
|-------------|---------|----------|
| production/lynia/database | All | Host, Port, Database, Username, Password |
| production/lynia/whatsapp | WhatsApp | Phone Number ID, Access Token, Webhook Token |
| production/lynia/didit | KYC | Partner ID, API Key |
| production/lynia/ecocash | Payment | Merchant ID, API Key |
| production/lynia/onemoney | Payment | Merchant ID, API Key |
| production/lynia/trustonic | Lock | API Key, API Secret |
| production/lynia/sms | Notification | API Key |

- Least-privilege IAM: Each service can only read its own secrets
- Accessed via VPC Endpoint (no NAT traversal)

### 10. Database (RDS PostgreSQL 16)

- **Provider**: Amazon RDS PostgreSQL 16 (private VPC subnets)
- **Connection**: Direct `pg` driver via VPC (no PgBouncer needed)
- **Per-Lambda Pool**: min=1, max=5 (payment: max=10)
- **SSL**: Required
- **Authorization**: Application-layer middleware (replaces Supabase RLS)
- **Encryption**: RDS encryption at rest (KMS-managed)
- **Backups**: Automated daily snapshots, 7-day retention

### 11. Monitoring & Alerting

**CloudWatch Alarms:**
- Lambda error rates (per function, critical > 3-5 errors/5min)
- Lambda duration p95 (Payment/Scoring > 10s)
- Lambda throttles (any throttle = critical)
- API Gateway 5xx (> 10/5min = critical)
- API Gateway 4xx (> 100/5min = warning)
- API Gateway latency p95 (> 5s = warning)
- DLQ messages (any = warning)
- Provisioned concurrency spillover (> 10/5min)

**Dashboards:**
- Operations: Lambda invocations, errors, duration, throttles, concurrency
- Business: Loan applications, payments, KYC verifications, financial volume
- Cost: AWS estimated charges

**X-Ray Tracing Sampling:**
- Payment Service: 100% (all transactions traced)
- KYC Service: 50%
- WhatsApp/Scoring: 10%
- Default: 5%

---

## Security Architecture

### Defense in Depth

```
Layer 1: CloudFront  → DDoS protection, edge caching, security headers
Layer 2: AWS WAF     → Rate limiting, SQLi/XSS protection, geo-blocking
Layer 3: API Gateway → Authentication, throttling, request validation
Layer 4: VPC         → Network isolation, private subnets, security groups
Layer 5: Lambda      → IAM roles, least-privilege, env-specific secrets
Layer 6: Database    → Application-layer authorization, encrypted PII, connection pooling
```

### Data Flow

```
Customer (WhatsApp) → WhatsApp Cloud API → API Gateway → WhatsApp Lambda
                                                             │
                                                             ▼
                                                       RDS PostgreSQL
                                                             │
Admin (Browser) → CloudFront → S3 (static) → API Gateway → Lambda → RDS PostgreSQL
```

### Encryption

| Layer | Method |
|-------|--------|
| In transit | TLS 1.2+ (all connections) |
| At rest (S3) | AES-256 server-side encryption |
| At rest (DB) | RDS encryption (KMS-managed) |
| Secrets | AWS Secrets Manager (KMS-encrypted) |
| PII fields | Application-level encryption (bcrypt for passwords) |

---

## Deployment Strategy

### Canary Deployments (CodeDeploy)

1. New Lambda version published
2. Pre-traffic hook validates configuration
3. Traffic shifts: 10% to new version
4. Wait period (5-30min depending on service criticality)
5. Post-traffic hook checks error rates
6. Full traffic shift if healthy
7. Automatic rollback on alarm or failure

### Rollback

- **Automatic**: CodeDeploy rolls back on deployment failure or alarm trigger
- **Manual**: `./scripts/rollback.sh` reverts to previous CloudFormation stack version
- **Frontend**: S3 versioning enables instant rollback to previous deployment

---

## Cost Optimization

| Strategy | Impact |
|----------|--------|
| ARM64 (Graviton2) Lambda | ~20% cheaper than x86 |
| VPC Endpoints | Avoid NAT Gateway data processing charges for AWS services |
| CloudFront PriceClass_200 | Lower CDN costs (excludes South America, Australia edge) |
| S3 lifecycle rules | Auto-delete old versions after 30 days |
| Provisioned concurrency auto-scaling | Pay for warm instances only when needed |
| Scheduled scaling | Lower baseline outside business hours |
| Long polling on SQS | Reduce empty ReceiveMessage API calls |
