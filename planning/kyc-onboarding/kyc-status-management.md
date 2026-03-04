# P1-T030: KYC Status Management

**Task ID:** P1-T030
**Section:** 1.5 KYC & Onboarding Design
**Priority:** Medium
**Estimated Duration:** 4 hours
**Dependencies:** P1-T028, P1-T002
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [KYC Status States](#kyc-status-states)
3. [Status Transition Rules](#status-transition-rules)
4. [Re-verification Triggers](#re-verification-triggers)
5. [Expiry Handling](#expiry-handling)
6. [Status Querying](#status-querying)
7. [Implementation](#implementation)

---

## 1. Overview

KYC status management tracks the verification lifecycle of customer identities. This document defines all possible states, transitions, and triggers for re-verification.

### Business Requirements

1. **Compliance**: Meet RBZ requirements for ongoing KYC
2. **Fraud Prevention**: Re-verify customers periodically
3. **User Experience**: Minimize re-verification friction
4. **Automation**: Auto-detect when re-verification needed

---

## 2. KYC Status States

### 2.1 Status Definitions

```typescript
type KYCStatus =
  | 'not_started'           // Customer has not begun KYC
  | 'pending'               // Documents submitted, awaiting verification
  | 'processing'            // DIDIT verification in progress
  | 'manual_review'         // Requires human review (50-84% confidence)
  | 'verified'              // Successfully verified (85%+ confidence)
  | 'rejected'              // Verification failed (<50% confidence or fraud)
  | 'expired'               // Verification older than 12 months
  | 'flagged'               // Suspicious activity detected
  | 'blocked';              // Permanently blocked (fraud confirmed)
```

### 2.2 Status Descriptions

| Status | Description | Customer Can Borrow? | Action Required |
|--------|-------------|---------------------|----------------|
| **not_started** | Has not uploaded KYC documents | ❌ No | Upload National ID + Selfie |
| **pending** | Documents submitted, awaiting processing | ❌ No | Wait for verification |
| **processing** | DIDIT verification in progress | ❌ No | Wait (<30 seconds) |
| **manual_review** | Human review required (ambiguous results) | ❌ No | Wait (up to 24 hours) |
| **verified** | Identity confirmed, can borrow | ✅ Yes | None |
| **rejected** | Verification failed, can retry | ❌ No | Retry (max 3 attempts) |
| **expired** | Verification >12 months old | ❌ No | Re-verify |
| **flagged** | Suspicious activity under investigation | ❌ No | Contact support |
| **blocked** | Permanently banned (fraud confirmed) | ❌ No | Cannot reapply |

---

### 2.3 Status Hierarchy

```
┌─────────────────┐
│  not_started    │  ← Initial state
└────────┬────────┘
         ↓
┌─────────────────┐
│    pending      │  ← Documents uploaded
└────────┬────────┘
         ↓
┌─────────────────┐
│   processing    │  ← DIDIT API call
└────────┬────────┘
         ↓
    ┌────┴────┐
    ↓         ↓
┌──────┐  ┌──────────────┐
│manual│  │   verified   │  ← Success (85%+)
│review│  └──────┬───────┘
└──┬───┘         ↓
   ↓        ┌────────┐
   ↓        │expired │  ← After 12 months
   ↓        └───┬────┘
   ↓            ↓
   ↓        (Loop back to pending for re-verification)
   ↓
┌──────────┐
│ rejected │  ← Failed (<50%)
└────┬─────┘
     ↓
(Can retry 3x, then blocked)
```

---

## 3. Status Transition Rules

### 3.1 Valid Transitions

```typescript
const allowedTransitions: Record<KYCStatus, KYCStatus[]> = {
  'not_started': ['pending'],
  'pending': ['processing'],
  'processing': ['verified', 'manual_review', 'rejected'],
  'manual_review': ['verified', 'rejected'],
  'verified': ['expired', 'flagged', 'blocked'],
  'rejected': ['pending', 'blocked'],  // Can retry or be permanently blocked
  'expired': ['pending'],              // Re-verification
  'flagged': ['verified', 'blocked'],  // Investigation outcome
  'blocked': []                        // Terminal state
};
```

### 3.2 Transition Logic

```typescript
async function transitionKYCStatus(
  customer_id: string,
  new_status: KYCStatus,
  reason: string
): Promise<void> {

  // Get current status
  const { data: customer } = await supabase
    .from('customers')
    .select('kyc_status')
    .eq('id', customer_id)
    .single();

  const current_status = customer.kyc_status as KYCStatus;

  // Validate transition
  if (!allowedTransitions[current_status].includes(new_status)) {
    throw new Error(
      `Invalid KYC status transition: ${current_status} → ${new_status}`
    );
  }

  // Update status
  await supabase.from('customers').update({
    kyc_status: new_status,
    kyc_status_updated_at: new Date()
  }).eq('id', customer_id);

  // Log transition
  await supabase.from('kyc_status_history').insert({
    customer_id: customer_id,
    previous_status: current_status,
    new_status: new_status,
    reason: reason,
    changed_at: new Date()
  });

  // Trigger side effects
  await handleStatusChange(customer_id, current_status, new_status);
}
```

---

### 3.3 Automatic Status Transitions

**Triggered by DIDIT Webhook:**

```typescript
// In webhook handler
async function handleDiditWebhook(payload: DIDITWebhookPayload): Promise<void> {

  const customer_id = payload.partner_params.user_id;
  const confidence = payload.result.confidence_value;

  // Determine new status based on confidence
  let new_status: KYCStatus;
  let reason: string;

  if (confidence >= 85) {
    new_status = 'verified';
    reason = `Auto-approved with ${confidence}% confidence`;
  } else if (confidence >= 50) {
    new_status = 'manual_review';
    reason = `Manual review required (${confidence}% confidence)`;
  } else {
    new_status = 'rejected';
    reason = `Auto-rejected (${confidence}% confidence)`;
  }

  await transitionKYCStatus(customer_id, new_status, reason);
}
```

**Triggered by Expiry Check (Daily Cron):**

```typescript
// Daily job to expire old verifications
async function expireOldVerifications(): Promise<void> {

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: expiredCustomers } = await supabase
    .from('customers')
    .select('id')
    .eq('kyc_status', 'verified')
    .lt('kyc_verified_at', twelveMonthsAgo.toISOString());

  for (const customer of expiredCustomers || []) {
    await transitionKYCStatus(
      customer.id,
      'expired',
      'KYC verification older than 12 months'
    );

    // Notify customer
    await sendWhatsAppMessage(customer.id, {
      template: 'kyc_expired',
      params: {
        customer_name: '{{customer_name}}'
      }
    });
  }
}
```

---

## 4. Re-verification Triggers

### 4.1 Mandatory Re-verification

**Trigger 1: Annual Expiry**
- **Frequency**: Every 12 months
- **Grace Period**: 30 days to re-verify before account suspension
- **Process**: Same as initial KYC (ID + Selfie upload)

**Trigger 2: Address Change**
- **When**: Customer updates residential address
- **Required**: New proof of address document
- **Verification**: Manual review

**Trigger 3: Suspicious Activity**
- **When**: Fraud detection flags account
- **Required**: Full re-verification + additional documents
- **Process**: Manual review by compliance team

---

### 4.2 Optional Re-verification

**Trigger 4: Loan Amount Increase**
- **When**: Customer requests loan >$500 (Tier 3+)
- **Required**: Proof of income + updated address
- **Verification**: Manual review

**Trigger 5: Customer Request**
- **When**: Customer wants to update ID (new photo, name change)
- **Required**: New ID upload
- **Verification**: Standard DIDIT flow

---

### 4.3 Re-verification Flow

```
Customer triggers re-verification
          ↓
┌─────────────────────────┐
│ Set status: 'expired'   │
│ or 'flagged'            │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│ Send WhatsApp reminder  │
│ "Please re-verify"      │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│ Customer uploads        │
│ new documents           │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│ Status: 'pending'       │
│ → 'processing'          │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│ DIDIT check    │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│ Status: 'verified'      │
│ Account reactivated     │
└─────────────────────────┘
```

---

## 5. Expiry Handling

### 5.1 Expiry Timeline

```
KYC Verified
     ↓
   Month 11
     ↓
┌──────────────────┐
│ Send reminder:   │
│ "Re-verify in    │
│  30 days"        │
└────────┬─────────┘
         ↓
   Month 12
     ↓
┌──────────────────┐
│ Status: 'expired'│
│ Account suspended│
└────────┬─────────┘
         ↓
   Grace period
   (30 days)
     ↓
┌──────────────────┐
│ Final reminder:  │
│ "Re-verify now   │
│  or lose access" │
└────────┬─────────┘
         ↓
   Day 30 after expiry
     ↓
┌──────────────────┐
│ Account frozen   │
│ Cannot borrow    │
│ Must re-verify   │
└──────────────────┘
```

---

### 5.2 Grace Period Logic

```typescript
async function checkGracePeriod(customer_id: string): Promise<GraceStatus> {

  const { data: customer } = await supabase
    .from('customers')
    .select('kyc_status, kyc_verified_at, kyc_status_updated_at')
    .eq('id', customer_id)
    .single();

  if (customer.kyc_status !== 'expired') {
    return { in_grace_period: false };
  }

  const expiredDate = new Date(customer.kyc_status_updated_at);
  const gracePeriodEnd = new Date(expiredDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

  const now = new Date();
  const daysRemaining = Math.ceil(
    (gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining > 0) {
    return {
      in_grace_period: true,
      days_remaining: daysRemaining,
      grace_period_end: gracePeriodEnd
    };
  } else {
    return {
      in_grace_period: false,
      grace_period_expired: true
    };
  }
}
```

---

## 6. Status Querying

### 6.1 Get Current KYC Status

```typescript
async function getKYCStatus(customer_id: string): Promise<KYCStatusInfo> {

  const { data: customer } = await supabase
    .from('customers')
    .select('kyc_status, kyc_verified_at, kyc_status_updated_at')
    .eq('id', customer_id)
    .single();

  const status = customer.kyc_status as KYCStatus;

  // Calculate days until expiry (if verified)
  let days_until_expiry: number | null = null;
  if (status === 'verified' && customer.kyc_verified_at) {
    const verified_date = new Date(customer.kyc_verified_at);
    const expiry_date = new Date(verified_date);
    expiry_date.setMonth(expiry_date.getMonth() + 12);

    const now = new Date();
    days_until_expiry = Math.ceil(
      (expiry_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Get grace period info (if expired)
  const grace_status = status === 'expired'
    ? await checkGracePeriod(customer_id)
    : null;

  return {
    status: status,
    status_updated_at: customer.kyc_status_updated_at,
    verified_at: customer.kyc_verified_at,
    days_until_expiry: days_until_expiry,
    grace_period: grace_status,
    can_borrow: ['verified'].includes(status),
    action_required: getActionRequired(status)
  };
}
```

---

### 6.2 Status Display to Customer

```typescript
function getStatusDisplayMessage(status: KYCStatus): string {

  const messages: Record<KYCStatus, string> = {
    'not_started': '⚠️ KYC not started. Please upload your National ID and selfie to begin.',
    'pending': '⏳ Documents submitted. Verification in progress...',
    'processing': '🔄 Verifying your identity. This takes about 30 seconds...',
    'manual_review': '👤 Your documents are under manual review. You\'ll hear from us within 24 hours.',
    'verified': '✅ Identity verified. You can borrow up to your approved limit.',
    'rejected': '❌ Verification unsuccessful. You can retry up to 3 times.',
    'expired': '⚠️ Your KYC has expired. Please re-verify to continue borrowing.',
    'flagged': '🚩 Your account is under review. Please contact support.',
    'blocked': '🚫 Your account has been blocked. Contact support for assistance.'
  };

  return messages[status] || 'Unknown status';
}
```

---

## 7. Implementation

### 7.1 KYC Status Service

```typescript
// src/services/kyc/kyc-status-service.ts

export class KYCStatusService {

  /**
   * Get comprehensive KYC status info
   */
  async getStatus(customer_id: string): Promise<KYCStatusInfo> {
    return await getKYCStatus(customer_id);
  }

  /**
   * Transition to new status
   */
  async transition(
    customer_id: string,
    new_status: KYCStatus,
    reason: string
  ): Promise<void> {
    await transitionKYCStatus(customer_id, new_status, reason);
  }

  /**
   * Check if customer can borrow
   */
  async canBorrow(customer_id: string): Promise<boolean> {
    const status = await this.getStatus(customer_id);
    return status.can_borrow;
  }

  /**
   * Check if re-verification needed
   */
  async needsReverification(customer_id: string): Promise<boolean> {
    const status = await this.getStatus(customer_id);
    return ['expired', 'flagged'].includes(status.status);
  }

  /**
   * Trigger re-verification
   */
  async triggerReverification(
    customer_id: string,
    reason: string
  ): Promise<void> {

    await this.transition(customer_id, 'expired', reason);

    // Send notification
    await sendWhatsAppMessage(customer_id, {
      template: 'kyc_reverification_required',
      params: {
        reason: reason
      }
    });
  }

  /**
   * Expire old verifications (daily cron job)
   */
  async expireOldVerifications(): Promise<number> {
    const count = await expireOldVerifications();
    return count;
  }
}
```

---

### 7.2 Database Schema

```sql
-- KYC status history table
CREATE TABLE kyc_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Status transition
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,

  -- Metadata
  changed_by UUID REFERENCES admin_users(id),  -- NULL if automated
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Additional data
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_history_customer ON kyc_status_history(customer_id);
CREATE INDEX idx_kyc_history_status ON kyc_status_history(new_status);
```

---

### 7.3 Status Notification Templates

**Verified:**
```
✅ *Identity Verified!*

Your KYC verification is complete.

You can now borrow up to: *$200*

Valid for: 12 months

[Browse devices] [View my limit]
```

**Expired:**
```
⚠️ *Re-verification Required*

Your KYC verification has expired.

Please re-upload:
✓ National ID photo
✓ Recent selfie

Takes only 2 minutes!

[Re-verify now] [Why is this needed?]
```

**Manual Review:**
```
👤 *Manual Review in Progress*

Our team is reviewing your documents.

Typical review time: 2-12 hours
Maximum: 24 hours

You'll get an SMS when complete.

[Check status] [Contact support]
```

**Rejected:**
```
❌ *Verification Unsuccessful*

We couldn't verify your identity.

Reason: {{rejection_reason}}

You have {{attempts_remaining}} attempts remaining.

[Try again] [Get help]
```

---

## Summary

### Executive Summary
This specification defines the complete lifecycle management system for customer KYC (Know Your Customer) verification status. It implements a 9-state status machine with automated transitions, 12-month verification validity, and a 30-day grace period to ensure regulatory compliance while maintaining a smooth customer experience.

### What Was Delivered
This document provides:
1. **9 KYC Status States**: not_started → pending → processing → verified/rejected/manual_review, plus expired/flagged/blocked states
2. **State Machine Logic**: Allowed transitions with validation rules to prevent invalid state changes
3. **Verification Validity**: 12-month verification period with automated expiry tracking
4. **Grace Period System**: 30-day window after expiry before account restrictions
5. **Re-verification Triggers**: Annual expiry, address changes, suspicious activity detection
6. **Status History Tracking**: Complete audit trail of all status transitions with reasons
7. **Notification System**: Automated WhatsApp messages for each status change

### Technical Components
- **KYCStatusService**: Core service for status transitions and validation
- **State Machine**: Enforces allowed transitions (e.g., processing → verified/rejected/manual_review)
- **ExpiryChecker**: Daily cron job to mark 12-month old verifications as expired
- **GracePeriodManager**: Tracks 30-day grace period and triggers account restrictions
- **HistoryLogger**: Records all status changes with timestamps and reasons
- **NotificationDispatcher**: Sends status update messages to customers
- **Database Tables**: `customers.kyc_status`, `kyc_status_history`

### Business Impact
- **Regulatory Compliance**: Maintains up-to-date customer verification (Zimbabwe RBZ requirement)
- **User Retention**: 30-day grace period reduces customer churn from expired verifications
- **Fraud Prevention**: Flagged/blocked states enable rapid response to suspicious activity
- **Audit Trail**: Complete history supports regulatory audits and dispute resolution
- **Customer Trust**: Clear status notifications keep customers informed

### Implementation Checklist
- [ ] Create `kyc_status` enum and add to customers table
- [ ] Create `kyc_status_history` table for audit trail
- [ ] Implement KYCStatusService with state transition validation
- [ ] Build state machine with allowed transitions logic
- [ ] Set up daily cron job for verification expiry checks (runs at midnight)
- [ ] Implement 30-day grace period logic and account restrictions
- [ ] Create notification templates for each status (verified, expired, manual_review, rejected)
- [ ] Build webhook handler to update status from DIDIT callbacks
- [ ] Create admin dashboard for manual status changes (flagged/blocked)
- [ ] Set up monitoring alerts for blocked accounts and manual review queue

### Dependencies
- **DIDIT Webhooks**: Triggers status updates (processing → verified/rejected)
- **Database**: Customers table with kyc_status field
- **Notification System**: WhatsApp messaging for status updates
- **Cron Scheduler**: Daily job for expiry checks
- **Admin Dashboard**: Manual status management UI

### Related Specifications
- [KYC Document Requirements](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/kyc-document-requirements.md) - Verification process that creates statuses
- [DIDIT Integration](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/didit-integration.md) - Webhook triggers for status transitions
- [Customer Onboarding Flow](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/customer-onboarding-flow.md) - Initial KYC status creation
- [Privacy & Consent Management](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/privacy-consent-management.md) - Data retention after account blocking
- [Database Schema](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/database-schema.md) - Table definitions

### External References
- [Zimbabwe RBZ KYC Requirements](https://www.rbz.co.zw) - Regulatory compliance guidelines
- [FATF KYC Standards](https://www.fatf-gafi.org) - International anti-money laundering standards
