# T006: Fineract Integration Test Plan - Research Summary

**Status:** ✅ Research Complete (Documentation-based)
**Date:** 2025-11-10
**GitHub Issue:** https://github.com/1terr/Lynia-finance/issues/9

---

## Executive Summary

A comprehensive integration test plan is essential before deploying Lynia Finance to production. This document outlines test cases, automation scripts, and validation procedures for all Fineract APIs including client management, loan operations, repayment processing, and account queries.

**Key Finding:** Integration tests must cover the complete loan lifecycle from client creation to final repayment, including edge cases like overpayments, partial payments, and concurrent operations.

---

## 1. Testing Strategy

### 1.1 Test Pyramid

```
                    /\
                   /  \
                  / E2E \          5% - End-to-End (Full user journeys)
                 /------\
                /  API   \         35% - Integration (API endpoints)
               /----------\
              /   Unit     \       60% - Unit (Business logic)
             /--------------\
```

**This document focuses on the Integration (API) layer.**

---

### 1.2 Testing Environments

| Environment | Purpose | Data | URL |
|------------|---------|------|-----|
| **Local** | Development | Mock data | http://localhost:8443 |
| **Staging** | Pre-production testing | Realistic data | https://staging.fineract.lynia.finance |
| **Production** | Live system | Real customer data | https://fineract.lynia.finance |

**Test execution:**
- ✅ Run full test suite on **Local** and **Staging**
- ❌ NEVER run destructive tests on **Production**
- ✅ Use monitoring/observability for Production validation

---

### 1.3 Testing Tools

```javascript
// Test Framework
const { describe, it, expect, beforeAll, afterAll } = require('jest');

// HTTP Client
const axios = require('axios');

// Assertions
const chai = require('chai');
const expect = chai.expect;

// Test Data Generation
const faker = require('@faker-js/faker');

// Environment Management
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });
```

---

## 2. Test Environment Setup

### 2.1 Configuration

```javascript
// test/config/fineract-test-config.js

module.exports = {
  // Environment-specific base URLs
  baseURL: process.env.FINERACT_BASE_URL || 'http://localhost:8443/fineract-provider/api/v1',

  // Authentication
  auth: {
    username: process.env.FINERACT_USERNAME || 'mifos',
    password: process.env.FINERACT_PASSWORD || 'password',
    tenantId: process.env.FINERACT_TENANT_ID || 'default'
  },

  // Product IDs (from T005)
  products: {
    lowTier: parseInt(process.env.PRODUCT_ID_LOW || '1'),
    mediumTier: parseInt(process.env.PRODUCT_ID_MEDIUM || '2'),
    highTier: parseInt(process.env.PRODUCT_ID_HIGH || '3')
  },

  // Test configuration
  test: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    cleanupAfterTests: true
  },

  // Zimbabwe-specific
  zimbabwe: {
    nationalIdPattern: /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/,
    phonePattern: /^\+?263[0-9]{9}$/,
    currency: 'USD',
    officeId: 1
  }
};
```

**Environment Files:**

`.env.local`
```bash
FINERACT_BASE_URL=http://localhost:8443/fineract-provider/api/v1
FINERACT_USERNAME=mifos
FINERACT_PASSWORD=password
FINERACT_TENANT_ID=default
PRODUCT_ID_LOW=1
PRODUCT_ID_MEDIUM=2
PRODUCT_ID_HIGH=3
```

`.env.staging`
```bash
FINERACT_BASE_URL=https://staging.fineract.lynia.finance/fineract-provider/api/v1
FINERACT_USERNAME=test_user
FINERACT_PASSWORD=<from_secrets_manager>
FINERACT_TENANT_ID=default
PRODUCT_ID_LOW=10
PRODUCT_ID_MEDIUM=11
PRODUCT_ID_HIGH=12
```

---

### 2.2 Test Utilities

```javascript
// test/utils/fineract-client.js

const axios = require('axios');
const config = require('../config/fineract-test-config');

class FineractTestClient {
  constructor() {
    this.baseURL = config.baseURL;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.test.timeout,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(
          `${config.auth.username}:${config.auth.password}`
        ).toString('base64'),
        'Fineract-Platform-TenantId': config.auth.tenantId,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          console.error('API Error:', {
            status: error.response.status,
            data: error.response.data,
            endpoint: error.config.url
          });
        }
        throw error;
      }
    );
  }

  // Helper method to format dates
  formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  // Client operations
  async createClient(clientData) {
    const response = await this.client.post('/clients', clientData);
    return response.data;
  }

  async getClient(clientId) {
    const response = await this.client.get(`/clients/${clientId}`);
    return response.data;
  }

  // Loan operations
  async createLoan(loanData) {
    const response = await this.client.post('/loans', loanData);
    return response.data;
  }

  async approveLoan(loanId, approvalData) {
    const response = await this.client.post(
      `/loans/${loanId}?command=approve`,
      approvalData
    );
    return response.data;
  }

  async disburseLoan(loanId, disbursementData) {
    const response = await this.client.post(
      `/loans/${loanId}?command=disburse`,
      disbursementData
    );
    return response.data;
  }

  async getLoan(loanId, associations = 'repaymentSchedule,transactions') {
    const response = await this.client.get(
      `/loans/${loanId}?associations=${associations}`
    );
    return response.data;
  }

  // Repayment operations
  async postRepayment(loanId, repaymentData) {
    const response = await this.client.post(
      `/loans/${loanId}/transactions?command=repayment`,
      repaymentData
    );
    return response.data;
  }

  // Product operations
  async getProduct(productId) {
    const response = await this.client.get(`/loanproducts/${productId}`);
    return response.data;
  }

  async getProducts() {
    const response = await this.client.get('/loanproducts');
    return response.data;
  }
}

module.exports = FineractTestClient;
```

---

### 2.3 Test Data Generators

```javascript
// test/utils/test-data-generator.js

const { faker } = require('@faker-js/faker');
const config = require('../config/fineract-test-config');

class TestDataGenerator {
  // Generate Zimbabwe National ID
  generateNationalId() {
    const year = faker.number.int({ min: 50, max: 99 });
    const number = faker.number.int({ min: 100000, max: 9999999 });
    const letter = faker.helpers.arrayElement(['A', 'B', 'C', 'D', 'E', 'F']);
    const check = faker.number.int({ min: 10, max: 99 });
    return `${year}-${number}-${letter}-${check}`;
  }

  // Generate Zimbabwe phone number
  generatePhoneNumber() {
    const areaCode = faker.helpers.arrayElement(['77', '78', '71', '73']);
    const number = faker.number.int({ min: 1000000, max: 9999999 });
    return `263${areaCode}${number}`;
  }

  // Generate test client data
  generateClientData() {
    const firstname = faker.person.firstName();
    const lastname = faker.person.lastName();

    return {
      officeId: config.zimbabwe.officeId,
      firstname: firstname,
      lastname: lastname,
      externalId: this.generateNationalId(),
      mobileNo: this.generatePhoneNumber(),
      active: true,
      activationDate: this.formatDate(new Date()),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    };
  }

  // Generate loan data
  generateLoanData(clientId, productId, principal) {
    return {
      clientId: clientId,
      productId: productId,
      principal: principal,
      loanTermFrequency: 8,
      loanTermFrequencyType: 2, // Months
      numberOfRepayments: 8,
      repaymentEvery: 1,
      repaymentFrequencyType: 2, // Months
      interestRatePerPeriod: this.getInterestRateForProduct(productId),
      amortizationType: 1, // Equal installments
      interestType: 0, // Declining balance
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyId: 1,
      loanType: 'individual',
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      submittedOnDate: this.formatDate(new Date()),
      expectedDisbursementDate: this.formatDate(new Date())
    };
  }

  getInterestRateForProduct(productId) {
    if (productId === config.products.lowTier) return 3.33;
    if (productId === config.products.mediumTier) return 2.92;
    if (productId === config.products.highTier) return 2.5;
    return 2.5; // Default
  }

  // Generate repayment data
  generateRepaymentData(amount, date = new Date()) {
    return {
      transactionDate: this.formatDate(date),
      transactionAmount: amount,
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    };
  }

  // Format date helper
  formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }
}

module.exports = TestDataGenerator;
```

---

## 3. Test Cases

### 3.1 Client Management Tests

```javascript
// test/integration/client.test.js

const FineractTestClient = require('../utils/fineract-client');
const TestDataGenerator = require('../utils/test-data-generator');

describe('Client Management', () => {
  let client;
  let testData;
  let createdClientIds = [];

  beforeAll(() => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();
  });

  afterAll(async () => {
    // Cleanup: Delete test clients if configured
    if (config.test.cleanupAfterTests) {
      for (const clientId of createdClientIds) {
        try {
          await client.deleteClient(clientId);
        } catch (error) {
          console.warn(`Failed to cleanup client ${clientId}`);
        }
      }
    }
  });

  describe('TC-CLIENT-001: Create Client', () => {
    it('should create a new client with valid Zimbabwe data', async () => {
      const clientData = testData.generateClientData();

      const result = await client.createClient(clientData);

      expect(result).toHaveProperty('clientId');
      expect(result.clientId).toBeGreaterThan(0);

      createdClientIds.push(result.clientId);
    });

    it('should create client with valid National ID format', async () => {
      const clientData = testData.generateClientData();

      const result = await client.createClient(clientData);
      const createdClient = await client.getClient(result.clientId);

      expect(createdClient.externalId).toMatch(/^\d{2}-\d{6,7}-[A-Z]-\d{2}$/);

      createdClientIds.push(result.clientId);
    });

    it('should create client with valid Zimbabwe phone number', async () => {
      const clientData = testData.generateClientData();

      const result = await client.createClient(clientData);
      const createdClient = await client.getClient(result.clientId);

      expect(createdClient.mobileNo).toMatch(/^263[0-9]{9}$/);

      createdClientIds.push(result.clientId);
    });
  });

  describe('TC-CLIENT-002: Create Client - Validation', () => {
    it('should reject client without firstname', async () => {
      const clientData = testData.generateClientData();
      delete clientData.firstname;

      await expect(client.createClient(clientData)).rejects.toThrow();
    });

    it('should reject client without lastname', async () => {
      const clientData = testData.generateClientData();
      delete clientData.lastname;

      await expect(client.createClient(clientData)).rejects.toThrow();
    });

    it('should reject client with duplicate National ID', async () => {
      const clientData = testData.generateClientData();

      // Create first client
      await client.createClient(clientData);

      // Try to create duplicate
      await expect(client.createClient(clientData)).rejects.toThrow();
    });
  });

  describe('TC-CLIENT-003: Retrieve Client', () => {
    let testClientId;

    beforeAll(async () => {
      const clientData = testData.generateClientData();
      const result = await client.createClient(clientData);
      testClientId = result.clientId;
      createdClientIds.push(testClientId);
    });

    it('should retrieve client by ID', async () => {
      const retrievedClient = await client.getClient(testClientId);

      expect(retrievedClient).toHaveProperty('id', testClientId);
      expect(retrievedClient).toHaveProperty('firstname');
      expect(retrievedClient).toHaveProperty('lastname');
    });

    it('should return 404 for non-existent client', async () => {
      const fakeClientId = 999999;

      await expect(client.getClient(fakeClientId)).rejects.toThrow();
    });
  });
});
```

---

### 3.2 Loan Creation Tests

```javascript
// test/integration/loan-creation.test.js

describe('Loan Creation', () => {
  let client;
  let testData;
  let testClientId;
  let createdLoanIds = [];

  beforeAll(async () => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();

    // Create test client
    const clientData = testData.generateClientData();
    const result = await client.createClient(clientData);
    testClientId = result.clientId;
  });

  describe('TC-LOAN-001: Create Loan - Low Tier', () => {
    it('should create $200 loan for low tier product', async () => {
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.lowTier,
        200
      );

      const result = await client.createLoan(loanData);

      expect(result).toHaveProperty('loanId');
      expect(result.loanId).toBeGreaterThan(0);

      createdLoanIds.push(result.loanId);
    });

    it('should reject $300 loan for low tier product', async () => {
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.lowTier,
        300 // Invalid amount
      );

      await expect(client.createLoan(loanData)).rejects.toThrow();
    });
  });

  describe('TC-LOAN-002: Create Loan - Medium Tier', () => {
    it('should create $350 loan for medium tier product', async () => {
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.mediumTier,
        350
      );

      const result = await client.createLoan(loanData);

      expect(result).toHaveProperty('loanId');
      createdLoanIds.push(result.loanId);
    });
  });

  describe('TC-LOAN-003: Create Loan - High Tier', () => {
    it('should create $500 loan for high tier product', async () => {
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.highTier,
        500
      );

      const result = await client.createLoan(loanData);

      expect(result).toHaveProperty('loanId');
      createdLoanIds.push(result.loanId);
    });
  });

  describe('TC-LOAN-004: Loan Validation', () => {
    it('should reject loan without clientId', async () => {
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.highTier,
        500
      );
      delete loanData.clientId;

      await expect(client.createLoan(loanData)).rejects.toThrow();
    });

    it('should reject loan without productId', async () => {
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.highTier,
        500
      );
      delete loanData.productId;

      await expect(client.createLoan(loanData)).rejects.toThrow();
    });

    it('should reject loan for non-existent client', async () => {
      const loanData = testData.generateLoanData(
        999999, // Non-existent
        config.products.highTier,
        500
      );

      await expect(client.createLoan(loanData)).rejects.toThrow();
    });
  });
});
```

---

### 3.3 Loan Approval and Disbursement Tests

```javascript
// test/integration/loan-approval.test.js

describe('Loan Approval and Disbursement', () => {
  let client;
  let testData;
  let testClientId;
  let testLoanId;

  beforeAll(async () => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();

    // Create test client and loan
    const clientData = testData.generateClientData();
    const clientResult = await client.createClient(clientData);
    testClientId = clientResult.clientId;

    const loanData = testData.generateLoanData(
      testClientId,
      config.products.highTier,
      500
    );
    const loanResult = await client.createLoan(loanData);
    testLoanId = loanResult.loanId;
  });

  describe('TC-APPROVE-001: Approve Loan', () => {
    it('should approve a submitted loan', async () => {
      const approvalData = {
        approvedOnDate: testData.formatDate(new Date()),
        locale: 'en',
        dateFormat: 'dd MMMM yyyy'
      };

      const result = await client.approveLoan(testLoanId, approvalData);

      expect(result).toHaveProperty('changes');
      expect(result.changes).toHaveProperty('status');
    });

    it('should reflect approved status', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan.status.value).toBe('Approved');
      expect(loan.status.approved).toBe(true);
    });
  });

  describe('TC-DISBURSE-001: Disburse Loan', () => {
    it('should disburse an approved loan', async () => {
      const disbursementData = {
        actualDisbursementDate: testData.formatDate(new Date()),
        transactionAmount: 500,
        locale: 'en',
        dateFormat: 'dd MMMM yyyy'
      };

      const result = await client.disburseLoan(testLoanId, disbursementData);

      expect(result).toHaveProperty('changes');
    });

    it('should reflect active status after disbursement', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan.status.value).toBe('Active');
      expect(loan.status.active).toBe(true);
    });

    it('should generate repayment schedule', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan.repaymentSchedule).toBeDefined();
      expect(loan.repaymentSchedule.periods).toHaveLength(9); // 8 payments + 1 disbursement
    });

    it('should calculate correct monthly payment amount', async () => {
      const loan = await client.getLoan(testLoanId);

      // High tier: $500, 30% annual = ~$70.53/month
      const firstPayment = loan.repaymentSchedule.periods[1];
      expect(firstPayment.totalDueForPeriod).toBeCloseTo(70.53, 2);
    });
  });

  describe('TC-DISBURSE-002: Disbursement Validation', () => {
    it('should reject disbursement of non-approved loan', async () => {
      // Create new loan (not approved)
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.highTier,
        500
      );
      const loanResult = await client.createLoan(loanData);

      const disbursementData = {
        actualDisbursementDate: testData.formatDate(new Date()),
        transactionAmount: 500,
        locale: 'en',
        dateFormat: 'dd MMMM yyyy'
      };

      await expect(
        client.disburseLoan(loanResult.loanId, disbursementData)
      ).rejects.toThrow();
    });

    it('should reject disbursement with wrong amount', async () => {
      // Create and approve loan
      const loanData = testData.generateLoanData(
        testClientId,
        config.products.highTier,
        500
      );
      const loanResult = await client.createLoan(loanData);
      await client.approveLoan(loanResult.loanId, {
        approvedOnDate: testData.formatDate(new Date()),
        locale: 'en',
        dateFormat: 'dd MMMM yyyy'
      });

      const disbursementData = {
        actualDisbursementDate: testData.formatDate(new Date()),
        transactionAmount: 600, // Wrong amount
        locale: 'en',
        dateFormat: 'dd MMMM yyyy'
      };

      await expect(
        client.disburseLoan(loanResult.loanId, disbursementData)
      ).rejects.toThrow();
    });
  });
});
```

---

### 3.4 Repayment Tests

```javascript
// test/integration/repayment.test.js

describe('Repayment Processing', () => {
  let client;
  let testData;
  let testLoanId;

  beforeAll(async () => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();

    // Create, approve, and disburse loan
    const clientData = testData.generateClientData();
    const clientResult = await client.createClient(clientData);

    const loanData = testData.generateLoanData(
      clientResult.clientId,
      config.products.highTier,
      500
    );
    const loanResult = await client.createLoan(loanData);
    testLoanId = loanResult.loanId;

    await client.approveLoan(testLoanId, {
      approvedOnDate: testData.formatDate(new Date()),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    await client.disburseLoan(testLoanId, {
      actualDisbursementDate: testData.formatDate(new Date()),
      transactionAmount: 500,
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });
  });

  describe('TC-REPAY-001: Full Payment', () => {
    it('should process full monthly payment', async () => {
      const repaymentData = testData.generateRepaymentData(70.53);

      const result = await client.postRepayment(testLoanId, repaymentData);

      expect(result).toHaveProperty('resourceId');
    });

    it('should update loan balance after payment', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan.summary.totalOutstanding).toBeLessThan(500);
    });
  });

  describe('TC-REPAY-002: Partial Payment', () => {
    it('should accept partial payment', async () => {
      const repaymentData = testData.generateRepaymentData(30.00);

      const result = await client.postRepayment(testLoanId, repaymentData);

      expect(result).toHaveProperty('resourceId');
    });

    it('should reflect partial payment in outstanding balance', async () => {
      const loanBefore = await client.getLoan(testLoanId);
      const balanceBefore = loanBefore.summary.totalOutstanding;

      await client.postRepayment(testLoanId, testData.generateRepaymentData(20.00));

      const loanAfter = await client.getLoan(testLoanId);
      const balanceAfter = loanAfter.summary.totalOutstanding;

      expect(balanceAfter).toBeCloseTo(balanceBefore - 20, 2);
    });
  });

  describe('TC-REPAY-003: Overpayment', () => {
    it('should accept overpayment', async () => {
      const repaymentData = testData.generateRepaymentData(100.00);

      const result = await client.postRepayment(testLoanId, repaymentData);

      expect(result).toHaveProperty('resourceId');
    });

    it('should apply overpayment to next installment', async () => {
      const loan = await client.getLoan(testLoanId);

      // Check if overpayment was applied
      expect(loan.summary.totalOutstanding).toBeLessThan(
        loan.summary.principalOutstanding + loan.summary.interestOutstanding
      );
    });
  });

  describe('TC-REPAY-004: Multiple Payments Same Day', () => {
    it('should process multiple payments on same day', async () => {
      const payment1 = await client.postRepayment(
        testLoanId,
        testData.generateRepaymentData(20.00)
      );

      const payment2 = await client.postRepayment(
        testLoanId,
        testData.generateRepaymentData(30.00)
      );

      expect(payment1.resourceId).not.toBe(payment2.resourceId);
    });
  });

  describe('TC-REPAY-005: Repayment Validation', () => {
    it('should reject negative payment amount', async () => {
      const repaymentData = testData.generateRepaymentData(-50.00);

      await expect(
        client.postRepayment(testLoanId, repaymentData)
      ).rejects.toThrow();
    });

    it('should reject zero payment amount', async () => {
      const repaymentData = testData.generateRepaymentData(0);

      await expect(
        client.postRepayment(testLoanId, repaymentData)
      ).rejects.toThrow();
    });

    it('should reject payment for non-existent loan', async () => {
      const repaymentData = testData.generateRepaymentData(50.00);

      await expect(
        client.postRepayment(999999, repaymentData)
      ).rejects.toThrow();
    });
  });
});
```

---

### 3.5 Account Query Tests

```javascript
// test/integration/account-query.test.js

describe('Account Queries', () => {
  let client;
  let testData;
  let testLoanId;

  beforeAll(async () => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();

    // Create full loan with some repayments
    const clientData = testData.generateClientData();
    const clientResult = await client.createClient(clientData);

    const loanData = testData.generateLoanData(
      clientResult.clientId,
      config.products.mediumTier,
      350
    );
    const loanResult = await client.createLoan(loanData);
    testLoanId = loanResult.loanId;

    await client.approveLoan(testLoanId, {
      approvedOnDate: testData.formatDate(new Date()),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    await client.disburseLoan(testLoanId, {
      actualDisbursementDate: testData.formatDate(new Date()),
      transactionAmount: 350,
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    // Make a payment
    await client.postRepayment(testLoanId, testData.generateRepaymentData(49.23));
  });

  describe('TC-QUERY-001: Get Loan Summary', () => {
    it('should retrieve loan with summary fields', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan).toHaveProperty('summary');
      expect(loan.summary).toHaveProperty('principalDisbursed');
      expect(loan.summary).toHaveProperty('totalOutstanding');
      expect(loan.summary).toHaveProperty('totalRepayment');
    });

    it('should have correct principal disbursed', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan.summary.principalDisbursed).toBe(350);
    });

    it('should calculate outstanding balance correctly', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan.summary.totalOutstanding).toBeLessThan(350);
      expect(loan.summary.totalOutstanding).toBeGreaterThan(0);
    });
  });

  describe('TC-QUERY-002: Get Repayment Schedule', () => {
    it('should retrieve repayment schedule', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan).toHaveProperty('repaymentSchedule');
      expect(loan.repaymentSchedule).toHaveProperty('periods');
    });

    it('should have 9 periods (1 disbursement + 8 payments)', async () => {
      const loan = await client.getLoan(testLoanId);

      expect(loan.repaymentSchedule.periods).toHaveLength(9);
    });

    it('should mark first payment as partially paid', async () => {
      const loan = await client.getLoan(testLoanId);

      const firstPayment = loan.repaymentSchedule.periods[1];
      expect(firstPayment.totalPaidForPeriod).toBeGreaterThan(0);
      expect(firstPayment.totalOutstandingForPeriod).toBeGreaterThan(0);
    });
  });

  describe('TC-QUERY-003: Get Transaction History', () => {
    it('should retrieve transaction history', async () => {
      const loan = await client.getLoan(testLoanId, 'transactions');

      expect(loan).toHaveProperty('transactions');
      expect(Array.isArray(loan.transactions)).toBe(true);
    });

    it('should include disbursement transaction', async () => {
      const loan = await client.getLoan(testLoanId, 'transactions');

      const disbursement = loan.transactions.find(
        t => t.type.value === 'Disbursement'
      );

      expect(disbursement).toBeDefined();
      expect(disbursement.amount).toBe(350);
    });

    it('should include repayment transactions', async () => {
      const loan = await client.getLoan(testLoanId, 'transactions');

      const repayments = loan.transactions.filter(
        t => t.type.value === 'Repayment'
      );

      expect(repayments.length).toBeGreaterThan(0);
    });
  });

  describe('TC-QUERY-004: Query Performance', () => {
    it('should retrieve loan data within 2 seconds', async () => {
      const startTime = Date.now();

      await client.getLoan(testLoanId, 'repaymentSchedule,transactions');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });
});
```

---

### 3.6 Complete Loan Lifecycle Test

```javascript
// test/integration/loan-lifecycle.test.js

describe('Complete Loan Lifecycle', () => {
  let client;
  let testData;

  beforeAll(() => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();
  });

  describe('TC-LIFECYCLE-001: Full Loan Cycle', () => {
    it('should complete entire loan lifecycle', async () => {
      // Step 1: Create client
      const clientData = testData.generateClientData();
      const clientResult = await client.createClient(clientData);
      expect(clientResult.clientId).toBeGreaterThan(0);
      const clientId = clientResult.clientId;

      // Step 2: Create loan
      const loanData = testData.generateLoanData(
        clientId,
        config.products.lowTier,
        200
      );
      const loanResult = await client.createLoan(loanData);
      expect(loanResult.loanId).toBeGreaterThan(0);
      const loanId = loanResult.loanId;

      // Step 3: Approve loan
      await client.approveLoan(loanId, {
        approvedOnDate: testData.formatDate(new Date()),
        locale: 'en',
        dateFormat: 'dd MMMM yyyy'
      });

      let loan = await client.getLoan(loanId);
      expect(loan.status.value).toBe('Approved');

      // Step 4: Disburse loan
      await client.disburseLoan(loanId, {
        actualDisbursementDate: testData.formatDate(new Date()),
        transactionAmount: 200,
        locale: 'en',
        dateFormat: 'dd MMMM yyyy'
      });

      loan = await client.getLoan(loanId);
      expect(loan.status.value).toBe('Active');

      // Step 5: Make all 8 payments
      const monthlyPayment = 28.13;

      for (let i = 0; i < 8; i++) {
        await client.postRepayment(
          loanId,
          testData.generateRepaymentData(monthlyPayment)
        );
      }

      // Step 6: Verify loan is closed
      loan = await client.getLoan(loanId);
      expect(loan.status.closed).toBe(true);
      expect(loan.summary.totalOutstanding).toBeCloseTo(0, 2);
    });
  });
});
```

---

## 4. Edge Cases and Error Scenarios

### 4.1 Concurrency Tests

```javascript
// test/integration/concurrency.test.js

describe('Concurrency and Race Conditions', () => {
  let client;
  let testData;
  let testLoanId;

  beforeAll(async () => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();

    // Setup active loan
    const clientData = testData.generateClientData();
    const clientResult = await client.createClient(clientData);

    const loanData = testData.generateLoanData(
      clientResult.clientId,
      config.products.highTier,
      500
    );
    const loanResult = await client.createLoan(loanData);
    testLoanId = loanResult.loanId;

    await client.approveLoan(testLoanId, {
      approvedOnDate: testData.formatDate(new Date()),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    await client.disburseLoan(testLoanId, {
      actualDisbursementDate: testData.formatDate(new Date()),
      transactionAmount: 500,
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });
  });

  describe('TC-CONCURRENCY-001: Simultaneous Payments', () => {
    it('should handle simultaneous payment submissions', async () => {
      const payment1Promise = client.postRepayment(
        testLoanId,
        testData.generateRepaymentData(35.00)
      );

      const payment2Promise = client.postRepayment(
        testLoanId,
        testData.generateRepaymentData(35.00)
      );

      const [result1, result2] = await Promise.all([
        payment1Promise,
        payment2Promise
      ]);

      // Both payments should succeed
      expect(result1.resourceId).toBeDefined();
      expect(result2.resourceId).toBeDefined();

      // Verify total payment amount
      const loan = await client.getLoan(testLoanId);
      const totalPaid = 500 - loan.summary.totalOutstanding;
      expect(totalPaid).toBeCloseTo(70, 2);
    });
  });

  describe('TC-CONCURRENCY-002: Simultaneous Queries', () => {
    it('should handle multiple simultaneous queries', async () => {
      const queries = Array(10).fill(null).map(() =>
        client.getLoan(testLoanId)
      );

      const results = await Promise.all(queries);

      // All queries should return same data
      const firstBalance = results[0].summary.totalOutstanding;
      results.forEach(result => {
        expect(result.summary.totalOutstanding).toBe(firstBalance);
      });
    });
  });
});
```

---

### 4.2 Idempotency Tests

```javascript
// test/integration/idempotency.test.js

describe('Idempotency', () => {
  let client;
  let testData;
  let testLoanId;

  beforeAll(async () => {
    client = new FineractTestClient();
    testData = new TestDataGenerator();

    // Setup active loan
    const clientData = testData.generateClientData();
    const clientResult = await client.createClient(clientData);

    const loanData = testData.generateLoanData(
      clientResult.clientId,
      config.products.highTier,
      500
    );
    const loanResult = await client.createLoan(loanData);
    testLoanId = loanResult.loanId;

    await client.approveLoan(testLoanId, {
      approvedOnDate: testData.formatDate(new Date()),
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });

    await client.disburseLoan(testLoanId, {
      actualDisbursementDate: testData.formatDate(new Date()),
      transactionAmount: 500,
      locale: 'en',
      dateFormat: 'dd MMMM yyyy'
    });
  });

  describe('TC-IDEMPOTENCY-001: Duplicate Payment Detection', () => {
    it('should detect duplicate payments using checkNumber', async () => {
      const txnId = `ECOCASH-${Date.now()}`;

      const repaymentData = {
        ...testData.generateRepaymentData(70.53),
        checkNumber: txnId // Use as idempotency key
      };

      // First payment
      const result1 = await client.postRepayment(testLoanId, repaymentData);
      expect(result1.resourceId).toBeDefined();

      // Duplicate payment (same checkNumber)
      await expect(
        client.postRepayment(testLoanId, repaymentData)
      ).rejects.toThrow();
    });
  });
});
```

---

## 5. Running the Tests

### 5.1 Test Execution Script

```javascript
// test/run-tests.js

const { execSync } = require('child_process');

const environments = process.env.TEST_ENV || 'local';
const testSuite = process.env.TEST_SUITE || 'all';

console.log(`🧪 Running tests on ${environments} environment...`);
console.log(`📦 Test suite: ${testSuite}\n`);

const testCommands = {
  all: 'jest test/integration',
  client: 'jest test/integration/client.test.js',
  loan: 'jest test/integration/loan-*.test.js',
  repayment: 'jest test/integration/repayment.test.js',
  query: 'jest test/integration/account-query.test.js',
  lifecycle: 'jest test/integration/loan-lifecycle.test.js'
};

const command = testCommands[testSuite] || testCommands.all;

try {
  execSync(command, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: environments
    }
  });

  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('\n❌ Tests failed!');
  process.exit(1);
}
```

**Usage:**
```bash
# Run all tests on local
npm test

# Run specific test suite
TEST_SUITE=client npm test

# Run on staging
TEST_ENV=staging npm test

# Run with coverage
npm run test:coverage
```

---

### 5.2 package.json Scripts

```json
{
  "scripts": {
    "test": "node test/run-tests.js",
    "test:local": "TEST_ENV=local npm test",
    "test:staging": "TEST_ENV=staging npm test",
    "test:client": "TEST_SUITE=client npm test",
    "test:loan": "TEST_SUITE=loan npm test",
    "test:repayment": "TEST_SUITE=repayment npm test",
    "test:query": "TEST_SUITE=query npm test",
    "test:lifecycle": "TEST_SUITE=lifecycle npm test",
    "test:coverage": "jest --coverage test/integration",
    "test:watch": "jest --watch test/integration"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "axios": "^1.6.0",
    "@faker-js/faker": "^8.3.1",
    "dotenv": "^16.3.1",
    "chai": "^4.3.10"
  }
}
```

---

## 6. Test Report Template

### 6.1 Test Execution Report

```markdown
# Fineract Integration Test Report

**Date:** 2025-11-10
**Environment:** Staging
**Executed By:** Claude Test Suite v1.0

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 45 |
| Passed | 43 |
| Failed | 2 |
| Skipped | 0 |
| Duration | 2m 15s |
| Coverage | 87% |

---

## Test Results by Category

### Client Management (8 tests)
✅ Passed: 8/8 (100%)

- TC-CLIENT-001: Create Client ✅
- TC-CLIENT-002: Create Client Validation ✅
- TC-CLIENT-003: Retrieve Client ✅

### Loan Creation (12 tests)
✅ Passed: 12/12 (100%)

- TC-LOAN-001: Low Tier ✅
- TC-LOAN-002: Medium Tier ✅
- TC-LOAN-003: High Tier ✅
- TC-LOAN-004: Validation ✅

### Loan Approval (6 tests)
✅ Passed: 5/6 (83%)

- TC-APPROVE-001: Approve Loan ✅
- TC-DISBURSE-001: Disburse Loan ✅
- TC-DISBURSE-002: Validation ❌ (1 failure)

### Repayment Processing (10 tests)
✅ Passed: 9/10 (90%)

- TC-REPAY-001: Full Payment ✅
- TC-REPAY-002: Partial Payment ✅
- TC-REPAY-003: Overpayment ✅
- TC-REPAY-004: Multiple Payments ❌ (1 failure)
- TC-REPAY-005: Validation ✅

### Account Queries (9 tests)
✅ Passed: 9/9 (100%)

- TC-QUERY-001: Loan Summary ✅
- TC-QUERY-002: Repayment Schedule ✅
- TC-QUERY-003: Transaction History ✅
- TC-QUERY-004: Performance ✅

---

## Failed Tests

### TC-DISBURSE-002: Wrong Amount Rejection
**Status:** ❌ Failed
**Expected:** API should reject disbursement with wrong amount
**Actual:** API accepted $600 disbursement for $500 loan
**Severity:** High
**Action:** Report to Fineract team, add application-level validation

### TC-REPAY-004: Multiple Same-Day Payments
**Status:** ❌ Failed
**Expected:** Second payment processed independently
**Actual:** Second payment merged with first
**Severity:** Medium
**Action:** Investigate transaction timestamp handling

---

## Recommendations

1. Add application-level validation for disbursement amounts
2. Implement idempotency keys for payment deduplication
3. Increase test coverage for edge cases
4. Add performance benchmarks for query operations
5. Set up automated test execution in CI/CD pipeline

---

**Report Generated:** 2025-11-10 14:30:00 UTC
```

---

## 7. Continuous Integration Setup

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/fineract-tests.yml

name: Fineract Integration Tests

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master, develop ]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        environment: [local, staging]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        env:
          TEST_ENV: ${{ matrix.environment }}
          FINERACT_BASE_URL: ${{ secrets.FINERACT_BASE_URL }}
          FINERACT_USERNAME: ${{ secrets.FINERACT_USERNAME }}
          FINERACT_PASSWORD: ${{ secrets.FINERACT_PASSWORD }}
        run: npm test

      - name: Generate coverage report
        if: matrix.environment == 'staging'
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        if: matrix.environment == 'staging'
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Fineract integration tests failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 8. Completion Checklist

- [x] Define testing strategy and test pyramid
- [x] Set up test environments (local, staging, production)
- [x] Create test configuration and utilities
- [x] Implement test data generators
- [x] Write client management tests
- [x] Write loan creation tests
- [x] Write loan approval and disbursement tests
- [x] Write repayment processing tests
- [x] Write account query tests
- [x] Write complete loan lifecycle test
- [x] Write concurrency and edge case tests
- [x] Create test execution scripts
- [x] Document test report template
- [x] Set up CI/CD integration

---

## 9. Mark as Complete

**Status:** ✅ **Research COMPLETE**

We have:
- ✅ Comprehensive integration test plan
- ✅ 45+ test cases covering all Fineract APIs
- ✅ Test utilities and data generators
- ✅ Automated test execution scripts
- ✅ CI/CD integration with GitHub Actions
- ✅ Test reporting templates
- ✅ Edge case and concurrency tests

**Recommendation:** Mark GitHub issue #9 (T006) as **COMPLETE** and proceed to T007 (WhatsApp Cloud API Research).

---

**Research completed by:** Claude
**Date:** 2025-11-10
**Next:** T007 - Research WhatsApp Cloud API message sending
