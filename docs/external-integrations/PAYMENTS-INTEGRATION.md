# Payments Integration Plan

> Direct integration with 4 Zimbabwe mobile money providers

## Payment Providers

| Provider | Market Share | Priority | USSD Code | Status |
|----------|:-----------:|:--------:|:---------:|--------|
| **EcoCash** | ~70% | Critical | *151# | Code written, API access pending |
| **O'mari** | ~10% | High | *707# | New direct integration required |
| **InnBucks** | ~8% | Medium | App-based | Code written, API access pending |
| **OneWallet** | ~5% | Medium | *111# | Code written (as OneMoney), API access pending |

### Removed: Paynow

Paynow aggregator has been removed as a payment option. All providers will be
integrated directly for:
- Lower transaction fees (2% direct vs 3.5% via Paynow)
- Full control over payment UX and error handling
- Direct webhook delivery without intermediary
- No single point of failure dependency on aggregator
- Better customer experience with direct USSD push

---

## Integration Phases

### Phase 1: USSD Manual Flow (Current - Go-Live)

No API integration needed. Customers pay via USSD and admin verifies.

**Flow per provider:**

**EcoCash (Econet):**
1. Customer dials `*151#`
2. Select "Make Payment" → "Merchant"
3. Enter Lynia merchant code
4. Enter amount and PIN
5. Customer receives SMS confirmation with reference (e.g., MP240215123456)
6. Customer reports reference to admin/distributor
7. Admin verifies in EcoCash merchant portal
8. Admin marks payment verified in Lynia dashboard

**O'mari (Old Mutual):**
1. Customer dials `*707#`
2. Select "Pay" → Enter merchant code
3. Enter amount and O'mari PIN
4. Customer receives confirmation
5. Customer reports reference to admin/distributor
6. Admin verifies in O'mari merchant portal
7. Admin marks payment verified in Lynia dashboard

**OneWallet (NetOne):**
1. Customer dials `*111#`
2. Select "Payments" → "Merchant Payment"
3. Enter Lynia merchant code
4. Enter amount and PIN
5. Customer receives SMS confirmation
6. Customer reports reference
7. Admin verifies and updates Lynia dashboard

**InnBucks:**
1. Customer opens InnBucks app
2. Navigate to "Pay" → Enter merchant reference
3. Enter amount and confirm
4. Customer receives in-app confirmation
5. Customer reports reference
6. Admin verifies and updates Lynia dashboard

### Phase 2: API Integration (Per Provider)

Each provider follows the same integration pattern:

```
1. Obtain merchant/partner account
2. Receive sandbox/test API credentials
3. Implement provider adapter (code already exists for 3/4)
4. Run contract tests against sandbox
5. Validate webhook handling
6. Obtain production API credentials
7. Deploy with feature flag at 10%
8. Monitor and increase to 100%
```

**Provider-specific API details:**

#### EcoCash API

```yaml
sandbox_url: https://sandbox.ecocash.co.zw/api/v1
production_url: https://api.ecocash.co.zw/api/v1
auth: Bearer token (API key)
webhook_auth: HMAC-SHA256
timeout: 30 seconds
retry: 3 attempts with exponential backoff

endpoints:
  POST /payments/initiate    # Start USSD push payment
  GET  /payments/{id}/status # Check payment status
  POST /payments/callback    # Webhook receiver (our endpoint)

estimated_fees: 2% per transaction
```

**Existing code:** `services/payment-service/src/ecocash-provider.ts`

#### O'mari API (New Integration Required)

```yaml
# O'mari (Old Mutual digital wallet) - Direct API
# Previously routed through Paynow; now needs direct integration
sandbox_url: TBD (pending API access)
production_url: TBD
auth: TBD (likely Bearer token or API key)
webhook_auth: TBD
timeout: 30 seconds
retry: 3 attempts with exponential backoff

expected_endpoints:
  POST /payments/initiate    # Start *707# push payment
  GET  /payments/{id}/status # Check payment status
  POST /payments/callback    # Webhook receiver

estimated_fees: 1% per transaction (O'mari currently 0% promo on USD)
```

**Code needed:** New `omari-provider.ts` following same interface as EcoCash provider

#### OneWallet API

```yaml
sandbox_url: https://sandbox.onemoney.co.zw/api/v1
production_url: https://api.onemoney.co.zw/api/v1
auth: Bearer token (API key)
webhook_auth: HMAC-SHA256
timeout: 30 seconds
retry: 3 attempts with exponential backoff

endpoints:
  POST /payments/initiate    # Start USSD push payment
  GET  /payments/{id}/status # Check payment status
  POST /payments/callback    # Webhook receiver

estimated_fees: 2% per transaction
```

**Existing code:** `services/payment-service/src/onemoney-provider.ts` (rename to onewallet)

#### InnBucks API

```yaml
sandbox_url: https://sandbox.innbucks.co.zw/api/v1
production_url: https://api.innbucks.co.zw/api/v1
auth: Bearer token
webhook_auth: TBD
timeout: 30 seconds
retry: 3 attempts with exponential backoff

endpoints:
  POST /payments/initiate         # Initiate payment
  GET  /payments/{id}/status      # Check status
  POST /payments/callback         # Webhook receiver

estimated_fees: ~2% per transaction
```

**Existing code:** `services/payment-service/src/innbucks-provider.ts`

### Phase 3: Multi-Provider Optimization (Post-Launch)

After all providers are live:

1. **Intelligent routing** - Route to provider with highest success rate
2. **Automatic failover** - If EcoCash is down, offer O'mari/OneWallet/InnBucks
3. **Fee optimization** - Route to lowest-fee provider when customer has multiple wallets
4. **Analytics** - Track per-provider success rates, latency, fees
5. **Customer preference** - Remember and default to customer's preferred provider

---

## Unified Provider Interface

All payment providers must implement this interface:

```typescript
interface PaymentProvider {
  /** Unique provider identifier */
  readonly providerId: 'ecocash' | 'omari' | 'onewallet' | 'innbucks';

  /** Display name for UI */
  readonly displayName: string;

  /** Initialize payment - sends USSD push or returns payment URL */
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;

  /** Check current payment status */
  checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse>;

  /** Verify webhook/callback signature */
  verifyWebhookSignature(signature: string, payload: string): boolean;

  /** Generate human-readable payment instructions */
  generatePaymentInstructions(amount: number, reference: string): string;

  /** Validate phone number for this provider's network */
  validatePhoneNumber(phone: string): boolean;

  /** Health check - is provider's API reachable */
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}
```

---

## Contract Tests

Each provider must pass these contract tests before activation:

```
SCENARIO: Initiate payment successfully
  GIVEN valid customer phone and amount
  WHEN initiatePayment() is called
  THEN response.success = true
  AND response.transaction_id is not empty
  AND response.status = 'pending'

SCENARIO: Reject invalid phone number
  GIVEN phone number not on provider's network
  WHEN initiatePayment() is called
  THEN error is thrown with code PAY_AMT_001

SCENARIO: Reject amount exceeding RBZ limit
  GIVEN amount > $2,000 USD
  WHEN initiatePayment() is called
  THEN error is thrown with limit exceeded message

SCENARIO: Check pending payment status
  GIVEN a recently initiated payment
  WHEN checkPaymentStatus() is called
  THEN status is 'pending' or 'processing'

SCENARIO: Verify valid webhook signature
  GIVEN a webhook payload signed with provider's secret
  WHEN verifyWebhookSignature() is called
  THEN returns true

SCENARIO: Reject tampered webhook
  GIVEN a webhook payload with invalid signature
  WHEN verifyWebhookSignature() is called
  THEN returns false

SCENARIO: Handle provider timeout
  GIVEN provider API does not respond within 30s
  WHEN initiatePayment() is called
  THEN error is thrown with PAY_TIME_001
  AND payment status remains 'pending' (not lost)

SCENARIO: Idempotent payment initiation
  GIVEN a payment with reference REF-001 already exists
  WHEN initiatePayment() is called with same REF-001
  THEN returns existing payment (no duplicate created)
```

---

## Code Changes Required

### Remove Paynow

Files to modify/remove:
- **Remove:** `services/payment-service/src/paynow-provider.ts`
- **Modify:** `services/payment-service/src/payment-service.ts` - Remove Paynow references
- **Modify:** `services/payment-service/src/payment-analytics.ts` - Remove Paynow fee rates
- **Modify:** `services/payment-service/src/index.ts` - Remove Paynow webhook endpoint
- **Modify:** PaymentGateway type to use new provider IDs

### Add O'mari Provider

Create `services/payment-service/src/omari-provider.ts` implementing the
`PaymentProvider` interface. Structure mirrors `ecocash-provider.ts`.

### Rename OneMoney to OneWallet

Rename `onemoney-provider.ts` to `onewallet-provider.ts` and update all
references. The provider ID changes from `onemoney` to `onewallet`.

### Update PaymentGateway Type

```typescript
// Before
export type PaymentGateway = 'ecocash' | 'onemoney' | 'paynow';

// After
export type PaymentGateway = 'ecocash' | 'omari' | 'onewallet' | 'innbucks';
```

### Update Payment Service Constructor

```typescript
// Before
this.ecocashProvider = new EcoCashProvider();
this.onemoneyProvider = new OneMoneyProvider();
this.paynowProvider = new PaynowProvider();

// After
this.providers = new Map<PaymentGateway, PaymentProvider>([
  ['ecocash', new EcoCashProvider()],
  ['omari', new OmariProvider()],
  ['onewallet', new OneWalletProvider()],
  ['innbucks', new InnBucksProvider()],
]);
```

---

## Webhook Endpoints

```yaml
# Updated webhook routes in payment-service Lambda
POST /payments/webhook/ecocash     # EcoCash callbacks
POST /payments/webhook/omari       # O'mari callbacks
POST /payments/webhook/onewallet   # OneWallet callbacks
POST /payments/webhook/innbucks    # InnBucks callbacks
```

Each webhook handler:
1. Validates signature (HMAC)
2. Checks idempotency (payment_callbacks table)
3. Updates payment status in database
4. Triggers downstream actions (loan balance update, notifications)
5. Returns 200 OK to provider

---

## Fee Structure

| Provider | Current Fee | Direct Fee | Savings |
|----------|:----------:|:----------:|:-------:|
| EcoCash | N/A (manual) | ~2.0% | Baseline |
| O'mari | 3.5% (via Paynow) | ~1.0% | 2.5% per txn |
| OneWallet | N/A (manual) | ~2.0% | Baseline |
| InnBucks | N/A (manual) | ~2.0% | Baseline |

---

## Monitoring

```yaml
per_provider_metrics:
  - payment_initiation_count
  - payment_initiation_success_rate
  - payment_initiation_latency_ms
  - webhook_delivery_count
  - webhook_delivery_latency_ms
  - payment_completion_rate
  - payment_failure_rate
  - payment_timeout_rate
  - reconciliation_mismatch_count

alerts:
  critical:
    - any_provider_success_rate < 90%
    - payment_webhook_delivery_rate < 95%
  warning:
    - payment_initiation_latency p95 > 10000ms
    - reconciliation_mismatch_count > 0
```

---

## Reconciliation

Regardless of integration mode, a reconciliation job runs every 15 minutes:

1. Query all payments with status `pending` or `processing` older than 5 minutes
2. For each, call `checkPaymentStatus()` on the provider
3. Update database if status has changed
4. Flag any payments stuck in `pending` for more than 2 hours
5. Generate daily reconciliation report for admin review
