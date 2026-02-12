# P5-DEPLOY-T015: Deploy Lambda Auto-Scaling & Canary Deployments - Progress Report

**Task:** P5-DEPLOY-T015 - Deploy Lambda Auto-Scaling & Canary Deployments
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.4 Frontend & Finalization
**Priority:** High
**Estimated Hours:** 2
**Dependencies:** P5-DEPLOY-T010 (needs Lambda functions with `live` alias)
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy provisioned concurrency for payment, scoring, and WhatsApp services to eliminate cold starts on critical paths. Enable Application Auto Scaling with target tracking at 70% utilization and scheduled scaling for Zimbabwe business hours (06:00-20:00 CAT). Deploy CodeDeploy canary deployment configuration for safe traffic shifting. Deploy X-Ray distributed tracing.

## Deliverables

- [ ] Provisioned concurrency active on 3 services
- [ ] Auto-scaling policies with target tracking at 70%
- [ ] Scheduled scaling for ZW business hours
- [ ] CodeDeploy canary deployment configuration
- [ ] X-Ray sampling rules configured

## Acceptance Criteria

- [ ] Provisioned concurrency `ready`: payment (5), scoring (3), whatsapp (3)
- [ ] 3 scalable targets registered in Application Auto Scaling
- [ ] CodeDeploy application and deployment groups exist
- [ ] X-Ray sampling rule `{env}-lynia-default` exists
- [ ] No SpilloverInvocations after provisioning is ready

---

## Configuration

### Provisioned Concurrency (Production)

| Service | Reserved | Provisioned Min | Provisioned Max | Target Tracking |
|---------|----------|----------------|-----------------|-----------------|
| Payment | 100 | 5 | 50 | 70% utilization |
| Scoring | 50 | 3 | 30 | 70% utilization |
| WhatsApp | — | 3 | 30 | 70% utilization |

### Scheduled Scaling

| Schedule | Time (CAT/UTC+2) | Min Capacity | Purpose |
|----------|-----------------|-------------|---------|
| Scale Up | 06:00 CAT (04:00 UTC) | 5/3/3 | Business hours start |
| Scale Down | 20:00 CAT (18:00 UTC) | 2/1/1 | After business hours |

### Canary Deployment

| Phase | Traffic | Duration |
|-------|---------|----------|
| Canary | 10% | 5 minutes |
| Full | 100% | Immediate after canary passes |

---

## Steps

### Step 1: Deploy Auto-Scaling

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/lambda-autoscaling.yaml \
  --stack-name production-lynia-autoscaling \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### Step 2: Deploy Canary Deployments

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/canary-deployments.yaml \
  --stack-name production-lynia-canary \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --region us-east-1
```

### Step 3: Deploy X-Ray Tracing

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/xray-tracing.yaml \
  --stack-name production-lynia-xray \
  --parameter-overrides Environment=production \
  --region us-east-1
```

---

## Verification

```bash
# 1. Verify provisioned concurrency on each service
for svc in payment scoring whatsapp; do
  echo "=== $svc ==="
  aws lambda get-provisioned-concurrency-config \
    --function-name "production-lynia-${svc}-service" \
    --qualifier live \
    --query "{Status:Status,Requested:RequestedProvisionedConcurrentExecutions,Available:AvailableProvisionedConcurrentExecutions}"
done
# Expected: Status=ready, payment=5, scoring=3, whatsapp=3

# 2. Verify auto-scaling targets
aws application-autoscaling describe-scalable-targets \
  --service-namespace lambda \
  --query "ScalableTargets[?contains(ResourceId,'lynia')].{Resource:ResourceId,Min:MinCapacity,Max:MaxCapacity}"
# Expected: 3 targets with correct min/max values

# 3. Verify scaling policies
aws application-autoscaling describe-scaling-policies \
  --service-namespace lambda \
  --query "ScalingPolicies[?contains(PolicyName,'lynia')].{Name:PolicyName,Type:PolicyType}"
# Expected: TargetTrackingScaling policies for each service

# 4. Verify CodeDeploy application
aws deploy list-applications \
  --query "applications[?contains(@,'lynia')]"
# Expected: application name

# 5. Verify X-Ray sampling rules
aws xray get-sampling-rules \
  --query "SamplingRuleRecords[?SamplingRule.RuleName=='production-lynia-default'].SamplingRule.{Name:RuleName,Rate:FixedRate}"
# Expected: sampling rule with appropriate rate

# 6. No spillover invocations (cold starts)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name SpilloverInvocations \
  --dimensions Name=FunctionName,Value=production-lynia-payment-service \
  --start-time $(date -u -d '-10 minutes' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
# Expected: 0 spillover invocations
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/lambda-autoscaling.yaml` | Auto-scaling CloudFormation template |
| `infrastructure/aws/canary-deployments.yaml` | CodeDeploy canary template |
| `infrastructure/aws/xray-tracing.yaml` | X-Ray tracing template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
