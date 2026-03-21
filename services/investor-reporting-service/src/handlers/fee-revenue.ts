/**
 * Fee Revenue Handler
 *
 * Returns fee income (insurance fees + penalty fees) broken down by
 * product and by month. Supports optional date-range and product
 * filtering. Also exposes a DW-refresh utility that populates
 * dw.rpt_fee_revenue_by_product from the transactional tables.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

interface FeeRevenueByProductRow {
  product_id: string;
  product_name: string;
  product_category: string;
  insurance_fee_income: number;
  penalty_fee_income: number;
  total_fee_income: number;
  loan_count: number;
}

interface FeeRevenueByMonthRow {
  report_month: string;
  insurance_fee_income: number;
  penalty_fee_income: number;
  total_fee_income: number;
  loan_count: number;
}

/**
 * Refresh the DW fee-revenue table from transactional data.
 * Merges results with ON CONFLICT so it is idempotent.
 */
export async function refreshFeeRevenueReport(): Promise<void> {
  await query(
    `INSERT INTO dw.rpt_fee_revenue_by_product
       (report_month, product_id, product_name, product_category,
        insurance_fee_income, penalty_fee_income, total_fee_income, loan_count)
     SELECT
       DATE_TRUNC('month', p.payment_date)::DATE AS report_month,
       lp.id AS product_id,
       lp.product_name,
       COALESCE(lp.product_category, lp.product_type) AS product_category,
       COALESCE(SUM(CASE WHEN p.payment_type = 'insurance_fee' THEN p.amount_usd END), 0) AS insurance_fee_income,
       COALESCE(SUM(CASE WHEN p.payment_type = 'late_fee' THEN p.amount_usd END), 0) AS penalty_fee_income,
       COALESCE(SUM(CASE WHEN p.payment_type IN ('insurance_fee', 'late_fee') THEN p.amount_usd END), 0) AS total_fee_income,
       COUNT(DISTINCT l.id) AS loan_count
     FROM payments p
     JOIN loans l ON l.id = p.loan_id
     JOIN loan_products lp ON lp.id = l.product_id
     WHERE p.status = 'confirmed'
       AND p.payment_type IN ('insurance_fee', 'late_fee')
     GROUP BY DATE_TRUNC('month', p.payment_date)::DATE, lp.id, lp.product_name, lp.product_category, lp.product_type
     ON CONFLICT (report_month, product_id) DO UPDATE SET
       product_name       = EXCLUDED.product_name,
       product_category   = EXCLUDED.product_category,
       insurance_fee_income = EXCLUDED.insurance_fee_income,
       penalty_fee_income = EXCLUDED.penalty_fee_income,
       total_fee_income   = EXCLUDED.total_fee_income,
       loan_count         = EXCLUDED.loan_count,
       created_at         = NOW()`,
    []
  );
}

export async function handleFeeRevenue(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.fee-revenue');

  try {
    const startDate = event.queryStringParameters?.start_date || '2024-01-01';
    const endDate = event.queryStringParameters?.end_date || '9999-12-31';
    const productId = event.queryStringParameters?.product_id;

    // Try to refresh the DW table first (best-effort; if it fails we still
    // query whatever data exists).
    try {
      await refreshFeeRevenueReport();
    } catch (refreshErr) {
      logger.warn('Fee revenue DW refresh failed; using stale data', {
        action: 'investor.fee-revenue.refresh',
        status: 'failed',
        errorMessage: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
      });
    }

    // --- Summary totals ---
    const summaryParams: unknown[] = [startDate, endDate];
    let summaryWhere = 'report_month >= $1::DATE AND report_month <= $2::DATE';
    if (productId) {
      summaryParams.push(productId);
      summaryWhere += ` AND product_id = $${summaryParams.length}`;
    }

    const { data: summaryRows, error: summaryErr } = await query<{
      total_insurance: number;
      total_penalty: number;
      total_fee: number;
      total_loans: number;
    }>(
      `SELECT
         COALESCE(SUM(insurance_fee_income), 0) AS total_insurance,
         COALESCE(SUM(penalty_fee_income), 0) AS total_penalty,
         COALESCE(SUM(total_fee_income), 0) AS total_fee,
         COALESCE(SUM(loan_count), 0) AS total_loans
       FROM dw.rpt_fee_revenue_by_product
       WHERE ${summaryWhere}`,
      summaryParams
    );

    if (summaryErr) {
      op.fail(summaryErr);
      return errorResponse('Failed to fetch fee revenue summary', 500, undefined, event);
    }

    // --- By product breakdown ---
    const prodParams: unknown[] = [startDate, endDate];
    let prodWhere = 'report_month >= $1::DATE AND report_month <= $2::DATE';
    if (productId) {
      prodParams.push(productId);
      prodWhere += ` AND product_id = $${prodParams.length}`;
    }

    const { data: byProduct, error: prodErr } = await query<FeeRevenueByProductRow>(
      `SELECT
         product_id,
         product_name,
         product_category,
         SUM(insurance_fee_income)::NUMERIC(12,2) AS insurance_fee_income,
         SUM(penalty_fee_income)::NUMERIC(12,2) AS penalty_fee_income,
         SUM(total_fee_income)::NUMERIC(12,2) AS total_fee_income,
         SUM(loan_count) AS loan_count
       FROM dw.rpt_fee_revenue_by_product
       WHERE ${prodWhere}
       GROUP BY product_id, product_name, product_category
       ORDER BY total_fee_income DESC`,
      prodParams
    );

    if (prodErr) {
      op.fail(prodErr);
      return errorResponse('Failed to fetch fee revenue by product', 500, undefined, event);
    }

    // --- By month trend ---
    const monthParams: unknown[] = [startDate, endDate];
    let monthWhere = 'report_month >= $1::DATE AND report_month <= $2::DATE';
    if (productId) {
      monthParams.push(productId);
      monthWhere += ` AND product_id = $${monthParams.length}`;
    }

    const { data: byMonth, error: monthErr } = await query<FeeRevenueByMonthRow>(
      `SELECT
         TO_CHAR(report_month, 'YYYY-MM') AS report_month,
         SUM(insurance_fee_income)::NUMERIC(12,2) AS insurance_fee_income,
         SUM(penalty_fee_income)::NUMERIC(12,2) AS penalty_fee_income,
         SUM(total_fee_income)::NUMERIC(12,2) AS total_fee_income,
         SUM(loan_count) AS loan_count
       FROM dw.rpt_fee_revenue_by_product
       WHERE ${monthWhere}
       GROUP BY report_month
       ORDER BY report_month ASC`,
      monthParams
    );

    if (monthErr) {
      op.fail(monthErr);
      return errorResponse('Failed to fetch fee revenue by month', 500, undefined, event);
    }

    const summary = summaryRows[0] || {
      total_insurance: 0,
      total_penalty: 0,
      total_fee: 0,
      total_loans: 0,
    };

    const result = {
      report_type: 'fee_revenue_by_product',
      generated_at: new Date().toISOString(),
      currency: 'USD',
      period: { start_date: startDate, end_date: endDate },
      ...(productId ? { product_id: productId } : {}),

      summary: {
        insurance_fee_income: Number(summary.total_insurance),
        penalty_fee_income: Number(summary.total_penalty),
        total_fee_income: Number(summary.total_fee),
        loan_count: Number(summary.total_loans),
      },

      by_product: byProduct.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        product_category: r.product_category,
        insurance_fee_income: Number(r.insurance_fee_income),
        penalty_fee_income: Number(r.penalty_fee_income),
        total_fee_income: Number(r.total_fee_income),
        loan_count: Number(r.loan_count),
      })),

      by_month: byMonth.map((r) => ({
        month: r.report_month,
        insurance_fee_income: Number(r.insurance_fee_income),
        penalty_fee_income: Number(r.penalty_fee_income),
        total_fee_income: Number(r.total_fee_income),
        loan_count: Number(r.loan_count),
      })),
    };

    op.succeed({ products: byProduct.length, months: byMonth.length });
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to generate fee revenue report', 500, undefined, event);
  }
}
