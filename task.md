# Supabase to AWS Migration -- Complete Task List

> **Test-Driven | Scalable | Cost-Effective**
>
> Every task includes its acceptance tests. No task is "done" until tests pass.
> Infrastructure is right-sized for a bootstrap startup with a clear upgrade path to 10x scale.

---

## Table of Contents

- [Migration Principles](#migration-principles)
- [Cost Budget](#cost-budget)
- [Pre-Migration Tasks](#pre-migration-tasks)
- [Phase 1: Database Migration (RDS PostgreSQL)](#phase-1-database-migration-rds-postgresql)
- [Phase 2: Authentication Migration (Amazon Cognito)](#phase-2-authentication-migration-amazon-cognito)
- [Phase 3: RLS to Application-Layer Authorization](#phase-3-rls-to-application-layer-authorization)
- [Phase 4: Realtime Migration](#phase-4-realtime-migration)
- [Phase 5: Storage Migration (S3)](#phase-5-storage-migration-s3)
- [Phase 6: Frontend Migration](#phase-6-frontend-migration)
- [Phase 7: Cleanup and Decommission](#phase-7-cleanup-and-decommission)
- [Phase 8: Post-Migration Hardening](#phase-8-post-migration-hardening)
- [Rollback Playbook](#rollback-playbook)
- [Go/No-Go Gates](#gono-go-gates)

---

## Migration Principles

1. **Test First** -- Write the test, then write the migration code. Every task has a `Tests:` section that must pass before the task is marked complete.
2. **Incremental** -- Each phase is independently deployable and reversible. No big-bang cutover.
3. **Zero Data Loss** -- Dual-run periods with validation. Payment service migrated last.
4. **Cost-Conscious** -- Use free tiers, `fck-nat`, `db.t4g.micro`, reserved concurrency only where needed.
5. **One Service at a Time** -- Migrate in dependency order: notification -> lock -> whatsapp -> kyc -> scoring -> payment.

---

## Cost Budget

| Component | Year 1 (Free Tier) | Year 2+ |
|-----------|-------------------|---------|
| RDS `db.t4g.micro` (20 GB gp3) | $0/mo | $15.50/mo |
| Cognito (< 50k MAU) | $0/mo | $0/mo |
| `fck-nat` (replaces NAT Gateway) | $3.07/mo | $3.07/mo |
| Secrets Manager (7 secrets) | $2.80/mo | $2.80/mo |
| CloudWatch (custom metrics) | $3.00/mo | $5.00/mo |
| WAF (production only) | $11.00/mo | $11.00/mo |
| S3 + CloudFront | $0/mo | $5.50/mo |
| Lambda + API Gateway + SQS | $0/mo | $4.00/mo |
| **Monthly Total** | **~$20/mo** | **~$47/mo** |

Target: Under **$25/month Year 1**, under **$50/month Year 2+**.

---

## Pre-Migration Tasks

### PM-1: Baseline Performance Snapshot

Record current system metrics to compare post-migration.

**Tasks:**
- [ ] PM-1.1: Record current API latency baselines (p50, p95, p99) from CloudWatch
- [ ] PM-1.2: Record current error rates per service
- [ ] PM-1.3: Record current cold start frequency and duration
- [ ] PM-1.4: Document Supabase database size (`pg_stat_user_tables` row counts per table)
- [ ] PM-1.5: Export current test suite pass/fail status as the reference point

**Tests:**
```
test/migration/pm-baseline.test.ts
- Should produce a JSON baseline report
- Should include row counts for all 35+ tables
- Should include latency percentiles per endpoint
```

**Deliverable:** `migration/baselines/pre-migration-snapshot.json`

---

### PM-2: Full Supabase Backup

**Tasks:**
- [ ] PM-2.1: Run `pg_dump` of Supabase database (data + schema)
- [ ] PM-2.2: Export Supabase Auth users to CSV (`auth.users` table)
- [ ] PM-2.3: List and download all Supabase Storage objects (if any)
- [ ] PM-2.4: Store all backups in S3 bucket `lynia-migration-backups`
- [ ] PM-2.5: Verify backup integrity by restoring to a local PostgreSQL and running row count comparison

**Tests:**
```
scripts/migration/verify-backup.sh
- Row count of local restore matches Supabase for every table
- User count matches auth.users count
- No errors in pg_dump output
```

**Deliverable:** `s3://lynia-migration-backups/YYYY-MM-DD/` with `data.sql`, `users.csv`, `storage-manifest.json`

---

### PM-3: Create Migration Test Infrastructure

**Tasks:**
- [ ] PM-3.1: Create `tests/migration/` directory structure
- [ ] PM-3.2: Add migration-specific Jest config (`jest.migration.config.js`)
- [ ] PM-3.3: Create test helpers for spinning up/tearing down RDS test connections
- [ ] PM-3.4: Create test fixtures from current Supabase data (anonymized)
- [ ] PM-3.5: Add `pnpm test:migration` script to root `package.json`

**Tests:**
```
tests/migration/setup.test.ts
- Should connect to test database
- Should run a sample query
- Should properly clean up connections on teardown
```

**Deliverable:** Working `pnpm test:migration` command

---

## Phase 1: Database Migration (RDS PostgreSQL)

> **Goal:** All 6 Lambda services read/write from RDS instead of Supabase.
> **Estimated AWS Cost Delta:** +$0/mo (free tier) or +$15.50/mo (after free tier)

### 1.1: Provision RDS Instance via CloudFormation

**Tasks:**
- [ ] 1.1.1: Create `infrastructure/aws/rds.yaml` CloudFormation template
  - Engine: PostgreSQL 16.4
  - Instance: `db.t4g.micro` (dev/staging), `db.t4g.small` (production)
  - Storage: 20 GB gp3, auto-scaling to 100 GB
  - MultiAZ: production only
  - Backup: 35-day retention (production), 7-day (dev/staging)
  - Encryption: enabled (StorageEncrypted: true)
  - Public access: disabled
  - Performance Insights: production only
  - Deletion protection: production only
- [ ] 1.1.2: Create DB subnet group using existing private subnets from VPC stack
- [ ] 1.1.3: Create security group allowing port 5432 from Lambda SG only
- [ ] 1.1.4: Add stack outputs: `DatabaseEndpoint`, `DatabasePort`
- [ ] 1.1.5: Deploy to dev environment and verify instance is reachable from Lambda VPC

**Tests:**
```
tests/migration/phase1/rds-provision.test.ts
- CloudFormation template validates: `sam validate --lint`
- Security group allows inbound 5432 from Lambda SG only
- Security group blocks all other inbound traffic
- Database instance is NOT publicly accessible
- Storage encryption is enabled
- Instance class matches environment (micro for dev, small for prod)
```

**Deliverable:** Running RDS instance in dev VPC, accessible from Lambda functions

---

### 1.2: Pre-Migration SQL Adapter

**Tasks:**
- [ ] 1.2.1: Create `database/migrations/aws/000_pre_migration.sql`
  - Create `auth` schema stub with `auth.uid()` function (returns `current_setting('app.current_user_id')`)
  - Ensure `uuid-ossp` and `pg_trgm` extensions exist
- [ ] 1.2.2: Create `database/migrations/aws/018_remove_rls_for_aws.sql`
  - Disable RLS on all public tables
  - Drop `is_admin_or_manager()` and `is_admin_staff()` functions
  - Drop `auth` schema cascade
- [ ] 1.2.3: Create migration runner script `scripts/migration/run-migrations.sh`
  - Runs 000_pre_migration.sql first
  - Runs all 17 existing migrations in order
  - Runs 018_remove_rls_for_aws.sql last
  - Includes dry-run mode and error handling

**Tests:**
```
tests/migration/phase1/migrations.test.ts
- 000_pre_migration.sql creates auth.uid() function that returns a UUID
- All 17 migrations execute without errors on a fresh PostgreSQL 16 instance
- 018_remove_rls_for_aws.sql disables RLS on all tables
- auth schema is dropped after cleanup migration
- All tables, indexes, triggers, and constraints exist post-migration
- update_updated_at_column() trigger function works correctly
- uuid-ossp extension is available (SELECT uuid_generate_v4() succeeds)
- pg_trgm extension is available
```

**Deliverable:** All migrations run cleanly on a fresh RDS instance

---

### 1.3: Database Client Library

Replace `@supabase/supabase-js` with `pg` (node-postgres) in backend services.

**Tasks:**
- [ ] 1.3.1: Add `pg` and `@types/pg` to `services/shared/package.json`
- [ ] 1.3.2: Create `services/shared/clients/database.ts` with:
  - `getPool()` -- singleton connection pool (max 5 per Lambda instance)
  - `query<T>(sql, params)` -- returns `{ data: T[], error: Error | null }`
  - `queryOne<T>(sql, params)` -- returns `{ data: T | null, error: Error | null }`
  - `insert<T>(table, data)` -- parameterized INSERT RETURNING *
  - `update<T>(table, data, where)` -- parameterized UPDATE RETURNING *
  - `remove(table, where)` -- parameterized DELETE
  - `transaction(callback)` -- wraps operations in BEGIN/COMMIT/ROLLBACK
- [ ] 1.3.3: Create `services/shared/clients/database.types.ts` with TypeScript interfaces for all 35+ tables (generated from schema)
- [ ] 1.3.4: Implement connection retry logic with exponential backoff (3 retries, 1s/2s/4s)
- [ ] 1.3.5: Implement connection health check (`SELECT 1`)
- [ ] 1.3.6: Add connection pool metrics logging (active, idle, waiting)

**Tests:**
```
tests/migration/phase1/database-client.test.ts
- getPool() returns singleton (same instance on multiple calls)
- query() returns data array on success
- query() returns error on invalid SQL
- queryOne() returns single row or null
- insert() generates correct parameterized SQL (no SQL injection)
- insert() returns the inserted row
- update() generates correct SET and WHERE clauses
- update() with multiple WHERE conditions uses AND
- remove() generates correct DELETE with WHERE clause
- transaction() commits on success
- transaction() rolls back on error
- Connection pool respects max:5 limit
- Pool handles connection timeout gracefully
- Pool reconnects after transient failure (retry logic)
- All queries use parameterized values (never string concatenation)

tests/migration/phase1/database-client.integration.test.ts
- Can connect to actual RDS instance
- CRUD operations work against real database
- Transaction isolation works correctly
- Connection pool doesn't leak connections
- Pool metrics are logged correctly
```

**Deliverable:** `database.ts` passes all unit and integration tests, ready to replace Supabase client

---

### 1.4: Data Migration (Supabase -> RDS)

**Tasks:**
- [ ] 1.4.1: Create `scripts/migration/export-supabase.sh`
  - `pg_dump` with `--data-only --no-owner --no-privileges`
  - Exclude schemas: `auth`, `storage`, `realtime`, `supabase_functions`
  - Output to `migration/data/data_export.sql`
- [ ] 1.4.2: Create `scripts/migration/import-to-rds.sh`
  - Imports data into RDS
  - Handles sequence resets (so auto-increment continues correctly)
- [ ] 1.4.3: Create `scripts/migration/verify-data.sh`
  - Compares row counts per table between Supabase and RDS
  - Compares checksums of key columns (e.g., SUM of amounts, COUNT of statuses)
  - Generates a verification report
- [ ] 1.4.4: Run export/import on dev environment
- [ ] 1.4.5: Run verification and resolve any discrepancies

**Tests:**
```
tests/migration/phase1/data-integrity.test.ts
- Row count matches for every table (Supabase vs RDS)
- Customer credit_score values match
- Loan amounts and statuses match
- Payment totals match (SUM of amount column)
- All UUIDs transferred correctly (no truncation)
- All timestamps preserved (timezone-aware comparison)
- JSONB columns (e.g., whatsapp_sessions.session_data) are intact
- Sequences are reset to max(id) + 1 for auto-increment tables
- No orphaned foreign key references
```

**Deliverable:** RDS contains an exact copy of Supabase data, verified by automated checks

---

### 1.5: Store Database Credentials in Secrets Manager

**Tasks:**
- [ ] 1.5.1: Update `infrastructure/aws/secrets-manager.yaml` to add database secret:
  ```yaml
  ${Environment}/lynia/database:
    host, port, database, username, password
  ```
- [ ] 1.5.2: Update `database.ts` to fetch credentials from Secrets Manager on cold start (with caching)
- [ ] 1.5.3: Add IAM policy for Lambda functions to read database secret
- [ ] 1.5.4: Deploy updated secrets stack to dev

**Tests:**
```
tests/migration/phase1/secrets.test.ts
- Lambda can read database secret from Secrets Manager
- Credentials are cached after first read (not fetched every invocation)
- Cache invalidation works (new credentials picked up after rotation)
- Connection fails gracefully if secret is missing
- Secret ARN is passed via environment variable (not hardcoded)
```

**Deliverable:** Database credentials stored securely, not in environment variables or code

---

### 1.6: Migrate Services to `database.ts` (One at a Time)

Migrate in dependency order, simplest first, most critical last.

#### 1.6.1: Notification Service

**Tasks:**
- [ ] Replace all `supabase.from('notifications')` calls with `database.ts` equivalents
- [ ] Replace all `supabase.from('customers')` lookups with parameterized queries
- [ ] Update handler to use `getPool()` instead of `getSupabaseClient()`
- [ ] Remove `@supabase/supabase-js` import from notification service

**Tests:**
```
tests/migration/phase1/services/notification.test.ts
- POST /notifications/send creates notification record in RDS
- GET /notifications/{customerId} returns correct notifications
- Notification query filters by customer_id correctly
- Service handles database connection errors gracefully
- No references to supabase client in notification-service code
```

#### 1.6.2: Lock Service

**Tasks:**
- [ ] Replace all Supabase queries in lock-service handlers
- [ ] Update device lock/unlock operations to use parameterized SQL
- [ ] Update scheduled lock processing endpoint

**Tests:**
```
tests/migration/phase1/services/lock.test.ts
- POST /locks/lock creates lock record and updates device status
- POST /locks/unlock updates device lock status
- GET /locks/{deviceId} returns correct lock status
- Scheduled processing queries correct set of overdue locks
- Idempotent lock operations (re-locking already locked device is safe)
```

#### 1.6.3: WhatsApp Service

**Tasks:**
- [ ] Replace session state queries (whatsapp_sessions table)
- [ ] Replace message history queries (whatsapp_messages table)
- [ ] Replace customer lookup queries

**Tests:**
```
tests/migration/phase1/services/whatsapp.test.ts
- POST /whatsapp/send stores message in RDS
- POST /whatsapp/webhook processes incoming message, updates session state
- GET /whatsapp/webhook returns verification challenge correctly
- Session state machine transitions persist correctly
- Message retry logic works with new database client
```

#### 1.6.4: KYC Service

**Tasks:**
- [ ] Replace KYC submission queries
- [ ] Replace customer KYC status update queries
- [ ] Replace credit score lookups

**Tests:**
```
tests/migration/phase1/services/kyc.test.ts
- POST /kyc/initiate creates KYC submission record
- POST /kyc/callback updates submission status from Smile Identity
- GET /kyc/{customerId} returns correct KYC status
- KYC approval updates customer kyc_status field
- KYC rejection stores reason correctly
```

#### 1.6.5: Scoring Service

**Tasks:**
- [ ] Replace credit score calculation queries
- [ ] Replace customer history lookups
- [ ] Replace score persistence queries

**Tests:**
```
tests/migration/phase1/services/scoring.test.ts
- POST /scoring/calculate computes and stores credit score in RDS
- GET /scoring/{customerId} returns latest score
- Score calculation uses correct transaction history from RDS
- New customers get minimum score (300)
- Positive payment history increases score
- Score caching works (24-hour TTL)
```

#### 1.6.6: Payment Service (Most Critical -- Migrate Last)

**Tasks:**
- [ ] Replace payment processing queries with transactions (BEGIN/COMMIT)
- [ ] Ensure idempotency key checking uses RDS
- [ ] Replace payment status queries
- [ ] Replace reconciliation queries
- [ ] Add circuit breaker: if RDS error rate > 1% in 5 minutes, alert immediately

**Tests:**
```
tests/migration/phase1/services/payment.test.ts
- POST /payments/process creates payment record in transaction
- POST /payments/process is idempotent (duplicate key returns existing payment)
- POST /payments/webhook updates payment status atomically
- GET /payments/{paymentId} returns correct payment details
- Payment amounts stored in cents (integer, no floating point)
- Currency code preserved correctly (USD, ZWL, ZAR)
- Failed payment does not debit customer (transaction rollback)
- Concurrent payment processing doesn't create duplicates
- Payment within transaction limits succeeds
- Payment exceeding daily limit is rejected with PAY_AMT_001 error

tests/migration/phase1/services/payment.integration.test.ts
- Full payment lifecycle: initiate -> webhook confirm -> balance update
- Reconciliation query returns correct totals
- Transaction isolation: concurrent payments to same loan handled correctly
```

**Deliverable per service:** Service passes all existing + migration tests against RDS

---

### 1.7: Update SAM Template

**Tasks:**
- [ ] 1.7.1: Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from template.yaml Globals
- [ ] 1.7.2: Add `DB_SECRET_ARN` environment variable pointing to Secrets Manager
- [ ] 1.7.3: Add VPC configuration to all Lambda functions (private subnets + Lambda SG)
- [ ] 1.7.4: Update `samconfig.toml` with RDS-related parameter overrides
- [ ] 1.7.5: Validate template: `sam validate --lint`

**Tests:**
```
tests/migration/phase1/template.test.ts
- template.yaml validates without errors
- No references to SUPABASE_URL in template
- No references to SUPABASE_SERVICE_ROLE_KEY in template
- All functions have VpcConfig with private subnets
- DB_SECRET_ARN is set in Globals Environment Variables
```

**Deliverable:** Updated `template.yaml` that deploys Lambda functions connecting to RDS

---

### 1.8: Deploy and Validate Phase 1

**Tasks:**
- [ ] 1.8.1: Deploy Phase 1 to staging (`sam deploy --config-env staging`)
- [ ] 1.8.2: Run full integration test suite against staging
- [ ] 1.8.3: Run E2E test suite (7 scenarios) against staging
- [ ] 1.8.4: Verify no Supabase connection attempts in CloudWatch logs (grep for `supabase.co`)
- [ ] 1.8.5: Compare latency against PM-1 baseline (p95 must be < 500ms)
- [ ] 1.8.6: Verify payment processing end-to-end in staging
- [ ] 1.8.7: Deploy to production after staging validation passes
- [ ] 1.8.8: Monitor production for 24 hours -- check error rates, latency, connection counts

**Tests:**
```
tests/migration/phase1/smoke.test.ts
- All 6 services respond to health check
- POST /scoring/calculate returns valid score
- POST /payments/process returns success for valid payment
- POST /whatsapp/send returns 200
- POST /kyc/initiate returns 200
- POST /locks/lock returns 200
- POST /notifications/send returns 200
- No 5xx errors in response
- Response time < 2000ms for all endpoints
```

**Phase 1 Gate Criteria:**
- [ ] All 6 services on RDS
- [ ] Zero Supabase DB connection attempts in Lambda logs
- [ ] Integration tests pass (100%)
- [ ] E2E tests pass (100%)
- [ ] p95 latency < 500ms
- [ ] Error rate < 0.1%
- [ ] Payment success rate > 99%
- [ ] Row counts match pre-migration baseline

---

## Phase 2: Authentication Migration (Amazon Cognito)

> **Goal:** Admin Portal and Distributor Dashboard use Cognito for auth. API Gateway validates Cognito JWTs.
> **Estimated AWS Cost Delta:** +$0/mo (Cognito free tier: 50k MAU permanent)

### 2.1: Provision Cognito User Pool

**Tasks:**
- [ ] 2.1.1: Create `infrastructure/aws/cognito.yaml` CloudFormation template
  - User Pool with email-based sign-in
  - Password policy: 12+ chars, upper/lower/number/symbol
  - MFA: OPTIONAL (for admin accounts)
  - Advanced security: ENFORCED (compromised credential detection)
  - Account recovery: verified email
- [ ] 2.1.2: Create User Pool App Clients:
  - `admin-portal` (SRP auth, 1hr access token, 30d refresh)
  - `distributor-dashboard` (SRP auth, 1hr access token, 7d refresh)
- [ ] 2.1.3: Create User Groups: `admin`, `manager`, `support`, `reports_viewer`, `distributor`
- [ ] 2.1.4: Add stack outputs: UserPoolId, UserPoolArn, ClientIds
- [ ] 2.1.5: Deploy to dev environment

**Tests:**
```
tests/migration/phase2/cognito-provision.test.ts
- CloudFormation template validates
- User Pool exists after deployment
- Both App Clients exist
- All 5 groups exist
- Password policy enforces 12+ char minimum
- MFA is OPTIONAL (not OFF, not REQUIRED)
- Advanced security is ENFORCED
- Token validity: access=1hr, refresh=30d (admin), 7d (distributor)
- PreventUserExistenceErrors is ENABLED on both clients
```

**Deliverable:** Running Cognito User Pool in dev with all groups

---

### 2.2: User Migration Script

**Tasks:**
- [ ] 2.2.1: Create `scripts/migration/export-supabase-users.sh`
  - Export from `auth.users`: email, role, display_name, created_at
  - Exclude deleted users
- [ ] 2.2.2: Create `scripts/migration/import-cognito-users.ts`
  - Import users via `aws cognito-idp admin-create-user`
  - Assign to correct group based on role
  - Set temporary password (suppress welcome email)
  - Handle rate limiting (10 users/sec Cognito limit)
- [ ] 2.2.3: Create `scripts/migration/verify-users.ts`
  - Compare user counts (Supabase vs Cognito)
  - Verify all users are in correct groups
- [ ] 2.2.4: Run on dev environment with test users

**Tests:**
```
tests/migration/phase2/user-migration.test.ts
- All active Supabase users exist in Cognito
- User group assignments match Supabase roles
- Admin users are in 'admin' group
- Manager users are in 'manager' group
- Distributor users are in 'distributor' group
- User email addresses are preserved
- Deleted Supabase users are NOT imported
- Rate limiting doesn't cause import failures
```

**Deliverable:** All users migrated to Cognito with correct group assignments

---

### 2.3: Backend Auth Middleware (Cognito JWT)

**Tasks:**
- [ ] 2.3.1: Create `services/shared/utils/cognito-auth.ts`
  - `getAuthContext(event)` -- extract userId, email, groups from Cognito JWT claims
  - `requireAuth(event)` -- validate token present, return AuthContext
  - Parse `cognito:groups` claim
- [ ] 2.3.2: Update API Gateway configuration in `template.yaml`
  - Add Cognito Authorizer
  - Apply to all endpoints except webhook callbacks (WhatsApp, EcoCash)
- [ ] 2.3.3: Update all Lambda handlers to use `getAuthContext()` instead of Supabase auth
- [ ] 2.3.4: Remove `services/shared/utils/auth.ts` (old Supabase JWT validator)

**Tests:**
```
tests/migration/phase2/cognito-auth.test.ts
- getAuthContext() extracts userId from claims.sub
- getAuthContext() extracts email from claims.email
- getAuthContext() parses cognito:groups into array
- getAuthContext() throws AUTH_TOKEN_001 when claims missing
- requireAuth() rejects requests without Authorization header
- requireAuth() rejects expired tokens
- requireAuth() accepts valid Cognito JWT
- Webhook endpoints (WhatsApp, EcoCash) are excluded from Cognito auth
- API Gateway returns 401 for missing/invalid tokens
- API Gateway returns 403 for insufficient permissions
```

**Deliverable:** All Lambda services validate Cognito JWTs

---

### 2.4: Add Cognito Authorizer to API Gateway

**Tasks:**
- [ ] 2.4.1: Define `CognitoAuthorizer` in `template.yaml` under API Auth section
- [ ] 2.4.2: Set as `DefaultAuthorizer` for the API
- [ ] 2.4.3: Exclude webhook endpoints from Cognito auth:
  - `POST /whatsapp/webhook` (WhatsApp verification)
  - `GET /whatsapp/webhook` (WhatsApp challenge)
  - `POST /payments/webhook` (EcoCash/OneMoney callbacks)
  - `POST /kyc/callback` (Smile Identity callbacks)
- [ ] 2.4.4: Deploy and verify auth enforcement

**Tests:**
```
tests/migration/phase2/api-gateway-auth.test.ts
- Protected endpoints return 401 without token
- Protected endpoints return 200 with valid Cognito token
- Webhook endpoints return 200 without token (excluded from auth)
- Expired tokens are rejected with 401
- Tokens from wrong user pool are rejected
```

**Deliverable:** API Gateway enforces Cognito auth on all non-webhook endpoints

---

## Phase 3: RLS to Application-Layer Authorization

> **Goal:** Replace all 30+ RLS policies with application-layer middleware. Every data access is authorized in code, tested, and auditable.
> **Estimated AWS Cost Delta:** $0

### 3.1: Authorization Middleware

**Tasks:**
- [ ] 3.1.1: Create `services/shared/middleware/authorization.ts`
  - `isAdminOrManager(auth)` -- replaces `is_admin_or_manager()` SQL function
  - `isAdminStaff(auth)` -- replaces `is_admin_staff()` SQL function
  - `requireRole(auth, ...roles)` -- throws 403 if user lacks required role
  - `requireOwnership(auth, resourceOwnerId, allowAdminOverride)` -- replaces `customer_id = auth.uid()`
  - `buildAccessFilter(auth, ownerColumn)` -- generates WHERE clause for data filtering
- [ ] 3.1.2: Map every RLS policy to an application-layer equivalent (see mapping table below)
- [ ] 3.1.3: Apply authorization checks to all Lambda handlers

**RLS Policy -> Application Code Mapping:**

| # | Table | RLS Policy | Application Code |
|---|-------|-----------|-----------------|
| 1 | `customers` | Customers view own data | `buildAccessFilter(auth, 'id')` |
| 2 | `customers` | Admins manage all | `requireRole(auth, 'admin', 'manager')` for writes |
| 3 | `customers` | Support read-only | `requireRole(auth, 'admin', 'manager', 'support')` for reads |
| 4 | `loans` | Customers view own loans | `buildAccessFilter(auth, 'customer_id')` |
| 5 | `loans` | Staff manage all loans | `requireRole(auth, 'admin', 'manager')` for writes |
| 6 | `payments` | Customers view own payments | `buildAccessFilter(auth, 'customer_id')` via loan |
| 7 | `payments` | Staff manage payments | `requireRole(auth, 'admin', 'manager')` for writes |
| 8 | `kyc_submissions` | Customers view own KYC | `requireOwnership(auth, submission.customer_id)` |
| 9 | `kyc_submissions` | Staff view all KYC | `requireRole(auth, 'admin', 'manager', 'support')` |
| 10 | `credit_scores` | Customers view own scores | `requireOwnership(auth, score.customer_id)` |
| 11 | `credit_scores` | Staff view all scores | `isAdminStaff(auth)` |
| 12 | `devices` | Staff manage devices | `requireRole(auth, 'admin', 'manager')` |
| 13 | `device_locks` | Staff manage locks | `requireRole(auth, 'admin', 'manager')` |
| 14 | `device_assignments` | Staff manage assignments | `requireRole(auth, 'admin', 'manager')` |
| 15 | `agent_inventory` | Distributors view own | `buildAccessFilter(auth, 'distributor_id')` |
| 16 | `distributors` | Distributors view own profile | `requireOwnership(auth, distributor.id)` |
| 17 | `distributor_commissions` | Distributors view own | `buildAccessFilter(auth, 'distributor_id')` |
| 18 | `admin_users` | Admins manage staff | `requireRole(auth, 'admin')` |
| 19 | `notifications` | Users view own | `buildAccessFilter(auth, 'customer_id')` |
| 20 | `support_tickets` | Customers view own | `buildAccessFilter(auth, 'customer_id')` |
| 21 | `support_tickets` | Support manage all | `requireRole(auth, 'admin', 'manager', 'support')` |
| 22 | `audit_log` | Admin-only | `requireRole(auth, 'admin')` |
| 23 | `security_audit_log` | Admin-only | `requireRole(auth, 'admin')` |
| 24 | `privacy_audit_log` | Admin-only | `requireRole(auth, 'admin')` |
| 25 | `system_config` | Admin-only | `requireRole(auth, 'admin')` |
| 26 | `whatsapp_sessions` | Staff view all | `isAdminStaff(auth)` |
| 27 | `whatsapp_messages` | Staff view all | `isAdminStaff(auth)` |
| 28 | `loan_products` | Authenticated users read | API Gateway auth check (no additional filter) |
| 29 | `transaction_limits` | Admin-only management | `requireRole(auth, 'admin')` |
| 30 | `record_retention_policies` | Admin-only | `requireRole(auth, 'admin')` |

**Tests:**
```
tests/migration/phase3/authorization.test.ts
- requireRole: admin accessing admin route -> allowed
- requireRole: customer accessing admin route -> 403
- requireRole: manager accessing admin+manager route -> allowed
- requireRole: support accessing admin route -> 403
- requireRole: support accessing support route -> allowed
- requireRole: reports_viewer accessing reports route -> allowed
- requireRole: distributor accessing admin route -> 403

- isAdminOrManager: admin -> true
- isAdminOrManager: manager -> true
- isAdminOrManager: support -> false
- isAdminOrManager: customer -> false

- isAdminStaff: admin -> true
- isAdminStaff: manager -> true
- isAdminStaff: support -> true
- isAdminStaff: reports_viewer -> true
- isAdminStaff: distributor -> false
- isAdminStaff: customer -> false

- requireOwnership: owner accessing own resource -> allowed
- requireOwnership: non-owner accessing resource -> 403
- requireOwnership: admin accessing any resource (override=true) -> allowed
- requireOwnership: admin accessing resource (override=false) -> 403

- buildAccessFilter: admin -> returns '1=1' (no filter)
- buildAccessFilter: customer -> returns 'column = $1' with userId
- buildAccessFilter: distributor -> returns 'column = $1' with userId

Full matrix test (30 RLS policies):
- For each row in the mapping table above, test allowed + denied scenarios
```

**Deliverable:** All 30 RLS policies replaced with tested application logic

---

### 3.2: Authorization Audit Logging

**Tasks:**
- [ ] 3.2.1: Add authorization event logging to middleware
  - Log: action, userId, role, resource, allowed/denied, timestamp
  - Never log: request body, passwords, PII
- [ ] 3.2.2: Create CloudWatch log filter for denied access attempts
- [ ] 3.2.3: Add alarm: > 10 denied access attempts per minute = WARNING

**Tests:**
```
tests/migration/phase3/audit.test.ts
- Denied access attempts are logged with correct structure
- Allowed access is logged at DEBUG level
- Sensitive data is NOT present in logs
- CloudWatch alarm triggers on threshold breach
```

**Deliverable:** Authorization decisions are auditable via CloudWatch

---

## Phase 4: Realtime Migration

> **Goal:** Replace Supabase Realtime subscriptions with polling. Optional WebSocket API for future use.
> **Estimated AWS Cost Delta:** $0 (polling via existing Lambda/API Gateway)

### 4.1: Replace Realtime Subscriptions with Polling

**Tasks:**
- [ ] 4.1.1: Refactor `frontend/admin-portal/src/lib/hooks/useKYCReview.ts`
  - Remove `supabase.channel()` subscription
  - Replace with React Query polling (5-second `refetchInterval`)
  - Use existing API endpoint `GET /kyc?status=pending` via API Gateway
- [ ] 4.1.2: Remove any other `supabase.channel()` or `.on('postgres_changes')` usage
- [ ] 4.1.3: Remove `supabase.auth.onAuthStateChange()` listeners (replaced by Cognito state)
- [ ] 4.1.4: Verify no `supabase.channel` or `.subscribe()` calls remain in codebase

**Tests:**
```
tests/migration/phase4/realtime.test.ts
- useKYCReview hook fetches data via API (not Supabase channel)
- New KYC submissions appear within 5 seconds (polling interval)
- Polling stops when component unmounts (no memory leaks)
- Dashboard performance is acceptable with polling (FCP < 1.5s)
- Grep: zero 'supabase.channel' references in codebase
- Grep: zero '.subscribe()' calls to Supabase in codebase
```

**Deliverable:** All realtime features work via polling, zero Supabase Realtime dependencies

---

### 4.2: (Optional) WebSocket API for Future Realtime

**Tasks:**
- [ ] 4.2.1: Create `infrastructure/aws/websocket-api.yaml` (CloudFormation template only -- deploy later when needed)
  - API Gateway WebSocket API
  - $connect, $disconnect, $default routes
  - DynamoDB table for connection state
  - Lambda handlers for connect/disconnect/broadcast
- [ ] 4.2.2: Document WebSocket API design in `docs/infrastructure/WEBSOCKET-API.md`

**Tests:**
```
tests/migration/phase4/websocket-template.test.ts
- CloudFormation template validates
- Template includes DynamoDB connection state table
- Template includes Lambda handlers for $connect and $disconnect
```

**Deliverable:** WebSocket template ready for future deployment (not deployed in this migration)

---

## Phase 5: Storage Migration (S3)

> **Goal:** KYC documents and generated files use S3 directly. Presigned URLs for secure access.
> **Estimated AWS Cost Delta:** ~$0.50/mo (S3 storage for documents)

### 5.1: Create S3 Storage Buckets

**Tasks:**
- [ ] 5.1.1: Create `infrastructure/aws/storage-buckets.yaml`
  - `${Environment}-lynia-kyc-documents` -- KYC ID photos, selfies, proof of residence
  - `${Environment}-lynia-commission-reports` -- Generated PDFs for distributor commissions
  - `${Environment}-lynia-reconciliation` -- Payment reconciliation exports
  - All buckets: Block public access, AES256 encryption, versioning (production)
  - Lifecycle: Move to Glacier after 1 year, delete after 10 years (RBZ compliance)
- [ ] 5.1.2: Create IAM policies for KYC, Payment, and Admin Lambda functions to access respective buckets
- [ ] 5.1.3: Deploy to dev

**Tests:**
```
tests/migration/phase5/storage-provision.test.ts
- CloudFormation template validates
- All 3 buckets have BlockPublicAccess enabled
- All 3 buckets have encryption enabled
- Lifecycle rules: Glacier after 365 days, expire after 3650 days
- Production buckets have versioning enabled
- IAM policies follow least privilege (KYC Lambda can only access KYC bucket)
```

**Deliverable:** S3 buckets deployed with proper security and retention policies

---

### 5.2: Storage Client Library

**Tasks:**
- [ ] 5.2.1: Create `services/shared/clients/storage.ts`
  - `generateUploadUrl(bucket, key, contentType, expiresIn)` -- presigned PUT URL
  - `generateDownloadUrl(bucket, key, expiresIn)` -- presigned GET URL
  - `deleteObject(bucket, key)` -- delete file
  - `listObjects(bucket, prefix)` -- list files with prefix
  - Default presigned URL expiry: 15 minutes
- [ ] 5.2.2: Update KYC service to store documents in S3
  - `POST /kyc/initiate` returns presigned upload URLs for required documents
  - `POST /kyc/callback` references S3 keys instead of Supabase Storage URLs
  - `GET /kyc/{customerId}` returns presigned download URLs
- [ ] 5.2.3: Update database `url` columns to store S3 keys instead of Supabase URLs

**Tests:**
```
tests/migration/phase5/storage-client.test.ts
- generateUploadUrl returns valid presigned URL
- generateDownloadUrl returns valid presigned URL
- URLs expire after specified duration
- deleteObject removes file from S3
- listObjects returns correct files for prefix
- Content-Type is set correctly in presigned upload
- Non-existent keys return appropriate error

tests/migration/phase5/kyc-storage.integration.test.ts
- Upload KYC document via presigned URL -> file exists in S3
- Download KYC document via presigned URL -> file content matches
- KYC record in database references S3 key
- Expired presigned URL returns 403
```

**Deliverable:** File storage fully on S3 with presigned URL access

---

### 5.3: Migrate Existing Files

**Tasks:**
- [ ] 5.3.1: Create `scripts/migration/migrate-storage.ts`
  - List all Supabase Storage objects
  - Download each and upload to corresponding S3 bucket
  - Update database records with new S3 keys
- [ ] 5.3.2: Run migration and verify all files accessible via new presigned URLs

**Tests:**
```
tests/migration/phase5/storage-migration.test.ts
- All Supabase Storage files exist in S3
- Database records updated with S3 keys
- Files downloadable via presigned URLs
- File checksums match (MD5 comparison)
```

**Deliverable:** All files migrated from Supabase Storage to S3

---

## Phase 6: Frontend Migration

> **Goal:** Admin Portal and Distributor Dashboard use Cognito for auth and API Gateway for data. Zero direct Supabase calls.
> **Estimated AWS Cost Delta:** $0

### 6.1: Create API Client for Frontend

**Tasks:**
- [ ] 6.1.1: Create `frontend/admin-portal/src/lib/api/client.ts`
  - Wraps `fetch` with Cognito JWT in Authorization header
  - Automatic token refresh on 401
  - Request/response interceptors for error handling
  - Base URL from `NEXT_PUBLIC_API_BASE_URL`
- [ ] 6.1.2: Create typed API methods matching Supabase query patterns:
  - `api.customers.list(filters)` -> `GET /api/v1/customers`
  - `api.customers.get(id)` -> `GET /api/v1/customers/:id`
  - `api.loans.list(filters)` -> `GET /api/v1/loans`
  - `api.payments.list(filters)` -> `GET /api/v1/payments`
  - (and so on for all resources)

**Tests:**
```
tests/migration/phase6/api-client.test.ts
- Client attaches Cognito JWT to all requests
- Client refreshes token automatically on 401
- Client handles network errors gracefully
- Client serializes query parameters correctly
- Client deserializes JSON responses with correct types
- Client throws typed errors for 4xx/5xx responses
```

**Deliverable:** Type-safe API client that replaces direct Supabase queries

---

### 6.2: Replace Supabase Auth in Admin Portal

**Tasks:**
- [ ] 6.2.1: Install `amazon-cognito-identity-js` in `frontend/admin-portal`
- [ ] 6.2.2: Create `frontend/admin-portal/src/lib/auth/cognito-context.tsx`
  - `signIn(email, password)` -- Cognito SRP authentication
  - `signOut()` -- Cognito sign out + clear cookies
  - `getSession()` -- Get current Cognito session
  - `getUser()` -- Get authenticated user with groups
  - Handle `newPasswordRequired` challenge (migrated users)
- [ ] 6.2.3: Update `frontend/admin-portal/src/middleware.ts`
  - Check for Cognito ID token cookie instead of Supabase cookie
  - Redirect to login if no valid token
- [ ] 6.2.4: Update login page to use Cognito auth
- [ ] 6.2.5: Remove `@supabase/ssr` and `@supabase/supabase-js` from admin-portal `package.json`
- [ ] 6.2.6: Delete `frontend/admin-portal/src/lib/supabase/` directory

**Tests:**
```
tests/migration/phase6/admin-auth.test.ts
- Login with valid credentials returns Cognito session
- Login with invalid credentials shows error message
- Login with temporary password triggers password change flow
- Sign out clears all tokens and redirects to login
- Session persists across page refreshes
- Expired session triggers automatic token refresh
- Role-based UI elements: admin sees all, support sees subset
- Unauthenticated user is redirected to /login
- No references to @supabase in admin-portal code
```

**Deliverable:** Admin Portal uses Cognito for all auth flows

---

### 6.3: Replace Direct Database Queries in Admin Portal

**Tasks:**
- [ ] 6.3.1: Replace all `supabase.from('table').select()` calls with API client calls
- [ ] 6.3.2: Update React Query hooks to use API client
- [ ] 6.3.3: Update TanStack Table data fetching to use API client
- [ ] 6.3.4: Update dashboard charts to use API data
- [ ] 6.3.5: Verify all pages load correctly with API-sourced data

**Tests:**
```
tests/migration/phase6/admin-data.test.ts
- Dashboard page loads with correct metrics from API
- Customer list page shows data from API
- Loan applications table fetches via API
- KYC review queue works with polling (not Supabase Realtime)
- Payment history shows correct data
- Search and filter work correctly through API
- Pagination works correctly
- Sorting works correctly
- No supabase.from() calls remain in admin-portal codebase
```

**Deliverable:** Admin Portal fetches all data through API Gateway

---

### 6.4: Replace Auth in Distributor Dashboard

**Tasks:**
- [ ] 6.4.1: Mirror admin portal Cognito auth changes for distributor dashboard
- [ ] 6.4.2: Use distributor-specific Cognito App Client (7-day refresh token)
- [ ] 6.4.3: Replace all Supabase queries with API client calls
- [ ] 6.4.4: Remove Supabase dependencies from distributor-dashboard `package.json`
- [ ] 6.4.5: Delete `frontend/distributor-dashboard/src/lib/supabase/` if exists

**Tests:**
```
tests/migration/phase6/distributor-auth.test.ts
- Distributor login works with Cognito
- Distributor sees only their own inventory and commissions
- Admin accounts cannot log into distributor dashboard (wrong client)
- Session timeout is 7 days (shorter than admin)
- No Supabase references in distributor-dashboard code
```

**Deliverable:** Distributor Dashboard fully migrated to Cognito + API

---

### 6.5: Deploy and Validate Phase 6

**Tasks:**
- [ ] 6.5.1: Build both frontends: `pnpm build`
- [ ] 6.5.2: Deploy to staging via S3 + CloudFront
- [ ] 6.5.3: Run Lighthouse audit (Performance > 90, Accessibility > 90)
- [ ] 6.5.4: Manual QA: login, navigate all pages, perform key actions
- [ ] 6.5.5: Verify bundle size < 200KB initial load
- [ ] 6.5.6: Deploy to production

**Tests:**
```
tests/migration/phase6/frontend-smoke.test.ts
- Admin Portal login page loads
- Admin Portal dashboard loads after authentication
- Distributor Dashboard login page loads
- All pages render without JavaScript errors
- Lighthouse Performance > 90
- Lighthouse Accessibility > 90
- Bundle size < 200KB initial
```

**Phase 6 Gate Criteria:**
- [ ] Zero `@supabase` dependencies in any frontend package.json
- [ ] Zero `supabase` imports in any frontend source file
- [ ] Both dashboards functional with Cognito auth
- [ ] All data fetched via API Gateway (not direct DB)
- [ ] Lighthouse scores meet thresholds
- [ ] Manual QA sign-off

---

## Phase 7: Cleanup and Decommission

> **Goal:** Remove all Supabase dependencies from the entire codebase. Single-platform AWS.

### 7.1: Remove Supabase Dependencies

**Tasks:**
- [ ] 7.1.1: Remove `@supabase/supabase-js` from `services/shared/package.json`
- [ ] 7.1.2: Remove `@supabase/ssr` and `@supabase/supabase-js` from all frontend `package.json` files
- [ ] 7.1.3: Delete `services/shared/clients/supabase.ts`
- [ ] 7.1.4: Delete all `frontend/*/src/lib/supabase/` directories
- [ ] 7.1.5: Delete `landing-page/frontend/lib/supabase.ts` if exists
- [ ] 7.1.6: Run `pnpm install` to clean lockfile
- [ ] 7.1.7: Run `pnpm build` to verify nothing breaks

**Tests:**
```
tests/migration/phase7/cleanup.test.ts
- grep -r '@supabase' package.json files returns zero results
- grep -r 'supabase' --include='*.ts' --include='*.tsx' src/ returns zero results
  (excluding migration scripts and docs)
- pnpm build succeeds with zero errors
- pnpm test passes with existing coverage thresholds
```

---

### 7.2: Remove Supabase Environment Variables

**Tasks:**
- [ ] 7.2.1: Remove from `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- [ ] 7.2.2: Remove from `frontend/admin-portal/.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 7.2.3: Remove from `env.json` if applicable
- [ ] 7.2.4: Add new env vars: `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_API_BASE_URL`
- [ ] 7.2.5: Delete Supabase secret from Secrets Manager (`${Environment}/lynia/supabase`)
- [ ] 7.2.6: Remove Supabase secret references from `infrastructure/aws/secrets-manager.yaml`
- [ ] 7.2.7: Update GitHub Actions secrets (remove `STAGING_SUPABASE_*`, `PRODUCTION_SUPABASE_*`)

**Tests:**
```
tests/migration/phase7/env-cleanup.test.ts
- grep -r 'SUPABASE' .env.example returns zero results
- grep -r 'SUPABASE' template.yaml returns zero results
- grep -r 'SUPABASE' infrastructure/ returns zero results
- New env vars documented in .env.example
```

---

### 7.3: Update Documentation

**Tasks:**
- [ ] 7.3.1: Update `README.md` -- replace Supabase references with AWS equivalents
- [ ] 7.3.2: Update `CLAUDE.md` -- update external services table, database references
- [ ] 7.3.3: Update `SETUP.md` -- new setup instructions for RDS, Cognito
- [ ] 7.3.4: Update `QUICKSTART.md` -- new quick start flow
- [ ] 7.3.5: Archive `docs/deployment/SUPABASE-SETUP-GUIDE.md` (move to `docs/archive/`)
- [ ] 7.3.6: Update `docs/deployment/DEPLOYMENT-GUIDE.md` with RDS + Cognito instructions
- [ ] 7.3.7: Update `docs/deployment/INCIDENT-RESPONSE-PLAYBOOK.md` with new troubleshooting
- [ ] 7.3.8: Update CI/CD pipeline documentation

**Tests:**
```
Manual review checklist:
- [ ] README references RDS, Cognito, S3 (not Supabase)
- [ ] SETUP.md has working instructions for new developer onboarding
- [ ] QUICKSTART.md can be followed from scratch
- [ ] No dead links to Supabase documentation
```

---

### 7.4: Final Verification

**Tasks:**
- [ ] 7.4.1: Run `grep -r 'supabase' --include='*.ts' --include='*.tsx' --include='*.yaml' --include='*.json' --include='*.env*' .` and resolve any remaining references
- [ ] 7.4.2: Run full test suite: `pnpm test`
- [ ] 7.4.3: Run integration tests: `pnpm test:integration`
- [ ] 7.4.4: Run E2E tests: `pnpm test:e2e`
- [ ] 7.4.5: Deploy everything to staging and run smoke tests
- [ ] 7.4.6: Deploy to production

**Tests:**
```
tests/migration/phase7/final-verification.test.ts
- Zero Supabase references in source code (excluding docs/archive and migration scripts)
- All unit tests pass (80%+ coverage maintained)
- All integration tests pass
- All E2E tests pass (7 scenarios)
- Production deployment successful
- Error rate < 0.1% for 24 hours post-deploy
```

---

### 7.5: Archive Supabase Project

**Tasks:**
- [ ] 7.5.1: Pause Supabase project (do NOT delete yet)
- [ ] 7.5.2: Set calendar reminder: delete Supabase project after 30-day stability period
- [ ] 7.5.3: After 30 days with zero issues, delete Supabase project

**Gate Criteria:**
- [ ] 30 consecutive days with zero Supabase-related issues
- [ ] Zero Supabase connection attempts in any CloudWatch logs
- [ ] All stakeholders notified

---

## Phase 8: Post-Migration Hardening

> **Goal:** Optimize the new AWS-native architecture for performance, cost, and security.

### 8.1: Performance Optimization

**Tasks:**
- [ ] 8.1.1: Compare post-migration latency against PM-1 baseline
- [ ] 8.1.2: Optimize slow queries identified in RDS Performance Insights
- [ ] 8.1.3: Add database connection pooling optimizations if needed
- [ ] 8.1.4: Right-size Lambda memory based on actual usage (CloudWatch metrics)
- [ ] 8.1.5: Review and adjust provisioned concurrency settings

**Tests:**
```
tests/migration/phase8/performance.test.ts
- p50 latency <= pre-migration p50 (or within 20%)
- p95 latency < 500ms (SLO)
- p99 latency < 1000ms (SLO)
- Cold start rate < 10% for production services
- Database connection count stays below 70% of max
```

---

### 8.2: Cost Optimization

**Tasks:**
- [ ] 8.2.1: Deploy `fck-nat` instance instead of NAT Gateway (saves ~$29/mo)
- [ ] 8.2.2: Disable WAF in dev environment (saves $11/mo)
- [ ] 8.2.3: Set up AWS Budget alerts at $25, $50, $100 thresholds
- [ ] 8.2.4: Review Secrets Manager usage (consolidate secrets if possible)
- [ ] 8.2.5: Enable S3 Intelligent-Tiering on storage buckets
- [ ] 8.2.6: Remove unused CloudWatch dashboards in dev environment

**Tests:**
```
tests/migration/phase8/cost.test.ts
- AWS Budget alerts are configured
- fck-nat instance is running (not NAT Gateway)
- Dev environment WAF is disabled
- S3 Intelligent-Tiering lifecycle rule exists
- Monthly cost < $25 (Year 1) or < $50 (Year 2+)
```

---

### 8.3: Security Hardening

**Tasks:**
- [ ] 8.3.1: Run full security audit on authorization middleware
- [ ] 8.3.2: Verify all API endpoints require authentication (except webhooks)
- [ ] 8.3.3: Verify Cognito advanced security is detecting anomalies
- [ ] 8.3.4: Test rate limiting on auth endpoints (3 OTP attempts per 5 min)
- [ ] 8.3.5: Penetration test: attempt SQL injection on 10 endpoints
- [ ] 8.3.6: Penetration test: attempt unauthorized data access (IDOR)
- [ ] 8.3.7: (Optional) Re-enable RLS on RDS for defense-in-depth using session variables

**Tests:**
```
tests/migration/phase8/security.test.ts
- All protected endpoints return 401 without token
- SQL injection attempts are blocked on all endpoints
- IDOR: customer A cannot access customer B's data
- IDOR: distributor A cannot access distributor B's inventory
- Rate limiting blocks excessive auth attempts
- Authorization middleware covers every table in the RLS mapping
- XSS payloads are sanitized in user inputs
```

---

### 8.4: Monitoring and Alerting Update

**Tasks:**
- [ ] 8.4.1: Add RDS-specific CloudWatch alarms:
  - CPUUtilization > 80% -> WARNING
  - FreeableMemory < 100 MB -> WARNING
  - DatabaseConnections > 70 -> WARNING
  - ReadLatency > 20ms -> WARNING
  - FreeStorageSpace < 2 GB -> CRITICAL
- [ ] 8.4.2: Add Cognito CloudWatch alarms:
  - SignIn failures > 10/min -> WARNING
  - CompromisedCredentialsRisk events -> CRITICAL
- [ ] 8.4.3: Update CloudWatch dashboards to include RDS and Cognito metrics
- [ ] 8.4.4: Remove Supabase-specific metrics from dashboards
- [ ] 8.4.5: Create migration-specific temporary alarm: any connection to `supabase.co` -> CRITICAL

**Tests:**
```
tests/migration/phase8/monitoring.test.ts
- RDS alarms exist in CloudWatch
- Cognito alarms exist in CloudWatch
- Dashboard includes RDS metrics panel
- Dashboard includes Cognito metrics panel
- No references to Supabase in alarm configurations
```

---

## Rollback Playbook

### Phase 1 Rollback (Database)

```
Trigger: Error rate > 5% OR data inconsistency detected
Action:
1. Revert Lambda environment variables to Supabase credentials
2. Deploy previous SAM template version
3. Verify services connect to Supabase
4. Investigate root cause
Time: < 15 minutes
```

### Phase 2 Rollback (Auth)

```
Trigger: Login failure rate > 5% OR session issues
Action:
1. Revert API Gateway authorizer to previous config
2. Revert frontend auth to Supabase SDK (git revert)
3. Both auth systems coexist -- no data loss
Time: < 30 minutes (frontend redeploy)
```

### Phase 4 Rollback (Realtime)

```
Trigger: Dashboard data staleness > 30 seconds
Action:
1. Revert useKYCReview hook to Supabase channel subscription
2. Redeploy frontend
Time: < 15 minutes
```

### Phase 5 Rollback (Storage)

```
Trigger: File upload/download failures
Action:
1. Revert KYC service to Supabase Storage URLs
2. Database URL columns still contain original Supabase URLs as backup
Time: < 15 minutes
```

### Full Rollback (Nuclear Option)

```
Trigger: Multiple critical failures across phases
Action:
1. Restore Supabase from pg_dump backup (PM-2)
2. Revert ALL code to pre-migration commit tag
3. Deploy previous SAM template and frontend builds
4. Verify all services connect to Supabase
Time: < 1 hour
```

---

## Go/No-Go Gates

Each phase must pass its gate before proceeding to the next.

| Gate | From -> To | Criteria |
|------|-----------|----------|
| G1 | Phase 1 -> Phase 2 | All services on RDS, integration tests 100%, zero Supabase DB calls, p95 < 500ms, error rate < 0.1% |
| G2 | Phase 2 -> Phase 3 | Cognito auth working, users migrated, API Gateway rejects invalid tokens |
| G3 | Phase 3 -> Phase 4 | All 30 RLS policies replaced with tested app logic, authorization audit logging active |
| G4 | Phase 4 -> Phase 5 | Realtime features work via polling, zero Supabase channel connections |
| G5 | Phase 5 -> Phase 6 | File storage on S3, presigned URLs working, zero Supabase Storage calls |
| G6 | Phase 6 -> Phase 7 | Both frontends on Cognito + API, Lighthouse > 90, manual QA passed |
| G7 | Phase 7 -> Phase 8 | Zero Supabase dependencies, all tests pass, production stable 24 hours |
| G8 | Phase 8 -> Done | Performance within SLO, cost within budget, security audit passed, 30-day stability |

---

## Task Summary

| Phase | Tasks | Critical Path |
|-------|-------|--------------|
| Pre-Migration | 15 | PM-2 (backup) must complete before any migration |
| Phase 1: Database | 30+ | Migrate services in order: notification -> lock -> whatsapp -> kyc -> scoring -> payment |
| Phase 2: Auth | 16 | Cognito provision -> user migration -> backend middleware -> API Gateway |
| Phase 3: Authorization | 35+ | Map all 30 RLS policies -> implement -> test matrix |
| Phase 4: Realtime | 6 | Replace subscriptions with polling |
| Phase 5: Storage | 9 | S3 buckets -> client library -> migrate files |
| Phase 6: Frontend | 15+ | API client -> admin auth -> admin data -> distributor -> deploy |
| Phase 7: Cleanup | 20+ | Remove deps -> remove env vars -> update docs -> verify -> archive |
| Phase 8: Hardening | 20+ | Performance -> cost -> security -> monitoring |
| **Total** | **~170 tasks** | |

---

## Dependency Graph

```
PM-1 (Baseline) ──┐
PM-2 (Backup)   ──┼──▶ Phase 1 (Database) ──▶ Phase 2 (Auth) ──▶ Phase 3 (RLS) ──┐
PM-3 (Test Infra) ┘                                                                │
                                                                                    ├──▶ Phase 6 (Frontend) ──▶ Phase 7 (Cleanup) ──▶ Phase 8 (Hardening)
                          Phase 4 (Realtime) ──────────────────────────────────────┤
                          Phase 5 (Storage)  ──────────────────────────────────────┘
```

Phases 4 and 5 can run in parallel with Phases 2 and 3. Phase 6 requires all prior phases. Phase 7 requires Phase 6. Phase 8 requires Phase 7.

---

> **Remember:** Every feature we build, every line of code we write, serves real people trying to build better lives. Migrate with the same care we build with.
