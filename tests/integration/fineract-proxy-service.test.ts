/**
 * Fineract Proxy Service Integration Tests
 *
 * Tests for the Fineract proxy Lambda that serves the admin portal
 * Fineract UI pages. Uses mocked database and Fineract API responses.
 *
 * Test coverage:
 *   - Route matching (15 endpoints)
 *   - Loan list, detail, pending, overdue, aging-summary endpoints
 *   - Loan actions: approve, disburse, repayment
 *   - Loan product list/detail
 *   - GL accounts, journal entries, trial balance
 *   - Reconciliation get/run
 *   - Error handling (404, 400, 500)
 *   - Date conversion (Fineract arrays → ISO strings)
 *   - Pagination support
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// ============================================================
// MOCK SETUP
// ============================================================

// Mock database client
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockExecute: any = jest.fn();
const mockSingle = jest.fn(() => ({ execute: mockExecute }));
const mockLimit = jest.fn(() => ({ execute: mockExecute, single: mockSingle }));
const mockRange = jest.fn(() => ({ execute: mockExecute }));
const mockOrder = jest.fn(() => ({
  execute: mockExecute,
  limit: mockLimit,
  range: mockRange,
}));
const mockIs = jest.fn(() => ({ execute: mockExecute }));
const mockIn = jest.fn(() => ({ execute: mockExecute, is: mockIs }));
const mockEq = jest.fn(() => ({
  execute: mockExecute,
  single: mockSingle,
  order: mockOrder,
}));
const mockNeq = jest.fn(() => ({
  execute: mockExecute,
  order: mockOrder,
}));
const mockLt = jest.fn(() => ({
  execute: mockExecute,
  neq: mockNeq,
  order: mockOrder,
}));
const mockNot = jest.fn(() => ({
  execute: mockExecute,
  eq: mockEq,
  order: mockOrder,
}));
const mockSelect = jest.fn(() => ({
  execute: mockExecute,
  eq: mockEq,
  not: mockNot,
  in: mockIn,
  is: mockIs,
  order: mockOrder,
  lt: mockLt,
}));
const mockInsert = jest.fn(() => ({ execute: mockExecute }));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));

const mockQuery: any = jest.fn();

jest.mock('../../services/shared/clients/database', () => ({
  db: {
    from: jest.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })),
  },
  query: (...args: any[]) => mockQuery(...args),
}));

// Mock Fineract client
const mockFineractClient: Record<string, any> = {
  getLoan: jest.fn(),
  getLoanWithTransactions: jest.fn(),
  getLoanWithSchedule: jest.fn(),
  approveLoan: jest.fn(),
  disburseLoan: jest.fn(),
  postRepayment: jest.fn(),
  listLoanProducts: jest.fn(),
  getLoanProduct: jest.fn(),
  listGLAccounts: jest.fn(),
  listJournalEntries: jest.fn(),
  createClient: jest.fn(),
  createLoan: jest.fn(),
};

jest.mock('../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(() => Promise.resolve(mockFineractClient)),
  parseFineractDate: jest.fn((date: number[]) => new Date(date[0], date[1] - 1, date[2])),
  FineractApiError: class FineractApiError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
}));

// Mock reconciliation
const mockRunReconciliation: any = jest.fn();
jest.mock('../../services/shared/clients/fineract-reconcile', () => ({
  runReconciliation: mockRunReconciliation,
}));

// Mock secrets
jest.mock('../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn(() =>
    Promise.resolve({
      base_url: 'https://fineract.test:8443/fineract-provider/api/v1',
      username: 'mifos',
      password: 'password',
      tenant_id: 'default',
    })
  ),
}));

// ============================================================
// HELPERS
// ============================================================

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    path: '/api/v1/fineract/loans',
    httpMethod: 'GET',
    headers: { origin: 'https://d1qwfy2tsdmpe4.cloudfront.net' },
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    ...overrides,
  };
}

const SAMPLE_FINERACT_LOAN = {
  id: 42,
  accountNo: '000000042',
  externalId: 'loan-uuid-1',
  status: { id: 300, code: 'loanStatusType.active', value: 'Active' },
  clientId: 10,
  clientName: 'John Doe',
  clientOfficeId: 1,
  loanProductId: 2,
  loanProductName: 'Lynia Device Loan - Tier 1',
  loanProductDescription: 'Entry tier',
  principal: { amount: 200, currencyCode: 'USD' },
  approvedPrincipal: { amount: 200, currencyCode: 'USD' },
  proposedPrincipal: { amount: 200, currencyCode: 'USD' },
  numberOfRepayments: 6,
  repaymentEvery: 1,
  repaymentFrequencyType: { id: 2, code: 'repaymentFrequency.periodFrequencyType.months', value: 'Months' },
  interestRatePerPeriod: 5,
  interestRateFrequencyType: { id: 2, value: 'Per month' },
  annualInterestRate: 60,
  amortizationType: { id: 0, value: 'Equal Installments' },
  interestType: { id: 0, value: 'Declining Balance' },
  interestCalculationPeriodType: { id: 1, value: 'Same as repayment period' },
  transactionProcessingStrategyCode: 'mifos-standard-strategy',
  transactionProcessingStrategyName: 'Mifos standard',
  currency: {
    code: 'USD',
    name: 'US Dollar',
    decimalPlaces: 2,
    inMultiplesOf: 0,
    displaySymbol: '$',
    nameCode: 'currency.USD',
    displayLabel: 'US Dollar ($)',
  },
  loanType: { id: 1, code: 'accountType.individual', value: 'Individual' },
  timeline: {
    submittedOnDate: [2026, 1, 15],
    submittedByUsername: 'mifos',
    submittedByFirstname: 'App',
    submittedByLastname: 'Administrator',
    approvedOnDate: [2026, 1, 16],
    expectedDisbursementDate: [2026, 1, 20],
    actualDisbursementDate: [2026, 1, 20],
    expectedMaturityDate: [2026, 7, 20],
  },
  summary: {
    currency: { code: 'USD' },
    principalDisbursed: 200,
    principalPaid: 50,
    principalWrittenOff: 0,
    principalOutstanding: 150,
    principalOverdue: 0,
    interestCharged: 30,
    interestPaid: 10,
    interestWaived: 0,
    interestWrittenOff: 0,
    interestOutstanding: 20,
    interestOverdue: 0,
    feeChargesCharged: 0,
    feeChargesPaid: 0,
    feeChargesOutstanding: 0,
    feeChargesOverdue: 0,
    penaltyChargesCharged: 0,
    penaltyChargesPaid: 0,
    penaltyChargesOutstanding: 0,
    penaltyChargesOverdue: 0,
    totalExpectedRepayment: 230,
    totalRepayment: 60,
    totalOutstanding: 170,
    totalOverdue: 0,
    totalExpectedCostOfLoan: 30,
    totalCostOfLoan: 10,
    totalWaived: 0,
    totalWrittenOff: 0,
  },
};

const SAMPLE_LYNIA_LOAN = {
  id: 'loan-uuid-1',
  customer_id: 'cust-uuid-1',
  loan_number: 'LN-001',
  fineract_loan_id: 42,
  fineract_product_id: 2,
  outstanding_balance_usd: 170,
  total_paid_usd: 60,
  status: 'active',
  created_at: '2026-01-15T10:00:00Z',
};

const SAMPLE_CUSTOMER = {
  id: 'cust-uuid-1',
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '+263771234567',
  fineract_client_id: 10,
};

// ============================================================
// TESTS
// ============================================================

describe('Fineract Proxy Service', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { handler } = require('../../services/fineract-proxy-service/src/index');

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset DB mock for default success
    mockExecute.mockResolvedValue({ data: [], error: null });
  });

  // --------------------------------------------------------
  // ROUTING
  // --------------------------------------------------------

  describe('Routing', () => {
    it('should return 404 for unknown paths', async () => {
      const event = makeEvent({ path: '/api/v1/fineract/unknown' });
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body).error).toBe('Not Found');
    });

    it('should strip trailing slashes', async () => {
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      const event = makeEvent({ path: '/api/v1/fineract/loans/' });
      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });

    it('should include security headers in response', async () => {
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      const event = makeEvent({ path: '/api/v1/fineract/loans' });
      const result = await handler(event);
      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers['X-Frame-Options']).toBe('DENY');
    });

    it('should allow CloudFront origin in CORS', async () => {
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      const event = makeEvent({
        path: '/api/v1/fineract/loans',
        headers: { origin: 'https://d1qwfy2tsdmpe4.cloudfront.net' },
      });
      const result = await handler(event);
      expect(result.headers['Access-Control-Allow-Origin']).toBe(
        'https://d1qwfy2tsdmpe4.cloudfront.net'
      );
    });
  });

  // --------------------------------------------------------
  // GET /api/v1/fineract/loans
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/loans', () => {
    it('should return empty paginated list when no loans exist', async () => {
      // First call: loans query, second call: count query
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const event = makeEvent({ path: '/api/v1/fineract/loans' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual([]);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });

    it('should return loan data merged with Fineract balances', async () => {
      // Loans query
      mockExecute.mockResolvedValueOnce({
        data: [SAMPLE_LYNIA_LOAN],
        error: null,
      });
      // Count query
      mockExecute.mockResolvedValueOnce({
        data: [{ id: 'loan-uuid-1' }],
        error: null,
      });
      // Customer query
      mockExecute.mockResolvedValueOnce({
        data: [SAMPLE_CUSTOMER],
        error: null,
      });

      mockFineractClient.getLoan.mockResolvedValue(SAMPLE_FINERACT_LOAN);

      const event = makeEvent({
        path: '/api/v1/fineract/loans',
        queryStringParameters: { page: '1', limit: '25' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].lyniaLoanId).toBe('loan-uuid-1');
      expect(body.data[0].customerName).toBe('John Doe');
      expect(body.data[0].fineractLoanId).toBe(42);
      expect(body.data[0].totalOutstanding).toBe(170);
      expect(body.data[0].deviceBrand).toBeNull();
    });

    it('should handle pagination parameters', async () => {
      mockExecute.mockResolvedValueOnce({ data: [], error: null });
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const event = makeEvent({
        path: '/api/v1/fineract/loans',
        queryStringParameters: { page: '2', limit: '10' },
      });
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
    });

    it('should return 500 when database query fails', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const event = makeEvent({ path: '/api/v1/fineract/loans' });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  // --------------------------------------------------------
  // GET /api/v1/fineract/loans/{loanId}
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/loans/{loanId}', () => {
    it('should return loan detail with repayment schedule and transactions', async () => {
      // Loan lookup
      mockExecute.mockResolvedValueOnce({
        data: SAMPLE_LYNIA_LOAN,
        error: null,
      });
      // Customer lookup
      mockExecute.mockResolvedValueOnce({
        data: SAMPLE_CUSTOMER,
        error: null,
      });

      const fineractLoanWithTxns = {
        ...SAMPLE_FINERACT_LOAN,
        repaymentSchedule: {
          currency: { code: 'USD', name: 'US Dollar', decimalPlaces: 2, displaySymbol: '$', displayLabel: 'US Dollar ($)' },
          loanTermInDays: 180,
          totalPrincipalDisbursed: 200,
          totalPrincipalExpected: 200,
          totalPrincipalPaid: 50,
          totalInterestCharged: 30,
          totalFeeChargesCharged: 0,
          totalPenaltyChargesCharged: 0,
          totalRepaymentExpected: 230,
          totalRepayment: 60,
          totalOutstanding: 170,
          periods: [
            {
              period: 0,
              fromDate: [2026, 1, 20],
              dueDate: [2026, 1, 20],
              complete: true,
              daysInPeriod: 0,
              principalDue: 0,
              principalPaid: 0,
              principalOutstanding: 0,
              principalLoanBalanceOutstanding: 200,
              interestDue: 0,
              interestPaid: 0,
              interestOutstanding: 0,
              feeChargesDue: 0,
              feeChargesPaid: 0,
              penaltyChargesDue: 0,
              penaltyChargesPaid: 0,
              totalDueForPeriod: 200,
              totalPaidForPeriod: 200,
              totalOutstandingForPeriod: 0,
            },
            {
              period: 1,
              fromDate: [2026, 1, 20],
              dueDate: [2026, 2, 20],
              obligationsMetOnDate: [2026, 2, 18],
              complete: true,
              daysInPeriod: 31,
              principalDue: 33.33,
              principalPaid: 33.33,
              principalOutstanding: 0,
              principalLoanBalanceOutstanding: 166.67,
              interestDue: 5,
              interestPaid: 5,
              interestOutstanding: 0,
              feeChargesDue: 0,
              feeChargesPaid: 0,
              penaltyChargesDue: 0,
              penaltyChargesPaid: 0,
              totalDueForPeriod: 38.33,
              totalPaidForPeriod: 38.33,
              totalOutstandingForPeriod: 0,
            },
          ],
        },
        transactions: [
          {
            id: 101,
            officeId: 1,
            type: { id: 1, code: 'loanTransactionType.disbursement', value: 'Disbursement', disbursement: true, repayment: false },
            date: [2026, 1, 20],
            currency: { code: 'USD' },
            amount: 200,
            principalPortion: 200,
            interestPortion: 0,
            feeChargesPortion: 0,
            penaltyChargesPortion: 0,
            overpaymentPortion: 0,
            unrecognizedIncomePortion: 0,
            outstandingLoanBalance: 200,
            submittedOnDate: [2026, 1, 20],
            manuallyReversed: false,
            externalId: null,
          },
          {
            id: 102,
            officeId: 1,
            type: { id: 2, code: 'loanTransactionType.repayment', value: 'Repayment', disbursement: false, repayment: true },
            date: [2026, 2, 18],
            currency: { code: 'USD' },
            amount: 38.33,
            principalPortion: 33.33,
            interestPortion: 5,
            feeChargesPortion: 0,
            penaltyChargesPortion: 0,
            overpaymentPortion: 0,
            unrecognizedIncomePortion: 0,
            outstandingLoanBalance: 166.67,
            submittedOnDate: [2026, 2, 18],
            manuallyReversed: false,
            externalId: 'pay-uuid-1',
          },
        ],
      };

      mockFineractClient.getLoanWithTransactions.mockResolvedValue(fineractLoanWithTxns);

      const event = makeEvent({
        path: '/api/v1/fineract/loans/loan-uuid-1',
        httpMethod: 'GET',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);

      expect(body.lyniaLoanId).toBe('loan-uuid-1');
      expect(body.repaymentSchedule).toBeDefined();
      expect(body.repaymentSchedule.periods).toHaveLength(1); // period 0 (disbursement) is filtered out
      expect(body.repaymentSchedule.periods[0].period).toBe(1);
      expect(body.repaymentSchedule.periods[0].dueDate).toMatch(/^2026-02-(19|20)$/);
      expect(body.transactions).toHaveLength(2);
      expect(body.transactions[1].lyniaPaymentId).toBe('pay-uuid-1');
    });

    it('should return 404 when loan is not found', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const event = makeEvent({
        path: '/api/v1/fineract/loans/nonexistent',
        httpMethod: 'GET',
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });

    it('should return 404 when loan has no fineract_loan_id', async () => {
      mockExecute.mockResolvedValueOnce({
        data: { ...SAMPLE_LYNIA_LOAN, fineract_loan_id: null },
        error: null,
      });

      const event = makeEvent({
        path: '/api/v1/fineract/loans/loan-uuid-2',
        httpMethod: 'GET',
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });
  });

  // --------------------------------------------------------
  // LOAN ACTIONS
  // --------------------------------------------------------

  describe('POST /api/v1/fineract/loans/{id}/approve', () => {
    it('should approve a loan in Fineract', async () => {
      mockExecute.mockResolvedValueOnce({
        data: { id: 'loan-uuid-1', fineract_loan_id: 42 },
        error: null,
      });

      mockFineractClient.approveLoan.mockResolvedValue({
        officeId: 1,
        loanId: 42,
        resourceId: 42,
      });

      const event = makeEvent({
        path: '/api/v1/fineract/loans/loan-uuid-1/approve',
        httpMethod: 'POST',
        body: JSON.stringify({ approvedOnDate: '2026-02-16' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.resourceId).toBe(42);
    });

    it('should return 404 when loan not found for action', async () => {
      mockExecute.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const event = makeEvent({
        path: '/api/v1/fineract/loans/nonexistent/approve',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });

    it('should return 400 when loan has no Fineract ID', async () => {
      mockExecute.mockResolvedValueOnce({
        data: { id: 'loan-uuid-2', fineract_loan_id: null },
        error: null,
      });

      const event = makeEvent({
        path: '/api/v1/fineract/loans/loan-uuid-2/approve',
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/fineract/loans/{id}/disburse', () => {
    it('should disburse a loan in Fineract', async () => {
      mockExecute.mockResolvedValueOnce({
        data: { id: 'loan-uuid-1', fineract_loan_id: 42 },
        error: null,
      });

      mockFineractClient.disburseLoan.mockResolvedValue({
        officeId: 1,
        loanId: 42,
        resourceId: 42,
      });

      const event = makeEvent({
        path: '/api/v1/fineract/loans/loan-uuid-1/disburse',
        httpMethod: 'POST',
        body: JSON.stringify({ actualDisbursementDate: '2026-02-16' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
    });
  });

  describe('POST /api/v1/fineract/loans/{id}/repayment', () => {
    it('should record a repayment in Fineract', async () => {
      mockExecute.mockResolvedValueOnce({
        data: { id: 'loan-uuid-1', fineract_loan_id: 42 },
        error: null,
      });

      mockFineractClient.postRepayment.mockResolvedValue({
        officeId: 1,
        loanId: 42,
        resourceId: 201,
      });

      const event = makeEvent({
        path: '/api/v1/fineract/loans/loan-uuid-1/repayment',
        httpMethod: 'POST',
        body: JSON.stringify({
          transactionDate: '2026-02-16',
          transactionAmount: 38.33,
          note: 'EcoCash payment',
        }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.resourceId).toBe(201);
    });
  });

  // --------------------------------------------------------
  // LOAN PRODUCTS
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/loan-products', () => {
    it('should return mapped loan products from Fineract', async () => {
      mockFineractClient.listLoanProducts.mockResolvedValue([
        {
          id: 2,
          name: 'Lynia Device Loan - Tier 1 (Entry)',
          shortName: 'LT1E',
          description: 'Entry level device financing',
          currency: { code: 'USD', name: 'US Dollar', decimalPlaces: 2, displaySymbol: '$', displayLabel: 'US Dollar ($)' },
          principal: 125,
          minPrincipal: 50,
          maxPrincipal: 200,
          numberOfRepayments: 6,
          repaymentEvery: 1,
          repaymentFrequencyType: { id: 2, value: 'Months' },
          interestRatePerPeriod: 5,
          interestRateFrequencyType: { id: 2, value: 'Per month' },
          annualInterestRate: 60,
          amortizationType: { id: 0, value: 'Equal Installments' },
          interestType: { id: 0, value: 'Declining Balance' },
          interestCalculationPeriodType: { id: 1, value: 'Same as repayment period' },
          transactionProcessingStrategyCode: 'mifos-standard-strategy',
          transactionProcessingStrategyName: 'Mifos standard',
          accountingRule: { id: 3, value: 'Accrual (periodic)' },
          accountingMappings: {},
        },
      ]);

      const event = makeEvent({ path: '/api/v1/fineract/loan-products' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('Lynia Device Loan - Tier 1 (Entry)');
      expect(body[0].shortName).toBe('LT1E');
      expect(body[0].minPrincipal).toBe(50);
      expect(body[0].maxPrincipal).toBe(200);
    });
  });

  describe('GET /api/v1/fineract/loan-products/{id}', () => {
    it('should return a single loan product', async () => {
      mockFineractClient.getLoanProduct.mockResolvedValue({
        id: 2,
        name: 'Lynia Device Loan - Tier 1 (Entry)',
        shortName: 'LT1E',
        description: 'Entry level',
        currency: { code: 'USD', name: 'US Dollar', decimalPlaces: 2, displaySymbol: '$', displayLabel: 'US Dollar ($)' },
        principal: 125,
        minPrincipal: 50,
        maxPrincipal: 200,
        numberOfRepayments: 6,
        repaymentEvery: 1,
        repaymentFrequencyType: { id: 2, value: 'Months' },
        interestRatePerPeriod: 5,
        interestRateFrequencyType: { id: 2, value: 'Per month' },
        annualInterestRate: 60,
        amortizationType: { id: 0, value: 'Equal Installments' },
        interestType: { id: 0, value: 'Declining Balance' },
        accountingRule: { id: 3, value: 'Accrual (periodic)' },
      });

      const event = makeEvent({ path: '/api/v1/fineract/loan-products/2' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).id).toBe(2);
    });

    it('should return 404 for non-existent product', async () => {
      mockFineractClient.getLoanProduct.mockRejectedValue(new Error('Not found'));

      const event = makeEvent({ path: '/api/v1/fineract/loan-products/999' });
      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });
  });

  // --------------------------------------------------------
  // GL ACCOUNTS
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/gl-accounts', () => {
    it('should return mapped GL accounts', async () => {
      mockFineractClient.listGLAccounts.mockResolvedValue([
        {
          id: 1,
          name: 'Assets',
          glCode: '1000',
          type: { id: 1, code: 'accountType.asset', value: 'ASSET' },
          usage: { id: 1, code: 'accountUsage.header', value: 'HEADER' },
          disabled: false,
          manualEntriesAllowed: false,
          description: 'Top-level asset header',
          nameDecorated: 'Assets',
        },
        {
          id: 6,
          name: 'Cash and Bank',
          glCode: '1001',
          type: { id: 1, code: 'accountType.asset', value: 'ASSET' },
          usage: { id: 2, code: 'accountUsage.detail', value: 'DETAIL' },
          disabled: false,
          manualEntriesAllowed: true,
          description: null,
          parentId: 1,
          nameDecorated: '...Cash and Bank',
        },
      ]);

      const event = makeEvent({ path: '/api/v1/fineract/gl-accounts' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveLength(2);
      expect(body[0].glCode).toBe('1000');
      expect(body[0].type).toBe('ASSET');
      expect(body[1].parentId).toBe(1);
    });
  });

  // --------------------------------------------------------
  // JOURNAL ENTRIES
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/journal-entries', () => {
    it('should return paginated journal entries', async () => {
      mockFineractClient.listJournalEntries.mockResolvedValue({
        totalFilteredRecords: 2,
        pageItems: [
          {
            id: 1,
            officeId: 1,
            officeName: 'Head Office',
            glAccountId: 7,
            glAccountName: 'Loan Portfolio',
            glAccountCode: '1100',
            glAccountType: { id: 1, value: 'ASSET' },
            transactionDate: [2026, 1, 20],
            entryType: { id: 1, value: 'DEBIT' },
            amount: 200,
            currency: { code: 'USD', name: 'US Dollar', decimalPlaces: 2, displaySymbol: '$', displayLabel: 'US Dollar ($)' },
            transactionId: 'L42',
            manualEntry: false,
            entityType: { id: 1, value: 'LOAN' },
            entityId: 42,
            reversed: false,
            submittedOnDate: [2026, 1, 20],
          },
        ],
      });

      const event = makeEvent({
        path: '/api/v1/fineract/journal-entries',
        queryStringParameters: { page: '1', limit: '50' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].glAccountCode).toBe('1100');
      expect(body.data[0].entryType).toBe('DEBIT');
      expect(body.data[0].transactionDate).toMatch(/^2026-01-(19|20)$/);
      expect(body.pagination.total).toBe(2);
    });
  });

  // --------------------------------------------------------
  // TRIAL BALANCE
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/trial-balance', () => {
    it('should compute trial balance from GL accounts and journal entries', async () => {
      mockFineractClient.listGLAccounts.mockResolvedValue([
        { id: 1, name: 'Assets', glCode: '1000', type: { id: 1, value: 'ASSET' }, usage: { id: 1, value: 'HEADER' } },
        { id: 7, name: 'Loan Portfolio', glCode: '1100', type: { id: 1, value: 'ASSET' }, usage: { id: 2, value: 'DETAIL' } },
        { id: 6, name: 'Cash and Bank', glCode: '1001', type: { id: 1, value: 'ASSET' }, usage: { id: 2, value: 'DETAIL' } },
      ]);

      mockFineractClient.listJournalEntries.mockResolvedValue({
        totalFilteredRecords: 2,
        pageItems: [
          { glAccountId: 7, entryType: { value: 'DEBIT' }, amount: 200 },
          { glAccountId: 6, entryType: { value: 'CREDIT' }, amount: 200 },
        ],
      });

      const event = makeEvent({ path: '/api/v1/fineract/trial-balance' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);

      // Only DETAIL accounts should appear (header is filtered)
      expect(body).toHaveLength(2);

      const loanPortfolio = body.find((e: { glAccountCode: string }) => e.glAccountCode === '1100');
      expect(loanPortfolio.totalDebit).toBe(200);
      expect(loanPortfolio.totalCredit).toBe(0);
      expect(loanPortfolio.balance).toBe(200);

      const cash = body.find((e: { glAccountCode: string }) => e.glAccountCode === '1001');
      expect(cash.totalDebit).toBe(0);
      expect(cash.totalCredit).toBe(200);
      expect(cash.balance).toBe(-200);
    });
  });

  // --------------------------------------------------------
  // RECONCILIATION
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/reconciliation', () => {
    it('should return latest reconciliation results from sync log', async () => {
      // Reconciliation logs query
      mockExecute.mockResolvedValueOnce({
        data: [
          {
            entity_id: 'loan-uuid-1',
            fineract_id: 42,
            status: 'failed',
            error_message: 'Balance mismatch: Lynia=$170.00 vs Fineract=$175.00 (diff=$5.00, severity=medium)',
            created_at: '2026-02-16T10:00:00Z',
          },
          {
            entity_id: 'loan-uuid-2',
            fineract_id: 43,
            status: 'success',
            error_message: null,
            created_at: '2026-02-16T10:00:01Z',
          },
        ],
        error: null,
      });
      // Retry logs query
      mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const event = makeEvent({ path: '/api/v1/fineract/reconciliation' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.discrepancyCount).toBe(1);
      expect(body.discrepancies[0].difference).toBe(5);
      expect(body.discrepancies[0].severity).toBe('medium');
    });
  });

  describe('POST /api/v1/fineract/reconciliation/run', () => {
    it('should trigger a reconciliation run and return results', async () => {
      mockRunReconciliation.mockResolvedValue({
        totalLoansChecked: 5,
        matchedLoans: 4,
        discrepancies: [
          {
            lyniaLoanId: 'loan-uuid-3',
            fineractLoanId: 44,
            lyniaOutstanding: 100,
            fineractOutstanding: 105,
            difference: 5,
            severity: 'low',
          },
        ],
        failedChecks: 0,
        retriedSyncs: 1,
        retriedSuccesses: 1,
        durationMs: 2500,
        timestamp: '2026-02-16T12:00:00Z',
      });

      const event = makeEvent({
        path: '/api/v1/fineract/reconciliation/run',
        httpMethod: 'POST',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.totalLoansChecked).toBe(5);
      expect(body.matchedCount).toBe(4);
      expect(body.discrepancyCount).toBe(1);
      expect(body.retriedSyncs).toBe(1);
      expect(body.retrySuccessCount).toBe(1);
    });
  });

  // --------------------------------------------------------
  // OVERDUE LOANS
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/loans/overdue', () => {
    it('should filter and return only overdue loans', async () => {
      mockExecute.mockResolvedValueOnce({
        data: [SAMPLE_LYNIA_LOAN],
        error: null,
      });
      // Customer map
      mockExecute.mockResolvedValueOnce({
        data: [SAMPLE_CUSTOMER],
        error: null,
      });

      const overdueLoan = {
        ...SAMPLE_FINERACT_LOAN,
        summary: {
          ...SAMPLE_FINERACT_LOAN.summary,
          totalOverdue: 38.33,
          overdueSinceDate: [2026, 2, 1] as [number, number, number],
        },
      };

      mockFineractClient.getLoan.mockResolvedValue(overdueLoan);

      const event = makeEvent({ path: '/api/v1/fineract/loans/overdue' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].daysPastDue).toBeGreaterThan(0);
      expect(body.data[0].agingBucket).toBeDefined();
    });

    it('should exclude non-overdue loans', async () => {
      mockExecute.mockResolvedValueOnce({
        data: [SAMPLE_LYNIA_LOAN],
        error: null,
      });
      mockExecute.mockResolvedValueOnce({
        data: [SAMPLE_CUSTOMER],
        error: null,
      });

      // Loan with zero overdue
      mockFineractClient.getLoan.mockResolvedValue(SAMPLE_FINERACT_LOAN);

      const event = makeEvent({ path: '/api/v1/fineract/loans/overdue' });
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(0); // No overdue loans
    });
  });

  // --------------------------------------------------------
  // AGING SUMMARY
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/loans/aging-summary', () => {
    it('should return aging bucket summary', async () => {
      mockExecute.mockResolvedValueOnce({
        data: [
          { id: 'l1', fineract_loan_id: 42, outstanding_balance_usd: 100 },
          { id: 'l2', fineract_loan_id: 43, outstanding_balance_usd: 200 },
        ],
        error: null,
      });

      // First loan: 15 days overdue (bucket 1-30)
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      mockFineractClient.getLoan
        .mockResolvedValueOnce({
          ...SAMPLE_FINERACT_LOAN,
          summary: {
            ...SAMPLE_FINERACT_LOAN.summary,
            totalOverdue: 50,
            overdueSinceDate: [fifteenDaysAgo.getFullYear(), fifteenDaysAgo.getMonth() + 1, fifteenDaysAgo.getDate()],
          },
        })
        // Second loan: 45 days overdue (bucket 31-60)
        .mockResolvedValueOnce({
          ...SAMPLE_FINERACT_LOAN,
          summary: {
            ...SAMPLE_FINERACT_LOAN.summary,
            totalOverdue: 100,
            overdueSinceDate: (() => {
              const d = new Date();
              d.setDate(d.getDate() - 45);
              return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
            })(),
          },
        });

      const event = makeEvent({ path: '/api/v1/fineract/loans/aging-summary' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.totalOverdueLoans).toBe(2);
      expect(body.totalOverdueAmount).toBe(150);
      expect(body.bucket_1_30.count).toBe(1);
      expect(body.bucket_31_60.count).toBe(1);
    });
  });

  // --------------------------------------------------------
  // PENDING LOANS
  // --------------------------------------------------------

  describe('GET /api/v1/fineract/loans/pending', () => {
    it('should return loans with sync issues', async () => {
      // Mock raw query for sync-issue loans
      mockQuery.mockResolvedValueOnce({
        data: [{ ...SAMPLE_LYNIA_LOAN, status: 'approved', fineract_loan_id: null }],
        error: null,
      });
      // Mock customer lookup
      mockExecute.mockResolvedValueOnce({
        data: [SAMPLE_CUSTOMER],
        error: null,
      });
      // Mock count query
      mockQuery.mockResolvedValueOnce({
        data: [{ count: '1' }],
        error: null,
      });

      const event = makeEvent({ path: '/api/v1/fineract/loans/pending' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].syncStatus).toBe('not_synced');
    });
  });
});
