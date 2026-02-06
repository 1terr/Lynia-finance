import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  fetchNotificationTemplates,
  updateNotificationTemplate,
  fetchSystemConfig,
  updateSystemConfig,
  fetchAuditLog,
  getRolePermissions,
  getAllPermissions,
} from '@/lib/api/settings';

describe('Settings API functions', () => {
  describe('fetchAdminUsers', () => {
    it('returns array of admin users', async () => {
      const users = await fetchAdminUsers();
      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).toHaveProperty('id');
      expect(users[0]).toHaveProperty('email');
      expect(users[0]).toHaveProperty('role');
      expect(users[0]).toHaveProperty('is_active');
      expect(users[0]).toHaveProperty('mfa_enabled');
    });
  });

  describe('createAdminUser', () => {
    it('creates a new user and returns it', async () => {
      const payload = {
        email: 'new@lynia.co.zw',
        first_name: 'New',
        last_name: 'User',
        role: 'customer_support' as const,
        department: 'Support',
        phone: '+263771999999',
      };
      const user = await createAdminUser(payload);
      expect(user.email).toBe('new@lynia.co.zw');
      expect(user.first_name).toBe('New');
      expect(user.role).toBe('customer_support');
      expect(user.is_active).toBe(true);
      expect(user.mfa_enabled).toBe(false);
    });
  });

  describe('updateAdminUser', () => {
    it('updates user fields', async () => {
      const users = await fetchAdminUsers();
      const user = users[0];
      const updated = await updateAdminUser(user.id, { first_name: 'Updated' });
      expect(updated.first_name).toBe('Updated');
      expect(updated.id).toBe(user.id);
    });

    it('throws for non-existent user', async () => {
      await expect(updateAdminUser('nonexistent', { first_name: 'X' })).rejects.toThrow('User not found');
    });
  });

  describe('fetchNotificationTemplates', () => {
    it('returns array of templates', async () => {
      const templates = await fetchNotificationTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('channel');
      expect(templates[0]).toHaveProperty('body');
      expect(templates[0]).toHaveProperty('variables');
    });

    it('templates have valid channels', async () => {
      const templates = await fetchNotificationTemplates();
      const validChannels = ['whatsapp', 'sms', 'email'];
      templates.forEach((t) => {
        expect(validChannels).toContain(t.channel);
      });
    });
  });

  describe('fetchSystemConfig', () => {
    it('returns system configuration', async () => {
      const config = await fetchSystemConfig();
      expect(config.loan_tier1_amount).toBe(200);
      expect(config.loan_tier2_amount).toBe(350);
      expect(config.loan_tier3_amount).toBe(500);
      expect(config.interest_rate_pct).toBeGreaterThan(0);
      expect(config.currency).toBe('USD');
      expect(config.timezone).toBe('Africa/Harare');
    });
  });

  describe('updateSystemConfig', () => {
    it('updates partial config', async () => {
      const updated = await updateSystemConfig({ interest_rate_pct: 18 });
      expect(updated.interest_rate_pct).toBe(18);
      expect(updated.loan_tier1_amount).toBe(200); // unchanged
    });
  });

  describe('fetchAuditLog', () => {
    it('returns audit log entries', async () => {
      const entries = await fetchAuditLog();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]).toHaveProperty('admin_email');
      expect(entries[0]).toHaveProperty('action');
      expect(entries[0]).toHaveProperty('resource');
      expect(entries[0]).toHaveProperty('ip_address');
    });
  });

  describe('getRolePermissions', () => {
    it('returns permissions for super_admin', () => {
      const perms = getRolePermissions('super_admin');
      expect(perms).toContain('settings:write');
      expect(perms).toContain('dashboard:view');
      expect(perms.length).toBe(24);
    });

    it('returns limited permissions for kyc_reviewer', () => {
      const perms = getRolePermissions('kyc_reviewer');
      expect(perms).toContain('kyc:approve');
      expect(perms).not.toContain('settings:write');
    });
  });

  describe('getAllPermissions', () => {
    it('returns all 24 permissions', () => {
      const perms = getAllPermissions();
      expect(perms).toHaveLength(24);
      expect(perms).toContain('dashboard:view');
      expect(perms).toContain('settings:write');
      expect(perms).toContain('notifications:send');
    });
  });
});
