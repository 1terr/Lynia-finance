# Distributor Service

Serves the distributor dashboard -- profile management, inventory visibility, device handover submissions, commission tracking, and dashboard statistics for field agents.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/distributor/profile | Get distributor profile |
| PATCH | /api/v1/distributor/profile | Update distributor profile |
| GET | /api/v1/distributor/stats | Get dashboard statistics |
| GET | /api/v1/distributor/inventory | Get assigned device inventory |
| GET | /api/v1/distributor/handovers | List handover records |
| POST | /api/v1/distributor/handovers | Submit a new device handover |
| POST | /api/v1/distributor/handovers/:id/:action | Perform handover action (e.g., complete, cancel) |
| GET | /api/v1/distributor/commissions | Get commission records |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: lambda-router (route map)
- **Auth**: Cognito JWT (enforced by lambda-router)

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Distributor profiles, inventory, handovers, commissions |
| Amazon Cognito | Distributor authentication |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| COGNITO_USER_POOL_ID | Cognito user pool for distributor auth | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/distributor/ --no-coverage

# E2E tests
npx jest tests/e2e/e2e-006-distributor-commission.test.ts --no-coverage
```
