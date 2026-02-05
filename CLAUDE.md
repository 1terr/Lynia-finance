# Lynia Finance - Claude Development Guidelines

## Project Mission

Lynia Finance provides alternative financial infrastructure for Zimbabwe's underbanked majority. We serve the 80% informal workforce who lack traditional credit access. Every line of code must advance **financial inclusion in Africa** for the underbanked and semi-literate population.

---

## Core Development Principles

### 1. Security First - Non-Negotiable

Financial systems are high-value targets. Security is not optional.

**Authentication & Authorization**
- All API endpoints MUST validate JWT tokens via Supabase Auth
- Implement Row Level Security (RLS) on ALL database tables
- Never trust client-side data - validate everything server-side
- Use principle of least privilege for all service accounts
- API keys and secrets MUST use AWS Secrets Manager or environment variables - NEVER hardcode

**Data Protection**
- Encrypt all PII (Personally Identifiable Information) at rest and in transit
- Use TLS 1.3 for all external communications
- Hash sensitive data (passwords, PINs) using bcrypt with cost factor >= 12
- Implement rate limiting on all public endpoints (especially auth, OTP, payments)
- Log security events but NEVER log sensitive data (passwords, full card numbers, OTPs)

**Input Validation**
- Sanitize ALL user inputs to prevent SQL injection and XSS
- Use parameterized queries only - no string concatenation for SQL
- Validate phone numbers, national IDs, and amounts with strict regex patterns
- Implement request size limits to prevent DoS attacks

**Code Review Checklist**
```
[ ] No hardcoded secrets or API keys
[ ] All inputs validated and sanitized
[ ] Authentication required on protected routes
[ ] Rate limiting implemented
[ ] Error messages don't leak system information
[ ] Audit logging for sensitive operations
```

### 2. Privacy by Design

Our users trust us with their financial and personal data.

**Data Minimization**
- Collect ONLY data necessary for the specific function
- KYC data should be processed and stored with explicit consent
- Implement data retention policies - delete what's no longer needed
- Anonymize data used for analytics and ML training

**Consent & Transparency**
- Clear opt-in for data collection via WhatsApp flows
- Users can request their data export (GDPR-style rights)
- Audit trail for who accessed what data and when
- Third-party data sharing (Smile Identity, payment providers) requires explicit consent

**Database Privacy Rules**
```sql
-- Example: RLS policy for customer data
CREATE POLICY "Users can only view own data" ON customers
  FOR SELECT USING (auth.uid() = user_id);

-- Mask sensitive data in logs
-- NEVER log: full_national_id, full_phone, biometric_data
```

**Privacy Patterns**
- Use UUIDs not sequential IDs (prevents enumeration attacks)
- Separate PII storage from transaction data where possible
- Implement field-level encryption for highly sensitive data
- Support right to deletion (soft delete with hard delete after retention period)

### 3. Frontend Excellence - Fintech Dashboard Optimization

Our admin portal and distributor dashboard must be world-class.

**Performance Standards**
- First Contentful Paint (FCP) < 1.5s
- Time to Interactive (TTI) < 3s
- Lighthouse Performance Score > 90
- Bundle size < 200KB initial load (code split aggressively)

**Dashboard Best Practices**
```typescript
// Use React Server Components for data-heavy dashboards
// Keep client components minimal for interactivity only

// Implement skeleton loading for all data tables
<Suspense fallback={<TableSkeleton rows={10} />}>
  <LoanApplicationsTable />
</Suspense>

// Use optimistic updates for better UX
const { mutate } = useSWR('/api/loans');
await approveAction();
mutate(); // Revalidate immediately
```

**Data Visualization**
- Use consistent chart library (Recharts or Chart.js)
- Real-time updates via Supabase subscriptions for critical metrics
- Responsive design - dashboards must work on tablets (field agents use tablets)
- Dark mode support (reduces eye strain for staff working long hours)

**Fintech UI Patterns**
- Clear status indicators: Pending (yellow), Approved (green), Rejected (red), Locked (orange)
- Money formatting: Always show currency (USD/ZWL), 2 decimal places, thousand separators
- Date formatting: Use relative time for recent ("2 hours ago"), absolute for older
- Action confirmations: Double-confirm destructive actions (loan rejection, device lock)

**Accessibility**
- WCAG 2.1 AA compliance minimum
- Keyboard navigation for all actions
- Screen reader support for financial data
- High contrast mode for outdoor/bright light use

### 4. Scalable Infrastructure

Design for 10x growth from day one.

**Serverless Architecture Principles**
```yaml
# Lambda best practices
- Cold start optimization: Keep bundles < 5MB
- Connection pooling: Use RDS Proxy or Supabase connection pooling
- Async processing: Use SQS for non-critical operations
- Idempotency: All payment operations must be idempotent
```

**Database Scaling**
- Index all foreign keys and frequently queried columns
- Use database connection pooling (Supabase PgBouncer)
- Implement read replicas when query load increases
- Partition large tables (transactions, audit_logs) by date

**Microservices Boundaries**
```
scoring-service    → Credit decisions (stateless, can scale independently)
payment-service    → Financial transactions (requires strong consistency)
whatsapp-service   → Customer communication (high throughput, async)
kyc-service        → Identity verification (external API dependent)
lock-service       → Device management (eventual consistency OK)
notification-service → Alerts (async, queue-based)
```

**Caching Strategy**
- Cache credit scores for 24 hours (recalculate on significant events)
- Cache device inventory counts for 5 minutes
- Never cache: payment status, loan balances, user auth state

**Cost Optimization**
- Use Lambda reserved concurrency for cost predictability
- Implement request batching for external APIs
- Archive old data to S3 (transactions > 2 years)
- Monitor and alert on unusual cost spikes

### 5. Bug-Free Claude Development

Systematic approach to AI-assisted development.

**Before Writing Code**
```markdown
1. Read existing code in the area you're modifying
2. Understand the data flow and dependencies
3. Check for existing patterns/utilities to reuse
4. Review related tests to understand expected behavior
```

**Code Quality Standards**
- TypeScript strict mode enabled - no `any` types without justification
- ESLint and Prettier must pass before commit
- No TODO comments without linked GitHub issue
- All functions must have JSDoc comments explaining purpose

**Change Verification Checklist**
```markdown
[ ] Read all files being modified BEFORE making changes
[ ] Changes follow existing code patterns and naming conventions
[ ] No duplicate code - extract to shared utilities if needed
[ ] All new code has corresponding tests
[ ] Manual testing performed for UI changes
[ ] No regressions in existing functionality
[ ] Database migrations are backwards compatible
```

**Error Handling**
```typescript
// Always use typed errors
class LoanApplicationError extends Error {
  constructor(
    message: string,
    public code: 'INSUFFICIENT_SCORE' | 'KYC_PENDING' | 'DUPLICATE_APPLICATION',
    public customerId: string
  ) {
    super(message);
  }
}

// Log errors with context, not stack traces in production
logger.error('Loan application failed', {
  errorCode: error.code,
  customerId: error.customerId,
  // Never log: personal data, financial details
});
```

**Git Commit Discipline**
- Atomic commits: One logical change per commit
- Descriptive messages: "Add credit score caching to reduce API calls" not "fix stuff"
- Never commit: `.env` files, `node_modules`, build artifacts, secrets

### 6. Test-Driven Development (TDD)

Tests are not optional. They are the foundation of reliable financial software.

**Coverage Requirements**
```javascript
// jest.config.js thresholds
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  // Critical paths require higher coverage
  './services/payment-service/': {
    branches: 95,
    functions: 95,
    lines: 95
  },
  './services/scoring-service/': {
    branches: 90,
    functions: 90,
    lines: 90
  }
}
```

**Test Types Required**

**Unit Tests** (Every function)
```typescript
describe('calculateCreditScore', () => {
  it('should return minimum score for new customers', () => {
    const score = calculateCreditScore({ transactionHistory: [] });
    expect(score).toBe(300);
  });

  it('should increase score with positive payment history', () => {
    const score = calculateCreditScore({
      transactionHistory: [
        { type: 'REPAYMENT', onTime: true },
        { type: 'REPAYMENT', onTime: true }
      ]
    });
    expect(score).toBeGreaterThan(400);
  });
});
```

**Integration Tests** (API endpoints)
```typescript
describe('POST /loans/apply', () => {
  it('should reject application with insufficient score', async () => {
    const response = await request(app)
      .post('/loans/apply')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ customerId: 'test-123', amount: 500 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INSUFFICIENT_SCORE');
  });
});
```

**E2E Tests** (Critical user journeys)
- Customer onboarding flow (WhatsApp → KYC → Approval)
- Payment processing (initiate → confirm → update balance)
- Device lock/unlock cycle
- Admin loan approval workflow

**Test Data Management**
- Use factories for test data generation
- Never use production data in tests
- Reset database state between integration tests
- Mock external APIs (Smile Identity, EcoCash) in tests

### 7. Financial Inclusion Design Patterns

Our users are underbanked and often semi-literate. Design for them.

**WhatsApp-First Experience**
```
Why WhatsApp:
- 90%+ smartphone penetration in target market
- Familiar interface, no app download required
- Works on low-end devices and slow connections
- Supports voice messages for semi-literate users
```

**Language & Communication**
- Support English, Shona, and Ndebele
- Use simple, clear language (8th-grade reading level max)
- Avoid financial jargon - "pay back" not "amortization"
- Include voice note options for complex explanations
- Use visual confirmations (emojis, images) where appropriate

**Message Templates**
```typescript
// Good: Clear, simple, actionable
const paymentReminder = `
Hi {{name}}!

Your payment of ${{amount}} is due {{date}}.

Reply:
1 - Pay now
2 - Request extension
3 - Check balance
`;

// Bad: Complex, jargon-filled
const badReminder = `
Dear valued customer, your amortized installment
of ${{amount}} per your credit facility agreement
dated {{date}} is now due...
`;
```

**Offline-Resilient Design**
- Queue WhatsApp messages for retry on failure
- Store transaction attempts locally, sync when online
- Provide SMS fallback for critical notifications
- Design forms to work with intermittent connectivity

**Low-Data Optimization**
- Compress images before transmission
- Use text-based status updates over media
- Implement progressive loading for dashboards
- Cache aggressively on mobile devices

**Trust Building**
- Clear fee disclosure before any transaction
- Transaction receipts via WhatsApp immediately
- Easy access to transaction history
- Human support escalation path always available

---

## Project Structure Reference

```
Lynia-finance/
├── services/                 # AWS Lambda microservices
│   ├── whatsapp-service/    # Customer communication
│   ├── kyc-service/         # Identity verification
│   ├── scoring-service/     # Credit assessment
│   ├── payment-service/     # Payment processing
│   ├── lock-service/        # Device management
│   ├── notification-service/# Multi-channel alerts
│   └── shared/              # Shared types and utilities
├── frontend/
│   ├── admin-portal/        # Staff dashboard (Next.js 14)
│   └── distributor-dashboard/# Agent portal
├── infrastructure/          # AWS SAM, Supabase schemas
├── database/               # Migrations and seeds
├── tests/                  # Test suites
└── docs/                   # Documentation
```

## Key Commands

```bash
# Development
pnpm install                    # Install dependencies
pnpm dev                        # Start development servers
pnpm build                      # Build all services

# Testing
pnpm test                       # Run all tests
pnpm test:coverage              # Run with coverage report
pnpm test:integration           # Integration tests only

# Deployment
sam build                       # Build Lambda functions
sam deploy --config-env dev     # Deploy to development
sam deploy --config-env staging # Deploy to staging

# Database
pnpm db:migrate                 # Run migrations
pnpm db:seed                    # Seed test data
```

## External Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| Supabase | Database & Auth | `docs/deployment/SUPABASE-SETUP-GUIDE.md` |
| WhatsApp Cloud API | Customer messaging | `docs/guides/WHATSAPP-CLOUD-API-SETUP.md` |
| Smile Identity | KYC verification | `services/kyc-service/README.md` |
| EcoCash/OneMoney | Mobile payments | `services/payment-service/README.md` |
| Trustonic | Device lock | `services/lock-service/README.md` |

---

## Remember

> Every feature we build, every line of code we write, serves real people trying to build better lives. A mother buying a smartphone to start a small business. A farmer needing equipment financing. A young person accessing credit for the first time.
>
> Build with empathy. Ship with confidence. Scale with purpose.

**Financial inclusion is not just our product - it's our mission.**
