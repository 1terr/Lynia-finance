/**
 * Fineract API Client for Admin Portal (Phase 7)
 *
 * Frontend API functions that call backend Lambda endpoints which
 * proxy requests to the Fineract core banking engine.
 */

import { getValidSession } from '@lynia/auth';
import { MAX_PAGE_SIZE } from '@lynia/utils';

/**
 * Fineract API base URL.
 * The Fineract proxy runs on a separate API Gateway to avoid circular
 * dependency in the main SAM stack. Falls back to the main API if unset.
 */
const FINERACT_API_BASE = process.env.NEXT_PUBLIC_FINERACT_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';

/** Authenticated fetch against the Fineract proxy API */
async function fetchFineractAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const session = await getValidSession();
  if (!session) throw new Error('Authentication required. Please sign in.');
  const token = session.getIdToken().getJwtToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let res: Response;
  try {
    res = await fetch(`${FINERACT_API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Fineract request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) throw new Error('Session expired. Redirecting to login.');
  if (res.status === 403) throw new Error('You do not have permission to perform this action.');

  if (!res.ok) {
    let message: string | undefined;
    try {
      const body = await res.json();
      message = body?.defaultUserMessage || body?.error || body?.message;
      // Append field-level validation errors if present
      const validationErrors = body?.details?.validation_errors;
      if (Array.isArray(validationErrors) && validationErrors.length) {
        const fieldErrors = validationErrors
          .map((e: { field?: string; message?: string }) =>
            e.field ? `${e.field}: ${e.message}` : e.message,
          )
          .join('; ');
        message = message ? `${message} — ${fieldErrors}` : fieldErrors;
      }
    } catch {
      // Response body is not JSON — fall through to generic message
    }
    // Actionable fallback messages for upstream failures
    if (!message && res.status === 502) {
      message = 'Fineract core banking service is unreachable. Please check if the service is running.';
    } else if (!message && res.status === 503) {
      message = 'Fineract service temporarily unavailable. Please retry in a minute.';
    }

    throw new Error(message || `Fineract request failed (${res.status})`);
  }

  return res.json();
}
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

  return fetchFineractAPI<PaginatedResponse<FineractLoanView>>(
    `/api/v1/fineract/loans?${params.toString()}`
  );
}

/** Fetch single loan detail with repayment schedule and transactions */
export async function getFineractLoanDetail(
  lyniaLoanId: string
): Promise<FineractLoanDetail | null> {
  try {
    return await fetchFineractAPI<FineractLoanDetail>(
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

  return fetchFineractAPI<PaginatedResponse<FineractLoanView>>(
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
  return fetchFineractAPI<FineractActionResponse>(
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
  return fetchFineractAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/disburse`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

/** Reject a loan in Fineract */
export async function rejectFineractLoan(
  lyniaLoanId: string,
  request: { rejectedOnDate: string; note: string }
): Promise<FineractActionResponse> {
  return fetchFineractAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/reject`,
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
  return fetchFineractAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/repayment`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

/** Write off a loan in Fineract */
export async function writeOffFineractLoan(
  lyniaLoanId: string
): Promise<FineractActionResponse> {
  return fetchFineractAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/writeoff`,
    { method: 'POST' }
  );
}

/** Close a loan in Fineract */
export async function closeFineractLoan(
  lyniaLoanId: string
): Promise<FineractActionResponse> {
  return fetchFineractAPI<FineractActionResponse>(
    `/api/v1/fineract/loans/${lyniaLoanId}/close`,
    { method: 'POST' }
  );
}

// ============================================================
// LOAN PRODUCTS
// ============================================================

/** Fetch all Fineract loan products */
export async function getFineractLoanProducts(): Promise<FineractLoanProductView[]> {
  return fetchFineractAPI<FineractLoanProductView[]>('/api/v1/fineract/loan-products');
}

/** Create a Fineract loan product from a Lynia product and link them */
export async function createFineractProductFromLynia(lyniaProductId: string): Promise<{ fineract_product_id: number; lynia_product_id: string }> {
  return fetchFineractAPI<{ fineract_product_id: number; lynia_product_id: string }>(
    '/api/v1/fineract/loan-products/create-from-lynia',
    { method: 'POST', body: JSON.stringify({ lynia_product_id: lyniaProductId }) }
  );
}

/** Fetch a single loan product */
export async function getFineractLoanProduct(
  productId: number
): Promise<FineractLoanProductView | null> {
  try {
    return await fetchFineractAPI<FineractLoanProductView>(
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
  return fetchFineractAPI<GLAccount[]>('/api/v1/fineract/gl-accounts');
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

  return fetchFineractAPI<PaginatedResponse<JournalEntry>>(
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
  return fetchFineractAPI<TrialBalanceEntry[]>(
    `/api/v1/fineract/trial-balance${query ? `?${query}` : ''}`
  );
}

// ============================================================
// RECONCILIATION
// ============================================================

/** Fetch latest reconciliation results */
export async function getReconciliationResults(): Promise<ReconciliationResult> {
  return fetchFineractAPI<ReconciliationResult>('/api/v1/fineract/reconciliation');
}

/** Trigger a manual reconciliation run */
export async function triggerReconciliation(): Promise<ReconciliationResult> {
  return fetchFineractAPI<ReconciliationResult>('/api/v1/fineract/reconciliation/run', {
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

  return fetchFineractAPI<PaginatedResponse<OverdueLoan>>(
    `/api/v1/fineract/loans/overdue?${params.toString()}`
  );
}

/** Fetch aging summary */
export async function getAgingSummary(): Promise<AgingSummary> {
  return fetchFineractAPI<AgingSummary>('/api/v1/fineract/loans/aging-summary');
}
