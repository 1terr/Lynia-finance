# Device Lock Integration Plan - Trustonic

> Remote device management for asset-backed lending enforcement

## Provider Overview

| Detail | Value |
|--------|-------|
| **Provider** | Trustonic |
| **Product** | Telecoms Asset Protection (TAP) / MDM |
| **Integration** | REST API (IMEI-based) |
| **Auth** | HMAC-SHA256 signed requests |
| **Current Status** | Code written, API credentials not obtained |

---

## Why Trustonic is Essential

Trustonic provides the enforcement mechanism that makes device financing viable:

- **Remote lock**: Disable device if customer defaults on payments
- **Emergency access**: Emergency calls (999, 994, 993, 112) always allowed even when locked
- **Deterrent effect**: Customers pay on time knowing device can be locked
- **Recovery support**: Locked device has no resale value, incentivizing return
- **No app required**: Works at firmware/OS level, customer cannot bypass

**Without Trustonic, Lynia has no enforcement mechanism for device loans.** The
manual tracking in Phase 1 is a temporary measure only.

---

## Integration Phases

### Phase 1: Manual Tracking (Current - Go-Live)

**No remote lock capability.** Lock status tracked in admin dashboard only.

**Workflow:**
1. Device IMEI recorded during inventory intake
2. IMEI linked to customer during handover
3. Lock status tracked manually:
   - `UNLOCKED` - Default for active loans
   - `WARNING_SENT` - Customer notified of potential lock
   - `LOCK_SCHEDULED` - Lock will execute (future: automated)
   - `LOCKED` - Device marked as locked (manual tracking only)
   - `UNLOCK_SCHEDULED` - Payment received, unlock pending
4. Admin manually contacts customer for overdue accounts
5. All status changes logged in audit trail

**Limitations in Phase 1:**
- Device cannot actually be locked remotely
- Customer could sell device and stop paying
- Enforcement relies on customer communication and eventual legal action
- **Recommendation:** Limit pilot to trusted customers until Trustonic is live

**Existing code:** `services/lock-service/src/trustonic-provider.ts`

### Phase 2: Sandbox Integration

**Prerequisites:**
- [ ] Trustonic partner account created
- [ ] API Key and API Secret obtained
- [ ] Sandbox environment access confirmed
- [ ] Test IMEI numbers provided by Trustonic

**Tasks:**
1. Configure sandbox credentials in AWS Secrets Manager
2. Switch `lock-provider-mode` feature flag to `sandbox`
3. Test device enrollment with test IMEIs
4. Test lock command and verify device behavior
5. Test unlock command
6. Test lock status queries
7. Verify emergency number whitelist works
8. Test lock message display on device
9. Run contract tests against sandbox API

**Contract test scenarios:**

```
SCENARIO: Enroll new device
  GIVEN a valid IMEI and customer reference
  WHEN enrollDevice() is called
  THEN device is registered in Trustonic
  AND enrollment status = 'active'

SCENARIO: Lock device for payment default
  GIVEN an enrolled device
  WHEN lockDevice() is called with reason 'payment_default'
  THEN device lock status = 'locked'
  AND lock message displayed on device
  AND emergency calls still work (999, 994, 993, 112)

SCENARIO: Unlock device after payment
  GIVEN a locked device
  WHEN unlockDevice() is called with reason 'payment_received'
  THEN device lock status = 'unlocked'
  AND device fully functional

SCENARIO: Query lock status
  GIVEN an enrolled device
  WHEN getLockStatus() is called
  THEN returns current lock state with timestamp

SCENARIO: Reject enrollment for invalid IMEI
  GIVEN an invalid IMEI format
  WHEN enrollDevice() is called
  THEN error is thrown with DEV_404_001

SCENARIO: Handle Trustonic API timeout
  GIVEN Trustonic API does not respond within 30s
  WHEN lockDevice() is called
  THEN lock command is queued for retry
  AND admin is notified of pending lock
```

### Phase 3: Production Activation

**Prerequisites:**
- [ ] All sandbox contract tests passing
- [ ] Production API credentials obtained
- [ ] Trustonic support contact established
- [ ] Lock message text approved by Trustonic and legal

**Activation steps:**
1. Store production credentials in AWS Secrets Manager
2. Switch `lock-provider-mode` to `live`
3. Enroll first batch of devices (inventory)
4. Test lock/unlock cycle on a test device
5. Monitor enrollment success rate
6. Enable automated lock triggers:
   - 15+ days overdue → auto-lock
   - Fraud detected → immediate lock
   - Customer request → immediate unlock (after verification)

---

## Lock Workflow (Automated - Phase 3)

```
Day 0:  Payment due date
Day 1:  SMS reminder sent
Day 3:  WhatsApp reminder + warning
Day 7:  Final warning - "Device will be locked in 8 days"
Day 10: Grace period warning
Day 15: AUTOMATIC LOCK triggered
        → Trustonic API lockDevice() called
        → Lock message displayed on device:
          "This device has been temporarily restricted due to
           an overdue payment. Contact Lynia Finance:
           +263-XXX-XXXXXX to resolve."
        → Emergency calls (999, 994, 993, 112) remain active

On Payment Received:
        → Trustonic API unlockDevice() called
        → Device fully restored within 60 seconds
        → Customer receives confirmation SMS
```

**Grace period reduction for repeat defaults:**
- First default: 15-day grace period
- Second default: 10-day grace period
- Third default: 7-day grace period
- Fourth+ default: 3-day grace period + loan restructuring required

---

## API Contract Summary

### Enroll Device

```typescript
// POST {base_url}/devices/enroll
{
  imei: string,              // 15-digit IMEI
  customer_reference: string, // Our customer UUID
  device_model?: string,
  device_manufacturer?: string
}
// Response: { device_id: string, enrollment_status: 'active' }
```

### Lock Device

```typescript
// POST {base_url}/devices/{device_id}/lock
{
  reason: 'payment_default' | 'fraud' | 'lost_stolen' | 'repossession',
  message: string,           // Displayed on locked device
  emergency_numbers: string[], // Always callable
  lock_type: 'soft' | 'hard'  // Soft = message only, Hard = full lock
}
// Response: { lock_status: 'locked', locked_at: string }
```

### Unlock Device

```typescript
// POST {base_url}/devices/{device_id}/unlock
{
  reason: 'payment_received' | 'customer_service' | 'error_correction',
  authorized_by: string      // Admin who authorized unlock
}
// Response: { lock_status: 'unlocked', unlocked_at: string }
```

### Get Lock Status

```typescript
// GET {base_url}/devices/{device_id}/status
// Response:
{
  device_id: string,
  imei: string,
  lock_status: 'unlocked' | 'locked' | 'pending_lock' | 'pending_unlock',
  last_status_change: string,
  enrollment_status: 'active' | 'inactive'
}
```

---

## Data Privacy & Security

- IMEI numbers stored encrypted at rest
- Lock/unlock operations require admin authorization (audit logged)
- Emergency numbers always accessible (regulatory requirement)
- Lock messages must not reveal financial details (e.g., loan amount)
- Device status queries rate-limited to prevent enumeration
- All Trustonic API calls use HMAC-SHA256 signed requests

---

## Monitoring & Alerts

```yaml
metrics:
  - device_enrollment_count
  - device_enrollment_success_rate
  - lock_command_count
  - lock_command_success_rate
  - lock_command_latency_ms
  - unlock_command_count
  - unlock_command_latency_ms
  - locked_devices_count (gauge)

alerts:
  critical:
    - lock_command_success_rate < 95%
    - trustonic_api_unreachable
  warning:
    - lock_command_latency p95 > 10000ms
    - enrollment_failure_rate > 5%
```

---

## Fallback Strategy

If Trustonic API is unreachable:

1. Lock/unlock commands queued in database (`lock_commands` table)
2. Retry job runs every 5 minutes for pending commands
3. Admin notified of any commands stuck for > 30 minutes
4. Critical locks (fraud) escalated to on-call immediately
5. Manual fallback: Contact Trustonic support for emergency lock/unlock
