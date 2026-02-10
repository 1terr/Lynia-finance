"use strict";
/**
 * Circuit Breaker Pattern (T011)
 *
 * Protects against cascading failures when calling external APIs
 * (Fineract, Smile Identity, EcoCash, OneMoney, WhatsApp Cloud API).
 *
 * States:
 *  CLOSED   - Normal operation, requests pass through
 *  OPEN     - Service failing, requests short-circuit immediately
 *  HALF_OPEN - Testing if service recovered, allows one request through
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitOpenError = exports.CircuitBreaker = void 0;
const DEFAULT_OPTIONS = {
    failureThreshold: 5,
    resetTimeout: 60000,
    name: 'unknown',
};
class CircuitBreaker {
    constructor(options) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.nextAttemptTime = 0;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Execute an async operation through the circuit breaker.
     * Throws if the circuit is open.
     */
    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttemptTime) {
                throw new CircuitOpenError(`Circuit breaker "${this.options.name}" is OPEN - service unavailable`, this.options.name);
            }
            this.state = 'HALF_OPEN';
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.options.onClose?.(this.options.name);
            console.log(`Circuit breaker "${this.options.name}" CLOSED (recovered)`);
        }
    }
    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.options.failureThreshold || this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.options.resetTimeout;
            this.options.onOpen?.(this.options.name, this.failureCount);
            console.error(`Circuit breaker "${this.options.name}" OPEN after ${this.failureCount} failures. ` +
                `Will retry after ${this.options.resetTimeout}ms.`);
        }
    }
    /** Current circuit state */
    getState() {
        return this.state;
    }
    /** Current failure count */
    getFailureCount() {
        return this.failureCount;
    }
    /** Manually reset the circuit (e.g. after manual intervention) */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.nextAttemptTime = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Typed error thrown when the circuit is open
 */
class CircuitOpenError extends Error {
    constructor(message, serviceName) {
        super(message);
        this.name = 'CircuitOpenError';
        this.serviceName = serviceName;
    }
}
exports.CircuitOpenError = CircuitOpenError;
//# sourceMappingURL=circuit-breaker.js.map