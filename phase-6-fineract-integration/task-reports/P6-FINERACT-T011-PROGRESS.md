# P6-FINERACT-T011: Payment Service — Post Repayments to Fineract

**Task ID**: P6-FINERACT-T011
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Service
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Implement repayment posting to Fineract when payment webhooks confirm successful repayments, ensuring that Fineract's general ledger stays in sync with actual cash receipts.

## Deliverables
- `services/shared/clients/fineract-sync.ts` (syncRepaymentToFineract function)

## Implementation Details
The syncRepaymentToFineract function posts a repayment transaction to Fineract when a payment webhook confirms that a customer repayment has been successfully received. It maps the Lynia payment UUID as the Fineract externalId for cross-reference traceability, and includes the transaction amount and payment date in the Fineract repayment request. On success, the function updates the payments table with the returned fineract_transaction_id and sets fineract_synced_at to the current timestamp. Fineract automatically generates the corresponding GL journal entries upon receiving the repayment — debiting the cash/bank account, crediting the loan receivable account, and crediting the interest income account as appropriate based on the loan schedule. Failed sync attempts are logged to the fineract_sync_log table with full error details and are designed to be retried by the reconciliation job (implemented separately), ensuring eventual consistency between Lynia and Fineract even during transient failures.

## Verification
- Function is exported from `services/shared/clients/fineract-sync.ts`
- Handles the full repayment posting lifecycle: maps payment data, calls Fineract, updates payments table
- On success: payments table updated with fineract_transaction_id and fineract_synced_at
- On failure: error logged to fineract_sync_log with retry-compatible metadata
