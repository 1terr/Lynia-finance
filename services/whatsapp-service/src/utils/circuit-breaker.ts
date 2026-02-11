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

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 60000,
  name: 'unknown',
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttemptTime = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> & { name: string }) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute an async operation through the circuit breaker.
   * Throws if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitOpenError(
          `Circuit breaker "${this.options.name}" is OPEN - service unavailable`,
          this.options.name
        );
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.options.onClose?.(this.options.name);
      console.log(`Circuit breaker "${this.options.name}" CLOSED (recovered)`);
    }
  }

  private onFailure(): void {
    this.failureCount++;

    if (this.failureCount >= this.options.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.options.resetTimeout;
      this.options.onOpen?.(this.options.name, this.failureCount);
      console.error(
        `Circuit breaker "${this.options.name}" OPEN after ${this.failureCount} failures. ` +
        `Will retry after ${this.options.resetTimeout}ms.`
      );
    }
  }

  /** Current circuit state */
  getState(): CircuitState {
    return this.state;
  }

  /** Current failure count */
  getFailureCount(): number {
    return this.failureCount;
  }

  /** Manually reset the circuit (e.g. after manual intervention) */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = 0;
  }
}

/**
 * Typed error thrown when the circuit is open
 */
export class CircuitOpenError extends Error {
  public readonly serviceName: string;

  constructor(message: string, serviceName: string) {
    super(message);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
  }
}
