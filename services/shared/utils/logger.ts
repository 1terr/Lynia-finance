/**
 * Logger Utility
 * Standardized logging across all microservices
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

function shouldLog(level: LogLevel): boolean {
  return logLevels[level] >= logLevels[currentLogLevel];
}

export function log(level: LogLevel, message: string, meta?: any): void {
  if (!shouldLog(level)) return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    ...(meta && { meta })
  };

  console.log(JSON.stringify(logEntry));
}

export const logger = {
  debug: (message: string, meta?: any) => log(LogLevel.DEBUG, message, meta),
  info: (message: string, meta?: any) => log(LogLevel.INFO, message, meta),
  warn: (message: string, meta?: any) => log(LogLevel.WARN, message, meta),
  error: (message: string, meta?: any) => log(LogLevel.ERROR, message, meta)
};

export default logger;
