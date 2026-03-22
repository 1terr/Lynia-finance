/**
 * DW Sync Service Handlers - Unit Tests
 *
 * Tests the individual sync handler functions:
 *   syncPayment        - Upserts dw.fact_payment + updates dw.fact_loan
 *   syncLoan           - Ensures dimensions + upserts dw.fact_loan
 *   syncKYC            - Upserts dw.fact_kyc + SCD2 update on dim_customer
 *   syncCreditDecision - Upserts dw.fact_credit_decision
 *
 * All database queries are mocked at the shared/clients/database level.
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();

jest.mock('../../../shared/clients/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: jest.fn(),
}));

jest.mock('../../../shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
  setRequestContext: jest.fn().mockReturnValue('test-req-id'),
  clearRequestContext: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { syncPayment } from '../handlers/sync-payment';
import { syncLoan } from '../handlers/sync-loan';
import { syncKYC } from '../handlers/sync-kyc';
import { syncCreditDecision } from '../handlers/sync-credit-decision';
import logger from '../../../shared/utils/logger';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DW Sync Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
  });

  // =========================================================================
  // syncPayment
  // =========================================================================

  describe('syncPayment', () => {
    it('should upsert fact_payment and update fact_loan on success', async () => {
      mockQuery
        .mockResolvedValueOnce({ error: null }) // fact_payment upsert
        .mockResolvedValueOnce({ error: null }); // fact_loan update

      await syncPayment('pay-001');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      // First call: fact_payment INSERT
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO dw.fact_payment');
      expect(mockQuery.mock.calls[0][1]).toEqual(['pay-001']);
      // Second call: fact_loan UPDATE
      expect(mockQuery.mock.calls[1][0]).toContain('UPDATE dw.fact_loan');
      expect(mockQuery.mock.calls[1][1]).toEqual(['pay-001']);

      expect(logger.info).toHaveBeenCalledWith('Payment synced to DW', expect.objectContaining({
        action: 'dw-sync.payment',
        status: 'completed',
      }));
    });

    it('should throw when fact_payment upsert fails', async () => {
      const dbError = new Error('Constraint violation');
      mockQuery.mockResolvedValueOnce({ error: dbError });

      await expect(syncPayment('pay-fail')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Failed to upsert fact_payment', expect.objectContaining({
        action: 'dw-sync.payment.fact_payment',
        status: 'failed',
      }));
    });

    it('should throw when fact_loan update fails', async () => {
      mockQuery
        .mockResolvedValueOnce({ error: null })           // fact_payment succeeds
        .mockResolvedValueOnce({ error: new Error('FK violation') }); // fact_loan fails

      await expect(syncPayment('pay-fail-2')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Failed to update fact_loan after payment', expect.objectContaining({
        action: 'dw-sync.payment.fact_loan',
        status: 'failed',
      }));
    });

    it('should pass paymentId as parameter to both queries', async () => {
      mockQuery
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null });

      await syncPayment('pay-xyz-123');

      expect(mockQuery.mock.calls[0][1]).toEqual(['pay-xyz-123']);
      expect(mockQuery.mock.calls[1][1]).toEqual(['pay-xyz-123']);
    });
  });

  // =========================================================================
  // syncLoan
  // =========================================================================

  describe('syncLoan', () => {
    it('should ensure dimensions and upsert fact_loan on success', async () => {
      // ensureDimensions: 3 queries (dim_customer, dim_device, dim_geography)
      // syncLoan: 1 query (fact_loan upsert)
      mockQuery
        .mockResolvedValueOnce({ error: null }) // dim_customer
        .mockResolvedValueOnce({ error: null }) // dim_device
        .mockResolvedValueOnce({ error: null }) // dim_geography
        .mockResolvedValueOnce({ error: null }); // fact_loan upsert

      await syncLoan('loan-001');

      expect(mockQuery).toHaveBeenCalledTimes(4);
      // dim_customer INSERT
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO dw.dim_customer');
      expect(mockQuery.mock.calls[0][1]).toEqual(['loan-001']);
      // dim_device INSERT
      expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO dw.dim_device');
      // dim_geography INSERT
      expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO dw.dim_geography');
      // fact_loan INSERT
      expect(mockQuery.mock.calls[3][0]).toContain('INSERT INTO dw.fact_loan');
      expect(mockQuery.mock.calls[3][1]).toEqual(['loan-001']);

      expect(logger.info).toHaveBeenCalledWith('Loan synced to DW', expect.objectContaining({
        action: 'dw-sync.loan',
        status: 'completed',
      }));
    });

    it('should throw when fact_loan upsert fails', async () => {
      mockQuery
        .mockResolvedValueOnce({ error: null }) // dim_customer
        .mockResolvedValueOnce({ error: null }) // dim_device
        .mockResolvedValueOnce({ error: null }) // dim_geography
        .mockResolvedValueOnce({ error: new Error('Duplicate key') }); // fact_loan

      await expect(syncLoan('loan-fail')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Failed to upsert fact_loan', expect.objectContaining({
        action: 'dw-sync.loan.fact_loan',
        status: 'failed',
      }));
    });

    it('should propagate dimension query errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection refused'));

      await expect(syncLoan('loan-dim-fail')).rejects.toThrow('DB connection refused');
    });

    it('should pass loanId to all dimension and fact queries', async () => {
      mockQuery
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null });

      await syncLoan('loan-abc-789');

      for (let i = 0; i < 4; i++) {
        expect(mockQuery.mock.calls[i][1]).toEqual(['loan-abc-789']);
      }
    });
  });

  // =========================================================================
  // syncKYC
  // =========================================================================

  describe('syncKYC', () => {
    it('should upsert fact_kyc and perform SCD2 update on dim_customer', async () => {
      mockQuery
        .mockResolvedValueOnce({ error: null }) // fact_kyc upsert
        .mockResolvedValueOnce({ error: null }) // expire old dim_customer
        .mockResolvedValueOnce({ error: null }); // insert new dim_customer

      await syncKYC('kyc-001');

      expect(mockQuery).toHaveBeenCalledTimes(3);
      // fact_kyc INSERT
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO dw.fact_kyc');
      expect(mockQuery.mock.calls[0][1]).toEqual(['kyc-001']);
      // SCD2: expire old record
      expect(mockQuery.mock.calls[1][0]).toContain('UPDATE dw.dim_customer');
      expect(mockQuery.mock.calls[1][0]).toContain('is_current = FALSE');
      // SCD2: insert new current record
      expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO dw.dim_customer');

      expect(logger.info).toHaveBeenCalledWith('KYC synced to DW', expect.objectContaining({
        action: 'dw-sync.kyc',
        status: 'completed',
      }));
    });

    it('should throw when fact_kyc upsert fails', async () => {
      mockQuery.mockResolvedValueOnce({ error: new Error('Column not found') });

      await expect(syncKYC('kyc-fail')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Failed to upsert fact_kyc', expect.objectContaining({
        action: 'dw-sync.kyc.fact_kyc',
        status: 'failed',
      }));
    });

    it('should pass kycId as parameter to all queries', async () => {
      mockQuery
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null });

      await syncKYC('kyc-xyz-456');

      expect(mockQuery.mock.calls[0][1]).toEqual(['kyc-xyz-456']);
      expect(mockQuery.mock.calls[1][1]).toEqual(['kyc-xyz-456']);
      expect(mockQuery.mock.calls[2][1]).toEqual(['kyc-xyz-456']);
    });

    it('should handle DB connection failure gracefully by throwing', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(syncKYC('kyc-conn-fail')).rejects.toThrow('Connection refused');
    });
  });

  // =========================================================================
  // syncCreditDecision
  // =========================================================================

  describe('syncCreditDecision', () => {
    it('should upsert fact_credit_decision on success', async () => {
      mockQuery.mockResolvedValueOnce({ error: null });

      await syncCreditDecision('score-001');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO dw.fact_credit_decision');
      expect(mockQuery.mock.calls[0][1]).toEqual(['score-001']);

      expect(logger.info).toHaveBeenCalledWith('Credit decision synced to DW', expect.objectContaining({
        action: 'dw-sync.credit',
        status: 'completed',
      }));
    });

    it('should throw when fact_credit_decision upsert fails', async () => {
      mockQuery.mockResolvedValueOnce({ error: new Error('Permission denied') });

      await expect(syncCreditDecision('score-fail')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Failed to upsert fact_credit_decision', expect.objectContaining({
        action: 'dw-sync.credit.fact_credit_decision',
        status: 'failed',
      }));
    });

    it('should pass scoreId as parameter', async () => {
      mockQuery.mockResolvedValueOnce({ error: null });

      await syncCreditDecision('score-abc-789');

      expect(mockQuery.mock.calls[0][1]).toEqual(['score-abc-789']);
    });

    it('should handle DB connection failure by throwing', async () => {
      mockQuery.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(syncCreditDecision('score-conn-fail')).rejects.toThrow('ECONNREFUSED');
    });
  });

  // =========================================================================
  // Cross-cutting: error logging patterns
  // =========================================================================

  describe('error logging patterns', () => {
    it('should log with correct action prefix for each handler', async () => {
      // Payment failure
      mockQuery.mockResolvedValueOnce({ error: new Error('fail') });
      await expect(syncPayment('p1')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ action: 'dw-sync.payment.fact_payment' })
      );

      jest.clearAllMocks();

      // Credit decision failure
      mockQuery.mockResolvedValueOnce({ error: new Error('fail') });
      await expect(syncCreditDecision('c1')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ action: 'dw-sync.credit.fact_credit_decision' })
      );
    });

    it('should include entityId in error metadata', async () => {
      mockQuery.mockResolvedValueOnce({ error: new Error('fail') });
      await expect(syncPayment('pay-meta-test')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metadata: expect.objectContaining({ paymentId: 'pay-meta-test' }),
        })
      );
    });
  });
});
