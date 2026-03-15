'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { isCognitoConfigured } from '@lynia/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ArrowLeft, Mail, Building2, Shield, Lock } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const isDemoMode = typeof window !== 'undefined' && !isCognitoConfigured();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`
    : 'AD';

  const roleLabel = user?.role
    ? user.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPwd !== confirmPwd) {
      setError('Passwords do not match');
      return;
    }

    if (newPwd.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    if (!/[A-Z]/.test(newPwd)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPwd)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPwd)) {
      setError('Password must contain at least one number');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPwd)) {
      setError('Password must contain at least one special character');
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPwd);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPwd('');
        setConfirmPwd('');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/settings')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-gray-100">Profile</h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            View your account information and manage your password.
          </p>
        </div>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <Avatar initials={initials} size="lg" />
            <div className="space-y-4 flex-1">
              <div>
                <p className="text-xl font-semibold text-foreground dark:text-gray-100">
                  {user?.first_name} {user?.last_name}
                </p>
                <Badge variant="info" className="mt-1">
                  {roleLabel}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-300">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{user?.email}</span>
                </div>
                {user?.department && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-300">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{user.department}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-300">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{roleLabel}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                Profile details are managed by your administrator. Contact them to update your name or email.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isDemoMode && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-300">
              Password change is not available in demo mode.
            </div>
          )}

          {!isDemoMode && (
            <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-950 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-md bg-green-50 dark:bg-green-950 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
                  {success}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="profCurrentPassword" className="text-sm font-medium text-foreground dark:text-gray-300">
                  Current Password
                </label>
                <input
                  id="profCurrentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="profNewPassword" className="text-sm font-medium text-foreground dark:text-gray-300">
                  New Password
                </label>
                <input
                  id="profNewPassword"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="At least 12 characters"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="profConfirmPassword" className="text-sm font-medium text-foreground dark:text-gray-300">
                  Confirm New Password
                </label>
                <input
                  id="profConfirmPassword"
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              <div className="text-xs text-muted-foreground dark:text-muted-foreground space-y-1">
                <p>Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>At least 12 characters</li>
                  <li>At least one uppercase letter</li>
                  <li>At least one lowercase letter</li>
                  <li>At least one number</li>
                  <li>At least one special character</li>
                </ul>
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? 'Changing password...' : 'Change Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
