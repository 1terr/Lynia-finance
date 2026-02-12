# 10 - Migration Timeline

## Overview

The migration is split into 5 phases. Each phase is independently deployable
and reversible. No big-bang cutover.

```
Phase 1          Phase 2          Phase 3          Phase 4          Phase 5
Database ──────▶ Auth ──────────▶ Realtime ──────▶ Storage ───────▶ Cleanup
(RDS setup,      (Cognito setup,  (Polling/WS,     (S3 buckets,     (Remove
 backend swap)    user migration,  frontend hooks)   file handling)   Supabase)
                  frontend swap)
```

## Phase 1: Database Migration

**Goal**: All Lambda services read/write from RDS instead of Supabase.

### Tasks

| # | Task | Depends On |
|---|------|------------|
| 1.1 | Provision RDS `db.t4g.micro` in VPC | VPC exists (it does) |
| 1.2 | Create `000_pre_migration.sql` stub for `auth.uid()` | - |
| 1.3 | Run all 17 migrations against RDS | 1.1, 1.2 |
| 1.4 | Create `018_remove_rls_for_aws.sql` | 1.3 |
| 1.5 | Store DB credentials in Secrets Manager | 1.1 |
| 1.6 | Build `database.ts` (Supabase-compatible query builder) | - |
| 1.7 | Write unit tests for `database.ts` | 1.6 |
| 1.8 | Export data from Supabase via `pg_dump` | - |
| 1.9 | Import data into RDS | 1.3, 1.8 |
| 1.10 | Migrate `notification-service` to `database.ts` | 1.6 |
| 1.11 | Test notification-service against RDS | 1.9, 1.10 |
| 1.12 | Migrate `lock-service` | 1.11 (validate pattern) |
| 1.13 | Migrate `whatsapp-service` | 1.12 |
| 1.14 | Migrate `kyc-service` | 1.13 |
| 1.15 | Migrate `scoring-service` | 1.14 |
| 1.16 | Migrate `payment-service` (most critical) | 1.15 |
| 1.17 | Update `template.yaml` (remove Supabase params, add VPC) | 1.10-1.16 |
| 1.18 | Deploy to staging and run full test suite | 1.17 |
| 1.19 | Deploy to production | 1.18 verified |

**Milestone**: All backend services use RDS. Supabase still used by frontends.

### Validation Criteria

- [ ] All 17 migrations run successfully on RDS
- [ ] Row counts match between Supabase and RDS
- [ ] All Lambda test events pass against RDS
- [ ] Integration tests pass
- [ ] No Supabase connection attempts in Lambda CloudWatch logs
- [ ] Payment processing works end-to-end
- [ ] Latency within acceptable range (p95 < 300ms)

---

## Phase 2: Authentication Migration

**Goal**: Admin Portal and Distributor Dashboard use Cognito for auth.

### Tasks

| # | Task | Depends On |
|---|------|------------|
| 2.1 | Deploy Cognito User Pool via CloudFormation | - |
| 2.2 | Create user groups (admin, manager, support, distributor) | 2.1 |
| 2.3 | Export users from Supabase Auth | - |
| 2.4 | Import users into Cognito (batch or lazy migration) | 2.1, 2.3 |
| 2.5 | Build `authorization.ts` middleware | - |
| 2.6 | Write unit tests for authorization middleware | 2.5 |
| 2.7 | Add Cognito authorizer to API Gateway | 2.1 |
| 2.8 | Update Admin Portal auth context | 2.1, 2.7 |
| 2.9 | Update Admin Portal middleware | 2.8 |
| 2.10 | Update Distributor Dashboard auth | 2.1, 2.7 |
| 2.11 | Create `api/client.ts` for frontend API calls | Phase 1 complete |
| 2.12 | Replace all direct `supabase.from()` calls in frontend | 2.11 |
| 2.13 | Test login/logout/session for both dashboards | 2.8-2.12 |
| 2.14 | Test role-based access (admin vs support vs distributor) | 2.13 |
| 2.15 | Deploy to staging | 2.14 |
| 2.16 | Deploy to production | 2.15 verified |

**Milestone**: No frontend code references Supabase. Auth flows use Cognito.

### Validation Criteria

- [ ] Admin login works with migrated credentials
- [ ] Distributor login works
- [ ] Role-based access enforced correctly
- [ ] Session persistence works across page refresh
- [ ] Token refresh works silently
- [ ] API Gateway rejects invalid/expired tokens
- [ ] First-time password change flow works (for migrated users)

---

## Phase 3: Realtime Migration

**Goal**: KYC queue and other live features work without Supabase Realtime.

### Tasks

| # | Task | Depends On |
|---|------|------------|
| 3.1 | Replace `useKYCReview` with polling (5-second interval) | Phase 2 |
| 3.2 | Remove all `supabase.channel()` subscriptions | 3.1 |
| 3.3 | Test KYC review queue responsiveness | 3.2 |
| 3.4 | (Optional) Set up WebSocket API for future realtime needs | - |
| 3.5 | Deploy to staging | 3.3 |
| 3.6 | Deploy to production | 3.5 verified |

**Milestone**: All realtime features work via polling. WebSocket available for
future use.

### Validation Criteria

- [ ] KYC queue updates within 5 seconds of submission
- [ ] No `supabase.channel` references in codebase
- [ ] Dashboard performance acceptable with polling

---

## Phase 4: Storage Migration

**Goal**: Any file storage uses S3 directly.

### Tasks

| # | Task | Depends On |
|---|------|------------|
| 4.1 | Deploy S3 storage buckets (KYC, commissions, reconciliation) | - |
| 4.2 | Build `storage.ts` client (presigned URLs, upload/download) | 4.1 |
| 4.3 | Update KYC service to use S3 for document storage | 4.2 |
| 4.4 | Implement commission PDF storage | 4.2 |
| 4.5 | Migrate any existing files from Supabase Storage to S3 | 4.1 |
| 4.6 | Deploy to staging | 4.3-4.5 |
| 4.7 | Deploy to production | 4.6 verified |

**Milestone**: All file storage on S3. Supabase Storage unused.

---

## Phase 5: Cleanup

**Goal**: Remove all Supabase dependencies and decommission project.

### Tasks

| # | Task | Depends On |
|---|------|------------|
| 5.1 | Remove `@supabase/supabase-js` from all `package.json` files | Phases 1-4 |
| 5.2 | Remove `@supabase/ssr` from frontend packages | Phases 1-4 |
| 5.3 | Delete `services/shared/clients/supabase.ts` | 5.1 |
| 5.4 | Delete `frontend/*/src/lib/supabase/` directories | 5.2 |
| 5.5 | Delete `landing-page/frontend/lib/supabase.ts` | 5.2 |
| 5.6 | Remove Supabase env vars from `.env.example`, `env.json` | 5.1-5.5 |
| 5.7 | Remove Supabase secrets from Secrets Manager | 5.6 |
| 5.8 | Update CLAUDE.md, README.md, SETUP.md, QUICKSTART.md | 5.6 |
| 5.9 | Update `docs/deployment/SUPABASE-SETUP-GUIDE.md` (archive or delete) | 5.8 |
| 5.10 | Final verification: grep for any remaining Supabase references | 5.1-5.9 |
| 5.11 | Archive/pause Supabase project (don't delete yet) | 5.10 |
| 5.12 | After 30 days of stable AWS operation, delete Supabase project | 5.11 |

**Milestone**: Zero Supabase dependencies. Single-platform AWS infrastructure.

---

## Risk Gates Between Phases

Each phase has a "go/no-go" checkpoint:

| Gate | Criteria |
|------|----------|
| Phase 1 → 2 | All services on RDS, integration tests pass, no Supabase DB calls |
| Phase 2 → 3 | Auth works on Cognito, role-based access verified, no Supabase auth calls |
| Phase 3 → 4 | Realtime features work via polling, no Supabase realtime connections |
| Phase 4 → 5 | File storage on S3, no Supabase storage calls |
| Phase 5 → Done | Zero Supabase references in codebase, 30-day stability period |

## Rollback Triggers

Stop and roll back if any of these occur:

- Payment processing failure rate > 1%
- Authentication failure rate > 5%
- Data inconsistency between old and new systems
- Latency p95 > 1000ms (3x normal)
- Any data loss incident
