/**
 * Characterization tests for services/shared/utils/response.ts
 *
 * Every API response flows through these helpers. Tests verify correct
 * HTTP status codes, body envelope format, and security headers.
 */

import {
  getCorsOrigin,
  getSecurityHeaders,
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  parseBody,
} from '../../../services/shared/utils/response';
import { createAPIGatewayEvent } from '../../helpers/test-utils';

describe('response utilities', () => {
  // ─── getCorsOrigin ────────────────────────────────────────────
  describe('getCorsOrigin', () => {
    it('should return request origin when whitelisted', () => {
      const event = createAPIGatewayEvent({
        headers: { origin: 'https://admin.lyniafinance.com' },
      });
      expect(getCorsOrigin(event)).toBe('https://admin.lyniafinance.com');
    });

    it('should return primary domain for non-whitelisted origin', () => {
      const event = createAPIGatewayEvent({
        headers: { origin: 'https://evil.com' },
      });
      expect(getCorsOrigin(event)).toBe('https://lyniafinance.com');
    });

    it('should return primary domain when no origin header', () => {
      const event = createAPIGatewayEvent({ headers: {} });
      expect(getCorsOrigin(event)).toBe('https://lyniafinance.com');
    });

    it('should accept localhost in non-production', () => {
      const event = createAPIGatewayEvent({
        headers: { origin: 'http://localhost:3000' },
      });
      // In test env (not production), localhost should be whitelisted
      expect(getCorsOrigin(event)).toBe('http://localhost:3000');
    });
  });

  // ─── getSecurityHeaders ───────────────────────────────────────
  describe('getSecurityHeaders', () => {
    it('should include all required security headers', () => {
      const headers = getSecurityHeaders();

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
      expect(headers['Cache-Control']).toBe('no-store');
    });

    it('should include CORS headers', () => {
      const headers = getSecurityHeaders();

      expect(headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });
  });

  // ─── successResponse ──────────────────────────────────────────
  describe('successResponse', () => {
    it('should return 200 with { success: true, data }', () => {
      const res = successResponse({ id: 1, name: 'Test' });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ id: 1, name: 'Test' });
    });

    it('should accept custom status code', () => {
      const res = successResponse({ created: true }, 201);
      expect(res.statusCode).toBe(201);
    });

    it('should include security headers', () => {
      const res = successResponse({});
      expect(res.headers!['X-Frame-Options']).toBe('DENY');
    });
  });

  // ─── errorResponse ────────────────────────────────────────────
  describe('errorResponse', () => {
    it('should return specified status with { success: false, error }', () => {
      const res = errorResponse('Something went wrong', 500);
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Something went wrong');
    });

    it('should include details when provided', () => {
      const res = errorResponse('Bad request', 400, { field: 'email' });
      const body = JSON.parse(res.body);

      expect(body.details).toEqual({ field: 'email' });
    });

    it('should not include details when not provided', () => {
      const res = errorResponse('Not found', 404);
      const body = JSON.parse(res.body);

      expect(body.details).toBeUndefined();
    });
  });

  // ─── validationErrorResponse ──────────────────────────────────
  describe('validationErrorResponse', () => {
    it('should return 400 with validation error format', () => {
      const res = validationErrorResponse('Invalid input', { email: 'Invalid email' });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation Error');
      expect(body.message).toBe('Invalid input');
      expect(body.errors).toEqual({ email: 'Invalid email' });
    });

    it('should work without field-level errors', () => {
      const res = validationErrorResponse('Missing required fields');
      const body = JSON.parse(res.body);

      expect(body.errors).toBeUndefined();
    });
  });

  // ─── notFoundResponse ─────────────────────────────────────────
  describe('notFoundResponse', () => {
    it('should return 404 with resource name', () => {
      const res = notFoundResponse('Customer');
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(404);
      expect(body.message).toBe('Customer not found');
    });

    it('should default to "Resource" when no name provided', () => {
      const res = notFoundResponse();
      const body = JSON.parse(res.body);

      expect(body.message).toBe('Resource not found');
    });
  });

  // ─── unauthorizedResponse ─────────────────────────────────────
  describe('unauthorizedResponse', () => {
    it('should return 401', () => {
      const res = unauthorizedResponse('Token expired');
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Token expired');
    });

    it('should default message to "Unauthorized"', () => {
      const res = unauthorizedResponse();
      const body = JSON.parse(res.body);

      expect(body.message).toBe('Unauthorized');
    });
  });

  // ─── parseBody ────────────────────────────────────────────────
  describe('parseBody', () => {
    it('should parse valid JSON body', () => {
      const event = createAPIGatewayEvent({
        body: JSON.stringify({ name: 'Test', amount: 100 }),
      });

      const result = parseBody(event);
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ name: 'Test', amount: 100 });
    });

    it('should return error response for malformed JSON', () => {
      const event = createAPIGatewayEvent({
        body: '{invalid json',
      });

      const result = parseBody(event);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error!.statusCode).toBe(400);
    });

    it('should parse empty body as empty object', () => {
      const event = createAPIGatewayEvent({ body: null });
      const result = parseBody(event);

      expect(result.data).toEqual({});
      expect(result.error).toBeNull();
    });
  });
});
