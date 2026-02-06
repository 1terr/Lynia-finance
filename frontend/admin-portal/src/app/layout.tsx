import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lynia Admin Portal',
  description: 'Admin dashboard for Lynia Finance platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
