/**
 * Characterization tests for services/shared/utils/circuit-breaker.ts
 *
 * Protects against cascading failures when external APIs go down.
 */

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { CircuitBreaker, CircuitOpenError } from '../../../services/shared/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ name: 'test-service', failureThreshold: 3, resetTimeout: 100 });
  });

  // ─── Initial state ────────────────────────────────────────────
  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should start with zero failures', () => {
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  // ─── Closed state behavior ────────────────────────────────────
  describe('CLOSED state', () => {
    it('should pass through successful calls', async () => {
      const result = await cb.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should increment failure count on error', async () => {
      try {
        await cb.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // expected
      }
      expect(cb.getFailureCount()).toBe(1);
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should remain closed below failure threshold', async () => {
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getFailureCount()).toBe(2);
    });
  });

  // ─── Open state behavior ──────────────────────────────────────
  describe('OPEN state', () => {
    it('should open after reaching failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }
      expect(cb.getState()).toBe('OPEN');
    });

    it('should throw CircuitOpenError when open', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }

      await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
    });

    it('should include service name in CircuitOpenError', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }

      try {
        await cb.execute(() => Promise.resolve('ok'));
        fail('Expected CircuitOpenError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).serviceName).toBe('test-service');
      }
    });
  });

  // ─── Half-open state behavior ─────────────────────────────────
  describe('HALF_OPEN state', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }
      expect(cb.getState()).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should transition to HALF_OPEN then succeed
      const result = await cb.execute(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should return to OPEN if HALF_OPEN call fails', async () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fail during HALF_OPEN
      try {
        await cb.execute(() => Promise.reject(new Error('still failing')));
      } catch {
        // expected
      }

      expect(cb.getState()).toBe('OPEN');
    });
  });

  // ─── Reset ────────────────────────────────────────────────────
  describe('reset', () => {
    it('should reset to CLOSED with zero failures', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }
      expect(cb.getState()).toBe('OPEN');

      cb.reset();

      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  // ─── Success resets failure count ─────────────────────────────
  describe('success recovery', () => {
    it('should reset failure count on success', async () => {
      // Accumulate some failures
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }
      expect(cb.getFailureCount()).toBe(2);

      // Successful call
      await cb.execute(() => Promise.resolve('ok'));
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  // ─── Callbacks ────────────────────────────────────────────────
  describe('callbacks', () => {
    it('should invoke onOpen callback when circuit opens', async () => {
      const onOpen = jest.fn();
      const breaker = new CircuitBreaker({ name: 'cb-test', failureThreshold: 2, resetTimeout: 100, onOpen });

      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }

      expect(onOpen).toHaveBeenCalledWith('cb-test', 2);
    });

    it('should invoke onClose callback when circuit recovers', async () => {
      const onClose = jest.fn();
      const breaker = new CircuitBreaker({ name: 'cb-test', failureThreshold: 2, resetTimeout: 50, onClose });

      // Trip
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // expected
        }
      }

      // Wait and recover
      await new Promise(resolve => setTimeout(resolve, 100));
      await breaker.execute(() => Promise.resolve('ok'));

      expect(onClose).toHaveBeenCalledWith('cb-test');
    });
  });
});
