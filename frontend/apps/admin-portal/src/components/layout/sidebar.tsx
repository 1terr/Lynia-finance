'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  CreditCard,
  Package,
  Smartphone,
  Wallet,
  BarChart3,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  BookOpen,
  Boxes,
  Building2,
  Database,
  Store,
} from 'lucide-react';
import { cn } from '@lynia/utils';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Permission } from '@/types/auth';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions: Permission[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard, requiredPermissions: ['dashboard:view'] },
      { label: 'Customers', href: '/customers', icon: Users, requiredPermissions: ['customers:read'] },
      { label: 'KYC Review', href: '/kyc', icon: FileCheck, requiredPermissions: ['kyc:read'] },
    ],
  },
  {
    title: 'Lending',
    items: [
      { label: 'Loan Products', href: '/products', icon: Package, requiredPermissions: ['settings:read'] },
      { label: 'Active Loans', href: '/fineract/loans', icon: CreditCard, requiredPermissions: ['loans:read'] },
      { label: 'Handovers', href: '/devices/handovers', icon: HandCoins, requiredPermissions: ['devices:read'] },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Phone Catalog', href: '/products/device-models', icon: BookOpen, requiredPermissions: ['settings:read'] },
      { label: 'Devices', href: '/devices', icon: Smartphone, requiredPermissions: ['devices:read'] },
      { label: 'Stock Mgmt', href: '/devices/adjustments', icon: Boxes, requiredPermissions: ['devices:read'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payments', href: '/payments', icon: Wallet, requiredPermissions: ['payments:read'] },
      { label: 'Fineract', href: '/fineract/products', icon: Database, requiredPermissions: ['loans:read'] },
    ],
  },
  {
    title: 'Partners',
    items: [
      { label: 'Distributors', href: '/distributors', icon: Store, requiredPermissions: ['distributors:read'] },
      { label: 'Organizations', href: '/products/organizations', icon: Building2, requiredPermissions: ['settings:read'] },
    ],
  },
  {
    items: [
      { label: 'Operations', href: '/reports', icon: BarChart3, requiredPermissions: ['reports:read'] },
      { label: 'Analytics', href: '/analytics', icon: TrendingUp, requiredPermissions: ['reports:read'] },
      { label: 'Settings', href: '/settings', icon: Settings, requiredPermissions: ['settings:read'] },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  function isItemActive(item: NavItem) {
    if (item.href === '/') return pathname === '/';
    // Exact match for sub-routes that are children of other nav items
    // e.g. /devices/handovers should not highlight /devices
    if (item.href === '/devices' && (pathname === '/devices/handovers' || pathname === '/devices/adjustments')) return false;
    if (item.href === '/devices/handovers') return pathname.startsWith('/devices/handovers');
    if (item.href === '/devices/adjustments') return pathname.startsWith('/devices/adjustments') || pathname.startsWith('/devices/transfers') || pathname.startsWith('/devices/reports');
    if (item.href === '/products/device-models') return pathname.startsWith('/products/device-models');
    if (item.href === '/products/organizations') return pathname.startsWith('/products/organizations');
    if (item.href === '/products') return pathname === '/products' || (pathname.startsWith('/products/') && !pathname.startsWith('/products/device-models') && !pathname.startsWith('/products/organizations'));
    if (item.href === '/distributors') return pathname.startsWith('/distributors');
    return pathname.startsWith(item.href);
  }

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
        {navSections.map((section, sectionIdx) => {
          const visibleItems = section.items.filter((item) =>
            hasAnyPermission(item.requiredPermissions)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={sectionIdx} className={sectionIdx > 0 ? 'mt-3' : ''}>
              {section.title && !collapsed && (
                <div className="px-3 pb-1 pt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {section.title}
                  </span>
                </div>
              )}
              {section.title && collapsed && (
                <div className="mx-auto my-1 h-px w-8 bg-border" />
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
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
            </div>
          );
        })}
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
