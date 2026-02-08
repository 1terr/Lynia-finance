'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { fetchDistributorProfile } from '@/lib/api/distributor';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { distributor, isLoading, setDistributor, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Auto-login with mock data for development
    if (!distributor) {
      fetchDistributorProfile()
        .then((d) => { setDistributor(d); setLoading(false); })
        .catch(() => { setLoading(false); router.push('/login'); });
    } else {
      setLoading(false);
    }
  }, [distributor, setDistributor, setLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
