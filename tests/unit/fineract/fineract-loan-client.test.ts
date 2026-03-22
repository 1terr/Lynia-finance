/**
 * Fineract Loan Client Unit Tests
 *
 * Tests for the loan lifecycle operations in loan-client.ts:
 *   - createLoan, approveLoan, disburseLoan, postRepayment
 *   - rejectLoan, writeOffLoan, closeLoan, withdrawLoan
 *   - Error handling for 4xx, 5xx, and connection timeouts
 *
 * All HTTP calls are mocked via a stub request function.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createLoanOperations } from '../../../services/shared/clients/fineract/loan-client';

// ============================================================
// MOCK SETUP
// ============================================================

type RequestFn = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => Promise<T>;

let mockRequest: jest.Mock;
let loanOps: ReturnType<typeof createLoanOperations>;

/**
 * Format a Date to Fineract's "dd MMMM yyyy" format.
 * Mirrors the production formatDate helper.
 */
function formatDate(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

beforeEach(() => {
  mockRequest = jest.fn() as jest.Mock;
  loanOps = createLoanOperations(mockRequest as unknown as RequestFn, formatDate);
});

// ============================================================
// createLoan()
// ============================================================

describe('createLoan()', () => {
  const defaultParams = {
    clientId: 42,
    productId: 1,
    principal: 200,
    numberOfRepayments: 12,
    repaymentEveryMonths: 1,
    interestRatePerMonth: 5.0,
    expectedDisbursementDate: new Date('2026-03-15'),
  };

  it('should POST to /loans with correct body', async () => {
    mockRequest.mockResolvedValue({ resourceId: 101, officeId: 1, changes: {} });

    await loanOps.createLoan(defaultParams);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const [method, path, body] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans');
    expect(body).toBeDefined();
  });

  it('should use Fineract date format "dd MMMM yyyy"', async () => {
    mockRequest.mockResolvedValue({ resourceId: 101, officeId: 1, changes: {} });

    await loanOps.createLoan(defaultParams);

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.dateFormat).toBe('dd MMMM yyyy');
    expect(body.expectedDisbursementDate).toBe('15 March 2026');
  });

  it('should set locale to "en"', async () => {
    mockRequest.mockResolvedValue({ resourceId: 101, officeId: 1, changes: {} });

    await loanOps.createLoan(defaultParams);

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.locale).toBe('en');
  });

  it('should calculate loanTermFrequency as numberOfRepayments * repaymentEveryMonths', async () => {
    mockRequest.mockResolvedValue({ resourceId: 101, officeId: 1, changes: {} });

    await loanOps.createLoan({
      ...defaultParams,
      numberOfRepayments: 6,
      repaymentEveryMonths: 2,
    });

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.loanTermFrequency).toBe(12);
    expect(body.numberOfRepayments).toBe(6);
    expect(body.repaymentEvery).toBe(2);
  });

  it('should set required amortization and interest fields', async () => {
    mockRequest.mockResolvedValue({ resourceId: 101, officeId: 1, changes: {} });

    await loanOps.createLoan(defaultParams);

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.amortizationType).toBe(0); // equal installments
    expect(body.interestType).toBe(0); // declining balance
    expect(body.interestCalculationPeriodType).toBe(1);
    expect(body.transactionProcessingStrategyCode).toBe('mifos-standard-strategy');
    expect(body.loanType).toBe('individual');
  });

  it('should include externalId when provided', async () => {
    mockRequest.mockResolvedValue({ resourceId: 101, officeId: 1, changes: {} });

    await loanOps.createLoan({
      ...defaultParams,
      externalId: 'loan-uuid-abc',
    });

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.externalId).toBe('loan-uuid-abc');
  });

  it('should return the FineractCommandResponse', async () => {
    const expected = { resourceId: 101, officeId: 1, changes: {} };
    mockRequest.mockResolvedValue(expected);

    const result = await loanOps.createLoan(defaultParams);
    expect(result).toEqual(expected);
  });
});

// ============================================================
// approveLoan()
// ============================================================

describe('approveLoan()', () => {
  it('should POST to /loans/{id}?command=approve', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.approveLoan(10);

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans/10?command=approve');
  });

  it('should include approvedOnDate in Fineract date format', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    const date = new Date('2026-04-01');
    await loanOps.approveLoan(10, date);

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.approvedOnDate).toBe('01 April 2026');
    expect(body.dateFormat).toBe('dd MMMM yyyy');
    expect(body.locale).toBe('en');
  });

  it('should default to current date when approvedOnDate is omitted', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.approveLoan(10);

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.approvedOnDate).toBeTruthy();
    // Verify it looks like a Fineract date string
    expect(body.approvedOnDate).toMatch(/^\d{2} \w+ \d{4}$/);
  });
});

// ============================================================
// disburseLoan()
// ============================================================

describe('disburseLoan()', () => {
  it('should POST to /loans/{id}?command=disburse', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.disburseLoan(10);

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans/10?command=disburse');
  });

  it('should include actualDisbursementDate in Fineract format', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    const date = new Date('2026-05-20');
    await loanOps.disburseLoan(10, date);

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.actualDisbursementDate).toBe('20 May 2026');
  });

  it('should include paymentTypeId when provided', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.disburseLoan(10, new Date('2026-05-20'), 3);

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.paymentTypeId).toBe(3);
  });

  it('should not include paymentTypeId when omitted', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.disburseLoan(10, new Date('2026-05-20'));

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.paymentTypeId).toBeUndefined();
  });
});

// ============================================================
// postRepayment()
// ============================================================

describe('postRepayment()', () => {
  it('should POST to /loans/{id}/transactions?command=repayment', async () => {
    mockRequest.mockResolvedValue({ resourceId: 501, officeId: 1, changes: {} });

    await loanOps.postRepayment({
      loanId: 10,
      amount: 25.50,
      transactionDate: new Date('2026-06-01'),
    });

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans/10/transactions?command=repayment');
  });

  it('should include transactionAmount and formatted date', async () => {
    mockRequest.mockResolvedValue({ resourceId: 501, officeId: 1, changes: {} });

    await loanOps.postRepayment({
      loanId: 10,
      amount: 25.50,
      transactionDate: new Date('2026-06-01'),
    });

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.transactionAmount).toBe(25.50);
    expect(body.transactionDate).toBe('01 June 2026');
    expect(body.dateFormat).toBe('dd MMMM yyyy');
    expect(body.locale).toBe('en');
  });

  it('should include optional note and externalId', async () => {
    mockRequest.mockResolvedValue({ resourceId: 501, officeId: 1, changes: {} });

    await loanOps.postRepayment({
      loanId: 10,
      amount: 25.50,
      transactionDate: new Date('2026-06-01'),
      note: 'EcoCash payment',
      externalId: 'pay-uuid-123',
    });

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.note).toBe('EcoCash payment');
    expect(body.externalId).toBe('pay-uuid-123');
  });
});

// ============================================================
// rejectLoan()
// ============================================================

describe('rejectLoan()', () => {
  it('should POST to /loans/{id}?command=reject', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.rejectLoan(10, new Date('2026-03-20'), 'Credit score too low');

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans/10?command=reject');
  });

  it('should include rejectedOnDate and note', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.rejectLoan(10, new Date('2026-03-20'), 'Credit score too low');

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.rejectedOnDate).toBe('20 March 2026');
    expect(body.note).toBe('Credit score too low');
    expect(body.dateFormat).toBe('dd MMMM yyyy');
  });
});

// ============================================================
// writeOffLoan()
// ============================================================

describe('writeOffLoan()', () => {
  it('should POST to /loans/{id}/transactions?command=writeoff', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.writeOffLoan(10, new Date('2026-09-01'));

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans/10/transactions?command=writeoff');
  });

  it('should include transactionDate in Fineract format', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.writeOffLoan(10, new Date('2026-09-01'));

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.transactionDate).toBe('01 September 2026');
    expect(body.dateFormat).toBe('dd MMMM yyyy');
  });

  it('should include note when provided', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.writeOffLoan(10, new Date('2026-09-01'), 'Uncollectable after 180 days');

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.note).toBe('Uncollectable after 180 days');
  });

  it('should not include note when omitted', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.writeOffLoan(10, new Date('2026-09-01'));

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.note).toBeUndefined();
  });
});

// ============================================================
// closeLoan()
// ============================================================

describe('closeLoan()', () => {
  it('should POST to /loans/{id}?command=close', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.closeLoan(10, new Date('2027-03-15'));

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans/10?command=close');
  });

  it('should include transactionDate (closedOnDate) in Fineract format', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.closeLoan(10, new Date('2027-03-15'));

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.transactionDate).toBe('15 March 2027');
    expect(body.dateFormat).toBe('dd MMMM yyyy');
    expect(body.locale).toBe('en');
  });
});

// ============================================================
// withdrawLoan()
// ============================================================

describe('withdrawLoan()', () => {
  it('should POST to /loans/{id}?command=withdrawnByApplicant', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.withdrawLoan(10, new Date('2026-03-18'));

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/loans/10?command=withdrawnByApplicant');
  });

  it('should include withdrawnOnDate in Fineract format', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.withdrawLoan(10, new Date('2026-03-18'));

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.withdrawnOnDate).toBe('18 March 2026');
    expect(body.dateFormat).toBe('dd MMMM yyyy');
  });

  it('should include note when provided', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.withdrawLoan(10, new Date('2026-03-18'), 'Customer changed mind');

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.note).toBe('Customer changed mind');
  });

  it('should not include note when omitted', async () => {
    mockRequest.mockResolvedValue({ resourceId: 10, officeId: 1, changes: {} });

    await loanOps.withdrawLoan(10, new Date('2026-03-18'));

    const body = mockRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.note).toBeUndefined();
  });
});

// ============================================================
// ERROR SCENARIOS
// ============================================================

describe('Error scenarios', () => {
  it('should propagate 404 errors from Fineract', async () => {
    mockRequest.mockRejectedValue(new Error('Fineract API error: 404 Not Found'));

    await expect(loanOps.approveLoan(999)).rejects.toThrow('404 Not Found');
  });

  it('should propagate 400 validation errors from Fineract', async () => {
    mockRequest.mockRejectedValue(new Error('Fineract API error: 400 Bad Request - loan is not in submitted state'));

    await expect(loanOps.disburseLoan(10)).rejects.toThrow('400 Bad Request');
  });

  it('should propagate 500 server errors from Fineract', async () => {
    mockRequest.mockRejectedValue(new Error('Fineract API error: 500 Internal Server Error'));

    await expect(
      loanOps.postRepayment({
        loanId: 10,
        amount: 25,
        transactionDate: new Date(),
      })
    ).rejects.toThrow('500 Internal Server Error');
  });

  it('should propagate connection timeout errors', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNABORTED: timeout of 30000ms exceeded'));

    await expect(loanOps.createLoan({
      clientId: 1,
      productId: 1,
      principal: 200,
      numberOfRepayments: 12,
      repaymentEveryMonths: 1,
      interestRatePerMonth: 5,
      expectedDisbursementDate: new Date(),
    })).rejects.toThrow('timeout');
  });

  it('should propagate connection refused errors', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:8443'));

    await expect(loanOps.getLoan(10)).rejects.toThrow('ECONNREFUSED');
  });
});

// ============================================================
// getLoan() and variants
// ============================================================

describe('getLoan()', () => {
  it('should GET /loans/{id} without associations', async () => {
    mockRequest.mockResolvedValue({ id: 10, status: { code: 'loanStatusType.active' } });

    await loanOps.getLoan(10);

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('GET');
    expect(path).toBe('/loans/10');
  });

  it('should append associations as query parameter', async () => {
    mockRequest.mockResolvedValue({ id: 10, status: { code: 'loanStatusType.active' } });

    await loanOps.getLoan(10, ['repaymentSchedule', 'transactions']);

    const [, path] = mockRequest.mock.calls[0];
    expect(path).toBe('/loans/10?associations=repaymentSchedule,transactions');
  });
});

describe('getLoanByExternalId()', () => {
  it('should GET /loans/external-id/{externalId}', async () => {
    mockRequest.mockResolvedValue({ id: 10 });

    await loanOps.getLoanByExternalId('loan-uuid-abc');

    const [method, path] = mockRequest.mock.calls[0];
    expect(method).toBe('GET');
    expect(path).toBe('/loans/external-id/loan-uuid-abc');
  });
});
