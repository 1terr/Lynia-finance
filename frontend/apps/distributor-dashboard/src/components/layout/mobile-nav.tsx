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
} from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Handovers', href: '/handovers', icon: PackageCheck },
  { label: 'Inventory', href: '/inventory', icon: Smartphone },
  { label: 'Earnings', href: '/commissions', icon: DollarSign },
  { label: 'Profile', href: '/profile', icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card safe-area-bottom md:hidden" aria-label="Main navigation">
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors active:bg-muted/50 relative',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
              )}
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
