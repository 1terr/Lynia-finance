# T023: Document Default Management and Device Recovery Process

## Research Context

**Task**: Document default management and device recovery process
**Date**: 2025-01-13
**Status**: Complete

This research documents the complete default management workflow including device recovery procedures, legal processes under Zimbabwean law, asset repossession, and loan write-off accounting treatment for Lynia Finance.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Default Definition and Triggers](#default-definition-and-triggers)
3. [Pre-Default Intervention](#pre-default-intervention)
4. [Default Declaration Process](#default-declaration-process)
5. [Device Recovery Procedures](#device-recovery-procedures)
6. [Legal Process (Zimbabwe Law)](#legal-process-zimbabwe-law)
7. [Asset Remarketing](#asset-remarketing)
8. [Loan Write-Off Procedures](#loan-write-off-procedures)
9. [Credit Bureau Reporting](#credit-bureau-reporting)
10. [Implementation Guide](#implementation-guide)

---

## Executive Summary

### Default Management Philosophy

**Last Resort**: Default is a failure for both customer and lender. Every effort should be made to prevent default through communication, payment plans, and hardship programs.

**Respectful Recovery**: Even in default, customers must be treated with dignity and respect. Aggressive or threatening tactics are prohibited.

**Cost-Effective**: Device recovery and legal action are expensive. Workout arrangements are usually better for all parties.

### Default Timeline

```
Day 30: Account declared in default
Day 31-37: Final settlement offer (7 days)
Day 38-45: Device recovery initiated
Day 46-60: Legal demand letter
Day 61-90: Court summons (if necessary)
Day 91+: Asset repossession and remarketing
```

### Recovery Expectations

**Recovery Rates** (Industry benchmarks):
```
Voluntary surrender: 70% of loan balance recovered
Device recovery: 50-60% of loan balance recovered
Legal action only: 20-30% of loan balance recovered
```

**Lynia Finance Targets**:
```
Default rate: < 8% of portfolio
Recovery rate: 55%+ of defaulted loans
Time to recovery: < 90 days average
Cost per recovery: < $30
```

---

## Default Definition and Triggers

### Definition of Default

**Default Status** is triggered when:

```
1. Payment is 30+ days overdue
   AND
2. Customer has not responded to communication
   AND
3. No payment plan arrangement exists
```

**Alternative Default Triggers**:
```
• Customer explicitly refuses to pay
• Customer cannot be located (skip)
• Device is reported sold/transferred
• Fraudulent application discovered
• Customer deceased (special handling)
```

### Default Classification

**Level 1 Default (30-60 days)**:
```
Status: SOFT_DEFAULT
Risk: Medium
Action: Intensive communication, settlement offers
Recovery Method: Voluntary payment plan
```

**Level 2 Default (61-90 days)**:
```
Status: HARD_DEFAULT
Risk: High
Action: Device recovery, legal notice
Recovery Method: Asset repossession
```

**Level 3 Default (90+ days)**:
```
Status: WRITE_OFF
Risk: Very High
Action: Legal action, credit bureau reporting
Recovery Method: External collections, write-off
```

### Automatic Default Declaration

```javascript
// Automated default detection (runs daily)
cron.schedule('0 8 * * *', async () => {
  const candidates = await db.loans.find({
    status: 'ACTIVE',
    $expr: {
      $gte: [
        {
          $divide: [
            { $subtract: [new Date(), '$nextPaymentDue'] },
            1000 * 60 * 60 * 24
          ]
        },
        30
      ]
    },
    lastContactAttempt: {
      $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  for (const loan of candidates) {
    await declareDefault(loan);
  }
});

async function declareDefault(loan) {
  // Update loan status
  await db.loans.updateOne(
    { _id: loan._id },
    {
      $set: {
        status: 'DEFAULT',
        defaultDate: new Date(),
        defaultReason: 'NON_PAYMENT_30_DAYS',
        daysOverdue: calculateDaysOverdue(loan),
        amountOverdue: await calculateOverdueAmount(loan)
      }
    }
  );

  // Send default notification
  await sendDefaultNotice(loan);

  // Alert collections team
  await alertCollections(loan);

  // Log default event
  await db.events.insertOne({
    type: 'LOAN_DEFAULT',
    loanId: loan._id,
    customerId: loan.customerId,
    timestamp: new Date(),
    details: {
      daysOverdue: calculateDaysOverdue(loan),
      amountOverdue: await calculateOverdueAmount(loan)
    }
  });

  console.log(`Loan ${loan.id} declared in default`);
}
```

---

## Pre-Default Intervention

### Day 21-29 (Critical Window)

**Last Chance Communications**:

```javascript
// Intensive pre-default outreach
async function preDefaultIntervention(loan) {
  const daysOverdue = calculateDaysOverdue(loan);

  if (daysOverdue >= 21 && daysOverdue < 30) {
    // Daily contact attempts
    await sendWhatsApp(loan.customerPhone, 'urgent_pre_default', {
      "1": loan.customerName,
      "2": (30 - daysOverdue).toString(),
      "3": loan.totalOverdue.toFixed(2),
      "4": loan.invoiceNumber
    });

    // Phone call attempts
    await schedulePhoneCall(loan, 'URGENT_PRE_DEFAULT');

    // Settlement offer
    await offerSettlement(loan);

    // Home visit (if local)
    if (loan.city === 'Harare') {
      await scheduleHomeVisit(loan);
    }
  }
}
```

### Settlement Offers

**Discounted Payoff Offer**:

```
Original Balance: $100.00
Payments Made: $30.00 (2 months)
Remaining: $70.00
Late Fees: $12.00
Total Due: $82.00

SETTLEMENT OFFER:
Pay $65.00 now (20% discount)
Waive all late fees
Clear your account
Avoid default on credit record

Valid for 7 days only
```

**WhatsApp Template**: `settlement_offer`

```
🔔 Special Settlement Offer - {{1}}

Your account is at serious risk of default, but
we want to help you resolve this.

💳 Current Balance: ${{2}}
💰 Settlement Offer: ${{3}} ({{4}}% discount)

This special offer:
✅ Saves you ${{5}}
✅ Waives all late fees (${{6}})
✅ Clears your account completely
✅ Avoids default on credit record

⏰ Valid for 7 DAYS ONLY

Pay now: {{7}}

This is our best offer to help you avoid default.

Call us: {{8}}

Reference: {{9}}
```

---

## Default Declaration Process

### Formal Default Notice

**Template**: `default_notice_formal`

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMAL NOTICE OF DEFAULT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Date: {{1}}
Account Holder: {{2}}
Loan Reference: {{3}}
Device: {{4}}

NOTICE IS HEREBY GIVEN that your loan account
is now in DEFAULT as of {{5}}.

OUTSTANDING AMOUNT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Principal Remaining:    ${{6}}
Unpaid Interest:        ${{7}}
Late Fees:              ${{8}}
Recovery Costs:         ${{9}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL AMOUNT DUE:       ${{10}}

REASON FOR DEFAULT:
{{11}}

YOU HAVE 7 DAYS TO RESPOND

Within 7 days from the date of this notice, you
must either:

1. Pay the full outstanding amount, OR
2. Contact us to arrange a settlement, OR
3. Voluntarily surrender the device

CONSEQUENCES OF NON-RESPONSE:

❌ Device recovery proceedings will commence
❌ Legal action may be initiated
❌ Default will be reported to credit bureaus
❌ Additional collection costs will be added
❌ You may be liable for full loan balance

CONTACT US IMMEDIATELY:
Phone: {{12}}
WhatsApp: {{12}}
Email: {{13}}
Office: {{14}}

This is a formal legal notice. Ignoring this
notice will result in further action.

Lynia Finance Collections Department

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Default Status Updates

```javascript
const defaultStatuses = {
  DEFAULT_DECLARED: {
    day: 30,
    action: 'Send formal notice',
    nextStep: 'Wait 7 days for response'
  },

  NO_RESPONSE: {
    day: 37,
    action: 'Initiate device recovery',
    nextStep: 'Locate device, schedule recovery'
  },

  RECOVERY_ATTEMPT: {
    day: 45,
    action: 'First recovery attempt',
    nextStep: 'Legal demand letter if failed'
  },

  LEGAL_NOTICE: {
    day: 60,
    action: 'Send legal demand letter',
    nextStep: 'Court summons preparation'
  },

  COURT_ACTION: {
    day: 90,
    action: 'File court summons',
    nextStep: 'Obtain judgment'
  },

  WRITE_OFF: {
    day: 180,
    action: 'Write-off loan',
    nextStep: 'External collections'
  }
};
```

---

## Device Recovery Procedures

### Recovery Planning

**Pre-Recovery Assessment**:

```javascript
async function assessRecoveryFeasibility(loan) {
  const assessment = {
    loanId: loan.id,
    deviceValue: await estimateDeviceValue(loan),
    amountOwed: loan.totalOverdue,
    recoveryCost: 30, // Estimated $30 per recovery
    legalCost: 50,    // Estimated $50 legal fees

    // Calculate net recovery
    deviceValue: 0,
    recoveryCost: 0,
    netRecovery: 0,
    worthPursuing: false
  };

  // Estimate device value (depreciation)
  const monthsSincePurchase = calculateMonths(
    loan.deviceHandoverDate,
    new Date()
  );

  const depreciationRate = 0.15; // 15% per month
  assessment.deviceValue = loan.deviceOriginalPrice *
    Math.pow(1 - depreciationRate, monthsSincePurchase);

  // Calculate net recovery
  assessment.netRecovery = assessment.deviceValue -
    assessment.recoveryCost - assessment.legalCost;

  // Is recovery worth it?
  assessment.worthPursuing = assessment.netRecovery >
    (loan.totalOverdue * 0.3); // At least 30% recovery

  return assessment;
}
```

### Voluntary Surrender Process

**Encourage Voluntary Return**:

```
WhatsApp Template: device_voluntary_surrender

Hi {{1}},

We understand you're facing financial difficulties.

Rather than going through the recovery process,
we're offering you the option to voluntarily
surrender your {{2}}.

Benefits of Voluntary Surrender:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ No recovery costs charged to you
✅ No legal fees
✅ Reduced impact on credit record
✅ Possibility of partial debt forgiveness
✅ Dignified resolution

How It Works:
1. Bring device to our office (factory reset)
2. Sign surrender form
3. We assess device condition
4. Negotiate final settlement amount
5. Close account

Current Situation:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount Owed: ${{3}}
Estimated Device Value: ${{4}}
Potential Settlement: ${{5}}

This is the best option to minimize your loss.

Call us to arrange surrender: {{6}}

We're open to working with you.

Reference: {{7}}
```

### Device Location & Recovery

**Location Methods**:

1. **Customer Cooperation**: Request customer bring device to office
2. **Home Address**: Visit customer's registered address
3. **Employment Address**: Visit customer's workplace (discreet)
4. **Contact Tracing**: Call references/guarantors for information
5. **Social Media**: Check for location tags (ethical limits)

**Recovery Agent Protocol**:

```
DEVICE RECOVERY PROTOCOL

Pre-Visit Checklist:
□ Confirm device location
□ Verify recovery agent credentials
□ Prepare recovery documentation
□ Coordinate with customer (if cooperative)
□ Bring payment receipt book (for settlement)

During Visit:
□ Identify yourself professionally
□ Explain purpose calmly
□ Request voluntary surrender first
□ If customer agrees:
  □ Verify device IMEI matches loan
  □ Check device condition
  □ Factory reset device (with customer present)
  □ Customer signs surrender form
  □ Provide receipt and settlement offer
□ If customer refuses:
  □ Explain consequences
  □ Do NOT use force or threats
  □ Do NOT enter property without permission
  □ Schedule follow-up or legal action
□ Photograph device condition
□ Document interaction (notes, recordings if legal)

Post-Visit:
□ Update loan status
□ Report to collections manager
□ Store device securely
□ Assess device for remarketing
□ Calculate settlement amount
□ Contact customer with settlement offer

NEVER:
❌ Use force or intimidation
❌ Damage customer property
❌ Harass family members
❌ Disclose debt to neighbors/colleagues
❌ Enter property without permission
❌ Take device if customer contests ownership
```

### Remote Device Lock (Future Enhancement)

**Note**: This requires special software installed on devices at handover.

```javascript
// Device lock capability (future implementation)
async function remoteLockDevice(loan) {
  // Integration with device management platform
  const device = await deviceManagement.findByIMEI(loan.deviceIMEI);

  if (device.lockCapable) {
    // Send lock command
    await deviceManagement.lockDevice(device.id, {
      message: 'Device locked due to non-payment. Call +263 771 234 567',
      allowEmergencyCalls: true,
      allowWhatsApp: true // So they can contact us
    });

    // Notify customer
    await sendWhatsApp(loan.customerPhone, {
      text: `Your ${loan.deviceModel} has been locked due to non-payment. To unlock, please pay your outstanding balance of $${loan.totalOverdue.toFixed(2)} or call us at +263 771 234 567 to discuss a payment plan.`
    });

    // Log action
    await db.events.insertOne({
      type: 'DEVICE_LOCKED',
      loanId: loan.id,
      timestamp: new Date(),
      deviceIMEI: loan.deviceIMEI
    });
  }
}
```

---

## Legal Process (Zimbabwe Law)

### Legal Framework

**Key Legislation**:
- **Magistrates Court Act** [Chapter 7:10]
- **High Court Act** [Chapter 7:06]
- **Movable Property (Security Interests) Act**
- **Consumer Protection Act**

**Jurisdiction**:
- Loans < $500: Magistrates Court
- Loans $500+: High Court
- Device value determines recovery method

### Debt Collection Process (Zimbabwean Law)

**Step 1: Letter of Demand** (Day 30-45)

```
Required Elements:
• Names of creditor and debtor
• Amount owed (principal + interest + fees)
• Facts giving rise to debt
• Timeline to pay (typically 7-14 days)
• Consequences of non-payment
• Demand for immediate payment
```

**Template**: Legal Demand Letter

```
[Law Firm Letterhead]

Date: [Date]

LETTER OF DEMAND

To: {{customerName}}
Address: {{customerAddress}}

Dear Sir/Madam,

RE: DEMAND FOR PAYMENT - LOAN ACCOUNT {{loanReference}}

We act for Lynia Finance (Private) Limited ("our client")
in the above matter.

PARTICULARS OF CLAIM:

1. On or about {{loanDate}}, you entered into a loan
   agreement with our client for the purchase of a
   {{deviceModel}} valued at ${{devicePrice}}.

2. In terms of the loan agreement, you agreed to pay
   a deposit of ${{depositAmount}} and repay the
   balance of ${{loanAmount}} over {{duration}} months
   at ${{monthlyPayment}} per month.

3. You have failed to make payment as agreed, and your
   account is now {{daysOverdue}} days in arrears.

4. The total amount currently outstanding is:

   Principal: ${{principal}}
   Interest: ${{interest}}
   Late Fees: ${{lateFees}}
   TOTAL: ${{totalOwed}}

5. Despite numerous attempts to contact you, you have
   failed to make payment or contact our client.

DEMAND:

TAKE NOTICE that you are hereby required to pay the
sum of ${{totalOwed}} within SEVEN (7) DAYS of receipt
of this letter, failing which:

a) Our client will institute legal proceedings against
   you without further notice;

b) You will be liable for all legal costs on the
   attorney-client scale;

c) Our client will repossess the device;

d) Your default will be reported to credit reference
   bureaus.

Should you wish to discuss a settlement arrangement,
please contact us immediately.

Yours faithfully,

{{lawFirmName}}
Legal Practitioners
```

**Step 2: Acknowledgment of Debt** (Optional)

If customer cannot pay in full but acknowledges debt:

```
ACKNOWLEDGMENT OF DEBT

I, {{customerName}}, ID Number {{idNumber}}, of
{{address}}, do hereby acknowledge that I am
indebted to Lynia Finance (Private) Limited in
the sum of ${{totalOwed}} arising from:

[Details of loan agreement]

I undertake to pay this debt as follows:

• ${{amount1}} on or before {{date1}}
• ${{amount2}} on or before {{date2}}
• [etc.]

I understand that failure to pay as agreed will
result in legal proceedings without further notice.

Signed: ________________  Date: ________

Witness: ________________ Date: ________
```

**Step 3: Court Summons** (Day 60-90)

**Summons issued at**:
- Magistrates Court (if loan < $500)
- High Court (if loan $500+)

**Jurisdiction**:
- Customer's residential address, OR
- Customer's employment address, OR
- Customer's place of business

**Summons Contents**:
```
• Plaintiff details (Lynia Finance)
• Defendant details (Customer)
• Amount claimed
• Particulars of claim
• Prayer for relief (judgment + costs)
```

**Service of Summons**:
- Personal service by Sheriff/Messenger
- If cannot locate: Substituted service via newspaper

**Step 4: Defense Period** (10-14 days)

Customer must file Notice of Intention to Defend:
- 10 days for Magistrates Court
- 14 days for High Court

**Step 5: Default Judgment** (If no defense)

```
If customer fails to defend:

• File Request for Default Judgment
• Court issues judgment in creditor's favor
• Judgment includes:
  - Principal amount
  - Interest
  - Legal costs
  - Sheriff's fees
```

**Step 6: Execution** (After judgment)

```
Writ of Execution authorizes Sheriff to:

1. Attach movable property (device, other assets)
2. Serve warrant on debtor
3. If not paid, sell property at public auction
4. Proceeds go toward judgment debt
```

### Legal Costs

```
Typical Legal Costs (Zimbabwe):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Letter of Demand:           $20 - $30
Court Filing Fees:          $15 - $50
Service of Summons:         $10 - $20
Legal Practitioner Fees:    $100 - $200
Sheriff's Fees:             $20 - $40
Total Estimated Cost:       $165 - $340

Note: Costs awarded to creditor if successful
```

### Practical Considerations

**When to Use Legal Action**:
✅ Loan amount > $100 (cost-effective)
✅ Customer has traceable assets
✅ Customer has verifiable address
✅ Customer employed (garnishment possible)

**When to Avoid Legal Action**:
❌ Loan amount < $50 (not cost-effective)
❌ Customer disappeared/untraceable
❌ Customer unemployed with no assets
❌ Device already recovered

---

## Asset Remarketing

### Device Assessment

**Condition Grading**:

```javascript
const deviceConditions = {
  EXCELLENT: {
    description: 'Like new, no visible wear',
    remarkValue: 0.70, // 70% of original price
    criteria: [
      'Screen perfect, no scratches',
      'Body pristine',
      'All functions work perfectly',
      'Original accessories included'
    ]
  },

  GOOD: {
    description: 'Minor wear, fully functional',
    remarkValue: 0.55, // 55% of original price
    criteria: [
      'Minor scratches on screen/body',
      'All functions work',
      'May have minor cosmetic issues',
      'Some accessories may be missing'
    ]
  },

  FAIR: {
    description: 'Visible wear, functional',
    remarkValue: 0.40, // 40% of original price
    criteria: [
      'Noticeable scratches/dents',
      'All core functions work',
      'Cosmetic damage present',
      'Accessories missing'
    ]
  },

  POOR: {
    description: 'Heavy wear, some issues',
    remarkValue: 0.25, // 25% of original price
    criteria: [
      'Significant damage',
      'Some functions may not work',
      'Cracked screen or body damage',
      'Needs repair'
    ]
  },

  PARTS_ONLY: {
    description: 'Not functional, parts value',
    remarkValue: 0.10, // 10% of original price
    criteria: [
      'Device does not power on',
      'Major component failure',
      'Beyond economical repair'
    ]
  }
};

async function assessDevice(device) {
  const assessment = {
    deviceId: device.id,
    imei: device.imei,
    model: device.model,
    originalPrice: device.originalPrice,
    assessmentDate: new Date(),

    // Physical condition
    screenCondition: '', // PERFECT, MINOR_SCRATCHES, CRACKED
    bodyCondition: '', // PERFECT, MINOR_WEAR, DAMAGED
    batteryHealth: 0, // 0-100%

    // Functionality
    powersOn: true,
    touchscreenWorks: true,
    camerasWork: true,
    speakerWorks: true,
    allButtonsWork: true,
    charging works: true,

    // Overall grade
    condition: 'GOOD',
    estimatedValue: 0,
    notes: ''
  };

  // Estimate value
  const condition = deviceConditions[assessment.condition];
  assessment.estimatedValue = device.originalPrice * condition.remarkValue;

  return assessment;
}
```

### Remarketing Channels

**Option 1: Sell to Customer (First Priority)**

```
Settlement Offer After Recovery:

Device Original Price: $150
Current Market Value: $90 (GOOD condition)
Amount Customer Owes: $70

Settlement Offer:
Customer pays: $50
Lynia writes off: $20
Customer keeps device

Win-win: Customer saves $40, Lynia recovers $50
```

**Option 2: Sell to Other Lynia Customers**

```
Refurbished Device Sale:

Device: Samsung A14 (Refurbished)
Condition: GOOD
Original Price: $150
Refurbished Price: $100

Marketing:
"Certified Refurbished - 30 Day Warranty
Save $50 on brand new price!"

Sold as replacement/upgrade to existing customers
```

**Option 3: Wholesale to Dealers**

```
Bulk Device Sales:

10 Samsung A14 devices (mixed condition)
Average condition: GOOD/FAIR
Market value: $90 each = $900 total
Wholesale price: $650 (72% of market)

Quick cash recovery, minimal effort
```

**Option 4: Online Marketplaces**

```
Facebook Marketplace, WhatsApp Status:

"Samsung A14 - $85
Good condition, fully functional
6 months old, tested & guaranteed
Call/WhatsApp: +263 771 234 567"

Reach broad audience, retail pricing
```

**Option 5: Parts Salvage**

```
For damaged/non-functional devices:

Screen: $20
Battery: $15
Camera: $10
Motherboard: $25
Other parts: $10
Total: $80

Sell to repair shops
```

### Remarketing Workflow

```javascript
async function remarketDevice(device, loan) {
  // 1. Assess device condition
  const assessment = await assessDevice(device);

  // 2. Determine remarketing strategy
  let strategy;

  if (assessment.condition === 'EXCELLENT' || assessment.condition === 'GOOD') {
    // Try to sell to defaulted customer first
    strategy = await offerSettlementToCustomer(loan, assessment);

    if (!strategy.accepted) {
      // Sell to other customers or online
      strategy = await listForSale(device, assessment);
    }
  } else if (assessment.condition === 'FAIR') {
    // Wholesale or online sale
    strategy = await wholesaleDevice(device, assessment);
  } else {
    // Parts salvage
    strategy = await salvageForParts(device, assessment);
  }

  // 3. Record remarketing
  await db.remarketing.insertOne({
    deviceId: device.id,
    loanId: loan.id,
    assessmentDate: new Date(),
    condition: assessment.condition,
    estimatedValue: assessment.estimatedValue,
    strategy: strategy.type,
    expectedRecovery: strategy.expectedAmount,
    status: 'LISTED'
  });

  return strategy;
}

async function offerSettlementToCustomer(loan, assessment) {
  const settlementAmount = Math.min(
    loan.totalOverdue * 0.7, // 30% discount
    assessment.estimatedValue * 0.6 // 40% below market
  );

  await sendWhatsApp(loan.customerPhone, 'device_settlement_after_recovery', {
    "1": loan.customerName,
    "2": loan.deviceModel,
    "3": assessment.estimatedValue.toFixed(2),
    "4": loan.totalOverdue.toFixed(2),
    "5": settlementAmount.toFixed(2),
    "6": (loan.totalOverdue - settlementAmount).toFixed(2)
  });

  // Wait for response (7 days)
  return {
    type: 'SETTLEMENT_OFFER',
    expectedAmount: settlementAmount,
    accepted: false // Will be updated if customer accepts
  };
}
```

---

## Loan Write-Off Procedures

### When to Write-Off

**Write-off criteria**:
```
1. Loan in default for 180+ days (6 months)
   AND
2. All recovery efforts exhausted
   AND
3. Customer untraceable or uncooperative
   AND
4. Device not recovered or low value
   AND
5. Legal action deemed uneconomical
```

**Automatic Write-Off Triggers**:
```
• Default for 180 days with no contact
• Customer deceased (with proof)
• Customer bankrupt
• Device destroyed/lost (with evidence)
• Recovery cost exceeds potential recovery
```

### Write-Off Accounting Treatment

**Allowance Method** (GAAP compliant):

```
Step 1: Create Allowance for Bad Debts (Monthly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Debit:  Bad Debt Expense           $1,000
Credit: Allowance for Bad Debts    $1,000

(Estimated 5% of portfolio will default)

Step 2: Write-Off Specific Loan (When determined uncollectible)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Debit:  Allowance for Bad Debts    $70
Credit: Loans Receivable            $70

(Removes specific uncollectible loan from books)
```

**Journal Entry Example**:

```
Loan Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Loan ID: LOAN-12345
Original Amount: $100
Paid to Date: $30
Outstanding: $70
Write-off Amount: $70

Accounting Entry (Write-Off):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: 13 July 2025

Debit:  Allowance for Doubtful Accounts  $70
Credit: Loans Receivable - LOAN-12345     $70

Memo: Write-off of uncollectible loan per management
      decision after 180 days default and failed
      recovery attempts.
```

### Write-Off Documentation

**Required Documentation**:

```
Write-Off Request Form:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Loan Reference: {{loanId}}
Customer Name: {{customerName}}
Loan Amount: ${{originalAmount}}
Amount Paid: ${{amountPaid}}
Write-Off Amount: ${{writeOffAmount}}

Default Date: {{defaultDate}}
Days in Default: {{daysInDefault}}
Last Contact: {{lastContactDate}}

Recovery Attempts:
□ Phone calls: {{phoneCallCount}} attempts
□ WhatsApp messages: {{whatsappCount}} sent
□ Home visits: {{homeVisitCount}} attempts
□ Legal demand letter: Sent {{legalLetterDate}}
□ Court action: {{courtActionStatus}}

Device Recovery:
□ Device recovered: {{deviceRecovered}}
□ Device value: ${{deviceValue}}
□ Remarketing status: {{remarketingStatus}}

Reason for Write-Off:
{{writeOffReason}}

Approved By:
Collections Manager: _________________ Date: _____
Finance Manager: ____________________ Date: _____
Managing Director: __________________ Date: _____
```

### Post-Write-Off Actions

**Customer Account**:
```
Status: WRITTEN_OFF
Balance: $0 (accounting)
Note: "Written off as uncollectible. External collections may continue."
```

**Continue Collection Efforts**:
- Write-off is accounting treatment only
- Collections can continue
- Any recovery is recorded as "Bad Debt Recovery" (income)

**External Collections** (Optional):
```
Sell debt to collections agency:
• Typical price: 10-20% of face value
• Agency pursues collection
• Lynia receives immediate cash
• Customer deals with agency
```

**Credit Bureau Reporting**:
```
Report to Zimbabwe Credit Bureau:
• Account status: DEFAULT / WRITE-OFF
• Amount: $70
• Date: 13 July 2025
• Remains on record: 5-7 years
```

---

## Credit Bureau Reporting

### Zimbabwe Credit Reference System

**Credit Reference Bureau**: Zimbabwe Credit Reference Bureau (CRB)

**Reporting Requirements**:
- All licensed lenders must report
- Monthly reporting cycle
- Negative and positive data

**Information Reported**:
```
Positive Data:
• Loan opened
• On-time payments
• Loan paid in full

Negative Data:
• Late payments (30+ days)
• Default (60+ days)
• Write-offs
• Legal judgments
```

### Reporting Timeline

```
Day 30 Overdue:
Status: DELINQUENT
Report: "30 days past due"

Day 60 Overdue:
Status: DEFAULT
Report: "Account in default"

Day 90 Overdue:
Status: SERIOUS_DEFAULT
Report: "Serious default - 90 days"

Day 180 Overdue:
Status: WRITE_OFF
Report: "Charged off as bad debt"
```

### Credit Score Impact

```
Impact on Customer Credit Score:

30 days late: -50 to -100 points
60 days late: -100 to -150 points
Default: -150 to -200 points
Write-off: -200 to -300 points

Recovery Time:
• Paid in full: Removed after 12 months
• Unpaid: Remains for 5-7 years
```

### Reporting API Integration

```javascript
// Monthly credit bureau reporting
async function reportToCreditBureau() {
  const month = new Date().getMonth();
  const year = new Date().getFullYear();

  // Get all loans with status changes
  const loans = await db.loans.find({
    $or: [
      { status: 'DELINQUENT' },
      { status: 'DEFAULT' },
      { status: 'WRITE_OFF' },
      { status: 'PAID_OFF' }
    ],
    lastReportedDate: {
      $lt: new Date(year, month, 1)
    }
  });

  const report = [];

  for (const loan of loans) {
    report.push({
      customerIdNumber: loan.customerIdNumber,
      loanReference: loan.invoiceNumber,
      loanType: 'DEVICE_FINANCING',
      originalAmount: loan.loanAmount,
      currentBalance: loan.outstandingBalance,
      paymentStatus: loan.status,
      daysOverdue: calculateDaysOverdue(loan),
      reportDate: new Date()
    });
  }

  // Submit to credit bureau
  await creditBureauAPI.submitReport({
    lender: 'LYNIA_FINANCE',
    month: month,
    year: year,
    accounts: report
  });

  // Update last reported date
  await db.loans.updateMany(
    { _id: { $in: loans.map(l => l._id) } },
    { $set: { lastReportedDate: new Date() } }
  );

  console.log(`Reported ${report.length} accounts to credit bureau`);
}

// Run on 1st of each month
cron.schedule('0 2 1 * *', reportToCreditBureau);
```

---

## Implementation Guide

### Step 1: Setup Default Detection

```javascript
// Daily default detection job
cron.schedule('0 8 * * *', async () => {
  await detectDefaults();
});

async function detectDefaults() {
  const candidates = await db.loans.find({
    status: 'ACTIVE',
    nextPaymentDue: {
      $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  });

  for (const loan of candidates) {
    const daysOverdue = calculateDaysOverdue(loan);

    if (daysOverdue >= 30) {
      await declareDefault(loan);
    }
  }
}
```

### Step 2: Implement Recovery Workflow

```javascript
// Recovery workflow
async function manageDefaultedLoan(loan) {
  const daysInDefault = Math.floor(
    (new Date() - loan.defaultDate) / (1000 * 60 * 60 * 24)
  );

  if (daysInDefault === 7) {
    // Day 7: Settlement offer
    await offerSettlement(loan);
  } else if (daysInDefault === 14) {
    // Day 14: Device recovery initiation
    await initiateDeviceRecovery(loan);
  } else if (daysInDefault === 30) {
    // Day 30: Legal demand letter
    await sendLegalDemand(loan);
  } else if (daysInDefault === 60) {
    // Day 60: Court summons
    await fileCourt Summons(loan);
  } else if (daysInDefault === 180) {
    // Day 180: Write-off
    await writeOffLoan(loan);
  }
}

// Run daily
cron.schedule('0 10 * * *', async () => {
  const defaultedLoans = await db.loans.find({ status: 'DEFAULT' });

  for (const loan of defaultedLoans) {
    await manageDefaultedLoan(loan);
  }
});
```

### Step 3: Testing

```javascript
describe('Default Management', () => {
  it('should declare default at 30 days', async () => {
    const loan = await createTestLoan({
      status: 'ACTIVE',
      nextPaymentDue: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    });

    await detectDefaults();

    const updated = await db.loans.findOne({ _id: loan._id });
    expect(updated.status).toBe('DEFAULT');
    expect(updated.defaultDate).toBeDefined();
  });

  it('should write-off after 180 days', async () => {
    const loan = await createTestLoan({
      status: 'DEFAULT',
      defaultDate: new Date(Date.now() - 181 * 24 * 60 * 60 * 1000)
    });

    await manageDefaultedLoan(loan);

    const updated = await db.loans.findOne({ _id: loan._id });
    expect(updated.status).toBe('WRITE_OFF');
  });
});
```

---

## Summary

### Default Management Process

**Timeline**:
- Day 30: Default declared
- Day 37: Device recovery initiated
- Day 60: Legal demand letter
- Day 90: Court summons
- Day 180: Write-off

### Recovery Methods

**Most Effective → Least Effective**:
1. Voluntary settlement (70% recovery)
2. Device recovery + settlement (55% recovery)
3. Legal judgment + execution (30% recovery)
4. Write-off + external collections (10% recovery)

### Key Principles

✅ **Prevention First**: Most defaults are preventable with early intervention
✅ **Respectful Process**: Treat defaulting customers with dignity
✅ **Cost-Effective**: Consider recovery cost vs. potential gain
✅ **Legal Compliance**: Follow Zimbabwean debt collection laws
✅ **Documentation**: Maintain detailed records for all actions
✅ **Quick Action**: Faster recovery = higher success rate

### Success Metrics

**Target Performance**:
- Default rate: < 8%
- Recovery rate: 55%+
- Time to recovery: < 90 days
- Legal costs: < 20% of recovery

### Next Steps (T024)

The next task will focus on documenting regulatory compliance requirements for device financing in Zimbabwe.

---

**End of T023 Research Document**
