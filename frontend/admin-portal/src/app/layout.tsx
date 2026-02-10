import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/layout/theme-provider';
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
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
