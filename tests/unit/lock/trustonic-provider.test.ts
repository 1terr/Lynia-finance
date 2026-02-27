/**
 * Characterization tests for services/lock-service/src/trustonic-provider.ts
 *
 * Trustonic API integration -- device enrollment, lock/unlock, status checks.
 * Supports sandbox (mock) and production modes. Uses circuit breaker for
 * resilience and HMAC signatures for API authentication.
 */

// Set environment variables before importing to prevent requireEnv from throwing
process.env.TRUSTONIC_API_KEY = 'test-api-key';
process.env.TRUSTONIC_API_SECRET = 'test-api-secret';
process.env.TRUSTONIC_BASE_URL = 'https://api.trustonic.test/v1';
process.env.TRUSTONIC_ENV = 'sandbox';

// Mock external dependencies before importing
jest.mock('../../../services/shared/utils/require-env', () => ({
  requireEnv: jest.fn().mockImplementation((name: string) => {
    const envMap: Record<string, string> = {
      TRUSTONIC_API_KEY: 'test-api-key',
      TRUSTONIC_API_SECRET: 'test-api-secret',
    };
    return envMap[name] || `mock-${name}`;
  }),
}));

jest.mock('../../../services/shared/utils/circuit-breaker', () => ({
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
    getState: jest.fn().mockReturnValue('CLOSED'),
    reset: jest.fn(),
  })),
  CircuitOpenError: class extends Error {
    serviceName: string;
    constructor(message: string, serviceName: string) {
      super(message);
      this.serviceName = serviceName;
    }
  },
}));

jest.mock('axios', () => {
  const mockAxiosInstance = {
    post: jest.fn().mockResolvedValue({ data: { device_id: 'trustonic-123', status: 'ok' } }),
    get: jest.fn().mockResolvedValue({
      data: {
        lock_status: 'unlocked',
        can_emergency_call: true,
        locked_at: null,
        unlocked_at: null,
        lock_reason: null,
      },
    }),
  };
  const mockAxios = {
    create: jest.fn().mockReturnValue(mockAxiosInstance),
    isAxiosError: jest.fn().mockReturnValue(false),
    __mockInstance: mockAxiosInstance,
  };
  return {
    __esModule: true,
    default: mockAxios,
  };
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn(), startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }) },
}));

import { TrustonicProvider } from '../../../services/lock-service/src/trustonic-provider';
const axios = require('axios').default;

describe('TrustonicProvider', () => {
  let provider: TrustonicProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRUSTONIC_ENV = 'sandbox';
    provider = new TrustonicProvider();
  });

  // ─── Constructor ───────────────────────────────────────────
  describe('constructor', () => {
    it('should initialize with config from environment', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.any(String),
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': expect.any(String),
          }),
        })
      );
    });
  });

  // ─── enrollDevice ──────────────────────────────────────────
  describe('enrollDevice', () => {
    it('should return mock enrollment in sandbox mode', async () => {
      const result = await provider.enrollDevice('dev-001', '123456789012345', 'cust-001');

      expect(result.device_id).toBe('dev-001');
      expect(result.imei).toBe('123456789012345');
      expect(result.customer_reference).toBe('cust-001');
      expect(result.trustonic_device_id).toBe('trustonic_dev-001');
      expect(result.enrollment_status).toBe('enrolled');
      expect(result.enrolled_at).toBeInstanceOf(Date);
    });

    it('should call Trustonic API in production mode', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      const result = await prodProvider.enrollDevice('dev-002', '999999999999999', 'cust-002');

      expect(result.device_id).toBe('dev-002');
      expect(result.enrollment_status).toBe('enrolled');
      expect(result.trustonic_device_id).toBe('trustonic-123');
    });

    it('should handle Axios error in production mode', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      const axiosError = new Error('Network error');
      (axiosError as Record<string, unknown>).response = { data: { message: 'Service unavailable' } };
      axios.isAxiosError.mockReturnValueOnce(true);
      axios.__mockInstance.post.mockRejectedValueOnce(axiosError);

      await expect(
        prodProvider.enrollDevice('dev-003', '111111111111111', 'cust-003')
      ).rejects.toThrow('Trustonic enrollment failed');
    });

    it('should handle non-Axios error in production mode', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      axios.__mockInstance.post.mockRejectedValueOnce(new Error('Unknown error'));
      axios.isAxiosError.mockReturnValueOnce(false);

      await expect(
        prodProvider.enrollDevice('dev-004', '222222222222222', 'cust-004')
      ).rejects.toThrow('Device enrollment failed');
    });
  });

  // ─── lockDevice ────────────────────────────────────────────
  describe('lockDevice', () => {
    const lockRequest = {
      device_id: 'tdev-001',
      imei: '123456789012345',
      lock_message: 'Payment overdue',
      lock_reason: 'missed_payment',
      allow_emergency_calls: true,
      emergency_numbers: ['999', '994'],
    };

    it('should simulate lock in sandbox mode', async () => {
      await provider.lockDevice(lockRequest);

      // In sandbox, it should not call the actual API
      expect(axios.__mockInstance.post).not.toHaveBeenCalled();
    });

    it('should call Trustonic API in production mode', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      await prodProvider.lockDevice(lockRequest);

      expect(axios.__mockInstance.post).toHaveBeenCalledWith(
        `/devices/${lockRequest.device_id}/lock`,
        expect.objectContaining({
          device_id: lockRequest.device_id,
          lock_message: lockRequest.lock_message,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Signature': expect.any(String),
          }),
        })
      );
    });

    it('should handle Axios error during lock', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      const axiosError = new Error('Timeout');
      (axiosError as Record<string, unknown>).response = { data: { message: 'Lock timeout' } };
      axios.isAxiosError.mockReturnValueOnce(true);
      axios.__mockInstance.post.mockRejectedValueOnce(axiosError);

      await expect(prodProvider.lockDevice(lockRequest)).rejects.toThrow('Trustonic lock failed');
    });

    it('should handle non-Axios error during lock', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      axios.__mockInstance.post.mockRejectedValueOnce(new Error('Generic error'));
      axios.isAxiosError.mockReturnValueOnce(false);

      await expect(prodProvider.lockDevice(lockRequest)).rejects.toThrow('Device lock failed');
    });
  });

  // ─── unlockDevice ──────────────────────────────────────────
  describe('unlockDevice', () => {
    const unlockRequest = {
      device_id: 'tdev-001',
      unlock_reason: 'payment_received',
    };

    it('should simulate unlock in sandbox mode', async () => {
      await provider.unlockDevice(unlockRequest);

      expect(axios.__mockInstance.post).not.toHaveBeenCalled();
    });

    it('should call Trustonic API in production mode', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      await prodProvider.unlockDevice(unlockRequest);

      expect(axios.__mockInstance.post).toHaveBeenCalledWith(
        `/devices/${unlockRequest.device_id}/unlock`,
        expect.objectContaining({
          device_id: unlockRequest.device_id,
          unlock_reason: unlockRequest.unlock_reason,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Signature': expect.any(String),
          }),
        })
      );
    });

    it('should handle Axios error during unlock', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      const axiosError = new Error('Unauthorized');
      (axiosError as Record<string, unknown>).response = { data: { message: 'Invalid credentials' } };
      axios.isAxiosError.mockReturnValueOnce(true);
      axios.__mockInstance.post.mockRejectedValueOnce(axiosError);

      await expect(prodProvider.unlockDevice(unlockRequest)).rejects.toThrow('Trustonic unlock failed');
    });

    it('should handle non-Axios error during unlock', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      axios.__mockInstance.post.mockRejectedValueOnce(new Error('Unknown'));
      axios.isAxiosError.mockReturnValueOnce(false);

      await expect(prodProvider.unlockDevice(unlockRequest)).rejects.toThrow('Device unlock failed');
    });
  });

  // ─── getLockStatus ─────────────────────────────────────────
  describe('getLockStatus', () => {
    it('should return mock status in sandbox mode', async () => {
      const status = await provider.getLockStatus('tdev-001');

      expect(status.device_id).toBe('tdev-001');
      expect(status.lock_status).toBe('unlocked');
      expect(status.can_emergency_call).toBe(true);
    });

    it('should call Trustonic API in production mode', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      const status = await prodProvider.getLockStatus('tdev-002');

      expect(status.device_id).toBe('tdev-002');
      expect(axios.__mockInstance.get).toHaveBeenCalledWith('/devices/tdev-002/status');
    });

    it('should handle production API response with timestamps', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      axios.__mockInstance.get.mockResolvedValueOnce({
        data: {
          lock_status: 'locked',
          locked_at: '2024-01-15T10:00:00Z',
          unlocked_at: null,
          lock_reason: 'overdue',
          can_emergency_call: true,
        },
      });

      const status = await prodProvider.getLockStatus('tdev-003');

      expect(status.lock_status).toBe('locked');
      expect(status.locked_at).toBeInstanceOf(Date);
      expect(status.lock_reason).toBe('overdue');
    });

    it('should throw on error', async () => {
      process.env.TRUSTONIC_ENV = 'production';
      const prodProvider = new TrustonicProvider();

      axios.__mockInstance.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(prodProvider.getLockStatus('tdev-004')).rejects.toThrow('Failed to get lock status');
    });
  });

  // ─── generateLockMessage ───────────────────────────────────
  describe('generateLockMessage', () => {
    it('should include the reason and contact info', () => {
      const msg = provider.generateLockMessage('missed payment');

      expect(msg).toContain('missed payment');
      expect(msg).toContain('Lynia Finance');
      expect(msg).toContain('+263');
      expect(msg).toContain('Emergency calls');
    });

    it('should include payment overdue prefix', () => {
      const msg = provider.generateLockMessage('severe default');

      expect(msg).toContain('Payment overdue');
    });
  });

  // ─── getEmergencyNumbers ───────────────────────────────────
  describe('getEmergencyNumbers', () => {
    it('should return Zimbabwe emergency numbers', () => {
      const numbers = provider.getEmergencyNumbers();

      expect(numbers).toContain('999');
      expect(numbers).toContain('994');
      expect(numbers).toContain('993');
      expect(numbers).toContain('112');
      expect(numbers).toHaveLength(4);
    });
  });
});
