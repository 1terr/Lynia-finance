import { useAuthStore } from '@/lib/store/auth-store';
import type { AdminUser } from '@/types/auth';

const mockSuperAdmin: AdminUser = {
  id: 'usr_001',
  email: 'admin@lynia.co.zw',
  first_name: 'Tatenda',
  last_name: 'Moyo',
  role: 'super_admin',
  is_active: true,
  department: 'Executive',
  last_login_at: '2026-02-06T08:30:00Z',
  created_at: '2025-10-01T00:00:00Z',
};

const mockKycReviewer: AdminUser = {
  id: 'usr_003',
  email: 'kyc@lynia.co.zw',
  first_name: 'Blessing',
  last_name: 'Sithole',
  role: 'kyc_reviewer',
  is_active: true,
  department: 'Compliance',
  last_login_at: null,
  created_at: '2025-12-01T00:00:00Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true });
  });

  it('starts with null user and loading', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('sets user correctly', () => {
    useAuthStore.getState().setUser(mockSuperAdmin);
    expect(useAuthStore.getState().user).toEqual(mockSuperAdmin);
  });

  it('sets loading correctly', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  describe('hasPermission', () => {
    it('returns false when no user', () => {
      expect(useAuthStore.getState().hasPermission('dashboard:view')).toBe(false);
    });

    it('super_admin has all permissions', () => {
      useAuthStore.getState().setUser(mockSuperAdmin);
      expect(useAuthStore.getState().hasPermission('dashboard:view')).toBe(true);
      expect(useAuthStore.getState().hasPermission('settings:write')).toBe(true);
      expect(useAuthStore.getState().hasPermission('loans:approve')).toBe(true);
    });

    it('kyc_reviewer has limited permissions', () => {
      useAuthStore.getState().setUser(mockKycReviewer);
      expect(useAuthStore.getState().hasPermission('kyc:approve')).toBe(true);
      expect(useAuthStore.getState().hasPermission('kyc:reject')).toBe(true);
      expect(useAuthStore.getState().hasPermission('loans:approve')).toBe(false);
      expect(useAuthStore.getState().hasPermission('settings:write')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns false when no user', () => {
      expect(useAuthStore.getState().hasAnyPermission(['dashboard:view'])).toBe(false);
    });

    it('returns true when user has at least one permission', () => {
      useAuthStore.getState().setUser(mockKycReviewer);
      expect(useAuthStore.getState().hasAnyPermission(['kyc:approve', 'settings:write'])).toBe(true);
    });

    it('returns false when user has none of the permissions', () => {
      useAuthStore.getState().setUser(mockKycReviewer);
      expect(useAuthStore.getState().hasAnyPermission(['settings:write', 'loans:approve'])).toBe(false);
    });
  });
});
