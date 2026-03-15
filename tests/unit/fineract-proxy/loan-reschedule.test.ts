/**
 * Fineract Proxy Service — Loan Reschedule Tests
 *
 * Tests for the handleLoanReschedule handler.
 *
 * Test matrix (8 tests):
 *   - Successful reschedule returns 200 with resourceId
 *   - 400 when rescheduleFromDate missing
 *   - 400 when rescheduleReasonCodeValueId missing
 *   - 404 loan not found in Lynia DB
 *   - 400 loan not synced to Fineract (no fineract_loan_id)
 *   - 502 on FineractApiError
 *   - 500 on generic error (no stack trace leaked)
 *   - Updates loan status to 'restructured' in Lynia DB
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

const mockFineractClient: Record<string, any> = {
  restructureLoan: jest.fn(),
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

// Import handler after mocks
import { handleLoanReschedule } from '../../../services/fineract-proxy-service/src/handlers/loan-actions';
import { db } from '../../../services/shared/clients/database';

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
// handleLoanReschedule
// ============================================================

describe('handleLoanReschedule', () => {
  beforeEach(resetMocks);

  it('should reschedule a loan successfully', async () => {
    mockFineractClient.restructureLoan.mockResolvedValue({ resourceId: 99, loanId: 42 });

    const event = makeEvent({
      body: JSON.stringify({
        rescheduleFromDate: '15 March 2026',
        rescheduleReasonCodeValueId: 1,
        extraTerms: 3,
        rescheduleReasonComment: 'Customer hardship',
      }),
    });

    const result = await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.resourceId).toBe(99);

    expect(mockFineractClient.restructureLoan).toHaveBeenCalledWith(
      MOCK_FINERACT_LOAN_ID,
      expect.objectContaining({
        rescheduleFromDate: '15 March 2026',
        rescheduleReasonCodeValueId: 1,
        extraTerms: 3,
        rescheduleReasonComment: 'Customer hardship',
      })
    );
  });

  it('should return 400 when rescheduleFromDate is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({ rescheduleReasonCodeValueId: 1 }),
    });

    const result = await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/rescheduleFromDate/i);
  });

  it('should return 400 when rescheduleReasonCodeValueId is missing', async () => {
    const event = makeEvent({
      body: JSON.stringify({ rescheduleFromDate: '15 March 2026' }),
    });

    const result = await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/rescheduleReasonCodeValueId/i);
  });

  it('should return 404 when loan not found in Lynia DB', async () => {
    mockExecute.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const event = makeEvent({
      body: JSON.stringify({
        rescheduleFromDate: '15 March 2026',
        rescheduleReasonCodeValueId: 1,
      }),
    });

    const result = await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(404);
  });

  it('should return 400 when loan not synced to Fineract', async () => {
    mockExecute.mockResolvedValue({
      data: { id: MOCK_LOAN_ID, fineract_loan_id: null },
      error: null,
    });

    const event = makeEvent({
      body: JSON.stringify({
        rescheduleFromDate: '15 March 2026',
        rescheduleReasonCodeValueId: 1,
      }),
    });

    const result = await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/synced/i);
  });

  it('should return 502 on FineractApiError', async () => {
    mockFineractClient.restructureLoan.mockRejectedValue(
      new MockFineractApiError('Cannot reschedule', 403, {
        defaultUserMessage: 'Loan is not in active state for rescheduling',
      })
    );

    const event = makeEvent({
      body: JSON.stringify({
        rescheduleFromDate: '15 March 2026',
        rescheduleReasonCodeValueId: 1,
      }),
    });

    const result = await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/active state/i);
  });

  it('should return 500 with generic message on unexpected error', async () => {
    mockFineractClient.restructureLoan.mockRejectedValue(new Error('ECONNREFUSED'));

    const event = makeEvent({
      body: JSON.stringify({
        rescheduleFromDate: '15 March 2026',
        rescheduleReasonCodeValueId: 1,
      }),
    });

    const result = await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).not.toMatch(/ECONNREFUSED/);
    expect(body.error).toMatch(/unexpected error/i);
  });

  it('should update loan status to restructured in Lynia DB', async () => {
    mockFineractClient.restructureLoan.mockResolvedValue({ resourceId: 99, loanId: 42 });

    const event = makeEvent({
      body: JSON.stringify({
        rescheduleFromDate: '15 March 2026',
        rescheduleReasonCodeValueId: 1,
      }),
    });

    await handleLoanReschedule(event, { loanId: MOCK_LOAN_ID }, {} as any);

    expect(db.from).toHaveBeenCalledWith('loans');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'restructured' });
    expect(mockEq).toHaveBeenCalledWith('id', MOCK_LOAN_ID);
  });
});
