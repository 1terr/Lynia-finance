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
