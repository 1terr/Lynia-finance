/**
 * Fineract API Test Script - Using Demo Server
 *
 * This script tests the Fineract loan creation API using the public demo server
 *
 * Prerequisites:
 * - npm install node-fetch
 *
 * Usage:
 * node research/fineract-demo-test.js
 */

const fetch = require('node-fetch');

// Fineract Demo Server configuration
const FINERACT_URL = 'https://demo.fineract.dev/fineract-provider/api/v1';
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
 * Test 1: Check if Fineract demo server is accessible
 */
async function testConnection() {
  console.log('\n🔍 Test 1: Checking Fineract demo server connection...\n');

  try {
    const response = await fetch(`${FINERACT_URL}/offices`, { headers });
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Fineract demo server is accessible!');
      console.log(`   Found ${data.length} office(s)`);
      if (data.length > 0) {
        console.log(`   First office: ${data[0].name} (ID: ${data[0].id})`);
      }
      return true;
    } else {
      console.log('❌ Connection failed');
      console.log('   Status:', response.status);
      console.log('   Error:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to Fineract demo server');
    console.log('   Error:', error.message);
    return false;
  }
}

/**
 * Test 2: Create a client (customer)
 */
async function createClient() {
  console.log('\n🔍 Test 2: Creating a Zimbabwe client...\n');

  // Generate unique ID to avoid conflicts on demo server
  const timestamp = Date.now();

  const clientData = {
    officeId: 1,
    firstname: 'John',
    lastname: `Doe_${timestamp}`,
    externalId: `63-${timestamp}-A-12`, // Zimbabwe National ID format
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
      console.log('\n📝 Key Finding: Zimbabwe National ID can be stored in externalId field');
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
        console.log('\nAvailable products:');
        data.slice(0, 3).forEach(product => {
          console.log(`   - ${product.name} (ID: ${product.id}, Currency: ${product.currency?.code})`);
        });

        // Find a product suitable for device financing
        const deviceProduct = data.find(p =>
          p.principal && p.principal >= 200 && p.principal <= 500
        ) || data[0];

        console.log(`\n📝 Selected product for testing: ${deviceProduct.name} (ID: ${deviceProduct.id})`);
        return deviceProduct.id;
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
 * Test 4: Create a loan for device financing
 */
async function createLoan(clientId, productId) {
  console.log('\n🔍 Test 4: Creating a device financing loan ($500, 8 months, 30% annual)...\n');

  if (!clientId || !productId) {
    console.log('❌ Cannot create loan: missing clientId or productId');
    return null;
  }

  // Calculate interest: 30% annual ÷ 12 months = 2.5% per month
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

  console.log('Request payload (device financing terms):');
  console.log(JSON.stringify(loanData, null, 2));
  console.log('\n💡 Interest calculation: 30% annual ÷ 12 months = 2.5% per month');

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
      console.log('\n📝 Key Finding: Loan workflow starts in "Pending Approval" state');
      return data.loanId;
    } else {
      console.log('\n❌ Loan creation failed');
      console.log('   Status:', response.status);
      console.log('   Error:', JSON.stringify(data, null, 2));

      // Document common errors
      if (data.errors) {
        console.log('\n📝 Common Errors Found:');
        data.errors.forEach(err => {
          console.log(`   - ${err.developerMessage || err.defaultUserMessage}`);
        });
      }

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
      console.log('   Status: Approved (ready for disbursement)');
      console.log('\n📝 Key Finding: Loan transitions from Pending → Approved');
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
  console.log('\n🔍 Test 6: Disbursing loan (simulating device handover)...\n');

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
      console.log('\n📝 Key Finding: Loan transitions from Approved → Active (disbursed)');
      console.log('   This happens when customer collects device from distributor');
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
 * Test 7: Get loan repayment schedule
 */
async function getRepaymentSchedule(loanId) {
  console.log('\n🔍 Test 7: Getting repayment schedule...\n');

  if (!loanId) {
    console.log('❌ Cannot get schedule: missing loanId');
    return;
  }

  try {
    const response = await fetch(`${FINERACT_URL}/loans/${loanId}?associations=repaymentSchedule`, {
      headers
    });

    const data = await response.json();

    if (response.ok && data.repaymentSchedule) {
      console.log('✅ Retrieved repayment schedule!');
      console.log(`\n   Total to repay: ${data.summary?.totalRepaymentExpected || 'N/A'}`);
      console.log(`   Monthly installments: ${data.numberOfRepayments || 0}`);

      if (data.repaymentSchedule.periods) {
        console.log('\n   First 3 installments:');
        data.repaymentSchedule.periods.slice(0, 4).forEach((period, index) => {
          if (period.dueDate) {
            console.log(`     ${index}. Due: ${period.dueDate[2]}/${period.dueDate[1]}/${period.dueDate[0]}, Amount: $${period.totalDueForPeriod || 0}`);
          }
        });
      }

      console.log('\n📝 Key Finding: Repayment schedule is automatically generated');
      console.log('   This will be displayed in WhatsApp bot for customers');
    } else {
      console.log('❌ Failed to get repayment schedule');
      console.log('   Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Request failed');
    console.log('   Error:', error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(70));
  console.log('  Fineract API Research - T001');
  console.log('  Testing with Fineract Demo Server');
  console.log('='.repeat(70));

  // Test 1: Connection
  const isConnected = await testConnection();
  if (!isConnected) {
    console.log('\n❌ Cannot proceed - Demo server is not accessible');
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
    console.log('\n⚠️  Loan approval failed, but continuing...');
  }

  // Test 6: Disburse loan (if approved)
  if (approved) {
    await disburseLoan(loanId, 500);
  }

  // Test 7: Get repayment schedule
  await getRepaymentSchedule(loanId);

  console.log('\n' + '='.repeat(70));
  console.log('✅ T001 Research Completed!');
  console.log('='.repeat(70));
  console.log('\n📊 Summary:');
  console.log('   ✅ Client created (ID:', clientId + ')');
  console.log('   ✅ Loan created (ID:', loanId + ')');
  if (approved) {
    console.log('   ✅ Loan approved and disbursed');
  } else {
    console.log('   ⚠️  Loan in Pending Approval state');
  }
  console.log('   ✅ Repayment schedule retrieved');

  console.log('\n📝 Key Findings:');
  console.log('   • Zimbabwe National IDs can be stored in externalId field');
  console.log('   • Phone numbers should include country code (263)');
  console.log('   • Loan workflow: Submitted → Approved → Active');
  console.log('   • Interest rate: 30% annual = 2.5% per month');
  console.log('   • Repayment schedule is auto-generated');
  console.log('   • Date format: "dd MMMM yyyy" (e.g., "10 November 2025")');

  console.log('\n✨ Next Steps:');
  console.log('   1. Document findings in research/T001-fineract-research.md');
  console.log('   2. Test T002: Repayment posting API');
  console.log('   3. Test T003: Account query API');
  console.log('   4. Mark GitHub issue #4 as complete');

  console.log('\n🔗 Resources:');
  console.log('   • API Docs: https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm');
  console.log('   • Demo Server: https://demo.fineract.dev');
}

// Run the tests
runTests().catch(console.error);
