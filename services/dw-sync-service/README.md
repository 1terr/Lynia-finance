# DW Sync Service

Processes real-time business events from SQS and incrementally updates the data warehouse (`dw` schema) tables. Replaces nightly-only ETL for core fact tables, enabling real-time analytics. The nightly ETL still runs as a reconciliation safety net.

## Event Types

| Event Type | Description |
|------------|-------------|
| payment.confirmed | Upsert `fact_payment` + update `fact_loan` |
| loan.created | Upsert `fact_loan` + ensure dimension records |
| loan.disbursed | Upsert `fact_loan` |
| loan.status_changed | Upsert `fact_loan` |
| loan.written_off | Upsert `fact_loan` |
| kyc.completed | Upsert `fact_kyc` + update `dim_customer` |
| credit.scored | Upsert `fact_credit_decision` |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: SQS (batch processing with `Promise.allSettled`)
- **Router**: SQS dispatcher (switch on `eventType`)
- **Failure handling**: Re-throws on partial batch failure for SQS retry

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Source data + DW schema (`dw.*` tables) |
| SQS | Event queue for real-time sync triggers |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/dw-sync/ --no-coverage
```
