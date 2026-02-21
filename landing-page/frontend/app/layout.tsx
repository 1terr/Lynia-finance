import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppFAB } from '@/components/layout/WhatsAppFAB';

const siteUrl = 'https://lyniafinance.com';

export const metadata: Metadata = {
  title: 'Lynia — Financing for the productive majority',
  description:
    'Lynia is the financial infrastructure for Zimbabwe\u2019s $10B informal economy. We transform mobile money velocity into credit identities.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Lynia Finance',
    title: 'Lynia — Financing for the productive majority',
    description:
      'Lynia is the financial infrastructure for Zimbabwe\u2019s $10B informal economy. We transform mobile money velocity into credit identities.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lynia — Financing for the productive majority',
    description:
      'Lynia is the financial infrastructure for Zimbabwe\u2019s $10B informal economy. We transform mobile money velocity into credit identities.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Inter font: preconnect eliminates DNS/TLS latency.
            Migrate to next/font/google when build environment has network. */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
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
        <Navbar />
        <main>{children}</main>
        <Footer />
        <WhatsAppFAB />
      </body>
    </html>
  );
}
