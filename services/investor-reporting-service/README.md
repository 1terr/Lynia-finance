# Investor Reporting Service

Provides investor-grade financial metrics, portfolio analytics, loan tape exports, and borrowing base calculations. All data is sourced from the data warehouse (`dw` schema).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/investor/portfolio | Portfolio summary (PAR, NPL, outstanding) |
| GET | /api/v1/investor/vintages | Vintage cohort analysis |
| GET | /api/v1/investor/loan-tape | Full loan-level export (CSV/JSON) |
| GET | /api/v1/investor/borrowing-base | Borrowing base calculation |
| GET | /api/v1/investor/collections | Period collections detail |
| GET | /api/v1/investor/financials | Revenue, NIM, ROA summary |
| GET | /api/v1/investor/covenant-compliance | Covenant test results |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: Manual route map (`ROUTES` object with `method + path` keys)
- **Auth**: Cognito JWT (via API Gateway authorizer)

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Data warehouse schema (`dw.*` fact/dimension tables) |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/investor-reporting/ --no-coverage
```
