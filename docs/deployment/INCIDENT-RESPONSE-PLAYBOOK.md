# Incident Response Playbook

**Document:** Lynia Finance - Incident Response Playbook
**Version:** 1.0
**Last Updated:** February 10, 2026
**Owner:** Engineering Team
**Classification:** Internal - Operations

---

## Table of Contents

1. [Severity Classification](#1-severity-classification)
2. [Response Procedures](#2-response-procedures)
3. [Specific Incident Scenarios](#3-specific-incident-scenarios)
4. [Escalation Matrix](#4-escalation-matrix)
5. [Communication Templates](#5-communication-templates)
6. [Post-Incident Review](#6-post-incident-review)

---

## 1. Severity Classification

### Priority Levels

| Priority | Description | Response Time | Resolution Target | Examples |
|----------|------------|---------------|-------------------|----------|
| **P1 - Critical** | Complete service outage or data breach | < 15 minutes | < 1 hour | Payment processing down, data breach, all APIs returning 5XX |
| **P2 - High** | Major feature degraded, financial impact | < 30 minutes | < 4 hours | Payment failures > 5%, credit scoring unavailable, WhatsApp bot down |
| **P3 - Medium** | Minor feature degraded, workaround exists | < 2 hours | < 24 hours | Single service degraded, elevated error rates, slow dashboard |
| **P4 - Low** | Cosmetic issue, no customer impact | < 8 hours | < 1 week | Dashboard UI glitch, non-critical log error, minor performance |

### Severity Decision Tree

```
Is customer financial data at risk?
  YES -> P1 (data breach)
  NO  ->

Are payments failing?
  YES -> Is it > 5% of transactions?
    YES -> P1
    NO  -> P2
  NO  ->

Is a core service completely down?
  YES -> P2
  NO  ->

Is the issue affecting customers directly?
  YES -> P3
  NO  -> P4
```

---

## 2. Response Procedures

### P1 - Critical Incident Response

**Timeline:**

```
T+0min   Incident detected (alarm / report)
T+5min   On-call engineer acknowledges
T+10min  Initial assessment posted to #incidents
T+15min  Incident commander assigned
T+20min  Mitigation started (rollback / hotfix)
T+30min  Status update to stakeholders
T+60min  Target resolution
T+90min  Post-incident review scheduled
```

**Step-by-Step:**

1. **Acknowledge** the alert (PagerDuty / SNS / Slack)
2. **Assess** the impact:
   ```bash
   # Check all service health
   for svc in health scoring/health payments/health; do
     curl -s -o /dev/null -w "%{http_code} $svc\n" \
       "https://api.lyniafinance.co.zw/$svc"
   done

   # Check error rates
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --start-time $(date -d '-10 min' -u +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 60 --statistics Sum

   # Check active alarms
   aws cloudwatch describe-alarms --state-value ALARM \
     --alarm-name-prefix production-lynia
   ```
3. **Open incident channel**: Create Slack channel `#incident-YYYYMMDD-description`
4. **Assign incident commander** (on-call lead or escalated)
5. **Mitigate**:
   - If deployment-related: initiate rollback (see [ROLLBACK-PROCEDURES.md](ROLLBACK-PROCEDURES.md))
   - If external API: enable circuit breaker / fallback
   - If database: check connection pool, query locks
   - If DDoS/security: verify WAF rules, enable rate limiting
6. **Communicate**: Post updates every 15 minutes to `#incidents`
7. **Resolve** and verify with health checks
8. **Post-incident**: Schedule retrospective within 24 hours

### P2 - High Priority Response

**Timeline:**

```
T+0min   Incident detected
T+15min  On-call engineer begins investigation
T+30min  Initial assessment and mitigation plan
T+1hr    Status update to engineering lead
T+4hr    Target resolution
```

**Step-by-Step:**

1. **Acknowledge** the alert
2. **Investigate** using CloudWatch Logs Insights:
   ```
   fields @timestamp, level, message, service, requestId
   | filter level = "error"
   | sort @timestamp desc
   | limit 50
   ```
3. **Identify** root cause (recent deployment, external API, database, load)
4. **Mitigate** with least-disruptive approach:
   - Feature flag toggle to disable affected feature
   - Service-specific rollback
   - Configuration change
5. **Fix** and deploy through standard pipeline
6. **Verify** resolution

### P3/P4 - Standard Response

1. Create GitHub issue with severity label
2. Investigate during business hours
3. Fix in next deployment cycle
4. Monitor for recurrence

---

## 3. Specific Incident Scenarios

### 3.1 Payment Service Down

**Symptoms**: Payment errors > 5%, EcoCash/OneMoney timeouts, DLQ messages accumulating

**Diagnosis:**
```bash
# Check payment service logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/production-lynia-payment-service \
  --start-time $(date -d '-15 min' +%s000) \
  --filter-pattern '{ $.level = "error" }' \
  --limit 20

# Check payment DLQ depth
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/<account>/production-lynia-payment-dlq \
  --attribute-names ApproximateNumberOfMessagesVisible

# Check external API health (EcoCash)
curl -s -w "%{http_code}" https://api.ecocash.co.zw/health
```

**Mitigation:**
1. If deployment-related: Rollback payment-service Lambda
2. If EcoCash API down: Circuit breaker will activate automatically; notify users via WhatsApp
3. If database: Check Supabase connection pool (`production-lynia-db-pooling` stack)
4. Re-process DLQ messages after resolution

### 3.2 Database Connection Exhaustion

**Symptoms**: Connection count > 150, query timeouts, Lambda errors across multiple services

**Diagnosis:**
```bash
# Check connection metrics
aws cloudwatch get-metric-statistics \
  --namespace Lynia/production \
  --metric-name DatabaseConnectionCount \
  --start-time $(date -d '-30 min' -u +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics Maximum
```

**Mitigation:**
1. Check PgBouncer status in Supabase dashboard
2. Identify Lambda functions holding connections (check X-Ray traces)
3. Reduce Lambda concurrency temporarily:
   ```bash
   aws lambda put-function-concurrency \
     --function-name production-lynia-scoring-service \
     --reserved-concurrent-executions 10
   ```
4. Restart PgBouncer if needed (Supabase dashboard)

### 3.3 WhatsApp Bot Not Responding

**Symptoms**: No webhook events received, customers reporting bot unresponsive

**Diagnosis:**
```bash
# Check WhatsApp service invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=production-lynia-whatsapp-service \
  --start-time $(date -d '-30 min' -u +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics Sum

# Check webhook verification
curl -s "https://api.lyniafinance.co.zw/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test"
```

**Mitigation:**
1. Verify WhatsApp Cloud API webhook subscription is active (Meta Business Manager)
2. Check API Gateway is routing to WhatsApp Lambda correctly
3. Verify WhatsApp access token hasn't expired
4. Re-subscribe webhook if needed

### 3.4 Security Breach / Unauthorized Access

**Symptoms**: Unusual login patterns, data access anomalies, WAF blocks spike

**CRITICAL: Follow these steps exactly.**

1. **Contain immediately**:
   ```bash
   # Block suspicious IP via WAF (if identified)
   # Rotate compromised credentials immediately
   # Do NOT delete logs - preserve for forensics
   ```

2. **Assess scope**:
   - Which data was accessed?
   - Which accounts were compromised?
   - How long was the breach active?

3. **Notify**:
   - CTO immediately
   - Legal team within 1 hour
   - RBZ within 24 hours (if customer data affected)
   - Affected customers within 72 hours

4. **Remediate**:
   - Rotate all API keys and secrets
   - Force password reset for affected accounts
   - Patch the vulnerability
   - Enable additional monitoring

5. **Document**: Detailed incident report for regulatory filing

### 3.5 Lambda Throttling

**Symptoms**: 429 responses, Lambda throttle alarm, requests failing

**Diagnosis:**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --start-time $(date -d '-15 min' -u +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics Sum
```

**Mitigation:**
1. Check if provisioned concurrency is configured (`lambda-autoscaling.yaml`)
2. Request AWS to increase regional Lambda concurrency limit
3. Check for Lambda function loops (recursive invocations)
4. Enable SQS buffering for non-critical operations

### 3.6 High Latency / Performance Degradation

**Symptoms**: p95 latency > 500ms, dashboard loading slowly, API timeouts

**Diagnosis:**
```bash
# Check Lambda duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=production-lynia-scoring-service \
  --start-time $(date -d '-30 min' -u +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics p95

# Check database query latency
aws cloudwatch get-metric-statistics \
  --namespace Lynia/production \
  --metric-name DatabaseQueryLatency \
  --start-time $(date -d '-30 min' -u +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics p95
```

**Mitigation:**
1. Check for cold starts (are provisioned concurrency Lambda instances warming?)
2. Check database connection pool health
3. Check for slow queries (CloudWatch Logs with duration > 100ms)
4. Check external API latency (Smile Identity, EcoCash)
5. Scale up Lambda memory if CPU-bound

---

## 4. Escalation Matrix

### Escalation Path

```
Level 1: On-call engineer (immediate response)
  |
  v (if not resolved in 30 min for P1, 2 hrs for P2)
Level 2: Engineering lead
  |
  v (if customer/financial impact)
Level 3: CTO
  |
  v (if regulatory/legal impact)
Level 4: CEO + Legal
```

### Contact Information

See [EMERGENCY-CONTACTS.md](EMERGENCY-CONTACTS.md) for the full contact list.

### Escalation Triggers

| Condition | Escalate To |
|-----------|------------|
| P1 not mitigated in 30 minutes | Engineering Lead |
| P1 not resolved in 1 hour | CTO |
| Customer data breach confirmed | CTO + Legal immediately |
| Financial loss > $1,000 | CTO |
| Regulatory reporting required | CTO + Legal |
| Media/PR exposure | CEO |

---

## 5. Communication Templates

### Internal - Incident Started

```
:rotating_light: [P1/P2] INCIDENT: [Brief Description]

Impact: [What is affected, who is affected]
Status: Investigating
Assigned: [Engineer name]
Channel: #incident-YYYYMMDD-[description]

Updates every 15 minutes.
```

### Internal - Status Update

```
:hourglass: INCIDENT UPDATE [HH:MM]

Status: [Investigating / Mitigating / Resolving]
Current impact: [Description]
Actions taken: [What was done since last update]
Next steps: [What happens next]
ETA: [If known]
```

### Internal - Incident Resolved

```
:white_check_mark: INCIDENT RESOLVED

Duration: [X hours Y minutes]
Root cause: [Brief description]
Resolution: [What fixed it]
Customer impact: [Description]
Follow-up: Post-incident review scheduled for [date/time]
```

### External - Customer Communication (WhatsApp)

```
Hi {{name}},

We experienced a brief service interruption.
Your transactions are safe and the service is now restored.

If you have any pending transactions, they will be processed shortly.

Reply HELP if you need assistance.
```

---

## 6. Post-Incident Review

### Review Template

Schedule within 24 hours of P1/P2 resolution. Document the following:

```markdown
# Post-Incident Review: [Incident Title]

**Date:** [Date]
**Duration:** [Start time] - [End time]
**Severity:** [P1/P2/P3]
**Incident Commander:** [Name]

## Timeline
- HH:MM - [Event]
- HH:MM - [Event]

## Root Cause
[Technical root cause analysis]

## Impact
- Customers affected: [count]
- Financial impact: [amount]
- SLO impact: [availability %]

## What Went Well
- [Item]

## What Could Be Improved
- [Item]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action] | [Name] | [Date] | Pending |

## Lessons Learned
- [Item]
```

### Review Principles

1. **Blameless**: Focus on systems and processes, not individuals
2. **Thorough**: Trace the full chain of events
3. **Actionable**: Every finding must have a concrete action item
4. **Shared**: Results shared with the full engineering team

---

**Document Owner:** Engineering Team
**Review Schedule:** After every P1/P2 incident
**Next Review:** Before go-live (P4-T015)
