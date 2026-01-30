# Phase 1 Linear Tasks: P1-T031 to P1-T045

**Import Instructions**: Copy each task below and create them in Linear with the specified details.

---

## 1.5 KYC & Onboarding Design

### P1-T031: Privacy & Consent Management
**Linear Title**: P1-T031: Privacy & Consent Management
**Priority**: High
**Estimate**: 4 hours
**Labels**: phase-1, kyc, high-priority
**Status**: Todo
**Description**:
Design privacy and consent management framework for customer data handling.

**Acceptance Criteria**:
- [ ] Privacy policy document created
- [ ] Consent collection flow designed
- [ ] Data retention policies defined
- [ ] GDPR/POPIA compliance reviewed
- [ ] Customer data access/deletion workflows designed

**Specification File**: `planning/privacy-consent-management.md`

**GitHub Issue**: #104

---

## 1.6 Device Management Design (5 tasks)

### P1-T032: Device Catalog Design
**Linear Title**: P1-T032: Device Catalog Design
**Priority**: High
**Estimate**: 6 hours
**Labels**: phase-1, device-management, high-priority
**Status**: Todo
**Description**:
Design device catalog structure including device specifications, pricing, and inventory management.

**Acceptance Criteria**:
- [ ] Device catalog schema designed
- [ ] Device pricing model defined
- [ ] Device specifications template created
- [ ] Inventory tracking approach defined
- [ ] Device availability logic designed
- [ ] Multi-product support (Smartphone Financing)

**Specification File**: `planning/device-catalog-design.md`

**Key Requirements**:
- Support for multiple device types (smartphones, tablets)
- Device attributes: brand, model, storage, color, condition
- Pricing: retail_price, loan_amount, deposit_amount (20%)
- Inventory tracking per distributor
- Device images and descriptions

**GitHub Issue**: #105

---

### P1-T033: Device Lock/Unlock Integration
**Linear Title**: P1-T033: Device Lock/Unlock Integration
**Priority**: Critical
**Estimate**: 8 hours
**Labels**: phase-1, device-management, critical
**Status**: Todo
**Description**:
Design integration with device lock/unlock APIs (Google Find My Device, Samsung Knox) for payment enforcement.

**Acceptance Criteria**:
- [ ] Device lock API options researched (Google, Samsung, MDM)
- [ ] Lock/unlock trigger logic designed
- [ ] Lock notification flow designed
- [ ] Unlock upon payment confirmation designed
- [ ] Manual admin override workflow designed
- [ ] Lock event audit trail designed

**Specification File**: `planning/device-lock-unlock-integration.md`

**Key Requirements**:
- Automated lock after 7 days overdue
- Lock notification to customer (WhatsApp)
- Automatic unlock upon payment confirmation
- Admin manual unlock capability
- Lock status tracking in database
- Support for Google and Samsung devices

**Lock Triggers**:
- Payment is 7+ days overdue
- Loan marked as defaulted by admin

**Unlock Triggers**:
- Overdue payment received and confirmed
- Admin manual override (dispute resolution)

**GitHub Issue**: #106

---

### P1-T034: Device Handover Process
**Linear Title**: P1-T034: Device Handover Process
**Priority**: High
**Estimate**: 6 hours
**Labels**: phase-1, device-management, high-priority
**Status**: Todo
**Description**:
Design device handover process from distributor to customer with mandatory deposit enforcement.

**Acceptance Criteria**:
- [ ] Handover workflow designed (10 steps)
- [ ] Deposit verification logic designed (CRITICAL: blocks handover if not paid)
- [ ] Distributor notification system designed
- [ ] Device verification checklist created
- [ ] Serial number tracking designed
- [ ] Handover confirmation process designed
- [ ] Repayment schedule generation designed

**Specification File**: `planning/device-handover-process.md`

**Key Requirements**:
- **CRITICAL**: NO CASH ON DELIVERY - deposit must be confirmed before handover
- Deposit amount: 20% of device value
- Distributor confirms device availability
- Customer identity verification at pickup
- Device serial number linked to loan
- Loan status changes to 'active' after handover
- Repayment schedule starts after handover

**10-Step Handover Flow**:
1. Customer completes onboarding (loan approved)
2. Customer pays deposit via mobile money
3. System verifies deposit payment
4. System notifies distributor of pending handover
5. Distributor confirms device availability
6. System schedules handover appointment
7. Customer arrives at distributor location
8. Distributor verifies customer identity
9. Distributor hands over device
10. Distributor marks handover complete → loan goes active

**GitHub Issue**: #107

---

### P1-T035: Device Return/Repossession Flow
**Linear Title**: P1-T035: Device Return/Repossession Flow
**Priority**: Medium
**Estimate**: 4 hours
**Labels**: phase-1, device-management, medium-priority
**Status**: Todo
**Description**:
Design device return and repossession workflows for defaults and voluntary returns.

**Acceptance Criteria**:
- [ ] Voluntary return process designed
- [ ] Repossession trigger logic designed (30+ days default)
- [ ] Device recovery workflow designed
- [ ] Device condition check process designed
- [ ] Refund/settlement calculation designed
- [ ] Return notification flows designed

**Specification File**: `planning/device-return-repossession-flow.md`

**Key Requirements**:
- Voluntary return option (early termination)
- Automated repossession trigger (30+ days overdue)
- Device condition assessment upon return
- Settlement calculation (loan balance - device value)
- Distributor role in device recovery
- Device refurbishment and resale process

**Repossession Triggers**:
- Payment overdue 30+ days
- Customer requests voluntary return
- Fraud/breach of terms detected

**GitHub Issue**: #108

---

### P1-T036: Device Condition Assessment
**Linear Title**: P1-T036: Device Condition Assessment
**Priority**: Low
**Estimate**: 4 hours
**Labels**: phase-1, device-management, low-priority
**Status**: Todo
**Description**:
Design device condition assessment criteria and workflow for returns and trade-ins.

**Acceptance Criteria**:
- [ ] Device condition criteria defined (excellent, good, fair, poor)
- [ ] Condition assessment checklist created
- [ ] Photo documentation requirements defined
- [ ] Value adjustment logic designed
- [ ] Condition tracking in database designed

**Specification File**: `planning/device-condition-assessment.md`

**Key Requirements**:
- Condition grades: Excellent, Good, Fair, Poor, Damaged
- Assessment criteria: screen, battery, body, functionality
- Photo documentation (front, back, screen on)
- Value depreciation based on condition
- Condition affects resale/refurbishment value

**Condition Impact**:
- Excellent: 100% value
- Good: 80% value
- Fair: 60% value
- Poor: 40% value
- Damaged: 20% value

**GitHub Issue**: #109

---

## 1.7 Notification System Design (4 tasks)

### P1-T037: Multi-Channel Notification Design
**Linear Title**: P1-T037: Multi-Channel Notification Design
**Priority**: High
**Estimate**: 6 hours
**Labels**: phase-1, notifications, high-priority
**Status**: Todo
**Description**:
Design multi-channel notification system (WhatsApp, SMS, Email) with fallback logic.

**Acceptance Criteria**:
- [ ] Notification channels defined (WhatsApp primary, SMS fallback)
- [ ] Channel priority/fallback logic designed
- [ ] Notification delivery tracking designed
- [ ] Failed delivery retry logic designed
- [ ] Notification preferences management designed
- [ ] Opt-out/unsubscribe logic designed

**Specification File**: `planning/multi-channel-notification-design.md`

**Key Requirements**:
- Primary channel: WhatsApp
- Fallback channel: SMS
- Email for admin notifications
- Delivery status tracking (sent, delivered, read, failed)
- Retry logic (3 attempts with exponential backoff)
- Customer notification preferences
- Compliance with Zimbabwe communications regulations

**Notification Channels**:
1. **WhatsApp** (Primary)
   - Rich media support
   - Interactive buttons
   - Read receipts
   - Cheapest option

2. **SMS** (Fallback)
   - Guaranteed delivery
   - No internet required
   - Higher cost
   - 160 character limit

3. **Email** (Admin only)
   - Reports
   - Alerts
   - Documentation

**GitHub Issue**: #110

---

### P1-T038: Notification Templates & Triggers
**Linear Title**: P1-T038: Notification Templates & Triggers
**Priority**: High
**Estimate**: 6 hours
**Labels**: phase-1, notifications, high-priority
**Status**: Todo
**Description**:
Design notification templates and automated trigger events for all customer touchpoints.

**Acceptance Criteria**:
- [ ] All notification templates created (15+ templates)
- [ ] Trigger events defined
- [ ] Template variables identified
- [ ] Multi-language support designed (English, Shona)
- [ ] Template versioning designed
- [ ] A/B testing approach designed

**Specification File**: `planning/notification-templates-triggers.md`

**Key Notification Types**:

**Onboarding**:
- Welcome message
- Phone verification (OTP)
- KYC submission confirmation
- Loan approval/rejection
- Payment instructions

**Payment**:
- Payment due reminder (7 days, 3 days, 1 day before)
- Payment received confirmation
- Payment overdue (1 day, 7 days, 14 days, 30 days)
- Device lock warning (5 days before lock)
- Device locked notification

**Device**:
- Device ready for pickup
- Handover appointment confirmation
- Device handover complete
- Device unlocked notification

**Support**:
- Support ticket created
- Support ticket resolved
- Account updates

**Template Variables**:
- {customer_name}
- {loan_amount}
- {payment_amount}
- {due_date}
- {device_name}
- {distributor_location}

**GitHub Issue**: #111

---

### P1-T039: Payment Reminder Strategy
**Linear Title**: P1-T039: Payment Reminder Strategy
**Priority**: High
**Estimate**: 4 hours
**Labels**: phase-1, notifications, high-priority
**Status**: Todo
**Description**:
Design payment reminder strategy and escalation logic to reduce defaults.

**Acceptance Criteria**:
- [ ] Reminder schedule designed (7, 3, 1 days before due date)
- [ ] Escalation logic designed (1, 7, 14, 30 days overdue)
- [ ] Reminder messaging tone defined
- [ ] Grace period logic designed
- [ ] Device lock warning timeline designed
- [ ] Default prevention tactics designed

**Specification File**: `planning/payment-reminder-strategy.md`

**Key Requirements**:

**Pre-Due Date Reminders**:
- 7 days before: Friendly reminder
- 3 days before: Reminder with payment options
- 1 day before: Urgent reminder

**Post-Due Date Escalation**:
- Day 1 overdue: Polite reminder (grace period)
- Day 3 overdue: Firmer reminder
- Day 5 overdue: Device lock warning
- Day 7 overdue: Device locked + escalation notice
- Day 14 overdue: Collection notice
- Day 30 overdue: Default notice + repossession warning

**Reminder Channels**:
- WhatsApp (primary)
- SMS (if WhatsApp fails)
- Call from distributor (15+ days overdue)

**Tone Escalation**:
1. Friendly & helpful
2. Professional reminder
3. Urgent but respectful
4. Formal collection notice

**GitHub Issue**: #112

---

### P1-T040: Notification Queue Management
**Linear Title**: P1-T040: Notification Queue Management
**Priority**: Medium
**Estimate**: 4 hours
**Labels**: phase-1, notifications, medium-priority
**Status**: Todo
**Description**:
Design notification queue and delivery management system for reliability and scale.

**Acceptance Criteria**:
- [ ] Notification queue architecture designed (SQS/RabbitMQ)
- [ ] Priority queue logic designed
- [ ] Rate limiting strategy designed
- [ ] Dead letter queue designed
- [ ] Notification batching logic designed
- [ ] Queue monitoring designed

**Specification File**: `planning/notification-delivery-tracking.md`

**Key Requirements**:
- Queue system: AWS SQS or RabbitMQ
- Priority levels: Critical, High, Normal, Low
- Rate limiting (WhatsApp: 80 msg/sec, SMS: depends on provider)
- Retry logic with exponential backoff
- Dead letter queue for failed messages
- Batch processing for bulk notifications
- Queue metrics and monitoring

**Queue Priorities**:
- **Critical**: OTP, device lock, payment confirmation
- **High**: Payment reminders, loan approval/rejection
- **Normal**: General updates, support responses
- **Low**: Marketing, tips, education

**Delivery Tracking**:
- Queued
- Sent
- Delivered
- Read (WhatsApp only)
- Failed

**GitHub Issue**: #113

---

## 1.8 Admin Dashboard Design (5 tasks)

### P1-T041: Admin Dashboard Wireframes
**Linear Title**: P1-T041: Admin Dashboard Wireframes
**Priority**: Medium
**Estimate**: 8 hours
**Labels**: phase-1, admin-dashboard, medium-priority
**Status**: Todo
**Description**:
Design admin dashboard wireframes and user interface layouts for all management features.

**Acceptance Criteria**:
- [ ] Dashboard overview wireframe created
- [ ] Customer management wireframes created
- [ ] Loan management wireframes created
- [ ] Payment management wireframes created
- [ ] Device management wireframes created
- [ ] Reporting wireframes created
- [ ] Navigation structure defined
- [ ] Responsive design approach defined

**Specification File**: `planning/admin-dashboard-overview.md`

**Key Screens**:

1. **Dashboard Overview**
   - KPI cards (customers, active loans, disbursed amount, default rate)
   - Recent activity feed
   - Alerts (pending KYC, overdue payments)
   - Quick actions

2. **Customer Management**
   - Customer list (search, filter, sort)
   - Customer detail view
   - KYC documents viewer
   - Credit score history
   - Loan history

3. **Loan Management**
   - Loan list (filter by product, status, date)
   - Loan detail view
   - Payment history
   - Repayment schedule
   - Approve/reject controls
   - Notes and comments

4. **Payment Management**
   - Payment list
   - Payment detail view
   - Manual payment recording
   - Payment reconciliation

5. **Device Management**
   - Device list
   - Device detail view
   - Lock/unlock controls
   - Device assignment

6. **Reporting**
   - Loan disbursement report (filter by product)
   - Payment collection report (filter by product)
   - KYC status report
   - Default rate report (filter by product)
   - CSV export

**Design Requirements**:
- Clean, modern UI
- Mobile responsive
- Dark mode support
- Accessibility (WCAG 2.1 AA)
- Fast load times (<2 seconds)

**GitHub Issue**: #114

---

### P1-T042: Admin User Roles & Permissions
**Linear Title**: P1-T042: Admin User Roles & Permissions
**Priority**: High
**Estimate**: 4 hours
**Labels**: phase-1, admin-dashboard, high-priority
**Status**: Todo
**Description**:
Design role-based access control (RBAC) system for admin users with granular permissions.

**Acceptance Criteria**:
- [ ] Admin roles defined (Super Admin, Manager, Support)
- [ ] Permission matrix created
- [ ] Role assignment workflow designed
- [ ] Permission enforcement logic designed
- [ ] Audit trail for admin actions designed
- [ ] Role management UI designed

**Specification File**: `planning/admin-user-roles-permissions.md`

**Admin Roles**:

1. **Super Admin** (Full access)
   - All permissions
   - User management
   - System configuration
   - Delete operations

2. **Manager** (Operations)
   - View all data
   - Approve/reject loans
   - Manual payment recording
   - Lock/unlock devices
   - Generate reports
   - Cannot: Delete data, manage users, change system config

3. **Support** (Read-only + limited actions)
   - View customers, loans, payments
   - Add notes/comments
   - Create support tickets
   - Cannot: Approve loans, record payments, delete data

**Permission Matrix**:

| Feature | Super Admin | Manager | Support |
|---------|-------------|---------|---------|
| View customers | ✅ | ✅ | ✅ |
| Edit customers | ✅ | ✅ | ❌ |
| Delete customers | ✅ | ❌ | ❌ |
| Approve loans | ✅ | ✅ | ❌ |
| Reject loans | ✅ | ✅ | ❌ |
| Record payments | ✅ | ✅ | ❌ |
| Lock devices | ✅ | ✅ | ❌ |
| Unlock devices | ✅ | ✅ | ❌ |
| Generate reports | ✅ | ✅ | ✅ |
| Manage users | ✅ | ❌ | ❌ |
| System config | ✅ | ❌ | ❌ |

**Audit Trail**:
- Log all admin actions
- Track who, what, when, why
- Immutable audit log
- Admin action history per record

**GitHub Issue**: #115

---

### P1-T043: Reporting Requirements
**Linear Title**: P1-T043: Reporting Requirements
**Priority**: Medium
**Estimate**: 6 hours
**Labels**: phase-1, admin-dashboard, medium-priority
**Status**: Todo
**Description**:
Define reporting requirements and dashboard analytics for business intelligence.

**Acceptance Criteria**:
- [ ] Core reports identified (7 reports)
- [ ] Report filters defined (product, date range, status)
- [ ] Report data sources mapped
- [ ] Export formats defined (CSV, PDF)
- [ ] Report scheduling designed
- [ ] Performance metrics defined

**Specification File**: `planning/reporting-requirements.md`

**Core Reports** (Phase 2):

1. **Loan Disbursement Report**
   - Total loans disbursed (count, value)
   - Filter by: product, date range, distributor
   - Breakdown by tier (Tier 1, 2, 3)
   - Average loan amount
   - Approval rate

2. **Payment Collection Report**
   - Total payments collected (count, value)
   - Filter by: product, date range, payment method
   - On-time payment rate
   - Late payment rate
   - Average days to payment

3. **Default Rate Report**
   - Default rate (%) by product
   - Filter by: product, date range, tier
   - Aging analysis (30, 60, 90+ days overdue)
   - Recovery rate

4. **KYC Status Report**
   - KYC verification stats
   - Pending, verified, rejected counts
   - Average verification time
   - Rejection reasons

5. **Device Management Report**
   - Devices in stock, assigned, locked
   - Filter by: distributor, device type
   - Device lock rate
   - Average handover time

6. **Customer Acquisition Report**
   - New customers by date range
   - Customer source tracking
   - Onboarding completion rate
   - Average onboarding time

7. **Portfolio Health Report**
   - Active loans
   - Total outstanding balance
   - Portfolio at risk (PAR 30, PAR 90)
   - Collection efficiency

**NO P&L or Balance Sheet** (moved to Phase 4)

**Report Filters**:
- Date range (custom, preset)
- Product (Smartphone Financing, Digital Credit)
- Distributor
- Status (active, completed, defaulted)
- Tier (Tier 1, 2, 3)

**Export Formats**:
- CSV (for Excel)
- PDF (for printing/sharing)

**GitHub Issue**: #116

---

### P1-T044: Manual Review Workflows
**Linear Title**: P1-T044: Manual Review Workflows
**Priority**: High
**Estimate**: 6 hours
**Labels**: phase-1, admin-dashboard, high-priority
**Status**: Todo
**Description**:
Design manual review workflows for loan applications requiring human judgment.

**Acceptance Criteria**:
- [ ] Review trigger conditions defined
- [ ] Review queue design created
- [ ] Review checklist created
- [ ] Decision workflow designed (approve, reject, request more info)
- [ ] Review SLA defined (1-2 business days)
- [ ] Review notification flows designed

**Specification File**: `planning/manual-review-workflows.md`

**Review Triggers**:

1. **Credit Score in Review Range**
   - Scaled score 600-649 (below auto-approval threshold)
   - Requires manual assessment

2. **KYC Issues**
   - Document quality poor
   - ID verification inconclusive
   - Selfie match score low (60-79%)

3. **Affordability Concerns**
   - DTI ratio 40-50% (elevated but not auto-reject)
   - Requested amount exceeds initial tier limit

4. **Fraud Flags**
   - Duplicate phone number
   - Suspicious document patterns
   - Multiple applications same day

5. **Admin Override**
   - Customer dispute
   - Special circumstances
   - Policy exception request

**Review Workflow**:

1. **Application Enters Review Queue**
   - Customer notified: "Your application is under review (1-2 business days)"
   - Application flagged in admin dashboard

2. **Manager Reviews Application**
   - Review checklist completed
   - Additional verification if needed
   - Decision made: Approve, Reject, Request Info

3. **Decision Actions**:
   - **Approve**: Set credit limit, notify customer, proceed to payment
   - **Reject**: Select reason code, notify customer with explanation
   - **Request Info**: Send request to customer, extend review time

4. **Customer Notified**
   - WhatsApp message with decision
   - Next steps provided

**Review Checklist**:
- [ ] Credit score components reviewed
- [ ] Income verification checked
- [ ] KYC documents reviewed
- [ ] Payment history analyzed (if available)
- [ ] Fraud checks passed
- [ ] Affordability confirmed
- [ ] Notes added to application

**Review SLA**:
- Target: 1 business day
- Maximum: 2 business days
- Escalation if >2 days

**GitHub Issue**: #117

---

### P1-T045: Admin Notification System
**Linear Title**: P1-T045: Admin Notification System
**Priority**: Low
**Estimate**: 4 hours
**Labels**: phase-1, admin-dashboard, low-priority
**Status**: Todo
**Description**:
Design notification system for admin users to receive alerts and updates.

**Acceptance Criteria**:
- [ ] Admin notification types defined
- [ ] Notification channels designed (email, in-app)
- [ ] Notification preferences system designed
- [ ] Alert priority levels defined
- [ ] Notification aggregation logic designed
- [ ] Admin notification UI designed

**Specification File**: `planning/admin-notification-system.md`

**Admin Notification Types**:

**Critical Alerts** (Immediate):
- System errors/downtime
- Payment gateway failures
- Fraud alerts
- Multiple failed login attempts

**High Priority** (Within 1 hour):
- Loan applications in review queue
- KYC verification failures
- Payment disputes
- Device lock failures
- High-value transactions (>$500)

**Medium Priority** (Daily digest):
- New loan applications
- Payments received
- Overdue payments (7+ days)
- Customer support tickets

**Low Priority** (Weekly digest):
- System usage stats
- Performance metrics
- Portfolio health updates

**Notification Channels**:

1. **In-App** (Real-time)
   - Bell icon with badge count
   - Notification center
   - Toast notifications for critical alerts

2. **Email** (Configurable)
   - Immediate for critical alerts
   - Hourly digest for high priority
   - Daily digest for medium priority
   - Weekly digest for low priority

3. **SMS** (Critical only)
   - System downtime
   - Security breaches
   - Fraud alerts

**Notification Preferences**:
- Per-user notification settings
- Channel preferences (email, SMS, in-app)
- Notification frequency (real-time, hourly, daily)
- Do Not Disturb hours
- Notification categories on/off

**Notification UI**:
- Unread badge count
- Mark as read/unread
- Archive notifications
- Filter by type/priority
- Search notifications
- Quick actions from notification

**GitHub Issue**: #118

---

## Linear Import CSV Format

If Linear supports CSV import, use this format:

```csv
Title,Description,Priority,Estimate,Labels,Status
"P1-T031: Privacy & Consent Management","Design privacy and consent management framework for customer data handling.","High","4","phase-1,kyc,high-priority","Todo"
"P1-T032: Device Catalog Design","Design device catalog structure including device specifications, pricing, and inventory management.","High","6","phase-1,device-management,high-priority","Todo"
"P1-T033: Device Lock/Unlock Integration","Design integration with device lock/unlock APIs for payment enforcement.","Critical","8","phase-1,device-management,critical","Todo"
"P1-T034: Device Handover Process","Design device handover process with mandatory deposit enforcement.","High","6","phase-1,device-management,high-priority","Todo"
"P1-T035: Device Return/Repossession Flow","Design device return and repossession workflows.","Medium","4","phase-1,device-management,medium-priority","Todo"
"P1-T036: Device Condition Assessment","Design device condition assessment criteria and workflow.","Low","4","phase-1,device-management,low-priority","Todo"
"P1-T037: Multi-Channel Notification Design","Design multi-channel notification system with fallback logic.","High","6","phase-1,notifications,high-priority","Todo"
"P1-T038: Notification Templates & Triggers","Design notification templates and automated trigger events.","High","6","phase-1,notifications,high-priority","Todo"
"P1-T039: Payment Reminder Strategy","Design payment reminder strategy and escalation logic.","High","4","phase-1,notifications,high-priority","Todo"
"P1-T040: Notification Queue Management","Design notification queue and delivery management system.","Medium","4","phase-1,notifications,medium-priority","Todo"
"P1-T041: Admin Dashboard Wireframes","Design admin dashboard wireframes and UI layouts.","Medium","8","phase-1,admin-dashboard,medium-priority","Todo"
"P1-T042: Admin User Roles & Permissions","Design RBAC system for admin users with granular permissions.","High","4","phase-1,admin-dashboard,high-priority","Todo"
"P1-T043: Reporting Requirements","Define reporting requirements and dashboard analytics.","Medium","6","phase-1,admin-dashboard,medium-priority","Todo"
"P1-T044: Manual Review Workflows","Design manual review workflows for loan applications.","High","6","phase-1,admin-dashboard,high-priority","Todo"
"P1-T045: Admin Notification System","Design notification system for admin users.","Low","4","phase-1,admin-dashboard,low-priority","Todo"
```

---

## Summary

**Tasks**: P1-T031 to P1-T045 (15 tasks)
**Total Estimate**: 76 hours
**Categories**:
- KYC & Onboarding: 1 task (4h)
- Device Management: 5 tasks (28h)
- Notification System: 4 tasks (20h)
- Admin Dashboard: 5 tasks (28h)

**Priority Breakdown**:
- Critical: 1 task (P1-T033)
- High: 8 tasks
- Medium: 4 tasks
- Low: 2 tasks

**GitHub Issues**: #104-118

---

## Next Steps

1. **Import to Linear**:
   - Use CSV import if available
   - Or manually create each task using details above
   - Set project: "Phase 1: Architecture & Design"
   - Set team/workspace appropriately

2. **Set Dependencies** (if Linear supports):
   - P1-T033 should block P2-T010 (Device Lock Service implementation)
   - P1-T034 should block P2-T009 (Device Handover implementation)
   - P1-T037-040 should block notification implementation tasks

3. **Link to GitHub Issues**:
   - Add GitHub issue links to Linear task descriptions
   - Keep both systems in sync

4. **Assign Owners**:
   - Assign tasks to appropriate team members
   - Set due dates based on Phase 1 timeline

---

**Created**: December 2, 2025
**Status**: Ready for Linear import
**Total Tasks**: 15 (P1-T031 to P1-T045)
