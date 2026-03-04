# KYC Service

Manages Know Your Customer identity verification workflows -- initiating checks via DIDIT, handling verification callbacks, querying status, and retrying failed verifications.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /kyc/initiate | Initiate a KYC verification for a customer |
| POST | /kyc/callback | Receive verification results from DIDIT |
| GET | /kyc/:customerId | Get KYC verification status for a customer |
| POST | /kyc/retry | Retry a failed KYC verification |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: lambda-router (route map)
- **Auth**: Skipped (`skipAuth: true`) -- includes external callback endpoint

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | KYC records, customer data |
| DIDIT | External KYC/identity verification provider |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| DIDIT_API_KEY | DIDIT API key | Yes |
| DIDIT_WEBHOOK_SECRET | DIDIT webhook secret | Yes |

## Testing

```bash
# Contract tests
npx jest tests/contract/kyc-service.contract.test.ts --no-coverage
```
