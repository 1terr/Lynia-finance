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
import { fetchAPI } from '@lynia/api-client';

jest.mock('@/lib/api/client', () => ({
  fetchAPI: jest.fn(),
}));

const mockedFetch = fetchAPI as jest.MockedFunction<typeof fetchAPI>;

describe('Fineract API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFineractLoans', () => {
    it('calls correct endpoint with default params', async () => {
      mockedFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getFineractLoans();

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/fineract/loans?')
      );
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1')
      );
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25')
      );
    });

    it('includes status filter when provided', async () => {
      mockedFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getFineractLoans({ status: 'loanStatusType.active' });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=loanStatusType.active')
      );
    });

    it('includes search filter when provided', async () => {
      mockedFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getFineractLoans({ search: 'Tendai' });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Tendai')
      );
    });

    it('caps limit at MAX_PAGE_SIZE', async () => {
      mockedFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, total_pages: 0 });

      await getFineractLoans({ limit: 500 });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=100')
      );
    });
  });

  describe('getFineractLoanDetail', () => {
    it('calls correct endpoint with loan ID', async () => {
      mockedFetch.mockResolvedValue({});

      await getFineractLoanDetail('loan-001');

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/loans/loan-001'
      );
    });

    it('returns null on error', async () => {
      mockedFetch.mockRejectedValue(new Error('Not found'));

      const result = await getFineractLoanDetail('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('approveFineractLoan', () => {
    it('calls POST with approval data', async () => {
      mockedFetch.mockResolvedValue({ success: true, resourceId: 1 });

      await approveFineractLoan('loan-001', {
        approvedOnDate: '2026-02-14',
        note: 'Approved by admin',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/loans/loan-001/approve',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('2026-02-14'),
        })
      );
    });
  });

  describe('disburseFineractLoan', () => {
    it('calls POST with disbursement data', async () => {
      mockedFetch.mockResolvedValue({ success: true, resourceId: 1 });

      await disburseFineractLoan('loan-001', {
        actualDisbursementDate: '2026-02-14',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/loans/loan-001/disburse',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('recordFineractRepayment', () => {
    it('calls POST with repayment data', async () => {
      mockedFetch.mockResolvedValue({ success: true, resourceId: 503 });

      await recordFineractRepayment('loan-001', {
        transactionDate: '2026-02-14',
        transactionAmount: 23.34,
        note: 'Monthly payment',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/loans/loan-001/repayment',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('23.34'),
        })
      );
    });
  });

  describe('getFineractLoanProducts', () => {
    it('calls correct endpoint', async () => {
      mockedFetch.mockResolvedValue([]);

      await getFineractLoanProducts();

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/loan-products'
      );
    });
  });

  describe('getGLAccounts', () => {
    it('calls correct endpoint', async () => {
      mockedFetch.mockResolvedValue([]);

      await getGLAccounts();

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/gl-accounts'
      );
    });
  });

  describe('getJournalEntries', () => {
    it('includes date filters', async () => {
      mockedFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, total_pages: 0 });

      await getJournalEntries({
        fromDate: '2026-01-01',
        toDate: '2026-02-14',
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('fromDate=2026-01-01')
      );
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('toDate=2026-02-14')
      );
    });
  });

  describe('getTrialBalance', () => {
    it('calls correct endpoint without dates', async () => {
      mockedFetch.mockResolvedValue([]);

      await getTrialBalance();

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/trial-balance'
      );
    });

    it('includes dates when provided', async () => {
      mockedFetch.mockResolvedValue([]);

      await getTrialBalance('2026-01-01', '2026-02-14');

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('fromDate=2026-01-01')
      );
    });
  });

  describe('getReconciliationResults', () => {
    it('calls correct endpoint', async () => {
      mockedFetch.mockResolvedValue({});

      await getReconciliationResults();

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/reconciliation'
      );
    });
  });

  describe('triggerReconciliation', () => {
    it('calls POST to trigger reconciliation', async () => {
      mockedFetch.mockResolvedValue({});

      await triggerReconciliation();

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/reconciliation/run',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getOverdueLoans', () => {
    it('calls correct endpoint with pagination', async () => {
      mockedFetch.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });

      await getOverdueLoans(2, 10);

      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      );
    });
  });

  describe('getAgingSummary', () => {
    it('calls correct endpoint', async () => {
      mockedFetch.mockResolvedValue({});

      await getAgingSummary();

      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/v1/fineract/loans/aging-summary'
      );
    });
  });
});
