'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { MainContent } from '@/components/dashboard/MainContent';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col lg:pl-[var(--sidebar-width)]">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </ProtectedRoute>
  );
}
