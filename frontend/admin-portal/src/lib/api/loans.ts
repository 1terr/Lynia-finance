import { createClient } from '@/lib/supabase/client';
import { sanitizeSearchInput, MAX_PAGE_SIZE } from '@/lib/utils';
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
  const supabase = createClient();
  const { status, search, page = 1, limit: rawLimit = 25 } = filters;
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('loans')
    .select('*, customer:customers(id, full_name, phone_number, kyc_status), device:devices(id, manufacturer, model, imei)', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    const sanitized = sanitizeSearchInput(search);
    if (sanitized) {
      query = query.or(`id.ilike.%${sanitized}%,customer.full_name.ilike.%${sanitized}%`);
    }
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as LoanWithCustomer[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function getLoanById(id: string): Promise<LoanWithCustomer | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('loans')
    .select('*, customer:customers(*), device:devices(*)')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as LoanWithCustomer;
}

export async function getLoanPayments(loanId: string): Promise<Payment[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .order('payment_date', { ascending: false });

  return (data || []) as Payment[];
}

export async function approveLoan(loanId: string, adminId: string, notes?: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('loans')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', loanId)
    .eq('status', 'pending');

  if (error) throw error;

  // Log audit
  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'approve',
    entity_type: 'loan',
    entity_id: loanId,
    details: { notes },
  });
}

export async function rejectLoan(loanId: string, adminId: string, reason: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('loans')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', loanId)
    .eq('status', 'pending');

  if (error) throw error;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'reject',
    entity_type: 'loan',
    entity_id: loanId,
    details: { reason },
  });
}

export async function getPendingLoans(page = 1, rawLimit = 25) {
  const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
  const supabase = createClient();
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabase
    .from('loans')
    .select('*, customer:customers(id, first_name, last_name, phone_number, kyc_status, credit_score), device:devices(id, manufacturer, model, imei)', { count: 'exact' })
    .in('status', ['pending', 'pending_approval', 'submitted'])
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as LoanWithCustomer[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function getLoanStats() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('loans')
    .select('status');

  if (error) throw error;

  const loans = data || [];
  return {
    pending: loans.filter((l) => ['pending', 'pending_approval', 'submitted'].includes(l.status)).length,
    approved: loans.filter((l) => l.status === 'approved').length,
    active: loans.filter((l) => ['active', 'disbursed'].includes(l.status)).length,
    rejected: loans.filter((l) => l.status === 'rejected').length,
  };
}
