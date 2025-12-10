/**
 * Logger Utility
 * Standardized logging across all microservices
 */
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export declare function log(level: LogLevel, message: string, meta?: any): void;
export declare const logger: {
    debug: (message: string, meta?: any) => void;
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map