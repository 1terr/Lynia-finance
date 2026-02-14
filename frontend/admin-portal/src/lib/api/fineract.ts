/**
 * Fineract API Client for Admin Portal (Phase 7)
 *
 * Frontend API functions that call backend Lambda endpoints which
 * proxy requests to the Fineract core banking engine.
 */

import { fetchAPI } from '@/lib/api/client';
import { MAX_PAGE_SIZE } from '@/lib/utils';
import type {
  FineractLoanView,
  FineractLoanDetail,
  FineractLoanProductView,
  GLAccount,
  JournalEntry,
  TrialBalanceEntry,
  ReconciliationResult,
  OverdueLoan,
  AgingSummary,
  ApproveLoanRequest,
  DisburseLoanRequest,
  RecordRepaymentRequest,
  FineractActionResponse,
  FineractLoanStatusCode,
} from '@/types/fineract';
import type { PaginatedResponse } from '@/types';

// ============================================================
// LOANS
// ============================================================

export interface FineractLoanFilters {
  status?: FineractLoanStatusCode;
  search?: string;
  page?: number;
  limit?: number;
}

/** Fetch paginated list of loans with Fineract balances */
export async function getFineractLoans(
  filters: FineractLoanFilters = {}
): Promise<PaginatedResponse<FineractLoanView>> {
  const { status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  return fetchAPI<PaginatedResponse<FineractLoanView>>(
    `/api/v1/fineract/loans?${params.toString()}`
  );
}

/** Fetch single loan detail with repayment schedule and transactions */
export async function getFineractLoanDetail(
  lyniaLoanId: string
): Promise<FineractLoanDetail | null> {
  try {
    return await fetchAPI<FineractLoanDetail>(
      `/api/v1/fineract/loans/${lyniaLoanId}`
    );
  } catch {
    return null;
  }
}

/** Fetch loans pending approval from Fineract */
export async function getPendingApprovalLoans(
  page = 1,
  rawLimit = 25
): Promise<PaginatedResponse<FineractLoanView>> {
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  return fetchAPI<PaginatedResponse<FineractLoanView>>(
    `/api/v1/fineract/loans/pending?${params.toString()}`
  );
}

// ============================================================
// LOAN ACTIONS
// ============================================================

/** Approve a loan in Fineract */
export async function approveFineractLoan(
  lyniaLoanId: string,
  request: ApproveLoanRequest
): Promise<FineractActionResponse> {
  return fetchAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

/** Disburse a loan in Fineract */
export async function disburseFineractLoan(
  lyniaLoanId: string,
  request: DisburseLoanRequest
): Promise<FineractActionResponse> {
  return fetchAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/disburse`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

/** Record a repayment in Fineract */
export async function recordFineractRepayment(
  lyniaLoanId: string,
  request: RecordRepaymentRequest
): Promise<FineractActionResponse> {
  return fetchAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/repayment`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

// ============================================================
// LOAN PRODUCTS
// ============================================================

/** Fetch all Fineract loan products */
export async function getFineractLoanProducts(): Promise<FineractLoanProductView[]> {
  return fetchAPI<FineractLoanProductView[]>('/api/v1/fineract/loan-products');
}

/** Fetch a single loan product */
export async function getFineractLoanProduct(
  productId: number
): Promise<FineractLoanProductView | null> {
  try {
    return await fetchAPI<FineractLoanProductView>(
      `/api/v1/fineract/loan-products/${productId}`
    );
  } catch {
    return null;
  }
}

// ============================================================
// GL ACCOUNTS & JOURNAL ENTRIES
// ============================================================

/** Fetch all GL accounts */
export async function getGLAccounts(): Promise<GLAccount[]> {
  return fetchAPI<GLAccount[]>('/api/v1/fineract/gl-accounts');
}

/** Fetch journal entries with filters */
export interface JournalEntryFilters {
  glAccountId?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export async function getJournalEntries(
  filters: JournalEntryFilters = {}
): Promise<PaginatedResponse<JournalEntry>> {
  const { glAccountId, fromDate, toDate, page = 1, limit: rawLimit = 50 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (glAccountId) params.set('glAccountId', String(glAccountId));
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  return fetchAPI<PaginatedResponse<JournalEntry>>(
    `/api/v1/fineract/journal-entries?${params.toString()}`
  );
}

/** Fetch trial balance */
export async function getTrialBalance(
  fromDate?: string,
  toDate?: string
): Promise<TrialBalanceEntry[]> {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  const query = params.toString();
  return fetchAPI<TrialBalanceEntry[]>(
    `/api/v1/fineract/trial-balance${query ? `?${query}` : ''}`
  );
}

// ============================================================
// RECONCILIATION
// ============================================================

/** Fetch latest reconciliation results */
export async function getReconciliationResults(): Promise<ReconciliationResult> {
  return fetchAPI<ReconciliationResult>('/api/v1/fineract/reconciliation');
}

/** Trigger a manual reconciliation run */
export async function triggerReconciliation(): Promise<ReconciliationResult> {
  return fetchAPI<ReconciliationResult>('/api/v1/fineract/reconciliation/run', {
    method: 'POST',
  });
}

// ============================================================
// OVERDUE LOANS
// ============================================================

/** Fetch overdue loans with aging analysis */
export async function getOverdueLoans(
  page = 1,
  rawLimit = 25
): Promise<PaginatedResponse<OverdueLoan>> {
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  return fetchAPI<PaginatedResponse<OverdueLoan>>(
    `/api/v1/fineract/loans/overdue?${params.toString()}`
  );
}

/** Fetch aging summary */
export async function getAgingSummary(): Promise<AgingSummary> {
  return fetchAPI<AgingSummary>('/api/v1/fineract/loans/aging-summary');
}
