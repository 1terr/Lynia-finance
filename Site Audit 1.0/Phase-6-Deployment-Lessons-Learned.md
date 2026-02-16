# Phase 6: Deployment Failures & Lessons Learned

**Date:** February 16, 2026
**Deployment:** Apache Fineract to AWS ECS Fargate
**Total Attempts:** 7 (5 failed, 2 succeeded)
**Total Time:** ~8 hours

---

## Summary

Deploying Fineract to ECS Fargate required 7 iterations over ~8 hours. Each failure revealed a different issue in the CloudFormation templates, AWS networking, or ECS configuration. This document captures every failure, its root cause, and the lesson learned.

---

## Timeline of Deployment Attempts

| # | Time | Result | Root Cause |
|---|------|--------|-----------|
| 1 | ~01:30 | FAILED | Invalid characters (`→`) in security group descriptions |
| 2 | ~02:00 | FAILED | ECS circuit breaker - no log streams created |
| 3 | ~03:00 | FAILED | ECS secret references interpreted as SSM parameters |
| 4 | ~04:00 | FAILED | VPC endpoint security group blocking Secrets Manager access |
| 5 | ~05:30 | FAILED | Container health check using `curl` which doesn't exist in image |
| 6 | ~07:00 | SUCCESS | Infrastructure-only deploy (DesiredCount: 0) |
| 7 | ~08:00 | SUCCESS | Full deploy with 1 running task |

---

## Failure #1: Invalid Characters in Security Group Descriptions

### What Happened

CloudFormation deployment failed immediately during resource creation.

### Error

```
Value '...' for parameter GroupDescription is invalid.
Valid descriptions are strings less than 256 characters from the following set:
a-zA-Z0-9. _-:/()#,@[]+=&;{}!$*
```

### Root Cause

The `fineract-ecs.yaml` template used Unicode arrow characters (`→`) in security group rule descriptions:

```yaml
Description: "Lambda functions → Fineract API"
Description: "ALB health checks → Fineract"
Description: "Fineract → RDS PostgreSQL"
```

AWS EC2 security group descriptions only allow ASCII characters.

### Fix

Replaced all `→` with `to`:

```yaml
Description: "Lambda functions to Fineract API"
Description: "ALB health checks to Fineract"
Description: "Fineract to RDS PostgreSQL"
```

### Lesson Learned

> **Never use non-ASCII characters in AWS resource descriptions or names.** AWS services have strict character validation on most string fields. Stick to basic ASCII alphanumeric characters and common punctuation.

---

## Failure #2: ECS Circuit Breaker - No Log Streams

### What Happened

CloudFormation stack creation succeeded but the ECS service triggered its deployment circuit breaker. No log streams were created in CloudWatch, so there was no visibility into what went wrong.

### Error

```
ECS Deployment Circuit Breaker was triggered.
```

No logs found in `/ecs/production-lynia-fineract`.

### Root Cause

The secret references in the ECS task definition used name-only format (no ARN), which ECS interpreted as AWS Systems Manager (SSM) Parameter Store references instead of Secrets Manager references:

```yaml
# What we had (WRONG)
Secrets:
  - Name: FINERACT_HIKARI_JDBC_URL
    ValueFrom: "production/lynia/fineract:jdbc_url::"
```

ECS treats `ValueFrom` as SSM if it doesn't start with `arn:aws:secretsmanager:`.

### Fix

This was actually resolved in Attempt #3 (see below). The lack of logs made this attempt a dead end.

### Lesson Learned

> **Always ensure ECS log configuration is correct and the log group exists BEFORE deploying.** Without logs, ECS failures are black boxes. Pre-create the log group manually if needed, and add `DeletionPolicy: Retain` to prevent accidental deletion.

---

## Failure #3: ECS Secrets Interpreted as SSM Parameters

### What Happened

After fixing the arrow characters, the task still failed to start. This time we got the specific error.

### Error

```
The Systems Manager parameter name specified for secret
FINERACT_HIKARI_JDBC_URL is invalid.
```

### Root Cause

ECS `ValueFrom` for secrets requires the **full Secrets Manager ARN** (including the random 6-character suffix) when extracting JSON keys. The format is:

```
arn:aws:secretsmanager:<region>:<account>:secret:<name>-<random>:<json-key>::
```

The template was using a constructed ARN without the random suffix:

```yaml
# WRONG - missing random suffix
ValueFrom: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:${Environment}/lynia/fineract:jdbc_url::"
```

Without the random suffix, ECS falls back to interpreting it as an SSM parameter name.

### Fix

Added a `FineractSecretArn` parameter that accepts the full ARN (with random suffix) at deploy time:

```yaml
Parameters:
  FineractSecretArn:
    Type: String
    Description: Full ARN of the Fineract Secrets Manager secret (including random suffix)

# Usage:
Secrets:
  - Name: FINERACT_HIKARI_JDBC_URL
    ValueFrom: !Sub "${FineractSecretArn}:jdbc_url::"
```

Deploy command passes the full ARN:

```bash
aws cloudformation deploy ... \
  --parameter-overrides \
    FineractSecretArn=arn:aws:secretsmanager:us-east-1:849695476598:secret:production/lynia/fineract-peFuQp
```

### Lesson Learned

> **ECS Secrets Manager references require the FULL ARN including the random suffix.** You cannot construct the ARN dynamically in CloudFormation because the random suffix is only known after the secret is created. Either pass the full ARN as a parameter, or use `!Ref` / `!GetAtt` if the secret is created in the same template.

---

## Failure #4: VPC Endpoint Security Group Blocking Access

### What Happened

The ECS task started but crashed immediately with a Secrets Manager connection error.

### Error (from ECS logs)

```
unable to retrieve secret from asm:
There is a connection issue between the task and AWS Secrets Manager.
context deadline exceeded
```

### Root Cause

The VPC has interface endpoints for Secrets Manager (`com.amazonaws.us-east-1.secretsmanager`). These endpoints have their own security group (`sg-0ba14576c454cb9e7`, named `production-lynia-vpce-sg`).

This security group only allowed inbound TCP 443 from the **Lambda security group** (`sg-0218a50d7ffd89fb3`), NOT from the **Fineract security group** (`sg-0766a497ef196df0e`).

When Fineract tried to call Secrets Manager to retrieve its secrets, the traffic went through the VPC endpoint but was blocked by the endpoint's security group.

### Fix

Added the Fineract SG to the VPC endpoint SG's inbound rules:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0ba14576c454cb9e7 \
  --protocol tcp --port 443 \
  --source-group sg-0766a497ef196df0e
```

### Lesson Learned

> **VPC endpoints have their own security groups that must explicitly allow traffic from all services that use them.** When adding a new service (ECS, EC2, etc.) to a VPC that uses interface endpoints, always check that the endpoint security group allows inbound from the new service's security group. This applies to ALL VPC endpoints: Secrets Manager, CloudWatch Logs, ECR, S3, etc.

> **This is a common gotcha:** Services in private subnets with VPC endpoints often fail with vague "connection timeout" errors. The first troubleshooting step should always be: "Does the VPC endpoint security group allow my service's security group?"

---

## Failure #5: Container Health Check Using Missing Binary

### What Happened

The ECS task started, Fineract initialized successfully (visible in logs), the ALB health check was passing, but ECS reported the container as UNHEALTHY and kept replacing tasks.

### Error

Container status: RUNNING, but HealthStatus: UNHEALTHY.

### Root Cause

The task definition included a Docker container-level health check:

```yaml
HealthCheck:
  Command:
    - CMD-SHELL
    - "curl -kfs https://localhost:8443/fineract-provider/actuator/health || exit 1"
  Interval: 30
  Timeout: 10
  Retries: 5
  StartPeriod: 180
```

The `apache/fineract` Docker image does **not include `curl`**. The health check command failed every time with "command not found", causing ECS to mark the container as unhealthy.

Meanwhile, the ALB target group health check (which uses HTTP requests from the load balancer, not a binary inside the container) was passing fine.

### Fix

Removed the container-level health check entirely and rely solely on the ALB target group health check:

```yaml
# Health check via ALB target group only (curl not available in Fineract image)
```

### Lesson Learned

> **Never assume standard utilities exist in Docker images.** Production-optimized images like `apache/fineract` strip unnecessary binaries (curl, wget, bash) to reduce image size and attack surface. Always check what's available in the image before writing health checks.

> **Two types of ECS health checks exist:**
> 1. **Container health check** (Docker HEALTHCHECK) - runs a command INSIDE the container
> 2. **ALB target group health check** - the load balancer sends HTTP requests FROM OUTSIDE
>
> If the ALB health check is sufficient (and it usually is), skip the container health check to avoid this class of failures.

---

## Additional Issues Encountered

### Issue: CloudFormation Log Group Already Exists

**Error:** `AWS::EarlyValidation::ResourceExistenceCheck` failed because the CloudWatch log group was manually created during debugging.

**Fix:** Deleted the manually-created log group, then added `DeletionPolicy: Retain` to the template to prevent future conflicts.

**Lesson:** Add `DeletionPolicy: Retain` to log groups in CloudFormation templates. This prevents data loss on stack deletion and avoids conflicts with manually-created resources.

### Issue: IAM Policy Limit (10 Managed Policies per User)

**Error:** `Cannot exceed quota for PoliciesPerUser: 10` when trying to attach ECS/ELB/SNS managed policies.

**Fix:** Created an inline policy (`ECSFullAccess`) with all required permissions instead of attaching individual managed policies.

**Lesson:** AWS IAM has a hard limit of 10 managed policies per user. For CI/CD users that need many permissions, use inline policies or create a custom managed policy that combines all needed permissions.

### Issue: MSYS/Git Bash Path Conversion on Windows

**Error:** AWS CLI paths like `/ecs/production-lynia-fineract` were converted to `C:/Program Files/Git/ecs/production-lynia-fineract` by MSYS (Git Bash on Windows).

**Fix:** Used `MSYS_NO_PATHCONV=1` prefix or ran commands through Node.js `child_process.exec()` to bypass MSYS path conversion.

**Lesson:** When running AWS CLI commands on Windows with Git Bash, any argument starting with `/` may be converted to a Windows path. Use `MSYS_NO_PATHCONV=1` to disable this behavior.

### Issue: CloudFormation Stack Stuck in UPDATE_IN_PROGRESS

**Error:** A failed ECS deployment left the stack in `UPDATE_IN_PROGRESS` state, blocking further updates.

**Fix:** Cancelled the update with `aws cloudformation cancel-update-stack`, waited for rollback, then re-deployed.

**Lesson:** When ECS deployments fail with circuit breaker, CloudFormation may wait indefinitely for the service to stabilize. Cancel the update early rather than waiting for the timeout.

---

## What Worked Well

### 1. Lambda-Backed Custom Resource for Database Init

Since there was no `psql` client available and the RDS instance is in private subnets (no direct access from the deployment machine), we created a Lambda function that runs inside the VPC to initialize the Fineract databases.

**Why it worked:** Lambda functions in the VPC have direct network access to RDS. The Custom Resource pattern means the database initialization runs automatically during CloudFormation stack creation.

### 2. Infrastructure-Only Deploy (DesiredCount: 0)

After multiple failures, we deployed with `DesiredCount: 0` to create all infrastructure (ALB, security groups, IAM roles, etc.) without starting any ECS tasks. Once the infrastructure was verified, we updated to `DesiredCount: 1`.

**Why it worked:** This separated infrastructure creation from application startup, making it easier to debug each layer independently.

### 3. Full Secret ARN as Parameter

Passing the complete Secrets Manager ARN (including random suffix) as a CloudFormation parameter was cleaner than trying to construct it dynamically.

**Why it worked:** The random suffix is only known after secret creation, so it can't be computed in CloudFormation. A parameter makes the dependency explicit.

### 4. VPC Endpoint Investigation

Systematically checking VPC endpoint security groups when Secrets Manager connectivity failed, rather than assuming network connectivity was fine.

**Why it worked:** VPC endpoints are often invisible - services try to reach AWS APIs, traffic gets routed to the endpoint, and the endpoint's security group silently drops it. Understanding this architecture was key.

---

## Checklist for Future ECS Deployments

Use this checklist before deploying any new ECS service:

```markdown
### Pre-Deployment
- [ ] All CloudFormation resource names/descriptions use ASCII only (no Unicode)
- [ ] Log group created or template has DeletionPolicy: Retain
- [ ] IAM role has permissions for ECR, Secrets Manager, CloudWatch Logs
- [ ] VPC endpoint security groups allow new service's SG on port 443
- [ ] Secret ARNs include random suffix (6 chars after the name)
- [ ] Container health check uses binaries available in the image
  - Or: rely on ALB health check only
- [ ] ALB health check path matches application's actual health endpoint
- [ ] Security groups allow traffic: Lambda/ALB → ECS, ECS → RDS, ECS → VPC endpoints

### Deployment Strategy
- [ ] Deploy with DesiredCount: 0 first (infrastructure only)
- [ ] Verify all resources created successfully
- [ ] Check log group is accessible
- [ ] Update DesiredCount to 1 and monitor logs
- [ ] Verify ALB target health is "healthy"
- [ ] Check all CloudWatch alarms are in OK state

### Post-Deployment
- [ ] Verify application logs show successful startup
- [ ] Test health endpoint through ALB
- [ ] Verify monitoring dashboard shows metrics
- [ ] Test alert notifications (optional)
- [ ] Document all manual steps (VPC endpoint SG changes, etc.)
```

---

## Key Takeaways

1. **ECS + Secrets Manager + VPC Endpoints = 3-way security group dance.** All three must be aligned, and the VPC endpoint SG is the most commonly forgotten.

2. **Always deploy infrastructure before containers.** Use `DesiredCount: 0` to validate the CloudFormation template without the complexity of a running application.

3. **Container health checks are a separate concern from ALB health checks.** Don't add container health checks unless you're sure the binary exists in the image.

4. **ECS secret references are format-sensitive.** Full ARN = Secrets Manager. Anything else = SSM Parameter Store. The random suffix is not optional.

5. **CloudFormation debugging is slow.** Each deployment attempt takes 5-15 minutes. Invest time in validation and pre-checks to minimize iterations.

6. **Log visibility is critical.** The first failed attempts with no logs were the hardest to debug. Always ensure logging works before deploying the actual application.
