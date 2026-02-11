# T049a: AWS Lambda Always-Free Tier Research

**Task:** Research AWS Lambda always-free tier (1M requests/month, 400K GB-seconds)
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 17, 2025

---

## Executive Summary

AWS Lambda offers a **generous always-free tier** that remains available **indefinitely** (not just 12 months like EC2). For Lynia Finance's microservices architecture, Lambda's free tier can handle **significant production traffic at $0/month** for Year 1, with extremely low costs thereafter.

**AWS Lambda Always-Free Tier**:
- **1,000,000 requests/month** (forever)
- **400,000 GB-seconds compute time/month** (forever)
- **No time limit** (unlike EC2's 12-month free tier)

**Key Finding**: Lynia Finance can run **5 microservices** (WhatsApp bot, KYC, payment processing, device lock automation, credit scoring) entirely on Lambda free tier for first 12+ months, paying **$0/month** for compute.

**Cost After Free Tier**:
- **Requests**: $0.20 per 1M requests
- **Compute**: $0.0000166667 per GB-second
- **Estimated Year 2 cost**: $3-8/month (500 loans/month, 5 microservices)

---

## Table of Contents

1. [AWS Lambda Pricing Overview](#1-aws-lambda-pricing-overview)
2. [Always-Free Tier Breakdown](#2-always-free-tier-breakdown)
3. [Cost Calculations for Lynia Finance](#3-cost-calculations-for-lynia-finance)
4. [Free Tier Usage Tracking](#4-free-tier-usage-tracking)
5. [Lambda Function Sizing](#5-lambda-function-sizing)
6. [Comparison: Lambda vs EC2 Free Tier](#6-comparison-lambda-vs-ec2-free-tier)
7. [Cost Optimization Strategies](#7-cost-optimization-strategies)
8. [Summary](#8-summary)

---

## 1. AWS Lambda Pricing Overview

### 1.1 Pricing Model

AWS Lambda charges based on two dimensions:

**1. Request Count**:
- **Always-Free**: 1,000,000 requests/month (forever)
- **Beyond Free Tier**: $0.20 per 1 million requests

**2. Compute Duration (GB-seconds)**:
- **Always-Free**: 400,000 GB-seconds/month (forever)
- **Beyond Free Tier**: $0.0000166667 per GB-second

**Formula**:
```
GB-seconds = Memory allocation (GB) × Execution duration (seconds)

Example:
- Function with 512 MB (0.5 GB) memory
- Runs for 2 seconds
- GB-seconds = 0.5 × 2 = 1 GB-second
```

### 1.2 No Infrastructure Costs

**Included FREE**:
- ✅ Infrastructure management (servers, OS, patching)
- ✅ Auto-scaling (0 to thousands of concurrent executions)
- ✅ High availability (99.99% SLA across multiple availability zones)
- ✅ Load balancing (automatic)
- ✅ Monitoring (AWS CloudWatch basic metrics)

**NOT Included** (separate costs):
- ❌ Data transfer out to internet: $0.09/GB (first 100 GB/month free)
- ❌ AWS API Gateway (if using REST API): $1.00 per 1M requests (after 1M free/month for 12 months)
- ❌ Database (RDS, DynamoDB): Separate pricing

---

## 2. Always-Free Tier Breakdown

### 2.1 Request Limit: 1,000,000/month

**What Counts as a Request**:
- Each Lambda function invocation = 1 request
- API Gateway call → Lambda = 1 request
- EventBridge trigger → Lambda = 1 request
- S3 event → Lambda = 1 request

**Daily Equivalent**:
```
1,000,000 requests/month ÷ 30 days = 33,333 requests/day
```

**Requests per Second (if evenly distributed)**:
```
33,333 requests/day ÷ 86,400 seconds = 0.39 requests/second (average)
```

**BUT** Lambda handles bursts:
- Can handle **thousands of concurrent requests**
- Free tier limit is monthly total, not per-second rate limit

### 2.2 Compute Limit: 400,000 GB-seconds/month

**What Are GB-seconds?**:
```
GB-seconds = Memory (GB) × Duration (seconds)

Examples:
- 128 MB (0.125 GB) for 1 second = 0.125 GB-seconds
- 512 MB (0.5 GB) for 2 seconds = 1 GB-second
- 1024 MB (1 GB) for 5 seconds = 5 GB-seconds
```

**How Much Compute Time Is 400,000 GB-seconds?**

| Memory Allocation | Execution Time per Request | Free Tier Allows |
|-------------------|----------------------------|------------------|
| 128 MB (0.125 GB) | 0.1 seconds | **32,000,000 requests/month** |
| 128 MB (0.125 GB) | 1 second | **3,200,000 requests/month** |
| 256 MB (0.25 GB) | 1 second | **1,600,000 requests/month** |
| 512 MB (0.5 GB) | 1 second | **800,000 requests/month** |
| 1024 MB (1 GB) | 1 second | **400,000 requests/month** |
| 1024 MB (1 GB) | 2 seconds | **200,000 requests/month** |

**Key Insight**: **GB-seconds limit is MORE restrictive than request limit** for long-running or high-memory functions.

### 2.3 Free Tier Never Expires

**Critical Difference from EC2**:

| Service | Free Tier Duration |
|---------|-------------------|
| **AWS Lambda** | ✅ **FOREVER** (always-free tier) |
| **EC2 t3.micro** | ❌ **12 months only** (then $8-12/month) |
| **API Gateway** | ❌ **12 months only** (then $1/1M requests, but Lambda always free) |

**Why This Matters**:
- Lambda free tier = **permanent $0 compute** for low-volume workloads
- EC2 free tier = **temporary $0 compute** for 12 months, then paid

---

## 3. Cost Calculations for Lynia Finance

### 3.1 Expected Traffic (Year 1)

**Assumptions**:
- **500 loans/month** (production target)
- **5 microservices**: WhatsApp bot, KYC processor, payment webhook, device lock automation, credit scoring
- **Average requests per loan**: ~50 (across all microservices)

**Monthly Request Breakdown**:

| Microservice | Requests/Loan | Total Requests/Month (500 loans) |
|--------------|---------------|----------------------------------|
| **WhatsApp Bot** | 15 (customer inquiries, status checks) | 7,500 |
| **KYC Processor** | 5 (ID upload, selfie, verification) | 2,500 |
| **Payment Webhook** | 10 (payment confirmations, receipts) | 5,000 |
| **Device Lock Automation** | 8 (lock/unlock, status checks) | 4,000 |
| **Credit Scoring** | 3 (scorecard + ML model) | 1,500 |
| **Admin Dashboard** | 10 (loan queries, reports) | 5,000 |
| **TOTAL** | **51** | **25,500 requests/month** |

**Free Tier Headroom**:
```
Free tier: 1,000,000 requests/month
Actual usage: 25,500 requests/month
Utilization: 2.55% ✅
```

**Conclusion**: **25x buffer** within free tier (can scale to 12,500 loans/month before hitting free tier limit).

### 3.2 Compute Time (GB-seconds) Analysis

**Function Sizing** (estimated):

| Microservice | Memory | Avg Duration | GB-seconds/Request |
|--------------|--------|--------------|-------------------|
| **WhatsApp Bot** | 256 MB (0.25 GB) | 0.5s | 0.125 |
| **KYC Processor** | 512 MB (0.5 GB) | 2s (image processing) | 1.0 |
| **Payment Webhook** | 256 MB (0.25 GB) | 0.3s | 0.075 |
| **Device Lock Automation** | 256 MB (0.25 GB) | 0.5s | 0.125 |
| **Credit Scoring** | 512 MB (0.5 GB) | 1.5s (ML model) | 0.75 |
| **Admin Dashboard** | 256 MB (0.25 GB) | 0.4s | 0.1 |

**Monthly Compute Usage**:

| Microservice | Requests | GB-sec/Request | Total GB-seconds |
|--------------|----------|----------------|------------------|
| WhatsApp Bot | 7,500 | 0.125 | 937.5 |
| KYC Processor | 2,500 | 1.0 | 2,500 |
| Payment Webhook | 5,000 | 0.075 | 375 |
| Device Lock Automation | 4,000 | 0.125 | 500 |
| Credit Scoring | 1,500 | 0.75 | 1,125 |
| Admin Dashboard | 5,000 | 0.1 | 500 |
| **TOTAL** | **25,500** | - | **5,937.5 GB-seconds/month** |

**Free Tier Headroom**:
```
Free tier: 400,000 GB-seconds/month
Actual usage: 5,937.5 GB-seconds/month
Utilization: 1.48% ✅
```

**Conclusion**: **67x buffer** within free tier.

### 3.3 Year 1 Cost: $0/month

```
Cost Breakdown (Month 1-12):
- Request cost: $0 (25,500 << 1,000,000 free tier)
- Compute cost: $0 (5,937.5 GB-sec << 400,000 free tier)
- Data transfer: $0 (< 100 GB/month free tier)

TOTAL: $0/month ✅
```

### 3.4 Year 2 Cost (After Scaling)

**Assumptions**:
- Scale to **1,000 loans/month** (2x Year 1 traffic)
- Traffic = 51,000 requests/month, 11,875 GB-seconds/month

**Cost Calculation**:

**Requests**:
```
Total requests: 51,000/month
Free tier: 1,000,000/month
Billable: 0 (still within free tier)
Cost: $0
```

**Compute**:
```
Total GB-seconds: 11,875/month
Free tier: 400,000/month
Billable: 0 (still within free tier)
Cost: $0
```

**TOTAL Year 2 cost: $0/month** (even at 1,000 loans/month)

### 3.5 When Does Lambda Start Costing Money?

**Break-Even Point**: When **GB-seconds** exceed 400,000/month

**For Lynia Finance**:
```
Current usage: 5,937.5 GB-sec/month (500 loans)
Free tier: 400,000 GB-sec/month

Break-even: 400,000 ÷ 5,937.5 = 67.4x current traffic
Break-even loans: 500 loans × 67.4 = 33,700 loans/month

Conclusion: Lambda is FREE until reaching 33,700 loans/month ✅
```

**Cost Beyond Free Tier** (if 40,000 loans/month, ~475,000 GB-sec/month):
```
Billable GB-seconds: 475,000 - 400,000 = 75,000
Cost: 75,000 × $0.0000166667 = $1.25/month

Billable requests: Still within 1M free tier = $0

TOTAL: $1.25/month (at 40,000 loans/month scale)
```

---

## 4. Free Tier Usage Tracking

### 4.1 AWS Cost Explorer

**How to Monitor Free Tier Usage**:

1. Log in to AWS Console: https://console.aws.amazon.com
2. Navigate to **Billing & Cost Management**
3. Click **Free Tier** (left sidebar)
4. View current month usage:
   - Lambda requests: X / 1,000,000 (Y% used)
   - Lambda compute: X GB-sec / 400,000 (Y% used)

**Screenshot Example**:
```
AWS Free Tier Usage (November 2025)

Lambda
├─ Requests: 25,500 / 1,000,000 (2.55% used) ✅
├─ Compute: 5,937 GB-sec / 400,000 (1.48% used) ✅
└─ Forecast: $0.00 (100% free tier coverage)

API Gateway
├─ Requests: 25,500 / 1,000,000 (2.55% used) ✅
└─ Forecast: $0.00 (within 12-month free tier)
```

### 4.2 CloudWatch Alarms (Budget Alerts)

**Set Budget Alert** (email notification if costs exceed $5/month):

```bash
# AWS CLI command
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "Lambda Monthly Budget",
    "BudgetLimit": {
      "Amount": "5",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "admin@lyniafinance.com"
        }
      ]
    }
  ]'
```

**Alert Triggers**:
- 80% of budget ($4/month) → Email warning
- 100% of budget ($5/month) → Email alert
- Forecast exceeds budget → Email notification

---

## 5. Lambda Function Sizing

### 5.1 Memory Allocation (128 MB - 10,240 MB)

**Available Memory Options**:
- 128 MB (minimum, cheapest)
- 256 MB
- 512 MB
- 1024 MB (1 GB)
- 1536 MB (1.5 GB)
- ... up to 10,240 MB (10 GB)

**CPU Allocation** (proportional to memory):
- 128 MB → ~0.08 vCPU
- 1024 MB → ~0.58 vCPU
- 1792 MB → ~1 full vCPU
- 3584 MB → ~2 vCPUs

**Choosing Memory**:

| Use Case | Recommended Memory |
|----------|-------------------|
| Simple HTTP handler (return JSON) | 128-256 MB |
| Database query + JSON response | 256-512 MB |
| Image processing (resize, compress) | 512-1024 MB |
| ML model inference (credit scoring) | 512-1024 MB |
| Video transcoding | 1024-3008 MB |

### 5.2 Recommended Sizing for Lynia Finance

| Microservice | Memory | Rationale |
|--------------|--------|-----------|
| **WhatsApp Bot** | 256 MB | HTTP handler, database queries, JSON responses |
| **KYC Processor** | 512 MB | Image uploads (ID card, selfie), OCR processing |
| **Payment Webhook** | 256 MB | Simple HTTP webhook, database update |
| **Device Lock Automation** | 256 MB | HTTP API call to Trustonic/NuovoPay, database log |
| **Credit Scoring** | 512 MB | Fineract API call, ML model inference (TensorFlow.js) |
| **Admin Dashboard API** | 256 MB | Database queries, aggregations, JSON responses |

### 5.3 Performance vs Cost Trade-Off

**Higher memory = Faster execution = Lower cost** (counter-intuitive):

**Example**: Credit scoring function

| Memory | Duration | GB-seconds | Cost (per 1M requests, after free tier) |
|--------|----------|------------|------------------------------------------|
| 256 MB (0.25 GB) | 3 seconds | 0.75 | $12.50 |
| 512 MB (0.5 GB) | 1.5 seconds | 0.75 | $12.50 |
| 1024 MB (1 GB) | 1 second | 1.0 | $16.67 |

**Conclusion**: **512 MB is sweet spot** (balances speed + cost). Going from 256 MB → 512 MB doubles speed without increasing GB-seconds cost (if duration halves).

---

## 6. Comparison: Lambda vs EC2 Free Tier

### 6.1 Lambda Always-Free Tier

**Pros**:
- ✅ **Never expires** (always-free, not 12-month limited)
- ✅ **Zero infrastructure management** (no OS patching, no security updates)
- ✅ **Auto-scales to zero** (pay $0 when no traffic)
- ✅ **Auto-scales to thousands** (handles traffic spikes automatically)
- ✅ **High availability built-in** (99.99% SLA, multi-AZ)
- ✅ **Pay-per-use** (only pay for actual execution time, not idle time)

**Cons**:
- ❌ **Cold starts** (300ms-2s latency for first request after idle period)
- ❌ **15-minute execution limit** (not suitable for long-running jobs)
- ❌ **Stateless** (no persistent local storage between invocations)
- ❌ **Vendor lock-in** (AWS-specific, harder to migrate)

### 6.2 EC2 t3.micro Free Tier

**Pros**:
- ✅ **Full control** (install any software, run background jobs)
- ✅ **No cold starts** (always-on server)
- ✅ **Stateful** (persistent local storage)
- ✅ **Long-running jobs** (can run 24/7 processes)

**Cons**:
- ❌ **12-month limit** (after 12 months, costs $8-12/month)
- ❌ **Infrastructure management** (OS patching, security, monitoring)
- ❌ **No auto-scaling** (need to manually provision more instances)
- ❌ **Always-on cost** (pay for idle time, even at 0% CPU usage)
- ❌ **Single point of failure** (need manual HA setup)

### 6.3 Cost Comparison (3-Year Projection)

**Scenario**: 500 loans/month → 1,000 loans/month → 2,000 loans/month

| Year | Lambda Cost | EC2 t3.micro Cost | Winner |
|------|-------------|-------------------|--------|
| **Year 1** | $0/month (free tier) | $0/month (free tier) | **TIE** |
| **Year 2** | $0/month (always free) | $10/month (paid) | **Lambda** (-$120/year) |
| **Year 3** | $0/month (always free) | $10/month (paid) | **Lambda** (-$120/year) |
| **3-Year Total** | **$0** | **$240** | **Lambda saves $240** |

**At Scale** (10,000 loans/month, ~60,000 GB-sec/month):

| Service | Monthly Cost |
|---------|-------------|
| **Lambda** | $1.00 (60K - 400K free = 0 billable GB-sec, still in free tier!) |
| **EC2 t3.micro** | $10.00 (reserved instance) or $20.00 (on-demand) |

**Winner**: **Lambda** (even at 10K loans/month scale, still mostly free)

### 6.4 Hybrid Approach (Best of Both Worlds)

**Recommendation for Lynia Finance**:

1. **Use Lambda for**: Microservices (WhatsApp, KYC, payment, device lock, scoring)
   - **Cost**: $0/month (free tier covers 33K+ loans/month)
   - **Benefit**: Zero maintenance, auto-scaling, always-free

2. **Use EC2 for**: Apache Fineract (core banking system)
   - **Cost**: $0/month (Year 1 free tier), $8/month (Year 2+ reserved instance)
   - **Benefit**: Full control, long-running Java app, stateful database connections

**Total Infrastructure Cost**:
- **Year 1**: $0/month (Lambda free + EC2 free)
- **Year 2+**: $8/month (Lambda free + EC2 reserved) ✅

**vs Railway/Fly.io**: $50-65/month ❌ (650% more expensive)

---

## 7. Cost Optimization Strategies

### 7.1 Right-Size Memory Allocation

**Use AWS Lambda Power Tuning**:

```bash
# Install AWS Lambda Power Tuning (SAR app)
# Automatically tests 128MB, 256MB, 512MB, 1024MB, 1536MB, 3008MB
# Identifies optimal memory for best cost/performance

# Example: Test credit scoring function
aws lambda invoke \
  --function-name power-tuning \
  --payload '{
    "lambdaARN": "arn:aws:lambda:us-east-1:123456789012:function:credit-scoring",
    "powerValues": [128, 256, 512, 1024],
    "num": 10
  }' \
  output.json

# Results:
# 128 MB: 3.2s avg, $0.000053 per invocation
# 256 MB: 1.8s avg, $0.000047 per invocation ← CHEAPEST
# 512 MB: 1.1s avg, $0.000046 per invocation ← FASTEST + CHEAPEST
# 1024 MB: 0.9s avg, $0.000062 per invocation
```

**Recommendation**: Use **512 MB** (best cost + speed balance).

### 7.2 Minimize Cold Starts

**Cold Start Impact**:
- First request after idle period: +300ms to +2s latency
- Subsequent requests: <10ms Lambda overhead

**Strategies to Reduce Cold Starts**:

**1. Provisioned Concurrency** (NOT recommended for free tier):
- Keeps N instances warm (always ready)
- **Cost**: $0.015 per GB-hour (expensive, ~$11/month per instance)
- **Only use for**: Critical endpoints (e.g., payment webhook)

**2. Scheduled Warm-Up** (FREE):
```javascript
// EventBridge rule: Invoke function every 5 minutes
// Prevents cold starts during business hours (8am-8pm)

// CloudFormation template
ScheduledRule:
  Type: AWS::Events::Rule
  Properties:
    ScheduleExpression: 'rate(5 minutes)'
    Targets:
      - Arn: !GetAtt CreditScoringFunction.Arn
        Input: '{"warmup": true}'
```

**Cost**: 12 warmup requests/hour × 12 hours × 30 days = 4,320 requests/month
- **Still within 1M free tier** ✅

**3. Lambda SnapStart** (Java 11+ only):
- Reduces cold starts from 2s → 200ms
- **FREE** (no additional cost)
- **Not applicable** for Node.js/Python (only Java, .NET)

### 7.3 Reduce Execution Time

**Optimize Code**:

**Before Optimization** (slow):
```javascript
// Credit scoring function (Node.js)
// SLOW: Sequential API calls

exports.handler = async (event) => {
  const fineractScore = await fetch('https://fineract.lynia.co.zw/api/scorecard');
  const mlScore = await fetch('https://ml-model.lynia.co.zw/api/predict');
  const finalScore = (fineractScore + mlScore) / 2;
  return { score: finalScore };
};

// Duration: 2.5 seconds (2 sequential 1.2s API calls + 0.1s processing)
// GB-seconds: 0.5 GB × 2.5s = 1.25 GB-seconds
```

**After Optimization** (fast):
```javascript
// FAST: Parallel API calls with Promise.all

exports.handler = async (event) => {
  const [fineractScore, mlScore] = await Promise.all([
    fetch('https://fineract.lynia.co.zw/api/scorecard'),
    fetch('https://ml-model.lynia.co.zw/api/predict')
  ]);
  const finalScore = (fineractScore + mlScore) / 2;
  return { score: finalScore };
};

// Duration: 1.3 seconds (parallel 1.2s API calls + 0.1s processing)
// GB-seconds: 0.5 GB × 1.3s = 0.65 GB-seconds (48% reduction!) ✅
```

**Savings**:
```
Before: 1.25 GB-sec/request × 1,500 requests = 1,875 GB-sec/month
After: 0.65 GB-sec/request × 1,500 requests = 975 GB-sec/month
Savings: 900 GB-sec/month (48% reduction)
```

### 7.4 Cache API Responses

**Use AWS ElastiCache (Redis) or DynamoDB for caching**:

**Example**: Cache Fineract scorecard results (rarely changes)

```javascript
// Before: Every request calls Fineract API (slow, expensive)
const scorecard = await fetch('https://fineract.lynia.co.zw/api/scorecard/user-123');

// After: Check cache first
const cached = await redis.get('scorecard:user-123');
if (cached) {
  return JSON.parse(cached); // 10ms response ✅
}

const scorecard = await fetch('https://fineract.lynia.co.zw/api/scorecard/user-123');
await redis.setex('scorecard:user-123', 3600, JSON.stringify(scorecard)); // Cache 1 hour
return scorecard;
```

**Savings**:
- **Before**: 1.3s execution time
- **After**: 0.1s execution time (cache hit), 1.3s (cache miss)
- **Cache hit rate**: 80% (assume)
- **Average duration**: 0.1s × 0.8 + 1.3s × 0.2 = 0.34s ✅ (74% reduction)

---

## 8. Summary

### 8.1 Key Findings

✅ **AWS Lambda always-free tier is PERMANENT** (not 12-month limited like EC2)
✅ **1M requests/month + 400K GB-sec/month FREE forever**
✅ **Lynia Finance can run 5 microservices at $0/month** for Year 1-2
✅ **Free tier covers up to 33,700 loans/month** (67x Year 1 target)
✅ **Year 2+ cost: $0-3/month** (even at 1,000-2,000 loans/month scale)

### 8.2 Free Tier Capacity for Lynia Finance

| Metric | Free Tier | Year 1 Usage (500 loans/month) | Headroom |
|--------|-----------|-------------------------------|----------|
| **Requests** | 1,000,000/month | 25,500/month | **39x** ✅ |
| **Compute (GB-sec)** | 400,000/month | 5,937.5/month | **67x** ✅ |
| **Cost** | $0/month | $0/month | **100% free** ✅ |

**Conclusion**: Lambda free tier has **massive headroom** (can scale to 15,000+ loans/month before costs apply).

### 8.3 Cost Projection (3-Year)

| Year | Loans/Month | Requests/Month | GB-sec/Month | Lambda Cost | EC2 Cost | Savings |
|------|-------------|----------------|--------------|-------------|----------|---------|
| **1** | 500 | 25,500 | 5,937 | **$0** | $0 (free tier) | $0 |
| **2** | 1,000 | 51,000 | 11,875 | **$0** | $120/year | **+$120** |
| **3** | 2,000 | 102,000 | 23,750 | **$0** | $120/year | **+$120** |
| **Total** | - | - | - | **$0** | **$240** | **$240 saved** |

**At 10,000 loans/month**:
- Lambda: **$0-1/month** (still mostly within free tier)
- EC2: **$10-20/month**
- **Savings**: $9-19/month ($108-228/year)

### 8.4 Recommendation

**PRIMARY DEPLOYMENT**: **AWS Lambda** (for microservices)

**Rationale**:
1. **Permanent free tier** (not 12-month limited)
2. **Massive headroom** (67x capacity before costs apply)
3. **Zero infrastructure management** (no servers, no OS patching)
4. **Auto-scaling** (0 to thousands of requests, automatic)
5. **Cost after free tier**: $0-3/month (Year 2+, even at 2,000 loans/month)

**SECONDARY DEPLOYMENT**: **EC2 t3.micro** (for Apache Fineract only)
- **Cost**: $0/month (Year 1), $8/month (Year 2+, reserved instance)
- **Rationale**: Fineract is Java-based, long-running, stateful (better fit for EC2)

**TOTAL INFRASTRUCTURE COST**:
- **Year 1**: $0/month (Lambda + EC2 both free)
- **Year 2+**: $8/month (Lambda free + EC2 reserved) ✅

**vs Railway/Fly.io**: $50-65/month ❌ (650% more expensive)

### 8.5 Next Steps

**Immediate**:
- [ ] Create AWS account (T049i)
- [ ] Verify free tier eligibility (no previous AWS account in last 12 months for EC2)
- [ ] Set up budget alerts ($5/month threshold)

**Week 1**:
- [ ] Research API Gateway free tier (T049c) - 1M requests/month for 12 months
- [ ] Research EC2 t3.micro free tier (T049b) - 750 hours/month for 12 months
- [ ] Document deployment strategy (T049h) - AWS SAM vs Serverless Framework

**Week 2**:
- [ ] Deploy first Lambda function (WhatsApp bot)
- [ ] Monitor free tier usage (AWS Cost Explorer)
- [ ] Optimize function memory allocation (AWS Lambda Power Tuning)

---

**Status**: ✅ T049a Complete - AWS Lambda always-free tier research
**Next Task**: T049b - Research AWS EC2 t3.micro free tier (750 hrs/month for 12 months)
**Related**: T049 (API testing), T049c (API Gateway), T049d (Cold starts), T049e (Usage estimation)
