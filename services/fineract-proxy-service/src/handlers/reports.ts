/**
 * Report Handlers
 *
 * GET endpoints for listing and running Fineract reports.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient } from '../../../shared/clients/fineract';
import logger from '../../../shared/utils/logger';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import { ok, err } from './helpers';

// ============================================================
// GET /api/v1/fineract/reports
// ============================================================

export async function handleGetReports(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();
  try {
    const reports = await fineract.listReports();
    const mapped = reports.map((r) => ({
      id: r.id,
      reportName: r.reportName,
      reportType: r.reportType,
      reportSubType: r.reportSubType || '',
      reportCategory: r.reportCategory || '',
      description: r.description || '',
    }));
    return ok(mapped, event);
  } catch (e) {
    logger.error('Failed to list reports', {
      action: 'fineract.getReports',
      meta: { error: e instanceof Error ? e.message : 'Unknown' },
    });
    return err(500, 'Failed to fetch reports from Fineract', event);
  }
}

// ============================================================
// GET /api/v1/fineract/reports/:name
// ============================================================

export async function handleRunReport(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const reportName = params.name;
  const fineract = await getFineractClient();
  const qs = event.queryStringParameters || {};

  try {
    const result = await fineract.runReport(reportName, qs as Record<string, string>);
    return ok(result, event);
  } catch (e) {
    logger.error('Failed to run report', {
      action: 'fineract.runReport',
      meta: { reportName, error: e instanceof Error ? e.message : 'Unknown' },
    });
    return err(500, `Failed to run report: ${e instanceof Error ? e.message : 'unknown error'}`, event);
  }
}
