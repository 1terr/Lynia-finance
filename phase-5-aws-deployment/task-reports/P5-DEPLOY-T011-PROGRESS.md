# P5-DEPLOY-T011: Deploy API Gateway Throttling & Usage Plans - Progress Report

**Task:** P5-DEPLOY-T011 - Deploy API Gateway Throttling & Usage Plans
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.3 Services & Networking
**Priority:** High
**Estimated Hours:** 2
**Dependencies:** P5-DEPLOY-T010 (needs API Gateway REST API ID)
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy 3 tiered API Gateway usage plans (internal, partner, public) with rate limiting and burst controls. Create 5 API keys for different service consumers. Enable CloudWatch detailed execution logging on the API Gateway stage.

## Deliverables

- [ ] 3 usage plans with tiered throttling deployed
- [ ] 5 API keys created and linked to plans
- [ ] CloudWatch execution logging enabled
- [ ] Stack outputs recorded

## Acceptance Criteria

- [ ] Stack status: `CREATE_COMPLETE`
- [ ] 3 usage plans visible (internal, partner, public)
- [ ] 5 API keys enabled and associated
- [ ] Stage method settings: `metricsEnabled: true`
- [ ] Rate limit exceeded returns HTTP 429

---

## Usage Plan Configuration

| Plan | Rate (RPS) | Burst | Quota (Monthly) | Consumers |
|------|-----------|-------|-----------------|-----------|
| Internal | 100 | 200 | 1,000,000 | admin-portal, distributor-dashboard |
| Partner | 200 | 400 | 5,000,000 | payment-provider, kyc-provider |
| Public | 20 | 50 | 100,000 | whatsapp-webhook |

## API Key Assignments

| Key | Usage Plan | Purpose |
|-----|-----------|---------|
| `admin-portal-key` | Internal | Admin dashboard API access |
| `distributor-dashboard-key` | Internal | Distributor agent portal |
| `whatsapp-webhook-key` | Public | WhatsApp webhook callbacks |
| `payment-provider-key` | Partner | EcoCash/OneMoney callbacks |
| `kyc-provider-key` | Partner | Smile Identity callbacks |

---

## Steps

### Step 1: Get API Gateway REST API ID

```bash
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='production-lynia-api'].id" --output text)
echo "API_ID=$API_ID"
```

### Step 2: Deploy Throttling Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/api-gateway/throttling-usage-plans.yaml \
  --stack-name production-lynia-throttling \
  --parameter-overrides \
    Environment=production \
    ApiGatewayRestApiId=$API_ID \
    ApiGatewayStageName=Prod \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-throttling \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. List usage plans
aws apigateway get-usage-plans \
  --query "items[?contains(name,'lynia')].{Name:name,Id:id}" --output table
# Expected: 3 plans

# 3. List API keys
aws apigateway get-api-keys \
  --query "items[?contains(name,'lynia')].{Name:name,Enabled:enabled}" --output table
# Expected: 5 keys, all enabled

# 4. Verify stage settings
aws apigateway get-stage --rest-api-id $API_ID --stage-name Prod \
  --query "methodSettings.'*/*'.{Throttle:throttlingRateLimit,Metrics:metricsEnabled,Logging:loggingLevel}"
# Expected: metricsEnabled=true, loggingLevel=ERROR or INFO

# 5. Test rate limiting (send burst of requests)
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" "${API_ENDPOINT}/health" -H "x-api-key: invalid-key"
done
# Expected: Should see 429 responses after exceeding public tier
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/api-gateway/throttling-usage-plans.yaml` | Throttling CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
