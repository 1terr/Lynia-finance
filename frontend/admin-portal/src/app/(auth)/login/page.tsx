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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const isDemoMode = typeof window !== 'undefined' && !isCognitoConfigured();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.error) {
        setError(result.error);
        return;
      }

      window.location.href = '/';
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg">
          LF
        </div>
        <CardTitle className="text-2xl">Lynia Finance</CardTitle>
        <CardDescription>Sign in to the admin portal</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

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

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
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
      </CardContent>
    </Card>
  );
}
