# Linear Import Instructions: Phase 1 Tasks P1-T031 to P1-T045

## Option 1: Automated Import (Recommended) ⚡

### Step 1: Get Your Linear API Key

1. Go to https://linear.app/settings/api
2. Click **"Create new Personal API Key"**
3. Give it a name: `Lynia Finance Import`
4. Copy the generated API key

### Step 2: Set Environment Variable

**Windows (PowerShell)**:
```powershell
$env:LINEAR_API_KEY="lin_api_your_key_here"
```

**Windows (CMD)**:
```cmd
set LINEAR_API_KEY=lin_api_your_key_here
```

**Linux/Mac**:
```bash
export LINEAR_API_KEY="lin_api_your_key_here"
```

### Step 3: Run Import Script

```bash
cd "c:\Users\Admin\Documents\Lynia Finance Project\Lynia Finance Dev"
node scripts/import-to-linear.js
```

The script will:
- ✅ Automatically detect your Linear team
- ✅ Create all 15 tasks (P1-T031 to P1-T045)
- ✅ Set titles, descriptions, priorities, and estimates
- ✅ Provide URLs to created tasks

**Expected Output**:
```
═══════════════════════════════════════════════════════
  Linear Import: Phase 1 Tasks P1-T031 to P1-T045
═══════════════════════════════════════════════════════

✓ Using team: Engineering (ENG)

Importing 15 tasks...

✓ Created ENG-123: P1-T031: Privacy & Consent Management
  URL: https://linear.app/your-workspace/issue/ENG-123
✓ Created ENG-124: P1-T032: Device Catalog Design
  URL: https://linear.app/your-workspace/issue/ENG-124
...

═══════════════════════════════════════════════════════
✓ Import complete! Created 15/15 tasks
═══════════════════════════════════════════════════════
```

---

## Option 2: Manual Import (Copy-Paste) 📋

If the automated script doesn't work, manually create each task in Linear:

### 1. P1-T031: Privacy & Consent Management

**Click "New Issue" in Linear, then copy-paste:**

**Title**: `P1-T031: Privacy & Consent Management`

**Description**:
```markdown
Design privacy and consent management framework for customer data handling.

## Acceptance Criteria
- [ ] Privacy policy document created
- [ ] Consent collection flow designed
- [ ] Data retention policies defined
- [ ] GDPR/POPIA compliance reviewed
- [ ] Customer data access/deletion workflows designed

**Specification File**: planning/privacy-consent-management.md
**GitHub Issue**: #104
```

**Priority**: High
**Estimate**: 4 points
**Labels**: `phase-1`, `kyc`, `high-priority`

---

### 2. P1-T032: Device Catalog Design

**Title**: `P1-T032: Device Catalog Design`

**Description**:
```markdown
Design device catalog structure including device specifications, pricing, and inventory management.

## Acceptance Criteria
- [ ] Device catalog schema designed
- [ ] Device pricing model defined
- [ ] Device specifications template created
- [ ] Inventory tracking approach defined
- [ ] Device availability logic designed
- [ ] Multi-product support (Smartphone Financing)

## Key Requirements
- Support for multiple device types (smartphones, tablets)
- Device attributes: brand, model, storage, color, condition
- Pricing: retail_price, loan_amount, deposit_amount (20%)
- Inventory tracking per distributor
- Device images and descriptions

**Specification File**: planning/device-catalog-design.md
**GitHub Issue**: #105
```

**Priority**: High
**Estimate**: 6 points
**Labels**: `phase-1`, `device-management`, `high-priority`

---

### 3. P1-T033: Device Lock/Unlock Integration ⭐ CRITICAL

**Title**: `P1-T033: Device Lock/Unlock Integration`

**Description**:
```markdown
Design integration with device lock/unlock APIs (Google Find My Device, Samsung Knox) for payment enforcement.

## Acceptance Criteria
- [ ] Device lock API options researched (Google, Samsung, MDM)
- [ ] Lock/unlock trigger logic designed
- [ ] Lock notification flow designed
- [ ] Unlock upon payment confirmation designed
- [ ] Manual admin override workflow designed
- [ ] Lock event audit trail designed

## Key Requirements
- Automated lock after 7 days overdue
- Lock notification to customer (WhatsApp)
- Automatic unlock upon payment confirmation
- Admin manual unlock capability
- Lock status tracking in database
- Support for Google and Samsung devices

## Lock Triggers
- Payment is 7+ days overdue
- Loan marked as defaulted by admin

## Unlock Triggers
- Overdue payment received and confirmed
- Admin manual override (dispute resolution)

**Specification File**: planning/device-lock-unlock-integration.md
**GitHub Issue**: #106
```

**Priority**: Critical
**Estimate**: 8 points
**Labels**: `phase-1`, `device-management`, `critical`

---

### 4. P1-T034: Device Handover Process

**Title**: `P1-T034: Device Handover Process`

**Description**:
```markdown
Design device handover process from distributor to customer with mandatory deposit enforcement.

## Acceptance Criteria
- [ ] Handover workflow designed (10 steps)
- [ ] Deposit verification logic designed (CRITICAL: blocks handover if not paid)
- [ ] Distributor notification system designed
- [ ] Device verification checklist created
- [ ] Serial number tracking designed
- [ ] Handover confirmation process designed
- [ ] Repayment schedule generation designed

## Key Requirements
**CRITICAL**: NO CASH ON DELIVERY - deposit must be confirmed before handover
- Deposit amount: 20% of device value
- Distributor confirms device availability
- Customer identity verification at pickup
- Device serial number linked to loan
- Loan status changes to 'active' after handover
- Repayment schedule starts after handover

## 10-Step Flow
1. Customer completes onboarding (loan approved)
2. Customer pays deposit via mobile money
3. System verifies deposit payment
4. System notifies distributor
5. Distributor confirms device availability
6. System schedules appointment
7. Customer arrives at location
8. Distributor verifies identity
9. Device handover
10. Mark complete → loan active

**Specification File**: planning/device-handover-process.md
**GitHub Issue**: #107
```

**Priority**: High
**Estimate**: 6 points
**Labels**: `phase-1`, `device-management`, `high-priority`

---

### 5. P1-T035: Device Return/Repossession Flow

**Title**: `P1-T035: Device Return/Repossession Flow`

**Description**:
```markdown
Design device return and repossession workflows for defaults and voluntary returns.

## Acceptance Criteria
- [ ] Voluntary return process designed
- [ ] Repossession trigger logic designed (30+ days default)
- [ ] Device recovery workflow designed
- [ ] Device condition check process designed
- [ ] Refund/settlement calculation designed
- [ ] Return notification flows designed

## Key Requirements
- Voluntary return option (early termination)
- Automated repossession trigger (30+ days overdue)
- Device condition assessment upon return
- Settlement calculation (loan balance - device value)
- Distributor role in device recovery
- Device refurbishment and resale process

## Repossession Triggers
- Payment overdue 30+ days
- Customer requests voluntary return
- Fraud/breach of terms detected

**Specification File**: planning/device-return-repossession-flow.md
**GitHub Issue**: #108
```

**Priority**: Medium
**Estimate**: 4 points
**Labels**: `phase-1`, `device-management`, `medium-priority`

---

### 6. P1-T036: Device Condition Assessment

**Title**: `P1-T036: Device Condition Assessment`

**Description**:
```markdown
Design device condition assessment criteria and workflow for returns and trade-ins.

## Acceptance Criteria
- [ ] Device condition criteria defined (excellent, good, fair, poor)
- [ ] Condition assessment checklist created
- [ ] Photo documentation requirements defined
- [ ] Value adjustment logic designed
- [ ] Condition tracking in database designed

## Condition Grades
- **Excellent**: 100% value
- **Good**: 80% value
- **Fair**: 60% value
- **Poor**: 40% value
- **Damaged**: 20% value

## Assessment Criteria
- Screen condition
- Battery health
- Body/frame condition
- Functionality (buttons, ports, camera)

**Specification File**: planning/device-condition-assessment.md
**GitHub Issue**: #109
```

**Priority**: Low
**Estimate**: 4 points
**Labels**: `phase-1`, `device-management`, `low-priority`

---

### 7. P1-T037: Multi-Channel Notification Design

**Title**: `P1-T037: Multi-Channel Notification Design`

**Description**:
```markdown
Design multi-channel notification system (WhatsApp, SMS, Email) with fallback logic.

## Acceptance Criteria
- [ ] Notification channels defined (WhatsApp primary, SMS fallback)
- [ ] Channel priority/fallback logic designed
- [ ] Notification delivery tracking designed
- [ ] Failed delivery retry logic designed
- [ ] Notification preferences management designed
- [ ] Opt-out/unsubscribe logic designed

## Notification Channels
1. **WhatsApp** (Primary) - Rich media, interactive, cheapest
2. **SMS** (Fallback) - Guaranteed delivery, no internet required
3. **Email** (Admin only) - Reports, alerts, documentation

## Requirements
- Delivery status tracking (sent, delivered, read, failed)
- Retry logic (3 attempts with exponential backoff)
- Customer notification preferences
- Zimbabwe communications compliance

**Specification File**: planning/multi-channel-notification-design.md
**GitHub Issue**: #110
```

**Priority**: High
**Estimate**: 6 points
**Labels**: `phase-1`, `notifications`, `high-priority`

---

### 8. P1-T038: Notification Templates & Triggers

**Title**: `P1-T038: Notification Templates & Triggers`

**Description**:
```markdown
Design notification templates and automated trigger events for all customer touchpoints.

## Acceptance Criteria
- [ ] All notification templates created (15+ templates)
- [ ] Trigger events defined
- [ ] Template variables identified
- [ ] Multi-language support designed (English, Shona)
- [ ] Template versioning designed
- [ ] A/B testing approach designed

## Template Types
**Onboarding**: Welcome, OTP, KYC confirmation, Loan decision, Payment instructions
**Payment**: Reminders, Received confirmation, Overdue notices, Lock warnings
**Device**: Ready for pickup, Appointment, Handover complete, Unlock notification
**Support**: Ticket created, Ticket resolved, Account updates

## Template Variables
{customer_name}, {loan_amount}, {payment_amount}, {due_date}, {device_name}, {distributor_location}

**Languages**: English, Shona

**Specification File**: planning/notification-templates-triggers.md
**GitHub Issue**: #111
```

**Priority**: High
**Estimate**: 6 points
**Labels**: `phase-1`, `notifications`, `high-priority`

---

### 9. P1-T039: Payment Reminder Strategy

**Title**: `P1-T039: Payment Reminder Strategy`

**Description**:
```markdown
Design payment reminder strategy and escalation logic to reduce defaults.

## Acceptance Criteria
- [ ] Reminder schedule designed (7, 3, 1 days before due date)
- [ ] Escalation logic designed (1, 7, 14, 30 days overdue)
- [ ] Reminder messaging tone defined
- [ ] Grace period logic designed
- [ ] Device lock warning timeline designed
- [ ] Default prevention tactics designed

## Pre-Due Date Reminders
- **7 days before**: Friendly reminder
- **3 days before**: Reminder with payment options
- **1 day before**: Urgent reminder

## Post-Due Date Escalation
- **Day 1**: Polite reminder (grace period)
- **Day 3**: Firmer reminder
- **Day 5**: Device lock warning
- **Day 7**: Device locked + escalation notice
- **Day 14**: Collection notice
- **Day 30**: Default + repossession warning

## Tone Escalation
Friendly & helpful → Professional → Urgent but respectful → Formal collection

**Specification File**: planning/payment-reminder-strategy.md
**GitHub Issue**: #112
```

**Priority**: High
**Estimate**: 4 points
**Labels**: `phase-1`, `notifications`, `high-priority`

---

### 10. P1-T040: Notification Queue Management

**Title**: `P1-T040: Notification Queue Management`

**Description**:
```markdown
Design notification queue and delivery management system for reliability and scale.

## Acceptance Criteria
- [ ] Notification queue architecture designed (SQS/RabbitMQ)
- [ ] Priority queue logic designed
- [ ] Rate limiting strategy designed
- [ ] Dead letter queue designed
- [ ] Notification batching logic designed
- [ ] Queue monitoring designed

## Queue System
- Queue: AWS SQS or RabbitMQ
- Priority levels: Critical, High, Normal, Low
- Rate limiting (WhatsApp: 80 msg/sec, SMS: provider-dependent)
- Retry logic with exponential backoff
- Dead letter queue for failed messages
- Batch processing for bulk notifications

## Queue Priorities
- **Critical**: OTP, device lock, payment confirmation
- **High**: Payment reminders, loan approval/rejection
- **Normal**: General updates, support responses
- **Low**: Marketing, tips, education

**Specification File**: planning/notification-delivery-tracking.md
**GitHub Issue**: #113
```

**Priority**: Medium
**Estimate**: 4 points
**Labels**: `phase-1`, `notifications`, `medium-priority`

---

### 11. P1-T041: Admin Dashboard Wireframes

**Title**: `P1-T041: Admin Dashboard Wireframes`

**Description**:
```markdown
Design admin dashboard wireframes and user interface layouts for all management features.

## Acceptance Criteria
- [ ] Dashboard overview wireframe created
- [ ] Customer management wireframes created
- [ ] Loan management wireframes created
- [ ] Payment management wireframes created
- [ ] Device management wireframes created
- [ ] Reporting wireframes created
- [ ] Navigation structure defined
- [ ] Responsive design approach defined

## Key Screens
1. **Dashboard Overview**: KPIs, activity feed, alerts, quick actions
2. **Customer Management**: List, detail view, KYC docs, credit history
3. **Loan Management**: List, detail, payment history, approve/reject
4. **Payment Management**: List, detail, manual recording, reconciliation
5. **Device Management**: List, detail, lock/unlock controls
6. **Reporting**: Disbursement, collection, defaults, KYC, devices

## Design Requirements
- Clean, modern UI
- Mobile responsive
- Dark mode support
- Accessibility (WCAG 2.1 AA)
- Fast load times (<2 seconds)

**Specification File**: planning/admin-dashboard-overview.md
**GitHub Issue**: #114
```

**Priority**: Medium
**Estimate**: 8 points
**Labels**: `phase-1`, `admin-dashboard`, `medium-priority`

---

### 12. P1-T042: Admin User Roles & Permissions

**Title**: `P1-T042: Admin User Roles & Permissions`

**Description**:
```markdown
Design role-based access control (RBAC) system for admin users with granular permissions.

## Acceptance Criteria
- [ ] Admin roles defined (Super Admin, Manager, Support)
- [ ] Permission matrix created
- [ ] Role assignment workflow designed
- [ ] Permission enforcement logic designed
- [ ] Audit trail for admin actions designed
- [ ] Role management UI designed

## Admin Roles

### Super Admin (Full Access)
All permissions + user management + system config + delete operations

### Manager (Operations)
View all data, approve/reject loans, record payments, lock/unlock devices, generate reports
Cannot: Delete data, manage users, change system config

### Support (Read-only + Limited)
View customers/loans/payments, add notes, create support tickets
Cannot: Approve loans, record payments, delete data

## Audit Trail
- Log all admin actions
- Track who, what, when, why
- Immutable audit log
- Admin action history per record

**Specification File**: planning/admin-user-roles-permissions.md
**GitHub Issue**: #115
```

**Priority**: High
**Estimate**: 4 points
**Labels**: `phase-1`, `admin-dashboard`, `high-priority`

---

### 13. P1-T043: Reporting Requirements

**Title**: `P1-T043: Reporting Requirements`

**Description**:
```markdown
Define reporting requirements and dashboard analytics for business intelligence.

## Acceptance Criteria
- [ ] Core reports identified (7 reports)
- [ ] Report filters defined (product, date range, status)
- [ ] Report data sources mapped
- [ ] Export formats defined (CSV, PDF)
- [ ] Report scheduling designed
- [ ] Performance metrics defined

## Core Reports (Phase 2)
1. **Loan Disbursement**: Total loans, filter by product/date/distributor, approval rate
2. **Payment Collection**: Total payments, filter by product/date/method, on-time rate
3. **Default Rate**: Default % by product, aging analysis (30/60/90+ days)
4. **KYC Status**: Verification stats, pending/verified/rejected, avg time
5. **Device Management**: Stock/assigned/locked, filter by distributor/type
6. **Customer Acquisition**: New customers, source tracking, onboarding completion
7. **Portfolio Health**: Active loans, outstanding balance, PAR 30/90, collection efficiency

## Report Filters
Date range, Product (Smartphone/Digital Credit), Distributor, Status, Tier

## Export Formats
CSV (Excel), PDF (printing/sharing)

**NO P&L or Balance Sheet** (moved to Phase 4)

**Specification File**: planning/reporting-requirements.md
**GitHub Issue**: #116
```

**Priority**: Medium
**Estimate**: 6 points
**Labels**: `phase-1`, `admin-dashboard`, `medium-priority`

---

### 14. P1-T044: Manual Review Workflows

**Title**: `P1-T044: Manual Review Workflows`

**Description**:
```markdown
Design manual review workflows for loan applications requiring human judgment.

## Acceptance Criteria
- [ ] Review trigger conditions defined
- [ ] Review queue design created
- [ ] Review checklist created
- [ ] Decision workflow designed (approve, reject, request info)
- [ ] Review SLA defined (1-2 business days)
- [ ] Review notification flows designed

## Review Triggers
1. **Credit Score in Review Range**: 600-649 (below auto-approval)
2. **KYC Issues**: Poor document quality, inconclusive verification, low selfie match
3. **Affordability Concerns**: DTI 40-50%, requested amount exceeds tier limit
4. **Fraud Flags**: Duplicate phone, suspicious docs, multiple applications
5. **Admin Override**: Disputes, special circumstances, policy exceptions

## Review Workflow
1. Application enters review queue → Customer notified
2. Manager reviews → Checklist completed → Decision made
3. Approve (set limit), Reject (reason code), or Request Info
4. Customer notified with next steps

## Review SLA
- **Target**: 1 business day
- **Maximum**: 2 business days
- **Escalation**: If >2 days

**Specification File**: planning/manual-review-workflows.md
**GitHub Issue**: #117
```

**Priority**: High
**Estimate**: 6 points
**Labels**: `phase-1`, `admin-dashboard`, `high-priority`

---

### 15. P1-T045: Admin Notification System

**Title**: `P1-T045: Admin Notification System`

**Description**:
```markdown
Design notification system for admin users to receive alerts and updates.

## Acceptance Criteria
- [ ] Admin notification types defined
- [ ] Notification channels designed (email, in-app)
- [ ] Notification preferences system designed
- [ ] Alert priority levels defined
- [ ] Notification aggregation logic designed
- [ ] Admin notification UI designed

## Notification Types

### Critical Alerts (Immediate)
System errors/downtime, payment gateway failures, fraud alerts, failed logins

### High Priority (Within 1 hour)
Loan applications in review, KYC failures, payment disputes, device lock failures

### Medium Priority (Daily digest)
New applications, payments received, overdue payments (7+ days), support tickets

### Low Priority (Weekly digest)
System usage stats, performance metrics, portfolio health updates

## Notification Channels
1. **In-App** (Real-time): Bell icon, notification center, toast for critical
2. **Email** (Configurable): Immediate/hourly/daily/weekly digests
3. **SMS** (Critical only): Downtime, security breaches, fraud

## Notification Preferences
- Per-user settings
- Channel preferences (email, SMS, in-app)
- Frequency (real-time, hourly, daily)
- Do Not Disturb hours
- Categories on/off

**Specification File**: planning/admin-notification-system.md
**GitHub Issue**: #118
```

**Priority**: Low
**Estimate**: 4 points
**Labels**: `phase-1`, `admin-dashboard`, `low-priority`

---

## Quick Reference Summary

| Task | Title | Priority | Hours | Category |
|------|-------|----------|-------|----------|
| P1-T031 | Privacy & Consent Management | High | 4 | KYC |
| P1-T032 | Device Catalog Design | High | 6 | Device Management |
| P1-T033 | Device Lock/Unlock Integration | **Critical** | 8 | Device Management |
| P1-T034 | Device Handover Process | High | 6 | Device Management |
| P1-T035 | Device Return/Repossession Flow | Medium | 4 | Device Management |
| P1-T036 | Device Condition Assessment | Low | 4 | Device Management |
| P1-T037 | Multi-Channel Notification Design | High | 6 | Notifications |
| P1-T038 | Notification Templates & Triggers | High | 6 | Notifications |
| P1-T039 | Payment Reminder Strategy | High | 4 | Notifications |
| P1-T040 | Notification Queue Management | Medium | 4 | Notifications |
| P1-T041 | Admin Dashboard Wireframes | Medium | 8 | Admin Dashboard |
| P1-T042 | Admin User Roles & Permissions | High | 4 | Admin Dashboard |
| P1-T043 | Reporting Requirements | Medium | 6 | Admin Dashboard |
| P1-T044 | Manual Review Workflows | High | 6 | Admin Dashboard |
| P1-T045 | Admin Notification System | Low | 4 | Admin Dashboard |

**Total**: 15 tasks, 76 hours

---

## After Import

Once tasks are in Linear:

1. **Create Project**: "Phase 1: Architecture & Design"
2. **Link to GitHub**: Add GitHub issue links (#104-118)
3. **Set Dependencies**: Link to Phase 2 implementation tasks
4. **Assign Owners**: Distribute tasks to team members
5. **Set Timeline**: Based on 4-week Phase 1 schedule

---

**Created**: December 2, 2025
**Source**: PHASE-1-LINEAR-TASKS-P31-P45.md
**GitHub Issues**: #104-118
