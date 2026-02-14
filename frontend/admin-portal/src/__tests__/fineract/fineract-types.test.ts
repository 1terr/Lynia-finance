/**
 * Tests: Fineract Type Definitions & Helpers (Phase 7 - T002)
 */

import {
  getFineractStatusDisplay,
  FINERACT_STATUS_MAP,
  type FineractLoanStatusCode,
} from '@/types/fineract';

describe('Fineract Types', () => {
  describe('FINERACT_STATUS_MAP', () => {
    it('has entries for all known status codes', () => {
      const expectedCodes: FineractLoanStatusCode[] = [
        'loanStatusType.submittedAndPendingApproval',
        'loanStatusType.approved',
        'loanStatusType.active',
        'loanStatusType.closed.obligations.met',
        'loanStatusType.closed.written.off',
        'loanStatusType.closed.reschedule.outstanding.amount',
        'loanStatusType.overpaid',
        'loanStatusType.rejected',
        'loanStatusType.withdrawn.by.client',
      ];

      for (const code of expectedCodes) {
        expect(FINERACT_STATUS_MAP[code]).toBeDefined();
        expect(FINERACT_STATUS_MAP[code].label).toBeTruthy();
        expect(FINERACT_STATUS_MAP[code].color).toBeTruthy();
        expect(FINERACT_STATUS_MAP[code].bgColor).toBeTruthy();
      }
    });

    it('maps active status correctly', () => {
      const display = FINERACT_STATUS_MAP['loanStatusType.active'];
      expect(display.label).toBe('Active');
      expect(display.color).toContain('green');
      expect(display.bgColor).toContain('green');
    });

    it('maps pending approval status correctly', () => {
      const display =
        FINERACT_STATUS_MAP[
          'loanStatusType.submittedAndPendingApproval'
        ];
      expect(display.label).toBe('Pending Approval');
      expect(display.color).toContain('yellow');
    });

    it('maps rejected status correctly', () => {
      const display = FINERACT_STATUS_MAP['loanStatusType.rejected'];
      expect(display.label).toBe('Rejected');
      expect(display.color).toContain('red');
    });

    it('maps closed (paid) status correctly', () => {
      const display =
        FINERACT_STATUS_MAP['loanStatusType.closed.obligations.met'];
      expect(display.label).toBe('Closed (Paid)');
      expect(display.color).toContain('gray');
    });

    it('maps written off status correctly', () => {
      const display =
        FINERACT_STATUS_MAP['loanStatusType.closed.written.off'];
      expect(display.label).toBe('Written Off');
      expect(display.color).toContain('red');
    });
  });

  describe('getFineractStatusDisplay', () => {
    it('returns correct display for known status', () => {
      const display = getFineractStatusDisplay('loanStatusType.active');
      expect(display.label).toBe('Active');
      expect(display.color).toBe('text-green-800');
      expect(display.bgColor).toBe('bg-green-100');
    });

    it('returns fallback for unknown status', () => {
      const display = getFineractStatusDisplay(
        'loanStatusType.unknown' as FineractLoanStatusCode
      );
      expect(display.label).toBe('loanStatusType.unknown');
      expect(display.color).toBe('text-gray-800');
      expect(display.bgColor).toBe('bg-gray-100');
    });
  });
});
