# Site Audit 1.5 — Deployment Checklist

**Date:** 2026-03-15

---

## Pre-Deploy Checks

- [x] All changes committed and pushed to master
- [x] No resource name conflicts (checked Lambda names, dashboard names, queue names)
- [x] GitHub secrets configured for production environment
- [x] Stack in deployable state (not ROLLBACK_COMPLETE)
- [x] All tests passing (68 fineract-proxy tests, 222+ admin tests), 0 regressions
- [x] No hardcoded secrets in committed code
- [x] SAM events use `{proxy+}` pattern (no individual route events needed)

---

## Commits Included in This Deploy

| Commit | Description | Window |
|--------|-------------|--------|
| `71693a81` | Payment admin backend — 12 handlers + SAM routes | A |
| `c01c2917` | Error handling audit + frontend API client tests | D |
| `f80dcee9` | Fineract error test compatibility fix | D |
| `0adec4ae` | Reports, device locks, handovers, customer update + fineract loan actions | B+C |

---

## Deploy Process

### Stage 1: CI/CD Pipeline (Automatic on push to master)

```
GitHub Actions Workflow: "Deploy to AWS"
  ├── sam validate
  ├── sam build --cached --parallel
  ├── pnpm test (full suite)
  └── sam deploy --config-env staging --no-confirm-changeset --no-fail-on-empty-changeset
```

### Stage 2: Staging Verification

```bash
# Payment endpoints
curl -H "Authorization: Bearer $TOKEN" $STAGING_API/api/v1/payments?page=1&limit=5
curl -H "Authorization: Bearer $TOKEN" $STAGING_API/api/v1/payments/stats

# Report endpoints
curl -H "Authorization: Bearer $TOKEN" $STAGING_API/api/v1/reports/portfolio
curl -H "Authorization: Bearer $TOKEN" $STAGING_API/api/v1/reports/kyc

# Device lock endpoints
curl -H "Authorization: Bearer $TOKEN" $STAGING_API/admin/devices/$DEVICE_ID/lock-history

# Device handover endpoints
curl -H "Authorization: Bearer $TOKEN" $STAGING_API/admin/devices/handovers?page=1

# Customer update
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  $STAGING_API/api/v1/customers/$ID -d '{"first_name":"Test"}'

# Fineract actions (test with dry-run if available)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  $STAGING_API/api/v1/fineract/loans/$LOAN_ID/reject -d '{"rejectedOnDate":"2026-03-15","note":"test"}'
```

### Stage 3: Production Deploy

```bash
sam deploy --config-env production \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --on-failure ROLLBACK
```

### Stage 4: Production Verification

1. Open admin portal: `https://d1qwfy2tsdmpe4.cloudfront.net`
2. Navigate to each previously broken page:
   - [ ] `/payments` — Payment list loads
   - [ ] `/payments/collections` — Collections queue loads
   - [ ] `/payments/reconciliation` — Unreconciled payments load
   - [ ] `/payments/:id` — Payment detail loads
   - [ ] `/reports` — All 7 report tabs load
   - [ ] `/devices/lock-unlock` — Lock/unlock controls load
   - [ ] `/devices/handovers` — Handover list loads
3. Check browser console for errors
4. Verify no 500 error responses leak stack traces

---

## Rollback Procedure

If production deploy fails or causes issues:

```bash
# 1. Check stack status
aws cloudformation describe-stacks --stack-name lynia-finance-prod \
  --query 'Stacks[0].StackStatus' --output text

# 2. If UPDATE_ROLLBACK_COMPLETE, the stack auto-rolled back.
#    Investigate the cause and re-deploy.

# 3. If stuck in UPDATE_IN_PROGRESS, wait or cancel:
aws cloudformation cancel-update-stack --stack-name lynia-finance-prod

# 4. To manually revert, deploy the previous commit:
git log --oneline -5  # Find the previous good commit
git revert HEAD       # Create a revert commit
git push              # Trigger re-deploy
```

---

## Post-Deploy Monitoring

- [ ] CloudWatch error rate < 0.1% for 30 minutes
- [ ] No new 500/502 errors in Lambda logs
- [ ] API Gateway latency p95 < 300ms
- [ ] No alert pages from monitoring dashboard
