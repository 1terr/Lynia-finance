/**
 * Fineract Loan Operations
 *
 * Loan CRUD, approval, disbursement, repayment, and related operations.
 */

import type {
  FineractCommandResponse,
  FineractLoanCreateRequest,
  FineractLoan,
  FineractLoanTransactionRequest,
  FineractLoanTransaction,
  FineractLoanProduct,
  FineractLoanProductCreateRequest,
} from '../../types/fineract';

const DATE_FORMAT = 'dd MMMM yyyy';
const LOCALE = 'en';

type RequestFn = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => Promise<T>;

/**
 * Create loan-related operations bound to a request function
 */
export function createLoanOperations(request: RequestFn, formatDate: (d: Date) => string) {
  return {
    // ----------------------------------------------------------
    // LOAN PRODUCTS
    // ----------------------------------------------------------

    /** List all loan products */
    async listLoanProducts(): Promise<FineractLoanProduct[]> {
      return request<FineractLoanProduct[]>('GET', '/loanproducts');
    },

    /** Get a specific loan product */
    async getLoanProduct(productId: number): Promise<FineractLoanProduct> {
      return request<FineractLoanProduct>('GET', `/loanproducts/${productId}`);
    },

    /** Create a new loan product */
    async createLoanProduct(
      product: FineractLoanProductCreateRequest
    ): Promise<FineractCommandResponse> {
      return request<FineractCommandResponse>('POST', '/loanproducts', product);
    },

    /** Update an existing loan product */
    async updateLoanProduct(
      productId: number,
      product: Partial<FineractLoanProductCreateRequest>
    ): Promise<FineractCommandResponse> {
      return request<FineractCommandResponse>('PUT', `/loanproducts/${productId}`, product);
    },

    // ----------------------------------------------------------
    // LOANS
    // ----------------------------------------------------------

    /**
     * Create a loan application in Fineract.
     * The loan starts in "submitted and pending approval" state.
     */
    async createLoan(params: {
      clientId: number;
      productId: number;
      principal: number;
      numberOfRepayments: number;
      repaymentEveryMonths: number;
      interestRatePerMonth: number;
      expectedDisbursementDate: Date;
      externalId?: string;
    }): Promise<FineractCommandResponse> {
      const body: FineractLoanCreateRequest = {
        clientId: params.clientId,
        productId: params.productId,
        principal: params.principal,
        loanTermFrequency: params.numberOfRepayments * params.repaymentEveryMonths,
        loanTermFrequencyType: 2,
        numberOfRepayments: params.numberOfRepayments,
        repaymentEvery: params.repaymentEveryMonths,
        repaymentFrequencyType: 2,
        interestRatePerPeriod: params.interestRatePerMonth,
        amortizationType: 0,
        interestType: 0,
        interestCalculationPeriodType: 1,
        transactionProcessingStrategyCode: 'mifos-standard-strategy',
        expectedDisbursementDate: formatDate(params.expectedDisbursementDate),
        submittedOnDate: formatDate(new Date()),
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
        loanType: 'individual',
        externalId: params.externalId,
      };

      return request<FineractCommandResponse>('POST', '/loans', body);
    },

    /** Get a loan by Fineract ID */
    async getLoan(loanId: number, associations?: string[]): Promise<FineractLoan> {
      const assoc = associations?.length
        ? `?associations=${associations.join(',')}`
        : '';
      return request<FineractLoan>('GET', `/loans/${loanId}${assoc}`);
    },

    /** Get a loan by external ID (Lynia loan UUID) */
    async getLoanByExternalId(externalId: string): Promise<FineractLoan> {
      return request<FineractLoan>('GET', `/loans/external-id/${externalId}`);
    },

    /** Get loan with full repayment schedule */
    async getLoanWithSchedule(loanId: number): Promise<FineractLoan> {
      const assoc = '?associations=repaymentSchedule';
      return request<FineractLoan>('GET', `/loans/${loanId}${assoc}`);
    },

    /** Get loan with transactions */
    async getLoanWithTransactions(loanId: number): Promise<FineractLoan> {
      const assoc = '?associations=repaymentSchedule,transactions';
      return request<FineractLoan>('GET', `/loans/${loanId}${assoc}`);
    },

    /**
     * Approve a loan application.
     * Transitions: submittedAndPendingApproval -> approved
     */
    async approveLoan(loanId: number, approvedOnDate?: Date): Promise<FineractCommandResponse> {
      const body = {
        approvedOnDate: formatDate(approvedOnDate || new Date()),
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
      };

      return request<FineractCommandResponse>('POST', `/loans/${loanId}?command=approve`, body);
    },

    /**
     * Disburse a loan.
     * Transitions: approved -> active
     * Creates GL journal entries (debit loan portfolio, credit fund source).
     */
    async disburseLoan(
      loanId: number,
      actualDisbursementDate?: Date,
      paymentTypeId?: number
    ): Promise<FineractCommandResponse> {
      const body: Record<string, unknown> = {
        actualDisbursementDate: formatDate(actualDisbursementDate || new Date()),
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
      };

      if (paymentTypeId) {
        body.paymentTypeId = paymentTypeId;
      }

      return request<FineractCommandResponse>('POST', `/loans/${loanId}?command=disburse`, body);
    },

    /**
     * Post a repayment against a loan.
     * Reduces outstanding balance and creates GL journal entries.
     */
    async postRepayment(params: {
      loanId: number;
      amount: number;
      transactionDate: Date;
      paymentTypeId?: number;
      note?: string;
      externalId?: string;
    }): Promise<FineractCommandResponse> {
      const body: FineractLoanTransactionRequest = {
        transactionDate: formatDate(params.transactionDate),
        transactionAmount: params.amount,
        paymentTypeId: params.paymentTypeId,
        note: params.note,
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
        externalId: params.externalId,
      };

      return request<FineractCommandResponse>(
        'POST',
        `/loans/${params.loanId}/transactions?command=repayment`,
        body
      );
    },

    /**
     * Get a specific loan transaction
     */
    async getLoanTransaction(
      loanId: number,
      transactionId: number
    ): Promise<FineractLoanTransaction> {
      return request<FineractLoanTransaction>(
        'GET',
        `/loans/${loanId}/transactions/${transactionId}`
      );
    },

    /**
     * Reject a loan application.
     * Transitions: submittedAndPendingApproval -> rejected
     */
    async rejectLoan(
      loanId: number,
      rejectedOnDate: Date,
      note: string
    ): Promise<FineractCommandResponse> {
      const body = {
        rejectedOnDate: formatDate(rejectedOnDate),
        note,
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
      };

      return request<FineractCommandResponse>('POST', `/loans/${loanId}?command=reject`, body);
    },

    /**
     * Write off a loan.
     * Transitions: active (overdue) -> closedWrittenOff
     * Creates GL journal entries (debit provisions, credit loan portfolio).
     */
    async writeOffLoan(
      loanId: number,
      transactionDate: Date,
      note?: string
    ): Promise<FineractCommandResponse> {
      const body: Record<string, unknown> = {
        transactionDate: formatDate(transactionDate),
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
      };

      if (note) {
        body.note = note;
      }

      return request<FineractCommandResponse>(
        'POST',
        `/loans/${loanId}/transactions?command=writeoff`,
        body
      );
    },

    /**
     * Close a fully-paid loan.
     * Transitions: active (zero balance) -> closedObligationsMet
     */
    async closeLoan(
      loanId: number,
      closedOnDate: Date
    ): Promise<FineractCommandResponse> {
      const body = {
        transactionDate: formatDate(closedOnDate),
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
      };

      return request<FineractCommandResponse>('POST', `/loans/${loanId}?command=close`, body);
    },

    /**
     * Restructure (reschedule) a loan.
     * Submits a reschedule request to Fineract with optional grace periods,
     * extra terms, or a new interest rate.
     */
    async restructureLoan(loanId: number, params: {
      rescheduleFromDate: string;
      adjustedDueDate?: string;
      graceOnPrincipal?: number;
      graceOnInterest?: number;
      extraTerms?: number;
      newInterestRate?: number;
      rescheduleReasonCodeValueId: number;
      rescheduleReasonComment?: string;
      submittedOnDate?: string;
    }): Promise<FineractCommandResponse> {
      const body: Record<string, unknown> = {
        loanId,
        rescheduleFromDate: params.rescheduleFromDate,
        rescheduleReasonCodeValueId: params.rescheduleReasonCodeValueId,
        submittedOnDate: params.submittedOnDate || formatDate(new Date()),
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
      };

      if (params.adjustedDueDate) body.adjustedDueDate = params.adjustedDueDate;
      if (params.graceOnPrincipal !== undefined) body.graceOnPrincipal = params.graceOnPrincipal;
      if (params.graceOnInterest !== undefined) body.graceOnInterest = params.graceOnInterest;
      if (params.extraTerms !== undefined) body.extraTerms = params.extraTerms;
      if (params.newInterestRate !== undefined) body.newInterestRate = params.newInterestRate;
      if (params.rescheduleReasonComment) body.rescheduleReasonComment = params.rescheduleReasonComment;

      return request<FineractCommandResponse>('POST', '/rescheduleloans', body);
    },

    /**
     * Calculate early payoff amount for a loan.
     * Returns the full loan object with repaymentSchedule and transactions
     * so the caller can read summary.totalOutstanding.
     */
    async calculateEarlyPayoff(loanId: number): Promise<FineractLoan> {
      return request<FineractLoan>(
        'GET',
        `/loans/${loanId}?associations=repaymentSchedule,transactions`
      );
    },

    /**
     * Process an early (full balance) payoff for a loan.
     * Posts a repayment transaction for the entire outstanding amount.
     */
    async processEarlyPayoff(params: {
      loanId: number;
      amount: number;
      transactionDate: string;
      paymentTypeId?: number;
      note?: string;
    }): Promise<FineractCommandResponse> {
      const body: Record<string, unknown> = {
        transactionDate: params.transactionDate,
        transactionAmount: params.amount,
        locale: LOCALE,
        dateFormat: DATE_FORMAT,
      };

      if (params.paymentTypeId) body.paymentTypeId = params.paymentTypeId;
      if (params.note) body.note = params.note;

      return request<FineractCommandResponse>(
        'POST',
        `/loans/${params.loanId}/transactions?command=repayment`,
        body
      );
    },
  };
}
