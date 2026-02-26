# Fineract Proxy Service

Backend proxy that serves the admin portal's Fineract UI pages. Queries both the Lynia PostgreSQL database and the internal Fineract ALB, returning merged/transformed responses for loan management, GL accounts, reconciliation, and reporting.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/fineract/loans | List all loans |
| GET | /api/v1/fineract/loans/pending | List pending loan applications |
| GET | /api/v1/fineract/loans/overdue | List overdue loans |
| GET | /api/v1/fineract/loans/aging-summary | Loan aging summary breakdown |
| GET | /api/v1/fineract/loans/:loanId | Get loan detail by ID |
| POST | /api/v1/fineract/loans/:loanId/approve | Approve a loan |
| POST | /api/v1/fineract/loans/:loanId/disburse | Disburse an approved loan |
| POST | /api/v1/fineract/loans/:loanId/repayment | Record a loan repayment |
| GET | /api/v1/fineract/loan-products | List loan products |
| GET | /api/v1/fineract/loan-products/:id | Get loan product by ID |
| GET | /api/v1/fineract/gl-accounts | List general ledger accounts |
| GET | /api/v1/fineract/journal-entries | List journal entries |
| GET | /api/v1/fineract/trial-balance | Get trial balance |
| GET | /api/v1/fineract/reconciliation | Get reconciliation status |
| POST | /api/v1/fineract/reconciliation/run | Run reconciliation process |
| GET | /api/v1/fineract/reports | List available reports |
| GET | /api/v1/fineract/reports/:name | Run a named report |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: lambda-router (route map)
- **Auth**: Skipped at handler level (`skipAuth: true`) -- Cognito enforced by API Gateway

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Lynia loan/customer data |
| Fineract (ECS ALB) | Core banking engine (loan lifecycle, GL, accounting) |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| FINERACT_BASE_URL | Internal Fineract ALB URL | Yes |
| FINERACT_USERNAME | Fineract API username | Yes |
| FINERACT_PASSWORD | Fineract API password | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/fineract-proxy/ --no-coverage

# Integration tests
npx jest tests/integration/fineract-proxy-service.test.ts --no-coverage
npx jest tests/integration/fineract-client.test.ts --no-coverage
```
