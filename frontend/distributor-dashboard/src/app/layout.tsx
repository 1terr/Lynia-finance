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
      <head>
        {/* Runtime config loaded before React hydration so createClient()
            can read window.__LYNIA_CONFIG__ on first render. */}
        <script src="/config.js" />
      </head>
      <body className="font-sans">
        <ConfigGuard>{children}</ConfigGuard>
      </body>
    </html>
  );
}
