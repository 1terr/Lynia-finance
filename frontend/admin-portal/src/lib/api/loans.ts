import { createClient } from '@/lib/supabase/client';
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
  const { status, search, page = 1, limit = 25 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('loans')
    .select('*, customer:customers(id, full_name, phone_number, kyc_status), device:devices(id, device_brand, device_model, device_imei)', { count: 'exact' });

  if (status) {
    query = query.eq('loan_status', status);
  }

  if (search) {
    query = query.or(`id.ilike.%${search}%,customer.full_name.ilike.%${search}%`);
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
      loan_status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', loanId)
    .eq('loan_status', 'pending');

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
      loan_status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', loanId)
    .eq('loan_status', 'pending');

  if (error) throw error;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'reject',
    entity_type: 'loan',
    entity_id: loanId,
    details: { reason },
  });
}
