import { useAuthStore } from '@/lib/store/auth-store';
import type { AdminUser } from '@/types/auth';

// Mock @lynia/auth
jest.mock('@lynia/auth', () => ({
  userPool: null,
  CognitoUser: jest.fn(),
  AuthenticationDetails: jest.fn(),
  getSession: jest.fn(),
  signOut: jest.fn(),
  isCognitoConfigured: jest.fn(() => false),
  forgotPassword: jest.fn(),
  confirmForgotPassword: jest.fn(),
  changePassword: jest.fn(),
}));

const mockSuperAdmin: AdminUser = {
  id: 'usr_001',
  email: 'admin@lynia.co.zw',
  first_name: 'Tatenda',
  last_name: 'Moyo',
  full_name: 'Tatenda Moyo',
  role: 'super_admin',
  is_active: true,
  department: 'Executive',
  last_login_at: '2026-02-06T08:30:00Z',
  login_count: 42,
  created_at: '2025-10-01T00:00:00Z',
  updated_at: '2026-02-06T08:30:00Z',
};

const mockKycReviewer: AdminUser = {
  id: 'usr_003',
  email: 'kyc@lynia.co.zw',
  first_name: 'Blessing',
  last_name: 'Sithole',
  full_name: 'Blessing Sithole',
  role: 'kyc_reviewer',
  is_active: true,
  department: 'Compliance',
  last_login_at: null,
  login_count: 0,
  created_at: '2025-12-01T00:00:00Z',
  updated_at: '2025-12-01T00:00:00Z',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true, challenge: null });
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

    it('returns false for unknown role instead of crashing', () => {
      useAuthStore.getState().setUser({
        ...mockSuperAdmin,
        role: 'unknown_role' as AdminUser['role'],
      });
      expect(useAuthStore.getState().hasPermission('dashboard:view')).toBe(false);
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

    it('returns false for unknown role instead of crashing', () => {
      useAuthStore.getState().setUser({
        ...mockSuperAdmin,
        role: 'unknown_role' as AdminUser['role'],
      });
      expect(useAuthStore.getState().hasAnyPermission(['dashboard:view'])).toBe(false);
    });
  });

  describe('signIn - Cognito not configured', () => {
    it('returns clear error when Cognito is not configured', async () => {
      const result = await useAuthStore.getState().signIn('test@test.com', 'password');
      expect(result.error).toBe('Cognito is not configured. Contact your administrator.');
    });
  });

  describe('forgotPassword - Cognito not configured', () => {
    it('returns clear error when Cognito is not configured', async () => {
      const result = await useAuthStore.getState().forgotPassword('test@test.com');
      expect(result.error).toBe('Cognito is not configured. Contact your administrator.');
    });
  });

  describe('confirmForgotPassword - Cognito not configured', () => {
    it('returns clear error when Cognito is not configured', async () => {
      const result = await useAuthStore.getState().confirmForgotPassword('test@test.com', '123456', 'newpass');
      expect(result.error).toBe('Cognito is not configured. Contact your administrator.');
    });
  });

  describe('changePassword - Cognito not configured', () => {
    it('returns clear error when Cognito is not configured', async () => {
      const result = await useAuthStore.getState().changePassword('oldpass', 'newpass');
      expect(result.error).toBe('Cognito is not configured. Contact your administrator.');
    });
  });

  describe('signOutUser', () => {
    it('clears user state on sign out', () => {
      useAuthStore.getState().setUser(mockSuperAdmin);
      expect(useAuthStore.getState().user).not.toBeNull();

      useAuthStore.getState().signOutUser();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
