import { fetchAPI } from '@/lib/api/client';

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
