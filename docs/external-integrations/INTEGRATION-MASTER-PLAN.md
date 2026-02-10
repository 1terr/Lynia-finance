# External Integrations Master Plan

> Lynia Finance - Phased External API Integration Strategy

## Current State (February 2026)

| Integration | Code Written | API Access | Live Status |
|-------------|:----------:|:----------:|:-----------:|
| **Smile Identity** (KYC) | Yes | No | Not connected |
| **Trustonic** (Device Lock) | Yes | No | Not connected |
| **EcoCash** (Payments) | Yes | No | Not connected |
| **O'mari** (Payments) | No (was via Paynow) | No | Not connected |
| **OneWallet** (Payments) | Yes (as OneMoney) | No | Not connected |
| **InnBucks** (Payments) | Yes | No | Not connected |
| **WhatsApp Cloud API** | Yes | No | Not connected |
| **Paynow** (Aggregator) | Yes | N/A | **REMOVED** - not a preferred option |

### Decision: Remove Paynow

Paynow is removed as a payment option. All four payment providers will be
integrated directly:

1. **O'mari** - Old Mutual digital wallet (direct API)
2. **EcoCash** - Econet Wireless mobile money (direct API)
3. **OneWallet** - NetOne mobile money (direct API, renamed from OneMoney)
4. **InnBucks** - InnBucks mobile wallet (direct API)

**Rationale:** Direct integrations give us lower fees, better control over the
payment experience, direct webhook handling, and no dependency on a third-party
aggregator.

---

## Integration Architecture: Provider Adapter Pattern

Every external integration follows the same pattern to ensure they can be
swapped between stub, sandbox, and production without code changes.

```
┌─────────────────────────────────────────────────────┐
│                  Service Layer                       │
│   (PaymentService, KYCService, LockService, etc.)   │
└────────────────────┬────────────────────────────────┘
                     │ uses interface
┌────────────────────▼────────────────────────────────┐
│              Provider Interface                      │
│   (PaymentProvider, KYCProvider, LockProvider)        │
└────┬───────────┬───────────┬───────────┬────────────┘
     │           │           │           │
┌────▼──┐  ┌────▼──┐  ┌────▼──┐  ┌─────▼─────┐
│ Stub  │  │Sandbox│  │ Live  │  │  Manual   │
│Provider│  │Provider│  │Provider│  │ Provider  │
└───────┘  └───────┘  └───────┘  └───────────┘
```

### Feature Flag Control

Each integration is controlled by feature flags:

```typescript
// Feature flags for integration mode
FEATURE_FLAGS = {
  'kyc-provider-mode':      'stub' | 'sandbox' | 'live',
  'payment-ecocash-mode':   'stub' | 'sandbox' | 'live',
  'payment-omari-mode':     'stub' | 'sandbox' | 'live',
  'payment-onewallet-mode': 'stub' | 'sandbox' | 'live',
  'payment-innbucks-mode':  'stub' | 'sandbox' | 'live',
  'lock-provider-mode':     'stub' | 'sandbox' | 'live',
  'whatsapp-provider-mode': 'stub' | 'sandbox' | 'live',
}
```

**Stub mode** = in-memory mock, deterministic responses, no external calls
**Sandbox mode** = connected to provider's test environment
**Live mode** = connected to provider's production API

---

## Phased Rollout Aligned with Project Phases

### Phase 4A: Go-Live with Manual Workflows (Current - March 2026)

**Goal:** Deploy to production for human testing WITHOUT live external APIs.

| Component | Go-Live Strategy |
|-----------|-----------------|
| **Payments** | USSD manual flow + admin dashboard verification |
| **KYC** | Manual document upload + admin review in dashboard |
| **Device Lock** | Manual tracking in admin portal, no remote lock |
| **WhatsApp** | Not required - admin portal handles all operations |

**Key deliverables:**
- Stub providers for all external services
- Manual verification workflows in admin dashboard
- Feature flags defaulting to `stub` mode
- Full audit logging of all manual operations

See: [DEPLOY-WITHOUT-INTEGRATIONS.md](./DEPLOY-WITHOUT-INTEGRATIONS.md)

### Phase 4B: Sandbox Integration Testing (March - April 2026)

**Goal:** Connect to provider sandbox/test environments and validate.

| Integration | Action |
|-------------|--------|
| **EcoCash** | Obtain sandbox credentials, connect to test API |
| **Smile Identity** | Obtain partner ID, test with sandbox |
| **Trustonic** | Obtain API keys, test device enrollment in sandbox |
| **InnBucks** | Obtain sandbox credentials |
| **OneWallet** | Obtain sandbox credentials |
| **O'mari** | Obtain direct API access (separate from Paynow) |
| **WhatsApp** | Create Meta Business account, test with sandbox |

**Key deliverables:**
- Contract tests passing against sandbox APIs
- Webhook handlers validated with real callbacks
- Error handling verified for all provider error codes
- Feature flags switched to `sandbox` mode in staging

### Phase 4C: Production API Activation (April - May 2026)

**Goal:** Switch from sandbox to live APIs, one provider at a time.

**Activation order (by business priority):**

1. **EcoCash** (70% market share - activate first)
2. **Smile Identity** (KYC required before loan disbursement)
3. **O'mari** (~10% market share)
4. **OneWallet** (~5% market share)
5. **InnBucks** (~8% market share)
6. **Trustonic** (device lock - activate before first device handover)
7. **WhatsApp** (customer communication - activate after pilot)

**Per-provider activation process:**

```
1. Obtain production API credentials
2. Store credentials in AWS Secrets Manager
3. Run contract tests against production (read-only operations)
4. Switch feature flag to 'live' for 10% of traffic
5. Monitor error rates, latency, webhook delivery
6. Gradually increase to 100% over 48 hours
7. Remove stub/sandbox code paths after 2 weeks stable
```

### Phase 5: Optimization & Scale (May 2026+)

- Add failover between payment providers
- Implement intelligent routing (cheapest fees, highest success rate)
- Add real-time provider health monitoring
- Consider additional providers based on market demand
- WhatsApp bot activation for full self-service customer experience

---

## Integration Dependencies Map

```
Customer Onboarding:
  WhatsApp → KYC (Smile Identity) → Scoring → Loan Approval

Loan Disbursement:
  Payment (deposit collection) → Device Handover → Lock (Trustonic enrollment)

Active Loan:
  Payment (repayments) → Lock (lock/unlock triggers) → Notifications

Admin Operations:
  Dashboard → All services (manual fallback for every integration)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Provider API unavailable | Stub/manual fallback always available |
| Delayed API access from provider | Manual workflows allow business to operate |
| Webhook delivery failures | Polling reconciliation runs every 15 minutes |
| Provider changes API contract | Contract tests catch breaking changes immediately |
| Credentials leak | AWS Secrets Manager + environment-based access |
| Provider rate limits | Circuit breaker pattern + request queuing |

---

## File Index

| Document | Purpose |
|----------|---------|
| [DEPLOY-WITHOUT-INTEGRATIONS.md](./DEPLOY-WITHOUT-INTEGRATIONS.md) | Go-live strategy with stubs |
| [KYC-SMILE-IDENTITY.md](./KYC-SMILE-IDENTITY.md) | Smile Identity integration plan |
| [PAYMENTS-INTEGRATION.md](./PAYMENTS-INTEGRATION.md) | All 4 payment providers |
| [DEVICE-LOCK-TRUSTONIC.md](./DEVICE-LOCK-TRUSTONIC.md) | Trustonic integration plan |
| [WHATSAPP-CLOUD-API.md](./WHATSAPP-CLOUD-API.md) | WhatsApp Cloud API plan |
| [TESTING-STRATEGY.md](./TESTING-STRATEGY.md) | TDD approach for integrations |
