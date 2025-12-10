/**
 * API Response Utilities
 * Standardized Lambda response formatters
 */
import { APIGatewayProxyResult } from 'aws-lambda';
export declare function successResponse(data: any, statusCode?: number): APIGatewayProxyResult;
export declare function errorResponse(error: string, statusCode?: number, details?: any): APIGatewayProxyResult;
export declare function validationErrorResponse(message: string, errors?: Record<string, string>): APIGatewayProxyResult;
export declare function notFoundResponse(resource?: string): APIGatewayProxyResult;
export declare function unauthorizedResponse(message?: string): APIGatewayProxyResult;
//# sourceMappingURL=response.d.ts.map