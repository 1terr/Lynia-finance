# Lynia Finance Services

Microservices for the Lynia Finance platform.

## Services

- **scoring-service**: Credit scoring algorithm (5-component affordability model)
- **whatsapp-service**: WhatsApp bot conversation flow
- **kyc-service**: KYC verification with Smile Identity
- **payment-service**: Mobile money payment processing
- **lock-service**: Device lock/unlock management
- **notification-service**: Multi-channel notifications

## Development

```bash
# Install dependencies
pnpm install

# Run all services in dev mode
pnpm dev

# Run specific service
cd scoring-service
pnpm dev

# Run tests
pnpm test
```

See individual service README files for detailed documentation.
