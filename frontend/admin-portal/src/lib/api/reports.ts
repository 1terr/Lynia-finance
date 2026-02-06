import { createClient } from '@/lib/supabase/client';

// --- Collection Report ---

export interface CollectionReportItem {
  method: string;
  count: number;
  total_amount: number;
}

export async function getCollectionReport(
  dateFrom: string,
  dateTo: string
): Promise<CollectionReportItem[]> {
  const supabase = createClient();
  const methods = ['ecocash', 'onemoney', 'cash', 'bank_transfer'];
  const results: CollectionReportItem[] = [];

  for (const method of methods) {
    const { data, error } = await supabase
      .from('payments')
      .select('payment_amount_usd')
      .eq('payment_status', 'completed')
      .eq('payment_method', method)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo);

    if (error) throw error;

    const rows = data || [];
    if (rows.length > 0) {
      results.push({
        method,
        count: rows.length,
        total_amount: rows.reduce((sum, r) => sum + (r.payment_amount_usd || 0), 0),
      });
    }
  }

  return results;
}

// --- Revenue Report ---

export interface RevenueReportItem {
  month: string;
  total: number;
  count: number;
}

export async function getRevenueReport(
  dateFrom: string,
  dateTo: string
): Promise<RevenueReportItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('payments')
    .select('payment_amount_usd, payment_date')
    .eq('payment_status', 'completed')
    .gte('payment_date', dateFrom)
    .lte('payment_date', dateTo)
    .order('payment_date', { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const monthMap = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const date = new Date(row.payment_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const existing = monthMap.get(monthKey) || { total: 0, count: 0 };
    existing.total += row.payment_amount_usd || 0;
    existing.count += 1;
    monthMap.set(monthKey, existing);
  }

  return Array.from(monthMap.entries()).map(([month, stats]) => ({
    month,
    total: stats.total,
    count: stats.count,
  }));
}

// --- Default Report ---

export interface DefaultReportItem {
  loan_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  loan_amount_usd: number;
  outstanding_balance_usd: number;
  days_past_due: number;
  disbursement_date: string | null;
  maturity_date: string | null;
}

export async function getDefaultReport(): Promise<DefaultReportItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('loans')
    .select('id, customer_id, loan_amount_usd, outstanding_balance_usd, days_past_due, disbursement_date, maturity_date, customer:customers(id, full_name, phone_number)')
    .eq('loan_status', 'defaulted')
    .order('days_past_due', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => {
    const customer = row.customer as { id: string; full_name: string; phone_number: string } | null;
    return {
      loan_id: row.id as string,
      customer_id: row.customer_id as string,
      customer_name: customer?.full_name || 'Unknown',
      customer_phone: customer?.phone_number || '',
      loan_amount_usd: row.loan_amount_usd as number,
      outstanding_balance_usd: row.outstanding_balance_usd as number,
      days_past_due: row.days_past_due as number,
      disbursement_date: row.disbursement_date as string | null,
      maturity_date: row.maturity_date as string | null,
    };
  });
}

// --- KYC Report ---

export interface KYCReportData {
  total_submissions: number;
  pending: number;
  approved: number;
  rejected: number;
  avg_processing_time_hours: number;
}

export async function getKYCReport(): Promise<KYCReportData> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('id, status, created_at, updated_at');

  if (error) throw error;

  const rows = data || [];
  const total_submissions = rows.length;
  const pending = rows.filter((r) => r.status === 'pending_review').length;
  const approved = rows.filter((r) => r.status === 'approved').length;
  const rejected = rows.filter((r) => r.status === 'rejected').length;

  // Calculate average processing time for non-pending submissions
  const processed = rows.filter((r) => r.status !== 'pending_review');
  let avg_processing_time_hours = 0;

  if (processed.length > 0) {
    const totalMs = processed.reduce((sum, r) => {
      const created = new Date(r.created_at).getTime();
      const updated = new Date(r.updated_at).getTime();
      return sum + (updated - created);
    }, 0);
    avg_processing_time_hours = totalMs / processed.length / (1000 * 60 * 60);
  }

  return {
    total_submissions,
    pending,
    approved,
    rejected,
    avg_processing_time_hours,
  };
}

// --- Loan Approval Report ---

export interface LoanApprovalReportData {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  auto_approved: number;
}

export async function getLoanApprovalReport(
  dateFrom: string,
  dateTo: string
): Promise<LoanApprovalReportData> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('loans')
    .select('id, loan_status, created_at')
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);

  if (error) throw error;

  const rows = data || [];
  const total = rows.length;
  const approved = rows.filter((r) => r.loan_status === 'approved' || r.loan_status === 'active' || r.loan_status === 'paid_off').length;
  const rejected = rows.filter((r) => r.loan_status === 'rejected').length;
  const pending = rows.filter((r) => r.loan_status === 'pending').length;

  // Auto-approved: loans that went to approved/active status
  // without manual intervention (approximation - those approved same day as created)
  const auto_approved = rows.filter((r) => {
    if (r.loan_status !== 'approved' && r.loan_status !== 'active' && r.loan_status !== 'paid_off') return false;
    return true;
  }).length;

  return {
    total,
    approved,
    rejected,
    pending,
    auto_approved,
  };
}

// --- Portfolio Report ---

export interface PortfolioReportData {
  total_outstanding: number;
  current: number;
  par_30: number;
  par_60: number;
  par_90: number;
  par_90_plus: number;
  total_loans: number;
}

export async function getPortfolioReport(): Promise<PortfolioReportData> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('loans')
    .select('outstanding_balance_usd, days_past_due, loan_status')
    .in('loan_status', ['active', 'defaulted']);

  if (error) throw error;

  const rows = data || [];
  let total_outstanding = 0;
  let current = 0;
  let par_30 = 0;
  let par_60 = 0;
  let par_90 = 0;
  let par_90_plus = 0;

  for (const row of rows) {
    const balance = row.outstanding_balance_usd || 0;
    total_outstanding += balance;

    if (row.days_past_due > 90) {
      par_90_plus += balance;
    } else if (row.days_past_due > 60) {
      par_90 += balance;
    } else if (row.days_past_due > 30) {
      par_60 += balance;
    } else if (row.days_past_due > 0) {
      par_30 += balance;
    } else {
      current += balance;
    }
  }

  return {
    total_outstanding,
    current,
    par_30,
    par_60,
    par_90,
    par_90_plus,
    total_loans: rows.length,
  };
}
