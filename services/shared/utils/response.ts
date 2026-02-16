/**
 * API Response Utilities
 * Standardized Lambda response formatters with security headers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * Allowed CORS origins for API access.
 * Only trusted frontend domains are permitted.
 */
const ALLOWED_ORIGINS: string[] = [
  'https://lyniafinance.com',
  'https://www.lyniafinance.com',
  'https://admin.lyniafinance.com',
  'https://app.lyniafinance.com',
  'https://distributor.lyniafinance.com',
  'https://d1qwfy2tsdmpe4.cloudfront.net',
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : []),
];

/**
 * Resolve the CORS origin header based on the incoming request.
 * Returns the request origin if it is whitelisted, otherwise returns
 * the primary frontend domain to prevent open CORS.
 */
export function getCorsOrigin(event?: APIGatewayProxyEvent): string {
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin;
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return ALLOWED_ORIGINS[0];
}

/**
 * Build standard security response headers.
 */
export function getSecurityHeaders(event?: APIGatewayProxyEvent): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getCorsOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store',
  };
}

export function successResponse(
  data: unknown,
  statusCode: number = 200,
  event?: APIGatewayProxyEvent
): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify({
      success: true,
      data
    }),
    headers: getSecurityHeaders(event)
  };
}

export function errorResponse(
  error: string,
  statusCode: number = 500,
  details?: Record<string, unknown>,
  event?: APIGatewayProxyEvent
): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      error,
      ...(details && { details })
    }),
    headers: getSecurityHeaders(event)
  };
}

export function validationErrorResponse(
  message: string,
  errors?: Record<string, string>,
  event?: APIGatewayProxyEvent
): APIGatewayProxyResult {
  return {
    statusCode: 400,
    body: JSON.stringify({
      success: false,
      error: 'Validation Error',
      message,
      ...(errors && { errors })
    }),
    headers: getSecurityHeaders(event)
  };
}

export function notFoundResponse(resource: string = 'Resource', event?: APIGatewayProxyEvent): APIGatewayProxyResult {
  return {
    statusCode: 404,
    body: JSON.stringify({
      success: false,
      error: 'Not Found',
      message: `${resource} not found`
    }),
    headers: getSecurityHeaders(event)
  };
}

export function unauthorizedResponse(message: string = 'Unauthorized', event?: APIGatewayProxyEvent): APIGatewayProxyResult {
  return {
    statusCode: 401,
    body: JSON.stringify({
      success: false,
      error: 'Unauthorized',
      message
    }),
    headers: getSecurityHeaders(event)
  };
}

/**
 * Safely parse JSON request body.
 * Returns parsed object on success, or an error response on malformed input.
 */
export function parseBody<T = Record<string, unknown>>(
  event: APIGatewayProxyEvent
): { data: T; error: null } | { data: null; error: APIGatewayProxyResult } {
  try {
    const data = JSON.parse(event.body || '{}') as T;
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: validationErrorResponse('Invalid JSON in request body', undefined, event),
    };
  }
}
