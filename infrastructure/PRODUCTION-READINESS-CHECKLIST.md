# Lynia Finance - Production Readiness Checklist

**Version**: 1.0
**Last Updated**: 2026-02-09
**Status**: Ready for Review

---

## 1. Infrastructure

### AWS Resources
- [ ] VPC deployed with private subnets in 2+ AZs
- [ ] NAT Gateways deployed (dual for production HA)
- [ ] VPC Endpoints configured (Secrets Manager, CloudWatch, SQS, X-Ray)
- [ ] Security groups reviewed and locked down
- [ ] All Lambda functions deployed and responding

### Compute
- [ ] Lambda functions using ARM64 (Graviton2)
- [ ] Memory configured per function (512MB-1024MB)
- [ ] Timeouts set appropriately (30s default, 60s payment)
- [ ] Reserved concurrency set (Payment: 50, WhatsApp: 100)
- [ ] Cold start times verified < 1s (p95)

### Storage
- [ ] S3 buckets created with encryption and versioning
- [ ] Bucket policies restrict access to CloudFront OAC only
- [ ] Public access blocked on all buckets
- [ ] Old version lifecycle rules configured (30 days)

---

## 2. Security

### Authentication & Authorization
- [ ] All API endpoints validate JWT tokens via Supabase Auth
- [ ] Row Level Security (RLS) enabled on ALL database tables
- [ ] Service role key restricted to server-side use only
- [ ] API keys configured for partner integrations

### Secrets Management
- [ ] All secrets stored in AWS Secrets Manager
- [ ] IAM policies enforce least-privilege per Lambda function
- [ ] No hardcoded secrets in code or environment variables
- [ ] Secret rotation schedule configured

### Network Security
- [ ] WAF WebACL deployed with rate limiting
- [ ] SQL injection protection enabled (AWS Managed Rules)
- [ ] XSS protection enabled (AWS Managed Rules)
- [ ] TLS 1.2 enforced on all endpoints
- [ ] API Gateway throttling configured

### Application Security
- [ ] Input validation on all API endpoints
- [ ] CORS headers properly configured
- [ ] Security headers on CloudFront (CSP, HSTS, X-Frame-Options)
- [ ] No sensitive data in logs or error responses
- [ ] Rate limiting on auth and payment endpoints

---

## 3. Database

### Supabase Configuration
- [ ] Production database provisioned (separate from staging)
- [ ] Connection pooling enabled (PgBouncer)
- [ ] All 7 migrations applied successfully
- [ ] Indexes verified on high-query columns
- [ ] RLS policies active on all tables

### Data Protection
- [ ] PII encrypted at rest
- [ ] Backup schedule configured (daily)
- [ ] Point-in-time recovery enabled
- [ ] Data retention policies documented

---

## 4. Monitoring & Observability

### CloudWatch
- [ ] Operations dashboard deployed and accessible
- [ ] Business metrics dashboard deployed
- [ ] Cost monitoring dashboard deployed (production)
- [ ] All 12+ alarms configured and tested

### Alerting
- [ ] Critical alerts SNS topic configured
- [ ] Alert email subscriptions confirmed
- [ ] Alert SMS subscriptions confirmed (production)
- [ ] Alarm thresholds reviewed for false positive rates

### Tracing
- [ ] X-Ray tracing active on all Lambda functions
- [ ] Sampling rules configured (100% payments, 5% default)
- [ ] Trace groups created for payments, errors, high latency
- [ ] X-Ray Insights enabled for production

### Logging
- [ ] Structured JSON logging on all services
- [ ] Log retention configured (90 days production)
- [ ] No sensitive data in logs verified
- [ ] CloudWatch Log Insights queries prepared

---

## 5. Deployment & CI/CD

### Pipeline
- [ ] GitHub Actions deploy workflow tested
- [ ] SAM build and deploy verified for all environments
- [ ] Frontend deployment workflow tested
- [ ] Automated tests pass in CI

### Canary Deployments
- [ ] CodeDeploy application configured
- [ ] Deployment groups created per service
- [ ] Pre/post-traffic hooks deployed
- [ ] Auto-rollback tested with alarm trigger
- [ ] Rollback procedure documented

### Release Process
- [ ] Branch protection on master
- [ ] PR review requirements configured
- [ ] Semantic versioning adopted
- [ ] GitHub releases created on production deploy

---

## 6. Performance

### Load Testing
- [ ] Artillery load test configuration ready
- [ ] Baseline performance established
- [ ] API p95 latency < 3 seconds under load
- [ ] API p99 latency < 5 seconds under load
- [ ] Zero 5XX errors during sustained load test
- [ ] Payment processing < 10s at p95

### Scalability
- [ ] Lambda auto-scaling verified
- [ ] SQS queues handling async workloads
- [ ] Database connection pooling active
- [ ] CloudFront caching reducing origin load

---

## 7. Business Continuity

### Disaster Recovery
- [ ] Multi-AZ deployment verified
- [ ] Database backups tested (restore drill)
- [ ] DNS failover configured (if applicable)
- [ ] Runbook for critical service failures

### Incident Response
- [ ] On-call rotation established
- [ ] Escalation matrix documented
- [ ] Runbooks for common incidents
- [ ] Post-incident review template ready

---

## 8. Compliance

### RBZ Requirements
- [ ] KYC verification workflow active
- [ ] Transaction limits enforced ($5000 daily, $2000 single)
- [ ] Audit trail for all financial operations
- [ ] 7-year transaction record retention configured

### Data Privacy
- [ ] Privacy policy published
- [ ] Consent collection via WhatsApp flows
- [ ] Data export capability (user rights)
- [ ] Data deletion process documented

---

## 9. External Integrations

### Service Provider Status
- [ ] Supabase: Production project active
- [ ] WhatsApp Cloud API: Verified business, phone number registered
- [ ] Smile Identity: Production credentials obtained
- [ ] EcoCash: Production merchant ID and API key
- [ ] OneMoney: Production merchant ID and API key
- [ ] Trustonic: Production API credentials
- [ ] SMS Provider: Production API key

### Integration Testing
- [ ] WhatsApp webhook end-to-end verified
- [ ] Payment processing end-to-end verified
- [ ] KYC verification flow end-to-end verified
- [ ] Device lock/unlock cycle verified
- [ ] Notification delivery verified

---

## 10. Documentation

- [ ] API documentation up to date
- [ ] Deployment guide reviewed
- [ ] Architecture diagrams current
- [ ] Runbooks for operations team
- [ ] Onboarding guide for new developers

---

## Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering Lead | | | [ ] |
| Security Review | | | [ ] |
| Product Owner | | | [ ] |
| DevOps | | | [ ] |

---

## Estimated Monthly Costs (Production)

| Service | Monthly Estimate |
|---------|-----------------|
| Lambda (6 functions) | $15-50 |
| API Gateway | $10-30 |
| NAT Gateway (2x) | $64 |
| VPC Endpoints (4x) | $28 |
| CloudFront (2 distributions) | $10-30 |
| S3 (frontend hosting) | $1-5 |
| Secrets Manager (7 secrets) | $3 |
| SQS (5 queues) | $1-5 |
| CloudWatch (dashboards + alarms) | $10-20 |
| WAF | $5-15 |
| Route 53 | $2 |
| ACM Certificates | $0 (free) |
| X-Ray | $5-10 |
| **Total Estimated** | **$154-262/month** |
