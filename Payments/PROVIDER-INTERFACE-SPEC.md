# Payment Provider Interface Specification

**Date:** 2026-02-17
**File:** `services/payment-service/src/payment-provider.interface.ts`

---

## PaymentProvider Interface

All mobile money providers must implement this interface:

```typescript
interface PaymentProvider {
  readonly name: PaymentGateway;
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;
  checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse>;
  verifyWebhookSignature(signature: string, payload: string): boolean;
  generatePaymentInstructions(amount: number, reference: string): string;
  healthCheck(): Promise<ProviderHealthResult>;
  getCapabilities(): ProviderCapabilities;
}
```

## Supported Gateways

| Gateway | Provider | Market Share | Status |
|---------|----------|-------------|--------|
| `ecocash` | Econet Wireless | ~70% | Active |
| `onemoney` | NetOne | ~15% | Active |
| `omari` | Old Mutual | ~10% | Active |
| `innbucks` | InnBucks | ~5% | Active |

## Payment Flow (Two-Phase)

```
1. Customer initiates payment via WhatsApp
2. PaymentService creates payment record (status: pending)
3. StateMachine transitions to 'held' (reserves funds conceptually)
4. Provider.initiatePayment() called
5. StateMachine transitions to 'processing'
6. Provider sends webhook on completion
7. Webhook handler transitions to 'completed' or 'failed'
8. On timeout/failure: CompensationHandler releases hold
```

## State Machine Transitions

```
pending -> held         (payment created, hold placed)
held -> processing      (provider call succeeded)
held -> released        (timeout, provider failure, or cancellation)
processing -> completed (provider confirmed success)
processing -> failed    (provider confirmed failure)
processing -> cancelled (user or admin cancellation)
pending -> failed       (validation failure before hold)
pending -> cancelled    (user cancelled before hold)
```

## Provider Capabilities

Each provider declares its capabilities:

| Capability | EcoCash | OneMoney | O'mari | InnBucks |
|-----------|---------|----------|--------|----------|
| `payin` | Yes | Yes | Yes | Yes |
| `payout` | Yes | Yes | No | Yes |
| `refund` | No | No | No | No |
| `recurring` | No | No | No | No |
| `webhookSupport` | Yes | Yes | Yes | Yes |
| `statusPolling` | Yes | Yes | Yes | Yes |
| Max Amount | $2,000 | $2,000 | $5,000 | $1,000 |
| Min Amount | $0.50 | $1.00 | $1.00 | $0.50 |
| Currency | USD | USD | USD | USD |

## Webhook Endpoints

| Gateway | Endpoint | Signature |
|---------|----------|-----------|
| EcoCash | `POST /payments/webhook/ecocash` | HMAC-SHA256 |
| OneMoney | `POST /payments/webhook/onemoney` | HMAC-SHA256 |
| O'mari | `POST /payments/webhook/omari` | HMAC-SHA256 |
| InnBucks | `POST /payments/webhook/innbucks` | HMAC-SHA256 |
