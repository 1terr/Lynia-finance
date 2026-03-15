import { renderHook, act } from '@testing-library/react';

// Mock next/navigation (already in jest.setup but we need access to the mocks)
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: mockRefresh,
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the auth store
const mockSignIn = jest.fn();
const mockSignOutUser = jest.fn();
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) => {
    const state = (jest.requireMock('@/lib/store/auth-store') as { __state: Record<string, unknown> }).__state;
    return selector(state);
  }),
  __state: {} as Record<string, unknown>,
}));

// Mock auth/permissions
jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: jest.fn(),
}));

import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/auth/permissions';
import type { AdminUser } from '@/types/auth';

const mockUser: AdminUser = {
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

function setAuthState(overrides: Record<string, unknown> = {}) {
  const mod = jest.requireMock('@/lib/store/auth-store') as { __state: Record<string, unknown> };
  mod.__state = {
    user: null,
    isLoading: false,
    signIn: mockSignIn,
    signOutUser: mockSignOutUser,
    ...overrides,
  };
}

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuthState();
  });

  it('returns null user when not authenticated', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns user when authenticated', () => {
    setAuthState({ user: mockUser });
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual(mockUser);
  });

  it('returns isLoading state', () => {
    setAuthState({ isLoading: true });
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(true);
  });

  describe('signIn', () => {
    it('calls store signIn and refreshes router on success', async () => {
      mockSignIn.mockResolvedValue({});
      const { result } = renderHook(() => useAuth());

      let signInResult: { error?: string } | undefined;
      await act(async () => {
        signInResult = await result.current.signIn('admin@lynia.co.zw', 'password123');
      });

      expect(mockSignIn).toHaveBeenCalledWith('admin@lynia.co.zw', 'password123');
      expect(signInResult?.error).toBeUndefined();
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('does not refresh router on sign-in error', async () => {
      mockSignIn.mockResolvedValue({ error: 'Invalid email or password' });
      const { result } = renderHook(() => useAuth());

      let signInResult: { error?: string } | undefined;
      await act(async () => {
        signInResult = await result.current.signIn('bad@test.com', 'wrong');
      });

      expect(signInResult?.error).toBe('Invalid email or password');
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('calls signOutUser and redirects to /login', async () => {
      setAuthState({ user: mockUser });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOutUser).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  describe('checkPermission', () => {
    it('returns false when no user', () => {
      (hasPermission as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() => useAuth());
      expect(result.current.checkPermission('customers', 'read')).toBe(false);
      expect(hasPermission).not.toHaveBeenCalled();
    });

    it('delegates to hasPermission when user exists', () => {
      setAuthState({ user: mockUser });
      (hasPermission as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() => useAuth());

      const allowed = result.current.checkPermission('customers', 'read');
      expect(allowed).toBe(true);
      expect(hasPermission).toHaveBeenCalledWith('super_admin', 'customers', 'read');
    });

    it('returns false when permission denied', () => {
      setAuthState({ user: { ...mockUser, role: 'reports_viewer' } });
      (hasPermission as jest.Mock).mockReturnValue(false);
      const { result } = renderHook(() => useAuth());

      expect(result.current.checkPermission('settings', 'write')).toBe(false);
    });
  });
});
