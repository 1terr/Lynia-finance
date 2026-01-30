# P1-T034: Device Handover Process

**Task ID:** P1-T034
**Section:** 1.6 Device Management Design
**Priority:** High
**Estimated Duration:** 6 hours
**Dependencies:** Device Catalog Design (P1-T032), Device Lock/Unlock Integration (P1-T033)
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Handover Locations](#handover-locations)
3. [Pre-Handover Checklist](#pre-handover-checklist)
4. [Handover Workflow](#handover-workflow)
5. [Device Setup & Activation](#device-setup--activation)
6. [Customer Education](#customer-education)
7. [Post-Handover Actions](#post-handover-actions)
8. [Implementation](#implementation)

---

## 1. Overview

The Device Handover Process is the final step in the loan disbursement workflow. It ensures customers receive their financed devices in proper working condition, with all necessary software installed, while maintaining security and compliance.

### Business Goals

1. **Customer Satisfaction**: Smooth, professional handover experience
2. **Device Security**: Ensure Lynia Device Manager app is installed and active
3. **Documentation**: Complete record of device condition and handover
4. **Fraud Prevention**: Verify customer identity before handover
5. **Customer Education**: Ensure customers understand device usage and payment obligations

### Key Metrics

- **Average Handover Time**: 15-20 minutes
- **Device Activation Success Rate**: >98%
- **App Installation Success Rate**: >95%
- **Customer Satisfaction Score**: >4.5/5
- **Disputed Handovers**: <1%

---

## 2. Handover Locations

### 2.1 Distributor Hub Model

**Phase 1 Strategy**: Partner with existing mobile phone distributors

**Location Types**:

1. **Distributor Retail Stores** (Primary - 80%)
   - Existing retail shops with trained staff
   - Urban areas (Harare, Bulawayo)
   - 10-15 partner locations

2. **Lynia Pop-Up Centers** (Secondary - 15%)
   - Temporary locations in malls/markets
   - Weekend operations
   - 2-3 locations

3. **Home Delivery** (Special Cases - 5%)
   - For high-value customers (Tier 3)
   - Rural areas without nearby distributors
   - Requires $10-20 delivery fee

---

### 2.2 Distributor Partner Requirements

**Minimum Requirements**:

1. **Physical Space**:
   - Dedicated customer service desk
   - Secure device storage area
   - Private area for document signing

2. **Staff**:
   - At least 1 trained Lynia representative
   - Customer service experience
   - Fluent in English and Shona

3. **Technology**:
   - Reliable internet connection
   - Tablet/laptop for Lynia admin portal
   - Power backup (generator/UPS)

4. **Security**:
   - CCTV cameras
   - Secure storage for devices
   - Insurance coverage

---

## 3. Pre-Handover Checklist

### 3.1 Loan Approval Requirements

**UPDATED BUSINESS RULE**: Deposit payment occurs AT the distributor location during handover. Device cannot be given to customer until deposit payment is confirmed.

**Handover Eligibility Check** (Before customer arrives):

```typescript
interface HandoverEligibility {
  loan_approved: boolean;
  kyc_verified: boolean;
  device_reserved: boolean;
  device_in_stock: boolean;
  deposit_amount_required: number;
}

async function checkHandoverReadiness(loanId: string): Promise<{
  ready: boolean;
  eligibility: HandoverEligibility;
  blockers: string[];
}> {

  const { data: loan } = await supabase
    .from('loans')
    .select('*, customers(*), devices(*)')
    .eq('id', loanId)
    .single();

  const blockers: string[] = [];

  const loanApproved = loan.status === 'approved';
  if (!loanApproved) blockers.push('LOAN_NOT_APPROVED');

  const kycVerified = loan.customers.kyc_status === 'approved';
  if (!kycVerified) blockers.push('KYC_NOT_VERIFIED');

  const deviceInStock = loan.devices?.status === 'in_stock';
  if (!deviceInStock) blockers.push('DEVICE_OUT_OF_STOCK');

  return {
    ready: blockers.length === 0,
    eligibility: {
      loan_approved: loanApproved,
      kyc_verified: kycVerified,
      device_reserved: loan.device_id !== null,
      device_in_stock: deviceInStock,
      deposit_amount_required: loan.deposit_amount_usd
    },
    blockers
  };
}
```

**During Handover - Deposit Payment Verification**:

```typescript
async function verifyDepositPayment(
  loanId: string,
  transactionReference: string,
  provider: 'ecocash' | 'onemoney' | 'innbucks' | 'onewallet'
): Promise<{
  verified: boolean;
  payment_id?: string;
  error?: string;
}> {

  // Call payment provider API to verify transaction
  const verification = await verifyPaymentWithProvider(
    provider,
    transactionReference
  );

  if (!verification.success) {
    return {
      verified: false,
      error: 'Payment verification failed. Please check transaction reference.'
    };
  }

  // Record payment in database
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      loan_id: loanId,
      customer_id: loan.customer_id,
      payment_type: 'deposit',
      amount_usd: verification.amount,
      payment_method: provider,
      transaction_id: transactionReference,
      status: 'confirmed',
      confirmed_at: new Date(),
      reconciled: true
    })
    .select()
    .single();

  if (error) {
    return {
      verified: false,
      error: 'Failed to record payment'
    };
  }

  // Update loan deposit status
  await supabase.from('loans').update({
    deposit_paid: true,
    deposit_paid_at: new Date()
  }).eq('id', loanId);

  return {
    verified: true,
    payment_id: payment.id
  };
}
```

**Distributor Dashboard Display**:
- Shows deposit amount required
- Provides payment verification form
- Displays real-time verification status
- ⚠️ "Complete Handover" button disabled until deposit verified

**Eligibility Criteria** (Before customer arrives):
- ✅ Loan approved by credit system
- ✅ KYC verification completed (ID + selfie)
- ✅ Device in stock at handover location

**Required During Handover**:
- ✅ Customer identity verified
- ✅ Device availability confirmed
- ✅ **Deposit payment verified** ← CRITICAL CHECKPOINT

---

### 3.2 Device Preparation

**Distributor prepares device before customer arrival**:

1. **Unbox Device**:
   - Remove from packaging
   - Verify device model matches loan record
   - Check for physical damage
   - Verify IMEI matches catalog

2. **Charge Device**:
   - Charge to 100%
   - Verify battery health

3. **Install Lynia Device Manager App**:
   - Download from Play Store or side-load APK
   - Pre-configure with customer details
   - Test lock/unlock functionality

4. **Prepare Documents**:
   - Print loan agreement (2 copies)
   - Print handover checklist
   - Print device condition form

---

## 4. Handover Workflow

### 4.1 Step-by-Step Process (Simplified)

**Total Time: 15-20 minutes**

```
┌──────────────────────────────────────────────────────────────────┐
│            DEVICE HANDOVER WORKFLOW (SIMPLIFIED)                  │
└──────────────────────────────────────────────────────────────────┘

STEP 1: CUSTOMER COMPLETES ONBOARDING
├─ Customer completes WhatsApp onboarding flow
├─ Loan approved by credit scoring system
└─ System takes note of pending handover

STEP 2: CUSTOMER ARRIVES AT DISTRIBUTOR (2 minutes)
├─ Customer arrives at selected distributor location
└─ Distributor opens handover screen in admin portal

STEP 3: CONFIRM DEVICE AVAILABILITY (1 minute)
├─ Distributor checks device stock
├─ Confirms requested device model is available
└─ Retrieves device from secure storage

STEP 4: VERIFY CUSTOMER IDENTITY (2 minutes)
├─ Distributor verifies customer identity
│  ├─ Check National ID
│  └─ Verify ID matches loan application record
└─ Identity verification recorded in system

STEP 5: CUSTOMER PAYS DEPOSIT ⚠️ CRITICAL (5 minutes)
├─ Distributor confirms deposit amount required
├─ Customer pays deposit via mobile money
│  ├─ EcoCash, OneMoney, Innbucks, or OneWallet
│  └─ Transaction reference number collected
├─ System verifies deposit payment (real-time check)
└─ ⚠️ HANDOVER CANNOT PROCEED WITHOUT CONFIRMED DEPOSIT

STEP 6: DISTRIBUTOR HANDS OVER DEVICE (3 minutes)
├─ Show device to customer
├─ Power on device and verify functionality
├─ Customer inspects for physical damage
│  ├─ Screen condition
│  ├─ Body/casing
│  └─ Buttons and ports
├─ Give device to customer with accessories
└─ Customer signs device condition form

STEP 7: MARK HANDOVER COMPLETE (2 minutes)
├─ Distributor marks handover complete in admin portal
├─ System updates loan status to 'active'
├─ System marks device as 'sold'
├─ First payment date calculated (30 days from handover)
└─ Confirmation sent to customer via WhatsApp

STEP 8: DISTRIBUTOR COMMISSION CALCULATED
├─ System calculates distributor commission
├─ Commission based on device value and loan amount
│  └─ Example: 5% of device retail price
├─ Commission recorded for payment processing
└─ Distributor can view commission in dashboard
```

---

### 4.2 Identity Verification

```typescript
async function verifyCustomerIdentity(
  customerId: string,
  presentedId: string
): Promise<{ verified: boolean; reason?: string }> {

  const { data: customer } = await supabase
    .from('customers')
    .select('*, kyc_submissions(*)')
    .eq('id', customerId)
    .single();

  // Verify ID number matches KYC record
  if (customer.kyc_submissions[0].id_number !== presentedId) {
    return {
      verified: false,
      reason: 'ID number does not match KYC record'
    };
  }

  // Optional: Take photo of presented ID for verification
  // Compare with KYC submission photo

  return { verified: true };
}
```

---

### 4.3 Device Condition Documentation

**Device Condition Form**:

```
┌─────────────────────────────────────────────────────┐
│         DEVICE CONDITION CHECKLIST                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Device: Samsung Galaxy A14                         │
│ IMEI: 123456789012345                              │
│ Date: November 27, 2025                            │
│                                                     │
│ PHYSICAL CONDITION:                                 │
│ ☐ Screen - No scratches or cracks                  │
│ ☐ Body - No dents or damage                        │
│ ☐ Buttons - All functional                         │
│ ☐ Ports - Charging and headphone ports intact      │
│ ☐ Camera - Front and rear cameras working          │
│                                                     │
│ FUNCTIONALITY:                                      │
│ ☐ Powers on successfully                           │
│ ☐ Touch screen responsive                          │
│ ☐ Wi-Fi connects                                   │
│ ☐ Cellular network connects                        │
│ ☐ Calls can be made                                │
│                                                     │
│ ACCESSORIES INCLUDED:                               │
│ ☐ Charger                                          │
│ ☐ USB cable                                        │
│ ☐ Protective case (if applicable)                  │
│ ☐ Screen protector (if applicable)                 │
│                                                     │
│ CUSTOMER CONFIRMATION:                              │
│ I confirm that I have inspected the device and     │
│ it is in good working condition.                   │
│                                                     │
│ Customer Signature: ___________________________    │
│                                                     │
│ Distributor Staff: _____________________________   │
│ Date: __________________________________________   │
└─────────────────────────────────────────────────────┘
```

---

## 5. Device Setup & Activation

### 5.1 Lynia Device Manager App Installation

**App Installation Flow**:

```typescript
// Admin portal - Device Handover Screen

interface DeviceSetup {
  device_id: string;
  customer_id: string;
  loan_id: string;
  imei: string;
  app_installed: boolean;
  app_configured: boolean;
  lock_test_passed: boolean;
}

async function setupDeviceApp(
  deviceId: string,
  customerId: string,
  loanId: string,
  imei: string
): Promise<DeviceSetup> {

  // Generate app configuration
  const appConfig = {
    device_id: deviceId,
    customer_id: customerId,
    loan_id: loanId,
    imei: imei,
    api_url: 'https://api.lynia.finance',
    auth_token: await generateDeviceAuthToken(deviceId),
    sync_interval_minutes: 60
  };

  // Generate QR code for app download
  const appDownloadUrl = 'https://app.lynia.finance/download';
  const qrCode = await generateQRCode(appDownloadUrl);

  // Return setup status
  return {
    device_id: deviceId,
    customer_id: customerId,
    loan_id: loanId,
    imei: imei,
    app_installed: false,  // Set to true after staff confirms
    app_configured: false,
    lock_test_passed: false
  };
}

// After app installation, configure it
async function configureDeviceApp(
  deviceId: string,
  appConfig: any
): Promise<void> {

  // Send configuration to device via API
  await fetch(`https://api.lynia.finance/api/devices/${deviceId}/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appConfig)
  });

  // Test lock functionality
  const lockTestResult = await testDeviceLock(deviceId);

  if (!lockTestResult.success) {
    throw new Error('Device lock test failed');
  }
}
```

---

### 5.2 Lock/Unlock Test

**Required before handover**:

```typescript
async function testDeviceLock(deviceId: string): Promise<{ success: boolean; message: string }> {

  try {
    // Step 1: Send lock command
    await lockDevice(deviceId, 'Test lock');

    // Wait 10 seconds
    await sleep(10000);

    // Step 2: Verify lock applied
    const lockStatus = await getDeviceLockStatus(deviceId);
    if (lockStatus !== 'locked') {
      return {
        success: false,
        message: 'Device failed to lock'
      };
    }

    // Step 3: Send unlock command
    await unlockDevice(deviceId, 'Test unlock');

    // Wait 10 seconds
    await sleep(10000);

    // Step 4: Verify unlock applied
    const unlockStatus = await getDeviceLockStatus(deviceId);
    if (unlockStatus !== 'unlocked') {
      return {
        success: false,
        message: 'Device failed to unlock'
      };
    }

    return {
      success: true,
      message: 'Lock/unlock test passed'
    };

  } catch (error) {
    return {
      success: false,
      message: `Test failed: ${error.message}`
    };
  }
}
```

---

## 6. Customer Education

### 6.1 Payment Education

**Explain to customer**:

1. **Payment Amount & Due Date**:
   - "Your monthly payment is $45, due on the 27th of each month"
   - "First payment due: December 27, 2025"

2. **Payment Methods**:
   - "You can pay via EcoCash, Omari, Innbucks, or OneWallet"
   - "You will receive payment instructions via WhatsApp 3 days before due date"

3. **Payment Reminders**:
   - "We'll send you 3 reminders: 3 days before, 1 day before, and on the due date"

4. **How to Pay**:
   - "Reply 'PAY' to our WhatsApp messages to get payment instructions"
   - Or: "Dial *123# for EcoCash and follow prompts"

---

### 6.2 Device Lock Education

**Explain lock policy**:

```
"If you miss a payment:
  Day 1-7: We'll send you reminder messages
  Day 8: You'll receive a warning that your device may be locked
  Day 10: Your device will be temporarily locked

To unlock:
  - Make your overdue payment
  - Your device will unlock within 1 hour
  - Emergency calls are always available

To avoid lock:
  - Pay on or before your due date
  - Contact us if you're having trouble paying
"
```

---

### 6.3 Support Contact Information

**Give customer support card**:

```
┌─────────────────────────────────────────┐
│        LYNIA FINANCE SUPPORT            │
├─────────────────────────────────────────┤
│                                         │
│ WhatsApp: +263 771 234 567              │
│ (24/7 Support)                          │
│                                         │
│ Email: support@lynia.finance            │
│                                         │
│ Office Hours:                           │
│ Mon-Fri: 8AM - 6PM                      │
│ Sat: 9AM - 1PM                          │
│                                         │
│ Need help?                              │
│ Reply "HELP" to our WhatsApp            │
└─────────────────────────────────────────┘
```

---

## 7. Post-Handover Actions

### 7.1 Update Loan Status & Calculate Commission

```typescript
async function completeHandover(
  loanId: string,
  deviceId: string,
  distributorId: string,
  handoverData: HandoverRecord
): Promise<void> {

  // Update loan status to 'active'
  await supabase.from('loans').update({
    status: 'active',  // Changed from 'disbursed' to 'active'
    disbursed_at: new Date(),
    next_payment_date: calculateFirstPaymentDate(new Date(), 30)  // 30 days
  }).eq('id', loanId);

  // Update device status
  await supabase.from('devices').update({
    status: 'assigned',
    customer_id: handoverData.customer_id,
    loan_id: loanId,
    assigned_at: new Date()
  }).eq('id', deviceId);

  // Update agent inventory record
  await supabase.from('agent_inventory').update({
    status: 'sold',
    sold_date: new Date(),
    sold_to_customer_id: handoverData.customer_id,
    sold_loan_id: loanId
  }).eq('device_id', deviceId);

  // Calculate and record distributor commission
  const commission = await calculateDistributorCommission(
    loanId,
    deviceId,
    distributorId
  );

  await supabase.from('distributor_commissions').insert({
    distributor_id: distributorId,
    loan_id: loanId,
    device_id: deviceId,
    commission_amount_usd: commission.amount,
    commission_percentage: commission.percentage,
    device_retail_price_usd: commission.device_price,
    calculation_date: new Date(),
    payment_status: 'pending',
    notes: `Commission for device handover - ${commission.device_model}`
  });

  // Update distributor totals
  await supabase.rpc('increment_distributor_stats', {
    dist_id: distributorId,
    devices_sold: 1,
    revenue: commission.amount
  });

  // Send confirmation to customer
  await sendHandoverConfirmation(handoverData.customer_id, loanId, deviceId);
}

function calculateFirstPaymentDate(handoverDate: Date, daysUntilFirstPayment: number): Date {
  return new Date(handoverDate.getTime() + daysUntilFirstPayment * 24 * 60 * 60 * 1000);
}

async function calculateDistributorCommission(
  loanId: string,
  deviceId: string,
  distributorId: string
): Promise<{
  amount: number;
  percentage: number;
  device_price: number;
  device_model: string;
}> {

  // Get device details
  const { data: device } = await supabase
    .from('devices')
    .select('retail_price_usd, model')
    .eq('id', deviceId)
    .single();

  // Commission rate: 5% of device retail price
  const COMMISSION_RATE = 0.05;
  const commissionAmount = device.retail_price_usd * COMMISSION_RATE;

  return {
    amount: commissionAmount,
    percentage: COMMISSION_RATE * 100,
    device_price: device.retail_price_usd,
    device_model: device.model
  };
}
```

---

### 7.2 Confirmation Notifications

**WhatsApp Confirmation**:

```
🎉 *Device Handover Complete!*

You've received your Samsung Galaxy A14

*Loan Details*:
Amount Financed: $200.00
Monthly Payment: $45.00
First Payment Due: December 27, 2025

*Payment Instructions*:
You'll receive payment reminders 3 days before your due date.

*Need Help?*
Reply HELP or contact +263 771 234 567

Welcome to Lynia Finance! 💚

[View Loan Details] [Payment Schedule] [Main Menu]
```

---

### 7.3 Document Upload

```typescript
async function uploadHandoverDocuments(
  loanId: string,
  documents: {
    loan_agreement: File;
    device_condition_form: File;
    customer_signature: File;
  }
): Promise<void> {

  // Upload to S3
  const loanAgreementUrl = await uploadToS3(
    documents.loan_agreement,
    `handovers/${loanId}/loan-agreement.pdf`
  );

  const conditionFormUrl = await uploadToS3(
    documents.device_condition_form,
    `handovers/${loanId}/condition-form.pdf`
  );

  const signatureUrl = await uploadToS3(
    documents.customer_signature,
    `handovers/${loanId}/signature.png`
  );

  // Update loan record
  await supabase.from('loans').update({
    loan_agreement_url: loanAgreementUrl,
    device_condition_form_url: conditionFormUrl,
    customer_signature_url: signatureUrl
  }).eq('id', loanId);
}
```

---

## 8. Implementation

### 8.1 Database Schema

```sql
CREATE TABLE device_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  loan_id UUID NOT NULL REFERENCES loans(id),
  device_id UUID NOT NULL REFERENCES devices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  handover_location VARCHAR(255) NOT NULL,  -- Distributor name/address
  handed_over_by VARCHAR(255) NOT NULL,     -- Staff name
  handed_over_at TIMESTAMPTZ NOT NULL,

  device_condition JSONB NOT NULL,  -- From condition checklist
  app_installed BOOLEAN NOT NULL,
  app_configured BOOLEAN NOT NULL,
  lock_test_passed BOOLEAN NOT NULL,

  customer_signature_url TEXT,
  loan_agreement_url TEXT,
  device_condition_form_url TEXT,
  documents_signed BOOLEAN DEFAULT FALSE,

  customer_satisfaction_rating INT,  -- 1-5 stars
  customer_feedback TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handovers_loan ON device_handovers(loan_id);
CREATE INDEX idx_handovers_customer ON device_handovers(customer_id);
CREATE INDEX idx_handovers_date ON device_handovers(handed_over_at DESC);
```

---

### 8.2 Admin Portal - Handover Screen

**UI Workflow**:

```
┌──────────────────────────────────────────────────────────────┐
│              DEVICE HANDOVER - ADMIN PORTAL                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Loan ID: LOAN-123456                                        │
│ Customer: John Doe (+263 771 234 567)                       │
│ Device: Samsung Galaxy A14 (IMEI: 123456789012345)          │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ✅ Step 1: Verify Customer Identity                  │    │
│ │    National ID: 63-123456A47                         │    │
│ │    [✓] ID matches KYC record                         │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⬜ Step 2: Device Inspection                         │    │
│ │    [Start Inspection]                                │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⬜ Step 3: Install & Configure App                   │    │
│ │    [Download App] [Configure] [Test Lock]           │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⬜ Step 4: Sign Documents                            │    │
│ │    [Upload Loan Agreement] [Upload Signature]       │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⬜ Step 5: Complete Handover                         │    │
│ │    [Complete & Disburse Loan]                        │    │
│ └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Summary

**Device Handover Process Deliverables** (UPDATED - Simplified):
- ✅ **Handover Workflow**: 8-step simplified process (15-20 minutes)
- ✅ **Identity Verification**: National ID check at handover location
- ✅ **Deposit Payment at Handover**: Real-time payment verification (CRITICAL)
- ✅ **Device Handover**: Physical inspection and condition documentation
- ✅ **Distributor Commission**: Automatic calculation (5% of retail price)
- ✅ **Loan Activation**: Status changes from 'approved' to 'active'
- ✅ **Confirmation Notifications**: WhatsApp confirmation to customer

**Key Features**:
- 15-20 minute average handover time
- Deposit payment occurs AT handover location
- Real-time payment verification via mobile money
- Automatic distributor commission calculation
- Loan status automatically updated to 'active'
- Complete audit trail of handover process

**Key Changes from Previous Version**:
- ❌ Removed: Appointment scheduling (unnecessary)
- ❌ Removed: Pre-payment requirement (deposit now at handover)
- ❌ Removed: Device app installation (simplified for Phase 2)
- ✅ Added: Real-time deposit verification at handover
- ✅ Added: Distributor commission calculation
- ✅ Simplified: 8 clear steps in logical order

**Next Steps**: Implement Device Return/Repossession Flow (P1-T035)
