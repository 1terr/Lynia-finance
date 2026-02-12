import { fetchAPI } from '@/lib/api/client';
import { MAX_PAGE_SIZE } from '@/lib/utils';
import type { Loan, Payment, LoanStatus, Customer, Device } from '@/types';

export interface LoanFilters {
  status?: LoanStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export type LoanWithCustomer = Omit<Loan, 'customer'> & {
  customer?: Customer;
  device?: Device;
};

export async function getLoans(filters: LoanFilters = {}) {
  const { status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  return fetchAPI<{
    data: LoanWithCustomer[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/loans?${params.toString()}`);
}

export async function getLoanById(id: string): Promise<LoanWithCustomer | null> {
  try {
    return await fetchAPI<LoanWithCustomer>(`/api/v1/loans/${id}`);
  } catch {
    return null;
  }
}

export async function getLoanPayments(loanId: string): Promise<Payment[]> {
  return fetchAPI<Payment[]>(`/api/v1/loans/${loanId}/payments`);
}

export async function approveLoan(loanId: string, adminId: string, notes?: string) {
  return fetchAPI<void>(`/api/v1/loans/${loanId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ admin_id: adminId, notes }),
  });
}

export async function rejectLoan(loanId: string, adminId: string, reason: string) {
  return fetchAPI<void>(`/api/v1/loans/${loanId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ admin_id: adminId, reason }),
  });
}

export async function getPendingLoans(page = 1, rawLimit = 25) {
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('status', 'pending');

  return fetchAPI<{
    data: LoanWithCustomer[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/loans/pending?${params.toString()}`);
}

export async function getLoanStats() {
  return fetchAPI<{
    pending: number;
    approved: number;
    active: number;
    rejected: number;
  }>('/api/v1/loans/stats');
}
