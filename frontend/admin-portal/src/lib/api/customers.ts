import { supabase } from '@/lib/supabase/client';
import type { Customer, CustomerWithRelations } from '@/types/database';

export interface CustomerListParams {
  search?: string;
  status?: 'active' | 'inactive' | 'blocked';
  kyc_status?: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  credit_tier?: number;
  has_active_loan?: boolean;
  page: number;
  limit: number;
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
}

export async function fetchCustomers(
  params: CustomerListParams
): Promise<CustomerListResponse> {
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (params.search) {
    query = query.or(
      `first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,phone_number.ilike.%${params.search}%,national_id.ilike.%${params.search}%`
    );
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.kyc_status) {
    query = query.eq('kyc_status', params.kyc_status);
  }

  if (params.credit_tier) {
    query = query.eq('credit_tier', params.credit_tier);
  }

  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    customers: data || [],
    total: count || 0,
  };
}

export async function fetchCustomerById(
  id: string
): Promise<CustomerWithRelations> {
  const { data, error } = await supabase
    .from('customers')
    .select(
      `
      *,
      kyc_submissions(*),
      loans(*),
      payments(*),
      customer_notes(*)
    `
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as CustomerWithRelations;
}

export async function fetchCreditScoreHistory(customerId: string) {
  const { data, error } = await supabase
    .from('credit_scores')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchCustomerTimeline(customerId: string) {
  const { data, error } = await supabase
    .from('customer_timeline')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function blockCustomer(id: string, reason: string) {
  return updateCustomer(id, { status: 'blocked', blocked_reason: reason });
}

export async function unblockCustomer(id: string) {
  return updateCustomer(id, { status: 'active', blocked_reason: null });
}

export async function addCustomerNote(
  customerId: string,
  noteType: string,
  noteText: string,
  createdBy: string
) {
  const { data, error } = await supabase
    .from('customer_notes')
    .insert({
      customer_id: customerId,
      note_type: noteType,
      note_text: noteText,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function approveKYC(submissionId: string, notes?: string) {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .update({
      status: 'approved',
      verified_at: new Date().toISOString(),
      manual_review_notes: notes || 'Manually approved by admin',
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function rejectKYC(submissionId: string, reason: string) {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason,
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchPendingKYC() {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*, customers(*)')
    .eq('status', 'manual_review')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw error;
  return data || [];
}
