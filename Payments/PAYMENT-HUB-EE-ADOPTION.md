# Payment Hub EE Pattern Adoption - Implementation Report

**Date:** 2026-02-17
**Status:** Complete
**Branch:** master

---

## Background

Fineract markets a "Payment Hub EE" (ph-ee-engine) for mobile money orchestration. After analysis, we determined that adopting PH-EE wholesale would require Kubernetes, Zeebe, Kafka, Elasticsearch, Java connectors, and ~$800-1500/month infrastructure overhead -- disproportionate to Lynia's current scale.

**Decision:** Adopt PH-EE's best architectural ideas into our existing TypeScript/Lambda stack.

---

## Improvements Implemented

### 1. Formalized Payment Provider Interface

**Files:**
- `services/payment-service/src/payment-provider.interface.ts` (NEW)
- `services/payment-service/src/ecocash-provider.ts` (MODIFIED)
- `services/payment-service/src/onemoney-provider.ts` (MODIFIED)
- `services/payment-service/src/omari-provider.ts` (MODIFIED)
- `services/payment-service/src/innbucks-provider.ts` (REWRITTEN)
- `services/payment-service/src/payment-service.ts` (MODIFIED)
- `services/payment-service/src/index.ts` (MODIFIED)
- `services/shared/types/index.ts` (MODIFIED)

**What Changed:**
- Created canonical `PaymentProvider` interface with `initiatePayment()`, `checkPaymentStatus()`, `verifyWebhookSignature()`, `generatePaymentInstructions()`, `healthCheck()`, `getCapabilities()`
- All 4 providers (EcoCash, OneMoney, O'mari, InnBucks) now implement the same interface
- InnBucks was rewritten from standalone functions to a full class with circuit breaker
- PaymentService now uses a `Map<PaymentGateway, PaymentProvider>` registry instead of if/else chains
- Added `/payments/webhook/innbucks` webhook route
- Updated `Payment.payment_method` union type: `'ecocash' | 'onemoney' | 'omari' | 'innbucks' | 'cash' | 'bank_transfer'`

### 2. Payment Event Audit Log

**Files:**
- `database/migrations/026_payment_events_audit.sql` (NEW)
- `services/payment-service/src/payment-event-logger.ts` (NEW)

**What Changed:**
- Created `payment_events` table with structured audit trail tracking every payment state transition
- Replaces ad-hoc `console.log` with queryable event stream
- Non-blocking writes (errors caught, never propagated)
- Query helpers: `getPaymentHistory()`, `getStuckPayments()`, `getTransitionStats()`
- Indexed on: payment_id, event_type, status transitions, gateway

### 3. Two-Phase Payment Holds

**Files:**
- `database/migrations/027_payment_two_phase_holds.sql` (NEW)
- `services/payment-service/src/payment-state-machine.ts` (NEW)
- `services/payment-service/src/payment-service.ts` (MODIFIED)
- `services/payment-service/src/index.ts` (MODIFIED)

**What Changed:**
- New payment flow: `pending -> held -> processing -> completed/failed` with `released` as rollback
- PostgreSQL `transition_payment_status()` function for atomic optimistic concurrency control
- `PaymentStateMachine` class enforcing valid transitions and logging events
- Added columns: `held_at`, `hold_expires_at`, `released_at`, `release_reason`
- Expired hold detection in reconciliation scheduler
- Webhook handlers use state machine for transitions

### 4. Compensating Transaction Handlers

**Files:**
- `services/payment-service/src/compensation-handler.ts` (NEW)
- `infrastructure/aws/sqs-queues.yaml` (MODIFIED)
- `services/shared/utils/sqs-publisher.ts` (MODIFIED)

**What Changed:**
- `CompensationHandler` class with 4 automated failure handlers:
  - **Hold timeout** -- polls provider, resolves or releases hold
  - **Missing webhook** -- polls provider for final status after timeout
  - **Fineract sync failure** -- delegates to existing retry queue
  - **Provider error** -- retries if retryable, releases if permanent
- Max 5 retries with exponential backoff, escalation to admin on failure
- New SQS queue: `${env}-lynia-payment-compensation` + DLQ + CloudWatch alarm
- `SQSQueues.queueCompensation()` helper in publisher

### 5. Fineract Interoperation Module

**Files:**
- `services/shared/types/fineract.ts` (MODIFIED)
- `services/shared/clients/fineract.ts` (MODIFIED)
- `services/shared/clients/fineract-sync.ts` (MODIFIED)

**What Changed:**
- Added Mojaloop-compatible interop types (party, transfer, health)
- 8 new FineractClient methods: `registerInteropParty`, `lookupInteropParty`, `deleteInteropParty`, `prepareInteropTransfer`, `commitInteropTransfer`, `releaseInteropTransfer`, `getInteropTransfer`, `interopHealthCheck`
- MSISDN registration on customer sync (when interop enabled)
- Feature-flagged two-phase interop disbursement: PREPARE -> COMMIT with auto-RELEASE on failure
- Controlled by `FINERACT_USE_INTEROP=true` environment variable (off by default)

---

## Deployment Notes

### Database Migrations
Run in order:
```bash
# Migration 026: Payment events audit table
psql -f database/migrations/026_payment_events_audit.sql

# Migration 027: Two-phase holds columns + transition function
psql -f database/migrations/027_payment_two_phase_holds.sql
```

Both migrations are backwards-compatible (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS).

### SQS Queue
The `${env}-lynia-payment-compensation` queue + DLQ must be deployed via the SQS CloudFormation stack before the Lambda functions reference it.

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `FINERACT_USE_INTEROP` | `false` | Enable Mojaloop-compatible interop endpoints |
| `FINERACT_FSP_ID` | `lynia-finance` | FSP identifier for interop transfers |

### Fineract Configuration (for Improvement 5)
When ready to enable interop:
1. Set `enable-payment-hub-integration=true` in Fineract's `c_configuration` table (maintenance window)
2. Verify `/interoperation/health` responds
3. Set `FINERACT_USE_INTEROP=true` in Lambda environment
4. Register existing customer MSISDNs via backfill script

---

## Verification Checklist

- [ ] All 4 provider health checks pass
- [ ] Payment initiation follows held -> processing flow
- [ ] Expired holds are released by reconciliation
- [ ] payment_events table records state transitions
- [ ] Compensation queue processes hold timeouts
- [ ] DLQ alarm fires on unresolvable failures
- [ ] Fineract interop health check returns when enabled
- [ ] Feature flag `FINERACT_USE_INTEROP=false` keeps interop disabled by default
