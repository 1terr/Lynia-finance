/**
 * JWT Authentication Middleware
 *
 * Validates Supabase JWT tokens from the Authorization header.
 * All protected API endpoints MUST call requireAuth() before processing.
 *
 * Webhook endpoints (called by external providers like EcoCash, Smile Identity)
 * use signature verification instead of JWT auth — see individual handlers.
 *
 * Usage:
 *   const authResult = requireAuth(event);
 *   if (authResult.error) return authResult.error;
 *   const userId = authResult.userId;
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

export interface AuthResult {
  userId: string | null;
  role: string | null;
  error: APIGatewayProxyResult | null;
}

/**
 * Validate JWT token from Authorization header using Supabase Auth.
 *
 * Returns the authenticated user ID and role, or an error response
 * that should be returned directly to the caller.
 */
export async function requireAuth(event: APIGatewayProxyEvent): Promise<AuthResult> {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      userId: null,
      role: null,
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

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        userId: null,
        role: null,
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

    return {
      userId: user.id,
      role: user.role || null,
      error: null,
    };
  } catch {
    return {
      userId: null,
      role: null,
      error: {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_TOKEN_001',
            message: 'Authentication failed.',
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    };
  }
}

/**
 * Extract user ID from JWT without full validation.
 * Only use for logging/correlation — never for authorization decisions.
 */
export function extractUserIdFromToken(event: APIGatewayProxyEvent): string | null {
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
