"use strict";
/**
 * Logger Utility
 * Standardized logging across all microservices
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
exports.log = log;
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
function shouldLog(level) {
    return logLevels[level] >= logLevels[currentLogLevel];
}
function log(level, message, meta) {
    if (!shouldLog(level))
        return;
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
exports.logger = {
    debug: (message, meta) => log(LogLevel.DEBUG, message, meta),
    info: (message, meta) => log(LogLevel.INFO, message, meta),
    warn: (message, meta) => log(LogLevel.WARN, message, meta),
    error: (message, meta) => log(LogLevel.ERROR, message, meta)
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map