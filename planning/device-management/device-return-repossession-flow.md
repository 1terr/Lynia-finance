# P1-T035: Device Return/Repossession Flow

**Task ID:** P1-T035
**Section:** 1.6 Device Management Design
**Priority:** Medium
**Estimated Duration:** 4 hours
**Dependencies:** Device Lock/Unlock Integration (P1-T033), Device Condition Assessment (P1-T036)
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Voluntary Returns](#voluntary-returns)
3. [Repossession Process](#repossession-process)
4. [Device Collection](#device-collection)
5. [Post-Return Processing](#post-return-processing)
6. [Refurbishment & Resale](#refurbishment--resale)
7. [Implementation](#implementation)

---

## 1. Overview

The Device Return/Repossession Flow handles two scenarios: (1) voluntary device returns by customers, and (2) involuntary repossession due to loan default. Both processes ensure proper asset recovery while maintaining customer relationships and legal compliance.

### Business Goals

1. **Asset Recovery**: Recover financed devices to minimize losses
2. **Customer Flexibility**: Allow voluntary returns with minimal penalties
3. **Legal Compliance**: Follow Zimbabwe consumer protection laws
4. **Device Refurbishment**: Prepare returned devices for resale
5. **Relationship Management**: Maintain goodwill even in default situations

### Key Metrics

- **Voluntary Return Rate**: <5% (minimize dissatisfied customers)
- **Repossession Success Rate**: >80% (devices actually recovered)
- **Average Return Processing Time**: 3-5 business days
- **Refurbishment Success Rate**: >90% (devices made resalable)
- **Resale Value Recovery**: 60-70% of original retail price

---

## 2. Voluntary Returns

### 2.1 Return Policy

**Customer Eligibility for Voluntary Return**:

1. **Early Return** (Within 14 days of handover):
   - Full refund of deposit minus 10% restocking fee
   - Customer pays for any device damage
   - No credit score impact

2. **Standard Return** (15-90 days):
   - Refund 50% of deposit
   - Customer liable for payments already made
   - Negative credit score impact (-50 points)

3. **Late Return** (90+ days):
   - No deposit refund
   - Customer must pay any outstanding balance
   - Significant credit score impact (-100 points)

---

### 2.2 Return Reasons

```typescript
type ReturnReason =
  | 'financial_difficulty'
  | 'device_issues'
  | 'changed_mind'
  | 'better_offer_elsewhere'
  | 'device_too_expensive'
  | 'other';

interface DeviceReturn {
  return_id: string;
  loan_id: string;
  customer_id: string;
  device_id: string;

  return_type: 'voluntary' | 'repossession';
  return_reason: ReturnReason;
  customer_explanation: string;

  initiated_at: Date;
  scheduled_collection_date: Date;
  collected_at: Date | null;

  device_condition_at_return: DeviceCondition;
  deposit_refund_amount: number;
  outstanding_balance: number;

  status: 'requested' | 'scheduled' | 'collected' | 'processed' | 'cancelled';
}
```

---

### 2.3 Return Request Flow

**Customer initiates return via WhatsApp**:

```
Customer: "I want to return my phone"

Bot: "I'm sorry to hear that. Let me help you with the return process.

Can you tell us why you'd like to return your Samsung Galaxy A14?

1️⃣ Financial difficulties
2️⃣ Issues with the device
3️⃣ Changed my mind
4️⃣ Other reason

Reply with the number."

Customer: "1"

Bot: "I understand. We want to help.

Before returning, would you like to:
• Request a payment extension (up to 30 days)
• Reduce your monthly payment (extend loan term)
• Speak to our support team about options

[Request Extension] [Proceed with Return] [Talk to Support]"
```

**If customer proceeds with return**:

```typescript
async function initiateVoluntaryReturn(
  customerId: string,
  loanId: string,
  reason: ReturnReason,
  explanation: string
): Promise<DeviceReturn> {

  const loan = await getLoan(loanId);
  const device = await getDevice(loan.device_id);

  // Calculate refund based on return timing
  const daysSinceHandover = daysSince(loan.disbursed_at);
  const depositRefund = calculateDepositRefund(
    loan.deposit_amount,
    daysSinceHandover
  );

  // Calculate outstanding balance
  const outstandingBalance = loan.principal - loan.amount_paid;

  // Create return request
  const deviceReturn: DeviceReturn = {
    return_id: generateId(),
    loan_id: loanId,
    customer_id: customerId,
    device_id: loan.device_id,

    return_type: 'voluntary',
    return_reason: reason,
    customer_explanation: explanation,

    initiated_at: new Date(),
    scheduled_collection_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),  // 3 days
    collected_at: null,

    device_condition_at_return: null,  // Assessed at collection
    deposit_refund_amount: depositRefund,
    outstanding_balance: outstandingBalance,

    status: 'requested'
  };

  await supabase.from('device_returns').insert(deviceReturn);

  // Notify customer
  await sendReturnConfirmation(customerId, deviceReturn);

  return deviceReturn;
}

function calculateDepositRefund(
  depositAmount: number,
  daysSinceHandover: number
): number {

  if (daysSinceHandover <= 14) {
    // Early return: 90% refund (10% restocking fee)
    return depositAmount * 0.90;
  } else if (daysSinceHandover <= 90) {
    // Standard return: 50% refund
    return depositAmount * 0.50;
  } else {
    // Late return: No refund
    return 0;
  }
}
```

---

## 3. Repossession Process

### 3.1 Repossession Triggers

**Automatic repossession triggers**:

1. **Severe Default** (60+ days overdue):
   - 2+ missed payments
   - Total arrears > $100

2. **Fraud Suspicion**:
   - Device reported stolen
   - Customer unreachable for 30+ days
   - Multiple failed contact attempts

3. **Breach of Terms**:
   - Device sold/transferred without permission
   - Lynia Device Manager app uninstalled
   - Device IMEI changed/tampered

---

### 3.2 Legal Notice Requirements (Zimbabwe Law)

**Required steps before repossession**:

```typescript
interface RepossessionNotice {
  notice_id: string;
  loan_id: string;
  customer_id: string;

  notice_type: 'warning' | 'final_notice' | 'legal_notice';
  sent_at: Date;
  delivery_method: 'whatsapp' | 'sms' | 'email' | 'registered_mail';
  delivered: boolean;
  delivered_at: Date | null;

  cure_period_days: number;  // Days customer has to cure default
  cure_deadline: Date;
}

async function sendRepossessionNotice(
  loanId: string,
  noticeType: 'warning' | 'final_notice' | 'legal_notice'
): Promise<void> {

  const loan = await getLoan(loanId);
  const customer = await getCustomer(loan.customer_id);

  const curePeriodDays = noticeType === 'warning' ? 14 : 7;

  const notice: RepossessionNotice = {
    notice_id: generateId(),
    loan_id: loanId,
    customer_id: loan.customer_id,
    notice_type: noticeType,
    sent_at: new Date(),
    delivery_method: 'whatsapp',  // Primary
    delivered: false,
    delivered_at: null,
    cure_period_days: curePeriodDays,
    cure_deadline: new Date(Date.now() + curePeriodDays * 24 * 60 * 60 * 1000)
  };

  await supabase.from('repossession_notices').insert(notice);

  // Send notice via WhatsApp
  await sendWhatsAppNotice(customer.phone_number, notice);

  // Also send via SMS (backup)
  await sendSMSNotice(customer.phone_number, notice);

  // If final notice, also send registered mail (legal requirement)
  if (noticeType === 'legal_notice') {
    await sendRegisteredMail(customer.address, notice);
  }
}
```

**Notice Timeline**:

```
Day 0 (60 days overdue):
├─ WARNING NOTICE sent
├─ 14-day cure period
└─ Customer can cure default by paying arrears

Day 14 (no payment):
├─ FINAL NOTICE sent
├─ 7-day cure period
└─ Device lock may be activated

Day 21 (no payment):
├─ LEGAL NOTICE sent (registered mail)
├─ 7-day cure period
└─ Repossession proceedings begin

Day 28 (no payment):
└─ Repossession executed
```

---

### 3.3 Repossession Notice Templates

**Warning Notice**:

```
⚠️ *Important: Loan Default Notice*

Your loan is now 60 days overdue.

Outstanding Balance: $150.00
Arrears: 2 payments

If payment is not received within 14 days, we may proceed with device repossession.

To avoid repossession:
• Pay the full arrears of $150.00
• Or contact us to arrange a payment plan

Payment Due: December 14, 2025

[Pay Now] [Request Payment Plan] [Contact Support]

This is a legal notice. Please take action immediately.
```

**Final Notice**:

```
🚨 *FINAL NOTICE: Repossession Pending*

You have not responded to our previous notice.

Your loan remains in default. If payment is not received within 7 days, we will proceed with legal repossession of your device.

Outstanding Balance: $150.00
Final Payment Deadline: December 21, 2025

[Pay Now Immediately] [Emergency Contact]
```

---

### 3.4 Repossession Execution

```typescript
async function executeRepossession(loanId: string): Promise<void> {

  const loan = await getLoan(loanId);

  // Step 1: Lock device
  await lockDevice(loan.device_id, 'Repossession - loan default');

  // Step 2: Create repossession order
  const repossessionOrder = {
    order_id: generateId(),
    loan_id: loanId,
    customer_id: loan.customer_id,
    device_id: loan.device_id,

    status: 'pending_collection',
    collection_method: 'distributor_return',  // or 'field_agent'
    scheduled_collection_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),

    created_at: new Date()
  };

  await supabase.from('repossession_orders').insert(repossessionOrder);

  // Step 3: Notify customer of repossession
  await sendRepossessionNotification(loan.customer_id, repossessionOrder);

  // Step 4: Assign to field agent (if applicable)
  // await assignFieldAgent(repossessionOrder.order_id);
}
```

---

## 4. Device Collection

### 4.1 Collection Methods

**3 Collection Methods**:

1. **Customer Drop-Off** (Preferred - 60%):
   - Customer returns device to distributor location
   - Incentive: Waive 50% of outstanding balance if returned within 7 days
   - Fast, low-cost

2. **Field Agent Collection** (40%):
   - Agent visits customer location
   - Used when customer unresponsive
   - Higher cost ($20-50 per collection)

3. **Legal Seizure** (<1%):
   - Court order required
   - Last resort for high-value devices
   - Expensive, slow process

---

### 4.2 Customer Drop-Off Process

**Incentivize voluntary drop-off**:

```
📍 *Device Return Instructions*

To minimize your outstanding balance, please return your device to any of our locations:

*Locations*:
1. Harare - 123 Main St (Mon-Sat 9AM-5PM)
2. Bulawayo - 456 High St (Mon-Sat 9AM-5PM)

*Return within 7 days* and we'll waive 50% of your outstanding balance ($75).

What to bring:
✓ Your device
✓ Charger and accessories
✓ National ID

[Get Directions] [Call Location]
```

---

### 4.3 Field Agent Collection

```typescript
interface FieldAgent {
  agent_id: string;
  name: string;
  phone_number: string;
  active_zone: string;  // e.g., "Harare North"
  success_rate: number;  // % of successful collections
}

async function assignFieldAgent(repossessionOrderId: string): Promise<void> {

  const { data: order } = await supabase
    .from('repossession_orders')
    .select('*, customers(*)')
    .eq('order_id', repossessionOrderId)
    .single();

  // Find available agent in customer's area
  const { data: agent } = await supabase
    .from('field_agents')
    .select('*')
    .eq('active_zone', order.customers.city)
    .eq('status', 'available')
    .order('success_rate', { ascending: false })
    .limit(1)
    .single();

  if (!agent) {
    throw new Error('No available field agents');
  }

  // Assign agent
  await supabase.from('repossession_orders').update({
    assigned_agent_id: agent.agent_id,
    assigned_at: new Date(),
    status: 'assigned'
  }).eq('order_id', repossessionOrderId);

  // Notify agent
  await notifyFieldAgent(agent.agent_id, order);
}
```

**Field Agent App**:

```
┌─────────────────────────────────────────┐
│     REPOSSESSION ASSIGNMENT             │
├─────────────────────────────────────────┤
│                                         │
│ Customer: John Doe                      │
│ Phone: +263 771 234 567                 │
│ Address: 123 Main St, Harare            │
│                                         │
│ Device: Samsung Galaxy A14              │
│ IMEI: 123456789012345                   │
│                                         │
│ Outstanding Balance: $150.00            │
│ Days Overdue: 75                        │
│                                         │
│ [Navigate to Address]                   │
│ [Call Customer]                         │
│ [Mark as Collected]                     │
│ [Report Issue]                          │
└─────────────────────────────────────────┘
```

---

## 5. Post-Return Processing

### 5.1 Device Inspection

**Upon device collection**:

```typescript
async function inspectReturnedDevice(
  returnId: string,
  inspectorId: string
): Promise<DeviceCondition> {

  const { data: deviceReturn } = await supabase
    .from('device_returns')
    .select('*, devices(*)')
    .eq('return_id', returnId)
    .single();

  // Conduct inspection
  const condition = await assessDeviceCondition(
    deviceReturn.device_id,
    inspectorId
  );

  // Update return record
  await supabase.from('device_returns').update({
    device_condition_at_return: condition,
    collected_at: new Date(),
    status: 'collected'
  }).eq('return_id', returnId);

  // Calculate any damage charges
  const damageCharges = calculateDamageCharges(condition);

  if (damageCharges > 0) {
    // Deduct from deposit refund
    await adjustDepositRefund(returnId, damageCharges);
  }

  return condition;
}

function calculateDamageCharges(condition: DeviceCondition): number {

  let charges = 0;

  if (condition.screen_condition === 'cracked') {
    charges += 50;  // Screen replacement
  }

  if (condition.body_condition === 'heavily_damaged') {
    charges += 30;  // Body repair
  }

  if (!condition.fully_functional) {
    charges += 40;  // Repair costs
  }

  return charges;
}
```

---

### 5.2 Loan Settlement

**Calculate final settlement**:

```typescript
async function settleLoan(
  loanId: string,
  returnId: string
): Promise<LoanSettlement> {

  const loan = await getLoan(loanId);
  const deviceReturn = await getDeviceReturn(returnId);

  // Calculate what customer owes/gets back
  const amountPaid = loan.amount_paid;
  const principal = loan.principal;
  const outstandingBalance = principal - amountPaid;

  const depositRefund = deviceReturn.deposit_refund_amount;
  const damageCharges = deviceReturn.damage_charges || 0;

  // Net settlement
  const netAmount = depositRefund - damageCharges - outstandingBalance;

  const settlement: LoanSettlement = {
    loan_id: loanId,
    return_id: returnId,

    amount_paid_by_customer: amountPaid,
    principal: principal,
    outstanding_balance: outstandingBalance,

    deposit_refund: depositRefund,
    damage_charges: damageCharges,

    net_settlement: netAmount,  // Positive = refund to customer, Negative = customer owes
    settlement_type: netAmount >= 0 ? 'refund' : 'balance_due',

    settled_at: new Date()
  };

  await supabase.from('loan_settlements').insert(settlement);

  // Update loan status
  await supabase.from('loans').update({
    status: 'returned',
    returned_at: new Date(),
    settlement_amount: netAmount
  }).eq('id', loanId);

  // Process refund or request payment
  if (netAmount > 0) {
    await processRefund(loan.customer_id, netAmount);
  } else if (netAmount < 0) {
    await requestBalancePayment(loan.customer_id, Math.abs(netAmount));
  }

  return settlement;
}
```

---

## 6. Refurbishment & Resale

### 6.1 Device Refurbishment

**Prepare device for resale**:

```typescript
async function refurbishDevice(deviceId: string): Promise<void> {

  const device = await getDevice(deviceId);

  // Step 1: Factory reset
  await factoryResetDevice(deviceId);

  // Step 2: Remove Lynia Device Manager app
  await removeAppFromDevice(deviceId);

  // Step 3: Clean IMEI blacklist (if applicable)
  await removeFromBlacklist(device.imei);

  // Step 4: Physical cleaning/repair
  const repairNeeded = await assessRepairNeeds(deviceId);

  if (repairNeeded.length > 0) {
    // Send to repair center
    await createRepairOrder(deviceId, repairNeeded);
  }

  // Step 5: Quality check
  const passedQC = await qualityCheck(deviceId);

  if (passedQC) {
    // Mark as ready for resale
    await supabase.from('devices').update({
      status: 'available',
      is_refurbished: true,
      refurbished_at: new Date(),
      retail_price_usd: device.retail_price_usd * 0.70  // 70% of original price
    }).eq('id', deviceId);
  }
}
```

---

### 6.2 Resale Strategy

**Refurbished Device Pricing**:

| Original Price | Condition | Resale Price | Discount |
|----------------|-----------|--------------|----------|
| $250 | Excellent | $175 (70%) | 30% off |
| $250 | Good | $150 (60%) | 40% off |
| $250 | Fair | $125 (50%) | 50% off |

**Marketing**:
- List as "Certified Pre-Owned" devices
- 90-day warranty
- Same financing terms as new devices
- Target Tier 1 customers (budget-conscious)

---

## 7. Implementation

### 7.1 Database Schema

```sql
CREATE TABLE device_returns (
  return_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  device_id UUID NOT NULL REFERENCES devices(id),

  return_type VARCHAR(50) NOT NULL,  -- 'voluntary', 'repossession'
  return_reason VARCHAR(100),
  customer_explanation TEXT,

  initiated_at TIMESTAMPTZ NOT NULL,
  scheduled_collection_date DATE,
  collected_at TIMESTAMPTZ,

  device_condition_at_return JSONB,
  damage_charges DECIMAL(10,2) DEFAULT 0,

  deposit_refund_amount DECIMAL(10,2) DEFAULT 0,
  outstanding_balance DECIMAL(10,2) DEFAULT 0,

  collection_method VARCHAR(50),  -- 'drop_off', 'field_agent', 'legal'
  collected_by VARCHAR(255),

  status VARCHAR(50) NOT NULL,  -- 'requested', 'scheduled', 'collected', 'processed', 'cancelled'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE repossession_orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  loan_id UUID NOT NULL REFERENCES loans(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  device_id UUID NOT NULL REFERENCES devices(id),

  status VARCHAR(50) NOT NULL,  -- 'pending_collection', 'assigned', 'collected', 'failed'
  collection_method VARCHAR(50),

  assigned_agent_id UUID REFERENCES field_agents(id),
  assigned_at TIMESTAMPTZ,

  scheduled_collection_date DATE,
  collected_at TIMESTAMPTZ,

  failure_reason TEXT,
  attempts INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loan_settlements (
  settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  loan_id UUID NOT NULL REFERENCES loans(id),
  return_id UUID REFERENCES device_returns(return_id),

  amount_paid_by_customer DECIMAL(10,2),
  principal DECIMAL(10,2),
  outstanding_balance DECIMAL(10,2),

  deposit_refund DECIMAL(10,2),
  damage_charges DECIMAL(10,2),

  net_settlement DECIMAL(10,2),  -- Can be negative (customer owes) or positive (refund)
  settlement_type VARCHAR(50),  -- 'refund', 'balance_due', 'settled'

  settled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_returns_loan ON device_returns(loan_id);
CREATE INDEX idx_returns_status ON device_returns(status);
CREATE INDEX idx_repossession_status ON repossession_orders(status);
```

---

### 7.2 API Endpoints

#### POST `/api/loans/:id/return`

**Description**: Initiate voluntary device return

**Request**:
```json
{
  "return_reason": "financial_difficulty",
  "explanation": "I lost my job and can no longer afford the payments"
}
```

**Response**:
```json
{
  "return_id": "return-123",
  "scheduled_collection_date": "2025-12-03",
  "deposit_refund_amount": 45.00,
  "outstanding_balance": 100.00,
  "collection_locations": [
    {
      "name": "Harare Main",
      "address": "123 Main St",
      "hours": "Mon-Sat 9AM-5PM"
    }
  ]
}
```

---

#### POST `/api/repossessions`

**Description**: Create repossession order (admin only)

**Request**:
```json
{
  "loan_id": "loan-456",
  "collection_method": "field_agent"
}
```

---

## Summary

**Device Return/Repossession Flow Deliverables**:
- ✅ **Voluntary Return Policy**: 14-day full refund, 90-day partial refund
- ✅ **Repossession Process**: Legal notice timeline, field agent collection
- ✅ **Collection Methods**: Drop-off (60%), field agent (40%), legal (<1%)
- ✅ **Loan Settlement**: Automated calculation of refunds/balances
- ✅ **Device Refurbishment**: Factory reset, repair, resale at 60-70% price
- ✅ **Legal Compliance**: Zimbabwe consumer protection law adherence

**Key Features**:
- 80%+ repossession success rate
- 60-70% resale value recovery
- <5% voluntary return rate
- 3-5 day processing time

**Next Steps**: Implement Device Condition Assessment (P1-T036)
