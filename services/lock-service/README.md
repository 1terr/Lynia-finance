# Lock Service

Manages device lock/unlock operations via Trustonic integration and orchestrates the full device handover workflow -- from readiness checks through identity verification, deposit confirmation, condition inspection, and handover completion.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /locks/lock | Lock a device |
| POST | /locks/unlock | Unlock a device |
| POST | /locks/process-scheduled | Process automated/scheduled lock operations |
| GET | /locks/:deviceId | Get lock status for a device |
| POST | /handovers/check-readiness | Check if a loan is ready for device handover |
| POST | /handovers/initiate | Initiate device handover workflow |
| POST | /handovers/verify-identity | Verify customer identity at handover |
| POST | /handovers/verify-deposit | Verify deposit payment (critical checkpoint) |
| POST | /handovers/device-condition | Record device condition inspection |
| POST | /handovers/complete | Complete handover and activate loan |
| GET | /handovers/:handoverId | Get handover status |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: Manual if/else path matching
- **Auth**: None at handler level

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | Device records, handover state, lock history |
| Trustonic API | Remote device lock/unlock |
| HandoverService (`./handover-service`) | Handover workflow orchestration |
| LockManagementService (`./lock-management-service`) | Lock/unlock operations |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| TRUSTONIC_API_URL | Trustonic API endpoint | Yes |
| TRUSTONIC_API_KEY | Trustonic API key | Yes |

## Testing

```bash
# Contract tests
npx jest tests/contract/lock-service.contract.test.ts --no-coverage

# E2E tests
npx jest tests/e2e/e2e-003-device-lock-flow.test.ts --no-coverage
```
