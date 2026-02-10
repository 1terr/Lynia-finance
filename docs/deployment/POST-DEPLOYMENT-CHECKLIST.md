# Post-Deployment Verification Checklist

**Document:** Lynia Finance - Post-Deployment Verification Checklist
**Version:** 1.0
**Last Updated:** February 10, 2026
**Owner:** Engineering Team

---

## Instructions

Execute this checklist after every production deployment. All checks must pass before declaring the deployment successful. If any critical check fails, initiate rollback per [ROLLBACK-PROCEDURES.md](ROLLBACK-PROCEDURES.md).

---

## Phase 1: Immediate Checks (0-5 minutes post-deploy)

### Infrastructure Health

```
[ ] CloudFormation stack status is UPDATE_COMPLETE or CREATE_COMPLETE
    Command: aws cloudformation describe-stacks --stack-name lynia-finance-prod --query 'Stacks[0].StackStatus'

[ ] All 6 Lambda functions updated with new version
    Command: aws lambda list-functions --query "Functions[?starts_with(FunctionName,'production-lynia')].{Name:FunctionName,Modified:LastModified}" --output table

[ ] API Gateway is routing correctly
    Command: curl -s -o /dev/null -w "%{http_code}" https://api.lyniafinance.co.zw/health

[ ] No Lambda throttling
    Command: aws cloudwatch describe-alarms --alarm-names production-lynia-lambda-throttles --query 'MetricAlarms[0].StateValue'
```

### Service Health Endpoints

```
[ ] Scoring service:      curl -s -w "%{http_code}" https://api.lyniafinance.co.zw/scoring/health
[ ] Payment service:      curl -s -w "%{http_code}" https://api.lyniafinance.co.zw/payments/health
[ ] General health:       curl -s -w "%{http_code}" https://api.lyniafinance.co.zw/health
```

### Frontend Accessibility

```
[ ] Admin portal loads:           curl -s -w "%{http_code}" https://admin.lyniafinance.co.zw
[ ] Distributor dashboard loads:  curl -s -w "%{http_code}" https://distributor.lyniafinance.co.zw
[ ] SSL certificates valid:       echo | openssl s_client -connect admin.lyniafinance.co.zw:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Phase 2: Functional Verification (5-15 minutes post-deploy)

### Core API Functionality

```
[ ] Credit scoring API accepts requests (POST /scoring/calculate returns 200 or 401)
[ ] Payment API accepts requests (POST /payments/process returns 200 or 401)
[ ] KYC API accepts requests (POST /kyc/initiate returns 200 or 401)
[ ] Lock API accepts requests (POST /locks/lock returns 200 or 401)
[ ] Notification API accepts requests (POST /notifications/send returns 200 or 401)
[ ] WhatsApp webhook verification works (GET /whatsapp/webhook with verify token)
```

### Database Connectivity

```
[ ] Lambda functions can connect to Supabase (check logs for connection errors)
    Command: aws logs filter-log-events --log-group-name /aws/lambda/production-lynia-payment-service --start-time $(date -d '-5 min' +%s000) --filter-pattern "connection" --limit 5

[ ] Database migrations applied successfully (if applicable)
[ ] No database connection pool exhaustion warnings
```

### External Service Connectivity

```
[ ] WhatsApp Cloud API reachable (webhook subscription active)
[ ] Smile Identity sandbox/production API responsive
[ ] EcoCash API responsive (check circuit breaker status in logs)
[ ] OneMoney API responsive
[ ] Trustonic API responsive
```

---

## Phase 3: Monitoring Verification (5-30 minutes post-deploy)

### CloudWatch Dashboards

```
[ ] Real-time dashboard showing data (production-lynia-realtime)
    URL: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=production-lynia-realtime

[ ] No active ALARM state on critical alarms
    Command: aws cloudwatch describe-alarms --state-value ALARM --alarm-name-prefix production-lynia --query 'MetricAlarms[*].AlarmName'

[ ] Error rate < 1% across all services
[ ] Latency p95 < 300ms (SLO target)
[ ] No Lambda throttles detected
```

### Log Verification

```
[ ] Structured logs appearing in CloudWatch (JSON format with timestamp, level, service, requestId)
    Command: aws logs filter-log-events --log-group-name /aws/lambda/production-lynia-scoring-service --start-time $(date -d '-5 min' +%s000) --limit 3

[ ] No ERROR level logs in the first 5 minutes (beyond expected baseline)
[ ] Log level is INFO (no DEBUG logs in production)
[ ] PII masking working (phone numbers show as +263****XXX)
```

### Queue Health

```
[ ] SQS queues processing normally (messages not accumulating)
    Command: aws sqs get-queue-attributes --queue-url <notification-queue-url> --attribute-names ApproximateNumberOfMessagesVisible

[ ] Dead letter queues are empty (no failed messages)
    Command: aws sqs get-queue-attributes --queue-url <payment-dlq-url> --attribute-names ApproximateNumberOfMessagesVisible
```

---

## Phase 4: Business Logic Verification (15-30 minutes post-deploy)

### Financial Operations

```
[ ] Loan application flow works end-to-end (or verify in staging if no test data)
[ ] Payment processing flow works (test with small amount if possible)
[ ] Device lock/unlock commands are delivered
[ ] Notifications are being sent (SMS, WhatsApp)
```

### Security Verification

```
[ ] WAF rules are active
    Command: aws wafv2 get-web-acl --name production-lynia-waf --scope REGIONAL --id <acl-id> --query 'WebACL.Rules[*].Name'

[ ] Rate limiting is functional (check rate-limiter logs)
[ ] JWT authentication is enforced on protected endpoints
[ ] CORS headers are correct (check response headers)
```

### Canary Deployment Status (payment-service)

```
[ ] Canary deployment progressing normally (if applicable)
    Command: Check CodeDeploy deployment status in AWS Console

[ ] No automatic rollback triggered
[ ] Error rate within acceptable bounds during canary window
```

---

## Phase 5: Extended Monitoring (30 min - 2 hours)

```
[ ] Error rate remains stable (no upward trend)
[ ] Latency remains within SLO bounds
[ ] No customer complaints received
[ ] Business metrics dashboard shows normal activity
[ ] Cost monitoring shows no unexpected spikes
[ ] Canary deployment completed successfully (payment-service)
```

---

## Deployment Sign-Off

```
Deployment Date:     _______________
Deployer:           _______________
Git Commit:         _______________
Deployment Method:  [ ] CI/CD  [ ] Manual Script  [ ] SAM CLI

Phase 1 (Infrastructure):  [ ] PASS  [ ] FAIL
Phase 2 (Functional):      [ ] PASS  [ ] FAIL
Phase 3 (Monitoring):      [ ] PASS  [ ] FAIL
Phase 4 (Business Logic):  [ ] PASS  [ ] FAIL
Phase 5 (Extended):        [ ] PASS  [ ] FAIL

Overall Status:     [ ] DEPLOYMENT SUCCESSFUL  [ ] ROLLBACK INITIATED

Signed: _______________  Date: _______________
```

---

## Failure Response

If any phase fails:

| Phase Failed | Action |
|-------------|--------|
| Phase 1 | Immediate rollback - infrastructure broken |
| Phase 2 | Investigate specific service, likely rollback |
| Phase 3 | Monitor closely, prepare for rollback |
| Phase 4 | Investigate business logic, may need hotfix |
| Phase 5 | Continue monitoring, open investigation ticket |

See [ROLLBACK-PROCEDURES.md](ROLLBACK-PROCEDURES.md) for rollback steps.
See [INCIDENT-RESPONSE-PLAYBOOK.md](INCIDENT-RESPONSE-PLAYBOOK.md) for incident handling.

---

**Document Owner:** Engineering Team
**Used:** After every production deployment
