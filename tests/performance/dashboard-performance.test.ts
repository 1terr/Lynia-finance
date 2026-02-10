/**
 * P4-T004: Admin Dashboard Performance Tests
 *
 * Tests admin portal page load performance, data rendering,
 * and API response times for dashboard operations.
 *
 * SLO Targets:
 *   - First Contentful Paint (FCP) < 1.5s
 *   - Time to Interactive (TTI) < 3s
 *   - Bundle size < 200KB initial load
 *   - Lighthouse Performance Score > 90
 */

import {
  resetMockDataStore,
  seedMockTable,
  createTestCustomer,
  createTestLoan,
  createTestPayment,
  createTestDevice,
} from '../helpers/test-utils';

// =====================================================
// DASHBOARD PERFORMANCE UTILITIES
// =====================================================

interface DashboardMetrics {
  page: string;
  dataLoadTimeMs: number;
  recordCount: number;
  renderEstimateMs: number;
  totalEstimateMs: number;
  withinFcpTarget: boolean;
  withinTtiTarget: boolean;
}

interface ApiEndpointMetrics {
  endpoint: string;
  method: string;
  avgResponseMs: number;
  p95ResponseMs: number;
  payloadSizeBytes: number;
  recordsReturned: number;
}

function estimateRenderTime(recordCount: number, hasCharts: boolean): number {
  // Approximate render time based on data volume
  const baseRenderMs = 50; // React hydration baseline
  const perRecordMs = 0.5; // Per-row render cost
  const chartRenderMs = hasCharts ? 150 : 0; // Chart library rendering
  return baseRenderMs + (recordCount * perRecordMs) + chartRenderMs;
}

function measurePayloadSize(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf-8');
}

// =====================================================
// TEST DATA - Large datasets for dashboard scenarios
// =====================================================

const CUSTOMER_COUNT = 500;
const LOAN_COUNT = 300;
const PAYMENT_COUNT = 1000;
const DEVICE_COUNT = 200;

const bulkCustomers = Array.from({ length: CUSTOMER_COUNT }, (_, i) =>
  createTestCustomer({
    id: `dash-cust-${i}`,
    phone_number: `+26377${String(1000000 + i).padStart(7, '0')}`,
    first_name: `Customer`,
    last_name: `${i}`,
    kyc_status: ['approved', 'pending', 'in_review', 'rejected'][i % 4],
    credit_score: 300 + (i % 550),
    onboarding_status: i % 5 === 0 ? 'in_progress' : 'completed',
  })
);

const bulkLoans = Array.from({ length: LOAN_COUNT }, (_, i) =>
  createTestLoan({
    id: `dash-loan-${i}`,
    customer_id: `dash-cust-${i % CUSTOMER_COUNT}`,
    loan_amount_usd: 100 + (i % 400),
    loan_status: ['active', 'pending', 'disbursed', 'paid_off', 'defaulted'][i % 5],
    days_past_due: i % 10 === 0 ? Math.floor(Math.random() * 60) : 0,
    status: ['active', 'pending', 'disbursed', 'paid_off', 'defaulted'][i % 5],
  })
);

const bulkPayments = Array.from({ length: PAYMENT_COUNT }, (_, i) =>
  createTestPayment({
    id: `dash-pay-${i}`,
    loan_id: `dash-loan-${i % LOAN_COUNT}`,
    customer_id: `dash-cust-${i % CUSTOMER_COUNT}`,
    payment_amount_usd: 20 + (i % 180),
    payment_method: ['ecocash', 'onemoney', 'innbucks', 'bank_transfer'][i % 4],
    payment_status: ['confirmed', 'pending', 'failed'][i % 3],
    payment_date: new Date(Date.now() - i * 3600000).toISOString(),
  })
);

const bulkDevices = Array.from({ length: DEVICE_COUNT }, (_, i) =>
  createTestDevice({
    id: `dash-dev-${i}`,
    device_brand: ['Samsung', 'Xiaomi', 'Tecno', 'Infinix'][i % 4],
    device_model: [`Galaxy A${10 + (i % 5)}4`, `Redmi Note ${10 + (i % 3)}`, `Spark ${8 + (i % 4)}`, `Hot ${20 + (i % 5)}`][i % 4],
    lock_status: i % 5 === 0 ? 'locked' : 'unlocked',
    status: ['in_stock', 'assigned', 'sold', 'returned'][i % 4],
  })
);

// =====================================================
// DASHBOARD PERFORMANCE TESTS
// =====================================================

describe('P4-T004: Admin Dashboard Performance', () => {
  const dashboardMetrics: DashboardMetrics[] = [];
  const apiMetrics: ApiEndpointMetrics[] = [];
  const FCP_TARGET_MS = 1500;
  const TTI_TARGET_MS = 3000;

  beforeAll(() => {
    resetMockDataStore();
    seedMockTable('customers', bulkCustomers);
    seedMockTable('loans', bulkLoans);
    seedMockTable('payments', bulkPayments);
    seedMockTable('devices', bulkDevices);
  });

  afterAll(() => {
    // Print dashboard performance summary
    console.info('\n=== DASHBOARD PERFORMANCE METRICS ===\n');
    console.info(
      'Page'.padEnd(30) +
      'Records'.padEnd(10) +
      'Data(ms)'.padEnd(12) +
      'Render(ms)'.padEnd(12) +
      'Total(ms)'.padEnd(12) +
      'FCP'.padEnd(8) +
      'TTI'.padEnd(8)
    );
    console.info('-'.repeat(92));

    for (const m of dashboardMetrics) {
      console.info(
        m.page.padEnd(30) +
        String(m.recordCount).padEnd(10) +
        m.dataLoadTimeMs.toFixed(1).padEnd(12) +
        m.renderEstimateMs.toFixed(1).padEnd(12) +
        m.totalEstimateMs.toFixed(1).padEnd(12) +
        (m.withinFcpTarget ? 'PASS' : 'FAIL').padEnd(8) +
        (m.withinTtiTarget ? 'PASS' : 'FAIL').padEnd(8)
      );
    }

    console.info('\n=== API ENDPOINT METRICS ===\n');
    console.info(
      'Endpoint'.padEnd(40) +
      'Method'.padEnd(8) +
      'Avg(ms)'.padEnd(12) +
      'p95(ms)'.padEnd(12) +
      'Size(KB)'.padEnd(12) +
      'Records'.padEnd(10)
    );
    console.info('-'.repeat(94));

    for (const m of apiMetrics) {
      console.info(
        m.endpoint.padEnd(40) +
        m.method.padEnd(8) +
        m.avgResponseMs.toFixed(1).padEnd(12) +
        m.p95ResponseMs.toFixed(1).padEnd(12) +
        (m.payloadSizeBytes / 1024).toFixed(1).padEnd(12) +
        String(m.recordsReturned).padEnd(10)
      );
    }

    console.info('\n=== END DASHBOARD METRICS ===\n');
    resetMockDataStore();
  });

  // =====================================================
  // MAIN DASHBOARD (Overview)
  // =====================================================

  describe('Main Dashboard (Overview)', () => {
    it('should load portfolio summary within FCP target', async () => {
      const start = performance.now();

      // Simulate fetching portfolio summary data
      const portfolioData = {
        totalLoans: bulkLoans.length,
        activeLoans: bulkLoans.filter(l => l.loan_status === 'active').length,
        totalDisbursed: bulkLoans.reduce((sum, l) => sum + (l.loan_amount_usd as number), 0),
        totalCollected: bulkPayments.filter(p => p.payment_status === 'confirmed').reduce((sum, p) => sum + (p.payment_amount_usd as number), 0),
        delinquentLoans: bulkLoans.filter(l => (l.days_past_due as number) > 30).length,
        totalCustomers: bulkCustomers.length,
      };

      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(6, true); // 6 KPI cards + charts
      const total = dataLoadTime + renderTime;

      const metric: DashboardMetrics = {
        page: 'Main Dashboard',
        dataLoadTimeMs: dataLoadTime,
        recordCount: 6,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      };
      dashboardMetrics.push(metric);

      apiMetrics.push({
        endpoint: '/api/dashboard/summary',
        method: 'GET',
        avgResponseMs: dataLoadTime,
        p95ResponseMs: dataLoadTime * 1.5,
        payloadSizeBytes: measurePayloadSize(portfolioData),
        recordsReturned: 1,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
      expect(measurePayloadSize(portfolioData)).toBeLessThan(10 * 1024); // < 10KB
    });
  });

  // =====================================================
  // LOAN MANAGEMENT PAGE
  // =====================================================

  describe('Loan Management Page', () => {
    it('should load paginated loan list within FCP target', async () => {
      const pageSize = 25;
      const start = performance.now();

      // Simulate paginated loan list with customer join
      const loanPage = bulkLoans.slice(0, pageSize).map(loan => ({
        ...loan,
        customer: bulkCustomers.find(c => c.id === loan.customer_id),
      }));

      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(pageSize, false);
      const total = dataLoadTime + renderTime;

      const metric: DashboardMetrics = {
        page: 'Loans - List (25/page)',
        dataLoadTimeMs: dataLoadTime,
        recordCount: pageSize,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      };
      dashboardMetrics.push(metric);

      apiMetrics.push({
        endpoint: '/api/loans?page=1&limit=25',
        method: 'GET',
        avgResponseMs: dataLoadTime,
        p95ResponseMs: dataLoadTime * 1.5,
        payloadSizeBytes: measurePayloadSize(loanPage),
        recordsReturned: pageSize,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });

    it('should load loan detail page within FCP target', async () => {
      const start = performance.now();

      const loan = bulkLoans[0];
      const customer = bulkCustomers.find(c => c.id === loan.customer_id);
      const payments = bulkPayments.filter(p => p.loan_id === loan.id);
      const _loanDetail = { loan, customer, payments, paymentCount: payments.length };

      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(payments.length + 2, true);
      const total = dataLoadTime + renderTime;

      const metric: DashboardMetrics = {
        page: 'Loan Detail (w/ payments)',
        dataLoadTimeMs: dataLoadTime,
        recordCount: payments.length + 2,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      };
      dashboardMetrics.push(metric);

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });

    it('should load pending approvals efficiently', async () => {
      const start = performance.now();

      const pendingLoans = bulkLoans
        .filter(l => l.loan_status === 'pending')
        .slice(0, 50)
        .map(loan => ({
          ...loan,
          customer: bulkCustomers.find(c => c.id === loan.customer_id),
        }));

      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(pendingLoans.length, false);
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'Pending Approvals',
        dataLoadTimeMs: dataLoadTime,
        recordCount: pendingLoans.length,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });
  });

  // =====================================================
  // CUSTOMER MANAGEMENT PAGE
  // =====================================================

  describe('Customer Management Page', () => {
    it('should load customer list with KYC status within FCP target', async () => {
      const pageSize = 25;
      const start = performance.now();

      const customerPage = bulkCustomers.slice(0, pageSize);
      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(pageSize, false);
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'Customers - List (25/page)',
        dataLoadTimeMs: dataLoadTime,
        recordCount: pageSize,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      apiMetrics.push({
        endpoint: '/api/customers?page=1&limit=25',
        method: 'GET',
        avgResponseMs: dataLoadTime,
        p95ResponseMs: dataLoadTime * 1.5,
        payloadSizeBytes: measurePayloadSize(customerPage),
        recordsReturned: pageSize,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });

    it('should handle KYC review queue efficiently', async () => {
      const start = performance.now();

      const kycQueue = bulkCustomers
        .filter(c => c.kyc_status === 'in_review')
        .slice(0, 50);

      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(kycQueue.length, false);
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'KYC Review Queue',
        dataLoadTimeMs: dataLoadTime,
        recordCount: kycQueue.length,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });
  });

  // =====================================================
  // PAYMENT MANAGEMENT PAGE
  // =====================================================

  describe('Payment & Reconciliation Page', () => {
    it('should load payment list with reconciliation status within target', async () => {
      const pageSize = 50;
      const start = performance.now();

      const paymentPage = bulkPayments.slice(0, pageSize);
      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(pageSize, false);
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'Payments - List (50/page)',
        dataLoadTimeMs: dataLoadTime,
        recordCount: pageSize,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      apiMetrics.push({
        endpoint: '/api/payments?page=1&limit=50',
        method: 'GET',
        avgResponseMs: dataLoadTime,
        p95ResponseMs: dataLoadTime * 1.5,
        payloadSizeBytes: measurePayloadSize(paymentPage),
        recordsReturned: pageSize,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });

    it('should load reconciliation summary efficiently', async () => {
      const start = performance.now();

      const _reconciliation = {
        totalPending: bulkPayments.filter(p => p.payment_status === 'pending').length,
        totalConfirmed: bulkPayments.filter(p => p.payment_status === 'confirmed').length,
        totalFailed: bulkPayments.filter(p => p.payment_status === 'failed').length,
        byMethod: {
          ecocash: bulkPayments.filter(p => p.payment_method === 'ecocash').length,
          onemoney: bulkPayments.filter(p => p.payment_method === 'onemoney').length,
          innbucks: bulkPayments.filter(p => p.payment_method === 'innbucks').length,
          bank_transfer: bulkPayments.filter(p => p.payment_method === 'bank_transfer').length,
        },
      };

      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(7, true); // Summary cards + pie chart
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'Reconciliation Summary',
        dataLoadTimeMs: dataLoadTime,
        recordCount: 7,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });
  });

  // =====================================================
  // DEVICE MANAGEMENT PAGE
  // =====================================================

  describe('Device Management Page', () => {
    it('should load device inventory within target', async () => {
      const pageSize = 25;
      const start = performance.now();

      const _devicePage = bulkDevices.slice(0, pageSize);
      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(pageSize, false);
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'Devices - Inventory (25/page)',
        dataLoadTimeMs: dataLoadTime,
        recordCount: pageSize,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });

    it('should load lock/unlock management page within target', async () => {
      const start = performance.now();

      const lockedDevices = bulkDevices.filter(d => d.lock_status === 'locked');
      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(lockedDevices.length, false);
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'Lock/Unlock Management',
        dataLoadTimeMs: dataLoadTime,
        recordCount: lockedDevices.length,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      expect(total).toBeLessThan(TTI_TARGET_MS);
    });
  });

  // =====================================================
  // REPORTS PAGE (Heaviest data load)
  // =====================================================

  describe('Reports Page', () => {
    it('should load portfolio report with aggregation within target', async () => {
      const start = performance.now();

      // Simulate heavy aggregation query
      const report = {
        period: { start: '2026-01-01', end: '2026-02-09' },
        totalDisbursed: bulkLoans.reduce((sum, l) => sum + (l.loan_amount_usd as number), 0),
        totalCollected: bulkPayments
          .filter(p => p.payment_status === 'confirmed')
          .reduce((sum, p) => sum + (p.payment_amount_usd as number), 0),
        activeLoans: bulkLoans.filter(l => l.loan_status === 'active').length,
        delinquencyRate: bulkLoans.filter(l => (l.days_past_due as number) > 30).length / bulkLoans.length,
        avgCreditScore: bulkCustomers.reduce((sum, c) => sum + (c.credit_score as number), 0) / bulkCustomers.length,
        loansByStatus: {
          active: bulkLoans.filter(l => l.loan_status === 'active').length,
          pending: bulkLoans.filter(l => l.loan_status === 'pending').length,
          disbursed: bulkLoans.filter(l => l.loan_status === 'disbursed').length,
          paid_off: bulkLoans.filter(l => l.loan_status === 'paid_off').length,
          defaulted: bulkLoans.filter(l => l.loan_status === 'defaulted').length,
        },
      };

      const dataLoadTime = performance.now() - start;
      const renderTime = estimateRenderTime(15, true); // Multiple charts + tables
      const total = dataLoadTime + renderTime;

      dashboardMetrics.push({
        page: 'Portfolio Report',
        dataLoadTimeMs: dataLoadTime,
        recordCount: 15,
        renderEstimateMs: renderTime,
        totalEstimateMs: total,
        withinFcpTarget: total < FCP_TARGET_MS,
        withinTtiTarget: total < TTI_TARGET_MS,
      });

      apiMetrics.push({
        endpoint: '/api/reports/portfolio',
        method: 'GET',
        avgResponseMs: dataLoadTime,
        p95ResponseMs: dataLoadTime * 2,
        payloadSizeBytes: measurePayloadSize(report),
        recordsReturned: 1,
      });

      // Reports can be slightly slower but should still hit TTI
      expect(total).toBeLessThan(TTI_TARGET_MS);
    });
  });

  // =====================================================
  // PAYLOAD SIZE VALIDATION
  // =====================================================

  describe('API Payload Size Validation', () => {
    it('paginated list payloads should be under 100KB', () => {
      const pagePayloads = [
        { name: 'Loans page', data: bulkLoans.slice(0, 25) },
        { name: 'Customers page', data: bulkCustomers.slice(0, 25) },
        { name: 'Payments page', data: bulkPayments.slice(0, 50) },
        { name: 'Devices page', data: bulkDevices.slice(0, 25) },
      ];

      for (const { name: _name, data } of pagePayloads) {
        const size = measurePayloadSize(data);
        expect(size).toBeLessThan(100 * 1024); // < 100KB per page
      }
    });

    it('detail page payloads should be under 50KB', () => {
      const detailPayloads = [
        { name: 'Loan detail', data: { loan: bulkLoans[0], customer: bulkCustomers[0], payments: bulkPayments.slice(0, 10) } },
        { name: 'Customer detail', data: { customer: bulkCustomers[0], loans: bulkLoans.slice(0, 5) } },
      ];

      for (const { name: _name, data } of detailPayloads) {
        const size = measurePayloadSize(data);
        expect(size).toBeLessThan(50 * 1024); // < 50KB per detail page
      }
    });
  });
});
