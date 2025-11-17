# T001: Fineract Loan Creation API - Research Summary

**Status:** ✅ Research Complete (Documentation-based)
**Date:** 2025-11-10
**GitHub Issue:** https://github.com/1terr/Lynia-finance/issues/4

---

## Executive Summary

Apache Fineract provides a comprehensive REST API for managing clients (customers) and loans. The API supports the full loan lifecycle from client creation through loan disbursement and repayment.

**Key Finding:** Fineract is fully capable of handling our Zimbabwe device financing use case with minimal customization needed.

---

## 1. Authentication

### Method
**Basic Authentication** with tenant identification

### Headers Required
```
Authorization: Basic <base64_encoded_credentials>
Fineract-Platform-TenantId: default
Content-Type: application/json
```

### Default Credentials
- **Username:** `mifos`
- **Password:** `password`
- **Base64 encoded:** `bWlmb3M6cGFzc3dvcmQ=`

### For Production
- Change default credentials immediately
- Consider OAuth2 for better security
- Rotate credentials every 90 days

---

## 2. Client Creation API

### Endpoint
`POST /fineract-provider/api/v1/clients`

### Purpose
Create a customer profile before they can apply for a loan.

### Required Fields
| Field | Type | Description | Zimbabwe Example |
|-------|------|-------------|------------------|
| `officeId` | integer | Branch/office ID | `1` |
| `firstname` | string | First name | `"John"` |
| `lastname` | string | Last name | `"Doe"` |

### Optional But Recommended Fields
| Field | Type | Description | Zimbabwe Example |
|-------|------|-------------|------------------|
| `externalId` | string | **National ID** | `"63-123456-A-12"` |
| `mobileNo` | string | Phone with country code | `"263771234567"` |
| `active` | boolean | Activate immediately | `true` |
| `activationDate` | string | Activation date | `"10 November 2025"` |
| `dateFormat` | string | Date format | `"dd MMMM yyyy"` |
| `locale` | string | Locale | `"en"` |

### Example Request
```json
{
  "officeId": 1,
  "firstname": "John",
  "lastname": "Doe",
  "externalId": "63-123456-A-12",
  "mobileNo": "263771234567",
  "active": true,
  "dateFormat": "dd MMMM yyyy",
  "locale": "en",
  "activationDate": "10 November 2025"
}
```

### Example Response
```json
{
  "officeId": 1,
  "clientId": 123,
  "resourceId": 123
}
```

### Key for WhatsApp Bot Integration
✅ Use **`externalId`** to store Zimbabwe National ID (makes it easy to find customer later)
✅ Use **`mobileNo`** to link to WhatsApp conversation
✅ Set **`active: true`** to activate client immediately

### Error Responses
| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 400 | Validation error | Missing required field | Check all required fields |
| 401 | Unauthorized | Wrong credentials | Verify username/password |
| 403 | Forbidden | Insufficient permissions | Check user role |
| 409 | Conflict | Duplicate `externalId` | Use unique National ID |

---

## 3. Loan Creation API

### Endpoint
`POST /fineract-provider/api/v1/loans`

### Purpose
Create a loan application for device financing.

### Required Fields
| Field | Type | Description | Device Financing Value |
|-------|------|-------------|------------------------|
| `clientId` | integer | From client creation | `123` |
| `productId` | integer | Loan product ID | `1` (check available products) |
| `principal` | decimal | Loan amount | `200` - `500` (USD) |
| `loanTermFrequency` | integer | Loan duration | `8` |
| `loanTermFrequencyType` | integer | Duration unit | `2` (months) |
| `numberOfRepayments` | integer | Installments | `8` |
| `repaymentEvery` | integer | Payment frequency | `1` |
| `repaymentFrequencyType` | integer | Frequency unit | `2` (months) |
| `interestRatePerPeriod` | decimal | Interest per period | `2.5` (30% annual ÷ 12) |
| `amortizationType` | integer | Calculation method | `1` (equal installments) |
| `interestType` | integer | Interest type | `0` (declining balance) |
| `interestCalculationPeriodType` | integer | Calculation period | `1` (same as repayment) |
| `transactionProcessingStrategyId` | integer | Payment allocation | `1` (default) |
| `loanType` | string | Loan type | `"individual"` |
| `submittedOnDate` | string | Application date | `"10 November 2025"` |
| `expectedDisbursementDate` | string | Disbursement date | `"10 November 2025"` |

### Zimbabwe Interest Rate Calculation
```
Annual Rate: 30% (Zimbabwe lending market rate)
Monthly Rate: 30% ÷ 12 = 2.5%
interestRatePerPeriod: 2.5
```

For 25-50% annual rates:
- 25% annual → 2.08% monthly
- 30% annual → 2.5% monthly
- 40% annual → 3.33% monthly
- 50% annual → 4.17% monthly

### Example Request ($500, 8 months, 30% annual)
```json
{
  "clientId": 123,
  "productId": 1,
  "principal": 500,
  "loanTermFrequency": 8,
  "loanTermFrequencyType": 2,
  "numberOfRepayments": 8,
  "repaymentEvery": 1,
  "repaymentFrequencyType": 2,
  "interestRatePerPeriod": 2.5,
  "amortizationType": 1,
  "interestType": 0,
  "interestCalculationPeriodType": 1,
  "transactionProcessingStrategyId": 1,
  "loanType": "individual",
  "locale": "en",
  "dateFormat": "dd MMMM yyyy",
  "submittedOnDate": "10 November 2025",
  "expectedDisbursementDate": "10 November 2025"
}
```

### Example Response
```json
{
  "officeId": 1,
  "clientId": 123,
  "loanId": 456,
  "resourceId": 456
}
```

### Loan Amount Tiers (Based on Credit Score)
```
Score 60-70: $200 loan (low trust)
Score 71-85: $350 loan (medium trust)
Score 86-100: $500 loan (high trust)
```

---

## 4. Loan Workflow States

### State Transitions
```
1. Submitted and Pending Approval (after loan creation)
   ↓
2. Approved (after approval command)
   ↓
3. Active (after disbursement - when device is handed over)
   ↓
4. Closed (after full repayment)
```

### State 1 → 2: Approve Loan
**Endpoint:** `POST /fineract-provider/api/v1/loans/{loanId}?command=approve`

```json
{
  "approvedOnDate": "10 November 2025",
  "dateFormat": "dd MMMM yyyy",
  "locale": "en"
}
```

**When to use:** After credit scoring approves the customer.

### State 2 → 3: Disburse Loan
**Endpoint:** `POST /fineract-provider/api/v1/loans/{loanId}?command=disburse`

```json
{
  "actualDisbursementDate": "10 November 2025",
  "transactionAmount": 500,
  "dateFormat": "dd MMMM yyyy",
  "locale": "en"
}
```

**When to use:** When customer collects device from distributor (physical handover).

---

## 5. Integration with WhatsApp Bot

### Customer Journey Mapping
| WhatsApp Bot Step | Fineract API Call |
|-------------------|-------------------|
| Customer starts KYC | No API call yet |
| Customer passes KYC | **Create Client** (POST /clients) |
| Customer selects phone | No API call yet (tentative selection) |
| Customer makes deposit | **Create Loan** (POST /loans) |
| System auto-approves | **Approve Loan** (POST /loans/{id}?command=approve) |
| Customer collects device | **Disburse Loan** (POST /loans/{id}?command=disburse) |

### Data Mapping
| WhatsApp Bot Data | Fineract Field |
|-------------------|----------------|
| Customer name (from KYC) | `firstname`, `lastname` |
| Zimbabwe National ID | `externalId` |
| Phone number (from WhatsApp) | `mobileNo` |
| Selected device price | `principal` |
| Approved loan amount | `principal` (from credit scoring) |

---

## 6. Loan Product Configuration Needed

Before creating loans, you need to configure a loan product in Fineract with these settings:

### Product Configuration
```
Product Name: Device Financing (Zimbabwe)
Currency: USD
Min Principal: $200
Max Principal: $500
Interest Rate: 25-50% per annum (2.08-4.17% monthly)
Loan Term: 8 months
Repayment Frequency: Monthly
Amortization: Equal Installments
Interest Type: Declining Balance
```

### How to Create (via Fineract UI)
1. Log in to Fineract admin panel
2. Admin → Products → Loan Products
3. Click "Create Loan Product"
4. Fill in above details
5. Note the `productId` for API calls

---

## 7. Error Handling Strategy

### Common Errors & Solutions
| Error | Cause | Solution |
|-------|-------|----------|
| `clientId not found` | Invalid client ID | Verify client exists first |
| `productId not found` | Invalid product ID | Use GET /loanproducts to check |
| `Duplicate externalId` | National ID already used | Check if customer exists, reject application |
| `Invalid principal amount` | Amount outside product limits | Enforce limits in WhatsApp bot |
| `Invalid interest rate` | Rate outside product limits | Use product-configured rate |

### Retry Strategy
```javascript
// Exponential backoff for transient errors
async function createLoanWithRetry(loanData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createLoan(loanData);
    } catch (error) {
      if (error.status === 500 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
        continue;
      }
      throw error;
    }
  }
}
```

---

## 8. Key Findings for Lynia Finance

### ✅ What Works Well
1. **Zimbabwe National ID** can be stored in `externalId` field
2. **Phone numbers** work with country code format (`263771234567`)
3. **Interest rates** configurable (supports 25-50% annual)
4. **Loan terms** flexible (can do 8 months monthly repayments)
5. **Workflow states** match our business process (pending → approved → active)
6. **Date format** supports human-readable format ("10 November 2025")

### ⚠️ Limitations Discovered
1. **Loan products** must be pre-configured (can't create on-the-fly)
2. **Client must exist** before creating loan (two-step process)
3. **Disbursement required** to activate loan (can't skip this step)
4. **Date format strict** - must match exactly "dd MMMM yyyy"

### 🔧 Recommendations
1. **Pre-create** 3 loan products:
   - Low tier: $200, 40% interest
   - Medium tier: $350, 35% interest
   - High tier: $500, 30% interest
2. **Cache** `clientId` in WhatsApp session after KYC
3. **Automate** loan approval for scores >60
4. **Trigger** disbursement when distributor confirms handover
5. **Add** duplicate check on `externalId` before creating client

---

## 9. Next Steps (T002, T003)

### T002: Repayment Posting
- **Endpoint:** `POST /loans/{loanId}/transactions?command=repayment`
- **Purpose:** Post customer repayments from EcoCash/Omari
- **Key:** Transaction IDs for reconciliation

### T003: Account Query
- **Endpoint:** `GET /loans/{loanId}?associations=repaymentSchedule`
- **Purpose:** Get balance, next due date for WhatsApp bot
- **Use case:** "Check Balance" command in WhatsApp

---

## 10. Code Examples for Integration

### Complete Integration Flow
```javascript
// 1. Customer passes KYC
const clientData = {
  officeId: 1,
  firstname: kycData.firstname,
  lastname: kycData.lastname,
  externalId: kycData.nationalId, // Zimbabwe National ID
  mobileNo: whatsappPhone,
  active: true,
  dateFormat: "dd MMMM yyyy",
  locale: "en",
  activationDate: new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
};

const client = await fineractAPI.createClient(clientData);
session.clientId = client.clientId; // Cache for later

// 2. Customer makes deposit, credit scoring approves
const loanAmount = creditScore >= 86 ? 500 :
                   creditScore >= 71 ? 350 : 200;
const interestRate = creditScore >= 86 ? 2.5 : // 30% annual
                     creditScore >= 71 ? 2.92 : // 35% annual
                     3.33; // 40% annual

const loanData = {
  clientId: session.clientId,
  productId: 1, // Pre-configured product
  principal: loanAmount,
  loanTermFrequency: 8,
  loanTermFrequencyType: 2,
  numberOfRepayments: 8,
  repaymentEvery: 1,
  repaymentFrequencyType: 2,
  interestRatePerPeriod: interestRate,
  amortizationType: 1,
  interestType: 0,
  interestCalculationPeriodType: 1,
  transactionProcessingStrategyId: 1,
  loanType: "individual",
  locale: "en",
  dateFormat: "dd MMMM yyyy",
  submittedOnDate: today,
  expectedDisbursementDate: today
};

const loan = await fineractAPI.createLoan(loanData);
session.loanId = loan.loanId;

// 3. Auto-approve (score >= 60)
await fineractAPI.approveLoan(session.loanId);

// 4. Distributor confirms device handover
await fineractAPI.disburseLoan(session.loanId, loanAmount);

// Success! Loan is now active
```

---

## 11. Completion Checklist

- [x] Understand authentication method
- [x] Document client creation API
- [x] Document loan creation API
- [x] Document loan workflow (states)
- [x] Map Zimbabwe data to Fineract fields
- [x] Calculate interest rates (25-50% annual)
- [x] Design integration with WhatsApp bot
- [x] Identify error handling strategy
- [x] Document loan product requirements
- [ ] **Test with actual Fineract instance** (blocked by network/setup issues)

---

## 12. Alternative Testing Options

Since local Docker and demo server aren't accessible:

### Option 1: Use Postman/Insomnia Mock Server
- Import Fineract OpenAPI spec
- Create mock responses
- Test client integration code

### Option 2: Deploy Fineract to Cloud
- Use AWS EC2 free tier
- Deploy Fineract with Docker
- Test remotely

### Option 3: Partner with Fineract
- Contact Apache Fineract community
- Request sandbox access
- Get dedicated test instance

### Option 4: Proceed with Documentation
- ✅ **Current approach** - document based on official API docs
- Test during Phase 2 (Foundation) when deploying infrastructure
- Acceptable for research phase

---

## 13. Resources

### Official Documentation
- **API Docs:** https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm
- **GitHub:** https://github.com/apache/fineract
- **Community:** https://fineract.apache.org/

### Related Tasks
- **T002:** Repayment posting API
- **T003:** Account query API
- **T004:** Authentication documentation
- **T005:** Loan product configuration

### Files Created
- `research/T001-fineract-research.md` - Detailed research notes
- `research/fineract-demo-test.js` - Test script (ready for when server is accessible)
- `research/T001-SUMMARY.md` - This summary document

---

## 14. Mark as Complete?

**Status:** ✅ **Research COMPLETE**

While we couldn't test with a live server, we have:
- ✅ Comprehensive understanding of the API
- ✅ All required fields documented
- ✅ Integration strategy designed
- ✅ Error handling planned
- ✅ Code examples ready
- ✅ Zimbabwe-specific considerations addressed

**Recommendation:** Mark GitHub issue #4 (T001) as **COMPLETE** and proceed to T002.

**Testing will happen in Phase 2** when we set up production infrastructure.

---

**Research completed by:** Claude
**Date:** 2025-11-10
**Next:** T002 - Repayment Posting API Research
