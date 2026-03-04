/**
 * Haptic feedback utility for mobile devices.
 * Uses the Vibration API (supported on Chrome/Android).
 * Gracefully no-ops on unsupported devices (iOS Safari).
 */

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function useHaptics() {
  return {
    /** Light tap — for button presses, filter selection (10ms) */
    light: () => canVibrate && navigator.vibrate(10),
    /** Medium — for step completion, confirmations (30ms) */
    medium: () => canVibrate && navigator.vibrate(30),
    /** Success — for handover submit, payment confirmed (two short pulses) */
    success: () => canVibrate && navigator.vibrate([20, 50, 20]),
  };
}
