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
    totalDisbursed: num(raw.total_disbursed ?? raw.approved),
    totalValue: num(raw.total_disbursed),
    avgLoanSize: num(raw.avg_loan_size),
    approvalRate: num(raw.approval_rate),
    growthPct: 0,
    rows: [],
  };
}

// --- Payment Collection Report (Detailed) ---

export async function fetchPaymentCollectionReport(
  filters: ReportFilters
): Promise<PaymentCollectionSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/collections/detailed?${qs}`);
  return {
    totalExpected: num(raw.total_payments),
    totalCollected: num(raw.total_collected),
    collectionRate: num(raw.collection_rate),
    totalTransactions: num(raw.total_payments),
    failedTransactions: num(raw.failed_count),
    byMethod: [],
    rows: [],
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
    totalSubmissions: total,
    pendingCount: num(raw.pending),
    approvedCount: approved,
    rejectedCount: num(raw.rejected),
    approvalRate: total > 0 ? (approved / total) * 100 : 0,
    avgProcessingTime: num(raw.avg_processing_time_hours),
    rows: [],
    rejectionReasons: [],
  };
}

// --- Device Management Report ---

export async function fetchDeviceManagementReport(
  _filters: ReportFilters
): Promise<DeviceManagementSummary> {
  // Backend handler not yet implemented — return safe defaults
  return {
    totalDevices: 0,
    inStock: 0,
    allocated: 0,
    active: 0,
    locked: 0,
    repossessed: 0,
    lockOperations: 0,
    unlockOperations: 0,
    avgLockDurationHrs: 0,
    rows: [],
  };
}

// --- Customer Acquisition Report ---

export async function fetchCustomerAcquisitionReport(
  filters: ReportFilters
): Promise<CustomerAcquisitionSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/acquisition?${qs}`);
  return {
    newCustomers: num(raw.total_customers),
    completionRate: num(raw.completion_rate),
    avgOnboardingDays: 0,
    costPerAcquisition: 0,
    funnel: [],
    bySource: [],
  };
}

// --- Default Rate Report (Summary) ---

export async function fetchDefaultRateReport(
  filters: ReportFilters
): Promise<DefaultRateSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/defaults/summary?${qs}`);
  return {
    par30: num(raw.par_30),
    par60: num(raw.par_60),
    par90: num(raw.par_90),
    defaultRate: num(raw.default_rate),
    recoveryRate: 0,
    writeOffRate: 0,
    totalOutstanding: num(raw.total_outstanding),
    rows: [],
  };
}

// --- Portfolio Health Report ---

export async function fetchPortfolioHealthReport(
  filters: ReportFilters
): Promise<PortfolioHealthSummary> {
  const qs = buildFilterParams(filters);
  const raw = await fetchAPI<Record<string, unknown>>(`/api/v1/reports/portfolio/health?${qs}`);
  return {
    totalOutstanding: num(raw.total_outstanding),
    totalDisbursed: num(raw.total_disbursed),
    par30: num(raw.par_1_30),
    par60: num(raw.par_31_60),
    par90: num(raw.par_90_plus),
    collectionEfficiency: num(raw.collection_efficiency),
    byStatus: [],
    byTier: [],
    byAge: [],
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
