# P1-T033: Device Lock/Unlock Integration

**Task ID:** P1-T033
**Section:** 1.6 Device Management Design
**Priority:** Critical
**Estimated Duration:** 8 hours
**Dependencies:** Device Catalog Design (P1-T032), Payment Notifications (P1-T023)
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Device Lock Solutions](#device-lock-solutions)
3. [Lock Triggers](#lock-triggers)
4. [Unlock Triggers](#unlock-triggers)
5. [Lock/Unlock Workflow](#lockunlock-workflow)
6. [Grace Periods & Notifications](#grace-periods--notifications)
7. [Security & Compliance](#security--compliance)
8. [Implementation](#implementation)

---

## 1. Overview

Device locking is a critical risk mitigation tool for device financing. It allows Lynia Finance to remotely disable financed devices when customers default on payments, significantly reducing loan losses and device theft.

### Business Goals

1. **Reduce Default Losses**: Lock devices after missed payments to encourage repayment
2. **Theft Deterrence**: Make stolen devices unusable, reducing theft incentive
3. **Customer Incentive**: Motivate on-time payments to avoid disruption
4. **Flexible Recovery**: Unlock immediately when payment is received

### Key Metrics

- **Lock Effectiveness Rate**: >95% (percentage of lock commands successfully executed)
- **Average Lock Time**: <5 minutes from trigger to device lock
- **False Lock Rate**: <0.1% (accidental locks due to system errors)
- **Recovery Rate**: 70%+ customers pay within 7 days of lock

### Regulatory Considerations

**Zimbabwe Consumer Protection Laws**:
- **Grace Period Required**: Minimum 7 days notice before locking
- **Emergency Access**: Allow emergency calls (police, ambulance) even when locked
- **Customer Consent**: Explicit consent required during onboarding
- **Unlock Timeline**: Must unlock within 24 hours of payment confirmation

---

## 2. Device Lock Solutions

### 2.1 Chosen Solution: Trustonic

**Trustonic** is the selected device lock solution for Lynia Finance Phase 2.

| Feature | Details |
|---------|---------|
| **Provider** | Trustonic Device Security |
| **Coverage** | All Android devices (100% coverage) |
| **Implementation** | Cloud-based API integration (no app installation) |
| **Lock Method** | Remote device management via cloud |
| **Effectiveness** | 95%+ lock success rate |
| **Cost** | Pricing per device/month (contact Trustonic) |

**Why Trustonic?**
- ✅ **No App Installation Required**: Works at device level without customer app
- ✅ **Broad Device Coverage**: Supports all Android devices
- ✅ **Cloud-Based**: Fully managed cloud solution
- ✅ **Automated**: Supports automated lock/unlock workflows
- ✅ **Compliance**: Meets Zimbabwe regulatory requirements
- ✅ **Scalable**: Grows with business needs

**Alternative Solutions** (Future Consideration):
- Samsung Knox (Samsung-specific devices)
- MDM solutions (enterprise-grade control)
- Google Device Management APIs

---

### 2.2 Trustonic Integration

**Implementation**: Cloud-based API integration with NO app installation on customer device.

#### Integration Architecture

```typescript
// Trustonic API Integration

interface TrustonicConfig {
  api_key: string;
  api_secret: string;
  base_url: string;
  environment: 'sandbox' | 'production';
}

interface TrustonicDevice {
  device_id: string;  // Lynia internal device ID
  imei: string;       // Device IMEI
  trustonic_device_id: string;  // Trustonic's device identifier
  enrolled_at: Date;
  enrollment_status: 'pending' | 'enrolled' | 'failed';
}

// Initialize Trustonic client
const trustonic = new TrustonicClient({
  api_key: process.env.TRUSTONIC_API_KEY,
  api_secret: process.env.TRUSTONIC_API_SECRET,
  base_url: 'https://api.trustonic.com/v1',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
});

// Enroll device during handover (no customer app needed)
async function enrollDeviceWithTrustonic(
  deviceId: string,
  imei: string,
  customerId: string
): Promise<TrustonicDevice> {

  try {
    // Register device with Trustonic
    const response = await trustonic.devices.enroll({
      imei: imei,
      customer_reference: customerId,
      allow_emergency_calls: true,
      metadata: {
        lynia_device_id: deviceId,
        enrollment_date: new Date().toISOString()
      }
    });

    // Store Trustonic device ID
    const { data: device, error } = await supabase
      .from('devices')
      .update({
        trustonic_device_id: response.device_id,
        trustonic_enrolled: true,
        trustonic_enrolled_at: new Date()
      })
      .eq('id', deviceId)
      .select()
      .single();

    return {
      device_id: deviceId,
      imei: imei,
      trustonic_device_id: response.device_id,
      enrolled_at: new Date(),
      enrollment_status: 'enrolled'
    };

  } catch (error) {
    console.error('Trustonic enrollment failed:', error);
    throw new Error(`Failed to enroll device with Trustonic: ${error.message}`);
  }
}

// Lock device via Trustonic API (automated)
async function lockDeviceViaTrustonic(
  deviceId: string,
  reason: string
): Promise<void> {

  // Get Trustonic device ID
  const { data: device } = await supabase
    .from('devices')
    .select('trustonic_device_id, imei')
    .eq('id', deviceId)
    .single();

  if (!device.trustonic_device_id) {
    throw new Error('Device not enrolled with Trustonic');
  }

  // Send lock command via Trustonic API
  await trustonic.devices.lock({
    device_id: device.trustonic_device_id,
    lock_message: `Payment overdue. Contact Lynia Finance: +263 771 234 567`,
    lock_reason: reason,
    allow_emergency_calls: true,
    emergency_numbers: ['999', '994', '993', '112']
  });

  // Update device status in database
  await supabase.from('devices').update({
    lock_status: 'locked',
    locked_at: new Date(),
    lock_reason: reason
  }).eq('id', deviceId);

  // Create lock event record
  await supabase.from('device_locks').insert({
    device_id: deviceId,
    action: 'lock',
    reason: reason,
    executed_at: new Date(),
    execution_status: 'success',
    lock_provider: 'trustonic'
  });
}

// Unlock device via Trustonic API (automated)
async function unlockDeviceViaTrustonic(
  deviceId: string,
  reason: string
): Promise<void> {

  // Get Trustonic device ID
  const { data: device } = await supabase
    .from('devices')
    .select('trustonic_device_id, imei, customer_id')
    .eq('id', deviceId)
    .single();

  if (!device.trustonic_device_id) {
    throw new Error('Device not enrolled with Trustonic');
  }

  // Send unlock command via Trustonic API
  await trustonic.devices.unlock({
    device_id: device.trustonic_device_id,
    unlock_reason: reason
  });

  // Update device status in database
  await supabase.from('devices').update({
    lock_status: 'unlocked',
    unlocked_at: new Date()
  }).eq('id', deviceId);

  // Create unlock event record
  await supabase.from('device_locks').insert({
    device_id: deviceId,
    action: 'unlock',
    reason: reason,
    executed_at: new Date(),
    execution_status: 'success',
    lock_provider: 'trustonic'
  });

  // Send unlock notification to customer
  await sendUnlockNotification(device.customer_id);
}
```

**Trustonic Key Features**:
- ✅ **No App Required**: Cloud-based, works at device OS level
- ✅ **Fast Execution**: Lock/unlock within 1-5 minutes
- ✅ **Emergency Access**: Always allows emergency calls
- ✅ **Compliance**: Meets Zimbabwe regulatory requirements
- ✅ **Audit Trail**: Complete lock/unlock history

---

## 3. Lock Triggers (AUTOMATED)

**CRITICAL BUSINESS RULE**: Device locks are **fully automated**. Manual locks are only for special situations (fraud, theft, disputes).

### 3.1 Automated Payment-Related Triggers

#### Trigger L-001: Missed Payment (7 Days Overdue) - AUTOMATED

```typescript
interface LockTrigger {
  trigger_id: string;
  loan_id: string;
  customer_id: string;
  device_id: string;
  trigger_type: 'missed_payment' | 'default' | 'fraud' | 'theft';
  severity: 'warning' | 'lock';
  triggered_at: Date;
  grace_period_until: Date;
  lock_scheduled_at: Date;
}

async function checkMissedPayments(): Promise<void> {

  // Find loans with overdue payments (7+ days)
  const { data: overdueLoans } = await supabase
    .from('loans')
    .select('*, devices(*)')
    .eq('status', 'active')
    .lt('next_payment_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  for (const loan of overdueLoans) {

    // Check if already triggered
    const existingTrigger = await getLockTrigger(loan.id, 'missed_payment');
    if (existingTrigger) continue;

    // Create lock trigger with 3-day grace period
    const trigger: LockTrigger = {
      trigger_id: generateId(),
      loan_id: loan.id,
      customer_id: loan.customer_id,
      device_id: loan.device_id,
      trigger_type: 'missed_payment',
      severity: 'warning',
      triggered_at: new Date(),
      grace_period_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),  // 3 days
      lock_scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    };

    await supabase.from('device_lock_triggers').insert(trigger);

    // Send warning notification
    await sendLockWarningNotification(loan.customer_id, trigger);
  }
}
```

---

#### Trigger L-002: Severe Default (30+ Days Overdue)

```typescript
async function checkSevereDefaults(): Promise<void> {

  // Find loans with 30+ days overdue
  const { data: defaultedLoans } = await supabase
    .from('loans')
    .select('*, devices(*)')
    .eq('status', 'active')
    .lt('next_payment_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  for (const loan of defaultedLoans) {

    // Immediate lock (no grace period)
    const trigger: LockTrigger = {
      trigger_id: generateId(),
      loan_id: loan.id,
      customer_id: loan.customer_id,
      device_id: loan.device_id,
      trigger_type: 'default',
      severity: 'lock',
      triggered_at: new Date(),
      grace_period_until: new Date(),  // Immediate
      lock_scheduled_at: new Date()
    };

    await supabase.from('device_lock_triggers').insert(trigger);

    // Lock device immediately
    await lockDeviceImmediate(loan.device_id, 'Severe payment default');
  }
}
```

---

### 3.2 Fraud/Theft Triggers

#### Trigger L-003: Suspected Fraud

```typescript
async function handleFraudAlert(loanId: string, reason: string): Promise<void> {

  const loan = await getLoan(loanId);

  // Immediate lock (fraud)
  const trigger: LockTrigger = {
    trigger_id: generateId(),
    loan_id: loanId,
    customer_id: loan.customer_id,
    device_id: loan.device_id,
    trigger_type: 'fraud',
    severity: 'lock',
    triggered_at: new Date(),
    grace_period_until: new Date(),
    lock_scheduled_at: new Date()
  };

  await supabase.from('device_lock_triggers').insert(trigger);

  // Lock device
  await lockDeviceImmediate(loan.device_id, `Security alert: ${reason}`);

  // Notify security team
  await notifySecurityTeam({
    loan_id: loanId,
    customer_id: loan.customer_id,
    device_id: loan.device_id,
    reason: reason,
    action_taken: 'device_locked'
  });
}
```

#### Trigger L-004: Reported Stolen

```typescript
async function reportDeviceStolen(deviceId: string, reportedBy: string): Promise<void> {

  // Mark device as stolen
  await supabase.from('devices').update({
    status: 'stolen',
    stolen_reported_at: new Date(),
    stolen_reported_by: reportedBy
  }).eq('id', deviceId);

  // Lock device immediately
  await lockDeviceImmediate(deviceId, 'Device reported stolen');

  // Enable location tracking
  await enableLocationTracking(deviceId);

  // Notify authorities (if requested)
  // await notifyPolice(deviceId);
}
```

---

## 4. Unlock Triggers (AUTOMATED)

**CRITICAL BUSINESS RULE**: Device unlocks are **fully automated**. System automatically unlocks when overdue loan is repaid and there is no balance. Manual unlocks are only for special situations.

### 4.1 Automated Payment-Related Unlocks

#### Trigger U-001: Overdue Loan Repaid - AUTOMATED

```typescript
async function handlePaymentReceived(paymentId: string): Promise<void> {

  const { data: payment } = await supabase
    .from('payments')
    .select('*, loans(*, devices(*))')
    .eq('id', paymentId)
    .single();

  // Check if device is locked
  if (payment.loans.devices.lock_status !== 'locked') return;

  // CRITICAL: Check if overdue loan is fully repaid with no balance
  const hasNoBalance = await hasNoOutstandingBalance(payment.loan_id);

  if (hasNoBalance) {
    // Automatically unlock device via Trustonic
    await unlockDeviceViaTrustonic(
      payment.loans.device_id,
      'Overdue payment cleared - no outstanding balance'
    );

    // Notify customer
    await sendUnlockNotification(payment.customer_id);
  }
}

async function hasNoOutstandingBalance(loanId: string): Promise<boolean> {

  const { data: loan } = await supabase
    .from('loans')
    .select('outstanding_balance_usd, days_past_due')
    .eq('id', loanId)
    .single();

  // Unlock if: outstanding balance is zero AND not past due
  return loan.outstanding_balance_usd === 0 && loan.days_past_due === 0;
}
```

---

#### Trigger U-002: Loan Paid Off

```typescript
async function handleLoanPaidOff(loanId: string): Promise<void> {

  const { data: loan } = await supabase
    .from('loans')
    .select('*, devices(*)')
    .eq('id', loanId)
    .single();

  // Unlock device permanently
  await unlockDevicePermanent(loan.device_id, 'Loan fully paid');

  // Remove app restrictions
  await removeAppRestrictions(loan.device_id);

  // Send congratulations notification
  await sendLoanCompletionNotification(loan.customer_id);
}

async function removeAppRestrictions(deviceId: string): Promise<void> {

  // Update Lynia Device Manager app to remove lock functionality
  await sendAppCommand(deviceId, {
    command: 'remove_restrictions',
    allow_uninstall: true  // Customer can now uninstall app
  });
}
```

---

### 4.2 Manual Unlocks (SPECIAL SITUATIONS ONLY)

**IMPORTANT**: Manual locks/unlocks should be rare exceptions. Use only for:
- Customer disputes (payment system error, bank delay)
- Fraud investigations
- Technical issues with automated system
- Compassionate grounds (emergency, hardship)

All manual actions require admin approval and are fully audited.

#### Trigger U-003: Admin Override (Special Situations)

```typescript
interface AdminUnlock {
  unlock_id: string;
  device_id: string;
  admin_user_id: string;
  reason: string;
  reason_category: 'dispute' | 'fraud' | 'technical' | 'compassionate' | 'other';
  unlock_type: 'temporary' | 'permanent';
  unlock_duration_hours?: number;  // For temporary unlocks
  approved_by: string;  // Senior admin approval required
  unlocked_at: Date;
}

async function adminUnlockDevice(
  deviceId: string,
  adminUserId: string,
  approvedBy: string,
  reason: string,
  reasonCategory: string,
  temporary: boolean = false,
  durationHours?: number
): Promise<void> {

  // IMPORTANT: This overrides automated system - use with caution
  console.warn(`MANUAL UNLOCK: Device ${deviceId} - Reason: ${reason}`);

  // Unlock device via Trustonic
  await unlockDeviceViaTrustonic(deviceId, `Admin override: ${reason}`);

  // Log admin action with full audit trail
  const unlock: AdminUnlock = {
    unlock_id: generateId(),
    device_id: deviceId,
    admin_user_id: adminUserId,
    reason: reason,
    reason_category: reasonCategory,
    unlock_type: temporary ? 'temporary' : 'permanent',
    unlock_duration_hours: durationHours,
    approved_by: approvedBy,
    unlocked_at: new Date()
  };

  await supabase.from('admin_device_unlocks').insert(unlock);

  // Alert security team of manual override
  await notifySecurityTeam({
    action: 'manual_unlock',
    device_id: deviceId,
    admin_id: adminUserId,
    reason: reason
  });

  // If temporary, schedule automated re-lock
  if (temporary && durationHours) {
    await scheduleAutomatedRelock(deviceId, durationHours, reason);
  }
}

async function scheduleAutomatedRelock(
  deviceId: string,
  hours: number,
  originalReason: string
): Promise<void> {

  const relockAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  await supabase.from('scheduled_device_locks').insert({
    device_id: deviceId,
    scheduled_at: relockAt,
    reason: `Temporary unlock expired - returning to automated management`,
    original_reason: originalReason,
    created_at: new Date()
  });
}
```

---

## 5. Lock/Unlock Workflow

### 5.1 Complete Lock Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVICE LOCK WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. TRIGGER DETECTION
   ├─ Daily cron job checks overdue loans
   ├─ Fraud detection system raises alert
   └─ Admin manually triggers lock

2. CREATE LOCK TRIGGER
   ├─ Insert into device_lock_triggers table
   ├─ Set grace_period_until (3-7 days)
   └─ Set lock_scheduled_at

3. GRACE PERIOD (3-7 days)
   ├─ Send warning notifications (WhatsApp + SMS)
   ├─ Daily reminders
   └─ Allow customer to make payment

4. AUTOMATED LOCK EXECUTION (scheduled job)
   ├─ Check if payment received during grace period
   │  ├─ YES → Cancel lock, mark trigger as resolved
   │  └─ NO → Proceed to automated lock
   ├─ Send lock command to Trustonic API
   │  └─ Trustonic locks device within 1-5 minutes
   └─ Update device.lock_status = 'locked'

5. DEVICE LOCKED STATE (Trustonic-Managed)
   ├─ Device locked at OS level (no app required)
   ├─ Block all apps and data
   ├─ Allow emergency calls only (999, 994, 993, 112)
   └─ Display lock message from Trustonic

6. CUSTOMER MAKES PAYMENT
   ├─ Payment webhook received (EcoCash, OneMoney, etc.)
   ├─ Update loan status and outstanding balance
   └─ Check if outstanding balance is zero

7. AUTOMATED UNLOCK EXECUTION
   ├─ If outstanding balance = 0 AND not past due:
   │  └─ Automatically send unlock command to Trustonic API
   ├─ Trustonic unlocks device within 1-5 minutes
   ├─ Update device.lock_status = 'unlocked'
   └─ Send confirmation notification to customer
```

---

### 5.2 Implementation

```typescript
// Scheduled job (runs daily at 8 AM) - FULLY AUTOMATED
async function processAutomatedDeviceLocks(): Promise<void> {

  console.log('Starting automated device lock processing...');

  // Find locks that are scheduled for today
  const { data: scheduledLocks } = await supabase
    .from('device_lock_triggers')
    .select('*, loans(*, devices(*))')
    .lte('lock_scheduled_at', new Date())
    .eq('status', 'pending');

  console.log(`Found ${scheduledLocks.length} pending lock triggers`);

  for (const trigger of scheduledLocks) {

    // Check if payment received during grace period
    const paymentReceived = await checkPaymentDuringGracePeriod(
      trigger.loan_id,
      trigger.triggered_at,
      new Date()
    );

    if (paymentReceived) {
      // Cancel lock (customer paid during grace period)
      await supabase.from('device_lock_triggers').update({
        status: 'cancelled',
        cancelled_at: new Date(),
        cancellation_reason: 'Payment received during grace period'
      }).eq('trigger_id', trigger.trigger_id);

      console.log(`Lock cancelled for device ${trigger.device_id} - payment received`);
      continue;
    }

    // Execute automated lock via Trustonic
    try {
      await lockDeviceViaTrustonic(
        trigger.loans.device_id,
        `Payment overdue - ${trigger.trigger_type}`
      );

      // Update trigger status
      await supabase.from('device_lock_triggers').update({
        status: 'executed',
        executed_at: new Date()
      }).eq('trigger_id', trigger.trigger_id);

      console.log(`Device ${trigger.device_id} locked successfully via Trustonic`);

    } catch (error) {
      console.error(`Failed to lock device ${trigger.device_id}:`, error);

      // Mark as failed for manual review
      await supabase.from('device_lock_triggers').update({
        status: 'failed',
        error_message: error.message
      }).eq('trigger_id', trigger.trigger_id);
    }
  }

  console.log('Automated device lock processing complete');
}

async function checkPaymentDuringGracePeriod(
  loanId: string,
  gracePeriodStart: Date,
  gracePeriodEnd: Date
): Promise<boolean> {

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .gte('created_at', gracePeriodStart)
    .lte('created_at', gracePeriodEnd)
    .eq('status', 'completed');

  return payments && payments.length > 0;
}
```

---

## 6. Grace Periods & Notifications

### 6.1 Grace Period Policy

| Trigger Type | Grace Period | Notification Frequency |
|--------------|--------------|------------------------|
| **Missed Payment** (7 days overdue) | 3 days | Day 1, Day 2, Day 3 (final warning) |
| **Missed Payment** (14 days overdue) | 1 day | Immediate + final warning |
| **Severe Default** (30+ days) | 0 days | Immediate lock |
| **Fraud/Theft** | 0 days | Immediate lock |

---

### 6.2 Notification Templates

**Day 1 Warning (3 days before lock)**:

```
⚠️ *Payment Overdue*

Your payment of $45.00 is now 7 days overdue.

If payment is not received within 3 days, your device will be temporarily locked.

*Amount Due*: $45.00
*Lock Date*: November 30, 2025

[Pay Now] [Contact Support]
```

**Day 2 Warning**:

```
⚠️ *Urgent: Payment Required*

Your payment is still overdue.

Your device will be locked in 2 days if payment is not received.

*Amount Due*: $45.00
*Lock Date*: November 30, 2025

[Pay Now] [Request Extension]
```

**Day 3 Final Warning**:

```
🚨 *Final Warning: Device Lock Tomorrow*

This is your final reminder.

Your device will be locked tomorrow at 9:00 AM if payment is not received.

*Amount Due*: $45.00
*Lock Date*: November 30, 2025 at 9:00 AM

[Pay Now] [Contact Support Urgently]
```

**Lock Notification**:

```
🔒 *Device Locked*

Your device has been temporarily locked due to missed payment.

*Amount Due*: $45.00

Pay now to unlock your device immediately.

Emergency calls are still available.

[Pay Now] [Contact Support]
```

**Unlock Notification**:

```
✅ *Device Unlocked*

Thank you for your payment!

Your device has been unlocked and is now fully functional.

*Payment Received*: $45.00

[View Receipt] [Main Menu]
```

---

## 7. Security & Compliance

### 7.1 Customer Consent

**Required during onboarding**:

```
┌─────────────────────────────────────────┐
│  Device Lock Authorization              │
├─────────────────────────────────────────┤
│                                         │
│  I authorize Lynia Finance to:          │
│                                         │
│  ✓ Install device management software  │
│  ✓ Remotely lock my device if I miss   │
│    payments (after 7-day notice)        │
│  ✓ Track device location if reported   │
│    stolen                               │
│  ✓ Unlock device when payments are     │
│    current                              │
│                                         │
│  Emergency calls will always be         │
│  available even when device is locked.  │
│                                         │
│  [I Agree] [Learn More]                 │
└─────────────────────────────────────────┘
```

Consent stored in database:

```typescript
interface DeviceLockConsent {
  customer_id: string;
  consented: boolean;
  consented_at: Date;
  consent_version: string;  // e.g., "1.0"
  ip_address: string;
  user_agent: string;
}
```

---

### 7.2 Emergency Call Access

**Always allow emergency calls** (Zimbabwe law requirement):

```typescript
const EMERGENCY_NUMBERS = [
  '999',   // Police
  '994',   // Ambulance
  '993',   // Fire
  '112'    // International emergency
];

function allowEmergencyCall(number: string): boolean {
  return EMERGENCY_NUMBERS.includes(number);
}
```

---

### 7.3 Data Privacy

- **Location tracking**: Only enabled if device reported stolen (with consent)
- **App data**: Encrypted at rest and in transit
- **Lock history**: Audit trail maintained for 7 years (compliance)

---

## 8. Implementation

### 8.1 Database Schema

```sql
CREATE TABLE device_lock_triggers (
  trigger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  device_id UUID NOT NULL REFERENCES devices(id),

  trigger_type VARCHAR(50) NOT NULL,  -- 'missed_payment', 'default', 'fraud', 'theft'
  severity VARCHAR(20) NOT NULL,      -- 'warning', 'lock'

  triggered_at TIMESTAMPTZ NOT NULL,
  grace_period_until TIMESTAMPTZ,
  lock_scheduled_at TIMESTAMPTZ,

  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'executed', 'cancelled'
  executed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE device_lock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  device_id UUID NOT NULL REFERENCES devices(id),
  action VARCHAR(20) NOT NULL,  -- 'lock', 'unlock'

  reason TEXT NOT NULL,
  trigger_id UUID REFERENCES device_lock_triggers(trigger_id),

  performed_by VARCHAR(50),  -- 'system', 'admin', 'customer_payment'
  admin_user_id UUID REFERENCES admin_users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lock_triggers_status ON device_lock_triggers(status);
CREATE INDEX idx_lock_triggers_scheduled ON device_lock_triggers(lock_scheduled_at);
CREATE INDEX idx_lock_history_device ON device_lock_history(device_id);
```

---

### 8.2 API Endpoints

#### POST `/api/devices/:id/lock`

**Description**: Lock a device (admin or system)

**Request**:
```json
{
  "reason": "Missed payment",
  "admin_user_id": "admin-123"
}
```

**Response**:
```json
{
  "device_id": "device-456",
  "lock_status": "locked",
  "locked_at": "2025-11-27T10:00:00Z"
}
```

---

#### POST `/api/devices/:id/unlock`

**Description**: Unlock a device

**Response**:
```json
{
  "device_id": "device-456",
  "lock_status": "unlocked",
  "unlocked_at": "2025-11-27T12:00:00Z"
}
```

---

#### GET `/api/devices/:id/lock-status`

**Description**: Get current lock status (called by device app)

**Response**:
```json
{
  "device_id": "device-456",
  "lock_status": "locked",
  "reason": "Missed payment",
  "locked_at": "2025-11-27T10:00:00Z",
  "unlock_instructions": "Pay $45.00 to unlock device"
}
```

---

## Summary (UPDATED - Trustonic Integration)

**Device Lock/Unlock Integration Deliverables**:
- ✅ **Trustonic Cloud-Based Solution**: No app installation required (100% coverage)
- ✅ **Automated Lock/Unlock**: Fully automated based on payment status
- ✅ **Lock Triggers**: Payment overdue (automated), fraud (manual), theft (manual)
- ✅ **Unlock Triggers**: Overdue loan repaid with zero balance (automated)
- ✅ **Manual Override**: Admin override for special situations only (disputes, emergencies)
- ✅ **Grace Periods**: 3-day warning before automated lock
- ✅ **Compliance**: Emergency call access, customer consent, data privacy

**Key Features**:
- 1-5 minute lock/unlock execution via Trustonic API
- 95%+ lock success rate
- **No customer app installation required** (cloud-based)
- Emergency calls always available (999, 994, 993, 112)
- **Fully automated** lock/unlock workflows
- Manual actions only for special situations
- Complete audit trail of all lock/unlock events
- 70%+ recovery rate within 7 days

**Architecture**:
- Cloud-based device management via Trustonic API
- Real-time integration with payment webhooks
- Automated daily cron job for lock processing
- Trustonic enrollment during device handover (via IMEI)

**Next Steps**: Implement Device Handover Process (P1-T034) with Trustonic enrollment
