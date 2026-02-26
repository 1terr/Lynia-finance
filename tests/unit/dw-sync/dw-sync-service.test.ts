/**
 * DW Sync Service - Characterization Tests
 *
 * Tests the SQS-driven data warehouse sync handler from
 * services/dw-sync-service/src/index.ts covering event routing
 * to the correct handler, unknown event handling, error propagation,
 * and batch processing semantics.
 */

import type { SQSEvent } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the handler
// ---------------------------------------------------------------------------

const mockSyncPayment = jest.fn().mockResolvedValue(undefined);
const mockSyncLoan = jest.fn().mockResolvedValue(undefined);
const mockSyncKYC = jest.fn().mockResolvedValue(undefined);
const mockSyncCreditDecision = jest.fn().mockResolvedValue(undefined);

const mockSucceed = jest.fn();
const mockFail = jest.fn();
const mockStartOperation = jest.fn().mockReturnValue({
  succeed: mockSucceed,
  fail: mockFail,
});

jest.mock('../../../services/dw-sync-service/src/handlers/sync-payment', () => ({
  syncPayment: (...args: unknown[]) => mockSyncPayment(...args),
}));

jest.mock('../../../services/dw-sync-service/src/handlers/sync-loan', () => ({
  syncLoan: (...args: unknown[]) => mockSyncLoan(...args),
}));

jest.mock('../../../services/dw-sync-service/src/handlers/sync-kyc', () => ({
  syncKYC: (...args: unknown[]) => mockSyncKYC(...args),
}));

jest.mock('../../../services/dw-sync-service/src/handlers/sync-credit-decision', () => ({
  syncCreditDecision: (...args: unknown[]) => mockSyncCreditDecision(...args),
}));

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    startOperation: (...args: unknown[]) => mockStartOperation(...args),
  },
}));

import { handler } from '../../../services/dw-sync-service/src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock SQS event with the given records.
 */
function makeSQSEvent(
  records: Array<{ eventType: string; entityId: string; entityType?: string }>,
): SQSEvent {
  return {
    Records: records.map((r, i) => ({
      messageId: `msg-${i}`,
      receiptHandle: `handle-${i}`,
      body: JSON.stringify({
        eventType: r.eventType,
        entityId: r.entityId,
        entityType: r.entityType || 'unknown',
        timestamp: new Date().toISOString(),
      }),
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123:dw-sync',
      awsRegion: 'us-east-1',
    })),
  };
}

/**
 * Create an SQS event with a raw string body (for invalid JSON tests).
 */
function makeSQSEventRaw(bodies: string[]): SQSEvent {
  return {
    Records: bodies.map((body, i) => ({
      messageId: `msg-${i}`,
      receiptHandle: `handle-${i}`,
      body,
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123:dw-sync',
      awsRegion: 'us-east-1',
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DW Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Event routing
  // -----------------------------------------------------------------------

  describe('event routing', () => {
    it('should dispatch payment.confirmed to syncPayment with correct entityId', async () => {
      const event = makeSQSEvent([
        { eventType: 'payment.confirmed', entityId: 'pay-001' },
      ]);

      await handler(event);

      expect(mockSyncPayment).toHaveBeenCalledTimes(1);
      expect(mockSyncPayment).toHaveBeenCalledWith('pay-001');
      expect(mockSyncLoan).not.toHaveBeenCalled();
      expect(mockSyncKYC).not.toHaveBeenCalled();
      expect(mockSyncCreditDecision).not.toHaveBeenCalled();
    });

    it('should dispatch loan.created to syncLoan', async () => {
      const event = makeSQSEvent([
        { eventType: 'loan.created', entityId: 'loan-001' },
      ]);

      await handler(event);

      expect(mockSyncLoan).toHaveBeenCalledTimes(1);
      expect(mockSyncLoan).toHaveBeenCalledWith('loan-001');
    });

    it('should dispatch loan.disbursed to syncLoan', async () => {
      const event = makeSQSEvent([
        { eventType: 'loan.disbursed', entityId: 'loan-002' },
      ]);

      await handler(event);

      expect(mockSyncLoan).toHaveBeenCalledTimes(1);
      expect(mockSyncLoan).toHaveBeenCalledWith('loan-002');
    });

    it('should dispatch loan.status_changed to syncLoan', async () => {
      const event = makeSQSEvent([
        { eventType: 'loan.status_changed', entityId: 'loan-003' },
      ]);

      await handler(event);

      expect(mockSyncLoan).toHaveBeenCalledTimes(1);
      expect(mockSyncLoan).toHaveBeenCalledWith('loan-003');
    });

    it('should dispatch loan.written_off to syncLoan', async () => {
      const event = makeSQSEvent([
        { eventType: 'loan.written_off', entityId: 'loan-004' },
      ]);

      await handler(event);

      expect(mockSyncLoan).toHaveBeenCalledTimes(1);
      expect(mockSyncLoan).toHaveBeenCalledWith('loan-004');
    });

    it('should dispatch kyc.completed to syncKYC', async () => {
      const event = makeSQSEvent([
        { eventType: 'kyc.completed', entityId: 'kyc-001' },
      ]);

      await handler(event);

      expect(mockSyncKYC).toHaveBeenCalledTimes(1);
      expect(mockSyncKYC).toHaveBeenCalledWith('kyc-001');
    });

    it('should dispatch credit.scored to syncCreditDecision', async () => {
      const event = makeSQSEvent([
        { eventType: 'credit.scored', entityId: 'credit-001' },
      ]);

      await handler(event);

      expect(mockSyncCreditDecision).toHaveBeenCalledTimes(1);
      expect(mockSyncCreditDecision).toHaveBeenCalledWith('credit-001');
    });
  });

  // -----------------------------------------------------------------------
  // Unknown event type
  // -----------------------------------------------------------------------

  describe('unknown event type', () => {
    it('should log a warning but NOT throw for unknown event types', async () => {
      const loggerMock = require('../../../services/shared/utils/logger').default;
      const event = makeSQSEvent([
        { eventType: 'customer.deleted', entityId: 'cust-001' },
      ]);

      await expect(handler(event)).resolves.toBeUndefined();

      expect(loggerMock.warn).toHaveBeenCalledWith(
        'Unknown DW sync event type',
        expect.objectContaining({
          action: 'dw-sync.unknown',
          status: 'completed',
          metadata: { eventType: 'customer.deleted' },
        }),
      );

      // No handlers should have been called
      expect(mockSyncPayment).not.toHaveBeenCalled();
      expect(mockSyncLoan).not.toHaveBeenCalled();
      expect(mockSyncKYC).not.toHaveBeenCalled();
      expect(mockSyncCreditDecision).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Invalid JSON
  // -----------------------------------------------------------------------

  describe('invalid JSON', () => {
    it('should throw when the SQS record body is not valid JSON', async () => {
      const event = makeSQSEventRaw(['<<<NOT-VALID-JSON>>>']);

      await expect(handler(event)).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Batch processing
  // -----------------------------------------------------------------------

  describe('batch processing', () => {
    it('should not throw when all records succeed', async () => {
      const event = makeSQSEvent([
        { eventType: 'payment.confirmed', entityId: 'pay-010' },
        { eventType: 'kyc.completed', entityId: 'kyc-010' },
      ]);

      await expect(handler(event)).resolves.toBeUndefined();
    });

    it('should throw with failure count when some records fail', async () => {
      mockSyncPayment.mockRejectedValueOnce(new Error('DB timeout'));

      const event = makeSQSEvent([
        { eventType: 'payment.confirmed', entityId: 'pay-fail' },
        { eventType: 'kyc.completed', entityId: 'kyc-ok' },
      ]);

      await expect(handler(event)).rejects.toThrow('1/2 DW sync events failed');
    });

    it('should throw with correct count when all records fail', async () => {
      mockSyncPayment.mockRejectedValueOnce(new Error('DB timeout'));
      mockSyncLoan.mockRejectedValueOnce(new Error('Connection refused'));

      const event = makeSQSEvent([
        { eventType: 'payment.confirmed', entityId: 'pay-fail' },
        { eventType: 'loan.created', entityId: 'loan-fail' },
      ]);

      await expect(handler(event)).rejects.toThrow('2/2 DW sync events failed');
    });

    it('should dispatch each record in a multi-record batch to the correct handler', async () => {
      const event = makeSQSEvent([
        { eventType: 'payment.confirmed', entityId: 'pay-100' },
        { eventType: 'loan.created', entityId: 'loan-100' },
        { eventType: 'kyc.completed', entityId: 'kyc-100' },
        { eventType: 'credit.scored', entityId: 'credit-100' },
      ]);

      await handler(event);

      expect(mockSyncPayment).toHaveBeenCalledWith('pay-100');
      expect(mockSyncLoan).toHaveBeenCalledWith('loan-100');
      expect(mockSyncKYC).toHaveBeenCalledWith('kyc-100');
      expect(mockSyncCreditDecision).toHaveBeenCalledWith('credit-100');
    });
  });

  // -----------------------------------------------------------------------
  // Operation tracking (succeed / fail)
  // -----------------------------------------------------------------------

  describe('operation tracking', () => {
    it('should call op.succeed with entityId on successful processing', async () => {
      const event = makeSQSEvent([
        { eventType: 'payment.confirmed', entityId: 'pay-200' },
      ]);

      await handler(event);

      expect(mockStartOperation).toHaveBeenCalledWith('dw-sync.payment.confirmed');
      expect(mockSucceed).toHaveBeenCalledWith({ entityId: 'pay-200' });
      expect(mockFail).not.toHaveBeenCalled();
    });

    it('should call op.fail when a handler throws', async () => {
      const handlerError = new Error('sync failed');
      mockSyncLoan.mockRejectedValueOnce(handlerError);

      const event = makeSQSEvent([
        { eventType: 'loan.disbursed', entityId: 'loan-200' },
      ]);

      // The batch handler will throw because of the failure
      await expect(handler(event)).rejects.toThrow();

      expect(mockStartOperation).toHaveBeenCalledWith('dw-sync.loan.disbursed');
      expect(mockFail).toHaveBeenCalledWith(handlerError);
      expect(mockSucceed).not.toHaveBeenCalled();
    });
  });
});
