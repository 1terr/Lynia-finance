import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/seo/BreadcrumbSchema';

export const metadata: Metadata = {
  title: 'Insights — Lynia Finance',
  description:
    'Articles on financial inclusion, credit infrastructure, and building for Zimbabwe\u2019s underbanked majority. Research-driven insights from the Lynia team.',
  openGraph: {
    title: 'Insights — Lynia Finance',
    description:
      'Articles on financial inclusion, credit infrastructure, and building for Zimbabwe\u2019s underbanked majority. Research-driven insights from the Lynia team.',
    url: '/insights',
    images: [{ url: '/og-default.svg', width: 1200, height: 630, alt: 'Lynia Finance Insights' }],
  },
};

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbSchema items={[{ name: 'Insights', path: '/insights' }]} />
      {children}
    </>
  );
}
