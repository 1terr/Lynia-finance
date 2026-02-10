import { createClient } from '@/lib/supabase/client';
import type { Customer, CustomerStatus, KYCStatus, Loan, Payment, CreditScore, KYCSubmission } from '@/types';

export interface CustomerFilters {
  status?: CustomerStatus;
  kyc_status?: KYCStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getCustomers(filters: CustomerFilters = {}) {
  const supabase = createClient();
  const { status, kyc_status, search, page = 1, limit = 25 } = filters;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (kyc_status) query = query.eq('kyc_status', kyc_status);
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as Customer[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Customer;
}

export const fetchCustomerById = getCustomerById;

export async function updateCustomer(id: string, updates: Partial<Customer>) {
  const supabase = createClient();
  const { error } = await supabase
    .from('customers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function getCustomerLoans(customerId: string): Promise<Loan[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('loans')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  return (data || []) as Loan[];
}

export async function getCustomerPayments(customerId: string): Promise<Payment[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('payments')
    .select('*, loan:loans(id, loan_amount_usd, loan_status)')
    .eq('customer_id', customerId)
    .order('payment_date', { ascending: false });

  return (data || []) as Payment[];
}

export async function getCustomerCreditScore(customerId: string): Promise<CreditScore | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('credit_scores')
    .select('*')
    .eq('customer_id', customerId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  return data as CreditScore | null;
}

export async function getCustomerKYC(customerId: string): Promise<KYCSubmission[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  return (data || []) as KYCSubmission[];
}

export async function getCustomerTimeline(customerId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

export async function updateCustomerStatus(customerId: string, status: CustomerStatus, adminId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('customers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', customerId);

  if (error) throw error;

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'update',
    entity_type: 'customer',
    entity_id: customerId,
    details: { status },
  });
}

// --- KYC Review ---

export async function getKYCPendingReview(page = 1, limit = 25) {
  const supabase = createClient();
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabase
    .from('kyc_submissions')
    .select('*, customer:customers(id, full_name, phone_number)', { count: 'exact' })
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: (data || []) as (KYCSubmission & { customer: Pick<Customer, 'id' | 'full_name' | 'phone_number'> })[],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  };
}

export async function approveKYC(submissionId: string, customerId: string, adminId: string) {
  const supabase = createClient();

  const { error: kycError } = await supabase
    .from('kyc_submissions')
    .update({ status: 'approved' })
    .eq('id', submissionId);

  if (kycError) throw kycError;

  await supabase
    .from('customers')
    .update({ kyc_status: 'verified', updated_at: new Date().toISOString() })
    .eq('id', customerId);

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'approve',
    entity_type: 'kyc_submission',
    entity_id: submissionId,
    details: { customer_id: customerId },
  });
}

export async function rejectKYC(submissionId: string, customerId: string, adminId: string, reason: string) {
  const supabase = createClient();

  const { error: kycError } = await supabase
    .from('kyc_submissions')
    .update({ status: 'rejected' })
    .eq('id', submissionId);

  if (kycError) throw kycError;

  await supabase
    .from('customers')
    .update({ kyc_status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', customerId);

  await supabase.from('audit_log').insert({
    admin_id: adminId,
    action: 'reject',
    entity_type: 'kyc_submission',
    entity_id: submissionId,
    details: { customer_id: customerId, reason },
  });
}
