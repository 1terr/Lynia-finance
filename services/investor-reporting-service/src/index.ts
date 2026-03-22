/**
 * Investor Reporting Service
 *
 * Provides investor-grade financial metrics, portfolio analytics,
 * loan tape exports, and borrowing base calculations via REST API.
 * All data is sourced from the dw (data warehouse) schema.
 *
 * Endpoints:
 *   GET /api/v1/investor/portfolio         - Portfolio summary (PAR, NPL, outstanding)
 *   GET /api/v1/investor/vintages          - Vintage cohort analysis
 *   GET /api/v1/investor/loan-tape         - Full loan-level export (CSV/JSON)
 *   GET /api/v1/investor/borrowing-base    - Borrowing base calculation
 *   GET /api/v1/investor/collections       - Period collections detail
 *   GET /api/v1/investor/financials        - Revenue, NIM, ROA summary
 *   GET /api/v1/investor/covenant-compliance - Covenant test results
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { setRequestContext, clearRequestContext } from '../../shared/utils/logger';
import logger from '../../shared/utils/logger';
import { successResponse, errorResponse, notFoundResponse } from '../../shared/utils/response';
import { handlePortfolioSummary } from './handlers/portfolio-summary';
import { handleVintageAnalysis } from './handlers/vintage-analysis';
import { handleLoanTape } from './handlers/loan-tape';
import { handleBorrowingBase } from './handlers/borrowing-base';
import { handleCollections } from './handlers/collections';
import { handleFinancials } from './handlers/financials';
import { handleCovenantCompliance } from './handlers/covenant-compliance';
import { handleFeeRevenue } from './handlers/fee-revenue';
import { handleDataFreshness } from './handlers/data-freshness';

/**
 * Route map for investor reporting endpoints.
 */
const ROUTES: Record<string, (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>> = {
  'GET /api/v1/investor/portfolio': handlePortfolioSummary,
  'GET /api/v1/investor/vintages': handleVintageAnalysis,
  'GET /api/v1/investor/loan-tape': handleLoanTape,
  'GET /api/v1/investor/borrowing-base': handleBorrowingBase,
  'GET /api/v1/investor/collections': handleCollections,
  'GET /api/v1/investor/financials': handleFinancials,
  'GET /api/v1/investor/covenant-compliance': handleCovenantCompliance,
  'GET /api/v1/investor/fee-revenue': handleFeeRevenue,
  'GET /api/v1/investor/data-freshness': handleDataFreshness,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = setRequestContext(
    event.headers?.['x-request-id'],
    event.requestContext?.authorizer?.claims?.sub
  );

  try {
    const method = event.httpMethod;
    const path = event.resource || event.path;
    const routeKey = `${method} ${path}`;

    logger.info('Investor reporting request', {
      action: 'investor.request',
      status: 'started',
      routeKey,
      requestId,
    });

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return successResponse(null, 204, event);
    }

    const routeHandler = ROUTES[routeKey];
    if (!routeHandler) {
      return notFoundResponse('Endpoint', event);
    }

    const response = await routeHandler(event);

    logger.info('Investor reporting response', {
      action: 'investor.request',
      status: 'completed',
      routeKey,
      statusCode: response.statusCode,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('Investor reporting error', {
      action: 'investor.request',
      status: 'failed',
      errorMessage: message,
    });
    return errorResponse('Internal server error', 500, { requestId }, event);
  } finally {
    clearRequestContext();
  }
};
