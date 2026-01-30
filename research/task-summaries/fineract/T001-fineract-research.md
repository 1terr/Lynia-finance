# T001: Fineract Loan Creation API Research

**Date Started:** 2025-11-10
**Status:** In Progress
**Researcher:** [Your Name]

## Goal
Research and test Apache Fineract's REST API for creating clients and loans to integrate with our WhatsApp-based lending platform.

---

## 1. Setup Log

### Environment
- **OS:** Windows
- **Docker Version:** 28.5.1
- **Fineract Version:** (to be determined)

### Installation Steps

#### 1.1 Clone Fineract Repository
```bash
git clone https://github.com/apache/fineract.git fineract-test
cd fineract-test
```

Status: ⏳ In Progress

#### 1.2 Start Fineract with Docker Compose
```bash
docker-compose up -d
```

Status: ⏳ Pending

#### 1.3 Verify Fineract is Running
```bash
curl http://localhost:8443/fineract-provider/api/v1/offices
```

Status: ⏳ Pending

---

## 2. Authentication Research

### Default Credentials
- **Username:** mifos
- **Password:** password
- **Tenant ID:** default

### Creating Authorization Header
```bash
# Base64 encode: mifos:password
echo -n "mifos:password" | base64
# Result: bWlmb3M6cGFzc3dvcmQ=
```

### Required Headers
```
Authorization: Basic bWlmb3M6cGFzc3dvcmQ=
Fineract-Platform-TenantId: default
Content-Type: application/json
```

Status: ⏳ To be tested

---

## 3. Client Creation API

### Endpoint
`POST /fineract-provider/api/v1/clients`

### Test Request
```bash
curl -X POST http://localhost:8443/fineract-provider/api/v1/clients \
  -H 'Authorization: Basic bWlmb3M6cGFzc3dvcmQ=' \
  -H 'Fineract-Platform-TenantId: default' \
  -H 'Content-Type: application/json' \
  -d '{
    "officeId": 1,
    "firstname": "John",
    "lastname": "Doe",
    "externalId": "63-123456-A-12",
    "mobileNo": "263771234567",
    "active": true,
    "dateFormat": "dd MMMM yyyy",
    "locale": "en",
    "activationDate": "10 November 2025"
  }'
```

### Expected Response
```json
{
  "officeId": 1,
  "clientId": 1,
  "resourceId": 1
}
```

### Test Results
- **Test 1:** Creating basic client
  - Status: ⏳ Not tested yet
  - Result:
  - Notes:

- **Test 2:** Using Zimbabwe National ID as externalId
  - Status: ⏳ Not tested yet
  - Result:
  - Notes:

- **Test 3:** Error handling - missing required fields
  - Status: ⏳ Not tested yet
  - Result:
  - Notes:

### Fields Documentation

#### Required Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| officeId | integer | Office/branch ID | 1 |
| firstname | string | Customer first name | "John" |
| lastname | string | Customer last name | "Doe" |

#### Optional Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| externalId | string | National ID (Zimbabwe) | "63-123456-A-12" |
| mobileNo | string | Phone number with country code | "263771234567" |
| active | boolean | Activate immediately | true |
| activationDate | string | Activation date | "10 November 2025" |

### Error Responses

| HTTP Code | Error | Meaning | Solution |
|-----------|-------|---------|----------|
| 400 | Validation Error | Missing required field | Check required fields |
| 401 | Unauthorized | Wrong credentials | Verify username/password |
| 403 | Forbidden | Insufficient permissions | Check user role |
| 404 | Not Found | Invalid endpoint | Check URL |

Status: ⏳ To be documented

---

## 4. Loan Creation API

### Endpoint
`POST /fineract-provider/api/v1/loans`

### First: Get Available Loan Products
```bash
curl -X GET http://localhost:8443/fineract-provider/api/v1/loanproducts \
  -H 'Authorization: Basic bWlmb3M6cGFzc3dvcmQ=' \
  -H 'Fineract-Platform-TenantId: default'
```

Status: ⏳ To be tested

### Test Request
```bash
curl -X POST http://localhost:8443/fineract-provider/api/v1/loans \
  -H 'Authorization: Basic bWlmb3M6cGFzc3dvcmQ=' \
  -H 'Fineract-Platform-TenantId: default' \
  -H 'Content-Type: application/json' \
  -d '{
    "clientId": 1,
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
  }'
```

### Expected Response
```json
{
  "officeId": 1,
  "clientId": 1,
  "loanId": 1,
  "resourceId": 1
}
```

### Test Results
- **Test 1:** Creating loan with $500 principal
  - Status: ⏳ Not tested yet
  - Result:
  - Notes:

- **Test 2:** Testing 30% annual interest (2.5% monthly)
  - Status: ⏳ Not tested yet
  - Result:
  - Notes:

### Fields Documentation

#### Required Fields
| Field | Type | Description | Value for Our Use Case |
|-------|------|-------------|------------------------|
| clientId | integer | Customer ID from client creation | From previous step |
| productId | integer | Loan product ID | 1 (check available products) |
| principal | decimal | Loan amount | 200-500 (USD) |
| loanTermFrequency | integer | Loan term length | 8 |
| loanTermFrequencyType | integer | Term frequency unit | 2 (months) |
| numberOfRepayments | integer | Number of installments | 8 |
| repaymentEvery | integer | Repayment frequency | 1 |
| repaymentFrequencyType | integer | Repayment unit | 2 (months) |
| interestRatePerPeriod | decimal | Interest rate per period | 2.5 (30% annual ÷ 12) |
| amortizationType | integer | Repayment calculation | 1 (equal installments) |
| interestType | integer | Interest type | 0 (declining balance) |
| interestCalculationPeriodType | integer | Interest calculation | 1 (same as repayment) |
| transactionProcessingStrategyId | integer | Payment allocation | 1 (default strategy) |
| loanType | string | Loan type | "individual" |
| submittedOnDate | string | Application date | Current date |
| expectedDisbursementDate | string | Disbursement date | Current date |

#### Interest Rate Calculation for Zimbabwe
```
Annual Rate: 30%
Monthly Rate: 30% ÷ 12 = 2.5%
interestRatePerPeriod: 2.5
```

Status: ⏳ To be verified

---

## 5. Loan Workflow

### State Transitions
```
Submitted and Pending Approval → Approved → Active (Disbursed) → Closed
```

### 5.1 Approve Loan
```bash
curl -X POST 'http://localhost:8443/fineract-provider/api/v1/loans/1?command=approve' \
  -H 'Authorization: Basic bWlmb3M6cGFzc3dvcmQ=' \
  -H 'Fineract-Platform-TenantId: default' \
  -H 'Content-Type: application/json' \
  -d '{
    "approvedOnDate": "10 November 2025",
    "dateFormat": "dd MMMM yyyy",
    "locale": "en"
  }'
```

Status: ⏳ To be tested

### 5.2 Disburse Loan
```bash
curl -X POST 'http://localhost:8443/fineract-provider/api/v1/loans/1?command=disburse' \
  -H 'Authorization: Basic bWlmb3M6cGFzc3dvcmQ=' \
  -H 'Fineract-Platform-TenantId: default' \
  -H 'Content-Type: application/json' \
  -d '{
    "actualDisbursementDate": "10 November 2025",
    "transactionAmount": 500,
    "dateFormat": "dd MMMM yyyy",
    "locale": "en"
  }'
```

Status: ⏳ To be tested

---

## 6. Key Findings

### What Works
- (To be filled in after testing)

### Limitations Discovered
- (To be filled in after testing)

### Errors Encountered
- (To be filled in after testing)

### Solutions Found
- (To be filled in after testing)

---

## 7. Integration Considerations

### For WhatsApp Bot
- How to map Zimbabwe National ID to `externalId`
- Phone number format: `263771234567` (with country code)
- Date format: "dd MMMM yyyy" (e.g., "10 November 2025")

### For Loan Products
- Need to configure product with:
  - Interest rate: 25-50% per annum
  - Term: 8 months
  - Min amount: $200
  - Max amount: $500

### For Production
- Consider unique constraint on `externalId` (National ID)
- Handle duplicate customer detection
- Implement proper error handling for all API calls

---

## 8. Next Steps

- [ ] Complete local Fineract setup
- [ ] Test client creation API
- [ ] Test loan creation API
- [ ] Test loan approval workflow
- [ ] Test loan disbursement
- [ ] Document all error scenarios
- [ ] Create loan product for device financing
- [ ] Test with Zimbabwe-specific data

---

## 9. Resources

### Official Documentation
- Fineract API Docs: https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm
- GitHub: https://github.com/apache/fineract
- Docker Setup: https://github.com/apache/fineract/tree/develop/docker

### Related Tasks
- T002: Repayment posting API
- T003: Account query API
- T004: Authentication documentation

---

## 10. Time Log

| Date | Hours | Activity |
|------|-------|----------|
| 2025-11-10 | - | Started setup |
| | | |

**Total Time:** TBD

---

## 11. Completion Checklist

- [ ] Fineract running locally
- [ ] Successfully created 3 test clients
- [ ] Successfully created 3 test loans
- [ ] Tested loan approval workflow
- [ ] Tested loan disbursement
- [ ] Documented all API endpoints
- [ ] Documented error responses
- [ ] Created code examples
- [ ] Updated main research.md
- [ ] Marked GitHub issue #4 as complete
