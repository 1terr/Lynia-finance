'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@lynia/utils';
import {
  LayoutDashboard,
  PackageCheck,
  Smartphone,
  DollarSign,
  User,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Handovers', href: '/handovers', icon: PackageCheck },
  { label: 'Inventory', href: '/inventory', icon: Smartphone },
  { label: 'Commissions', href: '/commissions', icon: DollarSign },
  { label: 'Profile', href: '/profile', icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { distributor, signOutUser } = useAuthStore();

  return (
    <aside className="hidden md:flex md:w-16 lg:w-64 md:flex-col md:border-r bg-card h-screen sticky top-0 transition-all duration-200">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-3 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary-foreground">L</span>
          </div>
          <div className="hidden lg:block">
            <span className="text-sm font-bold">Lynia</span>
            <span className="text-xs text-muted-foreground block -mt-0.5">Distributor Portal</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors justify-center lg:justify-start',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {distributor && (
        <div className="border-t p-2 lg:p-4">
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">
                {distributor.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0 hidden lg:block">
              <p className="text-sm font-medium truncate">{distributor.name}</p>
              <p className="text-xs text-muted-foreground truncate">{distributor.business_name}</p>
            </div>
            <button onClick={() => { signOutUser(); window.location.href = '/login'; }} className="text-muted-foreground hover:text-foreground hidden lg:block" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
