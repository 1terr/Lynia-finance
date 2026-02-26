/**
 * Characterization tests for investor-reporting-service router (index.ts).
 *
 * Routes covered:
 *   GET /api/v1/investor/portfolio           -> handlePortfolioSummary
 *   GET /api/v1/investor/vintages            -> handleVintageAnalysis
 *   GET /api/v1/investor/loan-tape           -> handleLoanTape
 *   GET /api/v1/investor/borrowing-base      -> handleBorrowingBase
 *   GET /api/v1/investor/collections         -> handleCollections
 *   GET /api/v1/investor/financials          -> handleFinancials
 *   GET /api/v1/investor/covenant-compliance -> handleCovenantCompliance
 *   OPTIONS (CORS preflight)                 -> 204
 *
 * These tests capture the current router behavior BEFORE refactoring.
 */

// ─── Mocks (must be before imports) ───

const mockPortfolioSummary = jest.fn();
const mockVintageAnalysis = jest.fn();
const mockLoanTape = jest.fn();
const mockBorrowingBase = jest.fn();
const mockCollections = jest.fn();
const mockFinancials = jest.fn();
const mockCovenantCompliance = jest.fn();

jest.mock('../../../services/investor-reporting-service/src/handlers/portfolio-summary', () => ({
  handlePortfolioSummary: mockPortfolioSummary,
}));
jest.mock('../../../services/investor-reporting-service/src/handlers/vintage-analysis', () => ({
  handleVintageAnalysis: mockVintageAnalysis,
}));
jest.mock('../../../services/investor-reporting-service/src/handlers/loan-tape', () => ({
  handleLoanTape: mockLoanTape,
}));
jest.mock('../../../services/investor-reporting-service/src/handlers/borrowing-base', () => ({
  handleBorrowingBase: mockBorrowingBase,
}));
jest.mock('../../../services/investor-reporting-service/src/handlers/collections', () => ({
  handleCollections: mockCollections,
}));
jest.mock('../../../services/investor-reporting-service/src/handlers/financials', () => ({
  handleFinancials: mockFinancials,
}));
jest.mock('../../../services/investor-reporting-service/src/handlers/covenant-compliance', () => ({
  handleCovenantCompliance: mockCovenantCompliance,
}));

const mockSetRequestContext = jest.fn().mockReturnValue('req-123');
const mockClearRequestContext = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
  setRequestContext: mockSetRequestContext,
  clearRequestContext: mockClearRequestContext,
}));

const mockSuccessResponse = jest.fn().mockImplementation((_data, statusCode) => ({
  statusCode: statusCode || 200,
  body: '{}',
  headers: { 'Content-Type': 'application/json' },
}));
const mockErrorResponse = jest.fn().mockImplementation((_msg, statusCode) => ({
  statusCode: statusCode || 500,
  body: JSON.stringify({ error: _msg }),
  headers: { 'Content-Type': 'application/json' },
}));
const mockNotFoundResponse = jest.fn().mockImplementation(() => ({
  statusCode: 404,
  body: JSON.stringify({ error: 'Not Found' }),
  headers: { 'Content-Type': 'application/json' },
}));

jest.mock('../../../services/shared/utils/response', () => ({
  successResponse: mockSuccessResponse,
  errorResponse: mockErrorResponse,
  notFoundResponse: mockNotFoundResponse,
}));

// ─── Imports ───

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../services/investor-reporting-service/src/index';

// ─── Helpers ───

function createEvent(method: string, path: string): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    resource: path,
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
  };
}

/** Standard handler response for route-dispatch assertions. */
const HANDLER_RESPONSE = {
  statusCode: 200,
  body: JSON.stringify({ success: true }),
  headers: { 'Content-Type': 'application/json' },
};

// ─── Tests ───

describe('Investor Reporting Service — Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all route handlers resolve successfully
    mockPortfolioSummary.mockResolvedValue(HANDLER_RESPONSE);
    mockVintageAnalysis.mockResolvedValue(HANDLER_RESPONSE);
    mockLoanTape.mockResolvedValue(HANDLER_RESPONSE);
    mockBorrowingBase.mockResolvedValue(HANDLER_RESPONSE);
    mockCollections.mockResolvedValue(HANDLER_RESPONSE);
    mockFinancials.mockResolvedValue(HANDLER_RESPONSE);
    mockCovenantCompliance.mockResolvedValue(HANDLER_RESPONSE);
  });

  // ═══════════════════════════════════════════
  // CORS preflight
  // ═══════════════════════════════════════════

  describe('OPTIONS (CORS preflight)', () => {
    it('should return 204 via successResponse for OPTIONS requests', async () => {
      const event = createEvent('OPTIONS', '/api/v1/investor/portfolio');
      const result = await handler(event);

      expect(result.statusCode).toBe(204);
      expect(mockSuccessResponse).toHaveBeenCalledWith(null, 204, event);
    });
  });

  // ═══════════════════════════════════════════
  // Route dispatch — all 7 endpoints
  // ═══════════════════════════════════════════

  describe('Route dispatch', () => {
    it('GET /api/v1/investor/portfolio dispatches to handlePortfolioSummary', async () => {
      const event = createEvent('GET', '/api/v1/investor/portfolio');
      const result = await handler(event);

      expect(mockPortfolioSummary).toHaveBeenCalledWith(event);
      expect(mockPortfolioSummary).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });

    it('GET /api/v1/investor/vintages dispatches to handleVintageAnalysis', async () => {
      const event = createEvent('GET', '/api/v1/investor/vintages');
      const result = await handler(event);

      expect(mockVintageAnalysis).toHaveBeenCalledWith(event);
      expect(mockVintageAnalysis).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });

    it('GET /api/v1/investor/loan-tape dispatches to handleLoanTape', async () => {
      const event = createEvent('GET', '/api/v1/investor/loan-tape');
      const result = await handler(event);

      expect(mockLoanTape).toHaveBeenCalledWith(event);
      expect(mockLoanTape).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });

    it('GET /api/v1/investor/borrowing-base dispatches to handleBorrowingBase', async () => {
      const event = createEvent('GET', '/api/v1/investor/borrowing-base');
      const result = await handler(event);

      expect(mockBorrowingBase).toHaveBeenCalledWith(event);
      expect(mockBorrowingBase).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });

    it('GET /api/v1/investor/collections dispatches to handleCollections', async () => {
      const event = createEvent('GET', '/api/v1/investor/collections');
      const result = await handler(event);

      expect(mockCollections).toHaveBeenCalledWith(event);
      expect(mockCollections).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });

    it('GET /api/v1/investor/financials dispatches to handleFinancials', async () => {
      const event = createEvent('GET', '/api/v1/investor/financials');
      const result = await handler(event);

      expect(mockFinancials).toHaveBeenCalledWith(event);
      expect(mockFinancials).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });

    it('GET /api/v1/investor/covenant-compliance dispatches to handleCovenantCompliance', async () => {
      const event = createEvent('GET', '/api/v1/investor/covenant-compliance');
      const result = await handler(event);

      expect(mockCovenantCompliance).toHaveBeenCalledWith(event);
      expect(mockCovenantCompliance).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });
  });

  // ═══════════════════════════════════════════
  // Unknown / invalid routes
  // ═══════════════════════════════════════════

  describe('Unknown routes', () => {
    it('should return 404 via notFoundResponse for an unknown path', async () => {
      const event = createEvent('GET', '/api/v1/investor/nonexistent');
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(mockNotFoundResponse).toHaveBeenCalledWith('Endpoint', event);
    });

    it('should return 404 when POST is used on a GET-only route', async () => {
      const event = createEvent('POST', '/api/v1/investor/portfolio');
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      expect(mockNotFoundResponse).toHaveBeenCalledWith('Endpoint', event);
    });
  });

  // ═══════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════

  describe('Error handling', () => {
    it('should return 500 via errorResponse when a handler throws', async () => {
      mockPortfolioSummary.mockRejectedValue(new Error('Database connection failed'));

      const event = createEvent('GET', '/api/v1/investor/portfolio');
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(mockErrorResponse).toHaveBeenCalledWith(
        'Internal server error',
        500,
        { requestId: 'req-123' },
        event
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Investor reporting error',
        expect.objectContaining({
          action: 'investor.request',
          status: 'failed',
          errorMessage: 'Database connection failed',
        })
      );
    });
  });

  // ═══════════════════════════════════════════
  // Request context lifecycle
  // ═══════════════════════════════════════════

  describe('Request context lifecycle', () => {
    it('should call setRequestContext with x-request-id header and user sub', async () => {
      const event = createEvent('GET', '/api/v1/investor/portfolio');
      await handler(event);

      expect(mockSetRequestContext).toHaveBeenCalledWith('test-req-123', 'user-1');
    });

    it('should always call clearRequestContext even when handler throws', async () => {
      mockPortfolioSummary.mockRejectedValue(new Error('Unexpected failure'));

      const event = createEvent('GET', '/api/v1/investor/portfolio');
      await handler(event);

      expect(mockClearRequestContext).toHaveBeenCalledTimes(1);
    });
  });
});
