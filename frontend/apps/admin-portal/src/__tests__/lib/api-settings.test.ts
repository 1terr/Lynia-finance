/**
 * Settings API module - export verification tests.
 *
 * These tests verify that the settings API module exports the expected
 * functions. Integration tests against real endpoints are handled separately.
 */
import {
  getAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  getSystemConfigs,
  updateSystemConfig,
  getAuditLogs,
} from '@/lib/api/settings';

describe('Settings API exports', () => {
  it('exports getAdminUsers as a function', () => {
    expect(typeof getAdminUsers).toBe('function');
  });

  it('exports getAdminUserById as a function', () => {
    expect(typeof getAdminUserById).toBe('function');
  });

  it('exports createAdminUser as a function', () => {
    expect(typeof createAdminUser).toBe('function');
  });

  it('exports updateAdminUser as a function', () => {
    expect(typeof updateAdminUser).toBe('function');
  });

  it('exports getSystemConfigs as a function', () => {
    expect(typeof getSystemConfigs).toBe('function');
  });

  it('exports updateSystemConfig as a function', () => {
    expect(typeof updateSystemConfig).toBe('function');
  });

  it('exports getAuditLogs as a function', () => {
    expect(typeof getAuditLogs).toBe('function');
  });
});
