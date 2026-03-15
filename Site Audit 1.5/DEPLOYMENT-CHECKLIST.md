# Deployment Checklist

**Date:** 2026-03-15
**Sprint:** Site Audit 1.5

---

## Pre-Deploy Checks

- [x] All changes committed and pushed to master
- [x] `sam validate` passes with no errors
- [x] All tests pass (`pnpm test` — 100% pass rate)
- [x] CI/CD pipeline — all workflows green
- [x] No resource name conflicts (Lambda names, dashboard names, queue names)
- [x] GitHub secrets configured for production
- [x] Stack is in deployable state (not ROLLBACK_COMPLETE)
- [x] No destructive database migrations

---

## Deployment Steps Completed

### 1. Backend Lambda Deploy (SAM)

```bash
sam deploy --config-env production \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --on-failure ROLLBACK
```

**Status:** SUCCESS
**Stack:** `lynia-finance-prod`
**Changes deployed:**
- 12 new payment admin handlers
- 12 new report handlers
- 4 new device lock handlers
- 2 new device handover handlers
- 1 new customer update handler
- 3 new Fineract loan action handlers (reject/writeoff/close)
- 1 new Fineract product creation handler
- 8 new SAM API Gateway events
- Updated route maps in admin-service and fineract-proxy-service

### 2. Frontend Deploy (S3 + CloudFront)

**Status:** SUCCESS (via Deploy Frontend workflow)
**Distribution:** `d1qwfy2tsdmpe4.cloudfront.net`

### 3. CI/CD Workflows

| Workflow | Status | Duration |
|----------|--------|----------|
| Test & Build | SUCCESS | ~5m |
| Deploy to AWS | SUCCESS | ~6m |
| Validate Domain References | SUCCESS | 9s |
| Deploy Frontend (Blue-Green) | SUCCESS | ~4m |

---

## Post-Deploy Verification

### API Gateway Endpoints

| Endpoint Group | Base URL | Status |
|----------------|----------|--------|
| Main API | `https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/` | Active |
| Payments | `/api/v1/payments` | 200 OK |
| Reports | `/api/v1/reports/*` | 200 OK |
| Device Locks | `/admin/devices/:id/lock-history` | 200 OK |
| Handovers | `/admin/devices/handovers` | 200 OK |
| Fineract Actions | `/api/v1/fineract/loans/:id/reject` | Ready |

### Frontend Pages (CloudFront)

| Page | URL Path | Status |
|------|----------|--------|
| Dashboard | `/` | Working |
| Payments | `/payments` | Working |
| Collections | `/payments/collections` | Working |
| Reconciliation | `/payments/reconciliation` | Working |
| Reports | `/reports` | Working |
| Device Lock/Unlock | `/devices/lock-unlock` | Working |
| Device Handovers | `/devices/handovers` | Working |

---

## Rollback Plan

### Option A: Automatic CloudFormation Rollback
```bash
# CloudFormation automatically rolls back on failure
sam deploy --on-failure ROLLBACK
```

### Option B: Manual Rollback to Previous Version
```bash
git log --oneline -5
git checkout <previous-commit-hash>
sam build --cached --parallel
sam deploy --config-env production --no-confirm-changeset
```

### Option C: Frontend Rollback
```bash
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/*"
```

---

## Production Stack Health

| Stack | Status | Resources |
|-------|--------|-----------|
| `lynia-finance-prod` | UPDATE_COMPLETE | ~60 resources |
| `production-lynia-sqs` | CREATE_COMPLETE | 14 queues |
| `production-lynia-fineract-ecs` | CREATE_COMPLETE | ECS + ALB |
| `production-lynia-cognito` | CREATE_COMPLETE | User Pool |
| `lynia-rds-production` | CREATE_COMPLETE | PostgreSQL 16 |
| `production-lynia-vpc` | CREATE_COMPLETE | VPC + subnets |
| `lynia-finance-prod-frontend` | UPDATE_COMPLETE | S3 + CloudFront |
| `lynia-finance-production-waf` | CREATE_COMPLETE | WAF rules |
