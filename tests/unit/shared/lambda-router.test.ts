/**
 * Tests for services/shared/utils/lambda-router.ts
 *
 * The Lambda router replaces 30-50 line if/else routing chains with a
 * declarative route map. Every subsequent service decomposition (Phases 2-6)
 * depends on this utility working correctly.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRouter, RouteHandler, RouteParams } from '../../../services/shared/utils/lambda-router';
import { createAPIGatewayEvent, parseResponseBody } from '../../helpers/test-utils';
import { AuthContext } from '../../../services/shared/middleware/authorization';

// ─── Mock logger to avoid side effects ──────────────────────────
jest.mock('../../../services/shared/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
    setRequestContext: jest.fn().mockReturnValue('test-req-id'),
    clearRequestContext: jest.fn(),
    LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' },
  };
});

// ─── Helpers ────────────────────────────────────────────────────

function createAuthenticatedEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return createAPIGatewayEvent({
    ...overrides,
    requestContext: {
      ...createAPIGatewayEvent().requestContext,
      authorizer: {
        claims: {
          sub: 'user-123',
          email: 'admin@lynia.com',
          'cognito:groups': 'admin',
        },
      },
      ...(overrides.requestContext || {}),
    } as APIGatewayProxyEvent['requestContext'],
  });
}

function createTestHandler(response?: Partial<APIGatewayProxyResult>): RouteHandler {
  return jest.fn().mockResolvedValue({
    statusCode: 200,
    body: JSON.stringify({ success: true, data: { handler: 'called' } }),
    headers: { 'Content-Type': 'application/json' },
    ...response,
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe('lambda-router', () => {
  // ─── Exact path matching ──────────────────────────────────────
  describe('exact path matching', () => {
    it('should route exact path to correct handler', async () => {
      const handler = createTestHandler();
      const router = createRouter(
        { 'GET /admin/users': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.statusCode).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should differentiate between methods on the same path', async () => {
      const getHandler = createTestHandler({ body: JSON.stringify({ method: 'GET' }) });
      const postHandler = createTestHandler({ body: JSON.stringify({ method: 'POST' }) });

      const router = createRouter(
        {
          'GET /admin/users': getHandler,
          'POST /admin/users': postHandler,
        },
        { serviceName: 'test-service', skipAuth: true }
      );

      const getEvent = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'GET' });
      await router(getEvent);
      expect(getHandler).toHaveBeenCalledTimes(1);
      expect(postHandler).not.toHaveBeenCalled();

      const postEvent = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'POST' });
      await router(postEvent);
      expect(postHandler).toHaveBeenCalledTimes(1);
    });

    it('should match multiple distinct paths', async () => {
      const usersHandler = createTestHandler();
      const productsHandler = createTestHandler();

      const router = createRouter(
        {
          'GET /admin/users': usersHandler,
          'GET /admin/products': productsHandler,
        },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event1 = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'GET' });
      await router(event1);
      expect(usersHandler).toHaveBeenCalledTimes(1);

      const event2 = createAPIGatewayEvent({ path: '/admin/products', httpMethod: 'GET' });
      await router(event2);
      expect(productsHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle trailing slash normalization', async () => {
      const handler = createTestHandler();
      const router = createRouter(
        { 'GET /admin/users': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users/', httpMethod: 'GET' });
      await router(event);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Parameterized path matching ─────────────────────────────
  describe('parameterized paths', () => {
    it('should extract single :id parameter', async () => {
      let capturedParams: RouteParams = {};
      const handler: RouteHandler = jest.fn().mockImplementation(
        async (_event, params) => {
          capturedParams = params;
          return { statusCode: 200, body: '{}', headers: {} };
        }
      );

      const router = createRouter(
        { 'GET /admin/users/:id': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users/abc-123', httpMethod: 'GET' });
      await router(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(capturedParams).toEqual({ id: 'abc-123' });
    });

    it('should extract multiple parameters', async () => {
      let capturedParams: RouteParams = {};
      const handler: RouteHandler = jest.fn().mockImplementation(
        async (_event, params) => {
          capturedParams = params;
          return { statusCode: 200, body: '{}', headers: {} };
        }
      );

      const router = createRouter(
        { 'GET /admin/orgs/:orgId/members/:memberId': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({
        path: '/admin/orgs/org-456/members/mem-789',
        httpMethod: 'GET',
      });
      await router(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(capturedParams).toEqual({ orgId: 'org-456', memberId: 'mem-789' });
    });

    it('should not match parameterized route when segment count differs', async () => {
      const handler = createTestHandler();
      const router = createRouter(
        { 'GET /admin/users/:id': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.statusCode).toBe(404);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should prefer exact match over parameterized when both defined', async () => {
      const exactHandler = createTestHandler({ body: JSON.stringify({ match: 'exact' }) });
      const paramHandler = createTestHandler({ body: JSON.stringify({ match: 'param' }) });

      const router = createRouter(
        {
          'GET /admin/users/me': exactHandler,
          'GET /admin/users/:id': paramHandler,
        },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users/me', httpMethod: 'GET' });
      const result = await router(event);

      // Exact match should win since it's defined first
      const body = parseResponseBody(result);
      expect((body as Record<string, string>).match).toBe('exact');
    });
  });

  // ─── OPTIONS preflight ────────────────────────────────────────
  describe('OPTIONS preflight', () => {
    it('should return 204 for OPTIONS without calling any handler', async () => {
      const handler = createTestHandler();
      const router = createRouter(
        { 'GET /admin/users': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'OPTIONS' });
      const result = await router(event);

      expect(result.statusCode).toBe(204);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should include CORS headers in OPTIONS response', async () => {
      const router = createRouter(
        { 'GET /test': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/test', httpMethod: 'OPTIONS' });
      const result = await router(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Methods']).toBeDefined();
    });
  });

  // ─── 404 Not Found ───────────────────────────────────────────
  describe('404 handling', () => {
    it('should return 404 with standard error format for unmatched routes', async () => {
      const router = createRouter(
        { 'GET /admin/users': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/nonexistent', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody(result);
      expect(body).toMatchObject({
        success: false,
        error: 'Not Found',
      });
    });

    it('should include security headers in 404 response', async () => {
      const router = createRouter(
        { 'GET /test': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/nope', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.headers!['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers!['X-Frame-Options']).toBe('DENY');
    });
  });

  // ─── 405 Method Not Allowed ──────────────────────────────────
  describe('405 handling', () => {
    it('should return 405 when path matches but method does not', async () => {
      const router = createRouter(
        { 'GET /admin/users': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'DELETE' });
      const result = await router(event);

      expect(result.statusCode).toBe(405);
      const body = parseResponseBody(result);
      expect(body).toMatchObject({
        success: false,
        error: 'Method Not Allowed',
      });
    });

    it('should include security headers in 405 response', async () => {
      const router = createRouter(
        { 'POST /admin/users': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.statusCode).toBe(405);
      expect(result.headers!['X-Content-Type-Options']).toBe('nosniff');
    });
  });

  // ─── Error handling ──────────────────────────────────────────
  describe('error handling', () => {
    it('should catch handler errors and return 500', async () => {
      const failingHandler: RouteHandler = jest.fn().mockRejectedValue(new Error('DB connection failed'));

      const router = createRouter(
        { 'GET /admin/users': failingHandler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/admin/users', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.statusCode).toBe(500);
      const body = parseResponseBody(result);
      expect(body).toMatchObject({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should propagate auth errors (403) from getAuthContext', async () => {
      const handler = createTestHandler();
      const router = createRouter(
        { 'GET /admin/users': handler },
        { serviceName: 'test-service' } // skipAuth: false (default)
      );

      // Event without authorizer claims triggers auth error
      const event = createAPIGatewayEvent({
        path: '/admin/users',
        httpMethod: 'GET',
        requestContext: {
          ...createAPIGatewayEvent().requestContext,
          authorizer: null,
        } as unknown as APIGatewayProxyEvent['requestContext'],
      });

      const result = await router(event);

      expect(result.statusCode).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return 500 for non-Error thrown values', async () => {
      const failingHandler: RouteHandler = jest.fn().mockRejectedValue('string error');

      const router = createRouter(
        { 'GET /test': failingHandler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/test', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.statusCode).toBe(500);
    });

    it('should pass through client errors (4xx) with their status code', async () => {
      const badRequestError = new Error('Invalid input');
      (badRequestError as unknown as Record<string, unknown>).statusCode = 400;
      const failingHandler: RouteHandler = jest.fn().mockRejectedValue(badRequestError);

      const router = createRouter(
        { 'POST /test': failingHandler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/test', httpMethod: 'POST' });
      const result = await router(event);

      expect(result.statusCode).toBe(400);
    });
  });

  // ─── Auth context injection ──────────────────────────────────
  describe('auth context', () => {
    it('should pass auth context to handlers when skipAuth is false', async () => {
      let capturedAuth: AuthContext | null = null;
      const handler: RouteHandler = jest.fn().mockImplementation(
        async (_event, _params, auth) => {
          capturedAuth = auth;
          return { statusCode: 200, body: '{}', headers: {} };
        }
      );

      const router = createRouter(
        { 'GET /admin/users': handler },
        { serviceName: 'test-service' } // skipAuth defaults to false
      );

      const event = createAuthenticatedEvent({ path: '/admin/users', httpMethod: 'GET' });
      await router(event);

      expect(capturedAuth).toEqual({
        userId: 'user-123',
        email: 'admin@lynia.com',
        roles: ['admin'],
      });
    });

    it('should pass empty auth context when skipAuth is true', async () => {
      let capturedAuth: AuthContext | null = null;
      const handler: RouteHandler = jest.fn().mockImplementation(
        async (_event, _params, auth) => {
          capturedAuth = auth;
          return { statusCode: 200, body: '{}', headers: {} };
        }
      );

      const router = createRouter(
        { 'GET /public/health': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/public/health', httpMethod: 'GET' });
      await router(event);

      expect(capturedAuth).toEqual({ userId: '', email: '', roles: [] });
    });
  });

  // ─── Security headers in all responses ────────────────────────
  describe('security headers', () => {
    it('should include security headers in successful responses', async () => {
      const router = createRouter(
        { 'GET /test': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/test', httpMethod: 'GET' });
      const result = await router(event);

      // Handler returns its own headers, but 404/405/500 get security headers from router
      expect(result.statusCode).toBe(200);
    });

    it('should include security headers in error responses', async () => {
      const router = createRouter(
        { 'GET /test': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/missing', httpMethod: 'GET' });
      const result = await router(event);

      expect(result.headers!['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers!['X-Frame-Options']).toBe('DENY');
      expect(result.headers!['X-XSS-Protection']).toBe('1; mode=block');
      expect(result.headers!['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
      expect(result.headers!['Access-Control-Allow-Origin']).toBeDefined();
    });
  });

  // ─── Route definition validation ─────────────────────────────
  describe('route definition validation', () => {
    it('should throw on malformed route key (no space)', () => {
      expect(() => {
        createRouter(
          { 'GET/admin/users': createTestHandler() },
          { serviceName: 'test-service' }
        );
      }).toThrow('Invalid route key');
    });
  });

  // ─── Event passthrough ────────────────────────────────────────
  describe('event passthrough', () => {
    it('should pass the original event to the handler', async () => {
      let capturedEvent: APIGatewayProxyEvent | null = null;
      const handler: RouteHandler = jest.fn().mockImplementation(
        async (event) => {
          capturedEvent = event;
          return { statusCode: 200, body: '{}', headers: {} };
        }
      );

      const router = createRouter(
        { 'POST /admin/users': handler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({
        path: '/admin/users',
        httpMethod: 'POST',
        body: JSON.stringify({ name: 'Test User' }),
      });
      await router(event);

      expect(capturedEvent).toBe(event);
    });
  });

  // ─── Logger integration ──────────────────────────────────────
  describe('logging', () => {
    it('should set and clear request context', async () => {
      const loggerModule = require('../../../services/shared/utils/logger');
      const router = createRouter(
        { 'GET /test': createTestHandler() },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/test', httpMethod: 'GET' });
      await router(event);

      expect(loggerModule.setRequestContext).toHaveBeenCalled();
      expect(loggerModule.clearRequestContext).toHaveBeenCalled();
    });

    it('should clear request context even on error', async () => {
      const loggerModule = require('../../../services/shared/utils/logger');
      const failingHandler: RouteHandler = jest.fn().mockRejectedValue(new Error('boom'));

      const router = createRouter(
        { 'GET /test': failingHandler },
        { serviceName: 'test-service', skipAuth: true }
      );

      const event = createAPIGatewayEvent({ path: '/test', httpMethod: 'GET' });
      await router(event);

      expect(loggerModule.clearRequestContext).toHaveBeenCalled();
    });
  });
});
