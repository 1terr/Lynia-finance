'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { AuthProvider } from '@/components/layout/auth-provider';
import { SessionTimeoutWrapper } from '@/components/layout/session-timeout-wrapper';
import { ErrorBoundary } from '@/components/error-boundary';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SessionTimeoutWrapper />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main id="main-content" className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
          <MobileNav />
        </div>
      </div>
    </AuthProvider>
  );
}
