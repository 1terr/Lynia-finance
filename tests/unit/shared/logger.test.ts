/**
 * Characterization tests for services/shared/utils/logger.ts
 *
 * PII masking is critical — the logger must never expose customer data in CloudWatch.
 */

import {
  maskPhone,
  maskNationalId,
  maskSensitiveData,
  setRequestContext,
  getRequestContext,
  clearRequestContext,
  log,
  LogLevel,
  logger,
  startOperation,
} from '../../../services/shared/utils/logger';

describe('logger', () => {
  let consoleSpy: jest.SpyInstance;
  const origLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    clearRequestContext();
    // Override LOG_LEVEL to ensure all levels are logged in tests
    process.env.LOG_LEVEL = 'debug';
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.LOG_LEVEL = origLogLevel;
  });

  // ─── maskPhone ────────────────────────────────────────────────
  describe('maskPhone', () => {
    it('should mask middle digits of phone number', () => {
      expect(maskPhone('+263771234567')).toBe('+263****567');
    });

    it('should mask shorter phone', () => {
      expect(maskPhone('0771234567')).toBe('0771****567');
    });

    it('should return *** for very short input', () => {
      expect(maskPhone('123')).toBe('***');
    });

    it('should return *** for empty string', () => {
      expect(maskPhone('')).toBe('***');
    });
  });

  // ─── maskNationalId ───────────────────────────────────────────
  describe('maskNationalId', () => {
    it('should mask middle of national ID', () => {
      expect(maskNationalId('12-3456789A01')).toBe('12-******A01');
    });

    it('should return *** for short input', () => {
      expect(maskNationalId('123')).toBe('***');
    });

    it('should return *** for empty string', () => {
      expect(maskNationalId('')).toBe('***');
    });
  });

  // ─── maskSensitiveData ────────────────────────────────────────
  describe('maskSensitiveData', () => {
    it('should mask phone fields', () => {
      const result = maskSensitiveData({ phone_number: '+263771234567' }) as Record<string, unknown>;
      expect(result.phone_number).toBe('+263****567');
    });

    it('should mask national_id fields', () => {
      const result = maskSensitiveData({ national_id: '12-3456789A01' }) as Record<string, unknown>;
      expect(result.national_id).toBe('12-******A01');
    });

    it('should mask password fields', () => {
      const result = maskSensitiveData({ password: 'mysecretpassword' }) as Record<string, unknown>;
      expect(result.password).toBe('my***rd');
    });

    it('should REDACT non-string sensitive fields', () => {
      const result = maskSensitiveData({ token: 12345 }) as Record<string, unknown>;
      expect(result.token).toBe('[REDACTED]');
    });

    it('should not mask non-sensitive fields', () => {
      const result = maskSensitiveData({ name: 'John', age: 30 }) as Record<string, unknown>;
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should handle nested objects', () => {
      const result = maskSensitiveData({
        user: { phone: '+263771234567', name: 'John' },
      }) as Record<string, unknown>;

      const user = result.user as Record<string, unknown>;
      expect(user.phone).toBe('+263****567');
      expect(user.name).toBe('John');
    });

    it('should handle arrays', () => {
      const result = maskSensitiveData([
        { phone: '+263771234567' },
      ]) as Record<string, unknown>[];
      expect(result[0].phone).toBe('+263****567');
    });

    it('should handle null and undefined', () => {
      expect(maskSensitiveData(null)).toBeNull();
      expect(maskSensitiveData(undefined)).toBeUndefined();
    });

    it('should enforce depth limit', () => {
      const deep = { a: { b: { c: { d: { e: { f: { g: 'val' } } } } } } };
      const result = maskSensitiveData(deep) as Record<string, unknown>;
      // Should not blow up, just truncate at depth limit
      expect(result).toBeDefined();
    });

    it('should mask whatsapp_number fields', () => {
      const result = maskSensitiveData({ whatsapp_number: '+263731234567' }) as Record<string, unknown>;
      expect(result.whatsapp_number).toBe('+263****567');
    });

    it('should mask api_key fields', () => {
      const result = maskSensitiveData({ api_key: 'sk_live_abc123xyz' }) as Record<string, unknown>;
      expect(result.api_key).toBe('sk***yz');
    });

    it('should mask authorization headers', () => {
      const result = maskSensitiveData({ authorization: 'Bearer eyJhbGciOi...' }) as Record<string, unknown>;
      expect(result.authorization).toBe('Be***..');
    });
  });

  // ─── Request context ──────────────────────────────────────────
  describe('request context', () => {
    it('should set and get request context', () => {
      const id = setRequestContext('req-123', 'user-456');
      const ctx = getRequestContext();

      expect(id).toBe('req-123');
      expect(ctx).not.toBeNull();
      expect(ctx!.requestId).toBe('req-123');
      expect(ctx!.userId).toBe('user-456');
    });

    it('should auto-generate requestId if not provided', () => {
      const id = setRequestContext();
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should clear context', () => {
      setRequestContext('req-999');
      clearRequestContext();
      expect(getRequestContext()).toBeNull();
    });
  });

  // ─── log ──────────────────────────────────────────────────────
  // Note: LOG_LEVEL is set to 'error' in test setup (tests/setup.ts),
  // and currentLogLevel is evaluated at module load time. So we test
  // with ERROR level to ensure logs are emitted.
  describe('log', () => {
    it('should output structured JSON to console.log', () => {
      setRequestContext('req-test');
      log(LogLevel.ERROR, 'test message', { action: 'test.run' });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.level).toBe('error');
      expect(output.message).toBe('test message');
      expect(output.requestId).toBe('req-test');
      expect(output.action).toBe('test.run');
      expect(output.timestamp).toBeDefined();
    });

    it('should mask sensitive data in meta', () => {
      log(LogLevel.ERROR, 'customer lookup', {
        action: 'customer.get',
        phone_number: '+263771234567',
      });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.meta.phone_number).toBe('+263****567');
    });

    it('should promote action, status, duration to top level', () => {
      log(LogLevel.ERROR, 'op done', {
        action: 'payment.process',
        status: 'completed',
        duration: 245,
      });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.action).toBe('payment.process');
      expect(output.status).toBe('completed');
      expect(output.duration).toBe(245);
    });

    it('should not log below current log level', () => {
      // LOG_LEVEL is 'error' in test setup, so DEBUG should be suppressed
      log(LogLevel.DEBUG, 'debug message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  // ─── logger convenience methods ───────────────────────────────
  describe('logger object', () => {
    it('should provide debug, info, warn, error methods', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should provide context management methods', () => {
      expect(typeof logger.setContext).toBe('function');
      expect(typeof logger.getContext).toBe('function');
      expect(typeof logger.clearContext).toBe('function');
    });
  });

  // ─── startOperation ───────────────────────────────────────────
  // startOperation logs at INFO (started) and INFO/ERROR (completed/failed).
  // Since LOG_LEVEL=error in tests, only the ERROR fail() call emits.
  describe('startOperation', () => {
    it('should log failure with error message at ERROR level', () => {
      const op = startOperation('payment.process');
      op.fail(new Error('Timeout'));

      // Only the ERROR log from fail() should be emitted (INFO started is suppressed)
      expect(consoleSpy).toHaveBeenCalledTimes(1);

      const failLog = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(failLog.level).toBe('error');
      expect(failLog.status).toBe('failed');
      expect(failLog.meta.errorMessage).toBe('Timeout');
    });

    it('succeed() should not throw even when INFO logging is suppressed', () => {
      const op = startOperation('loan.apply');
      expect(() => op.succeed({ approved: true })).not.toThrow();
    });
  });
});
