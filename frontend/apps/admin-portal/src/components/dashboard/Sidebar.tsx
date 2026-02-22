'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Banknote,
  Smartphone,
  CreditCard,
  BarChart3,
  Shield,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@lynia/utils';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/auth/permissions';
import type { PermissionAction } from '@/types';

interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission?: { resource: string; action: PermissionAction };
  children?: { label: string; href: string }[];
}

const NAVIGATION: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
    requiredPermission: { resource: 'customers', action: 'read' },
    children: [
      { label: 'All Customers', href: '/customers' },
      { label: 'KYC Review', href: '/customers/kyc-review' },
    ],
  },
  {
    label: 'Loans',
    href: '/loans',
    icon: Banknote,
    requiredPermission: { resource: 'loans', action: 'read' },
    children: [
      { label: 'All Loans', href: '/loans' },
      { label: 'Pending Approval', href: '/loans/pending-approval' },
    ],
  },
  {
    label: 'Devices',
    href: '/devices',
    icon: Smartphone,
    requiredPermission: { resource: 'devices', action: 'read' },
    children: [
      { label: 'Inventory', href: '/devices' },
      { label: 'Handovers', href: '/devices/handovers' },
      { label: 'Lock/Unlock', href: '/devices/lock-unlock' },
    ],
  },
  {
    label: 'Payments',
    href: '/payments',
    icon: CreditCard,
    requiredPermission: { resource: 'payments', action: 'read' },
    children: [
      { label: 'All Payments', href: '/payments' },
      { label: 'Collections', href: '/payments/collections' },
    ],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    requiredPermission: { resource: 'reports', action: 'read' },
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNav = NAVIGATION.filter((item) => {
    if (!item.requiredPermission) return true;
    if (!user) return false;
    return hasPermission(
      user.role,
      item.requiredPermission.resource,
      item.requiredPermission.action
    );
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[var(--sidebar-width)] flex-col bg-sidebar transition-transform duration-200 lg:z-30 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-[var(--header-height)] items-center gap-3 border-b border-white/10 px-6">
          <Shield className="h-8 w-8 text-brand-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Lynia Admin</h1>
            <p className="text-xs text-gray-400">Finance Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {filteredNav.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </ul>
        </nav>

        {/* User info footer */}
        {user && (
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
                {user.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user.full_name}
                </p>
                <p className="truncate text-xs text-gray-400">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function SidebarNavItem({
  item,
  pathname,
}: {
  item: SidebarItem;
  pathname: string;
}) {
  const isActive =
    pathname === item.href ||
    (item.children?.some((child) => pathname === child.href) ?? false);
  const Icon = item.icon;

  if (item.children) {
    return (
      <li>
        <details open={isActive}>
          <summary
            className={cn(
              'flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-active text-white'
                : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[open]>&]:rotate-180" />
          </summary>
          <ul className="mt-1 space-y-1 pl-11">
            {item.children.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    'block rounded-lg px-3 py-1.5 text-sm transition-colors',
                    pathname === child.href
                      ? 'font-medium text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {child.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-active text-white'
            : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}
