# P2-DEPLOY-T005: SQS Queues for Asynchronous Processing - Progress Report

**Task**: Implement SQS queues for asynchronous processing
**GitHub Issue**: #185
**Status**: COMPLETED
**Date**: 2026-02-09
**Phase**: Phase 2 - AWS Deployment

---

## Overview

Implemented 5 SQS queues with dead-letter queues (DLQ) for decoupled, asynchronous processing of notifications, payment callbacks, KYC verifications, device lock operations, and credit scoring. Includes a shared SQS publisher utility and per-function IAM permissions.

## Queues Configured

| Queue | Visibility Timeout | Max Retries | DLQ Retention | Use Case |
|-------|-------------------|-------------|---------------|----------|
| `{env}-lynia-notifications` | 60s | 3 | 14 days | SMS, WhatsApp, email sends |
| `{env}-lynia-payment-callbacks` | 120s | 5 | 14 days | EcoCash/OneMoney callbacks |
| `{env}-lynia-kyc-processing` | 120s | 3 | 14 days | Smile Identity callbacks |
| `{env}-lynia-device-locks` | 90s | 3 | 14 days | Trustonic lock/unlock ops |
| `{env}-lynia-credit-scoring` | 90s | 3 | 14 days | Background score calculations |

## Features

- Long polling enabled (20s) for cost efficiency
- Dead-letter queues for all 5 queues (failed messages retained 14 days)
- DLQ alarm on payment callback DLQ (critical financial operations)
- SQS publisher utility with batch support (max 10 per API call)
- Pre-built helpers: `SQSQueues.sendNotification()`, `SQSQueues.processPaymentCallback()`, etc.
- Per-function IAM policies (least privilege - each function accesses only its queues)

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `infrastructure/aws/sqs-queues.yaml` | Created | CloudFormation template for 5 queues + 5 DLQs |
| `services/shared/utils/sqs-publisher.ts` | Created | SQS publisher utility with batch support |
| `template.yaml` | Modified | Added SQS + CloudWatch IAM permissions per function |
