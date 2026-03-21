// ============================================================
// Fineract UI Types for Admin Portal (Phase 7)
// ============================================================

/**
 * Fineract loan status codes mapped to UI-friendly labels.
 * These come directly from the Fineract REST API.
 */
export type FineractLoanStatusCode =
  | 'loanStatusType.submittedAndPendingApproval'
  | 'loanStatusType.approved'
  | 'loanStatusType.active'
  | 'loanStatusType.closed.obligations.met'
  | 'loanStatusType.closed.written.off'
  | 'loanStatusType.closed.reschedule.outstanding.amount'
  | 'loanStatusType.overpaid'
  | 'loanStatusType.rejected'
  | 'loanStatusType.withdrawn.by.client'
  | 'loanStatusType.defaulted'
  | 'loanStatusType.cancelled';

export interface FineractEnumValue {
  id: number;
  code: string;
  value: string;
}

export interface FineractCurrency {
  code: string;
  name: string;
  decimalPlaces: number;
  displaySymbol: string;
  displayLabel: string;
}

// ============================================================
// LOAN TYPES
// ============================================================

/** Combined Lynia + Fineract loan view for the dashboard */
export interface FineractLoanView {
  // Lynia identifiers
  lyniaLoanId: string;
  lyniaCustomerId: string;
  customerName: string;
  customerPhone: string;

  // Fineract identifiers
  fineractLoanId: number;
  fineractAccountNo: string;
  fineractClientId: number;

  // Loan details
  productName: string;
  productId: number;
  principal: number;
  approvedPrincipal: number;
  currency: FineractCurrency;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequency: string;
  interestRatePerPeriod: number;
  annualInterestRate: number;
  interestType: string;
  amortizationType: string;

  // Status
  status: FineractEnumValue & { code: FineractLoanStatusCode };

  // Timeline
  submittedOnDate: string | null;
  approvedOnDate: string | null;
  expectedDisbursementDate: string | null;
  actualDisbursementDate: string | null;
  expectedMaturityDate: string | null;
  closedOnDate: string | null;

  // Summary (balances from Fineract)
  principalDisbursed: number;
  principalPaid: number;
  principalOutstanding: number;
  principalOverdue: number;
  interestCharged: number;
  interestPaid: number;
  interestOutstanding: number;
  interestOverdue: number;
  feeChargesCharged: number;
  feeChargesPaid: number;
  feeChargesOutstanding: number;
  penaltyChargesCharged: number;
  penaltyChargesPaid: number;
  penaltyChargesOutstanding: number;
  totalExpectedRepayment: number;
  totalRepayment: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueSinceDate: string | null;

  // Device info (from Lynia DB)
  deviceBrand?: string;
  deviceModel?: string;
  deviceImei?: string;

  // Default / Cancellation info (from Lynia DB)
  defaultedAt?: string | null;
  cancelledAt?: string | null;
}

/** Repayment schedule period from Fineract */
export interface RepaymentPeriod {
  period: number;
  fromDate: string;
  dueDate: string;
  paidDate: string | null;
  complete: boolean;
  daysInPeriod: number;
  principalDue: number;
  principalPaid: number;
  principalOutstanding: number;
  interestDue: number;
  interestPaid: number;
  interestOutstanding: number;
  feeChargesDue: number;
  feeChargesPaid: number;
  penaltyChargesDue: number;
  penaltyChargesPaid: number;
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  balanceOfLoan: number;
}

/** Full repayment schedule from Fineract */
export interface RepaymentSchedule {
  currency: FineractCurrency;
  loanTermInDays: number;
  totalPrincipalDisbursed: number;
  totalPrincipalExpected: number;
  totalPrincipalPaid: number;
  totalInterestCharged: number;
  totalFeeChargesCharged: number;
  totalPenaltyChargesCharged: number;
  totalRepaymentExpected: number;
  totalRepayment: number;
  totalOutstanding: number;
  periods: RepaymentPeriod[];
}

/** Loan transaction from Fineract */
export interface FineractTransaction {
  id: number;
  type: string;
  typeLabel: string;
  date: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  feeChargesPortion: number;
  penaltyChargesPortion: number;
  outstandingLoanBalance: number;
  manuallyReversed: boolean;
  externalId: string | null;
  // Lynia payment reference
  lyniaPaymentId?: string;
}

/** Full loan detail view including schedule and transactions */
export interface FineractLoanDetail extends FineractLoanView {
  repaymentSchedule: RepaymentSchedule | null;
  transactions: FineractTransaction[];
}

// ============================================================
// LOAN PRODUCT TYPES
// ============================================================

export interface FineractLoanProductView {
  id: number;
  name: string;
  shortName: string;
  description: string;
  currency: FineractCurrency;
  principal: number;
  minPrincipal: number;
  maxPrincipal: number;
  numberOfRepayments: number;
  minNumberOfRepayments?: number;
  maxNumberOfRepayments?: number;
  repaymentEvery: number;
  repaymentFrequency: string;
  interestRatePerPeriod: number;
  annualInterestRate: number;
  interestType: string;
  amortizationType: string;
  accountingRule: string;
  // Lynia product eligibility
  minCreditScore?: number;
  maxCreditScore?: number;
  productCategory?: 'smartphone' | 'digital';
  downPaymentPercentage?: number;
  // Data source: 'fineract' if from core banking, 'lynia' if from local DB fallback
  source?: 'fineract' | 'lynia';
  // GL account mappings
  accountingMappings?: Record<string, { id: number; name: string; glCode: string }>;
}

// ============================================================
// GL / ACCOUNTING TYPES
// ============================================================

export interface GLAccount {
  id: number;
  name: string;
  glCode: string;
  type: string;
  usage: string;
  description: string | null;
  disabled: boolean;
  manualEntriesAllowed: boolean;
  parentId: number | null;
}

export interface JournalEntry {
  id: number;
  officeId: number;
  officeName: string;
  glAccountId: number;
  glAccountName: string;
  glAccountCode: string;
  glAccountType: string;
  transactionDate: string;
  entryType: 'CREDIT' | 'DEBIT';
  amount: number;
  currency: FineractCurrency;
  transactionId: string;
  manualEntry: boolean;
  entityType: string;
  entityId: number;
  reversed: boolean;
  referenceNumber: string | null;
  submittedOnDate: string;
}

/** Trial balance entry for a single GL account */
export interface TrialBalanceEntry {
  glAccountId: number;
  glAccountName: string;
  glAccountCode: string;
  glAccountType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

// ============================================================
// RECONCILIATION TYPES
// ============================================================

export interface ReconciliationResult {
  runAt: string;
  totalLoansChecked: number;
  matchedCount: number;
  discrepancyCount: number;
  discrepancies: ReconciliationDiscrepancy[];
  retriedSyncs: number;
  retrySuccessCount: number;
  fineractReachable: boolean;
}

export interface ReconciliationDiscrepancy {
  lyniaLoanId: string;
  fineractLoanId: number;
  customerName: string;
  lyniaBalance: number;
  fineractBalance: number;
  difference: number;
  severity: 'low' | 'medium' | 'high';
  lastSyncedAt: string;
}

// ============================================================
// OVERDUE / AGING TYPES
// ============================================================

export interface OverdueLoan extends FineractLoanView {
  daysPastDue: number;
  agingBucket: '1-30' | '31-60' | '61-90' | '90+';
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  deviceLockStatus: 'unlocked' | 'locked' | 'pending';
}

export interface AgingSummary {
  bucket_1_30: { count: number; totalOverdue: number };
  bucket_31_60: { count: number; totalOverdue: number };
  bucket_61_90: { count: number; totalOverdue: number };
  bucket_90_plus: { count: number; totalOverdue: number };
  totalOverdueLoans: number;
  totalOverdueAmount: number;
}

// ============================================================
// ACTION REQUEST/RESPONSE TYPES
// ============================================================

export interface ApproveLoanRequest {
  approvedOnDate: string;
  note?: string;
}

export interface DisburseLoanRequest {
  actualDisbursementDate: string;
  paymentTypeId?: number;
  note?: string;
}

export interface RecordRepaymentRequest {
  transactionDate: string;
  transactionAmount: number;
  paymentTypeId?: number;
  note?: string;
  lyniaPaymentMethod?: string;
}

export interface FineractActionResponse {
  success: boolean;
  resourceId: number;
  loanId?: number;
  message?: string;
}

// ============================================================
// FINERACT STATUS HELPERS
// ============================================================

export const FINERACT_STATUS_MAP: Record<FineractLoanStatusCode, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  'loanStatusType.submittedAndPendingApproval': {
    label: 'Pending Approval',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
  },
  'loanStatusType.approved': {
    label: 'Approved',
    color: 'text-blue-800',
    bgColor: 'bg-blue-100',
  },
  'loanStatusType.active': {
    label: 'Active',
    color: 'text-green-800',
    bgColor: 'bg-green-100',
  },
  'loanStatusType.closed.obligations.met': {
    label: 'Closed (Paid)',
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
  },
  'loanStatusType.closed.written.off': {
    label: 'Written Off',
    color: 'text-red-900',
    bgColor: 'bg-red-200',
  },
  'loanStatusType.closed.reschedule.outstanding.amount': {
    label: 'Rescheduled',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
  },
  'loanStatusType.overpaid': {
    label: 'Overpaid',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100',
  },
  'loanStatusType.rejected': {
    label: 'Rejected',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
  },
  'loanStatusType.withdrawn.by.client': {
    label: 'Withdrawn',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
  'loanStatusType.defaulted': {
    label: 'Defaulted',
    color: 'text-red-900',
    bgColor: 'bg-red-200',
  },
  'loanStatusType.cancelled': {
    label: 'Cancelled',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
  },
};

/**
 * Get a human-readable label and color for a Fineract loan status code.
 */
export function getFineractStatusDisplay(code: FineractLoanStatusCode) {
  return FINERACT_STATUS_MAP[code] || {
    label: code,
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
  };
}

// ============================================================
// CORE BANKING SYSTEM HEALTH TYPES
// ============================================================

export interface CoreBankingHealthResult {
  timestamp: string;
  infrastructure: {
    fineractReachable: boolean;
    circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    apiResponseMs: number;
  };
  syncPipeline: {
    pendingCount: number;
    failedCount: number;
    exhaustedCount: number;
    successRate24h: number;
    totalSyncs24h: number;
    lastSyncAt: string | null;
  };
  dataIntegrity: {
    unsyncedCustomers: number;
    unsyncedLoans: number;
    unsyncedPayments: number;
    discrepancies: { high: number; medium: number; low: number };
  };
  portfolio: {
    totalLoansChecked: number;
    matchedCount: number;
    discrepancyCount: number;
    lastReconciliationAt: string | null;
  };
  accounting: {
    trialBalanceBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
    imbalance: number;
    lastJournalEntryAt: string | null;
  };
}
