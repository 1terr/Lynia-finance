'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { Bell, Menu } from 'lucide-react';

export function Header() {
  const { distributor } = useAuthStore();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-3 md:hidden">
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-xs font-bold text-primary-foreground">L</span>
        </div>
        <span className="text-sm font-bold">Lynia</span>
      </div>

      <div className="hidden md:block">
        <p className="text-sm">
          Welcome back, <span className="font-semibold">{distributor?.name ?? 'Distributor'}</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <div className="hidden md:flex h-8 w-8 rounded-full bg-primary/10 items-center justify-center">
          <span className="text-xs font-semibold text-primary">
            {distributor?.name?.charAt(0) ?? 'D'}
          </span>
        </div>
      </div>
    </header>
  );
}
