"use strict";
/**
 * API Response Utilities
 * Standardized Lambda response formatters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.validationErrorResponse = validationErrorResponse;
exports.notFoundResponse = notFoundResponse;
exports.unauthorizedResponse = unauthorizedResponse;
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};
function successResponse(data, statusCode = 200) {
    return {
        statusCode,
        body: JSON.stringify({
            success: true,
            data
        }),
        headers: DEFAULT_HEADERS
    };
}
function errorResponse(error, statusCode = 500, details) {
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
function validationErrorResponse(message, errors) {
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
function notFoundResponse(resource = 'Resource') {
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
function unauthorizedResponse(message = 'Unauthorized') {
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
//# sourceMappingURL=response.js.map