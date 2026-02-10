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
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
/**
 * Request context that propagates across all log entries within a
 * single Lambda invocation. Set via setRequestContext().
 */
interface RequestContext {
    requestId: string;
    service: string;
    userId?: string;
}
/**
 * Set the request context for the current invocation.
 * Call this at the beginning of every Lambda handler.
 *
 * @param requestId - Correlation ID from x-request-id header or auto-generated
 * @param userId - Authenticated user ID (optional)
 */
export declare function setRequestContext(requestId?: string, userId?: string): string;
/**
 * Get the current request context (for passing to downstream services).
 */
export declare function getRequestContext(): RequestContext | null;
/**
 * Clear the request context. Called at the end of an invocation.
 */
export declare function clearRequestContext(): void;
/**
 * Mask a phone number for safe logging: +263****567
 */
export declare function maskPhone(phone: string): string;
/**
 * Mask a national ID for safe logging: 12-******A90
 */
export declare function maskNationalId(id: string): string;
/**
 * Recursively mask sensitive fields in a metadata object.
 */
export declare function maskSensitiveData(obj: unknown, depth?: number): unknown;
/**
 * Structured log entry matching CLAUDE.md logging standards:
 *   timestamp, level, service, requestId, action, status, duration, meta
 *
 * @param meta.action  - Operation identifier, e.g. "loan.apply", "payment.process"
 * @param meta.status  - "started" | "completed" | "failed"
 * @param meta.duration - Duration in milliseconds
 */
export declare function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
/**
 * Log an operation with automatic duration tracking.
 * Returns a function to call when the operation completes.
 */
export declare function startOperation(action: string, meta?: Record<string, unknown>): {
    succeed: (extraMeta?: Record<string, unknown>) => void;
    fail: (error: unknown, extraMeta?: Record<string, unknown>) => void;
};
export declare const logger: {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
    /** Set correlation context for the current Lambda invocation */
    setContext: typeof setRequestContext;
    /** Get current correlation context */
    getContext: typeof getRequestContext;
    /** Clear correlation context */
    clearContext: typeof clearRequestContext;
    /** Track an operation with automatic duration and status logging */
    startOperation: typeof startOperation;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map