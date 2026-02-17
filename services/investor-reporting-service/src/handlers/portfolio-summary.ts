/**
 * Portfolio Summary Handler
 *
 * Returns investor-grade portfolio metrics including:
 * - Total outstanding, disbursed, collected
 * - PAR 7/30/60/90 buckets (amount and percentage)
 * - NPL ratio, write-off rate, collection rate
 * - Tier distribution, average metrics
 * - Trend data (last 30 days from historical snapshots)
 *
 * Computes live from dw.fact_loan + dw.fact_payment for real-time data.
 * Historical trend still uses dw.fact_daily_portfolio (populated by nightly ETL).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

interface LivePortfolioMetrics {
  total_active_loans: number;
  total_customers: number;
  total_outstanding: number;
  avg_loan_size: number;
  avg_days_past_due: number;
  weighted_avg_interest_rate: number;
  par_7_amount: number;
  par_30_amount: number;
  par_60_amount: number;
  par_90_amount: number;
  par_7_pct: number;
  par_30_pct: number;
  par_60_pct: number;
  par_90_pct: number;
  npl_count: number;
  npl_amount: number;
  npl_ratio: number;
  tier_1_count: number;
  tier_2_count: number;
  tier_3_count: number;
  today_disbursements_count: number;
  today_disbursements_amount: number;
  today_collections_count: number;
  today_collections_amount: number;
  today_write_offs_amount: number;
  today_applications: number;
  today_approvals: number;
  today_rejections: number;
}

interface TrendRow {
  snapshot_date: string;
  total_outstanding: number;
  total_active_loans: number;
  par_30_pct: number;
  par_90_pct: number;
  npl_ratio: number;
  collections_amount: number;
  new_disbursements_amount: number;
  write_offs_amount: number;
}

export async function handlePortfolioSummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.portfolio-summary');

  try {
    const includeTrend = event.queryStringParameters?.trend !== 'false';

    // Live aggregation from fact_loan + fact_payment
    const { data: metrics, error: metricsError } = await query<LivePortfolioMetrics>(
      `SELECT
        -- Portfolio size
        COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) AS total_active_loans,
        COUNT(DISTINCT fl.customer_key) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) AS total_customers,

        -- Outstanding
        COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS total_outstanding,
        COALESCE(AVG(fl.original_principal) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS avg_loan_size,
        COALESCE(AVG(fl.days_past_due) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')), 0) AS avg_days_past_due,

        -- Weighted avg interest rate
        CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
             THEN SUM(fl.interest_rate_annual * fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
                  / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
             ELSE 0 END AS weighted_avg_interest_rate,

        -- PAR amounts
        COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 7 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_7_amount,
        COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 30 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_30_amount,
        COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 60 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_60_amount,
        COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 90 AND fl.loan_status IN ('active', 'disbursed')), 0) AS par_90_amount,

        -- PAR percentages
        CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
             THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 7 AND fl.loan_status IN ('active', 'disbursed')), 0)
                  / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
             ELSE 0 END AS par_7_pct,
        CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
             THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 30 AND fl.loan_status IN ('active', 'disbursed')), 0)
                  / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
             ELSE 0 END AS par_30_pct,
        CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
             THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 60 AND fl.loan_status IN ('active', 'disbursed')), 0)
                  / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
             ELSE 0 END AS par_60_pct,
        CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
             THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE fl.days_past_due >= 90 AND fl.loan_status IN ('active', 'disbursed')), 0)
                  / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
             ELSE 0 END AS par_90_pct,

        -- NPL
        COUNT(*) FILTER (WHERE (fl.days_past_due >= 90 OR fl.loan_status = 'defaulted') AND fl.loan_status NOT IN ('paid_off', 'written_off', 'rejected', 'cancelled')) AS npl_count,
        COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE (fl.days_past_due >= 90 OR fl.loan_status = 'defaulted') AND fl.loan_status NOT IN ('paid_off', 'written_off', 'rejected', 'cancelled')), 0) AS npl_amount,
        CASE WHEN SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed')) > 0
             THEN COALESCE(SUM(fl.outstanding_balance) FILTER (WHERE (fl.days_past_due >= 90 OR fl.loan_status = 'defaulted') AND fl.loan_status NOT IN ('paid_off', 'written_off', 'rejected', 'cancelled')), 0)
                  / SUM(fl.outstanding_balance) FILTER (WHERE fl.loan_status IN ('active', 'disbursed'))
             ELSE 0 END AS npl_ratio,

        -- Tier distribution
        COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed') AND ct.tier_code = 'tier_1') AS tier_1_count,
        COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed') AND ct.tier_code = 'tier_2') AS tier_2_count,
        COUNT(*) FILTER (WHERE fl.loan_status IN ('active', 'disbursed') AND ct.tier_code = 'tier_3') AS tier_3_count,

        -- Today's activity
        COUNT(*) FILTER (WHERE fl.disbursement_date = CURRENT_DATE) AS today_disbursements_count,
        COALESCE(SUM(fl.disbursed_amount) FILTER (WHERE fl.disbursement_date = CURRENT_DATE), 0) AS today_disbursements_amount,
        COALESCE((SELECT COUNT(*) FROM dw.fact_payment fp WHERE fp.payment_date = CURRENT_DATE AND fp.payment_status = 'confirmed'), 0) AS today_collections_count,
        COALESCE((SELECT SUM(fp.amount) FROM dw.fact_payment fp WHERE fp.payment_date = CURRENT_DATE AND fp.payment_status = 'confirmed'), 0) AS today_collections_amount,
        COALESCE(SUM(fl.total_written_off) FILTER (WHERE fl.write_off_date = CURRENT_DATE), 0) AS today_write_offs_amount,
        COUNT(*) FILTER (WHERE fl.application_date = CURRENT_DATE) AS today_applications,
        COUNT(*) FILTER (WHERE fl.approval_date = CURRENT_DATE AND fl.approval_status = 'auto_approved') AS today_approvals,
        COUNT(*) FILTER (WHERE fl.application_date = CURRENT_DATE AND fl.loan_status = 'rejected') AS today_rejections

      FROM dw.fact_loan fl
      LEFT JOIN dw.dim_credit_tier ct ON fl.tier_key = ct.tier_key
      WHERE fl.loan_status NOT IN ('rejected', 'cancelled')`,
      []
    );

    if (metricsError) {
      op.fail(metricsError);
      return errorResponse('Failed to fetch portfolio data', 500, undefined, event);
    }

    if (!metrics.length) {
      return successResponse({
        message: 'No portfolio data available. Data will appear as loans are synced.',
        snapshot: null,
        trend: [],
      }, 200, event);
    }

    const m = metrics[0];
    const totalOutstanding = Number(m.total_outstanding) || 0;
    const totalActive = Number(m.total_active_loans) || 0;
    const approvalRate = Number(m.today_applications) > 0
      ? Number(m.today_approvals) / Number(m.today_applications)
      : 0;

    const result: Record<string, unknown> = {
      report_date: new Date().toISOString().slice(0, 10),
      computed_at: new Date().toISOString(),
      data_freshness: 'real-time',
      currency: 'USD',

      portfolio_size: {
        total_outstanding: totalOutstanding,
        total_outstanding_principal: totalOutstanding,
        active_loans: totalActive,
        active_customers: Number(m.total_customers),
        avg_loan_size: Number(m.avg_loan_size),
        weighted_avg_interest_rate: Number(m.weighted_avg_interest_rate),
        avg_days_past_due: Number(m.avg_days_past_due),
      },

      portfolio_at_risk: {
        par_7: { amount: Number(m.par_7_amount), pct: Number(m.par_7_pct) },
        par_30: { amount: Number(m.par_30_amount), pct: Number(m.par_30_pct) },
        par_60: { amount: Number(m.par_60_amount), pct: Number(m.par_60_pct) },
        par_90: { amount: Number(m.par_90_amount), pct: Number(m.par_90_pct) },
      },

      non_performing: {
        npl_count: Number(m.npl_count),
        npl_amount: Number(m.npl_amount),
        npl_ratio: Number(m.npl_ratio),
      },

      activity_today: {
        disbursements: {
          count: Number(m.today_disbursements_count),
          amount: Number(m.today_disbursements_amount),
        },
        collections: {
          count: Number(m.today_collections_count),
          amount: Number(m.today_collections_amount),
        },
        write_offs: Number(m.today_write_offs_amount),
      },

      tier_distribution: {
        tier_1: { count: Number(m.tier_1_count), pct: totalActive > 0 ? Number(m.tier_1_count) / totalActive : 0 },
        tier_2: { count: Number(m.tier_2_count), pct: totalActive > 0 ? Number(m.tier_2_count) / totalActive : 0 },
        tier_3: { count: Number(m.tier_3_count), pct: totalActive > 0 ? Number(m.tier_3_count) / totalActive : 0 },
      },

      origination: {
        applications_submitted: Number(m.today_applications),
        applications_approved: Number(m.today_approvals),
        applications_rejected: Number(m.today_rejections),
        approval_rate: approvalRate,
      },
    };

    // Historical trend from nightly snapshots (still populated by ETL)
    if (includeTrend) {
      const { data: trendData } = await query<TrendRow>(
        `SELECT snapshot_date, total_outstanding, total_active_loans,
                par_30_pct, par_90_pct, npl_ratio,
                collections_amount, new_disbursements_amount, write_offs_amount
         FROM dw.fact_daily_portfolio
         WHERE snapshot_date >= (CURRENT_DATE - INTERVAL '30 days')
         ORDER BY snapshot_date ASC`,
        []
      );

      result.trend_30d = trendData.map(d => ({
        date: d.snapshot_date,
        outstanding: Number(d.total_outstanding),
        active_loans: d.total_active_loans,
        par_30: Number(d.par_30_pct),
        par_90: Number(d.par_90_pct),
        npl_ratio: Number(d.npl_ratio),
        collections: Number(d.collections_amount),
        disbursements: Number(d.new_disbursements_amount),
        write_offs: Number(d.write_offs_amount),
      }));
    }

    op.succeed({ loansCount: totalActive });
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to generate portfolio summary', 500, undefined, event);
  }
}
