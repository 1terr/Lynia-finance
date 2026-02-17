/**
 * Vintage Analysis Handler
 *
 * Returns cohort-by-cohort performance data for investor analysis.
 * Each vintage (origination month) shows how loans perform over time
 * (months on book), enabling investors to assess credit quality trends.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

interface VintageRow {
  origination_period: string;
  months_on_book: number;
  cohort_loan_count: number;
  cohort_principal_amount: number;
  cumulative_default_rate: number;
  cumulative_loss_rate: number;
  collection_rate: number;
  current_count: number;
  dpd_1_30_count: number;
  dpd_31_60_count: number;
  dpd_61_90_count: number;
  dpd_90_plus_count: number;
  paid_off_count: number;
  paid_off_rate: number;
  avg_credit_score_at_origination: number;
}

export async function handleVintageAnalysis(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.vintage-analysis');

  try {
    const fromPeriod = event.queryStringParameters?.from || '2024-01';
    const toPeriod = event.queryStringParameters?.to || '9999-12';
    const maxMob = parseInt(event.queryStringParameters?.max_mob || '12');

    // Get latest snapshot for each vintage x months_on_book combination
    const { data: vintageData, error } = await query<VintageRow>(
      `SELECT DISTINCT ON (origination_period, months_on_book)
              origination_period, months_on_book,
              cohort_loan_count, cohort_principal_amount,
              cumulative_default_rate, cumulative_loss_rate,
              collection_rate,
              current_count, dpd_1_30_count, dpd_31_60_count,
              dpd_61_90_count, dpd_90_plus_count,
              paid_off_count, paid_off_rate,
              avg_credit_score_at_origination
       FROM dw.fact_vintage_cohort
       WHERE origination_period >= $1
         AND origination_period <= $2
         AND months_on_book <= $3
       ORDER BY origination_period, months_on_book, snapshot_date DESC`,
      [fromPeriod, toPeriod, maxMob]
    );

    if (error) {
      op.fail(error);
      return errorResponse('Failed to fetch vintage data', 500, undefined, event);
    }

    // Group by origination period for structured output
    const vintages: Record<string, {
      cohort_size: number;
      cohort_principal: number;
      avg_credit_score: number;
      performance: Array<{
        months_on_book: number;
        default_rate: number;
        loss_rate: number;
        collection_rate: number;
        dpd_distribution: Record<string, number>;
        paid_off_rate: number;
      }>;
    }> = {};

    for (const row of vintageData) {
      if (!vintages[row.origination_period]) {
        vintages[row.origination_period] = {
          cohort_size: row.cohort_loan_count,
          cohort_principal: Number(row.cohort_principal_amount),
          avg_credit_score: Number(row.avg_credit_score_at_origination),
          performance: [],
        };
      }

      vintages[row.origination_period].performance.push({
        months_on_book: row.months_on_book,
        default_rate: Number(row.cumulative_default_rate),
        loss_rate: Number(row.cumulative_loss_rate),
        collection_rate: Number(row.collection_rate),
        dpd_distribution: {
          current: row.current_count,
          '1-30': row.dpd_1_30_count,
          '31-60': row.dpd_31_60_count,
          '61-90': row.dpd_61_90_count,
          '90+': row.dpd_90_plus_count,
        },
        paid_off_rate: Number(row.paid_off_rate),
      });
    }

    const result = {
      report_type: 'vintage_analysis',
      generated_at: new Date().toISOString(),
      parameters: { from: fromPeriod, to: toPeriod, max_months_on_book: maxMob },
      vintages,
      summary: {
        total_vintages: Object.keys(vintages).length,
        total_loans: Object.values(vintages).reduce((sum, v) => sum + v.cohort_size, 0),
        total_principal: Object.values(vintages).reduce((sum, v) => sum + v.cohort_principal, 0),
      },
    };

    op.succeed({ vintageCount: Object.keys(vintages).length });
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to generate vintage analysis', 500, undefined, event);
  }
}
