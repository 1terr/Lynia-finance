'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { isCognitoConfigured } from '@/lib/auth/cognito';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

type PageMode = 'sign-in' | 'forgot' | 'reset';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<PageMode>('sign-in');

  const signIn = useAuthStore((s) => s.signIn);
  const challenge = useAuthStore((s) => s.challenge);
  const completeNewPassword = useAuthStore((s) => s.completeNewPassword);
  const completeMfaChallenge = useAuthStore((s) => s.completeMfaChallenge);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const confirmForgotPassword = useAuthStore((s) => s.confirmForgotPassword);
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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const result = await forgotPassword(email);
      if (result.error) {
        setError(result.error);
      } else {
        setMode('reset');
        setSuccessMessage('A verification code has been sent to your email.');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await confirmForgotPassword(email, resetCode, newPassword);
      if (result.error) {
        setError(result.error);
      } else {
        setMode('sign-in');
        setNewPassword('');
        setConfirmPassword('');
        setResetCode('');
        setSuccessMessage('Password reset successfully. You can now sign in with your new password.');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function goToForgotPassword() {
    setError('');
    setSuccessMessage('');
    setMode('forgot');
  }

  function goToSignIn() {
    setError('');
    setSuccessMessage('');
    setNewPassword('');
    setConfirmPassword('');
    setResetCode('');
    setMode('sign-in');
  }

  // After successful sign-in with no challenge, redirect
  const user = useAuthStore((s) => s.user);
  if (user && !challenge) {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  const description = challenge?.type === 'NEW_PASSWORD_REQUIRED'
    ? 'Create a new password'
    : challenge?.type === 'SOFTWARE_TOKEN_MFA'
    ? 'Enter your verification code'
    : mode === 'forgot'
    ? 'Reset your password'
    : mode === 'reset'
    ? 'Enter your verification code'
    : 'Sign in to the admin portal';

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg">
          LF
        </div>
        <CardTitle className="text-2xl">Lynia Finance</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300 mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300 mb-4">
            {successMessage}
          </div>
        )}

        {/* ── Step 1: Sign In ── */}
        {!challenge && mode === 'sign-in' && (
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

            {!isDemoMode && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={goToForgotPassword}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {isDemoMode && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Demo credentials</p>
                <p>Email: admin@lynia.co.zw</p>
                <p>Password: any 4+ characters</p>
              </div>
            )}
          </form>
        )}

        {/* ── Forgot Password: Enter email ── */}
        {!challenge && mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-300 mb-2">
              Enter your email address and we will send you a verification code to reset your password.
            </div>
            <Input
              id="resetEmail"
              label="Email"
              type="email"
              placeholder="admin@lynia.co.zw"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending code...' : 'Send Reset Code'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={goToSignIn}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ── Reset Password: Enter code + new password ── */}
        {!challenge && mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              id="resetCode"
              label="Verification Code"
              type="text"
              inputMode="numeric"
              placeholder="Enter the code from your email"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoComplete="one-time-code"
            />
            <Input
              id="resetNewPassword"
              label="New Password"
              type="password"
              placeholder="At least 12 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Input
              id="resetConfirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <Button type="submit" className="w-full" disabled={loading || resetCode.length !== 6}>
              {loading ? 'Resetting password...' : 'Reset Password'}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={goToSignIn}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: New Password Required ── */}
        {challenge?.type === 'NEW_PASSWORD_REQUIRED' && (
          <form onSubmit={handleNewPassword} className="space-y-4">
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-300 mb-2">
              Your administrator requires you to set a new password.
            </div>
            <Input
              id="newPassword"
              label="New Password"
              type="password"
              placeholder="At least 12 characters"
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
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-300 mb-2">
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
