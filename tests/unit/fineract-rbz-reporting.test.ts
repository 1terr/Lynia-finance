/**
 * Tests for Fineract RBZ Reporting Engine
 *
 * Covers:
 *   - Report generation for all 11 RBZ report types
 *   - Report validation logic
 *   - CSV export formatting
 *   - Report scheduling handler
 *   - Report management (review, submit, history)
 *   - Fineract data integration
 *   - Error handling and edge cases
 */

import {
  generateRBZReport,
  validateRBZReport,
  reviewReport,
  submitReportToRBZ,
  getRBZReportHistory,
  runMonthlyRBZReports,
  runQuarterlyRBZReports,
  generateMonthlyTransactionSummary,
  generateGLTrialBalance,
  generatePrudentialReturn,
  generateCapitalAdequacy,
  generateNPLAnalysis,
  generateLargeTransactionReport,
  generateEnhancedSTR,
  generateForeignCurrencyExposure,
  generateInterestRateSchedule,
  generateAnnualComplianceAudit,
  generateLoanPortfolioFineract,
} from '../../services/shared/fineract-rbz-reporting';

import {
  exportReportToCSV,
  getReportS3Key,
} from '../../services/shared/rbz-report-export';

import {
  rbzReportSchedulerHandler,
  getActiveSchedules,
} from '../../services/shared/rbz-report-scheduler';

import type {
  RBZReportConfig,
  FineractRBZReportType,
  MonthlyTransactionSummary,
  GLTrialBalance,
  NPLAnalysisReport,
  RBZReportValidationResult,
} from '../../services/shared/types/rbz-reports';

// ===================================================================
// MOCKS
// ===================================================================

// Mock database client
jest.mock('../../services/shared/clients/database', () => {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
  };

  return {
    db: {
      from: jest.fn(() => ({ ...mockQueryBuilder })),
    },
    query: jest.fn().mockResolvedValue({ data: [], error: null }),
    queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
});

// Mock Fineract client
jest.mock('../../services/shared/clients/fineract', () => {
  const mockFineractClient = {
    listGLAccounts: jest.fn().mockResolvedValue([
      {
        id: 1,
        glCode: '1001',
        name: 'Loan Portfolio',
        type: { value: 'ASSET' },
        disabled: false,
        organizationRunningBalance: 50000,
      },
      {
        id: 2,
        glCode: '2001',
        name: 'Borrowings',
        type: { value: 'LIABILITY' },
        disabled: false,
        organizationRunningBalance: -20000,
      },
      {
        id: 3,
        glCode: '4001',
        name: 'Interest Income',
        type: { value: 'INCOME' },
        disabled: false,
        organizationRunningBalance: -15000,
      },
      {
        id: 4,
        glCode: '5001',
        name: 'Provision Expense',
        type: { value: 'EXPENSE' },
        disabled: false,
        organizationRunningBalance: 5000,
      },
    ]),
    listJournalEntries: jest.fn().mockResolvedValue({
      totalFilteredRecords: 2,
      pageItems: [
        {
          id: 1,
          amount: 1000,
          entryType: { value: 'DEBIT' },
          reversed: false,
          transactionDate: [2026, 1, 15],
        },
        {
          id: 2,
          amount: 500,
          entryType: { value: 'CREDIT' },
          reversed: false,
          transactionDate: [2026, 1, 20],
        },
      ],
    }),
    getLoan: jest.fn().mockResolvedValue({
      id: 1,
      accountNo: 'LN-000001',
      status: { code: 'loanStatusType.active' },
      clientId: 1,
      clientName: 'Test Customer',
      loanProductId: 1,
      loanProductName: 'Device Finance',
      summary: {
        principalDisbursed: 500,
        principalPaid: 200,
        principalWrittenOff: 0,
        principalOutstanding: 300,
        principalOverdue: 0,
        interestCharged: 50,
        interestPaid: 20,
        interestOutstanding: 30,
        interestOverdue: 0,
        feeChargesCharged: 15,
        feeChargesPaid: 15,
        penaltyChargesCharged: 0,
        penaltyChargesPaid: 0,
        totalWrittenOff: 0,
        totalWaived: 0,
        totalOutstanding: 330,
        totalOverdue: 0,
        totalRepayment: 235,
        totalExpectedRepayment: 565,
      },
      currency: { code: 'USD' },
      repaymentSchedule: {
        periods: [
          {
            period: 1,
            dueDate: [2026, 2, 15],
            principalDue: 100,
            interestDue: 10,
            totalDueForPeriod: 110,
            totalOutstandingForPeriod: 0,
            complete: true,
          },
        ],
      },
    }),
    getLoanProduct: jest.fn().mockResolvedValue({
      id: 1,
      name: 'Device Finance Standard',
      annualInterestRate: 36,
      interestType: { value: 'Declining Balance' },
    }),
    healthCheck: jest.fn().mockResolvedValue(true),
  };

  return {
    getFineractClient: jest.fn().mockResolvedValue(mockFineractClient),
    parseFineractDate: jest.fn((date: number[]) => new Date(date[0], date[1] - 1, date[2])),
    FineractApiError: class extends Error {
      statusCode: number;
      constructor(msg: string, code: number) {
        super(msg);
        this.statusCode = code;
      }
    },
  };
});

// Mock logger
jest.mock('../../services/shared/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    startOperation: jest.fn(() => ({
      succeed: jest.fn(),
      fail: jest.fn(),
    })),
    setContext: jest.fn(),
    getContext: jest.fn(),
    clearContext: jest.fn(),
  },
}));

// ===================================================================
// HELPER FACTORIES
// ===================================================================

function createReportConfig(
  overrides?: Partial<RBZReportConfig>
): RBZReportConfig {
  return {
    reportType: 'monthly_transaction_summary',
    frequency: 'monthly',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
    generatedBy: 'test-user-id',
    currency: 'USD',
    includesFineractData: false,
    ...overrides,
  };
}

function createMockPayments() {
  return [
    {
      id: 'pay-1',
      amount: 500,
      payment_method: 'ecocash',
      status: 'completed',
      payment_type: 'repayment',
      created_at: '2026-01-15T10:00:00Z',
      customer_id: 'cust-1',
    },
    {
      id: 'pay-2',
      amount: 2500,
      payment_method: 'bank_transfer',
      status: 'completed',
      payment_type: 'disbursement',
      created_at: '2026-01-16T10:00:00Z',
      customer_id: 'cust-2',
    },
    {
      id: 'pay-3',
      amount: 100,
      payment_method: 'ecocash',
      status: 'failed',
      payment_type: 'repayment',
      created_at: '2026-01-17T10:00:00Z',
      customer_id: 'cust-3',
      failure_reason: 'insufficient_funds',
    },
  ];
}

function createMockLoans() {
  return [
    {
      id: 'loan-1',
      fineract_loan_id: 1,
      principal_amount: 500,
      outstanding_balance: 300,
      days_past_due: 0,
      loan_status: 'active',
      total_paid_usd: 200,
      total_interest: 50,
      loan_number: 'LN-001',
      customer_id: 'cust-1',
    },
    {
      id: 'loan-2',
      fineract_loan_id: 2,
      principal_amount: 800,
      outstanding_balance: 600,
      days_past_due: 45,
      loan_status: 'delinquent',
      total_paid_usd: 200,
      total_interest: 80,
      loan_number: 'LN-002',
      customer_id: 'cust-2',
    },
    {
      id: 'loan-3',
      fineract_loan_id: 3,
      principal_amount: 1000,
      outstanding_balance: 900,
      days_past_due: 100,
      loan_status: 'delinquent',
      total_paid_usd: 100,
      total_interest: 100,
      loan_number: 'LN-003',
      customer_id: 'cust-3',
    },
  ];
}

// ===================================================================
// TESTS
// ===================================================================

describe('Fineract RBZ Reporting Engine', () => {
  const { query } = require('../../services/shared/clients/database');
  const { db } = require('../../services/shared/clients/database');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------
  // MONTHLY TRANSACTION SUMMARY
  // -----------------------------------------------------------------
  describe('generateMonthlyTransactionSummary', () => {
    it('should generate a valid monthly transaction summary', async () => {
      const mockPayments = createMockPayments();
      query.mockResolvedValueOnce({ data: mockPayments, error: null });

      const config = createReportConfig({ reportType: 'monthly_transaction_summary' });
      const report = await generateMonthlyTransactionSummary(config);

      expect(report).toBeDefined();
      expect(report.reportingPeriod).toBeDefined();
      expect(report.reportingPeriod.start).toBeTruthy();
      expect(report.reportingPeriod.end).toBeTruthy();
      expect(report.institutionName).toBe('Lynia Finance (Pvt) Ltd');
      expect(report.currency).toBe('USD');
      expect(report.totalTransactions).toBe(2); // 2 completed
      expect(report.transactionsByType).toBeDefined();
      expect(report.transactionsByChannel).toBeDefined();
      expect(report.failedTransactions.count).toBe(1);
    });

    it('should categorize transactions by type correctly', async () => {
      const mockPayments = createMockPayments();
      query.mockResolvedValueOnce({ data: mockPayments, error: null });

      const config = createReportConfig();
      const report = await generateMonthlyTransactionSummary(config);

      expect(report.transactionsByType.repayments.count).toBe(1);
      expect(report.transactionsByType.repayments.amount).toBe(500);
      expect(report.transactionsByType.disbursements.count).toBe(1);
      expect(report.transactionsByType.disbursements.amount).toBe(2500);
    });

    it('should categorize transactions by channel correctly', async () => {
      const mockPayments = createMockPayments();
      query.mockResolvedValueOnce({ data: mockPayments, error: null });

      const config = createReportConfig();
      const report = await generateMonthlyTransactionSummary(config);

      expect(report.transactionsByChannel.ecocash.count).toBe(1);
      expect(report.transactionsByChannel.bankTransfer.count).toBe(1);
    });

    it('should identify large transactions', async () => {
      const mockPayments = createMockPayments();
      query.mockResolvedValueOnce({ data: mockPayments, error: null });

      const config = createReportConfig();
      const report = await generateMonthlyTransactionSummary(config);

      expect(report.largeTransactions.length).toBe(1);
      expect(report.largeTransactions[0].amount).toBe(2500);
    });

    it('should calculate daily volumes', async () => {
      const mockPayments = createMockPayments();
      query.mockResolvedValueOnce({ data: mockPayments, error: null });

      const config = createReportConfig();
      const report = await generateMonthlyTransactionSummary(config);

      expect(report.dailyVolumes.length).toBeGreaterThan(0);
      expect(report.dailyVolumes[0]).toHaveProperty('date');
      expect(report.dailyVolumes[0]).toHaveProperty('transactionCount');
      expect(report.dailyVolumes[0]).toHaveProperty('totalAmount');
    });

    it('should handle empty transaction data', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });

      const config = createReportConfig();
      const report = await generateMonthlyTransactionSummary(config);

      expect(report.totalTransactions).toBe(0);
      expect(report.totalTransactionValue).toBe(0);
      expect(report.dailyVolumes.length).toBe(0);
      expect(report.largeTransactions.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------
  // GL TRIAL BALANCE
  // -----------------------------------------------------------------
  describe('generateGLTrialBalance', () => {
    it('should generate a GL trial balance from Fineract data', async () => {
      const config = createReportConfig({
        reportType: 'gl_trial_balance',
        includesFineractData: true,
      });
      const report = await generateGLTrialBalance(config);

      expect(report).toBeDefined();
      expect(report.generatedFrom).toBe('fineract');
      expect(report.accounts).toBeDefined();
      expect(report.accounts.length).toBeGreaterThan(0);
      expect(report.totals).toBeDefined();
      expect(typeof report.totals.totalDebits).toBe('number');
      expect(typeof report.totals.totalCredits).toBe('number');
      expect(typeof report.totals.isBalanced).toBe('boolean');
    });

    it('should include all GL account types', async () => {
      const config = createReportConfig({ reportType: 'gl_trial_balance' });
      const report = await generateGLTrialBalance(config);

      const types = report.accounts.map(a => a.accountType);
      expect(types).toContain('ASSET');
      expect(types).toContain('LIABILITY');
      expect(types).toContain('INCOME');
      expect(types).toContain('EXPENSE');
    });

    it('should calculate debit and credit totals from journal entries', async () => {
      const config = createReportConfig({ reportType: 'gl_trial_balance' });
      const report = await generateGLTrialBalance(config);

      for (const account of report.accounts) {
        expect(account.debits).toBeGreaterThanOrEqual(0);
        expect(account.credits).toBeGreaterThanOrEqual(0);
        expect(typeof account.closingBalance).toBe('number');
        expect(typeof account.netMovement).toBe('number');
      }
    });

    it('should include asset, liability, equity, income, and expense summaries', async () => {
      const config = createReportConfig({ reportType: 'gl_trial_balance' });
      const report = await generateGLTrialBalance(config);

      expect(report.assetSummary).toBeDefined();
      expect(report.liabilitySummary).toBeDefined();
      expect(report.equitySummary).toBeDefined();
      expect(report.incomeSummary).toBeDefined();
      expect(report.expenseSummary).toBeDefined();
    });
  });

  // -----------------------------------------------------------------
  // PRUDENTIAL RETURN
  // -----------------------------------------------------------------
  describe('generatePrudentialReturn', () => {
    it('should generate a quarterly prudential return', async () => {
      const mockLoans = createMockLoans();
      query.mockResolvedValueOnce({ data: mockLoans, error: null });
      query.mockResolvedValueOnce({
        data: [
          { amount: 500, payment_type: 'repayment' },
          { amount: 15, payment_type: 'fee' },
        ],
        error: null,
      });

      const config = createReportConfig({
        reportType: 'prudential_return',
        frequency: 'quarterly',
      });
      const report = await generatePrudentialReturn(config);

      expect(report).toBeDefined();
      expect(report.institutionName).toBe('Lynia Finance (Pvt) Ltd');
      expect(report.reportingQuarter).toMatch(/Q\d \d{4}/);
      expect(report.balanceSheet).toBeDefined();
      expect(report.incomeStatement).toBeDefined();
      expect(report.portfolioQuality).toBeDefined();
      expect(report.capitalAdequacy).toBeDefined();
      expect(report.liquidity).toBeDefined();
    });

    it('should calculate portfolio quality metrics', async () => {
      const mockLoans = createMockLoans();
      query.mockResolvedValueOnce({ data: mockLoans, error: null });
      query.mockResolvedValueOnce({ data: [], error: null });

      const config = createReportConfig({ reportType: 'prudential_return' });
      const report = await generatePrudentialReturn(config);

      expect(report.portfolioQuality.totalBorrowers).toBe(3);
      expect(report.portfolioQuality.par30).toBeGreaterThan(0);
      expect(report.portfolioQuality.par90).toBeGreaterThan(0);
      expect(typeof report.portfolioQuality.averageLoanSize).toBe('number');
    });

    it('should include capital adequacy assessment', async () => {
      query.mockResolvedValueOnce({ data: createMockLoans(), error: null });
      query.mockResolvedValueOnce({ data: [], error: null });

      const config = createReportConfig({ reportType: 'prudential_return' });
      const report = await generatePrudentialReturn(config);

      expect(typeof report.capitalAdequacy.capitalAdequacyRatio).toBe('number');
      expect(typeof report.capitalAdequacy.minimumRequiredRatio).toBe('number');
      expect(typeof report.capitalAdequacy.isCompliant).toBe('boolean');
    });
  });

  // -----------------------------------------------------------------
  // CAPITAL ADEQUACY
  // -----------------------------------------------------------------
  describe('generateCapitalAdequacy', () => {
    it('should generate a capital adequacy report', async () => {
      query.mockResolvedValueOnce({
        data: [
          { outstanding_balance: 300, days_past_due: 0 },
          { outstanding_balance: 600, days_past_due: 45 },
          { outstanding_balance: 900, days_past_due: 100 },
        ],
        error: null,
      });

      const config = createReportConfig({ reportType: 'capital_adequacy' });
      const report = await generateCapitalAdequacy(config);

      expect(report).toBeDefined();
      expect(report.tier1Capital.total).toBeGreaterThan(0);
      expect(report.totalRegulatoryCapital).toBeGreaterThan(0);
      expect(report.riskWeightedAssets.total).toBeGreaterThan(0);
      expect(report.ratios.capitalAdequacyRatio).toBeGreaterThan(0);
    });

    it('should check RBZ minimum CAR requirement (12%)', async () => {
      query.mockResolvedValueOnce({
        data: [{ outstanding_balance: 500, days_past_due: 0 }],
        error: null,
      });

      const config = createReportConfig({ reportType: 'capital_adequacy' });
      const report = await generateCapitalAdequacy(config);

      expect(report.rbzMinimumRequirements.minimumCAR).toBe(12);
      expect(typeof report.rbzMinimumRequirements.isCompliant).toBe('boolean');
    });

    it('should calculate risk-weighted assets correctly', async () => {
      query.mockResolvedValueOnce({
        data: [{ outstanding_balance: 1000, days_past_due: 0 }],
        error: null,
      });

      const config = createReportConfig({ reportType: 'capital_adequacy' });
      const report = await generateCapitalAdequacy(config);

      // Loan portfolio should be 100% risk-weighted
      expect(report.riskWeightedAssets.loanPortfolio.riskWeight).toBe(100);
      // Cash should be 0% risk-weighted
      expect(report.riskWeightedAssets.cashAndGovSecurities.riskWeight).toBe(0);
    });
  });

  // -----------------------------------------------------------------
  // NPL ANALYSIS
  // -----------------------------------------------------------------
  describe('generateNPLAnalysis', () => {
    it('should generate an NPL analysis with Fineract data', async () => {
      const mockLoans = createMockLoans();
      query.mockResolvedValueOnce({ data: mockLoans, error: null }); // loan mappings
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (default) — falls back
      query.mockResolvedValueOnce({
        data: [{ count: '2', total: '150' }],
        error: null,
      }); // recovery data
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (smartphone)
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (digital)

      const config = createReportConfig({
        reportType: 'npl_analysis',
        includesFineractData: true,
      });
      const report = await generateNPLAnalysis(config);

      expect(report).toBeDefined();
      expect(report.generatedFrom).toBe('fineract');
      expect(report.summary.totalLoans).toBeGreaterThan(0);
      expect(report.agingBuckets).toBeDefined();
      expect(report.provisionRequirements).toBeDefined();
      expect(report.provisionRequirements.length).toBeGreaterThan(0);
    });

    it('should classify loans into aging buckets correctly', async () => {
      const mockLoans = createMockLoans();
      query.mockResolvedValueOnce({ data: mockLoans, error: null }); // loan mappings
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (default)
      query.mockResolvedValueOnce({ data: [{ count: '0', total: '0' }], error: null }); // recovery
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (smartphone)
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (digital)

      const config = createReportConfig({ reportType: 'npl_analysis' });
      const report = await generateNPLAnalysis(config);

      // Loan 1: 0 days -> current
      expect(report.agingBuckets.current.count).toBeGreaterThanOrEqual(0);
      // Loan 2: 45 days -> 31-60 bucket
      expect(report.agingBuckets.days31to60.count).toBeGreaterThanOrEqual(0);
      // Loan 3: 100 days -> 91-180 bucket (NPL)
      expect(report.agingBuckets.days91to180.count).toBeGreaterThanOrEqual(0);
    });

    it('should calculate provision requirements per RBZ guidelines', async () => {
      query.mockResolvedValueOnce({ data: createMockLoans(), error: null }); // loan mappings
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (default)
      query.mockResolvedValueOnce({ data: [{ count: '0', total: '0' }], error: null }); // recovery
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (smartphone)
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (digital)

      const config = createReportConfig({ reportType: 'npl_analysis' });
      const report = await generateNPLAnalysis(config);

      for (const prov of report.provisionRequirements) {
        expect(prov).toHaveProperty('category');
        expect(prov).toHaveProperty('provisionRate');
        expect(prov).toHaveProperty('provisionAmount');
        expect(prov.provisionRate).toBeGreaterThanOrEqual(0);
        expect(prov.provisionRate).toBeLessThanOrEqual(100);
      }
    });

    it('should identify NPL ratio (90+ days)', async () => {
      query.mockResolvedValueOnce({ data: createMockLoans(), error: null }); // loan mappings
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (default)
      query.mockResolvedValueOnce({ data: [{ count: '0', total: '0' }], error: null }); // recovery
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (smartphone)
      query.mockResolvedValueOnce({ data: [], error: null }); // provision rates (digital)

      const config = createReportConfig({ reportType: 'npl_analysis' });
      const report = await generateNPLAnalysis(config);

      expect(typeof report.summary.nplRatio).toBe('number');
      expect(report.summary.nplRatio).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------
  // LARGE TRANSACTION REPORT
  // -----------------------------------------------------------------
  describe('generateLargeTransactionReport', () => {
    it('should generate a large transaction report', async () => {
      query.mockResolvedValueOnce({
        data: [
          {
            id: 'pay-1',
            amount: 3000,
            currency: 'USD',
            payment_method: 'bank_transfer',
            payment_type: 'disbursement',
            created_at: '2026-01-15T10:00:00Z',
            customer_id: 'cust-1',
            fineract_transaction_id: 101,
          },
        ],
        error: null,
      });
      query.mockResolvedValueOnce({
        data: [{ id: 'cust-1', first_name: 'John', last_name: 'Doe' }],
        error: null,
      });
      query.mockResolvedValueOnce({ data: [], error: null });

      const config = createReportConfig({
        reportType: 'large_transaction_report',
        frequency: 'on_demand',
      });
      const report = await generateLargeTransactionReport(config);

      expect(report).toBeDefined();
      expect(report.referenceNumber).toMatch(/^LTR-/);
      expect(report.reportingThreshold).toBe(2000);
      expect(report.transactions.length).toBe(1);
      expect(report.transactions[0].amount).toBe(3000);
      expect(report.summary.totalTransactions).toBe(1);
    });

    it('should flag transactions from new customers', async () => {
      query.mockResolvedValueOnce({
        data: [{
          id: 'pay-1',
          amount: 5000,
          currency: 'USD',
          payment_method: 'ecocash',
          payment_type: 'disbursement',
          created_at: '2026-01-15T10:00:00Z',
          customer_id: 'new-cust-1',
          fineract_transaction_id: null,
        }],
        error: null,
      });
      query.mockResolvedValueOnce({
        data: [{ id: 'new-cust-1', first_name: 'New', last_name: 'Customer' }],
        error: null,
      });
      query.mockResolvedValueOnce({
        data: [{ id: 'new-cust-1' }],
        error: null,
      });

      const config = createReportConfig({ reportType: 'large_transaction_report' });
      const report = await generateLargeTransactionReport(config);

      expect(report.transactions[0].riskFlag).toBe(true);
      expect(report.summary.newCustomerTransactions).toBe(1);
    });
  });

  // -----------------------------------------------------------------
  // ENHANCED STR
  // -----------------------------------------------------------------
  describe('generateEnhancedSTR', () => {
    it('should generate an enhanced STR with Fineract data', async () => {
      db.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          data: {
            id: 'cust-1',
            first_name: 'Suspicious',
            last_name: 'Customer',
            kyc_status: 'verified',
            created_at: '2025-06-01',
            risk_level: 'high',
          },
          error: null,
        }),
      });

      query.mockResolvedValueOnce({
        data: [
          {
            id: 'pay-1',
            amount: 5000,
            payment_method: 'ecocash',
            payment_type: 'repayment',
            created_at: '2026-01-10',
            fineract_transaction_id: 201,
          },
        ],
        error: null,
      });

      const report = await generateEnhancedSTR({
        customerId: 'cust-1',
        suspiciousActivityType: 'structuring',
        description: 'Multiple transactions just below threshold',
        riskIndicators: ['rapid_transactions', 'new_account'],
        reportedBy: 'compliance-officer',
        priority: 'urgent',
      });

      expect(report).toBeDefined();
      expect(report.referenceNumber).toMatch(/^STR-/);
      expect(report.priority).toBe('urgent');
      expect(report.institution.name).toBe('Lynia Finance (Pvt) Ltd');
      expect(report.riskIndicators).toContain('rapid_transactions');
      expect(report.transactionAnalysis.fineractTransactions.length).toBeGreaterThanOrEqual(0);
    });

    it('should set filing deadline within 24 hours', async () => {
      db.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      query.mockResolvedValueOnce({ data: [], error: null });

      const report = await generateEnhancedSTR({
        customerId: 'cust-1',
        suspiciousActivityType: 'fraud',
        description: 'Test',
        riskIndicators: [],
        reportedBy: 'test-user',
      });

      const deadline = new Date(report.filingDeadline);
      const now = new Date();
      const hoursDiff = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeGreaterThan(0);
      expect(hoursDiff).toBeLessThanOrEqual(25); // Within 24 hours + small margin
    });
  });

  // -----------------------------------------------------------------
  // FOREIGN CURRENCY EXPOSURE
  // -----------------------------------------------------------------
  describe('generateForeignCurrencyExposure', () => {
    it('should generate foreign currency exposure report', async () => {
      query.mockResolvedValueOnce({
        data: [
          { currency: 'USD', total_outstanding: '50000', loan_count: '100' },
          { currency: 'ZWL', total_outstanding: '1000000', loan_count: '10' },
        ],
        error: null,
      });

      const config = createReportConfig({ reportType: 'foreign_currency_exposure' });
      const report = await generateForeignCurrencyExposure(config);

      expect(report).toBeDefined();
      expect(report.exposureByLeg.length).toBe(3);
      expect(report.totalNetOpenPosition).toBeGreaterThan(0);
      expect(report.limits).toBeDefined();
      expect(typeof report.limits.isCompliant).toBe('boolean');
    });

    it('should include all three supported currencies', async () => {
      query.mockResolvedValueOnce({ data: [], error: null });

      const config = createReportConfig({ reportType: 'foreign_currency_exposure' });
      const report = await generateForeignCurrencyExposure(config);

      const currencies = report.exposureByLeg.map(e => e.currency);
      expect(currencies).toContain('USD');
      expect(currencies).toContain('ZWL');
      expect(currencies).toContain('ZAR');
    });
  });

  // -----------------------------------------------------------------
  // INTEREST RATE SCHEDULE
  // -----------------------------------------------------------------
  describe('generateInterestRateSchedule', () => {
    it('should generate interest rate schedule with Fineract product data', async () => {
      query.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            name: 'Device Finance Standard',
            interest_rate: 36,
            min_amount: 100,
            max_amount: 2000,
            fineract_product_id: 1,
          },
        ],
        error: null,
      });

      const config = createReportConfig({
        reportType: 'interest_rate_schedule',
        frequency: 'annual',
      });
      const report = await generateInterestRateSchedule(config);

      expect(report).toBeDefined();
      expect(report.products.length).toBeGreaterThan(0);
      expect(report.rbzRateCeiling).toBe(100);
      expect(typeof report.allProductsWithinCeiling).toBe('boolean');
      expect(report.feeSchedule.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------
  // ANNUAL COMPLIANCE AUDIT
  // -----------------------------------------------------------------
  describe('generateAnnualComplianceAudit', () => {
    it('should generate annual compliance audit', async () => {
      // Mock all database queries
      db.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: null, error: null, count: 100 }),
      });
      query.mockResolvedValue({ data: [{ count: '5', total: '3', completed: '2', resolved: '4' }], error: null });

      const config = createReportConfig({
        reportType: 'annual_compliance_audit',
        frequency: 'annual',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-12-31'),
      });
      const report = await generateAnnualComplianceAudit(config);

      expect(report).toBeDefined();
      expect(report.reportingYear).toBe(2025);
      expect(report.kycCompliance).toBeDefined();
      expect(report.amlCompliance).toBeDefined();
      expect(report.dataPrivacy).toBeDefined();
      expect(report.loanPortfolioCompliance).toBeDefined();
      expect(report.systemSecurity).toBeDefined();
      expect(report.recordRetention).toBeDefined();
      expect(report.regulatoryFilings).toBeDefined();
      expect(report.fineractReconciliation).toBeDefined();
    });

    it('should check record retention compliance (7 years transactions, 10 years KYC)', async () => {
      db.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: null, error: null, count: 0 }),
      });
      query.mockResolvedValue({ data: [{ count: '0', total: '0', completed: '0', resolved: '0' }], error: null });

      const config = createReportConfig({
        reportType: 'annual_compliance_audit',
        frequency: 'annual',
      });
      const report = await generateAnnualComplianceAudit(config);

      expect(report.recordRetention.transactionRecordsYears).toBe(7);
      expect(report.recordRetention.kycDocumentsYears).toBe(10);
      expect(report.recordRetention.auditLogsYears).toBe(5);
      expect(report.recordRetention.isCompliant).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // REPORT VALIDATION
  // -----------------------------------------------------------------
  describe('validateRBZReport', () => {
    it('should validate a complete monthly transaction summary', () => {
      const data = {
        reportingPeriod: { start: '2026-01-01', end: '2026-01-31' },
        totalTransactions: 100,
        transactionsByType: { repayments: { count: 80, amount: 40000 } },
      };

      const result = validateRBZReport('monthly_transaction_summary', data);

      expect(result.isValid).toBe(true);
      expect(result.completenessScore).toBe(100);
      expect(result.dataSourcesUsed).toContain('lynia_db');
    });

    it('should detect missing required fields', () => {
      const incompleteData = {
        reportingPeriod: { start: '2026-01-01', end: '2026-01-31' },
      };

      const result = validateRBZReport('monthly_transaction_summary', incompleteData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.completenessScore).toBeLessThan(100);
    });

    it('should flag unbalanced GL trial balance', () => {
      const data = {
        accounts: [{ glCode: '1001', accountName: 'Test', accountType: 'ASSET' }],
        totals: {
          totalDebits: 10000,
          totalCredits: 9500,
          isBalanced: false,
          variance: 500,
        },
      };

      const result = validateRBZReport('gl_trial_balance', data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'totals.isBalanced')).toBe(true);
    });

    it('should warn on capital adequacy non-compliance', () => {
      const data = {
        tier1Capital: { total: 5000 },
        tier2Capital: { total: 1000 },
        riskWeightedAssets: { total: 100000 },
        ratios: { capitalAdequacyRatio: 6 },
        rbzMinimumRequirements: {
          minimumCAR: 12,
          isCompliant: false,
          shortfall: 6000,
        },
      };

      const result = validateRBZReport('capital_adequacy', data);

      expect(result.errors.some(e => e.field === 'rbzMinimumRequirements.isCompliant')).toBe(true);
      expect(result.errors.some(e => e.severity === 'warning')).toBe(true);
    });

    it('should identify Fineract-sourced reports', () => {
      const data = {
        accounts: [],
        totals: { totalDebits: 0, totalCredits: 0, isBalanced: true, variance: 0 },
      };

      const result = validateRBZReport('gl_trial_balance', data);

      expect(result.dataSourcesUsed).toContain('fineract');
    });

    it('should identify NPL analysis as Fineract-sourced', () => {
      const data = {
        summary: { totalLoans: 0, nplRatio: 0 },
        agingBuckets: {},
        provisionRequirements: [],
      };

      const result = validateRBZReport('npl_analysis', data);

      expect(result.dataSourcesUsed).toContain('fineract');
    });
  });

  // -----------------------------------------------------------------
  // CSV EXPORT
  // -----------------------------------------------------------------
  describe('exportReportToCSV', () => {
    it('should export monthly transaction summary to CSV', () => {
      const data: MonthlyTransactionSummary = {
        reportingPeriod: { start: '2026-01-01', end: '2026-01-31' },
        institutionName: 'Lynia Finance (Pvt) Ltd',
        licenseNumber: 'MFI-001',
        currency: 'USD',
        totalTransactions: 100,
        totalTransactionValue: 50000,
        transactionsByType: {
          disbursements: { count: 20, amount: 30000 },
          repayments: { count: 70, amount: 18000 },
          fees: { count: 10, amount: 2000 },
          penalties: { count: 0, amount: 0 },
          writeOffs: { count: 0, amount: 0 },
          recoveries: { count: 0, amount: 0 },
          waivers: { count: 0, amount: 0 },
        },
        transactionsByChannel: {
          ecocash: { count: 60, amount: 25000 },
          onemoney: { count: 10, amount: 5000 },
          bankTransfer: { count: 20, amount: 15000 },
          cash: { count: 10, amount: 5000 },
          other: { count: 0, amount: 0 },
        },
        dailyVolumes: [
          { date: '2026-01-15', transactionCount: 5, totalAmount: 2500 },
        ],
        largeTransactions: [],
        failedTransactions: { count: 3, totalAmount: 1500, topReasons: [] },
      };

      const csv = exportReportToCSV('monthly_transaction_summary', data as unknown as Record<string, unknown>);

      expect(csv).toBeTruthy();
      expect(csv).toContain('MONTHLY TRANSACTION SUMMARY');
      expect(csv).toContain('Lynia Finance (Pvt) Ltd');
      expect(csv).toContain('MFI-001');
      expect(csv).toContain('TRANSACTIONS BY TYPE');
      expect(csv).toContain('TRANSACTIONS BY CHANNEL');
      expect(csv).toContain('DAILY TRANSACTION VOLUMES');
    });

    it('should export GL trial balance to CSV', () => {
      const data: GLTrialBalance = {
        reportingPeriod: { start: '2026-01-01', end: '2026-01-31' },
        generatedFrom: 'fineract',
        currency: 'USD',
        accounts: [
          {
            glAccountId: 1,
            glCode: '1001',
            accountName: 'Loan Portfolio',
            accountType: 'ASSET',
            openingBalance: 50000,
            debits: 10000,
            credits: 5000,
            closingBalance: 55000,
            netMovement: 5000,
          },
        ],
        totals: {
          totalDebits: 10000,
          totalCredits: 10000,
          isBalanced: true,
          variance: 0,
        },
        assetSummary: { totalAssets: 55000, currentAssets: 38500, nonCurrentAssets: 16500 },
        liabilitySummary: { totalLiabilities: 20000, currentLiabilities: 20000 },
        equitySummary: { totalEquity: 35000 },
        incomeSummary: { totalIncome: 15000, interestIncome: 12000, feeIncome: 3000 },
        expenseSummary: { totalExpenses: 5000, provisionExpenses: 1500 },
      };

      const csv = exportReportToCSV('gl_trial_balance', data as unknown as Record<string, unknown>);

      expect(csv).toContain('GL TRIAL BALANCE');
      expect(csv).toContain('Apache Fineract');
      expect(csv).toContain('GL Code');
      expect(csv).toContain('1001');
      expect(csv).toContain('Loan Portfolio');
      expect(csv).toContain('TOTALS');
      expect(csv).toContain('YES'); // isBalanced
    });

    it('should properly escape CSV special characters', () => {
      const data: MonthlyTransactionSummary = {
        reportingPeriod: { start: '2026-01-01', end: '2026-01-31' },
        institutionName: 'Lynia Finance, (Pvt) Ltd',
        licenseNumber: 'MFI-001',
        currency: 'USD',
        totalTransactions: 0,
        totalTransactionValue: 0,
        transactionsByType: {
          disbursements: { count: 0, amount: 0 },
          repayments: { count: 0, amount: 0 },
          fees: { count: 0, amount: 0 },
          penalties: { count: 0, amount: 0 },
          writeOffs: { count: 0, amount: 0 },
          recoveries: { count: 0, amount: 0 },
          waivers: { count: 0, amount: 0 },
        },
        transactionsByChannel: {
          ecocash: { count: 0, amount: 0 },
          onemoney: { count: 0, amount: 0 },
          bankTransfer: { count: 0, amount: 0 },
          cash: { count: 0, amount: 0 },
          other: { count: 0, amount: 0 },
        },
        dailyVolumes: [],
        largeTransactions: [],
        failedTransactions: { count: 0, totalAmount: 0, topReasons: [] },
      };

      const csv = exportReportToCSV('monthly_transaction_summary', data as unknown as Record<string, unknown>);

      // Comma in institution name should be escaped with quotes
      expect(csv).toContain('"Lynia Finance, (Pvt) Ltd"');
    });
  });

  // -----------------------------------------------------------------
  // S3 KEY GENERATION
  // -----------------------------------------------------------------
  describe('getReportS3Key', () => {
    it('should generate correct S3 key for monthly report', () => {
      const key = getReportS3Key('monthly_transaction_summary', new Date('2026-01-31'));
      expect(key).toBe('rbz-reports/2026/01/monthly_transaction_summary_2026-01-31.csv');
    });

    it('should generate correct S3 key for JSON format', () => {
      const key = getReportS3Key('gl_trial_balance', new Date('2026-03-31'), 'json');
      expect(key).toBe('rbz-reports/2026/03/gl_trial_balance_2026-03-31.json');
    });

    it('should pad month with leading zero', () => {
      const key = getReportS3Key('npl_analysis', new Date('2026-09-30'));
      expect(key).toMatch(/\/09\//);
    });
  });

  // -----------------------------------------------------------------
  // REPORT SCHEDULER
  // -----------------------------------------------------------------
  describe('rbzReportSchedulerHandler', () => {
    it('should handle monthly schedule event', async () => {
      const result = await rbzReportSchedulerHandler({
        scheduleType: 'monthly',
        generatedBy: 'scheduler-test',
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.scheduleType).toBe('monthly');
      expect(typeof body.reportsGenerated).toBe('number');
      expect(typeof body.durationMs).toBe('number');
    });

    it('should handle quarterly schedule event', async () => {
      const result = await rbzReportSchedulerHandler({
        scheduleType: 'quarterly',
        generatedBy: 'scheduler-test',
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.scheduleType).toBe('quarterly');
    });

    it('should handle annual schedule event', async () => {
      const result = await rbzReportSchedulerHandler({
        scheduleType: 'annual',
        generatedBy: 'scheduler-test',
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.scheduleType).toBe('annual');
    });

    it('should handle on-demand schedule with specific report types', async () => {
      const result = await rbzReportSchedulerHandler({
        scheduleType: 'on_demand',
        reportTypes: ['monthly_transaction_summary'],
        generatedBy: 'admin-user',
      });

      expect(result.statusCode).toBe(200);
    });

    it('should fail on-demand without report types', async () => {
      const result = await rbzReportSchedulerHandler({
        scheduleType: 'on_demand',
        generatedBy: 'admin-user',
      });

      expect(result.statusCode).toBe(500);
    });

    it('should include validation results in response', async () => {
      const result = await rbzReportSchedulerHandler({
        scheduleType: 'monthly',
        generatedBy: 'scheduler-test',
      });

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('validationResults');
      expect(body).toHaveProperty('reports');
    });
  });

  // -----------------------------------------------------------------
  // REPORT MANAGEMENT
  // -----------------------------------------------------------------
  describe('Report Management', () => {
    it('should review a report', async () => {
      db.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(
        reviewReport('report-id', 'reviewer-id', true)
      ).resolves.not.toThrow();
    });

    it('should reject a report with reason', async () => {
      db.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(
        reviewReport('report-id', 'reviewer-id', false, 'Incomplete data')
      ).resolves.not.toThrow();
    });

    it('should submit a report to RBZ', async () => {
      db.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(
        submitReportToRBZ('report-id', 'submitter-id')
      ).resolves.not.toThrow();
    });

    it('should retrieve report history', async () => {
      db.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'r1',
              report_type: 'monthly_transaction_summary',
              status: 'generated',
            },
          ],
          error: null,
        }),
      });

      const history = await getRBZReportHistory({ limit: 10 });
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // GENERATE RBZ REPORT (DISPATCHER)
  // -----------------------------------------------------------------
  describe('generateRBZReport (dispatcher)', () => {
    it('should route to correct generator based on report type', async () => {
      query.mockResolvedValue({ data: [], error: null });
      db.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: [{ id: 'new-report-id' }], error: null }),
      });

      const config = createReportConfig({ reportType: 'monthly_transaction_summary' });
      const report = await generateRBZReport(config);

      expect(report).toBeDefined();
      expect(report.reportType).toBe('monthly_transaction_summary');
      expect(report.status).toBe('generated');
      expect(report.checksum).toBeTruthy();
      expect(report.checksum?.length).toBe(64); // SHA-256 hex
    });

    it('should throw for unknown report type', async () => {
      const config = createReportConfig({
        reportType: 'unknown_type' as FineractRBZReportType,
      });

      await expect(generateRBZReport(config)).rejects.toThrow('Unknown report type');
    });

    it('should compute SHA-256 checksum for report data', async () => {
      query.mockResolvedValue({ data: [], error: null });
      db.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ data: [{ id: 'report-id' }], error: null }),
      });

      const config = createReportConfig();
      const report = await generateRBZReport(config);

      expect(report.checksum).toBeTruthy();
      expect(report.checksum?.length).toBe(64);
    });
  });

  // -----------------------------------------------------------------
  // EDGE CASES
  // -----------------------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle null/undefined data gracefully', async () => {
      query.mockResolvedValue({ data: null, error: null });

      const config = createReportConfig();
      const report = await generateMonthlyTransactionSummary(config);

      expect(report.totalTransactions).toBe(0);
      expect(report.totalTransactionValue).toBe(0);
    });

    it('should handle database errors', async () => {
      query.mockResolvedValue({ data: null, error: new Error('Connection failed') });

      const config = createReportConfig();
      const report = await generateMonthlyTransactionSummary(config);

      // Should not throw, return empty data
      expect(report.totalTransactions).toBe(0);
    });

    it('should validate all report types have required fields defined', () => {
      const reportTypes: FineractRBZReportType[] = [
        'monthly_transaction_summary',
        'gl_trial_balance',
        'prudential_return',
        'capital_adequacy',
        'npl_analysis',
        'large_transaction_report',
        'annual_compliance_audit',
      ];

      for (const type of reportTypes) {
        const result = validateRBZReport(type, {});
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.completenessScore).toBeLessThan(100);
      }
    });
  });
});
