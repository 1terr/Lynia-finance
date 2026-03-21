/**
 * Tests for handleCancelLoan handler
 *
 * Covers authorization, validation, cancellation logic,
 * deposit refund flow, device release, and audit logging.
 */

// ─── Mocks ───

const mockExecute = jest.fn().mockResolvedValue({ data: null, error: null });

function createChain() {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'eq', 'neq', 'in', 'order', 'limit', 'single'];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.execute = mockExecute;
  return chain;
}

const mockFrom = jest.fn().mockImplementation(() => createChain());
const mockQueryOne = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../../../../shared/clients/database', () => ({
  db: { from: mockFrom },
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

const mockProcessLoanUpdate = jest.fn().mockResolvedValue(undefined);
const mockSendNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../shared/utils/sqs-publisher', () => ({
  SQSQueues: {
    processLoanUpdate: (...args: unknown[]) => mockProcessLoanUpdate(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

// ─── Import (after mocks to avoid hoisting issues) ───
import { handleCancelLoan } from '../loans';

// ─── Helpers ───

function makeEvent(body?: Record<string, unknown>): any {
  return {
    body: body ? JSON.stringify(body) : '{}',
    requestContext: { requestId: 'req-test-001' },
  };
}

function makeAuth(role: string = 'admin'): any {
  return { userId: 'admin-001', role, groups: [role] };
}

function makeLoan(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'loan-001',
    loan_number: 'LN-TEST-001',
    status: 'approved',
    customer_id: 'cust-001',
    product_category: 'smartphone',
    device_id: 'dev-001',
    deposit_paid: false,
    deposit_amount_usd: null,
    ...overrides,
  };
}

// ─── Tests ───

describe('handleCancelLoan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
    mockQueryOne.mockResolvedValue({ data: null, error: null });
    mockExecute.mockResolvedValue({ data: null, error: null });
  });

  // ── Authorization ──

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Forbidden',
      403,
      expect.objectContaining({ requestId: 'req-test-001' }),
      expect.anything()
    );
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  // ── Validation ──

  it('returns 400 when loan ID is missing from params', async () => {
    const result = await handleCancelLoan(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Missing loan ID',
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('returns 404 when loan is not found', async () => {
    mockQueryOne.mockResolvedValue({ data: null, error: null });

    const result = await handleCancelLoan(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
    expect(mockNotFoundResponse).toHaveBeenCalledWith('Loan not found', expect.anything());
  });

  it('returns 404 when queryOne returns an error', async () => {
    mockQueryOne.mockResolvedValue({ data: null, error: new Error('DB error') });

    const result = await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(result.statusCode).toBe(404);
  });

  // ── Status validation ──

  it('returns 400 when loan status is "active" (not cancellable)', async () => {
    mockQueryOne.mockResolvedValue({ data: makeLoan({ status: 'active' }), error: null });

    const result = await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      expect.stringContaining('cannot be cancelled'),
      400,
      expect.objectContaining({ currentStatus: 'active' }),
      expect.anything()
    );
  });

  it('returns 400 when loan status is "disbursed" (not cancellable)', async () => {
    mockQueryOne.mockResolvedValue({ data: makeLoan({ status: 'disbursed' }), error: null });

    const result = await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      expect.stringContaining('cannot be cancelled'),
      400,
      expect.objectContaining({ currentStatus: 'disbursed' }),
      expect.anything()
    );
  });

  // ── Successful cancellation ──

  it('successfully cancels a loan with status "approved"', async () => {
    const loan = makeLoan({ status: 'approved' });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    const result = await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.status).toBe('cancelled');
    expect(responseBody.data.previous_status).toBe('approved');
  });

  it('successfully cancels a loan with status "paid_deposit"', async () => {
    const loan = makeLoan({ status: 'paid_deposit' });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    const result = await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.data.previous_status).toBe('paid_deposit');
  });

  // ── Cancellation reason ──

  it('sets cancellation_reason from request body', async () => {
    const loan = makeLoan({ status: 'approved' });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    await handleCancelLoan(
      makeEvent({ reason: 'Customer requested cancellation' }),
      { id: 'loan-001' },
      makeAuth()
    );

    // Verify the update call includes the provided reason
    expect(mockFrom).toHaveBeenCalledWith('loans');
    const responseData = mockSuccessResponse.mock.calls[0][0];
    expect(responseData.cancellation_reason).toBe('Customer requested cancellation');
  });

  it('defaults cancellation reason to "Cancelled by admin" when not provided', async () => {
    const loan = makeLoan({ status: 'approved' });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    const responseData = mockSuccessResponse.mock.calls[0][0];
    expect(responseData.cancellation_reason).toBe('Cancelled by admin');
  });

  // ── Deposit refund flow ──

  it('creates pending refund payment record when deposit was paid', async () => {
    const loan = makeLoan({
      status: 'paid_deposit',
      deposit_paid: true,
      deposit_amount_usd: 50,
    });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    // Verify payments insert was called
    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toContain('payments');
  });

  it('queues loan status update SQS message when deposit was paid', async () => {
    const loan = makeLoan({
      status: 'paid_deposit',
      deposit_paid: true,
      deposit_amount_usd: 50,
    });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(mockProcessLoanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        loanId: 'loan-001',
        action: 'status_change',
        metadata: expect.objectContaining({
          type: 'refund',
          refund_amount: 50,
          reason: 'loan_cancellation_deposit_refund',
        }),
      })
    );
  });

  it('sends WhatsApp refund notification when deposit was paid', async () => {
    const loan = makeLoan({
      status: 'paid_deposit',
      deposit_paid: true,
      deposit_amount_usd: 50,
    });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-001',
        channel: 'whatsapp',
        templateName: 'deposit_refund_initiated',
        templateParams: expect.objectContaining({
          amount: '50',
          loan_number: 'LN-TEST-001',
        }),
      })
    );
  });

  // ── Device reservation release ──

  it('releases device reservation for smartphone loans with a device', async () => {
    const loan = makeLoan({
      status: 'approved',
      product_category: 'smartphone',
      device_id: 'dev-001',
    });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).toContain('devices');
  });

  it('does NOT release device for digital loans without device_id', async () => {
    const loan = makeLoan({
      status: 'approved',
      product_category: 'digital_loan',
      device_id: null,
    });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).not.toContain('devices');
  });

  // ── Audit log ──

  it('creates audit log entry with correct details', async () => {
    const loan = makeLoan({ status: 'approved' });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });
    const auth = makeAuth();

    await handleCancelLoan(makeEvent(), { id: 'loan-001' }, auth);

    expect(mockAuditLog).toHaveBeenCalledWith(
      auth,
      'loan.cancelled',
      'loan',
      'loan-001',
      'Loan LN-TEST-001 cancelled: Cancelled by admin',
      expect.objectContaining({
        previous_status: 'approved',
        cancellation_reason: 'Cancelled by admin',
        deposit_refund_required: false,
        device_released: true,
      })
    );
  });

  // ── Response shape ──

  it('returns success response with previous_status and deposit_refund_required', async () => {
    const loan = makeLoan({
      status: 'paid_deposit',
      deposit_paid: true,
      deposit_amount_usd: 50,
    });
    mockQueryOne.mockResolvedValue({ data: loan, error: null });

    const result = await handleCancelLoan(makeEvent(), { id: 'loan-001' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'loan-001',
        loan_number: 'LN-TEST-001',
        status: 'cancelled',
        previous_status: 'paid_deposit',
        deposit_refund_required: true,
      }),
      200,
      expect.anything()
    );
  });
});
