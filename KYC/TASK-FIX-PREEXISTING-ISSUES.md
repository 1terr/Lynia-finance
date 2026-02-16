# Task: Fix Pre-existing Issues

> **Track:** Cross-cutting
> **Status:** Not Started
> **Priority:** High (some block integration work)
> **Estimated Effort:** Medium

---

## Objective

Fix 6 pre-existing bugs and inconsistencies discovered during integration analysis. These must be resolved to ensure the pipeline works correctly.

## Issues

### Issue 1: Table Name Mismatch - KYC Verifications vs KYC Submissions
- **Problem:** Migration 013 alters `kyc_verifications` but runtime code uses `kyc_submissions`
- **Files:**
  - `database/migrations/013_manual_verification_fields.sql`
  - `services/kyc-service/src/index.ts`
- **Fix:** Determine which table exists in the actual database. If `kyc_submissions` (from migration 001), then migration 013 should reference `kyc_submissions` instead of `kyc_verifications`.
- **Action:** Create corrective migration OR fix migration 013 if not yet applied

### Issue 2: Column Name Mismatch - id_document_photo_url vs id_document_url
- **Problem:** KYC handler inserts `id_document_photo_url` but migration 001 defines `id_document_url`
- **Files:**
  - `services/kyc-service/src/index.ts`
  - `database/migrations/001_initial_schema.sql`
- **Fix:** Align code to use the column name from migration: `id_document_url`
- **Action:** Update insert statement in handler

### Issue 3: Missing `kyc_manual_reviews` Table
- **Problem:** KYC callback handler inserts into `kyc_manual_reviews` but no migration creates it
- **Files:** `services/kyc-service/src/index.ts`
- **Fix:** Included in Task A2 (migration 024) - will create the table
- **Status:** Will be resolved by Task A2

### Issue 4: WhatsApp Session Table Name
- **Problem:** Code uses `whatsapp_onboarding_sessions` but migration 001 defines `whatsapp_sessions`
- **Files:**
  - `services/whatsapp-service/src/onboarding.ts`
  - `database/migrations/001_initial_schema.sql`
- **Fix:** Determine which table exists. Code likely created a new table with the longer name. Either:
  a. Rename table in migration to match code, OR
  b. Update code to use `whatsapp_sessions`
- **Action:** Check actual DB, align code and migration

### Issue 5: i18n Not Wired into Onboarding
- **Problem:** `i18n.ts` has 47 translation keys but `onboarding.ts` uses hardcoded English
- **Files:**
  - `services/whatsapp-service/src/onboarding.ts`
  - `services/whatsapp-service/src/i18n.ts`
- **Fix:** Replace hardcoded strings with `t(key, lang)` calls. Part of Task C1.6 but should be done comprehensively.
- **Priority:** MEDIUM - can ship English-only initially, add i18n in follow-up

### Issue 6: SQS Lambda Triggers Commented Out
- **Problem:** All 6 SQS queue triggers in `template.yaml` are commented out
- **Files:** `template.yaml`
- **Fix:** Decide if KYC should be async (via SQS) or synchronous (current HTTP approach). The synchronous approach works but SQS would add retry resilience.
- **Priority:** LOW - current HTTP approach works, SQS is a future improvement
- **Action:** Document decision, keep commented out for now

## Acceptance Criteria

- [ ] Issue 1: Table name consistent between migrations and runtime code
- [ ] Issue 2: Column names match between insert statements and schema
- [ ] Issue 3: `kyc_manual_reviews` table created (via Task A2)
- [ ] Issue 4: WhatsApp session table name aligned
- [ ] Issue 5: Decision documented (i18n now or follow-up)
- [ ] Issue 6: Decision documented (SQS triggers deferred)
- [ ] No runtime errors from table/column mismatches

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `services/kyc-service/src/index.ts` | Fix column name reference |
| `database/migrations/013_manual_verification_fields.sql` | Fix table name OR create corrective migration |
| `services/whatsapp-service/src/onboarding.ts` | Align session table name |
