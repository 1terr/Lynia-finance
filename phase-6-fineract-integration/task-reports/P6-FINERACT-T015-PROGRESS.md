# P6-FINERACT-T015: Build Reconciliation Job (Lynia DB ↔ Fineract)

**Task ID**: P6-FINERACT-T015
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Job
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Build a scheduled reconciliation job that detects balance discrepancies between the Lynia database and Apache Fineract, and automatically retries failed synchronization operations.

## Deliverables
- `services/shared/clients/fineract-reconcile.ts`

## Implementation Details
A reconciliation function was implemented to run as an AWS Lambda triggered by EventBridge on a 6-hour schedule. The job operates in three steps. Step 1 (Balance Reconciliation): Queries all Lynia loans that have a fineract_loan_id, fetches each loan's current balance from the Fineract Loans API, and compares outstanding amounts using a $0.01 tolerance threshold. Discrepancies are classified into three severity levels — low (less than $5 or under 2% variance), medium ($5-$50 or 2-10% variance), and high (greater than $50 or over 10% variance). Step 2 (Failed Sync Retry): Retrieves up to 50 entries from the fineract_sync_log table where status is 'failed' and attempt_number is below the maximum retry threshold of 3. The retry logic supports five operation types: client creation, loan creation, loan approval, loan disbursement, and repayment posting, re-invoking the appropriate Fineract API call for each. Step 3 (Summary Reporting): Returns a typed ReconciliationResult object containing counts for matched loans, discrepant loans (broken down by severity), failed balance checks, total retries attempted, and successful retries. The module exports a reconciliationHandler function for direct Lambda invocation via the standard API Gateway/EventBridge event shape.

## Verification
- Function compiles without TypeScript errors.
- The reconciliationHandler export returns the correct ReconciliationResult response shape.
- Discrepancy classification thresholds are correctly implemented (low/medium/high).
- Retry logic respects the max_attempts limit of 3.
