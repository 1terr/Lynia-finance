'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { isCognitoConfigured } from '@lynia/auth';
import { Button } from '@/components/ui/button';
import { Smartphone, Eye, EyeOff } from 'lucide-react';

type PageMode = 'sign-in' | 'forgot' | 'reset';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      } else if (!useAuthStore.getState().challenge) {
        window.location.href = '/';
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

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
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
  const distributor = useAuthStore((s) => s.distributor);
  if (distributor && !challenge) {
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
    : 'Sign in to manage your devices and handovers';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Smartphone className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Lynia Distributor</h1>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
              {successMessage}
            </div>
          )}

          {/* Sign In */}
          {!challenge && mode === 'sign-in' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@distributor.co.zw"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

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
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">Demo credentials</p>
                  <p>Email: kudzai@distributor.co.zw</p>
                  <p>Password: any 4+ characters</p>
                </div>
              )}
            </form>
          )}

          {/* Forgot Password: Enter email */}
          {!challenge && mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                Enter your email address and we will send you a verification code to reset your password.
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@distributor.co.zw"
                  required
                  autoComplete="email"
                />
              </div>
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

          {/* Reset Password: Enter code + new password */}
          {!challenge && mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter the code from your email"
                  required
                  autoComplete="one-time-code"
                />
              </div>
              <div>
                <label className="text-sm font-medium">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="At least 12 characters"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Re-enter your new password"
                  required
                  autoComplete="new-password"
                />
              </div>
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

          {/* New Password Required (first-time login) */}
          {challenge?.type === 'NEW_PASSWORD_REQUIRED' && (
            <form onSubmit={handleNewPassword} className="space-y-4">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                Your administrator requires you to set a new password.
              </div>
              <div>
                <label className="text-sm font-medium">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="At least 12 characters"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Re-enter your new password"
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Setting password...' : 'Set New Password'}
              </Button>
            </form>
          )}

          {/* MFA TOTP Code */}
          {challenge?.type === 'SOFTWARE_TOKEN_MFA' && (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                Open your authenticator app and enter the 6-digit code.
              </div>
              <div>
                <label className="text-sm font-medium">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
