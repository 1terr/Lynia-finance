/**
 * Characterization tests for services/lock-service/src/device-monitoring.ts
 *
 * Device health monitoring -- checks battery, storage, connectivity, tampering
 * detection. Generates alerts and health scores. Supports batch health checks
 * and filtering devices needing attention.
 */

// Mock all external dependencies before importing
jest.mock('../../../services/shared/clients/database', () => {
  const mockExecute = jest.fn().mockResolvedValue({ data: [], error: null });
  const createChain = () => {
    const chain: Record<string, jest.Mock> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or', 'order', 'limit', 'single', 'maybeSingle'];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    chain.execute = mockExecute;
    return chain;
  };
  return {
    db: { from: jest.fn().mockImplementation(() => createChain()) },
    __mockExecute: mockExecute,
  };
});

jest.mock('../../../services/shared/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn(), startOperation: jest.fn().mockReturnValue({ succeed: jest.fn(), fail: jest.fn() }) },
}));

import { checkDeviceHealth, batchHealthCheck, getDevicesNeedingAttention } from '../../../services/lock-service/src/device-monitoring';
const { db, __mockExecute } = require('../../../services/shared/clients/database');

describe('Device Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __mockExecute.mockReset();
  });

  // ─── checkDeviceHealth ─────────────────────────────────────
  describe('checkDeviceHealth', () => {
    it('should throw when device is not found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      await expect(checkDeviceHealth('dev-missing')).rejects.toThrow('Device not found');
    });

    it('should return healthy report for device with good stats', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-001',
            imei: '123456789012345',
            battery_health_percent: 95,
            battery_level_percent: 80,
            storage_used_percent: 40,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
            lock_status: 'unlocked',
            trustonic_enrollment_status: 'enrolled',
            os_version: 'Android 14',
            network_type: 'cellular',
            signal_strength: 80,
            storage_total_gb: 64,
            storage_used_gb: 25,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // insert health check

      const report = await checkDeviceHealth('dev-001');

      expect(report.device_id).toBe('dev-001');
      expect(report.health_score).toBeGreaterThanOrEqual(80);
      expect(report.alerts).toHaveLength(0);
      expect(report.is_online).toBe(true);
      expect(report.battery_health_percent).toBe(95);
      expect(report.storage_used_percent).toBe(40);
    });

    it('should generate battery_low alert when battery health is below 70', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-002',
            imei: '222222222222222',
            battery_health_percent: 60,
            battery_level_percent: 50,
            storage_used_percent: 30,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
            lock_status: 'unlocked',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-002');

      const batteryAlert = report.alerts.find(a => a.type === 'battery_low');
      expect(batteryAlert).toBeDefined();
      expect(batteryAlert!.severity).toBe('warning');
      expect(batteryAlert!.message).toContain('60%');
    });

    it('should generate critical battery alert when below 50', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-003',
            imei: '333333333333333',
            battery_health_percent: 40,
            battery_level_percent: 20,
            storage_used_percent: 30,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-003');

      const batteryAlert = report.alerts.find(a => a.type === 'battery_low');
      expect(batteryAlert).toBeDefined();
      expect(batteryAlert!.severity).toBe('critical');
    });

    it('should generate storage_full alert when storage exceeds 90%', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-004',
            imei: '444444444444444',
            battery_health_percent: 90,
            battery_level_percent: 70,
            storage_used_percent: 92,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-004');

      const storageAlert = report.alerts.find(a => a.type === 'storage_full');
      expect(storageAlert).toBeDefined();
      expect(storageAlert!.severity).toBe('warning');
      expect(storageAlert!.message).toContain('92%');
    });

    it('should generate critical storage alert when above 95%', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-005',
            imei: '555555555555555',
            battery_health_percent: 90,
            storage_used_percent: 97,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-005');

      const storageAlert = report.alerts.find(a => a.type === 'storage_full');
      expect(storageAlert!.severity).toBe('critical');
    });

    it('should generate offline alert when device not seen for 72+ hours', async () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-006',
            imei: '666666666666666',
            battery_health_percent: 90,
            storage_used_percent: 30,
            last_seen_at: fourDaysAgo.toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-006');

      const offlineAlert = report.alerts.find(a => a.type === 'offline');
      expect(offlineAlert).toBeDefined();
      expect(offlineAlert!.severity).toBe('warning');
      expect(report.is_online).toBe(false);
    });

    it('should generate critical offline alert when device not seen for 168+ hours', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-007',
            imei: '777777777777777',
            battery_health_percent: 90,
            storage_used_percent: 30,
            last_seen_at: eightDaysAgo.toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-007');

      const offlineAlert = report.alerts.find(a => a.type === 'offline');
      expect(offlineAlert!.severity).toBe('critical');
    });

    it('should generate factory_reset alert when detected', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-008',
            imei: '888888888888888',
            battery_health_percent: 90,
            storage_used_percent: 30,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: true,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-008');

      const resetAlert = report.alerts.find(a => a.type === 'factory_reset');
      expect(resetAlert).toBeDefined();
      expect(resetAlert!.severity).toBe('critical');
      expect(report.health_score).toBeLessThanOrEqual(50);
    });

    it('should generate sim_changed alert when SIM was changed', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-009',
            imei: '999999999999999',
            battery_health_percent: 90,
            storage_used_percent: 30,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-009');

      const simAlert = report.alerts.find(a => a.type === 'sim_changed');
      expect(simAlert).toBeDefined();
      expect(simAlert!.severity).toBe('warning');
      expect(report.sim_status).toBe('changed');
    });

    it('should use default values when device fields are missing', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-010',
            imei: '101010101010101',
            // Missing optional fields
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-010');

      expect(report.battery_health_percent).toBe(95);
      expect(report.battery_level_percent).toBe(70);
      expect(report.storage_used_percent).toBe(40);
      expect(report.storage_total_gb).toBe(32);
      expect(report.os_version).toBe('Android 13');
      expect(report.network_type).toBe('cellular');
    });

    it('should store health check report in database', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-011',
            imei: '111111111111111',
            battery_health_percent: 90,
            storage_used_percent: 50,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // insert health check

      await checkDeviceHealth('dev-011');

      expect(db.from).toHaveBeenCalledWith('device_health_checks');
    });

    it('should calculate correct health score with multiple issues', async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-012',
            imei: '121212121212121',
            battery_health_percent: 60, // -20 from 80
            storage_used_percent: 85,   // -5 from 80
            last_seen_at: fiveDaysAgo.toISOString(), // some penalty
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-012');

      // Health score should be reduced
      expect(report.health_score).toBeLessThan(80);
      expect(report.alerts.length).toBeGreaterThan(0);
    });

    it('should clamp health score between 0 and 100', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      __mockExecute
        .mockResolvedValueOnce({
          data: {
            id: 'dev-013',
            imei: '131313131313131',
            battery_health_percent: 20,  // very low
            storage_used_percent: 99,    // nearly full
            last_seen_at: thirtyDaysAgo.toISOString(), // very offline
            factory_reset_detected: true, // tampered
            sim_changed: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const report = await checkDeviceHealth('dev-013');

      expect(report.health_score).toBeGreaterThanOrEqual(0);
      expect(report.health_score).toBeLessThanOrEqual(100);
    });
  });

  // ─── batchHealthCheck ──────────────────────────────────────
  describe('batchHealthCheck', () => {
    it('should return zeros when no devices found', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const result = await batchHealthCheck();

      expect(result).toEqual({ checked: 0, healthy: 0, warnings: 0, critical: 0 });
    });

    it('should return zeros for empty device list', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await batchHealthCheck();

      expect(result).toEqual({ checked: 0, healthy: 0, warnings: 0, critical: 0 });
    });

    it('should categorize healthy devices correctly', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'dev-001' }],
          error: null,
        }) // device list
        // checkDeviceHealth for dev-001:
        .mockResolvedValueOnce({
          data: {
            id: 'dev-001',
            imei: '111111111111111',
            battery_health_percent: 95,
            storage_used_percent: 30,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // insert health check

      const result = await batchHealthCheck();

      expect(result.checked).toBe(1);
      expect(result.healthy).toBe(1);
    });

    it('should categorize critical devices correctly', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'dev-002' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'dev-002',
            imei: '222222222222222',
            battery_health_percent: 30,
            storage_used_percent: 98,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: true,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await batchHealthCheck();

      expect(result.checked).toBe(1);
      expect(result.critical).toBe(1);
    });

    it('should categorize warning devices correctly', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'dev-003' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'dev-003',
            imei: '333333333333333',
            battery_health_percent: 55,
            storage_used_percent: 50,
            last_seen_at: new Date().toISOString(),
            factory_reset_detected: false,
            sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const result = await batchHealthCheck();

      expect(result.checked).toBe(1);
      expect(result.warnings).toBe(1);
    });

    it('should handle health check failure for individual devices', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'dev-fail' }],
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // device not found

      const result = await batchHealthCheck();

      // Device check failed, should not increment checked
      expect(result.checked).toBe(0);
    });

    it('should handle mix of healthy, warning, and critical devices', async () => {
      __mockExecute
        .mockResolvedValueOnce({
          data: [{ id: 'dev-a' }, { id: 'dev-b' }],
          error: null,
        })
        // dev-a: healthy
        .mockResolvedValueOnce({
          data: {
            id: 'dev-a', imei: 'aaa', battery_health_percent: 95,
            storage_used_percent: 30, last_seen_at: new Date().toISOString(),
            factory_reset_detected: false, sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // insert health
        // dev-b: critical (factory reset)
        .mockResolvedValueOnce({
          data: {
            id: 'dev-b', imei: 'bbb', battery_health_percent: 40,
            storage_used_percent: 96, last_seen_at: new Date().toISOString(),
            factory_reset_detected: true, sim_changed: false,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // insert health

      const result = await batchHealthCheck();

      expect(result.checked).toBe(2);
      expect(result.healthy).toBe(1);
      expect(result.critical).toBe(1);
    });
  });

  // ─── getDevicesNeedingAttention ────────────────────────────
  describe('getDevicesNeedingAttention', () => {
    it('should return empty array when no devices need attention', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      const result = await getDevicesNeedingAttention();

      expect(result).toEqual([]);
    });

    it('should return devices with low health scores', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          {
            device_id: 'dev-001',
            health_score: 40,
            critical_alerts: 2,
            checked_at: '2024-01-15T10:00:00Z',
            devices: { imei: '111111111111111' },
          },
          {
            device_id: 'dev-002',
            health_score: 55,
            critical_alerts: 1,
            checked_at: '2024-01-15T11:00:00Z',
            devices: { imei: '222222222222222' },
          },
        ],
        error: null,
      });

      const result = await getDevicesNeedingAttention();

      expect(result).toHaveLength(2);
      expect(result[0].device_id).toBe('dev-001');
      expect(result[0].health_score).toBe(40);
      expect(result[0].critical_alerts).toBe(2);
      expect(result[0].imei).toBe('111111111111111');
    });

    it('should handle null data gracefully', async () => {
      __mockExecute.mockResolvedValueOnce({ data: null, error: null });

      const result = await getDevicesNeedingAttention();

      expect(result).toEqual([]);
    });

    it('should handle missing imei in device relation', async () => {
      __mockExecute.mockResolvedValueOnce({
        data: [
          {
            device_id: 'dev-003',
            health_score: 30,
            critical_alerts: 3,
            checked_at: '2024-01-15T12:00:00Z',
            devices: null,
          },
        ],
        error: null,
      });

      const result = await getDevicesNeedingAttention();

      expect(result).toHaveLength(1);
      expect(result[0].imei).toBe('');
    });

    it('should query with correct filters', async () => {
      __mockExecute.mockResolvedValueOnce({ data: [], error: null });

      await getDevicesNeedingAttention();

      expect(db.from).toHaveBeenCalledWith('device_health_checks');
    });
  });
});
