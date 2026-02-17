/**
 * Collections Handler
 *
 * Returns collections performance data for a given period.
 * Includes: total collected, collection rate, aging buckets,
 * provider breakdown, device lock effectiveness, roll rates.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse, validationErrorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

interface CollectionsSummary {
  total_collected: number;
  payment_count: number;
  avg_payment_amount: number;
}

interface ProviderBreakdown {
  provider_name: string;
  total_amount: number;
  payment_count: number;
  success_rate: number;
}

interface RollRateRow {
  from_bucket: string;
  to_bucket: string;
  loan_count: number;
  outstanding_amount: number;
  roll_rate_pct: number;
}

export async function handleCollections(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.collections');

  try {
    const period = event.queryStringParameters?.period; // YYYY-MM format
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return validationErrorResponse(
        'period parameter is required in YYYY-MM format (e.g., 2026-02)',
        undefined,
        event
      );
    }

    const [year, month] = period.split('-').map(Number);
    const startDate = `${period}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10); // Last day of month

    // Total collections for the period
    const { data: collectionData, error: collErr } = await query<CollectionsSummary>(
      `SELECT
         COALESCE(SUM(amount), 0) AS total_collected,
         COUNT(*) AS payment_count,
         COALESCE(AVG(amount), 0) AS avg_payment_amount
       FROM dw.fact_payment
       WHERE payment_status = 'confirmed'
         AND payment_date >= $1
         AND payment_date <= $2`,
      [startDate, endDate]
    );

    if (collErr) {
      op.fail(collErr);
      return errorResponse('Failed to fetch collections data', 500, undefined, event);
    }

    // Collections by payment provider
    const { data: providerData } = await query<ProviderBreakdown>(
      `SELECT
         pp.provider_name,
         COALESCE(SUM(fp.amount), 0) AS total_amount,
         COUNT(*) AS payment_count,
         CASE
           WHEN COUNT(*) > 0 THEN
             COUNT(CASE WHEN fp.payment_status = 'confirmed' THEN 1 END)::DECIMAL / COUNT(*)
           ELSE 0
         END AS success_rate
       FROM dw.fact_payment fp
       JOIN dw.dim_payment_provider pp ON fp.provider_key = pp.provider_key
       WHERE fp.payment_date >= $1
         AND fp.payment_date <= $2
       GROUP BY pp.provider_name
       ORDER BY total_amount DESC`,
      [startDate, endDate]
    );

    // Collections by payment type
    const { data: typeData } = await query<{ payment_type: string; total_amount: number; count: number }>(
      `SELECT
         payment_type,
         COALESCE(SUM(amount), 0) AS total_amount,
         COUNT(*) AS count
       FROM dw.fact_payment
       WHERE payment_status = 'confirmed'
         AND payment_date >= $1
         AND payment_date <= $2
       GROUP BY payment_type
       ORDER BY total_amount DESC`,
      [startDate, endDate]
    );

    // Roll rate analysis for the period
    const { data: rollRates } = await query<RollRateRow>(
      `SELECT from_bucket, to_bucket, loan_count, outstanding_amount, roll_rate_pct
       FROM dw.fact_roll_rate
       WHERE report_month = $1
       ORDER BY from_bucket, to_bucket`,
      [period]
    );

    // Aging bucket snapshot (end of period)
    const { data: agingData } = await query<{
      par_1_count: number; par_7_count: number; par_30_count: number;
      par_60_count: number; par_90_count: number;
      par_1_amount: number; par_7_amount: number; par_30_amount: number;
      par_60_amount: number; par_90_amount: number;
      total_active_loans: number; total_outstanding: number;
    }>(
      `SELECT par_1_count, par_7_count, par_30_count, par_60_count, par_90_count,
              par_1_amount, par_7_amount, par_30_amount, par_60_amount, par_90_amount,
              total_active_loans, total_outstanding
       FROM dw.fact_daily_portfolio
       WHERE snapshot_date <= $1
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [endDate]
    );

    const summary = collectionData[0] || { total_collected: 0, payment_count: 0, avg_payment_amount: 0 };
    const aging = agingData[0];

    const result = {
      report_type: 'collections',
      period,
      currency: 'USD',

      summary: {
        total_collected: Number(summary.total_collected),
        payment_count: Number(summary.payment_count),
        avg_payment_amount: Number(summary.avg_payment_amount),
      },

      by_provider: providerData.map(p => ({
        provider: p.provider_name,
        amount: Number(p.total_amount),
        count: Number(p.payment_count),
        success_rate: Number(p.success_rate),
      })),

      by_type: typeData.map(t => ({
        type: t.payment_type,
        amount: Number(t.total_amount),
        count: Number(t.count),
      })),

      aging_buckets: aging ? {
        current: {
          count: aging.total_active_loans - aging.par_1_count,
          amount: Number(aging.total_outstanding) - Number(aging.par_1_amount),
        },
        '1-7_days': {
          count: aging.par_1_count - aging.par_7_count,
          amount: Number(aging.par_1_amount) - Number(aging.par_7_amount),
        },
        '7-30_days': {
          count: aging.par_7_count - aging.par_30_count,
          amount: Number(aging.par_7_amount) - Number(aging.par_30_amount),
        },
        '30-60_days': {
          count: aging.par_30_count - aging.par_60_count,
          amount: Number(aging.par_30_amount) - Number(aging.par_60_amount),
        },
        '60-90_days': {
          count: aging.par_60_count - aging.par_90_count,
          amount: Number(aging.par_60_amount) - Number(aging.par_90_amount),
        },
        '90+_days': {
          count: aging.par_90_count,
          amount: Number(aging.par_90_amount),
        },
      } : null,

      roll_rates: rollRates.map(r => ({
        from: r.from_bucket,
        to: r.to_bucket,
        loans: r.loan_count,
        amount: Number(r.outstanding_amount),
        rate: Number(r.roll_rate_pct),
      })),
    };

    op.succeed({ period, totalCollected: summary.total_collected });
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to generate collections report', 500, undefined, event);
  }
}
