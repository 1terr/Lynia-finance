/**
 * Logger Utility
 * Standardized logging across all microservices
 *
 * Security: Automatically masks PII fields to prevent sensitive data
 * from appearing in CloudWatch logs.
 */

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

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    ...(meta && { meta: maskSensitiveData(meta) })
  };

  console.log(JSON.stringify(logEntry));
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log(LogLevel.DEBUG, message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log(LogLevel.INFO, message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log(LogLevel.WARN, message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log(LogLevel.ERROR, message, meta)
};

export default logger;
