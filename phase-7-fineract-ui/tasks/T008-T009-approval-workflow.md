# T008-T009: Loan Approval Workflow

**Status**: COMPLETE
**Type**: Feature / UI Component
**Tests**: `src/__tests__/fineract/fineract-approval.test.tsx` (6 tests)
**Component**: `src/components/fineract/fineract-approval-page.tsx`
**Route**: `/fineract/approval`

## Objective

Build a dedicated loan approval queue page that shows all pending loan
applications from Fineract with approve/reject actions that trigger
Fineract state transitions.

## Features

### Approval Queue
- Lists all loans with status `submittedAndPendingApproval`
- Each loan shows:
  - Customer name, phone, Fineract ID
  - Product tier
  - Principal amount
  - Term (months)
  - Interest rate (per month)
  - Device (if assigned)
  - Submission date
- Pending approval count in header description

### Actions (per loan)
| Button | Style | Action |
|--------|-------|--------|
| Approve | Green solid | Opens confirmation modal |
| Reject | Red outline | Opens confirmation modal |

### Confirmation Modal
- Title: "Confirm Approval" or "Confirm Rejection"
- Icon: Green checkmark (approve) or red warning (reject)
- Description: Summarizes the action with customer name and amount
- Optional note textarea (approval notes or rejection reason)
- Cancel + Confirm buttons
- Loading state during API call

### API Integration
- **Approve**: Calls `approveFineractLoan()` with today's date and optional note
- On success: Invalidates query cache → refreshes the list
- Removes approved/rejected loans from the queue automatically

### Empty State
- Green checkmark icon
- "No loans pending approval" message
- "All caught up!" subtitle

### Real-time Updates
- 30-second auto-refresh via React Query `refetchInterval`
- New applications appear automatically

## Fineract State Machine Context

```
Submitted → [APPROVE] → Approved → [DISBURSE] → Active
         → [REJECT]  → Rejected
```

This page handles the `Submitted → Approved` and `Submitted → Rejected`
transitions. Disbursement is a separate action on the loan detail page.

## Test Coverage (6 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders pending loans | Customer names visible in queue |
| 2 | Shows approve/reject buttons | Both buttons rendered |
| 3 | Shows confirmation modal | Modal appears on approve click |
| 4 | Calls Fineract API on confirm | `approveFineractLoan` called with ID + date |
| 5 | Shows empty state | "No loans pending approval" when none |
| 6 | Shows loan product details | Tier name visible |

## Security Considerations

- Double-confirmation required (button click + modal confirm)
- Approval date set server-side (today's date), not user-editable
- Note field is optional but logged for audit trail
- Only staff with appropriate Cognito roles can access this page
