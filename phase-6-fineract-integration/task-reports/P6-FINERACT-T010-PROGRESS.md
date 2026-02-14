# P6-FINERACT-T010: Payment Service — Loan Application + Disbursement via Fineract

**Task ID**: P6-FINERACT-T010
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Service
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Implement the full loan lifecycle in Fineract — application creation, approval, and disbursement — mirroring loan state transitions in the Lynia system to maintain double-entry accounting integrity.

## Deliverables
- `services/shared/clients/fineract-sync.ts` (syncLoanToFineract, approveLoanInFineract, disburseLoanInFineract functions)

## Implementation Details
Three functions handle the complete loan lifecycle in Fineract. syncLoanToFineract creates a loan application in Fineract with the mapped clientId, productId, principal amount, repayment terms, and interest rate, corresponding to the loan creation event in Lynia. approveLoanInFineract transitions the Fineract loan from submitted status to approved, aligning with the internal approval decision. disburseLoanInFineract transitions the loan from approved to active, which triggers Fineract's automatic GL journal entry generation — debiting the loan portfolio asset account and crediting the fund source liability account. Each function updates the Lynia loans table with the corresponding Fineract IDs (fineract_loan_id, fineract_loan_account_no, fineract_product_id) and timestamps, and logs every operation to the fineract_sync_log table for full audit traceability. All three functions follow the same non-blocking error handling pattern established in T009, ensuring that Fineract outages do not prevent loan processing in the primary Lynia system.

## Verification
- All three functions (syncLoanToFineract, approveLoanInFineract, disburseLoanInFineract) are exported from `services/shared/clients/fineract-sync.ts`
- Each function updates the loans table with appropriate Fineract IDs on success
- Each function logs operations to fineract_sync_log
- Error paths are handled gracefully without blocking the calling service
