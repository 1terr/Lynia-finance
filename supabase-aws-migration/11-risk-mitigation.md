# 11 - Risk Mitigation

## Risk Register

### Risk 1: Data Loss During Migration

**Severity**: Critical
**Likelihood**: Low (if following procedure)

**Mitigation**:
- Take a full Supabase `pg_dump` backup before starting
- Verify row counts after import (per-table comparison)
- Keep Supabase running in read-only mode during cutover
- RDS has point-in-time recovery enabled (35-day retention in production)
- Store the `pg_dump` file in S3 as an additional backup

**Rollback**: Restore from Supabase backup. All data is in PostgreSQL format --
no proprietary lock-in.

### Risk 2: Authentication Disruption

**Severity**: High
**Likelihood**: Medium

Users can't access dashboards if auth migration fails.

**Mitigation**:
- Use lazy migration: try Cognito first, fall back to Supabase Auth
- Keep Supabase Auth running until all users have logged in via Cognito at
  least once
- Batch-import all users into Cognito before cutover, with temporary passwords
- Notify users of mandatory password reset via email
- Admin can manually create Cognito accounts for stragglers

**Rollback**: Revert frontend to Supabase auth SDK. Both auth systems coexist.

### Risk 3: Increased Latency (VPC Cold Starts)

**Severity**: Medium
**Likelihood**: High (VPC adds 1-2s cold start)

**Mitigation**:
- Provisioned concurrency already configured for Payment (5) and Scoring (3)
- Use VPC endpoints for AWS services to reduce NAT Gateway dependency
- Keep-alive Lambda invocations via CloudWatch Events (every 5 minutes)
- Monitor cold start rates via existing CloudWatch alarms

**Rollback**: Not needed -- this is a known tradeoff. Optimize rather than
roll back.

### Risk 4: Connection Pool Exhaustion

**Severity**: High
**Likelihood**: Medium

Lambda functions can create many concurrent DB connections. RDS `db.t4g.micro`
supports ~87 max connections.

**Mitigation**:
- Set `max: 5` connections per Lambda instance (in `pg.Pool` config)
- Set Lambda reserved concurrency: 100 total across all functions
- 5 connections x 100 instances = 500 theoretical max, but Lambda rarely hits
  100% concurrency simultaneously
- Monitor `DatabaseConnections` CloudWatch metric
- Alert at 80% of max connections
- If needed, add RDS Proxy ($18/month) which handles thousands of connections

**Rollback**: Reduce Lambda concurrency limits. Add RDS Proxy if needed.

### Risk 5: Payment Processing Failure

**Severity**: Critical
**Likelihood**: Low

Payment service is the most critical. Financial transactions must not be lost
or duplicated.

**Mitigation**:
- Migrate payment-service last (after all other services are proven)
- Idempotency keys already implemented -- duplicate processing is safe
- Run dual-write period: process payment on RDS, verify against Supabase
- Keep payment-specific integration tests running continuously during migration
- Manual verification of first 100 payments on new system
- Circuit breaker: automatically route to Supabase if RDS error rate > 1%

**Rollback**: Revert payment-service to Supabase client. Independent of other
services.

### Risk 6: RLS Removal Creates Security Gap

**Severity**: High
**Likelihood**: Medium

Removing database-level RLS means authorization depends entirely on
application code. A bug could expose unauthorized data.

**Mitigation**:
- Authorization middleware is centralized in one file (`authorization.ts`)
- Comprehensive unit test matrix covers all role/resource combinations
- API Gateway Cognito authorizer blocks unauthenticated requests
- Code review checklist requires authorization check verification
- (Optional) Re-implement RLS on RDS using session variables for
  defense-in-depth

**Rollback**: If a security issue is found, immediately add the affected
table's RLS policy back on RDS. Standard PostgreSQL RLS works on RDS.

### Risk 7: Cost Overrun

**Severity**: Low
**Likelihood**: Low

AWS costs could exceed expectations.

**Mitigation**:
- AWS Budgets alert at $50, $100, $200 thresholds
- Cost monitoring dashboard already configured in CloudWatch
- Use `fck-nat` instead of NAT Gateway (saves $29/month)
- Monthly cost review during first 3 months
- Free tier covers most services for first 12 months

**Rollback**: Not applicable -- optimize costs rather than roll back.

### Risk 8: Dual-Running Period Complexity

**Severity**: Medium
**Likelihood**: Medium

During migration, some services read from Supabase and others from RDS.
Data inconsistency is possible.

**Mitigation**:
- Migrate services in dependency order (notification → lock → whatsapp →
  kyc → scoring → payment)
- Each service is fully migrated before starting the next
- No dual-write for individual services -- each service uses one database
- Short migration windows per service (deploy + verify in same session)
- Use database transactions for critical operations

**Rollback**: Roll back individual services independently.

## Testing Strategy

### Before Migration

- [ ] Full backup of Supabase database
- [ ] Full backup of Supabase Auth users
- [ ] Document current performance baselines (latency, error rates)
- [ ] Verify all existing tests pass
- [ ] Set up monitoring dashboards for migration metrics

### During Migration (Per Phase)

- [ ] Run unit tests for modified code
- [ ] Run integration tests against new infrastructure
- [ ] Verify data integrity (row counts, checksums)
- [ ] Check CloudWatch for errors/warnings
- [ ] Verify latency is within acceptable range
- [ ] Test manually in staging before production

### After Migration

- [ ] Run full test suite (unit + integration + E2E)
- [ ] Verify all CloudWatch alarms are green
- [ ] Check cost monitoring dashboard
- [ ] Verify no Supabase connection attempts in logs
- [ ] Performance comparison: before vs after migration
- [ ] Security audit: verify all endpoints require auth
- [ ] 30-day stability monitoring before decommissioning Supabase

## Monitoring During Migration

### Key Metrics to Watch

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| API error rate | < 0.1% | > 1% | > 5% |
| API p95 latency | < 300ms | > 500ms | > 1000ms |
| DB connections | < 50 | > 70 | > 80 |
| Lambda errors | < 5/hour | > 20/hour | > 50/hour |
| Payment success rate | > 99% | < 98% | < 95% |

### Alerts to Add for Migration

```yaml
# Temporary migration-specific alarms
DatabaseConnectionSpike:
  Metric: DatabaseConnections
  Threshold: 60
  Period: 60
  Action: Warning

PaymentErrorDuringMigration:
  Metric: PaymentErrors
  Threshold: 3  # Lower threshold during migration
  Period: 300
  Action: Critical

SupabaseConnectionAttempt:
  # Log-based metric: any Lambda trying to connect to Supabase
  # after it should have been migrated
  LogPattern: "ghdrnxlsupbzoddtyxcp.supabase.co"
  Threshold: 1
  Action: Warning
```

## Communication Plan

| When | Who | What |
|------|-----|------|
| Before Phase 1 | Team | Migration plan review, assign responsibilities |
| Before Phase 2 | All admin users | Password reset notification (if batch migration) |
| During each phase | Team (Slack) | Real-time status updates |
| After each phase | Team | Phase completion report, go/no-go for next phase |
| After Phase 5 | All stakeholders | Migration complete, new architecture overview |

## Post-Migration Checklist

- [ ] All services running on AWS (RDS + Cognito + S3)
- [ ] No Supabase dependencies in `package.json` files
- [ ] No Supabase environment variables in production
- [ ] Documentation updated (CLAUDE.md, README, setup guides)
- [ ] Supabase project archived (not deleted)
- [ ] Cost monitoring in place
- [ ] Performance baseline established for new architecture
- [ ] Team trained on new infrastructure (Cognito, RDS, debugging)
- [ ] On-call runbook updated with new troubleshooting procedures
- [ ] 30-day stability period completed
- [ ] Supabase project deleted (after stability period)
