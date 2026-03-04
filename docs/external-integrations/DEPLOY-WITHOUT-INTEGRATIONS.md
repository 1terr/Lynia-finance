# Deploy to Production Without External Integrations

> Strategy for going live with manual workflows to enable rigorous human testing

## Overview

Lynia Finance can deploy to production and begin human testing immediately
without waiting for external API credentials. Every external integration has a
manual fallback that operates through the admin dashboard.

This approach enables:
- Real user testing of the full loan lifecycle
- Staff training on actual production systems
- Data collection for credit scoring model validation
- Business process validation before API automation
- Early feedback from distributors and pilot customers

---

## Architecture: Stub Provider Layer

Each external service has a **StubProvider** implementation that satisfies the
same interface as the real provider. The stub provider:

- Returns deterministic, configurable responses
- Logs all operations to the audit trail
- Creates tasks in the admin dashboard for manual completion
- Simulates realistic delays (configurable)
- Supports both success and failure scenarios for testing

### Provider Selection via Feature Flags

```typescript
// Environment variable or database-backed feature flag
function createKYCProvider(): KYCProvider {
  const mode = getFeatureFlag('kyc-provider-mode'); // 'stub' | 'sandbox' | 'live'

  switch (mode) {
    case 'live':
      return new DiditProvider(getLiveConfig());
    case 'sandbox':
      return new DiditProvider(getSandboxConfig());
    case 'stub':
    default:
      return new StubKYCProvider();
  }
}
```

---

## Manual Workflows by Service

### 1. Payments - USSD Manual Flow

**How it works without API integration:**

```
Customer Journey:
1. Customer requests to make payment (via admin/distributor)
2. System generates payment reference (LYN-XXXXXXXX)
3. Customer receives USSD instructions for their provider:
   - EcoCash: Dial *151# → Pay Merchant → Enter code → Enter amount
   - O'mari:  Dial *707# → Pay → Enter merchant code → Confirm
   - OneWallet: Dial *111# → Payments → Merchant → Enter code
   - InnBucks: Open InnBucks app → Pay → Enter reference
4. Customer completes payment on their phone
5. Customer reports payment reference back (e.g., "MP240215123456")
6. Admin verifies payment in provider's merchant portal
7. Admin marks payment as verified in Lynia dashboard
8. System updates loan balance automatically
```

**Admin Dashboard - Payment Verification Queue:**

| Field | Description |
|-------|------------|
| Payment Reference | Lynia reference (LYN-XXXXXXXX) |
| Customer Name | From loan record |
| Expected Amount | Amount due |
| Payment Provider | Which USSD provider customer used |
| Customer's Ref | Reference number customer reported |
| Verification Status | Pending / Verified / Rejected |
| Verified By | Admin who verified |
| Verified At | Timestamp |

**SLA for manual verification:**
- Business hours (8am-5pm CAT): < 15 minutes
- After hours: Next business morning by 9am
- Critical payments (deposits for handover): < 30 minutes

**Stub Provider Behavior:**
- `initiatePayment()` → Returns success with generated reference, creates admin task
- `checkPaymentStatus()` → Returns current status from database (updated by admin)
- Webhook endpoint → Not needed (admin manually updates status)

### 2. KYC - Manual Document Review

**How it works without DIDIT:**

```
Customer Journey:
1. Customer submits KYC documents via admin portal upload:
   - National ID photo (front)
   - National ID photo (back)
   - Selfie photo
   - Proof of residence (if loan > $500)
2. System validates document formats and sizes
3. KYC request enters admin review queue
4. Admin manually verifies:
   - ID number format (XX-XXXXXXAXX)
   - Photo matches ID
   - ID is not expired
   - Address matches residence proof
   - No duplicate customer with same ID
5. Admin approves/rejects with reason
6. Customer is notified of KYC status
```

**Admin Dashboard - KYC Review Queue:**

| Field | Description |
|-------|------------|
| Customer Name | Self-reported name |
| National ID | Masked (XX-****XXAXX) |
| ID Photos | Front + Back viewable |
| Selfie | Photo for face matching |
| Submission Date | When submitted |
| Review Status | Pending / Approved / Rejected / More Info Needed |
| Reviewer | Admin who reviewed |
| Notes | Rejection reason or notes |

**SLA for manual KYC review:**
- New applications: < 24 hours
- Re-submissions: < 4 hours
- Priority (distributor-submitted): < 2 hours

**Stub Provider Behavior:**
- `submitVerification()` → Stores documents, creates admin review task, returns `PENDING`
- `checkStatus()` → Returns current status from database (updated by admin)
- `getVerificationResult()` → Returns admin's decision with manual confidence score
- Callback/webhook → Not needed (admin manually updates)

### 3. Device Lock - Manual Tracking

**How it works without Trustonic:**

```
Device Management:
1. Device IMEI registered in system during inventory intake
2. On handover: Distributor records device serial + IMEI
3. Lock status tracked manually in admin dashboard:
   - UNLOCKED (default for active, current loans)
   - LOCK_PENDING (admin flags device for lock)
   - LOCKED (admin confirms lock action taken)
   - UNLOCK_PENDING (payment received, awaiting unlock)
4. For overdue accounts:
   - System flags device as LOCK_PENDING
   - Admin contacts customer with warning
   - If no response after grace period, device marked LOCKED
   - Physical lock handled via future Trustonic integration
5. On payment: Admin marks device as UNLOCKED
```

**Admin Dashboard - Device Lock Queue:**

| Field | Description |
|-------|------------|
| Customer | Loan holder |
| Device | Model + IMEI |
| Loan Status | Active / Overdue / Default |
| Days Overdue | Number of days past due |
| Lock Status | Unlocked / Lock Pending / Locked / Unlock Pending |
| Action Required | What admin needs to do |
| Last Contact | When customer was last contacted |

**Stub Provider Behavior:**
- `enrollDevice()` → Records IMEI in database, returns success
- `lockDevice()` → Updates status to LOCK_PENDING, creates admin task
- `unlockDevice()` → Updates status to UNLOCK_PENDING, creates admin task
- `getLockStatus()` → Returns current status from database

**Important limitation:** Without Trustonic, the device cannot be physically
locked remotely. The "lock" is a tracking status only. Communicate this to staff
during training. Trustonic integration is required before scaling.

### 4. WhatsApp - Not Required for Initial Launch

**Why WhatsApp is deferred:**
- Admin portal handles all operations staff need
- Distributor dashboard handles agent workflows
- Customer communication via phone calls and SMS initially
- WhatsApp integration requires Meta Business verification (can take weeks)

**Interim communication channels:**
- Admin portal notifications (in-app)
- SMS via Africa's Talk (already integrated at $0.008/SMS)
- Phone calls for critical communications
- Email for formal notifications

**What WhatsApp will eventually handle:**
- Customer onboarding (self-service)
- Payment reminders
- KYC document collection
- Balance inquiries
- Payment confirmations
- Support ticket creation

---

## Deployment Checklist for Stub Mode

### Environment Configuration

```bash
# Feature flags - all set to 'stub' for initial deployment
KYC_PROVIDER_MODE=stub
PAYMENT_ECOCASH_MODE=stub
PAYMENT_OMARI_MODE=stub
PAYMENT_ONEWALLET_MODE=stub
PAYMENT_INNBUCKS_MODE=stub
LOCK_PROVIDER_MODE=stub
WHATSAPP_PROVIDER_MODE=stub

# Stub-specific config
STUB_PAYMENT_DELAY_MS=2000        # Simulate 2s API delay
STUB_KYC_DELAY_MS=1000            # Simulate 1s API delay
STUB_AUTO_APPROVE_KYC=false       # Require manual review
STUB_AUTO_COMPLETE_PAYMENT=false  # Require manual verification
```

### Database Requirements

All existing tables support stub mode. Additional columns needed:

```sql
-- Track manual verification in payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  manual_verification_by UUID REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  manual_verification_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  manual_verification_notes TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  customer_reported_reference TEXT;

-- Track manual KYC review
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS
  manual_reviewer_id UUID REFERENCES auth.users(id);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS
  manual_review_at TIMESTAMPTZ;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS
  manual_review_notes TEXT;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS
  manual_confidence_score INTEGER CHECK (manual_confidence_score BETWEEN 0 AND 100);
```

### Admin Dashboard Changes

New sections required in admin portal:

1. **Payment Verification Queue** - List of payments awaiting manual verification
2. **KYC Review Queue** - List of KYC submissions awaiting manual review
3. **Device Lock Management** - Manual lock/unlock status tracking
4. **Manual Operations Audit Log** - All manual actions with who/when/what

### Staff Training Requirements

Before go-live, train staff on:

1. How to verify EcoCash/O'mari/OneWallet/InnBucks payments in merchant portals
2. How to review KYC documents and spot fraudulent IDs
3. Device handover process without automated lock enrollment
4. Using the admin dashboard for all manual workflows
5. Escalation procedures for edge cases

---

## Success Criteria for Stub Mode Go-Live

| Metric | Target |
|--------|--------|
| Admin can process payment verification | < 5 minutes per transaction |
| Admin can complete KYC review | < 10 minutes per application |
| Full loan lifecycle testable end-to-end | Yes, with manual steps |
| All manual actions have audit trail | 100% |
| No external API calls made in stub mode | 0 calls |
| System stable under pilot load (30 customers) | Zero critical failures |
| Distributor can complete device handover | < 30 minutes per handover |

---

## Transition Plan: Stub to Live

When API credentials become available for any provider:

1. Deploy sandbox provider alongside stub (both available)
2. Run contract tests against sandbox
3. Switch feature flag to `sandbox` in staging environment
4. Complete UAT in staging with sandbox API
5. Switch feature flag to `live` in production (10% traffic initially)
6. Monitor for 48 hours
7. Increase to 100% traffic
8. Keep stub provider in codebase for 30 days as emergency fallback
9. Remove stub provider after 30 days of stable live operation

No code changes required for the transition - only feature flag updates.
