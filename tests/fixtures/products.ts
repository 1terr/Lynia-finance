/**
 * Test Fixtures: Products
 * Sample loan product data for testing product lifecycle scenarios
 */

export const testProducts = {
  /**
   * Smartphone product: insurance fee 2.5% upfront, late penalty $5 flat (3-day grace),
   * flat rate 12%, accrual accounting (rule=3), GL accounts 1310-1339
   */
  smartphoneProduct: {
    id: 'prod_test_smartphone_001',
    product_code: 'SP_BASIC_001',
    product_name: 'Basic Smartphone Loan',
    short_name: 'SPBA',
    product_category: 'smartphone',
    product_type: 'individual',
    description: 'Entry-level smartphone financing for Zimbabwe customers',
    status: 'active',
    requires_device: true,
    requires_organization_verification: false,
    default_principal: 300,
    min_amount_usd: 100,
    max_amount_usd: 800,
    number_of_repayments: 6,
    min_term_months: 3,
    max_term_months: 12,
    interest_rate_monthly: 1,
    interest_rate_annual: 12,
    interest_type: 'flat',
    deposit_percentage: 20,
    accounting_rule: 3,
    // Insurance fee config
    insurance_fee_type: 'percentage',
    insurance_fee_percentage: 2.5,
    insurance_fee_flat_usd: 0,
    insurance_fee_frequency: 'upfront',
    // Late penalty config
    late_penalty_type: 'flat',
    late_penalty_percentage: 0,
    late_penalty_flat_usd: 5,
    late_penalty_grace_days: 3,
    // GL accounts (1310-1339 range)
    fund_source_account_id: 1310,
    loan_portfolio_account_id: 1311,
    interest_on_loan_account_id: 1312,
    income_from_fee_account_id: 1313,
    income_from_penalty_account_id: 1314,
    write_off_account_id: 1315,
    overpayment_liability_account_id: 1316,
    transfers_in_suspense_account_id: 1317,
    income_from_recovery_account_id: 1318,
    receivable_interest_account_id: 1319,
    receivable_fee_account_id: 1320,
    receivable_penalty_account_id: 1321,
    // Disbursement
    allowed_disbursement_methods: ['ecocash', 'onemoney'],
    // Fineract
    fineract_product_id: 101,
    display_order: 1,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  /**
   * Digital product: insurance fee 3% upfront, late penalty 2%, flat rate 24%,
   * GL accounts 1410-1439
   */
  digitalProduct: {
    id: 'prod_test_digital_001',
    product_code: 'DG_CASH_001',
    product_name: 'Digital Cash Loan',
    short_name: 'DGCA',
    product_category: 'digital',
    product_type: 'individual',
    description: 'Cash loan disbursed via mobile money for Zimbabwe customers',
    status: 'active',
    requires_device: false,
    requires_organization_verification: true,
    default_principal: 200,
    min_amount_usd: 50,
    max_amount_usd: 500,
    number_of_repayments: 3,
    min_term_months: 1,
    max_term_months: 6,
    interest_rate_monthly: 2,
    interest_rate_annual: 24,
    interest_type: 'flat',
    deposit_percentage: 0,
    accounting_rule: 3,
    // Insurance fee config
    insurance_fee_type: 'percentage',
    insurance_fee_percentage: 3,
    insurance_fee_flat_usd: 0,
    insurance_fee_frequency: 'upfront',
    // Late penalty config
    late_penalty_type: 'percentage',
    late_penalty_percentage: 2,
    late_penalty_flat_usd: 0,
    late_penalty_grace_days: 3,
    // GL accounts (1410-1439 range)
    fund_source_account_id: 1410,
    loan_portfolio_account_id: 1411,
    interest_on_loan_account_id: 1412,
    income_from_fee_account_id: 1413,
    income_from_penalty_account_id: 1414,
    write_off_account_id: 1415,
    overpayment_liability_account_id: 1416,
    transfers_in_suspense_account_id: 1417,
    income_from_recovery_account_id: 1418,
    receivable_interest_account_id: 1419,
    receivable_fee_account_id: 1420,
    receivable_penalty_account_id: 1421,
    // Disbursement
    allowed_disbursement_methods: ['ecocash', 'onemoney'],
    // Fineract
    fineract_product_id: 102,
    display_order: 2,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  /** Inactive product for testing status transitions */
  inactiveProduct: {
    id: 'prod_test_inactive_001',
    product_code: 'SP_OLD_001',
    product_name: 'Deprecated Smartphone Loan',
    short_name: 'SPOD',
    product_category: 'smartphone',
    product_type: 'individual',
    status: 'inactive',
    requires_device: true,
    default_principal: 250,
    min_amount_usd: 100,
    max_amount_usd: 600,
    number_of_repayments: 6,
    min_term_months: 6,
    max_term_months: 12,
    interest_rate_monthly: 1.25,
    interest_rate_annual: 15,
    interest_type: 'flat',
    deposit_percentage: 20,
    accounting_rule: 3,
    insurance_fee_type: 'none',
    insurance_fee_percentage: 0,
    insurance_fee_flat_usd: 0,
    insurance_fee_frequency: 'upfront',
    late_penalty_type: 'none',
    late_penalty_percentage: 0,
    late_penalty_flat_usd: 0,
    late_penalty_grace_days: 3,
    fineract_product_id: 103,
    display_order: 10,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

/** Mock Fineract product creation response */
export const mockFineractProductResponses = {
  createSuccess: {
    officeId: 1,
    resourceId: 101,
    changes: {},
  },
  createDigitalSuccess: {
    officeId: 1,
    resourceId: 102,
    changes: {},
  },
  createDuplicate: {
    statusCode: 409,
    errors: [
      {
        developerMessage: 'Loan product with name already exists',
        defaultUserMessage: 'A Loan product with name already exists',
        parameterName: 'name',
      },
    ],
  },
};

/** Mock Fineract GL accounts response for validation */
export const mockFineractGLAccounts = {
  validAccounts: [
    { id: 1310, name: 'Fund Source - Smartphone', glCode: '1310', type: { id: 1, value: 'ASSET' } },
    { id: 1311, name: 'Loan Portfolio - Smartphone', glCode: '1311', type: { id: 1, value: 'ASSET' } },
    { id: 1312, name: 'Interest Receivable - Smartphone', glCode: '1312', type: { id: 4, value: 'INCOME' } },
    { id: 1313, name: 'Fee Income - Smartphone', glCode: '1313', type: { id: 4, value: 'INCOME' } },
    { id: 1314, name: 'Penalty Income - Smartphone', glCode: '1314', type: { id: 4, value: 'INCOME' } },
    { id: 1315, name: 'Write-Off - Smartphone', glCode: '1315', type: { id: 5, value: 'EXPENSE' } },
    { id: 1316, name: 'Overpayment Liability - Smartphone', glCode: '1316', type: { id: 2, value: 'LIABILITY' } },
    { id: 1317, name: 'Transfers In Suspense - Smartphone', glCode: '1317', type: { id: 1, value: 'ASSET' } },
    { id: 1318, name: 'Income From Recovery - Smartphone', glCode: '1318', type: { id: 4, value: 'INCOME' } },
    { id: 1319, name: 'Receivable Interest - Smartphone', glCode: '1319', type: { id: 1, value: 'ASSET' } },
    { id: 1320, name: 'Receivable Fee - Smartphone', glCode: '1320', type: { id: 1, value: 'ASSET' } },
    { id: 1321, name: 'Receivable Penalty - Smartphone', glCode: '1321', type: { id: 1, value: 'ASSET' } },
    // Digital product accounts
    { id: 1410, name: 'Fund Source - Digital', glCode: '1410', type: { id: 1, value: 'ASSET' } },
    { id: 1411, name: 'Loan Portfolio - Digital', glCode: '1411', type: { id: 1, value: 'ASSET' } },
    { id: 1412, name: 'Interest Receivable - Digital', glCode: '1412', type: { id: 4, value: 'INCOME' } },
    { id: 1413, name: 'Fee Income - Digital', glCode: '1413', type: { id: 4, value: 'INCOME' } },
    { id: 1414, name: 'Penalty Income - Digital', glCode: '1414', type: { id: 4, value: 'INCOME' } },
    { id: 1415, name: 'Write-Off - Digital', glCode: '1415', type: { id: 5, value: 'EXPENSE' } },
    { id: 1416, name: 'Overpayment Liability - Digital', glCode: '1416', type: { id: 2, value: 'LIABILITY' } },
    { id: 1417, name: 'Transfers In Suspense - Digital', glCode: '1417', type: { id: 1, value: 'ASSET' } },
    { id: 1418, name: 'Income From Recovery - Digital', glCode: '1418', type: { id: 4, value: 'INCOME' } },
    { id: 1419, name: 'Receivable Interest - Digital', glCode: '1419', type: { id: 1, value: 'ASSET' } },
    { id: 1420, name: 'Receivable Fee - Digital', glCode: '1420', type: { id: 1, value: 'ASSET' } },
    { id: 1421, name: 'Receivable Penalty - Digital', glCode: '1421', type: { id: 1, value: 'ASSET' } },
  ],
  invalidAccountIds: [9999, 8888],
};
