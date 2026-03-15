/**
 * Tests for the Payments API client.
 *
 * Verifies:
 *   - getPayments builds filter params correctly
 *   - reconcilePayment sends admin_id
 *   - recordManualPayment validates required fields
 *   - All payment action functions call correct endpoints
 *   - fetchPaymentSummary handles date params
 */

// ─── Mocks ───

const mockFetchAPI = jest.fn();

jest.mock('@lynia/api-client', () => ({
  fetchAPI: (...args: unknown[]) => mockFetchAPI(...args),
}));

jest.mock('@lynia/utils', () => ({
  MAX_PAGE_SIZE: 100,
}));

// ─── Imports ───

import {
  getPayments,
  getPaymentById,
  reconcilePayment,
  retryPayment,
  confirmPayment,
  failPayment,
  refundPayment,
  getPaymentStats,
  getOverdueCollections,
  fetchPaymentSummary,
  fetchUnreconciledPayments,
  recordManualPayment,
  exportPaymentsToCSV,
} from '../payments';
import { mockPaymentWithCustomer, mockPaymentSummary, mockCollectionItems } from '@/test/mocks/payments';

// ─── Tests ───

describe('Payments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAPI.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });
  });

  describe('getPayments', () => {
    it('builds correct query string with all filters', async () => {
      await getPayments({
        status: 'pending',
        method: 'ecocash',
        type: 'installment',
        search: 'Moyo',
        date_from: '2025-01-01',
        date_to: '2025-12-31',
        reconciled: false,
        page: 3,
        limit: 15,
      });

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toContain('/api/v1/payments?');
      expect(path).toContain('status=pending');
      expect(path).toContain('method=ecocash');
      expect(path).toContain('type=installment');
      expect(path).toContain('search=Moyo');
      expect(path).toContain('date_from=2025-01-01');
      expect(path).toContain('date_to=2025-12-31');
      expect(path).toContain('reconciled=false');
      expect(path).toContain('page=3');
      expect(path).toContain('limit=15');
    });

    it('uses default page=1 and limit=25', async () => {
      await getPayments({});

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toContain('page=1');
      expect(path).toContain('limit=25');
    });

    it('clamps limit to MAX_PAGE_SIZE', async () => {
      await getPayments({ limit: 500 });

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toContain('limit=100');
    });
  });

  describe('getPaymentById', () => {
    it('returns payment on success', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockPaymentWithCustomer);

      const result = await getPaymentById('pay-001');
      expect(result).toEqual(mockPaymentWithCustomer);
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/payments/pay-001');
    });

    it('returns null on error', async () => {
      mockFetchAPI.mockRejectedValueOnce(new Error('Not found'));

      const result = await getPaymentById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('reconcilePayment', () => {
    it('sends POST with admin_id in body', async () => {
      mockFetchAPI.mockResolvedValueOnce(undefined);

      await reconcilePayment('pay-001', 'admin-1');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/payments/pay-001/reconcile',
        expect.objectContaining({ method: 'POST' })
      );

      const opts = mockFetchAPI.mock.calls[0][1];
      const body = JSON.parse(opts.body);
      expect(body.admin_id).toBe('admin-1');
    });
  });

  describe('retryPayment', () => {
    it('sends POST with admin_id', async () => {
      mockFetchAPI.mockResolvedValueOnce(undefined);

      await retryPayment('pay-003', 'admin-1');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/payments/pay-003/retry',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('confirmPayment', () => {
    it('sends POST with notes', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockPaymentWithCustomer);

      await confirmPayment('pay-002', 'Verified via bank statement');

      const opts = mockFetchAPI.mock.calls[0][1];
      const body = JSON.parse(opts.body);
      expect(body.notes).toBe('Verified via bank statement');
    });
  });

  describe('failPayment', () => {
    it('sends POST with notes', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockPaymentWithCustomer);

      await failPayment('pay-002', 'EcoCash timeout');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/payments/pay-002/fail',
        expect.objectContaining({ method: 'POST' })
      );

      const body = JSON.parse(mockFetchAPI.mock.calls[0][1].body);
      expect(body.notes).toBe('EcoCash timeout');
    });
  });

  describe('refundPayment', () => {
    it('sends POST with notes', async () => {
      mockFetchAPI.mockResolvedValueOnce(undefined);

      await refundPayment('pay-001', 'Customer requested refund');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/payments/pay-001/refund',
        expect.objectContaining({ method: 'POST' })
      );

      const body = JSON.parse(mockFetchAPI.mock.calls[0][1].body);
      expect(body.notes).toBe('Customer requested refund');
    });
  });

  describe('getPaymentStats', () => {
    it('calls correct endpoint', async () => {
      mockFetchAPI.mockResolvedValueOnce({
        total_payments: 100,
        total_collected: 5000,
        pending_count: 10,
        failed_count: 3,
        unreconciled_count: 15,
      });

      await getPaymentStats();
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/payments/stats');
    });
  });

  describe('getOverdueCollections', () => {
    it('calls correct endpoint', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockCollectionItems);

      const result = await getOverdueCollections();
      expect(result).toEqual(mockCollectionItems);
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/payments/overdue-collections');
    });
  });

  describe('fetchPaymentSummary', () => {
    it('builds date params correctly', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockPaymentSummary);

      await fetchPaymentSummary('2025-01-01', '2025-12-31');

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toContain('/api/v1/payments/summary');
      expect(path).toContain('date_from=2025-01-01');
      expect(path).toContain('date_to=2025-12-31');
    });

    it('omits date params when not provided', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockPaymentSummary);

      await fetchPaymentSummary();

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toBe('/api/v1/payments/summary');
      expect(path).not.toContain('date_from');
    });
  });

  describe('fetchUnreconciledPayments', () => {
    it('calls correct endpoint', async () => {
      mockFetchAPI.mockResolvedValueOnce([]);

      await fetchUnreconciledPayments();
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/payments/unreconciled');
    });
  });

  describe('recordManualPayment', () => {
    it('sends POST with all required fields', async () => {
      mockFetchAPI.mockResolvedValueOnce(mockPaymentWithCustomer);

      await recordManualPayment({
        loan_id: 'loan-1',
        customer_id: 'cust-1',
        amount_usd: 56.88,
        payment_method: 'cash',
        payment_type: 'installment',
        reference_number: 'CASH-001',
        payment_date: '2025-11-15',
        notes: 'Cash payment at office',
      });

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/payments/manual',
        expect.objectContaining({ method: 'POST' })
      );

      const body = JSON.parse(mockFetchAPI.mock.calls[0][1].body);
      expect(body.loan_id).toBe('loan-1');
      expect(body.customer_id).toBe('cust-1');
      expect(body.amount_usd).toBe(56.88);
      expect(body.payment_method).toBe('cash');
      expect(body.payment_type).toBe('installment');
      expect(body.reference_number).toBe('CASH-001');
      expect(body.notes).toBe('Cash payment at office');
    });
  });

  describe('exportPaymentsToCSV', () => {
    it('generates valid CSV with all columns', () => {
      const csv = exportPaymentsToCSV([mockPaymentWithCustomer]);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Payment ID');
      expect(lines[0]).toContain('Amount (USD)');
      expect(lines[0]).toContain('Reconciled');
      expect(lines).toHaveLength(2);
    });
  });
});
