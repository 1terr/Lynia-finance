# Lynia Finance - Claude Development Guidelines

## Project Mission

Lynia Finance provides alternative financial infrastructure for Zimbabwe's underbanked majority. We serve the 80% informal workforce who lack traditional credit access. Every line of code must advance **financial inclusion in Africa** for the underbanked and semi-literate population.

---

## Core Development Principles

### 1. Security First - Non-Negotiable

Financial systems are high-value targets. Security is not optional.

**Authentication & Authorization**
- All API endpoints MUST validate JWT tokens via Amazon Cognito
- Implement application-layer authorization middleware on ALL endpoints
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
```typescript
// Authorization middleware (replaces Supabase RLS)
import { getAuthContext, requireRole } from '../shared/middleware/authorization';

// Verify user can only access own data
const authContext = getAuthContext(event);
requireRole(authContext, ['admin', 'manager']);

// Mask sensitive data in logs
// NEVER log: full_national_id, full_phone, biometric_data
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
- Real-time updates via React Query polling / WebSocket API for critical metrics
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
- Connection pooling: Use RDS connection pooling or RDS Proxy
- Async processing: Use SQS for non-critical operations
- Idempotency: All payment operations must be idempotent
```

**Database Scaling**
- Index all foreign keys and frequently queried columns
- Use database connection pooling (RDS built-in or RDS Proxy)
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

**Branch Naming Conventions**
```
feature/TICKET-123-add-loan-approval      # New features
fix/TICKET-456-payment-timeout            # Bug fixes
hotfix/critical-payment-processing        # Production emergencies
release/v1.2.0                            # Release branches
chore/update-dependencies                 # Maintenance tasks
docs/api-documentation                    # Documentation updates
```

**Conventional Commits**
```
feat: add credit score caching
fix: resolve payment timeout issue
docs: update API documentation
test: add loan approval unit tests
refactor: extract payment validation
perf: optimize database queries
security: fix SQL injection vulnerability
chore: update dependencies
```

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

### 8. Error Code Standards

Consistent error codes across all services for debugging and user communication.

**Error Code Format**
```typescript
// Format: SERVICE_CATEGORY_CODE
// Example: LOAN_VALIDATION_001

const ERROR_CODES = {
  // Authentication Errors (AUTH_*)
  AUTH_INVALID_TOKEN: 'AUTH_TOKEN_001',
  AUTH_EXPIRED_TOKEN: 'AUTH_TOKEN_002',
  AUTH_INVALID_CREDENTIALS: 'AUTH_CRED_001',
  AUTH_ACCOUNT_LOCKED: 'AUTH_LOCK_001',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_001',

  // Loan Errors (LOAN_*)
  LOAN_INSUFFICIENT_SCORE: 'LOAN_SCORE_001',
  LOAN_KYC_PENDING: 'LOAN_KYC_001',
  LOAN_KYC_FAILED: 'LOAN_KYC_002',
  LOAN_DUPLICATE_APPLICATION: 'LOAN_DUP_001',
  LOAN_AMOUNT_EXCEEDED: 'LOAN_AMT_001',
  LOAN_TERM_INVALID: 'LOAN_TERM_001',

  // Payment Errors (PAY_*)
  PAY_INSUFFICIENT_FUNDS: 'PAY_FUND_001',
  PAY_TIMEOUT: 'PAY_TIME_001',
  PAY_PROVIDER_ERROR: 'PAY_PROV_001',
  PAY_DUPLICATE_TRANSACTION: 'PAY_DUP_001',
  PAY_INVALID_AMOUNT: 'PAY_AMT_001',

  // KYC Errors (KYC_*)
  KYC_DOCUMENT_INVALID: 'KYC_DOC_001',
  KYC_FACE_MISMATCH: 'KYC_FACE_001',
  KYC_PROVIDER_ERROR: 'KYC_PROV_001',

  // Device Errors (DEV_*)
  DEV_LOCK_FAILED: 'DEV_LOCK_001',
  DEV_UNLOCK_FAILED: 'DEV_UNLOCK_001',
  DEV_NOT_FOUND: 'DEV_404_001',

  // Validation Errors (VAL_*)
  VAL_REQUIRED_FIELD: 'VAL_REQ_001',
  VAL_INVALID_FORMAT: 'VAL_FMT_001',
  VAL_OUT_OF_RANGE: 'VAL_RNG_001',
} as const;
```

**Error Response Format**
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // e.g., "LOAN_SCORE_001"
    message: string;        // User-friendly message
    details?: object;       // Additional context (never sensitive data)
    requestId: string;      // For support/debugging
    timestamp: string;      // ISO8601
  };
}

// Example
{
  "success": false,
  "error": {
    "code": "LOAN_SCORE_001",
    "message": "Your credit score does not meet the minimum requirement",
    "details": { "minimumScore": 350, "currentScore": 280 },
    "requestId": "req_abc123",
    "timestamp": "2024-02-15T10:30:00Z"
  }
}
```

### 9. Logging Standards

Structured logging for debugging, monitoring, and compliance.

**What to ALWAYS Log**
```typescript
// Required fields in every log entry
interface LogEntry {
  timestamp: string;        // ISO8601
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  service: string;          // e.g., "payment-service"
  requestId: string;        // Correlation ID
  userId?: string;          // Authenticated user (if applicable)
  action: string;           // e.g., "loan.apply", "payment.process"
  status: 'started' | 'completed' | 'failed';
  duration?: number;        // Milliseconds
  metadata?: object;        // Additional context
}

// Example
logger.info({
  action: 'loan.apply',
  status: 'completed',
  userId: 'usr_123',
  requestId: 'req_abc',
  duration: 245,
  metadata: { loanId: 'loan_456', amount: 500 }
});
```

**What to NEVER Log**
```typescript
// FORBIDDEN - Never log these fields
const NEVER_LOG = [
  'password',
  'pin',
  'otp',
  'token',
  'secret',
  'national_id',        // Full ID - use masked version
  'phone_number',       // Full number - use masked version
  'card_number',
  'cvv',
  'biometric_data',
  'face_image',
  'id_document_image',
];

// Use masking for partial logging
const maskPhone = (phone: string) => phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
const maskId = (id: string) => id.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2');

// Example: Log masked data
logger.info({
  action: 'kyc.verify',
  phone: maskPhone('+263771234567'),  // +263****567
  nationalId: maskId('12345678A90'),  // 12******90
});
```

**Log Levels**
```yaml
DEBUG: Detailed debugging info (dev/staging only)
INFO:  Normal operations, business events
WARN:  Potential issues, degraded performance
ERROR: Failures requiring attention
```

### 10. Environment Guidelines

Environment-specific configurations and behaviors.

**Environment Definitions**
```yaml
development:
  purpose: Local development and testing
  data: Synthetic test data only
  external_apis: Mocked or sandbox
  logging: DEBUG level, verbose
  features: All features enabled

staging:
  purpose: Pre-production testing, QA
  data: Anonymized production-like data
  external_apis: Sandbox/test environments
  logging: INFO level
  features: Feature flags respected

production:
  purpose: Live customer-facing system
  data: Real customer data
  external_apis: Live endpoints
  logging: INFO level, no DEBUG
  features: Feature flags control rollout
```

**Environment-Specific Rules**
```typescript
// Never do this in production
if (process.env.NODE_ENV === 'production') {
  // ❌ NEVER enable debug logging
  // ❌ NEVER use test/mock APIs
  // ❌ NEVER skip authentication
  // ❌ NEVER disable rate limiting
  // ❌ NEVER expose stack traces
}

// Environment checks
const isDev = process.env.NODE_ENV === 'development';
const isStaging = process.env.NODE_ENV === 'staging';
const isProd = process.env.NODE_ENV === 'production';

// Example: Different behavior per environment
const getSmileIdentityConfig = () => ({
  baseUrl: isProd
    ? 'https://api.smileidentity.com'
    : 'https://testapi.smileidentity.com',
  partnerId: process.env.SMILE_PARTNER_ID,
});
```

### 11. API Versioning Strategy

Plan for API evolution without breaking clients.

**Versioning Approach**
```yaml
strategy: URL path versioning
format: /api/v{major}/resource
example: /api/v1/loans, /api/v2/loans
```

**Version Lifecycle**
```
v1 (Current)   → Active, fully supported
v2 (Next)      → In development, beta testing
v0 (Deprecated)→ 6-month sunset, migration required
```

**Breaking vs Non-Breaking Changes**
```yaml
# Non-breaking (no version bump)
- Adding new optional fields to response
- Adding new endpoints
- Adding new optional query parameters
- Performance improvements

# Breaking (requires version bump)
- Removing fields from response
- Changing field types
- Renaming fields
- Changing authentication method
- Removing endpoints
```

**Deprecation Process**
```typescript
// Add deprecation headers
res.setHeader('Deprecation', 'true');
res.setHeader('Sunset', 'Sat, 01 Jun 2025 00:00:00 GMT');
res.setHeader('Link', '</api/v2/loans>; rel="successor-version"');

// Log deprecated endpoint usage
logger.warn({
  action: 'api.deprecated',
  endpoint: '/api/v1/loans',
  userId: req.userId,
  message: 'Client using deprecated API version'
});
```

### 12. Feature Flags

Control feature rollout and enable safe deployments.

**Feature Flag Categories**
```typescript
enum FeatureFlagCategory {
  RELEASE = 'release',      // New features being rolled out
  EXPERIMENT = 'experiment', // A/B tests
  OPS = 'ops',              // Operational controls
  PERMISSION = 'permission', // Access control
}

// Feature flag definitions
const FEATURE_FLAGS = {
  // Release flags
  'new-credit-scoring-v2': {
    category: 'release',
    description: 'New ML-based credit scoring algorithm',
    defaultValue: false,
  },

  // Operational flags
  'ecocash-payments-enabled': {
    category: 'ops',
    description: 'Enable EcoCash payment processing',
    defaultValue: true,
  },

  // Kill switches
  'loan-applications-enabled': {
    category: 'ops',
    description: 'Master switch for loan applications',
    defaultValue: true,
  },
};
```

**Usage Pattern**
```typescript
// Check feature flag before executing feature
if (await featureFlags.isEnabled('new-credit-scoring-v2', { userId })) {
  return calculateScoreV2(customer);
} else {
  return calculateScoreV1(customer);
}

// Percentage rollout
if (await featureFlags.isEnabled('new-dashboard', {
  userId,
  percentage: 10, // 10% of users
})) {
  return <NewDashboard />;
}
```

**Feature Flag Rules**
```markdown
1. Every new feature MUST have a feature flag
2. Flags MUST have clear naming and documentation
3. Flags MUST be removed after full rollout (no permanent flags)
4. Critical features MUST have kill switches
5. Flag changes MUST be logged for audit
```

### 13. Monitoring & Alerting

Define what we monitor and when we alert.

**Service Level Objectives (SLOs)**
```yaml
availability:
  target: 99.9%
  measurement: Successful requests / Total requests

latency:
  p50: 100ms
  p95: 300ms
  p99: 1000ms

error_rate:
  target: < 0.1%
  critical: > 1%
```

**Key Metrics to Monitor**
```yaml
# Business Metrics
- loan_applications_submitted
- loan_applications_approved
- loan_applications_rejected
- payments_processed
- payments_failed
- active_loans_count
- total_disbursed_amount

# Technical Metrics
- request_count
- request_duration_ms
- error_count
- database_connection_count
- lambda_cold_starts
- lambda_duration_ms
- lambda_memory_used_mb

# Security Metrics
- failed_login_attempts
- rate_limit_hits
- suspicious_activity_flags
```

**Alert Thresholds**
```yaml
critical: # Page on-call immediately
  - error_rate > 5%
  - availability < 99%
  - payment_service_down
  - database_connection_failed
  - security_breach_detected

warning: # Notify in Slack
  - error_rate > 1%
  - p95_latency > 500ms
  - lambda_cold_start_rate > 10%
  - disk_usage > 80%

info: # Log for review
  - deployment_completed
  - feature_flag_changed
  - new_customer_registered
```

**Dashboard Requirements**
```markdown
1. Real-time overview dashboard (refreshes every 30s)
2. Business metrics dashboard (daily/weekly/monthly)
3. Technical health dashboard (per-service)
4. Security events dashboard
5. Cost monitoring dashboard (AWS spend)
```

### 14. Zimbabwe Regulatory Compliance

Specific requirements for operating in Zimbabwe.

**Reserve Bank of Zimbabwe (RBZ) Requirements**
```yaml
kyc_requirements:
  - National ID verification (mandatory)
  - Proof of residence (for loans > $500)
  - Source of income declaration (for loans > $1000)

transaction_limits:
  daily_limit: $5000 USD equivalent
  monthly_limit: $50000 USD equivalent
  single_transaction: $2000 USD equivalent

record_retention:
  transaction_records: 7 years
  kyc_documents: 10 years
  audit_logs: 5 years

reporting:
  - Suspicious Transaction Reports (STRs) within 24 hours
  - Monthly transaction reports to RBZ
  - Annual compliance audit
```

**Multi-Currency Handling**
```typescript
// Supported currencies
type Currency = 'USD' | 'ZWL' | 'ZAR';

// Always store amounts in cents/smallest unit
interface Money {
  amount: number;      // In cents
  currency: Currency;
}

// Exchange rate handling
interface ExchangeRate {
  from: Currency;
  to: Currency;
  rate: number;
  timestamp: Date;
  source: 'RBZ' | 'INTERBANK';
}

// Display formatting
const formatMoney = (money: Money): string => {
  const amount = money.amount / 100;
  switch (money.currency) {
    case 'USD': return `$${amount.toFixed(2)}`;
    case 'ZWL': return `ZWL ${amount.toFixed(2)}`;
    case 'ZAR': return `R${amount.toFixed(2)}`;
  }
};
```

**Mobile Money Integration Requirements**
```yaml
ecocash:
  provider: Econet Wireless
  api_version: v2
  sandbox_url: https://sandbox.ecocash.co.zw
  production_url: https://api.ecocash.co.zw
  timeout: 30 seconds
  retry_attempts: 3

onemoney:
  provider: NetOne
  api_version: v1
  sandbox_url: https://sandbox.onemoney.co.zw
  production_url: https://api.onemoney.co.zw
  timeout: 30 seconds
  retry_attempts: 3

innbucks:
  provider: InnBucks
  api_version: v1
  integration: Pending
```

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
├── infrastructure/          # AWS CloudFormation, SAM templates
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

# AWS Lambda (SAM)
sam build --cached --parallel    # Build Lambda functions
sam deploy --config-env dev     # Deploy to development
sam deploy --config-env staging # Deploy to staging
sam deploy --config-env production # Deploy to production
sam local start-api --port 3000 # Run API locally

# Database (RDS)
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"  # Run migrations against RDS
pnpm db:migrate                 # Run migrations (local)
pnpm db:seed                    # Seed test data

# Infrastructure (CloudFormation)
bash infrastructure/aws/scripts/deploy-infrastructure.sh  # Deploy all stacks
```

## External Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| AWS RDS PostgreSQL 16 | Database | `docs/deployment/AWS-SETUP-GUIDE.md` |
| Amazon Cognito | Authentication | `docs/deployment/AWS-SETUP-GUIDE.md` |
| S3 | File storage (KYC docs, ML models) | `infrastructure/aws/storage-buckets.yaml` |
| SQS | Async message queues | `infrastructure/aws/sqs-queues.yaml` |
| CloudFront + WAF | CDN + Security | `docs/infrastructure/PRODUCTION-NETWORK-ARCHITECTURE.md` |
| WhatsApp Cloud API | Customer messaging | `docs/guides/WHATSAPP-CLOUD-API-SETUP.md` |
| Smile Identity | KYC verification | `services/kyc-service/README.md` |
| EcoCash/OneMoney | Mobile payments | `services/payment-service/README.md` |
| Trustonic | Device lock | `services/lock-service/README.md` |

---

## AWS Deployment & CI/CD Rules

Hard-won rules from production deployment debugging. **Follow these exactly.**

### CloudFormation Stack Architecture

The production environment uses these stacks:

| Stack | Purpose | Resources |
|-------|---------|-----------|
| `lynia-finance-prod` | **Main stack** — all Lambda functions, API Gateway, Cognito authorizer | ~60 resources |
| `production-lynia-sqs` | SQS queues (7 main + 7 DLQ) | 14 queues + alarms |
| `production-lynia-fineract-ecs` | Fineract core banking on ECS Fargate | ECS service + ALB |
| `production-lynia-fineract-monitoring` | Fineract ECS monitoring dashboard + alarms | Dashboard + 6 alarms |
| `production-lynia-cognito` | Cognito User Pool | Auth infrastructure |
| `lynia-rds-production` | PostgreSQL 16 database | RDS instance |
| `production-lynia-vpc` | VPC with private subnets | Network layer |
| `lynia-finance-prod-frontend` | Admin portal + distributor dashboard (S3+CloudFront) | Frontend assets |
| `lynia-finance-production-waf` | WAF rules for API Gateway and CloudFront | Security rules |

### CRITICAL: Resource Naming Across Stacks

**NEVER create a resource with an explicit name (`FunctionName`, `DashboardName`, `QueueName`, etc.) that already exists in another stack.** CloudFormation's `AWS::EarlyValidation::ResourceExistenceCheck` (enabled Nov 2025) will block the changeset.

Before adding a named resource to `template.yaml`:
```bash
# Check if a Lambda with that name already exists
aws lambda get-function --function-name ${ENVIRONMENT}-lynia-${NAME} 2>/dev/null

# Check if a CloudWatch dashboard exists
aws cloudwatch list-dashboards --dashboard-name-prefix ${ENVIRONMENT}-lynia-${NAME}

# If it exists in another stack, either:
# 1. Delete the other stack first (if consolidating)
# 2. Use a different name
# 3. Remove the explicit name (let CloudFormation auto-generate)
```

### GitHub Actions Secrets — Shell-Level Fallbacks

**NEVER use `${{ secrets.X || 'default' }}` in GitHub Actions.** It does not reliably handle undefined/empty secrets.

Instead, pass secrets as environment variables and use shell `${VAR:-default}`:

```yaml
# WRONG — unreliable for empty/undefined secrets:
"WhatsAppPhoneNumberId=${{ secrets.PRODUCTION_WHATSAPP_PHONE_ID || 'placeholder' }}"

# CORRECT — shell catches empty strings:
- name: SAM Deploy
  run: |
    WA_PHONE="${WHATSAPP_PHONE_ID:-placeholder}"
    sam deploy --parameter-overrides "WhatsAppPhoneNumberId=${WA_PHONE}" ...
  env:
    WHATSAPP_PHONE_ID: ${{ secrets.PRODUCTION_WHATSAPP_PHONE_ID }}
```

### SAM Validate & cfn-lint

- `sam validate` (even without `--lint`) runs cfn-lint internally in newer SAM CLI versions
- Make `sam validate` non-blocking: `sam validate 2>&1 || true`
- Run `cfn-lint` separately with explicit ignore flags: `cfn-lint template.yaml -i E3004 W8001`
- **E3004** (circular dependency): Known SAM false positive — API Gateway ↔ Lambda with API events. Break the cycle using template Parameters for inter-service URLs instead of `!Ref ApiGateway` in env vars
- **W8001** (unused condition): Suppress if the condition is reserved for future use
- `.cfnlintrc` in repo root provides local suppression

### SAM Deploy Flags for CI/CD

```yaml
# Staging: non-interactive, allow empty changesets
sam deploy --config-env staging --no-confirm-changeset --no-fail-on-empty-changeset

# Production: non-interactive, allow empty changesets, rollback on failure
sam deploy --config-env production --no-confirm-changeset --no-fail-on-empty-changeset --on-failure ROLLBACK
```

**`--no-confirm-changeset` is REQUIRED** for both environments because `samconfig.toml` has `confirm_changeset = true` for production.

### VPC & Infrastructure Parameter Resolution

VPC configuration is optional (controlled by `UseVPC` condition). When VPC stacks don't exist, parameters must still have valid placeholder values — SAM rejects empty `--parameter-overrides` values.

```bash
# Pattern: resolve from CloudFormation outputs, fall back to placeholders
SUBNET1="subnet-placeholder"
if aws cloudformation describe-stacks --stack-name ${ENV}-lynia-vpc &>/dev/null; then
  SUBNET1=$(aws cloudformation describe-stacks --stack-name ${ENV}-lynia-vpc \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet1Id'].OutputValue" --output text)
fi
```

Inter-service API URLs (`ScoringApiUrl`, `WhatsAppApiUrl`) must be resolved from the existing stack's outputs, not hardcoded:
```bash
API_BASE=$(aws cloudformation describe-stacks --stack-name lynia-finance-${ENV} \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text)
SCORING_API_URL="${API_BASE}scoring/calculate"
WHATSAPP_API_URL="${API_BASE}whatsapp/send"
```

### Stack Status Handling

| Status | Action |
|--------|--------|
| `CREATE_COMPLETE` / `UPDATE_COMPLETE` | Normal — deploy as usual |
| `UPDATE_ROLLBACK_COMPLETE` | Deployable — previous update failed but rolled back cleanly |
| `ROLLBACK_COMPLETE` | **Must delete stack first** — then redeploy from scratch |
| `DELETE_FAILED` | Manual intervention required |

```bash
# Auto-handle ROLLBACK_COMPLETE in CI/CD
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DOES_NOT_EXIST")
if [ "$STACK_STATUS" = "ROLLBACK_COMPLETE" ]; then
  aws cloudformation delete-stack --stack-name $STACK
  aws cloudformation wait stack-delete-complete --stack-name $STACK
fi
```

### IAM Permissions for Deploy User

The `github-actions-deploy` IAM user needs these permissions. If a deploy fails with `AccessDenied`, check this list:

- CloudFormation (full)
- Lambda (full)
- API Gateway (full)
- IAM (create/update roles and policies)
- S3 (SAM artifact bucket)
- CloudWatch (dashboards, alarms, metrics)
- SQS (`sqs:*` on `arn:aws:sqs:us-east-1:849695476598:*-lynia-*`)
- Cognito (read for parameter resolution)
- EC2 (VPC/subnet/SG describe for parameter resolution)
- Secrets Manager (read for Lambda environment)

### Pre-Deploy Checklist

Before triggering a production deployment:

```markdown
[ ] All changes committed and pushed to master
[ ] Staging deploy succeeded (run completes with all stages green)
[ ] No resource name conflicts (check Lambda names, dashboard names, queue names)
[ ] GitHub secrets configured for production environment (or shell fallbacks in place)
[ ] Stack is in a deployable state (not ROLLBACK_COMPLETE)
[ ] No pending destructive database migrations without rollback plan
```

### Production API Endpoints

| Gateway | ID | Base URL |
|---------|-----|----------|
| Main API | `kly80hrgca` | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/` |
| Fineract Proxy | Now consolidated into Main API | `/api/v1/fineract/*` routes |

Frontend CloudFront: `https://d1qwfy2tsdmpe4.cloudfront.net`

---

## Remember

> Every feature we build, every line of code we write, serves real people trying to build better lives. A mother buying a smartphone to start a small business. A farmer needing equipment financing. A young person accessing credit for the first time.
>
> Build with empathy. Ship with confidence. Scale with purpose.

**Financial inclusion is not just our product - it's our mission.**

---

## Auto-Update Master Branch

A `SessionStart` hook is configured in `.claude/settings.local.json` to
automatically update the local `master` branch every time a new Claude Code
session begins.

**How it works:**

1. On session start, `.claude/scripts/update-master.sh` runs automatically.
2. The script fetches `origin/master` and fast-forwards the local `master` ref.
3. If the network is unavailable or `master` has diverged, the update is
   gracefully skipped so it never blocks work.
4. The update happens without switching branches -- your current feature branch
   stays checked out.

**No manual intervention required.** Every Claude Code session starts with an
up-to-date `master` branch.

## GitHub Direct Connection (gh CLI)

Claude Code can interact with GitHub directly via the `gh` CLI instead of
relying solely on git commands. This enables creating PRs, checking CI status,
managing issues, and more through the GitHub API.

### Setup

Provide a GitHub Personal Access Token (PAT) with `repo` and `read:org` scopes:

```bash
# Option 1: Pass as environment variable
GH_TOKEN=ghp_xxx bash .claude/scripts/setup-gh.sh

# Option 2: Pass as argument
bash .claude/scripts/setup-gh.sh ghp_xxx
```

Create a token at: https://github.com/settings/tokens/new

### How it works

1. On session start, `.claude/scripts/ensure-gh.sh` installs `gh` if missing.
2. After every commit + push, `auto-push.sh` checks if `gh` is authenticated.
3. If authenticated, it creates a PR directly via `.claude/scripts/create-pr.sh`
   instead of waiting for the GitHub Actions workflow.
4. PRs are created against `master` with auto-merge enabled when available.

### Available gh operations

With `gh` authenticated, Claude can:
- `gh pr create/list/view/merge` -- Manage pull requests
- `gh issue create/list/view/close` -- Manage issues
- `gh run list/view/watch` -- Monitor CI/CD workflow runs
- `gh api` -- Call any GitHub REST or GraphQL API endpoint
- `gh repo view` -- View repository information

### Scripts

| Script | Purpose |
|--------|---------|
| `.claude/scripts/setup-gh.sh` | One-time `gh` authentication setup |
| `.claude/scripts/ensure-gh.sh` | Auto-install `gh` on session start |
| `.claude/scripts/create-pr.sh` | Create PR via GitHub API |

### Fallback behavior

When `gh` is not authenticated, the system falls back to the existing
`auto-merge-claude-branches.yml` GitHub Actions workflow, which creates PRs
automatically when pushes land on `claude/*` branches.
