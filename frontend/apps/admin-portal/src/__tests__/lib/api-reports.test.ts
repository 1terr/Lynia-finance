import {
  fetchLoanDisbursementReport,
  fetchPaymentCollectionReport,
  fetchDefaultRateReport,
  fetchKycStatusReport,
  fetchDeviceManagementReport,
  fetchCustomerAcquisitionReport,
  fetchPortfolioHealthReport,
} from '@/lib/api/reports';
import type { ReportFilters } from '@/types/reports';

// Mock the API client so fetchAPI returns mock data without hitting real endpoints
jest.mock('@lynia/api-client', () => ({
  fetchAPI: jest.fn((path: string) => {
    if (path.includes('/reports/disbursements')) {
      return Promise.resolve({
        totalDisbursed: 120,
        totalValue: 45000,
        avgLoanSize: 375,
        approvalRate: 82,
        rows: [
          { date: '2026-01-01', count: 10, totalValue: 3750 },
          { date: '2026-01-08', count: 15, totalValue: 5625 },
          { date: '2026-01-15', count: 20, totalValue: 7500 },
          { date: '2026-01-22', count: 35, totalValue: 13125 },
          { date: '2026-01-29', count: 40, totalValue: 15000 },
        ],
      });
    }
    if (path.includes('/reports/collections/detailed')) {
      return Promise.resolve({
        totalExpected: 50000,
        totalCollected: 42000,
        collectionRate: 84,
        byMethod: [
          { method: 'EcoCash', amount: 25000, count: 80 },
          { method: 'Bank Transfer', amount: 12000, count: 30 },
          { method: 'Cash', amount: 5000, count: 15 },
        ],
        rows: [
          { date: '2026-01-01', expected: 5000, collected: 4200 },
        ],
      });
    }
    if (path.includes('/reports/defaults/summary')) {
      return Promise.resolve({
        par30: 8.5,
        totalOutstanding: 120000,
        rows: [
          { bucket: '1-30 days', count: 15, outstandingBalance: 5000 },
          { bucket: '31-60 days', count: 8, outstandingBalance: 3200 },
          { bucket: '61-90 days', count: 5, outstandingBalance: 2100 },
          { bucket: '91-180 days', count: 3, outstandingBalance: 1500 },
          { bucket: '180+ days', count: 1, outstandingBalance: 800 },
        ],
      });
    }
    if (path.includes('/reports/kyc/detailed')) {
      return Promise.resolve({
        totalSubmissions: 100,
        approvedCount: 75,
        rejectedCount: 15,
        pendingCount: 10,
        rows: [
          { status: 'approved', count: 75 },
          { status: 'rejected', count: 15 },
          { status: 'pending', count: 10 },
        ],
        rejectionReasons: [
          { reason: 'Document illegible', count: 8 },
          { reason: 'Face mismatch', count: 5 },
          { reason: 'ID expired', count: 2 },
        ],
      });
    }
    if (path.includes('/reports/devices')) {
      return Promise.resolve({
        totalDevices: 500,
        lockOperations: 45,
        rows: [
          { model: 'Samsung Galaxy A14', count: 200, locked: 10 },
        ],
      });
    }
    if (path.includes('/reports/acquisition')) {
      return Promise.resolve({
        newCustomers: 250,
        funnel: [
          { stage: 'WhatsApp Initiated', count: 1000 },
          { stage: 'KYC Started', count: 800 },
          { stage: 'KYC Completed', count: 600 },
          { stage: 'Loan Applied', count: 400 },
          { stage: 'Loan Approved', count: 300 },
          { stage: 'Device Delivered', count: 250 },
        ],
        bySource: [
          { source: 'WhatsApp', count: 200 },
          { source: 'Referral', count: 50 },
        ],
      });
    }
    if (path.includes('/reports/portfolio')) {
      return Promise.resolve({
        totalOutstanding: 500000,
        byStatus: [
          { status: 'Current', amount: 350000, pct: 70 },
          { status: 'Overdue', amount: 100000, pct: 20 },
          { status: 'Default', amount: 50000, pct: 10 },
        ],
        byTier: [
          { tier: 'Tier 1', amount: 200000 },
          { tier: 'Tier 2', amount: 200000 },
          { tier: 'Tier 3', amount: 100000 },
        ],
        byAge: [
          { age: '0-30 days', amount: 200000 },
          { age: '31-90 days', amount: 150000 },
        ],
      });
    }
    return Promise.reject(new Error(`Unmocked path: ${path}`));
  }),
}));

const mockFilters: ReportFilters = {
  dateRange: { from: '2026-01-01', to: '2026-01-31', preset: '30d' },
};

describe('Report API functions', () => {
  describe('fetchLoanDisbursementReport', () => {
    it('returns valid loan disbursement data', async () => {
      const data = await fetchLoanDisbursementReport(mockFilters);
      expect(data.totalDisbursed).toBeGreaterThan(0);
      expect(data.totalValue).toBeGreaterThan(0);
      expect(data.avgLoanSize).toBeGreaterThan(0);
      expect(data.approvalRate).toBeGreaterThan(0);
      expect(data.rows).toHaveLength(5);
      expect(data.rows[0]).toHaveProperty('date');
      expect(data.rows[0]).toHaveProperty('count');
      expect(data.rows[0]).toHaveProperty('totalValue');
    });
  });

  describe('fetchPaymentCollectionReport', () => {
    it('returns valid payment collection data', async () => {
      const data = await fetchPaymentCollectionReport(mockFilters);
      expect(data.totalExpected).toBeGreaterThan(0);
      expect(data.totalCollected).toBeGreaterThan(0);
      expect(data.collectionRate).toBeGreaterThan(0);
      expect(data.byMethod).toHaveLength(3);
      expect(data.byMethod[0]).toHaveProperty('method');
      expect(data.rows.length).toBeGreaterThan(0);
    });
  });

  describe('fetchDefaultRateReport', () => {
    it('returns valid default rate data', async () => {
      const data = await fetchDefaultRateReport(mockFilters);
      expect(data.par30).toBeGreaterThan(0);
      expect(data.totalOutstanding).toBeGreaterThan(0);
      expect(data.rows).toHaveLength(5);
      expect(data.rows[0]).toHaveProperty('bucket');
      expect(data.rows[0]).toHaveProperty('outstandingBalance');
    });
  });

  describe('fetchKycStatusReport', () => {
    it('returns valid KYC status data', async () => {
      const data = await fetchKycStatusReport(mockFilters);
      expect(data.totalSubmissions).toBeGreaterThan(0);
      expect(data.rows).toHaveLength(3);
      expect(data.rejectionReasons.length).toBeGreaterThan(0);
      expect(data.approvedCount + data.rejectedCount + data.pendingCount).toBe(data.totalSubmissions);
    });
  });

  describe('fetchDeviceManagementReport', () => {
    it('returns valid device management data', async () => {
      const data = await fetchDeviceManagementReport(mockFilters);
      expect(data.totalDevices).toBeGreaterThan(0);
      expect(data.rows.length).toBeGreaterThan(0);
      expect(data.lockOperations).toBeGreaterThan(0);
    });
  });

  describe('fetchCustomerAcquisitionReport', () => {
    it('returns valid acquisition data with funnel', async () => {
      const data = await fetchCustomerAcquisitionReport(mockFilters);
      expect(data.newCustomers).toBeGreaterThan(0);
      expect(data.funnel).toHaveLength(6);
      expect(data.funnel[0].stage).toBe('WhatsApp Initiated');
      expect(data.bySource.length).toBeGreaterThan(0);
      // Funnel should be descending (each step <= previous)
      for (let i = 1; i < data.funnel.length; i++) {
        expect(data.funnel[i].count).toBeLessThanOrEqual(data.funnel[i - 1].count);
      }
    });
  });

  describe('fetchPortfolioHealthReport', () => {
    it('returns valid portfolio health data', async () => {
      const data = await fetchPortfolioHealthReport(mockFilters);
      expect(data.totalOutstanding).toBeGreaterThan(0);
      expect(data.byStatus.length).toBeGreaterThan(0);
      expect(data.byTier).toHaveLength(3);
      expect(data.byAge.length).toBeGreaterThan(0);
      // Percentages should sum to ~100
      const statusPctSum = data.byStatus.reduce((sum, s) => sum + s.pct, 0);
      expect(statusPctSum).toBeCloseTo(100, 0);
    });
  });
});
