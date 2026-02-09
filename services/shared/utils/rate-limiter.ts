/**
 * Rate Limiting Middleware
 *
 * Token-bucket rate limiter for Lambda functions.
 * Uses in-memory cache with configurable limits per endpoint category.
 *
 * Note: In production, this should be backed by DynamoDB or ElastiCache
 * for persistence across Lambda invocations. API Gateway throttling
 * should also be configured as the first line of defense.
 *
 * Endpoint categories and their limits:
 *  - auth:    5 requests per 15 minutes (login, OTP)
 *  - payment: 10 requests per hour (payment initiation)
 *  - kyc:     3 requests per hour (KYC submissions)
 *  - api:     100 requests per minute (general API)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Pre-defined rate limit configurations by endpoint category.
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 },       // 5 per 15 min
  otp: { maxRequests: 3, windowMs: 5 * 60 * 1000 },         // 3 per 5 min
  payment: { maxRequests: 10, windowMs: 60 * 60 * 1000 },   // 10 per hour
  kyc: { maxRequests: 3, windowMs: 60 * 60 * 1000 },        // 3 per hour
  api: { maxRequests: 100, windowMs: 60 * 1000 },            // 100 per min
  webhook: { maxRequests: 1000, windowMs: 60 * 1000 },       // 1000 per min (high throughput)
};

/**
 * In-memory rate limit store.
 * Entries are automatically cleaned up when checked.
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Periodic cleanup of expired entries (runs every 5 minutes)
 */
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
  lastCleanup = now;
}

/**
 * Extract a client identifier from the request.
 * Prefers authenticated user ID, falls back to source IP.
 */
function getClientIdentifier(event: APIGatewayProxyEvent): string {
  // Try to extract user ID from Authorization header (JWT sub claim)
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.sub) return `user:${payload.sub}`;
    } catch {
      // Fall through to IP-based identification
    }
  }

  return `ip:${event.requestContext?.identity?.sourceIp || 'unknown'}`;
}

/**
 * Determine the rate limit category based on the request path.
 */
export function getRateLimitCategory(path: string): string {
  if (path.includes('/auth') || path.includes('/login')) return 'auth';
  if (path.includes('/otp') || path.includes('/verify')) return 'otp';
  if (path.includes('/payment') && !path.includes('/webhook')) return 'payment';
  if (path.includes('/kyc')) return 'kyc';
  if (path.includes('/webhook')) return 'webhook';
  return 'api';
}

/**
 * Check if a request should be rate limited.
 *
 * @returns null if allowed, or an APIGatewayProxyResult if rate limited
 */
export function checkRateLimit(
  event: APIGatewayProxyEvent,
  categoryOverride?: string
): APIGatewayProxyResult | null {
  cleanupExpiredEntries();

  const category = categoryOverride || getRateLimitCategory(event.path || '');
  const config = RATE_LIMITS[category] || RATE_LIMITS.api;
  const clientId = getClientIdentifier(event);
  const key = `${category}:${clientId}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      statusCode: 429,
      body: JSON.stringify({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retry_after_seconds: retryAfterSeconds,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
      },
    };
  }

  entry.count++;
  return null;
}

/**
 * Get current rate limit status (for response headers).
 */
export function getRateLimitHeaders(
  event: APIGatewayProxyEvent,
  categoryOverride?: string
): Record<string, string> {
  const category = categoryOverride || getRateLimitCategory(event.path || '');
  const config = RATE_LIMITS[category] || RATE_LIMITS.api;
  const clientId = getClientIdentifier(event);
  const key = `${category}:${clientId}`;

  const entry = rateLimitStore.get(key);
  const remaining = entry
    ? Math.max(0, config.maxRequests - entry.count)
    : config.maxRequests;

  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': entry
      ? String(Math.ceil(entry.resetAt / 1000))
      : String(Math.ceil((Date.now() + config.windowMs) / 1000)),
  };
}
