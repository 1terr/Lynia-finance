/**
 * Tests for the base fetchAPI client.
 *
 * Verifies:
 *   - Authorization header attachment
 *   - { success, data } envelope unwrapping
 *   - 401 → redirect to /login
 *   - 403 → permission error
 *   - 500 → user-friendly error message
 *   - AbortError → "timed out" message
 *   - Non-JSON error body handling
 */

// ─── Mocks ───

const mockGetJwtToken = jest.fn().mockReturnValue('mock-jwt-token');
const mockGetIdToken = jest.fn().mockReturnValue({ getJwtToken: mockGetJwtToken });
const mockSession = { getIdToken: mockGetIdToken };

const mockGetValidSession = jest.fn().mockResolvedValue(mockSession);
const mockSignOut = jest.fn();

jest.mock('@lynia/auth', () => ({
  getValidSession: (...args: unknown[]) => mockGetValidSession(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Import after mocks ───

import { fetchAPI } from '../client';

// ─── Tests ───

describe('fetchAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetValidSession.mockResolvedValue(mockSession);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('attaches Authorization header with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { id: '1' } }),
    });

    await fetchAPI('/api/v1/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer mock-jwt-token');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('unwraps { success, data } envelope', async () => {
    const payload = { id: 'loan-1', amount: 500 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: payload }),
    });

    const result = await fetchAPI('/api/v1/loans/1');
    expect(result).toEqual(payload);
  });

  it('returns raw JSON when no data envelope', async () => {
    const payload = { items: [1, 2, 3] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    });

    const result = await fetchAPI('/api/v1/raw');
    expect(result).toEqual(payload);
  });

  it('calls signOut on 401 response and throws session expired', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    await expect(fetchAPI('/api/v1/protected')).rejects.toThrow('Session expired');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('throws permission error on 403 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden' }),
    });

    await expect(fetchAPI('/api/v1/admin-only')).rejects.toThrow(
      'You do not have permission'
    );
  });

  it('throws user-friendly message on 500 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({
        success: false,
        error: 'An unexpected error occurred',
      }),
    });

    await expect(fetchAPI('/api/v1/failing')).rejects.toThrow(
      'An unexpected error occurred'
    );
  });

  it('throws "timed out" on AbortError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(fetchAPI('/api/v1/slow')).rejects.toThrow('timed out');
  });

  it('handles non-JSON error response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not JSON')),
    });

    await expect(fetchAPI('/api/v1/bad-gateway')).rejects.toThrow(
      'Request failed (502)'
    );
  });

  it('throws when no session available', async () => {
    mockGetValidSession.mockResolvedValueOnce(null);

    await expect(fetchAPI('/api/v1/test')).rejects.toThrow(
      'Authentication required'
    );
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('parses nested error.message format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        error: { message: 'Loan amount exceeds maximum' },
      }),
    });

    await expect(fetchAPI('/api/v1/loans')).rejects.toThrow(
      'Loan amount exceeds maximum'
    );
  });
});
