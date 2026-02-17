/**
 * Borrowing Base Handler
 *
 * Calculates and returns the borrowing base report used by
 * asset-backed lenders (investors) to determine how much
 * capital can be drawn against the loan portfolio.
 *
 * Computes live from dw.fact_loan for real-time data.
 *
 * Key concepts:
 * - Eligible receivables: Loans that meet investor criteria (current, KYC verified, etc.)
 * - Ineligible receivables: Loans excluded (delinquent, written-off, restructured)
 * - Advance rate: Percentage of eligible receivables available for draw
 * - Concentration limits: Maximum exposure per customer, geography, product tier
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

interface ReceivablesRow {
  total_receivables: number;
  eligible_receivables: number;
  ineligible_dpd_30_plus: number;
  ineligible_written_off: number;
  ineligible_restructured: number;
}

interface ConcentrationRow {
  largest_single_exposure: number;
  largest_single_pct: number;
  top_10_exposure: number;
  top_10_pct: number;
  largest_province: string;
  largest_province_exposure: number;
  largest_province_pct: number;
  tier_1_exposure: number;
  tier_1_pct: number;
  tier_2_exposure: number;
  tier_2_pct: number;
  tier_3_exposure: number;
  tier_3_pct: number;
}

export async function handleBorrowingBase(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.borrowing-base');

  try {
    // Live receivables computation from fact_loan
    const { data: recData, error: recError } = await query<ReceivablesRow>(
      `WITH active_loans AS (
        SELECT
          fl.loan_id,
          fl.outstanding_balance,
          fl.days_past_due,
          fl.is_restructured,
          fl.loan_status,
          fl.total_written_off
        FROM dw.fact_loan fl
        WHERE fl.loan_status IN ('active', 'disbursed')
      )
      SELECT
        COALESCE(SUM(outstanding_balance), 0) AS total_receivables,
        COALESCE(SUM(outstanding_balance) FILTER (
          WHERE days_past_due < 30 AND NOT is_restructured
        ), 0) AS eligible_receivables,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE days_past_due >= 30), 0) AS ineligible_dpd_30_plus,
        COALESCE(SUM(total_written_off) FILTER (WHERE loan_status = 'written_off'), 0) AS ineligible_written_off,
        COALESCE(SUM(outstanding_balance) FILTER (WHERE is_restructured), 0) AS ineligible_restructured
      FROM active_loans`,
      []
    );

    if (recError) {
      op.fail(recError);
      return errorResponse('Failed to fetch borrowing base', 500, undefined, event);
    }

    if (!recData.length) {
      return successResponse({
        message: 'No borrowing base data available.',
        data: null,
      }, 200, event);
    }

    const rec = recData[0];
    const totalReceivables = Number(rec.total_receivables) || 0;
    const eligible = Number(rec.eligible_receivables) || 0;
    const ineligible = totalReceivables - eligible;

    // Live concentration limits
    const { data: concData } = await query<ConcentrationRow>(
      `WITH active_loans AS (
        SELECT fl.loan_id, fl.outstanding_balance, fl.customer_key, fl.geo_key, fl.tier_key
        FROM dw.fact_loan fl
        WHERE fl.loan_status IN ('active', 'disbursed')
      ),
      total AS (
        SELECT COALESCE(SUM(outstanding_balance), 0) AS total_outstanding FROM active_loans
      ),
      customer_exposure AS (
        SELECT customer_key, SUM(outstanding_balance) AS exposure
        FROM active_loans GROUP BY customer_key ORDER BY exposure DESC
      ),
      top_10 AS (
        SELECT COALESCE(SUM(exposure), 0) AS top_10_exposure FROM (SELECT exposure FROM customer_exposure LIMIT 10) t
      ),
      province_exposure AS (
        SELECT dg.province, SUM(al.outstanding_balance) AS exposure
        FROM active_loans al
        LEFT JOIN dw.dim_geography dg ON al.geo_key = dg.geo_key
        GROUP BY dg.province ORDER BY exposure DESC LIMIT 1
      ),
      tier_exposure AS (
        SELECT
          COALESCE(SUM(al.outstanding_balance) FILTER (WHERE ct.tier_code = 'tier_1'), 0) AS tier_1,
          COALESCE(SUM(al.outstanding_balance) FILTER (WHERE ct.tier_code = 'tier_2'), 0) AS tier_2,
          COALESCE(SUM(al.outstanding_balance) FILTER (WHERE ct.tier_code = 'tier_3'), 0) AS tier_3
        FROM active_loans al
        LEFT JOIN dw.dim_credit_tier ct ON al.tier_key = ct.tier_key
      )
      SELECT
        COALESCE((SELECT exposure FROM customer_exposure LIMIT 1), 0) AS largest_single_exposure,
        CASE WHEN t.total_outstanding > 0
             THEN COALESCE((SELECT exposure FROM customer_exposure LIMIT 1), 0) / t.total_outstanding
             ELSE 0 END AS largest_single_pct,
        COALESCE(t10.top_10_exposure, 0) AS top_10_exposure,
        CASE WHEN t.total_outstanding > 0
             THEN COALESCE(t10.top_10_exposure, 0) / t.total_outstanding
             ELSE 0 END AS top_10_pct,
        COALESCE(pe.province, 'N/A') AS largest_province,
        COALESCE(pe.exposure, 0) AS largest_province_exposure,
        CASE WHEN t.total_outstanding > 0
             THEN COALESCE(pe.exposure, 0) / t.total_outstanding
             ELSE 0 END AS largest_province_pct,
        te.tier_1 AS tier_1_exposure,
        CASE WHEN t.total_outstanding > 0 THEN te.tier_1 / t.total_outstanding ELSE 0 END AS tier_1_pct,
        te.tier_2 AS tier_2_exposure,
        CASE WHEN t.total_outstanding > 0 THEN te.tier_2 / t.total_outstanding ELSE 0 END AS tier_2_pct,
        te.tier_3 AS tier_3_exposure,
        CASE WHEN t.total_outstanding > 0 THEN te.tier_3 / t.total_outstanding ELSE 0 END AS tier_3_pct
      FROM total t
      CROSS JOIN top_10 t10
      LEFT JOIN province_exposure pe ON TRUE
      CROSS JOIN tier_exposure te`,
      []
    );

    const conc = concData[0] || {} as ConcentrationRow;
    const advanceRate = 0.80;
    const availableBB = eligible * advanceRate;

    const result = {
      report_type: 'borrowing_base',
      report_date: new Date().toISOString().slice(0, 10),
      computed_at: new Date().toISOString(),
      data_freshness: 'real-time',
      currency: 'USD',

      receivables: {
        total: totalReceivables,
        eligible: eligible,
        ineligible: ineligible,
        eligibility_rate: totalReceivables > 0 ? eligible / totalReceivables : 0,
      },

      ineligibility_breakdown: {
        dpd_30_plus: Number(rec.ineligible_dpd_30_plus),
        written_off: Number(rec.ineligible_written_off),
        restructured: Number(rec.ineligible_restructured),
        kyc_incomplete: 0,
      },

      concentration: {
        single_borrower: {
          largest_exposure: Number(conc.largest_single_exposure),
          pct_of_portfolio: Number(conc.largest_single_pct),
        },
        top_10: {
          exposure: Number(conc.top_10_exposure),
          pct_of_portfolio: Number(conc.top_10_pct),
        },
        geography: {
          largest_province: conc.largest_province,
          exposure: Number(conc.largest_province_exposure),
          pct_of_portfolio: Number(conc.largest_province_pct),
        },
        product_tier: {
          tier_1: { amount: Number(conc.tier_1_exposure), pct: Number(conc.tier_1_pct) },
          tier_2: { amount: Number(conc.tier_2_exposure), pct: Number(conc.tier_2_pct) },
          tier_3: { amount: Number(conc.tier_3_exposure), pct: Number(conc.tier_3_pct) },
        },
      },

      borrowing_base: {
        advance_rate: advanceRate,
        available: availableBB,
      },
    };

    op.succeed();
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to generate borrowing base', 500, undefined, event);
  }
}
