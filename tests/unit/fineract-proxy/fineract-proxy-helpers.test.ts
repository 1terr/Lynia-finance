/**
 * Fineract Proxy Service — Helper Unit Tests
 *
 * Tests for the pure utility functions extracted into helpers.ts:
 *   - fmtDate()     — Fineract date array to ISO date string
 *   - clampPage()   — pagination parameter clamping
 *   - getAgingBucket() — aging bucket classification
 *   - ok()          — success response wrapper
 *   - err()         — error response wrapper
 */

import { describe, it, expect, jest } from '@jest/globals';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock fineract client (parseFineractDate)
jest.mock('../../../services/shared/clients/fineract', () => ({
  getFineractClient: jest.fn(),
  parseFineractDate: jest.fn((date: number[]) => new Date(date[0], date[1] - 1, date[2])),
}));

// Mock secrets (transitive dependency)
jest.mock('../../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn(() => Promise.resolve({})),
}));

import { fmtDate, clampPage, getAgingBucket, ok, err, MAX_PAGE_SIZE } from '../../../services/fineract-proxy-service/src/handlers/helpers';

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
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    ...overrides,
  };
}

// ============================================================
// fmtDate()
// ============================================================

describe('fmtDate()', () => {
  it('should return null for null input', () => {
    expect(fmtDate(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(fmtDate(undefined)).toBeNull();
  });

  it('should return null for an empty array', () => {
    expect(fmtDate([] as unknown as [number, number, number])).toBeNull();
  });

  it('should format a valid Fineract date array to ISO date string', () => {
    const result = fmtDate([2024, 1, 15]);
    // parseFineractDate mock uses local timezone, so UTC conversion may shift by 1 day
    expect(result).toMatch(/^2024-01-1[45]$/);
  });

  it('should format single-digit months and days with zero padding', () => {
    const result = fmtDate([2026, 3, 5]);
    expect(result).toMatch(/^2026-03-0[45]$/); // timezone may shift by 1
  });
});

// ============================================================
// clampPage()
// ============================================================

describe('clampPage()', () => {
  it('should return fallback for NaN input', () => {
    expect(clampPage('abc', 25, 100)).toBe(25);
  });

  it('should return fallback for undefined input', () => {
    expect(clampPage(undefined, 25, 100)).toBe(25);
  });

  it('should return 1 when value is negative (uses fallback)', () => {
    expect(clampPage('-5', 1, 100)).toBe(1);
  });

  it('should clamp to max when value exceeds max', () => {
    expect(clampPage('200', 25, 100)).toBe(100);
  });

  it('should pass through valid values within range', () => {
    expect(clampPage('50', 25, 100)).toBe(50);
  });

  it('should accept value of 1 (minimum positive)', () => {
    expect(clampPage('1', 25, 100)).toBe(1);
  });
});

// ============================================================
// getAgingBucket()
// ============================================================

describe('getAgingBucket()', () => {
  it('should return "1-30" for 0 days past due', () => {
    expect(getAgingBucket(0)).toBe('1-30');
  });

  it('should return "1-30" for 30 days past due', () => {
    expect(getAgingBucket(30)).toBe('1-30');
  });

  it('should return "31-60" for 31 days past due', () => {
    expect(getAgingBucket(31)).toBe('31-60');
  });

  it('should return "61-90" for 61 days past due', () => {
    expect(getAgingBucket(61)).toBe('61-90');
  });

  it('should return "90+" for 91 days past due', () => {
    expect(getAgingBucket(91)).toBe('90+');
  });
});

// ============================================================
// ok()
// ============================================================

describe('ok()', () => {
  it('should return 200 with JSON-stringified body', () => {
    const event = makeEvent();
    const result = ok({ hello: 'world' }, event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ hello: 'world' });
  });

  it('should include security headers', () => {
    const event = makeEvent();
    const result = ok({}, event);
    expect(result.headers!['X-Content-Type-Options']).toBe('nosniff');
    expect(result.headers!['X-Frame-Options']).toBe('DENY');
    expect(result.headers!['Content-Type']).toBe('application/json');
  });
});

// ============================================================
// err()
// ============================================================

describe('err()', () => {
  it('should return specified status code', () => {
    const event = makeEvent();
    const result = err(404, 'Not Found', event);
    expect(result.statusCode).toBe(404);
  });

  it('should include error message in JSON body', () => {
    const event = makeEvent();
    const result = err(500, 'Internal error', event);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Internal error');
  });

  it('should include security headers', () => {
    const event = makeEvent();
    const result = err(400, 'Bad request', event);
    expect(result.headers!['X-Content-Type-Options']).toBe('nosniff');
  });
});

// ============================================================
// MAX_PAGE_SIZE
// ============================================================

describe('MAX_PAGE_SIZE', () => {
  it('should be 100', () => {
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});
