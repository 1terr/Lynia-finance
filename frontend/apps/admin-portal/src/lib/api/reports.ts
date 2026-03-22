import { fetchAPI } from '@lynia/api-client';
import type {
  ReportFilters,
  LoanDisbursementSummary,
  PaymentCollectionSummary,
  KycStatusSummary,
  DeviceManagementSummary,
  CustomerAcquisitionSummary,
  DefaultRateSummary,
  PortfolioHealthSummary,
} from '@/types/reports';

// --- Helper to build query params from ReportFilters ---

function buildFilterParams(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.dateRange?.from) params.set('date_from', filters.dateRange.from);
  if (filters.dateRange?.to) params.set('date_to', filters.dateRange.to);
  if (filters.product) params.set('product', filters.product);
  if (filters.distributor) params.set('distributor', filters.distributor);
  if (filters.status) params.set('status', filters.status);
  if (filters.tier) params.set('tier', filters.tier);
  if (filters.paymentMethod) params.set('payment_method', filters.paymentMethod);
  return params.toString();
}

/** Safe number coercion — returns 0 for undefined/null/NaN */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// --- Loan Disbursement Report ---

export async function fetchLoanDisbursementReport(
  filters: ReportFilters
): Promise<LoanDisbursementSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/disbursements?${qs}`);
  return {
    totalDisbursed: num(raw.total_disbursed ?? raw.totalDisbursed ?? raw.approved),
    totalValue: num(raw.total_value ?? raw.totalValue ?? raw.total_disbursed ?? raw.totalDisbursed),
    avgLoanSize: num(raw.avg_loan_size ?? raw.avgLoanSize),
    approvalRate: num(raw.approval_rate ?? raw.approvalRate),
    growthPct: 0,
    rows: Array.isArray(raw.rows) ? raw.rows as LoanDisbursementSummary['rows'] : [],
  };
}

// --- Payment Collection Report (Detailed) ---

export async function fetchPaymentCollectionReport(
  filters: ReportFilters
): Promise<PaymentCollectionSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/collections/detailed?${qs}`);
  return {
    totalExpected: num(raw.total_payments ?? raw.totalExpected),
    totalCollected: num(raw.total_collected ?? raw.totalCollected),
    collectionRate: num(raw.collection_rate ?? raw.collectionRate),
    totalTransactions: num(raw.total_payments),
    failedTransactions: num(raw.failed_count),
    byMethod: Array.isArray(raw.byMethod) ? raw.byMethod as PaymentCollectionSummary['byMethod'] : [],
    rows: Array.isArray(raw.rows) ? raw.rows as PaymentCollectionSummary['rows'] : [],
  };
}

// --- KYC Status Report (Detailed) ---

export async function fetchKycStatusReport(
  filters: ReportFilters
): Promise<KycStatusSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/kyc/detailed?${qs}`);
  const total = num(raw.total_submissions);
  const approved = num(raw.approved);
  return {
    totalSubmissions: total || num(raw.totalSubmissions),
    pendingCount: num(raw.pending ?? raw.pendingCount),
    approvedCount: approved || num(raw.approvedCount),
    rejectedCount: num(raw.rejected ?? raw.rejectedCount),
    approvalRate: total > 0 ? (approved / total) * 100 : 0,
    avgProcessingTime: num(raw.avg_processing_time_hours),
    rows: Array.isArray(raw.rows) ? raw.rows as KycStatusSummary['rows'] : [],
    rejectionReasons: Array.isArray(raw.rejectionReasons) ? raw.rejectionReasons as KycStatusSummary['rejectionReasons'] : [],
  };
}

// --- Device Management Report ---

export async function fetchDeviceManagementReport(
  filters: ReportFilters
): Promise<DeviceManagementSummary> {
  const qs = buildFilterParams(filters);
  try {
    const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/devices?${qs}`);
    return {
      totalDevices: num(raw.total_devices ?? raw.totalDevices),
      inStock: num(raw.in_stock ?? raw.inStock),
      allocated: num(raw.allocated),
      active: num(raw.active),
      locked: num(raw.locked),
      repossessed: num(raw.repossessed),
      lockOperations: num(raw.lock_operations ?? raw.lockOperations),
      unlockOperations: num(raw.unlock_operations ?? raw.unlockOperations),
      avgLockDurationHrs: num(raw.avg_lock_duration_hrs ?? raw.avgLockDurationHrs),
      rows: Array.isArray(raw.rows) ? raw.rows as DeviceManagementSummary['rows'] : [],
    };
  } catch {
    // Backend handler may not be implemented yet — return safe defaults
    return {
      totalDevices: 0, inStock: 0, allocated: 0, active: 0, locked: 0, repossessed: 0,
      lockOperations: 0, unlockOperations: 0, avgLockDurationHrs: 0, rows: [],
    };
  }
}

// --- Customer Acquisition Report ---

export async function fetchCustomerAcquisitionReport(
  filters: ReportFilters
): Promise<CustomerAcquisitionSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/acquisition?${qs}`);
  return {
    newCustomers: num(raw.total_customers ?? raw.newCustomers),
    completionRate: num(raw.completion_rate),
    avgOnboardingDays: 0,
    costPerAcquisition: 0,
    funnel: Array.isArray(raw.funnel) ? raw.funnel as CustomerAcquisitionSummary['funnel'] : [],
    bySource: Array.isArray(raw.bySource) ? raw.bySource as CustomerAcquisitionSummary['bySource'] : [],
  };
}

// --- Default Rate Report (Summary) ---

export async function fetchDefaultRateReport(
  filters: ReportFilters
): Promise<DefaultRateSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/defaults/summary?${qs}`);
  return {
    par30: num(raw.par_30 ?? raw.par30),
    par60: num(raw.par_60),
    par90: num(raw.par_90),
    defaultRate: num(raw.default_rate),
    recoveryRate: 0,
    writeOffRate: 0,
    totalOutstanding: num(raw.total_outstanding ?? raw.totalOutstanding),
    rows: Array.isArray(raw.rows) ? raw.rows as DefaultRateSummary['rows'] : [],
  };
}

// --- Portfolio Health Report ---

export async function fetchPortfolioHealthReport(
  filters: ReportFilters
): Promise<PortfolioHealthSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/portfolio/health?${qs}`);
  return {
    totalOutstanding: num(raw.total_outstanding ?? raw.totalOutstanding),
    totalDisbursed: num(raw.total_disbursed),
    par30: num(raw.par_1_30),
    par60: num(raw.par_31_60),
    par90: num(raw.par_90_plus),
    collectionEfficiency: num(raw.collection_efficiency),
    byStatus: Array.isArray(raw.byStatus) ? raw.byStatus as PortfolioHealthSummary['byStatus'] : [],
    byTier: Array.isArray(raw.byTier) ? raw.byTier as PortfolioHealthSummary['byTier'] : [],
    byAge: Array.isArray(raw.byAge) ? raw.byAge as PortfolioHealthSummary['byAge'] : [],
  };
}

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
  const params = new URLSearchParams();
  params.set('date_from', dateFrom);
  params.set('date_to', dateTo);

  const raw = await fetchAPI<Record<string, unknown>[]>(`/api/v1/reports/collections?${params.toString()}`);
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    method: String(r.method ?? ''),
    count: num(r.count),
    total_amount: num(r.total_amount),
  }));
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
  const params = new URLSearchParams();
  params.set('date_from', dateFrom);
  params.set('date_to', dateTo);

  const raw = await fetchAPI<Record<string, unknown>[]>(`/api/v1/reports/revenue?${params.toString()}`);
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    month: String(r.month ?? ''),
    total: num(r.total),
    count: num(r.count),
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
  const raw = await fetchAPI<Record<string, unknown>[]>('/api/v1/reports/defaults');
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    loan_id: String(r.loan_id ?? ''),
    customer_id: String(r.customer_id ?? ''),
    customer_name: String(r.customer_name ?? ''),
    customer_phone: String(r.customer_phone ?? ''),
    loan_amount_usd: num(r.loan_amount_usd),
    outstanding_balance_usd: num(r.outstanding_balance_usd),
    days_past_due: num(r.days_past_due),
    disbursement_date: r.disbursement_date ? String(r.disbursement_date) : null,
    maturity_date: r.maturity_date ? String(r.maturity_date) : null,
  }));
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
  const raw = await fetchAPI<Record<string, unknown>>('/api/v1/reports/kyc');
  return {
    total_submissions: num(raw.total_submissions),
    pending: num(raw.pending),
    approved: num(raw.approved),
    rejected: num(raw.rejected),
    avg_processing_time_hours: num(raw.avg_processing_time_hours),
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
  const params = new URLSearchParams();
  params.set('date_from', dateFrom);
  params.set('date_to', dateTo);

  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/loan-approvals?${params.toString()}`);
  return {
    total: num(raw.total),
    approved: num(raw.approved),
    rejected: num(raw.rejected),
    pending: num(raw.pending),
    auto_approved: num(raw.auto_approved),
  };
}

// --- Commission Overview Report ---

export interface CommissionDistributor {
  id: string;
  business_name: string;
  location: string;
  handover_count: number;
  total_earned: number;
  total_paid: number;
  total_pending: number;
}

export interface CommissionOverviewData {
  summary: {
    total_earned: number;
    total_paid: number;
    total_pending: number;
    distributor_count: number;
    total_handovers: number;
  };
  distributors: CommissionDistributor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getCommissionOverview(params: {
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}): Promise<CommissionOverviewData> {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  const raw = await fetchAPI<Record<string, unknown>>(
    `/api/v1/reports/commissions/overview?${qs.toString()}`
  );

  const summary = (raw.summary ?? {}) as Record<string, unknown>;
  const pagination = (raw.pagination ?? {}) as Record<string, unknown>;
  const distributors = Array.isArray(raw.distributors) ? raw.distributors : [];

  return {
    summary: {
      total_earned: num(summary.total_earned),
      total_paid: num(summary.total_paid),
      total_pending: num(summary.total_pending),
      distributor_count: num(summary.distributor_count),
      total_handovers: num(summary.total_handovers),
    },
    distributors: distributors.map((d: Record<string, unknown>) => ({
      id: String(d.id ?? ''),
      business_name: String(d.business_name ?? ''),
      location: String(d.location ?? ''),
      handover_count: num(d.handover_count),
      total_earned: num(d.total_earned),
      total_paid: num(d.total_paid),
      total_pending: num(d.total_pending),
    })),
    pagination: {
      page: num(pagination.page),
      limit: num(pagination.limit),
      total: num(pagination.total),
      totalPages: num(pagination.totalPages),
    },
  };
}

// --- Distributor Performance Report ---

export interface DistributorRanking {
  rank: number;
  distributor_id: string;
  business_name: string;
  contact_person: string;
  location: string;
  status: string;
  handover_count: number;
  total_commission: number;
}

export interface DistributorPerformanceData {
  summary: {
    total_distributors: number;
    total_handovers: number;
    total_commissions: number;
    avg_handovers_per_distributor: number;
  };
  rankings: DistributorRanking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getDistributorPerformance(params: {
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'handovers' | 'commissions';
}): Promise<DistributorPerformanceData> {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.sort_by) qs.set('sort_by', params.sort_by);

  const raw = await fetchAPI<Record<string, unknown>>(
    `/api/v1/reports/distributor-performance/rankings?${qs.toString()}`
  );

  const summary = (raw.summary ?? {}) as Record<string, unknown>;
  const pagination = (raw.pagination ?? {}) as Record<string, unknown>;
  const rankings = Array.isArray(raw.rankings) ? raw.rankings : [];

  return {
    summary: {
      total_distributors: num(summary.total_distributors),
      total_handovers: num(summary.total_handovers),
      total_commissions: num(summary.total_commissions),
      avg_handovers_per_distributor: num(summary.avg_handovers_per_distributor),
    },
    rankings: rankings.map((r: Record<string, unknown>) => ({
      rank: num(r.rank),
      distributor_id: String(r.distributor_id ?? ''),
      business_name: String(r.business_name ?? ''),
      contact_person: String(r.contact_person ?? ''),
      location: String(r.location ?? ''),
      status: String(r.status ?? 'active'),
      handover_count: num(r.handover_count),
      total_commission: num(r.total_commission),
    })),
    pagination: {
      page: num(pagination.page),
      limit: num(pagination.limit),
      total: num(pagination.total),
      totalPages: num(pagination.totalPages),
    },
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
  const raw = await fetchAPI<Record<string, unknown>>('/api/v1/reports/portfolio');
  return {
    total_outstanding: num(raw.total_outstanding),
    current: num(raw.current),
    par_30: num(raw.par_30),
    par_60: num(raw.par_60),
    par_90: num(raw.par_90),
    par_90_plus: num(raw.par_90_plus),
    total_loans: num(raw.total_loans),
  };
}

// --- Device-Loan Chain Report ---

export interface DeviceLoanChainRow {
  device_id: string;
  imei: string;
  manufacturer: string;
  model: string;
  lock_status: string;
  device_status: string;
  customer_id: string | null;
  customer_name: string | null;
  phone_number: string | null;
  national_id: string | null;
  loan_id: string | null;
  loan_number: string | null;
  loan_status: string | null;
  loan_amount_usd: number | null;
  outstanding_balance_usd: number | null;
  days_past_due: number;
  last_payment_date: string | null;
  last_payment_status: string | null;
  device_created_at: string;
}

export interface DeviceLoanChainResponse {
  data: DeviceLoanChainRow[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  view: 'collections' | 'audit';
  generated_at: string;
}

export interface DeviceLoanChainFilters {
  view?: 'collections' | 'audit';
  search?: string;
  lock_status?: string;
  loan_status?: string;
  dpd_min?: number;
  dpd_max?: number;
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
  export?: 'csv';
}

export async function getDeviceLoanChain(
  filters: DeviceLoanChainFilters = {}
): Promise<DeviceLoanChainResponse> {
  const qs = new URLSearchParams();
  if (filters.view) qs.set('view', filters.view);
  if (filters.search) qs.set('search', filters.search);
  if (filters.lock_status) qs.set('lock_status', filters.lock_status);
  if (filters.loan_status) qs.set('loan_status', filters.loan_status);
  if (filters.dpd_min !== undefined) qs.set('dpd_min', String(filters.dpd_min));
  if (filters.dpd_max !== undefined) qs.set('dpd_max', String(filters.dpd_max));
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.limit) qs.set('limit', String(filters.limit));
  if (filters.date_from) qs.set('date_from', filters.date_from);
  if (filters.date_to) qs.set('date_to', filters.date_to);

  const raw = await fetchAPI<Record<string, unknown>>(
    `/api/v1/reports/device-loan-chain?${qs.toString()}`
  );

  return {
    data: Array.isArray(raw.data)
      ? (raw.data as DeviceLoanChainRow[]).map((r) => ({
          ...r,
          days_past_due: num(r.days_past_due),
          loan_amount_usd: r.loan_amount_usd !== null ? num(r.loan_amount_usd) : null,
          outstanding_balance_usd: r.outstanding_balance_usd !== null ? num(r.outstanding_balance_usd) : null,
        }))
      : [],
    total: num(raw.total),
    page: num(raw.page),
    limit: num(raw.limit),
    total_pages: num(raw.total_pages),
    view: (raw.view as 'collections' | 'audit') || 'audit',
    generated_at: String(raw.generated_at ?? ''),
  };
}

// --- Lock Effectiveness Report ---

export interface LockEffectivenessSummary {
  total_locks: number;
  paid_within_48h: number;
  paid_within_7d: number;
  paid_within_30d: number;
  paid_eventually: number;
  avg_hours_to_payment: number | null;
}

export interface LockEffectivenessTrend {
  month: string;
  total_locks: number;
  paid_within_30d: number;
  conversion_rate: number;
}

export interface LockEffectivenessResponse {
  summary: LockEffectivenessSummary;
  trend: LockEffectivenessTrend[];
  date_from: string;
  date_to: string;
  generated_at: string;
}

export async function getLockEffectiveness(params: {
  date_from?: string;
  date_to?: string;
}): Promise<LockEffectivenessResponse> {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);

  const raw = await fetchAPI<Record<string, unknown>>(
    `/api/v1/reports/lock-effectiveness?${qs.toString()}`
  );

  const summary = (raw.summary ?? {}) as Record<string, unknown>;
  const trend = Array.isArray(raw.trend) ? raw.trend : [];

  return {
    summary: {
      total_locks: num(summary.total_locks),
      paid_within_48h: num(summary.paid_within_48h),
      paid_within_7d: num(summary.paid_within_7d),
      paid_within_30d: num(summary.paid_within_30d),
      paid_eventually: num(summary.paid_eventually),
      avg_hours_to_payment: summary.avg_hours_to_payment !== null && summary.avg_hours_to_payment !== undefined
        ? num(summary.avg_hours_to_payment)
        : null,
    },
    trend: trend.map((t: Record<string, unknown>) => ({
      month: String(t.month ?? ''),
      total_locks: num(t.total_locks),
      paid_within_30d: num(t.paid_within_30d),
      conversion_rate: num(t.conversion_rate),
    })),
    date_from: String(raw.date_from ?? ''),
    date_to: String(raw.date_to ?? ''),
    generated_at: String(raw.generated_at ?? ''),
  };
}

/** Trigger CSV export for device-loan chain — returns the download URL */
export function getDeviceLoanChainExportUrl(
  filters: Omit<DeviceLoanChainFilters, 'page' | 'limit'>
): string {
  const qs = new URLSearchParams();
  if (filters.view) qs.set('view', filters.view);
  if (filters.search) qs.set('search', filters.search);
  if (filters.lock_status) qs.set('lock_status', filters.lock_status);
  if (filters.loan_status) qs.set('loan_status', filters.loan_status);
  if (filters.dpd_min !== undefined) qs.set('dpd_min', String(filters.dpd_min));
  if (filters.dpd_max !== undefined) qs.set('dpd_max', String(filters.dpd_max));
  if (filters.date_from) qs.set('date_from', filters.date_from);
  if (filters.date_to) qs.set('date_to', filters.date_to);
  qs.set('export', 'csv');
  qs.set('limit', '10000');
  return `/api/v1/reports/device-loan-chain?${qs.toString()}`;
}
