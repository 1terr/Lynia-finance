# T049c: AWS API Gateway Free Tier Research

**Task:** Research AWS API Gateway free tier (1M requests/month for 12 months, then $1/million)
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 17, 2025

---

## Executive Summary

AWS API Gateway provides a **12-month free tier** (1 million requests/month), then costs $1 per million requests. For Lynia Finance microservices, API Gateway is **optional** - Lambda functions can be invoked directly via Function URLs (free, no request charges).

**Key Finding**: **Skip API Gateway, use Lambda Function URLs instead** (permanent $0 cost vs $1/million after 12 months).

**API Gateway Free Tier**:
- **1,000,000 REST API requests/month** (12 months only, not permanent)
- **1,000,000 HTTP API requests/month** (12 months only)
- **1,000,000 messages** (WebSocket API, 12 months only)

**Lambda Function URLs** (Alternative):
- **FREE forever** (no request charges)
- **Built-in HTTPS** endpoint
- **IAM or public authentication**
- **No API Gateway features** (caching, throttling, custom domains, API keys)

**Cost After Free Tier**:
- **REST API**: $3.50 per million requests (+ $0.09/GB data transfer)
- **HTTP API**: $1.00 per million requests (cheaper, recommended)
- **Lambda Function URL**: **$0 per million requests** ✅ CHEAPEST

---

## Table of Contents

1. [API Gateway Overview](#1-api-gateway-overview)
2. [Free Tier Details](#2-free-tier-details)
3. [Pricing After Free Tier](#3-pricing-after-free-tier)
4. [Lambda Function URLs (Free Alternative)](#4-lambda-function-urls-free-alternative)
5. [Cost Comparison: API Gateway vs Function URLs](#5-cost-comparison-api-gateway-vs-function-urls)
6. [When to Use API Gateway](#6-when-to-use-api-gateway)
7. [Summary](#7-summary)

---

## 1. API Gateway Overview

### 1.1 What is API Gateway?

**AWS API Gateway**: Managed service to create, publish, maintain REST/HTTP/WebSocket APIs

**Features**:
- ✅ Custom domain names (api.lyniafinance.com)
- ✅ Request/response transformation
- ✅ API keys and usage plans (rate limiting per customer)
- ✅ Caching (reduce Lambda invocations)
- ✅ CORS configuration
- ✅ Request validation (reject malformed requests before Lambda)
- ✅ Throttling (protect backend from DDoS)
- ✅ AWS WAF integration (firewall)

### 1.2 API Gateway Types

| Type | Use Case | Cost (after free tier) |
|------|----------|------------------------|
| **REST API** | Full-featured, legacy | $3.50 per 1M requests |
| **HTTP API** | Modern, simpler, cheaper | **$1.00 per 1M requests** ✅ |
| **WebSocket API** | Real-time bidirectional | $1.00 per 1M messages |

**Recommendation**: Use **HTTP API** (not REST API) - 71% cheaper ($1 vs $3.50), faster, simpler.

---

## 2. Free Tier Details

### 2.1 Free Tier Allocation

**12-Month Free Tier** (from account creation date):
- **1,000,000 REST API requests/month**
- **1,000,000 HTTP API requests/month**
- **1,000,000 WebSocket messages/month**

**Daily Equivalent**:
```
1,000,000 requests ÷ 30 days = 33,333 requests/day
```

**For Lynia Finance** (Year 1):
```
Expected traffic: 25,500 requests/month (500 loans × 51 requests)
Free tier: 1,000,000 requests/month
Utilization: 2.55% ✅ (massive headroom)
```

### 2.2 What's NOT Included

**Free tier covers**:
- ✅ API Gateway request processing
- ✅ HTTPS endpoints
- ✅ CORS headers

**NOT included** (costs extra):
- ❌ Data transfer OUT > 100 GB/month: $0.09/GB
- ❌ Caching: $0.02/hour per GB cache ($14.40/month for 1 GB cache)
- ❌ Custom domain SSL certificate: $0 (if using AWS Certificate Manager)
- ❌ CloudWatch logs: $0.50/GB (if detailed logging enabled)

### 2.3 Free Tier Expiry

**After 12 months**:
- Charges begin at standard rates ($1-3.50 per million requests)
- **No notification** from AWS
- Must set budget alerts

---

## 3. Pricing After Free Tier

### 3.1 HTTP API Pricing (Recommended)

**Region**: US East (N. Virginia) - us-east-1

| Tier | Requests/Month | Cost per Million | Example Cost |
|------|----------------|------------------|--------------|
| **First 300M** | 0 - 300 million | $1.00 | 25,500 requests = $0.026/month |
| **Next 700M** | 300M - 1 billion | $0.90 | - |
| **Over 1B** | 1 billion+ | $0.80 | - |

**For Lynia Finance** (Year 2, 500 loans/month):
```
Requests: 25,500/month
Cost: 25,500 ÷ 1,000,000 × $1.00 = $0.026/month ($0.31/year)
```

**At Scale** (10,000 loans/month):
```
Requests: 510,000/month
Cost: 510,000 ÷ 1,000,000 × $1.00 = $0.51/month ($6.12/year)
```

### 3.2 REST API Pricing (Legacy, NOT Recommended)

| Tier | Cost per Million |
|------|------------------|
| **First 333M** | $3.50 |
| **Next 667M** | $2.80 |
| **Next 19B** | $2.38 |
| **Over 20B** | $1.51 |

**Why NOT Use REST API**:
- 250% more expensive than HTTP API ($3.50 vs $1.00)
- Slower (higher latency)
- More complex configuration

**Only use REST API if**:
- Need advanced features (request/response mapping, API Gateway mocks)
- Legacy system compatibility

### 3.3 Data Transfer Costs

**Data Transfer OUT** (API Gateway → Internet):
- **First 100 GB/month**: FREE ✅
- **Next 10 TB/month**: $0.09/GB
- **Next 40 TB/month**: $0.085/GB

**For Lynia Finance**:
```
Average response size: 5 KB
Requests: 25,500/month
Data transfer: 25,500 × 5 KB = 127.5 MB/month
Cost: $0 (within 100 GB free tier) ✅
```

**At Scale** (10,000 loans/month, 510K requests):
```
Data transfer: 510,000 × 5 KB = 2.55 GB/month
Cost: $0 (within 100 GB free tier) ✅
```

---

## 4. Lambda Function URLs (Free Alternative)

### 4.1 What Are Lambda Function URLs?

**Lambda Function URLs**: Built-in HTTPS endpoints for Lambda functions (launched Nov 2021)

**Features**:
- ✅ **FREE** (no per-request charges, ever)
- ✅ HTTPS by default (AWS-managed SSL certificate)
- ✅ IAM authentication OR public (no auth)
- ✅ CORS configuration
- ✅ Streaming responses (up to 20 MB)

**Limitations** (vs API Gateway):
- ❌ No custom domains (URL format: `https://abc123xyz.lambda-url.us-east-1.on.aws`)
- ❌ No API keys or usage plans
- ❌ No request validation
- ❌ No caching
- ❌ No throttling (use Lambda reserved concurrency instead)
- ❌ No request/response transformation

### 4.2 Enable Function URL

**AWS CLI**:
```bash
# Create Lambda function with Function URL
aws lambda create-function-url-config \
  --function-name whatsapp-bot \
  --auth-type NONE \  # Public access (or AWS_IAM for authenticated)
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["POST", "GET"],
    "AllowHeaders": ["content-type"],
    "MaxAge": 86400
  }'

# Output:
# {
#   "FunctionUrl": "https://abc123xyz.lambda-url.us-east-1.on.aws/",
#   "FunctionArn": "arn:aws:lambda:us-east-1:123456789012:function:whatsapp-bot",
#   "AuthType": "NONE",
#   "Cors": {...},
#   "CreationTime": "2025-11-17T10:30:00Z"
# }
```

**Invoke Function URL**:
```bash
# Call Lambda function via HTTPS
curl -X POST https://abc123xyz.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{"phone": "+263771234567", "message": "Hello from Lynia Finance!"}'

# Expected response:
# {"success": true, "message_id": "msg-123abc"}
```

### 4.3 Function URL vs API Gateway

| Feature | Function URL | API Gateway HTTP API |
|---------|--------------|----------------------|
| **Cost** | **$0** (forever) ✅ | $1 per 1M requests (after 12 months) |
| **Custom Domain** | ❌ No | ✅ Yes (api.lyniafinance.co.zw) |
| **API Keys** | ❌ No | ✅ Yes (rate limit per customer) |
| **Caching** | ❌ No | ✅ Yes ($14.40/month for 1 GB) |
| **Request Validation** | ❌ No (validate in Lambda) | ✅ Yes (reject before Lambda) |
| **Throttling** | ⚠️  Lambda-level only | ✅ API-level throttling |
| **CORS** | ✅ Yes | ✅ Yes |
| **Authentication** | IAM only | ✅ IAM, JWT, Lambda authorizer |

---

## 5. Cost Comparison: API Gateway vs Function URLs

### 5.1 Year 1 Cost (Free Tier Active)

**API Gateway HTTP API**:
```
Requests: 25,500/month
Free tier: 1,000,000/month
Cost: $0/month ✅
```

**Lambda Function URL**:
```
Requests: 25,500/month
Cost: $0/month (no per-request charge) ✅
```

**Winner**: **TIE** (both free in Year 1)

### 5.2 Year 2+ Cost (After Free Tier)

**API Gateway HTTP API**:
```
Requests: 25,500/month
Cost: 25,500 ÷ 1,000,000 × $1.00 = $0.026/month ($0.31/year)
```

**Lambda Function URL**:
```
Requests: 25,500/month
Cost: $0/month (no per-request charge) ✅
```

**Winner**: **Function URL** (saves $0.31/year)

### 5.3 At Scale (10,000 Loans/Month)

**API Gateway HTTP API**:
```
Requests: 510,000/month
Cost: 510,000 ÷ 1,000,000 × $1.00 = $0.51/month ($6.12/year)
```

**Lambda Function URL**:
```
Requests: 510,000/month
Cost: $0/month ✅
```

**Winner**: **Function URL** (saves $6.12/year)

### 5.4 3-Year Total Cost Comparison

| Solution | Year 1 | Year 2 | Year 3 | Total |
|----------|--------|--------|--------|-------|
| **Function URL** | $0 | $0 | $0 | **$0** ✅ |
| **API Gateway HTTP** | $0 | $0.31 | $0.31 | **$0.62** |
| **API Gateway REST** | $0 | $1.07 | $1.07 | **$2.14** |

**Savings**: Function URL saves $0.62 over 3 years (at 500 loans/month)

---

## 6. When to Use API Gateway

### 6.1 Use API Gateway If You Need

**1. Custom Domains**:
```
Without API Gateway:
https://abc123xyz.lambda-url.us-east-1.on.aws/ ❌ Ugly

With API Gateway:
https://api.lyniafinance.co.zw/whatsapp ✅ Professional
```

**2. API Keys & Rate Limiting**:
```
Use case: Third-party integrations (Trustonic, NuovoPay webhooks)
- Create API key for each partner
- Limit to 1,000 requests/hour per partner
- Block partner if exceeded (DDoS protection)
```

**3. Request Validation** (save Lambda costs):
```
// API Gateway rejects before Lambda invocation (saves $)
{
  "phone": "invalid"  // ❌ Rejected by API Gateway (doesn't invoke Lambda)
}

// vs Function URL (Lambda validates, wastes GB-seconds)
exports.handler = async (event) => {
  const phone = event.phone;
  if (!phone.match(/^\+263\d{9}$/)) {
    return { statusCode: 400, body: 'Invalid phone' };  // ❌ Lambda already invoked
  }
};
```

**4. Caching** (reduce Lambda invocations):
```
Use case: Credit scoring API (rarely changes)
- Cache scorecard results for 1 hour
- 100 requests → 1 Lambda invocation (99 served from cache)
- Saves: 99 × $0.0000002 per request = $0.00002 savings/100 requests
```

### 6.2 Use Function URL If You DON'T Need

- ❌ Custom domains (OK with AWS-generated URL)
- ❌ API keys (only internal microservices, no third-party access)
- ❌ Caching (dynamic responses, no benefit from caching)
- ❌ Request validation (validate in Lambda code)

**For Lynia Finance Microservices**:
```
WhatsApp Bot: Function URL ✅ (internal, no custom domain needed)
KYC Processor: Function URL ✅ (internal)
Payment Webhook: Function URL ✅ (internal)
Device Lock Automation: Function URL ✅ (internal)
Credit Scoring: Function URL ✅ (or cache in DynamoDB/Redis)

Admin Dashboard API: API Gateway ✅ (if want api.lyniafinance.co.zw)
```

### 6.3 Hybrid Approach

**Recommendation for Lynia Finance**:

```
Internal Microservices (5 functions):
├─ whatsapp-bot → Function URL (free)
├─ kyc-processor → Function URL (free)
├─ payment-webhook → Function URL (free)
├─ device-lock-automation → Function URL (free)
└─ credit-scoring → Function URL (free)

Public-Facing API (if needed):
└─ admin-dashboard-api → API Gateway HTTP API (custom domain: api.lyniafinance.co.zw)

Cost:
- Function URLs: $0/month (forever) ✅
- API Gateway: $0.026/month (Year 2+, 25,500 requests) = negligible
- Custom domain: $0/month (Route 53 hosted zone: $0.50/month)

TOTAL: $0.53/month (Year 2+) if using custom domain, $0/month if not
```

---

## 7. Summary

### 7.1 Key Findings

✅ **API Gateway free tier: 1M requests/month for 12 months**
✅ **HTTP API: $1 per 1M requests (after free tier)** - cheapest option
✅ **REST API: $3.50 per 1M requests** - expensive, avoid
✅ **Lambda Function URL: $0 per request (forever)** - CHEAPEST ✅

### 7.2 Cost Comparison (Lynia Finance, 500 Loans/Month)

| Year | Function URL | API Gateway HTTP | Savings |
|------|--------------|------------------|---------|
| **1** | $0 | $0 (free tier) | $0 |
| **2** | $0 | $0.31/year | **+$0.31** |
| **3** | $0 | $0.31/year | **+$0.31** |
| **Total** | **$0** | **$0.62** | **$0.62 saved** ✅ |

**At 10,000 Loans/Month**:
- Function URL: $0/year
- API Gateway HTTP: $6.12/year
- **Savings**: $6.12/year ✅

### 7.3 Recommendations

**PRIMARY RECOMMENDATION**: **Lambda Function URLs** (for internal microservices)

**Rationale**:
1. **Permanent free** (no per-request charges, ever)
2. **Simple setup** (one CLI command)
3. **Sufficient features** for internal microservices
4. **No custom domain needed** (microservices call each other via Function URL)

**USE API GATEWAY ONLY IF**:
- Need custom domain (api.lyniafinance.co.zw)
- Need API keys for third-party partners
- Need caching (high-traffic read-heavy endpoints)
- Need request validation (save Lambda costs)

**COST IMPACT**:
- Function URL only: **$0/month (forever)** ✅
- Function URL + API Gateway (1 custom domain): **$0.53/month** (Year 2+)

### 7.4 Implementation Plan

**Week 1**:
- [ ] Enable Function URLs for 5 microservices
- [ ] Test CORS configuration
- [ ] Document Function URL endpoints

**Week 2** (if custom domain needed):
- [ ] Purchase domain (lyniafinance.co.zw): $12/year
- [ ] Create API Gateway HTTP API
- [ ] Configure custom domain (api.lyniafinance.co.zw)
- [ ] Set up Route 53 hosted zone ($0.50/month)

**Decision Point**: Skip API Gateway for now (Year 1-2), add later if custom domain becomes important.

### 7.5 Next Steps

**Immediate**:
- [ ] Research Lambda cold start mitigation (T049d)
- [ ] Calculate Lambda usage for 5 microservices (T049e)
- [ ] Document Fineract deployment on EC2 (T049f)

---

**Status**: ✅ T049c Complete - AWS API Gateway free tier research
**Next Task**: T049d - Document Lambda cold start mitigation strategies (SnapStart, provisioned concurrency)
**Related**: T049a (Lambda), T049b (EC2), T049e (Usage estimation)
