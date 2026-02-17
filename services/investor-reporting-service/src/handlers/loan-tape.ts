/**
 * Loan Tape Export Handler
 *
 * Generates a loan-level export file for investor due diligence.
 * Supports JSON and CSV formats. This is the industry-standard
 * format for asset-backed lending platforms like Cascade Debt.
 *
 * Each row represents one loan with all relevant fields:
 * origination data, current balances, DPD, collateral info,
 * credit scoring, and geographic data.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../../shared/clients/database';
import { successResponse, errorResponse } from '../../../shared/utils/response';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

interface LoanTapeRow {
  loan_id: string;
  loan_number: string;
  loan_status: string;
  currency: string;
  origination_date: string;
  maturity_date: string;
  original_principal: number;
  disbursed_amount: number;
  outstanding_balance: number;
  total_paid: number;
  total_interest: number;
  total_amount_due: number;
  interest_rate_annual: number;
  loan_term_months: number;
  deposit_amount: number;
  deposit_paid: boolean;
  days_past_due: number;
  missed_payments_count: number;
  next_payment_date: string;
  next_payment_amount: number;
  last_payment_date: string;
  total_penalties: number;
  total_written_off: number;
  is_restructured: boolean;
  reschedule_count: number;
  credit_score_at_origination: number;
  credit_tier: string;
  device_manufacturer: string;
  device_model: string;
  device_value_usd: number;
  ltv_ratio: number;
  lock_status: string;
  province: string;
  city: string;
  location_type: string;
  income_band: string;
  fineract_loan_id: number;
}

const LOAN_TAPE_QUERY = `
  SELECT
    fl.loan_id,
    fl.loan_number,
    fl.loan_status,
    fl.currency,
    fl.application_date AS origination_date,
    fl.maturity_date,
    fl.original_principal,
    fl.disbursed_amount,
    fl.outstanding_balance,
    fl.total_paid,
    fl.total_interest,
    fl.total_amount_due,
    fl.interest_rate_annual,
    fl.loan_term_months,
    fl.deposit_amount,
    fl.deposit_paid,
    fl.days_past_due,
    fl.missed_payments_count,
    fl.next_payment_date,
    fl.next_payment_amount,
    fl.last_payment_date,
    fl.total_penalties,
    fl.total_written_off,
    fl.is_restructured,
    fl.reschedule_count,
    fl.credit_score_at_origination,
    ct.tier_name AS credit_tier,
    dd.manufacturer AS device_manufacturer,
    dd.model AS device_model,
    fl.device_value_usd,
    fl.ltv_ratio,
    dd.lock_status,
    dc.province,
    dc.city,
    dc.location_type,
    dc.income_band,
    fl.fineract_loan_id
  FROM dw.fact_loan fl
  LEFT JOIN dw.dim_customer dc ON fl.customer_key = dc.customer_key AND dc.is_current = TRUE
  LEFT JOIN dw.dim_device dd ON fl.device_key = dd.device_key AND dd.is_current = TRUE
  LEFT JOIN dw.dim_credit_tier ct ON fl.tier_key = ct.tier_key
  WHERE fl.loan_status NOT IN ('rejected', 'cancelled')
  ORDER BY fl.application_date DESC
`;

/**
 * Convert an array of objects to CSV string.
 */
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape commas and quotes in CSV
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

export async function handleLoanTape(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const op = logger.startOperation('investor.loan-tape');

  try {
    const format = event.queryStringParameters?.format || 'json';
    const statusFilter = event.queryStringParameters?.status; // active, defaulted, all

    let queryText = LOAN_TAPE_QUERY;
    const params: unknown[] = [];

    if (statusFilter && statusFilter !== 'all') {
      queryText = queryText.replace(
        "WHERE fl.loan_status NOT IN ('rejected', 'cancelled')",
        "WHERE fl.loan_status = $1"
      );
      params.push(statusFilter);
    }

    const { data: loans, error } = await query<LoanTapeRow>(queryText, params);

    if (error) {
      op.fail(error);
      return errorResponse('Failed to fetch loan tape', 500, undefined, event);
    }

    if (format === 'csv') {
      const csv = toCSV(loans as unknown as Record<string, unknown>[]);
      const headers = getSecurityHeaders(event);
      headers['Content-Type'] = 'text/csv';
      headers['Content-Disposition'] = `attachment; filename="loan-tape-${new Date().toISOString().slice(0, 10)}.csv"`;

      op.succeed({ loanCount: loans.length, format: 'csv' });
      return {
        statusCode: 200,
        body: csv,
        headers,
      };
    }

    // JSON format
    const result = {
      report_type: 'loan_tape',
      generated_at: new Date().toISOString(),
      currency: 'USD',
      total_loans: loans.length,
      total_outstanding: loans.reduce((sum, l) => sum + Number(l.outstanding_balance || 0), 0),
      total_original_principal: loans.reduce((sum, l) => sum + Number(l.original_principal || 0), 0),
      loans,
    };

    op.succeed({ loanCount: loans.length, format: 'json' });
    return successResponse(result, 200, event);
  } catch (error) {
    op.fail(error);
    return errorResponse('Failed to generate loan tape', 500, undefined, event);
  }
}
