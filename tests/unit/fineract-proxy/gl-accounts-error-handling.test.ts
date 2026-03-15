/**
 * GL Accounts Error Handling Tests
 *
 * Verifies that handleGetGLAccounts, handleGetJournalEntries, and
 * handleGetTrialBalance correctly return:
 *   - 502 with user-friendly message on FineractApiError
 *   - 500 with generic message on unexpected Error
 *   - No stack traces leak in error responses
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// ============================================================
// MOCK SETUP
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

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

const mockFineractClient: Record<string, any> = {
  listGLAccounts: jest.fn(),
  listJournalEntries: jest.fn(),
};

jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(() => Promise.resolve(mockFineractClient)),
  parseFineractDate: jest.fn((date: number[]) => new Date(date[0], date[1] - 1, date[2])),
  FineractApiError: MockFineractApiError,
}));

jest.mock('../../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn(() => Promise.resolve({})),
}));

// Import handlers after mocks
import {
  handleGetGLAccounts,
  handleGetJournalEntries,
  handleGetTrialBalance,
} from '../../../services/fineract-proxy-service/src/handlers/gl-accounts';

// ============================================================
// TEST HELPERS
// ============================================================

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    path: '/test',
    httpMethod: 'GET',
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
      requestId: 'test-request-id-gl',
    } as any,
    ...overrides,
  };
}

const EMPTY_AUTH: any = { userId: 'test-user', roles: ['admin'] };
const EMPTY_PARAMS: any = {};

// ============================================================
// handleGetGLAccounts — error handling
// ============================================================

describe('handleGetGLAccounts error handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 502 with user-friendly message when FineractApiError is thrown', async () => {
    mockFineractClient.listGLAccounts.mockRejectedValue(
      new MockFineractApiError('Fineract error', 500, {
        defaultUserMessage: 'GL account service is temporarily unavailable',
      })
    );

    const result = await handleGetGLAccounts(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('GL account service is temporarily unavailable');
  });

  it('should return 500 with generic message when a generic Error is thrown', async () => {
    mockFineractClient.listGLAccounts.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await handleGetGLAccounts(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unexpected error/i);
    // Must NOT leak internal error details
    expect(body.error).not.toMatch(/ECONNREFUSED/);
  });

  it('should not leak stack traces in error responses', async () => {
    const err = new Error('Internal DB connection pool exhausted');
    err.stack = 'Error: Internal DB connection pool exhausted\n    at Object.<anonymous> (/var/task/index.js:42:15)';
    mockFineractClient.listGLAccounts.mockRejectedValue(err);

    const result = await handleGetGLAccounts(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    const bodyStr = result.body;

    expect(bodyStr).not.toContain('at Object');
    expect(bodyStr).not.toContain('/var/task');
    expect(bodyStr).not.toContain('pool exhausted');
  });
});

// ============================================================
// handleGetJournalEntries — error handling
// ============================================================

describe('handleGetJournalEntries error handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 502 with user-friendly message when FineractApiError is thrown', async () => {
    mockFineractClient.listJournalEntries.mockRejectedValue(
      new MockFineractApiError('Fineract error', 404, {
        defaultUserMessage: 'Journal entries not found for the given criteria',
      })
    );

    const result = await handleGetJournalEntries(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Journal entries not found for the given criteria');
  });

  it('should return 500 with generic message when a generic Error is thrown', async () => {
    mockFineractClient.listJournalEntries.mockRejectedValue(new Error('Timeout waiting for response'));

    const result = await handleGetJournalEntries(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unexpected error/i);
    expect(body.error).not.toMatch(/Timeout/);
  });

  it('should not leak stack traces in error responses', async () => {
    const err = new Error('Secret query failed');
    err.stack = 'Error: Secret query failed\n    at SecretManager.getSecret (/opt/nodejs/secrets.js:10:5)';
    mockFineractClient.listJournalEntries.mockRejectedValue(err);

    const result = await handleGetJournalEntries(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    const bodyStr = result.body;

    expect(bodyStr).not.toContain('SecretManager');
    expect(bodyStr).not.toContain('/opt/nodejs');
    expect(bodyStr).not.toContain('Secret query failed');
  });
});

// ============================================================
// handleGetTrialBalance — error handling
// ============================================================

describe('handleGetTrialBalance error handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 502 with user-friendly message when FineractApiError is thrown', async () => {
    mockFineractClient.listGLAccounts.mockRejectedValue(
      new MockFineractApiError('Fineract error', 503, {
        defaultUserMessage: 'Core banking system is under maintenance',
      })
    );

    const result = await handleGetTrialBalance(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Core banking system is under maintenance');
  });

  it('should return 500 with generic message when a generic Error is thrown', async () => {
    mockFineractClient.listGLAccounts.mockRejectedValue(new Error('Cannot read properties of null'));

    const result = await handleGetTrialBalance(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/unexpected error/i);
    expect(body.error).not.toMatch(/Cannot read properties/);
  });

  it('should not leak stack traces in error responses', async () => {
    const err = new Error('RDS proxy connection limit reached');
    err.stack = 'Error: RDS proxy connection limit reached\n    at Pool.connect (/var/task/node_modules/pg/pool.js:55:11)';
    mockFineractClient.listGLAccounts.mockRejectedValue(err);

    const result = await handleGetTrialBalance(makeEvent(), EMPTY_PARAMS, EMPTY_AUTH);
    const bodyStr = result.body;

    expect(bodyStr).not.toContain('Pool.connect');
    expect(bodyStr).not.toContain('node_modules');
    expect(bodyStr).not.toContain('connection limit');
  });
});
