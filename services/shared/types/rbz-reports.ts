/**
 * RBZ (Reserve Bank of Zimbabwe) Compliance Report Type Definitions
 *
 * Covers all mandatory regulatory reports required by the Reserve Bank
 * of Zimbabwe for licensed microfinance institutions. Reports pull data
 * from both the Lynia PostgreSQL database and Apache Fineract's
 * double-entry accounting system (GL accounts, journal entries).
 *
 * Report filing schedule per RBZ Banking Act (Chapter 24:20):
 *   - Monthly:    Transaction Summary, GL Trial Balance, Loan Portfolio
 *   - Quarterly:  Prudential Return, Capital Adequacy, NPL, KYC Compliance
 *   - Annual:     Interest Rate Schedule, Annual Compliance Audit
 *   - On-demand:  Suspicious Transaction Report (STR) — within 24 hours
 *   - On-demand:  Large Transaction Report (LTR) — within 48 hours
 *
 * All monetary amounts are stored in cents (smallest unit) and reported
 * in USD unless otherwise specified. Multi-currency support for ZWL/ZAR.
 */

// ===================================================================
// REPORT ENUMS
// ===================================================================

export type FineractRBZReportType =
  | 'monthly_transaction_summary'
  | 'gl_trial_balance'
  | 'prudential_return'
  | 'capital_adequacy'
  | 'npl_analysis'
  | 'large_transaction_report'
  | 'suspicious_transaction_report'
  | 'foreign_currency_exposure'
  | 'interest_rate_schedule'
  | 'annual_compliance_audit'
  | 'loan_portfolio_fineract';

export type RBZReportFrequency = 'monthly' | 'quarterly' | 'annual' | 'on_demand';

export type RBZReportStatus =
  | 'scheduled'
  | 'generating'
  | 'generated'
  | 'reviewed'
  | 'submitted'
  | 'rejected'
  | 'archived';

export type Currency = 'USD' | 'ZWL' | 'ZAR';

// ===================================================================
// CORE REPORT INTERFACES
// ===================================================================

export interface RBZReportConfig {
  reportType: FineractRBZReportType;
  frequency: RBZReportFrequency;
  periodStart: Date;
  periodEnd: Date;
  generatedBy: string;
  currency: Currency;
  includesFineractData: boolean;
}

export interface RBZGeneratedReport {
  id?: string;
  reportType: FineractRBZReportType;
  frequency: RBZReportFrequency;
  periodStart: Date;
  periodEnd: Date;
  generatedBy: string;
  generatedAt: Date;
  data: Record<string, unknown>;
  status: RBZReportStatus;
  submittedToRbzAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  filePath?: string;
  fileFormat?: 'csv' | 'pdf' | 'json';
  fineractSourced: boolean;
  checksum?: string;
}

// ===================================================================
// MONTHLY TRANSACTION SUMMARY
// ===================================================================

export interface MonthlyTransactionSummary {
  reportingPeriod: { start: string; end: string };
  institutionName: string;
  licenseNumber: string;
  currency: Currency;

  totalTransactions: number;
  totalTransactionValue: number;

  transactionsByType: {
    disbursements: { count: number; amount: number };
    repayments: { count: number; amount: number };
    fees: { count: number; amount: number };
    penalties: { count: number; amount: number };
    writeOffs: { count: number; amount: number };
    recoveries: { count: number; amount: number };
    waivers: { count: number; amount: number };
  };

  transactionsByChannel: {
    ecocash: { count: number; amount: number };
    onemoney: { count: number; amount: number };
    bankTransfer: { count: number; amount: number };
    cash: { count: number; amount: number };
    other: { count: number; amount: number };
  };

  dailyVolumes: Array<{
    date: string;
    transactionCount: number;
    totalAmount: number;
  }>;

  largeTransactions: Array<{
    date: string;
    amount: number;
    type: string;
    customerId: string;
  }>;

  failedTransactions: {
    count: number;
    totalAmount: number;
    topReasons: Array<{ reason: string; count: number }>;
  };
}

// ===================================================================
// GL TRIAL BALANCE (from Fineract)
// ===================================================================

export interface GLTrialBalance {
  reportingPeriod: { start: string; end: string };
  generatedFrom: 'fineract';
  currency: Currency;

  accounts: Array<{
    glAccountId: number;
    glCode: string;
    accountName: string;
    accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
    openingBalance: number;
    debits: number;
    credits: number;
    closingBalance: number;
    netMovement: number;
  }>;

  totals: {
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
    variance: number;
  };

  assetSummary: { totalAssets: number; currentAssets: number; nonCurrentAssets: number };
  liabilitySummary: { totalLiabilities: number; currentLiabilities: number };
  equitySummary: { totalEquity: number };
  incomeSummary: { totalIncome: number; interestIncome: number; feeIncome: number };
  expenseSummary: { totalExpenses: number; provisionExpenses: number };
}

// ===================================================================
// PRUDENTIAL RETURN (Quarterly)
// ===================================================================

export interface PrudentialReturn {
  reportingPeriod: { start: string; end: string };
  reportingQuarter: string;
  institutionName: string;
  licenseNumber: string;

  balanceSheet: {
    totalAssets: number;
    cashAndBankBalances: number;
    loanPortfolioGross: number;
    loanLossProvisions: number;
    loanPortfolioNet: number;
    otherAssets: number;
    totalLiabilities: number;
    borrowings: number;
    otherLiabilities: number;
    totalEquity: number;
    paidUpCapital: number;
    retainedEarnings: number;
  };

  incomeStatement: {
    interestIncome: number;
    feeIncome: number;
    otherIncome: number;
    totalIncome: number;
    interestExpense: number;
    provisionExpense: number;
    operatingExpenses: number;
    totalExpenses: number;
    netIncome: number;
  };

  portfolioQuality: {
    totalLoansOutstanding: number;
    totalBorrowers: number;
    averageLoanSize: number;
    par1: number;
    par30: number;
    par60: number;
    par90: number;
    writeOffRatio: number;
    riskCoverageRatio: number;
  };

  capitalAdequacy: {
    tier1Capital: number;
    tier2Capital: number;
    totalCapital: number;
    riskWeightedAssets: number;
    capitalAdequacyRatio: number;
    minimumRequiredRatio: number;
    isCompliant: boolean;
  };

  liquidity: {
    liquidAssets: number;
    totalDeposits: number;
    liquidityRatio: number;
    minimumRequiredRatio: number;
    isCompliant: boolean;
  };
}

// ===================================================================
// CAPITAL ADEQUACY REPORT (Quarterly)
// ===================================================================

export interface CapitalAdequacyReport {
  reportingPeriod: { start: string; end: string };
  currency: Currency;

  tier1Capital: {
    paidUpCapital: number;
    retainedEarnings: number;
    otherReserves: number;
    lessIntangibleAssets: number;
    total: number;
  };

  tier2Capital: {
    generalProvisions: number;
    subordinatedDebt: number;
    total: number;
  };

  totalRegulatoryCapital: number;

  riskWeightedAssets: {
    cashAndGovSecurities: { amount: number; riskWeight: number; weighted: number };
    interBankDeposits: { amount: number; riskWeight: number; weighted: number };
    loanPortfolio: { amount: number; riskWeight: number; weighted: number };
    fixedAssets: { amount: number; riskWeight: number; weighted: number };
    otherAssets: { amount: number; riskWeight: number; weighted: number };
    total: number;
  };

  ratios: {
    capitalAdequacyRatio: number;
    tier1Ratio: number;
    leverageRatio: number;
  };

  rbzMinimumRequirements: {
    minimumCAR: number;
    minimumTier1: number;
    isCompliant: boolean;
    shortfall: number;
  };
}

// ===================================================================
// NPL ANALYSIS (From Fineract loan data)
// ===================================================================

export interface NPLAnalysisReport {
  reportingPeriod: { start: string; end: string };
  generatedFrom: 'fineract';
  currency: Currency;

  summary: {
    totalLoans: number;
    totalPortfolioValue: number;
    nplCount: number;
    nplValue: number;
    nplRatio: number;
    provisionCoverageRatio: number;
  };

  agingBuckets: {
    current: { count: number; outstanding: number; percentage: number };
    days1to30: { count: number; outstanding: number; percentage: number };
    days31to60: { count: number; outstanding: number; percentage: number };
    days61to90: { count: number; outstanding: number; percentage: number };
    days91to180: { count: number; outstanding: number; percentage: number };
    days181plus: { count: number; outstanding: number; percentage: number };
  };

  provisionRequirements: {
    category: string;
    loanCount: number;
    outstandingAmount: number;
    provisionRate: number;
    provisionAmount: number;
  }[];

  topNPLLoans: Array<{
    loanAccountNo: string;
    fineractLoanId: number;
    borrowerName: string;
    principalOutstanding: number;
    daysPastDue: number;
    classification: string;
  }>;

  restructuredLoans: {
    count: number;
    totalAmount: number;
    performingCount: number;
    nonPerformingCount: number;
  };

  recoveries: {
    recoveredCount: number;
    recoveredAmount: number;
    recoveryRate: number;
  };
}

// ===================================================================
// LARGE TRANSACTION REPORT (On-demand, threshold-based)
// ===================================================================

export interface LargeTransactionReport {
  reportDate: string;
  referenceNumber: string;
  reportingThreshold: number;
  currency: Currency;

  transactions: Array<{
    transactionId: string;
    fineractTransactionId?: number;
    date: string;
    type: string;
    amount: number;
    currency: Currency;
    customerId: string;
    customerName: string;
    paymentChannel: string;
    sourceOfFunds?: string;
    purposeOfTransaction?: string;
    riskFlag: boolean;
  }>;

  summary: {
    totalTransactions: number;
    totalAmount: number;
    flaggedCount: number;
    newCustomerTransactions: number;
  };
}

// ===================================================================
// SUSPICIOUS TRANSACTION REPORT (STR) - Enhanced with Fineract data
// ===================================================================

export interface SuspiciousTransactionReportEnhanced {
  reportDate: string;
  referenceNumber: string;
  filingDeadline: string;
  priority: 'normal' | 'urgent' | 'critical';

  institution: {
    name: string;
    licenseNumber: string;
    reportingOfficer: string;
    contactPhone: string;
  };

  subject: {
    customerId: string;
    fullName: string;
    nationalIdMasked: string;
    accountType: string;
    customerSince: string;
    kycStatus: string;
    riskRating: 'low' | 'medium' | 'high' | 'critical';
  };

  suspiciousActivity: {
    type: string;
    description: string;
    detectedDate: string;
    detectionMethod: 'automated' | 'manual' | 'tip';
    activityPeriod: { start: string; end: string };
  };

  transactionAnalysis: {
    totalTransactions: number;
    totalAmount: number;
    averageTransactionSize: number;
    largestTransaction: number;
    unusualPatterns: string[];
    fineractTransactions: Array<{
      fineractId: number;
      date: string;
      type: string;
      amount: number;
      loanAccountNo?: string;
    }>;
  };

  riskIndicators: string[];
  actionTaken: string;
  recommendedActions: string[];
  reportedBy: string;
}

// ===================================================================
// FOREIGN CURRENCY EXPOSURE (Quarterly)
// ===================================================================

export interface ForeignCurrencyExposure {
  reportingPeriod: { start: string; end: string };
  reportingDate: string;

  exposureByLeg: Array<{
    currency: Currency;
    assets: number;
    liabilities: number;
    netOpenPosition: number;
    exchangeRate: number;
    exchangeRateSource: 'RBZ' | 'INTERBANK';
    usdEquivalent: number;
  }>;

  totalNetOpenPosition: number;

  limits: {
    singleCurrencyLimit: number;
    aggregateLimit: number;
    isCompliant: boolean;
    breaches: Array<{
      currency: Currency;
      limit: number;
      actual: number;
      breach: number;
    }>;
  };

  hedgingPositions: Array<{
    currency: Currency;
    instrument: string;
    notionalAmount: number;
    maturityDate: string;
  }>;
}

// ===================================================================
// INTEREST RATE SCHEDULE (Annual)
// ===================================================================

export interface InterestRateSchedule {
  reportingYear: number;
  effectiveDate: string;

  products: Array<{
    productId: number;
    fineractProductId?: number;
    productName: string;
    productType: string;
    nominalRate: number;
    effectiveRate: number;
    calculationMethod: 'declining_balance' | 'flat';
    compoundingFrequency: 'monthly' | 'quarterly' | 'annually';
    minimumRate: number;
    maximumRate: number;
    penaltyRate: number;
    gracePeriodsAllowed: number;
  }>;

  feeSchedule: Array<{
    feeName: string;
    feeType: 'flat' | 'percentage';
    amount: number;
    applicableTo: string;
    frequency: string;
  }>;

  rbzRateCeiling: number;
  allProductsWithinCeiling: boolean;
  deviations: Array<{
    productName: string;
    rate: number;
    ceiling: number;
    justification: string;
  }>;
}

// ===================================================================
// ANNUAL COMPLIANCE AUDIT
// ===================================================================

export interface AnnualComplianceAudit {
  reportingYear: number;
  auditDate: string;

  kycCompliance: {
    totalCustomers: number;
    fullyVerified: number;
    partiallyVerified: number;
    expired: number;
    complianceRate: number;
    enhancedDueDiligenceCount: number;
    highRiskCustomers: number;
  };

  amlCompliance: {
    strsFiled: number;
    ltrsGenerated: number;
    fraudAlertsFlagged: number;
    fraudAlertsResolved: number;
    averageResponseTimeHours: number;
    sanctionsScreeningsPerformed: number;
  };

  dataPrivacy: {
    consentRecordsCount: number;
    deletionRequestsReceived: number;
    deletionRequestsCompleted: number;
    dataBreachesReported: number;
    privacyAuditLogEntries: number;
  };

  loanPortfolioCompliance: {
    totalLoansIssued: number;
    loansWithinRateCeiling: number;
    loansWithProperDocumentation: number;
    transactionLimitBreaches: number;
    averageLoanSize: number;
    portfolioAtRisk30: number;
  };

  systemSecurity: {
    securityIncidents: number;
    unauthorizedAccessAttempts: number;
    dataEncryptionCompliance: boolean;
    accessControlReviewDate: string;
    penetrationTestDate: string;
  };

  recordRetention: {
    transactionRecordsYears: number;
    kycDocumentsYears: number;
    auditLogsYears: number;
    isCompliant: boolean;
  };

  regulatoryFilings: {
    monthlyReportsFiled: number;
    monthlyReportsDue: number;
    quarterlyReportsFiled: number;
    quarterlyReportsDue: number;
    annualReportsFiled: number;
    annualReportsDue: number;
    onTimeFilingRate: number;
  };

  fineractReconciliation: {
    totalReconciliationsRun: number;
    discrepanciesFound: number;
    discrepanciesResolved: number;
    averageResolutionTimeHours: number;
    currentSyncStatus: 'healthy' | 'degraded' | 'failed';
  };
}

// ===================================================================
// LOAN PORTFOLIO REPORT (Fineract-sourced)
// ===================================================================

export interface LoanPortfolioFineractReport {
  reportingPeriod: { start: string; end: string };
  generatedFrom: 'fineract';
  currency: Currency;

  portfolioSummary: {
    totalActiveLoans: number;
    totalDisbursedPrincipal: number;
    totalPrincipalOutstanding: number;
    totalPrincipalPaid: number;
    totalInterestCharged: number;
    totalInterestPaid: number;
    totalInterestOutstanding: number;
    totalFeesCharged: number;
    totalFeesPaid: number;
    totalPenaltiesCharged: number;
    totalPenaltiesPaid: number;
    totalWrittenOff: number;
    totalWaived: number;
  };

  loansByProduct: Array<{
    productId: number;
    productName: string;
    loanCount: number;
    principalDisbursed: number;
    principalOutstanding: number;
    interestOutstanding: number;
    overdueAmount: number;
    par30: number;
  }>;

  loansByStatus: Array<{
    status: string;
    count: number;
    principalAmount: number;
  }>;

  disbursementTrend: Array<{
    month: string;
    count: number;
    amount: number;
  }>;

  collectionPerformance: {
    expectedCollections: number;
    actualCollections: number;
    collectionRate: number;
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
  };
}

// ===================================================================
// REPORT SCHEDULE CONFIGURATION
// ===================================================================

export interface RBZReportSchedule {
  id?: string;
  reportType: FineractRBZReportType;
  frequency: RBZReportFrequency;
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  generatedBy: string;
  recipientEmails: string[];
  s3Bucket?: string;
  s3Prefix?: string;
}

// ===================================================================
// REPORT VALIDATION
// ===================================================================

export interface RBZReportValidationResult {
  reportType: FineractRBZReportType;
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  completenessScore: number;
  dataSourcesUsed: Array<'lynia_db' | 'fineract'>;
  reconciliationStatus: 'matched' | 'unmatched' | 'not_applicable';
}
