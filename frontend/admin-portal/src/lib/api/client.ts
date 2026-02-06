import { createClient } from '@/lib/supabase/client';
import type { AdminUser, DashboardMetrics, PortfolioAtRisk, DailyTrend, LoansByStatus, RecentActivity } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// --- Admin User ---

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

// --- Dashboard ---

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient();

  const [
    customersResult,
    loansResult,
    devicesResult,
    paymentsResult,
    kycResult,
    newCustomersResult,
  ] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('loans').select('id, loan_status, loan_amount_usd, outstanding_balance_usd, days_past_due'),
    supabase.from('devices').select('id, status, lock_status'),
    supabase.from('payments').select('id, payment_status, payment_amount_usd, payment_date'),
    supabase.from('kyc_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const loans = loansResult.data || [];
  const devices = devicesResult.data || [];
  const payments = paymentsResult.data || [];

  const activeLoans = loans.filter((l) => l.loan_status === 'active');
  const totalDisbursed = loans
    .filter((l) => ['active', 'paid_off', 'defaulted'].includes(l.loan_status))
    .reduce((sum, l) => sum + (l.loan_amount_usd || 0), 0);
  const outstandingBalance = activeLoans.reduce((sum, l) => sum + (l.outstanding_balance_usd || 0), 0);
  const defaultedCount = loans.filter((l) => l.loan_status === 'defaulted').length;
  const completedPayments = payments.filter((p) => p.payment_status === 'completed');
  const totalCollected = completedPayments.reduce((sum, p) => sum + (p.payment_amount_usd || 0), 0);
  const overdueLoans = activeLoans.filter((l) => l.days_past_due > 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyPayments = completedPayments.filter(
    (p) => new Date(p.payment_date) >= monthStart
  );
  const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + (p.payment_amount_usd || 0), 0);

  return {
    total_customers: customersResult.count || 0,
    active_loans: activeLoans.length,
    total_disbursed_usd: totalDisbursed,
    outstanding_balance_usd: outstandingBalance,
    collection_rate: totalDisbursed > 0 ? (totalCollected / totalDisbursed) * 100 : 0,
    default_rate: loans.length > 0 ? (defaultedCount / loans.length) * 100 : 0,
    devices_in_stock: devices.filter((d) => d.status === 'in_stock').length,
    devices_active: devices.filter((d) => d.status === 'active').length,
    devices_locked: devices.filter((d) => d.lock_status === 'locked').length,
    pending_kyc: kycResult.count || 0,
    pending_approvals: loans.filter((l) => l.loan_status === 'pending').length,
    monthly_revenue_usd: monthlyRevenue,
    overdue_payments: overdueLoans.length,
    overdue_amount_usd: overdueLoans.reduce((sum, l) => sum + (l.outstanding_balance_usd || 0), 0),
    new_customers_this_month: newCustomersResult.count || 0,
  };
}

export async function getPortfolioAtRisk(): Promise<PortfolioAtRisk> {
  const supabase = createClient();
  const { data: loans } = await supabase
    .from('loans')
    .select('outstanding_balance_usd, days_past_due')
    .eq('loan_status', 'active')
    .gt('days_past_due', 0);

  const items = loans || [];
  return {
    par_0_30: items.filter((l) => l.days_past_due <= 30).reduce((s, l) => s + l.outstanding_balance_usd, 0),
    par_31_60: items.filter((l) => l.days_past_due > 30 && l.days_past_due <= 60).reduce((s, l) => s + l.outstanding_balance_usd, 0),
    par_61_90: items.filter((l) => l.days_past_due > 60 && l.days_past_due <= 90).reduce((s, l) => s + l.outstanding_balance_usd, 0),
    par_90_plus: items.filter((l) => l.days_past_due > 90).reduce((s, l) => s + l.outstanding_balance_usd, 0),
  };
}

export async function getDailyTrends(days: number = 30): Promise<DailyTrend[]> {
  const supabase = createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [loansResult, paymentsResult, customersResult] = await Promise.all([
    supabase.from('loans').select('loan_amount_usd, disbursement_date').gte('disbursement_date', startDate.toISOString()).not('disbursement_date', 'is', null),
    supabase.from('payments').select('payment_amount_usd, payment_date').eq('payment_status', 'completed').gte('payment_date', startDate.toISOString()),
    supabase.from('customers').select('created_at').gte('created_at', startDate.toISOString()),
  ]);

  const trends: Record<string, DailyTrend> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    trends[key] = { date: key, disbursements: 0, collections: 0, new_customers: 0 };
  }

  (loansResult.data || []).forEach((l) => {
    const key = l.disbursement_date?.slice(0, 10);
    if (key && trends[key]) trends[key].disbursements += l.loan_amount_usd || 0;
  });
  (paymentsResult.data || []).forEach((p) => {
    const key = p.payment_date?.slice(0, 10);
    if (key && trends[key]) trends[key].collections += p.payment_amount_usd || 0;
  });
  (customersResult.data || []).forEach((c) => {
    const key = c.created_at?.slice(0, 10);
    if (key && trends[key]) trends[key].new_customers += 1;
  });

  return Object.values(trends);
}

export async function getLoansByStatus(): Promise<LoansByStatus[]> {
  const supabase = createClient();
  const { data: loans } = await supabase.from('loans').select('loan_status, loan_amount_usd');

  const statusMap = new Map<string, { count: number; total_amount: number }>();
  (loans || []).forEach((l) => {
    const existing = statusMap.get(l.loan_status) || { count: 0, total_amount: 0 };
    existing.count += 1;
    existing.total_amount += l.loan_amount_usd || 0;
    statusMap.set(l.loan_status, existing);
  });

  return Array.from(statusMap.entries()).map(([status, data]) => ({
    status: status as LoansByStatus['status'],
    ...data,
  }));
}

export async function getRecentActivity(limit: number = 20): Promise<RecentActivity[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, details, created_at, admin_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((item) => ({
    id: item.id,
    event_type: item.action,
    description: formatActivityDescription(item.action, item.entity_type, item.details),
    resource_type: item.entity_type,
    resource_id: item.entity_id,
    created_at: item.created_at,
  }));
}

function formatActivityDescription(
  action: string,
  entityType: string,
  details: Record<string, unknown> | null
): string {
  const entity = entityType?.replace('_', ' ') || 'record';
  switch (action) {
    case 'create': return `New ${entity} created`;
    case 'update': return `${capitalize(entity)} updated`;
    case 'approve': return `${capitalize(entity)} approved`;
    case 'reject': return `${capitalize(entity)} rejected`;
    case 'lock': return `Device locked`;
    case 'unlock': return `Device unlocked`;
    case 'login': return `Admin logged in`;
    default: return `${capitalize(action)} on ${entity}`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
