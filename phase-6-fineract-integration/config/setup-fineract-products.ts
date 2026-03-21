/**
 * @deprecated This script created the original 3-tier loan products (Tier 1/2/3).
 * Loan products are now created through the admin portal product wizard and synced
 * to Fineract via services/shared/clients/fineract-sync/sync-product.ts.
 *
 * The GL account setup portion is still valid for fresh Fineract instances.
 *
 * Original description:
 * Fineract Product & GL Account Setup Script — one-time setup that creates
 * GL accounts, loan products, and financial activity mappings.
 *
 * Usage:
 *   FINERACT_SECRET_NAME=dev/lynia/fineract-api npx ts-node setup-fineract-products.ts
 */

import { getFineractClient, FineractApiError } from '../../../services/shared/clients/fineract';
import type {
  FineractGLAccountCreateRequest,
  FineractLoanProductCreateRequest,
} from '../../../services/shared/types/fineract';

import chartOfAccountsConfig from './chart-of-accounts.json';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loanProductsConfig = require('./loan-products.json.archived');

// ============================================================
// GL ACCOUNT SETUP
// ============================================================

interface GLAccountEntry {
  name: string;
  glCode: string;
  type: number;
  usage: number;
  manualEntriesAllowed: boolean;
  description: string;
  parentGlCode?: string;
  financialActivityMapping?: string;
}

/** Map of glCode → Fineract account ID (populated during setup) */
const glAccountIdMap: Record<string, number> = {};

async function setupGLAccounts(): Promise<void> {
  const fineract = await getFineractClient();

  // Check if accounts already exist
  const existing = await fineract.listGLAccounts();
  const existingCodes = new Set(existing.map((a) => a.glCode));

  console.log(`[setup] Found ${existing.length} existing GL accounts`);

  // Build parent ID lookup from existing accounts
  for (const acct of existing) {
    glAccountIdMap[acct.glCode] = acct.id;
  }

  const accounts = chartOfAccountsConfig.accounts as GLAccountEntry[];

  // Create header accounts first (usage=1), then detail accounts (usage=2)
  const headers = accounts.filter((a) => a.usage === 1);
  const details = accounts.filter((a) => a.usage === 2);

  for (const account of [...headers, ...details]) {
    if (existingCodes.has(account.glCode)) {
      console.log(`[setup] GL ${account.glCode} "${account.name}" already exists (ID: ${glAccountIdMap[account.glCode]})`);
      continue;
    }

    const request: FineractGLAccountCreateRequest = {
      name: account.name,
      glCode: account.glCode,
      type: account.type,
      usage: account.usage,
      manualEntriesAllowed: account.manualEntriesAllowed,
      description: account.description,
    };

    // Set parent ID if this is a detail account
    if (account.parentGlCode && glAccountIdMap[account.parentGlCode]) {
      request.parentId = glAccountIdMap[account.parentGlCode];
    }

    try {
      const response = await fineract.createGLAccount(request);
      glAccountIdMap[account.glCode] = response.resourceId;
      console.log(`[setup] Created GL ${account.glCode} "${account.name}" → ID ${response.resourceId}`);
    } catch (error) {
      if (error instanceof FineractApiError && error.statusCode === 403) {
        console.warn(`[setup] GL ${account.glCode} may already exist (403). Skipping.`);
      } else {
        throw error;
      }
    }
  }

  console.log(`[setup] GL account setup complete. ${Object.keys(glAccountIdMap).length} accounts ready.`);
}

// ============================================================
// LOAN PRODUCT SETUP
// ============================================================

async function setupLoanProducts(): Promise<void> {
  const fineract = await getFineractClient();

  // Check if products already exist
  const existing = await fineract.listLoanProducts();
  const existingNames = new Set(existing.map((p) => p.shortName));

  console.log(`[setup] Found ${existing.length} existing loan products`);

  const defaults = loanProductsConfig.defaults;
  const mappings = chartOfAccountsConfig.loanProductAccountMappings;

  for (const product of loanProductsConfig.products) {
    if (existingNames.has(product.shortName)) {
      const existingProduct = existing.find((p) => p.shortName === product.shortName);
      console.log(`[setup] Loan product "${product.shortName}" already exists (ID: ${existingProduct?.id})`);
      continue;
    }

    const request: FineractLoanProductCreateRequest = {
      name: product.name,
      shortName: product.shortName,
      description: product.description,
      currencyCode: defaults.currencyCode,
      digitsAfterDecimal: defaults.digitsAfterDecimal,
      inMultiplesOf: defaults.inMultiplesOf,
      principal: product.principal,
      minPrincipal: product.minPrincipal,
      maxPrincipal: product.maxPrincipal,
      numberOfRepayments: product.numberOfRepayments,
      minNumberOfRepayments: product.minNumberOfRepayments,
      maxNumberOfRepayments: product.maxNumberOfRepayments,
      repaymentEvery: product.repaymentEvery,
      repaymentFrequencyType: defaults.repaymentFrequencyType,
      interestRatePerPeriod: product.interestRatePerPeriod,
      minInterestRatePerPeriod: product.minInterestRatePerPeriod,
      maxInterestRatePerPeriod: product.maxInterestRatePerPeriod,
      interestRateFrequencyType: defaults.interestRateFrequencyType,
      amortizationType: defaults.amortizationType,
      interestType: defaults.interestType,
      interestCalculationPeriodType: defaults.interestCalculationPeriodType,
      transactionProcessingStrategyCode: defaults.transactionProcessingStrategyCode,
      locale: defaults.locale,
      dateFormat: defaults.dateFormat,
      accountingRule: defaults.accountingRule,
      // Accrual-based accounting mappings
      fundSourceAccountId: glAccountIdMap[mappings.fundSourceAccountId],
      loanPortfolioAccountId: glAccountIdMap[mappings.loanPortfolioAccountId],
      interestOnLoanAccountId: glAccountIdMap[mappings.interestOnLoanAccountId],
      incomeFromFeeAccountId: glAccountIdMap[mappings.incomeFromFeeAccountId],
      incomeFromPenaltyAccountId: glAccountIdMap[mappings.incomeFromPenaltyAccountId],
      writeOffAccountId: glAccountIdMap[mappings.writeOffAccountId],
      overpaymentLiabilityAccountId: glAccountIdMap[mappings.overpaymentLiabilityAccountId],
      transfersInSuspenseAccountId: glAccountIdMap[mappings.transfersInSuspenseAccountId],
      receivableInterestAccountId: glAccountIdMap[mappings.receivableInterestAccountId],
      receivableFeeAccountId: glAccountIdMap[mappings.receivableFeeAccountId],
      receivablePenaltyAccountId: glAccountIdMap[mappings.receivablePenaltyAccountId],
    };

    try {
      const response = await fineract.createLoanProduct(request);
      console.log(`[setup] Created loan product "${product.shortName}" → ID ${response.resourceId}`);
    } catch (error) {
      if (error instanceof FineractApiError) {
        console.error(`[setup] Failed to create product "${product.shortName}": ${error.message}`);
        if (error.errorBody?.errors) {
          for (const err of error.errorBody.errors) {
            console.error(`  - ${err.parameterName}: ${err.defaultUserMessage}`);
          }
        }
      }
      throw error;
    }
  }

  console.log('[setup] Loan product setup complete.');
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  console.log('=============================================');
  console.log('Fineract Product & GL Account Setup');
  console.log('=============================================');
  console.log('');

  // Step 1: Verify Fineract is healthy
  const fineract = await getFineractClient();
  const healthy = await fineract.healthCheck();
  if (!healthy) {
    console.error('[setup] Fineract is not healthy. Aborting setup.');
    process.exit(1);
  }
  console.log('[setup] Fineract health check passed.');
  console.log('');

  // Step 2: Create GL accounts
  console.log('--- Step 1: GL Accounts ---');
  await setupGLAccounts();
  console.log('');

  // Step 3: Create loan products with GL mappings
  console.log('--- Step 2: Loan Products ---');
  await setupLoanProducts();
  console.log('');

  console.log('=============================================');
  console.log('Setup complete.');
  console.log('=============================================');
}

main().catch((error) => {
  console.error('[setup] Fatal error:', error);
  process.exit(1);
});
