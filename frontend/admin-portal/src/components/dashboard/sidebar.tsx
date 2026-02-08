'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';
import type { AdminRole } from '@/types';
import {
  LayoutDashboard,
  Users,
  FileText,
  Smartphone,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  ClipboardCheck,
  X,
} from 'lucide-react';

interface SidebarProps {
  role: AdminRole;
  open: boolean;
  onClose: () => void;
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    permission: null,
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
    permission: 'customers:read' as const,
  },
  {
    label: 'Loans',
    href: '/loans',
    icon: FileText,
    permission: 'loans:read' as const,
  },
  {
    label: 'Devices',
    href: '/devices',
    icon: Smartphone,
    permission: 'devices:read' as const,
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
    permission: 'payments:read' as const,
  },
  {
    label: 'KYC Review',
    href: '/customers/kyc-review',
    icon: ClipboardCheck,
    permission: 'kyc:review' as const,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permission: 'reports:read' as const,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'settings:read' as const,
  },
  {
    label: 'Admin Users',
    href: '/settings/admin-users',
    icon: Shield,
    permission: 'admin_users:read' as const,
  },
];

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(role, item.permission)
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">
              LF
            </div>
            <span className="text-lg font-semibold text-gray-900">Lynia Finance</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-brand-600' : 'text-gray-400')} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-400">Lynia Finance v0.1.0</p>
        </div>
      </aside>
    </>
  );
}
