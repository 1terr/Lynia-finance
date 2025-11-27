# Admin Dashboard Overview & Architecture

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.8 Admin Dashboard Design
**Task ID**: P1-T041
**Priority**: High
**Estimated Duration**: 8 hours

---

## 1. Overview

The Lynia Finance Admin Dashboard is a comprehensive web-based interface that enables the operations team to manage all aspects of the device financing platform. It provides real-time visibility into customer applications, loan portfolios, device inventory, payments, and KYC verification, while supporting critical operational workflows like manual KYC review, loan approvals, and device handover scheduling.

**Key Users**:
- **Admin Team**: Full access to all features
- **Operations Managers**: Loan approvals, device handover, customer support
- **KYC Reviewers**: Manual KYC verification
- **Finance Team**: Payment tracking, collections, reporting
- **Inventory Managers**: Device stock, handover logistics

**Core Modules**:
1. **Dashboard Home**: Real-time metrics and alerts
2. **Customer Management**: Customer profiles, KYC, credit scoring
3. **Loan Management**: Applications, approvals, repayments
4. **Device Management**: Inventory, handovers, lock/unlock
5. **Payment Tracking**: Payments, collections, reconciliation
6. **Reports & Analytics**: Business intelligence, exports

---

## 2. Technology Stack

### 2.1 Frontend Architecture

```typescript
// Tech Stack
const ADMIN_DASHBOARD_STACK = {
  framework: 'Next.js 14 (App Router)',
  language: 'TypeScript',
  styling: 'Tailwind CSS + shadcn/ui',
  state_management: 'React Query + Zustand',
  charts: 'Recharts',
  tables: 'TanStack Table',
  forms: 'React Hook Form + Zod',
  authentication: 'Supabase Auth',
  realtime: 'Supabase Realtime',
  deployment: 'Vercel'
};

// Project Structure
/*
admin-dashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Dashboard home
│   │   ├── customers/
│   │   │   ├── page.tsx                # Customer list
│   │   │   ├── [id]/page.tsx           # Customer detail
│   │   │   └── kyc-review/page.tsx     # KYC review queue
│   │   ├── loans/
│   │   │   ├── page.tsx                # Loan list
│   │   │   ├── [id]/page.tsx           # Loan detail
│   │   │   └── pending-approval/page.tsx
│   │   ├── devices/
│   │   │   ├── page.tsx                # Device inventory
│   │   │   ├── handovers/page.tsx      # Handover schedule
│   │   │   └── lock-unlock/page.tsx    # Device control
│   │   ├── payments/
│   │   │   ├── page.tsx                # Payment list
│   │   │   ├── collections/page.tsx    # Collections queue
│   │   │   └── reconciliation/page.tsx
│   │   └── reports/
│   │       ├── page.tsx
│   │       └── [reportType]/page.tsx
│   └── api/
│       └── [...supabase routes]
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── dashboard/
│   │   ├── DashboardHeader.tsx
│   │   ├── Sidebar.tsx
│   │   └── MetricCard.tsx
│   ├── customers/
│   ├── loans/
│   └── shared/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── api/
│   ├── utils/
│   └── hooks/
└── types/
    └── index.ts
*/
```

### 2.2 Backend Architecture

```typescript
// API Layer
interface AdminAPIEndpoints {
  // Authentication
  'POST /api/auth/login': { email: string; password: string };
  'POST /api/auth/logout': {};
  'GET /api/auth/me': {};

  // Customers
  'GET /api/customers': CustomerListParams;
  'GET /api/customers/:id': { id: string };
  'PATCH /api/customers/:id': Partial<Customer>;
  'GET /api/customers/:id/timeline': { id: string };

  // KYC
  'GET /api/kyc/pending-review': PaginationParams;
  'POST /api/kyc/:id/approve': { id: string; notes?: string };
  'POST /api/kyc/:id/reject': { id: string; reason: string };

  // Loans
  'GET /api/loans': LoanListParams;
  'GET /api/loans/:id': { id: string };
  'POST /api/loans/:id/approve': { id: string; notes?: string };
  'POST /api/loans/:id/reject': { id: string; reason: string };
  'PATCH /api/loans/:id/payment-plan': { id: string; plan: PaymentPlan };

  // Devices
  'GET /api/devices': DeviceListParams;
  'POST /api/devices': CreateDeviceInput;
  'PATCH /api/devices/:id': Partial<Device>;
  'POST /api/devices/:id/lock': { id: string; reason: string };
  'POST /api/devices/:id/unlock': { id: string };

  // Payments
  'GET /api/payments': PaymentListParams;
  'POST /api/payments/:id/confirm': { id: string; proof: string };
  'GET /api/payments/collections': CollectionListParams;

  // Reports
  'GET /api/reports/portfolio': { startDate: Date; endDate: Date };
  'GET /api/reports/collections': { startDate: Date; endDate: Date };
  'GET /api/reports/devices': { startDate: Date; endDate: Date };
}
```

### 2.3 Database Access Layer

```typescript
// Supabase Client with Row Level Security (RLS)
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role for admin operations
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

// Type-safe database queries
interface AdminQueries {
  // Customers
  getCustomers(filters: CustomerFilters): Promise<Customer[]>;
  getCustomerById(id: string): Promise<Customer>;
  updateCustomer(id: string, data: Partial<Customer>): Promise<Customer>;

  // KYC
  getPendingKYC(limit: number, offset: number): Promise<KYCSubmission[]>;
  approveKYC(submissionId: string, reviewerId: string, notes?: string): Promise<void>;
  rejectKYC(submissionId: string, reviewerId: string, reason: string): Promise<void>;

  // Loans
  getLoans(filters: LoanFilters): Promise<Loan[]>;
  approveLoan(loanId: string, approverId: string): Promise<Loan>;
  rejectLoan(loanId: string, approverId: string, reason: string): Promise<Loan>;

  // Devices
  getDeviceInventory(filters: DeviceFilters): Promise<Device[]>;
  updateDeviceStock(deviceId: string, quantity: number): Promise<Device>;
  lockDevice(deviceId: string, loanId: string, reason: string): Promise<void>;

  // Payments
  getPayments(filters: PaymentFilters): Promise<Payment[]>;
  confirmPayment(paymentId: string, confirmerId: string): Promise<Payment>;
}
```

---

## 3. Authentication & Authorization

### 3.1 Role-Based Access Control (RBAC)

```typescript
enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPERATIONS_MANAGER = 'operations_manager',
  KYC_REVIEWER = 'kyc_reviewer',
  FINANCE_TEAM = 'finance_team',
  INVENTORY_MANAGER = 'inventory_manager',
  CUSTOMER_SUPPORT = 'customer_support'
}

interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  [AdminRole.SUPER_ADMIN]: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete'] }
  ],
  [AdminRole.ADMIN]: [
    { resource: 'customers', actions: ['read', 'update'] },
    { resource: 'loans', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'devices', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'payments', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['read'] }
  ],
  [AdminRole.OPERATIONS_MANAGER]: [
    { resource: 'customers', actions: ['read', 'update'] },
    { resource: 'loans', actions: ['read', 'update'] },
    { resource: 'devices', actions: ['read', 'update'] },
    { resource: 'handovers', actions: ['create', 'read', 'update'] }
  ],
  [AdminRole.KYC_REVIEWER]: [
    { resource: 'customers', actions: ['read'] },
    { resource: 'kyc', actions: ['read', 'update'] }
  ],
  [AdminRole.FINANCE_TEAM]: [
    { resource: 'customers', actions: ['read'] },
    { resource: 'loans', actions: ['read'] },
    { resource: 'payments', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['read'] }
  ],
  [AdminRole.INVENTORY_MANAGER]: [
    { resource: 'devices', actions: ['create', 'read', 'update'] },
    { resource: 'handovers', actions: ['read', 'update'] }
  ],
  [AdminRole.CUSTOMER_SUPPORT]: [
    { resource: 'customers', actions: ['read'] },
    { resource: 'loans', actions: ['read'] },
    { resource: 'payments', actions: ['read'] }
  ]
};

// Permission checking utility
function hasPermission(
  userRole: AdminRole,
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete'
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];

  // Super admin has all permissions
  if (permissions.some(p => p.resource === '*')) return true;

  // Check specific resource permissions
  const resourcePermission = permissions.find(p => p.resource === resource);
  return resourcePermission?.actions.includes(action) || false;
}

// React hook for permission checking
function usePermission(resource: string, action: string): boolean {
  const { user } = useAuth();
  return hasPermission(user?.role as AdminRole, resource, action);
}
```

### 3.2 Authentication Flow

```typescript
// Login component
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const { data: authData, error } = await supabaseAdmin.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (error) throw error;

      // Check if user has admin role
      const { data: profile } = await supabaseAdmin
        .from('admin_users')
        .select('role, is_active')
        .eq('id', authData.user.id)
        .single();

      if (!profile?.is_active) {
        throw new Error('Account is inactive');
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Lynia Finance Admin</h2>
          <p className="mt-2 text-center text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              {...register('email')}
              type="email"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              {...register('password')}
              type="password"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## 4. Dashboard Layout

### 4.1 Main Layout Component

```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_active) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={profile} />

      <div className="flex">
        <Sidebar userRole={profile.role} />

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 4.2 Sidebar Navigation

```typescript
// components/dashboard/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  DevicePhoneMobileIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  requiredPermission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Customers', href: '/dashboard/customers', icon: UsersIcon },
  { name: 'KYC Review', href: '/dashboard/customers/kyc-review', icon: DocumentTextIcon, requiredPermission: 'kyc' },
  { name: 'Loans', href: '/dashboard/loans', icon: DocumentTextIcon },
  { name: 'Devices', href: '/dashboard/devices', icon: DevicePhoneMobileIcon },
  { name: 'Payments', href: '/dashboard/payments', icon: CurrencyDollarIcon },
  { name: 'Reports', href: '/dashboard/reports', icon: ChartBarIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon }
];

export function Sidebar({ userRole }: { userRole: AdminRole }) {
  const pathname = usePathname();

  // Filter nav items based on permissions
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (!item.requiredPermission) return true;
    return hasPermission(userRole, item.requiredPermission, 'read');
  });

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <nav className="p-4 space-y-2">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### 4.3 Dashboard Header

```typescript
// components/dashboard/DashboardHeader.tsx
'use client';

import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardHeaderProps {
  user: {
    email: string;
    role: AdminRole;
    first_name?: string;
    last_name?: string;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabaseAdmin.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lynia Finance</h1>
          <p className="text-sm text-gray-500">Admin Dashboard</p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-gray-500">
            <BellIcon className="h-6 w-6" />
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
          </button>

          {/* User Menu */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
              <UserCircleIcon className="h-8 w-8 text-gray-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-700">
                  {user.first_name || user.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => router.push('/dashboard/settings/profile')}
                        className={`${
                          active ? 'bg-gray-100' : ''
                        } block px-4 py-2 text-sm text-gray-700 w-full text-left`}
                      >
                        Profile Settings
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleLogout}
                        className={`${
                          active ? 'bg-gray-100' : ''
                        } block px-4 py-2 text-sm text-gray-700 w-full text-left`}
                      >
                        Sign Out
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </header>
  );
}
```

---

## 5. Dashboard Home / Overview

### 5.1 Dashboard Metrics

```typescript
// app/(dashboard)/page.tsx
import { MetricCard } from '@/components/dashboard/MetricCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { createServerClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = createServerClient();

  // Fetch dashboard metrics
  const [
    customersData,
    loansData,
    paymentsData,
    devicesData
  ] = await Promise.all([
    supabase.from('customers').select('count', { count: 'exact' }),
    supabase.from('loans').select('count, status, principal').eq('status', 'active'),
    supabase.from('payments').select('count, amount_usd, status').eq('status', 'overdue'),
    supabase.from('devices').select('count, available_stock')
  ]);

  const totalCustomers = customersData.count || 0;
  const activeLoans = loansData.data?.length || 0;
  const totalPortfolio = loansData.data?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
  const overduePayments = paymentsData.count || 0;
  const overdueAmount = paymentsData.data?.reduce((sum, p) => sum + p.amount_usd, 0) || 0;
  const availableDevices = devicesData.data?.reduce((sum, d) => sum + d.available_stock, 0) || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="mt-2 text-gray-600">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Customers"
          value={totalCustomers.toLocaleString()}
          change="+12%"
          trend="up"
          icon="users"
        />

        <MetricCard
          title="Active Loans"
          value={activeLoans.toLocaleString()}
          subtitle={`$${totalPortfolio.toLocaleString()} total`}
          change="+8%"
          trend="up"
          icon="document"
        />

        <MetricCard
          title="Overdue Payments"
          value={overduePayments.toLocaleString()}
          subtitle={`$${overdueAmount.toLocaleString()} overdue`}
          change="-3%"
          trend="down"
          icon="alert"
          variant="warning"
        />

        <MetricCard
          title="Available Devices"
          value={availableDevices.toLocaleString()}
          change="+5%"
          trend="up"
          icon="device"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioChart />
        <RecentActivity />
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
```

### 5.2 Metric Card Component

```typescript
// components/dashboard/MetricCard.tsx
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: 'users' | 'document' | 'alert' | 'device' | 'dollar';
  variant?: 'default' | 'warning' | 'success' | 'danger';
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  trend,
  icon,
  variant = 'default'
}: MetricCardProps) {
  const variantStyles = {
    default: 'bg-blue-50 text-blue-600',
    warning: 'bg-yellow-50 text-yellow-600',
    success: 'bg-green-50 text-green-600',
    danger: 'bg-red-50 text-red-600'
  };

  const trendColor = trend === 'up' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>

        <div className={`p-3 rounded-lg ${variantStyles[variant]}`}>
          {/* Icon would go here */}
        </div>
      </div>

      {change && (
        <div className="mt-4 flex items-center">
          {trend === 'up' ? (
            <ArrowUpIcon className={`w-4 h-4 ${trendColor}`} />
          ) : (
            <ArrowDownIcon className={`w-4 h-4 ${trendColor}`} />
          )}
          <span className={`ml-1 text-sm font-medium ${trendColor}`}>
            {change}
          </span>
          <span className="ml-2 text-sm text-gray-500">vs last month</span>
        </div>
      )}
    </div>
  );
}
```

---

## 6. Real-Time Updates

### 6.1 Supabase Realtime Integration

```typescript
// lib/hooks/useRealtimeSubscription.ts
'use client';

import { useEffect, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export function useRealtimeSubscription<T>(
  table: string,
  filter?: { column: string; value: any }
) {
  const [data, setData] = useState<T[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    // Subscribe to changes
    let subscription = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter ? `${filter.column}=eq.${filter.value}` : undefined
        },
        (payload) => {
          console.log('Change received:', payload);

          if (payload.eventType === 'INSERT') {
            setData((prev) => [...prev, payload.new as T]);
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item: any) =>
                item.id === (payload.new as any).id ? (payload.new as T) : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData((prev) =>
              prev.filter((item: any) => item.id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe();

    setChannel(subscription);

    return () => {
      subscription.unsubscribe();
    };
  }, [table, filter?.column, filter?.value]);

  return { data, channel };
}

// Example usage in component
export function PendingKYCList() {
  const { data: pendingKYC } = useRealtimeSubscription<KYCSubmission>(
    'kyc_submissions',
    { column: 'status', value: 'pending_review' }
  );

  return (
    <div>
      <h2>Pending KYC Reviews ({pendingKYC.length})</h2>
      {/* Render list */}
    </div>
  );
}
```

---

## 7. Database Schema for Admin

### 7.1 Admin Users Table

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),

  role VARCHAR(50) NOT NULL CHECK (role IN (
    'super_admin', 'admin', 'operations_manager', 'kyc_reviewer',
    'finance_team', 'inventory_manager', 'customer_support'
  )),

  is_active BOOLEAN DEFAULT TRUE,

  -- Login tracking
  last_login_at TIMESTAMPTZ,
  login_count INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id)
);

-- Indexes
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_active ON admin_users(is_active);
```

### 7.2 Admin Activity Log

```sql
CREATE TABLE admin_activity_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id),

  action_type VARCHAR(50) NOT NULL, -- 'login', 'kyc_approval', 'loan_approval', etc.
  resource_type VARCHAR(50), -- 'customer', 'loan', 'device', etc.
  resource_id UUID,

  action_details JSONB, -- Additional context
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_activity_log_admin_id ON admin_activity_log(admin_id);
CREATE INDEX idx_admin_activity_log_action_type ON admin_activity_log(action_type);
CREATE INDEX idx_admin_activity_log_created_at ON admin_activity_log(created_at DESC);
CREATE INDEX idx_admin_activity_log_resource ON admin_activity_log(resource_type, resource_id);
```

---

## 8. Summary

This admin dashboard architecture provides a comprehensive foundation for Lynia Finance operations:

**Technology Stack**: Next.js 14 + TypeScript + Tailwind + shadcn/ui + Supabase
**Authentication**: Role-based access control (RBAC) with 7 distinct roles
**Real-Time Updates**: Supabase Realtime for live dashboard updates
**Responsive Design**: Mobile-first design with Tailwind CSS
**Type Safety**: Full TypeScript coverage with Zod validation
**Performance**: Server-side rendering with Next.js App Router

**Core Features**:
- Dashboard home with real-time metrics
- Customer management with KYC review
- Loan application workflow
- Device inventory tracking
- Payment and collections management
- Comprehensive reporting and analytics

**Security**:
- Row Level Security (RLS) on Supabase
- Role-based permissions
- Activity logging for audit trails
- Secure authentication with Supabase Auth

**Implementation Priority**: High (required for operations team)
**Implementation Complexity**: High (full-stack application)
**Business Impact**: Critical (enables all operational workflows)

**Related Tasks**:
- P1-T042: Customer Management Dashboard
- P1-T043: Loan & Payment Management Dashboard
- P1-T044: Device Inventory Dashboard
- P1-T045: Reports & Analytics Dashboard

**Next Steps**:
1. Set up Next.js project with TypeScript
2. Configure Supabase authentication
3. Implement RBAC system
4. Build dashboard layout components
5. Create admin users table and seed data
6. Implement dashboard home page
7. Set up real-time subscriptions
8. Build individual module dashboards (next tasks)
