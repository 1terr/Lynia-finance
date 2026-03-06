/**
 * Tests: Fineract API Client Functions (Phase 7 - T003)
 */

import {
  getFineractLoans,
  getFineractLoanDetail,
  getPendingApprovalLoans,
  approveFineractLoan,
  disburseFineractLoan,
  recordFineractRepayment,
  getFineractLoanProducts,
  getGLAccounts,
  getJournalEntries,
  getTrialBalance,
  getReconciliationResults,
  triggerReconciliation,
  getOverdueLoans,
  getAgingSummary,
} from '@/lib/api/fineract';

jest.mock('@lynia/auth', () => ({
  getValidSession: jest.fn(() => ({
    getIdToken: () => ({ getJwtToken: () => 'mock-token' }),
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockFetchResponse(data: unknown) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

describe('Fineract API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFineractLoans', () => {
    it('calls correct endpoint with default params', async () => {
      mockFetchResponse({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getFineractLoans();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loans?'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object)
      );
    });

    it('includes status filter when provided', async () => {
      mockFetchResponse({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getFineractLoans({ status: 'loanStatusType.active' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=loanStatusType.active'),
        expect.any(Object)
      );
    });

    it('includes search filter when provided', async () => {
      mockFetchResponse({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getFineractLoans({ search: 'Tendai' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Tendai'),
        expect.any(Object)
      );
    });

    it('caps limit at MAX_PAGE_SIZE', async () => {
      mockFetchResponse({ data: [], total: 0, page: 1, limit: 100, total_pages: 0 });

      await getFineractLoans({ limit: 500 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      );
    });
  });

  describe('getFineractLoanDetail', () => {
    it('calls correct endpoint with loan ID', async () => {
      mockFetchResponse({});

      await getFineractLoanDetail('loan-001');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loans/loan-001'),
        expect.any(Object)
      );
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Not found'));

      const result = await getFineractLoanDetail('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('approveFineractLoan', () => {
    it('calls POST with approval data', async () => {
      mockFetchResponse({ success: true, resourceId: 1 });

      await approveFineractLoan('loan-001', {
        approvedOnDate: '2026-02-14',
        note: 'Approved by admin',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loans/loan-001/approve'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('2026-02-14'),
        })
      );
    });
  });

  describe('disburseFineractLoan', () => {
    it('calls POST with disbursement data', async () => {
      mockFetchResponse({ success: true, resourceId: 1 });

      await disburseFineractLoan('loan-001', {
        actualDisbursementDate: '2026-02-14',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loans/loan-001/disburse'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('recordFineractRepayment', () => {
    it('calls POST with repayment data', async () => {
      mockFetchResponse({ success: true, resourceId: 503 });

      await recordFineractRepayment('loan-001', {
        transactionDate: '2026-02-14',
        transactionAmount: 23.34,
        note: 'Monthly payment',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loans/loan-001/repayment'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('23.34'),
        })
      );
    });
  });

  describe('getFineractLoanProducts', () => {
    it('calls correct endpoint', async () => {
      mockFetchResponse([]);

      await getFineractLoanProducts();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loan-products'),
        expect.any(Object)
      );
    });
  });

  describe('getGLAccounts', () => {
    it('calls correct endpoint', async () => {
      mockFetchResponse([]);

      await getGLAccounts();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/gl-accounts'),
        expect.any(Object)
      );
    });
  });

  describe('getJournalEntries', () => {
    it('includes date filters', async () => {
      mockFetchResponse({ data: [], total: 0, page: 1, limit: 50, total_pages: 0 });

      await getJournalEntries({
        fromDate: '2026-01-01',
        toDate: '2026-02-14',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fromDate=2026-01-01'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('toDate=2026-02-14'),
        expect.any(Object)
      );
    });
  });

  describe('getTrialBalance', () => {
    it('calls correct endpoint without dates', async () => {
      mockFetchResponse([]);

      await getTrialBalance();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/trial-balance'),
        expect.any(Object)
      );
    });

    it('includes dates when provided', async () => {
      mockFetchResponse([]);

      await getTrialBalance('2026-01-01', '2026-02-14');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fromDate=2026-01-01'),
        expect.any(Object)
      );
    });
  });

  describe('getReconciliationResults', () => {
    it('calls correct endpoint', async () => {
      mockFetchResponse({});

      await getReconciliationResults();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/reconciliation'),
        expect.any(Object)
      );
    });
  });

  describe('triggerReconciliation', () => {
    it('calls POST to trigger reconciliation', async () => {
      mockFetchResponse({});

      await triggerReconciliation();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/reconciliation/run'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getOverdueLoans', () => {
    it('calls correct endpoint with pagination', async () => {
      mockFetchResponse({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getOverdueLoans(2, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });
  });

  describe('getAgingSummary', () => {
    it('calls correct endpoint', async () => {
      mockFetchResponse({});

      await getAgingSummary();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loans/aging-summary'),
        expect.any(Object)
      );
    });
  });
});
