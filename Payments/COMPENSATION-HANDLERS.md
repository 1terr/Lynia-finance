# Payment Compensation Handlers

**Date:** 2026-02-17
**File:** `services/payment-service/src/compensation-handler.ts`

---

## Overview

Compensating transaction handlers automatically resolve payment failures without manual intervention. Inspired by PH-EE's BPMN error flows, adapted to SQS + Lambda.

## Compensation Actions

### 1. Hold Timeout (`hold_timeout`)

**Trigger:** Payment held for > 30 minutes without provider confirmation.

**Flow:**
1. Poll provider for current transaction status
2. If provider says completed -> transition to `processing`
3. If provider says failed/cancelled -> transition to `released`
4. If provider unreachable -> retry in 120 seconds
5. If no transaction ID exists -> release the hold

### 2. Missing Webhook (`webhook_missing`)

**Trigger:** Payment in `processing` status but no webhook received within expected timeframe.

**Flow:**
1. Poll provider for final status using gateway_transaction_id
2. If terminal status (completed/failed/cancelled) -> update payment directly
3. If still pending -> retry in 300 seconds
4. If provider unreachable -> retry in 120 seconds

### 3. Fineract Sync Failed (`fineract_sync_failed`)

**Trigger:** Payment completed but Fineract accounting sync failed.

**Flow:**
1. Delegate to existing `SQSQueues.retryFineractSync()` queue
2. Fineract sync retry handles exponential backoff independently
3. On queue failure -> retry compensation in 60 seconds

### 4. Provider Error (`provider_error`)

**Trigger:** Provider returned an error during payment initiation or processing.

**Flow:**
1. Check if error is retryable (timeout, connection refused, 502/503/429)
2. If retryable and < 3 attempts -> retry with exponential backoff (60s, 120s, 240s)
3. If permanent error -> release the hold with reason
4. If release fails -> escalate

## Retry & Escalation

| Parameter | Value |
|-----------|-------|
| Max compensation retries | 5 |
| SQS max delay | 900 seconds (SQS limit) |
| SQS visibility timeout | 300 seconds |
| DLQ max receive count | 3 |

### Escalation Path
When max retries are exhausted:
1. Log `escalated` event in `payment_events` table
2. Send admin notification via `SQSQueues.sendNotification()` with `payment_compensation_escalation` template
3. Message lands in DLQ for manual review

## SQS Queue Configuration

```yaml
Queue: ${env}-lynia-payment-compensation
DLQ: ${env}-lynia-payment-compensation-dlq
VisibilityTimeout: 300s
MessageRetention: 7 days
DLQ Retention: 14 days
MaxReceiveCount: 3
CloudWatch Alarm: On DLQ message count >= 1
```

## Message Format

```typescript
interface CompensationMessage {
  action: 'hold_timeout' | 'webhook_missing' | 'fineract_sync_failed' | 'provider_error';
  paymentId: string;
  gateway: 'ecocash' | 'onemoney' | 'omari' | 'innbucks';
  currentStatus: string;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
```
