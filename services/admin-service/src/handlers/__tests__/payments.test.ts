/**
 * Tests for Payment Admin Handlers
 *
 * Covers authorization, validation, CRUD operations,
 * payment state transitions, and audit logging.
 */

// ─── Mocks ───

const mockQuery = jest.fn().mockResolvedValue({ data: [], error: null });
const mockQueryOne = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../../../shared/clients/database', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));

jest.mock('../../../../shared/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockIsAdminOrManager = jest.fn().mockReturnValue(true);
jest.mock('../../../../shared/middleware/authorization', () => ({
  isAdminOrManager: (...args: unknown[]) => mockIsAdminOrManager(...args),
}));

const mockSuccessResponse = jest.fn(
  (data: unknown, status?: number, _event?: unknown) => ({
    statusCode: status || 200,
    body: JSON.stringify({ success: true, data }),
  })
);
const mockErrorResponse = jest.fn(
  (msg: string, status: number, _details?: unknown, _event?: unknown) => ({
    statusCode: status,
    body: JSON.stringify({ success: false, error: { message: msg } }),
  })
);
const mockNotFoundResponse = jest.fn((msg: string, _event?: unknown) => ({
  statusCode: 404,
  body: JSON.stringify({ success: false, error: { message: msg } }),
}));

jest.mock('../../../../shared/utils/response', () => ({
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  errorResponse: (...args: unknown[]) => mockErrorResponse(...args),
  notFoundResponse: (...args: unknown[]) => mockNotFoundResponse(...args),
}));

const mockAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('../helpers', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

// ─── Import (after mocks) ───

import {
  handleGetPayments,
  handleGetPaymentStats,
  handleGetPaymentById,
  handleRecordManualPayment,
  handleConfirmPayment,
  handleFailPayment,
  handleRefundPayment,
  handleReconcilePayment,
  handleRetryPayment,
  handleGetPaymentSummary,
} from '../payments';

// ─── Helpers ───

function makeEvent(overrides: {
  body?: Record<string, unknown>;
  queryStringParameters?: Record<string, string>;
} = {}): any {
  return {
    body: overrides.body ? JSON.stringify(overrides.body) : '{}',
    queryStringParameters: overrides.queryStringParameters || null,
    requestContext: { requestId: 'req-test-001' },
  };
}

function makeAuth(role: string = 'admin'): any {
  return { userId: 'admin-001', email: 'admin@lynia.co.zw', role, groups: [role] };
}

// ─── Tests ───

describe('handleGetPayments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetPayments(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
    expect(mockErrorResponse).toHaveBeenCalledWith('Forbidden', 403, expect.anything(), expect.anything());
  });

  it('returns paginated payment list with defaults', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '42' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'pay-1' }, { id: 'pay-2' }], error: null });

    const result = await handleGetPayments(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.total).toBe(42);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(25);
    expect(body.data.total_pages).toBe(2);
  });

  it('applies status filter from query string', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '5' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    await handleGetPayments(
      makeEvent({ queryStringParameters: { status: 'confirmed', page: '2', limit: '10' } }),
      {},
      makeAuth()
    );

    // Verify the count query included the status filter
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('p.status = $1'),
      expect.arrayContaining(['confirmed'])
    );
  });

  it('returns 500 on unexpected error', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('DB connection failed'));

    const result = await handleGetPayments(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'An unexpected error occurred', 500, expect.anything(), expect.anything()
    );
  });
});

describe('handleGetPaymentStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetPaymentStats(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns parsed payment statistics', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_payments: '100',
        total_collected: '25000.50',
        pending_count: '10',
        failed_count: '3',
        unreconciled_count: '7',
      },
      error: null,
    });

    const result = await handleGetPaymentStats(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      {
        total_payments: 100,
        total_collected: 25000.50,
        pending_count: 10,
        failed_count: 3,
        unreconciled_count: 7,
      },
      200,
      expect.anything()
    );
  });

  it('returns zeroes when no data exists', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleGetPaymentStats(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        total_payments: 0,
        total_collected: 0,
        pending_count: 0,
      }),
      200,
      expect.anything()
    );
  });
});

describe('handleGetPaymentById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetPaymentById(makeEvent(), { id: 'pay-1' }, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns 404 when payment is not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleGetPaymentById(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
    expect(mockNotFoundResponse).toHaveBeenCalledWith('Payment', expect.anything());
  });

  it('returns payment detail with customer and loan joins', async () => {
    const payment = {
      id: 'pay-1',
      amount_usd: 150,
      status: 'confirmed',
      customers: { id: 'cust-1', first_name: 'John', last_name: 'Doe' },
      loans: { id: 'loan-1', principal: 500, status: 'active' },
    };
    mockQueryOne.mockResolvedValueOnce({ data: payment, error: null });

    const result = await handleGetPaymentById(makeEvent(), { id: 'pay-1' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(payment, 200, expect.anything());
  });
});

describe('handleRecordManualPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleRecordManualPayment(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    const result = await handleRecordManualPayment(
      makeEvent({ body: { loan_id: 'loan-1' } }),
      {},
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      expect.stringContaining('Missing required fields'),
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('returns 400 when amount_usd is not a positive number', async () => {
    const result = await handleRecordManualPayment(
      makeEvent({
        body: {
          loan_id: 'loan-1',
          customer_id: 'cust-1',
          amount_usd: -10,
          payment_method: 'ecocash',
          payment_type: 'repayment',
        },
      }),
      {},
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'amount_usd must be a positive number',
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('successfully records a manual payment and creates audit log', async () => {
    const insertedPayment = { id: 'pay-new', amount_usd: 100, status: 'confirmed' };
    mockQueryOne.mockResolvedValueOnce({ data: insertedPayment, error: null });

    const result = await handleRecordManualPayment(
      makeEvent({
        body: {
          loan_id: 'loan-1',
          customer_id: 'cust-1',
          amount_usd: 100,
          payment_method: 'ecocash',
          payment_type: 'repayment',
          notes: 'Cash collected by agent',
        },
      }),
      {},
      makeAuth()
    );

    expect(result.statusCode).toBe(201);
    expect(mockSuccessResponse).toHaveBeenCalledWith(insertedPayment, 201, expect.anything());
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'payment.manual_record',
      'payment',
      'pay-new',
      expect.stringContaining('$100'),
      expect.objectContaining({ loan_id: 'loan-1', amount_usd: 100 })
    );
  });
});

describe('handleConfirmPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleConfirmPayment(makeEvent(), { id: 'pay-1' }, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns 404 when payment is not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleConfirmPayment(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
  });

  it('returns 409 when payment is not in pending status', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: { status: 'confirmed', payment_type: 'repayment', loan_id: 'loan-1' },
      error: null,
    });

    const result = await handleConfirmPayment(makeEvent(), { id: 'pay-1' }, makeAuth());

    expect(result.statusCode).toBe(409);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      expect.stringContaining("current status is 'confirmed'"),
      409,
      expect.anything(),
      expect.anything()
    );
  });

  it('confirms a pending payment and creates audit log', async () => {
    const confirmed = { id: 'pay-1', status: 'confirmed' };
    // First queryOne: fetch existing payment
    mockQueryOne
      .mockResolvedValueOnce({ data: { status: 'pending', payment_type: 'repayment', loan_id: 'loan-1' }, error: null })
      // Second queryOne: update payment
      .mockResolvedValueOnce({ data: confirmed, error: null });

    const result = await handleConfirmPayment(
      makeEvent({ body: { notes: 'Verified via bank statement' } }),
      { id: 'pay-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'payment.confirm',
      'payment',
      'pay-1',
      'Manually confirmed payment',
      expect.objectContaining({ notes: 'Verified via bank statement' })
    );
  });

  it('updates loan status to paid_deposit when confirming a deposit payment', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ data: { status: 'pending', payment_type: 'deposit', loan_id: 'loan-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'pay-1', status: 'confirmed' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'loan-1' }], error: null });

    await handleConfirmPayment(makeEvent(), { id: 'pay-1' }, makeAuth());

    // Verify loan status update query was called
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'paid_deposit'"),
      expect.arrayContaining(['loan-1'])
    );
  });
});

describe('handleRefundPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleRefundPayment(makeEvent(), { id: 'pay-1' }, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns 404 when payment is not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleRefundPayment(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
  });

  it('returns 409 when payment is already refunded', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { status: 'refunded' }, error: null });

    const result = await handleRefundPayment(makeEvent(), { id: 'pay-1' }, makeAuth());

    expect(result.statusCode).toBe(409);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Payment is already refunded',
      409,
      expect.anything(),
      expect.anything()
    );
  });

  it('successfully refunds a confirmed payment and creates audit log', async () => {
    const refunded = { id: 'pay-1', status: 'refunded' };
    mockQueryOne
      .mockResolvedValueOnce({ data: { status: 'confirmed' }, error: null })
      .mockResolvedValueOnce({ data: refunded, error: null });

    const result = await handleRefundPayment(
      makeEvent({ body: { notes: 'Customer overcharged' } }),
      { id: 'pay-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(refunded, 200, expect.anything());
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'payment.refund',
      'payment',
      'pay-1',
      'Refunded payment',
      expect.objectContaining({ notes: 'Customer overcharged' })
    );
  });
});

describe('handleFailPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 404 when payment is not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleFailPayment(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
  });

  it('marks payment as failed with default reason', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ data: { status: 'pending' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'pay-1', status: 'failed' }, error: null });

    const result = await handleFailPayment(makeEvent(), { id: 'pay-1' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      expect.arrayContaining(['pay-1', 'Marked as failed by admin'])
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'payment.fail',
      'payment',
      'pay-1',
      'Marked payment as failed',
      expect.anything()
    );
  });
});

describe('handleReconcilePayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 404 when payment is not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleReconcilePayment(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
  });

  it('reconciles a payment and sets reconciled_by to admin user', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ data: { status: 'confirmed', reconciled: false }, error: null })
      .mockResolvedValueOnce({ data: { id: 'pay-1', reconciled: true, reconciled_by: 'admin-001' }, error: null });

    const result = await handleReconcilePayment(makeEvent(), { id: 'pay-1' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('reconciled = true'),
      expect.arrayContaining(['pay-1', 'admin-001'])
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'payment.reconcile',
      'payment',
      'pay-1',
      'Reconciled payment'
    );
  });
});

describe('handleRetryPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 404 when payment is not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleRetryPayment(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
  });

  it('resets a failed payment back to pending', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ data: { status: 'failed' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'pay-1', status: 'pending' }, error: null });

    const result = await handleRetryPayment(makeEvent(), { id: 'pay-1' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining("status = 'pending'"),
      expect.arrayContaining(['pay-1'])
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'payment.retry',
      'payment',
      'pay-1',
      'Retried failed payment'
    );
  });
});

describe('handleGetPaymentSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetPaymentSummary(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns payment summary with parsed numeric values', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: {
        total_confirmed: '15000.00',
        total_pending: '2500.00',
        total_failed: '500.00',
        total_refunded: '300.00',
        count_confirmed: '50',
        count_pending: '8',
        count_failed: '2',
        count_refunded: '1',
      },
      error: null,
    });

    const result = await handleGetPaymentSummary(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      {
        total_confirmed: 15000,
        total_pending: 2500,
        total_failed: 500,
        total_refunded: 300,
        count_confirmed: 50,
        count_pending: 8,
        count_failed: 2,
        count_refunded: 1,
      },
      200,
      expect.anything()
    );
  });

  it('applies date range filters from query string', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    await handleGetPaymentSummary(
      makeEvent({ queryStringParameters: { date_from: '2024-01-01', date_to: '2024-12-31' } }),
      {},
      makeAuth()
    );

    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('payment_date >= $1'),
      expect.arrayContaining(['2024-01-01', '2024-12-31'])
    );
  });
});
