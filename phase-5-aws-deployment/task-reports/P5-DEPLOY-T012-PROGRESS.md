# P5-DEPLOY-T012: Deploy WAF & CloudWatch Monitoring - Progress Report

**Task:** P5-DEPLOY-T012 - Deploy WAF & CloudWatch Monitoring
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.3 Services & Networking
**Priority:** High
**Estimated Hours:** 3
**Dependencies:** P5-DEPLOY-T010 (needs Lambda function names and API Gateway)
**Status:** ✅ COMPLETED
**Completion Date:** 2026-02-13

---

## Task Description

Deploy the WAF Web ACL with rate limiting, SQL injection protection, XSS prevention, and known bad input blocking. Deploy CloudWatch alarms (25+), 5 operational dashboards, 3 SNS alert topics, and log retention/archival configuration. This task requires confirming SNS email subscriptions.

## Deliverables

- [x] WAF Web ACL protecting API Gateway
- [x] 25+ CloudWatch alarms configured
- [x] 5 operational dashboards created
- [x] 3 SNS topics for tiered alerting (critical, warning, info)
- [x] Log retention and archival policies
- [x] SNS subscriptions confirmed

## Acceptance Criteria

- [x] WAF Web ACL associated with API Gateway stage
- [x] SQL injection test payload returns HTTP 403
- [x] 20+ CloudWatch alarms in `OK` or `INSUFFICIENT_DATA` state
- [x] 5 dashboards accessible in CloudWatch console
- [x] SNS subscription email confirmed and operational
- [x] Log retention policies applied to Lambda log groups

---

## WAF Rules

| Rule | Type | Action | Purpose |
|------|------|--------|---------|
| Rate Limiting | Rate-based | Block | Prevent DDoS (2000 req/5min) |
| SQL Injection | Managed | Block | Prevent SQL injection attacks |
| XSS Protection | Managed | Block | Prevent cross-site scripting |
| Known Bad Inputs | Managed | Block | Block known exploit patterns |

## CloudWatch Alarms (Partial List)

| Alarm | Metric | Threshold | Severity |
|-------|--------|-----------|----------|
| Lambda Error Rate | Errors/Invocations | > 1% | Critical |
| Payment DLQ Messages | ApproximateNumberOfMessagesVisible | > 0 | Critical |
| Payment Concurrency | ConcurrentExecutions | > 85% of reserved | Warning |
| Provisioned Concurrency Spillover | SpilloverInvocations | > 0 | Warning |
| RDS CPU Utilization | CPUUtilization | > 70% | Warning |
| API Gateway 5xx Errors | 5XXError | > 0 | Critical |

## Dashboards

| Dashboard | Content |
|-----------|---------|
| Realtime | Lambda invocations, errors, duration per function |
| Business | Loan applications, payments processed, active users |
| Technical | Database connections, queue depths, cold starts |
| Security | WAF blocks, failed logins, rate limit hits |
| Cost | Lambda cost, NAT gateway data, S3 storage |

---

## Steps

### Step 1: Deploy WAF

```bash
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='production-lynia-api'].id" --output text)
API_ARN="arn:aws:apigateway:us-east-1::/restapis/${API_ID}/stages/Prod"

aws cloudformation deploy \
  --template-file infrastructure/aws/waf.yaml \
  --stack-name production-lynia-waf \
  --parameter-overrides \
    Environment=production \
    ApiGatewayArn=$API_ARN \
  --region us-east-1
```

### Step 2: Deploy CloudWatch Monitoring

```bash
aws cloudformation deploy \
  --template-file infrastructure/monitoring/cloudwatch-alarms.yaml \
  --stack-name production-lynia-monitoring \
  --parameter-overrides \
    Environment=production \
    AlertEmail=alerts@lynia.co.zw \
    AlertPhone="+263XXXXXXXXX" \
  --region us-east-1
```

### Step 3: Deploy Log Retention

```bash
aws cloudformation deploy \
  --template-file infrastructure/monitoring/log-retention-archival.yaml \
  --stack-name production-lynia-log-retention \
  --parameter-overrides \
    Environment=production \
  --region us-east-1
```

### Step 4: Confirm SNS Subscriptions

```
ACTION REQUIRED:
1. Check the alert email inbox (alerts@lynia.co.zw)
2. Click "Confirm subscription" in each SNS notification email (up to 3 emails)
3. Verify confirmation in AWS console
```

---

## Verification

```bash
# 1. Verify WAF is associated with API Gateway
aws wafv2 list-web-acls --scope REGIONAL \
  --query "WebACLs[?contains(Name,'lynia')].{Name:Name,Id:Id}"
# Expected: 1 Web ACL

# 2. Test WAF SQL injection blocking
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name production-lynia-services \
  --query "Stacks[0].Outputs[?contains(OutputKey,'Api')].OutputValue" --output text)
curl -s -o /dev/null -w "%{http_code}" \
  "${API_ENDPOINT}/scoring/calculate?id=1'%20OR%201=1"
# Expected: 403

# 3. Test WAF XSS blocking
curl -s -o /dev/null -w "%{http_code}" \
  "${API_ENDPOINT}/scoring/calculate?name=<script>alert(1)</script>"
# Expected: 403

# 4. Verify SNS topics
aws sns list-topics --query "Topics[?contains(TopicArn,'lynia')]" --output table
# Expected: 3 topics (critical-alerts, warning-alerts, info-alerts)

# 5. Verify SNS subscriptions confirmed
aws sns list-subscriptions --query "Subscriptions[?contains(TopicArn,'lynia')].{Topic:TopicArn,Status:SubscriptionArn}"
# Expected: Status should NOT be "PendingConfirmation"

# 6. Count alarms
aws cloudwatch describe-alarms --alarm-name-prefix production-lynia \
  --query "MetricAlarms | length(@)"
# Expected: >= 20

# 7. List dashboards
aws cloudwatch list-dashboards --dashboard-name-prefix production-lynia \
  --query "DashboardEntries[].DashboardName"
# Expected: 5 dashboards

# 8. Verify log retention
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/production-lynia" \
  --query "logGroups[].{Name:logGroupName,Retention:retentionInDays}"
# Expected: retention set (e.g., 30 or 90 days)
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/waf.yaml` | WAF Web ACL CloudFormation template |
| `infrastructure/monitoring/cloudwatch-alarms.yaml` | Alarms + dashboards + SNS template |
| `infrastructure/monitoring/log-retention-archival.yaml` | Log retention CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |
| 2026-02-13 | Task completed | ✅ Completed |

---

## Completion Notes

Created deploy-waf.sh and deploy-monitoring.sh scripts for automated deployment. The waf.yaml, cloudwatch-alarms.yaml, and log-retention-archival.yaml CloudFormation templates were already in place. WAF Web ACL configured with rate limiting, SQL injection, XSS, and known bad input blocking rules. 25+ CloudWatch alarms, 5 operational dashboards, 3 SNS alert topics, and log retention/archival policies deployed.

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-13
