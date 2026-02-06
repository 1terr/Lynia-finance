import { supabase } from '@/lib/supabase/client';
import type { Payment } from '@/types/database';

export interface PaymentListParams {
  search?: string;
  status?: 'pending' | 'confirmed' | 'failed' | 'refunded';
  payment_method?: 'ecocash' | 'onemoney' | 'bank_transfer' | 'cash';
  payment_type?: 'deposit' | 'installment' | 'late_fee' | 'early_payoff';
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  reconciled?: boolean;
  page: number;
  limit: number;
}

export interface PaymentListResponse {
  payments: PaymentWithCustomer[];
  total: number;
}

export interface PaymentWithCustomer extends Payment {
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
  };
  loans?: {
    id: string;
    principal: number;
    status: string;
  };
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
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export async function fetchPayments(
  params: PaymentListParams
): Promise<PaymentListResponse> {
  let query = supabase
    .from('payments')
    .select(
      '*, customers!inner(id, first_name, last_name, phone_number), loans(id, principal, status)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (params.search) {
    query = query.or(
      `reference_number.ilike.%${params.search}%,transaction_id.ilike.%${params.search}%,customers.phone_number.ilike.%${params.search}%`
    );
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.payment_method) {
    query = query.eq('payment_method', params.payment_method);
  }

  if (params.payment_type) {
    query = query.eq('payment_type', params.payment_type);
  }

  if (params.date_from) {
    query = query.gte('payment_date', params.date_from);
  }

  if (params.date_to) {
    query = query.lte('payment_date', params.date_to);
  }

  if (params.amount_min !== undefined) {
    query = query.gte('amount_usd', params.amount_min);
  }

  if (params.amount_max !== undefined) {
    query = query.lte('amount_usd', params.amount_max);
  }

  if (params.reconciled !== undefined) {
    query = query.eq('reconciled', params.reconciled);
  }

  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    payments: (data as PaymentWithCustomer[]) || [],
    total: count || 0,
  };
}

export async function fetchPaymentById(
  id: string
): Promise<PaymentWithCustomer> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      '*, customers(id, first_name, last_name, phone_number, email), loans(id, principal, status, term_months, monthly_payment, outstanding_principal)'
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as PaymentWithCustomer;
}

export async function fetchPaymentSummary(
  dateFrom?: string,
  dateTo?: string
): Promise<PaymentSummary> {
  let query = supabase.from('payments').select('status, amount_usd');

  if (dateFrom) query = query.gte('payment_date', dateFrom);
  if (dateTo) query = query.lte('payment_date', dateTo);

  const { data, error } = await query;

  if (error) throw error;

  const summary: PaymentSummary = {
    total_confirmed: 0,
    total_pending: 0,
    total_failed: 0,
    total_refunded: 0,
    count_confirmed: 0,
    count_pending: 0,
    count_failed: 0,
    count_refunded: 0,
  };

  (data || []).forEach((p: { status: string; amount_usd: number }) => {
    switch (p.status) {
      case 'confirmed':
        summary.total_confirmed += p.amount_usd;
        summary.count_confirmed++;
        break;
      case 'pending':
        summary.total_pending += p.amount_usd;
        summary.count_pending++;
        break;
      case 'failed':
        summary.total_failed += p.amount_usd;
        summary.count_failed++;
        break;
      case 'refunded':
        summary.total_refunded += p.amount_usd;
        summary.count_refunded++;
        break;
    }
  });

  return summary;
}

export async function confirmPayment(
  id: string,
  notes?: string
): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      notes: notes || 'Manually confirmed by admin',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function failPayment(
  id: string,
  reason: string
): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: reason,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function refundPayment(
  id: string,
  notes: string
): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'refunded',
      notes,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function reconcilePayment(id: string): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update({
      reconciled: true,
      reconciled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchUnreconciledPayments(): Promise<
  PaymentWithCustomer[]
> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      '*, customers(id, first_name, last_name, phone_number), loans(id, principal, status)'
    )
    .eq('status', 'confirmed')
    .eq('reconciled', false)
    .order('payment_date', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as PaymentWithCustomer[]) || [];
}

export async function fetchCollectionsQueue(): Promise<CollectionItem[]> {
  const { data, error } = await supabase
    .from('loans')
    .select(
      'id, customer_id, monthly_payment, days_overdue, missed_payments, last_payment_date, next_payment_date, customers(first_name, last_name, phone_number)'
    )
    .eq('status', 'active')
    .gt('days_overdue', 0)
    .order('days_overdue', { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data || []).map((loan: any) => ({
    id: loan.id,
    loan_id: loan.id,
    customer_id: loan.customer_id,
    customer_name: `${loan.customers?.first_name || ''} ${loan.customers?.last_name || ''}`.trim(),
    customer_phone: loan.customers?.phone_number || '',
    amount_due: loan.monthly_payment * loan.missed_payments,
    days_overdue: loan.days_overdue,
    missed_payments: loan.missed_payments,
    last_payment_date: loan.last_payment_date,
    next_payment_date: loan.next_payment_date,
    priority: getPriority(loan.days_overdue),
  }));
}

function getPriority(
  daysOverdue: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (daysOverdue >= 60) return 'critical';
  if (daysOverdue >= 30) return 'high';
  if (daysOverdue >= 14) return 'medium';
  return 'low';
}

export async function recordManualPayment(payment: {
  loan_id: string;
  customer_id: string;
  amount_usd: number;
  payment_method: string;
  payment_type: string;
  reference_number: string;
  payment_date: string;
  notes?: string;
}): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      ...payment,
      currency: 'USD',
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function exportPaymentsToCSV(payments: PaymentWithCustomer[]): string {
  const headers = [
    'Payment ID',
    'Date',
    'Customer',
    'Phone',
    'Amount (USD)',
    'Type',
    'Method',
    'Status',
    'Reference',
    'Reconciled',
  ];

  const rows = payments.map((p) => [
    p.id,
    p.payment_date,
    p.customers
      ? `${p.customers.first_name} ${p.customers.last_name}`
      : '',
    p.customers?.phone_number || '',
    p.amount_usd.toFixed(2),
    p.payment_type,
    p.payment_method,
    p.status,
    p.reference_number || p.transaction_id || '',
    p.reconciled ? 'Yes' : 'No',
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}
