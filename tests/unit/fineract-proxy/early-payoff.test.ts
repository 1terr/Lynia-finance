/**
 * Fineract Proxy Service — Early Payoff Tests
 *
 * Tests for the handleEarlyPayoff handler.
 *
 * Test matrix (8 tests):
 *   - Successful early payoff returns 200 with amountPaid
 *   - 400 when loan has zero outstanding balance
 *   - 404 loan not found in Lynia DB
 *   - 400 loan not synced to Fineract
 *   - 502 on FineractApiError during calculateEarlyPayoff
 *   - 502 on FineractApiError during processEarlyPayoff
 *   - 500 on generic error
 *   - Updates Lynia DB status to 'closed' and outstanding_balance to 0
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
  calculateEarlyPayoff: jest.fn(),
  processEarlyPayoff: jest.fn(),
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
import { handleEarlyPayoff } from '../../../services/fineract-proxy-service/src/handlers/loan-actions';
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
// handleEarlyPayoff
// ============================================================

describe('handleEarlyPayoff', () => {
  beforeEach(resetMocks);

  it('should process early payoff successfully and return amountPaid', async () => {
    mockFineractClient.calculateEarlyPayoff.mockResolvedValue({
      summary: { totalOutstanding: 250.50 },
    });
    mockFineractClient.processEarlyPayoff.mockResolvedValue({ resourceId: 101, loanId: 42 });

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.amountPaid).toBe(250.50);
    expect(body.resourceId).toBe(101);

    expect(mockFineractClient.calculateEarlyPayoff).toHaveBeenCalledWith(MOCK_FINERACT_LOAN_ID);
    expect(mockFineractClient.processEarlyPayoff).toHaveBeenCalledWith(
      expect.objectContaining({
        loanId: MOCK_FINERACT_LOAN_ID,
        amount: 250.50,
      })
    );
  });

  it('should return 400 when loan has zero outstanding balance', async () => {
    mockFineractClient.calculateEarlyPayoff.mockResolvedValue({
      summary: { totalOutstanding: 0 },
    });

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/no outstanding balance/i);

    // Should NOT have called processEarlyPayoff
    expect(mockFineractClient.processEarlyPayoff).not.toHaveBeenCalled();
  });

  it('should return 404 when loan not found in Lynia DB', async () => {
    mockExecute.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(404);
  });

  it('should return 400 when loan not synced to Fineract', async () => {
    mockExecute.mockResolvedValue({
      data: { id: MOCK_LOAN_ID, fineract_loan_id: null },
      error: null,
    });

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/synced/i);
  });

  it('should return 502 on FineractApiError during calculateEarlyPayoff', async () => {
    mockFineractClient.calculateEarlyPayoff.mockRejectedValue(
      new MockFineractApiError('Loan not found', 404, {
        defaultUserMessage: 'Loan with identifier 42 does not exist',
      })
    );

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/does not exist/i);
  });

  it('should return 502 on FineractApiError during processEarlyPayoff', async () => {
    mockFineractClient.calculateEarlyPayoff.mockResolvedValue({
      summary: { totalOutstanding: 500 },
    });
    mockFineractClient.processEarlyPayoff.mockRejectedValue(
      new MockFineractApiError('Transaction failed', 400, {
        defaultUserMessage: 'Repayment transaction is not allowed for closed loan',
      })
    );

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/not allowed/i);
  });

  it('should return 500 with generic message on unexpected error', async () => {
    mockFineractClient.calculateEarlyPayoff.mockRejectedValue(new Error('ETIMEDOUT'));

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    const result = await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.error).not.toMatch(/ETIMEDOUT/);
    expect(body.error).toMatch(/unexpected error/i);
  });

  it('should update Lynia DB status to closed and outstanding_balance to 0', async () => {
    mockFineractClient.calculateEarlyPayoff.mockResolvedValue({
      summary: { totalOutstanding: 100 },
    });
    mockFineractClient.processEarlyPayoff.mockResolvedValue({ resourceId: 101, loanId: 42 });

    const event = makeEvent({
      body: JSON.stringify({}),
    });

    await handleEarlyPayoff(event, { loanId: MOCK_LOAN_ID }, {} as any);

    expect(db.from).toHaveBeenCalledWith('loans');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'closed', outstanding_balance_usd: 0 });
    expect(mockEq).toHaveBeenCalledWith('id', MOCK_LOAN_ID);
  });
});
