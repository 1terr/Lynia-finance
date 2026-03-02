import {
  fetchDashboardStats,
  fetchCompletedHandovers,
  searchApprovedLoans,
  fetchInventory,
  fetchCommissions,
  updateDistributorProfile,
  verifyCustomerIdentity,
  verifyDeviceSelection,
  verifyDepositPayment,
  submitHandover,
} from '@/lib/api';
import { fetchAPI } from '@lynia/api-client';
import {
  createDashboardStats,
  createCompletedHandovers,
  createApprovedLoans,
  createInventoryDevices,
  createCommissions,
  createDistributor,
  createDeviceCondition,
} from '@/__tests__/fixtures/factories';

// Mock the fetchAPI function from @lynia/api-client
jest.mock('@lynia/api-client', () => ({
  fetchAPI: jest.fn(),
}));

// Mock environment check for useMock()
jest.mock('@/test/mocks/utils', () => ({
  useMock: () => false, // Always use real API calls in tests
}));

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchDashboardStats', () => {
    it('calls fetchAPI with correct endpoint', async () => {
      const mockStats = createDashboardStats();
      (fetchAPI as jest.Mock).mockResolvedValue(mockStats);

      const result = await fetchDashboardStats();

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/stats');
      expect(result).toEqual(mockStats);
    });

    it('returns dashboard stats data', async () => {
      const mockStats = createDashboardStats({
        total_devices_distributed: 42,
        current_inventory: 15,
      });
      (fetchAPI as jest.Mock).mockResolvedValue(mockStats);

      const result = await fetchDashboardStats();

      expect(result.total_devices_distributed).toBe(42);
      expect(result.current_inventory).toBe(15);
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(fetchDashboardStats()).rejects.toThrow('API Error');
    });
  });

  describe('fetchCompletedHandovers', () => {
    it('calls fetchAPI with correct endpoint and status filter', async () => {
      const mockHandovers = createCompletedHandovers(3);
      (fetchAPI as jest.Mock).mockResolvedValue(mockHandovers);

      const result = await fetchCompletedHandovers();

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/handovers?status=completed');
      expect(result).toEqual(mockHandovers);
    });

    it('returns completed handovers array', async () => {
      const mockHandovers = createCompletedHandovers(2);
      (fetchAPI as jest.Mock).mockResolvedValue(mockHandovers);

      const result = await fetchCompletedHandovers();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(fetchCompletedHandovers()).rejects.toThrow('Network error');
    });
  });

  describe('searchApprovedLoans', () => {
    it('calls fetchAPI with correct endpoint and query parameter', async () => {
      const mockLoans = createApprovedLoans(3);
      (fetchAPI as jest.Mock).mockResolvedValue(mockLoans);

      const result = await searchApprovedLoans('John');

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/handovers/search?q=John');
      expect(result).toEqual(mockLoans);
    });

    it('encodes the query parameter', async () => {
      const mockLoans = createApprovedLoans(1);
      (fetchAPI as jest.Mock).mockResolvedValue(mockLoans);

      await searchApprovedLoans('John Doe');

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/handovers/search?q=John%20Doe');
    });

    it('returns approved loans array', async () => {
      const mockLoans = createApprovedLoans(2);
      (fetchAPI as jest.Mock).mockResolvedValue(mockLoans);

      const result = await searchApprovedLoans('test');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Search failed'));

      await expect(searchApprovedLoans('query')).rejects.toThrow('Search failed');
    });
  });

  describe('fetchInventory', () => {
    it('calls fetchAPI with correct endpoint', async () => {
      const mockDevices = createInventoryDevices(5);
      (fetchAPI as jest.Mock).mockResolvedValue(mockDevices);

      const result = await fetchInventory();

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/inventory');
      expect(result).toEqual(mockDevices);
    });

    it('returns inventory devices array', async () => {
      const mockDevices = createInventoryDevices(3);
      (fetchAPI as jest.Mock).mockResolvedValue(mockDevices);

      const result = await fetchInventory();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

      await expect(fetchInventory()).rejects.toThrow('Unauthorized');
    });
  });

  describe('fetchCommissions', () => {
    it('calls fetchAPI with correct endpoint', async () => {
      const mockCommissions = createCommissions(4);
      (fetchAPI as jest.Mock).mockResolvedValue(mockCommissions);

      const result = await fetchCommissions();

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/commissions');
      expect(result).toEqual(mockCommissions);
    });

    it('returns commissions array', async () => {
      const mockCommissions = createCommissions(2);
      (fetchAPI as jest.Mock).mockResolvedValue(mockCommissions);

      const result = await fetchCommissions();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Forbidden'));

      await expect(fetchCommissions()).rejects.toThrow('Forbidden');
    });
  });

  describe('updateDistributorProfile', () => {
    it('calls fetchAPI with correct endpoint and method', async () => {
      const profileData = { phone_number: '+263771234567', address: '123 Main St' };
      const updatedDistributor = createDistributor(profileData);
      (fetchAPI as jest.Mock).mockResolvedValue(updatedDistributor);

      const result = await updateDistributorProfile(profileData);

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileData),
      });
      expect(result).toEqual(updatedDistributor);
    });

    it('sends profile data in request body', async () => {
      const profileData = {
        phone_number: '+263779999999',
        address: 'New Address',
        business_name: 'New Business',
      };
      const updatedDistributor = createDistributor(profileData);
      (fetchAPI as jest.Mock).mockResolvedValue(updatedDistributor);

      await updateDistributorProfile(profileData);

      const callArgs = (fetchAPI as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody).toEqual(profileData);
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Validation error'));

      await expect(
        updateDistributorProfile({ phone_number: 'invalid' })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('verifyCustomerIdentity', () => {
    it('calls fetchAPI with correct endpoint and data', async () => {
      const mockResponse = { verified: true, message: 'Identity verified' };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyCustomerIdentity('loan_1', '63-123456A78');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/api/v1/distributor/handovers/verify-identity',
        {
          method: 'POST',
          body: JSON.stringify({ loan_id: 'loan_1', national_id: '63-123456A78' }),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('returns verification result', async () => {
      const mockResponse = { verified: true, message: 'Valid ID' };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyCustomerIdentity('loan_1', '63-123456A78');

      expect(result.verified).toBe(true);
      expect(result.message).toBe('Valid ID');
    });

    it('handles verification failure', async () => {
      const mockResponse = { verified: false, message: 'Invalid ID format' };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyCustomerIdentity('loan_1', 'invalid');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

      await expect(
        verifyCustomerIdentity('loan_1', '63-123456A78')
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('verifyDeviceSelection', () => {
    it('calls fetchAPI with correct endpoint and data', async () => {
      const mockResponse = { verified: true, message: 'Device verified' };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyDeviceSelection('loan_1', 'device_1', '123456789012345');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/api/v1/distributor/handovers/verify-device',
        {
          method: 'POST',
          body: JSON.stringify({
            loan_id: 'loan_1',
            device_id: 'device_1',
            imei: '123456789012345',
          }),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('returns verification result for valid device', async () => {
      const mockResponse = {
        verified: true,
        message: 'Device verified — eligible for this loan',
      };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyDeviceSelection('loan_1', 'device_1', '123456789012345');

      expect(result.verified).toBe(true);
      expect(result.message).toContain('eligible');
    });

    it('returns verification failure for invalid IMEI', async () => {
      const mockResponse = {
        verified: false,
        message: 'IMEI does not match the assigned device',
      };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyDeviceSelection('loan_1', 'device_1', '999999999999999');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('does not match');
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Timeout'));

      await expect(
        verifyDeviceSelection('loan_1', 'device_1', '123456789012345')
      ).rejects.toThrow('Timeout');
    });
  });

  describe('verifyDepositPayment', () => {
    it('calls fetchAPI with correct endpoint and data', async () => {
      const mockResponse = {
        verified: true,
        amount: 40,
        message: 'Deposit verified',
      };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyDepositPayment('loan_1', 'ecocash', 'TXN123456');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/api/v1/distributor/handovers/verify-deposit',
        {
          method: 'POST',
          body: JSON.stringify({
            loan_id: 'loan_1',
            payment_method: 'ecocash',
            transaction_ref: 'TXN123456',
          }),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('returns deposit verification with amount', async () => {
      const mockResponse = {
        verified: true,
        amount: 40,
        message: 'Deposit of $40.00 verified via ecocash',
      };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyDepositPayment('loan_1', 'ecocash', 'TXN123456');

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(40);
      expect(result.message).toContain('$40.00');
    });

    it('handles different payment methods', async () => {
      const mockResponse = {
        verified: true,
        amount: 40,
        message: 'Deposit verified via onemoney',
      };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      await verifyDepositPayment('loan_1', 'onemoney', 'TXN789');

      const callArgs = (fetchAPI as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.payment_method).toBe('onemoney');
    });

    it('propagates errors from fetchAPI', async () => {
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Payment service down'));

      await expect(
        verifyDepositPayment('loan_1', 'ecocash', 'TXN123')
      ).rejects.toThrow('Payment service down');
    });
  });

  describe('submitHandover', () => {
    it('calls fetchAPI with correct endpoint and complete handover data', async () => {
      const handoverData = {
        loan_id: 'loan_1',
        customer_id: 'cust_1',
        device_id: 'device_1',
        customer_national_id: '63-123456A78',
        device_imei: '123456789012345',
        device_condition: createDeviceCondition(),
        device_photos: ['photo1.jpg', 'photo2.jpg'],
        signature_data_url: 'data:image/png;base64,abc123',
        deposit_payment_method: 'ecocash',
        deposit_transaction_ref: 'TXN123',
      };

      const mockResult = {
        success: true,
        handover_id: 'ho_1',
        loan_id: 'loan_1',
        commission_amount: 15.0,
        next_payment_date: '2026-03-23T00:00:00Z',
        message: 'Handover completed successfully',
      };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResult);

      const result = await submitHandover(handoverData);

      expect(fetchAPI).toHaveBeenCalledWith('/api/v1/distributor/handovers', {
        method: 'POST',
        body: JSON.stringify(handoverData),
      });
      expect(result).toEqual(mockResult);
    });

    it('returns handover result with commission details', async () => {
      const handoverData = {
        loan_id: 'loan_1',
        customer_id: 'cust_1',
        device_id: 'device_1',
        customer_national_id: '63-123456A78',
        device_imei: '123456789012345',
        device_condition: createDeviceCondition(),
        device_photos: ['photo1.jpg'],
        signature_data_url: 'data:image/png;base64,xyz',
        deposit_payment_method: 'ecocash',
        deposit_transaction_ref: 'TXN456',
      };

      const mockResult = {
        success: true,
        handover_id: 'ho_1',
        loan_id: 'loan_1',
        commission_amount: 25.5,
        next_payment_date: '2026-04-01T00:00:00Z',
        message: 'Success',
      };
      (fetchAPI as jest.Mock).mockResolvedValue(mockResult);

      const result = await submitHandover(handoverData);

      expect(result.success).toBe(true);
      expect(result.commission_amount).toBe(25.5);
      expect(result.loan_id).toBe('loan_1');
    });

    it('includes all device condition fields in submission', async () => {
      const deviceCondition = createDeviceCondition('good', {
        screen_condition: 'good',
        body_condition: 'good',
        buttons_functional: true,
        powers_on: true,
        notes: 'Minor scratches',
      });

      const handoverData = {
        loan_id: 'loan_1',
        customer_id: 'cust_1',
        device_id: 'device_1',
        customer_national_id: '63-123456A78',
        device_imei: '123456789012345',
        device_condition: deviceCondition,
        device_photos: ['photo1.jpg'],
        signature_data_url: 'data:image/png;base64,xyz',
        deposit_payment_method: 'ecocash',
        deposit_transaction_ref: 'TXN789',
      };

      (fetchAPI as jest.Mock).mockResolvedValue({ success: true });

      await submitHandover(handoverData);

      const callArgs = (fetchAPI as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.device_condition.screen_condition).toBe('good');
      expect(requestBody.device_condition.notes).toBe('Minor scratches');
    });

    it('propagates errors from fetchAPI', async () => {
      const handoverData = {
        loan_id: 'loan_1',
        customer_id: 'cust_1',
        device_id: 'device_1',
        customer_national_id: '63-123456A78',
        device_imei: '123456789012345',
        device_condition: createDeviceCondition(),
        device_photos: ['photo1.jpg'],
        signature_data_url: 'data:image/png;base64,xyz',
        deposit_payment_method: 'ecocash',
        deposit_transaction_ref: 'TXN123',
      };

      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Submission failed'));

      await expect(submitHandover(handoverData)).rejects.toThrow('Submission failed');
    });
  });
});
