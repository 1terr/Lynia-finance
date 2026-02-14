/**
 * RBZ Report Export Utilities
 *
 * Generates CSV and structured JSON exports of RBZ compliance reports
 * for submission to the Reserve Bank of Zimbabwe. Each report type
 * has a dedicated CSV formatter that maps report data to the RBZ-
 * expected column layout.
 *
 * PDF generation is deferred to a future headless-chrome Lambda layer;
 * for now, CSV is the primary export format accepted by RBZ.
 *
 * Exports are stored in S3 under:
 *   s3://{bucket}/rbz-reports/{year}/{month}/{report_type}_{date}.csv
 */

import type {
  FineractRBZReportType,
  MonthlyTransactionSummary,
  GLTrialBalance,
  PrudentialReturn,
  CapitalAdequacyReport,
  NPLAnalysisReport,
  LargeTransactionReport,
  InterestRateSchedule,
  AnnualComplianceAudit,
  LoanPortfolioFineractReport,
} from './types/rbz-reports';

// ===================================================================
// CSV GENERATION
// ===================================================================

/**
 * Generate a CSV string for any RBZ report type.
 */
export function exportReportToCSV(
  reportType: FineractRBZReportType,
  data: Record<string, unknown>
): string {
  switch (reportType) {
    case 'monthly_transaction_summary':
      return exportMonthlyTransactionCSV(data as unknown as MonthlyTransactionSummary);
    case 'gl_trial_balance':
      return exportGLTrialBalanceCSV(data as unknown as GLTrialBalance);
    case 'prudential_return':
      return exportPrudentialReturnCSV(data as unknown as PrudentialReturn);
    case 'capital_adequacy':
      return exportCapitalAdequacyCSV(data as unknown as CapitalAdequacyReport);
    case 'npl_analysis':
      return exportNPLAnalysisCSV(data as unknown as NPLAnalysisReport);
    case 'large_transaction_report':
      return exportLargeTransactionCSV(data as unknown as LargeTransactionReport);
    case 'interest_rate_schedule':
      return exportInterestRateCSV(data as unknown as InterestRateSchedule);
    case 'annual_compliance_audit':
      return exportAnnualComplianceCSV(data as unknown as AnnualComplianceAudit);
    case 'loan_portfolio_fineract':
      return exportLoanPortfolioCSV(data as unknown as LoanPortfolioFineractReport);
    default:
      return exportGenericCSV(data);
  }
}

// ===================================================================
// INDIVIDUAL REPORT CSV FORMATTERS
// ===================================================================

function exportMonthlyTransactionCSV(report: MonthlyTransactionSummary): string {
  const rows: string[][] = [];

  // Header section
  rows.push(['MONTHLY TRANSACTION SUMMARY']);
  rows.push(['Institution', report.institutionName]);
  rows.push(['License Number', report.licenseNumber]);
  rows.push(['Period', `${report.reportingPeriod.start} to ${report.reportingPeriod.end}`]);
  rows.push(['Currency', report.currency]);
  rows.push([]);

  // Transaction Summary
  rows.push(['TRANSACTION SUMMARY']);
  rows.push(['Metric', 'Count', 'Amount']);
  rows.push(['Total Transactions', String(report.totalTransactions), formatAmount(report.totalTransactionValue)]);
  rows.push([]);

  // By Type
  rows.push(['TRANSACTIONS BY TYPE']);
  rows.push(['Type', 'Count', 'Amount']);
  for (const [type, data] of Object.entries(report.transactionsByType)) {
    rows.push([type, String(data.count), formatAmount(data.amount)]);
  }
  rows.push([]);

  // By Channel
  rows.push(['TRANSACTIONS BY CHANNEL']);
  rows.push(['Channel', 'Count', 'Amount']);
  for (const [channel, data] of Object.entries(report.transactionsByChannel)) {
    rows.push([channel, String(data.count), formatAmount(data.amount)]);
  }
  rows.push([]);

  // Daily Volumes
  rows.push(['DAILY TRANSACTION VOLUMES']);
  rows.push(['Date', 'Count', 'Total Amount']);
  for (const day of report.dailyVolumes) {
    rows.push([day.date, String(day.transactionCount), formatAmount(day.totalAmount)]);
  }
  rows.push([]);

  // Large Transactions
  if (report.largeTransactions.length > 0) {
    rows.push(['LARGE TRANSACTIONS (>$2000)']);
    rows.push(['Date', 'Amount', 'Type', 'Customer ID']);
    for (const txn of report.largeTransactions) {
      rows.push([txn.date, formatAmount(txn.amount), txn.type, txn.customerId]);
    }
    rows.push([]);
  }

  // Failed Transactions
  rows.push(['FAILED TRANSACTIONS']);
  rows.push(['Count', String(report.failedTransactions.count)]);
  rows.push(['Total Amount', formatAmount(report.failedTransactions.totalAmount)]);
  if (report.failedTransactions.topReasons.length > 0) {
    rows.push(['Top Failure Reasons']);
    rows.push(['Reason', 'Count']);
    for (const reason of report.failedTransactions.topReasons) {
      rows.push([reason.reason, String(reason.count)]);
    }
  }

  return toCSV(rows);
}

function exportGLTrialBalanceCSV(report: GLTrialBalance): string {
  const rows: string[][] = [];

  rows.push(['GL TRIAL BALANCE']);
  rows.push(['Source', 'Apache Fineract']);
  rows.push(['Period', `${report.reportingPeriod.start} to ${report.reportingPeriod.end}`]);
  rows.push(['Currency', report.currency]);
  rows.push([]);

  rows.push(['GL Code', 'Account Name', 'Type', 'Opening Balance', 'Debits', 'Credits', 'Closing Balance', 'Net Movement']);
  for (const acct of report.accounts) {
    rows.push([
      acct.glCode,
      acct.accountName,
      acct.accountType,
      formatAmount(acct.openingBalance),
      formatAmount(acct.debits),
      formatAmount(acct.credits),
      formatAmount(acct.closingBalance),
      formatAmount(acct.netMovement),
    ]);
  }
  rows.push([]);

  rows.push(['TOTALS']);
  rows.push(['Total Debits', formatAmount(report.totals.totalDebits)]);
  rows.push(['Total Credits', formatAmount(report.totals.totalCredits)]);
  rows.push(['Balanced', report.totals.isBalanced ? 'YES' : 'NO']);
  rows.push(['Variance', formatAmount(report.totals.variance)]);

  return toCSV(rows);
}

function exportPrudentialReturnCSV(report: PrudentialReturn): string {
  const rows: string[][] = [];

  rows.push(['QUARTERLY PRUDENTIAL RETURN']);
  rows.push(['Institution', report.institutionName]);
  rows.push(['License Number', report.licenseNumber]);
  rows.push(['Quarter', report.reportingQuarter]);
  rows.push([]);

  // Balance Sheet
  rows.push(['BALANCE SHEET']);
  rows.push(['Item', 'Amount']);
  for (const [key, value] of Object.entries(report.balanceSheet)) {
    rows.push([camelToTitle(key), formatAmount(value as number)]);
  }
  rows.push([]);

  // Income Statement
  rows.push(['INCOME STATEMENT']);
  rows.push(['Item', 'Amount']);
  for (const [key, value] of Object.entries(report.incomeStatement)) {
    rows.push([camelToTitle(key), formatAmount(value as number)]);
  }
  rows.push([]);

  // Portfolio Quality
  rows.push(['PORTFOLIO QUALITY']);
  rows.push(['Metric', 'Value']);
  for (const [key, value] of Object.entries(report.portfolioQuality)) {
    const formatted = typeof value === 'number' && key.startsWith('par')
      ? `${value}%`
      : typeof value === 'number' ? formatAmount(value) : String(value);
    rows.push([camelToTitle(key), formatted]);
  }
  rows.push([]);

  // Capital Adequacy
  rows.push(['CAPITAL ADEQUACY']);
  rows.push(['CAR', `${report.capitalAdequacy.capitalAdequacyRatio}%`]);
  rows.push(['Minimum Required', `${report.capitalAdequacy.minimumRequiredRatio}%`]);
  rows.push(['Compliant', report.capitalAdequacy.isCompliant ? 'YES' : 'NO']);

  return toCSV(rows);
}

function exportCapitalAdequacyCSV(report: CapitalAdequacyReport): string {
  const rows: string[][] = [];

  rows.push(['CAPITAL ADEQUACY REPORT']);
  rows.push(['Period', `${report.reportingPeriod.start} to ${report.reportingPeriod.end}`]);
  rows.push(['Currency', report.currency]);
  rows.push([]);

  rows.push(['TIER 1 CAPITAL']);
  rows.push(['Component', 'Amount']);
  for (const [key, value] of Object.entries(report.tier1Capital)) {
    rows.push([camelToTitle(key), formatAmount(value as number)]);
  }
  rows.push([]);

  rows.push(['TIER 2 CAPITAL']);
  for (const [key, value] of Object.entries(report.tier2Capital)) {
    rows.push([camelToTitle(key), formatAmount(value as number)]);
  }
  rows.push([]);

  rows.push(['Total Regulatory Capital', formatAmount(report.totalRegulatoryCapital)]);
  rows.push([]);

  rows.push(['RISK-WEIGHTED ASSETS']);
  rows.push(['Category', 'Amount', 'Risk Weight (%)', 'Weighted Amount']);
  for (const [key, value] of Object.entries(report.riskWeightedAssets)) {
    if (key === 'total') continue;
    const v = value as { amount: number; riskWeight: number; weighted: number };
    rows.push([camelToTitle(key), formatAmount(v.amount), String(v.riskWeight), formatAmount(v.weighted)]);
  }
  rows.push(['Total RWA', '', '', formatAmount(report.riskWeightedAssets.total)]);
  rows.push([]);

  rows.push(['RATIOS']);
  rows.push(['CAR', `${report.ratios.capitalAdequacyRatio}%`]);
  rows.push(['Tier 1 Ratio', `${report.ratios.tier1Ratio}%`]);
  rows.push(['Leverage Ratio', `${report.ratios.leverageRatio}%`]);
  rows.push([]);

  rows.push(['COMPLIANCE']);
  rows.push(['Minimum CAR', `${report.rbzMinimumRequirements.minimumCAR}%`]);
  rows.push(['Compliant', report.rbzMinimumRequirements.isCompliant ? 'YES' : 'NO']);
  rows.push(['Shortfall', formatAmount(report.rbzMinimumRequirements.shortfall)]);

  return toCSV(rows);
}

function exportNPLAnalysisCSV(report: NPLAnalysisReport): string {
  const rows: string[][] = [];

  rows.push(['NPL ANALYSIS REPORT']);
  rows.push(['Source', 'Apache Fineract']);
  rows.push(['Period', `${report.reportingPeriod.start} to ${report.reportingPeriod.end}`]);
  rows.push(['Currency', report.currency]);
  rows.push([]);

  rows.push(['SUMMARY']);
  rows.push(['Total Loans', String(report.summary.totalLoans)]);
  rows.push(['Total Portfolio Value', formatAmount(report.summary.totalPortfolioValue)]);
  rows.push(['NPL Count', String(report.summary.nplCount)]);
  rows.push(['NPL Value', formatAmount(report.summary.nplValue)]);
  rows.push(['NPL Ratio', `${report.summary.nplRatio}%`]);
  rows.push(['Provision Coverage Ratio', `${report.summary.provisionCoverageRatio}%`]);
  rows.push([]);

  rows.push(['AGING BUCKETS']);
  rows.push(['Bucket', 'Count', 'Outstanding', 'Percentage']);
  const buckets = report.agingBuckets;
  rows.push(['Current', String(buckets.current.count), formatAmount(buckets.current.outstanding), `${buckets.current.percentage}%`]);
  rows.push(['1-30 days', String(buckets.days1to30.count), formatAmount(buckets.days1to30.outstanding), `${buckets.days1to30.percentage}%`]);
  rows.push(['31-60 days', String(buckets.days31to60.count), formatAmount(buckets.days31to60.outstanding), `${buckets.days31to60.percentage}%`]);
  rows.push(['61-90 days', String(buckets.days61to90.count), formatAmount(buckets.days61to90.outstanding), `${buckets.days61to90.percentage}%`]);
  rows.push(['91-180 days', String(buckets.days91to180.count), formatAmount(buckets.days91to180.outstanding), `${buckets.days91to180.percentage}%`]);
  rows.push(['181+ days', String(buckets.days181plus.count), formatAmount(buckets.days181plus.outstanding), `${buckets.days181plus.percentage}%`]);
  rows.push([]);

  rows.push(['PROVISION REQUIREMENTS']);
  rows.push(['Category', 'Loan Count', 'Outstanding', 'Rate (%)', 'Provision Amount']);
  for (const prov of report.provisionRequirements) {
    rows.push([
      prov.category,
      String(prov.loanCount),
      formatAmount(prov.outstandingAmount),
      String(prov.provisionRate),
      formatAmount(prov.provisionAmount),
    ]);
  }
  rows.push([]);

  if (report.topNPLLoans.length > 0) {
    rows.push(['TOP NPL LOANS']);
    rows.push(['Loan Account', 'Fineract ID', 'Outstanding', 'Days Past Due', 'Classification']);
    for (const loan of report.topNPLLoans) {
      rows.push([
        loan.loanAccountNo,
        String(loan.fineractLoanId),
        formatAmount(loan.principalOutstanding),
        String(loan.daysPastDue),
        loan.classification,
      ]);
    }
  }

  return toCSV(rows);
}

function exportLargeTransactionCSV(report: LargeTransactionReport): string {
  const rows: string[][] = [];

  rows.push(['LARGE TRANSACTION REPORT']);
  rows.push(['Reference', report.referenceNumber]);
  rows.push(['Date', report.reportDate]);
  rows.push(['Threshold', formatAmount(report.reportingThreshold)]);
  rows.push(['Currency', report.currency]);
  rows.push([]);

  rows.push(['SUMMARY']);
  rows.push(['Total Transactions', String(report.summary.totalTransactions)]);
  rows.push(['Total Amount', formatAmount(report.summary.totalAmount)]);
  rows.push(['Flagged', String(report.summary.flaggedCount)]);
  rows.push(['New Customer Transactions', String(report.summary.newCustomerTransactions)]);
  rows.push([]);

  rows.push(['TRANSACTIONS']);
  rows.push(['Date', 'Transaction ID', 'Amount', 'Type', 'Channel', 'Customer', 'Risk Flag']);
  for (const txn of report.transactions) {
    rows.push([
      txn.date,
      txn.transactionId,
      formatAmount(txn.amount),
      txn.type,
      txn.paymentChannel,
      txn.customerName,
      txn.riskFlag ? 'YES' : 'NO',
    ]);
  }

  return toCSV(rows);
}

function exportInterestRateCSV(report: InterestRateSchedule): string {
  const rows: string[][] = [];

  rows.push(['INTEREST RATE SCHEDULE']);
  rows.push(['Year', String(report.reportingYear)]);
  rows.push(['Effective Date', report.effectiveDate]);
  rows.push(['RBZ Rate Ceiling', `${report.rbzRateCeiling}%`]);
  rows.push(['All Within Ceiling', report.allProductsWithinCeiling ? 'YES' : 'NO']);
  rows.push([]);

  rows.push(['LOAN PRODUCTS']);
  rows.push(['Product', 'Nominal Rate', 'Effective Rate', 'Method', 'Penalty Rate', 'Min Rate', 'Max Rate']);
  for (const product of report.products) {
    rows.push([
      product.productName,
      `${product.nominalRate}%`,
      `${product.effectiveRate}%`,
      product.calculationMethod,
      `${product.penaltyRate}%`,
      `${product.minimumRate}%`,
      `${product.maximumRate}%`,
    ]);
  }
  rows.push([]);

  rows.push(['FEE SCHEDULE']);
  rows.push(['Fee Name', 'Type', 'Amount', 'Applicable To', 'Frequency']);
  for (const fee of report.feeSchedule) {
    rows.push([
      fee.feeName,
      fee.feeType,
      fee.feeType === 'percentage' ? `${fee.amount}%` : formatAmount(fee.amount),
      fee.applicableTo,
      fee.frequency,
    ]);
  }

  return toCSV(rows);
}

function exportAnnualComplianceCSV(report: AnnualComplianceAudit): string {
  const rows: string[][] = [];

  rows.push(['ANNUAL COMPLIANCE AUDIT REPORT']);
  rows.push(['Year', String(report.reportingYear)]);
  rows.push(['Audit Date', report.auditDate]);
  rows.push([]);

  // KYC
  rows.push(['KYC COMPLIANCE']);
  for (const [key, value] of Object.entries(report.kycCompliance)) {
    rows.push([camelToTitle(key), String(value)]);
  }
  rows.push([]);

  // AML
  rows.push(['AML COMPLIANCE']);
  for (const [key, value] of Object.entries(report.amlCompliance)) {
    rows.push([camelToTitle(key), String(value)]);
  }
  rows.push([]);

  // Privacy
  rows.push(['DATA PRIVACY']);
  for (const [key, value] of Object.entries(report.dataPrivacy)) {
    rows.push([camelToTitle(key), String(value)]);
  }
  rows.push([]);

  // Regulatory Filings
  rows.push(['REGULATORY FILINGS']);
  for (const [key, value] of Object.entries(report.regulatoryFilings)) {
    rows.push([camelToTitle(key), String(value)]);
  }
  rows.push([]);

  // Fineract Reconciliation
  rows.push(['FINERACT RECONCILIATION']);
  for (const [key, value] of Object.entries(report.fineractReconciliation)) {
    rows.push([camelToTitle(key), String(value)]);
  }
  rows.push([]);

  // Record Retention
  rows.push(['RECORD RETENTION']);
  rows.push(['Transaction Records', `${report.recordRetention.transactionRecordsYears} years`]);
  rows.push(['KYC Documents', `${report.recordRetention.kycDocumentsYears} years`]);
  rows.push(['Audit Logs', `${report.recordRetention.auditLogsYears} years`]);
  rows.push(['Compliant', report.recordRetention.isCompliant ? 'YES' : 'NO']);

  return toCSV(rows);
}

function exportLoanPortfolioCSV(report: LoanPortfolioFineractReport): string {
  const rows: string[][] = [];

  rows.push(['LOAN PORTFOLIO REPORT (FINERACT)']);
  rows.push(['Source', 'Apache Fineract']);
  rows.push(['Period', `${report.reportingPeriod.start} to ${report.reportingPeriod.end}`]);
  rows.push(['Currency', report.currency]);
  rows.push([]);

  rows.push(['PORTFOLIO SUMMARY']);
  for (const [key, value] of Object.entries(report.portfolioSummary)) {
    rows.push([camelToTitle(key), typeof value === 'number' ? formatAmount(value) : String(value)]);
  }
  rows.push([]);

  if (report.loansByProduct.length > 0) {
    rows.push(['LOANS BY PRODUCT']);
    rows.push(['Product', 'Count', 'Disbursed', 'Outstanding', 'Interest Outstanding', 'Overdue', 'PAR30']);
    for (const p of report.loansByProduct) {
      rows.push([
        p.productName,
        String(p.loanCount),
        formatAmount(p.principalDisbursed),
        formatAmount(p.principalOutstanding),
        formatAmount(p.interestOutstanding),
        formatAmount(p.overdueAmount),
        String(p.par30),
      ]);
    }
    rows.push([]);
  }

  rows.push(['COLLECTION PERFORMANCE']);
  rows.push(['Expected Collections', formatAmount(report.collectionPerformance.expectedCollections)]);
  rows.push(['Actual Collections', formatAmount(report.collectionPerformance.actualCollections)]);
  rows.push(['Collection Rate', `${report.collectionPerformance.collectionRate}%`]);

  return toCSV(rows);
}

function exportGenericCSV(data: Record<string, unknown>): string {
  const rows: string[][] = [['Key', 'Value']];
  flattenObject(data, '', rows);
  return toCSV(rows);
}

// ===================================================================
// HELPERS
// ===================================================================

function toCSV(rows: string[][]): string {
  return rows
    .map(row => row.map(cell => escapeCSV(String(cell ?? ''))).join(','))
    .join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function camelToTitle(camelCase: string): string {
  return camelCase
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/(\d+)/g, ' $1 ')
    .trim();
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string,
  rows: string[][]
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenObject(value as Record<string, unknown>, fullKey, rows);
    } else if (Array.isArray(value)) {
      rows.push([fullKey, `[${value.length} items]`]);
    } else {
      rows.push([fullKey, String(value ?? '')]);
    }
  }
}

/**
 * Generate an S3 key path for a report export file.
 */
export function getReportS3Key(
  reportType: FineractRBZReportType,
  periodEnd: Date,
  format: 'csv' | 'json' = 'csv'
): string {
  const year = periodEnd.getFullYear();
  const month = String(periodEnd.getMonth() + 1).padStart(2, '0');
  const day = String(periodEnd.getDate()).padStart(2, '0');
  return `rbz-reports/${year}/${month}/${reportType}_${year}-${month}-${day}.${format}`;
}
