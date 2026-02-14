/**
 * Tests: Cognito Auth Integration for Fineract API (Phase 11)
 *
 * Verifies that the fetchAPI client correctly handles Cognito session
 * management, token injection, and auth error responses.
 */

import { fetchAPI } from '@/lib/api/client';
import { getSession, signOut } from '@/lib/auth/cognito';

jest.mock('@/lib/auth/cognito', () => ({
  getSession: jest.fn(),
  signOut: jest.fn(),
}));

const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockedSignOut = signOut as jest.MockedFunction<typeof signOut>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.location
const mockLocationAssign = jest.fn();
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

describe('Fineract Cognito Auth Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = '';
    window.location.href = '';
  });

  describe('fetchAPI Cognito token injection', () => {
    it('attaches Cognito JWT as Bearer token', async () => {
      const mockSession = {
        getIdToken: () => ({
          getJwtToken: () => 'mock-cognito-jwt-token',
        }),
      };
      mockedGetSession.mockResolvedValue(mockSession as never);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      });

      await fetchAPI('/api/v1/fineract/loans');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-cognito-jwt-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws when Cognito session is null (not authenticated)', async () => {
      mockedGetSession.mockResolvedValue(null);

      await expect(
        fetchAPI('/api/v1/fineract/loans')
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('fetchAPI session expiry handling', () => {
    it('clears Cognito session and redirects on 401', async () => {
      const mockSession = {
        getIdToken: () => ({
          getJwtToken: () => 'expired-token',
        }),
      };
      mockedGetSession.mockResolvedValue(mockSession as never);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      await expect(
        fetchAPI('/api/v1/fineract/loans')
      ).rejects.toThrow('Session expired');

      expect(mockedSignOut).toHaveBeenCalled();
      expect(window.location.href).toBe('/login');
    });

    it('throws permission error on 403 without redirect', async () => {
      const mockSession = {
        getIdToken: () => ({
          getJwtToken: () => 'valid-token',
        }),
      };
      mockedGetSession.mockResolvedValue(mockSession as never);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Forbidden' }),
      });

      await expect(
        fetchAPI('/api/v1/fineract/loans/loan-001/approve')
      ).rejects.toThrow('permission');

      expect(mockedSignOut).not.toHaveBeenCalled();
    });
  });

  describe('fetchAPI standard error handling', () => {
    it('throws generic API error for non-auth failures', async () => {
      const mockSession = {
        getIdToken: () => ({
          getJwtToken: () => 'valid-token',
        }),
      };
      mockedGetSession.mockResolvedValue(mockSession as never);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      });

      await expect(
        fetchAPI('/api/v1/fineract/loans')
      ).rejects.toThrow('API error: 500');

      expect(mockedSignOut).not.toHaveBeenCalled();
    });
  });
});
