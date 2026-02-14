# Phase 8: Advanced Loan Features — Task Report

**Date:** February 14, 2026
**Branch:** `claude/advanced-loan-features-BCfAP`
**Status:** Complete

---

## Executive Summary

Phase 8 delivers three critical advanced loan management capabilities for Lynia Finance:

1. **Configurable Penalty System** — Rules engine for late fees, penalty interest, and collection fees with grace periods, caps, and recurrence controls
2. **Loan Write-Off Workflow** — Full/partial write-offs with multi-step approval, recovery tracking, and accounting journal references
3. **Enhanced Loan Rescheduling** — Term extension, rate reduction, payment holidays, balance restructuring, and combined reschedules with approval workflow

These features complete the loan lifecycle management needed for production operations in Zimbabwe's device financing market, where delinquency management and customer-centric restructuring are essential for both financial sustainability and social impact.

---

## Thinking Process & Design Decisions

### Why These Three Features Together

In microfinance and device-asset financing, the delinquency → penalty → restructure → write-off lifecycle is tightly coupled. A customer who is 10 days past due needs penalties applied (to incentivize payment), but also needs access to rescheduling (to offer a way out). If they reach 180 days, write-off is the final accounting treatment. Building these atomically ensures the system handles the full lifecycle without gaps.

### Penalty Configuration Architecture

**Decision: Rules engine over hardcoded values.**

Rather than hardcoding "a $2 late fee after 3 days," we built a configurable rules engine stored in the `penalty_configurations` table. This allows:

- Per-product penalty rules (smartphone financing vs. future products)
- Three calculation methods: flat amount, percentage of balance, tiered by DPD range
- Configurable grace periods (respects CLAUDE.md's customer-empathy mandate)
- Recurrence control (once per missed payment vs. daily accrual)
- Hard caps to prevent predatory penalty accumulation (global 25% cap on outstanding balance)
- Effective date ranges for regulatory compliance changes

**Decision: Grace period default of 3 days.**

Zimbabwe's informal workforce often receives income irregularly. A 3-day grace period balances the need for payment discipline with the reality of irregular cash flows. This is configurable per-product.

**Decision: Cumulative penalty cap at 25% of outstanding balance.**

Per RBZ guidelines and ethical lending principles, penalties should never exceed a reasonable fraction of the debt. The 25% global cap is enforced in code regardless of individual configuration rules, preventing compounding penalty scenarios.

### Write-Off Design

**Decision: Dual-approval workflow with self-approval prevention.**

Write-offs are irreversible financial decisions with accounting impact. The workflow requires:
1. A staff member **requests** the write-off
2. A **different** staff member **approves** it (self-approval blocked)
3. Only **admin** role can **reverse** an approved write-off

This follows the principle of separation of duties required for financial controls.

**Decision: Allowance method per GAAP.**

Write-offs use the allowance method (debit Allowance for Loan Losses, credit Loans Receivable) rather than the direct method. Each write-off record includes an `accounting_entry_ref` for GL journal entry traceability and an `allowance_amount` field.

**Decision: Recovery tracking post-write-off.**

Even after write-off, recovered amounts are tracked with timestamped notes. This is critical for:
- Accurate P&L reporting (recovered amounts reduce net loss)
- Credit bureau dispute resolution
- Compliance with RBZ 7-year record retention

### Rescheduling Architecture

**Decision: Enhanced rescheduling as a new table, not extending the existing restructure_requests.**

The Phase 3 `restructure_requests` table served its purpose but had limitations:
- JSONB terms without structured before/after snapshots
- No reschedule count enforcement
- No three-step approval workflow (request → approve → activate)
- No customer acknowledgement tracking

The new `loan_reschedules` table provides structured before/after term snapshots, configurable max-reschedule limits (default 3 per loan from `system_config`), and a three-step workflow.

**Decision: Three-step workflow (request → approve → activate).**

Unlike write-offs which take effect on approval, reschedules have a separate "activate" step. This allows:
- Customer acknowledgement between approval and activation
- Integration with Fineract before the terms actually change
- A review window for compliance to verify the reschedule

**Decision: Combined reschedule type.**

Real hardship cases often need both a term extension AND a rate reduction simultaneously. The `combined` type handles this in a single request rather than requiring two sequential reschedules (which would count against the limit).

---

## Deliverables

### 1. Database Migration (`020_advanced_loan_features.sql`)

**Tables created:**

| Table | Purpose | Key Design Points |
|-------|---------|-------------------|
| `penalty_configurations` | Penalty rules engine | Per-product or global, 3 calc methods, grace periods, caps |
| `loan_penalties` | Applied penalty records | Full lifecycle: applied → paid/waived/reversed |
| `loan_write_offs` | Write-off records | Approval workflow, accounting refs, recovery tracking |
| `loan_reschedules` | Reschedule records | Before/after term snapshots, 3-step workflow |

**Columns added to `loans` table:**
- `total_penalties_usd` — Running total of applied penalties
- `total_penalties_paid_usd` — Total penalties collected
- `total_penalties_waived_usd` — Total penalties waived
- `written_off_amount_usd` — Amount written off
- `write_off_date` — When write-off was applied
- `reschedule_count` — Number of times rescheduled
- `last_rescheduled_at` — Last reschedule timestamp
- `penalty_accrual_suspended` — Flag to suspend penalty accrual

**Default configuration data:**
- Standard $2 flat late fee (3-day grace, once per missed payment)
- $5 collection fee (applied once at 30 DPD)
- System config values for grace period, auto write-off threshold, max reschedules

### 2. Penalty Service (`penalty-service.ts`)

**Functions:**

| Function | Description |
|----------|-------------|
| `createPenaltyConfiguration()` | Create penalty rules with validation |
| `updatePenaltyConfiguration()` | Update existing rules |
| `getActivePenaltyConfigurations()` | Fetch active rules (global + product-specific) |
| `calculatePenalties()` | Compute applicable penalties without applying |
| `applyPenalties()` | Calculate and record penalties on a loan |
| `waivePenalty()` | Waive a specific penalty with reason |
| `getLoanPenalties()` | Fetch penalties for a loan |
| `getLoanPenaltySummary()` | Aggregate penalty statistics |

**Key behaviors:**
- Grace period respected before any penalty application
- Recurrence checking (once/daily/weekly/monthly eligibility)
- Per-application cap, percentage cap, and cumulative cap enforcement
- 25% global cap on total penalties vs. outstanding balance
- Atomic loan balance updates when penalties applied or waived
- Full audit logging for all operations

### 3. Write-Off Service (`write-off-service.ts`)

**Functions:**

| Function | Description |
|----------|-------------|
| `requestWriteOff()` | Create write-off request with validation |
| `approveWriteOff()` | Approve and apply write-off to loan |
| `rejectWriteOff()` | Reject with reason |
| `reverseWriteOff()` | Reverse approved write-off (admin only) |
| `getWriteOff()` | Fetch single write-off |
| `getLoanWriteOffs()` | All write-offs for a loan |
| `getPendingWriteOffs()` | Approval queue |
| `getWriteOffSummary()` | Portfolio-level write-off stats |
| `checkWriteOffEligibility()` | Auto-detect 180+ DPD eligibility |
| `recordRecovery()` | Track post-write-off recovery amounts |

**Key behaviors:**
- Validates loan status (only active/defaulted/disbursed)
- Prevents duplicate write-offs on same loan
- Full write-off must equal entire outstanding balance
- Self-approval prevention (requester ≠ approver)
- Accounting reference generation (WO-YYYYMMDD-LOANID-RAND)
- Atomic balance updates with raw SQL for consistency
- Recovery amount cannot exceed written-off amount

### 4. Reschedule Service (`reschedule-service.ts`)

**Functions:**

| Function | Description |
|----------|-------------|
| `requestReschedule()` | Create reschedule with term computation |
| `approveReschedule()` | Approve request |
| `activateReschedule()` | Apply new terms to loan |
| `rejectReschedule()` | Reject with reason |
| `cancelReschedule()` | Cancel pending request |
| `acknowledgeReschedule()` | Customer acknowledgement |
| `getReschedule()` | Fetch single reschedule |
| `getLoanReschedules()` | All reschedules for a loan |
| `getPendingReschedules()` | Approval queue |

**Reschedule types supported:**
- **Term extension**: 1-6 additional months, recalculated monthly payment
- **Rate reduction**: Lower interest rate, recalculated payment
- **Payment holiday**: 1-3 months pause, term extended accordingly
- **Balance restructure**: For hardship cases, 0% interest option
- **Combined**: Multiple adjustments in one request

**Key behaviors:**
- Max reschedule limit enforcement (default 3, from system_config)
- Prevents duplicate pending/active reschedules on same loan
- Before/after term snapshots for audit trail
- Maturity date recalculation
- Customer acknowledgement tracking

### 5. API Handler (`advanced-loan-handler.ts`)

**30+ API endpoints across four domains:**

**Penalty Config (4 routes):**
- `POST /loans/penalties/configurations` — Create config
- `GET /loans/penalties/configurations` — List active configs
- `GET /loans/penalties/configurations/{id}` — Get config
- `PUT /loans/penalties/configurations/{id}` — Update config

**Penalty Operations (5 routes):**
- `GET /loans/{loanId}/penalties/calculate` — Preview penalties
- `POST /loans/{loanId}/penalties/apply` — Apply penalties
- `GET /loans/{loanId}/penalties` — List penalties
- `GET /loans/{loanId}/penalties/summary` — Penalty stats
- `POST /loans/penalties/{id}/waive` — Waive penalty

**Write-Off Operations (10 routes):**
- `POST /loans/write-offs` — Request write-off
- `GET /loans/write-offs/pending` — Approval queue
- `GET /loans/write-offs/summary` — Portfolio stats
- `GET /loans/{loanId}/write-offs` — Loan write-offs
- `GET /loans/{loanId}/write-offs/eligibility` — Check eligibility
- `POST /loans/write-offs/{id}/approve` — Approve
- `POST /loans/write-offs/{id}/reject` — Reject
- `POST /loans/write-offs/{id}/reverse` — Reverse (admin only)
- `POST /loans/write-offs/{id}/recovery` — Record recovery
- `GET /loans/write-offs/{id}` — Get write-off

**Reschedule Operations (9 routes):**
- `POST /loans/reschedules` — Request reschedule
- `GET /loans/reschedules/pending` — Approval queue
- `GET /loans/{loanId}/reschedules` — Loan reschedules
- `POST /loans/reschedules/{id}/approve` — Approve
- `POST /loans/reschedules/{id}/activate` — Activate
- `POST /loans/reschedules/{id}/reject` — Reject
- `POST /loans/reschedules/{id}/cancel` — Cancel
- `POST /loans/reschedules/{id}/acknowledge` — Customer ack
- `GET /loans/reschedules/{id}` — Get reschedule

**Authorization matrix:**
| Operation | admin | manager | support | customer |
|-----------|-------|---------|---------|----------|
| Read (GET) | ✅ | ✅ | ✅ | ❌ |
| Write (POST/PUT) | ✅ | ✅ | ❌ | ❌ |
| Reverse write-off | ✅ | ❌ | ❌ | ❌ |
| Acknowledge reschedule | ✅ | ✅ | ✅ | ✅ |

### 6. Contract Tests (`advanced-loan-features.contract.test.ts`)

**30 tests covering:**
- Penalty configuration CRUD with validation
- Penalty calculation for eligible and ineligible loans
- Penalty waiver with reason enforcement
- Write-off creation, approval, rejection
- Write-off self-approval prevention
- Write-off reversal (admin-only enforcement)
- Write-off eligibility detection
- Reschedule creation with term computation
- Reschedule status validation
- Max reschedule limit enforcement
- Authorization (unauthenticated, support-read, support-denied-write)
- Unknown route 404 handling

**All 30 tests passing, 0 regressions introduced.**

---

## Error Code Registry (Phase 8 additions)

| Code | Service | Description |
|------|---------|-------------|
| `PENALTY_CONFIG_001` | Penalty | Failed to create configuration |
| `PENALTY_CONFIG_002` | Penalty | Configuration not found |
| `PENALTY_CONFIG_003` | Penalty | Failed to fetch configurations |
| `PENALTY_VAL_001-006` | Penalty | Validation errors |
| `PENALTY_LOAN_001` | Penalty | Loan not found for penalty |
| `PENALTY_WAIVER_001-004` | Penalty | Waiver validation/execution errors |
| `PENALTY_FETCH_001` | Penalty | Failed to fetch penalties |
| `WRITEOFF_LOAN_001` | Write-Off | Loan not found |
| `WRITEOFF_STATUS_001` | Write-Off | Invalid loan status for write-off |
| `WRITEOFF_DUP_001` | Write-Off | Duplicate write-off |
| `WRITEOFF_AMT_001-003` | Write-Off | Amount validation errors |
| `WRITEOFF_CREATE_001` | Write-Off | Failed to create |
| `WRITEOFF_APPROVE_001-004` | Write-Off | Approval errors (including self-approval) |
| `WRITEOFF_REJECT_001-004` | Write-Off | Rejection errors |
| `WRITEOFF_REVERSE_001-004` | Write-Off | Reversal errors |
| `WRITEOFF_RECOVERY_001-005` | Write-Off | Recovery recording errors |
| `WRITEOFF_ELIG_001` | Write-Off | Eligibility check error |
| `RESCHED_TYPE_001` | Reschedule | Invalid reschedule type |
| `RESCHED_REASON_001` | Reschedule | Invalid reason |
| `RESCHED_LOAN_001` | Reschedule | Loan not found |
| `RESCHED_STATUS_001` | Reschedule | Invalid loan status |
| `RESCHED_LIMIT_001` | Reschedule | Max reschedules reached |
| `RESCHED_DUP_001` | Reschedule | Duplicate pending reschedule |
| `RESCHED_TERM_001` | Reschedule | Invalid term extension |
| `RESCHED_RATE_001-002` | Reschedule | Invalid rate reduction |
| `RESCHED_HOLIDAY_001` | Reschedule | Invalid payment holiday |

---

## Files Modified / Created

| File | Action | Lines |
|------|--------|-------|
| `database/migrations/020_advanced_loan_features.sql` | Created | 226 |
| `services/payment-service/src/penalty-service.ts` | Created | 485 |
| `services/payment-service/src/write-off-service.ts` | Created | 462 |
| `services/payment-service/src/reschedule-service.ts` | Created | 490 |
| `services/payment-service/src/advanced-loan-handler.ts` | Created | 620 |
| `tests/contract/advanced-loan-features.contract.test.ts` | Created | 630 |
| `services/shared/middleware/authorization.ts` | Fixed | 2 (type cast fix) |
| `research/task-summaries/payments/PHASE8-ADVANCED-LOAN-FEATURES-SUMMARY.md` | Created | This file |

---

## Integration Points

### Fineract Sync Ready
All three tables include `fineract_*_id` and `fineract_synced_at` columns for bidirectional sync with Apache Fineract CBS. The penalty service maps to Fineract charges, write-offs to loan transactions, and reschedules to Fineract's rescheduleLoan API.

### Notification Hooks
Each major state change (penalty applied, write-off approved, reschedule activated) writes to the audit log. A future SQS consumer can trigger WhatsApp notifications to customers based on these audit events.

### Admin Portal Ready
All endpoints follow the standardized `successResponse`/`errorResponse` pattern with security headers, making them immediately consumable by the Next.js admin portal for building approval queues, penalty management dashboards, and write-off reporting views.
