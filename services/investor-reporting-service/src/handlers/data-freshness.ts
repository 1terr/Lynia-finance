/**
 * GET /api/v1/investor/data-freshness
 *
 * Returns the latest snapshot date from the data warehouse fact table.
 * Used by the Analytics page to display a "Data as of" indicator.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryOne } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

export const handleDataFreshness = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const result = await queryOne<{ latest_snapshot: string | null }>(
      `SELECT MAX(snapshot_date)::text as latest_snapshot FROM dw.fact_daily_portfolio`
    );

    const latestSnapshot = result.data?.latest_snapshot || null;

    return successResponse(
      { latest_snapshot_date: latestSnapshot },
      200,
      event
    );
  } catch (err) {
    logger.error('handleDataFreshness failed', {
      action: 'investor.dataFreshness',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to fetch data freshness', 500, undefined, event);
  }
};
