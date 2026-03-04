import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppFAB } from '@/components/layout/WhatsAppFAB';

const siteUrl = 'https://lyniafinance.com';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Lynia — Financing for the productive majority',
  description:
    'Lynia transforms mobile money velocity into credit identities for Zimbabwe\u2019s $10B informal economy. Join the waitlist for digital credit, asset financing, and embedded lending.',
  metadataBase: new URL(siteUrl),
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Lynia Finance',
    title: 'Lynia — Financing for the productive majority',
    description:
      'Lynia transforms mobile money velocity into credit identities for Zimbabwe\u2019s $10B informal economy. Join the waitlist for digital credit, asset financing, and embedded lending.',
    images: [
      {
        url: '/og-default.svg',
        width: 1200,
        height: 630,
        alt: 'Lynia Finance \u2014 Financial infrastructure for Zimbabwe\u2019s informal economy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lynia — Financing for the productive majority',
    description:
      'Lynia transforms mobile money velocity into credit identities for Zimbabwe\u2019s $10B informal economy. Join the waitlist for digital credit, asset financing, and embedded lending.',
    images: ['/og-default.svg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'Lynia Finance',
                  url: siteUrl,
                  description:
                    'Alternative financial infrastructure for Zimbabwe\u2019s underbanked majority.',
                  foundingDate: '2024',
                  areaServed: {
                    '@type': 'Country',
                    name: 'Zimbabwe',
                  },
                  sameAs: [
                    'https://x.com/lyniafinance',
                    'https://linkedin.com/company/lyniafinance',
                  ],
                },
                {
                  '@type': 'WebSite',
                  name: 'Lynia Finance',
                  url: siteUrl,
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-white font-sans">
        {/* Skip to main content — accessibility */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:shadow-stripe-md"
        >
          Skip to main content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
        <WhatsAppFAB />
      </body>
    </html>
  );
}
