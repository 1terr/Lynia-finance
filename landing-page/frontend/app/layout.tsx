import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppFAB } from '@/components/layout/WhatsAppFAB';

const siteUrl = 'https://lyniafinance.com';

export const metadata: Metadata = {
  title: 'Lynia Finance — Financial tools for the underbanked',
  description:
    'Smartphones, assets, and cash — delivered through WhatsApp with approval in under 5 minutes. Serving Zimbabwe\u2019s 80% informal workforce.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Lynia Finance',
    title: 'Lynia Finance — Financial tools for the underbanked',
    description:
      'Smartphones, assets, and cash — delivered through WhatsApp with approval in under 5 minutes. Serving Zimbabwe\u2019s 80% informal workforce.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lynia Finance — Financial tools for the underbanked',
    description:
      'Smartphones, assets, and cash — delivered through WhatsApp with approval in under 5 minutes. Serving Zimbabwe\u2019s 80% informal workforce.',
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
        {/* Inter font loaded via Google Fonts CDN in production.
            System font stack used as fallback for offline builds. */}
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
