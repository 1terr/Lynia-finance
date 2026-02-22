'use client';

import { isCognitoConfigured } from '@lynia/auth';

/**
 * When Cognito is not properly configured the app runs in demo mode.
 * This guard renders a small banner at the top so users know they are
 * interacting with mock data, but it never blocks the UI.
 */
export function ConfigGuard({ children }: { children: React.ReactNode }) {
  const showBanner =
    typeof window !== 'undefined' && !isCognitoConfigured();

  return (
    <>
      {showBanner && (
        <div className="bg-amber-500 text-white text-center text-xs py-1 px-2 font-medium">
          Demo Mode — Cognito not configured. Using sample data.
        </div>
      )}
      {children}
    </>
  );
}
