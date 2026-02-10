import { createClient } from '@/lib/supabase/client';
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

export type PaymentWithRelations = Omit<Payment, 'customer' | 'loan'> & {
  customer?: Pick<Customer, 'id' | 'full_name' | 'phone_number'>;
  loan?: Pick<Loan, 'id' | 'loan_amount_usd' | 'loan_status'>;
};

export async function getPayments(filters: PaymentFilters = {}) {
  const supabase = createClient();
  const { status, method, type, search, date_from, date_to, reconciled, page = 1, limit = 25 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('payments')
    .select('*, customer:customers(id, full_name, phone_number), loan:loans(id, loan_amount_usd, loan_status)', { count: 'exact' });

  if (status) {
    query = query.eq('payment_status', status);
  }

  if (method) {
    query = query.eq('payment_method', method);
  }

  if (type) {
    query = query.eq('payment_type', type);
  }

  if (search) {
    query = query.or(`reference_number.ilike.%${search}%,transaction_reference.ilike.%${search}%`);
  }

  if (date_from) {
    query = query.gte('payment_date', date_from);
  }

  if (date_to) {
    query = query.lte('payment_date', date_to);
  }

  if (reconciled !== undefined) {
    query = query.eq('reconciled', reconciled);
  }

  const { data, count, error } = await query
    .order('payment_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as PaymentWithRelations[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*, customer:customers(*), loan:loans(*)')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Payment;
}

export async function reconcilePayment(paymentId: string, adminId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('payments')
    .update({
      reconciled: true,
      reconciled_at: new Date().toISOString(),
      reconciled_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (error) throw error;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'reconcile',
    entity_type: 'payment',
    entity_id: paymentId,
    details: { reconciled: true },
  });
}

export async function retryPayment(paymentId: string, adminId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('payments')
    .update({
      payment_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (error) throw error;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'retry',
    entity_type: 'payment',
    entity_id: paymentId,
    details: { payment_status: 'pending' },
  });
}

export async function refundPayment(paymentId: string, adminId: string, reason: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('payments')
    .update({
      payment_status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (error) throw error;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'refund',
    entity_type: 'payment',
    entity_id: paymentId,
    details: { reason },
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
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*, customers(id, first_name, last_name, phone_number), loans(id, principal, status)')
    .eq('status', 'confirmed')
    .eq('reconciled', false)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return (data || []) as PaymentWithCustomer[];
}

export async function getOverdueCollections(): Promise<CollectionItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('loans')
    .select('id, customer_id, outstanding_principal, outstanding_interest, days_overdue, missed_payments, last_payment_date, next_payment_date, customer:customers(id, first_name, last_name, phone_number)')
    .gt('days_overdue', 0)
    .in('status', ['active', 'disbursed'])
    .order('days_overdue', { ascending: false });

  if (error) throw error;

  return (data || []).map((loan: Record<string, unknown>) => {
    const customer = Array.isArray(loan.customer) ? loan.customer[0] : loan.customer;
    const daysOverdue = loan.days_overdue as number;
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (daysOverdue >= 60) priority = 'critical';
    else if (daysOverdue >= 30) priority = 'high';
    else if (daysOverdue >= 15) priority = 'medium';

    return {
      id: loan.id as string,
      loan_id: loan.id as string,
      customer_id: loan.customer_id as string,
      customer_name: customer ? `${(customer as Record<string, string>).first_name} ${(customer as Record<string, string>).last_name}` : 'Unknown',
      customer_phone: customer ? (customer as Record<string, string>).phone_number : '',
      amount_due: ((loan.outstanding_principal as number) || 0) + ((loan.outstanding_interest as number) || 0),
      days_overdue: daysOverdue,
      missed_payments: (loan.missed_payments as number) || 0,
      last_payment_date: loan.last_payment_date as string | null,
      next_payment_date: loan.next_payment_date as string | null,
      priority,
    };
  });
}

export async function getPaymentStats(): Promise<PaymentStats> {
  const supabase = createClient();

  const [totalResult, completedResult, pendingResult, failedResult, unreconciledResult] = await Promise.all([
    supabase.from('payments').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('payment_amount_usd').eq('payment_status', 'completed'),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('payment_status', 'pending'),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('payment_status', 'failed'),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('reconciled', false),
  ]);

  const totalCollected = (completedResult.data || []).reduce(
    (sum, p) => sum + (p.payment_amount_usd || 0),
    0
  );

  return {
    total_payments: totalResult.count || 0,
    total_collected: totalCollected,
    pending_count: pendingResult.count || 0,
    failed_count: failedResult.count || 0,
    unreconciled_count: unreconciledResult.count || 0,
  };
}
