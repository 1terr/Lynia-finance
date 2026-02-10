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
/**
 * Pre-defined rate limit configurations by endpoint category.
 */
export declare const RATE_LIMITS: Record<string, RateLimitConfig>;
/**
 * Determine the rate limit category based on the request path.
 */
export declare function getRateLimitCategory(path: string): string;
/**
 * Check if a request should be rate limited.
 *
 * @returns null if allowed, or an APIGatewayProxyResult if rate limited
 */
export declare function checkRateLimit(event: APIGatewayProxyEvent, categoryOverride?: string): APIGatewayProxyResult | null;
/**
 * Get current rate limit status (for response headers).
 */
export declare function getRateLimitHeaders(event: APIGatewayProxyEvent, categoryOverride?: string): Record<string, string>;
//# sourceMappingURL=rate-limiter.d.ts.map