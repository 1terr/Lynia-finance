# Fineract AWS Architecture - Production

**Last Updated:** February 16, 2026
**Region:** us-east-1 (N. Virginia)
**Account:** 849695476598

---

## System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │              INTERNET                        │
                         └────────────────────┬────────────────────────┘
                                              │
                         ┌────────────────────▼────────────────────────┐
                         │         CloudFront + WAF                     │
                         │    (admin.lyniafinance.com)                  │
                         │    S3 Static Site (Next.js)                  │
                         └────────────────────┬────────────────────────┘
                                              │
                         ┌────────────────────▼────────────────────────┐
                         │         API Gateway + Cognito JWT            │
                         │    (api.lyniafinance.com)                    │
                         └────────────────────┬────────────────────────┘
                                              │
         ┌────────────────────────────────────┼──────────────────────────────┐
         │                        VPC  10.0.0.0/16                           │
         │                                                                    │
         │  ┌─────────────────────────────────────────────────────────────┐  │
         │  │                    Private Subnets                           │  │
         │  │                                                              │  │
         │  │  ┌──────────────┐    ┌──────────────────────────────────┐   │  │
         │  │  │  Lambda       │    │  ECS Fargate Cluster              │   │  │
         │  │  │  Functions    │    │  (production-lynia-fineract)       │   │  │
         │  │  │              │    │                                    │   │  │
         │  │  │  - scoring   │    │  ┌─────────────────────────────┐  │   │  │
         │  │  │  - payment   │    │  │  Internal ALB (HTTPS:8443)  │  │   │  │
         │  │  │  - kyc       │    │  │  TLS 1.3                    │  │   │  │
         │  │  │  - whatsapp  │    │  └────────────┬────────────────┘  │   │  │
         │  │  │  - lock      │    │               │                   │   │  │
         │  │  │  - notif     │    │  ┌────────────▼────────────────┐  │   │  │
         │  │  │              │    │  │  Fineract Server (Fargate)  │  │   │  │
         │  │  │              │    │  │  apache/fineract:latest     │  │   │  │
         │  │  │   Fineract   │    │  │  1 vCPU / 2 GB RAM         │  │   │  │
         │  │  │   TypeScript ├────┤  │  Port 8443 (HTTPS)         │  │   │  │
         │  │  │   Client     │    │  │  7 Secrets (SM)            │  │   │  │
         │  │  │   (Circuit   │    │  └────────────┬────────────────┘  │   │  │
         │  │  │    Breaker)  │    │               │                   │   │  │
         │  │  └──────┬───────┘    └───────────────┼───────────────────┘   │  │
         │  │         │                            │                       │  │
         │  │  ┌──────▼────────────────────────────▼───────────────────┐   │  │
         │  │  │              RDS PostgreSQL 16                         │   │  │
         │  │  │              db.t4g.micro, 20 GB                      │   │  │
         │  │  │                                                       │   │  │
         │  │  │  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐ │   │  │
         │  │  │  │ lynia_prod  │ │ fineract_    │ │ fineract_      │ │   │  │
         │  │  │  │ (app data)  │ │ tenants      │ │ default        │ │   │  │
         │  │  │  └─────────────┘ └──────────────┘ └────────────────┘ │   │  │
         │  │  └───────────────────────────────────────────────────────┘   │  │
         │  │                                                              │  │
         │  │  ┌──────────────────────────────────────────────────────┐   │  │
         │  │  │  VPC Endpoints (PrivateLink)                         │   │  │
         │  │  │  - secretsmanager  (Fineract + Lambda access)        │   │  │
         │  │  │  - logs            (CloudWatch Logs)                  │   │  │
         │  │  │  - ecr.api + ecr.dkr (Docker image pull)             │   │  │
         │  │  └──────────────────────────────────────────────────────┘   │  │
         │  └──────────────────────────────────────────────────────────────┘  │
         └───────────────────────────────────────────────────────────────────┘

                         ┌────────────────────────────────────────────┐
                         │          Monitoring & Alerting              │
                         │                                            │
                         │  CloudWatch Alarms (6)                     │
                         │    - Service Down (CRITICAL)               │
                         │    - High CPU > 80% (WARNING)              │
                         │    - High Memory > 85% (WARNING)           │
                         │    - Unhealthy Targets (CRITICAL)          │
                         │    - 5xx Errors > 10 (WARNING)             │
                         │    - p95 Latency > 2s (WARNING)            │
                         │                                            │
                         │  CloudWatch Dashboard (production)         │
                         │    - ECS CPU & Memory                      │
                         │    - Running/Desired Tasks                 │
                         │    - ALB Request Count & p95 Latency       │
                         │    - HTTP Status Code Distribution         │
                         │                                            │
                         │  SNS Topic: alerts@lynia.co.zw             │
                         └────────────────────────────────────────────┘
```

---

## Data Flow: Lambda to Fineract

```
Admin Portal                  API Gateway              Lambda Function
(Browser)                     (Cognito JWT)            (VPC Private Subnet)
    │                              │                         │
    │  HTTPS Request               │                         │
    ├─────────────────────────────>│                         │
    │                              │  Invoke Lambda           │
    │                              ├────────────────────────>│
    │                              │                         │
    │                              │    ┌────────────────────┤
    │                              │    │ Fineract TS Client │
    │                              │    │ (Circuit Breaker)  │
    │                              │    │                    │
    │                              │    │ 1. Get credentials │
    │                              │    │    from Secrets Mgr│
    │                              │    │                    │
    │                              │    │ 2. HTTPS to ALB    │
    │                              │    │    :8443            │
    │                              │    │    Basic Auth       │
    │                              │    │                    │
    │                              │    │ 3. ALB routes to   │
    │                              │    │    Fargate task     │
    │                              │    │                    │
    │                              │    │ 4. Fineract        │
    │                              │    │    processes req    │
    │                              │    │    (queries RDS)    │
    │                              │    │                    │
    │                              │    │ 5. Response back    │
    │                              │    │    through ALB      │
    │                              │    └────────────────────┤
    │                              │                         │
    │                              │  Lambda Response         │
    │                              │<────────────────────────┤
    │  JSON Response               │                         │
    │<─────────────────────────────┤                         │
```

---

## Security Architecture

### Network Isolation

Fineract is fully isolated in private subnets with no public internet access:

- **No public IP** - Fargate tasks have no public IP addresses
- **Internal ALB** - The load balancer is scheme `internal`, not internet-facing
- **VPC Endpoints** - All AWS API calls (Secrets Manager, CloudWatch Logs, ECR) go through VPC endpoints, not through the internet
- **Security Group Whitelist** - Port 8443 is only accessible from Lambda functions and the ALB

### Authentication Layers

```
Layer 1: Cognito JWT     (Browser to API Gateway)
Layer 2: IAM Roles       (API Gateway to Lambda)
Layer 3: Security Groups (Lambda to ALB/Fineract)
Layer 4: TLS 1.3         (ALB to Fineract container)
Layer 5: Basic Auth      (Lambda to Fineract API)
Layer 6: Secrets Manager (Credential storage, not hardcoded)
```

### Security Group Rules

**Fineract SG (`sg-0766a497ef196df0e`):**

| Direction | Protocol | Port | Source/Destination | Description |
|---|---|---|---|---|
| Ingress | TCP | 8443 | Lambda SG (`sg-0218a50d7ffd89fb3`) | Lambda to Fineract API |
| Ingress | TCP | 8443 | ALB SG | ALB health checks to Fineract |
| Egress | TCP | 5432 | `10.0.0.0/16` | Fineract to RDS PostgreSQL |
| Egress | TCP | 443 | `10.0.0.0/16` | Fineract to VPC endpoints |

**ALB SG:**

| Direction | Protocol | Port | Source | Description |
|---|---|---|---|---|
| Ingress | TCP | 8443 | Lambda SG (`sg-0218a50d7ffd89fb3`) | Lambda to ALB |

**VPC Endpoint SG (`sg-0ba14576c454cb9e7`):**

| Direction | Protocol | Port | Source | Description |
|---|---|---|---|---|
| Ingress | TCP | 443 | Lambda SG | Lambda to VPC endpoints |
| Ingress | TCP | 443 | Fineract SG | Fineract to VPC endpoints |

---

## Resource Specifications

### ECS Fargate Task

| Parameter | Value | Notes |
|---|---|---|
| CPU | 1024 (1 vCPU) | Sufficient for current load |
| Memory | 2048 MB | Fineract JVM gets ~1 GB heap |
| Image | `apache/fineract:latest` | Should be pinned to specific version |
| Platform | Linux/ARM64 (Graviton) | Cost-optimized |
| Desired Count | 1 | Scale to 2+ for high availability |
| Circuit Breaker | Enabled with rollback | Auto-rolls back failed deployments |

### JVM Configuration

```
-Xmx1G                            # Max heap 1 GB
-XX:MinRAMPercentage=25            # Min RAM percentage
-XX:MaxRAMPercentage=80            # Max RAM percentage
-XX:TieredStopAtLevel=1            # Faster startup
-XX:+UseContainerSupport           # Container-aware memory
-XX:+UseStringDeduplication        # Reduce string memory
--add-exports/opens (6 modules)    # Required for Fineract Java 17
```

### RDS Database

| Parameter | Value |
|---|---|
| Engine | PostgreSQL 16 |
| Instance | db.t4g.micro |
| Storage | 20 GB (GP3) |
| Encryption | AES-256 at rest |
| Databases | `lynia_prod`, `fineract_tenants`, `fineract_default` |

### ALB Configuration

| Parameter | Value |
|---|---|
| Scheme | Internal |
| Type | Application |
| Protocol | HTTPS (port 8443) |
| TLS Policy | ELBSecurityPolicy-TLS13-1-2-2021-06 |
| Health Check | `/fineract-provider/actuator/health` |
| Health Check Interval | 30s |
| Healthy Threshold | 2 |
| Unhealthy Threshold | 5 |
| Deregistration Delay | 30s |

---

## Cost Estimation (Monthly)

| Resource | Cost Estimate | Notes |
|---|---|---|
| ECS Fargate (1 vCPU, 2GB, 24/7) | ~$30 | ARM64/Graviton pricing |
| ALB (internal) | ~$16 | Base cost + LCU hours |
| CloudWatch (6 alarms + dashboard) | ~$3 | Standard metrics |
| SNS (email alerts) | ~$0 | Low volume |
| Secrets Manager (2 secrets) | ~$1 | $0.40/secret/month |
| CloudWatch Logs | ~$2-5 | Depends on log volume |
| **Total Fineract Infrastructure** | **~$52-55/month** | |

*Note: RDS cost is shared with the main Lynia application and not included here.*

---

## Scaling Considerations

### Current State (Single Instance)

- 1 Fargate task, 1 vCPU, 2 GB RAM
- Suitable for development and low traffic
- No high availability (single AZ)

### Recommended Production Scaling

| Scaling Trigger | Action |
|---|---|
| CPU > 70% sustained | Scale to 2 tasks |
| Memory > 75% sustained | Scale to 2 tasks |
| Active loans > 1,000 | Scale to 2 tasks + increase CPU/memory |
| Active loans > 10,000 | Scale to 3+ tasks + RDS read replica |
| Response time p95 > 1s | Add caching layer (ElastiCache) |

### High Availability Setup (Future)

```
- DesiredCount: 2 (minimum)
- Tasks spread across 2 AZs
- ALB cross-zone load balancing
- RDS Multi-AZ deployment
- Auto-scaling based on CPU/memory metrics
```
