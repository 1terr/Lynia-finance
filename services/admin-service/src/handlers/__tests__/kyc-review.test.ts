/**
 * Tests for KYC Review Admin Handlers
 *
 * Covers authorization, listing pending/reviewed submissions,
 * approve/reject state transitions, SLA stats, and audit logging.
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

jest.mock('../../../../shared/utils/response', () => ({
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  errorResponse: (...args: unknown[]) => mockErrorResponse(...args),
}));

// ─── Import (after mocks) ───

import {
  handleGetKYCPending,
  handleGetKYCReviewHistory,
  handleGetKYCSLAStats,
  handleApproveKYC,
  handleRejectKYC,
} from '../kyc-review';

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

describe('handleGetKYCPending', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetKYCPending(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
    expect(mockErrorResponse).toHaveBeenCalledWith('Forbidden', 403, expect.anything(), expect.anything());
  });

  it('returns paginated pending KYC submissions', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '5' }, error: null });
    mockQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'kyc-1',
          customer_id: 'cust-1',
          status: 'pending',
          customer__id: 'cust-1',
          customer__full_name: 'Tatenda Moyo',
          customer__phone_number: '+263771234567',
          extracted_name: 'Tatenda Moyo',
          extracted_dob: '1990-01-15',
        },
      ],
      error: null,
    });

    const result = await handleGetKYCPending(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.total).toBe(5);
    expect(body.data.page).toBe(1);
    expect(body.data.data).toHaveLength(1);
    // Verify customer object is nested correctly
    expect(body.data.data[0].customer).toEqual({
      id: 'cust-1',
      full_name: 'Tatenda Moyo',
      phone_number: '+263771234567',
    });
  });

  it('splits extracted_name into first and last name', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' }, error: null });
    mockQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'kyc-1',
          customer_id: 'cust-1',
          status: 'pending',
          customer__id: 'cust-1',
          customer__full_name: 'Test',
          customer__phone_number: '+263770000000',
          extracted_name: 'John Paul Doe',
          extracted_dob: '1985-06-20',
        },
      ],
      error: null,
    });

    const result = await handleGetKYCPending(makeEvent(), {}, makeAuth());

    const body = JSON.parse(result.body);
    const submission = body.data.data[0];
    expect(submission.extracted_first_name).toBe('John');
    expect(submission.extracted_last_name).toBe('Paul Doe');
    expect(submission.extracted_date_of_birth).toBe('1985-06-20');
  });

  it('handles null customer gracefully', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' }, error: null });
    mockQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'kyc-orphan',
          customer_id: null,
          status: 'pending',
          customer__id: null,
          customer__full_name: null,
          customer__phone_number: null,
          extracted_name: '',
          extracted_dob: null,
        },
      ],
      error: null,
    });

    const result = await handleGetKYCPending(makeEvent(), {}, makeAuth());

    const body = JSON.parse(result.body);
    expect(body.data.data[0].customer).toBeNull();
  });

  it('returns 500 when query fails', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await handleGetKYCPending(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Failed to fetch pending submissions',
      500,
      expect.anything(),
      expect.anything()
    );
  });

  it('respects custom pagination parameters', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '50' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await handleGetKYCPending(
      makeEvent({ queryStringParameters: { page: '2', limit: '10' } }),
      {},
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.page).toBe(2);
    expect(body.data.limit).toBe(10);
    expect(body.data.total_pages).toBe(5);
    // Verify OFFSET is correct (page 2 with limit 10 = offset 10)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      [10, 10]
    );
  });
});

describe('handleGetKYCReviewHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetKYCReviewHistory(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns reviewed submissions with nested customer data', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '20' }, error: null });
    mockQuery.mockResolvedValueOnce({
      data: [
        {
          id: 'kyc-1',
          customer_id: 'cust-1',
          status: 'verified',
          customer__full_name: 'Tatenda Moyo',
          customer__phone_number: '+263771234567',
        },
        {
          id: 'kyc-2',
          customer_id: 'cust-2',
          status: 'rejected',
          customer__full_name: 'Chipo Ndlovu',
          customer__phone_number: '+263772345678',
        },
      ],
      error: null,
    });

    const result = await handleGetKYCReviewHistory(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.data).toHaveLength(2);
    expect(body.data.data[0].customer.full_name).toBe('Tatenda Moyo');
    expect(body.data.data[1].customer.full_name).toBe('Chipo Ndlovu');
  });

  it('returns 500 when query fails', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await handleGetKYCReviewHistory(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(500);
  });
});

describe('handleGetKYCSLAStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetKYCSLAStats(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns SLA statistics with parsed numeric values', async () => {
    mockQueryOne.mockResolvedValueOnce({
      data: { total: '15', within4h: '8', within24h: '5', over24h: '2' },
      error: null,
    });

    const result = await handleGetKYCSLAStats(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      { total: 15, within4h: 8, within24h: 5, over24h: 2 },
      200,
      expect.anything()
    );
  });

  it('returns zeroes when no pending submissions exist', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleGetKYCSLAStats(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      { total: 0, within4h: 0, within24h: 0, over24h: 0 },
      200,
      expect.anything()
    );
  });
});

describe('handleApproveKYC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleApproveKYC(
      makeEvent({ body: { customer_id: 'cust-1' } }),
      { id: 'kyc-1' },
      makeAuth('viewer')
    );

    expect(result.statusCode).toBe(403);
  });

  it('returns 400 when customer_id is missing', async () => {
    const result = await handleApproveKYC(
      makeEvent({ body: {} }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'customer_id is required',
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('returns 404 when submission is not found or already reviewed', async () => {
    // First query: update returns empty (no matching pending submission)
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await handleApproveKYC(
      makeEvent({ body: { customer_id: 'cust-1' } }),
      { id: 'kyc-nonexistent' },
      makeAuth()
    );

    expect(result.statusCode).toBe(404);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Submission not found or already reviewed',
      404,
      expect.anything(),
      expect.anything()
    );
  });

  it('approves a pending KYC submission and updates customer status', async () => {
    // First query: update kyc_submissions (returns id)
    mockQuery
      .mockResolvedValueOnce({ data: [{ id: 'kyc-1' }], error: null })
      // Third query: update customer kyc_status
      .mockResolvedValueOnce({ data: [{ id: 'cust-1' }], error: null })
      // Fourth query: audit log insert
      .mockResolvedValueOnce({ data: [{ id: 'audit-1' }], error: null });

    // Second queryOne: fetch extracted_name
    mockQueryOne.mockResolvedValueOnce({
      data: { extracted_name: 'Tatenda Moyo' },
      error: null,
    });

    const result = await handleApproveKYC(
      makeEvent({ body: { customer_id: 'cust-1' } }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      { message: 'KYC approved' },
      200,
      expect.anything()
    );

    // Verify kyc_submissions was updated with correct status
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'verified'"),
      expect.arrayContaining(['kyc-1'])
    );

    // Verify customer was updated with extracted name
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("kyc_status = 'verified'"),
      expect.arrayContaining(['cust-1'])
    );

    // Verify audit log was created
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining(['admin-001', 'admin@lynia.co.zw', 'kyc-1'])
    );
  });

  it('returns 500 when the update query fails', async () => {
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await handleApproveKYC(
      makeEvent({ body: { customer_id: 'cust-1' } }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Failed to approve KYC submission',
      500,
      expect.anything(),
      expect.anything()
    );
  });

  it('updates customer without name when extracted_name is empty', async () => {
    mockQuery
      .mockResolvedValueOnce({ data: [{ id: 'kyc-1' }], error: null })
      // Customer update (no name fields)
      .mockResolvedValueOnce({ data: [{ id: 'cust-1' }], error: null })
      // Audit log
      .mockResolvedValueOnce({ data: [{ id: 'audit-1' }], error: null });

    mockQueryOne.mockResolvedValueOnce({
      data: { extracted_name: '' },
      error: null,
    });

    const result = await handleApproveKYC(
      makeEvent({ body: { customer_id: 'cust-1' } }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    // Should call the simpler customer update (without name fields)
    const customerUpdateCalls = mockQuery.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes("kyc_status = 'verified'")
    );
    expect(customerUpdateCalls).toHaveLength(1);
    // The simpler update has 2 parameters [now, customer_id]
    expect(customerUpdateCalls[0][1]).toHaveLength(2);
  });
});

describe('handleRejectKYC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleRejectKYC(
      makeEvent({ body: { customer_id: 'cust-1', reason: 'Blurry document' } }),
      { id: 'kyc-1' },
      makeAuth('viewer')
    );

    expect(result.statusCode).toBe(403);
  });

  it('returns 400 when customer_id is missing', async () => {
    const result = await handleRejectKYC(
      makeEvent({ body: { reason: 'Blurry document' } }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'customer_id is required',
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('returns 400 when reason is missing', async () => {
    const result = await handleRejectKYC(
      makeEvent({ body: { customer_id: 'cust-1' } }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'reason is required',
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('returns 404 when submission is not found or already reviewed', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await handleRejectKYC(
      makeEvent({ body: { customer_id: 'cust-1', reason: 'Blurry document' } }),
      { id: 'kyc-nonexistent' },
      makeAuth()
    );

    expect(result.statusCode).toBe(404);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Submission not found or already reviewed',
      404,
      expect.anything(),
      expect.anything()
    );
  });

  it('rejects a pending KYC submission with reason and updates customer status', async () => {
    mockQuery
      // First: update kyc_submissions
      .mockResolvedValueOnce({ data: [{ id: 'kyc-1' }], error: null })
      // Second: update customer kyc_status to rejected
      .mockResolvedValueOnce({ data: [{ id: 'cust-1' }], error: null })
      // Third: audit log insert
      .mockResolvedValueOnce({ data: [{ id: 'audit-1' }], error: null });

    const result = await handleRejectKYC(
      makeEvent({ body: { customer_id: 'cust-1', reason: 'Blurry document, cannot read ID number' } }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      { message: 'KYC rejected' },
      200,
      expect.anything()
    );

    // Verify kyc_submissions was updated with rejection
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'rejected'"),
      expect.arrayContaining(['Blurry document, cannot read ID number', 'kyc-1'])
    );

    // Verify customer kyc_status set to rejected
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("kyc_status = 'rejected'"),
      expect.arrayContaining(['cust-1'])
    );

    // Verify audit log includes rejection reason
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining([
        expect.stringContaining('Blurry document'),
      ])
    );
  });

  it('returns 500 when the update query fails', async () => {
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await handleRejectKYC(
      makeEvent({ body: { customer_id: 'cust-1', reason: 'Invalid document' } }),
      { id: 'kyc-1' },
      makeAuth()
    );

    expect(result.statusCode).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'Failed to reject KYC submission',
      500,
      expect.anything(),
      expect.anything()
    );
  });
});
