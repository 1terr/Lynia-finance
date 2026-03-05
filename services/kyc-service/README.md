# KYC Service

Manages Know Your Customer identity verification workflows — initiating checks via DIDIT, processing results, querying status, and retrying failed verifications.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /kyc/initiate | Initiate a KYC verification for a customer |
| POST | /kyc/callback | Receive verification results from DIDIT (legacy, unused — see note) |
| GET | /kyc/:customerId | Get KYC verification status for a customer |
| POST | /kyc/retry | Retry a failed KYC verification |

> **Note on `/kyc/callback`**: DIDIT uses **synchronous standalone APIs** (ID verification, passive liveness, face match), not webhooks. Results are returned inline during `/kyc/initiate`. The callback endpoint exists for historical reasons but is not called by DIDIT.

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: lambda-router (route map)
- **Auth**: Skipped (`skipAuth: true`) — includes external callback endpoint

### Verification Flow

```
POST /kyc/initiate
  → Upload ID + selfie images to DIDIT (3 API calls: id-verification, passive-liveness, face-match)
  → Results return synchronously (~5-10 seconds)
  → processKYCResult() updates kyc_submissions + customers tables
  → Sends WhatsApp notification with result
  → Returns submission ID + status
```

### Database Tables

- **`kyc_submissions`**: Stores each verification attempt. Key columns: `submitted_at`, `status`, `verification_decision`, `verification_confidence`, `face_match_score`, `liveness_score`, `kyc_provider`.
- **`customers`**: Updated with `kyc_status`, `kyc_verified_at`, `date_of_birth`, `gender` on successful verification.

> **Important**: The `kyc_submissions` table uses `submitted_at` (not `created_at`) for timestamps. The `customers` table uses `first_name`/`last_name` (not `full_name`).

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | KYC records, customer data |
| DIDIT | External KYC/identity verification provider (synchronous API) |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| DIDIT_API_KEY | DIDIT API key | Yes |
| DIDIT_WEBHOOK_SECRET | DIDIT webhook secret (legacy, not actively used) | Yes |

## Testing

```bash
# Contract tests
npx jest tests/contract/kyc-service.contract.test.ts --no-coverage

# Unit tests (callback handler)
npx jest tests/unit/kyc/callback-handler.test.ts --no-coverage

# Integration tests
npx jest tests/integration/kyc-service.test.ts --no-coverage
```

## Known Issues (Resolved 2026-03-05)

- **`created_at` column mismatch**: All handlers used `.order('created_at')` but the table has `submitted_at`. Fixed in commit `956f29f`.
- **`full_name` column mismatch**: `process-kyc-result.ts` set `full_name` on `customers` which has `first_name`/`last_name`. Fixed — field removed from update.
- **Silent DB failures**: `process-kyc-result.ts` discarded error returns from both DB updates. Fixed — error logging added.
