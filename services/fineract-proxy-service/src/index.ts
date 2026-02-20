/**
 * Fineract Proxy Service
 *
 * Backend proxy that serves the admin portal's Fineract UI pages.
 * Accepts authenticated requests from the admin portal, queries both
 * the Lynia PostgreSQL database and the internal Fineract ALB, and
 * returns merged/transformed responses matching the frontend types.
 *
 * All routes require Cognito authentication (enforced by API Gateway).
 *
 * Routes:
 *   GET  /api/v1/fineract/loans              - Paginated loans with Fineract balances
 *   GET  /api/v1/fineract/loans/pending       - Loans pending approval
 *   GET  /api/v1/fineract/loans/overdue       - Overdue loans
 *   GET  /api/v1/fineract/loans/aging-summary - Aging bucket summary
 *   GET  /api/v1/fineract/loans/{loanId}      - Loan detail with schedule + transactions
 *   POST /api/v1/fineract/loans/{loanId}/approve   - Approve loan
 *   POST /api/v1/fineract/loans/{loanId}/disburse  - Disburse loan
 *   POST /api/v1/fineract/loans/{loanId}/repayment - Record repayment
 *   GET  /api/v1/fineract/loan-products       - List loan products
 *   GET  /api/v1/fineract/loan-products/{id}  - Single loan product
 *   GET  /api/v1/fineract/gl-accounts         - List GL accounts
 *   GET  /api/v1/fineract/journal-entries     - Filtered journal entries
 *   GET  /api/v1/fineract/trial-balance       - Trial balance
 *   GET  /api/v1/fineract/reconciliation      - Latest reconciliation results
 *   POST /api/v1/fineract/reconciliation/run  - Trigger manual reconciliation
 *   GET  /api/v1/fineract/reports             - List available reports
 *   GET  /api/v1/fineract/reports/{name}      - Run a named report
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getFineractClient, parseFineractDate } from '../../shared/clients/fineract';
import { runReconciliation } from '../../shared/clients/fineract-reconcile';
import { db } from '../../shared/clients/database';
import {
  getSecurityHeaders,
  parseBody,
} from '../../shared/utils/response';
import type {
  FineractLoan,
  FineractRepaymentPeriod,
  FineractLoanTransaction,
  FineractDate,
} from '../../shared/types/fineract';

// ============================================================
// HELPERS
// ============================================================

const MAX_PAGE_SIZE = 100;

/** Convert Fineract [year, month, day] array to ISO date string */
function fmtDate(date: FineractDate | undefined | null): string | null {
  if (!date || !Array.isArray(date) || date.length < 3) return null;
  const d = parseFineractDate(date);
  return d.toISOString().split('T')[0];
}

function clampPage(raw: string | undefined, fallback: number, max: number): number {
  const n = parseInt(raw || '', 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback;
}

function ok(data: unknown, event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return { statusCode: 200, body: JSON.stringify(data), headers: getSecurityHeaders(event) };
}

function err(status: number, message: string, event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return { statusCode: status, body: JSON.stringify({ success: false, error: message }), headers: getSecurityHeaders(event) };
}

// ============================================================
// LOAN DATA TYPES (matching frontend types)
// ============================================================

interface LyniaLoanRow {
  id: string;
  customer_id: string;
  loan_number: string;
  fineract_loan_id: number | null;
  fineract_product_id: number | null;
  outstanding_balance: number;
  total_paid_usd: number;
  status: string;
  device_brand: string | null;
  device_model: string | null;
  device_imei: string | null;
  created_at: string;
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  fineract_client_id: number | null;
}

// ============================================================
// MAIN HANDLER
// ============================================================

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path.replace(/\/$/, ''); // strip trailing slash
    const method = event.httpMethod;

    // OPTIONS preflight
    if (method === 'OPTIONS') {
      return { statusCode: 200, body: '', headers: getSecurityHeaders(event) };
    }

    // ---- LOANS: list / pending / overdue / aging-summary ----
    if (path === '/api/v1/fineract/loans' && method === 'GET') {
      return await handleGetLoans(event);
    }
    if (path === '/api/v1/fineract/loans/pending' && method === 'GET') {
      return await handleGetPendingLoans(event);
    }
    if (path === '/api/v1/fineract/loans/overdue' && method === 'GET') {
      return await handleGetOverdueLoans(event);
    }
    if (path === '/api/v1/fineract/loans/aging-summary' && method === 'GET') {
      return await handleGetAgingSummary(event);
    }

    // ---- LOAN DETAIL & ACTIONS (/loans/{id}/...) ----
    const loanActionMatch = path.match(/^\/api\/v1\/fineract\/loans\/([^/]+)\/(approve|disburse|repayment)$/);
    if (loanActionMatch && method === 'POST') {
      const [, loanId, action] = loanActionMatch;
      return await handleLoanAction(event, loanId, action);
    }

    const loanDetailMatch = path.match(/^\/api\/v1\/fineract\/loans\/([^/]+)$/);
    if (loanDetailMatch && method === 'GET') {
      return await handleGetLoanDetail(event, loanDetailMatch[1]);
    }

    // ---- LOAN PRODUCTS ----
    if (path === '/api/v1/fineract/loan-products' && method === 'GET') {
      return await handleGetLoanProducts(event);
    }
    const productMatch = path.match(/^\/api\/v1\/fineract\/loan-products\/(\d+)$/);
    if (productMatch && method === 'GET') {
      return await handleGetLoanProduct(event, parseInt(productMatch[1], 10));
    }

    // ---- GL ACCOUNTS ----
    if (path === '/api/v1/fineract/gl-accounts' && method === 'GET') {
      return await handleGetGLAccounts(event);
    }

    // ---- JOURNAL ENTRIES ----
    if (path === '/api/v1/fineract/journal-entries' && method === 'GET') {
      return await handleGetJournalEntries(event);
    }

    // ---- TRIAL BALANCE ----
    if (path === '/api/v1/fineract/trial-balance' && method === 'GET') {
      return await handleGetTrialBalance(event);
    }

    // ---- RECONCILIATION ----
    if (path === '/api/v1/fineract/reconciliation' && method === 'GET') {
      return await handleGetReconciliation(event);
    }
    if (path === '/api/v1/fineract/reconciliation/run' && method === 'POST') {
      return await handleRunReconciliation(event);
    }

    // ---- FINERACT REPORTS ----
    if (path === '/api/v1/fineract/reports' && method === 'GET') {
      return await handleGetReports(event);
    }
    const reportMatch = path.match(/^\/api\/v1\/fineract\/reports\/([^/]+)$/);
    if (reportMatch && method === 'GET') {
      return await handleRunReport(event, reportMatch[1]);
    }

    return err(404, 'Not Found', event);
  } catch (error) {
    console.error('[fineract-proxy] Unhandled error:', error);
    return err(500, 'Internal Server Error', event);
  }
};

// ============================================================
// LOAN HANDLERS
// ============================================================

/** GET /api/v1/fineract/loans - paginated list with Fineract balances */
async function handleGetLoans(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
    console.error('[fineract-proxy] Loan query error:', loanError);
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

  // Apply search filter client-side (customer name / loan number)
  const filtered = search
    ? items.filter(
        (item) =>
          String(item.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
          String(item.fineractAccountNo || '').toLowerCase().includes(search.toLowerCase())
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

/** GET /api/v1/fineract/loans/pending */
async function handleGetPendingLoans(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

/** GET /api/v1/fineract/loans/{loanId} - detail with schedule + transactions */
async function handleGetLoanDetail(
  event: APIGatewayProxyEvent,
  lyniaLoanId: string
): Promise<APIGatewayProxyResult> {
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

  const customer = custData as unknown as CustomerRow | null;
  const fineract = await getFineractClient();

  let fLoan: FineractLoan | null = null;
  try {
    fLoan = await fineract.getLoanWithTransactions(loan.fineract_loan_id);
  } catch (e) {
    console.error(`[fineract-proxy] Failed to get Fineract loan ${loan.fineract_loan_id}:`, e);
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

/** GET /api/v1/fineract/loans/overdue */
async function handleGetOverdueLoans(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
      console.error(`[fineract-proxy] Failed to check overdue for loan ${loan.id}:`, e);
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

/** GET /api/v1/fineract/loans/aging-summary */
async function handleGetAgingSummary(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
// LOAN ACTION HANDLERS
// ============================================================

async function handleLoanAction(
  event: APIGatewayProxyEvent,
  lyniaLoanId: string,
  action: string
): Promise<APIGatewayProxyResult> {
  const { data: body, error: parseError } = parseBody(event);
  if (parseError) return parseError;

  // Look up the Fineract loan ID from Lynia DB
  const { data: loanData, error: dbError } = await db
    .from('loans')
    .select('id, fineract_loan_id')
    .eq('id', lyniaLoanId)
    .single()
    .execute();

  if (dbError || !loanData) {
    return err(404, 'Loan not found', event);
  }

  const loan = loanData as unknown as { id: string; fineract_loan_id: number | null };
  if (!loan.fineract_loan_id) {
    return err(400, 'Loan has not been synced to Fineract', event);
  }

  const fineract = await getFineractClient();

  try {
    switch (action) {
      case 'approve': {
        const approvedOnDate = (body as Record<string, unknown>)?.approvedOnDate as string | undefined;
        const response = await fineract.approveLoan(
          loan.fineract_loan_id,
          approvedOnDate ? new Date(approvedOnDate) : undefined
        );
        return ok(
          { success: true, resourceId: response.resourceId, loanId: response.loanId },
          event
        );
      }

      case 'disburse': {
        const actualDate = (body as Record<string, unknown>)?.actualDisbursementDate as string | undefined;
        const paymentTypeId = (body as Record<string, unknown>)?.paymentTypeId as number | undefined;
        const response = await fineract.disburseLoan(
          loan.fineract_loan_id,
          actualDate ? new Date(actualDate) : undefined,
          paymentTypeId
        );
        return ok(
          { success: true, resourceId: response.resourceId, loanId: response.loanId },
          event
        );
      }

      case 'repayment': {
        const reqBody = body as Record<string, unknown>;
        const response = await fineract.postRepayment({
          loanId: loan.fineract_loan_id,
          amount: reqBody.transactionAmount as number,
          transactionDate: new Date(reqBody.transactionDate as string),
          paymentTypeId: reqBody.paymentTypeId as number | undefined,
          note: reqBody.note as string | undefined,
        });
        return ok(
          { success: true, resourceId: response.resourceId, loanId: response.loanId },
          event
        );
      }

      default:
        return err(400, `Unknown action: ${action}`, event);
    }
  } catch (e) {
    console.error(`[fineract-proxy] Loan action ${action} failed:`, e);
    return err(500, `Failed to ${action} loan: ${e instanceof Error ? e.message : 'unknown error'}`, event);
  }
}

// ============================================================
// LOAN PRODUCT HANDLERS
// ============================================================

/** GET /api/v1/fineract/loan-products */
async function handleGetLoanProducts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();
  const products = await fineract.listLoanProducts();

  const mapped = products.map((p) => ({
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    description: p.description || '',
    currency: {
      code: p.currency.code,
      name: p.currency.name,
      decimalPlaces: p.currency.decimalPlaces,
      displaySymbol: p.currency.displaySymbol,
      displayLabel: p.currency.displayLabel,
    },
    principal: p.principal,
    minPrincipal: p.minPrincipal,
    maxPrincipal: p.maxPrincipal,
    numberOfRepayments: p.numberOfRepayments,
    repaymentEvery: p.repaymentEvery,
    repaymentFrequency: p.repaymentFrequencyType?.value || 'Months',
    interestRatePerPeriod: p.interestRatePerPeriod,
    annualInterestRate: p.annualInterestRate,
    interestType: p.interestType?.value || 'Declining Balance',
    amortizationType: p.amortizationType?.value || 'Equal Installments',
    accountingRule: p.accountingRule?.value || 'None',
    accountingMappings: p.accountingMappings,
  }));

  return ok(mapped, event);
}

/** GET /api/v1/fineract/loan-products/{id} */
async function handleGetLoanProduct(
  event: APIGatewayProxyEvent,
  productId: number
): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();

  try {
    const p = await fineract.getLoanProduct(productId);
    return ok(
      {
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        description: p.description || '',
        currency: {
          code: p.currency.code,
          name: p.currency.name,
          decimalPlaces: p.currency.decimalPlaces,
          displaySymbol: p.currency.displaySymbol,
          displayLabel: p.currency.displayLabel,
        },
        principal: p.principal,
        minPrincipal: p.minPrincipal,
        maxPrincipal: p.maxPrincipal,
        numberOfRepayments: p.numberOfRepayments,
        repaymentEvery: p.repaymentEvery,
        repaymentFrequency: p.repaymentFrequencyType?.value || 'Months',
        interestRatePerPeriod: p.interestRatePerPeriod,
        annualInterestRate: p.annualInterestRate,
        interestType: p.interestType?.value || 'Declining Balance',
        amortizationType: p.amortizationType?.value || 'Equal Installments',
        accountingRule: p.accountingRule?.value || 'None',
        accountingMappings: p.accountingMappings,
      },
      event
    );
  } catch {
    return err(404, 'Loan product not found', event);
  }
}

// ============================================================
// GL ACCOUNT & JOURNAL ENTRY HANDLERS
// ============================================================

/** GET /api/v1/fineract/gl-accounts */
async function handleGetGLAccounts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();
  const accounts = await fineract.listGLAccounts();

  const mapped = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    glCode: a.glCode,
    type: a.type?.value || 'ASSET',
    usage: a.usage?.value || 'DETAIL',
    description: a.description || null,
    disabled: a.disabled,
    manualEntriesAllowed: a.manualEntriesAllowed,
    parentId: a.parentId ?? null,
  }));

  return ok(mapped, event);
}

/** GET /api/v1/fineract/journal-entries */
async function handleGetJournalEntries(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const qs = event.queryStringParameters || {};
  const page = clampPage(qs.page, 1, 1000);
  const limit = clampPage(qs.limit, 50, MAX_PAGE_SIZE);

  const fineract = await getFineractClient();
  const result = await fineract.listJournalEntries({
    glAccountId: qs.glAccountId ? parseInt(qs.glAccountId, 10) : undefined,
    fromDate: qs.fromDate,
    toDate: qs.toDate,
    limit,
    offset: (page - 1) * limit,
  });

  const entries = (result.pageItems || []).map((je) => ({
    id: je.id,
    officeId: je.officeId,
    officeName: je.officeName,
    glAccountId: je.glAccountId,
    glAccountName: je.glAccountName,
    glAccountCode: je.glAccountCode,
    glAccountType: je.glAccountType?.value || '',
    transactionDate: fmtDate(je.transactionDate) || '',
    entryType: je.entryType?.value || '',
    amount: je.amount,
    currency: {
      code: je.currency?.code || 'USD',
      name: je.currency?.name || 'US Dollar',
      decimalPlaces: je.currency?.decimalPlaces ?? 2,
      displaySymbol: je.currency?.displaySymbol || '$',
      displayLabel: je.currency?.displayLabel || 'US Dollar ($)',
    },
    transactionId: je.transactionId,
    manualEntry: je.manualEntry,
    entityType: je.entityType?.value || '',
    entityId: je.entityId,
    reversed: je.reversed,
    referenceNumber: je.referenceNumber || null,
    submittedOnDate: fmtDate(je.submittedOnDate) || '',
  }));

  return ok(
    {
      data: entries,
      pagination: {
        page,
        limit,
        total: result.totalFilteredRecords || entries.length,
        totalPages: Math.ceil((result.totalFilteredRecords || entries.length) / limit),
      },
    },
    event
  );
}

/** GET /api/v1/fineract/trial-balance */
async function handleGetTrialBalance(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();

  // Get all GL accounts
  const accounts = await fineract.listGLAccounts();

  // Get all journal entries (summary)
  const { pageItems } = await fineract.listJournalEntries({ limit: 10000 });

  // Compute trial balance per account
  const balanceMap = new Map<number, { debit: number; credit: number }>();

  for (const je of pageItems || []) {
    const entry = balanceMap.get(je.glAccountId) || { debit: 0, credit: 0 };
    if (je.entryType?.value === 'DEBIT') {
      entry.debit += je.amount;
    } else {
      entry.credit += je.amount;
    }
    balanceMap.set(je.glAccountId, entry);
  }

  const trialBalance = accounts
    .filter((a) => a.usage?.id === 2) // DETAIL accounts only
    .map((a) => {
      const bal = balanceMap.get(a.id) || { debit: 0, credit: 0 };
      return {
        glAccountId: a.id,
        glAccountName: a.name,
        glAccountCode: a.glCode,
        glAccountType: a.type?.value || '',
        totalDebit: bal.debit,
        totalCredit: bal.credit,
        balance: bal.debit - bal.credit,
      };
    });

  return ok(trialBalance, event);
}

// ============================================================
// RECONCILIATION HANDLERS
// ============================================================

/** GET /api/v1/fineract/reconciliation */
async function handleGetReconciliation(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Query the most recent reconciliation log entries
  const { data: recentLogs, error: logsError } = await db
    .from('fineract_sync_log')
    .select('id, entity_type, entity_id, fineract_id, operation, status, error_message, created_at')
    .eq('operation', 'reconcile')
    .order('created_at', { ascending: false })
    .limit(100)
    .execute();

  if (logsError) {
    console.error('[fineract-proxy] Reconciliation query failed:', logsError.message);
    return err(500, 'Failed to query reconciliation data', event);
  }

  const logs = (recentLogs as unknown as Array<{
    entity_id: string;
    fineract_id: number;
    status: string;
    error_message: string;
    created_at: string;
  }>) || [];

  // Parse discrepancies from error messages
  const discrepancies = logs
    .filter((l) => l.status === 'failed' && l.error_message?.includes('Balance mismatch'))
    .map((l) => {
      const match = l.error_message?.match(
        /Lynia=\$([0-9.]+) vs Fineract=\$([0-9.]+) \(diff=\$([0-9.]+), severity=(\w+)\)/
      );
      return {
        lyniaLoanId: l.entity_id,
        fineractLoanId: l.fineract_id,
        customerName: '',
        lyniaBalance: match ? parseFloat(match[1]) : 0,
        fineractBalance: match ? parseFloat(match[2]) : 0,
        difference: match ? parseFloat(match[3]) : 0,
        severity: (match?.[4] || 'low') as 'low' | 'medium' | 'high',
        lastSyncedAt: l.created_at,
      };
    });

  // Count retried syncs
  const { data: retryLogs, error: retryError } = await db
    .from('fineract_sync_log')
    .select('id, status')
    .eq('status', 'retrying')
    .execute();

  if (retryError) {
    console.error('[fineract-proxy] Retry query failed:', retryError.message);
  }

  const retryCount = Array.isArray(retryLogs) ? retryLogs.length : 0;

  // Find the most recent reconciliation timestamp
  const runAt = logs.length > 0 ? logs[0].created_at : new Date().toISOString();

  return ok(
    {
      runAt,
      totalLoansChecked: logs.length,
      matchedCount: logs.filter((l) => l.status === 'success').length,
      discrepancyCount: discrepancies.length,
      discrepancies,
      retriedSyncs: retryCount,
      retrySuccessCount: 0,
    },
    event
  );
}

/** POST /api/v1/fineract/reconciliation/run */
async function handleRunReconciliation(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await runReconciliation();

  const discrepancies = result.discrepancies.map((d) => ({
    lyniaLoanId: d.lyniaLoanId,
    fineractLoanId: d.fineractLoanId,
    customerName: '',
    lyniaBalance: d.lyniaOutstanding,
    fineractBalance: d.fineractOutstanding,
    difference: d.difference,
    severity: d.severity,
    lastSyncedAt: result.timestamp,
  }));

  return ok(
    {
      runAt: result.timestamp,
      totalLoansChecked: result.totalLoansChecked,
      matchedCount: result.matchedLoans,
      discrepancyCount: result.discrepancies.length,
      discrepancies,
      retriedSyncs: result.retriedSyncs,
      retrySuccessCount: result.retriedSuccesses,
    },
    event
  );
}

// ============================================================
// SHARED HELPERS
// ============================================================

async function getCustomerMap(customerIds: string[]): Promise<Map<string, CustomerRow>> {
  const map = new Map<string, CustomerRow>();
  if (customerIds.length === 0) return map;

  const { data } = await db
    .from('customers')
    .select('id, first_name, last_name, phone_number, fineract_client_id')
    .in('id', customerIds)
    .execute();

  if (data) {
    for (const row of data as unknown as CustomerRow[]) {
      map.set(row.id, row);
    }
  }

  return map;
}

/** Build a FineractLoanView by querying Fineract for the loan data */
async function buildLoanView(
  loan: LyniaLoanRow,
  customer: CustomerRow | null,
  fineract: Awaited<ReturnType<typeof getFineractClient>>
): Promise<Record<string, unknown>> {
  let fLoan: FineractLoan | null = null;
  if (loan.fineract_loan_id) {
    try {
      fLoan = await fineract.getLoan(loan.fineract_loan_id);
    } catch {
      // Fineract unavailable — use Lynia DB data only
    }
  }
  return buildLoanViewFromFineract(loan, customer, fLoan);
}

/** Build a FineractLoanView from Lynia loan + optional Fineract data */
function buildLoanViewFromFineract(
  loan: LyniaLoanRow,
  customer: CustomerRow | null,
  fLoan: FineractLoan | null
): Record<string, unknown> {
  const s = fLoan?.summary;
  const tl = fLoan?.timeline;

  return {
    lyniaLoanId: loan.id,
    lyniaCustomerId: loan.customer_id,
    customerName: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown',
    customerPhone: customer?.phone_number || '',
    fineractLoanId: fLoan?.id ?? loan.fineract_loan_id ?? 0,
    fineractAccountNo: fLoan?.accountNo ?? loan.loan_number ?? '',
    fineractClientId: fLoan?.clientId ?? customer?.fineract_client_id ?? 0,
    productName: fLoan?.loanProductName ?? '',
    productId: fLoan?.loanProductId ?? loan.fineract_product_id ?? 0,
    principal: fLoan?.principal?.amount ?? loan.outstanding_balance ?? 0,
    approvedPrincipal: fLoan?.approvedPrincipal?.amount ?? 0,
    currency: fLoan?.currency
      ? {
          code: fLoan.currency.code,
          name: fLoan.currency.name,
          decimalPlaces: fLoan.currency.decimalPlaces,
          displaySymbol: fLoan.currency.displaySymbol,
          displayLabel: fLoan.currency.displayLabel,
        }
      : { code: 'USD', name: 'US Dollar', decimalPlaces: 2, displaySymbol: '$', displayLabel: 'US Dollar ($)' },
    numberOfRepayments: fLoan?.numberOfRepayments ?? 0,
    repaymentEvery: fLoan?.repaymentEvery ?? 0,
    repaymentFrequency: fLoan?.repaymentFrequencyType?.value ?? 'Months',
    interestRatePerPeriod: fLoan?.interestRatePerPeriod ?? 0,
    annualInterestRate: fLoan?.annualInterestRate ?? 0,
    interestType: fLoan?.interestType?.value ?? '',
    amortizationType: fLoan?.amortizationType?.value ?? '',
    status: fLoan?.status ?? { id: 0, code: 'loanStatusType.active', value: loan.status },
    submittedOnDate: fmtDate(tl?.submittedOnDate ?? null),
    approvedOnDate: fmtDate(tl?.approvedOnDate ?? null),
    expectedDisbursementDate: fmtDate(tl?.expectedDisbursementDate ?? null),
    actualDisbursementDate: fmtDate(tl?.actualDisbursementDate ?? null),
    expectedMaturityDate: fmtDate(tl?.expectedMaturityDate ?? null),
    closedOnDate: fmtDate(tl?.closedOnDate ?? null),
    principalDisbursed: s?.principalDisbursed ?? 0,
    principalPaid: s?.principalPaid ?? 0,
    principalOutstanding: s?.principalOutstanding ?? loan.outstanding_balance ?? 0,
    principalOverdue: s?.principalOverdue ?? 0,
    interestCharged: s?.interestCharged ?? 0,
    interestPaid: s?.interestPaid ?? 0,
    interestOutstanding: s?.interestOutstanding ?? 0,
    interestOverdue: s?.interestOverdue ?? 0,
    feeChargesCharged: s?.feeChargesCharged ?? 0,
    feeChargesPaid: s?.feeChargesPaid ?? 0,
    feeChargesOutstanding: s?.feeChargesOutstanding ?? 0,
    penaltyChargesCharged: s?.penaltyChargesCharged ?? 0,
    penaltyChargesPaid: s?.penaltyChargesPaid ?? 0,
    penaltyChargesOutstanding: s?.penaltyChargesOutstanding ?? 0,
    totalExpectedRepayment: s?.totalExpectedRepayment ?? 0,
    totalRepayment: s?.totalRepayment ?? loan.total_paid_usd ?? 0,
    totalOutstanding: s?.totalOutstanding ?? loan.outstanding_balance ?? 0,
    totalOverdue: s?.totalOverdue ?? 0,
    overdueSinceDate: fmtDate(s?.overdueSinceDate ?? null),
    deviceBrand: loan.device_brand,
    deviceModel: loan.device_model,
    deviceImei: loan.device_imei,
  };
}

function mapRepaymentPeriod(p: FineractRepaymentPeriod) {
  return {
    period: p.period,
    fromDate: fmtDate(p.fromDate) || '',
    dueDate: fmtDate(p.dueDate) || '',
    paidDate: fmtDate(p.obligationsMetOnDate ?? null),
    complete: p.complete,
    daysInPeriod: p.daysInPeriod,
    principalDue: p.principalDue,
    principalPaid: p.principalPaid,
    principalOutstanding: p.principalOutstanding,
    interestDue: p.interestDue,
    interestPaid: p.interestPaid,
    interestOutstanding: p.interestOutstanding,
    feeChargesDue: p.feeChargesDue,
    feeChargesPaid: p.feeChargesPaid,
    penaltyChargesDue: p.penaltyChargesDue,
    penaltyChargesPaid: p.penaltyChargesPaid,
    totalDue: p.totalDueForPeriod,
    totalPaid: p.totalPaidForPeriod,
    totalOutstanding: p.totalOutstandingForPeriod,
    totalOverdue: p.totalOutstandingForPeriod, // Fineract doesn't separate overdue from outstanding per period
    balanceOfLoan: p.principalLoanBalanceOutstanding,
  };
}

function getAgingBucket(daysPastDue: number): '1-30' | '31-60' | '61-90' | '90+' {
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  return '90+';
}

// ============================================================
// REPORT HANDLERS
// ============================================================

/** GET /api/v1/fineract/reports - list available reports */
async function handleGetReports(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();
  try {
    const reports = await fineract.listReports();
    const mapped = reports.map((r) => ({
      id: r.id,
      reportName: r.reportName,
      reportType: r.reportType,
      reportSubType: r.reportSubType || '',
      reportCategory: r.reportCategory || '',
      description: r.description || '',
    }));
    return ok(mapped, event);
  } catch (e) {
    console.error('[fineract-proxy] Failed to list reports:', e);
    return err(500, 'Failed to fetch reports from Fineract', event);
  }
}

/** GET /api/v1/fineract/reports/{reportName} - run a named report */
async function handleRunReport(
  event: APIGatewayProxyEvent,
  reportName: string
): Promise<APIGatewayProxyResult> {
  const fineract = await getFineractClient();
  const qs = event.queryStringParameters || {};

  try {
    const result = await fineract.runReport(reportName, qs as Record<string, string>);
    return ok(result, event);
  } catch (e) {
    console.error(`[fineract-proxy] Failed to run report ${reportName}:`, e);
    return err(500, `Failed to run report: ${e instanceof Error ? e.message : 'unknown error'}`, event);
  }
}
