/**
 * Lightweight Lambda Router
 *
 * Replaces 30-50 line if/else routing chains in Lambda handlers with a
 * declarative route map. Supports exact paths, parameterized segments
 * (:id), OPTIONS preflight, and standard error responses.
 *
 * No external dependencies — keeps Lambda cold start impact minimal.
 *
 * @example
 * ```ts
 * import { createRouter } from '../../shared/utils/lambda-router';
 *
 * const routes = {
 *   'GET /admin/users': handleGetUsers,
 *   'GET /admin/users/:id': handleGetUserById,
 *   'POST /admin/users': handleCreateUser,
 * };
 *
 * export const handler = createRouter(routes, { serviceName: 'admin-service' });
 * ```
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getSecurityHeaders, successResponse, errorResponse } from './response';
import { getAuthContext, AuthContext } from '../middleware/authorization';
import { setRequestContext, clearRequestContext } from './logger';
import logger from './logger';

export interface RouteParams {
  [key: string]: string;
}

export type RouteHandler = (
  event: APIGatewayProxyEvent,
  params: RouteParams,
  auth: AuthContext
) => Promise<APIGatewayProxyResult>;

export interface RouterOptions {
  serviceName: string;
  /** Skip auth context extraction (for public endpoints). Default: false */
  skipAuth?: boolean;
}

interface ParsedRoute {
  method: string;
  segments: string[];
  paramNames: string[];
  handler: RouteHandler;
}

/**
 * Create a Lambda handler from a route map.
 *
 * Routes are defined as `"METHOD /path/:param"` keys mapping to handler
 * functions. The router extracts path parameters, handles OPTIONS
 * preflight, and returns standard error responses for unmatched routes.
 */
export function createRouter(
  routes: Record<string, RouteHandler>,
  options: RouterOptions
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  const parsedRoutes = parseRoutes(routes);

  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const requestId = setRequestContext(
      event.headers?.['x-request-id'],
      event.requestContext?.authorizer?.claims?.sub
    );

    try {
      const method = event.httpMethod;
      const path = normalizePath(event.path);

      logger.info(`${options.serviceName} request`, {
        action: `${options.serviceName}.request`,
        status: 'started',
        method,
        path,
        requestId,
      });

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return successResponse(null, 204, event);
      }

      // Find matching route
      const match = matchRoute(parsedRoutes, method, path);

      if (match && match.methodMatch) {
        // Extract auth context
        let auth: AuthContext = { userId: '', email: '', roles: [] };
        if (!options.skipAuth) {
          auth = getAuthContext(event);
        }

        const response = await match.route.handler(event, match.params, auth);

        logger.info(`${options.serviceName} response`, {
          action: `${options.serviceName}.request`,
          status: 'completed',
          method,
          path,
          statusCode: response.statusCode,
        });

        return response;
      }

      // Path matched but method didn't — 405
      if (match && !match.methodMatch) {
        return {
          statusCode: 405,
          body: JSON.stringify({
            success: false,
            error: 'Method Not Allowed',
            message: `${method} is not allowed for ${path}`,
          }),
          headers: getSecurityHeaders(event),
        };
      }

      // No route matched — 404
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Not Found',
          message: `No route found for ${method} ${path}`,
        }),
        headers: getSecurityHeaders(event),
      };
    } catch (error) {
      const statusCode = (error as Record<string, unknown>)?.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        const message = error instanceof Error ? error.message : 'Client error';
        return errorResponse(message, statusCode, { requestId }, event);
      }

      const message = error instanceof Error ? error.message : 'Internal server error';
      logger.error(`${options.serviceName} error`, {
        action: `${options.serviceName}.request`,
        status: 'failed',
        errorMessage: message,
      });
      return errorResponse('Internal server error', 500, { requestId }, event);
    } finally {
      clearRequestContext();
    }
  };
}

/**
 * Parse route definitions into structured objects for matching.
 */
function parseRoutes(routes: Record<string, RouteHandler>): ParsedRoute[] {
  return Object.entries(routes).map(([key, handler]) => {
    const spaceIndex = key.indexOf(' ');
    if (spaceIndex === -1) {
      throw new Error(`Invalid route key "${key}": must be "METHOD /path"`);
    }

    const method = key.substring(0, spaceIndex).toUpperCase();
    const pathPattern = key.substring(spaceIndex + 1);
    const segments = normalizePath(pathPattern).split('/').filter(Boolean);
    const paramNames: string[] = [];

    for (const segment of segments) {
      if (segment.startsWith(':')) {
        paramNames.push(segment.substring(1));
      }
    }

    return { method, segments, paramNames, handler };
  });
}

interface RouteMatch {
  route: ParsedRoute;
  params: RouteParams;
  methodMatch: boolean;
}

/**
 * Match an incoming request against parsed routes.
 *
 * Returns the matched route with extracted params, or a partial match
 * (methodMatch=false) if the path matches but the method doesn't,
 * or null if no path matches.
 */
function matchRoute(
  routes: ParsedRoute[],
  method: string,
  path: string
): RouteMatch | null {
  const requestSegments = path.split('/').filter(Boolean);
  let pathMatchedButMethodDidnt: ParsedRoute | null = null;

  for (const route of routes) {
    if (route.segments.length !== requestSegments.length) {
      continue;
    }

    const params: RouteParams = {};
    let matched = true;

    for (let i = 0; i < route.segments.length; i++) {
      const routeSegment = route.segments[i];
      const requestSegment = requestSegments[i];

      if (routeSegment.startsWith(':')) {
        params[routeSegment.substring(1)] = requestSegment;
      } else if (routeSegment !== requestSegment) {
        matched = false;
        break;
      }
    }

    if (!matched) continue;

    if (route.method !== method) {
      pathMatchedButMethodDidnt = route;
      continue;
    }

    return { route, params, methodMatch: true };
  }

  if (pathMatchedButMethodDidnt) {
    return { route: pathMatchedButMethodDidnt, params: {}, methodMatch: false };
  }

  return null;
}

/**
 * Normalize a path by removing trailing slashes (except root).
 */
function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}
