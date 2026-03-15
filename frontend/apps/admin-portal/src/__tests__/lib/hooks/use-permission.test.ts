import { renderHook } from '@testing-library/react';
import { useAuthStore } from '@/lib/store/auth-store';
import type { AdminUser } from '@/types/auth';

// Mock @lynia/auth (required by auth-store)
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

import {
  usePermission,
  useAnyPermission,
  useAdminUser,
  useAdminRole,
} from '@/lib/hooks/use-permission';

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
  ...mockSuperAdmin,
  id: 'usr_003',
  email: 'kyc@lynia.co.zw',
  first_name: 'Blessing',
  last_name: 'Sithole',
  full_name: 'Blessing Sithole',
  role: 'kyc_reviewer',
  department: 'Compliance',
};

describe('usePermission', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true, challenge: null });
  });

  it('returns false when no user is signed in', () => {
    const { result } = renderHook(() => usePermission('dashboard:view'));
    expect(result.current).toBe(false);
  });

  it('returns true when user has the permission', () => {
    useAuthStore.setState({ user: mockSuperAdmin });
    const { result } = renderHook(() => usePermission('settings:write'));
    expect(result.current).toBe(true);
  });

  it('returns false when user lacks the permission', () => {
    useAuthStore.setState({ user: mockKycReviewer });
    const { result } = renderHook(() => usePermission('settings:write'));
    expect(result.current).toBe(false);
  });
});

describe('useAnyPermission', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true, challenge: null });
  });

  it('returns false when no user is signed in', () => {
    const { result } = renderHook(() =>
      useAnyPermission(['dashboard:view', 'settings:write'])
    );
    expect(result.current).toBe(false);
  });

  it('returns true when user has at least one permission', () => {
    useAuthStore.setState({ user: mockKycReviewer });
    const { result } = renderHook(() =>
      useAnyPermission(['kyc:approve', 'settings:write'])
    );
    expect(result.current).toBe(true);
  });

  it('returns false when user has none of the permissions', () => {
    useAuthStore.setState({ user: mockKycReviewer });
    const { result } = renderHook(() =>
      useAnyPermission(['settings:write', 'loans:approve'])
    );
    expect(result.current).toBe(false);
  });
});

describe('useAdminUser', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('returns null when no user is signed in', () => {
    const { result } = renderHook(() => useAdminUser());
    expect(result.current).toBeNull();
  });

  it('returns the admin user when signed in', () => {
    useAuthStore.setState({ user: mockSuperAdmin });
    const { result } = renderHook(() => useAdminUser());
    expect(result.current).toEqual(mockSuperAdmin);
  });
});

describe('useAdminRole', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('returns null when no user is signed in', () => {
    const { result } = renderHook(() => useAdminRole());
    expect(result.current).toBeNull();
  });

  it('returns the role when user is signed in', () => {
    useAuthStore.setState({ user: mockSuperAdmin });
    const { result } = renderHook(() => useAdminRole());
    expect(result.current).toBe('super_admin');
  });

  it('returns correct role for different users', () => {
    useAuthStore.setState({ user: mockKycReviewer });
    const { result } = renderHook(() => useAdminRole());
    expect(result.current).toBe('kyc_reviewer');
  });
});
