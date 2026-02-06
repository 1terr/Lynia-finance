import type {
  ReportFilters,
  LoanDisbursementSummary,
  PaymentCollectionSummary,
  DefaultRateSummary,
  KycStatusSummary,
  DeviceManagementSummary,
  CustomerAcquisitionSummary,
  PortfolioHealthSummary,
} from '@/types/reports';

// Simulated API delay
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchLoanDisbursementReport(
  _filters: ReportFilters
): Promise<LoanDisbursementSummary> {
  await delay(600);
  return {
    totalDisbursed: 47,
    totalValue: 18_400,
    avgLoanSize: 391.49,
    approvalRate: 78.3,
    growthPct: 12.5,
    rows: [
      { date: '2026-01-01', count: 8, totalValue: 3200, avgAmount: 400, approvalRate: 80, product: 'Smartphone' },
      { date: '2026-01-08', count: 6, totalValue: 2100, avgAmount: 350, approvalRate: 75, product: 'Smartphone' },
      { date: '2026-01-15', count: 10, totalValue: 4500, avgAmount: 450, approvalRate: 83, product: 'Smartphone' },
      { date: '2026-01-22', count: 12, totalValue: 4200, avgAmount: 350, approvalRate: 77, product: 'Smartphone' },
      { date: '2026-01-29', count: 11, totalValue: 4400, avgAmount: 400, approvalRate: 76, product: 'Smartphone' },
    ],
  };
}

export async function fetchPaymentCollectionReport(
  _filters: ReportFilters
): Promise<PaymentCollectionSummary> {
  await delay(600);
  return {
    totalExpected: 12_500,
    totalCollected: 10_875,
    collectionRate: 87.0,
    totalTransactions: 156,
    failedTransactions: 8,
    byMethod: [
      { method: 'EcoCash', amount: 8_700, count: 125 },
      { method: 'OneMoney', amount: 1_500, count: 22 },
      { method: 'InnBucks', amount: 675, count: 9 },
    ],
    rows: [
      { date: '2026-01-01', expected: 2500, actual: 2200, collectionRate: 88, txnCount: 32, failedCount: 2, method: 'All' },
      { date: '2026-01-08', expected: 2500, actual: 2100, collectionRate: 84, txnCount: 30, failedCount: 1, method: 'All' },
      { date: '2026-01-15', expected: 2500, actual: 2275, collectionRate: 91, txnCount: 33, failedCount: 2, method: 'All' },
      { date: '2026-01-22', expected: 2500, actual: 2150, collectionRate: 86, txnCount: 31, failedCount: 1, method: 'All' },
      { date: '2026-01-29', expected: 2500, actual: 2150, collectionRate: 86, txnCount: 30, failedCount: 2, method: 'All' },
    ],
  };
}

export async function fetchDefaultRateReport(
  _filters: ReportFilters
): Promise<DefaultRateSummary> {
  await delay(600);
  return {
    par30: 8.2,
    par60: 4.1,
    par90: 1.8,
    defaultRate: 3.5,
    recoveryRate: 45.0,
    writeOffRate: 1.2,
    totalOutstanding: 42_300,
    rows: [
      { bucket: 'Current', loanCount: 38, outstandingBalance: 35_200, parPct: 0 },
      { bucket: '1-30 days', loanCount: 5, outstandingBalance: 3_460, parPct: 8.2 },
      { bucket: '31-60 days', loanCount: 3, outstandingBalance: 1_740, parPct: 4.1 },
      { bucket: '61-90 days', loanCount: 1, outstandingBalance: 760, parPct: 1.8 },
      { bucket: '90+ days', loanCount: 1, outstandingBalance: 1_140, parPct: 2.7 },
    ],
  };
}

export async function fetchKycStatusReport(
  _filters: ReportFilters
): Promise<KycStatusSummary> {
  await delay(600);
  return {
    totalSubmissions: 82,
    pendingCount: 5,
    approvedCount: 64,
    rejectedCount: 13,
    approvalRate: 83.1,
    avgProcessingTime: 18.5,
    rows: [
      { status: 'Approved', count: 64, pct: 78.0, avgProcessingMins: 12 },
      { status: 'Rejected', count: 13, pct: 15.9, avgProcessingMins: 22 },
      { status: 'Pending', count: 5, pct: 6.1, avgProcessingMins: 0 },
    ],
    rejectionReasons: [
      { reason: 'Blurry ID photo', count: 5 },
      { reason: 'ID-selfie mismatch', count: 4 },
      { reason: 'Expired document', count: 2 },
      { reason: 'Incomplete information', count: 2 },
    ],
  };
}

export async function fetchDeviceManagementReport(
  _filters: ReportFilters
): Promise<DeviceManagementSummary> {
  await delay(600);
  return {
    totalDevices: 120,
    inStock: 35,
    allocated: 12,
    active: 58,
    locked: 8,
    repossessed: 7,
    lockOperations: 14,
    unlockOperations: 6,
    avgLockDurationHrs: 72.4,
    rows: [
      { status: 'In Stock', count: 35, pct: 29.2 },
      { status: 'Allocated', count: 12, pct: 10.0 },
      { status: 'Active', count: 58, pct: 48.3 },
      { status: 'Locked', count: 8, pct: 6.7 },
      { status: 'Repossessed', count: 7, pct: 5.8 },
    ],
  };
}

export async function fetchCustomerAcquisitionReport(
  _filters: ReportFilters
): Promise<CustomerAcquisitionSummary> {
  await delay(600);
  return {
    newCustomers: 64,
    completionRate: 73.4,
    avgOnboardingDays: 2.3,
    costPerAcquisition: 4.50,
    funnel: [
      { stage: 'WhatsApp Initiated', count: 120, conversionRate: 100 },
      { stage: 'KYC Started', count: 95, conversionRate: 79.2 },
      { stage: 'KYC Completed', count: 82, conversionRate: 86.3 },
      { stage: 'Loan Applied', count: 68, conversionRate: 82.9 },
      { stage: 'Loan Approved', count: 52, conversionRate: 76.5 },
      { stage: 'Loan Disbursed', count: 47, conversionRate: 90.4 },
    ],
    bySource: [
      { source: 'Organic (WhatsApp)', count: 38, pct: 59.4 },
      { source: 'Distributor Referral', count: 16, pct: 25.0 },
      { source: 'Customer Referral', count: 7, pct: 10.9 },
      { source: 'Marketing', count: 3, pct: 4.7 },
    ],
  };
}

export async function fetchPortfolioHealthReport(
  _filters: ReportFilters
): Promise<PortfolioHealthSummary> {
  await delay(600);
  return {
    totalOutstanding: 42_300,
    totalDisbursed: 58_900,
    par30: 8.2,
    par60: 4.1,
    par90: 1.8,
    collectionEfficiency: 87.0,
    byStatus: [
      { category: 'Active', value: 35_200, pct: 83.2 },
      { category: 'Overdue (1-30d)', value: 3_460, pct: 8.2 },
      { category: 'Overdue (31-60d)', value: 1_740, pct: 4.1 },
      { category: 'Overdue (61-90d)', value: 760, pct: 1.8 },
      { category: 'Default (90+)', value: 1_140, pct: 2.7 },
    ],
    byTier: [
      { category: 'Tier 1 ($200)', value: 8_400, pct: 19.9 },
      { category: 'Tier 2 ($350)', value: 16_800, pct: 39.7 },
      { category: 'Tier 3 ($500)', value: 17_100, pct: 40.4 },
    ],
    byAge: [
      { category: '0-30 days', value: 9_200, pct: 21.7 },
      { category: '31-90 days', value: 14_600, pct: 34.5 },
      { category: '91-180 days', value: 12_800, pct: 30.3 },
      { category: '180+ days', value: 5_700, pct: 13.5 },
    ],
  };
}
