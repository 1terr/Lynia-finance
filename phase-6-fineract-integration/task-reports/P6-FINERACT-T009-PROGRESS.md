# P6-FINERACT-T009: Scoring Service — Create Fineract Client on Approval

**Task ID**: P6-FINERACT-T009
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Service
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Implement automatic Fineract client creation when a Lynia customer is approved after KYC, ensuring non-blocking integration that does not disrupt the scoring workflow.

## Deliverables
- `services/shared/clients/fineract-sync.ts` (syncCustomerToFineract function)

## Implementation Details
The syncCustomerToFineract function in fineract-sync.ts handles creating a Fineract client record when a Lynia customer passes KYC and is approved by the scoring service. It maps the Lynia customer UUID as the Fineract externalId, sets firstName, lastName, and mobileNo from the customer record, and activates the client immediately upon creation. On successful creation, the function updates the customers table with the returned fineract_client_id and sets fineract_synced_at to the current timestamp. On failure, the error is logged to the fineract_sync_log table with full error details including the request payload and error message, but the failure does not block or roll back the scoring workflow. This non-blocking design ensures that Fineract availability issues never prevent customers from being approved in the Lynia system.

## Verification
- Function exists and is exported from `services/shared/clients/fineract-sync.ts`
- Handles the success path: creates Fineract client, updates customers table with fineract_client_id and fineract_synced_at
- Handles the failure path: logs error to fineract_sync_log, does not throw or block the calling workflow
