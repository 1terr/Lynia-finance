# Direct EcoCash & O'mari Integration Guide

**Purpose**: Complete guide for integrating directly with EcoCash and O'mari mobile money platforms in Zimbabwe
**Target**: Lynia Finance MVP implementation
**Date**: 2025-11-12
**Status**: Research & Planning Phase

---

## Executive Summary

This document provides a comprehensive guide to integrating directly with **EcoCash** and **O'mari** mobile money platforms, bypassing third-party payment gateways (Paynow, Pesepay, etc.).

### Integration Pathways

| Pathway | Timeline | Cost | Complexity | Recommended For |
|---------|----------|------|------------|-----------------|
| **1. Direct API** (Official) | 3-6 months | Medium | High | Long-term, scale (10K+ txns/month) |
| **2. USSD Aggregator** (ZimSwitch) | 2-3 months | Medium | Medium | Bank-like institutions |
| **3. Agent Network** (Manual) | 2-4 weeks | Low | Low | MVP testing, small volume |
| **4. Hybrid** (Agent + API) | 3-6 months | Medium | Medium | **Recommended for Lynia Finance** |

**Recommended Strategy for Lynia Finance**:
- **Phase 0 (MVP)**: Start with Agent Network (manual collections)
- **Phase 1 (Growth)**: Apply for direct EcoCash/O'mari APIs
- **Phase 2 (Scale)**: Full API integration with automated collections

---

## Table of Contents

1. [Integration Pathway 1: Direct API Access](#pathway-1-direct-api-access)
2. [Integration Pathway 2: USSD Aggregator (ZimSwitch)](#pathway-2-ussd-aggregator-zimswitch)
3. [Integration Pathway 3: Agent Network Integration](#pathway-3-agent-network-integration)
4. [Integration Pathway 4: Hybrid Approach](#pathway-4-hybrid-approach-recommended)
5. [Cost-Benefit Analysis](#cost-benefit-analysis)
6. [Implementation Roadmap](#implementation-roadmap)
7. [References & Contacts](#references--contacts)

---

## Pathway 1: Direct API Access

### Overview

Apply for official merchant/partner status with EcoCash and O'mari to receive API credentials and documentation.

---

### 1.1 EcoCash Direct API

#### Application Process

**Step 1: Become an EcoCash Merchant**

**Timeline**: 4-8 weeks

**Required Documents**:
1. **Business Registration**:
   - Certificate of Incorporation (certified copy)
   - CR6/CR14 (Company Directors certificate)
   - Business license/trading license
   - Tax clearance certificate (ZIMRA)

2. **Financial Documents**:
   - Bank statements (last 3 months)
   - Proof of business address (lease/title deed)
   - Business plan (optional but helpful)

3. **Director Information**:
   - National IDs of all directors (certified)
   - Proof of residence for directors (utility bill, bank statement)
   - Director contact details

4. **Merchant Application Form**:
   - Download from [ecocash.co.zw/merchants](https://ecocash.co.zw/merchants/)
   - Or collect from any Econet Shop

**Submission**:
- Submit to nearest Econet Shop
- Or email to: ecocashhelp@econet.co.zw
- Or upload via self-service portal: [partnerapplications.ecocash.co.zw](https://partnerapplications.ecocash.co.zw/)

---

**Step 2: Request API Access**

After merchant approval, request **Online Merchant** status with API access.

**Process**:
1. Contact EcoCash business team via merchant portal
2. Request API integration for online payments
3. Provide technical requirements:
   - Expected transaction volume
   - Use case description (device financing, loan repayments)
   - Technical stack (Node.js, webhook endpoints)
   - Security certifications

**Review Period**: 2-4 weeks

---

**Step 3: API Documentation & Credentials**

Once approved, you receive:
- **Merchant ID**: Unique identifier
- **API Key/Secret**: Authentication credentials
- **API Documentation**: Endpoints, payload formats, error codes
- **Sandbox Access**: Test environment with test accounts
- **Technical Support**: Dedicated integration support

**Expected API Capabilities**:
- Payment initiation (STK Push/USSD Push)
- Transaction status queries
- Balance inquiry
- Webhook callbacks for payment confirmations
- Refund/reversal endpoints

---

#### EcoCash API Contact Information

| Contact Method | Details |
|----------------|---------|
| **Customer Helpline** | 114 or +263 772 023 000 |
| **Business Line** | +263 4 486121/66, +263 4 486120, +263 4 486867 |
| **WhatsApp** | +263 771 222 904 or +263 777 222 430 |
| **Email** | ecocashhelp@econet.co.zw |
| **Self-Service Portal** | [partnerapplications.ecocash.co.zw](https://partnerapplications.ecocash.co.zw/) |
| **Physical Address** | 1906 Borrowdale Road, Borrowdale, Harare |
| **Website** | [ecocash.co.zw](https://ecocash.co.zw) |

---

#### Expected API Structure (Industry Standard)

**Note**: This is estimated based on similar mobile money APIs (M-Pesa, MTN MoMo). Actual EcoCash API may differ.

**Payment Initiation** (STK Push):
```http
POST https://api.ecocash.co.zw/v1/payments/initiate
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}

{
  "merchantId": "LYNIA001",
  "customerPhone": "263771234567",
  "amount": 50.00,
  "currency": "USD",
  "reference": "LOAN-INV-12345",
  "description": "Phone Deposit - Samsung A14",
  "callbackUrl": "https://lynia.co.zw/api/webhooks/ecocash"
}
```

**Expected Response**:
```json
{
  "success": true,
  "transactionId": "EC-789456",
  "merchantReference": "LOAN-INV-12345",
  "status": "PENDING",
  "message": "USSD push sent to customer",
  "timestamp": "2025-11-12T10:30:00Z"
}
```

**Webhook Callback** (Payment Confirmation):
```http
POST https://lynia.co.zw/api/webhooks/ecocash
Content-Type: application/json
X-Signature: {HMAC_SHA256_SIGNATURE}

{
  "transactionId": "EC-789456",
  "merchantReference": "LOAN-INV-12345",
  "amount": 50.00,
  "currency": "USD",
  "status": "SUCCESS",
  "customerPhone": "263771234567",
  "paymentMethod": "ECOCASH_WALLET",
  "timestamp": "2025-11-12T10:32:15Z",
  "signature": "abc123def456..."
}
```

---

#### EcoCash API Costs (Estimated)

| Fee Type | Estimated Amount | Notes |
|----------|------------------|-------|
| **Merchant Setup** | $0 - $100 | One-time fee |
| **Monthly Fee** | $0 - $50 | Account maintenance |
| **Transaction Fee** | 1-3% | Per successful transaction |
| **API Access** | $0 - $200/month | Technical support & infrastructure |
| **Integration Support** | $500 - $2,000 | One-time consulting (optional) |

**Note**: Actual fees negotiable based on transaction volume and partnership terms.

---

### 1.2 O'mari Direct API

#### Application Process

**Step 1: Become an O'mari Merchant**

**Timeline**: 4-6 weeks

**Required Documents**:
1. **Company Documents**:
   - Resolution from Board of Directors approving merchant appointment
   - Certified copy of CR6 (Formerly CR14)
   - Certificate of Incorporation
   - Company Constitution/Memorandum & Articles

2. **Tax & Licenses**:
   - Tax Clearance Certificate (ZIMRA)
   - Company's trading shop licence
   - Business licenses for all branches

3. **Financial Documents**:
   - Bank statements for past 3 months
   - Proof of business premises address

4. **Director Information**:
   - National IDs of all directors (certified)
   - Proof of residence for directors
   - List of all branches with addresses

**Submission**:
- Visit Old Mutual branch in person
- Or email to: contactus@oldmutual.co.zw or omari@oldmutual.co.zw
- Physical address: 100 The Chase, Emerald Hill, Harare

---

**Step 2: Request API Integration**

After merchant approval, request developer/API access.

**Process**:
1. Contact Old Mutual Digital Services (OMDS) technical team
2. Request API documentation and integration support
3. Describe use case (loan payments, device financing)
4. Provide technical requirements and expected volume

**Review Period**: 2-3 weeks

---

**Step 3: API Credentials & Documentation**

Once approved, you receive:
- **Merchant Code**: Unique identifier (5-6 digits)
- **API Key**: Authentication token
- **API Documentation**: Likely JSON REST API (modern platform)
- **Sandbox/Test Environment**: For integration testing
- **Technical Support Contact**: Integration assistance

---

#### O'mari API Contact Information

| Contact Method | Details |
|----------------|---------|
| **Toll-Free** | 433 or 466 |
| **Landline** | +263 24 2308400 |
| **SIP Lines** | 08677007437, 08677222445 |
| **WhatsApp** | 0719433433, 0780040219 |
| **Email** | contactus@oldmutual.co.zw<br/>omari@oldmutual.co.zw<br/>information@oldmutual.co.zw |
| **Physical Address** | 100 The Chase, Emerald Hill, Harare |
| **Website** | [oldmutual.co.zw/omari](https://www.oldmutual.co.zw/omari/) |

---

#### Expected API Structure (Estimated)

**Note**: O'mari launched in 2023, likely follows modern REST API standards.

**Payment Initiation**:
```http
POST https://api.omari.co.zw/v1/payments
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "merchantCode": "OM12345",
  "customerPhone": "263774707707",
  "amount": 50.00,
  "currency": "USD",
  "reference": "LOAN-INV-12345",
  "description": "Phone Deposit",
  "callbackUrl": "https://lynia.co.zw/api/webhooks/omari"
}
```

**Expected Response**:
```json
{
  "success": true,
  "transactionId": "OM-456789",
  "merchantReference": "LOAN-INV-12345",
  "status": "PENDING",
  "message": "USSD prompt sent to *707#",
  "timestamp": "2025-11-12T10:30:00Z"
}
```

**Webhook Callback**:
```http
POST https://lynia.co.zw/api/webhooks/omari
Content-Type: application/json
X-Omari-Signature: {SIGNATURE}

{
  "transactionId": "OM-456789",
  "merchantReference": "LOAN-INV-12345",
  "amount": 50.00,
  "currency": "USD",
  "status": "COMPLETED",
  "customerPhone": "263774707707",
  "timestamp": "2025-11-12T10:32:00Z",
  "signature": "xyz789abc123..."
}
```

---

#### O'mari API Costs (Estimated)

| Fee Type | Estimated Amount | Notes |
|----------|------------------|-------|
| **Merchant Setup** | $0 - $50 | One-time fee |
| **Monthly Fee** | $0 - $20 | Account maintenance |
| **Transaction Fee** | 1-2.5% | Competitive with EcoCash |
| **API Access** | $0 - $100/month | Platform support |

**Advantage**: O'mari currently offers **0% USD transaction fees** (promotional), which could reduce costs significantly.

---

### 1.3 Direct API Pros & Cons

#### Pros ✅

1. **Lower Transaction Fees**: 1-3% vs 3.5% for gateways (Paynow)
2. **Direct Control**: No intermediary dependencies
3. **Faster Settlements**: Direct payouts to your bank account
4. **Better Customer Experience**: Pre-select payment method (no Paynow redirect)
5. **Custom Integration**: Tailored to Lynia Finance needs
6. **WhatsApp Integration**: Seamless USSD push from WhatsApp bot
7. **Data Ownership**: Full access to transaction data
8. **Branding**: Customer sees "LYNIA FINANCE" not "PAYNOW"

#### Cons ❌

1. **Long Approval Process**: 3-6 months total
2. **Complex Application**: Extensive documentation required
3. **No Public API Docs**: Must apply first to see API specs
4. **Development Time**: 4-8 weeks for full integration
5. **Maintenance Burden**: Handle API updates, errors, retries
6. **Higher Initial Cost**: Integration consulting, testing
7. **Risk**: May be rejected or delayed indefinitely
8. **Two Separate Integrations**: EcoCash + O'mari = double work

---

## Pathway 2: USSD Aggregator (ZimSwitch)

### Overview

**ZimSwitch Shared Services (ZSS)** acts as a USSD aggregator, allowing banks and financial institutions to access mobile money networks (Econet, NetOne, Telecel) through a single integration point.

**ZimSwitch** is Zimbabwe's designated national payment platform, mandated by the Reserve Bank of Zimbabwe (RBZ) for all money transmission agents.

---

### 2.1 ZIPIT Platform

**ZIPIT** (Zimswitch Instant Payment Interchange Technology) enables:
- Instant bank-to-bank transfers
- Bank account to mobile money transfers
- Mobile money to bank account transfers
- Works across all networks (Econet, NetOne, Telecel)

**Use Case for Lynia Finance**:
- Customers pay loan deposits via ZIPIT from their bank accounts
- Lynia Finance receives funds directly to bank account
- Bypasses mobile money wallet intermediaries

---

### 2.2 ZimSwitch Integration Process

**Eligibility**:
- Must be a **registered financial institution** or **money transmission agent**
- Requires RBZ approval/license
- Typically for banks, microfinance institutions, or licensed fintechs

**Process**:
1. **Obtain Money Transmission License** from RBZ
2. **Apply to ZimSwitch** for membership
3. **Technical Integration**:
   - Connect to ZimSwitch Shared Services platform
   - Implement USSD gateway interface
   - Test with ZimSwitch sandbox environment
4. **Certification & Go-Live**:
   - Pass ZimSwitch security audit
   - Undergo transaction testing
   - Production deployment

**Timeline**: 4-8 months (including RBZ licensing)

---

### 2.3 ZimSwitch Contact Information

| Contact Method | Details |
|----------------|---------|
| **Website** | [zimswitch.co.zw](https://www.zimswitch.co.zw/) (if available) |
| **Regulatory Body** | Reserve Bank of Zimbabwe (RBZ) |
| **Integration** | Contact via member banks or RBZ |

**Member Banks** (can facilitate ZimSwitch access):
- CBZ Bank
- CABS
- FBC Bank
- Stanbic Bank
- ZB Bank
- NMB Bank

---

### 2.4 ZimSwitch Pros & Cons

#### Pros ✅

1. **Single Integration Point**: Access all mobile money networks (EcoCash, OneMoney, Telecash)
2. **Bank-Grade Infrastructure**: Reliable, high-volume processing
3. **Regulatory Compliance**: RBZ-mandated, fully compliant
4. **ZIPIT Access**: Enable bank transfers alongside mobile money
5. **Interoperability**: Customers can pay from any bank or mobile wallet

#### Cons ❌

1. **Requires RBZ License**: Money transmission license required (lengthy process)
2. **High Entry Barrier**: Designed for banks/financial institutions
3. **Complex Integration**: Technical complexity similar to banking systems
4. **Costs**: Membership fees, transaction fees, infrastructure costs
5. **Overkill for Lynia Finance**: Too complex for device financing startup
6. **Long Timeline**: 4-8 months minimum

**Verdict**: **Not recommended for Lynia Finance MVP**. Better suited for banks or large-scale fintechs.

---

## Pathway 3: Agent Network Integration

### Overview

Leverage existing EcoCash/O'mari **agent networks** to manually collect payments from customers without API integration.

**How it Works**:
1. Customer completes loan application via WhatsApp
2. Lynia Finance provides payment instructions (agent location, reference code)
3. Customer visits EcoCash/O'mari agent in person
4. Agent processes payment manually
5. Lynia Finance receives confirmation (SMS, agent report)
6. Manual reconciliation and loan activation

---

### 3.1 EcoCash Agent Network

**Network Size**: 60,000+ agents nationwide

**Agent Types**:
1. **Retail Agents**: Shops, supermarkets, pharmacies
2. **Mobile Agents**: Individuals with agent accounts
3. **Econet Shops**: Official Econet retail stores

**Agent Services**:
- Cash in (deposit to EcoCash wallet)
- Cash out (withdraw from wallet)
- Merchant payments
- Money transfers

---

### 3.2 O'mari Agent Network

**Network Size**: 5,000+ agents (growing)

**Agent Locations**:
- Old Mutual branches
- Partner retail locations
- Mobile agents

**Services**: Same as EcoCash (cash in, cash out, payments)

---

### 3.3 Manual Collection Process

**Step 1: Customer Notification**

After loan qualification, send WhatsApp message:

```plaintext
✅ Loan Approved!

Amount: $200
Deposit Required: $50
Reference: LYNIA-INV-12345

📍 Payment Instructions:

Option 1: EcoCash Agent
- Visit nearest EcoCash agent
- Say "Deposit to merchant"
- Merchant Code: 123456
- Reference: LYNIA-INV-12345
- Amount: $50

Option 2: O'mari Agent
- Visit nearest O'mari agent
- Provide reference: LYNIA-INV-12345
- Amount: $50

⏱️ Complete payment within 24 hours.

Once paid, send "PAID" to confirm.
```

---

**Step 2: Agent Collection**

**EcoCash Agent Process**:
1. Customer provides Lynia Finance merchant code
2. Agent enters transaction on POS/phone
3. Customer enters EcoCash PIN
4. Payment sent to Lynia merchant wallet
5. Customer receives SMS confirmation

**O'mari Agent Process**:
1. Customer provides reference number
2. Agent processes payment via O'mari system
3. Customer enters O'mari PIN
4. Payment sent to Lynia merchant account
5. SMS confirmation

---

**Step 3: Reconciliation**

**Manual Method**:
1. Daily export of EcoCash/O'mari merchant account transactions
2. Match transactions to loan references
3. Update loan status in database
4. Send WhatsApp confirmation to customer

**SMS Parsing Method**:
1. Connect EcoCash/O'mari merchant phone to server
2. Parse incoming SMS confirmations
3. Extract reference + amount
4. Auto-update database
5. Trigger WhatsApp confirmation

---

### 3.4 Agent Network Pros & Cons

#### Pros ✅

1. **Immediate Start**: No API approval needed (2-4 weeks to merchant status)
2. **Simple Setup**: Just merchant account, no development
3. **No Integration Costs**: No API development or maintenance
4. **Low Risk**: Proven process used by many small businesses
5. **Good for MVP**: Test market demand before investing in API
6. **Manual Control**: Review every transaction
7. **Works Offline**: No dependency on API uptime

#### Cons ❌

1. **Manual Reconciliation**: Labor-intensive, error-prone
2. **Slow Confirmation**: Hours to days vs instant API
3. **Poor Customer Experience**: Extra step (visit agent)
4. **Doesn't Scale**: Unsustainable for 100+ transactions/day
5. **No WhatsApp Integration**: Can't auto-confirm payments
6. **Agent Errors**: Wrong amounts, lost references
7. **Fraud Risk**: Fake payment confirmations

**Verdict**: **Good for MVP testing (first 50-100 loans)**, but must transition to API for scale.

---

### 3.5 Agent Network Implementation

#### Phase 1: Merchant Account Setup

**EcoCash Merchant**:
1. Apply as merchant (4-6 weeks)
2. Receive merchant code (5-6 digits)
3. Share code with customers for payments
4. Access daily transaction reports via merchant portal

**O'mari Merchant**:
1. Apply as merchant (4-6 weeks)
2. Receive merchant code
3. Configure QR code for payments (optional)
4. Access transaction dashboard

---

#### Phase 2: Payment Instructions

**Create Standard WhatsApp Template**:
```javascript
function generatePaymentInstructions(loan) {
  return `
✅ Loan Approved - ${loan.phoneModel}

Deposit Required: $${loan.depositAmount}
Reference: ${loan.reference}

💳 Payment Options:

1️⃣ EcoCash Agent:
   - Visit any EcoCash agent
   - Merchant Code: 123456
   - Reference: ${loan.reference}
   - Amount: $${loan.depositAmount}

2️⃣ O'mari Agent:
   - Visit any O'mari agent
   - Dial *707# → Pay Merchant → LYNIA
   - Reference: ${loan.reference}
   - Amount: $${loan.depositAmount}

⏱️ Complete payment within 24 hours.

Once paid, reply "PAID" to notify us.
We'll confirm within 1-2 hours.
  `.trim();
}
```

---

#### Phase 3: Reconciliation System

**Daily Reconciliation Script**:
```javascript
// Check EcoCash merchant account
async function reconcileEcoCashPayments() {
  // 1. Export transaction CSV from EcoCash merchant portal
  const transactions = await downloadEcoCashReport();

  // 2. Parse transactions
  for (const txn of transactions) {
    const { reference, amount, phone, timestamp } = txn;

    // 3. Match to loan
    const loan = await db.loans.findOne({ reference });

    if (loan && !loan.depositPaid) {
      // 4. Verify amount matches
      if (amount === loan.depositAmount) {
        // 5. Update loan status
        await db.loans.update({ reference }, {
          depositPaid: true,
          paidAt: timestamp,
          paymentMethod: 'ecocash_agent',
          status: 'deposit_paid'
        });

        // 6. Send WhatsApp confirmation
        await sendWhatsAppMessage(loan.customerPhone, `
✅ Payment Confirmed!

Amount: $${amount}
Reference: ${reference}

Your deposit has been received. You can now collect your phone.

📍 Collection: [Distributor Address]
⏰ Hours: Mon-Fri 8am-5pm

Bring your National ID.
        `.trim());

        console.log(`Payment confirmed: ${reference}`);
      } else {
        // Amount mismatch, flag for manual review
        await flagForReview(loan, amount, 'amount_mismatch');
      }
    }
  }
}

// Run reconciliation every hour
setInterval(reconcileEcoCashPayments, 3600000);
```

---

## Pathway 4: Hybrid Approach (Recommended)

### Overview

Combine **Agent Network** (short-term) with **Direct API** (long-term) for best of both worlds.

**Strategy**:
- **Phase 0 (Weeks 1-8)**: Use agent network for MVP testing
- **Phase 1 (Months 2-6)**: Apply for EcoCash/O'mari APIs in parallel
- **Phase 2 (Months 6+)**: Transition to full API integration

---

### 4.1 Hybrid Implementation Timeline

| Phase | Duration | Integration Method | Transaction Volume | Focus |
|-------|----------|-------------------|-------------------|-------|
| **Phase 0: MVP** | Weeks 1-8 | Agent Network (manual) | 50-100 loans | Market validation |
| **Phase 1: Growth** | Months 2-6 | Agent + API Application | 100-500 loans | Scale testing |
| **Phase 2: Scale** | Months 6-12 | Full API Integration | 500-2,000 loans | Automation |
| **Phase 3: Mature** | Year 2+ | Multi-provider APIs | 2,000+ loans | Optimization |

---

### 4.2 Phase 0: Agent Network (Weeks 1-8)

**Objective**: Validate market demand with minimal investment

**Tasks**:
1. ✅ Apply for EcoCash merchant account (Week 1)
2. ✅ Apply for O'mari merchant account (Week 1)
3. ✅ Build WhatsApp bot with payment instructions (Weeks 2-4)
4. ✅ Create manual reconciliation process (Week 4)
5. ✅ Onboard 1-2 distributors for asset handover (Week 4)
6. ✅ Launch MVP with first 10 customers (Week 5)
7. ✅ Iterate based on feedback (Weeks 6-8)

**Success Criteria**:
- 50-100 loans processed
- 70%+ deposit payment completion rate
- Manual reconciliation < 2 hours/day
- Customer satisfaction > 80%

---

### 4.3 Phase 1: Parallel API Application (Months 2-6)

**Objective**: Apply for APIs while scaling agent network

**Tasks**:
1. ✅ Submit EcoCash API access request (Month 2)
2. ✅ Submit O'mari API access request (Month 2)
3. ✅ Continue agent network operations (ongoing)
4. ✅ Build automated reconciliation tools (Month 3)
5. ⏳ Wait for API approval (Months 2-6)
6. ✅ Prepare API integration codebase (Month 5)
7. ✅ Test in sandbox once API access granted (Month 6)

**Success Criteria**:
- API applications submitted
- 100-500 loans processed via agent network
- Automated reconciliation reduces manual work to 30 minutes/day
- API access granted by Month 6

---

### 4.4 Phase 2: API Integration (Months 6-12)

**Objective**: Transition from manual to automated payments

**Tasks**:
1. ✅ Integrate EcoCash API (Weeks 1-4)
2. ✅ Integrate O'mari API (Weeks 5-8)
3. ✅ A/B test: 20% API, 80% agent network (Week 9-10)
4. ✅ Monitor success rates, errors, customer feedback (Week 11-12)
5. ✅ Increase API traffic: 50/50 split (Month 8)
6. ✅ Full cutover: 100% API (Month 9)
7. ✅ Deprecate agent network (keep as backup) (Month 10)

**Success Criteria**:
- 95%+ payment success rate via API
- <5 second USSD push delivery time
- Automated webhook processing
- 500-2,000 loans processed
- Manual work reduced to exception handling only

---

### 4.5 Phase 3: Optimization (Year 2+)

**Objective**: Optimize for cost, speed, reliability

**Tasks**:
- Negotiate volume discounts with EcoCash/O'mari
- Implement intelligent payment routing (cheapest provider)
- Add fallback mechanisms (if API down, use agent)
- Build payment analytics dashboard
- Expand to other payment methods (Visa/Mastercard, OneMoney)

---

## Cost-Benefit Analysis

### Total Cost of Ownership (3 Years)

| Approach | Year 1 | Year 2 | Year 3 | 3-Year Total |
|----------|--------|--------|--------|--------------|
| **Agent Network Only** | $5,000 | $15,000 | $30,000 | **$50,000** |
| **Direct API Only** | $15,000 | $25,000 | $35,000 | **$75,000** |
| **Hybrid** (Recommended) | $8,000 | $22,000 | $33,000 | **$63,000** |
| **Paynow Gateway** | $10,000 | $35,000 | $70,000 | **$115,000** |

**Assumptions**:
- Year 1: 1,000 loans ($50K volume)
- Year 2: 5,000 loans ($250K volume)
- Year 3: 10,000 loans ($500K volume)

---

### Cost Breakdown: Hybrid Approach

**Year 1** ($8,000):
- Merchant setup fees: $150
- Manual reconciliation (6 months @ $500/month): $3,000
- API integration development: $3,000
- Transaction fees (500 loans @ 2% avg): $500
- Infrastructure: $1,000
- Buffer: $350

**Year 2** ($22,000):
- API transaction fees (5,000 loans @ 2%): $12,500
- API platform fees: $1,200
- Infrastructure scaling: $3,000
- Support & maintenance: $5,000
- Buffer: $300

**Year 3** ($33,000):
- API transaction fees (10,000 loans @ 1.5% negotiated): $18,750
- API platform fees: $2,400
- Infrastructure: $5,000
- Support & maintenance: $6,000
- Buffer: $850

---

### Comparison: Gateway vs Direct Integration

**At 10,000 Transactions/Year** ($500K volume):

| Provider | Transaction Fee | Annual Cost | Savings vs Gateway |
|----------|----------------|-------------|-------------------|
| **Paynow Gateway** | 3.5% | $17,500 | Baseline |
| **Direct EcoCash API** | 2% | $10,000 | **$7,500 saved** |
| **Direct O'mari API** | 1.5% | $7,500 | **$10,000 saved** |
| **Hybrid (both)** | 1.75% avg | $8,750 | **$8,750 saved** |

**Break-Even Analysis**:
- API integration cost: $3,000
- Annual savings: $8,750
- **Break-even: 4 months** at 10K transactions/year

---

## Implementation Roadmap

### Recommended Phased Approach

```plaintext
Month 1-2: MVP Prep
├── Week 1-2: Apply for EcoCash merchant
├── Week 2-3: Apply for O'mari merchant
├── Week 3-4: Build WhatsApp bot (payment instructions)
├── Week 5-6: Create manual reconciliation process
├── Week 7-8: Test with 10-20 pilot customers
└── Deliverable: Working agent-based payment system

Month 3-4: API Application
├── Week 9-10: Submit EcoCash API access request
├── Week 10-11: Submit O'mari API access request
├── Week 11-12: Build automated reconciliation tools
├── Week 13-16: Scale agent network (100+ loans)
└── Deliverable: API applications submitted, 100+ loans processed

Month 5-6: API Preparation
├── Week 17-20: Design API integration architecture
├── Week 20-22: Build API client libraries (EcoCash, O'mari)
├── Week 22-24: Implement webhook handlers
└── Deliverable: API integration codebase ready

Month 7-8: API Integration (if approved)
├── Week 25-28: Integrate EcoCash API
├── Week 29-32: Integrate O'mari API
├── Week 32: A/B testing (20% API, 80% agent)
└── Deliverable: Working API integration

Month 9-12: Full Cutover
├── Week 33-36: Increase API traffic to 50%
├── Week 37-40: Increase API traffic to 80%
├── Week 41-44: Full cutover to 100% API
├── Week 45-52: Monitor, optimize, negotiate better rates
└── Deliverable: Fully automated payment system
```

---

## References & Contacts

### EcoCash

**Official Website**: [ecocash.co.zw](https://ecocash.co.zw)

**Merchant Portal**: [partnerapplications.ecocash.co.zw](https://partnerapplications.ecocash.co.zw)

**Contact**:
- Customer Helpline: 114 or +263 772 023 000
- Business Line: +263 4 486121/66
- WhatsApp: +263 771 222 904
- Email: ecocashhelp@econet.co.zw
- Address: 1906 Borrowdale Road, Borrowdale, Harare

---

### O'mari

**Official Website**: [oldmutual.co.zw/omari](https://www.oldmutual.co.zw/omari/)

**Contact**:
- Toll-Free: 433 or 466
- Landline: +263 24 2308400
- WhatsApp: 0719433433, 0780040219
- Email: contactus@oldmutual.co.zw, omari@oldmutual.co.zw
- Address: 100 The Chase, Emerald Hill, Harare

---

### ZimSwitch

**Regulatory Body**: Reserve Bank of Zimbabwe (RBZ)

**Contact**: Through member banks (CBZ, CABS, FBC, Stanbic, ZB Bank, NMB)

---

### Industry Resources

- **Techzim**: [techzim.co.zw](https://www.techzim.co.zw) - Zimbabwe tech news
- **Zimpricecheck**: [zimpricecheck.com](https://zimpricecheck.com) - Mobile money guides
- **Paynow Blog**: [paynow.co.zw/blog](https://paynow.co.zw/blog) - Payment integration tutorials

---

## Appendices

### Appendix A: Merchant Application Checklist

**EcoCash Merchant Application**:
- [ ] Download application form
- [ ] Certificate of Incorporation (certified)
- [ ] CR6/CR14 (certified)
- [ ] Business license (certified)
- [ ] Tax clearance certificate
- [ ] Bank statements (3 months)
- [ ] Proof of business address
- [ ] National IDs of directors (certified)
- [ ] Proof of residence for directors
- [ ] Submit to Econet Shop or email

**O'mari Merchant Application**:
- [ ] Board Resolution for merchant appointment
- [ ] CR6 (certified)
- [ ] Certificate of Incorporation
- [ ] Tax clearance certificate
- [ ] Trading shop licence
- [ ] Bank statements (3 months)
- [ ] Director IDs and proof of residence
- [ ] List of all branches
- [ ] Submit to Old Mutual branch or email

---

### Appendix B: API Integration Checklist

**Pre-Integration**:
- [ ] Merchant account approved
- [ ] API access granted
- [ ] API documentation received
- [ ] Sandbox credentials provided
- [ ] Webhook endpoint deployed (HTTPS)

**Development**:
- [ ] Build API client library
- [ ] Implement authentication (OAuth/API key)
- [ ] Implement payment initiation
- [ ] Implement webhook handler
- [ ] Implement signature verification
- [ ] Implement error handling & retries
- [ ] Build status polling (fallback)

**Testing**:
- [ ] Test payment initiation (sandbox)
- [ ] Test webhook callbacks
- [ ] Test signature verification
- [ ] Test error scenarios
- [ ] Test idempotency
- [ ] Load testing (100+ concurrent requests)

**Production**:
- [ ] Switch to production credentials
- [ ] Deploy to production environment
- [ ] Configure monitoring & alerts
- [ ] A/B test with small traffic %
- [ ] Gradual rollout to 100%
- [ ] Monitor success rates & errors

---

### Appendix C: Sample Code Snippets

**WhatsApp Payment Instructions** (Agent Network):
```javascript
async function sendPaymentInstructions(loan) {
  const message = `
✅ Loan Approved!

Phone: ${loan.phoneModel}
Deposit: $${loan.depositAmount}
Reference: ${loan.reference}

💳 Payment Options:

1️⃣ EcoCash Agent:
   - Visit any EcoCash agent
   - Merchant Code: ${ECOCASH_MERCHANT_CODE}
   - Reference: ${loan.reference}
   - Amount: $${loan.depositAmount}

2️⃣ O'mari Agent (*707#):
   - Visit any O'mari agent
   - Pay Merchant → LYNIA FINANCE
   - Reference: ${loan.reference}
   - Amount: $${loan.depositAmount}

⏱️ Complete within 24 hours.
Reply "PAID" when done.
  `.trim();

  await sendWhatsAppMessage(loan.customerPhone, message);
}
```

**API Payment Initiation** (Future):
```javascript
async function initiateEcoCashPayment(loan) {
  try {
    const response = await ecocashAPI.payments.create({
      merchantId: process.env.ECOCASH_MERCHANT_ID,
      customerPhone: loan.customerPhone,
      amount: loan.depositAmount,
      currency: 'USD',
      reference: loan.reference,
      description: `Deposit - ${loan.phoneModel}`,
      callbackUrl: `${process.env.API_BASE_URL}/webhooks/ecocash`
    });

    if (response.success) {
      await sendWhatsAppMessage(loan.customerPhone, `
💳 Payment Request Sent!

Amount: $${loan.depositAmount}
Reference: ${loan.reference}

Check your phone for EcoCash payment prompt (*151#).
Enter your PIN to confirm.

⏱️ Prompt expires in 2 minutes.
      `.trim());

      return { success: true, transactionId: response.transactionId };
    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    console.error('EcoCash payment initiation failed:', error);
    return { success: false, error: error.message };
  }
}
```

---

**Research Status**: ✅ Complete
**Recommended Approach**: Hybrid (Agent Network → Direct API)
**Timeline**: 3-6 months to full API integration
**Next Steps**: Apply for EcoCash & O'mari merchant accounts, build agent-based MVP
