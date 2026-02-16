/**
 * Fineract Initialization Lambda
 *
 * Creates GL accounts and loan products in a fresh Fineract instance.
 * Designed as a CloudFormation Custom Resource (invoke once after ECS deploys).
 *
 * Idempotent: checks if resources exist before creating. Safe to re-run.
 *
 * Required env vars:
 *   FINERACT_BASE_URL  - e.g. https://internal-...:8443/fineract-provider/api/v1
 *   FINERACT_USERNAME  - Fineract admin username
 *   FINERACT_PASSWORD  - Fineract admin password
 *   FINERACT_TENANT_ID - Fineract tenant (default: "default")
 */

const https = require('https');

// ============================================================
// CONFIGURATION
// ============================================================

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || '';
const FINERACT_USERNAME = process.env.FINERACT_USERNAME || 'mifos';
const FINERACT_PASSWORD = process.env.FINERACT_PASSWORD || 'password';
const FINERACT_TENANT_ID = process.env.FINERACT_TENANT_ID || 'default';

// GL Chart of Accounts (18 accounts)
const GL_ACCOUNTS = [
  // Header accounts (usage=1)
  { name: 'Assets', glCode: '1000', type: 1, usage: 1, manualEntriesAllowed: false, description: 'Header account for all asset accounts' },
  { name: 'Liabilities', glCode: '2000', type: 2, usage: 1, manualEntriesAllowed: false, description: 'Header account for all liability accounts' },
  { name: 'Equity', glCode: '3000', type: 3, usage: 1, manualEntriesAllowed: false, description: 'Header account for equity accounts' },
  { name: 'Income', glCode: '4000', type: 4, usage: 1, manualEntriesAllowed: false, description: 'Header account for all income accounts' },
  { name: 'Expenses', glCode: '5000', type: 5, usage: 1, manualEntriesAllowed: false, description: 'Header account for all expense accounts' },
  // Detail accounts (usage=2)
  { name: 'Cash and Bank', glCode: '1001', type: 1, usage: 2, parentGlCode: '1000', manualEntriesAllowed: true, description: 'Cash on hand and bank balances' },
  { name: 'Loan Portfolio', glCode: '1100', type: 1, usage: 2, parentGlCode: '1000', manualEntriesAllowed: false, description: 'Outstanding loan principal balances' },
  { name: 'Interest Receivable', glCode: '1200', type: 1, usage: 2, parentGlCode: '1000', manualEntriesAllowed: false, description: 'Accrued interest not yet collected' },
  { name: 'Fee Receivable', glCode: '1300', type: 1, usage: 2, parentGlCode: '1000', manualEntriesAllowed: false, description: 'Accrued fees not yet collected' },
  { name: 'Penalty Receivable', glCode: '1400', type: 1, usage: 2, parentGlCode: '1000', manualEntriesAllowed: false, description: 'Accrued penalty charges not yet collected' },
  { name: 'Overpayment Liability', glCode: '2001', type: 2, usage: 2, parentGlCode: '2000', manualEntriesAllowed: false, description: 'Customer overpayments' },
  { name: 'Transfers in Suspense', glCode: '2100', type: 2, usage: 2, parentGlCode: '2000', manualEntriesAllowed: false, description: 'Temporary holding for funds in transit' },
  { name: 'Opening Balance Equity', glCode: '3001', type: 3, usage: 2, parentGlCode: '3000', manualEntriesAllowed: true, description: 'Initial balance adjustments' },
  { name: 'Interest Income', glCode: '4001', type: 4, usage: 2, parentGlCode: '4000', manualEntriesAllowed: false, description: 'Interest earned on loans' },
  { name: 'Fee Income', glCode: '4002', type: 4, usage: 2, parentGlCode: '4000', manualEntriesAllowed: false, description: 'Fees earned' },
  { name: 'Penalty Income', glCode: '4003', type: 4, usage: 2, parentGlCode: '4000', manualEntriesAllowed: false, description: 'Late payment penalty income' },
  { name: 'Income from Recovery', glCode: '4004', type: 4, usage: 2, parentGlCode: '4000', manualEntriesAllowed: false, description: 'Recovery of written-off loans' },
  { name: 'Loan Write-Off Expense', glCode: '5001', type: 5, usage: 2, parentGlCode: '5000', manualEntriesAllowed: false, description: 'Loans written off as uncollectable' },
  { name: 'Provision Expense', glCode: '5002', type: 5, usage: 2, parentGlCode: '5000', manualEntriesAllowed: false, description: 'Loan loss provisioning per RBZ guidelines' },
];

// 3-tier loan products
const LOAN_PRODUCTS = [
  {
    name: 'Lynia Device Loan - Tier 1 (Entry)', shortName: 'LT1E',
    description: 'Entry-level device financing for credit scores 350-499',
    principal: 100, minPrincipal: 50, maxPrincipal: 200,
    numberOfRepayments: 12, minNumberOfRepayments: 6, maxNumberOfRepayments: 12,
    repaymentEvery: 1, interestRatePerPeriod: 5.0,
    minInterestRatePerPeriod: 4.0, maxInterestRatePerPeriod: 6.0,
  },
  {
    name: 'Lynia Device Loan - Tier 2 (Standard)', shortName: 'LT2S',
    description: 'Standard device financing for credit scores 500-649',
    principal: 350, minPrincipal: 200, maxPrincipal: 500,
    numberOfRepayments: 12, minNumberOfRepayments: 6, maxNumberOfRepayments: 12,
    repaymentEvery: 1, interestRatePerPeriod: 4.0,
    minInterestRatePerPeriod: 3.0, maxInterestRatePerPeriod: 5.0,
  },
  {
    name: 'Lynia Device Loan - Tier 3 (Premium)', shortName: 'LT3P',
    description: 'Premium device financing for credit scores 650+',
    principal: 1000, minPrincipal: 500, maxPrincipal: 2000,
    numberOfRepayments: 18, minNumberOfRepayments: 6, maxNumberOfRepayments: 18,
    repaymentEvery: 1, interestRatePerPeriod: 3.0,
    minInterestRatePerPeriod: 2.0, maxInterestRatePerPeriod: 4.0,
  },
];

// ============================================================
// HTTP CLIENT
// ============================================================

function fineractRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FINERACT_BASE_URL}${path}`);
    const auth = Buffer.from(`${FINERACT_USERNAME}:${FINERACT_PASSWORD}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const options = {
      hostname: url.hostname,
      port: url.port || 8443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Fineract-Platform-TenantId': FINERACT_TENANT_ID,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
      rejectUnauthorized: false,
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`Fineract ${method} ${path} returned ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Connection error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ============================================================
// SETUP FUNCTIONS
// ============================================================

async function setupGLAccounts() {
  const existing = await fineractRequest('GET', '/glaccounts');
  const existingCodes = new Set(existing.map(a => a.glCode));
  const idMap = {};

  for (const acct of existing) {
    idMap[acct.glCode] = acct.id;
  }

  console.log(`Found ${existing.length} existing GL accounts`);

  // Create header accounts first, then detail accounts
  const headers = GL_ACCOUNTS.filter(a => a.usage === 1);
  const details = GL_ACCOUNTS.filter(a => a.usage === 2);

  for (const account of [...headers, ...details]) {
    if (existingCodes.has(account.glCode)) {
      console.log(`GL ${account.glCode} "${account.name}" already exists (ID: ${idMap[account.glCode]})`);
      continue;
    }

    const body = {
      name: account.name,
      glCode: account.glCode,
      type: account.type,
      usage: account.usage,
      manualEntriesAllowed: account.manualEntriesAllowed,
      description: account.description,
    };

    if (account.parentGlCode && idMap[account.parentGlCode]) {
      body.parentId = idMap[account.parentGlCode];
    }

    try {
      const response = await fineractRequest('POST', '/glaccounts', body);
      idMap[account.glCode] = response.resourceId;
      console.log(`Created GL ${account.glCode} "${account.name}" -> ID ${response.resourceId}`);
    } catch (err) {
      if (err.message.includes('403')) {
        console.warn(`GL ${account.glCode} may already exist (403). Skipping.`);
      } else {
        throw err;
      }
    }
  }

  console.log(`GL account setup complete. ${Object.keys(idMap).length} accounts ready.`);
  return idMap;
}

async function setupLoanProducts(glAccountIdMap) {
  const existing = await fineractRequest('GET', '/loanproducts');
  const existingNames = new Set(existing.map(p => p.shortName));

  console.log(`Found ${existing.length} existing loan products`);

  const productIds = [];

  for (const product of LOAN_PRODUCTS) {
    if (existingNames.has(product.shortName)) {
      const existing_ = existing.find(p => p.shortName === product.shortName);
      console.log(`Loan product "${product.shortName}" already exists (ID: ${existing_?.id})`);
      productIds.push(existing_?.id);
      continue;
    }

    const body = {
      ...product,
      currencyCode: 'USD',
      digitsAfterDecimal: 2,
      inMultiplesOf: 1,
      repaymentFrequencyType: 2,
      interestRateFrequencyType: 2,
      amortizationType: 0,
      interestType: 0,
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      accountingRule: 3,
      // Accrual-based GL account mappings
      fundSourceAccountId: glAccountIdMap['1001'],
      loanPortfolioAccountId: glAccountIdMap['1100'],
      interestOnLoanAccountId: glAccountIdMap['4001'],
      incomeFromFeeAccountId: glAccountIdMap['4002'],
      incomeFromPenaltyAccountId: glAccountIdMap['4003'],
      writeOffAccountId: glAccountIdMap['5001'],
      overpaymentLiabilityAccountId: glAccountIdMap['2001'],
      transfersInSuspenseAccountId: glAccountIdMap['2100'],
      receivableInterestAccountId: glAccountIdMap['1200'],
      receivableFeeAccountId: glAccountIdMap['1300'],
      receivablePenaltyAccountId: glAccountIdMap['1400'],
    };

    const response = await fineractRequest('POST', '/loanproducts', body);
    productIds.push(response.resourceId);
    console.log(`Created loan product "${product.shortName}" -> ID ${response.resourceId}`);
  }

  console.log('Loan product setup complete.');
  return productIds;
}

// ============================================================
// CLOUDFORMATION CUSTOM RESOURCE HANDLER
// ============================================================

async function sendResponse(event, status, reason, data) {
  const responseBody = JSON.stringify({
    Status: status,
    Reason: reason || 'See CloudWatch Logs',
    PhysicalResourceId: event.PhysicalResourceId || 'fineract-init',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data || {},
  });

  const url = new URL(event.ResponseURL);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Content-Type': '',
        'Content-Length': Buffer.byteLength(responseBody),
      },
    };

    const req = https.request(options, (res) => {
      resolve();
    });
    req.on('error', reject);
    req.write(responseBody);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // For CloudFormation Custom Resource
  if (event.RequestType === 'Delete') {
    if (event.ResponseURL) {
      await sendResponse(event, 'SUCCESS', 'Delete is a no-op');
    }
    return { statusCode: 200, body: 'Delete is a no-op' };
  }

  try {
    // Step 1: Health check
    console.log('Checking Fineract health...');
    const offices = await fineractRequest('GET', '/offices');
    console.log(`Fineract is healthy. Found ${offices.length} office(s).`);

    // Step 2: Create GL accounts
    console.log('\n--- Step 1: GL Accounts ---');
    const glAccountIdMap = await setupGLAccounts();

    // Step 3: Create loan products
    console.log('\n--- Step 2: Loan Products ---');
    const productIds = await setupLoanProducts(glAccountIdMap);

    const result = {
      glAccountCount: Object.keys(glAccountIdMap).length,
      loanProductIds: productIds.join(','),
      status: 'SUCCESS',
    };

    console.log('\nInitialization complete:', result);

    if (event.ResponseURL) {
      await sendResponse(event, 'SUCCESS', 'Fineract initialized', result);
    }

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Initialization failed:', error);

    if (event.ResponseURL) {
      await sendResponse(event, 'FAILED', error.message);
    }

    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
