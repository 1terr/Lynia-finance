# Credit Limit Management & Tier Progression

**Task ID**: P1-T020
**Phase**: Phase 1 - Credit Management System
**Priority**: High
**Estimated**: 4 hours
**Dependencies**: P1-T017 (Rules)

---

## Table of Contents
1. [Overview](#overview)
2. [Tier System](#tier-system)
3. [Tier Progression Rules](#tier-progression-rules)
4. [Automatic Upgrades](#automatic-upgrades)
5. [Downgrade Scenarios](#downgrade-scenarios)
6. [Manual Overrides](#manual-overrides)
7. [Implementation](#implementation)

---

## 1. Overview

Lynia Finance uses a **3-tier credit limit system** that rewards customers for good repayment behavior with higher limits and better terms.

### Tier Structure

| Tier | Credit Limit | Target Customer | Deposit | Interest Rate* |
|------|--------------|-----------------|---------|----------------|
| **Tier 1** | $200 | First-time borrowers | 10% | 15% APR |
| **Tier 2** | $350 | 1+ successful repayment | 10% | 12% APR |
| **Tier 3** | $500 | 3+ successful repayments | 5% | 10% APR |

*Note: Interest rates are configurable in `system_config` table. Display only total repayment to customers (not interest rate).

---

### Graduation Model (M-Kopa Inspired)

```
Start ──► Tier 1 ($200) ──► Tier 2 ($350) ──► Tier 3 ($500)
         First Loan         After 1 Loan      After 3 Loans
                            90% on-time       95% on-time
                            6+ months         12+ months
```

**Philosophy**: "Start small, prove yourself, graduate to larger loans"

---

## 2. Tier System

### 2.1 Tier 1: First-Time Borrowers

**Eligibility**:
- ✅ KYC approved
- ✅ Credit score ≥650
- ✅ No prior loans with Lynia

**Credit Limit**: $200

**Restrictions**:
- Maximum 1 active loan at a time
- Cannot upgrade until first loan paid off
- 10% deposit required

**Typical Use Cases**:
- Samsung Galaxy A04 ($200)
- Tecno Spark 10 ($180)
- Entry-level smartphones

**User Message**:
```
Welcome to Lynia Finance! 🎉

You've been approved for:
• Credit Limit: $200
• Tier: 1 (First-Time Borrower)
• Monthly Payment: Based on device price
• Deposit: 10% upfront

After completing your first loan successfully, you'll qualify for Tier 2 ($350 limit)!
```

---

### 2.2 Tier 2: Proven Borrowers

**Eligibility**:
- ✅ 1+ loans completed successfully
- ✅ Payment history: ≥90% on-time
- ✅ Credit score ≥700
- ✅ 6+ months as customer

**Credit Limit**: $350

**Benefits**:
- Access to mid-range devices
- Maximum 2 concurrent loans
- 10% deposit (same as Tier 1)
- Lower interest rate (12% vs 15%)

**Typical Use Cases**:
- Samsung Galaxy A14 ($300)
- Xiaomi Redmi Note 12 ($280)
- Tecno Spark 10 Pro ($250)

**User Message**:
```
Congratulations! You've been upgraded to Tier 2! 🎉

Your new benefits:
• Credit Limit: $350 (was $200)
• Access to better devices
• 2 active loans allowed
• Lower monthly payments

Keep up the good work to reach Tier 3 ($500)!
```

---

### 2.3 Tier 3: VIP Borrowers

**Eligibility**:
- ✅ 3+ loans completed successfully
- ✅ Payment history: ≥95% on-time
- ✅ Credit score ≥750
- ✅ 12+ months as customer

**Credit Limit**: $500

**Benefits**:
- Access to premium devices
- Maximum 2 concurrent loans
- **5% deposit** (half of Tier 1/2)
- Lowest interest rate (10%)
- Priority customer support
- Early access to new devices

**Typical Use Cases**:
- Samsung Galaxy A34 ($450)
- iPhone SE ($480)
- Samsung Galaxy M33 ($380)

**User Message**:
```
🌟 VIP Status Unlocked! 🌟

Welcome to Tier 3:
• Credit Limit: $500 (was $350)
• Premium devices available
• Only 5% deposit required!
• Best interest rates
• Priority support

Thank you for being a valued Lynia customer!
```

---

## 3. Tier Progression Rules

### 3.1 Tier 1 → Tier 2 Requirements

```typescript
interface TierProgressionRequirement {
  type: 'loan_count' | 'payment_history' | 'credit_score' | 'time_as_customer' | 'no_defaults';
  threshold: number | boolean;
  unit: string;
  current_value?: number | boolean;
  met: boolean;
}

async function checkTier1to2Eligibility(customer: Customer): Promise<{
  eligible: boolean;
  requirements: TierProgressionRequirement[];
  next_action?: string;
}> {

  const requirements: TierProgressionRequirement[] = [
    {
      type: 'loan_count',
      threshold: 1,
      unit: 'completed_loans',
      current_value: customer.completed_loans_count,
      met: customer.completed_loans_count >= 1
    },
    {
      type: 'payment_history',
      threshold: 0.90,
      unit: 'on_time_rate',
      current_value: customer.payment_on_time_rate,
      met: customer.payment_on_time_rate >= 0.90
    },
    {
      type: 'credit_score',
      threshold: 700,
      unit: 'fico_score',
      current_value: customer.credit_score,
      met: customer.credit_score >= 700
    },
    {
      type: 'time_as_customer',
      threshold: 6,
      unit: 'months',
      current_value: monthsSince(customer.created_at),
      met: monthsSince(customer.created_at) >= 6
    },
    {
      type: 'no_defaults',
      threshold: true,
      unit: 'boolean',
      current_value: customer.defaulted_loans_count === 0,
      met: customer.defaulted_loans_count === 0
    }
  ];

  const unmetRequirements = requirements.filter(r => !r.met);
  const eligible = unmetRequirements.length === 0;

  let next_action = null;
  if (!eligible) {
    const first_unmet = unmetRequirements[0];
    next_action = generateNextActionMessage(first_unmet);
  }

  return { eligible, requirements, next_action };
}

function generateNextActionMessage(requirement: TierProgressionRequirement): string {
  switch (requirement.type) {
    case 'loan_count':
      return `Complete ${requirement.threshold - requirement.current_value} more loan(s)`;
    case 'payment_history':
      const pct_needed = (requirement.threshold * 100).toFixed(0);
      const pct_current = (requirement.current_value * 100).toFixed(0);
      return `Improve on-time payment rate from ${pct_current}% to ${pct_needed}%`;
    case 'credit_score':
      return `Increase credit score from ${requirement.current_value} to ${requirement.threshold}`;
    case 'time_as_customer':
      const months_left = requirement.threshold - requirement.current_value;
      return `Wait ${months_left} more month(s) as a customer`;
    case 'no_defaults':
      return `No defaults allowed for tier upgrade`;
    default:
      return 'Meet all requirements';
  }
}
```

---

### 3.2 Tier 2 → Tier 3 Requirements

**Stricter Requirements** (VIP status):

```typescript
async function checkTier2to3Eligibility(customer: Customer): Promise<{
  eligible: boolean;
  requirements: TierProgressionRequirement[];
}> {

  const requirements: TierProgressionRequirement[] = [
    {
      type: 'loan_count',
      threshold: 3,
      unit: 'completed_loans',
      current_value: customer.completed_loans_count,
      met: customer.completed_loans_count >= 3
    },
    {
      type: 'payment_history',
      threshold: 0.95,  // Stricter: 95% vs 90%
      unit: 'on_time_rate',
      current_value: customer.payment_on_time_rate,
      met: customer.payment_on_time_rate >= 0.95
    },
    {
      type: 'credit_score',
      threshold: 750,  // Stricter: 750 vs 700
      unit: 'fico_score',
      current_value: customer.credit_score,
      met: customer.credit_score >= 750
    },
    {
      type: 'time_as_customer',
      threshold: 12,  // Stricter: 12 months vs 6 months
      unit: 'months',
      current_value: monthsSince(customer.created_at),
      met: monthsSince(customer.created_at) >= 12
    },
    {
      type: 'no_defaults',
      threshold: true,
      unit: 'boolean',
      current_value: customer.defaulted_loans_count === 0,
      met: customer.defaulted_loans_count === 0
    }
  ];

  const eligible = requirements.every(r => r.met);

  return { eligible, requirements };
}
```

---

## 4. Automatic Upgrades

### 4.1 Trigger: Loan Paid Off

**Event**: Customer completes a loan repayment

```typescript
// Event handler: loan.paid_off
async function onLoanPaidOff(loan: Loan): Promise<void> {
  const customer = await getCustomer(loan.customer_id);

  // Recalculate credit score
  const newCreditScore = await recalculateCreditScore(customer);

  // Check tier eligibility
  const currentTier = customer.credit_tier;
  let eligibleForUpgrade = false;
  let newTier = currentTier;

  if (currentTier === 1) {
    const eligibility = await checkTier1to2Eligibility(customer);
    if (eligibility.eligible) {
      eligibleForUpgrade = true;
      newTier = 2;
    }
  } else if (currentTier === 2) {
    const eligibility = await checkTier2to3Eligibility(customer);
    if (eligibility.eligible) {
      eligibleForUpgrade = true;
      newTier = 3;
    }
  }

  // Apply upgrade
  if (eligibleForUpgrade) {
    await upgradeTier(customer, newTier);

    // Send congratulatory notification
    await sendTierUpgradeNotification(customer, currentTier, newTier);

    // Log event
    await logAuditEvent({
      action: 'tier_upgraded',
      customer_id: customer.id,
      old_tier: currentTier,
      new_tier: newTier,
      trigger: 'loan_paid_off',
      loan_id: loan.id
    });
  }
}
```

---

### 4.2 Notification Templates

**Tier 1 → Tier 2 Upgrade**:
```
🎉 Congratulations, [Name]!

You've been upgraded to Tier 2!

Your new benefits:
✅ Credit Limit: $350 (was $200)
✅ Access to mid-range devices
✅ Up to 2 active loans
✅ Lower interest rates

You've earned this by:
• Completing 1 loan on time
• Maintaining 90%+ on-time payments
• Credit score: [score]

Ready to shop?
[Browse Devices] [View Account]
```

**Tier 2 → Tier 3 Upgrade**:
```
🌟 VIP STATUS UNLOCKED! 🌟

Welcome to Tier 3, [Name]!

Your VIP benefits:
✅ Credit Limit: $500 (was $350)
✅ Premium devices available
✅ Only 5% deposit (was 10%)!
✅ Best interest rates (10%)
✅ Priority customer support

You've achieved this by:
• Completing 3+ loans successfully
• 95%+ on-time payment history
• 12+ months as a valued customer
• Credit score: [score]

Thank you for your loyalty! 💚

[Browse Premium Devices] [View VIP Perks]
```

---

### 4.3 Upgrade Cooldown

**Prevent Gaming**: Cannot upgrade more than once every 30 days

```typescript
function canUpgradeTier(customer: Customer, proposedNewTier: number): {
  allowed: boolean;
  reason?: string;
  cooldown_remaining_days?: number;
} {

  // Check if recently upgraded
  const lastUpgrade = customer.last_tier_upgrade_at;

  if (lastUpgrade) {
    const daysSinceUpgrade = daysSince(lastUpgrade);

    if (daysSinceUpgrade < 30) {
      return {
        allowed: false,
        reason: 'Tier upgrade cooldown active',
        cooldown_remaining_days: 30 - daysSinceUpgrade
      };
    }
  }

  return { allowed: true };
}
```

---

## 5. Downgrade Scenarios

### 5.1 When to Downgrade

**Automatic Downgrades** (triggered by system):

1. **Default on Loan**: Immediate downgrade to Tier 1
2. **Repeated Late Payments**: On-time rate drops below tier threshold
3. **Credit Score Drop**: Score falls below tier minimum

```typescript
async function evaluateTierDowngrade(customer: Customer): Promise<{
  should_downgrade: boolean;
  new_tier: number;
  reason: string;
}> {

  const currentTier = customer.credit_tier;

  // Check for defaults
  if (customer.has_active_default) {
    return {
      should_downgrade: true,
      new_tier: 1,
      reason: 'Loan default'
    };
  }

  // Check payment history
  if (currentTier === 3 && customer.payment_on_time_rate < 0.95) {
    return {
      should_downgrade: true,
      new_tier: 2,
      reason: 'Payment history below 95%'
    };
  }

  if (currentTier === 2 && customer.payment_on_time_rate < 0.90) {
    return {
      should_downgrade: true,
      new_tier: 1,
      reason: 'Payment history below 90%'
    };
  }

  // Check credit score
  if (currentTier === 3 && customer.credit_score < 750) {
    return {
      should_downgrade: true,
      new_tier: 2,
      reason: 'Credit score below 750'
    };
  }

  if (currentTier === 2 && customer.credit_score < 700) {
    return {
      should_downgrade: true,
      new_tier: 1,
      reason: 'Credit score below 700'
    };
  }

  return {
    should_downgrade: false,
    new_tier: currentTier,
    reason: 'Tier maintained'
  };
}
```

---

### 5.2 Downgrade Grace Period

**30-Day Grace Period**: Give customers a chance to recover before downgrading

```typescript
interface TierWarning {
  customer_id: string;
  current_tier: number;
  at_risk_tier: number;
  warning_issued_at: Date;
  grace_period_ends_at: Date;
  reason: string;
  recovery_actions: string[];
}

async function issueDowngradeWarning(customer: Customer, reason: string): Promise<void> {
  const warning: TierWarning = {
    customer_id: customer.id,
    current_tier: customer.credit_tier,
    at_risk_tier: customer.credit_tier - 1,
    warning_issued_at: new Date(),
    grace_period_ends_at: addDays(new Date(), 30),
    reason,
    recovery_actions: [
      'Make on-time payments for next 30 days',
      'Pay down outstanding balance',
      'Contact support for payment plan'
    ]
  };

  // Store warning
  await db.tier_warnings.insert(warning);

  // Send notification
  await sendDowngradeWarningNotification(customer, warning);
}
```

**Warning Notification**:
```
⚠️ Credit Tier Warning

Hi [Name],

Your Tier [X] status is at risk due to: [reason]

If not resolved within 30 days, your tier will be downgraded to Tier [Y], which means:
❌ Credit limit: $[new_limit] (currently $[current_limit])
❌ Higher deposit required
❌ Higher interest rates

To maintain your tier:
• Make all payments on time
• Pay down outstanding balance
• Contact support for help: +263771234567

We're here to help!
```

---

## 6. Manual Overrides

### 6.1 Admin Override: Tier Adjustment

**Use Cases**:
- Customer hardship (temporary financial difficulty)
- System error correction
- Special VIP program
- Partnership/referral bonus

```typescript
interface TierOverride {
  override_id: string;
  customer_id: string;
  admin_user_id: string;
  previous_tier: number;
  new_tier: number;
  override_type: 'upgrade' | 'downgrade' | 'temporary_increase';
  reason: string;
  approved_by_senior_admin?: string;
  expires_at?: Date;  // For temporary increases
  created_at: Date;
}

async function applyTierOverride(override: TierOverride): Promise<void> {
  // Validate admin permissions
  const admin = await getAdminUser(override.admin_user_id);

  if (override.override_type === 'upgrade' && admin.role !== 'super_admin') {
    throw new Error('Only super_admin can manually upgrade tiers');
  }

  // Apply override
  await db.customers.update({
    id: override.customer_id
  }, {
    credit_tier: override.new_tier,
    credit_limit: getCreditLimitForTier(override.new_tier),
    tier_override_active: true,
    tier_override_reason: override.reason,
    tier_override_expires_at: override.expires_at,
    tier_override_by: override.admin_user_id
  });

  // Audit log
  await logAuditEvent({
    action: 'tier_manual_override',
    customer_id: override.customer_id,
    admin_user_id: override.admin_user_id,
    old_data: { tier: override.previous_tier },
    new_data: { tier: override.new_tier },
    reason: override.reason,
    severity: 'warning'
  });

  // Notify customer
  await sendTierChangeNotification(override);
}
```

---

### 6.2 Temporary Limit Increase

**Scenario**: Customer needs higher limit for one-time purchase (e.g., birthday gift)

```typescript
async function requestTemporaryLimitIncrease(
  customer_id: string,
  requested_limit: number,
  reason: string,
  duration_days: number = 30
): Promise<{
  approved: boolean;
  new_limit: number;
  expires_at: Date;
  approval_reason: string;
}> {

  const customer = await getCustomer(customer_id);

  // Eligibility check
  if (customer.credit_tier < 2) {
    return {
      approved: false,
      new_limit: customer.credit_limit,
      expires_at: null,
      approval_reason: 'Temporary increases only available for Tier 2+ customers'
    };
  }

  if (customer.payment_on_time_rate < 0.95) {
    return {
      approved: false,
      new_limit: customer.credit_limit,
      expires_at: null,
      approval_reason: 'Payment history does not qualify for temporary increase'
    };
  }

  // Calculate approved limit (max 50% above base)
  const maxTempLimit = customer.credit_limit * 1.5;
  const approvedLimit = Math.min(requested_limit, maxTempLimit);
  const expiresAt = addDays(new Date(), duration_days);

  // Apply temporary increase
  await db.customers.update({
    id: customer_id
  }, {
    credit_limit_temporary: approvedLimit,
    credit_limit_temporary_expires_at: expiresAt,
    credit_limit_temporary_reason: reason
  });

  return {
    approved: true,
    new_limit: approvedLimit,
    expires_at: expiresAt,
    approval_reason: `Temporary increase approved for ${duration_days} days based on excellent payment history`
  };
}
```

---

## 7. Implementation

### 7.1 Database Schema Updates

```sql
-- Add tier tracking fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS
  credit_tier INTEGER DEFAULT 1 CHECK (credit_tier BETWEEN 1 AND 3),
  last_tier_upgrade_at TIMESTAMP WITH TIME ZONE,
  last_tier_downgrade_at TIMESTAMP WITH TIME ZONE,
  tier_override_active BOOLEAN DEFAULT false,
  tier_override_reason TEXT,
  tier_override_expires_at TIMESTAMP WITH TIME ZONE,
  tier_override_by UUID REFERENCES admin_users(id),

  -- Temporary limit increase
  credit_limit_temporary DECIMAL(10,2),
  credit_limit_temporary_expires_at TIMESTAMP WITH TIME ZONE,
  credit_limit_temporary_reason TEXT;

-- Tier history log
CREATE TABLE tier_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  previous_tier INTEGER NOT NULL,
  new_tier INTEGER NOT NULL,
  change_type VARCHAR(20) NOT NULL, -- upgrade, downgrade, override
  trigger VARCHAR(50), -- loan_paid_off, payment_late, admin_override
  reason TEXT,
  admin_user_id UUID REFERENCES admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tier_changes_customer ON tier_changes(customer_id);
CREATE INDEX idx_tier_changes_created ON tier_changes(created_at DESC);
```

---

### 7.2 Tier Upgrade Check (Scheduled Job)

```typescript
// Run daily at 2am
async function dailyTierEligibilityCheck(): Promise<void> {
  console.log('Starting daily tier eligibility check...');

  // Get all customers eligible for review
  const customers = await db.customers.find({
    credit_tier: { $lt: 3 },  // Not already max tier
    kyc_status: 'approved',
    blacklisted: false
  });

  let upgradesProcessed = 0;

  for (const customer of customers) {
    try {
      // Check if eligible for upgrade
      let eligibility;

      if (customer.credit_tier === 1) {
        eligibility = await checkTier1to2Eligibility(customer);
      } else if (customer.credit_tier === 2) {
        eligibility = await checkTier2to3Eligibility(customer);
      }

      if (eligibility.eligible) {
        const newTier = customer.credit_tier + 1;
        await upgradeTier(customer, newTier);
        upgradesProcessed++;
      }
    } catch (error) {
      console.error(`Error checking eligibility for customer ${customer.id}:`, error);
    }
  }

  console.log(`Tier eligibility check complete. ${upgradesProcessed} customers upgraded.`);
}
```

---

## Summary

**Credit Limit Management Features**:
- ✅ **3-Tier System**: $200 / $350 / $500
- ✅ **Automatic Upgrades**: Based on payment history + credit score
- ✅ **Downgrade Protection**: 30-day grace period
- ✅ **Manual Overrides**: Admin can adjust with audit trail
- ✅ **Temporary Increases**: For special occasions
- ✅ **Clear Requirements**: Transparent path to next tier
- ✅ **Gamification**: Motivates good payment behavior

**Tier Progression Timeline**:
- Tier 1 → Tier 2: ~6-8 months (1 successful loan)
- Tier 2 → Tier 3: ~12-18 months (3 successful loans)

**Business Impact**:
- Reduces defaults (customers want to maintain tier)
- Increases customer lifetime value (repeat borrowers)
- Builds long-term relationships (loyalty rewards)

Inspired by: M-Kopa graduation model, Moove tiered financing
