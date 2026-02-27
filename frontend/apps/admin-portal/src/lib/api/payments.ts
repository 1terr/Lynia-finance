import { fetchAPI } from '@lynia/api-client';
import { MAX_PAGE_SIZE } from '@lynia/utils';
import type { Payment, PaymentStatus, PaymentMethod, PaymentType, Customer, Loan } from '@/types';

export interface PaymentFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  type?: PaymentType;
  search?: string;
  date_from?: string;
  date_to?: string;
  reconciled?: boolean;
  page?: number;
  limit?: number;
}

export interface PaymentListParams {
  status?: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_type?: PaymentType;
  search?: string;
  date_from?: string;
  date_to?: string;
  reconciled?: boolean;
  page?: number;
  limit?: number;
}

export type PaymentWithRelations = Omit<Payment, 'customer' | 'loan'> & {
  customer?: Pick<Customer, 'id' | 'full_name' | 'phone_number'>;
  loan?: Pick<Loan, 'id' | 'loan_amount_usd' | 'loan_status'>;
};

export async function getPayments(filters: PaymentFilters = {}) {
  const { status, method, type, search, date_from, date_to, reconciled, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (method) params.set('method', method);
  if (type) params.set('type', type);
  if (search) params.set('search', search);
  if (date_from) params.set('date_from', date_from);
  if (date_to) params.set('date_to', date_to);
  if (reconciled !== undefined) params.set('reconciled', String(reconciled));

  return fetchAPI<{
    data: PaymentWithRelations[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`/api/v1/payments?${params.toString()}`);
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  try {
    return await fetchAPI<Payment>(`/api/v1/payments/${id}`);
  } catch {
    return null;
  }
}

export async function reconcilePayment(paymentId: string, adminId?: string) {
  return fetchAPI<void>(`/api/v1/payments/${paymentId}/reconcile`, {
    method: 'POST',
    body: JSON.stringify({ admin_id: adminId }),
  });
}

export async function retryPayment(paymentId: string, adminId: string) {
  return fetchAPI<void>(`/api/v1/payments/${paymentId}/retry`, {
    method: 'POST',
    body: JSON.stringify({ admin_id: adminId }),
  });
}

export async function confirmPayment(paymentId: string, notes: string) {
  return fetchAPI<Payment>(`/api/v1/payments/${paymentId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function failPayment(paymentId: string, notes: string) {
  return fetchAPI<Payment>(`/api/v1/payments/${paymentId}/fail`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function refundPayment(paymentId: string, notes: string) {
  return fetchAPI<void>(`/api/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export interface PaymentStats {
  total_payments: number;
  total_collected: number;
  pending_count: number;
  failed_count: number;
  unreconciled_count: number;
}

export interface PaymentWithCustomer {
  id: string;
  loan_id: string;
  customer_id: string;
  payment_type: string;
  amount_usd: number;
  currency: string;
  payment_method: string;
  payment_provider: string | null;
  transaction_id: string | null;
  reference_number: string | null;
  status: string;
  confirmed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  principal_amount: number | null;
  interest_amount: number | null;
  penalty_amount: number | null;
  fee_amount: number | null;
  payment_date: string;
  phone_number: string | null;
  payer_name: string | null;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
  } | null;
  loans?: {
    id: string;
    principal: number;
    status: string;
  } | null;
}

export interface PaymentSummary {
  total_confirmed: number;
  total_pending: number;
  total_failed: number;
  total_refunded: number;
  count_confirmed: number;
  count_pending: number;
  count_failed: number;
  count_refunded: number;
}

export interface CollectionItem {
  id: string;
  loan_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  amount_due: number;
  days_overdue: number;
  missed_payments: number;
  last_payment_date: string | null;
  next_payment_date: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export async function fetchUnreconciledPayments(): Promise<PaymentWithCustomer[]> {
  return fetchAPI<PaymentWithCustomer[]>('/api/v1/payments/unreconciled');
}

export async function getOverdueCollections(): Promise<CollectionItem[]> {
  return fetchAPI<CollectionItem[]>('/api/v1/payments/overdue-collections');
}

export async function getPaymentStats(): Promise<PaymentStats> {
  return fetchAPI<PaymentStats>('/api/v1/payments/stats');
}

export async function fetchPaymentSummary(dateFrom?: string, dateTo?: string): Promise<PaymentSummary> {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const query = params.toString();
  return fetchAPI<PaymentSummary>(`/api/v1/payments/summary${query ? `?${query}` : ''}`);
}

export interface RecordManualPaymentInput {
  loan_id: string;
  customer_id: string;
  amount_usd: number;
  payment_method: string;
  payment_type: string;
  reference_number: string;
  payment_date: string;
  notes: string;
}

export async function recordManualPayment(data: RecordManualPaymentInput) {
  return fetchAPI<PaymentWithCustomer>('/api/v1/payments/manual', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── CSV Export ───

export function exportPaymentsToCSV(payments: PaymentWithCustomer[]): string {
  const header = 'Payment ID,Date,Customer,Phone,Amount (USD),Method,Type,Status,Reference,Reconciled';
  const rows = payments.map((p) => {
    const customerName = p.customers
      ? `${p.customers.first_name} ${p.customers.last_name}`
      : p.payer_name ?? '';
    const phone = p.customers?.phone_number ?? p.phone_number ?? '';
    return [
      p.id,
      p.payment_date,
      customerName,
      phone,
      p.amount_usd.toFixed(2),
      p.payment_method ?? '',
      p.payment_type ?? '',
      p.status,
      p.reference_number ?? '',
      p.reconciled ? 'Yes' : 'No',
    ].join(',');
  });
  return [header, ...rows].join('\n');
}
