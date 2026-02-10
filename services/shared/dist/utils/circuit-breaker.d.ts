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
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface CircuitBreakerOptions {
    /** Number of consecutive failures before opening the circuit */
    failureThreshold: number;
    /** How long (ms) the circuit stays open before testing recovery */
    resetTimeout: number;
    /** Name of the service (used in logging) */
    name: string;
    /** Optional callback when circuit opens */
    onOpen?: (name: string, failureCount: number) => void;
    /** Optional callback when circuit closes (recovered) */
    onClose?: (name: string) => void;
}
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private nextAttemptTime;
    private options;
    constructor(options: Partial<CircuitBreakerOptions> & {
        name: string;
    });
    /**
     * Execute an async operation through the circuit breaker.
     * Throws if the circuit is open.
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    /** Current circuit state */
    getState(): CircuitState;
    /** Current failure count */
    getFailureCount(): number;
    /** Manually reset the circuit (e.g. after manual intervention) */
    reset(): void;
}
/**
 * Typed error thrown when the circuit is open
 */
export declare class CircuitOpenError extends Error {
    readonly serviceName: string;
    constructor(message: string, serviceName: string);
}
//# sourceMappingURL=circuit-breaker.d.ts.map