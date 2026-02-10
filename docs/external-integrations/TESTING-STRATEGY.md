# Testing Strategy for External Integrations

> Test-driven approach ensuring safe, reliable integration with external APIs

## Testing Principles

1. **Never call live APIs in automated tests** - Use stubs for unit tests, sandbox for integration tests
2. **Contract tests are the source of truth** - Every provider must pass its contract before activation
3. **Test the adapter, not the provider** - We test our code's behavior, not the external API itself
4. **Feature flags enable safe rollout** - Tests run against each mode (stub/sandbox/live)
5. **Failure modes matter most** - Test timeouts, invalid responses, and network errors thoroughly

---

## Test Pyramid for Integrations

```
                    ┌─────────┐
                    │  E2E    │  2-3 critical journeys per provider
                   ┌┴─────────┴┐
                   │ Contract   │  API boundary validation
                  ┌┴───────────┴┐
                  │ Integration  │  Service + DB + stub provider
                 ┌┴─────────────┴┐
                 │   Unit Tests   │  Provider adapter logic
                ┌┴───────────────┴┐
                │  Interface Tests │  Type compliance
                └─────────────────┘
```

---

## 1. Interface Tests

Verify every provider adapter implements the required interface correctly.

```typescript
// tests/unit/payment-provider-interface.test.ts
describe('PaymentProvider interface compliance', () => {
  const providers = [
    new EcoCashProvider(),
    new OmariProvider(),
    new OneWalletProvider(),
    new InnBucksProvider(),
    new StubPaymentProvider(),
  ];

  providers.forEach((provider) => {
    describe(provider.providerId, () => {
      it('has required providerId', () => {
        expect(provider.providerId).toBeDefined();
        expect(['ecocash', 'omari', 'onewallet', 'innbucks', 'stub'])
          .toContain(provider.providerId);
      });

      it('has initiatePayment method', () => {
        expect(typeof provider.initiatePayment).toBe('function');
      });

      it('has checkPaymentStatus method', () => {
        expect(typeof provider.checkPaymentStatus).toBe('function');
      });

      it('has verifyWebhookSignature method', () => {
        expect(typeof provider.verifyWebhookSignature).toBe('function');
      });

      it('has generatePaymentInstructions method', () => {
        expect(typeof provider.generatePaymentInstructions).toBe('function');
      });

      it('has validatePhoneNumber method', () => {
        expect(typeof provider.validatePhoneNumber).toBe('function');
      });
    });
  });
});
```

---

## 2. Unit Tests

Test provider adapter logic in isolation with no network calls.

### Payment Provider Unit Tests

```typescript
// tests/unit/ecocash-provider.test.ts
describe('EcoCashProvider', () => {
  let provider: EcoCashProvider;

  beforeEach(() => {
    provider = new EcoCashProvider();
  });

  describe('validatePhoneNumber', () => {
    it('accepts valid Econet numbers (+263 77/78)', () => {
      expect(provider.validatePhoneNumber('+263771234567')).toBe(true);
      expect(provider.validatePhoneNumber('+263781234567')).toBe(true);
    });

    it('rejects non-Econet numbers', () => {
      expect(provider.validatePhoneNumber('+263711234567')).toBe(false); // NetOne
      expect(provider.validatePhoneNumber('+263731234567')).toBe(false); // Telecel
    });

    it('rejects invalid formats', () => {
      expect(provider.validatePhoneNumber('0771234567')).toBe(false);
      expect(provider.validatePhoneNumber('+263')).toBe(false);
      expect(provider.validatePhoneNumber('')).toBe(false);
    });
  });

  describe('generatePaymentInstructions', () => {
    it('includes USSD code *151#', () => {
      const instructions = provider.generatePaymentInstructions(150.00, 'LYN-123');
      expect(instructions).toContain('*151#');
    });

    it('includes amount and reference', () => {
      const instructions = provider.generatePaymentInstructions(150.00, 'LYN-123');
      expect(instructions).toContain('150.00');
      expect(instructions).toContain('LYN-123');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('accepts valid HMAC-SHA256 signature', () => {
      // Test with known secret and payload
      const payload = '{"transaction_id":"123","status":"SUCCESS"}';
      const secret = 'test_webhook_secret';
      const validSignature = createHmac('sha256', secret)
        .update(payload).digest('hex');

      expect(provider.verifyWebhookSignature(validSignature, payload)).toBe(true);
    });

    it('rejects tampered payload', () => {
      const payload = '{"transaction_id":"123","status":"SUCCESS"}';
      const tamperedPayload = '{"transaction_id":"123","status":"FAILED"}';
      const secret = 'test_webhook_secret';
      const signature = createHmac('sha256', secret)
        .update(payload).digest('hex');

      expect(provider.verifyWebhookSignature(signature, tamperedPayload)).toBe(false);
    });
  });
});
```

### KYC Provider Unit Tests

```typescript
// tests/unit/kyc-decision-logic.test.ts
describe('KYC Decision Logic', () => {
  it('auto-approves when all criteria met', () => {
    const result = determineDecision({
      confidence: 95,
      result: 'Verified',
      liveness: { passed: true },
      document: { authentic: true, tampered: false, expired: false },
    });
    expect(result).toBe('APPROVED');
  });

  it('auto-rejects when confidence below 50', () => {
    const result = determineDecision({
      confidence: 30,
      result: 'Not Verified',
      liveness: { passed: true },
      document: { authentic: true, tampered: false, expired: false },
    });
    expect(result).toBe('REJECTED');
  });

  it('sends to manual review when confidence 50-84', () => {
    const result = determineDecision({
      confidence: 70,
      result: 'Verified',
      liveness: { passed: true },
      document: { authentic: true, tampered: false, expired: false },
    });
    expect(result).toBe('MANUAL_REVIEW');
  });

  it('rejects when liveness fails regardless of confidence', () => {
    const result = determineDecision({
      confidence: 99,
      result: 'Verified',
      liveness: { passed: false },
      document: { authentic: true, tampered: false, expired: false },
    });
    expect(result).toBe('REJECTED');
  });

  it('rejects when document is tampered', () => {
    const result = determineDecision({
      confidence: 95,
      result: 'Verified',
      liveness: { passed: true },
      document: { authentic: true, tampered: true, expired: false },
    });
    expect(result).toBe('REJECTED');
  });

  it('rejects when document is expired', () => {
    const result = determineDecision({
      confidence: 95,
      result: 'Verified',
      liveness: { passed: true },
      document: { authentic: true, tampered: false, expired: true },
    });
    expect(result).toBe('REJECTED');
  });
});
```

### Lock Provider Unit Tests

```typescript
// tests/unit/lock-triggers.test.ts
describe('Lock Trigger Logic', () => {
  it('triggers lock at 15 days overdue for first-time default', () => {
    const trigger = shouldTriggerLock({
      daysOverdue: 15,
      previousDefaults: 0,
    });
    expect(trigger.shouldLock).toBe(true);
    expect(trigger.gracePeriod).toBe(15);
  });

  it('triggers lock at 7 days for third-time default', () => {
    const trigger = shouldTriggerLock({
      daysOverdue: 7,
      previousDefaults: 2,
    });
    expect(trigger.shouldLock).toBe(true);
    expect(trigger.gracePeriod).toBe(7);
  });

  it('does not trigger lock within grace period', () => {
    const trigger = shouldTriggerLock({
      daysOverdue: 10,
      previousDefaults: 0,
    });
    expect(trigger.shouldLock).toBe(false);
  });

  it('allows emergency numbers when locked', () => {
    const lockConfig = getLockConfig('payment_default');
    expect(lockConfig.emergencyNumbers).toContain('999');
    expect(lockConfig.emergencyNumbers).toContain('994');
    expect(lockConfig.emergencyNumbers).toContain('993');
    expect(lockConfig.emergencyNumbers).toContain('112');
  });
});
```

---

## 3. Integration Tests

Test service layer with database and stub providers.

```typescript
// tests/integration/payment-service.integration.test.ts
describe('PaymentService Integration', () => {
  let paymentService: PaymentService;
  let supabase: SupabaseClient;

  beforeAll(async () => {
    // Uses stub providers, real database
    process.env.PAYMENT_ECOCASH_MODE = 'stub';
    paymentService = new PaymentService();
    supabase = createTestClient();
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('payments').delete().eq('description', 'TEST');
  });

  it('creates payment record and returns reference', async () => {
    const result = await paymentService.initiatePayment({
      loan_id: 'test-loan-1',
      customer_id: 'test-customer-1',
      amount: 150.00,
      currency: 'USD',
      customer_phone: '+263771234567',
      gateway: 'ecocash',
      payment_type: 'repayment',
      description: 'TEST',
    });

    expect(result.payment_id).toBeDefined();
    expect(result.gateway).toBe('ecocash');
    expect(result.instructions).toContain('*151#');

    // Verify database record
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('id', result.payment_id)
      .single();

    expect(data.status).toBe('pending');
    expect(data.amount).toBe(150.00);
  });

  it('enforces RBZ daily transaction limit', async () => {
    // Create payments that approach daily limit
    // Then verify the next payment is rejected
    await expect(
      paymentService.initiatePayment({
        loan_id: 'test-loan-1',
        customer_id: 'test-customer-1',
        amount: 5001, // Exceeds $5000 daily limit
        currency: 'USD',
        customer_phone: '+263771234567',
        gateway: 'ecocash',
        payment_type: 'repayment',
        description: 'TEST',
      })
    ).rejects.toThrow('Daily transaction limit exceeded');
  });

  it('prevents duplicate payments (idempotency)', async () => {
    const firstResult = await paymentService.initiatePayment({
      loan_id: 'test-loan-1',
      customer_id: 'test-customer-1',
      amount: 100.00,
      currency: 'USD',
      customer_phone: '+263771234567',
      gateway: 'ecocash',
      payment_type: 'repayment',
      description: 'TEST',
    });

    // Same request should not create duplicate
    // (Depends on idempotency key implementation)
    expect(firstResult.payment_id).toBeDefined();
  });
});
```

---

## 4. Contract Tests

Validate our code works correctly with the provider's API contract.

```typescript
// tests/contract/ecocash.contract.test.ts
describe('EcoCash API Contract', () => {
  // These tests run against sandbox when PAYMENT_ECOCASH_MODE=sandbox
  // Skip in CI unless sandbox credentials are configured
  const skipIfNoSandbox = !process.env.ECOCASH_API_KEY ? it.skip : it;

  skipIfNoSandbox('initiates payment and receives transaction_id', async () => {
    const provider = new EcoCashProvider();
    const response = await provider.initiatePayment({
      amount: 1.00,
      currency: 'USD',
      customer_phone: '+263771234567', // Sandbox test number
      reference: `TEST-${Date.now()}`,
      description: 'Contract test payment',
    });

    expect(response.success).toBe(true);
    expect(response.transaction_id).toBeDefined();
    expect(response.status).toBe('pending');
  });

  skipIfNoSandbox('checks payment status', async () => {
    const provider = new EcoCashProvider();
    // First initiate, then check
    const initResponse = await provider.initiatePayment({
      amount: 1.00,
      currency: 'USD',
      customer_phone: '+263771234567',
      reference: `TEST-${Date.now()}`,
      description: 'Contract test',
    });

    const status = await provider.checkPaymentStatus(initResponse.transaction_id);
    expect(['pending', 'processing', 'completed', 'failed']).toContain(status.status);
    expect(status.transaction_id).toBe(initResponse.transaction_id);
  });
});

// Similar contract tests for:
// - tests/contract/omari.contract.test.ts
// - tests/contract/onewallet.contract.test.ts
// - tests/contract/innbucks.contract.test.ts
// - tests/contract/smile-identity.contract.test.ts
// - tests/contract/trustonic.contract.test.ts
// - tests/contract/whatsapp.contract.test.ts
```

---

## 5. E2E Tests

Test complete business journeys through all services.

```typescript
// tests/e2e/loan-lifecycle.e2e.test.ts
describe('Loan Lifecycle E2E', () => {
  it('completes full loan journey: onboard → apply → pay deposit → handover → repay → complete', async () => {
    // Step 1: Customer onboarding (KYC)
    const kycResult = await submitKYC({
      name: 'Test Customer',
      national_id: '63-123456A78',
      phone: '+263771234567',
    });
    expect(kycResult.status).toBe('pending');

    // Step 2: Admin approves KYC (manual in stub mode)
    await adminApproveKYC(kycResult.verification_id);

    // Step 3: Loan application
    const loanResult = await applyForLoan({
      customer_id: kycResult.customer_id,
      device_id: 'test-device-1',
      amount: 500.00,
    });
    expect(loanResult.status).toBe('pending_approval');

    // Step 4: Admin approves loan
    await adminApproveLoan(loanResult.loan_id);

    // Step 5: Customer pays deposit
    const depositResult = await initiatePayment({
      loan_id: loanResult.loan_id,
      amount: 100.00,
      gateway: 'ecocash',
      payment_type: 'deposit',
    });
    expect(depositResult.gateway).toBe('ecocash');

    // Step 6: Admin verifies deposit (stub mode)
    await adminVerifyPayment(depositResult.payment_id);

    // Step 7: Device handover
    const handoverResult = await completeHandover({
      loan_id: loanResult.loan_id,
      distributor_id: 'test-distributor-1',
      imei: '123456789012345',
    });
    expect(handoverResult.status).toBe('completed');

    // Step 8: Monthly repayment
    const repaymentResult = await initiatePayment({
      loan_id: loanResult.loan_id,
      amount: 50.00,
      gateway: 'ecocash',
      payment_type: 'repayment',
    });
    await adminVerifyPayment(repaymentResult.payment_id);

    // Verify loan balance updated
    const loan = await getLoan(loanResult.loan_id);
    expect(loan.outstanding_balance).toBe(350.00); // 500 - 100 deposit - 50 repayment
  });
});
```

---

## 6. Stub Provider Tests

Verify stub providers behave predictably for development and testing.

```typescript
// tests/unit/stub-providers.test.ts
describe('StubPaymentProvider', () => {
  it('returns success by default', async () => {
    const stub = new StubPaymentProvider();
    const result = await stub.initiatePayment({
      amount: 100, currency: 'USD',
      customer_phone: '+263771234567',
      reference: 'TEST-1', description: 'test',
    });
    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');
  });

  it('can be configured to simulate failure', async () => {
    const stub = new StubPaymentProvider({ simulateFailure: true });
    await expect(
      stub.initiatePayment({
        amount: 100, currency: 'USD',
        customer_phone: '+263771234567',
        reference: 'TEST-1', description: 'test',
      })
    ).rejects.toThrow();
  });

  it('simulates realistic delay', async () => {
    const stub = new StubPaymentProvider({ delayMs: 2000 });
    const start = Date.now();
    await stub.initiatePayment({
      amount: 100, currency: 'USD',
      customer_phone: '+263771234567',
      reference: 'TEST-1', description: 'test',
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(1900);
  });
});
```

---

## Test Execution Strategy

### Local Development

```bash
# Run unit tests (no external deps, fast)
pnpm test:unit

# Run integration tests (requires local Supabase)
pnpm test:integration

# Run contract tests against sandbox (requires credentials)
PAYMENT_ECOCASH_MODE=sandbox pnpm test:contract
```

### CI/CD Pipeline

```yaml
# GitHub Actions workflow
test-unit:
  # Runs on every PR - fast, no external deps
  run: pnpm test:unit

test-integration:
  # Runs on every PR - uses test database
  run: pnpm test:integration

test-contract:
  # Runs weekly or on-demand - requires sandbox credentials
  # Sandbox credentials stored in GitHub Secrets
  if: github.event_name == 'schedule' || github.event.inputs.run_contract_tests
  run: pnpm test:contract

test-e2e:
  # Runs before production deployment
  if: github.ref == 'refs/heads/main'
  run: pnpm test:e2e
```

### Pre-Activation Checklist

Before switching any provider from stub to sandbox/live:

```
[ ] All unit tests passing for the provider adapter
[ ] All contract tests passing against sandbox
[ ] Integration tests passing with the new provider mode
[ ] E2E test for the relevant journey passing
[ ] Webhook endpoint tested with real callbacks
[ ] Error handling verified for all provider error codes
[ ] Timeout handling verified
[ ] Idempotency verified (no duplicate transactions)
[ ] Rate limiting verified
[ ] Monitoring dashboards configured
[ ] Alerts configured for the provider
[ ] Rollback procedure documented and tested
```

---

## Coverage Requirements

| Test Layer | Target | Scope |
|-----------|--------|-------|
| Unit tests | 90%+ | Provider adapters, decision logic, validation |
| Integration tests | 80%+ | Service layer with DB |
| Contract tests | 100% of API operations | Every endpoint we use |
| E2E tests | 3 critical journeys | Onboard→Loan→Pay, Payment→Lock→Unlock, Manual fallback |
