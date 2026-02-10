/**
 * API Response Utilities
 * Standardized Lambda response formatters with security headers
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * Resolve the CORS origin header based on the incoming request.
 * Returns the request origin if it is whitelisted, otherwise returns
 * the primary frontend domain to prevent open CORS.
 */
export declare function getCorsOrigin(event?: APIGatewayProxyEvent): string;
/**
 * Build standard security response headers.
 */
export declare function getSecurityHeaders(event?: APIGatewayProxyEvent): Record<string, string>;
export declare function successResponse(data: unknown, statusCode?: number, event?: APIGatewayProxyEvent): APIGatewayProxyResult;
export declare function errorResponse(error: string, statusCode?: number, details?: Record<string, unknown>, event?: APIGatewayProxyEvent): APIGatewayProxyResult;
export declare function validationErrorResponse(message: string, errors?: Record<string, string>, event?: APIGatewayProxyEvent): APIGatewayProxyResult;
export declare function notFoundResponse(resource?: string, event?: APIGatewayProxyEvent): APIGatewayProxyResult;
export declare function unauthorizedResponse(message?: string, event?: APIGatewayProxyEvent): APIGatewayProxyResult;
//# sourceMappingURL=response.d.ts.map