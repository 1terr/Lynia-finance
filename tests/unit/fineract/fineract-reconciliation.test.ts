/**
 * Fineract Reconciliation Unit Tests
 *
 * Tests for fineract-reconcile.ts which compares loan balances between
 * Lynia PostgreSQL and Apache Fineract, classifies discrepancies,
 * retries failed sync operations, and reconciles GL account mappings.
 *
 * Mocks:
 *   - Fineract client (getFineractClient)
 *   - Database client (db)
 *   - CloudWatch client
 *   - Logger
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ============================================================
// MOCK SETUP
// ============================================================

const mockGetLoan = jest.fn();
const mockGetLoanProduct = jest.fn();
const mockCreateClient = jest.fn();
const mockCreateLoan = jest.fn();
const mockApproveLoan = jest.fn();
const mockDisburseLoan = jest.fn();
const mockPostRepayment = jest.fn();

jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(() => Promise.resolve({
    getLoan: mockGetLoan,
    getLoanProduct: mockGetLoanProduct,
    createClient: mockCreateClient,
    createLoan: mockCreateLoan,
    approveLoan: mockApproveLoan,
    disburseLoan: mockDisburseLoan,
    postRepayment: mockPostRepayment,
  })),
  FineractApiError: class FineractApiError extends Error {
    statusCode: number;
    errorBody: unknown;
    constructor(message: string, statusCode: number, errorBody: unknown) {
      super(message);
      this.name = 'FineractApiError';
      this.statusCode = statusCode;
      this.errorBody = errorBody;
    }
  },
}));

// Mock sync product (used by retrySyncOperation for loan_product:create)
jest.mock('../../../services/shared/clients/fineract-sync/sync-product', () => ({
  syncProductToFineract: jest.fn(() => Promise.resolve({ success: true })),
}));

// Database mock with chainable query builder
type MockRow = Record<string, unknown>;
let mockDbData: Record<string, { data: MockRow[] | null; error: string | null }>;

const createQueryBuilder = () => {
  let tableName = '';

  const builder: Record<string, (...args: unknown[]) => unknown> = {
    from: (table: string) => {
      tableName = table;
      return builder;
    },
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    neq: () => builder,
    not: () => builder,
    is: () => builder,
    in: () => builder,
    lt: () => builder,
    order: () => builder,
    limit: () => builder,
    execute: () => {
      const tableData = mockDbData[tableName] || { data: [], error: null };
      return Promise.resolve(tableData);
    },
  };

  return builder;
};

jest.mock('../../../services/shared/clients/database', () => ({
  db: {
    from: (table: string) => {
      const qb = createQueryBuilder();
      return qb.from(table);
    },
  },
}));

// Mock CloudWatch
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutMetricDataCommand: jest.fn(),
}));

// Mock logger
jest.mock('../../../services/shared/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock secrets
jest.mock('../../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn(() => Promise.resolve({})),
}));

// Mock SQS publisher (transitive dependency)
jest.mock('../../../services/shared/utils/sqs-publisher', () => ({
  SQSQueues: {
    retryFineractSync: jest.fn().mockResolvedValue(undefined),
  },
}));

import { runReconciliation, reconciliationHandler } from '../../../services/shared/clients/fineract-reconcile';

beforeEach(() => {
  jest.clearAllMocks();

  // Default: empty tables
  mockDbData = {
    loans: { data: [], error: null },
    fineract_sync_log: { data: [], error: null },
    loan_products: { data: [], error: null },
  };
});

// ============================================================
// LOAN BALANCE RECONCILIATION
// ============================================================

describe('Loan balance reconciliation', () => {
  it('should report matching balances within $0.01 tolerance', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001',
          fineract_loan_id: 101,
          outstanding_balance: 150.00,
          total_paid_usd: 50.00,
          status: 'active',
          loan_number: 'LN00001',
          product_category: 'smartphone',
        },
      ],
      error: null,
    };

    mockGetLoan.mockResolvedValue({
      id: 101,
      summary: { totalOutstanding: 150.005 }, // within $0.01 tolerance
    });

    const result = await runReconciliation();

    expect(result.totalLoansChecked).toBe(1);
    expect(result.matchedLoans).toBe(1);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('should flag discrepancy when difference exceeds $0.01', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001',
          fineract_loan_id: 101,
          outstanding_balance: 150.00,
          total_paid_usd: 50.00,
          status: 'active',
          loan_number: 'LN00001',
          product_category: 'smartphone',
        },
      ],
      error: null,
    };

    mockGetLoan.mockResolvedValue({
      id: 101,
      summary: { totalOutstanding: 148.50 }, // $1.50 difference
    });

    const result = await runReconciliation();

    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].lyniaLoanId).toBe('loan-001');
    expect(result.discrepancies[0].fineractLoanId).toBe(101);
    expect(result.discrepancies[0].lyniaOutstanding).toBe(150.00);
    expect(result.discrepancies[0].fineractOutstanding).toBe(148.50);
    expect(result.discrepancies[0].difference).toBeCloseTo(1.50, 2);
  });

  it('should handle zero outstanding balances as a match', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-002',
          fineract_loan_id: 102,
          outstanding_balance: 0,
          total_paid_usd: 200.00,
          status: 'closed',
          loan_number: 'LN00002',
          product_category: 'digital',
        },
      ],
      error: null,
    };

    mockGetLoan.mockResolvedValue({
      id: 102,
      summary: { totalOutstanding: 0 },
    });

    const result = await runReconciliation();

    expect(result.matchedLoans).toBe(1);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('should handle multiple loans with mixed results', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 150.00,
          total_paid_usd: 50.00, status: 'active', loan_number: 'LN00001', product_category: 'smartphone',
        },
        {
          id: 'loan-002', fineract_loan_id: 102, outstanding_balance: 200.00,
          total_paid_usd: 0, status: 'active', loan_number: 'LN00002', product_category: 'digital',
        },
        {
          id: 'loan-003', fineract_loan_id: 103, outstanding_balance: 75.00,
          total_paid_usd: 125.00, status: 'active', loan_number: 'LN00003', product_category: 'smartphone',
        },
      ],
      error: null,
    };

    mockGetLoan
      .mockResolvedValueOnce({ id: 101, summary: { totalOutstanding: 150.00 } })  // match
      .mockResolvedValueOnce({ id: 102, summary: { totalOutstanding: 180.00 } })  // $20 discrepancy
      .mockResolvedValueOnce({ id: 103, summary: { totalOutstanding: 75.005 } }); // match (within tolerance)

    const result = await runReconciliation();

    expect(result.totalLoansChecked).toBe(3);
    expect(result.matchedLoans).toBe(2);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].lyniaLoanId).toBe('loan-002');
  });

  it('should count failedChecks when Fineract API call fails', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 150.00,
          total_paid_usd: 50.00, status: 'active', loan_number: 'LN00001', product_category: 'smartphone',
        },
      ],
      error: null,
    };

    mockGetLoan.mockRejectedValue(new Error('Fineract unavailable'));

    const result = await runReconciliation();

    expect(result.failedChecks).toBe(1);
    expect(result.matchedLoans).toBe(0);
    expect(result.discrepancies).toHaveLength(0);
  });
});

// ============================================================
// DISCREPANCY SEVERITY CLASSIFICATION
// ============================================================

describe('Discrepancy severity classification', () => {
  /**
   * Classification rules from source:
   *   - high: difference > $50 OR percentage > 10%
   *   - medium: difference > $5 OR percentage > 2%
   *   - low: everything else
   */

  it('should classify as "low" for small absolute and percentage difference', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 500.00,
          total_paid_usd: 0, status: 'active', loan_number: 'LN00001', product_category: 'smartphone',
        },
      ],
      error: null,
    };

    // $2 diff on $500 = 0.4% and under $5
    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 498.00 } });

    const result = await runReconciliation();

    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].severity).toBe('low');
  });

  it('should classify as "medium" for difference > $5 but <= $50', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 500.00,
          total_paid_usd: 0, status: 'active', loan_number: 'LN00001', product_category: 'smartphone',
        },
      ],
      error: null,
    };

    // $10 diff on $500 = 2% — medium (> $5)
    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 490.00 } });

    const result = await runReconciliation();

    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].severity).toBe('medium');
  });

  it('should classify as "high" for difference > $50', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 500.00,
          total_paid_usd: 0, status: 'active', loan_number: 'LN00001', product_category: 'smartphone',
        },
      ],
      error: null,
    };

    // $60 diff — high
    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 440.00 } });

    const result = await runReconciliation();

    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].severity).toBe('high');
  });

  it('should classify as "high" when percentage > 10%', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 30.00,
          total_paid_usd: 170.00, status: 'active', loan_number: 'LN00001', product_category: 'digital',
        },
      ],
      error: null,
    };

    // $5 diff on $30 = 16.7% — high (> 10%)
    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 25.00 } });

    const result = await runReconciliation();

    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].severity).toBe('high');
  });

  it('should classify as "medium" when percentage > 2% but <= 10%', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 100.00,
          total_paid_usd: 100.00, status: 'active', loan_number: 'LN00001', product_category: 'digital',
        },
      ],
      error: null,
    };

    // $3 diff on $100 = 3% — medium (> 2% but difference is only $3 which is < $5)
    // Actually: difference $3 > $5 is false, percentage 3% > 2% is true, so medium
    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 97.00 } });

    const result = await runReconciliation();

    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0].severity).toBe('medium');
  });
});

// ============================================================
// FAILED SYNC RETRY LOGIC
// ============================================================

describe('Failed sync retry logic', () => {
  it('should retry failed syncs with attempt_number < 3', async () => {
    mockDbData.loans = { data: [], error: null };

    mockDbData.fineract_sync_log = {
      data: [
        {
          id: 'sync-001',
          entity_type: 'loan',
          entity_id: 'loan-uuid-001',
          operation: 'approve',
          request_payload: JSON.stringify({ fineractLoanId: 101 }),
          attempt_number: 1,
          max_attempts: 3,
        },
      ],
      error: null,
    };

    mockApproveLoan.mockResolvedValue({ resourceId: 101, changes: {} });

    const result = await runReconciliation();

    expect(result.retriedSyncs).toBe(1);
    expect(result.retriedSuccesses).toBe(1);
  });

  it('should count retried syncs even when retry fails', async () => {
    mockDbData.loans = { data: [], error: null };

    mockDbData.fineract_sync_log = {
      data: [
        {
          id: 'sync-001',
          entity_type: 'loan',
          entity_id: 'loan-uuid-001',
          operation: 'approve',
          request_payload: JSON.stringify({ fineractLoanId: 101 }),
          attempt_number: 1,
          max_attempts: 3,
        },
      ],
      error: null,
    };

    mockApproveLoan.mockRejectedValue(new Error('Still failing'));

    const result = await runReconciliation();

    expect(result.retriedSyncs).toBe(1);
    expect(result.retriedSuccesses).toBe(0);
  });

  it('should handle empty failed syncs list gracefully', async () => {
    mockDbData.loans = { data: [], error: null };
    mockDbData.fineract_sync_log = { data: [], error: null };

    const result = await runReconciliation();

    expect(result.retriedSyncs).toBe(0);
    expect(result.retriedSuccesses).toBe(0);
  });
});

// ============================================================
// GL ACCOUNT RECONCILIATION
// ============================================================

describe('GL account reconciliation', () => {
  it('should detect GL account mismatches between Lynia and Fineract', async () => {
    mockDbData.loans = { data: [], error: null };
    mockDbData.fineract_sync_log = { data: [], error: null };

    mockDbData.loan_products = {
      data: [
        {
          id: 'prod-001',
          fineract_product_id: 1,
          fund_source_account_id: 10,
          loan_portfolio_account_id: 20,
          interest_on_loan_account_id: 30,
          deleted_at: null,
        },
      ],
      error: null,
    };

    mockGetLoanProduct.mockResolvedValue({
      id: 1,
      accountingMappings: {
        fundSourceAccountId: { id: 10, name: 'Fund Source', glCode: '100001' },
        loanPortfolioAccountId: { id: 99, name: 'Different Account', glCode: '100099' }, // MISMATCH
        interestOnLoanAccountId: { id: 30, name: 'Interest Income', glCode: '400001' },
      },
    });

    const result = await runReconciliation();

    expect(result.glProductsChecked).toBe(1);
    expect(result.glMismatches.length).toBeGreaterThanOrEqual(1);

    const loanPortfolioMismatch = result.glMismatches.find(
      (m) => m.field === 'loan_portfolio_account_id'
    );
    expect(loanPortfolioMismatch).toBeDefined();
    expect(loanPortfolioMismatch!.lyniaValue).toBe(20);
    expect(loanPortfolioMismatch!.fineractValue).toBe(99);
    expect(loanPortfolioMismatch!.severity).toBe('high');
  });

  it('should skip comparison when both Lynia and Fineract values are null', async () => {
    mockDbData.loans = { data: [], error: null };
    mockDbData.fineract_sync_log = { data: [], error: null };

    mockDbData.loan_products = {
      data: [
        {
          id: 'prod-001',
          fineract_product_id: 1,
          fund_source_account_id: 10,
          loan_portfolio_account_id: 20,
          deleted_at: null,
          // income_from_recovery_account_id is not set (null)
        },
      ],
      error: null,
    };

    mockGetLoanProduct.mockResolvedValue({
      id: 1,
      accountingMappings: {
        fundSourceAccountId: { id: 10, name: 'Fund Source', glCode: '100001' },
        loanPortfolioAccountId: { id: 20, name: 'Loan Portfolio', glCode: '100002' },
        // incomeFromRecoveryAccountId is not set (undefined -> null)
      },
    });

    const result = await runReconciliation();

    // No mismatches since matching values and both-null fields are skipped
    expect(result.glMismatches).toHaveLength(0);
  });

  it('should report mismatch when Lynia has a value but Fineract does not', async () => {
    mockDbData.loans = { data: [], error: null };
    mockDbData.fineract_sync_log = { data: [], error: null };

    mockDbData.loan_products = {
      data: [
        {
          id: 'prod-001',
          fineract_product_id: 1,
          fund_source_account_id: 10,
          deleted_at: null,
        },
      ],
      error: null,
    };

    mockGetLoanProduct.mockResolvedValue({
      id: 1,
      accountingMappings: {
        // fundSourceAccountId not present in Fineract
      },
    });

    const result = await runReconciliation();

    const mismatch = result.glMismatches.find(
      (m) => m.field === 'fund_source_account_id'
    );
    expect(mismatch).toBeDefined();
    expect(mismatch!.lyniaValue).toBe(10);
    expect(mismatch!.fineractValue).toBeNull();
  });
});

// ============================================================
// reconciliationHandler()
// ============================================================

describe('reconciliationHandler()', () => {
  it('should return 200 with reconciliation summary', async () => {
    mockDbData.loans = { data: [], error: null };
    mockDbData.fineract_sync_log = { data: [], error: null };
    mockDbData.loan_products = { data: [], error: null };

    const response = await reconciliationHandler();

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.reconciliation).toBeDefined();
    expect(body.reconciliation.totalLoansChecked).toBe(0);
  });

  it('should include discrepancy count in the response', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 100,
          total_paid_usd: 0, status: 'active', loan_number: 'LN00001', product_category: 'smartphone',
        },
      ],
      error: null,
    };
    mockDbData.fineract_sync_log = { data: [], error: null };
    mockDbData.loan_products = { data: [], error: null };

    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 50 } });

    const response = await reconciliationHandler();
    const body = JSON.parse(response.body);

    expect(body.reconciliation.totalLoansChecked).toBe(1);
    expect(body.reconciliation.discrepancyCount).toBe(1);
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('Edge cases', () => {
  it('should handle null outstanding_balance in Lynia as 0', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: null,
          total_paid_usd: 200, status: 'closed', loan_number: 'LN00001', product_category: 'smartphone',
        },
      ],
      error: null,
    };

    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 0 } });

    const result = await runReconciliation();

    // null ?? 0 = 0, Fineract 0, difference 0 -> match
    expect(result.matchedLoans).toBe(1);
  });

  it('should handle missing summary.totalOutstanding in Fineract as 0', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 0,
          total_paid_usd: 200, status: 'closed', loan_number: 'LN00001', product_category: 'digital',
        },
      ],
      error: null,
    };

    mockGetLoan.mockResolvedValue({ id: 101, summary: {} }); // no totalOutstanding field

    const result = await runReconciliation();

    // summary?.totalOutstanding ?? 0 = 0
    expect(result.matchedLoans).toBe(1);
  });

  it('should handle database query error gracefully', async () => {
    mockDbData.loans = { data: null, error: 'connection refused' };

    const result = await runReconciliation();

    expect(result.totalLoansChecked).toBe(0);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('should include product category in discrepancy details', async () => {
    mockDbData.loans = {
      data: [
        {
          id: 'loan-001', fineract_loan_id: 101, outstanding_balance: 100,
          total_paid_usd: 0, status: 'active', loan_number: 'LN00001', product_category: 'digital',
        },
      ],
      error: null,
    };

    mockGetLoan.mockResolvedValue({ id: 101, summary: { totalOutstanding: 80 } });

    const result = await runReconciliation();

    expect(result.discrepancies[0].productCategory).toBe('digital');
  });
});
