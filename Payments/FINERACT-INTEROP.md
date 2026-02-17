# Fineract Interoperation Module Integration

**Date:** 2026-02-17
**Status:** Implemented, feature-flagged (OFF by default)
**Feature Flag:** `FINERACT_USE_INTEROP=true`

---

## Overview

Fineract 1.13.0 ships with a built-in Mojaloop-compatible interoperation module (disabled by default). Enabling it gives Lynia:

1. **MSISDN-based party lookup** -- route payments by phone number
2. **Two-phase disbursements** -- PREPARE/COMMIT/RELEASE for safe fund transfers
3. **Mojaloop readiness** -- if Zimbabwe deploys a national payment switch

## Architecture

```
Lynia Lambda  -->  Fineract Interop API  -->  Internal Accounts
                   /interoperation/*          (savings/loan)

Future:
Lynia Lambda  -->  Fineract Interop API  -->  Mojaloop Switch  -->  Other FSPs
```

## API Methods Added to FineractClient

| Method | Endpoint | Description |
|--------|----------|-------------|
| `registerInteropParty()` | `POST /interoperation/parties/{type}/{id}` | Register MSISDN for party lookup |
| `lookupInteropParty()` | `GET /interoperation/parties/{type}/{id}` | Look up party by identifier |
| `deleteInteropParty()` | `DELETE /interoperation/parties/{type}/{id}` | Remove party registration |
| `prepareInteropTransfer()` | `POST /interoperation/transfers` | Phase 1: Reserve funds |
| `commitInteropTransfer()` | `PUT /interoperation/transfers/{id}` | Phase 2: Complete transfer |
| `releaseInteropTransfer()` | `PUT /interoperation/transfers/{id}` | Abort: Release reserved funds |
| `getInteropTransfer()` | `GET /interoperation/transfers/{id}` | Check transfer status |
| `interopHealthCheck()` | `GET /interoperation/health` | Verify interop module is active |

## Sync Integration

### Customer Sync (syncCustomerToFineract)
When `FINERACT_USE_INTEROP=true` and customer has a mobile number:
- After creating the Fineract client, register their MSISDN as an interop party
- Non-fatal: MSISDN registration failure doesn't block customer sync
- Logged in `fineract_sync_log` with operation `register_interop_party`

### Loan Disbursement (disburseLoanInFineract)
When `FINERACT_USE_INTEROP=true` and payee MSISDN + amount provided:
1. **PREPARE** -- reserve disbursement funds via interop
2. **COMMIT** -- complete the interop transfer
3. **Disburse** -- standard Fineract loan disbursement to update loan status
4. On failure: **RELEASE** to return reserved funds, queue retry

Falls back to standard disbursement when interop params not provided.

## Enabling Interop (Runbook)

### Prerequisites
- Fineract 1.13.0+ deployed (currently on ECS Fargate)
- Database access to Fineract schema

### Steps

1. **Enable in Fineract DB** (maintenance window):
```sql
UPDATE c_configuration
SET value = 'true', enabled = true
WHERE name = 'enable-payment-hub-integration';
```

2. **Verify health endpoint**:
```bash
curl -k -u admin:password \
  -H "Fineract-Platform-TenantId: default" \
  https://fineract-host:8443/fineract-provider/api/v1/interoperation/health
```

3. **Set environment variable** in Lambda configuration:
```yaml
FINERACT_USE_INTEROP: 'true'
FINERACT_FSP_ID: 'lynia-finance'  # optional, defaults to 'lynia-finance'
```

4. **Backfill existing MSISDNs** (one-time script):
```sql
-- Get customers with phone numbers but no interop registration
SELECT id, phone_number, fineract_client_id
FROM customers
WHERE fineract_client_id IS NOT NULL
  AND phone_number IS NOT NULL;
```
Then call `registerInteropParty()` for each.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FINERACT_USE_INTEROP` | `false` | Master switch for interop features |
| `FINERACT_FSP_ID` | `lynia-finance` | FSP identifier in Mojaloop network |
