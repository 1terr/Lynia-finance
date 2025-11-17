# T021: Document Loan Disbursement and Device Handover Process

## Research Context

**Task**: Document loan disbursement and device handover process
**Date**: 2025-01-13
**Status**: Complete

This research documents the complete workflow from deposit confirmation to customer receiving their financed device, including device procurement, inventory management, customer verification, and handover procedures.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Disbursement Workflow Overview](#disbursement-workflow-overview)
3. [Device Procurement Process](#device-procurement-process)
4. [Inventory Management](#inventory-management)
5. [Customer Verification (KYC)](#customer-verification-kyc)
6. [Device Preparation](#device-preparation)
7. [Collection Notification Flow](#collection-notification-flow)
8. [Device Handover Procedure](#device-handover-procedure)
9. [Post-Handover Follow-up](#post-handover-follow-up)
10. [Exception Handling](#exception-handling)
11. [Implementation Guide](#implementation-guide)

---

## Executive Summary

### Disbursement Timeline

```
Deposit Confirmed → Device Ready → Customer Notified → Handover
     (Day 0)          (1-2 days)        (Same day)      (Day 2-3)
```

**Total Timeline**: 1-3 business days from deposit to handover

### Key Stages

1. **Deposit Confirmation** (Immediate)
   - Payment webhook received and verified
   - Loan status updated in Fineract
   - Customer notified via WhatsApp

2. **Device Procurement** (0-24 hours)
   - Check inventory availability
   - If in stock: Reserve device
   - If out of stock: Order from supplier

3. **Device Preparation** (2-4 hours)
   - Quality check and testing
   - Factory reset
   - IMEI registration
   - Packaging with accessories

4. **Customer Notification** (Immediate)
   - WhatsApp notification: "Device ready for collection"
   - Collection instructions
   - Required documents

5. **KYC Verification** (At handover)
   - ID verification
   - Photo capture
   - Signature on loan agreement
   - Biometric (optional)

6. **Device Handover** (15-30 minutes)
   - Verify customer identity
   - Sign handover documents
   - Demonstrate device features
   - Provide receipts and warranty

7. **Post-Handover** (Ongoing)
   - Activate loan repayment schedule
   - Send payment reminders
   - Customer support

### Critical Success Factors

✅ **Speed**: Device ready within 24 hours
✅ **Communication**: Clear status updates at each stage
✅ **Verification**: Proper KYC to prevent fraud
✅ **Documentation**: Complete audit trail
✅ **Customer Experience**: Smooth, professional handover

---

## Disbursement Workflow Overview

### High-Level Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  LOAN DISBURSEMENT & DEVICE HANDOVER WORKFLOW                    │
└─────────────────────────────────────────────────────────────────┘

1. DEPOSIT CONFIRMATION
   │
   ├─ Webhook: Payment successful ($50 deposit)
   ├─ Update Fineract loan status: DEPOSIT_PAID
   ├─ Send WhatsApp: "✅ Payment received! Device will be ready soon"
   │
   ▼

2. INVENTORY CHECK
   │
   ├─ Check: Is Samsung A14 in stock?
   │  │
   │  ├─ YES → Reserve device (move to RESERVED status)
   │  │         Send to preparation queue
   │  │
   │  └─ NO → Trigger procurement workflow
   │           Notify customer: "Your device will be ready in 2-3 days"
   │
   ▼

3. DEVICE PROCUREMENT (if needed)
   │
   ├─ Create purchase order
   ├─ Contact supplier
   ├─ Order device (24-48 hour delivery)
   ├─ Receive and inspect
   ├─ Add to inventory
   │
   ▼

4. DEVICE PREPARATION
   │
   ├─ Quality check (screen, battery, buttons, camera)
   ├─ Factory reset
   ├─ Record IMEI number
   ├─ Package with accessories (charger, earphones, case)
   ├─ Update inventory status: READY_FOR_COLLECTION
   │
   ▼

5. CUSTOMER NOTIFICATION
   │
   ├─ Send WhatsApp: "📱 Your Samsung A14 is ready for collection!"
   ├─ Include: Collection address, hours, required documents
   ├─ Update Fineract: Loan status → READY_FOR_HANDOVER
   │
   ▼

6. CUSTOMER ARRIVAL & KYC
   │
   ├─ Customer arrives at office
   ├─ Verify identity (National ID)
   ├─ Photo capture (KYC compliance)
   ├─ Review loan terms
   ├─ Sign loan agreement
   │
   ▼

7. DEVICE HANDOVER
   │
   ├─ Hand over device to customer
   ├─ Customer verifies device condition
   ├─ Sign handover receipt
   ├─ Demonstrate device features
   ├─ Provide: Warranty card, receipt, user manual
   ├─ Update inventory: DISBURSED
   ├─ Update Fineract: Loan status → ACTIVE
   │
   ▼

8. POST-HANDOVER
   │
   ├─ Send WhatsApp: "Welcome to Lynia Finance! First payment due: 13 Feb"
   ├─ Activate repayment schedule in Fineract
   ├─ Schedule payment reminders
   ├─ Customer support available
   │
   ▼

9. ONGOING LOAN MANAGEMENT
   │
   ├─ Monthly payment reminders
   ├─ Payment processing
   ├─ Default management (if needed)
   └─ Loan closure upon final payment
```

### State Machine

```javascript
const LoanStates = {
  // Pre-disbursement
  APPLICATION_SUBMITTED: 'application_submitted',
  APPROVED: 'approved',
  DEPOSIT_PENDING: 'deposit_pending',
  DEPOSIT_PAID: 'deposit_paid',

  // Disbursement
  DEVICE_PROCUREMENT: 'device_procurement',
  DEVICE_READY: 'device_ready',
  READY_FOR_HANDOVER: 'ready_for_handover',

  // Active
  ACTIVE: 'active',

  // Completed/Closed
  PAID_OFF: 'paid_off',
  DEFAULTED: 'defaulted',
  CANCELLED: 'cancelled'
};

const StateTransitions = {
  deposit_paid: ['device_procurement', 'device_ready'], // Depends on inventory
  device_procurement: ['device_ready'],
  device_ready: ['ready_for_handover'],
  ready_for_handover: ['active', 'cancelled'],
  active: ['paid_off', 'defaulted']
};
```

---

## Device Procurement Process

### Inventory-First Approach

**Decision Tree**:
```
Deposit Confirmed
       │
       ▼
  Check Inventory
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
   IN STOCK                             OUT OF STOCK
       │                                     │
       ├─ Reserve device                     ├─ Check supplier availability
       ├─ Move to preparation                ├─ Create purchase order
       ├─ Timeline: 2-4 hours                ├─ Order device
       └─ Notify: "Ready today"              ├─ Timeline: 24-48 hours
                                             └─ Notify: "Ready in 2-3 days"
```

### Supplier Integration

**Primary Suppliers** (Zimbabwe):
- **Fone World** (Harare) - Smartphones, tablets
- **TechZim** (Harare) - Electronics
- **Chi Phones** (Various locations) - Mobile devices
- **Local distributors** - Samsung, Xiaomi, Tecno, Infinix

**Procurement Workflow**:
```javascript
async function procureDevice(loan) {
  const device = loan.deviceModel; // "Samsung A14"

  // 1. Check inventory
  const inStock = await checkInventory(device);

  if (inStock) {
    // Reserve from stock
    await reserveDevice(loan.id, device);
    await updateLoanStatus(loan.id, 'DEVICE_READY');
    await sendWhatsApp(loan.customerPhone, 'device_ready_same_day');
    return { timeline: '2-4 hours', source: 'inventory' };
  }

  // 2. Check with suppliers
  const supplier = await findAvailableSupplier(device);

  if (!supplier) {
    await alertOps({
      severity: 'high',
      message: `Device ${device} not available from any supplier`,
      loanId: loan.id
    });
    await sendWhatsApp(loan.customerPhone, 'device_procurement_delay');
    return { timeline: '3-5 days', source: 'special_order' };
  }

  // 3. Create purchase order
  const po = await createPurchaseOrder({
    supplier: supplier.id,
    device: device,
    quantity: 1,
    loanId: loan.id,
    priority: 'urgent' // Customer waiting
  });

  // 4. Place order with supplier
  await placeOrder(supplier, po);

  // 5. Update loan and notify customer
  await updateLoanStatus(loan.id, 'DEVICE_PROCUREMENT');
  await sendWhatsApp(loan.customerPhone, 'device_procurement_24_48h', {
    "1": device,
    "2": "2-3 days"
  });

  return { timeline: '24-48 hours', source: 'supplier', po: po.id };
}
```

### Purchase Order System

**PO Template**:
```javascript
const purchaseOrder = {
  id: 'PO-2025-001',
  date: new Date(),
  supplier: {
    id: 'SUP-001',
    name: 'Fone World',
    contact: '+263 4 123456',
    email: 'orders@foneworld.co.zw'
  },
  items: [
    {
      sku: 'SAM-A14-BLK-128GB',
      description: 'Samsung Galaxy A14 128GB Black',
      quantity: 1,
      unitPrice: 150.00,
      total: 150.00
    }
  ],
  subtotal: 150.00,
  tax: 0.00,
  total: 150.00,
  deliveryAddress: 'Lynia Finance Office, 123 Main St, Harare',
  urgency: 'URGENT',
  expectedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  linkedLoanId: 'LOAN-12345',
  status: 'SENT'
};
```

---

## Inventory Management

### Inventory Schema

```javascript
const inventorySchema = {
  id: 'INV-001',
  sku: 'SAM-A14-BLK-128GB',
  deviceModel: 'Samsung Galaxy A14',
  brand: 'Samsung',
  color: 'Black',
  storage: '128GB',
  imei: '352099051234567', // Unique identifier

  // Status tracking
  status: 'AVAILABLE', // AVAILABLE, RESERVED, READY, DISBURSED, RETURNED

  // Procurement details
  supplier: 'Fone World',
  purchaseDate: new Date('2025-01-10'),
  purchasePrice: 150.00,

  // Reservation details
  reservedFor: null, // Loan ID when reserved
  reservedAt: null,

  // Quality check
  qualityChecked: false,
  qualityCheckDate: null,
  qualityCheckNotes: '',

  // Handover details
  disbursedTo: null, // Customer ID
  disbursedAt: null,
  handoverOfficer: null,

  // Device details
  serialNumber: 'R58N123ABC',
  warrantyExpiry: new Date('2026-01-10'),

  // Condition
  condition: 'NEW', // NEW, REFURBISHED, GOOD, FAIR

  // Location
  warehouse: 'MAIN', // MAIN, STORE_A, STORE_B
  shelf: 'A-12',

  createdAt: new Date(),
  updatedAt: new Date()
};
```

### Inventory Status Flow

```
AVAILABLE
   │
   ├─ Reserve for customer
   │
   ▼
RESERVED
   │
   ├─ Quality check passed
   ├─ Package prepared
   │
   ▼
READY_FOR_COLLECTION
   │
   ├─ Customer collects device
   ├─ Sign handover documents
   │
   ▼
DISBURSED
   │
   ├─ (If customer returns within 7 days)
   │
   ▼
RETURNED → (Quality check) → AVAILABLE or DAMAGED
```

### Stock Management Rules

**Minimum Stock Levels** (Reorder Points):
```javascript
const stockRules = {
  'Samsung A14': {
    minStock: 5,
    reorderQuantity: 10,
    leadTime: '2-3 days'
  },
  'Xiaomi Redmi Note 12': {
    minStock: 3,
    reorderQuantity: 8,
    leadTime: '2-3 days'
  },
  'Tecno Spark 10': {
    minStock: 4,
    reorderQuantity: 10,
    leadTime: '1-2 days'
  }
};

// Automated reorder trigger
async function checkStockLevels() {
  for (const [device, rules] of Object.entries(stockRules)) {
    const currentStock = await getAvailableStock(device);

    if (currentStock <= rules.minStock) {
      await createPurchaseOrder({
        device: device,
        quantity: rules.reorderQuantity,
        priority: 'normal',
        reason: 'AUTO_REORDER'
      });

      await alertOps({
        severity: 'medium',
        message: `Stock low for ${device}. Auto-reorder triggered for ${rules.reorderQuantity} units.`,
        currentStock: currentStock,
        minStock: rules.minStock
      });
    }
  }
}

// Run daily at 9 AM
cron.schedule('0 9 * * *', checkStockLevels);
```

### Inventory Tracking

**Daily Stock Report**:
```javascript
async function generateStockReport() {
  const report = {
    date: new Date(),
    summary: {
      totalDevices: 0,
      available: 0,
      reserved: 0,
      ready: 0,
      disbursed: 0
    },
    byModel: [],
    lowStock: [],
    pendingOrders: []
  };

  // Get all inventory items
  const inventory = await db.inventory.find();

  // Calculate summary
  report.summary.totalDevices = inventory.length;
  report.summary.available = inventory.filter(i => i.status === 'AVAILABLE').length;
  report.summary.reserved = inventory.filter(i => i.status === 'RESERVED').length;
  report.summary.ready = inventory.filter(i => i.status === 'READY_FOR_COLLECTION').length;
  report.summary.disbursed = inventory.filter(i => i.status === 'DISBURSED').length;

  // Group by model
  const byModel = {};
  for (const item of inventory) {
    if (!byModel[item.deviceModel]) {
      byModel[item.deviceModel] = { available: 0, reserved: 0, disbursed: 0 };
    }
    byModel[item.deviceModel][item.status.toLowerCase()]++;
  }
  report.byModel = Object.entries(byModel).map(([model, counts]) => ({
    model,
    ...counts
  }));

  // Check for low stock
  for (const [device, rules] of Object.entries(stockRules)) {
    const available = await getAvailableStock(device);
    if (available <= rules.minStock) {
      report.lowStock.push({ device, available, minStock: rules.minStock });
    }
  }

  // Pending purchase orders
  report.pendingOrders = await db.purchaseOrders.find({
    status: { $in: ['SENT', 'CONFIRMED'] }
  });

  return report;
}
```

---

## Customer Verification (KYC)

### KYC Requirements

**Required Documents**:
```
1. National ID (Zimbabwean)
   - Valid, not expired
   - Photo clearly visible
   - Name matches application

2. Proof of Address (if not on ID)
   - Utility bill (< 3 months old)
   - Bank statement
   - Tenancy agreement

3. Photo (captured at handover)
   - Customer holding ID
   - Clear face visible

4. Biometric (Optional, future enhancement)
   - Fingerprint scan
   - Facial recognition
```

### KYC Verification Process

**At Device Handover**:
```javascript
async function performKYC(loan, customer) {
  const kycRecord = {
    loanId: loan.id,
    customerId: customer.id,
    verifiedBy: 'STAFF-001', // Staff member ID
    verifiedAt: new Date(),

    // Document verification
    nationalId: {
      number: customer.idNumber,
      photo: null, // Will be captured
      verified: false,
      notes: ''
    },

    // Photo verification
    customerPhoto: {
      captured: false,
      photoUrl: null,
      matchesId: null
    },

    // Address verification
    addressVerified: false,
    addressDocument: null,

    // Signature
    signatureCaptured: false,
    signatureUrl: null,

    status: 'IN_PROGRESS'
  };

  // 1. Verify National ID
  console.log('1. Verify National ID');
  const idVerified = await verifyNationalID(customer.idNumber);
  kycRecord.nationalId.verified = idVerified;

  if (!idVerified) {
    kycRecord.status = 'FAILED';
    kycRecord.failureReason = 'Invalid or expired National ID';
    return kycRecord;
  }

  // 2. Capture customer photo
  console.log('2. Capture customer photo with ID');
  // Staff uses tablet/phone to take photo
  const photoUrl = await captureCustomerPhoto(customer.id);
  kycRecord.customerPhoto.captured = true;
  kycRecord.customerPhoto.photoUrl = photoUrl;

  // 3. Verify address (if required)
  console.log('3. Verify address');
  const addressDoc = await verifyAddress(customer.address);
  kycRecord.addressVerified = addressDoc.verified;
  kycRecord.addressDocument = addressDoc.url;

  // 4. Capture signature on loan agreement
  console.log('4. Capture signature');
  const signatureUrl = await captureSignature(customer.id, loan.id);
  kycRecord.signatureCaptured = true;
  kycRecord.signatureUrl = signatureUrl;

  // 5. Final verification
  kycRecord.status = 'COMPLETED';

  // 6. Save KYC record
  await db.kycRecords.insertOne(kycRecord);

  return kycRecord;
}
```

### Digital KYC Capture

**Tablet/Mobile App for Staff**:
```javascript
// Staff app UI flow
const kycCaptureFlow = {
  steps: [
    {
      step: 1,
      title: 'Scan National ID',
      instruction: 'Place ID under camera',
      action: 'scanID',
      output: { idNumber: '', idPhoto: '' }
    },
    {
      step: 2,
      title: 'Verify Customer Identity',
      instruction: 'Compare ID photo with customer',
      action: 'visualVerification',
      output: { match: true/false, notes: '' }
    },
    {
      step: 3,
      title: 'Capture Customer Photo',
      instruction: 'Take photo of customer holding ID',
      action: 'capturePhoto',
      output: { photoUrl: '' }
    },
    {
      step: 4,
      title: 'Review Loan Terms',
      instruction: 'Show customer loan agreement on screen',
      action: 'reviewTerms',
      output: { acknowledged: true }
    },
    {
      step: 5,
      title: 'Capture Signature',
      instruction: 'Customer signs on screen',
      action: 'captureSignature',
      output: { signatureUrl: '' }
    },
    {
      step: 6,
      title: 'KYC Complete',
      instruction: 'Proceed to device handover',
      action: 'complete',
      output: { kycId: '' }
    }
  ]
};
```

---

## Device Preparation

### Quality Check Checklist

```javascript
const qualityCheckList = {
  deviceModel: 'Samsung A14',
  imei: '352099051234567',
  checkDate: new Date(),
  checkPerformedBy: 'STAFF-002',

  checks: [
    {
      category: 'Physical Condition',
      items: [
        { check: 'Screen: No cracks or scratches', passed: true },
        { check: 'Body: No dents or damage', passed: true },
        { check: 'Buttons: All functional', passed: true },
        { check: 'Ports: Clean and functional', passed: true },
        { check: 'Camera lens: Clean, no scratches', passed: true }
      ]
    },
    {
      category: 'Functionality',
      items: [
        { check: 'Powers on successfully', passed: true },
        { check: 'Touchscreen responsive', passed: true },
        { check: 'All buttons work', passed: true },
        { check: 'Front camera works', passed: true },
        { check: 'Rear camera works', passed: true },
        { check: 'Speaker works', passed: true },
        { check: 'Microphone works', passed: true },
        { check: 'Charging port works', passed: true },
        { check: 'Headphone jack works (if applicable)', passed: true },
        { check: 'WiFi connects', passed: true },
        { check: 'Bluetooth connects', passed: true }
      ]
    },
    {
      category: 'Software',
      items: [
        { check: 'Factory reset performed', passed: true },
        { check: 'Latest software updates installed', passed: true },
        { check: 'No activation locks', passed: true },
        { check: 'Device not reported stolen (IMEI check)', passed: true }
      ]
    },
    {
      category: 'Accessories',
      items: [
        { check: 'Charger included', passed: true },
        { check: 'USB cable included', passed: true },
        { check: 'Earphones included', passed: true },
        { check: 'Protective case included', passed: true },
        { check: 'User manual included', passed: true },
        { check: 'Warranty card included', passed: true },
        { check: 'Original box (if available)', passed: false }
      ]
    }
  ],

  overallStatus: 'PASSED', // PASSED, FAILED, CONDITIONAL
  notes: 'Device in excellent condition, ready for handover',

  imeiRegistered: true, // Registered with POTRAZ (Zimbabwe)
  warrantyActive: true,
  warrantyExpiry: new Date('2026-01-10')
};
```

### IMEI Registration

**Zimbabwe Requirement**: All devices must be registered with POTRAZ (Postal and Telecommunications Regulatory Authority of Zimbabwe).

```javascript
async function registerIMEI(device) {
  // In Zimbabwe, IMEI registration is typically done by:
  // 1. Network operators (when SIM is inserted)
  // 2. POTRAZ directly for bulk registrations

  const registration = {
    imei: device.imei,
    deviceModel: device.model,
    brand: device.brand,
    registeredBy: 'Lynia Finance',
    registrationDate: new Date(),
    status: 'REGISTERED'
  };

  // Record in database
  await db.imeiRegistrations.insertOne(registration);

  // For bulk registration with POTRAZ:
  // Submit IMEI list via POTRAZ portal or API (when available)

  return registration;
}
```

---

## Collection Notification Flow

### Ready for Collection Message

**WhatsApp Template**: `device_ready_collection`

```
📱 Your {{1}} is Ready for Collection!

Great news! Your device has been prepared and
is ready for you to collect.

📍 Collection Details:
━━━━━━━━━━━━━━━━━━━━
Location: {{2}}
Hours: {{3}}
Contact: {{4}}

📋 Please Bring:
• Your National ID
• This WhatsApp confirmation
• Ready to sign loan agreement

⏱️ Collection Window:
Valid until: {{5}}

Reply CONFIRM to confirm you'll collect today
Reply RESCHEDULE if you need a different time

Reference: {{6}}

We're excited to hand over your new device! 🎉
```

**Variables**:
```javascript
{
  "1": "Samsung Galaxy A14",
  "2": "123 Main Street, Harare (Next to OK Supermarket)",
  "3": "Monday-Friday 9AM-5PM, Saturday 9AM-1PM",
  "4": "+263 771 234 567",
  "5": "17 Jan 2025, 5:00 PM",
  "6": "LOAN-INV-12345"
}
```

### Collection Confirmation

**Customer Reply Handling**:
```javascript
app.post('/webhooks/whatsapp/incoming', async (req, res) => {
  const message = req.body.entry[0].changes[0].value.messages[0];
  const customerPhone = message.from;
  const text = message.text.body.toUpperCase();

  // Find loan by phone number
  const loan = await db.loans.findOne({
    customerPhone: customerPhone,
    status: 'READY_FOR_HANDOVER'
  });

  if (!loan) {
    return res.status(200).send('OK');
  }

  if (text.includes('CONFIRM')) {
    // Customer confirms collection
    await db.loans.updateOne(
      { _id: loan._id },
      {
        $set: {
          collectionConfirmed: true,
          collectionConfirmedAt: new Date()
        }
      }
    );

    await sendWhatsApp(customerPhone, {
      text: `✅ Collection Confirmed\n\nWe're expecting you! See you soon.\n\nAddress: 123 Main Street, Harare\n\nRemember to bring your National ID.\n\nReference: ${loan.invoiceNumber}`
    });

  } else if (text.includes('RESCHEDULE')) {
    // Customer wants to reschedule
    await sendWhatsApp(customerPhone, {
      text: `📅 Reschedule Collection\n\nNo problem! When would you like to collect your device?\n\nReply with your preferred date and time, or call us at +263 771 234 567.\n\nReference: ${loan.invoiceNumber}`
    });

  } else if (text.includes('HELP')) {
    // Customer needs help
    await sendWhatsApp(customerPhone, {
      text: `💬 How can we help?\n\nYou can:\n• Call us: +263 771 234 567\n• Visit: 123 Main Street, Harare\n• Hours: Mon-Fri 9AM-5PM, Sat 9AM-1PM\n\nWhat do you need assistance with?`
    });
  }

  res.status(200).send('OK');
});
```

### Reminder Schedule

**If customer doesn't collect within 24 hours**:

```javascript
// Daily job to check for pending collections
cron.schedule('0 10 * * *', async () => { // 10 AM daily
  const pendingCollections = await db.loans.find({
    status: 'READY_FOR_HANDOVER',
    deviceReadyDate: {
      $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    },
    collectionConfirmed: false
  });

  for (const loan of pendingCollections) {
    const daysSince = Math.floor(
      (Date.now() - loan.deviceReadyDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSince === 1) {
      // Day 1 reminder
      await sendWhatsApp(loan.customerPhone, 'collection_reminder_day1', {
        "1": loan.deviceModel,
        "2": loan.invoiceNumber
      });

    } else if (daysSince === 3) {
      // Day 3 reminder (urgent)
      await sendWhatsApp(loan.customerPhone, 'collection_reminder_day3', {
        "1": loan.deviceModel,
        "2": loan.expiryDate,
        "3": loan.invoiceNumber
      });

    } else if (daysSince === 7) {
      // Day 7: Final reminder before cancellation
      await sendWhatsApp(loan.customerPhone, 'collection_final_warning', {
        "1": loan.deviceModel,
        "2": "2 days",
        "3": loan.invoiceNumber
      });

      // Alert operations team
      await alertOps({
        severity: 'medium',
        message: `Loan ${loan.id} not collected for 7 days, auto-cancel in 2 days`,
        loanId: loan.id,
        customer: loan.customerName
      });

    } else if (daysSince >= 10) {
      // Auto-cancel after 10 days
      await cancelLoan(loan.id, 'CUSTOMER_NO_SHOW');

      await sendWhatsApp(loan.customerPhone, 'loan_auto_cancelled', {
        "1": loan.deviceModel,
        "2": loan.depositAmount,
        "3": loan.invoiceNumber
      });
    }
  }
});
```

---

## Device Handover Procedure

### Handover Checklist

```javascript
const handoverChecklist = {
  loanId: 'LOAN-12345',
  customerId: 'CUST-67890',
  deviceImei: '352099051234567',
  handoverDate: new Date(),
  handoverOfficer: 'STAFF-001',

  steps: [
    {
      step: 1,
      title: 'Customer Arrival',
      completed: true,
      timestamp: new Date(),
      notes: 'Customer arrived on time'
    },
    {
      step: 2,
      title: 'Verify Customer Identity',
      completed: true,
      timestamp: new Date(),
      notes: 'National ID verified, matches application',
      idNumber: '12-345678-A-12',
      idPhoto: 'kyc/photos/cust-67890-id.jpg'
    },
    {
      step: 3,
      title: 'Perform KYC',
      completed: true,
      timestamp: new Date(),
      kycRecordId: 'KYC-001',
      photoUrl: 'kyc/photos/cust-67890-photo.jpg',
      signatureUrl: 'kyc/signatures/cust-67890-sig.png'
    },
    {
      step: 4,
      title: 'Review Loan Terms',
      completed: true,
      timestamp: new Date(),
      termsAccepted: true,
      notes: 'Customer understood all terms, no questions'
    },
    {
      step: 5,
      title: 'Sign Loan Agreement',
      completed: true,
      timestamp: new Date(),
      agreementUrl: 'agreements/loan-12345-signed.pdf',
      signatureUrl: 'kyc/signatures/cust-67890-agreement-sig.png'
    },
    {
      step: 6,
      title: 'Hand Over Device',
      completed: true,
      timestamp: new Date(),
      deviceImei: '352099051234567',
      deviceCondition: 'NEW',
      customerVerifiedCondition: true
    },
    {
      step: 7,
      title: 'Device Demonstration',
      completed: true,
      timestamp: new Date(),
      demonstratedFeatures: [
        'Power on/off',
        'Touchscreen navigation',
        'Camera usage',
        'Charging procedure',
        'SIM card installation'
      ]
    },
    {
      step: 8,
      title: 'Provide Documentation',
      completed: true,
      timestamp: new Date(),
      documentsProvided: [
        'Signed loan agreement (copy)',
        'Device warranty card',
        'Receipt',
        'User manual',
        'Contact information card'
      ]
    },
    {
      step: 9,
      title: 'Sign Handover Receipt',
      completed: true,
      timestamp: new Date(),
      receiptUrl: 'receipts/handover-loan-12345.pdf'
    },
    {
      step: 10,
      title: 'Update Systems',
      completed: true,
      timestamp: new Date(),
      fineractUpdated: true,
      inventoryUpdated: true,
      loanStatusUpdated: 'ACTIVE'
    }
  ],

  overallStatus: 'COMPLETED',
  duration: '25 minutes', // From arrival to departure
  customerSatisfaction: 'EXCELLENT', // Rated by staff
  notes: 'Smooth handover, customer very satisfied'
};
```

### Handover Receipt

**Document Generated at Handover**:

```
┌─────────────────────────────────────────────────────────┐
│                    DEVICE HANDOVER RECEIPT               │
│                      LYNIA FINANCE                       │
└─────────────────────────────────────────────────────────┘

Date: 13 January 2025
Time: 2:30 PM
Reference: LOAN-INV-12345

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CUSTOMER DETAILS:
Name: John Doe
ID Number: 12-345678-A-12
Phone: +263 771 234 567
Address: 456 Street, Harare

DEVICE DETAILS:
Model: Samsung Galaxy A14
Color: Black
Storage: 128GB
IMEI: 352099051234567
Serial Number: R58N123ABC
Condition: NEW

ACCESSORIES INCLUDED:
✓ Charger
✓ USB Cable
✓ Earphones
✓ Protective Case
✓ User Manual
✓ Warranty Card (Valid until: 10 Jan 2026)

LOAN DETAILS:
Device Price: $150.00
Deposit Paid: $50.00
Loan Amount: $100.00
Monthly Payment: $15.00
Duration: 12 months
First Payment Due: 13 February 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CUSTOMER DECLARATION:

I confirm that I have received the above device in good
working condition. I have inspected the device and all
included accessories. I understand and accept the loan
terms and repayment schedule.

Customer Signature: _______________________  Date: _______

STAFF CONFIRMATION:

Device handed over by: Jane Smith (STAFF-001)

Staff Signature: _______________________  Date: _______

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CUSTOMER SUPPORT:
Phone: +263 771 234 567
WhatsApp: +263 771 234 567
Email: support@lynia.co.zw
Office: 123 Main Street, Harare

Hours: Mon-Fri 9AM-5PM, Sat 9AM-1PM

For payment queries or device issues, contact us anytime!

Thank you for choosing Lynia Finance! 🎉
```

---

## Post-Handover Follow-up

### Welcome Message

**WhatsApp Template**: `loan_activated_welcome`

```
🎉 Welcome to Lynia Finance!

Congratulations on your new {{1}}! We're thrilled
to have you as a customer.

💳 Your Loan is Now Active

Loan Details:
━━━━━━━━━━━━━━━━━━━━
Monthly Payment: ${{2}}
First Payment Due: {{3}}
Total Duration: {{4}} months

📱 Making Payments:

Reply PAY anytime to make a payment via:
• EcoCash: *151#
• O'mari: *707#

We'll send you a reminder 3 days before each
payment is due.

📞 Need Help?

Reply HELP for assistance
Call: {{5}}
WhatsApp: {{5}}

Thank you for trusting Lynia Finance!
Enjoy your new device! 🚀

Reference: {{6}}
```

**Variables**:
```javascript
{
  "1": "Samsung Galaxy A14",
  "2": "15.00",
  "3": "13 February 2025",
  "4": "12",
  "5": "+263 771 234 567",
  "6": "LOAN-INV-12345"
}
```

### Activate Repayment Schedule

```javascript
async function activateLoanRepayment(loan) {
  // 1. Update Fineract loan status
  await fineractClient.updateLoanStatus(loan.fineractLoanId, 'ACTIVE', {
    disbursementDate: new Date(),
    disbursementAmount: loan.loanAmount
  });

  // 2. Generate repayment schedule
  const schedule = await fineractClient.getRepaymentSchedule(loan.fineractLoanId);

  // 3. Store schedule in local database
  for (const installment of schedule) {
    await db.repayments.insertOne({
      loanId: loan.id,
      installmentNumber: installment.period,
      dueDate: installment.dueDate,
      principalDue: installment.principalDue,
      interestDue: installment.interestDue,
      totalDue: installment.totalDue,
      status: 'PENDING'
    });
  }

  // 4. Schedule payment reminders
  for (const installment of schedule) {
    const reminderDate = new Date(installment.dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3); // 3 days before

    await db.scheduledMessages.insertOne({
      loanId: loan.id,
      customerId: loan.customerId,
      phone: loan.customerPhone,
      template: 'payment_reminder_3days',
      scheduledFor: reminderDate,
      variables: {
        "1": installment.totalDue.toFixed(2),
        "2": installment.dueDate.toLocaleDateString(),
        "3": loan.invoiceNumber
      },
      status: 'SCHEDULED'
    });
  }

  // 5. Send welcome message
  await sendWhatsApp(loan.customerPhone, 'loan_activated_welcome', {
    "1": loan.deviceModel,
    "2": schedule[0].totalDue.toFixed(2),
    "3": schedule[0].dueDate.toLocaleDateString(),
    "4": loan.duration.toString(),
    "5": "+263 771 234 567",
    "6": loan.invoiceNumber
  });

  console.log(`Loan ${loan.id} activated, repayment schedule created`);
}
```

---

## Exception Handling

### Common Exceptions and Resolutions

**1. Customer No-Show**:
```
Scenario: Device ready, customer doesn't collect within 10 days

Actions:
Day 1: Send reminder
Day 3: Send urgent reminder
Day 7: Final warning (auto-cancel in 2 days)
Day 10: Auto-cancel loan, release device back to inventory

Resolution:
- Return deposit if customer requests within 30 days
- Charge restocking fee: $5
```

**2. Device Out of Stock**:
```
Scenario: Customer pays deposit, device not in stock

Actions:
- Notify customer immediately: "Device will be ready in 2-3 days"
- Place urgent order with supplier
- Daily updates to customer
- Offer alternative device model if delay exceeds 5 days
- Full refund option available anytime

Resolution:
- Procure device ASAP (priority shipping)
- Compensate customer: $5 discount or free accessory
```

**3. Customer Disputes Loan Terms**:
```
Scenario: Customer claims terms differ from what they agreed to

Actions:
- Review original application
- Show customer their signed digital agreement
- Explain terms clearly
- Offer to cancel within 7-day cooling-off period
- Full refund if cancelled within 7 days

Resolution:
- If customer proceeds: Continue handover
- If customer cancels: Process refund, return device to inventory
```

**4. Device Defective at Handover**:
```
Scenario: Quality check passed, but device has issue at handover

Actions:
- Apologize immediately
- Don't blame customer
- Replace device immediately if in stock
- Order replacement if out of stock (1-2 days)
- Offer loaner device for critical cases

Resolution:
- Replace device with identical model
- Extend warranty by 1 month as goodwill gesture
- Document defect for supplier claim
```

**5. KYC Documents Invalid**:
```
Scenario: Customer's ID expired or doesn't match application

Actions:
- Explain KYC requirement politely
- Request valid ID
- Reschedule handover for when customer has valid ID
- Hold device (don't release to inventory)

Resolution:
- Customer provides valid ID: Proceed with handover
- Customer unable to provide: Offer refund, cancel loan
```

---

## Implementation Guide

### Step 1: Setup Inventory System

**Create Inventory Database**:
```javascript
// MongoDB schema
db.createCollection('inventory');
db.inventory.createIndex({ imei: 1 }, { unique: true });
db.inventory.createIndex({ status: 1 });
db.inventory.createIndex({ deviceModel: 1 });

// Add initial stock
await db.inventory.insertMany([
  {
    sku: 'SAM-A14-BLK-128GB',
    deviceModel: 'Samsung Galaxy A14',
    brand: 'Samsung',
    color: 'Black',
    storage: '128GB',
    imei: '352099051234567',
    status: 'AVAILABLE',
    purchasePrice: 150.00,
    createdAt: new Date()
  }
  // ... more devices
]);
```

### Step 2: Implement Procurement Workflow

**Create procurement service**:
```javascript
// services/procurement.js
async function handleDepositConfirmation(loan) {
  // Check inventory
  const device = await db.inventory.findOne({
    deviceModel: loan.deviceModel,
    status: 'AVAILABLE'
  });

  if (device) {
    // Reserve device
    await reserveDevice(device.id, loan.id);
    await updateLoanStatus(loan.id, 'DEVICE_READY');
    await sendWhatsApp(loan.customerPhone, 'device_ready_same_day');
  } else {
    // Trigger procurement
    await procureDevice(loan);
    await updateLoanStatus(loan.id, 'DEVICE_PROCUREMENT');
    await sendWhatsApp(loan.customerPhone, 'device_procurement_24_48h');
  }
}
```

### Step 3: Implement Collection Notifications

**Add to webhook handler**:
```javascript
// After deposit confirmed
app.post('/api/webhooks/ecocash', async (req, res) => {
  res.status(200).send('OK');

  setImmediate(async () => {
    const payment = await processWebhook(req.body);

    if (payment.status === 'PAID') {
      await handleDepositConfirmation(payment.loan);
    }
  });
});
```

### Step 4: Create Handover App for Staff

**Tablet app for device handover**:
```javascript
// React Native or web app
const HandoverApp = () => {
  const [loan, setLoan] = useState(null);
  const [step, setStep] = useState(1);

  const steps = [
    { id: 1, title: 'Scan Loan QR Code' },
    { id: 2, title: 'Verify Customer ID' },
    { id: 3, title: 'Capture Customer Photo' },
    { id: 4, title: 'Review Loan Terms' },
    { id: 5, title: 'Capture Signature' },
    { id: 6, title: 'Hand Over Device' },
    { id: 7, title: 'Complete Handover' }
  ];

  return (
    <div>
      <ProgressBar current={step} total={steps.length} />
      {step === 1 && <QRScanner onScan={loadLoan} />}
      {step === 2 && <IDVerification loan={loan} onNext={nextStep} />}
      {step === 3 && <PhotoCapture loan={loan} onNext={nextStep} />}
      {/* ... other steps */}
    </div>
  );
};
```

### Step 5: Testing

**Test complete disbursement flow**:
```javascript
describe('Loan Disbursement Flow', () => {
  it('should complete full disbursement workflow', async () => {
    // 1. Customer pays deposit
    const payment = await simulatePayment({ amount: 50, status: 'PAID' });

    // 2. Device reserved
    const device = await db.inventory.findOne({ reservedFor: payment.loanId });
    expect(device).toBeDefined();
    expect(device.status).toBe('RESERVED');

    // 3. Device prepared
    await prepareDevice(device.id);
    const prepared = await db.inventory.findOne({ _id: device._id });
    expect(prepared.status).toBe('READY_FOR_COLLECTION');

    // 4. Customer notified
    const notification = await db.notifications.findOne({
      loanId: payment.loanId,
      template: 'device_ready_collection'
    });
    expect(notification).toBeDefined();

    // 5. Handover completed
    await performHandover(payment.loanId);
    const loan = await db.loans.findOne({ _id: payment.loanId });
    expect(loan.status).toBe('ACTIVE');

    // 6. Device disbursed
    const disbursed = await db.inventory.findOne({ _id: device._id });
    expect(disbursed.status).toBe('DISBURSED');
  });
});
```

---

## Summary

### Disbursement Timeline

```
Day 0: Deposit confirmed → Device procurement/reservation
Day 1-2: Device prepared → Quality check, packaging
Day 2: Customer notified → Collection instructions sent
Day 2-3: Customer collects → KYC, handover, activation
Day 3+: Loan active → Repayment schedule begins
```

### Key Success Metrics

```
Device Ready Time: < 24 hours (80% of cases)
Handover Duration: 15-30 minutes
Customer Satisfaction: 90%+ excellent rating
KYC Completion Rate: 100% (mandatory)
First Payment Success: 85%+ on-time
```

### Next Steps (T022)

The next task will focus on documenting the repayment reminder system and payment collection workflow.

---

**End of T021 Research Document**
