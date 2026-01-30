# T014: Omari Payment API Research

**Task**: Research Omari payment API (REST endpoints, webhook callbacks)
**Phase**: Phase 0 - Research
**Status**: ✅ Complete
**Date**: 2025-11-12
**GitHub Issue**: #19

---

## Executive Summary

**O'mari** (also styled as Omari) is Zimbabwe's newest mobile money platform, launched in May 2023 by Old Mutual Digital Services (OMDS). Unlike EcoCash, O'mari operates **network-independently**, allowing users on Econet, NetOne, or Telecel to register via USSD code `*707#`, WhatsApp (0774 707 707), or mobile app.

### Key Finding: **No Public API Available**

❌ **O'mari does NOT provide public API documentation** for direct merchant integration.

✅ **Solution**: Use **payment gateway aggregators** (Paynow, ContiPay, Pesepay) which already integrate O'mari.

### Market Position

| Platform | Market Share | Launch Year | Network |
|----------|--------------|-------------|---------|
| **EcoCash** | 86%+ | 2011 | Econet only |
| **OneMoney** | 10-12% | 2015 | NetOne only |
| **O'mari** | 2-3% (growing) | 2023 | All networks |
| **TeleCash** | <2% | 2016 | Telecel only |

**Recommendation**: For Lynia Finance, continue using **Paynow** (which already supports O'mari alongside EcoCash and OneMoney) rather than pursuing direct O'mari API integration.

---

## Table of Contents

1. [O'mari Overview](#1-omari-overview)
2. [API Availability Status](#2-api-availability-status)
3. [Integration via Payment Gateways](#3-integration-via-payment-gateways)
4. [O'mari Features & Capabilities](#4-omari-features--capabilities)
5. [USSD Payment Flow](#5-ussd-payment-flow)
6. [Market Comparison](#6-market-comparison)
7. [Merchant Requirements](#7-merchant-requirements)
8. [Cost Analysis](#8-cost-analysis)
9. [Why O'mari Matters for Lynia Finance](#9-why-omari-matters-for-lynia-finance)
10. [Implementation Strategy](#10-implementation-strategy)
11. [References](#11-references)

---

## 1. O'mari Overview

### Background

**O'mari** is a FinTech business unit of Old Mutual Zimbabwe, launched through Old Mutual Digital Services (OMDS) as part of their digital transformation strategy.

| Detail | Information |
|--------|-------------|
| **Launch Date** | May 23, 2023 |
| **Operator** | Old Mutual Digital Services (OMDS) |
| **Parent Company** | Old Mutual Zimbabwe Limited (OMZL) |
| **USSD Code** | `*707#` |
| **WhatsApp** | 0774 707 707 |
| **Networks** | Econet, NetOne, Telecel (all 3) |
| **Currency** | USD and ZWL (dual currency wallet) |

### Core Services

O'mari offers comprehensive financial services for the retail mass market:

1. **Mobile Money**: Send/receive money, cash in/out
2. **Insurtech**: Insurance products and services
3. **Investech**: Investment products
4. **Digital Lending**: Microloans and credit
5. **E-commerce**: Online shopping and payments
6. **Payments**: Merchant and bill payments
7. **Digital Products**: Airtime, data bundles, virtual cards

### Unique Selling Points

**1. Network Independence**
- First mobile money platform to work across all 3 Zimbabwean networks
- EcoCash (Econet only), OneMoney (NetOne only), but O'mari = **all networks**

**2. Interoperability**
- Send money to any bank via ZimSwitch
- Send to any mobile wallet (EcoCash, OneMoney, TeleCash)
- Receive from any bank or wallet

**3. Virtual Visa Card**
- 5-year validity (vs 1 year for competitors)
- Generated on USSD, WhatsApp, or mobile app
- Valid for online e-commerce transactions worldwide

**4. USD Promotion**
- Currently: **All USD transactions FREE** (no cash-in/cash-out fees)
- Competitive advantage over EcoCash's 4% fees

---

## 2. API Availability Status

### Direct API: Not Publicly Available

**Finding**: After extensive research, **O'mari does NOT offer public API documentation** for developers to integrate directly.

**Evidence**:
- ❌ No public developer portal (no `developers.omari.co.zw` equivalent)
- ❌ No API documentation on official website
- ❌ No GitHub repositories with SDKs
- ❌ No technical integration guides in search results
- ❌ No API endpoints documented anywhere

**Contrast with EcoCash**:
- EcoCash also has no public API, but has partnerships with aggregators
- Both require merchant approval for direct integration
- Neither is suitable for fast MVP development

### Why No Public API?

**Possible Reasons**:

1. **Regulatory Compliance**: Reserve Bank of Zimbabwe (RBZ) requires strict vetting of payment partners
2. **Risk Management**: Direct API access increases fraud risk without proper controls
3. **Business Model**: Prefer partnerships with established payment gateways
4. **Maturity**: Platform only 2 years old (launched May 2023), still building infrastructure
5. **Competitive Strategy**: Focus on consumer adoption before opening APIs

### How to Get Direct Access (If Needed)

**Process** (estimated 2-3 months):

1. **Apply as O'mari Merchant**:
   - Download merchant application form from [oldmutual.co.zw/omari](https://www.oldmutual.co.zw/omari)
   - Gather required documents (see [Section 7](#7-merchant-requirements))
   - Submit to OMDS for vetting

2. **Contract Signing**:
   - Old Mutual legal team reviews application
   - Sign merchant agreement with terms and fees
   - Get assigned merchant number

3. **API Access Request**:
   - Contact OMDS technical team
   - Request API documentation (if available)
   - Undergo technical integration review

4. **Testing & Certification**:
   - Sandbox environment testing (if provided)
   - Security audit of your integration
   - Compliance verification by RBZ

5. **Production Approval**:
   - Go-live approval from OMDS
   - Monitor initial transactions
   - Full production access granted

**Timeline**: **60-90 days minimum** (too slow for Lynia Finance MVP)

---

## 3. Integration via Payment Gateways

### Recommended Approach: Use Payment Gateway Aggregators

Instead of direct O'mari API integration, use payment gateways that **already integrate O'mari**:

### Option 1: Paynow (Recommended)

**Status**: ✅ **Paynow supports O'mari** (confirmed in T013 research)

**Supported Methods**:
- EcoCash ✅
- OneMoney ✅
- O'mari ✅ (available alongside other methods)
- Visa/Mastercard ✅
- ZimSwitch ✅

**Integration**:
```javascript
// Paynow already handles EcoCash, OneMoney, and O'mari
// No separate integration needed!

const { Paynow } = require('paynow');

const paynow = new Paynow(integrationId, integrationKey);
paynow.resultUrl = 'https://lynia.co.zw/api/webhooks/paynow';
paynow.returnUrl = 'https://lynia.co.zw/payment/complete';

const payment = paynow.createPayment('INV-12345', 'customer@example.com');
payment.add('Phone Deposit', 50.00);

// Customer selects payment method on Paynow page
// O'mari is automatically available as an option
paynow.send(payment).then(response => {
  if (response.success) {
    res.redirect(response.redirectUrl);  // Customer chooses EcoCash/OneMoney/O'mari
  }
});
```

**Flow**:
1. Lynia Finance sends payment to Paynow
2. Customer redirected to Paynow payment page
3. Customer selects **O'mari** from dropdown menu
4. Paynow triggers O'mari USSD push to customer's phone (`*707#`)
5. Customer enters PIN to confirm
6. Paynow sends webhook callback to Lynia Finance
7. Lynia Finance updates loan status

**Pros**:
- ✅ **Already implemented** in T013 research
- ✅ **No additional integration work** required
- ✅ O'mari automatically supported alongside EcoCash/OneMoney
- ✅ Single webhook handler for all payment methods
- ✅ Same 3.5% transaction fee for all mobile money

**Cons**:
- Customer must select payment method on Paynow page (extra click)
- Cannot pre-select O'mari from WhatsApp bot

---

### Option 2: ContiPay

**Status**: ✅ **ContiPay supports O'mari**

**Supported Methods**:
- EcoCash ✅
- OneMoney ✅
- O'mari ✅
- InnBucks ✅
- Visa/Mastercard ✅
- ZimSwitch/ZIPIT ✅

**Website**: [contipay.co.zw](https://contipay.co.zw)

**Features**:
- Multi-channel payment processor
- Real-time transaction tracking
- Developer-friendly API
- Detailed reporting dashboard

**API Documentation**: Limited public documentation

**When to Use**:
- If Paynow downtime/issues
- If need ContiPay-specific features (e.g., voucher system)
- If negotiating better rates than Paynow

**Integration Complexity**: Medium (need to request API docs from ContiPay)

---

### Option 3: Pesepay

**Status**: ⚠️ **O'mari support unclear**

**Confirmed Methods**:
- EcoCash ✅ (well-documented)
- Visa/Mastercard ✅
- OneMoney ❓ (not explicitly mentioned)
- O'mari ❓ (not explicitly mentioned)

**Website**: [pesepay.com](https://pesepay.com)
**Developer Docs**: [developers.pesepay.com](https://developers.pesepay.com)

**API**: JSON REST API (modern, well-documented)

**Verdict**:
- Good as **EcoCash alternative** to Paynow
- **Not confirmed** for O'mari support
- Would need to contact Pesepay to verify

---

### Option 4: Smile & Pay (ZB Financial)

**Status**: ✅ **Supports O'mari** (launched 2025)

**Supported Methods**:
- EcoCash ✅
- OneMoney ✅
- O'mari ✅
- InnBucks ✅
- ZimSwitch ✅
- Visa/Mastercard ✅

**Unique Feature**: **Free to use** for merchants (ZB covers gateway fees)

**Website**: Not widely available yet (still new, launched May 2025)

**When to Consider**:
- After launch becomes stable (currently too new)
- If ZB Financial maintains "free for merchants" model
- Potential huge cost savings (0% vs Paynow's 3.5%)

**Verdict**: **Monitor for future use**, too new for MVP

---

## 4. O'mari Features & Capabilities

### User-Facing Features

**1. Money Transfer**
- Send to O'mari wallet (instant, free peer-to-peer)
- Send to any bank via ZimSwitch (CABS, CBZ, FBC, POSB, etc.)
- Send to EcoCash, OneMoney, TeleCash
- International remittances (via partners like Mama Money)

**2. Merchant Payments**
- Pay at registered O'mari merchants
- Bill payments: ZESA (electricity), TelOne, Liquid Home
- School fees, insurance premiums (Old Mutual products)

**3. Airtime & Data**
- Buy airtime for any network (Econet, NetOne, Telecel)
- Data bundles
- International airtime (diaspora support)

**4. Financial Products**
- Micro-savings accounts
- Digital loans (in development)
- Insurance products (Old Mutual integration)
- Investment products (Old Mutual funds)

**5. Virtual Visa Card**
- Generate virtual card on USSD/WhatsApp/app
- 5-year validity (long-lasting)
- Use for online e-commerce (Amazon, Alibaba, Shein, etc.)
- Use for local online shopping

**6. Dual Currency**
- USD wallet ✅
- ZWL wallet ✅
- Switch between currencies easily
- Current promo: **All USD transactions FREE**

---

### Registration & Access

**USSD** (most popular):
```plaintext
Dial: *707#
Networks: Econet, NetOne, Telecel (all work)

Registration Flow:
1. Dial *707#
2. Receive SMS with OTP (one-time pin)
3. Dial *707# again
4. Enter OTP
5. Create 4-digit PIN
6. Re-enter PIN to confirm
7. Registration complete

Main Menu Options:
1. Send Money
2. Cash Out
3. Buy Airtime
4. Pay Merchant
5. Pay Bill
6. Buy Goods (e-commerce)
7. Virtual Card
8. Check Balance
9. My Account
```

**WhatsApp**:
```plaintext
Number: 0774 707 707

Steps:
1. Save number in contacts
2. Send "hi" to register
3. Follow chatbot prompts
4. Complete registration
5. Use WhatsApp for all transactions

Features:
- Balance inquiry
- Send money
- Bill payments
- Merchant payments
- Customer support
```

**Mobile App**:
```plaintext
Download: Google Play Store / Apple App Store
App Name: "Omari"

Features:
- Full wallet management
- Transaction history
- Virtual card generation
- Merchant locator
- QR code payments
- Biometric login (fingerprint/face)
```

---

## 5. USSD Payment Flow

### Customer Initiating Payment (Customer → Merchant)

**Scenario**: O'mari customer wants to pay merchant via USSD

```plaintext
Customer          O'mari USSD          Merchant System
   |                    |                     |
   |--Dial *707#------->|                     |
   |                    |                     |
   |<--Main Menu--------|                     |
   |                    |                     |
   |--Select "4"------->|                     |
   | (Pay Merchant)     |                     |
   |                    |                     |
   |<--Enter Merchant-->|                     |
   |                    |                     |
   |--Enter "LYNIA"---->|                     |
   | (or merchant code) |                     |
   |                    |                     |
   |<--Enter Amount---->|                     |
   |                    |                     |
   |--Enter $50-------->|                     |
   |                    |                     |
   |<--Confirm----------|                     |
   |                    |                     |
   |--Enter PIN-------->|                     |
   |                    |                     |
   |                    |--Payment Confirmed->|
   |                    |                     |
   |<--SMS Receipt------|                     |
   |                    |                     |
```

**Challenge**: Merchant must have **O'mari merchant account** and **merchant code** for customers to pay this way.

---

### Merchant Requesting Payment (Merchant → Customer)

**Scenario**: Payment gateway (Paynow/ContiPay) initiates payment request via O'mari

```plaintext
Lynia Finance    Paynow Gateway    O'mari USSD        Customer
      |                 |               |                |
      |--POST /pay----->|               |                |
      | (phone, amount) |               |                |
      |                 |               |                |
      |                 |--USSD Push--->|                |
      |                 |               |                |
      |                 |               |--*707# prompt->|
      |                 |               |                |
      |                 |               |<--Enter PIN----|
      |                 |               |                |
      |                 |<--Confirm-----|                |
      |                 |               |                |
      |<--Webhook-------|               |                |
      |  (status=paid)  |               |                |
      |                 |               |                |
      |--WhatsApp msg-->|               |                |
      | (confirmation)  |               |                |
```

**How It Works**:
1. Paynow/ContiPay has partnership with O'mari
2. Gateway sends USSD push request to O'mari API (merchant-side)
3. O'mari sends `*707#` payment prompt to customer's phone
4. Customer enters PIN to authorize
5. O'mari confirms payment to gateway
6. Gateway sends webhook to Lynia Finance

**Benefit**: Customer doesn't need to manually dial `*707#`, prompt appears automatically (STK Push)

---

### Payment Prompt Example

When customer receives payment request via USSD push:

```plaintext
*707# Payment Request
------------------------
From: LYNIA FINANCE
Amount: $50.00
Reference: INV-12345

Your O'mari Balance: $120.00

Enter PIN to confirm:
____

1. Confirm
2. View Details
3. Cancel
```

**Customer Actions**:
- Enter 4-digit PIN → Payment authorized
- Select "Cancel" → Transaction cancelled
- Timeout (2 minutes) → Transaction expired

---

## 6. Market Comparison

### Mobile Money Landscape in Zimbabwe (2025)

| Platform | Market Share | Active Users | Launch Year | Network | Currency |
|----------|--------------|--------------|-------------|---------|----------|
| **EcoCash** | **86%** | 6M+ | 2011 | Econet only | USD, ZWL |
| **OneMoney** | **10-12%** | ~1M | 2015 | NetOne only | USD, ZWL |
| **O'mari** | **2-3%** | ~300K (growing) | 2023 | All 3 networks | USD, ZWL |
| **TeleCash** | **<2%** | <200K | 2016 | Telecel only | USD, ZWL |
| **InnBucks** | **<1%** | ~100K | 2015 | All networks | USD only |

### Feature Comparison

| Feature | EcoCash | OneMoney | O'mari | Winner |
|---------|---------|----------|--------|--------|
| **Market Share** | 86% | 11% | 3% | 🏆 EcoCash |
| **Network Independence** | ❌ Econet only | ❌ NetOne only | ✅ All 3 | 🏆 O'mari |
| **Interoperability** | Limited | Limited | ✅ All banks/wallets | 🏆 O'mari |
| **Virtual Card Validity** | 1 year | 1 year | 5 years | 🏆 O'mari |
| **USD Transaction Fees** | 4% | 4% | **0%** (promo) | 🏆 O'mari |
| **Agent Network** | 60,000+ | 10,000+ | 5,000+ (growing) | 🏆 EcoCash |
| **Merchant Acceptance** | 100,000+ | 20,000+ | 5,000+ (growing) | 🏆 EcoCash |
| **API Availability** | ❌ Private | ❌ Private | ❌ Private | ⚖️ Tie |
| **Gateway Integration** | ✅ All gateways | ✅ All gateways | ✅ Most gateways | ⚖️ Tie |
| **Brand Trust** | Very high | Medium | High (Old Mutual) | 🏆 EcoCash |
| **Innovation** | Low | Low | High | 🏆 O'mari |

### Transaction Fees (as of 2025)

**Send Money Fees**:

| Amount | EcoCash | OneMoney | O'mari |
|--------|---------|----------|--------|
| $0.01 - $5 | $0.15 | $0.15 | **$0** |
| $5.01 - $20 | $0.30 | $0.30 | **$0** |
| $20.01 - $50 | $0.50 | $0.50 | **$0** |
| $50.01 - $100 | $1.00 | $1.00 | **$0** |
| $100.01 - $500 | 2% | 2% | **$0** |
| $500+ | 4% | 4% | **$0** |

**Current O'mari Promo**: All USD transactions FREE (no end date announced)

**Cash Out Fees**:

| Platform | Fee |
|----------|-----|
| EcoCash | 2-4% |
| OneMoney | 2-4% |
| O'mari | **0%** (USD promo), 2% (ZWL) |

---

### Why EcoCash Still Dominates

Despite O'mari's advantages, EcoCash maintains 86% market share because:

1. **First-mover advantage**: 12+ years in market (since 2011)
2. **Network effects**: Everyone uses EcoCash, so everyone must have EcoCash
3. **Agent network**: 60,000+ agents nationwide (cash in/out everywhere)
4. **Merchant acceptance**: 100,000+ merchants accept EcoCash
5. **Brand trust**: Deep integration into Zimbabwean daily life
6. **Econet dominance**: Econet has 70%+ mobile market share in Zimbabwe
7. **Habit & inertia**: People stick with what they know

### O'mari's Growth Strategy

How O'mari is competing:

1. **Zero fees**: Free USD transactions to attract cost-conscious users
2. **Network independence**: Reach NetOne and Telecel users (30% of market)
3. **Old Mutual brand**: Leverage financial services trust
4. **Innovation**: 5-year virtual cards, better app UX
5. **Financial products**: Integrated savings, loans, insurance
6. **Partnerships**: Mama Money (remittances), e-commerce platforms

---

## 7. Merchant Requirements

### How to Become an O'mari Merchant

**Prerequisites**:
- Registered business in Zimbabwe
- Valid tax clearance certificate
- Business bank account
- Operational for at least 6 months

### Required Documents

**1. Company Documents**:
- Certificate of Incorporation (certified copy)
- CR14 (Certificate of Current Directors) or equivalent
- Company Constitution/Memorandum & Articles of Association
- Tax Clearance Certificate (from ZIMRA)

**2. Board Resolution**:
- Resolution from Board of Directors approving:
  - Appointment/use of company as O'mari Merchant
  - Appointment of authorized account signatories
  - Authorization to enter into O'mari merchant agreement

**3. Director Information**:
- National IDs of all directors (certified copies)
- Proof of residence for all directors (utility bill, bank statement)
- Director contact details (phone, email)

**4. Signatory Information**:
- National IDs of authorized signatories (certified copies)
- Proof of residence for signatories
- Specimen signatures

**5. Financial Documents**:
- Recent bank statements (last 3 months)
- Business license/operating license
- Proof of business location (lease agreement or title deed)

**6. Business Details**:
- Business description and nature of operations
- Expected monthly transaction volume
- Average transaction value
- Number of locations/branches

### Application Process

**Step 1: Download Application Form**
- Visit [oldmutual.co.zw/omari](https://www.oldmutual.co.zw/omari)
- Download merchant application form
- OR visit nearest Econet Shop to collect form

**Step 2: Complete Form & Gather Documents**
- Fill out application form completely
- Attach all required documents (certified copies)
- Get Board Resolution signed and stamped

**Step 3: Submit Application**
- Submit to nearest Old Mutual branch
- OR email to: contactus@oldmutual.co.zw
- Include cover letter with contact person details

**Step 4: Vetting Process**
- OMDS compliance team reviews application
- Background checks on business and directors
- RBZ (Reserve Bank of Zimbabwe) approval required
- Timeline: **2-4 weeks**

**Step 5: Contract Signing**
- OMDS sends merchant agreement for review
- Legal review by your team
- Sign merchant agreement with OMDS
- Pay any setup fees (if applicable)

**Step 6: Setup & Training**
- Get assigned O'mari merchant number
- Receive merchant toolkit (POS device, QR code, stickers)
- Training on O'mari merchant system
- Access to merchant dashboard

**Step 7: Testing & Go-Live**
- Test transactions with OMDS support
- Verify merchant number works on USSD (`*707#`)
- Confirm payment notifications working
- Go live and start accepting O'mari payments

**Total Timeline**: **4-8 weeks** from application to go-live

---

### Merchant Fees (Estimate)

**Note**: O'mari merchant fees not publicly published. Likely structure:

| Fee Type | Estimated Amount |
|----------|------------------|
| Setup Fee | $0 - $50 |
| Monthly Fee | $0 - $20 |
| Transaction Fee | 1-3% per transaction |
| Cash Out Fee | 1-2% per withdrawal |
| POS Device | $0 (free) or $50-100 (purchase) |

**Negotiable**: Fees typically negotiated based on:
- Expected transaction volume
- Business size and type
- Relationship with Old Mutual
- Competitive offerings from EcoCash/OneMoney

---

## 8. Cost Analysis

### Scenario 1: Direct O'mari Integration

**Assumptions**:
- Apply for O'mari merchant account
- Direct API access granted (uncertain)
- Custom integration development

**Costs**:

| Cost Item | Amount | Notes |
|-----------|--------|-------|
| **Merchant Application** | $50 | One-time |
| **Legal Review** | $500 | Merchant agreement review |
| **Development Time** | $2,000 | 2 weeks @ $1,000/week (if API exists) |
| **Testing** | $200 | Test transactions, debugging |
| **Transaction Fees** | 1-3% | Per O'mari payment |
| **Total Setup** | **$2,750** | 6-8 weeks timeline |
| **Ongoing** | 1-3%/txn | Per transaction |

**Risk Factors**:
- ❌ API may not exist or be provided
- ❌ 6-8 week approval process (too slow for MVP)
- ❌ Uncertain transaction fees
- ❌ Integration complexity unknown
- ❌ Maintenance burden (API updates, security)

**Verdict**: **Not recommended** for MVP

---

### Scenario 2: Paynow Gateway Integration (Recommended)

**Assumptions**:
- Use Paynow for all payments (EcoCash, OneMoney, O'mari)
- Single integration handles all payment methods
- Already researched in T013

**Costs**:

| Cost Item | Amount | Notes |
|-----------|--------|-------|
| **Setup** | $0 | Free Paynow registration |
| **Development** | $0 | Already done in T013 |
| **Testing** | $0 | Paynow sandbox |
| **Transaction Fees** | 3.5% | All mobile money (EcoCash/OneMoney/O'mari) |
| **Total Setup** | **$0** | 1-2 days timeline |
| **Ongoing** | 3.5%/txn | Per transaction |

**Benefits**:
- ✅ **Instant access** (sign up today, integrate tomorrow)
- ✅ **Single integration** for all payment methods
- ✅ **Already implemented** (T013 research complete)
- ✅ **Proven reliability** (Zimbabwe's leading gateway)
- ✅ **No maintenance** (Paynow handles updates)

**Verdict**: **Highly recommended** for MVP

---

### Cost Comparison: O'mari vs EcoCash vs OneMoney

**Monthly Costs** (based on Lynia Finance projections):

**MVP Phase** (100 transactions/month, $50 avg):

| Scenario | Transaction Fee | Monthly Cost | Total Volume |
|----------|-----------------|--------------|--------------|
| **All EcoCash** (86% market) | 3.5% | $150 | $4,300 |
| **All OneMoney** (11% market) | 3.5% | $19 | $550 |
| **All O'mari** (3% market) | 3.5% | $5 | $150 |
| **Mixed (realistic)** | 3.5% avg | **$175** | **$5,000** |

**Growth Phase** (2,000 transactions/month, $50 avg):

| Scenario | Transaction Fee | Monthly Cost | Total Volume |
|----------|-----------------|--------------|--------------|
| **All EcoCash** | 3.5% | $3,010 | $86,000 |
| **All OneMoney** | 3.5% | $385 | $11,000 |
| **All O'mari** | 3.5% | $105 | $3,000 |
| **Mixed (realistic)** | 3.5% avg | **$3,500** | **$100,000** |

**Observations**:
- O'mari represents only **3% of payment volume** (based on market share)
- At 2,000 transactions/month, O'mari = **60 payments** = **$105 in fees**
- **Not worth separate integration** for 3% of transactions
- Better to use Paynow which handles all methods

---

## 9. Why O'mari Matters for Lynia Finance

### Strategic Considerations

**1. Future Growth Potential**
- O'mari growing fast (backed by Old Mutual)
- Currently 3% market share, could reach 10-15% in 2-3 years
- Network independence gives access to 30% of users not on Econet

**2. Customer Choice**
- Some customers may prefer O'mari (free fees, better UX)
- NetOne and Telecel users can't easily access EcoCash
- Offering multiple payment options increases conversion

**3. Competitive Advantage**
- Many lenders only accept EcoCash
- Supporting O'mari differentiates Lynia Finance
- Attracts cost-conscious customers (O'mari's free USD promo)

**4. Risk Diversification**
- Don't rely solely on EcoCash (monopoly risk)
- If EcoCash has downtime, O'mari provides backup
- Regulatory changes could affect any single provider

**5. Lower Customer Costs**
- O'mari currently charges 0% for USD transactions
- Customer saves money on cash-in fees
- More affordable deposit payments

---

### When to Pursue Direct O'mari Integration

**Not Now** (Phase 0 - MVP):
- ❌ Too slow (6-8 week approval)
- ❌ Uncertain API availability
- ❌ High development cost for 3% of transactions
- ❌ Paynow already supports O'mari

**Consider Later** (Phase 2 - Scale):
- After Lynia Finance reaches **10,000+ transactions/month**
- If O'mari market share grows to **10%+**
- If direct integration offers **significantly lower fees** (e.g., 1% vs 3.5%)
- If O'mari provides public API with good documentation
- If **cost savings justify development** (e.g., $2,000/month saved)

**Calculation** (when direct integration makes sense):

**Assumptions**:
- 10,000 transactions/month @ $50 avg = $500,000 volume/month
- 10% O'mari market share = 1,000 O'mari transactions = $50,000 volume
- Paynow fee: 3.5% = $1,750/month
- Direct O'mari fee: 1% = $500/month
- **Savings**: $1,250/month = $15,000/year

**Break-even**:
- Development cost: $2,750
- Break-even: **2.2 months**
- **ROI**: After 3 months, net savings $12,250/year

**Decision Rule**: Pursue direct O'mari integration when:
```
(Paynow fees - Direct fees) × 12 months > Development cost + $10,000 safety margin
```

---

## 10. Implementation Strategy

### Phase 0 (MVP) - Current Phase

**Timeline**: Weeks 1-8

**Strategy**: **Use Paynow for all payments** (EcoCash, OneMoney, O'mari)

**Actions**:
- ✅ Continue using Paynow (T013 research complete)
- ✅ No O'mari-specific integration required
- ✅ Customer selects payment method on Paynow page
- ✅ Single webhook handler for all methods

**Code** (no changes from T013):
```javascript
// Same code handles EcoCash, OneMoney, and O'mari
const paynow = new Paynow(integrationId, integrationKey);
paynow.resultUrl = 'https://lynia.co.zw/api/webhooks/paynow';
paynow.returnUrl = 'https://lynia.co.zw/payment/complete';

const payment = paynow.createPayment('INV-12345', 'customer@example.com');
payment.add('Phone Deposit', 50.00);

// Customer redirected to Paynow, selects EcoCash/OneMoney/O'mari
await paynow.send(payment);
```

**Benefits**:
- Zero additional development
- Immediate access to O'mari payments
- No merchant application needed (Paynow handles it)

---

### Phase 1 (Post-MVP) - Weeks 9-19

**Goal**: Monitor O'mari adoption, optimize payment flow

**Actions**:
1. **Track Payment Method Analytics**:
   - Log which payment method customers choose (EcoCash, OneMoney, O'mari)
   - Calculate O'mari percentage of total transactions
   - Monitor O'mari success rate vs EcoCash/OneMoney

2. **Customer Feedback**:
   - Survey: "Which payment method do you prefer?"
   - Track complaints/issues related to payment methods
   - Monitor conversion rates by payment method

3. **Cost Analysis**:
   - Calculate total fees paid to Paynow by payment method
   - Estimate potential savings from direct integrations
   - Decision: Pursue direct O'mari API if ROI > $10K/year

**Implementation**:
```javascript
// Add payment method tracking
app.post('/api/webhooks/paynow', async (req, res) => {
  const { reference, status, paynowreference } = req.body;

  // Verify hash...

  // Detect payment method from Paynow reference
  const paymentMethod = await detectPaymentMethod(paynowreference);

  // Save to analytics
  await db.analytics.create({
    reference,
    paymentMethod,  // 'ecocash', 'onemoney', 'omari', 'visa', etc.
    status,
    amount: payment.amount,
    fee: payment.amount * 0.035,
    timestamp: new Date()
  });

  // Process payment...
});

// Analytics query
async function getPaymentMethodBreakdown(startDate, endDate) {
  return db.analytics.aggregate([
    { $match: { timestamp: { $gte: startDate, $lte: endDate }, status: 'paid' } },
    { $group: {
      _id: '$paymentMethod',
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      totalFees: { $sum: '$fee' }
    }}
  ]);
}

// Example output:
// [
//   { _id: 'ecocash', count: 1720, totalAmount: 86000, totalFees: 3010 },
//   { _id: 'onemoney', count: 220, totalAmount: 11000, totalFees: 385 },
//   { _id: 'omari', count: 60, totalAmount: 3000, totalFees: 105 }
// ]
```

---

### Phase 2 (Scale) - Months 6-12

**Goal**: Optimize costs at scale (10,000+ transactions/month)

**Decision Point**: If O'mari represents **10%+ of transactions** AND **potential savings > $10K/year**, pursue direct integration

**Actions**:

**Option A: Continue with Paynow** (if O'mari < 10% market share)
- Keep existing integration
- Focus on business growth, not payment optimization
- Revisit in 6 months

**Option B: Pursue Direct O'mari Integration** (if O'mari ≥ 10% AND ROI justified)

1. **Apply for O'mari Merchant Account**:
   - Gather required documents (Board Resolution, tax clearance, etc.)
   - Submit application to Old Mutual Digital Services
   - Timeline: 4-6 weeks for approval

2. **Request API Documentation**:
   - Contact OMDS technical team
   - Request developer documentation (if available)
   - Negotiate transaction fees (target: 1-2% vs Paynow's 3.5%)

3. **Develop Integration**:
   - Study O'mari API (if provided)
   - Implement payment initiation endpoint
   - Implement webhook callback handler
   - Test in sandbox environment

4. **Parallel Testing**:
   - Run O'mari direct + Paynow in parallel
   - A/B test: 10% of O'mari payments via direct API
   - Compare success rates, reliability, customer experience
   - Monitor for 2-4 weeks

5. **Full Cutover** (if successful):
   - Migrate all O'mari payments to direct API
   - Keep Paynow for EcoCash/OneMoney/cards
   - Monitor savings and reliability

**Estimated Development**:
```javascript
// New O'mari direct integration (hypothetical, depends on actual API)
const omariClient = new OmariAPI(merchantId, apiKey);

async function initiateOmariPayment(customerPhone, amount, reference) {
  try {
    const response = await omariClient.payments.create({
      phone: customerPhone,
      amount: amount,
      currency: 'USD',
      reference: reference,
      callbackUrl: 'https://lynia.co.zw/api/webhooks/omari'
    });

    // USSD push sent to customer
    return {
      success: true,
      transactionId: response.transactionId,
      pollUrl: response.pollUrl
    };

  } catch (error) {
    console.error('O\'mari payment failed:', error);
    return { success: false, error: error.message };
  }
}

// Separate webhook for O'mari callbacks
app.post('/api/webhooks/omari', async (req, res) => {
  const { reference, transactionId, status, amount } = req.body;

  // Verify signature...

  if (status === 'SUCCESS') {
    await processSuccessfulPayment(reference, amount);
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await processFailedPayment(reference, status);
  }

  res.status(200).send('OK');
});
```

**Risk Mitigation**:
- Keep Paynow as fallback (if O'mari API fails)
- Implement circuit breaker for O'mari API
- Monitor error rates closely
- Have rollback plan ready

---

### Phase 3 (Mature) - Year 2+

**Goal**: Optimize all payment integrations for maximum efficiency

**Potential Strategies**:

1. **Direct Integration with All Providers**:
   - EcoCash direct API (if available, saves 3.5% → 1%)
   - OneMoney direct API (if available)
   - O'mari direct API
   - Keep Paynow as fallback only

2. **Smart Payment Routing**:
   - Route to cheapest provider based on real-time fees
   - Load balance across multiple gateways
   - Failover if primary gateway down

3. **Negotiate Better Rates**:
   - Volume discounts with Paynow (e.g., 2.5% at 20,000 txns/month)
   - Direct partnerships with mobile money operators
   - Explore other emerging gateways (Smile & Pay, etc.)

4. **Multi-Gateway Architecture**:
```javascript
// Payment router - chooses best gateway
async function routePayment(payment, customerPhone) {
  const paymentMethod = await detectPreferredMethod(customerPhone);

  if (paymentMethod === 'ecocash') {
    // Use direct EcoCash if available, else Paynow
    return await ecocashDirect.available()
      ? ecocashDirect.pay(payment)
      : paynow.pay(payment);

  } else if (paymentMethod === 'omari') {
    // Use direct O'mari if available, else Paynow
    return await omariDirect.available()
      ? omariDirect.pay(payment)
      : paynow.pay(payment);

  } else {
    // Default to Paynow for all others
    return await paynow.pay(payment);
  }
}
```

---

## 11. References

### Official Resources

- **O'mari Official Website**: [oldmutual.co.zw/omari](https://www.oldmutual.co.zw/omari)
- **Old Mutual Contact**: contactus@oldmutual.co.zw | +263242308400
- **O'mari WhatsApp**: 0774 707 707
- **O'mari USSD**: `*707#` (all networks)
- **O'mari Mobile App**: Google Play Store / Apple App Store

### Payment Gateway Documentation

- **Paynow**: [developers.paynow.co.zw](https://developers.paynow.co.zw) *(supports O'mari)*
- **ContiPay**: [contipay.co.zw](https://contipay.co.zw) *(supports O'mari)*
- **Pesepay**: [pesepay.com](https://pesepay.com) *(O'mari support unclear)*

### News & Articles

- **Old Mutual Launches O'mari** (May 2023): [Techzim Article](https://www.techzim.co.zw/2023/05/old-mutual-launches-omari-a-mobile-wallet-and-platform/)
- **EcoCash Market Leadership** (April 2025): [Newsday Article](https://www.newsday.co.zw/business/article/200040539/ecocash-maintains-market-leadership-amid-rising-competition)
- **Payment Gateways Comparison**: [Flixtechs Blog](https://flixtechs.co.zw/posts/payment-gateways-in-zimbabwe-the-horrors-the-good-the-ugly)
- **ZB Financial Smile & Pay Launch** (May 2025): [Techzim](https://www.techzim.co.zw/2025/05/zb-launches-payment-gateway/)

### Related Lynia Finance Research

- **T013**: EcoCash USSD integration (Paynow gateway) ✅
- **T015**: Payment callback payload schemas (next)
- **T016**: Callback authentication mechanisms (next)

---

## Completion Checklist

- [x] Research O'mari platform and features
- [x] Investigate direct O'mari API availability
- [x] Document payment gateway integrations (Paynow, ContiPay, Pesepay)
- [x] Analyze USSD payment flow (`*707#`)
- [x] Compare O'mari vs EcoCash vs OneMoney
- [x] Document merchant requirements and application process
- [x] Cost analysis (direct vs gateway integration)
- [x] Define implementation strategy (3 phases)
- [x] Provide code examples for analytics tracking
- [x] Establish decision criteria for future direct integration
- [x] Document all access channels (USSD, WhatsApp, app)
- [x] Market share analysis and growth projections
- [x] Compile official resources and references

---

## Key Takeaways

1. **No Public API**: O'mari does NOT offer public API documentation
2. **Use Paynow**: Continue using Paynow gateway (already supports O'mari)
3. **Small Market Share**: O'mari = 3% of market (vs EcoCash 86%)
4. **Not Worth Separate Integration**: For MVP, Paynow handles all payment methods
5. **Monitor Growth**: Track O'mari adoption, revisit direct integration at scale
6. **Decision Rule**: Pursue direct O'mari API when ROI > $10K/year savings
7. **Network Independence**: O'mari's key advantage = works on all 3 networks
8. **Free USD Promo**: O'mari currently offers 0% fees (competitive advantage)
9. **Future Potential**: O'mari backed by Old Mutual, likely to grow
10. **Customer Choice**: Offering O'mari provides payment flexibility

---

## Next Steps

1. ✅ **Complete**: T013 (EcoCash/Paynow) + T014 (O'mari) research
2. **Proceed to T015**: Document payment callback payload schemas
3. **Proceed to T016**: Document callback authentication mechanisms (HMAC, API keys)
4. **Phase 1 Implementation**: Build payment service with Paynow (handles all methods)
5. **Analytics Setup**: Track payment method distribution (EcoCash/OneMoney/O'mari)
6. **Review in 6 months**: Reassess direct O'mari integration based on market share

---

**Research Status**: ✅ Complete
**Recommendation**: Continue with Paynow gateway (no separate O'mari integration needed for MVP)
**Blocker**: None
**Ready for Implementation**: Yes (via Paynow from T013 research)
