/**
 * Tests: Cognito Auth Integration for Fineract API (Phase 11)
 *
 * Verifies that the fetchAPI client correctly handles Cognito session
 * management, token injection, and auth error responses.
 */

import { fetchAPI } from '@lynia/api-client';
import { getValidSession } from '@lynia/auth';

jest.mock('@lynia/auth', () => ({
  getValidSession: jest.fn(),
}));

const mockedGetSession = getValidSession as jest.MockedFunction<typeof getValidSession>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Fineract Cognito Auth Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = '';
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
    it('clears auth cookie and throws on 401', async () => {
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
    });
  });

  describe('fetchAPI standard error handling', () => {
    it('extracts error message from response body', async () => {
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
      ).rejects.toThrow('Internal Server Error');
    });

    it('falls back to generic error when body has no message', async () => {
      const mockSession = {
        getIdToken: () => ({
          getJwtToken: () => 'valid-token',
        }),
      };
      mockedGetSession.mockResolvedValue(mockSession as never);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      });

      await expect(
        fetchAPI('/api/v1/fineract/loans')
      ).rejects.toThrow('API error: 500');
    });
  });
});
