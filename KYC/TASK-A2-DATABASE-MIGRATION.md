# Task A2: Database Migration (Provider-Agnostic Columns)

> **Track:** A - KYC (Didit) Integration
> **Status:** Not Started
> **Priority:** High (blocks frontend display of Didit results)
> **Depends On:** None (can run in parallel with A1)
> **Estimated Effort:** Small

---

## Objective

Add provider-agnostic columns to `kyc_submissions` table so both Smile Identity and Didit results can be stored in a normalized format. Keep all existing columns for RBZ 7-year retention compliance.

## Tasks

### A2.1: Create Migration SQL
- **File:** `database/migrations/024_kyc_provider_columns.sql` (NEW)
- **Action:** Add columns to `kyc_submissions`:
  ```sql
  ALTER TABLE kyc_submissions ADD COLUMN kyc_provider VARCHAR(50) DEFAULT 'smile_identity';
  ALTER TABLE kyc_submissions ADD COLUMN provider_job_id VARCHAR(200);
  ALTER TABLE kyc_submissions ADD COLUMN provider_response JSONB;
  ALTER TABLE kyc_submissions ADD COLUMN provider_warnings JSONB;
  ```
- **Backfill:** Copy existing data:
  ```sql
  UPDATE kyc_submissions SET
    provider_job_id = verification_id,
    provider_response = smile_identity_response
  WHERE kyc_provider = 'smile_identity';
  ```
- **Indexes:**
  ```sql
  CREATE INDEX idx_kyc_provider ON kyc_submissions(kyc_provider);
  CREATE INDEX idx_kyc_provider_job_id ON kyc_submissions(provider_job_id);
  ```
- **Constraint:** Do NOT drop `smile_identity_response` or `verification_id` columns (RBZ retention)

### A2.2: Create `kyc_manual_reviews` Table (Fix Pre-existing Issue)
- **File:** Same migration file
- **Action:** The KYC callback handler inserts into `kyc_manual_reviews` but no migration creates it:
  ```sql
  CREATE TABLE IF NOT EXISTS kyc_manual_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_submission_id UUID REFERENCES kyc_submissions(id),
    customer_id UUID REFERENCES customers(id),
    assigned_to UUID REFERENCES admin_users(id),
    status VARCHAR(50) DEFAULT 'pending',
    reviewer_notes TEXT,
    reviewer_decision VARCHAR(50),
    sla_deadline TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX idx_manual_reviews_status ON kyc_manual_reviews(status);
  CREATE INDEX idx_manual_reviews_sla ON kyc_manual_reviews(sla_deadline);
  ```

### A2.3: Verify Migration on Staging DB
- **Action:** Run migration against staging RDS
- **Command:** `bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"`
- **Test:** Verify columns exist, indexes created, backfill complete

## Acceptance Criteria

- [ ] Migration adds 4 new columns to `kyc_submissions`
- [ ] Existing `smile_identity_response` and `verification_id` columns preserved
- [ ] Backfill populates `provider_job_id` and `provider_response` for existing rows
- [ ] `kyc_manual_reviews` table created
- [ ] Indexes created on `kyc_provider` and `provider_job_id`
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] Migration tested on staging DB

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `database/migrations/024_kyc_provider_columns.sql` | NEW - Provider columns + manual reviews table |
