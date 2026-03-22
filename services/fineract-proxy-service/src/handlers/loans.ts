/**
 * Loan Handlers
 *
 * GET endpoints for loan listing, pending, overdue, aging summary,
 * and loan detail with repayment schedule + transactions.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient, parseFineractDate } from '../../../shared/clients/fineract';
import { db, query, queryOne } from '../../../shared/clients/database';
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

  // Build WHERE conditions
  const conditions: string[] = ['l.fineract_loan_id IS NOT NULL'];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (statusFilter) {
    conditions.push(`l.status = $${paramIdx++}`);
    values.push(statusFilter);
  }

  if (search) {
    const normalized = search.replace(/[-\s]/g, '');
    const term = `%${search}%`;
    const normalizedTerm = `%${normalized}%`;
    conditions.push(
      `(CONCAT(c.first_name, ' ', c.last_name) ILIKE $${paramIdx} OR c.phone_number ILIKE $${paramIdx} OR l.loan_number ILIKE $${paramIdx} OR CAST(l.fineract_loan_id AS TEXT) ILIKE $${paramIdx} OR REPLACE(REPLACE(c.national_id, '-', ''), ' ', '') ILIKE $${paramIdx + 1})`
    );
    paramIdx += 2;
    values.push(term, normalizedTerm);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Get total count with a proper COUNT(*) query
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM loans l LEFT JOIN customers c ON c.id = l.customer_id ${whereClause}`,
    values
  );
  const totalCount = parseInt(countResult.data?.count || '0');

  // Query loans with customer join
  const { data: loans, error: loanError } = await query<LyniaLoanRow>(
    `SELECT l.id, l.customer_id, l.loan_number, l.fineract_loan_id, l.fineract_product_id,
            l.outstanding_balance_usd, l.total_paid_usd, l.status, l.created_at
     FROM loans l
     LEFT JOIN customers c ON c.id = l.customer_id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...values, limit, offset]
  );

  if (loanError || !loans) {
    logger.error('Loan query error', { action: 'fineract.getLoans', meta: { error: loanError?.message || 'Unknown' } });
    return err(500, 'Failed to query loans', event);
  }

  const loanRows = loans;

  // Fetch customer data for all loans
  const customerIds = [...new Set(loanRows.map((l) => l.customer_id))];
  const customerMap = await getCustomerMap(customerIds);

  // Enrich with Fineract data (gracefully degrade if Fineract unavailable)
  let items: Record<string, unknown>[];
  try {
    const fineract = await getFineractClient();
    items = await Promise.all(
      loanRows.map(async (loan) => {
        const customer = customerMap.get(loan.customer_id);
        return buildLoanView(loan, customer || null, fineract);
      })
    );
  } catch (e) {
    logger.error('Fineract unavailable, returning DB-only data', {
      action: 'fineract.getLoans',
      meta: { error: e instanceof Error ? e.message : 'Unknown' },
    });
    items = loanRows.map((loan) => {
      const customer = customerMap.get(loan.customer_id);
      return buildLoanViewFromFineract(loan, customer || null, null);
    });
  }

  return ok(
    {
      data: items,
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

/** Loans with Fineract sync issues (approved in Lynia but sync failed) */
export async function handleGetPendingLoans(
  event: APIGatewayProxyEvent,
  _params: RouteParams,
  _auth: AuthContext
): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const page = clampPage(qs.page, 1, 1000);
  const limit = clampPage(qs.limit, 25, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  // Find loans with sync issues:
  // 1. Approved in Lynia but never synced to Fineract (fineract_loan_id IS NULL)
  // 2. Synced to Fineract but approval failed (failed sync log entries for 'approve' or 'create')
  const { data: loans, error: loanError } = await query<LyniaLoanRow>(`
    SELECT DISTINCT l.id, l.customer_id, l.loan_number, l.fineract_loan_id,
           l.fineract_product_id, l.outstanding_balance_usd, l.total_paid_usd,
           l.status, l.created_at
    FROM loans l
    WHERE (
      -- Case 1: Approved but never synced to Fineract
      (l.status = 'approved' AND l.fineract_loan_id IS NULL)
      OR
      -- Case 2: Has failed sync log entries for create or approve operations
      EXISTS (
        SELECT 1 FROM fineract_sync_log fsl
        WHERE fsl.entity_id = l.id::text
          AND fsl.entity_type = 'loan'
          AND fsl.operation IN ('create', 'approve')
          AND fsl.status IN ('failed', 'exhausted')
      )
    )
    ORDER BY l.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  if (loanError || !loans) {
    logger.error('Failed to query sync-issue loans', {
      action: 'fineract.getPendingLoans',
      meta: { error: loanError?.message || 'Unknown' },
    });
    return err(500, 'Failed to query loans with sync issues', event);
  }

  const loanRows = loans;
  const customerIds = [...new Set(loanRows.map((l) => l.customer_id))];
  const customerMap = await getCustomerMap(customerIds);

  let items: Record<string, unknown>[];
  try {
    const fineract = await getFineractClient();
    items = await Promise.all(
      loanRows.map(async (loan) => {
        const customer = customerMap.get(loan.customer_id);
        const view = loan.fineract_loan_id
          ? await buildLoanView(loan, customer || null, fineract)
          : buildLoanViewFromFineract(loan, customer || null, null);
        return {
          ...view,
          syncStatus: loan.fineract_loan_id ? 'approve_failed' : 'not_synced',
        };
      })
    );
  } catch (e) {
    logger.error('Fineract unavailable, returning DB-only data', {
      action: 'fineract.getPendingLoans',
      meta: { error: e instanceof Error ? e.message : 'Unknown' },
    });
    items = loanRows.map((loan) => {
      const customer = customerMap.get(loan.customer_id);
      return {
        ...buildLoanViewFromFineract(loan, customer || null, null),
        syncStatus: loan.fineract_loan_id ? 'approve_failed' : 'not_synced',
      };
    });
  }

  // Get total count
  const { data: countResult } = await query<{ count: string }>(`
    SELECT COUNT(DISTINCT l.id) as count
    FROM loans l
    WHERE (
      (l.status = 'approved' AND l.fineract_loan_id IS NULL)
      OR
      EXISTS (
        SELECT 1 FROM fineract_sync_log fsl
        WHERE fsl.entity_id = l.id::text
          AND fsl.entity_type = 'loan'
          AND fsl.operation IN ('create', 'approve')
          AND fsl.status IN ('failed', 'exhausted')
      )
    )
  `);
  const total = countResult?.[0] ? parseInt(countResult[0].count) : items.length;

  return ok(
    {
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
    .select('id, customer_id, loan_number, fineract_loan_id, fineract_product_id, outstanding_balance_usd, total_paid_usd, status, created_at')
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

  let fineract: Awaited<ReturnType<typeof getFineractClient>> | null = null;
  try {
    fineract = await getFineractClient();
  } catch (e) {
    logger.error('Fineract unavailable for overdue check', {
      action: 'fineract.getOverdueLoans',
      meta: { error: e instanceof Error ? e.message : 'Unknown' },
    });
    return ok({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } }, event);
  }

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
    .select('id, fineract_loan_id, outstanding_balance_usd')
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

  let fineract: Awaited<ReturnType<typeof getFineractClient>>;
  try {
    fineract = await getFineractClient();
  } catch {
    return ok(summary, event);
  }
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
    .select('id, customer_id, loan_number, fineract_loan_id, fineract_product_id, outstanding_balance_usd, total_paid_usd, status, created_at')
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
  let fineract: Awaited<ReturnType<typeof getFineractClient>>;
  try {
    fineract = await getFineractClient();
  } catch (e) {
    logger.error('Fineract unavailable for loan detail', {
      action: 'fineract.getLoanDetail',
      meta: { error: e instanceof Error ? e.message : 'Unknown' },
    });
    const view = buildLoanViewFromFineract(loan, customer, null);
    return ok({ ...view, repaymentSchedule: null, transactions: [] }, event);
  }

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
