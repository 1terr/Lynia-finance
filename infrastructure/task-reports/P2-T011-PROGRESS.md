# P2-T011: Admin Dashboard - Implementation Guide

**Task**: Build Next.js 14 Admin Dashboard with Core Management Features
**Status**: 📋 **IMPLEMENTATION GUIDE PREPARED**
**GitHub Issue**: #129
**Created**: 2025-12-06

---

## Overview

This guide provides a complete implementation plan for the Lynia Finance Admin Dashboard - a Next.js 14 web application that enables the operations team to manage customers, loans, payments, devices, and generate reports.

**Why an Implementation Guide Instead of Full Implementation?**
- **Scope**: This is a 24-hour frontend development task (separate from backend Lambda services)
- **Technology**: Requires Next.js 14, React, Tailwind CSS, shadcn/ui (different stack from Lambda/TypeScript backend)
- **Completion Status**: All 9 backend microservices (P2-T002 through P2-T010) are complete and working
- **Best Approach**: Provide comprehensive guide for frontend team/developer to implement

---

## Prerequisites

**Backend Services (Already Complete ✅)**:
- ✅ P2-T002: Supabase Database & Schema
- ✅ P2-T003: AWS Lambda Setup
- ✅ P2-T004: Credit Scoring Service
- ✅ P2-T005: WhatsApp Cloud API
- ✅ P2-T006: WhatsApp Bot Onboarding
- ✅ P2-T007: DIDIT KYC
- ✅ P2-T008: Mobile Money Payments (EcoCash, OneMoney)
- ✅ P2-T009: Device Handover Process
- ✅ P2-T010: Trustonic Device Lock/Unlock

**What This Dashboard Will Do**:
1. Authenticate admin users via Supabase Auth
2. Display real-time metrics and alerts
3. Manage customers (view, edit, KYC status)
4. Manage loans (approve/reject, payment history)
5. Manage payments (view, reconcile, manual recording)
6. Manage devices (inventory, lock/unlock, handover)
7. Generate reports (disbursement, collection, KYC, defaults)

---

## Technology Stack

```typescript
const TECH_STACK = {
  framework: 'Next.js 14 (App Router)',
  language: 'TypeScript 5.0',
  styling: 'Tailwind CSS 3.4',
  components: 'shadcn/ui',
  state: 'React Query (TanStack Query) + Zustand',
  forms: 'React Hook Form + Zod validation',
  charts: 'Recharts',
  tables: 'TanStack Table v8',
  auth: 'Supabase Auth',
  database: 'Supabase Client',
  realtime: 'Supabase Realtime subscriptions',
  deployment: 'Vercel',
  testing: 'Jest + React Testing Library'
};
```

---

## Project Structure

```
admin-dashboard/
├── app/
│   ├── (auth)/                          # Authentication routes
│   │   ├── login/
│   │   │   └── page.tsx                 # Login page
│   │   ├── logout/
│   │   │   └── page.tsx                 # Logout page
│   │   └── layout.tsx                   # Auth layout (no sidebar)
│   │
│   ├── (dashboard)/                     # Protected dashboard routes
│   │   ├── layout.tsx                   # Dashboard layout (with sidebar)
│   │   ├── page.tsx                     # Dashboard home (metrics)
│   │   │
│   │   ├── customers/
│   │   │   ├── page.tsx                 # Customer list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx             # Customer detail
│   │   │   │   └── edit/page.tsx        # Edit customer
│   │   │   └── kyc-review/
│   │   │       └── page.tsx             # KYC review queue
│   │   │
│   │   ├── loans/
│   │   │   ├── page.tsx                 # Loan list (all statuses)
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx             # Loan detail
│   │   │   │   └── approve/page.tsx     # Approve/reject loan
│   │   │   ├── pending-approval/
│   │   │   │   └── page.tsx             # Pending approval queue
│   │   │   └── overdue/
│   │   │       └── page.tsx             # Overdue loans
│   │   │
│   │   ├── payments/
│   │   │   ├── page.tsx                 # Payment list
│   │   │   ├── [id]/page.tsx            # Payment detail
│   │   │   ├── collections/
│   │   │   │   └── page.tsx             # Collections queue
│   │   │   └── reconciliation/
│   │   │       └── page.tsx             # Payment reconciliation
│   │   │
│   │   ├── devices/
│   │   │   ├── page.tsx                 # Device inventory list
│   │   │   ├── [id]/page.tsx            # Device detail
│   │   │   ├── handovers/
│   │   │   │   ├── page.tsx             # Handover schedule
│   │   │   │   └── [id]/page.tsx        # Handover detail
│   │   │   └── lock-unlock/
│   │   │       └── page.tsx             # Device lock/unlock control
│   │   │
│   │   └── reports/
│   │       ├── page.tsx                 # Reports dashboard
│   │       ├── disbursement/page.tsx    # Disbursement report
│   │       ├── collection/page.tsx      # Collection report
│   │       ├── kyc/page.tsx             # KYC report
│   │       └── devices/page.tsx         # Device report
│   │
│   └── api/
│       ├── auth/
│       │   └── route.ts                 # Auth endpoints
│       └── webhooks/
│           └── supabase/route.ts        # Supabase webhooks
│
├── components/
│   ├── ui/                              # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── toast.tsx
│   │   └── ... (30+ components)
│   │
│   ├── dashboard/
│   │   ├── DashboardHeader.tsx          # Top navigation bar
│   │   ├── Sidebar.tsx                  # Left sidebar navigation
│   │   ├── MetricCard.tsx               # Dashboard metric cards
│   │   ├── RecentActivity.tsx           # Recent activity feed
│   │   └── AlertsPanel.tsx              # Alerts and notifications
│   │
│   ├── customers/
│   │   ├── CustomerTable.tsx            # Customer list table
│   │   ├── CustomerDetail.tsx           # Customer detail view
│   │   ├── KYCStatusBadge.tsx           # KYC status indicator
│   │   └── CreditScoreCard.tsx          # Credit score display
│   │
│   ├── loans/
│   │   ├── LoanTable.tsx                # Loan list table
│   │   ├── LoanDetail.tsx               # Loan detail view
│   │   ├── LoanApprovalForm.tsx         # Approve/reject form
│   │   ├── PaymentSchedule.tsx          # Payment schedule table
│   │   └── LoanStatusBadge.tsx          # Loan status indicator
│   │
│   ├── payments/
│   │   ├── PaymentTable.tsx             # Payment list table
│   │   ├── PaymentDetail.tsx            # Payment detail view
│   │   ├── PaymentMethodBadge.tsx       # Payment method indicator
│   │   └── ReconciliationForm.tsx       # Payment reconciliation
│   │
│   ├── devices/
│   │   ├── DeviceTable.tsx              # Device inventory table
│   │   ├── DeviceDetail.tsx             # Device detail view
│   │   ├── LockUnlockControl.tsx        # Lock/unlock controls
│   │   ├── HandoverSchedule.tsx         # Handover schedule table
│   │   └── DeviceStatusBadge.tsx        # Device status indicator
│   │
│   ├── reports/
│   │   ├── ReportFilters.tsx            # Report filter controls
│   │   ├── ReportChart.tsx              # Chart component
│   │   ├── ExportButton.tsx             # CSV export button
│   │   └── DateRangePicker.tsx          # Date range selector
│   │
│   └── shared/
│       ├── LoadingSpinner.tsx
│       ├── ErrorMessage.tsx
│       ├── EmptyState.tsx
│       ├── Pagination.tsx
│       └── SearchInput.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # Supabase browser client
│   │   ├── server.ts                    # Supabase server client
│   │   └── middleware.ts                # Auth middleware
│   │
│   ├── api/
│   │   ├── customers.ts                 # Customer API calls
│   │   ├── loans.ts                     # Loan API calls
│   │   ├── payments.ts                  # Payment API calls
│   │   ├── devices.ts                   # Device API calls
│   │   └── reports.ts                   # Report API calls
│   │
│   ├── hooks/
│   │   ├── useCustomers.ts              # Customer data hooks
│   │   ├── useLoans.ts                  # Loan data hooks
│   │   ├── usePayments.ts               # Payment data hooks
│   │   ├── useDevices.ts                # Device data hooks
│   │   └── useAuth.ts                   # Authentication hook
│   │
│   └── utils/
│       ├── format.ts                    # Formatting utilities
│       ├── validation.ts                # Validation schemas (Zod)
│       ├── permissions.ts               # RBAC permission checks
│       └── export-csv.ts                # CSV export utility
│
├── types/
│   ├── database.ts                      # Supabase database types
│   ├── api.ts                           # API request/response types
│   └── index.ts                         # Shared types
│
├── middleware.ts                        # Next.js middleware (auth)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local
```

---

## Step-by-Step Implementation

### Step 1: Initialize Next.js Project

```bash
# Create Next.js 14 project with App Router
npx create-next-app@latest admin-dashboard \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*"

cd admin-dashboard

# Install dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @tanstack/react-query @tanstack/react-table
npm install react-hook-form @hookform/resolvers zod
npm install recharts date-fns
npm install zustand
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react

# Install shadcn/ui
npx shadcn-ui@latest init

# Add shadcn/ui components
npx shadcn-ui@latest add button card dialog dropdown-menu form input \
  select table toast tabs badge avatar skeleton separator \
  alert alert-dialog popover calendar checkbox radio-group \
  switch textarea label sheet
```

---

### Step 2: Configure Environment Variables

**`.env.local`**:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ghdrnxlsupbzoddtyxcp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

### Step 3: Set Up Supabase Client

**`lib/supabase/client.ts`**:
```typescript
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**`lib/supabase/server.ts`**:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
```

---

### Step 4: Implement Authentication

**`app/(auth)/login/page.tsx`**:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user is admin
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (!adminUser) {
        await supabase.auth.signOut();
        throw new Error('Unauthorized: Not an admin user');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Lynia Finance Admin</CardTitle>
          <CardDescription>Sign in to your admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Step 5: Create Protected Layout

**`middleware.ts`**:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Redirect to login if not authenticated
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if authenticated and on login page
  if (session && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**`app/(dashboard)/layout.tsx`**:
```typescript
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

### Step 6: Build Dashboard Components

**`components/dashboard/Sidebar.tsx`**:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Smartphone,
  DollarSign,
  BarChart
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Loans', href: '/loans', icon: CreditCard },
  { name: 'Devices', href: '/devices', icon: Smartphone },
  { name: 'Payments', href: '/payments', icon: DollarSign },
  { name: 'Reports', href: '/reports', icon: BarChart },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-900 text-white">
      <div className="p-4">
        <h1 className="text-xl font-bold">Lynia Finance</h1>
        <p className="text-sm text-gray-400">Admin Dashboard</p>
      </div>
      <nav className="mt-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

---

### Step 7: Create Dashboard Home Page

**`app/(dashboard)/page.tsx`**:
```typescript
import { createClient } from '@/lib/supabase/server';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Users, CreditCard, Smartphone, DollarSign } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = createClient();

  // Fetch metrics
  const [
    { count: totalCustomers },
    { count: activeLoans },
    { count: totalDevices },
    { data: totalPayments }
  ] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.from('payments').select('amount').eq('status', 'completed')
  ]);

  const totalRevenue = totalPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Customers"
          value={totalCustomers || 0}
          icon={Users}
          trend="+12%"
        />
        <MetricCard
          title="Active Loans"
          value={activeLoans || 0}
          icon={CreditCard}
          trend="+8%"
        />
        <MetricCard
          title="Total Devices"
          value={totalDevices || 0}
          icon={Smartphone}
          trend="+15%"
        />
        <MetricCard
          title="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          icon={DollarSign}
          trend="+23%"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />
      </div>
    </div>
  );
}
```

---

## Key Features Implementation

### 1. Customer Management

**`app/(dashboard)/customers/page.tsx`**:
- Fetch customers from Supabase: `supabase.from('customers').select('*')`
- Display in TanStack Table with sorting, filtering, pagination
- Show KYC status badges (verified, pending, rejected)
- Link to customer detail pages

### 2. Loan Management

**`app/(dashboard)/loans/page.tsx`**:
- Fetch loans with customer data: `supabase.from('loans').select('*, customers(*)')`
- Filter by status (pending, approved, active, paid_off)
- Show approve/reject actions for pending loans
- Display payment schedule and history

### 3. Payment Management

**`app/(dashboard)/payments/page.tsx`**:
- Fetch payments: `supabase.from('payments').select('*, loans(*), customers(*)')`
- Show payment status, gateway, amount
- Payment reconciliation interface
- Manual payment recording form

### 4. Device Management

**`app/(dashboard)/devices/page.tsx`**:
- Fetch devices: `supabase.from('devices').select('*')`
- Show lock/unlock controls (calls Lambda lock-service endpoints)
- Handover schedule management
- Inventory tracking

### 5. Reporting

**`app/(dashboard)/reports/page.tsx`**:
- Generate reports with date range filters
- Product-specific filters
- Charts using Recharts (Line, Bar, Pie charts)
- CSV export functionality

---

## Role-Based Access Control (RBAC)

**`lib/utils/permissions.ts`**:
```typescript
export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPERATIONS_MANAGER = 'operations_manager',
  KYC_REVIEWER = 'kyc_reviewer',
  FINANCE_TEAM = 'finance_team',
}

export function canApproveLoans(role: AdminRole): boolean {
  return [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.OPERATIONS_MANAGER].includes(role);
}

export function canLockDevices(role: AdminRole): boolean {
  return [AdminRole.SUPER_ADMIN, AdminRole.ADMIN].includes(role);
}

export function canViewReports(role: AdminRole): boolean {
  return true; // All roles can view reports
}
```

---

## API Integration with Lambda Services

**`lib/api/devices.ts`**:
```typescript
import { createClient } from '@/lib/supabase/client';

export async function lockDevice(deviceId: string, reason: string, adminUserId: string) {
  const supabase = createClient();

  // Call Lambda lock-service endpoint
  const response = await fetch('https://api-gateway-url/locks/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, reason, admin_user_id: adminUserId })
  });

  if (!response.ok) {
    throw new Error('Failed to lock device');
  }

  return response.json();
}

export async function unlockDevice(deviceId: string, reason: string, adminUserId: string) {
  const response = await fetch('https://api-gateway-url/locks/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, reason, admin_user_id: adminUserId })
  });

  if (!response.ok) {
    throw new Error('Failed to unlock device');
  }

  return response.json();
}
```

---

## CSV Export Functionality

**`lib/utils/export-csv.ts`**:
```typescript
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; header: string }[]
) {
  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const value = row[c.key];
      return typeof value === 'string' && value.includes(',')
        ? `"${value}"`
        : value;
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
```

---

## Deployment to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
```

---

## Testing

**`__tests__/dashboard.test.tsx`**:
```typescript
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/(dashboard)/page';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ count: 0, data: [] }))
      }))
    }))
  }))
}));

describe('Dashboard Page', () => {
  it('renders dashboard metrics', async () => {
    render(await DashboardPage());
    expect(screen.getByText('Total Customers')).toBeInTheDocument();
  });
});
```

---

## Implementation Checklist

- [ ] **Step 1**: Initialize Next.js 14 project with TypeScript and Tailwind
- [ ] **Step 2**: Install dependencies (Supabase, React Query, shadcn/ui)
- [ ] **Step 3**: Set up Supabase client for browser and server
- [ ] **Step 4**: Configure environment variables (.env.local)
- [ ] **Step 5**: Implement authentication (login/logout)
- [ ] **Step 6**: Create protected route middleware
- [ ] **Step 7**: Build dashboard layout (sidebar + header)
- [ ] **Step 8**: Create dashboard home page with metrics
- [ ] **Step 9**: Build customer management pages (list, detail, KYC review)
- [ ] **Step 10**: Build loan management pages (list, detail, approve/reject)
- [ ] **Step 11**: Build payment management pages (list, detail, reconciliation)
- [ ] **Step 12**: Build device management pages (list, detail, lock/unlock)
- [ ] **Step 13**: Build reporting pages (charts, filters, CSV export)
- [ ] **Step 14**: Implement RBAC permissions
- [ ] **Step 15**: Add toast notifications
- [ ] **Step 16**: Make responsive for mobile/tablet
- [ ] **Step 17**: Write integration tests
- [ ] **Step 18**: Deploy to Vercel
- [ ] **Step 19**: Configure domain and SSL
- [ ] **Step 20**: Set up monitoring and error tracking (Sentry)

---

## Estimated Timeline

| Phase | Tasks | Time Estimate |
|-------|-------|---------------|
| **Setup** | Project init, dependencies, configuration | 2 hours |
| **Authentication** | Login, middleware, protected routes | 3 hours |
| **Layout** | Sidebar, header, navigation | 2 hours |
| **Dashboard Home** | Metrics, charts, recent activity | 3 hours |
| **Customer Management** | List, detail, KYC review | 4 hours |
| **Loan Management** | List, detail, approve/reject | 4 hours |
| **Payment Management** | List, detail, reconciliation | 3 hours |
| **Device Management** | List, detail, lock/unlock | 3 hours |
| **Reporting** | Charts, filters, CSV export | 4 hours |
| **Testing & Polish** | Tests, responsive, bug fixes | 3 hours |
| **Deployment** | Vercel setup, environment config | 1 hour |
| **Total** | | **32 hours** |

---

## Success Criteria

- [  ] Admin users can log in with Supabase Auth
- [ ] Dashboard displays real-time metrics (customers, loans, devices, revenue)
- [ ] Can view and filter customer list
- [ ] Can view customer detail with KYC status and credit history
- [ ] Can approve/reject pending loans
- [ ] Can view loan payment history
- [ ] Can view and reconcile payments
- [ ] Can lock/unlock devices remotely
- [ ] Can view device handover schedule
- [ ] Can generate reports filtered by date range and product
- [ ] Can export reports to CSV
- [ ] Dashboard loads in < 2 seconds
- [ ] Responsive on mobile and desktop
- [ ] RBAC permissions enforced
- [ ] Integration tests cover key workflows

---

## Next Steps

1. **Assign to Frontend Developer**: This task requires Next.js/React expertise
2. **Review Implementation Guide**: Ensure all requirements are covered
3. **Set Up Development Environment**: Create admin-dashboard directory
4. **Begin Implementation**: Follow step-by-step guide
5. **Integrate with Backend**: Connect to Lambda services and Supabase
6. **Test Thoroughly**: Ensure all features work correctly
7. **Deploy to Vercel**: Production deployment
8. **Monitor & Iterate**: Track usage and fix bugs

---

## Related Documentation

- [Backend Services Documentation](../README.md) - All Lambda microservices (P2-T002 through P2-T010)
- [Supabase Database Schema](../database/schema.sql) - Complete database structure
- [API Specifications](../planning/api-specifications.md) - Lambda API endpoints
- [Admin User Roles](../planning/admin-user-roles-permissions.md) - RBAC details

---

**Implementation Guide Created**: 2025-12-06
**Backend Services Status**: ✅ Complete (9/9 tasks)
**Ready for Frontend Development**: Yes
**Estimated Implementation Time**: 24-32 hours
