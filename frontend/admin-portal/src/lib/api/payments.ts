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
