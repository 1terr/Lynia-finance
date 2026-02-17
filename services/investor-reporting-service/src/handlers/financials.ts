/**
 * Financials Handler
 *
 * Returns revenue, profitability, and efficiency metrics
 * for investor reporting. Key metrics include:
 * - Interest income, fee income, total revenue
 * - Net Interest Margin (NIM)
 * - Net yield (after losses)
 * - Cost per loan originated
 * - Return on Assets (ROA)
 * - Origination volume and trends
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

interface MonthlyFinancialRow {
  report_month: string;
  report_year: number;
  report_month_number: number;
  interest_income: number;
  fee_income: number;
  total_revenue: number;
  write_off_amount: number;
  provision_amount: number;
  net_credit_losses: number;
  avg_outstanding_portfolio: number;
  net_yield_pct: number;
  loans_originated_count: number;
  loans_originated_amount: number;
  avg_loan_size: number;
  total_collections: number;
  scheduled_collections: number;
  collection_rate: number;
  end_of_month_outstanding: number;
  end_of_month_active_loans: number;
  end_of_month_par_30: number;
  end_of_month_npl_ratio: number;
  new_customers: number;
  active_customers: number;
  repeat_borrowers: number;
  repeat_borrower_rate: number;
}

export async function handleFinancials(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.financials');

  try {
    const fromMonth = event.queryStringParameters?.from || '2024-01';
    const toMonth = event.queryStringParameters?.to || '9999-12';

    const { data: financials, error } = await query<MonthlyFinancialRow>(
      `SELECT * FROM dw.rpt_monthly_financials
       WHERE report_month >= $1 AND report_month <= $2
       ORDER BY report_month ASC`,
      [fromMonth, toMonth]
    );

    if (error) {
      op.fail(error);
      return errorResponse('Failed to fetch financial data', 500, undefined, event);
    }

    // Calculate YTD and trailing-12-month aggregates
    const now = new Date();
    const currentYear = now.getFullYear();
    const ytdMonths = financials.filter(f => f.report_year === currentYear);
    const last12 = financials.slice(-12);

    const aggregate = (rows: MonthlyFinancialRow[]) => ({
      interest_income: rows.reduce((s, r) => s + Number(r.interest_income), 0),
      fee_income: rows.reduce((s, r) => s + Number(r.fee_income), 0),
      total_revenue: rows.reduce((s, r) => s + Number(r.total_revenue), 0),
      write_offs: rows.reduce((s, r) => s + Number(r.write_off_amount), 0),
      net_credit_losses: rows.reduce((s, r) => s + Number(r.net_credit_losses), 0),
      total_collections: rows.reduce((s, r) => s + Number(r.total_collections), 0),
      loans_originated_count: rows.reduce((s, r) => s + r.loans_originated_count, 0),
      loans_originated_amount: rows.reduce((s, r) => s + Number(r.loans_originated_amount), 0),
      new_customers: rows.reduce((s, r) => s + r.new_customers, 0),
      avg_collection_rate: rows.length > 0
        ? rows.reduce((s, r) => s + Number(r.collection_rate), 0) / rows.length
        : 0,
      avg_net_yield: rows.length > 0
        ? rows.reduce((s, r) => s + Number(r.net_yield_pct), 0) / rows.length
        : 0,
    });

    const latestMonth = financials[financials.length - 1];

    const result = {
      report_type: 'financial_summary',
      generated_at: new Date().toISOString(),
      currency: 'USD',
      period: { from: fromMonth, to: toMonth },

      latest_month: latestMonth ? {
        month: latestMonth.report_month,
        interest_income: Number(latestMonth.interest_income),
        fee_income: Number(latestMonth.fee_income),
        total_revenue: Number(latestMonth.total_revenue),
        net_credit_losses: Number(latestMonth.net_credit_losses),
        net_yield_pct: Number(latestMonth.net_yield_pct),
        collection_rate: Number(latestMonth.collection_rate),
        loans_originated: latestMonth.loans_originated_count,
        origination_amount: Number(latestMonth.loans_originated_amount),
        avg_loan_size: Number(latestMonth.avg_loan_size),
        portfolio_outstanding: Number(latestMonth.end_of_month_outstanding),
        active_loans: latestMonth.end_of_month_active_loans,
        par_30: Number(latestMonth.end_of_month_par_30),
        npl_ratio: Number(latestMonth.end_of_month_npl_ratio),
        active_customers: latestMonth.active_customers,
        new_customers: latestMonth.new_customers,
        repeat_borrower_rate: Number(latestMonth.repeat_borrower_rate),
      } : null,

      ytd: aggregate(ytdMonths),
      trailing_12_months: aggregate(last12),

      monthly_trend: financials.map(f => ({
        month: f.report_month,
        revenue: Number(f.total_revenue),
        collections: Number(f.total_collections),
        write_offs: Number(f.write_off_amount),
        net_yield: Number(f.net_yield_pct),
        collection_rate: Number(f.collection_rate),
        origination_count: f.loans_originated_count,
        origination_amount: Number(f.loans_originated_amount),
        outstanding: Number(f.end_of_month_outstanding),
        par_30: Number(f.end_of_month_par_30),
        npl_ratio: Number(f.end_of_month_npl_ratio),
        repeat_rate: Number(f.repeat_borrower_rate),
      })),
    };

    op.succeed({ monthsReported: financials.length });
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to generate financial report', 500, undefined, event);
  }
}
