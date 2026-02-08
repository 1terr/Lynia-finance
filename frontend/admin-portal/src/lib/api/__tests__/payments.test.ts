import { exportPaymentsToCSV } from '../payments';
import { mockPaymentWithCustomer, mockPendingPayment } from '@/test/mocks/payments';

describe('payments API utilities', () => {
  describe('exportPaymentsToCSV', () => {
    it('generates CSV with headers', () => {
      const csv = exportPaymentsToCSV([mockPaymentWithCustomer]);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Payment ID');
      expect(lines[0]).toContain('Date');
      expect(lines[0]).toContain('Customer');
      expect(lines[0]).toContain('Amount (USD)');
      expect(lines[0]).toContain('Status');
    });

    it('includes payment data in rows', () => {
      const csv = exportPaymentsToCSV([mockPaymentWithCustomer]);
      const lines = csv.split('\n');

      expect(lines[1]).toContain('pay-001-uuid-test');
      expect(lines[1]).toContain('56.88');
      expect(lines[1]).toContain('John Moyo');
      expect(lines[1]).toContain('confirmed');
      expect(lines[1]).toContain('REF-001');
    });

    it('handles multiple payments', () => {
      const csv = exportPaymentsToCSV([
        mockPaymentWithCustomer,
        mockPendingPayment,
      ]);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(3); // header + 2 data rows
    });

    it('handles empty payments array', () => {
      const csv = exportPaymentsToCSV([]);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(1); // only header
    });

    it('shows reconciled status', () => {
      const csv = exportPaymentsToCSV([mockPaymentWithCustomer]);

      expect(csv).toContain('No'); // reconciled = false
    });

    it('includes phone number', () => {
      const csv = exportPaymentsToCSV([mockPaymentWithCustomer]);

      expect(csv).toContain('+263771234567');
    });
  });
});
