import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Lynia Finance',
  url: 'https://lyniafinance.com',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: ['English', 'Shona', 'Ndebele'],
    areaServed: 'ZW',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Harare',
    addressCountry: 'ZW',
  },
};

export const metadata: Metadata = {
  title: 'Contact — Lynia Finance',
  description:
    'Get in touch with Lynia Finance. Become a distributor, explore partnerships, or ask about our credit products for Zimbabwe\u2019s informal economy.',
  openGraph: {
    title: 'Contact — Lynia Finance',
    description:
      'Get in touch with Lynia Finance. Become a distributor, explore partnerships, or ask about our credit products for Zimbabwe\u2019s informal economy.',
    url: '/contact',
    images: [{ url: '/og-default.svg', width: 1200, height: 630, alt: 'Contact Lynia Finance' }],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbSchema items={[{ name: 'Contact', path: '/contact' }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      {children}
    </>
  );
}
