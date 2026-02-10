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

import { randomUUID } from 'crypto';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

const currentLogLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;

const logLevels: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
};

/**
 * Request context that propagates across all log entries within a
 * single Lambda invocation. Set via setRequestContext().
 */
interface RequestContext {
  requestId: string;
  service: string;
  userId?: string;
}

let _requestContext: RequestContext | null = null;

/**
 * Set the request context for the current invocation.
 * Call this at the beginning of every Lambda handler.
 *
 * @param requestId - Correlation ID from x-request-id header or auto-generated
 * @param userId - Authenticated user ID (optional)
 */
export function setRequestContext(requestId?: string, userId?: string): string {
  const id = requestId || randomUUID();
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
export function getRequestContext(): RequestContext | null {
  return _requestContext;
}

/**
 * Clear the request context. Called at the end of an invocation.
 */
export function clearRequestContext(): void {
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
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

/**
 * Mask a national ID for safe logging: 12-******A90
 */
export function maskNationalId(id: string): string {
  if (!id || id.length < 6) return '***';
  return id.slice(0, 3) + '******' + id.slice(-3);
}

/**
 * Mask a generic sensitive string: show first 2 and last 2 chars
 */
function maskGeneric(value: string): string {
  if (!value || value.length < 5) return '***';
  return value.slice(0, 2) + '***' + value.slice(-2);
}

/**
 * Recursively mask sensitive fields in a metadata object.
 */
export function maskSensitiveData(obj: unknown, depth: number = 0): unknown {
  if (depth > 5) return '[DEPTH_LIMIT]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern => lowerKey.includes(pattern));

    if (isSensitive && typeof value === 'string') {
      if (lowerKey.includes('phone') || lowerKey.includes('whatsapp')) {
        masked[key] = maskPhone(value);
      } else if (lowerKey.includes('national_id') || lowerKey.includes('id_number')) {
        masked[key] = maskNationalId(value);
      } else {
        masked[key] = maskGeneric(value);
      }
    } else if (isSensitive) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function shouldLog(level: LogLevel): boolean {
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
export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const ctx = _requestContext;

  const logEntry: Record<string, unknown> = {
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
    if (meta.action) logEntry.action = meta.action;
    if (meta.status) logEntry.status = meta.status;
    if (meta.duration !== undefined) logEntry.duration = meta.duration;

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
export function startOperation(action: string, meta?: Record<string, unknown>): {
  succeed: (extraMeta?: Record<string, unknown>) => void;
  fail: (error: unknown, extraMeta?: Record<string, unknown>) => void;
} {
  const startTime = Date.now();

  log(LogLevel.INFO, `${action} started`, { action, status: 'started', ...meta });

  return {
    succeed: (extraMeta?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      log(LogLevel.INFO, `${action} completed`, {
        action,
        status: 'completed',
        duration,
        ...meta,
        ...extraMeta,
      });
    },
    fail: (error: unknown, extraMeta?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error
        ? (error as Error & { code: string }).code
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

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log(LogLevel.DEBUG, message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log(LogLevel.INFO, message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log(LogLevel.WARN, message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log(LogLevel.ERROR, message, meta),

  /** Set correlation context for the current Lambda invocation */
  setContext: setRequestContext,
  /** Get current correlation context */
  getContext: getRequestContext,
  /** Clear correlation context */
  clearContext: clearRequestContext,
  /** Track an operation with automatic duration and status logging */
  startOperation,
};

export default logger;
