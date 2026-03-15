/**
 * Tests for the Customers API client.
 *
 * Verifies:
 *   - getCustomers builds correct query string
 *   - getCustomerById returns null on error
 *   - approveKYC sends correct body
 *   - updateCustomer sends PATCH with body
 *   - Customer sub-resource API calls
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
  getCustomers,
  getCustomerById,
  updateCustomer,
  getCustomerLoans,
  getCustomerPayments,
  getCustomerCreditScore,
  getCustomerKYC,
  getCustomerTimeline,
  approveKYC,
  rejectKYC,
  addCustomerNote,
  fetchCreditScoreHistory,
} from '../customers';

// ─── Tests ───

describe('Customers API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAPI.mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, total_pages: 0 });
  });

  describe('getCustomers', () => {
    it('builds correct query string with all filters', async () => {
      await getCustomers({
        status: 'active',
        kyc_status: 'verified',
        search: 'Moyo',
        page: 2,
        limit: 10,
      });

      expect(mockFetchAPI).toHaveBeenCalledTimes(1);
      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toContain('/api/v1/customers?');
      expect(path).toContain('page=2');
      expect(path).toContain('limit=10');
      expect(path).toContain('status=active');
      expect(path).toContain('kyc_status=verified');
      expect(path).toContain('search=Moyo');
    });

    it('uses default page=1 and limit=25', async () => {
      await getCustomers({});

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toContain('page=1');
      expect(path).toContain('limit=25');
    });

    it('clamps limit to MAX_PAGE_SIZE', async () => {
      await getCustomers({ limit: 999 });

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).toContain('limit=100');
    });

    it('omits undefined filters from query string', async () => {
      await getCustomers({ page: 1 });

      const path = mockFetchAPI.mock.calls[0][0] as string;
      expect(path).not.toContain('status=');
      expect(path).not.toContain('kyc_status=');
      expect(path).not.toContain('search=');
    });
  });

  describe('getCustomerById', () => {
    it('returns customer data on success', async () => {
      const customer = { id: 'cust-1', full_name: 'John Moyo' };
      mockFetchAPI.mockResolvedValueOnce(customer);

      const result = await getCustomerById('cust-1');
      expect(result).toEqual(customer);
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/customers/cust-1');
    });

    it('returns null on error', async () => {
      mockFetchAPI.mockRejectedValueOnce(new Error('Not found'));

      const result = await getCustomerById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateCustomer', () => {
    it('sends PATCH with updates and admin_id', async () => {
      mockFetchAPI.mockResolvedValueOnce(undefined);

      await updateCustomer('cust-1', { first_name: 'Jane' } as never, 'admin-1');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/customers/cust-1',
        expect.objectContaining({
          method: 'PATCH',
        })
      );

      const opts = mockFetchAPI.mock.calls[0][1];
      const body = JSON.parse(opts.body);
      expect(body.first_name).toBe('Jane');
      expect(body.admin_id).toBe('admin-1');
    });
  });

  describe('KYC operations', () => {
    it('approveKYC sends correct body', async () => {
      mockFetchAPI.mockResolvedValueOnce(undefined);

      await approveKYC('sub-1', 'cust-1', 'admin-1');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/kyc/submissions/sub-1/approve',
        expect.objectContaining({ method: 'POST' })
      );

      const opts = mockFetchAPI.mock.calls[0][1];
      const body = JSON.parse(opts.body);
      expect(body).toEqual({
        customer_id: 'cust-1',
        admin_id: 'admin-1',
      });
    });

    it('rejectKYC includes reason', async () => {
      mockFetchAPI.mockResolvedValueOnce(undefined);

      await rejectKYC('sub-1', 'cust-1', 'admin-1', 'Document blurry');

      const opts = mockFetchAPI.mock.calls[0][1];
      const body = JSON.parse(opts.body);
      expect(body.reason).toBe('Document blurry');
    });
  });

  describe('Customer sub-resources', () => {
    it('getCustomerLoans calls correct path', async () => {
      mockFetchAPI.mockResolvedValueOnce([]);

      await getCustomerLoans('cust-1');
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/customers/cust-1/loans');
    });

    it('getCustomerPayments calls correct path', async () => {
      mockFetchAPI.mockResolvedValueOnce([]);

      await getCustomerPayments('cust-1');
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/customers/cust-1/payments');
    });

    it('getCustomerCreditScore returns null on error', async () => {
      mockFetchAPI.mockRejectedValueOnce(new Error('fail'));

      const result = await getCustomerCreditScore('cust-1');
      expect(result).toBeNull();
    });

    it('getCustomerKYC calls correct path', async () => {
      mockFetchAPI.mockResolvedValueOnce([]);

      await getCustomerKYC('cust-1');
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/customers/cust-1/kyc');
    });

    it('getCustomerTimeline calls correct path', async () => {
      mockFetchAPI.mockResolvedValueOnce([]);

      await getCustomerTimeline('cust-1');
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/customers/cust-1/timeline');
    });

    it('fetchCreditScoreHistory calls correct path', async () => {
      mockFetchAPI.mockResolvedValueOnce([]);

      await fetchCreditScoreHistory('cust-1');
      expect(mockFetchAPI).toHaveBeenCalledWith('/api/v1/customers/cust-1/credit-score/history');
    });
  });

  describe('addCustomerNote', () => {
    it('sends POST with note data', async () => {
      mockFetchAPI.mockResolvedValueOnce({ id: 'note-1' });

      await addCustomerNote('cust-1', 'general', 'Customer called about payment', 'admin-1');

      expect(mockFetchAPI).toHaveBeenCalledWith(
        '/api/v1/customers/cust-1/notes',
        expect.objectContaining({ method: 'POST' })
      );

      const opts = mockFetchAPI.mock.calls[0][1];
      const body = JSON.parse(opts.body);
      expect(body).toEqual({
        note_type: 'general',
        note_text: 'Customer called about payment',
        admin_id: 'admin-1',
      });
    });
  });
});
