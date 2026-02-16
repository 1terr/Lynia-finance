'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  CreditCard,
  Smartphone,
  Wallet,
  BarChart3,
  Landmark,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Permission } from '@/types/auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions: Permission[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    requiredPermissions: ['dashboard:view'],
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
    requiredPermissions: ['customers:read'],
  },
  {
    label: 'KYC Review',
    href: '/kyc',
    icon: FileCheck,
    requiredPermissions: ['kyc:read'],
  },
  {
    label: 'Loans',
    href: '/loans',
    icon: CreditCard,
    requiredPermissions: ['loans:read'],
  },
  {
    label: 'Devices',
    href: '/devices',
    icon: Smartphone,
    requiredPermissions: ['devices:read'],
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: Wallet,
    requiredPermissions: ['payments:read'],
  },
  {
    label: 'Fineract',
    href: '/fineract/loans',
    icon: Landmark,
    requiredPermissions: ['loans:read'],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    requiredPermissions: ['reports:read'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    requiredPermissions: ['settings:read'],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const visibleItems = navItems.filter((item) =>
    hasAnyPermission(item.requiredPermissions)
  );

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              L
            </div>
            <span className="text-lg font-semibold">Lynia Admin</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              L
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>
    </aside>
  );
}
