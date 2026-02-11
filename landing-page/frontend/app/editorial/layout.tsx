import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editorial — Lynia Finance',
  description:
    'Articles on financial inclusion, credit infrastructure, and building for Zimbabwe\u2019s underbanked majority.',
  openGraph: {
    title: 'Editorial — Lynia Finance',
    description:
      'Articles on financial inclusion, credit infrastructure, and building for Zimbabwe\u2019s underbanked majority.',
    url: '/editorial',
  },
};

export default function EditorialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
