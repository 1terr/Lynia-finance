# Appendix C: Technology Stack

**Audit Date:** February 15, 2026

---

## Frontend Stack

| Technology | Version | Purpose | Package |
|-----------|---------|---------|---------|
| Next.js | 14.2.18 | React framework with App Router | `next` |
| React | 18.3.1 | UI library | `react`, `react-dom` |
| TypeScript | 5.3.3 | Type safety | `typescript` |
| Tailwind CSS | 3.4.16 | Utility-first CSS framework | `tailwindcss` |
| Zustand | 4.5.0 | Client-side state management (auth) | `zustand` |
| TanStack React Query | 5.62.0 | Server state / data fetching | `@tanstack/react-query` |
| TanStack React Table | 8.20.0 | Data table with sorting/pagination | `@tanstack/react-table` |
| react-hook-form | 7.54.0 | Form state management | `react-hook-form` |
| zod | 3.24.0 | Schema validation | `zod` |
| Recharts | 2.14.0 | Chart library | `recharts` |
| Lucide React | 0.460.0 | Icon library (50+ icons) | `lucide-react` |
| amazon-cognito-identity-js | 6.3.12 | Cognito auth SDK | `amazon-cognito-identity-js` |
| date-fns | 3.x | Date formatting and manipulation | `date-fns` |

### Frontend Build Configuration

| Setting | Value |
|---------|-------|
| Build Output | Static export (`output: 'export'`) |
| SSR | Disabled (all client-side) |
| Code Splitting | Dynamic imports (`dynamic(() => import(), { ssr: false })`) |
| Strict Mode | TypeScript `strict: true` |
| Linting | ESLint with Next.js config |
| Formatting | Prettier |

---

## Testing Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Jest | 30.2.0 | Test runner |
| React Testing Library | 16.3.2 | Component testing |
| @testing-library/jest-dom | Latest | DOM assertions |
| @testing-library/user-event | Latest | User interaction simulation |

### Test Coverage (Known)

| Suite | Tests | Status |
|-------|-------|--------|
| Fineract UI Tests | 76 | PASSING |
| RBZ Compliance Tests | 57 | PASSING |
| **Total Known** | **133** | **PASSING** |

---

## Backend Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x | Lambda runtime |
| AWS Lambda | arm64 (Graviton2) | Serverless compute |
| AWS SAM | Latest | Infrastructure as Code |
| PostgreSQL | 16.11 | Primary database (RDS) |

### Lambda Function Configuration

| Function | Memory | Timeout | Runtime |
|----------|--------|---------|---------|
| Scoring Service | 1024 MB | 30s | Node.js 20 (arm64) |
| Payment Service | 1024 MB | 60s | Node.js 20 (arm64) |
| WhatsApp Service | 512 MB | 30s | Node.js 20 (arm64) |
| KYC Service | 512 MB | 30s | Node.js 20 (arm64) |
| Lock Service | 512 MB | 30s | Node.js 20 (arm64) |
| Notification Service | 512 MB | 30s | Node.js 20 (arm64) |
| Form Submission | 256 MB | 30s | Node.js 20 (arm64) |

---

## AWS Infrastructure

| Service | Configuration | Purpose |
|---------|--------------|---------|
| Amazon Cognito | LITE tier, 2 user pools | Authentication + MFA |
| API Gateway | REST, Regional, Cognito Authorizer | API routing |
| AWS WAF | 8 rules | Web application firewall |
| CloudFront | 3 distributions | CDN for frontends |
| S3 | 4+ buckets | Static hosting, KYC docs, models |
| RDS PostgreSQL | db.t4g.micro, 20GB, AES-256 | Primary database |
| SQS | 5 queues + 5 DLQs | Async message processing |
| Secrets Manager | 7 secrets | API keys, credentials |
| CloudWatch | Logs + Alarms | Monitoring |
| VPC | 10.0.0.0/16 | Network isolation |

### SQS Queue Configuration

| Queue | Purpose | DLQ |
|-------|---------|-----|
| Scoring Queue | Credit score calculation | Yes |
| Payment Queue | Payment processing | Yes |
| KYC Queue | Identity verification | Yes |
| Device Lock Queue | Lock/unlock commands | Yes |
| Notification Queue | Multi-channel alerts | Yes |

### S3 Bucket Configuration

| Bucket | Purpose | Encryption |
|--------|---------|-----------|
| Admin Portal | Static frontend hosting | AES-256 |
| KYC Documents | ID photos, selfies | KMS |
| Commission PDFs | Generated reports | AES-256 |
| ML Models | Credit scoring models | AES-256 |

### WAF Rules (8)

1. Rate limiting (global: 2000/5min)
2. Rate limiting (auth: 200/5min)
3. SQL injection protection
4. XSS protection
5. Known bad inputs
6. Size restrictions
7. Geo-blocking (optional)
8. IP reputation

---

## Planned Infrastructure (Not Yet Deployed)

| Service | Configuration | Purpose |
|---------|--------------|---------|
| ECS Fargate | 1 vCPU, 2GB | Apache Fineract container |
| Application Load Balancer | Internal, port 8443 | Fineract traffic routing |
| CloudWatch Dashboard | Fineract-specific | Fineract monitoring |
| EventBridge | 6-hour cron | Fineract reconciliation |

---

## External Services

| Service | Provider | Purpose | Integration Status |
|---------|----------|---------|-------------------|
| WhatsApp Cloud API | Meta | Customer messaging | Code complete |
| Smile Identity | Smile Identity | KYC verification | Code complete |
| EcoCash | Econet Wireless | Mobile money payments | Code complete |
| OneMoney | NetOne | Mobile money payments | Code complete |
| InnBucks | InnBucks | Mobile money payments | Pending |
| Trustonic | Trustonic | Device lock/unlock | Code complete |
| Twilio / Africa's Talking | Various | SMS fallback | Code complete |

---

## CI/CD Pipeline

| Stage | Tool | Trigger |
|-------|------|---------|
| Source | GitHub | Push to branch |
| Lint | ESLint + Prettier | PR check |
| Type Check | TypeScript `tsc --noEmit` | PR check |
| Unit Tests | Jest | PR check |
| Build | Next.js + SAM | PR check |
| Deploy (staging) | SAM + S3 sync | Merge to staging |
| Deploy (production) | SAM + S3 sync + CloudFront invalidation | Merge to master |

**Pipeline:** GitHub Actions with 6-stage workflow
**Auto-merge:** Claude branch PRs can be auto-merged via GitHub Actions workflow

---

## Development Tools

| Tool | Purpose |
|------|---------|
| pnpm | Package manager |
| ESLint | Code linting |
| Prettier | Code formatting |
| TypeScript | Type checking |
| AWS SAM CLI | Local Lambda testing |
| gh CLI | GitHub operations |
