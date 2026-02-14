# P10-RBZ-T007: Report Management Functions

**Task ID**: P10-RBZ-T007
**Phase**: Phase 10 — Fineract RBZ Reporting Engine
**Layer**: Backend
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Implement report lifecycle management functions for reviewing, submitting, and querying RBZ report history, enabling the full workflow from generation through regulatory submission with audit trail logging at every step.

## Deliverables
- `reviewReport`, `submitReportToRBZ`, `getRBZReportHistory` functions in `services/shared/fineract-rbz-reporting.ts`

## Implementation Details
Three management functions implement the complete report lifecycle after generation, covering the status transitions `generated → reviewed → submitted` with an alternative `reviewed → rejected` path.

**`reviewReport(reportId, reviewerId, decision, rejectionReason?)`:**
- Loads the report from `fineract_rbz_reports` and verifies it is in `generated` status
- If `decision` is `'approve'`: transitions status to `reviewed`, records `reviewed_by` (reviewer UUID) and `reviewed_at` timestamp
- If `decision` is `'reject'`: transitions status to `rejected`, records `reviewed_by`, `reviewed_at`, and `rejection_reason` (required for rejections)
- Validates that the reviewer is not the same user who generated the report (four-eyes principle)
- Recalculates the SHA-256 checksum and verifies it matches the stored checksum to detect any tampering between generation and review
- Logs the review action with structured logging: `{ action: 'rbz_report.review', reportId, reviewerId, decision, status: 'completed' }`
- Returns the updated report record

**`submitReportToRBZ(reportId, submitterId)`:**
- Loads the report from `fineract_rbz_reports` and verifies it is in `reviewed` status
- Verifies the report has a valid checksum that matches the current data (tamper detection)
- Transitions status to `submitted`, records `submitted_by` (submitter UUID) and `submitted_at` timestamp
- In production, this function would integrate with the RBZ electronic filing system; currently it marks the report as submitted and logs the action for the manual submission workflow
- Logs the submission action: `{ action: 'rbz_report.submit', reportId, submitterId, status: 'completed' }`
- Returns the updated report record with submission metadata

**`getRBZReportHistory(filters)`:**
- Queries `fineract_rbz_reports` with flexible filtering options:
  - `reportType` — Filter by specific report type
  - `frequency` — Filter by filing frequency (monthly/quarterly/annual)
  - `status` — Filter by current status
  - `dateFrom` / `dateTo` — Filter by reporting period date range
  - `generatedBy` — Filter by the user who generated the report
- Results are ordered by `reporting_period_start DESC` (most recent first)
- Supports pagination with `limit` and `offset` parameters
- Joins with `rbz_report_validations` to include validation status in results
- Returns array of report summaries (excludes full report `data` JSONB for performance; full data available via individual report fetch)

**Status Transition Rules:**
```
generating → generated     (automatic, on successful generation)
generated  → reviewed      (manual, via reviewReport with 'approve')
generated  → rejected      (manual, via reviewReport with 'reject')
reviewed   → submitted     (manual, via submitReportToRBZ)
submitted  → archived      (automatic, after retention period or manual)
rejected   → generated     (re-generation required, new report created)
```

**Audit Trail:**
- Every status transition is logged with the acting user, timestamp, and action details
- The `fineract_rbz_reports` table stores `generated_by`, `reviewed_by`, and `submitted_by` for complete chain of custody
- Checksum verification at each transition ensures data integrity throughout the lifecycle

## Verification
- Report review correctly transitions status and records reviewer information
- Report rejection requires a reason and is properly recorded
- Report submission verifies checksum integrity before accepting
- History query returns correctly filtered and paginated results
- Four-eyes principle enforced (generator cannot review own report)
- 4 unit tests covering report management pass (see P10-RBZ-T008)
