/**
 * Loan Handlers
 *
 * GET endpoints for loan listing, pending, overdue, aging summary,
 * and loan detail with repayment schedule + transactions.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient, parseFineractDate } from '../../../shared/clients/fineract';
import { db } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import type {
  FineractLoan,
  FineractRepaymentPeriod,
  FineractLoanTransaction,
} from '../../../shared/types/fineract';
import type { RouteParams } from '../../../shared/utils/lambda-router';
import type { AuthContext } from '../../../shared/middleware/authorization';
import { ok, err, clampPage, fmtDate, getAgingBucket, MAX_PAGE_SIZE, LyniaLoanRow } from './helpers';
import { getCustomerMap, buildLoanView, buildLoanViewFromFineract, mapRepaymentPeriod } from './loan-view-builder';

// ============================================================
// GET /api/v1/fineract/loans
// ============================================================

/** Paginated loan list with Fineract balances */
export async function handleGetLoans(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const page = clampPage(qs.page, 1, 1000);
  const limit = clampPage(qs.limit, 25, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;
  const statusFilter = qs.status || '';
  const search = qs.search || '';

  // Query Lynia DB for loans that have been synced to Fineract
  let query = db
    .from('loans')
    .select('id, customer_id, loan_number, fineract_loan_id, fineract_product_id, outstanding_balance, total_paid_usd, status, device_brand, device_model, device_imei, created_at')
    .not('fineract_loan_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data: loans, error: loanError } = await query.execute();
  if (loanError || !loans) {
    logger.error('Loan query error', { action: 'fineract.getLoans', meta: { error: loanError?.message || 'Unknown' } });
    return err(500, 'Failed to query loans', event);
  }

  const loanRows = loans as unknown as LyniaLoanRow[];

  // Get total count for pagination
  const { data: countData } = await db
    .from('loans')
    .select('id')
    .not('fineract_loan_id', 'is', null)
    .execute();
  const totalCount = Array.isArray(countData) ? countData.length : 0;

  // Fetch customer data for all loans
  const customerIds = [...new Set(loanRows.map((l) => l.customer_id))];
  const customerMap = await getCustomerMap(customerIds);

  // Enrich with Fineract data
  const fineract = await getFineractClient();
  const items = await Promise.all(
    loanRows.map(async (loan) => {
      const customer = customerMap.get(loan.customer_id);
      return buildLoanView(loan, customer || null, fineract);
    })
  );

  // Apply search filter client-side (customer name / phone / loan number)
  const filtered = search
    ? items.filter(
        (item) => {
          const s = search.toLowerCase();
          return (
            String(item.customerName || '').toLowerCase().includes(s) ||
            String(item.customerPhone || '').toLowerCase().includes(s) ||
            String(item.fineractAccountNo || '').toLowerCase().includes(s)
          );
        }
      )
    : items;

  return ok(
    {
      data: filtered,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    },
    event
  );
}

// ============================================================
// GET /api/v1/fineract/loans/pending
// ============================================================

/** Loans pending approval */
export async function handleGetPendingLoans(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const page = clampPage(qs.page, 1, 1000);
  const limit = clampPage(qs.limit, 25, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const { data: loans, error } = await db
    .from('loans')
    .select('id, customer_id, loan_number, fineract_loan_id, fineract_product_id, outstanding_balance, total_paid_usd, status, device_brand, device_model, device_imei, created_at')
    .not('fineract_loan_id', 'is', null)
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .execute();

  if (error || !loans) {
    return err(500, 'Failed to query pending loans', event);
  }

  const loanRows = loans as unknown as LyniaLoanRow[];
  const customerIds = [...new Set(loanRows.map((l) => l.customer_id))];
  const customerMap = await getCustomerMap(customerIds);
  const fineract = await getFineractClient();

  const items = await Promise.all(
    loanRows.map(async (loan) => {
      const customer = customerMap.get(loan.customer_id);
      return buildLoanView(loan, customer || null, fineract);
    })
  );

  return ok(
    {
      data: items,
      pagination: { page, limit, total: items.length, totalPages: 1 },
    },
    event
  );
}

// ============================================================
// GET /api/v1/fineract/loans/overdue
// ============================================================

/** Overdue loans with aging bucket classification */
export async function handleGetOverdueLoans(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const page = clampPage(qs.page, 1, 1000);
  const limit = clampPage(qs.limit, 25, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  // Query loans that are active and have a Fineract ID
  const { data: loans, error } = await db
    .from('loans')
    .select('id, customer_id, loan_number, fineract_loan_id, fineract_product_id, outstanding_balance, total_paid_usd, status, device_brand, device_model, device_imei, created_at')
    .not('fineract_loan_id', 'is', null)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .execute();

  if (error || !loans) {
    return err(500, 'Failed to query overdue loans', event);
  }

  const loanRows = loans as unknown as LyniaLoanRow[];
  const customerIds = [...new Set(loanRows.map((l) => l.customer_id))];
  const customerMap = await getCustomerMap(customerIds);
  const fineract = await getFineractClient();

  const overdueItems = [];
  for (const loan of loanRows) {
    if (!loan.fineract_loan_id) continue;

    try {
      const fLoan = await fineract.getLoan(loan.fineract_loan_id);
      const overdue = fLoan.summary?.totalOverdue ?? 0;
      if (overdue <= 0) continue;

      const customer = customerMap.get(loan.customer_id);
      const view = buildLoanViewFromFineract(loan, customer || null, fLoan);

      const overdueSince = fLoan.summary?.overdueSinceDate;
      const daysPastDue = overdueSince
        ? Math.floor((Date.now() - parseFineractDate(overdueSince).getTime()) / 86400000)
        : 0;

      overdueItems.push({
        ...view,
        daysPastDue,
        agingBucket: getAgingBucket(daysPastDue),
        lastPaymentDate: null,
        lastPaymentAmount: null,
        deviceLockStatus: 'unlocked' as const,
      });
    } catch (e) {
      logger.error('Failed to check overdue for loan', {
        action: 'fineract.getOverdueLoans',
        meta: { loanId: loan.id, error: e instanceof Error ? e.message : 'Unknown' },
      });
    }
  }

  return ok(
    {
      data: overdueItems,
      pagination: { page, limit, total: overdueItems.length, totalPages: 1 },
    },
    event
  );
}

// ============================================================
// GET /api/v1/fineract/loans/aging-summary
// ============================================================

/** Aging bucket summary across all overdue loans */
export async function handleGetAgingSummary(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  // Query all active Fineract-synced loans
  const { data: loans } = await db
    .from('loans')
    .select('id, fineract_loan_id, outstanding_balance')
    .not('fineract_loan_id', 'is', null)
    .eq('status', 'active')
    .execute();

  const summary = {
    bucket_1_30: { count: 0, totalOverdue: 0 },
    bucket_31_60: { count: 0, totalOverdue: 0 },
    bucket_61_90: { count: 0, totalOverdue: 0 },
    bucket_90_plus: { count: 0, totalOverdue: 0 },
    totalOverdueLoans: 0,
    totalOverdueAmount: 0,
  };

  if (!loans) return ok(summary, event);

  const fineract = await getFineractClient();
  const loanRows = loans as unknown as Array<{ id: string; fineract_loan_id: number }>;

  for (const loan of loanRows) {
    try {
      const fLoan = await fineract.getLoan(loan.fineract_loan_id);
      const overdue = fLoan.summary?.totalOverdue ?? 0;
      if (overdue <= 0) continue;

      const overdueSince = fLoan.summary?.overdueSinceDate;
      const days = overdueSince
        ? Math.floor((Date.now() - parseFineractDate(overdueSince).getTime()) / 86400000)
        : 0;

      summary.totalOverdueLoans++;
      summary.totalOverdueAmount += overdue;

      const bucket = getAgingBucket(days);
      const key = `bucket_${bucket.replace('-', '_').replace('+', '_plus')}` as keyof typeof summary;
      const b = summary[key] as { count: number; totalOverdue: number };
      if (b) {
        b.count++;
        b.totalOverdue += overdue;
      }
    } catch {
      // Skip loans where Fineract query fails
    }
  }

  return ok(summary, event);
}

// ============================================================
// GET /api/v1/fineract/loans/:loanId
// ============================================================

/** Loan detail with repayment schedule and transactions */
export async function handleGetLoanDetail(
  event: APIGatewayProxyEvent,
  params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const lyniaLoanId = params.loanId;

  const { data: loanData, error } = await db
    .from('loans')
    .select('id, customer_id, loan_number, fineract_loan_id, fineract_product_id, outstanding_balance, total_paid_usd, status, device_brand, device_model, device_imei, created_at')
    .eq('id', lyniaLoanId)
    .single()
    .execute();

  if (error || !loanData) {
    return err(404, 'Loan not found', event);
  }

  const loan = loanData as unknown as LyniaLoanRow;
  if (!loan.fineract_loan_id) {
    return err(404, 'Loan has not been synced to Fineract', event);
  }

  const { data: custData } = await db
    .from('customers')
    .select('id, first_name, last_name, phone_number, fineract_client_id')
    .eq('id', loan.customer_id)
    .single()
    .execute();

  const customer = custData as unknown as import('./helpers').CustomerRow | null;
  const fineract = await getFineractClient();

  let fLoan: FineractLoan | null = null;
  try {
    fLoan = await fineract.getLoanWithTransactions(loan.fineract_loan_id);
  } catch (e) {
    logger.error('Failed to get Fineract loan', {
      action: 'fineract.getLoanDetail',
      meta: { fineractLoanId: loan.fineract_loan_id, error: e instanceof Error ? e.message : 'Unknown' },
    });
  }

  const view = buildLoanViewFromFineract(loan, customer, fLoan);

  // Build schedule
  let repaymentSchedule = null;
  if (fLoan?.repaymentSchedule) {
    const rs = fLoan.repaymentSchedule;
    repaymentSchedule = {
      currency: {
        code: rs.currency.code,
        name: rs.currency.name,
        decimalPlaces: rs.currency.decimalPlaces,
        displaySymbol: rs.currency.displaySymbol,
        displayLabel: rs.currency.displayLabel,
      },
      loanTermInDays: rs.loanTermInDays,
      totalPrincipalDisbursed: rs.totalPrincipalDisbursed,
      totalPrincipalExpected: rs.totalPrincipalExpected,
      totalPrincipalPaid: rs.totalPrincipalPaid,
      totalInterestCharged: rs.totalInterestCharged,
      totalFeeChargesCharged: rs.totalFeeChargesCharged,
      totalPenaltyChargesCharged: rs.totalPenaltyChargesCharged,
      totalRepaymentExpected: rs.totalRepaymentExpected,
      totalRepayment: rs.totalRepayment,
      totalOutstanding: rs.totalOutstanding,
      periods: rs.periods
        .filter((p: FineractRepaymentPeriod) => p.period > 0)
        .map((p: FineractRepaymentPeriod) => mapRepaymentPeriod(p)),
    };
  }

  // Build transactions
  const transactions = (fLoan?.transactions || []).map((t: FineractLoanTransaction) => ({
    id: t.id,
    type: t.type.code,
    typeLabel: t.type.value,
    date: fmtDate(t.date) || '',
    amount: t.amount,
    principalPortion: t.principalPortion,
    interestPortion: t.interestPortion,
    feeChargesPortion: t.feeChargesPortion,
    penaltyChargesPortion: t.penaltyChargesPortion,
    outstandingLoanBalance: t.outstandingLoanBalance,
    manuallyReversed: t.manuallyReversed,
    externalId: t.externalId || null,
    lyniaPaymentId: t.externalId || undefined,
  }));

  return ok({ ...view, repaymentSchedule, transactions }, event);
}
