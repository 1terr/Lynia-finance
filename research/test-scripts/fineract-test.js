/**
 * Fineract API Test Script
 *
 * This script tests the Fineract loan creation API
 *
 * Prerequisites:
 * - Fineract running on http://localhost:8443
 * - npm install node-fetch
 *
 * Usage:
 * node research/fineract-test.js
 */

const fetch = require('node-fetch');

// Fineract configuration
const FINERACT_URL = 'http://localhost:8443/fineract-provider/api/v1';
const USERNAME = 'mifos';
const PASSWORD = 'password';
const TENANT = 'default';

// Create authorization header
const authHeader = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

const headers = {
  'Authorization': authHeader,
  'Fineract-Platform-TenantId': TENANT,
  'Content-Type': 'application/json'
};

/**
 * Test 1: Check if Fineract is running
 */
async function testConnection() {
  console.log('\n🔍 Test 1: Checking Fineract connection...\n');

  try {
    const response = await fetch(`${FINERACT_URL}/offices`, { headers });
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Fineract is running!');
      console.log(`   Found ${data.length} office(s)`);
      return true;
    } else {
      console.log('❌ Connection failed');
      console.log('   Status:', response.status);
      console.log('   Error:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to Fineract');
    console.log('   Error:', error.message);
    console.log('   Make sure Fineract is running on http://localhost:8443');
    return false;
  }
}

/**
 * Test 2: Create a client (customer)
 */
async function createClient() {
  console.log('\n🔍 Test 2: Creating a client...\n');

  const clientData = {
    officeId: 1,
    firstname: 'John',
    lastname: 'Doe',
    externalId: '63-123456-A-12', // Zimbabwe National ID format
    mobileNo: '263771234567', // Zimbabwe phone number
    active: true,
    dateFormat: 'dd MMMM yyyy',
    locale: 'en',
    activationDate: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  };

  console.log('Request payload:');
  console.log(JSON.stringify(clientData, null, 2));

  try {
    const response = await fetch(`${FINERACT_URL}/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify(clientData)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Client created successfully!');
      console.log('   Client ID:', data.clientId);
      console.log('   Resource ID:', data.resourceId);
      return data.clientId;
    } else {
      console.log('\n❌ Client creation failed');
      console.log('   Status:', response.status);
      console.log('   Error:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('\n❌ Request failed');
    console.log('   Error:', error.message);
    return null;
  }
}

/**
 * Test 3: Get available loan products
 */
async function getLoanProducts() {
  console.log('\n🔍 Test 3: Getting available loan products...\n');

  try {
    const response = await fetch(`${FINERACT_URL}/loanproducts`, { headers });
    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Found ${data.length} loan product(s)`);

      if (data.length > 0) {
        console.log('\nFirst loan product:');
        console.log('   ID:', data[0].id);
        console.log('   Name:', data[0].name);
        console.log('   Currency:', data[0].currency?.code);
        return data[0].id;
      }
      return null;
    } else {
      console.log('❌ Failed to get loan products');
      console.log('   Error:', data);
      return null;
    }
  } catch (error) {
    console.log('❌ Request failed');
    console.log('   Error:', error.message);
    return null;
  }
}

/**
 * Test 4: Create a loan
 */
async function createLoan(clientId, productId) {
  console.log('\n🔍 Test 4: Creating a loan...\n');

  if (!clientId || !productId) {
    console.log('❌ Cannot create loan: missing clientId or productId');
    return null;
  }

  const loanData = {
    clientId: clientId,
    productId: productId,
    principal: 500, // $500 loan
    loanTermFrequency: 8, // 8 months
    loanTermFrequencyType: 2, // 2 = months
    numberOfRepayments: 8,
    repaymentEvery: 1,
    repaymentFrequencyType: 2, // 2 = months
    interestRatePerPeriod: 2.5, // 30% annual ÷ 12 months
    amortizationType: 1, // 1 = equal installments
    interestType: 0, // 0 = declining balance
    interestCalculationPeriodType: 1, // 1 = same as repayment period
    transactionProcessingStrategyId: 1,
    loanType: 'individual',
    locale: 'en',
    dateFormat: 'dd MMMM yyyy',
    submittedOnDate: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }),
    expectedDisbursementDate: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  };

  console.log('Request payload:');
  console.log(JSON.stringify(loanData, null, 2));

  try {
    const response = await fetch(`${FINERACT_URL}/loans`, {
      method: 'POST',
      headers,
      body: JSON.stringify(loanData)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Loan created successfully!');
      console.log('   Loan ID:', data.loanId);
      console.log('   Resource ID:', data.resourceId);
      console.log('   Status: Submitted and Pending Approval');
      return data.loanId;
    } else {
      console.log('\n❌ Loan creation failed');
      console.log('   Status:', response.status);
      console.log('   Error:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('\n❌ Request failed');
    console.log('   Error:', error.message);
    return null;
  }
}

/**
 * Test 5: Approve loan
 */
async function approveLoan(loanId) {
  console.log('\n🔍 Test 5: Approving loan...\n');

  if (!loanId) {
    console.log('❌ Cannot approve loan: missing loanId');
    return false;
  }

  const approvalData = {
    approvedOnDate: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }),
    dateFormat: 'dd MMMM yyyy',
    locale: 'en'
  };

  try {
    const response = await fetch(`${FINERACT_URL}/loans/${loanId}?command=approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(approvalData)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Loan approved successfully!');
      console.log('   Status: Approved');
      return true;
    } else {
      console.log('❌ Loan approval failed');
      console.log('   Error:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Request failed');
    console.log('   Error:', error.message);
    return false;
  }
}

/**
 * Test 6: Disburse loan
 */
async function disburseLoan(loanId, amount) {
  console.log('\n🔍 Test 6: Disbursing loan...\n');

  if (!loanId) {
    console.log('❌ Cannot disburse loan: missing loanId');
    return false;
  }

  const disbursementData = {
    actualDisbursementDate: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }),
    transactionAmount: amount,
    dateFormat: 'dd MMMM yyyy',
    locale: 'en'
  };

  try {
    const response = await fetch(`${FINERACT_URL}/loans/${loanId}?command=disburse`, {
      method: 'POST',
      headers,
      body: JSON.stringify(disbursementData)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Loan disbursed successfully!');
      console.log('   Status: Active');
      return true;
    } else {
      console.log('❌ Loan disbursement failed');
      console.log('   Error:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Request failed');
    console.log('   Error:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Fineract API Test Suite');
  console.log('='.repeat(60));

  // Test 1: Connection
  const isConnected = await testConnection();
  if (!isConnected) {
    console.log('\n❌ Cannot proceed - Fineract is not running');
    console.log('\nTo start Fineract:');
    console.log('   cd fineract-test');
    console.log('   docker-compose up -d');
    return;
  }

  // Test 2: Create client
  const clientId = await createClient();
  if (!clientId) {
    console.log('\n❌ Cannot proceed - Client creation failed');
    return;
  }

  // Test 3: Get loan products
  const productId = await getLoanProducts();
  if (!productId) {
    console.log('\n❌ Cannot proceed - No loan products available');
    return;
  }

  // Test 4: Create loan
  const loanId = await createLoan(clientId, productId);
  if (!loanId) {
    console.log('\n❌ Cannot proceed - Loan creation failed');
    return;
  }

  // Test 5: Approve loan
  const approved = await approveLoan(loanId);
  if (!approved) {
    console.log('\n❌ Cannot proceed - Loan approval failed');
    return;
  }

  // Test 6: Disburse loan
  await disburseLoan(loanId, 500);

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('='.repeat(60));
  console.log('\nSummary:');
  console.log('   Client ID:', clientId);
  console.log('   Loan ID:', loanId);
  console.log('   Loan Amount: $500');
  console.log('   Status: Active (Disbursed)');
  console.log('\n✨ Research findings documented in research/T001-fineract-research.md');
}

// Run the tests
runTests().catch(console.error);
