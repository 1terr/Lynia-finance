# WhatsApp Service

Handles all customer communication via the WhatsApp Cloud API -- sending messages, verifying webhooks, processing incoming messages through the onboarding flow, and routing loan commands.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /whatsapp/send | Send a text or template message to a customer |
| GET | /whatsapp/webhook | Meta webhook verification (hub.challenge handshake) |
| POST | /whatsapp/webhook | Receive and process incoming WhatsApp messages/statuses |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: Manual if/else path matching
- **Auth**: None (public webhook endpoint; Meta signature validation via HMAC-SHA256)

## Key Features

- Circuit breaker for WhatsApp Cloud API calls (5-failure threshold)
- Message deduplication via `whatsapp_message_id`
- Multi-layer input validation (sanitization, length, inappropriate language)
- Global command handling (HELP, CANCEL, BACK, CONTINUE)
- SQS retry queue for failed message sends

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Customer records, message history, session state |
| WhatsApp Cloud API | Send/receive messages via Meta Graph API |
| SQS | Retry queue for failed message deliveries |
| Onboarding module (`./onboarding`) | Multi-step customer onboarding flow |
| Loan commands module (`./loan-commands`) | Post-onboarding loan interactions |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| WHATSAPP_PHONE_NUMBER_ID | Meta phone number ID | Yes |
| WHATSAPP_ACCESS_TOKEN | Meta Cloud API access token | Yes |
| WHATSAPP_WEBHOOK_VERIFY_TOKEN | Webhook verification token | Yes |
| META_APP_SECRET | App secret for webhook signature validation | Yes (prod) |

## Testing

```bash
# Contract tests
npx jest tests/contract/whatsapp-service.contract.test.ts --no-coverage
```
