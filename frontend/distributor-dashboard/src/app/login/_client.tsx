'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginDistributor, isCognitoConfigured } from '@/lib/api/distributor';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { Smartphone, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setDistributor } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isDemoMode = typeof window !== 'undefined' && !isCognitoConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const distributor = await loginDistributor(email, password);
      setDistributor(distributor);
      // Persist demo session so it survives the hard redirect page reload
      try { sessionStorage.setItem('lynia-demo-distributor', JSON.stringify(distributor)); } catch { /* private browsing */ }
      // Use hard redirect so the AuthProvider re-initialises with fresh session
      window.location.href = '/';
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Smartphone className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Lynia Distributor</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage your devices and handovers</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@distributor.co.zw"
              required
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

          {isDemoMode && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Demo credentials</p>
              <p>Email: kudzai@distributor.co.zw</p>
              <p>Password: any 4+ characters</p>
            </div>
          )}

          {!isDemoMode && (
            <p className="text-xs text-center text-muted-foreground">
              Sign in with your distributor account credentials.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
