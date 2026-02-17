/**
 * Apache Fineract API Type Definitions
 *
 * Typed interfaces for the Fineract REST API v1 endpoints used by
 * Lynia Finance Lambda services. Covers clients, loans, repayments,
 * loan products, GL accounts, and journal entries.
 *
 * Reference: https://fineract.apache.org/docs/current
 */

// ============================================================
// COMMON TYPES
// ============================================================

/** Fineract date format: [year, month, day] */
export type FineractDate = [number, number, number];

/** Fineract locale-aware date string */
export type FineractDateString = string; // "dd MMMM yyyy" e.g. "14 February 2026"

/** Fineract standard API response envelope */
export interface FineractCommandResponse {
  officeId: number;
  clientId?: number;
  loanId?: number;
  resourceId: number;
  resourceExternalId?: string;
  changes?: Record<string, unknown>;
}

/** Fineract error response */
export interface FineractErrorResponse {
  developerMessage: string;
  httpStatusCode: string;
  defaultUserMessage: string;
  userMessageGlobalisationCode: string;
  errors: FineractValidationError[];
}

export interface FineractValidationError {
  developerMessage: string;
  defaultUserMessage: string;
  userMessageGlobalisationCode: string;
  parameterName: string;
  value?: unknown;
}

/** Fineract enum value (used throughout the API) */
export interface FineractEnumValue {
  id: number;
  code: string;
  value: string;
}

/** Fineract currency representation */
export interface FineractCurrency {
  code: string;
  name: string;
  decimalPlaces: number;
  inMultiplesOf: number;
  displaySymbol: string;
  nameCode: string;
  displayLabel: string;
}

/** Fineract monetary amount */
export interface FineractMoney {
  currencyCode: string;
  amount: number;
}

// ============================================================
// CLIENT (CUSTOMER) TYPES
// ============================================================

export interface FineractClientCreateRequest {
  officeId: number;
  firstname: string;
  lastname: string;
  externalId?: string;
  mobileNo?: string;
  dateOfBirth?: FineractDateString;
  gender?: number; // Code value ID
  locale: string;
  dateFormat: string;
  active: boolean;
  activationDate?: FineractDateString;
  submittedOnDate?: FineractDateString;
}

export interface FineractClient {
  id: number;
  accountNo: string;
  externalId?: string;
  status: FineractEnumValue;
  active: boolean;
  activationDate: FineractDate;
  firstname: string;
  lastname: string;
  displayName: string;
  mobileNo?: string;
  dateOfBirth?: FineractDate;
  gender?: FineractEnumValue;
  officeId: number;
  officeName: string;
  timeline: {
    submittedOnDate: FineractDate;
    submittedByUsername: string;
    submittedByFirstname: string;
    submittedByLastname: string;
    activatedOnDate?: FineractDate;
    activatedByUsername?: string;
    activatedByFirstname?: string;
    activatedByLastname?: string;
  };
}

// ============================================================
// LOAN TYPES
// ============================================================

export type LoanStatus =
  | 'loanStatusType.submittedAndPendingApproval'
  | 'loanStatusType.approved'
  | 'loanStatusType.active'
  | 'loanStatusType.closed.obligations.met'
  | 'loanStatusType.closed.written.off'
  | 'loanStatusType.closed.reschedule.outstanding.amount'
  | 'loanStatusType.overpaid'
  | 'loanStatusType.rejected'
  | 'loanStatusType.withdrawn.by.client';

export interface FineractLoanCreateRequest {
  clientId: number;
  productId: number;
  principal: number;
  loanTermFrequency: number;
  loanTermFrequencyType: number; // 0=days, 1=weeks, 2=months, 3=years
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: number;
  interestRatePerPeriod: number;
  amortizationType: number; // 0=equal installments, 1=equal principal
  interestType: number; // 0=declining balance, 1=flat
  interestCalculationPeriodType: number; // 0=daily, 1=same as repayment
  transactionProcessingStrategyCode: string;
  expectedDisbursementDate: FineractDateString;
  submittedOnDate: FineractDateString;
  locale: string;
  dateFormat: string;
  loanType: string; // "individual" | "group" | "jlg"
  externalId?: string;
}

export interface FineractLoan {
  id: number;
  accountNo: string;
  externalId?: string;
  status: FineractEnumValue & { code: LoanStatus };
  clientId: number;
  clientName: string;
  clientOfficeId: number;
  loanProductId: number;
  loanProductName: string;
  loanProductDescription: string;
  principal: FineractMoney;
  approvedPrincipal: FineractMoney;
  proposedPrincipal: FineractMoney;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: FineractEnumValue;
  interestRatePerPeriod: number;
  interestRateFrequencyType: FineractEnumValue;
  annualInterestRate: number;
  amortizationType: FineractEnumValue;
  interestType: FineractEnumValue;
  interestCalculationPeriodType: FineractEnumValue;
  transactionProcessingStrategyCode: string;
  transactionProcessingStrategyName: string;
  currency: FineractCurrency;
  loanType: FineractEnumValue;
  timeline: FineractLoanTimeline;
  summary: FineractLoanSummary;
  repaymentSchedule?: FineractRepaymentSchedule;
  transactions?: FineractLoanTransaction[];
}

export interface FineractLoanTimeline {
  submittedOnDate: FineractDate;
  submittedByUsername: string;
  submittedByFirstname: string;
  submittedByLastname: string;
  approvedOnDate?: FineractDate;
  approvedByUsername?: string;
  approvedByFirstname?: string;
  approvedByLastname?: string;
  expectedDisbursementDate: FineractDate;
  actualDisbursementDate?: FineractDate;
  disbursedByUsername?: string;
  disbursedByFirstname?: string;
  disbursedByLastname?: string;
  closedOnDate?: FineractDate;
  expectedMaturityDate: FineractDate;
}

export interface FineractLoanSummary {
  currency: FineractCurrency;
  principalDisbursed: number;
  principalPaid: number;
  principalWrittenOff: number;
  principalOutstanding: number;
  principalOverdue: number;
  interestCharged: number;
  interestPaid: number;
  interestWaived: number;
  interestWrittenOff: number;
  interestOutstanding: number;
  interestOverdue: number;
  feeChargesCharged: number;
  feeChargesDueAtDisbursementCharged: number;
  feeChargesPaid: number;
  feeChargesWaived: number;
  feeChargesWrittenOff: number;
  feeChargesOutstanding: number;
  feeChargesOverdue: number;
  penaltyChargesCharged: number;
  penaltyChargesPaid: number;
  penaltyChargesWaived: number;
  penaltyChargesWrittenOff: number;
  penaltyChargesOutstanding: number;
  penaltyChargesOverdue: number;
  totalExpectedRepayment: number;
  totalRepayment: number;
  totalExpectedCostOfLoan: number;
  totalCostOfLoan: number;
  totalWaived: number;
  totalWrittenOff: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueSinceDate?: FineractDate;
  linkedAccount?: { id: number; accountNo: string };
}

// ============================================================
// REPAYMENT SCHEDULE TYPES
// ============================================================

export interface FineractRepaymentSchedule {
  currency: FineractCurrency;
  loanTermInDays: number;
  totalPrincipalDisbursed: number;
  totalPrincipalExpected: number;
  totalPrincipalPaid: number;
  totalInterestCharged: number;
  totalFeeChargesCharged: number;
  totalPenaltyChargesCharged: number;
  totalWaived: number;
  totalWrittenOff: number;
  totalRepaymentExpected: number;
  totalRepayment: number;
  totalOutstanding: number;
  periods: FineractRepaymentPeriod[];
}

export interface FineractRepaymentPeriod {
  period: number; // 0 = disbursement, 1+ = repayment periods
  fromDate: FineractDate;
  dueDate: FineractDate;
  obligationsMetOnDate?: FineractDate;
  complete: boolean;
  daysInPeriod: number;
  principalOriginalDue: number;
  principalDue: number;
  principalPaid: number;
  principalWrittenOff: number;
  principalOutstanding: number;
  principalLoanBalanceOutstanding: number;
  interestOriginalDue: number;
  interestDue: number;
  interestPaid: number;
  interestWaived: number;
  interestWrittenOff: number;
  interestOutstanding: number;
  feeChargesDue: number;
  feeChargesPaid: number;
  feeChargesWaived: number;
  feeChargesWrittenOff: number;
  feeChargesOutstanding: number;
  penaltyChargesDue: number;
  penaltyChargesPaid: number;
  penaltyChargesWaived: number;
  penaltyChargesWrittenOff: number;
  penaltyChargesOutstanding: number;
  totalOriginalDueForPeriod: number;
  totalDueForPeriod: number;
  totalPaidForPeriod: number;
  totalPaidInAdvanceForPeriod: number;
  totalPaidLateForPeriod: number;
  totalWaivedForPeriod: number;
  totalWrittenOffForPeriod: number;
  totalOutstandingForPeriod: number;
  totalActualCostOfLoanForPeriod: number;
  totalInstallmentAmountForPeriod: number;
}

// ============================================================
// LOAN TRANSACTION TYPES
// ============================================================

export interface FineractLoanTransactionRequest {
  transactionDate: FineractDateString;
  transactionAmount: number;
  paymentTypeId?: number;
  note?: string;
  locale: string;
  dateFormat: string;
  externalId?: string;
}

export interface FineractLoanTransaction {
  id: number;
  officeId: number;
  type: FineractEnumValue & {
    disbursement: boolean;
    repaymentAtDisbursement: boolean;
    repayment: boolean;
    contra: boolean;
    waiveInterest: boolean;
    waiveCharges: boolean;
    accrual: boolean;
    writeOff: boolean;
    recoveryRepayment: boolean;
    initiateTransfer: boolean;
    approveTransfer: boolean;
    withdrawTransfer: boolean;
    rejectTransfer: boolean;
    chargePayment: boolean;
    refund: boolean;
    refundForActiveLoans: boolean;
  };
  date: FineractDate;
  currency: FineractCurrency;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  feeChargesPortion: number;
  penaltyChargesPortion: number;
  overpaymentPortion: number;
  unrecognizedIncomePortion: number;
  outstandingLoanBalance: number;
  submittedOnDate: FineractDate;
  manuallyReversed: boolean;
  externalId?: string;
}

// ============================================================
// LOAN PRODUCT TYPES
// ============================================================

export interface FineractLoanProductCreateRequest {
  name: string;
  shortName: string;
  description?: string;
  currencyCode: string;
  digitsAfterDecimal: number;
  inMultiplesOf: number;
  principal: number;
  minPrincipal?: number;
  maxPrincipal?: number;
  numberOfRepayments: number;
  minNumberOfRepayments?: number;
  maxNumberOfRepayments?: number;
  repaymentEvery: number;
  repaymentFrequencyType: number;
  interestRatePerPeriod: number;
  minInterestRatePerPeriod?: number;
  maxInterestRatePerPeriod?: number;
  interestRateFrequencyType: number;
  amortizationType: number;
  interestType: number;
  interestCalculationPeriodType: number;
  transactionProcessingStrategyCode: string;
  locale: string;
  dateFormat: string;
  accountingRule: number; // 1=none, 2=cash, 3=accrual, 4=upfront accrual
  // Fund source and accounting mappings (when accountingRule > 1)
  fundSourceAccountId?: number;
  loanPortfolioAccountId?: number;
  transfersInSuspenseAccountId?: number;
  interestOnLoanAccountId?: number;
  incomeFromFeeAccountId?: number;
  incomeFromPenaltyAccountId?: number;
  writeOffAccountId?: number;
  overpaymentLiabilityAccountId?: number;
  receivableInterestAccountId?: number;
  receivableFeeAccountId?: number;
  receivablePenaltyAccountId?: number;
}

export interface FineractLoanProduct {
  id: number;
  name: string;
  shortName: string;
  description: string;
  currency: FineractCurrency;
  principal: number;
  minPrincipal: number;
  maxPrincipal: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: FineractEnumValue;
  interestRatePerPeriod: number;
  interestRateFrequencyType: FineractEnumValue;
  annualInterestRate: number;
  amortizationType: FineractEnumValue;
  interestType: FineractEnumValue;
  interestCalculationPeriodType: FineractEnumValue;
  transactionProcessingStrategyCode: string;
  transactionProcessingStrategyName: string;
  accountingRule: FineractEnumValue;
  accountingMappings?: Record<string, { id: number; name: string; glCode: string }>;
}

// ============================================================
// GL ACCOUNT TYPES
// ============================================================

export interface FineractGLAccountCreateRequest {
  name: string;
  glCode: string;
  manualEntriesAllowed: boolean;
  type: number; // 1=asset, 2=liability, 3=equity, 4=income, 5=expense
  usage: number; // 1=header, 2=detail
  description?: string;
  parentId?: number;
}

export interface FineractGLAccount {
  id: number;
  name: string;
  parentId?: number;
  glCode: string;
  disabled: boolean;
  manualEntriesAllowed: boolean;
  type: FineractEnumValue;
  usage: FineractEnumValue;
  description?: string;
  nameDecorated: string;
}

// ============================================================
// JOURNAL ENTRY TYPES
// ============================================================

export interface FineractJournalEntry {
  id: number;
  officeId: number;
  officeName: string;
  glAccountId: number;
  glAccountName: string;
  glAccountCode: string;
  glAccountType: FineractEnumValue;
  transactionDate: FineractDate;
  entryType: FineractEnumValue; // CREDIT or DEBIT
  amount: number;
  currency: FineractCurrency;
  transactionId: string;
  manualEntry: boolean;
  entityType: FineractEnumValue;
  entityId: number;
  createdDate: FineractDate;
  createdByUsername: string;
  reversed: boolean;
  referenceNumber?: string;
  officeRunningBalance: number;
  organizationRunningBalance: number;
  submittedOnDate: FineractDate;
}

// ============================================================
// OFFICE TYPES
// ============================================================

export interface FineractOffice {
  id: number;
  name: string;
  nameDecorated: string;
  externalId?: string;
  openingDate: FineractDate;
  hierarchy: string;
  parentId?: number;
  parentName?: string;
}

// ============================================================
// LYNIA-SPECIFIC MAPPING TYPES
// ============================================================

/** Maps Lynia customer IDs to Fineract client IDs */
export interface LyniaFineractClientMapping {
  lynia_customer_id: string; // UUID
  fineract_client_id: number;
  fineract_account_no: string;
  synced_at: string; // ISO8601
}

/** Maps Lynia loan IDs to Fineract loan IDs */
export interface LyniaFineractLoanMapping {
  lynia_loan_id: string; // UUID
  fineract_loan_id: number;
  fineract_loan_account_no: string;
  fineract_product_id: number;
  synced_at: string;
}

/** Maps Lynia payment IDs to Fineract transaction IDs */
export interface LyniaFineractTransactionMapping {
  lynia_payment_id: string; // UUID
  fineract_transaction_id: number;
  synced_at: string;
}

// ============================================================
// INTEROPERATION MODULE TYPES (Mojaloop-compatible)
// ============================================================

/** Identifier type for interop party lookup */
export type InteropIdentifierType = 'MSISDN' | 'ACCOUNT_ID' | 'EMAIL' | 'PERSONAL_ID' | 'BUSINESS' | 'DEVICE' | 'IBAN' | 'ALIAS';

/** Interop transaction role */
export type InteropTransactionRole = 'PAYER' | 'PAYEE';

/** Interop transfer action type */
export type InteropActionType = 'PREPARE' | 'CREATE';

/** Interop transaction state */
export type InteropTransferState = 'RECEIVED' | 'RESERVED' | 'COMMITTED' | 'ABORTED';

/** Register a party identifier (e.g., MSISDN) with Fineract interop */
export interface FineractInteropPartyRequest {
  idType: InteropIdentifierType;
  idValue: string;
  subIdOrType?: string;
}

/** Party lookup response */
export interface FineractInteropPartyResponse {
  party: {
    partyIdInfo: {
      partyIdType: InteropIdentifierType;
      partyIdentifier: string;
      partySubIdOrType?: string;
      fspId: string;
    };
    name?: string;
    personalInfo?: {
      complexName?: {
        firstName?: string;
        middleName?: string;
        lastName?: string;
      };
      dateOfBirth?: string;
    };
  };
}

/** Interop transfer prepare/create request */
export interface FineractInteropTransferRequest {
  transferId: string; // UUID
  payeeFsp: string;
  payerFsp: string;
  amount: {
    amount: string; // Decimal string, e.g. "100.00"
    currency: string; // ISO 4217 e.g. "USD"
  };
  ilpPacket?: string;
  condition?: string;
  expiration?: string; // ISO 8601 datetime
  note?: string;
  extensionList?: Array<{ key: string; value: string }>;
}

/** Interop transfer response */
export interface FineractInteropTransferResponse {
  transferId: string;
  transferState: InteropTransferState;
  completedTimestamp?: string;
  fulfilment?: string;
  extensionList?: Array<{ key: string; value: string }>;
}

/** Interop account identifier registration */
export interface FineractInteropIdentifier {
  idType: InteropIdentifierType;
  idValue: string;
  subIdOrType?: string;
  fspId?: string;
}

/** Interop health check response */
export interface FineractInteropHealthResponse {
  status: string;
  startedAt?: string;
  versionInfo?: {
    version?: string;
  };
}

// ============================================================
// FINERACT CLIENT CONFIGURATION
// ============================================================

export interface FineractClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  tenantId: string;
  timeoutMs?: number;
  rejectUnauthorized?: boolean;
}
