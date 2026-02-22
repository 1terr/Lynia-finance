import type { Metadata } from 'next';
import { ConfigGuard } from '@/components/layout/config-guard';
import { QueryProvider } from '@/components/layout/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lynia Distributor Portal',
  description: 'Device distribution management for Lynia Finance distributors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <QueryProvider>
          <ConfigGuard>{children}</ConfigGuard>
        </QueryProvider>
      </body>
    </html>
  );
}
