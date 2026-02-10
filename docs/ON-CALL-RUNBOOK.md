# Lynia Finance - On-Call Runbook

## Alert Escalation Matrix

| Severity | Response Time | Channel | Action |
|----------|--------------|---------|--------|
| **CRITICAL** | < 15 minutes | SMS + Email + Slack | Page on-call, begin incident response |
| **WARNING** | < 1 hour | Email + Slack | Investigate during business hours |
| **INFO** | Next business day | Email | Log for review |

## Critical Alerts

### 1. Payment Service Error Rate > 5%

**Alarm**: `{env}-lynia-payment-error-critical`

**Impact**: Customers cannot make payments or receive disbursements.

**Triage Steps**:
1. Check CloudWatch Logs for the payment service:
   ```bash
   sam logs --stack-name lynia-finance-prod --name PaymentService --tail
   ```
2. Check if external payment providers (EcoCash, OneMoney) are down:
   - EcoCash status: Check `{env}-lynia-payment-service` logs for `PAY_PROV_001` errors
   - OneMoney status: Look for timeout errors (`PAY_TIME_001`)
3. Check DLQ for failed payment messages:
   ```bash
   aws sqs get-queue-attributes \
     --queue-url https://sqs.us-east-1.amazonaws.com/{account}/{env}-lynia-payment-dlq \
     --attribute-names ApproximateNumberOfMessagesVisible
   ```

**Resolution**:
- If provider is down: Enable circuit breaker, notify customers via WhatsApp template
- If our code is failing: Check recent deployments, consider rollback
- If database issues: Check connection pool (see Database section)

**Rollback**:
```bash
./scripts/rollback.sh production
```

---

### 2. Service Availability < 99.9%

**Alarm**: `{env}-lynia-availability-critical`

**Impact**: SLO breach - service degraded for customers.

**Triage Steps**:
1. Check the real-time dashboard: `{env}-lynia-realtime`
2. Identify which service is generating 5XX errors:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 60 --statistics Sum
   ```
3. Check API Gateway for elevated error rates

**Resolution**:
- Identify failing service and check its specific alarm
- If widespread: Check VPC/NAT Gateway connectivity
- If single service: Check that service's logs and recent deployments

---

### 3. Payment Service Health (No Invocations)

**Alarm**: `{env}-lynia-payment-health-critical`

**Impact**: Payment service may be completely down.

**Triage Steps**:
1. Check Lambda function state:
   ```bash
   aws lambda get-function --function-name {env}-lynia-payment-service \
     --query 'Configuration.State'
   ```
2. Check if API Gateway is routing to the function
3. Check for Lambda throttling or concurrency limits

**Resolution**:
- If function state is not `Active`: Redeploy
- If throttled: Increase reserved concurrency
- If API Gateway issue: Check route configuration

---

### 4. API Gateway 5XX Errors > 10

**Alarm**: `{env}-lynia-api-5xx-critical`

**Impact**: Multiple services returning server errors.

**Triage Steps**:
1. Check which endpoints are failing (API Gateway access logs)
2. Check all Lambda error alarms to identify failing service
3. Check VPC NAT Gateway status

**Resolution**:
- If all services affected: Likely VPC/networking issue
- If single service: Focus on that service's logs
- Emergency: Use break-glass IAM role for direct Lambda access

---

### 5. Lambda Throttling

**Alarm**: `{env}-lynia-lambda-throttles`

**Impact**: Requests being rejected due to concurrency limits.

**Triage Steps**:
1. Check concurrent executions across all functions:
   ```bash
   aws lambda get-account-settings --query 'AccountLimit'
   ```
2. Identify which function is being throttled

**Resolution**:
- Increase reserved concurrency for the affected function
- Check if there's a traffic spike (possible attack)
- If legitimate traffic: Request AWS quota increase

---

### 6. DLQ Messages Detected

**Alarm**: `{env}-lynia-dlq-messages-warning`

**Impact**: Failed message processing - payments or notifications may be stuck.

**Triage Steps**:
1. Check DLQ message count:
   ```bash
   aws sqs get-queue-attributes \
     --queue-url {dlq-url} \
     --attribute-names All
   ```
2. Sample a message to understand the failure:
   ```bash
   aws sqs receive-message --queue-url {dlq-url} --max-number-of-messages 1
   ```

**Resolution**:
- Fix the underlying processing error
- Redrive messages from DLQ back to source queue
- If messages are stale: Purge DLQ after investigation

---

## Warning Alerts

### 7. Latency p95 > 500ms

**Alarm**: `{env}-lynia-{service}-latency-p95-warning`

**Triage Steps**:
1. Check X-Ray traces for slow operations
2. Check database query latency
3. Check external API response times (Smile Identity, payment providers)

**Resolution**:
- If database: Check connection pool, add indices
- If external API: Check provider status, increase timeouts
- If cold starts: Check provisioned concurrency settings

---

### 8. Cold Start Rate Elevated

**Alarm**: `{env}-lynia-{service}-coldstart-warning`

**Triage Steps**:
1. Check provisioned concurrency allocation
2. Check if there was a recent deployment (deployments cause cold starts)
3. Check auto-scaling configuration

**Resolution**:
- Increase provisioned concurrency
- Check if function bundle size increased (should be < 5MB)
- Verify ARM64 architecture is configured

---

### 9. Database Connection Count High

**Alarm**: `{env}-lynia-db-connections-warning`

**Triage Steps**:
1. Check Supabase dashboard for connection count
2. Check if connection pooling (PgBouncer) is healthy
3. Look for connection leaks in service logs

**Resolution**:
- Ensure all services use connection pooling
- Check for Lambda functions not releasing connections
- Consider increasing pool size if legitimate traffic

---

### 10. AWS Cost Alert

**Alarm**: `{env}-lynia-cost-{threshold}-warning`

**Triage Steps**:
1. Check the cost dashboard: `{env}-lynia-cost`
2. Identify which service is driving costs
3. Check for unusual Lambda invocation spikes

**Resolution**:
- If invocation spike: Check for infinite loops or retry storms
- If legitimate growth: Plan for scaling
- If attack: Enable WAF rate limiting, block offending IPs

---

## Emergency Procedures

### Break-Glass Access

Use the incident response IAM role for emergency access:
```bash
aws sts assume-role \
  --role-arn arn:aws:iam::{account}:role/{env}-lynia-incident-response-role \
  --role-session-name emergency-$(date +%s)
```

Requires MFA. Provides:
- Lambda invoke/update permissions
- Secrets Manager access
- CloudWatch diagnostics
- SQS operations (purge, DLQ redrive)

### Full Service Rollback

```bash
# Backend rollback
./scripts/rollback.sh production

# Frontend rollback
./scripts/rollback-frontend.sh production admin-portal
./scripts/rollback-frontend.sh production distributor-dashboard
```

### Disable Feature (Kill Switch)

If a specific feature is causing issues, use feature flags:
```bash
# Example: Disable loan applications
aws ssm put-parameter \
  --name "/{env}/lynia/feature-flags/loan-applications-enabled" \
  --value "false" \
  --overwrite
```

---

## Dashboards Quick Reference

| Dashboard | Purpose | URL Pattern |
|-----------|---------|-------------|
| Real-time | Live traffic and errors | `{env}-lynia-realtime` |
| Business | Loan/payment/KYC metrics | `{env}-lynia-business` |
| Technical | Cold starts, queues, DB health | `{env}-lynia-technical` |
| Security | Auth failures, WAF, fraud | `{env}-lynia-security` |
| Cost | AWS spend tracking | `{env}-lynia-cost` (prod only) |

Access all dashboards at: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:`

---

## Contact Information

| Role | Contact | When |
|------|---------|------|
| Primary On-Call | See rotation schedule | First responder |
| Engineering Lead | Escalate after 30 min | If unresolved |
| Infrastructure | Escalate for AWS issues | VPC, IAM, networking |
| Product | Notify for customer impact | Business-hours communication |
