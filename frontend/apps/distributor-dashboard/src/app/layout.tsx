import type { Metadata } from 'next';
import { ConfigGuard } from '@/components/layout/config-guard';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lynia Distributor Portal',
  description: 'Device distribution management for Lynia Finance distributors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ConfigGuard>{children}</ConfigGuard>
      </body>
    </html>
  );
}
