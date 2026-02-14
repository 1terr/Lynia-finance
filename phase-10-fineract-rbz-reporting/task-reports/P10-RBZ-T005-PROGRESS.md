# P10-RBZ-T005: Report Scheduler Lambda Handler

**Task ID**: P10-RBZ-T005
**Phase**: Phase 10 — Fineract RBZ Reporting Engine
**Layer**: Backend
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Implement an EventBridge-triggered Lambda handler that automates RBZ report generation on scheduled intervals (monthly, quarterly, annual) and supports on-demand report generation, with CSV export to S3 and validation result storage.

## Deliverables
- `services/shared/rbz-report-scheduler.ts`

## Implementation Details
Created ~230 lines implementing the report scheduler Lambda handler that integrates with AWS EventBridge for automated, time-based report generation.

**Lambda Handler (`handler`):**
- Entry point for EventBridge scheduled events and API Gateway on-demand requests
- Parses the event payload to determine schedule type (`monthly`, `quarterly`, `annual`, `on_demand`)
- For scheduled events: queries `rbz_report_schedules` table for enabled schedules matching the current frequency
- For on-demand events: accepts explicit `reportType` and `config` parameters
- Returns structured response with report ID, status, and any validation errors

**Schedule Processing:**
- `processScheduledReports(frequency)` — Fetches all enabled schedules for the given frequency from the database, calculates the reporting period based on the current date and frequency type, and generates each report in sequence
- Monthly schedules: reporting period is the previous calendar month (1st to last day)
- Quarterly schedules: reporting period is the previous quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Nov)
- Annual schedules: reporting period is the previous calendar year (Jan 1 to Dec 31)
- On-demand schedules: reporting period specified explicitly in the request config

**Report Generation Pipeline (per report):**
1. Calls `generateRBZReport` from the core engine to produce the report data
2. Calls the appropriate CSV export function from `rbz-report-export.ts` to produce the submission file
3. Uploads the CSV to S3 using the generated S3 key path
4. Calls `validateRBZReport` to run validation checks on the generated data
5. Stores validation results in `rbz_report_validations` table
6. Updates `rbz_report_schedules` with `last_run_at`, `last_run_status`, and calculated `next_run_at`
7. Logs the complete operation with structured logging (action, status, duration)

**Error Handling:**
- Each report in a batch is generated independently — a failure in one report does not block others
- Failed reports are logged with error details and the schedule is marked with `last_run_status: 'failed'`
- Retryable errors (database timeout, Fineract unavailable) are distinguished from permanent failures
- Lambda timeout is set to 5 minutes to accommodate complex reports with large datasets

**EventBridge Schedule Configuration:**
```yaml
Monthly:    cron(0 6 1 * ? *)         # 1st of every month at 06:00 UTC
Quarterly:  cron(0 6 1 1,4,7,10 ? *)  # 1st of Jan, Apr, Jul, Oct
Annual:     cron(0 6 15 1 ? *)        # January 15th each year
```

## Verification
- Lambda handler correctly processes EventBridge scheduled events for all frequency types
- On-demand report generation works via API Gateway trigger
- CSV files are exported and uploaded to S3 with correct key paths
- Validation results are stored in the database for every generated report
- Schedule tracking (last_run_at, next_run_at) is updated after each run
- 6 unit tests covering scheduler functionality pass (see P10-RBZ-T008)
