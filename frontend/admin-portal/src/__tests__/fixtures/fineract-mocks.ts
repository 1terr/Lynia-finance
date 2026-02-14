/**
 * Shared test fixtures for Fineract UI components (Phase 7)
 */

import type {
  FineractLoanView,
  FineractLoanDetail,
  RepaymentSchedule,
  RepaymentPeriod,
  FineractTransaction,
  FineractLoanProductView,
  GLAccount,
  JournalEntry,
  TrialBalanceEntry,
  ReconciliationResult,
  ReconciliationDiscrepancy,
  OverdueLoan,
  AgingSummary,
  FineractCurrency,
} from '@/types/fineract';

// ============================================================
// SHARED CURRENCY
// ============================================================

export const USD_CURRENCY: FineractCurrency = {
  code: 'USD',
  name: 'US Dollar',
  decimalPlaces: 2,
  displaySymbol: '$',
  displayLabel: 'US Dollar ($)',
};

// ============================================================
// LOAN VIEWS
// ============================================================

export function createMockLoanView(
  overrides: Partial<FineractLoanView> = {}
): FineractLoanView {
  return {
    lyniaLoanId: 'loan-001-uuid',
    lyniaCustomerId: 'cust-001-uuid',
    customerName: 'Tendai Moyo',
    customerPhone: '+263771234567',
    fineractLoanId: 101,
    fineractAccountNo: '000000101',
    fineractClientId: 201,
    productName: 'Lynia Device Finance - Tier 1 (Entry)',
    productId: 1,
    principal: 200,
    approvedPrincipal: 200,
    currency: USD_CURRENCY,
    numberOfRepayments: 12,
    repaymentEvery: 1,
    repaymentFrequency: 'Months',
    interestRatePerPeriod: 5,
    annualInterestRate: 60,
    interestType: 'Declining Balance',
    amortizationType: 'Equal installments',
    status: {
      id: 300,
      code: 'loanStatusType.active',
      value: 'Active',
    },
    submittedOnDate: '2026-01-15',
    approvedOnDate: '2026-01-16',
    expectedDisbursementDate: '2026-01-17',
    actualDisbursementDate: '2026-01-17',
    expectedMaturityDate: '2027-01-17',
    closedOnDate: null,
    principalDisbursed: 200,
    principalPaid: 50,
    principalOutstanding: 150,
    principalOverdue: 0,
    interestCharged: 80,
    interestPaid: 20,
    interestOutstanding: 60,
    interestOverdue: 0,
    feeChargesCharged: 0,
    feeChargesPaid: 0,
    feeChargesOutstanding: 0,
    penaltyChargesCharged: 0,
    penaltyChargesPaid: 0,
    penaltyChargesOutstanding: 0,
    totalExpectedRepayment: 280,
    totalRepayment: 70,
    totalOutstanding: 210,
    totalOverdue: 0,
    overdueSinceDate: null,
    deviceBrand: 'Samsung',
    deviceModel: 'Galaxy A14',
    deviceImei: '123456789012345',
    ...overrides,
  };
}

export function createMockPendingLoan(
  overrides: Partial<FineractLoanView> = {}
): FineractLoanView {
  return createMockLoanView({
    lyniaLoanId: 'loan-pending-uuid',
    customerName: 'Chipo Ndlovu',
    customerPhone: '+263772345678',
    fineractLoanId: 102,
    fineractAccountNo: '000000102',
    status: {
      id: 100,
      code: 'loanStatusType.submittedAndPendingApproval',
      value: 'Submitted and pending approval',
    },
    approvedOnDate: null,
    actualDisbursementDate: null,
    principalDisbursed: 0,
    principalPaid: 0,
    principalOutstanding: 0,
    totalRepayment: 0,
    totalOutstanding: 0,
    ...overrides,
  });
}

// ============================================================
// REPAYMENT SCHEDULE
// ============================================================

export function createMockRepaymentPeriod(
  period: number,
  overrides: Partial<RepaymentPeriod> = {}
): RepaymentPeriod {
  const baseDate = new Date(2026, 1, 17);
  baseDate.setMonth(baseDate.getMonth() + period);
  const fromDate = new Date(baseDate);
  fromDate.setMonth(fromDate.getMonth() - 1);

  return {
    period,
    fromDate: fromDate.toISOString().split('T')[0],
    dueDate: baseDate.toISOString().split('T')[0],
    paidDate: period <= 2 ? baseDate.toISOString().split('T')[0] : null,
    complete: period <= 2,
    daysInPeriod: 30,
    principalDue: 16.67,
    principalPaid: period <= 2 ? 16.67 : 0,
    principalOutstanding: period <= 2 ? 0 : 16.67,
    interestDue: 6.67,
    interestPaid: period <= 2 ? 6.67 : 0,
    interestOutstanding: period <= 2 ? 0 : 6.67,
    feeChargesDue: 0,
    feeChargesPaid: 0,
    penaltyChargesDue: 0,
    penaltyChargesPaid: 0,
    totalDue: 23.34,
    totalPaid: period <= 2 ? 23.34 : 0,
    totalOutstanding: period <= 2 ? 0 : 23.34,
    totalOverdue: 0,
    balanceOfLoan: 200 - period * 16.67,
    ...overrides,
  };
}

export function createMockRepaymentSchedule(): RepaymentSchedule {
  const periods: RepaymentPeriod[] = [];
  for (let i = 1; i <= 12; i++) {
    periods.push(createMockRepaymentPeriod(i));
  }

  return {
    currency: USD_CURRENCY,
    loanTermInDays: 365,
    totalPrincipalDisbursed: 200,
    totalPrincipalExpected: 200,
    totalPrincipalPaid: 33.34,
    totalInterestCharged: 80,
    totalFeeChargesCharged: 0,
    totalPenaltyChargesCharged: 0,
    totalRepaymentExpected: 280,
    totalRepayment: 46.68,
    totalOutstanding: 233.32,
    periods,
  };
}

// ============================================================
// TRANSACTIONS
// ============================================================

export function createMockTransaction(
  overrides: Partial<FineractTransaction> = {}
): FineractTransaction {
  return {
    id: 501,
    type: 'repayment',
    typeLabel: 'Repayment',
    date: '2026-02-17',
    amount: 23.34,
    principalPortion: 16.67,
    interestPortion: 6.67,
    feeChargesPortion: 0,
    penaltyChargesPortion: 0,
    outstandingLoanBalance: 183.33,
    manuallyReversed: false,
    externalId: 'pay-001-uuid',
    lyniaPaymentId: 'pay-001-uuid',
    ...overrides,
  };
}

export const MOCK_TRANSACTIONS: FineractTransaction[] = [
  createMockTransaction({
    id: 500,
    type: 'disbursement',
    typeLabel: 'Disbursement',
    date: '2026-01-17',
    amount: 200,
    principalPortion: 200,
    interestPortion: 0,
    outstandingLoanBalance: 200,
    externalId: null,
    lyniaPaymentId: undefined,
  }),
  createMockTransaction({
    id: 501,
    date: '2026-02-17',
    outstandingLoanBalance: 183.33,
  }),
  createMockTransaction({
    id: 502,
    date: '2026-03-17',
    outstandingLoanBalance: 166.66,
    lyniaPaymentId: 'pay-002-uuid',
  }),
];

// ============================================================
// LOAN DETAIL
// ============================================================

export function createMockLoanDetail(
  overrides: Partial<FineractLoanDetail> = {}
): FineractLoanDetail {
  return {
    ...createMockLoanView(),
    repaymentSchedule: createMockRepaymentSchedule(),
    transactions: MOCK_TRANSACTIONS,
    ...overrides,
  };
}

// ============================================================
// LOAN PRODUCTS
// ============================================================

export const MOCK_LOAN_PRODUCTS: FineractLoanProductView[] = [
  {
    id: 1,
    name: 'Lynia Device Finance - Tier 1 (Entry)',
    shortName: 'LDF-T1',
    description: 'Entry-level device financing for new customers with credit scores 350-499',
    currency: USD_CURRENCY,
    principal: 100,
    minPrincipal: 50,
    maxPrincipal: 200,
    numberOfRepayments: 12,
    minNumberOfRepayments: 6,
    maxNumberOfRepayments: 12,
    repaymentEvery: 1,
    repaymentFrequency: 'Months',
    interestRatePerPeriod: 5,
    annualInterestRate: 60,
    interestType: 'Declining Balance',
    amortizationType: 'Equal installments',
    accountingRule: 'Accrual (periodic)',
    lyniaTier: 'Tier 1',
    minCreditScore: 350,
    maxCreditScore: 499,
    downPaymentPercentage: 30,
  },
  {
    id: 2,
    name: 'Lynia Device Finance - Tier 2 (Standard)',
    shortName: 'LDF-T2',
    description: 'Standard device financing for customers with credit scores 500-649',
    currency: USD_CURRENCY,
    principal: 350,
    minPrincipal: 200,
    maxPrincipal: 500,
    numberOfRepayments: 12,
    minNumberOfRepayments: 6,
    maxNumberOfRepayments: 12,
    repaymentEvery: 1,
    repaymentFrequency: 'Months',
    interestRatePerPeriod: 4,
    annualInterestRate: 48,
    interestType: 'Declining Balance',
    amortizationType: 'Equal installments',
    accountingRule: 'Accrual (periodic)',
    lyniaTier: 'Tier 2',
    minCreditScore: 500,
    maxCreditScore: 649,
    downPaymentPercentage: 20,
  },
  {
    id: 3,
    name: 'Lynia Device Finance - Tier 3 (Premium)',
    shortName: 'LDF-T3',
    description: 'Premium device financing for established customers with credit scores 650-850',
    currency: USD_CURRENCY,
    principal: 1000,
    minPrincipal: 500,
    maxPrincipal: 2000,
    numberOfRepayments: 18,
    minNumberOfRepayments: 6,
    maxNumberOfRepayments: 18,
    repaymentEvery: 1,
    repaymentFrequency: 'Months',
    interestRatePerPeriod: 3,
    annualInterestRate: 36,
    interestType: 'Declining Balance',
    amortizationType: 'Equal installments',
    accountingRule: 'Accrual (periodic)',
    lyniaTier: 'Tier 3',
    minCreditScore: 650,
    maxCreditScore: 850,
    downPaymentPercentage: 10,
  },
];

// ============================================================
// GL ACCOUNTS
// ============================================================

export const MOCK_GL_ACCOUNTS: GLAccount[] = [
  { id: 1, name: 'Cash and Bank', glCode: '1001', type: 'ASSET', usage: 'DETAIL', description: 'Fund source for disbursements', disabled: false, manualEntriesAllowed: true, parentId: null },
  { id: 2, name: 'Loan Portfolio', glCode: '1100', type: 'ASSET', usage: 'DETAIL', description: 'Outstanding principal balances', disabled: false, manualEntriesAllowed: false, parentId: null },
  { id: 3, name: 'Interest Receivable', glCode: '1200', type: 'ASSET', usage: 'DETAIL', description: 'Accrued interest receivable', disabled: false, manualEntriesAllowed: false, parentId: null },
  { id: 4, name: 'Overpayment Liability', glCode: '2001', type: 'LIABILITY', usage: 'DETAIL', description: 'Client overpayments', disabled: false, manualEntriesAllowed: false, parentId: null },
  { id: 5, name: 'Interest Income', glCode: '4001', type: 'INCOME', usage: 'DETAIL', description: 'Interest income on loans', disabled: false, manualEntriesAllowed: false, parentId: null },
  { id: 6, name: 'Fee Income', glCode: '4002', type: 'INCOME', usage: 'DETAIL', description: 'Fee income from loan fees', disabled: false, manualEntriesAllowed: false, parentId: null },
  { id: 7, name: 'Loan Write-Off', glCode: '5001', type: 'EXPENSE', usage: 'DETAIL', description: 'Loan write-off expense', disabled: false, manualEntriesAllowed: false, parentId: null },
];

// ============================================================
// JOURNAL ENTRIES
// ============================================================

export const MOCK_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 1001,
    officeId: 1,
    officeName: 'Head Office',
    glAccountId: 2,
    glAccountName: 'Loan Portfolio',
    glAccountCode: '1100',
    glAccountType: 'ASSET',
    transactionDate: '2026-01-17',
    entryType: 'DEBIT',
    amount: 200,
    currency: USD_CURRENCY,
    transactionId: 'L101',
    manualEntry: false,
    entityType: 'LOAN',
    entityId: 101,
    reversed: false,
    referenceNumber: null,
    submittedOnDate: '2026-01-17',
  },
  {
    id: 1002,
    officeId: 1,
    officeName: 'Head Office',
    glAccountId: 1,
    glAccountName: 'Cash and Bank',
    glAccountCode: '1001',
    glAccountType: 'ASSET',
    transactionDate: '2026-01-17',
    entryType: 'CREDIT',
    amount: 200,
    currency: USD_CURRENCY,
    transactionId: 'L101',
    manualEntry: false,
    entityType: 'LOAN',
    entityId: 101,
    reversed: false,
    referenceNumber: null,
    submittedOnDate: '2026-01-17',
  },
  {
    id: 1003,
    officeId: 1,
    officeName: 'Head Office',
    glAccountId: 1,
    glAccountName: 'Cash and Bank',
    glAccountCode: '1001',
    glAccountType: 'ASSET',
    transactionDate: '2026-02-17',
    entryType: 'DEBIT',
    amount: 16.67,
    currency: USD_CURRENCY,
    transactionId: 'LT501',
    manualEntry: false,
    entityType: 'LOAN',
    entityId: 101,
    reversed: false,
    referenceNumber: null,
    submittedOnDate: '2026-02-17',
  },
];

// ============================================================
// TRIAL BALANCE
// ============================================================

export const MOCK_TRIAL_BALANCE: TrialBalanceEntry[] = [
  { glAccountId: 1, glAccountName: 'Cash and Bank', glAccountCode: '1001', glAccountType: 'ASSET', totalDebit: 16.67, totalCredit: 200, balance: -183.33 },
  { glAccountId: 2, glAccountName: 'Loan Portfolio', glAccountCode: '1100', glAccountType: 'ASSET', totalDebit: 200, totalCredit: 16.67, balance: 183.33 },
  { glAccountId: 3, glAccountName: 'Interest Receivable', glAccountCode: '1200', glAccountType: 'ASSET', totalDebit: 80, totalCredit: 6.67, balance: 73.33 },
  { glAccountId: 5, glAccountName: 'Interest Income', glAccountCode: '4001', glAccountType: 'INCOME', totalDebit: 0, totalCredit: 80, balance: -80 },
];

// ============================================================
// RECONCILIATION
// ============================================================

export const MOCK_RECONCILIATION: ReconciliationResult = {
  runAt: '2026-02-14T10:30:00Z',
  totalLoansChecked: 45,
  matchedCount: 43,
  discrepancyCount: 2,
  discrepancies: [
    {
      lyniaLoanId: 'loan-disc-001',
      fineractLoanId: 150,
      customerName: 'Tapiwa Madzivire',
      lyniaBalance: 320.50,
      fineractBalance: 315.00,
      difference: 5.50,
      severity: 'medium',
      lastSyncedAt: '2026-02-14T08:00:00Z',
    },
    {
      lyniaLoanId: 'loan-disc-002',
      fineractLoanId: 155,
      customerName: 'Rudo Chigumba',
      lyniaBalance: 180.00,
      fineractBalance: 180.00,
      difference: 0,
      severity: 'low',
      lastSyncedAt: '2026-02-14T08:00:00Z',
    },
  ],
  retriedSyncs: 3,
  retrySuccessCount: 2,
};

// ============================================================
// OVERDUE LOANS
// ============================================================

export function createMockOverdueLoan(
  overrides: Partial<OverdueLoan> = {}
): OverdueLoan {
  return {
    ...createMockLoanView({
      totalOverdue: 46.68,
      principalOverdue: 33.34,
      interestOverdue: 13.34,
      overdueSinceDate: '2026-01-17',
    }),
    daysPastDue: 28,
    agingBucket: '1-30',
    lastPaymentDate: '2026-01-17',
    lastPaymentAmount: 23.34,
    deviceLockStatus: 'unlocked',
    ...overrides,
  };
}

export const MOCK_AGING_SUMMARY: AgingSummary = {
  bucket_1_30: { count: 8, totalOverdue: 1250.00 },
  bucket_31_60: { count: 4, totalOverdue: 890.00 },
  bucket_61_90: { count: 2, totalOverdue: 620.00 },
  bucket_90_plus: { count: 1, totalOverdue: 450.00 },
  totalOverdueLoans: 15,
  totalOverdueAmount: 3210.00,
};
