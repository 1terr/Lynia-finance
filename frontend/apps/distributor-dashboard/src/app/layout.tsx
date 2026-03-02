import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { ConfigGuard } from '@/components/layout/config-guard';
import { QueryProvider } from '@/components/layout/query-provider';
import { ToastContainer } from '@/components/ui/toast';
import { ServiceWorkerRegister } from '@/components/layout/sw-register';
import { PerfReporter } from '@/components/layout/perf-reporter';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lynia Distributor Portal',
  description: 'Device distribution management for Lynia Finance distributors',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Lynia Agent',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <ConfigGuard>{children}</ConfigGuard>
          </QueryProvider>
        </ThemeProvider>
        <ToastContainer />
        <ServiceWorkerRegister />
        <PerfReporter />
      </body>
    </html>
  );
}
