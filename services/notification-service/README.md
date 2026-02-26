# Notification Service

Sends multi-channel notifications (WhatsApp, SMS, email) and manages scheduled payment reminders via EventBridge cron triggers. Supports reminder opt-in/opt-out and analytics.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /notifications/send | Send a notification via specified channel |
| POST | /notifications/reminders/process | Manually trigger payment reminder processing |
| GET | /notifications/reminders/analytics | Get reminder delivery analytics |
| POST | /notifications/reminders/opt-out | Opt a customer out of reminders |
| POST | /notifications/reminders/opt-in | Opt a customer in to reminders |
| GET | /notifications/:customerId | Get notification history for a customer |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway + EventBridge (scheduled cron for reminders)
- **Router**: Manual if/else path matching
- **Auth**: None at handler level

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Customer data, notification records |
| WhatsApp Service | Send WhatsApp notifications (via internal API) |
| EventBridge | Scheduled payment reminder triggers |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| WHATSAPP_API_URL | Internal WhatsApp service URL | Yes |

## Testing

```bash
# Integration tests
npx jest tests/integration/data-flow/notification-delivery.test.ts --no-coverage

# Contract tests
npx jest tests/contract/notification-service.contract.test.ts --no-coverage
```
