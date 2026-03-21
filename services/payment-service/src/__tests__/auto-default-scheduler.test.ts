/**
 * Unit Tests: Auto-Default Scheduler
 *
 * Tests the processAutoDefaults() function that auto-defaults loans
 * 90+ days past due. Covers loan status updates, device lock queueing,
 * notification queueing, audit logging, and error handling.
 */

// ── Mocks ────────────────────────────────────────────────────────────────

const mockExecute = jest.fn().mockResolvedValue({ data: null, error: null });

function createChain() {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not',
    'or', 'order', 'limit', 'single', 'maybeSingle',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = mockExecute;
  return chain;
}

const mockFrom = jest.fn().mockImplementation(() => createChain());

jest.mock('../../../shared/clients/database', () => ({
  db: { from: mockFrom },
  query: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('../../../shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../shared/utils/metrics', () => ({
  publishMetrics: jest.fn().mockResolvedValue(undefined),
}));

const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  SendMessageCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────

import { processAutoDefaults } from '../auto-default-scheduler';
import { query } from '../../../shared/clients/database';

const mockQuery = query as jest.Mock;

// ── Helpers ─────────────────────────────────────────────────────────────

function makeLoan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'loan-001',
    customer_id: 'cust-001',
    loan_number: 'LN-2025-001',
    product_category: 'smartphone',
    outstanding_balance_usd: 250,
    next_payment_date: '2025-06-01',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('processAutoDefaults', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish default mock behavior after clearAllMocks
    mockExecute.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => createChain());
    process.env = {
      ...originalEnv,
      DEVICE_LOCK_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/123/device-lock',
      NOTIFICATION_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/123/notifications',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ── No overdue loans ─────────────────────────────────────────────────

  it('returns zero counts when no overdue loans', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await processAutoDefaults();

    expect(result).toEqual({
      processed: 0,
      defaulted: 0,
      errors: 0,
      loanIds: [],
    });
  });

  // ── Loan status update ───────────────────────────────────────────────

  it('updates loan status to defaulted for overdue loans', async () => {
    const loan = makeLoan();
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    await processAutoDefaults();

    expect(mockFrom).toHaveBeenCalledWith('loans');
  });

  it('sets defaulted_at timestamp on the loan', async () => {
    const loan = makeLoan();
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    const chain = createChain();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'loans') return chain;
      return createChain();
    });

    await processAutoDefaults();

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'defaulted',
        defaulted_at: expect.any(String),
      }),
    );
  });

  // ── Device lock queueing ─────────────────────────────────────────────

  it('queues device lock for smartphone loans via SQS', async () => {
    const loan = makeLoan({ product_category: 'smartphone' });
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    await processAutoDefaults();

    // Two SQS sends: one for device lock, one for notification
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        QueueUrl: process.env.DEVICE_LOCK_QUEUE_URL,
        MessageBody: expect.stringContaining('"action":"lock"'),
      }),
    );
  });

  it('does NOT queue device lock for digital loans', async () => {
    const loan = makeLoan({ product_category: 'digital' });
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    await processAutoDefaults();

    // Should only send notification, not device lock
    const lockCalls = mockSend.mock.calls.filter(
      (call) => {
        const body = typeof call[0]?.MessageBody === 'string'
          ? call[0].MessageBody
          : '';
        return body.includes('"action":"lock"');
      },
    );
    expect(lockCalls).toHaveLength(0);
  });

  // ── Notification queueing ────────────────────────────────────────────

  it('queues default notification via SQS', async () => {
    const loan = makeLoan();
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    await processAutoDefaults();

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
        MessageBody: expect.stringContaining('"type":"loan_defaulted"'),
      }),
    );
  });

  // ── Audit log ────────────────────────────────────────────────────────

  it('creates audit log entry for each defaulted loan', async () => {
    const loan = makeLoan();
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    await processAutoDefaults();

    expect(mockFrom).toHaveBeenCalledWith('audit_log');
  });

  // ── Error handling ───────────────────────────────────────────────────

  it('continues processing when one loan fails', async () => {
    const loans = [
      makeLoan({ id: 'loan-001' }),
      makeLoan({ id: 'loan-002' }),
    ];
    mockQuery.mockResolvedValueOnce({ data: loans, error: null });

    // First loan update fails, second succeeds
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      const chain = createChain();
      chain.execute.mockImplementation(() => {
        callCount++;
        // Fail on first loans update, succeed on everything else
        if (callCount === 1) {
          return Promise.reject(new Error('DB error'));
        }
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    });

    const result = await processAutoDefaults();

    // Both loans processed: one errored, one defaulted
    expect(result.processed).toBe(2);
  });

  it('increments error count on individual failure', async () => {
    const loan = makeLoan();
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    mockFrom.mockImplementation(() => {
      const chain = createChain();
      chain.execute.mockRejectedValue(new Error('DB failure'));
      return chain;
    });

    const result = await processAutoDefaults();

    expect(result.errors).toBe(1);
    expect(result.defaulted).toBe(0);
  });

  // ── Result structure ─────────────────────────────────────────────────

  it('returns correct result structure with loanIds', async () => {
    const loans = [
      makeLoan({ id: 'loan-aaa' }),
      makeLoan({ id: 'loan-bbb' }),
    ];
    mockQuery.mockResolvedValueOnce({ data: loans, error: null });

    const result = await processAutoDefaults();

    expect(result).toMatchObject({
      processed: 2,
      defaulted: 2,
      errors: 0,
    });
    expect(result.loanIds).toContain('loan-aaa');
    expect(result.loanIds).toContain('loan-bbb');
  });

  // ── Missing queue URLs ───────────────────────────────────────────────

  it('skips device lock when DEVICE_LOCK_QUEUE_URL not set', async () => {
    delete process.env.DEVICE_LOCK_QUEUE_URL;
    const loan = makeLoan({ product_category: 'smartphone' });
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    await processAutoDefaults();

    const lockCalls = mockSend.mock.calls.filter(
      (call) => {
        const body = typeof call[0]?.MessageBody === 'string'
          ? call[0].MessageBody
          : '';
        return body.includes('"action":"lock"');
      },
    );
    expect(lockCalls).toHaveLength(0);
  });

  it('skips notification when NOTIFICATION_QUEUE_URL not set', async () => {
    delete process.env.NOTIFICATION_QUEUE_URL;
    const loan = makeLoan();
    mockQuery.mockResolvedValueOnce({ data: [loan], error: null });

    await processAutoDefaults();

    const notifCalls = mockSend.mock.calls.filter(
      (call) => {
        const body = typeof call[0]?.MessageBody === 'string'
          ? call[0].MessageBody
          : '';
        return body.includes('"type":"loan_defaulted"');
      },
    );
    expect(notifCalls).toHaveLength(0);
  });
});
