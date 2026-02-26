# Payment Service

Processes mobile money payments across multiple Zimbabwe providers (EcoCash, OneMoney, O'mari, InnBucks), handles provider webhooks for payment confirmations, and performs payment reconciliation.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /payments/initiate | Initiate a payment transaction |
| POST | /payments/webhook/ecocash | EcoCash payment callback |
| POST | /payments/webhook/onemoney | OneMoney payment callback |
| POST | /payments/webhook/omari | O'mari payment callback |
| POST | /payments/webhook/innbucks | InnBucks payment callback |
| GET | /payments/:paymentId | Get payment status by ID |
| POST | /payments/reconcile | Trigger payment reconciliation |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: lambda-router (route map)
- **Auth**: Skipped (`skipAuth: true`) -- includes external webhook endpoints

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Payment records, transaction history |
| EcoCash API | Econet Wireless mobile money |
| OneMoney API | NetOne mobile money |
| O'mari API | O'mari payment processing |
| InnBucks API | InnBucks payment processing |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| ECOCASH_API_URL | EcoCash API endpoint | Yes |
| ECOCASH_API_KEY | EcoCash API key | Yes |
| ONEMONEY_API_URL | OneMoney API endpoint | Yes |
| ONEMONEY_API_KEY | OneMoney API key | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/payment/ --no-coverage

# Integration tests
npx jest tests/integration/payment-service.test.ts --no-coverage

# Contract tests
npx jest tests/contract/payment-service.contract.test.ts --no-coverage

# E2E tests
npx jest tests/e2e/e2e-002-payment-collection.test.ts --no-coverage
```
