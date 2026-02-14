# P6-FINERACT-T014: Configure Chart of Accounts and GL Mappings

**Task ID**: P6-FINERACT-T014
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Config
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Define a complete chart of accounts and general ledger mappings for Fineract's accounting engine, enabling accurate double-entry bookkeeping for all loan financial events.

## Deliverables
- `phase-6-fineract-integration/config/chart-of-accounts.json`

## Implementation Details
A comprehensive JSON configuration was created defining 19 GL accounts across 5 account types. Assets include Cash & Bank (1001), Loan Portfolio (1100), Interest Receivable (1200), Fee Receivable (1300), and Penalty Receivable (1400). Liabilities include Overpayment Liability (2001) and Transfers in Suspense (2100). Equity contains Opening Balance (3001). Income accounts cover Interest (4001), Fee (4002), Penalty (4003), and Recovery (4004). Expense accounts include Write-Off (5001) and Provision (5002). Each account is structured with a parent-child hierarchy using header accounts (usage=1) as category groupings and detail accounts (usage=2) as transactional accounts. The configuration includes a dedicated loanProductAccountMappings section that maps Fineract financial events (fund source, loan portfolio, interest receivable, fees receivable, penalties receivable, income from interest, income from fees, income from penalties, losses written off, overpayment liability, and transfers in suspense) to their corresponding GL codes. The setup script from T013 consumes this configuration and creates accounts in Fineract via the GL Account API, respecting the parent-child creation order to ensure referential integrity.

## Verification
- JSON is valid and parseable without errors.
- All 19 GL codes are unique with no duplicates.
- All parent references resolve to existing header accounts in the configuration.
- All 5 account types (Asset, Liability, Equity, Income, Expense) are represented.
- All required loan product account mappings reference valid detail-level GL codes.
