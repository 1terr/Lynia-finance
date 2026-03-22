/**
 * Tests for Customer Admin Handlers
 *
 * Covers authorization, pagination, filtering, PII handling,
 * customer updates, status changes, and audit logging.
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
  handleGetCustomers,
  handleGetCustomerById,
  handleUpdateCustomerStatus,
  handleGetCustomerLoans,
  handleGetCustomerPayments,
  handleGetCustomerCreditScore,
  handleGetCreditScoreHistory,
  handleUpdateCustomer,
  handleAddCustomerNote,
} from '../customers';

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

function makeCustomer(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'cust-001',
    first_name: 'Tatenda',
    last_name: 'Moyo',
    full_name: 'Tatenda Moyo',
    phone_number: '+263771234567',
    email: 'tatenda@example.com',
    national_id: '12-345678-A-90',
    kyc_status: 'verified',
    status: 'active',
    credit_score: 450,
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

// ─── Tests ───

describe('handleGetCustomers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetCustomers(makeEvent(), {}, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
    expect(mockErrorResponse).toHaveBeenCalledWith('Forbidden', 403, expect.anything(), expect.anything());
  });

  it('returns paginated customer list with defaults', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '35' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [makeCustomer()], error: null });

    const result = await handleGetCustomers(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.total).toBe(35);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(25);
    expect(body.data.total_pages).toBe(2);
  });

  it('applies status and kyc_status filters', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '3' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    await handleGetCustomers(
      makeEvent({ queryStringParameters: { status: 'active', kyc_status: 'verified' } }),
      {},
      makeAuth()
    );

    // Count query should include both conditions
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('c.status = $1'),
      expect.arrayContaining(['active', 'verified'])
    );
  });

  it('maps kyc_status "submitted" to "in_review"', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '0' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    await handleGetCustomers(
      makeEvent({ queryStringParameters: { kyc_status: 'submitted' } }),
      {},
      makeAuth()
    );

    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('c.kyc_status'),
      expect.arrayContaining(['in_review'])
    );
  });

  it('applies search filter across name, phone, and national ID', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [makeCustomer()], error: null });

    await handleGetCustomers(
      makeEvent({ queryStringParameters: { search: 'Tatenda' } }),
      {},
      makeAuth()
    );

    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.arrayContaining(['%Tatenda%'])
    );
  });

  it('returns 500 when query fails', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '1' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await handleGetCustomers(makeEvent(), {}, makeAuth());

    expect(result.statusCode).toBe(500);
    expect(mockErrorResponse).toHaveBeenCalledWith('Failed to fetch customers', 500, expect.anything(), expect.anything());
  });

  it('respects custom page and limit parameters', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { count: '200' }, error: null });
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await handleGetCustomers(
      makeEvent({ queryStringParameters: { page: '3', limit: '50' } }),
      {},
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.page).toBe(3);
    expect(body.data.limit).toBe(50);
    expect(body.data.total_pages).toBe(4);
  });
});

describe('handleGetCustomerById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetCustomerById(makeEvent(), { id: 'cust-001' }, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns 404 when customer is not found', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleGetCustomerById(makeEvent(), { id: 'nonexistent' }, makeAuth());

    expect(result.statusCode).toBe(404);
    expect(mockNotFoundResponse).toHaveBeenCalledWith('Customer', expect.anything());
  });

  it('returns customer detail with credit score', async () => {
    const customer = makeCustomer({ credit_score: 520 });
    mockQueryOne.mockResolvedValueOnce({ data: customer, error: null });

    const result = await handleGetCustomerById(makeEvent(), { id: 'cust-001' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(customer, 200, expect.anything());
  });
});

describe('handleUpdateCustomerStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleUpdateCustomerStatus(
      makeEvent({ body: { status: 'active' } }),
      { id: 'cust-001' },
      makeAuth('viewer')
    );

    expect(result.statusCode).toBe(403);
  });

  it('returns 400 for invalid status value', async () => {
    const result = await handleUpdateCustomerStatus(
      makeEvent({ body: { status: 'deleted' } }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      expect.stringContaining('Invalid status'),
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('returns 400 when status is missing', async () => {
    const result = await handleUpdateCustomerStatus(
      makeEvent({ body: {} }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when customer is not found', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await handleUpdateCustomerStatus(
      makeEvent({ body: { status: 'blocked' } }),
      { id: 'nonexistent' },
      makeAuth()
    );

    expect(result.statusCode).toBe(404);
    expect(mockNotFoundResponse).toHaveBeenCalledWith('Customer', expect.anything());
  });

  it('updates status and creates audit log', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'cust-001' }], error: null });

    const result = await handleUpdateCustomerStatus(
      makeEvent({ body: { status: 'blocked' } }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'customer.status.update',
      'customer',
      'cust-001',
      'Customer status changed to blocked',
      expect.objectContaining({ status: 'blocked' })
    );
  });

  it('accepts all valid status values: active, inactive, blocked', async () => {
    for (const status of ['active', 'inactive', 'blocked']) {
      jest.clearAllMocks();
      mockIsAdminOrManager.mockReturnValue(true);
      mockQuery.mockResolvedValueOnce({ data: [{ id: 'cust-001' }], error: null });

      const result = await handleUpdateCustomerStatus(
        makeEvent({ body: { status } }),
        { id: 'cust-001' },
        makeAuth()
      );

      expect(result.statusCode).toBe(200);
    }
  });
});

describe('handleUpdateCustomer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleUpdateCustomer(
      makeEvent({ body: { first_name: 'New' } }),
      { id: 'cust-001' },
      makeAuth('viewer')
    );

    expect(result.statusCode).toBe(403);
  });

  it('returns 400 when no valid fields are provided', async () => {
    const result = await handleUpdateCustomer(
      makeEvent({ body: {} }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'No valid fields to update',
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('strips disallowed fields (id, credit_score, kyc_status, status)', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'cust-001' }], error: null });

    const result = await handleUpdateCustomer(
      makeEvent({
        body: {
          id: 'hacked-id',
          credit_score: 999,
          kyc_status: 'verified',
          status: 'active',
          first_name: 'Tatenda',
        },
      }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    // Verify the UPDATE query only includes first_name, not disallowed fields
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('first_name = $1'),
      expect.any(Array)
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.not.stringContaining('credit_score'),
      expect.any(Array)
    );
  });

  it('returns 404 when customer is not found', async () => {
    mockQuery.mockResolvedValueOnce({ data: [], error: null });

    const result = await handleUpdateCustomer(
      makeEvent({ body: { first_name: 'New' } }),
      { id: 'nonexistent' },
      makeAuth()
    );

    expect(result.statusCode).toBe(404);
  });

  it('updates customer and creates audit log with changed fields', async () => {
    mockQuery.mockResolvedValueOnce({ data: [{ id: 'cust-001' }], error: null });

    const result = await handleUpdateCustomer(
      makeEvent({
        body: { first_name: 'Tendai', email: 'tendai@example.com' },
      }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      { message: 'Customer updated successfully' },
      200,
      expect.anything()
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      'customer.update',
      'customer',
      'cust-001',
      'Customer profile updated',
      expect.objectContaining({ first_name: 'Tendai', email: 'tendai@example.com' })
    );
  });
});

describe('handleGetCustomerLoans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetCustomerLoans(makeEvent(), { id: 'cust-001' }, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns loans for a customer', async () => {
    const loans = [
      { id: 'loan-1', status: 'active', loan_amount_usd: 300 },
      { id: 'loan-2', status: 'completed', loan_amount_usd: 200 },
    ];
    mockQuery.mockResolvedValueOnce({ data: loans, error: null });

    const result = await handleGetCustomerLoans(makeEvent(), { id: 'cust-001' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(loans, 200, expect.anything());
  });

  it('returns 500 when query fails', async () => {
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await handleGetCustomerLoans(makeEvent(), { id: 'cust-001' }, makeAuth());

    expect(result.statusCode).toBe(500);
  });
});

describe('handleGetCustomerCreditScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleGetCustomerCreditScore(makeEvent(), { id: 'cust-001' }, makeAuth('viewer'));

    expect(result.statusCode).toBe(403);
  });

  it('returns null when no credit score exists', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: null, error: null });

    const result = await handleGetCustomerCreditScore(makeEvent(), { id: 'cust-001' }, makeAuth());

    expect(result.statusCode).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith(null, 200, expect.anything());
  });

  it('parses JSON components if stored as string', async () => {
    const scoreData = {
      id: 'score-1',
      scaled_score: 450,
      components: '{"identity":80,"repayment":70}',
    };
    mockQueryOne.mockResolvedValueOnce({ data: { ...scoreData }, error: null });

    const result = await handleGetCustomerCreditScore(makeEvent(), { id: 'cust-001' }, makeAuth());

    expect(result.statusCode).toBe(200);
    // The handler parses JSON string components
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        components: { identity: 80, repayment: 70 },
      }),
      200,
      expect.anything()
    );
  });
});

describe('handleAddCustomerNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdminOrManager.mockReturnValue(true);
  });

  it('returns 403 when caller is not admin or manager', async () => {
    mockIsAdminOrManager.mockReturnValue(false);

    const result = await handleAddCustomerNote(
      makeEvent({ body: { note_text: 'Test note' } }),
      { id: 'cust-001' },
      makeAuth('viewer')
    );

    expect(result.statusCode).toBe(403);
  });

  it('returns 400 when note_text is missing', async () => {
    const result = await handleAddCustomerNote(
      makeEvent({ body: {} }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(400);
    expect(mockErrorResponse).toHaveBeenCalledWith(
      'note_text is required',
      400,
      expect.anything(),
      expect.anything()
    );
  });

  it('creates a note and returns 201 with note data', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'note-001' }, error: null });

    const result = await handleAddCustomerNote(
      makeEvent({ body: { note_text: 'Customer called about loan status', note_type: 'call' } }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(result.statusCode).toBe(201);
    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'note-001',
        customer_id: 'cust-001',
        note_type: 'call',
        note_text: 'Customer called about loan status',
        created_by: 'admin-001',
      }),
      201,
      expect.anything()
    );
  });

  it('defaults note_type to "general" when not provided', async () => {
    mockQueryOne.mockResolvedValueOnce({ data: { id: 'note-002' }, error: null });

    await handleAddCustomerNote(
      makeEvent({ body: { note_text: 'General observation' } }),
      { id: 'cust-001' },
      makeAuth()
    );

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({ note_type: 'general' }),
      201,
      expect.anything()
    );
  });
});
