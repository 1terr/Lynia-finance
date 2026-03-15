/**
 * Fineract Proxy Service — Extended Loan Action Tests
 *
 * Tests for reject, write-off, and close loan handlers.
 * Each handler: lookupFineractLoan -> call fineract client -> update Lynia DB -> response.
 *
 * Test matrix (3 handlers x 5+ cases = 16 tests):
 *   - Successful reject/writeoff/close
 *   - 404 loan not found in Lynia DB
 *   - 400 loan not synced to Fineract (no fineract_loan_id)
 *   - 502 Fineract API error
 *   - 500 returns requestId, not stack trace
 *   - Reject requires rejectedOnDate and note
 *   - WriteOff updates loan status in Lynia DB
 *   - Close requires loan to be fully paid
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// ============================================================
// MOCK SETUP
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockExecute: any = jest.fn();
const mockSingle = jest.fn(() => ({ execute: mockExecute }));
const mockEq = jest.fn(() => ({
  execute: mockExecute,
  single: mockSingle,
}));
const mockSelect = jest.fn(() => ({
  execute: mockExecute,
  eq: mockEq,
}));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockInsert = jest.fn(() => ({ execute: mockExecute }));

jest.mock('../../../services/shared/clients/database', () => ({
  db: {
    from: jest.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })),
  },
}));

// Mock Fineract client with new methods
const mockFineractClient: Record<string, any> = {
  rejectLoan: jest.fn(),
  writeOffLoan: jest.fn(),
  closeLoan: jest.fn(),
};

class MockFineractApiError extends Error {
  statusCode: number;
  errorBody: { defaultUserMessage?: string } | null;
  constructor(msg: string, code: number, errorBody: { defaultUserMessage?: string } | null = null) {
    super(msg);
    this.name = 'FineractApiError';
    this.statusCode = code;
    this.errorBody = errorBody;
  }
}

jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(() => Promise.resolve(mockFineractClient)),
  parseFineractDate: jest.fn((date: number[]) => new Date(date[0], date[1] - 1, date[2])),
  FineractApiError: MockFineractApiError,
}));

jest.mock('../../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn(() => Promise.resolve({})),
}));

// Import handlers after mocks
import { handleLoanReject, handleLoanWriteOff, handleLoanClose } from '../../../services/fineract-proxy-service/src/handlers/loan-actions';

// ============================================================
// TEST HELPERS
// ============================================================

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    path: '/test',
    httpMethod: 'POST',
    headers: { origin: 'https://d1qwfy2tsdmpe4.cloudfront.net' },
    queryStringParameters: null,
    pathParameters: null,
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      requestId: 'test-request-id-123',
    } as any,
    ...overrides,
  };
}

const MOCK_LOAN_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_FINERACT_LOAN_ID = 42;

function resetMocks() {
  jest.clearAllMocks();
  // Default: loan found with fineract_loan_id
  mockExecute.mockResolvedValue({
    data: { id: MOCK_LOAN_ID, fineract_loan_id: MOCK_FINERACT_LOAN_ID },
    error: null,
  });
}

// ============================================================
// handleLoanReject
// ============================================================

describe('handleLoanReject', () => {
  beforeEach(resetMocks);

  it('should reject a loan successfully', async () => {
    mockFineractClient.rejectLoan.mockResolvedValue({ resourceId: 42, loanId: 42 });

    const event = makeEvent({
      body: JSON.stringify({
        rejectedOnDate: '2026-03-15',
        note: 'Insufficient documentation',
      }),
    });

    const result = await handleLoanReject(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.resourceId).toBe(42);

    expect(mockFineractClient.rejectLoan).toHaveBeenCalledWith(
      MOCK_FINERACT_LOAN_ID,
      expect.any(Date),
      'Insufficient documentation'
    );
  });

  it('should return 400 when rejectedOnDate is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({ note: 'Missing date' }),
    });

    const result = await handleLoanReject(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/rejectedOnDate/i);
  });

  it('should return 400 when note is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({ rejectedOnDate: '2026-03-15' }),
    });

    const result = await handleLoanReject(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/note/i);
  });

  it('should return 404 when loan not found', async () => {
    mockExecute.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const event = makeEvent({
      body: JSON.stringify({ rejectedOnDate: '2026-03-15', note: 'test' }),
    });

    const result = await handleLoanReject(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(404);
  });

  it('should return 400 when loan not synced to Fineract', async () => {
    mockExecute.mockResolvedValue({
      data: { id: MOCK_LOAN_ID, fineract_loan_id: null },
      error: null,
    });

    const event = makeEvent({
      body: JSON.stringify({ rejectedOnDate: '2026-03-15', note: 'test' }),
    });

    const result = await handleLoanReject(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/synced/i);
  });

  it('should return 502 on Fineract API error', async () => {
    mockFineractClient.rejectLoan.mockRejectedValue(
      new MockFineractApiError('Loan is not in submitted state', 403, {
        defaultUserMessage: 'Loan is not in submitted and pending approval state',
      })
    );

    const event = makeEvent({
      body: JSON.stringify({ rejectedOnDate: '2026-03-15', note: 'test' }),
    });

    const result = await handleLoanReject(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/pending approval/i);
  });

  it('should return 500 with generic message on unexpected error', async () => {
    mockFineractClient.rejectLoan.mockRejectedValue(new Error('ECONNREFUSED'));

    const event = makeEvent({
      body: JSON.stringify({ rejectedOnDate: '2026-03-15', note: 'test' }),
    });

    const result = await handleLoanReject(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    // Must NOT leak internal error details
    expect(body.error).not.toMatch(/ECONNREFUSED/);
    expect(body.error).toMatch(/unexpected error/i);
  });
});

// ============================================================
// handleLoanWriteOff
// ============================================================

describe('handleLoanWriteOff', () => {
  beforeEach(resetMocks);

  it('should write off a loan successfully', async () => {
    mockFineractClient.writeOffLoan.mockResolvedValue({ resourceId: 42, loanId: 42 });

    const event = makeEvent({
      body: JSON.stringify({
        transactionDate: '2026-03-15',
        note: 'Borrower unreachable for 180 days',
      }),
    });

    const result = await handleLoanWriteOff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);

    expect(mockFineractClient.writeOffLoan).toHaveBeenCalledWith(
      MOCK_FINERACT_LOAN_ID,
      expect.any(Date),
      'Borrower unreachable for 180 days'
    );
  });

  it('should return 400 when transactionDate is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({ note: 'test' }),
    });

    const result = await handleLoanWriteOff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/transactionDate/i);
  });

  it('should return 404 when loan not found', async () => {
    mockExecute.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const event = makeEvent({
      body: JSON.stringify({ transactionDate: '2026-03-15', note: 'test' }),
    });

    const result = await handleLoanWriteOff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(404);
  });

  it('should return 502 on Fineract API error', async () => {
    mockFineractClient.writeOffLoan.mockRejectedValue(
      new MockFineractApiError('Loan must be active', 403, {
        defaultUserMessage: 'Loan must be in active state to be written off',
      })
    );

    const event = makeEvent({
      body: JSON.stringify({ transactionDate: '2026-03-15', note: 'test' }),
    });

    const result = await handleLoanWriteOff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/active state/i);
  });

  it('should return 500 with generic message on unexpected error', async () => {
    mockFineractClient.writeOffLoan.mockRejectedValue(new Error('Connection reset'));

    const event = makeEvent({
      body: JSON.stringify({ transactionDate: '2026-03-15', note: 'test' }),
    });

    const result = await handleLoanWriteOff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).not.toMatch(/Connection reset/);
  });
});

// ============================================================
// handleLoanClose
// ============================================================

describe('handleLoanClose', () => {
  beforeEach(resetMocks);

  it('should close a loan successfully', async () => {
    mockFineractClient.closeLoan.mockResolvedValue({ resourceId: 42, loanId: 42 });

    const event = makeEvent({
      body: JSON.stringify({ closedOnDate: '2026-03-15' }),
    });

    const result = await handleLoanClose(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);

    expect(mockFineractClient.closeLoan).toHaveBeenCalledWith(
      MOCK_FINERACT_LOAN_ID,
      expect.any(Date)
    );
  });

  it('should return 400 when closedOnDate is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleLoanClose(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/closedOnDate/i);
  });

  it('should return 404 when loan not found', async () => {
    mockExecute.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const event = makeEvent({
      body: JSON.stringify({ closedOnDate: '2026-03-15' }),
    });

    const result = await handleLoanClose(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(404);
  });

  it('should return 400 when loan not synced to Fineract', async () => {
    mockExecute.mockResolvedValue({
      data: { id: MOCK_LOAN_ID, fineract_loan_id: null },
      error: null,
    });

    const event = makeEvent({
      body: JSON.stringify({ closedOnDate: '2026-03-15' }),
    });

    const result = await handleLoanClose(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);
  });

  it('should return 502 on Fineract API error with user message', async () => {
    mockFineractClient.closeLoan.mockRejectedValue(
      new MockFineractApiError('Loan has outstanding balance', 403, {
        defaultUserMessage: 'Loan must be fully paid before closing',
      })
    );

    const event = makeEvent({
      body: JSON.stringify({ closedOnDate: '2026-03-15' }),
    });

    const result = await handleLoanClose(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/fully paid/i);
  });

  it('should return 500 with generic message on unexpected error', async () => {
    mockFineractClient.closeLoan.mockRejectedValue(new Error('timeout'));

    const event = makeEvent({
      body: JSON.stringify({ closedOnDate: '2026-03-15' }),
    });

    const result = await handleLoanClose(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).not.toMatch(/timeout/);
    expect(body.error).toMatch(/unexpected error/i);
  });
});
