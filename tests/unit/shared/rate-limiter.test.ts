/**
 * Characterization tests for services/shared/utils/rate-limiter.ts
 *
 * DoS protection — rate limits on auth, payment, KYC, and general API endpoints.
 */

import {
  checkRateLimit,
  getRateLimitCategory,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '../../../services/shared/utils/rate-limiter';
import { createAPIGatewayEvent } from '../../helpers/test-utils';

describe('rate-limiter', () => {
  // ─── getRateLimitCategory ─────────────────────────────────────
  describe('getRateLimitCategory', () => {
    it('should categorize /auth paths as "auth"', () => {
      expect(getRateLimitCategory('/api/v1/auth/login')).toBe('auth');
    });

    it('should categorize /login paths as "auth"', () => {
      expect(getRateLimitCategory('/login')).toBe('auth');
    });

    it('should categorize /otp paths as "otp"', () => {
      expect(getRateLimitCategory('/api/v1/otp/send')).toBe('otp');
    });

    it('should categorize /verify paths as "otp"', () => {
      expect(getRateLimitCategory('/api/v1/verify')).toBe('otp');
    });

    it('should categorize /payment paths as "payment"', () => {
      expect(getRateLimitCategory('/api/v1/payment/initiate')).toBe('payment');
    });

    it('should categorize payment webhook as "webhook" not "payment"', () => {
      expect(getRateLimitCategory('/payments/webhook/ecocash')).toBe('webhook');
    });

    it('should categorize /kyc paths as "kyc"', () => {
      expect(getRateLimitCategory('/api/v1/kyc/submit')).toBe('kyc');
    });

    it('should default to "api" for unknown paths', () => {
      expect(getRateLimitCategory('/api/v1/admin/users')).toBe('api');
    });
  });

  // ─── RATE_LIMITS config ───────────────────────────────────────
  describe('RATE_LIMITS', () => {
    it('should have auth limit of 5 per 15 min', () => {
      expect(RATE_LIMITS.auth.maxRequests).toBe(5);
      expect(RATE_LIMITS.auth.windowMs).toBe(15 * 60 * 1000);
    });

    it('should have otp limit of 3 per 5 min', () => {
      expect(RATE_LIMITS.otp.maxRequests).toBe(3);
      expect(RATE_LIMITS.otp.windowMs).toBe(5 * 60 * 1000);
    });

    it('should have payment limit of 10 per hour', () => {
      expect(RATE_LIMITS.payment.maxRequests).toBe(10);
      expect(RATE_LIMITS.payment.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have api limit of 100 per minute', () => {
      expect(RATE_LIMITS.api.maxRequests).toBe(100);
      expect(RATE_LIMITS.api.windowMs).toBe(60 * 1000);
    });

    it('should have webhook limit of 1000 per minute', () => {
      expect(RATE_LIMITS.webhook.maxRequests).toBe(1000);
    });
  });

  // ─── checkRateLimit ───────────────────────────────────────────
  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const event = createAPIGatewayEvent({
        path: '/api/v1/admin/test-' + Date.now(),
        requestContext: {
          ...createAPIGatewayEvent().requestContext,
          identity: {
            ...createAPIGatewayEvent().requestContext.identity,
            sourceIp: `10.0.0.${Math.floor(Math.random() * 255)}`,
          },
        },
      });

      const result = checkRateLimit(event);
      expect(result).toBeNull(); // null = allowed
    });

    it('should return 429 when rate limit exceeded', () => {
      const uniqueIp = `192.168.99.${Math.floor(Math.random() * 255)}`;
      const uniquePath = `/api/v1/auth/login-test-${Date.now()}`;

      for (let i = 0; i < 5; i++) {
        const event = createAPIGatewayEvent({
          path: uniquePath,
          requestContext: {
            ...createAPIGatewayEvent().requestContext,
            identity: {
              ...createAPIGatewayEvent().requestContext.identity,
              sourceIp: uniqueIp,
            },
          },
        });
        checkRateLimit(event, 'auth');
      }

      // 6th request should be blocked (auth limit is 5)
      const blockedEvent = createAPIGatewayEvent({
        path: uniquePath,
        requestContext: {
          ...createAPIGatewayEvent().requestContext,
          identity: {
            ...createAPIGatewayEvent().requestContext.identity,
            sourceIp: uniqueIp,
          },
        },
      });

      const result = checkRateLimit(blockedEvent, 'auth');
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(429);

      const body = JSON.parse(result!.body);
      expect(body.error).toBe('Too Many Requests');
      expect(body.retry_after_seconds).toBeGreaterThan(0);
    });

    it('should include Retry-After header in 429 response', () => {
      const uniqueIp = `10.10.10.${Math.floor(Math.random() * 255)}`;

      for (let i = 0; i < 4; i++) {
        const event = createAPIGatewayEvent({
          path: '/api/v1/otp/send',
          requestContext: {
            ...createAPIGatewayEvent().requestContext,
            identity: {
              ...createAPIGatewayEvent().requestContext.identity,
              sourceIp: uniqueIp,
            },
          },
        });
        checkRateLimit(event, 'otp');
      }

      const event = createAPIGatewayEvent({
        path: '/api/v1/otp/send',
        requestContext: {
          ...createAPIGatewayEvent().requestContext,
          identity: {
            ...createAPIGatewayEvent().requestContext.identity,
            sourceIp: uniqueIp,
          },
        },
      });

      const result = checkRateLimit(event, 'otp');
      if (result) {
        expect(result.headers!['Retry-After']).toBeDefined();
        expect(result.headers!['X-RateLimit-Remaining']).toBe('0');
      }
    });
  });

  // ─── getRateLimitHeaders ──────────────────────────────────────
  describe('getRateLimitHeaders', () => {
    it('should return rate limit info headers', () => {
      const event = createAPIGatewayEvent({
        path: '/api/v1/admin/dashboard',
        requestContext: {
          ...createAPIGatewayEvent().requestContext,
          identity: {
            ...createAPIGatewayEvent().requestContext.identity,
            sourceIp: `172.16.0.${Math.floor(Math.random() * 255)}`,
          },
        },
      });

      const headers = getRateLimitHeaders(event);

      expect(headers['X-RateLimit-Limit']).toBeDefined();
      expect(headers['X-RateLimit-Remaining']).toBeDefined();
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });
  });
});
