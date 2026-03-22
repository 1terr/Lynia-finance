/**
 * Investor Reporting Service Handlers - Unit Tests
 *
 * Tests the individual handler functions for investor reporting:
 *   handlePortfolioSummary   - Portfolio metrics (PAR, NPL, outstanding)
 *   handleBorrowingBase      - Borrowing base calculations
 *   handleCollections        - Period collections data
 *   handleCovenantCompliance - Covenant compliance tests
 *   handleDataFreshness      - Last sync timestamps
 *
 * All database queries are mocked at the shared/clients/database level.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
const mockQueryOne = jest.fn();

jest.mock('../../../shared/clients/database', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

const mockSuccessResponse = jest.fn().mockImplementation((data, statusCode, _event) => ({
  statusCode: statusCode || 200,
  body: JSON.stringify({ success: true, data }),
  headers: { 'Content-Type': 'application/json' },
}));
const mockErrorResponse = jest.fn().mockImplementation((msg, statusCode) => ({
  statusCode: statusCode || 500,
  body: JSON.stringify({ error: msg }),
  headers: { 'Content-Type': 'application/json' },
}));
const mockValidationErrorResponse = jest.fn().mockImplementation((msg) => ({
  statusCode: 400,
  body: JSON.stringify({ error: msg }),
  headers: { 'Content-Type': 'application/json' },
}));

jest.mock('../../../shared/utils/response', () => ({
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  errorResponse: (...args: unknown[]) => mockErrorResponse(...args),
  validationErrorResponse: (...args: unknown[]) => mockValidationErrorResponse(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handlePortfolioSummary } from '../handlers/portfolio-summary';
import { handleBorrowingBase } from '../handlers/borrowing-base';
import { handleCollections } from '../handlers/collections';
import { handleCovenantCompliance } from '../handlers/covenant-compliance';
import { handleDataFreshness } from '../handlers/data-freshness';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/api/v1/investor/portfolio',
    body: null,
    headers: { 'x-request-id': 'test-req-123' },
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    isBase64Encoded: false,
    requestContext: {
      authorizer: { claims: { sub: 'user-1' } },
    } as any,
    resource: '/api/v1/investor/portfolio',
    ...overrides,
  };
}

function parseBody(response: { body: string }) {
  return JSON.parse(response.body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Investor Reporting Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
    mockQueryOne.mockReset();
  });

  // =========================================================================
  // handlePortfolioSummary
  // =========================================================================

  describe('handlePortfolioSummary', () => {
    const portfolioMetrics = {
      total_active_loans: 150,
      total_customers: 120,
      total_outstanding: 75000,
      avg_loan_size: 500,
      avg_days_past_due: 5,
      weighted_avg_interest_rate: 15,
      par_7_amount: 3000,
      par_30_amount: 1500,
      par_60_amount: 500,
      par_90_amount: 200,
      par_7_pct: 0.04,
      par_30_pct: 0.02,
      par_60_pct: 0.007,
      par_90_pct: 0.003,
      npl_count: 3,
      npl_amount: 1500,
      npl_ratio: 0.02,
      tier_1_count: 80,
      tier_2_count: 50,
      tier_3_count: 20,
      today_disbursements_count: 5,
      today_disbursements_amount: 2500,
      today_collections_count: 12,
      today_collections_amount: 3600,
      today_write_offs_amount: 0,
      today_applications: 10,
      today_approvals: 8,
      today_rejections: 2,
    };

    it('should return portfolio summary with all metrics', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [portfolioMetrics], error: null })
        .mockResolvedValueOnce({ data: [], error: null }); // trend data

      const event = createEvent();
      const response = await handlePortfolioSummary(event);

      expect(response.statusCode).toBe(200);
      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolio_size: expect.objectContaining({
            total_outstanding: 75000,
            active_loans: 150,
          }),
          portfolio_at_risk: expect.objectContaining({
            par_30: expect.objectContaining({ amount: 1500 }),
          }),
          non_performing: expect.objectContaining({
            npl_ratio: 0.02,
          }),
        }),
        200,
        event
      );
    });

    it('should return empty portfolio message when no data', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: null });

      const event = createEvent();
      await handlePortfolioSummary(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No portfolio data available. Data will appear as loans are synced.',
          snapshot: null,
        }),
        200,
        event
      );
    });

    it('should return 500 when DB query fails', async () => {
      mockQuery.mockResolvedValueOnce({ data: null, error: new Error('DB timeout') });

      const event = createEvent();
      await handlePortfolioSummary(event);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        'Failed to fetch portfolio data', 500, undefined, event
      );
    });

    it('should exclude trend data when trend=false', async () => {
      mockQuery.mockResolvedValueOnce({ data: [portfolioMetrics], error: null });

      const event = createEvent({
        queryStringParameters: { trend: 'false' },
      });
      const response = await handlePortfolioSummary(event);

      // Only one query call (no trend query)
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(200);
    });

    it('should include 30-day trend data by default', async () => {
      const trendRow = {
        snapshot_date: '2026-03-20',
        total_outstanding: 74000,
        total_active_loans: 148,
        par_30_pct: 0.02,
        par_90_pct: 0.003,
        npl_ratio: 0.02,
        collections_amount: 3500,
        new_disbursements_amount: 2000,
        write_offs_amount: 0,
      };
      mockQuery
        .mockResolvedValueOnce({ data: [portfolioMetrics], error: null })
        .mockResolvedValueOnce({ data: [trendRow], error: null });

      const event = createEvent();
      await handlePortfolioSummary(event);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          trend_30d: expect.arrayContaining([
            expect.objectContaining({ date: '2026-03-20', outstanding: 74000 }),
          ]),
        }),
        200,
        event
      );
    });
  });

  // =========================================================================
  // handleBorrowingBase
  // =========================================================================

  describe('handleBorrowingBase', () => {
    const receivablesData = {
      total_receivables: 100000,
      eligible_receivables: 85000,
      ineligible_dpd_30_plus: 10000,
      ineligible_written_off: 2000,
      ineligible_restructured: 3000,
    };

    const concentrationData = {
      largest_single_exposure: 2000,
      largest_single_pct: 0.02,
      top_10_exposure: 15000,
      top_10_pct: 0.15,
      largest_province: 'Harare',
      largest_province_exposure: 30000,
      largest_province_pct: 0.30,
      tier_1_exposure: 50000,
      tier_1_pct: 0.50,
      tier_2_exposure: 30000,
      tier_2_pct: 0.30,
      tier_3_exposure: 20000,
      tier_3_pct: 0.20,
    };

    it('should return borrowing base with receivables and concentration', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [receivablesData], error: null })
        .mockResolvedValueOnce({ data: [concentrationData], error: null });

      const event = createEvent({ path: '/api/v1/investor/borrowing-base' });
      await handleBorrowingBase(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          report_type: 'borrowing_base',
          receivables: expect.objectContaining({
            total: 100000,
            eligible: 85000,
          }),
          borrowing_base: expect.objectContaining({
            advance_rate: 0.80,
            available: 68000, // 85000 * 0.80
          }),
          concentration: expect.objectContaining({
            single_borrower: expect.objectContaining({
              largest_exposure: 2000,
            }),
          }),
        }),
        200,
        event
      );
    });

    it('should return empty message when no receivables data', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: null });

      const event = createEvent({ path: '/api/v1/investor/borrowing-base' });
      await handleBorrowingBase(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No borrowing base data available.' }),
        200,
        event
      );
    });

    it('should return 500 when DB query fails', async () => {
      mockQuery.mockResolvedValueOnce({ data: null, error: new Error('Connection refused') });

      const event = createEvent({ path: '/api/v1/investor/borrowing-base' });
      await handleBorrowingBase(event);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        'Failed to fetch borrowing base', 500, undefined, event
      );
    });
  });

  // =========================================================================
  // handleCollections
  // =========================================================================

  describe('handleCollections', () => {
    it('should return 400 when period param is missing', async () => {
      const event = createEvent({ path: '/api/v1/investor/collections' });
      await handleCollections(event);

      expect(mockValidationErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining('period parameter is required'),
        undefined,
        event
      );
    });

    it('should return 400 when period format is invalid', async () => {
      const event = createEvent({
        path: '/api/v1/investor/collections',
        queryStringParameters: { period: '2026-13-01' },
      });
      await handleCollections(event);

      expect(mockValidationErrorResponse).toHaveBeenCalled();
    });

    it('should return collections data for valid period', async () => {
      const summary = { total_collected: 15000, payment_count: 45, avg_payment_amount: 333 };
      mockQuery
        .mockResolvedValueOnce({ data: [summary], error: null })  // collections summary
        .mockResolvedValueOnce({ data: [], error: null })         // provider breakdown
        .mockResolvedValueOnce({ data: [], error: null })         // type breakdown
        .mockResolvedValueOnce({ data: [], error: null })         // roll rates
        .mockResolvedValueOnce({ data: [], error: null });        // aging

      const event = createEvent({
        path: '/api/v1/investor/collections',
        queryStringParameters: { period: '2026-02' },
      });
      await handleCollections(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          report_type: 'collections',
          period: '2026-02',
          summary: expect.objectContaining({
            total_collected: 15000,
            payment_count: 45,
          }),
        }),
        200,
        event
      );
    });

    it('should return 500 when collections query fails', async () => {
      mockQuery.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      const event = createEvent({
        path: '/api/v1/investor/collections',
        queryStringParameters: { period: '2026-02' },
      });
      await handleCollections(event);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        'Failed to fetch collections data', 500, undefined, event
      );
    });
  });

  // =========================================================================
  // handleCovenantCompliance
  // =========================================================================

  describe('handleCovenantCompliance', () => {
    const complianceMetrics = {
      total_outstanding: 100000,
      par_30_pct: 0.08,
      par_90_pct: 0.02,
      npl_ratio: 0.03,
      eligible_pct: 0.85,
      largest_single_pct: 0.03,
      top_10_pct: 0.20,
      largest_province_pct: 0.35,
      collection_rate_30d: 0.92,
      weighted_avg_score: 650,
      write_off_rate_30d: 0.01,
    };

    it('should return all covenant tests as passing when metrics are healthy', async () => {
      mockQuery.mockResolvedValueOnce({ data: [complianceMetrics], error: null });

      const event = createEvent({ path: '/api/v1/investor/covenant-compliance' });
      await handleCovenantCompliance(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          report_type: 'covenant_compliance',
          overall_status: 'compliant',
          summary: expect.objectContaining({
            total_tests: 10,
            passed: 10,
            failed: 0,
          }),
          tests: expect.arrayContaining([
            expect.objectContaining({
              covenant: 'max_par_30',
              status: 'pass',
            }),
          ]),
        }),
        200,
        event
      );
    });

    it('should return breach status when a covenant fails', async () => {
      const badMetrics = {
        ...complianceMetrics,
        par_30_pct: 0.20, // Exceeds 0.15 threshold
        npl_ratio: 0.08,  // Exceeds 0.05 threshold
      };
      mockQuery.mockResolvedValueOnce({ data: [badMetrics], error: null });

      const event = createEvent({ path: '/api/v1/investor/covenant-compliance' });
      await handleCovenantCompliance(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          overall_status: 'breach',
          summary: expect.objectContaining({
            failed: expect.any(Number),
          }),
          tests: expect.arrayContaining([
            expect.objectContaining({
              covenant: 'max_par_30',
              status: 'fail',
            }),
          ]),
        }),
        200,
        event
      );
    });

    it('should return empty tests when no portfolio data', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: null });

      const event = createEvent({ path: '/api/v1/investor/covenant-compliance' });
      await handleCovenantCompliance(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No portfolio data available for covenant testing.',
          tests: [],
        }),
        200,
        event
      );
    });

    it('should return 500 when DB query fails', async () => {
      mockQuery.mockResolvedValueOnce({ data: null, error: new Error('Query timeout') });

      const event = createEvent({ path: '/api/v1/investor/covenant-compliance' });
      await handleCovenantCompliance(event);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        'Failed to fetch covenant data', 500, undefined, event
      );
    });
  });

  // =========================================================================
  // handleDataFreshness
  // =========================================================================

  describe('handleDataFreshness', () => {
    it('should return latest snapshot date', async () => {
      mockQueryOne.mockResolvedValueOnce({
        data: { latest_snapshot: '2026-03-22' },
        error: null,
      });

      const event = createEvent({ path: '/api/v1/investor/data-freshness' });
      await handleDataFreshness(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        { latest_snapshot_date: '2026-03-22' },
        200,
        event
      );
    });

    it('should return null when no snapshots exist', async () => {
      mockQueryOne.mockResolvedValueOnce({
        data: { latest_snapshot: null },
        error: null,
      });

      const event = createEvent({ path: '/api/v1/investor/data-freshness' });
      await handleDataFreshness(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        { latest_snapshot_date: null },
        200,
        event
      );
    });

    it('should return null when queryOne returns no data', async () => {
      mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

      const event = createEvent({ path: '/api/v1/investor/data-freshness' });
      await handleDataFreshness(event);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        { latest_snapshot_date: null },
        200,
        event
      );
    });

    it('should return 500 when DB throws', async () => {
      mockQueryOne.mockRejectedValueOnce(new Error('Connection failed'));

      const event = createEvent({ path: '/api/v1/investor/data-freshness' });
      await handleDataFreshness(event);

      expect(mockErrorResponse).toHaveBeenCalledWith(
        'Failed to fetch data freshness', 500, undefined, event
      );
    });
  });
});
