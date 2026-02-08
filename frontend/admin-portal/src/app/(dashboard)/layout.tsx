'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuthProvider } from '@/components/layout/auth-provider';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <Header sidebarCollapsed={sidebarCollapsed} />
        <main
          className={cn(
            'pt-16 transition-all duration-300',
            sidebarCollapsed ? 'pl-16' : 'pl-64'
          )}
        >
          <div className="p-6">{children}</div>
        </main>
      </div>
    </AuthProvider>
  );
}
