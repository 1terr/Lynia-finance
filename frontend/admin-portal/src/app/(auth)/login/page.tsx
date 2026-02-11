'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // MED-01: Generic error to avoid leaking account information
        setError('Invalid email or password');
        return;
      }

      // Verify user is an active admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Invalid email or password');
        return;
      }

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('is_active, login_count')
        .eq('id', user.id)
        .single();

      if (!adminUser || !adminUser.is_active) {
        await supabase.auth.signOut();
        // MED-01: Generic error to not reveal account existence or status
        setError('Invalid email or password');
        return;
      }

      // Update last login
      await supabase
        .from('admin_users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: (adminUser.login_count || 0) + 1,
        })
        .eq('id', user.id);

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
        </form>
      </CardContent>
    </Card>
  );
}
