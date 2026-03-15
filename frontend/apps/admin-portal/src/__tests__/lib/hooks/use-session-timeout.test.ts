import { renderHook, act } from '@testing-library/react';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock auth store
const mockSignOutUser = jest.fn();
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ signOutUser: mockSignOutUser }),
}));

// Mock toast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toasts: [], toast: mockToast, dismiss: jest.fn() }),
}));

import { useSessionTimeout } from '@/lib/hooks/use-session-timeout';

describe('useSessionTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('signs out and redirects after timeout', () => {
    renderHook(() => useSessionTimeout(10_000)); // 10s timeout

    // Advance past the timeout
    act(() => {
      jest.advanceTimersByTime(10_001);
    });

    expect(mockSignOutUser).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('does not sign out before timeout', () => {
    renderHook(() => useSessionTimeout(10_000));

    act(() => {
      jest.advanceTimersByTime(9_000);
    });

    expect(mockSignOutUser).not.toHaveBeenCalled();
  });

  it('shows warning toast before timeout', () => {
    // 10 min timeout → warning at 5 min (10min - 5min warning)
    const timeout = 10 * 60 * 1000;
    renderHook(() => useSessionTimeout(timeout));

    // Advance to just past the warning time (5 minutes in)
    act(() => {
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'warning',
        title: 'Session expiring soon',
      })
    );
    // Should not have signed out yet
    expect(mockSignOutUser).not.toHaveBeenCalled();
  });

  it('resets timer on user activity', () => {
    renderHook(() => useSessionTimeout(10_000));

    // Advance 8 seconds
    act(() => {
      jest.advanceTimersByTime(8_000);
    });

    // Simulate user activity
    act(() => {
      window.dispatchEvent(new Event('mousedown'));
    });

    // Advance another 8 seconds (total 16s from start, but only 8s from reset)
    act(() => {
      jest.advanceTimersByTime(8_000);
    });

    // Should NOT have timed out (timer was reset at 8s)
    expect(mockSignOutUser).not.toHaveBeenCalled();

    // Advance past the full timeout from the reset
    act(() => {
      jest.advanceTimersByTime(3_000);
    });

    expect(mockSignOutUser).toHaveBeenCalled();
  });

  it('resets timer on keydown', () => {
    renderHook(() => useSessionTimeout(10_000));

    act(() => {
      jest.advanceTimersByTime(9_000);
    });

    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });

    act(() => {
      jest.advanceTimersByTime(9_000);
    });

    expect(mockSignOutUser).not.toHaveBeenCalled();
  });

  it('resets timer on scroll', () => {
    renderHook(() => useSessionTimeout(10_000));

    act(() => {
      jest.advanceTimersByTime(9_000);
    });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      jest.advanceTimersByTime(9_000);
    });

    expect(mockSignOutUser).not.toHaveBeenCalled();
  });

  it('resets timer on touchstart', () => {
    renderHook(() => useSessionTimeout(10_000));

    act(() => {
      jest.advanceTimersByTime(9_000);
    });

    act(() => {
      window.dispatchEvent(new Event('touchstart'));
    });

    act(() => {
      jest.advanceTimersByTime(9_000);
    });

    expect(mockSignOutUser).not.toHaveBeenCalled();
  });

  it('cleans up event listeners on unmount', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useSessionTimeout(10_000));

    // Should have added listeners for 4 events
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((event) => {
      expect(addSpy).toHaveBeenCalledWith(event, expect.any(Function), { passive: true });
    });

    unmount();

    activityEvents.forEach((event) => {
      expect(removeSpy).toHaveBeenCalledWith(event, expect.any(Function));
    });

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('clears timeouts on unmount', () => {
    const { unmount } = renderHook(() => useSessionTimeout(10_000));

    unmount();

    // Advance past timeout — should NOT fire after unmount
    act(() => {
      jest.advanceTimersByTime(20_000);
    });

    expect(mockSignOutUser).not.toHaveBeenCalled();
  });

  it('uses default 30-minute timeout when no argument provided', () => {
    renderHook(() => useSessionTimeout());

    // Advance 29 minutes — should not timeout
    act(() => {
      jest.advanceTimersByTime(29 * 60 * 1000);
    });
    expect(mockSignOutUser).not.toHaveBeenCalled();

    // Advance past 30 minutes
    act(() => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(mockSignOutUser).toHaveBeenCalled();
  });
});
