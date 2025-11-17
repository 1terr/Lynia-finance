# T049d: Lambda Cold Start Mitigation Strategies

**Task:** Document Lambda cold start mitigation strategies (SnapStart, provisioned concurrency)
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 17, 2025

---

## Executive Summary

Lambda cold starts add 300ms-2s latency for first requests after idle periods. For Lynia Finance's use case (500 loans/month, low traffic), **cold starts are acceptable** and mitigation strategies are **NOT cost-effective**.

**Cold Start Impact**: 1-2% of requests (low-traffic workloads), adds 300-800ms latency

**Mitigation Strategies**:
1. **SnapStart** (Java only): FREE, reduces cold starts from 2s → 200ms ❌ Not applicable (using Node.js)
2. **Provisioned Concurrency**: Keeps functions warm, $0.015/GB-hour = $11/month per function ❌ Too expensive
3. **Scheduled Warm-up**: FREE, ping functions every 5 min during business hours ✅ RECOMMENDED (if needed)
4. **Code Optimization**: Reduce package size, lazy imports ✅ FREE

**Recommendation**: **Accept cold starts** (300ms acceptable for microservices), use **scheduled warm-up** only for critical endpoints (payment webhook).

---

## 1. Understanding Cold Starts

### 1.1 What is a Cold Start?

**Cold Start**: Time to initialize Lambda execution environment

**Phases**:
1. **Download code**: Fetch deployment package from S3 (50-200ms)
2. **Init runtime**: Start Node.js/Python runtime (100-300ms)
3. **Run init code**: Import modules, connect to database (100-500ms)
4. **Execute handler**: Run function code (10-100ms)

**Total Cold Start Time**:
- **Node.js** (256-512 MB): 300-800ms
- **Python** (256-512 MB): 200-600ms
- **Java** (512-1024 MB): 1,000-2,000ms (SnapStart: 200-400ms)

### 1.2 When Do Cold Starts Occur?

**Triggers**:
- First request after deployment
- First request after 15+ minutes idle
- Scale-up (new concurrent executions beyond warm instances)

**For Lynia Finance** (500 loans/month, ~25,500 requests/month):
```
Requests per day: 850
Requests per hour: 35 (8am-8pm business hours)
Requests per 15 min: 9

Cold start frequency: ~1-2% of requests (first request after 15 min idle)
```

**Impact**: 200-300 requests/month experience 300-800ms extra latency = acceptable ✅

---

## 2. Mitigation Strategy 1: Scheduled Warm-Up (FREE)

### 2.1 How It Works

**Concept**: Invoke function every 5-15 minutes to keep warm

**Implementation** (EventBridge cron):
```javascript
// CloudFormation template
Resources:
  WarmUpRule:
    Type: AWS::Events::Rule
    Properties:
      ScheduleExpression: 'rate(5 minutes)'  # Every 5 minutes
      State: ENABLED
      Targets:
        - Arn: !GetAtt PaymentWebhookFunction.Arn
          Input: '{"warmup": true}'

  WarmUpPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref PaymentWebhookFunction
      Action: lambda:InvokeFunction
      Principal: events.amazonaws.com
      SourceArn: !GetAtt WarmUpRule.Arn

// Lambda handler
exports.handler = async (event) => {
  // Skip processing if warmup request
  if (event.warmup) {
    console.log('Warmup request, returning immediately');
    return { statusCode: 200, body: 'Warmed up' };
  }

  // Normal processing
  // ...
};
```

**Cost**:
```
Warm-up invocations: 12/hour × 12 hours/day × 30 days = 4,320/month
Lambda free tier: 1,000,000 requests/month
Cost: $0 (well within free tier) ✅
```

**Pros**:
- ✅ FREE (no additional cost)
- ✅ Simple to implement
- ✅ Reduces cold starts to near-zero during business hours

**Cons**:
- ❌ Functions still cold outside scheduled hours (e.g., night)
- ❌ Need to add warmup logic to each function

### 2.2 Scheduled Warm-Up Configuration

**Business Hours Only** (8am-8pm, Africa/Harare time):
```yaml
# EventBridge cron expression (UTC)
# Africa/Harare = UTC+2
# 8am Harare = 6am UTC, 8pm Harare = 6pm UTC

ScheduleExpression: 'cron(*/5 6-18 * * ? *)'  # Every 5 min, 6am-6pm UTC
```

**Cost Analysis**:
```
Warm-ups per day: 12 per hour × 12 hours = 144
Warm-ups per month: 144 × 30 = 4,320
Compute time: 4,320 × 0.1s × 0.25 GB = 108 GB-seconds/month

Lambda free tier: 400,000 GB-sec/month
Cost: $0 ✅
```

---

## 3. Mitigation Strategy 2: Provisioned Concurrency (EXPENSIVE)

### 3.1 What is Provisioned Concurrency?

**Provisioned Concurrency**: Pre-initialized Lambda instances (always warm)

**How It Works**:
- AWS keeps N instances running 24/7
- Zero cold starts
- Instant response (<10ms Lambda overhead)

**Cost**: $0.015 per GB-hour

### 3.2 Cost Calculation

**Example**: Keep 1 instance warm (512 MB function):
```
Cost per hour: 0.5 GB × $0.015 = $0.0075/hour
Cost per day: $0.0075 × 24 = $0.18/day
Cost per month: $0.18 × 30 = $5.40/month

For 5 microservices: $5.40 × 5 = $27/month ❌ EXPENSIVE
```

**vs Lambda Free Tier Compute**:
```
Provisioned concurrency GB-hours: 0.5 GB × 720 hours = 360 GB-hours/month
Lambda free tier: 400,000 GB-seconds ÷ 3600 = 111 GB-hours/month

Conclusion: Provisioned concurrency EXCEEDS free tier (3.2x over)
```

### 3.3 When to Use Provisioned Concurrency

**Use If**:
- Critical low-latency requirements (<50ms P99)
- High-traffic (thousands of requests/second)
- Enterprise customers with SLA guarantees

**NOT for Lynia Finance**:
- ❌ Low traffic (35 requests/hour)
- ❌ Cost: $27/month for 5 functions (vs $0 scheduled warm-up)
- ❌ Cold start impact: 300ms acceptable for microservices

---

## 4. Mitigation Strategy 3: SnapStart (Java Only)

### 4.1 What is SnapStart?

**SnapStart**: AWS Lambda feature for Java 11+ (launched Nov 2022)

**How It Works**:
- Pre-initializes Java runtime
- Takes snapshot of initialized state
- Restores from snapshot on cold start

**Performance**:
- **Before**: 2,000ms cold start (Java heavy initialization)
- **After**: 200ms cold start (90% reduction) ✅

**Cost**: FREE (no additional charge)

### 4.2 Applicability to Lynia Finance

**Current Stack**: Node.js (not Java)

**Conclusion**: SnapStart NOT applicable ❌

**IF Using Java** (Apache Fineract):
- Fineract runs on EC2 (not Lambda), so SnapStart not relevant
- If migrating Fineract to Lambda in future, SnapStart would help

---

## 5. Mitigation Strategy 4: Code Optimization

### 5.1 Reduce Package Size

**Impact**: Smaller packages download faster (reduce cold start by 50-200ms)

**Techniques**:

**1. Exclude Dev Dependencies**:
```json
// package.json
{
  "dependencies": {
    "axios": "^1.6.0",  // Production only
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",  // NOT bundled in deployment
    "eslint": "^8.0.0"
  }
}

// Deploy
npm install --production  # Excludes devDependencies
```

**2. Use AWS SDK v3** (modular imports):
```javascript
// Before (AWS SDK v2): Imports entire SDK (2.5 MB)
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// After (AWS SDK v3): Imports only S3 client (150 KB)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client({});
```

**Savings**: 2.35 MB reduction = 100-150ms faster cold start

**3. Minimize Dependencies**:
```javascript
// Before: Heavy library (lodash, 500 KB)
import _ from 'lodash';
const result = _.chunk(array, 10);

// After: Native JavaScript (0 KB)
const result = array.reduce((acc, _, i) =>
  i % 10 ? acc : [...acc, array.slice(i, i + 10)], []);
```

### 5.2 Lazy Loading (Import on Demand)

**Technique**: Import modules only when needed

**Before** (eager loading):
```javascript
// All imports at top (run during cold start)
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';  // Heavy (500 KB), but only used in 10% of requests

exports.handler = async (event) => {
  if (event.action === 'send_sms') {
    const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
    // ...
  }
  // Other actions don't use Twilio
};

// Cold start: 800ms (imports all modules)
```

**After** (lazy loading):
```javascript
// Import only required modules at top
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

exports.handler = async (event) => {
  if (event.action === 'send_sms') {
    // Import Twilio only when needed (AFTER cold start)
    const twilio = await import('twilio');
    const client = twilio.default(ACCOUNT_SID, AUTH_TOKEN);
    // ...
  }
};

// Cold start: 400ms (skips Twilio import)
// SMS requests: +100ms (import Twilio on first use)
```

**Savings**: 400ms cold start (50% reduction) ✅

---

## 6. Recommendations for Lynia Finance

### 6.1 Accept Cold Starts (Default)

**Rationale**:
- Low traffic: 35 requests/hour → cold starts affect 1-2% of requests
- 300ms latency acceptable for microservices (not customer-facing)
- FREE (no mitigation cost)

**When Cold Starts Occur**:
```
Scenario 1: Morning first request (8:01am)
- Cold start: 300ms
- Subsequent requests (8:02am-8:15am): 10ms (warm)

Scenario 2: Lunch break (12:00pm-2:00pm, no traffic)
- First request (2:01pm): 300ms cold start
- Subsequent requests: 10ms (warm)
```

**Customer Impact**: None (microservices internal, not customer-facing)

### 6.2 Scheduled Warm-Up (Critical Functions Only)

**Use For**: Payment webhook (time-sensitive, must be <500ms)

**Implementation**:
```yaml
# EventBridge rule: Warm up payment webhook every 5 minutes (8am-8pm)
Resources:
  PaymentWebhookWarmUp:
    Type: AWS::Events::Rule
    Properties:
      ScheduleExpression: 'cron(*/5 6-18 * * ? *)'  # Every 5 min, 6am-6pm UTC
      Targets:
        - Arn: !GetAtt PaymentWebhookFunction.Arn
          Input: '{"warmup": true}'
```

**Cost**: $0 (4,320 warm-ups/month << 1M free tier)

### 6.3 Code Optimization (All Functions)

**Apply To**: All 5 microservices

**Optimizations**:
1. ✅ Use AWS SDK v3 (modular imports)
2. ✅ Exclude dev dependencies (`npm install --production`)
3. ✅ Lazy load heavy libraries (Twilio, image processing)
4. ✅ Minimize dependencies (use native JavaScript where possible)

**Expected Cold Start**:
- Before: 800ms (large package, eager loading)
- After: 300-400ms (optimized package, lazy loading) ✅ 50% reduction

---

## 7. Summary

### 7.1 Cold Start Mitigation Matrix

| Strategy | Cost | Effectiveness | Recommended |
|----------|------|---------------|-------------|
| **Scheduled Warm-Up** | $0 (free tier) | Reduces to near-zero (business hours) | ✅ **YES** (critical functions) |
| **Provisioned Concurrency** | $27/month (5 functions) | Zero cold starts (24/7) | ❌ NO (too expensive) |
| **SnapStart** | $0 (free) | 90% reduction (Java only) | ❌ N/A (using Node.js) |
| **Code Optimization** | $0 (free) | 50% reduction (300ms → 150ms) | ✅ **YES** (all functions) |
| **Accept Cold Starts** | $0 (free) | N/A (300ms cold starts) | ✅ **YES** (non-critical functions) |

### 7.2 Implementation Plan

**Week 1** (All Functions):
- [ ] Optimize package size (use AWS SDK v3, exclude dev deps)
- [ ] Implement lazy loading for heavy libraries
- [ ] Measure cold start improvement (CloudWatch Logs)

**Week 2** (Critical Functions):
- [ ] Add scheduled warm-up for payment webhook
- [ ] Test warm-up during business hours (8am-8pm)
- [ ] Monitor cold start frequency (CloudWatch Insights)

**Cost**: $0/month ✅

### 7.3 Expected Results

**Before Optimization**:
- Cold start: 800ms (2-3% of requests)
- Warm response: 50ms

**After Optimization**:
- Cold start: 300ms (payment webhook: 0% during business hours, other functions: 1-2%)
- Warm response: 50ms

**Customer Impact**: None (microservices internal, 300ms acceptable)

---

**Status**: ✅ T049d Complete - Lambda cold start mitigation strategies documented
**Next Task**: T049e - Calculate estimated Lambda usage for 5 microservices
**Related**: T049a (Lambda free tier), T049c (API Gateway), T049e (Usage estimation)
