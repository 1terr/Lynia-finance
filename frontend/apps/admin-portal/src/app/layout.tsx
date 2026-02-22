import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { ConfigGuard } from '@/components/layout/config-guard';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lynia Admin Portal',
  description: 'Lynia Finance Admin Dashboard - Device Financing Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runtime config loaded before React hydration so createClient()
            can read window.__LYNIA_CONFIG__ on first render. */}
        <script src="/config.js" />
      </head>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConfigGuard>
            {children}
          </ConfigGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
