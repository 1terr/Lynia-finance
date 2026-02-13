# P5-DEPLOY-T006: Deploy SQS Queues Stack - Progress Report

**Task:** P5-DEPLOY-T006 - Deploy SQS Queues Stack
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.1 Foundation Infrastructure
**Priority:** High
**Estimated Hours:** 1
**Dependencies:** P5-DEPLOY-T001
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy 5 SQS queues with dead-letter queues for asynchronous message processing across all services: notifications, payment callbacks, KYC processing, device locks, and credit scoring. Each queue has long polling, appropriate visibility timeouts, and redrive policies.

## Deliverables

- [ ] 5 main SQS queues deployed
- [ ] 5 dead-letter queues (DLQ) deployed
- [ ] Redrive policies configured per service
- [ ] Stack outputs recorded (queue URLs and ARNs)

## Acceptance Criteria

- [ ] Stack status: `CREATE_COMPLETE`
- [ ] 10 total queues created (5 main + 5 DLQ)
- [ ] Payment callbacks: `maxReceiveCount: 5` (higher retry for payment importance)
- [ ] Other queues: `maxReceiveCount: 3`
- [ ] All queues have `ReceiveMessageWaitTimeSeconds: 20` (long polling)

---

## Queue Configuration

| Queue | Visibility Timeout | Retention | Max Retries | DLQ |
|-------|-------------------|-----------|-------------|-----|
| `{env}-lynia-notifications` | 60s | 4 days | 3 | Yes |
| `{env}-lynia-payment-callbacks` | 120s | 4 days | **5** | Yes |
| `{env}-lynia-kyc-processing` | 120s | 4 days | 3 | Yes |
| `{env}-lynia-device-locks` | 90s | 4 days | 3 | Yes |
| `{env}-lynia-credit-scoring` | 90s | 4 days | 3 | Yes |

---

## Steps

### Step 1: Deploy SQS Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/sqs-queues.yaml \
  --stack-name production-lynia-sqs \
  --parameter-overrides Environment=production \
  --region us-east-1
```

### Step 2: Record Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name production-lynia-sqs \
  --query "Stacks[0].Outputs" \
  --output table
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-sqs \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. Count all queues
aws sqs list-queues --queue-name-prefix production-lynia \
  --query "QueueUrls | length(@)"
# Expected: 10

# 3. Verify payment queue redrive policy (maxReceiveCount: 5)
PAYMENT_URL=$(aws sqs get-queue-url --queue-name production-lynia-payment-callbacks \
  --query QueueUrl --output text)
aws sqs get-queue-attributes \
  --queue-url $PAYMENT_URL \
  --attribute-names RedrivePolicy \
  --query "Attributes.RedrivePolicy"
# Expected: maxReceiveCount=5

# 4. Verify notification queue redrive policy (maxReceiveCount: 3)
NOTIF_URL=$(aws sqs get-queue-url --queue-name production-lynia-notifications \
  --query QueueUrl --output text)
aws sqs get-queue-attributes \
  --queue-url $NOTIF_URL \
  --attribute-names RedrivePolicy \
  --query "Attributes.RedrivePolicy"
# Expected: maxReceiveCount=3

# 5. Verify long polling on all queues
aws sqs get-queue-attributes \
  --queue-url $PAYMENT_URL \
  --attribute-names ReceiveMessageWaitTimeSeconds \
  --query "Attributes.ReceiveMessageWaitTimeSeconds"
# Expected: "20"

# 6. List all DLQ queues
aws sqs list-queues --queue-name-prefix production-lynia \
  --query "QueueUrls[?contains(@, 'dlq')]"
# Expected: 5 DLQ URLs
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/sqs-queues.yaml` | SQS queues CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |
| 2026-02-13 | Automation added via `infrastructure/aws/scripts/deploy-infrastructure.sh production t006`. Can also run as part of `layer1` (parallel with T005+T008) | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-13
