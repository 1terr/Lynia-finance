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

// --- Loan Disbursement Report ---

export async function fetchLoanDisbursementReport(
  filters: ReportFilters
): Promise<LoanDisbursementSummary> {
  const qs = buildFilterParams(filters);
  return fetchAPI<LoanDisbursementSummary>(`/api/v1/reports/disbursements?${qs}`);
}

// --- Payment Collection Report (Detailed) ---

export async function fetchPaymentCollectionReport(
  filters: ReportFilters
): Promise<PaymentCollectionSummary> {
  const qs = buildFilterParams(filters);
  return fetchAPI<PaymentCollectionSummary>(`/api/v1/reports/collections/detailed?${qs}`);
}

// --- KYC Status Report (Detailed) ---

export async function fetchKycStatusReport(
  filters: ReportFilters
): Promise<KycStatusSummary> {
  const qs = buildFilterParams(filters);
  return fetchAPI<KycStatusSummary>(`/api/v1/reports/kyc/detailed?${qs}`);
}

// --- Device Management Report ---

export async function fetchDeviceManagementReport(
  filters: ReportFilters
): Promise<DeviceManagementSummary> {
  const qs = buildFilterParams(filters);
  return fetchAPI<DeviceManagementSummary>(`/api/v1/reports/devices?${qs}`);
}

// --- Customer Acquisition Report ---

export async function fetchCustomerAcquisitionReport(
  filters: ReportFilters
): Promise<CustomerAcquisitionSummary> {
  const qs = buildFilterParams(filters);
  return fetchAPI<CustomerAcquisitionSummary>(`/api/v1/reports/acquisition?${qs}`);
}

// --- Default Rate Report (Summary) ---

export async function fetchDefaultRateReport(
  filters: ReportFilters
): Promise<DefaultRateSummary> {
  const qs = buildFilterParams(filters);
  return fetchAPI<DefaultRateSummary>(`/api/v1/reports/defaults/summary?${qs}`);
}

// --- Portfolio Health Report ---

export async function fetchPortfolioHealthReport(
  filters: ReportFilters
): Promise<PortfolioHealthSummary> {
  const qs = buildFilterParams(filters);
  return fetchAPI<PortfolioHealthSummary>(`/api/v1/reports/portfolio/health?${qs}`);
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

  return fetchAPI<CollectionReportItem[]>(`/api/v1/reports/collections?${params.toString()}`);
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

  return fetchAPI<RevenueReportItem[]>(`/api/v1/reports/revenue?${params.toString()}`);
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
  return fetchAPI<DefaultReportItem[]>('/api/v1/reports/defaults');
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
  return fetchAPI<KYCReportData>('/api/v1/reports/kyc');
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

  return fetchAPI<LoanApprovalReportData>(`/api/v1/reports/loan-approvals?${params.toString()}`);
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
  return fetchAPI<PortfolioReportData>('/api/v1/reports/portfolio');
}
