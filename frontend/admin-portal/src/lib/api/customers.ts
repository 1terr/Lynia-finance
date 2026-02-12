import { fetchAPI } from '@/lib/api/client';
import { MAX_PAGE_SIZE } from '@/lib/utils';
import type { Customer, CustomerStatus, KYCStatus, Loan, Payment, CreditScore, KYCSubmission } from '@/types';

export interface CustomerFilters {
  status?: CustomerStatus;
  kyc_status?: KYCStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getCustomers(filters: CustomerFilters = {}) {
  const { status, kyc_status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (kyc_status) params.set('kyc_status', kyc_status);
  if (search) params.set('search', search);

  return fetchAPI<{
    data: Customer[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/customers?${params.toString()}`);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    return await fetchAPI<Customer>(`/api/v1/customers/${id}`);
  } catch {
    return null;
  }
}

export const fetchCustomerById = getCustomerById;

export async function updateCustomer(id: string, updates: Partial<Customer>, adminId?: string) {
  return fetchAPI<void>(`/api/v1/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, admin_id: adminId }),
  });
}

export async function getCustomerLoans(customerId: string): Promise<Loan[]> {
  return fetchAPI<Loan[]>(`/api/v1/customers/${customerId}/loans`);
}

export async function getCustomerPayments(customerId: string): Promise<Payment[]> {
  return fetchAPI<Payment[]>(`/api/v1/customers/${customerId}/payments`);
}

export async function getCustomerCreditScore(customerId: string): Promise<CreditScore | null> {
  try {
    return await fetchAPI<CreditScore>(`/api/v1/customers/${customerId}/credit-score`);
  } catch {
    return null;
  }
}

export async function getCustomerKYC(customerId: string): Promise<KYCSubmission[]> {
  return fetchAPI<KYCSubmission[]>(`/api/v1/customers/${customerId}/kyc`);
}

export async function getCustomerTimeline(customerId: string) {
  return fetchAPI<Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: Record<string, unknown> | null;
    created_at: string;
    admin_id: string | null;
  }>>(`/api/v1/customers/${customerId}/timeline`);
}

export async function updateCustomerStatus(customerId: string, status: CustomerStatus, adminId: string) {
  return fetchAPI<void>(`/api/v1/customers/${customerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, admin_id: adminId }),
  });
}

// --- KYC Review ---

export async function getKYCPendingReview(page = 1, rawLimit = 25) {
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));

  return fetchAPI<{
    data: (KYCSubmission & { customer: Pick<Customer, 'id' | 'full_name' | 'phone_number'> })[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/kyc/submissions/pending?${params.toString()}`);
}

export async function approveKYC(submissionId: string, customerId: string, adminId: string) {
  return fetchAPI<void>(`/api/v1/kyc/submissions/${submissionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, admin_id: adminId }),
  });
}

export async function rejectKYC(submissionId: string, customerId: string, adminId: string, reason: string) {
  return fetchAPI<void>(`/api/v1/kyc/submissions/${submissionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, admin_id: adminId, reason }),
  });
}

// --- Customer Notes ---

export async function addCustomerNote(
  customerId: string,
  noteType: string,
  noteText: string,
  adminId: string
) {
  return fetchAPI<{ id: string; customer_id: string; note_type: string; note_text: string; created_by: string; created_at: string }>(
    `/api/v1/customers/${customerId}/notes`,
    {
      method: 'POST',
      body: JSON.stringify({ note_type: noteType, note_text: noteText, admin_id: adminId }),
    }
  );
}
