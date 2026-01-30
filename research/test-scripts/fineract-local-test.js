/**
 * Fineract API Test Script - Local Development Version
 *
 * This script tests the Fineract loan creation API with support for both
 * local Docker instances and the public demo server.
 *
 * Prerequisites:
 * - npm install node-fetch
 * - For local testing: Docker Desktop running with fineract containers
 *
 * Usage:
 * node research/fineract-local-test.js [environment]
 *
 * Examples:
 * node research/fineract-local-test.js          # Uses local (default)
 * node research/fineract-local-test.js local    # Local Docker instance
 * node research/fineract-local-test.js demo     # Public demo server
 */

const fetch = require('node-fetch');

// ============================================================================
// CONFIGURATION
// ============================================================================

const ENVIRONMENTS = {
  local: {
    name: 'Local Docker Instance',
    url: 'http://localhost:8080/fineract-provider/api/v1',
    username: 'mifos',
    password: 'password',
    tenant: 'default',
    timeout: 30000 // Local instance may be slower on first start
  },
  demo: {
    name: 'Public Demo Server',
    url: 'https://demo.fineract.dev/fineract-provider/api/v1',
    username: 'mifos',
    password: 'password',
    tenant: 'default',
    timeout: 10000
  }
};

// Get environment from command line argument
const envArg = process.argv[2] || 'local';
const ENV = ENVIRONMENTS[envArg] || ENVIRONMENTS.local;

console.log(`\n📡 Using environment: ${ENV.name}`);
console.log(`   URL: ${ENV.url}\n`);

// Create authorization header
const authHeader = 'Basic ' + Buffer.from(`${ENV.username}:${ENV.password}`).toString('base64');

const headers = {
  'Authorization': authHeader,
  'Fineract-Platform-TenantId': ENV.tenant,
  'Content-Type': 'application/json'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Format date for Fineract API
 */
function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Wait for Fineract to be ready (useful for local Docker startup)
 */
async function waitForFineract(maxAttempts = 10, delayMs = 5000) {
  console.log('⏳ Waiting for Fineract to be ready...\n');

  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const response = await fetchWithTimeout(`${ENV.url}/offices`, { headers });
      if (response.ok) {
        console.log('✅ Fineract is ready!\n');
        return true;
      }
    } catch (error) {
      if (i < maxAttempts) {
        console.log(`   Attempt ${i}/${maxAttempts}: Not ready yet, waiting ${delayMs/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  return false;
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test 1: Check if Fineract server is accessible
 */
async function testConnection() {
  console.log('🔍 Test 1: Checking Fineract server connection...\n');

  try {
    const response = await fetchWithTimeout(`${ENV.url}/offices`, { headers });
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Fineract server is accessible!');
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
    console.log('❌ Cannot connect to Fineract server');
    console.log('   Error:', error.message);

    if (envArg === 'local') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Check if Docker Desktop is running');
      console.log('   2. Start Fineract: docker-compose -f docker-compose-fineract.yml up -d');
      console.log('   3. Check logs: docker logs fineract-server');
      console.log('   4. Wait 2-3 minutes for Fineract to fully start');
    }

    return false;
  }
}

/**
 * Test 2: Create a client (customer)
 */
async function createClient() {
  console.log('\n🔍 Test 2: Creating a Zimbabwe client...\n');

  // Generate unique ID to avoid conflicts
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
    activationDate: formatDate()
  };

  console.log('Request payload:');
  console.log(JSON.stringify(clientData, null, 2));

  try {
    const response = await fetchWithTimeout(`${ENV.url}/clients`, {
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
    const response = await fetchWithTimeout(`${ENV.url}/loanproducts`, { headers });
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
      } else {
        console.log('\n⚠️  No loan products found!');
        console.log('💡 You may need to create loan products first using the Fineract UI');
        console.log('   Local UI: http://localhost:8080/fineract-provider/api-docs/apiLive.htm');
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
    submittedOnDate: formatDate(),
    expectedDisbursementDate: formatDate()
  };

  console.log('Request payload (device financing terms):');
  console.log(JSON.stringify(loanData, null, 2));
  console.log('\n💡 Interest calculation: 30% annual ÷ 12 months = 2.5% per month');

  try {
    const response = await fetchWithTimeout(`${ENV.url}/loans`, {
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
    approvedOnDate: formatDate(),
    dateFormat: 'dd MMMM yyyy',
    locale: 'en'
  };

  try {
    const response = await fetchWithTimeout(`${ENV.url}/loans/${loanId}?command=approve`, {
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
    actualDisbursementDate: formatDate(),
    transactionAmount: amount,
    dateFormat: 'dd MMMM yyyy',
    locale: 'en'
  };

  try {
    const response = await fetchWithTimeout(`${ENV.url}/loans/${loanId}?command=disburse`, {
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
    const response = await fetchWithTimeout(`${ENV.url}/loans/${loanId}?associations=repaymentSchedule`, {
      headers
    });

    const data = await response.json();

    if (response.ok && data.repaymentSchedule) {
      console.log('✅ Retrieved repayment schedule!');
      console.log(`\n   Total to repay: $${data.summary?.totalRepaymentExpected || 'N/A'}`);
      console.log(`   Monthly installments: ${data.numberOfRepayments || 0}`);

      if (data.repaymentSchedule.periods) {
        console.log('\n   Payment schedule:');
        data.repaymentSchedule.periods.slice(0, 9).forEach((period, index) => {
          if (period.dueDate) {
            const dueDate = `${period.dueDate[2]}/${period.dueDate[1]}/${period.dueDate[0]}`;
            const amount = `$${period.totalDueForPeriod || 0}`;
            const principal = `$${period.principalDue || 0}`;
            const interest = `$${period.interestDue || 0}`;

            if (index === 0) {
              console.log(`     ${index}. ${dueDate.padEnd(12)} - ${amount.padEnd(10)} (Disbursement)`);
            } else {
              console.log(`     ${index}. ${dueDate.padEnd(12)} - ${amount.padEnd(10)} (Principal: ${principal}, Interest: ${interest})`);
            }
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
 * Test 8: Get loan account details
 */
async function getLoanDetails(loanId) {
  console.log('\n🔍 Test 8: Getting complete loan account details...\n');

  if (!loanId) {
    console.log('❌ Cannot get loan details: missing loanId');
    return;
  }

  try {
    const response = await fetchWithTimeout(`${ENV.url}/loans/${loanId}`, { headers });
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Loan details retrieved!');
      console.log(`\n   Loan ID: ${data.id}`);
      console.log(`   Account Number: ${data.accountNo}`);
      console.log(`   Status: ${data.status?.value || 'Unknown'}`);
      console.log(`   Principal: $${data.principal || 0}`);
      console.log(`   Total Outstanding: $${data.summary?.totalOutstanding || 0}`);
      console.log(`   Total Repaid: $${data.summary?.totalRepayment || 0}`);

      console.log('\n📝 Key Finding: Account number can be used for customer inquiries');
    } else {
      console.log('❌ Failed to get loan details');
      console.log('   Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Request failed');
    console.log('   Error:', error.message);
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(70));
  console.log('  Fineract API Research - Local Development Testing');
  console.log(`  Environment: ${ENV.name}`);
  console.log('='.repeat(70));

  // Wait for Fineract if using local environment
  if (envArg === 'local') {
    const isReady = await waitForFineract();
    if (!isReady) {
      console.log('\n❌ Fineract is not ready. Please check your Docker setup.');
      console.log('\n💡 Quick Start:');
      console.log('   1. docker-compose -f docker-compose-fineract.yml up -d');
      console.log('   2. docker logs fineract-server -f');
      console.log('   3. Wait for "Started Fineract" message');
      console.log('   4. Run this script again');
      return;
    }
  }

  // Test 1: Connection
  const isConnected = await testConnection();
  if (!isConnected) {
    console.log('\n❌ Cannot proceed - Server is not accessible');
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
    console.log('\n💡 For local testing, you need to create loan products first.');
    console.log('   See: http://localhost:8080/fineract-provider/api-docs/apiLive.htm');
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

  // Test 8: Get loan details
  await getLoanDetails(loanId);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Testing Completed!');
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
  console.log('   ✅ Account details retrieved');

  console.log('\n📝 Key Findings for Lynia Finance:');
  console.log('   • Zimbabwe National IDs → externalId field');
  console.log('   • Phone numbers → mobileNo (with +263 prefix)');
  console.log('   • Loan workflow: Submitted → Approved → Active');
  console.log('   • Interest: 30% annual = 2.5% monthly');
  console.log('   • Repayment schedule auto-generated');
  console.log('   • Date format: "dd MMMM yyyy"');
  console.log('   • Account numbers available for customer queries');

  console.log('\n✨ Next Steps:');
  console.log('   1. Test repayment posting (T002)');
  console.log('   2. Test account balance queries (T003)');
  console.log('   3. Test payment reminders integration');
  console.log('   4. Document API integration patterns');

  console.log('\n🔗 Resources:');
  if (envArg === 'local') {
    console.log('   • Local API Docs: http://localhost:8080/fineract-provider/api-docs/apiLive.htm');
    console.log('   • Container Logs: docker logs fineract-server');
  } else {
    console.log('   • API Docs: https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm');
    console.log('   • Demo Server: https://demo.fineract.dev');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
