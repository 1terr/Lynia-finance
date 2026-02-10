"use strict";
/**
 * Logger Utility
 * Standardized logging across all microservices
 *
 * Security: Automatically masks PII fields to prevent sensitive data
 * from appearing in CloudWatch logs.
 *
 * Structured format: { timestamp, level, message, service, environment,
 *                      requestId, action, status, duration, meta }
 *
 * Correlation: Use setRequestContext() at the start of each Lambda
 * invocation to propagate requestId across all log entries. Pass
 * the x-request-id header between services to trace requests across
 * all 6 service boundaries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
exports.setRequestContext = setRequestContext;
exports.getRequestContext = getRequestContext;
exports.clearRequestContext = clearRequestContext;
exports.maskPhone = maskPhone;
exports.maskNationalId = maskNationalId;
exports.maskSensitiveData = maskSensitiveData;
exports.log = log;
exports.startOperation = startOperation;
const crypto_1 = require("crypto");
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
const currentLogLevel = process.env.LOG_LEVEL || LogLevel.INFO;
const logLevels = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3
};
let _requestContext = null;
/**
 * Set the request context for the current invocation.
 * Call this at the beginning of every Lambda handler.
 *
 * @param requestId - Correlation ID from x-request-id header or auto-generated
 * @param userId - Authenticated user ID (optional)
 */
function setRequestContext(requestId, userId) {
    const id = requestId || (0, crypto_1.randomUUID)();
    _requestContext = {
        requestId: id,
        service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
        ...(userId && { userId }),
    };
    return id;
}
/**
 * Get the current request context (for passing to downstream services).
 */
function getRequestContext() {
    return _requestContext;
}
/**
 * Clear the request context. Called at the end of an invocation.
 */
function clearRequestContext() {
    _requestContext = null;
}
/**
 * Fields that must NEVER appear in logs unmasked.
 * Matches against lowercased key names.
 */
const SENSITIVE_FIELD_PATTERNS = [
    'password', 'pin', 'otp', 'token', 'secret',
    'national_id', 'nationalid', 'id_number',
    'phone_number', 'phone', 'customer_phone', 'whatsapp_number',
    'card_number', 'cvv', 'account_number',
    'biometric', 'face_image', 'selfie', 'id_document',
    'api_key', 'api_secret', 'webhook_secret',
    'authorization', 'cookie',
];
/**
 * Mask a phone number for safe logging: +263****567
 */
function maskPhone(phone) {
    if (!phone || phone.length < 6)
        return '***';
    return phone.slice(0, 4) + '****' + phone.slice(-3);
}
/**
 * Mask a national ID for safe logging: 12-******A90
 */
function maskNationalId(id) {
    if (!id || id.length < 6)
        return '***';
    return id.slice(0, 3) + '******' + id.slice(-3);
}
/**
 * Mask a generic sensitive string: show first 2 and last 2 chars
 */
function maskGeneric(value) {
    if (!value || value.length < 5)
        return '***';
    return value.slice(0, 2) + '***' + value.slice(-2);
}
/**
 * Recursively mask sensitive fields in a metadata object.
 */
function maskSensitiveData(obj, depth = 0) {
    if (depth > 5)
        return '[DEPTH_LIMIT]';
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj === 'string')
        return obj;
    if (typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => maskSensitiveData(item, depth + 1));
    }
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern => lowerKey.includes(pattern));
        if (isSensitive && typeof value === 'string') {
            if (lowerKey.includes('phone') || lowerKey.includes('whatsapp')) {
                masked[key] = maskPhone(value);
            }
            else if (lowerKey.includes('national_id') || lowerKey.includes('id_number')) {
                masked[key] = maskNationalId(value);
            }
            else {
                masked[key] = maskGeneric(value);
            }
        }
        else if (isSensitive) {
            masked[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null) {
            masked[key] = maskSensitiveData(value, depth + 1);
        }
        else {
            masked[key] = value;
        }
    }
    return masked;
}
function shouldLog(level) {
    return logLevels[level] >= logLevels[currentLogLevel];
}
/**
 * Structured log entry matching CLAUDE.md logging standards:
 *   timestamp, level, service, requestId, action, status, duration, meta
 *
 * @param meta.action  - Operation identifier, e.g. "loan.apply", "payment.process"
 * @param meta.status  - "started" | "completed" | "failed"
 * @param meta.duration - Duration in milliseconds
 */
function log(level, message, meta) {
    if (!shouldLog(level))
        return;
    const ctx = _requestContext;
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        service: ctx?.service || process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        requestId: ctx?.requestId || 'no-context',
    };
    if (ctx?.userId) {
        logEntry.userId = ctx.userId;
    }
    if (meta) {
        // Promote action, status, duration to top level for metric filters
        if (meta.action)
            logEntry.action = meta.action;
        if (meta.status)
            logEntry.status = meta.status;
        if (meta.duration !== undefined)
            logEntry.duration = meta.duration;
        const remaining = { ...meta };
        delete remaining.action;
        delete remaining.status;
        delete remaining.duration;
        if (Object.keys(remaining).length > 0) {
            logEntry.meta = maskSensitiveData(remaining);
        }
    }
    console.log(JSON.stringify(logEntry));
}
/**
 * Log an operation with automatic duration tracking.
 * Returns a function to call when the operation completes.
 */
function startOperation(action, meta) {
    const startTime = Date.now();
    log(LogLevel.INFO, `${action} started`, { action, status: 'started', ...meta });
    return {
        succeed: (extraMeta) => {
            const duration = Date.now() - startTime;
            log(LogLevel.INFO, `${action} completed`, {
                action,
                status: 'completed',
                duration,
                ...meta,
                ...extraMeta,
            });
        },
        fail: (error, extraMeta) => {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = error instanceof Error && 'code' in error
                ? error.code
                : undefined;
            log(LogLevel.ERROR, `${action} failed`, {
                action,
                status: 'failed',
                duration,
                errorMessage,
                ...(errorCode && { errorCode }),
                ...meta,
                ...extraMeta,
            });
        },
    };
}
exports.logger = {
    debug: (message, meta) => log(LogLevel.DEBUG, message, meta),
    info: (message, meta) => log(LogLevel.INFO, message, meta),
    warn: (message, meta) => log(LogLevel.WARN, message, meta),
    error: (message, meta) => log(LogLevel.ERROR, message, meta),
    /** Set correlation context for the current Lambda invocation */
    setContext: setRequestContext,
    /** Get current correlation context */
    getContext: getRequestContext,
    /** Clear correlation context */
    clearContext: clearRequestContext,
    /** Track an operation with automatic duration and status logging */
    startOperation,
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map