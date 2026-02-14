'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { isCognitoConfigured } from '@/lib/auth/cognito';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const challenge = useAuthStore((s) => s.challenge);
  const completeNewPassword = useAuthStore((s) => s.completeNewPassword);
  const completeMfaChallenge = useAuthStore((s) => s.completeMfaChallenge);
  const isDemoMode = typeof window !== 'undefined' && !isCognitoConfigured();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await completeNewPassword(newPassword);
      if (result.error) {
        setError(result.error);
      } else if (!useAuthStore.getState().challenge) {
        window.location.href = '/';
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await completeMfaChallenge(mfaCode);
      if (result.error) {
        setError(result.error);
        setMfaCode('');
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  // After successful sign-in with no challenge, redirect
  const user = useAuthStore((s) => s.user);
  if (user && !challenge) {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg">
          LF
        </div>
        <CardTitle className="text-2xl">Lynia Finance</CardTitle>
        <CardDescription>
          {challenge?.type === 'NEW_PASSWORD_REQUIRED'
            ? 'Create a new password'
            : challenge?.type === 'SOFTWARE_TOKEN_MFA'
            ? 'Enter your verification code'
            : 'Sign in to the admin portal'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* ── Step 1: Sign In ── */}
        {!challenge && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="admin@lynia.co.zw"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            {isDemoMode && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Demo credentials</p>
                <p>Email: admin@lynia.co.zw</p>
                <p>Password: any 4+ characters</p>
              </div>
            )}
          </form>
        )}

        {/* ── Step 2: New Password Required ── */}
        {challenge?.type === 'NEW_PASSWORD_REQUIRED' && (
          <form onSubmit={handleNewPassword} className="space-y-4">
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 mb-2">
              Your administrator requires you to set a new password.
            </div>
            <Input
              id="newPassword"
              label="New Password"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Input
              id="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting password...' : 'Set New Password'}
            </Button>
          </form>
        )}

        {/* ── Step 3: MFA TOTP Code ── */}
        {challenge?.type === 'SOFTWARE_TOKEN_MFA' && (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 mb-2">
              Open your authenticator app and enter the 6-digit code.
            </div>
            <Input
              id="mfaCode"
              label="Verification Code"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoComplete="one-time-code"
            />
            <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
