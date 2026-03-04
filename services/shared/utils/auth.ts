/**
 * JWT Authentication Middleware
 *
 * Validates Cognito JWT tokens from the API Gateway Cognito authorizer.
 * All protected API endpoints MUST call requireAuth() before processing.
 *
 * With a Cognito authorizer on API Gateway, the JWT is validated before
 * the Lambda is invoked. This middleware extracts the claims from the
 * event context.
 *
 * Webhook endpoints (called by external providers like EcoCash, DIDIT)
 * use signature verification instead of JWT auth — see individual handlers.
 *
 * Usage:
 *   const authResult = requireAuth(event);
 *   if (authResult.error) return authResult.error;
 *   const userId = authResult.userId;
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export interface AuthResult {
  userId: string | null;
  email: string | null;
  roles: string[];
  error: APIGatewayProxyResult | null;
}

/**
 * Extract authenticated user info from Cognito JWT claims.
 *
 * The API Gateway Cognito authorizer validates the JWT before the Lambda
 * is invoked. The claims are available in event.requestContext.authorizer.claims.
 */
export async function requireAuth(event: APIGatewayProxyEvent): Promise<AuthResult> {
  const claims = event.requestContext.authorizer?.claims;

  if (!claims) {
    // Fallback: check Authorization header manually (for routes without authorizer)
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        userId: null,
        email: null,
        roles: [],
        error: {
          statusCode: 401,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'AUTH_TOKEN_001',
              message: 'Authentication required. Provide a valid Bearer token.',
            },
          }),
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer',
          },
        },
      };
    }

    // Decode JWT payload (already validated by API Gateway)
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      return {
        userId: payload.sub || null,
        email: payload.email || null,
        roles: (payload['cognito:groups'] || '').split(',').filter(Boolean),
        error: null,
      };
    } catch {
      return {
        userId: null,
        email: null,
        roles: [],
        error: {
          statusCode: 401,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'AUTH_TOKEN_002',
              message: 'Invalid or expired token.',
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        },
      };
    }
  }

  return {
    userId: claims.sub,
    email: claims.email || null,
    roles: (claims['cognito:groups'] || '').split(',').filter(Boolean),
    error: null,
  };
}

/**
 * Extract user ID from JWT without full validation.
 * Only use for logging/correlation — never for authorization decisions.
 */
export function extractUserIdFromToken(event: APIGatewayProxyEvent): string | null {
  // First try Cognito authorizer claims
  const claims = event.requestContext.authorizer?.claims;
  if (claims?.sub) return claims.sub;

  // Fallback to manual JWT decode
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}
