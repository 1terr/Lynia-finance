# P6-FINERACT-T013: Configure Fineract Loan Products (3 Tiers)

**Task ID**: P6-FINERACT-T013
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Config
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Define and provision three loan product tiers in Apache Fineract that align with Lynia's credit scoring system, ensuring each tier has appropriate limits, interest rates, and down payment requirements.

## Deliverables
- `phase-6-fineract-integration/config/loan-products.json`
- `phase-6-fineract-integration/config/setup-fineract-products.ts`

## Implementation Details
A JSON configuration file was created defining three loan product tiers that map directly to Lynia's credit scoring tiers. Tier 1 (Entry) targets scores 350-499 with loan amounts of $50-$200, 12-month terms, 5% monthly interest, and a 30% down payment requirement. Tier 2 (Standard) covers scores 500-649 with $200-$500 loans, 12-month terms, 4% monthly interest, and 20% down payment. Tier 3 (Premium) serves scores 650+ with $500-$2,000 loans, 18-month terms, 3% monthly interest, and 10% down payment. All three products use declining balance interest calculation, equal installment repayment schedules, and accrual-based accounting (accountingRule=3). The companion TypeScript setup script reads the JSON configuration and calls the Fineract Loan Products API to create each product with the correct GL account mappings. The script is idempotent — it queries existing products by external ID before attempting creation, skipping any that already exist.

## Verification
- JSON schema is valid and parseable with `JSON.parse()`.
- Setup script compiles successfully with `ts-node`.
- All three tiers have non-overlapping score ranges and loan amount ranges.
- Interest rates decrease as tier level increases (5% > 4% > 3%).
- Down payment percentages decrease as tier level increases (30% > 20% > 10%).
