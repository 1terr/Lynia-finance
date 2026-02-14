# P10-RBZ-T002: Database Migration for Fineract RBZ Reporting Tables

**Task ID**: P10-RBZ-T002
**Phase**: Phase 10 — Fineract RBZ Reporting Engine
**Layer**: Database
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Create database migration 021 to provision the five new tables required by the Fineract RBZ reporting engine, with proper indexes, Row Level Security (RLS) policies, and 7-year retention annotations per RBZ Banking Act requirements.

## Deliverables
- `database/migrations/021_fineract_rbz_reporting.sql`

## Implementation Details
Migration 021 creates five new tables to support the full RBZ reporting lifecycle:

**Tables Created:**

1. **`fineract_rbz_reports`** — Primary report storage table
   - UUID primary key, `report_type` enum, `frequency` enum, `reporting_period_start`/`end` date range
   - `data` JSONB column storing the full report payload for each report type
   - `status` enum tracking lifecycle (`generating`, `generated`, `reviewed`, `submitted`, `rejected`, `archived`)
   - `checksum` (SHA-256) for tamper detection between generation and submission
   - `generated_by`, `reviewed_by`, `submitted_by` user tracking fields
   - `reviewed_at`, `submitted_at`, `rejection_reason` for audit trail
   - `fineract_sourced` boolean indicating whether data originated from Fineract GL
   - Indexes on `report_type`, `status`, `reporting_period_start`, and composite `(report_type, frequency, reporting_period_start)`

2. **`rbz_report_schedules`** — Automated report generation schedules
   - UUID primary key, `report_type`, `frequency`, `cron_expression`
   - `enabled` boolean, `last_run_at`, `next_run_at`, `last_run_status`
   - Index on `(enabled, next_run_at)` for efficient scheduler queries

3. **`rbz_report_validations`** — Validation results linked to reports
   - Foreign key to `fineract_rbz_reports`
   - `is_valid` boolean, `errors` JSONB array, `warnings` JSONB array
   - `completeness_score` integer (0-100), `data_sources` text array
   - `validated_at` timestamp

4. **`fineract_gl_snapshots`** — Point-in-time GL balance snapshots
   - `gl_account_id`, `gl_account_name`, `gl_account_type`
   - `opening_balance`, `closing_balance`, `total_debits`, `total_credits`
   - `snapshot_date` for historical lookups
   - Index on `(snapshot_date, gl_account_type)` for trial balance queries

5. **`large_transaction_alerts`** — Threshold breach monitoring
   - `payment_id` foreign key, `amount`, `currency`, `threshold`
   - `payment_channel`, `customer_id`, `alert_type` (large_transaction/suspicious)
   - `reviewed` boolean, `reviewed_by`, `reviewed_at`, `report_id` link
   - Index on `(reviewed, alert_type)` for unreviewed alert queries

**Security & Compliance:**
- All tables have RLS enabled with policies restricting access to authenticated users with appropriate roles
- UUID primary keys on all tables (prevents enumeration attacks per CLAUDE.md)
- All tables annotated with `COMMENT ON TABLE` specifying 7-year retention requirement per RBZ Banking Act Chapter 24:20
- `created_at` and `updated_at` timestamps with automatic trigger on all tables

## Verification
- SQL syntax validation passes with `psql` parser
- All 5 tables created with expected columns and constraints
- All indexes created for query performance optimization
- RLS policies enabled and properly configured on all tables
- 7-year retention comments present on all tables
