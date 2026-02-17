/**
 * Covenant Compliance Handler
 *
 * Tests portfolio against investor covenant requirements
 * and returns pass/fail status for each covenant.
 *
 * Standard covenants for asset-backed digital lending:
 * - PAR 30 must not exceed threshold (e.g., 15%)
 * - PAR 90 / NPL ratio must not exceed threshold (e.g., 5%)
 * - Minimum collection rate (e.g., 85%)
 * - Single borrower concentration limit (e.g., 5%)
 * - Geographic concentration limit (e.g., 40%)
 * - Minimum eligible receivables percentage
 * - Write-off rate limit
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

/**
 * Default covenant thresholds.
 * In production, these would be configured per investor facility
 * and stored in a covenants table.
 */
const DEFAULT_COVENANTS = {
  max_par_30_pct: 0.15,              // PAR 30 must be < 15%
  max_par_90_pct: 0.05,              // PAR 90 must be < 5%
  max_npl_ratio: 0.05,               // NPL ratio must be < 5%
  min_collection_rate: 0.85,          // Collection rate must be >= 85%
  max_single_borrower_pct: 0.05,      // Single borrower < 5% of portfolio
  max_top_10_borrower_pct: 0.30,      // Top 10 borrowers < 30%
  max_province_concentration_pct: 0.40, // Any province < 40%
  min_eligible_receivables_pct: 0.70,  // Eligible receivables >= 70%
  max_monthly_write_off_rate: 0.02,    // Monthly write-offs < 2% of outstanding
  min_weighted_avg_score: 600,         // Weighted avg credit score >= 600
};

interface CovenantTest {
  covenant: string;
  description: string;
  threshold: number;
  actual: number;
  unit: string;
  status: 'pass' | 'fail' | 'warning';
  headroom: number; // How far from threshold (positive = safe)
}

interface LiveCovenantMetrics {
  total_outstanding: number;
  par_30_pct: number;
  par_90_pct: number;
  npl_ratio: number;
  eligible_pct: number;
  largest_single_pct: number;
  top_10_pct: number;
  largest_province_pct: number;
  collection_rate_30d: number;
  weighted_avg_score: number;
  write_off_rate_30d: number;
}

export async function handleCovenantCompliance(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.covenant-compliance');

  try {
    // Live covenant metrics computed from fact_loan + fact_payment
    const { data: metricsData, error: metricsError } = await query<LiveCovenantMetrics>(
      `WITH active_loans AS (
        SELECT fl.loan_id, fl.outstanding_balance, fl.days_past_due,
               fl.is_restructured, fl.loan_status, fl.customer_key, fl.geo_key
        FROM dw.fact_loan fl
        WHERE fl.loan_status IN ('active', 'disbursed')
      ),
      total AS (
        SELECT COALESCE(SUM(outstanding_balance), 0) AS total_outstanding FROM active_loans
      ),
      par_metrics AS (
        SELECT
          CASE WHEN t.total_outstanding > 0
               THEN COALESCE(SUM(al.outstanding_balance) FILTER (WHERE al.days_past_due >= 30), 0) / t.total_outstanding
               ELSE 0 END AS par_30_pct,
          CASE WHEN t.total_outstanding > 0
               THEN COALESCE(SUM(al.outstanding_balance) FILTER (WHERE al.days_past_due >= 90), 0) / t.total_outstanding
               ELSE 0 END AS par_90_pct,
          CASE WHEN t.total_outstanding > 0
               THEN COALESCE(SUM(al.outstanding_balance) FILTER (
                 WHERE (al.days_past_due >= 90 OR al.loan_status = 'defaulted')
               ), 0) / t.total_outstanding
               ELSE 0 END AS npl_ratio
        FROM active_loans al
        CROSS JOIN total t
        GROUP BY t.total_outstanding
      ),
      eligible AS (
        SELECT
          CASE WHEN t.total_outstanding > 0
               THEN COALESCE(SUM(al.outstanding_balance) FILTER (
                 WHERE al.days_past_due < 30 AND NOT al.is_restructured
               ), 0) / t.total_outstanding
               ELSE 0 END AS eligible_pct
        FROM active_loans al
        CROSS JOIN total t
        GROUP BY t.total_outstanding
      ),
      customer_exposure AS (
        SELECT customer_key, SUM(outstanding_balance) AS exposure
        FROM active_loans GROUP BY customer_key ORDER BY exposure DESC
      ),
      top_10 AS (
        SELECT COALESCE(SUM(exposure), 0) AS top_10_exp FROM (SELECT exposure FROM customer_exposure LIMIT 10) t
      ),
      province_exp AS (
        SELECT COALESCE(MAX(prov_exp), 0) AS largest_province_exp FROM (
          SELECT SUM(al.outstanding_balance) AS prov_exp
          FROM active_loans al
          LEFT JOIN dw.dim_geography dg ON al.geo_key = dg.geo_key
          GROUP BY dg.province
        ) sub
      ),
      collections_30d AS (
        SELECT
          COALESCE(SUM(fp.amount) FILTER (WHERE fp.payment_status = 'confirmed'), 0) AS collected,
          COALESCE(SUM(fp.amount_due), 0) AS due
        FROM dw.fact_payment fp
        WHERE fp.payment_date >= (CURRENT_DATE - INTERVAL '30 days')
      ),
      write_offs_30d AS (
        SELECT COALESCE(SUM(fl.total_written_off), 0) AS written_off
        FROM dw.fact_loan fl
        WHERE fl.write_off_date >= (CURRENT_DATE - INTERVAL '30 days')
      ),
      avg_score AS (
        SELECT COALESCE(AVG(fl.credit_score_at_origination), 0) AS weighted_avg_score
        FROM dw.fact_loan fl
        WHERE fl.loan_status IN ('active', 'disbursed') AND fl.credit_score_at_origination > 0
      )
      SELECT
        t.total_outstanding,
        COALESCE(pm.par_30_pct, 0) AS par_30_pct,
        COALESCE(pm.par_90_pct, 0) AS par_90_pct,
        COALESCE(pm.npl_ratio, 0) AS npl_ratio,
        COALESCE(el.eligible_pct, 0) AS eligible_pct,
        CASE WHEN t.total_outstanding > 0
             THEN COALESCE((SELECT exposure FROM customer_exposure LIMIT 1), 0) / t.total_outstanding
             ELSE 0 END AS largest_single_pct,
        CASE WHEN t.total_outstanding > 0
             THEN t10.top_10_exp / t.total_outstanding
             ELSE 0 END AS top_10_pct,
        CASE WHEN t.total_outstanding > 0
             THEN pe.largest_province_exp / t.total_outstanding
             ELSE 0 END AS largest_province_pct,
        CASE WHEN c30.due > 0 THEN c30.collected / c30.due ELSE 0 END AS collection_rate_30d,
        sc.weighted_avg_score,
        CASE WHEN t.total_outstanding > 0
             THEN wo.written_off / t.total_outstanding
             ELSE 0 END AS write_off_rate_30d
      FROM total t
      LEFT JOIN par_metrics pm ON TRUE
      LEFT JOIN eligible el ON TRUE
      CROSS JOIN top_10 t10
      CROSS JOIN province_exp pe
      CROSS JOIN collections_30d c30
      CROSS JOIN write_offs_30d wo
      CROSS JOIN avg_score sc`,
      []
    );

    if (metricsError) {
      op.fail(metricsError);
      return errorResponse('Failed to fetch covenant data', 500, undefined, event);
    }

    if (!metricsData.length || Number(metricsData[0].total_outstanding) === 0) {
      return successResponse({
        message: 'No portfolio data available for covenant testing.',
        tests: [],
      }, 200, event);
    }

    const m = metricsData[0];
    const covenants = DEFAULT_COVENANTS;
    const tests: CovenantTest[] = [];

    // Test 1: PAR 30
    const par30 = Number(m.par_30_pct);
    tests.push({
      covenant: 'max_par_30',
      description: 'Portfolio at Risk (30+ days) must not exceed threshold',
      threshold: covenants.max_par_30_pct,
      actual: par30,
      unit: 'percentage',
      status: par30 <= covenants.max_par_30_pct ? 'pass' : 'fail',
      headroom: covenants.max_par_30_pct - par30,
    });

    // Test 2: PAR 90
    const par90 = Number(m.par_90_pct);
    tests.push({
      covenant: 'max_par_90',
      description: 'Non-performing loans (90+ days) must not exceed threshold',
      threshold: covenants.max_par_90_pct,
      actual: par90,
      unit: 'percentage',
      status: par90 <= covenants.max_par_90_pct ? 'pass' : 'fail',
      headroom: covenants.max_par_90_pct - par90,
    });

    // Test 3: NPL Ratio
    const nplRatio = Number(m.npl_ratio);
    tests.push({
      covenant: 'max_npl_ratio',
      description: 'NPL ratio must not exceed threshold',
      threshold: covenants.max_npl_ratio,
      actual: nplRatio,
      unit: 'percentage',
      status: nplRatio <= covenants.max_npl_ratio ? 'pass' : 'fail',
      headroom: covenants.max_npl_ratio - nplRatio,
    });

    // Test 4: Collection Rate (rolling 30-day)
    const collectionRate = Number(m.collection_rate_30d);
    tests.push({
      covenant: 'min_collection_rate',
      description: 'Rolling 30-day collection rate must meet minimum threshold',
      threshold: covenants.min_collection_rate,
      actual: collectionRate,
      unit: 'percentage',
      status: collectionRate >= covenants.min_collection_rate ? 'pass' : 'fail',
      headroom: collectionRate - covenants.min_collection_rate,
    });

    // Test 5: Single Borrower Concentration
    const singleBorrowerPct = Number(m.largest_single_pct);
    tests.push({
      covenant: 'max_single_borrower',
      description: 'Largest single borrower exposure must not exceed threshold',
      threshold: covenants.max_single_borrower_pct,
      actual: singleBorrowerPct,
      unit: 'percentage',
      status: singleBorrowerPct <= covenants.max_single_borrower_pct ? 'pass' : 'fail',
      headroom: covenants.max_single_borrower_pct - singleBorrowerPct,
    });

    // Test 6: Top 10 Concentration
    const top10Pct = Number(m.top_10_pct);
    tests.push({
      covenant: 'max_top_10_borrowers',
      description: 'Top 10 borrower concentration must not exceed threshold',
      threshold: covenants.max_top_10_borrower_pct,
      actual: top10Pct,
      unit: 'percentage',
      status: top10Pct <= covenants.max_top_10_borrower_pct ? 'pass' : 'fail',
      headroom: covenants.max_top_10_borrower_pct - top10Pct,
    });

    // Test 7: Geographic Concentration
    const provincePct = Number(m.largest_province_pct);
    tests.push({
      covenant: 'max_province_concentration',
      description: 'Largest province exposure must not exceed threshold',
      threshold: covenants.max_province_concentration_pct,
      actual: provincePct,
      unit: 'percentage',
      status: provincePct <= covenants.max_province_concentration_pct ? 'pass' : 'fail',
      headroom: covenants.max_province_concentration_pct - provincePct,
    });

    // Test 8: Eligible Receivables
    const eligiblePct = Number(m.eligible_pct);
    tests.push({
      covenant: 'min_eligible_receivables',
      description: 'Eligible receivables must meet minimum percentage',
      threshold: covenants.min_eligible_receivables_pct,
      actual: eligiblePct,
      unit: 'percentage',
      status: eligiblePct >= covenants.min_eligible_receivables_pct ? 'pass' : 'fail',
      headroom: eligiblePct - covenants.min_eligible_receivables_pct,
    });

    // Test 9: Write-off Rate (rolling 30-day)
    const writeOffRate = Number(m.write_off_rate_30d);
    tests.push({
      covenant: 'max_write_off_rate',
      description: 'Rolling 30-day write-off rate must not exceed threshold',
      threshold: covenants.max_monthly_write_off_rate,
      actual: writeOffRate,
      unit: 'percentage',
      status: writeOffRate <= covenants.max_monthly_write_off_rate ? 'pass' : 'fail',
      headroom: covenants.max_monthly_write_off_rate - writeOffRate,
    });

    // Test 10: Weighted Average Credit Score
    const avgScore = Number(m.weighted_avg_score);
    tests.push({
      covenant: 'min_avg_credit_score',
      description: 'Weighted average credit score must meet minimum threshold',
      threshold: covenants.min_weighted_avg_score,
      actual: avgScore,
      unit: 'score',
      status: avgScore >= covenants.min_weighted_avg_score ? 'pass' : 'fail',
      headroom: avgScore - covenants.min_weighted_avg_score,
    });

    // Summary
    const passCount = tests.filter(t => t.status === 'pass').length;
    const failCount = tests.filter(t => t.status === 'fail').length;

    const result = {
      report_type: 'covenant_compliance',
      report_date: new Date().toISOString().slice(0, 10),
      computed_at: new Date().toISOString(),
      data_freshness: 'real-time',
      overall_status: failCount === 0 ? 'compliant' : 'breach',
      summary: {
        total_tests: tests.length,
        passed: passCount,
        failed: failCount,
        compliance_rate: tests.length > 0 ? passCount / tests.length : 0,
      },
      tests,
    };

    op.succeed({ passCount, failCount });
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to run covenant compliance tests', 500, undefined, event);
  }
}
