"use strict";
/**
 * API Response Utilities
 * Standardized Lambda response formatters with security headers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorsOrigin = getCorsOrigin;
exports.getSecurityHeaders = getSecurityHeaders;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.validationErrorResponse = validationErrorResponse;
exports.notFoundResponse = notFoundResponse;
exports.unauthorizedResponse = unauthorizedResponse;
/**
 * Allowed CORS origins for API access.
 * Only trusted frontend domains are permitted.
 */
const ALLOWED_ORIGINS = [
    'https://admin.lyniafinance.com',
    'https://app.lyniafinance.com',
    'https://distributor.lyniafinance.com',
    ...(process.env.NODE_ENV !== 'production'
        ? ['http://localhost:3000', 'http://localhost:3001']
        : []),
];
/**
 * Resolve the CORS origin header based on the incoming request.
 * Returns the request origin if it is whitelisted, otherwise returns
 * the primary frontend domain to prevent open CORS.
 */
function getCorsOrigin(event) {
    const requestOrigin = event?.headers?.origin || event?.headers?.Origin;
    if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
        return requestOrigin;
    }
    return ALLOWED_ORIGINS[0];
}
/**
 * Build standard security response headers.
 */
function getSecurityHeaders(event) {
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
function successResponse(data, statusCode = 200, event) {
    return {
        statusCode,
        body: JSON.stringify({
            success: true,
            data
        }),
        headers: getSecurityHeaders(event)
    };
}
function errorResponse(error, statusCode = 500, details, event) {
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
function validationErrorResponse(message, errors, event) {
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
function notFoundResponse(resource = 'Resource', event) {
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
function unauthorizedResponse(message = 'Unauthorized', event) {
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
//# sourceMappingURL=response.js.map