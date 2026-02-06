export type ReportType =
  | 'loan_disbursement'
  | 'payment_collection'
  | 'default_rate'
  | 'kyc_status'
  | 'device_management'
  | 'customer_acquisition'
  | 'portfolio_health';

export type DatePreset = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'custom';

export type ExportFormat = 'csv' | 'pdf';

export interface DateRange {
  from: string; // ISO date
  to: string;   // ISO date
  preset?: DatePreset;
}

export interface ReportFilters {
  dateRange: DateRange;
  product?: string;
  distributor?: string;
  status?: string;
  tier?: string;
  paymentMethod?: string;
}

export interface ReportMeta {
  type: ReportType;
  title: string;
  description: string;
  icon: string;
  color: string;
}

// --- Loan Disbursement Report ---
export interface LoanDisbursementRow {
  date: string;
  count: number;
  totalValue: number;
  avgAmount: number;
  approvalRate: number;
  product: string;
}

export interface LoanDisbursementSummary {
  totalDisbursed: number;
  totalValue: number;
  avgLoanSize: number;
  approvalRate: number;
  growthPct: number;
  rows: LoanDisbursementRow[];
}

// --- Payment Collection Report ---
export interface PaymentCollectionRow {
  date: string;
  expected: number;
  actual: number;
  collectionRate: number;
  txnCount: number;
  failedCount: number;
  method: string;
}

export interface PaymentCollectionSummary {
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
  totalTransactions: number;
  failedTransactions: number;
  byMethod: { method: string; amount: number; count: number }[];
  rows: PaymentCollectionRow[];
}

// --- Default Rate / PAR Report ---
export interface DefaultRateRow {
  bucket: string; // '1-30', '31-60', '61-90', '90+'
  loanCount: number;
  outstandingBalance: number;
  parPct: number;
}

export interface DefaultRateSummary {
  par30: number;
  par60: number;
  par90: number;
  defaultRate: number;
  recoveryRate: number;
  writeOffRate: number;
  totalOutstanding: number;
  rows: DefaultRateRow[];
}

// --- KYC Status Report ---
export interface KycStatusRow {
  status: string;
  count: number;
  pct: number;
  avgProcessingMins: number;
}

export interface KycStatusSummary {
  totalSubmissions: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  avgProcessingTime: number;
  rows: KycStatusRow[];
  rejectionReasons: { reason: string; count: number }[];
}

// --- Device Management Report ---
export interface DeviceManagementRow {
  status: string;
  count: number;
  pct: number;
}

export interface DeviceManagementSummary {
  totalDevices: number;
  inStock: number;
  allocated: number;
  active: number;
  locked: number;
  repossessed: number;
  lockOperations: number;
  unlockOperations: number;
  avgLockDurationHrs: number;
  rows: DeviceManagementRow[];
}

// --- Customer Acquisition Report ---
export interface AcquisitionFunnelStep {
  stage: string;
  count: number;
  conversionRate: number;
}

export interface CustomerAcquisitionSummary {
  newCustomers: number;
  completionRate: number;
  avgOnboardingDays: number;
  costPerAcquisition: number;
  funnel: AcquisitionFunnelStep[];
  bySource: { source: string; count: number; pct: number }[];
}

// --- Portfolio Health Report ---
export interface PortfolioComposition {
  category: string;
  value: number;
  pct: number;
}

export interface PortfolioHealthSummary {
  totalOutstanding: number;
  totalDisbursed: number;
  par30: number;
  par60: number;
  par90: number;
  collectionEfficiency: number;
  byStatus: PortfolioComposition[];
  byTier: PortfolioComposition[];
  byAge: PortfolioComposition[];
}
