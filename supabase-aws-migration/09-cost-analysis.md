# 09 - Cost Analysis

## Current Supabase Cost

### Free Tier Limits (What We're Hitting)

| Resource | Free Tier Limit | Current Usage | Status |
|----------|----------------|---------------|--------|
| Database | 500 MB | ~100 MB (growing) | Approaching limit |
| Storage | 1 GB | < 100 MB | OK for now |
| Auth MAUs | 50,000 | < 1,000 | OK |
| Bandwidth | 2 GB | Variable | Approaching limit |
| Edge Functions | 500,000 invocations | Not used | N/A |
| Realtime connections | 200 concurrent | < 50 | OK |

### Supabase Pro Cost (If We Upgraded Instead)

| Component | Cost/Month |
|-----------|-----------|
| Base plan | $25 |
| 8 GB database | Included |
| 100 GB storage | Included |
| 100,000 MAUs | Included |
| 250 GB bandwidth | Included |
| **Total** | **$25/month** |

Supabase Pro solves the immediate problem but locks you into their pricing as
you scale. At the Team plan level ($599/month), costs rise significantly.

## AWS Migration Cost Breakdown

### Year 1 (With AWS Free Tier Benefits)

If you're within your first 12 months of AWS, many services are free:

| Service | Free Tier | Est. Usage | Monthly Cost |
|---------|-----------|------------|-------------|
| **RDS `db.t4g.micro`** | 750 hrs/mo (12 months) | 730 hrs | **$0.00** |
| RDS Storage (20 GB gp3) | 20 GB (12 months) | 20 GB | **$0.00** |
| **Cognito** | 50,000 MAUs (permanent) | < 1,000 | **$0.00** |
| **Lambda** | 1M requests + 400K GB-s (permanent) | ~200K requests | **$0.00** |
| **API Gateway** | 1M calls/mo (12 months) | ~200K calls | **$0.00** |
| **S3** | 5 GB (12 months) | < 1 GB | **$0.00** |
| **CloudFront** | 1 TB/mo (12 months) | < 50 GB | **$0.00** |
| **SQS** | 1M requests/mo (permanent) | < 100K | **$0.00** |
| **CloudWatch** | 10 custom metrics + 5 GB logs (permanent) | ~20 metrics | ~$3.00 |
| **Secrets Manager** | None | 7 secrets | $2.80 |
| **SNS** | 1,000 emails/mo (permanent) | < 500 | **$0.00** |
| **WAF** | None | 1 Web ACL + 5 rules | $11.00 |
| **NAT Gateway** | None | 1 gateway | $32.40 |
| Data transfer | 100 GB/mo (12 months) | < 10 GB | **$0.00** |
| **Year 1 Total** | | | **~$49/month** |

**The big cost item is NAT Gateway** ($32.40/month). This is required for
Lambda functions in a VPC to reach the internet (for external APIs like DIDIT
Identity, EcoCash, WhatsApp). Options to reduce:

1. **Use VPC Endpoints** for AWS services (S3, Secrets Manager, SQS) --
   reduces NAT Gateway traffic but doesn't eliminate the gateway
2. **Keep Lambda outside VPC** for services that don't need DB access --
   but all services need the database now
3. **Use `fck-nat`** -- an open-source NAT instance on a `t4g.nano` ($3/month)
   instead of NAT Gateway. Works for low-traffic startups.

### With fck-nat Instead of NAT Gateway

| Service | Monthly Cost |
|---------|-------------|
| RDS `db.t4g.micro` | $0.00 (free tier) |
| fck-nat (`t4g.nano`) | $3.07 |
| CloudWatch (custom metrics) | $3.00 |
| Secrets Manager | $2.80 |
| WAF | $11.00 |
| Everything else | $0.00 (free tier) |
| **Total (Year 1)** | **~$20/month** |

### Year 2+ (After Free Tier Expires)

| Service | Monthly Cost |
|---------|-------------|
| **RDS `db.t4g.micro`** | $13.14 |
| RDS Storage (20 GB gp3) | $2.30 |
| **Cognito** | $0.00 (permanent free tier) |
| **Lambda** | ~$0.50 (permanent free tier covers most) |
| **API Gateway** | ~$3.50 |
| **S3** (application storage) | ~$0.50 |
| **CloudFront** | ~$5.00 |
| **SQS** | $0.00 (permanent free tier) |
| **CloudWatch** | ~$5.00 |
| **Secrets Manager** | $2.80 |
| **SNS** | ~$0.50 |
| **WAF** | $11.00 |
| **NAT Gateway or fck-nat** | $3.07 - $32.40 |
| Data transfer | ~$2.00 |
| **Year 2+ Total** | **$49 - $78/month** |

### Cost Optimization Strategies

#### Immediate Savings

| Strategy | Savings |
|----------|---------|
| Use `fck-nat` instead of NAT Gateway | $29/month |
| Use VPC Endpoints for S3, Secrets Manager | Reduces data transfer |
| Remove WAF in dev environment | $11/month (dev only) |
| Use CloudWatch basic monitoring | $3-5/month |

#### Medium-Term Savings

| Strategy | Savings |
|----------|---------|
| RDS Reserved Instance (1-year) | ~30% off RDS = $4/month |
| Savings Plans (Lambda) | ~17% on compute |
| S3 Intelligent-Tiering | Automatic storage class optimization |
| Right-size Lambda memory | Reduce over-provisioned functions |

#### Long-Term Savings

| Strategy | When | Impact |
|----------|------|--------|
| Aurora Serverless v2 | 1000+ daily transactions | Scale-to-zero during off-hours |
| Multi-AZ RDS | Production only | Don't pay for dev/staging |
| Spot instances for batch jobs | ML model training | 60-90% savings |

## Cost Comparison Summary

| Scenario | Supabase | AWS (Year 1) | AWS (Year 2+) |
|----------|----------|-------------|---------------|
| Free tier | $0 (hitting limits) | $0 for many services | N/A |
| Basic startup | $25/mo (Pro) | $20/mo (with fck-nat) | $49/mo |
| Growing (1000 users) | $25-$75/mo | $20-$30/mo | $50-$80/mo |
| Scale (10k users) | $599/mo (Team) | $80-$150/mo | $80-$150/mo |
| Enterprise (100k users) | Custom ($$$) | $300-$500/mo | $300-$500/mo |

**Key insight**: AWS is cheaper at scale because you pay per-use, not per-tier.
Supabase's tiered pricing creates cliffs at each level.

## Break-Even Analysis

- **AWS cheaper than Supabase Free**: No, AWS has baseline costs (~$20/month)
  that Supabase Free doesn't have
- **AWS cheaper than Supabase Pro ($25)**: Yes, if using fck-nat (~$20/month)
- **AWS cheaper than Supabase Team ($599)**: Significantly, even with
  full NAT Gateway

**The migration makes financial sense when:**
1. You're about to exceed Supabase Free tier limits (now)
2. You want predictable, granular cost control
3. You're already paying for AWS infrastructure (you are)
4. You expect to grow beyond 1,000 active users

## Hidden Costs to Budget For

| Item | One-Time Cost | Notes |
|------|-------------|-------|
| Developer time for migration | Engineering hours | Biggest cost |
| Dual-running period | ~$20/month extra | Running both systems during transition |
| Testing infrastructure | ~$10/month | Separate dev/staging RDS instances |
| Monitoring setup | $0 (CloudWatch) | Already configured |
| Documentation updates | Engineering hours | Update runbooks, guides |

## Recommendation

**Proceed with migration.** The operational benefits (single platform, full
control, better scaling) outweigh the cost difference. Budget **$20-50/month**
for the first year, scaling with actual usage. The alternative -- Supabase Pro
at $25/month with limited control -- provides less long-term value for a
fintech platform that needs full infrastructure ownership.
