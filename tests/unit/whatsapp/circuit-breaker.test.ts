/**
 * Tests for Circuit Breaker Pattern (T011)
 *
 * Covers:
 *   - CLOSED state: successful calls pass through, failures increment count
 *   - CLOSED -> OPEN transition after failureThreshold consecutive failures
 *   - OPEN state: immediate rejection with CircuitOpenError
 *   - OPEN -> HALF_OPEN transition after resetTimeout elapses
 *   - HALF_OPEN -> CLOSED on success (recovery)
 *   - HALF_OPEN -> OPEN on failure (re-trip)
 *   - Manual reset via reset()
 *   - onOpen / onClose callback invocations
 */

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  CircuitBreaker,
  CircuitOpenError,
} from '../../../services/shared/utils/circuit-breaker';

// ===================================================================
// TESTS
// ===================================================================

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------
  // CLOSED state behavior
  // -----------------------------------------------------------------
  it('should pass through successful calls in CLOSED state', async () => {
    const breaker = new CircuitBreaker({ name: 'test-service' });

    const result = await breaker.execute(() => Promise.resolve('success'));

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('should increment failure count on failed calls in CLOSED state', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 5,
    });

    await expect(
      breaker.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow('fail');

    expect(breaker.getFailureCount()).toBe(1);
    expect(breaker.getState()).toBe('CLOSED');
  });

  // -----------------------------------------------------------------
  // CLOSED -> OPEN transition
  // -----------------------------------------------------------------
  it('should transition to OPEN after reaching failureThreshold', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      resetTimeout: 10000,
    });

    for (let i = 0; i < 3; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error(`fail-${i}`)))
      ).rejects.toThrow();
    }

    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.getFailureCount()).toBe(3);
  });

  // -----------------------------------------------------------------
  // OPEN state behavior
  // -----------------------------------------------------------------
  it('should immediately reject with CircuitOpenError when OPEN', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 2,
      resetTimeout: 60000,
    });

    // Trip the breaker
    for (let i = 0; i < 2; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
    }
    expect(breaker.getState()).toBe('OPEN');

    // Next call should throw CircuitOpenError without invoking the function
    const fn = jest.fn();
    await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should include service name in CircuitOpenError', async () => {
    const breaker = new CircuitBreaker({
      name: 'ecocash-api',
      failureThreshold: 1,
      resetTimeout: 60000,
    });

    await expect(
      breaker.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();

    try {
      await breaker.execute(() => Promise.resolve('should not reach'));
      fail('Expected CircuitOpenError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect((error as CircuitOpenError).serviceName).toBe('ecocash-api');
    }
  });

  // -----------------------------------------------------------------
  // OPEN -> HALF_OPEN transition
  // -----------------------------------------------------------------
  it('should transition to HALF_OPEN after resetTimeout elapses', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 1,
      resetTimeout: 5000,
    });

    // Trip the breaker
    await expect(
      breaker.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    // Advance time past the resetTimeout
    jest.advanceTimersByTime(6000);

    // Next call should go through (HALF_OPEN allows one attempt)
    const result = await breaker.execute(() => Promise.resolve('recovered'));

    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('CLOSED');

    jest.useRealTimers();
  });

  // -----------------------------------------------------------------
  // HALF_OPEN -> CLOSED (success recovers)
  // -----------------------------------------------------------------
  it('should transition from HALF_OPEN to CLOSED on successful call', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 1,
      resetTimeout: 1000,
    });

    // Trip the breaker
    await expect(
      breaker.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();

    // Advance time to allow HALF_OPEN
    jest.advanceTimersByTime(1500);

    // Successful call should close the circuit
    await breaker.execute(() => Promise.resolve('ok'));

    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.getFailureCount()).toBe(0);

    jest.useRealTimers();
  });

  // -----------------------------------------------------------------
  // HALF_OPEN -> OPEN (failure re-trips)
  // -----------------------------------------------------------------
  it('should transition from HALF_OPEN back to OPEN on failed call', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      resetTimeout: 1000,
    });

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
    }
    expect(breaker.getState()).toBe('OPEN');

    // Advance time to allow HALF_OPEN
    jest.advanceTimersByTime(1500);

    // Fail during HALF_OPEN -> should re-open
    await expect(
      breaker.execute(() => Promise.reject(new Error('still failing')))
    ).rejects.toThrow('still failing');

    expect(breaker.getState()).toBe('OPEN');

    jest.useRealTimers();
  });

  // -----------------------------------------------------------------
  // Manual reset
  // -----------------------------------------------------------------
  it('should reset state to CLOSED with zero failures via reset()', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 1,
      resetTimeout: 60000,
    });

    // Trip the breaker
    await expect(
      breaker.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    // Manual reset
    breaker.reset();

    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.getFailureCount()).toBe(0);

    // Should work normally after reset
    const result = await breaker.execute(() => Promise.resolve('works again'));
    expect(result).toBe('works again');
  });

  // -----------------------------------------------------------------
  // Callbacks: onOpen and onClose
  // -----------------------------------------------------------------
  it('should fire onOpen callback when circuit opens', async () => {
    const onOpen = jest.fn();

    const breaker = new CircuitBreaker({
      name: 'whatsapp-api',
      failureThreshold: 2,
      resetTimeout: 5000,
      onOpen,
    });

    for (let i = 0; i < 2; i++) {
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
    }

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('whatsapp-api', 2);
  });

  it('should fire onClose callback when circuit recovers from HALF_OPEN', async () => {
    jest.useFakeTimers();

    const onClose = jest.fn();

    const breaker = new CircuitBreaker({
      name: 'whatsapp-api',
      failureThreshold: 1,
      resetTimeout: 1000,
      onClose,
    });

    // Trip the breaker
    await expect(
      breaker.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();

    // Advance past resetTimeout for HALF_OPEN
    jest.advanceTimersByTime(1500);

    // Recover
    await breaker.execute(() => Promise.resolve('recovered'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('whatsapp-api');

    jest.useRealTimers();
  });
});
