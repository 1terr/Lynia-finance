/**
 * Integration Tests: DW Sync Service
 * Tests the dw-sync-service Lambda handler with mocked database interactions.
 * This service processes SQS events to sync business data into the data warehouse.
 * Covers payment, loan, KYC, and credit decision sync event types.
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';

// ---------------------------------------------------------------------------
// Mocks — MUST be set up before importing the handler
// ---------------------------------------------------------------------------

const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });

function createChain() {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or', 'order', 'limit',
    'single', 'maybeSingle', 'offset', 'range', 'count',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = mockExecute;
  return chain;
}

jest.mock('../../services/shared/clients/database', () => ({
  db: { from: jest.fn().mockImplementation(() => createChain()) },
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
  queryOne: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

jest.mock('../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }),
  },
  setRequestContext: jest.fn().mockReturnValue('req-test-123'),
  clearRequestContext: jest.fn(),
}));

import { handler } from '../../services/dw-sync-service/src/index';
import { query } from '../../services/shared/clients/database';

const mockQuery = query as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSQSRecord(body: Record<string, unknown>): SQSRecord {
  return {
    messageId: `msg-${Date.now()}`,
    receiptHandle: 'receipt-handle-123',
    body: JSON.stringify(body),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: String(Date.now()),
      SenderId: 'sender-123',
      ApproximateFirstReceiveTimestamp: String(Date.now()),
    },
    messageAttributes: {},
    md5OfBody: 'md5-hash',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:lynia-dw-sync',
    awsRegion: 'us-east-1',
  };
}

function createSQSEvent(records: SQSRecord[]): SQSEvent {
  return { Records: records };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DW Sync Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({ data: [], error: null });
    mockQuery.mockResolvedValue({ data: [], error: null });
  });

  // =========================================================================
  // payment.confirmed
  // =========================================================================
  describe('payment.confirmed event', () => {
    it('should sync payment to data warehouse', async () => {
      // 1st query: upsert fact_payment
      mockQuery
        .mockResolvedValueOnce({ data: [], error: null })
        // 2nd query: update fact_loan
        .mockResolvedValueOnce({ data: [], error: null });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'payment.confirmed',
          entityId: 'pay-001',
          entityType: 'payment',
          timestamp: new Date().toISOString(),
        }),
      ]);

      // Should complete without throwing
      await expect(handler(event)).resolves.toBeUndefined();
    });

    it('should throw when payment sync fails', async () => {
      mockQuery.mockResolvedValueOnce({ data: [], error: new Error('DB write error') });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'payment.confirmed',
          entityId: 'pay-002',
          entityType: 'payment',
          timestamp: new Date().toISOString(),
        }),
      ]);

      // Should throw so SQS retries the message
      await expect(handler(event)).rejects.toThrow();
    });
  });

  // =========================================================================
  // loan.created
  // =========================================================================
  describe('loan.created event', () => {
    it('should sync new loan to data warehouse', async () => {
      // ensureDimensions: 3 queries (dim_customer, dim_device, dim_geography)
      // syncLoan: 1 query (upsert fact_loan)
      mockQuery
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'loan.created',
          entityId: 'loan-001',
          entityType: 'loan',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).resolves.toBeUndefined();
    });

    it('should throw when loan sync fails', async () => {
      // First 3 pass (dimensions), 4th fails (fact_loan)
      mockQuery
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: new Error('Constraint violation') });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'loan.created',
          entityId: 'loan-002',
          entityType: 'loan',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).rejects.toThrow();
    });
  });

  // =========================================================================
  // loan.disbursed
  // =========================================================================
  describe('loan.disbursed event', () => {
    it('should sync disbursed loan to data warehouse', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'loan.disbursed',
          entityId: 'loan-003',
          entityType: 'loan',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // loan.status_changed
  // =========================================================================
  describe('loan.status_changed event', () => {
    it('should sync status change to data warehouse', async () => {
      mockQuery
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'loan.status_changed',
          entityId: 'loan-004',
          entityType: 'loan',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // kyc.completed
  // =========================================================================
  describe('kyc.completed event', () => {
    it('should sync KYC completion to data warehouse', async () => {
      // syncKYC uses query calls
      mockQuery.mockResolvedValue({ data: [], error: null });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'kyc.completed',
          entityId: 'kyc-001',
          entityType: 'kyc_submission',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // credit.scored
  // =========================================================================
  describe('credit.scored event', () => {
    it('should sync credit decision to data warehouse', async () => {
      mockQuery.mockResolvedValue({ data: [], error: null });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'credit.scored',
          entityId: 'score-001',
          entityType: 'credit_score',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Unknown event type
  // =========================================================================
  describe('Unknown event type', () => {
    it('should log warning and skip unknown event types', async () => {
      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'unknown.event',
          entityId: 'entity-001',
          entityType: 'unknown',
          timestamp: new Date().toISOString(),
        }),
      ]);

      // Should complete without throwing since unknown events are skipped
      await expect(handler(event)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Batch processing
  // =========================================================================
  describe('Batch processing', () => {
    it('should process multiple records in a batch', async () => {
      // All queries succeed
      mockQuery.mockResolvedValue({ data: [], error: null });

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'payment.confirmed',
          entityId: 'pay-010',
          entityType: 'payment',
          timestamp: new Date().toISOString(),
        }),
        createSQSRecord({
          eventType: 'payment.confirmed',
          entityId: 'pay-011',
          entityType: 'payment',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).resolves.toBeUndefined();
    });

    it('should throw if any record in batch fails', async () => {
      // First record succeeds, second fails
      mockQuery
        .mockResolvedValueOnce({ data: [], error: null }) // pay-010 step 1
        .mockResolvedValueOnce({ data: [], error: null }) // pay-010 step 2
        .mockResolvedValueOnce({ data: [], error: new Error('Write failure') }); // pay-011 step 1

      const event = createSQSEvent([
        createSQSRecord({
          eventType: 'payment.confirmed',
          entityId: 'pay-010',
          entityType: 'payment',
          timestamp: new Date().toISOString(),
        }),
        createSQSRecord({
          eventType: 'payment.confirmed',
          entityId: 'pay-011',
          entityType: 'payment',
          timestamp: new Date().toISOString(),
        }),
      ]);

      await expect(handler(event)).rejects.toThrow('1/2 DW sync events failed');
    });
  });
});
