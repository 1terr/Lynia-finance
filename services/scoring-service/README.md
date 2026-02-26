# Scoring Service

Calculates and retrieves credit scores for customers, and verifies organization membership for group-lending eligibility.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /scoring/calculate | Calculate credit score for a customer |
| POST | /scoring/verify-organization | Verify customer's organization membership |
| GET | /scoring/:customerId | Retrieve stored credit score for a customer |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: lambda-router (route map)
- **Auth**: Skipped (`skipAuth: true`) -- service-to-service calls only

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Customer data, score storage |
| Scoring algorithm (`./scoring/`) | Credit score computation logic |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/scoring/ --no-coverage

# Integration tests
npx jest tests/integration/scoring-service.test.ts --no-coverage

# Contract tests
npx jest tests/contract/scoring-service.contract.test.ts --no-coverage
```
