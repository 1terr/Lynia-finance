/**
 * API Response Utilities
 * Standardized Lambda response formatters
 */

import { APIGatewayProxyResult } from 'aws-lambda';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export function successResponse(
  data: unknown,
  statusCode: number = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify({
      success: true,
      data
    }),
    headers: DEFAULT_HEADERS
  };
}

export function errorResponse(
  error: string,
  statusCode: number = 500,
  details?: Record<string, unknown>
): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      error,
      ...(details && { details })
    }),
    headers: DEFAULT_HEADERS
  };
}

export function validationErrorResponse(
  message: string,
  errors?: Record<string, string>
): APIGatewayProxyResult {
  return {
    statusCode: 400,
    body: JSON.stringify({
      success: false,
      error: 'Validation Error',
      message,
      ...(errors && { errors })
    }),
    headers: DEFAULT_HEADERS
  };
}

export function notFoundResponse(resource: string = 'Resource'): APIGatewayProxyResult {
  return {
    statusCode: 404,
    body: JSON.stringify({
      success: false,
      error: 'Not Found',
      message: `${resource} not found`
    }),
    headers: DEFAULT_HEADERS
  };
}

export function unauthorizedResponse(message: string = 'Unauthorized'): APIGatewayProxyResult {
  return {
    statusCode: 401,
    body: JSON.stringify({
      success: false,
      error: 'Unauthorized',
      message
    }),
    headers: DEFAULT_HEADERS
  };
}
