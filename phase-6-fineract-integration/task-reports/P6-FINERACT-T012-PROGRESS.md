# P6-FINERACT-T012: WhatsApp Service — Query Fineract for Balances & Schedules

**Task ID**: P6-FINERACT-T012
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Service
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Implement query functions that enable the WhatsApp service to fetch real-time loan balance and repayment schedule data from Fineract, with graceful fallback to cached Lynia database data when Fineract is unavailable.

## Deliverables
- `services/shared/clients/fineract-sync.ts` (getFineractLoanBalance, getFineractRepaymentSchedule functions)

## Implementation Details
Two query functions enable the WhatsApp service to provide customers with real-time loan information sourced from Fineract's authoritative ledger. getFineractLoanBalance retrieves the current loan state and returns a structured object containing principalOutstanding, interestOutstanding, totalOutstanding, totalPaid, nextDueDate, and nextDueAmount — all formatted for clear WhatsApp message display using the currency and date formatting conventions established in the Fineract HTTP client. getFineractRepaymentSchedule returns a simplified array of repayment periods, each containing the due date, expected amount, paid amount, and completion status, making it straightforward for the WhatsApp service to render a human-readable schedule. Both functions gracefully return null if Fineract is unavailable (network error, circuit breaker open, timeout), allowing the WhatsApp service to detect the null response and fall back to serving cached data from the Lynia database. This resilient design ensures that customers always receive balance and schedule information, even during Fineract maintenance windows or outages.

## Verification
- Both functions (getFineractLoanBalance, getFineractRepaymentSchedule) are exported from `services/shared/clients/fineract-sync.ts`
- getFineractLoanBalance returns correctly shaped data with all required fields (principalOutstanding, interestOutstanding, totalOutstanding, totalPaid, nextDueDate, nextDueAmount)
- getFineractRepaymentSchedule returns an array of repayment periods with due dates, amounts, and completion status
- Both functions return null when Fineract is unavailable, enabling fallback behavior
