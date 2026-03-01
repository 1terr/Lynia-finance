import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Insights — Lynia Finance',
  description:
    'Articles on financial inclusion, credit infrastructure, and building for Zimbabwe\u2019s underbanked majority.',
  openGraph: {
    title: 'Insights — Lynia Finance',
    description:
      'Articles on financial inclusion, credit infrastructure, and building for Zimbabwe\u2019s underbanked majority.',
    url: '/insights',
  },
};

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
