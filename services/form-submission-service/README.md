# Form Submission Service

Public-facing endpoint that handles website form submissions -- contact inquiries, partnership applications, and waitlist signups. No authentication required.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /forms/submit | Submit a form (type: `contact`, `partnership`, or `waitlist`) |

### Form Types

| Type | Required Fields | Description |
|------|----------------|-------------|
| contact | name, phone | General contact inquiry |
| partnership | name, phone, email, partner_type | Partnership application (distributor/b2b/other) |
| waitlist | phone | Join the product waitlist |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: Switch on `body.type` discriminator
- **Auth**: None (public endpoint, no Cognito authorizer)

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | `contact_submissions`, `partnership_applications`, `waitlist` tables |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/form-submission/ --no-coverage
```
