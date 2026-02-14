# P10-RBZ-T006: Report Validation Logic

**Task ID**: P10-RBZ-T006
**Phase**: Phase 10 — Fineract RBZ Reporting Engine
**Layer**: Backend
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Implement comprehensive validation logic for all RBZ report types to ensure data completeness, accuracy, and regulatory compliance before reports are submitted to the Reserve Bank of Zimbabwe.

## Deliverables
- `validateRBZReport` function in `services/shared/fineract-rbz-reporting.ts`

## Implementation Details
The `validateRBZReport(reportType, reportData)` function performs multi-layered validation on generated reports and returns a `RBZReportValidationResult` with errors, warnings, completeness score, and data source verification.

**Validation Layers:**

1. **Required Fields Validation** — Each report type has a defined set of mandatory fields. The validator checks that all required fields are present and non-null. Missing fields are added to the errors array with descriptive messages indicating which field is missing and why it is required.

2. **GL Trial Balance Balance Check** — For `gl_trial_balance` reports, the validator verifies that total debits equal total credits across all GL accounts. An imbalanced trial balance is flagged as a critical error since it indicates a fundamental accounting issue that must be resolved before submission.

3. **Capital Adequacy Compliance Check** — For `capital_adequacy` reports, the validator checks that the calculated Capital Adequacy Ratio (CAR) meets the RBZ minimum threshold of 12%. A CAR below 12% generates a critical error. A CAR between 12% and 15% generates a warning indicating the institution is approaching the minimum threshold.

4. **NPL Provisioning Validation** — For `npl_analysis` reports, the validator verifies that provision rates applied to each aging bucket match the RBZ-mandated minimum rates. Under-provisioned buckets are flagged as errors.

5. **Large Transaction Threshold Check** — For `large_transaction_report` reports, the validator confirms all included transactions exceed the $2,000 USD reporting threshold and that customer identification data is present for each transaction.

6. **STR Filing Deadline Check** — For `suspicious_transaction_report_enhanced` reports, the validator checks that the report was generated within 24 hours of the suspicious activity detection timestamp. Late filings are flagged as critical errors.

7. **Fineract Data Source Identification** — The validator identifies whether the report data originated from Fineract GL/journal entries, Lynia DB, or both. This information is stored in the `data_sources` field of the validation result for audit purposes. Reports sourced from Fineract's double-entry system are flagged with `fineract_sourced: true`.

8. **Completeness Score Calculation** — A completeness score from 0 to 100 is calculated based on:
   - Percentage of required fields present (weighted 60%)
   - Presence of optional but recommended fields (weighted 20%)
   - Data freshness — whether the underlying data is from the expected reporting period (weighted 10%)
   - Cross-reference completeness — whether linked data from other reports/sources is available (weighted 10%)

**Validation Result Structure:**
```typescript
{
  isValid: boolean;           // true only if zero errors
  errors: string[];           // Critical issues blocking submission
  warnings: string[];         // Non-blocking advisory items
  completenessScore: number;  // 0-100
  dataSources: string[];      // ['lynia_db', 'fineract_gl', etc.]
  validatedAt: string;        // ISO8601 timestamp
}
```

## Verification
- Validation correctly identifies missing required fields for all 11 report types
- GL trial balance imbalance is detected and reported as a critical error
- Capital adequacy below 12% is flagged as non-compliant
- Fineract-sourced reports are correctly identified in `dataSources`
- Completeness score calculation produces expected values for complete and incomplete reports
- 6 unit tests covering validation logic pass (see P10-RBZ-T008)
